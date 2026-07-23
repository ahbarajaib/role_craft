"""Resume analysis workflow.

Orchestrates the entire analysis pipeline: loading document sections,
parsing the target job description, performing deterministic comparators,
and running a unified recruiter-centric review on the full document.
"""

from loguru import logger

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
from app.services.comparison_service import ComparisonService
from app.services.job_description_service import JobDescriptionService
from app.services.review_service import ReviewService
from app.services.section_service import SectionService


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
        
        # Filter sections to only analyze major content sections, excluding Education, headers, and contact details
        sections_to_analyze = []
        for s in sections:
            if s.normalized_name in ["header", "education"]:
                continue
            
            title_lower = s.title.lower().strip()
            # Skip sections that are education, academic background, contact details, links, or technology listings
            if (
                "education" in title_lower
                or "academic" in title_lower
                or "qualification" in title_lower
                or title_lower.startswith("technologies:")
                or title_lower.startswith("tech:")
                or title_lower.startswith("tech stack:")
                or title_lower.startswith("+")
                or "email:" in title_lower
                or "phone:" in title_lower
                or "linkedin.com" in title_lower
                or "github.com" in title_lower
            ):
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
        processed_section_ids = set()

        for s_review in unified_result.sections:
            # Skip the general experiences card in standard loop (we replicate it below)
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

            reviewed_sections.append(
                ReviewedSection(
                    section_name=section_item.title,
                    review_status=s_review.review_status,
                    rewrite_worthwhile=s_review.rewrite_worthwhile,
                    priority=s_review.priority,
                    reason=s_review.reason,
                    recommendations=s_review.recommendations,
                    evidence_used=[],
                    missing_keywords=[],
                    strengths=s_review.strengths,
                    coverage_percentage=section_comparison.coverage_percentage,
                    recruiter_impact="",
                    ats_impact="",
                )
            )

        # Map experience review to ALL experience role entries so every job position is tailored to the JD
        for s in sections_to_analyze:
            title_lower = s.title.lower()
            if any(kw in title_lower for kw in date_kws):
                if s.title not in processed_section_ids:
                    processed_section_ids.add(s.title)
                    section_comparison = _find_comparison(s, comparison_by_name)
                    
                    if exp_review:
                        reviewed_sections.append(
                            ReviewedSection(
                                section_name=s.title,
                                review_status=exp_review.review_status,
                                rewrite_worthwhile=exp_review.rewrite_worthwhile,
                                priority=exp_review.priority,
                                reason=exp_review.reason,
                                recommendations=exp_review.recommendations,
                                evidence_used=[],
                                missing_keywords=[],
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
                                reason="Tailor role achievements and technical metrics to match target job requirements.",
                                recommendations=["Align technical bullet points with required skills in target job description."],
                                evidence_used=[],
                                missing_keywords=[],
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
                        evidence_used=[],
                        missing_keywords=[],
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
