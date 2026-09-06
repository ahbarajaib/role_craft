from datetime import datetime, timedelta
import time
from typing import Optional
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
    billing_type: Optional[str] = "one_time" # "one_time" (30-day pass) or "recurring" (monthly subscription)

@router.post("/subscribe")
def create_subscription(
    req: SubscriptionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Initiate a Razorpay payment session for Pro/Elite upgrades (supports one-off 30-day pass or recurring)."""
    plan_clean = req.plan_type.lower().strip()
    if plan_clean not in ["pro", "elite"]:
        raise BadRequestError("Invalid plan type. Must be 'pro' or 'elite'.")

    billing_type = (req.billing_type or "one_time").lower().strip()
    amount = 39900 if plan_clean == "pro" else 59900

    # Handle One-Time 30-day pass (Standard Razorpay Order - zero recurring auto-debit)
    if billing_type == "one_time":
        if not settings.RAZORPAY_KEY_ID:
            simulated_ord_id = f"order_mock_{plan_clean}_{user.id}"
            return {
                "order_id": simulated_ord_id,
                "key": "rzp_test_sandbox_mock",
                "amount": amount,
                "name": f"Role Craft {plan_clean.capitalize()} (30-Day Pass)",
                "description": "One-time pass for 30 days (Sandbox mode)",
                "billing_type": "one_time",
                "is_sandbox": True
            }

        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            order = client.order.create({
                "amount": amount,
                "currency": "INR",
                "receipt": f"rc_{user.id}_{int(time.time())}",
                "notes": {
                    "user_id": str(user.id),
                    "plan_type": plan_clean,
                    "billing_type": "one_time"
                }
            })
            return {
                "order_id": order["id"],
                "key": settings.RAZORPAY_KEY_ID,
                "amount": amount,
                "name": f"Role Craft {plan_clean.capitalize()} (30-Day Pass)",
                "description": "One-time 30-day access (no recurring commitment)",
                "billing_type": "one_time",
                "is_sandbox": False
            }
        except Exception as e:
            raise BadRequestError(f"Razorpay Order Error: {str(e)}")

    # Handle Recurring Monthly Subscription (Auto-debit mandate)
    if not settings.RAZORPAY_KEY_ID:
        simulated_sub_id = f"sub_mock_{plan_clean}_{user.id}"
        user.razorpay_subscription_id = simulated_sub_id
        db.commit()
        return {
            "subscription_id": simulated_sub_id,
            "key": "rzp_test_sandbox_mock",
            "amount": amount,
            "name": f"Role Craft {plan_clean.capitalize()} (Monthly Recurring)",
            "description": "Sandbox recurring monthly session",
            "billing_type": "recurring",
            "is_sandbox": True
        }

    try:
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        plan_id = settings.RAZORPAY_PLAN_PRO_ID if plan_clean == "pro" else settings.RAZORPAY_PLAN_ELITE_ID
        
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
            "amount": amount,
            "name": f"Role Craft {plan_clean.capitalize()} (Monthly Recurring)",
            "description": "Monthly recurring auto-renewing subscription",
            "billing_type": "recurring",
            "is_sandbox": False
        }
    except Exception as e:
        raise BadRequestError(f"Razorpay Subscription API Error: {str(e)}")

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
            user.credits = settings.ELITE_CREDITS
        else:
            user.plan_type = "pro"
            user.credits = settings.PRO_CREDITS

        user.subscription_status = "active"
        db.commit()
    elif event in ["subscription.cancelled", "subscription.halted"]:
        user.plan_type = "free"
        user.subscription_status = "inactive"
        user.credits = settings.FREE_TIER_CREDITS
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
    user.credits = settings.PRO_CREDITS if plan_clean == "pro" else settings.ELITE_CREDITS
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "plan_type": user.plan_type,
        "credits": user.credits,
        "subscription_status": user.subscription_status
    }


class VerifySubscriptionRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_signature: str
    plan_type: str = "pro"
    billing_type: Optional[str] = "one_time"


@router.post("/verify")
def verify_subscription(
    req: VerifySubscriptionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Instantly verify checkout payment/subscription signature and activate membership."""
    plan_clean = (req.plan_type or "pro").lower().strip()
    if plan_clean not in ["pro", "elite"]:
        plan_clean = "pro"

    # 1. Handle One-Off (Standard Order) Verification
    if req.razorpay_order_id:
        if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
            try:
                client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
                client.utility.verify_payment_signature({
                    "razorpay_order_id": req.razorpay_order_id,
                    "razorpay_payment_id": req.razorpay_payment_id,
                    "razorpay_signature": req.razorpay_signature,
                })
            except Exception as e:
                raise BadRequestError(f"Payment signature verification failed: {str(e)}")

        user.plan_type = plan_clean
        user.subscription_status = "active"
        user.plan_expires_at = datetime.utcnow() + timedelta(days=30)
        user.razorpay_subscription_id = None  # One-off pass has no recurring auto-debit

    # 2. Handle Recurring Subscription Verification
    elif req.razorpay_subscription_id:
        if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
            try:
                client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
                client.utility.verify_subscription_payment_signature({
                    "razorpay_payment_id": req.razorpay_payment_id,
                    "razorpay_subscription_id": req.razorpay_subscription_id,
                    "razorpay_signature": req.razorpay_signature,
                })
            except Exception as e:
                raise BadRequestError(f"Subscription signature verification failed: {str(e)}")

        user.plan_type = plan_clean
        user.subscription_status = "active"
        user.razorpay_subscription_id = req.razorpay_subscription_id
        user.plan_expires_at = None

    else:
        # Fallback simulation
        user.plan_type = plan_clean
        user.subscription_status = "active"
        user.plan_expires_at = datetime.utcnow() + timedelta(days=30)

    # Auto-grant full tier monthly credits (top up if below quota)
    tier_credits = settings.ELITE_CREDITS if plan_clean == "elite" else settings.PRO_CREDITS
    if user.credits < tier_credits:
        user.credits = tier_credits

    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "plan_type": user.plan_type,
        "subscription_status": user.subscription_status,
        "credits": user.credits,
        "subscription_id": user.razorpay_subscription_id,
        "expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
    }

