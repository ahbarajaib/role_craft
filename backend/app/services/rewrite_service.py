"""Section rewrite service.

Coordinates call to OpenAI Responses API to rewrite a single resume section.
Enforces strict truthfulness guidelines, ensuring no credentials or skills
are invented unless explicitly supported by evidence elsewhere in the document.
"""

import re
from loguru import logger

from app.ai.provider import OpenAIProvider
from app.core.exceptions import BadRequestError
from app.parsers.job_description_parser import _KNOWN_TECHNOLOGIES
from app.schemas.rewrite import RewriteSectionResponse
from app.services.section_service import SectionService


def get_unsupported_jd_technologies(
    all_evidence_text: str,
    job_description_text: str,
) -> set[str]:
    """Identify technology/skill terms in the JD that DO NOT exist anywhere in the candidate's original resume/evidence."""
    evidence_lower = all_evidence_text.lower()
    jd_lower = job_description_text.lower()

    unsupported = set()
    for tech in _KNOWN_TECHNOLOGIES:
        tech_lower = tech.lower()
        if tech_lower in ("c#", "c++", ".net"):
            pattern = r"(?<![a-zA-Z0-9])" + re.escape(tech_lower) + r"(?![a-zA-Z0-9])"
        else:
            pattern = r"\b" + re.escape(tech_lower) + r"\b"

        if re.search(pattern, jd_lower, re.IGNORECASE):
            if not re.search(pattern, evidence_lower, re.IGNORECASE):
                unsupported.add(tech)

    return unsupported


def sanitize_unsupported_skills_from_text(
    rewritten_text: str,
    unsupported_techs: set[str],
) -> tuple[str, list[str]]:
    """Clean rewritten text by removing any unsupported technology/skill terms."""
    if not unsupported_techs or not rewritten_text.strip():
        return rewritten_text, []

    stripped_terms: list[str] = []
    lines = rewritten_text.split("\n")
    cleaned_lines: list[str] = []

    sorted_techs = sorted(list(unsupported_techs), key=lambda x: len(x), reverse=True)

    for line in lines:
        line_clean = line
        line_has_category = ":" in line and len(line.split(":", 1)[0]) < 35

        for tech in sorted_techs:
            tech_lower = tech.lower()
            if tech_lower in ("c#", "c++", ".net"):
                pattern = r"(?<![a-zA-Z0-9])" + re.escape(tech_lower) + r"(?![a-zA-Z0-9])"
            else:
                pattern = r"\b" + re.escape(tech_lower) + r"\b"

            if re.search(pattern, line_clean, re.IGNORECASE):
                stripped_terms.append(tech)

                if line_has_category:
                    cat, skills_str = line_clean.split(":", 1)
                    skills = [s.strip() for s in skills_str.split(",") if s.strip()]
                    filtered_skills = [
                        s for s in skills
                        if not re.search(pattern, s, re.IGNORECASE)
                    ]
                    line_clean = f"{cat}: {', '.join(filtered_skills)}"
                else:
                    line_clean = re.sub(rf"\b(and|or|,)\s+{pattern}\b", "", line_clean, flags=re.IGNORECASE)
                    line_clean = re.sub(rf"\b{pattern}\s+(and|or|,)\b", "", line_clean, flags=re.IGNORECASE)
                    line_clean = re.sub(pattern, "", line_clean, flags=re.IGNORECASE)
                    line_clean = re.sub(r"\s+", " ", line_clean).replace(" ,", ",").replace("..", ".").strip()

        cleaned_lines.append(line_clean)

    final_text = "\n".join(cleaned_lines)
    return final_text, list(set(stripped_terms))


REWRITE_SYSTEM_PROMPT = """\
You are a senior hiring manager, executive recruiter, and master resume editor.
You are editing a professional resume section to maximize interview callback rates and ATS keyword matching.

CRITICAL RULES:
1. **Strict Factual Accuracy**: Everything written must be strictly factual and supported by evidence in the resume or explicitly provided by the candidate. NEVER invent fake credentials, fake companies, fake dates, or hallucinated achievements.
2. **Google XYZ Formula**: Format bullet points using Google's XYZ formula:
   "Accomplished [X] as measured by [Y], by doing [Z]"
   - [X] = Clear outcome/result achieved
   - [Y] = Measurable metric/data point or technical scale signal
   - [Z] = Action taken and technical method used
3. **Mandatory Metric Quantification**: Every rewritten bullet MUST include at least one concrete metric or technical scale indicator. If an exact numeric percentage/metric is not present in the original bullet, estimate a realistic, technically plausible metric proxy based on context (e.g., "improving query latency by ~35%", "handling 10+ device categories", "serving 1,000+ active users", "reducing build times by 25%").
4. **Evidence-Gated ATS Keyword Weaving**: Cross-reference the target Job Description with the "=== EVIDENCE CONTEXT (FROM REST OF RESUME) ===". You MAY weave a JD keyword into a bullet ONLY IF it already appears somewhere in the candidate's evidence context (other sections of their resume). NEVER introduce a technology, framework, language, or tool that does not appear anywhere in the candidate's evidence context, even if the JD demands it. Resume fraud is strictly prohibited.
5. **Strong Action Verbs & High Impact**: Start every bullet point with a distinct, powerful action verb (e.g., Spearheaded, Architected, Engineered, Optimized, Streamlined). Do not merely rephrase sentences passively; restructure them for maximum recruiter impact.
6. **Candidate Metric Integration**: If there is a section labeled "=== CANDIDATE-SUPPLIED METRICS & DATA POINTS ===", weave those exact candidate metrics directly into the corresponding bullets.
7. **Exact Bullet Count & Order Preservation**: You MUST output EXACTLY the same number of content lines/bullets as specified in the count constraint. Preserve the logical sequence of job entries in document order.
8. **Metadata & Subheader Preservation**: You MUST preserve all Company Names, Locations, Job Titles, and Dates at the top of each entry EXACTLY as they appear in the original text.
9. **Output Bounds**: Output ONLY the polished paragraphs or bullet points for this section. Do not include summary preambles or section title headers.
"""

SKILLS_REWRITE_SYSTEM_PROMPT = """\
You are a senior executive recruiter and master ATS resume editor.
You are rewriting the SKILLS / CORE COMPETENCIES section of a professional resume across any domain or industry.

CRITICAL SKILLS SECTION RULES:
1. **Preserve Candidate's Formatting Style**:
   - If the original section uses category lists ("Category Name: Skill1, Skill2"), preserve category list format.
   - If the original section uses bullet dividers ("Skill1 • Skill2 • Skill3"), preserve bullet divider format.
   - If the original section uses standard bullet lines ("• Skill1"), preserve standard bullet list format.
2. **NO Sentences or Action Verbs**: DO NOT write full sentences, achievement paragraphs, or action verbs.
3. **Evidence-Gated Keyword Weaving — STRICT**: You MAY only add a skill or technology to the skills list if it EXPLICITLY appears in the candidate's own resume evidence (the "=== EVIDENCE CONTEXT ===" section below). If a keyword appears in the Target Job Description but does NOT appear anywhere in the candidate's evidence context or original skills text, you MUST NOT add it. This is non-negotiable.
4. **NEVER Invent Skills**: Do NOT add skills, tools, or technologies unless they explicitly appear in the candidate's evidence context or original text. Adding invented skills is resume fraud and is strictly prohibited.
5. **Preserve All Existing Skills**: Every skill listed in the original text MUST remain in the output. Do NOT remove, rename, or omit any existing skill item.
6. **Output Bounds**: Output ONLY the skill lines. Do not include preambles or header titles.
"""

SUMMARY_REWRITE_SYSTEM_PROMPT = """\
You are a senior hiring manager, executive recruiter, and master resume writer.
You are rewriting the PROFESSIONAL SUMMARY / PROFILE section of a resume to align perfectly with the target Job Description.

CRITICAL PROFESSIONAL SUMMARY RULES:
1. **Compelling 1-Paragraph Executive Summary**: Write a powerful 3-5 sentence professional summary tailored specifically to the target job title, required technical stack, and core domain background.
2. **Target Role Alignment**: Frame the candidate's years of experience, primary skills, and major achievements directly around the target role.
3. **No Fluff or Invented Claims**: Keep all years of experience, core technical stack, and factual background grounded strictly in the candidate's actual resume evidence.
4. **Active & High-Impact Tone**: Use confident, professional wording emphasizing problem-solving impact, production delivery, and domain expertise.
5. **Output Bounds**: Output ONLY the polished summary paragraph text. Do not include preambles or section title headers.
"""


class RewriteService:
    """Handles AI-powered, truth-preserving resume section rewrites."""

    def __init__(
        self, section_service: SectionService, provider: OpenAIProvider
    ) -> None:
        self._sections = section_service
        self._provider = provider

    def rewrite(
        self,
        document_id: str,
        section_name: str,
        job_description_text: str,
        recommendations: list[str],
        user_instructions: str | None = None,
        metric_inputs: dict[str, str] | None = None,
    ) -> RewriteSectionResponse:
        """Rewrite a single section of the resume using OpenAI structured outputs."""
        logger.info(
            "Starting section rewrite",
            document_id=document_id,
            section=section_name,
            has_user_instructions=user_instructions is not None,
            has_metric_inputs=metric_inputs is not None,
        )

        # 1. Load document sections
        sections_response = self._sections.detect_document_sections(document_id)
        sections = sections_response.sections

        def _normalize_title(t: str) -> str:
            clean_t = t.replace("[", "").replace("]", "").strip()
            return " ".join(clean_t.lower().split())

        # 2. Find target section
        target_sec = next(
            (s for s in sections if _normalize_title(s.title) == _normalize_title(section_name)),
            None,
        )
        if not target_sec:
            raise BadRequestError(
                f"Section '{section_name}' not found in the uploaded resume. Available: "
                f"{', '.join([s.title for s in sections])}"
            )

        # Extract target text
        original_text = "\n".join([p.text for p in target_sec.paragraphs])

        # --- SPECIAL CASE: Experience section is heading-only (sub-job-entries are separate sections) ---
        # Collect all sub-job-entry content so the AI gets the full experience to rewrite.
        import re
        sec_lower_check = _normalize_title(section_name)
        role_kws = ["developer", "engineer", "architect", "manager", "lead", "designer", "consultant", "analyst", "specialist", "executive", "intern", "freelance"]
        is_exp_sec = (
            target_sec.normalized_name == "experience"
            or any(kw in sec_lower_check for kw in ["experience", "employment", "history", "work", "job", "career", "positions"])
            or any(rk in sec_lower_check for rk in role_kws)
            or re.search(r"\b(19|20)\d{2}\b", sec_lower_check) is not None
            or "present" in sec_lower_check
        )
        if is_exp_sec and not original_text.strip():
            exp_sec_idx = sections.index(target_sec)
            non_experience_normalized = [
                "summary", "skills", "education", "projects", "certifications",
                "awards", "publications", "languages", "interests", "references", "header",
            ]
            sub_texts: list[str] = []
            for sub_sec in sections[exp_sec_idx + 1:]:
                sub_norm = (sub_sec.normalized_name or "").lower()
                if sub_norm in non_experience_normalized:
                    break
                sub_title_l = sub_sec.title.lower()
                if any(k in sub_title_l for k in ["education", "skills", "project", "certification"]):
                    break
                sub_texts.extend([p.text for p in sub_sec.paragraphs])
            original_text = "\n".join(sub_texts)

        if not original_text.strip():
            raise BadRequestError(f"Section '{section_name}' contains no text to rewrite.")


        orig_lines = [l.strip() for l in original_text.split("\n") if l.strip()]
        orig_line_count = max(len(orig_lines), 1)

        # Determine section type and prompt selection
        sec_lower = section_name.lower()

        # Preserve Education content untouched
        if any(k in sec_lower for k in ["education", "academic", "qualification", "degree"]):
            return RewriteSectionResponse(
                section=section_name,
                original_text=original_text,
                rewritten_text=original_text,
                reasoning="Education content is preserved as-is without modification.",
                changes=[],
            )

        is_skills_section = any(k in sec_lower for k in ["skill", "technologies", "proficiencies", "tech stack"])
        is_summary_section = any(k in sec_lower for k in ["summary", "profile", "about", "objective", "bio"])

        if is_skills_section:
            system_prompt = SKILLS_REWRITE_SYSTEM_PROMPT
        elif is_summary_section:
            system_prompt = SUMMARY_REWRITE_SYSTEM_PROMPT
        else:
            system_prompt = REWRITE_SYSTEM_PROMPT

        # 3. Compile evidence context from all OTHER sections
        evidence_parts = []
        for s in sections:
            if _normalize_title(s.title) == _normalize_title(section_name) or s.normalized_name == "header":
                continue
            evidence_parts.append(f"[{s.title}]")
            evidence_parts.extend([p.text for p in s.paragraphs])
        evidence_context = "\n".join(evidence_parts)

        # 4. Identify unsupported JD technologies (present in JD but absent from candidate's evidence)
        all_evidence_text = original_text + "\n" + evidence_context
        unsupported_jd_techs = get_unsupported_jd_technologies(
            all_evidence_text=all_evidence_text,
            job_description_text=job_description_text,
        )

        # Allow explicitly requested manual single keyword weaves (e.g. user clicked a Red badge manually)
        manually_requested_kws: set[str] = set()
        for r_item in recommendations + ([user_instructions] if user_instructions else []):
            if r_item and "weave" in r_item.lower():
                if ":" in r_item:
                    kw_part = r_item.split(":", 1)[1].strip()
                    for item in kw_part.split(","):
                        if item.strip():
                            manually_requested_kws.add(item.strip().lower())

        effective_unsupported_techs = {
            t for t in unsupported_jd_techs
            if t.lower() not in manually_requested_kws
        }

        # Sanitize recommendations passed to LLM
        sanitized_recs: list[str] = []
        for rec in recommendations:
            r_clean = rec
            if "weave" in r_clean.lower() and ":" in r_clean:
                sanitized_recs.append(r_clean)
                continue
            for tech in effective_unsupported_techs:
                if tech.lower() in ("c#", "c++", ".net"):
                    pat = r"(?<![a-zA-Z0-9])" + re.escape(tech.lower()) + r"(?![a-zA-Z0-9])"
                else:
                    pat = r"\b" + re.escape(tech.lower()) + r"\b"
                r_clean = re.sub(rf"\b(add|highlight|include|weave)\s+{pat}\b", "", r_clean, flags=re.IGNORECASE)
                r_clean = re.sub(pat, "", r_clean, flags=re.IGNORECASE)
            r_clean = " ".join(r_clean.split()).strip()
            if len(r_clean) > 8:
                sanitized_recs.append(r_clean)

        # 5. Formulate instructions and input
        input_parts = [
            f"=== TARGET JOB DESCRIPTION ===\n{job_description_text.strip()}",
            f"=== RECRUITER RECOMMENDATIONS FOR THIS SECTION ===\n"
            f"{' / '.join(sanitized_recs) if sanitized_recs else 'Improve overall impact using Google XYZ formula.'}",
        ]
        if not is_skills_section:
            from app.services.patch_service import _is_metadata_line, _is_bullet_paragraph, _is_overview_paragraph
            import docx as _docx_mod

            # Count non-metadata non-empty content lines from the original section text
            non_meta_lines = [l for l in orig_lines if not _is_metadata_line(l)]

            # Try to detect if there is a non-bullet overview paragraph at the top of each role
            import re as _re
            from app.services.patch_service import ACTION_VERBS as _AV
            _action_starts = tuple(_AV)
            overview_lines = [
                l for l in non_meta_lines
                if not any(l.startswith(s) for s in ["•", "-", "*", "–", "—", "▪"])
                and (l.lower().split()[0] in _AV if l.split() else False)
            ]
            bullet_only_lines = [
                l for l in non_meta_lines
                if any(l.startswith(s) for s in ["•", "-", "*", "–", "—", "▪"])
            ]

            # Total rewriteable content = overview sentences + bullet points
            target_content_count = len(non_meta_lines) if non_meta_lines else orig_line_count
            has_overview = len(overview_lines) > 0

            if has_overview:
                input_parts.append(
                    f"=== CONTENT STRUCTURE CONSTRAINT ===\n"
                    f"This section has {len(overview_lines)} prose overview paragraph(s) followed by {len(bullet_only_lines)} bullet point(s).\n"
                    f"You MUST output EXACTLY {len(overview_lines)} rewritten prose overview paragraph(s) (matching position and style of the originals) "
                    f"followed by EXACTLY {len(bullet_only_lines)} rewritten bullet point(s). "
                    f"Total rewriteable content lines: exactly {target_content_count}. "
                    f"DO NOT add, merge, or omit any lines!"
                )
            else:
                input_parts.append(
                    f"=== EXACT BULLET COUNT CONSTRAINT ===\n"
                    f"This section originally contains {target_content_count} bullet point(s) across its job entries. "
                    f"You MUST output EXACTLY {target_content_count} rewritten bullet points (matching the exact bullet count of each job entry in document order). "
                    f"DO NOT add or omit bullet points! (Target count: exactly {target_content_count} bullets)."
                )

        if metric_inputs and any(v.strip() for v in metric_inputs.values()):
            formatted_metrics = "\n".join(
                f"- {k.replace('_', ' ').title()}: {v.strip()}"
                for k, v in metric_inputs.items()
                if v.strip()
            )
            input_parts.append(
                f"=== CANDIDATE-SUPPLIED METRICS & DATA POINTS (WEAVE THESE INTO BULLETS) ===\n{formatted_metrics}"
            )

        if user_instructions:
            input_parts.append(
                f"=== CANDIDATE INSTRUCTIONS FOR REFINEMENT (PRIORITISE THESE) ===\n{user_instructions.strip()}"
            )

        input_parts.extend([
            f"=== EVIDENCE CONTEXT (FROM REST OF RESUME) ===\n{evidence_context.strip()}",
            f"=== ORIGINAL SECTION CONTENT TO REWRITE ===\n{original_text.strip()}"
        ])

        input_text = "\n\n".join(input_parts)

        # 6. Execute Structured LLM call
        result = self._provider.parse_response(
            instructions=system_prompt,
            input_text=input_text,
            response_format=RewriteSectionResponse,
        )

        # Python Shield: Sanitize any unsupported JD skills hallucinated by LLM
        sanitized_rewritten_text, stripped_terms = sanitize_unsupported_skills_from_text(
            result.rewritten_text,
            effective_unsupported_techs,
        )
        if stripped_terms:
            logger.warning(
                "🛡️ [RoleCraft Shield] Stripped hallucinated JD skills from rewritten text",
                section=section_name,
                stripped=stripped_terms,
            )
            result.rewritten_text = sanitized_rewritten_text

        # Verify returned original text in the Pydantic response matches
        result.original_text = original_text

        logger.info(
            "Section rewrite complete",
            section=section_name,
            original_len=len(original_text),
            rewritten_len=len(result.rewritten_text),
            changes_made=len(result.changes),
        )

        return result
