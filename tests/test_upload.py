"""Tests for upload routes (POST /api/jobs, GET /api/jobs/{id}, etc.)."""

import io
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from PIL import Image

from backend.core.config import settings


def _make_image(width: int = 512, height: int = 512, fmt: str = "PNG") -> bytes:
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _make_jpeg(width: int = 640, height: int = 480) -> bytes:
    return _make_image(width, height, "JPEG")


DIMS_JSON = json.dumps([{"label": "height", "value": 8}])


class TestCreatePhotoJob:
    def test_single_image_succeeds(self, client):
        resp = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "feet", "known_dimensions": DIMS_JSON},
            files=[("files", ("pic.png", _make_image(), "image/png"))],
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["mode"] == "photo"
        assert body["status"] == "uploaded"
        assert body["units"] == "feet"
        assert body["file_count"] == 1
        assert body["known_dimensions"] == [{"label": "height", "value": 8.0}]
        # Should have a warning about fewer than 3 views
        assert any("Fewer than 3" in w for w in body["warnings"])

    def test_multiple_images_succeed(self, client):
        files = [
            ("files", (f"img{i}.jpg", _make_jpeg(), "image/jpeg"))
            for i in range(4)
        ]
        resp = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "mm", "known_dimensions": DIMS_JSON},
            files=files,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["file_count"] == 4
        assert body["warnings"] == []

    def test_files_exist_on_disk(self, client):
        resp = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "cm", "known_dimensions": DIMS_JSON},
            files=[("files", ("disk.png", _make_image(), "image/png"))],
        )
        job_id = resp.json()["job_id"]
        job_dir = Path(settings.UPLOAD_DIR) / job_id
        assert job_dir.is_dir()
        assert (job_dir / "job.json").is_file()
        # At least one upload besides job.json
        uploads = [f for f in job_dir.iterdir() if f.name != "job.json"]
        assert len(uploads) == 1


class TestCreateVideoJob:
    def test_single_mp4_succeeds(self, client):
        resp = client.post(
            "/api/jobs",
            data={"mode": "video", "units": "inches", "known_dimensions": DIMS_JSON},
            files=[("files", ("clip.mp4", b"\x00" * 1024, "video/mp4"))],
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["mode"] == "video"
        assert body["file_count"] == 1
        assert body["files"][0]["kind"] == "video"

    def test_two_videos_rejected(self, client):
        resp = client.post(
            "/api/jobs",
            data={"mode": "video", "units": "mm", "known_dimensions": DIMS_JSON},
            files=[
                ("files", ("a.mp4", b"\x00" * 100, "video/mp4")),
                ("files", ("b.mp4", b"\x00" * 100, "video/mp4")),
            ],
        )
        assert resp.status_code == 400


class TestValidation:
    def test_missing_dimensions(self, client):
        resp = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "mm", "known_dimensions": "[]"},
            files=[("files", ("ok.png", _make_image(), "image/png"))],
        )
        assert resp.status_code == 400

    def test_mixed_image_video_on_photo(self, client):
        resp = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "mm", "known_dimensions": DIMS_JSON},
            files=[
                ("files", ("pic.png", _make_image(), "image/png")),
                ("files", ("clip.mp4", b"\x00" * 100, "video/mp4")),
            ],
        )
        assert resp.status_code == 400

    def test_oversize_file(self, client):
        with patch.object(settings, "MAX_UPLOAD_MB", 0):
            resp = client.post(
                "/api/jobs",
                data={"mode": "photo", "units": "mm", "known_dimensions": DIMS_JSON},
                files=[("files", ("big.png", _make_image(), "image/png"))],
            )
            assert resp.status_code == 400

    def test_unreadable_image(self, client):
        resp = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "mm", "known_dimensions": DIMS_JSON},
            files=[("files", ("bad.png", b"not-an-image", "image/png"))],
        )
        assert resp.status_code == 400

    def test_tiny_image(self, client):
        small = _make_image(100, 100, "PNG")
        resp = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "mm", "known_dimensions": DIMS_JSON},
            files=[("files", ("small.png", small, "image/png"))],
        )
        assert resp.status_code == 400

    def test_invalid_mode(self, client):
        resp = client.post(
            "/api/jobs",
            data={"mode": "xray", "units": "mm", "known_dimensions": DIMS_JSON},
            files=[("files", ("ok.png", _make_image(), "image/png"))],
        )
        assert resp.status_code == 400

    def test_invalid_units(self, client):
        resp = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "parsecs", "known_dimensions": DIMS_JSON},
            files=[("files", ("ok.png", _make_image(), "image/png"))],
        )
        assert resp.status_code == 400


class TestGetJob:
    def test_existing_job(self, client):
        create = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "mm", "known_dimensions": DIMS_JSON},
            files=[("files", ("pic.png", _make_image(), "image/png"))],
        )
        job_id = create.json()["job_id"]
        resp = client.get(f"/api/jobs/{job_id}")
        assert resp.status_code == 200
        assert resp.json()["job_id"] == job_id

    def test_unknown_job_404(self, client):
        resp = client.get("/api/jobs/does_not_exist")
        assert resp.status_code == 404


class TestAddFiles:
    def test_append_images(self, client):
        create = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "mm", "known_dimensions": DIMS_JSON},
            files=[("files", ("a.png", _make_image(), "image/png"))],
        )
        job_id = create.json()["job_id"]
        assert create.json()["file_count"] == 1

        add = client.post(
            f"/api/jobs/{job_id}/files",
            files=[
                ("files", ("b.jpg", _make_jpeg(), "image/jpeg")),
                ("files", ("c.jpg", _make_jpeg(), "image/jpeg")),
            ],
        )
        assert add.status_code == 201
        assert add.json()["file_count"] == 3
        # Warning about < 3 should be gone now
        assert not any("Fewer than 3" in w for w in add.json()["warnings"])

    def test_add_to_video_job_rejected(self, client):
        create = client.post(
            "/api/jobs",
            data={"mode": "video", "units": "mm", "known_dimensions": DIMS_JSON},
            files=[("files", ("clip.mp4", b"\x00" * 1024, "video/mp4"))],
        )
        job_id = create.json()["job_id"]
        resp = client.post(
            f"/api/jobs/{job_id}/files",
            files=[("files", ("extra.png", _make_image(), "image/png"))],
        )
        assert resp.status_code == 400


class TestGetFile:
    def test_stream_stored_file(self, client):
        create = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "mm", "known_dimensions": DIMS_JSON},
            files=[("files", ("photo.png", _make_image(), "image/png"))],
        )
        job_id = create.json()["job_id"]
        resp = client.get(f"/api/jobs/{job_id}/files/photo.png")
        assert resp.status_code == 200
        assert len(resp.content) > 0

    def test_missing_file_404(self, client):
        create = client.post(
            "/api/jobs",
            data={"mode": "photo", "units": "mm", "known_dimensions": DIMS_JSON},
            files=[("files", ("photo.png", _make_image(), "image/png"))],
        )
        job_id = create.json()["job_id"]
        resp = client.get(f"/api/jobs/{job_id}/files/nope.png")
        assert resp.status_code == 404
