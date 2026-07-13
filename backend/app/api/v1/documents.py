"""Document routes.

Exposes three endpoints:

    POST /documents/upload
        Validate and persist a DOCX file.  Returns upload metadata.

    GET /documents/{document_id}/parse
        Read a previously uploaded DOCX and return its paragraph structure.

    GET /documents/{document_id}/sections
        Detect logical resume sections from a previously uploaded DOCX.

The handlers validate nothing themselves — all business rules live in the
respective service classes.  The handlers' only responsibilities are:

1. Receive the request.
2. Delegate to the service.
3. Return the structured response.
"""

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, UploadFile, BackgroundTasks

from app.core.config import Settings
from app.dependencies.common import get_settings
from app.dependencies.document import get_document_service
from app.dependencies.parser import get_parser_service
from app.dependencies.section import get_section_service
from app.schemas.document import DocumentUploadResponse
from app.schemas.parser import DocumentParseResponse
from app.schemas.section import DocumentSectionsResponse
from app.services.document_service import DocumentService
from app.services.parser_service import ParserService
from app.services.section_service import SectionService
from app.services.cleanup import cleanup_old_files

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=201,
    summary="Upload a DOCX resume",
    description=(
        "Accepts a single .docx file (maximum 5 MB). "
        "Validates the file extension and MIME type, saves the file "
        "temporarily, and returns metadata including a unique document ID."
    ),
)
async def upload_document(
    file: UploadFile,
    service: Annotated[DocumentService, Depends(get_document_service)],
    background_tasks: BackgroundTasks,
    settings: Annotated[Settings, Depends(get_settings)],
) -> DocumentUploadResponse:
    """Receive a DOCX upload and delegate all processing to the service."""
    background_tasks.add_task(
        cleanup_old_files,
        upload_dir=Path(settings.UPLOAD_DIR),
        max_age_hours=settings.GENERATED_CLEANUP_HOURS,
    )
    return await service.save_upload(file)


@router.get(
    "/{document_id}/parse",
    response_model=DocumentParseResponse,
    summary="Parse a DOCX resume",
    description=(
        "Reads a previously uploaded DOCX file by its document ID and "
        "returns the paragraph structure in document order. "
        "Empty paragraphs are excluded. "
        "Returns 404 if the document ID is not found."
    ),
)
def parse_document(
    document_id: str,
    service: Annotated[ParserService, Depends(get_parser_service)],
) -> DocumentParseResponse:
    """Look up a DOCX by ID and return its parsed paragraph structure."""
    return service.parse_document(document_id)


@router.get(
    "/{document_id}/sections",
    response_model=DocumentSectionsResponse,
    summary="Detect resume sections",
    description=(
        "Parses a previously uploaded DOCX and groups its paragraphs into "
        "logical resume sections (e.g. Experience, Skills, Education). "
        "Uses Word heading styles and known section title text to detect boundaries. "
        "Unknown headings are preserved as custom sections. "
        "Returns 404 if the document ID is not found."
    ),
)
def detect_sections(
    document_id: str,
    service: Annotated[SectionService, Depends(get_section_service)],
) -> DocumentSectionsResponse:
    """Detect and return logical resume sections for an uploaded document."""
    return service.detect_document_sections(document_id)
