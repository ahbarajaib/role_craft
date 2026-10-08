"""Tailor API router.

POST /api/v1/tailor
    Run AI tailoring on the user's master StructuredResume for a given job description.
    Saves result as a TailoredResumeModel in DB.
    Returns tailored resume JSON + diff map for preview UI.

DELETE /api/v1/tailor/{tailored_id}
    Delete a saved tailored resume.
"""

import json

from fastapi import APIRouter, Depends
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ai.provider import OpenAIProvider
from app.api.v1.auth import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import BadRequestError, NotFoundError
from app.models import StructuredResumeModel, TailoredResumeModel, User
from app.parsers.job_description_parser import parse_job_description
from app.schemas.structured_resume import StructuredResume
from app.services.evidence_service import EvidenceService
from app.services.requirement_matcher import RequirementMatcher
from app.services.tailor_orchestration_service import TailorOrchestrationService

router = APIRouter(prefix="/tailor", tags=["AI Resume Tailor"])
settings = get_settings()


def get_ai_provider() -> OpenAIProvider:
    return OpenAIProvider(
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_MODEL,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )


class TailorRequest(BaseModel):
    job_description: str
    job_title: str
    job_company: str | None = None
    job_id: str | None = None


class TailorResponse(BaseModel):
    tailored_resume_id: int
    tailored_resume: StructuredResume
    diff: dict
    changes_count: int


@router.post("", response_model=TailorResponse)
def tailor_resume(
    request: TailorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ai_provider: OpenAIProvider = Depends(get_ai_provider),
):
    """AI-tailor the user's master resume for a specific job description.

    Reads the master StructuredResume, rewrites summary/experience/skills
    to better align with the JD, saves as a new TailoredResumeModel, and
    returns the tailored content + diff for the preview UI.

    Credit-free: AI tailoring does not consume credits. Only /analyze costs 1 credit.

    The master StructuredResume is NEVER modified.
    """
    if not request.job_description or not request.job_description.strip():
        raise BadRequestError("job_description is required.")
    if not request.job_title or not request.job_title.strip():
        raise BadRequestError("job_title is required.")

    # Load master resume
    record = db.query(StructuredResumeModel).filter(
        StructuredResumeModel.user_id == current_user.id
    ).first()
    if not record:
        raise NotFoundError(
            "No master resume found. Please upload and parse your resume first."
        )

    master_data = json.loads(record.resume_json)
    master_resume = StructuredResume.model_validate(master_data)

    # Build evidence-grounded TailoringPlan before passing to LLM
    evidence_service = EvidenceService()
    matcher = RequirementMatcher()
    parsed_jd = parse_job_description(request.job_description)
    evidence_set = evidence_service.extract(master_resume)
    tailoring_plan = matcher.match(evidence_set, parsed_jd)

    logger.info(
        "TailoringPlan built",
        safe_skills=len(tailoring_plan.safe_skills),
        forbidden_claims=len(tailoring_plan.forbidden_claims),
    )

    # Run tailor orchestration
    tailor_service = TailorOrchestrationService(ai_provider=ai_provider)
    tailored_resume, diff = tailor_service.tailor_full_resume(
        master_resume=master_resume,
        job_description=request.job_description,
        job_title=request.job_title,
        tailoring_plan=tailoring_plan,
    )

    # Update master resume JSON record in DB with tailored content
    record.resume_json = tailored_resume.model_dump_json()
    record.version += 1

    # Persist the tailored resume history record
    tailored_model = TailoredResumeModel(
        user_id=current_user.id,
        job_id=request.job_id,
        job_title=request.job_title,
        job_company=request.job_company,
        tailored_resume_json=tailored_resume.model_dump_json(),
        diff_json=json.dumps(diff),
    )
    db.add(tailored_model)
    db.commit()
    db.refresh(tailored_model)

    return TailorResponse(
        tailored_resume_id=tailored_model.id,
        tailored_resume=tailored_resume,
        diff=diff,
        changes_count=len(diff),
    )


@router.delete("/{tailored_id}")
def delete_tailored_resume(
    tailored_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a saved tailored resume."""
    record = db.query(TailoredResumeModel).filter(
        TailoredResumeModel.id == tailored_id,
        TailoredResumeModel.user_id == current_user.id,
    ).first()
    if not record:
        raise NotFoundError(f"Tailored resume {tailored_id} not found.")
    db.delete(record)
    db.commit()
    return {"status": "ok", "message": f"Tailored resume {tailored_id} deleted."}
