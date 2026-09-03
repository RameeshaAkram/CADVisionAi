"""Segment 9 — Drawing Generator."""

def generate(features: dict, measurements: list, scale_factor: float) -> dict:
    """Convert extracted pixel contours to scaled 2D drawing data."""
    
    views = {"top": {"polylines": [], "dimensions": measurements}}
    
    contours = features.get("contours", [])
    
    for contour in contours:
        points = contour.get("points", [])
        if not points:
            continue
            
        scaled_points = []
        for p in points:
            scaled_points.append({
                "x": p["x"] * scale_factor,
                "y": p["y"] * scale_factor
            })
            
        views["top"]["polylines"].append({
            "role": contour.get("role", "outer"),
            "is_closed": contour.get("is_closed", True),
            "points": scaled_points
        })
        
    return {
        "views": views,
        "title_block": {
            "title": "CADVision AI Export",
            "note": "AI-assisted reconstruction — verify all dimensions before cutting."
        }
    }
