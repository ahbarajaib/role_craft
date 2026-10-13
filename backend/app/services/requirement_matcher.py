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
    CandidateEvidenceSet,
    EvidenceLevel,
    EvidenceStatus,
    JobRequirement,
    RequirementMatch,
    RequirementType,
    TailoringPlan,
)
from app.schemas.job_description import JobDescription

# ── False-inference deny list ─────────────────────────────────────────────────
# Maps a JD term (lowercase) to the set of candidate terms that do NOT imply it.
_FALSE_INFERENCE_DENY: dict[str, set[str]] = {
    "rag": {"openai", "langchain", "hugging face", "llm", "gpt", "anthropic", "llm api", "openai api"},
    "retrieval augmented generation": {"openai", "langchain", "hugging face", "llm", "gpt"},
    "embeddings": {"openai", "langchain", "hugging face", "llm", "gpt", "openai api"},
    "vector search": {"openai", "langchain", "postgresql", "elasticsearch", "openai api"},
    "vector database": {"postgresql", "mysql", "sqlite", "mongodb", "redis"},
    "pinecone": {"postgresql", "elasticsearch", "redis"},
    "weaviate": {"postgresql", "elasticsearch", "redis"},
    "chroma": {"postgresql", "elasticsearch"},
    "qdrant": {"postgresql", "elasticsearch"},
    "aws": {"docker", "github actions", "vercel", "netlify", "kubernetes", "github"},
    "aws ecs": {"docker", "kubernetes"},
    "aws ec2": {"docker"},
    "aws rds": {"postgresql", "mysql"},
    "aws s3": {"docker"},
    "aws iam": {"docker"},
    "aws ci/cd": {"github actions", "gitlab ci", "jenkins", "circleci"},
    "gcp": {"docker", "github actions", "vercel", "kubernetes"},
    "azure": {"docker", "github actions", "vercel", "kubernetes"},
    "cloud infrastructure": {"docker", "vercel", "netlify"},
    "terraform": {"docker", "kubernetes", "github actions"},
    "django": {"fastapi", "flask", "express", "nestjs"},
    "flask": {"fastapi", "django"},
    "fastapi": {"django", "flask"},
    "pgvector": {"postgresql"},
    "vector db": {"postgresql", "mysql", "sqlite", "mongodb"},
    "bm25": {"elasticsearch", "search", "postgresql"},
    "hybrid search": {"elasticsearch", "search", "postgresql"},
    "ranking models": {"elasticsearch", "search"},
    "reranking": {"elasticsearch", "search"},
    "machine learning engineering": {"openai", "langchain", "llm", "gpt", "openai api"},
    "ml engineering": {"openai", "langchain", "llm", "gpt", "openai api"},
    "model training": {"openai", "langchain", "llm", "gpt", "openai api"},
    "fine-tuning": {"openai", "langchain", "llm", "gpt", "openai api"},
    "react native": {"react"},
}

# Synonym normalisation: maps lowercase aliases → canonical lowercase for matching
_SYNONYMS: dict[str, str] = {
    "js": "javascript",
    "ts": "typescript",
    "postgres": "postgresql",
    "mongo": "mongodb",
    "k8s": "kubernetes",
    "tf": "terraform",
    "gh actions": "github actions",
    "langchain": "langchain",
    "openai api": "openai",
}


def _normalise(term: str) -> str:
    """Lowercase and apply synonym normalisation."""
    lower = term.lower().strip()
    return _SYNONYMS.get(lower, lower)


def _is_false_inference(jd_term: str, candidate_term: str) -> bool:
    """Return True if inferring jd_term from candidate_term is on the deny list."""
    jd_lower = _normalise(jd_term)
    cand_lower = _normalise(candidate_term)
    denied_for = _FALSE_INFERENCE_DENY.get(jd_lower, set())
    return cand_lower in denied_for


def _term_in_evidence(term: str, evidence: CandidateEvidenceSet) -> EvidenceStatus:
    """Check how strongly a single JD term is supported by candidate evidence."""
    term_norm = _normalise(term)

    # Direct support check (LEVEL_1 or LEVEL_2)
    for item in evidence.items:
        item_norm = _normalise(item.claim)
        if item_norm == term_norm and item.evidence_level in (
            EvidenceLevel.LEVEL_1_DIRECT, EvidenceLevel.LEVEL_2_CONTEXTUAL
        ):
            # But first, check the deny list — is this actually a false inference?
            # If the candidate item's source indicates it implies the JD term, check deny
            return EvidenceStatus.SUPPORTED

    # Check for adjacent matches
    for item in evidence.items:
        if item.evidence_level == EvidenceLevel.LEVEL_4_NONE:
            continue
        if _is_false_inference(term, item.claim):
            continue   # deny list: don't infer jd_term from this candidate skill
        item_norm = _normalise(item.claim)
        if item_norm == term_norm and item.evidence_level == EvidenceLevel.LEVEL_3_ADJACENT:
            return EvidenceStatus.PARTIALLY_SUPPORTED

    return EvidenceStatus.NOT_SUPPORTED


class RequirementMatcher:
    """Deterministically matches CandidateEvidenceSet against JobDescription."""

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
                text=skill,
                requirement_type=RequirementType.REQUIRED,
                key_terms=self._extract_key_terms(skill),
            ))
        for skill in job_description.preferred_skills:
            requirements.append(JobRequirement(
                text=skill,
                requirement_type=RequirementType.PREFERRED,
                key_terms=self._extract_key_terms(skill),
            ))
        for tech in job_description.technologies:
            requirements.append(JobRequirement(
                text=tech,
                requirement_type=RequirementType.DOMAIN,
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
                    if _normalise(i.claim) == _normalise(term)
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
                    # Invariant: Never forbid a skill that candidate actually has evidence for!
                    term_norm = _normalise(term)
                    is_safe = (
                        term in safe_skills
                        or term_norm in [_normalise(s) for s in safe_skills]
                        or evidence.is_supported(term)
                    )
                    if not is_safe and term not in forbidden:
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
            candidate_primary_title=evidence.candidate_primary_title,
        )

    def _extract_key_terms(self, text: str) -> list[str]:
        """Extract individual technology/skill tokens from a requirement phrase."""
        from app.services.evidence_service import _find_techs_in_text
        parts = re.split(r"[,;/]|\s+and\s+|\s+or\s+|\s+&\s+", text, flags=re.IGNORECASE)
        terms = []
        for p in parts:
            clean = p.strip().rstrip(".")
            found_techs = _find_techs_in_text(clean)
            if found_techs:
                terms.extend(found_techs)
            elif 1 < len(clean) <= 50:
                terms.append(clean)
        return list(dict.fromkeys(terms)) if terms else [text.strip()]
