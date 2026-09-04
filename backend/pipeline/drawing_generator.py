"""Segment 9 — Drawing Generator.

Converts pixel-space contours from feature_detector into a scaled 2D drawing
dict.  Circular contours (circularity >= CIRCULARITY_THRESHOLD) are emitted
as circle entities; all others remain as polylines.
"""

from backend.pipeline.circle_fitter import circle_from_contour


def generate(features: dict, measurements: list, scale_factor: float, scale_y: float | None = None) -> dict:
    """Convert extracted pixel contours to scaled 2D drawing data."""

    views = {"top": {"polylines": [], "circles": [], "dimensions": measurements}}

    contours = features.get("contours", [])
    scale_y = scale_y or scale_factor

    for contour in contours:
        points = contour.get("points", [])
        if not points:
            continue

        role = contour.get("role", "outer")

        # Only try circle fit for hole contours (outer contour stays as polyline)
        if role == "hole":
            circle = circle_from_contour(contour)
            if circle is not None:
                views["top"]["circles"].append({
                    "cx": circle["cx"] * scale_factor,
                    "cy": circle["cy"] * scale_y,
                    "r":  circle["r"]  * scale_factor,  # assume symmetric scaling for holes
                    "role": "hole",
                    "circularity": circle["circularity"],
                    "is_circle": True,
                })
                continue  # skip the polyline path

        # Fallback: scale and emit as polyline (outer contour, slots, rectangles)
        scaled_points = [
            {"x": p["x"] * scale_factor, "y": p["y"] * scale_y}
            for p in points
        ]
        views["top"]["polylines"].append({
            "role": role,
            "is_closed": contour.get("is_closed", True),
            "points": scaled_points,
        })

    return {
        "views": views,
        "title_block": {
            "title": "CADVision AI Export",
            "note": "AI-assisted reconstruction — not a metrology record. Verify all dimensions before cutting.",
        },
    }
