"""Segment 9 — CAD Generator"""

from backend.core.config import settings

def generate(refined: dict, measurements: list, features: dict = None) -> dict:
    """Generates CAD solids and holes from refined geometry and measurements."""
    
    solids = []
    holes = []
    warnings = []
    
    units = refined.get("units", "unknown")
    bounds = refined.get("bounds", [])
    
    # Simple volume heuristic for box fit
    # We check if a bounding box exists
    if len(bounds) == 2:
        min_pt, max_pt = bounds
        w = max_pt[0] - min_pt[0]
        h = max_pt[1] - min_pt[1]
        d = max_pt[2] - min_pt[2]
        
        # Check volume ratio or simply rely on settings threshold.
        # MVP: We assume if w,h,d are reasonable, it fits a box primitive
        # We set level to estimated since it's fitted from AABB
        
        # Look for user datum to see if we can elevate any confidence
        user_datum_found = any(m.get("source") == "user_known" for m in measurements)
        
        solids.append({
            "id": "solid-1",
            "kind": "box",
            "params": {
                "w": w,
                "h": h,
                "d": d,
                "origin": [(min_pt[0]+max_pt[0])/2, (min_pt[1]+max_pt[1])/2, (min_pt[2]+max_pt[2])/2]
            },
            "confidence": 0.8 if user_datum_found else 0.5,
            "level": "estimated"
        })
    else:
        # Fallback to mesh
        solids.append({
            "id": "solid-1",
            "kind": "mesh",
            "params": {},
            "confidence": 0.5,
            "level": "estimated"
        })
        
    # Process holes from measurements
    for m in measurements:
        if m.get("id", "").startswith("hole"):
            level = m.get("level", "low")
            holes.append({
                "id": m["id"],
                "diameter": m["value"] if m["value"] is not None else m.get("min", 0),
                "level": level,
                "axis": "y" # MVP assumption
            })
            
    if not solids:
        solids.append({"id": "solid-fallback", "kind": "mesh", "params": {}, "confidence": 0.1, "level": "low"})
        
    return {
        "solids": solids,
        "holes": holes,
        "units": units,
        "warnings": warnings,
        "refined": refined # pass through for exporters
    }
