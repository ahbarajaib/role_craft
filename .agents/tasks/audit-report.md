# RoleCraft Codebase Audit

**Audit Date:** 2025-07-10  
**Scope:** Full backend + frontend source code, all AI prompt files, all data pipelines  
**Purpose:** Identify hallucination entry points and keyword injection points before implementing evidence-grounded tailoring

---

## 1. Project Structure Overview

```
role_craft/
├── backend/
│   ├── main.py                          # Uvicorn entry point
│   ├── app/
│   │   ├── ai/
│   │   │   ├── prompts.py               # Analysis system prompt + user prompt builder
│   │   │   ├── review_prompts.py        # Unified recruiter review prompt + builder
│   │   │   ├── cover_letter_prompts.py  # Cover letter system prompt + user prompt builder
│   │   │   └── resume_parser_prompts.py # AI resume parser system prompt + builder
│   │   ├── api/v1/
│   │   │   ├── analysis.py              # POST /analyze — section gap analysis
│   │   │   ├── tailor.py                # POST /tailor — full StructuredResume AI tailor
│   │   │   ├── review.py                # POST /review-section — section review
│   │   │   ├── resume.py                # POST /resume/analyze, /rewrite, /batch-rewrite,
│   │   │   │                            #   /auto-tailor, /apply, /cover-letter
│   │   │   ├── comparison.py            # POST /compare — deterministic matching
│   │   │   ├── structured_resume.py     # CRUD for StructuredResume + generate endpoints
│   │   │   └── ...                      # auth, admin, documents, history, payment, etc.
│   │   ├── analyzers/
│   │   │   └── section_detector.py      # Rule-based DOCX section detection
│   │   ├── comparators/
│   │   │   └── resume_comparator.py     # Deterministic keyword/tech/skill coverage
│   │   ├── constants/
│   │   │   └── resume_keywords.py       # UNIVERSAL_ROLE_TITLES, SKILLS_SECTION_KEYWORDS, etc.
│   │   ├── core/
│   │   │   ├── config.py                # Settings (OPENAI_MODEL="gpt-4o-mini", etc.)
│   │   │   └── security.py              # JWT + bcrypt
│   │   ├── models.py                    # SQLAlchemy ORM (User, StructuredResumeModel, etc.)
│   │   ├── parsers/
│   │   │   ├── docx_parser.py           # DOCX paragraph extractor
│   │   │   └── job_description_parser.py # Rule-based JD parser (no AI)
│   │   ├── schemas/
│   │   │   ├── analysis.py              # SectionAnalysis, ResumeAnalysisResponse
│   │   │   ├── comparison.py            # ComparisonResult, SectionComparison
│   │   │   ├── cover_letter.py          # CoverLetterRequest/Response
│   │   │   ├── resume_analysis.py       # ResumeAnalysisResult, ReviewedSection, etc.
│   │   │   ├── review.py                # SectionReviewItem, UnifiedReviewResult
│   │   │   ├── rewrite.py               # RewriteSectionRequest/Response, BatchRewrite*
│   │   │   └── structured_resume.py     # StructuredResume, ResumeSection, ContactInfo, etc.
│   │   └── services/
│   │       ├── analysis_service.py      # Calls OpenAI for section gap analysis
│   │       ├── comparison_service.py    # Delegates to resume_comparator
│   │       ├── cover_letter_service.py  # Calls OpenAI to generate cover letter
│   │       ├── resume_analysis_workflow.py  # Full analysis pipeline orchestrator
│   │       ├── resume_parser_service.py # Parses DOCX/PDF into StructuredResume
│   │       ├── rewrite_service.py       # AI section rewriter (DOCX & JSON modes)
│   │       ├── review_service.py        # Calls OpenAI for recruiter review
│   │       └── tailor_orchestration_service.py  # Full StructuredResume AI tailor
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts                   # All HTTP calls to backend
│   │   │   └── structured_resume_api.ts # Structured resume + tailoring API calls
│   │   ├── components/                  # UI components (workspace, editor, modals, etc.)
│   │   └── app/
│   │       ├── workspace/page.tsx       # Main analysis + tailoring UI
│   │       └── resume-builder/page.tsx  # Structured resume editor UI
└── tests/
    ├── test_admin_auth.py
    ├── test_extension.py
    └── test_job_parser_linkedin.py
```

---

## 2. Backend Architecture

The backend is a FastAPI application (Python 3.14) running on Uvicorn. It uses:
- **SQLite** (via SQLAlchemy ORM) for users, analysis history, structured resumes
- **OpenAI gpt-4o-mini** via the Responses API (structured outputs) and Chat Completions API
- **JWT** (HS256) for authentication with bcrypt password hashing
- **Two resume data paths**: legacy DOCX files on disk, and JSON-first StructuredResume in DB

The application has **two partially-overlapping tailoring systems**:
1. **DOCX-based legacy path** (`/resume/rewrite`, `/resume/batch-rewrite`, `/resume/auto-tailor`) — loads paragraphs from a DOCX, rewrites via OpenAI, patches back to DOCX
2. **StructuredResume JSON path** (`/tailor`) — operates on a normalized JSON schema stored in DB, rewrites section by section, saves tailored copy

---

## 3. Prompt Files (FULL CONTENT)

### 3.1 `app/ai/prompts.py` — Resume Analysis (Gap Detection)

**SYSTEM_INSTRUCTIONS (verbatim):**
```
You are an expert resume coach and ATS specialist.

Your task is to analyse each section of a candidate's resume against a job description and identify gaps.

Rules:
- Analyse every section provided, even if it looks good.
- Flag a section as needing changes only when it is genuinely missing relevant content.
- Keep reasons concise (1–2 sentences maximum).
- List only keywords that are truly absent from the section text — do not list keywords that already appear.
- Never suggest inventing experience, companies, dates, or skills the candidate does not have.
- Prioritise sections that affect ATS scoring most: experience, skills, summary.
- Return analysis for every section, even sections that need no changes.
```

**User prompt template (verbatim, built by `build_analysis_input`):**
```
=== JOB DESCRIPTION ===
Title: {jd.title}
Company: {jd.company}
Experience: {jd.experience_required}
Required skills: {", ".join(jd.required_skills)}
Preferred skills: {", ".join(jd.preferred_skills)}
Technologies: {", ".join(jd.technologies)}
Responsibilities:
  - {r for r in jd.responsibilities}

=== RESUME SECTIONS ===
[{section.title}]
{para.text for para in section.paragraphs}
...
```

**Structured output schema:** `ResumeAnalysisResponse` containing `list[SectionAnalysis]`  
Each `SectionAnalysis` has: `section_name`, `needs_changes: bool`, `priority`, `reason: str`, `missing_keywords: list[str]`

---

### 3.2 `app/ai/review_prompts.py` — Unified Recruiter Review

**REVIEW_INSTRUCTIONS (verbatim):**
```
You are a senior hiring manager, executive recruiter, and expert resume consultant reviewing a candidate's resume against a job description across any industry or professional domain (Engineering, Logistics, Customs, Sales, Operations, Finance, Management, Customer Service, Healthcare, Marketing, etc.).

Your objective is to evaluate the resume as ONE document and make strategic trade-offs on where improvements will yield the highest interview callback rates.

Strict Principles:
1. **Target Job Title**: Extract/derive a concise, highly specific 2-4 word target job title for `target_job_title` from the job description (e.g., 'Customs Clearance Specialist', 'Logistics Operations Manager', 'AI Application Engineer', 'Full Stack Developer').
2. **Recruiter-style Priority**: Do not suggest adding keywords to every section. Recommend at most FIVE overall Improvements, prioritized from 1 (highest impact) to 5.
3. **Deduplication**: If suggesting an improvement in one section solves the gap, do not repeat or duplicate the recommendation in any other section.
4. **Truthfulness and Evidence Reuse**: Never suggest inventing experience, achievements, dates, or certifications.
   - If a target technology (e.g. Next.js App Router, Tailwind) is missing, search the entire resume context first.
   - If supporting evidence exists elsewhere (e.g., they have React Native or vanilla React experience), suggest moving or highlighting it in the target section as an *adjacent* skill.
5. **Selective Section Status**: Assign section review status carefully:
   - `improve`: Active improvements supported by resume evidence. MUST BE ASSIGNED to Professional Experience, Projects, Skills, and Summary sections whenever keyword alignment is recommended.
   - `keep`: High-quality match containing 100% of required keywords and zero gaps.
   - `reduce_emphasis`: Strictly reserved for non-essential sections like Hobbies or Interests. NEVER mark main Experience, Work History, Projects, Skills, or Summary sections as 'reduce_emphasis'.
6. **Exact Section Name Matching**: Each `section_name` in your output MUST exactly match one of the section headers provided under === CANDIDATE RESUME === in square brackets. Do not duplicate recommendations across multiple roles.
7. **Strict Evidence-Gated Recommendations**: NEVER recommend adding, highlighting, or introducing a skill, language, framework, or technology in any section recommendation if that skill does NOT exist anywhere in the candidate's resume under === CANDIDATE RESUME ===. Recommend ONLY keywords/skills supported by candidate resume evidence.
8. **Concise Rationale**: Keep all explanations, reasons, and impact strings concise (1-2 sentences max per item).
```

**User prompt template (verbatim, built by `build_review_input`):**
```
=== JOB DESCRIPTION ===
Title: {jd.title}
Experience required: {jd.experience_required}
Required skills: {", ".join(jd.required_skills)}
Technologies: {", ".join(jd.technologies)}
Key responsibilities: {"; ".join(jd.responsibilities[:5])}

=== DETECTOR GAP ANALYSIS ===
Overall Match Coverage: {comparison.overall_coverage_percentage}%
Missing Skills: {", ".join(comparison.missing_skills)}
Missing Technologies: {", ".join(comparison.missing_technologies)}

=== CANDIDATE RESUME ===
[{section.title}]
{para.text for para in section.paragraphs}
...
```

**Structured output schema:** `UnifiedReviewResult`  
Fields: `target_job_title: str`, `sections: list[SectionReviewItem]`, `top_strengths: list[StrengthItem]`, `top_improvements: list[ImprovementItem]`

`SectionReviewItem` fields: `section_name`, `review_status` (improve/keep/reduce_emphasis), `rewrite_worthwhile: bool`, `priority`, `reason`, `recommendations: list[str]`, `strengths: list[str]`

`ImprovementItem` fields: `name`, `priority: int`, `section`, `reason`, `expected_interview_impact`, `evidence_reused`, `confidence: float`

---

### 3.3 `app/ai/cover_letter_prompts.py` — Cover Letter Generation

**COVER_LETTER_SYSTEM_PROMPT (verbatim):**
```
You are an expert career coach and master cover letter writer.
Your task is to write a highly personal, authentic, engaging, and compelling 2-paragraph cover letter for a candidate applying to a specific role.

CRITICAL COVER LETTER RULES:
1. **Structure (EXACTLY 2 Body Paragraphs)**:
   - **Paragraph 1 (Personal Hook & Fit with Company Mission)**: Open with a warm, personal hook expressing genuine enthusiasm for the company's work and mission. Concisely introduce your background, relevant years of experience, and key strengths that make you a natural fit for this target role.
   - **Paragraph 2 (Concrete Evidence & Direct Value/Usefulness to the Company)**: Highlight 2-3 specific accomplishments or key projects from your applied resume background. Explicitly articulate **how your background and technical skills will be directly useful to their team** (e.g., how you will help them accelerate product delivery, solve engineering challenges, or scale their systems). Seamlessly transition into a warm, confident closing inviting a conversation/interview, thanking the hiring team.
2. **Personal, Authentic & Engaging Tone**:
   - Write in a warm, personable, and enthusiastic voice that feels genuinely human and tailored.
   - Avoid mechanical template openings (e.g. "I am writing to formally apply..."). Instead, share an authentic personal connection to the work.
3. **Strict Grounding on Applied Resume & Confirmed Matched Skills ONLY**:
   - Base all technical claims, tools, and experience ONLY on the candidate's active applied resume sections and explicitly provided "CONFIRMED MATCHED SKILLS".
   - DO NOT invent missing skills, unconfirmed gaps, or technologies not present in the candidate's confirmed list/applied text.
4. **No Placeholders**: Do NOT include bracketed placeholders like [Company Name] or [Hiring Manager]. Use generic professional addresses ("Dear Hiring Team,") if no contact name is provided.
5. **Output Bounds**: Output ONLY the cover letter content (Salutation, EXACTLY 2 body paragraphs, Closing, and Candidate Signature line). Do not include conversational preambles, notes, or explanations.
```

**User prompt template (verbatim, built by `build_cover_letter_input`):**
```
=== CANDIDATE NAME ===
{candidate_name}

=== TARGET ROLE ===
{target_role}

=== TARGET JOB DESCRIPTION ===
{job_description_text}

=== CANDIDATE SUMMARY & EXPERIENCE (APPLIED RESUME) ===
{summary_text}

=== CONFIRMED MATCHED SKILLS (STRICTLY USE ONLY THESE SKILLS) ===  [conditional]
{", ".join(confirmed_matched_skills)}

=== APPLIED RESUME SECTION EVIDENCE ===  [conditional]
{evidence_context}
```

**No structured output schema** — uses `provider.generate_text()` (chat completion), free-form text response at temperature 0.4.

---

### 3.4 `app/ai/resume_parser_prompts.py` — AI Resume Parser

**PARSE_RESUME_SYSTEM_INSTRUCTIONS (verbatim):**
```
You are an expert ATS resume parser.

Your job is to convert raw resume text (from DOCX or PDF) into a clean, normalized, structured JSON resume schema.

Rules:
1. Extract ALL information present in the resume. NEVER omit or skip any work experience jobs, projects, education entries, or skills.
2. DO NOT combine experience_entries or project_entries inside a 'skills' or 'summary' section. Each section header in the raw text MUST be returned as its own distinct section object in the `sections` array!
   - 'Professional Experience' or 'Work History' MUST be its own section with section_type='experience' and populate `experience_entries`.
   - 'Projects' or 'Key Projects' MUST be its own section with section_type='projects' and populate `project_entries`.
   - 'Technical Skills' MUST be its own section with section_type='skills' and populate `categories`.
   - 'Education' MUST be its own section with section_type='education' and populate `education_entries`.
   - 'Certifications' MUST be its own section with section_type='certifications' and populate `certification_entries`.
3. DO NOT output empty sections. Include ONLY sections that actually exist in the candidate's resume text and contain parsed content. If a section does NOT exist in the resume, DO NOT output a section object for it.
4. Section Classification: Map sections to standardized section types:
   - 'summary': Summary, Objective, Profile, About Me, Professional Summary
   - 'skills': Technical Skills, Core Competencies, Technologies, Expertise, Key Skills
   - 'experience': Professional Experience, Work History, Employment, Career, Work Experience, Professional Background
   - 'education': Education, Academic Background, Qualifications, Education & Credentials
   - 'projects': Projects, Selected Projects, Key Projects, Major Projects, Technical Projects
   - 'certifications': Certifications, Licenses, Credentials, Certifications & Courses
   - 'custom': Any other section present in the resume with non-empty entries
5. Detail Field Parsing Rules:
   - For 'contact_info': Extract full_name, job_title (current headline/role), email, phone, location (city, country), linkedin_url, portfolio_url, github_url.
   - For 'experience': Extract EVERY job entry under `experience_entries` with job_title, company, location, start_date (e.g. 'Feb 2025' or 'June 2023'), end_date (e.g. 'Present' or 'Aug 2024'), and all achievement bullets.
   - For 'education': Extract EVERY degree/qualification under `education_entries` with degree (e.g. 'Master of Computer Applications'), institution (e.g. 'RNS Institute of Technology'), location, graduation_date (e.g. 'June 2019' or '2019'), gpa, and details.
   - For 'projects': Extract EVERY project under `project_entries` with name (e.g. 'AI CRM Assistant'), description, technologies (list of tech strings like 'Next.js', 'PostgreSQL'), bullets, and url.
   - For 'skills': Group skills into logical categories under `categories` (e.g. 'AI & LLM Engineering', 'Frontend', 'Backend & Systems', 'Databases', 'Cloud & DevOps').
   - For 'certifications': Extract name, issuer, date, credential_id under `certification_entries`.
   - For 'summary': Extract full professional summary text into `text`.
6. Confidence & Unparsed Fields:
   - If any standard field (e.g., phone, email, date ranges, degree, company) is missing or ambiguous in the resume text, leave it as null/empty and add the field path (e.g. 'contact_info.phone', 'experience.0.start_date') to `parse_confidence.low_confidence_fields`.
   - The user will see fields in `low_confidence_fields` highlighted in RED in the UI so they can complete them manually.
```

**User prompt template (verbatim, built by `build_parse_resume_input`):**
```
=== DOCUMENT FILENAME: {filename} ===

{raw_text}
```

**Structured output schema:** `StructuredResumeParseModel` (passed to OpenAI as `response_format`)

---

### 3.5 `app/services/rewrite_service.py` — Section Rewrite Prompts

These are defined as constants inside the service file (not in `app/ai/`).

**REWRITE_SYSTEM_PROMPT (verbatim):**
```
You are a senior executive recruiter and master ATS resume editor.
You are rewriting a candidate's resume section (e.g., Professional Experience, Projects, Work History) to aggressively maximize ATS keyword alignment, recruiter impact, and domain depth against the Target Job Description.

MANDATORY RULES:
1. **Mandatory JD Keyword Integration**: Every single bullet point MUST be updated to seamlessly weave in relevant domain keywords, frameworks, tools, software platforms, methodologies, and concepts from the Target Job Description (e.g., whether in Tech, Finance/Accounting, Sales, HR, Healthcare, Supply Chain, Operations, Banking, Retail, or Manufacturing).
2. **Google XYZ Action-Impact Formula**: Structure every bullet point using Google's XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]". Start each bullet with a distinct, high-impact action verb (e.g., Spearheaded, Orchestrated, Executed, Optimized, Negotiated, Reconciled, Accelerated, Championed).
3. **Metric & Scale Indicators**: Ensure every bullet point features measurable metric impact or scale indicators suited to the candidate's industry (e.g., "% cost reduction", "% efficiency gain", "revenue or quota generated", "error rate reduction", "turnaround time acceleration", "volume or team scale managed").
4. **Strict Factual Preservation**: Keep Job Titles, Company Names, Employment Dates, and Locations 100% identical. NEVER invent fake companies, fake degrees, or fake dates.
5. **Exact Line Count & Structure**: Output EXACTLY the same number of bullet points as the input. Preserve company/title header lines at the top of each entry.
6. **Clean Output**: Output ONLY the polished section text. Do NOT include preambles or commentary.
```

**SKILLS_REWRITE_SYSTEM_PROMPT (verbatim):**
```
You are a senior executive recruiter and master ATS resume editor.
You are rewriting the SKILLS / CORE COMPETENCIES section of a professional resume across any domain or industry.

CRITICAL SKILLS SECTION RULES:
1. **Category Skill Format ONLY**: Output ONLY concise category skill lines matching the candidate's original structure (e.g. `Category Name: Skill 1, Skill 2, Skill 3`).
2. **STRICTLY NO Sentences, NO Metrics, NO Action Verbs**: Do NOT write full sentences, achievement paragraphs, metrics, percentages, or action verbs under any circumstances. Every line MUST be a list of skill names ONLY.
3. **Preserve ALL Category Lines**: You MUST preserve every single original category line from the candidate's text. Output EXACTLY one line per category line in the original text. Do NOT omit or merge any category.
4. **Target Job Keywords**: Intelligently weave missing keywords and tools from the Target Job Description into the appropriate matching categories.
5. **Output Bounds**: Output ONLY the skill lines. Do not include preambles or header titles.
```

**SUMMARY_REWRITE_SYSTEM_PROMPT (verbatim):**
```
You are a senior hiring manager, executive recruiter, and master resume writer.
You are rewriting the PROFESSIONAL SUMMARY / PROFILE section of a resume to align perfectly with the target Job Description.

CRITICAL PROFESSIONAL SUMMARY RULES:
1. **Compelling 1-Paragraph Executive Summary**: Write a powerful 3-5 sentence professional summary tailored specifically to the target job title, required technical stack, and core domain background.
2. **Target Role Alignment**: Frame the candidate's years of experience, primary skills, and major achievements directly around the target role.
3. **No Fluff or Invented Claims**: Keep all years of experience, core technical stack, and factual background grounded strictly in the candidate's actual resume evidence.
4. **Active & High-Impact Tone**: Use confident, professional wording emphasizing problem-solving impact, production delivery, and domain expertise.
5. **Output Bounds**: Output ONLY the polished summary paragraph text. Do not include preambles or section title headers.
```

---

### 3.6 `app/services/tailor_orchestration_service.py` — Full Tailor Prompts

These are also defined as constants inside the service (not in `app/ai/`).

**TAILOR_SUMMARY_SYSTEM (verbatim):**
```
You are an executive resume strategist. Rewrite the professional summary to directly align with the target job title and job description. Frame the narrative around the target role's core competencies while preserving authentic experience. NEVER fabricate fake companies or degree titles. Output ONLY the polished summary paragraph (3-4 sentences max) — no headers or preamble.
```

**TAILOR_EXPERIENCE_SYSTEM (verbatim):**
```
You are a master resume editor and ATS optimizer.
Rewrite work experience bullet points using the Google XYZ formula ('Accomplished [X] as measured by [Y], by doing [Z]').
RULES:
1. MANDATORY: Every single bullet point MUST be updated to seamlessly weave in relevant keywords, tools, methodologies, and competencies from the target Job Description (matching the candidate's profession: Tech, Finance, Accounting, Sales, HR, Healthcare, Logistics, Operations, etc.) wherever applicable.
2. STRICTLY LOCK & PRESERVE REAL FACTS: Never change company names, job titles, start/end dates, employment years, or locations.
3. Output EXACTLY the same number of bullets as input, one line per bullet.
4. Do NOT include bullet symbols or preamble — plain text only.
```

**TAILOR_SKILLS_SYSTEM (verbatim):**
```
You are an ATS resume skills optimizer. Categorize and refine the skills section to maximize keyword match against the target job description.
RULES:
1. Intelligently weave target ATS skills, tools, and domain proficiencies from the job description into appropriate categories.
2. Preserve all core existing skills from the original candidate profile.
3. Output format must be strictly one line per category: 'CategoryName: Skill1, Skill2, Skill3...'
```

**TAILOR_PROJECTS_SYSTEM (verbatim):**
```
You are a master resume project strategist. Rewrite project descriptions and bullet points to highlight target methodologies, tools, and quantifiable impact.
RULES:
1. MANDATORY: Seamlessly weave matching keywords, tools, and standards from the target Job Description into every project bullet point.
2. STRICTLY LOCK & PRESERVE REAL FACTS: Never alter project names, company names, repository links, or dates.
3. Output EXACTLY the same number of bullets as input, one line per bullet, plain text only.
```

---

## 4. Data Models / Schemas

### 4.1 Core Pydantic Schemas

**StructuredResume** (`app/schemas/structured_resume.py`):
```python
class StructuredResume(BaseModel):
    contact_info: ContactInfo
    summary: Optional[str]
    profile_photo_url: Optional[str]
    sections: list[ResumeSection]
    parse_confidence: ParseConfidence
    source_format: Optional[str]   # 'docx' | 'pdf' | 'manual'
    preferred_template: Optional[str]  # 'clean_classic' | 'modern_professional' | 'executive_profile'

class ResumeSection(BaseModel):
    section_type: str   # 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'certifications' | 'custom'
    section_title: str
    order: int
    visible: bool
    content: dict[str, Any]    # ← dict with Any values — allows arbitrary content
```

**ContactInfo**: `full_name, job_title, email, phone, location, linkedin_url, portfolio_url, github_url` (all Optional[str])

**ExperienceEntry**: `job_title, company, location, start_date, end_date` (all Optional[str]), `bullets: list[str]`

**ProjectEntry**: `name, description, technologies: list[str], bullets: list[str], url`

**SkillCategory**: `category_name: Optional[str], skills: list[str]`

**SectionAnalysis** (`app/schemas/analysis.py`):
```python
class SectionAnalysis(BaseModel):
    section_name: str
    needs_changes: bool
    priority: Priority  # 'high' | 'medium' | 'low'
    reason: str
    missing_keywords: list[str]
```

**ReviewedSection** (`app/schemas/resume_analysis.py`):
```python
class ReviewedSection(BaseModel):
    section_name: str
    review_status: ReviewStatus  # 'improve' | 'keep' | 'reduce_emphasis'
    rewrite_worthwhile: bool
    priority: Priority
    reason: str
    recommendations: list[str]
    evidence_used: list[str]
    missing_keywords: list[str]
    strengths: list[str]
    coverage_percentage: float
    recruiter_impact: str
    ats_impact: str
```

**ImprovementItem** (`app/schemas/resume_analysis.py`):
```python
class ImprovementItem(BaseModel):
    name: str
    priority: int
    section: str
    reason: str
    expected_interview_impact: str
    evidence_reused: str    # ← field asks model to surface evidence from resume, but is free-form string
    confidence: float
```

**UnifiedReviewResult** (`app/schemas/review.py`):
```python
class UnifiedReviewResult(BaseModel):
    target_job_title: str = Field(default="Target Role", ...)
    sections: list[SectionReviewItem]
    top_strengths: list[StrengthItem]
    top_improvements: list[ImprovementItem]
```

**RewriteSectionResponse** (`app/schemas/rewrite.py`):
```python
class RewriteSectionResponse(BaseModel):
    section: str
    original_text: str
    rewritten_text: str   # ← free-form rewritten content — no validation against original
    reasoning: str
    changes: list[RewriteChangeItem]
```

### 4.2 SQLAlchemy Models (`app/models.py`)

- `User`: email, password_hash, credits, plan_type, missing_skills_tracker (JSON string)
- `StructuredResumeModel`: resume_json (Text — full StructuredResume JSON), version, preferred_template, original_docx_path
- `TailoredResumeModel`: tailored_resume_json (Text), diff_json (Text), job_title, job_company
- `AnalysisHistory`: analysis_result_json, job_description_text, overall_score

### 4.3 TypeScript Interfaces (frontend `src/lib/api.ts`, `src/lib/structured_resume_api.ts`)

Mirrors the backend schemas — `ReviewedSection`, `ResumeAnalysisResult`, `RewriteSectionRequest`, `BatchRewriteRequest`, `CoverLetterRequest`, `TailorResponse`, `DiffMap`, `StructuredResume`, etc. No frontend-side content validation beyond TypeScript type checking.

---

## 5. API Routes

| Method | Path | Input | Output |
|--------|------|-------|--------|
| POST | `/api/v1/documents/upload` | multipart file | `DocumentUploadResponse` |
| POST | `/api/v1/structured-resume/parse` | multipart file | `StructuredResume` |
| GET | `/api/v1/structured-resume` | — | `StructuredResume` |
| PUT | `/api/v1/structured-resume` | `StructuredResume` | `StructuredResume` |
| POST | `/api/v1/structured-resume/generate/{template}/{format}` | — | DOCX/PDF file |
| POST | `/api/v1/structured-resume/export-original` | `{tailored_resume_id}` | DOCX file |
| POST | `/api/v1/tailor` | `TailorRequest` | `TailorResponse` |
| DELETE | `/api/v1/tailor/{id}` | — | status |
| POST | `/api/v1/analyze` | `AnalysisRequest` | `ResumeAnalysisResponse` |
| POST | `/api/v1/compare` | `CompareRequest` | `ComparisonResult` |
| POST | `/api/v1/review-section` | `ReviewRequest` | `SectionReview` |
| POST | `/api/v1/resume/analyze` | `ResumeAnalysisRequest` | `ResumeAnalysisResult` |
| POST | `/api/v1/resume/rewrite` | `RewriteSectionRequest` | `RewriteSectionResponse` |
| POST | `/api/v1/resume/batch-rewrite` | `BatchRewriteRequest` | `BatchRewriteResponse` |
| POST | `/api/v1/resume/auto-tailor` | `AutoTailorRequest` | `AutoTailorResponse` |
| POST | `/api/v1/resume/apply` | `ApplyRewriteRequest` | `ApplyRewriteResponse` |
| POST | `/api/v1/resume/cover-letter` | `CoverLetterRequest` | `CoverLetterResponse` |
| PUT | `/api/v1/resume/cover-letter/{id}` | `UpdateCoverLetterRequest` | status |
| GET | `/api/v1/resume/download/{id}` | — | DOCX file |
| GET | `/api/v1/history` | — | `HistoryResponse` |
| POST | `/api/v1/job-descriptions/parse` | `{text}` | `JobDescription` |

---

## 6. Resume Tailoring Pipeline — Step by Step

### Path A: Legacy DOCX Rewrite (via `/resume/rewrite` or `/resume/auto-tailor`)

1. **Upload** (`POST /documents/upload`): DOCX saved to disk as `uploads/base/{user_id}.docx`. Returns `document_id`.

2. **Analysis** (`POST /resume/analyze`): 
   - If user has `StructuredResumeModel` in DB → serialize to `list[SectionItem]` via `serialize_to_sections()`, skip file load
   - Otherwise → load DOCX from disk, parse paragraphs via `docx_parser.py`, detect sections via `section_detector.py`
   - Parse raw JD text via `job_description_parser.py` (rule-based, no AI) → `JobDescription`
   - Compare via `resume_comparator.py` (deterministic substring matching) → `ComparisonResult`
   - AI unified review via `review_service.review_resume()` → `UnifiedReviewResult` (uses `REVIEW_INSTRUCTIONS`)
   - Merge comparison + review → `ResumeAnalysisResult`

3. **Rewrite** (`POST /resume/rewrite`):
   - Load section content from DOCX or from `section_content` JSON
   - Gather "evidence context" from all other sections
   - Call `get_unsupported_jd_technologies()` to find JD techs not in evidence → `unsupported_jd_techs`
   - **NOTE**: `sanitize_unsupported_skills_from_text()` currently returns the text unchanged (early return `return rewritten_text, []`) — the sanitizer is DISABLED
   - Select prompt: `REWRITE_SYSTEM_PROMPT`, `SKILLS_REWRITE_SYSTEM_PROMPT`, or `SUMMARY_REWRITE_SYSTEM_PROMPT`
   - Build user prompt with JD, recommendations, evidence context, and original section text
   - Call `provider.parse_response()` with `RewriteSectionResponse` as structured output
   - Post-process: deduplicate lines, strip repeated section titles, strip action verbs from skills

4. **Apply** (`POST /resume/apply`):
   - If structured JSON in DB and no raw DOCX → use `ATSTemplateRenderer` to render DOCX from JSON + rewrites
   - If raw DOCX exists → patch paragraphs in-place with `patch_service.apply_rewrites()`
   - Save updated `StructuredResumeModel.resume_json` to DB
   - Return download URL

### Path B: Full StructuredResume Tailor (via `/tailor`)

1. Load `StructuredResumeModel` from DB for current user → parse as `StructuredResume`
2. `TailorOrchestrationService.tailor_full_resume()`:
   - Deep-copy the `StructuredResume`
   - For each `visible` section, by `section_type`:
     - `"summary"` → `_rewrite_summary()` → calls `provider.generate_text(TAILOR_SUMMARY_SYSTEM, user_prompt)` at temperature 0
     - `"experience"` → per-entry `_rewrite_experience_bullets()` → calls `provider.generate_text(TAILOR_EXPERIENCE_SYSTEM, user_prompt)` at temperature 0.3
     - `"skills"` → `_rewrite_skills()` → calls `provider.generate_text(TAILOR_SKILLS_SYSTEM, user_prompt)` at temperature 0.2
     - `"projects"` → per-entry `_rewrite_project_bullets()` → calls `provider.generate_text(TAILOR_PROJECTS_SYSTEM, user_prompt)` at temperature 0.3
   - Build diff map `{field_path: {original, tailored}}`
3. **Overwrite master `StructuredResumeModel.resume_json`** with the tailored version (version + 1)
4. Save `TailoredResumeModel` with tailored JSON + diff
5. Return `TailorResponse`

**Critical note:** In step 3, the master resume in DB is **permanently overwritten** with the AI-tailored version. The original is only preserved in `TailoredResumeModel.diff_json`.

---

## 7. Cover Letter Pipeline — Step by Step

1. Frontend calls `POST /resume/cover-letter` with `CoverLetterRequest`:
   - `document_id`: uploaded DOCX identifier
   - `job_description_text`: raw JD text
   - `candidate_name`: optional override
   - `target_role`: optional override
   - `confirmed_matched_skills`: optional list from analysis result
   - `rewritten_sections`: optional map of section rewrites already applied

2. `CoverLetterService.generate_cover_letter()`:
   - Load DOCX from disk via `resolve_document_path()`
   - Parse document sections via `section_service.detect_document_sections()`
   - Extract `candidate_name` from first short paragraph of DOCX (< 60 chars)
   - Extract `summary_text` from summary/profile section; OR from `rewritten_sections` if provided
   - Collect `evidence_parts` from first 4 non-summary sections (truncated at 3000 chars)
   - Extract `target_role` from JD first lines if not provided
   - Build user prompt via `build_cover_letter_input()` (see Section 3.3)
   - Call `provider.generate_text(COVER_LETTER_SYSTEM_PROMPT, user_prompt, temperature=0.4)` — **free-form text, no structured output**
   - Save text to `.txt` cache file and build DOCX via `_build_cover_letter_docx()`
   - Return `CoverLetterResponse` with `cover_letter_text`

3. No post-generation validation of cover letter content.

---

## 8. ATS Scoring Pipeline

The "ATS score" (displayed as `overall_coverage_percentage`) is **entirely deterministic** — computed by `resume_comparator.py`, no AI involved:

1. **JD parsing**: `job_description_parser.py` extracts `keywords`, `technologies`, `required_skills` via rule-based patterns + allow-lists
2. **Resume text**: all section paragraphs concatenated
3. **Matching**:
   - `keywords` → substring match against full resume text
   - `technologies` → substring match against full resume text (using `_KNOWN_TECHNOLOGIES` allow-list of ~200 techs)
   - `required_skills` → content-word match at ≥60% threshold (phrase decomposition)
4. **Weighted score**:
   - Required Skills = 50%
   - Technologies = 30%
   - Keywords = 20%
5. Score is returned as `overall_coverage_percentage` on `OverallSummary`

**Important:** The ATS score is calculated from the **original resume** at analysis time. After tailoring/rewriting, there is **no automatic re-score** — the UI shows the pre-tailoring score unless the user triggers a new analysis.

---

## 9. Frontend Data Flow

### Upload → Analysis Flow
1. User uploads DOCX/PDF → `parseAndSaveStructuredResume(file)` → `POST /structured-resume/parse`
2. Backend saves `StructuredResumeModel` in DB
3. User pastes JD text → `analyzeResume(jdText)` → `POST /resume/analyze`
4. Backend returns `ResumeAnalysisResult` with:
   - `overall_summary.overall_coverage_percentage` (ATS score)
   - `sections[].review_status` (improve/keep)
   - `sections[].recommendations[]` (for each section to improve)
   - `sections[].missing_keywords[]` (JD keywords absent from section)
5. Frontend displays sections color-coded by status, missing keywords as red badges

### Rewrite Flow
1. User clicks "Rewrite" on a section → `rewriteSection(request)` → `POST /resume/rewrite`
2. Request includes `section_content` (JSON), `section_type`, `recommendations`, `job_description_text`
3. Backend returns `rewritten_text`
4. Frontend shows diff preview; user can accept or reject
5. User accepts → collected in `accepted_rewrites` map

### Apply & Download Flow
1. `applyRewrites(request)` → `POST /resume/apply`
2. Backend merges rewrites into StructuredResume JSON, renders DOCX via `ATSTemplateRenderer`
3. Returns `download_id`
4. User downloads via `GET /resume/download/{download_id}`

### Cover Letter Flow
1. User clicks "Generate Cover Letter" → `generateCoverLetter(request)` → `POST /resume/cover-letter`
2. Frontend passes `confirmed_matched_skills` from the analysis result (green-badge skills)
3. Backend generates and returns `cover_letter_text`
4. User can edit text in UI → `updateCoverLetter(downloadId, newText)` → `PUT /resume/cover-letter/{id}`
5. Download as DOCX or PDF

### AI Tailor Flow (newer path)
1. User selects a job in workspace → `tailorResume(params)` → `POST /tailor`
2. Backend calls `TailorOrchestrationService`, overwrites master `StructuredResumeModel`
3. Returns diff for preview modal (`TailoredResumeModel` saved in DB)
4. User can download tailored version or revert

---

## 10. Existing Tests (list and describe)

### `backend/tests/test_admin_auth.py`
- **Covers:** Admin authentication flow
- **Tests:** PIN verification (wrong PIN → 401, non-admin → 403, correct → 200), X-Admin-Token gate on `/admin/stats/overview`, admin user listing, config fetch
- **Does NOT cover:** Any AI prompt behavior, tailoring logic, cover letter, scoring

### `backend/tests/test_extension.py`
- **Covers:** Browser extension configuration and ZIP building
- **Tests:** Feature gate config (free/pro/elite plan access), extension directory existence (manifest.json, content.js, styles.css, icons), ZIP generation for single and all-3-platform bundles
- **Does NOT cover:** Resume analysis, AI prompts, tailoring

### `backend/tests/test_job_parser_linkedin.py`
- **Covers:** Job description parser with a realistic LinkedIn paste
- **Tests:** Title extraction (`"Senior Software Engineer - Backend/Fullstack [India]"`), company (`"FurtherAI"`), technology detection (`Python`), responsibilities and required_skills non-empty
- **Does NOT cover:** Full keyword extraction, soft skill detection, most technology allow-list entries

### `backend/test_pdf2.py` (root-level, not in `/tests/`)
- Appears to be a quick manual test file; not read in audit (not in `tests/`)

**Summary of test coverage gaps:**
- No tests for any AI prompt behavior or outputs
- No tests for `resume_comparator.py` (the ATS scoring engine)
- No tests for `section_detector.py`
- No tests for `rewrite_service.py`, `review_service.py`, `cover_letter_service.py`
- No tests for `tailor_orchestration_service.py`
- No tests for `resume_parser_service.py`
- No tests for the analysis workflow (`resume_analysis_workflow.py`)
- No integration tests for the full tailor pipeline

---

## 11. Identified Hallucination Entry Points

These are the specific locations where the model can generate content that is not grounded in the candidate's resume.

### H1 — `REWRITE_SYSTEM_PROMPT`: Mandatory metric fabrication
**File:** `app/services/rewrite_service.py`, lines ~67-83  
**Exact text:**
> "3. **Metric & Scale Indicators**: Ensure every bullet point features measurable metric impact or scale indicators suited to the candidate's industry (e.g., '% cost reduction', '% efficiency gain', 'revenue or quota generated', 'error rate reduction', 'turnaround time acceleration', 'volume or team scale managed')."

**Problem:** The model is **instructed** to add metrics to "every bullet point." If the original resume bullet does not contain a metric, the model must invent one to comply. The instruction does not say "use metrics from the resume" or "use metrics only if provided." Combined with the Google XYZ formula requirement, the model will fabricate percentages, revenue figures, and team sizes that were never in the original resume.

### H2 — `TAILOR_EXPERIENCE_SYSTEM`: Same metric fabrication in tailor path
**File:** `app/services/tailor_orchestration_service.py`, lines ~32-41  
**Exact text (in user prompt built in `_rewrite_experience_bullets`):**
> "seamlessly weaving in matching technical keywords, action verbs, and impact metrics from the target Job Description"

**Problem:** The user prompt instructs the model to weave in "impact metrics from the target Job Description." The JD does not contain the candidate's metrics — it contains job requirements. This instructs the model to treat JD requirements as evidence of the candidate's past performance.

### H3 — `TAILOR_PROJECTS_SYSTEM`: Same metric fabrication for projects
**File:** `app/services/tailor_orchestration_service.py`, lines ~43-49  
**User prompt built in `_rewrite_project_bullets`:**
> "seamlessly weaving in matching technical keywords, action verbs, and quantifiable engineering metrics from the target Job Description"

**Problem:** Same as H2 — directs the model to source "quantifiable engineering metrics" from the JD, which does not contain the candidate's metrics.

### H4 — `TAILOR_SKILLS_SYSTEM`: Adds JD skills not in candidate resume
**File:** `app/services/tailor_orchestration_service.py`, lines ~34-40  
**Exact text:**
> "1. Intelligently weave target ATS skills, tools, and domain proficiencies from the job description into appropriate categories."
> "2. Preserve all core existing skills from the original candidate profile."

**Problem:** Rule 1 says "weave target ATS skills from the job description." Rule 2 says "preserve core existing skills." There is no constraint that Rule 1 must be bounded by Rule 2. The model is free to add any skill from the JD regardless of whether the candidate has it. The ordering (Rule 1 before Rule 2) emphasizes addition over preservation.

### H5 — `SKILLS_REWRITE_SYSTEM_PROMPT`: Same JD skill injection
**File:** `app/services/rewrite_service.py`, lines ~88-100  
**Exact text:**
> "4. **Target Job Keywords**: Intelligently weave missing keywords and tools from the Target Job Description into the appropriate matching categories."

**Problem:** "Missing" is defined as "not in candidate's skills categories." There is no check against whether the candidate has that skill anywhere else in their resume (experience, projects). The model is instructed to add absent JD skills.

### H6 — `SUMMARY_REWRITE_SYSTEM_PROMPT`: Summary can inflate experience claims
**File:** `app/services/rewrite_service.py`, lines ~101-114  
**Exact text:**
> "2. **Target Role Alignment**: Frame the candidate's years of experience, primary skills, and major achievements directly around the target role."

**Problem:** "Frame the narrative around the target role" is vague enough for the model to restate the candidate's years of experience in a way that implies proficiency in target-role-specific technologies they may not have. Combined with "primary skills" not being constrained to those present in the actual resume, the model can write a summary claiming expertise in JD skills.

### H7 — `COVER_LETTER_SYSTEM_PROMPT` with partial evidence context
**File:** `app/ai/cover_letter_prompts.py`, lines ~29-37  
**Exact text:**
> "Paragraph 1 (Personal Hook & Fit with Company Mission): Open with a warm, personal hook expressing genuine enthusiasm for the company's work and mission. Concisely introduce your background, **relevant years of experience**, and **key strengths** that make you a natural fit for this target role."

**Problem:** The model is asked to introduce "relevant years of experience" and "key strengths" that make the candidate a fit. These must come from `summary_text` and `evidence_context`, which are capped at `[:3000]` chars. If the summary has been AI-rewritten (itself potentially hallucinated — see H6), and the `confirmed_matched_skills` list is not provided, the model generates Paragraph 1 with minimal grounding constraints.

### H8 — Cover letter uses `rewritten_sections` as ground truth
**File:** `app/services/cover_letter_service.py`, lines ~45-56  
**Code:**
```python
if request.rewritten_sections:
    for sec_key, text in request.rewritten_sections.items():
        if "summary" in sec_key.lower() or "profile" in sec_key.lower():
            summary_text = text
```

**Problem:** The cover letter model receives the AI-rewritten summary as ground truth. If the rewritten summary already contains hallucinated metrics or skills (see H1, H6), those hallucinations propagate into the cover letter as established facts.

### H9 — Sanitizer is disabled
**File:** `app/services/rewrite_service.py`, lines ~30-35  
**Exact code:**
```python
def sanitize_unsupported_skills_from_text(
    rewritten_text: str,
    unsupported_techs: set[str],
) -> tuple[str, list[str]]:
    """Preserve AI-woven target JD keywords without stripping them."""
    return rewritten_text, []
```

**Problem:** The sanitizer that was supposed to strip JD technologies absent from the candidate's resume was **deliberately disabled** by an early return. The code below the return (which does the actual stripping) is dead code. The comment "Preserve AI-woven target JD keywords without stripping them" confirms this was an intentional rollback of the protection. No sanitization of hallucinated technologies occurs.

### H10 — `ImprovementItem.evidence_reused` is a free-form string
**File:** `app/schemas/resume_analysis.py`, lines ~103-118  
**Field definition:**
```python
evidence_reused: str = Field(
    description="Supporting evidence found in other sections of the resume, or adjacent technologies already demonstrated."
)
```

**Problem:** The model is asked to fill `evidence_reused` as a string. There is no validation that what the model writes in this field actually exists in the resume. The model can hallucinate evidence ("candidate demonstrated X in their Projects section") when X does not appear there.

---

## 12. Identified Keyword Injection Points

These are the specific locations where JD keywords are used as if they were candidate qualifications or facts.

### K1 — `TAILOR_SKILLS_SYSTEM`: Direct JD keyword injection into skills
**File:** `app/services/tailor_orchestration_service.py`, `_rewrite_skills()`  
**User prompt (verbatim, from `_rewrite_skills`):**
```python
user_prompt = (
    f"Target Role: {job_title}\n\n"
    f"Job Description:\n{jd[:2000]}\n\n"
    f"Original Skills:\n{original_skills_text}\n\n"
    f"Reorder skills to prioritize JD-relevant ones:"
)
```
And the system prompt says: "Intelligently weave target ATS skills, tools, and domain proficiencies from the job description into appropriate categories."

**Problem:** The user prompt asks to "reorder to prioritize JD-relevant ones" but the system prompt says "weave" JD skills in. The model will add skills from the JD that the candidate does not have.

### K2 — `REWRITE_SYSTEM_PROMPT`: Every bullet must include JD keywords
**File:** `app/services/rewrite_service.py`, REWRITE_SYSTEM_PROMPT  
**Exact text:**
> "1. **Mandatory JD Keyword Integration**: Every single bullet point MUST be updated to seamlessly weave in relevant domain keywords, frameworks, tools, software platforms, methodologies, and concepts from the Target Job Description"

**Problem:** "Every single bullet point MUST" leaves no room for exceptions. Bullets that legitimately describe work with no connection to JD keywords will be rewritten to include JD keywords regardless of whether the candidate used those technologies.

### K3 — `TAILOR_EXPERIENCE_SYSTEM`: JD keywords into every bullet
**File:** `app/services/tailor_orchestration_service.py`, `_rewrite_experience_bullets()`  
**Exact text:**
> "1. MANDATORY: Every single bullet point MUST be updated to seamlessly weave in relevant keywords, tools, methodologies, and competencies from the target Job Description"

Same pattern as K2, applied through the tailor path.

### K4 — `TAILOR_PROJECTS_SYSTEM`: JD keywords into every project bullet
**File:** `app/services/tailor_orchestration_service.py**, `_rewrite_project_bullets()`  
**Exact text:**
> "1. MANDATORY: Seamlessly weave matching keywords, tools, and standards from the target Job Description into every project bullet point."

Same pattern as K2 and K3, applied to project entries.

### K5 — Analysis review passes `missing_skills` + `missing_technologies` as context to AI reviewer
**File:** `app/ai/review_prompts.py`, `build_review_input()`  
**User prompt section (verbatim):**
```
=== DETECTOR GAP ANALYSIS ===
Overall Match Coverage: {comparison.overall_coverage_percentage}%
Missing Skills: {', '.join(comparison.missing_skills)}
Missing Technologies: {', '.join(comparison.missing_technologies)}
```

**Problem:** The review model receives the list of missing skills/technologies directly. While the review prompt says to use this only for generating recommendations ("suggest moving or highlighting it"), the model can use these missing items as a seed to generate recommendations that embed JD keywords as if the candidate should claim them, without checking whether the candidate has evidence.

### K6 — Recommendations from analysis are passed verbatim to the rewriter
**File:** `app/services/rewrite_service.py`, method `rewrite()`  
**Code path:** `recommendations` from `ReviewedSection` are passed as `sanitized_recs` into the user prompt:
```python
f"=== RECRUITER RECOMMENDATIONS FOR THIS SECTION ===\n"
f"{' / '.join(sanitized_recs) if sanitized_recs else 'Improve overall impact using Google XYZ formula.'}"
```

**Problem:** The recommendations generated by the review AI (which may say "weave in React Native, TypeScript, Next.js") are passed to the rewrite AI as instructions. If the review AI's recommendation mentioned a JD keyword not in the resume, that recommendation flows directly into the rewrite prompt as an instruction to include it. The `sanitized_recs` sanitization only strips terms from `effective_unsupported_techs`, and since the sanitizer (`sanitize_unsupported_skills_from_text`) is disabled (K9/H9), this protection is ineffective.

### K7 — `SKILLS_REWRITE_SYSTEM_PROMPT` instruction to add "missing" JD keywords
**File:** `app/services/rewrite_service.py`, SKILLS_REWRITE_SYSTEM_PROMPT  
**Exact text:**
> "4. **Target Job Keywords**: Intelligently weave missing keywords and tools from the Target Job Description into the appropriate matching categories."

"Missing" here means "in JD but not in current skills section" — not "proven in the candidate's resume elsewhere."

### K8 — Cover letter receives full JD text and can map JD claims to candidate
**File:** `app/services/cover_letter_service.py`, line ~77  
```python
user_prompt = build_cover_letter_input(
    ...
    job_description_text=request.job_description_text[:3000],
    ...
)
```
The cover letter model receives the full JD (up to 3000 chars) alongside minimal resume context. While `COVER_LETTER_SYSTEM_PROMPT` says "Base all technical claims on the candidate's applied resume sections," the cover letter model at temperature 0.4 can map JD requirements to candidate claims without evidence.

---

## 13. Summary of Critical Issues

### Issue 1 — CRITICAL: Fabricated metrics are explicitly required by the prompts

**Affected flows:** `/resume/rewrite` (REWRITE_SYSTEM_PROMPT), `/tailor` (TAILOR_EXPERIENCE_SYSTEM, TAILOR_PROJECTS_SYSTEM)  
**Location:** `app/services/rewrite_service.py:68-82`, `app/services/tailor_orchestration_service.py:32-48`

Every bullet rewrite is instructed to include "measurable metric impact" with specific examples (`% cost reduction`, `% efficiency gain`, etc.). When the candidate's original bullet contains no metric, the model invents one. This is the single highest-risk hallucination vector — it creates fake performance claims that a candidate must stand behind in an interview.

---

### Issue 2 — CRITICAL: Skills sanitizer is fully disabled

**File:** `app/services/rewrite_service.py:30-35`

The `sanitize_unsupported_skills_from_text()` function that was designed to strip JD technologies absent from the candidate's resume returns immediately without doing anything. All the detection logic below the early return is dead. JD technologies are injected into the resume unchecked regardless of whether the candidate has them.

---

### Issue 3 — HIGH: Both tailor paths add JD skills to the skills section

**File:** `tailor_orchestration_service.py` (TAILOR_SKILLS_SYSTEM), `rewrite_service.py` (SKILLS_REWRITE_SYSTEM_PROMPT)

Both prompts explicitly instruct the model to add JD skills/keywords into the candidate's skills section. There is no check against the candidate's experience, projects, or other sections. A candidate with no Python experience applying for a Python role will get Python added to their skills section.

---

### Issue 4 — HIGH: Summary rewrite can overstate experience and claim JD-aligned expertise

**File:** `rewrite_service.py` (SUMMARY_REWRITE_SYSTEM_PROMPT), `tailor_orchestration_service.py` (TAILOR_SUMMARY_SYSTEM)

The summary prompts frame the candidate's background "directly around the target role." Without constraining this framing to skills actually present in the resume, the model writes summaries claiming expertise in technologies the JD requires but the candidate may not have.

---

### Issue 5 — HIGH: Cover letter compounds hallucinations from upstream rewrites

**File:** `app/services/cover_letter_service.py:45-56`

If the user generates a cover letter after accepting rewrites, the cover letter model receives the AI-rewritten summary as ground truth. Any fabricated metrics or skills in the rewritten summary become claims in the cover letter, creating a chain of hallucinations: original resume → hallucinated rewrite → hallucinated cover letter.

---

### Issue 6 — MEDIUM: Master resume is permanently overwritten by `/tailor`

**File:** `app/api/v1/tailor.py`, lines 66-68
```python
record.resume_json = tailored_resume.model_dump_json()
record.version += 1
```

The `TailorRequest` handler overwrites `StructuredResumeModel.resume_json` (the "master" resume) with the tailored version. The original is only recoverable via `TailoredResumeModel.diff_json`, which stores diffs — not the full original. If the tailor introduces hallucinations, the user's master resume is corrupted with no clean-copy restore path.

---

### Issue 7 — MEDIUM: JD missing-skills list is passed to the review AI as context

**File:** `app/ai/review_prompts.py:42-46`

The review AI receives the list of skills missing from the resume (derived from the JD) as part of its context. This seeds the AI's recommendations with JD keywords it is supposed to suggest adding. Those recommendations then flow into the rewrite prompts (K6), forming a closed loop where JD keywords propagate from detection → review → rewrite.

---

### Issue 8 — MEDIUM: No post-generation validation exists anywhere

No step in any pipeline (analysis, rewrite, tailor, cover letter) validates that the AI output:
- Does not contain claims not present in the input resume text
- Does not add technologies to the skills section that are absent from the resume
- Does not fabricate specific metrics (percentages, revenue figures, team sizes)
- Does not change the candidate's job titles, companies, or dates (though prompts prohibit this)

The only guard — `sanitize_unsupported_skills_from_text` — is disabled.

---

### Issue 9 — LOW: `ImprovementItem.evidence_reused` is unvalidated free-form text

**File:** `app/schemas/resume_analysis.py:111`

The model fills `evidence_reused` with a string describing supporting evidence. This string is rendered in the UI but never verified against the actual resume content. The model can claim evidence exists where it does not.

---

### Issue 10 — LOW: ATS score shown to user is from pre-tailor analysis

After any tailoring operation, the frontend continues displaying the `overall_coverage_percentage` from the original analysis. The score does not reflect the tailored resume. Users see a score that may be significantly higher or lower than the actual tailored resume's ATS match, creating a misleading feedback loop.
