"""Tests for orchestrator."""

import cv2
import numpy as np
import pytest
from pathlib import Path
from unittest.mock import patch

from backend.core.config import settings
from backend.core.exceptions import JobNotFoundError
from backend.models.job_models import Job, JobMode, UnitType, KnownDimension, FileMeta, JobStatus, NormalizedImage, StageStatus
from backend.storage import job_manager, file_manager
from backend.pipeline import orchestrator


def _make_dummy_image(path: Path):
    img = np.random.randint(50, 200, (300, 300, 3), dtype=np.uint8)
    cv2.imwrite(str(path), img)


def _setup_job(job_id: str, num_images: int):
    job_dir = file_manager.job_dir(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)
    
    files = []
    for i in range(num_images):
        p = job_dir / f"img_{i}.jpg"
        _make_dummy_image(p)
        files.append(FileMeta(
            filename=f"img_{i}.jpg",
            stored_path=str(p),
            kind="image",
            bytes=100
        ))
        
    job = job_manager.create_job(
        mode=JobMode.PHOTO,
        units=UnitType.MM,
        known_dimensions=[KnownDimension(label="length", value=10)],
        files_meta=files,
        job_id=job_id
    )
    return job


def test_orchestrator_success(tmp_path):
    job_id = "test_orch_success"
    _setup_job(job_id, 2)
    
    with patch.object(settings, "BLUR_THRESHOLD", 0.0):
        updated_job = orchestrator.run_job(job_id)
        
    assert updated_job.status == JobStatus.COMPLETED
    assert updated_job.progress == 1.0
    assert updated_job.current_stage is None
    
    # Check that all stages completed
    for stage in updated_job.stages:
        assert stage.status == "completed"
        
    # Check placeholders
    assert "reconstruction" in updated_job.result
    assert updated_job.result["reconstruction"]["type"] == "mesh"
    assert "validation" in updated_job.result
    assert updated_job.result["validation"]["confidence"] == 0.0


def test_orchestrator_early_exit_duplicate_images(tmp_path):
    job_id = "test_orch_dup"
    job = _setup_job(job_id, 2)
    
    # Overwrite images with identical arrays that have features
    np.random.seed(42)
    img = np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8)
    for f in job.files:
        cv2.imwrite(f.stored_path, img)
        
    with patch.object(settings, "BLUR_THRESHOLD", 0.0):
        updated = orchestrator.run_job(job_id)
        
    assert updated.status == JobStatus.NEEDS_MORE_VIEWS
    
    view_analysis_found = False
    for s in updated.stages:
        if s.name == "view_analysis":
            view_analysis_found = True
            assert s.status == "completed"
        elif view_analysis_found:
            assert s.status == "skipped"

def test_orchestrator_distinct_images(tmp_path):
    job_id = "test_orch_distinct"
    job = _setup_job(job_id, 2)
    
    # Overwrite images with visually distinct arrays
    img1 = np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8)
    img2 = np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8)
    
    cv2.imwrite(job.files[0].stored_path, img1)
    cv2.imwrite(job.files[1].stored_path, img2)
        
    with patch.object(settings, "BLUR_THRESHOLD", 0.0):
        updated = orchestrator.run_job(job_id)
        
    assert updated.status == JobStatus.COMPLETED
    
    for s in updated.stages:
        assert s.status == "completed"


def test_orchestrator_needs_more_views(tmp_path):
    job_id = "test_orch_views"
    _setup_job(job_id, 1)
    
    with patch.object(settings, "BLUR_THRESHOLD", 0.0):
        updated_job = orchestrator.run_job(job_id)
        
    assert updated_job.status == JobStatus.NEEDS_MORE_VIEWS
    assert updated_job.progress == 1.0
    assert updated_job.current_stage is None
    
    # Check stages
    assert updated_job.stages[0].name == "prepare_images"
    assert updated_job.stages[0].status == "completed"
    
    for stage in updated_job.stages[1:]:
        assert stage.status == "skipped"
        
    assert "Need more viewpoints" in updated_job.warnings[0]


def test_orchestrator_unknown_job():
    with pytest.raises(JobNotFoundError):
        orchestrator.run_job("nonexistent_job")
