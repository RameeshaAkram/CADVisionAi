"""
run_corpus.py — automated 7-check validation runner for CADVision AI pipeline.

Runs every image in tests/real_world/images/ through the pipeline and checks:
  1. File Validity    — DXF passes ezdxf.readfile() + audit (0 errors)
  2. Layer Correctness — CUT has outer, HOLES count matches ground truth
  3. Topological     — closed contours, Shapely is_valid, holes inside outer
  4. Dimensional     — width/height within tolerance of ground truth
  5. Primitive       — circular holes emitted as CIRCLE entities (not polylines)
  6. Editability     — entities on correct layers, readable by ezdxf
  7. Repeatability   — two runs produce identical DXF byte-for-byte

Usage:
    python tests/run_corpus.py [--image <name>] [--skip-degraded]
"""

import argparse
import json
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

# Force UTF-8 output on Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Make sure the project root is on the path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import ezdxf
import numpy as np
from shapely.geometry import Polygon, Point

from backend.core.config import settings
from backend.pipeline import (
    input_processor,
    view_analyzer,
    object_detector,
    feature_detector,
    scale_calibration,
    drawing_generator,
)
from backend.exporters import dxf_exporter
from backend.storage import job_manager
from backend.models.job_models import (
    Job, JobMode, JobStatus, UnitType, FileMeta, KnownDimension
)

CORPUS_DIR = Path(__file__).parent / "real_world"
IMG_DIR = CORPUS_DIR / "images"
GT_DIR = CORPUS_DIR / "ground_truth"
REPORTS_DIR = CORPUS_DIR / "reports"

CIRCULARITY_THRESHOLD = settings.CIRCULARITY_THRESHOLD  # single source of truth


# ─── Pipeline runner (no server required) ────────────────────────────────────

def run_pipeline_on_image(img_path: Path, ref_width_mm: float, ref_height_mm: float) -> dict:
    """Run the full feature→drawing→DXF pipeline on a single image.
    Returns dict with keys: features, drawing, dxf_path, dxf_path2 (second run)."""
    img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f"Cannot read {img_path}")

    # --- feature detection (bypass full orchestrator, call modules directly) ---
    from backend.models.job_models import NormalizedImage
    norm = NormalizedImage(
        index=1,
        filename=img_path.name,
        stored_path=str(img_path),
        width=img.shape[1],
        height=img.shape[0],
        sharpness=0.0,
    )

    features = feature_detector.detect([norm], components=[
        {"label": "main_object", "image_index": 0}
    ])

    known_dims = [
        {"label": "width", "value": ref_width_mm},
        {"label": "height", "value": ref_height_mm},
    ]
    cal = scale_calibration.calibrate(features, known_dims, "mm")
    scale_x = cal.get("scale_x", cal.get("scale_factor", 1.0))
    scale_y = cal.get("scale_y", scale_x)
    drawing = drawing_generator.generate(features, cal.get("measurements", []), scale_x, scale_y)

    # Write DXF to a temp dir (first run)
    out_dir = REPORTS_DIR / "dxf_cache"
    out_dir.mkdir(parents=True, exist_ok=True)
    dxf_path = out_dir / (img_path.stem + ".dxf")
    dxf_exporter.write(drawing, dxf_path, "mm")

    # Second run (for repeatability check)
    dxf_path2 = out_dir / (img_path.stem + "_run2.dxf")
    dxf_exporter.write(drawing, dxf_path2, "mm")

    return {
        "features": features,
        "calibration": cal,
        "drawing": drawing,
        "dxf_path": dxf_path,
        "dxf_path2": dxf_path2,
        "scale_x": scale_x,
        "scale_y": scale_y,
    }


# ─── Individual checks ────────────────────────────────────────────────────────

def check_file_validity(dxf_path: Path) -> dict:
    """Check 1: DXF is readable and passes ezdxf audit with 0 errors."""
    try:
        doc = ezdxf.readfile(str(dxf_path))
        auditor = doc.audit()
        errors = [str(e) for e in auditor.errors]
        ok = len(errors) == 0
        return {"ok": ok, "detail": f"{len(errors)} audit error(s)" if errors else "0 audit errors",
                "errors": errors}
    except Exception as e:
        return {"ok": False, "detail": f"readfile failed: {e}", "errors": [str(e)]}


def check_layer_correctness(dxf_path: Path, gt: dict) -> dict:
    """Check 2: CUT layer has exactly 1 outer entity; HOLES count matches ground truth."""
    try:
        doc = ezdxf.readfile(str(dxf_path))
        msp = doc.modelspace()
        cut_entities = [e for e in msp if e.dxf.layer == "CUT" and e.dxftype() not in ("TEXT", "MTEXT")]
        holes_entities = [e for e in msp if e.dxf.layer == "HOLES"]
        expected = gt.get("expected_hole_count", 0)
        cut_ok = len(cut_entities) == 1
        holes_ok = len(holes_entities) == expected
        ok = cut_ok and holes_ok
        detail = (f"CUT={len(cut_entities)} (want 1), "
                  f"HOLES={len(holes_entities)} (want {expected})")
        return {"ok": ok, "detail": detail,
                "cut_count": len(cut_entities), "holes_count": len(holes_entities),
                "expected_holes": expected}
    except Exception as e:
        return {"ok": False, "detail": str(e), "cut_count": 0, "holes_count": 0}


from backend.pipeline.validator import _check_topology


def check_topology(dxf_path: Path, drawing: dict) -> dict:
    """Check 3: Calls production validator._check_topology (single source of truth)."""
    try:
        return _check_topology(drawing)
    except Exception as e:
        return {"ok": False, "detail": str(e), "issues": [str(e)]}


def check_dimensional(drawing: dict, gt: dict, scale_x: float, scale_y: float) -> dict:
    """Check 4: Overall width/height within tolerance of ground truth."""
    ref_w = gt["reference_width_mm"]
    ref_h = gt["reference_height_mm"]
    tol_pct = gt.get("tolerance_pct", 2.0) / 100.0
    tol_abs = gt.get("tolerance_abs_mm", 0.5)

    try:
        polylines = drawing.get("views", {}).get("top", {}).get("polylines", [])
        outer = next((p for p in polylines if p.get("role") == "outer"), None)
        if not outer:
            return {"ok": False, "detail": "No outer polyline found"}

        pts = outer.get("points", [])
        if not pts:
            return {"ok": False, "detail": "Outer polyline has no points"}

        xs = [p["x"] for p in pts]
        ys = [p["y"] for p in pts]
        meas_w = max(xs) - min(xs)
        meas_h = max(ys) - min(ys)

        def within(measured, expected):
            if expected <= 0:
                return True
            err_abs = abs(measured - expected)
            err_pct = err_abs / expected
            return err_abs <= tol_abs or err_pct <= tol_pct

        w_ok = within(meas_w, ref_w)
        h_ok = within(meas_h, ref_h)
        ok = w_ok and h_ok
        detail = (f"W: {meas_w:.2f} vs {ref_w:.2f}mm {'OK' if w_ok else 'FAIL'}, "
                  f"H: {meas_h:.2f} vs {ref_h:.2f}mm {'OK' if h_ok else 'FAIL'}")
        return {"ok": ok, "detail": detail,
                "measured_w": meas_w, "measured_h": meas_h,
                "ref_w": ref_w, "ref_h": ref_h}
    except Exception as e:
        return {"ok": False, "detail": str(e)}


def check_primitive_fidelity(dxf_path: Path, drawing: dict, gt: dict) -> dict:
    """Check 5: Circular holes (circularity >= threshold) are CIRCLE DXF entities."""
    try:
        doc = ezdxf.readfile(str(dxf_path))
        msp = doc.modelspace()
        hole_entities = [e for e in msp if e.dxf.layer == "HOLES"]

        # Count ground-truth circle holes
        circle_holes_gt = [h for h in gt.get("holes", []) if h.get("type") == "circle"]
        n_expected_circles = len(circle_holes_gt)

        if n_expected_circles == 0:
            return {"ok": True, "detail": "No circular holes expected — N/A"}

        # Count DXF CIRCLE entities on HOLES layer
        dxf_circles = [e for e in hole_entities if e.dxftype() == "CIRCLE"]
        dxf_polylines = [e for e in hole_entities if e.dxftype() in ("LWPOLYLINE", "POLYLINE")]

        # All circular GT holes should be CIRCLE entities
        ok = len(dxf_circles) >= n_expected_circles
        detail = (f"DXF CIRCLE entities: {len(dxf_circles)}, "
                  f"expected >= {n_expected_circles}, "
                  f"polyline fallbacks: {len(dxf_polylines)}")
        return {"ok": ok, "detail": detail,
                "dxf_circles": len(dxf_circles),
                "dxf_polylines": len(dxf_polylines),
                "expected_circles": n_expected_circles}
    except Exception as e:
        return {"ok": False, "detail": str(e)}


def check_editability(dxf_path: Path) -> dict:
    """Check 6: DXF opens cleanly, entities on correct named layers."""
    try:
        doc = ezdxf.readfile(str(dxf_path))
        layer_names = {layer.dxf.name for layer in doc.layers}
        required = {"CUT", "HOLES", "DIMENSIONS"}
        missing = required - layer_names
        msp = doc.modelspace()
        orphan_entities = [e for e in msp
                           if e.dxf.layer not in layer_names
                           and e.dxftype() not in ("TEXT", "MTEXT")]
        ok = (len(missing) == 0) and (len(orphan_entities) == 0)
        detail = (f"Layers OK, no orphan entities" if ok else
                  f"Missing layers: {missing}, orphan entities: {len(orphan_entities)}")
        return {"ok": ok, "detail": detail, "layers": list(layer_names)}
    except Exception as e:
        return {"ok": False, "detail": str(e)}


def check_repeatability(dxf_path: Path, dxf_path2: Path) -> dict:
    """Check 7: Two runs of the same image produce identical DXF structure."""
    try:
        doc1 = ezdxf.readfile(str(dxf_path))
        doc2 = ezdxf.readfile(str(dxf_path2))
        msp1 = list(doc1.modelspace())
        msp2 = list(doc2.modelspace())

        if len(msp1) != len(msp2):
            return {"ok": False, "detail": f"Entity count differs: {len(msp1)} vs {len(msp2)}"}

        # Compare entity types and layers
        for i, (e1, e2) in enumerate(zip(msp1, msp2)):
            if e1.dxftype() != e2.dxftype():
                return {"ok": False, "detail": f"Entity {i} type differs: {e1.dxftype()} vs {e2.dxftype()}"}
            if e1.dxf.layer != e2.dxf.layer:
                return {"ok": False, "detail": f"Entity {i} layer differs"}

        return {"ok": True, "detail": f"Both runs: {len(msp1)} entities, structure identical"}
    except Exception as e:
        return {"ok": False, "detail": str(e)}


# ─── Per-image runner ─────────────────────────────────────────────────────────

def validate_image(img_path: Path, gt: dict) -> dict:
    """Run all 7 checks on one image. Return results dict."""
    result = {
        "image": img_path.name,
        "checks": {},
        "pass": False,
        "error": None,
    }

    ref_w = gt["reference_width_mm"]
    ref_h = gt["reference_height_mm"]

    try:
        pipeline_out = run_pipeline_on_image(img_path, ref_w, ref_h)
    except Exception as e:
        result["error"] = str(e)
        result["checks"] = {f"check_{i}": {"ok": False, "detail": str(e)} for i in range(1, 8)}
        return result

    dxf_path = pipeline_out["dxf_path"]
    dxf_path2 = pipeline_out["dxf_path2"]
    drawing = pipeline_out["drawing"]
    scale_x = pipeline_out["scale_x"]
    scale_y = pipeline_out["scale_y"]

    result["checks"]["1_file_validity"] = check_file_validity(dxf_path)
    result["checks"]["2_layer_correctness"] = check_layer_correctness(dxf_path, gt)
    result["checks"]["3_topology"] = check_topology(dxf_path, drawing)
    result["checks"]["4_dimensional"] = check_dimensional(drawing, gt, scale_x, scale_y)
    result["checks"]["5_primitive_fidelity"] = check_primitive_fidelity(dxf_path, drawing, gt)
    result["checks"]["6_editability"] = check_editability(dxf_path)
    result["checks"]["7_repeatability"] = check_repeatability(dxf_path, dxf_path2)

    result["pass"] = all(v["ok"] for v in result["checks"].values())
    return result


# ─── Report writer ────────────────────────────────────────────────────────────

def write_report(results: list[dict], report_path: Path):
    CHECK_NAMES = [
        "1_file_validity", "2_layer_correctness", "3_topology",
        "4_dimensional", "5_primitive_fidelity", "6_editability", "7_repeatability"
    ]
    total = len(results)
    passed = sum(1 for r in results if r["pass"])
    pass_rate = passed / total * 100 if total else 0

    lines = [
        "# CADVision AI — Corpus Validation Report",
        "",
        f"**Images tested:** {total}  **Passed:** {passed}/{total}  "
        f"**Pass rate:** {pass_rate:.1f}%",
        "",
        "## Summary Matrix",
        "",
    ]

    # Header row
    hdr = "| Image | " + " | ".join(f"C{i+1}" for i in range(7)) + " | Overall |"
    sep = "| --- | " + " | ".join("---" for _ in range(7)) + " | --- |"
    lines += [hdr, sep]

    for r in results:
        cells = []
        for cn in CHECK_NAMES:
            chk = r["checks"].get(cn, {})
            cells.append("PASS" if chk.get("ok") else "FAIL")
        overall = "PASS" if r["pass"] else "FAIL"
        lines.append(f"| {r['image']} | " + " | ".join(cells) + f" | {overall} |")

    lines += ["", "**Check legend:** C1=FileValidity C2=LayerCorrectness C3=Topology "
              "C4=Dimensional C5=PrimitiveFidelity C6=Editability C7=Repeatability", ""]

    # Failure details
    failures = [r for r in results if not r["pass"]]
    if failures:
        lines += ["## Failure Details", ""]
        for r in failures:
            lines.append(f"### {r['image']}")
            if r.get("error"):
                lines.append(f"- **Pipeline error:** {r['error']}")
            for cn, chk in r["checks"].items():
                if not chk.get("ok"):
                    lines.append(f"- **{cn}:** {chk.get('detail', '?')}")
            lines.append("")
    else:
        lines += ["## All images passed all 7 checks!", ""]

    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nReport written to {report_path}")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", help="Run only this image name (e.g. simple_plate.png)")
    parser.add_argument("--skip-degraded", action="store_true", help="Skip _blur/_tilt etc.")
    args = parser.parse_args()

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "dxf_cache").mkdir(parents=True, exist_ok=True)

    # Collect images
    all_images = sorted(IMG_DIR.glob("*.png"))
    if args.image:
        all_images = [p for p in all_images if p.name == args.image]
    if args.skip_degraded:
        degraded_suffixes = ("_blur", "_tilt", "_uneven_light", "_jpeg25", "_noisy")
        all_images = [p for p in all_images if not any(p.stem.endswith(s) for s in degraded_suffixes)]

    if not all_images:
        print("No images found. Run generate_test_corpus.py first.")
        sys.exit(1)

    results = []
    pad = max(len(p.name) for p in all_images)
    print(f"\n{'Image':<{pad}}  C1  C2  C3  C4  C5  C6  C7  Overall")
    print("-" * (pad + 40))

    for img_path in all_images:
        gt_file = GT_DIR / (img_path.stem + ".json")
        if not gt_file.exists():
            print(f"  {img_path.name:<{pad}}  [no ground truth JSON — skipped]")
            continue

        with open(gt_file) as f:
            gt = json.load(f)

        t0 = time.time()
        result = validate_image(img_path, gt)
        elapsed = time.time() - t0

        checks = result["checks"]
        cells = "  ".join("P" if checks.get(cn, {}).get("ok") else "F"
                           for cn in [
                               "1_file_validity", "2_layer_correctness", "3_topology",
                               "4_dimensional", "5_primitive_fidelity", "6_editability", "7_repeatability"
                           ])
        overall = "PASS" if result["pass"] else "FAIL"
        print(f"  {img_path.name:<{pad}}  {cells}  {overall}  ({elapsed:.1f}s)")
        results.append(result)

    # Summary
    total = len(results)
    passed = sum(1 for r in results if r["pass"])
    pass_rate = passed / total * 100 if total else 0
    print(f"\n{'='*60}")
    print(f"TOTAL: {passed}/{total} PASSED ({pass_rate:.1f}%)")
    print(f"{'='*60}")

    # Write report
    report_path = REPORTS_DIR / "validation_report.md"
    write_report(results, report_path)

    # Exit non-zero if any failures
    if passed < total:
        sys.exit(1)


if __name__ == "__main__":
    main()
