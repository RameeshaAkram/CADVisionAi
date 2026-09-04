"""Application configuration loaded from environment variables via pydantic-settings."""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """CAD AI application settings.

    Values are loaded from .env file and can be overridden by environment
    variables.  Secrets must never be committed; they live in .env which is
    gitignored.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "CAD AI"
    ENV: str = "dev"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # CORS — origins allowed to call the API (Vite/React dev servers)
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # Storage
    UPLOAD_DIR: str = "./uploads"
    OUTPUT_DIR: str = "./outputs"

    # Upload constraints (used by later segments)
    MAX_UPLOAD_MB: int = 100
    ALLOWED_IMAGE_TYPES: list[str] = ["jpeg", "jpg", "png", "webp"]

    PREPROCESS_MAX_SIDE: int = 1600
    BLUR_THRESHOLD: float = 100.0  # Minimum Laplacian variance
    MIN_DIMENSION: int = 256       # Reject smaller images
    
    DUPLICATE_HASH_THRESHOLD: float = 10.0
    
    # Segment 6: View & feature analysis
    VIEW_DIVERSITY_MIN: float = 0.25
    EXPOSURE_DARK: int = 40
    EXPOSURE_BRIGHT: int = 220
    MIN_BRIGHT_IMAGE_DARK_RATIO: float = 0.005
    MIN_BRIGHT_IMAGE_COMPONENT_AREA: float = 0.001
    HOUGH_CIRCLE_DP: float = 1.2
    FEATURE_MAX: int = 200

    # Segment 7: Reconstruction
    RECON_RESOLUTION: int = 96

    # Segment 8: Scale & Calibration
    SCALE_MISMATCH_PCT: float = 0.10
    HOLE_RADIUS_AGREE: float = 0.15

    # Segment 9: CAD & Exporters
    PRIMITIVE_FIT_TOL: float = 0.1
    MAX_REFINED_FACES: int = 20000
    CIRCULARITY_THRESHOLD: float = 0.85  # min circularity to classify a contour as a circle

    # Segment 15: Background processing
    RECON_TIMEOUT_SEC: int = 120
    HEARTBEAT_SEC: int = 5
    MAX_CONCURRENT_JOBS: int = 1

settings = Settings()
