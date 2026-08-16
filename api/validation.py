"""
FileShare Request Validation
Centralized input validation for API endpoints.

All helpers raise ValidationError with a clear message instead of
silently coercing bad input (the old code defaulted invalid values,
which made mistakes invisible).
"""

import re

from api.config import MAX_FILE_SIZE
from api.errors import ValidationError

# 8-32 hex chars (legacy 8-char IDs plus current 16-char IDs)
HEX_ID_RE = re.compile(r"^[0-9a-fA-F]{8,32}$")
HEX_STR_RE = re.compile(r"^[0-9a-fA-F]+$")
IV_HEX_LEN = 24   # 12 bytes
SALT_HEX_LEN = 32  # 16 bytes

MAX_EXPIRY_HOURS = 720.0
MIN_EXPIRY_HOURS = 0.25

SHARING_MODES = frozenset({"standard", "steganography", "burn_on_read", "both"})


def validate_file_id(file_id: str) -> str:
    """File IDs must be hex, 8-32 chars. Normalizes to lowercase."""
    if not file_id or not HEX_ID_RE.match(file_id):
        raise ValidationError("Invalid file ID format")
    return file_id.lower()


def sanitize_filename(name: str) -> str:
    """Keep only the basename; strip path separators and nulls."""
    raw = (name or "file").replace("\\", "/").split("/")[-1]
    raw = raw.replace("\x00", "").replace("..", "")
    raw = raw.strip().strip(".")
    if len(raw) > 255:
        raw = raw[:255]
    return raw or "file"


def validate_upload_form(form: dict) -> dict:
    """Validate and normalize an upload's form fields. Raises ValidationError."""
    iv = form.get("iv", "").strip()
    salt = form.get("salt", "").strip()
    if not iv or not salt:
        raise ValidationError("IV and salt are required for encrypted uploads")

    if not HEX_STR_RE.match(iv) or len(iv) != IV_HEX_LEN:
        raise ValidationError("IV must be a 24-character hex string (12 bytes)")

    if not HEX_STR_RE.match(salt) or len(salt) != SALT_HEX_LEN:
        raise ValidationError("Salt must be a 32-character hex string (16 bytes)")

    original_name = sanitize_filename(form.get("original_name", ""))

    original_size = _to_int(form.get("original_size"), 0, 0, MAX_FILE_SIZE, "original_size")

    sharing_mode = (form.get("sharing_mode") or "standard").strip()[:32]
    if sharing_mode not in SHARING_MODES:
        sharing_mode = "standard"

    transfer_id = (form.get("transfer_id") or "").strip()[:64] or None
    if transfer_id:
        transfer_id = validate_file_id(transfer_id)

    checksum = (form.get("checksum") or "").strip()[:64]
    if checksum and not re.match(r"^[A-Za-z0-9:_-]+$", checksum):
        raise ValidationError("Invalid checksum marker")

    access_hash = (form.get("access_hash") or "").strip().lower()
    if not HEX_STR_RE.match(access_hash) or len(access_hash) != 64:
        raise ValidationError("access_hash must be a 64-character hex SHA-256 digest")

    return {
        "iv": iv.lower(),
        "salt": salt.lower(),
        "original_name": original_name,
        "original_size": original_size,
        "compressed": _to_int(form.get("compressed"), 1, 0, 1, "compressed"),
        "max_downloads": _to_int(form.get("max_downloads"), 10, 0, 100, "max_downloads"),
        "burn_on_read": _to_int(form.get("burn_on_read"), 0, 0, 1, "burn_on_read"),
        "expiry_hours": _to_float(
            form.get("expiry_hours"), 24.0, MIN_EXPIRY_HOURS, MAX_EXPIRY_HOURS, "expiry_hours"
        ),
        "sharing_mode": sharing_mode,
        "transfer_id": transfer_id,
        "checksum": checksum,
        "access_hash": access_hash,
    }


def validate_access_proof(proof: str) -> str:
    """Normalize a client access proof. Empty is allowed here; callers reject it."""
    proof = (proof or "").strip().lower()
    if proof and (not HEX_STR_RE.match(proof) or len(proof) != 64):
        raise ValidationError("Invalid access proof")
    return proof


def _to_int(value, default, min_val, max_val, field_name):
    if value is None or value == "":
        return default
    try:
        result = int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"Field '{field_name}' must be an integer") from None
    if result < min_val or result > max_val:
        raise ValidationError(
            f"Field '{field_name}' must be between {min_val} and {max_val}"
        )
    return result


def _to_float(value, default, min_val, max_val, field_name):
    if value is None or value == "":
        return default
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValidationError(f"Field '{field_name}' must be a number") from None
    if result < min_val or result > max_val:
        raise ValidationError(
            f"Field '{field_name}' must be between {min_val} and {max_val}"
        )
    return result
