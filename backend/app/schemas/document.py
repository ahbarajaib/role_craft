"""Document-related Pydantic schemas.

Defines the shapes of data that cross the HTTP boundary for the documents
feature.  Keeping schemas separate from services and routes means any layer
can import them without pulling in unrelated dependencies.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    """Response body returned after a successful document upload.

    All fields are populated by ``DocumentService.save_upload``; the route
    handler returns this object directly without adding or removing fields.
    """

    document_id: str = Field(description="UUID assigned to this upload.")
    filename: str = Field(description="Original filename as provided by the client.")
    content_type: str = Field(description="MIME type of the uploaded file.")
    size: int = Field(description="File size in bytes.")
    uploaded_at: datetime = Field(description="UTC timestamp of the upload.")
    status: str = Field(description="Upload lifecycle status.")
