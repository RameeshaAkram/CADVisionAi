"""Tests for processing routes."""

import cv2
import numpy as np
import pytest
from unittest.mock import patch
from backend.core.config import settings
from backend.models.job_models import JobMode, UnitType, JobStatus
import time


def _make_dummy_image(path):
    img = np.random.randint(50, 200, (300, 300, 3), dtype=np.uint8)
    cv2.imwrite(str(path), img)


def test_processing_routes(client, tmp_path):
    # Temporarily bypass blur threshold for synthetic images
    with patch.object(settings, "BLUR_THRESHOLD", 0.0):
        # 1. Create a job with 2 dummy images
        img1_path = tmp_path / "1.jpg"
        img2_path = tmp_path / "2.jpg"
        _make_dummy_image(img1_path)
        _make_dummy_image(img2_path)
        
        with open(img1_path, "rb") as f1, open(img2_path, "rb") as f2:
            create_resp = client.post(
                "/api/jobs",
                data={"mode": "photo", "units": "mm", "known_dimensions": '[{"label": "width", "value": 10}]'},
                files=[("files", ("1.jpg", f1, "image/jpeg")), ("files", ("2.jpg", f2, "image/jpeg"))]
            )
        assert create_resp.status_code == 201, create_resp.json()
        job_id = create_resp.json()["job_id"]
        
        # 2. Start processing
        proc_resp = client.post(f"/api/jobs/{job_id}/process")
        assert proc_resp.status_code == 202
        assert proc_resp.json()["status"] == "processing"
        
        # 3. Process while processing (simulate by intercepting before background task finishes or just catching the state)
        # Fast background tasks might finish immediately in TestClient depending on FastAPI version, but let's poll.
        
        # Poll status
        for _ in range(20):
            stat_resp = client.get(f"/api/jobs/{job_id}/status")
            assert stat_resp.status_code == 200
            data = stat_resp.json()
            if data["status"] == "completed":
                break
            time.sleep(0.1)
            
        data = client.get(f"/api/jobs/{job_id}/status").json()
        assert data["status"] == "completed"
        assert data["progress"] == 1.0
        assert data["current_stage"] is None
        assert len(data["stages"]) == 11


def test_process_unknown_job(client):
    resp = client.post("/api/jobs/unknown_job_id/process")
    assert resp.status_code == 404


def test_get_status_unknown_job(client):
    resp = client.get("/api/jobs/unknown_job_id/status")
    assert resp.status_code == 404
