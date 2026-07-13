"""Application configuration.

Settings are loaded from environment variables and from a .env file in the
working directory.  The module exposes a single ``get_settings`` function that
returns a cached ``Settings`` instance so the heavy I/O of reading the file
only happens once per process.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration for the application.

    Every field maps directly to an environment variable of the same name.
    Pydantic-Settings automatically coerces string env values to the
    declared Python type (e.g. "true" → True, '["*"]' → list[str]).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Ignore unknown env variables rather than raising validation errors.
        extra="ignore",
    )

    # ── Application identity ────────────────────────────────────────────────
    APP_NAME: str = "Resume AI"
    APP_VERSION: str = "0.1.0"

    # ── Runtime environment ─────────────────────────────────────────────────
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False

    # ── Logging ─────────────────────────────────────────────────────────────
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    # ── API ──────────────────────────────────────────────────────────────────
    API_PREFIX: str = "/api/v1"

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Provide as a JSON array in the env file, e.g.
    #   ALLOWED_ORIGINS='["http://localhost:3000"]'
    ALLOWED_ORIGINS: list[str] = Field(default=["http://localhost:3000"])

    # ── Server (used only when running via `python main.py`) ─────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── File uploads ─────────────────────────────────────────────────────────
    # Directory where uploaded files are stored temporarily.
    # Relative paths are resolved from the working directory (backend/).
    UPLOAD_DIR: str = "uploads"
    # 5 MB expressed in bytes.
    MAX_UPLOAD_SIZE_BYTES: int = 5 * 1024 * 1024
    # Lifetime in hours before uploaded/generated files are auto-cleaned
    GENERATED_CLEANUP_HOURS: int = 24
    # Supported file extensions
    ALLOWED_EXTENSIONS: list[str] = [".docx"]
    # Supported MIME types
    ALLOWED_MIME_TYPES: list[str] = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]

    # ── OpenAI ────────────────────────────────────────────────────────────────
    # Set OPENAI_API_KEY in .env – never commit the real key.
    OPENAI_API_KEY: str = ""
    # gpt-4o-mini is the cheapest model that supports structured outputs.
    OPENAI_MODEL: str = "gpt-4o-mini"
    # Timeout in seconds for AI queries
    OPENAI_TIMEOUT_SECONDS: float = 30.0


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the application settings singleton.

    The result is cached so every caller receives the same object without
    re-reading the .env file or environment variables on every call.
    """
    return Settings()
