from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(UTC)


class PlanType(StrEnum):
    FREE = "free"
    PRO = "pro"
    ELITE = "elite"


class SubscriptionStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    EXPIRED = "expired"


class AuthProvider(StrEnum):
    CREDENTIALS = "credentials"
    GOOGLE = "google"
    BOTH = "both"


class IssueType(StrEnum):
    BUG = "bug"
    FORMATTING = "formatting"
    AI_QUALITY = "ai_quality"
    PAYMENT = "payment"
    FEATURE_REQUEST = "feature_request"
    GENERAL = "general"


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    provider: Mapped[str] = mapped_column(String, default=AuthProvider.CREDENTIALS, nullable=False)
    google_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    plan_type: Mapped[str] = mapped_column(String, default=PlanType.FREE, nullable=False)
    subscription_status: Mapped[str] = mapped_column(String, default=SubscriptionStatus.INACTIVE, nullable=False)
    plan_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
    missing_skills_tracker: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string mapping skill -> frequency count
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships with cascading deletes
    structured_resume: Mapped[StructuredResumeModel | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    tailored_resumes: Mapped[list[TailoredResumeModel]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    analysis_history: Mapped[list[AnalysisHistory]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    issue_reports: Mapped[list[IssueReport]] = relationship(
        back_populates="user"
    )


class IPLimit(Base):
    __tablename__ = "ip_limits"

    ip_address: Mapped[str] = mapped_column(String, primary_key=True)
    request_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_request_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class AnalysisHistory(Base):
    __tablename__ = "analysis_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    document_id: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    target_role: Mapped[str | None] = mapped_column(String, nullable=True)
    target_company: Mapped[str | None] = mapped_column(String, nullable=True)
    overall_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sections_need_improvement: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_sections: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    download_id: Mapped[str | None] = mapped_column(String, nullable=True)
    analysis_result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_description_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped[User] = relationship(back_populates="analysis_history")


class StructuredResumeModel(Base):
    __tablename__ = "structured_resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    resume_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string of StructuredResume schema
    profile_photo_path: Mapped[str | None] = mapped_column(String, nullable=True)
    source_document_id: Mapped[str | None] = mapped_column(String, nullable=True)
    source_format: Mapped[str | None] = mapped_column(String, nullable=True)  # "docx" | "pdf" | "manual"
    preferred_template: Mapped[str | None] = mapped_column(String, nullable=True)  # "clean_classic" | "modern_professional" | "executive_profile"
    original_docx_path: Mapped[str | None] = mapped_column(String, nullable=True)  # Permanent path to original uploaded DOCX (None if PDF)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user: Mapped[User] = relationship(back_populates="structured_resume")


class TailoredResumeModel(Base):
    """Stores AI-tailored versions of the master StructuredResume, one per job application."""
    __tablename__ = "tailored_resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    job_id: Mapped[str | None] = mapped_column(String, nullable=True)   # link to workspace job if applicable
    job_title: Mapped[str | None] = mapped_column(String, nullable=True)
    job_company: Mapped[str | None] = mapped_column(String, nullable=True)
    tailored_resume_json: Mapped[str] = mapped_column(Text, nullable=False)  # StructuredResume JSON with AI-tailored content
    diff_json: Mapped[str | None] = mapped_column(Text, nullable=True)   # { field_path: {original, tailored} }
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped[User] = relationship(back_populates="tailored_resumes")


class IssueReport(Base):
    """Stores user-submitted bug reports, formatting issues, and general feedback."""
    __tablename__ = "issue_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    user_email: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    issue_type: Mapped[str] = mapped_column(String, default=IssueType.BUG, nullable=False)
    subject: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    context_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="open", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped[User | None] = relationship(back_populates="issue_reports")


class AdminActivityLog(Base):
    """Immutable audit trail for all admin actions."""
    __tablename__ = "admin_activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    admin_email: Mapped[str] = mapped_column(String, index=True, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    target_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class SiteConfig(Base):
    """Dynamic global system configurations managed via Admin Dashboard."""
    __tablename__ = "site_config"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String, nullable=True)
