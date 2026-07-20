"""DOCX paragraph parser.

Reads a DOCX file from disk and extracts its paragraph structure.

This module is the Parser Layer described in architecture.md.  It is
intentionally kept pure:

- It has no knowledge of HTTP, FastAPI, or services.
- It takes a ``Path``, returns a list of ``ParsedParagraph`` objects.
- All its logic can be exercised with a plain ``Path`` in a unit test.

What is extracted
-----------------
Every paragraph in document order, excluding empty ones, with:
- ``index``      : zero-based position in the document
- ``text``       : plain text content of the paragraph
- ``style_name`` : the Word paragraph style (e.g. "Normal", "Heading 1")

What is NOT extracted (deferred to later milestones)
----------------------------------------------------
- Tables
- Images
- Headers and footers
- Text runs and their formatting
- Resume section classification
"""

from dataclasses import dataclass
from pathlib import Path

import docx
from loguru import logger


@dataclass(frozen=True)
class ParsedParagraph:
    """Immutable representation of a single DOCX paragraph.

    Frozen so that callers cannot accidentally mutate parser output after
    the fact, which would make debugging very difficult.
    """

    index: int
    text: str
    style_name: str


def parse_docx(path: Path) -> list[ParsedParagraph]:
    """Extract non-empty paragraphs from a DOCX file in document order.

    Parameters
    ----------
    path:
        Absolute or relative path to a ``.docx`` file.  The caller is
        responsible for confirming the file exists before calling this
        function; a missing file raises ``FileNotFoundError``.

    Returns
    -------
    list[ParsedParagraph]
        Paragraphs in the order they appear in the document, including
        text inside tables (common in modern resume templates).
        Empty paragraphs (whitespace-only) are filtered out because they
        carry no semantic content and would clutter downstream processing.
    """
    logger.debug("Parsing DOCX", path=str(path))

    document = docx.Document(str(path))

    # Collect all block-level elements (paragraphs + table cells) in body order.
    # python-docx exposes document.element.body which contains <w:p> and <w:tbl>
    # elements in document order. We iterate them directly to preserve ordering.
    all_paragraphs: list[docx.text.paragraph.Paragraph] = []

    from docx.oxml.ns import qn as _qn

    body = document.element.body
    for child in body:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if tag == "p":
            # Standalone paragraph
            all_paragraphs.append(docx.text.paragraph.Paragraph(child, document))
        elif tag == "tbl":
            # Table: extract each cell's paragraphs in row/cell order
            from docx.table import Table
            tbl = Table(child, document)
            for row in tbl.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        all_paragraphs.append(para)

    paragraphs = _extract_paragraphs(all_paragraphs)

    logger.debug("Parsed DOCX", path=str(path), paragraph_count=len(paragraphs))
    return paragraphs


def _extract_paragraphs(
    raw_paragraphs: list[docx.text.paragraph.Paragraph],
) -> list[ParsedParagraph]:
    """Convert python-docx paragraph objects into ``ParsedParagraph`` values.

    The sequential ``index`` reflects the paragraph's position in the
    *original* document, not its position in the filtered output.  This
    preserves the exact location information needed by a future patching
    milestone that must know which paragraph to modify.
    """
    result: list[ParsedParagraph] = []

    for index, para in enumerate(raw_paragraphs):
        text = para.text.strip()
        if not text:
            # Skip whitespace-only paragraphs – they add no semantic value.
            continue
        result.append(
            ParsedParagraph(
                index=index,
                text=text,
                style_name=para.style.name if para.style else "Normal",
            )
        )

    return result
