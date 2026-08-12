# RoleCraft

### Craft every resume for the role you’re applying to.

AI-powered resume optimization platform. Upload a DOCX resume, provide a job description, and receive a 1-click tailored resume that preserves 100% of your original formatting and fonts.

---

## Project Status

## Project Status

> **Milestone 18 – AI Master Resume Builder, Dynamic UX & Multi-Format ATS Export (Complete)**
> RoleCraft features a unified **Master Resume JSON** engine (`StructuredResume` in DB) powering both AI job alignment analysis and the interactive Resume Builder (`/resume-builder`). Supports DOCX & PDF uploads with AI parsing into structured sections (Summary, Technical Skills, Professional Experience, Projects, Education, Certifications, Custom). Features live step-by-step parsing progress UX with shimmer progress bars, dynamic "+ Add New Section" toolbar filtering, professional headline fields, project links & bullet highlights, and dual-authenticated (Header / URL Token) PDF and DOCX single-column ATS template exports.

---

## Repository Layout

```
resume_ai/
├── docs/               Project documentation
│   ├── vision.md
│   ├── architecture.md
│   ├── tech-stack.md
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
