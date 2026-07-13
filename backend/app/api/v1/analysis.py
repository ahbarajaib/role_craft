"""Analysis route.

Exposes one endpoint:

    POST /analyze
        Accept parsed resume sections and a parsed job description.
        Return per-section AI analysis with gaps, priority, and missing keywords.

The handler's only responsibilities are:
1. Receive the validated request body.
2. Delegate to the service.
3. Return the response.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies.analysis import get_analysis_service
from app.schemas.analysis import AnalysisRequest, ResumeAnalysisResponse
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analyze", tags=["analysis"])


@router.post(
    "",
    response_model=ResumeAnalysisResponse,
    summary="Analyse a resume against a job description",
    description=(
        "Accepts parsed resume sections and a parsed job description. "
        "Uses OpenAI to identify gaps in each resume section relative to "
        "the job requirements. Returns per-section analysis with priority, "
        "reason, and missing keywords. No content is modified."
    ),
)
def analyze_resume(
    body: AnalysisRequest,
    service: Annotated[AnalysisService, Depends(get_analysis_service)],
) -> ResumeAnalysisResponse:
    """Delegate analysis to the service and return the structured result."""
    return service.analyze_resume(
        sections=body.sections,
        job_description=body.job_description,
    )
