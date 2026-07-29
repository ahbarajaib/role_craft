"""Resume workflow route.

Exposes one endpoint that is the primary API used by the frontend:

    POST /resume/analyze
        Accept a document_id and raw job description text.
        Run the full analysis pipeline and return a merged result with
        overall metrics, per-section reviews, gaps, and strengths.

The handler's only responsibilities are:
1. Receive the validated request body.
2. Delegate to the workflow.
3. Return the response.
"""

from pathlib import Path
from typing import Annotated
from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import FileResponse

from app.services.cleanup import cleanup_old_files

from loguru import logger
from app.core.config import Settings
from app.core.exceptions import NotFoundError
from app.dependencies.common import get_settings
from app.dependencies.resume_analysis import get_resume_analysis_workflow, get_rewrite_service, get_patch_service, get_cover_letter_service
from app.schemas.resume_analysis import ResumeAnalysisRequest, ResumeAnalysisResult
from app.schemas.rewrite import RewriteSectionRequest, RewriteSectionResponse
from app.schemas.patch import ApplyRewriteRequest, ApplyRewriteResponse
from app.schemas.cover_letter import CoverLetterRequest, CoverLetterResponse, UpdateCoverLetterRequest
from app.services.resume_analysis_workflow import ResumeAnalysisWorkflow
from app.services.rewrite_service import RewriteService
from app.services.patch_service import PatchService
from app.services.cover_letter_service import CoverLetterService
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import User, AnalysisHistory
from app.dependencies.limits import verify_analysis_permission, verify_premium_permission, deduct_analysis_credit

router = APIRouter(prefix="/resume", tags=["resume"])


@router.post(
    "/analyze",
    response_model=ResumeAnalysisResult,
    summary="Full resume analysis workflow",
    description=(
        "Primary endpoint for the frontend. Accepts a document_id "
        "(from POST /documents/upload) and raw job description text. "
        "Runs the complete pipeline: load sections → parse JD → compare "
        "(deterministic) → AI review every section → merge results. "
        "Returns overall metrics, per-section analysis, skill gaps, "
        "and strengths. Does not rewrite anything."
    ),
)
def analyze_resume(
    body: ResumeAnalysisRequest,
    workflow: Annotated[ResumeAnalysisWorkflow, Depends(get_resume_analysis_workflow)],
    user: Annotated[User, Depends(verify_analysis_permission)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ResumeAnalysisResult:
    """Delegate the full workflow to the workflow service."""
    result = workflow.run(
        document_id=body.document_id,
        job_description_text=body.job_description_text,
    )
    deduct_analysis_credit(db, user)

    # Save to AnalysisHistory safely
    try:
        if body.document_id.startswith("base/") and getattr(user, "base_resume_filename", None):
            filename = user.base_resume_filename
        else:
            try:
                from app.services.section_service import SectionService
                sec_service = SectionService(upload_dir=Path(settings.UPLOAD_DIR))
                filename = sec_service._resolve_path(body.document_id).name
            except Exception:
                filename = "Resume.docx"

        target_role = getattr(result.overall_summary, "job_title", "Target Role") if result.overall_summary else "Target Role"
        target_company = getattr(result.overall_summary, "target_company", None) if result.overall_summary else None
        sections_need_improvement = len([s for s in (result.sections or []) if getattr(s, "review_status", None) == "improve"])
        total_sections = len(result.sections or [])

        # Correct overall score calculation from overall_coverage_percentage
        coverage_pct = getattr(result.overall_summary, "overall_coverage_percentage", 0.0) if result.overall_summary else 0.0
        overall_score = int(round(coverage_pct))

        history_entry = AnalysisHistory(
            user_id=user.id,
            document_id=body.document_id,
            filename=filename,
            target_role=target_role,
            target_company=target_company,
            overall_score=overall_score,
            sections_need_improvement=sections_need_improvement,
            total_sections=total_sections,
            analysis_result_json=result.model_dump_json(),
            job_description_text=body.job_description_text,
        )
        db.add(history_entry)
        db.commit()
    except Exception as hist_err:
        logger.error(f"Failed to auto-save AnalysisHistory: {hist_err}")

    return result


@router.post(
    "/rewrite",
    response_model=RewriteSectionResponse,
    summary="Rewrite one section of the resume using AI",
    description="Rewrite a specific section of the resume using AI while preserving truthfulness.",
    dependencies=[Depends(verify_premium_permission)],
)
def rewrite_section(
    body: RewriteSectionRequest,
    service: Annotated[RewriteService, Depends(get_rewrite_service)],
) -> RewriteSectionResponse:
    """Delegate section rewrite to RewriteService."""
    return service.rewrite(
        document_id=body.document_id,
        section_name=body.section_name,
        job_description_text=body.job_description_text,
        recommendations=body.recommendations,
        user_instructions=body.user_instructions,
        metric_inputs=body.metric_inputs,
    )


@router.post(
    "/apply",
    response_model=ApplyRewriteResponse,
    summary="Apply user-accepted rewrites to the original resume DOCX",
    description="Patches the original uploaded document with chosen rewrites and returns a download link.",
    dependencies=[Depends(verify_premium_permission)],
)
def apply_rewrites(
    body: ApplyRewriteRequest,
    service: Annotated[PatchService, Depends(get_patch_service)],
    background_tasks: BackgroundTasks,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> ApplyRewriteResponse:
    """Delegate patching operation to PatchService."""
    background_tasks.add_task(
        cleanup_old_files,
        upload_dir=Path(settings.UPLOAD_DIR),
        max_age_hours=settings.GENERATED_CLEANUP_HOURS,
    )
    res = service.apply_rewrites(body)

    # Link download_id to the latest matching history record for this document_id
    try:
        from sqlalchemy import select
        stmt = (
            select(AnalysisHistory)
            .where(AnalysisHistory.document_id == body.document_id)
            .order_by(AnalysisHistory.created_at.desc())
        )
        hist = db.scalars(stmt).first()
        if hist:
            hist.download_id = res.download_id
            db.add(hist)
            db.commit()
    except Exception:
        pass

    return res


@router.get(
    "/download/{download_id}",
    summary="Download a generated patched resume document",
    description="Streams the modified resume document as a file attachment.",
)
def download_patched_resume(
    download_id: str,
    settings: Annotated[Settings, Depends(get_settings)],
    filename: str = "resume_updated.docx",
) -> FileResponse:
    """Stream the generated patched DOCX file with the given filename."""
    file_path = Path(settings.UPLOAD_DIR) / "generated" / f"{download_id}.docx"
    if not file_path.exists():
        raise NotFoundError(f"Generated download file for ID '{download_id}' not found.")

    # Sanitise the filename — strip path separators and enforce .docx extension
    safe_name = filename.replace("/", "").replace("\\", "").strip() or "resume_updated.docx"
    if not safe_name.lower().endswith(".docx"):
        safe_name += ".docx"

    return FileResponse(
        path=file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=safe_name,
    )


@router.get(
    "/download/{download_id}/pdf",
    summary="Download or stream PDF version of the resume",
    description="Converts and streams the specified resume document as a PDF.",
)
def download_patched_resume_pdf(
    download_id: str,
    settings: Annotated[Settings, Depends(get_settings)],
    filename: str = "resume_updated.pdf",
) -> FileResponse:
    """Stream the generated resume as a PDF file."""
    from app.services.pdf_service import PDFService

    from app.utils.path_resolver import resolve_document_path
    upload_dir = Path(settings.UPLOAD_DIR)

    if download_id.startswith("base/"):
        user_id = download_id.split("/", 1)[1]
        docx_path = resolve_document_path(upload_dir, download_id)
        pdf_path = upload_dir / "base" / f"{user_id}.pdf"
    else:
        docx_path = upload_dir / "generated" / f"{download_id}.docx"
        if not docx_path.exists():
            docx_path = resolve_document_path(upload_dir, download_id)
        pdf_path = upload_dir / "generated" / f"{download_id}.pdf"

    pdf_service = PDFService(upload_dir=upload_dir)
    pdf_service.convert_docx_to_pdf(docx_path, pdf_path)

    safe_name = filename.replace("/", "").replace("\\", "").strip() or "resume_updated.pdf"
    if not safe_name.lower().endswith(".pdf"):
        safe_name = safe_name.rsplit(".", 1)[0] + ".pdf" if "." in safe_name else safe_name + ".pdf"

    headers = {
        "Content-Disposition": f'attachment; filename="{safe_name}"',
        "Access-Control-Allow-Origin": "*",
    }

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        headers=headers,
    )


# ── Cover Letter Endpoints ───────────────────────────────────────────────────


@router.post(
    "/cover-letter",
    response_model=CoverLetterResponse,
    summary="Generate a tailored cover letter using AI",
    dependencies=[Depends(verify_premium_permission)],
)
def generate_cover_letter(
    body: CoverLetterRequest,
    service: Annotated[CoverLetterService, Depends(get_cover_letter_service)],
) -> CoverLetterResponse:
    """Generate a tailored 3-paragraph cover letter based on resume & job description."""
    return service.generate_cover_letter(body)


@router.put(
    "/cover-letter/{download_id}",
    summary="Update edited cover letter text before downloading",
    dependencies=[Depends(verify_premium_permission)],
)
def update_cover_letter(
    download_id: str,
    body: UpdateCoverLetterRequest,
    service: Annotated[CoverLetterService, Depends(get_cover_letter_service)],
) -> dict[str, str]:
    """Update cover letter text and rebuild DOCX."""
    service.update_cover_letter_text(download_id, body.cover_letter_text)
    return {"status": "ok", "message": "Cover letter updated successfully"}


@router.get(
    "/download/{download_id}/cover-letter",
    summary="Download cover letter as DOCX or PDF",
)
def download_cover_letter(
    download_id: str,
    settings: Annotated[Settings, Depends(get_settings)],
    format: str = "docx",
    filename: str = "cover_letter.docx",
) -> FileResponse:
    """Download the generated cover letter file in DOCX or PDF format."""
    upload_dir = Path(settings.UPLOAD_DIR)
    docx_path = upload_dir / "generated" / f"{download_id}.docx"

    if not docx_path.exists():
        raise NotFoundError(f"Cover letter file for ID '{download_id}' not found.")

    if format.lower() == "pdf":
        from app.services.pdf_service import PDFService
        pdf_path = upload_dir / "generated" / f"{download_id}.pdf"
        pdf_service = PDFService(upload_dir=upload_dir)
        pdf_service.convert_docx_to_pdf(docx_path, pdf_path)

        safe_name = filename.rsplit(".", 1)[0] + ".pdf" if "." in filename else filename + ".pdf"
        return FileResponse(
            path=pdf_path,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}"',
                "Access-Control-Allow-Origin": "*",
            },
        )

    safe_name = filename if filename.endswith(".docx") else f"{filename.rsplit('.', 1)[0]}.docx"
    return FileResponse(
        path=docx_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=safe_name,
    )


