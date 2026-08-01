"""Declarative base shared by all business models (Part 5).

Business models live in ``app/modules/*/models`` and inherit from these. The
metadata naming convention is required so Alembic auto-generated migrations produce
stable, consistent constraint names (P10 — migration-first data layer).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


class UUIDPrimaryKeyMixin:
    """Standard surrogate primary key (see Part 5.2 — every table has ``id``).

    A Python-side default is used so inserts work identically on PostgreSQL and
    SQLite (tests). Database-side generation is a per-model decision, not a base one.
    """

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
