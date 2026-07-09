"""Centralised Loguru logging setup.

Call ``setup_logging`` once during application startup.  All subsequent
``from loguru import logger`` imports across the codebase share the same
configured sink without any additional setup.
"""

import sys

from loguru import logger

from app.core.config import Settings


def setup_logging(settings: Settings) -> None:
    """Configure Loguru for the application.

    Removes the default Loguru sink and replaces it with one that matches
    the log level and format appropriate for the current environment.

    In production a JSON-style format would be preferred; for now a rich
    human-readable format is used so development output is easy to follow.
    """
    logger.remove()

    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
        "{message}"
    )

    logger.add(
        sys.stderr,
        level=settings.LOG_LEVEL,
        format=log_format,
        colorize=True,
        backtrace=settings.DEBUG,
        diagnose=settings.DEBUG,
    )

    logger.info(
        "Logging initialised",
        environment=settings.ENVIRONMENT,
        level=settings.LOG_LEVEL,
    )
