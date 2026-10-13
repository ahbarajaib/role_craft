"""Candidate Evidence schema.

Defines the structured internal representation of evidence extracted from a
candidate's resume.  Every factual claim that appears in a generated resume
or cover letter must be traceable back to an item in a CandidateEvidenceSet.

Design principles
-----------------
- The candidate resume is the ONLY source of candidate facts.
- Each EvidenceItem records what the claim is, where it came from, what
  exact text supports it, how strong the evidence is, and what type of
  experience it represents.
- The EvidenceLevel enum encodes how strongly a claim can be presented.
- JobRequirement / RequirementMatch record the JD-side analysis: what the
  job needs, and whether the candidate can honestly support it.
"""

from enum import StrEnum

from pydantic import BaseModel, Field

# ── Evidence strength levels ──────────────────────────────────────────────────

class EvidenceLevel(StrEnum):
    """How strongly the candidate's resume supports a claim.

    LEVEL_1_DIRECT: The candidate explicitly states the skill/technology.
        Allowed: mention, emphasise, rewrite, place in summary.

    LEVEL_2_CONTEXTUAL: The underlying experience clearly establishes it even
        without exact wording (e.g. "REST APIs" → "backend API development").
        Allowed: paraphrase into equivalent language; do not materially upgrade.

    LEVEL_3_ADJACENT: The candidate has adjacent/related experience but not
        the exact requirement.  Only the adjacent evidence may be stated.
        NOT allowed: claim the exact requirement as if it were held.

    LEVEL_4_NONE: No reasonable evidence exists.
        NOT allowed: include in resume or cover letter in any form.
    """
    LEVEL_1_DIRECT = "direct"
    LEVEL_2_CONTEXTUAL = "contextual"
    LEVEL_3_ADJACENT = "adjacent"
    LEVEL_4_NONE = "none"


class EvidenceCategory(StrEnum):
    """Broad category of the evidence item."""
    TECHNOLOGY = "technology"
    FRAMEWORK = "framework"
    TOOL = "tool"
    PLATFORM = "platform"
    LANGUAGE = "language"
    DATABASE = "database"
    SKILL = "skill"
    DOMAIN = "domain"
    RESPONSIBILITY = "responsibility"
    ACHIEVEMENT = "achievement"
    METRIC = "metric"
    PROJECT = "project"
    EXPERIENCE = "experience"
    EDUCATION = "education"
    CERTIFICATION = "certification"
    YEARS_OF_EXPERIENCE = "years_of_experience"
    OTHER = "other"


class EvidenceSourceType(StrEnum):
    """What kind of resume context the evidence comes from."""
    PROFESSIONAL_EXPERIENCE = "professional_experience"
    PROJECT_EXPERIENCE = "project_experience"
    LISTED_SKILL = "listed_skill"
    EDUCATION = "education"
    CERTIFICATION = "certification"
    SUMMARY = "summary"
    OTHER = "other"


# ── Core evidence item ────────────────────────────────────────────────────────

class EvidenceItem(BaseModel):
    """A single verifiable claim extracted from the candidate's resume.

    Every claim used in a tailored resume or cover letter must correspond to
    an EvidenceItem with evidence_level != LEVEL_4_NONE.
    """

    claim: str = Field(
        ...,
        description="The specific skill, technology, or fact being claimed.",
        examples=["Python", "FastAPI", "7+ years", "OpenAI API", "PostgreSQL"],
    )
    category: EvidenceCategory = Field(
        ...,
        description="Broad category of this claim.",
    )
    evidence_text: str = Field(
        ...,
        description="Exact or near-exact text from the candidate resume that supports this claim.",
    )
    source_section: str = Field(
        ...,
        description="Which resume section this evidence was found in (e.g. 'Technical Skills', 'Projects').",
    )
    source_type: EvidenceSourceType = Field(
        ...,
        description="What kind of resume context this evidence comes from.",
    )
    evidence_level: EvidenceLevel = Field(
        ...,
        description="How strongly this claim can be presented in the output resume.",
    )
    notes: str | None = Field(
        None,
        description="Human-readable note about any nuance (e.g. 'API usage only, not model training').",
    )


# ── Aggregate evidence set ────────────────────────────────────────────────────

class CandidateEvidenceSet(BaseModel):
    """The complete structured evidence extracted from one candidate's resume.

    This object is the only authoritative source of candidate facts during
    resume tailoring and cover letter generation.

    The LLM must not introduce any claim that does not correspond to an item
    in this set with evidence_level in {LEVEL_1_DIRECT, LEVEL_2_CONTEXTUAL,
    LEVEL_3_ADJACENT}.
    """

    candidate_name: str | None = Field(
        None, description="Full name of the candidate."
    )
    years_of_experience: str | None = Field(
        None,
        description=(
            "Verbatim years-of-experience string from the source resume "
            "(e.g. '7+ years'). NEVER inflate this value."
        ),
    )
    candidate_primary_title: str | None = Field(
        None,
        description="Verified primary or most recent role title from candidate's resume.",
    )

    # Categorised fast-lookup sets (derived from items)
    supported_technologies: list[str] = Field(
        default_factory=list,
        description=(
            "Technologies/frameworks/tools with LEVEL_1 or LEVEL_2 evidence. "
            "Safe to use as candidate skills."
        ),
    )
    adjacent_technologies: list[str] = Field(
        default_factory=list,
        description=(
            "Technologies with LEVEL_3 evidence only. May be alluded to as "
            "'adjacent experience' but must not be listed as held skills."
        ),
    )
    unsupported_claims: list[str] = Field(
        default_factory=list,
        description=(
            "Terms that appear in the JD but have NO evidence in the resume. "
            "These MUST NOT appear as candidate qualifications anywhere."
        ),
    )

    items: list[EvidenceItem] = Field(
        default_factory=list,
        description="Full list of evidence items extracted from the resume.",
    )

    def get_items_by_level(self, level: EvidenceLevel) -> list[EvidenceItem]:
        return [i for i in self.items if i.evidence_level == level]

    def get_items_by_category(self, category: EvidenceCategory) -> list[EvidenceItem]:
        return [i for i in self.items if i.category == category]

    def is_supported(self, claim: str) -> bool:
        """Return True if the claim has LEVEL_1 or LEVEL_2 evidence."""
        claim_lower = claim.lower().strip()
        return any(
            i.claim.lower().strip() == claim_lower
            and i.evidence_level in (EvidenceLevel.LEVEL_1_DIRECT, EvidenceLevel.LEVEL_2_CONTEXTUAL)
            for i in self.items
        )

    def is_at_least_adjacent(self, claim: str) -> bool:
        """Return True if the claim has LEVEL_1, LEVEL_2, or LEVEL_3 evidence."""
        claim_lower = claim.lower().strip()
        return any(
            i.claim.lower().strip() == claim_lower
            and i.evidence_level != EvidenceLevel.LEVEL_4_NONE
            for i in self.items
        )


# ── Job requirement classification ───────────────────────────────────────────

class RequirementType(StrEnum):
    REQUIRED = "required"
    PREFERRED = "preferred"
    RESPONSIBILITY = "responsibility"
    DOMAIN = "domain"
    QUALIFICATION = "qualification"


class EvidenceStatus(StrEnum):
    """Whether candidate evidence supports a specific job requirement."""
    SUPPORTED = "SUPPORTED"
    PARTIALLY_SUPPORTED = "PARTIALLY_SUPPORTED"
    NOT_SUPPORTED = "NOT_SUPPORTED"


class JobRequirement(BaseModel):
    """A single parsed requirement from the job description."""

    text: str = Field(..., description="The raw requirement text from the JD.")
    requirement_type: RequirementType = Field(..., description="Classification of this requirement.")
    key_terms: list[str] = Field(
        default_factory=list,
        description="Technology/skill terms extracted from this requirement.",
    )


class RequirementMatch(BaseModel):
    """Result of matching a single job requirement against candidate evidence."""

    requirement: JobRequirement
    evidence_status: EvidenceStatus
    supporting_evidence: list[EvidenceItem] = Field(
        default_factory=list,
        description="Evidence items that (fully or partially) support this requirement.",
    )
    adjacent_evidence: list[EvidenceItem] = Field(
        default_factory=list,
        description="Adjacent evidence items (LEVEL_3) — related but not equivalent.",
    )
    allowed_claim: str | None = Field(
        None,
        description=(
            "The strongest truthful claim that can be made for this requirement. "
            "None if NOT_SUPPORTED."
        ),
    )


class TailoringPlan(BaseModel):
    """Output of the pre-tailoring analysis step.

    Summarises what the candidate can and cannot claim, so that the LLM
    prompts receive deterministic, evidence-bounded instructions.
    """

    evidence_set: CandidateEvidenceSet
    requirement_matches: list[RequirementMatch] = Field(default_factory=list)

    supported_requirements: list[str] = Field(
        default_factory=list,
        description="JD requirement texts that are SUPPORTED by candidate evidence.",
    )
    partially_supported_requirements: list[str] = Field(
        default_factory=list,
        description="JD requirement texts that are PARTIALLY_SUPPORTED.",
    )
    not_supported_requirements: list[str] = Field(
        default_factory=list,
        description="JD requirement texts that are NOT_SUPPORTED — must NOT appear as candidate claims.",
    )

    forbidden_claims: list[str] = Field(
        default_factory=list,
        description=(
            "Exact terms (technologies, skills, concepts) that must not appear "
            "as candidate qualifications in the tailored resume or cover letter."
        ),
    )
    safe_skills: list[str] = Field(
        default_factory=list,
        description=(
            "Skills/technologies with LEVEL_1 or LEVEL_2 evidence. "
            "Safe to use in any section of the tailored resume."
        ),
    )
    years_of_experience: str | None = Field(
        None,
        description=(
            "Verbatim years-of-experience from source resume. "
            "Generated text must use this value exactly."
        ),
    )
    candidate_primary_title: str | None = Field(
        None,
        description="Verified primary or most recent role title from candidate's resume.",
    )


__all__ = [
    "CandidateEvidenceSet",
    "EvidenceCategory",
    "EvidenceItem",
    "EvidenceLevel",
    "EvidenceSourceType",
    "EvidenceStatus",
    "JobRequirement",
    "RequirementMatch",
    "RequirementType",
    "TailoringPlan",
]
