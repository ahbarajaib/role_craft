import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models import User
from main import app

client = TestClient(app)
settings = get_settings()

def test_admin_flow():
    # Run migrations
    init_db()

    # Configure a test ADMIN_SECRET
    settings.ADMIN_SECRET = "test_super_secret_pin_1234"

    db = SessionLocal()
    try:
        # Create or fetch test admin user
        admin_user = db.query(User).filter(User.email == "ahbarajaib@gmail.com").first()
        if not admin_user:
            admin_user = User(
                email="ahbarajaib@gmail.com",
                is_admin=True,
                credits=300,
                plan_type="elite",
                subscription_status="active",
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
        else:
            admin_user.is_admin = True
            db.commit()
        assert admin_user is not None, "Superuser should exist in database"
        assert admin_user.is_admin is True, "Superuser should have is_admin=True"

        # Create or fetch a test regular (non-admin) user
        reg_user = db.query(User).filter(User.email == "regular_test_user@example.com").first()
        if not reg_user:
            reg_user = User(
                email="regular_test_user@example.com",
                is_admin=False,
                credits=15,
                plan_type="free",
                subscription_status="inactive",
            )
            db.add(reg_user)
            db.commit()
            db.refresh(reg_user)
        else:
            reg_user.is_admin = False
            db.commit()
    finally:
        db.close()

    admin_jwt = create_access_token({"sub": "ahbarajaib@gmail.com"})
    reg_jwt = create_access_token({"sub": "regular_test_user@example.com"})

    # 1. Non-admin attempts to verify PIN -> 403 Forbidden
    res = client.post(
        "/api/v1/admin/auth/verify-pin",
        headers={"Authorization": f"Bearer {reg_jwt}"},
        json={"pin": "test_super_secret_pin_1234"},
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"

    # 2. Admin attempts with wrong PIN -> 401 Unauthorized
    res = client.post(
        "/api/v1/admin/auth/verify-pin",
        headers={"Authorization": f"Bearer {admin_jwt}"},
        json={"pin": "wrong_pin"},
    )
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"

    # 3. Admin attempts with correct PIN -> 200 OK
    res = client.post(
        "/api/v1/admin/auth/verify-pin",
        headers={"Authorization": f"Bearer {admin_jwt}"},
        json={"pin": "test_super_secret_pin_1234"},
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert "admin_session_token" in data
    admin_token = data["admin_session_token"]

    # 4. Attempt to access stats without X-Admin-Token -> 401
    res = client.get(
        "/api/v1/admin/stats/overview",
        headers={"Authorization": f"Bearer {admin_jwt}"},
    )
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"

    # 5. Access stats WITH valid X-Admin-Token -> 200 OK
    res = client.get(
        "/api/v1/admin/stats/overview",
        headers={
            "Authorization": f"Bearer {admin_jwt}",
            "X-Admin-Token": admin_token,
        },
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    stats = res.json()
    assert "total_users" in stats
    assert "estimated_mrr_inr" in stats

    # 6. List users
    res = client.get(
        "/api/v1/admin/users",
        headers={
            "Authorization": f"Bearer {admin_jwt}",
            "X-Admin-Token": admin_token,
        },
    )
    assert res.status_code == 200
    users_data = res.json()
    assert "items" in users_data
    assert len(users_data["items"]) > 0

    # 7. Check config
    res = client.get(
        "/api/v1/admin/config",
        headers={
            "Authorization": f"Bearer {admin_jwt}",
            "X-Admin-Token": admin_token,
        },
    )
    assert res.status_code == 200
    config_data = res.json()
    assert "FREE_TIER_CREDITS" in config_data["configs"]

    print("✅ All backend admin tests passed successfully!")

if __name__ == "__main__":
    test_admin_flow()
