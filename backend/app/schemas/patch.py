"""DOCX patch schemas.

Defines Pydantic models for request validation and response formatting
for the DOCX patch and download endpoints.
"""

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

    document_id: str = Field(
        description="UUID of the original uploaded resume document."
    )
    accepted_rewrites: list[ApplyRewriteItem] = Field(
        description="List of user-accepted section rewrites."
    )

    @field_validator("document_id")
    @classmethod
    def validate_document_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("document_id cannot be empty or whitespace only.")
        return v.strip()

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
