"""Token primitives (Part 11 — short-lived JWT + rotating refresh tokens).

- Access tokens are signed JWTs (default HS256) with ``sub`` = user id,
  ``type`` = "access", and a ``jti`` nonce. They expire after 15 minutes by
  default and are validated against the algorithm and signature on every request.
- Refresh tokens are opaque, high-entropy strings that are only ever stored as a
  SHA-256 hash in ``sessions.refresh_token_hash``. They are rotated on every use.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.core.exceptions import UnauthorizedError
from app.modules.auth.models import User

ACCESS_TOKEN_TYPE = "access"


def now_utc() -> datetime:
    """Canonical 'now' for token/session math: naive UTC (see models docstring)."""
    return datetime.now(UTC).replace(tzinfo=None)


def create_access_token(
    user: User,
    *,
    secret: str,
    algorithm: str,
    ttl_seconds: int,
) -> str:
    now = now_utc()
    payload = {
        "sub": str(user.id),
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(seconds=ttl_seconds),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_access_token(token: str, *, secret: str, algorithm: str) -> dict[str, Any]:
    """Decode and validate an access-token JWT.

    Raises ``UnauthorizedError`` for missing, malformed, expired, or wrong-type
    tokens so the HTTP layer returns a consistent 401 problem+json.
    """
    try:
        payload = jwt.decode(token, secret, algorithms=[algorithm])
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError(detail="Invalid or expired access token") from exc
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise UnauthorizedError(detail="Invalid or expired access token")
    return payload


def generate_refresh_token() -> str:
    """256-bit opaque refresh token (URL-safe base64)."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """Deterministic SHA-256 hash; salt is unnecessary because the token already
    has 256 bits of entropy."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
