"""Segment 6 — Feature Detector (2D Contour Extraction)."""

import cv2
import numpy as np
import logging
from backend.models.job_models import NormalizedImage

logger = logging.getLogger(__name__)

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

    # Determine canvas background polarity from perimeter edge pixels
    border = np.concatenate([gray[0, :], gray[h - 1, :], gray[:, 0], gray[:, w - 1]])
    bg_is_light = float(np.median(border)) > 127

    # Threshold: foreground features become 255, canvas background becomes 0
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    if bg_is_light:
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    else:
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Full tree hierarchy: [Next, Previous, First_Child, Parent]
    contours, hierarchy = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    if not contours or hierarchy is None:
        return {"contours": [], "warnings": ["No contours found in the image."]}

    # Filter candidates for outer contour: ignore contours touching image border (frame/canvas)
    candidates = []
    for i, c in enumerate(contours):
        x, y, bw, bh = cv2.boundingRect(c)
        if x <= 2 or y <= 2 or (x + bw) >= (w - 2) or (y + bh) >= (h - 2):
            continue
        area = cv2.contourArea(c)
        if area > 100:
            candidates.append((i, area))

    if not candidates:
        largest_idx = max(
            range(len(contours)),
            key=lambda i: cv2.contourArea(contours[i]) if cv2.contourArea(contours[i]) < 0.99 * (w * h) else 0,
        )
    else:
        candidates.sort(key=lambda item: item[1], reverse=True)
        largest_idx = candidates[0][0]

    outer_contour = contours[largest_idx]
    outer_area = cv2.contourArea(outer_contour)

    # Extract internal holes
    holes = []
    first_child = hierarchy[0][largest_idx][2]

    if first_child != -1:
        child_area = cv2.contourArea(contours[first_child])
        # In a line drawing, the line boundary has an inner perimeter child (area comparable to outer)
        # whose children are the actual internal holes/features
        if child_area > 0.5 * outer_area:
            curr = hierarchy[0][first_child][2]
        else:
            # Solid object: holes are direct children of the outer contour
            curr = first_child

        while curr != -1:
            c = contours[curr]
            area = cv2.contourArea(c)
            if area > 100:
                perimeter = cv2.arcLength(c, True)
                if perimeter > 0:
                    circ = 4 * np.pi * area / (perimeter ** 2)
                    _, _, bw, bh = cv2.boundingRect(c)
                    ar = max(bw, bh) / max(min(bw, bh), 1)
                    # Filter out line fragments or non-enclosed artifacts
                    if circ >= 0.1 and ar <= 15:
                        M = cv2.moments(c)
                        if M["m00"] > 0:
                            cx, cy = int(M["m10"] / M["m00"]), int(M["m01"] / M["m00"])
                            if cv2.pointPolygonTest(outer_contour, (cx, cy), False) >= 0:
                                holes.append(c)
            curr = hierarchy[0][curr][0]  # Next sibling

    result_contours = []

    def process_contour(contour, role="outer"):
        # Simplify contour
        epsilon = 0.002 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        # Convert to list of points
        points = [{"x": float(p[0][0]), "y": float(p[0][1])} for p in approx]
        return {
            "role": role,
            "points": points,
            "area": float(cv2.contourArea(approx)),
            "is_closed": True,
        }

    # Add the outer contour
    result_contours.append(process_contour(outer_contour, "outer"))

    # Add children (holes)
    for h_cnt in holes:
        result_contours.append(process_contour(h_cnt, "hole"))

    return {
        "contours": result_contours,
        "primary_image_index": primary_index,
        "warnings": [],
    }
