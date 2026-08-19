"""
FileShare Core Utilities
Primary Responsibility: Datetime helpers and safe type coercion.
Re-exports security tokens and network helpers for backwards compatibility.
"""

from datetime import datetime, timezone

# Re-exports for backwards compatibility
from api.tokens import (
    ACCESS_PROOF_PREFIX,
    generate_id,
    generate_owner_token,
    hash_token,
    tokens_match,
    proofs_match,
)
from api.network import get_local_ips

__all__ = [
    "get_utc_now",
    "get_utc_now_iso",
    "parse_iso_datetime",
    "is_expired",
    "safe_int",
    "safe_float",
    "generate_id",
    "generate_owner_token",
    "hash_token",
    "tokens_match",
    "proofs_match",
    "ACCESS_PROOF_PREFIX",
    "get_local_ips",
]


# ─── Datetime Helpers ───────────────────────────────────────────────────────

def get_utc_now() -> datetime:
    """Return timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def get_utc_now_iso() -> str:
    """Return timezone-aware UTC datetime formatted as ISO 8601 string."""
    return get_utc_now().isoformat()


def parse_iso_datetime(dt_val) -> datetime | None:
    """Safely parse a datetime object or ISO 8601 string into a timezone-aware UTC datetime."""
    if not dt_val:
        return None
    if isinstance(dt_val, datetime):
        return dt_val if dt_val.tzinfo else dt_val.replace(tzinfo=timezone.utc)
    if isinstance(dt_val, str):
        try:
            clean_str = dt_val.strip().replace(" ", "T")
            if clean_str.endswith("Z"):
                clean_str = clean_str[:-1] + "+00:00"
            dt = datetime.fromisoformat(clean_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return None
    return None


def is_expired(expires_at) -> bool:
    """Return True if the given expiry timestamp has passed in UTC."""
    dt = parse_iso_datetime(expires_at)
    if not dt:
        return False
    return dt <= get_utc_now()



# ─── Safe Type Coercion ─────────────────────────────────────────────────────

def safe_int(value, default: int, min_val: int = None, max_val: int = None) -> int:
    """Safely coerce input to integer with optional clamping."""
    try:
        result = int(value)
    except (TypeError, ValueError):
        result = default
    if min_val is not None:
        result = max(result, min_val)
    if max_val is not None:
        result = min(result, max_val)
    return result


def safe_float(value, default: float, min_val: float = None, max_val: float = None) -> float:
    """Safely coerce input to float with optional clamping."""
    try:
        result = float(value)
    except (TypeError, ValueError):
        result = default
    if min_val is not None:
        result = max(result, min_val)
    if max_val is not None:
        result = min(result, max_val)
    return result
