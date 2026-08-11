"""Section rewrite schemas.

Defines Pydantic models for request validation and structured response format
for the individual section rewrite endpoint.
"""

from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator


class RewriteChangeType(str, Enum):
    """Classification of a modification made by the AI."""

    KEYWORD = "keyword"
    CLARITY = "clarity"
    STRUCTURE = "structure"
    EMPHASIS = "emphasis"


class RewriteChangeItem(BaseModel):
    """Detail of a single change made during rewrite."""

    type: RewriteChangeType = Field(
        description="The category of edit: keyword injection, wording clarity, formatting structure, or target emphasis."
    )
    description: str = Field(
        description="Recruiter rationale explaining the modification."
    )


class RewriteSectionRequest(BaseModel):
    """Request body for POST /resume/rewrite."""

    document_id: Optional[str] = Field(
        default=None,
        description="UUID of the uploaded resume document. If omitted, section_content must be provided (JSON-first mode)."
    )
    section_name: str = Field(
        description="Canonical or title name of the section to rewrite (e.g. 'summary')."
    )
    section_type: Optional[str] = Field(
        default=None,
        description="Section type for JSON-first mode: 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'certifications' | 'custom'"
    )
    section_content: Optional[dict[str, Any]] = Field(
        default=None,
        description="Section content dict from StructuredResume JSON. Used in JSON-first mode when document_id is not provided."
    )
    evidence_text: Optional[str] = Field(
        default=None,
        description="Plain-text representation of the full resume for evidence gating. Used in JSON-first mode."
    )
    job_description_text: str = Field(
        description="Plain text of the target job description."
    )
    recommendations: list[str] = Field(
        default=[],
        description="Actionable recommendations generated during analysis for this section."
    )
    user_instructions: str | None = Field(
        default=None,
        description="Optional additional instructions from the candidate (e.g. 'make it shorter', 'use stronger verbs')."
    )
    metric_inputs: dict[str, str] | None = Field(
        default=None,
        description="Optional candidate-provided metrics to format into Google XYZ bullets."
    )

    @field_validator("section_name")
    @classmethod
    def validate_section_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("section_name cannot be empty or whitespace only.")
        return v.strip()

    @field_validator("job_description_text")
    @classmethod
    def validate_job_description(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Job description cannot be empty or whitespace only.")
        if len(v.strip()) < 50:
            raise ValueError("Job description must be at least 50 characters long.")
        return v


class RewriteSectionResponse(BaseModel):
    """Structured response returned by POST /resume/rewrite."""

    section: str = Field(
        description="Name of the section that was rewritten."
    )
    original_text: str = Field(
        description="The original text of the section prior to editing."
    )
    rewritten_text: str = Field(
        description="The rewritten plain text of ONLY the specified section."
    )
    reasoning: str = Field(
        description="Hiring manager explanation for how this rewrite improves interview odds."
    )
    changes: list[RewriteChangeItem] = Field(
        description="Categorized changes explaining keyword insertions or wording refinements."
    )
