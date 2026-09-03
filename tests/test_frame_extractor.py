"""Tests for frame extractor."""

import tempfile
import cv2
import numpy as np
import pytest
from pathlib import Path
from unittest.mock import patch

from backend.core.config import settings
from backend.core.exceptions import ProcessingError
from backend.models.job_models import Job, JobMode, UnitType, KnownDimension, FileMeta
from backend.pipeline import frame_extractor


def create_test_video(path: str, fps: int = 30, frames: int = 90):
    """Create a dummy video with solid colors changing and some blurry frames."""
    out = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (640, 480))
    for i in range(frames):
        if i % 10 == 0:
            # Change color
            color = (np.random.randint(0, 255), np.random.randint(0, 255), np.random.randint(0, 255))
        
        img = np.full((480, 640, 3), color, dtype=np.uint8)
        
        if i in (15, 16, 17):
            # Make some blurry frames by heavily blurring
            img = cv2.GaussianBlur(img, (51, 51), 0)
            
        out.write(img)
    out.release()


@pytest.fixture
def dummy_video_job(tmp_path):
    vid_path = str(tmp_path / "test.mp4")
    create_test_video(vid_path, fps=30, frames=90)  # 3 seconds
    
    file_meta = FileMeta(
        filename="test.mp4",
        stored_path=vid_path,
        kind="video",
        bytes=1000
    )
    
    return Job(
        job_id="test_vid_job",
        mode=JobMode.VIDEO,
        units=UnitType.MM,
        known_dimensions=[KnownDimension(label="length", value=100.0)],
        files=[file_meta]
    )


def test_extract_video_success(dummy_video_job):
    # Temporarily lower BLUR_THRESHOLD for synthetic images which might have low variance
    with patch.object(settings, "BLUR_THRESHOLD", 0.0):
        frames, warnings = frame_extractor.extract(dummy_video_job)
        
        assert len(frames) > 0
        assert len(frames) <= settings.MAX_EXTRACTED_FRAMES
        assert all(f.image is not None for f in frames)
        assert all(isinstance(f.timestamp_sec, float) for f in frames)


def test_extract_rejects_empty_job():
    job = Job(
        job_id="empty",
        mode=JobMode.VIDEO,
        units=UnitType.MM,
        known_dimensions=[KnownDimension(label="length", value=100.0)],
        files=[]
    )
    with pytest.raises(ProcessingError, match="No video file found"):
        frame_extractor.extract(job)
