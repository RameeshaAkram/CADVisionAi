"""Segment 3 — Video utilities: codec detection, duration, format validation."""

import contextlib
from typing import Iterator

import cv2
import numpy as np


@contextlib.contextmanager
def open_video(path: str):
    """Context manager for opening a video file with OpenCV."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError(f"Failed to open video file {path}")
    try:
        yield cap
    finally:
        cap.release()


def video_meta(path: str) -> dict:
    """Extract basic metadata from a video file."""
    with open_video(path) as cap:
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration_sec = frame_count / fps if fps > 0 else 0.0
        return {
            "fps": fps,
            "frame_count": frame_count,
            "width": width,
            "height": height,
            "duration_sec": duration_sec,
        }


def iter_frames(path: str, stride: int) -> Iterator[tuple[int, float, np.ndarray]]:
    """Yield frames from a video at the given stride.
    Yields (index, timestamp_sec, frame_bgr).
    """
    if stride < 1:
        stride = 1

    with open_video(path) as cap:
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30.0  # Fallback

        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_idx % stride == 0:
                timestamp_sec = frame_idx / fps
                yield frame_idx, timestamp_sec, frame
                
            frame_idx += 1
