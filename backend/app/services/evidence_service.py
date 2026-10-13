"""Evidence extraction service.

Deterministically extracts CandidateEvidenceSet from a StructuredResume.
No LLM is involved. Every claim is sourced from the candidate's actual resume text.
"""

import re

from app.parsers.job_description_parser import _KNOWN_TECHNOLOGIES
from app.schemas.evidence import (
    CandidateEvidenceSet,
    EvidenceCategory,
    EvidenceItem,
    EvidenceLevel,
    EvidenceSourceType,
)
from app.schemas.structured_resume import StructuredResume

# Build lowercase → canonical lookup once at import time (longest phrases first)
_TECH_LOWER: dict[str, str] = {
    t.lower(): t for t in sorted(_KNOWN_TECHNOLOGIES, key=len, reverse=True)
}

_YEARS_RE = re.compile(
    r"(\d+\+?\s*years?)",
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
        """Extract evidence from a StructuredResume and return a CandidateEvidenceSet."""
        items: list[EvidenceItem] = []
        candidate_name = resume.contact_info.full_name if resume.contact_info else None
        years_of_experience: str | None = None
        candidate_primary_title: str | None = None
        experience_years_found: list[int] = []
        has_present_in_dates = False

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
                    if not candidate_primary_title and entry.get("job_title"):
                        candidate_primary_title = str(entry.get("job_title")).strip()
                    s_date = str(entry.get("start_date") or "")
                    e_date = str(entry.get("end_date") or "")
                    if "present" in (e_date + s_date).lower():
                        has_present_in_dates = True
                    for y in re.findall(r"\b(19\d\d|20\d\d)\b", s_date + " " + e_date):
                        experience_years_found.append(int(y))

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
        _level_rank = {
            EvidenceLevel.LEVEL_1_DIRECT: 1,
            EvidenceLevel.LEVEL_2_CONTEXTUAL: 2,
            EvidenceLevel.LEVEL_3_ADJACENT: 3,
            EvidenceLevel.LEVEL_4_NONE: 4,
        }
        seen_claims: dict[str, EvidenceItem] = {}
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

        if not years_of_experience and experience_years_found:
            min_y = min(experience_years_found)
            max_y = 2026 if has_present_in_dates else max(experience_years_found)
            span = max_y - min_y
            if span >= 1:
                years_of_experience = f"{span}+ years"

        return CandidateEvidenceSet(
            candidate_name=candidate_name,
            years_of_experience=years_of_experience,
            candidate_primary_title=candidate_primary_title,
            supported_technologies=list(dict.fromkeys(supported)),
            adjacent_technologies=list(dict.fromkeys(adjacent)),
            unsupported_claims=[],   # populated by RequirementMatcher
            items=deduped,
        )
