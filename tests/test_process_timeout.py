import pytest
from fastapi.testclient import TestClient
import time
import json
import cv2
import numpy as np

from backend.main import app
from backend.storage import job_manager
from backend.pipeline import reconstruction

client = TestClient(app)

def test_process_timeout(tmp_path, monkeypatch):
    from backend.core.config import settings
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(settings, "OUTPUT_DIR", str(tmp_path / "out"))
    monkeypatch.setattr(settings, "RECON_TIMEOUT_SEC", 1) # short timeout
    monkeypatch.setattr(settings, "HEARTBEAT_SEC", 0.5)
    
    job_manager.clear_cache()
    
    # Fake slow reconstruction
    def fake_reconstruct(*args, **kwargs):
        time.sleep(3) # longer than timeout
        return "fake_mesh.obj", []
        
    monkeypatch.setattr(reconstruction, "reconstruct", fake_reconstruct)
    
    # Create job with 3 images to bypass gate
    img_path = tmp_path / "dummy.png"
    img = np.full((300, 300, 3), 255, dtype=np.uint8)
    cv2.imwrite(str(img_path), img)
    
    with open(img_path, "rb") as f:
        res = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "mm", "known_dimensions": json.dumps([{"label": "w", "value": 10}])},
            files=[("files", ("dummy.png", f, "image/png"))]
        )
    assert res.status_code == 201
    job_id = res.json()["job_id"]
    
    for i in range(3):
        img_path = tmp_path / f"t{i}.png"
        img = np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8) # Add noise to pass blur check
        cv2.circle(img, (150, 150), 50 + i * 10, (0, 0, 0), -1) # distinct shapes
        cv2.imwrite(str(img_path), img)
        with open(img_path, "rb") as f:
            client.post(f"/api/jobs/{job_id}/files", files=[("files", (f"t{i}.png", f, "image/png"))])
            
    # Process
    proc_res = client.post(f"/api/jobs/{job_id}/process")
    assert proc_res.status_code == 202
    
    # Get health immediately during process
    health_res = client.get("/health")
    assert health_res.status_code == 200
    
    # Wait for timeout
    time.sleep(1.5)
    
    # Check status
    status_res = client.get(f"/api/jobs/{job_id}/status")
    data = status_res.json()
    assert data["status"] == "failed"
    assert "timed out" in data["error"]
