# Implementation Plan: Evidence-Grounded Resume Tailoring

**Date:** 2025-07-10  
**Based on:** audit-report.md (full read), all 13 source files read verbatim  
**Goal:** Eliminate hallucination at every AI entry point; ensure every claim in a tailored resume or cover letter is traceable to the candidate's original resume.

---

## Ground Rules (apply to all tasks)

- Run tests from `backend/` with: `python -m pytest tests/ -v`
- No HTTP, DB, or filesystem access in new tests — all self-contained
- Never modify master `StructuredResume` in-place; always work on deep copies
- The candidate resume is the **only** source of candidate facts

---

## TASK 1 — Verify/complete `evidence.py`

- [ ] **1.** Confirm `evidence.py` is syntactically complete and add a missing `__all__` export list.

  **File:** `backend/app/schemas/evidence.py`

  **What to check/fix:**
  - The file currently ends at `years_of_experience` field on `TailoringPlan` — no truncation found; the class is complete with all enums (`EvidenceLevel`, `EvidenceCategory`, `EvidenceSourceType`), core models (`EvidenceItem`, `CandidateEvidenceSet`), job-side models (`RequirementType`, `EvidenceStatus`, `JobRequirement`, `RequirementMatch`), and `TailoringPlan`.
  - Add `__all__` at the bottom of the file listing all 11 public names so downstream imports are explicit:

  ```python
  __all__ = [
      "EvidenceLevel",
      "EvidenceCategory",
      "EvidenceSourceType",
      "EvidenceItem",
      "CandidateEvidenceSet",
      "RequirementType",
      "EvidenceStatus",
      "JobRequirement",
      "RequirementMatch",
      "TailoringPlan",
  ]
  ```

  **Why:** Makes import contracts explicit and confirms no names were silently dropped.

  **Verify:** `cd backend && python -c "from app.schemas.evidence import TailoringPlan, CandidateEvidenceSet, EvidenceItem, EvidenceLevel; print('OK')"` — must print `OK` with no errors.

---

## TASK 2 — Create `evidence_service.py`

- [ ] **2.** Create a new deterministic (no LLM) service that extracts a `CandidateEvidenceSet` from a `StructuredResume`.

  **File:** `backend/app/services/evidence_service.py` (new file)

  **Full implementation outline:**

  ```python
  """Evidence extraction service.

  Deterministically extracts CandidateEvidenceSet from a StructuredResume.
  No LLM is involved. Every claim is sourced from the candidate's actual resume text.
  """

  import re
  from app.parsers.job_description_parser import _KNOWN_TECHNOLOGIES
  from app.schemas.evidence import (
      CandidateEvidenceSet, EvidenceItem, EvidenceLevel,
      EvidenceCategory, EvidenceSourceType,
  )
  from app.schemas.structured_resume import StructuredResume

  # Build lowercase → canonical lookup once at import time
  _TECH_LOWER: dict[str, str] = {t.lower(): t for t in _KNOWN_TECHNOLOGIES}

  _YEARS_RE = re.compile(
      r"(\d+\+?\s+years?(?:\s+of(?:\s+\w+)*\s+experience)?)",
      re.IGNORECASE,
  )

  _METRIC_RE = re.compile(
      r"(\d[\d,.]*\s*%|\d[\d,.]*[xX]\b|\$\d[\d,\.]*[KkMmBb]?|\d+\+?\s+(?:users?|clients?|team members?|engineers?))",
  )


  def _find_techs_in_text(text: str) -> list[str]:
      """Return canonical tech names found in text using word-boundary matching."""
      found = []
      lower = text.lower()
      for tech_lower, canonical in _TECH_LOWER.items():
          if tech_lower in ("c#", "c++", ".net"):
              pattern = r"(?<![a-zA-Z0-9])" + re.escape(tech_lower) + r"(?![a-zA-Z0-9])"
          else:
              pattern = r"\b" + re.escape(tech_lower) + r"\b"
          if re.search(pattern, lower):
              found.append(canonical)
      return found


  class EvidenceService:
      """Extracts CandidateEvidenceSet from a StructuredResume deterministically."""

      def extract(self, resume: StructuredResume) -> CandidateEvidenceSet:
          items: list[EvidenceItem] = []
          candidate_name = resume.contact_info.full_name if resume.contact_info else None
          years_of_experience: str | None = None

          for section in resume.sections:
              if not section.visible:
                  continue
              sec_type = section.section_type
              content = section.content or {}

              # ── Skills section: LEVEL_1_DIRECT ─────────────────────────────
              if sec_type == "skills":
                  categories = content.get("categories") or []
                  for cat in categories:
                      cat_name = cat.get("category_name", "")
                      skills = cat.get("skills") or []
                      for skill in skills:
                          if not skill.strip():
                              continue
                          items.append(EvidenceItem(
                              claim=skill.strip(),
                              category=EvidenceCategory.SKILL,
                              evidence_text=f"{cat_name}: {skill.strip()}",
                              source_section=section.section_title,
                              source_type=EvidenceSourceType.LISTED_SKILL,
                              evidence_level=EvidenceLevel.LEVEL_1_DIRECT,
                          ))
                          # Also check if any skill token matches a known tech
                          for tech in _find_techs_in_text(skill):
                              items.append(EvidenceItem(
                                  claim=tech,
                                  category=EvidenceCategory.TECHNOLOGY,
                                  evidence_text=skill.strip(),
                                  source_section=section.section_title,
                                  source_type=EvidenceSourceType.LISTED_SKILL,
                                  evidence_level=EvidenceLevel.LEVEL_1_DIRECT,
                              ))

              # ── Experience section: LEVEL_2_CONTEXTUAL for inline techs ────
              elif sec_type == "experience":
                  entries = content.get("entries") or []
                  for entry in entries:
                      bullets = entry.get("bullets") or []
                      role = entry.get("job_title", "")
                      company = entry.get("company", "")
                      for bullet in bullets:
                          if not bullet.strip():
                              continue
                          # Extract technologies from each bullet
                          for tech in _find_techs_in_text(bullet):
                              items.append(EvidenceItem(
                                  claim=tech,
                                  category=EvidenceCategory.TECHNOLOGY,
                                  evidence_text=bullet.strip(),
                                  source_section=section.section_title,
                                  source_type=EvidenceSourceType.PROFESSIONAL_EXPERIENCE,
                                  evidence_level=EvidenceLevel.LEVEL_2_CONTEXTUAL,
                                  notes=f"Used in role: {role} @ {company}",
                              ))
                          # Extract metrics from bullets
                          for m in _METRIC_RE.findall(bullet):
                              items.append(EvidenceItem(
                                  claim=m,
                                  category=EvidenceCategory.METRIC,
                                  evidence_text=bullet.strip(),
                                  source_section=section.section_title,
                                  source_type=EvidenceSourceType.PROFESSIONAL_EXPERIENCE,
                                  evidence_level=EvidenceLevel.LEVEL_1_DIRECT,
                              ))

              # ── Projects section: LEVEL_2_CONTEXTUAL for inline techs ──────
              elif sec_type == "projects":
                  entries = content.get("entries") or []
                  for entry in entries:
                      techs = entry.get("technologies") or []
                      bullets = entry.get("bullets") or []
                      proj_name = entry.get("name", "")
                      # Project-listed technologies
                      for tech in techs:
                          items.append(EvidenceItem(
                              claim=tech,
                              category=EvidenceCategory.TECHNOLOGY,
                              evidence_text=f"Technologies used in project '{proj_name}': {tech}",
                              source_section=section.section_title,
                              source_type=EvidenceSourceType.PROJECT_EXPERIENCE,
                              evidence_level=EvidenceLevel.LEVEL_2_CONTEXTUAL,
                          ))
                      # Also scan bullet text for additional tech mentions
                      for bullet in bullets:
                          for tech in _find_techs_in_text(bullet):
                              items.append(EvidenceItem(
                                  claim=tech,
                                  category=EvidenceCategory.TECHNOLOGY,
                                  evidence_text=bullet.strip(),
                                  source_section=section.section_title,
                                  source_type=EvidenceSourceType.PROJECT_EXPERIENCE,
                                  evidence_level=EvidenceLevel.LEVEL_2_CONTEXTUAL,
                              ))

              # ── Summary section: LEVEL_1_DIRECT + years extraction ─────────
              elif sec_type == "summary":
                  text = content.get("text") or resume.summary or ""
                  if not text.strip():
                      continue
                  # Technologies explicitly named in summary = LEVEL_1_DIRECT
                  for tech in _find_techs_in_text(text):
                      items.append(EvidenceItem(
                          claim=tech,
                          category=EvidenceCategory.TECHNOLOGY,
                          evidence_text=text.strip()[:200],
                          source_section=section.section_title,
                          source_type=EvidenceSourceType.SUMMARY,
                          evidence_level=EvidenceLevel.LEVEL_1_DIRECT,
                      ))
                  # Years of experience from summary
                  m = _YEARS_RE.search(text)
                  if m and not years_of_experience:
                      years_of_experience = m.group(1).strip()
                      items.append(EvidenceItem(
                          claim=years_of_experience,
                          category=EvidenceCategory.YEARS_OF_EXPERIENCE,
                          evidence_text=text.strip()[:200],
                          source_section=section.section_title,
                          source_type=EvidenceSourceType.SUMMARY,
                          evidence_level=EvidenceLevel.LEVEL_1_DIRECT,
                      ))

          # ── Deduplicate tech claims; keep highest level per claim ──────────
          seen_claims: dict[str, EvidenceItem] = {}
          _level_rank = {
              EvidenceLevel.LEVEL_1_DIRECT: 1,
              EvidenceLevel.LEVEL_2_CONTEXTUAL: 2,
              EvidenceLevel.LEVEL_3_ADJACENT: 3,
              EvidenceLevel.LEVEL_4_NONE: 4,
          }
          deduped: list[EvidenceItem] = []
          for item in items:
              key = item.claim.lower().strip()
              existing = seen_claims.get(key)
              if existing is None:
                  seen_claims[key] = item
                  deduped.append(item)
              elif _level_rank[item.evidence_level] < _level_rank[existing.evidence_level]:
                  # Replace with higher-level evidence
                  idx = deduped.index(existing)
                  deduped[idx] = item
                  seen_claims[key] = item

          # ── Populate fast-lookup lists ─────────────────────────────────────
          supported = [
              i.claim for i in deduped
              if i.evidence_level in (EvidenceLevel.LEVEL_1_DIRECT, EvidenceLevel.LEVEL_2_CONTEXTUAL)
              and i.category in (EvidenceCategory.TECHNOLOGY, EvidenceCategory.SKILL, EvidenceCategory.FRAMEWORK)
          ]
          adjacent = [
              i.claim for i in deduped
              if i.evidence_level == EvidenceLevel.LEVEL_3_ADJACENT
          ]

          return CandidateEvidenceSet(
              candidate_name=candidate_name,
              years_of_experience=years_of_experience,
              supported_technologies=list(dict.fromkeys(supported)),
              adjacent_technologies=list(dict.fromkeys(adjacent)),
              unsupported_claims=[],   # populated by RequirementMatcher
              items=deduped,
          )
  ```

  **Why:** Deterministic extraction means no LLM can invent claims. Every `EvidenceItem` points back to exact resume text. `_KNOWN_TECHNOLOGIES` from the parser ensures consistent tech detection across the whole pipeline.

  **Verify:** `cd backend && python -m pytest tests/test_evidence_grounding.py -v -k "test_evidence"` — all evidence extraction tests pass.

---

## TASK 3 — Create `requirement_matcher.py`

- [ ] **3.** Create a deterministic service that matches `CandidateEvidenceSet` against `JobDescription` to produce `TailoringPlan`.

  **File:** `backend/app/services/requirement_matcher.py` (new file)

  **Full implementation outline:**

  ```python
  """Requirement matcher.

  Matches a CandidateEvidenceSet against a parsed JobDescription to produce
  a TailoringPlan.  This is deterministic — no LLM.

  False-inference deny list
  -------------------------
  The following equivalences are NEVER inferred:
    - LLM API usage (OpenAI, LangChain, Hugging Face) ≠ RAG / embeddings / vector search
    - Docker ≠ AWS (containerisation ≠ cloud provider)
    - GitHub Actions ≠ AWS CI/CD
    - Vercel ≠ AWS
    - Python listed in skills ≠ N years Python (no years fabrication from skill listing)
    - FastAPI ≠ Django (different frameworks; presence of one doesn't imply the other)
    - PostgreSQL ≠ vector DB (relational DB ≠ pgvector / Pinecone / Weaviate)
    - search keyword in project description ≠ BM25 / hybrid search / ranking models
  """

  import re
  from app.schemas.evidence import (
      CandidateEvidenceSet, EvidenceLevel, EvidenceStatus,
      JobRequirement, RequirementMatch, RequirementType, TailoringPlan,
  )
  from app.schemas.job_description import JobDescription

  # ── False-inference deny list ─────────────────────────────────────────────

  # Maps a JD term (lowercase) to the set of candidate terms that do NOT imply it.
  _FALSE_INFERENCE_DENY: dict[str, set[str]] = {
      "rag": {"openai", "langchain", "hugging face", "llm", "gpt", "anthropic", "llm api"},
      "embeddings": {"openai", "langchain", "hugging face", "llm", "gpt"},
      "vector search": {"openai", "langchain", "postgresql", "elasticsearch"},
      "pinecone": {"postgresql", "elasticsearch", "redis"},
      "weaviate": {"postgresql", "elasticsearch", "redis"},
      "aws": {"docker", "github actions", "vercel", "netlify", "kubernetes"},
      "aws ci/cd": {"github actions", "gitlab ci", "jenkins", "circleci"},
      "django": {"fastapi", "flask", "express", "nestjs"},
      "fastapi": {"django", "flask"},
      "vector db": {"postgresql", "mysql", "sqlite", "mongodb"},
      "pgvector": {"postgresql"},  # pgvector is an extension; PostgreSQL alone ≠ pgvector
      "bm25": {"elasticsearch", "search", "postgresql"},
      "hybrid search": {"elasticsearch", "search", "postgresql"},
      "ranking models": {"elasticsearch", "search"},
  }


  def _is_false_inference(jd_term: str, candidate_term: str) -> bool:
      """Return True if inferring jd_term from candidate_term is on the deny list."""
      jd_lower = jd_term.lower().strip()
      cand_lower = candidate_term.lower().strip()
      denied_for = _FALSE_INFERENCE_DENY.get(jd_lower, set())
      return cand_lower in denied_for


  def _term_in_evidence(term: str, evidence: CandidateEvidenceSet) -> EvidenceStatus:
      """Check how strongly a single JD term is supported by candidate evidence."""
      term_lower = term.lower().strip()

      # Direct support check (LEVEL_1 or LEVEL_2)
      direct_items = [
          i for i in evidence.items
          if i.claim.lower().strip() == term_lower
          and i.evidence_level in (EvidenceLevel.LEVEL_1_DIRECT, EvidenceLevel.LEVEL_2_CONTEXTUAL)
      ]
      if direct_items:
          return EvidenceStatus.SUPPORTED

      # Check for partial/adjacent matches — but apply deny list
      for item in evidence.items:
          if item.evidence_level == EvidenceLevel.LEVEL_4_NONE:
              continue
          if _is_false_inference(term, item.claim):
              continue   # deny list: don't infer jd_term from this candidate skill
          if item.claim.lower().strip() == term_lower and item.evidence_level == EvidenceLevel.LEVEL_3_ADJACENT:
              return EvidenceStatus.PARTIALLY_SUPPORTED

      return EvidenceStatus.NOT_SUPPORTED


  class RequirementMatcher:

      def match(
          self,
          evidence: CandidateEvidenceSet,
          job_description: JobDescription,
      ) -> TailoringPlan:
          """Produce a TailoringPlan from evidence + JD."""
          matches: list[RequirementMatch] = []
          forbidden: list[str] = []
          safe_skills: list[str] = list(evidence.supported_technologies)

          # Build requirements from JD fields
          requirements: list[JobRequirement] = []
          for skill in job_description.required_skills:
              requirements.append(JobRequirement(
                  text=skill, requirement_type=RequirementType.REQUIRED,
                  key_terms=self._extract_key_terms(skill),
              ))
          for skill in job_description.preferred_skills:
              requirements.append(JobRequirement(
                  text=skill, requirement_type=RequirementType.PREFERRED,
                  key_terms=self._extract_key_terms(skill),
              ))
          for tech in job_description.technologies:
              requirements.append(JobRequirement(
                  text=tech, requirement_type=RequirementType.DOMAIN,
                  key_terms=[tech],
              ))

          supported_reqs: list[str] = []
          partial_reqs: list[str] = []
          not_supported_reqs: list[str] = []

          for req in requirements:
              supporting = []
              adjacent = []
              overall_status = EvidenceStatus.NOT_SUPPORTED

              for term in req.key_terms:
                  status = _term_in_evidence(term, evidence)
                  term_items = [
                      i for i in evidence.items
                      if i.claim.lower().strip() == term.lower().strip()
                  ]
                  if status == EvidenceStatus.SUPPORTED:
                      supporting.extend(term_items)
                      if overall_status != EvidenceStatus.SUPPORTED:
                          overall_status = EvidenceStatus.SUPPORTED
                  elif status == EvidenceStatus.PARTIALLY_SUPPORTED:
                      adjacent.extend(term_items)
                      if overall_status == EvidenceStatus.NOT_SUPPORTED:
                          overall_status = EvidenceStatus.PARTIALLY_SUPPORTED

              # If not supported, mark each key_term as forbidden
              if overall_status == EvidenceStatus.NOT_SUPPORTED:
                  not_supported_reqs.append(req.text)
                  for term in req.key_terms:
                      if term not in forbidden:
                          forbidden.append(term)
              elif overall_status == EvidenceStatus.PARTIALLY_SUPPORTED:
                  partial_reqs.append(req.text)
              else:
                  supported_reqs.append(req.text)

              matches.append(RequirementMatch(
                  requirement=req,
                  evidence_status=overall_status,
                  supporting_evidence=supporting,
                  adjacent_evidence=adjacent,
                  allowed_claim=req.text if overall_status != EvidenceStatus.NOT_SUPPORTED else None,
              ))

          # Update evidence set's unsupported_claims
          evidence.unsupported_claims = list(set(forbidden))

          return TailoringPlan(
              evidence_set=evidence,
              requirement_matches=matches,
              supported_requirements=supported_reqs,
              partially_supported_requirements=partial_reqs,
              not_supported_requirements=not_supported_reqs,
              forbidden_claims=forbidden,
              safe_skills=safe_skills,
              years_of_experience=evidence.years_of_experience,
          )

      def _extract_key_terms(self, text: str) -> list[str]:
          """Extract individual technology/skill tokens from a requirement phrase."""
          # Split on common delimiters
          parts = re.split(r"[,;/]|\s+and\s+|\s+or\s+|\s+&\s+", text, flags=re.IGNORECASE)
          terms = []
          for p in parts:
              clean = p.strip().rstrip(".")
              if 1 < len(clean) <= 50:
                  terms.append(clean)
          return terms if terms else [text.strip()]
  ```

  **Why:** The deny list prevents the most common false equivalences. All matching is string-equality against the evidence set — no semantic inference that can hallucinate support. Forbidden claims are populated deterministically so downstream prompts can use them as explicit blocklists.

  **Verify:** `cd backend && python -m pytest tests/test_evidence_grounding.py -v -k "test_requirement"` — all matcher tests pass.

---

## TASK 4 — Fix `REWRITE_SYSTEM_PROMPT` in `rewrite_service.py`

- [ ] **4.** Remove the mandatory keyword weaving rule (Rule 1) and mandatory metric fabrication rule (Rule 3).

  **File:** `backend/app/services/rewrite_service.py`

  **Old text (lines 65–100, the `REWRITE_SYSTEM_PROMPT` constant):**
  ```
  MANDATORY RULES:
  1. **Mandatory JD Keyword Integration**: Every single bullet point MUST be updated to seamlessly weave in relevant domain keywords, frameworks, tools, software platforms, methodologies, and concepts from the Target Job Description ...
  2. **Google XYZ Action-Impact Formula**: ...
  3. **Metric & Scale Indicators**: Ensure every bullet point features measurable metric impact or scale indicators suited to the candidate's industry (e.g., "% cost reduction", "% efficiency gain", "revenue or quota generated", "error rate reduction", "turnaround time acceleration", "volume or team scale managed").
  4. **Strict Factual Preservation**: ...
  5. **Exact Line Count & Structure**: ...
  6. **Clean Output**: ...
  ```

  **New text (replace the entire `REWRITE_SYSTEM_PROMPT` constant):**
  ```python
  REWRITE_SYSTEM_PROMPT = """\
  You are a senior executive recruiter and master ATS resume editor.
  You are rewriting a candidate's resume section (e.g., Professional Experience, Projects, Work History) to improve ATS keyword alignment and recruiter impact against the Target Job Description, while staying strictly grounded in the candidate's actual experience.

  MANDATORY RULES:
  1. **Evidence-Grounded Keyword Alignment**: You may only emphasise or reframe skills, tools, and technologies that are already present in the candidate's resume (provided in the EVIDENCE CONTEXT and ORIGINAL SECTION CONTENT). Do NOT introduce any technology, tool, framework, or skill that does not appear in the candidate's own text.
  2. **Google XYZ Action-Impact Formula**: Structure bullet points using Google's XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]". Start each bullet with a distinct, high-impact action verb (e.g., Spearheaded, Orchestrated, Executed, Optimized, Negotiated, Reconciled, Accelerated, Championed).
  3. **Preserve Existing Metrics Exactly**: Do NOT add new metrics, percentages, or numbers. If the original bullet contains a metric (e.g., "40% reduction", "5x growth"), preserve it verbatim. If the original bullet has no metric, do NOT invent one.
  4. **Strict Factual Preservation**: Keep Job Titles, Company Names, Employment Dates, and Locations 100% identical. NEVER invent fake companies, fake degrees, or fake dates.
  5. **Exact Line Count & Structure**: Output EXACTLY the same number of bullet points as the input. Preserve company/title header lines at the top of each entry.
  6. **Clean Output**: Output ONLY the polished section text. Do NOT include preambles or commentary.
  """
  ```

  **Why:** Rule 1 was instructing the model to inject JD keywords regardless of the candidate's evidence — the primary hallucination vector (H1 in the audit). Rule 3 was instructing the model to fabricate metrics when none existed in the original — a direct instruction to invent quantitative claims. The replacements maintain formatting quality while grounding all changes in existing evidence.

  **Verify:** `cd backend && python -c "from app.services.rewrite_service import REWRITE_SYSTEM_PROMPT; assert 'MUST be updated to seamlessly weave' not in REWRITE_SYSTEM_PROMPT; assert 'Metric & Scale Indicators' not in REWRITE_SYSTEM_PROMPT; assert 'Preserve Existing Metrics Exactly' in REWRITE_SYSTEM_PROMPT; print('OK')"` — prints `OK`.

---

## TASK 5 — Fix `SKILLS_REWRITE_SYSTEM_PROMPT` in `rewrite_service.py`

- [ ] **5.** Remove Rule 4 that weaves JD skills into the candidate's skills section.

  **File:** `backend/app/services/rewrite_service.py`

  **Old Rule 4 (inside `SKILLS_REWRITE_SYSTEM_PROMPT`):**
  ```
  4. **Target Job Keywords**: Intelligently weave missing keywords and tools from the Target Job Description into the appropriate matching categories.
  ```

  **New Rule 4:**
  ```
  4. **Resume-Only Skills**: Only use skills that are already present in the candidate's resume. Do NOT add skills, tools, frameworks, or technologies from the Target Job Description that are absent from the candidate's original resume text. Reordering and rephrasing existing skills is permitted.
  ```

  **Why:** "Missing" JD keywords are missing because the candidate does not have them — adding them is fabrication (H5 in the audit). The replacement permits only reordering/rephrasing of existing skills.

  **Verify:** `cd backend && python -c "from app.services.rewrite_service import SKILLS_REWRITE_SYSTEM_PROMPT; assert 'Intelligently weave missing keywords' not in SKILLS_REWRITE_SYSTEM_PROMPT; assert 'Resume-Only Skills' in SKILLS_REWRITE_SYSTEM_PROMPT; print('OK')"` — prints `OK`.

---

## TASK 6 — Fix `SUMMARY_REWRITE_SYSTEM_PROMPT` in `rewrite_service.py`

- [ ] **6.** Add two explicit rules: no new technologies, no YoE inflation.

  **File:** `backend/app/services/rewrite_service.py`

  **Current `SUMMARY_REWRITE_SYSTEM_PROMPT` ends at Rule 5.** Replace with:

  ```python
  SUMMARY_REWRITE_SYSTEM_PROMPT = """\
  You are a senior hiring manager, executive recruiter, and master resume writer.
  You are rewriting the PROFESSIONAL SUMMARY / PROFILE section of a resume to align with the target Job Description.

  CRITICAL PROFESSIONAL SUMMARY RULES:
  1. **Compelling 1-Paragraph Executive Summary**: Write a powerful 3-5 sentence professional summary tailored specifically to the target job title and core domain background.
  2. **Target Role Alignment**: Frame the candidate's skills and major achievements directly around the target role.
  3. **No Fluff or Invented Claims**: Keep all years of experience, core technical stack, and factual background grounded strictly in the candidate's actual resume evidence.
  4. **Active & High-Impact Tone**: Use confident, professional wording emphasizing problem-solving impact, production delivery, and domain expertise.
  5. **Output Bounds**: Output ONLY the polished summary paragraph text. Do not include preambles or section title headers.
  6. **Resume-Only Technologies & Skills**: Only reference technologies and skills that explicitly appear in the candidate's resume. Do NOT introduce any technology, framework, tool, or skill from the Job Description that is absent from the candidate's text.
  7. **Preserve Years of Experience Verbatim**: Use the candidate's stated years of experience exactly as written in their original summary (e.g. '7+ years'). NEVER adjust or inflate years of experience to match the job description's requirement.
  """
  ```

  **Why:** The original prompt had no rule preventing the summary from absorbing JD tech requirements or inflating YoE to match JD requirements — both are audit hallucination points H6. Rules 6 and 7 directly close these gaps.

  **Verify:** `cd backend && python -c "from app.services.rewrite_service import SUMMARY_REWRITE_SYSTEM_PROMPT; assert 'Resume-Only Technologies' in SUMMARY_REWRITE_SYSTEM_PROMPT; assert 'Preserve Years of Experience Verbatim' in SUMMARY_REWRITE_SYSTEM_PROMPT; print('OK')"` — prints `OK`.

---

## TASK 7 — Fix all four system prompts in `tailor_orchestration_service.py`

- [ ] **7.** Replace `TAILOR_EXPERIENCE_SYSTEM`, `TAILOR_PROJECTS_SYSTEM`, `TAILOR_SKILLS_SYSTEM`, and `TAILOR_SUMMARY_SYSTEM` with evidence-grounded versions.

  **File:** `backend/app/services/tailor_orchestration_service.py`

  **Replace the four constants (lines 18–51) as follows:**

  **`TAILOR_SUMMARY_SYSTEM` — old:**
  ```
  "You are an executive resume strategist. Rewrite the professional summary to directly align with the target job title and job description. Frame the narrative around the target role's core competencies while preserving authentic experience. NEVER fabricate fake companies or degree titles. Output ONLY the polished summary paragraph (3-4 sentences max) — no headers or preamble."
  ```
  **`TAILOR_SUMMARY_SYSTEM` — new:**
  ```python
  TAILOR_SUMMARY_SYSTEM = (
      "You are an executive resume strategist. Rewrite the professional summary to align with the target job title and job description. "
      "EVIDENCE CONSTRAINTS: (1) Only reference technologies and skills that appear in the candidate's original resume text provided below. "
      "(2) Do NOT introduce any technology, tool, or skill from the JD that is absent from the candidate's resume. "
      "(3) Preserve the candidate's years of experience VERBATIM — never adjust the number upward or downward to match the JD requirement. "
      "(4) NEVER fabricate fake companies, degrees, or metrics. "
      "Output ONLY the polished summary paragraph (3-4 sentences max) — no headers or preamble."
  )
  ```

  **`TAILOR_EXPERIENCE_SYSTEM` — old Rule 1:**
  ```
  "1. MANDATORY: Every single bullet point MUST be updated to seamlessly weave in relevant keywords, tools, methodologies, and competencies from the target Job Description..."
  ```
  **`TAILOR_EXPERIENCE_SYSTEM` — new:**
  ```python
  TAILOR_EXPERIENCE_SYSTEM = (
      "You are a master resume editor and ATS optimizer.\n"
      "Rewrite work experience bullet points using the Google XYZ formula ('Accomplished [X] as measured by [Y], by doing [Z]').\n"
      "RULES:\n"
      "1. EVIDENCE-GROUNDED ONLY: Only use technologies, tools, and skills that appear in the candidate's original bullet text provided below. "
      "Do NOT weave in JD technologies or skills that are absent from the candidate's own text. "
      "You may reframe and emphasise what is already present.\n"
      "2. STRICTLY LOCK & PRESERVE REAL FACTS: Never change company names, job titles, start/end dates, employment years, or locations.\n"
      "3. PRESERVE METRICS VERBATIM: If the original bullet contains a number or percentage, keep it exactly. Do NOT add new metrics.\n"
      "4. Output EXACTLY the same number of bullets as input, one line per bullet.\n"
      "5. Do NOT include bullet symbols or preamble — plain text only."
  )
  ```

  **`TAILOR_SKILLS_SYSTEM` — old Rule 1:**
  ```
  "1. Intelligently weave target ATS skills, tools, and domain proficiencies from the job description into appropriate categories."
  ```
  **`TAILOR_SKILLS_SYSTEM` — new:**
  ```python
  TAILOR_SKILLS_SYSTEM = (
      "You are an ATS resume skills optimizer. Categorize and refine the skills section to maximize keyword match against the target job description.\n"
      "RULES:\n"
      "1. RESUME-ONLY SKILLS: Only use skills that are already present in the candidate's original skills text provided below. "
      "Do NOT add skills, tools, frameworks, or technologies from the job description that are absent from the candidate's resume.\n"
      "2. Preserve all core existing skills from the original candidate profile. You may reorder categories to prioritise JD-relevant ones.\n"
      "3. Output format must be strictly one line per category: 'CategoryName: Skill1, Skill2, Skill3...'"
  )
  ```

  **`TAILOR_PROJECTS_SYSTEM` — old Rule 1:**
  ```
  "1. MANDATORY: Seamlessly weave matching keywords, tools, and standards from the target Job Description into every project bullet point."
  ```
  **`TAILOR_PROJECTS_SYSTEM` — new:**
  ```python
  TAILOR_PROJECTS_SYSTEM = (
      "You are a master resume project strategist. Rewrite project descriptions and bullet points to highlight relevant methodologies, tools, and quantifiable impact.\n"
      "RULES:\n"
      "1. EVIDENCE-GROUNDED ONLY: Only use technologies and skills that already appear in the candidate's project text or technologies list provided below. "
      "Do NOT weave in JD keywords, tools, or standards that are absent from the candidate's own project description.\n"
      "2. STRICTLY LOCK & PRESERVE REAL FACTS: Never alter project names, company names, repository links, or dates.\n"
      "3. PRESERVE METRICS VERBATIM: Do NOT add new quantitative metrics. Only keep metrics already stated in the original project bullet.\n"
      "4. Output EXACTLY the same number of bullets as input, one line per bullet, plain text only."
  )
  ```

  **Why:** H2, H3, H4 from the audit — all four prompts instructed the model to source content from the JD (which contains requirements, not candidate facts). The replacements redirect the model to use only candidate text already provided in the user prompt.

  **Verify:** `cd backend && python -c "from app.services.tailor_orchestration_service import TAILOR_SKILLS_SYSTEM, TAILOR_EXPERIENCE_SYSTEM, TAILOR_PROJECTS_SYSTEM, TAILOR_SUMMARY_SYSTEM; assert 'MANDATORY: Every single bullet point MUST be updated to seamlessly weave' not in TAILOR_EXPERIENCE_SYSTEM; assert 'RESUME-ONLY SKILLS' in TAILOR_SKILLS_SYSTEM; assert 'EVIDENCE CONSTRAINTS' in TAILOR_SUMMARY_SYSTEM; assert 'EVIDENCE-GROUNDED ONLY' in TAILOR_PROJECTS_SYSTEM; print('OK')"` — prints `OK`.

---

## TASK 8 — Re-enable `sanitize_unsupported_skills_from_text`

- [ ] **8.** Remove the early-return stub that disables the sanitizer and expose the real implementation.

  **File:** `backend/app/services/rewrite_service.py`

  **Current state (lines 21–27):**
  ```python
  def sanitize_unsupported_skills_from_text(
      rewritten_text: str,
      unsupported_techs: set[str],
  ) -> tuple[str, list[str]]:
      """Preserve AI-woven target JD keywords without stripping them."""
      return rewritten_text, []

      stripped_terms: list[str] = []
      ...
  ```

  **Change:** Remove the early return and the misleading docstring. Replace with:
  ```python
  def sanitize_unsupported_skills_from_text(
      rewritten_text: str,
      unsupported_techs: set[str],
  ) -> tuple[str, list[str]]:
      """Strip any JD technology terms that are not supported by candidate evidence.

      Returns the cleaned text and the list of terms that were removed.
      If unsupported_techs is empty, returns the original text unchanged.
      """
      if not unsupported_techs:
          return rewritten_text, []

      stripped_terms: list[str] = []
      lines = rewritten_text.split("\n")
      ...  # (rest of the existing implementation below the old early return — unchanged)
  ```

  **Specifically:** Delete lines 24–25 (`"""Preserve AI-woven target JD keywords without stripping them."""` and `return rewritten_text, []`). Replace the docstring with the new one shown above. The full implementation already present below the early return is correct and requires no changes.

  **Why:** The sanitizer was deliberately disabled (audit note: "sanitizer is DISABLED"). The real implementation correctly strips hallucinated JD technologies from rewritten text using word-boundary regex matching. Re-enabling it is the Python-level safety net that catches any LLM slippage after the prompt fixes.

  **Verify:** `cd backend && python -c "from app.services.rewrite_service import sanitize_unsupported_skills_from_text; cleaned, stripped = sanitize_unsupported_skills_from_text('Built with Python and Kubernetes', {'Kubernetes'}); assert 'Kubernetes' not in cleaned; assert 'Kubernetes' in stripped; print('OK')"` — prints `OK`.

---

## TASK 9 — Fix `cover_letter_prompts.py`

- [ ] **9.** Update `COVER_LETTER_SYSTEM_PROMPT` to explicitly forbid unsupported technology claims, and update `build_cover_letter_input()` to inject a `FORBIDDEN CLAIMS` block.

  **File:** `backend/app/ai/cover_letter_prompts.py`

  **Change 1 — Update `COVER_LETTER_SYSTEM_PROMPT`:**

  Current Rule 3:
  ```
  3. **Strict Grounding on Applied Resume & Confirmed Matched Skills ONLY**:
     - Base all technical claims, tools, and experience ONLY on the candidate's active applied resume sections and explicitly provided "CONFIRMED MATCHED SKILLS".
     - DO NOT invent missing skills, unconfirmed gaps, or technologies not present in the candidate's confirmed list/applied text.
  ```

  Replace Rule 3 with:
  ```
  3. **Strict Grounding on Applied Resume & Confirmed Matched Skills ONLY**:
     - Base all technical claims, tools, and experience ONLY on the candidate's active applied resume sections and explicitly provided "CONFIRMED MATCHED SKILLS".
     - DO NOT invent missing skills, unconfirmed gaps, or technologies not present in the candidate's confirmed list/applied text.
     - If a === FORBIDDEN CLAIMS === block is provided in the user prompt, you MUST NOT mention any term listed there as a skill or technology the candidate possesses. These terms are absent from the candidate's resume.
  ```

  **Change 2 — Update `build_cover_letter_input()` signature and body:**

  Old signature:
  ```python
  def build_cover_letter_input(
      candidate_name: str,
      target_role: str,
      summary_text: str,
      job_description_text: str,
      evidence_context: str = "",
      confirmed_matched_skills: list[str] | None = None,
  ) -> str:
  ```

  New signature (add `forbidden_claims` parameter):
  ```python
  def build_cover_letter_input(
      candidate_name: str,
      target_role: str,
      summary_text: str,
      job_description_text: str,
      evidence_context: str = "",
      confirmed_matched_skills: list[str] | None = None,
      forbidden_claims: list[str] | None = None,
  ) -> str:
  ```

  After the `confirmed_matched_skills` block in the function body, add:
  ```python
  if forbidden_claims:
      parts.extend([
          "",
          "=== FORBIDDEN CLAIMS (DO NOT ATTRIBUTE THESE TO THE CANDIDATE) ===",
          "The following terms are NOT supported by the candidate's resume. Do NOT claim the candidate has these skills or technologies:",
          ", ".join(forbidden_claims),
      ])
  ```

  **Why:** The cover letter generation path had no mechanism to block JD terms that the candidate doesn't have. The `FORBIDDEN CLAIMS` block gives the LLM an explicit list; combined with the prompt rule, this is the strongest available instruction short of post-processing.

  **Verify:** `cd backend && python -c "from app.ai.cover_letter_prompts import build_cover_letter_input; p = build_cover_letter_input('Jane', 'Engineer', 'summary', 'jd', forbidden_claims=['Kubernetes', 'RAG']); assert 'FORBIDDEN CLAIMS' in p; assert 'Kubernetes' in p; print('OK')"` — prints `OK`.

---

## TASK 10 — Fix `cover_letter_service.py`

- [ ] **10.** Use original resume summary (not rewritten summary) as primary grounding; add `_validate_cover_letter_claims()` post-generation strip.

  **File:** `backend/app/services/cover_letter_service.py`

  **Change 1 — Summary extraction order (lines 42–55 of the service):**

  Current logic: if `request.rewritten_sections` contains a summary key, use the rewritten version as `summary_text`.

  New logic: always extract `summary_text` from the original parsed DOCX sections first. The rewritten sections may be passed as `evidence_context` for context, but must never replace the source-of-truth summary. 

  Specifically, change the extraction block:
  ```python
  # OLD: uses rewritten summary as primary
  if request.rewritten_sections:
      for sec_key, text in request.rewritten_sections.items():
          if "summary" in sec_key.lower() or "profile" in sec_key.lower():
              summary_text = text          # ← this used rewritten text as ground truth
          else:
              evidence_parts.append(...)

  if not summary_text:
      for sec in doc_sections.sections:
          if "summary" in sec.title.lower() ...:
              summary_text = ...
  ```

  Replace with:
  ```python
  # NEW: always use original summary from parsed DOCX as ground truth
  for sec in doc_sections.sections:
      if "summary" in sec.title.lower() or "profile" in sec.title.lower():
          summary_text = "\n".join([p.text for p in sec.paragraphs if p.text.strip()])
          break

  # Rewritten sections go only into evidence_parts (context, not ground truth)
  if request.rewritten_sections:
      for sec_key, text in request.rewritten_sections.items():
          evidence_parts.append(f"[{sec_key.title()} — Tailored]\n{text}")
  
  if not summary_text:
      for sec in doc_sections.sections:
          if sec.normalized_name != "header":
              evidence_parts.append(
                  f"[{sec.title}]\n" + "\n".join([p.text for p in sec.paragraphs if p.text.strip()])
              )
  ```

  **Change 2 — Add `_validate_cover_letter_claims()` method and call it post-generation:**

  Add this private method to `CoverLetterService`:
  ```python
  def _validate_cover_letter_claims(
      self, cover_letter_text: str, forbidden_terms: list[str]
  ) -> tuple[str, list[str]]:
      """Strip any forbidden technology/skill terms from cover letter text.

      Uses the same word-boundary regex logic as sanitize_unsupported_skills_from_text.
      Returns (cleaned_text, list_of_stripped_terms).
      """
      from app.services.rewrite_service import sanitize_unsupported_skills_from_text
      return sanitize_unsupported_skills_from_text(cover_letter_text, set(forbidden_terms))
  ```

  **Change 3 — In `generate_cover_letter()`, after `cover_letter_text = cover_letter_raw.strip()` (line ~86), add:**
  ```python
  # Post-generation safety: strip any terms not in candidate's evidence
  # forbidden_claims comes from TailoringPlan.forbidden_claims passed via request
  if hasattr(request, 'forbidden_claims') and request.forbidden_claims:
      cover_letter_text, stripped = self._validate_cover_letter_claims(
          cover_letter_text, request.forbidden_claims
      )
      if stripped:
          logger.warning(
              "🛡️ [RoleCraft Shield] Stripped forbidden claims from cover letter",
              stripped=stripped,
          )
  ```

  **Change 4 — Add `forbidden_claims` field to `CoverLetterRequest` in `schemas/cover_letter.py`:**
  ```python
  forbidden_claims: list[str] | None = Field(
      default=None,
      description="Terms absent from candidate resume that must not appear as candidate skills in the cover letter."
  )
  ```

  **Why:** The rewritten summary may already contain hallucinated JD tech (from the now-fixed but still-executed LLM rewrite path). Using it as ground truth for the cover letter propagates those hallucinations. The original DOCX summary is the only safe grounding source. The post-generation `_validate_cover_letter_claims()` is a runtime safety net analogous to the `sanitize_unsupported_skills_from_text` in the rewrite path.

  **Verify:** `cd backend && python -c "from app.schemas.cover_letter import CoverLetterRequest; r = CoverLetterRequest(document_id='x', job_description_text='jd', forbidden_claims=['Kubernetes']); assert r.forbidden_claims == ['Kubernetes']; print('OK')"` — prints `OK`.

---

## TASK 11 — Fix `review_prompts.py`

- [ ] **11.** Rename the `=== DETECTOR GAP ANALYSIS ===` section header and add an evidence guard to `REVIEW_INSTRUCTIONS`.

  **File:** `backend/app/ai/review_prompts.py`

  **Change 1 — In `build_review_input()` function (lines ~45–49):**

  Old:
  ```python
  "=== DETECTOR GAP ANALYSIS ===",
  f"Overall Match Coverage: {comparison.overall_coverage_percentage}%",
  f"Missing Skills: {', '.join(comparison.missing_skills)}",
  f"Missing Technologies: {', '.join(comparison.missing_technologies)}",
  ```

  New:
  ```python
  "=== MATCH ANALYSIS (FOR CONTEXT ONLY) ===",
  "NOTE: The items below are JD requirements not found in the candidate's resume text. They are gaps, NOT candidate claims.",
  "Do NOT recommend adding these unless the candidate's resume under === CANDIDATE RESUME === contains direct supporting evidence.",
  f"Overall Match Coverage: {comparison.overall_coverage_percentage}%",
  f"Missing Skills (JD requirements absent from resume): {', '.join(comparison.missing_skills)}",
  f"Missing Technologies (JD requirements absent from resume): {', '.join(comparison.missing_technologies)}",
  ```

  **Change 2 — In `REVIEW_INSTRUCTIONS`, append a new principle 9:**

  Add after principle 8 (`**Concise Rationale**`):
  ```
  9. **Missing Items Are JD Requirements, Not Candidate Evidence**: The "Missing Skills" and "Missing Technologies" listed under === MATCH ANALYSIS === are JD requirements absent from the candidate's resume. They are provided for context only. NEVER recommend adding, highlighting, or introducing any missing skill or technology as a candidate qualification UNLESS you can directly cite supporting text from === CANDIDATE RESUME ===. Absence from the resume means the candidate does not have it.
  ```

  **Why:** The `DETECTOR GAP ANALYSIS` label and its content (missing skills/techs) were feeding the LLM a list of things the candidate doesn't have, presented without a clear note that they are gaps not candidate claims. The LLM was interpreting "missing X" as "X should appear in the review recommendations" and recommending the candidate add skills they don't have — the opposite of evidence-grounded advice (audit section 11). The renamed section and added NOTE + new principle 9 make the intent explicit.

  **Verify:** `cd backend && python -c "from app.ai.review_prompts import REVIEW_INSTRUCTIONS, build_review_input; assert 'Missing Items Are JD Requirements' in REVIEW_INSTRUCTIONS; print('OK')"` — prints `OK`.

---

## TASK 12 — Wire `TailoringPlan` into `tailor.py` endpoint

- [ ] **12.** After loading `StructuredResume` in the `/tailor` endpoint, call `EvidenceService` + `RequirementMatcher`, pass `TailoringPlan` into `TailorOrchestrationService.tailor_full_resume()`, and update the orchestration service's signature to accept and inject the plan.

  **File A:** `backend/app/api/v1/tailor.py`

  **Changes:**

  1. Add imports at the top:
  ```python
  from app.parsers.job_description_parser import parse_job_description
  from app.services.evidence_service import EvidenceService
  from app.services.requirement_matcher import RequirementMatcher
  from app.schemas.evidence import TailoringPlan
  ```

  2. In `tailor_resume()`, after `master_resume = StructuredResume.model_validate(master_data)`, add:
  ```python
  # Build evidence-grounded TailoringPlan before passing to LLM
  evidence_service = EvidenceService()
  matcher = RequirementMatcher()
  parsed_jd = parse_job_description(request.job_description)
  evidence_set = evidence_service.extract(master_resume)
  tailoring_plan = matcher.match(evidence_set, parsed_jd)

  logger.info(
      "TailoringPlan built",
      safe_skills=len(tailoring_plan.safe_skills),
      forbidden_claims=len(tailoring_plan.forbidden_claims),
  )
  ```

  3. Pass `tailoring_plan` to the orchestration service call:
  ```python
  tailored_resume, diff = tailor_service.tailor_full_resume(
      master_resume=master_resume,
      job_description=request.job_description,
      job_title=request.job_title,
      tailoring_plan=tailoring_plan,    # ← new parameter
  )
  ```

  **File B:** `backend/app/services/tailor_orchestration_service.py`

  **Changes:**

  1. Update `tailor_full_resume()` signature:
  ```python
  from app.schemas.evidence import TailoringPlan  # add import at top

  def tailor_full_resume(
      self,
      master_resume: StructuredResume,
      job_description: str,
      job_title: str,
      tailoring_plan: TailoringPlan | None = None,   # ← optional for backward compat
  ) -> tuple:
  ```

  2. Before the section loop, extract forbidden/safe context strings:
  ```python
  forbidden_block = ""
  safe_skills_block = ""
  years_block = ""
  if tailoring_plan:
      if tailoring_plan.forbidden_claims:
          forbidden_block = (
              "\n=== FORBIDDEN: DO NOT CLAIM CANDIDATE HAS THESE (absent from resume) ===\n"
              + ", ".join(tailoring_plan.forbidden_claims)
          )
      if tailoring_plan.safe_skills:
          safe_skills_block = (
              "\n=== CANDIDATE VERIFIED SKILLS (use these freely) ===\n"
              + ", ".join(tailoring_plan.safe_skills[:50])
          )
      if tailoring_plan.years_of_experience:
          years_block = (
              f"\n=== CANDIDATE YEARS OF EXPERIENCE (use verbatim) ===\n"
              f"{tailoring_plan.years_of_experience}"
          )
  ```

  3. Pass `forbidden_block`, `safe_skills_block`, `years_block` into every `_rewrite_*` helper user prompt by appending them to the user_prompt string. In `_rewrite_summary()`:
  ```python
  user_prompt = (
      f"Target Role: {job_title}\n\n"
      f"Job Description:\n{jd[:3000]}\n\n"
      f"Original Summary:\n{original}\n\n"
      + safe_skills_block + years_block + forbidden_block +
      "\n\nRewrite the summary:"
  )
  ```

  Similarly prepend `forbidden_block` and `safe_skills_block` to experience, skills, and project user prompts (each `_rewrite_*` helper receives these as additional parameters).

  **Update each `_rewrite_*` helper signature** to accept optional `forbidden_block: str = ""` and `safe_block: str = ""`:
  ```python
  def _rewrite_experience_bullets(
      self, bullets, jd, job_title, role_title="", company="",
      forbidden_block: str = "", safe_block: str = ""
  ) -> list: ...

  def _rewrite_project_bullets(
      self, bullets, jd, job_title, project_name="",
      forbidden_block: str = "", safe_block: str = ""
  ) -> list: ...

  def _rewrite_skills(
      self, original_skills_text, jd, job_title,
      forbidden_block: str = "", safe_block: str = ""
  ) -> str: ...
  ```

  Pass `forbidden_block=forbidden_block, safe_block=safe_skills_block` when calling each helper in `tailor_full_resume()`.

  **Why:** Without wiring the plan into the orchestration service, the prompt fixes in Tasks 4–7 rely on the LLM following instructions but still have no machine-readable guardrail. Injecting `forbidden_claims` and `safe_skills` into every user prompt makes the constraint explicit and machine-verifiable per-request. The `tailoring_plan` parameter is `Optional` for backward compatibility with tests and other callers.

  **Verify:** `cd backend && python -c "from app.services.tailor_orchestration_service import TailorOrchestrationService; import inspect; sig = inspect.signature(TailorOrchestrationService.tailor_full_resume); assert 'tailoring_plan' in sig.parameters; print('OK')"` — prints `OK`.

---

## TASK 13 — Write `test_evidence_grounding.py`

- [ ] **13.** Create 13 self-contained unit tests (12 scenario tests + 1 Yieldmo integration test) in `backend/tests/test_evidence_grounding.py`.

  **File:** `backend/tests/test_evidence_grounding.py` (new file)

  **All tests must be self-contained: no HTTP, no DB, no filesystem access.**

  **Test structure:**

  ```python
  """
  Evidence-grounded tailoring tests.
  All tests are pure unit tests — no HTTP, no DB, no filesystem.
  """
  import sys, os
  sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

  import pytest
  from app.schemas.structured_resume import StructuredResume, ResumeSection
  from app.schemas.job_description import JobDescription
  from app.schemas.evidence import EvidenceLevel, EvidenceStatus, TailoringPlan
  from app.services.evidence_service import EvidenceService
  from app.services.requirement_matcher import RequirementMatcher
  from app.services.rewrite_service import (
      sanitize_unsupported_skills_from_text,
      REWRITE_SYSTEM_PROMPT,
      SKILLS_REWRITE_SYSTEM_PROMPT,
      SUMMARY_REWRITE_SYSTEM_PROMPT,
  )
  from app.services.tailor_orchestration_service import (
      TAILOR_EXPERIENCE_SYSTEM,
      TAILOR_SKILLS_SYSTEM,
      TAILOR_PROJECTS_SYSTEM,
      TAILOR_SUMMARY_SYSTEM,
  )
  from app.ai.cover_letter_prompts import build_cover_letter_input


  # ── Helpers ───────────────────────────────────────────────────────────────

  def _make_resume(skills=None, experience_bullets=None, summary=None, project_techs=None):
      """Build a minimal StructuredResume for testing."""
      sections = []
      order = 0
      if skills:
          sections.append(ResumeSection(
              section_type="skills",
              section_title="Technical Skills",
              order=order, visible=True,
              content={"categories": [{"category_name": "All", "skills": skills}]},
          ))
          order += 1
      if experience_bullets:
          sections.append(ResumeSection(
              section_type="experience",
              section_title="Professional Experience",
              order=order, visible=True,
              content={"entries": [{"job_title": "Engineer", "company": "Acme",
                                     "bullets": experience_bullets}]},
          ))
          order += 1
      if summary:
          sections.append(ResumeSection(
              section_type="summary",
              section_title="Professional Summary",
              order=order, visible=True,
              content={"text": summary},
          ))
          order += 1
      if project_techs:
          sections.append(ResumeSection(
              section_type="projects",
              section_title="Projects",
              order=order, visible=True,
              content={"entries": [{"name": "TestProject",
                                     "technologies": project_techs,
                                     "bullets": ["Built the thing"]}]},
          ))
      return StructuredResume(sections=sections)


  def _make_jd(**kwargs):
      defaults = dict(
          title="Software Engineer",
          company="TestCo",
          location="Remote",
          employment_type="Full-time",
          experience_required="5+ years",
          responsibilities=[],
          required_skills=[],
          preferred_skills=[],
          technologies=[],
          keywords=[],
          raw_text="",
      )
      defaults.update(kwargs)
      return JobDescription(**defaults)


  # ── Test 1: Skills listed in resume → LEVEL_1_DIRECT evidence ─────────────

  def test_listed_skills_become_direct_evidence():
      resume = _make_resume(skills=["Python", "FastAPI", "PostgreSQL"])
      evidence = EvidenceService().extract(resume)
      claims = [i.claim for i in evidence.items]
      assert "Python" in claims or any(c.lower() == "python" for c in claims)
      direct = [i for i in evidence.items if i.evidence_level == EvidenceLevel.LEVEL_1_DIRECT]
      assert len(direct) > 0


  # ── Test 2: Technologies in experience bullets → LEVEL_2_CONTEXTUAL ────────

  def test_experience_techs_become_contextual_evidence():
      resume = _make_resume(experience_bullets=["Deployed services using Docker and AWS"])
      evidence = EvidenceService().extract(resume)
      docker_items = [i for i in evidence.items if i.claim.lower() == "docker"]
      assert len(docker_items) > 0
      assert docker_items[0].evidence_level == EvidenceLevel.LEVEL_2_CONTEXTUAL


  # ── Test 3: JD-only tech → NOT_SUPPORTED (never listed in resume) ──────────

  def test_jd_only_tech_is_not_supported():
      resume = _make_resume(skills=["Python", "FastAPI"])
      jd = _make_jd(technologies=["Kubernetes", "Terraform"])
      evidence = EvidenceService().extract(resume)
      plan = RequirementMatcher().match(evidence, jd)
      assert "Kubernetes" in plan.forbidden_claims or "Kubernetes" in plan.not_supported_requirements


  # ── Test 4: Docker ≠ AWS deny list ────────────────────────────────────────

  def test_docker_does_not_imply_aws():
      resume = _make_resume(skills=["Python", "Docker"])
      jd = _make_jd(technologies=["AWS"])
      evidence = EvidenceService().extract(resume)
      plan = RequirementMatcher().match(evidence, jd)
      # AWS should be NOT_SUPPORTED when only Docker is present
      assert "AWS" in plan.forbidden_claims or "AWS" in plan.not_supported_requirements


  # ── Test 5: LLM API ≠ RAG/embeddings deny list ────────────────────────────

  def test_openai_does_not_imply_rag():
      resume = _make_resume(skills=["Python", "OpenAI"])
      jd = _make_jd(required_skills=["RAG", "embeddings"])
      evidence = EvidenceService().extract(resume)
      plan = RequirementMatcher().match(evidence, jd)
      rag_supported = any(
          m.evidence_status == EvidenceStatus.SUPPORTED
          for m in plan.requirement_matches
          if m.requirement.text.lower() in ("rag", "embeddings")
      )
      assert not rag_supported, "OpenAI API must not imply RAG/embeddings support"


  # ── Test 6: Sanitizer strips hallucinated skills ──────────────────────────

  def test_sanitizer_strips_unsupported_tech():
      text = "Built services with Python, Docker, and Kubernetes"
      cleaned, stripped = sanitize_unsupported_skills_from_text(text, {"Kubernetes"})
      assert "Kubernetes" not in cleaned
      assert "Kubernetes" in stripped


  # ── Test 7: Sanitizer preserves supported skills ──────────────────────────

  def test_sanitizer_preserves_supported_tech():
      text = "Built services with Python and Docker"
      cleaned, stripped = sanitize_unsupported_skills_from_text(text, {"Kubernetes"})
      assert "Python" in cleaned
      assert "Docker" in cleaned
      assert stripped == []


  # ── Test 8: REWRITE_SYSTEM_PROMPT does NOT mandate keyword weaving ─────────

  def test_rewrite_prompt_no_mandatory_keyword_weaving():
      assert "MUST be updated to seamlessly weave" not in REWRITE_SYSTEM_PROMPT
      assert "Mandatory JD Keyword Integration" not in REWRITE_SYSTEM_PROMPT


  # ── Test 9: REWRITE_SYSTEM_PROMPT does NOT mandate metric fabrication ──────

  def test_rewrite_prompt_no_metric_fabrication():
      assert "Metric & Scale Indicators" not in REWRITE_SYSTEM_PROMPT
      assert "Ensure every bullet point features measurable metric" not in REWRITE_SYSTEM_PROMPT
      assert "Preserve Existing Metrics Exactly" in REWRITE_SYSTEM_PROMPT


  # ── Test 10: SKILLS_REWRITE_SYSTEM_PROMPT uses only resume skills ──────────

  def test_skills_prompt_no_jd_injection():
      assert "Intelligently weave missing keywords" not in SKILLS_REWRITE_SYSTEM_PROMPT
      assert "Resume-Only Skills" in SKILLS_REWRITE_SYSTEM_PROMPT


  # ── Test 11: TAILOR_SKILLS_SYSTEM uses only resume skills ─────────────────

  def test_tailor_skills_system_no_jd_injection():
      assert "Intelligently weave target ATS skills" not in TAILOR_SKILLS_SYSTEM
      assert "RESUME-ONLY SKILLS" in TAILOR_SKILLS_SYSTEM


  # ── Test 12: SUMMARY_REWRITE_SYSTEM_PROMPT preserves YoE ─────────────────

  def test_summary_prompt_preserves_years_of_experience():
      assert "Preserve Years of Experience Verbatim" in SUMMARY_REWRITE_SYSTEM_PROMPT
      assert "Resume-Only Technologies" in SUMMARY_REWRITE_SYSTEM_PROMPT


  # ── Test 13: Yieldmo integration scenario ─────────────────────────────────

  def test_yieldmo_integration_scenario():
      """
      Candidate has: Python, FastAPI, PostgreSQL, React, Docker, GitHub Actions.
      JD requires:   Python, RAG, Kubernetes, AWS, pgvector, embeddings.
      Expected:
        - Python → SUPPORTED
        - RAG, embeddings → NOT_SUPPORTED (OpenAI/LangChain not in resume)
        - Kubernetes → NOT_SUPPORTED
        - AWS → NOT_SUPPORTED (Docker alone ≠ AWS)
        - pgvector → NOT_SUPPORTED (PostgreSQL ≠ pgvector)
      """
      resume = _make_resume(
          skills=["Python", "FastAPI", "PostgreSQL", "React", "Docker"],
          experience_bullets=[
              "Built REST APIs with FastAPI and PostgreSQL achieving 99.9% uptime",
              "Automated CI/CD pipelines using GitHub Actions reducing deploy time by 40%",
          ],
          summary="5+ years Python developer building full-stack web applications.",
      )
      jd = _make_jd(
          required_skills=["Python", "RAG", "embeddings"],
          technologies=["Kubernetes", "AWS", "pgvector"],
      )
      evidence = EvidenceService().extract(resume)
      plan = RequirementMatcher().match(evidence, jd)

      # Python must be supported
      python_match = next(
          (m for m in plan.requirement_matches if m.requirement.text == "Python"), None
      )
      assert python_match is not None
      assert python_match.evidence_status == EvidenceStatus.SUPPORTED, "Python should be SUPPORTED"

      # RAG and embeddings must NOT be supported
      for unsupported_term in ["RAG", "embeddings", "Kubernetes", "AWS", "pgvector"]:
          match = next(
              (m for m in plan.requirement_matches
               if m.requirement.text.lower() == unsupported_term.lower()), None
          )
          if match:
              assert match.evidence_status != EvidenceStatus.SUPPORTED, \
                  f"{unsupported_term} must NOT be SUPPORTED without resume evidence"

      # Years of experience must be extracted correctly from summary
      assert evidence.years_of_experience == "5+ years", \
          f"Expected '5+ years', got '{evidence.years_of_experience}'"

      # Cover letter prompt must include forbidden claims block
      prompt = build_cover_letter_input(
          "Jane Doe", "AI Engineer", "5+ years Python developer",
          "We need RAG and Kubernetes experience",
          forbidden_claims=plan.forbidden_claims,
      )
      for forbidden_term in plan.forbidden_claims:
          assert forbidden_term in prompt, \
              f"Forbidden term '{forbidden_term}' must appear in the FORBIDDEN CLAIMS block"
      assert "FORBIDDEN CLAIMS" in prompt
  ```

  **Why:** 12 scenario tests verify each individual fix independently. The Yieldmo integration test exercises the full pipeline deterministically without any LLM calls, confirming the deny list and evidence extraction produce the correct `TailoringPlan` for a realistic candidate.

  **Verify:** `cd backend && python -m pytest tests/test_evidence_grounding.py -v` — all 13 tests must pass.

---

## TASK 14 — Update `README.md` and `DEPLOYMENT.md`

- [ ] **14.** Add an "Evidence-Grounded Tailoring Architecture" section to `README.md` and a deployment note to `DEPLOYMENT.md`.

  **File A:** `/Users/ahbarajaib/Documents/Projects/role_craft/README.md`

  **Where to insert:** After the `## Architecture` section (currently pointing to `docs/architecture.md`), add a new section:

  ```markdown
  ## Evidence-Grounded Tailoring (Milestone 23)

  RoleCraft now uses a two-stage, hallucination-resistant tailoring pipeline:

  ### Stage 1 — Deterministic Evidence Extraction (no LLM)

  Before any AI prompt is sent, `EvidenceService` scans the candidate's `StructuredResume` and extracts a `CandidateEvidenceSet`:
  - **LEVEL_1_DIRECT**: skills explicitly listed in the Skills section; technologies named in the summary.
  - **LEVEL_2_CONTEXTUAL**: technologies found in experience bullets and project descriptions.
  - **Years of experience**: parsed verbatim from the summary via regex (never inflated).

  `RequirementMatcher` then matches the evidence set against the parsed `JobDescription` to produce a `TailoringPlan`:
  - `safe_skills`: technologies the candidate demonstrably has — safe to use in any section.
  - `forbidden_claims`: JD terms absent from the candidate's resume — must not appear as candidate qualifications.
  - `years_of_experience`: verbatim string from the source resume.

  A built-in false-inference deny list prevents common hallucination shortcuts:

  | If JD requires | Candidate has | Inference blocked |
  |---------------|--------------|-------------------|
  | RAG / embeddings | OpenAI API | ✗ LLM API ≠ RAG |
  | AWS | Docker | ✗ Container ≠ cloud provider |
  | AWS CI/CD | GitHub Actions | ✗ CI tool ≠ AWS CI/CD |
  | Django | FastAPI | ✗ Different frameworks |
  | pgvector / vector DB | PostgreSQL | ✗ Relational DB ≠ vector DB |
  | BM25 / hybrid search | Elasticsearch | ✗ Search infra ≠ ranking models |

  ### Stage 2 — Evidence-Bounded LLM Rewrite

  Every AI prompt now receives:
  - `=== CANDIDATE VERIFIED SKILLS ===` — the `safe_skills` list
  - `=== FORBIDDEN CLAIMS ===` — the `forbidden_claims` list
  - `=== CANDIDATE YEARS OF EXPERIENCE ===` — the verbatim YoE string

  All system prompts enforce:
  - **No new technologies** — only reframe what is already in the candidate's text
  - **No metric fabrication** — preserve existing metrics verbatim; never add new ones
  - **No YoE inflation** — use the candidate's stated years exactly

  ### Python Safety Net

  After every LLM rewrite, `sanitize_unsupported_skills_from_text()` performs a word-boundary scan against `forbidden_claims` and strips any JD technology that slipped through despite the prompt constraints.

  ### Key Files

  | File | Role |
  |------|------|
  | `app/schemas/evidence.py` | Data model for evidence items, evidence levels, TailoringPlan |
  | `app/services/evidence_service.py` | Deterministic evidence extractor (no LLM) |
  | `app/services/requirement_matcher.py` | Deterministic JD-vs-evidence matcher with deny list |
  | `app/services/rewrite_service.py` | AI rewriter (prompts fixed; sanitizer re-enabled) |
  | `app/services/tailor_orchestration_service.py` | Full-resume tailor (prompts fixed; TailoringPlan injected) |
  | `app/ai/cover_letter_prompts.py` | Cover letter prompts (FORBIDDEN CLAIMS block added) |
  | `app/ai/review_prompts.py` | Review prompts (gap analysis renamed; evidence guard added) |
  | `tests/test_evidence_grounding.py` | 13 deterministic unit tests (no LLM calls) |
  ```

  **File B:** `/Users/ahbarajaib/Documents/Projects/role_craft/DEPLOYMENT.md`

  **Where to insert:** After section 2 ("Deploying the Backend API"), add a new sub-section:

  ```markdown
  ### Environment Note: Evidence-Grounded Tailoring

  The evidence-grounded tailoring pipeline (Milestone 23) is fully CPU-bound and requires no additional environment variables or external services. No vector DB, embedding service, or additional API keys are needed. The `EvidenceService` and `RequirementMatcher` run deterministically in-process. Ensure `backend/app/schemas/evidence.py`, `backend/app/services/evidence_service.py`, and `backend/app/services/requirement_matcher.py` are present in the deployed container — they are included in the standard `uv sync` install.

  To verify the pipeline is active after deployment:
  ```bash
  docker exec <container> python -c "from app.services.evidence_service import EvidenceService; print('Evidence pipeline OK')"
  ```
  ```

  **Why:** The user's original request explicitly requires updating all relevant markdown files. The README section documents the architecture for developers; the DEPLOYMENT note confirms no new infrastructure is required.

  **Verify:** `grep -n "Evidence-Grounded Tailoring" /Users/ahbarajaib/Documents/Projects/role_craft/README.md` and `grep -n "Evidence-Grounded Tailoring" /Users/ahbarajaib/Documents/Projects/role_craft/DEPLOYMENT.md` — both must match at least one line.

---

## Execution Order

Dependencies between tasks:

```
TASK 1  (evidence.py complete)
  └─► TASK 2  (evidence_service.py — imports evidence.py)
        └─► TASK 3  (requirement_matcher.py — imports evidence.py + job_description_parser.py)
              └─► TASK 12 (wire plan into tailor.py + orchestration service)
                    └─► TASK 13 (tests — imports all of the above)

TASK 4  (rewrite prompt fix)   ─┐
TASK 5  (skills prompt fix)    ─┤
TASK 6  (summary prompt fix)   ─┤─► TASK 13 (test assertions on prompt constants)
TASK 7  (tailor prompts fix)   ─┤
TASK 8  (sanitizer re-enable)  ─┘

TASK 9  (cover_letter_prompts.py) ─┐
TASK 10 (cover_letter_service.py) ─┴─► TASK 13 (test_yieldmo_integration uses build_cover_letter_input)

TASK 11 (review_prompts.py) ─► independent; TASK 13 does not directly test it

TASK 14 (README + DEPLOYMENT) ─► independent of all code tasks
```

Safe parallel execution groups:
- **Group A**: TASK 1 → TASK 2 → TASK 3 → TASK 12 (must be sequential)
- **Group B**: TASKS 4, 5, 6, 7, 8 (all edits to rewrite/tailor prompts — independent of each other but all in `rewrite_service.py` so do them in order: 4, 5, 6, then 7, then 8)
- **Group C**: TASKS 9, 10 (cover letter — 9 must precede 10 because 10 calls `build_cover_letter_input`)
- **Group D**: TASK 11 (independent)
- **Group E**: TASK 13 (runs after all code tasks complete)
- **Group F**: TASK 14 (fully independent; can be done anytime)

---

## Final Verification

After all tasks are complete:
```bash
cd backend
python -m pytest tests/test_evidence_grounding.py -v          # all 13 new tests pass
python -m pytest tests/test_job_parser_linkedin.py -v         # existing parser tests still pass
python -m pytest tests/test_extension.py -v                   # existing extension tests still pass
python -c "from app.services.evidence_service import EvidenceService; \
           from app.services.requirement_matcher import RequirementMatcher; \
           from app.schemas.evidence import TailoringPlan; print('All imports OK')"
```
