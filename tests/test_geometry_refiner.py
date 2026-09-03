import pytest
import numpy as np
import trimesh
from backend.pipeline import geometry_refiner

def test_geometry_refiner(tmp_path):
    # Create a dummy mesh
    mesh = trimesh.creation.box(extents=(1, 1, 1))
    mesh_path = tmp_path / "test_mesh.stl"
    mesh.export(mesh_path)
    
    recon = {"path": str(mesh_path), "confidence": 0.8}
    scale_cal = {"scale_factor": 10.0, "units": "feet", "measurements": []}
    
    out = geometry_refiner.refine(recon, scale_cal)
    
    assert out["scale_applied"] is True
    assert out["units"] == "feet"
    assert "vertices" in out
    assert "faces" in out
    
    # Vertices should be scaled by 10. The original box extents were 1, so new should be 10.
    v = np.array(out["vertices"])
    extents = v.max(axis=0) - v.min(axis=0)
    assert np.allclose(extents, [10, 10, 10])
    
    # Ensure fail open works
    out_fail = geometry_refiner.refine({"path": "non_existent.stl"})
    assert out_fail["method"] == "failed"
    assert len(out_fail["warnings"]) > 0
