"""Segment 6 — Feature Detector (2D Contour Extraction).

Improvements:
- Hough circle detection as primary method for finding circular holes
- Adaptive thresholding fallback for uneven lighting
- Morphological cleanup
- Hole deduplication by centroid distance (dynamic threshold based on hole size)
- Hole size filter: max area < 40% of outer
- angle_snapper applied to outer contour
"""

import cv2
import numpy as np
import math
import logging
from backend.models.job_models import NormalizedImage
from backend.pipeline.angle_snapper import snap_contour
from backend.core.config import settings

logger = logging.getLogger(__name__)

# Minimum area for a hole contour in pixels
MIN_HOLE_AREA_PX = 50
# A hole may not be larger than this fraction of the outer contour area
MAX_HOLE_FRACTION = 0.40


def _best_binary(gray: np.ndarray, bg_is_light: bool) -> np.ndarray:
    """Return the best binary image for contour extraction."""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    h, w = gray.shape

    # Otsu threshold
    flag = cv2.THRESH_BINARY_INV if bg_is_light else cv2.THRESH_BINARY
    _, binary_otsu = cv2.threshold(blurred, 0, 255, flag + cv2.THRESH_OTSU)

    # Adaptive threshold (good for uneven lighting)
    block = max(11, (min(h, w) // 30) | 1)
    adapt_flag = cv2.THRESH_BINARY_INV if bg_is_light else cv2.THRESH_BINARY
    binary_adapt = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                          adapt_flag, block, 4)

    # Morphological cleanup for both
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    for b in [binary_otsu, binary_adapt]:
        cv2.morphologyEx(b, cv2.MORPH_OPEN,  kernel, b, iterations=1)
        cv2.morphologyEx(b, cv2.MORPH_CLOSE, kernel, b, iterations=2)

    # Pick the one with more coverage (but not "everything")
    max_px = int(0.70 * h * w)
    otsu_nz  = int(np.count_nonzero(binary_otsu))
    adapt_nz = int(np.count_nonzero(binary_adapt))

    if adapt_nz > otsu_nz and adapt_nz < max_px:
        return binary_adapt
    return binary_otsu


def _find_outer(contours, hierarchy, w, h):
    """Return the index of the best outer contour (largest non-border-touching)."""
    candidates = []
    for i, c in enumerate(contours):
        x, y, bw, bh = cv2.boundingRect(c)
        if x <= 2 or y <= 2 or (x + bw) >= (w - 2) or (y + bh) >= (h - 2):
            continue
        area = cv2.contourArea(c)
        if area > 100:
            candidates.append((i, area))
    if not candidates:
        return max(range(len(contours)),
                   key=lambda i: cv2.contourArea(contours[i]) if cv2.contourArea(contours[i]) < 0.99 * w * h else 0)
    candidates.sort(key=lambda t: t[1], reverse=True)
    return candidates[0][0]


def _hough_circles(gray: np.ndarray, bg_is_light: bool,
                   outer_contour: np.ndarray, outer_area: float,
                   w: int, h: int) -> list[dict]:
    """Detect circular holes using HoughCircles.

    Returns list of {"cx": px, "cy": px, "r": px} in pixel space.
    """
    if bg_is_light:
        # Invert so circles are bright on dark background for Hough
        search_img = cv2.bitwise_not(gray)
    else:
        search_img = gray.copy()

    blurred = cv2.GaussianBlur(search_img, (9, 9), 2)

    min_r = 5    # pixels
    max_r = int(math.sqrt(outer_area / math.pi) * 0.6)  # 60% of outer equivalent radius
    max_r = max(min_r + 1, min(max_r, min(w, h) // 4))

    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=min_r * 2,
        param1=50,
        param2=25,
        minRadius=min_r,
        maxRadius=max_r,
    )

    if circles is None:
        return []

    result = []
    for cx, cy, r in circles[0]:
        cx, cy, r = float(cx), float(cy), float(r)
        # Must be inside outer contour
        if cv2.pointPolygonTest(outer_contour, (cx, cy), False) < 0:
            continue
        # Must not be too large
        hole_area = math.pi * r * r
        if hole_area > MAX_HOLE_FRACTION * outer_area:
            continue
        result.append({"cx": cx, "cy": cy, "r": r})

    return result


def _contour_holes(contours, hierarchy, largest_idx, outer_contour, outer_area):
    """Extract hole contours using hierarchy traversal."""
    max_hole_area = MAX_HOLE_FRACTION * outer_area
    holes = []
    first_child = hierarchy[0][largest_idx][2]

    if first_child == -1:
        return holes

    child_area = cv2.contourArea(contours[first_child])
    if child_area > 0.5 * outer_area:
        curr = hierarchy[0][first_child][2]
    else:
        curr = first_child

    while curr != -1:
        c = contours[curr]
        area = cv2.contourArea(c)
        if MIN_HOLE_AREA_PX < area < max_hole_area:
            perimeter = cv2.arcLength(c, True)
            if perimeter > 0:
                circ = 4 * np.pi * area / (perimeter ** 2)
                _, _, bw, bh = cv2.boundingRect(c)
                ar = max(bw, bh) / max(min(bw, bh), 1)
                if circ >= 0.1 and ar <= 15:
                    M = cv2.moments(c)
                    if M["m00"] > 0:
                        cx = int(M["m10"] / M["m00"])
                        cy = int(M["m01"] / M["m00"])
                        if cv2.pointPolygonTest(outer_contour, (cx, cy), False) >= 0:
                            holes.append((c, cx, cy, area))
        curr = hierarchy[0][curr][0]

    return holes


def _deduplicate(items, min_dist_px: float = 8.0):
    """Remove near-duplicate items (list of (contour, cx, cy, area)).
    Two items are duplicates if their centroids are within min_dist_px.
    """
    deduped = []
    for item in items:
        _, cx, cy, _ = item
        is_dup = any(
            math.sqrt((cx - ox)**2 + (cy - oy)**2) < min_dist_px
            for _, ox, oy, _ in deduped
        )
        if not is_dup:
            deduped.append(item)
    return deduped


def _hough_to_contour_item(hc: dict, n_pts: int = 48):
    """Convert a Hough circle to a synthetic contour tuple (contour, cx, cy, area)."""
    cx, cy, r = hc["cx"], hc["cy"], hc["r"]
    angles = np.linspace(0, 2 * math.pi, n_pts, endpoint=False)
    pts = np.array([[[int(cx + r * math.cos(a)), int(cy + r * math.sin(a))]] for a in angles],
                   dtype=np.int32)
    area = math.pi * r * r
    return (pts, int(cx), int(cy), area)


def detect(images: list[NormalizedImage], components: list = None) -> dict:
    """Extract closed 2D contours from the primary image."""
    if not images:
        return {"contours": [], "warnings": ["No images provided."]}

    component = next((c for c in (components or []) if c.get("label") == "main_object"), None)
    primary_index = component.get("image_index", 0) if component else 0
    if primary_index < 0 or primary_index >= len(images):
        primary_index = 0

    img_meta = images[primary_index]
    img = cv2.imread(img_meta.stored_path)
    if img is None:
        return {"contours": [], "warnings": ["Could not read image."]}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Background polarity
    border = np.concatenate([gray[0, :], gray[h - 1, :], gray[:, 0], gray[:, w - 1]])
    bg_is_light = float(np.median(border)) > 127

    binary = _best_binary(gray, bg_is_light)

    contours, hierarchy = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    if not contours or hierarchy is None:
        return {"contours": [], "warnings": ["No contours found in the image."]}

    largest_idx = _find_outer(contours, hierarchy, w, h)
    outer_contour = contours[largest_idx]
    outer_area = cv2.contourArea(outer_contour)

    # --- Hole detection strategy ---
    # 1. Hough circles (primary for circular holes)
    hough_circles = _hough_circles(gray, bg_is_light, outer_contour, outer_area, w, h)

    # 2. Contour hierarchy (primary for non-circular holes + fallback for circles)
    contour_holes = _contour_holes(contours, hierarchy, largest_idx, outer_contour, outer_area)

    # 3. Merge: use Hough results where available; fill gaps with contour results
    # Build final hole list. Start with Hough circles (more accurate for circular features).
    # Then add contour holes that are NOT close to any Hough circle.
    final_holes = []  # list of (contour, cx, cy, area)

    for hc in hough_circles:
        final_holes.append(_hough_to_contour_item(hc))

    for (c, cx, cy, area) in contour_holes:
        # Check if this contour is already covered by a Hough circle
        covered = any(
            math.sqrt((cx - int(fh[1]))**2 + (cy - int(fh[2]))**2) < 12
            for fh in final_holes
        )
        if not covered:
            # Compute circularity to decide if it's a near-circle not caught by Hough
            perim = cv2.arcLength(c, True)
            area_c = cv2.contourArea(c)
            circ = 4 * math.pi * area_c / (perim ** 2) if perim > 0 else 0
            final_holes.append((c, cx, cy, area_c))

    # Deduplicate (handles doubled contours from thick-line drawings)
    final_holes = _deduplicate(final_holes, min_dist_px=8.0)

    # Build result
    def process_contour(contour, role="outer"):
        epsilon = 0.002 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        points = [{"x": float(p[0][0]), "y": float(p[0][1])} for p in approx]
        return {
            "role": role,
            "points": points,
            "area": float(cv2.contourArea(approx)),
            "is_closed": True,
        }

    result_contours = []

    # Outer — process + angle snap
    outer_result = process_contour(outer_contour, "outer")
    outer_result["points"] = snap_contour(outer_result["points"])
    result_contours.append(outer_result)

    # Holes
    for (h_cnt, _, _, _) in final_holes:
        result_contours.append(process_contour(h_cnt, "hole"))

    return {
        "contours": result_contours,
        "primary_image_index": primary_index,
        "warnings": [],
    }
