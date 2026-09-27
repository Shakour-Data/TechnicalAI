"""Health check routes."""
from typing import Dict, Any
from time import time

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api.config import settings

router = APIRouter(tags=["General"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    uptime_seconds: float
    data_sources: Dict[str, Any]
    authentication: str = "jwt_required"


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request):
    """Health check endpoint."""
    uptime = time() - request.app.state.start_time
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "uptime_seconds": round(uptime, 2),
        "data_sources": {},
        "authentication": "JWT",
    }