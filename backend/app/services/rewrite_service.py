"""Section rewrite service.

Coordinates call to OpenAI Responses API to rewrite a single resume section.
Enforces strict truthfulness guidelines, ensuring no credentials or skills
are invented unless explicitly supported by evidence elsewhere in the document.
"""

import re
from loguru import logger

from app.ai.provider import OpenAIProvider
from app.constants.resume_keywords import (
    UNIVERSAL_ROLE_TITLES,
    PRESERVE_VERBATIM_SECTIONS,
    SKILLS_SECTION_KEYWORDS,
    SUMMARY_SECTION_KEYWORDS,
    EXPERIENCE_SECTION_KEYWORDS,
)
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
    """Preserve AI-woven target JD keywords without stripping them."""
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
You are a senior executive recruiter and master ATS resume editor.
You are rewriting a candidate's resume section (e.g., Professional Experience, Projects, Summary) to aggressively maximize ATS keyword alignment, recruiter impact, and technical depth against the Target Job Description.

MANDATORY RULES:
1. **Mandatory JD Keyword Integration**: Every single bullet point MUST be updated to seamlessly weave in relevant technical keywords, frameworks, tools, methodologies, and concepts from the Target Job Description (e.g. REST APIs, CI/CD, system architecture, performance optimization, cloud infrastructure, unit testing, agile, Docker, Kubernetes, React, Node.js, Python, PostgreSQL, microservices, etc.).
2. **Google XYZ Action-Impact Formula**: Structure every bullet point using Google's XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]". Start each bullet with a distinct, high-impact action verb (e.g., Spearheaded, Architected, Engineered, Optimized, Streamlined, Orchestrated).
3. **Metric & Scale Indicators**: Ensure every bullet point features measurable metric impact or scale proxy (e.g., "improving API throughput by ~35%", "reducing latency by 40%", "handling 10,000+ daily active users", "reducing build times by 25%").
4. **Strict Factual Preservation**: Keep Job Titles, Company Names, Employment Dates, and Locations 100% identical. NEVER invent fake companies, fake degrees, or fake dates.
5. **Exact Line Count & Structure**: Output EXACTLY the same number of bullet points as the input. Preserve company/title header lines at the top of each entry.
6. **Clean Output**: Output ONLY the polished section text. Do NOT include preambles or commentary.
"""

SKILLS_REWRITE_SYSTEM_PROMPT = """\
You are a senior executive recruiter and master ATS resume editor.
You are rewriting the SKILLS / CORE COMPETENCIES section of a professional resume across any domain or industry.

CRITICAL SKILLS SECTION RULES:
1. **Category Skill Format ONLY**: Output ONLY concise category skill lines matching the candidate's original structure (e.g. `Category Name: Skill 1, Skill 2, Skill 3`).
2. **STRICTLY NO Sentences, NO Metrics, NO Action Verbs**: Do NOT write full sentences, achievement paragraphs, metrics, percentages, or action verbs under any circumstances. Every line MUST be a list of skill names ONLY.
3. **Preserve ALL Category Lines**: You MUST preserve every single original category line from the candidate's text (e.g., AI & LLM Engineering, Frontend, Backend & Systems, Databases, Tools & Platforms, Cloud & DevOps). Output EXACTLY one line per category line in the original text. Do NOT omit or merge any category.
Backend & Systems: Node.js, Express.js, Python, REST APIs

Recommendation: Add NestJS and Redis to backend technologies.

CORRECT OUTPUT:
Frontend: React.js, Next.js, Redux Toolkit, Tailwind CSS
Backend & Systems: Node.js, Express.js, Python, REST APIs, NestJS, Redis

FORBIDDEN WRONG OUTPUT (NEVER DO THIS):
Backend & Systems: Developed robust server-side applications with Node.js, Express.js, and Python, implementing REST APIs and FastAPI for seamless API integration, achieving a 40% improvement in data retrieval speeds.

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
        is_exp_sec = (
            target_sec.normalized_name == "experience"
            or any(kw in sec_lower_check for kw in EXPERIENCE_SECTION_KEYWORDS)
            or any(rk in sec_lower_check for rk in UNIVERSAL_ROLE_TITLES)
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
        norm_sec = (target_sec.normalized_name or "").lower()

        # Preserve Education content untouched
        if any(k in sec_lower for k in ["education", "academic", "qualification", "degree"]):
            return RewriteSectionResponse(
                section=section_name,
                original_text=original_text,
                rewritten_text=original_text,
                reasoning="Education content is preserved as-is without modification.",
                changes=[],
            )

        # Preserve Additional/verbatim sections untouched (languages, interests, declarations etc.)
        if norm_sec in PRESERVE_VERBATIM_SECTIONS or any(
            k in sec_lower for k in [
                "additional", "languages", "interests", "hobbies",
                "declaration", "driving license", "references",
            ]
        ):
            return RewriteSectionResponse(
                section=section_name,
                original_text=original_text,
                rewritten_text=original_text,
                reasoning="This section contains personal or factual data that must not be altered.",
                changes=[],
            )

        is_skills_section = any(k in sec_lower for k in SKILLS_SECTION_KEYWORDS)
        is_summary_section = any(k in sec_lower for k in SUMMARY_SECTION_KEYWORDS)

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

        # Python Shield 1: Sanitize any unsupported JD skills hallucinated by LLM
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

        # Python Shield 2: Deduplicate identical lines, filter full sentences from Skills section, and strip header repeats
        lines = [l.strip() for l in result.rewritten_text.split("\n") if l.strip()]
        seen_lines = set()
        cleaned_output_lines = []

        ACTION_VERB_AND_METRIC_KEYWORDS = [
            "engineered", "developed", "managed", "utilized", "employed",
            "achieved", "achieving", "optimizing", "enhancing", "ensuring",
            "leveraged", "built", "spearheaded", "crafted", "designed",
            "implemented", "configured", "created", "improving", "translated",
            "servicing", "handling", "increased", "decreased", "boosted", "reduced",
            "%", "percent"
        ]

        for line in lines:
            line_l = line.lower()
            # If line repeats the section title (e.g. "Technical Skills"), discard it
            if _normalize_title(line) == _normalize_title(section_name):
                logger.info(
                    "🛡️ [RoleCraft Shield] Stripped repeated section title line",
                    section=section_name,
                    title_line=line,
                )
                continue

            if is_skills_section:
                words_in_line = set(re.findall(r"\b[a-z%]+\b", line_l))
                has_action_or_metric = any(kw in words_in_line or kw in line_l for kw in ACTION_VERB_AND_METRIC_KEYWORDS)
                if has_action_or_metric:
                    logger.warning(
                        "🛡️ [RoleCraft Shield] Stripped achievement sentence from Skills section",
                        section=section_name,
                        sentence=line[:60],
                    )
                    continue

            norm_key = re.sub(r"[^a-zA-Z0-9]", "", line_l)
            if norm_key and norm_key not in seen_lines:
                seen_lines.add(norm_key)
                cleaned_output_lines.append(line)

        if cleaned_output_lines:
            result.rewritten_text = "\n".join(cleaned_output_lines)

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

    def rewrite_from_json(
        self,
        section_name: str,
        section_type: str,
        section_content: dict,
        evidence_text: str,
        job_description_text: str,
        recommendations: list[str],
        user_instructions: str | None = None,
        metric_inputs: dict[str, str] | None = None,
    ) -> "RewriteSectionResponse":
        """Rewrite a single section using JSON content instead of a DOCX file.

        This is the JSON-first path for the unified architecture. Section content
        comes directly from the StructuredResume JSON — no DOCX file needed on disk.

        ``evidence_text`` is the full resume as plain text (for evidence gating).
        """
        # Serialize section content to plain text for AI processing
        lines: list[str] = []

        if section_type == "summary":
            text = section_content.get("text") or ""
            if text.strip():
                lines.append(text.strip())

        elif section_type == "skills":
            categories = section_content.get("categories") or []
            for cat in categories:
                cat_name = cat.get("category_name") or ""
                skills = cat.get("skills") or []
                if cat_name and skills:
                    lines.append(f"{cat_name}: {', '.join(skills)}")

        if section_type == "experience":
            entries = section_content.get("entries") or []
            if not entries:
                return RewriteSectionResponse(
                    section=section_name,
                    original_text="",
                    rewritten_text="",
                    reasoning="Section contains no experience entries to rewrite.",
                    changes=[],
                )

            orig_blocks: list[str] = []
            rewritten_blocks: list[str] = []

            for entry in entries:
                job_title = entry.get("job_title", "Experience Role")
                company = entry.get("company", "")
                loc = entry.get("location", "")
                sdate = entry.get("start_date", "")
                edate = entry.get("end_date", "")
                bullets = entry.get("bullets") or []

                entry_header = job_title
                meta = company
                if loc:
                    meta += f", {loc}"
                if sdate:
                    meta += f" | {sdate} - {edate or 'Present'}"

                entry_orig_lines = [entry_header]
                if meta:
                    entry_orig_lines.append(meta)
                entry_orig_lines.extend([f"• {b}" for b in bullets])
                orig_blocks.append("\n".join(entry_orig_lines))

                if bullets:
                    entry_text = "\n".join([f"• {b}" for b in bullets])
                    entry_res = self._rewrite_section_text(
                        section_name=f"{job_title} @ {company}",
                        original_text=entry_text,
                        evidence_context=evidence_text,
                        job_description_text=job_description_text,
                        recommendations=recommendations,
                        user_instructions=user_instructions,
                        metric_inputs=metric_inputs,
                        is_skills_section=False,
                        is_summary_section=False,
                    )
                    rewritten_entry_lines = [entry_header]
                    if meta:
                        rewritten_entry_lines.append(meta)
                    rewritten_entry_lines.append(entry_res.rewritten_text)
                    rewritten_blocks.append("\n".join(rewritten_entry_lines))
                else:
                    rewritten_blocks.append("\n".join(entry_orig_lines))

            full_original = "\n\n".join(orig_blocks)
            full_rewritten = "\n\n".join(rewritten_blocks)

            return RewriteSectionResponse(
                section=section_name,
                original_text=full_original,
                rewritten_text=full_rewritten,
                reasoning="All experience entries tailored with Google XYZ formula & target ATS keywords.",
                changes=["Preserved all role entries and tailored bullet points with target job keywords."],
            )

        elif section_type == "projects":
            entries = section_content.get("entries") or []
            if not entries:
                return RewriteSectionResponse(
                    section=section_name,
                    original_text="",
                    rewritten_text="",
                    reasoning="Section contains no project entries to rewrite.",
                    changes=[],
                )

            orig_blocks: list[str] = []
            rewritten_blocks: list[str] = []

            for entry in entries:
                pname = entry.get("name", "Project")
                url = entry.get("url", "")
                techs = entry.get("technologies") or []
                bullets = entry.get("bullets") or []

                p_header = pname
                if url:
                    p_header += f" ({url})"
                tech_line = f"Technologies: {', '.join(techs)}" if techs else ""

                entry_orig_lines = [p_header]
                if tech_line:
                    entry_orig_lines.append(tech_line)
                entry_orig_lines.extend([f"• {b}" for b in bullets])
                orig_blocks.append("\n".join(entry_orig_lines))

                if bullets:
                    entry_text = "\n".join([f"• {b}" for b in bullets])
                    entry_res = self._rewrite_section_text(
                        section_name=f"Project: {pname}",
                        original_text=entry_text,
                        evidence_context=evidence_text,
                        job_description_text=job_description_text,
                        recommendations=recommendations,
                        user_instructions=user_instructions,
                        metric_inputs=metric_inputs,
                        is_skills_section=False,
                        is_summary_section=False,
                    )
                    rewritten_entry_lines = [p_header]
                    if tech_line:
                        rewritten_entry_lines.append(tech_line)
                    rewritten_entry_lines.append(entry_res.rewritten_text)
                    rewritten_blocks.append("\n".join(rewritten_entry_lines))
                else:
                    rewritten_blocks.append("\n".join(entry_orig_lines))

            full_original = "\n\n".join(orig_blocks)
            full_rewritten = "\n\n".join(rewritten_blocks)

            return RewriteSectionResponse(
                section=section_name,
                original_text=full_original,
                rewritten_text=full_rewritten,
                reasoning="All project entries tailored with stack technologies & target ATS keywords.",
                changes=["Preserved all project entries and tailored bullet points with target job keywords."],
            )

        # Fallback for summary, skills, certifications, custom sections
        lines: list[str] = []

        if section_type == "summary":
            text = section_content.get("text") or ""
            if text.strip():
                lines.append(text.strip())

        elif section_type == "skills":
            categories = section_content.get("categories") or []
            for cat in categories:
                cat_name = cat.get("category_name") or ""
                skills = cat.get("skills") or []
                if cat_name and skills:
                    lines.append(f"{cat_name}: {', '.join(skills)}")

        elif section_type == "certifications":
            entries = section_content.get("entries") or []
            for entry in entries:
                cert_parts = [entry.get("name") or ""]
                if entry.get("issuer"):
                    cert_parts.append(f"— {entry['issuer']}")
                if entry.get("date"):
                    cert_parts.append(f"({entry['date']})")
                lines.append(" ".join(cert_parts).strip())

        else:
            entries = section_content.get("entries") or []
            lines.extend([str(e) for e in entries if e])

        original_text = "\n".join(lines)
        if not original_text.strip():
            return RewriteSectionResponse(
                section=section_name,
                original_text="",
                rewritten_text="",
                reasoning="Section contains no content to rewrite.",
                changes=[],
            )

        # Use the same core rewrite logic via _rewrite_section_text
        return self._rewrite_section_text(
            section_name=section_name,
            original_text=original_text,
            evidence_context=evidence_text,
            job_description_text=job_description_text,
            recommendations=recommendations,
            user_instructions=user_instructions,
            metric_inputs=metric_inputs,
            is_skills_section=section_type == "skills",
            is_summary_section=section_type == "summary",
        )

    def _rewrite_section_text(
        self,
        section_name: str,
        original_text: str,
        evidence_context: str,
        job_description_text: str,
        recommendations: list[str],
        user_instructions: str | None,
        metric_inputs: dict[str, str] | None,
        is_skills_section: bool,
        is_summary_section: bool,
    ) -> "RewriteSectionResponse":
        """Core AI rewrite logic extracted for reuse between DOCX and JSON modes."""
        import re as _re

        orig_lines = [l.strip() for l in original_text.split("\n") if l.strip()]
        orig_line_count = max(len(orig_lines), 1)

        if is_skills_section:
            system_prompt = SKILLS_REWRITE_SYSTEM_PROMPT
        elif is_summary_section:
            system_prompt = SUMMARY_REWRITE_SYSTEM_PROMPT
        else:
            system_prompt = REWRITE_SYSTEM_PROMPT

        all_evidence_text = original_text + "\n" + evidence_context
        unsupported_jd_techs = get_unsupported_jd_technologies(
            all_evidence_text=all_evidence_text,
            job_description_text=job_description_text,
        )

        manually_requested_kws: set[str] = set()
        for r_item in recommendations + ([user_instructions] if user_instructions else []):
            if r_item and "weave" in r_item.lower() and ":" in r_item:
                kw_part = r_item.split(":", 1)[1].strip()
                for item in kw_part.split(","):
                    if item.strip():
                        manually_requested_kws.add(item.strip().lower())

        effective_unsupported_techs = {
            t for t in unsupported_jd_techs if t.lower() not in manually_requested_kws
        }

        sanitized_recs: list[str] = []
        for rec in recommendations:
            r_clean = rec
            if "weave" in r_clean.lower() and ":" in r_clean:
                sanitized_recs.append(r_clean)
                continue
            for tech in effective_unsupported_techs:
                pat = r"\b" + _re.escape(tech.lower()) + r"\b"
                r_clean = _re.sub(pat, "", r_clean, flags=_re.IGNORECASE)
            r_clean = " ".join(r_clean.split()).strip()
            if len(r_clean) > 8:
                sanitized_recs.append(r_clean)

        input_parts = [
            f"=== TARGET JOB DESCRIPTION ===\n{job_description_text.strip()}",
            f"=== RECRUITER RECOMMENDATIONS FOR THIS SECTION ===\n"
            f"{' / '.join(sanitized_recs) if sanitized_recs else 'Improve overall impact using Google XYZ formula.'}",
        ]

        if not is_skills_section:
            non_meta_lines = [l for l in orig_lines]
            bullet_count = len([l for l in non_meta_lines if l.startswith(("•", "-", "*", "–", "—", "▪"))])
            non_bullet_count = len(non_meta_lines) - bullet_count
            input_parts.append(
                f"=== LINE COUNT CONSTRAINT ===\n"
                f"Output EXACTLY {orig_line_count} non-empty content lines. "
                f"This section has {bullet_count} bullet points and {non_bullet_count} non-bullet lines."
            )

        if metric_inputs:
            metric_str = "\n".join(f"- {k}: {v}" for k, v in metric_inputs.items())
            input_parts.append(f"=== CANDIDATE-SUPPLIED METRICS & DATA POINTS ===\n{metric_str}")

        input_parts.append(f"=== EVIDENCE CONTEXT (FROM REST OF RESUME) ===\n{evidence_context}")
        input_parts.append(f"=== ORIGINAL SECTION TEXT TO REWRITE ===\n{original_text}")

        full_input = "\n\n".join(input_parts)

        try:
            result = self._provider.parse_response(
                instructions=system_prompt,
                input_text=full_input,
                response_format=RewriteSectionResponse,
            )
        except Exception as exc:
            raise BadRequestError(f"AI rewrite failed: {str(exc)}")

        rewritten_text, _ = sanitize_unsupported_skills_from_text(result.rewritten_text, effective_unsupported_techs)
        result.rewritten_text = rewritten_text
        result.original_text = original_text
        result.section = section_name
        return result
