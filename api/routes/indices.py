"""Index routes."""
from typing import Annotated, Dict, Any, Optional, List
from datetime import datetime, timezone
import time as time_module

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from api.auth import User, get_current_active_user
from api.services.mock_service import MockService
from api.middleware.logging import logger

router = APIRouter(prefix="/indices", tags=["Indices"])


@router.get("/{code}/history", response_model=Dict[str, Any])
async def get_index_history(
    code: Annotated[str, Field(..., min_length=1, max_length=20, description="Index code")],
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    current_user: User = Depends(get_current_active_user),
):
    """Get index historical data."""
    try:
        data = await MockService().get_index_history(code.upper(), start_date, end_date, limit)
        return {
            "code": code.upper(),
            "count": len(data),
            "data": data,
            "pagination": {
                "limit": limit,
                "offset": 0,
                "total": len(data),
                "has_more": len(data) == limit
            },
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username
            }
        }
    except ValueError as ve:
        logger.warning(f"Index not found: {code}")
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error fetching index history for {code}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("")
async def list_indices(
    market: Optional[str] = Query(None, description="Market filter"),
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    offset: Annotated[Optional[int], Field(default=0, ge=0)] = 0,
    current_user: User = Depends(get_current_active_user),
):
    """List all indices."""
    try:
        indices = await MockService().list_indices(market=market)
        paginated = indices[offset:offset + limit]
        return {
            "count": len(paginated),
            "total": len(indices),
            "indices": paginated,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": len(indices),
                "has_more": offset + limit < len(indices)
            },
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username
            }
        }
    except Exception as e:
        logger.error(f"Error listing indices: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/sectors")
async def list_sectors(current_user: User = Depends(get_current_active_user)):
    """List all sectors."""
    try:
        sectors = await MockService().list_sectors()
        return {
            "count": len(sectors),
            "sectors": sectors,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username
            }
        }
    except Exception as e:
        logger.error(f"Error listing sectors: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")