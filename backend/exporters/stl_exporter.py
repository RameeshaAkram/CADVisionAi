"""Create a simple extruded STL for the flat-part MVP.

Circle holes are rendered with 64 segments for a smooth circular cutout.
Non-circular holes (slots, rectangles) are rendered from their polyline points.
"""

import math
from pathlib import Path

import trimesh
from shapely.geometry import Polygon


def _circle_polygon(cx: float, cy: float, r: float, segments: int = 64) -> list[tuple[float, float]]:
    """Return a list of polygon vertices approximating a circle."""
    return [
        (cx + r * math.cos(2 * math.pi * i / segments),
         cy + r * math.sin(2 * math.pi * i / segments))
        for i in range(segments)
    ]


def write(drawing_json: dict, path: str | Path, thickness: float = 1.0) -> str:
    """Extrude the outer contour and subtract hole contours."""
    path = Path(path)
    top = drawing_json.get("views", {}).get("top", {})
    polylines = top.get("polylines", [])
    circles = top.get("circles", [])

    outer = next((p for p in polylines if p.get("role") == "outer"), None)
    if not outer or len(outer.get("points", [])) < 3:
        raise ValueError("A closed outer contour is required for STL export.")

    shell = [(p["x"], p["y"]) for p in outer["points"]]

    # Collect holes: polyline-based non-circular holes
    hole_polygons: list[list[tuple[float, float]]] = [
        [(p["x"], p["y"]) for p in poly["points"]]
        for poly in polylines
        if poly.get("role") == "hole" and len(poly.get("points", [])) >= 3
    ]

    # Add smooth circular holes from circle entities
    for circ in circles:
        if circ.get("role") == "hole" and circ.get("r", 0) > 0:
            hole_polygons.append(_circle_polygon(circ["cx"], circ["cy"], circ["r"]))

    solid = trimesh.creation.extrude_polygon(Polygon(shell, hole_polygons), height=thickness)
    solid.export(path, file_type="stl")
    return str(path)