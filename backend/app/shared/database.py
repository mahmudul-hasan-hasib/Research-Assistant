"""SQLAlchemy engine and session factory (Part 4.2 / 4.4).

Decisions:
- Synchronous SQLAlchemy. One driver serves both FastAPI (sync dependencies run in
  Starlette's threadpool) and the Celery workers, matching the ``postgresql+psycopg://``
  URL in ``.env.example``. An async engine is a container-level swap if ever needed.
- No global ``scoped_session``. Services create sessions via the injected
  ``SessionFactory`` (each use-case owns its unit of work) and close them with
  their context managers.
"""

from __future__ import annotations

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

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
