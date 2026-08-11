"""Structured Resume Text Serializer.

Converts a ``StructuredResume`` JSON object into:
  1. A ``list[SectionItem]`` that can be fed directly into the analysis
     pipeline (comparison + review) without loading any DOCX file.
  2. A plain-text string that can be used as a fallback for AI prompts
     or for downstream text-based services.

This is the bridge between the new JSON-first architecture and the existing
analysis pipeline that was originally built around raw DOCX paragraphs.
"""

from app.schemas.section import SectionItem, SectionParagraph
from app.schemas.structured_resume import StructuredResume


def _make_section(title: str, normalized: str, lines: list[str], idx_offset: int) -> SectionItem:
    """Helper to build a SectionItem from a list of text lines."""
    paragraphs: list[SectionParagraph] = []
    para_indexes: list[int] = []
    for i, line in enumerate(lines):
        if not line.strip():
            continue
        abs_idx = idx_offset + i
        paragraphs.append(SectionParagraph(index=abs_idx, text=line, style_name="Normal"))
        para_indexes.append(abs_idx)

    return SectionItem(
        title=title,
        normalized_name=normalized,
        paragraph_indexes=para_indexes,
        paragraphs=paragraphs,
    )


def serialize_to_sections(resume: StructuredResume) -> list[SectionItem]:
    """Convert a ``StructuredResume`` into a ``list[SectionItem]``.

    The resulting list can be passed directly to ``ComparisonService.compare()``
    and ``ReviewService.review_resume()`` without any DOCX file on disk.

    Paragraph index numbers are synthetic (sequential integers) — they are
    only used internally for section boundary tracking, so uniqueness within
    the returned list is all that matters.
    """
    sections: list[SectionItem] = []
    idx = 0

    # ── Contact / Header section ─────────────────────────────────────────────
    contact = resume.contact_info
    header_lines = []
    if contact.full_name:
        header_lines.append(contact.full_name)
    if contact.email:
        header_lines.append(contact.email)
    if contact.phone:
        header_lines.append(contact.phone)
    if contact.location:
        header_lines.append(contact.location)
    if contact.linkedin_url:
        header_lines.append(contact.linkedin_url)
    if contact.portfolio_url:
        header_lines.append(contact.portfolio_url)
    if contact.github_url:
        header_lines.append(contact.github_url)
    if header_lines:
        s = _make_section("Contact", "header", header_lines, idx)
        sections.append(s)
        idx += len(header_lines)

    # ── Summary section ───────────────────────────────────────────────────────
    if resume.summary and resume.summary.strip():
        s = _make_section("Summary", "summary", [resume.summary.strip()], idx)
        sections.append(s)
        idx += 1

    # ── Dynamic sections from resume.sections ─────────────────────────────────
    for sec in sorted(resume.sections, key=lambda x: x.order):
        if not sec.visible:
            continue

        section_type = sec.section_type
        content = sec.content
        lines: list[str] = []

        if section_type == "summary":
            text = content.get("text") or ""
            if text.strip():
                lines.append(text.strip())

        elif section_type == "skills":
            categories = content.get("categories") or []
            for cat in categories:
                cat_name = cat.get("category_name") or ""
                skills = cat.get("skills") or []
                if cat_name and skills:
                    lines.append(f"{cat_name}: {', '.join(skills)}")
                elif skills:
                    lines.extend(skills)

        elif section_type == "experience":
            entries = content.get("entries") or []
            for entry in entries:
                if entry.get("job_title"):
                    lines.append(entry["job_title"])
                if entry.get("company"):
                    meta = entry["company"]
                    if entry.get("location"):
                        meta += f", {entry['location']}"
                    if entry.get("start_date"):
                        meta += f" | {entry['start_date']} - {entry.get('end_date', 'Present')}"
                    lines.append(meta)
                lines.extend(entry.get("bullets") or [])

        elif section_type == "education":
            entries = content.get("entries") or []
            for entry in entries:
                if entry.get("degree"):
                    lines.append(entry["degree"])
                if entry.get("institution"):
                    lines.append(entry["institution"])
                if entry.get("graduation_date"):
                    lines.append(entry["graduation_date"])
                lines.extend(entry.get("details") or [])

        elif section_type == "projects":
            entries = content.get("entries") or []
            for entry in entries:
                if entry.get("name"):
                    lines.append(entry["name"])
                if entry.get("description"):
                    lines.append(entry["description"])
                techs = entry.get("technologies") or []
                if techs:
                    lines.append(f"Technologies: {', '.join(techs)}")
                lines.extend(entry.get("bullets") or [])

        elif section_type == "certifications":
            entries = content.get("entries") or []
            for entry in entries:
                name = entry.get("name") or ""
                issuer = entry.get("issuer") or ""
                date = entry.get("date") or ""
                cert_line = name
                if issuer:
                    cert_line += f" — {issuer}"
                if date:
                    cert_line += f" ({date})"
                if cert_line:
                    lines.append(cert_line)

        elif section_type == "custom":
            entries = content.get("entries") or []
            lines.extend([str(e) for e in entries if e])

        if lines:
            s = _make_section(sec.section_title, section_type, lines, idx)
            sections.append(s)
            idx += len(lines)

    return sections


def serialize_to_plain_text(resume: StructuredResume) -> str:
    """Convert a ``StructuredResume`` to a flat plain-text string.

    Useful for AI prompt contexts where a plain text representation is needed.
    """
    sections = serialize_to_sections(resume)
    parts: list[str] = []
    for sec in sections:
        parts.append(f"[{sec.title}]")
        parts.extend([p.text for p in sec.paragraphs])
        parts.append("")
    return "\n".join(parts).strip()
