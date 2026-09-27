"""Commodity routes."""
from typing import Annotated, Dict, Any, Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from api.auth import User, get_current_active_user
from api.services.mock_service import MockService
from api.middleware.logging import logger

router = APIRouter(prefix="/commodities", tags=["Commodities"])


@router.get("")
async def list_commodities(
    category: Optional[str] = Query(None, description="Category filter"),
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    offset: Annotated[Optional[int], Field(default=0, ge=0)] = 0,
    current_user: User = Depends(get_current_active_user),
):
    """List commodities."""
    try:
        commodities = await MockService().list_commodities(category=category)
        paginated = commodities[offset:offset + limit]
        return {
            "count": len(paginated),
            "total": len(commodities),
            "commodities": paginated,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": len(commodities),
                "has_more": offset + limit < len(commodities),
            },
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username,
            },
        }
    except Exception as e:
        logger.error(f"Error listing commodities: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")