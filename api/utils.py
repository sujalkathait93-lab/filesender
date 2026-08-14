"""
SecureShare Utilities
Generic helper functions: ID generation, safe type coercion, datetime, network.
"""

import uuid
import hashlib
import socket
from datetime import datetime, timezone


# ─── Datetime Helpers ───────────────────────────────────────────────────────

def get_utc_now():
    return datetime.now(timezone.utc)


def get_utc_now_iso():
    return get_utc_now().isoformat()


# ─── ID Generation ──────────────────────────────────────────────────────────

def generate_id():
    return hashlib.sha256(uuid.uuid4().bytes).hexdigest()[:8]


# ─── Safe Type Coercion ─────────────────────────────────────────────────────

def safe_int(value, default, min_val=None, max_val=None):
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
    try:
        result = float(value)
    except (TypeError, ValueError):
        result = default
    if min_val is not None:
        result = max(result, min_val)
    if max_val is not None:
        result = min(result, max_val)
    return result


# ─── Network Helpers ────────────────────────────────────────────────────────

def get_local_ips():
    ips = []
    try:
        hostname = socket.gethostname()
        ips.append(socket.gethostbyname(hostname))
    except Exception:
        pass

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.append(s.getsockname()[0])
        s.close()
    except Exception:
        pass

    return list(set(ips))
