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
