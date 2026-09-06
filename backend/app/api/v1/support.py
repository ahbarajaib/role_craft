import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from loguru import logger

from app.core.database import get_db
from app.dependencies.auth import get_optional_current_user
from app.models import User, IssueReport
from app.schemas.support import IssueReportRequest, IssueReportResponse

router = APIRouter(prefix="/support", tags=["Support & Issues"])

@router.post("/report-issue", response_model=IssueReportResponse)
def report_issue(
    payload: IssueReportRequest,
    db: Session = Depends(get_db),
    optional_user: Optional[User] = Depends(get_optional_current_user),
) -> IssueReportResponse:
    """Submit a bug report, formatting error, AI quality feedback, or general inquiry.
    
    Saves to the database for administrative triage in the Admin Dashboard.
    """
    user_id = optional_user.id if optional_user else None
    user_email = payload.user_email or (optional_user.email if optional_user else None)
    now = datetime.utcnow()

    # Convert context dict to string if provided
    context_str = json.dumps(payload.context_data) if payload.context_data else None

    # 1. Save to Database
    issue = IssueReport(
        user_id=user_id,
        user_email=user_email,
        issue_type=payload.issue_type,
        subject=payload.subject,
        description=payload.description.strip(),
        context_data=context_str,
        status="open",
        created_at=now,
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)

    logger.info(
        f"📩 [Support Issue Received] ID={issue.id} type={issue.issue_type} "
        f"user_email={user_email or 'anonymous'} user_id={user_id or 'none'}"
    )

    return IssueReportResponse(
        success=True,
        report_id=issue.id,
        message="Thank you! Your issue report has been received and our engineering team has been notified.",
        created_at=now,
    )

