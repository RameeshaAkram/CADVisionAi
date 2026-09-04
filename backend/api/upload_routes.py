"""Upload & job management routes.

POST /api/jobs                       — create a job (multipart/form-data)
GET  /api/jobs/{job_id}              — retrieve job status
POST /api/jobs/{job_id}/files        — append images to a photo job
GET  /api/jobs/{job_id}/files/{filename} — stream a stored upload
"""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse

from backend.core.config import settings
from backend.core.exceptions import JobNotFoundError, ValidationError
from backend.models.job_models import (
    FileMeta,
    JobMode,
    JobStatus,
    KnownDimension,
    UnitType,
)
from backend.models.schemas import FilePublic, JobPublic, KnownDimensionSchema
from backend.storage import file_manager, job_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["jobs"])

VALID_MODES = {m.value for m in JobMode}
VALID_UNITS = {u.value for u in UnitType}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _job_to_public(job) -> JobPublic:
    """Convert internal Job to the public response schema (no stored_path)."""
    return JobPublic(
        job_id=job.job_id,
        mode=job.mode.value,
        status=job.status.value,
        current_stage=job.current_stage,
        progress=job.progress,
        stages=[
            {"name": s.name, "status": s.status.value, "detail": s.detail}
            for s in job.stages
        ],
        units=job.units.value,
        thickness=job.thickness,
        known_dimensions=[
            KnownDimensionSchema(label=d.label, value=d.value)
            for d in job.known_dimensions
        ],
        file_count=len(job.files),
        normalized_count=len(job.normalized_images),
        files=[
            FilePublic(
                filename=f.filename,
                kind=f.kind,
                bytes=f.bytes,
                width=f.width,
                height=f.height,
            )
            for f in job.files
        ],
        warnings=job.warnings,
        error=job.error,
        can_add_files=job.status.value in ("uploaded", "needs_more_views", "completed", "failed"),
        coverage_score=job.result.get("coverage", {}).get("score", 0.0) if job.result else 0.0,
        coverage_gaps=job.result.get("coverage", {}).get("gaps", []) if job.result else [],
        assembly=job.result.get("assembly") if job.result else None
    )


def _classify_file(filename: str) -> Literal["image", "unknown"]:
    """Classify a file as image or unknown by extension."""
    ext = Path(filename).suffix.lstrip(".").lower()
    if ext in settings.ALLOWED_IMAGE_TYPES:
        return "image"
    return "unknown"


def _parse_known_dimensions(raw: str) -> list[KnownDimension]:
    """Parse and validate the known_dimensions JSON string."""
    try:
        items = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        raise ValidationError(f"known_dimensions must be valid JSON: {exc}") from exc

    if not isinstance(items, list) or len(items) == 0:
        raise ValidationError("At least one known dimension is required")

    dims: list[KnownDimension] = []
    for item in items:
        if not isinstance(item, dict):
            raise ValidationError("Each dimension must be an object with 'label' and 'value'")
        label = item.get("label", "")
        value = item.get("value")
        if not label or value is None:
            raise ValidationError("Each dimension must have a non-empty 'label' and a numeric 'value'")
        try:
            value = float(value)
        except (TypeError, ValueError) as exc:
            raise ValidationError(f"Dimension value must be a number: {exc}") from exc
        if value <= 0:
            raise ValidationError(f"Dimension value must be > 0, got {value}")
        dims.append(KnownDimension(label=label, value=value))
    return dims


async def _read_and_save_files(
    job_id: str,
    files: list[UploadFile],
    expected_kind: Literal["image"],
) -> tuple[list[FileMeta], list[str]]:
    """Validate, read, and save uploaded files.  Returns (file_metas, warnings)."""
    metas: list[FileMeta] = []
    warnings: list[str] = []

    for uf in files:
        kind = _classify_file(uf.filename or "unknown")

        if kind == "unknown":
            raise ValidationError(
                f"File type not allowed: {uf.filename}"
            )

        data = await uf.read()
        meta = file_manager.save_upload(job_id, uf.filename or "upload", data, kind)
        metas.append(meta)

    # Warning for photo mode with < 3 images
    if expected_kind == "image" and len(metas) < 3:
        warnings.append(
            "Fewer than 3 views; reconstruction quality will likely be low. "
            "You can add more photos."
        )

    return metas, warnings


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/jobs", response_model=JobPublic, status_code=201)
async def create_job(
    mode: str = Form(...),
    units: str = Form(...),
    known_dimensions: str = Form(...),
    thickness: float = Form(1.0, gt=0),
    files: list[UploadFile] = File(...),
):
    """Create a new job by uploading photos or a video."""

    # Validate mode
    if mode not in VALID_MODES:
        raise ValidationError(f"mode must be one of {sorted(VALID_MODES)}")

    # Validate units
    if units not in VALID_UNITS:
        raise ValidationError(f"units must be one of {sorted(VALID_UNITS)}")

    # Parse dimensions
    dims = _parse_known_dimensions(known_dimensions)

    # Validate file count
    if not files:
        raise ValidationError("At least one file is required")

    job_mode = JobMode(mode)



    # Pre-generate job_id so files are saved into uploads/{job_id}/
    job_id = uuid.uuid4().hex
    expected_kind: Literal["image", "video"] = "image"
    metas, warnings = await _read_and_save_files(job_id, files, expected_kind)

    job = job_manager.create_job(
        mode=job_mode,
        units=UnitType(units),
        known_dimensions=dims,
        thickness=thickness,
        files_meta=metas,
        warnings=warnings,
        job_id=job_id,
    )
    return _job_to_public(job)


@router.get("/jobs/{job_id}", response_model=JobPublic)
async def get_job(job_id: str):
    """Retrieve job details."""
    job = job_manager.get_job(job_id)
    return _job_to_public(job)


@router.post("/jobs/{job_id}/files", response_model=JobPublic, status_code=201)
async def add_files(
    job_id: str,
    files: list[UploadFile] = File(...),
):
    """Append image files to an existing job."""
    job = job_manager.get_job(job_id)

    allowed_statuses = {
        JobStatus.UPLOADED, 
        JobStatus.NEEDS_MORE_VIEWS, 
        JobStatus.COMPLETED, 
        JobStatus.FAILED
    }
    
    if job.status not in allowed_statuses:
        if job.status == JobStatus.PROCESSING:
            raise ValidationError("Job is still processing.", status_code=409)
        raise ValidationError(f"Cannot add files to job in '{job.status.value}' status")
        
    if not files:
        raise ValidationError("At least one file is required")

    metas, new_warnings = await _read_and_save_files(job_id, files, "image")
    job = job_manager.add_files(job_id, metas)

    # Update warnings: remove "fewer than 3" if total is now >= 3
    all_warnings = list(job.warnings)
    # Actually wait, let's just let view_analyzer handle warnings in the next run.
    if len(job.files) >= 3:
        all_warnings = [w for w in all_warnings if isinstance(w, str) and "Fewer than 3 views" not in w]
    else:
        for w in new_warnings:
            if w not in all_warnings:
                all_warnings.append(w)
    if all_warnings != job.warnings:
        job = job_manager.update_job(job_id, warnings=all_warnings)

    return _job_to_public(job)


@router.get("/jobs/{job_id}/files/{filename}")
async def get_file(job_id: str, filename: str):
    """Stream a stored upload file."""
    job = job_manager.get_job(job_id)

    match = next((f for f in job.files if f.filename == filename), None)
    if match is None:
        raise JobNotFoundError(f"File '{filename}' not found in job '{job_id}'")

    stored = Path(match.stored_path)
    if not stored.is_file():
        raise JobNotFoundError(f"File '{filename}' not found on disk")

    return FileResponse(stored, filename=match.filename)
