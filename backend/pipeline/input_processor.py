"""Segment 3 — Input processor: normalizes uploads into a unified image collection."""

import logging
import shutil
from pathlib import Path

from backend.core.config import settings
from backend.core.exceptions import JobNotFoundError, ValidationError
from backend.models.job_models import (
    JobMode,
    NormalizedImage,
    NormalizedImageSet,
    SkippedImage,
)
from backend.pipeline import frame_extractor, image_preprocessor
from backend.storage import file_manager, job_manager
from backend.utils import image_utils

logger = logging.getLogger(__name__)


def prepare_images(job_id: str) -> NormalizedImageSet:
    """Normalize uploaded files into a standard image collection for the pipeline."""
    job = job_manager.get_job(job_id)

    if not job.files:
        raise ValidationError("Job has no uploaded files to process.")

    norm_dir = file_manager.job_dir(job_id) / "normalized"
    
    # Idempotent: clear if exists
    if norm_dir.exists():
        shutil.rmtree(norm_dir)
    norm_dir.mkdir(parents=True, exist_ok=True)

    normalized_images: list[NormalizedImage] = []
    skipped: list[SkippedImage] = []
    warnings: list[str] = list(job.warnings)

    out_idx = 1
    
    if job.mode == JobMode.VIDEO:
        frames, ext_warnings = frame_extractor.extract(job)
        for w in ext_warnings:
            if w not in warnings:
                warnings.append(w)
                
        for f in frames:
            try:
                processed = image_preprocessor.process(f.image)
                filename = f"{out_idx:04d}.jpg"
                out_path = norm_dir / filename
                image_utils.save_image(str(out_path), processed)
                
                h, w = processed.shape[:2]
                sharpness = image_utils.sharpness_score(processed)
                
                normalized_images.append(NormalizedImage(
                    index=out_idx,
                    filename=filename,
                    stored_path=str(out_path),
                    width=w,
                    height=h,
                    sharpness=sharpness
                ))
                out_idx += 1
            except Exception as e:
                skipped.append(SkippedImage(reason="process_error", detail=str(e)))
                
    elif job.mode == JobMode.PHOTO:
        for f_meta in job.files:
            if f_meta.kind != "image":
                skipped.append(SkippedImage(reason="wrong_kind", detail=f"Skipping non-image {f_meta.filename}"))
                continue
                
            try:
                img = image_utils.load_image(f_meta.stored_path)
                processed = image_preprocessor.process(img)
                
                filename = f"{out_idx:04d}.jpg"
                out_path = norm_dir / filename
                image_utils.save_image(str(out_path), processed)
                
                h, w = processed.shape[:2]
                sharpness = image_utils.sharpness_score(processed)
                
                normalized_images.append(NormalizedImage(
                    index=out_idx,
                    filename=filename,
                    stored_path=str(out_path),
                    width=w,
                    height=h,
                    sharpness=sharpness
                ))
                out_idx += 1
            except Exception as e:
                skipped.append(SkippedImage(reason="load_error", detail=f"Failed to process {f_meta.filename}: {e}"))

    # Update job with new fields
    job = job_manager.update_job(
        job_id,
        normalized_images=normalized_images,
        normalize_warnings=warnings
    )

    return NormalizedImageSet(
        job_id=job_id,
        source=job.mode.value,
        images=normalized_images,
        skipped=skipped,
        warnings=warnings
    )
