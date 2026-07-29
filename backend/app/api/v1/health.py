"""Health check endpoint.

A lightweight liveness probe that confirms the API process is running and
reachable.  It intentionally does **not** check downstream dependencies
(database, cache, external APIs) – a separate readiness probe will be
added when those services are introduced.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.config import Settings
from app.dependencies.common import get_settings

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    summary="Liveness probe",
    description=(
        "Returns 200 when the API process is running. "
        "Does not check downstream dependencies."
    ),
)
async def health_check(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    """Confirm the API is alive and return basic build metadata."""
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "version": settings.APP_VERSION,
    }
