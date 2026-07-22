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
Everything written must be supported by evidence in the resume or explicitly provided by the candidate.

Your objective is to rewrite ONLY the specified target section to improve wording clarity, active impact, ATS keyword alignment, and quantifiable measurement.

Google XYZ Formula & Impact Rules:
1. **Google XYZ Formula**: Whenever rewriting bullet points (work experience, projects, achievements), strictly format them using Google's XYZ formula:
   "Accomplished [X] as measured by [Y], by doing [Z]"
   - [X] = Clear outcome/result achieved (e.g., Accelerated database response time, Increased sales pipeline)
   - [Y] = Measurable metric/data point (e.g., by 40%, by $120k, across 15+ microservices)
   - [Z] = Action taken and technical method used (e.g., by architecting indexed caching layer with Redis)
2. **Strong Action Verbs**: Start every bullet point with an impactful, active verb (e.g., Spearheaded, Engineered, Optimized, Streamlined). Never start with passive phrases like "Responsible for" or "Worked on".
3. **Candidate Metric Integration**: If there is a section labeled "=== CANDIDATE-SUPPLIED METRICS & DATA POINTS ===", you MUST weave those exact candidate metrics directly into the Y or X components of the corresponding bullets.
4. **Preserve All Real Facts**: Keep all companies, dates, degrees, real achievements, and tools as they appear in the original section or evidence context.
5. **Strict Bullet Count Limit**: Maintain the SAME number of bullet points as the original section (or at most 3 to 4 concise, high-impact bullet points per job entry). NEVER generate an overwhelming wall of text or more than 4 bullet points per job position under any circumstance!
6. **Metadata & Subheader Preservation**: You MUST preserve all Company Names, Company Locations, Job Titles, Degrees, and Dates at the top of each entry EXACTLY as they appear in the original section (e.g. "Infinitus International FZE, Dubai, UAE."). Never omit company names or locations when rewriting a section.
7. **Output Bounds**: Output ONLY the polished paragraphs or bullet points for this section. Do not include summary preambles or header titles.
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
            input_parts.append(
                f"=== LENGTH & BULLET COUNT CONSTRAINT ===\nThis section originally has {orig_line_count} line(s)/bullet(s). Output at most {min(orig_line_count, 4)} concise, ultra-impactful bullet points. DO NOT generate more than {min(orig_line_count, 4)} bullets."
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
