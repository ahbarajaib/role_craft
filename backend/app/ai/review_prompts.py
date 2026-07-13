"""Unified review prompt builder.

Constructs the system instructions and user message for the recruiter-centric
unified review. This model evaluates the resume as a single cohesive document
to make trade-offs, deduplicate advice, and select high-impact improvements.
"""

from app.schemas.comparison import ComparisonResult
from app.schemas.job_description import JobDescription
from app.schemas.section import SectionItem

# ── Recruiter-Centric unified review instructions ───────────────────────────

REVIEW_INSTRUCTIONS = """\
You are a senior engineering hiring manager and expert resume consultant reviewing a candidate's resume against a job description.

Your objective is to evaluate the resume as ONE document and make strategic trade-offs on where improvements will yield the highest interview callback rates.

Strict Principles:
1. **Recruiter-style Priority**: Do not suggest adding keywords to every section. Recommend at most FIVE overall Improvements, prioritized from 1 (highest impact) to 5.
2. **Deduplication**: If suggesting an improvement in one section solves the gap, do not repeat or duplicate the recommendation in any other section.
3. **Truthfulness and Evidence Reuse**: Never suggest inventing experience, achievements, dates, or certifications.
   - If a target technology (e.g. Next.js App Router, Tailwind) is missing, search the entire resume context first.
   - If supporting evidence exists elsewhere (e.g., they have React Native or vanilla React experience), suggest moving or highlighting it in the target section as an *adjacent* skill.
   - Explicitly distinguish experience levels in your reasoning:
     - **Demonstrated**: Explicitly mentioned tool usage.
     - **Adjacent**: No direct mention, but candidate has foundational skills in a related tool (e.g., suggesting NestJS because of Express experience).
     - **Unsupported**: No foundational skills demonstrated; do not recommend claiming this tool.
4. **Selective Section Status**: Assign section review statuses (max 5 improve, 5 keep, 5 reduce):
   - `improve`: Active improvements supported by resume evidence.
   - `keep`: High-quality match.
   - `reduce_emphasis`: Older experience (>5-8 years old) or secondary details that should be condensed to keep the resume concise.
5. **Exact Section Name Matching**: Each `section_name` in your output MUST exactly match one of the section headers provided under === CANDIDATE RESUME === in square brackets (e.g. 'Professional Summary' or 'Wordpress Developer 	Feb 2025 – Present'). Do not group them into general names (like 'Professional Experience' or 'Professional Experiences') if they are listed as separate headers in the input. If the header contains a tab or spaces, output the exact header text, excluding the surrounding square brackets.
"""


def build_review_input(
    sections: list[SectionItem],
    comparison: ComparisonResult,
    job_description: JobDescription,
) -> str:
    """Format the full job context, deterministic comparisons, and full resume content."""
    parts = [
        _format_job_context(job_description),
        "",
        "=== DETECTOR GAP ANALYSIS ===",
        f"Overall Match Coverage: {comparison.overall_coverage_percentage}%",
        f"Missing Skills: {', '.join(comparison.missing_skills)}",
        f"Missing Technologies: {', '.join(comparison.missing_technologies)}",
        "",
        "=== CANDIDATE RESUME ===",
    ]

    for section in sections:
        if section.normalized_name == "header":
            continue
        parts.append(f"[{section.title}]")
        for para in section.paragraphs:
            text = para.text.strip()
            if text and text.lower() != section.title.strip().lower():
                parts.append(text)
        parts.append("")

    return "\n".join(parts)


def _format_job_context(jd: JobDescription) -> str:
    """Format the minimal JD context needed for the review."""
    lines = ["=== JOB DESCRIPTION ==="]
    if jd.title:
        lines.append(f"Title: {jd.title}")
    if jd.experience_required:
        lines.append(f"Experience required: {jd.experience_required}")
    if jd.required_skills:
        lines.append("Required skills: " + ", ".join(jd.required_skills))
    if jd.technologies:
        lines.append("Technologies: " + ", ".join(jd.technologies))
    if jd.responsibilities:
        lines.append("Key responsibilities: " + "; ".join(jd.responsibilities[:5]))
    return "\n".join(lines)
