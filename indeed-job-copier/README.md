# Indeed Job Title Copier — Chrome Extension

A RoleCraft companion Chrome Extension (Manifest V3) that adds a **"Copy Job Title"** button to Indeed job pages. One click copies the job title to your clipboard, ready to paste into RoleCraft.

> **Plan Requirement:** Elite subscribers only.  
> Download via [rolecraft.tech](https://rolecraft.tech) → Workspace → Chrome Extension panel.

---

## Features

- **1-click job title copy** — Extracts the title and copies to clipboard instantly
- **5-strategy fallback** — Resilient to Indeed DOM changes (data-testid → h1 → page title → og:title)
- **SPA-aware** — Detects navigation between jobs without page reloads
- **Visual feedback** — Button shows extracting / success / error states
- **Minimal permissions** — Only `clipboardWrite` and `activeTab`
- **Zero telemetry** — No network calls, no data collection

---

## Installation

### 1. Download

Download the extension from RoleCraft (Elite plan required):  
`rolecraft.tech → Workspace → Chrome Extension → Download Extension`

### 2. Open Chrome Extensions

1. Open Chrome
2. Navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)

### 3. Load the Extension

1. Click **"Load unpacked"**
2. Select the `rolecraft-indeed-copier` folder (inside the downloaded ZIP)
3. The extension appears in your extensions list

---

## Usage

1. Go to any Indeed job page (e.g. `https://www.indeed.com/viewjob?jk=...`)
2. Click the blue **"Copy Job Title"** button
3. Paste into RoleCraft's Job Description field (or anywhere)

### Button States

| State | Color | Meaning |
|-------|-------|---------|
| Ready | Indeed blue | Ready to copy |
| Extracting... | Amber | Extracting title |
| Copied! | Green | Title in clipboard |
| Failed — Retry | Red | Click again to retry |

---

## Extraction Strategy (Ranked Fallbacks)

Indeed's DOM is more stable than LinkedIn's. Title extraction uses 5 strategies:

1. **`data-testid="jobsearch-JobInfoHeader-title"`** — Indeed's own stable test ID (most reliable)
2. **Known class selectors** — `.jobsearch-JobInfoHeader-title`, `h1[class*="jobTitle"]`, etc.
3. **First `<h1>` on page** — Indeed job pages have exactly one meaningful h1
4. **Browser `<title>` parsing** — Format: `"Job Title - Company - Location | Indeed.com"` → takes first segment
5. **`og:title` meta tag** — Format: `"Job Title at Company | Indeed.com"` → strips suffix

---

## Supported URL Patterns

| Pattern | Example |
|---------|---------|
| `viewjob` | `indeed.com/viewjob?jk=abc123` |
| `jobs/view` | `indeed.com/jobs/view/abc123` |
| `rc/clk` | `indeed.com/rc/clk?jk=abc123` (redirect URLs) |

---

## Architecture

```
content.js (IIFE)
├── Logger (log, warn, logError)
├── Page Detection (isIndeedJobPage)
├── Title Extractor (extractJobTitle — 5 strategies)
├── Clipboard (copyToClipboard — Clipboard API + execCommand fallback)
├── Button Icons (getCopyIcon, getCheckIcon, getErrorIcon)
├── Button State (setButtonState)
├── Click Handler (handleCopyClick)
├── Button Management
│   ├── createButton
│   ├── injectButton (3-strategy injection + floating fallback)
│   └── removeButton
├── SPA Navigation Detection
│   ├── URL polling (1s interval)
│   ├── History API interception
│   └── popstate listener
└── Init
```

---

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config (Manifest V3) |
| `content.js` | All extraction + button injection logic |
| `styles.css` | Button styling with state-based appearance |
| `icons/` | Extension icons (16px, 48px, 128px) |
| `README.md` | This document |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Button doesn't appear | Reload the Indeed job page. Check `chrome://extensions` → is it enabled? |
| "Failed — Retry" | Click again. Open DevTools → Console → filter `[RoleCraft Indeed Copier]` for debug logs. |
| Wrong title copied | Indeed may have updated their DOM. Check which strategy is logged in DevTools. |

---

## License

Personal use. Part of the RoleCraft platform (rolecraft.tech).
