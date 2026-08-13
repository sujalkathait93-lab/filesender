"""
SecureShare - End-to-End Encrypted File Sharing API & WebRTC Signaling Server
Supports WebRTC DataChannel (LAN & WAN) + Flask/WebSocket signaling + STUN/TURN
Client-side encryption + compression + zero-knowledge storage vault
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from flask_socketio import SocketIO, join_room, leave_room, emit
import sqlite3
import os
import uuid
from datetime import datetime, timedelta, timezone
import socket
import hashlib
import urllib.parse
import threading

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'secureshare_secret_key_2026')

# CORS - allow all origins for LAN/WAN flexibility with exposed custom headers
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    supports_credentials=True,
    expose_headers=[
        "Content-Disposition",
        "X-Original-Name",
        "X-Compressed",
        "X-Burn-On-Read",
        "X-IV",
        "X-Salt"
    ]
)

# SocketIO setup with CORS support
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    logger=False,
    engineio_logger=False
)

# Configuration
is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV") is not None
default_db = "/tmp/app.db" if is_vercel else "database/app.db"
default_upload = "/tmp/uploads" if is_vercel else "uploads"

DB_PATH = os.environ.get("DB_PATH", default_db)
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", default_upload)
MAX_FILE_SIZE = int(os.environ.get("MAX_FILE_SIZE", 2 * 1024 * 1024 * 1024))  # 2GB
FILE_EXPIRY_HOURS = 24

# Ensure directories exist
if os.path.dirname(DB_PATH):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
if UPLOAD_DIR:
    os.makedirs(UPLOAD_DIR, exist_ok=True)

# Datetime helpers
def get_utc_now():
    return datetime.now(timezone.utc)

def get_utc_now_iso():
    return get_utc_now().isoformat()

# Object-Oriented Database Manager
class DatabaseManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        self.init_database()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_database(self):
        conn = self.get_connection()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
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
                burn_on_read INTEGER DEFAULT 0
            )
        """)
        try:
            conn.execute("ALTER TABLE files ADD COLUMN burn_on_read INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass

        conn.execute("""
            CREATE TABLE IF NOT EXISTS transfers (
                id TEXT PRIMARY KEY,
                file_id TEXT,
                sender_ip TEXT,
                receiver_ip TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (file_id) REFERENCES files(id)
            )
        """)
        conn.commit()
        conn.close()

# Object-Oriented File Storage Manager
class StorageManager:
    def __init__(self, upload_dir: str):
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    def get_file_path(self, file_id: str) -> str:
        return os.path.join(self.upload_dir, file_id)

    def delete_file(self, file_id: str):
        path = self.get_file_path(file_id)
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass

    def purge_completely(self, file_id: str):
        """Zero-Knowledge Complete Data Purging: deletes physical blob and database entry"""
        self.delete_file(file_id)
        conn = db_manager.get_connection()
        try:
            conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
            conn.commit()
        except Exception as e:
            print(f"Purge DB error for {file_id}: {e}")
        finally:
            conn.close()

db_manager = DatabaseManager(DB_PATH)
storage_manager = StorageManager(UPLOAD_DIR)

def cleanup_expired_files():
    """Periodic background cleanup task: purges expired files and orphaned disk blobs"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.execute(
            "SELECT id FROM files WHERE expires_at < ?",
            (get_utc_now_iso(),)
        )
        expired = cursor.fetchall()
        expired_ids = {row["id"] for row in expired}

        for file_id in expired_ids:
            storage_manager.delete_file(file_id)
            conn.execute("DELETE FROM files WHERE id = ?", (file_id,))

        conn.commit()

        # Get active file IDs
        active_cursor = conn.execute("SELECT id FROM files")
        active_ids = {row["id"] for row in active_cursor.fetchall()}
        conn.close()

        # Scan uploads directory for orphan files on disk and purge them
        if os.path.exists(UPLOAD_DIR):
            for filename in os.listdir(UPLOAD_DIR):
                if filename not in active_ids:
                    file_path = os.path.join(UPLOAD_DIR, filename)
                    try:
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                    except OSError:
                        pass
    except Exception as e:
        print(f"Cleanup background task error: {e}")

def trigger_background_cleanup():
    thread = threading.Thread(target=cleanup_expired_files)
    thread.daemon = True
    thread.start()

def generate_id():
    return hashlib.sha256(uuid.uuid4().bytes).hexdigest()[:8]

def safe_int(value, default, min_val=None, max_val=None):
    """Parse an integer safely, falling back to a default and clamping to bounds."""
    try:
        result = int(value)
    except (TypeError, ValueError):
        result = default
    if min_val is not None:
        result = max(result, min_val)
    if max_val is not None:
        result = min(result, max_val)
    return result

def safe_float(value, default, min_val=None, max_val=None):
    """Parse a float safely, falling back to a default and clamping to bounds."""
    try:
        result = float(value)
    except (TypeError, ValueError):
        result = default
    if min_val is not None:
        result = max(result, min_val)
    if max_val is not None:
        result = min(result, max_val)
    return result

def get_local_ips():
    ips = []
    try:
        hostname = socket.gethostname()
        ips.append(socket.gethostbyname(hostname))
    except:
        pass

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.append(s.getsockname()[0])
        s.close()
    except:
        pass

    return list(set(ips))

# ----------------------------------------------------
# REST API Endpoints
# ----------------------------------------------------

@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "service": "SecureShare",
        "version": "2.0.0",
        "features": [
            "webrtc-datachannel",
            "flask-websocket-signaling",
            "stun-turn-nat-traversal",
            "auto-lan-wan-selection",
            "e2e-encryption",
            "chunking",
            "resume",
            "progress-speed-eta"
        ],
        "status": "operational"
    })

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "timestamp": get_utc_now_iso()})

@app.route("/api/network-info", methods=["GET"])
def network_info():
    """Get network info for LAN/WAN detection and signaling configuration"""
    return jsonify({
        "local_ips": get_local_ips(),
        "port": int(os.environ.get("PORT", 8000)),
        "is_lan_accessible": True,
        "stun_servers": [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
            "stun:global.stun.twilio.com:3478"
        ],
        "turn_servers": [
            {
                "urls": "turn:openrelay.metered.ca:80",
                "username": "openrelayproject",
                "credential": "openrelayproject"
            },
            {
                "urls": "turn:openrelay.metered.ca:443",
                "username": "openrelayproject",
                "credential": "openrelayproject"
            }
        ],
        "timestamp": get_utc_now_iso()
    })

@app.route("/api/upload", methods=["POST"])
def upload_file():
    """Upload encrypted file blob. Encryption happens client-side."""
    if 'file' not in request.files:
        return jsonify({"detail": "No file part in request"}), 400

    file_obj = request.files['file']
    iv = request.form.get("iv", "")
    salt = request.form.get("salt", "")
    original_name = request.form.get("original_name", "") or file_obj.filename
    original_size = safe_int(request.form.get("original_size"), 0, min_val=0)
    compressed = safe_int(request.form.get("compressed"), 1, min_val=0, max_val=1)
    max_downloads = safe_int(request.form.get("max_downloads"), 10, min_val=1, max_val=100)
    burn_on_read = safe_int(request.form.get("burn_on_read"), 0, min_val=0, max_val=1)
    expiry_hours = safe_float(request.form.get("expiry_hours"), 4.0, min_val=0.25, max_val=720)

    if not iv or not salt:
        return jsonify({"detail": "IV and salt required for encrypted upload"}), 400

    file_id = generate_id()
    file_path = os.path.join(UPLOAD_DIR, file_id)

    encrypted_size = 0
    with open(file_path, "wb") as f:
        while chunk := file_obj.read(8192):
            encrypted_size += len(chunk)
            if encrypted_size > MAX_FILE_SIZE:
                os.remove(file_path)
                return jsonify({"detail": "File too large (max 2GB)"}), 413
            f.write(chunk)

    expires_at = get_utc_now() + timedelta(hours=expiry_hours)
    effective_max_downloads = 1 if burn_on_read == 1 else max_downloads

    conn = db_manager.get_connection()
    conn.execute("""
        INSERT INTO files (id, filename, original_name, original_size, encrypted_size, 
                          mime_type, expires_at, max_downloads, iv, salt, compressed, checksum, burn_on_read)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        file_id, file_obj.filename, original_name, original_size, encrypted_size,
        file_obj.content_type or "application/octet-stream", expires_at.isoformat(),
        effective_max_downloads, iv, salt, compressed, "", burn_on_read
    ))
    conn.commit()
    conn.close()

    trigger_background_cleanup()

    return jsonify({
        "file_id": file_id,
        "share_url": f"/download/{file_id}",
        "expires_at": expires_at.isoformat(),
        "qr_data": file_id
    })

@app.route("/api/file-info/<file_id>", methods=["GET"])
def get_file_info(file_id):
    """Get file metadata (no encrypted blob)"""
    conn = db_manager.get_connection()
    row = conn.execute(
        "SELECT * FROM files WHERE id = ? AND expires_at > ?",
        (file_id, get_utc_now_iso())
    ).fetchone()
    conn.close()

    if not row:
        return jsonify({"detail": "File not found or expired"}), 404

    if row["download_count"] >= row["max_downloads"]:
        return jsonify({"detail": "File has been burned/deleted after reading"}), 410

    return jsonify({
        "id": row["id"],
        "original_name": row["original_name"],
        "original_size": row["original_size"],
        "encrypted_size": row["encrypted_size"],
        "mime_type": row["mime_type"],
        "created_at": row["created_at"],
        "expires_at": row["expires_at"],
        "download_count": row["download_count"],
        "max_downloads": row["max_downloads"],
        "compressed": bool(row["compressed"]),
        "burn_on_read": bool(row["burn_on_read"] if "burn_on_read" in row.keys() else 0),
        "iv": row["iv"],
        "salt": row["salt"]
    })

@app.route("/api/download/<file_id>", methods=["GET"])
def download_file(file_id):
    """Download or preview encrypted file blob"""
    preview = request.args.get("preview", "false").lower() == "true"

    conn = db_manager.get_connection()
    row = conn.execute(
        "SELECT * FROM files WHERE id = ? AND expires_at > ?",
        (file_id, get_utc_now_iso())
    ).fetchone()

    if not row:
        conn.close()
        return jsonify({"detail": "File not found or expired"}), 404

    if row["download_count"] >= row["max_downloads"]:
        conn.close()
        return jsonify({"detail": "File has been burned/deleted after reading"}), 410

    if not preview:
        new_count = row["download_count"] + 1
        conn.execute(
            "UPDATE files SET download_count = ? WHERE id = ?",
            (new_count, file_id)
        )
        conn.commit()
    else:
        new_count = row["download_count"]

    conn.close()

    file_path = storage_manager.get_file_path(file_id)
    if not os.path.exists(file_path):
        return jsonify({"detail": "File data missing"}), 404

    is_burn = (not preview) and (bool(row["burn_on_read"] if "burn_on_read" in row.keys() else 0) or (new_count >= row["max_downloads"]))

    def generate():
        try:
            with open(file_path, "rb") as f:
                while chunk := f.read(8192):
                    yield chunk
        finally:
            if is_burn:
                storage_manager.purge_completely(file_id)

    safe_orig_name = urllib.parse.quote(row["original_name"])
    safe_filename = urllib.parse.quote(row["filename"])

    response = Response(generate(), mimetype="application/octet-stream")
    response.headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{safe_filename}"
    response.headers["X-Original-Name"] = safe_orig_name
    response.headers["X-Compressed"] = str(row["compressed"])
    response.headers["X-Burn-On-Read"] = "1" if is_burn else "0"
    response.headers["X-IV"] = row["iv"]
    response.headers["X-Salt"] = row["salt"]

    return response

@app.route("/api/files/<file_id>", methods=["DELETE"])
def delete_file(file_id):
    """Delete file immediately"""
    conn = db_manager.get_connection()
    conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
    conn.commit()
    conn.close()

    storage_manager.delete_file(file_id)
    return jsonify({"message": "File deleted"})

@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Get server stats"""
    conn = db_manager.get_connection()
    total = conn.execute("SELECT COUNT(*) as count FROM files").fetchone()["count"]
    active = conn.execute(
        "SELECT COUNT(*) as count FROM files WHERE expires_at > ?",
        (get_utc_now_iso(),)
    ).fetchone()["count"]
    conn.close()

    return jsonify({
        "total_files": total,
        "active_files": active,
        "max_file_size": MAX_FILE_SIZE,
        "file_expiry_hours": FILE_EXPIRY_HOURS,
        "server_time": get_utc_now_iso()
    })

# ----------------------------------------------------
# WebRTC Signaling Server Handlers (Flask-SocketIO)
# ----------------------------------------------------

# Store active rooms metadata
active_rooms = {}

@socketio.on("connect")
def handle_connect():
    pass

@socketio.on("join_room")
def handle_join_room(data):
    room = data.get("room")
    role = data.get("role", "peer") # 'sender' or 'receiver'
    if not room:
        return

    join_room(room)
    if room not in active_rooms:
        active_rooms[room] = {"members": [], "meta": None}
    
    if request.sid not in active_rooms[room]["members"]:
        active_rooms[room]["members"].append(request.sid)

    member_count = len(active_rooms[room]["members"])

    # Notify sender & receiver about peer joining room
    emit("room_joined", {
        "room": room,
        "role": role,
        "peer_count": member_count,
        "meta": active_rooms[room]["meta"]
    }, to=room)

@socketio.on("webrtc_offer")
def handle_offer(data):
    room = data.get("room")
    offer = data.get("offer")
    if room and offer:
        emit("webrtc_offer", {
            "offer": offer,
            "sender_sid": request.sid
        }, to=room, include_self=False)

@socketio.on("webrtc_answer")
def handle_answer(data):
    room = data.get("room")
    answer = data.get("answer")
    if room and answer:
        emit("webrtc_answer", {
            "answer": answer,
            "sender_sid": request.sid
        }, to=room, include_self=False)

@socketio.on("ice_candidate")
def handle_ice_candidate(data):
    room = data.get("room")
    candidate = data.get("candidate")
    if room and candidate:
        emit("ice_candidate", {
            "candidate": candidate,
            "sender_sid": request.sid
        }, to=room, include_self=False)

@socketio.on("transfer_meta")
def handle_transfer_meta(data):
    room = data.get("room")
    meta = data.get("meta")
    if room and meta:
        if room in active_rooms:
            active_rooms[room]["meta"] = meta
        emit("transfer_meta", {
            "meta": meta
        }, to=room, include_self=False)

@socketio.on("request_resume")
def handle_request_resume(data):
    room = data.get("room")
    last_chunk_index = data.get("last_chunk_index", -1)
    if room:
        emit("request_resume", {
            "last_chunk_index": last_chunk_index
        }, to=room, include_self=False)

@socketio.on("transfer_status")
def handle_transfer_status(data):
    room = data.get("room")
    status = data.get("status")
    if room and status:
        emit("transfer_status", status, to=room, include_self=False)

@socketio.on("leave_room")
def handle_leave_room(data):
    room = data.get("room")
    if room:
        leave_room(room)
        if room in active_rooms and request.sid in active_rooms[room]["members"]:
            active_rooms[room]["members"].remove(request.sid)
            if not active_rooms[room]["members"]:
                del active_rooms[room]

@socketio.on("disconnect")
def handle_disconnect():
    for room, room_data in list(active_rooms.items()):
        if request.sid in room_data["members"]:
            room_data["members"].remove(request.sid)
            emit("peer_disconnected", {"sid": request.sid}, to=room)
            if not room_data["members"]:
                del active_rooms[room]

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting SecureShare Flask + SocketIO Signaling Server on port {port}...")
    socketio.run(app, host="0.0.0.0", port=port, debug=False)
