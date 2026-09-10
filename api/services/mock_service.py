import time
import random
import logging
from pathlib import Path
import json
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class MockService:
    """Mock financial data service that simulates real API responses."""

    def __init__(self):
        self.cache_dir = Path("./db/cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.indian_stocks = self._load_indian_stocks()
        self.iranian_indices = self._load_iranian_indices()
        self.iranian_sectors = self._load_iranian_sectors()
        self.forex_pairs = self._load_forex_pairs()
        self.commodities = self._load_commodities()

    def _load_indian_stocks(self) -> List[Dict[str, Any]]:
        """Load Indian stock data from mock database."""
        return [
            {
                'symbol': 'AAPL',
                'name': 'Apple Inc.',
                'name_en': 'Apple Inc.',
                'market': 'NASDAQ',
                'exchange': 'NASDAQ',
                'sector': 'Technology',
                'currency': 'USD',
                'price': 174.56,
                'change': 2.34,
                'change_pct': 1.36,
                'volume': 5678900,
                'market_cap': 2850000000000,
            },
            {
                'symbol': 'MSFT',
                'name': 'Microsoft Corporation',
                'name_en': 'Microsoft Corporation',
                'market': 'NASDAQ',
                'exchange': 'NASDAQ',
                'sector': 'Technology',
                'currency': 'USD',
                'price': 418.23,
                'change': -1.23,
                'change_pct': -0.29,
                'volume': 3456789,
                'market_cap': 3150000000000,
            },
            {
                'symbol': 'TSLA',
                'name': 'Tesla Inc.',
                'name_en': 'Tesla Inc.',
                'market': 'NASDAQ',
                'exchange': 'NASDAQ',
                'sector': 'Automotive',
                'currency': 'USD',
                'price': 256.89,
                'change': 5.67,
                'change_pct': 2.26,
                'volume': 8901234,
                'market_cap': 1800000000000,
            },
            {
                'symbol': 'AMZN',
                'name': 'Amazon.com Inc.',
                'name_en': 'Amazon.com Inc.',
                'market': 'NASDAQ',
                'exchange': 'NASDAQ',
                'sector': 'E-commerce',
                'currency': 'USD',
                'price': 145.67,
                'change': -2.34,
                'change_pct': -1.58,
                'volume': 2345678,
                'market_cap': 950000000000,
            },
            {
                'symbol': 'GOOGL',
                'name': 'Alphabet Inc.',
                'name_en': 'Alphabet Inc.',
                'market': 'NASDAQ',
                'exchange': 'NASDAQ',
                'sector': 'Technology',
                'currency': 'USD',
                'price': 2456.78,
                'change': 12.34,
                'change_pct': 0.51,
                'volume': 1234567,
                'market_cap': 3200000000000,
            },
        ]

    def _load_iranian_indices(self) -> List[Dict[str, Any]]:
        """Load Iranian index data."""
        return [
            {
                'code': 'CWI',
                'name': 'شرکت بورس تهران',
                'name_en': 'Tehran Stock Exchange Index',
                'market': 'IR',
                'category': 'main',
                'web_id': '32097828799138957',
                'current_price': 1250000.0,
                'change': 5000.0,
                'change_pct': 0.4,
                'volume': 1234567890,
                'timestamp': datetime.now(timezone.utc).isoformat(),
            },
            {
                'code': 'EWI',
                'name': 'شاخص هم وزن',
                'name_en': 'Equity Weighted Index',
                'market': 'IR',
                'category': 'main',
                'web_id': '67130298613737946',
                'current_price': 980000.0,
                'change': -15000.0,
                'change_pct': -1.5,
                'volume': 987654321,
                'timestamp': datetime.now(timezone.utc).isoformat(),
            },
            {
                'code': 'INDI',
                'name': 'شاخص صنعت',
                'name_en': 'Industry Index',
                'market': 'IR',
                'category': 'main',
                'web_id': '43754960038275285',
                'current_price': 2100000.0,
                'change': 35000.0,
                'change_pct': 1.7,
                'volume': 543210987,
                'timestamp': datetime.now(timezone.utc).isoformat(),
            },
        ]

    def _load_iranian_sectors(self) -> List[Dict[str, Any]]:
        """Load Iranian sector data."""
        return [
            {
                'name': 'زراعت',
                'web_id': '34408080767216529',
                'current_price': 1500000.0,
                'change': 25000.0,
                'change_pct': 1.7,
                'volume': 123456789,
            },
            {
                'name': 'خودرو',
                'web_id': '20213770409093165',
                'current_price': 2200000.0,
                'change': -15000.0,
                'change_pct': -0.7,
                'volume': 987654321,
            },
            {
                'name': 'بانک',
                'web_id': '72002976013856737',
                'current_price': 4500.0,
                'change': 75.0,
                'change_pct': 1.7,
                'volume': 543210987,
            },
        ]

    def _load_forex_pairs(self) -> List[Dict[str, Any]]:
        """Load forex pair data."""
        return [
            {
                'pair': 'USDIRR',
                'base_currency': 'USD',
                'target_currency': 'IRR',
                'rate': 37500.0,
                'bid': 37480.0,
                'ask': 37520.0,
                'change': -50.0,
                'change_pct': -0.13,
                'high': 37600.0,
                'low': 37400.0,
                'volume': 1234567890,
                'source': 'tgju-api',
            },
            {
                'pair': 'EURIRR',
                'base_currency': 'EUR',
                'target_currency': 'IRR',
                'rate': 41200.0,
                'bid': 41180.0,
                'ask': 41220.0,
                'change': 120.0,
                'change_pct': 0.3,
                'high': 41300.0,
                'low': 41100.0,
                'volume': 987654321,
                'source': 'tgju-api',
            },
        ]

    def _load_commodities(self) -> List[Dict[str, Any]]:
        """Load commodity data."""
        return [
            {
                'symbol': 'GOLD',
                'name': 'انس جهانی طلا',
                'name_en': 'International Gold',
                'category': 'precious_metals',
                'price': 2150.5,
                'unit': 'USD/oz',
                'change': 5.2,
                'change_pct': 0.24,
                'high': 2155.0,
                'low': 2145.0,
                'volume': 123456789,
                'source': 'tgju-api',
            },
            {
                'symbol': 'OIL',
                'name': 'نفت برنت',
                'name_en': 'Brent Oil',
                'category': 'energy',
                'price': 78.25,
                'unit': 'USD/barrel',
                'change': -1.5,
                'change_pct': -1.88,
                'high': 80.0,
                'low': 77.5,
                'volume': 987654321,
                'source': 'tgju-api',
            },
        ]

    async def get_stock_history(self, symbol: str, market: str = 'tse', start_date: Optional[str] = None,
                                end_date: Optional[str] = None, limit: int = 100, adjust: bool = True) -> List[Dict[str, Any]]:
        """Get stock history data."""
        # Check cache first
        cache_key = f"stock_history:{market}:{symbol}:{start_date}:{end_date}:{limit}"
        cached = await self._load_from_cache(cache_key)
        if cached:
            return cached

        # Simulate stock data generation
        stocks = [s for s in self.indian_stocks if s['symbol'] == symbol.upper()]
        if not stocks:
            # Generate mock data for unknown stocks
            stocks = [{'symbol': symbol, 'name': symbol, 'price': 100.0, 'change': 0, 'change_pct': 0}]
        
        stock = stocks[0]
        candles = []
        
        # Generate historical price data
        base_price = stock['price']
        for i in range(limit):
            date_offset = limit - i
            date = datetime.now(timezone.utc)
            date_str = (date.replace(hour=0, minute=0, second=0, microsecond=0)
                       .replace(day=max(1, date.day - date_offset)))
            date_str = date_str.strftime('%Y-%m-%d')
            
            # Generate realistic price variation
            daily_change = random.uniform(-0.05, 0.05)
            price = base_price * (1 + daily_change)
            
            # Generate OHLC
            open_price = price * (1 - random.uniform(0, 0.02))
            high = max(open_price, price) * (1 + random.uniform(0, 0.03))
            low = min(open_price, price) * (1 - random.uniform(0, 0.03))
            close = price
            
            candles.append({
                'date': date_str,
                'open': round(open_price, 2),
                'high': round(high, 2),
                'low': round(low, 2),
                'close': round(close, 2),
                'volume': random.randint(1000, 100000),
                'source': 'mock-data',
            })
        
        # Save to cache
        await self._save_to_cache(cache_key, candles)
        return candles

    async def get_stock_quote(self, symbol: str) -> Dict[str, Any]:
        """Get stock quote."""
        stocks = [s for s in self.indian_stocks if s['symbol'] == symbol.upper()]
        if not stocks:
            # Return random mock data for unknown stocks
            base_price = random.uniform(50, 500)
            change = random.uniform(-10, 10)
            change_pct = (change / base_price) * 100 if base_price else 0
            return {
                'symbol': symbol,
                'name': symbol,
                'price': round(base_price, 2),
                'change': round(change, 2),
                'change_pct': round(change_pct, 2),
                'open': round(base_price * (1 + random.uniform(-0.02, 0.02)), 2),
                'high': round(base_price * (1 + random.uniform(0, 0.05)), 2),
                'low': round(base_price * (1 - random.uniform(0, 0.05)), 2),
                'volume': random.randint(1000, 1000000),
                'exchange': 'mock',
                'currency': 'USD',
                'source': 'mock-data',
                'timestamp': datetime.now(timezone.utc).isoformat(),
            }
        
        return stocks[0]

    async def search_stocks(self, query: Optional[str] = None, market: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for stocks."""
        results = self.indian_stocks.copy()
        
        if query:
            query_lower = query.lower()
            results = [s for s in results if query_lower in s['symbol'].lower() or query_lower in s['name'].lower()]
        
        if market:
            results = [s for s in results if s['market'] == market]
        
        return results

    async def get_index_history(self, code: str, start_date: Optional[str], end_date: Optional[str], limit: int) -> List[Dict[str, Any]]:
        """Get index history."""
        cache_key = f"index_history:{code}:{start_date}:{end_date}:{limit}"
        cached = await self._load_from_cache(cache_key)
        if cached:
            return cached

        indices = [i for i in self.iranian_indices if i['code'] == code.upper()]
        if not indices:
            raise ValueError(f"Unknown index code: {code}")
        
        index = indices[0]
        candles = []
        
        base_price = index['current_price']
        for i in range(limit):
            date_offset = limit - i
            date = datetime.now(timezone.utc)
            date_str = (date.replace(hour=0, minute=0, second=0, microsecond=0)
                       .replace(day=max(1, date.day - date_offset)))
            date_str = date_str.strftime('%Y-%m-%d')
            
            daily_change = random.uniform(-0.03, 0.03)
            price = base_price * (1 + daily_change)
            
            # Generate OHLC
            open_price = price * (1 - random.uniform(0, 0.02))
            high = max(open_price, price) * (1 + random.uniform(0, 0.03))
            low = min(open_price, price) * (1 - random.uniform(0, 0.03))
            close = price
            
            candles.append({
                'date': date_str,
                'open': round(open_price, 2),
                'high': round(high, 2),
                'low': round(low, 2),
                'close': round(close, 2),
                'volume': random.randint(100000, 10000000),
                'source': 'mock-data',
            })
        
        await self._save_to_cache(cache_key, candles)
        return candles

    async def list_indices(self, market: Optional[str] = None) -> List[Dict[str, Any]]:
        """List indices."""
        results = self.iranian_indices.copy()
        
        if market:
            results = [i for i in results if i['market'] == market]
        
        return results

    async def list_sectors(self) -> List[Dict[str, Any]]:
        """List sectors."""
        return self.iranian_sectors.copy()

    async def get_forex_rate(self, pair: str) -> Dict[str, Any]:
        """Get forex rate."""
        pairs = [p for p in self.forex_pairs if p['pair'] == pair.upper()]
        if not pairs:
            raise ValueError(f"Unknown forex pair: {pair}")
        
        return pairs[0]

    async def list_forex(self) -> List[Dict[str, Any]]:
        """List forex pairs."""
        return self.forex_pairs.copy()

    async def get_crypto_price(self, symbol: str) -> Dict[str, Any]:
        """Get crypto price."""
        cryptos = [
            {
                'symbol': 'BTC',
                'name': 'Bitcoin',
                'name_en': 'Bitcoin',
                'price_usd': 45000.0 + random.uniform(-1000, 1000),
                'change': random.uniform(-500, 500),
                'change_pct': random.uniform(-5, 5),
                'high': 46000.0 + random.uniform(0, 2000),
                'low': 44000.0 + random.uniform(0, 1000),
                'volume': random.uniform(1000, 100000),
                'source': 'mock-data',
            },
            {
                'symbol': 'ETH',
                'name': 'Ethereum',
                'name_en': 'Ethereum',
                'price_usd': 2500.0 + random.uniform(-100, 100),
                'change': random.uniform(-50, 50),
                'change_pct': random.uniform(-5, 5),
                'high': 2600.0 + random.uniform(0, 200),
                'low': 2400.0 + random.uniform(0, 100),
                'volume': random.uniform(1000, 100000),
                'source': 'mock-data',
            },
        ]
        
        crypto = [c for c in cryptos if c['symbol'] == symbol.upper()]
        if not crypto:
            raise ValueError(f"Unknown crypto symbol: {symbol}")
        
        return crypto[0]

    async def list_crypto(self) -> List[Dict[str, Any]]:
        """List available cryptos."""
        return [
            {'symbol': 'BTC', 'name': 'Bitcoin', 'name_en': 'Bitcoin'},
            {'symbol': 'ETH', 'name': 'Ethereum', 'name_en': 'Ethereum'},
            {'symbol': 'BNB', 'name': 'Binance Coin', 'name_en': 'Binance Coin'},
            {'symbol': 'XRP', 'name': 'Ripple', 'name_en': 'Ripple'},
            {'symbol': 'ADA', 'name': 'Cardano', 'name_en': 'Cardano'},
        ]

    async def list_commodities(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """List commodities."""
        results = self.commodities.copy()
        
        if category:
            results = [c for c in results if c['category'] == category]
        
        return results

    async def get_dashboard_overview(self) -> Dict[str, Any]:
        """Get dashboard overview."""
        return {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'tse': {'status': 'ok', 'source': 'mock-data'},
            'international': {'status': 'ok', 'source': 'mock-data'},
            'forex_gold': {'status': 'ok', 'source': 'mock-data'},
            'crypto': {'status': 'ok', 'source': 'mock-data'},
        }

    async def get_market_summary(self) -> Dict[str, Any]:
        """Get market summary."""
        return {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'tse': {'status': 'ok', 'source': 'mock-data'},
            'international': {'status': 'ok', 'source': 'mock-data'},
            'forex_gold': {'status': 'ok', 'source': 'mock-data'},
            'crypto': {'status': 'ok', 'source': 'mock-data'},
        }

    def _load_from_cache(self, key: str, max_age_seconds: int = 300) -> Optional[List[Dict[str, Any]]]:
        """Load data from file cache."""
        cache_dir = Path("./db/cache")
        cache_dir.mkdir(exist_ok=True)
        
        cache_path = cache_dir / f"{hash(key)}.json"
        if not cache_path.exists():
            return None
        
        try:
            with open(cache_path, 'r') as f:
                data = json.load(f)
            
            cached_time = data.get('cached_at', 0)
            if time.time() - cached_time > max_age_seconds:
                return None
            
            return data.get('data', [])
        except Exception as e:
            logger.error(f"Cache load failed for {key}: {e}")
            return None

    async def _save_to_cache(self, key: str, data: List[Dict[str, Any]], ttl: int = 300):
        """Save data to file cache."""
        cache_dir = Path("./db/cache")
        cache_dir.mkdir(exist_ok=True)
        
        cache_path = cache_dir / f"{hash(key)}.json"
        
        try:
            cache_data = {
                'cached_at': time.time(),
                'ttl': ttl,
                'data': data
            }
            
            with open(cache_path, 'w') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Cache save failed for {key}: {e}")