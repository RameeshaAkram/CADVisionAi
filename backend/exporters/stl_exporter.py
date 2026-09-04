"""Create a simple extruded STL for the flat-part MVP."""

from pathlib import Path

import trimesh
from shapely.geometry import Polygon


def write(drawing_json: dict, path: str | Path, thickness: float = 1.0) -> str:
    """Extrude the outer contour and subtract its hole contours."""
    path = Path(path)
    top = drawing_json.get("views", {}).get("top", {})
    polylines = top.get("polylines", [])
    outer = next((p for p in polylines if p.get("role") == "outer"), None)
    if not outer or len(outer.get("points", [])) < 3:
        raise ValueError("A closed outer contour is required for STL export.")

    shell = [(p["x"], p["y"]) for p in outer["points"]]
    holes = [
        [(p["x"], p["y"]) for p in poly["points"]]
        for poly in polylines
        if poly.get("role") == "hole" and len(poly.get("points", [])) >= 3
    ]
    solid = trimesh.creation.extrude_polygon(Polygon(shell, holes), height=thickness)
    solid.export(path, file_type="stl")
    return str(path)