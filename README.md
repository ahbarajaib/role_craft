# RoleCraft

### Craft every resume for the role you’re applying to.

AI-powered resume optimization platform. Upload a DOCX resume, provide a job description, and receive a 1-click tailored resume that preserves 100% of your original formatting and fonts.

---

## Project Status

> **Milestone 20 – Admin Dashboard & Platform Control Center (Complete)**
> A dedicated, undiscoverable administrative portal (`admin.rolecraft.tech` / `/xrc-control/`) with two-layer authentication (JWT + Secret PIN) is now live. Features include real-time financial metrics and estimated MRR, interactive 30-day signup and feature usage analytics, comprehensive user management with credit top-up drawers and plan changers, centralized support ticket triage with technical JSON context, dynamic live system configuration editing (`SiteConfig`), and an immutable audit trail (`AdminActivityLog`).

> **Milestone 19 – LinkedIn Job Copier Chrome Extension, Premium Gated Distribution & Mobile Bottom Nav (Complete)**
> RoleCraft now ships a branded **LinkedIn Job Copier Chrome Extension** (Manifest V3), distributed securely via the backend API (`GET /api/v1/extension/download`) and gated to **Pro & Elite** subscribers. The `ExtensionModal` component guides users through installation. A new **Mobile Bottom Navigation Bar** (`mobile_bottom_nav.tsx`) replaces the hamburger menu on small screens for improved one-thumb ergonomics. The extension extracts job title, company, location, and full description from any LinkedIn job page in one click, with a multi-strategy DOM fallback system (6/5/4/5 strategies per field) resilient to LinkedIn DOM changes.

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
│       │       ├── resume.py                   POST /resume/analyze, POST /resume/rewrite, POST /resume/apply
│       │       └── extension.py                GET /extension/status, GET /extension/download (Pro/Elite gated)
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
│       │   ├── extension_modal.tsx         LinkedIn Job Copier download & setup guide modal
│       │   ├── subscription_modal.tsx      Pricing & plan upgrade modal
│       │   ├── faq_section.tsx             FAQ section (includes extension entry)
│       │   └── mobile_bottom_nav.tsx       Mobile bottom navigation bar
│       └── lib/
│           └── api.ts                      API client helpers (incl. getExtensionStatus, downloadExtensionZip)
│
├── linkedin-job-copier/  Chrome Extension (Manifest V3)
│   ├── manifest.json   Extension manifest
│   ├── content.js      All extraction logic, button injection, SPA detection
│   ├── styles.css      Button styling with state-based appearances
│   ├── icons/          Branded icons (16x16, 48x48, 128x128)
│   └── README.md       Extension documentation
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
| Python | 3.14+ |
| [uv](https://docs.astral.sh/uv/) | latest |

### 1 – Clone and enter the repository

```bash
git clone <repo-url>
cd resume_ai
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
| `GET` | `/api/v1/extension/status` | Returns `{available, plan_required}` for current user's plan |
| `GET` | `/api/v1/extension/download` | Streams LinkedIn Job Copier ZIP to Pro/Elite users (403 for free) |
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

## Tech Stack

See [`docs/tech-stack.md`](docs/tech-stack.md) for the full technology list.
