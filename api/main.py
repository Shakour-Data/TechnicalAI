from contextlib import asynccontextmanager
from typing import Optional, Dict, Any

from fastapi import FastAPI, Request, HTTPException, Depends, Query, BackgroundTasks, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import time
import logging
import json
import uuid
from datetime import datetime, timezone

from api.models.database import get_db, engine, Base
from api.services.mock_service import MockService
from api.services.cache_service import CacheService
from api.middleware.logging import LoggingMiddleware
from api.middleware.rate_limit import RateLimitMiddleware

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Initialize services
mock_service = MockService()
cache_service = CacheService()

# Metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'Request duration')
ERROR_COUNT = Counter('http_errors_total', 'Total errors', ['endpoint', 'error_type'])


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
    title="TechnicalAI Backend API",
    description="Real-time financial data API for Iran stocks, forex, crypto, commodities",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=120)

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


@app.get("/health", response_model=HealthResponse)
async def health_check():
    start = time.time()
    sources_status = await mock_service.get_dashboard_overview()
    uptime = time.time() - app.state.start_time
    return {
        "status": "ok",
        "service": "technicalai-backend",
        "version": "2.0.0",
        "uptime_seconds": uptime,
        "data_sources": sources_status,
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


@app.get("/api/v1/stocks/{symbol}/history")
async def get_stock_history(symbol: str, market: Optional[str] = "tse",
                            start_date: Optional[str] = None, end_date: Optional[str] = None,
                            limit: Optional[int] = 100, adjust: Optional[bool] = True):
    try:
        data = await mock_service.get_stock_history(
            symbol=symbol.upper(), market=market,
            start_date=start_date, end_date=end_date,
            limit=limit, adjust=adjust
        )
        return {"symbol": symbol, "market": market, "count": len(data), "data": data}
    except Exception as e:
        logger.error(f"Error fetching stock history for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/stocks/search")
async def search_stocks(query: Optional[str] = Query(None, description="Search query"),
                        market: Optional[str] = Query(None, description="Market filter")):
    try:
        results = await mock_service.search_stocks(query=query, market=market)
        return {"query": query, "count": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/stocks/{symbol}/quote")
async def get_stock_quote(symbol: str):
    try:
        quote = await mock_service.get_stock_quote(symbol.upper())
        return {"symbol": symbol, "quote": quote}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/indices/{code}/history")
async def get_index_history(code: str, start_date: Optional[str] = None,
                            end_date: Optional[str] = None, limit: Optional[int] = 100):
    try:
        data = await mock_service.get_index_history(code.upper(), start_date, end_date, limit)
        return {"code": code, "count": len(data), "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/indices")
async def list_indices(market: Optional[str] = Query(None)):
    try:
        indices = await mock_service.list_indices(market=market)
        return {"count": len(indices), "indices": indices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/sectors")
async def list_sectors():
    try:
        sectors = await mock_service.list_sectors()
        return {"count": len(sectors), "sectors": sectors}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/forex/{pair}")
async def get_forex_rate(pair: str):
    try:
        rate = await mock_service.get_forex_rate(pair.upper())
        return {"pair": pair, "rate": rate}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/forex")
async def list_forex():
    try:
        rates = await mock_service.list_forex()
        return {"count": len(rates), "rates": rates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/crypto/{symbol}")
async def get_crypto_price(symbol: str):
    try:
        price = await mock_service.get_crypto_price(symbol.upper())
        return {"symbol": symbol, "price": price}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/crypto")
async def list_crypto():
    try:
        prices = await mock_service.list_crypto()
        return {"count": len(prices), "prices": prices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/commodities")
async def list_commodities(category: Optional[str] = Query(None)):
    try:
        commodities = await mock_service.list_commodities(category=category)
        return {"count": len(commodities), "commodities": commodities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AnalysisRequest(BaseModel):
    symbol: str
    analysis_type: str = Field(default="technical", description="technical, fundamental, sentiment")
    prompt: Optional[str] = None
    model: Optional[str] = None


@app.post("/api/v1/analysis")
async def run_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks):
    try:
        result = await mock_service.get_dashboard_overview()
        return {"analysis_id": f"analysis_{request.symbol}", "status": "completed", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/analysis/{analysis_id}")
async def get_analysis(analysis_id: str):
    try:
        result = await mock_service.get_dashboard_overview()
        return {"analysis_id": analysis_id, "status": "completed", "result": result}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/v1/dashboard/overview")
async def dashboard_overview():
    try:
        overview = await mock_service.get_dashboard_overview()
        return overview
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/dashboard/market-summary")
async def market_summary():
    try:
        summary = await mock_service.get_market_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(status_code=500, content={"error": "Internal server error", "detail": str(exc)})


import uvicorn
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
