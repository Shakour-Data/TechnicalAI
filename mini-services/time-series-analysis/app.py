"""
FastAPI application for time series analysis service.
"""

import os
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from analysis import TimeSeriesAnalyzer
from config import PORT, HOST, FORECAST_STEPS, DEFAULT_CONFIDENCE

app = FastAPI(
    title="Time Series Analysis Service",
    description="Service for performing time series analysis on financial data",
    version="1.0.0"
)


class AnalysisRequest(BaseModel):
    """Request for time series analysis."""
    symbol: str = Field(..., description="Stock symbol (e.g., AAPL)")
    forecast_steps: int = Field(default=FORECAST_STEPS, ge=1, le=365, description="Number of steps to forecast")
    confidence_level: float = Field(default=DEFAULT_CONFIDENCE, ge=0.5, le=0.99, description="Confidence level for intervals")
    include_decomposition: bool = Field(default=False, description="Include time series decomposition")
    include_stationarity: bool = Field(default=False, description="Include stationarity tests")
    include_spectrum: bool = Field(default=False, description="Include spectrum analysis")
    include_regime_detection: bool = Field(default=False, description="Include regime detection")


class AnalysisResponse(BaseModel):
    """Response from time series analysis."""
    symbol: str
    analysis_id: str
    forecast_steps: int
    confidence_level: float
    basic_stats: Dict[str, Any]
    models: Dict[str, Any]
    decomposition: Optional[Dict[str, Any]] = None
    stationarity: Optional[Dict[str, Any]] = None
    spectrum: Optional[Dict[str, Any]] = None
    regime_detection: Optional[Dict[str, Any]] = None
    timestamp: str


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "time-series-analysis"}


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_time_series_endpoint(request: AnalysisRequest):
    """Perform time series analysis on the given symbol."""
    try:
        # Download data
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365*2)  # 2 years of data
        ticker = yf.Ticker(request.symbol.upper())
        df = ticker.history(start=start_date, end=end_date)
        
        if df.empty or len(df) < 30:
            raise HTTPException(status_code=400, detail=f"Insufficient data for symbol {request.symbol}")
        
        # Prepare data for analyzer (use Close prices)
        data = pd.DataFrame({
            'Close': df['Close']
        })
        
        # Create analyzer
        analyzer = TimeSeriesAnalyzer(data, request.symbol.upper())
        
        # Run analysis
        results = analyzer.analyze(
            forecast_steps=request.forecast_steps,
            confidence=request.confidence_level,
            include_decomposition=request.include_decomposition,
            include_stationarity=request.include_stationarity,
            include_spectrum=request.include_spectrum,
            include_regime=request.include_regime_detection
        )
        
        # Format response
        response = {
            "symbol": request.symbol.upper(),
            "analysis_id": f"tsa_{request.symbol.upper()}_{int(datetime.now().timestamp())}",
            "forecast_steps": request.forecast_steps,
            "confidence_level": request.confidence_level,
            "basic_stats": results.get('basic_stats', {}),
            "models": {},
            "decomposition": results.get('decomposition'),
            "stationarity": results.get('stationarity'),
            "spectrum": results.get('spectrum'),
            "regime_detection": results.get('regime_detection'),
            "timestamp": datetime.now().isoformat()
        }
        
        # Format models output
        models_data = results.get('models', {})
        for model_name, model_data in models_data.items():
            if 'error' in model_data:
                response["models"][model_name] = {"error": model_data['error']}
            else:
                response["models"][model_name] = {
                    "forecast": model_data.get('forecast', {}),
                    "metrics": model_data.get('metrics', {})
                }
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)