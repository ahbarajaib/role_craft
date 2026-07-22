from fastapi import APIRouter, Depends, Request, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import get_settings
from app.models import User
from app.dependencies.auth import get_current_user
from app.core.exceptions import BadRequestError, UnauthorizedError
from pydantic import BaseModel
import razorpay
import json

settings = get_settings()
router = APIRouter(prefix="/payment", tags=["Billing & Payments"])

class SubscriptionRequest(BaseModel):
    plan_type: str # "pro" or "elite"

@router.post("/subscribe")
def create_subscription(
    req: SubscriptionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Initiate a monthly Razorpay Subscription session for Pro/Elite upgrades."""
    plan_clean = req.plan_type.lower()
    if plan_clean not in ["pro", "elite"]:
        raise BadRequestError("Invalid plan type. Must be 'pro' or 'elite'.")

    # If Razorpay keys are not configured, fallback to Sandbox simulation mode
    if not settings.RAZORPAY_KEY_ID:
        simulated_sub_id = f"sub_mock_{plan_clean}_{user.id}"
        user.razorpay_subscription_id = simulated_sub_id
        db.commit()
        return {
            "subscription_id": simulated_sub_id,
            "key": "rzp_test_sandbox_mock",
            "amount": 39900 if plan_clean == "pro" else 59900,
            "name": f"Role Craft {plan_clean.capitalize()} (Simulated Sandbox)",
            "description": "Sandbox testing checkout session",
            "is_sandbox": True
        }

    # Live integration
    try:
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        plan_id = settings.RAZORPAY_PLAN_PRO_ID if plan_clean == "pro" else settings.RAZORPAY_PLAN_ELITE_ID
        
        # Build subscription payload
        subscription_payload = {
            "plan_id": plan_id,
            "total_count": 12, # recurring monthly for 1 year
            "quantity": 1,
            "customer_notify": 1
        }
        
        subscription = client.subscription.create(data=subscription_payload)
        user.razorpay_subscription_id = subscription["id"]
        db.commit()

        return {
            "subscription_id": subscription["id"],
            "key": settings.RAZORPAY_KEY_ID,
            "amount": 39900 if plan_clean == "pro" else 59900,
            "name": "Role Craft Pro" if plan_clean == "pro" else "Role Craft Elite",
            "description": "Monthly subscription membership",
            "is_sandbox": False
        }
    except Exception as e:
        raise BadRequestError(f"Razorpay API Error: {str(e)}")

@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Receive recurring billing and membership lifecycle event hooks from Razorpay."""
    raw_body = await request.body()
    body_str = raw_body.decode("utf-8")
    
    # Extract signature
    signature = request.headers.get("X-Razorpay-Signature")
    
    # Verify Webhook signature if keys are populated
    if settings.RAZORPAY_WEBHOOK_SECRET and settings.RAZORPAY_KEY_ID:
        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            client.utility.verify_webhook_signature(body_str, signature, settings.RAZORPAY_WEBHOOK_SECRET)
        except Exception:
            raise UnauthorizedError("Invalid signature payload.")

    try:
        payload = json.loads(body_str)
        event = payload.get("event")
        entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
        sub_id = entity.get("id")
        plan_id = entity.get("plan_id")
    except Exception:
        raise BadRequestError("Invalid webhook request format.")

    if not sub_id:
        return {"status": "ignored"}

    user = db.query(User).filter(User.razorpay_subscription_id == sub_id).first()
    if not user:
        return {"status": "user_not_found"}

    # Process events
    if event in ["subscription.charged", "subscription.activated"]:
        # Deduce tier based on plan configuration IDs
        if plan_id == settings.RAZORPAY_PLAN_ELITE_ID:
            user.plan_type = "elite"
            user.credits = 400
        else:
            user.plan_type = "pro"
            user.credits = 200

        user.subscription_status = "active"
        db.commit()
    elif event in ["subscription.cancelled", "subscription.halted"]:
        user.plan_type = "free"
        user.subscription_status = "inactive"
        user.credits = 15
        db.commit()

    return {"status": "processed"}

class SimulatePaymentRequest(BaseModel):
    plan_type: str # "pro" or "elite"

@router.post("/simulate-success")
def simulate_payment_success(
    req: SimulatePaymentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Upgrade user plan status immediately (Dev/Sandbox testing only)."""
    if settings.ENVIRONMENT == "production":
        raise BadRequestError("Simulation endpoints are disabled in production.")

    plan_clean = req.plan_type.lower()
    if plan_clean not in ["pro", "elite"]:
        raise BadRequestError("Plan type must be 'pro' or 'elite'.")

    user.plan_type = plan_clean
    user.subscription_status = "active"
    user.credits = 200 if plan_clean == "pro" else 400
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "plan_type": user.plan_type,
        "credits": user.credits,
        "subscription_status": user.subscription_status
    }
