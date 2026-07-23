"""Job description Pydantic schemas.

Defines the request body and the structured output model for the job
description parse endpoint.  Keeping schemas separate from the parser
means the parser module has no HTTP dependency.
"""

from pydantic import BaseModel, Field


class JobDescriptionRequest(BaseModel):
    """Request body for the parse endpoint."""

    text: str = Field(
        description="Plain text of the job description.",
        min_length=1,
    )


class JobDescription(BaseModel):
    """Structured representation of a parsed job description.

    Fields are left as empty strings / empty lists when the parser cannot
    find the relevant information rather than using None, so callers
    always receive the same shape regardless of how complete the input is.
    """

    title: str = Field(description="Job title extracted from the description.")
    company: str = Field(description="Company name, if present.")
    location: str = Field(description="Location or remote status, if present.")
    employment_type: str = Field(
        description="Employment type, e.g. Full-time, Contract, Part-time."
    )
    experience_required: str = Field(
        description="Years or level of experience required, if stated."
    )
    responsibilities: list[str] = Field(
        description="List of job responsibilities or duties."
    )
    required_skills: list[str] = Field(
        description="Skills explicitly listed as required or mandatory."
    )
    preferred_skills: list[str] = Field(
        description="Skills listed as preferred, nice-to-have, or bonus."
    )
    technologies: list[str] = Field(
        description="Technologies, tools, and frameworks mentioned in the text."
    )
    keywords: list[str] = Field(
        description="Important nouns and repeated technical terms."
    )
    raw_text: str = Field(default="", description="Original unparsed text.")

class FetchUrlRequest(BaseModel):
    url: str = Field(..., description="Job posting URL")

class FetchUrlResponse(BaseModel):
    success: bool
    url: str
    domain: str
    job_title: str = ""
    company_name: str = ""
    job_description: str = ""
    char_count: int = 0
    error_message: str = ""
