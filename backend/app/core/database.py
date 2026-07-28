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
    # Ensure daily_target column exists on users table for existing databases
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN daily_target INTEGER DEFAULT 10"))
            conn.commit()
        except Exception:
            pass  # Column already exists


def get_db():
    """FastAPI route dependency to provide database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
