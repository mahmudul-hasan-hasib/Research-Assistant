"""Auth service (Part 4.2 — business rules / use-case orchestration).

Owns one unit of work per operation: it opens a session, runs the use-case, and
commits. Repositories stay inside this module so the HTTP layer never touches
persistence. Refresh-token reuse (a stolen-token signal) revokes the whole
session family before rejecting.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.exc import IntegrityError

from app.core.config import Settings
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    UnauthorizedError,
)
from app.modules.auth.models import AuthSession, User
from app.modules.auth.repositories import SessionRepository, UserRepository
from app.modules.auth.security import hash_password, verify_password
from app.modules.auth.tokens import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_refresh_token,
    now_utc,
)
from app.shared.database import SessionFactory


@dataclass
class AuthResult:
    access_token: str
    refresh_token: str
    expires_in: int
    user: User


class AuthService:
    def __init__(self, *, session_factory: SessionFactory, settings: Settings) -> None:
        self._session_factory = session_factory
        self._settings = settings

    # --- use-cases ---------------------------------------------------------

    def register(
        self,
        *,
        email: str,
        password: str,
        display_name: str,
        user_agent: str | None,
        ip: str | None,
    ) -> AuthResult:
        with self._session_factory() as session:
            users = UserRepository(session)
            if users.get_by_email(email) is not None:
                raise ConflictError(detail="An account with this email already exists")

            user = User(
                email=email,
                password_hash=hash_password(password),
                display_name=display_name,
            )
            users.add(user)
            try:
                result = self._issue_token_pair(session, user, user_agent=user_agent, ip=ip)
                session.commit()
            except IntegrityError:
                session.rollback()
                raise ConflictError(detail="An account with this email already exists") from None
            return result

    def login(
        self,
        *,
        email: str,
        password: str,
        user_agent: str | None,
        ip: str | None,
    ) -> AuthResult:
        with self._session_factory() as session:
            user = UserRepository(session).get_by_email(email)
            if user is None or not verify_password(password, user.password_hash):
                raise UnauthorizedError(detail="Incorrect email or password")
            if not user.is_active:
                raise ForbiddenError(detail="Account is disabled")
            result = self._issue_token_pair(session, user, user_agent=user_agent, ip=ip)
            session.commit()
            return result

    def refresh(
        self,
        *,
        refresh_token: str,
        user_agent: str | None,
        ip: str | None,
    ) -> AuthResult:
        token_hash = hash_refresh_token(refresh_token)
        with self._session_factory() as session:
            repos = SessionRepository(session)
            auth_session = repos.get_by_refresh_token_hash(token_hash)
            if auth_session is None:
                raise UnauthorizedError(detail="Invalid refresh token")

            user = session.get(User, auth_session.user_id)
            if user is None or not user.is_active:
                raise UnauthorizedError(detail="Invalid refresh token")

            if auth_session.revoked_at is not None:
                # Reuse of a revoked token → assume theft, kill the whole family.
                repos.revoke_all_for_user(user.id, revoked_at=now_utc())
                session.commit()
                raise UnauthorizedError(detail="Invalid refresh token")
            if auth_session.expires_at <= now_utc():
                raise UnauthorizedError(detail="Refresh token has expired")

            # Rotation (Part 11): the old session is revoked, a new one issued.
            repos.revoke(auth_session, revoked_at=now_utc())
            result = self._issue_token_pair(session, user, user_agent=user_agent, ip=ip)
            session.commit()
            return result

    def logout(self, *, refresh_token: str) -> None:
        token_hash = hash_refresh_token(refresh_token)
        with self._session_factory() as session:
            auth_session = SessionRepository(session).get_by_refresh_token_hash(token_hash)
            if auth_session is not None and auth_session.revoked_at is None:
                SessionRepository(session).revoke(auth_session, revoked_at=now_utc())
            session.commit()

    def logout_all(self, *, user_id: uuid.UUID) -> int:
        with self._session_factory() as session:
            revoked = SessionRepository(session).revoke_all_for_user(user_id, revoked_at=now_utc())
            session.commit()
            return revoked

    def authenticate_access_token(self, token: str) -> User:
        payload = decode_access_token(
            token,
            secret=self._settings.jwt_secret,
            algorithm=self._settings.jwt_algorithm,
        )
        try:
            user_id = uuid.UUID(str(payload.get("sub")))
        except (TypeError, ValueError):
            raise UnauthorizedError(detail="Invalid access token") from None

        with self._session_factory() as session:
            user = UserRepository(session).get(user_id)
            if user is None or not user.is_active:
                raise UnauthorizedError(detail="Account is disabled or no longer exists")
            return user

    # --- internals ---------------------------------------------------------

    def _issue_token_pair(
        self,
        session,
        user: User,
        *,
        user_agent: str | None,
        ip: str | None,
    ) -> AuthResult:
        refresh_token = generate_refresh_token()
        auth_session = AuthSession(
            user_id=user.id,
            refresh_token_hash=hash_refresh_token(refresh_token),
            user_agent=user_agent,
            ip=ip,
            expires_at=now_utc()
            + timedelta(seconds=self._settings.jwt_refresh_token_ttl_seconds),
        )
        session.add(auth_session)
        session.flush()

        access_token = create_access_token(
            user,
            secret=self._settings.jwt_secret,
            algorithm=self._settings.jwt_algorithm,
            ttl_seconds=self._settings.jwt_access_token_ttl_seconds,
        )
        return AuthResult(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=self._settings.jwt_access_token_ttl_seconds,
            user=user,
        )
