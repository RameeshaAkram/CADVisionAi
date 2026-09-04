"""perspective_rectifier.py — Camera perspective tilt detection and rectification.

Detects the workpiece bounding quadrilateral and compensates for off-axis camera tilt:
  1. Detects the largest closed workpiece contour.
  2. Extracts the 4-point quadrilateral (cv2.approxPolyDP with cv2.minAreaRect fallback).
  3. Measures keystoning convergence to estimate tilt angle.
  4. Decision rule:
     - tilt < 3.0°  -> Skip rectification entirely (avoids resampling blur on flat images).
     - 3.0° to 30.0° -> Computes homography and applies cv2.warpPerspective to rectify.
     - tilt > 30.0° -> Rejects with clear user-facing error message (camera too angled).
"""

import math
import logging
import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Tilt threshold limits
MIN_TILT_TO_RECTIFY_DEG = 3.0
MAX_ALLOWED_TILT_DEG = 30.0


def order_points(pts: np.ndarray) -> np.ndarray:
    """Order 4 (x, y) points in cyclic clockwise order: [TL, TR, BR, BL]."""
    pts = pts.reshape(4, 2).astype(np.float32)
    cx = float(np.mean(pts[:, 0]))
    cy = float(np.mean(pts[:, 1]))
    angles = np.arctan2(pts[:, 1] - cy, pts[:, 0] - cx)
    idx = np.argsort(angles)
    pts = pts[idx]

    # Roll so point closest to top-left (min x+y) is index 0
    s = pts[:, 0] + pts[:, 1]
    start_idx = int(np.argmin(s))
    pts = np.roll(pts, -start_idx, axis=0)

    # Ensure clockwise ordering: P0(TL) -> P1(TR) -> P2(BR) -> P3(BL)
    v1 = pts[1] - pts[0]
    v2 = pts[3] - pts[0]
    if (v1[0] * v2[1] - v1[1] * v2[0]) < 0:
        pts = np.array([pts[0], pts[3], pts[2], pts[1]], dtype=np.float32)

    return pts


def estimate_quadrilateral(gray: np.ndarray) -> tuple[np.ndarray | None, float]:
    """Detect workpiece bounding quadrilateral and return ordered 4 corners.

    Returns:
        (ordered_quad, area) or (None, 0.0) if no valid object found.
    """
    h, w = gray.shape
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    border = np.concatenate([gray[0, :], gray[h - 1, :], gray[:, 0], gray[:, w - 1]])
    bg_is_light = float(np.median(border)) > 127
    flag = cv2.THRESH_BINARY_INV if bg_is_light else cv2.THRESH_BINARY
    _, binary = cv2.threshold(blurred, 0, 255, flag + cv2.THRESH_OTSU)

    cnts, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None, 0.0

    # Filter border-touching contours
    candidates = []
    for c in cnts:
        x, y, bw, bh = cv2.boundingRect(c)
        if x <= 2 or y <= 2 or (x + bw) >= (w - 2) or (y + bh) >= (h - 2):
            continue
        area = cv2.contourArea(c)
        if area > 100:
            candidates.append((c, area))

    if not candidates:
        c = max(cnts, key=cv2.contourArea)
        area = cv2.contourArea(c)
    else:
        candidates.sort(key=lambda t: t[1], reverse=True)
        c, area = candidates[0]

    # Circular parts (e.g. gasket ring, round discs) are not quadrilateral workpieces
    peri = cv2.arcLength(c, True)
    if peri > 0:
        circ = 4 * math.pi * area / (peri ** 2)
        if circ > 0.82:
            return None, area

    approx = cv2.approxPolyDP(c, 0.02 * peri, True)

    if len(approx) == 4:
        pts = approx.reshape(4, 2)
    else:
        # Fall back to oriented minimum area bounding rectangle
        rect = cv2.minAreaRect(c)
        pts = cv2.boxPoints(rect)

    return order_points(pts), area


def measure_tilt(quad: np.ndarray) -> float:
    """Estimate camera off-axis tilt angle in degrees from quadrilateral keystoning.

    When an axis-aligned flat rectangular part is tilted toward/away from the camera,
    opposite sides converge due to perspective projection. The ratio of side lengths
    |w_top - w_bot| / max(w_top, w_bot) is proportional to perspective foreshortening.
    """
    tl, tr, br, bl = quad

    w_top = float(np.linalg.norm(tr - tl))
    w_bot = float(np.linalg.norm(br - bl))
    h_left = float(np.linalg.norm(bl - tl))
    h_right = float(np.linalg.norm(br - tr))

    w_max = max(w_top, w_bot)
    w_min = min(w_top, w_bot)
    h_max = max(h_left, h_right)
    h_min = min(h_left, h_right)

    ky = (w_max - w_min) / max(w_max, 1.0)
    kx = (h_max - h_min) / max(h_max, 1.0)
    max_k = max(kx, ky)

    # For standard top-down setup (camera distance ~ 1-1.5x sensor width),
    # the keystoning ratio k maps to tilt angle with k ~ 0.0052 per degree.
    tilt_deg = max_k / 0.0052
    return float(tilt_deg)


def rectify(image: np.ndarray) -> tuple[np.ndarray | None, float, str, str | None]:
    """Inspect image for perspective tilt and rectify if in acceptable range (3° to 30°).

    Returns:
        (rectified_img, tilt_deg, status, error_msg)
        status can be:
          - 'near_zero': tilt < 3.0° -> returned untouched
          - 'rectified': 3.0° <= tilt <= 30.0° -> homography applied
          - 'rejected_excessive_tilt': tilt > 30.0° -> None returned, hard rejected
          - 'unrectified': object detection failed
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

    quad, area = estimate_quadrilateral(gray)
    if quad is None:
        return image, 0.0, "unrectified", None

    tilt_deg = measure_tilt(quad)
    logger.info("Perspective analysis: estimated camera tilt = %.1f°", tilt_deg)

    # 1. Skip if tilt is near zero (preserves pristine images without warp blur)
    if tilt_deg < MIN_TILT_TO_RECTIFY_DEG:
        return image, tilt_deg, "near_zero", None

    # 2. Hard reject if tilt exceeds safety threshold
    if tilt_deg > MAX_ALLOWED_TILT_DEG:
        err = (
            f"Excessive camera perspective tilt: estimated at {tilt_deg:.1f}°, "
            f"which exceeds the {MAX_ALLOWED_TILT_DEG:.0f}° safety limit. "
            "Reconstruction rejected to prevent distorted CAD output. "
            "Please capture the photograph from directly above the flat part (top-down view)."
        )
        logger.warning(err)
        return None, tilt_deg, "rejected_excessive_tilt", err

    # 3. Rectify via perspective warp
    tl, tr, br, bl = quad
    w_top = float(np.linalg.norm(tr - tl))
    w_bot = float(np.linalg.norm(br - bl))
    h_left = float(np.linalg.norm(bl - tl))
    h_right = float(np.linalg.norm(br - tr))

    target_w = max(w_top, w_bot)
    rad = math.radians(tilt_deg)
    target_h = max(h_left, h_right) / max(0.5, math.cos(rad))

    cx, cy = w / 2.0, h / 2.0
    dst = np.array([
        [cx - target_w / 2.0, cy - target_h / 2.0],
        [cx + target_w / 2.0, cy - target_h / 2.0],
        [cx + target_w / 2.0, cy + target_h / 2.0],
        [cx - target_w / 2.0, cy + target_h / 2.0],
    ], dtype=np.float32)

    M = cv2.getPerspectiveTransform(quad, dst)
    border_val = 255 if np.median(gray) > 127 else 0
    rectified = cv2.warpPerspective(image, M, (w, h), borderValue=border_val)

    logger.info("Perspective rectification applied successfully for %.1f° tilt", tilt_deg)
    return rectified, tilt_deg, "rectified", None
