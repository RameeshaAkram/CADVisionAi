"""Segment 3 — Image utilities: loading, format conversion, thumbnail generation.

We standardize on BGR for internal image arrays since OpenCV is the primary backend.
"""

import cv2
import numpy as np


def load_image(path: str) -> np.ndarray:
    """Load an image from disk into a BGR numpy array. Raises ValueError if unreadable."""
    img = cv2.imread(path)
    if img is None:
        raise ValueError(f"Failed to load image from {path}")
    return img


def save_image(path: str, image: np.ndarray, quality: int = 90) -> None:
    """Save a BGR numpy array to disk as a JPEG."""
    cv2.imwrite(path, image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])


def resize_max_side(image: np.ndarray, max_side: int) -> np.ndarray:
    """Resize image so the longest side equals max_side, keeping aspect ratio.
    Does not upscale if the image is already smaller.
    """
    h, w = image.shape[:2]
    longest = max(h, w)
    if longest <= max_side:
        return image

    scale = max_side / longest
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)


def sharpness_score(image: np.ndarray) -> float:
    """Calculate the Laplacian variance of the image as a sharpness metric."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def to_rgb(image: np.ndarray) -> np.ndarray:
    """Convert BGR to RGB."""
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def to_bgr(image: np.ndarray) -> np.ndarray:
    """Convert RGB to BGR."""
    return cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
