"""
SecureShare Request Validation
Lightweight validation helpers for upload forms, IDs, and transfer codes.

All helpers raise ValidationError with a clear message instead of
silently coercing bad input (the old code defaulted invalid values,
which made mistakes invisible).
"""

import re

from api.config import MAX_FILE_SIZE
from api.errors import ValidationError

# 8 hex chars (or 8-32 hex chars for lenient lookups)
HEX_ID_RE = re.compile(r"^[0-9a-fA-F]{8,32}$")
HEX_STR_RE = re.compile(r"^[0-9a-fA-F]+$")

MAX_EXPIRY_HOURS = 720.0
MIN_EXPIRY_HOURS = 0.25


def validate_file_id(file_id: str) -> str:
    """File IDs must be hex, 8-32 chars. Normalizes to lowercase."""
    if not file_id or not HEX_ID_RE.match(file_id):
        raise ValidationError("Invalid file ID format")
    return file_id.lower()


def validate_upload_form(form: dict) -> dict:
    """Validate and normalize an upload's form fields. Raises ValidationError."""
    iv = form.get("iv", "").strip()
    salt = form.get("salt", "").strip()
    if not iv or not salt:
        raise ValidationError("IV and salt are required for encrypted uploads")

    if not HEX_STR_RE.match(iv):
        raise ValidationError("IV must be a valid hex string")

    if not HEX_STR_RE.match(salt):
        raise ValidationError("Salt must be a valid hex string")

    original_name = (form.get("original_name", "").strip() or "file").strip()
    if len(original_name) > 255:
        raise ValidationError("File name is too long (max 255 chars)")

    original_size = _to_int(form.get("original_size"), 0, 0, MAX_FILE_SIZE, "original_size")

    return {
        "iv": iv,
        "salt": salt,
        "original_name": original_name,
        "original_size": original_size,
        "compressed": _to_int(form.get("compressed"), 1, 0, 1, "compressed"),
        "max_downloads": _to_int(form.get("max_downloads"), 10, 1, 100, "max_downloads"),
        "burn_on_read": _to_int(form.get("burn_on_read"), 0, 0, 1, "burn_on_read"),
        "expiry_hours": _to_float(
            form.get("expiry_hours"), 24.0, MIN_EXPIRY_HOURS, MAX_EXPIRY_HOURS, "expiry_hours"
        ),
        "sharing_mode": form.get("sharing_mode", "standard")[:32] or "standard",
        "transfer_id": (form.get("transfer_id") or "").strip()[:64] or None,
    }


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
