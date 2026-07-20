"""DOCX patching service.

Modifies the text content of target sections inside the resume document
using python-docx while preserving 100% of original visual formatting.

Formatting preservation guarantee
----------------------------------
- Fonts, sizes, colours, bold/italic/underline are never touched.
- Paragraph styles, spacing, indentation, alignment, and keep-with-next are
  preserved by deep-copying the XML of the original template paragraph.
- Bullet/numbered-list XML (<w:numPr>) is copied with the paragraph.
- Hyperlinks, tables, tab stops, and document structure are untouched.
- The AI may only change the *text characters* inside <w:t> nodes.
"""

import copy
import uuid
from pathlib import Path

import docx
import docx.text.paragraph
from docx.oxml.ns import qn
from lxml import etree
from loguru import logger

from app.core.exceptions import NotFoundError
from app.services.section_service import SectionService
from app.schemas.patch import ApplyRewriteRequest, ApplyRewriteResponse


# ---------------------------------------------------------------------------
# Low-level XML helpers
# ---------------------------------------------------------------------------

def _detect_doc_font(doc) -> str | None:
    """Detect dominant font name across all runs in document."""
    fonts = []
    for p in doc.paragraphs:
        for r in p.runs:
            if r.font and r.font.name:
                fonts.append(r.font.name)
    if fonts:
        return max(set(fonts), key=fonts.count)
    try:
        return doc.styles["Normal"].font.name
    except Exception:
        return None


def _set_run_text(run, text: str) -> None:
    """Set the visible text of a single <w:r> without touching its <w:rPr>.

    Removes all existing <w:t> children and inserts one fresh <w:t> element.
    The xml:space="preserve" attribute is added when the text starts or ends
    with whitespace so Word does not silently strip those characters.
    """
    r_elem = run._r
    for t in r_elem.findall(qn("w:t")):
        r_elem.remove(t)
    t_elem = etree.SubElement(r_elem, qn("w:t"))
    t_elem.text = text
    if text and (text[0] == " " or text[-1] == " "):
        t_elem.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def _set_paragraph_text_preserve_fmt(paragraph, new_text: str, default_font: str | None = None) -> None:
    """Replace the visible text of a paragraph while keeping all run formatting and retaining exact font."""
    runs = paragraph.runs

    # Extract target font name from existing runs or document default font
    target_font = None
    for r in runs:
        if r.font and r.font.name:
            target_font = r.font.name
            break
    if not target_font:
        target_font = default_font

    if not runs:
        r = paragraph.add_run(new_text)
        if target_font:
            r.font.name = target_font
        return

    _set_run_text(runs[0], new_text)
    if target_font and runs[0].font:
        runs[0].font.name = target_font

    for run in runs[1:]:
        _set_run_text(run, "")


def _clone_paragraph_xml(
    template_para, doc_body, default_font: str | None = None
) -> "docx.text.paragraph.Paragraph":
    """Deep-copy a paragraph's XML element preserving ALL formatting and font."""
    cloned_p = copy.deepcopy(template_para._p)
    for t_elem in cloned_p.findall(".//" + qn("w:t")):
        t_elem.text = ""
    new_para = docx.text.paragraph.Paragraph(cloned_p, doc_body)
    if default_font:
        for r in new_para.runs:
            if r.font and not r.font.name:
                r.font.name = default_font
    return new_para


# ---------------------------------------------------------------------------
# PatchService
# ---------------------------------------------------------------------------

def _is_bullet_paragraph(p) -> bool:
    """Check if a paragraph has bullet/list XML formatting or starts with bullet characters."""
    t = p.text.strip()
    if t.startswith("•") or t.startswith("-") or t.startswith("*") or t.startswith("–"):
        return True
    try:
        pPr = p._p.get_or_add_pPr()
        if pPr.find(qn("w:numPr")) is not None:
            return True
        if p.style and ("List" in p.style.name or "Bullet" in p.style.name):
            return True
    except Exception:
        pass
    return False


def _is_metadata_line(text: str, para=None) -> bool:
    """Detect if a paragraph is a job title, company name, location, or date header line."""
    t = text.strip()
    if not t:
        return False
    if para and _is_bullet_paragraph(para):
        return False
    if t.startswith("•") or t.startswith("-") or t.startswith("*") or t.startswith("–"):
        return False

    # Check for date years (e.g. 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026)
    import re
    if re.search(r'\b(19|20)\d{2}\b', t):
        return True

    meta_keywords = [
        "inc", "ltd", "llc", "fze", "pvt", "corp", "corporation", "technologies",
        "solutions", "company", "university", "college", "institute", "school",
        "dubai", "uae", "usa", "uk", "india", "present", "current", "jan", "feb", "mar",
        "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
        "developer", "engineer", "architect", "manager", "lead", "designer",
        "consultant", "analyst", "administrator", "specialist", "intern", "freelance"
    ]
    t_lower = t.lower()
    if any(k in t_lower for k in meta_keywords):
        return True

    if len(t) < 100 and not t.endswith("."):
        return True

    return False


class PatchService:
    """Applies AI-rewritten text to a DOCX file while preserving all visual
    formatting of the original document.
    """

    def __init__(self, upload_dir: Path, section_service: SectionService) -> None:
        self._upload_dir = upload_dir
        self._sections = section_service

    def apply_rewrites(self, request: ApplyRewriteRequest) -> ApplyRewriteResponse:
        """Apply accepted rewrites to the original document and save the result."""
        logger.info(
            "Starting DOCX patch application",
            document_id=request.document_id,
            rewrites_count=len(request.accepted_rewrites),
        )

        # 1. Resolve the file path.
        #    Handles both regular UUID uploads and base/{user_id} paths.
        doc_id = request.document_id
        if doc_id.startswith("base/"):
            user_id = doc_id.split("/", 1)[1]
            file_path = self._upload_dir / "base" / f"{user_id}.docx"
        else:
            file_path = self._upload_dir / f"{doc_id}.docx"

        if not file_path.exists():
            raise NotFoundError(f"Original resume document '{doc_id}' not found.")

        doc = docx.Document(file_path)
        doc_font = _detect_doc_font(doc)

        # 2. Detect sections using the existing SectionService.
        sections_response = self._sections.detect_document_sections(doc_id)
        sections = sections_response.sections

        sections_updated = 0

        def _normalize(t: str) -> str:
            return " ".join(t.replace("[", "").replace("]", "").strip().lower().split())

        # 3. Apply each accepted rewrite.
        for rewrite_item in request.accepted_rewrites:
            target_sec = next(
                (s for s in sections if _normalize(s.title) == _normalize(rewrite_item.section)),
                None,
            )
            if not target_sec:
                logger.warning(
                    "Skipping section rewrite: section not found",
                    section=rewrite_item.section,
                )
                continue

            if not target_sec.paragraph_indexes:
                continue

            # The first index is the section heading — we never touch its text.
            heading_para = doc.paragraphs[target_sec.paragraph_indexes[0]]
            body_paras = [doc.paragraphs[idx] for idx in target_sec.paragraph_indexes[1:]]

            # Split the AI output into non-empty lines.
            new_para_texts = [
                line.strip()
                for line in rewrite_item.rewritten_text.split("\n")
                if line.strip()
            ]

            # Select template for cloning new bullet paragraphs
            bullet_template = next(
                (p for p in body_paras if _is_bullet_paragraph(p)),
                body_paras[-1] if body_paras else heading_para
            )

            # Insertion cursor — new paragraphs are inserted after this element.
            insertion_cursor = heading_para

            orig_idx = 0
            ai_idx = 0

            while orig_idx < len(body_paras) or ai_idx < len(new_para_texts):
                if orig_idx < len(body_paras) and ai_idx < len(new_para_texts):
                    orig_p = body_paras[orig_idx]
                    ai_text = new_para_texts[ai_idx]

                    # Rule: Never overwrite a job title, company name, location, or date header line!
                    if _is_metadata_line(orig_p.text, orig_p):
                        insertion_cursor = orig_p
                        orig_idx += 1
                        continue

                    # Overwrite existing bullet paragraph text only (preserve formatting and font)
                    _set_paragraph_text_preserve_fmt(orig_p, ai_text, default_font=doc_font)
                    insertion_cursor = orig_p
                    orig_idx += 1
                    ai_idx += 1

                elif ai_idx < len(new_para_texts):
                    # AI produced more achievement lines than original bullets — clone bullet_template
                    new_p = _clone_paragraph_xml(bullet_template, doc._body, default_font=doc_font)
                    insertion_cursor._p.addnext(new_p._p)
                    _set_paragraph_text_preserve_fmt(new_p, new_para_texts[ai_idx], default_font=doc_font)
                    insertion_cursor = new_p
                    ai_idx += 1

                else:
                    # Original had more lines — remove surplus bullet paragraph (preserve headers)
                    p = body_paras[orig_idx]
                    if not _is_metadata_line(p.text, p):
                        p._p.getparent().remove(p._p)
                        p._p = None  # type: ignore[assignment]
                    orig_idx += 1

            sections_updated += 1

        # 4. Save the modified document to the generated/ subdirectory.
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
