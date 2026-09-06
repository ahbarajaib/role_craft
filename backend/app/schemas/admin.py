from datetime import datetime
from typing import Optional, Literal, Any, List, Dict
from pydantic import BaseModel, Field

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
    name: Optional[str] = None
    provider: str
    is_admin: bool
    credits: int
    plan_type: str
    subscription_status: str
    razorpay_subscription_id: Optional[str] = None
    phone_number: Optional[str] = None
    created_at: datetime
    analysis_count: int = 0
    tailored_count: int = 0

    class Config:
        from_attributes = True

class AdminUserListResponse(BaseModel):
    items: List[AdminUserItem]
    total: int
    page: int
    limit: int
    total_pages: int

class AdminUserDetail(AdminUserItem):
    address: Optional[str] = None
    linkedin_url: Optional[str] = None
    base_resume_filename: Optional[str] = None
    base_cover_letter_filename: Optional[str] = None
    missing_skills_tracker: Optional[Dict[str, int]] = None

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
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    issue_type: str
    subject: Optional[str] = None
    description: str
    context_data: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class AdminSupportListResponse(BaseModel):
    items: List[AdminSupportTicketItem]
    total: int
    page: int
    limit: int
    total_pages: int

class AdminSupportStatusUpdateRequest(BaseModel):
    status: Literal["open", "investigating", "resolved"]

# --- Config ---
class AdminConfigResponse(BaseModel):
    configs: Dict[str, Any]
    last_updated: Dict[str, Dict[str, Any]]

class AdminConfigUpdateRequest(BaseModel):
    key: str
    value: Any

# --- Subscriptions / Billing ---
class AdminSubscriptionItem(BaseModel):
    user_id: int
    email: str
    name: Optional[str] = None
    plan_type: str
    subscription_status: str
    razorpay_subscription_id: Optional[str] = None
    created_at: datetime

class AdminBillingResponse(BaseModel):
    estimated_mrr_inr: float
    pro_subscribers_count: int
    elite_subscribers_count: int
    active_subscriptions: List[AdminSubscriptionItem]

# --- Audit Logs ---
class AdminActivityLogItem(BaseModel):
    id: int
    admin_email: str
    action: str
    target_user_id: Optional[int] = None
    payload_json: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AdminActivityLogResponse(BaseModel):
    items: List[AdminActivityLogItem]
    total: int
    page: int
    limit: int
    total_pages: int
