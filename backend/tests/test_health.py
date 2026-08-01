from __future__ import annotations

from fastapi.testclient import TestClient


def test_root(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["name"] == "insight-test"
    assert response.json()["version"]


def test_healthz_liveness(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readyz_readiness(client: TestClient) -> None:
    response = client.get("/readyz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["checks"] == {
        "database": {"ok": True, "detail": "not configured"}
    }


def test_request_id_is_forwarded(client: TestClient) -> None:
    response = client.get("/healthz", headers={"X-Request-ID": "abc123"})
    assert response.headers["X-Request-ID"] == "abc123"


def test_request_id_is_generated(client: TestClient) -> None:
    response = client.get("/healthz")
    assert len(response.headers["X-Request-ID"]) == 32


def test_server_timing_header(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.headers["Server-Timing"].startswith("total;dur=")


def test_cors_headers(client: TestClient) -> None:
    response = client.get(
        "/healthz", headers={"Origin": "http://localhost:3000"}
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_unknown_route_returns_problem_json(client: TestClient) -> None:
    response = client.get("/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["type"] == "about:blank"
    assert body["status"] == 404
    assert body["code"] == "http_error"
    assert len(body["trace_id"]) == 32


def test_method_not_allowed_returns_problem_json(client: TestClient) -> None:
    response = client.post("/healthz")
    assert response.status_code == 405
    body = response.json()
    assert body["status"] == 405
    assert body["code"] == "http_error"
