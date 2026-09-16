# Tasks

## In Progress

- [ ] **30-Day Monetization Campaign** (started Sep 6 2026)
  - [ ] Day 1: Update LinkedIn headline and publish first personal post about RoleCraft
  - [ ] Day 1–2: Set up Instagram account `@rolecraft.tech` (or `@rolecraft.ai`)
  - [ ] Day 3–5: Post in r/IndianWorkplace, r/developersIndia, Quora (offer free usage)
  - [ ] Day 6–7: Follow up with free users, collect first testimonial
  - [ ] Day 8–14: Record and post 5 short-form videos (screen + face-cam Reels)
  - [ ] Day 15: Add testimonial(s) to website hero/social proof section
  - [ ] Day 16–18: LinkedIn DM outreach to 20 "Open to Work" profiles per day
  - [ ] Day 19–21: Post first explicit paid-plan pitch post with testimonial
  - [ ] Day 22–30: Run Instagram Ads (₹100/day, Bengaluru/Mumbai/Hyderabad targeting)

## Completed

- [x] Phase 1 – FastAPI Foundation
- [x] Phase 2 – Resume Understanding (Section Detector, JD Parser)
- [x] Phase 3 – Analysis Engine (Comparator, AI Reviewer, Rewriter, Patcher)
- [x] Phase 4 – Frontend (Next.js, Upload, Analysis, Rewrite, DOCX patching, Cover Letter)
- [x] Phase 5 – Authentication & Rate Limits (JWT, Google Login, SQLite, Webhook CD, Docker)
- [x] Phase 6 – Universal Resume Support (constants module, 190+ section variants, multi-domain JD)
- [x] Phase 7 – AI Resume Builder & Structured Data Engine (StructuredResume, ATS templates, PDF)
- [x] Phase 8 – UX Polish, Credit Redesign & SMTP (workspace stepper, analyze-only credit, email)
- [x] Phase 9 – Mobile-First Responsiveness (safe-area insets, touch targets, tab switcher, goal tracking)
- [x] Phase 10 – LinkedIn Job Copier Chrome Extension (backend-gated distribution, ExtensionModal, FAQ)
- [x] Phase 11 – Admin Dashboard & Platform Control Center (2-layer PIN auth, metrics, user management, support triage, live config, audit logs)
- [x] Phase 12 – Dual Billing Architecture & Admin User Deletion (One-Off 30-Day Pass [Orders API] + Recurring Subscriptions [Subscriptions API], instant checkout verification `/api/v1/payment/verify`, auto-expiration `plan_expires_at`, admin user deletion cascade `/api/v1/admin/users/{id}/delete`, auto tier credits, container-bundled extension files)
- [x] Phase 13 – Telemetry, Funnel Tracking & Crash Monitoring (Microsoft Clarity user identity linking, core funnel milestone events [upload, analyze, auto-tailor, download], and zero-overhead Sentry crash monitoring across Next.js and FastAPI)
- [x] Phase 14 – Indeed Job Title Copier Chrome Extension & Extension Feature Gate Architecture (`extension_config.py` single-source-of-truth, dynamic per-feature ZIP bundling, dual `ExtensionModal` cards, Elite-only Indeed gate, `docs/extension-feature-gates.md`)
- [x] Mobile Bottom Navigation Bar (`mobile_bottom_nav.tsx`)
- [x] Razorpay instant payment verification & auto tier credit allocation

## Backlog

- [x] Add testimonials / social proof to landing page hero section (avatar stack + 4.9★ rating + pull-quote added to hero; full testimonial cards below pricing)
- [ ] PostgreSQL migration (replace SQLite)
- [ ] Redis + Celery for background AI jobs
- [ ] Chrome Web Store submission (public extension listing)
- [ ] Multi-language resume support (Arabic, French, German)
- [ ] Resume version history & visual diff viewer
- [ ] Team workspaces & recruiter collaboration
- [ ] ATS scoring engine (per-company simulation)
- [ ] Multi-model AI routing (Claude / Gemini fallback)
