# Naukri 1-Click Job Copier — Chrome Extension

A RoleCraft companion Chrome Extension (Manifest V3) that adds a **"Copy Job Details"** button directly to Naukri.com job postings. One click copies complete job details (Job Title, Company, Location, Experience, Salary, Key Skills, Job URL, and Full Job Description) to your clipboard, formatted for instant ATS optimization in RoleCraft.

> **Plan Requirement:** Elite subscribers only.  
> Download via [rolecraft.tech](https://rolecraft.tech) → Workspace → Browser Extensions panel.

---

## Features

- **1-Click Complete Extraction** — Copies Job Title, Company, Location, Experience, Salary, Key Skills, Canonical URL, and clean Job Description formatted for RoleCraft
- **In-Flow Action Bar Placement** — Injects cleanly into the Naukri job header actions area alongside Apply & Save buttons; strictly never floats over the viewport
- **JSON-LD Schema + Resilient DOM Multi-Strategy** — Leverages schema.org `JobPosting` data with robust DOM fallbacks across dynamic class name updates
- **SPA & Dynamic Watcher** — MutationObserver + History API interception detects job switching without page reloads
- **Visual Feedback** — Button states for ready, extracting, success (Copied!), and error
- **Zero Telemetry** — Runs entirely locally in browser, zero external network calls

---

## Installation

### 1. Download

Download the extension from RoleCraft (Elite plan required):  
`rolecraft.tech → Workspace → Browser Extensions → Download Extension (.zip)`

### 2. Open Chrome Extensions

1. Open Google Chrome
2. Navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right corner)

### 3. Load the Extension

1. Click **"Load unpacked"**
2. Select the `RoleCraft-Naukri-1-Click-Job-Copier` folder (extracted from the downloaded ZIP)
3. The extension appears in your extensions list

---

## Usage

1. Go to any Naukri job posting (e.g. `https://www.naukri.com/job-listings-...`)
2. In the top job header area, click the **"Copy Job Details"** button
3. Return to RoleCraft and paste directly into the Target Job Description input

### Button States

| State | Color | Meaning |
|-------|-------|---------|
| Ready | Naukri Navy (`#18558a`) | Ready to copy |
| Extracting... | Amber (`#d97706`) | Extracting details |
| Copied! | Green (`#057642`) | Formatted details copied to clipboard |
| Failed — Retry | Red (`#dc2626`) | Click again to retry |

---

## Clipboard Format

The extracted text is formatted identically to RoleCraft's ATS specification:

```
JOB TITLE:
Senior Software Engineer

COMPANY:
Tech Corp India

LOCATION:
Bengaluru, Karnataka

JOB DETAILS:
Experience: 3-6 Yrs | Salary: ₹15-25 Lacs PA | Key Skills: React, Node.js, TypeScript

JOB URL:
https://www.naukri.com/job-listings-senior-software-engineer-123456

JOB DESCRIPTION:
[Cleaned job description without boilerplate UI lines]
```

---

## Privacy & Security

- **Permissions:** `clipboardWrite` (to copy formatted job text) and `activeTab` (to read the active job page DOM)
- **Local Only:** Zero telemetry, no external API requests, no tracking
- **In-Flow UI:** Placed exclusively inside the job details card, with no floating or intrusive elements
