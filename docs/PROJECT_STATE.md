# Project State

## Vision
Resume AI is a production-grade AI-powered Resume Optimization platform.
The application allows users to:
1. Upload a DOCX resume.
2. Segment the document into semantic sections (e.g., Experience, Skills, Summary) deterministically.
3. Parse a job description into a structured Pydantic schema using rule-based parsing.
4. Deterministically compare resume sections with job description requirements (keywords, technologies, skills).
5. Review resume sections via AI (using GPT-4o-mini) to detect gaps and strengths without rewriting.
6. *(Future Phase)* Generate target rewrites, let the user approve them, and patch the changes back into the original DOCX while preserving formatting.

---

## Architecture

The project is built on Clean Architecture principles, ensuring distinct separation of concerns and high testability.

```
                    Client (Frontend)
                           │
                           ▼
                    FastAPI REST API (API Layer)
                           │
                           ▼
                Service Orchestration (Service Layer)
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Parsers Layer  AI Layer  Comparators Layer
              │            │            │
              ▼            ▼            ▼
         python-docx    OpenAI    Deterministic Rules
```

### Decoupling Rules
1. **API Layer (`app/api/v1/`)**: Handles HTTP requests, CORS, and returns validated Pydantic models. Contains no business logic or prompt generation.
2. **Service Layer (`app/services/`)**: Orchestrates business tasks. Pure Python, decoupled from HTTP frameworks. Receives downstream components via constructor dependency injection.
3. **AI Layer (`app/ai/`)**: Communicates with LLMs. Houses provider-independent prompt builders and the wrapper client.
4. **Parser Layer (`app/parsers/`)**: Extracts structures from raw formats (DOCX, text files). Pure Python, highly unit-testable.
5. **Comparators & Analyzers (`app/comparators/`, `app/analyzers/`)**: Pure deterministic string operations. Zero network, database, or LLM dependencies.

---

## Tech Stack
- **Runtime**: Python 3.14
- **Web Framework**: FastAPI (with Uvicorn runner)
- **Settings**: Pydantic-Settings (v2)
- **AI Integration**: OpenAI SDK (Responses API with Pydantic structured outputs)
- **Document Processing**: `python-docx`
- **Logging**: Loguru (centralized setup in `app/core/logging.py`)
- **Package Manager**: `uv`

---

## Folder Structure

```
backend/
├── main.py                     Uvicorn server entry point
├── pyproject.toml              Dependency manifest (managed by uv)
├── .env.example                Environment variables template
├── uploads/                    Local directory for temporary DOCX files
└── app/
    ├── factory.py              FastAPI App Builder (middleware, exception handlers)
    ├── core/
    │   ├── config.py           Pydantic Settings & Config validation
    │   ├── logging.py          Loguru custom setup
    │   └── exceptions.py       Custom AppError framework and FastAPI handlers
    ├── middleware/
    │   └── request_id.py       X-Request-ID generator middleware
    ├── analyzers/
    │   └── section_detector.py Semantic resume section detector (rule-based)
    ├── comparators/
    │   └── resume_comparator.py Deterministic keyword/tech/skill matcher
    ├── ai/
    │   ├── provider.py         OpenAI Responses API client wrapper
    │   ├── prompts.py          Prompt builder for /analyze
    │   └── review_prompts.py   Prompt builder for /review-section
    ├── parsers/
    │   ├── docx_parser.py      Word document paragraph extractor
    │   └── job_description_parser.py Rule-based job description parser
    ├── schemas/
    │   ├── document.py         Upload lifecycle models
    │   ├── parser.py           Paragraph extraction models
    │   ├── section.py          Semantic section response models
    │   ├── job_description.py  Job description schemas
    │   ├── analysis.py         AI batch analysis schemas
    │   ├── comparison.py       Deterministic comparison schemas
    │   ├── review.py           AI single-section review schemas
    │   └── resume_analysis.py  Unified workflow request/response models
    ├── services/
    │   ├── document_service.py File verification, size validation & uploads
    │   ├── parser_service.py   Raw document parsing
    │   ├── section_service.py  Document section segmentation
    │   ├── job_description_service.py JD parsing orchestration
    │   ├── analysis_service.py AI resume analysis orchestration
    │   ├── comparison_service.py Deterministic comparison orchestration
    │   ├── review_service.py   AI section review orchestration
    │   └── resume_analysis_workflow.py Unified end-to-end analyzer workflow
    ├── dependencies/
    │   ├── common.py           Common settings / request ID dependencies
    │   ├── document.py         DocumentService DI factory
    │   ├── parser.py           ParserService DI factory
    │   ├── section.py          SectionService DI factory
    │   ├── analysis.py         AnalysisService DI factory
    │   ├── review.py           ReviewService DI factory
    │   └── resume_analysis.py  ResumeAnalysisWorkflow DI factory
    └── api/
        ├── router.py           Master API Router
        └── v1/
            ├── health.py       GET /health
            ├── documents.py    POST /upload, GET /{id}/parse, GET /{id}/sections
            ├── job_descriptions.py POST /job-descriptions/parse
            ├── analysis.py     POST /analyze (batch AI)
            ├── comparison.py   POST /compare (deterministic)
            ├── review.py       POST /review-section (single AI review)
            └── resume.py       POST /resume/analyze (primary unified endpoint)
```

---

## Dependency Flow
FastAPI dependency injection (`Depends`) is used to construct all services.
Example injection chain for the primary endpoint:
```
[POST /resume/analyze]
   │
   ▼
get_resume_analysis_workflow() (dependencies/resume_analysis.py)
   │
   ├── Path(settings.UPLOAD_DIR) ──► SectionService
   ├── (Stateless)                 ──► JobDescriptionService
   ├── (Stateless)                 ──► ComparisonService
   └── OpenAIProvider(Settings)    ──► ReviewService
   │
   ▼
ResumeAnalysisWorkflow(sections, jd, comparison, review)
```
This enables complete mockability of downstream services and clients during test suites.

---

## Current Workflow

The primary end-to-end flow is orchestrated in `ResumeAnalysisWorkflow.run()` when hitting `POST /api/v1/resume/analyze`:

```
1. Upload/Retrieve DOCX ────► 2. Rule-Based Parsing ────► 3. Semantic Segmenting
                                                             │
5. AI Section Review    ◄──── 4. Deterministic Compare ◄─────┘ (Header skipped)
   (Reasoning about gaps)
   │
   ▼
6. Merged Analysis Result (Overall coverage, per-section gaps & strengths)
```

---

## AI Flow & Prompt Design

### Key Principles
1. **Never Hallucinate Resume Content**: The AI is strictly prohibited from inventing experience, titles, dates, or skills.
2. **Structured Outputs**: Uses OpenAI Responses API (`client.responses.parse(text_format=...)`) to parse output directly into Pydantic models at runtime.
3. **No Redundant Scanning**: The prompt does not ask the LLM to scan for keywords. Instead, we pass the pre-computed `SectionComparison` (deterministic gaps) into the prompt context, letting the LLM focus on high-level reasoning and actionable recommendations.

### Prompt Files
- `app/ai/prompts.py`: Batch analyzer instructions.
- `app/ai/review_prompts.py`: Target section reviewer instructions. Includes a stop-word filtered technical term matcher to check required skills.

---

## Coding Conventions
- **Typing**: Python type hints are mandatory everywhere.
- **Clean Functions**: Functions should remain short, focused, and pure where possible.
- **Exception Handling**: Standardized via custom `AppError` subclasses. Caught by the global exception handler in `app/factory.py` and returned as a consistent JSON payload:
  ```json
  {
    "error": {
      "code": "BAD_REQUEST",
      "detail": "Detailed explanation..."
    }
  }
  ```
- **Logging**: Loguru standard logging. Avoid calling `print()`.

---

## Every Endpoint, Schema, and Service

### Endpoints

| Method | Path | Request Body | Response Schema | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/health` | None | None | Returns liveness probe status. |
| `POST` | `/api/v1/documents/upload` | Form-data (file) | `DocumentUploadResponse` | Uploads DOCX file, validates size (< 5MB) and type. |
| `GET` | `/api/v1/documents/{document_id}/parse` | None | `DocumentParseResponse` | Reads DOCX and parses paragraphs. |
| `GET` | `/api/v1/documents/{document_id}/sections` | None | `DocumentSectionsResponse` | Detects semantic resume sections. |
| `POST` | `/api/v1/job-descriptions/parse` | `JobDescriptionRequest` | `JobDescription` | Deterministically parses job description text. |
| `POST` | `/api/v1/analyze` | `AnalysisRequest` | `ResumeAnalysisResponse` | AI analysis of all resume sections against a parsed JD. |
| `POST` | `/api/v1/compare` | `CompareRequest` | `ComparisonResult` | Deterministic comparison of keywords/tech/skills. |
| `POST` | `/api/v1/review-section` | `ReviewRequest` | `SectionReview` | AI review of a single section reasoning about pre-computed gaps. |
| `POST` | `/api/v1/resume/analyze` | `ResumeAnalysisRequest` | `ResumeAnalysisResult` | Primary unified workflow endpoint for frontend. |
| `POST` | `/api/v1/resume/apply` | `ApplyRewriteRequest` | `ApplyRewriteResponse` | Apply accepted rewrites to original DOCX. |
| `GET` | `/api/v1/resume/download/{download_id}` | None | File Download | Stream the generated patched DOCX. |
| `GET` | `/docs` | None | None | Swagger UI (development only) |
| `GET` | `/redoc` | None | None | ReDoc (development only) |

### Schemas (`app/schemas/`)
- `DocumentUploadResponse`: `document_id`, `filename`, `content_type`, `size`, `uploaded_at`, `status`
- `Paragraph`: `index`, `text`, `style_name`
- `DocumentParseResponse`: `document_id`, `paragraph_count`, `paragraphs`
- `SectionParagraph`: `index`, `text`, `style_name`
- `SectionItem`: `title`, `normalized_name`, `paragraph_indexes`, `paragraphs`
- `DocumentSectionsResponse`: `document_id`, `section_count`, `sections`
- `JobDescription`: `title`, `company`, `location`, `employment_type`, `experience_required`, `responsibilities`, `required_skills`, `preferred_skills`, `technologies`, `keywords`
- `SectionComparison`: `section_name`, `matched_keywords`, `missing_keywords`, `matched_technologies`, `missing_technologies`, `coverage_percentage`
- `ComparisonResult`: `sections`, `matched_skills`, `missing_skills`, `matched_technologies`, `missing_technologies`, `keyword_matches`, `keyword_gaps`, `overall_coverage_percentage`
- `SectionReview`: `section_name`, `needs_changes`, `rewrite_worthwhile`, `priority`, `reason`, `recommendations`, `missing_keywords`, `strengths`
- `ReviewedSection`: `section_name`, `needs_changes`, `rewrite_worthwhile`, `priority`, `reason`, `recommendations`, `missing_keywords`, `strengths`, `coverage_percentage`
- `ResumeAnalysisResult`: `document_id`, `overall_summary` (`OverallSummary`), `sections` (`list[ReviewedSection]`), `overall_missing_skills`, `overall_strengths`
- `ApplyRewriteItem`: `section`, `rewritten_text`
- `ApplyRewriteRequest`: `document_id`, `accepted_rewrites`
- `ApplyRewriteResponse`: `download_id`, `sections_updated`, `download_url`

### Services (`app/services/`)
- `DocumentService`: Handles file upload, size checks, and local file storage.
- `ParserService`: Orchestrates reading raw DOCX paragraphs.
- `SectionService`: Runs section segmenter over paragraphs.
- `JobDescriptionService`: Orchestrates job description parsing.
- `ComparisonService`: Executes deterministic keyword and technology intersection logic.
- `ReviewService`: Calls OpenAI Responses API to review sections.
- `ResumeAnalysisWorkflow`: End-to-end coordinator for the primary workflow.
- `PatchService`: Modifies original body paragraphs inside DOCX using python-docx.

---

## Design Decisions
1. **No LLM direct modifications**: GPT-4o-mini only detects gaps and recommends changes. It never patches DOCX files directly (keeps the system reliable and formatting intact).
2. **In-Memory Statelessness**: The API does not have a database. Documents are saved as local files in `backend/uploads/` identified by a UUID. Data coordinates on HTTP requests.
3. **Curated Technology Allow-List**: JD parser uses a regex-matching list of known technologies (Languages, Frameworks, Databases) to achieve maximum accuracy without complex vector search.
4. **Majority-Vote Skill Matching**: Skill phrases are decomposed and filtered of stop-words (e.g. `experience`, `proficiency`). A skill is considered "matched" if at least 50% of its technical content words are present in the resume.
5. **Parallel Section Reviews**: Section reviews are processed concurrently using a `ThreadPoolExecutor` instead of sequentially. This decreases analysis times from nearly a minute (14 sections × 3.5s) to ~3–5 seconds total, preventing gateway read/socket timeouts (ECONNRESET) on the client side.
6. **In-Place Paragraph Patches**: Rather than recreating DOCX files which destroys headers, footers, custom styles, tables, and page geometry, the `PatchService` targets and rewrites only the body paragraph runs inside user-approved sections.

---

## Features Completed
- [x] FastAPI skeleton, unified config, loguru logger.
- [x] Document upload (< 5MB limit, .docx extension checking, UUID generation).
- [x] python-docx parsing and rule-based section segmentation.
- [x] Regex-based, two-pass job description parsing.
- [x] AI analysis layer (OpenAI provider with Pydantic schema validation).
- [x] Deterministic Comparator (whitespace normalisation, case-insensitive keyword, technology, and skill check).
- [x] Unified End-to-End Workflow API (`POST /api/v1/resume/analyze`).
- [x] Next.js (App Router) frontend interface with Tailwind CSS, TanStack Query, and Drag-and-Drop upload.
- [x] Side-by-side iterative AI rewriting modal with visual word-diff highlight and undo tracking.
- [x] python-docx in-place document patch and download endpoints.
- [x] Production Hardening: Consistent error handling, structured logging with bound request correlation, automated background file cleanup, schema-level input validation, and user failure retry button flows.

## Features Intentionally Postponed
- **PostgreSQL**: Kept as a future database option for production scale.
- **Redis + Celery**: Async background task runners deferred.

---

## Remaining Roadmap

### Phase 5 - Authentication & Rate Limits (In Progress)
- [/] Authentication (JWT-based standard credentials + Google Login verification flow)
- [/] Local SQLite database & SQLAlchemy ORM
- [/] Credit caps & IP rate limits (10 starting credits, 1 guest analysis per day limit)
- [ ] PostgreSQL integration
- [ ] Redis + Background jobs (Celery/RQ for long-running AI queries)
- [x] Docker + Docker Compose setups

---

## How to Run Locally

### Prerequisites
- Python 3.13
- Node.js (v18+) and npm
- `uv` installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### Environment Setup
1. Copy `.env.example` to `.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Open `.env` and fill in your `OPENAI_API_KEY`.

### Run Backend Server
```bash
cd backend
uv sync
source .venv/bin/activate
python main.py
```
*The API is now running locally at `http://localhost:8000`. Swagger documentation is available at `http://localhost:8000/docs`.*

### Run Frontend Client
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*The client is now running locally at `http://localhost:3000` (it calls the backend server directly on `http://localhost:8000` via CORS, bypassing the Next.js dev server proxy to avoid socket hang-ups and gateway timeouts on large AI analysis requests).*

---

## Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `APP_NAME` | String | `"Resume AI"` | Name of the application. |
| `ENVIRONMENT` | String | `"development"` | Set to `production` or `development`. |
| `DEBUG` | Boolean | `false` | Enable verbose tracebacks and auto-reload. |
| `LOG_LEVEL` | String | `"INFO"` | Central logging severity level. |
| `UPLOAD_DIR` | String | `"uploads"` | Folder where uploaded DOCX are temporarily stored. |
| `OPENAI_API_KEY` | String | `""` | Secret API key for OpenAI. |
| `OPENAI_MODEL` | String | `"gpt-4o-mini"` | Model used for Responses API. |

---

## Testing Workflow

To execute integration checks, wiring, parser tests, and API validation, run direct Python testing/smoke scripts:
```bash
cd backend
source .venv/bin/activate
# Run custom verification or smoke test scripts directly, e.g.:
python path/to/smoke_test.py
```
*Note: Write pure-logic verification scripts for parsers/analyzers, and use FastAPI's `dependency_overrides` with `MagicMock` on the provider when testing route endpoints to avoid sending real network calls.*