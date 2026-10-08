"""Comparison result schemas.

Defines the request body and the structured output models for the compare
endpoint.  Kept separate from schemas for sections and job descriptions so
each schema file stays focused on a single concern.
"""

from pydantic import BaseModel, Field

from app.schemas.job_description import JobDescription
from app.schemas.section import SectionItem

# ── Request ───────────────────────────────────────────────────────────────────


class CompareRequest(BaseModel):
    """Request body for POST /compare.

    Accepts already-parsed data so the endpoint stays stateless and easy
    to call without coordinating multiple other endpoints.
    """

    sections: list[SectionItem] = Field(
        description="Resume sections returned by GET /documents/{id}/sections.",
    )
    job_description: JobDescription = Field(
        description="Structured job description returned by POST /job-descriptions/parse.",
    )


# ── Per-section result ────────────────────────────────────────────────────────


class SectionComparison(BaseModel):
    """Comparison result for a single resume section."""

    section_name: str = Field(
        description="Canonical name of the section (e.g. 'experience', 'skills')."
    )
    matched_keywords: list[str] = Field(
        description="JD keywords found in this section."
    )
    missing_keywords: list[str] = Field(
        description="JD keywords absent from this section."
    )
    matched_technologies: list[str] = Field(
        description="JD technologies found in this section."
    )
    missing_technologies: list[str] = Field(
        description="JD technologies absent from this section."
    )
    coverage_percentage: float = Field(
        description=(
            "Percentage of JD keywords + technologies covered by this section. "
            "Rounded to one decimal place."
        )
    )


# ── Overall result ────────────────────────────────────────────────────────────


class ComparisonResult(BaseModel):
    """Full comparison result: per-section breakdown and overall totals."""

    sections: list[SectionComparison] = Field(
        description="Per-section comparison results in document order."
    )

    # Overall aggregates across the full resume
    matched_skills: list[str] = Field(
        description="Required skills from the JD found anywhere in the resume."
    )
    missing_skills: list[str] = Field(
        description="Required skills from the JD absent from the entire resume."
    )
    matched_technologies: list[str] = Field(
        description="JD technologies found anywhere in the resume."
    )
    missing_technologies: list[str] = Field(
        description="JD technologies absent from the entire resume."
    )
    keyword_matches: list[str] = Field(
        description="JD keywords found anywhere in the resume."
    )
    keyword_gaps: list[str] = Field(
        description="JD keywords absent from the entire resume."
    )
    overall_coverage_percentage: float = Field(
        description=(
            "Percentage of all JD signals (keywords + technologies + required skills) "
            "covered by the resume. Rounded to one decimal place."
        )
    )
