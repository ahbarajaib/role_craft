"""DOCX patching service.

Modifies the body paragraphs of target sections inside the resume document
using python-docx while preserving formatting, headers, footers, and styles.
"""

import os
import uuid
from pathlib import Path
import docx
from loguru import logger

from app.core.exceptions import BadRequestError, NotFoundError
from app.services.section_service import SectionService
from app.schemas.patch import ApplyRewriteRequest, ApplyRewriteResponse, ApplyRewriteItem


def copy_paragraph_properties(template_para, target_para):
    """Copy style and formatting properties from template paragraph to target."""
    target_para.style = template_para.style
    
    # Copy paragraph format properties
    target_para.paragraph_format.alignment = template_para.paragraph_format.alignment
    target_para.paragraph_format.left_indent = template_para.paragraph_format.left_indent
    target_para.paragraph_format.right_indent = template_para.paragraph_format.right_indent
    target_para.paragraph_format.space_before = template_para.paragraph_format.space_before
    target_para.paragraph_format.space_after = template_para.paragraph_format.space_after
    target_para.paragraph_format.line_spacing = template_para.paragraph_format.line_spacing
    target_para.paragraph_format.keep_with_next = template_para.paragraph_format.keep_with_next
    target_para.paragraph_format.page_break_before = template_para.paragraph_format.page_break_before


def copy_run_properties(template_run, target_run):
    """Copy font name, size, styling flags, and color from template run to target."""
    if not template_run:
        return
        
    if template_run.bold is not None:
        target_run.bold = template_run.bold
    if template_run.italic is not None:
        target_run.italic = template_run.italic
    if template_run.underline is not None:
        target_run.underline = template_run.underline
        
    if template_run.font:
        if template_run.font.name is not None:
            target_run.font.name = template_run.font.name
        if template_run.font.size is not None:
            target_run.font.size = template_run.font.size
        if template_run.font.color and template_run.font.color.rgb is not None:
            target_run.font.color.rgb = template_run.font.color.rgb


class PatchService:
    """Modifies body paragraphs of sections inside the original DOCX file."""

    def __init__(self, upload_dir: Path, section_service: SectionService) -> None:
        self._upload_dir = upload_dir
        self._sections = section_service

    def apply_rewrites(self, request: ApplyRewriteRequest) -> ApplyRewriteResponse:
        """Apply accepted rewrites to original document and save to downloads directory."""
        logger.info(
            "Starting DOCX patch application",
            document_id=request.document_id,
            rewrites_count=len(request.accepted_rewrites),
        )

        # 1. Load the original DOCX file
        file_path = self._upload_dir / f"{request.document_id}.docx"
        if not file_path.exists():
            raise NotFoundError(f"Original resume document '{request.document_id}' not found.")

        doc = docx.Document(file_path)

        # 2. Get detected sections from SectionService
        sections_response = self._sections.detect_document_sections(request.document_id)
        sections = sections_response.sections

        sections_updated = 0

        def _normalize_title(t: str) -> str:
            clean_t = t.replace("[", "").replace("]", "").strip()
            return " ".join(clean_t.lower().split())

        # Process each accepted rewrite
        for rewrite_item in request.accepted_rewrites:
            # Find the matching section by title
            target_sec = next(
                (s for s in sections if _normalize_title(s.title) == _normalize_title(rewrite_item.section)),
                None,
            )
            if not target_sec:
                logger.warning(
                    "Skipping section rewrite: section not found in detected document sections",
                    section=rewrite_item.section,
                )
                continue

            if not target_sec.paragraph_indexes:
                continue

            # Identify heading and body paragraph objects
            heading_idx = target_sec.paragraph_indexes[0]
            heading_para = doc.paragraphs[heading_idx]
            
            body_paras = [doc.paragraphs[idx] for idx in target_sec.paragraph_indexes[1:]]

            # Split rewritten text into paragraphs
            new_para_texts = [
                text.strip()
                for text in rewrite_item.rewritten_text.split("\n")
                if text.strip()
            ]

            # Determine paragraph styling template
            style_template_para = body_paras[0] if body_paras else heading_para
            template_run = style_template_para.runs[0] if style_template_para.runs else None

            # Current insertion point (starts at heading, moves as we update/insert)
            current_insertion_point = heading_para
            
            total_loops = max(len(body_paras), len(new_para_texts))
            
            for i in range(total_loops):
                if i < len(new_para_texts) and i < len(body_paras):
                    # Case A: Overwrite existing body paragraph
                    p = body_paras[i]
                    p.text = "" # Clears existing runs
                    new_run = p.add_run(new_para_texts[i])
                    copy_run_properties(template_run, new_run)
                    current_insertion_point = p
                elif i < len(new_para_texts):
                    # Case B: Insert new body paragraph
                    # Insert xml element right after the current insertion point
                    new_p_xml = docx.oxml.parse_xml(
                        r'<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'
                    )
                    current_insertion_point._p.addnext(new_p_xml)
                    new_p = docx.text.paragraph.Paragraph(new_p_xml, doc._body)
                    new_run = new_p.add_run(new_para_texts[i])
                    
                    # Copy paragraph formatting and character styles
                    copy_paragraph_properties(style_template_para, new_p)
                    copy_run_properties(template_run, new_run)
                    
                    current_insertion_point = new_p
                else:
                    # Case C: Extra original body paragraphs, delete them
                    p = body_paras[i]
                    p._p.getparent().remove(p._p)
                    p._p = None

            sections_updated += 1

        # 3. Save modified document to uploads/generated/
        download_id = str(uuid.uuid4())
        generated_dir = self._upload_dir / "generated"
        generated_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = generated_dir / f"{download_id}.docx"
        doc.save(output_path)

        logger.info(
            "DOCX patching complete",
            download_id=download_id,
            sections_updated=sections_updated,
            output_path=str(output_path),
        )

        return ApplyRewriteResponse(
            download_id=download_id,
            sections_updated=sections_updated,
            download_url=f"/api/v1/resume/download/{download_id}",
        )
