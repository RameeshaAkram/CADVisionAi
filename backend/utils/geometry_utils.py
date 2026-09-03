"""Segment 8 — Geometry utilities: coordinate transforms, mesh helpers, unit conversion."""

def aabb_extents(bounds: dict) -> dict:
    """Return x, y, z extents from {"min": [x,y,z], "max": [x,y,z]}."""
    if not bounds or "min" not in bounds or "max" not in bounds:
        return {"x": 0.0, "y": 0.0, "z": 0.0}
    b_min, b_max = bounds["min"], bounds["max"]
    return {
        "x": max(0.0, float(b_max[0] - b_min[0])),
        "y": max(0.0, float(b_max[1] - b_min[1])),
        "z": max(0.0, float(b_max[2] - b_min[2]))
    }

def choose_axis(label: str, extents: dict) -> str | None:
    """
    Map label to x, y, or z assuming Y-up.
    height / overall height -> y
    width / length -> largest of (x, z) for width, other for length.
    """
    lbl = label.lower()
    
    if "height" in lbl:
        return "y"
        
    x_val = extents.get("x", 0.0)
    z_val = extents.get("z", 0.0)
    
    if "width" in lbl:
        return "x" if x_val >= z_val else "z"
    elif "depth" in lbl or "length" in lbl:
        return "z" if x_val >= z_val else "x"
        
    return None

def apply_scale(relative_value: float, scale_factor: float) -> float:
    return relative_value * scale_factor

def convert_units(value: float, from_u: str, to_u: str) -> float:
    # Stub: assume user units are used throughout for MVP
    return value
