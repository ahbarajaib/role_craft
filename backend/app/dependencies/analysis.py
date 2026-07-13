"""Analysis service dependency factory.

Constructs the full ``OpenAIProvider → AnalysisService`` chain from
application settings and hands the service to route handlers via
FastAPI's ``Depends`` mechanism.

Separating construction here means:
- Route handlers have no knowledge of API keys or client initialisation.
- Tests can override this dependency to inject a mock provider.
"""

from typing import Annotated

from fastapi import Depends

from app.ai.provider import OpenAIProvider
from app.core.config import Settings
from app.dependencies.common import get_settings
from app.services.analysis_service import AnalysisService


def get_analysis_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AnalysisService:
    """Construct an ``AnalysisService`` wired to the configured OpenAI key."""
    provider = OpenAIProvider(
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_MODEL,
    )
    return AnalysisService(provider=provider)
