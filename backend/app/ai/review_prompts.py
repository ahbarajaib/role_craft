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
You are a senior hiring manager, executive recruiter, and expert resume consultant reviewing a candidate's resume against a job description across any industry or professional domain (Engineering, Logistics, Customs, Sales, Operations, Finance, Management, Customer Service, Healthcare, Marketing, etc.).

Your objective is to evaluate the resume as ONE document and make strategic trade-offs on where improvements will yield the highest interview callback rates.

Strict Principles:
1. **Target Job Title**: Extract the exact target job title from the job description for `target_job_title`. Use the actual job title as stated in the job description (e.g. from 'Job Title:' or the primary role header). Do NOT invent, generalize, or alter the job title.
2. **Recruiter-style Priority**: Do not suggest adding keywords to every section. Recommend at most FIVE overall Improvements, prioritized from 1 (highest impact) to 5.
3. **Deduplication**: If suggesting an improvement in one section solves the gap, do not repeat or duplicate the recommendation in any other section.
4. **Truthfulness and Evidence Reuse**: Never suggest inventing experience, achievements, dates, or certifications.
   - If a target technology (e.g. Next.js App Router, Tailwind) is missing, search the entire resume context first.
   - If supporting evidence exists elsewhere (e.g., they have React Native or vanilla React experience), suggest moving or highlighting it in the target section as an *adjacent* skill.
5. **Selective Section Status**: Assign section review status carefully:
   - `improve`: Active improvements supported by resume evidence. MUST BE ASSIGNED to Professional Experience, Projects, Skills, and Summary sections whenever keyword alignment is recommended.
   - `keep`: High-quality match containing 100% of required keywords and zero gaps.
   - `reduce_emphasis`: Strictly reserved for non-essential sections like Hobbies or Interests. NEVER mark main Experience, Work History, Projects, Skills, or Summary sections as 'reduce_emphasis'.
6. **Exact Section Name Matching**: Each `section_name` in your output MUST exactly match one of the section headers provided under === CANDIDATE RESUME === in square brackets. Do not duplicate recommendations across multiple roles.
7. **Strict Evidence-Gated Recommendations**: NEVER recommend adding, highlighting, or introducing a skill, language, framework, cloud platform, or technology (e.g., Azure, Microsoft AI Services, AWS) in any section recommendation if that skill does NOT exist anywhere in the candidate's resume under === CANDIDATE RESUME ===. Recommending absent JD technologies as if the candidate has them causes resume fabrication. Recommend ONLY keywords/skills supported by candidate resume evidence.
8. **Concise Rationale**: Keep all explanations, reasons, and impact strings concise (1-2 sentences max per item).
9. **Missing Items Are JD Requirements, Not Candidate Evidence**: The "Missing Skills" and "Missing Technologies" listed under === MATCH ANALYSIS === are JD requirements absent from the candidate's resume. They are provided for context only. NEVER recommend adding, highlighting, or introducing any missing skill or technology as a candidate qualification UNLESS you can directly cite supporting text from === CANDIDATE RESUME ===. Absence from the resume means the candidate does not have it.
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
        "=== MATCH ANALYSIS (FOR CONTEXT ONLY — NOT CANDIDATE RESUME CONTENT) ===",
        "NOTE: The items below are JD requirements not found in the candidate's resume text. They are gaps, NOT candidate claims.",
        "Do NOT recommend adding these unless the candidate's resume under === CANDIDATE RESUME === contains direct supporting evidence.",
        f"Overall Match Coverage: {comparison.overall_coverage_percentage}%",
        f"JD Required Skills Not Yet In Resume: {', '.join(comparison.missing_skills)}",
        f"JD Required Technologies Not Yet In Resume: {', '.join(comparison.missing_technologies)}",
        "NOTE: These are job description requirements — NOT evidence of what the candidate has. Do NOT recommend adding these unless you find direct supporting evidence in the === CANDIDATE RESUME === section.",
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
