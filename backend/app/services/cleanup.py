"""File cleanup utility service.

Scans upload directories and automatically removes old uploads and generated files.
"""

import time
from pathlib import Path

from loguru import logger


def cleanup_old_files(upload_dir: Path, max_age_hours: int) -> None:
    """Scan and delete docx files in upload_dir and uploads/generated older than max_age_hours."""
    logger.debug("Starting file cleanup check", upload_dir=str(upload_dir), max_age_hours=max_age_hours)
    try:
        now = time.time()
        max_age_seconds = max_age_hours * 3600

        # Cleanup uploaded files (.docx files in upload_dir)
        if upload_dir.exists():
            for f in upload_dir.iterdir():
                if f.is_file() and f.suffix == ".docx":
                    file_age = now - f.stat().st_mtime
                    if file_age > max_age_seconds:
                        try:
                            f.unlink()
                            logger.info(
                                "Cleaned up old uploaded file",
                                path=str(f),
                                age_seconds=round(file_age),
                            )
                        except Exception as unlink_err:
                            logger.warning("Could not delete file", path=str(f), error=str(unlink_err))

        # Cleanup generated patched files (.docx files in upload_dir/generated)
        generated_dir = upload_dir / "generated"
        if generated_dir.exists():
            for f in generated_dir.iterdir():
                if f.is_file() and f.suffix == ".docx":
                    file_age = now - f.stat().st_mtime
                    if file_age > max_age_seconds:
                        try:
                            f.unlink()
                            logger.info(
                                "Cleaned up old generated patched file",
                                path=str(f),
                                age_seconds=round(file_age),
                            )
                        except Exception as unlink_err:
                            logger.warning("Could not delete file", path=str(f), error=str(unlink_err))
    except Exception as e:
        logger.error(f"Error during file cleanup operation: {e}")
