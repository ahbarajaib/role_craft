# RoleCraft End-to-End Resume Generation & Workflow Test Report

**Date:** October 12, 2026  
**Test Assets:**
- **Base Resume:** `Base resume.docx` (Mohammed Ahbar Ajaib, AI Application Engineer, 7+ years full-stack, React, Node.js, TypeScript, Next.js, FastAPI, Python)
- **JD 1:** `JD1.docx` (Full Stack Frontend Architect at Noon — AI design canvas, React/TypeScript, 10+ years)
- **JD 2:** `JD2.docx` (Fullstack Engineer at Tricog Health — React, Node.js, TypeScript, Healthcare, 2+ years)
- **JD 3:** `JD3.docx` (Full Stack Developer at Virallens — Next.js, React, Node.js, AI/RAG integrations, 3-5 years)

---

## 1. Executive Summary & Test Outcome

We conducted an end-to-end execution test of the resume generation and tailoring pipeline across both core workflows:
1. **The DOCX / Patching Workflow** (`/api/v1/resume/analyze`, `/rewrite`, `/batch-rewrite`, `/auto-tailor`, `/apply`)
2. **The StructuredResume / Builder Workflow** (`/api/v1/resume/parse`, `/tailor`, `EvidenceService`, `RequirementMatcher`, `TemplateRenderer`)

### Core Result
While the fundamental AI prompt templates and evidence security concepts are well-designed, **critical defects in parsing, section grouping, and evidence extraction currently prevent the system from correctly tailoring the resume**. Specifically:
- In the **DOCX workflow**, the section detector fractures the candidate's work experience into 7 disconnected custom sections, causing the AI rewriter to receive *only* the heading string `"Professional Experiences"` (and 0 job bullets), leaving the entire work history untailored in the patched document.
- In the **StructuredResume workflow**, the fast 1ms deterministic parser fails to recognize Word's XML bullets, stripping all 30 work experience bullet points. This starves `EvidenceService`, leading `RequirementMatcher` to erroneously classify candidate-held skills (such as **TypeScript**) as **FORBIDDEN CLAIMS**, explicitly banning them during tailoring.
- In the **Job Description parser**, subheadings in JD2 get concatenated into responsibility bullets, causing 0 required skills to be extracted, and JD1's mission statement is misidentified as its location.
- In the **ATS Comparator**, years of experience are stripped as stop-words, causing a 7-year candidate to falsely register as a 100% match for a 10+ year requirement.

---

## 2. Detailed Findings by Pipeline Stage

### A. Document Parsing & Section Detection

| Issue | Severity | Root Cause | Impact |
|---|---|---|---|
| **Experience Section Fracturing** | 🚨 Critical | `section_detector.py` Signal 5 treats any line with a role keyword or date pattern as a new section break. | Every job title (`Wordpress Developer...`, `React Native Developer...`, etc.) is split into a separate section. The parent `"Professional Experiences"` section contains only 1 paragraph (`"Professional Experiences"`). |
| **Rewrite Service Experience Drop** | 🚨 Critical | `rewrite_service.py` checks `if is_exp_sec and not original_text.strip():` to collect sub-sections. | Because `original_text` contains `"Professional Experiences"`, `not original_text.strip()` is `False`. The rewriter receives only the heading string to rewrite. |
| **Project Mistagged as Skills** | ⚠️ High | `section_detector.py` line 467 checks `if any(k in norm for k in [..., "tool", ...]): return "skills"`. | The project `"Focus Toolkit – Productivity App"` matches `"tool"` in `"toolkit"` and is classified as `skills` instead of `projects`. |
| **Education Dates Split into Sections** | ⚠️ High | Standalone date lines like `"June 2019"` in education match Signal 5 (`has_date` and length `<= 95`). | Dates become standalone custom sections, separating degrees from institutions. |

---

### B. Fast Deterministic Parser vs. OpenAI Parser

| Pipeline Step | Fast Deterministic Parser (Current Default) | OpenAI Parser (`StructuredResumeParseModel`) |
|---|---|---|
| **Word XML Bullets** | ❌ **Failed**: Word paragraphs use XML bullet styling (`is_bullet=True`), not literal `"•"` characters in `p.text`. Fast parser expects literal `"•"` and drops all 30 bullets. | ✅ **Extracted**: Accurately parsed all 6 job roles with 5 bullets each (30 total bullets). |
| **Projects Parsing** | ❌ **Failed**: Treats each line in projects (including technologies and bullets) as an independent project name. | ⚠️ **Truncated**: `gpt-4o-mini` omitted the Projects section to conserve tokens due to prompt length and schema complexity. |
| **Education Formatting** | ❌ **Failed**: Parsed entries as `list[str]` instead of structured objects, causing `AttributeError: 'str' object has no attribute 'get'`. | ✅ **Extracted**: Correctly formatted degree and institution objects. |

---

### C. Evidence Grounding & Requirement Matching

When the fast parser stripped experience bullets and project details:
1. `EvidenceService.extract(doc)` found **only 46 evidence items** instead of 100+.
2. **TypeScript** was missing from `supported_technologies` because it appeared only in project descriptions and experience bullets.
3. For **JD1 (Noon - Full Stack Frontend Architect)** and **JD2 (Tricog Health - Fullstack Engineer)**:
   - `RequirementMatcher` classified `TypeScript` as an **unsupported requirement**.
   - As a result, `TypeScript` was added to `forbidden_claims`!
   - In `TailorOrchestrationService`, the LLM prompt was instructed:  
     `=== FORBIDDEN: DO NOT CLAIM CANDIDATE HAS THESE (absent from resume) ===`  
     `TypeScript, Canvas, Notion...`
   - **Result:** The system actively barred a senior TypeScript engineer from mentioning TypeScript on their application for a Frontend Architect role.

---

## D. Job Description Parsing

- **JD1 (Noon):**
  - Title: `Full Stack Frontend Architect` (Correct)
  - Company: `Noon` (Correct)
  - Location: Extracted the entire company mission paragraph (`"We are on a mission to reinvent how designers work in the AI era. Backed by top investors..."`) because `_extract_location` captured the first non-title text block.
- **JD2 (Tricog Health):**
  - Section headers such as `Requirements`, `Solid Understanding Of`, `Experience With`, and `GenAI, Tooling And Automation` were formatted without separate linebreaks in the source document.
  - The parser failed to detect section transitions, resulting in **0 required skills** extracted and all requirements dumped into `responsibilities`.
- **JD3 (Virallens):**
  - Emojis like `🧑‍💻 Experience: 3-5 Years` were preserved raw in the structured fields.

---

## E. Deterministic ATS Comparator

- In `resume_comparator.py`:
  - `_SKILL_STOP_WORDS` includes `"years"`, `"year"`, `"experience"`, `"building"`, `"large-scale"`.
  - When comparing against JD1's requirement: `"10+ years of professional experience building large-scale web applications."`:
    - The stop words were stripped, leaving only `['professional', 'scale', 'applications']`.
    - Because these 3 words exist in the candidate's 7-year resume, the comparator calculated a **100% match ratio** for that requirement.
    - The candidate was marked as fully satisfying a 10+ year requirement despite only having 7+ years of experience.

---

## 3. Recommended Improvement Plan

### Phase 1: DOCX Parsing & Section Detector Hardening
1. **Bullet Text Normalization in `_extract_docx_text`:**
   - In `docx_parser.py` / `resume_parser_service.py`, ensure paragraphs with `is_bullet=True` or `p._element.pPr.numPr` are prefixed with `"• "` in extracted text so all downstream regexes and parsers see standard bullets.
2. **Refine Section Detector Boundaries:**
   - Do NOT split the main section if a role title or date is encountered inside an already established `experience` or `projects` section.
   - Restrict Signal 5 so it only identifies sub-job headers if structured hierarchical grouping is supported; otherwise, keep all sub-jobs inside the parent `experience` section.
   - Fix keyword matching in `_normalize()` to match whole words (e.g. `\btool\b`) so that `"Focus Toolkit"` is not classified as `skills`.

### Phase 2: Resume Parser Service Resilience
1. **Bullet Fallback in Fast Parser:**
   - When parsing experience entries, check `ParsedParagraph.is_bullet` in addition to literal string bullet prefixes.
2. **OpenAI Parser Multi-Turn / Token Optimization:**
   - Ensure the prompt explicitly mandates extracting both Experience AND Projects, or parse large resumes in targeted passes if output token limits are approached.
3. **Structured Resume Schema Compliance:**
   - Ensure `education` and `projects` entries in the fast parser always conform to the dictionary schemas expected by `StructuredResume` (`{"degree": ..., "institution": ...}`).

### Phase 3: Evidence Grounding & Matching Accuracy
1. **Comprehensive Tech Extraction:**
   - Scan raw resume text as a fallback in `EvidenceService` to ensure technologies mentioned in project bodies or experience are never missed even if parser grouping has minor discrepancies.
2. **Refine `RequirementMatcher` Forbidden Claims:**
   - Ensure core technologies with Level 1 or Level 2 evidence are never accidentally placed into `forbidden_claims`.
   - Prevent generic requirements or year phrases from becoming "forbidden claim" strings.

### Phase 4: JD Parser & Comparator Polish
1. **Preamble & Location Cleansing:**
   - Improve `_extract_location` in `job_description_parser.py` to reject full narrative sentences.
   - Clean inline subheadings like `...delivering.Requirements` before section splitting.
2. **Comparator Years of Experience Check:**
   - Evaluate years-of-experience requirements separately rather than filtering out the number and treating it as a generic keyword match.

---

## 4. Implementation & Verification Status (Completed)

All 4 phases have been implemented and validated with automated regression and integration tests:

1. **Phase 1 (Section Detector & Boundaries):**
   - Protected container sections (`experience`, `projects`, `education`) from internal sub-heading fracture.
   - Added standalone date rejection in `_is_heading()`.
   - Prevented partial keyword false positives (e.g., `"Focus Toolkit"` no longer triggers `skills`).
   - `Base resume.docx` now detects exactly 6 clean sections (`header`, `summary`, `skills`, `experience`, `projects`, `education`).

2. **Phase 2 (Fast Parser & Schema Compliance):**
   - Added automatic `"• "` prefixing to Word XML bullet paragraphs (`p.is_bullet` / `w:numPr`) in `_extract_docx_text()`.
   - Fast deterministic parser extracts all 6 jobs with all 30 bullets (5 per job), all 8 projects with technologies, and dictionary-formatted education items.
   - Zero AI tokens required for standard ATS resumes; deterministic parse runs in ~1ms with 100% confidence.

3. **Phase 3 (Evidence Grounding & Safe Skills Invariant):**
   - Added safety invariant in `RequirementMatcher`: `forbidden_claims` strictly never contains any skill in `safe_skills` or backed by evidence.
   - Updated `_extract_key_terms()` using `_find_techs_in_text()` to extract individual canonical technologies from compound phrases.
   - Verified across JD1, JD2, and JD3: `TypeScript` is present in `safe_skills` and absent from `forbidden_claims`.

4. **Phase 4 (JD Parser Subheadings & ATS Comparator Tenure):**
   - `_split_lines()` pre-splits subheadings glued to sentence punctuation (e.g. `reliability.Requirements`, `CloudWatch).Experience Working With Databases`).
   - Cleaned emojis (`📍`, `🧑‍💻`, `🏢`, `💼`) from location, experience, and employment type fields.
   - Guarded `_extract_location()` against narrative sentences (e.g. Noon mission statement).
   - Added explicit tenure comparison (`candidate_years`, `required_years`, `experience_gap_warning`) and strict years checking in `_match_skills()`.

### Test Suite Results:
- Full test suite: **38 passed in 1.23s** (`tests/test_resume_tailoring_enhancements.py` + all existing test modules).
