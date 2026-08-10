# Roadmap

## Phase 1 - Foundation ✅

- [x] FastAPI foundation
- [x] Configuration
- [x] Logging
- [x] Upload endpoint
- [x] DOCX parser (+ `is_bold` run detection)

---

## Phase 2 - Resume Understanding ✅

- [x] Section Detector (4-signal heading detection)
- [x] SECTION_NAME_MAP (190+ section name variants)
- [x] Job Description Parser (multi-domain keyword + soft skill extraction)

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
- [x] 1-Click Auto-Tailor (keywords + job title)
- [x] Tailoring History Modal (date/week/day navigation, bar chart)
- [x] Cover Letter generator + copy / download
- [x] Compact floating action dock (bottom-right)

---

## Phase 5 - Authentication & Rate Limits ✅

- [x] Authentication (Standard Credentials + Google Login)
- [x] Rate Limiting & Usage Caps (SQLite database backend)
- [x] Docker deployment
- [x] Production Hardening (structured logging, request correlation, input validation, auto file cleanup, friendly error retries)
- [x] Secure Webhook Redeployment System
- [ ] PostgreSQL integration
- [ ] Redis + Background jobs (Celery/RQ for long-running AI queries)

---

## Phase 6 - Universal Resume Support ✅

- [x] Shared constants module (`app/constants/resume_keywords.py`)
  - 260 universal role titles across all industries
  - 75 domain soft skill phrases
  - Expanded skills / summary / experience section keywords
  - Preserve-verbatim section registry
- [x] Bold-Normal heading detection (Signal 4) in `section_detector.py`
- [x] 50+ new SECTION_NAME_MAP entries (Core Competencies, Key Achievements,
  Career Highlights, Areas of Expertise, Additional Information, Declarations...)
- [x] Multi-domain technology list in JD parser (Healthcare, Finance, Marketing,
  HR, Legal, Construction, Education, Customer Service)
- [x] Soft skill phrase extraction in JD parser (two-pass keyword extraction)
- [x] Universal experience sub-section routing in all three pipeline services
- [x] Preserve-verbatim gate for Additional Information / Languages / Declarations
- [x] Rule 2 heuristic tightened in patch_service (no false-positives on short bullets)
- [x] Eliminated 3x duplication of role keyword lists across services

---

## Phase 7 - AI Resume Builder & Structured Data Engine ✅

- [x] Normalized `StructuredResume` Pydantic schema and SQLite model
- [x] AI Resume Parser for DOCX and PDF uploads (`pymupdf` + `python-docx`)
- [x] Field-level parse confidence tracking & red highlight/warning UI for unparsed fields
- [x] Dedicated `/resume-builder` page with section editor (Add/Remove/Reorder sections)
- [x] 3 Single-Column ATS Resume Templates:
  - Clean Classic (Times New Roman, 100% ATS safe)
  - Modern Professional (Calibri, navy dividers)
  - Executive Profile (Aptos/Calibri, blue accents, optional profile photo)
- [x] Profile photo upload and embedding engine
- [x] Programmatic DOCX template renderer (`ATSTemplateRenderer`) & PDF conversion

---

## Phase 8 - Planned

- [ ] PostgreSQL + Redis migration
- [ ] Multi-language resume support (Arabic, French, German...)
- [ ] Resume version history & diff viewer
- [ ] Team workspaces & collaboration
- [ ] ATS scoring engine (per-company ATS simulation)
- [ ] Multi-model AI routing (Claude / Gemini fallback)
- [ ] Billing & subscription tiers
