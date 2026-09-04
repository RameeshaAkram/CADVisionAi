import logging
from typing import Any
from shapely.geometry import Polygon, Point
from shapely.validation import explain_validity

logger = logging.getLogger(__name__)


def _signed_polygon_area(points: list[dict]) -> float:
    """Compute signed polygon area. Positive = CCW, Negative = CW."""
    n = len(points)
    if n < 3:
        return 0.0
    return 0.5 * sum(
        points[k]["x"] * points[(k + 1) % n]["y"] - points[(k + 1) % n]["x"] * points[k]["y"]
        for k in range(n)
    )


def _check_topology(drawing: dict) -> dict:
    """Validate geometric topology of a 2D drawing.

    Verifies:
      1. Every polyline/circle forms a valid, closed Shapely Polygon.
      2. Invalid (self-intersecting) polygons are auto-repaired via buffer(0) with logging.
      3. Every hole profile is fully contained within the outer boundary (outer.contains / covers).
      4. No two hole profiles overlap each other (hole_i.intersection(hole_j).area < 1e-4).
      5. Winding direction convention: outer is CCW, holes are CW.
    """
    issues = []
    repairs_applied = []
    containment_ok = True
    overlap_ok = True

    if not drawing:
        return {
            "ok": True,
            "detail": "No drawing data to check.",
            "issues": [],
            "repairs_applied": [],
            "containment_ok": True,
            "overlap_ok": True,
        }

    top = drawing.get("views", {}).get("top", {})
    polylines = top.get("polylines", [])
    circles = top.get("circles", [])

    outer_poly = None
    hole_polys = []

    # Check polylines
    for idx, poly in enumerate(polylines):
        pts = poly.get("points", [])
        role = poly.get("role", "outer")
        is_closed = poly.get("is_closed", True)

        if len(pts) < 3:
            issues.append(f"Polyline {idx} ({role}) has fewer than 3 vertices.")
            continue

        if not is_closed:
            issues.append(f"Polyline {idx} ({role}) is not closed.")

        coords = [(p["x"], p["y"]) for p in pts]
        shp = Polygon(coords)

        # Validity & buffer(0) repair
        if not shp.is_valid:
            repaired = shp.buffer(0)
            if repaired.is_valid and not repaired.is_empty:
                msg = f"Repaired self-intersecting {role} polyline {idx} via buffer(0) ({explain_validity(shp)})"
                logger.warning("Topology repair: %s", msg)
                repairs_applied.append(msg)
                shp = repaired
            else:
                issues.append(f"Invalid {role} polyline {idx} could not be repaired: {explain_validity(shp)}")

        # Winding direction check
        sa = _signed_polygon_area(pts)
        if role == "outer":
            outer_poly = shp
            if sa < 0:
                issues.append(f"Outer contour polyline has CW winding (signed area={sa:.1f}), expected CCW")
        else:
            hole_polys.append((f"Polyline Hole {idx}", shp))
            if sa > 0:
                issues.append(f"Hole polyline {idx} has CCW winding (signed area={sa:.1f}), expected CW")

    # Check circles
    for idx, circ in enumerate(circles):
        cx = circ.get("cx", 0.0)
        cy = circ.get("cy", 0.0)
        r = circ.get("r", 0.0)
        if r <= 0:
            issues.append(f"Circle hole {idx} has non-positive radius: {r}")
            continue
        c_poly = Point(cx, cy).buffer(r, resolution=32)
        hole_polys.append((f"Circle Hole {idx}", c_poly))

    # Full containment check (tolerance 1e-4 for floating point precision on boundary)
    if outer_poly is not None and hole_polys:
        buffered_outer = outer_poly.buffer(1e-4)
        for h_name, h_poly in hole_polys:
            if not buffered_outer.contains(h_poly):
                containment_ok = False
                issues.append(f"{h_name} is partially or fully outside the outer contour boundary")

    # Non-overlap check between hole pairs
    n_holes = len(hole_polys)
    for i in range(n_holes):
        for j in range(i + 1, n_holes):
            h1_name, h1_poly = hole_polys[i]
            h2_name, h2_poly = hole_polys[j]
            intersection = h1_poly.intersection(h2_poly)
            if intersection.area > 1e-4:
                overlap_ok = False
                issues.append(f"{h1_name} and {h2_name} overlap (intersection area {intersection.area:.2f})")

    ok = (len(issues) == 0)
    detail = "; ".join(issues) if issues else "Topology is valid and verified."
    return {
        "ok": ok,
        "detail": detail,
        "issues": issues,
        "repairs_applied": repairs_applied,
        "containment_ok": containment_ok,
        "overlap_ok": overlap_ok,
    }

def validate(job_payload: dict) -> dict:
    """
    Validates a completed or partially completed job.
    Returns:
        {
            "ok": bool,
            "confidence": float,
            "level": "measured" | "estimated" | "low",
            "checks": [...],
            "warnings": [...]
        }
    """
    res = job_payload.get("result", {})
    outputs = job_payload.get("outputs", [])
    known_dims = job_payload.get("known_dimensions", [])
    status = job_payload.get("status", "processing")
    
    warnings = []
    checks = []
    
    recon = res.get("reconstruction", {})
    view_ana = res.get("view_analysis", {})
    scale_cal = res.get("scale_calibration", {})
    obj_det = res.get("object_detection", {})
    cad = res.get("cad_generation", {})
    drawing = res.get("drawing_generation", {})
    
    # 1. Views check
    usable = view_ana.get("usable_count", 0)
    enough = res.get("enough_views", True)
    if usable < 2 or not enough:
        checks.append({"id": "views", "ok": False, "detail": "Insufficient usable views."})
        warnings.append({
            "severity": "vermilion",
            "code": "low_coverage",
            "message": "Views are too similar to support a stable shape.",
            "action": "Add photos from other angles, then process again."
        })
    else:
        checks.append({"id": "views", "ok": True, "detail": "Views are sufficient."})
        
    # 2. Object check
    obj_found = obj_det.get("object_found", True)
    if not obj_found:
        checks.append({"id": "object", "ok": False, "detail": "No object detected."})
        warnings.append({
            "severity": "vermilion",
            "code": "no_object",
            "message": "No object was detected in the images.",
            "action": "Ensure the object is clearly visible and contrasted with the background."
        })
    else:
        checks.append({"id": "object", "ok": True, "detail": "Object detected."})
        
    # 3. Reconstruction check
    v_count = recon.get("vertex_count", 0)
    method = recon.get("method", "")
    recon_ok = v_count > 0
    checks.append({"id": "reconstruction", "ok": recon_ok, "detail": f"Vertices: {v_count}"})
    if method in ("visual_hull", "silhouette", "fallback_empty"):
        warnings.append({
            "severity": "amber",
            "code": "hidden_surfaces",
            "message": "Hidden surfaces are not in the photographs. Depth is inferred.",
            "action": "Add views of the underside and far side, or treat depth as a range."
        })
        
    # 4. Scale check
    scale_factor = scale_cal.get("scale_factor")
    if scale_factor and scale_factor > 0 and len(known_dims) > 0:
        checks.append({"id": "scale", "ok": True, "detail": "Scale factor is valid."})
        consistency = scale_cal.get("consistency", 1.0)
        if consistency < 0.9:
            warnings.append({
                "severity": "amber",
                "code": "scale_mismatch",
                "message": "Known dimensions disagree by more than 10%.",
                "action": "Check that height and width are labeled on the correct axes."
            })
    else:
        checks.append({"id": "scale", "ok": False, "detail": "Invalid or missing scale."})
        warnings.append({
            "severity": "vermilion",
            "code": "no_scale",
            "message": "Scale could not be computed.",
            "action": "Provide a known dimension for calibration."
        })
        
    # 5. Measurements check
    measurements = scale_cal.get("measurements", [])
    meas_ok = True
    for m in measurements:
        if m.get("level") == "measured" and m.get("source") != "user_known":
            meas_ok = False
            m["level"] = "estimated" # Fix on the fly
        if m.get("level") == "low" and m.get("value") is not None and m.get("min") is None:
            # Low shouldn't have point estimate
            m["min"] = m.get("value") * 0.8
            m["max"] = m.get("value") * 1.2
            m["value"] = None
    checks.append({"id": "measurements", "ok": meas_ok, "detail": "Measurements format valid."})
    
    # 6. Drawing check
    drawing_ok = bool(drawing)
    if drawing:
        if "not a metrology" not in drawing.get("title_block", {}).get("note", "").lower():
            drawing_ok = False
        
        # Check dimensions
        for dim in drawing.get("dimensions", []):
            if dim.get("level") == "low":
                drawing_ok = False
                
    checks.append({"id": "drawing", "ok": drawing_ok, "detail": "Drawing JSON is valid."})

    # Topology validation check (valid polygons, full containment, no hole overlap, winding)
    topo_res = _check_topology(drawing)
    checks.append({
        "id": "topology",
        "ok": topo_res["ok"],
        "detail": topo_res["detail"]
    })
    if not topo_res["ok"]:
        for iss in topo_res["issues"]:
            warnings.append({
                "severity": "amber",
                "code": "topology_issue",
                "message": iss,
                "action": "Check part contour boundaries and hole positions."
            })
    if topo_res.get("repairs_applied"):
        for rep in topo_res["repairs_applied"]:
            warnings.append({
                "severity": "amber",
                "code": "topology_repair",
                "message": rep,
                "action": "Verify repaired contour in 2D drawing."
            })
    
    # 7 & 8. DXF and Mesh output checks
    dxf_ok = False
    mesh_ok = False
    for out in outputs:
        if isinstance(out, dict):
            kind = out.get("kind")
            path = out.get("path", "")
        else:
            # output is OutputRecord
            kind = out.kind
            path = out.path
            
        import os
        if kind == "dxf" and os.path.exists(path):
            dxf_ok = True
            # Optional: ezdxf readfile check
        if kind == "mesh" and os.path.exists(path) and os.path.getsize(path) > 0:
            mesh_ok = True

    checks.append({"id": "dxf", "ok": dxf_ok, "detail": "DXF file exists."})
    checks.append({"id": "mesh", "ok": mesh_ok, "detail": "Mesh file exists."})
    
    if not dxf_ok and status != "needs_more_views":
        warnings.append({
            "severity": "vermilion",
            "code": "file_missing",
            "message": "The DXF was not written.",
            "action": "Retry processing. If it fails again, export the 3D file only."
        })
        
    if cad.get("method") == "bounding_box":
        warnings.append({
            "severity": "amber",
            "code": "coarse_mesh",
            "message": "Shape is a coarse hull, not a parametric CAD solid.",
            "action": "Use it as a reference, not as a manufacturing file."
        })

    # Deduplicate warnings
    unique_warnings = []
    seen = set()
    for w in warnings:
        code = w["code"]
        if code not in seen:
            seen.add(code)
            unique_warnings.append(w)
            
    # Determine confidence
    base_conf = recon.get("confidence", 0.0)
    
    if method in ("visual_hull", "silhouette"):
        base_conf -= 0.1
        
    if not enough:
        base_conf -= 0.3
        
    if not scale_factor:
        base_conf -= 0.4
        
    final_conf = max(0.0, min(0.85, base_conf))
    
    # Determine level
    if final_conf >= 0.8:
        level = "measured"
    elif final_conf >= 0.4:
        level = "estimated"
    else:
        level = "low"
        
    # Measured is ONLY allowed if recon+scale succeeded and the ONLY measured nums are user_known
    if level == "measured" and (not recon_ok or not scale_factor or not meas_ok):
        level = "estimated"
        
    # ok is False only when there is nothing to show
    job_ok = mesh_ok or drawing_ok
    if status == "needs_more_views":
        job_ok = False

    return {
        "ok": job_ok,
        "confidence": round(final_conf, 2),
        "level": level,
        "checks": checks,
        "warnings": unique_warnings
    }
