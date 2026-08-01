"""Password hashing (Part 11 — users.password_hash is an Argon2id hash).

Argon2id is the OWASP-recommended password hash: memory-hard and immune to the
72-byte truncation and MD5-based length-extension issues that affect bcrypt.
Parameters follow the argon2-cffi defaults, which are recalculated as hardware
improves, and the encoded hash embeds the parameters so it can be verified even
if defaults change later.
"""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import (
    Argon2Error,
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a plaintext password into an Argon2id encoded string."""
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Return True when ``password`` matches the stored Argon2id hash.

    Never raises for a bad password or a corrupt hash — callers treat a ``False``
    result as invalid credentials.
    """
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, VerifyMismatchError, InvalidHashError, Argon2Error):
        return False
