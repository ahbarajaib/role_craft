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

                       ▼

               OpenAI / Claude / Gemini

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

- DOCX
- PDF (read-only initially)

Responsibilities:

- Extract sections
- Preserve formatting metadata
- Build internal document model

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
- Authentication
- Billing
- Team workspaces

---

## Project Rule

Large language models never directly modify DOCX files.

LLMs only generate structured text changes.

Python is solely responsible for updating documents while preserving formatting.