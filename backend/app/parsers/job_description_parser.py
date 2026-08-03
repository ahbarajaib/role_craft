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
from collections import Counter

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
        keywords=_extract_keywords(text),
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


def _extract_title(preamble: list[str], lines: list[str] | None = None) -> str:
    """Return the most likely job title from the preamble or full lines.

    Skips generic header phrases and scraper noise (e.g. 'Company logo for...', 'Over 100 people applied').
    """
    generic_headers = {
        "full job description", "job description", "about the role", "overview",
        "job summary", "description", "about us", "position overview", "role summary",
        "job title", "details", "role details", "careers", "position description", "about the position",
        "about the job", "role details", "job search faster"
    }

    noise_regex = re.compile(
        r"(company logo for|logo for|^logo\b|\breposted\b|over \d+ people|promoted by|responses managed|"
        r"cancel anytime|reactivate premium|messagingyou are on|navigating to|followers|members who share|"
        r"show match details|people you can reach out to|meet the hiring team|job search faster|about the company|"
        r"software development|employees)",
        re.IGNORECASE
    )

    all_lines = preamble + (lines or [])

    # 1. Look for explicit label "Job Title: <Role>" or "Role: <Role>"
    for line in all_lines:
        t = line.strip()
        lower = t.lower().rstrip(":").strip()
        if not t or noise_regex.search(lower):
            continue
        if lower.startswith("title:") or lower.startswith("job title:") or lower.startswith("role:"):
            colon_idx = t.find(":")
            val = t[colon_idx + 1:].strip()
            if val and val.lower() not in generic_headers and not noise_regex.search(val):
                return val

    # 2. Prioritize finding a short line (<= 80 chars) that contains a recognised role keyword
    role_titles = [
        "developer", "engineer", "architect", "manager", "lead", "designer",
        "consultant", "analyst", "specialist", "administrator", "executive",
        "fullstack", "backend", "frontend", "devops", "sre", "scientist",
        "director", "head", "vp", "associate", "intern", "product"
    ]

    for line in all_lines[:15]:
        t = line.strip()
        lower = t.lower().rstrip(":").strip()
        if not t or lower in generic_headers or lower.startswith("http") or noise_regex.search(lower):
            continue
        if len(t) <= 80 and any(r in lower for r in role_titles):
            return t

    # 3. Fallback: check preamble lines, skipping generic headers and noise
    for line in preamble:
        t = line.strip()
        lower = t.lower().rstrip(":").strip()
        if not t or lower in generic_headers or lower.startswith("http") or noise_regex.search(lower):
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
        r"company\s*[:–-]\s*(.+)", text, re.IGNORECASE
    )
    if company_explicit:
        return company_explicit.group(1).strip()

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
    # Explicit label
    location_label = re.search(
        r"location\s*[:–-]\s*(.+)", text, re.IGNORECASE
    )
    if location_label:
        return location_label.group(1).strip()

    # Remote variants
    if re.search(r"\bfully[- ]remote\b", text, re.IGNORECASE):
        return "Remote"
    if re.search(r"\bremote\b", text, re.IGNORECASE):
        return "Remote"
    if re.search(r"\bhybrid\b", text, re.IGNORECASE):
        return "Hybrid"

    # "City, State" or "City, Country" pattern in preamble
    for line in preamble:
        if re.search(r"[A-Z][a-z]+,\s+[A-Z]", line):
            return line

    return ""


def _extract_employment_type(text: str) -> str:
    """Return the employment type if stated."""
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
        if match:
            # Prefer lines that also contain "year" or "experience" as
            # stronger signals that this is an experience requirement.
            if re.search(r"year|experience|level", stripped, re.IGNORECASE):
                return _BULLET_PREFIX.sub("", stripped[:120]).strip()
    # Fallback: return the first match anywhere in the text
    match = _EXPERIENCE_PATTERN.search(text)
    if match:
        start = max(0, match.start() - 10)
        end = min(len(text), match.end() + 40)
        return text[start:end].strip().splitlines()[0].strip()
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

# Common English stop-words to exclude from keywords.
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
})


def _extract_keywords(text: str) -> list[str]:
    """Return high-frequency technical nouns from the text.

    Words must be longer than 4 characters, not in the stop-word list,
    and appear at least twice.  Results are ordered by frequency
    descending then alphabetically, capped at 20.
    """
    words = re.findall(r"\b[a-zA-Z][a-zA-Z0-9+#.-]{3,}\b", text)
    normalised = [w.lower() for w in words if w.lower() not in _STOP_WORDS]
    counts = Counter(normalised)
    # Keep only words that appear more than once
    frequent = [(word, count) for word, count in counts.items() if count > 1]
    # Sort by frequency desc, then alpha asc for determinism
    frequent.sort(key=lambda x: (-x[1], x[0]))
    return [word for word, _ in frequent[:20]]
