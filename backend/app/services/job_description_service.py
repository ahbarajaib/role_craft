"""Job description service.

A thin bridge between the route handler and the parser.

Responsibilities
----------------
- Receive the raw text string.
- Delegate to ``parse_job_description``.
- Log the result summary.
- Return the structured ``JobDescription``.

Non-responsibilities
--------------------
- HTTP concerns (handled by the route).
- AI (future milestone).
- Database persistence (future milestone).
- Resume comparison (future milestone).
"""

from loguru import logger

from app.parsers.job_description_parser import parse_job_description
from app.schemas.job_description import JobDescription


class JobDescriptionService:
    """Orchestrates job description parsing.

    Has no constructor parameters because parsing is purely in-memory;
    there is no upload directory or external resource to configure.
    """

    def parse(self, text: str) -> JobDescription:
        """Parse raw job description text and return a structured model."""
        result = parse_job_description(text)

        logger.info(
            "Job description parsed",
            title=result.title,
            responsibilities=len(result.responsibilities),
            required_skills=len(result.required_skills),
            preferred_skills=len(result.preferred_skills),
            technologies=len(result.technologies),
            keywords=len(result.keywords),
        )

        return result
