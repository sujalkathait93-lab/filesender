"""
FileShare Tokens & Security Utilities
Primary Responsibility: Cryptographic ID generation, token hashing, and secure comparison.
"""

import hashlib
import hmac
import secrets

ACCESS_PROOF_PREFIX = "fileshare-access:"


def generate_id() -> str:
    """5-character hex ID (forms a 10-digit transfer code when paired with a 5-char key)."""
    return secrets.token_hex(3)[:5]


def generate_owner_token() -> str:
    """Opaque token shown once to the sender for cancel/delete."""
    return secrets.token_hex(16)


def hash_token(token: str) -> str:
    """Compute SHA-256 hex digest of token."""
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()


def tokens_match(plain: str, hashed: str) -> bool:
    """Constant-time token verification."""
    if not plain or not hashed:
        return False
    return hmac.compare_digest(hash_token(plain), hashed)


def proofs_match(provided: str, stored: str) -> bool:
    """Constant-time compare of access-proof hex strings. Never logs values."""
    if not provided or not stored:
        return False
    a = provided.strip().lower()
    b = stored.strip().lower()
    if len(a) != len(b):
        return False
    return hmac.compare_digest(a, b)
