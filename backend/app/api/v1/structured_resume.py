"""Structured Resume API router.

Provides endpoints to parse DOCX/PDF resumes into structured JSON,
manage structured resume state in SQLite DB, handle profile photo uploads,
and stream generated DOCX/PDF template files.
"""

import json
import shutil
from io import BytesIO
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, Depends, File, Form, UploadFile, Query
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import BadRequestError, NotFoundError
from app.models import User, StructuredResumeModel, TailoredResumeModel
from app.schemas.structured_resume import StructuredResume
from app.services.resume_parser_service import ResumeParserService
from app.services.template_renderer import ATSTemplateRenderer
from app.services.pdf_service import PDFService
from app.ai.provider import OpenAIProvider
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/structured-resume", tags=["Structured Resume Builder"])
settings = get_settings()


def get_ai_provider() -> OpenAIProvider:
    return OpenAIProvider(
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_MODEL,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )


def get_parser_service(ai_provider: OpenAIProvider = Depends(get_ai_provider)) -> ResumeParserService:
    return ResumeParserService(ai_provider=ai_provider)


@router.post("/parse", response_model=StructuredResume)
async def parse_and_save_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    parser_service: ResumeParserService = Depends(get_parser_service),
):
    """Upload a DOCX or PDF resume, parse with AI, and save to DB for current user."""
    if not file.filename:
        raise BadRequestError("Filename cannot be empty.")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".docx", ".pdf"):
        raise BadRequestError("Only .docx and .pdf files are accepted for resume parsing.")

    upload_dir = Path(settings.UPLOAD_DIR) / "builder"
    upload_dir.mkdir(parents=True, exist_ok=True)

    temp_path = upload_dir / f"{current_user.id}_{file.filename}"
    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    # Permanently store the original DOCX before it's deleted (used for content injection export)
    original_docx_path: Optional[str] = None
    if ext == ".docx":
        originals_dir = Path(settings.UPLOAD_DIR) / "originals"
        originals_dir.mkdir(parents=True, exist_ok=True)
        dest = originals_dir / f"user_{current_user.id}_original.docx"
        if dest.exists():
            dest.unlink()  # re-upload overwrites old original
        shutil.copy2(temp_path, dest)
        original_docx_path = str(dest)

    try:
        structured_resume = parser_service.parse_document(temp_path, file.filename)
    finally:
        if temp_path.exists():
            temp_path.unlink()

    # Save or update user's structured resume in DB
    existing = db.query(StructuredResumeModel).filter(StructuredResumeModel.user_id == current_user.id).first()
    resume_json_str = structured_resume.model_dump_json()

    if existing:
        existing.resume_json = resume_json_str
        existing.source_format = structured_resume.source_format
        existing.preferred_template = structured_resume.preferred_template
        existing.original_docx_path = original_docx_path
        existing.version += 1
    else:
        new_record = StructuredResumeModel(
            user_id=current_user.id,
            resume_json=resume_json_str,
            source_format=structured_resume.source_format,
            preferred_template=structured_resume.preferred_template,
            original_docx_path=original_docx_path,
        )
        db.add(new_record)

    db.commit()
    return structured_resume


@router.get("", response_model=Optional[StructuredResume])
def get_structured_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get saved structured resume for current user."""
    record = db.query(StructuredResumeModel).filter(StructuredResumeModel.user_id == current_user.id).first()
    if not record:
        return None

    try:
        data = json.loads(record.resume_json)
        res = StructuredResume.model_validate(data)
        if record.profile_photo_path:
            res.profile_photo_url = f"/api/v1/structured-resume/photo/{current_user.id}"
        return res
    except Exception as exc:
        raise BadRequestError(f"Corrupted resume data in database: {str(exc)}")


def _clean_low_confidence_fields(resume: StructuredResume) -> StructuredResume:
    if not resume.parse_confidence:
        return resume
    raw_fields = resume.parse_confidence.low_confidence_fields or []
    cleaned_fields = []
    ci = resume.contact_info
    for f in raw_fields:
        f_lower = f.lower()
        if "full_name" in f_lower and ci and ci.full_name and ci.full_name.strip():
            continue
        if "email" in f_lower and ci and ci.email and ci.email.strip():
            continue
        if "phone" in f_lower and ci and ci.phone and ci.phone.strip():
            continue
        if "location" in f_lower and ci and ci.location and ci.location.strip():
            continue
        if "linkedin" in f_lower and ci and ci.linkedin_url and ci.linkedin_url.strip():
            continue
        if "portfolio" in f_lower and ci and ci.portfolio_url and ci.portfolio_url.strip():
            continue
        if "github" in f_lower and ci and ci.github_url and ci.github_url.strip():
            continue
        if "job_title" in f_lower and ("contact" in f_lower or "section" not in f_lower) and ci and ci.job_title and ci.job_title.strip():
            continue
        if "summary" in f_lower and resume.summary and resume.summary.strip():
            continue
        cleaned_fields.append(f)

    resume.parse_confidence.low_confidence_fields = cleaned_fields
    if not cleaned_fields:
        resume.parse_confidence.needs_user_review = False
        resume.parse_confidence.overall_score = 1.0
    return resume


@router.put("", response_model=StructuredResume)
def update_structured_resume(
    resume: StructuredResume,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full update of structured resume JSON in DB."""
    resume = _clean_low_confidence_fields(resume)
    record = db.query(StructuredResumeModel).filter(StructuredResumeModel.user_id == current_user.id).first()
    resume_json_str = resume.model_dump_json()

    if record:
        record.resume_json = resume_json_str
        if resume.preferred_template:
            record.preferred_template = resume.preferred_template
        record.version += 1
    else:
        record = StructuredResumeModel(
            user_id=current_user.id,
            resume_json=resume_json_str,
            source_format=resume.source_format or "manual",
            preferred_template=resume.preferred_template or "clean_classic",
        )
        db.add(record)

    db.commit()
    return resume


@router.post("/photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload profile photo for template 3 (Executive Profile)."""
    if not file.filename:
        raise BadRequestError("Filename cannot be empty.")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp"):
        raise BadRequestError("Only image files (.png, .jpg, .jpeg, .webp) are allowed.")

    photos_dir = Path(settings.UPLOAD_DIR) / "photos"
    photos_dir.mkdir(parents=True, exist_ok=True)

    photo_path = photos_dir / f"user_{current_user.id}{ext}"
    content = await file.read()
    with open(photo_path, "wb") as f:
        f.write(content)

    record = db.query(StructuredResumeModel).filter(StructuredResumeModel.user_id == current_user.id).first()
    if record:
        record.profile_photo_path = str(photo_path)
        db.commit()

    return {"status": "ok", "photo_url": f"/api/v1/structured-resume/photo/{current_user.id}"}


@router.get("/photo/{user_id}")
def serve_profile_photo(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Serve user's uploaded profile photo image."""
    record = db.query(StructuredResumeModel).filter(StructuredResumeModel.user_id == user_id).first()
    if not record or not record.profile_photo_path:
        raise NotFoundError("Profile photo not found.")

    p = Path(record.profile_photo_path)
    if not p.exists():
        raise NotFoundError("Profile photo file missing on server.")

    return FileResponse(path=p, media_type="image/png")


@router.delete("/photo")
def delete_profile_photo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete user's uploaded profile photo."""
    record = db.query(StructuredResumeModel).filter(StructuredResumeModel.user_id == current_user.id).first()
    if record and record.profile_photo_path:
        p = Path(record.profile_photo_path)
        if p.exists():
            p.unlink()
        record.profile_photo_path = None
        db.commit()

    return {"status": "ok", "message": "Profile photo removed."}


@router.get("/generate/{template}/docx")
def generate_resume_docx(
    template: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and stream DOCX file for specified template ('clean_classic', 'modern_professional', 'executive_profile')."""
    record = db.query(StructuredResumeModel).filter(StructuredResumeModel.user_id == current_user.id).first()
    if not record:
        raise NotFoundError("No structured resume found. Please create or parse a resume first.")

    data = json.loads(record.resume_json)
    resume = StructuredResume.model_validate(data)

    photo_path = Path(record.profile_photo_path) if record.profile_photo_path else None
    renderer = ATSTemplateRenderer()

    out_dir = Path(settings.UPLOAD_DIR) / "builder_generated"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_docx = out_dir / f"resume_{current_user.id}_{template}.docx"

    renderer.render_docx(
        resume=resume,
        output_path=out_docx,
        template_name=template,
        profile_photo_abs_path=photo_path,
    )

    filename = f"{resume.contact_info.full_name or 'Resume'} - {template.replace('_', ' ').title()}.docx"
    return FileResponse(
        path=out_docx,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/generate/{template}/pdf")
def generate_resume_pdf(
    template: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and stream high-fidelity PDF file for specified template."""
    record = db.query(StructuredResumeModel).filter(StructuredResumeModel.user_id == current_user.id).first()
    if not record:
        raise NotFoundError("No structured resume found. Please create or parse a resume first.")

    data = json.loads(record.resume_json)
    resume = StructuredResume.model_validate(data)

    photo_path = Path(record.profile_photo_path) if record.profile_photo_path else None
    renderer = ATSTemplateRenderer()

    out_dir = Path(settings.UPLOAD_DIR) / "builder_generated"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_docx = out_dir / f"resume_{current_user.id}_{template}.docx"
    out_pdf = out_dir / f"resume_{current_user.id}_{template}.pdf"

    renderer.render_docx(
        resume=resume,
        output_path=out_docx,
        template_name=template,
        profile_photo_abs_path=photo_path,
    )

    pdf_service = PDFService(upload_dir=Path(settings.UPLOAD_DIR))
    pdf_service.convert_docx_to_pdf(out_docx, out_pdf)

    filename = f"{resume.contact_info.full_name or 'Resume'} - {template.replace('_', ' ').title()}.pdf"
    return FileResponse(
        path=out_pdf,
        filename=filename,
        media_type="application/pdf",
    )


# ---------------------------------------------------------------------------
# Export with original design (content injection into uploaded DOCX)
# ---------------------------------------------------------------------------

class ExportOriginalRequest(BaseModel):
    tailored_resume_id: Optional[int] = None  # None = export master StructuredResume


@router.post("/export-original")
def export_original_design(
    request: ExportOriginalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export resume using the user's original uploaded DOCX design with current content injected.

    If tailored_resume_id is provided, the AI-tailored content is used instead of master.
    Requires the user to have uploaded a DOCX file (not available for PDF uploads).
    """
    record = db.query(StructuredResumeModel).filter(StructuredResumeModel.user_id == current_user.id).first()
    if not record:
        raise NotFoundError("No structured resume found.")

    if not record.original_docx_path or not Path(record.original_docx_path).exists():
        raise BadRequestError(
            "Original DOCX design not available. "
            "Please re-upload your resume as a .docx file to enable this export option."
        )

    # Determine which resume content to use
    if request.tailored_resume_id is not None:
        tailored = db.query(TailoredResumeModel).filter(
            TailoredResumeModel.id == request.tailored_resume_id,
            TailoredResumeModel.user_id == current_user.id,
        ).first()
        if not tailored:
            raise NotFoundError(f"Tailored resume {request.tailored_resume_id} not found.")
        resume_data = json.loads(tailored.tailored_resume_json)
        label = f"{tailored.job_company or tailored.job_title or 'Tailored'}"
    else:
        resume_data = json.loads(record.resume_json)
        label = "Master"

    resume = StructuredResume.model_validate(resume_data)

    # Use the structured-resume text service to build plain-text section content
    # and inject it into the original DOCX via the existing patch_service approach.
    # We do this by converting StructuredResume → section text strings, then
    # calling a lightweight injection that replaces text in the original doc.
    from app.services.structured_resume_injection_service import StructuredResumeInjectionService
    injection_service = StructuredResumeInjectionService(upload_dir=Path(settings.UPLOAD_DIR))

    try:
        output_bytes = injection_service.inject_into_original(
            original_docx_path=Path(record.original_docx_path),
            resume=resume,
        )
    except Exception as exc:
        raise BadRequestError(
            f"Content injection failed for this resume layout: {str(exc)}. "
            "Please use one of the ATS templates instead."
        )

    full_name = resume.contact_info.full_name or "Resume"
    filename = f"{full_name} - {label} - Original Design.docx"

    return StreamingResponse(
        BytesIO(output_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Tailored Resume endpoints
# ---------------------------------------------------------------------------

class TailoredResumeSummary(BaseModel):
    id: int
    job_title: Optional[str] = None
    job_company: Optional[str] = None
    job_id: Optional[str] = None
    created_at: str


@router.get("/tailored", response_model=List[TailoredResumeSummary])
def list_tailored_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all AI-tailored resume versions for current user (newest first)."""
    records = (
        db.query(TailoredResumeModel)
        .filter(TailoredResumeModel.user_id == current_user.id)
        .order_by(TailoredResumeModel.created_at.desc())
        .all()
    )
    return [
        TailoredResumeSummary(
            id=r.id,
            job_title=r.job_title,
            job_company=r.job_company,
            job_id=r.job_id,
            created_at=r.created_at.isoformat(),
        )
        for r in records
    ]


@router.get("/tailored/{tailored_id}", response_model=StructuredResume)
def get_tailored_resume(
    tailored_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific tailored resume by ID."""
    record = db.query(TailoredResumeModel).filter(
        TailoredResumeModel.id == tailored_id,
        TailoredResumeModel.user_id == current_user.id,
    ).first()
    if not record:
        raise NotFoundError(f"Tailored resume {tailored_id} not found.")
    data = json.loads(record.tailored_resume_json)
    return StructuredResume.model_validate(data)


@router.get("/generate/{template}/pdf-tailored/{tailored_id}")
def generate_tailored_resume_pdf(
    template: str,
    tailored_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate PDF for a tailored resume using a specified ATS template."""
    tailored = db.query(TailoredResumeModel).filter(
        TailoredResumeModel.id == tailored_id,
        TailoredResumeModel.user_id == current_user.id,
    ).first()
    if not tailored:
        raise NotFoundError(f"Tailored resume {tailored_id} not found.")

    master = db.query(StructuredResumeModel).filter(StructuredResumeModel.user_id == current_user.id).first()
    data = json.loads(tailored.tailored_resume_json)
    resume = StructuredResume.model_validate(data)

    photo_path = Path(master.profile_photo_path) if master and master.profile_photo_path else None
    renderer = ATSTemplateRenderer()

    out_dir = Path(settings.UPLOAD_DIR) / "builder_generated"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_docx = out_dir / f"tailored_{current_user.id}_{tailored_id}_{template}.docx"
    out_pdf = out_dir / f"tailored_{current_user.id}_{tailored_id}_{template}.pdf"

    renderer.render_docx(resume=resume, output_path=out_docx, template_name=template, profile_photo_abs_path=photo_path)
    pdf_service = PDFService(upload_dir=Path(settings.UPLOAD_DIR))
    pdf_service.convert_docx_to_pdf(out_docx, out_pdf)

    label = f"{tailored.job_company or tailored.job_title or 'Tailored'}"
    filename = f"{resume.contact_info.full_name or 'Resume'} - {label} - {template.replace('_', ' ').title()}.pdf"
    return FileResponse(path=out_pdf, filename=filename, media_type="application/pdf")


@router.get("/generate/{template}/docx-tailored/{tailored_id}")
def generate_tailored_resume_docx(
    template: str,
    tailored_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate DOCX for a tailored resume using a specified ATS template."""
    tailored = db.query(TailoredResumeModel).filter(
        TailoredResumeModel.id == tailored_id,
        TailoredResumeModel.user_id == current_user.id,
    ).first()
    if not tailored:
        raise NotFoundError(f"Tailored resume {tailored_id} not found.")

    master = db.query(StructuredResumeModel).filter(StructuredResumeModel.user_id == current_user.id).first()
    data = json.loads(tailored.tailored_resume_json)
    resume = StructuredResume.model_validate(data)

    photo_path = Path(master.profile_photo_path) if master and master.profile_photo_path else None
    renderer = ATSTemplateRenderer()

    out_dir = Path(settings.UPLOAD_DIR) / "builder_generated"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_docx = out_dir / f"tailored_{current_user.id}_{tailored_id}_{template}.docx"

    renderer.render_docx(resume=resume, output_path=out_docx, template_name=template, profile_photo_abs_path=photo_path)

    label = f"{tailored.job_company or tailored.job_title or 'Tailored'}"
    filename = f"{resume.contact_info.full_name or 'Resume'} - {label} - {template.replace('_', ' ').title()}.docx"
    return FileResponse(
        path=out_docx,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
