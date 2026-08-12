"""Structured resume Pydantic schemas.

Defines the normalized JSON structure for resumes, including contact info,
experience, skills, education, projects, certifications, custom sections,
parse confidence flags, and template metadata.
"""

from typing import Any, Optional
from pydantic import BaseModel, Field


class ContactInfo(BaseModel):
    full_name: Optional[str] = Field(None, description="Candidate full name")
    job_title: Optional[str] = Field(None, description="Professional headline or target job title")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    location: Optional[str] = Field(None, description="City, Country / Location")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")
    portfolio_url: Optional[str] = Field(None, description="Personal website or portfolio URL")
    github_url: Optional[str] = Field(None, description="GitHub profile URL")


class SkillCategory(BaseModel):
    category_name: Optional[str] = Field(None, description="Category header, e.g., Languages, Frameworks")
    skills: list[str] = Field(default_factory=list, description="List of skill names in this category")


class ExperienceEntry(BaseModel):
    job_title: Optional[str] = Field(None, description="Job title / role")
    company: Optional[str] = Field(None, description="Company or organization name")
    location: Optional[str] = Field(None, description="Job location")
    start_date: Optional[str] = Field(None, description="Start date (e.g. Jan 2022)")
    end_date: Optional[str] = Field(None, description="End date or Present")
    bullets: list[str] = Field(default_factory=list, description="Bullet points describing achievements")


class EducationEntry(BaseModel):
    degree: Optional[str] = Field(None, description="Degree or qualification name")
    institution: Optional[str] = Field(None, description="University or school name")
    location: Optional[str] = Field(None, description="Institution location")
    graduation_date: Optional[str] = Field(None, description="Graduation date or year")
    gpa: Optional[str] = Field(None, description="GPA or honors if specified")
    details: list[str] = Field(default_factory=list, description="Additional course details or honors")


class ProjectEntry(BaseModel):
    name: Optional[str] = Field(None, description="Project name")
    description: Optional[str] = Field(None, description="Brief description")
    technologies: list[str] = Field(default_factory=list, description="Technologies used")
    bullets: list[str] = Field(default_factory=list, description="Bullet points detailing achievements")
    url: Optional[str] = Field(None, description="Project link or repo URL")


class CertificationEntry(BaseModel):
    name: Optional[str] = Field(None, description="Certification or license title")
    issuer: Optional[str] = Field(None, description="Issuing organization")
    date: Optional[str] = Field(None, description="Issue date or expiration")
    credential_id: Optional[str] = Field(None, description="Credential ID or verification link")


class CustomSection(BaseModel):
    title: str = Field(..., description="Custom section header")
    entries: list[str] = Field(default_factory=list, description="List of free-form text bullet points or entries")


def normalize_section_type(sec_type: str, sec_title: str = "") -> str:
    """Normalize raw section type string or title into canonical section type."""
    st = (sec_type or "").lower().strip().replace("-", "_").replace(" ", "_")
    tt = (sec_title or "").lower().strip()

    if any(k in st or k in tt for k in ["exp", "work", "job", "career", "employment", "history", "position"]):
        return "experience"
    elif any(k in st or k in tt for k in ["skill", "competenc", "technolog", "tool", "expert", "proficien"]):
        return "skills"
    elif any(k in st or k in tt for k in ["edu", "academic", "degree", "qualification", "university", "school"]):
        return "education"
    elif any(k in st or k in tt for k in ["proj", "portfolio"]):
        return "projects"
    elif any(k in st or k in tt for k in ["certif", "license", "credential", "course"]):
        return "certifications"
    elif any(k in st or k in tt for k in ["summar", "profile", "about", "objective", "headline"]):
        return "summary"
    return "custom"


class SectionContent(BaseModel):
    text: Optional[str] = Field(None, description="Text content for summary or text sections")
    categories: list[SkillCategory] = Field(default_factory=list, description="Skill categories for skills section")
    experience_entries: list[ExperienceEntry] = Field(default_factory=list, description="Work experience job entries")
    education_entries: list[EducationEntry] = Field(default_factory=list, description="Education degree/qualification entries")
    project_entries: list[ProjectEntry] = Field(default_factory=list, description="Project entries")
    certification_entries: list[CertificationEntry] = Field(default_factory=list, description="Certifications / license entries")
    custom_entries: list[str] = Field(default_factory=list, description="Text entries/bullet points for custom sections")

    def to_dict(self, section_type: str = "", section_title: str = "") -> dict[str, Any]:
        """Convert SectionContent into standard dictionary format expected by UI and renderers."""
        norm_type = normalize_section_type(section_type, section_title)

        if norm_type == "summary":
            txt = self.text or (self.custom_entries[0] if self.custom_entries else "")
            return {"text": txt}

        elif norm_type == "skills":
            if self.categories:
                return {"categories": [c.model_dump() for c in self.categories]}
            elif self.custom_entries:
                return {"categories": [{"category_name": "Core Skills", "skills": self.custom_entries}]}
            elif self.text:
                skills = [s.strip() for s in self.text.replace("\n", ",").split(",") if s.strip()]
                return {"categories": [{"category_name": "Core Skills", "skills": skills}]}

        elif norm_type == "experience":
            if self.experience_entries:
                return {"entries": [e.model_dump() for e in self.experience_entries]}
            elif self.custom_entries:
                return {"entries": self.custom_entries}
            elif self.text:
                lines = [line.strip() for line in self.text.split("\n") if line.strip()]
                return {"entries": lines}

        elif norm_type == "education":
            if self.education_entries:
                return {"entries": [e.model_dump() for e in self.education_entries]}
            elif self.custom_entries:
                return {"entries": self.custom_entries}
            elif self.text:
                lines = [line.strip() for line in self.text.split("\n") if line.strip()]
                return {"entries": lines}

        elif norm_type == "projects":
            if self.project_entries:
                return {"entries": [e.model_dump() for e in self.project_entries]}
            elif self.custom_entries:
                return {"entries": self.custom_entries}
            elif self.text:
                lines = [line.strip() for line in self.text.split("\n") if line.strip()]
                return {"entries": lines}

        elif norm_type == "certifications":
            if self.certification_entries:
                return {"entries": [e.model_dump() for e in self.certification_entries]}
            elif self.custom_entries:
                return {"entries": self.custom_entries}
            elif self.text:
                lines = [line.strip() for line in self.text.split("\n") if line.strip()]
                return {"entries": lines}

        # Fallback for any custom or unrecognized section type
        if self.experience_entries:
            return {"entries": [e.model_dump() for e in self.experience_entries]}
        elif self.education_entries:
            return {"entries": [e.model_dump() for e in self.education_entries]}
        elif self.project_entries:
            return {"entries": [e.model_dump() for e in self.project_entries]}
        elif self.certification_entries:
            return {"entries": [e.model_dump() for e in self.certification_entries]}
        elif self.categories:
            return {"categories": [c.model_dump() for c in self.categories]}
        elif self.custom_entries:
            return {"entries": self.custom_entries}
        elif self.text:
            return {"text": self.text}
        else:
            return {"entries": []}


class ResumeSectionParseModel(BaseModel):
    """Explicitly typed model for OpenAI response_format parsing (no dict[str, Any] allowed by OpenAI strict schema)."""

    section_type: str = Field(
        ...,
        description="Section classification: 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'certifications' | 'custom'",
    )
    section_title: str = Field(..., description="Section heading title as displayed on resume")
    order: int = Field(..., description="Zero-based display order")
    visible: bool = Field(True, description="Whether section is active/rendered")
    content: SectionContent = Field(..., description="Explicitly typed section content")


class ResumeSection(BaseModel):
    section_type: str = Field(
        ...,
        description="Section classification: 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'certifications' | 'custom'",
    )
    section_title: str = Field(..., description="Section heading title as displayed on resume")
    order: int = Field(..., description="Zero-based display order")
    visible: bool = Field(True, description="Whether section is active/rendered")
    content: dict[str, Any] = Field(
        default_factory=dict,
        description="Content specific to section type (e.g. text for summary, entries list for experience)",
    )


class ParseConfidence(BaseModel):
    low_confidence_fields: list[str] = Field(
        default_factory=list,
        description="JSON paths of fields that AI parsed with low confidence or couldn't parse cleanly",
    )
    overall_confidence: float = Field(1.0, description="Overall parsing confidence score from 0.0 to 1.0")


class StructuredResumeParseModel(BaseModel):
    """Schema passed to OpenAI's response_format API to strictly conform to OpenAI Structured Outputs constraints."""

    contact_info: ContactInfo = Field(default_factory=ContactInfo)
    summary: Optional[str] = Field(None, description="Professional summary text")
    profile_photo_url: Optional[str] = Field(None, description="Relative URL to uploaded profile photo if any")
    sections: list[ResumeSectionParseModel] = Field(default_factory=list, description="Ordered resume sections")
    parse_confidence: ParseConfidence = Field(default_factory=ParseConfidence)
    source_format: Optional[str] = Field(None, description="Source format: 'docx' | 'pdf' | 'manual'")
    preferred_template: Optional[str] = Field(
        None,
        description="Selected ATS template: 'clean_classic' | 'modern_professional' | 'executive_profile'",
    )


class StructuredResume(BaseModel):
    contact_info: ContactInfo = Field(default_factory=ContactInfo)
    summary: Optional[str] = Field(None, description="Professional summary text")
    profile_photo_url: Optional[str] = Field(None, description="Relative URL to uploaded profile photo if any")
    sections: list[ResumeSection] = Field(default_factory=list, description="Ordered resume sections")
    parse_confidence: ParseConfidence = Field(default_factory=ParseConfidence)
    source_format: Optional[str] = Field(None, description="Source format: 'docx' | 'pdf' | 'manual'")
    preferred_template: Optional[str] = Field(
        None,
        description="Selected ATS template: 'clean_classic' | 'modern_professional' | 'executive_profile'",
    )


def is_section_non_empty(sec: ResumeSection) -> bool:
    """Return True if section contains actual non-empty content."""
    content = sec.content or {}

    # Check text / summary
    txt = content.get("text") or content.get("summary")
    if txt and str(txt).strip():
        return True

    # Check categories
    cats = content.get("categories") or []
    for cat in cats:
        if isinstance(cat, dict) and cat.get("skills"):
            if any(str(s).strip() for s in cat["skills"]):
                return True

    # Check entries
    entries = content.get("entries") or []
    for e in entries:
        if isinstance(e, str) and e.strip():
            return True
        elif isinstance(e, dict):
            if any(str(v).strip() for v in e.values() if v is not None and str(v).strip() and str(v) != "[]"):
                return True

    return False


def convert_parsed_to_structured(parsed: StructuredResumeParseModel) -> StructuredResume:
    """Convert AI-parsed StructuredResumeParseModel into normalized StructuredResume.
    
    Auto-extracts any experience, project, education, or certification entries that AI 
    might have nested inside another section object so no content is ever lost.
    """
    sections: list[ResumeSection] = []
    order_idx = 0

    exp_entries_to_split: list[dict[str, Any]] = []
    proj_entries_to_split: list[dict[str, Any]] = []
    edu_entries_to_split: list[dict[str, Any]] = []
    cert_entries_to_split: list[dict[str, Any]] = []

    has_summary_section = False
    has_exp_section = False
    has_proj_section = False
    has_edu_section = False
    has_cert_section = False

    for s in parsed.sections:
        canonical_type = normalize_section_type(s.section_type, s.section_title)

        # Check if AI nested experience, project, education, or certification entries into a non-matching section
        if canonical_type != "experience" and s.content.experience_entries:
            exp_entries_to_split.extend([e.model_dump() for e in s.content.experience_entries])
        if canonical_type != "projects" and s.content.project_entries:
            proj_entries_to_split.extend([p.model_dump() for p in s.content.project_entries])
        if canonical_type != "education" and s.content.education_entries:
            edu_entries_to_split.extend([e.model_dump() for e in s.content.education_entries])
        if canonical_type != "certifications" and s.content.certification_entries:
            cert_entries_to_split.extend([c.model_dump() for c in s.content.certification_entries])

        if canonical_type == "summary":
            has_summary_section = True
        elif canonical_type == "experience":
            has_exp_section = True
        elif canonical_type == "projects":
            has_proj_section = True
        elif canonical_type == "education":
            has_edu_section = True
        elif canonical_type == "certifications":
            has_cert_section = True

        content_dict = s.content.to_dict(s.section_type, s.section_title)
        candidate_sec = ResumeSection(
            section_type=canonical_type,
            section_title=s.section_title,
            order=order_idx,
            visible=s.visible,
            content=content_dict,
        )

        # FILTER OUT EMPTY SECTIONS: Only keep sections that contain actual content from the resume
        if is_section_non_empty(candidate_sec):
            candidate_sec.order = order_idx
            sections.append(candidate_sec)
            order_idx += 1

    # 1. Synthesize Professional Summary section if parsed.summary exists at top-level but wasn't in sections
    summary_text = (parsed.summary or "").strip()
    if summary_text and not has_summary_section:
        summary_sec = ResumeSection(
            section_type="summary",
            section_title="Professional Summary",
            order=0,
            visible=True,
            content={"text": summary_text},
        )
        sections.insert(0, summary_sec)

    # 2. Auto-split nested Experience entries
    if exp_entries_to_split:
        if has_exp_section:
            for sec in sections:
                if sec.section_type == "experience":
                    existing = sec.content.get("entries", [])
                    sec.content["entries"] = existing + exp_entries_to_split
        else:
            exp_sec = ResumeSection(
                section_type="experience",
                section_title="Professional Experience",
                order=len(sections),
                visible=True,
                content={"entries": exp_entries_to_split},
            )
            sections.append(exp_sec)

    # 3. Auto-split nested Project entries
    if proj_entries_to_split:
        if has_proj_section:
            for sec in sections:
                if sec.section_type == "projects":
                    existing = sec.content.get("entries", [])
                    sec.content["entries"] = existing + proj_entries_to_split
        else:
            proj_sec = ResumeSection(
                section_type="projects",
                section_title="Projects",
                order=len(sections),
                visible=True,
                content={"entries": proj_entries_to_split},
            )
            sections.append(proj_sec)

    # 4. Auto-split nested Education entries
    if edu_entries_to_split:
        if has_edu_section:
            for sec in sections:
                if sec.section_type == "education":
                    existing = sec.content.get("entries", [])
                    sec.content["entries"] = existing + edu_entries_to_split
        else:
            edu_sec = ResumeSection(
                section_type="education",
                section_title="Education",
                order=len(sections),
                visible=True,
                content={"entries": edu_entries_to_split},
            )
            sections.append(edu_sec)

    # 5. Auto-split nested Certification entries
    if cert_entries_to_split:
        if has_cert_section:
            for sec in sections:
                if sec.section_type == "certifications":
                    existing = sec.content.get("entries", [])
                    sec.content["entries"] = existing + cert_entries_to_split
        else:
            cert_sec = ResumeSection(
                section_type="certifications",
                section_title="Certifications",
                order=len(sections),
                visible=True,
                content={"entries": cert_entries_to_split},
            )
            sections.append(cert_sec)

    # Re-index all section orders cleanly
    for idx, sec in enumerate(sections):
        sec.order = idx

    return StructuredResume(
        contact_info=parsed.contact_info,
        summary=parsed.summary or (sections[0].content.get("text") if sections and sections[0].section_type == "summary" else None),
        profile_photo_url=parsed.profile_photo_url,
        sections=sections,
        parse_confidence=parsed.parse_confidence,
        source_format=parsed.source_format,
        preferred_template=parsed.preferred_template,
    )

