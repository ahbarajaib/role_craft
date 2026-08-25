from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Text
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
    base_cover_letter_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    base_cover_letter_filename: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    daily_target: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    missing_skills_tracker: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # JSON string mapping skill -> frequency count
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


class StructuredResumeModel(Base):
    __tablename__ = "structured_resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    resume_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string of StructuredResume schema
    profile_photo_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source_document_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source_format: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # "docx" | "pdf" | "manual"
    preferred_template: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # "clean_classic" | "modern_professional" | "executive_profile"
    original_docx_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Permanent path to original uploaded DOCX (None if PDF)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class TailoredResumeModel(Base):
    """Stores AI-tailored versions of the master StructuredResume, one per job application."""
    __tablename__ = "tailored_resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    job_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)   # link to workspace job if applicable
    job_title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    job_company: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tailored_resume_json: Mapped[str] = mapped_column(Text, nullable=False)  # StructuredResume JSON with AI-tailored content
    diff_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # { field_path: {original, tailored} }
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class IssueReport(Base):
    """Stores user-submitted bug reports, formatting issues, and general feedback."""
    __tablename__ = "issue_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, index=True, nullable=True)
    user_email: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    issue_type: Mapped[str] = mapped_column(String, default="bug", nullable=False)  # "bug", "formatting", "ai_quality", "payment", "feature_request", "general"
    subject: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    context_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string containing page URL, document_id, error message, browser/device info
    status: Mapped[str] = mapped_column(String, default="open", nullable=False)  # "open", "investigating", "resolved"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

