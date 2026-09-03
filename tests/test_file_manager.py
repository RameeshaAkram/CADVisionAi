"""Tests for backend.storage.file_manager."""

import io
from pathlib import Path
from unittest.mock import patch

import pytest
from PIL import Image

from backend.core.config import settings
from backend.core.exceptions import ValidationError
from backend.storage import file_manager


def _make_image(width: int = 512, height: int = 512, fmt: str = "PNG") -> bytes:
    """Create a minimal in-memory image."""
    img = Image.new("RGB", (width, height), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


class TestSaveUploadImage:
    def test_valid_png(self):
        data = _make_image(512, 512, "PNG")
        meta = file_manager.save_upload("job1", "photo.png", data, "image")
        assert meta.kind == "image"
        assert meta.width == 512
        assert meta.height == 512
        assert meta.bytes == len(data)
        assert Path(meta.stored_path).exists()

    def test_valid_jpeg(self):
        data = _make_image(800, 600, "JPEG")
        meta = file_manager.save_upload("job2", "shot.jpg", data, "image")
        assert meta.kind == "image"
        assert meta.width == 800
        assert meta.height == 600

    def test_rejects_empty_file(self):
        with pytest.raises(ValidationError, match="Empty file"):
            file_manager.save_upload("job3", "empty.png", b"", "image")

    def test_rejects_oversize_file(self):
        with patch.object(settings, "MAX_UPLOAD_MB", 0):
            with pytest.raises(ValidationError, match="limit is 0 MB"):
                file_manager.save_upload("job4", "big.png", b"x" * 100, "image")

    def test_rejects_unreadable_image(self):
        with pytest.raises(ValidationError, match="Cannot read image"):
            file_manager.save_upload("job5", "corrupt.png", b"not-an-image", "image")

    def test_rejects_too_small_image(self):
        data = _make_image(100, 100, "PNG")
        with pytest.raises(ValidationError, match="at least 256 px"):
            file_manager.save_upload("job6", "tiny.png", data, "image")

    def test_rejects_bad_extension(self):
        data = _make_image(512, 512, "PNG")
        with pytest.raises(ValidationError, match="not allowed"):
            file_manager.save_upload("job7", "photo.bmp", data, "image")


class TestSaveUploadVideo:
    def test_valid_mp4(self):
        data = b"\x00" * 1024  # dummy bytes, not a real mp4
        meta = file_manager.save_upload("jobv1", "clip.mp4", data, "video")
        assert meta.kind == "video"
        assert meta.width is None
        assert meta.height is None
        assert Path(meta.stored_path).exists()

    def test_rejects_bad_extension(self):
        with pytest.raises(ValidationError, match="not allowed"):
            file_manager.save_upload("jobv2", "clip.avi", b"\x00" * 100, "video")


class TestJobDir:
    def test_returns_path_under_upload_dir(self):
        d = file_manager.job_dir("abc123")
        assert str(d).endswith("abc123")

    def test_list_job_files_empty(self):
        assert file_manager.list_job_files("nonexistent") == []


class TestFilenameSanitization:
    def test_strips_path_components(self):
        data = _make_image(300, 300, "PNG")
        meta = file_manager.save_upload("jobsan", "../../etc/passwd.png", data, "image")
        assert "/" not in Path(meta.stored_path).name
        assert ".." not in Path(meta.stored_path).name

    def test_handles_collision(self):
        data = _make_image(300, 300, "PNG")
        m1 = file_manager.save_upload("jobcol", "same.png", data, "image")
        m2 = file_manager.save_upload("jobcol", "same.png", data, "image")
        assert m1.stored_path != m2.stored_path
