import pytest
import cv2
import numpy as np
import tempfile
import os
from pathlib import Path
from backend.pipeline import view_analyzer
from backend.models.job_models import NormalizedImage

@pytest.fixture
def temp_images_dir():
    with tempfile.TemporaryDirectory() as d:
        yield d

def create_test_image(path, content_type="solid", size=(300, 300)):
    img = np.zeros((*size, 3), dtype=np.uint8)
    if content_type == "solid":
        img[:] = (200, 200, 200)
    elif content_type == "circle":
        img[:] = (255, 255, 255)
        cv2.circle(img, (150, 150), 50, (0, 0, 0), -1)
    elif content_type == "rect":
        img[:] = (255, 255, 255)
        cv2.rectangle(img, (50, 50), (250, 250), (0, 0, 0), -1)
    elif content_type == "dark":
        img[:] = (20, 20, 20)
    elif content_type == "bright":
        img[:] = (250, 250, 250)
    cv2.imwrite(path, img)
    return path

def test_analyze_empty():
    res = view_analyzer.analyze([])
    assert not res["enough_views"]

def test_analyze_duplicate_images(temp_images_dir):
    p1 = os.path.join(temp_images_dir, "1.jpg")
    p2 = os.path.join(temp_images_dir, "2.jpg")
    
    # Identical noise images for ORB to find features but they will match 100%
    np.random.seed(42)
    img1 = np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8)
    cv2.imwrite(p1, img1)
    cv2.imwrite(p2, img1)
    
    images = [
        NormalizedImage(index=0, filename="1.jpg", stored_path=p1, width=300, height=300, sharpness=100.0),
        NormalizedImage(index=1, filename="2.jpg", stored_path=p2, width=300, height=300, sharpness=100.0),
    ]
    
    res = view_analyzer.analyze(images)
    
    # Due to high correlation, it should flag near duplicate and diversity should be low.
    # Therefore, enough_views should be False.
    assert res["viewpoint_diversity"] < 0.25
    assert not res["enough_views"]
    assert any(r["reason"] == "near_duplicate" for r in res["rejected"])

def test_analyze_diverse_images(temp_images_dir):
    p1 = os.path.join(temp_images_dir, "1.jpg")
    p2 = os.path.join(temp_images_dir, "2.jpg")
    # Using real images with complex patterns so ORB can detect features
    img1 = np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8)
    img2 = np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8)
    cv2.imwrite(p1, img1)
    cv2.imwrite(p2, img2)
    
    images = [
        NormalizedImage(index=0, filename="1.jpg", stored_path=p1, width=300, height=300, sharpness=150.0),
        NormalizedImage(index=1, filename="2.jpg", stored_path=p2, width=300, height=300, sharpness=150.0),
    ]
    
    res = view_analyzer.analyze(images)
    
    # Completely different noise -> 0 matches -> diversity = 1.0
    assert res["viewpoint_diversity"] > 0.5
    assert res["enough_views"]

def test_analyze_exposure(temp_images_dir):
    p1 = os.path.join(temp_images_dir, "1.jpg")
    create_test_image(p1, "dark")
    
    images = [
        NormalizedImage(index=0, filename="1.jpg", stored_path=p1, width=300, height=300, sharpness=100.0),
    ]
    
    res = view_analyzer.analyze(images)
    assert any(r["reason"] == "too_dark" for r in res["rejected"])
