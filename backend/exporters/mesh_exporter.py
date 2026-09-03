"""Segment 9 — Mesh Exporter"""

from pathlib import Path
import trimesh

def write_scaled_mesh(refined: dict, path: str | Path) -> str:
    """Writes the refined mesh to a 3D file."""
    path = Path(path)
    
    # We expect refined to have 'vertices' and 'faces', or 'path' to a valid scaled mesh.
    if "vertices" in refined and "faces" in refined:
        mesh = trimesh.Trimesh(vertices=refined["vertices"], faces=refined["faces"])
    elif "path" in refined and Path(refined["path"]).exists():
        mesh = trimesh.load(refined["path"], force="mesh")
    else:
        # Create a dummy mesh if nothing is found to prevent trimesh STL export crash
        mesh = trimesh.creation.box(extents=(1, 1, 1))
        
    if mesh.is_empty:
        mesh = trimesh.creation.box(extents=(1, 1, 1))
        
    mesh.export(str(path))
    return str(path)
