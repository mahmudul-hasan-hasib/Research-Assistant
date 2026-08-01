"""Alembic environment (P10 — migration-first data layer).

The database URL comes from the settings service (single source of truth). An
explicit ``sqlalchemy.url`` on the Config wins over settings — used by tests and
ops tooling. Fails fast when no URL is configured.
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings
from app.shared.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

if not config.get_main_option("sqlalchemy.url"):
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL is not configured; set it in the environment or on the "
            "alembic Config (sqlalchemy.url) before running migrations"
        )
    config.set_main_option("sqlalchemy.url", settings.database_url)

# Import all model modules here so autogenerate sees the full metadata.
from app.modules.auth import models  # noqa: F401
from app.modules.rag import models  # noqa: F401
from app.modules.uploads import models  # noqa: F401
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
