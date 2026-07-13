"""Section review route.

Exposes one endpoint:

    POST /review-section
        Accept one resume section, its pre-computed comparison result,
        and the parsed job description.  Return an AI review that explains
        whether the section needs changes and what improvements are possible
        without inventing content.

The handler's only responsibilities are:
1. Receive the validated request body.
2. Delegate to the service.
3. Return the response.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies.review import get_review_service
from app.schemas.review import ReviewRequest, SectionReview
from app.services.review_service import ReviewService

router = APIRouter(prefix="/review-section", tags=["review"])


@router.post(
    "",
    response_model=SectionReview,
    summary="AI review of a single resume section",
    description=(
        "Accepts one resume section, the pre-computed comparison result for "
        "that section (from POST /compare), and the parsed job description. "
        "Uses OpenAI to review whether the section needs changes, what "
        "strengths it already has, and what targeted improvements are possible "
        "without inventing content. Does not rewrite anything."
    ),
)
def review_section(
    body: ReviewRequest,
    service: Annotated[ReviewService, Depends(get_review_service)],
) -> SectionReview:
    """Delegate section review to the service and return the structured result."""
    return service.review_section(
        section=body.section,
        comparison=body.comparison,
        job_description=body.job_description,
    )
