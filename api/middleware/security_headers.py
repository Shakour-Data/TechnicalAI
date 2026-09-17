"""Security headers middleware for TechnicalAI Backend."""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import os


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Set security headers on all responses."""
    
    def __init__(self, app):
        super().__init__(app)
        self.hsts_max_age = 31536000
        self.hsts_include_subdomains = True
        self.hsts_preload = True

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-ROBOTS-Tag"] = "noindex, nofollow"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "base-uri 'self'; "
            "frame-ancestors 'none'; "
            "form-action 'self'"
        )
        
        # HSTS header
        if os.getenv("ENABLE_HSTS", "true").lower() == "true":
            response.headers["Strict-Transport-Security"] = (
                f"max-age={self.hsts_max_age}; "
                f"includeSubDomains; "
                f"preload"
            )
        
        # Cache control for sensitive endpoints
        if request.url.path.startswith("/api/v1/") or request.url.path in ["/health", "/metrics"]:
            response.headers["Cache-Control"] = "no-store"
        
        return response