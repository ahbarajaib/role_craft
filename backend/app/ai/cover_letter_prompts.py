"""Cover letter prompt builder.

Constructs system prompt and user input for generating tailored cover letters
using OpenAI.
"""

from app.schemas.job_description import JobDescription

COVER_LETTER_SYSTEM_PROMPT = """\
You are an executive recruiter, expert resume coach, and master cover letter writer.
Your task is to write a highly compelling, professional, tailored 3-paragraph cover letter for a candidate applying to a specific role.

CRITICAL COVER LETTER RULES:
1. **Structure (Exactly 3 Body Paragraphs)**:
   - **Paragraph 1 (The Hook & Value Prop)**: Express strong, professional interest in the specific target role. State years of relevant experience and key technical domain strength aligned directly with the target job.
   - **Paragraph 2 (Relevant High-Impact Evidence)**: Highlight 2-3 specific technical achievements, scale metrics, or key projects from the candidate's applied resume background that directly address the job description's core requirements.
   - **Paragraph 3 (Call to Action & Closing)**: Reiterate enthusiasm for bringing immediate impact to the team, express interest in discussing the role in an interview, and thank the hiring team.
2. **Strict Grounding on Applied Resume & Confirmed Matched Skills ONLY**:
   - Base all technical claims, skills, tools, and experience ONLY on the candidate's active applied resume sections and the explicitly provided "CONFIRMED MATCHED SKILLS".
   - DO NOT mention, reference, or invent missing skills, unconfirmed skill gaps, unapplied recommendations, or technologies not present in the candidate's confirmed list/applied text.
   - NEVER hallucinate unmentioned degrees, companies, years of experience, or unverified skills.
3. **Active, Professional Tone**: Write with confidence, conciseness, and high executive impact. Avoid generic filler statements (e.g. "I am writing to apply for...").
4. **No Placeholders**: Do NOT include bracketed placeholders like [Company Name] or [Hiring Manager] unless explicit values are provided. Use generic professional addresses ("Dear Hiring Team,") if no contact name is given.
5. **Output Bounds**: Output ONLY the cover letter content (Salutation, 3 body paragraphs, Closing, and Candidate Signature line). Do not include conversational preambles or explanations.
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

