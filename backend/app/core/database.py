import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models import Base

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
        ("is_admin", "BOOLEAN DEFAULT 0 NOT NULL"),
        ("plan_expires_at", "DATETIME"),
    ]
    for col_name, col_type in columns_to_add:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
        except Exception:
            pass  # Column already exists

    # Auto-migrate original_docx_path for structured_resumes table
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE structured_resumes ADD COLUMN original_docx_path VARCHAR"))
    except Exception:
        pass  # Column already exists

    # Ensure tailored_resumes table is created
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS tailored_resumes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    job_id VARCHAR,
                    job_title VARCHAR,
                    job_company VARCHAR,
                    tailored_resume_json TEXT NOT NULL,
                    diff_json TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_tailored_resumes_user_id ON tailored_resumes (user_id)"))
    except Exception:
        pass

    # Ensure issue_reports table is created
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS issue_reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    user_email VARCHAR,
                    issue_type VARCHAR NOT NULL DEFAULT 'bug',
                    subject VARCHAR,
                    description TEXT NOT NULL,
                    context_data TEXT,
                    status VARCHAR NOT NULL DEFAULT 'open',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_issue_reports_user_id ON issue_reports (user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_issue_reports_user_email ON issue_reports (user_email)"))
    except Exception:
        pass

    # Ensure admin_activity_logs table is created
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS admin_activity_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_email VARCHAR NOT NULL,
                    action VARCHAR NOT NULL,
                    target_user_id INTEGER,
                    payload_json TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_admin_activity_logs_admin_email ON admin_activity_logs (admin_email)"))
    except Exception:
        pass

    # Ensure site_config table is created
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS site_config (
                    key VARCHAR PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_by VARCHAR
                )
            """))
    except Exception:
        pass


def get_db():
    """FastAPI route dependency to provide database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
