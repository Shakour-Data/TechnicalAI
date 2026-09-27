"""Forex routes."""
from typing import Annotated, Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from api.auth import User, get_current_active_user
from api.services.mock_service import MockService
from api.middleware.logging import logger

router = APIRouter(prefix="/forex", tags=["Forex"])


@router.get("/{pair}")
async def get_forex_rate(
    pair: Annotated[str, Field(..., min_length=1, max_length=10, description="Forex pair (e.g., USDIRR)")],
    current_user: User = Depends(get_current_active_user),
):
    """Get forex rate."""
    try:
        rate = await MockService().get_forex_rate(pair.upper())
        return {
            "pair": pair.upper(),
            "rate": rate,
            "metadata": {"timestamp": datetime.now(timezone.utc).isoformat(),
                         "authenticated_as": current_user.username},
        }
    except ValueError as ve:
        logger.warning(f"Forex pair not found: {pair}")
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error fetching forex rate for {pair}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("")
async def list_forex(
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    current_user: User = Depends(get_current_active_user),
):
    """List forex rates."""
    try:
        rates = await MockService().list_forex()
        return {
            "count": len(rates),
            "rates": rates[:limit],
            "pagination": {"limit": limit, "offset": 0, "total": len(rates),
                           "has_more": len(rates) > limit},
            "metadata": {"timestamp": datetime.now(timezone.utc).isoformat(),
                         "authenticated_as": current_user.username},
        }
    except Exception as e:
        logger.error(f"Error listing forex: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")