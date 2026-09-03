"""Segment 6 — Feature Detector."""

import cv2
import numpy as np
import logging
import uuid
from backend.models.job_models import NormalizedImage
from backend.core.config import settings

logger = logging.getLogger(__name__)

def detect(images: list[NormalizedImage], components: list = None) -> dict:
    """Detect features using classical OpenCV."""
    if not images:
        return _empty_result()
        
    all_features = []
    counts = {"circle": 0, "line": 0, "edge": 0, "hole": 0}
    warnings = []
    
    # We will track detected circles to deduplicate across views
    # Store tuples of (cx, cy, r_px, confidence, img_index)
    global_circles = []
    
    for img_idx, img_meta in enumerate(images):
        img = cv2.imread(img_meta.stored_path)
        if img is None:
            continue
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.medianBlur(gray, 5)
        
        # 1. Edges (Canny)
        # We don't save every edge pixel as a separate feature to avoid bloat.
        # Instead, we just note if strong edges exist, but per instructions:
        # "Prefer precision over dumping every Canny pixel as a feature."
        # We'll rely more on lines and circles.
        
        # 2. Lines
        edges = cv2.Canny(blurred, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=50, maxLineGap=10)
        
        if lines is not None:
            # Cap at 40
            sorted_lines = sorted(lines, key=lambda l: (l[0][2]-l[0][0])**2 + (l[0][3]-l[0][1])**2, reverse=True)
            for line in sorted_lines[:40]:
                x1, y1, x2, y2 = line[0]
                length = np.sqrt((x2-x1)**2 + (y2-y1)**2)
                conf = min(0.8, length / max(gray.shape))
                all_features.append({
                    "id": f"f-{uuid.uuid4().hex[:6]}",
                    "type": "line",
                    "confidence": float(conf),
                    "image_index": img_idx,
                    "params": {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)}
                })
                counts["line"] += 1
                
        # 3. Circles / Holes
        circles = cv2.HoughCircles(
            blurred, 
            cv2.HOUGH_GRADIENT, 
            dp=settings.HOUGH_CIRCLE_DP, 
            minDist=20,
            param1=50, 
            param2=30, 
            minRadius=5, 
            maxRadius=200
        )
        
        if circles is not None:
            circles = np.uint16(np.around(circles))[0, :]
            for c in circles:
                cx, cy, r = int(c[0]), int(c[1]), int(c[2])
                
                # Check if it's a hole: sample the center and the perimeter
                # A hole is typically dark inside
                mask = np.zeros(gray.shape, dtype=np.uint8)
                cv2.circle(mask, (cx, cy), max(1, r - 2), 255, -1)
                mean_val = cv2.mean(gray, mask=mask)[0]
                
                is_hole = mean_val < settings.EXPOSURE_DARK * 1.5
                ftype = "hole" if is_hole else "circle"
                
                # Deduplication logic
                duplicate_found = False
                for gc in global_circles:
                    gc_x, gc_y, gc_r, gc_conf, gc_idx, gc_id = gc
                    # If center is within 10% of image size and radius within 20%
                    dist = np.sqrt((cx - gc_x)**2 + (cy - gc_y)**2)
                    if dist < max(gray.shape)*0.1 and abs(r - gc_r) < gc_r * 0.2:
                        duplicate_found = True
                        # Increase confidence of existing feature
                        new_conf = min(0.94, gc_conf + 0.2)
                        
                        # Find and update it
                        for f in all_features:
                            if f["id"] == gc_id:
                                f["confidence"] = float(new_conf)
                                # Keep the sharper view (we don't have sharpness score easily here, so just keep first)
                                break
                        break
                        
                if not duplicate_found:
                    conf = 0.55 if is_hole else 0.5
                    fid = f"f-{uuid.uuid4().hex[:6]}"
                    all_features.append({
                        "id": fid,
                        "type": ftype,
                        "confidence": conf,
                        "image_index": img_idx,
                        "params": {"cx": cx, "cy": cy, "r_px": r}
                    })
                    counts[ftype] += 1
                    global_circles.append((cx, cy, r, conf, img_idx, fid))

    # Cap total features
    if len(all_features) > settings.FEATURE_MAX:
        all_features = sorted(all_features, key=lambda x: x["confidence"], reverse=True)[:settings.FEATURE_MAX]
        warnings.append(f"Capped features to {settings.FEATURE_MAX}.")
        
    if not all_features:
        warnings.append("No strong features (lines/circles) detected.")
        
    return {
        "features": all_features,
        "counts": counts,
        "warnings": warnings
    }

def _empty_result(warnings: list[str] = None) -> dict:
    return {
        "features": [],
        "counts": {"circle": 0, "line": 0, "edge": 0, "hole": 0},
        "warnings": warnings or []
    }
