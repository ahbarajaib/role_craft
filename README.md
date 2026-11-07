# RoleCraft

### Craft every resume for the role you’re applying to.

AI-powered resume optimization platform. Upload a DOCX resume, provide a job description, and receive a 1-click tailored resume that preserves 100% of your original formatting and fonts.

---

## Project Status

> **Milestone 21 – Dual Billing Modes (One-Off 30-Day Pass + Subscriptions), Immediate Checkout Verification & User Deletion (Complete)**
> * **Dual Billing Modes**: Users can now choose between a **One-Time 30-Day Pass** (zero recurring auto-debit, 100% UPI/card compatibility) and an **Auto-Renewing Monthly Subscription** via Razorpay. Automatic pass expiration is gracefully enforced via `plan_expires_at`.
> * **Immediate Checkout Verification (`POST /api/v1/payment/verify`)**: Checkout activates membership and full tier credits in milliseconds directly on payment completion, without waiting for webhook latencies.
> * **Admin User Deletion (`POST /api/v1/admin/users/{id}/delete`)**: Admins can permanently delete user accounts with full cascade purge of analyses, master resumes, and tailored resumes, plus self-deletion protection.
> * **Auto-Grant Credits on Upgrade**: Admin plan upgrades to Pro or Elite automatically top up user credits to the tier quota (200 / 400 credits).

> **Milestone 20 – Admin Dashboard & Platform Control Center (Complete)**
> A dedicated, undiscoverable administrative portal (`admin.rolecraft.tech` / `/xrc-control/`) with two-layer authentication (JWT + Secret PIN) is now live. Features include real-time financial metrics and estimated MRR, interactive 30-day signup and feature usage analytics, comprehensive user management with credit top-up drawers, user deletion, plan changers, centralized support ticket triage with technical JSON context, dynamic live system configuration editing (`SiteConfig`), and an immutable audit trail (`AdminActivityLog`).

---

## Repository Layout

```
RoleCraft/
├── docs/               Project documentation
│   ├── vision.md
│   ├── architecture.md
│   ├── tech-stack.md
│   ├── roadmap.md
│   ├── PROJECT_STATE.md
│   ├── AI_RULES.md
│   ├── AI_APPLICATION_ENGINEERING_GUIDE.md
│   └── agent.md
│
├── backend/            Python API (FastAPI + Uvicorn)
│   ├── main.py         Uvicorn entry point
│   ├── pyproject.toml  Dependency manifest (managed by uv)
│   ├── .env.example    Environment variable reference
│   │
│   ├── uploads/            Temporary storage for uploaded files
│   └── app/
│       ├── factory.py          Application factory (create_app)
│       ├── core/
│       │   ├── config.py       Pydantic-Settings configuration
│       │   ├── logging.py      Loguru setup
│       │   └── exceptions.py   Custom exceptions + handlers
│       ├── constants/
│       │   └── resume_keywords.py          Shared constants (260 role titles, 75 soft skills, section keywords)
│       ├── ai/
│       │   ├── provider.py                 OpenAI Responses API wrapper
│       │   ├── prompts.py                  Prompt builder for analyze endpoint
│       │   └── resume_parser_prompts.py    Prompt builder for structured resume parsing
│       ├── api/
│       │   ├── router.py                   Top-level API router
│       │   └── v1/
│       │       ├── health.py                   GET /api/v1/health
│       │       ├── documents.py                POST /upload, POST /set-base, GET /{id}/parse
│       │       ├── job_descriptions.py         POST /job-descriptions/parse
│       │       ├── structured_resume.py        GET/PUT/POST /structured-resume/* (Master Resume)
│       │       └── resume.py                   POST /resume/analyze, POST /resume/rewrite, POST /resume/apply
│       ├── schemas/
│       │   └── structured_resume.py        StructuredResume Pydantic schemas + converter
│       └── services/
│           ├── resume_parser_service.py    DOCX & PDF text extraction + AI structured parsing
│           ├── template_renderer.py        ATS DOCX rendering (Clean Classic, Modern, Executive)
│           ├── pdf_service.py              High-fidelity DOCX → PDF conversion
│           └── rewrite_service.py          AI section rewrite (universal section routing)
│
├── frontend/           Next.js (App Router) frontend
│   └── src/
│       ├── app/
│       │   ├── page.tsx                    Main workspace page
│       │   └── resume-builder/page.tsx     Interactive resume builder
│       ├── components/
│       │   ├── subscription_modal.tsx      Pricing & plan upgrade modal
│       │   ├── faq_section.tsx             FAQ section
│       │   └── mobile_bottom_nav.tsx       Mobile bottom navigation bar
│       └── lib/
│           └── api.ts                      API client helpers
│
├── recordings/         Demo video recordings
│   ├── RoleCraft_Demo_Vertical_9x16.mp4
│   ├── RoleCraft_Demo_Walkthrough.mp4
│   └── rolecraft_desktop_1080p.mp4
│
└── README.md           This file
```

---

## Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.13+ |
| [uv](https://docs.astral.sh/uv/) | latest |

### 1 – Clone and enter the repository

```bash
git clone <repo-url>
cd RoleCraft
```

### 2 – Create the virtual environment and install dependencies

```bash
uv venv
source .venv/bin/activate   # macOS / Linux
# .venv\Scripts\activate    # Windows
```

```bash
cd backend
uv sync
```

### 3 – Configure the environment

```bash
cp .env.example .env
# Edit .env as needed (defaults work for local development)
```

### 4 – Run the development server

```bash
# From the backend/ directory:
uvicorn main:app --reload

# Or using the built-in helper:
python main.py
```

The API will be available at **http://localhost:8000**.

---

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Liveness probe |
| `POST` | `/api/v1/documents/upload` | Upload a DOCX or PDF resume |
| `POST` | `/api/v1/documents/set-base` | Set document as workspace base resume |
| `POST` | `/api/v1/structured-resume/parse` | Parse DOCX/PDF resume into Master Resume JSON |
| `GET` | `/api/v1/structured-resume` | Fetch active user's Master Resume JSON |
| `PUT` | `/api/v1/structured-resume` | Update Master Resume JSON section entries |
| `GET` | `/api/v1/structured-resume/generate/{template}/{format}` | Generate & stream ATS DOCX or PDF export |
| `POST` | `/api/v1/resume/analyze` | Full resume vs JD gap analysis workflow (JSON-first) |
| `POST` | `/api/v1/resume/rewrite` | AI review & rewrite single resume section |
| `POST` | `/api/v1/resume/apply` | Merge approved section rewrites & export ATS document |
| `POST` | `/api/v1/payment/subscribe` | Create Razorpay checkout session (one-time 30-day pass or recurring monthly) |
| `POST` | `/api/v1/payment/verify` | Instantly verify checkout signature, activate Pro/Elite & grant credits |
| `POST` | `/api/v1/payment/webhook` | Razorpay recurring billing hooks (`subscription.charged`, `subscription.cancelled`) |
| `POST` | `/api/v1/admin/auth/verify-pin` | Layer 2 Admin PIN verification (issues 30m session token) |
| `GET` | `/api/v1/admin/stats/overview` | Platform overview: MRR, total users, analysis/tailoring stats |
| `GET` | `/api/v1/admin/users` | Paginated search, filter users by plan and role |
| `POST` | `/api/v1/admin/users/{id}/plan` | Update user plan & auto-assign tier credits (Pro: 200, Elite: 400) |
| `POST` | `/api/v1/admin/users/{id}/credits` | Top up or set exact user credit balance |
| `POST` | `/api/v1/admin/users/{id}/delete` | Permanently delete user and cascade purge resumes/analyses |
| `GET/POST` | `/api/v1/admin/config` | View and dynamically edit live `SiteConfig` values |
| `GET` | `/docs` | Swagger UI (development only) |
| `GET` | `/redoc` | ReDoc (development only) |

### Health check

```bash
curl http://localhost:8000/api/v1/health
```

```json
{
  "status": "ok",
  "environment": "development",
  "version": "0.1.0"
}
```

### Upload a DOCX resume

```bash
curl -X POST http://localhost:8000/api/v1/documents/upload \
  -F "file=@/path/to/your/resume.docx"
```

```json
{
  "document_id": "f4bbba63-5194-47f9-8be6-729e6ed8737c",
  "filename": "resume.docx",
  "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "size": 48291,
  "uploaded_at": "2026-07-09T12:47:29.638656Z",
  "status": "uploaded"
}
```

**Validation errors return 400:**

```bash
# Wrong extension
curl -X POST http://localhost:8000/api/v1/documents/upload \
  -F "file=@resume.pdf"
# → 400: "Invalid file type. Only .docx files are accepted."

# File over 5 MB
# → 400: "File too large. Maximum allowed size is 5 MB."
```

---

## Development Notes

### Adding a new feature router

1. Create `backend/app/api/v1/<feature>.py` with an `APIRouter`.
2. Import it in `backend/app/api/router.py` and call `api_router.include_router(...)`.

### Raising application errors

```python
from app.core.exceptions import NotFoundError

raise NotFoundError("Resume 42 does not exist.")
```

All `AppError` subclasses are caught by the global exception handler and
returned as a consistent JSON body with the correct HTTP status code.

### Environment variables

Every supported variable is documented in `backend/.env.example`.

---

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full system design.

---

## Evidence-Grounded Tailoring (Milestone 23)

RoleCraft uses a two-stage, hallucination-resistant tailoring pipeline that ensures every claim in a tailored resume or cover letter is traceable to the candidate's original resume.

### Stage 1 — Deterministic Evidence Extraction (no LLM)

Before any AI prompt is sent, `EvidenceService` scans the candidate's `StructuredResume` and extracts a `CandidateEvidenceSet`:
- **LEVEL_1_DIRECT**: skills explicitly listed in the Skills section; technologies named in the summary.
- **LEVEL_2_CONTEXTUAL**: technologies found in experience bullets and project descriptions.
- **Years of experience**: parsed verbatim from the summary via regex (never inflated).

`RequirementMatcher` then matches the evidence set against the parsed `JobDescription` to produce a `TailoringPlan`:
- `safe_skills`: technologies the candidate demonstrably has — safe to use in any section.
- `forbidden_claims`: JD terms absent from the candidate's resume — must not appear as candidate qualifications.
- `years_of_experience`: verbatim string from the source resume.

A built-in false-inference deny list prevents common hallucination shortcuts:

| If JD requires | Candidate has | Inference blocked |
|---------------|--------------|-------------------|
| RAG / embeddings | OpenAI API | ✗ LLM API ≠ RAG |
| AWS | Docker | ✗ Container ≠ cloud provider |
| AWS CI/CD | GitHub Actions | ✗ CI tool ≠ AWS CI/CD |
| Django | FastAPI | ✗ Different frameworks |
| pgvector / vector DB | PostgreSQL | ✗ Relational DB ≠ vector DB |
| BM25 / hybrid search | Elasticsearch | ✗ Search infra ≠ ranking models |

### Stage 2 — Evidence-Bounded LLM Rewrite

Every AI prompt now receives:
- `=== CANDIDATE VERIFIED SKILLS ===` — the `safe_skills` list
- `=== FORBIDDEN CLAIMS ===` — the `forbidden_claims` list
- `=== CANDIDATE YEARS OF EXPERIENCE ===` — the verbatim YoE string

All system prompts enforce:
- **No new technologies** — only reframe what is already in the candidate's text
- **No metric fabrication** — preserve existing metrics verbatim; never add new ones
- **No YoE inflation** — use the candidate's stated years exactly

### Python Safety Net

After every LLM rewrite, `sanitize_unsupported_skills_from_text()` performs a word-boundary scan against `forbidden_claims` and strips any JD technology that slipped through despite the prompt constraints.

### Key Files

| File | Role |
|------|------|
| `app/schemas/evidence.py` | Data model for evidence items, evidence levels, TailoringPlan |
| `app/services/evidence_service.py` | Deterministic evidence extractor (no LLM) |
| `app/services/requirement_matcher.py` | Deterministic JD-vs-evidence matcher with deny list |
| `app/services/rewrite_service.py` | AI rewriter (prompts fixed; sanitizer re-enabled) |
| `app/services/tailor_orchestration_service.py` | Full-resume tailor (prompts fixed; TailoringPlan injected) |
| `app/ai/cover_letter_prompts.py` | Cover letter prompts (FORBIDDEN CLAIMS block added) |
| `app/ai/review_prompts.py` | Review prompts (gap analysis renamed; evidence guard added) |
| `tests/test_evidence_grounding.py` | 18 deterministic unit tests (no LLM calls) |

### What Changed in v2 (Milestone 23)

- **`sanitize_unsupported_skills_from_text()`** — re-enabled (was deliberately disabled; now active safety net)
- **`REWRITE_SYSTEM_PROMPT`** — removed "mandatory JD keyword integration" and "metric fabrication" rules
- **`SKILLS_REWRITE_SYSTEM_PROMPT`** — removed "weave missing JD keywords" rule; replaced with "evidence-only skills"
- **`SUMMARY_REWRITE_SYSTEM_PROMPT`** — added rules: no new technologies, preserve YoE verbatim
- **`TAILOR_EXPERIENCE_SYSTEM`** — replaced mandatory JD weaving with evidence-grounded rewriting
- **`TAILOR_SKILLS_SYSTEM`** — replaced "weave JD skills" with "RESUME-ONLY SKILLS"
- **`TAILOR_PROJECTS_SYSTEM`** — replaced mandatory JD weaving with evidence-grounded rewriting
- **`TAILOR_SUMMARY_SYSTEM`** — added evidence constraints: no new tech, no YoE inflation
- **`cover_letter_prompts.py`** — added FORBIDDEN CLAIMS block; added cloud platform clause
- **`cover_letter_service.py`** — original DOCX summary is now primary grounding (not AI-rewritten version); added post-generation sanitizer
- **`review_prompts.py`** — renamed "DETECTOR GAP ANALYSIS" to "MATCH ANALYSIS (FOR CONTEXT ONLY)"; added note that missing items are JD requirements, not candidate claims

---

## Anti-AI Leadership & Technical Project Manager Positioning (Milestone 24)

RoleCraft eliminates robotic AI resume clichés ("results-driven", "proven ability", "demonstrates expertise", "cross-functional to deliver", "drive digital transformation") while offering authentic, grounded executive positioning for senior developers transitioning into leadership and technical delivery roles.

### Summary Positioning Presets

| Preset | Role Target | Strategic Focus & Truth Guardrail |
| :--- | :--- | :--- |
| **Step Up to Team Lead** (`team_lead_transition`) | Team Lead / Lead Developer | Bridges senior engineering foundation into technical ownership: system architecture, code reviews, developer mentorship, and reliable sprint delivery. Opening customized honestly for Team Lead. |
| **Hands-on Tech Lead** (`hands_on_tech_lead`) | Tech Lead | Dual-track excellence: deep hands-on coding craftsmanship paired with technical direction, system architecture, and engineering standards. |
| **Technical Project Manager** (`tech_project_manager`) | Technical Project Manager / TPM | Leverages engineering depth for Agile delivery, backlog grooming, sprint execution, task estimation, risk management, and stakeholder communication. |
| **Senior IC (Specialist)** (`senior_ic`) | Senior IC | Deep technical craftsmanship, resilient architecture design, and complex implementation without management emphasis. |
| **Target Job Match** (`default`) | Target JD Role | Truthful alignment matching the target job description requirements without fabricating unearned titles. |

### The Leadership & Project Manager Exception:
- **Allowed Opening Customization**: When candidates target **Team Lead**, **Tech Lead**, or **Technical Project Manager** roles, the professional summary opening is customized directly for that leadership or delivery role (e.g. *"Technical Project Manager with 7+ years of software engineering and agile delivery experience..."* or *"Team Lead / Senior Software Engineer with 7+ years of experience..."*).
- **Strict Verbatim Years of Experience Lock**: Verified years of experience are preserved verbatim (e.g. `7+ years`). The system strictly forbids changing 7 to 10 or copying JD experience requirements.
- **Evidence-Bound Tech Stack**: Unverified cloud technologies or AI specializations (e.g. Microsoft AI Services, Azure) absent from the candidate's background are never fabricated.

---

## Tech Stack

See [`docs/tech-stack.md`](docs/tech-stack.md) for the full technology list.
