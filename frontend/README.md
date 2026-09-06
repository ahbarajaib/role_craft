# RoleCraft Frontend

Next.js 15 (App Router) web application for **RoleCraft** (`rolecraft.tech`), featuring client-side resume tailoring, Master Resume builder, and an isolated administrative control center.

---

## Key Features & Pages

- **Workspace (`src/app/page.tsx`)**:
  - 3-step guided flow: Upload DOCX/PDF → AI Gap Analysis → Tailor & Patch DOCX.
  - Side-by-side iterative AI section rewrite modal with visual diff highlights and undo history.
  - Daily application goal tracker pill and stepper.
- **AI Resume Builder (`src/app/resume-builder/page.tsx`)**:
  - Interactive section editor (reorder, add, remove, and live edit).
  - 3 single-column ATS templates (Clean Classic, Modern Professional, Executive Profile).
  - Profile photo upload and export to ATS-friendly DOCX and PDF.
- **Admin Control Center (`src/app/xrc-control/`)**:
  - **Login (`/xrc-control/login`)**: Two-layer security: standard superuser login + Layer 2 Secret PIN gate.
  - **Dashboard (`/xrc-control/dashboard`)**: Financial metrics (estimated MRR, Pro/Elite counts), 30-day registration charts, and feature usage analytics.
  - **User Management (`/xrc-control/dashboard/users`)**: Paginated user search, credit adjustment drawers, plan changes, and permanent account deletion with cascade protection.
  - **Support Tickets (`/xrc-control/dashboard/reports`)**: Centralized bug report triage with JSON technical context viewer.
  - **Live Configuration (`/xrc-control/dashboard/config`)**: Real-time adjustment of free tier credits, tier quotas, and VIP email whitelist.
  - **Audit Logs (`/xrc-control/dashboard/activity`)**: Immutable log of administrative actions.

---

## Tech Stack & Architecture

- **Framework**: Next.js 15 (App Router) with React 19
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Visualizations**: Recharts (admin analytics)
- **API Clients**:
  - `src/lib/api.ts` — Consumer API methods (auth, documents, resume analysis, payment checkout, extension download)
  - `src/lib/admin-api.ts` — Admin API methods (PIN verification, stats, user CRUD, config, logs)

---

## Environment Variables

Configure in `.env.local` for development or in your hosting provider (Vercel):

```env
# Backend API Base URL (defaults to http://localhost:8000 for local dev)
NEXT_PUBLIC_API_URL="https://api.rolecraft.tech"

# Google Developer OAuth Client ID (optional, for Google login)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=""

# Razorpay Live/Test Key ID (for client-side checkout popup)
NEXT_PUBLIC_RAZORPAY_KEY_ID=""
```

---

## Development

```bash
# Install dependencies
npm install

# Start local dev server (port 3000)
npm run dev

# Run type check and production build
npm run build
```
