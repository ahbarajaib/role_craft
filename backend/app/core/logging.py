"""Centralised Loguru logging setup.

Call ``setup_logging`` once during application startup.  All subsequent
``from loguru import logger`` imports across the codebase share the same
configured sink without any additional setup.
"""

import sys

from loguru import logger

from app.core.config import Settings

##some
def format_record(record) -> str:
    """Format log record, adding request ID prefix if present."""
    req_id = record["extra"].get("request_id")
    record["extra"]["req_id_str"] = f" | <cyan>{req_id}</cyan>" if req_id else ""
    return (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level>{extra[req_id_str]} | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
        "{message}\n"
    )


def setup_logging(settings: Settings) -> None:
    """Configure Loguru for the application."""
    logger.remove()

    logger.add(
        sys.stderr,
        level=settings.LOG_LEVEL,
        format=format_record,
        colorize=True,
        backtrace=settings.DEBUG,
        diagnose=settings.DEBUG,
    )

    logger.info(
        "Logging initialised",
        environment=settings.ENVIRONMENT,
        level=settings.LOG_LEVEL,
    )
