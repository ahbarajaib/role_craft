"""PDF upload service.

Contains all business logic for processing PDF resume uploads.

Flow:
1. Validate PDF extension and content length.
2. Parse PDF bytes using app.parsers.pdf_parser.parse_pdf.
3. Generate a clean, ATS-optimized DOCX using app.services.docx_generator.
4. Save the generated .docx to upload_dir / {document_id}.docx (so all downstream
   DOCX-based services work seamlessly without modification).
5. Return DocumentUploadResponse.
"""

from datetime import UTC, datetime
from pathlib import Path
import uuid

from fastapi import UploadFile
from loguru import logger

from app.core.exceptions import BadRequestError
from app.parsers.pdf_parser import parse_pdf
from app.schemas.document import DocumentUploadResponse
from app.services.docx_generator import generate_docx_bytes

STATUS_UPLOADED = "uploaded"


class PdfUploadService:
    """Handles PDF upload validation, parsing, conversion to DOCX, and storage."""

    def __init__(self, upload_dir: Path, max_size_bytes: int) -> None:
        self._upload_dir = upload_dir
        self._max_size_bytes = max_size_bytes

    async def save_pdf_upload(self, file: UploadFile) -> DocumentUploadResponse:
        """Validate, parse, convert, and persist a PDF upload as an ATS-optimized DOCX.

        Raises ``BadRequestError`` for scanned PDFs or invalid file sizes.
        """
        filename = file.filename or ""
        if not filename.lower().endswith(".pdf"):
            raise BadRequestError("Invalid file type. Only .pdf files are accepted by this endpoint.")

        content = await file.read()

        if len(content) > self._max_size_bytes:
            limit_mb = self._max_size_bytes / (1024 * 1024)
            raise BadRequestError(f"PDF file too large. Maximum allowed size is {limit_mb:.0f} MB.")

        # 1. Parse PDF text content
        parsed = parse_pdf(content)

        # 2. Generate clean DOCX document bytes
        docx_bytes = generate_docx_bytes(parsed)

        # 3. Store as {document_id}.docx in upload_dir
        document_id = str(uuid.uuid4())
        self._upload_dir.mkdir(parents=True, exist_ok=True)
        destination = self._upload_dir / f"{document_id}.docx"
        destination.write_bytes(docx_bytes)

        logger.info(
            "PDF uploaded and converted to DOCX",
            document_id=document_id,
            original_filename=filename,
            pdf_size=len(content),
            docx_size=len(docx_bytes),
            destination=str(destination),
        )

        return DocumentUploadResponse(
            document_id=document_id,
            filename=filename,
            content_type="application/pdf",
            size=len(content),
            uploaded_at=datetime.now(UTC),
            status=STATUS_UPLOADED,
        )
