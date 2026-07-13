"""Section service dependency factory.

Follows the same pattern as ``dependencies/parser.py``: constructs the
service from settings so that route handlers stay thin and tests can
swap the service via ``app.dependency_overrides``.
"""

from pathlib import Path
from typing import Annotated

from fastapi import Depends

from app.core.config import Settings
from app.dependencies.common import get_settings
from app.services.section_service import SectionService


def get_section_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> SectionService:
    """Construct a ``SectionService`` using the configured upload directory."""
    return SectionService(upload_dir=Path(settings.UPLOAD_DIR))
