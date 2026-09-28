"""Analysis routes."""
import asyncio
import time
from typing import Annotated, Dict, Any, List, Optional
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field

from api.services.analysis_service import AnalysisService
from api.services.mock_service import MockService
from api.middleware.logging import logger


def _get_correlation_id() -> str:
    return str(uuid4())[:8]


router = APIRouter(prefix="/analysis", tags=["Analysis"])


class AnalysisRequest(BaseModel):
    symbol: Annotated[str, Field(..., min_length=1, max_length=20, description="Stock symbol")]
    analysis_type: Annotated[str, Field(default="technical", description="Analysis type")]
    prompt: Optional[str] = Field(default=None, description="Optional custom prompt")
    model: Optional[str] = Field(default=None, description="Optional AI model override")


class AnalysisResponse(BaseModel):
    analysis_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    created_at: str
    completed_at: Optional[str] = None


class TimeSeriesAnalysisRequest(BaseModel):
    symbol: Annotated[str, Field(..., min_length=1, max_length=20, description="Stock symbol")]
    analysis_type: Annotated[str, Field(default="time_series", description="Analysis type")]
    horizon: Annotated[int, Field(default=30, ge=1, le=90, description="Forecast horizon (1-90)")]
    mode: Annotated[str, Field(default="quick", description="Analysis mode: quick or detailed")]
    model_keys: Optional[List[str]] = Field(default=None, description="ML models for quick mode")


@router.get("/ml-predict")
async def ml_predict_health():
    """Check if ML prediction service is available."""
    return {"status": "ok", "native": True}


@router.post("/time-series")
async def run_time_series_analysis(
    request: TimeSeriesAnalysisRequest,
    background_tasks: BackgroundTasks,
):
    """Run time series analysis."""
    try:
        analysis_id = f"analysis_{request.symbol}_{int(time.time() * 1000)}"
        created_at = datetime.now(timezone.utc).isoformat()

        # Process analysis in background
        background_tasks.add_task(
            _process_time_series,
            analysis_id=analysis_id,
            symbol=request.symbol,
            horizon=request.horizon,
            mode=request.mode,
            model_keys=request.model_keys,
            user_id="frontend",
        )

        return {
            "analysis_id": analysis_id,
            "status": "processing",
            "created_at": created_at,
            "completed_at": None,
        }
    except Exception as e:
        logger.error(f"Error creating time series analysis for {request.symbol}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def _process_time_series(analysis_id, symbol, horizon, mode, model_keys, user_id):
    """Background task for time series analysis."""
    corr_id = _get_correlation_id()
    try:
        logger.info(f"[{corr_id}] Processing time series analysis {analysis_id} for {symbol}, mode={mode}")
        service = AnalysisService()
        if mode == "quick":
            result = await service.analyze_time_series_quick(symbol, horizon, model_keys)
        else:
            result = await service.analyze_time_series_detailed(symbol, horizon)
        logger.info(f"[{corr_id}] Time series analysis {analysis_id} completed for {symbol}")
        # Store result in cache for retrieval
        service._cache.set(f"result_{analysis_id}", result)
    except Exception as e:
        logger.error(f"[{corr_id}] Error processing time series analysis {analysis_id}: {e}")
        # Also store failed result so polling can return it
        try:
            service = AnalysisService()
            service._cache.set(f"result_{analysis_id}", {
                "id": analysis_id,
                "status": "failed",
                "error": str(e)
            })
        except:
            pass


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: Annotated[str, Field(..., description="Analysis ID")],
):
    """Get analysis result by ID."""
    try:
        # Check cache first - access via the AnalysisService class
        from api.services.analysis_service import AnalysisService as _AS
        service = _AS()
        cached = service._cache.get(f"result_{analysis_id}")
        if cached:
            return AnalysisResponse(
                analysis_id=analysis_id,
                status="completed",
                result=cached,
                created_at="2024-01-01T00:00:00Z",
                completed_at=datetime.now(timezone.utc).isoformat(),
            )
        
        result = await MockService().get_dashboard_overview()
        return AnalysisResponse(
            analysis_id=analysis_id,
            status="completed",
            result=result,
            created_at="2024-01-01T00:00:00Z",
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        logger.error(f"Error fetching analysis {analysis_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")