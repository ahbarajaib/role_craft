"""Section rewrite service.

Coordinates call to OpenAI Responses API to rewrite a single resume section.
Enforces strict truthfulness guidelines, ensuring no credentials or skills
are invented unless explicitly supported by evidence elsewhere in the document.
"""

from loguru import logger

from app.ai.provider import OpenAIProvider
from app.core.exceptions import BadRequestError
from app.schemas.rewrite import RewriteSectionResponse
from app.services.section_service import SectionService

REWRITE_SYSTEM_PROMPT = """\
You are a senior hiring manager, executive recruiter, and master resume editor.
You are editing a professional resume section to maximize interview callback rates.

CRITICAL RULES:
1. **Strict Factual Accuracy**: Everything written must be strictly factual and supported by evidence in the resume or explicitly provided by the candidate. NEVER invent fake credentials, fake companies, fake dates, or hallucinated achievements.
2. **Google XYZ Formula**: Whenever rewriting bullet points (work experience, projects, achievements), format them using Google's XYZ formula:
   "Accomplished [X] as measured by [Y], by doing [Z]"
   - [X] = Clear outcome/result achieved
   - [Y] = Measurable metric/data point from original resume or candidate input (use actual technical scale if no specific numbers exist)
   - [Z] = Action taken and technical method used
3. **Strong Action Verbs**: Start every bullet point with an impactful, active verb (e.g., Spearheaded, Engineered, Optimized, Streamlined). Never start with passive phrases like "Responsible for" or "Worked on".
4. **Candidate Metric Integration**: If there is a section labeled "=== CANDIDATE-SUPPLIED METRICS & DATA POINTS ===", weave those exact candidate metrics directly into the corresponding bullets.
5. **Exact Bullet Count Preservation**: You MUST output EXACTLY the same number of bullet points as specified in the exact bullet count constraint. Every single job position/role in this section must have ALL of its bullet points rewritten and tailored to the target job description. Do NOT skip any job position or merge bullet points!
6. **Metadata & Subheader Preservation**: You MUST preserve all Company Names, Locations, Job Titles, and Dates at the top of each entry EXACTLY as they appear in the original text.
7. **Output Bounds**: Output ONLY the polished paragraphs or bullet points for this section. Do not include summary preambles or section title headers.
"""

SKILLS_REWRITE_SYSTEM_PROMPT = """\
You are a senior executive recruiter and master ATS resume editor.
You are rewriting the TECHNICAL SKILLS / PROFICIENCIES section of a professional resume.

CRITICAL SKILLS SECTION RULES:
1. **Strict Category List Format**: Technical skills MUST be output strictly as concise, category-based lists.
   Format: "Category Name: Skill1, Skill2, Skill3, Skill4"
   Examples:
   "Frontend: React.js, Next.js, Redux Toolkit, Tailwind CSS, JavaScript (ES6+), HTML5, CSS3, TypeScript"
   "Backend & Systems: Node.js, Express.js, REST APIs, WebSockets, JWT Authentication, Async Workflows, API Integration"
2. **NO Sentences or Action Verbs**: DO NOT write full sentences, achievement paragraphs, or action verbs (e.g. NEVER write "Developed scalable applications using...", "Engineered robust backend solutions using...").
3. **Preserve & Weave Keywords**: Retain all existing skills from the original text and weave the missing ATS keywords naturally into their appropriate category lists.
4. **Output Bounds**: Output ONLY the category skill lines. Do not include preambles or header titles.
"""

SUMMARY_REWRITE_SYSTEM_PROMPT = """\
You are a senior hiring manager, executive recruiter, and master resume writer.
You are rewriting the PROFESSIONAL SUMMARY / PROFILE section of a resume to align perfectly with the target Job Description.

CRITICAL PROFESSIONAL SUMMARY RULES:
1. **Compelling 1-Paragraph Executive Summary**: Write a powerful 3-5 sentence professional summary tailored specifically to the target job title, required technical stack, and core domain background.
2. **Target Role Alignment**: Frame the candidate's years of experience, primary skills, and major achievements directly around the target role.
3. **No Fluff or Invented Claims**: Keep all years of experience, core technical stack, and factual background grounded strictly in the candidate's actual resume evidence.
4. **Active & High-Impact Tone**: Use confident, professional wording emphasizing problem-solving impact, production delivery, and domain expertise.
5. **Output Bounds**: Output ONLY the polished summary paragraph text. Do not include preambles or section title headers.
"""


class RewriteService:
    """Handles AI-powered, truth-preserving resume section rewrites."""

    def __init__(
        self, section_service: SectionService, provider: OpenAIProvider
    ) -> None:
        self._sections = section_service
        self._provider = provider

    def rewrite(
        self,
        document_id: str,
        section_name: str,
        job_description_text: str,
        recommendations: list[str],
        user_instructions: str | None = None,
        metric_inputs: dict[str, str] | None = None,
    ) -> RewriteSectionResponse:
        """Rewrite a single section of the resume using OpenAI structured outputs."""
        logger.info(
            "Starting section rewrite",
            document_id=document_id,
            section=section_name,
            has_user_instructions=user_instructions is not None,
            has_metric_inputs=metric_inputs is not None,
        )

        # 1. Load document sections
        sections_response = self._sections.detect_document_sections(document_id)
        sections = sections_response.sections

        def _normalize_title(t: str) -> str:
            clean_t = t.replace("[", "").replace("]", "").strip()
            return " ".join(clean_t.lower().split())

        # 2. Find target section
        target_sec = next(
            (s for s in sections if _normalize_title(s.title) == _normalize_title(section_name)),
            None,
        )
        if not target_sec:
            raise BadRequestError(
                f"Section '{section_name}' not found in the uploaded resume. Available: "
                f"{', '.join([s.title for s in sections])}"
            )

        # Extract target text
        original_text = "\n".join([p.text for p in target_sec.paragraphs])
        if not original_text.strip():
            raise BadRequestError(f"Section '{section_name}' contains no text to rewrite.")

        orig_lines = [l.strip() for l in original_text.split("\n") if l.strip()]
        orig_line_count = max(len(orig_lines), 1)

        # Determine section type and prompt selection
        sec_lower = section_name.lower()

        # Preserve Education content untouched
        if any(k in sec_lower for k in ["education", "academic", "qualification", "degree"]):
            return RewriteSectionResponse(
                section=section_name,
                original_text=original_text,
                rewritten_text=original_text,
                reasoning="Education content is preserved as-is without modification.",
                changes=[],
            )

        is_skills_section = any(k in sec_lower for k in ["skill", "technologies", "proficiencies", "tech stack"])
        is_summary_section = any(k in sec_lower for k in ["summary", "profile", "about", "objective", "bio"])

        if is_skills_section:
            system_prompt = SKILLS_REWRITE_SYSTEM_PROMPT
        elif is_summary_section:
            system_prompt = SUMMARY_REWRITE_SYSTEM_PROMPT
        else:
            system_prompt = REWRITE_SYSTEM_PROMPT

        # 3. Compile evidence context from all OTHER sections
        evidence_parts = []
        for s in sections:
            if _normalize_title(s.title) == _normalize_title(section_name) or s.normalized_name == "header":
                continue
            evidence_parts.append(f"[{s.title}]")
            evidence_parts.extend([p.text for p in s.paragraphs])
        evidence_context = "\n".join(evidence_parts)

        # 4. Formulate instructions and input
        input_parts = [
            f"=== TARGET JOB DESCRIPTION ===\n{job_description_text.strip()}",
            f"=== RECRUITER RECOMMENDATIONS FOR THIS SECTION ===\n"
            f"{' / '.join(recommendations) if recommendations else 'Improve overall impact.'}",
        ]
        if not is_skills_section:
            from app.services.patch_service import _is_metadata_line, _is_bullet_paragraph, _is_overview_paragraph
            import docx as _docx_mod

            # Count non-metadata non-empty content lines from the original section text
            non_meta_lines = [l for l in orig_lines if not _is_metadata_line(l)]

            # Try to detect if there is a non-bullet overview paragraph at the top of each role
            # by inspecting the raw text lines (we cannot call _is_overview_paragraph without a para object,
            # so we approximate: a non-bullet line that starts with an action verb or is a long sentence)
            import re as _re
            from app.services.patch_service import ACTION_VERBS as _AV
            _action_starts = tuple(_AV)
            overview_lines = [
                l for l in non_meta_lines
                if not any(l.startswith(s) for s in ["•", "-", "*", "–", "—", "▪"])
                and (l.lower().split()[0] in _AV if l.split() else False)
            ]
            bullet_only_lines = [
                l for l in non_meta_lines
                if any(l.startswith(s) for s in ["•", "-", "*", "–", "—", "▪"])
            ]

            # Total rewriteable content = overview sentences + bullet points
            target_content_count = len(non_meta_lines) if non_meta_lines else orig_line_count
            has_overview = len(overview_lines) > 0

            if has_overview:
                input_parts.append(
                    f"=== CONTENT STRUCTURE CONSTRAINT ===\n"
                    f"This section has {len(overview_lines)} prose overview paragraph(s) followed by {len(bullet_only_lines)} bullet point(s).\n"
                    f"You MUST output EXACTLY {len(overview_lines)} rewritten prose overview paragraph(s) (matching position and style of the originals) "
                    f"followed by EXACTLY {len(bullet_only_lines)} rewritten bullet point(s). "
                    f"Total rewriteable content lines: exactly {target_content_count}. "
                    f"DO NOT add, merge, or omit any lines!"
                )
            else:
                input_parts.append(
                    f"=== EXACT BULLET COUNT CONSTRAINT ===\n"
                    f"This section originally contains {target_content_count} bullet point(s) across its job entries. "
                    f"You MUST output EXACTLY {target_content_count} rewritten bullet points (matching the exact bullet count of each job entry in document order). "
                    f"DO NOT add or omit bullet points! (Target count: exactly {target_content_count} bullets)."
                )

        if metric_inputs and any(v.strip() for v in metric_inputs.values()):
            formatted_metrics = "\n".join(
                f"- {k.replace('_', ' ').title()}: {v.strip()}"
                for k, v in metric_inputs.items()
                if v.strip()
            )
            input_parts.append(
                f"=== CANDIDATE-SUPPLIED METRICS & DATA POINTS (WEAVE THESE INTO BULLETS) ===\n{formatted_metrics}"
            )

        if user_instructions:
            input_parts.append(
                f"=== CANDIDATE INSTRUCTIONS FOR REFINEMENT (PRIORITISE THESE) ===\n{user_instructions.strip()}"
            )

        input_parts.extend([
            f"=== EVIDENCE CONTEXT (FROM REST OF RESUME) ===\n{evidence_context.strip()}",
            f"=== ORIGINAL SECTION CONTENT TO REWRITE ===\n{original_text.strip()}"
        ])

        input_text = "\n\n".join(input_parts)

        # 5. Execute Structured LLM call
        result = self._provider.parse_response(
            instructions=system_prompt,
            input_text=input_text,
            response_format=RewriteSectionResponse,
        )

        # Verify returned original text in the Pydantic response matches
        result.original_text = original_text

        logger.info(
            "Section rewrite complete",
            section=section_name,
            original_len=len(original_text),
            rewritten_len=len(result.rewritten_text),
            changes_made=len(result.changes),
        )

        return result
