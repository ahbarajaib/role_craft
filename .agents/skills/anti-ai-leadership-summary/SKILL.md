---
name: anti-ai-leadership-summary
description: Generates grounded, authentic, anti-AI professional summaries for resumes, specifically handling transitions from Senior Individual Contributor (IC) to Team Lead / Technical Lead roles.
---

# Anti-AI Leadership Summary Framework

## Purpose
This skill defines the standards, prompt templates, and negative constraints for generating **human-sounding, grounded professional summaries** for software engineering and technical roles. It specifically addresses candidates stepping into **Team Lead**, **Tech Lead**, or **Engineering Leadership** roles without sounding like generic ChatGPT output.

---

## 1. The Anti-AI Negative Vocabulary Rule
Generic AI resume summaries are instantly recognizable to recruiters and engineering managers due to repetitive buzzwords and empty adjectives. 

### 🚫 Strictly Banned AI Buzzwords & Clichés
The following words and patterns must **NEVER** appear in professional summaries:
* **"Results-driven"** / **"Outcome-oriented"** / **"Goal-oriented"**
* **"Passionate"** / **"Enthusiastic"** / **"Dedicated professional"**
* **"Proven track record"** / **"Demonstrated history of success"**
* **"Seasoned"** / **"Accomplished"** (used as standalone fluff adjectives)
* **"Spearheaded"** (overused AI verb; use *built*, *led*, *designed*, *delivered*)
* **"Leveraged"** / **"Utilized"** (use *built with*, *implemented*, *using*)
* **"Dynamic"** / **"Fast-paced environment"**
* **"Adept at"** / **"Skilled in navigating"**
* **"Synergistic"** / **"Cross-functional paradigms"**
* **"Transformative"** / **"Driving digital transformation"**
* **"Orchestrating excellence"** / **"Testament to"**

---

## 2. Authentic Engineering Voice Formula
A compelling, human resume summary is **compact (2 to 4 sentences)**, grounded in real stack components, and highlights verified technical scope.

### The 3-Sentence Structure:
1. **Sentence 1: Identity & Years & Core Stack**
   - Candidate's primary title + verified years of experience + primary languages/technologies.
   - *Example:* "Senior Full Stack Developer with 7+ years of experience building distributed cloud services and web platforms in Python, TypeScript, and React."
2. **Sentence 2: Concrete System & Architectural Scope**
   - Tangible scope of work without empty buzzwords.
   - *Example:* "Hands-on background designing event-driven microservices, high-throughput REST APIs, and database performance optimizations on AWS."
3. **Sentence 3: Leadership & Delivery Posture (Targeted to the Role)**
   - Concrete leadership responsibilities: architecture ownership, code review standards, mentoring junior engineers, and reliable sprint delivery.
   - *Example:* "Positioning for Lead Full Stack roles with demonstrated technical ownership across system architecture, engineering review standards, developer mentorship, and sprint delivery."

---

## 3. Leadership Transition Framework ("Stepping Up to Lead")
Candidates frequently apply for **Lead Software Developer** or **Team Lead** positions while their past titles were *Senior Software Engineer* or *Senior Full Stack Developer*.

### Rules for Honest & Powerful Positioning:
1. **Never Falsify Past Formal Titles**:
   - If the candidate was a Senior Developer, do NOT rename past roles to "Engineering Director" or "Team Lead".
2. **Bridge Past Lead Responsibilities to the Target Role**:
   - Senior engineers routinely perform leadership tasks before getting the official title:
     - *Conducting architectural design reviews*
     - *Establishing code quality and PR review standards*
     - *Mentoring and onboarding junior/mid-level engineers*
     - *Owning sprint delivery, task breakdown, and technical unblocking*
     - *Bridging communication with product managers and stakeholders*
3. **Standard Lead Transition Pattern**:
   > *"Senior Full Stack Developer with 7+ years building scalable web services, positioning for Lead Full Stack roles. Brings hands-on technical ownership across system architecture, code review standards, developer mentoring, and reliable sprint delivery. Stays grounded in TypeScript, Python, and cloud infrastructure while unblocking engineering teams to ship high-impact features on schedule."*

---

## 4. Positioning Modes Reference

| Mode | Target Role | Key Emphasis |
| :--- | :--- | :--- |
| `team_lead_transition` | Stepping Up to Team Lead | Senior IC foundation + technical ownership, code reviews, mentoring, sprint delivery. |
| `hands_on_tech_lead` | Hands-On Tech Lead | Dual-track: deep hands-on coding + technical direction, architecture, and engineering execution. |
| `senior_ic` | Senior Individual Contributor | Deep individual technical craftsmanship, system design, low-level optimizations without team lead framing. |
| `default` | Standard Target Job Match | Clean, anti-AI alignment tailored directly to the specific job description requirements. |

---

## 5. Verification Checklist
When reviewing or generating a summary:
- [ ] Are all technologies mentioned present in candidate's verified resume?
- [ ] Are years of experience preserved verbatim (e.g. "7+ years")?
- [ ] Are all banned AI buzzwords absent?
- [ ] Does it read like an experienced software engineer speaking to a hiring manager?
- [ ] Is it between 40 and 90 words (3-4 sentences max)?
