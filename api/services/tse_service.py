import os
import time
import json
import logging
import sqlite3
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from pathlib import Path
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
    'فرآورده های نفت': '12331083953323969',
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
            req = urllib.request.Request(url, headers={'User-Agent': 'TechnicalAI/1.0'})
            with urllib.request.urlopen(req, timeout=120) as response:
                if response.status != 200:
                    raise ConnectionError(f"Failed to fetch from {url}: HTTP {response.status}")
                
                result_stdout = response.read().decode('utf-8')
                entries = self._parse_b2_response(result_stdout)
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
            req = urllib.request.Request(url, headers={'User-Agent': 'TechnicalAI/1.0'})
            with urllib.request.urlopen(req, timeout=120) as response:
                if response.status != 200:
                    raise ConnectionError(f"Failed to fetch sector {sector_name}: HTTP {response.status}")
                
                result_stdout = response.read().decode('utf-8')
                entries = self._parse_b2_response(result_stdout)
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

    def get_tse_indices(self) -> Dict[str, str]:
        """Get TSE indices mapping."""
        return dict(TSE_INDICES)

    def get_sector_indices(self) -> Dict[str, str]:
        """Get sector indices mapping."""
        return dict(SECTOR_INDICES)