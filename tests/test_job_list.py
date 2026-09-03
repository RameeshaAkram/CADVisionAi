import pytest
from fastapi.testclient import TestClient
import time
import json
from backend.main import app
from backend.storage import job_manager

client = TestClient(app)

def test_job_list_persistence(tmp_path, monkeypatch):
    from backend.core.config import settings
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    job_manager.clear_cache()
    
    import cv2
    import numpy as np
    
    # Create job 1
    img1_path = tmp_path / "test1.png"
    img1 = np.full((300, 300, 3), 255, dtype=np.uint8)
    cv2.imwrite(str(img1_path), img1)
    
    with open(img1_path, "rb") as f:
        res1 = client.post(
            "/api/jobs",
            data={
                "mode": "photo",
                "units": "mm",
                "known_dimensions": json.dumps([{"label": "width", "value": 100}])
            },
            files=[("files", ("test1.png", f, "image/png"))]
        )
    assert res1.status_code == 201
    
    time.sleep(0.1) # ensure different created_at
    
    # Create job 2
    img2_path = tmp_path / "test2.png"
    cv2.imwrite(str(img2_path), img1)
    
    with open(img2_path, "rb") as f:
        res2 = client.post(
            "/api/jobs",
            data={
                "mode": "photo",
                "units": "mm",
                "known_dimensions": json.dumps([{"label": "width", "value": 200}])
            },
            files=[("files", ("test2.png", f, "image/png"))]
        )
    assert res2.status_code == 201
    
    # Clear cache to simulate restart
    job_manager.clear_cache()
    
    # Fetch list
    res = client.get("/api/jobs")
    assert res.status_code == 200
    data = res.json()
    
    assert len(data["jobs"]) == 2
    # newest first
    assert data["jobs"][0]["job_id"] == res2.json()["job_id"]
    assert data["jobs"][1]["job_id"] == res1.json()["job_id"]
