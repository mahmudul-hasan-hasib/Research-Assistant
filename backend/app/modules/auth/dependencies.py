"""Auth FastAPI dependencies: bearer-token extraction and current-user resolution."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import ConfigurationError, UnauthorizedError
from app.modules.auth.models import User
from app.modules.auth.services import AuthService

bearer_scheme = HTTPBearer(auto_error=False)


def get_auth_service(request: Request) -> AuthService:
    service: AuthService | None = request.app.state.container.auth_service
    if service is None:
        raise ConfigurationError(
            "Authentication is not configured; set DATABASE_URL to enable the auth module"
        )
    return service


def get_current_user(
    request: Request,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError(detail="Authentication required")
    service = get_auth_service(request)
    return service.authenticate_access_token(credentials.credentials)
