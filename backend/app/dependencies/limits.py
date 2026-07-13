from datetime import datetime, timedelta, timezone
from fastapi import Depends, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.exceptions import InsufficientCreditsError, RateLimitError
from app.dependencies.auth import get_optional_current_user
from app.models import User, IPLimit

def resolve_ip_address(request: Request) -> str:
    """Resolve the original client IP address from request headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Get first proxy IP in list
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

def verify_analysis_permission(
    request: Request,
    db: Session = Depends(get_db),
    optional_user: User | None = Depends(get_optional_current_user)
) -> None:
    """Verify that a guest has remaining daily slots or an authenticated user has credits."""
    if optional_user:
        # Authenticated mode: check credits balance
        if optional_user.credits <= 0:
            raise InsufficientCreditsError("You have depleted your available credits. Please upgrade your plan.")
        
        # Decrement credit pool by 1
        optional_user.credits -= 1
        db.commit()
        return

    # Anonymous guest mode: check daily limit by IP
    ip = resolve_ip_address(request)
    limit_record = db.query(IPLimit).filter(IPLimit.ip_address == ip).first()
    now_utc = datetime.utcnow()

    if limit_record:
        # Check if last request was within the last 24 hours
        time_elapsed = now_utc - limit_record.last_request_at
        if time_elapsed < timedelta(days=1):
            if limit_record.request_count >= 1:
                raise RateLimitError("Daily free analysis limit reached. Please sign up or log in to continue.")
            limit_record.request_count += 1
            db.commit()
        else:
            # Over 24 hours: reset limit counter
            limit_record.request_count = 1
            limit_record.last_request_at = now_utc
            db.commit()
    else:
        # First time anonymous request
        new_record = IPLimit(ip_address=ip, request_count=1, last_request_at=now_utc)
        db.add(new_record)
        db.commit()
