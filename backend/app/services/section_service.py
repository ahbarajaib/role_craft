"""Section detection service.

Orchestrates the full pipeline for the sections endpoint:

  1. Resolve the document path from ``document_id``.
  2. Parse the DOCX into paragraphs.
  3. Run the section detector.
  4. Convert to the API response schema.

Responsibilities
----------------
- Path resolution and existence check (raises ``NotFoundError`` on miss).
- Calling the parser and detector in order.
- Schema conversion.

Non-responsibilities
--------------------
- HTTP concerns (handled by the route).
- Section content interpretation (future AI milestone).
- Database persistence (future milestone).
"""

from pathlib import Path

from loguru import logger

from app.analyzers.section_detector import DetectedSection, detect_sections
from app.parsers.docx_parser import ParsedParagraph, parse_docx
from app.schemas.section import DocumentSectionsResponse, SectionItem, SectionParagraph

DOCX_EXTENSION = ".docx"


class SectionService:
    """Parses a DOCX and returns its detected section structure.

    Instantiated per-request via FastAPI dependency injection so that the
    upload directory can be reconfigured in tests without touching the
    filesystem.
    """

    def __init__(self, upload_dir: Path) -> None:
        self._upload_dir = upload_dir

    def detect_document_sections(self, document_id: str) -> DocumentSectionsResponse:
        """Run the full parse → detect → schema pipeline for a document.

        Raises ``NotFoundError`` when the document ID does not correspond
        to a file in the upload directory.
        """
        path = self._resolve_path(document_id)
        paragraphs = parse_docx(path)
        sections = detect_sections(paragraphs)

        logger.info(
            "Sections detected",
            document_id=document_id,
            section_count=len(sections),
        )

        return DocumentSectionsResponse(
            document_id=document_id,
            section_count=len(sections),
            sections=_to_schema(sections),
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    def _resolve_path(self, document_id: str) -> Path:
        """Return the expected path; raise ``NotFoundError`` if absent."""
        from app.utils.path_resolver import resolve_document_path
        return resolve_document_path(self._upload_dir, document_id)


# ── Schema conversion ─────────────────────────────────────────────────────────


def _to_schema(sections: list[DetectedSection]) -> list[SectionItem]:
    """Convert analyzer-layer dataclasses into API-layer Pydantic models.

    Module-level so it can be tested independently of the filesystem.
    """
    return [
        SectionItem(
            title=s.title,
            normalized_name=s.normalized_name,
            paragraph_indexes=s.paragraph_indexes,
            paragraphs=[
                SectionParagraph(index=p.index, text=p.text, style_name=p.style_name)
                for p in s.paragraphs
            ],
        )
        for s in sections
    ]


def _to_paragraphs(paragraphs: list[ParsedParagraph]) -> list[SectionParagraph]:
    """Convert a list of ``ParsedParagraph`` into ``SectionParagraph`` models."""
    return [
        SectionParagraph(index=p.index, text=p.text, style_name=p.style_name)
        for p in paragraphs
    ]
