import asyncio
import json
import logging
import time
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import random

from sqlalchemy import text

from api.models.database import SessionLocal
from api.models.analysis import Analysis, AnalysisResult
from api.services.tse_service import TSEService, Candle, TSE_INDICES, SECTOR_INDICES
from api.services.ml_models import run_ml_analysis
from api.services.data_source import DataSourceService

logger = logging.getLogger(__name__)


class TTLCache:
    """Simple in-memory cache with TTL."""
    def __init__(self, ttl_seconds: int = 300):
        self._cache: Dict[str, tuple[Any, float]] = {}
        self._ttl = ttl_seconds

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self._ttl:
                return value
            del self._cache[key]
        return None

    def set(self, key: str, value: Any) -> None:
        self._cache[key] = (value, time.time())


def _get_correlation_id() -> str:
    return str(uuid.uuid4())[:8]


class AnalysisService:
    _shared_cache = TTLCache(ttl_seconds=300)

    def __init__(self):
        self.ollama_base_url = 'http://localhost:11434'
        self.tse_service = TSEService()
        self.data_source = DataSourceService()
        self._cache = AnalysisService._shared_cache

    async def analyze(self, symbol: str, analysis_type: str = "technical", prompt: Optional[str] = None,
                      model: Optional[str] = None, horizon: int = 30, model_keys: Optional[List[str]] = None) -> Dict[str, Any]:
        try:
            if analysis_type == "time_series":
                return await self._run_timeseries_analysis(symbol, horizon, model_keys)
            
            analysis_id = f"analysis_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{symbol}"
            
            analysis = Analysis(
                id=analysis_id,
                symbol=symbol,
                instrument_type=self._get_instrument_type(symbol),
                analysis_type=analysis_type,
                prompt=prompt,
                model_used=model or self._select_best_model(analysis_type, symbol),
                status="pending"
            )
            
            with SessionLocal() as db:
                db.add(analysis)
                db.commit()
                db.refresh(analysis)
            
            asyncio.create_task(self._run_analysis_task(analysis_id, symbol, analysis_type, prompt, model))
            
            return {"id": analysis_id, "status": "completed", "message": "Analysis started"}
            
        except Exception as e:
            logger.error(f"Error starting analysis for {symbol}: {e}")
            raise

    async def _run_timeseries_analysis(self, symbol: str, horizon: int, model_keys: Optional[List[str]]) -> Dict[str, Any]:
        analysis_id = f"tsa_{symbol}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        
        try:
            result = await self.analyze_time_series_quick(symbol, horizon, model_keys)
            result["id"] = analysis_id
            result["analysis_type"] = "time_series"
            return result
        except Exception as e:
            logger.error(f"Time series analysis failed for {symbol}: {e}")
            return {
                "id": analysis_id,
                "symbol": symbol,
                "status": "failed",
                "error": str(e),
                "analysis_type": "time_series"
            }

    async def analyze_detailed(self, symbol: str, horizon: int = 30) -> Dict[str, Any]:
        analysis_id = f"tsa_detailed_{symbol}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        
        try:
            result = await self.analyze_time_series_detailed(symbol, horizon)
            result["id"] = analysis_id
            return result
        except Exception as e:
            logger.error(f"Detailed analysis failed for {symbol}: {e}")
            return {
                "id": analysis_id,
                "symbol": symbol,
                "status": "failed",
                "error": str(e)
            }

    async def _run_analysis_task(self, analysis_id: str, symbol: str, analysis_type: str, 
                                prompt: Optional[str], model: Optional[str]):
        db = None
        try:
            with SessionLocal() as db:
                analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
                
                if not analysis:
                    return
                    
                analysis.status = "running"
                db.commit()
                
                if analysis_type == "time_series":
                    result = await self.analyze_time_series_quick(symbol, horizon)
                else:
                    result_data = await self._generate_analysis_result(symbol, analysis_type)
                
                if analysis_type == "time_series":
                    for metric_name, metric_value in result.get("ml_forecast", {}).items():
                        analysis_result = AnalysisResult(
                            id=f"{analysis_id}_{metric_name}",
                            analysis_id=analysis_id,
                            metric_name=metric_name,
                            metric_value=json.dumps(metric_value),
                            recommendation=self._generate_recommendation(metric_name, 0, analysis_type)
                        )
                        db.add(analysis_result)
                    analysis.status = "completed"
                    analysis.completed_at = datetime.now(timezone.utc)
                    analysis.response = json.dumps(result)
                    db.commit()
                else:
                    for metric_name, metric_value in result_data.items():
                        analysis_result = AnalysisResult(
                            id=f"{analysis_id}_{metric_name}",
                            analysis_id=analysis_id,
                            metric_name=metric_name,
                            metric_value=metric_value,
                            recommendation=self._generate_recommendation(metric_name, metric_value, analysis_type)
                        )
                        db.add(analysis_result)
                    
                    analysis.status = "completed"
                    analysis.completed_at = datetime.now(timezone.utc)
                    db.commit()
                
        except Exception as e:
            logger.error(f"Error running analysis task {analysis_id}: {e}")
            try:
                with SessionLocal() as db:
                    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
                    if analysis:
                        analysis.status = "failed"
                        db.commit()
            except Exception as update_error:
                logger.error(f"Error marking analysis {analysis_id} as failed: {update_error}")
        finally:
            if db is not None:
                db.close()

    async def _generate_analysis_result(self, symbol: str, analysis_type: str) -> Dict[str, Any]:
        if analysis_type == "technical":
            base_price = random.uniform(100, 1000)
            trend = random.choice(['bullish', 'bearish', 'neutral'])
            
            return {
                'current_price': round(base_price, 2),
                'trend': trend,
                'rsi': round(random.uniform(30, 70), 2),
                'macd': round(random.uniform(-10, 10), 2),
                'bollinger_bands': {'upper': round(base_price * 1.1, 2), 'lower': round(base_price * 0.9, 2)},
                'volume': round(random.uniform(1000, 100000), 2),
                'support_level': round(base_price * 0.95, 2),
                'resistance_level': round(base_price * 1.05, 2),
                'next_session_prediction': round(random.uniform(base_price * 0.98, base_price * 1.02), 2),
            }
        
        elif analysis_type == "fundamental":
            return {
                'pe_ratio': round(random.uniform(5, 50), 2),
                'pb_ratio': round(random.uniform(0.5, 5), 2),
                'roe': round(random.uniform(5, 30), 2),
                'debt_to_equity': round(random.uniform(0, 5), 2),
                'revenue_growth': round(random.uniform(-10, 50), 2),
                'profit_margin': round(random.uniform(5, 40), 2),
                'earnings_per_share': round(random.uniform(1, 50), 2),
                'book_value_per_share': round(random.uniform(20, 200), 2),
                'analyst_recommendation': random.choice(['buy', 'hold', 'sell']),
                'target_price': round(random.uniform(100, 500), 2),
            }
        
        else:
            return {
                'sentiment_score': round(random.uniform(-1, 1), 3),
                'news_sentiment': random.choice(['positive', 'negative', 'neutral']),
                'social_sentiment': round(random.uniform(-0.5, 0.5), 3),
                'market_hype': random.uniform(0, 10),
                'fear_greed_index': random.randint(0, 100),
                'analyst_coverage': random.randint(1, 20),
                'analyst_consensus': random.choice(['buy', 'hold', 'sell']),
            }

    def _generate_recommendation(self, metric_name: str, metric_value: float, analysis_type: str) -> str:
        if analysis_type == "technical":
            if metric_name == 'rsi' and metric_value > 70:
                return 'Consider selling - overbought condition'
            elif metric_name == 'rsi' and metric_value < 30:
                return 'Consider buying - oversold condition'
            elif metric_name == 'macd' and metric_value > 0:
                return 'Bullish momentum'
            else:
                return 'Wait for clearer signals'
        
        elif analysis_type == "fundamental":
            if metric_name == 'pe_ratio' and metric_value < 15:
                return 'Potentially undervalued'
            elif metric_name == 'roe' and metric_value > 20:
                return 'Strong profitability'
            else:
                return 'Evaluate based on industry standards'
        
        else:
            if metric_name == 'sentiment_score' and metric_value > 0.5:
                return 'Positive market sentiment'
            elif metric_name == 'sentiment_score' and metric_value < -0.5:
                return 'Negative market sentiment'
            else:
                return 'Mixed signals'

    def _get_instrument_type(self, symbol: str) -> str:
        if symbol.isdigit():
            return 'index'
        elif symbol.endswith('.') or 'IND' in symbol:
            return 'index'
        else:
            return 'stock'

    async def _select_best_model(self, analysis_type: str, symbol: str) -> str:
        models = {
            'technical': 'ollama/deepseek-coder:6.7b',
            'fundamental': 'ollama/llama2:13b',
            'sentiment': 'ollama/mistral:7b',
        }
        return models.get(analysis_type, 'ollama/llama2:13b')

    async def get_result(self, analysis_id: str) -> Dict[str, Any]:
        try:
            with SessionLocal() as db:
                analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
                
                if not analysis:
                    raise ValueError(f"Analysis not found: {analysis_id}")
                
                results = db.query(AnalysisResult).filter(AnalysisResult.analysis_id == analysis_id).all()
                
                return {
                    'analysis_id': analysis_id,
                    'symbol': analysis.symbol,
                    'type': analysis.analysis_type,
                    'status': analysis.status,
                    'results': [{'metric': r.metric_name, 'value': r.metric_value, 'recommendation': r.recommendation} 
                               for r in results]
                }
                
        except Exception as e:
            logger.error(f"Error getting result for {analysis_id}: {e}")
            raise

    async def analyze_time_series_quick(self, symbol: str, horizon: int = 30, model_keys: List[str] = None) -> Dict[str, Any]:
        if not symbol or not symbol.strip():
            raise ValueError("Symbol is required")
        if horizon < 1 or horizon > 90:
            raise ValueError("Horizon must be 1-90")
        if model_keys:
            valid_models = {"rf", "xgboost", "lightgbm", "gbr", "svr"}
            invalid = set(model_keys) - valid_models
            if invalid:
                raise ValueError(f"Invalid models: {invalid}")
        
        cache_key = f"quick_{symbol}_{horizon}_{'_'.join(sorted(model_keys or []))}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached
        
        analysis_id = f"tsa_{symbol}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        corr_id = _get_correlation_id()
        
        try:
            logger.info(f"[{corr_id}] Processing quick time series analysis {analysis_id} for {symbol}")
            candles = await self._fetch_candles(symbol)
            if len(candles) < 60:
                return {
                    "id": analysis_id,
                    "status": "insufficient_data",
                    "message": f"Need at least 60 candles, got {len(candles)}",
                    "symbol": symbol
                }

            ml_result = self._run_native_ml_prediction(symbol, candles, horizon, model_keys or ["rf", "xgboost", "lightgbm", "gbr"])
            
            result = {
                "id": analysis_id,
                "symbol": symbol,
                "status": "completed",
                "analysis_type": "time_series",
                "candles_used": len(candles),
                "ml_forecast": ml_result,
                "generated_at": datetime.now(timezone.utc).isoformat()
            }
            
            self._cache.set(cache_key, result)
            logger.info(f"[{corr_id}] Quick time series analysis {analysis_id} completed for {symbol}")
            return result
             
        except Exception as e:
            logger.error(f"[{corr_id}] Error analyzing {symbol}: {e}")
            return {
                "id": analysis_id,
                "status": "failed",
                "error": str(e),
                "symbol": symbol
            }

    async def analyze_time_series_detailed(self, symbol: str, horizon: int = 30) -> Dict[str, Any]:
        if not symbol or not symbol.strip():
            raise ValueError("Symbol is required")
        if horizon < 1 or horizon > 90:
            raise ValueError("Horizon must be 1-90")
        
        analysis_id = f"tsa_detailed_{symbol}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        corr_id = _get_correlation_id()
        
        try:
            logger.info(f"[{corr_id}] Processing detailed time series analysis {analysis_id} for {symbol}")
            candles = await self._fetch_candles(symbol)
            if len(candles) < 60:
                return {
                    "id": analysis_id,
                    "status": "insufficient_data",
                    "message": f"Need at least 60 candles, got {len(candles)}",
                    "symbol": symbol
                }

            ml_result = self._run_native_ml_prediction(symbol, candles, horizon, ["rf", "xgboost", "lightgbm"])
            
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
            
            logger.info(f"[{corr_id}] Detailed time series analysis {analysis_id} completed for {symbol}")
            return result
             
        except Exception as e:
            logger.error(f"[{corr_id}] Error in detailed analysis for {symbol}: {e}")
            return {
                "id": analysis_id,
                "status": "failed",
                "error": str(e),
                "symbol": symbol
            }

    async def _fetch_candles(self, symbol: str) -> List[Candle]:
        try:
            if symbol in TSE_INDICES:
                return self.tse_service.fetch_index_history(symbol, limit=200)
            elif symbol in SECTOR_INDICES:
                return self.tse_service.fetch_sector_history(symbol, limit=200)
            else:
                # Try to fetch actual stock data for non-index/sector symbols
                try:
                    candles_data = await self.data_source._get_tse_history(
                        symbol, 'tse', None, None, 200
                    )
                    # Convert dict candles to Candle objects
                    candles = []
                    for c in candles_data:
                        candles.append(Candle(
                            date=c['date'],
                            open_price=float(c['open']) if c.get('open') else 0.0,
                            high=float(c['high']) if c.get('high') else 0.0,
                            low=float(c['low']) if c.get('low') else 0.0,
                            close=float(c['close']) if c.get('close') else 0.0,
                            volume=float(c['volume']) if c.get('volume') else 0.0,
                        ))
                    return candles
                except Exception:
                    # Fall back to Yahoo Finance if TSE data not available
                    try:
                        candles_data = await self.data_source._get_yfinance_history(
                            symbol, None, None, 200
                        )
                        # Convert dict candles to Candle objects
                        candles = []
                        for c in candles_data:
                            candles.append(Candle(
                                date=c['date'],
                                open_price=float(c['open']) if c.get('open') else 0.0,
                                high=float(c['high']) if c.get('high') else 0.0,
                                low=float(c['low']) if c.get('low') else 0.0,
                                close=float(c['close']) if c.get('close') else 0.0,
                                volume=float(c['volume']) if c.get('volume') else 0.0,
                            ))
                        return candles
                    except Exception:
                        return []
        except Exception as e:
            logger.error(f"Error fetching candles for {symbol}: {e}")
            raise

    def _prepare_candles_data(self, candles: List[Candle]) -> List[Dict[str, float]]:
        """Convert Candle objects to the dict format expected by ML models."""
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
        return candles_data

    def _run_native_ml_prediction(self, symbol: str, candles: List[Candle],
                                         horizon: int, model_keys: List[str]) -> Dict[str, Any]:
        """Run ML prediction using native Python models (no external service required)."""
        candles_data = self._prepare_candles_data(candles)
        
        return run_ml_analysis(
            candles_data,
            symbol=symbol,
            horizon=horizon,
            model_keys=model_keys
        )

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
