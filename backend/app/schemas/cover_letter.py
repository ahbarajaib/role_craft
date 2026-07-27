"""Cover letter Pydantic schemas."""

from pydantic import BaseModel, Field


class CoverLetterRequest(BaseModel):
    """Payload for generating a cover letter."""

    document_id: str = Field(..., description="Uploaded document identifier")
    job_description_text: str = Field(..., description="Raw target job description text")
    candidate_name: str | None = Field(default=None, description="Optional candidate name override")
    rewritten_sections: dict[str, str] | None = Field(
        default=None, description="Active AI rewrites to align cover letter with tailored resume"
    )


class CoverLetterResponse(BaseModel):
    """Response containing generated cover letter text and download ID."""

    download_id: str = Field(..., description="UUID identifier to download DOCX or PDF version")
    cover_letter_text: str = Field(..., description="Generated cover letter text paragraphs")
    candidate_name: str = Field(..., description="Extracted or provided candidate name")
    target_role: str = Field(..., description="Target role name")


class UpdateCoverLetterRequest(BaseModel):
    """Payload for updating cover letter text before download."""

    cover_letter_text: str = Field(..., description="Updated cover letter text content")
