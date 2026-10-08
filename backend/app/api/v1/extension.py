import io
import logging
import os
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.extension_config import (
    EXTENSION_FEATURE_DIRS,
    EXTENSION_FEATURE_GATES,
    EXTENSION_FEATURE_LABELS,
    EXTENSION_ZIP_FOLDER_NAMES,
    get_accessible_features,
)
from app.dependencies.auth import get_current_user, get_optional_current_user
from app.models import User

router = APIRouter(prefix="/extension", tags=["extension"])

logger = logging.getLogger(__name__)


# ── Extension root resolution ─────────────────────────────────────────────────

def get_extension_dir(feature_key: str) -> Path:
    """
    Resolve the source directory for the given extension feature.

    Resolution order (first hit wins):
    1. Bundled path: backend/app/extension_src/<feature_key>/
       → Always present in Docker (Dockerfile copies app/ → /app/app/)
    2. Project-root path: <project_root>/<feature_folder>/
       → Works in local dev where the repo root is accessible
    """
    folder_name = EXTENSION_FEATURE_DIRS.get(feature_key)
    if not folder_name:
        raise ValueError(f"Unknown extension feature: {feature_key!r}")

    # 1. Bundled inside the backend package (Docker-safe)
    #    extension.py is at: backend/app/api/v1/extension.py
    #    extension_src is at: backend/app/extension_src/
    bundled = Path(__file__).resolve().parents[2] / "extension_src" / folder_name
    if bundled.exists() and (bundled / "manifest.json").exists():
        return bundled

    # 2. Project-root fallback (local dev)
    candidate_roots = [
        Path(__file__).resolve().parents[4],  # project root in dev
        Path(__file__).resolve().parents[3],
        Path("/app"),
        Path("/opt/role_craft"),
    ]
    for root in candidate_roots:
        candidate = root / folder_name
        if candidate.exists() and (candidate / "manifest.json").exists():
            return candidate

    # Return the bundled path even if not found — build_extension_zip will
    # log a warning and skip it gracefully.
    return bundled


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
                # Warn loudly so operators can spot misconfigured paths in logs
                logger.warning(
                    "Extension directory missing or invalid for feature %r — skipping. "
                    "Expected path: %s",
                    feature_key, ext_dir
                )
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
            "indeed": "Indeed 1-Click Job Copier"
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
def download_extension(
    feature: str | None = Query(None, description="Specific extension feature to download ('linkedin', 'indeed', 'naukri', or 'cutshort')"),
    user: User = Depends(get_current_user),
):
    """
    Downloads a ZIP containing the requested extension bundle.

    If ?feature=linkedin:
        - Checks access to 'linkedin' (Pro or Elite)
        - Returns RoleCraft-LinkedIn-1-Click-Job-Copier.zip containing only LinkedIn extension files

    If ?feature=indeed:
        - Checks access to 'indeed' (Elite)
        - Returns RoleCraft-Indeed-1-Click-Job-Copier.zip containing only Indeed extension files

    If ?feature=naukri:
        - Checks access to 'naukri' (Elite)
        - Returns RoleCraft-Naukri-1-Click-Job-Copier.zip containing only Naukri extension files

    If ?feature=cutshort:
        - Checks access to 'cutshort' (Elite)
        - Returns RoleCraft-Cutshort-1-Click-Job-Copier.zip containing only Cutshort extension files

    If no feature query parameter is provided:
        - Downloads all features the user's plan unlocks (single ZIP if 1, combined if multiple)
    """
    features = get_accessible_features(user.plan_type, user.subscription_status)

    if feature:
        feature_key = feature.lower().strip()
        if feature_key not in EXTENSION_FEATURE_DIRS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown extension feature '{feature}'. Available features: {list(EXTENSION_FEATURE_DIRS.keys())}",
            )

        if not features.get(feature_key):
            feature_label = EXTENSION_FEATURE_LABELS.get(feature_key, feature_key)
            required_plans = EXTENSION_FEATURE_GATES.get(feature_key, ["elite"])
            plan_str = " or ".join(p.capitalize() for p in required_plans)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"The {feature_label} requires an active {plan_str} plan. Please upgrade to download it.",
            )

        # Build ZIP containing ONLY this specific extension
        zip_buffer = build_extension_zip({feature_key: True})
        folder_name = EXTENSION_ZIP_FOLDER_NAMES.get(feature_key, feature_key)
        filename = f"{folder_name}.zip"

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )

    # Fallback: if no specific feature is requested
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
