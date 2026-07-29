"""Cover letter prompt builder.

Constructs system prompt and user input for generating tailored cover letters
using OpenAI.
"""

from app.schemas.job_description import JobDescription

COVER_LETTER_SYSTEM_PROMPT = """\
You are an expert career coach and master cover letter writer.
Your task is to write a highly personal, warm, authentic, and compelling 2-paragraph cover letter for a candidate applying to a specific role.

CRITICAL COVER LETTER RULES:
1. **Structure (EXACTLY 2 Body Paragraphs)**:
   - **Paragraph 1 (Personal Connection & Core Fit)**: Open with a warm, personal hook expressing genuine enthusiasm for the role and company mission. Concisely introduce your background, relevant years of experience, and core strengths that make you a natural fit for the target position.
   - **Paragraph 2 (Proven Evidence & Enthusiastic Closing)**: Highlight 2-3 concrete achievements, key projects, or scale metrics from your applied resume that directly demonstrate your ability to solve the team's key challenges. Seamlessly transition into a confident, warm closing inviting a conversation/interview, thanking the team.
2. **Personal, Authentic & Human Tone**:
   - Write in a warm, personable, and confident voice that feels human, engaging, and unique.
   - Avoid generic, mechanical openings (e.g. "I am writing to express my formal interest in..."). Instead, dive right in with a personal, compelling hook.
3. **Strict Grounding on Applied Resume & Confirmed Matched Skills ONLY**:
   - Base all technical claims, tools, and experience ONLY on the candidate's active applied resume sections and explicitly provided "CONFIRMED MATCHED SKILLS".
   - DO NOT invent missing skills, unconfirmed gaps, or technologies not present in the candidate's confirmed list/applied text.
4. **No Placeholders**: Do NOT include bracketed placeholders like [Company Name] or [Hiring Manager]. Use generic professional addresses ("Dear Hiring Team,") if no contact name is provided.
5. **Output Bounds**: Output ONLY the cover letter content (Salutation, EXACTLY 2 body paragraphs, Closing, and Candidate Signature line). Do not include conversational preambles, notes, or explanations.
"""


def build_cover_letter_input(
    candidate_name: str,
    target_role: str,
    summary_text: str,
    job_description_text: str,
    evidence_context: str = "",
    confirmed_matched_skills: list[str] | None = None,
) -> str:
    """Build user prompt for cover letter generation."""
    parts = [
        f"=== CANDIDATE NAME ===",
        candidate_name or "Candidate",
        "",
        f"=== TARGET ROLE ===",
        target_role or "Target Role",
        "",
        f"=== TARGET JOB DESCRIPTION ===",
        job_description_text,
        "",
        f"=== CANDIDATE SUMMARY & EXPERIENCE (APPLIED RESUME) ===",
        summary_text or "Software Engineer with full-stack and AI engineering background.",
    ]

    if confirmed_matched_skills:
        parts.extend([
            "",
            "=== CONFIRMED MATCHED SKILLS (STRICTLY USE ONLY THESE SKILLS) ===",
            ", ".join(confirmed_matched_skills),
        ])

    if evidence_context:
        parts.extend([
            "",
            "=== APPLIED RESUME SECTION EVIDENCE ===",
            evidence_context,
        ])

    return "\n".join(parts)

