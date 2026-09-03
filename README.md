# CAD AI

AI-assisted reverse-engineering tool that converts photographs (or a short video) of a physical object, combined with at least one known real-world dimension, into a scaled 3-D reconstruction, 2-D orthographic drawing, DXF file, and a 3-D interchange file. The system produces honest confidence warnings — a photograph cannot recover hidden surfaces or exact metrology. This is a hackathon MVP, not a metrology system and not AutoCAD automation.

## Status

**Segment 3 — Video frames + preprocess.** Photos and video jobs extract and preprocess frames into a normalized image collection saved to `uploads/{job_id}/normalized/`.

### Pipeline Stages
1. **Images/Video** uploaded via frontend.
2. **Reconstruction**: `backend/pipeline/reconstruction.py` computes an approximate 3D shape using a CPU-based visual hull (space carving) algorithm with marching cubes.
3. **Scaling**: `backend/pipeline/scale_calibration.py` calculates real-world metrics based on user inputs.
4. **Assembly**: `backend/pipeline/assembly_analyzer.py` determines if the object is a single body or multiple parts.
5. **Geometry Refinement**: Applies scale calibration to convert the raw reconstruction into real-world units, merges close vertices, and decimates overly complex meshes.
7. **CAD Generation**: Fits parametric CAD primitives (like bounding boxes) to the refined geometry where confidence is high.
8. **Drawing Generation**: Creates a 2D orthographic drawing JSON (front, top, side) from the CAD solids and measurements, adding dimensions based on confidence levels.
9. **Exporters**: Writes the final assets to disk (`outputs/{job_id}/`): a scaled 3D mesh (`model.stl`) and a 2D drawing (`drawing.dxf`). **Note: This output is an AI-assisted approximation and not a true parametric CAD model or a metrology record. It is a draft meant to be imported into downstream CAD software for verification and authoring.**

## Guidelines
See [docs/CAPTURE.md](file:///C:/Users/USER/Desktop/Workspace/AutoCad/cad-ai/docs/CAPTURE.md) for detailed rules on capturing usable inputs (8-20 clear, diverse photos or one 360 orbit video) and understanding the AI's limitations.

If a side is missing or the reconstruction fails due to poor coverage, you can add photos to the same job and process it again without starting over!

Jobs persist automatically on disk. You can safely close the application or restart the server, and jobs will be available via the "Jobs" link in the top navigation bar. If a job is actively processing in the background, you can leave the page and return later without interrupting the reconstruction.

## Folder Layout

```
cad-ai/
├── backend/          # FastAPI application
│   ├── api/          # Route modules
│   ├── core/         # Config, logging, exceptions
│   ├── models/       # Pydantic schemas, job data model
│   ├── pipeline/     # Processing pipeline stages (stubs)
│   ├── exporters/    # DXF / mesh / CAD export (stubs)
│   ├── storage/      # File and job management
│   └── utils/        # Shared helpers (stubs)
├── frontend/         # UI placeholder (not yet implemented)
├── uploads/          # Uploaded files (gitignored), organized by job_id
├── outputs/          # Generated outputs (gitignored)
└── tests/            # Pytest test suite
```

## Setup

```bash
cd cad-ai
python -m venv .venv

source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
```

2. **Start Backend Server**
```bash
# In cad-ai directory
uvicorn backend.main:app --reload --port 8000
```
API runs on `http://127.0.0.1:8000`. Outputs saved to `outputs/`.

3. **Start Frontend Dev Server**
```bash
# In cad-ai/frontend directory
npm install
npm run dev
```
UI runs on `http://localhost:5173`.

4. **Verify**
- Open `http://localhost:5173` in a browser.
- Drop 2 photos, add a dimension, and click "Start processing".
- Watch the progress in the UI as it polls the backend API.

## Validation & Confidence

CAD AI uses a strict confidence and validation model to prevent presenting inferred geometry as exact measurements.

- **Measured (●)**: True metric scaling is confirmed and the shape was reconstructed reliably.
- **Estimated (◐)**: The AI has inferred depth, scale, or surfaces based on limited visual information. Displayed with reduced precision.
- **Low (○)**: Features are heavily occluded or distorted. Only ranges are provided, no exact numbers.

The overall `confidence` score (0..1) is conservative, capped at 0.85, and drops based on missing views, missing files, or mismatched known dimensions.

## API Endpoints

### Meta

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe. Returns `{"status":"ok","service":"cad-ai"}` |
| GET | `/` | Service info and link to `/docs` |

### Jobs & Processing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/jobs` | Create a job (multipart/form-data) |
| POST | `/api/jobs/{job_id}/process` | Begin extraction & reconstruction. |
| GET | `/api/jobs/{job_id}/status` | Poll for updates. |
| GET | `/api/jobs/{job_id}/exports` | List available CAD exports (DXF, STL). |
| GET | `/api/jobs/{job_id}/drawing` | Get the 2D orthographic drawing JSON. |
| GET | `/api/jobs/{job_id}/exports/{filename}` | Download a specific export file. |
| POST | `/api/jobs/{job_id}/files` | Append images to a photo-mode job |
| GET | `/api/jobs/{job_id}/files/{filename}` | Download a stored upload |

```
POST /api/jobs
Content-Type: multipart/form-data

Fields:
  mode:             "photo" | "video"
  units:            "mm" | "cm" | "inches" | "feet"
  known_dimensions: JSON string, e.g. [{"label":"height","value":8}]
  files:            one or more file parts (field name "files")
```

Photo mode accepts one or more images (JPEG, PNG, WebP). Video mode accepts exactly one video (MP4, MOV, WebM). At least one known dimension with a positive value is required.

**Response (201):**
```json
{
  "job_id": "...",
  "mode": "photo",
  "status": "uploaded",
  "units": "feet",
  "known_dimensions": [{"label": "height", "value": 8.0}],
  "file_count": 1,
  "files": [{"filename": "photo.jpg", "kind": "image", "bytes": 5429, "width": 640, "height": 480}],
  "warnings": ["Fewer than 3 views; reconstruction quality will likely be low. You can add more photos."]
}
```

### Interactive docs

Swagger UI is available at `http://127.0.0.1:8000/docs`.

## Tests

```bash
pytest tests/ -q
```

## Configuration

All configuration is loaded from environment variables (via `.env`). See `.env.example` for available keys. No secrets are hardcoded in source.
