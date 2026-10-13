"""Section rewrite schemas.

Defines Pydantic models for request validation and structured response format
for the individual section rewrite endpoint.
"""

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class RewriteChangeType(StrEnum):
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

    document_id: str | None = Field(
        default=None,
        description="UUID of the uploaded resume document. If omitted, section_content must be provided (JSON-first mode)."
    )
    section_name: str = Field(
        description="Canonical or title name of the section to rewrite (e.g. 'summary')."
    )
    section_type: str | None = Field(
        default=None,
        description="Section type for JSON-first mode: 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'certifications' | 'custom'"
    )
    section_content: dict[str, Any] | None = Field(
        default=None,
        description="Section content dict from StructuredResume JSON. Used in JSON-first mode when document_id is not provided."
    )
    evidence_text: str | None = Field(
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
    positioning_mode: str | None = Field(
        default=None,
        description="Optional role positioning mode for professional summary: 'team_lead_transition' | 'hands_on_tech_lead' | 'tech_project_manager' | 'senior_ic' | 'default'."
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


class BatchRewriteItemRequest(BaseModel):
    """Detail for a single section to rewrite in a batch payload."""

    section_name: str
    section_type: str | None = None
    section_content: Any | None = None
    recommendations: list[str] = Field(default=[])
    positioning_mode: str | None = None


class BatchRewriteRequest(BaseModel):
    """Request body for POST /resume/batch-rewrite."""

    document_id: str | None = None
    job_description_text: str
    sections: list[BatchRewriteItemRequest]
    user_instructions: str | None = None
    metric_inputs: dict[str, str] | None = None
    positioning_mode: str | None = None


class BatchRewriteResponse(BaseModel):
    """Structured response returned by POST /resume/batch-rewrite."""

    rewrites: dict[str, str] = Field(
        description="Dictionary mapping section names to their rewritten text."
    )
    download_id: str | None = Field(
        default=None,
        description="Generated DOCX download ID if patching was applied."
    )
    download_url: str | None = Field(
        default=None,
        description="Download URL for the patched DOCX file."
    )


class AutoTailorRequest(BaseModel):
    """Request body for unified 1-Click Auto Everything POST /resume/auto-tailor."""

    document_id: str | None = None
    job_description_text: str
    target_role: str | None = None
    user_instructions: str | None = None
    section_toggles: dict[str, bool] | None = None


class AutoTailorResponse(BaseModel):
    """Unified response containing both analysis, rewrites, and download info."""

    analysis: Any
    rewrites: dict[str, str] = Field(
        default_factory=dict,
        description="Dictionary mapping section names to their rewritten text."
    )
    download_id: str | None = Field(
        default=None,
        description="Generated DOCX download ID if patching was applied."
    )
    download_url: str | None = Field(
        default=None,
        description="Download URL for the patched DOCX file."
    )
    target_role: str | None = Field(
        default=None,
        description="Final targeted job title."
    )
    sections_tailored: int = 0

