"""Resume analysis workflow.

Orchestrates the entire analysis pipeline: loading document sections,
parsing the target job description, performing deterministic comparators,
and running a unified recruiter-centric review on the full document.
"""

from loguru import logger

from app.constants.resume_keywords import (
    UNIVERSAL_ROLE_TITLES,
    PRESERVE_VERBATIM_SECTIONS,
    EXPERIENCE_SECTION_KEYWORDS,
)
from app.schemas.analysis import Priority
from app.schemas.comparison import ComparisonResult, SectionComparison
from app.schemas.resume_analysis import (
    OverallSummary,
    ResumeAnalysisResult,
    ReviewedSection,
    StrengthItem,
    ImprovementItem,
)
from app.schemas.review import ReviewStatus, SectionReviewItem
from app.schemas.section import SectionItem
from app.schemas.structured_resume import StructuredResume
from app.services.comparison_service import ComparisonService
from app.services.job_description_service import JobDescriptionService
from app.services.review_service import ReviewService
from app.services.section_service import SectionService
from app.services.structured_resume_text_service import serialize_to_sections


from app.services.analysis_cache import global_analysis_cache


class ResumeAnalysisWorkflow:
    """Orchestrates the full recruiter-centric resume analysis pipeline."""

    def __init__(
        self,
        section_service: SectionService,
        jd_service: JobDescriptionService,
        comparison_service: ComparisonService,
        review_service: ReviewService,
    ) -> None:
        self._sections = section_service
        self._jd = jd_service
        self._comparison = comparison_service
        self._review = review_service

    def run(
        self,
        document_id: str,
        job_description_text: str,
    ) -> ResumeAnalysisResult:
        """Execute all pipeline steps and return the merged result."""
        logger.info("Resume analysis workflow started", document_id=document_id)

        # Step 1 – Load sections
        sections_response = self._sections.detect_document_sections(document_id)
        sections = sections_response.sections
        logger.debug("Sections loaded", count=len(sections))

        return self._run_pipeline(sections=sections, document_id=document_id, job_description_text=job_description_text)

    def run_from_structured(
        self,
        resume: StructuredResume,
        job_description_text: str,
        document_id: str = "structured",
    ) -> ResumeAnalysisResult:
        """Run the full analysis pipeline directly from a StructuredResume JSON object.

        This method bypasses DOCX file loading entirely — no file on disk is needed.
        The ``StructuredResume`` is serialized to a ``list[SectionItem]`` by
        ``serialize_to_sections()`` and fed directly into the compare + review pipeline.

        This is the JSON-first path used when the user has a master resume in DB.
        """
        logger.info("Resume analysis workflow started from structured JSON", document_id=document_id)
        sections = serialize_to_sections(resume)
        logger.debug("Sections serialized from JSON", count=len(sections))
        return self._run_pipeline(sections=sections, document_id=document_id, job_description_text=job_description_text)

    def _run_pipeline(
        self,
        sections: list[SectionItem],
        document_id: str,
        job_description_text: str,
    ) -> ResumeAnalysisResult:
        # Build cache key from full resume content + JD
        full_resume_text = "\n".join(
            " ".join(p.text for p in s.paragraphs) for s in sections
        )
        cache_key = global_analysis_cache.compute_key(full_resume_text, job_description_text)
        cached_result = global_analysis_cache.get(cache_key)
        if cached_result:
            logger.info("⚡ Returning instant cached analysis result in ~5ms")
            # Maintain document_id for caller
            return ResumeAnalysisResult(
                document_id=document_id,
                overall_summary=cached_result.overall_summary,
                sections=cached_result.sections,
                top_strengths=cached_result.top_strengths,
                top_improvements=cached_result.top_improvements,
            )

        # Step 2 – Parse job description
        job_description = self._jd.parse(job_description_text)
        logger.debug("Job description parsed", title=job_description.title)

        # Step 3 – Compare
        comparison = self._comparison.compare(sections, job_description)
        logger.debug(
            "Comparison complete",
            coverage=comparison.overall_coverage_percentage,
        )

        # Step 4 – Unified Recruiter Review
        logger.info("Running unified recruiter-centric resume review")
        
        # Filter sections to only analyze major content sections, excluding
        # Education, header, contact details, and preserve-verbatim sections.
        sections_to_analyze = []
        for s in sections:
            norm = (s.normalized_name or "").lower()
            title_lower = s.title.lower().strip()

            # Always skip header and education
            if norm in ["header", "education"]:
                continue

            # Skip preserve-verbatim sections (languages, interests, additional info etc.)
            if norm in PRESERVE_VERBATIM_SECTIONS:
                continue

            # Skip title-level education variants
            if (
                "education" in title_lower
                or "academic" in title_lower
                or "qualification" in title_lower
            ):
                continue

            # Skip inline contact/technology labels
            if (
                title_lower.startswith("technologies:")
                or title_lower.startswith("tech:")
                or title_lower.startswith("tech stack:")
                or title_lower.startswith("+")
                or "email:" in title_lower
                or "phone:" in title_lower
                or "linkedin.com" in title_lower
                or "github.com" in title_lower
            ):
                continue

            # Skip container headings that have no body content of their own (only the title line)
            # because their actual content lives in the sub-sections (job entries / project entries) that follow them!
            body_text_paras = [
                p.text.strip() for p in s.paragraphs
                if p.text.strip().lower() != s.title.strip().lower()
            ]
            if not body_text_paras and norm in ["experience", "projects", "certifications", "awards"]:
                logger.info(f"Skipping container heading section from AI review: '{s.title}'")
                continue

            sections_to_analyze.append(s)

        unified_result = self._review.review_resume(
            sections=sections_to_analyze,
            comparison=comparison,
            job_description=job_description,
        )

        # Step 5 – Merge comparisons and AI reviews
        reviewed_sections: list[ReviewedSection] = []
        comparison_by_name = _index_comparisons(comparison)

        def _normalize_title(t: str) -> str:
            clean_t = t.replace("[", "").replace("]", "").strip()
            return " ".join(clean_t.lower().split())

        # Find experience review from LLM if any
        exp_review = next(
            (r for r in unified_result.sections if _normalize_title(r.section_name) in [
                "professional experiences", "professional experience", "work experience", "experience", "employment history", "employment", "experiences"
            ]),
            None
        )

        date_kws = ["present", "201", "202", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

        # Build universal role title set for sub-section detection (lower-cased)
        _role_kw_set = set(UNIVERSAL_ROLE_TITLES)

        def _is_experience_sub_section(sec) -> bool:
            """Return True if this section looks like a job-entry sub-heading."""
            import re as _re
            t = sec.title.lower()
            return (
                any(kw in t for kw in EXPERIENCE_SECTION_KEYWORDS)
                or any(rk in t for rk in _role_kw_set)
                or _re.search(r"\b(19|20)\d{2}\b", t) is not None
                or "present" in t
                or any(dk in t for dk in date_kws)
            )

        processed_section_ids = set()

        def _get_section_evidence(sec: DetectedSection) -> list[str]:
            lines = [p.text.strip() for p in sec.paragraphs if p.text and p.text.strip()]
            if lines:
                return lines
            norm_t = " ".join(sec.title.lower().split())
            for target in sections:
                if " ".join(target.title.lower().split()) == norm_t:
                    fallback = [p.text.strip() for p in target.paragraphs if p.text and p.text.strip()]
                    if fallback:
                        return fallback
            return [sec.title]

        def _get_missing_keywords(sec_item: SectionItem, sec_comp: SectionComparison) -> list[str]:
            missing = list(sec_comp.missing_keywords) + list(sec_comp.missing_technologies)
            title_l = sec_item.title.lower()
            if not missing or any(k in title_l for k in ["skill", "competenc", "tech", "summary", "qualification"]):
                missing.extend(comparison.missing_skills)
                missing.extend(comparison.missing_technologies)
                missing.extend(comparison.keyword_gaps)
            seen = set()
            result = []
            for item in missing:
                item_clean = item.strip()
                if item_clean and item_clean.lower() not in seen:
                    seen.add(item_clean.lower())
                    result.append(item_clean)
            return result

        for s_review in unified_result.sections:
            if s_review == exp_review:
                continue

            section_item = next(
                (s for s in sections_to_analyze if _normalize_title(s.title) == _normalize_title(s_review.section_name)),
                None
            )
            if not section_item:
                logger.warning(
                    f"Discarding AI section review: section title '{s_review.section_name}' does not match any detected section titles in the resume."
                )
                continue

            processed_section_ids.add(section_item.title)
            section_comparison = _find_comparison(section_item, comparison_by_name)

            def _sanitize_status(title: str, status: ReviewStatus) -> ReviewStatus:
                norm = title.lower()
                is_core = any(kw in norm for kw in ["experience", "work", "employment", "career", "role", "developer", "engineer", "executive", "project", "skill", "summary", "profile"])
                if is_core and status == ReviewStatus.REDUCE_EMPHASIS:
                    return ReviewStatus.IMPROVE
                return status

            reviewed_sections.append(
                ReviewedSection(
                    section_name=section_item.title,
                    review_status=_sanitize_status(section_item.title, s_review.review_status),
                    rewrite_worthwhile=s_review.rewrite_worthwhile,
                    priority=s_review.priority,
                    reason=s_review.reason,
                    recommendations=s_review.recommendations,
                    evidence_used=_get_section_evidence(section_item),
                    missing_keywords=_get_missing_keywords(section_item, section_comparison),
                    strengths=s_review.strengths,
                    coverage_percentage=section_comparison.coverage_percentage,
                    recruiter_impact="",
                    ats_impact="",
                )
            )

        # Map experience review to ALL experience role entries (universal role detection)
        for s in sections_to_analyze:
            if _is_experience_sub_section(s):
                if s.title not in processed_section_ids:
                    processed_section_ids.add(s.title)
                    section_comparison = _find_comparison(s, comparison_by_name)
                    
                    if exp_review:
                        reviewed_sections.append(
                            ReviewedSection(
                                section_name=s.title,
                                review_status=_sanitize_status(s.title, exp_review.review_status),
                                rewrite_worthwhile=exp_review.rewrite_worthwhile,
                                priority=exp_review.priority,
                                reason=exp_review.reason,
                                recommendations=exp_review.recommendations,
                                evidence_used=_get_section_evidence(s),
                                missing_keywords=_get_missing_keywords(s, section_comparison),
                                strengths=exp_review.strengths,
                                coverage_percentage=section_comparison.coverage_percentage,
                                recruiter_impact="",
                                ats_impact="",
                            )
                        )
                    else:
                        reviewed_sections.append(
                            ReviewedSection(
                                section_name=s.title,
                                review_status=ReviewStatus.IMPROVE,
                                rewrite_worthwhile=True,
                                priority=Priority.HIGH,
                                reason="Tailor role achievements and technical metrics using Google XYZ formula.",
                                recommendations=["Re-structure bullet points using Google XYZ metric formula while preserving original technical evidence."],
                                evidence_used=_get_section_evidence(s),
                                missing_keywords=_get_missing_keywords(s, section_comparison),
                                strengths=["Chronological employment history preserved."],
                                coverage_percentage=section_comparison.coverage_percentage,
                                recruiter_impact="",
                                ats_impact="",
                            )
                        )

        # Now fill in default reviews for any other un-analyzed sections to ensure they are editable
        for s in sections_to_analyze:
            if s.title not in processed_section_ids:
                processed_section_ids.add(s.title)
                section_comparison = _find_comparison(s, comparison_by_name)
                reviewed_sections.append(
                    ReviewedSection(
                        section_name=s.title,
                        review_status=ReviewStatus.KEEP,
                        rewrite_worthwhile=False,
                        priority=Priority.LOW,
                        reason="Section is high quality and aligns well with the profile.",
                        recommendations=[],
                        evidence_used=_get_section_evidence(s),
                        missing_keywords=_get_missing_keywords(s, section_comparison),
                        strengths=["Clear representation of candidate profile."],
                        coverage_percentage=section_comparison.coverage_percentage,
                        recruiter_impact="",
                        ats_impact="",
                    )
                )

        # Partition reviewed_sections by status and enforce limits (max 5 each)
        improve_secs = [s for s in reviewed_sections if s.review_status == ReviewStatus.IMPROVE]
        keep_secs = [s for s in reviewed_sections if s.review_status == ReviewStatus.KEEP]
        reduce_secs = [s for s in reviewed_sections if s.review_status == ReviewStatus.REDUCE_EMPHASIS]

        # Prioritize improve sections by priority (high -> medium -> low)
        priority_weights = {"high": 3, "medium": 2, "low": 1}
        improve_secs.sort(key=lambda s: priority_weights.get(s.priority.value, 0), reverse=True)

        limited_sections = (
            improve_secs[:5] +
            keep_secs[:5] +
            reduce_secs[:5]
        )

        resolved_job_title = (
            unified_result.target_job_title
            if (unified_result.target_job_title and unified_result.target_job_title.lower().strip() not in ["target role", "full job description", "job description", "overview"])
            else (job_description.title if (job_description.title and job_description.title.lower().strip() not in ["full job description", "job description", "target role", "overview"]) else "Target Role")
        )

        # Step 6 – Merge and return
        result = _build_result(
            document_id=document_id,
            job_title=resolved_job_title,
            comparison=comparison,
            reviewed_sections=limited_sections,
            top_strengths=unified_result.top_strengths,
            top_improvements=unified_result.top_improvements,
        )

        logger.info(
            "Resume analysis workflow complete",
            document_id=document_id,
            sections_reviewed=result.overall_summary.sections_reviewed,
            sections_to_improve=result.overall_summary.sections_to_improve,
            overall_coverage=result.overall_summary.overall_coverage_percentage,
        )

        global_analysis_cache.set(cache_key, result)
        return result


# ── Pipeline helpers ──────────────────────────────────────────────────────────


def _index_comparisons(comparison: ComparisonResult) -> dict[str, SectionComparison]:
    """Build a lookup from section_name → SectionComparison."""
    return {sc.section_name: sc for sc in comparison.sections}


def _find_comparison(
    section: SectionItem | None,
    index: dict[str, SectionComparison],
) -> SectionComparison:
    """Return the SectionComparison for a section."""
    if not section:
        return SectionComparison(
            section_name="unknown",
            matched_keywords=[],
            missing_keywords=[],
            matched_technologies=[],
            missing_technologies=[],
            coverage_percentage=0.0,
        )
    key = section.normalized_name or section.title.lower()
    return index.get(
        key,
        SectionComparison(
            section_name=key,
            matched_keywords=[],
            missing_keywords=[],
            matched_technologies=[],
            missing_technologies=[],
            coverage_percentage=0.0,
        ),
    )


def _build_result(
    document_id: str,
    job_title: str,
    comparison: ComparisonResult,
    reviewed_sections: list[ReviewedSection],
    top_strengths: list[StrengthItem],
    top_improvements: list[ImprovementItem],
) -> ResumeAnalysisResult:
    """Assemble the final result from the merged per-section data."""
    summary = OverallSummary(
        overall_coverage_percentage=comparison.overall_coverage_percentage,
        sections_reviewed=len(reviewed_sections),
        sections_to_improve=sum(1 for s in reviewed_sections if s.review_status == ReviewStatus.IMPROVE),
        job_title=job_title,
    )

    return ResumeAnalysisResult(
        document_id=document_id,
        overall_summary=summary,
        sections=reviewed_sections,
        top_strengths=top_strengths,
        top_improvements=top_improvements,
    )
