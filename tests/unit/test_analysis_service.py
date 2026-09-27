import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import sys
sys.path.insert(0, str(__file__.split('tests/')[0]))
from api.services.analysis_service import AnalysisService

@pytest.mark.asyncio
async def test_analyze_time_series_quick_success():
    service = AnalysisService()
    with patch.object(service, '_call_ml_prediction_service') as mock_ml:
        mock_ml.return_value = {
            "status": "ok", "symbol": None, "training_samples": 100,
            "features_count": 30,
            "forecasts": {
                "rf": {"model_name": "Random Forest", "cv_r2": 0.75, "cv_rmse_pct": 2.5,
                       "predictions": [{"session": 1, "price": 100.0, "change_pct": 1.0, "lower": 95.0, "upper": 105.0}]},
                "xgboost": {"model_name": "XGBoost", "cv_r2": 0.80, "cv_rmse_pct": 2.0,
                            "predictions": [{"session": 1, "price": 101.0, "change_pct": 1.1, "lower": 96.0, "upper": 106.0}]},
            },
            "ensemble": {"model_name": "Ensemble", "weights": {"rf": 0.4, "xgboost": 0.6},
                         "predictions": [{"session": 1, "price": 100.6, "change_pct": 1.05, "lower": 95.5, "upper": 105.5}]},
            "feature_importance": {"feature1": 0.5, "feature2": 0.3},
        }
        with patch.object(service, '_fetch_candles', new_callable=AsyncMock) as mock_fetch:
            mock_candle = MagicMock()
            mock_candle.close = 100.0; mock_candle.date = "2024-01-01"
            mock_candle.open_price = 99.0; mock_candle.high = 101.0
            mock_candle.low = 98.0; mock_candle.volume = 1000.0
            mock_fetch.return_value = [mock_candle] * 100
            result = await service.analyze_time_series_quick("TEST", 10, ["rf", "xgboost"])
            assert result["status"] == "completed"
            assert "ml_forecast" in result
            assert result["candles_used"] == 100

@pytest.mark.asyncio
async def test_analyze_time_series_detailed_includes_decomposition():
    service = AnalysisService()
    with patch.object(service, '_call_ml_prediction_service') as mock_ml:
        mock_ml.return_value = {"status": "ok", "symbol": None, "training_samples": 100,
                                 "features_count": 30, "forecasts": {},
                                 "ensemble": {"model_name": "Ensemble", "weights": {}, "predictions": []},
                                 "feature_importance": {}}
        with patch.object(service, '_fetch_candles', new_callable=AsyncMock) as mock_fetch:
            mock_candle = MagicMock()
            mock_candle.close = 100.0; mock_candle.date = "2024-01-01"
            mock_candle.open_price = 99.0; mock_candle.high = 101.0
            mock_candle.low = 98.0; mock_candle.volume = 1000.0
            mock_fetch.return_value = [mock_candle] * 100
            result = await service.analyze_time_series_detailed("TEST", 10)
            assert result["status"] == "completed"
            assert "decomposition" in result
            assert "volatility" in result
            assert "trend" in result
            assert "seasonality" in result

@pytest.mark.asyncio
async def test_insufficient_candles():
    service = AnalysisService()
    with patch.object(service, '_fetch_candles', new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = [MagicMock()] * 30
        result = await service.analyze_time_series_quick("TEST", 10)
        assert result["status"] == "insufficient_data"

@pytest.mark.asyncio
async def test_invalid_symbol_raises_error():
    service = AnalysisService()
    with pytest.raises(ValueError, match="Symbol is required"):
        await service.analyze_time_series_quick("", 10)

@pytest.mark.asyncio
async def test_invalid_horizon_raises_error():
    service = AnalysisService()
    with pytest.raises(ValueError, match="Horizon must be 1-90"):
        await service.analyze_time_series_quick("TEST", 100)

@pytest.mark.asyncio
async def test_invalid_model_keys_raise_error():
    service = AnalysisService()
    with pytest.raises(ValueError, match="Invalid models"):
        await service.analyze_time_series_quick("TEST", 10, ["invalid_model"])