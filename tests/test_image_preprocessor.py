"""Tests for image preprocessor."""

import numpy as np
import pytest

from backend.core.config import settings
from backend.pipeline import image_preprocessor


def test_process_resizes_large_image():
    """Verify that a large image is resized to PREPROCESS_MAX_SIDE."""
    # Create a dummy large BGR image (2000x1000)
    large_img = np.zeros((1000, 2000, 3), dtype=np.uint8)
    
    processed = image_preprocessor.process(large_img)
    
    h, w = processed.shape[:2]
    # Max side should be PREPROCESS_MAX_SIDE
    assert max(h, w) == settings.PREPROCESS_MAX_SIDE
    # Aspect ratio should be maintained (2:1)
    assert w == settings.PREPROCESS_MAX_SIDE
    assert h == settings.PREPROCESS_MAX_SIDE // 2
    assert processed.dtype == np.uint8
    assert processed.shape[2] == 3


def test_process_keeps_small_image():
    """Verify that a small image is not upscaled."""
    small_img = np.zeros((500, 500, 3), dtype=np.uint8)
    
    processed = image_preprocessor.process(small_img)
    
    h, w = processed.shape[:2]
    assert h == 500
    assert w == 500
