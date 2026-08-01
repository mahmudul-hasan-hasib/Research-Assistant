"""Auth module tests: password hashing, tokens, service use-cases, and the API."""

from __future__ import annotations

import uuid
from datetime import timedelta
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import Settings
from app.main import create_app
from app.modules.auth.models import AuthSession, User
from app.modules.auth.security import hash_password, verify_password
from app.modules.auth.tokens import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_refresh_token,
    now_utc,
)
from app.shared.base import Base

CREDENTIALS = {"email": "user@example.com", "password": "correct-horse-battery", "display_name": "Ada"}


@pytest.fixture
def auth_settings(tmp_path) -> Settings:
    return Settings(
        app_name="insight-test",
        app_env="test",
        debug=True,
        log_level="CRITICAL",
        cors_origins=["http://localhost:3000"],
        database_url=f"sqlite:///{tmp_path / 'auth.db'}",
        jwt_secret_key="test-secret-with-at-least-32-characters",
        jwt_access_token_ttl_seconds=900,
        jwt_refresh_token_ttl_seconds=86_400,
    )


@pytest.fixture
def client(auth_settings: Settings) -> TestClient:
    app = create_app(auth_settings)
    assert app.state.container.engine is not None
    Base.metadata.create_all(app.state.container.engine)
    with TestClient(app) as test_client:
        yield test_client


def _register(client: TestClient, **overrides) -> dict:
    payload = {**CREDENTIALS, **overrides}
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


# --- password hashing ------------------------------------------------------


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("s3cret!")
    assert hashed != "s3cret!"
    assert hashed.startswith("$argon2")
    assert verify_password("s3cret!", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_password_hash_is_salted() -> None:
    assert hash_password("same") != hash_password("same")


def test_verify_password_handles_garbage_hash() -> None:
    assert verify_password("anything", "not-a-valid-hash") is False


# --- tokens ----------------------------------------------------------------


def test_access_token_roundtrip(auth_settings: Settings) -> None:
    token = create_access_token(
        SimpleNamespace(id="00000000-0000-0000-0000-000000000001"),
        secret=auth_settings.jwt_secret,
        algorithm=auth_settings.jwt_algorithm,
        ttl_seconds=900,
    )
    payload = decode_access_token(token, secret=auth_settings.jwt_secret, algorithm=auth_settings.jwt_algorithm)
    assert payload["sub"] == "00000000-0000-0000-0000-000000000001"
    assert payload["type"] == "access"


def test_refresh_token_is_opaque_and_hashed() -> None:
    token = generate_refresh_token()
    assert len(token) >= 60
    digest = hash_refresh_token(token)
    assert len(digest) == 64
    assert digest != token
    assert hash_refresh_token(token) == digest


# --- API flow --------------------------------------------------------------


def test_register_login_me_flow(client: TestClient) -> None:
    registered = _register(client)
    assert registered["token_type"] == "bearer"
    assert registered["expires_in"] == 900
    assert registered["user"]["email"] == "user@example.com"
    assert registered["user"]["role"] == "user"

    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "user@example.com"

    logged_in = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": CREDENTIALS["password"]},
    )
    assert logged_in.status_code == 200, logged_in.text
    assert logged_in.json()["access_token"]


def test_register_normalizes_email_case(client: TestClient) -> None:
    _register(client, email="Ada.Admin@Example.COM", display_name="Ada")
    logged_in = client.post(
        "/api/v1/auth/login",
        json={"email": "ada.admin@example.com", "password": CREDENTIALS["password"]},
    )
    assert logged_in.status_code == 200


def test_register_duplicate_email_conflicts(client: TestClient) -> None:
    _register(client)
    response = client.post("/api/v1/auth/register", json=CREDENTIALS)
    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "conflict"
    assert body["type"] == "about:blank"


def test_register_rejects_weak_password(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={**CREDENTIALS, "password": "aaaaaaaa"},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_login_rejects_bad_credentials(client: TestClient) -> None:
    _register(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


def test_refresh_rotates_and_rejects_reuse(client: TestClient) -> None:
    pair = _register(client)
    first_refresh = pair["refresh_token"]

    rotated = client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert rotated.status_code == 200, rotated.text
    second_refresh = rotated.json()["refresh_token"]
    assert second_refresh != first_refresh

    reused = client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert reused.status_code == 401

    # Reuse detection revoked the whole family, including the just-issued token.
    family = client.post("/api/v1/auth/refresh", json={"refresh_token": second_refresh})
    assert family.status_code == 401


def test_logout_revokes_refresh_token(client: TestClient) -> None:
    pair = _register(client)
    logout = client.post("/api/v1/auth/logout", json={"refresh_token": pair["refresh_token"]})
    assert logout.status_code == 204

    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": pair["refresh_token"]})
    assert refresh.status_code == 401


def test_logout_all_revokes_every_session(client: TestClient) -> None:
    pair = _register(client)
    second = client.post(
        "/api/v1/auth/login",
        json={"email": CREDENTIALS["email"], "password": CREDENTIALS["password"]},
    ).json()

    response = client.post(
        "/api/v1/auth/logout-all",
        headers={"Authorization": f"Bearer {pair['access_token']}"},
    )
    assert response.status_code == 204

    for token in (pair["refresh_token"], second["refresh_token"]):
        refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": token})
        assert refresh.status_code == 401


def test_me_requires_bearer_token(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401
    bad = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert bad.status_code == 401
    assert bad.json()["code"] == "unauthorized"


def test_expired_access_token_rejected(client: TestClient, auth_settings: Settings) -> None:
    pair = _register(client)
    expired = create_access_token(
        SimpleNamespace(id=pair["user"]["id"]),
        secret=auth_settings.jwt_secret,
        algorithm=auth_settings.jwt_algorithm,
        ttl_seconds=-10,
    )
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert me.status_code == 401


def test_password_stored_hashed(client: TestClient) -> None:
    pair = _register(client)
    container = client.app.state.container
    with container.session_factory() as session:
        stored = session.get(User, uuid.UUID(pair["user"]["id"]))
        assert stored is not None
        assert stored.password_hash.startswith("$argon2")
        assert stored.password_hash != CREDENTIALS["password"]


def test_session_expiry_enforced(client: TestClient) -> None:
    pair = _register(client)
    now = now_utc()
    with client.app.state.container.session_factory() as session:
        auth_session = session.scalar(
            select(AuthSession).where(AuthSession.user_id == uuid.UUID(pair["user"]["id"]))
        )
        auth_session.expires_at = now - timedelta(seconds=1)
        session.commit()

    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": pair["refresh_token"]})
    assert refresh.status_code == 401
