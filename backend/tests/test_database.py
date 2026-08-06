from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import Settings
from app.core.container import Container
from app.main import create_app
from app.shared.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.shared.database import build_engine, build_session_factory
from app.shared.repository import BaseRepository


class Sample(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Test-only model — business models arrive in later phases."""

    __tablename__ = "samples"

    name: Mapped[str] = mapped_column(String(100))


class SampleRepository(BaseRepository[Sample]):
    model = Sample


@pytest.fixture
def db_session(tmp_path):
    engine = build_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    factory = build_session_factory(engine)
    session = factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_repository_create_and_get(db_session) -> None:
    repo = SampleRepository(db_session)
    obj = repo.add(Sample(name="alpha"))
    assert obj.id is not None
    assert obj.created_at is not None

    fetched = repo.get(obj.id)
    assert fetched is not None
    assert fetched.name == "alpha"


def test_repository_list_count_and_limit(db_session) -> None:
    repo = SampleRepository(db_session)
    repo.add_all([Sample(name=f"item-{i}") for i in range(5)])

    assert repo.count() == 5
    assert [s.name for s in repo.list()] == [f"item-{i}" for i in range(5)]
    assert [s.name for s in repo.list(skip=2, limit=2)] == ["item-2", "item-3"]


def test_repository_update_and_delete(db_session) -> None:
    repo = SampleRepository(db_session)
    obj = repo.add(Sample(name="beta"))

    obj.name = "gamma"
    repo.flush()
    assert repo.get(obj.id).name == "gamma"

    repo.delete(obj)
    repo.flush()
    assert repo.get(obj.id) is None
    assert repo.count() == 0


def test_container_without_database() -> None:
    container = Container.build(Settings(database_url=None))
    assert container.engine is None
    assert container.session_factory is None
    status = container.health.check_all()["database"]
    assert status.ok is True
    assert status.detail == "not configured"


def test_container_with_database(tmp_path) -> None:
    container = Container.build(Settings(database_url=f"sqlite:///{tmp_path / 'app.db'}"))
    assert container.engine is not None
    assert container.session_factory is not None
    status = container.health.check_all()["database"]
    assert status.ok is True


def test_readyz_reports_database_check(tmp_path) -> None:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'readyz.db'}"))
    with TestClient(app) as client:
        response = client.get("/readyz")
    assert response.status_code == 200
    checks = response.json()["checks"]
    assert checks["database"]["ok"] is True
