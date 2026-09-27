import asyncio
from api.services.analysis_service import AnalysisService

async def test():
    service = AnalysisService()
    # Test with mock data - we'll patch _fetch_candles to return mock data
    original_fetch = service._fetch_candles
    async def mock_fetch(symbol):
        # Generate mock OHLCV data
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
            from api.services.tse_service import Candle
            candles.append(Candle(
                date=f'2024-01-{i+1:02d}',
                open_price=price,
                high=high,
                low=low,
                close=close,
                volume=volume
            ))
        return candles
    
    service._fetch_candles = mock_fetch
    
    # Test quick analysis
    result = await service.analyze_time_series_quick('TEST', 5)
    print('Quick Analysis Result:')
    print(f'  Status: {result.get("status")}')
    print(f'  Analysis Type: {result.get("analysis_type")}')
    print(f'  Symbol: {result.get("symbol")}')
    print(f'  Candles Used: {result.get("candles_used")}')
    
    ml_forecast = result.get('ml_forecast', {})
    print(f'  ML Status: {ml_forecast.get("status")}')
    print(f'  Bull Consensus: {ml_forecast.get("bull_consensus")}')
    print(f'  Training Samples: {ml_forecast.get("training_samples")}')
    print(f'  ML Accuracy: {ml_forecast.get("ml_accuracy")}')
    print(f'  Used Native ML: {ml_forecast.get("used_native_ml")}')
    
    forecasts = ml_forecast.get('forecasts', {})
    if 'logistic_regression_vdss' in forecasts:
        lr = forecasts['logistic_regression_vdss']
        print(f'  LR Model: {lr.get("model_name")}')
        print(f'  LR Predictions: {len(lr.get("predictions", []))} sessions')
    
    ensemble = ml_forecast.get('ensemble', {})
    print(f'  Ensemble Model: {ensemble.get("model_name")}')
    print(f'  Ensemble Predictions: {len(ensemble.get("predictions", []))} sessions')
    
    service._fetch_candles = original_fetch
    return result

if __name__ == "__main__":
    result = asyncio.run(test())
    print('\n✅ Integration test passed!')