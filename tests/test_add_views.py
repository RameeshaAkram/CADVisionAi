"""Tests for appending files to an existing job and reprocessing."""

import pytest
from fastapi.testclient import TestClient
from pathlib import Path
import json
import time

from backend.main import app
from backend.storage import job_manager
from backend.models.job_models import JobStatus

client = TestClient(app)

def test_add_views_and_reprocess(tmp_path):
    job_manager.clear_cache()
    
    # 1. Create a job with 1 image (should eventually trigger needs_more_views)
    import cv2
    import numpy as np
    
    img_path = tmp_path / "test1.png"
    img1 = np.full((300, 300, 3), 255, dtype=np.uint8)
    cv2.circle(img1, (150, 150), 50, (0, 0, 0), -1)
    cv2.imwrite(str(img_path), img1)
    
    with open(img_path, "rb") as f:
        res = client.post(
            "/api/jobs",
            data={
                "mode": "photo",
                "units": "mm",
                "known_dimensions": json.dumps([{"label": "width", "value": 100.0}])
            },
            files=[("files", ("test1.png", f, "image/png"))]
        )
    if res.status_code != 201:
        print(res.json())
    assert res.status_code == 201
    job_id = res.json()["job_id"]
    
    # 2. Process the job
    res = client.post(f"/api/jobs/{job_id}/process")
    assert res.status_code == 202
    
    # Wait for processing to finish (either complete or needs_more_views)
    # Give it a short time
    for _ in range(20):
        status_res = client.get(f"/api/jobs/{job_id}/status")
        if status_res.json()["status"] in ["completed", "needs_more_views", "failed"]:
            break
        time.sleep(0.5)
        
    status = client.get(f"/api/jobs/{job_id}").json()
    assert status["status"] in ["needs_more_views", "completed", "failed"]
    assert status["file_count"] == 1
    
    # 3. Add more files
    img_path2 = tmp_path / "test2.png"
    img2 = np.full((300, 300, 3), 255, dtype=np.uint8)
    cv2.rectangle(img2, (100, 100), (200, 200), (0, 0, 0), -1)
    cv2.imwrite(str(img_path2), img2)
    
    with open(img_path2, "rb") as f:
        res = client.post(
            f"/api/jobs/{job_id}/files",
            files=[("files", ("test2.png", f, "image/png"))]
        )
    assert res.status_code == 201
    assert res.json()["file_count"] == 2
    
    # Ensure known_dimensions and units are unchanged
    assert res.json()["units"] == "mm"
    assert res.json()["known_dimensions"][0]["value"] == 100.0
    
    # 4. Reprocess
    res = client.post(f"/api/jobs/{job_id}/process")
    assert res.status_code == 202
