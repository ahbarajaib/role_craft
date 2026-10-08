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
    ALLOWED_ORIGINS: list[str] = Field(
        default=[
            "http://localhost:3000",
            "https://rolecraft.tech",
            "https://www.rolecraft.tech",
            "https://api.rolecraft.tech",
            "https://admin.rolecraft.tech",
        ]
    )

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
    # Timeout in seconds for AI queries (increased to 120s for complex structured output generation)
    OPENAI_TIMEOUT_SECONDS: float = 120.0

    # ── Authentication ────────────────────────────────────────────────────────
    JWT_SECRET: str = "supersecretrolecraftkey_secure_32bytes_min"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 10080  # 7 days (7 * 24 * 60 minutes)
    GOOGLE_CLIENT_ID: str = ""

    # ── Razorpay Billing ──────────────────────────────────────────────────────
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_PLAN_PRO_ID: str = ""
    RAZORPAY_PLAN_ELITE_ID: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # ── Credits Configuration ─────────────────────────────────────────────────
    # To change free tier credits: set FREE_TIER_CREDITS=25 in .env (no code change needed)
    # To add VIP emails: set VIP_EMAILS='["you@example.com"]' in .env
    FREE_TIER_CREDITS: int = 15
    VIP_CREDITS: int = 300
    PRO_CREDITS: int = 200
    ELITE_CREDITS: int = 400
    VIP_EMAILS: list[str] = Field(
        default=["ahbarajaib@gmail.com", "absarajaib@gmail.com"]
    )

    # ── Support & Email Notifications ─────────────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@rolecraft.tech"
    SMTP_USE_TLS: bool = True
    SUPPORT_NOTIFICATION_EMAIL: str = "ahbarajaib@gmail.com"

    # ── Admin Dashboard ───────────────────────────────────────────────────────
    ADMIN_SECRET: str = ""

    # ── Monitoring & Error Tracking ──────────────────────────────────────────
    SENTRY_DSN: str = ""



@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the application settings singleton.

    The result is cached so every caller receives the same object without
    re-reading the .env file or environment variables on every call.
    """
    return Settings()
