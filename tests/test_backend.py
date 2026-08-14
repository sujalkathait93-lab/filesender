"""End-to-end backend smoke test using Flask's test client."""
import io
import os
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["UPLOAD_DIR"] = os.path.join(tempfile.mkdtemp(), "uploads")

from api.index import app  # noqa: E402
from api.storage import StorageManager
from api.config import UPLOAD_DIR

client = app.test_client()
passed = 0
failed = 0


def check(name, condition, extra=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name} {extra}")


print("== health ==")
r = client.get("/api/health")
check("health 200", r.status_code == 200)

print("== validation ==")
r = client.post("/api/upload", data={})
check("upload without file -> 400", r.status_code == 400)

r = client.post("/api/upload", data={
    "file": (io.BytesIO(b"hello"), "a.encrypted"),
    "iv": "", "salt": "x" * 32,
}, content_type="multipart/form-data")
check("upload missing iv -> 400", r.status_code == 400)

r = client.post("/api/upload", data={
    "file": (io.BytesIO(b"hello"), "a.encrypted"),
    "iv": "ab" * 12, "salt": "cd" * 16, "expiry_hours": "999999",
}, content_type="multipart/form-data")
check("upload bad expiry -> 400", r.status_code == 400)

print("== upload / info / download ==")
r = client.post("/api/upload", data={
    "file": (io.BytesIO(b"encrypted-bytes-1234567890"), "test.encrypted"),
    "iv": "ab" * 12,
    "salt": "cd" * 16,
    "original_name": "myfile.txt",
    "original_size": "1000",
    "compressed": "1",
    "max_downloads": "2",
    "burn_on_read": "0",
    "expiry_hours": "1",
}, content_type="multipart/form-data")
check("upload ok", r.status_code == 200, r.data[:200])
data = r.get_json()
fid = data["file_id"]
check("file_id 8 hex", len(fid) == 8)

r = client.get(f"/api/file-info/{fid}")
check("file-info 200", r.status_code == 200)
info = r.get_json()
check("file-info metadata", info["original_name"] == "myfile.txt" and info["max_downloads"] == 2)
check("file-info checksum default", info.get("checksum") == "")

r = client.get(f"/api/download/{fid}")
check("download 200", r.status_code == 200)
check("download body", r.data == b"encrypted-bytes-1234567890")
check("download headers", r.headers.get("X-IV") == "ab" * 12 and r.headers.get("X-Burn-On-Read") == "0")

print("== 30-Second Preview Mode (Non-Destructive) ==")
r = client.post("/api/upload", data={
    "file": (io.BytesIO(b"preview-safe-payload"), "preview_test.encrypted"),
    "iv": "ab" * 12,
    "salt": "cd" * 16,
    "original_name": "preview_doc.pdf",
    "original_size": "150",
    "burn_on_read": "1",
    "expiry_hours": "1",
}, content_type="multipart/form-data")
p_id = r.get_json()["file_id"]

# 1. Preview request must return 200 and NOT increment download counter / burn file
r_prev = client.get(f"/api/download/{p_id}?preview=true")
check("preview download 200", r_prev.status_code == 200 and r_prev.data == b"preview-safe-payload")
check("preview does not purge disk blob", StorageManager(UPLOAD_DIR).file_exists(p_id))

# 2. File info still returns 200 after preview
r_info = client.get(f"/api/file-info/{p_id}")
check("file-info accessible after preview", r_info.status_code == 200 and r_info.get_json()["download_count"] == 0)

# 3. Subsequent real download triggers burn-on-read purge
r_down = client.get(f"/api/download/{p_id}")
check("final download after preview 200", r_down.status_code == 200 and r_down.data == b"preview-safe-payload")
r_down_after = client.get(f"/api/download/{p_id}")
check("download after burn rejected (404 or 410)", r_down_after.status_code in (404, 410))
check("file blob purged from disk after real download", not StorageManager(UPLOAD_DIR).file_exists(p_id))

print("== max_downloads enforcement (atomic) ==")
r = client.get(f"/api/download/{fid}")
check("download 2 ok (reaches limit, burns)", r.status_code == 200)
r = client.get(f"/api/download/{fid}")
check("download 3 rejected (410 or 404)", r.status_code in (404, 410), r.status_code)
r = client.get(f"/api/file-info/{fid}")
check("file-info after burn (404 or 410)", r.status_code in (404, 410), r.status_code)

print("== burn on read purge ==")
r = client.post("/api/upload", data={
    "file": (io.BytesIO(b"burn-me-now"), "burn.encrypted"),
    "iv": "ab" * 12,
    "salt": "cd" * 16,
    "original_name": "burn.txt",
    "original_size": "50",
    "burn_on_read": "1",
}, content_type="multipart/form-data")
burn_id = r.get_json()["file_id"]
r = client.get(f"/api/download/{burn_id}")
check("burn download ok", r.status_code == 200 and r.data == b"burn-me-now")
r = client.get(f"/api/download/{burn_id}")
check("burn download after purge (404 or 410)", r.status_code in (404, 410), r.status_code)
check("burn blob deleted from disk", not StorageManager(UPLOAD_DIR).file_exists(burn_id))

print("== token refresh limit ==")
r = client.post("/api/upload", data={
    "file": (io.BytesIO(b"refresh-test"), "r.encrypted"),
    "iv": "ab" * 12, "salt": "cd" * 16,
}, content_type="multipart/form-data")
tid = r.get_json()["transfer_id"]
ok = 0
for i in range(7):
    r = client.post(f"/api/transfers/{tid}/token/refresh")
    if r.status_code == 200:
        ok += 1
check("refreshes 1-5 succeed", ok == 5)
r = client.post(f"/api/transfers/{tid}/token/refresh")
check("6th refresh -> 429", r.status_code == 429)
check("429 payload shape", r.get_json().get("limit_reached") is True)

print("== stats / delete ==")
r = client.get("/api/stats")
check("stats 200", r.status_code == 200 and r.get_json()["total_files"] >= 0)

r = client.post("/api/upload", data={
    "file": (io.BytesIO(b"to-delete"), "d.encrypted"),
    "iv": "ab" * 12, "salt": "cd" * 16,
}, content_type="multipart/form-data")
del_id = r.get_json()["file_id"]
r = client.delete(f"/api/files/{del_id}")
check("delete 200", r.status_code == 200)
r = client.get(f"/api/file-info/{del_id}")
check("info after delete -> 404", r.status_code == 404)

print("== rate limiting ==")
before = time.monotonic()
limited = 0
for i in range(200):
    r = client.get("/api/file-info/aaaaaaaa")
    if r.status_code == 429:
        limited += 1
check("file-info rate limited", limited > 0)
check("rate limit Retry-After header", r.headers.get("Retry-After") is not None)
print(f"  200 rapid lookups took {time.monotonic() - before:.2f}s")

print("== route aliases & preflights (405 prevention) ==")
r_alias = client.post("/upload", data={
    "file": (io.BytesIO(b"alias-upload"), "alias.encrypted"),
    "iv": "ab" * 12, "salt": "cd" * 16,
}, content_type="multipart/form-data")
check("upload via /upload without /api -> 200", r_alias.status_code == 200)

r_root_upload = client.post("/", data={
    "file": (io.BytesIO(b"root-upload"), "root.encrypted"),
    "iv": "ab" * 12, "salt": "cd" * 16,
}, content_type="multipart/form-data")
check("upload via / (rewritten path) -> 200", r_root_upload.status_code == 200)

r_options_api = client.options("/api/upload")
check("OPTIONS /api/upload -> 204", r_options_api.status_code == 204)

r_options_alias = client.options("/upload")
check("OPTIONS /upload -> 204", r_options_alias.status_code == 204)

r_health_alias = client.get("/health")
check("health via /health -> 200", r_health_alias.status_code == 200)

r_stats_alias = client.get("/stats")
check("stats via /stats -> 200", r_stats_alias.status_code == 200)

print(f"\n== {passed} passed, {failed} failed ==")
sys.exit(1 if failed else 0)
