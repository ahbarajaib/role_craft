"""Admin Bootstrap Script for RoleCraft.

Run this script once to bootstrap the database schema and promote the superuser
account (default: ahbarajaib@gmail.com) to is_admin = True.

Usage:
    python scripts/bootstrap_admin.py [optional_email]
"""

import sys
import os
import json

# Add parent directory to sys.path so app can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import init_db, SessionLocal
from app.models import User, SiteConfig
from app.core.config import get_settings

def bootstrap_admin(target_email: str = "ahbarajaib@gmail.com"):
    print(f"🚀 Initializing database tables and migrations...")
    init_db()
    
    settings = get_settings()
    db = SessionLocal()
    try:
        # 1. Promote Superuser
        user = db.query(User).filter(User.email == target_email).first()
        if user:
            user.is_admin = True
            db.commit()
            print(f"✅ User '{target_email}' found and promoted to Admin (is_admin=True)!")
        else:
            print(f"⚠️ User '{target_email}' not found in database yet.")
            print(f"   Once '{target_email}' registers or logs in, re-run this script to promote to Admin.")

        # 2. Seed Default SiteConfig if empty
        default_configs = {
            "FREE_TIER_CREDITS": str(settings.FREE_TIER_CREDITS),
            "PRO_CREDITS": str(settings.PRO_CREDITS),
            "ELITE_CREDITS": str(settings.ELITE_CREDITS),
            "VIP_EMAILS": json.dumps(settings.VIP_EMAILS),
        }

        for key, val in default_configs.items():
            existing = db.query(SiteConfig).filter(SiteConfig.key == key).first()
            if not existing:
                cfg = SiteConfig(
                    key=key,
                    value=val,
                    updated_by="bootstrap",
                )
                db.add(cfg)
                print(f"  + Seeded SiteConfig: {key} = {val}")
        db.commit()
        print("✅ SiteConfig defaults verified/seeded successfully.")
        print("\n🎉 Admin bootstrap complete!")

    finally:
        db.close()

if __name__ == "__main__":
    email_to_promote = sys.argv[1] if len(sys.argv) > 1 else "ahbarajaib@gmail.com"
    bootstrap_admin(email_to_promote)
