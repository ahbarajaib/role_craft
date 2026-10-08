from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    provider: Mapped[str] = mapped_column(String, default="credentials", nullable=False)  # "credentials" or "google"
    google_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    plan_type: Mapped[str] = mapped_column(String, default="free", nullable=False)  # "free" or "pro"
    subscription_status: Mapped[str] = mapped_column(String, default="inactive", nullable=False)  # "active" or "inactive"
    plan_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    razorpay_subscription_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    razorpay_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    base_resume_id: Mapped[str | None] = mapped_column(String, nullable=True)
    base_resume_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    base_cover_letter_id: Mapped[str | None] = mapped_column(String, nullable=True)
    base_cover_letter_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String, nullable=True)
    daily_target: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    missing_skills_tracker: Mapped[str | None] = mapped_column(String, nullable=True)  # JSON string mapping skill -> frequency count
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
    target_role: Mapped[str | None] = mapped_column(String, nullable=True)
    target_company: Mapped[str | None] = mapped_column(String, nullable=True)
    overall_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sections_need_improvement: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_sections: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    download_id: Mapped[str | None] = mapped_column(String, nullable=True)
    analysis_result_json: Mapped[str | None] = mapped_column(String, nullable=True)
    job_description_text: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class StructuredResumeModel(Base):
    __tablename__ = "structured_resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    resume_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string of StructuredResume schema
    profile_photo_path: Mapped[str | None] = mapped_column(String, nullable=True)
    source_document_id: Mapped[str | None] = mapped_column(String, nullable=True)
    source_format: Mapped[str | None] = mapped_column(String, nullable=True)  # "docx" | "pdf" | "manual"
    preferred_template: Mapped[str | None] = mapped_column(String, nullable=True)  # "clean_classic" | "modern_professional" | "executive_profile"
    original_docx_path: Mapped[str | None] = mapped_column(String, nullable=True)  # Permanent path to original uploaded DOCX (None if PDF)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class TailoredResumeModel(Base):
    """Stores AI-tailored versions of the master StructuredResume, one per job application."""
    __tablename__ = "tailored_resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    job_id: Mapped[str | None] = mapped_column(String, nullable=True)   # link to workspace job if applicable
    job_title: Mapped[str | None] = mapped_column(String, nullable=True)
    job_company: Mapped[str | None] = mapped_column(String, nullable=True)
    tailored_resume_json: Mapped[str] = mapped_column(Text, nullable=False)  # StructuredResume JSON with AI-tailored content
    diff_json: Mapped[str | None] = mapped_column(Text, nullable=True)   # { field_path: {original, tailored} }
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class IssueReport(Base):
    """Stores user-submitted bug reports, formatting issues, and general feedback."""
    __tablename__ = "issue_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    user_email: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    issue_type: Mapped[str] = mapped_column(String, default="bug", nullable=False)  # "bug", "formatting", "ai_quality", "payment", "feature_request", "general"
    subject: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    context_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string containing page URL, document_id, error message, browser/device info
    status: Mapped[str] = mapped_column(String, default="open", nullable=False)  # "open", "investigating", "resolved"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class AdminActivityLog(Base):
    """Immutable audit trail for all admin actions."""
    __tablename__ = "admin_activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    admin_email: Mapped[str] = mapped_column(String, index=True, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)  # "credit_update" | "plan_change" | "admin_toggle" | "config_change" | "support_status"
    target_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: {before, after, details}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class SiteConfig(Base):
    """Dynamic global system configurations managed via Admin Dashboard."""
    __tablename__ = "site_config"

    key: Mapped[str] = mapped_column(String, primary_key=True)  # e.g. "FREE_TIER_CREDITS", "PRO_CREDITS", "ELITE_CREDITS", "VIP_EMAILS"
    value: Mapped[str] = mapped_column(Text, nullable=False)  # JSON-encoded string
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String, nullable=True)  # admin email


