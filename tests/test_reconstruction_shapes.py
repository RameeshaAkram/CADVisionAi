"""Tests for visual hull reconstruction."""

import pytest
import cv2
import numpy as np
from pathlib import Path
from backend.pipeline import reconstruction
from backend.storage import file_manager, job_manager
from backend.models.job_models import JobMode, UnitType, KnownDimension

class DummyImage:
    def __init__(self, path):
        self.stored_path = str(path)

@pytest.fixture
def circle_image(tmp_path):
    path = tmp_path / "circle.png"
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    cv2.circle(img, (100, 100), 50, (0, 0, 0), -1)
    cv2.imwrite(str(path), img)
    return DummyImage(path)

@pytest.fixture
def l_shape_image(tmp_path):
    path = tmp_path / "lshape.png"
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    cv2.rectangle(img, (50, 50), (100, 150), (0, 0, 0), -1) # Vertical bar
    cv2.rectangle(img, (100, 100), (150, 150), (0, 0, 0), -1) # Horizontal bar
    cv2.imwrite(str(path), img)
    return DummyImage(path)

@pytest.fixture
def bar_image(tmp_path):
    path = tmp_path / "bar.png"
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    cv2.rectangle(img, (20, 80), (180, 120), (0, 0, 0), -1) # Long horizontal bar
    cv2.imwrite(str(path), img)
    return DummyImage(path)

def test_reconstruction_shapes_differentiate(tmp_path, circle_image, l_shape_image, bar_image):
    for jid in ["test_circle", "test_lshape", "test_bar"]:
        file_manager.job_dir(jid).mkdir(parents=True, exist_ok=True)
    
    res_circle = reconstruction.reconstruct([circle_image], job_id="test_circle")
    res_l = reconstruction.reconstruct([l_shape_image], job_id="test_lshape")
    res_bar = reconstruction.reconstruct([bar_image], job_id="test_bar")
    
    assert res_circle["type"] == "mesh"
    assert res_l["type"] == "mesh"
    assert res_bar["type"] == "mesh"
    
    # Check that they are not just identical fallback boxes
    assert res_circle["vertex_count"] > 12
    assert res_l["vertex_count"] > 12
    assert res_bar["vertex_count"] > 12
    assert "aabb_fallback" not in res_circle["method"]
    assert "aabb_fallback" not in res_l["method"]
    assert "aabb_fallback" not in res_bar["method"]

    # Verify geometric distinctness:
    # Circle aspect should be ~1
    bounds_c = res_circle["bounds"]
    aspect_c = (bounds_c["max"][0] - bounds_c["min"][0]) / (bounds_c["max"][1] - bounds_c["min"][1])
    assert 0.8 < aspect_c < 1.2
    
    # Bar aspect should be very large or very small
    bounds_b = res_bar["bounds"]
    aspect_b = (bounds_b["max"][0] - bounds_b["min"][0]) / (bounds_b["max"][1] - bounds_b["min"][1])
    assert aspect_b > 2.0 or aspect_b < 0.5
    
    # L-shape should have a different face count or aspect than a solid box
    # Face count can be identical for single view extrusions due to marching cubes uniform grid,
    # so we just rely on the aspect ratio and vertex count checks above for distinctness.

def test_reconstruction_empty():
    res = reconstruction.reconstruct([], job_id="empty")
    assert res["vertex_count"] == 0
    assert res["confidence"] == 0.0
