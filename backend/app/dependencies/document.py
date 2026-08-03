"""Document upload dependency factory.

Provides a ``get_document_service`` function that FastAPI injects into the
upload route handler via ``Depends``.  Centralising construction here means:

- The route handler stays thin (no knowledge of Path resolution or settings).
- Tests can override this dependency via ``app.dependency_overrides`` to
  swap in a different upload directory without touching the filesystem.
"""

from pathlib import Path
from typing import Annotated

from fastapi import Depends

from app.core.config import Settings
from app.dependencies.common import get_settings
from app.services.document_service import DocumentService
from app.services.pdf_upload_service import PdfUploadService


def get_document_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> DocumentService:
    """Construct a ``DocumentService`` from the current application settings.

    The upload directory is resolved relative to the working directory so
    that ``uvicorn main:app`` launched from ``backend/`` writes files to
    ``backend/uploads/`` as expected.
    """
    upload_dir = Path(settings.UPLOAD_DIR)
    return DocumentService(
        upload_dir=upload_dir,
        max_size_bytes=settings.MAX_UPLOAD_SIZE_BYTES,
        allowed_extensions=settings.ALLOWED_EXTENSIONS,
        allowed_mime_types=settings.ALLOWED_MIME_TYPES,
    )


def get_pdf_upload_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> PdfUploadService:
    """Construct a ``PdfUploadService`` from current application settings."""
    upload_dir = Path(settings.UPLOAD_DIR)
    return PdfUploadService(
        upload_dir=upload_dir,
        max_size_bytes=settings.MAX_UPLOAD_SIZE_BYTES,
    )

