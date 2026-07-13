"""Resume analysis service.

Orchestrates the full analysis pipeline:

  1. Build the prompt from resume sections and job description.
  2. Call the AI provider with the structured response format.
  3. Return the typed response model.

Responsibilities
----------------
- Coordinate prompts.py and provider.py.
- Log a summary of the analysis result.
- Raise ``BadRequestError`` when the request is missing required data.

Non-responsibilities
--------------------
- HTTP (handled by the route).
- Prompt construction (handled by ``app.ai.prompts``).
- OpenAI API calls (handled by ``app.ai.provider``).
- Database persistence (future milestone).
"""

from loguru import logger

from app.ai.prompts import SYSTEM_INSTRUCTIONS, build_analysis_input
from app.ai.provider import OpenAIProvider
from app.core.exceptions import BadRequestError
from app.schemas.analysis import ResumeAnalysisResponse
from app.schemas.job_description import JobDescription
from app.schemas.section import SectionItem


class AnalysisService:
    """Runs resume analysis against a job description.

    Receives an ``OpenAIProvider`` via constructor injection so that tests
    can supply a mock provider without patching module globals.
    """

    def __init__(self, provider: OpenAIProvider) -> None:
        self._provider = provider

    def analyze_resume(
        self,
        sections: list[SectionItem],
        job_description: JobDescription,
    ) -> ResumeAnalysisResponse:
        """Analyse each resume section against the job description.

        Raises ``BadRequestError`` when no analysable sections are provided
        so that the caller receives a 400 rather than an empty AI call.
        """
        analysable = _filter_analysable_sections(sections)
        if not analysable:
            raise BadRequestError(
                "No analysable resume sections found. "
                "Upload and parse a DOCX first."
            )

        input_text = build_analysis_input(analysable, job_description)

        result = self._provider.parse_response(
            instructions=SYSTEM_INSTRUCTIONS,
            input_text=input_text,
            response_format=ResumeAnalysisResponse,
        )

        logger.info(
            "Resume analysis complete",
            section_count=len(result.sections),
            sections_needing_changes=sum(
                1 for s in result.sections if s.needs_changes
            ),
        )

        return result


def _filter_analysable_sections(sections: list[SectionItem]) -> list[SectionItem]:
    """Return sections that contain meaningful content for analysis.

    The implicit 'header' section (name, contact info) is excluded because
    it is not compared against job requirements.
    """
    return [s for s in sections if s.normalized_name != "header"]
