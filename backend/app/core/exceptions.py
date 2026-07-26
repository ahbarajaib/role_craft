"""Custom exception hierarchy and FastAPI exception handlers.

Defines a base ``AppError`` that carries an HTTP status code and a
human-readable detail string, plus concrete subclasses for the most
common error situations.

``add_exception_handlers`` wires these into a FastAPI application so that
all unhandled ``AppError`` subclasses produce a consistent JSON error body
and the correct HTTP status code.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from loguru import logger
from starlette import status


# ── Base exception ────────────────────────────────────────────────────────────


class AppError(Exception):
    """Root of the application exception hierarchy.

    Raise a subclass rather than this directly so that log messages and
    HTTP responses are as specific as possible.
    """

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail: str = "An unexpected error occurred."

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.default_detail
        super().__init__(self.detail)


# ── Concrete exceptions ───────────────────────────────────────────────────────


class NotFoundError(AppError):
    """Raised when a requested resource does not exist."""

    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "The requested resource was not found."


class BadRequestError(AppError):
    """Raised when the request is malformed or logically invalid."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "The request was invalid."


class UnprocessableError(AppError):
    """Raised when input is structurally valid but semantically wrong."""

    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    default_detail = "The request could not be processed."


class UnauthorizedError(AppError):
    """Raised when authentication fails or credentials are invalid."""

    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Authentication credentials were not provided or are invalid."


class InsufficientCreditsError(AppError):
    """Raised when a user has depleted their AI analysis credit balance."""

    status_code = status.HTTP_402_PAYMENT_REQUIRED
    default_detail = "You have depleted your available credits. Please log in or upgrade."


class RateLimitError(AppError):
    """Raised when a guest user exceeds their daily analysis allocation."""

    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Daily free analysis limit reached. Please log in to continue."


# ── Exception handlers ────────────────────────────────────────────────────────


def _error_response(request: Request, status_code: int, detail: str) -> JSONResponse:
    """Return a consistently structured JSON error body with CORS headers."""
    origin = request.headers.get("origin", "*") if request else "*"
    headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
    }
    return JSONResponse(
        status_code=status_code,
        content={"error": {"detail": detail, "status_code": status_code}},
        headers=headers,
    )


async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    if exc.status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
        logger.error(f"Unhandled application error: {exc.detail} | path={request.url.path}", exc_info=exc)
    else:
        logger.warning(f"Application error: {exc.detail} | path={request.url.path}")
    return _error_response(request, exc.status_code, exc.detail)


async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception", path=request.url.path)
    return _error_response(
        request,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        f"An internal server error occurred: {str(exc)}",
    )


def add_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers on the given FastAPI application.

    Separated from ``create_app`` so that the handler registration can be
    tested independently or reused across multiple app instances.
    """
    app.add_exception_handler(AppError, _app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, _unhandled_exception_handler)
