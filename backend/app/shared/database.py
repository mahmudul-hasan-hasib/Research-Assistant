"""SQLAlchemy engine and session factory (Part 4.2 / 4.4).

Decisions:
- Synchronous SQLAlchemy. One driver serves both FastAPI (sync dependencies run in
  Starlette's threadpool) and the Celery workers, matching the ``postgresql+psycopg://``
  URL in ``.env.example``. An async engine is a container-level swap if ever needed.
- No global ``scoped_session``. Sessions are created per request by the
  ``get_session`` dependency and closed when the request ends.
"""

from __future__ import annotations

from collections.abc import Generator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.exceptions import ConfigurationError

SessionFactory = sessionmaker[Session]


def build_engine(database_url: str, *, echo: bool = False) -> Engine:
    connect_args: dict[str, object] = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_engine(
        database_url,
        echo=echo,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


def build_session_factory(engine: Engine) -> SessionFactory:
    return sessionmaker(bind=engine, class_=Session, expire_on_commit=False)


def get_session(request: Request) -> Generator[Session, None, None]:
    """FastAPI dependency: one request-scoped session, closed after the request."""
    session_factory = request.app.state.container.session_factory
    if session_factory is None:
        raise ConfigurationError(
            "Database is not configured; set DATABASE_URL before enabling "
            "database-backed modules"
        )
    with session_factory() as session:
        yield session
