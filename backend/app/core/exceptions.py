"""Exception handling (Part 4.5).

A single registry maps domain exceptions to HTTP status + machine-readable error
code. All error responses are RFC 7807 ``application/problem+json`` and always
carry the request ``trace_id``. The catch-all handler logs the stack trace and
never leaks internals.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.context import get_trace_id
from app.core.logging import get_logger

logger = get_logger("insight.exceptions")


class InsightError(Exception):
    """Base class for all domain exceptions raised by services/modules."""

    status_code: int = 500
    code: str = "insight_error"
    title: str = "Internal error"

    def __init__(
        self,
        detail: str | None = None,
        *,
        errors: dict[str, Any] | None = None,
    ) -> None:
        self.detail = detail or self.title
        self.errors = errors or {}
        super().__init__(self.detail)


class ConfigurationError(InsightError):
    status_code = 500
    code = "configuration_error"
    title = "Server configuration error"


class UnauthorizedError(InsightError):
    status_code = 401
    code = "unauthorized"
    title = "Authentication required"


class ForbiddenError(InsightError):
    status_code = 403
    code = "forbidden"
    title = "Permission denied"


class NotFoundError(InsightError):
    status_code = 404
    code = "not_found"
    title = "Resource not found"


class ConflictError(InsightError):
    status_code = 409
    code = "conflict"
    title = "Resource conflict"


class InvalidFileTypeError(InsightError):
    status_code = 422
    code = "invalid_file_type"
    title = "Unsupported file type"


class FileTooLargeError(InsightError):
    status_code = 413
    code = "file_too_large"
    title = "File too large"


def _problem(
    request: Request,
    *,
    status: int,
    title: str,
    detail: str,
    code: str,
    errors: dict[str, Any] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": "about:blank",
        "title": title,
        "status": status,
        "detail": detail,
        "code": code,
        "trace_id": get_trace_id(),
    }
    if errors:
        body["errors"] = errors
    return JSONResponse(status_code=status, content=body, media_type="application/problem+json")


async def _insight_error_handler(request: Request, exc: InsightError) -> JSONResponse:
    return _problem(
        request,
        status=exc.status_code,
        title=exc.title,
        detail=exc.detail,
        code=exc.code,
        errors=exc.errors,
    )


async def _http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return _problem(
        request,
        status=exc.status_code,
        title="HTTP error",
        detail=str(exc.detail),
        code="http_error",
    )


def _flatten_validation_errors(exc: RequestValidationError) -> dict[str, Any]:
    errors: dict[str, Any] = {}
    for item in exc.errors():
        loc = ".".join(str(part) for part in item.get("loc", []) if part != "body")
        errors[loc or "_"] = {
            "type": item.get("type", "value_error"),
            "msg": item.get("msg", "Invalid value"),
        }
    return errors


async def _validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return _problem(
        request,
        status=422,
        title="Validation error",
        detail="Request validation failed",
        code="validation_error",
        errors=_flatten_validation_errors(exc),
    )


async def _unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled_exception", error=type(exc).__name__, exc_info=exc)
    return _problem(
        request,
        status=500,
        title="Internal server error",
        detail="An unexpected error occurred",
        code="internal_error",
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(InsightError, _insight_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(Exception, _unhandled_error_handler)
