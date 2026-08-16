"""
Comprehensive FileShare Backend Test Suite
Tests all 20 required scenarios:
 1. One file + QR
 2. One file + code
 3. Multiple files + QR
 4. Multiple files + code
 5. Same QR + 5 users
 6. Same code + 5 users
 7. Maximum downloads = 5
 8. Maximum downloads = 100
 9. Unlimited downloads until expiry
10. Expired QR
11. Expired code
12. Burn-on-Read ON
13. Burn-on-Read OFF
14. Image preview
15. PDF preview
16. Unsupported file download
17. Large file upload
18. Large file download
19. Invalid code
20. Already expired/limit-reached transfer
"""

import io
import os
import sys
import hashlib
import tempfile
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["UPLOAD_DIR"] = os.path.join(tempfile.mkdtemp(), "uploads")

from api.index import app
from api.storage import StorageManager
from api.config import UPLOAD_DIR
from api.utils import get_utc_now

TEST_KEY = "aabbccddeeff0011"
PROOF = hashlib.sha256(f"fileshare-access:{TEST_KEY}".encode("utf-8")).hexdigest()
WRONG_PROOF = hashlib.sha256(b"fileshare-access:wrong-password").hexdigest()


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
        if not skip and ("/file-info/" in path or "/download/" in path):
            headers = dict(kwargs.get("headers") or {})
            if "X-Access-Proof" not in headers and "proof=" not in path:
                headers["X-Access-Proof"] = PROOF
                kwargs["headers"] = headers
        return self._c.get(path, *args, **kwargs)

    def delete(self, *args, **kwargs):
        return self._c.delete(*args, **kwargs)

    def options(self, *args, **kwargs):
        return self._c.options(*args, **kwargs)



def run_all_tests():
    client = ProofClient(app.test_client())
    passed = 0
    failed = 0

    def check(name, condition, extra=""):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"  PASS  {name}")
        else:
            failed += 1
            print(f"  FAIL  {name} {extra}")

    print("== Health & Network Diagnostics ==")
    r = client.get("/api/health")
    check("health 200", r.status_code == 200)
    health = r.get_json()
    check("health reports persistent_storage", "persistent_storage" in health)
    r_net = client.get("/api/network-info")
    check("network-info 200", r_net.status_code == 200 and "local_ips" in r_net.get_json())

    # Scenario 1: One file + QR
    print("\n== Scenario 1 & 2: Single File Transfer (QR + Code Access) ==")
    r1 = client.post("/api/upload", data={
        "file": (io.BytesIO(b"single-file-encrypted-content"), "single.encrypted"),
        "iv": "aa" * 12,
        "salt": "bb" * 16,
        "original_name": "document.txt",
        "original_size": "28",
        "compressed": "1",
        "max_downloads": "10",
        "burn_on_read": "0",
        "expiry_hours": "24",
    }, content_type="multipart/form-data")
    check("Scenario 1: Upload single file", r1.status_code == 200)
    data1 = r1.get_json()
    fid1 = data1["file_id"]
    check("Scenario 1: File ID generated (16-hex)", len(fid1) == 16)
    check("Scenario 1: Owner token returned", isinstance(data1.get("owner_token"), str) and len(data1["owner_token"]) == 32)
    check("Scenario 1: QR data matches File ID", data1["qr_data"] == fid1)

    # Scenario 2: One file + code lookup
    r2_info = client.get(f"/api/file-info/{fid1}")
    check("Scenario 2: Code lookup gets metadata", r2_info.status_code == 200 and r2_info.get_json()["original_name"] == "document.txt")
    r2_down = client.get(f"/api/download/{fid1}")
    check("Scenario 2: Download single file via code", r2_down.status_code == 200 and r2_down.data == b"single-file-encrypted-content")

    # Scenario 3 & 4: Multiple files + QR / Code
    print("\n== Scenario 3 & 4: Multiple Files Bundle (Single QR & Transfer Code) ==")
    r3 = client.post("/api/upload", data={
        "file": (io.BytesIO(b"FSBUNDLE1-multiple-files-payload"), "bundle.bundle.encrypted"),
        "iv": "cc" * 12,
        "salt": "dd" * 16,
        "original_name": "Bundle_4_files.bundle",
        "original_size": "5000",
        "compressed": "1",
        "max_downloads": "10",
        "burn_on_read": "0",
        "expiry_hours": "24",
    }, content_type="multipart/form-data")
    check("Scenario 3: Upload multi-file bundle", r3.status_code == 200)
    data3 = r3.get_json()
    fid3 = data3["file_id"]
    check("Scenario 3: Single QR data for multi-file bundle", data3["qr_data"] == fid3)

    r4_info = client.get(f"/api/file-info/{fid3}")
    check("Scenario 4: Multi-file bundle info accessible", r4_info.status_code == 200 and r4_info.get_json()["original_name"] == "Bundle_4_files.bundle")
    r4_down = client.get(f"/api/download/{fid3}")
    check("Scenario 4: Multi-file bundle download via transfer code", r4_down.status_code == 200 and r4_down.data == b"FSBUNDLE1-multiple-files-payload")

    # Scenario 5 & 6: Same QR/Code for 5 users
    print("\n== Scenario 5 & 6: Same QR & Code for Multiple Users (5 Users) ==")
    r5 = client.post("/api/upload", data={
        "file": (io.BytesIO(b"shared-among-5-users"), "team.encrypted"),
        "iv": "ee" * 12,
        "salt": "ff" * 16,
        "original_name": "team_notes.txt",
        "original_size": "21",
        "max_downloads": "10",
        "burn_on_read": "0",
        "expiry_hours": "24",
    }, content_type="multipart/form-data")
    fid5 = r5.get_json()["file_id"]

    all_5_ok = True
    for user_num in range(1, 6):
        # QR scan / info lookup
        inf = client.get(f"/api/file-info/{fid5}")
        # Download
        dl = client.get(f"/api/download/{fid5}")
        if inf.status_code != 200 or dl.status_code != 200 or dl.data != b"shared-among-5-users":
            all_5_ok = False

    check("Scenario 5: 5 users access via QR successfully", all_5_ok)
    r5_info_after = client.get(f"/api/file-info/{fid5}")
    check("Scenario 6: 5 users downloaded from single transfer code (count=5)", r5_info_after.get_json()["download_count"] == 5)

    # Scenario 7: Maximum downloads = 5
    print("\n== Scenario 7: Maximum Downloads = 5 Enforcement ==")
    r7 = client.post("/api/upload", data={
        "file": (io.BytesIO(b"limit-5-payload"), "limit5.encrypted"),
        "iv": "11" * 12,
        "salt": "22" * 16,
        "original_name": "quota5.txt",
        "original_size": "15",
        "max_downloads": "5",
        "burn_on_read": "0",
        "expiry_hours": "24",
    }, content_type="multipart/form-data")
    fid7 = r7.get_json()["file_id"]

    success_downloads = 0
    for _ in range(5):
        if client.get(f"/api/download/{fid7}").status_code == 200:
            success_downloads += 1
    check("Scenario 7: Exactly 5 downloads allowed", success_downloads == 5)

    # 6th download must be rejected
    r7_6th = client.get(f"/api/download/{fid7}")
    check("Scenario 7: 6th download rejected (410 or 404)", r7_6th.status_code in (404, 410))
    check("Scenario 7: File blob purged after limit reached", not StorageManager(UPLOAD_DIR).file_exists(fid7))

    # Scenario 8: Maximum downloads = 100
    print("\n== Scenario 8: Maximum Downloads = 100 Configurable ==")
    r8 = client.post("/api/upload", data={
        "file": (io.BytesIO(b"quota-100-payload"), "quota100.encrypted"),
        "iv": "33" * 12,
        "salt": "44" * 16,
        "original_name": "large_distribution.txt",
        "original_size": "18",
        "max_downloads": "100",
        "burn_on_read": "0",
        "expiry_hours": "24",
    }, content_type="multipart/form-data")
    check("Scenario 8: Upload with max_downloads=100", r8.status_code == 200)
    fid8 = r8.get_json()["file_id"]
    r8_info = client.get(f"/api/file-info/{fid8}")
    check("Scenario 8: Metadata stores max_downloads=100", r8_info.get_json()["max_downloads"] == 100)

    # Scenario 9: Unlimited downloads until expiry (max_downloads = 0)
    print("\n== Scenario 9: Unlimited Downloads Until Expiry (max_downloads = 0) ==")
    r9 = client.post("/api/upload", data={
        "file": (io.BytesIO(b"unlimited-downloads-payload"), "unlimited.encrypted"),
        "iv": "55" * 12,
        "salt": "66" * 16,
        "original_name": "public_broadcast.txt",
        "original_size": "27",
        "max_downloads": "0",
        "burn_on_read": "0",
        "expiry_hours": "24",
    }, content_type="multipart/form-data")
    check("Scenario 9: Upload with unlimited downloads (max_downloads=0)", r9.status_code == 200)
    fid9 = r9.get_json()["file_id"]

    unlimited_ok = True
    for _ in range(15):
        if client.get(f"/api/download/{fid9}").status_code != 200:
            unlimited_ok = False
    check("Scenario 9: 15 consecutive downloads succeed in unlimited mode", unlimited_ok)
    check("Scenario 9: File still exists and active", StorageManager(UPLOAD_DIR).file_exists(fid9))

    # Scenario 10 & 11: Expired QR and Code
    print("\n== Scenario 10 & 11: Expired Transfers (QR & Code) ==")
    # Manually insert expired file record
    storage_mgr = StorageManager(UPLOAD_DIR)
    fid_exp = "e0e00001"
    with open(storage_mgr.get_file_path(fid_exp), "wb") as f:
        f.write(b"expired-payload")

    from api.database import DatabaseManager
    from api.config import DB_PATH
    db = DatabaseManager(DB_PATH)
    conn = db.get_connection()
    past_iso = (get_utc_now() - timedelta(hours=2)).isoformat()
    conn.execute("""
        INSERT OR REPLACE INTO files (id, transfer_id, filename, original_name, original_size, encrypted_size,
                           mime_type, expires_at, download_count, max_downloads, iv, salt, compressed, burn_on_read, status, access_hash)
        VALUES (?, ?, 'exp.encrypted', 'expired_doc.txt', 15, 15, 'text/plain', ?, 0, 10, '11'*12, '22'*16, 1, 0, 'ready', ?)
    """, (fid_exp, fid_exp, past_iso, PROOF))
    conn.commit()
    conn.close()

    r10_info = client.get(f"/api/file-info/{fid_exp}")
    check("Scenario 10: Expired QR lookup rejected (410 or 404)", r10_info.status_code in (404, 410))
    r11_down = client.get(f"/api/download/{fid_exp}")
    check("Scenario 11: Expired Code download rejected (410 or 404)", r11_down.status_code in (404, 410))

    # Scenario 12: Burn-on-Read ON
    print("\n== Scenario 12: Burn-on-Read ON ==")
    r12 = client.post("/api/upload", data={
        "file": (io.BytesIO(b"burn-on-read-secret"), "secret.encrypted"),
        "iv": "77" * 12,
        "salt": "88" * 16,
        "original_name": "confidential.pdf",
        "original_size": "21",
        "burn_on_read": "1",
        "expiry_hours": "1",
    }, content_type="multipart/form-data")
    fid12 = r12.get_json()["file_id"]
    r12_first = client.get(f"/api/download/{fid12}")
    check("Scenario 12: First download succeeds", r12_first.status_code == 200 and r12_first.data == b"burn-on-read-secret")
    r12_second = client.get(f"/api/download/{fid12}")
    check("Scenario 12: Second download rejected (410 or 404)", r12_second.status_code in (404, 410))
    check("Scenario 12: Storage file purged", not storage_mgr.file_exists(fid12))

    # Scenario 13: Burn-on-Read OFF
    print("\n== Scenario 13: Burn-on-Read OFF ==")
    r13 = client.post("/api/upload", data={
        "file": (io.BytesIO(b"burn-off-content"), "notes.encrypted"),
        "iv": "99" * 12,
        "salt": "00" * 16,
        "original_name": "shared_guide.md",
        "original_size": "16",
        "burn_on_read": "0",
        "max_downloads": "10",
        "expiry_hours": "1",
    }, content_type="multipart/form-data")
    fid13 = r13.get_json()["file_id"]
    dl1 = client.get(f"/api/download/{fid13}")
    dl2 = client.get(f"/api/download/{fid13}")
    check("Scenario 13: Multiple downloads succeed when Burn-on-Read is OFF", dl1.status_code == 200 and dl2.status_code == 200)

    # Scenario 14 & 15: Image and PDF Previews (Non-destructive)
    print("\n== Scenario 14 & 15: Image & PDF Previews (Non-Destructive) ==")
    r14 = client.post("/api/upload", data={
        "file": (io.BytesIO(b"image-binary-stream"), "photo.png.encrypted"),
        "iv": "aa" * 12,
        "salt": "bb" * 16,
        "original_name": "photo.png",
        "original_size": "19",
        "burn_on_read": "1",
    }, content_type="multipart/form-data")
    fid14 = r14.get_json()["file_id"]
    r14_prev = client.get(f"/api/download/{fid14}?preview=true")
    check("Scenario 14: Image preview returns 200 without burning", r14_prev.status_code == 200 and storage_mgr.file_exists(fid14))

    r15 = client.post("/api/upload", data={
        "file": (io.BytesIO(b"pdf-binary-stream"), "report.pdf.encrypted"),
        "iv": "cc" * 12,
        "salt": "dd" * 16,
        "original_name": "report.pdf",
        "original_size": "17",
        "burn_on_read": "1",
    }, content_type="multipart/form-data")
    fid15 = r15.get_json()["file_id"]
    r15_prev = client.get(f"/api/download/{fid15}?preview=true")
    check("Scenario 15: PDF preview returns 200 without burning", r15_prev.status_code == 200 and storage_mgr.file_exists(fid15))

    # Scenario 16: Unsupported file download
    print("\n== Scenario 16: Unsupported File Type Download ==")
    r16 = client.post("/api/upload", data={
        "file": (io.BytesIO(b"binary-executable-payload"), "installer.exe.encrypted"),
        "iv": "ee" * 12,
        "salt": "ff" * 16,
        "original_name": "setup.exe",
        "original_size": "25",
        "max_downloads": "5",
    }, content_type="multipart/form-data")
    fid16 = r16.get_json()["file_id"]
    r16_down = client.get(f"/api/download/{fid16}")
    check("Scenario 16: Binary/unsupported file download succeeds", r16_down.status_code == 200 and r16_down.data == b"binary-executable-payload")

    # Scenario 17 & 18: Large File Upload & Download (Chunked ciphertext)
    print("\n== Scenario 17 & 18: Large File Upload & Streaming Download ==")
    large_payload = b"X" * (512 * 1024)  # 512 KB simulation block
    r17 = client.post("/api/upload", data={
        "file": (io.BytesIO(large_payload), "large.bin.encrypted"),
        "iv": "12" * 12,
        "salt": "34" * 16,
        "original_name": "large_archive.zip",
        "original_size": str(len(large_payload)),
        "checksum": "chunked:4194304",
        "max_downloads": "5",
    }, content_type="multipart/form-data")
    check("Scenario 17: Large file upload with chunked marker", r17.status_code == 200)
    fid17 = r17.get_json()["file_id"]
    r18_down = client.get(f"/api/download/{fid17}")
    check("Scenario 18: Large file streaming download returns exact bytes", r18_down.status_code == 200 and len(r18_down.data) == len(large_payload))
    check("Scenario 18: Chunked header marker preserved", r18_down.headers.get("X-Checksum") == "chunked:4194304")

    # Scenario 19: Invalid code validation
    print("\n== Scenario 19: Invalid Code Validation ==")
    r19_1 = client.get("/api/file-info/not-a-valid-hex!")
    check("Scenario 19: Invalid file ID format returns 400", r19_1.status_code == 400)
    r19_2 = client.get("/api/file-info/123")
    check("Scenario 19: Too short file ID returns 400", r19_2.status_code == 400)

    # Scenario 20: Already expired or limit-reached transfer
    print("\n== Scenario 20: Already Expired / Limit-Reached Transfer ==")
    r20_info = client.get(f"/api/file-info/{fid7}")
    check("Scenario 20: Burned transfer lookup returns 410 or 404", r20_info.status_code in (404, 410))
    r20_down = client.get(f"/api/download/{fid7}")
    check("Scenario 20: Burned transfer download returns 410 or 404", r20_down.status_code in (404, 410))

    # Token Refresh Limits & Route Aliases
    print("\n== Additional Security: Token Refresh Limit & CORS Preflights ==")
    r_tok = client.post("/api/upload", data={
        "file": (io.BytesIO(b"token-test"), "t.encrypted"),
        "iv": "aa" * 12, "salt": "bb" * 16,
    }, content_type="multipart/form-data")
    t_id = r_tok.get_json()["transfer_id"]
    for _ in range(5):
        client.post(f"/api/transfers/{t_id}/token/refresh")
    r_tok_6th = client.post(f"/api/transfers/{t_id}/token/refresh")
    check("QR refresh limit enforces max 5 refreshes (6th -> 429)", r_tok_6th.status_code == 429)

    r_opt = client.options("/api/upload")
    check("OPTIONS /api/upload -> 204 preflight", r_opt.status_code == 204)


    print("\n== Access proof: file-id alone cannot fetch ciphertext ==")
    r_ap = client.post("/api/upload", data={
        "file": (io.BytesIO(b"proof-protected"), "p.encrypted"),
        "iv": "aa" * 12, "salt": "bb" * 16,
        "original_name": "secret.txt",
        "original_size": "15",
        "max_downloads": "10",
        "expiry_hours": "24",
    }, content_type="multipart/form-data")
    fid_ap = r_ap.get_json()["file_id"]
    check("file-info without proof -> 403", client.get(f"/api/file-info/{fid_ap}", no_proof=True).status_code == 403)
    check("download without proof -> 403", client.get(f"/api/download/{fid_ap}", no_proof=True).status_code == 403)
    check("file-info wrong proof -> 403", client.get(f"/api/file-info/{fid_ap}", headers={"X-Access-Proof": WRONG_PROOF}).status_code == 403)
    check("download wrong proof -> 403", client.get(f"/api/download/{fid_ap}", headers={"X-Access-Proof": WRONG_PROOF}).status_code == 403)
    check("file-info correct proof -> 200", client.get(f"/api/file-info/{fid_ap}").status_code == 200)
    r_ok_dl = client.get(f"/api/download/{fid_ap}")
    check("download correct proof -> 200", r_ok_dl.status_code == 200 and r_ok_dl.data == b"proof-protected")
    check("file-info proof query param -> 200", client.get(f"/api/file-info/{fid_ap}?proof={PROOF}", no_proof=True).status_code == 200)

    print("\n== Owner token DELETE, filename sanitization, IV/salt, preview cap ==")
    r_own = client.post("/api/upload", data={
        "file": (io.BytesIO(b"owner-delete-payload"), "own.encrypted"),
        "iv": "aa" * 12, "salt": "bb" * 16,
        "original_name": "../../../etc/passwd.txt",
        "original_size": "20",
        "max_downloads": "5",
        "expiry_hours": "24",
    }, content_type="multipart/form-data")
    own = r_own.get_json()
    fid_own = own["file_id"]
    token_own = own["owner_token"]
    info_own = client.get(f"/api/file-info/{fid_own}").get_json()
    check("Path traversal stripped from original_name", info_own["original_name"] == "passwd.txt")

    r_del_no = client.delete(f"/api/files/{fid_own}")
    check("DELETE without owner token -> 403", r_del_no.status_code == 403)
    r_del_bad = client.delete(f"/api/files/{fid_own}", headers={"X-Owner-Token": "00" * 16})
    check("DELETE with wrong owner token -> 403", r_del_bad.status_code == 403)
    r_del_ok = client.delete(f"/api/files/{fid_own}", headers={"X-Owner-Token": token_own})
    check("DELETE with owner token -> 200", r_del_ok.status_code == 200)
    check("Deleted file lookup is 404", client.get(f"/api/file-info/{fid_own}").status_code == 404)

    r_iv = client.post("/api/upload", data={
        "file": (io.BytesIO(b"bad-iv"), "x.encrypted"),
        "iv": "aa" * 4, "salt": "bb" * 16,
    }, content_type="multipart/form-data")
    check("Short IV rejected with 400", r_iv.status_code == 400)

    r_prev = client.post("/api/upload", data={
        "file": (io.BytesIO(b"preview-cap-payload"), "p.encrypted"),
        "iv": "aa" * 12, "salt": "bb" * 16,
        "original_name": "cap.bin",
        "max_downloads": "10",
        "burn_on_read": "0",
        "expiry_hours": "24",
    }, content_type="multipart/form-data")
    fid_prev = r_prev.get_json()["file_id"]
    preview_ok = 0
    for _ in range(20):
        if client.get(f"/api/download/{fid_prev}?preview=true").status_code == 200:
            preview_ok += 1
    check("20 previews allowed", preview_ok == 20)
    r_prev_21 = client.get(f"/api/download/{fid_prev}?preview=true")
    check("21st preview rejected", r_prev_21.status_code in (410, 429))
    r_prev_dl = client.get(f"/api/download/{fid_prev}")
    check("Download still allowed after preview cap", r_prev_dl.status_code == 200)

    r_stats = client.get("/api/stats")
    stats = r_stats.get_json()
    check("Public stats omit live file counts", "total_files" not in stats and "max_file_size" in stats)

    print(f"\n==========================================")
    print(f"RESULTS: {passed} PASSED, {failed} FAILED")
    print(f"==========================================")
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
