from typing import Annotated

from fastapi import Depends

from app.ai.provider import OpenAIProvider
from app.core.config import Settings
from app.dependencies.common import get_settings
from app.services.ats_scoring_service import ATSScoringService
from app.services.job_search_service import JobSearchService

def get_job_search_service() -> JobSearchService:
    """Constructs a JobSearchService."""
    return JobSearchService()

def get_ats_scoring_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ATSScoringService:
    """Constructs an ATSScoringService wired to the configured OpenAI key."""
    provider = OpenAIProvider(
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_MODEL,
    )
    return ATSScoringService(ai_provider=provider)
