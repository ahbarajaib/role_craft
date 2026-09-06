import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session
from loguru import logger

from app.core.database import get_db
from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError, ForbiddenError
from app.dependencies.auth import get_current_user
from app.models import User

# In-memory admin session storage
# Token -> {"user_id": int, "email": str, "expires_at": datetime}
ADMIN_SESSIONS: Dict[str, Dict[str, Any]] = {}

# Rate limiting for PIN attempts
# Key (email or IP) -> {"count": int, "locked_until": Optional[datetime]}
PIN_RATE_LIMITS: Dict[str, Dict[str, Any]] = {}

MAX_PIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
ADMIN_SESSION_TTL_MINUTES = 30


def check_pin_rate_limit(client_id: str) -> None:
    """Check if the client is locked out due to excessive failed PIN attempts."""
    record = PIN_RATE_LIMITS.get(client_id)
    if not record:
        return

    locked_until = record.get("locked_until")
    if locked_until and datetime.utcnow() < locked_until:
        remaining_secs = int((locked_until - datetime.utcnow()).total_seconds())
        remaining_mins = max(1, remaining_secs // 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed PIN attempts. Locked out for {remaining_mins} more minutes.",
        )

    # If lockout expired, reset
    if locked_until and datetime.utcnow() >= locked_until:
        PIN_RATE_LIMITS.pop(client_id, None)


def record_pin_failure(client_id: str) -> None:
    """Record a failed PIN attempt and apply lockout if threshold exceeded."""
    record = PIN_RATE_LIMITS.setdefault(client_id, {"count": 0, "locked_until": None})
    record["count"] += 1
    if record["count"] >= MAX_PIN_ATTEMPTS:
        record["locked_until"] = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
        logger.warning(f"🚨 Admin PIN lockout triggered for {client_id} until {record['locked_until']}")


def reset_pin_attempts(client_id: str) -> None:
    """Reset failed attempts on successful verification."""
    PIN_RATE_LIMITS.pop(client_id, None)


def create_admin_session(user: User) -> str:
    """Issue a new random admin session token with 30 min TTL."""
    # Clean up any expired sessions
    now = datetime.utcnow()
    expired_keys = [k for k, v in ADMIN_SESSIONS.items() if v["expires_at"] < now]
    for k in expired_keys:
        ADMIN_SESSIONS.pop(k, None)

    token = secrets.token_urlsafe(32)
    ADMIN_SESSIONS[token] = {
        "user_id": user.id,
        "email": user.email,
        "expires_at": now + timedelta(minutes=ADMIN_SESSION_TTL_MINUTES),
    }
    return token


def invalidate_admin_session(token: str) -> None:
    """Revoke an active admin session."""
    ADMIN_SESSIONS.pop(token, None)


def get_admin_user(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_token_query: Optional[str] = Query(None, alias="admin_token"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Enforce two-layer authorization:
    
    1. User must be authenticated and have user.is_admin == True.
    2. Request must provide a valid, unexpired session token in X-Admin-Token header or ?admin_token query.
    """
    # Layer 1: Is the user an admin in DB?
    if not getattr(current_user, "is_admin", False):
        logger.warning(f"Forbidden admin access attempt by non-admin: {current_user.email}")
        raise ForbiddenError("Access denied. Admin privileges required.")

    # Layer 2: Is the session token valid and not expired?
    effective_token = x_admin_token or admin_token_query
    if not effective_token:
        raise UnauthorizedError("Admin session token is missing. Please enter your Admin Secret PIN.")

    session_info = ADMIN_SESSIONS.get(effective_token)
    if not session_info:
        raise UnauthorizedError("Admin session is invalid or expired. Please re-authenticate.")

    now = datetime.utcnow()
    if session_info["expires_at"] < now:
        ADMIN_SESSIONS.pop(effective_token, None)
        raise UnauthorizedError("Admin session has expired. Please enter your Admin Secret PIN.")

    if session_info["email"] != current_user.email:
        raise UnauthorizedError("Admin session token mismatch.")

    # Refresh expiry on active use (up to 30 min)
    session_info["expires_at"] = now + timedelta(minutes=ADMIN_SESSION_TTL_MINUTES)

    return current_user
