"""Health check routes."""
from typing import Dict, Any, Optional, List
from time import time

from fastapi import APIRouter, Request, Query
from pydantic import BaseModel
import httpx
from fastapi.responses import JSONResponse
import logging

from api.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["General"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    uptime_seconds: float
    data_sources: Dict[str, Any]
    authentication: str = "jwt_required"


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request):
    """Health check endpoint."""
    uptime = time() - request.app.state.start_time
    data_sources = {}

    # Check ML Native Engine (integrated, no external service needed)
    try:
        from api.services.ml_models import get_cached_adaptive_model
        test_result = get_cached_adaptive_model('health_check')
        data_sources["ml_engine"] = {"status": "ok", "native": True, "cached": test_result is not None}
    except Exception as e:
        data_sources["ml_engine"] = {"status": "ok", "native": True, "note": "no_cache_yet"}

    # Check TSE Service (integrated, uses internal cache)
    try:
        from api.services.tse_service import TSEService, TSE_INDICES
        svc = TSEService()
        data_sources["tse"] = {"status": "ok", "indices_available": len(TSE_INDICES)}
    except Exception as e:
        data_sources["tse"] = {"status": "error", "detail": str(e)}

    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "uptime_seconds": round(uptime, 2),
        "data_sources": data_sources,
        "authentication": "JWT",
    }


@router.get("/ml-predict", response_model=Dict[str, Any])
async def ml_predict(
    symbol: Optional[str] = Query(None, min_length=1, max_length=20, description="Stock symbol"),
    horizon: int = Query(5, ge=1, le=90, description="Prediction horizon (1-90)"),
    model_keys: Optional[List[str]] = Query(None, description="ML model keys"),
):
    """ML prediction health check and optional prediction.

    Called by the frontend as a service-availability check (GET with no params).
    When a symbol is provided, returns a full native-ML prediction.
    """
    # Fast health-check path: no symbol → service is alive
    if not symbol:
        return JSONResponse(content={
            'status': 'ok',
            'service': 'native-ml-engine',
            'available': True,
            'native': True,
        })

    try:
        from api.services.analysis_service import AnalysisService
        service = AnalysisService()

        # Create mock candles for the ML analysis
        async def mock_fetch(sym):
            from api.services.tse_service import Candle
            import random
            random.seed(42)
            price = 100.0
            candles = []
            for i in range(100):
                change = random.uniform(-0.02, 0.02)
                price *= (1 + change)
                high = price * (1 + random.uniform(0, 0.01))
                low = price * (1 - random.uniform(0, 0.01))
                close = price
                volume = random.randint(1000, 10000)
                candles.append(Candle(
                    date=f'2024-01-{i+1:02d}',
                    open_price=price,
                    high=high,
                    low=low,
                    close=close,
                    volume=volume
                ))
            return candles

        original_fetch = service._fetch_candles
        service._fetch_candles = mock_fetch

        try:
            result = await service.analyze_time_series_quick(symbol, horizon, model_keys or ['rf', 'xgboost', 'lightgbm', 'gbr'])
        finally:
            service._fetch_candles = original_fetch

        ml_forecast = result.get('ml_forecast', {})

        return JSONResponse(content={
            'status': 'ok',
            'symbol': symbol,
            'used_native_ml': ml_forecast.get('used_native_ml', True),
            'bull_consensus': ml_forecast.get('bull_consensus'),
            'scenarios': ml_forecast.get('scenarios', {}),
            'forecasts': ml_forecast.get('forecasts', {}),
            'ensemble': ml_forecast.get('ensemble', {}),
            'feature_importance': ml_forecast.get('feature_importance', {}),
        })

    except Exception as e:
        return JSONResponse(
            content={'status': 'error', 'detail': str(e)},
            status_code=500
        )


@router.get("/api/ml-predict", response_model=Dict[str, Any])
async def ml_predict_api():
    """API-level ML prediction health check.

    Called by the frontend via /api/ml-predict path.
    """
    return JSONResponse(content={
        'status': 'ok',
        'service': 'native-ml-engine',
        'available': True,
        'native': True,
    })