from app.parsers.job_description_parser import parse_job_description

LINKEDIN_PASTED_TEXT = """
Company logo for, FurtherAI.
FurtherAI


Senior Software Engineer - Backend/Fullstack [India]

Bengaluru, Karnataka, India · Reposted 2 weeks ago · Over 100 people clicked apply

Promoted by hirer · Responses managed off LinkedIn

50 INR/yr - 100 INR/yr
Remote
Full-time
Apply

Save
Your profile and resume match the required qualifications well

Show match details

BETA • Is this information helpful?

People you can reach out to
Meet the hiring team

Divya Kaushik

Message
About the job
Role Details

Location: India.

About Us

At FurtherAI, we’re building the next generation of AI agents for the insurance industry.

What You’ll Do

Build and scale the core product, ensuring performance, reliability, and continuous improvement.
Own significant portions of the backend stack in Python.
Collaborate directly with founders to set the technical direction.

What We’re Looking For

5+ years building products.
Strong experience with backend systems (Python preferred).
Clear communicator - both in person and in writing.

Compensation Range: ₹50 - ₹100
"""

def test_parse_linkedin_furtherai():
    jd = parse_job_description(LINKEDIN_PASTED_TEXT)
    assert jd.title == "Senior Software Engineer - Backend/Fullstack [India]"
    assert jd.company == "FurtherAI"
    assert "Python" in jd.technologies
    assert len(jd.responsibilities) > 0
    assert len(jd.required_skills) > 0


def test_parse_standardized_multiline_job_details():
    text = """JOB TITLE:
Software Engineer – AI Product Engineering

COMPANY:
CirrusLabs

LOCATION:
Bengaluru, Karnataka

JOB TYPE:
Hybrid

JOB DESCRIPTION:
Job Title : Software Engineer – AI Product Engineering

Experience : 3 years

Job Location : Bangalore

Key Responsibilities

Design, develop, and maintain scalable web applications using the MERN stack.

Build and integrate AI/LLM-powered features and products.
"""
    jd = parse_job_description(text)
    assert jd.title == "Software Engineer – AI Product Engineering"
    assert jd.company == "CirrusLabs"
    assert jd.location == "Bengaluru, Karnataka"
    assert jd.employment_type == "Hybrid"
    assert len(jd.responsibilities) == 2


def test_parse_linkedin_ai_fit_banner_skips_and_extracts_real_role():
    user_paste = """JOB TITLE:
Use AI to assess how you fit

COMPANY:
ScaleDevX

LOCATION:
Mumbai

JOB TYPE:
Hybrid

JOB DESCRIPTION:
About The Role

We’re looking for a Senior Frontend Developer to build high-quality, scalable web applications. You’ll work closely with design and backend teams to craft intuitive, performance-driven user experiences used at scale.

What You’ll Do

• Build responsive, accessible UIs using React & TypeScript
• Collaborate with designers for pixel-perfect implementations
• Architect and maintain scalable frontend systems
• Optimize applications for speed and performance
• Implement automated testing and quality checks
• Review code and mentor junior developers
• Drive frontend best practices and standards

Required Skills

• 5+ years of frontend development experience
• Strong expertise in React, TypeScript & ES6+
• State management (Redux, Zustand, etc.)
• CSS frameworks (Tailwind, Styled Components)
• REST APIs & GraphQL integration
• Modern build tools (Vite, Webpack, Rollup)
• Testing frameworks (Jest, RTL, Cypress)
• Cross-browser & responsive design expertise

Preferred Skills

• Next.js or similar React frameworks
• Design systems & component libraries
• CI/CD pipeline experience
• Basic backend knowledge (Node.js / Python)
• Advanced performance optimization
• Accessibility standards (WCAG)

What We Offer

• Competitive salary & equity
• Remote-first & flexible work culture
• Health insurance for family
• Learning & development budget
• Modern tech stack & tools
• Work on high-impact products
• Annual team retreats & events

Ready to Join Us?

If you love crafting world-class frontend experiences and want to lead from the front, we’d love to hear from you.

Benefits found in job post

Medical insurance
"""
    jd = parse_job_description(user_paste)
    assert jd.title == "Senior Frontend Developer"
    assert jd.company == "ScaleDevX"
    assert jd.location == "Mumbai"
    assert jd.employment_type == "Hybrid"
    assert "React" in jd.technologies
    assert "TypeScript" in jd.technologies
    assert len(jd.responsibilities) >= 5
    assert len(jd.required_skills) >= 5


def test_parse_linkedin_raw_paste_with_ai_fit_heading():
    raw_text = """Company logo for ScaleDevX
ScaleDevX
Use AI to assess how you fit
Senior Frontend Developer
Mumbai, Maharashtra, India · Hybrid
About the job
We are seeking a Senior Frontend Developer to lead UI engineering.
Key Responsibilities
- Architect scalable frontend systems with React and TypeScript
"""
    jd = parse_job_description(raw_text)
    assert jd.title == "Senior Frontend Developer"
    assert jd.company == "ScaleDevX"
    assert jd.location == "Mumbai, Maharashtra, India · Hybrid" or "Mumbai" in jd.location


