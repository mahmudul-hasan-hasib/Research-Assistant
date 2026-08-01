"""Insight backend — composition root (Part 4).

Builds the FastAPI application: settings → logging → container → middleware chain →
exception handlers → routers. ``create_app`` accepts an explicit ``Settings`` so
tests can inject their own configuration.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app import __version__
from app.api.routers.health import router as health_router
from app.core.config import Settings, get_settings
from app.core.container import Container
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import (
    AccessLogMiddleware,
    RequestIDMiddleware,
    ResponseTimeMiddleware,
)
from app.modules.agent.router import router as agent_router
from app.modules.auth.router import router as auth_router
from app.modules.rag.router import router as rag_router
from app.modules.uploads.router import router as uploads_router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)

    container = Container.build(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        if container.engine is not None:
            container.engine.dispose()

    app = FastAPI(
        title=f"{settings.app_name.title()} API",
        version=__version__,
        debug=settings.debug,
        docs_url="/docs" if settings.debug else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    app.state.settings = settings
    app.state.container = container

    register_exception_handlers(app)

    # Order matters — outermost first (Part 4.6):
    # RequestID → AccessLog → CORS → [Auth → RateLimit in Phase 2] → ResponseTime → GZip.
    # Starlette prepends middlewares, so register in reverse to match the doc order.
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(ResponseTimeMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(RequestIDMiddleware)

    app.include_router(health_router)
    app.include_router(auth_router, prefix=settings.api_v1_prefix)
    app.include_router(uploads_router, prefix=settings.api_v1_prefix)
    app.include_router(rag_router, prefix=settings.api_v1_prefix)
    app.include_router(agent_router, prefix=settings.api_v1_prefix)

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {"name": settings.app_name, "version": __version__}

    return app


app = create_app()
