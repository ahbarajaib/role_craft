"""Pydantic schemas for Analysis History and Daily Goal Tracking."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AnalysisHistoryItem(BaseModel):
    """Item representing one past resume analysis entry."""

    id: int
    document_id: str
    filename: str
    target_role: str | None = None
    target_company: str | None = None
    overall_score: int = 0
    sections_need_improvement: int = 0
    total_sections: int = 0
    download_id: str | None = None
    created_at: datetime


class DailyTargetSummary(BaseModel):
    """Daily target goal summary and progress."""

    today_completed: int = Field(..., description="Count of resumes analyzed today")
    daily_target: int = Field(..., description="Target goal set by the user")
    progress_percentage: int = Field(..., description="Calculated completion percentage (0-100)")
    goal_achieved: bool = Field(..., description="True if today_completed >= daily_target")


class HistorySummaryStats(BaseModel):
    """Aggregated stats for the user's history dashboard."""

    total_analyzed: int = 0
    average_score: int = 0
    latest_analysis_at: datetime | None = None
    daily_summary: DailyTargetSummary


class HistoryResponse(BaseModel):
    """Response containing history list and aggregate summary."""

    items: list[AnalysisHistoryItem]
    summary: HistorySummaryStats


class HistoryDetailResponse(BaseModel):
    """Detailed response for reloading a past session into the workspace."""

    item: AnalysisHistoryItem
    analysis_result: dict[str, Any]
    job_description_text: str


class UpdateDailyTargetRequest(BaseModel):
    """Payload to update the user's daily application target."""

    daily_target: int = Field(..., ge=1, le=100, description="New daily target goal (1 to 100)")
