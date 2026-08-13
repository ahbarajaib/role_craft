"""Section and unified review services.

Coordinates calls to the OpenAI Responses API for individual section reviews
and full recruiter-centric resume reviews.
"""

from loguru import logger

from app.ai.provider import OpenAIProvider
from app.ai.review_prompts import REVIEW_INSTRUCTIONS, build_review_input
from app.core.exceptions import BadRequestError
from app.schemas.comparison import ComparisonResult, SectionComparison
from app.schemas.job_description import JobDescription
from app.schemas.review import SectionReview, UnifiedReviewResult
from app.schemas.section import SectionItem


class ReviewService:
    """Runs AI reviews on resumes.

    Exposes two review methods:
    1. Standalone section review (post-compatibility, section by section).
    2. Recruiter-centric unified review (evaluates the entire document at once).
    """

    def __init__(self, provider: OpenAIProvider) -> None:
        self._provider = provider

    def review_resume(
        self,
        sections: list[SectionItem],
        comparison: ComparisonResult,
        job_description: JobDescription,
    ) -> UnifiedReviewResult:
        """Review the entire resume as one document and return consolidated matching details."""
        input_text = build_review_input(
            sections=sections,
            comparison=comparison,
            job_description=job_description,
        )

        result = self._provider.parse_response(
            instructions=REVIEW_INSTRUCTIONS,
            input_text=input_text,
            response_format=UnifiedReviewResult,
            max_output_tokens=800,
        )

        logger.info(
            "Recruiter unified review complete",
            sections_reviewed=len(result.sections),
            top_strengths=len(result.top_strengths),
            top_improvements=len(result.top_improvements),
        )

        return result

    def review_section(
        self,
        section: SectionItem,
        comparison: SectionComparison,
        job_description: JobDescription,
        full_resume_text: str | None = None,
    ) -> SectionReview:
        """Review one resume section against the job description (standalone fallback)."""
        content = _extract_content_text(section)
        if not content.strip():
            raise BadRequestError(
                f"Section '{section.title}' contains no reviewable text."
            )

        # For standalone single-section review, we reuse the instructions for a single item.
        # Fallback to the same unified schema formatting but parsing a single item.
        from app.ai.review_prompts import build_review_input as build_single_input
        input_text = build_single_input([section], ComparisonResult(
            sections=[comparison],
            matched_skills=[],
            missing_skills=[],
            matched_technologies=[],
            missing_technologies=[],
            keyword_matches=[],
            keyword_gaps=[],
            overall_coverage_percentage=comparison.coverage_percentage
        ), job_description)

        # Parse directly as SectionReview
        result = self._provider.parse_response(
            instructions=REVIEW_INSTRUCTIONS,
            input_text=input_text,
            response_format=SectionReview,
        )

        return result


def _extract_content_text(section: SectionItem) -> str:
    """Return the body text of a section, excluding the heading paragraph."""
    body_paras = [
        p.text
        for p in section.paragraphs
        if p.text.strip().lower() != section.title.strip().lower()
    ]
    return " ".join(body_paras)
