"""Cover letter service.

Generates AI cover letters tailored to a job description, builds styled DOCX/PDF
documents, and manages updates to generated cover letters.
"""

import datetime
import uuid
from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from loguru import logger

from app.ai.cover_letter_prompts import COVER_LETTER_SYSTEM_PROMPT, build_cover_letter_input
from app.ai.provider import OpenAIProvider
from app.core.exceptions import BadRequestError, NotFoundError
from app.schemas.cover_letter import CoverLetterRequest, CoverLetterResponse
from app.services.section_service import SectionService
from app.utils.path_resolver import resolve_document_path


class CoverLetterService:
    """Service for generating and managing cover letters."""

    def __init__(
        self,
        upload_dir: Path,
        section_service: SectionService,
        provider: OpenAIProvider,
    ) -> None:
        self._upload_dir = upload_dir
        self._section_service = section_service
        self._provider = provider

    def generate_cover_letter(self, request: CoverLetterRequest) -> CoverLetterResponse:
        """Generate a tailored cover letter and cache the initial text."""
        docx_path = resolve_document_path(self._upload_dir, request.document_id)
        if not docx_path.exists():
            raise NotFoundError(f"Document '{request.document_id}' not found.")

        # 1. Parse document sections to extract candidate name & summary context
        doc_sections = self._section_service.detect_document_sections(request.document_id)

        # Extract Candidate Name (First paragraph of document or user provided)
        candidate_name = request.candidate_name
        contact_info = ""
        if not candidate_name or candidate_name.strip().lower() in ("candidate", ""):
            doc = docx.Document(docx_path)
            for p in doc.paragraphs:
                text = p.text.strip()
                if text and len(text) < 60 and not text.startswith("•"):
                    candidate_name = text
                    break
            if not candidate_name:
                candidate_name = "Candidate Name"

        # 2. Extract Professional Summary / Experience Context
        summary_text = ""
        evidence_parts = []

        if request.rewritten_sections:
            for sec_key, text in request.rewritten_sections.items():
                if "summary" in sec_key.lower() or "profile" in sec_key.lower():
                    summary_text = text
                else:
                    evidence_parts.append(f"[{sec_key.title()}]\n{text}")
        
        if not summary_text:
            for sec in doc_sections.sections:
                if "summary" in sec.title.lower() or "profile" in sec.title.lower():
                    summary_text = "\n".join([p.text for p in sec.paragraphs if p.text.strip()])
                    break
                evidence_parts.append(f"[{sec.title}]\n" + "\n".join([p.text for p in sec.paragraphs if p.text.strip()]))

        evidence_context = "\n\n".join(evidence_parts[:4])

        # Target role from Job Description (first line or fallback)
        jd_lines = [l.strip() for l in request.job_description_text.splitlines() if l.strip()]
        target_role = "Target Position"
        for line in jd_lines[:5]:
            if "role:" in line.lower() or "title:" in line.lower() or "position:" in line.lower():
                target_role = line.split(":", 1)[1].strip()
                break
            elif len(line) < 50 and not line.lower().startswith("about"):
                target_role = line
                break

        # 3. Build Prompt & Call AI Provider
        user_prompt = build_cover_letter_input(
            candidate_name=candidate_name,
            target_role=target_role,
            summary_text=summary_text,
            job_description_text=request.job_description_text[:3000],
            evidence_context=evidence_context[:3000],
        )

        logger.info("Generating AI cover letter for document", document_id=request.document_id, candidate=candidate_name)

        cover_letter_raw = self._provider.generate_text(
            system_prompt=COVER_LETTER_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.4,
        )

        cover_letter_text = cover_letter_raw.strip()

        # 4. Generate UUID download_id and save text file cache & DOCX
        download_id = f"cl_{uuid.uuid4().hex[:12]}"
        generated_dir = self._upload_dir / "generated"
        generated_dir.mkdir(parents=True, exist_ok=True)

        txt_cache_path = generated_dir / f"{download_id}_cover_letter.txt"
        txt_cache_path.write_text(cover_letter_text, encoding="utf-8")

        # Build initial DOCX file
        self._build_cover_letter_docx(
            download_id=download_id,
            cover_letter_text=cover_letter_text,
            candidate_name=candidate_name,
            target_role=target_role,
        )

        return CoverLetterResponse(
            download_id=download_id,
            cover_letter_text=cover_letter_text,
            candidate_name=candidate_name,
            target_role=target_role,
        )

    def update_cover_letter_text(self, download_id: str, new_text: str) -> None:
        """Update cached cover letter text and rebuild DOCX."""
        generated_dir = self._upload_dir / "generated"
        txt_cache_path = generated_dir / f"{download_id}_cover_letter.txt"

        if not txt_cache_path.exists():
            raise NotFoundError(f"Cover letter download session '{download_id}' not found.")

        txt_cache_path.write_text(new_text.strip(), encoding="utf-8")

        # Rebuild DOCX with updated text
        # Attempt to read candidate name and role from existing doc header
        docx_path = generated_dir / f"{download_id}.docx"
        candidate_name = "Candidate Name"
        target_role = "Target Position"
        if docx_path.exists():
            try:
                existing_doc = docx.Document(docx_path)
                if len(existing_doc.paragraphs) > 0:
                    candidate_name = existing_doc.paragraphs[0].text.strip() or candidate_name
            except Exception:
                pass

        self._build_cover_letter_docx(
            download_id=download_id,
            cover_letter_text=new_text.strip(),
            candidate_name=candidate_name,
            target_role=target_role,
        )

    def _build_cover_letter_docx(
        self,
        download_id: str,
        cover_letter_text: str,
        candidate_name: str,
        target_role: str,
    ) -> Path:
        """Create a styled, professional DOCX cover letter file."""
        doc = docx.Document()

        # Page Setup: Standard margins (0.8 inch)
        for s in doc.sections:
            s.top_margin = Inches(0.8)
            s.bottom_margin = Inches(0.8)
            s.left_margin = Inches(0.85)
            s.right_margin = Inches(0.85)

        # 1. Header: Candidate Name
        p_name = doc.add_paragraph()
        run_name = p_name.add_run(candidate_name)
        run_name.font.name = "Calibri"
        run_name.font.size = Pt(20)
        run_name.font.bold = True
        run_name.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)  # Slate-800
        p_name.paragraph_format.space_after = Pt(2)
        p_name.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT

        # Subtitle / Divider
        p_sub = doc.add_paragraph()
        run_sub = p_sub.add_run("Application & Cover Letter")
        run_sub.font.name = "Calibri"
        run_sub.font.size = Pt(10)
        run_sub.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)  # Slate-500
        p_sub.paragraph_format.space_after = Pt(14)

        # Horizontal accent line
        p_line = doc.add_paragraph()
        p_line.paragraph_format.space_after = Pt(16)

        # 2. Date & Recipient
        today_str = datetime.date.today().strftime("%B %d, %Y")
        p_date = doc.add_paragraph()
        r_date = p_date.add_run(today_str)
        r_date.font.name = "Calibri"
        r_date.font.size = Pt(11)
        r_date.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
        p_date.paragraph_format.space_after = Pt(12)

        # Subject line
        p_subj = doc.add_paragraph()
        r_subj = p_subj.add_run(f"RE: Application for {target_role}")
        r_subj.font.name = "Calibri"
        r_subj.font.size = Pt(11)
        r_subj.font.bold = True
        r_subj.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
        p_subj.paragraph_format.space_after = Pt(14)

        # 3. Cover Letter Body Paragraphs
        paragraphs = [p.strip() for p in cover_letter_text.splitlines() if p.strip()]

        for p_text in paragraphs:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(10)
            p.paragraph_format.line_spacing = 1.2

            # Check if this line is salutation or signoff
            if p_text.lower().startswith("dear ") or p_text.lower().startswith("to the "):
                run = p.add_run(p_text)
                run.font.name = "Calibri"
                run.font.size = Pt(11)
                run.font.bold = True
                run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
            elif p_text.lower().startswith("sincerely") or p_text.lower().startswith("best regards") or p_text.lower().startswith("warm regards"):
                run = p.add_run(p_text)
                run.font.name = "Calibri"
                run.font.size = Pt(11)
                run.font.italic = True
                run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
                p.paragraph_format.space_before = Pt(12)
                p.paragraph_format.space_after = Pt(4)
            else:
                run = p.add_run(p_text)
                run.font.name = "Calibri"
                run.font.size = Pt(11)
                run.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

        generated_dir = self._upload_dir / "generated"
        generated_dir.mkdir(parents=True, exist_ok=True)
        docx_out_path = generated_dir / f"{download_id}.docx"
        doc.save(docx_out_path)
        logger.info("Successfully generated cover letter DOCX", path=str(docx_out_path))
        return docx_out_path
