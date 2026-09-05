import io
import os
import zipfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, JSONResponse
from app.dependencies.auth import get_current_user, get_optional_current_user
from app.models import User

router = APIRouter(prefix="/extension", tags=["extension"])

# Find the extension directory relative to the project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
EXTENSION_DIR = PROJECT_ROOT / "linkedin-job-copier"


def is_user_pro_or_elite(user: User) -> bool:
    """Check if the user is on Pro or Elite plan or has an active subscription."""
    if not user:
        return False
    plan = (user.plan_type or "").lower()
    return plan in ["pro", "elite"] or user.subscription_status == "active"


def build_extension_zip() -> io.BytesIO:
    """Builds a ZIP archive in memory containing all necessary extension files."""
    if not EXTENSION_DIR.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Extension source files not found on server.",
        )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(EXTENSION_DIR):
            for file in files:
                # Exclude hidden files or git files if any
                if file.startswith(".") or file.endswith(".tmp"):
                    continue
                file_path = Path(root) / file
                arcname = file_path.relative_to(EXTENSION_DIR)
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
