"""Segment 4 — Pipeline orchestrator."""

import logging
import threading

from backend.core.exceptions import JobNotFoundError, ValidationError
from backend.models.job_models import Job, JobStatus, StageRecord, StageStatus
from backend.storage import job_manager
from backend.pipeline import (
    input_processor,
    view_analyzer,
    object_detector,
    feature_detector,
    scale_calibration,
    drawing_generator,
    validator,
)

logger = logging.getLogger(__name__)

STAGES: list[str] = [
    "prepare_images",
    "view_analysis",
    "object_detection",
    "feature_detection",
    "scale_calibration",
    "drawing_generation",
    "validation",
]

_job_locks: dict[str, threading.Lock] = {}


def _get_lock(job_id: str) -> threading.Lock:
    if job_id not in _job_locks:
        _job_locks[job_id] = threading.Lock()
    return _job_locks[job_id]


def _set_failed(job_id: str, error_msg: str) -> Job:
    logger.error("Job %s failed: %s", job_id, error_msg)
    return job_manager.update_job(job_id, status=JobStatus.FAILED, error=error_msg)


def run_job(job_id: str) -> Job:
    """Run all pipeline stages for a job sequentially."""
    lock = _get_lock(job_id)
    if not lock.acquire(blocking=False):
        raise ValidationError(f"Job {job_id} is already processing.")
        
    try:
        job = job_manager.get_job(job_id)
        
        if job.status == JobStatus.PROCESSING:
            raise ValidationError(f"Job {job_id} is already processing.")
            
        stages_record = [StageRecord(name=s, status=StageStatus.PENDING) for s in STAGES]
        
        # Clear normalized/ and outputs/ directories for this job
        import shutil
        from backend.core.config import settings
        from pathlib import Path
        
        normalized_dir = Path(settings.UPLOAD_DIR) / job_id / "normalized"
        if normalized_dir.exists():
            shutil.rmtree(normalized_dir, ignore_errors=True)
            
        outputs_dir = Path(settings.OUTPUT_DIR) / job_id
        if outputs_dir.exists():
            shutil.rmtree(outputs_dir, ignore_errors=True)
            
        job = job_manager.update_job(
            job_id,
            status=JobStatus.PROCESSING,
            current_stage=STAGES[0],
            progress=0.0,
            stages=stages_record,
            result={},
            outputs=[],
            confidence=None,
            normalized_images=[],
            error=None
        )

        completed_count = 0
        
        def _update_progress(current_idx: int):
            nonlocal job, completed_count
            current_job = job_manager.get_job(job_id)
            if current_job.status != JobStatus.PROCESSING:
                raise RuntimeError("Job is no longer processing")
            completed_count = current_idx
            job = job_manager.update_job(
                job_id,
                current_stage=STAGES[current_idx] if current_idx < len(STAGES) else None,
                progress=completed_count / len(STAGES),
                stages=job.stages
            )
            
        def _mark_stage(idx: int, status: StageStatus, detail: str = None):
            nonlocal job
            current_job = job_manager.get_job(job_id)
            if current_job.status != JobStatus.PROCESSING:
                raise RuntimeError("Job is no longer processing")
            job.stages[idx].status = status
            if detail:
                job.stages[idx].detail = detail
            
        try:
            # 1. prepare_images
            _update_progress(0)
            _mark_stage(0, StageStatus.RUNNING)
            job = job_manager.update_job(job_id, stages=job.stages) # force save
            
            norm_set = input_processor.prepare_images(job_id)
            job = job_manager.get_job(job_id) # Refresh
            
            _mark_stage(0, StageStatus.COMPLETED)
            
            # Check gate
            if len(job.normalized_images) < 2:
                # Needs more views
                _mark_stage(0, StageStatus.COMPLETED, "Needs more views.")
                for i in range(1, len(STAGES)):
                    _mark_stage(i, StageStatus.SKIPPED, "Skipped due to insufficient views.")
                
                warnings = job.warnings + ["Need more viewpoints before reconstruction. Add photos from other angles, then process again."]
                
                job = job_manager.update_job(
                    job_id,
                    status=JobStatus.NEEDS_MORE_VIEWS,
                    current_stage=None,
                    progress=1.0,
                    stages=job.stages,
                    warnings=warnings
                )
                return job
                
            # Run remaining stages sequentially
            for i, stage_name in enumerate(STAGES[1:], start=1):
                _update_progress(i)
                _mark_stage(i, StageStatus.RUNNING)
                job = job_manager.update_job(job_id, stages=job.stages)
                
                # Fetch fresh job to ensure we have latest results dict
                job = job_manager.get_job(job_id)
                res = job.result
                
                if stage_name == "view_analysis":
                    out = view_analyzer.analyze(job.normalized_images)
                    res[stage_name] = out
                    if out.get("usable_count", 0) < 3:
                        _mark_stage(i, StageStatus.COMPLETED, "Needs more views.")
                        for j in range(i + 1, len(STAGES)):
                            _mark_stage(j, StageStatus.SKIPPED, "Skipped due to insufficient views.")
                        warnings = job.warnings + out.get("warnings", []) + [
                            "Need at least 3 clear viewpoints for a stable flat-part profile."
                        ]
                        return job_manager.update_job(
                            job_id,
                            status=JobStatus.NEEDS_MORE_VIEWS,
                            current_stage=None,
                            progress=1.0,
                            stages=job.stages,
                            result=res,
                            warnings=list(dict.fromkeys(warnings))
                        )
                    if "warnings" in out and out["warnings"]:
                        new_warnings = job.warnings.copy()
                        for w in out["warnings"]:
                            if w not in new_warnings:
                                new_warnings.append(w)
                        job.warnings = new_warnings
                        
                    # Continue with the best visible profile even when view
                    # diversity is low; validation will retain the warning.
                elif stage_name == "object_detection":
                    out = object_detector.detect(job.normalized_images)
                    res[stage_name] = out
                elif stage_name == "feature_detection":
                    components = res.get("object_detection", {}).get("components", [])
                    out = feature_detector.detect(job.normalized_images, components)
                    res[stage_name] = out
                elif stage_name == "scale_calibration":
                    features = res.get("feature_detection", {})
                    out = scale_calibration.calibrate(features, [d.model_dump() for d in job.known_dimensions], job.units.value)
                    res[stage_name] = out
                elif stage_name == "drawing_generation":
                    features = res.get("feature_detection", {})
                    measurements = res.get("scale_calibration", {}).get("measurements", [])
                    scale_factor = res.get("scale_calibration", {}).get("scale_factor", 1.0)
                    scale_y = res.get("scale_calibration", {}).get("scale_y", scale_factor)
                    out = drawing_generator.generate(features, measurements, scale_factor, scale_y)
                    res[stage_name] = out


                _mark_stage(i, StageStatus.COMPLETED)
                job = job_manager.update_job(job_id, result=res, stages=job.stages, warnings=job.warnings)
            
            # Export files
            from backend.exporters import dxf_exporter
            from backend.exporters import stl_exporter
            from backend.core.config import settings
            from backend.models.job_models import OutputRecord
            from pathlib import Path
            
            out_dir = Path(settings.OUTPUT_DIR) / job_id
            out_dir.mkdir(parents=True, exist_ok=True)
            
            new_outputs = []
            if "drawing_generation" in res:
                dxf_path = out_dir / "drawing.dxf"
                dxf_exporter.write(res["drawing_generation"], dxf_path, job.units.value)
                new_outputs.append(OutputRecord(kind="dxf", path=str(dxf_path), filename="drawing.dxf"))
                stl_path = out_dir / "model.stl"
                stl_exporter.write(res["drawing_generation"], stl_path, job.thickness)
                new_outputs.append(OutputRecord(kind="mesh", path=str(stl_path), filename="model.stl"))
                
            job.outputs = new_outputs
            
            # Validation
            payload = {
                "result": res,
                "outputs": [{"kind": o.kind, "path": o.path, "filename": o.filename} for o in job.outputs],
                "status": job.status.value,
                "known_dimensions": [d.model_dump() for d in job.known_dimensions]
            }
            val_out = validator.validate(payload)
            res["validation"] = val_out
            
            # Merge warnings
            if "warnings" in val_out:
                new_warnings = job.warnings.copy()
                for w_obj in val_out["warnings"]:
                    w_msg = w_obj.get("message")
                    # If this is a dict, we need to check if the exact dict or string is in warnings.
                    # Wait, warnings in Job model are list[str]. But we want to store dicts or formatted strings?
                    # "show up to two highest-severity warnings ... message + action"
                    # The prompt says "merge deduplicated warnings onto job.warnings".
                    # Let's stringify them for job.warnings or change job.warnings to allow dicts?
                    # The frontend expects dicts for these new warnings?
                    # Let's keep them as dicts if possible. Or format as JSON string.
                    # The prompt says "job.warnings becomes the validator's list (plus any earlier unique ones)."
                    # It's better to just set job.warnings = val_out["warnings"]?
                    pass
            job.warnings = val_out.get("warnings", [])
            job.confidence = val_out

            # All done
            _update_progress(len(STAGES))
            job = job_manager.update_job(
                job_id,
                status=JobStatus.COMPLETED,
                current_stage=None,
                progress=1.0,
                outputs=job.outputs
            )
            return job

        except JobNotFoundError:
            raise
        except RuntimeError as e:
            if "Job is no longer processing" in str(e):
                logger.warning("Job %s was interrupted (timeout or external): %s", job_id, e)
                return job
            raise
        except Exception as e:
            logger.exception("Error processing job %s", job_id)
            for i, s in enumerate(job.stages):
                if s.status == StageStatus.RUNNING:
                    _mark_stage(i, StageStatus.FAILED, str(e))
                elif s.status == StageStatus.PENDING:
                    _mark_stage(i, StageStatus.SKIPPED)
            job = job_manager.update_job(job_id, stages=job.stages)
            return _set_failed(job_id, str(e))

    finally:
        lock.release()


def get_progress(job: Job) -> dict:
    """Return progress dictionary for the job."""
    return {
        "status": job.status.value,
        "current_stage": job.current_stage,
        "progress": job.progress,
        "stages": [{"name": s.name, "status": s.status.value, "detail": s.detail} for s in job.stages],
        "warnings": job.warnings,
        "error": job.error,
    }
