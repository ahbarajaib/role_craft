"""Application factory.

``create_app`` is the single place where the FastAPI instance is assembled.
Using a factory function rather than a module-level ``app`` variable means
the application can be instantiated multiple times in tests without
carrying over global state between test runs.

Usage
-----
Uvicorn target: ``main:app``
Test instantiation: ``app = create_app()``
"""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.exceptions import add_exception_handlers
from app.core.logging import setup_logging
from app.middleware.request_id import RequestIDMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage application startup and shutdown lifecycle.

    Everything before ``yield`` runs on startup; everything after runs on
    shutdown.  Async resources (database pools, HTTP clients, etc.) should
    be acquired here and stored on ``app.state`` for later injection.
    """
    settings: Settings = app.state.settings  # type: ignore[attr-defined]

    logger.info(
        "Starting up",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )

    from app.core.database import init_db
    init_db()

    yield

    logger.info("Shutting down", app=settings.APP_NAME)

    # Future teardown goes here, for example:
    # await app.state.db_pool.close()
    # await app.state.http_client.aclose()


def create_app() -> FastAPI:
    """Assemble and return the configured FastAPI application.

    Order matters:
    1. Load settings so every subsequent step can reference them.
    2. Configure logging so startup log lines are captured.
    3. Build the FastAPI instance with metadata and the lifespan handler.
    4. Register middleware (outermost first – CORS before request ID).
    5. Register exception handlers.
    6. Mount routers.
    """
    settings = get_settings()
    setup_logging(settings)

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        # Expose OpenAPI docs only outside production to reduce attack surface.
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # Store settings on app.state so the lifespan handler and tests can
    # retrieve them without calling get_settings() again.
    app.state.settings = settings

    # ── Middleware ─────────────────────────────────────────────────────────
    # Starlette applies middleware in reverse registration order, so the
    # last-added middleware is the outermost wrapper.  Register CORS first
    # so it is outermost (handles pre-flight before request ID is needed).
    origins_list = list(settings.ALLOWED_ORIGINS) if isinstance(settings.ALLOWED_ORIGINS, list) else []
    for default_origin in [
        "https://rolecraft.tech",
        "https://www.rolecraft.tech",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]:
        if default_origin not in origins_list:
            origins_list.append(default_origin)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins_list,
        allow_origin_regex=r"https://.*rolecraft\.tech.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestIDMiddleware)

    # ── Exception handlers ─────────────────────────────────────────────────
    add_exception_handlers(app)

    # ── Routers ───────────────────────────────────────────────────────────
    app.include_router(api_router, prefix=settings.API_PREFIX)

    return app
