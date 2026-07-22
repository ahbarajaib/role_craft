"""Job description routes.

Exposes one endpoint:

    POST /job-descriptions/parse
        Accept raw job description text and return a structured model.

The handler's only responsibilities are:
1. Receive the validated request body.
2. Delegate to the service.
3. Return the response.
"""

from fastapi import APIRouter

from app.schemas.job_description import JobDescription, JobDescriptionRequest, FetchUrlRequest, FetchUrlResponse
from app.services.job_description_service import JobDescriptionService
from app.services.job_url_service import job_url_service

router = APIRouter(prefix="/job-descriptions", tags=["job-descriptions"])

# The service has no constructor parameters so it is instantiated here rather
# than in a dependency factory.  There is nothing to override in tests beyond
# the parser logic itself, which is independently testable.
_service = JobDescriptionService()


@router.post(
    "/parse",
    response_model=JobDescription,
    summary="Parse a job description",
    description=(
        "Accepts a plain-text job description and returns a structured model "
        "with responsibilities, required skills, preferred skills, technologies, "
        "and keywords extracted using rule-based parsing.  No AI is used."
    ),
)
def parse_job_description(body: JobDescriptionRequest) -> JobDescription:
    """Parse the job description text and return structured fields."""
    return _service.parse(body.text)


@router.post(
    "/fetch-url",
    response_model=FetchUrlResponse,
    summary="Fetch job posting from web URL",
    description="Fetches web page HTML and extracts job title, company name, and description text.",
)
async def fetch_job_url(body: FetchUrlRequest) -> FetchUrlResponse:
    """Fetch job title and description text from web link."""
    result = await job_url_service.fetch_and_parse_job_url(body.url)
    return FetchUrlResponse(**result)
