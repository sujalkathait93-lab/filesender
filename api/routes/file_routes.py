"""
SecureShare File Routes
REST API endpoints for file upload, download, info, deletion, and stats.
Uses Flask Blueprint for modular registration.

All routes delegate to the service layer and raise ApiError subclasses;
the global error handler in api/index.py converts them to JSON responses.
"""

import urllib.parse

# pyrefly: ignore [missing-import]
from flask import Blueprint, request, jsonify, Response

from api.config import STUN_SERVERS, TURN_SERVERS, DEFAULT_PORT
from api.utils import get_utc_now_iso, get_local_ips
from api.errors import ApiError, PayloadTooLargeError, ConflictError
from api.validation import validate_upload_form, validate_file_id
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
    """Resolve the real client IP behind a reverse proxy."""
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


@file_bp.route("/", methods=["GET"])
def root():
    return jsonify({
        "service": "FileShare",
        "version": "2.2.0",
        "features": [
            "webrtc-datachannel",
            "flask-websocket-signaling",
            "stun-turn-nat-traversal",
            "multi-file-transfers",
            "2gb-large-file-chunking",
            "token-refresh-limits",
            "e2e-encryption",
            "burn-on-read",
            "steganography-vault"
        ],
        "status": "operational"
    })


@file_bp.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "timestamp": get_utc_now_iso()})


@file_bp.route("/api/network-info", methods=["GET"])
def network_info():
    """Get network info for LAN/WAN detection and signaling configuration."""
    return jsonify({
        "local_ips": get_local_ips(),
        "port": DEFAULT_PORT,
        "is_lan_accessible": True,
        "stun_servers": STUN_SERVERS,
        "turn_servers": TURN_SERVERS,
        "timestamp": get_utc_now_iso()
    })


@file_bp.route("/api/upload", methods=["POST"])
def upload_file():
    """Upload encrypted file blob with max 2 GB total size validation."""
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
        raise PayloadTooLargeError(str(e)) if "2 GB" in str(e) else ApiError(str(e))

    return jsonify(result)


@file_bp.route("/api/transfers/<transfer_id>/token/refresh", methods=["POST"])
def refresh_token(transfer_id):
    """Refresh transfer token / QR code. Enforces max refreshes per session."""
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
            "refresh_count": current_refresh,
            "max_refreshes": max_ref,
            "limit_reached": True
        }), 429


@file_bp.route("/api/file-info/<file_id>", methods=["GET"])
def get_file_info(file_id):
    """Get file metadata (no encrypted blob)."""
    _rate_limiter.check("file_info", _client_ip())
    file_id = validate_file_id(file_id)
    return jsonify(_transfer_service.get_file_info(file_id))


@file_bp.route("/api/download/<file_id>", methods=["GET"])
def download_file(file_id):
    """Download or preview encrypted file blob."""
    _rate_limiter.check("download", _client_ip())
    file_id = validate_file_id(file_id)
    preview = request.args.get("preview", "false").lower() == "true"

    row_dict, file_path, is_burn = _transfer_service.download_file(file_id, preview)

    def generate():
        try:
            with open(file_path, "rb") as f:
                while chunk := f.read(131072):
                    yield chunk
        finally:
            if is_burn:
                _transfer_service.purge_file(file_id)

    safe_orig_name = urllib.parse.quote(row_dict["original_name"])
    safe_filename = urllib.parse.quote(row_dict["filename"])

    response = Response(generate(), mimetype="application/octet-stream")
    response.headers["Content-Length"] = str(row_dict["encrypted_size"])
    response.headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{safe_filename}"
    response.headers["X-Original-Name"] = safe_orig_name
    response.headers["X-Compressed"] = str(row_dict["compressed"])
    response.headers["X-Burn-On-Read"] = "1" if is_burn else "0"
    response.headers["X-IV"] = row_dict["iv"]
    response.headers["X-Salt"] = row_dict["salt"]
    if row_dict["checksum"]:
        response.headers["X-Checksum"] = row_dict["checksum"]

    return response


@file_bp.route("/api/files/<file_id>", methods=["DELETE"])
def delete_file(file_id):
    """Delete file immediately."""
    file_id = validate_file_id(file_id)
    _transfer_service.delete_file(file_id)
    return jsonify({"message": "File deleted"})


@file_bp.route("/api/stats", methods=["GET"])
def get_stats():
    """Get server stats."""
    return jsonify(_transfer_service.get_stats())
