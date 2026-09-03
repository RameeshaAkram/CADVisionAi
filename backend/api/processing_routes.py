"""Processing and polling routes.

POST /api/jobs/{job_id}/process — start background processing
GET  /api/jobs/{job_id}/status  — get detailed progress
"""

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from pathlib import Path

from backend.core.exceptions import JobNotFoundError, ValidationError
from backend.models.job_models import JobStatus
from backend.models.schemas import JobPublic, ProcessAccepted
from backend.storage import job_manager
from backend.pipeline import orchestrator

router = APIRouter(tags=["processing"])


@router.post("/jobs/{job_id}/process", response_model=ProcessAccepted, status_code=202)
async def process_job(job_id: str, background_tasks: BackgroundTasks):
    """Start the pipeline for a job."""
    job = job_manager.get_job(job_id)
    if job.status == JobStatus.PROCESSING:
        raise ValidationError(f"Job {job_id} is already processing.", status_code=409)
        
    from backend.core.config import settings
    processing_jobs = job_manager.list_jobs(limit=100, status="processing")
    if len(processing_jobs) >= settings.MAX_CONCURRENT_JOBS:
        raise ValidationError("A job is already processing. Wait until it finishes.", status_code=409)
        
    allowed_statuses = {
        JobStatus.UPLOADED, 
        JobStatus.NEEDS_MORE_VIEWS, 
        JobStatus.COMPLETED, 
        JobStatus.FAILED
    }
    if job.status not in allowed_statuses:
        raise ValidationError(f"Cannot process job in '{job.status.value}' status", status_code=400)
        
    if not job.files:
        raise ValidationError(f"Job {job_id} has no uploaded files to process.", status_code=400)
    import threading
    import time
    import asyncio
    from datetime import datetime, timezone
    from backend.core.config import settings
    
    def run_worker():
        start_time = time.time()
        done = threading.Event()
        
        def worker_thread():
            try:
                orchestrator.run_job(job_id)
            except Exception:
                pass
            finally:
                done.set()
                
        t = threading.Thread(target=worker_thread, daemon=True)
        t.start()
        
        while not done.wait(timeout=settings.HEARTBEAT_SEC):
            current = job_manager.get_job(job_id)
            if current.status != JobStatus.PROCESSING:
                break
            # Update heartbeat
            job_manager.update_job(job_id, updated_at=datetime.now(timezone.utc).isoformat())
            if time.time() - start_time > settings.RECON_TIMEOUT_SEC:
                job_manager.update_job(
                    job_id, 
                    status=JobStatus.FAILED, 
                    error="Reconstruction timed out. Try fewer or sharper photos."
                )
                break

    background_tasks.add_task(asyncio.to_thread, run_worker)

    return ProcessAccepted(job_id=job_id, status="processing")

@router.get("/jobs")
async def list_jobs(limit: int = 50, status: str | None = None):
    """List all jobs."""
    jobs = job_manager.list_jobs(limit=limit, status=status)
    from backend.api.upload_routes import _job_to_public
    # We map them to dicts, possibly adding a thumbnail URL
    results = []
    for j in jobs:
        pub = _job_to_public(j).model_dump()
        pub["created_at"] = j.created_at
        pub["updated_at"] = j.updated_at
        pub["thumbnail_url"] = None
        
        # Try to find a valid image to use as a thumbnail
        if j.files:
            for f in j.files:
                if f.kind == "image":
                    pub["thumbnail_url"] = f"/api/jobs/{j.job_id}/files/{f.filename}"
                    break
        results.append(pub)
        
    return {"jobs": results}


@router.get("/jobs/{job_id}/preview")
async def get_job_preview(job_id: str):
    """Get the 3D reconstruction preview file."""
    job = job_manager.get_job(job_id)
    if job.status in (JobStatus.PROCESSING, JobStatus.NEEDS_MORE_VIEWS, JobStatus.FAILED):
        # We allow fallback meshes even if status is needs_more_views? No, prompt says:
        # "409 if status is processing / needs_more_views / failed without a mesh"
        # Wait, if there's no mesh we 404 or 409. Let's just check if mesh exists.
        pass
        
    recon = job.result.get("reconstruction", {})
    preview_path = recon.get("preview_path")
    
    if not preview_path or not Path(preview_path).exists():
        if job.status in (JobStatus.PROCESSING, JobStatus.NEEDS_MORE_VIEWS, JobStatus.FAILED):
            raise ValidationError(f"Preview not available. Job status: {job.status.value}", status_code=409)
        raise ValidationError("Preview not found.", status_code=404)
        
    media_type = "model/gltf-binary" if str(preview_path).endswith(".glb") else "text/plain"
    return FileResponse(preview_path, media_type=media_type)



@router.get("/jobs/{job_id}/status")
async def get_job_status(job_id: str):
    """Get the current progress and status of a job."""
    job = job_manager.get_job(job_id)
    
    res = job.result or {}
    coverage = res.get("view_analysis", {}).get("coverage", {})
    feature_counts = res.get("feature_detection", {}).get("counts", {})
    total_features = sum(feature_counts.values()) if feature_counts else None

    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "current_stage": job.current_stage,
        "progress": job.progress,
        "stages": [{"name": s.name, "status": s.status.value, "detail": s.detail} for s in job.stages],
        "warnings": job.warnings,
        "error": job.error,
        "file_count": len(job.files),
        "normalized_count": len(job.normalized_images),
        "coverage_score": coverage.get("score"),
        "coverage_gaps": coverage.get("gaps"),
        "usable_count": res.get("view_analysis", {}).get("usable_count"),
        "feature_count": total_features,
        "object_found": res.get("object_detection", {}).get("object_found"),
        "view_warnings": res.get("view_analysis", {}).get("warnings", []),
        "preview_url": f"/api/jobs/{job.job_id}/preview" if res.get("reconstruction", {}).get("preview_path") else None,
        "confidence": res.get("reconstruction", {}).get("confidence"),
        "reconstruction_warnings": res.get("reconstruction", {}).get("warnings", []),
        "measurements": res.get("scale_calibration", {}).get("measurements", []),
        "scale": res.get("scale_calibration", {}),
        "assembly": res.get("assembly"),
    }
