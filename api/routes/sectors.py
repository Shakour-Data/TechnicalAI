"""Sectors routes."""
from typing import Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from api.auth import User, get_current_active_user
from api.services.mock_service import MockService
from api.middleware.logging import logger

router = APIRouter(prefix="/sectors", tags=["Indices"])


@router.get("")
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