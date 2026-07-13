from sqlalchemy import create_engine
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
    """Ensure database tables are created."""
    Base.metadata.create_all(bind=engine)

def get_db():
    """FastAPI route dependency to provide database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
