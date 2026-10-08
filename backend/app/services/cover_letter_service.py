"""Cover letter service.

Generates AI cover letters tailored to a job description, builds styled DOCX/PDF
documents, and manages updates to generated cover letters.
"""

import uuid
from pathlib import Path

import docx
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from loguru import logger

from app.ai.cover_letter_prompts import (
    COVER_LETTER_SYSTEM_PROMPT,
    build_cover_letter_input,
)
from app.ai.provider import OpenAIProvider
from app.core.exceptions import NotFoundError
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

        # Always use original summary from parsed DOCX as ground truth
        for sec in doc_sections.sections:
            if "summary" in sec.title.lower() or "profile" in sec.title.lower():
                summary_text = "\n".join([p.text for p in sec.paragraphs if p.text.strip()])
                break

        # Rewritten sections go only into evidence_parts (context, not ground truth)
        if request.rewritten_sections:
            for sec_key, text in request.rewritten_sections.items():
                evidence_parts.append(f"[{sec_key.title()} — Tailored]\n{text}")

        if not summary_text:
            for sec in doc_sections.sections:
                if sec.normalized_name != "header":
                    evidence_parts.append(
                        f"[{sec.title}]\n" + "\n".join([p.text for p in sec.paragraphs if p.text.strip()])
                    )

        evidence_context = "\n\n".join(evidence_parts[:4])

        # Target role cleaning & override
        target_role = request.target_role or "Target Position"
        if not request.target_role:
            jd_lines = [l.strip() for l in request.job_description_text.splitlines() if l.strip()]
            for line in jd_lines[:5]:
                if "role:" in line.lower() or "title:" in line.lower() or "position:" in line.lower():
                    target_role = line.split(":", 1)[1].strip()
                    break
                elif len(line) < 50 and not line.lower().startswith("about"):
                    target_role = line
                    break

        target_role = self._clean_target_role(target_role)

        # 3. Build Prompt & Call AI Provider
        user_prompt = build_cover_letter_input(
            candidate_name=candidate_name,
            target_role=target_role,
            summary_text=summary_text,
            job_description_text=request.job_description_text[:3000],
            evidence_context=evidence_context[:3000],
            confirmed_matched_skills=request.confirmed_matched_skills,
            forbidden_claims=request.forbidden_claims,
        )

        logger.info("Generating AI cover letter for document", document_id=request.document_id, candidate=candidate_name)

        cover_letter_raw = self._provider.generate_text(
            system_prompt=COVER_LETTER_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.4,
        )

        cover_letter_text = cover_letter_raw.strip()

        # Post-generation safety: strip any terms not in candidate's evidence
        if hasattr(request, 'forbidden_claims') and request.forbidden_claims:
            cover_letter_text, stripped = self._validate_cover_letter_claims(
                cover_letter_text, request.forbidden_claims
            )
            if stripped:
                logger.warning(
                    "🛡️ [RoleCraft Shield] Stripped forbidden claims from cover letter",
                    stripped=stripped,
                )

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
            contact_info=request.contact_info,
            document_id=request.document_id,
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
        docx_path = generated_dir / f"{download_id}.docx"
        candidate_name = "Candidate Name"
        target_role = "Target Position"
        contact_info = None
        if docx_path.exists():
            try:
                existing_doc = docx.Document(docx_path)
                if len(existing_doc.paragraphs) > 0:
                    candidate_name = existing_doc.paragraphs[0].text.strip() or candidate_name
                if len(existing_doc.paragraphs) > 1:
                    target_role = existing_doc.paragraphs[1].text.strip() or target_role
                if len(existing_doc.paragraphs) > 2:
                    contact_info = existing_doc.paragraphs[2].text.strip()
            except Exception:
                pass

        self._build_cover_letter_docx(
            download_id=download_id,
            cover_letter_text=new_text.strip(),
            candidate_name=candidate_name,
            target_role=target_role,
            contact_info=contact_info,
        )

    def _validate_cover_letter_claims(
        self, cover_letter_text: str, forbidden_terms: list[str]
    ) -> tuple[str, list[str]]:
        """Strip any forbidden technology/skill terms from cover letter text.

        Uses the same word-boundary regex logic as sanitize_unsupported_skills_from_text.
        Returns (cleaned_text, list_of_stripped_terms).
        """
        from app.services.rewrite_service import sanitize_unsupported_skills_from_text
        return sanitize_unsupported_skills_from_text(cover_letter_text, set(forbidden_terms))

    def _clean_target_role(self, raw_role: str) -> str:
        """Clean target role string removing junk like 'Company logo for,' or markdown."""
        if not raw_role:
            return "Target Position"
        clean = raw_role.replace("Company logo for,", "").replace("Company logo for", "").replace("RE:", "").replace("Application for", "")
        lines = clean.splitlines()
        clean = lines[0].strip() if lines else "Target Position"
        if len(clean) > 60:
            parts = clean[:60].rsplit(" ", 1)
            clean = parts[0] if parts else clean[:60]
        return clean or "Target Position"

    def _build_cover_letter_docx(
        self,
        download_id: str,
        cover_letter_text: str,
        candidate_name: str,
        target_role: str,
        contact_info: str | None = None,
        document_id: str | None = None,
    ) -> Path:
        """Create an executive, styled DOCX cover letter file matching standard corporate design."""
        # Check if user has a custom base cover letter template saved
        base_template_path = None
        if document_id and "/" in document_id:
            user_id = document_id.split("/")[1].split("_")[0]
            candidate_base_cl = self._upload_dir / "base" / f"{user_id}_cover_letter.docx"
            if candidate_base_cl.exists():
                base_template_path = candidate_base_cl

        if base_template_path and base_template_path.exists():
            try:
                doc = docx.Document(base_template_path)
                # Clear template paragraphs
                for p in list(doc.paragraphs):
                    p._element.getparent().remove(p._element)
            except Exception:
                doc = docx.Document()
        else:
            doc = docx.Document()

        # Page Setup: Standard executive margins (0.8 inch)
        for s in doc.sections:
            s.top_margin = Inches(0.8)
            s.bottom_margin = Inches(0.8)
            s.left_margin = Inches(0.85)
            s.right_margin = Inches(0.85)

        # 1. Header: Candidate Name (Bold, Slate-900)
        p_name = doc.add_paragraph()
        run_name = p_name.add_run(candidate_name.upper())
        run_name.font.name = "Calibri"
        run_name.font.size = Pt(18)
        run_name.font.bold = True
        run_name.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)  # Slate-900
        p_name.paragraph_format.space_after = Pt(2)
        p_name.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT

        # 2. Target Designation / Role Subtitle
        clean_role = self._clean_target_role(target_role)
        p_role = doc.add_paragraph()
        run_role = p_role.add_run(clean_role.title())
        run_role.font.name = "Calibri"
        run_role.font.size = Pt(11.5)
        run_role.font.bold = True
        run_role.font.color.rgb = RGBColor(0x47, 0x55, 0x69)  # Slate-600
        p_role.paragraph_format.space_after = Pt(4)

        # 3. Contact Info Line (Address | Phone | Email | LinkedIn)
        if contact_info and contact_info.strip():
            p_contact = doc.add_paragraph()
            run_contact = p_contact.add_run(contact_info.strip())
            run_contact.font.name = "Calibri"
            run_contact.font.size = Pt(9.5)
            run_contact.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)  # Slate-500
            p_contact.paragraph_format.space_after = Pt(16)



        # 5. Cover Letter Body Paragraphs
        paragraphs = [p.strip() for p in cover_letter_text.splitlines() if p.strip()]

        for p_text in paragraphs:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(10)
            p.paragraph_format.line_spacing = 1.25

            # Check if line is salutation or signoff
            if p_text.lower().startswith("dear ") or p_text.lower().startswith("to the "):
                run = p.add_run(p_text)
                run.font.name = "Calibri"
                run.font.size = Pt(11)
                run.font.bold = True
                run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
                p.paragraph_format.space_before = Pt(8)
                p.paragraph_format.space_after = Pt(10)
            elif p_text.lower().startswith("sincerely") or p_text.lower().startswith("best regards") or p_text.lower().startswith("warm regards"):
                run = p.add_run(p_text)
                run.font.name = "Calibri"
                run.font.size = Pt(11)
                run.font.italic = True
                run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
                p.paragraph_format.space_before = Pt(14)
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
