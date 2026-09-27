"""Analysis routes."""
import asyncio
import time
from typing import Annotated, Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from api.auth import User, get_current_active_user
from api.services.mock_service import MockService
from api.middleware.logging import logger

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


@router.post("", response_model=AnalysisResponse)
async def run_analysis(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
):
    """Run financial analysis."""
    try:
        valid_types = ["technical", "fundamental", "sentiment"]
        if request.analysis_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid analysis type. Must be one of: {', '.join(valid_types)}",
            )

        analysis_id = f"analysis_{request.symbol}_{int(time.time() * 1000)}"
        created_at = datetime.now(timezone.utc).isoformat()

        # Process analysis in background
        background_tasks.add_task(
            _process_analysis,
            analysis_id=analysis_id,
            symbol=request.symbol,
            analysis_type=request.analysis_type,
            prompt=request.prompt,
            model=request.model,
            user_id=current_user.user_id,
        )

        return AnalysisResponse(
            analysis_id=analysis_id,
            status="processing",
            created_at=created_at,
            completed_at=None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating analysis for {request.symbol}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: Annotated[str, Field(..., description="Analysis ID")],
    current_user: User = Depends(get_current_active_user),
):
    """Get analysis result by ID."""
    try:
        # In production, fetch from database
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


async def _process_analysis(analysis_id, symbol, analysis_type, prompt, model, user_id):
    """Background task to process analysis."""
    try:
        logger.info(f"Processing analysis {analysis_id} for {symbol}")
        await asyncio.sleep(2)  # Simulate processing time
        result = await MockService().get_dashboard_overview()
        logger.info(f"Analysis {analysis_id} completed")
    except Exception as e:
        logger.error(f"Error processing analysis {analysis_id}: {e}")