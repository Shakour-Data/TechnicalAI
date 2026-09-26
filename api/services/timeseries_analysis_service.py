import asyncio
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta

import httpx

from api.services.tse_service import TSEService, Candle
from api.services.analysis_service import AnalysisService

logger = logging.getLogger(__name__)

ML_PREDICTION_SERVICE = "http://localhost:3032"
ML_TRAINER_SERVICE = "http://localhost:3033"

class TimeSeriesAnalysisService:
    def __init__(self):
        self.tse_service = TSEService()
        self.ml_base_url = ML_PREDICTION_SERVICE
        self.trainer_base_url = ML_TRAINER_SERVICE
        self.ttm_analysis_service = AnalysisService()

    async def analyze(self, symbol: str, analysis_type: str = "technical",
                      horizon: int = 30, model_keys: Optional[List[str]] = None) -> Dict[str, Any]:
        analysis_id = f"tsa_{symbol}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        
        try:
            candles = await self._fetch_candles(symbol)
            if len(candles) < 60:
                return {
                    "id": analysis_id,
                    "status": "insufficient_data",
                    "message": f"Need at least 60 candles, got {len(candles)}",
                    "symbol": symbol
                }

            ml_result = await self._call_ml_prediction_service(symbol, candles, horizon, model_keys or ["rf", "xgboost", "lightgbm", "gbr"])
            
            result = {
                "id": analysis_id,
                "symbol": symbol,
                "status": "completed",
                "analysis_type": "time_series",
                "candles_used": len(candles),
                "ml_forecast": ml_result,
                "generated_at": datetime.now(timezone.utc).isoformat()
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing {symbol}: {e}")
            return {
                "id": analysis_id,
                "status": "failed",
                "error": str(e),
                "symbol": symbol
            }

    async def analyze_with_detailed_decomposition(self, symbol: str, horizon: int = 30) -> Dict[str, Any]:
        analysis_id = f"tsa_detailed_{symbol}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        
        try:
            candles = await self._fetch_candles(symbol)
            if len(candles) < 60:
                return {
                    "id": analysis_id,
                    "status": "insufficient_data",
                    "message": f"Need at least 60 candles, got {len(candles)}",
                    "symbol": symbol
                }

            ml_result = await self._call_ml_prediction_service(symbol, candles, horizon, ["rf", "xgboost", "lightgbm"])
            
            decomposition = self._compute_decomposition(candles)
            volatility_analysis = self._compute_volatility_analysis(candles)
            trend_analysis = self._compute_trend_analysis(candles)
            seasonality = self._detect_seasonality(candles)
            
            result = {
                "id": analysis_id,
                "symbol": symbol,
                "status": "completed",
                "analysis_type": "detailed_time_series",
                "candles_used": len(candles),
                "date_range": [str(candles[0].date), str(candles[-1].date)],
                "forecast": ml_result,
                "decomposition": decomposition,
                "volatility": volatility_analysis,
                "trend": trend_analysis,
                "seasonality": seasonality,
                "generated_at": datetime.now(timezone.utc).isoformat()
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error in detailed analysis for {symbol}: {e}")
            return {
                "id": analysis_id,
                "status": "failed",
                "error": str(e),
                "symbol": symbol
            }

    async def _fetch_candles(self, symbol: str) -> List[Candle]:
        try:
            if symbol in self.tse_service.TSE_INDICES:
                return self.tse_service.fetch_index_history(symbol, limit=200)
            elif symbol in self.tse_service.SECTOR_INDICES:
                return self.tse_service.fetch_sector_history(symbol, limit=200)
            else:
                return self.tse_service.fetch_index_history("CWI", limit=200)
        except Exception as e:
            logger.error(f"Error fetching candles for {symbol}: {e}")
            raise

    async def _call_ml_prediction_service(self, symbol: str, candles: List[Candle],
                                           horizon: int, model_keys: List[str]) -> Dict[str, Any]:
        try:
            candles_data = []
            for c in candles:
                candles_data.append({
                    "date": c.date,
                    "open": c.open_price,
                    "high": c.high,
                    "low": c.low,
                    "close": c.close,
                    "volume": c.volume
                })
            
            payload = {
                "candles": candles_data,
                "sessions": horizon,
                "models": model_keys
            }
            
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    f"{self.ml_base_url}/api/predict",
                    json=payload
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(f"ML service returned {response.status_code}, using fallback")
                    return await self._fallback_prediction(candles, horizon)
                    
        except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
            logger.warning(f"Cannot connect to ML service ({self.ml_base_url}), using fallback: {e}")
            return await self._fallback_prediction(candles, horizon)
        except Exception as e:
            logger.error(f"Error calling ML service: {e}")
            return await self._fallback_prediction(candles, horizon)

    async def _fallback_prediction(self, candles: List[Candle], horizon: int) -> Dict[str, Any]:
        series = [c.close for c in candles]
        import numpy as np
        
        x = np.arange(len(series))
        coeffs = np.polyfit(x, series, 2)
        poly = np.poly1d(coeffs)
        
        future_x = np.arange(len(series), len(series) + horizon)
        predictions = poly(future_x)
        
        residuals = np.array(series) - poly(x)
        std_residual = float(np.std(residuals)) if len(residuals) > 0 else 1.0
        
        pred_list = []
        for i, pred in enumerate(predictions):
            mult = 1 + i * 0.05
            lower = float(pred - 1.96 * std_residual * mult)
            upper = float(pred + 1.96 * std_residual * mult)
            pred_list.append({
                "session": i + 1,
                "price": round(float(pred), 2),
                "lower": round(lower, 2),
                "upper": round(upper, 2)
            })
        
        return {
            "status": "ok",
            "symbol": None,
            "training_samples": len(series),
            "features_count": 30,
            "forecasts": {
                "polyfit": {
                    "model_name": "Polynomial Fit (Fallback)",
                    "cv_r2": 0.0,
                    "cv_rmse_pct": round(float(np.std(residuals) / np.mean(series) * 100), 2),
                    "predictions": pred_list
                }
            },
            "ensemble": {
                "model_name": "Polynomial Fit (Fallback)",
                "weights": {"polyfit": 1.0},
                "predictions": pred_list
            },
            "feature_importance": {},
            "fallback": True
        }

    def _compute_decomposition(self, candles: List[Candle]) -> Dict[str, Any]:
        import numpy as np
        series = np.array([c.close for c in candles])
        
        window = min(20, len(series) // 5)
        if window < 3:
            window = 3
        
        trend = np.convolve(series, np.ones(window)/window, mode='valid')
        trend_padded = np.concatenate([trend[:window//2], trend, trend[-(window//2):]])
        if len(trend_padded) < len(series):
            trend_padded = np.pad(trend_padded, (0, len(series) - len(trend_padded)), 'edge')
        elif len(trend_padded) > len(series):
            trend_padded = trend_padded[:len(series)]
        
        seasonal = series - trend_padded
        residual = series - trend_padded - seasonal.mean()
        
        return {
            "trend": trend.tolist(),
            "seasonal": seasonal.tolist(),
            "residual": residual.tolist(),
            "window": window,
            "method": "moving_average"
        }

    def _compute_volatility_analysis(self, candles: List[Candle]) -> Dict[str, Any]:
        import numpy as np
        
        returns = np.diff(np.log([c.close for c in candles]))
        volatility = np.sqrt(252) * np.std(returns) * 100
        rolling_vol = np.array([np.sqrt(252) * np.std(returns[max(0,i-19):i+1]) * 100 for i in range(len(returns))])
        
        q33 = np.percentile(rolling_vol, 33)
        q66 = np.percentile(rolling_vol, 66)
        
        regime = "low" if volatility < q33 else ("medium" if volatility < q66 else "high")
        
        return {
            "annualized_volatility": round(float(volatility), 2),
            "regime": regime,
            "rolling_volatility": rolling_vol.tolist(),
            "volatility_quantiles": {"q33": round(float(q33), 2), "q66": round(float(q66), 2)}
        }

    def _compute_trend_analysis(self, candles: List[Candle]) -> Dict[str, Any]:
        import numpy as np
        
        series = np.array([c.close for c in candles])
        x = np.arange(len(series))
        
        short_window = min(10, len(series) // 10)
        long_window = min(50, len(series) // 2)
        
        if short_window < 2 or long_window < 2:
            return {"direction": "neutral", "strength": 0.0}
        
        short_ma = np.convolve(series, np.ones(short_window)/short_window, mode='valid')
        long_ma = np.convolve(series, np.ones(long_window)/long_window, mode='valid')
        
        if len(short_ma) == 0 or len(long_ma) == 0:
            return {"direction": "neutral", "strength": 0.0}
        
        min_len = min(len(short_ma), len(long_ma))
        short_ma = short_ma[-min_len:]
        long_ma = long_ma[-min_len:]
        
        diff = short_ma - long_ma
        trend_strength = float(np.mean(np.abs(diff)) / np.mean(series[-min_len:]))
        direction = "bullish" if diff[-1] > 0 else "bearish" if diff[-1] < 0 else "neutral"
        
        return {
            "direction": direction,
            "strength": round(trend_strength, 4),
            "short_ma": short_ma.tolist(),
            "long_ma": long_ma.tolist(),
            "crossovers": int(np.sum(np.diff(np.sign(diff)) != 0))
        }

    def _detect_seasonality(self, candles: List[Candle]) -> Dict[str, Any]:
        import numpy as np
        
        series = np.array([c.close for c in candles])
        n = len(series)
        
        if n < 30:
            return {"has_seasonality": False, "period": None}
        
        seasonal_periods = [5, 10, 20]
        max_seasonal_strength = 0.0
        best_period = None
        
        for period in seasonal_periods:
            if n >= 2 * period:
                seasonal_component = np.zeros(period)
                counts = np.zeros(period)
                for i in range(n):
                    seasonal_component[i % period] += series[i]
                    counts[i % period] += 1
                seasonal_component = np.where(counts > 0, seasonal_component / counts, 0)
                
                reconstructed = np.tile(seasonal_component, n // period + 1)[:n]
                residual = series - reconstructed
                
                ss_seasonal = np.var(reconstructed)
                ss_total = np.var(series)
                
                if ss_total > 0:
                    strength = ss_seasonal / ss_total
                    if strength > max_seasonal_strength:
                        max_seasonal_strength = strength
                        best_period = period
        
        has_seasonality = max_seasonal_strength > 0.1
        
        return {
            "has_seasonality": has_seasonality,
            "seasonal_strength": round(float(max_seasonal_strength), 4),
            "period": best_period if has_seasonality else None,
            "method": "seasonal_decomposition"
        }
