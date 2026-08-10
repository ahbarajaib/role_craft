# RoleCraft

### Craft every resume for the role you’re applying to.

AI-powered resume optimization platform. Upload a DOCX resume, provide a job description, and receive a 1-click tailored resume that preserves 100% of your original formatting and fonts.

---

## Project Status

> **Milestone 17 – AI Resume Builder & Structured Data Engine (Complete)**
> RoleCraft now features a full-fledged AI Resume Builder (`/resume-builder`) powered by a normalized `StructuredResume` JSON data model. Upload any DOCX or PDF resume to parse content via AI into editable sections (Summary, Skills categories, Experience, Education, Projects, Certifications, Custom). Unparsed/low-confidence fields are highlighted in red with ⚠️ badges for easy user completion. Render and export into 3 single-column ATS templates ("Clean Classic", "Modern Professional", "Executive Profile") with profile photo support and 100% font retention.

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
│       ├── analyzers/
│       │   └── section_detector.py         Rule-based section grouper (4-signal heading detection)
│       ├── constants/
│       │   └── resume_keywords.py          Shared constants (260 role titles, 75 soft skills, section keywords)
│       ├── comparators/
│       │   └── resume_comparator.py        Deterministic resume vs JD comparator
│       ├── ai/
│       │   ├── provider.py                 OpenAI Responses API wrapper
│       │   ├── prompts.py                  Prompt builder for analyze endpoint
│       │   └── review_prompts.py           Prompt builder for review-section endpoint
│       ├── api/
│       │   ├── router.py                   Top-level API router
│       │   └── v1/
│       │       ├── health.py                   GET /api/v1/health
│       │       ├── documents.py                POST /upload, GET /{id}/parse, GET /{id}/sections
│       │       ├── job_descriptions.py         POST /job-descriptions/parse
│       │       ├── analysis.py                 POST /analyze
│       │       ├── comparison.py               POST /compare
│       │       ├── review.py                   POST /review-section
│       │       └── resume.py                   POST /resume/analyze, POST /resume/apply, GET /resume/download/{id}
│       ├── middleware/
│       │   └── request_id.py           X-Request-ID middleware
│       ├── dependencies/
│       │   ├── common.py               Shared dependency factories
│       │   ├── document.py             DocumentService factory
│       │   ├── parser.py               ParserService factory
│       │   ├── section.py              SectionService factory
│       │   ├── analysis.py             AnalysisService factory
│       │   ├── review.py               ReviewService factory
│       │   └── resume_analysis.py      ResumeAnalysisWorkflow factory
│       ├── parsers/
│       │   ├── docx_parser.py          Pure DOCX reader — extracts paragraphs + bold-run detection
│       │   └── job_description_parser.py  Multi-domain JD parser (tech + soft skill extraction)
│       ├── schemas/
│       │   ├── document.py                 Upload response model
│       │   ├── parser.py                   Parse response models
│       │   ├── section.py                  Section detection response models
│       │   ├── job_description.py          JobDescription model
│       │   ├── analysis.py                 AnalysisRequest + ResumeAnalysisResponse + Priority
│       │   ├── comparison.py               CompareRequest + ComparisonResult
│       │   ├── review.py                   ReviewRequest + SectionReview
│       │   └── resume_analysis.py          ResumeAnalysisRequest + ResumeAnalysisResult
│       └── services/
│           ├── document_service.py         Upload validation + persistence
│           ├── parser_service.py           Parse orchestration
│           ├── section_service.py          Section detection orchestration
│           ├── job_description_service.py  JD parse orchestration
│           ├── analysis_service.py         Resume vs JD gap analysis (AI)
│           ├── comparison_service.py       Resume vs JD comparison (deterministic)
│           ├── review_service.py           Single-section AI review
│           ├── resume_analysis_workflow.py Orchestrates the full analysis pipeline
│           ├── rewrite_service.py          AI section rewrite (universal section routing)
│           └── patch_service.py            DOCX in-place text patching (OpenXML, formatting-safe)
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
| `POST` | `/api/v1/documents/upload` | Upload a DOCX resume |
| `GET` | `/api/v1/documents/{document_id}/parse` | Parse an uploaded DOCX |
| `GET` | `/api/v1/documents/{document_id}/sections` | Detect resume sections |
| `POST` | `/api/v1/job-descriptions/parse` | Parse a job description |
| `POST` | `/api/v1/analyze` | Analyse resume against a job description (AI) |
| `POST` | `/api/v1/compare` | Compare resume against a job description (deterministic) |
| `POST` | `/api/v1/review-section` | AI review of a single resume section |
| `POST` | `/api/v1/resume/analyze` | Full resume analysis workflow (primary endpoint) |
| `POST` | `/api/v1/resume/apply` | Apply accepted rewrites to original DOCX |
| `GET` | `/api/v1/resume/download/{download_id}` | Stream the generated patched DOCX |
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
