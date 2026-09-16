# Indeed 1-Click Job Copier — Chrome Extension

A RoleCraft companion Chrome Extension (Manifest V3) that adds a **"Copy Job Details"** button to Indeed job pages worldwide (including `in.indeed.com`, `www.indeed.com`, and all country subdomains). One click copies complete job details (Title, Company, Location, Metadata, Job URL, and Full Job Description) to your clipboard, formatted for instant ATS optimization in RoleCraft.

> **Plan Requirement:** Elite subscribers only.  
> Download via [rolecraft.tech](https://rolecraft.tech) → Workspace → Browser Extensions panel.

---

## Features

- **1-Click Job Details Copy** — Copies Job Title, Company, Location, Metadata, Job URL, and full Job Description formatted for RoleCraft
- **Full Global & Regional Support** — Works seamlessly across all Indeed domains (`in.indeed.com`, `www.indeed.com`, `uk.indeed.com`, etc.)
- **Split-View & Direct Page Support** — Injects cleanly on search results pages (`/jobs?q=...&vjk=...`) and direct posting pages (`/viewjob`)
- **Resilient Multi-Strategy Fallback** — Extracts structured data even across Indeed DOM updates
- **SPA & Dynamic Watcher** — MutationObserver + History API interception detects job switching without page reloads
- **Visual Feedback** — Button states for ready, extracting, success (Copied!), and error
- **Zero Telemetry** — Runs entirely locally in browser, zero external network calls

---

## Installation

### 1. Download

Download the extension from RoleCraft (Elite plan required):  
`rolecraft.tech → Workspace → Browser Extensions → Download Extension`

### 2. Open Chrome Extensions

1. Open Google Chrome
2. Navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right corner)

### 3. Load the Extension

1. Click **"Load unpacked"**
2. Select the `RoleCraft-Indeed-1-Click-Job-Copier` folder (inside the downloaded ZIP)
3. The extension appears in your extensions list

---

## Usage

1. Go to any Indeed page (e.g. `https://in.indeed.com/jobs?q=software+engineer` or `https://in.indeed.com/viewjob?jk=...`)
2. Select any job
3. Click the blue **"Copy Job Details"** button
4. Return to RoleCraft and click **"Paste Clipboard"** on the Target Job Description card

### Button States

| State | Color | Meaning |
|-------|-------|---------|
| Ready | Indeed blue | Ready to copy |
| Extracting... | Amber | Extracting details |
| Copied! | Green | Formatted details copied to clipboard |
| Failed — Retry | Red | Click again to retry |

---

## Copied Clipboard Format

```
JOB TITLE:
Senior Software Engineer

COMPANY:
Infosys

LOCATION:
Bengaluru, Karnataka

JOB DETAILS:
Full-time · ₹18,00,000 - ₹24,00,000 a year

JOB URL:
https://in.indeed.com/viewjob?jk=abcdef1234567890

JOB DESCRIPTION:
About the Role:
• Lead technical architecture and development
• 5+ years experience in TypeScript, React, and Python
...
```

---

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config (Manifest V3, global Indeed matches) |
| `content.js` | All extraction, DOM injection, and SPA watcher logic |
| `styles.css` | Button styling with state-based appearance |
| `icons/` | Extension icons (16px, 48px, 128px) |
| `README.md` | This document |

---

## License

Personal use. Part of the RoleCraft platform (rolecraft.tech).
