"""Segment 9 — Drawing Generator"""

def generate(cad: dict, measurements: list) -> dict:
    """Generates a 2D orthographic drawing JSON from CAD solids and measurements."""
    
    units = cad.get("units", "unknown")
    
    # Init views
    front_view = {"name": "front", "lines": [], "circles": [], "dimensions": []}
    top_view = {"name": "top", "lines": [], "circles": [], "dimensions": []}
    side_view = {"name": "side", "lines": [], "circles": [], "dimensions": []}
    
    # We will generate lines based on the box solid if it exists
    solids = cad.get("solids", [])
    box = next((s for s in solids if s["kind"] == "box"), None)
    
    if box:
        params = box["params"]
        w = params["w"]
        h = params["h"]
        d = params["d"]
        ox, oy, oz = params["origin"]
        
        # Front (XY)
        # We'll just draw a rectangle centered at 0,0 for simplicity, or use true origin
        x1, x2 = ox - w/2, ox + w/2
        y1, y2 = oy - h/2, oy + h/2
        z1, z2 = oz - d/2, oz + d/2
        
        front_view["lines"].extend([
            {"x1": x1, "y1": y1, "x2": x2, "y2": y1, "role": "outline", "level": "estimated"},
            {"x1": x2, "y1": y1, "x2": x2, "y2": y2, "role": "outline", "level": "estimated"},
            {"x1": x2, "y1": y2, "x2": x1, "y2": y2, "role": "outline", "level": "estimated"},
            {"x1": x1, "y1": y2, "x2": x1, "y2": y1, "role": "outline", "level": "estimated"},
        ])
        
        # Top (XZ) -> mapped to 2D
        top_view["lines"].extend([
            {"x1": x1, "y1": z1, "x2": x2, "y2": z1, "role": "outline", "level": "estimated"},
            {"x1": x2, "y1": z1, "x2": x2, "y2": z2, "role": "outline", "level": "estimated"},
            {"x1": x2, "y1": z2, "x2": x1, "y2": z2, "role": "outline", "level": "estimated"},
            {"x1": x1, "y1": z2, "x2": x1, "y2": z1, "role": "outline", "level": "estimated"},
        ])
        
        # Side (YZ) -> mapped to 2D
        side_view["lines"].extend([
            {"x1": z1, "y1": y1, "x2": z2, "y2": y1, "role": "outline", "level": "estimated"},
            {"x1": z2, "y1": y1, "x2": z2, "y2": y2, "role": "outline", "level": "estimated"},
            {"x1": z2, "y1": y2, "x2": z1, "y2": y2, "role": "outline", "level": "estimated"},
            {"x1": z1, "y1": y2, "x2": z1, "y2": y1, "role": "outline", "level": "estimated"},
        ])
    
    # Process Holes (draw circles)
    for hole in cad.get("holes", []):
        if hole["level"] == "low":
            continue # Omit low confidence holes
            
        r = hole["diameter"] / 2.0
        # Assume hole is along Y axis (visible from top view)
        top_view["circles"].append({
            "cx": 0, "cy": 0, "r": r, "role": "hole", "level": hole["level"]
        })
        
    # Process Dimensions
    for m in measurements:
        level = m.get("level", "low")
        if level == "low":
            continue # Omit low confidence dimensions
            
        label = m.get("label", "").lower()
        val = m.get("value", 0.0)
        
        if val is None:
            continue
            
        text = f"{val:.2f}" if level == "measured" else f"{val:.1f} \u00B1{m.get('tolerance', 0.0):.1f}"
        
        # Assign dimension to a view based on label
        dim_obj = {
            "kind": "linear",
            "text": text,
            "level": level
        }
        
        if "width" in label:
            dim_obj["a"] = [x1, y1] if box else [0, 0]
            dim_obj["b"] = [x2, y1] if box else [val, 0]
            front_view["dimensions"].append(dim_obj)
        elif "height" in label:
            dim_obj["a"] = [x1, y1] if box else [0, 0]
            dim_obj["b"] = [x1, y2] if box else [0, val]
            front_view["dimensions"].append(dim_obj)
        elif "depth" in label:
            dim_obj["a"] = [z1, y1] if box else [0, 0]
            dim_obj["b"] = [z2, y1] if box else [val, 0]
            side_view["dimensions"].append(dim_obj)
            
    # Position views so they don't overlap in DXF
    # Top view moves up (Y+)
    # Side view moves right (X+)
    offset_y = h * 1.5 if box else 100
    offset_x = w * 1.5 if box else 100
    
    for line in top_view["lines"]:
        line["y1"] += offset_y
        line["y2"] += offset_y
    for dim in top_view["dimensions"]:
        dim["a"][1] += offset_y
        dim["b"][1] += offset_y
    for c in top_view["circles"]:
        c["cy"] += offset_y
        
    for line in side_view["lines"]:
        line["x1"] += offset_x
        line["x2"] += offset_x
    for dim in side_view["dimensions"]:
        dim["a"][0] += offset_x
        dim["b"][0] += offset_x
    for c in side_view["circles"]:
        c["cx"] += offset_x
        
    return {
        "units": units,
        "projection": "third_angle",
        "views": {
            "front": front_view,
            "top": top_view,
            "side": side_view
        },
        "title_block": {
            "project": "CAD AI",
            "part": "reconstruction",
            "scale": "1:1",
            "units": units,
            "note": "AI-assisted reconstruction — not a metrology record"
        }
    }
