"""Parser service dependency factory.

Constructs a ``ParserService`` from the application settings and hands it
to route handlers via FastAPI's ``Depends`` mechanism.

Keeping this in ``dependencies/`` rather than inline in the route means:
- The route handler has no knowledge of ``Path`` resolution or settings.
- Tests can replace the service via ``app.dependency_overrides``.
"""

from pathlib import Path
from typing import Annotated

from fastapi import Depends

from app.core.config import Settings
from app.dependencies.common import get_settings
from app.services.parser_service import ParserService


def get_parser_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ParserService:
    """Construct a ``ParserService`` using the configured upload directory."""
    return ParserService(upload_dir=Path(settings.UPLOAD_DIR))
