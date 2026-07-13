"""Resume section detector.

Converts a flat list of parsed paragraphs into a list of logical resume
sections.

This module sits in the Analyzer layer (Phase 2 – Resume Understanding).
Like the parser, it is intentionally pure:

- Input:  list[ParsedParagraph]
- Output: list[DetectedSection]
- No HTTP, no filesystem, no services.
- All logic can be exercised with plain Python objects in a unit test.

Detection Strategy
------------------
A paragraph is treated as a section heading when *either* condition is met:

  1. Style signal — the Word paragraph style name contains the word
     "heading" (case-insensitive).  This catches paragraphs explicitly
     styled as Heading 1/2/3 etc. in well-formatted resumes.

  2. Text signal — the paragraph's normalised text matches one of the
     known section names in ``SECTION_NAME_MAP``.  This catches resumes
     where headings are written in bold Normal style rather than a real
     Heading style.

Using both signals rather than either alone makes the detector robust
against the two most common formatting conventions found in real resumes.

Unknown headings (style matches but text is not in the known map) are kept
as custom sections with ``normalized_name = None`` rather than being
discarded, so no content is ever silently lost.

Pre-heading paragraphs (before any heading is encountered) are collected
into a special "header" section that typically contains the candidate's
name and contact details.
"""

from dataclasses import dataclass, field

from app.parsers.docx_parser import ParsedParagraph

# ── Known section name map ────────────────────────────────────────────────────
#
# Maps every recognised heading variant (lowercase, stripped) to its
# canonical normalized_name.  The canonical name is what downstream
# services (AI analyzer, suggestion generator) will key on, so spelling
# and casing here must stay stable across milestones.

SECTION_NAME_MAP: dict[str, str] = {
    # Summary
    "summary": "summary",
    "professional summary": "summary",
    "profile": "summary",
    "about me": "summary",
    "career summary": "summary",
    "objective": "summary",
    "career objective": "summary",
    # Skills
    "skills": "skills",
    "technical skills": "skills",
    "core skills": "skills",
    "core competencies": "skills",
    "key skills": "skills",
    "technologies": "skills",
    # Experience
    "experience": "experience",
    "experiences": "experience",
    "work experience": "experience",
    "work experiences": "experience",
    "professional experience": "experience",
    "professional experiences": "experience",
    "employment history": "experience",
    "employment": "experience",
    "career history": "experience",
    # Projects
    "project": "projects",
    "projects": "projects",
    "personal projects": "projects",
    "key projects": "projects",
    "selected projects": "projects",
    # Education
    "education": "education",
    "educations": "education",
    "educational background": "education",
    "academic background": "education",
    # Certifications
    "certifications": "certifications",
    "certificates": "certifications",
    "licenses": "certifications",
    "licenses & certifications": "certifications",
    "licenses and certifications": "certifications",
}

# Canonical name for the implicit header section that precedes all headings.
HEADER_SECTION = "header"


# ── Output data structures ────────────────────────────────────────────────────


@dataclass
class DetectedSection:
    """A logical section of a resume.

    ``paragraph_indexes`` stores the original document positions (the
    ``index`` field from ``ParsedParagraph``) rather than list indices so
    that a future patching milestone can locate the exact paragraphs to
    modify without re-running the parser.
    """

    title: str
    """Heading text exactly as it appears in the document."""

    normalized_name: str | None
    """Canonical section identifier from ``SECTION_NAME_MAP``, or ``None``
    for unknown custom sections."""

    paragraph_indexes: list[int] = field(default_factory=list)
    """Original document positions of every paragraph in this section,
    including the heading paragraph itself."""

    paragraphs: list[ParsedParagraph] = field(default_factory=list)
    """Full paragraph objects for convenient access by callers."""


# ── Public API ────────────────────────────────────────────────────────────────


def detect_sections(paragraphs: list[ParsedParagraph]) -> list[DetectedSection]:
    """Group parsed paragraphs into logical resume sections.

    Parameters
    ----------
    paragraphs:
        Non-empty paragraphs in document order, as returned by
        ``parse_docx``.  The function does not mutate the input list.

    Returns
    -------
    list[DetectedSection]
        Sections in the order they appear in the document.  Pre-heading
        content (name, contact info) is placed in a synthetic ``header``
        section.  Every input paragraph belongs to exactly one section.
    """
    sections: list[DetectedSection] = []
    current: DetectedSection | None = None

    for para in paragraphs:
        if _is_heading(para):
            # Commit the previous section before starting a new one.
            if current is not None:
                sections.append(current)
            current = DetectedSection(
                title=para.text,
                normalized_name=_normalize(para.text),
                paragraph_indexes=[para.index],
                paragraphs=[para],
            )
        else:
            if current is None:
                # Content before the first heading → implicit header section.
                current = DetectedSection(
                    title=HEADER_SECTION,
                    normalized_name=HEADER_SECTION,
                    paragraph_indexes=[],
                    paragraphs=[],
                )
            current.paragraph_indexes.append(para.index)
            current.paragraphs.append(para)

    # Commit the last open section.
    if current is not None:
        sections.append(current)

    return sections


# ── Private helpers ───────────────────────────────────────────────────────────


def _is_heading(para: ParsedParagraph) -> bool:
    """Return True when the paragraph should be treated as a section heading.

    Either a Word Heading style OR a known section title text qualifies.
    The two-signal approach handles both well-formatted and poorly-formatted
    resumes without requiring AI involvement.
    """
    return _has_heading_style(para.style_name) or _is_known_section(para.text)


def _has_heading_style(style_name: str) -> bool:
    """Return True when the style name indicates a Word heading level."""
    return "heading" in style_name.lower()


def _is_known_section(text: str) -> bool:
    """Return True when the text exactly matches a known section name."""
    return _normalise_text(text) in SECTION_NAME_MAP


def _normalize(text: str) -> str | None:
    """Return the canonical section name, or None for unknown headings."""
    return SECTION_NAME_MAP.get(_normalise_text(text))


def _normalise_text(text: str) -> str:
    """Lowercase and strip the text for consistent dictionary lookup."""
    return text.strip().lower()
