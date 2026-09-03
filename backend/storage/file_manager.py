"""File storage for uploaded images and videos.

Files are stored under ``{UPLOAD_DIR}/{job_id}/``.  Filenames are sanitized
to prevent path-traversal and de-duplicated on collision.
"""

from __future__ import annotations

import io
import logging
import re
import uuid
from pathlib import Path
from typing import Literal

from PIL import Image

from backend.core.config import settings
from backend.core.exceptions import ValidationError
from backend.models.job_models import FileMeta

logger = logging.getLogger(__name__)

_SAFE_FILENAME_RE = re.compile(r"[^\w.\-]")

MIN_IMAGE_EDGE = 256


# ── Helpers ──────────────────────────────────────────────────────────────────

def _sanitize_filename(name: str) -> str:
    """Strip path components and replace unsafe characters."""
    # Take only the basename (no directory traversal)
    name = Path(name).name
    # Replace unsafe chars with underscores
    name = _SAFE_FILENAME_RE.sub("_", name)
    return name or "upload"


def _unique_filename(directory: Path, name: str) -> str:
    """Return *name* if it doesn't collide; otherwise append a short suffix."""
    if not (directory / name).exists():
        return name
    stem = Path(name).stem
    suffix = Path(name).suffix
    return f"{stem}_{uuid.uuid4().hex[:8]}{suffix}"


# ── Public API ───────────────────────────────────────────────────────────────

def job_dir(job_id: str) -> Path:
    """Return the directory for *job_id* under UPLOAD_DIR."""
    return Path(settings.UPLOAD_DIR) / job_id


def save_upload(
    job_id: str,
    original_filename: str,
    data: bytes,
    kind: Literal["image", "video"],
) -> FileMeta:
    """Persist *data* to disk and return a :class:`FileMeta`.

    Raises :class:`ValidationError` when the file is empty, too large,
    has a disallowed extension, or (for images) cannot be decoded / is
    smaller than 256 px on either edge.
    """
    if not data:
        raise ValidationError(f"Empty file: {original_filename}")

    size_mb = len(data) / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_MB:
        raise ValidationError(
            f"File {original_filename} is {size_mb:.1f} MB; "
            f"limit is {settings.MAX_UPLOAD_MB} MB"
        )

    safe_name = _sanitize_filename(original_filename)
    ext = Path(safe_name).suffix.lstrip(".").lower()

    width: int | None = None
    height: int | None = None

    if kind == "image":
        if ext not in settings.ALLOWED_IMAGE_TYPES:
            raise ValidationError(
                f"Image type '.{ext}' not allowed. "
                f"Accepted: {', '.join(settings.ALLOWED_IMAGE_TYPES)}"
            )
        # Validate with Pillow
        try:
            img = Image.open(io.BytesIO(data))
            img.verify()  # checks integrity
            # Re-open after verify (verify can leave the file in a bad state)
            img = Image.open(io.BytesIO(data))
            width, height = img.size
        except Exception as exc:
            raise ValidationError(
                f"Cannot read image {original_filename}: {exc}"
            ) from exc

        if width < MIN_IMAGE_EDGE or height < MIN_IMAGE_EDGE:
            raise ValidationError(
                f"Image {original_filename} is {width}×{height}; "
                f"both edges must be at least {MIN_IMAGE_EDGE} px"
            )

    elif kind == "video":
        if ext not in settings.ALLOWED_VIDEO_TYPES:
            raise ValidationError(
                f"Video type '.{ext}' not allowed. "
                f"Accepted: {', '.join(settings.ALLOWED_VIDEO_TYPES)}"
            )

    # Write to disk
    dest = job_dir(job_id)
    dest.mkdir(parents=True, exist_ok=True)
    stored_name = _unique_filename(dest, safe_name)
    file_path = dest / stored_name
    file_path.write_bytes(data)

    logger.info("Saved %s (%d bytes) -> %s", original_filename, len(data), file_path)

    return FileMeta(
        filename=original_filename,
        stored_path=str(file_path),
        kind=kind,
        bytes=len(data),
        width=width,
        height=height,
    )


def list_job_files(job_id: str) -> list[Path]:
    """List all files in the job directory (excluding job.json)."""
    d = job_dir(job_id)
    if not d.is_dir():
        return []
    return [p for p in d.iterdir() if p.is_file() and p.name != "job.json"]
