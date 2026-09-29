# LinkedIn Job Copier — Chrome Extension

A Chrome Extension (Manifest V3) that adds a **"Copy Job Details"** button to LinkedIn job pages. One click copies the job title, company, location, URL, and full description to your clipboard.

## Features

- **One-click copy** — Extracts and copies all job details in a clean format
- **Smart extraction** — Multi-strategy fallback system resilient to LinkedIn DOM changes
- **SPA-aware** — Detects navigation between jobs without page reloads
- **Auto-expands** — Clicks "Show more" / "See more" before extracting
- **Clean output** — Strips LinkedIn UI text, preserves paragraphs and bullet points
- **Visual feedback** — Button shows extracting/success/error states
- **Minimal permissions** — Only `clipboardWrite` and `activeTab`

## Installation

### 1. Download the Extension

Clone or download this folder (`linkedin-job-copier/`) to your computer.

### 2. Open Chrome Extensions

1. Open Chrome
2. Navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)

### 3. Load the Extension

1. Click **"Load unpacked"**
2. Select the `linkedin-job-copier` folder
3. The extension should appear in your extensions list

### 4. Verify Installation

- Look for "LinkedIn Job Copier" in your extensions list
- Navigate to any LinkedIn job page (e.g., `https://www.linkedin.com/jobs/view/...`)
- You should see a blue **"Copy Job Details"** button

## Usage

1. Navigate to any LinkedIn job page
2. Click the **"Copy Job Details"** button
3. The button will show:
   - **"Extracting..."** — while collecting job data
   - **"Copied!"** — when successfully copied to clipboard
   - **"Extraction Failed"** — if something went wrong
4. Paste the copied content anywhere (Ctrl+V / Cmd+V)

### Clipboard Output Format

```
JOB TITLE:
Backend Engineer (Node.js / AWS / AI Systems)

COMPANY:
Prismforce

LOCATION:
Bengaluru, Karnataka, India

JOB URL:
https://www.linkedin.com/jobs/view/...

JOB DESCRIPTION:
Position: Backend Engineer (SDE-1 / Emerging SDE-2)
Experience: ~3 Years
...
```

## How to Test

### Basic Tests

1. **Direct job URL**: Go to `https://www.linkedin.com/jobs/view/XXXXXXXXX`
   - Button should appear
   - Click → verify clipboard content

2. **Job search**: Go to LinkedIn Jobs search, click on different jobs
   - Button should persist across job switches
   - No duplicate buttons should appear

3. **Page refresh**: Reload a job page
   - Button should re-appear

4. **Collapsed descriptions**: Find a job with "Show more" on the description
   - The extension should auto-expand it before copying

### Console Debugging

Open Chrome DevTools (F12) → Console tab and filter for `[LinkedIn Job Copier]`:

```
[LinkedIn Job Copier] Initializing...
[LinkedIn Job Copier] Job page detected, injecting button
[LinkedIn Job Copier] Job detail panel found via: .scaffold-layout__detail
[LinkedIn Job Copier] Button injected near action bar via: ...
[LinkedIn Job Copier] Copy button clicked
[LinkedIn Job Copier] Clicking "Show more" button
[LinkedIn Job Copier] Title extracted via strategy 1: "Backend Engineer"
[LinkedIn Job Copier] Company extracted via strategy 1: "Prismforce"
[LinkedIn Job Copier] Location extracted via strategy 2: "Bengaluru, Karnataka, India"
[LinkedIn Job Copier] Description extracted via strategy 1, length: 2345
[LinkedIn Job Copier] Copy successful!
```

## Extraction Fallback System

The extension **never relies on a single CSS selector**. Each field uses a ranked list of extraction strategies:

### Title Extraction (6 strategies)
1. `h1` inside the job detail panel (most reliable — LinkedIn uses h1 for titles)
2. Known top-card heading selectors (`[class*="top-card"] h1`)
3. Link matching the current job ID (`a[href*="/jobs/view/ID"]`)
4. Class-based selectors (`[class*="job-title"]`, `.t-24`, etc.)
5. First prominent heading in the panel (h1/h2/h3)
6. Global `h1` fallback for direct job URL pages

### Company Extraction (5 strategies)
1. Links to company pages (`a[href*="/company/"]`)
2. Known company-name class selectors
3. Structural: element near title with a company link
4. Subtitle text splitting (company · location format)
5. Global fallback with top-card scoping

### Location Extraction (4 strategies)
1. Known location/bullet class selectors
2. Subtitle text parsing (split by `·` separators)
3. Proximity scan near company info
4. Heuristic scan using location pattern matching (city/state/country patterns)

### Description Extraction (5 strategies)
1. `.show-more-less-html__markup` (very common LinkedIn class)
2. `#job-details` element
3. Known description container classes
4. `article` element within panel
5. Largest text block heuristic (finds the biggest meaningful text block)

### Why This Approach?

LinkedIn changes its DOM frequently. Class names like `jobs-unified-top-card__job-title` may be renamed, obfuscated, or restructured at any time. By using multiple strategies ordered from most-specific to most-generic, the extension gracefully degrades:

- If the primary selector breaks → the second one catches it
- If all class-based selectors break → structural/semantic fallbacks still work
- The `h1` tag, `a[href*="/company/"]` links, and `#job-details` are among the most stable anchors

## Architecture

```
content.js (single file, IIFE)
├── Logger (log, warn, error)
├── Job Page Detection (isJobPage)
├── Panel Locator (getJobDetailPanel)
├── Extractors
│   ├── extractTitle (6 strategies)
│   ├── extractCompany (5 strategies)
│   ├── extractLocation (4 strategies)
│   ├── extractDescription (5 strategies)
│   └── extractURL
├── Show More Expansion (expandShowMore)
├── Validation (validateJobDetails)
├── Formatting (formatForClipboard)
├── Clipboard (copyToClipboard)
├── Button Management
│   ├── injectButton / removeButton
│   ├── createButton
│   ├── injectIntoActionBar
│   └── setButtonState
├── Click Handler (handleCopyClick)
├── SPA Navigation Detection
│   ├── URL polling (1s interval)
│   ├── History API interception
│   └── MutationObserver
└── Init
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Button doesn't appear | Check chrome://extensions — is the extension enabled? The button only appears inside an active job's action bar when a job posting is selected. |
| "Extraction Failed" | Open DevTools console, look for `[LinkedIn Job Copier]` logs to see which field failed. LinkedIn may have changed its DOM. |
| Wrong data extracted | The panel locator may be picking up the wrong section. Check the console to see which selector was used. |
| Duplicate buttons | This shouldn't happen (there's a duplicate check), but if it does, refresh the page. |
| Button position | The extension injects directly into the job action bar alongside Apply and Save; it strictly never floats over the page. |

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration (Manifest V3) |
| `content.js` | All extraction logic, button injection, SPA detection |
| `styles.css` | Button styling with state-based appearances |
| `README.md` | This documentation |

## Permissions

| Permission | Why |
|-----------|-----|
| `clipboardWrite` | Write extracted job details to clipboard |
| `activeTab` | Access the active tab's content |

No background service worker, no remote connections, no data collection.

## License

Personal use.
