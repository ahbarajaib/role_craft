"""Analysis schemas.

Defines the request body and response models for the resume analysis
endpoint.  These sit at the HTTP boundary and are separate from the AI
layer's internal types so that the route stays thin and the AI layer
stays independent from FastAPI.
"""

from enum import StrEnum

from pydantic import BaseModel, Field

from app.schemas.job_description import JobDescription
from app.schemas.section import SectionItem

# ── Request ───────────────────────────────────────────────────────────────────


class AnalysisRequest(BaseModel):
    """Request body for POST /analyze.

    The client supplies already-parsed data so the analysis endpoint
    does not need to re-upload or re-parse the DOCX.  This keeps the
    endpoint stateless and easy to test.
    """

    sections: list[SectionItem] = Field(
        description="Resume sections returned by GET /documents/{id}/sections.",
    )
    job_description: JobDescription = Field(
        description="Structured job description returned by POST /job-descriptions/parse.",
    )


# ── Response ──────────────────────────────────────────────────────────────────


class Priority(StrEnum):
    """Urgency of the recommended change for this section."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class SectionAnalysis(BaseModel):
    """AI analysis result for a single resume section.

    The Pydantic model is passed directly to the OpenAI Responses API as
    the ``text_format`` argument, so field names and types must be simple
    enough for the model to produce reliably (no complex nesting).
    """

    section_name: str = Field(
        description="Name of the resume section being analysed."
    )
    needs_changes: bool = Field(
        description="True when the section has meaningful gaps relative to the job description."
    )
    priority: Priority = Field(
        description="How urgently the section should be improved."
    )
    reason: str = Field(
        description="Concise explanation of why changes are or are not needed."
    )
    missing_keywords: list[str] = Field(
        description="Keywords from the job description absent from this section."
    )


class ResumeAnalysisResponse(BaseModel):
    """Structured output returned by the OpenAI Responses API.

    Wrapping the list in a container model is required because the
    Responses API ``text_format`` parameter expects a single root object,
    not a bare list.
    """

    sections: list[SectionAnalysis] = Field(
        description="Analysis of each resume section in order."
    )
