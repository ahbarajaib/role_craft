"""Section review schemas.

Defines the request body and the structured output model for the
unified recruiter-centric review.
"""

from enum import Enum
from pydantic import BaseModel, Field

from app.schemas.analysis import Priority
from app.schemas.comparison import SectionComparison
from app.schemas.job_description import JobDescription
from app.schemas.section import SectionItem
from app.schemas.resume_analysis import ReviewStatus, StrengthItem, ImprovementItem


# ── Request (For Standalone Endpoint compatibility) ─────────────────────────


class ReviewRequest(BaseModel):
    """Request body for POST /review-section."""

    section: SectionItem = Field(description="The resume section to review.")
    comparison: SectionComparison = Field(description="Deterministic comparison result.")
    job_description: JobDescription = Field(description="Parsed job description.")
    full_resume_text: str | None = Field(default=None, description="Full resume context.")


# ── Structured AI Output Schemas ──────────────────────────────────────────────


class SectionReviewItem(BaseModel):
    """Recruiter evaluation of an individual resume section."""

    section_name: str = Field(
        description="Name of the resume section (e.g. 'Work Experience')."
    )
    review_status: ReviewStatus = Field(
        description="Classification: 'improve' (if gaps exist & evidence exists), 'keep', or 'reduce_emphasis' (if old/less relevant)."
    )
    rewrite_worthwhile: bool = Field(
        description="True if a rewrite would materially increase callback chances."
    )
    priority: Priority = Field(
        description="Urgency of improvements: 'high', 'medium', or 'low'."
    )
    reason: str = Field(
        description="Concise recruiter rationale (1-3 sentences) explaining the status."
    )
    recommendations: list[str] = Field(
        description="Actionable section-specific recommendations (duplicates removed globally)."
    )
    strengths: list[str] = Field(
        description="Specific matching strengths identified."
    )


# Alias for backward compatibility with standalone endpoint
SectionReview = SectionReviewItem


class UnifiedReviewResult(BaseModel):
    """Structured response containing full recruiter analysis."""

    sections: list[SectionReviewItem] = Field(
        description="Recruiter reviews of each section."
    )
    top_strengths: list[StrengthItem] = Field(
        description="Exactly or up to 5 merged matching strengths."
    )
    top_improvements: list[ImprovementItem] = Field(
        description="Exactly or up to 5 prioritized high-impact improvements."
    )
