"""Section rewrite service.

Coordinates call to OpenAI Responses API to rewrite a single resume section.
Enforces strict truthfulness guidelines, ensuring no credentials or skills
are invented unless explicitly supported by evidence elsewhere in the document.
"""

import re
from concurrent.futures import ThreadPoolExecutor

from loguru import logger

from app.ai.provider import OpenAIProvider
from app.constants.resume_keywords import (
    EXPERIENCE_SECTION_KEYWORDS,
    PRESERVE_VERBATIM_SECTIONS,
    SKILLS_SECTION_KEYWORDS,
    SUMMARY_SECTION_KEYWORDS,
    UNIVERSAL_ROLE_TITLES,
)
from app.core.exceptions import BadRequestError
from app.parsers.job_description_parser import _KNOWN_TECHNOLOGIES
from app.schemas.rewrite import (
    RewriteChangeItem,
    RewriteChangeType,
    RewriteSectionResponse,
)
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

        if re.search(pattern, jd_lower, re.IGNORECASE) and not re.search(pattern, evidence_lower, re.IGNORECASE):
            unsupported.add(tech)

    # Dynamic multi-word cloud, platform, and vendor AI phrases (e.g. "Microsoft AI Services", "Azure AI Services")
    cloud_ai_patterns = [
        r"\b(?:Microsoft|Azure|AWS|Amazon|Google(?:\s+Cloud)?|GCP|Oracle|IBM)\s+[A-Za-z0-9]+\s+(?:Services?|Platform|Suite|Solutions?)\b",
        r"\b(?:Microsoft|Azure|AWS|Google)\s+AI(?:\s+Services?)?\b",
        r"\b[A-Za-z0-9]+\s+AI\s+(?:Services?|Platform|Solutions?)\b",
    ]
    for cap_pat in cloud_ai_patterns:
        for match in re.finditer(cap_pat, job_description_text, re.IGNORECASE):
            matched_phrase = match.group(0).strip()
            if not re.search(r"\b" + re.escape(matched_phrase.lower()) + r"\b", evidence_lower):
                unsupported.add(matched_phrase)

    return unsupported


def sanitize_unsupported_skills_from_text(
    rewritten_text: str,
    unsupported_techs: set[str],
) -> tuple[str, list[str]]:
    """Strip any JD technology terms that are not supported by candidate evidence.

    Returns the cleaned text and the list of terms that were removed.
    If unsupported_techs is empty, returns the original text unchanged.
    """
    if not unsupported_techs:
        return rewritten_text, []

    stripped_terms: list[str] = []
    lines = rewritten_text.split("\n")
    cleaned_lines: list[str] = []

    sorted_techs = sorted(unsupported_techs, key=len, reverse=True)

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
                    line_clean = re.sub(rf"\b(?:specializing\s+in|specializes\s+in|focused\s+on|with\s+expertise\s+in)\s+{pattern}\b", "", line_clean, flags=re.IGNORECASE)
                    line_clean = re.sub(rf"\b(and|or|,)\s+{pattern}\b", "", line_clean, flags=re.IGNORECASE)
                    line_clean = re.sub(rf"\b{pattern}\s+(and|or|,)\b", "", line_clean, flags=re.IGNORECASE)
                    line_clean = re.sub(pattern, "", line_clean, flags=re.IGNORECASE)
                    line_clean = re.sub(r"\s+", " ", line_clean).replace(" ,", ",").replace("..", ".").strip()

        cleaned_lines.append(line_clean)

    final_text = "\n".join(cleaned_lines)
    return final_text, list(set(stripped_terms))


REWRITE_SYSTEM_PROMPT = """\
You are a senior executive recruiter and master ATS resume editor.
You are rewriting a candidate's resume section (e.g., Professional Experience, Projects, Work History) to improve ATS keyword alignment and recruiter impact against the Target Job Description, while staying strictly grounded in the candidate's actual experience.

MANDATORY RULES:
1. **Evidence-Grounded Rewriting**: Rewrite each bullet using the candidate's actual experience from the original text. You MAY use terminology from the Job Description ONLY where the candidate already has demonstrable underlying experience (listed in VERIFIED CANDIDATE SKILLS below or in EVIDENCE CONTEXT). Do NOT introduce any technology, tool, or skill from the JD that is not already present in the candidate's resume evidence.
2. **Google XYZ Action-Impact Formula**: Structure bullet points using Google's XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]". Start each bullet with a distinct, high-impact action verb (e.g., Spearheaded, Orchestrated, Executed, Optimized, Negotiated, Reconciled, Accelerated, Championed).
3. **Preserve Existing Metrics Exactly**: If the original bullet contains a metric (e.g. "25% reduction", "1,000 users", "3x faster"), preserve it VERBATIM — do not change the number. If the original bullet has NO metric, do NOT invent or add one. Only use metrics that are already present in the source text.
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
3. **Preserve ALL Category Lines**: You MUST preserve every single original category line from the candidate's text. Output EXACTLY one line per category line in the original text. Do NOT omit or merge any category.
4. **Evidence-Only Skills**: Only list skills that already appear in the candidate's original resume. You may reorder and reorganise skills to prioritise relevance to the JD, but you must NOT add any new skill, technology, tool, framework, or platform that is not already present in the original skills text or VERIFIED CANDIDATE SKILLS list. Absence of a JD keyword from the candidate's resume means it must not appear in the output.
5. **Output Bounds**: Output ONLY the skill lines. Do not include preambles or header titles.
"""

SUMMARY_REWRITE_SYSTEM_PROMPT = """\
You are a senior hiring manager, executive recruiter, and master resume writer.
You are rewriting the PROFESSIONAL SUMMARY / PROFILE section of a resume to align with the target Job Description.

CRITICAL PROFESSIONAL SUMMARY RULES:
1. **Compelling 1-Paragraph Executive Summary**: Write a powerful 2-4 sentence professional summary tailored specifically to the target job title and core domain background (around 50-85 words).
2. **Target Role Alignment & Factual Identity**: Frame the candidate's verified skills and major achievements directly around the target role.
   - ABSOLUTE TRUTHFULNESS: Never state that the candidate currently holds an unearned technical domain title (e.g. do NOT invent 'Lead AI Engineer' if the candidate has no AI background).
   - LEADERSHIP & PROJECT MANAGER EXCEPTION: If the target role is 'Team Lead', 'Tech Lead', or 'Project Manager' / 'Technical Project Manager' (or corresponding positioning preset is selected):
     The professional summary MAY be customized to position the candidate directly in that leadership or delivery role:
     e.g., 'Technical Project Manager with [Verified Years] of software engineering and delivery experience...', or 'Team Lead / Senior Software Engineer with [Verified Years] of experience...', or '[Candidate Title] with [Verified Years] of experience, stepping up into Technical Lead / Project Manager roles...'.
   - FOR OTHER CAREER TRANSITIONS: Write an authentic, grounded transition:
     "[Candidate's Actual Title] with [Verified Years] of experience in [verified stack], positioning for [Target Role] roles. [Sentence 2: concrete systems & architectures built]. [Sentence 3: demonstrated technical ownership across system architecture, engineering standards, code reviews, and delivery]."
   - UNCONDITIONAL TRUTH GUARDRAIL (NO EXPERIENCE INFLATION): You must NEVER inflate or alter verified years of experience (e.g. 7 years must NEVER be changed to 10 years to match the job description requirement). The candidate's verified years of experience must be preserved VERBATIM.
3. **No Fluff or Invented Claims**: Keep all years of experience, core technical stack, and factual background grounded strictly in the candidate's actual resume evidence.
4. **Anti-AI Authentic Engineering Voice (Strictly Forbidden Clichés)**: Strictly avoid cliché AI resume buzzwords. Do NOT use words such as: "results-driven", "passionate", "proven track record", "proven ability", "demonstrates expertise", "demonstrated expertise", "seasoned", "spearheaded", "leveraged", "dynamic professional", "adept at", "testament to", "orchestrating excellence", "synergistic", "transformative impact", "cross-functional to deliver", "drive digital transformation", "driving digital transformation", "align with business objectives", "operational efficiency". Write with direct, confident, human clarity that hiring managers respect.
5. **Output Bounds**: Output ONLY the polished summary paragraph text. Do not include preambles or section title headers.
6. **Resume-Only Technologies & Skills**: Only reference technologies and skills that explicitly appear in the candidate's resume. Do NOT introduce any technology, framework, tool, cloud service, or skill from the Job Description that is absent from the candidate's text (e.g. do NOT claim 'Microsoft AI Services' or 'Azure' if absent).
7. **Preserve Years of Experience Verbatim**: Use the candidate's stated years of experience exactly as written in their original summary or evidence (e.g. '7+ years'). NEVER adjust or inflate years of experience to match the job description's requirement.
8. **Third-Person Professional Stance**: Write in standard professional third-person perspective (omitting pronouns like 'I' or 'he/she', e.g., 'Senior Full Stack Developer with 7+ years of experience... Brings technical ownership...').
"""

BANNED_AI_SUMMARY_PHRASES = [
    r"\bresults-driven\b",
    r"\boutcome-oriented\b",
    r"\bgoal-oriented\b",
    r"\bproven\s+(?:ability|track\s+record|history|expertise)\b(?:\s+to)?",
    r"\bdemonstrat(?:es|ed|ing)\s+expertise(?:\s+in)?\b",
    r"\bdemonstrated\s+history\s+of\s+success\b",
    r"\bseasoned(?:\s+professional)?\b",
    r"\bseasoned\b",
    r"\bdynamic(?:\s+professional)?\b",
    r"\bdynamic\b",
    r"\bpassionate(?:\s+(?:engineer|developer|professional|architect))?\b",
    r"\bpassionate\b",
    r"\bdedicated\s+professional\b",
    r"\bspearhead(?:ed|ing|s)?\b",
    r"\badept\s+at\b",
    r"\bsynerg(?:y|ies|istic|ize|ized|izing)\b",
    r"\borchestrat(?:ing|ed|es)?\s+excellence\b",
    r"\btestament\s+to\b",
    r"\b(?:drive|driving|drives|driven)\s+digital\s+transformation\b",
    r"\bdigital\s+transformation\b",
    r"\balign(?:s|ing)?\s+with\s+business\s+objectives\b",
    r"\benhancing\s+operational\s+efficiency\b",
    r"\boperational\s+efficiency\b",
    r"\bcollaborate\s+with\s+cross-functional\b",
    r"\bcross-functional\s+(?:to\s+deliver|paradigms|collaboration)\b",
    r"\bcross-functional\b",
    r"\btransformative\s+impact\b",
    r"\bleverag(?:ed|ing|es)\b",
]


def sanitize_anti_ai_summary(text: str) -> str:
    """Strip cliché AI buzzwords if any slip through into summary rewrites."""
    cleaned = text
    for pat in BANNED_AI_SUMMARY_PHRASES:
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE)
    # Clean up broken articles/prepositions like "with a of" or "a and"
    cleaned = re.sub(r"\bwith\s+a\s+of\b", "with", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\ba\s+and\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bto\s+deliver\s+robust\b", "delivering robust", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bto\s+collaborate\s+to\b", "collaborating to", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+([,\.])", r"\1", cleaned)
    cleaned = re.sub(r",\s*,", ",", cleaned)
    cleaned = re.sub(r"\.\s*\.", ".", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def extract_candidate_years_from_evidence(all_evidence_text: str) -> str | None:
    """Extract candidate's verified years of experience from resume evidence text.

    Looks for explicit phrases first (e.g. '7 years of full-stack development experience',
    '7+ years', '7 years'), and falls back to computing the span from experience date ranges.
    """
    if not all_evidence_text:
        return None

    pat = re.compile(
        r"\b(\d+\+?)\s*(?:years?|yrs)(?:\s+(?:of\s+)?[\w\s-]{1,30})?\s+experience\b",
        re.IGNORECASE,
    )
    m = pat.search(all_evidence_text)
    if m:
        num = m.group(1).strip()
        return f"{num}+ years" if not num.endswith("+") else f"{num} years"

    pat2 = re.compile(r"\b(\d+\+?\s*(?:years?|yrs))\b", re.IGNORECASE)
    m2 = pat2.search(all_evidence_text)
    if m2:
        return m2.group(1).strip()

    # Fallback: calculate from experience date ranges
    year_matches = [int(y) for y in re.findall(r"\b(19\d\d|20\d\d)\b", all_evidence_text)]
    if year_matches:
        min_year = min(year_matches)
        has_present = bool(re.search(r"\b(present|current|now)\b", all_evidence_text, re.IGNORECASE))
        max_year = 2026 if has_present else max(year_matches)
        span = max_year - min_year
        if span >= 1:
            return f"{span}+ years"

    return None


def extract_candidate_primary_title_from_evidence(
    all_evidence_text: str,
    default: str = "Software Developer",
) -> str:
    """Extract candidate's real current or primary job title from evidence text."""
    if not all_evidence_text:
        return default

    # Check section headers like "[Wordpress Developer Feb 2025 - Present]"
    header_roles = re.findall(
        r"\[([^\]:\n]*(?:Developer|Engineer|Architect|Lead|Manager|Specialist|Consultant|Programmer|Administrator)[^\]:\n]*)\]",
        all_evidence_text,
        re.IGNORECASE,
    )
    if header_roles:
        cleaned_role = re.sub(
            r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|present|current|\d{4})\b.*",
            "",
            header_roles[0],
            flags=re.IGNORECASE,
        ).strip().strip("-|–—,")
        if len(cleaned_role) >= 3:
            return cleaned_role

    m_open = re.match(
        r"^\s*([A-Z][a-zA-Z\s/-]{2,35}?)\s+(?:with\s+\d+|having\s+\d+|specializ)",
        all_evidence_text,
    )
    if m_open:
        return m_open.group(1).strip()

    common_titles = [
        "Senior Full Stack Developer",
        "Full Stack Developer",
        "Senior Software Engineer",
        "Software Engineer",
        "Senior Frontend Developer",
        "Frontend Developer",
        "Senior Backend Developer",
        "Backend Developer",
        "React Native Developer",
        "WordPress Developer",
        "Mobile App Developer",
        "AI Engineer",
        "Data Engineer",
    ]
    for ct in common_titles:
        if re.search(r"\b" + re.escape(ct) + r"\b", all_evidence_text, re.IGNORECASE):
            return ct

    return default


def extract_target_role_title(job_description_text: str) -> str:
    """Extract target job title from the job description text."""
    if not job_description_text:
        return "Target Position"

    m = re.search(r"(?:Job\s+Title|Title|Position|Role)\s*:\s*([^\n\r]+)", job_description_text, re.IGNORECASE)
    if m:
        clean = m.group(1).strip().strip("*#-_")
        if 3 <= len(clean) <= 60:
            return clean

    lines = [l.strip().strip("*#-_") for l in job_description_text.split("\n") if l.strip()]
    for line in lines[:5]:
        if (
            any(kw in line.lower() for kw in ["engineer", "developer", "lead", "architect", "manager", "specialist", "scientist"])
            and len(line) <= 60
            and not line.lower().startswith(("about", "we are", "seeking", "looking"))
        ):
            return line

    return "Target Position"


def enforce_verified_years_of_experience(text: str, verified_years: str | None) -> str:
    """Ensure the rewritten summary preserves candidate's verified years of experience verbatim.

    If candidate has '7+ years' (or '7 years'), but LLM hallucinated '10 years' or '10+ years'
    to copy the job description, this function detects and replaces the false number.
    """
    if not text or not verified_years:
        return text

    m_ver = re.search(r"(\d+)", verified_years)
    if not m_ver:
        return text
    ver_num = int(m_ver.group(1))

    def _replace_years(match):
        found_num = int(match.group(1))
        if found_num != ver_num:
            return f"{verified_years} of experience"
        return match.group(0)

    cleaned = re.sub(
        r"\b(\d+)\+?\s*(?:years?|yrs)(?:\s+of\s+experience)?\b",
        _replace_years,
        text,
        count=1,
        flags=re.IGNORECASE,
    )
    return cleaned


def is_leadership_or_pm_target(
    target_role: str | None,
    positioning_mode: str | None = None,
) -> bool:
    """Check if the target role or positioning mode qualifies for leadership/PM summary customization."""
    pos = (positioning_mode or "").lower().strip()
    if pos in (
        "team_lead",
        "team_lead_transition",
        "lead",
        "tech_lead",
        "hands_on_tech_lead",
        "tech_project_manager",
        "technical_project_manager",
        "project_manager",
        "tpm",
        "pm",
    ):
        return True

    if not target_role:
        return False

    t_norm = target_role.lower().strip()
    leadership_keywords = [
        "team lead",
        "tech lead",
        "technical lead",
        "lead developer",
        "lead software engineer",
        "lead engineer",
        "lead architect",
        "project manager",
        "technical project manager",
        "program manager",
        "engineering manager",
        "delivery lead",
        "scrum master",
        "product manager",
    ]
    return any(kw in t_norm for kw in leadership_keywords)


def enforce_truthful_role_identity(
    text: str,
    candidate_title: str | None,
    target_role: str | None,
    verified_years: str | None,
    positioning_mode: str | None = None,
) -> str:
    """Ensure candidate is not falsely claimed to currently hold a target title they have never held.

    EXCEPTION FOR TEAM LEAD & PROJECT MANAGER:
    If candidate is targeting a Team Lead, Tech Lead, or Project Manager / Technical Project Manager role
    (e.g., target_role contains 'Team Lead' or 'Project Manager', or positioning_mode is set to leadership),
    we allow customized leadership/PM openings (e.g. 'Technical Project Manager with 7+ years...',
    'Team Lead with 7+ years...'), while strictly locking verified years of experience verbatim
    (e.g., 7 is never inflated to 10).

    For non-leadership/unrelated targets (e.g. target is 'Cloud Solutions Architect' or 'Lead AI Engineer'
    when candidate has no AI background), an ungrounded opening like 'Lead AI Engineer with 7+ years...'
    is transformed into an honest bridge:
    'Full Stack Developer with 7+ years of experience..., positioning for Lead AI Engineer roles.'
    """
    if not text or not candidate_title or not target_role:
        return text

    c_norm = candidate_title.lower().strip()
    t_norm = target_role.lower().strip()

    if c_norm == t_norm or t_norm in ["target position", "target role"]:
        return text

    # Check if target role qualifies for the leadership/PM customization exception
    if is_leadership_or_pm_target(target_role, positioning_mode):
        # We allow leadership/PM title customization in the opening!
        # E.g. "Technical Project Manager with 7+ years...", "Team Lead / Senior Developer with 7+ years..."
        # But if the title claims a totally unverified technical specialty (like AI) without candidate background,
        # fall through to truthful bridge.
        if "ai" in t_norm and "ai" not in c_norm:
            pass  # Fall through to truthful bridge because candidate has no AI background
        else:
            return text

    pat = rf"^(?:(?:As\s+a|As\s+an|A|An)\s+)?{re.escape(target_role)}\s+with\s+(\d+\+?\s*(?:years?|yrs)(?:\s+of\s+experience)?)"
    m = re.match(pat, text, flags=re.IGNORECASE)
    if m:
        years_phrase = m.group(1)
        rest = text[m.end():].lstrip()
        if rest.startswith("in ") and "positioning for" not in rest.lower():
            parts = rest.split(".", 1)
            first_sent = parts[0].strip()
            remaining = ("." + parts[1]) if len(parts) > 1 else "."
            new_first_sent = f"{candidate_title} with {years_phrase} {first_sent}, positioning for {target_role} roles{remaining}"
            return new_first_sent
        return f"{candidate_title} with {years_phrase}, positioning for {target_role} roles. {rest}"

    return text


def _build_evidence_from_batch_items(sections: list, current_sec_name: str) -> str:
    """Build structured plain text evidence from all sibling sections in a batch rewrite request."""
    ev_parts = []
    for item in sections:
        s_name = getattr(item, "section_name", "")
        if s_name.lower().strip() == current_sec_name.lower().strip():
            continue
        content = getattr(item, "section_content", None)
        if not content:
            continue
        if isinstance(content, dict):
            if "entries" in content:
                for e in content.get("entries", []):
                    if isinstance(e, dict):
                        role = e.get("job_title") or e.get("name") or ""
                        comp = e.get("company", "")
                        dates = f"{e.get('start_date', '')} - {e.get('end_date', 'Present')}".strip(" -")
                        header = f"[{s_name}: {role}" + (f" @ {comp}" if comp else "") + (f" ({dates})" if dates else "") + "]"
                        bullets = e.get("bullets") or []
                        ev_parts.append(header + "\n" + "\n".join(f"• {b}" for b in bullets))
                    elif isinstance(e, str) and e.strip():
                        ev_parts.append(f"[{s_name}]\n{e}")
            elif "categories" in content:
                for c in content.get("categories", []):
                    cname = c.get("category_name", "Skills")
                    s_list = c.get("skills", [])
                    if s_list:
                        ev_parts.append(f"[{s_name}: {cname}]\n" + ", ".join(s_list))
            elif "text" in content and content["text"].strip():
                ev_parts.append(f"[{s_name}]\n{content['text']}")
        elif isinstance(content, str) and content.strip():
            ev_parts.append(f"[{s_name}]\n{content}")
    return "\n\n".join(ev_parts)


def build_summary_positioning_instructions(
    positioning_mode: str | None = None,
    user_instructions: str | None = None,
) -> str | None:
    """Build guidance for leadership / role positioning presets in professional summaries."""
    pos_mode = (positioning_mode or "").lower().strip()
    if not pos_mode and user_instructions:
        u_lower = user_instructions.lower()
        if any(k in u_lower for k in ["project manager", "technical project manager", "tpm", "pm role", "scrum master"]):
            pos_mode = "tech_project_manager"
        elif any(k in u_lower for k in ["team lead", "lead developer", "stepping up", "leadership", "lead role"]):
            pos_mode = "team_lead_transition"
        elif any(k in u_lower for k in ["tech lead", "hands-on lead", "hands on lead"]):
            pos_mode = "hands_on_tech_lead"
        elif any(k in u_lower for k in ["individual contributor", "senior ic"]):
            pos_mode = "senior_ic"

    preset_guidance = None
    if pos_mode in ("team_lead", "team_lead_transition", "lead"):
        preset_guidance = (
            "=== ROLE POSITIONING: TEAM LEAD ===\n"
            "The candidate is positioning for a Team Lead / Software Engineering Lead role in their domain.\n"
            "1. Ground the summary in their verified senior engineering foundation from evidence.\n"
            "2. Highlight demonstrated readiness for technical ownership: architecture, code reviews, developer mentorship, and reliable sprint delivery.\n"
            "3. OPENING CUSTOMIZATION EXCEPTION: You may customize the summary opening for Team Lead (e.g., 'Team Lead / Senior Software Engineer with [Verified Years] of experience...' or 'Engineering Team Lead with [Verified Years] of full-stack development experience...').\n"
            "4. STRICT FACTUAL LOCK: NEVER inflate verified years of experience (e.g. 7 years must NEVER be changed to 10 years). Preserve verified years verbatim. Never claim unsupported technologies."
        )
    elif pos_mode in ("hands_on_tech_lead", "tech_lead"):
        preset_guidance = (
            "=== ROLE POSITIONING: HANDS-ON TECHNICAL LEAD ===\n"
            "The candidate is positioning as a Hands-on Tech Lead.\n"
            "1. Emphasize the dual-track credibility: deep hands-on coding and technical craftsmanship paired with technical direction, system architecture, engineering standards, and team delivery execution.\n"
            "2. OPENING CUSTOMIZATION EXCEPTION: Frame opening as a Hands-on Technical Lead (e.g. 'Hands-on Technical Lead with [Verified Years] of software engineering experience...').\n"
            "3. STRICT FACTUAL LOCK: Preserve verified years of experience verbatim; never claim unsupported technologies."
        )
    elif pos_mode in ("tech_project_manager", "technical_project_manager", "project_manager", "tpm", "pm"):
        preset_guidance = (
            "=== ROLE POSITIONING: TECHNICAL PROJECT MANAGER (TPM) ===\n"
            "The candidate is positioning as a Technical Project Manager / Engineering Project Lead.\n"
            "1. Frame verified software engineering depth as a major delivery advantage: sprint planning, Agile/Scrum execution, roadmap alignment, task estimation, risk mitigation, and clear stakeholder communication.\n"
            "2. OPENING CUSTOMIZATION EXCEPTION: You may customize the summary opening for Technical Project Manager (e.g., 'Technical Project Manager with [Verified Years] of software engineering and delivery experience...', or 'Technical Project Manager & Engineering Lead with [Verified Years] of experience...').\n"
            "3. STRICT FACTUAL LOCK: NEVER inflate or alter verified years of experience (e.g. 7 years must NEVER be changed to 10 years). Preserve verified years verbatim. Only use technologies present in candidate evidence."
        )
    elif pos_mode in ("senior_ic", "individual_contributor"):
        preset_guidance = (
            "=== ROLE POSITIONING: SENIOR INDIVIDUAL CONTRIBUTOR ===\n"
            "The candidate is positioning as a senior technical specialist.\n"
            "1. Emphasize deep technical mastery, resilient architecture design, and core software engineering craftsmanship without team management or people leadership emphasis.\n"
            "2. TRUTHFUL POSITIONING: Preserve verified years of experience and factual stack without inflation."
        )
    elif pos_mode in ("default", "target_match"):
        preset_guidance = (
            "=== ROLE POSITIONING: TARGET JOB POSITIONING ===\n"
            "Align professional focus directly with the target job title and domain requirements.\n"
            "TRUTHFUL POSITIONING: Do NOT falsely claim the candidate already holds the target role title if absent from their resume. Bridge their verified background to the target role honestly."
        )

    parts = []
    if preset_guidance:
        parts.append(preset_guidance)
    if user_instructions and user_instructions.strip():
        parts.append(f"USER REFINEMENT INSTRUCTIONS: {user_instructions.strip()}")

    if parts:
        return "\n\n".join(parts)
    return None



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
        preloaded_sections: list | None = None,
        positioning_mode: str | None = None,
    ) -> RewriteSectionResponse:
        """Rewrite a single section of the resume using OpenAI structured outputs."""
        logger.info(
            "Starting section rewrite",
            document_id=document_id,
            section=section_name,
            has_user_instructions=user_instructions is not None,
            has_metric_inputs=metric_inputs is not None,
            positioning_mode=positioning_mode,
        )

        # 1. Load document sections (use preloaded if available to save disk I/O & XML parsing)
        if preloaded_sections is not None:
            sections = preloaded_sections
        else:
            sections_response = self._sections.detect_document_sections(document_id)
            sections = sections_response.sections

        def _normalize_title(t: str) -> str:
            clean_t = t.replace("[", "").replace("]", "").strip()
            return " ".join(clean_t.lower().split())

        def _section_matches(s_title: str, target_name: str) -> bool:
            n1 = _normalize_title(s_title)
            n2 = _normalize_title(target_name)
            if n1 == n2:
                return True
            if n1.rstrip("s") == n2.rstrip("s"):
                return True
            if n1 in n2 or n2 in n1:
                return True
            is_exp1 = any(kw in n1 for kw in ["experience", "work", "employment", "career"])
            is_exp2 = any(kw in n2 for kw in ["experience", "work", "employment", "career"])
            return bool(is_exp1 and is_exp2)

        # 2. Find target section with fuzzy matching
        target_sec = next(
            (s for s in sections if _section_matches(s.title, section_name)),
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
        if is_exp_sec and (not original_text.strip() or _normalize_title(original_text) == _normalize_title(target_sec.title)):
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
            if r_item and "weave" in r_item.lower() and ":" in r_item:
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
            (
                f"=== RECRUITER RECOMMENDATIONS FOR THIS SECTION ===\n"
                f"{' / '.join(sanitized_recs) if sanitized_recs else 'Improve overall impact using Google XYZ formula.'}"
            ),
        ]
        if not is_skills_section:

            from app.services.patch_service import (
                _is_metadata_line,
            )

            # Count non-metadata non-empty content lines from the original section text
            non_meta_lines = [l for l in orig_lines if not _is_metadata_line(l)]

            # Try to detect if there is a non-bullet overview paragraph at the top of each role

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

        if is_summary_section:
            pos_inst = build_summary_positioning_instructions(positioning_mode, user_instructions)
            if pos_inst:
                input_parts.append(pos_inst)

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
            max_output_tokens=700,
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

        if is_summary_section:
            result.rewritten_text = sanitize_anti_ai_summary(result.rewritten_text)

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
        positioning_mode: str | None = None,
    ) -> RewriteSectionResponse:
        """Rewrite a single section using JSON content instead of a DOCX file."""

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

            def _process_exp_entry(entry):
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
                orig_block = "\n".join(entry_orig_lines)

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
                    rewritten_block = "\n".join(rewritten_entry_lines)
                else:
                    rewritten_block = orig_block
                return orig_block, rewritten_block

            with ThreadPoolExecutor(max_workers=8) as executor:
                results = list(executor.map(_process_exp_entry, entries))

            full_original = "\n\n".join([r[0] for r in results])
            full_rewritten = "\n\n".join([r[1] for r in results])

            return RewriteSectionResponse(
                section=section_name,
                original_text=full_original,
                rewritten_text=full_rewritten,
                reasoning="All experience entries tailored concurrently.",
                changes=[
                    RewriteChangeItem(
                        type=RewriteChangeType.KEYWORD,
                        description="Preserved all role entries and tailored bullet points concurrently."
                    )
                ],
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

            def _process_proj_entry(entry):
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
                orig_block = "\n".join(entry_orig_lines)

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
                    rewritten_block = "\n".join(rewritten_entry_lines)
                else:
                    rewritten_block = orig_block
                return orig_block, rewritten_block

            with ThreadPoolExecutor(max_workers=8) as executor:
                results = list(executor.map(_process_proj_entry, entries))

            full_original = "\n\n".join([r[0] for r in results])
            full_rewritten = "\n\n".join([r[1] for r in results])

            return RewriteSectionResponse(
                section=section_name,
                original_text=full_original,
                rewritten_text=full_rewritten,
                reasoning="All project entries tailored concurrently.",
                changes=[
                    RewriteChangeItem(
                        type=RewriteChangeType.KEYWORD,
                        description="Preserved all project entries and tailored bullet points concurrently."
                    )
                ],
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
            positioning_mode=positioning_mode,
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
        positioning_mode: str | None = None,
    ) -> RewriteSectionResponse:
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
            (
                f"=== RECRUITER RECOMMENDATIONS FOR THIS SECTION ===\n"
                f"{' / '.join(sanitized_recs) if sanitized_recs else 'Improve overall impact using Google XYZ formula.'}"
            ),
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

        if user_instructions:
            input_parts.append(f"=== CANDIDATE INSTRUCTIONS FOR REFINEMENT ===\n{user_instructions.strip()}")

        verified_years = None
        candidate_primary_title = None
        target_role = None

        if is_summary_section:
            verified_years = extract_candidate_years_from_evidence(all_evidence_text)
            candidate_primary_title = extract_candidate_primary_title_from_evidence(all_evidence_text)
            target_role = extract_target_role_title(job_description_text)

            factual_anchor = (
                "=== MANDATORY FACTUAL INTEGRITY & TRUTHFULNESS DIRECTIVES ===\n"
                f"- Verified Candidate Years of Experience: {verified_years or 'Preserve exactly from evidence'}\n"
                f"- Candidate Background / Primary Title: {candidate_primary_title or 'Ground in resume evidence'}\n"
                f"- Target Applied Role: {target_role}\n\n"
                "STRICT ANTI-FABRICATION CONSTRAINTS:\n"
                "1. ROLE POSITIONING DIRECTIVE: If applying for a Team Lead, Tech Lead, or Project Manager / Technical Project Manager role, you may customize the summary opening (e.g., 'Technical Project Manager with [Verified Years] of software engineering and delivery experience...', or 'Team Lead / Senior Software Engineer with [Verified Years] of experience...'). For other transitions (e.g., 'Lead AI Engineer' when candidate is a 'Full Stack Developer'), do NOT claim the unearned technical domain title as current identity; write an authentic transition ('Full Stack Developer with 7+ years of experience..., positioning for Lead AI Engineer roles...').\n"
                f"2. NEVER INFLATE YEARS OF EXPERIENCE. The candidate has {verified_years or 'their verified years'}. Do NOT copy the JD's requirement (e.g., if JD asks for 10 years, claiming 10 years is an explicit lie and disqualifies the candidate). Preserve verified years verbatim.\n"
                "3. ZERO TOLERANCE FOR UNVERIFIED TECHNOLOGIES. Never claim candidate specializes in or has experience with JD technologies (e.g. Microsoft AI Services, Azure) unless they appear in EVIDENCE CONTEXT.\n"
                "4. ZERO TOLERANCE FOR ROBOTIC AI CLICHÉS. Strictly avoid: 'results-driven', 'passionate', 'proven ability', 'proven track record', 'demonstrates expertise', 'drive digital transformation', 'cross-functional to deliver', 'align with business objectives', 'enhancing operational efficiency'."
            )
            input_parts.append(factual_anchor)

            pos_inst = build_summary_positioning_instructions(positioning_mode, user_instructions)
            if pos_inst:
                input_parts.append(pos_inst)

        input_parts.append(f"=== EVIDENCE CONTEXT (FROM REST OF RESUME) ===\n{evidence_context}")
        input_parts.append(f"=== ORIGINAL SECTION TEXT TO REWRITE ===\n{original_text}")

        full_input = "\n\n".join(input_parts)

        try:
            result = self._provider.parse_response(
                instructions=system_prompt,
                input_text=full_input,
                response_format=RewriteSectionResponse,
                max_output_tokens=700,
            )
        except Exception as exc:
            raise BadRequestError(f"AI rewrite failed: {exc!s}")

        rewritten_text, _ = sanitize_unsupported_skills_from_text(result.rewritten_text, effective_unsupported_techs)
        if is_summary_section:
            if verified_years:
                rewritten_text = enforce_verified_years_of_experience(rewritten_text, verified_years)
            if candidate_primary_title and target_role:
                rewritten_text = enforce_truthful_role_identity(
                    rewritten_text,
                    candidate_primary_title,
                    target_role,
                    verified_years,
                    positioning_mode,
                )
            rewritten_text = sanitize_anti_ai_summary(rewritten_text)
        result.rewritten_text = rewritten_text
        result.original_text = original_text
        result.section = section_name
        return result

    def batch_rewrite(
        self,
        document_id: str | None,
        job_description_text: str,
        sections: list,
        user_instructions: str | None = None,
        metric_inputs: dict[str, str] | None = None,
        positioning_mode: str | None = None,
    ) -> dict[str, str]:
        """Execute parallel batch AI tailoring across multiple sections concurrently."""
        results_map: dict[str, str] = {}

        # Pre-cache document sections once upfront to avoid repeating file I/O & XML parsing per thread
        cached_sections = None
        if document_id:
            try:
                cached_sections = self._sections.detect_document_sections(document_id).sections
            except Exception as e:
                logger.warning(f"Could not pre-cache document sections for batch rewrite: {e}")

        def _process_item(item):
            sec_name = item.section_name
            sec_type = item.section_type
            sec_content = item.section_content
            recs = item.recommendations or []
            item_pos_mode = getattr(item, "positioning_mode", None) or positioning_mode

            try:
                # Direct header pass-through: target job title designation does not require LLM call
                if sec_name.lower().strip() in ["header", "job title", "target role", "title"]:
                    title_text = ""
                    if isinstance(sec_content, str) and sec_content.strip():
                        title_text = sec_content.strip()
                    elif hasattr(item, "user_instructions") and item.user_instructions and item.user_instructions.strip():
                        title_text = item.user_instructions.strip()

                    if not title_text:
                        import re
                        for line in job_description_text.split("\n")[:8]:
                            line_str = line.strip()
                            if line_str and len(line_str) < 60 and not line_str.startswith("http") and "@" not in line_str:
                                m = re.search(r'(?:role|title|position)\s*:\s*([A-Za-z0-9\s\-\/\&]{3,60})', line_str, re.IGNORECASE)
                                title_text = m.group(1).strip() if m else line_str.replace("#", "").strip()
                                if title_text and not any(k in title_text.lower() for k in ["about", "description", "requirements", "responsibilities"]):
                                    break

                    return sec_name, title_text or "Target Position"

                if sec_content is not None and sec_type is not None:
                    batch_ev_text = _build_evidence_from_batch_items(sections, sec_name)
                    res = self.rewrite_from_json(
                        section_name=sec_name,
                        section_type=sec_type,
                        section_content=sec_content,
                        evidence_text=batch_ev_text,
                        job_description_text=job_description_text,
                        recommendations=recs,
                        user_instructions=user_instructions,
                        metric_inputs=metric_inputs,
                        positioning_mode=item_pos_mode,
                    )
                elif document_id:
                    res = self.rewrite(
                        document_id=document_id,
                        section_name=sec_name,
                        job_description_text=job_description_text,
                        recommendations=recs,
                        user_instructions=user_instructions,
                        metric_inputs=metric_inputs,
                        preloaded_sections=cached_sections,
                        positioning_mode=item_pos_mode,
                    )
                else:
                    return sec_name, ""

                return sec_name, res.rewritten_text
            except Exception as err:
                logger.error(f"Batch rewrite error for '{sec_name}': {err}")
                return sec_name, ""

        with ThreadPoolExecutor(max_workers=16) as executor:
            batch_results = list(executor.map(_process_item, sections))

        for sec_name, text in batch_results:
            if text:
                results_map[sec_name.lower()] = text
                results_map[sec_name] = text

        return results_map
