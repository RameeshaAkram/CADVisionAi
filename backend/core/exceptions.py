"""Application-level exception hierarchy for CAD AI.

Each exception carries a ``message`` and an HTTP ``status_code`` so the
FastAPI exception handler can return a uniform JSON error envelope.
"""


class CadAIError(Exception):
    """Base exception for all CAD AI errors."""

    def __init__(self, message: str = "An unexpected error occurred", status_code: int = 500) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ValidationError(CadAIError):
    """Input validation failed (400)."""

    def __init__(self, message: str = "Validation error", status_code: int = 400) -> None:
        super().__init__(message=message, status_code=status_code)


class JobNotFoundError(CadAIError):
    """Requested job does not exist (404)."""

    def __init__(self, message: str = "Job not found") -> None:
        super().__init__(message=message, status_code=404)


class ProcessingError(CadAIError):
    """Pipeline processing failure (500)."""

    def __init__(self, message: str = "Processing error") -> None:
        super().__init__(message=message, status_code=500)
