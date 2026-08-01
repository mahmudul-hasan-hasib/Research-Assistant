"""Auth HTTP endpoints (Part 11 — OAuth2 Password flow under /api/v1/auth).

Mounted by the composition root at ``settings.api_v1_prefix`` + ``/auth``. All
credentials arrive as JSON (the frontend flow in Part 3.7 posts JSON, not
form-encoded); every failure surfaces as RFC 7807 problem+json via the shared
exception handlers. Per-endpoint rate limiting lands with Redis in a later phase.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.modules.auth.dependencies import get_auth_service, get_current_user
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserOut,
)
from app.modules.auth.services import AuthResult, AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    user_agent = request.headers.get("user-agent")
    ip = request.client.host if request.client is not None else None
    return user_agent, ip


def _to_token_pair(result: AuthResult) -> TokenPair:
    return TokenPair(
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        expires_in=result.expires_in,
        user=UserOut.model_validate(result.user),
    )


@router.post(
    "/register",
    response_model=TokenPair,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account and sign in",
)
def register(
    payload: RegisterRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenPair:
    user_agent, ip = _client_meta(request)
    result = service.register(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
        user_agent=user_agent,
        ip=ip,
    )
    return _to_token_pair(result)


@router.post(
    "/login",
    response_model=TokenPair,
    summary="Authenticate and receive a token pair",
)
def login(
    payload: LoginRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenPair:
    user_agent, ip = _client_meta(request)
    result = service.login(
        email=payload.email,
        password=payload.password,
        user_agent=user_agent,
        ip=ip,
    )
    return _to_token_pair(result)


@router.post(
    "/refresh",
    response_model=TokenPair,
    summary="Rotate a refresh token for a fresh token pair",
)
def refresh(
    payload: RefreshRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenPair:
    user_agent, ip = _client_meta(request)
    result = service.refresh(refresh_token=payload.refresh_token, user_agent=user_agent, ip=ip)
    return _to_token_pair(result)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Revoke the refresh session behind a token",
)
def logout(
    payload: LogoutRequest,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> Response:
    service.logout(refresh_token=payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/logout-all",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Revoke every refresh session for the current user",
)
def logout_all(
    service: Annotated[AuthService, Depends(get_auth_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    service.logout_all(user_id=current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=UserOut,
    summary="Return the current user profile",
)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserOut:
    return UserOut.model_validate(current_user)
