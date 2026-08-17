"""
FileShare Configuration
Centralizes all configuration constants, environment detection, and path resolution.
Loads environment variables from .env files automatically when available.
"""

import json
import logging
import os
import secrets

# Load environment variables from .env if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ─── Environment Detection ──────────────────────────────────────────────────
ENVIRONMENT = os.environ.get("ENVIRONMENT", os.environ.get("FLASK_ENV", "development")).lower()
IS_PRODUCTION = ENVIRONMENT == "production"
IS_VERCEL = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV") is not None
is_vercel = IS_VERCEL  # Backward compatibility alias

# ─── Logging ────────────────────────────────────────────────────────────────
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("fileshare")

# ─── Path Defaults Based on Environment ──────────────────────────────────────
default_db = "/tmp/app.db" if IS_VERCEL else "database/app.db"
default_upload = "/tmp/uploads" if IS_VERCEL else "uploads"

DB_PATH = os.environ.get("DB_PATH", default_db)
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", default_upload)

# ─── Security / Secrets ─────────────────────────────────────────────────────
_env_secret = os.environ.get("SECRET_KEY")
if _env_secret:
    SECRET_KEY = _env_secret
else:
    SECRET_KEY = secrets.token_hex(32)
    if IS_PRODUCTION and not IS_VERCEL:
        logger.warning(
            "SECRET_KEY is not set in production — using an auto-generated ephemeral key. "
            "Please configure SECRET_KEY in your environment or .env file for session stability."
        )
    elif IS_VERCEL:
        logger.warning(
            "SECRET_KEY is not set — using an auto-generated ephemeral key. "
            "Set SECRET_KEY in Vercel Environment Variables for stable sessions."
        )

# ─── CORS and Proxy Settings ────────────────────────────────────────────────
_raw_origins = os.environ.get("FRONTEND_ORIGIN", "*").strip()
if _raw_origins == "*":
    FRONTEND_ORIGIN = "*"
    CORS_ORIGINS = "*"
elif "," in _raw_origins:
    FRONTEND_ORIGIN = _raw_origins
    CORS_ORIGINS = [origin.strip() for origin in _raw_origins.split(",") if origin.strip()]
else:
    FRONTEND_ORIGIN = _raw_origins
    CORS_ORIGINS = [_raw_origins]

_trust_proxy_env = os.environ.get("TRUST_PROXY", "").strip().lower()
TRUST_PROXY = _trust_proxy_env in ("1", "true", "yes", "t") or IS_VERCEL

# ─── Transfer Limits ────────────────────────────────────────────────────────
def _get_int_env(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default

MAX_FILE_SIZE = _get_int_env("MAX_FILE_SIZE", 2 * 1024 * 1024 * 1024)  # 2 GB Max Total Size
MAX_REFRESHES_PER_SESSION = _get_int_env("MAX_REFRESHES_PER_SESSION", 5)
MAX_PREVIEWS_PER_FILE = _get_int_env("MAX_PREVIEWS_PER_FILE", 100)

# ─── Background Cleanup & Storage Management ────────────────────────────────
CLEANUP_INTERVAL_SECONDS = _get_int_env("CLEANUP_INTERVAL_SECONDS", 300)  # 5 min
ORPHAN_GRACE_PERIOD_SECONDS = _get_int_env("ORPHAN_GRACE_PERIOD_SECONDS", 300)  # 5 min

# ─── Request Rate Limiting (Sliding Window, per Client IP) ─────────────────
RATE_LIMITS = {
    "upload": (_get_int_env("RATE_LIMIT_UPLOAD_MAX", 30), _get_int_env("RATE_LIMIT_UPLOAD_WINDOW", 60)),
    "refresh": (_get_int_env("RATE_LIMIT_REFRESH_MAX", 20), _get_int_env("RATE_LIMIT_REFRESH_WINDOW", 60)),
    "file_info": (_get_int_env("RATE_LIMIT_FILE_INFO_MAX", 180), _get_int_env("RATE_LIMIT_FILE_INFO_WINDOW", 60)),
    "download": (_get_int_env("RATE_LIMIT_DOWNLOAD_MAX", 120), _get_int_env("RATE_LIMIT_DOWNLOAD_WINDOW", 60)),
    "preview": (_get_int_env("RATE_LIMIT_PREVIEW_MAX", 40), _get_int_env("RATE_LIMIT_PREVIEW_WINDOW", 60)),
    "delete": (_get_int_env("RATE_LIMIT_DELETE_MAX", 30), _get_int_env("RATE_LIMIT_DELETE_WINDOW", 60)),
}

# ─── Server Host and Port ───────────────────────────────────────────────────
DEFAULT_PORT = _get_int_env("PORT", 8000)
HOST = os.environ.get("HOST", "0.0.0.0")

# ─── CORS Exposed Headers ───────────────────────────────────────────────────
CORS_EXPOSE_HEADERS = [
    "Content-Length",
    "Content-Disposition",
    "Retry-After",
    "X-Original-Name",
    "X-Compressed",
    "X-Burn-On-Read",
    "X-IV",
    "X-Salt",
    "X-Checksum",
    "X-Refresh-Count",
    "X-Max-Refreshes",
]

# ─── Network — STUN/TURN Servers ────────────────────────────────────────────
_DEFAULT_STUN_SERVERS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun2.l.google.com:19302",
    "stun:global.stun.twilio.com:3478",
]

_env_stun = os.environ.get("STUN_SERVERS")
if _env_stun:
    try:
        parsed = json.loads(_env_stun)
        STUN_SERVERS = parsed if isinstance(parsed, list) else [str(parsed)]
    except json.JSONDecodeError:
        STUN_SERVERS = [s.strip() for s in _env_stun.split(",") if s.strip()]
else:
    STUN_SERVERS = _DEFAULT_STUN_SERVERS

_DEFAULT_TURN_SERVERS = [
    {
        "urls": "turn:openrelay.metered.ca:80",
        "username": "openrelayproject",
        "credential": "openrelayproject",
    },
    {
        "urls": "turn:openrelay.metered.ca:443",
        "username": "openrelayproject",
        "credential": "openrelayproject",
    },
]

_env_turn = os.environ.get("TURN_SERVERS")
if _env_turn:
    try:
        parsed = json.loads(_env_turn)
        TURN_SERVERS = parsed if isinstance(parsed, list) else _DEFAULT_TURN_SERVERS
    except json.JSONDecodeError:
        TURN_SERVERS = _DEFAULT_TURN_SERVERS
elif os.environ.get("TURN_URL"):
    TURN_SERVERS = [
        {
            "urls": os.environ["TURN_URL"],
            "username": os.environ.get("TURN_USERNAME", ""),
            "credential": os.environ.get("TURN_CREDENTIAL", ""),
        }
    ]
else:
    TURN_SERVERS = _DEFAULT_TURN_SERVERS
