"""Shared pytest fixtures for CAD AI tests."""

import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.core.config import settings
from backend.storage import job_manager


@pytest.fixture(autouse=True)
def _isolated_uploads(tmp_path: Path):
    """Redirect UPLOAD_DIR and OUTPUT_DIR to a temp directory for every test,
    and clear the in-memory job cache afterwards."""
    upload_dir = str(tmp_path / "uploads")
    output_dir = str(tmp_path / "outputs")
    Path(upload_dir).mkdir()
    Path(output_dir).mkdir()
    with patch.object(settings, "UPLOAD_DIR", upload_dir), \
         patch.object(settings, "OUTPUT_DIR", output_dir):
        yield
    job_manager.clear_cache()


@pytest.fixture()
def client():
    """FastAPI TestClient wired to the real app."""
    from backend.main import app
    return TestClient(app)
