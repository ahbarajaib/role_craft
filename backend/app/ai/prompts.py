"""Resume analysis prompt builder.

Constructs the instructions and input text sent to the OpenAI Responses API.

This module is part of the AI Layer (architecture.md).  It has no HTTP,
no database, and no OpenAI client dependency — only string building.
Keeping it separate means prompts can be reviewed, tested, and iterated
without touching any infrastructure code.

Prompt Strategy
---------------
The system instructions tell the model its role and the exact output
contract.  The user message provides the resume content and job
requirements in a compact labelled-text format.

Keeping the system instructions short (< 300 tokens) and the user message
structured (labelled sections rather than prose) reduces token cost and
improves reliability of structured outputs.

The model is instructed to:
- Analyse each resume section independently.
- Flag sections that are missing keywords present in the job description.
- Set priority based on how directly the section affects ATS and recruiter
  review (Experience and Skills sections are typically highest priority).
- Never invent resume content — only note what is absent.
"""

from app.schemas.job_description import JobDescription
from app.schemas.section import SectionItem

# ── System instructions ───────────────────────────────────────────────────────
#
# Written as a constant so it can be read in code review independently of
# the user message builder.  Avoids inline f-strings for the instructions
# which would make the prompt harder to read.

SYSTEM_INSTRUCTIONS = """\
You are an expert resume coach and ATS specialist.

Your task is to analyse each section of a candidate's resume against a job description and identify gaps.

Rules:
- Analyse every section provided, even if it looks good.
- Flag a section as needing changes only when it is genuinely missing relevant content.
- Keep reasons concise (1–2 sentences maximum).
- List only keywords that are truly absent from the section text — do not list keywords that already appear.
- Never suggest inventing experience, companies, dates, or skills the candidate does not have.
- Prioritise sections that affect ATS scoring most: experience, skills, summary.
- Return analysis for every section, even sections that need no changes.\
"""


# ── User message builder ──────────────────────────────────────────────────────


def build_analysis_input(
    sections: list[SectionItem],
    job_description: JobDescription,
) -> str:
    """Build the user message for the resume analysis call.

    Returns a compact labelled-text string.  Structured text outperforms
    prose for extraction tasks because it gives the model clear delimiters
    without consuming extra tokens on conversational framing.
    """
    parts: list[str] = []

    parts.append(_format_job_description(job_description))
    parts.append("")
    parts.append(_format_resume_sections(sections))

    return "\n".join(parts)


def _format_job_description(jd: JobDescription) -> str:
    """Format the job description fields as a compact labelled block."""
    lines = ["=== JOB DESCRIPTION ==="]

    if jd.title:
        lines.append(f"Title: {jd.title}")
    if jd.company:
        lines.append(f"Company: {jd.company}")
    if jd.experience_required:
        lines.append(f"Experience: {jd.experience_required}")
    if jd.required_skills:
        lines.append("Required skills: " + ", ".join(jd.required_skills))
    if jd.preferred_skills:
        lines.append("Preferred skills: " + ", ".join(jd.preferred_skills))
    if jd.technologies:
        lines.append("Technologies: " + ", ".join(jd.technologies))
    if jd.responsibilities:
        lines.append("Responsibilities:")
        for r in jd.responsibilities:
            lines.append(f"  - {r}")

    return "\n".join(lines)


def _format_resume_sections(sections: list[SectionItem]) -> str:
    """Format resume sections as labelled blocks, one per section."""
    blocks: list[str] = ["=== RESUME SECTIONS ==="]

    for section in sections:
        blocks.append(f"[{section.title}]")
        for para in section.paragraphs:
            # Skip the heading paragraph itself (it repeats the section title)
            if para.text.strip().lower() != section.title.strip().lower():
                blocks.append(para.text)
        blocks.append("")

    return "\n".join(blocks)
