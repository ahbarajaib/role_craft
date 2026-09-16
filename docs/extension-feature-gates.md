# Extension Feature Gates

## Overview

All browser extension access is controlled by a **single config dict** in:

```
backend/app/core/extension_config.py
```

This is the **only file** you need to edit to change which plan can access which extension. No code changes to endpoints, no frontend deploys required.

---

## The Config Dict

```python
EXTENSION_FEATURE_GATES: dict[str, list[str]] = {
    "linkedin": ["pro", "elite"],
    "indeed":   ["elite"],
}
```

Each key is a **feature identifier**. The value is the list of `plan_type` strings that have access.

### Current Access Matrix

| Feature | Free | Pro | Elite |
|---------|------|-----|-------|
| LinkedIn 1-Click Job Copier | ❌ | ✅ | ✅ |
| Indeed Job Title Copier | ❌ | ❌ | ✅ |

---

## Making Plan Changes (Examples)

### Open Indeed to Pro as well
```python
"indeed": ["pro", "elite"],   # was: ["elite"]
```

### Gate LinkedIn to Elite only
```python
"linkedin": ["elite"],         # was: ["pro", "elite"]
```

### Add a new platform (e.g. Glassdoor)
```python
# 1. Add the gate:
"glassdoor": ["elite"],

# 2. Add the labels, dirs, and zip names:
EXTENSION_FEATURE_LABELS["glassdoor"] = "Glassdoor Job Copier"
EXTENSION_FEATURE_DIRS["glassdoor"] = "glassdoor-job-copier"
EXTENSION_ZIP_FOLDER_NAMES["glassdoor"] = "rolecraft-glassdoor-copier"

# 3. Create the extension folder at /glassdoor-job-copier/
# 4. Restart the server — done.
```

---

## How the System Works End-to-End

```
EXTENSION_FEATURE_GATES
        │
        ├── GET /api/v1/extension/status
        │     Returns { features: { linkedin: bool, indeed: bool } }
        │     Frontend reads this to show lock/unlock state per card
        │
        └── GET /api/v1/extension/download
              Calls get_accessible_features(user.plan_type)
              Builds a ZIP containing only the folders the user's plan allows
              Pro user ZIP: rolecraft-linkedin-copier/
              Elite user ZIP: rolecraft-linkedin-copier/ + rolecraft-indeed-copier/
```

---

## Extension Folder Structure

```
/project-root/
├── linkedin-job-copier/       ← LinkedIn extension source
│   ├── manifest.json
│   ├── content.js
│   ├── styles.css
│   ├── icons/
│   └── README.md
│
├── indeed-job-copier/         ← Indeed extension source
│   ├── manifest.json
│   ├── content.js
│   ├── styles.css
│   ├── icons/
│   └── README.md
│
└── backend/
    └── app/
        └── core/
            └── extension_config.py   ← THE SINGLE SOURCE OF TRUTH
```

---

## Key Functions

| Function | Purpose |
|----------|---------|
| `get_accessible_features(plan_type, subscription_status)` | Returns `{feature: bool}` dict for a user |
| `has_any_feature_access(plan_type, subscription_status)` | Returns `True` if user can access at least 1 feature |

---

## Notes

- The `subscription_status = "active"` fallback treats legacy active subscribers as Pro-level automatically.
- Adding a new platform requires: (1) entry in EXTENSION_FEATURE_GATES, (2) entries in the 3 supporting dicts, (3) the extension folder, (4) server restart. No endpoint code changes required.
- The frontend `ExtensionModal` reads `plan_type` from the user context to derive feature eligibility using the same logic — no backend call needed for UI gating.
