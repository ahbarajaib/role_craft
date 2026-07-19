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

from app.core.config import Settings
from app.core.exceptions import NotFoundError
from app.dependencies.common import get_settings
from app.dependencies.resume_analysis import get_resume_analysis_workflow, get_rewrite_service, get_patch_service
from app.schemas.resume_analysis import ResumeAnalysisRequest, ResumeAnalysisResult
from app.schemas.rewrite import RewriteSectionRequest, RewriteSectionResponse
from app.schemas.patch import ApplyRewriteRequest, ApplyRewriteResponse
from app.services.resume_analysis_workflow import ResumeAnalysisWorkflow
from app.services.rewrite_service import RewriteService
from app.services.patch_service import PatchService
from app.dependencies.limits import verify_analysis_permission, verify_premium_permission

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
    dependencies=[Depends(verify_analysis_permission)],
)
def analyze_resume(
    body: ResumeAnalysisRequest,
    workflow: Annotated[ResumeAnalysisWorkflow, Depends(get_resume_analysis_workflow)],
) -> ResumeAnalysisResult:
    """Delegate the full workflow to the workflow service."""
    return workflow.run(
        document_id=body.document_id,
        job_description_text=body.job_description_text,
    )


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
) -> ApplyRewriteResponse:
    """Delegate patching operation to PatchService."""
    background_tasks.add_task(
        cleanup_old_files,
        upload_dir=Path(settings.UPLOAD_DIR),
        max_age_hours=settings.GENERATED_CLEANUP_HOURS,
    )
    return service.apply_rewrites(body)


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

    upload_dir = Path(settings.UPLOAD_DIR)

    if download_id.startswith("base/"):
        user_id = download_id.split("/", 1)[1]
        docx_path = upload_dir / "base" / f"{user_id}.docx"
        pdf_path = upload_dir / "base" / f"{user_id}.pdf"
    else:
        docx_path = upload_dir / "generated" / f"{download_id}.docx"
        if not docx_path.exists():
            docx_path = upload_dir / f"{download_id}.docx"
        pdf_path = upload_dir / "generated" / f"{download_id}.pdf"

    if not docx_path.exists():
        raise NotFoundError(f"Source resume document '{download_id}' not found.")

    pdf_service = PDFService(upload_dir=upload_dir)
    pdf_service.convert_docx_to_pdf(docx_path, pdf_path)

    safe_name = filename.replace("/", "").replace("\\", "").strip() or "resume_updated.pdf"
    if not safe_name.lower().endswith(".pdf"):
        safe_name = safe_name.rsplit(".", 1)[0] + ".pdf" if "." in safe_name else safe_name + ".pdf"

    headers = {
        "Content-Disposition": f'inline; filename="{safe_name}"',
        "Access-Control-Allow-Origin": "*",
    }

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        headers=headers,
    )

