"""TechnicalAI Backend API — Main application entry point."""
import logging
from contextlib import asynccontextmanager
from time import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

from api.config import settings
from api.models.database import Base, engine
from api.middleware.logging import LoggingMiddleware
from api.middleware.rate_limit import RateLimitMiddleware
from api.middleware.security_headers import SecurityHeadersMiddleware
from api.errors import setup_exception_handlers
from api.routes.stocks import router as stocks_router
from api.routes.indices import router as indices_router
from api.routes.sectors import router as sectors_router
from api.routes.forex import router as forex_router
from api.routes.crypto import router as crypto_router
from api.routes.commodities import router as commodities_router
from api.routes.analysis import router as analysis_router
from api.routes.dashboard import router as dashboard_router
from api.routes.health import router as health_router, HealthResponse

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize SQLAlchemy models
Base.metadata.create_all(bind=engine)

# Metrics
REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"])
REQUEST_DURATION = Histogram("http_request_duration_seconds", "Request duration")
ERROR_COUNT = Counter("http_errors_total", "Total errors", ["endpoint", "error_type"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - setup and teardown."""
    app.state.start_time = time()
    logger.info("TechnicalAI Backend starting up...")
    yield
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

# Register routers
app.include_router(health_router)
app.include_router(stocks_router, prefix="/api/v1")
app.include_router(indices_router, prefix="/api/v1")
app.include_router(sectors_router, prefix="/api/v1")
app.include_router(forex_router, prefix="/api/v1")
app.include_router(crypto_router, prefix="/api/v1")
app.include_router(commodities_router, prefix="/api/v1")
app.include_router(analysis_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


import uvicorn
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)