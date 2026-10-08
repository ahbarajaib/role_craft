"""Structured Resume Injection Service.

Injects content from a StructuredResume object into the user's original uploaded
DOCX file, preserving 100% of original visual formatting (fonts, colors, spacing,
bullets, tables) while replacing text content section by section.
"""

from io import BytesIO
from pathlib import Path

import docx
from docx.oxml.ns import qn
from loguru import logger
from lxml import etree

from app.schemas.structured_resume import StructuredResume

SECTION_HEADER_KEYWORDS = {
    "summary": ["summary", "profile", "objective", "about", "introduction", "professional summary"],
    "experience": ["experience", "work history", "employment", "career", "professional experience", "work experience"],
    "education": ["education", "academic", "qualification", "degree", "university", "schooling"],
    "skills": ["skills", "technical skills", "core competencies", "technologies", "expertise", "competencies"],
    "projects": ["projects", "portfolio", "personal projects", "key projects"],
    "certifications": ["certifications", "certificates", "licenses", "credentials", "courses"],
}


def _detect_section_type(text: str) -> str | None:
    t = text.strip().lower()
    if not t or len(t) > 60:
        return None
    for sec_type, keywords in SECTION_HEADER_KEYWORDS.items():
        for kw in keywords:
            if kw in t:
                return sec_type
    return None


def _is_section_header(para) -> bool:
    text = para.text.strip()
    if not text or len(text) > 60:
        return False
    if para.style and para.style.name and "heading" in para.style.name.lower():
        return True
    runs = para.runs
    if runs and all(r.bold for r in runs if r.text.strip()):
        return True
    if text.isupper() and len(text) > 3:
        return True
    return _detect_section_type(text) is not None


def _set_run_text(run, text: str) -> None:
    r_elem = run._r
    for t in r_elem.findall(qn("w:t")):
        r_elem.remove(t)
    t_elem = etree.SubElement(r_elem, qn("w:t"))
    t_elem.text = text
    if text and (text[0] == " " or text[-1] == " "):
        t_elem.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def _set_paragraph_text(paragraph, new_text: str) -> None:
    runs = paragraph.runs
    if not runs:
        paragraph.add_run(new_text)
        return
    _set_run_text(runs[0], new_text)
    for run in runs[1:]:
        _set_run_text(run, "")


def _build_flat_paragraph_list(doc) -> list:
    import docx.text.paragraph as _dp
    from docx.table import Table as _Table
    result = []
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


def _resume_to_section_texts(resume: StructuredResume) -> dict:
    result: dict = {}

    ci = resume.contact_info
    contact_lines = []
    if ci.full_name:
        contact_lines.append(ci.full_name)
    if ci.job_title:
        contact_lines.append(ci.job_title)
    parts = [p for p in [ci.email, ci.phone] if p]
    if parts:
        contact_lines.append(" | ".join(parts))
    if ci.location:
        contact_lines.append(ci.location)
    links = [p for p in [ci.linkedin_url, ci.portfolio_url, ci.github_url] if p]
    if links:
        contact_lines.append(" | ".join(links))
    result["contact"] = contact_lines

    for section in resume.sections:
        if not section.visible:
            continue
        sec_type = section.section_type
        content = section.content
        lines: list = []

        if sec_type == "summary":
            text = content.get("text", "")
            if text:
                lines.append(text)

        elif sec_type == "experience":
            for entry in content.get("entries", []):
                for bullet in entry.get("bullets", []):
                    lines.append(f"• {bullet}" if not bullet.startswith("•") else bullet)

        elif sec_type == "skills":
            for cat in content.get("categories", []):
                cat_name = cat.get("category_name", "")
                skills = cat.get("skills", [])
                if cat_name and skills:
                    lines.append(f"{cat_name}: {', '.join(skills)}")
                elif skills:
                    lines.extend(skills)

        elif sec_type == "education":
            for entry in content.get("entries", []):
                if entry.get("degree"):
                    lines.append(entry["degree"])
                if entry.get("institution"):
                    lines.append(entry["institution"])
                for detail in entry.get("details", []):
                    lines.append(detail)

        elif sec_type == "projects":
            for proj in content.get("entries", []):
                if proj.get("name"):
                    lines.append(proj["name"])
                if proj.get("description"):
                    lines.append(proj["description"])
                for bullet in proj.get("bullets", []):
                    lines.append(f"• {bullet}" if not bullet.startswith("•") else bullet)

        elif sec_type == "certifications":
            for cert in content.get("entries", []):
                parts = [p for p in [cert.get("name"), cert.get("issuer"), cert.get("date")] if p]
                if parts:
                    lines.append(" | ".join(parts))

        elif sec_type == "custom":
            for entry in content.get("entries", []):
                lines.append(str(entry))

        if lines:
            result[sec_type] = lines

    return result


class StructuredResumeInjectionService:
    """Injects StructuredResume content into an original uploaded DOCX."""

    def __init__(self, upload_dir: Path) -> None:
        self._upload_dir = upload_dir

    def inject_into_original(
        self,
        original_docx_path: Path,
        resume: StructuredResume,
    ) -> bytes:
        """Inject resume content into original DOCX, return modified bytes."""
        doc = docx.Document(str(original_docx_path))
        all_paras = _build_flat_paragraph_list(doc)
        section_texts = _resume_to_section_texts(resume)

        section_headers: list = []
        first_header_idx = len(all_paras)

        for idx, para in enumerate(all_paras):
            if _is_section_header(para):
                sec_type = _detect_section_type(para.text)
                if sec_type:
                    section_headers.append((idx, sec_type))
                    first_header_idx = min(first_header_idx, idx)

        logger.info("Injection: detected headers", headers=[(i, t) for i, t in section_headers])

        # Inject contact info into paragraphs before first section header
        contact_lines = section_texts.get("contact", [])
        contact_paras = [p for p in all_paras[:first_header_idx] if p.text.strip()]
        if contact_lines and contact_paras:
            for i, line in enumerate(contact_lines):
                if i < len(contact_paras):
                    _set_paragraph_text(contact_paras[i], line)
            for i in range(len(contact_lines), len(contact_paras)):
                _set_paragraph_text(contact_paras[i], "")

        # Inject each section
        for h_idx, (header_para_idx, sec_type) in enumerate(section_headers):
            new_lines = section_texts.get(sec_type, [])
            if not new_lines:
                continue

            next_header_para_idx = (
                section_headers[h_idx + 1][0]
                if h_idx + 1 < len(section_headers)
                else len(all_paras)
            )

            content_paras = [
                all_paras[i]
                for i in range(header_para_idx + 1, next_header_para_idx)
                if all_paras[i].text.strip()
            ]

            if not content_paras:
                continue

            for i, line in enumerate(new_lines):
                if i < len(content_paras):
                    _set_paragraph_text(content_paras[i], line)

            for i in range(len(new_lines), len(content_paras)):
                _set_paragraph_text(content_paras[i], "")

            logger.debug("Injected", sec_type=sec_type, lines=len(new_lines), slots=len(content_paras))

        output = BytesIO()
        doc.save(output)
        output.seek(0)
        return output.read()
