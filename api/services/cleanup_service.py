"""
FileShare Cleanup Service
Background task that purges expired files, transfers, and orphaned disk blobs.

Performance notes:
- Expired rows are collected and deleted with batched queries
  (DELETE ... WHERE expires_at < ?) instead of one DELETE per row.
- File blobs are deleted only for rows that actually expired.
- The orphan disk scan includes an mtime grace period (300s) to avoid deleting in-flight uploads.
"""

import os
import time
from api.database import DatabaseManager
from api.storage import StorageManager
from api.utils import get_utc_now_iso

# In-flight upload grace period (seconds)
ORPHAN_GRACE_PERIOD_SECONDS = 300


class CleanupService:
    """Periodic background cleanup: purges expired records and orphaned files."""

    def __init__(self, db_manager: DatabaseManager, storage_manager: StorageManager):
        self.db = db_manager
        self.storage = storage_manager

    def run(self):
        """Execute one cleanup pass: expired files, expired transfers, orphan blobs."""
        conn = None
        try:
            conn = self.db.get_connection()
            now_iso = get_utc_now_iso()

            # 1. Expired files: collect IDs, delete blobs, then bulk-delete rows
            cursor = conn.execute("SELECT id FROM files WHERE expires_at < ?", (now_iso,))
            expired_ids = [row["id"] for row in cursor.fetchall()]

            for file_id in expired_ids:
                self.storage.delete_file(file_id)

            if expired_ids:
                placeholders = ",".join("?" for _ in expired_ids)
                conn.execute(f"DELETE FROM files WHERE id IN ({placeholders})", expired_ids)

            # 2. Expired transfers: purge their chunk dirs, then bulk-delete rows
            t_cursor = conn.execute("SELECT id FROM transfers WHERE expires_at < ?", (now_iso,))
            expired_transfer_ids = [row["id"] for row in t_cursor.fetchall()]

            for transfer_id in expired_transfer_ids:
                self.storage.purge_transfer_chunks(transfer_id)

            if expired_transfer_ids:
                placeholders = ",".join("?" for _ in expired_transfer_ids)
                conn.execute(f"DELETE FROM transfers WHERE id IN ({placeholders})", expired_transfer_ids)
                conn.execute(f"DELETE FROM chunks WHERE transfer_id IN ({placeholders})", expired_transfer_ids)

            conn.commit()

            # 3. Orphan blob scan: delete any file on disk with no DB row,
            # respecting a grace period to avoid race conditions with in-flight uploads.
            active_cursor = conn.execute("SELECT id FROM files")
            active_ids = {row["id"] for row in active_cursor.fetchall()}
            current_time = time.time()

            for filename in self.storage.list_upload_files():
                if filename not in active_ids:
                    fpath = self.storage.get_file_path(filename)
                    try:
                        # Only purge if file was created/modified more than grace period ago
                        file_mtime = os.path.getmtime(fpath)
                        if (current_time - file_mtime) > ORPHAN_GRACE_PERIOD_SECONDS:
                            self.storage.delete_file(filename)
                    except OSError:
                        pass

        except Exception:
            pass
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass
