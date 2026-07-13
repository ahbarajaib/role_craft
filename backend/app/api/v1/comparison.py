"""Comparison route.

Exposes one endpoint:

    POST /compare
        Accept parsed resume sections and a parsed job description.
        Return a deterministic side-by-side comparison of signals
        (keywords, technologies, required skills) found and missing.

The handler's only responsibilities are:
1. Receive the validated request body.
2. Delegate to the service.
3. Return the response.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.schemas.comparison import CompareRequest, ComparisonResult
from app.services.comparison_service import ComparisonService, get_comparison_service

router = APIRouter(prefix="/compare", tags=["comparison"])


@router.post(
    "",
    response_model=ComparisonResult,
    summary="Compare a resume against a job description",
    description=(
        "Accepts parsed resume sections and a parsed job description. "
        "Uses deterministic rule-based matching to identify which job "
        "description signals (keywords, technologies, required skills) "
        "are present in or absent from the resume. No AI is used."
    ),
)
def compare_resume(
    body: CompareRequest,
    service: Annotated[ComparisonService, Depends(get_comparison_service)],
) -> ComparisonResult:
    """Delegate comparison to the service and return the structured result."""
    return service.compare(
        sections=body.sections,
        job_description=body.job_description,
    )
