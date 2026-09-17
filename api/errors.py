"""Standardized error handling for TechnicalAI Backend."""
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from typing import Any, Dict, Optional
import uuid
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class ErrorResponse:
    """Standardized error response structure."""

    ERROR_CODES = {
        "BAD_REQUEST": "Bad request parameters",
        "UNAUTHORIZED": "Authentication required",
        "FORBIDDEN": "Insufficient permissions",
        "NOT_FOUND": "Requested resource not found",
        "VALIDATION_ERROR": "Input validation failed",
        "RATE_LIMITED": "Rate limit exceeded",
        "INTERNAL_ERROR": "Internal server error",
        "BAD_GATEWAY": "Upstream service unavailable",
        "SERVICE_UNAVAILABLE": "Service temporarily unavailable",
    }

    @staticmethod
    def create(
        status_code: int,
        error_code: str,
        message: str,
        details: Optional[Any] = None,
        correlation_id: Optional[str] = None,
        path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a standardized error response dict."""
        return {
            "error": {
                "code": error_code,
                "message": message,
                "details": details,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "correlation_id": correlation_id or str(uuid.uuid4()),
                "path": path,
            }
        }

    @staticmethod
    def bad_request(message: str = "Bad request", details: Optional[Any] = None, path: Optional[str] = None) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse.create(400, "BAD_REQUEST", message, details, path=path)
        )

    @staticmethod
    def unauthorized(message: str = "Authentication required", details: Optional[Any] = None, path: Optional[str] = None) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content=ErrorResponse.create(401, "UNAUTHORIZED", message, details, path=path)
        )

    @staticmethod
    def forbidden(message: str = "Insufficient permissions", details: Optional[Any] = None, path: Optional[str] = None) -> JSONResponse:
        return JSONResponse(
            status_code=403,
            content=ErrorResponse.create(403, "FORBIDDEN", message, details, path=path)
        )

    @staticmethod
    def not_found(message: str = "Resource not found", details: Optional[Any] = None, path: Optional[str] = None) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content=ErrorResponse.create(404, "NOT_FOUND", message, details, path=path)
        )

    @staticmethod
    def validation_error(message: str = "Validation failed", details: Optional[Any] = None, path: Optional[str] = None, correlation_id: Optional[str] = None) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=ErrorResponse.create(422, "VALIDATION_ERROR", message, details, correlation_id=correlation_id, path=path)
        )

    @staticmethod
    def rate_limited(message: str = "Rate limit exceeded", details: Optional[Any] = None, path: Optional[str] = None) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content=ErrorResponse.create(429, "RATE_LIMITED", message, details, path=path)
        )

    @staticmethod
    def internal_error(message: str = "Internal server error", details: Optional[Any] = None, path: Optional[str] = None, correlation_id: Optional[str] = None) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse.create(500, "INTERNAL_ERROR", message, details, correlation_id=correlation_id, path=path)
        )


def _extract_validation_errors(exc: RequestValidationError) -> list:
    """Extract validation errors into a clean format."""
    errors = []
    for err in exc.errors():
        loc = ".".join(str(x) for x in err.get("loc", []))
        errors.append({
            "field": loc,
            "message": err.get("msg", "Validation error"),
            "type": err.get("type", "validation_error"),
        })
    return errors


def _extract_pydantic_errors(exc: ValidationError) -> list:
    """Extract Pydantic validation errors."""
    errors = []
    try:
        for err in exc.errors():
            errors.append({
                "field": ".".join(str(x) for x in err.get("loc", [])),
                "message": err.get("msg", "Validation error"),
                "type": err.get("type", "validation_error"),
            })
    except Exception:
        errors = [{"message": str(exc)}]
    return errors


def setup_exception_handlers(app):
    """Register all exception handlers on the FastAPI app."""

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        correlation_id = getattr(request.state, "correlation_id", None)
        error_response = ErrorResponse.create(
            status_code=exc.status_code,
            error_code=exc.detail if isinstance(exc.detail, str) else "HTTP_ERROR",
            message=str(exc.detail),
            correlation_id=correlation_id,
            path=str(request.url.path),
        )
        logger.error(
            f"HTTP {exc.status_code} - {exc.detail} - Path: {request.url.path} - "
            f"CorrelationID: {correlation_id}"
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = _extract_validation_errors(exc)
        correlation_id = getattr(request.state, "correlation_id", None)
        error_response = ErrorResponse.validation_error(
            message="Request validation failed",
            details=errors,
            correlation_id=correlation_id,
            path=str(request.url.path),
        )
        logger.warning(
            f"Validation error on {request.url.path} - Errors: {errors} - "
            f"CorrelationID: {correlation_id}"
        )
        return error_response

    @app.exception_handler(ValidationError)
    async def pydantic_validation_handler(request: Request, exc: ValidationError):
        errors = _extract_pydantic_errors(exc)
        correlation_id = getattr(request.state, "correlation_id", None)
        error_response = ErrorResponse.validation_error(
            message="Model validation failed",
            details=errors,
            correlation_id=correlation_id,
            path=str(request.url.path),
        )
        logger.warning(
            f"Pydantic validation error on {request.url.path} - Errors: {errors}"
        )
        return error_response

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        correlation_id = getattr(request.state, "correlation_id", str(uuid.uuid4()))
        logger.error(
            f"Unhandled exception: {exc} - Path: {request.url.path} - "
            f"CorrelationID: {correlation_id}",
            exc_info=True
        )
        error_response = ErrorResponse.internal_error(
            message="An internal server error occurred. Please try again later.",
            details=None,
            correlation_id=correlation_id,
            path=str(request.url.path),
        )
        return JSONResponse(
            status_code=500,
            content=error_response
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        correlation_id = getattr(request.state, "correlation_id", str(uuid.uuid4()))
        logger.error(
            f"ValueError on {request.url.path}: {exc} - CorrelationID: {correlation_id}"
        )
        return ErrorResponse.not_found(
            message=str(exc) if str(exc) else "Resource not found",
            correlation_id=correlation_id,
            path=str(request.url.path),
        )