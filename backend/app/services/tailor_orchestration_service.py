"""Tailor Orchestration Service.

Orchestrates a full-resume AI tailor by calling OpenAIProvider.generate_text()
for summary, experience bullets, and skills. Returns a deep copy of the
StructuredResume with AI-modified content plus a diff map for the preview UI.

The master StructuredResume is NEVER modified.
"""

import copy
from typing import Optional

from loguru import logger

from app.ai.provider import OpenAIProvider
from app.schemas.structured_resume import StructuredResume


TAILOR_SUMMARY_SYSTEM = (
    "You are an executive resume strategist. Rewrite the professional summary to directly align "
    "with the target job title and job description. Frame the narrative around the target role's core "
    "competencies while preserving authentic experience. NEVER fabricate fake companies or degree titles. "
    "Output ONLY the polished summary paragraph (3-4 sentences max) — no headers or preamble."
)

TAILOR_EXPERIENCE_SYSTEM = (
    "You are a master resume editor and ATS optimizer.\n"
    "Rewrite work experience bullet points using the Google XYZ formula ('Accomplished [X] as measured by [Y], by doing [Z]').\n"
    "RULES:\n"
    "1. MANDATORY: Every single bullet point MUST be updated to seamlessly weave in relevant keywords, tools, methodologies, and competencies from the target Job Description (matching the candidate's profession: Tech, Finance, Accounting, Sales, HR, Healthcare, Logistics, Operations, etc.) wherever applicable.\n"
    "2. STRICTLY LOCK & PRESERVE REAL FACTS: Never change company names, job titles, start/end dates, employment years, or locations.\n"
    "3. Output EXACTLY the same number of bullets as input, one line per bullet.\n"
    "4. Do NOT include bullet symbols or preamble — plain text only."
)

TAILOR_SKILLS_SYSTEM = (
    "You are an ATS resume skills optimizer. Categorize and refine the skills section to maximize keyword match against the target job description.\n"
    "RULES:\n"
    "1. Intelligently weave target ATS skills, tools, and domain proficiencies from the job description into appropriate categories.\n"
    "2. Preserve all core existing skills from the original candidate profile.\n"
    "3. Output format must be strictly one line per category: 'CategoryName: Skill1, Skill2, Skill3...'"
)

TAILOR_PROJECTS_SYSTEM = (
    "You are a master resume project strategist. Rewrite project descriptions and bullet points to highlight target methodologies, tools, and quantifiable impact.\n"
    "RULES:\n"
    "1. MANDATORY: Seamlessly weave matching keywords, tools, and standards from the target Job Description into every project bullet point.\n"
    "2. STRICTLY LOCK & PRESERVE REAL FACTS: Never alter project names, company names, repository links, or dates.\n"
    "3. Output EXACTLY the same number of bullets as input, one line per bullet, plain text only."
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
    ) -> tuple:
        """Tailor a full StructuredResume for a job description.

        Returns:
            (tailored_resume: StructuredResume, diff: dict)
            diff = { field_path: {original, tailored, ...} }
        """
        tailored = copy.deepcopy(master_resume)
        diff: dict = {}

        logger.info("Starting full resume tailor", job_title=job_title)

        for i, section in enumerate(tailored.sections):
            if not section.visible:
                continue

            sec_type = section.section_type

            if sec_type == "summary":
                original_text = section.content.get("text", "")
                if original_text and original_text.strip():
                    rewritten = self._rewrite_summary(original_text, job_description, job_title)
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
                        bullets, job_description, job_title, role_title=role_title, company=company
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
                        original_skills_text, job_description, job_title
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
                        bullets, job_description, job_title, project_name=proj_name
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

    def _rewrite_summary(self, original: str, jd: str, job_title: str) -> str:
        user_prompt = (
            f"Target Role: {job_title}\n\n"
            f"Job Description:\n{jd[:3000]}\n\n"
            f"Original Summary:\n{original}\n\n"
            f"Rewrite the summary:"
        )
        try:
            return self._ai.generate_text(TAILOR_SUMMARY_SYSTEM, user_prompt).strip()
        except Exception as e:
            logger.warning("Summary rewrite failed", error=str(e))
            return original

    def _rewrite_experience_bullets(
        self, bullets: list, jd: str, job_title: str, role_title: str = "", company: str = ""
    ) -> list:
        if not bullets:
            return bullets
        bullets_text = "\n".join(bullets)
        role_ctx = f"{role_title} @ {company}" if role_title or company else "Experience Role"
        user_prompt = (
            f"Candidate Specific Role: {role_ctx}\n"
            f"Target Applied Role: {job_title}\n\n"
            f"Target Job Description:\n{jd[:2500]}\n\n"
            f"Original Bullets for {role_ctx} ({len(bullets)} bullets):\n{bullets_text}\n\n"
            f"Rewrite these {len(bullets)} bullets specifically for the candidate's experience as {role_ctx}, "
            f"seamlessly weaving in matching technical keywords, action verbs, and impact metrics from the target Job Description. "
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
        self, bullets: list, jd: str, job_title: str, project_name: str = ""
    ) -> list:
        if not bullets:
            return bullets
        bullets_text = "\n".join(bullets)
        proj_ctx = f"Project: {project_name}" if project_name else "Technical Project"
        user_prompt = (
            f"Candidate Specific {proj_ctx}\n"
            f"Target Role: {job_title}\n\n"
            f"Target Job Description:\n{jd[:2500]}\n\n"
            f"Original Project Bullets ({len(bullets)} bullets):\n{bullets_text}\n\n"
            f"Rewrite these {len(bullets)} project bullets specifically for {proj_ctx}, "
            f"seamlessly weaving in matching technical keywords, action verbs, and quantifiable engineering metrics from the target Job Description. "
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

    def _rewrite_skills(self, original_skills_text: str, jd: str, job_title: str) -> str:
        user_prompt = (
            f"Target Role: {job_title}\n\n"
            f"Job Description:\n{jd[:2000]}\n\n"
            f"Original Skills:\n{original_skills_text}\n\n"
            f"Reorder skills to prioritize JD-relevant ones:"
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
