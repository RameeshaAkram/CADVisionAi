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
    
    def dimension_for(axis: str) -> dict | None:
        keywords = ("height", "tall") if axis == "y" else ("width", "length")
        return next((d for d in known_dimensions if any(k in d["label"].lower() for k in keywords)), None)

    x_dimension = dimension_for("x")
    y_dimension = dimension_for("y")
    reference = x_dimension or y_dimension or known_dimensions[0]
    if reference is y_dimension and not x_dimension:
        scale_x = scale_y = reference["value"] / pixel_height
    elif x_dimension:
        scale_x = x_dimension["value"] / pixel_width
        scale_y = y_dimension["value"] / pixel_height if y_dimension else scale_x
    else:
        scale_x = scale_y = reference["value"] / pixel_width

    if scale_x <= 0 or scale_y <= 0:
        return {
            "scale_factor": 1.0,
            "units": units,
            "measurements": [],
            "warnings": ["Invalid pixel dimension for calibration."]
        }
        
    scale_factor = scale_x
    x_label = "Overall Length" if x_dimension and "length" in x_dimension["label"].lower() else "Overall Width"
    y_label = "Overall Height" if y_dimension else "Overall Width"
    measurements = [
        {"id": "dim-1", "label": x_label, "value": pixel_width * scale_x, "level": "measured" if x_dimension else "estimated", "units": units, "source": "user_known" if x_dimension else "inferred", "glyph": "●" if x_dimension else "◐"},
        {"id": "dim-2", "label": y_label, "value": pixel_height * scale_y, "level": "measured" if y_dimension else "estimated", "units": units, "source": "user_known" if y_dimension else "inferred", "glyph": "●" if y_dimension else "◐"}
    ]
    
    return {
        "scale_factor": scale_factor,
        "scale_x": scale_x,
        "scale_y": scale_y,
        "units": units,
        "measurements": measurements,
        "warnings": []
    }
