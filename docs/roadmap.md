# Roadmap

## Phase 1 - Foundation ✅

- [x] FastAPI foundation
- [x] Configuration
- [x] Logging
- [x] Upload endpoint
- [x] DOCX parser

---

## Phase 2 - Resume Understanding

- [x] Section Detector
- [ ] Resume Model
- [x] Job Description Parser

---

## Phase 3 - Analysis Engine ✅

- [x] Comparator Engine
- [x] AI Resume Reviewer
- [x] Targeted Section Rewriter
- [x] DOCX Patch Engine
---

## Phase 4 - Frontend ✅

- [x] Next.js foundation
- [x] Upload page
- [x] Analysis results
- [x] Section review
- [x] Section rewrite
- [x] DOCX patching

---

## Phase 5 - Authentication & Rate Limits (In Progress)

- [/] Authentication (Standard Credentials + Google Login)
- [/] Rate Limiting & Usage Caps (SQLite database backend)
- [ ] PostgreSQL integration
- [ ] Redis + Background jobs (Celery/RQ for long-running AI queries)
- [x] Docker deployment
- [x] Production Hardening (structured logging, request correlation, input validation, auto file cleanup, friendly error retries)