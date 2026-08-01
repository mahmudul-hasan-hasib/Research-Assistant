"""Alembic smoke test: the migration chain must apply to an empty database."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from alembic.config import Config

from alembic import command

BACKEND_DIR = Path(__file__).resolve().parent.parent


def test_alembic_upgrade_head(tmp_path) -> None:
    db_path = tmp_path / "migrate.db"

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")

    command.upgrade(config, "head")

    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute("SELECT version_num FROM alembic_version").fetchall()
    finally:
        conn.close()

    assert rows == [("0004",)]
