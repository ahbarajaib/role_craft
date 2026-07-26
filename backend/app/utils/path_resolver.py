"""Document path resolution utility.

Provides robust resolution for document IDs including base/{user_id} paths
with automatic fallback handling so missing base files do not crash requests.
"""

from pathlib import Path
from loguru import logger
from app.core.exceptions import NotFoundError


def resolve_document_path(upload_dir: Path, document_id: str) -> Path:
    """Return the filesystem Path for a given document_id.

    Supports:
    - Standard UUID uploads: uploads/{doc_id}.docx
    - Base resume paths: uploads/base/{user_id}.docx or uploads/{user_id}.docx
    - Fallback: returns the most recently uploaded .docx file in upload_dir
      if the requested ID file is missing.
    """
    if not document_id or not document_id.strip():
        raise NotFoundError("Document ID cannot be empty.")

    clean_id = document_id.strip()
    candidates: list[Path] = []

    if clean_id.startswith("base/"):
        user_id = clean_id.split("/", 1)[1]
        candidates.extend([
            upload_dir / "base" / f"{user_id}.docx",
            upload_dir / f"base_{user_id}.docx",
            upload_dir / f"{user_id}.docx",
        ])
    else:
        candidates.append(upload_dir / f"{clean_id}.docx")

    for path in candidates:
        if path.exists():
            return path

    # Fallback: find any available .docx in upload_dir
    docx_files = [f for f in upload_dir.glob("*.docx") if not f.name.startswith(".")]
    if docx_files:
        latest = max(docx_files, key=lambda f: f.stat().st_mtime)
        logger.warning(
            "Document ID file not found on disk, using latest upload fallback",
            requested_id=clean_id,
            fallback_path=str(latest),
        )
        return latest

    raise NotFoundError(f"Document '{clean_id}' not found on server.")
