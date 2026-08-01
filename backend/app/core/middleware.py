"""HTTP middleware chain (Part 4.6).

Order of execution (outermost first) matches the architecture document:
RequestID → AccessLog → CORS → Auth (later) → RateLimit (later) → ResponseTime → GZip.
Auth and RateLimit are added in Phase 2 once authentication/Redis exist.
"""

from __future__ import annotations

import time

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.context import new_trace_id, set_trace_id

access_logger = structlog.get_logger("insight.access")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Assigns/forwards a trace id for the request and echoes it in the response."""

    async def dispatch(self, request: Request, call_next: object) -> Response:
        trace_id = request.headers.get("x-request-id") or new_trace_id()
        set_trace_id(trace_id)
        structlog.contextvars.bind_contextvars(trace_id=trace_id)
        try:
            response = await call_next(request)
        finally:
            structlog.contextvars.reset_contextvars()
        response.headers["X-Request-ID"] = trace_id
        return response


class AccessLogMiddleware(BaseHTTPMiddleware):
    """Emits one structured access-log line per request (Part 12.1)."""

    async def dispatch(self, request: Request, call_next: object) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        access_logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round(duration_ms, 3),
            client=request.client.host if request.client else None,
        )
        return response


class ResponseTimeMiddleware(BaseHTTPMiddleware):
    """Records response timing in the ``Server-Timing`` header."""

    async def dispatch(self, request: Request, call_next: object) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["Server-Timing"] = f"total;dur={duration_ms:.3f}"
        return response
