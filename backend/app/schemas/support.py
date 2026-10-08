from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class IssueReportRequest(BaseModel):
    issue_type: str = Field(
        default="bug",
        description="Type of issue: 'bug', 'formatting', 'ai_quality', 'payment', 'feature_request', or 'general'"
    )
    subject: str | None = Field(default=None, description="Optional brief title")
    description: str = Field(..., min_length=5, description="Details of the issue or feedback")
    user_email: str | None = Field(default=None, description="Contact email if user is not authenticated")
    context_data: dict[str, Any] | None = Field(
        default=None,
        description="Technical context such as URL, document_id, error details, browser and OS"
    )

class IssueReportResponse(BaseModel):
    success: bool = True
    report_id: int
    message: str = "Thank you! Your issue report has been received and our engineering team has been notified."
    created_at: datetime
