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
A paragraph is treated as a section heading when *any* condition is met:

  1. Style signal — the Word paragraph style name contains the word
     "heading" (case-insensitive).  This catches paragraphs explicitly
     styled as Heading 1/2/3 etc. in well-formatted resumes.

  2. Text signal — the paragraph's normalised text matches one of the
     known section names in ``SECTION_NAME_MAP``.  This catches resumes
     where headings are written in bold Normal style rather than a real
     Heading style.

  3. ALL-CAPS signal — short (≤ 55 char) all-uppercase line not starting
     with a bullet symbol.  Common in logistics, finance, and legal CVs.

  4. Bold-Normal signal — short (≤ 60 char) paragraph whose style is
     not a Heading style but ALL runs are bold.  Covers the majority of
     modern resume templates that style headings as bold Normal text
     rather than using Word's built-in Heading styles.

Using all four signals makes the detector robust against every major
formatting convention found in real-world resumes across all industries.

Unknown headings are kept as custom sections with ``normalized_name = None``
rather than being discarded, so no content is ever silently lost.

Pre-heading paragraphs (name, contact) are collected into a synthetic
``header`` section.
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
    # ─── Summary / Profile ───────────────────────────────────────────────────
    "summary": "summary",
    "professional summary": "summary",
    "executive summary": "summary",
    "profile": "summary",
    "professional profile": "summary",
    "about me": "summary",
    "about": "summary",
    "career summary": "summary",
    "career profile": "summary",
    "objective": "summary",
    "career objective": "summary",
    "professional objective": "summary",
    "personal statement": "summary",
    "bio": "summary",
    "introduction": "summary",
    "overview": "summary",
    "highlights": "summary",
    "key highlights": "summary",
    # ─── Skills ──────────────────────────────────────────────────────────────
    "skills": "skills",
    "technical skills": "skills",
    "core skills": "skills",
    "core competencies": "skills",
    "key skills": "skills",
    "technologies": "skills",
    "technology stack": "skills",
    "tech stack": "skills",
    "tools & technologies": "skills",
    "tools and technologies": "skills",
    "programming languages": "skills",
    "languages & frameworks": "skills",
    "languages and frameworks": "skills",
    "areas of expertise": "skills",
    "expertise": "skills",
    "competencies": "skills",
    "qualifications": "skills",
    "key qualifications": "skills",
    "technical expertise": "skills",
    "professional skills": "skills",
    "technical proficiencies": "skills",
    "proficiencies": "skills",
    "skill set": "skills",
    "skillset": "skills",
    "hard skills": "skills",
    "soft skills": "skills",
    "specializations": "skills",
    "specialties": "skills",
    "tools": "skills",
    "frameworks": "skills",
    "platforms": "skills",
    "databases": "skills",
    "technical skills & software": "skills",
    "technical skills and software": "skills",
    "skills & software": "skills",
    "skills and software": "skills",
    "core competencies & tools": "skills",
    "key competencies": "skills",
    "additional information": "additional",
    "additional details": "additional",
    "other information": "additional",
    "personal details": "additional",
    "declarations": "additional",
    # ─── Experience ──────────────────────────────────────────────────────────
    "experience": "experience",
    "experiences": "experience",
    "work experience": "experience",
    "work experiences": "experience",
    "professional experience": "experience",
    "professional experiences": "experience",
    "employment history": "experience",
    "employment": "experience",
    "career history": "experience",
    "work history": "experience",
    "relevant experience": "experience",
    "industry experience": "experience",
    "internship experience": "experience",
    "internships": "experience",
    "practical experience": "experience",
    "field experience": "experience",
    "consulting experience": "experience",
    "freelance experience": "experience",
    "contract experience": "experience",
    "related experience": "experience",
    "job history": "experience",
    "positions held": "experience",
    "appointments": "experience",
    "roles": "experience",
    # ─── Projects ────────────────────────────────────────────────────────────
    "project": "projects",
    "projects": "projects",
    "personal projects": "projects",
    "key projects": "projects",
    "selected projects": "projects",
    "notable projects": "projects",
    "technical projects": "projects",
    "software projects": "projects",
    "academic projects": "projects",
    "portfolio": "projects",
    "open source": "projects",
    "open source contributions": "projects",
    "side projects": "projects",
    "independent projects": "projects",
    "passion projects": "projects",
    "research projects": "projects",
    # ─── Education ───────────────────────────────────────────────────────────
    "education": "education",
    "educations": "education",
    "educational background": "education",
    "academic background": "education",
    "academic history": "education",
    "qualifications": "education",
    "academic qualifications": "education",
    "degrees": "education",
    "academic credentials": "education",
    "training": "education",
    "academic training": "education",
    "schooling": "education",
    # ─── Certifications ──────────────────────────────────────────────────────
    "certifications": "certifications",
    "certification": "certifications",
    "certificates": "certifications",
    "certificate": "certifications",
    "licenses": "certifications",
    "license": "certifications",
    "licenses & certifications": "certifications",
    "licenses and certifications": "certifications",
    "professional certifications": "certifications",
    "accreditations": "certifications",
    "credentials": "certifications",
    "professional development": "certifications",
    "badges": "certifications",
    "courses": "certifications",
    "online courses": "certifications",
    "training & certifications": "certifications",
    "training and certifications": "certifications",
    # ─── Awards & Achievements ────────────────────────────────────────────────
    "awards": "awards",
    "achievements": "awards",
    "honors": "awards",
    "honours": "awards",
    "awards & achievements": "awards",
    "awards and achievements": "awards",
    "recognitions": "awards",
    "accomplishments": "awards",
    # ─── Publications ────────────────────────────────────────────────────────
    "publications": "publications",
    "papers": "publications",
    "research": "publications",
    "research & publications": "publications",
    "research and publications": "publications",
    # ─── Volunteer / Activities ───────────────────────────────────────────────
    "volunteer": "volunteer",
    "volunteering": "volunteer",
    "volunteer work": "volunteer",
    "volunteer experience": "volunteer",
    "community service": "volunteer",
    "activities": "volunteer",
    "extracurricular activities": "volunteer",
    "leadership": "volunteer",
    "leadership & activities": "volunteer",
    # ─── References ──────────────────────────────────────────────────────────
    "references": "references",
    "reference": "references",
    "professional references": "references",
    "referees": "references",
    # ─── Languages ───────────────────────────────────────────────────────────
    "languages": "languages",
    "language skills": "languages",
    "spoken languages": "languages",
    "foreign languages": "languages",
    # ─── Interests ───────────────────────────────────────────────────────────
    "interests": "interests",
    "hobbies": "interests",
    "hobbies & interests": "interests",
    "personal interests": "interests",
    # ─── Additional Information ───────────────────────────────────────────────
    "additional information": "additional",
    "additional details": "additional",
    "other information": "additional",
    "personal details": "additional",
    "personal information": "additional",
    "declarations": "additional",
    "driving license": "additional",
    "declaration": "additional",
    # ─── Key Achievements / Accomplishments ───────────────────────────────────
    "key achievements": "awards",
    "achievements": "awards",
    "accomplishments": "awards",
    "career highlights": "awards",
    "key highlights": "awards",
    "notable achievements": "awards",
    # ─── Skills (extra variants) ──────────────────────────────────────────────
    "technical skills & software": "skills",
    "technical skills and software": "skills",
    "skills & software": "skills",
    "skills and software": "skills",
    "core competencies & tools": "skills",
    "core competencies and tools": "skills",
    "key competencies": "skills",
    "areas of expertise": "skills",
    "technical expertise": "skills",
    "capabilities": "skills",
    "it skills": "skills",
    "computer skills": "skills",
    # ─── Summary (extra variants) ─────────────────────────────────────────────
    "personal statement": "summary",
    "professional background": "summary",
    "candidate profile": "summary",
    "executive profile": "summary",
    "value proposition": "summary",
    # ─── Experience (extra variants) ─────────────────────────────────────────
    "professional history": "experience",
    "relevant work experience": "experience",
    "work achievements": "experience",
    "work record": "experience",
    "employment record": "experience",
    # ─── Projects (extra variants) ───────────────────────────────────────────
    "key projects": "projects",
    "notable projects": "projects",
    "project highlights": "projects",
    "major projects": "projects",
    # ─── Certifications (extra variants) ─────────────────────────────────────
    "professional training": "certifications",
    "training & development": "certifications",
    "training and development": "certifications",
    "short courses": "certifications",
    # ─── Education (extra variants) ──────────────────────────────────────────
    "academic qualifications": "education",
    "educational qualifications": "education",
    "educational background": "education",
    "academic credentials": "education",
    "degrees & diplomas": "education",
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
        is_hd = _is_heading(para)

        # If currently inside a container section (Experience, Education, Projects, Certifications),
        # sub-headings (job titles, degrees, project names) that are not canonical top-level
        # section names (like EDUCATION, SKILLS, EXPERIENCE, etc.) should remain inside the parent section.
        if current and (
            current.normalized_name in ["experience", "education", "projects", "certifications"]
            or any(kw in current.title.lower() for kw in ["experience", "employment", "history", "work record", "education", "academic", "project", "certification"])
        ):
            norm = _normalize(para.text)
            if is_hd and norm is None and not _is_known_section(para.text):
                is_hd = False

        if is_hd:
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


def _is_heading(para: ParsedParagraph, raw_para=None) -> bool:
    """Return True when the paragraph should be treated as a section heading.

    Signals used (any one is sufficient):
    1. Word Heading style (Heading 1/2/3 etc.)
    2. Text exactly matches a known section name in SECTION_NAME_MAP.
    3. Text is short (<= 55 chars), ALL UPPERCASE, with no bullet prefix.
    4. Bold-Normal: style is not a Heading style but all runs are bold and
       text is short (<= 60 chars).  Covers the most popular real-world
       resume templates that use Bold Normal instead of Heading styles.
    """
    if _has_heading_style(para.style_name):
        return True
    if _is_known_section(para.text):
        return True
    # Heuristic: short ALL-CAPS line that is not a bullet
    t = para.text.strip()
    if (
        len(t) <= 55
        and not t.startswith(("•", "-", "*", "–", "▪", "▸"))
        and not any(ch.isdigit() for ch in t[:3])  # doesn't start with a date/number
        and t == t.upper()
        and len(t.split()) <= 6
        and len(t) >= 3
    ):
        return True
    # Signal 4: Bold-Normal paragraph — style is not a Heading style but all
    # runs are bold and text is short.  This is the most popular heading style
    # in real-world resume templates (Bold Normal, not Heading 1/2/3).
    if (
        para.is_bold
        and not _has_heading_style(para.style_name)
        and len(t) <= 60
        and len(t) >= 2
        and not t.startswith(("•", "-", "*", "–", "▪", "▸"))
        and not any(ch.isdigit() for ch in t[:3])
        and len(t.split()) <= 7
        # Must look like a title phrase (not a bullet sentence)
        and not t.endswith((".", ";"))
    ):
        return True
    return False


def _has_heading_style(style_name: str) -> bool:
    """Return True when the style name indicates a Word heading level."""
    lower = style_name.lower()
    return (
        "heading" in lower
        or "title" in lower
        or lower.startswith("h1")
        or lower.startswith("h2")
        or lower.startswith("h3")
    )


def _is_known_section(text: str) -> bool:
    """Return True when the text matches a known section name."""
    return _normalise_text(text) in SECTION_NAME_MAP


def _normalize(text: str) -> str | None:
    """Return the canonical section name, or fallback to intelligent keyword matching."""
    norm = _normalise_text(text)
    if norm in SECTION_NAME_MAP:
        return SECTION_NAME_MAP[norm]

    # Intelligent fallback keyword matching for unlisted title variants
    if any(k in norm for k in ["skill", "competenc", "software", "proficiency", "tool", "expertise"]):
        return "skills"
    if any(k in norm for k in ["experience", "employment", "work history", "career history", "roles"]):
        return "experience"
    if any(k in norm for k in ["summary", "profile", "about", "objective", "bio", "overview"]):
        return "summary"
    if any(k in norm for k in ["education", "academic", "degree", "qualification"]):
        return "education"
    if any(k in norm for k in ["project", "portfolio"]):
        return "projects"
    if any(k in norm for k in ["certificat", "license", "course"]):
        return "certifications"
    if any(k in norm for k in ["additional", "other info", "personal info"]):
        return "additional"

    return None


def _normalise_text(text: str) -> str:
    """Lowercase, strip, and remove trailing/leading punctuation for consistent lookup."""
    import re
    t = text.strip().lower()
    # Remove trailing colons, periods, asterisks, underscores often appended to headings
    t = t.rstrip(":.-_*")
    # Collapse multiple spaces
    t = re.sub(r"\s+", " ", t).strip()
    return t
