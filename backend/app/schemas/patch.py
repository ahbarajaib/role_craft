"""DOCX patch schemas.

Defines Pydantic models for request validation and response formatting
for the DOCX patch and download endpoints.
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator


class ApplyRewriteItem(BaseModel):
    """A single accepted rewrite for a resume section."""

    section: str = Field(
        description="Canonical or title name of the section (e.g. 'summary')."
    )
    rewritten_text: str = Field(
        description="The final accepted plain text of the section body."
    )

    @field_validator("section", "rewritten_text")
    @classmethod
    def validate_non_empty_fields(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or whitespace only.")
        return v.strip()


class ApplyRewriteRequest(BaseModel):
    """Request body for applying accepted section rewrites to a resume."""

    document_id: Optional[str] = Field(
        default=None,
        description="UUID of the original uploaded resume document. If omitted, an ATS template is generated from the structured JSON master resume."
    )
    accepted_rewrites: list[ApplyRewriteItem] = Field(
        description="List of user-accepted section rewrites."
    )
    preferred_template: Optional[str] = Field(
        default="clean_classic",
        description="ATS template to use for JSON-mode generation: 'clean_classic' | 'modern_professional' | 'executive_profile'"
    )

    @field_validator("accepted_rewrites")
    @classmethod
    def validate_accepted_rewrites(cls, v: list[ApplyRewriteItem]) -> list[ApplyRewriteItem]:
        if not v:
            raise ValueError("accepted_rewrites list cannot be empty.")
        return v


class ApplyRewriteResponse(BaseModel):
    """Structured response returned after applying rewrites to a resume."""

    download_id: str = Field(
        description="UUID identifying the generated patched file."
    )
    sections_updated: int = Field(
        description="Count of sections that were successfully patched."
    )
    download_url: str = Field(
        description="REST API URL to download the patched file."
    )
