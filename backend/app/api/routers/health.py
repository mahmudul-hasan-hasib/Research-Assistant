"""System endpoints: liveness, readiness and root.

Mounted at the root (not under /api/v1) so infrastructure probes hit stable paths
regardless of the API prefix (Part 13.5).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.health import HealthRegistry

router = APIRouter(tags=["system"])


@router.get("/healthz", summary="Liveness probe")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz", summary="Readiness probe")
async def readyz(request: Request) -> JSONResponse:
    registry: HealthRegistry = request.app.state.container.health
    results = registry.check_all()
    healthy = all(status.ok for status in results.values())
    checks: dict[str, dict[str, Any]] = {
        name: {"ok": status.ok, "detail": status.detail}
        for name, status in results.items()
    }
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={"status": "ok" if healthy else "unavailable", "checks": checks},
    )
