import pytest
import cv2
import numpy as np
import tempfile
import os
from backend.pipeline import feature_detector
from backend.models.job_models import NormalizedImage

@pytest.fixture
def temp_images_dir():
    with tempfile.TemporaryDirectory() as d:
        yield d

def create_test_image(path, content_type="solid", size=(300, 300)):
    img = np.zeros((*size, 3), dtype=np.uint8)
    if content_type == "circle":
        img[:] = (255, 255, 255)
        # Draw a dark circle (hole)
        cv2.circle(img, (150, 150), 50, (0, 0, 0), -1)
    elif content_type == "lines":
        img[:] = (255, 255, 255)
        cv2.line(img, (50, 50), (250, 50), (0, 0, 0), 3)
    cv2.imwrite(path, img)
    return path

def test_detect_circle(temp_images_dir):
    p1 = os.path.join(temp_images_dir, "1.jpg")
    create_test_image(p1, "circle")
    
    images = [
        NormalizedImage(index=0, filename="1.jpg", stored_path=p1, width=300, height=300, sharpness=100.0)
    ]
    
    res = feature_detector.detect(images)
    
    assert res["counts"]["hole"] >= 1 or res["counts"]["circle"] >= 1
    
    found_circle = False
    for f in res["features"]:
        if f["type"] in ["circle", "hole"]:
            found_circle = True
            assert 40 <= f["params"]["r_px"] <= 60
            assert f["confidence"] < 1.0
            
    assert found_circle

def test_detect_lines(temp_images_dir):
    p1 = os.path.join(temp_images_dir, "1.jpg")
    create_test_image(p1, "lines")
    
    images = [
        NormalizedImage(index=0, filename="1.jpg", stored_path=p1, width=300, height=300, sharpness=100.0)
    ]
    
    res = feature_detector.detect(images)
    
    assert res["counts"]["line"] >= 1
    
    found_line = False
    for f in res["features"]:
        if f["type"] == "line":
            found_line = True
            
    assert found_line
