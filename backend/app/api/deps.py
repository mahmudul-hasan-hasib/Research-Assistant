"""FastAPI dependencies.

Routers receive wired objects through ``app.state`` (set by the composition root in
``main.py``) instead of importing the container directly — keeps the HTTP layer
decoupled from construction details.
"""

from __future__ import annotations

from fastapi import Request

from app.core.config import Settings
from app.core.container import Container


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_container(request: Request) -> Container:
    return request.app.state.container
