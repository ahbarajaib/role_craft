# Roadmap

## Phase 1 - Foundation ✅

- [x] FastAPI foundation
- [x] Configuration
- [x] Logging
- [x] Upload endpoint
- [x] DOCX parser (+ `is_bold` run detection)

---

## Phase 2 - Resume Understanding ✅

- [x] Section Detector (4-signal heading detection)
- [x] SECTION_NAME_MAP (190+ section name variants)
- [x] Job Description Parser (multi-domain keyword + soft skill extraction)

---

## Phase 3 - Analysis Engine ✅

- [x] Comparator Engine
- [x] AI Resume Reviewer
- [x] Targeted Section Rewriter
- [x] DOCX Patch Engine

---

## Phase 4 - Frontend ✅

- [x] Next.js foundation
- [x] Upload page
- [x] Analysis results
- [x] Section review
- [x] Section rewrite
- [x] DOCX patching
- [x] 1-Click Auto-Tailor (keywords + job title)
- [x] Tailoring History Modal (date/week/day navigation, bar chart)
- [x] Cover Letter generator + copy / download
- [x] Compact floating action dock (bottom-right)

---

## Phase 5 - Authentication & Rate Limits ✅

- [x] Authentication (Standard Credentials + Google Login)
- [x] Rate Limiting & Usage Caps (SQLite database backend)
- [x] Docker deployment
- [x] Production Hardening (structured logging, request correlation, input validation, auto file cleanup, friendly error retries)
- [x] Secure Webhook Redeployment System
- [ ] PostgreSQL integration
- [ ] Redis + Background jobs (Celery/RQ for long-running AI queries)

---

## Phase 6 - Universal Resume Support ✅

- [x] Shared constants module (`app/constants/resume_keywords.py`)
  - 260 universal role titles across all industries
  - 75 domain soft skill phrases
  - Expanded skills / summary / experience section keywords
  - Preserve-verbatim section registry
- [x] Bold-Normal heading detection (Signal 4) in `section_detector.py`
- [x] 50+ new SECTION_NAME_MAP entries (Core Competencies, Key Achievements,
  Career Highlights, Areas of Expertise, Additional Information, Declarations...)
- [x] Multi-domain technology list in JD parser (Healthcare, Finance, Marketing,
  HR, Legal, Construction, Education, Customer Service)
- [x] Soft skill phrase extraction in JD parser (two-pass keyword extraction)
- [x] Universal experience sub-section routing in all three pipeline services
- [x] Preserve-verbatim gate for Additional Information / Languages / Declarations
- [x] Rule 2 heuristic tightened in patch_service (no false-positives on short bullets)
- [x] Eliminated 3x duplication of role keyword lists across services

---

## Phase 7 - AI Resume Builder & Structured Data Engine ✅

- [x] Normalized `StructuredResume` Pydantic schema and SQLite model
- [x] AI Resume Parser for DOCX and PDF uploads (`pymupdf` + `python-docx`)
- [x] Field-level parse confidence tracking & red highlight/warning UI for unparsed fields
- [x] Dedicated `/resume-builder` page with section editor (Add/Remove/Reorder sections)
- [x] 3 Single-Column ATS Resume Templates:
  - Clean Classic (Times New Roman, 100% ATS safe)
  - Modern Professional (Calibri, navy dividers)
  - Executive Profile (Aptos/Calibri, blue accents, optional profile photo)
- [x] Profile photo upload and embedding engine
- [x] Programmatic DOCX template renderer (`ATSTemplateRenderer`) & PDF conversion

---

## Phase 8 - UX Polish, Credit Redesign & Email ✅

- [x] **Workspace UX Overhaul**:
  - 3-step visual stepper (Upload → Analyze → Tailor)
  - Quality meter bar with dynamic score-based color
  - Feature highlight cards (cleaner onboarding)
  - Session state persistence via `localStorage` (survives refresh)
  - Removed duplicate Paste button & Quick-Start demo roles
  - Fixed FastAPI cover letter download route collision
- [x] **Analyze-Only Credit System**:
  - 1 credit charged per `/resume/analyze` only
  - 15 free credits on signup (`FREE_TIER_CREDITS = 15`)
  - All other AI features (rewrite, batch-rewrite, cover letter, tailor) are **credit-free**
  - Backend auth guards remain on all AI endpoints (no unlimited token abuse)
  - `verify_premium_permission` simplified to auth-only; `verify_auth_only` helper added
  - Frontend credit guards removed from 8 non-analyze handler locations
- [x] **SMTP Email Notifications**:
  - Gmail SMTP App Password integration
  - Support ticket notifications sent to admin email
  - `SMTP_*` and `SUPPORT_NOTIFICATION_EMAIL` env vars added to VPS

---

## Phase 9 - Mobile-First & Cross-Device Responsiveness ✅

- [x] **Viewport & Safe-Area Inset Support**:
  - Added `viewport-fit=cover` and dynamic theme colors in Next.js metadata.
  - Added safe area padding utilities (`pb-safe`, `pt-safe`, `pl-safe`, `pr-safe`, `mb-safe`) for iPhone Dynamic Island, home indicators, and Android notches.
- [x] **Mobile Breakpoint Hook (`useIsMobile`)**:
  - SSR-safe media query listener for responsive switching.
- [x] **Mobile Navigation & Menus**:
  - Responsive header with slide-down overlay navigation on mobile.
  - Bottom sheet profile and account dropdowns on small screens with swipe-away animations.
- [x] **Workspace Tab Switcher**:
  - `📋 Setup` vs `📊 Results` tab switcher on mobile viewport (`lg:hidden`).
  - Auto-switches from Setup to Results upon completing analysis.
- [x] **Touch Target Optimization & Ergonomics**:
  - Apple HIG minimum 44px touch targets on interactive controls (`touch-action: manipulation`, tap highlight removal).
  - Tap-to-upload prompt for touchscreens vs drag-and-drop for desktop.
  - Floating action buttons repositioned and cushioned above device home indicators.
- [x] **ADHD Daily Application Goal Tracking & Visibility Switch**:
  - Prominent motivating daily goal card (`X of Y tailored today`, progress bar, dopamine cues) on Landing & Workspace.
  - Interactive `+ / −` stepper on main page to adjust target on the fly without modal diving.
  - Sticky header mini goal tracker pill (`🎯 3/5 [====>  ]`) linked to activity analytics.
  - Dedicated on/off toggle switch in profile menu (desktop dropdown & mobile bottom sheet) persisting preference to `localStorage`.
- [x] **Mobile Bottom Navigation Bar** (`mobile_bottom_nav.tsx`):
  - Sticky bottom nav for Home, Resume Builder, History, and Profile on small viewports.
  - Replaces hamburger menu for one-thumb ergonomics on iOS/Android.

---

## Phase 10 - LinkedIn Job Copier Extension & Premium Distribution ✅

- [x] **Chrome Extension** (`linkedin-job-copier/`, Manifest V3):
  - One-click extraction of job title, company, location, URL, and full description from LinkedIn
  - Multi-strategy DOM fallback (6/5/4/5 strategies per field) — resilient to LinkedIn DOM changes
  - SPA-aware navigation (URL polling + History API interception + MutationObserver)
  - Auto-expands "Show more" / "See more" before extraction
  - Visual button states: Extracting → Copied! / Extraction Failed
  - Branded icons: 16×16, 48×48, 128×128
- [x] **Backend Gating** (`backend/app/api/v1/extension.py`):
  - `GET /api/v1/extension/status` — returns `{available, plan_required}` for any authenticated user
  - `GET /api/v1/extension/download` — streams `linkedin-job-copier.zip` to Pro/Elite only; returns 403 for free tier
  - JWT-authenticated; plan check via `user.plan_type` + `user.subscription_status`
- [x] **Frontend `ExtensionModal`** (`frontend/src/components/extension_modal.tsx`):
  - Premium gated download UI with step-by-step Chrome setup guide
  - Triggered from profile dropdown (desktop & mobile) and workspace banner
- [x] **Pricing & FAQ Integration**:
  - Extension listed as a feature bullet in Pro & Elite pricing cards (`subscription_modal.tsx`)
  - Dedicated FAQ entry added (`faq_section.tsx`)
- [x] **`api.ts` helpers**: `getExtensionStatus()` and `downloadExtensionZip()`

---

## Phase 11 - Admin Dashboard & Platform Control Center ✅

- [x] **Undiscoverable Dedicated Admin Portal** (`admin.rolecraft.tech` / `/xrc-control`):
  - Completely isolated light UI with Stripe/Vercel design principles
  - Zero discoverability from consumer marketing site; disallowed in `robots.txt` and `X-Robots-Tag: noindex, nofollow`
  - Served via Next.js route `/xrc-control/` with Caddy/Nginx reverse proxy rewrite
- [x] **Two-Layer Security Architecture**:
  - Layer 1: Regular JWT authentication verifying `user.is_admin == True`
  - Layer 2: Admin Secret PIN verification (`ADMIN_SECRET`), in-memory session token with 30-min TTL
  - Rate limiting (5 failed attempts locks out IP/email for 15 minutes)
- [x] **Real-Time Analytics & Financial Metrics**:
  - 4 high-level stat cards: Total Users, Pro Subscribers, Elite Subscribers, Estimated MRR (₹)
  - 30-day interactive daily signups chart
  - 30-day AI feature usage breakdown (Analyses vs Tailoring)
- [x] **Full User Management Table & Slide-Over Drawer**:
  - Paginated user list with instant search and plan/role filters
  - Detailed profile viewer with master resume filenames and missing skills frequency
  - Credit management: Set exact amount or +add credits with immediate balance update
  - Subscription plan changer: Free / Pro / Elite and Active / Inactive status
  - Admin promotion/demotion toggle with confirmation protection
- [x] **Support Ticket Triage System**:
  - Centralized issue reporting triage with expandable details and formatted JSON technical context
  - Inline status update dropdowns (open, investigating, resolved)
  - Deprecated background SMTP emails for zero failure points
- [x] **Live Global Configuration Editor**:
  - Hot-updating `SiteConfig` parameters (`FREE_TIER_CREDITS`, `PRO_CREDITS`, `ELITE_CREDITS`, `VIP_EMAILS`)
  - Tag manager for VIP email lists with automatic instant persistence
- [x] **Immutable Audit Trail (`AdminActivityLog`)**:
  - Audit logging of every administrative credit grant, plan change, config edit, and login with JSON before/after diffs

---

## Phase 12 - Dual Billing Modes, Instant Verification & Account Lifecycle ✅

- [x] **Dual Billing Architecture**:
  - Choice between **One-Off 30-Day Pass** (Razorpay Standard Orders API) and **Monthly Auto-Renew** (Razorpay Subscriptions API)
  - Zero auto-debit friction and 100% UPI/card support on one-off passes
  - Automated pass expiration via `plan_expires_at` column in SQLite database
  - Graceful reversion to free plan upon pass expiration handled in `get_current_user` auth dependency
- [x] **Instant Checkout Verification Endpoint (`POST /api/v1/payment/verify`)**:
  - Immediate client-side signature verification after Razorpay modal completes
  - Activates plan and grants full tier credits (Pro: 200, Elite: 400) in milliseconds without waiting for webhook latencies
- [x] **Admin Permanent User Deletion (`POST /api/v1/admin/users/{id}/delete`)**:
  - Cascade purge of user analyses, master resumes, and tailored resumes
  - Decouples `IssueReport.user_id = NULL` to retain support history without foreign key violations
  - Self-deletion guard preventing admins from deleting their own active account
- [x] **Automatic Tier Credit Top-Ups on Admin Upgrade**:
  - Upgrading users from Free to Pro/Elite automatically sets their credits to the tier quota (200 / 400 credits)
- [x] **In-Container Extension Bundling**:
  - Bundled `linkedin-job-copier/` files directly into `backend/app/extension_src/` for 100% reliable ZIP streaming in Docker

---

## Phase 14 - Indeed Job Title Copier & Extension Feature Gate Architecture ✅

- [x] **Indeed Job Title Copier** (`indeed-job-copier/`, Manifest V3):
  - One-click "Copy Job Title" button injected on Indeed job pages (`viewjob`, `jobs/view`, `rc/clk` URLs)
  - Indeed blue color scheme; multi-URL pattern matching
  - **Elite-only** access

- [x] **Extension Feature Gate System** (`backend/app/core/extension_config.py`):
  - Single-source-of-truth config dict: `EXTENSION_FEATURE_GATES`, `EXTENSION_FEATURE_LABELS`, `EXTENSION_FEATURE_DIRS`, `EXTENSION_ZIP_FOLDER_NAMES`
  - To change a gate (e.g. open Indeed to Pro): edit one dict, restart server — no endpoint code changes
  - `get_accessible_features(plan_type, subscription_status)` helper returns `{linkedin: bool, indeed: bool}`
  - Dynamic ZIP builder includes only unlocked feature folders

- [x] **Backend `/extension/status` & `/extension/download` updated**:
  - `/status` now returns `features: {linkedin, indeed}` and `feature_labels`
  - `/download` builds dynamic multi-extension ZIP; filename reflects content (`rolecraft-extensions.zip` vs single)

- [x] **Frontend `ExtensionModal` rewritten**:
  - Dual download cards (LinkedIn + Indeed) with per-card Unlocked/Locked badges
  - Single download action; plan flags derived client-side from `user.plan_type`

- [x] **`docs/extension-feature-gates.md`** added — step-by-step guide for changing or adding extension feature gates

---

## Phase 15 - Planned & Future Improvements


- [ ] PostgreSQL + Redis migration
- [ ] Multi-language resume support (Arabic, French, German...)
- [ ] Resume version history & visual diff viewer
- [ ] Team workspaces & recruiter collaboration
- [ ] ATS scoring engine (per-company ATS simulation)
- [ ] Multi-model AI routing (Claude / Gemini fallback)
- [ ] Chrome Web Store submission (public extension distribution)

