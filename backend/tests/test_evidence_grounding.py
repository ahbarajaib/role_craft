"""
Evidence-grounded tailoring tests.
All tests are pure unit tests — no HTTP, no DB, no filesystem.
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.schemas.structured_resume import StructuredResume, ResumeSection, ContactInfo, ParseConfidence
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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_resume(
    skills=None,
    experience_bullets=None,
    summary=None,
    project_techs=None,
):
    """Build a minimal StructuredResume for testing."""
    sections = []
    order = 0
    if skills:
        sections.append(ResumeSection(
            section_type="skills",
            section_title="Technical Skills",
            order=order,
            visible=True,
            content={"categories": [{"category_name": "All", "skills": skills}]},
        ))
        order += 1
    if experience_bullets:
        sections.append(ResumeSection(
            section_type="experience",
            section_title="Professional Experience",
            order=order,
            visible=True,
            content={"entries": [{"job_title": "Engineer", "company": "Acme",
                                   "bullets": experience_bullets}]},
        ))
        order += 1
    if summary:
        sections.append(ResumeSection(
            section_type="summary",
            section_title="Professional Summary",
            order=order,
            visible=True,
            content={"text": summary},
        ))
        order += 1
    if project_techs:
        sections.append(ResumeSection(
            section_type="projects",
            section_title="Projects",
            order=order,
            visible=True,
            content={"entries": [{"name": "TestProject",
                                   "technologies": project_techs,
                                   "bullets": ["Built the thing"]}]},
        ))
    return StructuredResume(
        contact_info=ContactInfo(full_name="Test Candidate"),
        sections=sections,
        parse_confidence=ParseConfidence(),
    )


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


# ── Test 1: AWS not in candidate → forbidden ──────────────────────────────────

def test_aws_not_in_candidate():
    """JD has AWS, candidate has no AWS → forbidden_claims contains 'AWS'."""
    resume = _make_resume(skills=["Python", "Docker", "FastAPI"])
    jd = _make_jd(technologies=["AWS"])
    evidence = EvidenceService().extract(resume)
    plan = RequirementMatcher().match(evidence, jd)
    lower_forbidden = [f.lower() for f in plan.forbidden_claims]
    assert "aws" in lower_forbidden, f"Expected 'aws' in forbidden_claims, got: {plan.forbidden_claims}"


# ── Test 2: RAG not inferred from OpenAI ──────────────────────────────────────

def test_rag_not_inferred_from_openai():
    """JD has RAG, candidate has OpenAI API → RAG is NOT_SUPPORTED."""
    resume = _make_resume(skills=["Python", "OpenAI"])
    jd = _make_jd(required_skills=["RAG"])
    evidence = EvidenceService().extract(resume)
    plan = RequirementMatcher().match(evidence, jd)
    rag_match = next(
        (m for m in plan.requirement_matches if m.requirement.text.lower() == "rag"), None
    )
    assert rag_match is not None, "RAG requirement should be in matches"
    assert rag_match.evidence_status == EvidenceStatus.NOT_SUPPORTED, \
        "OpenAI API must not imply RAG support"


# ── Test 3: Vector DB not inferred from PostgreSQL ────────────────────────────

def test_vector_db_not_from_postgresql():
    """JD has vector database/Pinecone, candidate has PostgreSQL → NOT_SUPPORTED."""
    resume = _make_resume(skills=["Python", "PostgreSQL"])
    jd = _make_jd(technologies=["Pinecone"], required_skills=["vector database"])
    evidence = EvidenceService().extract(resume)
    plan = RequirementMatcher().match(evidence, jd)
    pinecone_match = next(
        (m for m in plan.requirement_matches if m.requirement.text.lower() == "pinecone"), None
    )
    if pinecone_match:
        assert pinecone_match.evidence_status == EvidenceStatus.NOT_SUPPORTED, \
            "PostgreSQL must not imply Pinecone support"
    vector_db_match = next(
        (m for m in plan.requirement_matches if m.requirement.text.lower() == "vector database"), None
    )
    if vector_db_match:
        assert vector_db_match.evidence_status == EvidenceStatus.NOT_SUPPORTED, \
            "PostgreSQL must not imply vector database support"


# ── Test 4: Embeddings not inferred from LLM ──────────────────────────────────

def test_embeddings_not_from_llm():
    """JD has embeddings, candidate has OpenAI API/LLM → embeddings NOT_SUPPORTED."""
    resume = _make_resume(skills=["Python", "OpenAI"])
    jd = _make_jd(required_skills=["embeddings"])
    evidence = EvidenceService().extract(resume)
    plan = RequirementMatcher().match(evidence, jd)
    embed_match = next(
        (m for m in plan.requirement_matches if m.requirement.text.lower() == "embeddings"), None
    )
    assert embed_match is not None, "embeddings requirement should be in matches"
    assert embed_match.evidence_status == EvidenceStatus.NOT_SUPPORTED, \
        "LLM API must not imply embeddings support"


# ── Test 5: Django not inferred from FastAPI ──────────────────────────────────

def test_django_not_from_fastapi():
    """JD has Django, candidate has FastAPI → Django NOT_SUPPORTED, FastAPI SUPPORTED."""
    resume = _make_resume(skills=["Python", "FastAPI"])
    jd = _make_jd(technologies=["FastAPI"], required_skills=["Django"])
    evidence = EvidenceService().extract(resume)
    plan = RequirementMatcher().match(evidence, jd)

    django_match = next(
        (m for m in plan.requirement_matches if m.requirement.text.lower() == "django"), None
    )
    assert django_match is not None, "Django requirement should be in matches"
    assert django_match.evidence_status == EvidenceStatus.NOT_SUPPORTED, \
        "FastAPI must not imply Django support"

    fastapi_match = next(
        (m for m in plan.requirement_matches if m.requirement.text.lower() == "fastapi"), None
    )
    assert fastapi_match is not None, "FastAPI requirement should be in matches"
    assert fastapi_match.evidence_status == EvidenceStatus.SUPPORTED, \
        "FastAPI should be SUPPORTED when candidate has FastAPI"


# ── Test 6: Years not inflated ────────────────────────────────────────────────

def test_years_not_inflated():
    """JD requires 8 years, candidate has '7+ years' → plan.years_of_experience == '7+ years'."""
    resume = _make_resume(
        skills=["Python"],
        summary="7+ years of software development experience building web applications.",
    )
    jd = _make_jd(experience_required="8+ years")
    evidence = EvidenceService().extract(resume)
    plan = RequirementMatcher().match(evidence, jd)
    assert plan.years_of_experience == "7+ years", \
        f"Expected '7+ years', got: '{plan.years_of_experience}'"


# ── Test 7: Vercel not AWS ────────────────────────────────────────────────────

def test_vercel_not_aws():
    """JD has AWS, candidate has Vercel → AWS NOT_SUPPORTED."""
    resume = _make_resume(skills=["Python", "Vercel", "React"])
    jd = _make_jd(technologies=["AWS"])
    evidence = EvidenceService().extract(resume)
    plan = RequirementMatcher().match(evidence, jd)
    lower_forbidden = [f.lower() for f in plan.forbidden_claims]
    assert "aws" in lower_forbidden, f"Expected 'aws' in forbidden_claims, got: {plan.forbidden_claims}"


# ── Test 8: LLM API not ML engineering ───────────────────────────────────────

def test_llm_not_ml_engineering():
    """JD requires ML engineering, candidate has OpenAI API → ML engineering NOT_SUPPORTED."""
    resume = _make_resume(skills=["Python", "OpenAI"])
    jd = _make_jd(required_skills=["machine learning engineering"])
    evidence = EvidenceService().extract(resume)
    plan = RequirementMatcher().match(evidence, jd)
    ml_match = next(
        (m for m in plan.requirement_matches
         if "machine learning" in m.requirement.text.lower()), None
    )
    assert ml_match is not None, "ML engineering requirement should be in matches"
    assert ml_match.evidence_status == EvidenceStatus.NOT_SUPPORTED, \
        "OpenAI API must not imply ML engineering support"


# ── Test 9: Search project not BM25 ──────────────────────────────────────────

def test_search_project_not_bm25():
    """JD requires BM25, candidate has 'search' in project bullet → BM25 NOT_SUPPORTED."""
    resume = _make_resume(
        skills=["Python"],
        experience_bullets=["Built a search feature using PostgreSQL full-text search"],
    )
    jd = _make_jd(required_skills=["BM25"])
    evidence = EvidenceService().extract(resume)
    plan = RequirementMatcher().match(evidence, jd)
    bm25_match = next(
        (m for m in plan.requirement_matches if m.requirement.text.lower() == "bm25"), None
    )
    assert bm25_match is not None, "BM25 requirement should be in matches"
    assert bm25_match.evidence_status == EvidenceStatus.NOT_SUPPORTED, \
        "Search keyword alone must not imply BM25 support"


# ── Test 10: Sanitizer removes AWS ───────────────────────────────────────────

def test_sanitizer_removes_aws():
    """sanitize_unsupported_skills_from_text with AWS unsupported → result does not contain 'AWS'."""
    text = "Backend: Python, AWS, Docker"
    cleaned, stripped = sanitize_unsupported_skills_from_text(text, {"AWS"})
    assert "AWS" not in cleaned, f"Expected 'AWS' to be stripped, got: '{cleaned}'"
    assert "AWS" in stripped, f"Expected 'AWS' in stripped list, got: {stripped}"


# ── Test 11: Metric preserved in evidence ────────────────────────────────────

def test_metric_preserved():
    """Evidence extraction from bullet with '25%' → metric item exists in evidence set."""
    resume = _make_resume(
        experience_bullets=["Reduced latency by 25% through database optimization"],
    )
    evidence = EvidenceService().extract(resume)
    metric_items = [i for i in evidence.items if "25" in i.claim]
    assert len(metric_items) > 0, "Expected a metric evidence item for '25%'"


# ── Test 12: Unrelated tech stays in safe skills ─────────────────────────────

def test_unrelated_tech_stays_safe():
    """Candidate has React (not in JD) → React is in safe_skills."""
    resume = _make_resume(skills=["Python", "React", "PostgreSQL"])
    jd = _make_jd(technologies=["AWS", "Kubernetes"])
    evidence = EvidenceService().extract(resume)
    plan = RequirementMatcher().match(evidence, jd)
    lower_safe = [s.lower() for s in plan.safe_skills]
    assert "react" in lower_safe, f"Expected 'React' in safe_skills, got: {plan.safe_skills}"


# ── Test 13: Yieldmo integration scenario ────────────────────────────────────

def test_yieldmo_integration():
    """
    Candidate has: Python, FastAPI, React, PostgreSQL, Docker, GitHub Actions.
    JD requires:   Python, RAG, embeddings, Kubernetes, AWS, pgvector.
    Expected:
      - Python → SUPPORTED
      - RAG, embeddings → NOT_SUPPORTED
      - Kubernetes, AWS, pgvector → NOT_SUPPORTED
      - years == '7+ years'
    """
    resume = _make_resume(
        skills=["Python", "FastAPI", "React", "PostgreSQL", "Docker", "GitHub Actions"],
        experience_bullets=[
            "Built REST APIs with FastAPI and PostgreSQL achieving 99.9% uptime",
            "Automated CI/CD pipelines using GitHub Actions reducing deploy time by 40%",
        ],
        summary="7+ years Python developer building full-stack web applications.",
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
    assert python_match is not None, "Python requirement should be in matches"
    assert python_match.evidence_status == EvidenceStatus.SUPPORTED, \
        "Python should be SUPPORTED"

    # RAG, embeddings, Kubernetes, AWS, pgvector must NOT be supported
    for unsupported_term in ["RAG", "embeddings", "Kubernetes", "AWS", "pgvector"]:
        match = next(
            (m for m in plan.requirement_matches
             if m.requirement.text.lower() == unsupported_term.lower()), None
        )
        if match:
            assert match.evidence_status != EvidenceStatus.SUPPORTED, \
                f"{unsupported_term} must NOT be SUPPORTED without resume evidence"

    # Years must be preserved verbatim from the resume summary
    assert evidence.years_of_experience == "7+ years", \
        f"Expected '7+ years', got '{evidence.years_of_experience}'"

    # Cover letter prompt must include forbidden claims block
    prompt = build_cover_letter_input(
        "Jane Doe", "AI Engineer",
        "7+ years Python developer",
        "We need RAG and Kubernetes experience",
        forbidden_claims=plan.forbidden_claims,
    )
    for forbidden_term in plan.forbidden_claims:
        assert forbidden_term in prompt, \
            f"Forbidden term '{forbidden_term}' must appear in the FORBIDDEN CLAIMS block"
    assert "FORBIDDEN CLAIMS" in prompt


# ── Prompt constant sanity checks (fail-fast if prompts regress) ──────────────

def test_rewrite_prompt_no_mandatory_keyword_weaving():
    assert "MUST be updated to seamlessly weave" not in REWRITE_SYSTEM_PROMPT
    assert "Mandatory JD Keyword Integration" not in REWRITE_SYSTEM_PROMPT


def test_rewrite_prompt_no_metric_fabrication():
    assert "Metric & Scale Indicators" not in REWRITE_SYSTEM_PROMPT
    assert "Ensure every bullet point features measurable metric" not in REWRITE_SYSTEM_PROMPT
    assert "Preserve Existing Metrics Exactly" in REWRITE_SYSTEM_PROMPT


def test_skills_prompt_no_jd_injection():
    assert "Intelligently weave missing keywords" not in SKILLS_REWRITE_SYSTEM_PROMPT
    assert "Evidence-Only Skills" in SKILLS_REWRITE_SYSTEM_PROMPT


def test_tailor_skills_system_no_jd_injection():
    assert "Intelligently weave target ATS skills" not in TAILOR_SKILLS_SYSTEM
    assert "RESUME-ONLY SKILLS" in TAILOR_SKILLS_SYSTEM


def test_summary_prompt_preserves_years_of_experience():
    assert "Preserve Years of Experience Verbatim" in SUMMARY_REWRITE_SYSTEM_PROMPT
    assert "Resume-Only Technologies" in SUMMARY_REWRITE_SYSTEM_PROMPT
