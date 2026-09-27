"""Dashboard routes."""
from typing import Annotated, Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from api.auth import User, get_current_active_user
from api.services.mock_service import MockService
from api.middleware.logging import logger

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/overview")
async def dashboard_overview(current_user: User = Depends(get_current_active_user)):
    """Get dashboard overview."""
    try:
        overview = await MockService().get_dashboard_overview()
        return {
            **overview,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username,
                "role": current_user.role,
            },
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard overview: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/market-summary")
async def market_summary(current_user: User = Depends(get_current_active_user)):
    """Get market summary."""
    try:
        summary = await MockService().get_market_summary()
        return {
            **summary,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username,
                "role": current_user.role,
            },
        }
    except Exception as e:
        logger.error(f"Error fetching market summary: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")