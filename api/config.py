"""
FileShare Configuration
Centralizes all configuration constants, environment detection, and path resolution.
"""

import os
import secrets

# Environment detection
is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV") is not None

# Path defaults based on environment
default_db = "/tmp/app.db" if is_vercel else "database/app.db"
default_upload = "/tmp/uploads" if is_vercel else "uploads"

# Core configuration
DB_PATH = os.environ.get("DB_PATH", default_db)
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", default_upload)

_env_secret = os.environ.get("SECRET_KEY")
if _env_secret:
    SECRET_KEY = _env_secret
elif is_vercel:
    # Production should set SECRET_KEY. Ephemeral fallback avoids a hard crash
    # if the env var is missing on a serverless instance.
    SECRET_KEY = secrets.token_hex(32)
else:
    SECRET_KEY = secrets.token_hex(32)

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "*")
TRUST_PROXY = os.environ.get("TRUST_PROXY", "0") == "1" or is_vercel

# Transfer limits
MAX_FILE_SIZE = int(os.environ.get("MAX_FILE_SIZE", 2 * 1024 * 1024 * 1024))  # 2GB Max Total Size
MAX_REFRESHES_PER_SESSION = 5
MAX_PREVIEWS_PER_FILE = int(os.environ.get("MAX_PREVIEWS_PER_FILE", 20))

# Background cleanup
CLEANUP_INTERVAL_SECONDS = int(os.environ.get("CLEANUP_INTERVAL_SECONDS", 300))  # 5 min

# Request rate limiting (sliding window, per client IP)
RATE_LIMITS = {
    "upload": (30, 60),       # max 30 uploads per minute
    "refresh": (20, 60),      # max 20 token refreshes per minute
    "file_info": (180, 60),   # max 180 metadata lookups per minute
    "download": (120, 60),    # max 120 downloads per minute
    "preview": (40, 60),      # tighter cap for full-blob preview fetches
    "delete": (30, 60),
}

# Server
DEFAULT_PORT = int(os.environ.get("PORT", 8000))

# CORS exposed headers
CORS_EXPOSE_HEADERS = [
    "Content-Disposition",
    "X-Original-Name",
    "X-Compressed",
    "X-Burn-On-Read",
    "X-IV",
    "X-Salt",
    "X-Checksum",
    "X-Refresh-Count",
    "X-Max-Refreshes"
]

# Network — STUN/TURN servers (single source of truth)
STUN_SERVERS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun2.l.google.com:19302",
    "stun:global.stun.twilio.com:3478"
]

TURN_SERVERS = [
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
]
