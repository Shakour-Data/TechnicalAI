from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import asyncio
import logging
import json
import os

logger = logging.getLogger(__name__)


class YahooFinanceService:
    """Service for fetching international market data via Yahoo Finance."""

    def __init__(self):
        self._yf = None
        self._initialized = False
        self.default_cache_ttl = 900  # 15 minutes

    async def _get_client(self):
        if not self._initialized:
            await self._initialize()
        return self._yf

    async def _initialize(self):
        self._yf = await asyncio.to_thread(self._import_yfinance)
        self._initialized = True

    def _import_yfinance(self):
        import yfinance as yf
        yf.pdr_override() if hasattr(yf, 'pdr_override') else None
        return yf

    async def get_stock_history(self, symbol: str, start_date: str, end_date: str,
                                interval: str = '1d', limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch historical stock data from Yahoo Finance."""
        yf = await self._get_client()
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(start=start_date, end=end_date, interval=interval)
            
            if hist.empty:
                raise ValueError(f"No data found for {symbol}")
            
            candles = []
            for index, row in hist.iterrows():
                candles.append({
                    'date': index.strftime('%Y-%m-%d'),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume']),
                    'adj_close': float(row['Close']),
                    'source': 'yahoo-finance',
                })
            
            return candles[-limit:]
        except Exception as e:
            logger.error(f"Error fetching YFinance history for {symbol}: {e}")
            raise

    async def get_stock_quote(self, symbol: str) -> Dict[str, Any]:
        """Get real-time quote for a stock."""
        yf = await self._get_client()
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            hist = ticker.history(period='2d')
            if not hist.empty:
                latest = hist.iloc[-1]
                prev = hist.iloc[-2] if len(hist) > 1 else latest
                current_price = float(latest['Close'])
                prev_close = float(prev['Close'])
                change = current_price - prev_close
                change_pct = round((change / prev_close * 100) if prev_close else 0, 2)
                
                return {
                    'symbol': symbol,
                    'name': info.get('longName', symbol),
                    'price': current_price,
                    'change': round(change, 2),
                    'change_pct': change_pct,
                    'open': float(latest['Open']),
                    'high': float(latest['High']),
                    'low': float(latest['Low']),
                    'volume': int(latest['Volume']),
                    'exchange': info.get('exchange', 'N/A'),
                    'currency': info.get('currency', 'USD'),
                    'source': 'yahoo-finance',
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                }
            
            raise ValueError(f"No quote data for {symbol}")
        except Exception as e:
            logger.error(f"Error fetching quote for {symbol}: {e}")
            raise

    async def search_stocks(self, query: str) -> List[Dict[str, Any]]:
        """Search for stocks by name or symbol."""
        yf = await self._get_client()
        try:
            results = yf.search(query, max_downloads=10)
            if results is None or results.empty:
                return []
            
            stocks = []
            for _, row in results.iterrows():
                stocks.append({
                    'symbol': row.get('symbol', ''),
                    'name': row.get('name', ''),
                    'exchange': row.get('exchange', ''),
                    'category': row.get('category', ''),
                    'country': row.get('country', ''),
                })
            
            return stocks
        except Exception as e:
            logger.error(f"Error searching stocks for {query}: {e}")
            return []

    async def get_crypto_history(self, symbol: str, days: int = 365) -> List[Dict[str, Any]]:
        """Fetch cryptocurrency historical data."""
        yf = await self._get_client()
        try:
            ticker = yf.Ticker(f"{symbol}-USD")
            hist = ticker.history(period=f"{days}d", interval='1d')
            
            if hist.empty:
                raise ValueError(f"No crypto data for {symbol}")
            
            candles = []
            for index, row in hist.iterrows():
                candles.append({
                    'date': index.strftime('%Y-%m-%d'),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume']),
                    'source': 'yahoo-finance',
                })
            
            return candles
        except Exception as e:
            logger.error(f"Error fetching crypto history for {symbol}: {e}")
            raise

    async def get_commodity_history(self, symbol: str, days: int = 365) -> List[Dict[str, Any]]:
        """Fetch commodity historical data."""
        yf = await self._get_client()
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=f"{days}d", interval='1d')
            
            if hist.empty:
                raise ValueError(f"No commodity data for {symbol}")
            
            candles = []
            for index, row in hist.iterrows():
                candles.append({
                    'date': index.strftime('%Y-%m-%d'),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume']),
                    'source': 'yahoo-finance',
                })
            
            return candles
        except Exception as e:
            logger.error(f"Error fetching commodity history for {symbol}: {e}")
            raise
