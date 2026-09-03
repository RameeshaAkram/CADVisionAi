import pytest
import cv2
import numpy as np
import tempfile
import os
from backend.pipeline import object_detector
from backend.models.job_models import NormalizedImage

@pytest.fixture
def temp_images_dir():
    with tempfile.TemporaryDirectory() as d:
        yield d

def create_test_image(path, content_type="solid", size=(300, 300)):
    img = np.zeros((*size, 3), dtype=np.uint8)
    if content_type == "rect_dark_bg":
        img[:] = (20, 20, 20)
        cv2.rectangle(img, (100, 100), (200, 200), (255, 255, 255), -1)
    elif content_type == "empty":
        img[:] = (20, 20, 20)
    cv2.imwrite(path, img)
    return path

def test_detect_object(temp_images_dir):
    p1 = os.path.join(temp_images_dir, "1.jpg")
    create_test_image(p1, "rect_dark_bg")
    
    images = [
        NormalizedImage(index=0, filename="1.jpg", stored_path=p1, width=300, height=300, sharpness=100.0)
    ]
    
    res = object_detector.detect(images)
    
    assert res["object_found"] is True
    assert len(res["components"]) == 1
    
    comp = res["components"][0]
    x, y, w, h = comp["bbox"]
    
    # Bbox should roughly cover the rectangle (100, 100) to (200, 200)
    assert 90 <= x <= 110
    assert 90 <= y <= 110
    assert 90 <= w <= 110
    assert 90 <= h <= 110
    assert comp["confidence"] > 0.0

def test_detect_empty(temp_images_dir):
    p1 = os.path.join(temp_images_dir, "1.jpg")
    create_test_image(p1, "empty")
    
    images = [
        NormalizedImage(index=0, filename="1.jpg", stored_path=p1, width=300, height=300, sharpness=100.0)
    ]
    
    res = object_detector.detect(images)
    
    assert res["object_found"] is False
    assert len(res["components"]) == 0
