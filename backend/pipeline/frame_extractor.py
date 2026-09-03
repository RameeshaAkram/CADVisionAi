"""Segment 3 — Frame extractor: pulls representative frames from uploaded video."""

import cv2
import numpy as np
from dataclasses import dataclass
from typing import List

from backend.core.config import settings
from backend.core.exceptions import ProcessingError
from backend.models.job_models import Job
from backend.utils import image_utils, video_utils


@dataclass
class Frame:
    image: np.ndarray
    timestamp_sec: float
    source_index: int


def _is_duplicate(frame: np.ndarray, last_frame: np.ndarray, threshold: float) -> bool:
    """Simple near-duplicate detection using Mean Absolute Difference (MAD)."""
    # Downsample for faster comparison
    f1 = cv2.resize(frame, (128, 128))
    f2 = cv2.resize(last_frame, (128, 128))
    mad = np.mean(np.abs(f1.astype(np.float32) - f2.astype(np.float32)))
    # If MAD is very low, they are near duplicates. 
    # High threshold in config implies similarity. Let's invert the logic based on MAD.
    # Typical MAD for similar frames is < 5-10 out of 255.
    return mad < 10.0


def extract(job: Job) -> tuple[list[Frame], list[str]]:
    """Extract key frames from a video job.
    
    Returns (frames, warnings).
    Raises ProcessingError if no frames can be extracted.
    """
    if not job.files or job.files[0].kind != "video":
        raise ProcessingError("No video file found in job.")
        
    video_path = job.files[0].stored_path
    meta = video_utils.video_meta(video_path)
    
    if meta["frame_count"] == 0 or meta["fps"] <= 0:
        raise ProcessingError("Cannot read video metadata or video is empty.")
        
    stride = max(1, int(meta["fps"] / settings.FRAME_SAMPLE_FPS))
    
    candidates = []
    
    # 1. Gather all sampled frames and calculate sharpness
    for idx, ts, img in video_utils.iter_frames(video_path, stride):
        sharpness = image_utils.sharpness_score(img)
        candidates.append({
            "frame": Frame(image=img, timestamp_sec=ts, source_index=idx),
            "sharpness": sharpness
        })
        
    if not candidates:
        raise ProcessingError("Zero frames could be decoded from the video.")

    # 2. Filter blurry and duplicates
    kept_frames: list[Frame] = []
    warnings: list[str] = []
    
    # Sort candidates by original order
    # Always try to keep first and last usable
    sharp_candidates = [c for c in candidates if c["sharpness"] >= settings.BLUR_THRESHOLD]
    
    if len(sharp_candidates) < 3:
        # Fallback: keep sharpest available up to cap
        warnings.append("Few distinct video frames; reconstruction may fail. Upload more angles or a slower orbit.")
        sorted_by_sharpness = sorted(candidates, key=lambda x: x["sharpness"], reverse=True)
        kept_frames = [c["frame"] for c in sorted_by_sharpness[:settings.MAX_EXTRACTED_FRAMES]]
        # Sort back to chronological
        kept_frames.sort(key=lambda f: f.source_index)
        return kept_frames, warnings

    # Proceed with duplicate filtering on sharp candidates
    last_kept = None
    
    for i, c in enumerate(sharp_candidates):
        f = c["frame"]
        
        # Keep first
        if not kept_frames:
            kept_frames.append(f)
            last_kept = f.image
            continue
            
        # Keep last (we'll ensure this at the end)
        if i == len(sharp_candidates) - 1:
            # Always add the last one unless it's an exact duplicate of the immediately preceding one
            if not _is_duplicate(f.image, last_kept, settings.DUPLICATE_HASH_THRESHOLD):
                kept_frames.append(f)
            break
            
        if not _is_duplicate(f.image, last_kept, settings.DUPLICATE_HASH_THRESHOLD):
            kept_frames.append(f)
            last_kept = f.image

        if len(kept_frames) >= settings.MAX_EXTRACTED_FRAMES - 1:
            # Leave room for the last frame
            break

    # Ensure last usable frame is included if not already (and if we have room/didn't hit cap)
    last_usable = sharp_candidates[-1]["frame"]
    if last_usable.source_index != kept_frames[-1].source_index and len(kept_frames) < settings.MAX_EXTRACTED_FRAMES:
        if not _is_duplicate(last_usable.image, kept_frames[-1].image, settings.DUPLICATE_HASH_THRESHOLD):
            kept_frames.append(last_usable)

    if len(kept_frames) < 3:
        warnings.append("Few distinct video frames; reconstruction may fail. Upload more angles or a slower orbit.")
        
    return kept_frames[:settings.MAX_EXTRACTED_FRAMES], warnings
