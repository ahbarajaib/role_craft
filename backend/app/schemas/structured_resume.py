"""Structured resume Pydantic schemas.

Defines the normalized JSON structure for resumes, including contact info,
experience, skills, education, projects, certifications, custom sections,
parse confidence flags, and template metadata.
"""

from typing import Any, Optional
from pydantic import BaseModel, Field


class ContactInfo(BaseModel):
    full_name: Optional[str] = Field(None, description="Candidate full name")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    location: Optional[str] = Field(None, description="City, Country / Location")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")
    portfolio_url: Optional[str] = Field(None, description="Personal website or portfolio URL")
    github_url: Optional[str] = Field(None, description="GitHub profile URL")


class SkillCategory(BaseModel):
    category_name: str = Field(..., description="Category header, e.g., Languages, Frameworks")
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
    name: str = Field(..., description="Project name")
    description: Optional[str] = Field(None, description="Brief description")
    technologies: list[str] = Field(default_factory=list, description="Technologies used")
    bullets: list[str] = Field(default_factory=list, description="Bullet points detailing achievements")
    url: Optional[str] = Field(None, description="Project link or repo URL")


class CertificationEntry(BaseModel):
    name: str = Field(..., description="Certification or license title")
    issuer: Optional[str] = Field(None, description="Issuing organization")
    date: Optional[str] = Field(None, description="Issue date or expiration")
    credential_id: Optional[str] = Field(None, description="Credential ID or verification link")


class CustomSection(BaseModel):
    title: str = Field(..., description="Custom section header")
    entries: list[str] = Field(default_factory=list, description="List of free-form text bullet points or entries")


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
