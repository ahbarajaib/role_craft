import json
import math
from datetime import datetime, timedelta
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc
from loguru import logger

from app.core.database import get_db
from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError, NotFoundError, BadRequestError, ForbiddenError
from app.dependencies.auth import get_current_user
from app.dependencies.admin import (
    get_admin_user,
    check_pin_rate_limit,
    record_pin_failure,
    reset_pin_attempts,
    create_admin_session,
    ADMIN_SESSION_TTL_MINUTES,
)
from app.models import (
    User,
    AnalysisHistory,
    TailoredResumeModel,
    IssueReport,
    AdminActivityLog,
    SiteConfig,
)
from app.schemas.admin import (
    AdminPinVerifyRequest,
    AdminPinVerifyResponse,
    AdminOverviewStats,
    AdminSignupStat,
    AdminUsageStat,
    AdminUserItem,
    AdminUserListResponse,
    AdminUserDetail,
    AdminUserCreditsUpdateRequest,
    AdminUserPlanUpdateRequest,
    AdminUserAdminToggleRequest,
    AdminSupportTicketItem,
    AdminSupportListResponse,
    AdminSupportStatusUpdateRequest,
    AdminConfigResponse,
    AdminConfigUpdateRequest,
    AdminBillingResponse,
    AdminSubscriptionItem,
    AdminActivityLogItem,
    AdminActivityLogResponse,
)

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])
settings = get_settings()


def log_admin_action(
    db: Session,
    admin_email: str,
    action: str,
    target_user_id: Optional[int] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    """Helper to record immutable admin activity."""
    log_entry = AdminActivityLog(
        admin_email=admin_email,
        action=action,
        target_user_id=target_user_id,
        payload_json=json.dumps(payload) if payload else None,
        created_at=datetime.utcnow(),
    )
    db.add(log_entry)
    db.commit()


# ==========================================
# 1. Two-Layer Auth: PIN Verification
# ==========================================
@router.post("/auth/verify-pin", response_model=AdminPinVerifyResponse)
def verify_admin_pin(
    payload: AdminPinVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminPinVerifyResponse:
    """Verify Layer 2 Admin Secret PIN and issue a short-lived admin session token."""
    # Ensure user is flagged as admin
    if not getattr(current_user, "is_admin", False):
        logger.warning(f"Unauthorized PIN attempt by non-admin user: {current_user.email}")
        raise ForbiddenError("Access denied. Admin privileges required.")

    # Check rate limit
    check_pin_rate_limit(current_user.email)

    configured_secret = settings.ADMIN_SECRET.strip()
    if not configured_secret:
        logger.error("ADMIN_SECRET is not configured on server!")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ADMIN_SECRET is not configured on server. Please set ADMIN_SECRET in .env.",
        )

    if payload.pin.strip() != configured_secret:
        record_pin_failure(current_user.email)
        logger.warning(f"Failed Admin PIN attempt for {current_user.email}")
        raise UnauthorizedError("Invalid Admin Secret PIN.")

    # Successful verification
    reset_pin_attempts(current_user.email)
    admin_token = create_admin_session(current_user)

    log_admin_action(
        db=db,
        admin_email=current_user.email,
        action="admin_login",
        target_user_id=current_user.id,
        payload={"message": "Admin session created via PIN verification"},
    )

    return AdminPinVerifyResponse(
        admin_session_token=admin_token,
        expires_in_minutes=ADMIN_SESSION_TTL_MINUTES,
        email=current_user.email,
    )


# ==========================================
# 2. Stats & Analytics Overview
# ==========================================
@router.get("/stats/overview", response_model=AdminOverviewStats)
def get_overview_stats(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminOverviewStats:
    """Get high-level summary metrics for the admin overview cards."""
    total_users = db.query(func.count(User.id)).scalar() or 0
    pro_users = db.query(func.count(User.id)).filter(User.plan_type == "pro").scalar() or 0
    elite_users = db.query(func.count(User.id)).filter(User.plan_type == "elite").scalar() or 0
    free_users = db.query(func.count(User.id)).filter(User.plan_type == "free").scalar() or 0
    admin_users = db.query(func.count(User.id)).filter(User.is_admin == True).scalar() or 0

    # Pricing: Pro = ₹399/mo, Elite = ₹599/mo
    estimated_mrr = (pro_users * 399.0) + (elite_users * 599.0)

    total_analyses = db.query(func.count(AnalysisHistory.id)).scalar() or 0
    total_tailored = db.query(func.count(TailoredResumeModel.id)).scalar() or 0
    open_tickets = db.query(func.count(IssueReport.id)).filter(IssueReport.status != "resolved").scalar() or 0

    return AdminOverviewStats(
        total_users=total_users,
        pro_users=pro_users,
        elite_users=elite_users,
        free_users=free_users,
        admin_users=admin_users,
        estimated_mrr_inr=estimated_mrr,
        total_analyses=total_analyses,
        total_tailored_resumes=total_tailored,
        open_tickets_count=open_tickets,
    )


@router.get("/stats/signups", response_model=List[AdminSignupStat])
def get_signup_stats(
    days: int = Query(30, ge=7, le=90),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> List[AdminSignupStat]:
    """Get daily new user signups for the last N days."""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Query grouped by date(created_at)
    date_func = func.date(User.created_at)
    results = (
        db.query(date_func.label("signup_date"), func.count(User.id).label("count"))
        .filter(User.created_at >= cutoff_date)
        .group_by(date_func)
        .order_by(asc(date_func))
        .all()
    )

    counts_by_date = {row.signup_date: row.count for row in results}

    # Fill missing dates with 0
    stat_list: List[AdminSignupStat] = []
    for i in range(days):
        current_day = (cutoff_date + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        stat_list.append(
            AdminSignupStat(
                date=current_day,
                count=counts_by_date.get(current_day, 0),
            )
        )

    return stat_list


@router.get("/stats/usage", response_model=List[AdminUsageStat])
def get_usage_stats(
    days: int = Query(30, ge=7, le=90),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> List[AdminUsageStat]:
    """Get daily resume analyses and tailoring usage for the last N days."""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    date_func_ah = func.date(AnalysisHistory.created_at)
    analyses_results = (
        db.query(date_func_ah.label("usage_date"), func.count(AnalysisHistory.id).label("count"))
        .filter(AnalysisHistory.created_at >= cutoff_date)
        .group_by(date_func_ah)
        .all()
    )
    analyses_map = {row.usage_date: row.count for row in analyses_results}

    date_func_tr = func.date(TailoredResumeModel.created_at)
    tailored_results = (
        db.query(date_func_tr.label("usage_date"), func.count(TailoredResumeModel.id).label("count"))
        .filter(TailoredResumeModel.created_at >= cutoff_date)
        .group_by(date_func_tr)
        .all()
    )
    tailored_map = {row.usage_date: row.count for row in tailored_results}

    stat_list: List[AdminUsageStat] = []
    for i in range(days):
        current_day = (cutoff_date + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        stat_list.append(
            AdminUsageStat(
                date=current_day,
                analyses=analyses_map.get(current_day, 0),
                tailored=tailored_map.get(current_day, 0),
            )
        )

    return stat_list


# ==========================================
# 3. User Management
# ==========================================
@router.get("/users", response_model=AdminUserListResponse)
def get_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    plan_type: Optional[str] = Query(None),
    is_admin: Optional[bool] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserListResponse:
    """List and search users with pagination and filtering."""
    query = db.query(User)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(User.email.ilike(s), User.name.ilike(s)))

    if plan_type and plan_type != "all":
        query = query.filter(User.plan_type == plan_type)

    if is_admin is not None:
        query = query.filter(User.is_admin == is_admin)

    total = query.count()
    total_pages = math.ceil(total / limit) if total > 0 else 1

    # Sorting
    sort_column = getattr(User, sort_by, User.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    users = query.offset((page - 1) * limit).limit(limit).all()

    # Pre-fetch counts for current page user ids
    user_ids = [u.id for u in users]
    analyses_counts: Dict[int, int] = {}
    tailored_counts: Dict[int, int] = {}

    if user_ids:
        ah_rows = (
            db.query(AnalysisHistory.user_id, func.count(AnalysisHistory.id))
            .filter(AnalysisHistory.user_id.in_(user_ids))
            .group_by(AnalysisHistory.user_id)
            .all()
        )
        analyses_counts = {r[0]: r[1] for r in ah_rows}

        tr_rows = (
            db.query(TailoredResumeModel.user_id, func.count(TailoredResumeModel.id))
            .filter(TailoredResumeModel.user_id.in_(user_ids))
            .group_by(TailoredResumeModel.user_id)
            .all()
        )
        tailored_counts = {r[0]: r[1] for r in tr_rows}

    items = [
        AdminUserItem(
            id=u.id,
            email=u.email,
            name=u.name,
            provider=u.provider,
            is_admin=getattr(u, "is_admin", False),
            credits=u.credits,
            plan_type=u.plan_type,
            subscription_status=u.subscription_status,
            razorpay_subscription_id=u.razorpay_subscription_id,
            phone_number=u.phone_number,
            created_at=u.created_at,
            analysis_count=analyses_counts.get(u.id, 0),
            tailored_count=tailored_counts.get(u.id, 0),
        )
        for u in users
    ]

    return AdminUserListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def get_user_detail(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserDetail:
    """Get full profile details for a specific user."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise NotFoundError(f"User with ID {user_id} not found.")

    analysis_count = db.query(func.count(AnalysisHistory.id)).filter(AnalysisHistory.user_id == user_id).scalar() or 0
    tailored_count = db.query(func.count(TailoredResumeModel.id)).filter(TailoredResumeModel.user_id == user_id).scalar() or 0

    missing_skills = None
    if u.missing_skills_tracker:
        try:
            missing_skills = json.loads(u.missing_skills_tracker)
        except Exception:
            missing_skills = None

    return AdminUserDetail(
        id=u.id,
        email=u.email,
        name=u.name,
        provider=u.provider,
        is_admin=getattr(u, "is_admin", False),
        credits=u.credits,
        plan_type=u.plan_type,
        subscription_status=u.subscription_status,
        razorpay_subscription_id=u.razorpay_subscription_id,
        phone_number=u.phone_number,
        created_at=u.created_at,
        analysis_count=analysis_count,
        tailored_count=tailored_count,
        address=u.address,
        linkedin_url=u.linkedin_url,
        base_resume_filename=u.base_resume_filename,
        base_cover_letter_filename=getattr(u, "base_cover_letter_filename", None),
        missing_skills_tracker=missing_skills,
    )


@router.patch("/users/{user_id}/credits")
@router.post("/users/{user_id}/credits")
def update_user_credits(
    user_id: int,
    payload: AdminUserCreditsUpdateRequest,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Set or add credits to a user's account."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise NotFoundError(f"User with ID {user_id} not found.")

    old_credits = u.credits
    if payload.mode == "add":
        new_credits = max(0, u.credits + payload.amount)
    else:
        new_credits = max(0, payload.amount)

    u.credits = new_credits
    db.commit()
    db.refresh(u)

    log_admin_action(
        db=db,
        admin_email=admin_user.email,
        action="credit_update",
        target_user_id=u.id,
        payload={
            "user_email": u.email,
            "mode": payload.mode,
            "amount": payload.amount,
            "before": old_credits,
            "after": new_credits,
        },
    )

    return {
        "success": True,
        "user_id": u.id,
        "old_credits": old_credits,
        "new_credits": new_credits,
    }


@router.patch("/users/{user_id}/plan")
@router.post("/users/{user_id}/plan")
def update_user_plan(
    user_id: int,
    payload: AdminUserPlanUpdateRequest,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update a user's subscription plan type and status."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise NotFoundError(f"User with ID {user_id} not found.")

    old_plan = u.plan_type
    old_status = u.subscription_status

    u.plan_type = payload.plan_type
    u.subscription_status = payload.subscription_status
    db.commit()
    db.refresh(u)

    log_admin_action(
        db=db,
        admin_email=admin_user.email,
        action="plan_change",
        target_user_id=u.id,
        payload={
            "user_email": u.email,
            "plan_type": {"before": old_plan, "after": u.plan_type},
            "subscription_status": {"before": old_status, "after": u.subscription_status},
        },
    )

    return {
        "success": True,
        "user_id": u.id,
        "plan_type": u.plan_type,
        "subscription_status": u.subscription_status,
    }


@router.patch("/users/{user_id}/admin")
@router.post("/users/{user_id}/admin")
def toggle_user_admin(
    user_id: int,
    payload: AdminUserAdminToggleRequest,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Promote or demote a user to/from admin privileges."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise NotFoundError(f"User with ID {user_id} not found.")

    # Prevent self-demotion to avoid accidental lockout
    if u.id == admin_user.id and not payload.is_admin:
        raise BadRequestError("You cannot demote yourself from Admin status.")

    old_val = getattr(u, "is_admin", False)
    u.is_admin = payload.is_admin
    db.commit()
    db.refresh(u)

    log_admin_action(
        db=db,
        admin_email=admin_user.email,
        action="admin_toggle",
        target_user_id=u.id,
        payload={
            "user_email": u.email,
            "is_admin": {"before": old_val, "after": u.is_admin},
        },
    )

    return {
        "success": True,
        "user_id": u.id,
        "is_admin": u.is_admin,
    }


# ==========================================
# 4. Support Tickets
# ==========================================
@router.get("/support", response_model=AdminSupportListResponse)
def get_support_tickets(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    issue_type: Optional[str] = Query(None),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminSupportListResponse:
    """List user-submitted bug reports and feedback tickets."""
    query = db.query(IssueReport)

    if status_filter and status_filter != "all":
        query = query.filter(IssueReport.status == status_filter)

    if issue_type and issue_type != "all":
        query = query.filter(IssueReport.issue_type == issue_type)

    total = query.count()
    total_pages = math.ceil(total / limit) if total > 0 else 1

    tickets = (
        query.order_by(desc(IssueReport.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items = [
        AdminSupportTicketItem(
            id=t.id,
            user_id=t.user_id,
            user_email=t.user_email,
            issue_type=t.issue_type,
            subject=t.subject,
            description=t.description,
            context_data=t.context_data,
            status=t.status,
            created_at=t.created_at,
        )
        for t in tickets
    ]

    return AdminSupportListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.patch("/support/{report_id}/status")
@router.post("/support/{report_id}/status")
def update_support_status(
    report_id: int,
    payload: AdminSupportStatusUpdateRequest,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update status of an IssueReport (open, investigating, resolved)."""
    ticket = db.query(IssueReport).filter(IssueReport.id == report_id).first()
    if not ticket:
        raise NotFoundError(f"Issue report #{report_id} not found.")

    old_status = ticket.status
    ticket.status = payload.status
    db.commit()
    db.refresh(ticket)

    log_admin_action(
        db=db,
        admin_email=admin_user.email,
        action="support_status",
        payload={
            "report_id": ticket.id,
            "status": {"before": old_status, "after": ticket.status},
        },
    )

    return {
        "success": True,
        "report_id": ticket.id,
        "status": ticket.status,
    }


# ==========================================
# 5. Global Live Configuration
# ==========================================
@router.get("/config", response_model=AdminConfigResponse)
def get_site_config(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminConfigResponse:
    """Read dynamic system configurations."""
    rows = db.query(SiteConfig).all()
    db_configs = {r.key: r for r in rows}

    default_map = {
        "FREE_TIER_CREDITS": settings.FREE_TIER_CREDITS,
        "PRO_CREDITS": settings.PRO_CREDITS,
        "ELITE_CREDITS": settings.ELITE_CREDITS,
        "VIP_EMAILS": settings.VIP_EMAILS,
    }

    result_configs: Dict[str, Any] = {}
    last_updated: Dict[str, Dict[str, Any]] = {}

    for key, default_val in default_map.items():
        if key in db_configs:
            cfg_obj = db_configs[key]
            try:
                result_configs[key] = json.loads(cfg_obj.value)
            except Exception:
                result_configs[key] = cfg_obj.value
            last_updated[key] = {
                "updated_at": cfg_obj.updated_at.isoformat() if cfg_obj.updated_at else None,
                "updated_by": cfg_obj.updated_by,
            }
        else:
            result_configs[key] = default_val
            last_updated[key] = {
                "updated_at": None,
                "updated_by": "env_default",
            }

    return AdminConfigResponse(
        configs=result_configs,
        last_updated=last_updated,
    )


@router.patch("/config")
@router.post("/config")
def update_site_config(
    payload: AdminConfigUpdateRequest,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update a specific configuration value (e.g. FREE_TIER_CREDITS, VIP_EMAILS)."""
    cfg = db.query(SiteConfig).filter(SiteConfig.key == payload.key).first()
    json_val = json.dumps(payload.value)

    old_val = cfg.value if cfg else None
    now = datetime.utcnow()

    if cfg:
        cfg.value = json_val
        cfg.updated_at = now
        cfg.updated_by = admin_user.email
    else:
        cfg = SiteConfig(
            key=payload.key,
            value=json_val,
            updated_at=now,
            updated_by=admin_user.email,
        )
        db.add(cfg)

    db.commit()

    log_admin_action(
        db=db,
        admin_email=admin_user.email,
        action="config_change",
        payload={
            "key": payload.key,
            "before": old_val,
            "after": json_val,
        },
    )

    return {
        "success": True,
        "key": payload.key,
        "value": payload.value,
        "updated_at": now.isoformat(),
        "updated_by": admin_user.email,
    }


# ==========================================
# 6. Billing & Subscriptions
# ==========================================
@router.get("/billing/subscriptions", response_model=AdminBillingResponse)
def get_billing_dashboard(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminBillingResponse:
    """View MRR and active Razorpay subscriptions."""
    pro_count = db.query(func.count(User.id)).filter(User.plan_type == "pro").scalar() or 0
    elite_count = db.query(func.count(User.id)).filter(User.plan_type == "elite").scalar() or 0
    mrr = (pro_count * 399.0) + (elite_count * 599.0)

    sub_users = (
        db.query(User)
        .filter(or_(User.razorpay_subscription_id.isnot(None), User.plan_type.in_(["pro", "elite"])))
        .order_by(desc(User.created_at))
        .all()
    )

    subs = [
        AdminSubscriptionItem(
            user_id=u.id,
            email=u.email,
            name=u.name,
            plan_type=u.plan_type,
            subscription_status=u.subscription_status,
            razorpay_subscription_id=u.razorpay_subscription_id,
            created_at=u.created_at,
        )
        for u in sub_users
    ]

    return AdminBillingResponse(
        estimated_mrr_inr=mrr,
        pro_subscribers_count=pro_count,
        elite_subscribers_count=elite_count,
        active_subscriptions=subs,
    )


# ==========================================
# 7. Audit Activity Log
# ==========================================
@router.get("/activity-log", response_model=AdminActivityLogResponse)
def get_activity_log(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    action: Optional[str] = Query(None),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminActivityLogResponse:
    """View paginated admin audit trail logs."""
    query = db.query(AdminActivityLog)

    if action and action != "all":
        query = query.filter(AdminActivityLog.action == action)

    total = query.count()
    total_pages = math.ceil(total / limit) if total > 0 else 1

    logs = (
        query.order_by(desc(AdminActivityLog.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items = [
        AdminActivityLogItem(
            id=l.id,
            admin_email=l.admin_email,
            action=l.action,
            target_user_id=l.target_user_id,
            payload_json=l.payload_json,
            created_at=l.created_at,
        )
        for l in logs
    ]

    return AdminActivityLogResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )
