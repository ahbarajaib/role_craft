"""Document upload service.

Contains all business logic for the document upload flow.  The route handler
calls ``save_upload`` and returns the result without knowing anything about
file I/O, UUID generation, or validation rules.

Responsibilities
----------------
- Validate file extension
- Validate MIME type
- Enforce maximum file size
- Persist the file to the configured upload directory
- Return structured metadata about the upload

Non-responsibilities
--------------------
- Parsing document content (future milestone)
- Database persistence (future milestone)
- Authentication (future milestone)
"""

import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import UploadFile
from loguru import logger

from app.core.config import Settings
from app.core.exceptions import BadRequestError
from app.schemas.document import DocumentUploadResponse

# Status value used in the response for a freshly saved upload.
STATUS_UPLOADED = "uploaded"


class DocumentService:
    """Handles document upload validation and persistence.

    Instantiated per-request via FastAPI dependency injection so that the
    upload directory and size limit can be reconfigured between test runs
    without monkey-patching globals.
    """

    def __init__(
        self,
        upload_dir: Path,
        max_size_bytes: int,
        allowed_extensions: list[str] | None = None,
        allowed_mime_types: list[str] | None = None,
    ) -> None:
        self._upload_dir = upload_dir
        self._max_size_bytes = max_size_bytes
        self._allowed_extensions = allowed_extensions or [".docx"]
        self._allowed_mime_types = allowed_mime_types or [
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]

    async def save_upload(self, file: UploadFile) -> DocumentUploadResponse:
        """Validate and persist an uploaded file.

        Raises ``BadRequestError`` for any validation failure so the global
        exception handler returns a consistent 400 JSON response without
        leaking implementation details.
        """
        self._validate_extension(file.filename or "")
        self._validate_mime_type(file.content_type or "")

        content = await file.read()
        self._validate_size(len(content))

        document_id = str(uuid.uuid4())
        saved_path = self._persist(document_id, content)

        logger.info(
            "Document uploaded",
            document_id=document_id,
            filename=file.filename,
            size=len(content),
            path=str(saved_path),
        )

        return DocumentUploadResponse(
            document_id=document_id,
            filename=file.filename or "",
            content_type=file.content_type or self._allowed_mime_types[0],
            size=len(content),
            uploaded_at=datetime.now(UTC),
            status=STATUS_UPLOADED,
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    def _validate_extension(self, filename: str) -> None:
        """Reject files whose name does not end with one of the allowed extensions."""
        if not any(filename.lower().endswith(ext) for ext in self._allowed_extensions):
            raise BadRequestError(
                f"Invalid file type. Only {', '.join(self._allowed_extensions)} files are accepted."
            )

    def _validate_mime_type(self, content_type: str) -> None:
        """Reject files whose declared MIME type does not match one of the allowed types."""
        if content_type not in self._allowed_mime_types:
            raise BadRequestError(
                f"Invalid content type '{content_type}'. "
                f"Expected one of: {', '.join(self._allowed_mime_types)}."
            )

    def _validate_size(self, size: int) -> None:
        """Reject files that exceed the configured size limit."""
        if size > self._max_size_bytes:
            limit_mb = self._max_size_bytes / (1024 * 1024)
            raise BadRequestError(
                f"File too large. Maximum allowed size is {limit_mb:.0f} MB."
            )

    def _persist(self, document_id: str, content: bytes) -> Path:
        """Write the file bytes to the upload directory.

        The filename uses the UUID as a stem so collisions are impossible and
        the original filename is not exposed on the filesystem.
        """
        self._upload_dir.mkdir(parents=True, exist_ok=True)
        ext = self._allowed_extensions[0]
        destination = self._upload_dir / f"{document_id}{ext}"
        destination.write_bytes(content)
        return destination
