"""Pydantic response/request schemas for the CAD AI API."""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


# ── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """Response model for GET /health."""

    status: str
    service: str


# ── Known dimensions ────────────────────────────────────────────────────────

class KnownDimensionSchema(BaseModel):
    label: str
    value: float = Field(gt=0)


# ── File (public — no stored_path) ──────────────────────────────────────────

class FilePublic(BaseModel):
    filename: str
    kind: str
    bytes: int
    width: int | None = None
    height: int | None = None


class StageRecordSchema(BaseModel):
    name: str
    status: str
    detail: str | None = None


class MeasurementSchema(BaseModel):
    id: str
    label: str
    value: float | None = None
    min: float | None = None
    max: float | None = None
    tolerance: float | None = None
    units: str
    level: str
    source: str
    glyph: str

class ScaleCalibrationSchema(BaseModel):
    scale_factor: float | None = None
    units: str
    consistency: float | None = None
    warnings: list[str] = Field(default_factory=list)


# ── Job (public response) ───────────────────────────────────────────────────

class JobPublic(BaseModel):
    job_id: str
    mode: str
    status: str
    current_stage: str | None = None
    progress: float = 0.0
    stages: list[StageRecordSchema] = Field(default_factory=list)
    units: str
    known_dimensions: list[KnownDimensionSchema]
    thickness: float
    file_count: int
    normalized_count: int = 0
    usable_count: int | None = None
    feature_count: int | None = None
    object_found: bool | None = None
    view_warnings: list[str] | None = None
    files: list[FilePublic]
    warnings: list[Any]
    error: str | None = None
    measurements: list[MeasurementSchema] = Field(default_factory=list)
    scale: ScaleCalibrationSchema | None = None
    confidence: dict | None = None
    can_add_files: bool = False
    coverage_score: float | None = None
    coverage_gaps: list[str] | None = None
    assembly: dict | None = None


# ── Export (public response) ────────────────────────────────────────────────

class ExportFile(BaseModel):
    kind: str
    filename: str
    url: str | None = None
    ready: bool
    size: int | None = None
    description: str | None = None

class ExportsResponse(BaseModel):
    files: list[ExportFile]


# ── Processing response ──────────────────────────────────────────────────────

class ProcessAccepted(BaseModel):
    job_id: str
    status: str

