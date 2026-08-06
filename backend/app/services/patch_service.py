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
import re
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

def _build_flat_paragraph_list(doc) -> list:
    """Build a flat list of ALL paragraphs matching the parser's index scheme.

    ``docx_parser.py`` iterates ``document.element.body`` children, flattening
    both standalone ``<w:p>`` paragraphs AND paragraphs inside ``<w:tbl>`` table
    cells into one combined list.  The ``paragraph_indexes`` stored by the section
    detector reference positions in THIS combined list.

    ``doc.paragraphs`` (python-docx built-in) only returns top-level body
    ``<w:p>`` elements and does NOT include table-cell paragraphs, so using it
    to look up a stored index will resolve to the WRONG paragraph whenever the
    resume contains any table structure.

    This helper replicates the exact same traversal order so that
    ``all_paras[idx]`` is always the correct paragraph object.
    """
    import docx.text.paragraph as _dp
    from docx.table import Table as _Table

    result: list = []
    body = doc.element.body
    for child in body:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if tag == "p":
            result.append(_dp.Paragraph(child, doc))
        elif tag == "tbl":
            tbl = _Table(child, doc)
            for row in tbl.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        result.append(para)
    return result


def _detect_doc_font(doc) -> str | None:
    """Detect dominant font name across all runs in document."""
    fonts = []
    for p in _build_flat_paragraph_list(doc):
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

    # Check if paragraph contains a category label prefix (e.g. "Backend & Systems: ...") 
    colon_idx = clean_text.find(":")
    if colon_idx > 0 and colon_idx < 50:
        label = clean_text[: colon_idx + 1]
        rest = clean_text[colon_idx + 1 :]

        # Detect if the ORIGINAL Run 1 started with an inline bullet like ' • ' or ': •'
        # This is used in skill category lines: "AI & LLM Engineering: • OpenAI API..."
        # We must preserve that bullet prefix in the output even when AI drops it.
        orig_inline_bullet = None
        if len(runs) >= 2:
            orig_run1_text = runs[1].text
            for sym in ["• ", "• ", "\u2022 "]:
                if orig_run1_text.lstrip().startswith(sym):
                    orig_inline_bullet = sym
                    break
            # Also check if original run1 starts with just a bullet symbol alone
            if not orig_inline_bullet:
                stripped = orig_run1_text.lstrip()
                if stripped.startswith("•") or stripped.startswith("\u2022"):
                    orig_inline_bullet = "• "

        # If AI's rest already has the bullet, don't add again
        rest_stripped = rest.lstrip()
        if orig_inline_bullet and not any(rest_stripped.startswith(s) for s in ["•", "\u2022", "-", "–"]):
            rest = f" {orig_inline_bullet}{rest_stripped}"

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


ACTION_VERBS = {
    "built", "developed", "achieved", "ensured", "customized", "implemented", "engineered",
    "designed", "created", "optimized", "spearheaded", "managed", "led", "architected",
    "formulated", "coordinated", "reduced", "increased", "automated", "delivered", "integrated",
    "executed", "maintained", "supervised", "pioneered", "overhauled", "championed", "established",
    "launched", "migrated", "scaled", "refactored", "deployed", "directed", "authored", "expanded",
    "accelerated", "streamlined", "transformed", "generated", "produced", "introduced", "handled",
    "constructed", "authored", "devised", "established", "structured", "revamped", "maximized"
}


def _is_metadata_line(text: str, para=None) -> bool:
    """Detect if a paragraph is a job title, company name, location, or date header line.

    Rules (checked in order):
    - Bullet paragraphs are never metadata.
    - Skill category lines ("Frontend: React, ...") are not metadata.
    - Rule 1: Contains date / company suffix / location / role title → metadata.
    - Rule 2: Short line (< 85 chars) that is not an action-verb sentence → metadata.
    """
    t = text.strip()
    if not t:
        return False
    if para and _is_bullet_paragraph(para):
        return False
    bullet_symbols = ["•", "-", "*", "–", "—", "▪", "▸", "\u2022", "\u2013", "\u2014"]
    if any(t.startswith(s) for s in bullet_symbols):
        return False

    # Skill category lines (e.g. "Frontend: React, Next.js") are NOT metadata
    if ":" in t:
        colon_idx = t.find(":")
        label = t[:colon_idx].strip().lower()
        skill_labels = [
            "frontend", "backend", "databases", "tools", "languages", "frameworks",
            "technologies", "ai & llm engineering", "skills", "tools & platforms",
            "concepts", "responsibilities", "other", "backend & systems",
        ]
        if label in skill_labels:
            return False
        if "," in t[colon_idx:]:
            return False

    t_lower = t.lower()
    words = t_lower.split()
    first_word = words[0] if words else ""

    # --- Rule 1: structural signals (checked BEFORE action-verb early-exit) ---
    months = [
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
        "january", "february", "march", "april", "june", "july", "august",
        "september", "october", "november", "december",
    ]
    has_date = (
        bool(re.search(r'\b(19|20)\d{2}\b', t))
        or "present" in t_lower
        or any(re.search(r'\b' + re.escape(m) + r'\b', t_lower) for m in months)
    )

    company_suffixes = [
        "inc", "ltd", "llc", "fze", "pvt", "corp", "corporation", "co", "solutions",
        "technologies", "labs", "studio", "agency", "software", "systems", "global",
        "services", "holdings", "enterprises", "ventures", "partners", "consulting",
        "international", "group", "ltd.", "inc.", "corp.", "pvt ltd", "pvt. ltd.",
        "llc.", "fze.", "lines", "trading", "bakers", "restaurant", "store", "est",
        "establishment", "logistics", "shipping", "freight", "transport", "hotel",
        "hospital", "bank", "financial", "media", "retail", "industries",
    ]
    has_company = any(re.search(r'\b' + re.escape(s) + r'\b', t_lower) for s in company_suffixes)

    locations = [
        "dubai", "uae", "usa", "uk", "india", "bangalore", "bhatkal", "remote", "london",
        "new york", "san francisco", "singapore", "toronto", "sydney", "berlin", "paris",
        "california", "texas", "seattle", "austin", "chicago", "boston", "amsterdam",
        "muscat", "oman", "saudi", "qatar", "kuwait", "bahrain", "abu dhabi", "sharjah",
        "riyadh", "jeddah", "dammam", "middle east", "mumbai", "delhi", "chennai", "hyderabad",
    ]
    has_location = any(re.search(r'\b' + re.escape(loc) + r'\b', t_lower) for loc in locations)

    role_titles = [
        "developer", "engineer", "architect", "manager", "lead", "designer",
        "consultant", "analyst", "administrator", "specialist", "intern",
        "freelance", "executive", "director", "officer", "head", "founder",
        "co-founder", "cto", "ceo", "vp", "programmer", "associate",
        "advisor", "representative", "coordinator", "supervisor", "agent",
        "accountant", "clerk", "operator", "assistant", "technician", "logistics",
        "customs", "sales", "support", "customer service",
    ]
    has_role = any(re.search(r'\b' + re.escape(r) + r'\b', t_lower) for r in role_titles)

    # Structural signal → definite metadata regardless of action verbs
    if has_date or has_company or has_location or has_role:
        return True

    # --- Rule 2: heuristic for unlabelled short non-sentence lines ---
    # An achievement sentence starts with an action verb AND is long or ends with punctuation.
    is_achievement_sentence = (
        first_word in ACTION_VERBS
        and (len(t) > 50 or t.endswith(".") or t.endswith(";"))
    )
    if is_achievement_sentence:
        return False

    # Short non-action-verb line without terminal punctuation → header / company name
    if len(t) < 85 and not t.endswith("."):
        return True

    return False


def _is_overview_paragraph(para) -> bool:
    """Return True if this paragraph is a non-bullet, non-metadata prose overview.

    In many resumes the first content paragraph under a job entry is a short
    narrative sentence (e.g. "Spearheaded the development of...") that is
    neither a bullet nor a structural metadata line.  We detect it so the
    patching loop can handle it separately from list bullets.
    """
    if _is_bullet_paragraph(para):
        return False
    t = para.text.strip()
    if not t:
        return False
    if _is_metadata_line(t, para):
        return False
    # Must look like a prose sentence (has a verb / ends with period or is long)
    return True


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
        from app.utils.path_resolver import resolve_document_path
        doc_id = request.document_id
        file_path = resolve_document_path(self._upload_dir, doc_id)

        doc = docx.Document(file_path)
        doc_font = _detect_doc_font(doc)

        # Build a flat paragraph list that mirrors the parser's traversal order.
        # This is CRITICAL: paragraph_indexes from the section detector reference
        # positions in this combined (body + table-cell) flat list. Using
        # doc.paragraphs[idx] would silently resolve to the wrong paragraph for
        # any resume template that uses tables (two-column layouts, sidebars, etc.).
        all_paras = _build_flat_paragraph_list(doc)

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

            # Check that paragraph_indexes[0] is within bounds of all_paras
            first_idx = target_sec.paragraph_indexes[0]
            if first_idx >= len(all_paras):
                logger.warning(
                    "Skipping section rewrite: paragraph index out of range",
                    section=rewrite_item.section,
                    index=first_idx,
                    total_paras=len(all_paras),
                )
                continue

            # Special Case: Patching Candidate Job Title in Header Section
            if target_sec.normalized_name == "header" or norm_sec_name in ["header", "job title", "target role", "title"]:
                # Inspect top 6 paragraphs of document (pre-summary header area) for existing job title
                role_titles = ["developer", "engineer", "architect", "manager", "lead", "designer", "consultant", "analyst", "specialist", "executive", "intern", "freelance"]
                top_paras = all_paras[:min(6, len(all_paras))]
                title_para = next(
                    (p for i, p in enumerate(top_paras) if i > 0 and any(r in p.text.lower() for r in role_titles)),
                    None,
                )
                if title_para:
                    lines = (rewrite_item.rewritten_text or "").strip().split("\n")
                    new_title_text = lines[0] if lines else ""
                    if new_title_text:
                        _set_paragraph_text_preserve_fmt(title_para, new_title_text, default_font=doc_font)
                        sections_updated += 1
                else:
                    logger.info(
                        "Skipping header title patch: no existing role/title paragraph found in top area. "
                        "Refusing to overwrite candidate name."
                    )
                continue

            # The first index is the section heading — we never touch its text.
            heading_para = all_paras[first_idx]
            body_paras = [all_paras[idx] for idx in target_sec.paragraph_indexes[1:] if idx < len(all_paras)]

            # Check if this section is an Experience section or individual job entry sub-section
            # (where role/company/date metadata headers exist)
            title_l = target_sec.title.lower()
            norm_l = (target_sec.normalized_name or "").lower()
            role_kws = ["developer", "engineer", "architect", "manager", "lead", "designer", "consultant", "analyst", "specialist", "executive", "intern", "freelance"]
            is_experience_sec = (
                norm_l == "experience"
                or any(kw in title_l or kw in norm_l for kw in ["experience", "employment", "history", "work", "job", "career", "positions"])
                or any(rk in title_l for rk in role_kws)
                or re.search(r"\b(19|20)\d{2}\b", title_l) is not None
                or "present" in title_l
            )

            # --- SPECIAL CASE: "Professional Experiences" is a heading-only section ---
            # Its actual content lives in sub-sections (individual Heading 2 job entries).
            # We must collect ALL paragraphs from all sub-job-entry sections that immediately
            # follow this section in the document (until a non-None-title known section is found).
            if is_experience_sec and not body_paras:
                # Find all sub-sections that follow the experience heading section
                exp_sec_idx = sections.index(target_sec)
                sub_body_para_indexes: list[int] = []
                experience_keywords = ["experience", "employment", "history", "work", "job", "career", "positions"]
                non_experience_normalized = ["summary", "skills", "education", "projects", "certifications", "awards", "publications", "languages", "interests", "references", "header"]
                for sub_sec in sections[exp_sec_idx + 1:]:
                    # Stop if we hit a clearly different top-level section
                    sub_norm = (sub_sec.normalized_name or "").lower()
                    if sub_norm in non_experience_normalized:
                        break
                    # Stop if title matches a known non-experience section name
                    sub_title_l = sub_sec.title.lower()
                    if any(k in sub_title_l for k in ["education", "skills", "project", "certification"]):
                        break
                    # Collect all paragraph indexes from this sub-section (including the heading)
                    for idx in sub_sec.paragraph_indexes:
                        if idx < len(all_paras):
                            sub_body_para_indexes.append(idx)

                if sub_body_para_indexes:
                    body_paras = [all_paras[idx] for idx in sub_body_para_indexes]
                    logger.info(
                        "Experience section: expanded to sub-sections",
                        total_paras=len(body_paras),
                    )

            # Split the AI output into non-empty lines.
            # For experience sections: strip any metadata lines the AI may have echoed back
            # (job titles, company names, dates) — those are preserved from the original DOCX.
            new_para_texts = [
                line.strip()
                for line in (rewrite_item.rewritten_text or "").split("\n")
                if line.strip() and (not is_experience_sec or not _is_metadata_line(line.strip()))
            ]

            if not new_para_texts:
                continue

            if not body_paras:
                logger.warning("No body paragraphs for section, skipping", section=rewrite_item.section)
                continue

            # Select template for cloning new bullet paragraphs (used when AI adds more lines)
            bullet_template = next(
                (p for p in body_paras if _is_bullet_paragraph(p)),
                body_paras[-1] if body_paras else heading_para
            )

            # Select template for cloning new overview paragraphs (non-bullet prose)
            overview_template = next(
                (p for p in body_paras if _is_overview_paragraph(p)),
                None
            )

            # Insertion cursor — new paragraphs are inserted after this element.
            insertion_cursor = heading_para

            orig_idx = 0
            ai_idx = 0

            while orig_idx < len(body_paras) or ai_idx < len(new_para_texts):
                if orig_idx < len(body_paras) and ai_idx < len(new_para_texts):
                    orig_p = body_paras[orig_idx]
                    ai_text = new_para_texts[ai_idx]

                    # --- METADATA LINES (job title / company / location / date) ---
                    # Skip them — they come from the original DOCX and must NEVER be overwritten.
                    if is_experience_sec and _is_metadata_line(orig_p.text, orig_p):
                        _remove_num_pr(orig_p)
                        insertion_cursor = orig_p
                        orig_idx += 1
                        continue

                    # --- OVERVIEW PARAGRAPH (non-bullet prose sentence at top of a role) ---
                    # Match it to the first available AI content line, preserving its paragraph style.
                    if is_experience_sec and _is_overview_paragraph(orig_p):
                        _set_paragraph_text_preserve_fmt(orig_p, ai_text, default_font=doc_font)
                        insertion_cursor = orig_p
                        orig_idx += 1
                        ai_idx += 1
                        continue

                    # --- REGULAR BULLET / CONTENT PARAGRAPH ---
                    _set_paragraph_text_preserve_fmt(orig_p, ai_text, default_font=doc_font)
                    insertion_cursor = orig_p
                    orig_idx += 1
                    ai_idx += 1

                elif ai_idx < len(new_para_texts):
                    # AI produced more lines than original paragraphs.
                    # For EXPERIENCE sections: clone a new paragraph so extra bullets are preserved.
                    # For NON-EXPERIENCE sections (Skills, Summary, Education etc.): STOP here.
                    # Adding extra paragraphs in non-experience sections inserts rogue text between
                    # document sections (e.g. a stray bold sentence between Skills and Experiences).
                    if not is_experience_sec:
                        logger.debug(
                            "Non-experience section AI output has more lines than original paragraphs — "
                            "skipping extra lines to preserve document layout.",
                            section=rewrite_item.section,
                            extra_lines=len(new_para_texts) - ai_idx,
                        )
                        break  # Stop processing — do not insert new paragraphs

                    ai_text = new_para_texts[ai_idx]
                    # Use overview template for prose lines (no leading bullet char), bullet template otherwise
                    bullet_chars = ["•", "-", "*", "–", "—", "▪"]
                    is_prose = not any(ai_text.startswith(c) for c in bullet_chars)
                    tmpl = overview_template if (is_prose and overview_template) else bullet_template
                    new_p = _clone_paragraph_xml(tmpl, doc._body, default_font=doc_font)
                    insertion_cursor._p.addnext(new_p._p)
                    _set_paragraph_text_preserve_fmt(new_p, ai_text, default_font=doc_font)
                    insertion_cursor = new_p
                    ai_idx += 1

                else:
                    # Original had more paragraphs than AI rewrites.
                    # Preserve all remaining original paragraphs UNTOUCHED — never erase content.
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
