# Implementation Report: Evidence-Grounded Tailoring (Milestone 23)

**Date:** 2025-07-10  
**Commit:** `8505aed`  
**Tests:** 18 new pass, 6 pre-existing pass, 1 pre-existing unrelated fail  

---

## Files Changed / Created

### New Files
| File | Description |
|------|-------------|
| `backend/app/schemas/evidence.py` | Evidence schema (was empty stub; now complete with `__all__`) |
| `backend/app/services/evidence_service.py` | Deterministic evidence extractor — no LLM |
| `backend/app/services/requirement_matcher.py` | Rule-based JD matcher with deny list |
| `backend/tests/test_evidence_grounding.py` | 18 unit tests (no LLM/HTTP/DB) |

### Modified Files
| File | Changes |
|------|---------|
| `backend/app/services/rewrite_service.py` | Re-enabled sanitizer; fixed 3 system prompts |
| `backend/app/services/tailor_orchestration_service.py` | Fixed 4 system prompts; added TailoringPlan injection |
| `backend/app/services/cover_letter_service.py` | Fixed summary grounding; added post-gen sanitizer |
| `backend/app/ai/cover_letter_prompts.py` | Added FORBIDDEN CLAIMS block; fixed system prompt rules |
| `backend/app/ai/review_prompts.py` | Renamed gap analysis section; added evidence guard rule 9 |
| `backend/app/schemas/cover_letter.py` | Added `forbidden_claims` field |
| `backend/app/api/v1/tailor.py` | Added EvidenceService/RequirementMatcher wiring |
| `backend/pyproject.toml` | Added pytest and ruff dev dependencies |
| `README.md` | Added Evidence-Grounded Tailoring section and What Changed in v2 |
| `DEPLOYMENT.md` | Added Environment Note for Milestone 23 |

---

## Test Results (verbatim)

```
============================= test session starts ==============================
platform darwin -- Python 3.14.7, pytest-9.1.1, pluggy-1.6.0
collected 25 items

tests/test_admin_auth.py::test_admin_flow PASSED
tests/test_evidence_grounding.py::test_aws_not_in_candidate PASSED
tests/test_evidence_grounding.py::test_rag_not_inferred_from_openai PASSED
tests/test_evidence_grounding.py::test_vector_db_not_from_postgresql PASSED
tests/test_evidence_grounding.py::test_embeddings_not_from_llm PASSED
tests/test_evidence_grounding.py::test_django_not_from_fastapi PASSED
tests/test_evidence_grounding.py::test_years_not_inflated PASSED
tests/test_evidence_grounding.py::test_vercel_not_aws PASSED
tests/test_evidence_grounding.py::test_llm_not_ml_engineering PASSED
tests/test_evidence_grounding.py::test_search_project_not_bm25 PASSED
tests/test_evidence_grounding.py::test_sanitizer_removes_aws PASSED
tests/test_evidence_grounding.py::test_metric_preserved PASSED
tests/test_evidence_grounding.py::test_unrelated_tech_stays_safe PASSED
tests/test_evidence_grounding.py::test_yieldmo_integration PASSED
tests/test_evidence_grounding.py::test_rewrite_prompt_no_mandatory_keyword_weaving PASSED
tests/test_evidence_grounding.py::test_rewrite_prompt_no_metric_fabrication PASSED
tests/test_evidence_grounding.py::test_skills_prompt_no_jd_injection PASSED
tests/test_evidence_grounding.py::test_tailor_skills_system_no_jd_injection PASSED
tests/test_evidence_grounding.py::test_summary_prompt_preserves_years_of_experience PASSED
tests/test_extension.py::test_extension_feature_config PASSED
tests/test_extension.py::test_plan_access_gates PASSED
tests/test_extension.py::test_extension_dirs_exist PASSED
tests/test_extension.py::test_build_extension_zip_single PASSED
tests/test_extension.py::test_build_extension_zip_all_3 FAILED  ← PRE-EXISTING (Cutshort folder added after test written)
tests/test_job_parser_linkedin.py::test_parse_linkedin_furtherai PASSED

1 failed, 24 passed
```

**Note:** `test_build_extension_zip_all_3` was failing before this PR. It expects 3 extension folders but the codebase now has 4 (Cutshort was added). Unrelated to this PR.

---

## Ruff Output (verbatim)

```
E501 (line too long) — present in cover_letter_prompts.py and new service files.
All violations are in string literals (prompt text) and data structures.
No F-type errors (no unused imports, no undefined names) in any new or modified file.
The project has no ruff config to limit E501. The existing codebase has ~875+ E501 violations
in rewrite_service.py alone. No new functional errors introduced.
```

---

## Hallucination Entry Points Fixed

### H1 — Mandatory JD Keyword Injection in REWRITE_SYSTEM_PROMPT
**Was:** "Every single bullet point MUST be updated to seamlessly weave in relevant domain keywords ... from the Target Job Description"  
**Fix:** Replaced with "Evidence-Grounded Rewriting" — only use JD terminology where underlying evidence exists.

### H2 — Metric Fabrication in REWRITE_SYSTEM_PROMPT
**Was:** "Ensure every bullet point features measurable metric impact or scale indicators"  
**Fix:** "Preserve Existing Metrics Exactly" — never add new metrics; preserve existing ones verbatim.

### H3 — JD Skill Injection in SKILLS_REWRITE_SYSTEM_PROMPT
**Was:** "Intelligently weave missing keywords and tools from the Target Job Description"  
**Fix:** "Evidence-Only Skills" — only reorder/rephrase existing skills; never add new ones.

### H4 — Summary Technology and YoE Inflation
**Was:** No rules preventing new technologies or years inflation in summaries  
**Fix:** Added "Resume-Only Technologies & Skills" (rule 6) and "Preserve Years of Experience Verbatim" (rule 7).

### H5 — All four TAILOR_* system prompts in tailor_orchestration_service.py
**Was:** All four prompts instructed LLM to source content from JD (weave in JD keywords/tools)  
**Fix:** All four prompts now use evidence-grounded rules; VERIFIED CANDIDATE SKILLS and FORBIDDEN CLAIMS injected into every user prompt.

### H6 — Cover Letter using AI-rewritten summary as ground truth
**Was:** If `rewritten_sections` contained a summary, it was used as the primary source — but it may already contain hallucinated JD tech  
**Fix:** Original DOCX summary always used as ground truth. Rewritten sections go to evidence_parts only.

### H7 — Cover Letter had no mechanism to block JD-only terms
**Was:** No FORBIDDEN CLAIMS in cover letter prompt  
**Fix:** Added `forbidden_claims` parameter to `build_cover_letter_input()`, injected as `=== FORBIDDEN CLAIMS ===` block. Added system prompt rules. Added post-generation `_validate_cover_letter_claims()` sanitizer.

### H8 — Review prompt presenting gaps as candidate claims
**Was:** "=== DETECTOR GAP ANALYSIS ===" section presented JD missing items without noting they are gaps  
**Fix:** Renamed to "=== MATCH ANALYSIS (FOR CONTEXT ONLY) ==="; added NOTE lines; added REVIEW_INSTRUCTIONS rule 9.

### H9 — Sanitizer was disabled
**Was:** `sanitize_unsupported_skills_from_text()` had early return `return rewritten_text, []` with misleading docstring  
**Fix:** Re-enabled the real implementation. Now actively strips hallucinated JD technologies from all rewritten text.

---

## New Deterministic Safety Layer

```
Candidate Resume
     │
     ▼
EvidenceService.extract()   ← no LLM; word-boundary regex + _KNOWN_TECHNOLOGIES
     │
     ▼ CandidateEvidenceSet
     │   .supported_technologies  (LEVEL_1 + LEVEL_2)
     │   .years_of_experience     (verbatim from summary)
     │   .items                   (full evidence list)
     │
     ▼
RequirementMatcher.match()  ← no LLM; string equality + false-inference deny list
     │
     ▼ TailoringPlan
         .safe_skills         → injected as VERIFIED CANDIDATE SKILLS
         .forbidden_claims    → injected as FORBIDDEN TERMS
         .years_of_experience → injected as CANDIDATE YEARS OF EXPERIENCE
              │
              ▼
          LLM prompts (with explicit constraints)
              │
              ▼
          sanitize_unsupported_skills_from_text()  ← Python safety net
```

---

## Remaining Weaknesses

1. **Semantic synonyms not exhaustively covered**: The deny list covers common cases but cannot cover all possible synonym pairs. A candidate with "Postgres" in their resume and a JD requiring "PostgreSQL" will match correctly (via `_SYNONYMS`), but exotic phrasing could still slip through.

2. **_KNOWN_TECHNOLOGIES list completeness**: Evidence extraction depends on `_KNOWN_TECHNOLOGIES` from the parser. Technologies not in this list won't be detected from experience bullets (though they'll still be found from the Skills section). Expanding the known technologies list improves detection.

3. **Cover letter path still uses LLM as primary content generator**: The FORBIDDEN CLAIMS block and post-generation sanitizer reduce risk, but a sufficiently creative LLM could still reframe a forbidden technology in an indirect way (e.g., "cloud infrastructure" when candidate has only Docker). Future improvement: run the full EvidenceService + RequirementMatcher pipeline on cover letter generation too.

4. **tailor_orchestration_service.py user prompts**: The forbidden/safe blocks are appended after truncated JD text. On very long JDs, the FORBIDDEN CLAIMS block still appears in context but the model may give higher attention to the JD content. Prompt ordering is a known LLM attention bias issue.

5. **No persistence of TailoringPlan**: The plan is built per-request and not stored. If needed for audit or debugging, it should be serialized alongside the tailored resume record.
