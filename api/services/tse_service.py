import os
import time
import json
import logging
import sqlite3
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from pathlib import Path
import subprocess
import hashlib

from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

DB_PATH = os.environ.get('DB_PATH', './db/custom.db')

# TSE indices with web IDs from finpy-tse
TSE_INDICES = {
    'CWI': '32097828799138957',
    'EWI': '67130298613737946',
    'CWPI': '5798407779416661',
    'EWPI': '8384385859414435',
    'FFI': '49579049405614711',
    'MKT1I': '62752761908615603',
    'MKT2I': '71704845530629737',
    'INDI': '43754960038275285',
    'ACT50': '46342955726788357',
    'LCI30': '10523825119011581',
}

# Sector web IDs
SECTOR_INDICES = {
    'زراعت': '34408080767216529',
    'ذغال سنگ': '19219679288446732',
    'کانی فلزی': '13235969998952202',
    'سایر معادن': '62691002126902464',
    'منسوجات': '59288237226302898',
    'محصولات چرمی': '69306841376553334',
    'محصولات چوبی': '58440550086834602',
    'محصولات کاغذی': '30106839080444358',
    'انتشار و چاپ': '25766336681098389',
    'فرآورده های نفتی': '12331083953323969',
    'لاستیک': '36469751685735891',
    'فلزات اساسی': '32453344048876642',
    'محصولات فلزی': '1123534346391630',
    'ماشین آلات': '11451389074113298',
    'دستگاه های برقی': '33878047680249697',
    'وسایل ارتباطی': '24733701189547084',
    'خودرو': '20213770409093165',
    'قند و شکر': '21948907150049163',
    'چند رشته ای': '40355846462826897',
    'تامین آب، برق و گاز': '54843635503648458',
    'غذایی': '15508900928481581',
    'دارویی': '3615666621538524',
    'شیمیایی': '33626672012415176',
    'خرده فروشی': '65986638607018835',
    'کاشی و سرامیک': '57616105980228781',
    'سیمان': '70077233737515808',
    'کانی غیر فلزی': '14651627750314021',
    'سرمایه گذاری': '34295935482222451',
    'بانک': '72002976013856737',
    'سایر مالی': '25163959460949732',
    'حمل و نقل': '24187097921483699',
    'رادیویی': '41867092385281437',
    'مالی': '61247168213690670',
    'اداره بازارهای مالی': '61985386521682984',
    'انبوه سازی': '4654922806626448',
    'رایانه': '8900726085939949',
    'اطلاعات و ارتباطات': '18780171241610744',
    'فنی مهندسی': '47233872677452574',
    'استخراج نفت': '65675836323214668',
    'بیمه و بازنشستگی': '59105676994811497',
}


@dataclass
class Candle:
    date: str
    open_price: float
    high: float
    low: float
    close: float
    volume: float = 0
    j_date: Optional[str] = None


class TSEService:
    """Service for fetching TSE (Tehran Stock Exchange) data via finpy-tse."""

    def __init__(self):
        self.base_url = "https://cdn.tsetmc.com/api"
        self.cache_dir = Path("./db/cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._db_connection = None

    @property
    def db(self):
        if self._db_connection is None:
            self._db_connection = sqlite3.connect(DB_PATH, timeout=30)
            self._db_connection.row_factory = sqlite3.Row
        return self._db_connection

    def _get_cache_path(self, key: str) -> Path:
        safe_key = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"{safe_key}.json"

    def _load_from_cache(self, key: str, max_age_seconds: int = 900) -> Optional[List[Candle]]:
        cache_path = self._get_cache_path(key)
        if not cache_path.exists():
            return None
        
        try:
            with open(cache_path, 'r') as f:
                data = json.load(f)
            
            cached_time = data.get('cached_at', 0)
            if time.time() - cached_time > max_age_seconds:
                return None
            
            candles = [Candle(**c) for c in data.get('candles', [])]
            return candles
        except Exception as e:
            logger.warning(f"Cache load failed for {key}: {e}")
            return None

    def _save_to_cache(self, key: str, candles: List[Candle]):
        cache_path = self._get_cache_path(key)
        try:
            data = {
                'cached_at': time.time(),
                'candles': [c.__dict__ for c in candles]
            }
            with open(cache_path, 'w') as f:
                json.dump(data, f, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Cache save failed for {key}: {e}")

    def _parse_b2_response(self, json_str: str) -> List[Dict]:
        """Parse B2 response from TSE."""
        try:
            data = json.loads(json_str)
            return data.get('indexB2', [])
        except json.JSONDecodeError:
            # Try to fix truncated JSON
            last_brace = json_str.rfind('}')
            if last_brace > 0:
                try:
                    fixed = json_str[:last_brace + 1]
                    data = json.loads(fixed)
                    return data.get('indexB2', [])
                except:
                    pass
            raise ValueError("Invalid JSON response from TSE")

    def _entries_to_candles(self, entries: List[Dict]) -> List[Candle]:
        """Convert B2 entries to Candle objects."""
        candles = []
        for i, entry in enumerate(entries):
            close = entry.get('xNivInuClMresIbs', 0)
            if close <= 0:
                continue
            
            deven = str(entry.get('dEven', ''))
            if len(deven) != 8:
                continue
            
            date_str = f"{deven[:4]}-{deven[4:6]}-{deven[6:8]}"
            
            first = entry.get('xNivInuPhMresIbs', 0)
            prev_close = entry.get('xNivInuPbMresIbs', 0)
            open_price = first if first > 0 else prev_close
            
            high = max(open_price, close)
            low = min(open_price, close)
            
            candles.append(Candle(
                date=date_str,
                open_price=round(open_price, 2),
                high=round(high, 2),
                low=round(low, 2),
                close=round(close, 2),
                volume=0,
            ))
        
        candles.sort(key=lambda c: c.date)
        return candles

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def fetch_index_history(self, index_code: str, limit: int = 100) -> List[Candle]:
        """Fetch index history with retry logic."""
        # Check cache first
        cache_key = f"index:{index_code}:{limit}"
        cached = self._load_from_cache(cache_key)
        if cached:
            return cached[-limit:] if len(cached) > limit else cached
        
        # Get web ID
        web_id = TSE_INDICES.get(index_code)
        if not web_id:
            raise ValueError(f"Unknown index code: {index_code}")
        
        # Fetch from CDN
        url = f"{self.base_url}/Index/GetIndexB2History/{web_id}"
        try:
            result = subprocess.run(
                ['curl', '-s', '-m', '120', url],
                capture_output=True, text=True, timeout=130
            )
            if result.returncode != 0:
                raise ConnectionError(f"Failed to fetch from {url}")
            
            entries = self._parse_b2_response(result.stdout)
            candles = self._entries_to_candles(entries)
            
            if not candles:
                raise ValueError(f"No candles found for {index_code}")
            
            # Cache results
            self._save_to_cache(cache_key, candles)
            
            return candles[-limit:] if len(candles) > limit else candles
            
        except Exception as e:
            logger.error(f"Error fetching index {index_code}: {e}")
            raise

    def fetch_sector_history(self, sector_name: str, limit: int = 100) -> List[Candle]:
        """Fetch sector history."""
        web_id = SECTOR_INDICES.get(sector_name)
        if not web_id:
            raise ValueError(f"Unknown sector: {sector_name}")
        
        # Similar to index history but using sector web ID
        url = f"{self.base_url}/Index/GetIndexB2History/{web_id}"
        try:
            result = subprocess.run(
                ['curl', '-s', '-m', '120', url],
                capture_output=True, text=True, timeout=130
            )
            if result.returncode != 0:
                raise ConnectionError(f"Failed to fetch sector {sector_name}")
            
            entries = self._parse_b2_response(result.stdout)
            candles = self._entries_to_candles(entries)
            
            return candles[-limit:] if len(candles) > limit else candles
            
        except Exception as e:
            logger.error(f"Error fetching sector {sector_name}: {e}")
            raise

    def get_latest_prices(self, symbols: List[str]) -> Dict[str, float]:
        """Get latest prices for a list of symbols."""
        prices = {}
        for symbol in symbols:
            try:
                candles = self.fetch_index_history(symbol, limit=1)
                if candles:
                    prices[symbol] = candles[-1].close
            except Exception as e:
                logger.warning(f"Failed to get latest price for {symbol}: {e}")
                prices[symbol] = None
        return prices

    def get_all_indices(self) -> List[Dict[str, Any]]:
        """Get all available TSE indices."""
        indices = []
        for code, web_id in TSE_INDICES.items():
            indices.append({
                'code': code,
                'name': code,
                'web_id': web_id,
                'type': 'main'
            })
        return indices

    def get_all_sectors(self) -> List[Dict[str, Any]]:
        """Get all available sectors."""
        sectors = []
        for name, web_id in SECTOR_INDICES.items():
            sectors.append({
                'name': name,
                'web_id': web_id,
                'type': 'sector'
            })
        return sectors


class TGJUService:
    """Service for fetching gold, forex, and commodity data from TGJU."""

    def __init__(self):
        self.base_url = os.environ.get('TGJU_API_URL', 'https://tgju.amirhossein.info')
        self.api_url = 'https://api.tgju.org/v1/market/indicator/summary-table-data'

    async def get_gold_price(self, gold_type: str = 'au24') -> Dict[str, Any]:
        """Get gold price by type (au24, au18, silver, etc.)."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.api_url}/{gold_type}")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error fetching gold price for {gold_type}: {e}")
            raise

    async def get_forex_rate(self, pair: str) -> Dict[str, Any]:
        """Get forex rate for a currency pair."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.api_url}/{pair.lower()}")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error fetching forex rate for {pair}: {e}")
            raise

    async def get_commodity_price(self, commodity: str) -> Dict[str, Any]:
        """Get commodity price."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.api_url}/{commodity.lower()}")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error fetching commodity price for {commodity}: {e}")
            raise

    async def get_all_prices(self) -> Dict[str, Any]:
        """Get all available prices (gold, forex, commodities)."""
        results = {
            'gold': {},
            'forex': {},
            'commodities': {},
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # Gold prices
        gold_types = ['au24', 'au18', 'au14', 'silver', 'platinum', 'palladium']
        for gold_type in gold_types:
            try:
                price = await self.get_gold_price(gold_type)
                results['gold'][gold_type] = price
            except Exception as e:
                logger.warning(f"Failed to fetch gold {gold_type}: {e}")
        
        # Forex pairs
        forex_pairs = ['usd', 'eur', 'gbp', 'jpy', 'chf', 'cad', 'aud', 'cny', 'try', 'aed']
        for pair in forex_pairs:
            try:
                rate = await self.get_forex_rate(pair)
                results['forex'][pair] = rate
            except Exception as e:
                logger.warning(f"Failed to fetch forex {pair}: {e}")
        
        # Commodities
        commodities = ['crude-oil', 'natural-gas', 'copper', 'wheat', 'corn', 'soybean']
        for commodity in commodities:
            try:
                price = await self.get_commodity_price(commodity)
                results['commodities'][commodity] = price
            except Exception as e:
                logger.warning(f"Failed to fetch commodity {commodity}: {e}")
        
        return results


class OllamaService:
    """Service for local Ollama LLM integration."""

    def __init__(self):
        self.base_url = os.environ.get('OLLAMA_BASE_URL', 'http://localhost:11434')
        self.default_model = os.environ.get('OLLAMA_MODEL', 'gpt-oss:20b')
        self.available_models = []

    async def check_health(self) -> Dict[str, Any]:
        """Check if Ollama server is running."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    self.available_models = [m.get('name') for m in data.get('models', [])]
                    return {
                        'status': 'ok',
                        'models': self.available_models,
                        'default_model': self.default_model
                    }
                return {'status': 'error', 'message': f'HTTP {response.status_code}'}
        except Exception as e:
            return {'status': 'error', 'message': str(e)}

    async def chat_completion(self, messages: List[Dict[str, str]],
                               model: Optional[str] = None,
                               temperature: float = 0.7,
                               max_tokens: int = 4096) -> str:
        """Send a chat completion request to Ollama."""
        model = model or self.default_model
        
        # Check if model is available
        if model not in self.available_models:
            logger.warning(f"Model {model} not in available models, using default")
            model = self.default_model
        
        try:
            import httpx
            payload = {
                'model': model,
                'messages': messages,
                'temperature': temperature,
                'num_predict': max_tokens,
                'stream': False
            }
            
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload
                )
                response.raise_for_status()
                
                data = response.json()
                return data.get('message', {}).get('content', '')
                
        except Exception as e:
            logger.error(f"Ollama chat completion failed: {e}")
            raise

    async def analyze_market(self, symbol: str, data: Dict[str, Any],
                              analysis_type: str = "technical") -> Dict[str, Any]:
        """Analyze market data using Ollama."""
        prompt = self._build_analysis_prompt(symbol, data, analysis_type)
        
        messages = [
            {
                'role': 'system',
                'content': 'You are an expert financial analyst specializing in Iranian stock market (TSE, Farabourse) and international markets. Provide technical analysis with specific recommendations.'
            },
            {
                'role': 'user',
                'content': prompt
            }
        ]
        
        try:
            response = await self.chat_completion(messages, temperature=0.3)
            return {
                'analysis': response,
                'type': analysis_type,
                'model': self.default_model,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            logger.error(f"Market analysis failed for {symbol}: {e}")
            raise

    def _build_analysis_prompt(self, symbol: str, data: Dict[str, Any],
                               analysis_type: str) -> str:
        """Build analysis prompt based on type."""
        if analysis_type == "technical":
            return f"""Analyze the technical indicators for {symbol}:
Current Price: {data.get('price', 'N/A')}
RSI: {data.get('rsi', 'N/A')}
MACD: {data.get('macd', 'N/A')}
Bollinger Bands: {data.get('bollinger_bands', 'N/A')}
Volume: {data.get('volume', 'N/A')}
Trend: {data.get('trend', 'N/A')}

Provide:
1. Short-term trend prediction (1-5 sessions)
2. Key support and resistance levels
3. Trading recommendation (Buy/Hold/Sell) with reasoning
4. Risk level assessment
5. Expected price target"""
        
        elif analysis_type == "fundamental":
            return f"""Analyze the fundamental indicators for {symbol}:
P/E Ratio: {data.get('pe_ratio', 'N/A')}
ROE: {data.get('roe', 'N/A')}
Debt/Equity: {data.get('debt_to_equity', 'N/A')}
Revenue Growth: {data.get('revenue_growth', 'N/A')}
Profit Margin: {data.get('profit_margin', 'N/A')}
Analyst Recommendation: {data.get('analyst_recommendation', 'N/A')}

Provide:
1. Valuation assessment
2. Financial health analysis
3. Growth prospects
4. Investment recommendation (Buy/Hold/Sell)
5. Target price range"""
        
        else:  # sentiment
            return f"""Analyze the market sentiment for {symbol}:
News Sentiment: {data.get('news_sentiment', 'N/A')}
Social Sentiment: {data.get('social_sentiment', 'N/A')}
Fear & Greed Index: {data.get('fear_greed_index', 'N/A')}
Analyst Coverage: {data.get('analyst_coverage', 'N/A')}
Market Hype: {data.get('market_hype', 'N/A')}

Provide:
1. Overall sentiment assessment
2. Market mood analysis
3. Risk factors
4. Trading sentiment (Bullish/Bearish/Neutral)
5. Key events to watch"""
