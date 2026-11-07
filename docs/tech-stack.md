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

- Python 3.13+
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

Current (production)

- SQLite (via SQLAlchemy 2.x)

Planned

- PostgreSQL

---

# AI

Primary Integration

- OpenAI SDK (Responses API with Pydantic structured outputs)

Planned

- PydanticAI (multi-provider abstraction)

LLM Providers (current)

- OpenAI (gpt-4o-mini)

LLM Providers (planned)

- Anthropic Claude
- Google Gemini

The application is designed to support multiple providers behind a common interface.

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

- Docker & Docker Compose
- Ubuntu VPS (FastAPI Backend + SQLite)
- Nginx & Certbot (Host Reverse Proxy & SSL Termination)
- Vercel (Frontend Next.js Serverless Hosting)

---

# Billing & Payments

- Razorpay Python SDK
- Standard Orders API (`client.order.create` for One-Off 30-Day Pass)
- Subscriptions API (`client.subscription.create` for Monthly Auto-Renew)
- Cryptographic Signature Verification (`razorpay.utility.verify_payment_signature` / `verify_subscription_payment_signature`)
- Webhooks (`subscription.charged`, `subscription.cancelled`)

---

# Admin Portal (`/xrc-control/`)

- Dedicated Isolated Routes in Next.js
- Lucide React Icons
- Recharts (Interactive 30-day analytics charts)
- Two-Layer PIN Verification & ephemeral session tokens (`X-Admin-Token`, 30m TTL)
- Audit Logging (`AdminActivityLog`) & Live Configuration (`SiteConfig`)

---

# Frontend

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Lucide React

---

# Telemetry, Analytics & Monitoring

- **Microsoft Clarity**: Free unlimited session replays, click & scroll heatmaps, dead click & rage click alerts, and custom funnel events (`trackEvent`)
- **Vercel Analytics**: Privacy-friendly traffic, referral, and top page analytics
- **Sentry**: Free-tier crash reporting, unhandled 500 error detection, and frontend exception capture (FastAPI via `sentry-sdk` + Next.js client via `@sentry/browser`)

---

# Guiding Principles

Prefer mature libraries over trendy libraries.

Avoid unnecessary dependencies.

Keep third-party packages to a minimum.

Always prefer maintainability over cleverness.