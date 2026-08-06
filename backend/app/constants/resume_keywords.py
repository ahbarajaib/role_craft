"""Shared resume keyword constants.

Single source of truth for role titles, section names, and routing logic
used across section_detector, rewrite_service, patch_service, and
resume_analysis_workflow. Centralising here eliminates 3-way duplication
and makes it trivial to extend coverage for new domains.
"""

# ── Universal role title keywords ─────────────────────────────────────────────
#
# Used to:
#   1. Detect job-entry sub-headings inside experience sections
#   2. Recognise metadata lines (job title / company / date rows) in the patcher
#   3. Route sections to the experience AI rewriter
#
# Covers: Technology · Logistics · Sales · Finance · Healthcare · Legal ·
#         Education · Hospitality · Marketing · HR · Construction · Media ·
#         Retail · Customer Service · Administration · and more.

UNIVERSAL_ROLE_TITLES: list[str] = [
    # ── Technology ──────────────────────────────────────────────────────────
    "developer", "engineer", "architect", "programmer", "devops", "sre",
    "data scientist", "data engineer", "data analyst", "ml engineer",
    "ai engineer", "software", "backend", "frontend", "fullstack",
    "full-stack", "full stack", "mobile", "embedded", "qa", "tester",
    "security engineer", "cloud engineer", "platform engineer",
    # ── Management / Leadership ──────────────────────────────────────────────
    "manager", "director", "head", "lead", "vp", "vice president",
    "president", "ceo", "cto", "coo", "cfo", "chief", "officer",
    "founder", "co-founder", "partner", "principal", "chairman",
    "superintendent", "controller",
    # ── Design / Creative ───────────────────────────────────────────────────
    "designer", "ux", "ui", "graphic", "visual", "creative", "art director",
    "animator", "illustrator", "photographer", "videographer", "editor",
    "copywriter", "content writer", "journalist", "reporter",
    # ── Sales / Business Development ────────────────────────────────────────
    "sales", "account executive", "account manager", "business development",
    "sales representative", "sales manager", "regional manager",
    "territory manager", "inside sales", "outside sales", "pre-sales",
    "relationship manager", "client manager", "key account",
    # ── Finance / Accounting ─────────────────────────────────────────────────
    "accountant", "auditor", "financial analyst", "finance manager",
    "treasurer", "bookkeeper", "tax", "payroll", "budget analyst",
    "investment analyst", "portfolio manager", "credit analyst",
    "risk analyst", "compliance", "actuary", "banker", "underwriter",
    # ── Customer Service / Support ───────────────────────────────────────────
    "customer service", "customer success", "support", "helpdesk",
    "service representative", "client service", "service advisor",
    "call center", "contact center", "customer care",
    # ── Operations / Administration ──────────────────────────────────────────
    "operations", "administrator", "admin", "coordinator", "assistant",
    "office manager", "executive assistant", "receptionist", "secretary",
    "clerk", "operator", "associate", "specialist", "advisor", "analyst",
    "supervisor", "inspector", "planner", "scheduler",
    # ── Logistics / Supply Chain / Customs ──────────────────────────────────
    "logistics", "supply chain", "procurement", "purchasing", "buyer",
    "customs", "customs clearance", "freight", "shipping", "warehouse",
    "distribution", "inventory", "import", "export", "trade",
    "transportation", "fleet", "dispatch", "driver", "courier",
    "cargo", "forwarding",
    # ── Marketing / Communications ───────────────────────────────────────────
    "marketing", "digital marketing", "brand manager", "product manager",
    "product owner", "growth", "seo", "sem", "social media", "pr",
    "public relations", "communications", "campaign", "media buyer",
    "e-commerce", "ecommerce",
    # ── HR / Talent / Training ───────────────────────────────────────────────
    "hr", "human resources", "recruiter", "talent acquisition",
    "talent management", "people", "learning", "training", "l&d",
    "organizational", "hrbp", "compensation", "benefits",
    # ── Healthcare / Medical ─────────────────────────────────────────────────
    "nurse", "doctor", "physician", "pharmacist", "dentist",
    "therapist", "surgeon", "radiologist", "laboratory", "pathologist",
    "midwife", "paramedic", "technician", "medical", "clinical",
    "healthcare", "patient", "ward",
    # ── Legal ────────────────────────────────────────────────────────────────
    "lawyer", "attorney", "counsel", "solicitor", "paralegal",
    "legal", "compliance officer", "contract",
    # ── Education / Research ─────────────────────────────────────────────────
    "teacher", "professor", "lecturer", "tutor", "instructor",
    "principal", "dean", "researcher", "scientist", "postdoc",
    "curriculum", "academic", "faculty",
    # ── Engineering (non-software) ───────────────────────────────────────────
    "civil engineer", "mechanical engineer", "electrical engineer",
    "structural", "chemical", "environmental", "industrial",
    "project engineer", "site engineer", "field engineer",
    "construction", "autocad", "bim",
    # ── Hospitality / Food & Beverage ───────────────────────────────────────
    "chef", "cook", "kitchen", "restaurant", "hotel", "hospitality",
    "bartender", "waiter", "waitress", "barista", "catering",
    "housekeeping", "front desk", "concierge",
    # ── Retail / eCommerce ───────────────────────────────────────────────────
    "retail", "store manager", "store", "cashier", "merchandiser",
    "visual merchandiser", "category manager", "buyer",
    # ── IT General ───────────────────────────────────────────────────────────
    "it", "systems", "network", "infrastructure", "it manager",
    "it support", "helpdesk", "sysadmin", "database",
    # ── Intern / Freelance / Consultant ─────────────────────────────────────
    "intern", "freelance", "consultant", "contractor", "freelancer",
    "self-employed",
]

# ── Section names that should ALWAYS be preserved verbatim (never rewritten) ──
#
# These sections contain factual personal data, legal info, or references
# that should never be altered by the AI under any circumstances.

PRESERVE_VERBATIM_SECTIONS: list[str] = [
    "education",
    "references",
    "additional",          # "Additional Information", "Additional Details"
    "languages",           # Personal language abilities (not programming languages)
    "interests",
    "hobbies",
    "declarations",
    "personal",
    "driving license",
    "publications",        # Keep exact citation format
]

# ── Skills section title keywords (for routing to skills rewriter) ─────────────

SKILLS_SECTION_KEYWORDS: list[str] = [
    "skill", "competenc", "proficienc", "expertise", "tech stack",
    "technologies", "tools", "software", "platforms", "abilities",
    "technical", "qualifications", "specialization", "specialties",
    "areas of expertise", "core capabilities",
]

# ── Summary section title keywords (for routing to summary rewriter) ──────────

SUMMARY_SECTION_KEYWORDS: list[str] = [
    "summary", "profile", "about", "objective", "bio", "overview",
    "introduction", "personal statement", "career overview", "highlights",
]

# ── Experience section routing keywords ───────────────────────────────────────
#
# A section title containing ANY of these words is treated as an experience
# section (and its job-entry children are routed to the experience rewriter).

EXPERIENCE_SECTION_KEYWORDS: list[str] = [
    "experience", "employment", "history", "work", "job",
    "career", "positions", "roles", "assignments", "appointments",
]
