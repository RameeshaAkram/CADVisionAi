"""Segment 8 — Scale Calibration (2D)."""

def calibrate(features: dict, known_dimensions: list, units: str) -> dict:
    """Calculate pixel-to-real-world scale based on a known dimension."""
    if not known_dimensions:
        return {
            "scale_factor": 1.0,
            "units": units,
            "measurements": [],
            "warnings": ["No known dimension provided. The drawing will be exported in pixel units."]
        }
        
    contours = features.get("contours", [])
    outer_contour = next((c for c in contours if c["role"] == "outer"), None)
    
    if not outer_contour or not outer_contour.get("points"):
        return {
            "scale_factor": 1.0,
            "units": units,
            "measurements": [],
            "warnings": ["No outer contour found to calibrate against."]
        }
        
    points = outer_contour["points"]
    min_x = min(p["x"] for p in points)
    max_x = max(p["x"] for p in points)
    min_y = min(p["y"] for p in points)
    max_y = max(p["y"] for p in points)
    
    pixel_width = max_x - min_x
    pixel_height = max_y - min_y
    
    # We use the first known dimension provided by the user.
    kd = known_dimensions[0]
    
    # Simple heuristic: if label says "height", we map to height, else width
    if "height" in kd["label"].lower() or "tall" in kd["label"].lower():
        pixel_val = pixel_height
        axis = "y"
    else:
        pixel_val = pixel_width
        axis = "x"
        
    if pixel_val <= 0:
        return {
            "scale_factor": 1.0,
            "units": units,
            "measurements": [],
            "warnings": ["Invalid pixel dimension for calibration."]
        }
        
    scale_factor = kd["value"] / pixel_val
    
    measurements = [
        {"id": "dim-1", "label": "Overall Width", "value": pixel_width * scale_factor, "level": "measured"},
        {"id": "dim-2", "label": "Overall Height", "value": pixel_height * scale_factor, "level": "measured"}
    ]
    
    return {
        "scale_factor": scale_factor,
        "units": units,
        "measurements": measurements,
        "warnings": []
    }
