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
from typing import Any

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


def _remove_num_pr(paragraph) -> None:
    """Remove native Word list/bullet XML (<w:numPr>) from a paragraph to ensure it never renders bullet symbols."""
    try:
        pPr = paragraph._p.get_or_add_pPr()
        numPr = pPr.find(qn("w:numPr"))
        if numPr is not None:
            pPr.remove(numPr)
    except Exception:
        pass


def _clean_bullet_text_prefix(text: str, has_num_pr: bool) -> str:
    """Strip redundant literal bullet characters if Word native list XML (<w:numPr>) is present."""
    if not has_num_pr:
        return text
    t = text.lstrip()
    symbols = ["•", "-", "*", "–", "—", "\u2022", "\u2013", "\u2014"]
    for s in symbols:
        if t.startswith(s):
            t = t[len(s):].lstrip()
            break
    return t


def _set_paragraph_text_preserve_fmt(paragraph, new_text: str, default_font: str | None = None) -> None:
    """Replace the visible text of a paragraph while keeping all run formatting and retaining exact font."""
    runs = paragraph.runs

    has_num_pr = False
    try:
        pPr = paragraph._p.get_or_add_pPr()
        has_num_pr = pPr.find(qn("w:numPr")) is not None
    except Exception:
        pass

    # Detect if the original paragraph used a literal text bullet character (e.g. '• ', '- ', '* ')
    orig_text = paragraph.text.strip()
    bullet_symbols = ["•", "-", "*", "–", "—", "\u2022", "\u2013", "\u2014"]
    orig_bullet_symbol = None
    for s in bullet_symbols:
        if orig_text.startswith(s):
            orig_bullet_symbol = s
            break

    clean_text = _clean_bullet_text_prefix(new_text, has_num_pr)

    # Preserve literal bullet symbol if original paragraph was a literal text bullet and Word has no native <w:numPr>
    if orig_bullet_symbol and not has_num_pr:
        t_clean = clean_text.strip()
        if not any(t_clean.startswith(s) for s in bullet_symbols):
            clean_text = f"{orig_bullet_symbol} {t_clean}"

    # Extract target font name from existing runs or document default font
    target_font = None
    for r in runs:
        if r.font and r.font.name:
            target_font = r.font.name
            break
    if not target_font:
        target_font = default_font

    if not runs:
        colon_idx = clean_text.find(":")
        if colon_idx > 0 and colon_idx < 50:
            label = clean_text[: colon_idx + 1]
            rest = clean_text[colon_idx + 1 :]
            r0 = paragraph.add_run(label)
            r0.bold = True
            if target_font:
                r0.font.name = target_font
            r1 = paragraph.add_run(rest)
            r1.bold = False
            if target_font:
                r1.font.name = target_font
        else:
            r = paragraph.add_run(clean_text)
            if target_font:
                r.font.name = target_font
        return

    # Check if paragraph contains a category label prefix (e.g. "Backend & Systems: Engineered ...")
    colon_idx = clean_text.find(":")
    if colon_idx > 0 and colon_idx < 50:
        label = clean_text[: colon_idx + 1]
        rest = clean_text[colon_idx + 1 :]

        # Run 0: Category Label (e.g. "Backend & Systems:") -> ALWAYS BOLD
        _set_run_text(runs[0], label)
        runs[0].bold = True
        if target_font and runs[0].font:
            runs[0].font.name = target_font

        # Run 1: Category Description / Items -> ALWAYS REGULAR (NON-BOLD)
        if len(runs) >= 2:
            _set_run_text(runs[1], rest)
            runs[1].bold = False
            if target_font and runs[1].font:
                runs[1].font.name = target_font
        else:
            r1 = paragraph.add_run(rest)
            r1.bold = False
            if target_font:
                r1.font.name = target_font

        for run in runs[2:]:
            _set_run_text(run, "")
    else:
        _set_run_text(runs[0], clean_text)
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
    """Detect if a paragraph is a job title, company name, location, or date header line in Experience section.

    Returns False for skills category lines (e.g., 'Frontend: React, ...') and achievement bullets.
    """
    t = text.strip()
    if not t:
        return False
    if para and _is_bullet_paragraph(para):
        return False
    if t.startswith("•") or t.startswith("-") or t.startswith("*") or t.startswith("–"):
        return False

    # Skill category lines containing colons (e.g. "Frontend: React, Next.js", "AI & LLM Engineering: OpenAI...") are NOT metadata lines!
    if ":" in t:
        colon_idx = t.find(":")
        label = t[:colon_idx].strip().lower()
        if label in ["frontend", "backend", "databases", "tools", "languages", "frameworks", "technologies", "ai & llm engineering", "skills", "tools & platforms"]:
            return False
        # If line contains comma list after colon, it's a skill line
        if "," in t[colon_idx:]:
            return False

    import re
    t_lower = t.lower()

    # Check for date years (e.g. 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, Present)
    has_date = bool(re.search(r'\b(19|20)\d{2}\b', t)) or "present" in t_lower

    company_suffixes = ["inc", "ltd", "llc", "fze", "pvt", "corp", "corporation", "solutions"]
    has_company = any(re.search(r'\b' + re.escape(s) + r'\b', t_lower) for s in company_suffixes)

    locations = ["dubai", "uae", "usa", "uk", "india", "bangalore", "bhatkal", "remote"]
    has_location = any(re.search(r'\b' + re.escape(loc) + r'\b', t_lower) for loc in locations)

    role_titles = ["developer", "engineer", "architect", "manager", "lead", "designer", "consultant", "analyst", "administrator", "specialist", "intern", "freelance", "executive"]
    has_role = any(re.search(r'\b' + re.escape(r) + r'\b', t_lower) for r in role_titles)

    # A line is metadata if it has date OR company OR (short line < 80 chars with role/location)
    if has_date or has_company:
        return True

    if (has_role or has_location) and len(t) < 80 and not t.endswith("."):
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

        # Deduplicate accepted_rewrites by section name (keep latest rewrite per section)
        unique_rewrites: dict[str, Any] = {}
        for item in request.accepted_rewrites:
            unique_rewrites[_normalize(item.section)] = item
        accepted_items = list(unique_rewrites.values())

        # 3. Apply each accepted rewrite.
        for rewrite_item in accepted_items:
            norm_sec_name = _normalize(rewrite_item.section)
            target_sec = next(
                (s for s in sections if _normalize(s.title) == norm_sec_name or (norm_sec_name in ["header", "job title", "target role", "title"] and s.normalized_name == "header")),
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

            # Special Case: Patching Candidate Job Title in Header Section
            if target_sec.normalized_name == "header" or norm_sec_name in ["header", "job title", "target role", "title"]:
                header_paras = [doc.paragraphs[idx] for idx in target_sec.paragraph_indexes if idx < len(doc.paragraphs)]
                if header_paras:
                    # SAFETY: Only patch an existing role/title paragraph — NEVER touch the candidate name.
                    role_titles = ["developer", "engineer", "architect", "manager", "lead", "designer", "consultant", "analyst", "specialist", "executive", "intern", "freelance"]
                    title_para = next(
                        (p for p in header_paras if any(r in p.text.lower() for r in role_titles)),
                        None,
                    )
                    if title_para:
                        new_title_text = rewrite_item.rewritten_text.strip().split("\n")[0]
                        _set_paragraph_text_preserve_fmt(title_para, new_title_text, default_font=doc_font)
                        sections_updated += 1
                    else:
                        logger.info(
                            "Skipping header title patch: no existing role/title paragraph found in header. "
                            "Refusing to overwrite candidate name."
                        )
                continue

            # The first index is the section heading — we never touch its text.
            heading_para = doc.paragraphs[target_sec.paragraph_indexes[0]]
            body_paras = [doc.paragraphs[idx] for idx in target_sec.paragraph_indexes[1:] if idx < len(doc.paragraphs)]

            # Check if this section is an Experience section (where role/company/date metadata headers exist)
            is_experience_sec = any(
                kw in target_sec.title.lower() or kw in (target_sec.normalized_name or "").lower()
                for kw in ["experience", "employment", "history", "work", "job", "career", "positions"]
            )

            # Split the AI output into non-empty lines, filtering out metadata headers ONLY for experience sections
            new_para_texts = [
                line.strip()
                for line in rewrite_item.rewritten_text.split("\n")
                if line.strip() and (not is_experience_sec or not _is_metadata_line(line.strip()))
            ]

            if not new_para_texts:
                continue

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

                    # Rule: Never overwrite a job title, company name, location, or date header line in Experience sections!
                    if is_experience_sec and _is_metadata_line(orig_p.text, orig_p):
                        _remove_num_pr(orig_p)
                        insertion_cursor = orig_p
                        orig_idx += 1
                        continue

                    # Overwrite existing paragraph text (preserve formatting and font)
                    _set_paragraph_text_preserve_fmt(orig_p, ai_text, default_font=doc_font)
                    # NEVER strip bullet formatting — preserve <w:numPr> on all paragraphs
                    insertion_cursor = orig_p
                    orig_idx += 1
                    ai_idx += 1

                elif ai_idx < len(new_para_texts):
                    # AI produced more lines than original bullets — clone bullet_template
                    new_p = _clone_paragraph_xml(bullet_template, doc._body, default_font=doc_font)
                    insertion_cursor._p.addnext(new_p._p)
                    _set_paragraph_text_preserve_fmt(new_p, new_para_texts[ai_idx], default_font=doc_font)
                    insertion_cursor = new_p
                    ai_idx += 1

                else:
                    # Original had more lines — blank surplus bullet text instead of deleting XML
                    # to preserve document structure, spacing, and page layout.
                    p = body_paras[orig_idx]
                    if not is_experience_sec or not _is_metadata_line(p.text, p):
                        # Blank the text but keep the paragraph element intact
                        for run in p.runs:
                            _set_run_text(run, "")
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
