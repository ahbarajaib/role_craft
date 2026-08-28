"""OpenAI provider.

Wraps the OpenAI client and exposes a single typed method for structured
response generation.  The rest of the application never imports ``openai``
directly — all OpenAI interactions go through this class.
# Credit system: only /analyze costs 1 credit. All other AI ops are credit-free.

Responsibilities (AI Layer — architecture.md)
---------------------------------------------
- Construct and configure the OpenAI client.
- Call the Responses API with structured output format.
- Raise ``AIProviderError`` on any OpenAI error so callers receive a
  consistent exception type regardless of which provider is used.

Non-responsibilities
--------------------
- Prompt construction (handled by ``app.ai.prompts``).
- Business logic (handled by ``app.services.analysis_service``).
- HTTP concerns (handled by routes).
"""

from typing import TypeVar

from loguru import logger
from openai import APIError, APITimeoutError, OpenAI
from pydantic import BaseModel

from app.core.exceptions import AppError

T = TypeVar("T", bound=BaseModel)


class AIProviderError(AppError):
    """Raised when the AI provider returns an error or unexpected response.

    Inherits from ``AppError`` so the global exception handler returns a
    consistent 500 JSON body without leaking provider details.
    """

    default_detail = "The AI provider returned an error. Please try again."


class OpenAIProvider:
    """Thin wrapper around the OpenAI Responses API.

    Instantiated once per request via dependency injection so that the API
    key and model can be reconfigured between test runs.
    """

    def __init__(self, api_key: str, model: str, timeout: float = 30.0) -> None:
        if not api_key or not api_key.strip():
            logger.error("OpenAI API Key is empty or not configured.")
            raise AIProviderError(
                "OpenAI credentials are not configured. Please set the "
                "OPENAI_API_KEY environment variable in your .env file."
            )
        try:
            self._client = OpenAI(api_key=api_key)
        except Exception as exc:
            logger.error("Failed to initialize OpenAI client", error=str(exc))
            raise AIProviderError(
                "Failed to initialize the AI provider. Please verify your credentials."
            )
        self._model = model
        self._timeout = timeout

    def parse_response(
        self,
        instructions: str,
        input_text: str,
        response_format: type[T],
        max_output_tokens: int | None = None,
    ) -> T:
        """Call the Responses API and return a validated Pydantic model."""
        logger.debug(
            "Calling OpenAI Responses API",
            model=self._model,
            response_format=response_format.__name__,
            max_output_tokens=max_output_tokens,
        )

        kwargs = {
            "model": self._model,
            "instructions": instructions,
            "input": input_text,
            "text_format": response_format,
            "temperature": 0,
            "store": False,
            "timeout": self._timeout,
        }
        if max_output_tokens is not None:
            kwargs["max_output_tokens"] = max_output_tokens

        try:
            response = self._client.responses.parse(**kwargs)
        except APITimeoutError as exc:
            logger.error(f"OpenAI API request timed out: {exc}")
            raise AIProviderError(
                "The connection to the AI provider timed out. Please try again."
            ) from exc
        except APIError as exc:
            logger.error(f"OpenAI API error (status={exc.status_code}): {exc}")
            raise AIProviderError(f"OpenAI API error: {exc}") from exc

        parsed = response.output_parsed
        if parsed is None:
            logger.error("OpenAI returned null parsed output")
            raise AIProviderError("The AI provider returned an empty response.")

        logger.debug(
            "OpenAI Responses API call complete",
            model=self._model,
            input_tokens=response.usage.input_tokens if response.usage else None,
            output_tokens=response.usage.output_tokens if response.usage else None,
        )

        return parsed  # type: ignore[return-value]

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.4,
    ) -> str:
        """Call OpenAI API for free-form text generation."""
        logger.debug("Calling OpenAI API for text generation", model=self._model)
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
                timeout=self._timeout,
            )
            content = response.choices[0].message.content
            if not content:
                raise AIProviderError("The AI provider returned an empty text response.")
            return content.strip()
        except APITimeoutError as exc:
            logger.error(f"OpenAI API request timed out: {exc}")
            raise AIProviderError("The connection to the AI provider timed out. Please try again.") from exc
        except APIError as exc:
            logger.error(f"OpenAI API error: {exc}")
            raise AIProviderError(f"OpenAI API error: {exc}") from exc

