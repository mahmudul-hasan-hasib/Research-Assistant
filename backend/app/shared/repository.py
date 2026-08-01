"""Generic repository base (Part 4.2 — repository layer).

Concrete repositories live in ``app/modules/*/repositories``, subclass this and
declare ``model``. Repositories own persistence access; transactions are owned by
the caller (the service / use-case): these methods flush to make generated values
available but never commit.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.shared.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, ident: Any) -> ModelT | None:
        return self.session.get(self.model, ident)

    def list(self, *, skip: int = 0, limit: int | None = None) -> Sequence[ModelT]:
        stmt = select(self.model).offset(skip)
        if limit is not None:
            stmt = stmt.limit(limit)
        return self.session.scalars(stmt).all()

    def count(self) -> int:
        return self.session.scalar(
            select(func.count()).select_from(self.model)
        ) or 0

    def add(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        self.session.flush()
        return obj

    def add_all(self, objs: Sequence[ModelT]) -> Sequence[ModelT]:
        self.session.add_all(objs)
        self.session.flush()
        return objs

    def delete(self, obj: ModelT) -> None:
        self.session.delete(obj)

    def flush(self) -> None:
        self.session.flush()

    def refresh(self, obj: ModelT) -> ModelT:
        self.session.refresh(obj)
        return obj
