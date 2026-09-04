"""Generate synthetic test corpus for CADVision AI pipeline validation.

Creates 15 clean line-drawing images + 5 degraded variants, each with a
JSON sidecar describing exact ground truth (shapes, holes, dimensions).
"""

import json
import math
import cv2
import numpy as np
from pathlib import Path

IMG_DIR = Path(__file__).parent / "images"
GT_DIR = Path(__file__).parent / "ground_truth"

# Canvas settings
CANVAS = (1200, 900)  # w, h in pixels
BG = 255
FG = 0
THICKNESS = 4
HOLE_THICKNESS = 3

# pixels-per-mm constant so ground-truth mm values map exactly
PPMM = 5.0


def _px(mm: float) -> int:
    return int(round(mm * PPMM))


def _origin():
    return CANVAS[0] // 2, CANVAS[1] // 2


def _draw_polygon(img, pts_mm, ox, oy, thickness=THICKNESS):
    pts_px = np.array([[ox + _px(x), oy + _px(y)] for x, y in pts_mm], dtype=np.int32)
    cv2.polylines(img, [pts_px], isClosed=True, color=FG, thickness=thickness)
    return pts_px


def _draw_circle_hole(img, cx_mm, cy_mm, r_mm, ox, oy, thickness=HOLE_THICKNESS):
    cv2.circle(img, (ox + _px(cx_mm), oy + _px(cy_mm)), _px(r_mm), FG, thickness)


def _rect_pts(w, h):
    hw, hh = w / 2, h / 2
    return [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]


def _save(name, img, gt):
    cv2.imwrite(str(IMG_DIR / name), img)
    gt_path = GT_DIR / name.replace(".png", ".json")
    with open(gt_path, "w") as f:
        json.dump(gt, f, indent=2)
    print(f"  {name} -> {gt_path.name}")


# --- 1. simple_plate ---
def gen_simple_plate():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    w, h = 100, 75
    _draw_polygon(img, _rect_pts(w, h), ox, oy)
    holes = []
    for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
        cx, cy = sx * (w / 2 - 15), sy * (h / 2 - 15)
        _draw_circle_hole(img, cx, cy, 5, ox, oy)
        holes.append({"type": "circle", "center_mm": [round(cx + w / 2, 2), round(cy + h / 2, 2)], "radius_mm": 5})
    _save("simple_plate.png", img, {
        "image": "simple_plate.png",
        "reference_width_mm": w, "reference_height_mm": h,
        "outer_shape": "rectangle", "outer_vertex_count": 4,
        "holes": holes, "expected_hole_count": 4,
        "tolerance_pct": 1.0, "tolerance_abs_mm": 0.5
    })


# --- 2. bracket ---
def gen_bracket():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    w_top, h_top, w_leg, h_leg = 120, 35, 60, 65
    total_h = h_top + h_leg
    y_top = -total_h / 2
    y_mid = y_top + h_top
    y_bot = y_mid + h_leg
    pts = [
        (-w_top / 2, y_top), (w_top / 2, y_top), (w_top / 2, y_mid),
        (w_leg / 2, y_mid), (w_leg / 2, y_bot), (-w_leg / 2, y_bot),
        (-w_leg / 2, y_mid), (-w_top / 2, y_mid),
    ]
    _draw_polygon(img, pts, ox, oy)
    holes_mm = [(0, y_top + h_top / 2, 4), (-12, y_bot - 15, 4), (12, y_bot - 15, 4)]
    holes = []
    bx_min = min(p[0] for p in pts)
    by_min = min(p[1] for p in pts)
    for cx, cy, r in holes_mm:
        _draw_circle_hole(img, cx, cy, r, ox, oy)
        holes.append({"type": "circle", "center_mm": [round(cx - bx_min, 2), round(cy - by_min, 2)], "radius_mm": r})
    _save("bracket.png", img, {
        "image": "bracket.png",
        "reference_width_mm": w_top, "reference_height_mm": total_h,
        "outer_shape": "t_shape", "outer_vertex_count": 8,
        "holes": holes, "expected_hole_count": 3,
        "tolerance_pct": 1.5, "tolerance_abs_mm": 0.5
    })


# --- 3. irregular_part ---
def gen_irregular_part():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    n, r_outer = 7, 70
    pts = [(r_outer * math.cos(2 * math.pi * i / n - math.pi / 2),
            r_outer * math.sin(2 * math.pi * i / n - math.pi / 2)) for i in range(n)]
    _draw_polygon(img, pts, ox, oy)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    actual_w, actual_h = max(xs) - min(xs), max(ys) - min(ys)
    holes_mm = [(-20, -15, 5), (20, -15, 5), (0, 20, 5)]
    holes = []
    for cx, cy, r in holes_mm:
        _draw_circle_hole(img, cx, cy, r, ox, oy)
        holes.append({"type": "circle", "center_mm": [round(cx - min(xs), 2), round(cy - min(ys), 2)], "radius_mm": r})
    _save("irregular_part.png", img, {
        "image": "irregular_part.png",
        "reference_width_mm": round(actual_w, 2), "reference_height_mm": round(actual_h, 2),
        "outer_shape": "heptagon", "outer_vertex_count": 7,
        "holes": holes, "expected_hole_count": 3,
        "tolerance_pct": 2.0, "tolerance_abs_mm": 0.8
    })


# --- 4. circle_plate ---
def gen_circle_plate():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    r = 40
    cv2.circle(img, (ox, oy), _px(r), FG, THICKNESS)
    _draw_circle_hole(img, 0, 0, 3, ox, oy)
    _save("circle_plate.png", img, {
        "image": "circle_plate.png",
        "reference_width_mm": 80, "reference_height_mm": 80,
        "outer_shape": "circle", "outer_vertex_count": 0,
        "holes": [{"type": "circle", "center_mm": [40, 40], "radius_mm": 3}],
        "expected_hole_count": 1,
        "tolerance_pct": 2.0, "tolerance_abs_mm": 0.5
    })


# --- 5. oblong_slot ---
def gen_oblong_slot():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    w, h = 150, 40
    _draw_polygon(img, _rect_pts(w, h), ox, oy)
    slot_w, slot_h = 20, 8
    for sx in [-1, 1]:
        cx_mm, cy_mm = sx * 40, 0
        cx_px, cy_px = ox + _px(cx_mm), oy + _px(cy_mm)
        r_px = _px(slot_h / 2)
        half_w_px = _px(slot_w / 2 - slot_h / 2)
        cv2.ellipse(img, (cx_px - half_w_px, cy_px), (r_px, r_px), 0, 90, 270, FG, HOLE_THICKNESS)
        cv2.ellipse(img, (cx_px + half_w_px, cy_px), (r_px, r_px), 0, -90, 90, FG, HOLE_THICKNESS)
        cv2.line(img, (cx_px - half_w_px, cy_px - r_px), (cx_px + half_w_px, cy_px - r_px), FG, HOLE_THICKNESS)
        cv2.line(img, (cx_px - half_w_px, cy_px + r_px), (cx_px + half_w_px, cy_px + r_px), FG, HOLE_THICKNESS)
    _save("oblong_slot.png", img, {
        "image": "oblong_slot.png",
        "reference_width_mm": w, "reference_height_mm": h,
        "outer_shape": "rectangle", "outer_vertex_count": 4,
        "holes": [
            {"type": "slot", "center_mm": [w / 2 - 40, h / 2], "width_mm": slot_w, "height_mm": slot_h},
            {"type": "slot", "center_mm": [w / 2 + 40, h / 2], "width_mm": slot_w, "height_mm": slot_h},
        ],
        "expected_hole_count": 2,
        "tolerance_pct": 2.0, "tolerance_abs_mm": 0.5
    })


# --- 6. mounting_plate ---
def gen_mounting_plate():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    w, h = 200, 100
    _draw_polygon(img, _rect_pts(w, h), ox, oy)
    holes = []
    for row in [-1, 1]:
        for col in range(4):
            cx, cy = -w / 2 + 25 + col * 50, row * 25
            _draw_circle_hole(img, cx, cy, 3, ox, oy)
            holes.append({"type": "circle", "center_mm": [round(cx + w / 2, 2), round(cy + h / 2, 2)], "radius_mm": 3})
    _save("mounting_plate.png", img, {
        "image": "mounting_plate.png",
        "reference_width_mm": w, "reference_height_mm": h,
        "outer_shape": "rectangle", "outer_vertex_count": 4,
        "holes": holes, "expected_hole_count": 8,
        "tolerance_pct": 1.0, "tolerance_abs_mm": 0.5
    })


# --- 7. gasket_ring ---
def gen_gasket_ring():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    od, id_ = 100, 60
    cv2.circle(img, (ox, oy), _px(od / 2), FG, THICKNESS)
    cv2.circle(img, (ox, oy), _px(id_ / 2), FG, HOLE_THICKNESS)
    holes = [{"type": "circle", "center_mm": [od / 2, od / 2], "radius_mm": id_ / 2}]
    bolt_r, bolt_circle_r = 4, 38
    for i in range(6):
        angle = 2 * math.pi * i / 6
        cx, cy = bolt_circle_r * math.cos(angle), bolt_circle_r * math.sin(angle)
        _draw_circle_hole(img, cx, cy, bolt_r, ox, oy)
        holes.append({"type": "circle", "center_mm": [round(cx + od / 2, 2), round(cy + od / 2, 2)], "radius_mm": bolt_r})
    _save("gasket_ring.png", img, {
        "image": "gasket_ring.png",
        "reference_width_mm": od, "reference_height_mm": od,
        "outer_shape": "circle", "outer_vertex_count": 0,
        "holes": holes, "expected_hole_count": 7,
        "tolerance_pct": 2.0, "tolerance_abs_mm": 0.5
    })


# --- 8. triangle_gusset ---
def gen_triangle_gusset():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    w, h = 80, 60
    pts = [(-w / 2, h / 2), (w / 2, h / 2), (-w / 2, -h / 2)]
    _draw_polygon(img, pts, ox, oy)
    _draw_circle_hole(img, -w / 2 + 25, h / 2 - 20, 5, ox, oy)
    _save("triangle_gusset.png", img, {
        "image": "triangle_gusset.png",
        "reference_width_mm": w, "reference_height_mm": h,
        "outer_shape": "triangle", "outer_vertex_count": 3,
        "holes": [{"type": "circle", "center_mm": [25, 40], "radius_mm": 5}],
        "expected_hole_count": 1,
        "tolerance_pct": 2.0, "tolerance_abs_mm": 0.5
    })


# --- 9. hex_plate ---
def gen_hex_plate():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    side = 60
    pts = [(side * math.cos(2 * math.pi * i / 6 + math.pi / 6),
            side * math.sin(2 * math.pi * i / 6 + math.pi / 6)) for i in range(6)]
    _draw_polygon(img, pts, ox, oy)
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    actual_w, actual_h = max(xs) - min(xs), max(ys) - min(ys)
    _draw_circle_hole(img, 0, 0, 8, ox, oy)
    _save("hex_plate.png", img, {
        "image": "hex_plate.png",
        "reference_width_mm": round(actual_w, 2), "reference_height_mm": round(actual_h, 2),
        "outer_shape": "hexagon", "outer_vertex_count": 6,
        "holes": [{"type": "circle", "center_mm": [round(actual_w / 2, 2), round(actual_h / 2, 2)], "radius_mm": 8}],
        "expected_hole_count": 1,
        "tolerance_pct": 2.0, "tolerance_abs_mm": 0.5
    })


# --- 10. notched_rect ---
def gen_notched_rect():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    w, h, notch_w, notch_h = 120, 80, 30, 25
    pts = [
        (-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, -notch_h / 2),
        (w / 2 - notch_w, -notch_h / 2), (w / 2 - notch_w, notch_h / 2),
        (w / 2, notch_h / 2), (w / 2, h / 2), (-w / 2, h / 2),
    ]
    _draw_polygon(img, pts, ox, oy)
    holes_mm = [(-w / 2 + 20, 0, 4), (0, 0, 4)]
    holes = []
    x_min, y_min = min(p[0] for p in pts), min(p[1] for p in pts)
    for cx, cy, r in holes_mm:
        _draw_circle_hole(img, cx, cy, r, ox, oy)
        holes.append({"type": "circle", "center_mm": [round(cx - x_min, 2), round(cy - y_min, 2)], "radius_mm": r})
    _save("notched_rect.png", img, {
        "image": "notched_rect.png",
        "reference_width_mm": w, "reference_height_mm": h,
        "outer_shape": "notched_rectangle", "outer_vertex_count": 8,
        "holes": holes, "expected_hole_count": 2,
        "tolerance_pct": 1.5, "tolerance_abs_mm": 0.5
    })


# --- 11. large_plate ---
def gen_large_plate():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    w, h = 220, 150
    _draw_polygon(img, _rect_pts(w, h), ox, oy)
    holes = []
    for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
        cx, cy = sx * (w / 2 - 20), sy * (h / 2 - 20)
        _draw_circle_hole(img, cx, cy, 5, ox, oy)
        holes.append({"type": "circle", "center_mm": [round(cx + w / 2, 2), round(cy + h / 2, 2)], "radius_mm": 5})
    _save("large_plate.png", img, {
        "image": "large_plate.png",
        "reference_width_mm": w, "reference_height_mm": h,
        "outer_shape": "rectangle", "outer_vertex_count": 4,
        "holes": holes, "expected_hole_count": 4,
        "tolerance_pct": 1.0, "tolerance_abs_mm": 0.5
    })


# --- 12. small_washer ---
def gen_small_washer():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    od = 40
    cv2.circle(img, (ox, oy), _px(od / 2), FG, THICKNESS)
    _draw_circle_hole(img, 0, 0, 8, ox, oy)
    _save("small_washer.png", img, {
        "image": "small_washer.png",
        "reference_width_mm": od, "reference_height_mm": od,
        "outer_shape": "circle", "outer_vertex_count": 0,
        "holes": [{"type": "circle", "center_mm": [od / 2, od / 2], "radius_mm": 8}],
        "expected_hole_count": 1,
        "tolerance_pct": 2.0, "tolerance_abs_mm": 0.5
    })


# --- 13. diamond_plate ---
def gen_diamond_plate():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    half = 50
    pts = [(0, -half), (half, 0), (0, half), (-half, 0)]
    _draw_polygon(img, pts, ox, oy)
    _draw_circle_hole(img, 0, 0, 5, ox, oy)
    _save("diamond_plate.png", img, {
        "image": "diamond_plate.png",
        "reference_width_mm": 2 * half, "reference_height_mm": 2 * half,
        "outer_shape": "diamond", "outer_vertex_count": 4,
        "holes": [{"type": "circle", "center_mm": [half, half], "radius_mm": 5}],
        "expected_hole_count": 1,
        "tolerance_pct": 2.0, "tolerance_abs_mm": 0.5
    })


# --- 14. pcb_outline ---
def gen_pcb_outline():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    w, h = 85, 55
    _draw_polygon(img, _rect_pts(w, h), ox, oy)
    holes = []
    for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
        cx, cy = sx * (w / 2 - 5), sy * (h / 2 - 5)
        _draw_circle_hole(img, cx, cy, 2.5, ox, oy)
        holes.append({"type": "circle", "center_mm": [round(cx + w / 2, 2), round(cy + h / 2, 2)], "radius_mm": 2.5})
    _save("pcb_outline.png", img, {
        "image": "pcb_outline.png",
        "reference_width_mm": w, "reference_height_mm": h,
        "outer_shape": "rectangle", "outer_vertex_count": 4,
        "holes": holes, "expected_hole_count": 4,
        "tolerance_pct": 1.5, "tolerance_abs_mm": 0.5
    })


# --- 15. rounded_rect ---
def gen_rounded_rect():
    img = np.full((CANVAS[1], CANVAS[0]), BG, dtype=np.uint8)
    ox, oy = _origin()
    w, h, corner_r = 120, 60, 10
    pts = []
    # Continuous, non-self-intersecting rounded rectangle
    # 1. Top-right arc (-90° to 0°)
    cx, cy = w / 2 - corner_r, -h / 2 + corner_r
    for deg in range(-90, 1, 5):
        rad = math.radians(deg)
        pts.append((cx + corner_r * math.cos(rad), cy + corner_r * math.sin(rad)))

    # 2. Bottom-right arc (0° to 90°)
    cx, cy = w / 2 - corner_r, h / 2 - corner_r
    for deg in range(0, 91, 5):
        rad = math.radians(deg)
        pts.append((cx + corner_r * math.cos(rad), cy + corner_r * math.sin(rad)))

    # 3. Bottom-left arc (90° to 180°)
    cx, cy = -w / 2 + corner_r, h / 2 - corner_r
    for deg in range(90, 181, 5):
        rad = math.radians(deg)
        pts.append((cx + corner_r * math.cos(rad), cy + corner_r * math.sin(rad)))

    # 4. Top-left arc (180° to 270°)
    cx, cy = -w / 2 + corner_r, -h / 2 + corner_r
    for deg in range(180, 271, 5):
        rad = math.radians(deg)
        pts.append((cx + corner_r * math.cos(rad), cy + corner_r * math.sin(rad)))
    _draw_polygon(img, pts, ox, oy)
    holes_mm = [(-30, 0, 4), (0, 0, 4), (30, 0, 4)]
    holes = []
    for cx, cy, r in holes_mm:
        _draw_circle_hole(img, cx, cy, r, ox, oy)
        holes.append({"type": "circle", "center_mm": [round(cx + w / 2, 2), round(cy + h / 2, 2)], "radius_mm": r})
    _save("rounded_rect.png", img, {
        "image": "rounded_rect.png",
        "reference_width_mm": w, "reference_height_mm": h,
        "outer_shape": "rounded_rectangle", "outer_vertex_count": -1,
        "holes": holes, "expected_hole_count": 3,
        "tolerance_pct": 2.0, "tolerance_abs_mm": 0.5
    })


# ===== DEGRADED VARIANTS =====
def _load_clean(name):
    return cv2.imread(str(IMG_DIR / name), cv2.IMREAD_GRAYSCALE)

def _load_gt(name):
    with open(GT_DIR / name.replace(".png", ".json")) as f:
        return json.load(f)

def gen_degraded_blur(source="simple_plate.png"):
    img = cv2.GaussianBlur(_load_clean(source), (7, 7), 2.0)
    gt = _load_gt(source)
    name = source.replace(".png", "_blur.png")
    gt["image"] = name
    gt["degradation"] = "gaussian_blur_k7_s2"
    gt["tolerance_pct"] = max(gt["tolerance_pct"], 3.0)
    gt["tolerance_abs_mm"] = max(gt["tolerance_abs_mm"], 1.0)
    _save(name, img, gt)

def gen_degraded_tilt(source="mounting_plate.png"):
    img = _load_clean(source)
    h, w = img.shape
    M = cv2.getRotationMatrix2D((w // 2, h // 2), 5, 1.0)
    rotated = cv2.warpAffine(img, M, (w, h), borderValue=255)
    gt = _load_gt(source)
    name = source.replace(".png", "_tilt5.png")
    gt["image"] = name
    gt["degradation"] = "rotation_5deg"
    gt["tolerance_pct"] = max(gt["tolerance_pct"], 4.0)
    gt["tolerance_abs_mm"] = max(gt["tolerance_abs_mm"], 2.0)
    _save(name, rotated, gt)

def gen_degraded_uneven_light(source="bracket.png"):
    img = _load_clean(source)
    h, w = img.shape
    gradient = np.tile(np.linspace(0.6, 1.0, w, dtype=np.float32), (h, 1))
    result = np.clip(img.astype(np.float32) * gradient, 0, 255).astype(np.uint8)
    gt = _load_gt(source)
    name = source.replace(".png", "_uneven_light.png")
    gt["image"] = name
    gt["degradation"] = "uneven_lighting_gradient"
    gt["tolerance_pct"] = max(gt["tolerance_pct"], 3.0)
    gt["tolerance_abs_mm"] = max(gt["tolerance_abs_mm"], 1.0)
    _save(name, result, gt)

def gen_degraded_jpeg(source="hex_plate.png"):
    img = _load_clean(source)
    _, buf = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 25])
    decoded = cv2.imdecode(buf, cv2.IMREAD_GRAYSCALE)
    gt = _load_gt(source)
    name = source.replace(".png", "_jpeg25.png")
    gt["image"] = name
    gt["degradation"] = "jpeg_quality_25"
    gt["tolerance_pct"] = max(gt["tolerance_pct"], 3.0)
    gt["tolerance_abs_mm"] = max(gt["tolerance_abs_mm"], 1.0)
    _save(name, decoded, gt)

def gen_degraded_noise(source="triangle_gusset.png"):
    img = _load_clean(source)
    noisy = img.copy()
    n_pixels = int(0.01 * img.size)
    rng = np.random.default_rng(42)
    coords = [rng.integers(0, i, n_pixels) for i in img.shape]
    noisy[coords[0], coords[1]] = 255
    coords = [rng.integers(0, i, n_pixels) for i in img.shape]
    noisy[coords[0], coords[1]] = 0
    gt = _load_gt(source)
    name = source.replace(".png", "_noisy.png")
    gt["image"] = name
    gt["degradation"] = "salt_pepper_1pct"
    gt["tolerance_pct"] = max(gt["tolerance_pct"], 3.0)
    gt["tolerance_abs_mm"] = max(gt["tolerance_abs_mm"], 1.0)
    _save(name, noisy, gt)


def main():
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    GT_DIR.mkdir(parents=True, exist_ok=True)
    print("Generating 15 clean synthetic images...")
    gen_simple_plate(); gen_bracket(); gen_irregular_part(); gen_circle_plate()
    gen_oblong_slot(); gen_mounting_plate(); gen_gasket_ring(); gen_triangle_gusset()
    gen_hex_plate(); gen_notched_rect(); gen_large_plate(); gen_small_washer()
    gen_diamond_plate(); gen_pcb_outline(); gen_rounded_rect()
    print("\nGenerating 5 degraded variants...")
    gen_degraded_blur(); gen_degraded_tilt(); gen_degraded_uneven_light()
    gen_degraded_jpeg(); gen_degraded_noise()
    print(f"\nDone. {len(list(IMG_DIR.glob('*.png')))} images in {IMG_DIR}")

if __name__ == "__main__":
    main()
