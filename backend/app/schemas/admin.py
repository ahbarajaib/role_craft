from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# --- Auth ---
class AdminPinVerifyRequest(BaseModel):
    pin: str = Field(..., min_length=1)

class AdminPinVerifyResponse(BaseModel):
    admin_session_token: str
    expires_in_minutes: int
    email: str

# --- Stats ---
class AdminOverviewStats(BaseModel):
    total_users: int
    pro_users: int
    elite_users: int
    free_users: int
    admin_users: int
    estimated_mrr_inr: float
    total_analyses: int
    total_tailored_resumes: int
    open_tickets_count: int

class AdminSignupStat(BaseModel):
    date: str  # YYYY-MM-DD
    count: int

class AdminUsageStat(BaseModel):
    date: str  # YYYY-MM-DD
    analyses: int
    tailored: int

# --- Users ---
class AdminUserItem(BaseModel):
    id: int
    email: str
    name: str | None = None
    provider: str
    is_admin: bool
    credits: int
    plan_type: str
    subscription_status: str
    razorpay_subscription_id: str | None = None
    phone_number: str | None = None
    created_at: datetime
    analysis_count: int = 0
    tailored_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class AdminUserListResponse(BaseModel):
    items: list[AdminUserItem]
    total: int
    page: int
    limit: int
    total_pages: int

class AdminUserDetail(AdminUserItem):
    address: str | None = None
    linkedin_url: str | None = None
    base_resume_filename: str | None = None
    base_cover_letter_filename: str | None = None
    missing_skills_tracker: dict[str, int] | None = None

class AdminUserCreditsUpdateRequest(BaseModel):
    amount: int
    mode: Literal["set", "add"] = "set"

class AdminUserPlanUpdateRequest(BaseModel):
    plan_type: str  # "free" | "pro" | "elite"
    subscription_status: str  # "active" | "inactive"

class AdminUserAdminToggleRequest(BaseModel):
    is_admin: bool

# --- Support ---
class AdminSupportTicketItem(BaseModel):
    id: int
    user_id: int | None = None
    user_email: str | None = None
    issue_type: str
    subject: str | None = None
    description: str
    context_data: str | None = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AdminSupportListResponse(BaseModel):
    items: list[AdminSupportTicketItem]
    total: int
    page: int
    limit: int
    total_pages: int

class AdminSupportStatusUpdateRequest(BaseModel):
    status: Literal["open", "investigating", "resolved"]

# --- Config ---
class AdminConfigResponse(BaseModel):
    configs: dict[str, Any]
    last_updated: dict[str, dict[str, Any]]

class AdminConfigUpdateRequest(BaseModel):
    key: str
    value: Any

# --- Subscriptions / Billing ---
class AdminSubscriptionItem(BaseModel):
    user_id: int
    email: str
    name: str | None = None
    plan_type: str
    subscription_status: str
    razorpay_subscription_id: str | None = None
    created_at: datetime

class AdminBillingResponse(BaseModel):
    estimated_mrr_inr: float
    pro_subscribers_count: int
    elite_subscribers_count: int
    active_subscriptions: list[AdminSubscriptionItem]

# --- Audit Logs ---
class AdminActivityLogItem(BaseModel):
    id: int
    admin_email: str
    action: str
    target_user_id: int | None = None
    payload_json: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AdminActivityLogResponse(BaseModel):
    items: list[AdminActivityLogItem]
    total: int
    page: int
    limit: int
    total_pages: int
