from __future__ import annotations

from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import asyncio
import json
import logging
import os
import random
import re
import sqlite3
import time
from pathlib import Path
from urllib.parse import urlencode

import httpx
import pandas as pd

from api.services.cache_service import CacheService

LOGGER = logging.getLogger(__name__)


class DataSourceService:
    """Unified data source service for all financial data providers."""

    def __init__(self, cache_service: CacheService = None):
        self.cache_service = cache_service or CacheService()
        self.tse_service_url = os.environ.get('TSE_SERVICE_URL', 'http://localhost:3031')
        self.finpy_service_url = os.environ.get('FINPY_SERVICE_URL', 'http://localhost:3031')
        self.yfinance = None
        self.tgju_api_url = os.environ.get('TGJU_API_URL', 'https://tgju.amirhossein.info')
        self._yfinance_loaded = False

    async def check_sources(self) -> Dict[str, Any]:
        results = {}
        tasks = [
            ('tse', self._check_tse()),
            ('finpy', self._check_finpy()),
            ('ollama', self._check_ollama()),
        ]
        for name, task in tasks:
            try:
                results[name] = await task
            except Exception as e:
                results[name] = {'status': 'error', 'error': str(e)}
        return results

    async def _check_tse(self) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.tse_service_url}/api/health")
            return {'status': 'ok' if response.status_code == 200 else 'error', 'latency_ms': response.elapsed.total_seconds() * 1000}
        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    async def _check_finpy(self) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.finpy_service_url}/health")
            return {'status': 'ok' if response.status_code == 200 else 'error', 'latency_ms': response.elapsed.total_seconds() * 1000}
        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    async def _check_ollama(self) -> Dict[str, Any]:
        base_url = os.environ.get('OLLAMA_BASE_URL', 'http://localhost:11434')
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{base_url}/api/tags")
            if response.status_code != 200:
                return {'status': 'error', 'error': f'HTTP {response.status_code}'}
            models = response.json().get('models', [])
            return {'status': 'ok' if models else 'error', 'models': [m.get('name') for m in models]}
        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    async def get_stock_history(self, symbol: str, market: str = 'tse', start_date: Optional[str] = None,
                                end_date: Optional[str] = None, limit: int = 100, adjust: bool = True) -> List[Dict[str, Any]]:
        if market.lower() in ('tse', 'farabourse'):
            return await self._get_tse_history(symbol, market, start_date, end_date, limit, adjust)
        return await self._get_yfinance_history(symbol, start_date, end_date, limit)

    async def _get_tse_history(self, symbol: str, market: str, start_date: Optional[str],
                               end_date: Optional[str], limit: int, adjust: bool) -> List[Dict[str, Any]]:
        params = {'symbol': symbol, 'adjust': '1' if adjust else '0'}
        if start_date: params['start_date'] = start_date
        if end_date: params['end_date'] = end_date
        url = f"{self.finpy_service_url}/api/stock-history"
        url += '?' + urlencode(params)
        cache_key = f"stock:{market}:{symbol}:{adjust}:{start_date or ''}:{end_date or ''}"
        cached = await self.cache_service.get(cache_key)
        if cached:
            return cached

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.get(url)
            if response.status_code == 404:
                raise ValueError(f"No data found for {symbol}")
            response.raise_for_status()
            data = response.json().get('candles', [])
            if not data:
                raise ValueError(f"No data found for {symbol}")
            # finpy-tse returns newest first — reverse to chronological (oldest first)
            if data and len(data) > 1:
                def _date_num(d: str) -> int:
                    return int(''.join(filter(str.isdigit, d or '')))
                if _date_num(data[0].get('date', '')) > _date_num(data[-1].get('date', '')):
                    data.reverse()
            await self.cache_service.set(cache_key, data, ttl=300)
            return data
        except Exception as e:
            LOGGER.error(f"Error fetching TSE history for {symbol}: {e}")
            raise

    async def _get_yfinance_history(self, symbol: str, start_date: Optional[str],
                                    end_date: Optional[str], limit: int) -> List[Dict[str, Any]]:
        try:
            import yfinance as yf
            if not self._yfinance_loaded:
                self.yfinance = yf
                self._yfinance_loaded = True
            start = start_date or (datetime.now(timezone.utc).date().strftime('%Y-%m-%d'))
            end = end_date or (datetime.now(timezone.utc).date().strftime('%Y-%m-%d'))
            if end <= start:
                end = (datetime.now(timezone.utc).date() + __import__('datetime').timedelta(days=1)).strftime('%Y-%m-%d')
            ticker = self.yfinance.Ticker(symbol)
            hist = ticker.history(start=start, end=end, period=None, interval='1d', auto_adjust=False)
            if hist.empty:
                raise ValueError(f"No data found for {symbol}")
            rows = []
            for index, row in hist.iterrows():
                rows.append({
                    'date': index.strftime('%Y-%m-%d'),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume']),
                    'source': 'yahoo-finance',
                })
            return rows[-limit:]
        except Exception as e:
            LOGGER.error(f"Error fetching YFinance history for {symbol}: {e}")
            raise

    async def get_stock_quote(self, symbol: str) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(f"{self.finpy_service_url}/api/stock-quote", params={'symbol': symbol})
            if response.status_code == 404:
                raise ValueError(f"No quote found for {symbol}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            raise

    async def search_stocks(self, query: Optional[str] = None, market: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            params = {'query': query or ''}
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.finpy_service_url}/api/symbols-search", params=params)
            if response.status_code == 400:
                return []
            response.raise_for_status()
            data = response.json().get('results', [])
            if market:
                data = [item for item in data if item.get('market') == market]
            return data
        except Exception as e:
            LOGGER.error(f"Error searching stocks: {e}")
            return []

    async def get_index_history(self, code: str, start_date: Optional[str], end_date: Optional[str], limit: int) -> List[Dict[str, Any]]:
        params = {'key': code}
        if start_date: params['start_date'] = start_date
        if end_date: params['end_date'] = end_date
        url = f"{self.finpy_service_url}/api/index-history"
        url += '?' + urlencode(params)
        cache_key = f"index:{code}:{start_date or ''}:{end_date or ''}"
        cached = await self.cache_service.get(cache_key)
        if cached:
            return cached
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.get(url)
            if response.status_code == 404:
                raise ValueError(f"No data found for index {code}")
            response.raise_for_status()
            data = response.json().get('candles', [])
            if not data:
                raise ValueError(f"No data found for index {code}")
            await self.cache_service.set(cache_key, data, ttl=300)
            return data
        except Exception as e:
            LOGGER.error(f"Error fetching index history for {code}: {e}")
            raise

    async def list_indices(self, market: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(f"{self.finpy_service_url}/api/index-list")
            if response.status_code != 200:
                return []
            return response.json().get('indices', [])
        except Exception as e:
            LOGGER.error(f"Error listing indices: {e}")
            return []

    async def list_sectors(self) -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(f"{self.finpy_service_url}/api/sector-list")
            if response.status_code != 200:
                return []
            data = response.json().get('sectors', [])
            return [{'name': name, 'web_id': None} for name in data]
        except Exception as e:
            LOGGER.error(f"Error listing sectors: {e}")
            return []

    async def get_forex_rate(self, pair: str) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(f"{self.tgju_api_url}/v1/market/price/{pair.lower()}", timeout=20)
            if response.status_code == 404:
                raise ValueError(f"No rate found for {pair}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            LOGGER.error(f"Error fetching forex rate for {pair}: {e}")
            raise

    async def list_forex(self) -> List[Dict[str, Any]]:
        pairs = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'TRY', 'AED', 'QAR', 'IQR']
        results = []
        for pair in pairs:
            try:
                results.append(await self.get_forex_rate(pair))
            except Exception as e:
                LOGGER.warning(f"Failed to fetch rate for {pair}: {e}")
        return results

    async def get_crypto_price(self, symbol: str) -> Dict[str, Any]:
        try:
            import yfinance as yf
            ticker = yf.Ticker(f"{symbol.upper()}-USD")
            info = ticker.info
            price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('last_price')
            if price is None:
                hist = ticker.history(period='1d')
                price = float(hist['Close'].iloc[-1]) if not hist.empty else None
            if price is None:
                raise ValueError(f"No price found for {symbol}")
            return {
                'symbol': symbol.upper(),
                'name': info.get('longName', symbol),
                'price': float(price),
                'currency': 'USD',
                'change': info.get('regularMarketChange'),
                'change_pct': info.get('regularMarketChangePercent'),
                'source': 'yahoo-finance',
                'timestamp': datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            raise

    async def list_crypto(self) -> List[Dict[str, Any]]:
        symbols = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'TRX', 'DOT', 'LINK', 'LTC', 'BCH', 'MATIC', 'XLM', 'ATOM', 'UNI']
        results = []
        for symbol in symbols:
            try:
                results.append(await self.get_crypto_price(symbol))
            except Exception as e:
                LOGGER.warning(f"Failed to fetch crypto price for {symbol}: {e}")
        return results

    async def list_commodities(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        commodities = [
            {'symbol': 'XAUUSD', 'name': 'انس جهانی طلا'},
            {'symbol': 'XAGUSD', 'name': 'انس جهانی نقره'},
            {'symbol': 'CL=F', 'name': 'نفت دبلیوتی‌آی'},
            {'symbol': 'BZ=F', 'name': 'نفت برنت'},
            {'symbol': 'NG=F', 'name': 'گاز طبیعی'},
        ]
        results = []
        for commodity in commodities:
            try:
                import yfinance as yf
                ticker = yf.Ticker(commodity['symbol'])
                hist = ticker.history(period='5d')
                if hist.empty:
                    raise ValueError('No data')
                close = float(hist['Close'].iloc[-1])
                results.append({
                    **commodity,
                    'price': close,
                    'change': float(hist['Close'].iloc[-1] - hist['Close'].iloc[-2]) if len(hist) > 1 else 0,
                    'change_pct': float((hist['Close'].iloc[-1] / hist['Close'].iloc[-2] - 1) * 100) if len(hist) > 1 else 0,
                    'source': 'yahoo-finance',
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                })
            except Exception as e:
                LOGGER.warning(f"Failed to fetch commodity {commodity['symbol']}: {e}")
        return results

    async def get_dashboard_overview(self) -> Dict[str, Any]:
        overview = {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'tse': {'status': 'available', 'source': 'finpy-tse'},
            'international': {'status': 'available', 'source': 'yahoo-finance'},
            'forex_gold': {'status': 'available', 'source': 'tgju-api'},
            'crypto': {'status': 'available', 'source': 'yahoo-finance'},
        }
        return overview

    async def get_market_summary(self) -> Dict[str, Any]:
        tse = {'status': 'ok', 'source': 'finpy-tse'}
        yf = {'status': 'ok', 'source': 'yahoo-finance'}
        tgju = {'status': 'ok', 'source': 'tgju-api'}
        return {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'tse': tse,
            'international': yf,
            'forex_gold': tgju,
            'crypto': {'status': 'ok', 'source': 'yahoo-finance'},
        }
