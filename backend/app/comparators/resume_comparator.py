"""Deterministic resume vs job description comparator.

Identifies which job description signals (keywords, technologies, required
skills) are present in or absent from a resume.

This module is intentionally pure:

- Input:  list[SectionItem], JobDescription
- Output: ComparisonResult
- No AI, no embeddings, no network, no filesystem.
- All logic can be exercised with plain Python objects in a unit test.

Comparison Strategy
-------------------
All text is normalised to lowercase with whitespace collapsed before any
comparison.  Three types of signals are extracted from the job description
and checked against the resume:

1. Keywords (from JobDescription.keywords)
   Word-level signals extracted by the JD parser from the full JD text.
   Each keyword is checked as a substring of the normalised section text.
   Substring matching (rather than whole-word) handles compound terms such
   as "python3" matching the keyword "python", and multi-word keywords such
   as "machine learning" matching naturally.

2. Technologies (from JobDescription.technologies)
   Canonical technology names from the allow-list in the JD parser.
   Checked as substrings of normalised section text so that "fastapi"
   matches "FastAPI" and "fast-api" alike.

3. Required Skills (from JobDescription.required_skills)
   Full skill phrases, e.g. "5+ years of Python experience".
   For the per-section and full-resume skill checks, individual words
   longer than 3 characters are extracted from each skill phrase and
   checked against the resume text.  A skill is considered matched when
   the majority (>= 50%) of its content words are present.  This tolerates
   paraphrasing ("Python backend experience" ≈ "Python experience").

Coverage Percentage
-------------------
For each section:
    matched / (matched + missing) × 100
    where matched and missing are counted over keywords + technologies.

Overall:
    matched_signals / total_signals × 100
    where signals = keywords + technologies + required skills.

Deduplication
-------------
All result lists are deduplicated and sorted for deterministic output.
"""

import re

from app.schemas.comparison import ComparisonResult, SectionComparison
from app.schemas.job_description import JobDescription
from app.schemas.section import SectionItem

# Minimum proportion of content words in a skill phrase that must appear
# in the resume for the skill to be considered matched.
_SKILL_MATCH_THRESHOLD = 0.5

# Minimum word length to include in skill phrase decomposition.
_MIN_WORD_LENGTH = 3


# ── Public API ────────────────────────────────────────────────────────────────


def compare_resume(
    sections: list[SectionItem],
    job_description: JobDescription,
) -> ComparisonResult:
    """Compare resume sections against a job description.

    Returns a fully populated ``ComparisonResult``.  The result is
    deterministic: the same inputs always produce the same output.
    """
    # Build a normalised full-resume text for overall matching.
    content_sections = _content_sections(sections)
    full_resume_text = _section_list_to_text(content_sections)

    # Per-section comparison.
    section_results = [
        _compare_section(section, job_description)
        for section in content_sections
    ]

    # Overall keyword coverage.
    keyword_matches, keyword_gaps = _match_terms(
        job_description.keywords, full_resume_text
    )

    # Overall technology coverage.
    tech_matches, tech_gaps = _match_terms(
        job_description.technologies, full_resume_text
    )

    # Overall required skill coverage.
    skill_matches, skill_gaps = _match_skills(
        job_description.required_skills, full_resume_text
    )

    overall_coverage = _coverage_percentage(
        matched_count=len(keyword_matches) + len(tech_matches) + len(skill_matches),
        total_count=(
            len(job_description.keywords)
            + len(job_description.technologies)
            + len(job_description.required_skills)
        ),
    )

    return ComparisonResult(
        sections=section_results,
        matched_skills=sorted(skill_matches),
        missing_skills=sorted(skill_gaps),
        matched_technologies=sorted(tech_matches),
        missing_technologies=sorted(tech_gaps),
        keyword_matches=sorted(keyword_matches),
        keyword_gaps=sorted(keyword_gaps),
        overall_coverage_percentage=overall_coverage,
    )


# ── Section-level comparison ──────────────────────────────────────────────────


def _compare_section(
    section: SectionItem,
    jd: JobDescription,
) -> SectionComparison:
    """Produce a ``SectionComparison`` for a single resume section."""
    section_text = _section_to_text(section)

    matched_kw, missing_kw = _match_terms(jd.keywords, section_text)
    matched_tech, missing_tech = _match_terms(jd.technologies, section_text)

    coverage = _coverage_percentage(
        matched_count=len(matched_kw) + len(matched_tech),
        total_count=len(jd.keywords) + len(jd.technologies),
    )

    return SectionComparison(
        section_name=section.normalized_name or section.title.lower(),
        matched_keywords=sorted(matched_kw),
        missing_keywords=sorted(missing_kw),
        matched_technologies=sorted(matched_tech),
        missing_technologies=sorted(missing_tech),
        coverage_percentage=coverage,
    )


# ── Term matching ─────────────────────────────────────────────────────────────


def _match_terms(
    terms: list[str],
    haystack: str,
) -> tuple[list[str], list[str]]:
    """Split ``terms`` into those present in ``haystack`` and those absent.

    Matching is case-insensitive.  Each term is searched as a substring of
    the normalised haystack so that multi-word terms and compound words are
    handled correctly without requiring tokenisation.

    Returns (matched, missing) — both lists deduplicated.
    """
    normalised_haystack = _normalise(haystack)
    seen: set[str] = set()
    matched: list[str] = []
    missing: list[str] = []

    for term in terms:
        key = _normalise(term)
        if key in seen or not key:
            continue
        seen.add(key)
        if key in normalised_haystack:
            matched.append(term)
        else:
            missing.append(term)

    return matched, missing


def _match_skills(
    skills: list[str],
    haystack: str,
) -> tuple[list[str], list[str]]:
    """Match required skill phrases against the resume text.

    A skill phrase (e.g. "5+ years of Python backend experience") is
    considered matched when at least ``_SKILL_MATCH_THRESHOLD`` of its
    content words appear in the normalised resume text.  This tolerates
    minor paraphrasing without requiring exact phrase matching.
    """
    normalised_haystack = _normalise(haystack)
    seen: set[str] = set()
    matched: list[str] = []
    missing: list[str] = []

    for skill in skills:
        key = _normalise(skill)
        if key in seen or not key:
            continue
        seen.add(key)

        content_words = _content_words(skill)
        if not content_words:
            # Degenerate case: no content words → skip.
            continue

        words_found = sum(
            1 for word in content_words if word in normalised_haystack
        )
        ratio = words_found / len(content_words)

        if ratio >= _SKILL_MATCH_THRESHOLD:
            matched.append(skill)
        else:
            missing.append(skill)

    return matched, missing


# ── Text helpers ──────────────────────────────────────────────────────────────


def _normalise(text: str) -> str:
    """Lowercase and collapse whitespace for consistent comparisons."""
    return re.sub(r"\s+", " ", text.lower().strip())


# English stop-words excluded from skill phrase matching.  Only technical
# words should contribute to the match ratio.
_SKILL_STOP_WORDS: frozenset[str] = frozenset({
    "and", "or", "the", "with", "for", "that", "this", "from", "into",
    "deep", "strong", "great", "excellent", "solid", "good", "high",
    "plus", "via", "etc", "e.g", "i.e",
    "experience", "expertise", "knowledge", "understanding", "proficiency",
    "familiarity", "ability", "skills", "skill",
    "required", "preferred", "minimum", "years", "year", "using",
    "working", "building", "developing", "designing",
})


def _content_words(phrase: str) -> list[str]:
    """Extract meaningful technical words from a skill phrase.

    Filters out short words and common English stop-words so that filler
    words like "with", "deep", "strong" do not dilute the match ratio.
    Only technical nouns (languages, tools, frameworks) contribute.
    """
    words = re.findall(r"[a-z0-9+#.-]{%d,}" % _MIN_WORD_LENGTH, phrase.lower())
    return [w for w in words if w not in _SKILL_STOP_WORDS]


def _section_to_text(section: SectionItem) -> str:
    """Concatenate all paragraph text in a section into a single string."""
    return " ".join(para.text for para in section.paragraphs)


def _section_list_to_text(sections: list[SectionItem]) -> str:
    """Concatenate all paragraph text across multiple sections."""
    return " ".join(_section_to_text(s) for s in sections)


def _content_sections(sections: list[SectionItem]) -> list[SectionItem]:
    """Return sections that contain analysable content.

    The implicit 'header' section (name, contact details) is excluded
    because it is not compared against job requirements.
    """
    return [s for s in sections if s.normalized_name != "header"]


def _coverage_percentage(matched_count: int, total_count: int) -> float:
    """Return the percentage of total signals that were matched.

    Returns 0.0 when total_count is zero to avoid division by zero.
    Result is rounded to one decimal place.
    """
    if total_count == 0:
        return 0.0
    return round(matched_count / total_count * 100, 1)
