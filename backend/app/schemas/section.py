"""Section detection response schemas.

Separate from ``schemas/parser.py`` because sections are a distinct
concern at a higher level of abstraction than raw paragraphs.
"""

from pydantic import BaseModel, Field


class SectionParagraph(BaseModel):
    """A paragraph as it appears inside a detected section."""

    index: int = Field(description="Original document position of this paragraph.")
    text: str = Field(description="Plain text content.")
    style_name: str = Field(description="Word paragraph style name.")
    is_bold: bool = Field(default=False, description="True when all runs in the paragraph are bold.")


class SectionItem(BaseModel):
    """A single detected resume section."""

    title: str = Field(description="Heading text as it appears in the document.")
    normalized_name: str | None = Field(
        description=(
            "Canonical section identifier (e.g. 'experience', 'skills'). "
            "Null for unknown custom sections."
        )
    )
    paragraph_indexes: list[int] = Field(
        description="Original document positions of every paragraph in this section."
    )
    paragraphs: list[SectionParagraph] = Field(
        description="Full paragraph content of this section."
    )


class DocumentSectionsResponse(BaseModel):
    """Response body for the sections endpoint."""

    document_id: str = Field(description="UUID of the document that was analysed.")
    section_count: int = Field(description="Number of sections detected.")
    sections: list[SectionItem] = Field(description="Detected sections in document order.")
