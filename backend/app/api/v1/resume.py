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

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from loguru import logger
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.dependencies.auth import get_current_user
from app.dependencies.common import get_settings
from app.dependencies.limits import (
    deduct_analysis_credit,
    verify_analysis_permission,
    verify_premium_permission,
)
from app.dependencies.resume_analysis import (
    get_cover_letter_service,
    get_patch_service,
    get_resume_analysis_workflow,
    get_rewrite_service,
)
from app.models import AnalysisHistory, StructuredResumeModel, User
from app.schemas.cover_letter import (
    CoverLetterRequest,
    CoverLetterResponse,
    UpdateCoverLetterRequest,
)
from app.schemas.patch import (
    ApplyRewriteItem,
    ApplyRewriteRequest,
    ApplyRewriteResponse,
)
from app.schemas.resume_analysis import ResumeAnalysisRequest, ResumeAnalysisResult
from app.schemas.rewrite import (
    AutoTailorRequest,
    AutoTailorResponse,
    BatchRewriteItemRequest,
    BatchRewriteRequest,
    BatchRewriteResponse,
    RewriteSectionRequest,
    RewriteSectionResponse,
)
from app.schemas.structured_resume import StructuredResume as _StructuredResume
from app.services.cleanup import cleanup_old_files
from app.services.cover_letter_service import CoverLetterService
from app.services.patch_service import PatchService
from app.services.resume_analysis_workflow import ResumeAnalysisWorkflow
from app.services.rewrite_service import RewriteService

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
    """Delegate the full workflow to the workflow service.

    JSON-first: if the user has a StructuredResume in the DB, the analysis
    runs directly from that JSON without loading any DOCX file. This means
    the analysis works even after the uploaded file has been cleaned up.

    Falls back to legacy DOCX-based analysis if no structured resume exists.
    """
    import json as _json

    from app.schemas.structured_resume import StructuredResume as _StructuredResume

    # --- JSON-FIRST PATH ---
    structured_record = db.query(StructuredResumeModel).filter(
        StructuredResumeModel.user_id == user.id
    ).first()

    if structured_record:
        try:
            structured_data = _json.loads(structured_record.resume_json)
            resume = _StructuredResume.model_validate(structured_data)
            result = workflow.run_from_structured(
                resume=resume,
                job_description_text=body.job_description_text,
                document_id=body.document_id or f"structured:{user.id}",
            )
            logger.info("Analysis ran from structured JSON", user_id=user.id)
        except Exception as exc:
            logger.warning("Structured JSON analysis failed, falling back to DOCX", error=str(exc))
            # Fall through to legacy DOCX path
            result = workflow.run(
                document_id=body.document_id or f"base/{user.id}",
                job_description_text=body.job_description_text,
            )
    else:
        # --- LEGACY DOCX PATH ---
        result = workflow.run(
            document_id=body.document_id or f"base/{user.id}",
            job_description_text=body.job_description_text,
        )

    deduct_analysis_credit(db, user)

    # Save to AnalysisHistory safely
    try:
        if body.document_id and body.document_id.startswith("base/") and getattr(user, "base_resume_filename", None):
            filename = user.base_resume_filename
        else:
            try:
                from app.services.section_service import SectionService
                sec_service = SectionService(upload_dir=Path(settings.UPLOAD_DIR))
                filename = sec_service._resolve_path(body.document_id or f"base/{user.id}").name
            except Exception:
                filename = "Resume.docx"

        target_role = getattr(result.overall_summary, "job_title", "Target Role") if result.overall_summary else "Target Role"
        target_company = getattr(result.overall_summary, "target_company", None) if result.overall_summary else None
        sections_need_improvement = len([s for s in (result.sections or []) if getattr(s, "review_status", None) == "improve"])
        total_sections = len(result.sections or [])

        # Correct overall score calculation from overall_coverage_percentage
        coverage_pct = getattr(result.overall_summary, "overall_coverage_percentage", 0.0) if result.overall_summary else 0.0
        overall_score = round(coverage_pct)

        history_entry = AnalysisHistory(
            user_id=user.id,
            document_id=body.document_id or f"base/{user.id}",
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

        # Collect missing red skills from section reviews and matrix
        missing_red_skills = set()
        for sec in (result.sections or []):
            missing_kws = getattr(sec, "missing_keywords", None) or []
            for kw in missing_kws:
                kw_clean = kw.strip()
                if kw_clean and len(kw_clean) >= 2:
                    missing_red_skills.add(kw_clean)

        if missing_red_skills:
            try:
                import json
                current_tracker = {}
                tracker_val = getattr(user, "missing_skills_tracker", None)
                if tracker_val and isinstance(tracker_val, str):
                    try:
                        current_tracker = json.loads(tracker_val)
                    except Exception:
                        current_tracker = {}

                for kw in missing_red_skills:
                    current_tracker[kw] = current_tracker.get(kw, 0) + 1

                user.missing_skills_tracker = json.dumps(current_tracker)
                db.add(user)
                db.commit()
                db.refresh(user)
            except Exception as tracker_err:
                logger.error(f"Failed to update missing_skills_tracker: {tracker_err}")
    except Exception as hist_err:
        logger.error(f"Failed to auto-save AnalysisHistory: {hist_err}")

    return result

#some more
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
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RewriteSectionResponse:
    """Rewrite a resume section using AI.

    Credit-free: rewrites do not consume credits. Only /analyze costs 1 credit.

    JSON-first: if section_content is provided in the request body (from the
    structured resume editor), the rewrite runs directly from that JSON content
    without loading any DOCX file.

    Falls back to legacy DOCX-based rewrite if document_id is provided.
    """
    # JSON-first path: section content is passed directly from the structured resume
    if body.section_content is not None and body.section_type is not None:
        evidence_text = body.evidence_text or ""

        # If evidence_text not provided, try to build it from the user's structured resume
        if not evidence_text:
            import json as _json

            from app.schemas.structured_resume import (
                StructuredResume as _StructuredResume,
            )
            from app.services.structured_resume_text_service import (
                serialize_to_plain_text,
            )

            record = db.query(StructuredResumeModel).filter(
                StructuredResumeModel.user_id == user.id
            ).first()
            if record:
                try:
                    data = _json.loads(record.resume_json)
                    resume = _StructuredResume.model_validate(data)
                    evidence_text = serialize_to_plain_text(resume)
                except Exception as exc:
                    logger.debug(f"Could not serialize structured resume for rewrite evidence: {exc}")

        res = service.rewrite_from_json(
            section_name=body.section_name,
            section_type=body.section_type,
            section_content=body.section_content,
            evidence_text=evidence_text,
            job_description_text=body.job_description_text,
            recommendations=body.recommendations,
            user_instructions=body.user_instructions,
            metric_inputs=body.metric_inputs,
            positioning_mode=body.positioning_mode,
        )
        return res

    # Legacy DOCX path
    res = service.rewrite(
        document_id=body.document_id or f"base/{user.id}",
        section_name=body.section_name,
        job_description_text=body.job_description_text,
        recommendations=body.recommendations,
        user_instructions=body.user_instructions,
        metric_inputs=body.metric_inputs,
        positioning_mode=body.positioning_mode,
    )
    return res


def _update_structured_resume_from_rewrites(
    resume: _StructuredResume,
    accepted_rewrites: list[dict],
) -> _StructuredResume:
    """Merge accepted rewrite text into a copy of the structured resume for ATS template rendering."""
    import copy

    merged = copy.deepcopy(resume)
    for rw in accepted_rewrites:
        section_title = (rw.get("section") or "").strip().lower()
        rewritten_text = (rw.get("rewritten_text") or "").strip()
        if not section_title or not rewritten_text:
            continue
        for sec in merged.sections:
            if (
                sec.section_title.lower() == section_title
                or sec.section_type.lower() == section_title
            ):
                if sec.section_type == "summary":
                    sec.content["text"] = rewritten_text
                elif sec.section_type == "skills":
                    lines = [line.strip() for line in rewritten_text.split("\n") if line.strip()]
                    categories = []
                    for line in lines:
                        if ":" in line:
                            cat_name, skills_str = line.split(":", 1)
                            skills = [s.strip() for s in skills_str.split(",") if s.strip()]
                            categories.append({"category_name": cat_name.strip(), "skills": skills})
                        else:
                            categories.append({"category_name": "Skills", "skills": [line]})
                    sec.content["categories"] = categories
                elif sec.section_type == "experience":
                    sec.content["_rewritten_text_override"] = rewritten_text
                else:
                    lines = [line.strip() for line in rewritten_text.split("\n") if line.strip()]
                    sec.content["entries"] = lines
                break
    return merged


def _generate_patched_resume(
    doc_id: str | None,
    accepted_items: list[ApplyRewriteItem],
    user: User,
    db: Session,
    settings: Settings,
    patch_service: PatchService,
    preferred_template: str | None = None,
) -> tuple[str | None, str | None]:
    """Smart dual-mode patch generator for DOCX and Structured ATS templates.

    1. If user has a structured resume and raw DOCX is missing -> renders ATS template DOCX.
    2. Otherwise -> patches the raw uploaded DOCX via patch_service.
    3. If raw DOCX patch fails and structured resume exists -> falls back to ATS template render.
    Returns (download_id, download_url).
    """
    import json as _json
    import uuid
    from pathlib import Path

    from app.schemas.structured_resume import StructuredResume as _StructuredResume
    from app.services.template_renderer import ATSTemplateRenderer

    if not accepted_items:
        return None, None

    upload_dir = Path(settings.UPLOAD_DIR)
    generated_dir = upload_dir / "generated"
    generated_dir.mkdir(parents=True, exist_ok=True)
    download_id = str(uuid.uuid4())
    out_path = generated_dir / f"{download_id}.docx"

    # Check if user has a structured resume in DB
    structured_record = (
        db.query(StructuredResumeModel)
        .filter(StructuredResumeModel.user_id == user.id)
        .first()
    )

    # Check if original raw DOCX still exists on disk
    base_docx = upload_dir / "base" / f"{user.id}.docx"
    has_raw_docx = base_docx.exists()
    candidate_id = doc_id or f"base/{user.id}"

    if doc_id:
        candidate_path = upload_dir / f"{doc_id}.docx"
        if candidate_path.exists():
            has_raw_docx = True
            base_docx = candidate_path
        elif (upload_dir / "base" / f"{doc_id.split('/', 1)[-1]}.docx").exists():
            base_docx = upload_dir / "base" / f"{doc_id.split('/', 1)[-1]}.docx"
            has_raw_docx = True

    # --- ATS Template path: structured JSON + rewrites merged in-memory ---
    if structured_record and (not has_raw_docx or doc_id is None):
        try:
            data = _json.loads(structured_record.resume_json)
            resume = _StructuredResume.model_validate(data)
            template_name = preferred_template or structured_record.preferred_template or "clean_classic"
            photo_path_str = structured_record.profile_photo_path
            photo_path = Path(photo_path_str) if photo_path_str and Path(photo_path_str).exists() else None
            rewrites_as_dicts = [{"section": rw.section, "rewritten_text": rw.rewritten_text} for rw in accepted_items]

            try:
                resume = _update_structured_resume_from_rewrites(resume, rewrites_as_dicts)
                structured_record.resume_json = resume.model_dump_json()
                structured_record.version += 1
                db.commit()
            except Exception as e_up:
                logger.warning(f"Failed to update structured record json from rewrites: {e_up}")

            renderer = ATSTemplateRenderer()
            renderer.render_with_rewrites(
                resume=resume,
                accepted_rewrites=rewrites_as_dicts,
                output_path=out_path,
                template_name=template_name,
                profile_photo_abs_path=photo_path,
            )
            return download_id, f"/api/v1/resume/download/{download_id}"
        except Exception as exc:
            logger.error(f"ATS template render failed, attempting raw patch: {exc}")

    # --- Raw DOCX patch path ---
    try:
        patch_res = patch_service.apply_rewrites(
            ApplyRewriteRequest(
                document_id=candidate_id,
                accepted_rewrites=accepted_items,
            )
        )
        return patch_res.download_id, patch_res.download_url
    except Exception as patch_err:
        logger.warning(f"Raw DOCX patch failed, checking ATS template fallback: {patch_err}")
        if structured_record:
            try:
                data = _json.loads(structured_record.resume_json)
                resume = _StructuredResume.model_validate(data)
                template_name = preferred_template or structured_record.preferred_template or "clean_classic"
                photo_path_str = structured_record.profile_photo_path
                photo_path = Path(photo_path_str) if photo_path_str and Path(photo_path_str).exists() else None
                rewrites_as_dicts = [{"section": rw.section, "rewritten_text": rw.rewritten_text} for rw in accepted_items]
                renderer = ATSTemplateRenderer()
                renderer.render_with_rewrites(
                    resume=resume,
                    accepted_rewrites=rewrites_as_dicts,
                    output_path=out_path,
                    template_name=template_name,
                    profile_photo_abs_path=photo_path,
                )
                return download_id, f"/api/v1/resume/download/{download_id}"
            except Exception as exc2:
                logger.error(f"ATS template fallback also failed: {exc2}")

    return None, None


@router.post(
    "/batch-rewrite",
    response_model=BatchRewriteResponse,
    summary="Rewrite multiple sections concurrently in parallel",
    dependencies=[Depends(verify_premium_permission)],
)
def batch_rewrite_sections(
    body: BatchRewriteRequest,
    service: Annotated[RewriteService, Depends(get_rewrite_service)],
    patch_service: Annotated[PatchService, Depends(get_patch_service)],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> BatchRewriteResponse:
    """Batch parallel section tailoring endpoint. Executes rewrites concurrently across worker threads.

    Credit-free: batch rewrites do not consume credits. Only /analyze costs 1 credit.
    """

    doc_id = body.document_id or f"base/{user.id}"
    rewrites_map = service.batch_rewrite(
        document_id=doc_id,
        job_description_text=body.job_description_text,
        sections=body.sections,
        user_instructions=body.user_instructions,
        metric_inputs=body.metric_inputs,
        positioning_mode=body.positioning_mode,
    )

    download_id = None
    download_url = None
    if rewrites_map:
        seen_keys = set()
        accepted_items = []
        for sec_name, text in rewrites_map.items():
            norm_k = sec_name.lower().strip()
            if norm_k not in seen_keys and text and text.strip():
                seen_keys.add(norm_k)
                accepted_items.append(ApplyRewriteItem(section=sec_name, rewritten_text=text))

        download_id, download_url = _generate_patched_resume(
            doc_id=doc_id,
            accepted_items=accepted_items,
            user=user,
            db=db,
            settings=settings,
            patch_service=patch_service,
        )
        if download_id:
            logger.info(
                f"⚡ [RoleCraft Audit] Batch auto-tailor generated patched file: download_id={download_id}"
            )

    # Link download_id to existing AnalysisHistory or create new entry so tailoring count increments
    try:
        from sqlalchemy import select

        stmt = (
            select(AnalysisHistory)
            .where(
                AnalysisHistory.user_id == user.id,
                AnalysisHistory.job_description_text == body.job_description_text,
            )
            .order_by(AnalysisHistory.created_at.desc())
        )
        hist = db.scalars(stmt).first()
        if hist:
            if download_id:
                hist.download_id = download_id
                db.add(hist)
                db.commit()
        else:
            filename = getattr(user, "base_resume_filename", "Resume.docx") or "Resume.docx"
            target_role = None
            if body.user_instructions:
                target_role = body.user_instructions.strip()
            if not target_role:
                for sec in body.sections:
                    if sec.section_name == "header" and sec.user_instructions:
                        target_role = sec.user_instructions.strip()
                        break
            if not target_role:
                target_role = rewrites_map.get("header") or "Target Position"

            hist = AnalysisHistory(
                user_id=user.id,
                document_id=doc_id,
                filename=filename,
                target_role=target_role,
                target_company=None,
                overall_score=85,
                sections_need_improvement=0,
                total_sections=len(body.sections),
                download_id=download_id,
                analysis_result_json=None,
                job_description_text=body.job_description_text,
            )
            db.add(hist)
            db.commit()
    except Exception as hist_err:
        logger.warning(f"Could not link or record AnalysisHistory in batch_rewrite: {hist_err}")

    return BatchRewriteResponse(
        rewrites=rewrites_map,
        download_id=download_id,
        download_url=download_url,
    )


@router.post(
    "/auto-tailor",
    response_model=AutoTailorResponse,
    summary="1-Click Auto Everything: Full resume analysis, targeted auto-tailoring, and PDF patch generation in one unified pipeline",
    dependencies=[Depends(verify_analysis_permission)],
)
def auto_tailor_resume(
    body: AutoTailorRequest,
    workflow: Annotated[ResumeAnalysisWorkflow, Depends(get_resume_analysis_workflow)],
    rewrite_service: Annotated[RewriteService, Depends(get_rewrite_service)],
    patch_service: Annotated[PatchService, Depends(get_patch_service)],
    user: Annotated[User, Depends(verify_analysis_permission)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AutoTailorResponse:
    """Unified 1-Click Auto Everything endpoint.

    Executes the entire end-to-end pipeline in a single server-side workflow:
    1. Runs full ATS match analysis (JSON-first or DOCX fallback)
    2. Deducts 1 analysis credit and registers analysis history
    3. Identifies sections needing improvement + target job title
    4. Executes parallel batch rewriting across worker threads
    5. Directly applies patches and generates downloadable tailored resume
    """
    import json as _json

    from app.schemas.structured_resume import StructuredResume as _StructuredResume

    doc_id = body.document_id or f"base/{user.id}"

    # --- STEP 1: ANALYSIS ---
    structured_record = db.query(StructuredResumeModel).filter(
        StructuredResumeModel.user_id == user.id
    ).first()

    structured_resume_obj = None
    if structured_record:
        try:
            structured_data = _json.loads(structured_record.resume_json)
            structured_resume_obj = _StructuredResume.model_validate(structured_data)
            analysis_result = workflow.run_from_structured(
                resume=structured_resume_obj,
                job_description_text=body.job_description_text,
                document_id=body.document_id or f"structured:{user.id}",
            )
            logger.info("Auto-tailor analysis ran from structured JSON", user_id=user.id)
        except Exception as exc:
            logger.warning("Structured JSON analysis failed in auto-tailor, falling back to DOCX", error=str(exc))
            analysis_result = workflow.run(
                document_id=doc_id,
                job_description_text=body.job_description_text,
            )
    else:
        analysis_result = workflow.run(
            document_id=doc_id,
            job_description_text=body.job_description_text,
        )

    deduct_analysis_credit(db, user)

    # Save to AnalysisHistory safely
    try:
        if body.document_id and body.document_id.startswith("base/") and getattr(user, "base_resume_filename", None):
            filename = user.base_resume_filename
        else:
            try:
                from app.services.section_service import SectionService
                sec_service = SectionService(upload_dir=Path(settings.UPLOAD_DIR))
                filename = sec_service._resolve_path(doc_id).name
            except Exception:
                filename = getattr(user, "base_resume_filename", "Resume.docx") or "Resume.docx"

        target_role_str = body.target_role or (getattr(analysis_result.overall_summary, "job_title", "Target Role") if analysis_result.overall_summary else "Target Role")
        target_company = getattr(analysis_result.overall_summary, "target_company", None) if analysis_result.overall_summary else None
        sections_need_improvement = len([s for s in (analysis_result.sections or []) if getattr(s, "review_status", None) == "improve"])
        total_sections = len(analysis_result.sections or [])
        coverage_pct = getattr(analysis_result.overall_summary, "overall_coverage_percentage", 0.0) if analysis_result.overall_summary else 0.0
        overall_score = round(coverage_pct)

        history_entry = AnalysisHistory(
            user_id=user.id,
            document_id=doc_id,
            filename=filename,
            target_role=target_role_str,
            target_company=target_company,
            overall_score=overall_score,
            sections_need_improvement=sections_need_improvement,
            total_sections=total_sections,
            analysis_result_json=analysis_result.model_dump_json(),
            job_description_text=body.job_description_text,
        )
        db.add(history_entry)
        db.commit()
    except Exception as hist_err:
        logger.warning(f"Could not record analysis history in auto-tailor: {hist_err}")

    # --- STEP 2: SELECT SECTIONS TO TAILOR ---
    target_header_title = body.target_role or (getattr(analysis_result.overall_summary, "job_title", None) if analysis_result.overall_summary else None)
    section_toggles = body.section_toggles or {}
    is_header_off = section_toggles.get("header") is False or section_toggles.get("Target Job Title & Header") is False

    batch_items = []
    if not is_header_off and target_header_title and target_header_title != "Target Position":
        batch_items.append(BatchRewriteItemRequest(
            section_name="header",
            section_type="header",
            section_content=target_header_title,
            recommendations=[f'Set target job title designation to "{target_header_title}"'],
        ))

    for sec in (analysis_result.sections or []):
        s_name = sec.section_name
        s_norm = s_name.lower().strip()

        if section_toggles.get(s_name) is False:
            continue
        if section_toggles.get(s_name) is not True:
            if any(k in s_norm for k in ["education", "certification", "header"]):
                continue
            if sec.review_status != "improve" and not (sec.recommendations and len(sec.recommendations) > 0):
                continue
            if sec.review_status == "reduce_emphasis":
                continue

        sec_content = None
        sec_type = getattr(sec, "section_type", None)
        if structured_resume_obj and structured_resume_obj.sections:
            for ms in structured_resume_obj.sections:
                ms_title = (ms.section_title or "").lower()
                if ms_title == s_norm or s_norm in ms_title or ms_title in s_norm or (ms.section_type == "experience" and ("experience" in s_norm or "work" in s_norm)):
                    sec_content = ms.content
                    sec_type = ms.section_type
                    break

        batch_items.append(BatchRewriteItemRequest(
            section_name=s_name,
            section_type=sec_type,
            section_content=sec_content,
            recommendations=sec.recommendations or [],
        ))

    # --- STEP 3: PARALLEL REWRITE & DIRECT PATCH ---
    rewrites_map: dict[str, str] = {}
    download_id = None
    download_url = None

    if batch_items:
        rewrites_map = rewrite_service.batch_rewrite(
            document_id=doc_id,
            job_description_text=body.job_description_text,
            sections=batch_items,
            user_instructions=body.user_instructions,
        )

        if rewrites_map:
            seen_keys = set()
            accepted_items = []
            for sec_name, text in rewrites_map.items():
                norm_k = sec_name.lower().strip()
                if norm_k not in seen_keys and text and text.strip():
                    seen_keys.add(norm_k)
                    accepted_items.append(ApplyRewriteItem(section=sec_name, rewritten_text=text))

            download_id, download_url = _generate_patched_resume(
                doc_id=doc_id,
                accepted_items=accepted_items,
                user=user,
                db=db,
                settings=settings,
                patch_service=patch_service,
            )
            if download_id:
                logger.info(
                    f"⚡ [RoleCraft Audit] Auto-tailor generated patched file: download_id={download_id}"
                )
                try:
                    history_entry.download_id = download_id
                    db.add(history_entry)
                    db.commit()
                except Exception as e_hist:
                    logger.warning(f"Failed to update download_id in history_entry: {e_hist}")

    return AutoTailorResponse(
        analysis=analysis_result,
        rewrites=rewrites_map,
        download_id=download_id,
        download_url=download_url,
        target_role=target_header_title or (getattr(analysis_result.overall_summary, "job_title", None) if analysis_result.overall_summary else None),
        sections_tailored=len(rewrites_map),
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
    user: Annotated[User, Depends(get_current_user)],
) -> ApplyRewriteResponse:
    """Apply accepted rewrites and return a download link."""
    background_tasks.add_task(
        cleanup_old_files,
        upload_dir=Path(settings.UPLOAD_DIR),
        max_age_hours=settings.GENERATED_CLEANUP_HOURS,
    )

    download_id, download_url = _generate_patched_resume(
        doc_id=body.document_id,
        accepted_items=body.accepted_rewrites,
        user=user,
        db=db,
        settings=settings,
        patch_service=service,
        preferred_template=body.preferred_template,
    )

    if not download_id:
        res = service.apply_rewrites(body)
        download_id = res.download_id
        download_url = res.download_url

    # Link download_id to the latest matching history record
    try:
        from sqlalchemy import select

        stmt = (
            select(AnalysisHistory)
            .where(AnalysisHistory.user_id == user.id)
            .order_by(AnalysisHistory.created_at.desc())
        )
        hist = db.scalars(stmt).first()
        if hist and download_id:
            hist.download_id = download_id
            db.add(hist)
            db.commit()
    except Exception as hist_err:
        logger.warning(f"Could not link download_id to AnalysisHistory: {hist_err}")

    return ApplyRewriteResponse(
        download_id=download_id or "",
        sections_updated=len(body.accepted_rewrites),
        download_url=download_url or f"/api/v1/resume/download/{download_id}",
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
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CoverLetterResponse:
    """Generate a tailored 3-paragraph cover letter based on resume & job description.

    Credit-free: cover letter generation does not consume credits. Only /analyze costs 1 credit.
    """
    res = service.generate_cover_letter(body)
    return res


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
@router.get(
    "/cover-letter/{download_id}/download",
    summary="Download cover letter as DOCX or PDF (alias)",
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

    # Extract company name from the cached cover letter text
    company_name = "Company"
    txt_cache_path = upload_dir / "generated" / f"{download_id}_cover_letter.txt"
    if txt_cache_path.exists():
        try:
            cl_text = txt_cache_path.read_text(encoding="utf-8")
            import re
            first_p = cl_text.split("\n\n")[0] if "\n\n" in cl_text else cl_text
            patterns = [
                r"(?:join|at|to|with)\s+([A-Z0-9][a-zA-Z0-9\s\.\,\-\&]{1,30}?)\s+as\s+an?\b",
                r"opportunity\s+at\s+([A-Z0-9][a-zA-Z0-9\s\.\,\-\&]{1,30}?)\b",
                r"position\s+at\s+([A-Z0-9][a-zA-Z0-9\s\.\,\-\&]{1,30}?)\b",
                r"role\s+at\s+([A-Z0-9][a-zA-Z0-9\s\.\,\-\&]{1,30}?)\b",
                r"team\s+at\s+([A-Z0-9][a-zA-Z0-9\s\.\,\-\&]{1,30}?)\b",
                r"(?:join|at)\s+([A-Z0-9][a-zA-Z0-9\s\.\,\-\&]{1,25}?)\s+because\s+your\b",
            ]
            for pattern in patterns:
                match = re.search(pattern, first_p, re.IGNORECASE)
                if match:
                    comp = match.group(1).strip()
                    comp = re.sub(r'\s+(?:as|the|because|to|for|is|an?)\s*$', '', comp, flags=re.IGNORECASE).strip()
                    comp = comp.rstrip(".,;:")
                    if comp:
                        company_name = comp
                        break
        except Exception as e:
            logger.error(f"Error extracting company name for download: {e}")

    safe_name = f"cover - {company_name}.pdf" if format.lower() == "pdf" else f"cover - {company_name}.docx"

    if format.lower() == "pdf":
        from app.services.pdf_service import PDFService
        pdf_path = upload_dir / "generated" / f"{download_id}.pdf"
        pdf_service = PDFService(upload_dir=upload_dir)
        pdf_service.convert_docx_to_pdf(docx_path, pdf_path)

        return FileResponse(
            path=pdf_path,
            media_type="application/pdf",
            filename=safe_name,
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}"',
                "Access-Control-Allow-Origin": "*",
            },
        )

    return FileResponse(
        path=docx_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=safe_name,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "Access-Control-Allow-Origin": "*",
        },
    )


# ── Patched Resume Download Endpoints ────────────────────────────────────────


@router.get(
    "/download/{download_id:path}/pdf",
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
        if not docx_path or not docx_path.exists():
            docx_path = resolve_document_path(upload_dir, download_id)
        pdf_path = upload_dir / "generated" / f"{download_id}.pdf"

    if not docx_path or not docx_path.exists():
        raise NotFoundError(f"Resume document for ID '{download_id}' not found.")

    pdf_service = PDFService(upload_dir=upload_dir)
    pdf_service.convert_docx_to_pdf(docx_path, pdf_path)

    safe_name = filename.replace("/", "").replace("\\", "").strip() or "resume_updated.pdf"
    safe_name = safe_name.replace("—", "-").replace("–", "-").replace("“", '"').replace("”", '"').replace("’", "'")
    if not safe_name.lower().endswith(".pdf"):
        safe_name = safe_name.rsplit(".", 1)[0] + ".pdf" if "." in safe_name else safe_name + ".pdf"

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=safe_name,
    )


@router.get(
    "/download/{download_id:path}",
    summary="Download a generated patched resume document",
    description="Streams the modified resume document as a file attachment.",
)
def download_patched_resume(
    download_id: str,
    settings: Annotated[Settings, Depends(get_settings)],
    filename: str = "resume_updated.docx",
) -> FileResponse:
    """Stream the generated patched DOCX file with the given filename."""
    from app.utils.path_resolver import resolve_document_path

    upload_dir = Path(settings.UPLOAD_DIR)

    if download_id.startswith("base/"):
        file_path = resolve_document_path(upload_dir, download_id)
    else:
        file_path = upload_dir / "generated" / f"{download_id}.docx"
        if not file_path or not file_path.exists():
            file_path = resolve_document_path(upload_dir, download_id)

    if not file_path or not file_path.exists():
        raise NotFoundError(f"Generated download file for ID '{download_id}' not found.")

    # Sanitise the filename — strip path separators and enforce .docx extension
    safe_name = filename.replace("/", "").replace("\\", "").strip() or "resume_updated.docx"
    safe_name = safe_name.replace("—", "-").replace("–", "-").replace("“", '"').replace("”", '"').replace("’", "'")
    if not safe_name.lower().endswith(".docx"):
        safe_name += ".docx"

    return FileResponse(
        path=file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=safe_name,
    )


