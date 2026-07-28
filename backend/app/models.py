from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    provider: Mapped[str] = mapped_column(String, default="credentials", nullable=False)  # "credentials" or "google"
    google_id: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    credits: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    plan_type: Mapped[str] = mapped_column(String, default="free", nullable=False)  # "free" or "pro"
    subscription_status: Mapped[str] = mapped_column(String, default="inactive", nullable=False)  # "active" or "inactive"
    razorpay_subscription_id: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    razorpay_customer_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    base_resume_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    base_resume_filename: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    daily_target: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class IPLimit(Base):
    __tablename__ = "ip_limits"

    ip_address: Mapped[str] = mapped_column(String, primary_key=True)
    request_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_request_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class AnalysisHistory(Base):
    __tablename__ = "analysis_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    document_id: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    target_role: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    target_company: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    overall_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sections_need_improvement: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_sections: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    download_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    analysis_result_json: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    job_description_text: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

