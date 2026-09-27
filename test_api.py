import asyncio
from api.services.analysis_service import AnalysisService
from api.services.tse_service import Candle

async def test():
    service = AnalysisService()
    
    async def mock_fetch(symbol):
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
    
    service._fetch_candles = mock_fetch
    
    result = await service.analyze_time_series_quick('TEST', 5)
    print('SUCCESS!')
    print(f'Status: {result["status"]}')
    print(f'Bull Consensus: {result["ml_forecast"]["bull_consensus"]}')
    print(f'Training Samples: {result["ml_forecast"]["training_samples"]}')

asyncio.run(test())