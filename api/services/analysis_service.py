import asyncio
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import random
import time

from sqlalchemy import text

from api.models.database import SessionLocal
from api.models.analysis import Analysis, AnalysisResult
from api.services.timeseries_analysis_service import TimeSeriesAnalysisService

logger = logging.getLogger(__name__)


class AnalysisService:
    def __init__(self):
        self.ollama_base_url = 'http://localhost:11434'
        self.tse_base_url = 'http://localhost:3031'
        self.ts_service = TimeSeriesAnalysisService()

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
            result = await self.ts_service.analyze(symbol, analysis_type="time_series", horizon=horizon, model_keys=model_keys)
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
            result = await self.ts_service.analyze_with_detailed_decomposition(symbol, horizon)
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
                    result = await self.ts_service.analyze(symbol, analysis_type="time_series")
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
