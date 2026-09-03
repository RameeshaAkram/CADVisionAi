"""Tests for prepare_images pipeline."""

import cv2
import numpy as np
import pytest
from pathlib import Path
from unittest.mock import patch

from backend.core.config import settings
from backend.core.exceptions import JobNotFoundError
from backend.models.job_models import Job, JobMode, UnitType, KnownDimension, FileMeta
from backend.storage import job_manager, file_manager
from backend.pipeline import input_processor


def _make_dummy_image(path: Path):
    img = np.random.randint(50, 200, (300, 300, 3), dtype=np.uint8)
    cv2.imwrite(str(path), img)


def _make_dummy_video(path: Path):
    out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*'mp4v'), 30, (640, 480))
    for _ in range(30):
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        out.write(img)
    out.release()


def test_prepare_images_photo_job(tmp_path):
    job_id = "test_photo_prep"
    job_dir = file_manager.job_dir(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)
    
    files = []
    for i in range(3):
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
    
    with patch.object(settings, "BLUR_THRESHOLD", 0.0):
        res = input_processor.prepare_images(job_id)
        
    assert res.source == "photo"
    assert len(res.images) == 3
    
    norm_dir = job_dir / "normalized"
    assert norm_dir.is_dir()
    
    # Check normalized files
    saved_files = list(norm_dir.glob("*.jpg"))
    assert len(saved_files) == 3
    
    updated_job = job_manager.get_job(job_id)
    assert len(updated_job.normalized_images) == 3


def test_prepare_images_video_job(tmp_path):
    job_id = "test_video_prep"
    job_dir = file_manager.job_dir(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)
    
    p = job_dir / "vid.mp4"
    _make_dummy_video(p)
    
    job = job_manager.create_job(
        mode=JobMode.VIDEO,
        units=UnitType.MM,
        known_dimensions=[KnownDimension(label="length", value=10)],
        files_meta=[FileMeta(
            filename="vid.mp4",
            stored_path=str(p),
            kind="video",
            bytes=100
        )],
        job_id=job_id
    )
    
    with patch.object(settings, "BLUR_THRESHOLD", 0.0):
        res = input_processor.prepare_images(job_id)
        
    assert res.source == "video"
    assert len(res.images) > 0
    assert len(res.images) <= settings.MAX_EXTRACTED_FRAMES
    
    norm_dir = job_dir / "normalized"
    assert norm_dir.is_dir()
    
    saved_files = list(norm_dir.glob("*.jpg"))
    assert len(saved_files) == len(res.images)


def test_prepare_images_not_found():
    with pytest.raises(JobNotFoundError):
        input_processor.prepare_images("not-a-real-job")
