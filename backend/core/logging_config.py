"""Logging configuration for the CAD AI backend.

Configures the stdlib logging module with a consistent format for console
output.  Call ``setup_logging()`` once at application startup.
"""

import logging
import sys

from backend.core.config import settings


def setup_logging() -> None:
    """Configure the root logger for the backend.

    Format: ``YYYY-MM-DD HH:MM:SS | LEVEL | logger_name | message``
    """
    log_format = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    logging.basicConfig(
        level=settings.LOG_LEVEL.upper(),
        format=log_format,
        datefmt=date_format,
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )

    # Suppress noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
