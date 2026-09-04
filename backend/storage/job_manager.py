"""Job lifecycle management — create, read, update.

Each job is persisted as ``{UPLOAD_DIR}/{job_id}/job.json`` and also held in
an in-memory cache for fast lookups.  No database is used.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any

from backend.core.config import settings
from backend.core.exceptions import JobNotFoundError
from backend.models.job_models import (
    FileMeta,
    Job,
    JobMode,
    JobStatus,
    KnownDimension,
    UnitType,
)

logger = logging.getLogger(__name__)

# In-memory cache: job_id → Job
_jobs: dict[str, Job] = {}


def _persist(job: Job) -> None:
    """Write job to disk and update cache."""
    _jobs[job.job_id] = job
    job.save(settings.UPLOAD_DIR)


# ── Public API ───────────────────────────────────────────────────────────────

def create_job(
    mode: JobMode,
    units: UnitType,
    known_dimensions: list[KnownDimension],
    files_meta: list[FileMeta],
    thickness: float = 1.0,
    warnings: list[str] | None = None,
    job_id: str | None = None,
) -> Job:
    """Create a new job with status ``uploaded``."""
    job_id = job_id or uuid.uuid4().hex
    job = Job(
        job_id=job_id,
        mode=mode,
        status=JobStatus.UPLOADED,
        units=units,
        known_dimensions=known_dimensions,
        thickness=thickness,
        files=files_meta,
        warnings=warnings or [],
    )
    _persist(job)
    logger.info("Created job %s (mode=%s, files=%d)", job_id, mode, len(files_meta))
    return job



def get_job(job_id: str) -> Job:
    """Return the job or raise :class:`JobNotFoundError`."""
    # Try cache first
    if job_id in _jobs:
        return _jobs[job_id]

    # Fall back to disk
    job_json = Path(settings.UPLOAD_DIR) / job_id / "job.json"
    if job_json.is_file():
        job = Job.load(job_json)
        _jobs[job_id] = job
        return job

    raise JobNotFoundError(f"Job '{job_id}' not found")


def update_job(job_id: str, **fields: Any) -> Job:
    """Patch *fields* on an existing job and persist."""
    job = get_job(job_id)
    updated = job.model_copy(update=fields)
    _persist(updated)
    logger.info("Updated job %s: %s", job_id, list(fields.keys()))
    return updated


def add_files(job_id: str, files_meta: list[FileMeta]) -> Job:
    """Append *files_meta* to an existing job's file list."""
    job = get_job(job_id)
    new_files = job.files + files_meta
    return update_job(job_id, files=new_files)


def clear_cache() -> None:
    """Clear the in-memory job cache (useful in tests)."""
    _jobs.clear()


def list_jobs(limit: int = 50, status: str | None = None) -> list[Job]:
    """Scan disk for jobs, filter optionally by status, sort newest first."""
    jobs_list = []
    base_dir = Path(settings.UPLOAD_DIR)
    
    if base_dir.exists():
        for job_dir in base_dir.iterdir():
            if not job_dir.is_dir():
                continue
            job_json = job_dir / "job.json"
            if job_json.is_file():
                try:
                    job = Job.load(job_json)
                    if status and job.status.value != status:
                        continue
                    jobs_list.append(job)
                except Exception as e:
                    logger.warning("Skipping corrupted job %s: %s", job_dir.name, e)
                    
    # Sort newest first based on created_at
    jobs_list.sort(key=lambda j: j.created_at, reverse=True)
    return jobs_list[:limit]


def cleanup_zombie_jobs() -> None:
    """Mark stuck PROCESSING jobs as failed if heartbeat is too old (e.g. > 2 min)."""
    from datetime import datetime, timezone
    
    jobs = list_jobs(limit=1000, status="processing")
    now = datetime.now(timezone.utc)
    
    for job in jobs:
        try:
            updated = datetime.fromisoformat(job.updated_at)
            # If older than 120 seconds, it's a zombie
            if (now - updated).total_seconds() > 120:
                logger.warning("Job %s is a zombie (last heartbeat %s). Marking as failed.", job.job_id, job.updated_at)
                update_job(
                    job.job_id, 
                    status=JobStatus.FAILED, 
                    error="Processing was interrupted. Process again."
                )
        except ValueError:
            # Bad date format
            pass
