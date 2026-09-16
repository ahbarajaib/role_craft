"""
Extension Feature Gates — Single Source of Truth
=================================================
Maps each extension feature key to the list of plan_type strings that can access it.

To add a new platform:   add a new key here + add the folder under /rolecraft-<platform>-copier/
To open Indeed to Pro:   change "indeed": ["elite"] → ["pro", "elite"]
To gate LinkedIn Elite:  change "linkedin": ["pro", "elite"] → ["elite"]

The backend reads this at request time — no redeploy needed for plan changes,
just update the value here and restart the server.
"""

# Feature key → list of plan_type values that have access
EXTENSION_FEATURE_GATES: dict[str, list[str]] = {
    # LinkedIn: Full job details (title, company, location, description, URL)
    "linkedin": ["pro", "elite"],

    # Indeed: Job title copy button on viewjob pages
    "indeed": ["elite"],

    # Future example — uncomment and add folder when ready:
    # "glassdoor": ["elite"],
    # "naukri": ["elite"],
}

# Human-readable labels for each feature (used in API responses & frontend)
EXTENSION_FEATURE_LABELS: dict[str, str] = {
    "linkedin": "LinkedIn 1-Click Job Copier",
    "indeed": "Indeed 1-Click Job Copier",
}

# Folder name inside the project root for each feature's extension source
EXTENSION_FEATURE_DIRS: dict[str, str] = {
    "linkedin": "linkedin-job-copier",
    "indeed": "indeed-job-copier",
}

# Folder name used inside the downloaded ZIP for each feature
EXTENSION_ZIP_FOLDER_NAMES: dict[str, str] = {
    "linkedin": "RoleCraft-LinkedIn-1-Click-Job-Copier",
    "indeed": "RoleCraft-Indeed-1-Click-Job-Copier",
}


def get_accessible_features(plan_type: str | None, subscription_status: str | None = None) -> dict[str, bool]:
    """
    Returns a dict of {feature_key: bool} indicating which extension
    features the given plan can access.

    Args:
        plan_type: The user's plan_type string (e.g. "free", "pro", "elite")
        subscription_status: Optional subscription_status (e.g. "active") for
                             legacy subscription-based access.
    """
    plan = (plan_type or "free").lower()

    # Legacy: active subscription without explicit plan upgrade → treat as pro
    if subscription_status == "active" and plan == "free":
        plan = "pro"

    return {
        feature: plan in allowed_plans
        for feature, allowed_plans in EXTENSION_FEATURE_GATES.items()
    }


def has_any_feature_access(plan_type: str | None, subscription_status: str | None = None) -> bool:
    """Returns True if the user can access at least one extension feature."""
    return any(get_accessible_features(plan_type, subscription_status).values())
