"""Job description parser.

Converts a plain-text job description into a structured ``JobDescription``
model using rule-based extraction only.  No AI, no external libraries
beyond the Python standard library.

This module is the Parser Layer for job descriptions.  It is intentionally
pure:

- Input:  str
- Output: JobDescription
- No HTTP, no services, no filesystem.
- All logic can be exercised with a plain string in a unit test.

Parsing Strategy
----------------
The parser works in two passes:

Pass 1 — Section splitting
    Scan lines top-to-bottom.  When a line matches a known section header
    pattern, subsequent lines (until the next header) are collected into
    that section's bucket.  Lines before the first header go into a
    special "preamble" bucket used for metadata extraction.

Pass 2 — Field extraction
    Metadata fields (title, company, location, etc.) are extracted from
    the preamble using small targeted patterns.
    List fields (responsibilities, skills, technologies, keywords) are
    produced by cleaning and deduplicating the collected lines.

Technology extraction uses a curated allow-list of known tech terms that
are matched against the full text, making it independent of the section
structure of a particular job posting.

Keyword extraction uses word-frequency analysis on the full text,
preferring nouns longer than four characters that appear more than once.
"""

import re

from app.schemas.job_description import JobDescription

# ── Section header patterns ───────────────────────────────────────────────────
#
# Each entry maps a regex (matched case-insensitively against a stripped
# line) to the internal bucket name it fills.  Order matters only for
# display; matching always uses the full list.

_SECTION_PATTERNS: list[tuple[str, str]] = [
    # Responsibilities
    (r"responsibilities", "responsibilities"),
    (r"what you.ll do", "responsibilities"),
    (r"^role$", "responsibilities"),
    (r"key responsibilities", "responsibilities"),
    (r"job duties", "responsibilities"),
    (r"duties", "responsibilities"),
    # Required skills
    (r"what we.re looking for", "required_skills"),
    (r"requirements?$", "required_skills"),
    (r"required skills?", "required_skills"),
    (r"qualifications?", "required_skills"),
    (r"must[- ]have", "required_skills"),
    (r"what you.ll need", "required_skills"),
    (r"you (will|must) have", "required_skills"),
    (r"minimum qualifications?", "required_skills"),
    # Preferred skills
    (r"preferred", "preferred_skills"),
    (r"nice[- ]to[- ]have", "preferred_skills"),
    (r"bonus", "preferred_skills"),
    (r"good[- ]to[- ]have", "preferred_skills"),
    (r"desired", "preferred_skills"),
    (r"plus(es)?$", "preferred_skills"),
    # Technologies (merged into technologies list)
    (r"tech(nologies|nical) stack", "technologies"),
    (r"tools? (and|&) technologies", "technologies"),
    # Benefits, perks, company info, and web page noise – collect but ignore
    (r"about (us|the (company|role|team|goodspace))", "_ignore"),
    (r"benefits?$", "_ignore"),
    (r"perks?$", "_ignore"),
    (r"what we offer", "_ignore"),
    (r"compensation", "_ignore"),
    (r"why join", "_ignore"),
    (r"job search faster", "_ignore"),
    (r"reactivate premium", "_ignore"),
    (r"messagingyou are on", "_ignore"),
    (r"people you can reach out to", "_ignore"),
    (r"meet the hiring team", "_ignore"),
    (r"job poster", "_ignore"),
    (r"show match details", "_ignore"),
]

# ── Technology allow-list ─────────────────────────────────────────────────────
#
# Matched against the full text (case-insensitive word-boundary search).
# Listed in rough category order for readability; no functional grouping.

_KNOWN_TECHNOLOGIES: list[str] = [
    # Languages
    "Python", "JavaScript", "TypeScript", "Java", "Go", "Golang", "Rust",
    "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R",
    # Web frameworks
    "FastAPI", "Django", "Flask", "Express", "NestJS", "Next.js", "React",
    "Vue", "Angular", "Svelte", "Rails",
    # Databases
    "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Elasticsearch",
    "DynamoDB", "Cassandra", "CockroachDB",
    # Cloud & infra
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible",
    "Helm", "Nginx", "Caddy",
    # CI/CD & tools
    "GitHub Actions", "GitLab CI", "Jenkins", "CircleCI",
    "Git", "Linux", "Bash",
    # AI/ML
    "PyTorch", "TensorFlow", "Scikit-learn", "Pandas", "NumPy", "LangChain",
    "OpenAI", "Anthropic", "Hugging Face",
    # Messaging & queues
    "Kafka", "RabbitMQ", "Celery", "SQS",
    # APIs & protocols
    "REST", "GraphQL", "gRPC", "WebSockets",
    # Other common tools
    "Pydantic", "SQLAlchemy", "Alembic", "pytest", "Webpack", "Vite",
    "Datadog", "Sentry", "Prometheus", "Grafana",
    # Office & Productivity
    "Microsoft Excel", "Excel", "Microsoft Word", "Word", "Microsoft PowerPoint", "PowerPoint",
    "Microsoft Outlook", "Outlook", "MS Office", "Microsoft Office", "Google Sheets", "Google Docs",
    # Enterprise, CRM & ERP
    "CRM", "ERP", "SAP", "Oracle", "Salesforce", "HubSpot", "QuickBooks", "Zoho", "Zendesk",
    "Power BI", "Tableau", "Workday", "Asana", "Jira", "Trello", "Slack", "Teams", "Notion",
    # ── Logistics, Customs & Trade ──────────────────────────────────────────
    "Bayan", "Bayan eCustoms", "eTaslim", "Customs Clearance", "Bills of Lading",
    "Cargo Release Orders", "CROs", "Freight Forwarding", "Supply Chain", "Logistics",
    "Import/Export", "Customs Declarations", "Customs Compliance", "Invoicing",
    "Incoterms", "HS Code", "Letter of Credit", "LC", "BOL", "WMS",
    # ── Healthcare / Medical ─────────────────────────────────────────────────
    "EMR", "EHR", "HIPAA", "Epic", "Cerner", "Meditech", "HL7", "FHIR",
    "ICD-10", "CPT", "Medical Coding", "Clinical Documentation", "Patient Care",
    "PACS", "LIMS", "Pharmacy", "PIS",
    # ── Finance / Accounting ─────────────────────────────────────────────────
    "Tally", "Tally ERP", "QuickBooks", "GAAP", "IFRS", "Bloomberg",
    "Reuters", "P&L", "Balance Sheet", "Cash Flow", "Financial Statements",
    "Financial Modeling", "Variance Analysis", "FP&A", "Budgeting",
    "Cost Analysis", "Audit", "Internal Audit", "Risk Management",
    "Treasury", "AML", "KYC", "FactSet", "Capital IQ", "Bloomberg Terminal",
    # ── Marketing / Digital ──────────────────────────────────────────────────
    "Google Analytics", "GA4", "Google Ads", "Meta Ads", "Facebook Ads",
    "SEMrush", "Ahrefs", "Moz", "Mailchimp", "Klaviyo", "Marketo",
    "HubSpot Marketing", "Pardot", "A/B Testing", "Conversion Rate Optimization",
    "CRO", "SEO", "SEM", "PPC", "Email Marketing", "Content Marketing",
    "Social Media Marketing", "Instagram", "LinkedIn Marketing",
    "Hootsuite", "Buffer", "Sprout Social", "Canva", "Adobe Creative Suite",
    "Adobe Photoshop", "Adobe Illustrator", "Adobe InDesign", "Figma",
    # ── HR / Talent / People ─────────────────────────────────────────────────
    "HRMS", "HRIS", "SAP SuccessFactors", "BambooHR", "Greenhouse",
    "Lever", "Workday HCM", "ADP", "Paylocity", "Kronos", "iCIMS",
    "Applicant Tracking System", "ATS", "Performance Management",
    "Succession Planning", "Compensation & Benefits", "Onboarding",
    # ── Legal ────────────────────────────────────────────────────────────────
    "LexisNexis", "Westlaw", "Due Diligence", "Contract Review",
    "Regulatory Compliance", "Litigation", "Legal Research",
    "Case Management", "CLM", "Contract Lifecycle Management",
    # ── Construction / Engineering (non-software) ────────────────────────────
    "AutoCAD", "Revit", "BIM", "PMP", "Primavera P6", "MS Project",
    "AUTOCAD", "Autodesk", "Civil 3D", "STAAD", "ETABS", "SAP2000",
    "QGIS", "ArcGIS",
    # ── Education / eLearning ────────────────────────────────────────────────
    "Canvas", "Blackboard", "Moodle", "Google Classroom", "LMS",
    "Articulate Storyline", "Lectora",
    # ── Customer Service / Support ───────────────────────────────────────────
    "Zendesk", "Freshdesk", "Intercom", "ServiceNow", "Salesforce Service Cloud",
    "Zoho Desk", "Freshservice",
]

# Pre-compile tech patterns once for performance.
_TECH_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(rf"\b{re.escape(tech)}\b", re.IGNORECASE), tech)
    for tech in _KNOWN_TECHNOLOGIES
]

# ── Employment-type keywords ──────────────────────────────────────────────────

_EMPLOYMENT_TYPE_PATTERNS: list[tuple[str, str]] = [
    (r"full[- ]time", "Full-time"),
    (r"part[- ]time", "Part-time"),
    (r"\bcontract\b", "Contract"),
    (r"\bfreelance\b", "Freelance"),
    (r"\binternship\b", "Internship"),
    (r"\btemporary\b", "Temporary"),
]

# Words to strip from bullet lines before adding to a list field.
_BULLET_PREFIX = re.compile(r"^[\s•\-–—*·▪▸►✓✔→]+")

# Experience pattern: "3+ years", "5 years", "senior level", etc.
_EXPERIENCE_PATTERN = re.compile(
    r"(\d+\+?\s+years?|senior|mid[- ]?level|junior|entry[- ]?level|lead)",
    re.IGNORECASE,
)


# ── Public API ────────────────────────────────────────────────────────────────


def parse_job_description(text: str) -> JobDescription:
    """Convert raw job description text into a structured ``JobDescription``.

    The function never raises; missing information is represented as empty
    strings or empty lists so callers always receive a complete model.
    """
    lines = _split_lines(text)
    buckets = _split_into_buckets(lines)
    preamble = buckets.get("preamble", [])

    return JobDescription(
        title=_extract_title(preamble, lines),
        company=_extract_company(preamble, text),
        location=_extract_location(preamble, text),
        employment_type=_extract_employment_type(text),
        experience_required=_extract_experience(text),
        responsibilities=_clean_list(buckets.get("responsibilities", [])),
        required_skills=_clean_list(buckets.get("required_skills", [])),
        preferred_skills=_clean_list(buckets.get("preferred_skills", [])),
        technologies=_extract_technologies(text),
        keywords=_extract_keywords(text, buckets),
        raw_text=text,
    )


# ── Section splitter ──────────────────────────────────────────────────────────


def _split_lines(text: str) -> list[str]:
    """Normalise line endings and return non-blank lines."""
    return [line.strip() for line in text.splitlines()]


def _split_into_buckets(lines: list[str]) -> dict[str, list[str]]:
    """Assign each line to a named bucket based on section headers.

    Lines before the first recognised header go into "preamble".
    Lines under an ``_ignore`` header are discarded.
    """
    buckets: dict[str, list[str]] = {"preamble": []}
    current = "preamble"

    for line in lines:
        if not line:
            continue
        # Drop standalone scraper/AI noise lines without switching section state
        if _NOISE_TITLE_REGEX.search(line):
            continue
        matched = _match_section_header(line)
        if matched:
            current = matched
            if current not in buckets:
                buckets[current] = []
        elif current != "_ignore":
            buckets.setdefault(current, []).append(line)

    return buckets


def _match_section_header(line: str) -> str | None:
    """Return the bucket name if the line is a known section header, else None.

    A line qualifies as a header only when it is short (≤ 60 chars) and
    all its words are either title-cased, uppercase, or common particles.
    This avoids treating a body sentence that happens to contain the word
    "requirements" as a header.
    """
    if len(line) > 60:
        return None
    stripped = line.strip(":").strip()
    for pattern, bucket in _SECTION_PATTERNS:
        if re.search(pattern, stripped, re.IGNORECASE):
            return bucket
    return None


# ── List field helpers ────────────────────────────────────────────────────────


def _clean_list(lines: list[str]) -> list[str]:
    """Strip bullet characters, deduplicate, and drop very short items."""
    seen: set[str] = set()
    result: list[str] = []
    for line in lines:
        clean = _BULLET_PREFIX.sub("", line).strip()
        # Skip header echoes (the heading line itself gets captured)
        if len(clean) < 3:
            continue
        key = clean.lower()
        if key not in seen:
            seen.add(key)
            result.append(clean)
    return result


# ── Metadata extractors ───────────────────────────────────────────────────────

_GENERIC_TITLE_HEADERS: frozenset[str] = frozenset({
    "full job description", "job description", "about the role", "overview",
    "job summary", "description", "about us", "position overview", "role summary",
    "job title", "details", "role details", "careers", "position description", "about the position",
    "about the job", "job search faster", "target role", "unknown title", "job details",
    "responsibilities", "requirements", "qualifications", "benefits", "what you'll do", "what you will do",
    "company", "location", "job type", "employment type", "workplace type", "salary", "compensation",
    "key responsibilities", "skills", "experience", "what we offer", "who we are", "about"
})

_NOISE_TITLE_REGEX: re.Pattern[str] = re.compile(
    r"(company logo for|logo for|^logo\b|\breposted\b|over \d+ people|promoted by|responses managed|"
    r"cancel anytime|reactivate premium|messagingyou are on|navigating to|followers|members who share|"
    r"show match details|people you can reach out to|meet the hiring team|job search faster|about the company|"
    r"software development|employees|"
    r"use ai to|assess how you fit|assess your fit|see how you fit|see how you compare|see how you match|"
    r"evaluate your fit|evaluate how you fit|how you match|am i a good fit|are you a good fit|ai assessment|"
    r"fit assessment|job match|match insights|your profile and resume match|get ai insights|tailor your resume|"
    r"benefits found in job post)",
    re.IGNORECASE
)


def _is_invalid_title(text: str) -> bool:
    if not text:
        return True
    s = text.strip()
    if len(s) < 3 or len(s) > 120:
        return True
    lower = s.lower().rstrip(":").strip()
    if lower in _GENERIC_TITLE_HEADERS:
        return True
    if _NOISE_TITLE_REGEX.search(lower):
        return True
    if re.match(r"^(?:company|location|job\s*type|employment\s*type|workplace\s*type|job\s*description|description|about\s*the\s*role|about\s*the\s*job|about\s*us)$", lower):
        return True
    if re.match(r"^(?:hybrid|remote|on-site|onsite|work from home|wfh|in-office)$", lower):
        return True
    if re.match(r"^(?:full-time|part-time|contract|temporary|internship|volunteer|permanent|freelance)$", lower):
        return True
    return bool(s.startswith(("•", "-", "*", "–", "—")))


def _extract_title(preamble: list[str], lines: list[str] | None = None) -> str:
    """Return the most likely job title from the preamble or full lines.

    Skips generic header phrases and scraper noise (e.g. 'Company logo for...', 'Over 100 people applied',
    'Use AI to assess how you fit').
    """
    all_lines = preamble + (lines or [])

    # 1. Look for explicit label "Job Title: <Role>" or "Role: <Role>" (single-line or multi-line)
    for i, line in enumerate(all_lines[:25]):
        t = line.strip()
        lower = t.lower().rstrip(":").strip()
        if not t or _is_invalid_title(t):
            # Check if this line is an explicit label prefix like "JOB TITLE:"
            if re.match(r"^(?:job\s*title|title|role|position)$", lower) and i + 1 < len(all_lines):
                val = all_lines[i + 1].strip()
                if not _is_invalid_title(val):
                    return val
            continue

        # Single-line match: "Job Title : <Role>" or "Job Title: <Role>" or "Role: <Role>"
        m = re.match(r"^(?:job\s*title|title|role|position)\s*[:–-]\s*(.+)$", t, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            if not _is_invalid_title(val):
                return val

    # 2. Look for sentence patterns commonly introducing the role in the body / preamble:
    # e.g. "We’re looking for a Senior Frontend Developer to build..."
    # "We are seeking a Lead Backend Engineer to join..."
    role_pattern = re.compile(
        r"(?:(?:we\s*['’]?\s*re|we\s+are|we)?\s*(?:looking\s+for|seeking|hiring)\s+(?:an?|our)?\s+|"
        r"as\s+(?:an?|our)\s+|"
        r"the\s+role\s+of\s+(?:an?|our)\s+|"
        r"the\s+position\s+of\s+(?:an?|our)\s+)"
        r"([A-Z][A-Za-z0-9 /–-]{2,60}?(?:Developer|Engineer|Architect|Manager|Lead|Designer|Specialist|Analyst|Consultant|Scientist|Director|Administrator|Programmer|Officer))"
        r"(?:[\s,.]|\bto\b|\bwho\b|\bwith\b|\bin\b|$)",
        re.IGNORECASE
    )
    for line in all_lines[:30]:
        t = line.strip()
        if not t:
            continue
        m = role_pattern.search(t)
        if m:
            cand = m.group(1).strip()
            if not _is_invalid_title(cand):
                return cand

    # 3. Prioritize finding a short line (<= 80 chars) that contains a recognised role keyword
    role_titles = [
        "developer", "engineer", "architect", "manager", "lead", "designer",
        "consultant", "analyst", "specialist", "administrator", "executive",
        "fullstack", "backend", "frontend", "devops", "sre", "scientist",
        "director", "head", "vp", "associate", "intern", "product"
    ]

    for line in all_lines[:25]:
        t = line.strip()
        if not t or _is_invalid_title(t):
            continue
        lower = t.lower()
        if len(t) <= 80 and any(r in lower for r in role_titles):
            return t

    # 4. Fallback: check preamble lines, skipping generic headers and noise
    for line in preamble:
        t = line.strip()
        if not t or _is_invalid_title(t):
            continue
        if len(t) <= 60:
            return t

    return "Target Role"


def _extract_company(preamble: list[str], text: str) -> str:
    """Return the company name if it can be identified.

    Looks for explicit "Company: <Name>" label, "Company logo for, <Name>",
    or "<Title> at <Company>" in preamble.
    """
    # Check "Company logo for, <Name>" pattern common in LinkedIn pastes
    logo_match = re.search(r"company logo for,?\s*([A-Za-z0-9 &.'-]+)", text, re.IGNORECASE)
    if logo_match:
        cand = logo_match.group(1).strip().rstrip(".,")
        if cand and len(cand) <= 40:
            return cand

    company_explicit = re.search(
        r"^\s*company\s*[:–-]?\s*\n*([^\n\r]+)", text, re.IGNORECASE | re.MULTILINE
    )
    if company_explicit:
        cand = company_explicit.group(1).strip()
        if cand and cand.lower() not in {"overview", "details", "info", "name"}:
            return cand

    # Only look for the "<Title> at <Company>" pattern in the preamble
    # (first 3 non-empty lines) to avoid body-text false positives.
    preamble_text = " ".join(preamble[:5])
    at_pattern = re.search(r"\bat\s+([A-Z][A-Za-z0-9 &.'-]{2,30})(?=[\s,.]|$)", preamble_text)
    if at_pattern:
        candidate = at_pattern.group(1).strip()
        # Reject if it starts with a lowercase continuation word
        if candidate and candidate[0].isupper() and len(candidate.split()) <= 5:
            return candidate

    return ""


def _extract_location(preamble: list[str], text: str) -> str:
    """Return location or remote status from the text."""
    # Explicit label (single line or multiline)
    location_label = re.search(
        r"^\s*location\s*[:–-]?\s*\n*([^\n\r]+)", text, re.IGNORECASE | re.MULTILINE
    )
    if location_label:
        cand = location_label.group(1).strip()
        if cand:
            return cand

    # "City, State" or "City, Country" pattern in preamble or top lines
    candidate_lines = preamble or [l.strip() for l in text.splitlines() if l.strip()][:15]
    for line in candidate_lines:
        if re.search(r"[A-Z][a-z]+,\s+[A-Z]", line):
            # Clean off LinkedIn timestamp/applicant noise like " · Reposted 2 weeks ago" or trailing mode
            cleaned = re.sub(r"\s*·\s*(?:Reposted|Over|\d+|Hybrid|Remote|On-site).*$", "", line, flags=re.IGNORECASE).strip()
            return cleaned

    # Remote variants fallback
    if re.search(r"\bfully[- ]remote\b", text, re.IGNORECASE):
        return "Remote"
    if re.search(r"\bremote\b", text, re.IGNORECASE):
        return "Remote"
    if re.search(r"\bhybrid\b", text, re.IGNORECASE):
        return "Hybrid"

    return ""


def _extract_employment_type(text: str) -> str:
    """Return the employment type if stated."""
    type_match = re.search(r"^\s*job\s+type\s*[:–-]\s*\n*([^\n]+)", text, re.IGNORECASE | re.MULTILINE)
    if type_match:
        val = type_match.group(1).strip()
        if val:
            return val

    for pattern, label in _EMPLOYMENT_TYPE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return label
    return ""


def _extract_experience(text: str) -> str:
    """Return the first experience requirement found in the text.

    Searches for the pattern only within lines that contain digits or
    explicit level words, to avoid matching the job title line which may
    start with "Senior" but is not an experience statement.
    """
    for line in text.splitlines():
        stripped = line.strip()
        # Skip very short lines and lines without a digit or level indicator
        if len(stripped) < 10:
            continue
        match = _EXPERIENCE_PATTERN.search(stripped)
        if match and re.search(r"year|experience|level", stripped, re.IGNORECASE):
            return _BULLET_PREFIX.sub("", stripped[:120]).strip()
    # Fallback: return the first match anywhere in the text
    match = _EXPERIENCE_PATTERN.search(text)
    if match:
        start = max(0, match.start() - 10)
        end = min(len(text), match.end() + 40)
        lines = text[start:end].strip().splitlines()
        return lines[0].strip() if lines else ""
    return ""


# ── Technology extraction ─────────────────────────────────────────────────────


def _extract_technologies(text: str) -> list[str]:
    """Return every known technology mentioned in the text, deduplicated."""
    found: dict[str, str] = {}  # lower → canonical form
    for pattern, canonical in _TECH_PATTERNS:
        if pattern.search(text):
            found[canonical.lower()] = canonical
    return sorted(found.values())


# ── Keyword extraction ────────────────────────────────────────────────────────

# Domain-specific soft skills and multi-word phrases matched across ALL industries.
# These supplement frequency-based keyword extraction for non-tech resumes.
_KNOWN_SOFT_SKILLS: list[str] = [
    # Universal professional skills
    "Communication", "Leadership", "Teamwork", "Problem Solving",
    "Critical Thinking", "Time Management", "Attention to Detail",
    "Analytical Skills", "Decision Making", "Conflict Resolution",
    "Stakeholder Management", "Project Management", "Change Management",
    "Strategic Planning", "Cross-functional", "Interpersonal Skills",
    "Negotiation", "Presentation Skills", "Written Communication",
    "Verbal Communication", "Adaptability", "Multitasking",
    # Sales & Business
    "Customer Relationship", "Client Management", "Business Development",
    "Pipeline Management", "Cold Calling", "Account Management",
    "Revenue Growth", "Sales Strategy", "Market Analysis",
    "Competitive Analysis", "B2B", "B2C",
    # Finance & Accounting
    "Financial Analysis", "Budget Management", "Cost Reduction",
    "Profit & Loss", "Revenue Forecasting", "Cash Flow Management",
    "Tax Compliance", "Financial Reporting", "Credit Analysis",
    # Logistics & Operations
    "Customs Clearance", "Freight Management", "Inventory Control",
    "Demand Planning", "Vendor Management", "Supplier Relations",
    "Warehouse Management", "Fleet Management", "Route Optimization",
    # HR
    "Talent Acquisition", "Employee Relations", "Workforce Planning",
    "Performance Appraisal", "Training & Development", "Culture Building",
    # Healthcare
    "Patient Care", "Clinical Documentation", "Medical Records",
    "Healthcare Compliance", "Patient Safety", "Electronic Health Records",
    # Marketing
    "Brand Management", "Content Strategy", "Digital Marketing",
    "Campaign Management", "Lead Generation", "Customer Acquisition",
    "Market Research", "Social Media Management",
    # Education
    "Curriculum Development", "Classroom Management", "Student Engagement",
]

# Pre-compile soft skill patterns once.
_SOFT_SKILL_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(rf"\b{re.escape(skill)}\b", re.IGNORECASE), skill)
    for skill in _KNOWN_SOFT_SKILLS
]

# Common English stop-words and generic job-posting noise to exclude from keywords.
_STOP_WORDS: frozenset[str] = frozenset({
    "the", "and", "for", "with", "that", "this", "from", "will", "have",
    "your", "our", "you", "are", "not", "but", "can", "all", "also",
    "any", "who", "how", "what", "when", "where", "than", "been", "more",
    "they", "their", "them", "into", "its", "over", "such", "each",
    "well", "both", "about", "work", "team", "role", "skills", "using",
    "able", "must", "should", "would", "could", "other", "some", "within",
    "across", "which", "through", "strong", "experience", "understanding",
    "knowledge", "ability", "great", "excellent", "help", "build",
    "develop", "design", "implement", "support", "manage", "ensure",
    "provide", "create", "including", "related", "required", "preferred",
    "access", "agency", "applications", "building", "business", "developer",
    "internal", "message", "operations", "premium", "recruitment", "tools",
    "user", "users", "client", "clients", "service", "services", "system",
    "systems", "solution", "solutions", "years", "level", "position",
    "company", "candidate", "candidates", "ideal", "successful", "looking",
    "join", "daily", "overall", "practices", "responsibilities", "requirements",
    "opportunity", "opportunities", "environment", "environments", "focus",
    "focused", "high", "plus", "needs", "need", "deliver", "delivering",
    "collaborate", "collaborating", "driven", "drive", "drives",
})


def _extract_keywords(text: str, buckets: dict[str, list[str]] | None = None) -> list[str]:
    """Extract domain keywords, skills, and competencies across ANY industry.

    Extracts high-value requirement tokens from the job description's qualifications, skills,
    and responsibilities, rather than counting random repeated English nouns.
    """
    found_skills: list[str] = []
    seen: set[str] = set()

    # Pass 1: Extract domain skills from required_skills, preferred_skills, and responsibilities
    candidate_lines: list[str] = []
    if buckets:
        candidate_lines.extend(buckets.get("required_skills", []))
        candidate_lines.extend(buckets.get("preferred_skills", []))
        # Also take first few key responsibility lines if skills section is sparse
        if len(candidate_lines) < 3:
            candidate_lines.extend(buckets.get("responsibilities", [])[:5])

    for line in candidate_lines:
        clean = _BULLET_PREFIX.sub("", line).strip()
        # Clean leading introductory phrases like "Experience with", "Knowledge of", "Ability to"
        clean = re.sub(r"^(experience (with|in)|proficien(t|cy) (in|with)|knowledge of|familiarity with|strong understanding of|ability to|proven track record in|expertise in)\s+", "", clean, flags=re.IGNORECASE).strip()

        # Split on commas, semicolons, or " and "
        parts = re.split(r"[,;]|\s+(?:and|&)\s+", clean)
        for p in parts:
            p_clean = p.strip().rstrip(".")
            # Filter out full sentences or noise words
            if 2 <= len(p_clean) <= 40 and len(p_clean.split()) <= 4:
                lower = p_clean.lower()
                if (
                    lower not in _STOP_WORDS
                    and not any(w in lower for w in ["willing", "urgency", "fast", "time", "lead", "process", "platform"])
                    and lower not in seen
                ):
                    seen.add(lower)
                    # Clean title case
                    words = p_clean.split()
                    formatted = " ".join(w if w.isupper() and len(w) <= 4 else w.capitalize() for w in words)
                    found_skills.append(formatted)

    # Pass 2: Match domain/soft skills across all industries (Logistics, Customs, Finance, Healthcare, Sales, etc.)
    for pattern, canonical in _SOFT_SKILL_PATTERNS:
        if pattern.search(text) and canonical.lower() not in seen:
            found_skills.append(canonical)
            seen.add(canonical.lower())

    return found_skills[:35]
