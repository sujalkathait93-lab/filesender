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
