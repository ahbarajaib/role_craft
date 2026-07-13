"""Resume analysis workflow dependency factory.

Constructs the full service chain needed by ``ResumeAnalysisWorkflow``
and hands it to the route handler via FastAPI's ``Depends`` mechanism.

The four services have different construction requirements:
- ``SectionService``        requires ``upload_dir`` from settings.
- ``JobDescriptionService`` has no parameters (stateless).
- ``ComparisonService``     has no parameters (stateless).
- ``ReviewService``         requires an ``OpenAIProvider``.

Centralising construction here keeps the route handler free of all
configuration and infrastructure concerns.
"""

from pathlib import Path
from typing import Annotated

from fastapi import Depends

from app.ai.provider import OpenAIProvider
from app.core.config import Settings
from app.dependencies.common import get_settings
from app.services.comparison_service import ComparisonService
from app.services.job_description_service import JobDescriptionService
from app.services.resume_analysis_workflow import ResumeAnalysisWorkflow
from app.services.review_service import ReviewService
from app.services.section_service import SectionService
from app.services.rewrite_service import RewriteService
from app.services.patch_service import PatchService


def get_patch_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> PatchService:
    """Construct a ``PatchService`` wired to the current settings."""
    return PatchService(
        upload_dir=Path(settings.UPLOAD_DIR),
        section_service=SectionService(upload_dir=Path(settings.UPLOAD_DIR)),
    )


def get_rewrite_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> RewriteService:
    """Construct a ``RewriteService`` wired to the current settings."""
    provider = OpenAIProvider(
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_MODEL,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )
    return RewriteService(
        section_service=SectionService(upload_dir=Path(settings.UPLOAD_DIR)),
        provider=provider,
    )


def get_resume_analysis_workflow(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ResumeAnalysisWorkflow:
    """Construct a ``ResumeAnalysisWorkflow`` wired to the current settings."""
    provider = OpenAIProvider(
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_MODEL,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )
    return ResumeAnalysisWorkflow(
        section_service=SectionService(upload_dir=Path(settings.UPLOAD_DIR)),
        jd_service=JobDescriptionService(),
        comparison_service=ComparisonService(),
        review_service=ReviewService(provider=provider),
    )
