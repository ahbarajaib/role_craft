# RoleCraft Master Environment Variables Reference

This document is the **single source of truth** for all environment variables used by RoleCraft across both Frontend (Vercel & Local) and Backend (VPS & Local).

If your VPS server is ever lost, re-provisioned, or migrated, you can recreate your entire production environment in **under 2 minutes** using the templates in this document.

---

## 1. Quick File Map & Locations

| Component | Environment | File Path / Location | How It's Loaded |
| :--- | :--- | :--- | :--- |
| **Backend** | Local Dev | `backend/.env` | Loaded by `pydantic-settings` via `python-dotenv` |
| **Backend** | Production (VPS) | `/opt/role_craft/.env` | Read by `docker-compose.yml` and mounted into `/app/.env` |
| **Frontend** | Local Dev | `frontend/.env.local` | Loaded automatically by Next.js |
| **Frontend** | Production (Vercel)| **Vercel Project Settings** → **Environment Variables** | Injected into serverless Next.js bundle at build time |

---

## 2. Backend Environment Variables Reference

### Comprehensive Variable Directory

| Variable Name | Required? | Default / Example Value | Description & Usage |
| :--- | :---: | :--- | :--- |
| `APP_NAME` | No | `"RoleCraft"` | Application display name for logs and OpenAPI |
| `APP_VERSION` | No | `"0.1.0"` | Application semantic version |
| `ENVIRONMENT` | **Yes** | `production` (VPS) / `development` (Local) | Disables `/docs` and debug traces in production |
| `DEBUG` | **Yes** | `false` (VPS) / `true` (Local) | Controls verbose error stack traces |
| `LOG_LEVEL` | No | `INFO` | Loguru log level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `API_PREFIX` | No | `/api/v1` | URL prefix for all REST API endpoints |
| `ALLOWED_ORIGINS` | **Yes** | `["https://rolecraft.tech","https://admin.rolecraft.tech"]` | JSON array of permitted CORS origins |
| `HOST` | No | `0.0.0.0` | Bind IP address for Uvicorn server |
| `PORT` | No | `8000` | Port for Uvicorn server inside the container |
| `UPLOAD_DIR` | No | `uploads` | Directory for temporary uploaded DOCX files |
| `MAX_UPLOAD_SIZE_BYTES` | No | `5242880` | Maximum file upload size in bytes (5 MB) |
| `GENERATED_CLEANUP_HOURS` | No | `24` | Hours before temporary generated files are cleaned |
| `OPENAI_API_KEY` | **Yes** | `sk-proj-...` | Production OpenAI API Key for resume analysis & tailoring |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | LLM model name used for analysis and rewrites |
| `OPENAI_TIMEOUT_SECONDS`| No | `120.0` | Maximum timeout in seconds for AI completions |
| `GOOGLE_CLIENT_ID` | **Yes** | `1096884021839-...apps.googleusercontent.com` | Google Cloud OAuth Client ID for 1-click login |
| `JWT_SECRET` | **Yes** | `[Strong 32+ char secret]` | Secret key used to sign and verify user JWT tokens |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `JWT_EXPIRY_MINUTES` | No | `10080` | JWT token validity in minutes (10080 = 7 days) |
| `RAZORPAY_KEY_ID` | **Yes** | `rzp_live_...` | Razorpay API key ID for payment processing |
| `RAZORPAY_KEY_SECRET` | **Yes** | `[Razorpay Secret]` | Razorpay API secret key for payment verification |
| `RAZORPAY_PLAN_PRO_ID` | **Yes** | `plan_...` | Razorpay Plan ID for monthly Pro subscription |
| `RAZORPAY_PLAN_ELITE_ID`| **Yes** | `plan_...` | Razorpay Plan ID for monthly Elite subscription |
| `RAZORPAY_WEBHOOK_SECRET`| No | `[Webhook Secret]` | Webhook secret for recurring subscription renewal webhooks |
| `FREE_TIER_CREDITS` | No | `15` | Default AI credits given to new free users upon signup |
| `VIP_CREDITS` | No | `300` | Credits allocated to VIP email accounts |
| `PRO_CREDITS` | No | `200` | Credits allocated to Pro plan purchasers |
| `ELITE_CREDITS` | No | `400` | Credits allocated to Elite plan purchasers |
| `VIP_EMAILS` | No | `["ahbarajaib@gmail.com","absarajaib@gmail.com"]` | JSON array of admin/VIP emails receiving top-tier perks |
| `SMTP_HOST` | No | `smtp.gmail.com` | SMTP host for issue reports and notifications |
| `SMTP_PORT` | No | `587` | SMTP port (587 with TLS) |
| `SMTP_USER` | No | `ahbarajaib@gmail.com` | SMTP email address |
| `SMTP_PASSWORD` | No | `[App Password]` | Google App Password (16 characters, 2FA enabled) |
| `SMTP_FROM_EMAIL` | No | `noreply@rolecraft.tech` | Sender address for outbound system emails |
| `SMTP_USE_TLS` | No | `true` | Enable STARTTLS for SMTP connections |
| `SUPPORT_NOTIFICATION_EMAIL`| No | `ahbarajaib@gmail.com` | Admin email receiving user issue reports |
| `ADMIN_SECRET` | **Yes** | `[16+ char secret]` | Layer-2 PIN secret for accessing `admin.rolecraft.tech` |
| `SENTRY_DSN` | No | `https://...@o0.ingest.sentry.io/0` | Sentry DSN for backend crash and error alerts |

---

### Copy-Paste Template for VPS (`/opt/role_craft/.env`)

When setting up or restoring a VPS, copy and paste this block into `/opt/role_craft/.env`:

```env
# ─────────────────────────────────────────────────────────────
# ROLECRAFT PRODUCTION BACKEND CONFIGURATION
# Location on VPS: /opt/role_craft/.env
# Permissions: chmod 600 /opt/role_craft/.env
# ─────────────────────────────────────────────────────────────

# Application & Runtime
APP_NAME="RoleCraft"
APP_VERSION="0.1.0"
ENVIRONMENT="production"
DEBUG=false
LOG_LEVEL="INFO"
API_PREFIX="/api/v1"
ALLOWED_ORIGINS='["https://rolecraft.tech","https://www.rolecraft.tech","https://admin.rolecraft.tech"]'
HOST="0.0.0.0"
PORT=8000

# File Uploads
UPLOAD_DIR="uploads"
MAX_UPLOAD_SIZE_BYTES=5242880
GENERATED_CLEANUP_HOURS=24

# AI & OpenAI
OPENAI_API_KEY="sk-proj-your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"
OPENAI_TIMEOUT_SECONDS=120.0

# Google Authentication
GOOGLE_CLIENT_ID="1096884021839-bp7nkvebhg2d1ltt9ejc17ufrt8omi3v.apps.googleusercontent.com"

# JWT Authentication
JWT_SECRET="supersecretrolecraftkey-change-to-long-random-string"
JWT_ALGORITHM="HS256"
JWT_EXPIRY_MINUTES=10080

# Razorpay Billing
RAZORPAY_KEY_ID="rzp_live_your_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_secret"
RAZORPAY_PLAN_PRO_ID="plan_your_pro_plan_id"
RAZORPAY_PLAN_ELITE_ID="plan_your_elite_plan_id"
RAZORPAY_WEBHOOK_SECRET=""

# Credits Allocation
FREE_TIER_CREDITS=15
VIP_CREDITS=300
PRO_CREDITS=200
ELITE_CREDITS=400
VIP_EMAILS='["ahbarajaib@gmail.com","absarajaib@gmail.com"]'

# Support & Email Notifications (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USER="ahbarajaib@gmail.com"
SMTP_PASSWORD="your-gmail-app-password"
SMTP_FROM_EMAIL="noreply@rolecraft.tech"
SUPPORT_NOTIFICATION_EMAIL="ahbarajaib@gmail.com"

# Admin Dashboard (admin.rolecraft.tech / /xrc-control/)
ADMIN_SECRET="your-admin-secret-pin"

# Crash & Error Monitoring (Sentry)
SENTRY_DSN="https://51d5994f24162ec32cf028bd2eec3f72@o4510357324890112.ingest.de.sentry.io/4512043959517264"
```

---

## 3. Frontend Environment Variables Reference

### Comprehensive Variable Directory

| Variable Name | Required? | Default / Example Value | Description & Usage |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | **Yes** | `https://api.rolecraft.tech` (Prod) / `http://localhost:8000` (Local) | Base URL pointing to the FastAPI backend |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | **Yes** | `1096884021839-...apps.googleusercontent.com` | Google Cloud OAuth Client ID for Google Login button |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | **Yes** | `yef56jqa3h` | Microsoft Clarity Project ID for session replays and heatmaps |
| `NEXT_PUBLIC_SENTRY_DSN` | No | `https://eced410c...ingest.de.sentry.io/...` | Sentry DSN for client-side crash and error monitoring |

---

### Copy-Paste Template for Local Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="1096884021839-bp7nkvebhg2d1ltt9ejc17ufrt8omi3v.apps.googleusercontent.com"
NEXT_PUBLIC_CLARITY_PROJECT_ID="yef56jqa3h"
NEXT_PUBLIC_SENTRY_DSN="https://eced410c09141eae36e0b782fde10108@o4510357324890112.ingest.de.sentry.io/4512043968036944"
```

---

### Copy-Paste Template for Vercel Production Dashboard

In **Vercel** → **Project Settings** → **Environment Variables**, set these 4 keys:

1. `NEXT_PUBLIC_API_URL` = `https://api.rolecraft.tech`
2. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = `1096884021839-bp7nkvebhg2d1ltt9ejc17ufrt8omi3v.apps.googleusercontent.com`
3. `NEXT_PUBLIC_CLARITY_PROJECT_ID` = `yef56jqa3h`
4. `NEXT_PUBLIC_SENTRY_DSN` = `https://eced410c09141eae36e0b782fde10108@o4510357324890112.ingest.de.sentry.io/4512043968036944`

---

## 4. VPS Disaster Recovery Runbook

If you ever provision a new VPS or your VPS is reset:

```bash
# 1. Update OS and install Docker + Nginx
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose-v2 nginx certbot python3-certbot-nginx -y
sudo systemctl enable docker --now

# 2. Clone the repository
sudo mkdir -p /opt
cd /opt
sudo git clone https://github.com/ahbarajaib/role_craft.git
cd /opt/role_craft

# 3. Create the production environment file
sudo nano /opt/role_craft/.env
# (Paste the Backend Production Template from Section 2 above)
sudo chmod 600 /opt/role_craft/.env

# 4. Start the backend container
sudo docker compose up -d --build

# 5. Configure Nginx and SSL
sudo certbot --nginx -d api.rolecraft.tech
```
Your backend is immediately back online with all database records, authentication, payments, and Sentry monitoring intact.
