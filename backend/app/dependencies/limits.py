from fastapi import Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.exceptions import InsufficientCreditsError, UnauthorizedError
from app.dependencies.auth import get_optional_current_user, get_current_user
from app.models import User
from app.core.config import get_settings

_settings = get_settings()

def verify_analysis_permission(
    optional_user: User | None = Depends(get_optional_current_user)
) -> User:
    """Verify that the user has remaining credits or an active Pro/Elite subscription.

    This is the SINGLE credit gate in the system. Only the /resume/analyze endpoint
    uses this dependency. All other AI features are credit-free (but still auth-protected).
    """
    if not optional_user:
        raise UnauthorizedError(f"Authentication is required to analyze resumes. Sign up to get {_settings.FREE_TIER_CREDITS} free credits!")

    if optional_user.plan_type == "elite" and optional_user.subscription_status == "active":
        # Elite plan has unlimited usage
        return optional_user

    # Check credits for Free and Pro users
    if optional_user.credits <= 0:
        raise InsufficientCreditsError("You have depleted your available credits. Please upgrade your plan to continue.")

    return optional_user


def verify_user_credits(user: User, required_credits: int = 1) -> None:
    """Ensure candidate has enough credits for the requested AI operation.

    NOTE: Only called from the /analyze endpoint. No other endpoint charges credits.
    """
    if user.plan_type == "elite" and user.subscription_status == "active":
        return
    if user.credits < required_credits:
        raise InsufficientCreditsError(
            f"You need at least {required_credits} CR to perform this operation (Current balance: {user.credits} CR). Please upgrade your plan to continue."
        )


def deduct_user_credits(db: Session, user: User, amount: int = 1) -> int:
    """Deduct specified credits and save to database.

    NOTE: Only called from the /analyze endpoint. No other endpoint deducts credits.
    """
    if user.plan_type == "elite" and user.subscription_status == "active":
        return user.credits
    user.credits = max(0, user.credits - amount)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.credits


def deduct_analysis_credit(db: Session, user: User) -> None:
    """Deduct 1 credit for a resume analysis. This is the only place credits are consumed."""
    deduct_user_credits(db, user, 1)


def verify_premium_permission(
    user: User = Depends(get_current_user)
) -> User:
    """Require authentication only. No credit check.

    Previously also checked credits, but all non-analyze features are now credit-free.
    Kept for backwards compat on endpoint signatures; now effectively an auth-only guard.
    """
    return user


def verify_auth_only(
    user: User = Depends(get_current_user)
) -> User:
    """Require authentication only. No credit check.

    Use this for AI features that are free (rewrite, cover letter, tailor, batch-rewrite).
    Backend token limits are still enforced by the AI service layer.
    """
    return user
