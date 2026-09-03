"""Segment 8 — Scale Calibration"""

import statistics
from backend.core.config import settings
from backend.utils import geometry_utils

def calibrate(reconstruction: dict, known_dimensions: list, units: str, features: dict = None) -> dict:
    if not known_dimensions:
        return {
            "scale_factor": None,
            "units": units,
            "measurements": [],
            "consistency": None,
            "warnings": ["No known dimension provided. The model is in relative units and can't be measured."]
        }
        
    bounds = reconstruction.get("bounds")
    if not bounds:
        return {
            "scale_factor": None,
            "units": units,
            "measurements": [],
            "consistency": None,
            "warnings": ["Mesh bounds missing; cannot calibrate scale."]
        }
        
    extents = geometry_utils.aabb_extents(bounds)
    if not extents or sum(extents.values()) == 0:
        return {
            "scale_factor": None,
            "units": units,
            "measurements": [],
            "consistency": None,
            "warnings": ["Mesh bounds are zero; cannot calibrate scale."]
        }
        
    scale_factors = []
    mapped_knowns = []
    warnings = []
    
    for kd in known_dimensions:
        axis = geometry_utils.choose_axis(kd["label"], extents)
        if axis and extents[axis] > 0:
            sf = kd["value"] / extents[axis]
            scale_factors.append(sf)
            mapped_knowns.append({"label": kd["label"], "value": kd["value"], "axis": axis})
            
    if not scale_factors:
        return {
            "scale_factor": None,
            "units": units,
            "measurements": [],
            "consistency": None,
            "warnings": ["No known dimension could be applied."]
        }
        
    consistency = None
    scale_factor = scale_factors[0]
    
    if len(scale_factors) > 1:
        min_sf = min(scale_factors)
        max_sf = max(scale_factors)
        consistency = 1.0 - (max_sf - min_sf) / max_sf if max_sf > 0 else 0.0
        
        scale_factor = statistics.median(scale_factors)
        if consistency is not None and consistency < (1.0 - settings.SCALE_MISMATCH_PCT):
            warnings.append("Known dimensions disagree by more than 10%. Check which measurement matches height vs width.")
            
    measurements = []
    used_axes = {k["axis"]: k for k in mapped_knowns}
    
    recon_conf = reconstruction.get("confidence", 0.0)
    
    for axis, label_default in [("x", "Width"), ("y", "Height"), ("z", "Depth")]:
        if axis in used_axes:
            k = used_axes[axis]
            measurements.append({
                "id": k["label"].lower().replace(" ", "_"),
                "label": k["label"].capitalize(),
                "value": k["value"],
                "min": None,
                "max": None,
                "tolerance": None,
                "units": units,
                "level": "measured",
                "source": "user_known",
                "glyph": "measured"
            })
        else:
            val = extents[axis] * scale_factor
            
            if recon_conf >= 0.35:
                tol = max(0.01 * val, val * (1.0 - recon_conf))
                if len(scale_factors) > 1 and consistency is not None:
                    tol = max(tol, val * (1.0 - consistency))
                    
                measurements.append({
                    "id": label_default.lower(),
                    "label": label_default,
                    "value": val,
                    "min": val - tol,
                    "max": val + tol,
                    "tolerance": tol,
                    "units": units,
                    "level": "estimated",
                    "source": "scaled_aabb",
                    "glyph": "estimated"
                })
            else:
                measurements.append({
                    "id": label_default.lower(),
                    "label": label_default,
                    "value": None,
                    "min": val * 0.8,
                    "max": val * 1.2,
                    "tolerance": None,
                    "units": units,
                    "level": "low",
                    "source": "scaled_aabb",
                    "glyph": "low"
                })
                
    if recon_conf < 0.35 or reconstruction.get("method") == "visual_hull":
        warnings.append("Depth is inferred from the bounding box. Underside / far side was not visible.")
        
    if reconstruction.get("warnings"):
        warnings.extend(reconstruction["warnings"])
        
    if features and features.get("circles"):
        circles = features.get("circles", [])
        image_width = features.get("image_width", 800) # Fallback
        
        for i, c in enumerate(circles):
            r_px = c.get("r", 0)
            views = c.get("views", 1)
            
            if r_px > 0:
                relative_r = r_px / image_width * max(extents.get("x", 0), extents.get("z", 0))
                diameter = 2 * relative_r * scale_factor
                
                level = "estimated" if views >= 2 else "low"
                
                if level == "estimated":
                    tol = max(0.02 * diameter, diameter * 0.15)
                    measurements.append({
                        "id": f"hole_{i}",
                        "label": f"Hole {i+1} diameter",
                        "value": diameter,
                        "min": diameter - tol,
                        "max": diameter + tol,
                        "tolerance": tol,
                        "units": units,
                        "level": "estimated",
                        "source": "feature_multi_view",
                        "glyph": "estimated"
                    })
                else:
                    measurements.append({
                        "id": f"hole_{i}",
                        "label": f"Hole {i+1} diameter",
                        "value": None,
                        "min": diameter * 0.8,
                        "max": diameter * 1.2,
                        "tolerance": None,
                        "units": units,
                        "level": "low",
                        "source": "feature_single_view",
                        "glyph": "low"
                    })
        warnings.append("Hole diameters are approximate; cameras are not metrology-calibrated.")
            
    # Deduplicate warnings
    warnings = list(dict.fromkeys(warnings))
            
    return {
        "scale_factor": scale_factor,
        "units": units,
        "measurements": measurements,
        "consistency": consistency,
        "warnings": warnings
    }
