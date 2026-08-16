"""
FileShare Transfer Service
Business logic for file uploads, downloads, token refresh, and deletion.
Coordinates between DatabaseManager and StorageManager without coupling them.

Concurrency safety:
- Download counting is done with a single atomic UPDATE that enforces
  the limit inside the database, so concurrent downloads can never
  exceed max_downloads.
- Token refresh uses the same atomic UPDATE + RETURNING pattern.
"""

import os
from datetime import timedelta

from api.database import DatabaseManager
from api.storage import StorageManager
from api.config import MAX_FILE_SIZE, MAX_REFRESHES_PER_SESSION, MAX_PREVIEWS_PER_FILE
from api.utils import generate_id, generate_owner_token, hash_token, tokens_match, proofs_match, get_utc_now
from api.errors import NotFoundError, GoneError, ConflictError, ForbiddenError


class TransferService:
    """Orchestrates file transfer operations across storage and database layers."""

    def __init__(self, db_manager: DatabaseManager, storage_manager: StorageManager):
        self.db = db_manager
        self.storage = storage_manager

    # ─── Upload ─────────────────────────────────────────────────────────────

    def upload_file(self, file_obj, form_data: dict) -> dict:
        """
        Upload an encrypted file blob.
        form_data must already be validated (see api.validation).
        Returns dict with file_id, transfer_id, share_url, expires_at, etc.
        """
        iv = form_data["iv"]
        salt = form_data["salt"]
        original_name = form_data["original_name"]
        original_size = form_data["original_size"]
        compressed = form_data["compressed"]
        max_downloads = form_data["max_downloads"]
        burn_on_read = form_data["burn_on_read"]
        expiry_hours = form_data["expiry_hours"]
        sharing_mode = form_data["sharing_mode"]
        transfer_id = form_data["transfer_id"]
        checksum = (form_data.get("checksum") or "").strip()[:64]
        access_hash = form_data["access_hash"]

        file_id = generate_id()
        transfer_id = transfer_id or file_id
        owner_token = generate_owner_token()
        file_path = self.storage.get_file_path(file_id)

        # Stream write with size enforcement (never loads the entire blob into RAM)
        encrypted_size = 0
        try:
            with open(file_path, "wb") as f:
                while chunk := file_obj.read(131072):  # 128 KB write buffer
                    encrypted_size += len(chunk)
                    if encrypted_size > MAX_FILE_SIZE:
                        raise ValueError("Total file size cannot exceed 2 GB")
                    f.write(chunk)
        except Exception:
            self.storage.delete_file(file_id)
            raise

        expires_at = get_utc_now() + timedelta(hours=expiry_hours)
        effective_max_downloads = 1 if burn_on_read == 1 else max_downloads

        conn = self.db.get_connection()
        try:
            # Create transfer record (UPSERT so multi-file transfers accumulate)
            conn.execute("""
                INSERT INTO transfers (id, token_hash, status, expires_at, total_size, file_count, sharing_mode, refresh_count, max_refreshes, burn_on_read)
                VALUES (?, ?, 'active', ?, ?, 1, ?, 0, 5, ?)
                ON CONFLICT(id) DO UPDATE SET total_size = total_size + excluded.total_size, file_count = file_count + 1
            """, (transfer_id, hash_token(owner_token), expires_at.isoformat(), original_size, sharing_mode, burn_on_read))

            # Insert file metadata
            conn.execute("""
                INSERT INTO files (id, transfer_id, filename, original_name, original_size, encrypted_size,
                                  mime_type, expires_at, max_downloads, iv, salt, compressed, checksum, burn_on_read, status, access_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?)
            """, (
                file_id, transfer_id, file_obj.filename or "file.encrypted", original_name, original_size, encrypted_size,
                file_obj.content_type or "application/octet-stream", expires_at.isoformat(),
                effective_max_downloads, iv, salt, compressed, checksum, burn_on_read, access_hash
            ))

            conn.commit()
        except Exception:
            self.storage.delete_file(file_id)
            raise
        finally:
            conn.close()

        return {
            "file_id": file_id,
            "transfer_id": transfer_id,
            "share_url": f"/download/{file_id}",
            "expires_at": expires_at.isoformat(),
            "refresh_count": 0,
            "max_refreshes": MAX_REFRESHES_PER_SESSION,
            "qr_data": file_id,
            "owner_token": owner_token,
        }

    # ─── Token refresh ──────────────────────────────────────────────────────

    def refresh_token(self, transfer_id: str) -> dict:
        """
        Refresh transfer token / QR code. Atomic and race-safe:
        the database enforces the refresh limit inside the UPDATE.
        """
        conn = self.db.get_connection()
        try:
            row = conn.execute("""
                UPDATE transfers
                SET refresh_count = refresh_count + 1
                WHERE id = ? AND refresh_count < max_refreshes
                RETURNING refresh_count, max_refreshes
            """, (transfer_id,)).fetchone()

            if not row:
                # Either the transfer is missing, or the limit was reached.
                existing = conn.execute(
                    "SELECT refresh_count, max_refreshes FROM transfers WHERE id = ?",
                    (transfer_id,)
                ).fetchone()
                if not existing:
                    raise NotFoundError("Transfer session not found")
                raise ConflictError(
                    f"QR refresh limit reached|{existing['refresh_count']}|{existing['max_refreshes']}"
                )

            conn.commit()
            return {
                "transfer_id": transfer_id,
                "refresh_count": row["refresh_count"],
                "max_refreshes": row["max_refreshes"],
                "message": f"Token refreshed ({row['refresh_count']}/{row['max_refreshes']})"
            }
        finally:
            conn.close()

    # ─── File info ──────────────────────────────────────────────────────────

    def _require_access_proof(self, row, proof: str):
        stored = ""
        try:
            stored = row["access_hash"] or ""
        except (IndexError, KeyError):
            stored = ""
        if not proofs_match(proof, stored):
            raise ForbiddenError("Access proof required")

    def get_file_info(self, file_id: str, proof: str = "") -> dict:
        """
        Get file metadata (no blob).
        Raises NotFoundError if missing.
        Raises GoneError if expired or burned/max downloads reached.
        """
        conn = self.db.get_connection()
        try:
            row = conn.execute(
                "SELECT * FROM files WHERE id = ? AND expires_at > ?",
                (file_id, get_utc_now().isoformat())
            ).fetchone()

            if not row:
                # Try transfer lookup (legacy share links point at transfer IDs)
                t_row = conn.execute(
                    "SELECT * FROM transfers WHERE id = ? AND expires_at > ?",
                    (file_id, get_utc_now().isoformat())
                ).fetchone()
                if t_row:
                    row = conn.execute(
                        "SELECT * FROM files WHERE transfer_id = ? LIMIT 1",
                        (file_id,)
                    ).fetchone()

            if not row:
                # Check if it was in the DB but expired
                expired_check = conn.execute("SELECT id FROM files WHERE id = ? OR transfer_id = ?", (file_id, file_id)).fetchone()
                if expired_check:
                    raise GoneError("Transfer has expired")
                raise NotFoundError("Transfer not found or expired")

            if (row["max_downloads"] > 0 and row["download_count"] >= row["max_downloads"]) or row["status"] == "burned":
                raise GoneError("File has been burned/deleted after reading")

            self._require_access_proof(row, proof)

            return {
                "id": row["id"],
                "transfer_id": row["transfer_id"] or row["id"],
                "original_name": row["original_name"],
                "original_size": row["original_size"],
                "encrypted_size": row["encrypted_size"],
                "mime_type": row["mime_type"],
                "created_at": row["created_at"],
                "expires_at": row["expires_at"],
                "download_count": row["download_count"],
                "max_downloads": row["max_downloads"],
                "compressed": bool(row["compressed"]),
                "burn_on_read": bool(row["burn_on_read"]),
                "iv": row["iv"],
                "salt": row["salt"],
                "checksum": row["checksum"] or ""
            }
        finally:
            conn.close()

    # ─── Download ───────────────────────────────────────────────────────────

    def download_file(self, file_id: str, preview: bool = False, proof: str = ""):
        """
        Prepare file for download. Increments counter atomically unless preview.
        Returns (row_dict, file_path, is_burn).
        """
        conn = self.db.get_connection()
        try:
            row = conn.execute(
                "SELECT * FROM files WHERE id = ? AND expires_at > ?",
                (file_id, get_utc_now().isoformat())
            ).fetchone()

            if not row:
                expired_check = conn.execute("SELECT id FROM files WHERE id = ?", (file_id,)).fetchone()
                if expired_check:
                    raise GoneError("Transfer has expired")
                raise NotFoundError("File not found or expired")

            if row["status"] == "burned":
                raise GoneError("File has self-destructed (Burn-on-Read active)")

            self._require_access_proof(row, proof)

            if preview:
                preview_updated = conn.execute("""
                    UPDATE files
                    SET preview_count = COALESCE(preview_count, 0) + 1
                    WHERE id = ? AND COALESCE(preview_count, 0) < ?
                """, (file_id, MAX_PREVIEWS_PER_FILE))
                if preview_updated.rowcount == 0:
                    raise GoneError("Preview limit reached for this transfer")
                conn.commit()
                new_count = row["download_count"]
            elif row["max_downloads"] > 0:
                # Atomic limit-enforcing increment (safe under concurrent downloads)
                updated = conn.execute("""
                    UPDATE files
                    SET download_count = download_count + 1
                    WHERE id = ? AND download_count < max_downloads
                """, (file_id,))
                if updated.rowcount == 0:
                    raise GoneError("File has self-destructed (Burn-on-Read active)")
                conn.commit()
                new_count = row["download_count"] + 1
            else:
                conn.execute("""
                    UPDATE files
                    SET download_count = download_count + 1
                    WHERE id = ?
                """, (file_id,))
                conn.commit()
                new_count = row["download_count"] + 1

            is_burn = False if preview else (bool(row["burn_on_read"]) or (row["max_downloads"] > 0 and new_count >= row["max_downloads"]))
        finally:
            conn.close()

        file_path = self.storage.get_file_path(file_id)
        if not os.path.exists(file_path):
            raise NotFoundError("File data missing")

        row_dict = {
            "id": row["id"],
            "filename": row["filename"],
            "original_name": row["original_name"],
            "encrypted_size": row["encrypted_size"],
            "compressed": row["compressed"],
            "burn_on_read": row["burn_on_read"],
            "iv": row["iv"],
            "salt": row["salt"],
            "checksum": row["checksum"] or "",
        }

        return row_dict, file_path, is_burn

    # ─── Purge / delete ─────────────────────────────────────────────────────

    def purge_file(self, file_id: str):
        """
        Zero-Knowledge Complete Data Purging: deletes physical blob AND database records.
        Safe to call even if the file is already gone.
        """
        self.storage.delete_file(file_id)
        conn = self.db.get_connection()
        try:
            conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
            conn.execute("DELETE FROM chunks WHERE file_id = ?", (file_id,))
            conn.commit()
        except Exception:
            pass
        finally:
            conn.close()

    def delete_file(self, file_id: str, owner_token: str):
        """Delete a file when the sender presents the owner token from upload."""
        if not owner_token:
            raise ForbiddenError("Owner token required")

        conn = self.db.get_connection()
        try:
            row = conn.execute(
                "SELECT transfer_id FROM files WHERE id = ?",
                (file_id,),
            ).fetchone()
            if not row:
                raise NotFoundError("File not found")

            transfer_id = row["transfer_id"] or file_id
            t_row = conn.execute(
                "SELECT token_hash FROM transfers WHERE id = ?",
                (transfer_id,),
            ).fetchone()
            stored_hash = t_row["token_hash"] if t_row else None
            if not tokens_match(owner_token, stored_hash or ""):
                raise ForbiddenError("Owner token required")

            conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
            conn.execute("DELETE FROM chunks WHERE file_id = ?", (file_id,))
            conn.commit()
        finally:
            conn.close()
        self.storage.delete_file(file_id)

    # ─── Stats ──────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        """Public limits only — do not leak live file counts."""
        return {
            "max_file_size": MAX_FILE_SIZE,
            "max_refreshes": MAX_REFRESHES_PER_SESSION,
            "max_previews": MAX_PREVIEWS_PER_FILE,
            "server_time": get_utc_now().isoformat()
        }
