# Resume AI

# Goal

Build a production-grade AI-powered Resume Optimization platform.

The application should allow a user to:

- Upload a DOCX resume
- Paste or upload a job description
- Analyze the resume against the job description
- Identify high-impact improvements
- Generate AI suggestions for only the relevant sections
- Allow the user to accept or reject each suggestion
- Produce an updated DOCX while preserving formatting.

The application should never invent experience, companies, dates, projects, certifications, or technical skills.

The user must always remain in control of every modification.

It also includes the capability to search for real jobs and score them against an uploaded resume (ATS scoring) using AI.

---

## Long-Term Vision

The resume optimizer is the first feature of a larger document transformation platform.

Future document types may include:

- Cover letters
- Proposals
- Statements of Purpose
- Contracts
- Reports

The system should therefore separate document content from presentation.

---

## Primary Objectives

- Learn modern Python backend engineering.
- Learn production FastAPI.
- Learn AI application architecture.
- Learn clean architecture.
- Learn asynchronous programming.
- Learn document parsing.
- Learn Docker.
- Learn PostgreSQL.
- Learn Redis.
- Learn background workers.
- Learn production deployment.

---

## Non-Goals

Do not optimize for speed of development.

Do not generate large monolithic files.

Do not use unnecessary abstractions.

Do not over-engineer early milestones.

---

# Success Criteria

The application should:

- Preserve document formatting.
- Understand resume structure.
- Understand job descriptions.
- Identify gaps between resumes and jobs.
- Explain every recommendation.
- Generate targeted AI improvements.
- Allow selective approval of changes.
- Patch only approved sections back into the DOCX.
- Be deployable on a VPS.
- Analyze resumes against job descriptions.
- Explain why recommendations are made.
- Prioritize recommendations by expected impact.
- Never rewrite content without explicit user approval.