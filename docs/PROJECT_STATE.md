# Project State

## Vision
RoleCraft is a production-grade AI-powered Resume Optimization platform (live at **rolecraft.tech**).
The application allows users to:
1. Upload a DOCX or PDF resume.
2. Segment the document into semantic sections (e.g., Experience, Skills, Summary) deterministically.
3. Parse a job description into a structured Pydantic schema using rule-based parsing.
4. Deterministically compare resume sections with job description requirements (keywords, technologies, skills).
5. Review resume sections via AI (using GPT-4o-mini) to detect gaps and strengths.
6. Generate targeted rewrites, approve/reject changes, and patch directly back into the original DOCX while preserving 100% of formatting.
7. Build and manage Master Resumes with structured schemas, rendering high-fidelity ATS DOCX and PDF templates (`/resume-builder`).
8. Extract job details in 1 click from LinkedIn via a Chrome Extension (Manifest V3) gated to Pro/Elite users.
9. Dual billing modes: One-Off 30-Day Pass (zero recurring auto-debit) or Monthly Auto-Renewing Subscriptions via Razorpay, with immediate checkout verification (`/api/v1/payment/verify`).
10. Admin Control Center (`admin.rolecraft.tech` / `/xrc-control/`) with two-layer authentication (JWT + PIN), financial & growth analytics, user management, credit adjustment, account deletion, support ticket triage, and live configuration editing.

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
    │   └── section_detector.py Semantic resume section detector (4-signal: Heading style, SECTION_NAME_MAP, ALL-CAPS, Bold-Normal)
    ├── comparators/
    │   └── resume_comparator.py Deterministic keyword/tech/skill matcher
    ├── constants/
    │   └── resume_keywords.py  Shared keyword constants (260 role titles, 75 soft skills, section routing)
    ├── ai/
    │   ├── provider.py         OpenAI Responses API client wrapper
    │   ├── prompts.py          Prompt builder for /analyze
    │   └── review_prompts.py   Prompt builder for /review-section
    ├── parsers/
    │   ├── docx_parser.py      Word document paragraph extractor (includes is_bold run detection)
    │   └── job_description_parser.py Rule-based JD parser (multi-domain technologies + two-pass soft skill keyword extraction)
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
    │   ├── resume_analysis_workflow.py Unified end-to-end analyzer workflow
    │   ├── rewrite_service.py  AI section rewrite (universal section type routing)
    │   └── patch_service.py    DOCX in-place text patching (OpenXML, formatting-safe)
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
            ├── resume.py       POST /resume/analyze (primary unified endpoint)
            └── extension.py    GET /extension/status, GET /extension/download (Pro/Elite gated)
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
| `POST` | `/api/v1/auth/register` | `UserRegisterRequest` | `TokenResponse` | Register new user with email/password. |
| `POST` | `/api/v1/auth/login` | `UserLoginRequest` | `TokenResponse` | Log in with email/password. |
| `POST` | `/api/v1/auth/google` | `GoogleAuthRequest` | `TokenResponse` | Google OAuth token verification and login. |
| `GET` | `/api/v1/auth/me` | None | `UserResponse` | Fetch current user profile, credits, and active plan. |
| `POST` | `/api/v1/documents/upload` | Form-data (file) | `DocumentUploadResponse` | Uploads DOCX/PDF file, validates size (< 5MB) and type. |
| `POST` | `/api/v1/documents/set-base` | `SetBaseResumeRequest` | `DocumentUploadResponse` | Set uploaded document as workspace base resume. |
| `GET` | `/api/v1/documents/{document_id}/parse` | None | `DocumentParseResponse` | Reads DOCX and parses paragraphs. |
| `GET` | `/api/v1/documents/{document_id}/sections` | None | `DocumentSectionsResponse` | Detects semantic resume sections. |
| `POST` | `/api/v1/job-descriptions/parse` | `JobDescriptionRequest` | `JobDescription` | Deterministically parses job description text. |
| `POST` | `/api/v1/structured-resume/parse` | Form-data (file) | `StructuredResume` | AI-driven parse of DOCX/PDF into master resume schema. |
| `GET` | `/api/v1/structured-resume` | None | `StructuredResume` | Retrieve active user's saved Master Resume JSON. |
| `PUT` | `/api/v1/structured-resume` | `StructuredResume` | `StructuredResume` | Update active user's saved Master Resume JSON. |
| `GET` | `/api/v1/structured-resume/generate/{template}/{format}` | None | File Download | Render ATS DOCX or PDF from master resume. |
| `POST` | `/api/v1/analyze` | `AnalysisRequest` | `ResumeAnalysisResponse` | AI analysis of all resume sections against a parsed JD. |
| `POST` | `/api/v1/compare` | `CompareRequest` | `ComparisonResult` | Deterministic comparison of keywords/tech/skills. |
| `POST` | `/api/v1/review-section` | `ReviewRequest` | `SectionReview` | AI review of a single section reasoning about pre-computed gaps. |
| `POST` | `/api/v1/resume/analyze` | `ResumeAnalysisRequest` | `ResumeAnalysisResult` | Primary unified workflow endpoint for frontend. |
| `POST` | `/api/v1/resume/rewrite` | `RewriteSectionRequest` | `RewriteSectionResponse` | AI section rewrite with universal role & section routing. |
| `POST` | `/api/v1/resume/apply` | `ApplyRewriteRequest` | `ApplyRewriteResponse` | Apply accepted rewrites to original DOCX. |
| `GET` | `/api/v1/resume/download/{download_id}` | None | File Download | Stream the generated patched DOCX. |
| `GET` | `/api/v1/extension/status` | None | `{available, plan_required}` | Returns whether the extension is available for the current user's plan. |
| `GET` | `/api/v1/extension/download` | None | File (ZIP) | Streams `linkedin-job-copier.zip` to Pro/Elite subscribers only. Returns 403 for free users. |
| `POST` | `/api/v1/payment/subscribe` | `SubscribeRequest` | `SubscribeResponse` | Creates checkout session: One-Off 30-Day Pass (Order) or Monthly Auto-Renew (Subscription). |
| `POST` | `/api/v1/payment/verify` | `VerifyPaymentRequest` | `VerifyPaymentResponse` | Instantly verifies checkout signature, activates plan, and grants tier credits. |
| `POST` | `/api/v1/payment/webhook` | Webhook JSON | `{"status": "ok"}` | Razorpay recurring lifecycle hooks (`subscription.charged`, `subscription.cancelled`). |
| `POST` | `/api/v1/admin/auth/verify-pin` | `VerifyPinRequest` | `VerifyPinResponse` | Layer 2 Admin PIN verification (issues ephemeral 30m token). |
| `GET` | `/api/v1/admin/stats/overview` | None | `AdminOverviewStats` | Platform overview: MRR, total users, analysis/tailoring counts. |
| `GET` | `/api/v1/admin/stats/signups` | Query `days` | List of daily signup counts | 30-day interactive daily registration analytics. |
| `GET` | `/api/v1/admin/stats/usage` | Query `days` | List of daily feature stats | 30-day AI feature usage breakdown (Analyses vs Tailoring). |
| `GET` | `/api/v1/admin/users` | Query `page`, `search`, `plan`, `role` | Paginated users list | Search and filter registered accounts. |
| `GET` | `/api/v1/admin/users/{id}` | None | `AdminUserDetailResponse` | Detailed user inspection with analyses and master resumes. |
| `POST` | `/api/v1/admin/users/{id}/plan` | `AdminUpdatePlanRequest` | `AdminUserActionResponse` | Update plan & auto-assign tier credits (Pro: 200, Elite: 400). |
| `POST` | `/api/v1/admin/users/{id}/credits` | `AdminUpdateCreditsRequest` | `AdminUserActionResponse` | Top up or set exact user credit balance. |
| `POST` | `/api/v1/admin/users/{id}/delete` | None | `{"status": "success"}` | Permanently delete user and cascade purge resumes/analyses. |
| `GET/POST` | `/api/v1/admin/reports` | Status query / update body | Support reports list / status update | Support ticket triage with full JSON technical context. |
| `GET/POST` | `/api/v1/admin/config` | Config body on POST | `AdminConfigResponse` | View and dynamically edit live `SiteConfig` values. |
| `GET` | `/api/v1/admin/activity` | Query `limit`, `offset` | `AdminActivityLogResponse` | Immutable audit log of administrative actions with diffs. |
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
2. **Persistent Storage with SQLite & Local File Cache**: User accounts, credit balances, analysis histories, structured master resumes, issue reports, admin logs, and dynamic configurations are persisted via SQLAlchemy in `data/rolecraft.db`. Uploaded files are cached locally in `uploads/` with automated 24-hour background cleanup.
3. **Curated Technology Allow-List**: JD parser uses a regex-matching list of known technologies (Languages, Frameworks, Databases) to achieve maximum accuracy without complex vector search.
4. **Majority-Vote Skill Matching**: Skill phrases are decomposed and filtered of stop-words (e.g. `experience`, `proficiency`). A skill is considered "matched" if at least 50% of its technical content words are present in the resume.
5. **Parallel Section Reviews**: Section reviews are processed concurrently using a `ThreadPoolExecutor` instead of sequentially.
6. **In-Place Paragraph Patches**: Rather than recreating DOCX files, the `PatchService` targets and rewrites only the body paragraph runs inside user-approved sections.
7. **Universal Resume Design**: All role-routing, section-classification, and keyword constants are centralised in `app/constants/resume_keywords.py`. This single source of truth is imported by `section_detector`, `rewrite_service`, `patch_service`, and `resume_analysis_workflow` — eliminating duplicated lists and making it trivial to extend support for new industries or professions.
8. **Analyze-Only Credit Billing**: Only `POST /resume/analyze` deducts 1 credit. All subsequent actions (section rewriting, cover letter generation, tailoring, DOCX patching) are credit-free but auth-protected.
9. **Dual Billing Architecture (30-Day Pass vs Recurring Subscriptions)**:
   - **One-Off 30-Day Pass**: Generated via Razorpay standard Orders API (`client.order.create`). Zero auto-debit mandates, 100% UPI/credit card compatibility. Sets `plan_expires_at = utcnow + 30 days`. Gracefully reverts to `free` plan upon expiration.
   - **Monthly Auto-Renew**: Generated via Razorpay Subscriptions API (`client.subscription.create`) with recurring auto-debit on the same day every month.
   - **Instant Checkout Verification (`POST /api/v1/payment/verify`)**: Direct client signature verification enables instant tier activation and credit top-up without waiting for webhook delays.
10. **Container-Bundled Chrome Extension Distribution**: The LinkedIn Job Copier extension source files are bundled inside `backend/app/extension_src/`, guaranteeing zero-downtime, reliable ZIP generation inside Docker containers without host mount dependencies.
11. **Admin User Deletion & Cascade Decoupling**: Permanent user deletion purges user records, analyses, master resumes, and tailored resumes, while setting `user_id = NULL` on support tickets to preserve platform audit history without integrity violations.

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
- [x] Authentication (JWT-based credentials + Google Login flow).
- [x] SQLite database + SQLAlchemy integration to persist user context and analysis history.
- [x] Dynamic Daily Target Goal & Progress Tracking in headers.
- [x] Profile Modal contact info management and base resume/cover letter template tracking.
- [x] High-fidelity PDF document rendering via headless LibreOffice compiler.
- [x] Secure Webhook Redeployment System (immune to SSH action connection timeouts).
- [x] **Universal Resume Support** (Phase 6):
  - Shared constants module (`app/constants/resume_keywords.py`) — 260 role titles, 75 soft skill phrases
  - 4-signal section heading detection (Heading style, map match, ALL-CAPS, Bold-Normal)
  - SECTION_NAME_MAP expanded to 190+ variants across all industries
  - Multi-domain JD technology list: Healthcare, Finance, Marketing, HR, Legal, Construction, Education
  - Two-pass JD keyword extraction (frequency-based + soft skill allow-list)
  - Universal experience sub-section routing for all professions (not just software)
  - Preserve-verbatim gate for Additional Information, Languages, Declarations
  - Rule 2 metadata heuristic tightened (no false-positives on short bullets)
  - 3x duplication of role keyword lists eliminated via shared constants
- [x] **AI Resume Builder & Structured Data Engine** (Phase 7):
  - Normalized `StructuredResume` Pydantic schema and `StructuredResumeModel` database persistence
  - AI Resume Parser service for DOCX and PDF uploads (`pymupdf` + `python-docx`)
  - Low-confidence unparsed field tracking & red highlight/warning UI
  - Dedicated `/resume-builder` page with interactive section editor (Add/Remove/Reorder)
  - 3 ATS single-column templates ("Clean Classic", "Modern Professional", "Executive Profile")
  - Profile photo upload and embedding engine for Executive Profile template
  - Programmatic DOCX template renderer (`ATSTemplateRenderer`) & PDF streaming
- [x] **Workspace UX Overhaul** (Phase 8a):
  - 3-step visual stepper (Upload → Analyze → Tailor) on workspace page
  - Quality meter bar with dynamic color based on analysis score
  - Feature highlight cards replacing inline instructions
  - Session persistence via `localStorage` — all workspace state (JD, analysis result, rewrites) survives page refresh
  - Removed duplicate Paste button and Quick-Start demo role chips for a cleaner UI
  - Fixed cover letter download route collision in FastAPI (reordered routes + explicit alias)
- [x] **Analyze-Only Credit System** (Phase 8b):
  - 1 credit per `/resume/analyze` call only
  - 15 free credits on signup (unchanged from `FREE_TIER_CREDITS` default)
  - All other AI ops (rewrite, batch-rewrite, cover letter, AI tailor, apply) are now credit-free
  - Backend safeguards: all non-analyze endpoints still require auth + model timeout/token limits
  - `verify_premium_permission` simplified to auth-only; new `verify_auth_only` helper added
  - Frontend credit guards removed from all non-analyze handlers (8 locations)
- [x] **SMTP Email Notifications**:
  - Support ticket email notifications via Gmail SMTP App Password
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SUPPORT_NOTIFICATION_EMAIL` env vars configured on VPS
- [x] **Mobile Bottom Navigation Bar** (`mobile_bottom_nav.tsx`):
  - Sticky bottom nav with Home, Resume Builder, History, and Profile icons for mobile viewports
  - Replaces hamburger menu on small screens for improved one-thumb ergonomics
- [x] **LinkedIn Job Copier Chrome Extension** (Phase 10a):
  - `linkedin-job-copier/` directory: Manifest V3 extension with `content.js`, `styles.css`, branded icons, README
  - One-click copy of LinkedIn job title, company, location, URL, and full description to clipboard
  - Multi-strategy DOM extraction (6/5/4/5 fallback strategies per field) — resilient to LinkedIn DOM changes
  - SPA-aware navigation detection (URL polling + History API + MutationObserver)
  - **Backend gating** (`backend/app/api/v1/extension.py`): JWT-authenticated download endpoint; 403 returned for `free` plan users
  - **Frontend `ExtensionModal`** (`frontend/src/components/extension_modal.tsx`): Premium download UI with step-by-step Chrome setup guide
  - Extension promoted in pricing cards (`subscription_modal.tsx`) and FAQ (`faq_section.tsx`)
  - Profile dropdown and workspace banner trigger the extension modal
  - `frontend/src/lib/api.ts` updated with `getExtensionStatus()` and `downloadExtensionZip()` helpers
- [x] **Admin Dashboard & Platform Control Center** (Phase 11):
  - Isolated admin control portal at `admin.rolecraft.tech` (`/xrc-control/`) with Two-Layer Security (`is_admin` JWT + PIN secret token)
  - Real-time financial metrics, estimated MRR, interactive 30-day registration curves, and AI usage breakdown
  - User management table with quick action drawer for credits and subscription plan adjustments
  - Support ticket triage dashboard with full JSON technical context
  - Dynamic `SiteConfig` live editing and immutable `AdminActivityLog`
- [x] **Dual Billing Modes, Instant Verification & User Lifecycle** (Phase 12):
  - Dual billing UI: One-Off 30-Day Pass (Orders API) vs Monthly Auto-Renew (Subscriptions API)
  - Instant client signature checkout verification endpoint (`POST /api/v1/payment/verify`)
  - Auto-expiration enforcement via `plan_expires_at` column in SQLite database
  - Admin permanent user deletion with cascade cleanup (`POST /api/v1/admin/users/{id}/delete`)
  - Auto-grant tier credits on admin plan change (Pro: 200, Elite: 400)
  - In-container bundled Chrome extension files (`backend/app/extension_src/`) for reliable ZIP distribution

## Features Intentionally Postponed
- **PostgreSQL**: Kept as a future database option for production scale.
- **Redis + Celery**: Async background task runners deferred.

---

## Remaining Roadmap

### Phase 5 - Authentication, Persistence & Webhook CD (Completed)
- [x] Authentication (JWT-based standard credentials + Google Login verification flow)
- [x] Local SQLite database & SQLAlchemy ORM
- [x] **Analyze-Only Credit System**: 1 credit per analyze. 15 free credits on signup. All other AI operations (rewrite, cover letter, batch-tailor, AI tailor) are credit-free but still auth-protected.
- [x] IP rate limits & guest analysis protection
- [x] Webhook-based secure redeployment automation
- [x] Docker + Docker Compose setups
- [x] Production SMTP Email Support Ticket Routing
- [x] Mobile-Friendly First Responsive UX & Touch Targets (iPhone Pro/Max, Samsung Ultra)
- [x] Analyze-Only Credit System (1 credit / analyze, free rewrites)
- [x] ADHD Daily Application Goal Tracking (main page progress card, inline stepper, sticky header pill, profile toggle switch)
- [x] Mobile Bottom Navigation Bar (sticky bottom nav replacing hamburger on small viewports)
- [ ] PostgreSQL integration
- [ ] Redis + Background jobs (Celery/RQ for long-running AI queries)

### Phase 10 - LinkedIn Job Copier Extension & Premium Distribution (Completed)
- [x] Chrome Extension (Manifest V3): one-click LinkedIn job detail extractor
- [x] Multi-strategy DOM fallback system (resilient to LinkedIn DOM changes)
- [x] SPA navigation detection (URL poll + History API + MutationObserver)
- [x] Auto-expand "Show more" before extraction
- [x] Backend gated download endpoint (Pro/Elite only, JWT auth, returns ZIP)
- [x] `ExtensionModal` frontend component with setup guide
- [x] Pricing cards and FAQ updated to promote the extension
- [x] Branded extension icons (16×16, 48×48, 128×128)

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
| `JWT_SECRET` | String | `"..."` | JWT signing secret. |
| `GOOGLE_CLIENT_ID` | String | `""` | Google OAuth client ID. |
| `FREE_TIER_CREDITS` | Integer | `15` | Starting credits for new users. |
| `VIP_CREDITS` | Integer | `300` | Credits for VIP email addresses. |
| `VIP_EMAILS` | JSON list | `[...]` | Email addresses with VIP credit top-ups. |
| `RAZORPAY_KEY_ID` | String | `""` | Razorpay API key for billing. |
| `RAZORPAY_KEY_SECRET` | String | `""` | Razorpay secret for billing. |
| `SMTP_HOST` | String | `""` | SMTP server hostname (e.g. `smtp.gmail.com`). |
| `SMTP_PORT` | Integer | `587` | SMTP port (587 for TLS). |
| `SMTP_USE_TLS` | Boolean | `true` | Enable STARTTLS for SMTP. |
| `SMTP_USER` | String | `""` | SMTP login username / email. |
| `SMTP_PASSWORD` | String | `""` | SMTP password or App Password. |
| `SMTP_FROM_EMAIL` | String | `"noreply@rolecraft.tech"` | From address on notification emails. |
| `SUPPORT_NOTIFICATION_EMAIL` | String | `""` | Destination for support ticket notifications. |
| `ADMIN_SECRET` | String | `""` | Secret PIN for Layer 2 Admin Portal authentication. |

---

## Admin Dashboard & Platform Control Center

Hosted at `admin.rolecraft.tech` (mapped internally to `/xrc-control/`), the Admin Control Center provides superusers and designated platform administrators with:
1. **Financial & Growth Metrics**: Real-time user counts, Pro/Elite subscriber breakdown, and MRR (₹) estimation.
2. **Interactive Usage Visualizations**: 30-day signup curves and AI feature usage (Analyses vs Tailoring).
3. **User Management & Action Drawer**: Paginated user search, credit balance top-ups/overrides, subscription tier switches, and admin role assignments.
4. **Support Ticket Triage**: Centralized feedback and bug report dashboard with full JSON request context inspection and instant status transitions (`open` / `investigating` / `resolved`).
5. **Dynamic Global Config Editor**: Real-time updates for initial free tier credits, tier allowances, and VIP whitelist emails with zero server reboots.
6. **Immutable Audit Trail**: `AdminActivityLog` tracking all administrative actions with timestamp, admin email, and before/after state diffs.
7. **Two-Layer Security Architecture**: Enforces `is_admin == True` via standard JWT, followed by an `ADMIN_SECRET` PIN gate that issues an ephemeral `X-Admin-Token` (30m TTL) with rate-limiting lockout protection.

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