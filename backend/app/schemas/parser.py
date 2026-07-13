"""Parser response schemas.

Defines the Pydantic models that cross the HTTP boundary for the parse
endpoint.  Kept separate from ``schemas/document.py`` because the parser
feature is a distinct concern from the upload feature.
"""

from pydantic import BaseModel, Field


class Paragraph(BaseModel):
    """A single extracted paragraph as returned by the API.

    Field names match the ``ParsedParagraph`` dataclass in the parser layer
    so that conversion is a straightforward attribute mapping.
    """

    index: int = Field(description="Zero-based position of this paragraph in the original document.")
    text: str = Field(description="Plain text content of the paragraph.")
    style_name: str = Field(description="Word paragraph style, e.g. 'Heading 1' or 'Normal'.")


class DocumentParseResponse(BaseModel):
    """Response body for the parse endpoint.

    Wraps the paragraph list with the ``document_id`` so that clients can
    correlate the result back to the uploaded file without needing to store
    it themselves.
    """

    document_id: str = Field(description="UUID of the document that was parsed.")
    paragraph_count: int = Field(description="Number of non-empty paragraphs found.")
    paragraphs: list[Paragraph] = Field(description="Paragraphs in document order.")
