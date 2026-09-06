# Coding Standards & Engineering Guidelines

This document defines the architectural and code quality conventions for **RoleCraft**. Adherence ensures consistency, testability, and clarity for both developers and AI assistants.

---

## 1. Clean Architecture & Decoupling

RoleCraft strictly enforces separation of concerns:

```
FastAPI Routers (app/api/v1/)
       │
       ▼
Service Layer (app/services/)
       │
  ┌────┴───────────────────────────┐
  ▼                                ▼
AI Layer (app/ai/)        Parsers & Comparators (app/parsers/, app/comparators/)
```

1. **API Routers (`app/api/v1/`)**:
   - Only validate request payloads (Pydantic), authenticate users/admins, and call services.
   - Never write business logic, database queries, or raw prompt engineering inside route functions.
2. **Service Layer (`app/services/`)**:
   - Pure Python business logic orchestrating parsers, AI providers, and database sessions.
   - Receives dependencies via constructor injection or function arguments for simple test mocking.
3. **AI Layer (`app/ai/`)**:
   - Contains prompt templates and OpenAI API interaction.
   - Always requests Pydantic-structured outputs (`client.responses.parse(text_format=...)`).
   - Never hallucinate experience, dates, or skills.
4. **Parsers & Comparators (`app/parsers/`, `app/comparators/`)**:
   - Pure deterministic string parsing and matching. Zero network, database, or LLM dependencies.
5. **Constants Layer (`app/constants/resume_keywords.py`)**:
   - Single source of truth for all role titles, section names, and routing keywords. Never duplicate keyword lists across files.

---

## 2. Python Backend Standards

- **Runtime**: Python 3.13+ managed with `uv`.
- **Type Hints**: Mandatory on all function signatures, parameters, and return types.
- **Data Validation**: Use Pydantic v2 schemas (`app/schemas/`) with strict typing.
- **Database & Models**:
  - SQLAlchemy 2.0 style (`Mapped[T]`, `mapped_column`).
  - Add schema migrations to `init_db()` in `app/core/database.py` for SQLite column additions (`PRAGMA table_info`).
- **Error Handling**:
  - Never swallow exceptions silently.
  - Raise domain exceptions inheriting from `AppError` (`app/core/exceptions.py`), such as `BadRequestError`, `NotFoundError`, or `UnauthorizedError`.
  - Caught globally by `app/factory.py` to return standardized JSON error envelopes:
    ```json
    { "error": { "code": "BAD_REQUEST", "detail": "..." } }
    ```
- **Logging**:
  - Use `from loguru import logger`. Never use `print()`.
  - Bind context where appropriate (`logger.bind(request_id=...)`).

---

## 3. Frontend & UI Standards

- **Framework**: Next.js 15 (App Router) with React 19 and TypeScript.
- **Styling**: Tailwind CSS. Avoid ad-hoc inline styles. Use existing design tokens and color scales.
- **Icons**: Use `lucide-react` icons exclusively for visual consistency.
- **API Communication**:
  - Consumer features call helpers in `frontend/src/lib/api.ts`.
  - Admin features call helpers in `frontend/src/lib/admin-api.ts`.
  - Tokens and preferences use `localStorage`.
- **Mobile Ergonomics**:
  - Design mobile-first. Ensure all tap targets are at least 44px × 44px.
  - Use safe-area utility classes (`pb-safe`, `pt-safe`, `mb-safe`) for notch and home indicator clearance.
  - Use `useIsMobile()` hook when desktop and mobile layouts require distinct interaction models.

---

## 4. Testing & Verification

- Backend tests live in `backend/tests/` using `pytest`.
- Always override external network dependencies (OpenAI, Razorpay) using `dependency_overrides` or unittest `MagicMock`.
- Run frontend type check and production builds before deploying:
  ```bash
  cd frontend && npm run build
  ```
- Run backend test suite before committing:
  ```bash
  cd backend && uv run pytest
  ```
