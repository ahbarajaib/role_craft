from fastapi import Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.exceptions import InsufficientCreditsError, UnauthorizedError
from app.dependencies.auth import get_optional_current_user, get_current_user
from app.models import User

def verify_analysis_permission(
    db: Session = Depends(get_db),
    optional_user: User | None = Depends(get_optional_current_user)
) -> None:
    """Verify that the user has remaining credits or an active Pro/Elite subscription."""
    if not optional_user:
        raise UnauthorizedError("Authentication is required to analyze resumes. Sign up to get 3 free credits!")

    if optional_user.plan_type == "elite" and optional_user.subscription_status == "active":
        # Elite plan has unlimited usage
        return

    # Check credits for Free and Pro users
    if optional_user.credits <= 0:
        raise InsufficientCreditsError("You have depleted your available credits. Please upgrade your plan to continue.")

    # Decrement credits
    optional_user.credits -= 1
    db.commit()

def verify_premium_permission(
    user: User = Depends(get_current_user)
) -> User:
    """Ensure the user has an active premium subscription to access AI rewrites or patching."""
    if user.plan_type not in ["pro", "elite"] or user.subscription_status != "active":
        raise InsufficientCreditsError("AI rewrites and document downloads are premium features. Please upgrade your plan.")
    return user
