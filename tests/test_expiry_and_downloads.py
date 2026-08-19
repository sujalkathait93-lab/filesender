"""
Test suite for share-code expiry, download count logic, metadata fields, and receiver/sender status messaging.
"""

import io
import os
import sys
import hashlib
import tempfile
import time
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test_exp.db")
os.environ["UPLOAD_DIR"] = os.path.join(tempfile.mkdtemp(), "uploads_exp")

from api.index import app
from api.storage import StorageManager
from api.config import UPLOAD_DIR
from api.utils import get_utc_now, parse_iso_datetime, is_expired

TEST_KEY = "1122334455"
PROOF = hashlib.sha256(f"fileshare-access:{TEST_KEY}".encode("utf-8")).hexdigest()


class ProofClient:
    def __init__(self, inner):
        self._c = inner

    def post(self, *args, **kwargs):
        data = kwargs.get("data")
        if isinstance(data, dict) and "file" in data:
            data.setdefault("access_hash", PROOF)
        return self._c.post(*args, **kwargs)

    def get(self, path, *args, **kwargs):
        skip = kwargs.pop("no_proof", False)
        if not skip and ("/file-info/" in path or "/download/" in path or "/files/" in path):
            headers = dict(kwargs.get("headers") or {})
            if "X-Access-Proof" not in headers and "proof=" not in path:
                headers["X-Access-Proof"] = PROOF
                kwargs["headers"] = headers
        return self._c.get(path, *args, **kwargs)

    def delete(self, *args, **kwargs):
        return self._c.delete(*args, **kwargs)


def test_metadata_fields_stored_and_returned():
    """Verify createdAt, expiresAt, maxDownloads, downloadCount, downloadsRemaining are correctly returned."""
    client = ProofClient(app.test_client())
    r = client.post("/api/upload", data={
        "file": (io.BytesIO(b"metadata-verification-content"), "meta.txt.encrypted"),
        "iv": "aa" * 12,
        "salt": "bb" * 16,
        "original_name": "metadata_doc.txt",
        "original_size": "29",
        "compressed": "1",
        "max_downloads": "5",
        "burn_on_read": "0",
        "expiry_seconds": "30",
    }, content_type="multipart/form-data")
    assert r.status_code == 200
    data = r.get_json()

    assert "file_id" in data
    assert "createdAt" in data and "created_at" in data
    assert "expiresAt" in data and "expires_at" in data
    assert data["max_downloads"] == 5
    assert data["maxDownloads"] == 5
    assert data["download_count"] == 0
    assert data["downloadCount"] == 0
    assert data["downloads_remaining"] == 5
    assert data["downloadsRemaining"] == 5

    fid = data["file_id"]

    # Check file info response
    info_res = client.get(f"/api/file-info/{fid}")
    assert info_res.status_code == 200
    info = info_res.get_json()
    assert info["id"] == fid
    assert info["createdAt"] == data["createdAt"]
    assert info["expiresAt"] == data["expiresAt"]
    assert info["maxDownloads"] == 5
    assert info["downloadCount"] == 0
    assert info["downloadsRemaining"] == 5
    assert info["status"] == "ready"


def test_download_count_and_limit_enforcement():
    """Verify file is downloadable up to max_downloads, then returns 410 with clear message."""
    client = ProofClient(app.test_client())
    r = client.post("/api/upload", data={
        "file": (io.BytesIO(b"quota-test-payload"), "quota.encrypted"),
        "iv": "cc" * 12,
        "salt": "dd" * 16,
        "original_name": "quota_test.pdf",
        "original_size": "18",
        "compressed": "1",
        "max_downloads": "3",
        "burn_on_read": "0",
        "expiry_seconds": "60",
    }, content_type="multipart/form-data")
    assert r.status_code == 200
    fid = r.get_json()["file_id"]

    # 1st download
    d1 = client.get(f"/api/download/{fid}")
    assert d1.status_code == 200
    assert d1.data == b"quota-test-payload"

    # Info after 1st download: 1 used, 2 remaining
    info1 = client.get(f"/api/file-info/{fid}").get_json()
    assert info1["download_count"] == 1
    assert info1["downloads_remaining"] == 2

    # 2nd download
    d2 = client.get(f"/api/download/{fid}")
    assert d2.status_code == 200
    assert d2.data == b"quota-test-payload"

    info2 = client.get(f"/api/file-info/{fid}").get_json()
    assert info2["download_count"] == 2
    assert info2["downloads_remaining"] == 1

    # 3rd download (max limit)
    d3 = client.get(f"/api/download/{fid}")
    assert d3.status_code == 200
    assert d3.data == b"quota-test-payload"

    # 4th download must be rejected with 410 Gone and specific message
    d4 = client.get(f"/api/download/{fid}")
    assert d4.status_code == 410
    d4_json = d4.get_json()
    assert "download limit has been reached" in d4_json["detail"].lower()

    # File info after limit reached must also return 410 Gone with limit message
    info_after = client.get(f"/api/file-info/{fid}")
    assert info_after.status_code == 410
    assert "download limit has been reached" in info_after.get_json()["detail"].lower()


def test_unlimited_downloads_mode():
    """Verify max_downloads=0 allows unlimited downloads."""
    client = ProofClient(app.test_client())
    r = client.post("/api/upload", data={
        "file": (io.BytesIO(b"unlimited-content"), "unlimited.encrypted"),
        "iv": "ee" * 12,
        "salt": "ff" * 16,
        "original_name": "unlimited.txt",
        "original_size": "17",
        "max_downloads": "0",
        "burn_on_read": "0",
        "expiry_seconds": "60",
    }, content_type="multipart/form-data")
    assert r.status_code == 200
    fid = r.get_json()["file_id"]

    for _ in range(10):
        res = client.get(f"/api/download/{fid}")
        assert res.status_code == 200
        assert res.data == b"unlimited-content"

    info = client.get(f"/api/file-info/{fid}").get_json()
    assert info["download_count"] == 10
    assert info["max_downloads"] == 0
    assert info["downloads_remaining"] is None


def test_expiry_time_rejection():
    """Verify expired file returns 410 Gone with time limit expired message."""
    client = ProofClient(app.test_client())
    storage_mgr = StorageManager(UPLOAD_DIR)
    fid = "e0e00099"
    with open(storage_mgr.get_file_path(fid), "wb") as f:
        f.write(b"expired-payload")

    from api.database import DatabaseManager
    from api.config import DB_PATH
    db = DatabaseManager(DB_PATH)
    conn = db.get_connection()
    past_iso = (get_utc_now() - timedelta(minutes=5)).isoformat()
    conn.execute("""
        INSERT OR REPLACE INTO files (id, transfer_id, filename, original_name, original_size, encrypted_size,
                           mime_type, created_at, expires_at, download_count, max_downloads, iv, salt, compressed, burn_on_read, status, access_hash)
        VALUES (?, ?, 'exp.encrypted', 'expired.txt', 15, 15, 'text/plain', ?, ?, 0, 10, '11'*12, '22'*16, 1, 0, 'ready', ?)
    """, (fid, fid, (get_utc_now() - timedelta(minutes=10)).isoformat(), past_iso, PROOF))
    conn.commit()
    conn.close()

    info_res = client.get(f"/api/file-info/{fid}")
    assert info_res.status_code == 410
    assert "sharing time limit has expired" in info_res.get_json()["detail"].lower()

    down_res = client.get(f"/api/download/{fid}")
    assert down_res.status_code == 410
    assert "sharing time limit has expired" in down_res.get_json()["detail"].lower()



def test_burn_on_read_lifecycle():
    """Verify Burn-on-Read allows exactly 1 download and then returns 410 with self-destruct notice."""
    client = ProofClient(app.test_client())
    r = client.post("/api/upload", data={
        "file": (io.BytesIO(b"top-secret-burn"), "burn.encrypted"),
        "iv": "12" * 12,
        "salt": "34" * 16,
        "original_name": "secret_plan.pdf",
        "original_size": "15",
        "max_downloads": "1",
        "burn_on_read": "1",
        "expiry_seconds": "60",
    }, content_type="multipart/form-data")
    assert r.status_code == 200
    fid = r.get_json()["file_id"]

    # Preview does not burn
    prev = client.get(f"/api/download/{fid}?preview=true")
    assert prev.status_code == 200
    assert prev.data == b"top-secret-burn"

    # Actual download succeeds
    d1 = client.get(f"/api/download/{fid}")
    assert d1.status_code == 200
    assert d1.data == b"top-secret-burn"

    # Second download returns 410 Gone with burn/self-destruct message
    d2 = client.get(f"/api/download/{fid}")
    assert d2.status_code == 410
    assert "burn after read" in d2.get_json()["detail"].lower() or "self-destruct" in d2.get_json()["detail"].lower()

    # File info returns 410 Gone with burn message
    info = client.get(f"/api/file-info/{fid}")
    assert info.status_code == 410
    assert "burn after read" in info.get_json()["detail"].lower() or "self-destruct" in info.get_json()["detail"].lower()
