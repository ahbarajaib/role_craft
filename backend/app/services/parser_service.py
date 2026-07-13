"""Document parser service.

Bridges the HTTP layer and the parser layer.

Responsibilities
----------------
- Accept a ``document_id`` string.
- Resolve the corresponding file path in the upload directory.
- Raise ``NotFoundError`` if the file does not exist.
- Delegate reading to ``parse_docx``.
- Convert parser output into ``DocumentParseResponse``.

Non-responsibilities
--------------------
- HTTP concerns (handled by the route).
- Reading bytes from the request (handled by DocumentService in Milestone 2).
- Any understanding of resume structure (future milestone).
"""

from pathlib import Path

from loguru import logger

from app.core.exceptions import NotFoundError
from app.parsers.docx_parser import ParsedParagraph, parse_docx
from app.schemas.parser import DocumentParseResponse, Paragraph

DOCX_EXTENSION = ".docx"


class ParserService:
    """Resolves a document by ID and returns its parsed paragraph structure.

    Instantiated per-request via FastAPI dependency injection so that the
    upload directory can be reconfigured in tests without touching the
    filesystem.
    """

    def __init__(self, upload_dir: Path) -> None:
        self._upload_dir = upload_dir

    def parse_document(self, document_id: str) -> DocumentParseResponse:
        """Parse the DOCX identified by ``document_id``.

        Raises ``NotFoundError`` when no file with that ID exists in the
        upload directory, which causes the global exception handler to
        return a 404 response.
        """
        path = self._resolve_path(document_id)
        try:
            paragraphs = parse_docx(path)
        except Exception as exc:
            logger.error(
                "Document parsing failed due to invalid formatting or corruption",
                document_id=document_id,
                error=str(exc)
            )
            from app.core.exceptions import BadRequestError
            raise BadRequestError(
                "The resume document is corrupted or not in a valid Word (.docx) format."
            ) from exc

        logger.info(
            "Document parsed",
            document_id=document_id,
            paragraph_count=len(paragraphs),
        )

        return DocumentParseResponse(
            document_id=document_id,
            paragraph_count=len(paragraphs),
            paragraphs=_to_schema(paragraphs),
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    def _resolve_path(self, document_id: str) -> Path:
        """Return the expected filesystem path for a given document ID.

        Raises ``NotFoundError`` if the file is absent so callers do not
        need to handle ``FileNotFoundError`` themselves.
        """
        path = self._upload_dir / f"{document_id}{DOCX_EXTENSION}"
        if not path.exists():
            raise NotFoundError(f"Document '{document_id}' not found.")
        return path


def _to_schema(paragraphs: list[ParsedParagraph]) -> list[Paragraph]:
    """Convert parser-layer dataclasses into API-layer Pydantic models.

    Kept as a module-level function (not a method) so it can be tested
    independently of the service's filesystem interaction.
    """
    return [
        Paragraph(index=p.index, text=p.text, style_name=p.style_name)
        for p in paragraphs
    ]
