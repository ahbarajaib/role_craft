"""Document routes.

Exposes endpoints:

    POST /documents/upload
        Validate and persist a DOCX file.  Returns upload metadata.

    GET /documents/{document_id}/parse
        Read a previously uploaded DOCX and return its paragraph structure.

    GET /documents/{document_id}/sections
        Detect logical resume sections from a previously uploaded DOCX.

    GET /documents/base
        Return the authenticated user's saved base resume metadata.

    POST /documents/set-base
        Save the given document_id as the authenticated user's base resume.
        Copies the file to a persistent uploads/base/ directory so it is
        not deleted by the periodic cleanup service.

The handlers validate nothing themselves — all business rules live in the
respective service classes.  The handlers' only responsibilities are:

1. Receive the request.
2. Delegate to the service.
3. Return the structured response.
"""

import shutil
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, UploadFile, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.dependencies.auth import get_current_user
from app.dependencies.common import get_settings
from app.dependencies.document import get_document_service
from app.dependencies.parser import get_parser_service
from app.dependencies.section import get_section_service
from app.models import User
from app.schemas.document import DocumentUploadResponse
from app.schemas.parser import DocumentParseResponse
from app.schemas.section import DocumentSectionsResponse
from app.services.cleanup import cleanup_old_files
from app.services.document_service import DocumentService
from app.services.parser_service import ParserService
from app.services.section_service import SectionService

router = APIRouter(prefix="/documents", tags=["documents"])


class SetBaseResumeRequest(BaseModel):
    document_id: str
    filename: str


class BaseResumeResponse(BaseModel):
    document_id: Optional[str] = None
    filename: Optional[str] = None


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
    "/base",
    response_model=BaseResumeResponse,
    summary="Get the user's saved base resume",
    description="Returns the document_id and filename of the authenticated user's saved base resume, if any.",
)
def get_base_resume(
    user: Annotated[User, Depends(get_current_user)],
) -> BaseResumeResponse:
    """Return the stored base resume metadata for the current user."""
    return BaseResumeResponse(
        document_id=user.base_resume_id,
        filename=user.base_resume_filename,
    )


@router.post(
    "/set-base",
    response_model=BaseResumeResponse,
    summary="Save a document as the user's base resume",
    description=(
        "Copies the specified document to a persistent storage location "
        "so it survives cleanup cycles. Replaces any previously saved base resume."
    ),
)
def set_base_resume(
    body: SetBaseResumeRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> BaseResumeResponse:
    """Copy the given document to the base resume store and update the user record."""
    upload_dir = Path(settings.UPLOAD_DIR)
    src_path = upload_dir / f"{body.document_id}.docx"
    if not src_path.exists():
        raise NotFoundError(f"Document '{body.document_id}' not found.")

    # Persist to base/ subdirectory keyed by user ID (not auto-cleaned)
    base_dir = upload_dir / "base"
    base_dir.mkdir(parents=True, exist_ok=True)
    dest_path = base_dir / f"{user.id}.docx"
    shutil.copy2(src_path, dest_path)

    # Store the stable base document_id as user_{id}_base so the download endpoint
    # can serve it without confusion with regular uploads
    stable_id = f"base/{user.id}"
    user.base_resume_id = stable_id
    user.base_resume_filename = body.filename
    db.commit()
    db.refresh(user)

    return BaseResumeResponse(document_id=stable_id, filename=body.filename)


@router.post(
    "/set-base-cover-letter",
    response_model=BaseResumeResponse,
    summary="Save a document as the user's base cover letter template",
)
def set_base_cover_letter(
    body: SetBaseResumeRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> BaseResumeResponse:
    """Copy the given document to the base cover letter store and update user record."""
    upload_dir = Path(settings.UPLOAD_DIR)
    src_path = upload_dir / f"{body.document_id}.docx"
    if not src_path.exists():
        raise NotFoundError(f"Document '{body.document_id}' not found.")

    base_dir = upload_dir / "base"
    base_dir.mkdir(parents=True, exist_ok=True)
    dest_path = base_dir / f"{user.id}_cover_letter.docx"
    shutil.copy2(src_path, dest_path)

    stable_id = f"base/{user.id}_cover_letter"
    user.base_cover_letter_id = stable_id
    user.base_cover_letter_filename = body.filename
    db.commit()
    db.refresh(user)

    return BaseResumeResponse(document_id=stable_id, filename=body.filename)


@router.delete(
    "/base-cover-letter",
    summary="Delete the user's saved base cover letter template",
)
def delete_base_cover_letter(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    """Delete saved base cover letter template."""
    upload_dir = Path(settings.UPLOAD_DIR)
    dest_path = upload_dir / "base" / f"{user.id}_cover_letter.docx"
    if dest_path.exists():
        try:
            dest_path.unlink()
        except Exception:
            pass

    user.base_cover_letter_id = None
    user.base_cover_letter_filename = None
    db.commit()
    return {"status": "ok", "message": "Base cover letter template removed."}


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
