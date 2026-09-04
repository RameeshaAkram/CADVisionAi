"""circle_fitter.py — Algebraic (Kasa) circle fitting for CADVision AI.

Fits a circle to a set of 2D points using the least-squares Kasa method.
Returns (cx, cy, r, circularity) or None if the contour is not circular.

The circularity threshold is read from settings.CIRCULARITY_THRESHOLD so
it is defined in exactly one place.
"""

import math
import numpy as np
from typing import Optional, Tuple

from backend.core.config import settings


def fit_circle(points: list[dict]) -> Optional[Tuple[float, float, float, float]]:
    """Fit a circle to a list of {"x": ..., "y": ...} point dicts.

    Uses the algebraic Kasa least-squares circle fit — fast and stable for
    near-circular contours.  A second algebraic method (Pratt) is used as
    a cross-check when the Kasa solution has high residual.

    Returns:
        (cx, cy, radius, circularity) if the fit is accepted
        None                          if the contour is not circular enough

    circularity = 4*pi*area / perimeter**2  (1.0 = perfect circle)
    """
    if len(points) < 5:
        return None

    pts = np.array([[p["x"], p["y"]] for p in points], dtype=np.float64)

    # Compute raw circularity of the polygon before trying to fit
    raw_circ = _polygon_circularity(pts)

    if raw_circ < settings.CIRCULARITY_THRESHOLD:
        return None  # Not circular enough — skip expensive fit

    # --- Kasa algebraic fit ---
    cx, cy, r = _kasa_fit(pts)

    if r <= 0 or math.isnan(r) or math.isinf(r):
        return None

    # Verify the fit quality: mean radial error < 5% of radius
    radii = np.sqrt((pts[:, 0] - cx) ** 2 + (pts[:, 1] - cy) ** 2)
    mean_err = float(np.mean(np.abs(radii - r)))
    if mean_err > 0.05 * r:
        # Try Pratt fit as fallback
        cx2, cy2, r2 = _pratt_fit(pts)
        if r2 > 0 and not math.isnan(r2):
            radii2 = np.sqrt((pts[:, 0] - cx2) ** 2 + (pts[:, 1] - cy2) ** 2)
            mean_err2 = float(np.mean(np.abs(radii2 - r2)))
            if mean_err2 < mean_err:
                cx, cy, r = cx2, cy2, r2
                mean_err = mean_err2

    if mean_err > 0.10 * r:
        # Even with fallback, fit quality is poor — not a circle
        return None

    return (float(cx), float(cy), float(r), float(raw_circ))


def _polygon_circularity(pts: np.ndarray) -> float:
    """Compute isoperimetric circularity of a polygon."""
    n = len(pts)
    # Area (shoelace)
    x, y = pts[:, 0], pts[:, 1]
    area = 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))
    # Perimeter
    diffs = np.diff(pts, axis=0, append=pts[:1])
    perimeter = float(np.sum(np.linalg.norm(diffs, axis=1)))
    if perimeter == 0:
        return 0.0
    return float(4 * math.pi * area / perimeter ** 2)


def _kasa_fit(pts: np.ndarray) -> Tuple[float, float, float]:
    """Kasa algebraic circle fit. Returns (cx, cy, r)."""
    x, y = pts[:, 0], pts[:, 1]
    # Shift to centroid for numerical stability
    mx, my = x.mean(), y.mean()
    u, v = x - mx, y - my

    Suu = np.dot(u, u)
    Suv = np.dot(u, v)
    Svv = np.dot(v, v)
    Suuu = np.dot(u * u, u)
    Suvv = np.dot(u, v * v)
    Svvv = np.dot(v * v, v)
    Svuu = np.dot(v, u * u)

    A = np.array([[Suu, Suv], [Suv, Svv]])
    b = np.array([0.5 * (Suuu + Suvv), 0.5 * (Svvv + Svuu)])

    try:
        uc, vc = np.linalg.solve(A, b)
    except np.linalg.LinAlgError:
        return (0.0, 0.0, -1.0)

    cx, cy = uc + mx, vc + my
    r = math.sqrt(uc ** 2 + vc ** 2 + (Suu + Svv) / len(pts))
    return (cx, cy, r)


def _pratt_fit(pts: np.ndarray) -> Tuple[float, float, float]:
    """Pratt algebraic circle fit — more robust for small arcs."""
    x, y = pts[:, 0], pts[:, 1]
    mx, my = x.mean(), y.mean()
    u, v = x - mx, y - my

    Z = u ** 2 + v ** 2
    Zmean = Z.mean()
    Z0 = (Z - Zmean) / (2 * math.sqrt(Zmean)) if Zmean > 0 else Z

    n = len(pts)
    M = np.column_stack([Z0, u, v, np.ones(n)])
    _, _, Vt = np.linalg.svd(M)
    A_vec = Vt[-1]  # last row of V^T = eigenvector of smallest singular value

    A_coef, B_coef, C_coef, D_coef = A_vec
    if abs(A_coef) < 1e-12:
        return (0.0, 0.0, -1.0)

    # Unnormalize
    A_coef /= 2 * math.sqrt(Zmean)
    denom = 2 * A_coef
    cx = -B_coef / denom + mx
    cy = -C_coef / denom + my
    r2 = (B_coef ** 2 + C_coef ** 2 - 4 * A_coef * D_coef) / (4 * A_coef ** 2)
    if r2 < 0:
        return (0.0, 0.0, -1.0)
    return (cx, cy, math.sqrt(r2))


def circle_from_contour(contour: dict) -> Optional[dict]:
    """High-level helper: try to fit a circle to a feature_detector contour dict.

    Returns a circle dict {"cx": ..., "cy": ..., "r": ..., "role": ..., "circularity": ...}
    or None if the contour is not circular.
    """
    points = contour.get("points", [])
    fit = fit_circle(points)
    if fit is None:
        return None
    cx, cy, r, circ = fit
    return {
        "cx": cx,
        "cy": cy,
        "r": r,
        "role": contour.get("role", "hole"),
        "circularity": circ,
        "is_circle": True,
    }


def classify_hole_primitive(contour: dict) -> dict:
    """Classifies an internal hole contour into geometric primitive types.

    Returns a dict with:
        'primitive_type': 'circle' | 'slot' | 'rectangle' | 'polygon',
        and primitive-specific attributes.
    """
    import cv2
    points = contour.get("points", [])
    if len(points) < 3:
        return {"primitive_type": "unknown", "is_circle": False}

    # 1. Test circle fit
    c_fit = circle_from_contour(contour)
    if c_fit is not None:
        return {
            "primitive_type": "circle",
            "is_circle": True,
            "circle": c_fit,
            "circularity": c_fit["circularity"],
        }

    # 2. Geometric analysis
    pts = np.array([[p["x"], p["y"]] for p in points], dtype=np.float32)
    rect = cv2.minAreaRect(pts)
    (rcx, rcy), (rw, rh), _ = rect
    w_rect = max(rw, rh)
    h_rect = min(rw, rh)
    aspect_ratio = w_rect / max(h_rect, 1e-4)
    circ = _polygon_circularity(pts)

    # Oblong slot: aspect ratio >= 1.5 with rounded ends
    if aspect_ratio >= 1.5 and 0.55 <= circ < settings.CIRCULARITY_THRESHOLD:
        return {
            "primitive_type": "slot",
            "is_circle": False,
            "center": (float(rcx), float(rcy)),
            "length": float(w_rect),
            "width": float(h_rect),
            "aspect_ratio": float(aspect_ratio),
            "circularity": float(circ),
        }

    # Rectangle: 4-5 vertices
    if 4 <= len(points) <= 6 and circ < 0.80:
        return {
            "primitive_type": "rectangle",
            "is_circle": False,
            "center": (float(rcx), float(rcy)),
            "width": float(w_rect),
            "height": float(h_rect),
            "aspect_ratio": float(aspect_ratio),
        }

    return {
        "primitive_type": "polygon",
        "is_circle": False,
        "circularity": float(circ),
        "vertex_count": len(points),
    }
