"""Auth persistence models (Part 5.2 — ``users`` and ``sessions`` tables).

Time handling convention: every timestamp is naive UTC. SQLite (tests) cannot
store timezone-aware datetimes, so the whole codebase compares naive UTC values
(``datetime.now(timezone.utc).replace(tzinfo=None)``). This matches
``TimestampMixin`` which uses ``func.now()`` server defaults.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, ForeignKey, String, true
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An account. ``role`` mirrors the RBAC model from Part 11."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default=UserRole.USER.value, server_default=UserRole.USER.value)
    plan: Mapped[str] = mapped_column(String(20), default="free", server_default="free")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())


class AuthSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A rotating refresh-token record (Part 5.2 ``sessions``).

    Only the SHA-256 hash of the refresh token is stored, so a leaked DB never
    yields usable tokens. Rotation (Part 11) revokes the old row when a new pair
    is issued.
    """

    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(64), index=True)
    user_agent: Mapped[str | None] = mapped_column(String(512))
    ip: Mapped[str | None] = mapped_column(String(45))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
