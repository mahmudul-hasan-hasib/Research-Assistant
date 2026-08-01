"""Auth persistence access (Part 4.2 — repository layer).

Repositories isolate SQL from the service; transactions stay with the caller
(the service), so these methods flush but never commit.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select, update

from app.modules.auth.models import AuthSession, User
from app.shared.repository import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return self.session.scalar(stmt)

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self.get(user_id)


class SessionRepository(BaseRepository[AuthSession]):
    model = AuthSession

    def get_by_refresh_token_hash(self, refresh_token_hash: str) -> AuthSession | None:
        stmt = select(AuthSession).where(
            AuthSession.refresh_token_hash == refresh_token_hash
        )
        return self.session.scalar(stmt)

    def get_active_by_user(self, user_id: uuid.UUID) -> Sequence[AuthSession]:
        stmt = (
            select(AuthSession)
            .where(
                AuthSession.user_id == user_id,
                AuthSession.revoked_at.is_(None),
            )
            .order_by(AuthSession.created_at)
        )
        return self.session.scalars(stmt).all()

    def revoke(self, session: AuthSession, *, revoked_at) -> None:
        session.revoked_at = revoked_at
        self.flush()

    def revoke_all_for_user(self, user_id: uuid.UUID, *, revoked_at) -> int:
        result = self.session.execute(
            update(AuthSession)
            .where(
                AuthSession.user_id == user_id,
                AuthSession.revoked_at.is_(None),
            )
            .values(revoked_at=revoked_at)
        )
        return result.rowcount or 0
