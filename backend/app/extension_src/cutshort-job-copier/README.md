# RoleCraft — Cutshort 1-Click Job Copier

A Chrome extension (Manifest V3) that extracts complete job details from **Cutshort.io** job postings and copies them to your clipboard in a structured format optimised for [RoleCraft ATS](https://rolecraft.io).

## What Gets Copied

When you click **Copy Job Details** on any Cutshort job posting, the extension captures:

| Field | Source |
|---|---|
| **Job Title** | JSON-LD schema → OG meta title → h1 heading |
| **Company** | JSON-LD schema → OG meta → company link |
| **Location** | JSON-LD schema → DOM → OG description |
| **Experience** | JSON-LD schema → DOM → text scan |
| **Salary / CTC** | JSON-LD schema → DOM → text scan |
| **Work Type** | JSON-LD schema (employmentType / jobLocationType) → DOM |
| **Skills** | JSON-LD schema → skill pills/chips/tags in DOM |
| **Job Description** | JSON-LD schema → semantic DOM blocks |
| **Job URL** | Canonical link → OG URL → cleaned window.location |

## Supported URLs

The extension activates on:
- `https://cutshort.io/job/<slug>` — individual job detail pages
- `https://cutshort.io/company/<slug>/jobs/<slug>` — company job pages
- Other Cutshort job variants

It does **not** inject anything on search/listing pages, company homepages, or other non-job pages.

## Extraction Strategy

Cutshort is a Next.js SPA with styled-components (hashed classnames). The extension uses a multi-tier strategy to remain resilient to UI updates:

1. **JSON-LD `JobPosting` schema** (most reliable — structured data)
2. **OpenGraph / meta tags** (fallback for title, company, description)
3. **Semantic DOM selectors** (structural HTML: h1, links to /company/, skill chips)
4. **Heuristic text scan** (last resort for salary, experience, work type)

## Installation

> **Requires Elite plan on RoleCraft.** Download via the Extensions modal in the app.

1. Download the `RoleCraft-Cutshort-1-Click-Job-Copier.zip` from RoleCraft
2. Extract the ZIP — you'll find a single folder inside
3. Open Chrome → `chrome://extensions` → enable **Developer mode**
4. Click **Load unpacked** and select the extracted folder
5. Navigate to any Cutshort job and click **Copy Job Details**

## Clipboard Output Format

```
JOB TITLE:
Senior Software Engineer

COMPANY:
Acme Corp

LOCATION:
Bangalore, India

JOB TYPE:
Full-time

JOB DESCRIPTION:
About the role:
We are looking for a talented Senior Software Engineer...
```

## Plan Requirements

| Platform | Plan |
|---|---|
| LinkedIn | Pro & Elite |
| Indeed | Elite |
| Naukri | Elite |
| **Cutshort** | **Elite** |
