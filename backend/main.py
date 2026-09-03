"""CAD AI — FastAPI application entry point.

Configures the app, CORS, exception handling, and the health-check endpoint.
No business logic lives here; pipeline work belongs in backend.pipeline.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.core.config import settings
from backend.core.exceptions import CadAIError
from backend.core.logging_config import setup_logging
from backend.models.schemas import HealthResponse

logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook."""
    setup_logging()
    logger.info("Starting %s (env=%s)", settings.APP_NAME, settings.ENV)

    # Ensure storage directories exist
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    logger.info("Storage dirs ready: %s, %s", settings.UPLOAD_DIR, settings.OUTPUT_DIR)
    
    from backend.storage import job_manager
    job_manager.cleanup_zombie_jobs()

    yield  # application runs

    logger.info("Shutting down %s", settings.APP_NAME)


# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-assisted reverse-engineering: photos → scaled 3-D reconstruction, 2-D drawing, DXF + 3-D interchange file.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Exception handler ────────────────────────────────────────────────────────

@app.exception_handler(CadAIError)
async def cad_ai_exception_handler(request: Request, exc: CadAIError) -> JSONResponse:
    """Return a uniform JSON error envelope for all CadAIError subclasses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": type(exc).__name__, "message": exc.message},
    )


# ── Routers ──────────────────────────────────────────────────────────────────

from backend.api.upload_routes import router as upload_router  # noqa: E402
from backend.api.processing_routes import router as processing_router  # noqa: E402
from backend.api.export_routes import router as export_router  # noqa: E402

app.include_router(upload_router, prefix="/api")
app.include_router(processing_router, prefix="/api")
app.include_router(export_router, prefix="/api")


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/", tags=["meta"])
async def root():
    """Landing convenience so a browser hit is not a 404."""
    return {"service": "cad-ai", "docs": "/docs"}


@app.get("/health", response_model=HealthResponse, tags=["meta"])
async def health_check() -> HealthResponse:
    """Liveness probe."""
    return HealthResponse(status="ok", service="cad-ai")
