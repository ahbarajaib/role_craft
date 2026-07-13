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
    credits: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class IPLimit(Base):
    __tablename__ = "ip_limits"

    ip_address: Mapped[str] = mapped_column(String, primary_key=True)
    request_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_request_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
