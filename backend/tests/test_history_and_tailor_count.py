import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.dependencies.resume_analysis import get_rewrite_service
from app.models import AnalysisHistory, User
from main import app

client = TestClient(app)
settings = get_settings()


def test_batch_rewrite_and_history_count_flow():
    init_db()
    db = SessionLocal()

    # Create test user
    test_email = "test_tailor_counter_user@example.com"
    user = db.query(User).filter(User.email == test_email).first()
    if not user:
        user = User(
            email=test_email,
            is_admin=False,
            credits=50,
            plan_type="pro",
            subscription_status="active",
            daily_target=10,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Check initial history count
    res = client.get("/api/v1/history?tz_offset=0", headers=headers)
    assert res.status_code == 200
    initial_today = res.json()["summary"]["daily_summary"]["today_completed"]
    initial_total = res.json()["summary"]["total_analyzed"]

    # Mock RewriteService dependency
    mock_service = MagicMock()
    mock_service.batch_rewrite.return_value = {
        "summary": "Tailored summary content for Lead Frontend Engineer."
    }
    app.dependency_overrides[get_rewrite_service] = lambda: mock_service

    try:
        # 2. Call batch rewrite on a new JD directly (simulating 1-Click Tailor on new JD)
        new_jd_text = "We are seeking a Lead Frontend Engineer with React, TypeScript, and TailwindCSS expertise."
        batch_payload = {
            "document_id": f"base/{user.id}",
            "job_description_text": new_jd_text,
            "sections": [
                {
                    "section_name": "summary",
                    "section_type": "summary",
                    "recommendations": ["Tailor for Lead Frontend Engineer with React and TypeScript"],
                }
            ],
        }

        batch_res = client.post("/api/v1/resume/batch-rewrite", json=batch_payload, headers=headers)
        assert batch_res.status_code == 200

        # 3. Verify history count increased by 1
        res_after = client.get("/api/v1/history?tz_offset=0", headers=headers)
        assert res_after.status_code == 200
        data_after = res_after.json()
        assert data_after["summary"]["daily_summary"]["today_completed"] == initial_today + 1
        assert data_after["summary"]["total_analyzed"] == initial_total + 1

        # Verify latest record has valid score and target_role
        latest_item = data_after["items"][0]
        assert latest_item["overall_score"] > 0
    finally:
        app.dependency_overrides.pop(get_rewrite_service, None)
        # Clean up created test records
        db.query(AnalysisHistory).filter(AnalysisHistory.user_id == user.id).delete()
        db.commit()
        db.close()


def test_existing_analysis_linked_with_download_id_on_tailor():
    init_db()
    db = SessionLocal()

    test_email = "test_tailor_update_user@example.com"
    user = db.query(User).filter(User.email == test_email).first()
    if not user:
        user = User(
            email=test_email,
            is_admin=False,
            credits=50,
            plan_type="pro",
            subscription_status="active",
            daily_target=10,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    # Simulate an analysis record already created (e.g. user clicked Analyze Gaps & Fit)
    jd_text = "Senior Python Engineer with FastAPI and Kubernetes."
    history_entry = AnalysisHistory(
        user_id=user.id,
        document_id=f"base/{user.id}",
        filename="Resume.docx",
        target_role="Senior Python Engineer",
        target_company="Acme Corp",
        overall_score=78,
        sections_need_improvement=3,
        total_sections=8,
        download_id=None,
        job_description_text=jd_text,
    )
    db.add(history_entry)
    db.commit()
    db.refresh(history_entry)

    mock_service = MagicMock()
    mock_service.batch_rewrite.return_value = {
        "summary": "Tailored summary for Senior Python Engineer."
    }
    app.dependency_overrides[get_rewrite_service] = lambda: mock_service

    try:
        # User now clicks 1-Click Tailor
        batch_payload = {
            "document_id": f"base/{user.id}",
            "job_description_text": jd_text,
            "sections": [
                {
                    "section_name": "summary",
                    "section_type": "summary",
                    "recommendations": ["Highlight FastAPI and Kubernetes"],
                }
            ],
        }

        batch_res = client.post("/api/v1/resume/batch-rewrite", json=batch_payload, headers=headers)
        assert batch_res.status_code == 200

        # Verify that the history record was updated
        db.refresh(history_entry)
        # Count should remain 1 (same JD application), not duplicated
        res_hist = client.get("/api/v1/history?tz_offset=0", headers=headers)
        assert res_hist.status_code == 200
        items = [it for it in res_hist.json()["items"] if it["target_role"] == "Senior Python Engineer"]
        assert len(items) == 1
    finally:
        app.dependency_overrides.pop(get_rewrite_service, None)
        db.query(AnalysisHistory).filter(AnalysisHistory.user_id == user.id).delete()
        db.commit()
        db.close()
