# CADVision AI

CADVision AI is a hackathon MVP for turning clear reference images of flat parts into a scaled CAD starting point. It is designed for workshops, engineers, and makers who want to reduce manual drafting for simple profiles.

The project vision is:

```text
Physical part/image -> image processing/CV -> geometry detection
-> CAD reconstruction -> DXF and 3D output
```

The current implementation is intentionally narrower than that vision. It creates an approximate 2D profile from a visible image contour, exports an editable DXF polyline, and creates an extruded STL when a material thickness is supplied. It is not an industrial metrology system and generated files must be checked before fabrication.

## Current Workflow

1. Upload one or more JPEG, PNG, or WebP images.
2. Provide at least one known dimension and a material thickness.
3. Normalize the images with OpenCV.
4. Analyze image quality and viewpoint coverage.
5. Detect a foreground object using local `rembg` or an OpenCV fallback.
6. Select the strongest detected image and extract its visible outer contour.
7. Calibrate the contour into the selected units using known width/length/height values.
8. Render a 2D drawing preview.
9. Export `drawing.dxf` and an extruded `model.stl` to `outputs/{job_id}/`.

## Implemented Functionality

- FastAPI backend with persisted jobs.
- React/Vite frontend with upload, processing, jobs, preview, and export screens.
- Local image preprocessing and foreground segmentation.
- Outer contour extraction and basic contour simplification.
- Known-dimension scaling with separate X/Y calibration when both axes are provided.
- 2D drawing JSON and browser preview.
- Unit-aware DXF export with `CUT` and `HOLES` layers.
- Local extruded STL export using Shapely, Trimesh, and Mapbox Earcut.
- Export existence checks and job validation.
- Background processing with progress stages.

## What Is Not Implemented

- Reliable hole detection for all backgrounds and segmentation masks.
- True multi-view 3D reconstruction.
- Perspective correction or camera calibration.
- Automatic hidden-surface inference.
- STEP/DWG export.
- Parametric CAD constraints or manufacturing tolerances.
- Production-grade CNC or laser-cut guarantees.
- Backend video-frame extraction. The UI includes a video option, but the current processing contract is photo mode.

## Technology Stack

### Backend

- Python 3.11
- FastAPI and Uvicorn
- Pydantic Settings
- OpenCV and Pillow
- `rembg` for local foreground segmentation
- Shapely, Trimesh, and Mapbox Earcut for STL extrusion
- ezdxf for DXF writing
- Pytest and HTTPX for tests

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- TanStack React Query
- Tailwind CSS
- Lucide React

## Architecture

### Backend

- `backend/main.py`: FastAPI application, CORS, lifecycle, and health route.
- `backend/api/`: upload, processing, status, drawing, and export routes.
- `backend/models/`: persisted job models and public response schemas.
- `backend/pipeline/`: preprocessing, view analysis, detection, calibration, drawing, and validation.
- `backend/exporters/`: DXF and STL writers.
- `backend/storage/`: file and job persistence.
- `backend/utils/`: image, video, and geometry helpers.

### Frontend

- `frontend/src/pages/`: new job, processing, jobs, and workspace views.
- `frontend/src/components/`: upload controls, drawing preview, measurements, and export UI.
- `frontend/src/api/`: same-origin API client and job/export calls.
- `frontend/src/styles/`: shared design tokens and application styles.

## Local Setup

From PowerShell on Windows:

```powershell
cd C:\path\to\CADVisionAi
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Do not commit `.env`. It is ignored by Git. Edit it locally if you need to change ports, directories, or CORS origins.

### Start the Backend

In the repository root:

```powershell
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URLs:

- API: `http://localhost:8000`
- Health: `http://localhost:8000/health`
- Swagger: `http://localhost:8000/docs`

### Start the Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Frontend URL: `http://localhost:5173`

The Vite development proxy forwards `/api` requests to the backend. Browser code should use relative `/api` paths rather than direct cross-origin backend URLs.

## API Input

`POST /api/jobs` accepts `multipart/form-data`:

```text
mode: photo
units: mm | cm | inches | feet
known_dimensions: JSON array, for example [{"label":"Overall width","value":100}]
thickness: positive material thickness in the selected units
files: one or more image files
```

Useful endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service health |
| POST | `/api/jobs` | Create an uploaded job |
| POST | `/api/jobs/{job_id}/process` | Start processing |
| GET | `/api/jobs/{job_id}/status` | Read processing status |
| GET | `/api/jobs/{job_id}/drawing` | Read 2D drawing JSON |
| GET | `/api/jobs/{job_id}/exports` | List DXF/STL exports |
| GET | `/api/jobs/{job_id}/exports/{filename}` | Download an export |

## Accuracy and Limitations

The output is only as accurate as the visible contour, image perspective, segmentation, and user-provided reference dimension. A single image cannot recover hidden surfaces. White backgrounds, shadows, clutter, holes, and perspective can produce incorrect contours. A valid DXF file only proves that the file is structurally readable; it does not prove that the geometry is dimensionally correct.

Use a camera parallel to the part, even lighting, a plain background, and at least three clear views when possible. Inspect the DXF in AutoCAD or another CAD viewer before cutting.

## Testing

Run the backend tests:

```powershell
py -3.11 -m pytest tests/ -q
```

Build the frontend:

```powershell
cd frontend
npm run build
```

The test suite covers health, upload/job persistence, preprocessing, object detection, validation, export routes, and STL writing.

## Project Structure

```text
CADVisionAi/
├── backend/
│   ├── api/
│   ├── core/
│   ├── exporters/
│   ├── models/
│   ├── pipeline/
│   ├── storage/
│   └── utils/
├── frontend/
│   └── src/
├── docs/
├── tests/
├── uploads/       # local, ignored job inputs
├── outputs/       # local, ignored generated files
├── .env.example
├── requirements.txt
└── README.md
```

## MVP Scope

The current MVP target is a reviewable, approximate DXF and STL from a clear flat-part image, known dimensions, and material thickness. It is a starting point for CAD authoring, not a replacement for engineering review.

## Future Planned Features

- Robust hole and internal-cutout preservation.
- User-editable contour and approval workflow.
- Perspective and ruler-marker calibration.
- Reliable video frame extraction.
- Multi-view registration and real 3D reconstruction.
- Parametric constraints, STEP/DWG export, and manufacturing checks.
