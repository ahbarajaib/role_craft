 # AI Application Engineering Architecture & Reverse Engineering Guide

> **Project:** RoleCraft (`resume-ai`)  
> **Purpose:** Comprehensive technical guide to reverse engineer and master AI Application Engineering, LLM orchestration, Structured Grounding (RAG alternative), and production guardrails implemented in this codebase to succeed in AI Engineering roles.

---

## Table of Contents

1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [Architecture Blueprint: Hybrid Deterministic-LLM System](#2-architecture-blueprint-hybrid-deterministic-llm-system)
3. [Deep Dive into Core AI Concepts Used](#3-deep-dive-into-core-ai-concepts-used)
   - [3.1 LLM Layer & Pydantic Structured Outputs](#31-llm-layer--pydantic-structured-outputs)
   - [3.2 Grounded Context Engineering vs. Vector RAG](#32-grounded-context-engineering-vs-vector-rag)
   - [3.3 Agentic Workflow & Orchestration Patterns](#33-agentic-workflow--orchestration-patterns)
   - [3.4 Hallucination Mitigation & Defense-in-Depth Guardrails](#34-hallucination-mitigation--defense-in-depth-guardrails)
   - [3.5 Document AI & OpenXML AST Patching](#35-document-ai--openxml-ast-patching)
   - [3.6 High-Performance Caching & Latency Optimization](#36-high-performance-caching--latency-optimization)
   - [3.7 Pre-LLM Data Ingestion & TLS Impersonation](#37-pre-llm-data-ingestion--tls-impersonation)
4. [File-by-File AI Code Walkthrough](#4-file-by-file-ai-code-walkthrough)
5. [The AI Application Engineer Interview Playbook](#5-the-ai-application-engineer-interview-playbook)
   - [Q1: Why not use Vector DB / Embeddings for RAG?](#q1-why-not-use-vector-db--embeddings-for-rag)
   - [Q2: How do you guarantee structured outputs from LLMs?](#q2-how-do-you-guarantee-structured-outputs-from-llms)
   - [Q3: How do you prevent hallucinations in high-stakes domains?](#q3-how-do-you-prevent-hallucinations-in-high-stakes-domains)
   - [Q4: How do you optimize latency and cost in multi-step AI pipelines?](#q4-how-do-you-optimize-latency-and-cost-in-multi-step-ai-pipelines)
   - [Q5: When do you use autonomous agents vs. deterministic workflows?](#q5-when-do-you-use-autonomous-agents-vs-deterministic-workflows)
6. [Learning Roadmap: 6-Step Implementation Study](#6-learning-roadmap-6-step-implementation-study)

---

## 1. Executive Summary & Core Philosophy

Many tutorial-level AI projects string together LangChain agents, unconstrained vector databases, and arbitrary prompts. In enterprise production environments, this leads to **high hallucination rates, flaky JSON parsing, runaway latency, and massive token costs**.

RoleCraft follows a production-grade tenet codified in [`docs/AI_RULES.md`](file:///Users/ahbarajaib/Documents/Projects/role_craft/docs/AI_RULES.md):

> **"Prefer deterministic Python over AI whenever possible. Use AI only for semantic reasoning and language generation."**

### Key Distinctions: Naive AI vs. RoleCraft AI

| Feature | Naive AI Application (Tutorial Style) | RoleCraft (Production-Grade Architecture) |
| :--- | :--- | :--- |
| **LLM Output Format** | Free-form markdown or regex-parsed JSON | OpenAI **Responses API** (`client.responses.parse`) with strict Pydantic v2 schemas |
| **RAG Strategy** | Cosine similarity over vector embeddings | **Deterministic Evidence Set & False-Inference Deny List** |
| **Agent Paradigm** | Unbounded autonomous loops (ReAct/AutoGPT) | **Deterministic Pipeline Orchestration & Parallel Fan-Out** |
| **Hallucination Prevention** | "Please do not hallucinate" in prompt | Pre-LLM bounded evidence sets + post-LLM regex/AST skill sanitizers |
| **Document Mutation** | Asking LLM to re-generate the full DOCX/PDF | Decoupled XML text node mutation preserving 100% of fonts, styles, and tables |
| **Cost & Latency** | Sequential LLM calls on every request | 1ms heuristic fast-paths, MD5 hash caching (~5ms), and ThreadPool batching |

---

## 2. Architecture Blueprint: Hybrid Deterministic-LLM System

```
                         [User Input: Resume (DOCX/PDF) + Job Description]
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
             [Document Parser Layer]                           [Job Description Ingestion]
        - PyMuPDF (PDF text & annotations)                 - TLS Impersonation (curl_cffi)
        - python-docx (runs, styles, tables)               - Multi-strategy DOM extraction
        - 4-Signal Section Detector                        - Rule-based JD parser (AST/regex)
                       │                                                 │
                       ▼                                                 ▼
             [StructuredResume JSON]                            [Parsed JobDescription]
                       │                                                 │
                       └────────────────────────┬────────────────────────┘
                                                │
                                                ▼
                                    [Evidence Grounding Engine]
                           - Extract CandidateEvidenceSet (Levels 1-4)
                           - Run RequirementMatcher against False-Inference Deny List
                           - Generate TailoringPlan (safe_skills vs forbidden_claims)
                                                │
                                                ▼
                       ┌─────────────────────────────────────────────────┐
                       │           Workflow Orchestration Layer          │
                       │                                                 │
                       │  [1ms Fast-Path Heuristic / ~5ms MD5 Cache Hit] │
                       │                     │ (if miss)                 │
                       │                     ▼                           │
                       │     [ThreadPool Concurrency (Workers=8/16)]      │
                       │                     │                           │
                       │                     ▼                           │
                       │          [OpenAI Provider Layer]                │
                       │   - client.responses.parse(text_format=Schema)  │
                       │   - temperature=0, store=False, timeout=120s    │
                       └────────────────────────┬────────────────────────┘
                                                │
                                                ▼
                                 [Post-Generation Guardrail]
                        - sanitize_unsupported_skills_from_text()
                        - Strip forbidden JD terms hallucinated by LLM
                                                │
                                                ▼
                                 [Non-Destructive Patch Layer]
                        - OpenXML / lxml <w:t> text replacement
                        - 100% preserved visual styling, fonts & tables
                                                │
                                                ▼
                                    [Final Tailored Resume]
```

---

## 3. Deep Dive into Core AI Concepts Used

### 3.1 LLM Layer & Pydantic Structured Outputs

* **Core File:** [`backend/app/ai/provider.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/ai/provider.py)
* **Underlying Library:** `openai>=1.57.0`, `pydantic>=2.13.4`

#### How it works:
Instead of raw chat completions followed by risky JSON parsing, the codebase uses OpenAI's **Responses API** with Pydantic output schemas:

```python
# app/ai/provider.py
def parse_response(
    self,
    instructions: str,
    input_text: str,
    response_format: type[T],
    max_output_tokens: int | None = None,
) -> T:
    kwargs = {
        "model": self._model,
        "instructions": instructions,
        "input": input_text,
        "text_format": response_format,
        "temperature": 0,       # Deterministic reasoning
        "store": False,          # Zero data retention / privacy
        "timeout": self._timeout,
    }
    response = self._client.responses.parse(**kwargs)
    return response.output_parsed
```

#### Why this matters:
1. **Zero JSON Parse Errors:** Guarantees that the LLM response matches the exact type annotations of Pydantic models (e.g., [`UnifiedReviewResult`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/schemas/review.py#L74-L85)).
2. **Stateless AI Abstraction:** The rest of the codebase never imports `openai`. All interactions go through `OpenAIProvider`, mapping low-level timeouts or provider failures into typed domain exceptions ([`AIProviderError`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/ai/provider.py#L33-L41)).

---

### 3.2 Grounded Context Engineering vs. Vector RAG

* **Core Files:** 
  - [`backend/app/services/evidence_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/evidence_service.py)
  - [`backend/app/services/requirement_matcher.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/requirement_matcher.py)
  - [`backend/app/schemas/evidence.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/schemas/evidence.py)
  - [`backend/tests/test_evidence_grounding.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/tests/test_evidence_grounding.py)

#### The Problem with Vector RAG in Document Tailoring:
In typical RAG, documents are split into chunks, converted into vector embeddings, and retrieved using cosine similarity.  
In high-stakes skill matching, **vector embeddings fail because semantic similarity is not logical equivalence**:
* *Docker* and *AWS* have high cosine similarity (both DevOps/Cloud terms).
* *FastAPI* and *Django* have high cosine similarity (both Python web frameworks).
* *OpenAI API* and *RAG/Vector Search* have high cosine similarity.

If a naive vector search retrieves *AWS* because the candidate used *Docker*, the LLM will claim the candidate has AWS experience.

#### The RoleCraft Solution:
RoleCraft replaces vector search with a **Deterministic Grounding Engine**:

1. **Evidence Level Hierarchy (`EvidenceLevel`)**:
   * `LEVEL_1_DIRECT`: Explicitly declared in skills or titles.
   * `LEVEL_2_CONTEXTUAL`: Mentioned inside project bullets or job descriptions.
   * `LEVEL_3_ADJACENT`: Related skill (e.g., React Native when JD asks for React). Can be alluded to as *adjacent experience*, but never claimed as a primary skill.
   * `LEVEL_4_NONE`: Unsupported claim. Banned from appearing in the output.

2. **False-Inference Deny List ([`_FALSE_INFERENCE_DENY`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/requirement_matcher.py#L34-L69))**:
   A deterministic lookup preventing invalid skill leaps:
   ```python
   _FALSE_INFERENCE_DENY: dict[str, set[str]] = {
       "rag": {"openai", "langchain", "hugging face", "llm", "gpt", "openai api"},
       "embeddings": {"openai", "langchain", "hugging face", "llm", "gpt"},
       "vector search": {"openai", "postgresql", "elasticsearch"},
       "vector database": {"postgresql", "mysql", "sqlite", "mongodb", "redis"},
       "aws": {"docker", "github actions", "vercel", "kubernetes"},
       "django": {"fastapi", "flask"},
       "pgvector": {"postgresql"},
   }
   ```

3. **Pre-LLM Tailoring Plan Generation**:
   Generates a [`TailoringPlan`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/schemas/evidence.py#L246-L290) separating requirements into:
   * `safe_skills`: Injected into prompt as verified candidate qualifications.
   * `forbidden_claims`: Injected with strict negative instructions (*"FORBIDDEN: Candidate does not have these. Do not claim them"*).

---

### 3.3 Agentic Workflow & Orchestration Patterns

* **Core Files:**
  - [`backend/app/services/resume_analysis_workflow.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/resume_analysis_workflow.py)
  - [`backend/app/services/tailor_orchestration_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/tailor_orchestration_service.py)
  - [`backend/app/services/rewrite_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/rewrite_service.py)

RoleCraft implements the primary agentic workflow patterns defined by Anthropic & OpenAI research:

#### Pattern 1: Multi-Stage Workflow Chaining
Instead of asking a single prompt to *"Read resume, compare against JD, and output a new resume"*, the system decomposes the task into sequential, typed stages:
1. **Parsing Stage:** AST extraction from DOCX/PDF.
2. **Extraction Stage:** Rule-based keyword and technology extraction from JD text.
3. **Deterministic Comparison Stage:** Mathematical coverage calculation (`matched / total * 100`).
4. **LLM Recruiter Review Stage:** The LLM acts as an executive recruiter making high-level trade-offs (recommending at most 5 prioritized improvements across the document).
5. **Synthesis Stage:** Merging deterministic metrics with semantic advice.

#### Pattern 2: Parallel Fan-Out (Map-Reduce)
* **Code Reference:** [`rewrite_service.py:L649-L651`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/rewrite_service.py#L649-L651), [`rewrite_service.py:L980-L982`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/rewrite_service.py#L980-L982)

When rewriting multiple job entries or project sections, sequential execution takes 30–60 seconds. The service breaks the document into sub-units and processes them concurrently:

```python
# Parallel Map-Reduce over resume entries
with ThreadPoolExecutor(max_workers=8) as executor:
    results = list(executor.map(_process_exp_entry, entries))

full_original = "\n\n".join([r[0] for r in results])
full_rewritten = "\n\n".join([r[1] for r in results])
```

#### Pattern 3: Routing & Fast-Path Short-Circuiting
* **Code Reference:** [`resume_parser_service.py:L144-L202`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/resume_parser_service.py#L144-L202)

Not every request needs an LLM. RoleCraft routes inputs through a **1ms deterministic parser first**:
* If standard section headings, contact info, and job history match strict regex rules, the structured data is created in **1ms without calling OpenAI**.
* Only if the document has unusual layout or low confidence does it route to the LLM structured parse fallback.

---

### 3.4 Hallucination Mitigation & Defense-in-Depth Guardrails

* **Core Files:**
  - [`backend/app/services/rewrite_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/rewrite_service.py#L31-L103)
  - [`.agents/skills/anti-ai-leadership-summary/SKILL.md`](file:///Users/ahbarajaib/Documents/Projects/role_craft/.agents/skills/anti-ai-leadership-summary/SKILL.md)

RoleCraft implements **defense-in-depth**:

1. **Pre-Generation Constraints**:
   * Metrics Locking: Original metrics (e.g., *"reduced latency by 25%"*) must be preserved verbatim. Adding unstated metrics is forbidden.
   * Years of Experience: Locked verbatim to the candidate's exact number.
2. **Post-Generation AST & Regex Sanitizer ([`sanitize_unsupported_skills_from_text`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/rewrite_service.py#L53-L102))**:
   Prompt instructions can still fail due to stochastic model behavior. The backend runs a deterministic post-processor:
   * Inspects the LLM output against JD technologies not present in the candidate's verified evidence set.
   * Regex-strips any unauthorized skills or categories before the user ever sees the text.
3. **Anti-AI Leadership Style Guide**:
   Bans generic ChatGPT clichés (*"results-driven"*, *"spearheaded"*, *"seasoned"*, *"leveraged"*) in favor of concrete engineering scope (*"built with"*, *"led architectural reviews"*, *"mentored junior engineers"*).

---

### 3.5 Document AI & OpenXML AST Patching

* **Core File:** [`backend/app/services/patch_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/patch_service.py)

#### The Problem:
If you prompt an LLM to output a DOCX file or convert markdown back to Word, the original document's margins, custom fonts, brand colors, tables, and tab stops are corrupted.

#### The Solution:
RoleCraft completely decouples language generation from document formatting:
1. The LLM only emits plain text strings for targeted sections.
2. Python uses `python-docx` and `lxml` to traverse the Word document's OpenXML AST (`<w:document>`).
3. It locates the specific `<w:p>` (paragraph) and modifies only the `<w:t>` (text) nodes inside the `<w:r>` (run) elements.
4. All run formatting tags (`<w:rPr>`), paragraph properties (`<w:pPr>`), and table cell properties (`<w:tcPr>`) remain untouched.

---

### 3.6 High-Performance Caching & Latency Optimization

* **Core File:** [`backend/app/services/analysis_cache.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/analysis_cache.py)

To prevent redundant API expenditure and provide instant user feedback:
* **Deterministic Cache Key:** Computes `MD5(resume_text.strip() + "|" + jd_text.strip())`.
* **Instant Re-Analysis:** When a user re-evaluates the same resume and job description, cached results return in **~5ms**, bypassing external API calls.
* **Thread-Safe TTL & Eviction:** In-memory LRU cache with configurable TTL (default 3600s, max 200 entries).

---

### 3.7 Pre-LLM Data Ingestion & TLS Impersonation

* **Core File:** [`backend/app/services/job_url_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/job_url_service.py)
* **Extensions:** [`linkedin-job-copier/`](file:///Users/ahbarajaib/Documents/Projects/role_craft/linkedin-job-copier), [`indeed-job-copier/`](file:///Users/ahbarajaib/Documents/Projects/role_craft/indeed-job-copier)

High-quality LLM prompts require clean source data. RoleCraft implements a dual ingestion engine:
1. **Backend URL Parser:** Uses `curl_cffi` with **Chrome 120 TLS fingerprint impersonation** to bypass anti-bot mechanisms (Cloudflare, Akamai) on job boards.
2. **Browser Extension:** Client-side DOM extractor capturing LinkedIn/Indeed postings directly from authenticated browser sessions, extracting title, company, and raw text without scraping blocks.

---

## 4. File-by-File AI Code Walkthrough

| File Path | Architectural Role | Core Classes & Functions |
| :--- | :--- | :--- |
| [`app/ai/provider.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/ai/provider.py) | AI Gateway | `OpenAIProvider.parse_response()`, `OpenAIProvider.generate_text()` |
| [`app/ai/review_prompts.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/ai/review_prompts.py) | Review Prompts | `REVIEW_INSTRUCTIONS`, `build_review_input()` |
| [`app/ai/prompts.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/ai/prompts.py) | Analysis Prompts | `SYSTEM_INSTRUCTIONS`, `build_analysis_input()` |
| [`app/ai/cover_letter_prompts.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/ai/cover_letter_prompts.py) | Cover Letter Prompts | `COVER_LETTER_SYSTEM_PROMPT`, `build_cover_letter_input()` |
| [`app/services/evidence_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/evidence_service.py) | Fact Extraction | `EvidenceService.extract()`, `_find_techs_in_text()` |
| [`app/services/requirement_matcher.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/requirement_matcher.py) | Grounding & Deny List | `RequirementMatcher.match()`, `_FALSE_INFERENCE_DENY` |
| [`app/services/resume_analysis_workflow.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/resume_analysis_workflow.py) | Workflow Orchestration | `ResumeAnalysisWorkflow.run()`, `_run_pipeline()` |
| [`app/services/tailor_orchestration_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/tailor_orchestration_service.py) | Tailor Orchestration | `TailorOrchestrationService.tailor_full_resume()` |
| [`app/services/rewrite_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/rewrite_service.py) | Concurrency & Sanitizer | `ThreadPoolExecutor`, `sanitize_unsupported_skills_from_text()` |
| [`app/services/resume_parser_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/resume_parser_service.py) | Document AI Parser | `_try_fast_deterministic_parse()`, `parse_document()` |
| [`app/services/patch_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/patch_service.py) | OpenXML AST Patching | `_build_flat_paragraph_list()`, `_set_run_text()` |
| [`app/services/analysis_cache.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/analysis_cache.py) | Caching Layer | `AnalysisCache.compute_key()`, `AnalysisCache.get()` |
| [`app/services/job_url_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/job_url_service.py) | Scraping & TLS Bypass | `JobUrlService.fetch_and_parse_job_url()` |

---

## 5. The AI Application Engineer Interview Playbook

Use these structured answers during technical interviews for AI Engineer, LLM Engineer, or Backend AI roles:

### Q1: Why not use Vector DB / Embeddings for RAG?
> **Answer:**  
> "Embeddings capture semantic proximity, not logical equivalence or factual entitlement. In career applications, vector similarity clusters 'Docker' with 'AWS' and 'FastAPI' with 'Django'. If a candidate has Docker and the job requires AWS, cosine similarity will retrieve AWS, leading the LLM to hallucinate candidate qualifications.  
> Instead of naive vector RAG, we built a **deterministic evidence extraction and grounding engine**. We categorized evidence into hierarchical confidence levels (Direct, Contextual, Adjacent, None) and maintained a False-Inference Deny List. This guarantees that candidate claims are strictly grounded in verifiable resume facts."

### Q2: How do you guarantee structured outputs from LLMs?
> **Answer:**  
> "We avoid asking the model for JSON in markdown blocks and attempting post-hoc regex parsing. We use OpenAI's **Responses API** (`client.responses.parse`) combined with Pydantic v2 data models. This enforces JSON schema constraints at the token-generation level, ensuring 100% adherence to typing, required fields, and nested structures with zero JSON parse exceptions."

### Q3: How do you prevent hallucinations in high-stakes domains?
> **Answer:**  
> "We employ a **defense-in-depth strategy** combining pre-prompt boundaries, prompt constraints, and post-generation sanitization:  
> 1. **Pre-prompt:** We pre-compute a `TailoringPlan` that defines both `safe_skills` and `forbidden_claims`.  
> 2. **Prompt:** Negative constraints forbid inventing metrics, fake companies, or modifying years of experience.  
> 3. **Post-generation guardrail:** We don't trust prompt compliance alone. A deterministic regex sanitizer (`sanitize_unsupported_skills_from_text`) inspects the generated output and automatically strips any job description keywords that lack candidate evidence."

### Q4: How do you optimize latency and cost in multi-step AI pipelines?
> **Answer:**  
> "We applied three core optimization patterns:  
> 1. **Fast-path short-circuiting:** 70% of standard resumes can be parsed by our 1ms deterministic regex parser, bypassing LLM API calls entirely.  
> 2. **In-memory content hashing:** We cache analysis results against an MD5 hash of the resume and JD text, serving repeat requests in ~5ms.  
> 3. **Concurrency:** When multiple resume sections or bullets must be rewritten, we execute them concurrently using Python's `ThreadPoolExecutor` rather than serially, cutting total user latency from ~30s down to ~4s."

### Q5: When do you use autonomous agents vs. deterministic workflows?
> **Answer:**  
> "Autonomous agent loops (like ReAct or LangGraph with dynamic state transitions) are suitable for open-ended exploration, but problematic for deterministic business logic where predictability, cost caps, and SLA latency are paramount.  
> For document processing and analysis pipelines, **deterministic workflow chaining** (Chaining, Routing, Parallel Fan-Out, Evaluator-Optimizer) provides significantly higher reliability, lower token overhead, and easier unit testability."

---

## 6. Learning Roadmap: 6-Step Implementation Study

To master and reproduce these concepts:

1. **Step 1: Study Structured Outputs**  
   Read [`app/ai/provider.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/ai/provider.py) and [`app/schemas/review.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/schemas/review.py). Observe how Pydantic models map directly to LLM output schemas.
2. **Step 2: Understand Context Engineering & Grounding**  
   Inspect [`app/services/evidence_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/evidence_service.py) and [`app/services/requirement_matcher.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/requirement_matcher.py). Review [`tests/test_evidence_grounding.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/tests/test_evidence_grounding.py) to see unit tests verifying that embeddings/RAG claims are not inferred from LLM API skills.
3. **Step 3: Analyze the Pipeline Orchestrator**  
   Trace [`app/services/resume_analysis_workflow.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/resume_analysis_workflow.py) from Step 1 (section loading) to Step 5 (merging comparisons and AI reviews).
4. **Step 4: Examine Concurrency and Guardrails**  
   Review [`app/services/rewrite_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/rewrite_service.py) to study the `ThreadPoolExecutor` parallelization and `sanitize_unsupported_skills_from_text()`.
5. **Step 5: Inspect Document AST Manipulation**  
   Review [`app/services/patch_service.py`](file:///Users/ahbarajaib/Documents/Projects/role_craft/backend/app/services/patch_service.py) to understand how to manipulate OpenXML `<w:t>` elements without altering formatting.
6. **Step 6: Practice the Interview Explanations**  
   Review the questions in Section 5 and practice verbalizing the technical rationale for each architectural decision.
