import json
import asyncio
import requests
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List, Annotated

from fastapi import FastAPI, Request, HTTPException, Depends, Query, BackgroundTasks, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import time
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from api.config import settings
from api.models.database import get_db, engine, Base
from api.services.mock_service import MockService
from api.services.cache_service import CacheService
from api.middleware.logging import LoggingMiddleware
from api.middleware.rate_limit import RateLimitMiddleware
from api.middleware.security_headers import SecurityHeadersMiddleware
from api.security import verify_token, get_user_by_id, User
from api.errors import ErrorResponse, setup_exception_handlers
from api.auth import get_current_user, get_current_active_user, require_role, require_any_role

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Initialize services
mock_service = MockService()
cache_service = CacheService()

# Initialize SQLAlchemy models
Base.metadata.create_all(bind=engine)

# Metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'Request duration')
ERROR_COUNT = Counter('http_errors_total', 'Total errors', ['endpoint', 'error_type'])

# Pydantic models for request/response

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Initialize services
mock_service = MockService()
cache_service = CacheService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    Base.metadata.create_all(bind=engine)
    # Initialize app state
    app.state.start_time = time.time()
    logger.info("TechnicalAI Backend starting up...")
    yield
    # Shutdown
    logger.info("TechnicalAI Backend shutting down...")


app = FastAPI(
    title=settings.app_name,
    description=(
        "TechnicalAI Backend API - Real-time financial data for Iran stocks, "
        "forex, crypto, and commodities. "
        "Provides market data, technical analysis, and portfolio insights."
    ),
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "TechnicalAI Team",
        "email": "api@technicalai.ir",
        "url": "https://technicalai.ir",
    },
    license_info={
        "name": "Proprietary",
        "url": "https://technicalai.ir/license",
    },
    servers=[
        {"url": "https://api.technicalai.ir", "description": "Production"},
        {"url": "https://staging-api.technicalai.ir", "description": "Staging"},
        {"url": "http://localhost:8000", "description": "Development"},
    ],
)

# Middleware order matters - add in correct order
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=settings.allowed_methods,
    allow_headers=settings.allowed_headers,
)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=settings.requests_per_minute)

# Setup standardized exception handlers
setup_exception_handlers(app)

security = HTTPBearer(auto_error=False)


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not credentials:
        return None
    return {"user_id": "api_user", "role": "user"}


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    uptime_seconds: float
    data_sources: Dict[str, Any]
    authentication: str = "jwt_required"


@app.get("/health", response_model=HealthResponse, tags=["General"])
async def health_check():
    start = time.time()
    sources_status = await mock_service.get_dashboard_overview()
    uptime = time.time() - app.state.start_time
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "uptime_seconds": round(uptime, 2),
        "data_sources": sources_status,
        "authentication": "JWT",
    }


@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


class StockHistoryRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20, description="Stock symbol")
    market: Optional[str] = Field(default="tse", description="Market: tse, farabourse, international")
    start_date: Optional[str] = Field(default=None, description="Start date YYYY-MM-DD")
    end_date: Optional[str] = Field(default=None, description="End date YYYY-MM-DD")
    limit: Optional[int] = Field(default=100, ge=1, le=5000)
    adjust: Optional[bool] = Field(default=True, description="Adjust prices")

    @field_validator('symbol')
    @classmethod
    def validate_symbol(cls, v):
        if not v.strip():
            raise ValueError('Symbol is required')
        return v.strip().upper()


@app.get("/api/v1/stocks/{symbol}/history", tags=["Stocks"], response_model=Dict[str, Any])
async def get_stock_history(
    symbol: Annotated[str, Field(..., min_length=1, max_length=20, description="Stock symbol (uppercase)")],
    market: Optional[str] = "tse",
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    adjust: Optional[bool] = Query(True, description="Whether to adjust prices for splits/dividends"),
    current_user: User = Depends(get_current_active_user),
):
    try:
        # Validate symbol format
        if not symbol.strip():
            raise ValueError("Stock symbol cannot be empty")
        
        # Validate date format if provided
        if start_date:
            try:
                datetime.strptime(start_date, "%Y-%m-%d")
            except ValueError:
                raise ValueError("Start date must be in YYYY-MM-DD format")
        
        if end_date:
            try:
                datetime.strptime(end_date, "%Y-%m-%d")
            except ValueError:
                raise ValueError("End date must be in YYYY-MM-DD format")
        
        # Record metrics
        request_start = time.time()
        
        data = await mock_service.get_stock_history(
            symbol=symbol.upper(), market=market,
            start_date=start_date, end_date=end_date,
            limit=limit, adjust=adjust
        )
        
        # Record duration metrics
        duration = time.time() - request_start
        REQUEST_COUNT.labels(method="GET", endpoint="stocks/history", status="200").inc()
        REQUEST_DURATION.observe(duration)
        
        return {
            "symbol": symbol.upper(), 
            "market": market, 
            "count": len(data), 
            "data": data,
            "pagination": {
                "limit": limit,
                "offset": 0,
                "total": len(data),
                "has_more": len(data) == limit  # Simplified - in real scenario would check total count
            },
            "metadata": {
                "request_id": f"req_{int(time.time() * 1000)}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "response_time_ms": round(duration * 1000, 2),
                "authenticated_as": current_user.username
            }
        }
    except ValueError as ve:
        logger.warning(f"Validation error for {symbol}: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error fetching stock history for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/stocks/search", tags=["Stocks"])
async def search_stocks(
    query: Optional[str] = Query(None, description="Search query for symbol or name"),
    market: Optional[str] = Query(None, description="Market filter"),
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    current_user: User = Depends(get_current_active_user),
):
    try:
        results = await mock_service.search_stocks(query=query, market=market)
        # Apply pagination
        paginated_results = results[:limit]
        return {
            "query": query,
            "count": len(paginated_results),
            "total": len(results),
            "results": paginated_results,
            "pagination": {
                "limit": limit,
                "offset": 0,
                "total": len(results),
                "has_more": len(results) > limit
            },
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username
            }
        }
    except Exception as e:
        logger.error(f"Error searching stocks: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/stocks/{symbol}/quote", tags=["Stocks"])
async def get_stock_quote(
    symbol: Annotated[str, Field(..., min_length=1, max_length=20, description="Stock symbol")],
    current_user: User = Depends(get_current_active_user),
):
    try:
        quote = await mock_service.get_stock_quote(symbol.upper())
        return {
            "symbol": symbol.upper(),
            "quote": quote,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username
            }
        }
    except ValueError as ve:
        logger.warning(f"Stock not found: {symbol}")
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error fetching stock quote for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/indices/{code}/history", tags=["Indices"])
async def get_index_history(
    code: Annotated[str, Field(..., min_length=1, max_length=20, description="Index code")],
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    current_user: User = Depends(get_current_active_user),
):
    try:
        data = await mock_service.get_index_history(code.upper(), start_date, end_date, limit)
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


@app.get("/api/v1/indices", tags=["Indices"])
async def list_indices(
    market: Optional[str] = Query(None, description="Market filter"),
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    offset: Annotated[Optional[int], Field(default=0, ge=0)] = 0,
    current_user: User = Depends(get_current_active_user),
):
    try:
        indices = await mock_service.list_indices(market=market)
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


@app.get("/api/v1/sectors", tags=["Indices"])
async def list_sectors(current_user: User = Depends(get_current_active_user)):
    try:
        sectors = await mock_service.list_sectors()
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


@app.get("/api/v1/forex/{pair}", tags=["Forex"])
async def get_forex_rate(
    pair: Annotated[str, Field(..., min_length=1, max_length=10, description="Forex pair (e.g., USDIRR)")],
    current_user: User = Depends(get_current_active_user),
):
    try:
        rate = await mock_service.get_forex_rate(pair.upper())
        return {
            "pair": pair.upper(),
            "rate": rate,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username
            }
        }
    except ValueError as ve:
        logger.warning(f"Forex pair not found: {pair}")
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error fetching forex rate for {pair}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/forex", tags=["Forex"])
async def list_forex(
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    current_user: User = Depends(get_current_active_user),
):
    try:
        rates = await mock_service.list_forex()
        return {
            "count": len(rates),
            "rates": rates[:limit],
            "pagination": {
                "limit": limit,
                "offset": 0,
                "total": len(rates),
                "has_more": len(rates) > limit
            },
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username
            }
        }
    except Exception as e:
        logger.error(f"Error listing forex: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/crypto/{symbol}", tags=["Crypto"])
async def get_crypto_price(
    symbol: Annotated[str, Field(..., min_length=1, max_length=10, description="Cryptocurrency symbol (e.g., BTC)")],
    current_user: User = Depends(get_current_active_user),
):
    try:
        price = await mock_service.get_crypto_price(symbol.upper())
        return {
            "symbol": symbol.upper(),
            "price": price,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username
            }
        }
    except ValueError as ve:
        logger.warning(f"Crypto symbol not found: {symbol}")
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error fetching crypto price for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/crypto", tags=["Crypto"])
async def list_crypto(
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    current_user: User = Depends(get_current_active_user),
):
    try:
        prices = await mock_service.list_crypto()
        return {
            "count": len(prices),
            "prices": prices[:limit],
            "pagination": {
                "limit": limit,
                "offset": 0,
                "total": len(prices),
                "has_more": len(prices) > limit
            },
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username
            }
        }
    except Exception as e:
        logger.error(f"Error listing crypto: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/commodities", tags=["Commodities"])
async def list_commodities(
    category: Optional[str] = Query(None, description="Category filter (e.g., precious_metals, energy)"),
    limit: Annotated[Optional[int], Field(default=20, ge=1, le=100)] = 20,
    offset: Annotated[Optional[int], Field(default=0, ge=0)] = 0,
    current_user: User = Depends(get_current_active_user),
):
    try:
        commodities = await mock_service.list_commodities(category=category)
        paginated = commodities[offset:offset + limit]
        return {
            "count": len(paginated),
            "total": len(commodities),
            "commodities": paginated,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": len(commodities),
                "has_more": offset + limit < len(commodities)
            },
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username
            }
        }
    except Exception as e:
        logger.error(f"Error listing commodities: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


class AnalysisRequest(BaseModel):
    symbol: Annotated[str, Field(..., min_length=1, max_length=20, description="Stock symbol to analyze")]
    analysis_type: Annotated[str, Field(default="technical", description="Analysis type: technical, fundamental, sentiment")]
    prompt: Optional[str] = Field(default=None, description="Optional custom prompt for analysis")
    model: Optional[str] = Field(default=None, description="Optional AI model override")


class AnalysisResponse(BaseModel):
    analysis_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    created_at: str
    completed_at: Optional[str] = None


@app.post("/api/v1/analysis", tags=["Analysis"], response_model=AnalysisResponse)
async def run_analysis(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
):
    try:
        # Validate analysis type
        valid_types = ["technical", "fundamental", "sentiment"]
        if request.analysis_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid analysis type. Must be one of: {', '.join(valid_types)}"
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
            user_id=current_user.user_id
        )
        
        return {
            "analysis_id": analysis_id,
            "status": "processing",
            "created_at": created_at,
            "completed_at": None,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username,
                "role": current_user.role
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating analysis for {request.symbol}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def _process_analysis(analysis_id, symbol, analysis_type, prompt, model, user_id):
    """Background task to process analysis."""
    try:
        logger.info(f"Processing analysis {analysis_id} for {symbol}")
        # Simulate processing time
        await asyncio.sleep(2)
        result = await mock_service.get_dashboard_overview()
        # In production, this would store the result in a database
        logger.info(f"Analysis {analysis_id} completed")
    except Exception as e:
        logger.error(f"Error processing analysis {analysis_id}: {e}")


@app.get("/api/v1/analysis/{analysis_id}", tags=["Analysis"], response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: Annotated[str, Field(..., description="Analysis ID")],
    current_user: User = Depends(get_current_active_user),
):
    try:
        # In production, this would look up the analysis result from database
        # For now, return a mock completed result
        result = await mock_service.get_dashboard_overview()
        return {
            "analysis_id": analysis_id,
            "status": "completed",
            "result": result,
            "created_at": "2024-01-01T00:00:00Z",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Error fetching analysis {analysis_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/dashboard/overview", tags=["Dashboard"])
async def dashboard_overview(current_user: User = Depends(get_current_active_user)):
    try:
        overview = await mock_service.get_dashboard_overview()
        return {
            **overview,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username,
                "role": current_user.role
            }
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard overview: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/dashboard/market-summary", tags=["Dashboard"])
async def market_summary(current_user: User = Depends(get_current_active_user)):
    try:
        summary = await mock_service.get_market_summary()
        return {
            **summary,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username,
                "role": current_user.role
            }
        }
    @app.get("/api/v1/dashboard/market-summary", tags=["Dashboard"])
async def market_summary(current_user: User = Depends(get_current_active_user)):
    try:
        summary = await mock_service.get_market_summary()
        return {
            **summary,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "authenticated_as": current_user.username,
                "role": current_user.role
            }
        }
    except Exception as e:
        logger.error(f"Error fetching market summary: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")



import uvicorn
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
