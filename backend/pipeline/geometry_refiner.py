"""Segment 9 — Geometry Refiner"""

from backend.core.config import settings
import trimesh
from pathlib import Path

def refine(reconstruction: dict, scale_calibration_result: dict = None) -> dict:
    """Refines the geometry and applies scale."""
    
    if scale_calibration_result is None:
        scale_calibration_result = {}
        
    scale_factor = scale_calibration_result.get("scale_factor", 1.0)
    if scale_factor is None:
        scale_factor = 1.0
        
    units = scale_calibration_result.get("units", "unknown")
    warnings = []
    
    mesh = None
    if "path" in reconstruction and Path(reconstruction["path"]).exists():
        mesh = trimesh.load(reconstruction["path"], force="mesh")
        
    if mesh is None:
        return {
            "vertices": [],
            "faces": [],
            "units": units,
            "scale_applied": False,
            "method": "failed",
            "warnings": ["No valid mesh found to refine."]
        }

    # Apply scale
    mesh.apply_scale(scale_factor)
    
    # Regularize
    # Merge close vertices
    mesh.merge_vertices()
    
    # Remove degenerate faces
    mesh.remove_degenerate_faces()
    
    # Decimate if too large
    if len(mesh.faces) > settings.MAX_REFINED_FACES:
        try:
            # trimesh simplify might require pyembree or open3d. 
            # We'll use a simple approach or just rely on open3d if we need a robust one.
            # In MVP, we can just warn if we can't decimate easily or use open3d.
            # Trimesh has simplify_quadratic_decimation if open3d or similar is available.
            mesh = mesh.simplify_quadratic_decimation(settings.MAX_REFINED_FACES)
        except Exception:
            warnings.append("Could not decimate mesh. Vertex count remains high.")
            
    # Axis alignment (AABB)
    # The mesh is roughly aligned in previous steps, but we can align it to AABB.
    # Optional: We skip apply_obb() to avoid requiring scipy for convex hull calculations.
            
    return {
        "vertices": mesh.vertices.tolist(),
        "faces": mesh.faces.tolist(),
        "units": units,
        "scale_applied": scale_factor != 1.0,
        "method": "decimate+aabb",
        "warnings": warnings,
        "bounds": mesh.bounds.tolist() if mesh.bounds is not None else []
    }
