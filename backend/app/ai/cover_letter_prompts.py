"""Cover letter prompt builder.

Constructs system prompt and user input for generating tailored cover letters
using OpenAI.
"""

COVER_LETTER_SYSTEM_PROMPT = """\
You are an expert career coach and master cover letter writer.
Your task is to write a highly personal, authentic, engaging, and compelling 2-paragraph cover letter for a candidate applying to a specific role.

CRITICAL COVER LETTER RULES:
1. **Structure (EXACTLY 2 Body Paragraphs)**:
   - **Paragraph 1 (Personal Hook & Fit with Company Mission)**: Open with a warm, personal hook expressing genuine enthusiasm for the company's work and mission. Concisely introduce your background, relevant years of experience, and key strengths that make you a natural fit for this target role.
   - **Paragraph 2 (Concrete Evidence & Direct Value/Usefulness to the Company)**: Highlight 2-3 specific accomplishments or key projects from your applied resume background. Explicitly articulate **how your background and technical skills will be directly useful to their team** (e.g., how you will help them accelerate product delivery, solve engineering challenges, or scale their systems). Seamlessly transition into a warm, confident closing inviting a conversation/interview, thanking the hiring team.
2. **Personal, Authentic & Engaging Tone**:
   - Write in a warm, personable, and enthusiastic voice that feels genuinely human and tailored.
   - Avoid mechanical template openings (e.g. "I am writing to formally apply..."). Instead, share an authentic personal connection to the work.
3. **Strict Grounding on Applied Resume & Confirmed Matched Skills ONLY**:
   - Base all technical claims, tools, and experience ONLY on the candidate's active applied resume sections and explicitly provided "CONFIRMED MATCHED SKILLS".
   - DO NOT invent missing skills, unconfirmed gaps, or technologies not present in the candidate's confirmed list/applied text.
   - If a === FORBIDDEN CLAIMS === block is provided in the user prompt, you MUST NOT mention any term listed there as a skill or technology the candidate possesses. These terms are absent from the candidate's resume.
   - NEVER claim experience with AWS, GCP, Azure, or any cloud platform unless it explicitly appears in the candidate's verified evidence section.
   - Use the candidate's exact years-of-experience value. Do not increase it.
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
    forbidden_claims: list[str] | None = None,
) -> str:
    """Build user prompt for cover letter generation."""
    parts = [
        "=== CANDIDATE NAME ===",
        candidate_name or "Candidate",
        "",
        "=== TARGET ROLE ===",
        target_role or "Target Role",
        "",
        "=== TARGET JOB DESCRIPTION ===",
        job_description_text,
        "",
        "=== CANDIDATE SUMMARY & EXPERIENCE (APPLIED RESUME) ===",
        summary_text or "Software Engineer with full-stack and AI engineering background.",
    ]

    if confirmed_matched_skills:
        parts.extend([
            "",
            "=== CONFIRMED MATCHED SKILLS (STRICTLY USE ONLY THESE SKILLS) ===",
            ", ".join(confirmed_matched_skills),
        ])

    if forbidden_claims:
        parts.extend([
            "",
            "=== FORBIDDEN CLAIMS (DO NOT ATTRIBUTE THESE TO THE CANDIDATE) ===",
            "The following terms are NOT supported by the candidate's resume. Do NOT claim the candidate has these skills or technologies:",
            ", ".join(forbidden_claims),
        ])

    if evidence_context:
        parts.extend([
            "",
            "=== APPLIED RESUME SECTION EVIDENCE ===",
            evidence_context,
        ])

    return "\n".join(parts)

