from typing import Any
import logging

from app.ai.provider import OpenAIProvider, AIProviderError
from app.schemas.job_search import JobScoreResult

logger = logging.getLogger(__name__)

class ATSScoringService:
    def __init__(self, ai_provider: OpenAIProvider):
        self.ai_provider = ai_provider

    def score_job(self, resume_text: str, job_description: str) -> JobScoreResult:
        """
        Scores a job description against a resume using the LLM.
        """
        instructions = (
            "You are an expert ATS (Applicant Tracking System) algorithm. "
            "Your task is to evaluate a candidate's resume against a specific job description. "
            "You will return an object with exactly two properties: "
            "'score' (an integer from 0 to 100 representing the match percentage) and "
            "'rationale' (a 1-2 sentence explanation for the score, highlighting key missing or matching skills)."
        )

        input_text = (
            f"Here is the resume:\n\n{resume_text}\n\n"
            f"Here is the job description:\n\n{job_description}\n\n"
            "Evaluate the match and provide the score and rationale."
        )

        try:
            response = self.ai_provider.parse_response(
                instructions=instructions,
                input_text=input_text,
                response_format=JobScoreResult
            )
            return response

        except Exception as e:
            logger.error(f"Failed to score job: {e}")
            raise AIProviderError(f"Failed to generate ATS score: {e}")
