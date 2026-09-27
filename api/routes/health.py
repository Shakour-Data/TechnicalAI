"""Health check routes."""
from typing import Dict, Any
from time import time

from fastapi import APIRouter, Request
from pydantic import BaseModel
import httpx

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
    data_sources = {}

    # Check ML Prediction Service
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("http://localhost:3032/health")
            data_sources["ml_prediction"] = {"status": "ok" if resp.status_code == 200 else "unhealthy"}
    except Exception:
        data_sources["ml_prediction"] = {"status": "unavailable"}

    # Check TSE Service
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("http://localhost:3031/health")
            data_sources["tse"] = {"status": "ok" if resp.status_code == 200 else "unhealthy"}
    except Exception:
        data_sources["tse"] = {"status": "unavailable"}

    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "uptime_seconds": round(uptime, 2),
        "data_sources": data_sources,
        "authentication": "JWT",
    }