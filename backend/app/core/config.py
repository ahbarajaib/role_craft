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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the application settings singleton.

    The result is cached so every caller receives the same object without
    re-reading the .env file or environment variables on every call.
    """
    return Settings()
