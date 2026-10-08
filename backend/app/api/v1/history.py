"""Analysis History & Daily Goal API Endpoints.

Allows users to retrieve past resume tailoring sessions, reload previous analyses into
the workspace, track daily progress toward application targets, and update their daily goal.
"""

import contextlib
import json
from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.limits import get_current_user
from app.models import AnalysisHistory, User
from app.schemas.history import (
    AnalysisHistoryItem,
    DailyTargetSummary,
    HistoryDetailResponse,
    HistoryResponse,
    HistorySummaryStats,
    UpdateDailyTargetRequest,
)

router = APIRouter(prefix="/history", tags=["history"])


def get_user_local_date(dt: datetime, tz_offset_minutes: int) -> date:
    """Convert a UTC datetime to user's local date based on JS getTimezoneOffset() minutes.

    JS getTimezoneOffset() returns (UTC - Local) in minutes:
      - IST (UTC+5:30) returns -330  => Local = UTC - (-330m) = UTC + 5h30m
      - EDT (UTC-4:00) returns +240  => Local = UTC - (+240m) = UTC - 4h00m
    """
    local_dt = dt - timedelta(minutes=tz_offset_minutes)
    return local_dt.date()


@router.get("", response_model=HistoryResponse, summary="Get resume analysis history and daily target summary")
def get_history(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    tz_offset: int = Query(0, description="User local timezone offset in minutes from getTimezoneOffset()"),
) -> HistoryResponse:
    """Return all past history records and summary metrics for current user."""
    # 1. Fetch user's history ordered by created_at desc
    stmt = (
        select(AnalysisHistory)
        .where(AnalysisHistory.user_id == current_user.id)
        .order_by(AnalysisHistory.created_at.desc())
    )
    records = db.scalars(stmt).all()

    # 2. Build history item schemas
    items = [
        AnalysisHistoryItem(
            id=r.id,
            document_id=r.document_id,
            filename=r.filename,
            target_role=r.target_role,
            target_company=r.target_company,
            overall_score=r.overall_score,
            sections_need_improvement=r.sections_need_improvement,
            total_sections=r.total_sections,
            download_id=r.download_id,
            created_at=r.created_at,
        )
        for r in records
    ]

    # 3. Calculate today's completed analyses count in user's local timezone (resets at local midnight)
    today_local = get_user_local_date(datetime.utcnow(), tz_offset)
    today_records = [r for r in records if get_user_local_date(r.created_at, tz_offset) == today_local]
    today_completed = len(today_records)
    daily_target = max(1, current_user.daily_target or 10)
    progress_percentage = min(100, int((today_completed / daily_target) * 100))
    goal_achieved = today_completed >= daily_target

    daily_summary = DailyTargetSummary(
        today_completed=today_completed,
        daily_target=daily_target,
        progress_percentage=progress_percentage,
        goal_achieved=goal_achieved,
    )

    # 4. Calculate overall history stats
    total_analyzed = len(records)
    average_score = (
        int(sum(r.overall_score for r in records) / total_analyzed) if total_analyzed > 0 else 0
    )
    latest_analysis_at = records[0].created_at if records else None

    summary = HistorySummaryStats(
        total_analyzed=total_analyzed,
        average_score=average_score,
        latest_analysis_at=latest_analysis_at,
        daily_summary=daily_summary,
    )

    return HistoryResponse(items=items, summary=summary)


@router.patch("/target", response_model=DailyTargetSummary, summary="Update user daily application target goal")
@router.put("/target", response_model=DailyTargetSummary, summary="Update user daily application target goal (PUT fallback)")
def update_daily_target(
    body: UpdateDailyTargetRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    tz_offset: int = Query(0, description="User local timezone offset in minutes from getTimezoneOffset()"),
) -> DailyTargetSummary:
    """Update current user's daily target application goal."""
    target_val = max(1, body.daily_target)
    current_user.daily_target = target_val
    db.add(current_user)
    db.commit()

    # Recalculate today's summary accurately in user's local timezone
    stmt = select(AnalysisHistory).where(AnalysisHistory.user_id == current_user.id)
    records = db.scalars(stmt).all()
    today_local = get_user_local_date(datetime.utcnow(), tz_offset)
    today_completed = len([r for r in records if get_user_local_date(r.created_at, tz_offset) == today_local])
    progress_percentage = min(100, int((today_completed / target_val) * 100))

    return DailyTargetSummary(
        today_completed=today_completed,
        daily_target=target_val,
        progress_percentage=progress_percentage,
        goal_achieved=today_completed >= target_val,
    )


@router.get("/{history_id}", response_model=HistoryDetailResponse, summary="Get detailed history session for workspace reload")
def get_history_detail(
    history_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> HistoryDetailResponse:
    """Return full analysis result JSON to reload workspace."""
    record = db.get(AnalysisHistory, history_id)
    if not record or record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"History record '{history_id}' not found.",
        )

    analysis_data = {}
    if record.analysis_result_json:
        with contextlib.suppress(Exception):
            analysis_data = json.loads(record.analysis_result_json)

    item = AnalysisHistoryItem(
        id=record.id,
        document_id=record.document_id,
        filename=record.filename,
        target_role=record.target_role,
        target_company=record.target_company,
        overall_score=record.overall_score,
        sections_need_improvement=record.sections_need_improvement,
        total_sections=record.total_sections,
        download_id=record.download_id,
        created_at=record.created_at,
    )

    return HistoryDetailResponse(
        item=item,
        analysis_result=analysis_data,
        job_description_text=record.job_description_text or "",
    )


@router.delete("/{history_id}", summary="Delete history record")
def delete_history_item(
    history_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """Delete a history item."""
    record = db.get(AnalysisHistory, history_id)
    if not record or record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"History record '{history_id}' not found.",
        )

    db.delete(record)
    db.commit()
    return {"status": "ok", "message": "History item deleted successfully"}
