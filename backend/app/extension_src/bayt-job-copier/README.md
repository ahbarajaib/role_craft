# Bayt 1-Click Job Copier — Chrome Extension

A companion Chrome Extension (Manifest V3) that adds a **"Copy Job Details"** button to Bayt.com job postings (including `bayt.com/en/...`, `bayt.com/ar/...`, and all regional GCC domains). One click copies complete job details (Title, Company, Location, Job Type, Full Description, and Clean URL) to your clipboard, formatted for instant ATS optimization in RoleCraft.

## Features

- **1-Click Copy**: Copies job title, company name, location, job type, and clean description formatted for RoleCraft.
- **Full Content Capture**: Copies all rich details inside the Bayt job card (`#job_card`), including roles, responsibilities, requirements, and preferred candidate details, while filtering out clutter (interactive menus, share/print buttons, report links).
- **Dual Placement**: Automatically injects beside the Bayt Apply button or header action bar, with a guaranteed floating button fallback if in-flow placement is blocked.
- **Dynamic SPA Support**: Automatically updates when navigating between jobs on search result pages.
- **Modern Clipboard API**: Uses `navigator.clipboard.writeText` with an automatic `execCommand` fallback.

## Installation (Developer Mode)

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the `bayt-job-copier` folder.
5. The **RoleCraft — Bayt 1-Click Job Copier** extension will appear in your installed extensions list.

## Usage

1. Open any job posting on [Bayt.com](https://www.bayt.com).
2. Look for the blue **"Copy Job Details"** button beside the Apply button or at the bottom-right corner.
3. Click it — the button will show **"Copied!"** in green.
4. Paste directly into RoleCraft.
