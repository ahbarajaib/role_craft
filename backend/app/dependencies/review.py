"""Review service dependency factory.

Constructs the ``OpenAIProvider → ReviewService`` chain from application
settings and hands the service to route handlers via FastAPI's ``Depends``.

Follows exactly the same pattern as ``dependencies/analysis.py`` so the
codebase stays consistent: every AI-backed service gets its own factory
that is easy to override in tests via ``app.dependency_overrides``.
"""

from typing import Annotated

from fastapi import Depends

from app.ai.provider import OpenAIProvider
from app.core.config import Settings
from app.dependencies.common import get_settings
from app.services.review_service import ReviewService


def get_review_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ReviewService:
    """Construct a ``ReviewService`` wired to the configured OpenAI key."""
    provider = OpenAIProvider(
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_MODEL,
    )
    return ReviewService(provider=provider)
