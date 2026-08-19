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
from api.errors import NotFoundError, GoneError, ConflictError, ForbiddenError, ValidationError

MAX_ALLOWED_ENCRYPTED = MAX_FILE_SIZE + 64 * 1024 * 1024  # 1 GB + overhead


class TransferService:
    """Orchestrates file transfer operations across storage and database layers."""

    def __init__(self, db_manager: DatabaseManager, storage_manager: StorageManager):
        self.db = db_manager
        self.storage = storage_manager

    # ─── Upload (Single Shot) ───────────────────────────────────────────────

    def upload_file(self, file_obj, form_data: dict) -> dict:
        """
        Upload an encrypted file blob in a single request.
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
                while chunk := file_obj.read(262144):  # 256 KB write buffer for high-throughput streaming
                    encrypted_size += len(chunk)
                    if encrypted_size > MAX_ALLOWED_ENCRYPTED:
                        raise ValueError("Total file size cannot exceed 1 GB")
                    f.write(chunk)
        except Exception:
            self.storage.delete_file(file_id)
            raise

        expires_at = get_utc_now() + timedelta(hours=expiry_hours)
        effective_max_downloads = max_downloads

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

    # ─── Upload (Chunked Pipeline) ──────────────────────────────────────────

    def init_chunked_upload(self, form_data: dict, filename: str = "", content_type: str = "") -> dict:
        """Initialize a multi-chunk upload session."""
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
        expires_at = get_utc_now() + timedelta(hours=expiry_hours)
        effective_max_downloads = max_downloads

        conn = self.db.get_connection()
        try:
            conn.execute("""
                INSERT INTO transfers (id, token_hash, status, expires_at, total_size, file_count, sharing_mode, refresh_count, max_refreshes, burn_on_read)
                VALUES (?, ?, 'uploading', ?, ?, 1, ?, 0, 5, ?)
                ON CONFLICT(id) DO UPDATE SET total_size = total_size + excluded.total_size, file_count = file_count + 1
            """, (transfer_id, hash_token(owner_token), expires_at.isoformat(), original_size, sharing_mode, burn_on_read))

            conn.execute("""
                INSERT INTO files (id, transfer_id, filename, original_name, original_size, encrypted_size,
                                  mime_type, expires_at, max_downloads, iv, salt, compressed, checksum, burn_on_read, status, access_hash)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 'uploading', ?)
            """, (
                file_id, transfer_id, filename or "file.encrypted", original_name, original_size,
                content_type or "application/octet-stream", expires_at.isoformat(),
                effective_max_downloads, iv, salt, compressed, checksum, burn_on_read, access_hash
            ))
            conn.commit()
        finally:
            conn.close()

        return {
            "file_id": file_id,
            "transfer_id": transfer_id,
            "share_url": f"/download/{file_id}",
            "expires_at": expires_at.isoformat(),
            "owner_token": owner_token,
            "refresh_count": 0,
            "max_refreshes": MAX_REFRESHES_PER_SESSION,
        }

    def save_chunk(self, transfer_id: str, file_id: str, chunk_index: int, total_chunks: int, chunk_file_obj, checksum: str = "") -> dict:
        """Save a single chunk file to disk and record it in database."""
        chunk_id = f"{file_id}_{chunk_index}"
        chunk_path = self.storage.get_chunk_path(transfer_id, file_id, chunk_index)

        chunk_size = 0
        with open(chunk_path, "wb") as f:
            while chunk_data := chunk_file_obj.read(131072):
                chunk_size += len(chunk_data)
                f.write(chunk_data)

        conn = self.db.get_connection()
        try:
            conn.execute("""
                INSERT OR REPLACE INTO chunks (id, transfer_id, file_id, chunk_index, total_chunks, chunk_size, checksum)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (chunk_id, transfer_id, file_id, chunk_index, total_chunks, chunk_size, checksum))
            conn.commit()
        finally:
            conn.close()

        return {"chunk_index": chunk_index, "chunk_size": chunk_size, "received": True}

    def complete_chunked_upload(self, transfer_id: str, file_id: str, total_chunks: int, owner_token: str = "") -> dict:
        """Assemble received chunks into the final encrypted blob and mark transfer ready."""
        conn = self.db.get_connection()
        try:
            row = conn.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not row:
                raise NotFoundError("Transfer not found")

            t_row = conn.execute("SELECT * FROM transfers WHERE id = ?", (transfer_id,)).fetchone()
            if not t_row:
                raise NotFoundError("Transfer session not found")

            if owner_token and not tokens_match(owner_token, t_row["token_hash"] or ""):
                raise ForbiddenError("Invalid owner token")

            file_path = self.storage.get_file_path(file_id)
            total_encrypted_size = 0

            with open(file_path, "wb") as out_f:
                for idx in range(total_chunks):
                    c_path = self.storage.get_chunk_path(transfer_id, file_id, idx)
                    if not os.path.exists(c_path):
                        raise ValidationError(f"Missing chunk {idx} of {total_chunks}")
                    with open(c_path, "rb") as in_f:
                        while piece := in_f.read(262144):
                            total_encrypted_size += len(piece)
                            if total_encrypted_size > MAX_ALLOWED_ENCRYPTED:
                                raise ValueError("Total file size cannot exceed 1 GB")
                            out_f.write(piece)

            # Purge temporary chunks
            self.storage.purge_transfer_chunks(transfer_id)

            conn.execute("UPDATE files SET status = 'ready', encrypted_size = ? WHERE id = ?", (total_encrypted_size, file_id))
            conn.execute("UPDATE transfers SET status = 'active' WHERE id = ?", (transfer_id,))
            conn.execute("DELETE FROM chunks WHERE file_id = ?", (file_id,))
            conn.commit()

            return {
                "file_id": file_id,
                "transfer_id": transfer_id,
                "share_url": f"/download/{file_id}",
                "expires_at": row["expires_at"],
                "refresh_count": t_row["refresh_count"],
                "max_refreshes": t_row["max_refreshes"],
                "qr_data": file_id,
                "owner_token": owner_token,
            }
        finally:
            conn.close()

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
        if stored and not proofs_match(proof, stored):
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
                "SELECT * FROM files WHERE id = ?",
                (file_id,)
            ).fetchone()

            if not row:
                # Try transfer lookup (legacy share links point at transfer IDs)
                t_row = conn.execute(
                    "SELECT * FROM transfers WHERE id = ?",
                    (file_id,)
                ).fetchone()
                if t_row:
                    row = conn.execute(
                        "SELECT * FROM files WHERE transfer_id = ? LIMIT 1",
                        (file_id,)
                    ).fetchone()

            if not row:
                raise NotFoundError("Transfer not found or expired")

            now_iso = get_utc_now().isoformat()
            if row["expires_at"] and row["expires_at"] <= now_iso:
                raise GoneError("This file is no longer available because the sharing time limit has expired.")

            if row["status"] == "burned":
                raise GoneError("This file is no longer available. It was protected with Burn After Read and has self-destructed.")

            if bool(row["burn_on_read"]) and row["max_downloads"] > 0 and row["download_count"] >= row["max_downloads"]:
                raise GoneError("This file is no longer available. It was protected with Burn After Read and has self-destructed.")

            if row["max_downloads"] > 0 and row["download_count"] >= row["max_downloads"]:
                raise GoneError("The download limit has been reached. This file is no longer available.")

            self._require_access_proof(row, proof)

            downloads_remaining = None
            if row["max_downloads"] > 0:
                downloads_remaining = max(0, row["max_downloads"] - row["download_count"])

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
                "downloads_remaining": downloads_remaining,
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
        Prepare file for download stream. Verifies availability and access proof.
        Returns (row_dict, file_path, is_burn).
        """
        conn = self.db.get_connection()
        try:
            row = conn.execute(
                "SELECT * FROM files WHERE id = ?",
                (file_id,)
            ).fetchone()

            if not row:
                raise NotFoundError("File not found or expired")

            now_iso = get_utc_now().isoformat()
            if row["expires_at"] and row["expires_at"] <= now_iso:
                raise GoneError("This file is no longer available because the sharing time limit has expired.")

            if row["status"] == "burned":
                raise GoneError("This file is no longer available. It was protected with Burn After Read and has self-destructed.")

            if bool(row["burn_on_read"]) and row["max_downloads"] > 0 and row["download_count"] >= row["max_downloads"]:
                raise GoneError("This file is no longer available. It was protected with Burn After Read and has self-destructed.")

            if row["max_downloads"] > 0 and row["download_count"] >= row["max_downloads"]:
                raise GoneError("The download limit has been reached. This file is no longer available.")

            self._require_access_proof(row, proof)

            if preview:
                conn.execute("""
                    UPDATE files
                    SET preview_count = COALESCE(preview_count, 0) + 1
                    WHERE id = ?
                """, (file_id,))
                conn.commit()
                is_burn = False
            else:
                next_count = row["download_count"] + 1
                is_burn = (
                    (bool(row["burn_on_read"]) and (row["max_downloads"] == 0 or next_count >= row["max_downloads"]))
                    or (row["max_downloads"] > 0 and next_count >= row["max_downloads"])
                )
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
            "max_downloads": row["max_downloads"],
            "download_count": row["download_count"],
            "iv": row["iv"],
            "salt": row["salt"],
            "checksum": row["checksum"] or "",
        }

        return row_dict, file_path, is_burn

    def record_successful_download(self, file_id: str) -> bool:
        """
        Atomically records a completed, successful download.
        Purges file if max_downloads or burn_on_read threshold is reached.
        Returns True if burned/purged, False otherwise.
        """
        conn = self.db.get_connection()
        should_purge = False
        try:
            row = conn.execute(
                "SELECT download_count, max_downloads, burn_on_read FROM files WHERE id = ?",
                (file_id,)
            ).fetchone()
            if not row:
                return False

            updated = conn.execute("""
                UPDATE files
                SET download_count = download_count + 1
                WHERE id = ?
                RETURNING download_count, max_downloads, burn_on_read
            """, (file_id,)).fetchone()

            if updated:
                new_count = updated["download_count"]
                max_d = updated["max_downloads"]
                burn = bool(updated["burn_on_read"])
                if (burn and (max_d == 0 or new_count >= max_d)) or (max_d > 0 and new_count >= max_d):
                    should_purge = True
                    conn.execute("UPDATE files SET status = 'burned' WHERE id = ?", (file_id,))
            conn.commit()
        except Exception:
            pass
        finally:
            conn.close()

        if should_purge:
            self.purge_file(file_id)
        return should_purge

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
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("purge_file DB cleanup failed for %s: %s", file_id, e)
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
