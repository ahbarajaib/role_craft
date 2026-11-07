# Architecture

## Overview

The application follows a modular, production-ready architecture.

```
                    Client

                       │

                       ▼

                FastAPI REST API

                       │

     ┌─────────────────┼─────────────────┐

     ▼                 ▼                 ▼

Document Service   AI Service     Resume Service

     ▼                 ▼                 ▼

Document Parser   LLM Providers   Resume Patcher

        ▼                              ▼

 Constants Layer              OpenAI / Claude / Gemini

                       ▼

                PostgreSQL + Redis

                       ▼

                 File Storage
```

---

## Layers

### API Layer

Responsible for:

- HTTP endpoints
- Authentication
- Validation
- Returning responses

No business logic.

---

### Service Layer

Contains business logic.

Examples:

- Resume analysis
- Resume optimization
- ATS scoring
- Keyword extraction
- Resume patching

---

### AI Layer

Responsible only for communicating with LLMs.

Responsibilities:

- Prompt construction
- Structured outputs
- Model routing
- Retry logic

No database access.

---

### Parser Layer

Responsible for reading documents.

Supported formats:

- DOCX (full paragraph + table extraction, bold-run detection)
- PDF (read-only)

Responsibilities:

- Extract paragraphs and detect bold runs (`is_bold` field on `ParsedParagraph`)
- Preserve formatting metadata
- Build internal document model
- Parse job descriptions with multi-domain technology and soft skill extraction

---

### Constants Layer

`app/constants/resume_keywords.py` — single source of truth for all keyword constants.

Contains:

- `UNIVERSAL_ROLE_TITLES` (260 entries) — job titles across all industries used for experience sub-section routing
- `PRESERVE_VERBATIM_SECTIONS` — sections that must never be rewritten (Additional Information, Languages, Declarations, etc.)
- `SKILLS_SECTION_KEYWORDS` — section title variants routed to the skills rewriter
- `SUMMARY_SECTION_KEYWORDS` — section title variants routed to the summary rewriter
- `EXPERIENCE_SECTION_KEYWORDS` — experience container section title keywords

Imported by `section_detector`, `rewrite_service`, `patch_service`, and `resume_analysis_workflow`. Eliminates duplicated lists across services.

---

### Resume Layer

Responsible for modifying documents.

Responsibilities:

- Apply approved changes
- Preserve formatting
- Generate updated DOCX

---

### Storage Layer

Stores:

- Uploaded resumes
- Generated resumes
- AI responses
- Version history

---

## Design Principles

- Clean Architecture
- SOLID
- Dependency Injection where appropriate
- Async-first
- Type hints everywhere
- Small focused modules
- Testability

---

## Future Components

- Background workers
- Resume versioning
- Multiple templates
- Multi-model AI routing
- ATS scoring engine
- ~~Authentication~~ ✅ Done
- ~~Billing~~ ✅ Done (Razorpay Pro/Elite, credit system)
- Team workspaces

---

## Project Rules

1. Large language models never directly modify DOCX files.
   LLMs only generate structured text changes. Python is solely responsible for updating documents while preserving formatting.

2. Keyword constants are never duplicated across services.
   All role titles, section name variants, and routing keywords live in `app/constants/resume_keywords.py` and are imported where needed.

3. Preserve-verbatim sections are never AI-rewritten.
   Sections in `PRESERVE_VERBATIM_SECTIONS` (Languages, Additional Information, Declarations, References, Interests, Hobbies, Driving License) are passed through unchanged at every pipeline layer.

4. Section heading detection uses all available signals.
   `_is_heading()` checks four independent signals: Word Heading style, SECTION_NAME_MAP text match, ALL-CAPS heuristic, and Bold-Normal run detection. This ensures compatibility with all major real-world DOCX template formats.

5. **Analyze-Only Credit Billing**.
   Only `POST /resume/analyze` deducts 1 credit (`deduct_analysis_credit`). All other AI endpoints (rewrite, batch-rewrite, cover letter, tailor) are credit-free. They are protected by authentication and OpenAI model/timeout limits to prevent token abuse, but do not consume user credits. Free users start with 15 credits (`FREE_TIER_CREDITS = 15`). Elite plan users have unlimited analyzes.

6. **Admin Dashboard Undiscoverability & Two-Layer Security**.
   The admin portal is hosted at `admin.rolecraft.tech` (internally mapped to `/xrc-control`) and completely isolated from the consumer frontend with `robots.txt` disallow and `X-Robots-Tag: noindex, nofollow`. Authentication requires two distinct gates: (1) Standard Bearer JWT verification where `user.is_admin == True`, and (2) Secret Admin PIN verification against server-configured `ADMIN_SECRET` generating a short-lived in-memory session token (`X-Admin-Token`, 30m TTL) with 5-attempt rate-limiting lockout. All admin modifications are recorded in an immutable `AdminActivityLog` audit table.

7. **Dual Billing Engine & Instant Checkout Verification**.
   Users can select between a **One-Off 30-Day Pass** (Razorpay Standard Orders via `client.order.create`, zero recurring auto-debit, 100% UPI/card support) and a **Recurring Monthly Subscription** (Razorpay Subscriptions via `client.subscription.create`). Instant verification (`POST /api/v1/payment/verify`) verifies the cryptographic payment signature on checkout completion and immediately activates the plan with full tier credits (Pro: 200, Elite: 400). Automatic pass expiration is enforced gracefully via `plan_expires_at` in the user authentication dependency (`get_current_user`).

8. **Admin User Deletion Safety & Decoupled Cascade**.
   Permanent deletion of user accounts via `POST /api/v1/admin/users/{id}/delete` enforces self-deletion protection (admin cannot delete their own account). It performs a complete cascade cleanup of user analysis history, master resumes, and tailored resumes, while setting `user_id = NULL` on issue reports to preserve support audit trails.