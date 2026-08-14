"""
FileShare Storage Manager
Manages file storage on the local filesystem.
Handles only disk operations — no database coupling (SRP fix).
"""

import os


class StorageManager:
    """Local filesystem storage for encrypted file blobs and chunks."""

    def __init__(self, upload_dir: str):
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    def get_file_path(self, file_id: str) -> str:
        safe_id = os.path.basename(str(file_id))
        return os.path.join(self.upload_dir, safe_id)

    def get_chunk_path(self, transfer_id: str, file_id: str, chunk_index: int) -> str:
        safe_tid = os.path.basename(str(transfer_id))
        safe_fid = os.path.basename(str(file_id))
        chunk_dir = os.path.join(self.upload_dir, "chunks", safe_tid)
        os.makedirs(chunk_dir, exist_ok=True)
        return os.path.join(chunk_dir, f"{safe_fid}_{int(chunk_index)}.chunk")

    def file_exists(self, file_id: str) -> bool:
        return os.path.exists(self.get_file_path(file_id))

    def delete_file(self, file_id: str):
        path = self.get_file_path(file_id)
        if os.path.exists(path) and os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass

    def purge_transfer_chunks(self, transfer_id: str):
        safe_tid = os.path.basename(str(transfer_id))
        chunk_dir = os.path.join(self.upload_dir, "chunks", safe_tid)
        if os.path.exists(chunk_dir):
            try:
                for fname in os.listdir(chunk_dir):
                    fpath = os.path.join(chunk_dir, fname)
                    if os.path.isfile(fpath):
                        os.remove(fpath)
                os.rmdir(chunk_dir)
            except OSError:
                pass

    def list_upload_files(self):
        """List all uploaded data files in the upload directory (excluding chunks dir, dotfiles, gitkeep)."""
        if not os.path.exists(self.upload_dir):
            return []
        return [
            f for f in os.listdir(self.upload_dir)
            if f != "chunks"
            and not f.startswith(".")
            and os.path.isfile(os.path.join(self.upload_dir, f))
        ]
