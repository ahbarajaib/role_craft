# Production Deployment Guide

This document describes how to deploy, manage, and scale the **RoleCraft** application in a production environment.

---

## 1. Docker Deployment

We containerize both the FastAPI backend and Next.js frontend to ensure consistency across staging and production environments.

### Dockerfile (Backend)
Save the following as `backend/Dockerfile`:
```dockerfile
FROM python:3.13-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Dockerfile (Frontend)
Save the following as `frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ENV NEXT_PUBLIC_API_URL=https://api.rolecraft.tech
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
RUN npm ci --only=production

EXPOSE 3000
CMD ["npm", "run", "start"]
```

> **Note**: In our live production environment, the Next.js frontend is hosted serverless on **Vercel** (`rolecraft.tech`), while the FastAPI backend runs in Docker on the Ubuntu VPS (`api.rolecraft.tech`). Refer to [`DEPLOYMENT.md`](../DEPLOYMENT.md) for the active production deployment runbook.

---

## 2. Environment Variables

Create a secure `.env` file in production with the following configurations.

### Backend Configurations
| Variable | Value/Type | Purpose |
| :--- | :--- | :--- |
| `APP_NAME` | `RoleCraft` | Branding name |
| `ENVIRONMENT` | `production` | Enables/disables swagger docs |
| `DEBUG` | `false` | Disables debug stacktraces |
| `LOG_LEVEL` | `INFO` | Central loguru level |
| `ALLOWED_ORIGINS` | `["https://rolecraft.tech","https://admin.rolecraft.tech"]` | CORS restrict policy |
| `UPLOAD_DIR` | `/data/uploads` | Mounted volume folder |
| `MAX_UPLOAD_SIZE_BYTES`| `5242880` | 5 MB upload boundary |
| `GENERATED_CLEANUP_HOURS`| `24` | Automated cleanup interval |
| `OPENAI_API_KEY` | `sk-proj-...` | Production OpenAI API Key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Production LLM model |
| `OPENAI_TIMEOUT_SECONDS` | `30.0` | API query timeout limit |
| `JWT_SECRET` | `...` | Secret key for JWT signing |
| `ADMIN_SECRET` | `...` | Secret PIN for Admin Portal Layer 2 |
| `RAZORPAY_KEY_ID` | `rzp_live_...` | Razorpay billing key |
| `RAZORPAY_KEY_SECRET` | `...` | Razorpay billing secret |

---

## 3. Production Startup (Docker Compose)

Save the following as `docker-compose.yml` in the root:
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    restart: always
    environment:
      - ENVIRONMENT=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - ADMIN_SECRET=${ADMIN_SECRET}
      - UPLOAD_DIR=/data/uploads
      - GENERATED_CLEANUP_HOURS=24
      - ALLOWED_ORIGINS=["https://rolecraft.tech","https://admin.rolecraft.tech"]
    volumes:
      - uploads_data:/data/uploads
      - ./data:/data
    ports:
      - "8000:8000"

volumes:
  uploads_data:
```

---

## 4. Reverse Proxy Example (Nginx)

Nginx sits at the edge, handles SSL termination, and routes requests to the respective frontend/backend containers.

```nginx
# HTTPS Frontend (if self-hosted instead of Vercel)
server {
    listen 443 ssl http2;
    server_name rolecraft.tech;

    ssl_certificate /etc/letsencrypt/live/rolecraft.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rolecraft.tech/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTPS Backend API
server {
    listen 443 ssl http2;
    server_name api.rolecraft.tech;

    ssl_certificate /etc/letsencrypt/live/api.rolecraft.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.rolecraft.tech/privkey.pem;

    # Restrict maximum upload sizes at reverse-proxy level to match application configs
    client_max_body_size 5M;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-ID $request_id; # Correlates client-proxy tracing
    }
}
```

---

## 5. Database & Volume Backup Strategy

The persistent SQLite database is stored on the host at `./data/rolecraft.db` (mounted into `/data/rolecraft.db` in Docker), and temporary uploads are at `./uploads` / `/data/uploads`.

### Backup Policy
1. **SQLite Database Backup**:
   Use SQLite's safe online backup or a daily snapshot:
   ```bash
   # Safe online backup while container is running
   sqlite3 /opt/role_craft/data/rolecraft.db ".backup '/backups/rolecraft_$(date +%F).db'"
   ```
2. **Automated cleanup retention**:
   Uploaded files older than 24 hours are automatically pruned by the backend. Retain daily DB backups for 30 days:
   ```bash
   find /backups/ -name "rolecraft_*.db" -mtime +30 -delete
   ```

---

## 6. Admin Dashboard Subdomain (`admin.rolecraft.tech`) Setup

The admin control panel is hosted completely isolated from normal users at `admin.rolecraft.tech`.

### 1. DNS Record
- Add an **`A` record** in your domain DNS:
  - Host: `admin`
  - IP: Your VPS IP (same as `rolecraft.tech`)

### 2. Environment Variable
Generate a strong secret key:
```bash
openssl rand -hex 16
```
Add to `backend/.env`:
```env
ADMIN_SECRET="your-generated-secret"
```

### 3. Caddy or Nginx Reverse Proxy
**Caddy (`/etc/caddy/Caddyfile`)**:
```caddy
admin.rolecraft.tech {
    header X-Robots-Tag "noindex, nofollow"
    rewrite * /xrc-control{uri}
    reverse_proxy localhost:3000
}
```

**Nginx**:
```nginx
server {
    server_name admin.rolecraft.tech;
    add_header X-Robots-Tag "noindex, nofollow" always;
    location / {
        rewrite ^(.*)$ /xrc-control$1 break;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
```

### 4. Bootstrap Superuser
```bash
cd backend
python scripts/bootstrap_admin.py
```
