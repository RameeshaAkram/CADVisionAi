"""Job data model — persisted as JSON at {UPLOAD_DIR}/{job_id}/job.json.

Segment 2 only creates jobs with status ``uploaded``.  Other status values
are defined here so later segments can transition without rewriting the model.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Literal, Any

from pydantic import BaseModel, Field


# ── Enumerations ─────────────────────────────────────────────────────────────

class JobStatus(str, Enum):
    UPLOADED = "uploaded"
    NEEDS_MORE_VIEWS = "needs_more_views"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobMode(str, Enum):
    PHOTO = "photo"


class UnitType(str, Enum):
    MM = "mm"
    CM = "cm"
    INCHES = "inches"
    FEET = "feet"


# ── Nested value objects ─────────────────────────────────────────────────────

class KnownDimension(BaseModel):
    label: str
    value: float = Field(gt=0)


class FileMeta(BaseModel):
    filename: str
    stored_path: str
    kind: Literal["image"]
    bytes: int
    width: int | None = None
    height: int | None = None


class NormalizedImage(BaseModel):
    index: int
    filename: str
    stored_path: str
    width: int
    height: int
    sharpness: float


class SkippedImage(BaseModel):
    reason: str
    detail: str


class NormalizedImageSet(BaseModel):
    job_id: str
    source: Literal["photo", "video"]
    images: list[NormalizedImage]
    skipped: list[SkippedImage]
    warnings: list[str]


class StageStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    FAILED = "failed"


class StageRecord(BaseModel):
    name: str
    status: StageStatus = StageStatus.PENDING
    detail: str | None = None


class OutputRecord(BaseModel):
    kind: str
    path: str
    filename: str


# ── Job ──────────────────────────────────────────────────────────────────────

class Job(BaseModel):
    """Full internal job record."""

    job_id: str
    mode: JobMode
    status: JobStatus = JobStatus.UPLOADED
    units: UnitType
    known_dimensions: list[KnownDimension]
    files: list[FileMeta] = Field(default_factory=list)
    normalized_images: list[NormalizedImage] = Field(default_factory=list)
    normalize_warnings: list[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    current_stage: str | None = None
    progress: float = 0.0
    stages: list[StageRecord] = Field(default_factory=list)
    result: dict = Field(default_factory=dict)
    confidence: dict | None = None

    error: str | None = None
    warnings: list[Any] = Field(default_factory=list)
    outputs: list[OutputRecord] = Field(default_factory=list)

    # ── Persistence helpers ──────────────────────────────────────────────

    def save(self, upload_dir: str | Path) -> Path:
        """Write job.json to ``{upload_dir}/{job_id}/``."""
        job_dir = Path(upload_dir) / self.job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        path = job_dir / "job.json"
        path.write_text(self.model_dump_json(indent=2), encoding="utf-8")
        return path

    @classmethod
    def load(cls, job_json_path: str | Path) -> "Job":
        """Read a Job from a ``job.json`` file."""
        data = json.loads(Path(job_json_path).read_text(encoding="utf-8"))
        return cls.model_validate(data)
