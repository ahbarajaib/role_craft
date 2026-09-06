import io
import os
import zipfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, JSONResponse
from app.dependencies.auth import get_current_user, get_optional_current_user
from app.models import User

router = APIRouter(prefix="/extension", tags=["extension"])

def get_extension_dir() -> Path:
    """Find the extension directory from known bundle/project locations."""
    candidate_dirs = [
        # 1. Bundled inside backend/app/extension_src
        Path(__file__).resolve().parent.parent.parent / "extension_src",
        # 2. Mounted into container at /app/linkedin-job-copier
        Path("/app/linkedin-job-copier"),
        # 3. Development root locations
        Path(__file__).resolve().parents[4] / "linkedin-job-copier",
        Path(__file__).resolve().parents[3] / "linkedin-job-copier",
        Path("/opt/role_craft/linkedin-job-copier"),
    ]
    for p in candidate_dirs:
        if p.exists() and (p / "manifest.json").exists():
            return p
    return candidate_dirs[0]


def is_user_pro_or_elite(user: User) -> bool:
    """Check if the user is on Pro or Elite plan or has an active subscription."""
    if not user:
        return False
    plan = (user.plan_type or "").lower()
    return plan in ["pro", "elite"] or user.subscription_status == "active"


def build_extension_zip() -> io.BytesIO:
    """Builds a ZIP archive in memory containing all necessary extension files."""
    ext_dir = get_extension_dir()
    if not ext_dir.exists() or not (ext_dir / "manifest.json").exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extension source files not found on server (checked {ext_dir}).",
        )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(ext_dir):
            for file in files:
                # Exclude hidden files or git files if any
                if file.startswith(".") or file.endswith(".tmp"):
                    continue
                file_path = Path(root) / file
                arcname = file_path.relative_to(ext_dir)
                # Nest inside folder rolecraft-linkedin-copier/ inside the zip for clean extraction
                zf.write(file_path, arcname=f"rolecraft-linkedin-copier/{arcname}")

    zip_buffer.seek(0)
    return zip_buffer


@router.get("/status")
def get_extension_status(user: User | None = Depends(get_optional_current_user)):
    """Returns access eligibility status for the current user."""
    if not user:
        return {
            "authenticated": False,
            "eligible": False,
            "plan_type": "guest",
            "version": "1.0.0",
        }

    eligible = is_user_pro_or_elite(user)
    return {
        "authenticated": True,
        "eligible": eligible,
        "plan_type": user.plan_type,
        "version": "1.0.0",
    }


@router.get("/download")
def download_extension(user: User = Depends(get_current_user)):
    """Downloads the RoleCraft LinkedIn Chrome Extension bundle (.zip).
    
    Protected route: Only available to Pro and Elite members.
    """
    if not is_user_pro_or_elite(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The LinkedIn Chrome Extension is exclusive to Pro and Elite members. Please upgrade your subscription to access it.",
        )

    zip_buffer = build_extension_zip()
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="rolecraft-linkedin-copier.zip"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
