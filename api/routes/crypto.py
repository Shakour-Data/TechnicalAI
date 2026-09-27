"""Crypto routes."""
from typing import Annotated, Dict, Any, Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from api.auth import User, get_current_active_user
from api.services.mock_service import MockService
from api.middleware.logging import logger

router = APIRouter(prefix="/crypto", tags=["Crypto"])


@router.get("/{symbol}")
async def get_crypto_price(
    symbol: Annotated[str, Field(..., min_length=1, max_length=10, description="Cryptocurrency symbol (e.g., BTC)")],
    current_user: User = Depends(get_current_active_user),
):
    """Get cryptocurrency price."""
    try:
        price = await MockService().get_crypto_price(symbol.upper())
        return {
            "symbol": symbol.upper(),
            "price": price,
            "metadata": {"timestamp": datetime.now(timezone.utc).isoformat(),
                         "authenticated_as": current_user.username},
        }
    except ValueError as ve:
        logger.warning(f"Crypto symbol not found: {symbol}")
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error fetching crypto price for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("")
async def list_crypto(
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    current_user: User = Depends(get_current_active_user),
):
    """List cryptocurrency prices."""
    try:
        prices = await MockService().list_crypto()
        return {
            "count": len(prices),
            "prices": prices[:limit],
            "pagination": {"limit": limit, "offset": 0, "total": len(prices),
                           "has_more": len(prices) > limit},
            "metadata": {"timestamp": datetime.now(timezone.utc).isoformat(),
                         "authenticated_as": current_user.username},
        }
    except Exception as e:
        logger.error(f"Error listing crypto: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")