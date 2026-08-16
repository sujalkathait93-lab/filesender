"""
FileShare Utilities
Generic helper functions: ID generation, token hashing, datetime, network.
"""

import hashlib
import hmac
import secrets
import socket
from datetime import datetime, timezone


# ─── Datetime Helpers ───────────────────────────────────────────────────────

def get_utc_now():
    return datetime.now(timezone.utc)


def get_utc_now_iso():
    return get_utc_now().isoformat()


# ─── ID Generation ──────────────────────────────────────────────────────────

def generate_id():
    """16-character hex ID from CSPRNG (64 bits)."""
    return secrets.token_hex(8)


def generate_owner_token():
    """Opaque token shown once to the sender for cancel/delete."""
    return secrets.token_hex(16)


def hash_token(token: str) -> str:
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()


def tokens_match(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    return hmac.compare_digest(hash_token(plain), hashed)


ACCESS_PROOF_PREFIX = "fileshare-access:"


def proofs_match(provided: str, stored: str) -> bool:
    """Constant-time compare of access-proof hex strings. Never logs values."""
    if not provided or not stored:
        return False
    a = provided.strip().lower()
    b = stored.strip().lower()
    if len(a) != len(b):
        return False
    return hmac.compare_digest(a, b)


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
