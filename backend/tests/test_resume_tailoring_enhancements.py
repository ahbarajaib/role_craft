from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.comparators.resume_comparator import compare_resume
from app.parsers.job_description_parser import parse_job_description
from app.schemas.job_description import JobDescription
from app.schemas.section import SectionItem, SectionParagraph
from app.services.resume_parser_service import ResumeParserService


def test_glued_subheadings_and_emojis_in_jd_parser():
    raw_text = """JOB TITLE:
Fullstack Engineer
COMPANY:
Tricog Health
JOB DESCRIPTION:
Responsibilities
• Deliver features across frontend and backend.
• Proactively identify opportunities to improve reliability.Requirements
• 2-4 years of professional software engineering experience.
• Strong proficiency in JavaScript / TypeScript.Experience Working With Databases
• MySQL is mandatory.
• MongoDB is good to have.Solid Understanding Of
• RESTful APIs, TypeScript.Experience With
• Unit testing and CI/CD pipelines.Nice-to-Have
• Exposure to Docker.Growth Expectations
• Own small-to-medium features end-to-end.Professional Attributes
• Strong ownership mindset.
"""
    jd = parse_job_description(raw_text)
    assert jd.title == "Fullstack Engineer"
    assert jd.company == "Tricog Health"
    assert len(jd.responsibilities) == 2
    assert "Deliver features across frontend and backend." in jd.responsibilities
    assert "Proactively identify opportunities to improve reliability." in jd.responsibilities
    assert len(jd.required_skills) >= 4
    assert any("2-4 years" in s for s in jd.required_skills)
    assert len(jd.preferred_skills) >= 2
    assert any("Docker" in s for s in jd.preferred_skills)


def test_location_and_experience_with_emojis():
    raw_text = """JOB TITLE:
Full Stack Developer
COMPANY:
Virallens
JOB TYPE:
On-site
JOB DESCRIPTION:
📍 Location: Bengaluru, Karnataka, India
🏢 Work Mode: On-site
💼 Employment Type: Full-time
🧑‍💻 Experience: 3-5 Years
About Virallens
We build high-performance platforms.
Responsibilities
• Build scalable systems
Requirements
• 3+ years experience
"""
    jd = parse_job_description(raw_text)
    assert jd.title == "Full Stack Developer"
    assert jd.company == "Virallens"
    assert jd.location == "Bengaluru, Karnataka, India"
    assert jd.experience_required == "3-5 Years"
    assert jd.employment_type == "On-site"


def test_location_extraction_ignores_mission_narrative():
    raw_text = """Job Description 1
JOB TITLE:
Full Stack Frontend Architect
COMPANY:
Noon
JOB DESCRIPTION:
We are on a mission to reinvent how designers work in the AI era. Backed by top investors from OpenAI, Google, Stripe, Notion and Dropbox, we're building the next-generation AI design tool for product teams.
What You’ll Do:
• Lead frontend
Requirements:
• 10+ years of professional experience building web apps.
• Location: Bengaluru.
"""
    jd = parse_job_description(raw_text)
    assert jd.title == "Full Stack Frontend Architect"
    assert jd.company == "Noon"
    assert jd.location == "Bengaluru"
    assert "mission" not in jd.location.lower()


def test_resume_comparator_tenure_gap_and_strict_years():
    sections = [
        SectionItem(
            title="Summary",
            normalized_name="summary",
            paragraph_indexes=[0],
            paragraphs=[SectionParagraph(index=0, text="Senior Engineer with 7+ years of experience in React and TypeScript.", style_name="Normal")],
        ),
        SectionItem(
            title="Experience",
            normalized_name="experience",
            paragraph_indexes=[1],
            paragraphs=[SectionParagraph(index=1, text="Built large-scale web applications for 5 years.", style_name="Normal")],
        ),
    ]
    jd = JobDescription(
        title="Frontend Architect",
        company="Noon",
        location="Bengaluru",
        employment_type="Full-time",
        experience_required="10+ years of professional experience building large-scale web applications.",
        responsibilities=["Lead frontend architecture"],
        required_skills=[
            "10+ years of professional experience building large-scale web applications.",
            "Strong proficiency in TypeScript",
        ],
        preferred_skills=[],
        technologies=["TypeScript", "React"],
        keywords=["architecture", "web", "applications"],
        raw_text="",
    )
    res = compare_resume(sections, jd)
    assert res.candidate_years == 7
    assert res.required_years == 10
    assert res.experience_gap_warning is not None
    assert "Role requires 10+ years" in res.experience_gap_warning
    assert "10+ years of professional experience building large-scale web applications." in res.missing_skills
    assert "Strong proficiency in TypeScript" in res.matched_skills


def test_resume_comparator_candidate_sufficient_tenure():
    sections = [
        SectionItem(
            title="Summary",
            normalized_name="summary",
            paragraph_indexes=[0],
            paragraphs=[SectionParagraph(index=0, text="Senior Engineer with 7+ years of experience in React and TypeScript.", style_name="Normal")],
        ),
        SectionItem(
            title="Experience",
            normalized_name="experience",
            paragraph_indexes=[1],
            paragraphs=[SectionParagraph(index=1, text="Delivered production features with React and Node.", style_name="Normal")],
        ),
    ]
    jd = JobDescription(
        title="Fullstack Developer",
        company="Tricog",
        location="Remote",
        employment_type="Full-time",
        experience_required="3-5 years experience",
        responsibilities=["Build web applications"],
        required_skills=[
            "3+ years experience with React and TypeScript",
        ],
        preferred_skills=[],
        technologies=["React", "TypeScript"],
        keywords=["developer", "features"],
        raw_text="",
    )
    res = compare_resume(sections, jd)
    assert res.candidate_years == 7
    assert res.required_years == 3
    assert res.experience_gap_warning is None
    assert "3+ years experience with React and TypeScript" in res.matched_skills


def test_fast_deterministic_docx_resume_parser_with_bullets():
    base_docx = Path("../Base resume.docx")
    if not base_docx.exists():
        pytest.skip("Base resume.docx not found in parent directory")

    svc = ResumeParserService(ai_provider=MagicMock())
    raw_text = svc._extract_docx_text(base_docx)
    structured = svc._try_fast_deterministic_parse(raw_text, "Base resume.docx", "docx", base_docx)

    assert structured is not None
    assert structured.parse_confidence.overall_confidence == 1.0

    # Verify experience section has 6 entries with 5 bullets each
    exp = next((s for s in structured.sections if s.section_type == "experience"), None)
    assert exp is not None
    entries = exp.content.get("entries", [])
    assert len(entries) == 6
    for job in entries:
        assert len(job.get("bullets", [])) == 5

    # Verify projects section
    proj = next((s for s in structured.sections if s.section_type == "projects"), None)
    assert proj is not None
    assert len(proj.content.get("entries", [])) == 8

    # Verify education section
    edu = next((s for s in structured.sections if s.section_type == "education"), None)
    assert edu is not None
    edu_entries = edu.content.get("entries", [])
    assert len(edu_entries) == 2
    assert all(isinstance(e, dict) for e in edu_entries)
