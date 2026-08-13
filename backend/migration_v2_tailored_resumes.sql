-- Migration: Add original_docx_path to structured_resumes, create tailored_resumes table, and ensure users.name exists
-- Run this on the VPS BEFORE deploying new backend code.

-- 1. Add original_docx_path column to existing structured_resumes table
ALTER TABLE structured_resumes ADD COLUMN original_docx_path VARCHAR;

-- 2. Ensure users table has name column
ALTER TABLE users ADD COLUMN name VARCHAR;

-- 3. Create tailored_resumes table
CREATE TABLE IF NOT EXISTS tailored_resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    job_id VARCHAR,
    job_title VARCHAR,
    job_company VARCHAR,
    tailored_resume_json TEXT NOT NULL,
    diff_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_tailored_resumes_user_id ON tailored_resumes (user_id);

-- Verify
SELECT 'structured_resumes columns:' as info;
PRAGMA table_info(structured_resumes);
SELECT 'tailored_resumes columns:' as info;
PRAGMA table_info(tailored_resumes);
SELECT 'users columns:' as info;
PRAGMA table_info(users);
