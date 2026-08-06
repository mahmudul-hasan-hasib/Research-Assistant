"""Uploads module tests: validation, storage backends, and the presign→complete API."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.exceptions import FileTooLargeError, InvalidFileTypeError
from app.main import create_app
from app.modules.uploads.validation import (
    ALLOWED_UPLOAD_TYPES,
    validate_actual_size,
    validate_declared_upload,
    validate_file_contents,
)
from app.shared.base import Base
from app.shared.storage import LocalObjectStorage

CREDENTIALS = {"email": "user@example.com", "password": "correct-horse-battery", "display_name": "Ada"}

PDF_BYTES = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\n" + b"0" * 64
PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 64
JPG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01" + b"\x00" * 64
TXT_BYTES = b"hello insight\n"
ZIP_BYTES = b"PK\x03\x04" + b"\x00" * 64


@pytest.fixture
def upload_settings(tmp_path) -> Settings:
    return _settings(tmp_path)


@pytest.fixture
def small_cap_settings(tmp_path) -> Settings:
    return _settings(tmp_path, upload_max_size_bytes=512)


def _settings(tmp_path, **overrides) -> Settings:
    return Settings(
        app_name="insight-test",
        app_env="test",
        debug=True,
        log_level="CRITICAL",
        cors_origins=["http://localhost:3000"],
        database_url=f"sqlite:///{tmp_path / 'uploads.db'}",
        jwt_secret_key="test-secret-with-at-least-32-characters",
        storage_backend="local",
        storage_local_root=str(tmp_path / "storage"),
        **overrides,
    )


def _make_client(settings: Settings) -> TestClient:
    app = create_app(settings)
    assert app.state.container.engine is not None
    Base.metadata.create_all(app.state.container.engine)
    return TestClient(app)


@pytest.fixture
def client(upload_settings: Settings) -> TestClient:
    with _make_client(upload_settings) as test_client:
        yield test_client


@pytest.fixture
def small_cap_client(small_cap_settings: Settings) -> TestClient:
    with _make_client(small_cap_settings) as test_client:
        yield test_client


def _register(client: TestClient, **overrides) -> dict:
    response = client.post(
        "/api/v1/auth/register", json={**CREDENTIALS, **overrides}
    )
    assert response.status_code == 201, response.text
    return response.json()


def _presign(client: TestClient, token: str, **overrides) -> dict:
    payload = {"filename": "notes.txt", "content_type": "text/plain", "size_bytes": 100, **overrides}
    response = client.post(
        "/api/v1/uploads/presign",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _put_bytes(client: TestClient, storage_key: str, data: bytes, content_type: str) -> None:
    client.app.state.container.storage.put_bytes(storage_key, data, content_type=content_type)


# --- validation --------------------------------------------------------------


def test_declared_validation_allows_known_types() -> None:
    assert validate_declared_upload(
        filename="report.pdf",
        content_type="application/pdf",
        size_bytes=100,
        max_size_bytes=1024,
    ) == "application/pdf"


def test_declared_validation_normalizes_content_type() -> None:
    assert (
        validate_declared_upload(
            filename="readme.md",
            content_type="text/plain; charset=utf-8",
            size_bytes=10,
            max_size_bytes=1024,
        )
        == "text/plain"
    )


def test_declared_validation_rejects_unknown_type() -> None:
    with pytest.raises(InvalidFileTypeError):
        validate_declared_upload(
            filename="evil.exe",
            content_type="application/x-msdownload",
            size_bytes=10,
            max_size_bytes=1024,
        )


def test_declared_validation_rejects_extension_spoof() -> None:
    with pytest.raises(InvalidFileTypeError):
        validate_declared_upload(
            filename="notes.txt",
            content_type="application/pdf",
            size_bytes=10,
            max_size_bytes=1024,
        )


def test_declared_validation_rejects_too_large() -> None:
    with pytest.raises(Exception) as exc:
        validate_declared_upload(
            filename="big.pdf",
            content_type="application/pdf",
            size_bytes=2048,
            max_size_bytes=1024,
        )
    assert exc.value.status_code == 413


def test_actual_size_validation_accepts_at_cap() -> None:
    validate_actual_size(actual_size_bytes=1024, max_size_bytes=1024)


def test_actual_size_validation_rejects_over_cap() -> None:
    with pytest.raises(FileTooLargeError) as exc:
        validate_actual_size(actual_size_bytes=2048, max_size_bytes=1024)
    assert exc.value.status_code == 413


def test_contents_magic_matches_declared() -> None:
    validate_file_contents(header=PDF_BYTES, content_type="application/pdf")
    validate_file_contents(header=PNG_BYTES, content_type="image/png")
    validate_file_contents(header=JPG_BYTES, content_type="image/jpeg")
    validate_file_contents(header=TXT_BYTES, content_type="text/plain")
    validate_file_contents(header=ZIP_BYTES, content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


def test_contents_magic_rejects_spoof() -> None:
    with pytest.raises(InvalidFileTypeError):
        validate_file_contents(header=JPG_BYTES, content_type="image/png")


def test_contents_magic_rejects_docx_non_zip() -> None:
    with pytest.raises(InvalidFileTypeError):
        validate_file_contents(header=PDF_BYTES, content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


def test_allow_list_constant_is_frozen() -> None:
    assert isinstance(ALLOWED_UPLOAD_TYPES, dict)
    assert "application/pdf" in ALLOWED_UPLOAD_TYPES


# --- local storage backend ----------------------------------------------------


def test_local_storage_roundtrip(tmp_path) -> None:
    storage = LocalObjectStorage(tmp_path / "store")
    key = "uploads/abc/def.txt"
    storage.put_bytes(key, TXT_BYTES, content_type="text/plain")
    assert storage.get_bytes(key) == TXT_BYTES
    meta = storage.head(key)
    assert meta is not None
    assert meta.size_bytes == len(TXT_BYTES)
    assert storage.get_bytes(key, limit=5) == b"hello"
    storage.delete(key)
    assert storage.head(key) is None


def test_local_storage_rejects_traversal(tmp_path) -> None:
    storage = LocalObjectStorage(tmp_path / "store")
    with pytest.raises(ValueError):
        storage.presign_get("../../etc/passwd", expires_in=60)


def test_local_storage_presign_url_is_scoped(tmp_path) -> None:
    storage = LocalObjectStorage(tmp_path / "store")
    url = storage.presign_put("uploads/u/f.txt", content_type="text/plain", expires_in=60)
    assert url == "local://uploads/u/f.txt"


# --- API flow -----------------------------------------------------------------


def test_presign_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/uploads/presign",
        json={"filename": "a.txt", "content_type": "text/plain", "size_bytes": 10},
    )
    assert response.status_code == 401


def test_presign_rejects_unsupported_type(client: TestClient) -> None:
    token = _register(client)["access_token"]
    response = client.post(
        "/api/v1/uploads/presign",
        json={"filename": "evil.exe", "content_type": "application/x-msdownload", "size_bytes": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_presign_returns_upload_url(client: TestClient) -> None:
    token = _register(client)["access_token"]
    result = _presign(client, token, filename="notes.txt", content_type="text/plain", size_bytes=100)
    assert result["upload_url"].startswith("local://uploads/")
    assert result["max_size_bytes"] == 100 * 1024 * 1024
    assert result["expires_in"] == 900


def test_complete_roundtrip(client: TestClient) -> None:
    token = _register(client)["access_token"]
    result = _presign(client, token, filename="notes.txt", content_type="text/plain", size_bytes=len(TXT_BYTES))
    _put_bytes(client, result["storage_key"], TXT_BYTES, "text/plain")

    response = client.post(
        f"/api/v1/uploads/{result['upload_id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ready"
    assert body["size_bytes"] == len(TXT_BYTES)


def test_complete_requires_put_first(client: TestClient) -> None:
    token = _register(client)["access_token"]
    result = _presign(client, token)
    response = client.post(
        f"/api/v1/uploads/{result['upload_id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 409


def test_complete_rejects_spoofed_bytes(client: TestClient) -> None:
    token = _register(client)["access_token"]
    result = _presign(client, token, filename="photo.png", content_type="image/png", size_bytes=len(JPG_BYTES))
    _put_bytes(client, result["storage_key"], JPG_BYTES, "image/png")

    response = client.post(
        f"/api/v1/uploads/{result['upload_id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422
    failed = client.get(
        f"/api/v1/uploads/{result['upload_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert failed.json()["status"] == "failed"


def test_complete_rejects_actual_size_over_cap(small_cap_client: TestClient) -> None:
    """Declared size is a client claim; the cap is enforced on the real bytes."""
    client = small_cap_client
    token = _register(client)["access_token"]
    result = _presign(client, token, filename="notes.txt", content_type="text/plain", size_bytes=100)
    _put_bytes(client, result["storage_key"], b"x" * 1024, "text/plain")

    response = client.post(
        f"/api/v1/uploads/{result['upload_id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 413, response.text
    failed = client.get(
        f"/api/v1/uploads/{result['upload_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert failed.json()["status"] == "failed"


def test_get_and_delete_are_user_scoped(client: TestClient) -> None:
    alice = _register(client)["access_token"]
    bob = _register(client, email="bob@example.com")["access_token"]
    result = _presign(client, alice, filename="notes.txt", content_type="text/plain", size_bytes=100)
    _put_bytes(client, result["storage_key"], TXT_BYTES, "text/plain")
    client.post(
        f"/api/v1/uploads/{result['upload_id']}/complete",
        headers={"Authorization": f"Bearer {alice}"},
    )

    assert (
        client.get(f"/api/v1/uploads/{result['upload_id']}", headers={"Authorization": f"Bearer {bob}"}).status_code
        == 404
    )
    assert (
        client.delete(f"/api/v1/uploads/{result['upload_id']}", headers={"Authorization": f"Bearer {bob}"}).status_code
        == 404
    )


def test_list_is_user_scoped_and_paginated(client: TestClient) -> None:
    alice = _register(client)["access_token"]
    bob = _register(client, email="bob@example.com")["access_token"]
    _presign(client, alice, filename="a.txt", content_type="text/plain", size_bytes=10)
    _presign(client, alice, filename="b.txt", content_type="text/plain", size_bytes=10)
    _presign(client, bob, filename="c.txt", content_type="text/plain", size_bytes=10)

    alice_list = client.get(
        "/api/v1/uploads", headers={"Authorization": f"Bearer {alice}"}
    ).json()
    bob_list = client.get(
        "/api/v1/uploads", headers={"Authorization": f"Bearer {bob}"}
    ).json()
    assert alice_list["total"] == 2
    assert bob_list["total"] == 1
    assert {item["original_name"] for item in alice_list["items"]} == {"a.txt", "b.txt"}

    limited = client.get(
        "/api/v1/uploads?limit=1", headers={"Authorization": f"Bearer {alice}"}
    ).json()
    assert limited["total"] == 2
    assert len(limited["items"]) == 1


def test_delete_removes_row_and_object(client: TestClient) -> None:
    token = _register(client)["access_token"]
    result = _presign(client, token, filename="notes.txt", content_type="text/plain", size_bytes=len(TXT_BYTES))
    _put_bytes(client, result["storage_key"], TXT_BYTES, "text/plain")

    assert (
        client.delete(f"/api/v1/uploads/{result['upload_id']}", headers={"Authorization": f"Bearer {token}"}).status_code
        == 204
    )
    assert (
        client.get(f"/api/v1/uploads/{result['upload_id']}", headers={"Authorization": f"Bearer {token}"}).status_code
        == 404
    )
    assert client.app.state.container.storage.head(result["storage_key"]) is None


def test_list_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/uploads").status_code == 401
