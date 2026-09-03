"""Segment 10 — Export routes (download DXF, mesh, CAD files)."""

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.storage import job_manager
from backend.core.exceptions import JobNotFoundError
from backend.models.schemas import ExportsResponse, ExportFile

router = APIRouter()

@router.get("/jobs/{job_id}/exports", response_model=ExportsResponse, tags=["exports"])
def get_job_exports(job_id: str) -> ExportsResponse:
    """Lists the available export files for a job."""
    try:
        job = job_manager.get_job(job_id)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail="Job not found")

    files = []
    
    # We map kinds to descriptions
    desc_map = {
        "dxf": "2D orthographic drawing",
        "mesh": "3D mesh for CAD/viewers"
    }
    
    # If the job hasn't recorded outputs, maybe it's not done or didn't produce them.
    # The prompt says: "If a file is not on disk yet, ready: false, url null, omit size."
    # Since outputs are recorded in job.outputs when generated, we can iterate over them.
    # But wait, the frontend might expect standard files to appear as pending?
    # Actually, if we just list what's in job.outputs, it's fine.
    # But wait, the prompt says "If a file is not on disk yet, ready: false...".
    # This implies we might need to expose the expected files even if not ready.
    # The expected files are "drawing.dxf" and "model.stl".
    
    expected_exports = [
        {"kind": "dxf", "filename": "drawing.dxf"},
        {"kind": "mesh", "filename": "model.stl"}
    ]
    
    outputs_by_kind = {o.kind: o for o in job.outputs}
    
    for exp in expected_exports:
        kind = exp["kind"]
        filename = exp["filename"]
        
        if kind in outputs_by_kind:
            output = outputs_by_kind[kind]
            path = Path(output.path)
            if path.exists():
                files.append(ExportFile(
                    kind=kind,
                    filename=filename,
                    url=f"/api/jobs/{job_id}/exports/{filename}",
                    ready=True,
                    size=path.stat().st_size,
                    description=desc_map.get(kind, "")
                ))
            else:
                files.append(ExportFile(
                    kind=kind,
                    filename=filename,
                    url=None,
                    ready=False,
                    description=desc_map.get(kind, "")
                ))
        else:
            files.append(ExportFile(
                kind=kind,
                filename=filename,
                url=None,
                ready=False,
                description=desc_map.get(kind, "")
            ))
            
    return ExportsResponse(files=files)

@router.get("/jobs/{job_id}/exports/{filename}", tags=["exports"])
def download_export(job_id: str, filename: str):
    """Streams an export file."""
    try:
        job = job_manager.get_job(job_id)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status.value != "completed":
        raise HTTPException(status_code=409, detail="Job not completed")

    # Find the output record matching the filename
    output = next((o for o in job.outputs if o.filename == filename), None)
    if not output:
        raise HTTPException(status_code=404, detail="File not found")

    path = Path(output.path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    media_type = "application/dxf" if filename.endswith(".dxf") else "model/stl"
    
    return FileResponse(
        path=path,
        media_type=media_type,
        filename=filename,
        content_disposition_type="attachment"
    )

@router.get("/jobs/{job_id}/drawing", tags=["exports"])
def get_job_drawing(job_id: str):
    """Returns the drawing JSON."""
    try:
        job = job_manager.get_job(job_id)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail="Job not found")

    drawing = job.result.get("drawing_generation")
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not available")

    return drawing
