"""Comparison service.

A thin bridge between the route handler and the comparator.

Responsibilities
----------------
- Validate that there is content to compare.
- Delegate to ``compare_resume``.
- Log a summary.
- Return the structured result.

Non-responsibilities
--------------------
- HTTP (handled by the route).
- Comparison logic (handled by ``app.comparators.resume_comparator``).
- Database (future milestone).
"""

from loguru import logger

from app.comparators.resume_comparator import compare_resume
from app.core.exceptions import BadRequestError
from app.schemas.comparison import ComparisonResult
from app.schemas.job_description import JobDescription
from app.schemas.section import SectionItem


class ComparisonService:
    """Orchestrates the resume vs job description comparison.

    Has no constructor parameters: comparison is purely in-memory with no
    external resources to configure, so no dependency factory is needed.
    """

    def compare(
        self,
        sections: list[SectionItem],
        job_description: JobDescription,
    ) -> ComparisonResult:
        """Compare resume sections against the job description.

        Raises ``BadRequestError`` when there are no content sections or no
        JD signals to compare against, so the caller receives a 400 rather
        than a meaningless empty result.
        """
        content_sections = [s for s in sections if s.normalized_name != "header"]
        if not content_sections:
            raise BadRequestError(
                "No content sections found. Upload and parse a DOCX first."
            )

        has_signals = (
            job_description.keywords
            or job_description.technologies
            or job_description.required_skills
        )
        if not has_signals:
            raise BadRequestError(
                "Job description contains no keywords, technologies, or skills to compare."
            )

        result = compare_resume(sections, job_description)

        logger.info(
            "Comparison complete",
            sections=len(result.sections),
            keyword_matches=len(result.keyword_matches),
            keyword_gaps=len(result.keyword_gaps),
            tech_matches=len(result.matched_technologies),
            tech_gaps=len(result.missing_technologies),
            overall_coverage=result.overall_coverage_percentage,
        )

        return result


# Module-level singleton – the service has no mutable state.
_service = ComparisonService()


def get_comparison_service() -> ComparisonService:
    """Return the shared ``ComparisonService`` instance.

    Exposed as a function so it can be used with FastAPI ``Depends`` and
    overridden in tests via ``app.dependency_overrides``.
    """
    return _service
