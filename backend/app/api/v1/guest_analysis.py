"""Guest (unauthenticated) resume analysis endpoint.

Exposes one endpoint:

    POST /resume/analyze-guest
        Accept plain resume text and a job description.
        Return the same ResumeAnalysisResult shape as /resume/analyze.
        No auth required. No data stored. IP-rate-limited.

This endpoint enables the freemium try-before-sign-in flow:
- The frontend extracts plain text from the DOCX client-side via mammoth.js.
- The original DOCX binary stays in browser memory (intact for later patching).
- After the user signs in, the DOCX is uploaded normally and patching runs on
  the original document — preserving all fonts, margins, and layout.
"""

import time
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from app.dependencies.resume_analysis import get_resume_analysis_workflow
from app.schemas.section import SectionItem, SectionParagraph
from app.schemas.resume_analysis import ResumeAnalysisResult
from app.services.resume_analysis_workflow import ResumeAnalysisWorkflow

router = APIRouter(prefix="/resume", tags=["resume"])

# ── Simple in-memory IP rate limiter (3 requests per hour per IP) ─────────────

_RATE_LIMIT_MAX = 3
_RATE_LIMIT_WINDOW_SECONDS = 3600  # 1 hour

_ip_buckets: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    window_start = now - _RATE_LIMIT_WINDOW_SECONDS
    # Evict timestamps outside the window
    _ip_buckets[ip] = [t for t in _ip_buckets[ip] if t > window_start]
    if len(_ip_buckets[ip]) >= _RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Guest analysis limit reached ({_RATE_LIMIT_MAX} per hour). "
                "Sign in to RoleCraft for unlimited analyses."
            ),
        )
    _ip_buckets[ip].append(now)


# ── Request schema ─────────────────────────────────────────────────────────────


class GuestAnalysisRequest(BaseModel):
    """Request body for POST /resume/analyze-guest.

    resume_text is the raw plain-text content extracted client-side from the
    user's DOCX via mammoth.js. The original DOCX binary is NOT sent — it stays
    in the browser until the user signs in and we upload it for real patching.
    """

    resume_text: str = Field(
        description="Plain text of the resume extracted client-side from the DOCX."
    )
    job_description: str = Field(
        description="Plain text of the target job description."
    )

    @field_validator("resume_text")
    @classmethod
    def validate_resume_text(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Resume text cannot be empty.")
        if len(v.strip()) < 100:
            raise ValueError("Resume text is too short (minimum 100 characters).")
        return v

    @field_validator("job_description")
    @classmethod
    def validate_job_description(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Job description cannot be empty or whitespace only.")
        if len(v.strip()) < 50:
            raise ValueError("Job description must be at least 50 characters long.")
        return v


# ── Helpers ────────────────────────────────────────────────────────────────────


def _text_to_sections(resume_text: str) -> list[SectionItem]:
    """Convert plain resume text into a minimal list of SectionItem objects.

    The text is split on double newlines to approximate section boundaries.
    Each block becomes a SectionItem with synthetic paragraph indexes.
    This is enough for the comparison + AI review pipeline to work correctly.
    """
    blocks = [b.strip() for b in resume_text.split("\n\n") if b.strip()]
    sections: list[SectionItem] = []
    para_idx = 0

    for block in blocks:
        lines = [line for line in block.split("\n") if line.strip()]
        if not lines:
            continue

        title = lines[0].strip()
        normalized = title.lower().strip()

        paragraphs: list[SectionParagraph] = []
        para_indexes: list[int] = []
        for line in lines:
            paragraphs.append(
                SectionParagraph(index=para_idx, text=line.strip(), style_name="Normal")
            )
            para_indexes.append(para_idx)
            para_idx += 1

        sections.append(
            SectionItem(
                title=title,
                normalized_name=normalized,
                paragraph_indexes=para_indexes,
                paragraphs=paragraphs,
            )
        )

    return sections


# ── Endpoint ───────────────────────────────────────────────────────────────────


@router.post(
    "/analyze-guest",
    response_model=ResumeAnalysisResult,
    summary="Guest (unauthenticated) resume analysis",
    description=(
        "Accepts plain resume text (extracted client-side from DOCX via mammoth.js) "
        "and a job description. Returns the same analysis result as /resume/analyze "
        "without requiring authentication. The original DOCX binary stays in the browser "
        "and is uploaded after sign-in so patching always runs on the real document. "
        "Rate-limited to 3 requests per IP per hour."
    ),
)
def analyze_resume_guest(
    body: GuestAnalysisRequest,
    request: Request,
    workflow: Annotated[ResumeAnalysisWorkflow, Depends(get_resume_analysis_workflow)],
) -> ResumeAnalysisResult:
    """Run the full analysis pipeline on plain text without authentication."""

    # IP rate-limiting
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    # Convert plain text → SectionItems → run pipeline
    sections = _text_to_sections(body.resume_text)

    result = workflow._run_pipeline(
        sections=sections,
        document_id="guest",
        job_description_text=body.job_description,
    )

    # Always return "guest" as document_id — frontend knows this means no real upload yet
    return ResumeAnalysisResult(
        document_id="guest",
        overall_summary=result.overall_summary,
        sections=result.sections,
        top_strengths=result.top_strengths,
        top_improvements=result.top_improvements,
    )
