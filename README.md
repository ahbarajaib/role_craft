# Resume AI

AI-powered resume optimisation platform. Upload a DOCX resume, provide a job description, and receive a tailored resume that preserves your original formatting.

---

## Project Status

> **Milestone 1 – Project Skeleton**
> FastAPI application structure is in place.
> Resume logic, AI, database, authentication, and background workers are not yet implemented.

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
│   └── app/
│       ├── factory.py          Application factory (create_app)
│       ├── core/
│       │   ├── config.py       Pydantic-Settings configuration
│       │   ├── logging.py      Loguru setup
│       │   └── exceptions.py   Custom exceptions + handlers
│       ├── api/
│       │   ├── router.py       Top-level API router
│       │   └── v1/
│       │       └── health.py   GET /api/v1/health
│       ├── middleware/
│       │   └── request_id.py   X-Request-ID middleware
│       └── dependencies/
│           └── common.py       Shared dependency factories
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
| `GET` | `/docs` | Swagger UI (development only) |
| `GET` | `/redoc` | ReDoc (development only) |

### Health check example

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
