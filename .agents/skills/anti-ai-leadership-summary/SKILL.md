---
name: anti-ai-leadership-summary
description: Generates grounded, authentic, anti-AI professional summaries for resumes, specifically handling transitions from Senior Individual Contributor (IC) to Team Lead, Technical Lead, and Technical Project Manager (TPM) roles while strictly locking verified years of experience.
---

# Anti-AI Leadership & Project Manager Summary Framework

## Purpose
This skill defines the standards, prompt templates, and guardrails for generating **human-sounding, grounded professional summaries** for software engineers transitioning into **Team Lead**, **Tech Lead**, and **Technical Project Manager (TPM)** roles without sounding like generic ChatGPT output or fabricating unearned claims.

---

## 1. The Anti-AI Negative Vocabulary Rule
Generic AI resume summaries are instantly recognizable to recruiters and hiring managers due to repetitive buzzwords and empty adjectives. 

### 🚫 Strictly Banned AI Buzzwords & Clichés
The following words and patterns must **NEVER** appear in professional summaries:
* **"Results-driven"** / **"Outcome-oriented"** / **"Goal-oriented"**
* **"Passionate"** / **"Enthusiastic"** / **"Dedicated professional"**
* **"Proven track record"** / **"Demonstrated history of success"**
* **"Proven ability"** / **"Demonstrates expertise"** / **"Demonstrated expertise"**
* **"Seasoned"** / **"Accomplished"** (used as standalone fluff adjectives)
* **"Spearheaded"** (overused AI verb; use *built*, *led*, *designed*, *delivered*)
* **"Leveraged"** / **"Utilized"** (use *built with*, *implemented*, *using*)
* **"Dynamic"** / **"Fast-paced environment"**
* **"Adept at"** / **"Skilled in navigating"**
* **"Synergistic"** / **"Cross-functional paradigms"** / **"Cross-functional to deliver"**
* **"Transformative"** / **"Drive digital transformation"** / **"Driving digital transformation"**
* **"Orchestrating excellence"** / **"Testament to"**
* **"Align with business objectives"** / **"Enhancing operational efficiency"**

---

## 2. Authentic Engineering Voice Formula
A compelling, human resume summary is **compact (2 to 4 sentences, 50-85 words)**, grounded in the candidate's real stack components, and highlights verified technical scope.

### The 3-Sentence Structure:
1. **Sentence 1: Identity & Verified Years & Core Stack**
   - Verified candidate opening + exact years of experience + primary languages/technologies.
   - *Example:* "Senior Full Stack Developer with 7+ years of experience building scalable web and mobile applications in React Native, Node.js, and TypeScript."
2. **Sentence 2: Concrete System & Delivery Scope**
   - Tangible scope of work without empty buzzwords.
   - *Example:* "Hands-on background architecting modular frontends, RESTful backend APIs, and reliable database schemas."
3. **Sentence 3: Leadership or Agile Delivery Posture**
   - Concrete ownership: system architecture, code review standards, mentoring engineers, sprint planning, and delivery.
   - *Example:* "Brings technical ownership across system architecture, developer code reviews, and reliable agile delivery cycles."

---

## 3. Leadership & Technical Project Manager (TPM) Exception Framework

When software developers with 7+ years of experience seek **Team Lead** or **Technical Project Manager (TPM)** positions, rigid ATS matching can hurt their chances if the headline does not reflect their target function.

### The Leadership & TPM Customization Exception:
* **Allowed Opening Customization**:
  When targeting **Team Lead**, **Tech Lead**, or **Technical Project Manager** roles (or when the corresponding role positioning preset is chosen), the professional summary opening **MAY be customized** to position the candidate directly in that leadership or delivery role:
  - *Team Lead Target:* `"Team Lead / Senior Software Engineer with 7+ years of experience in full-stack web and mobile systems..."` or `"Engineering Team Lead with 7+ years of experience..."`
  - *Technical Project Manager Target:* `"Technical Project Manager with 7+ years of software engineering and agile delivery experience, translating technical architecture into roadmap planning and sprint execution..."`
  - *Tech Lead Target:* `"Hands-on Technical Lead with 7+ years of experience combining deep software engineering with system architecture and engineering standards..."`

### 🔒 Non-Negotiable Guardrails (Absolute Truth Preservation):
1. **NEVER INFLATE YEARS OF EXPERIENCE**:
   - The candidate's verified years of experience (e.g. `7+ years`) must remain **100% locked and verbatim**.
   - If a target job description requires 10 years, **NEVER change 7 to 10**. Fabricating 10 years is an explicit lie and disqualifies the candidate in background checks.
2. **NEVER FABRICATE UNVERIFIED DOMAIN CLOUDS / TECHNOLOGIES**:
   - If candidate background is Full Stack / Mobile / WordPress, do NOT invent "Microsoft AI Services", "Azure", or "Machine Learning Specialist" simply because the JD mentioned it.
   - Ground strictly in verified technologies (e.g., React Native, Node.js, TypeScript, PostgreSQL, WordPress, Agile delivery).
3. **STANDARD DEVELOPER ROLES RETAIN DEVELOPER IDENTITY**:
   - For regular developer roles (e.g., Senior Full Stack Developer, Frontend Engineer), retain their verified developer identity without unrequested title mutations.

---

## 4. Positioning Modes Reference

| Mode | Preset Label | Key Focus & Opening Pattern |
| :--- | :--- | :--- |
| `team_lead_transition` | **Step Up to Team Lead** | Senior IC foundation + technical ownership: architecture, code reviews, mentoring junior engineers, sprint execution. Opening customized as Team Lead / Senior Developer with verified 7+ years. |
| `hands_on_tech_lead` | **Hands-on Tech Lead** | Dual-track excellence: deep hands-on coding craftsmanship paired with technical direction, system architecture, and engineering standards with verified 7+ years. |
| `tech_project_manager` | **Technical Project Manager** | Engineering background positioned for Agile/Scrum delivery: sprint planning, backlog grooming, risk mitigation, and cross-functional stakeholder communication with verified 7+ years. |
| `senior_ic` | **Senior IC (Specialist)** | Pure technical craftsmanship, resilient system architecture, and complex implementation without management emphasis. Preserves verified 7+ years verbatim. |
| `default` | **Target Job Match** | Truthful alignment with target job description; preserves verified years and actual background without unearned titles or missing technologies. |

---

## 5. Verification Checklist
When reviewing or generating a summary:
- [ ] Are all technologies mentioned present in the candidate's verified resume evidence?
- [ ] Are years of experience preserved verbatim (e.g., 7 is NEVER altered to 10)?
- [ ] If applying for Team Lead / TPM, is the opening customized truthfully for leadership/delivery without claiming unearned technical domains?
- [ ] Are all banned AI buzzwords absent (no "results-driven", "passionate", "proven ability", "demonstrates expertise")?
- [ ] Does it read like an experienced engineer or technical delivery lead speaking directly to a hiring manager?
- [ ] Is the summary between 50 and 85 words (2 to 4 sentences max)?
