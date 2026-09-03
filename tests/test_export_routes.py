import pytest
import os
import json
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import app
from backend.storage import file_manager
from backend.storage.job_manager import _jobs as _job_store
from backend.models.job_models import Job, JobStatus, OutputRecord

client = TestClient(app)

@pytest.fixture
def mock_job(tmp_path):
    job_id = "test_export_job"
    
    # Create the job dir
    job_dir = tmp_path / job_id
    job_dir.mkdir()
    
    # Mock settings to point to temp dir
    from backend.core.config import settings
    settings.OUTPUT_DIR = str(tmp_path)
    
    # Create fake files
    dxf_path = job_dir / "drawing.dxf"
    dxf_path.write_text("fake dxf content")
    
    stl_path = job_dir / "model.stl"
    stl_path.write_text("fake stl content")
    
    # Create a job record
    job = Job(
        job_id=job_id,
        mode="photo",
        status=JobStatus.COMPLETED,
        units="mm",
        known_dimensions=[],
        outputs=[
            OutputRecord(kind="dxf", filename="drawing.dxf", path=str(dxf_path)),
            OutputRecord(kind="mesh", filename="model.stl", path=str(stl_path))
        ],
        result={"drawing_generation": {"views": {}, "title_block": {}}}
    )
    
    _job_store[job_id] = job
    yield job_id
    
    # Cleanup
    del _job_store[job_id]

def test_get_exports_success(mock_job):
    resp = client.get(f"/api/jobs/{mock_job}/exports")
    assert resp.status_code == 200
    data = resp.json()
    assert "files" in data
    assert len(data["files"]) == 2
    
    dxf_file = next(f for f in data["files"] if f["kind"] == "dxf")
    assert dxf_file["filename"] == "drawing.dxf"
    assert dxf_file["ready"] is True
    assert dxf_file["url"] == f"/api/jobs/{mock_job}/exports/drawing.dxf"
    assert dxf_file["size"] > 0
    
def test_get_exports_missing_job():
    resp = client.get("/api/jobs/missing_job/exports")
    assert resp.status_code == 404
    
def test_download_export_success(mock_job):
    resp = client.get(f"/api/jobs/{mock_job}/exports/drawing.dxf")
    assert resp.status_code == 200
    assert resp.content == b"fake dxf content"
    assert resp.headers["content-disposition"] == 'attachment; filename="drawing.dxf"'
    assert resp.headers["content-type"] == "application/dxf"
    
def test_download_export_unknown_file(mock_job):
    resp = client.get(f"/api/jobs/{mock_job}/exports/unknown.txt")
    assert resp.status_code == 404
    
def test_download_export_path_traversal(mock_job):
    resp = client.get(f"/api/jobs/{mock_job}/exports/..%2Fmain.py")
    assert resp.status_code == 404

def test_get_drawing_success(mock_job):
    resp = client.get(f"/api/jobs/{mock_job}/drawing")
    assert resp.status_code == 200
    data = resp.json()
    assert "views" in data
