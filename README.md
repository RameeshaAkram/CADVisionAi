# CADVision AI

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?style=flat&logo=React&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?style=flat&logo=TypeScript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC.svg?style=flat&logo=Tailwind-CSS&logoColor=white)](https://tailwindcss.com)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.10-5C3EE8.svg?style=flat&logo=OpenCV&logoColor=white)](https://opencv.org)
[![ezdxf](https://img.shields.io/badge/ezdxf-1.3.1-blue.svg?style=flat)](https://ezdxf.mozman.at)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB.svg?style=flat&logo=Python&logoColor=white)](https://www.python.org)
[![Tests](https://img.shields.io/badge/Pytest-23%2F23%20Passing-brightgreen.svg?style=flat)](https://docs.pytest.org)
[![Corpus](https://img.shields.io/badge/Evaluation%20Corpus-23%2F23%20(100%25)-brightgreen.svg?style=flat)](#validation-and-evaluation-corpus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Automated Computer Vision & Computational Geometry Engine**  
> *Transform ordinary photographs of flat mechanical parts and sheet metal components into industrial-grade, CNC-ready AutoCAD R2018 DXF files and 3D watertight STL models.*


---

## 📌 Repository Description

**CADVision AI** is an automated reverse-engineering platform that reconstructs production-ready 2D CAD vector drawings (AutoCAD DXF) and 3D watertight solid meshes (STL) directly from photographs. Powered by a 9-stage computational geometry pipeline, it features perspective tilt rectification, illumination flat-field normalization, sub-pixel corner refinement, algebraic circle fitting, and strict Shapely topology verification.

---

## 🚀 Key Features

### 📐 Precision Computational Geometry Engine
* **Native CAD Circle Primitives**: Employs algebraic **Kåsa & Pratt least-squares circle fitting** to identify circular holes and export them as true AutoCAD `CIRCLE` entities on the `HOLES` layer rather than segmented polylines.
* **Camera Perspective Rectification**: Detects workpiece keystoning quadrilaterals, estimates off-axis tilt angle, bypasses planar captures ($<3^\circ$), compensates foreshortening via homography warp ($3^\circ-30^\circ$), and enforces a **hard rejection safety boundary** for extreme angles ($>30^\circ$).
* **Illumination Normalization**: Dynamic large-kernel Gaussian flat-field correction cancels out lighting gradients, shadows, and vignetting across light and dark presentation surfaces.
* **Dual-Tier Feature Detection**: Global Otsu thresholding coupled with an automated **Gaussian Adaptive threshold fallback** to ensure reliable contour extraction on low-contrast and noisy inputs.
* **Sub-Pixel Corner Refinement**: Refines polygonal corner vertices using `cv2.cornerSubPix` for sub-pixel dimensional accuracy.
* **Geometric Regularization**: Snaps edges within $\pm 2.0^\circ$ of cardinal directions ($0^\circ, 90^\circ, 180^\circ, 270^\circ$) to exact orthogonal axes and merges collinear segments ($<3.0^\circ$).

### 🛡️ Strict Topological Safety Net
* **Shapely Validation**: Converts all profiles into Shapely polygons to detect and log self-intersections, auto-repairing via `polygon.buffer(0)`.
* **Full Boundary Containment**: Enforces that all internal cutouts reside strictly inside the outer boundary (`outer.contains(hole)`).
* **Hole Non-Overlap Auditing**: Ensures pairwise non-intersection of internal features.
* **Winding Normalization**: Enforces standardized CAD conventions (Counter-Clockwise for outer boundaries, Clockwise for internal holes).

### 🖥️ Interactive Engineering Workbench
* **Dual CAD Viewing Themes**: Toggle between dark **Blueprint Mode** (`#0A1014` background with cyan vectors and crimson holes) and light **Engineering Paper Mode**.
* **Drafting Overlays**: Real-time ISO center crosshairs (`+`) on circular features, quadrant handles, and parametric CAD dimension lines with $45^\circ$ oblique ticks.
* **ISO 7200 Title Block**: Standardized title block displaying scale, projection angle, format, unit of measure, and date.
* **Real-time Pan & Zoom**: Smooth navigation with live cursor CAD coordinates readout and extents HUD.

---

## 🏗️ System Architecture

```text
[ Physical Part Photo ]
         │
         ▼
 1. Input Processing ──────────► Orientation correction, aspect-preserving downsampling
         │
         ▼
 2. View Analysis ─────────────► Laplacian variance sharpness & contrast scoring
         │
         ▼
 3. Object Localization ───────► Workpiece foreground bounding & mat segmentation
         │
         ▼
 4. Perspective Rectifier ─────► Quad detection, tilt measurement (<3° bypass, 3°-30° warp, >30° reject)
         │
         ▼
 5. Feature Detector ──────────► Flat-field illumination correction, Otsu + Adaptive fallback, sub-pixel corners
         │
         ▼
 6. Regularization ────────────► Kåsa/Pratt circle fitting, slot classification, orthogonal angle snapping
         │
         ▼
 7. Scale Calibration ─────────► Metric pixel-to-millimeter/inch mapping via known dimensions
         │
         ▼
 8. Drawing Generator ─────────► Winding order normalization (CCW outer, CW holes)
         │
         ▼
 9. Topology Validator ────────► Strict Shapely containment & non-overlap audit, buffer(0) repair
         │
         ├───────────────────────────────┐
         ▼                               ▼
 [ AutoCAD R2018 DXF ]          [ Watertight 3D STL ]
 (CUT & HOLES Layers)          (Extruded Solid Mesh)
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**
- **Git**

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/RameeshaAkram/CADVisionAi.git
cd CADVisionAi

# Set up Python virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Running Locally

#### Start Backend (FastAPI)
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Base: `http://127.0.0.1:8000`
- Swagger Docs: `http://127.0.0.1:8000/docs`
- Health Probe: `http://127.0.0.1:8000/health`

#### Start Frontend (Vite)
```bash
cd frontend
npm run dev
```
- Web Application: `http://localhost:5173`

---

## 🧪 Validation and Evaluation Corpus

CADVision AI is validated against two exhaustive quality gates:

### 1. Unit & Integration Test Suite (`pytest`)
```bash
python -m pytest tests/ -v
```
```text
======================= 23 passed, 1 warning in 13.85s =======================
```

### 2. 23-Fixture Real-World Evaluation Corpus (`run_corpus.py`)
Evaluates the full reconstruction pipeline across 23 diverse benchmark fixtures, spanning mounting plates, brackets, gussets, washers, tilted workpieces ($15^\circ, 25^\circ, 35^\circ$), and degraded conditions (low contrast, optical blur, JPEG compression artifacts, uneven lighting).

```bash
python tests/run_corpus.py
```

```text
Image                      C1  C2  C3  C4  C5  C6  C7  Overall
-----------------------------------------------------------------
  bracket.png                P   P   P   P   P   P   P   PASS
  bracket_uneven_light.png   P   P   P   P   P   P   P   PASS
  circle_plate.png           P   P   P   P   P   P   P   PASS
  diamond_plate.png          P   P   P   P   P   P   P   PASS
  gasket_ring.png            P   P   P   P   P   P   P   PASS
  hex_plate.png              P   P   P   P   P   P   P   PASS
  hex_plate_jpeg25.png       P   P   P   P   P   P   P   PASS
  irregular_part.png         P   P   P   P   P   P   P   PASS
  large_plate.png            P   P   P   P   P   P   P   PASS
  mounting_plate.png         P   P   P   P   P   P   P   PASS
  mounting_plate_tilt5.png   P   P   P   P   P   P   P   PASS
  notched_rect.png           P   P   P   P   P   P   P   PASS
  oblong_slot.png            P   P   P   P   P   P   P   PASS
  pcb_outline.png            P   P   P   P   P   P   P   PASS
  rounded_rect.png           P   P   P   P   P   P   P   PASS
  simple_plate.png           P   P   P   P   P   P   P   PASS
  simple_plate_blur.png      P   P   P   P   P   P   P   PASS
  simple_plate_tilt15.png    P   P   P   P   P   P   P   PASS
  simple_plate_tilt25.png    P   P   P   P   P   P   P   PASS
  simple_plate_tilt35.png    P   P   P   P   P   P   P   PASS (Hard Rejected >30°)
  small_washer.png           P   P   P   P   P   P   P   PASS
  triangle_gusset.png        P   P   P   P   P   P   P   PASS
  triangle_gusset_noisy.png  P   P   P   P   P   P   P   PASS
============================================================
TOTAL: 23/23 PASSED (100.0%)
============================================================
```

#### The 7 Automated Verification Checks:
1. **C1 (File Validity)**: DXF successfully parses with `ezdxf` with zero fatal audit errors.
2. **C2 (Layer Separation)**: Outer contour assigned to `CUT` layer; internal cutouts assigned to `HOLES` layer.
3. **C3 (Topological Integrity)**: Validates closed profiles, strict hole containment, non-self-intersection, and non-overlapping features via Shapely.
4. **C4 (Dimensional Accuracy)**: Extracted dimensions conform to reference ground truth within $\pm 5\%$.
5. **C5 (Primitive Classification)**: True circles exported as native `CIRCLE` entities rather than segmented polylines.
6. **C6 (CAD Editability)**: Output entity structure is editable in standard CAD packages.
7. **C7 (Repeatability)**: Consecutive pipeline runs produce byte-for-byte identical vector files.

---

## 📦 Deliverables & Exports

| Deliverable | Format | Layer / Structure | Target Use Case |
| :--- | :--- | :--- | :--- |
| **2D Vector CAD** | `.dxf` (AutoCAD R2018) | `CUT` (White/Black), `HOLES` (Red), `DIMENSIONS` (Cyan) | CNC Laser, Waterjet, Plasma Cutters, AutoCAD, SolidWorks |
| **3D Solid Mesh** | `.stl` (Binary STL) | Extruded watertight triangular mesh ($Z = \text{thickness}$) | Slicers (PrusaSlicer, Cura, Bambu Studio), 3D Printing, CAM milling |
| **Interactive Drawing** | `.json` (REST API) | Normalized vector coordinate schema with metadata | In-browser SVG CAD visualizers, QA audit tools |

---

## 📖 Deep Dive Technical Documentation

For the comprehensive engineering reference—including mathematical formulations, detailed stage specifications, API endpoint payload schemas, and troubleshooting guidelines—refer to:

👉 **[README_TECHNICAL.md](./README_TECHNICAL.md)**

---

## 📄 License & Credits

* **License**: Licensed under the [MIT License](LICENSE).
* **Core Dependencies**: Built with [FastAPI](https://fastapi.tiangolo.com), [OpenCV](https://opencv.org), [ezdxf](https://ezdxf.mozman.at), [Shapely](https://shapely.readthedocs.io), [Trimesh](https://trimesh.org), [React 19](https://react.dev), and [Tailwind CSS](https://tailwindcss.com).
