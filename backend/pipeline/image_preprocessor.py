"""Segment 3 — Image preprocessor: resize, denoise, normalize images before analysis."""

import cv2
import numpy as np

from backend.core.config import settings
from backend.utils import image_utils


def process(image: np.ndarray) -> np.ndarray:
    """Preprocess a single BGR image.
    
    Steps applied:
    - Resize max side to PREPROCESS_MAX_SIDE (no upscaling).
    - Light contrast normalization (CLAHE on L channel of LAB colorspace).
    
    Note: EXIF orientation is handled automatically by OpenCV's imread during loading.
    Returns a uint8 3-channel BGR image.
    """
    # 1. Resize
    processed = image_utils.resize_max_side(image, settings.PREPROCESS_MAX_SIDE)

    # 2. Light contrast normalization using CLAHE
    # Convert BGR to LAB space
    lab = cv2.cvtColor(processed, cv2.COLOR_BGR2LAB)
    l_chan, a_chan, b_chan = cv2.split(lab)
    
    # Apply CLAHE to L-channel
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l_chan)
    
    # Merge the CLAHE enhanced L-channel with the original A and B channels
    merged_lab = cv2.merge((cl, a_chan, b_chan))
    
    # Convert back to BGR
    processed = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)

    return processed


def process_many(images: list[np.ndarray]) -> list[np.ndarray]:
    """Preprocess a list of images sequentially."""
    return [process(img) for img in images]
