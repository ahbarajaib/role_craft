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
    "You are a senior resume writer. Rewrite the professional summary to align "
    "with the target job description. Keep all facts grounded in the original. "
    "Output ONLY the summary paragraph — no headers or preamble. 3-5 sentences max."
)

TAILOR_EXPERIENCE_SYSTEM = (
    "You are a senior resume editor. Rewrite the resume bullet points to align "
    "with the target job description using the Google XYZ formula.\n"
    "RULES:\n"
    "1. NEVER invent facts, companies, dates, metrics, or skills not in the original.\n"
    "2. Weave in JD keywords ONLY if they appear in the original bullets.\n"
    "3. Output EXACTLY the same number of bullets as the input, one per line.\n"
    "4. Do NOT include bullet symbols or preamble — plain text only."
)

TAILOR_SKILLS_SYSTEM = (
    "You are a resume skills editor. Reorder the skills section to prioritize "
    "skills mentioned in the job description.\n"
    "RULES:\n"
    "1. NEVER add skills not in the original.\n"
    "2. Reorder categories and skills within categories to match JD priorities.\n"
    "3. Output one line per category: 'CategoryName: Skill1, Skill2, ...'\n"
    "4. Preserve ALL original skills."
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
                    rewritten_bullets = self._rewrite_experience_bullets(
                        bullets, job_description, job_title
                    )
                    if rewritten_bullets and rewritten_bullets != bullets:
                        diff[f"sections[{i}].experience[{j}].bullets"] = {
                            "original": "\n".join(bullets),
                            "tailored": "\n".join(rewritten_bullets),
                            "company": entry.get("company", ""),
                            "role": entry.get("job_title", ""),
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
        self, bullets: list, jd: str, job_title: str
    ) -> list:
        if not bullets:
            return bullets
        bullets_text = "\n".join(bullets)
        user_prompt = (
            f"Target Role: {job_title}\n\n"
            f"Job Description:\n{jd[:2000]}\n\n"
            f"Original Bullets ({len(bullets)} bullets):\n{bullets_text}\n\n"
            f"Rewrite these {len(bullets)} bullets (one per line, no bullet symbols):"
        )
        try:
            response = self._ai.generate_text(TAILOR_EXPERIENCE_SYSTEM, user_prompt, temperature=0.3)
            lines = [
                line.strip().lstrip("•-*– ").strip()
                for line in response.strip().split("\n")
                if line.strip()
            ]
            # Ensure same count as original
            if len(lines) < len(bullets):
                lines.extend(bullets[len(lines):])
            return lines[: len(bullets)]
        except Exception as e:
            logger.warning("Experience bullets rewrite failed", error=str(e))
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
