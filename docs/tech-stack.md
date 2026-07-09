# Technology Stack

## Philosophy

This project prioritizes:

- Production-ready architecture
- Open-source tooling where practical
- Python ecosystem best practices
- Skills that are valuable for backend and AI engineering jobs
- Easy deployment on a self-hosted VPS

---

# Backend

- Python 3.14
- FastAPI
- Uvicorn

---

# Dependency Management

- uv

---

# Data Validation

- Pydantic v2

---

# ORM

- SQLAlchemy 2.x

---

# Database

- PostgreSQL

---

# AI

Primary Framework

- PydanticAI

LLM Providers

- OpenAI
- Anthropic Claude
- Google Gemini

The application should support multiple providers behind a common interface.

---

# Document Processing

DOCX

- python-docx

PDF Reading

- PyMuPDF

Optional Parsing

- docx2python

XML

- lxml

---

# Storage

Development

- Local filesystem

Production

- MinIO (S3 compatible)

---

# Background Jobs

- Redis
- Celery

---

# Authentication

- JWT
- Passlib

---

# Logging

- Loguru

---

# HTTP Client

- httpx

---

# Testing

- pytest
- pytest-asyncio

---

# Code Quality

- Ruff
- Black
- mypy
- pre-commit

---

# Deployment

- Docker
- Docker Compose
- Ubuntu VPS
- Caddy

---

# Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

---

# Guiding Principles

Prefer mature libraries over trendy libraries.

Avoid unnecessary dependencies.

Keep third-party packages to a minimum.

Always prefer maintainability over cleverness.