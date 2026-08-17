"""
FileShare Database Manager
Manages SQLite connection lifecycle, schema initialization, WAL mode, and indexes.

Concurrency notes:
- WAL mode allows concurrent readers with a single writer.
- busy_timeout makes concurrent writers wait instead of failing instantly.
- Indexes keep expiry sweeps and transfer lookups fast even with many files.
"""

import os
import sqlite3

from api.config import DB_PATH


class DatabaseManager:
    """SQLite database manager with schema auto-migration."""

    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        self.init_database()

    def get_connection(self):
        """Open a connection with safe concurrency settings."""
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 10000")
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA synchronous = NORMAL")
        return conn

    def init_database(self):
        conn = self.get_connection()
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                transfer_id TEXT,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                original_size INTEGER NOT NULL,
                encrypted_size INTEGER NOT NULL,
                mime_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                download_count INTEGER DEFAULT 0,
                max_downloads INTEGER DEFAULT 10,
                iv TEXT NOT NULL,
                salt TEXT NOT NULL,
                checksum TEXT,
                compressed INTEGER DEFAULT 1,
                burn_on_read INTEGER DEFAULT 0,
                preview_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'ready',
                access_hash TEXT
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS transfers (
                id TEXT PRIMARY KEY,
                token_hash TEXT,
                sender_ip TEXT,
                receiver_ip TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                completed_at TIMESTAMP,
                total_size INTEGER DEFAULT 0,
                file_count INTEGER DEFAULT 1,
                sharing_mode TEXT DEFAULT 'standard',
                refresh_count INTEGER DEFAULT 0,
                max_refreshes INTEGER DEFAULT 5,
                burn_on_read INTEGER DEFAULT 0
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                transfer_id TEXT,
                file_id TEXT,
                chunk_index INTEGER,
                total_chunks INTEGER,
                chunk_size INTEGER,
                checksum TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Add missing columns safely if upgrading existing DB
        columns_to_add = [
            ("files", "transfer_id", "TEXT"),
            ("files", "burn_on_read", "INTEGER DEFAULT 0"),
            ("files", "status", "TEXT DEFAULT 'ready'"),
            ("files", "preview_count", "INTEGER DEFAULT 0"),
            ("files", "access_hash", "TEXT"),
            ("transfers", "token_hash", "TEXT"),
            ("transfers", "refresh_count", "INTEGER DEFAULT 0"),
            ("transfers", "max_refreshes", "INTEGER DEFAULT 5"),
            ("transfers", "total_size", "INTEGER DEFAULT 0"),
            ("transfers", "file_count", "INTEGER DEFAULT 1"),
            ("transfers", "sharing_mode", "TEXT DEFAULT 'standard'"),
            ("transfers", "burn_on_read", "INTEGER DEFAULT 0"),
            ("transfers", "expires_at", "TIMESTAMP")
        ]
        for table, col, col_type in columns_to_add:
            try:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
            except sqlite3.OperationalError:
                pass

        # Indexes for the queries that run most often (expiry sweeps, lookups)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_files_expires ON files(expires_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_files_transfer ON files(transfer_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_transfers_expires ON transfers(expires_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chunks_transfer ON chunks(transfer_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id)")

        conn.commit()
        conn.close()
