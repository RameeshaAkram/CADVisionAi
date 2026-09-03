import pytest
import trimesh
from backend.exporters import mesh_exporter

def test_mesh_exporter(tmp_path):
    # Dummy mesh
    mesh = trimesh.creation.box(extents=(2, 2, 2))
    
    refined = {
        "vertices": mesh.vertices.tolist(),
        "faces": mesh.faces.tolist()
    }
    
    out_path = tmp_path / "model.stl"
    mesh_exporter.write_scaled_mesh(refined, out_path)
    
    assert out_path.exists()
    assert out_path.stat().st_size > 0
    
    # Verify we can load it back
    loaded = trimesh.load(out_path)
    assert len(loaded.vertices) > 0
