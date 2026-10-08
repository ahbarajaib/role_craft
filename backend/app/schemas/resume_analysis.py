"""Resume analysis workflow schemas.

Defines the request body and the response model for the full resume
analysis workflow endpoint.

``ResumeAnalysisResult`` is the primary response the frontend consumes.
It merges results from the comparison engine (deterministic) and the AI
reviewer into one flat, easy-to-render structure.
"""

from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

from app.schemas.analysis import Priority


class ReviewStatus(StrEnum):
    """Classification of the review action needed for a section."""

    IMPROVE = "improve"
    KEEP = "keep"
    REDUCE_EMPHASIS = "reduce_emphasis"


# ── Request ───────────────────────────────────────────────────────────────────


class ResumeAnalysisRequest(BaseModel):
    """Request body for POST /resume/analyze.

    When ``document_id`` is omitted, the backend uses the user's StructuredResume
    JSON from the database (JSON-first path). This means no uploaded file is needed.
    """

    document_id: str | None = Field(
        default=None,
        description="UUID returned by POST /documents/upload. Omit to use the structured resume JSON master.",
    )
    job_description_text: str = Field(
        description="Plain text of the job description to analyse against.",
    )

    @field_validator("job_description_text")
    @classmethod
    def validate_job_description(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Job description cannot be empty or whitespace only.")
        if len(v.strip()) < 50:
            raise ValueError("Job description must be at least 50 characters long.")
        return v


# ── Section-level result ──────────────────────────────────────────────────────


class ReviewedSection(BaseModel):
    """Combined comparison + AI review result for a single resume section.

    Merges the deterministic ``SectionComparison`` (coverage %) with the
    AI-generated ``SectionReview`` (recommendations, strengths, reason).
    Keeping them together simplifies frontend rendering.
    """

    section_name: str = Field(description="Canonical name of the section.")
    review_status: ReviewStatus = Field(
        description="Recruiter classification of action required for this section."
    )
    rewrite_worthwhile: bool = Field(
        description="True when a targeted rewrite would materially improve this section."
    )
    priority: Priority = Field(description="Urgency relative to other sections.")
    reason: str = Field(description="Concise AI explanation of the review outcome.")
    recommendations: list[str] = Field(
        description="Actionable suggestions that respect existing resume content."
    )
    evidence_used: list[str] = Field(
        description="Specific facts or sections elsewhere in the resume supporting recommendations."
    )
    missing_keywords: list[str] = Field(
        description="JD keywords absent from this section."
    )
    strengths: list[str] = Field(
        description="Specific strengths of this section for this role."
    )
    coverage_percentage: float = Field(
        description="Percentage of JD keywords + technologies covered by this section."
    )
    recruiter_impact: str = Field(
        description="Recruiter-oriented explanation of the modification's impact."
    )
    ats_impact: str = Field(
        description="ATS-oriented explanation of the modification's impact."
    )


# ── Overall summary items ─────────────────────────────────────────────────────


class StrengthItem(BaseModel):
    """A specific matching strength of the candidate."""

    name: str = Field(description="The strength name (e.g. 'React Native').")
    category: str = Field(
        description="Type of strength: 'technology', 'skill', 'concept', or 'responsibility'."
    )
    reason: str = Field(description="Brief recruiter context explaining why this matches.")


class ImprovementItem(BaseModel):
    """A highly prioritized improvement area recommended by a senior recruiter."""

    name: str = Field(description="The name of the improvement or gap (e.g. 'TypeScript').")
    priority: int = Field(description="Priority rank from 1 (highest) to 5 (lowest).")
    section: str = Field(
        description="Name of the resume section where this change has the highest impact (e.g. 'Professional Experience')."
    )
    reason: str = Field(description="Hiring manager-style reason why this change is recommended.")
    expected_interview_impact: str = Field(
        description="Hiring manager explanation of how this change increases interview callback rates."
    )
    evidence_reused: str = Field(
        description="Supporting evidence found in other sections of the resume, oradjacent technologies already demonstrated."
    )
    confidence: float = Field(
        description="Confidence score from 0.0 to 1.0 indicating how strongly evidence supports this recommendation."
    )


# ── Overall summary ───────────────────────────────────────────────────────────


class OverallSummary(BaseModel):
    """Top-level metrics across the full resume."""

    overall_coverage_percentage: float = Field(
        description=(
            "Percentage of all JD signals (keywords + technologies + "
            "required skills) found anywhere in the resume."
        )
    )
    sections_reviewed: int = Field(
        description="Number of content sections reviewed (header excluded)."
    )
    sections_to_improve: int = Field(
        description="Number of sections with status 'improve'."
    )
    job_title: str = Field(
        description="Job title extracted from the job description."
    )


# ── Full result ───────────────────────────────────────────────────────────────


class ResumeAnalysisResult(BaseModel):
    """Primary response returned by POST /resume/analyze.

    This is the single document the frontend renders.  It contains all
    information needed to display the analysis: overall metrics, per-section
    details, skills gaps, and resume strengths.
    """

    document_id: str = Field(description="UUID of the analysed resume.")
    overall_summary: OverallSummary = Field(
        description="Top-level metrics across the full resume."
    )
    sections: list[ReviewedSection] = Field(
        description="Per-section analysis in document order."
    )
    top_strengths: list[StrengthItem] = Field(
        description="Top matching strengths, categorized and sorted."
    )
    top_improvements: list[ImprovementItem] = Field(
        description="Top 5 critical missing gaps, categorized and ranked by impact."
    )
