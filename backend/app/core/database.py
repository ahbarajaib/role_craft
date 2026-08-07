from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models import Base

import os

DB_FILE = os.getenv("DATABASE_FILE", "rolecraft.db")
DATABASE_URL = f"sqlite:///{DB_FILE}"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db() -> None:
    """Ensure database tables are created and migrate lightweight schema additions."""
    Base.metadata.create_all(bind=engine)
    # Ensure all new columns exist on users table for existing databases using isolated transactions
    columns_to_add = [
        ("daily_target", "INTEGER DEFAULT 10"),
        ("base_cover_letter_id", "VARCHAR(36)"),
        ("base_cover_letter_filename", "VARCHAR(255)"),
        ("phone_number", "VARCHAR(50)"),
        ("address", "VARCHAR(255)"),
        ("linkedin_url", "VARCHAR(255)"),
        ("missing_skills_tracker", "TEXT"),
    ]
    for col_name, col_type in columns_to_add:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
        except Exception:
            pass  # Column already exists


def get_db():
    """FastAPI route dependency to provide database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
