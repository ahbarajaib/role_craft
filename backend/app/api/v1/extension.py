import io
import os
import zipfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from app.dependencies.auth import get_current_user, get_optional_current_user
from app.models import User
from app.core.extension_config import (
    EXTENSION_FEATURE_DIRS,
    EXTENSION_FEATURE_LABELS,
    EXTENSION_ZIP_FOLDER_NAMES,
    get_accessible_features,
    has_any_feature_access,
)

router = APIRouter(prefix="/extension", tags=["extension"])

# ── Extension root resolution ─────────────────────────────────────────────────

def get_project_root() -> Path:
    """Resolve the project root — works in dev, Docker, and VPS deployments."""
    candidate_roots = [
        # Dev: walk up from this file (backend/app/api/v1/extension.py → project root)
        Path(__file__).resolve().parents[4],
        Path(__file__).resolve().parents[3],
        # Docker: project mounted at /app
        Path("/app"),
        Path("/opt/role_craft"),
    ]
    for root in candidate_roots:
        # Validate by checking for at least one known extension folder
        if any((root / folder).exists() for folder in EXTENSION_FEATURE_DIRS.values()):
            return root
    # Fallback: return grandparent of this file
    return Path(__file__).resolve().parents[4]


def get_extension_dir(feature_key: str) -> Path:
    """Return the source directory Path for the given extension feature."""
    folder_name = EXTENSION_FEATURE_DIRS.get(feature_key)
    if not folder_name:
        raise ValueError(f"Unknown extension feature: {feature_key!r}")

    project_root = get_project_root()
    return project_root / folder_name


# ── ZIP builder ───────────────────────────────────────────────────────────────

def build_extension_zip(features: dict[str, bool]) -> io.BytesIO:
    """
    Builds a ZIP containing only the extension sub-folders the user's plan
    is allowed to access (features with value True).

    Each sub-folder is nested under its own named directory inside the ZIP
    so users can unzip and load each independently.

    Example ZIP structure (Elite user):
        rolecraft-linkedin-copier/
            manifest.json
            content.js
            styles.css
            icons/
        rolecraft-indeed-copier/
            manifest.json
            content.js
            styles.css
            icons/
    """
    accessible = [key for key, allowed in features.items() if allowed]
    if not accessible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your current plan does not include access to any RoleCraft browser extensions.",
        )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for feature_key in accessible:
            ext_dir = get_extension_dir(feature_key)
            zip_folder = EXTENSION_ZIP_FOLDER_NAMES.get(feature_key, feature_key)

            if not ext_dir.exists() or not (ext_dir / "manifest.json").exists():
                # Log and skip missing feature rather than hard-failing the whole download
                continue

            for root, dirs, files in os.walk(ext_dir):
                # Skip hidden directories (e.g. .git)
                dirs[:] = [d for d in dirs if not d.startswith(".")]
                for file in files:
                    if file.startswith(".") or file.endswith(".tmp"):
                        continue
                    file_path = Path(root) / file
                    arcname = file_path.relative_to(ext_dir)
                    zf.write(file_path, arcname=f"{zip_folder}/{arcname}")

    zip_buffer.seek(0)
    return zip_buffer


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
def get_extension_status(user: User | None = Depends(get_optional_current_user)):
    """
    Returns per-feature extension access flags for the current user.

    Response shape:
    {
        "authenticated": bool,
        "plan_type": str,
        "features": {
            "linkedin": bool,
            "indeed": bool
        },
        "feature_labels": {
            "linkedin": "LinkedIn 1-Click Job Copier",
            "indeed": "Indeed Job Title Copier"
        },
        "version": "2.0.0"
    }
    """
    if not user:
        return {
            "authenticated": False,
            "plan_type": "guest",
            "features": {key: False for key in EXTENSION_FEATURE_DIRS},
            "feature_labels": EXTENSION_FEATURE_LABELS,
            "version": "2.0.0",
        }

    features = get_accessible_features(user.plan_type, user.subscription_status)
    return {
        "authenticated": True,
        "plan_type": user.plan_type,
        "features": features,
        "feature_labels": EXTENSION_FEATURE_LABELS,
        "version": "2.0.0",
    }


@router.get("/download")
def download_extension(user: User = Depends(get_current_user)):
    """
    Downloads a ZIP containing all extension bundles the user's plan unlocks.

    - Pro users receive: rolecraft-linkedin-copier/
    - Elite users receive: rolecraft-linkedin-copier/ + rolecraft-indeed-copier/

    The gate is driven entirely by EXTENSION_FEATURE_GATES in extension_config.py —
    changing a plan assignment there is sufficient, no code change required here.
    """
    features = get_accessible_features(user.plan_type, user.subscription_status)

    if not any(features.values()):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "RoleCraft Browser Extensions are exclusive to Pro and Elite members. "
                "Please upgrade your subscription to access them."
            ),
        )

    zip_buffer = build_extension_zip(features)

    # Dynamic filename based on what's included
    accessible = [EXTENSION_ZIP_FOLDER_NAMES[k] for k, v in features.items() if v]
    filename = "RoleCraft-Browser-Extensions.zip" if len(accessible) > 1 else f"{accessible[0]}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
