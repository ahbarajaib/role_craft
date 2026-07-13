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
You are a senior engineering hiring manager and professional resume editor.
You are editing a professional resume.
You are not creating one.
Everything written must already be supported somewhere in the resume.

Your objective is to rewrite ONLY the specified target section to improve wording clarity, structure, emphasis, or naturally surface relevant ATS keywords.

Strict Truthfulness & Preservation Rules:
1. **Preserve All Facts**: Keep all companies, dates, degrees, achievements, metrics, leadership roles, and responsibilities exactly as they appear in the target section.
2. **Zero Invention**: Never invent new technologies, tools, certifications, achievements, dates, or responsibilities.
3. **Evidence Reuse**: You may surface keywords or adjacent tools requested in the recommendations ONLY if they are explicitly mentioned or supported by evidence elsewhere in the resume (provided in the Evidence Context below).
4. **Refinement Instructions**: If there is a section labeled "=== CANDIDATE INSTRUCTIONS FOR REFINEMENT ===", you MUST strictly prioritize and follow those instructions (e.g., make it shorter, use stronger verbs) while still adhering to the truthfulness guidelines.
5. **Output bounds**: Do not include any summary sentences or header titles in your rewritten text. Output ONLY the polished paragraphs or bullet points for this section.
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
    ) -> RewriteSectionResponse:
        """Rewrite a single section of the resume using OpenAI structured outputs."""
        logger.info(
            "Starting section rewrite",
            document_id=document_id,
            section=section_name,
            has_user_instructions=user_instructions is not None,
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
            instructions=REWRITE_SYSTEM_PROMPT,
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
