"""Tailor Orchestration Service.

Orchestrates a full-resume AI tailor by calling OpenAIProvider.generate_text()
for summary, experience bullets, and skills. Returns a deep copy of the
StructuredResume with AI-modified content plus a diff map for the preview UI.

The master StructuredResume is NEVER modified.
"""

import copy

from loguru import logger

from app.ai.provider import OpenAIProvider
from app.schemas.evidence import TailoringPlan
from app.schemas.structured_resume import StructuredResume
from app.services.rewrite_service import (
    enforce_truthful_role_identity,
    enforce_verified_years_of_experience,
    sanitize_anti_ai_summary,
    sanitize_unsupported_skills_from_text,
)

TAILOR_SUMMARY_SYSTEM = (
    "You are an executive resume strategist. Rewrite the professional summary to align with the target job title and job description. "
    "EVIDENCE CONSTRAINTS: (1) Only reference technologies and skills that appear in the candidate's original resume text provided below. "
    "(2) Do NOT introduce any technology, tool, or skill from the JD that is absent from the candidate's resume (e.g. do not claim Microsoft AI Services or Azure if absent). "
    "(3) Preserve the candidate's years of experience VERBATIM — never adjust the number upward or downward to match the JD requirement (e.g. 7 years must NEVER be changed to 10 years). "
    "(4) NEVER fabricate fake companies, degrees, or metrics. "
    "(5) LEADERSHIP & PROJECT MANAGER EXCEPTION: If the target role is Team Lead, Tech Lead, or Project Manager / Technical Project Manager, you may customize the summary opening to frame candidate's background into that role (e.g., 'Technical Project Manager with [Verified Years] of software engineering and delivery experience...' or 'Team Lead / Senior Software Engineer with [Verified Years] of experience...'). For other transitions (e.g., Lead AI Engineer), position truthfully: '[Actual Title] with [Verified Years] of experience..., positioning for [Target Role] roles.' "
    "(6) ZERO TOLERANCE FOR ROBOTIC AI CLICHÉS: Strictly avoid 'results-driven', 'passionate', 'proven ability', 'proven track record', "
    "'demonstrates expertise', 'drive digital transformation', 'cross-functional to deliver', 'align with business objectives', 'operational efficiency'. "
    "Use ONLY technologies and skills already present in the candidate's verified evidence (see VERIFIED CANDIDATE SKILLS in prompt). "
    "Output ONLY the polished summary paragraph (3-4 sentences max) — no headers or preamble."
)

TAILOR_EXPERIENCE_SYSTEM = (
    "You are a master resume editor and ATS optimizer.\n"
    "Rewrite work experience bullet points using the Google XYZ formula ('Accomplished [X] as measured by [Y], by doing [Z]').\n"
    "RULES:\n"
    "1. EVIDENCE-GROUNDED ONLY: Rewrite bullets using the candidate's actual experience. Use JD terminology only where the candidate already has the underlying capability (refer to VERIFIED CANDIDATE SKILLS in the prompt). Do NOT introduce any technology or tool from the JD that is absent from the candidate's resume evidence.\n"
    "2. STRICTLY LOCK & PRESERVE REAL FACTS: Never change company names, job titles, start/end dates, employment years, or locations.\n"
    "3. PRESERVE METRICS VERBATIM: If the original bullet contains a number or percentage, keep it exactly. Do NOT add new metrics.\n"
    "4. Output EXACTLY the same number of bullets as input, one line per bullet.\n"
    "5. NEVER modify, inflate, or remove existing metrics. If the original bullet says '25% reduction', the rewritten bullet must say '25% reduction'. Do not add new metrics where none exist.\n"
    "6. Do NOT include bullet symbols or preamble — plain text only."
)

TAILOR_SKILLS_SYSTEM = (
    "You are an ATS resume skills optimizer. Categorize and refine the skills section to maximize keyword match against the target job description.\n"
    "RULES:\n"
    "1. RESUME-ONLY SKILLS: Use ONLY skills already present in the candidate's VERIFIED CANDIDATE SKILLS list provided in the prompt. You may reorder categories and skills to prioritise JD relevance, but NEVER add a new skill, tool, framework, or technology that does not appear in the VERIFIED CANDIDATE SKILLS list. The JD is a prioritisation guide only — not a source of candidate qualifications.\n"
    "2. Preserve all core existing skills from the original candidate profile. You may reorder categories to prioritise JD-relevant ones.\n"
    "3. Output format must be strictly one line per category: 'CategoryName: Skill1, Skill2, Skill3...'"
)

TAILOR_PROJECTS_SYSTEM = (
    "You are a master resume project strategist. Rewrite project descriptions and bullet points to highlight relevant methodologies, tools, and quantifiable impact.\n"
    "RULES:\n"
    "1. EVIDENCE-GROUNDED ONLY: Rewrite bullets using the candidate's actual project experience. Use JD terminology only where the candidate already used those technologies in this project (listed in the project technologies line). Do NOT add technologies from the JD that are not in the project's original technology stack or the VERIFIED CANDIDATE SKILLS list.\n"
    "2. STRICTLY LOCK & PRESERVE REAL FACTS: Never alter project names, company names, repository links, or dates.\n"
    "3. PRESERVE METRICS VERBATIM: Do NOT add new quantitative metrics. Only keep metrics already stated in the original project bullet.\n"
    "4. Preserve all existing metrics exactly. Do not add new metrics.\n"
    "5. Output EXACTLY the same number of bullets as input, one line per bullet, plain text only."
)


class TailorOrchestrationService:
    """Orchestrates full-resume AI tailoring over a StructuredResume."""

    def __init__(self, ai_provider: OpenAIProvider) -> None:
        self._ai = ai_provider

    def tailor_full_resume(
        self,
        master_resume: StructuredResume,
        job_description: str,
        job_title: str,
        tailoring_plan: TailoringPlan | None = None,
    ) -> tuple:
        """Tailor a full StructuredResume for a job description.

        Returns:
            (tailored_resume: StructuredResume, diff: dict)
            diff = { field_path: {original, tailored, ...} }
        """
        tailored = copy.deepcopy(master_resume)
        diff: dict = {}

        logger.info("Starting full resume tailor", job_title=job_title)

        # Build constraint blocks from tailoring plan
        forbidden_block = ""
        safe_skills_block = ""
        years_block = ""
        candidate_title = None
        verified_years = None
        forbidden_techs: set[str] = set()

        if tailoring_plan:
            candidate_title = getattr(tailoring_plan, "candidate_primary_title", None)
            verified_years = tailoring_plan.years_of_experience
            if tailoring_plan.forbidden_claims:
                forbidden_techs = set(tailoring_plan.forbidden_claims)
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
                    f"\n=== CANDIDATE YEARS OF EXPERIENCE (use verbatim — NEVER inflate) ===\n"
                    f"{tailoring_plan.years_of_experience}"
                )

        for i, section in enumerate(tailored.sections):
            if not section.visible:
                continue

            sec_type = section.section_type

            if sec_type == "summary":
                original_text = section.content.get("text", "")
                if original_text and original_text.strip():
                    rewritten = self._rewrite_summary(
                        original_text, job_description, job_title,
                        forbidden_block=forbidden_block,
                        safe_block=safe_skills_block,
                        years_block=years_block,
                        candidate_primary_title=candidate_title,
                        verified_years=verified_years,
                        forbidden_techs=forbidden_techs,
                    )
                    if rewritten and rewritten.strip() != original_text.strip():
                        diff[f"sections[{i}].summary"] = {
                            "original": original_text,
                            "tailored": rewritten,
                        }
                        tailored.sections[i].content["text"] = rewritten

            elif sec_type == "experience":
                entries = section.content.get("entries", [])
                for j, entry in enumerate(entries):
                    bullets = entry.get("bullets", [])
                    if not bullets:
                        continue
                    role_title = entry.get("job_title", "")
                    company = entry.get("company", "")
                    rewritten_bullets = self._rewrite_experience_bullets(
                        bullets, job_description, job_title,
                        role_title=role_title, company=company,
                        forbidden_block=forbidden_block, safe_block=safe_skills_block,
                    )
                    if rewritten_bullets and rewritten_bullets != bullets:
                        diff[f"sections[{i}].experience[{j}].bullets"] = {
                            "original": "\n".join(bullets),
                            "tailored": "\n".join(rewritten_bullets),
                            "company": company,
                            "role": role_title,
                        }
                        tailored.sections[i].content["entries"][j]["bullets"] = rewritten_bullets

            elif sec_type == "skills":
                categories = section.content.get("categories", [])
                if categories:
                    original_skills_text = "\n".join(
                        f"{c.get('category_name', '')}: {', '.join(c.get('skills', []))}"
                        for c in categories
                    )
                    rewritten_text = self._rewrite_skills(
                        original_skills_text, job_description, job_title,
                        forbidden_block=forbidden_block, safe_block=safe_skills_block,
                    )
                    if rewritten_text and rewritten_text.strip() != original_skills_text.strip():
                        new_categories = self._parse_skills_text(rewritten_text, categories)
                        diff[f"sections[{i}].skills"] = {
                            "original": original_skills_text,
                            "tailored": rewritten_text,
                        }
                        tailored.sections[i].content["categories"] = new_categories

            elif sec_type == "projects":
                entries = section.content.get("entries", [])
                for j, entry in enumerate(entries):
                    bullets = entry.get("bullets", [])
                    if not bullets:
                        continue
                    proj_name = entry.get("name", "")
                    rewritten_bullets = self._rewrite_project_bullets(
                        bullets, job_description, job_title,
                        project_name=proj_name,
                        forbidden_block=forbidden_block, safe_block=safe_skills_block,
                    )
                    if rewritten_bullets and rewritten_bullets != bullets:
                        diff[f"sections[{i}].projects[{j}].bullets"] = {
                            "original": "\n".join(bullets),
                            "tailored": "\n".join(rewritten_bullets),
                            "company": entry.get("name", "Project"),
                            "role": "Project Highlights",
                        }
                        tailored.sections[i].content["entries"][j]["bullets"] = rewritten_bullets

        logger.info("Tailor complete", changes=len(diff))
        return tailored, diff

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _rewrite_summary(
        self, original: str, jd: str, job_title: str,
        forbidden_block: str = "", safe_block: str = "", years_block: str = "",
        candidate_primary_title: str | None = None,
        verified_years: str | None = None,
        forbidden_techs: set[str] | None = None,
    ) -> str:
        prompt_parts = [
            f"Target Applied Role: {job_title}",
            f"Job Description:\n{jd[:3000]}",
            f"Original Summary:\n{original}",
        ]
        if candidate_primary_title:
            is_lead_pm = any(
                kw in (job_title or "").lower()
                for kw in [
                    "team lead",
                    "tech lead",
                    "technical lead",
                    "lead developer",
                    "lead engineer",
                    "project manager",
                    "technical project manager",
                    "engineering manager",
                    "delivery lead",
                    "scrum master",
                    "product manager",
                ]
            )
            if is_lead_pm:
                truth_directive = (
                    f"Candidate Background Role: {candidate_primary_title}\n"
                    f"POSITIONING EXCEPTION (Leadership/PM): You may open directly as '{job_title} with {verified_years or 'verified'} experience...' or '{job_title} / {candidate_primary_title} with {verified_years or 'verified'} experience...', framing their engineering depth into leadership and agile delivery. "
                    f"STRICT TRUTH: NEVER inflate verified years of experience (preserve {verified_years or 'actual years'} verbatim)."
                )
            else:
                truth_directive = (
                    f"Candidate Background Role: {candidate_primary_title}\n"
                    f"TRUTHFULNESS: Do NOT claim candidate is already a '{job_title}'. Position them as: '{candidate_primary_title} with {verified_years or 'verified'} experience..., positioning for {job_title} roles.'"
                )
            prompt_parts.append(truth_directive)
        if safe_block:
            prompt_parts.append(safe_block)
        if years_block:
            prompt_parts.append(years_block)
        if forbidden_block:
            prompt_parts.append(forbidden_block)
        prompt_parts.append("Rewrite the summary (3-4 sentences max, grounded in verified facts):")

        user_prompt = "\n\n".join(prompt_parts)
        try:
            raw = self._ai.generate_text(TAILOR_SUMMARY_SYSTEM, user_prompt).strip()
            if forbidden_techs:
                raw, _ = sanitize_unsupported_skills_from_text(raw, forbidden_techs)
            if verified_years:
                raw = enforce_verified_years_of_experience(raw, verified_years)
            if candidate_primary_title and job_title:
                raw = enforce_truthful_role_identity(raw, candidate_primary_title, job_title, verified_years)
            return sanitize_anti_ai_summary(raw).strip()
        except Exception as e:
            logger.warning("Summary rewrite failed", error=str(e))
            return original

    def _rewrite_experience_bullets(
        self, bullets: list, jd: str, job_title: str,
        role_title: str = "", company: str = "",
        forbidden_block: str = "", safe_block: str = "",
    ) -> list:
        if not bullets:
            return bullets
        bullets_text = "\n".join(bullets)
        role_ctx = f"{role_title} @ {company}" if role_title or company else "Experience Role"
        user_prompt = (
            f"Candidate Specific Role: {role_ctx}\n"
            f"Target Applied Role: {job_title}\n\n"
            f"Target Job Description (for reference only — do NOT add skills absent from candidate's resume):\n{jd[:2500]}\n\n"
            + safe_block + forbidden_block +
            f"\n\nOriginal Bullets for {role_ctx} ({len(bullets)} bullets):\n{bullets_text}\n\n"
            f"Rewrite these {len(bullets)} bullets using the candidate's actual experience from the bullets above. "
            f"Output EXACTLY {len(bullets)} bullets (one per line, no bullet symbols):"
        )
        try:
            response = self._ai.generate_text(TAILOR_EXPERIENCE_SYSTEM, user_prompt, temperature=0.3)
            lines = [
                line.strip().lstrip("•-*– ").strip()
                for line in response.strip().split("\n")
                if line.strip()
            ]
            if len(lines) < len(bullets):
                lines.extend(bullets[len(lines):])
            return lines[: len(bullets)]
        except Exception as e:
            logger.warning("Experience bullets rewrite failed", error=str(e))
            return bullets

    def _rewrite_project_bullets(
        self, bullets: list, jd: str, job_title: str,
        project_name: str = "",
        forbidden_block: str = "", safe_block: str = "",
    ) -> list:
        if not bullets:
            return bullets
        bullets_text = "\n".join(bullets)
        proj_ctx = f"Project: {project_name}" if project_name else "Technical Project"
        user_prompt = (
            f"Candidate Specific {proj_ctx}\n"
            f"Target Role: {job_title}\n\n"
            f"Target Job Description (for reference only — do NOT add skills absent from candidate's project):\n{jd[:2500]}\n\n"
            + safe_block + forbidden_block +
            f"\n\nOriginal Project Bullets ({len(bullets)} bullets):\n{bullets_text}\n\n"
            f"Rewrite these {len(bullets)} project bullets using the candidate's actual project experience. "
            f"Output EXACTLY {len(bullets)} bullets (one per line, no bullet symbols):"
        )
        try:
            response = self._ai.generate_text(TAILOR_PROJECTS_SYSTEM, user_prompt, temperature=0.3)
            lines = [
                line.strip().lstrip("•-*– ").strip()
                for line in response.strip().split("\n")
                if line.strip()
            ]
            if len(lines) < len(bullets):
                lines.extend(bullets[len(lines):])
            return lines[: len(bullets)]
        except Exception as e:
            logger.warning("Project bullets rewrite failed", error=str(e))
            return bullets

    def _rewrite_skills(
        self, original_skills_text: str, jd: str, job_title: str,
        forbidden_block: str = "", safe_block: str = "",
    ) -> str:
        user_prompt = (
            f"Target Role: {job_title}\n\n"
            f"Job Description (for prioritisation reference only):\n{jd[:2000]}\n"
            + safe_block + forbidden_block +
            f"\n\nOriginal Candidate Skills:\n{original_skills_text}\n\n"
            f"Reorder and reorganise the candidate skills to prioritise JD-relevant ones. Do not add new skills:"
        )
        try:
            return self._ai.generate_text(TAILOR_SKILLS_SYSTEM, user_prompt, temperature=0.2).strip()
        except Exception as e:
            logger.warning("Skills rewrite failed", error=str(e))
            return original_skills_text

    def _parse_skills_text(self, skills_text: str, original_categories: list) -> list:
        new_cats = []
        for line in skills_text.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            if ":" in line:
                cat_name, skills_str = line.split(":", 1)
                skills = [s.strip() for s in skills_str.split(",") if s.strip()]
                new_cats.append({"category_name": cat_name.strip(), "skills": skills})
            else:
                new_cats.append({"category_name": "", "skills": [line]})
        return new_cats if new_cats else original_categories
