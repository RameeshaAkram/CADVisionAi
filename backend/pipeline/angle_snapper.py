"""angle_snapper.py — Geometry regularization for CADVision AI.

Two operations:
  1. Orthogonal snap: edges within ORTHO_TOL degrees of 0°/90°/180°/270°
     are snapped to the exact cardinal angle.
  2. Collinear merge: adjacent segments whose directions differ by less than
     COLLINEAR_TOL degrees are merged into a single segment.

These are applied to the outer contour only (not holes, which are better
handled by the circle fitter).
"""

import math
import numpy as np
from typing import List, Dict

ORTHO_TOL = 2.0        # degrees — snap near-90° edges to exactly 90°
COLLINEAR_TOL = 3.0    # degrees — merge near-collinear segments


def _angle(p1: Dict, p2: Dict) -> float:
    """Angle in degrees of the segment from p1 to p2."""
    dx = p2["x"] - p1["x"]
    dy = p2["y"] - p1["y"]
    return math.degrees(math.atan2(dy, dx))


def _snap_angle(angle_deg: float) -> float | None:
    """Return the snapped cardinal angle if within ORTHO_TOL, else None."""
    for cardinal in (0.0, 90.0, 180.0, 270.0, -180.0, -90.0, 360.0):
        if abs(angle_deg - cardinal) <= ORTHO_TOL:
            return cardinal % 360
    return None


def snap_contour(points: List[Dict]) -> List[Dict]:
    """Apply orthogonal snapping + collinear merge to a closed polygon.

    Args:
        points: list of {"x": float, "y": float}

    Returns:
        Simplified list of {"x": float, "y": float}
    """
    if len(points) < 3:
        return points

    pts = list(points)  # copy

    # --- Pass 1: Orthogonal snap ---
    # For each edge, if its angle is near a cardinal direction, adjust the
    # endpoint so the edge is exactly orthogonal.
    snapped = list(pts)
    n = len(snapped)
    for i in range(n):
        j = (i + 1) % n
        ang = _angle(snapped[i], snapped[j])
        target = _snap_angle(ang)
        if target is None:
            continue
        # Snap: keep p[i] fixed, move p[j]
        rad = math.radians(target)
        dx = snapped[j]["x"] - snapped[i]["x"]
        dy = snapped[j]["y"] - snapped[i]["y"]
        length = math.sqrt(dx * dx + dy * dy)
        snapped[j] = {
            "x": snapped[i]["x"] + length * math.cos(rad),
            "y": snapped[i]["y"] + length * math.sin(rad),
        }

    # --- Pass 2: Collinear merge ---
    # Remove vertices where the turn angle is < COLLINEAR_TOL
    merged = [snapped[0]]
    n = len(snapped)
    for i in range(1, n):
        prev = merged[-1]
        curr = snapped[i]
        nxt = snapped[(i + 1) % n]
        ang_in  = _angle(prev, curr)
        ang_out = _angle(curr, nxt)
        diff = abs((ang_out - ang_in + 180) % 360 - 180)
        if diff < COLLINEAR_TOL:
            continue  # skip collinear vertex
        merged.append(curr)

    if len(merged) < 3:
        return points  # don't over-reduce; return original

    return merged
