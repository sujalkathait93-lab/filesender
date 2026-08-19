"""
FileShare File Routes
REST API endpoints for file upload, download, info, deletion, and stats.
Uses Flask Blueprint for modular registration.

All routes delegate to the service layer and raise ApiError subclasses;
the global error handler in api/index.py converts them to JSON responses.
"""

import urllib.parse

# pyrefly: ignore [missing-import]
from flask import Blueprint, request, jsonify, Response

from api.config import STUN_SERVERS, TURN_SERVERS, DEFAULT_PORT, TRUST_PROXY, is_vercel
from api.utils import get_utc_now_iso, get_local_ips
from api.errors import ApiError, PayloadTooLargeError, ConflictError, ForbiddenError
from api.validation import validate_upload_form, validate_file_id, validate_access_proof
from api.rate_limit import RateLimiter
from api.services.transfer_service import TransferService

file_bp = Blueprint("files", __name__)

# These will be injected by create_app()
_transfer_service: TransferService = None
_rate_limiter: RateLimiter = None


def init_file_routes(transfer_service: TransferService, rate_limiter: RateLimiter):
    """Inject service dependencies into the blueprint (DIP)."""
    global _transfer_service, _rate_limiter
    _transfer_service = transfer_service
    _rate_limiter = rate_limiter


def _client_ip() -> str:
    """Resolve the real client IP. Trust X-Forwarded-For only behind a known proxy."""
    if TRUST_PROXY:
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _request_access_proof() -> str:
    raw = request.headers.get("X-Access-Proof") or request.args.get("proof") or ""
    return validate_access_proof(raw)


@file_bp.route("/", methods=["GET", "POST", "OPTIONS"], strict_slashes=False)
@file_bp.route("/api", methods=["GET", "POST", "OPTIONS"], strict_slashes=False)
@file_bp.route("/api/", methods=["GET", "POST", "OPTIONS"], strict_slashes=False)
@file_bp.route("/api/index.py", methods=["GET", "POST", "OPTIONS"], strict_slashes=False)
@file_bp.route("/index.py", methods=["GET", "POST", "OPTIONS"], strict_slashes=False)
def root():
    if request.method == "OPTIONS":
        return ("", 204)
    if request.method == "POST":
        # Handle rewritten upload calls dispatched to root
        if "file" in request.files:
            return upload_file()
        return jsonify({"detail": "Root endpoint does not accept POST without file payload"}), 400

    return jsonify({
        "service": "FileShare",
        "version": "2.2.0",
        "features": [
            "webrtc-datachannel",
            "flask-websocket-signaling",
            "stun-turn-nat-traversal",
            "multi-file-transfers",
            "1gb-large-file-chunking",
            "chunked-upload-streaming",
            "token-refresh-limits",
            "e2e-encryption",
            "burn-on-read",
            "steganography-vault"
        ],
        "status": "operational"
    })


@file_bp.route("/api/health", methods=["GET", "OPTIONS"], strict_slashes=False)
@file_bp.route("/health", methods=["GET", "OPTIONS"], strict_slashes=False)
def health():
    if request.method == "OPTIONS":
        return ("", 204)
    return jsonify({
        "status": "healthy",
        "timestamp": get_utc_now_iso(),
        "persistent_storage": not is_vercel,
        "storage": "ephemeral" if is_vercel else "local-disk",
    })


@file_bp.route("/api/network-info", methods=["GET", "OPTIONS"], strict_slashes=False)
@file_bp.route("/network-info", methods=["GET", "OPTIONS"], strict_slashes=False)
def network_info():
    """Get network info for LAN/WAN detection and signaling configuration."""
    if request.method == "OPTIONS":
        return ("", 204)
    payload = {
        "local_ips": get_local_ips() if not is_vercel else [],
        "port": DEFAULT_PORT,
        "is_lan_accessible": not is_vercel,
        "stun_servers": STUN_SERVERS,
        "timestamp": get_utc_now_iso()
    }
    if not is_vercel:
        payload["turn_servers"] = TURN_SERVERS
    return jsonify(payload)


@file_bp.route("/api/upload", methods=["POST", "OPTIONS"], strict_slashes=False)
@file_bp.route("/upload", methods=["POST", "OPTIONS"], strict_slashes=False)
def upload_file():
    """Upload encrypted file blob in a single request."""
    if request.method == "OPTIONS":
        return ("", 204)

    _rate_limiter.check("upload", _client_ip())

    if 'file' not in request.files:
        raise ApiError("No file part in request", 400)

    file_obj = request.files['file']
    if not file_obj or not file_obj.filename:
        raise ApiError("No file selected or empty file uploaded", 400)

    form = validate_upload_form(dict(request.form))

    try:
        result = _transfer_service.upload_file(file_obj, form)
    except ValueError as e:
        raise PayloadTooLargeError(str(e)) if ("1 GB" in str(e) or "2 GB" in str(e)) else ApiError(str(e))

    return jsonify(result)


@file_bp.route("/api/upload/init", methods=["POST", "OPTIONS"], strict_slashes=False)
@file_bp.route("/upload/init", methods=["POST", "OPTIONS"], strict_slashes=False)
def upload_init():
    """Initialize a chunked upload session for large files."""
    if request.method == "OPTIONS":
        return ("", 204)

    _rate_limiter.check("upload", _client_ip())

    data = request.get_json(silent=True) or dict(request.form)
    form = validate_upload_form(data)
    filename = (data.get("filename") or data.get("original_name") or "file.encrypted")[:255]
    content_type = (data.get("content_type") or "application/octet-stream")[:128]

    result = _transfer_service.init_chunked_upload(form, filename, content_type)
    return jsonify(result)


@file_bp.route("/api/upload/chunk", methods=["POST", "OPTIONS"], strict_slashes=False)
@file_bp.route("/upload/chunk", methods=["POST", "OPTIONS"], strict_slashes=False)
def upload_chunk():
    """Upload an individual chunk (< 4 MB) for memory-safe and proxy-safe streaming."""
    if request.method == "OPTIONS":
        return ("", 204)

    _rate_limiter.check("upload", _client_ip())

    if 'chunk' not in request.files:
        raise ApiError("No chunk file in request", 400)

    chunk_file = request.files['chunk']
    transfer_id = validate_file_id(request.form.get("transfer_id", ""))
    file_id = validate_file_id(request.form.get("file_id", ""))
    try:
        chunk_index = int(request.form.get("chunk_index", 0))
        total_chunks = int(request.form.get("total_chunks", 1))
    except (ValueError, TypeError):
        raise ApiError("Invalid chunk index or total chunks", 400)

    checksum = (request.form.get("checksum") or "").strip()[:64]
    result = _transfer_service.save_chunk(transfer_id, file_id, chunk_index, total_chunks, chunk_file, checksum)
    return jsonify(result)


@file_bp.route("/api/upload/complete", methods=["POST", "OPTIONS"], strict_slashes=False)
@file_bp.route("/upload/complete", methods=["POST", "OPTIONS"], strict_slashes=False)
def upload_complete():
    """Assemble and finalize chunked upload."""
    if request.method == "OPTIONS":
        return ("", 204)

    _rate_limiter.check("upload", _client_ip())

    data = request.get_json(silent=True) or dict(request.form)
    transfer_id = validate_file_id(data.get("transfer_id", ""))
    file_id = validate_file_id(data.get("file_id", ""))
    try:
        total_chunks = int(data.get("total_chunks", 1))
    except (ValueError, TypeError):
        raise ApiError("Invalid total chunks", 400)

    owner_token = (data.get("owner_token") or "").strip()
    try:
        result = _transfer_service.complete_chunked_upload(transfer_id, file_id, total_chunks, owner_token)
    except ValueError as e:
        raise PayloadTooLargeError(str(e)) if ("1 GB" in str(e) or "2 GB" in str(e)) else ApiError(str(e))

    return jsonify(result)


@file_bp.route("/api/transfers/<transfer_id>/token/refresh", methods=["POST", "OPTIONS"], strict_slashes=False)
@file_bp.route("/transfers/<transfer_id>/token/refresh", methods=["POST", "OPTIONS"], strict_slashes=False)
def refresh_token(transfer_id):
    """Refresh transfer token / QR code. Enforces max refreshes per session."""
    if request.method == "OPTIONS":
        return ("", 204)

    _rate_limiter.check("refresh", _client_ip())
    try:
        result = _transfer_service.refresh_token(transfer_id)
        return jsonify(result)
    except ConflictError as e:
        # Limit reached: keep the exact response shape the frontend expects
        parts = str(e.detail).split("|")
        current_refresh = int(parts[1]) if len(parts) > 1 else 0
        max_ref = int(parts[2]) if len(parts) > 2 else 0
        return jsonify({
            "detail": "QR refresh limit reached. Generate a new transfer.",
            "transfer_id": transfer_id,
            "refresh_count": current_refresh,
            "max_refreshes": max_ref,
            "limit_reached": True
        }), 429


@file_bp.route("/api/file-info/<file_id>", methods=["GET", "OPTIONS"], strict_slashes=False)
@file_bp.route("/file-info/<file_id>", methods=["GET", "OPTIONS"], strict_slashes=False)
@file_bp.route("/api/files/<file_id>", methods=["GET", "OPTIONS"], strict_slashes=False)
@file_bp.route("/files/<file_id>", methods=["GET", "OPTIONS"], strict_slashes=False)
def get_file_info(file_id):
    """Get metadata for an encrypted file."""
    if request.method == "OPTIONS":
        return ("", 204)

    _rate_limiter.check("info", _client_ip())
    file_id = validate_file_id(file_id)
    proof = _request_access_proof()
    return jsonify(_transfer_service.get_file_info(file_id, proof))


@file_bp.route("/api/download/<file_id>", methods=["GET", "OPTIONS"], strict_slashes=False)
@file_bp.route("/download/<file_id>", methods=["GET", "OPTIONS"], strict_slashes=False)
def download_file(file_id):
    """Download encrypted file blob."""
    if request.method == "OPTIONS":
        return ("", 204)

    _rate_limiter.check("download", _client_ip())
    file_id = validate_file_id(file_id)
    proof = _request_access_proof()
    is_preview = (request.args.get("preview") or "").strip().lower() in ("1", "true", "yes")

    row, file_path, is_burn = _transfer_service.download_file(file_id, preview=is_preview, proof=proof)

    def generate_stream():
        bytes_sent = 0
        expected_size = row["encrypted_size"]
        try:
            with open(file_path, "rb") as f:
                while chunk := f.read(65536):
                    bytes_sent += len(chunk)
                    yield chunk
        finally:
            if not is_preview and bytes_sent >= expected_size:
                _transfer_service.record_successful_download(file_id)

    response = Response(generate_stream(), mimetype="application/octet-stream")
    clean_name = row["filename"].replace('"', '\\"').replace('\r', '').replace('\n', '')
    quoted_name = urllib.parse.quote(row["filename"], safe='')
    response.headers["Content-Disposition"] = f'attachment; filename="{clean_name}"; filename*=UTF-8\'\'{quoted_name}'
    response.headers["Content-Length"] = str(row["encrypted_size"])
    response.headers["X-File-ID"] = row["id"]
    response.headers["X-Original-Name"] = urllib.parse.quote(row["original_name"], safe='')
    response.headers["X-Burn-On-Read"] = "1" if (bool(row["burn_on_read"]) and is_burn) else "0"
    response.headers["X-IV"] = row["iv"]
    response.headers["X-Salt"] = row["salt"]
    response.headers["X-Compressed"] = str(row["compressed"])
    if row.get("checksum"):
        response.headers["X-Checksum"] = row["checksum"]
    return response


@file_bp.route("/api/files/<file_id>", methods=["DELETE", "OPTIONS"], strict_slashes=False)
@file_bp.route("/files/<file_id>", methods=["DELETE", "OPTIONS"], strict_slashes=False)
def delete_file(file_id):
    """Delete a transfer file (requires owner token)."""
    if request.method == "OPTIONS":
        return ("", 204)

    file_id = validate_file_id(file_id)
    owner_token = (request.headers.get("X-Owner-Token") or request.args.get("token") or "").strip()
    _transfer_service.delete_file(file_id, owner_token)
    return jsonify({"message": "File deleted successfully"})


@file_bp.route("/api/stats", methods=["GET", "OPTIONS"], strict_slashes=False)
@file_bp.route("/stats", methods=["GET", "OPTIONS"], strict_slashes=False)
def get_stats():
    """Public limits only — no internal data exposed."""
    if request.method == "OPTIONS":
        return ("", 204)
    return jsonify(_transfer_service.get_stats())
