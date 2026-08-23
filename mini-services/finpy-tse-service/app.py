# ═══════════════════════════════════════════════════════════════════
# TSETMC Index & Stock Data Service (finpy-tse data source)
#
# Uses z-ai CLI page_reader to fetch from TSETMC CDN B2 API:
#   cdn.tsetmc.com/api/Index/GetIndexB2History/{web_id}
#
# Uses finpy-tse library (via ThreadPoolExecutor) for stock price
# history and symbol search (with timeout to avoid blocking).
#
# Sector names and web IDs sourced from finpy-tse library source code
# (github.com/ARahimiQuant/finpy-tse)
# ═══════════════════════════════════════════════════════════════════

import json
import os
import re
import subprocess
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


PORT = int(os.environ.get('PORT', '3031'))
FILE_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'db')
CACHE_TTL = 24 * 60 * 60  # 24 hours

# ── Jalali conversion (using jdatetime library from finpy-tse) ──
import jdatetime

def gregorian_to_jalali(gy, gm, gd):
    """Convert Gregorian to Jalali date string using jdatetime."""
    try:
        jdate = jdatetime.date.fromgregorian(year=gy, month=gm, day=gd)
        return f"{jdate.year}/{str(jdate.month).zfill(2)}/{str(jdate.day).zfill(2)}"
    except:
        return f"{gy}/{str(gm).zfill(2)}/{str(gd).zfill(2)}"


# ── z-ai CLI page_reader wrapper ─────────────────────────────────
def zai_page_reader(url: str, timeout: int = 120) -> str:
    """Fetch URL content using z-ai CLI page_reader. Retries up to 3 times."""
    tmp = f'/tmp/zai_{hash(url) % 100000}_{int(time.time())}.json'
    last_error = None
    for attempt in range(3):
        try:
            result = subprocess.run(
                ['z-ai', 'function', '-n', 'page_reader',
                 '-a', json.dumps({'url': url}),
                 '-o', tmp],
                capture_output=True, text=True, timeout=timeout
            )
            if result.returncode != 0:
                last_error = f"z-ai CLI failed (exit {result.returncode}): {result.stderr[:300]}"
                print(f'[z-ai] Attempt {attempt+1} failed: {last_error[:100]}', flush=True)
                time.sleep(3 * (attempt + 1))  # Backoff: 3s, 6s, 9s
                continue
            with open(tmp) as f:
                data = json.load(f)
            html = data.get('data', {}).get('html', '')
            if not html:
                last_error = 'Empty response from page_reader'
                print(f'[z-ai] Attempt {attempt+1}: empty response', flush=True)
                time.sleep(3 * (attempt + 1))
                continue
            return html
        except subprocess.TimeoutExpired:
            last_error = f'z-ai CLI timed out after {timeout}s'
            print(f'[z-ai] Attempt {attempt+1}: {last_error}', flush=True)
            time.sleep(3)
        except Exception as e:
            last_error = str(e)
            print(f'[z-ai] Attempt {attempt+1} error: {last_error[:100]}', flush=True)
            time.sleep(3)
        finally:
            if os.path.exists(tmp):
                try:
                    os.unlink(tmp)
                except:
                    pass
            # New temp file for next attempt
            tmp = f'/tmp/zai_{hash(url) % 100000}_{int(time.time())}.json'
    raise RuntimeError(f'z-ai page_reader failed after 3 attempts: {last_error}')


# ── TSETMC B2 API fetcher ────────────────────────────────────────
def fetch_b2_data(web_id: str, timeout: int = 120) -> list:
    """Fetch index B2 history from TSETMC CDN via z-ai CLI."""
    url = f'http://cdn.tsetmc.com/api/Index/GetIndexB2History/{web_id}'
    html = zai_page_reader(url, timeout)

    # Extract JSON from <pre> tag
    pre = re.search(r'<pre[^>]*>([\s\S]*?)</pre>', html, re.IGNORECASE)
    json_str = pre.group(1) if pre else re.sub(r'<[^>]+>', '', html).strip()

    # Unescape HTML entities
    json_str = json_str.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')

    # Try direct parse first (full JSON: {"indexB2":[...]}
    try:
        data = json.loads(json_str)
        return data.get('indexB2', [])
    except json.JSONDecodeError:
        pass

    # Fallback: handle truncated JSON — find last complete object
    last_brace = json_str.rfind('}')
    if last_brace > 0:
        # Try to find the complete outer object: {"indexB2":[...]}
        for end_pos in range(last_brace, max(last_brace - 10, 0), -1):
            try:
                candidate = json_str[:end_pos + 1]
                data = json.loads(candidate)
                items = data.get('indexB2', [])
                if items:
                    return items
            except json.JSONDecodeError:
                continue

    raise RuntimeError(f'Failed to parse B2 JSON ({len(json_str)} chars)')


def b2_to_candles(b2_items: list) -> list:
    """Convert B2 items to candle list."""
    candles = []
    for item in b2_items:
        close = item.get('xNivInuClMresIbs', 0)
        if close <= 0:
            continue
        deven = str(item.get('dEven', 0))
        if len(deven) < 8:
            continue
        date_str = gregorian_to_jalali(int(deven[:4]), int(deven[4:6]), int(deven[6:8]))
        first = item.get('xNivInuPhMresIbs', 0)
        prev = item.get('xNivInuPbMresIbs', 0)
        open_price = first if first > 0 else prev
        candles.append({
            'date': date_str,
            'open': round(open_price, 1),
            'high': round(max(open_price, close), 1),
            'low': round(min(open_price, close), 1),
            'close': round(close, 1),
            'volume': 0,
        })
    candles.sort(key=lambda x: x['date'])
    return candles


# ── File cache ───────────────────────────────────────────────────
def file_cache_path(key: str) -> str:
    """Generate cache file path from key. Uses key prefix for filename prefix."""
    safe = re.sub(r'[^a-zA-Z0-9\u0600-\u06FF_-]', '_', key)
    # Determine file prefix from key: stock_xxx → stock-, idx_xxx → index-, etc.
    prefix = 'index'
    for p in ('stock', 'symbols', 'sec', 'idx'):
        if key.startswith(p + '_'):
            prefix = p
            break
    return os.path.join(FILE_CACHE_DIR, f'{prefix}-{safe}.json')


def load_file_cache(key: str) -> list | None:
    path = file_cache_path(key)
    if not os.path.exists(path):
        return None
    try:
        with open(path) as f:
            entry = json.load(f)
        if time.time() * 1000 - entry.get('time', 0) > CACHE_TTL * 1000:
            return None
        return entry.get('data', [])
    except:
        return None


def save_file_cache(key: str, data):
    try:
        os.makedirs(FILE_CACHE_DIR, exist_ok=True)
        with open(file_cache_path(key), 'w') as f:
            json.dump({'data': data, 'time': int(time.time() * 1000)}, f, ensure_ascii=False)
    except Exception:
        pass


# ── finpy-tse stock data helpers ─────────────────────────────────
def _fetch_price_history(symbol: str, adjust: bool) -> list:
    """Run finpy_tse.Get_Price_History in a thread-safe function.
    Returns list of candle dicts on success, or raises on failure."""
    import finpy_tse

    df = finpy_tse.Get_Price_History(
        stock=symbol,
        ignore_date=True,
        adjust_price=adjust,
        show_weekday=False,
        double_date=False,
    )
    if df is None or (hasattr(df, 'empty') and df.empty):
        raise RuntimeError(f'No data returned for symbol "{symbol}"')

    # Reset index to get J-Date as a column
    df = df.reset_index()
    # J-Date is the former index, named 'J-Date' or the first column
    date_col = 'J-Date' if 'J-Date' in df.columns else df.columns[0]

    # When adjust_price=True, use Adj columns; otherwise use raw columns
    if adjust and 'Adj Close' in df.columns:
        open_col, high_col, low_col, close_col = 'Adj Open', 'Adj High', 'Adj Low', 'Adj Close'
    else:
        open_col, high_col, low_col, close_col = 'Open', 'High', 'Low', 'Close'

    candles = []
    for _, row in df.iterrows():
        # Convert date from 1404-01-15 to 1404/01/15
        raw_date = str(row[date_col])
        date_str = raw_date.replace('-', '/')
        try:
            candles.append({
                'date': date_str,
                'open': int(row[open_col]),
                'high': int(row[high_col]),
                'low': int(row[low_col]),
                'close': int(row[close_col]),
                'volume': int(row['Volume']),
            })
        except (ValueError, TypeError, KeyError):
            # Skip rows with bad data
            continue

    # Sort by date ascending
    candles.sort(key=lambda x: x['date'])
    return candles


def _fetch_stock_list() -> list:
    """Run finpy_tse.Build_Market_StockList in a thread-safe function.
    Returns list of {ticker, name, market} dicts."""
    import finpy_tse

    df = finpy_tse.Build_Market_StockList(
        bourse=True,
        farabourse=True,
        payeh=True,
        detailed_list=False,
        show_progress=False,
        save_excel=False,
        save_csv=False,
    )
    if df is None or (hasattr(df, 'empty') and df.empty):
        raise RuntimeError('No stock list returned')

    result = []
    for _, row in df.iterrows():
        result.append({
            'ticker': str(row.get('Ticker', '')),
            'name': str(row.get('Name', '')),
            'market': str(row.get('Market', '')),
        })
    return result


# ═══════════════════════════════════════════════════════════════════
# Index definitions — sourced from finpy-tse library source code
# ═══════════════════════════════════════════════════════════════════

# Main market indices: finpy-tse function name → web ID
MAIN_INDEX_IDS = {
    'CWI':   '32097828799138957',  # شاخص کل
    'EWI':   '67130298613737946',  # شاخص کل هم‌وزن
    'CWPI':  '5798407779416661',   # شاخص قیمت وزنی-ارزشی
    'EWPI':  '8384385859414435',   # شاخص قیمت هم‌وزن
    'FFI':   '49579049405614711',  # شاخص سهام آزاد شناور
    'MKT1I': '62752761908615603',  # شاخص بازار اول
    'MKT2I': '71704845530629737',  # شاخص بازار دوم
    'INDI':  '43754960038275285',  # شاخص صنعت
    'ACT50': '46342955726788357',  # شاخص ۵۰ شرکت فعال‌تر
    'LCI30': '10523825119011581',  # شاخص ۳۰ شرکت بزرگ
}

# Sector indices: finpy-tse sector name → web ID
# Exact names from finpy-tse __Get_TSE_Sector_WebID__ function
SECTOR_WEB_IDS = {
    'زراعت':              '34408080767216529',
    'ذغال سنگ':            '19219679288446732',
    'کانی فلزی':           '13235969998952202',
    'سایر معادن':          '62691002126902464',
    'منسوجات':             '59288237226302898',
    'محصولات چرمی':        '69306841376553334',
    'محصولات چوبی':        '58440550086834602',
    'محصولات کاغذی':       '30106839080444358',
    'انتشار و چاپ':        '25766336681098389',
    'فرآورده های نفتی':    '12331083953323969',
    'لاستیک':              '36469751685735891',
    'فلزات اساسی':         '32453344048876642',
    'محصولات فلزی':        '1123534346391630',
    'ماشین آلات':          '11451389074113298',
    'دستگاه های برقی':    '33878047680249697',
    'وسایل ارتباطی':       '24733701189547084',
    'خودرو':               '20213770409093165',
    'قند و شکر':           '21948907150049163',
    'چند رشته ای':         '40355846462826897',
    'تامین آب، برق و گاز': '54843635503648458',
    'غذایی':               '15508900928481581',
    'دارویی':              '3615666621538524',
    'شیمیایی':             '33626672012415176',
    'خرده فروشی':          '65986638607018835',
    'کاشی و سرامیک':       '57616105980228781',
    'سیمان':               '70077233737515808',
    'کانی غیر فلزی':      '14651627750314021',
    'سرمایه گذاری':        '34295935482222451',
    'بانک':                '72002976013856737',
    'سایر مالی':           '25163959460949732',
    'حمل و نقل':           '24187097921483699',
    'رادیویی':             '41867092385281437',
    'مالی':                '61247168213690670',
    'اداره بازارهای مالی':  '61985386521682984',
    'انبوه سازی':          '4654922806626448',
    'رایانه':              '8900726085939949',
    'اطلاعات و ارتباطات':  '18780171241610744',
    'فنی مهندسی':          '47233872677452574',
    'استخراج نفت':         '65675836323214668',
    'بیمه و بازنشستگی':    '59105676994811497',
}

# Aliases: common Persian names → finpy-tse sector name
SECTOR_ALIASES = {
    'مواد دارویی': 'دارویی',
    'دارویی': 'دارویی',
    'فرآورده‌های نفتی': 'فرآورده های نفتی',
    'فرآورده نفتی': 'فرآورده های نفتی',
    'سرمایه‌گذاریها': 'سرمایه گذاری',
    'سرمایه‌گذاری': 'سرمایه گذاری',
    'بانکها': 'بانک',
    'بانک‌ها': 'بانک',
    'انبوه‌سازی': 'انبوه سازی',
    'تامین آب برق گاز': 'تامین آب، برق و گاز',
    'تأمین آب، برق و گاز': 'تامین آب، برق و گاز',
    'چندرشته‌ای': 'چند رشته ای',
    'کانی غیرفلزی': 'کانی غیر فلزی',
    'محصولات چرمی': 'محصولات چرمی',
    'دستگاه‌های برقی': 'دستگاه های برقی',
    'ماشین‌آلات': 'ماشین آلات',
    'خرده‌فروشی': 'خرده فروشی',
}


def resolve_sector_name(name: str) -> str | None:
    """Resolve sector name to finpy-tse sector name."""
    if name in SECTOR_WEB_IDS:
        return name
    if name in SECTOR_ALIASES:
        return SECTOR_ALIASES[name]
    # Try partial match
    for key in SECTOR_WEB_IDS:
        if name in key or key in name:
            return key
    return None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Suppress default HTTP logging
        pass

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        try:
            if path == '/health':
                return self._send_json({
                    'status': 'ok',
                    'service': 'finpy-tse-index-service',
                    'main_indices': len(MAIN_INDEX_IDS),
                    'sectors': len(SECTOR_WEB_IDS),
                    'stock_history': True,
                    'symbols_search': True,
                })

            elif path == '/api/index-history':
                return self._handle_index_history(params)

            elif path == '/api/sector-history':
                return self._handle_sector_history(params)

            elif path == '/api/sector-list':
                return self._send_json({
                    'sectors': list(SECTOR_WEB_IDS.keys()),
                    'main_indices': list(MAIN_INDEX_IDS.keys()),
                })

            elif path == '/api/stock-history':
                return self._handle_stock_history(params)

            elif path == '/api/symbols-search':
                return self._handle_symbols_search(params)

            else:
                self._send_json({'error': 'Not found'}, 404)
        except Exception as e:
            traceback.print_exc()
            self._send_json({'error': str(e)}, 500)

    # ── Stock price history ───────────────────────────────────────
    def _handle_stock_history(self, params):
        """Handle /api/stock-history?symbol=خودرو&adjust=1

        Tries finpy_tse.Get_Price_History via ThreadPoolExecutor with 30s timeout.
        If it fails/times out, returns JSON error (caller falls back to file cache).
        """
        symbol = (params.get('symbol') or [''])[0].strip()
        if not symbol:
            return self._send_json({'error': 'پارامتر symbol الزامی است', 'candles': []}, 400)

        adjust_str = (params.get('adjust') or ['1'])[0].strip()
        adjust = adjust_str != '0'

        cache_key = f'stock_{symbol}_{"adj" if adjust else "raw"}'

        # Check file cache first
        cached = load_file_cache(cache_key)
        if cached:
            print(f'[stock] Cache hit: {symbol} (adjust={adjust}, {len(cached)} candles)', flush=True)
            return self._send_json({
                'symbol': symbol,
                'adjust': adjust,
                'count': len(cached),
                'source': 'cache',
                'candles': cached,
            })

        # Run finpy-tse in a thread with 30s timeout
        print(f'[stock] Fetching price history for "{symbol}" (adjust={adjust}) via finpy-tse...', flush=True)
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_fetch_price_history, symbol, adjust)
                try:
                    candles = future.result(timeout=30)
                except FuturesTimeoutError:
                    future.cancel()
                    print(f'[stock] Timeout after 30s for "{symbol}"', flush=True)
                    return self._send_json({
                        'error': 'finpy-tse timed out (30s) — likely CDN unreachable from sandbox',
                        'symbol': symbol,
                        'candles': [],
                    }, 504)
        except Exception as e:
            err_msg = str(e)
            print(f'[stock] Error for "{symbol}": {err_msg[:200]}', flush=True)
            return self._send_json({
                'error': err_msg,
                'symbol': symbol,
                'candles': [],
            }, 500)

        if not candles:
            return self._send_json({
                'error': f'داده‌ای برای نماد "{symbol}" یافت نشد',
                'symbol': symbol,
                'candles': [],
            }, 404)

        # Cache and return
        save_file_cache(cache_key, candles)
        print(f'[stock] Saved {len(candles)} candles for "{symbol}" (adjust={adjust})', flush=True)
        return self._send_json({
            'symbol': symbol,
            'adjust': adjust,
            'count': len(candles),
            'source': 'finpy-tse',
            'candles': candles,
        })

    # ── Symbols search ────────────────────────────────────────────
    def _handle_symbols_search(self, params):
        """Handle /api/symbols-search?query=خودرو

        Tries finpy_tse.Build_Market_StockList via ThreadPoolExecutor with 60s timeout.
        Filters results by query against ticker and name. Caches the full list.
        """
        query = (params.get('query') or [''])[0].strip()
        if not query:
            return self._send_json({'error': 'پارامتر query الزامی است', 'results': []}, 400)

        # Normalize query for matching (remove zero-width non-joiners, extra spaces)
        query_normalized = re.sub(r'[\u200c\u200d]', '', query).strip()

        cache_key = 'symbols_all'
        cached_list = load_file_cache(cache_key)

        if cached_list is not None:
            print(f'[symbols] Cache hit for stock list ({len(cached_list)} stocks)', flush=True)
            matches = self._filter_symbols(cached_list, query, query_normalized)
            return self._send_json({
                'query': query,
                'count': len(matches),
                'results': matches,
                'source': 'cache',
            })

        # Fetch full stock list via finpy-tse with 60s timeout
        print(f'[symbols] Fetching stock list via finpy-tse...', flush=True)
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_fetch_stock_list)
                try:
                    stock_list = future.result(timeout=60)
                except FuturesTimeoutError:
                    future.cancel()
                    print(f'[symbols] Timeout after 60s for stock list', flush=True)
                    return self._send_json({
                        'error': 'finpy-tse stock list fetch timed out (60s) — likely CDN unreachable',
                        'query': query,
                        'results': [],
                    }, 504)
        except Exception as e:
            err_msg = str(e)
            print(f'[symbols] Error: {err_msg[:200]}', flush=True)
            return self._send_json({
                'error': err_msg,
                'query': query,
                'results': [],
            }, 500)

        if not stock_list:
            return self._send_json({
                'error': 'فهرست نمادها خالی است',
                'query': query,
                'results': [],
            }, 404)

        # Cache the full list
        save_file_cache(cache_key, stock_list)
        print(f'[symbols] Cached {len(stock_list)} stocks', flush=True)

        matches = self._filter_symbols(stock_list, query, query_normalized)
        return self._send_json({
            'query': query,
            'count': len(matches),
            'results': matches,
            'source': 'finpy-tse',
        })

    def _filter_symbols(self, stock_list: list, query: str, query_normalized: str) -> list:
        """Filter stock list by query, matching against ticker and name."""
        matches = []
        for stock in stock_list:
            ticker = stock.get('ticker', '')
            name = stock.get('name', '')
            # Normalize for comparison
            ticker_n = re.sub(r'[\u200c\u200d]', '', ticker).strip()
            name_n = re.sub(r'[\u200c\u200d]', '', name).strip()

            if (query in ticker or query in name or
                query_normalized in ticker_n or query_normalized in name_n):
                matches.append(stock)

        # Sort: exact ticker prefix matches first, then name matches
        def sort_key(s):
            t = s.get('ticker', '')
            n = s.get('name', '')
            exact_ticker = 0 if t == query else 1
            starts_ticker = 0 if t.startswith(query) else 1
            starts_name = 0 if n.startswith(query) else 1
            return (exact_ticker, starts_ticker, starts_name, t)

        matches.sort(key=sort_key)
        return matches[:50]  # Limit to 50 results

    # ── Index history (existing) ──────────────────────────────────
    def _handle_index_history(self, params):
        """Handle /api/index-history?key=CWI"""
        key = (params.get('key') or [''])[0].strip().upper()
        if not key or key not in MAIN_INDEX_IDS:
            return self._send_json({
                'error': f'شناسه نامعتبر. مقادیر مجاز: {", ".join(MAIN_INDEX_IDS.keys())}',
                'candles': []
            }, 400)

        cache_key = f'idx_{key}'
        cached = load_file_cache(cache_key)
        if cached:
            print(f'[index] Cache hit: {key} ({len(cached)} candles)')
            return self._send_json({'index_key': key, 'count': len(cached), 'candles': cached})

        web_id = MAIN_INDEX_IDS[key]
        print(f'[index] Fetching {key} (webId={web_id}) via z-ai page_reader...')
        try:
            b2_items = fetch_b2_data(web_id, timeout=120)
            candles = b2_to_candles(b2_items)
            if not candles:
                return self._send_json({'error': f'داده‌ای برای شاخص {key} یافت نشد', 'candles': []}, 404)
            save_file_cache(cache_key, candles)
            print(f'[index] Saved {len(candles)} candles for {key}')
            return self._send_json({'index_key': key, 'count': len(candles), 'candles': candles})
        except Exception as e:
            traceback.print_exc()
            return self._send_json({'error': str(e), 'candles': []}, 500)

    def _handle_sector_history(self, params):
        """Handle /api/sector-history?sector=دارویی or ?webId=12345"""
        # Support direct webId parameter
        web_id_param = (params.get('webId') or [''])[0].strip()
        if web_id_param:
            cache_key = f'sec_{web_id_param}'
            cached = load_file_cache(cache_key)
            if cached:
                print(f'[index] Cache hit: webId={web_id_param[:8]}... ({len(cached)} candles)')
                return self._send_json({'web_id': web_id_param, 'count': len(cached), 'candles': cached})

            print(f'[index] Fetching sector by webId={web_id_param}...')
            try:
                b2_items = fetch_b2_data(web_id_param, timeout=120)
                candles = b2_to_candles(b2_items)
                if not candles:
                    return self._send_json({'error': f'داده‌ای برای شناسه {web_id_param} یافت نشد', 'candles': []}, 404)
                save_file_cache(cache_key, candles)
                print(f'[index] Saved {len(candles)} candles for webId={web_id_param[:8]}...')
                return self._send_json({'web_id': web_id_param, 'count': len(candles), 'candles': candles})
            except Exception as e:
                traceback.print_exc()
                return self._send_json({'error': str(e), 'candles': []}, 500)

        # Support sector name parameter
        sector = (params.get('sector') or [''])[0].strip()
        if not sector:
            return self._send_json({'error': 'پارامتر sector یا webId الزامی است'}, 400)

        resolved = resolve_sector_name(sector)
        if not resolved:
            available = ', '.join(SECTOR_WEB_IDS.keys())
            return self._send_json({
                'error': f'گروه «{sector}» یافت نشد. گروه‌های موجود: {available}',
                'candles': []
            }, 404)

        cache_key = f'sec_{resolved}'
        cached = load_file_cache(cache_key)
        if cached:
            print(f'[index] Cache hit: sector={resolved} ({len(cached)} candles)')
            return self._send_json({'sector': resolved, 'count': len(cached), 'candles': cached})

        web_id = SECTOR_WEB_IDS[resolved]
        print(f'[index] Fetching sector={resolved} (webId={web_id})...')
        try:
            b2_items = fetch_b2_data(web_id, timeout=120)
            candles = b2_to_candles(b2_items)
            if not candles:
                return self._send_json({'error': f'داده‌ای برای گروه {resolved} یافت نشد', 'candles': []}, 404)
            save_file_cache(cache_key, candles)
            print(f'[index] Saved {len(candles)} candles for sector={resolved}')
            return self._send_json({'sector': resolved, 'count': len(candles), 'candles': candles})
        except Exception as e:
            traceback.print_exc()
            return self._send_json({'error': str(e), 'candles': []}, 500)


if __name__ == '__main__':
    server = ThreadedHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'═' * 60)
    print(f'TSETMC Index & Stock Service (finpy-tse data source)')
    print(f'Port: {PORT}')
    print(f'Main indices: {len(MAIN_INDEX_IDS)}')
    print(f'Sector groups: {len(SECTOR_WEB_IDS)}')
    print(f'Stock history: /api/stock-history?symbol=خودرو&adjust=1')
    print(f'Symbols search: /api/symbols-search?query=خودرو')
    print(f'Cache dir: {FILE_CACHE_DIR}')
    print(f'═' * 60)
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down')
        server.server_close()
