from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time
import logging
from typing import List

logger = logging.getLogger(__name__)

# IP whitelist (allow all in production, can be configured via env)
ALLOWED_IPS = set()
BLOCKED_PATHS = ['/internal', '/debug']

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 60, burst_limit: int = 10):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_limit = burst_limit
        self.request_times: Dict[str, List[float]] = {}

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else 'unknown'
        path = request.url.path

        # Check blocked paths
        if any(blocked in path for blocked in BLOCKED_PATHS):
            return await call_next(request)

        # Check rate limits
        if not self._check_rate_limit(client_ip):
            logger.warning(f"Rate limit exceeded for IP: {client_ip}, Path: {path}")
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=429,
                content={"error": "Rate limit exceeded", "message": "Too many requests"}
            )

        # Process request
        response = await call_next(request)
        return response

    def _check_rate_limit(self, client_ip: str) -> bool:
        now = time.time()
        if client_ip not in self.request_times:
            self.request_times[client_ip] = []

        # Clean old requests (older than 1 minute)
        self.request_times[client_ip] = [
            req_time for req_time in self.request_times[client_ip]
            if now - req_time < 60
        ]

        # Check burst limit
        if len(self.request_times[client_ip]) >= self.burst_limit:
            return False

        # Check per-minute limit
        if len(self.request_times[client_ip]) >= self.requests_per_minute:
            return False

        # Add current request
        self.request_times[client_ip].append(now)
        return True
