"""Cover letter prompt builder.

Constructs system prompt and user input for generating tailored cover letters
using OpenAI.
"""

COVER_LETTER_SYSTEM_PROMPT = """\
You are writing a short, human cover letter for a tech/startup job application.

GOAL: Write like a real person replying to a recruiter's LinkedIn message who reached out first — confident, direct, specific, no corporate-speak. The output should feel like it was written by a sharp engineer in 10 minutes, not polished by a career coach.

STRUCTURE (follow exactly):
- Salutation: "Dear Hiring Team," (or use a name if one is provided)
- ONE paragraph (4–6 sentences): Briefly introduce who you are and your background, mention 1–2 specific things from your experience that are directly relevant to this role, and name the company naturally (not as a compliment, just as context). Be specific — name actual projects, tools, or outcomes from the resume evidence.
- ONE closing sentence: A direct, low-pressure invite to chat. Something like "Happy to jump on a call if this looks like a fit." — not a formal request.
- Sign-off: "Best," then the candidate's name on the next line.

TONE RULES:
- Short sentences. No rambling.
- Do NOT use: "passionate", "thrilled", "excited to contribute", "leverage my skills", "I believe I would be a great fit", "I am eager to", "I am writing to apply", "dynamic team", "fast-paced environment", "results-driven", "synergy", "hard-working", or any variation of these phrases.
- Do NOT open with "I" as the first word.
- Do NOT write more than 6 sentences in the body paragraph.
- Avoid adverbs like "highly", "deeply", "truly", "incredibly".

GROUNDING RULES (critical — do not violate):
- Base all technical claims ONLY on the candidate's provided resume summary and "CONFIRMED MATCHED SKILLS".
- If a FORBIDDEN CLAIMS block is provided, do NOT attribute any of those skills or technologies to the candidate under any circumstances.
- Use the candidate's exact years-of-experience figure. Do not round up or inflate it.
- Do NOT invent projects, tools, or outcomes not present in the resume evidence.
- NEVER claim cloud platform experience (AWS, GCP, Azure) unless it appears explicitly in the candidate's evidence.

OUTPUT: Return ONLY the cover letter text (salutation, body paragraph, closing sentence, sign-off, name). No notes, no preamble, no explanations.
"""


def build_cover_letter_input(
    candidate_name: str,
    target_role: str,
    summary_text: str,
    job_description_text: str,
    evidence_context: str = "",
    confirmed_matched_skills: list[str] | None = None,
    forbidden_claims: list[str] | None = None,
    company_name: str | None = None,
) -> str:
    """Build user prompt for cover letter generation."""
    parts = [
        "=== CANDIDATE NAME ===",
        candidate_name or "Candidate",
        "",
        "=== TARGET ROLE ===",
        target_role or "Target Role",
        "",
    ]

    if company_name:
        parts.extend([
            "=== COMPANY NAME ===",
            company_name,
            "(Use this name naturally once in the paragraph — not as flattery, just as context.)",
            "",
        ])

    parts.extend([
        "=== TARGET JOB DESCRIPTION ===",
        job_description_text,
        "",
        "=== CANDIDATE SUMMARY & EXPERIENCE (APPLIED RESUME) ===",
        summary_text or "Software Engineer with full-stack and AI engineering background.",
    ])

    if confirmed_matched_skills:
        parts.extend([
            "",
            "=== CONFIRMED MATCHED SKILLS (USE ONLY THESE — DO NOT ADD OTHERS) ===",
            ", ".join(confirmed_matched_skills),
        ])

    if forbidden_claims:
        parts.extend([
            "",
            "=== FORBIDDEN CLAIMS (DO NOT ATTRIBUTE THESE TO THE CANDIDATE) ===",
            "The following are NOT on the candidate's resume. Do not claim them:",
            ", ".join(forbidden_claims),
        ])

    if evidence_context:
        parts.extend([
            "",
            "=== RESUME EVIDENCE (use specific details from here) ===",
            evidence_context,
        ])

    return "\n".join(parts)


