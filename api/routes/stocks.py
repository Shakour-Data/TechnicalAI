"""Stock routes."""
from typing import Annotated, Dict, Any, Optional
from datetime import datetime, timezone
import time as time_module

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from api.auth import User, get_current_active_user
from api.services.mock_service import MockService
from api.middleware.logging import logger

router = APIRouter(prefix="/stocks", tags=["Stocks"])


@router.get("/history", response_model=Dict[str, Any])
async def get_stock_history(
    symbol: Annotated[str, Query(..., description="Stock symbol")] = "",
    market: Optional[str] = Query(default="tse", description="Market"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    adjust: Optional[bool] = Query(True, description="Adjust prices"),
    current_user: User = Depends(get_current_active_user),
):
    """Get stock historical data."""
    try:
        if not symbol.strip():
            raise ValueError("Stock symbol cannot be empty")

        if start_date:
            datetime.strptime(start_date, "%Y-%m-%d")
        if end_date:
            datetime.strptime(end_date, "%Y-%m-%d")

        request_start = time_module.time()
        data = await MockService().get_stock_history(
            symbol=symbol.upper(), market=market,
            start_date=start_date, end_date=end_date,
            limit=limit, adjust=adjust,
        )
        duration = time_module.time() - request_start

        return {
            "symbol": symbol.upper(),
            "market": market,
            "count": len(data),
            "data": data,
            "pagination": {"limit": limit, "offset": 0, "total": len(data),
                           "has_more": len(data) == limit},
            "metadata": {
                "request_id": f"req_{int(time_module.time() * 1000)}",
                "timestamp": datetime.now().isoformat(),
                "response_time_ms": round(duration * 1000, 2),
                "authenticated_as": current_user.username,
            },
        }
    except ValueError as ve:
        logger.warning(f"Validation error for {symbol}: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error fetching stock history for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/search")
async def search_stocks(
    query: Optional[str] = Query(None, description="Search query for symbol or name"),
    market: Optional[str] = Query(None, description="Market filter"),
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    current_user: User = Depends(get_current_active_user),
):
    """Search stocks by symbol or name."""
    try:
        results = await MockService().search_stocks(query=query, market=market)
        paginated_results = results[:limit]
        return {
            "query": query,
            "count": len(paginated_results),
            "total": len(results),
            "results": paginated_results,
            "pagination": {"limit": limit, "offset": 0, "total": len(results),
                           "has_more": len(results) > limit},
            "metadata": {"timestamp": datetime.now().isoformat(),
                         "authenticated_as": current_user.username},
        }
    except Exception as e:
        logger.error(f"Error searching stocks: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{symbol}/quote")
async def get_stock_quote(
    symbol: Annotated[str, Field(..., min_length=1, max_length=20, description="Stock symbol")],
    current_user: User = Depends(get_current_active_user),
):
    """Get current stock quote."""
    try:
        quote = await MockService().get_stock_quote(symbol.upper())
        return {
            "symbol": symbol.upper(),
            "quote": quote,
            "metadata": {"timestamp": datetime.now().isoformat(),
                         "authenticated_as": current_user.username},
        }
    except ValueError as ve:
        logger.warning(f"Stock not found: {symbol}")
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error fetching stock quote for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")