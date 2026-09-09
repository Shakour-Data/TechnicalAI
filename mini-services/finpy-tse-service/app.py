# finpy-tse Index & Stock Data Service
# Reads from file caches populated by prefetch-sectors.py
# No background threads - simple and reliable

import json, os, re, subprocess, sys, time, traceback
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs, unquote


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

PORT = int(os.environ.get('PORT', '3031'))
FILE_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'db')
CACHE_TTL = 24 * 60 * 60
SECTOR_LATEST_FILE = os.path.join(FILE_CACHE_DIR, 'sector-latest.json')

import jdatetime

def gregorian_to_jalali(gy, gm, gd):
    try:
        jdate = jdatetime.date.fromgregorian(year=gy, month=gm, day=gd)
        return f"{jdate.year}/{str(jdate.month).zfill(2)}/{str(jdate.day).zfill(2)}"
    except:
        return f"{gy}/{str(gm).zfill(2)}/{str(gd).zfill(2)}"


def zai_page_reader(url, timeout=120):
    tmp = f'/tmp/zai_{hash(url) % 100000}_{int(time.time())}.json'
    last_error = None
    for attempt in range(3):
        try:
            r = subprocess.run(
                ['z-ai', 'function', '-n', 'page_reader', '-a', json.dumps({'url': url}), '-o', tmp],
                capture_output=True, text=True, timeout=timeout
            )
            if r.returncode != 0:
                last_error = f"z-ai failed: {r.stderr[:200]}"
                time.sleep(3 * (attempt + 1)); continue
            with open(tmp) as f: data = json.load(f)
            html = data.get('data', {}).get('html', '')
            if not html: time.sleep(3 * (attempt + 1)); continue
            return html
        except subprocess.TimeoutExpired: last_error = 'timeout'; time.sleep(3)
        except Exception as e: last_error = str(e)[:100]; time.sleep(3)
        finally:
            if os.path.exists(tmp):
                try: os.unlink(tmp)
                except: pass
            tmp = f'/tmp/zai_{hash(url) % 100000}_{int(time.time())}.json'
    raise RuntimeError(f'z-ai failed after 3 attempts: {last_error}')


def fetch_b2_data(web_id, timeout=120):
    url = f'http://cdn.tsetmc.com/api/Index/GetIndexB2History/{web_id}'
    html = zai_page_reader(url, timeout)
    pre = re.search(r'<pre[^>]*>([\s\S]*?)</pre>', html, re.IGNORECASE)
    json_str = pre.group(1) if pre else re.sub(r'<[^>]+>', '', html).strip()
    json_str = json_str.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    try: return json.loads(json_str).get('indexB2', [])
    except json.JSONDecodeError: pass
    last_brace = json_str.rfind('}')
    for ep in range(last_brace, max(last_brace - 10, 0), -1):
        try:
            data = json.loads(json_str[:ep + 1])
            items = data.get('indexB2', [])
            if items: return items
        except: continue
    raise RuntimeError('Failed to parse B2 JSON')


def b2_to_candles(b2_items):
    candles = []
    for item in b2_items:
        close = item.get('xNivInuClMresIbs', 0)
        if close <= 0: continue
        deven = str(item.get('dEven', 0))
        if len(deven) < 8: continue
        date_str = gregorian_to_jalali(int(deven[:4]), int(deven[4:6]), int(deven[6:8]))
        first = item.get('xNivInuPhMresIbs', 0)
        prev = item.get('xNivInuPbMresIbs', 0)
        op = first if first > 0 else prev
        candles.append({'date': date_str, 'open': round(op, 1), 'high': round(max(op, close), 1), 'low': round(min(op, close), 1), 'close': round(close, 1), 'volume': 0})
    candles.sort(key=lambda x: x['date'])
    return candles


def file_cache_path(key):
    safe = re.sub(r'[^a-zA-Z0-9\u0600-\u06FF_-]', '_', key)
    prefix = 'index'
    for p in ('stock', 'symbols', 'sec', 'idx'):
        if key.startswith(p + '_'): prefix = p; break
    return os.path.join(FILE_CACHE_DIR, f'{prefix}-{safe}.json')


def load_file_cache(key):
    path = file_cache_path(key)
    if not os.path.exists(path): return None
    try:
        with open(path) as f: entry = json.load(f)
        if time.time() * 1000 - entry.get('time', 0) > CACHE_TTL * 1000: return None
        return entry.get('data', [])
    except: return None


def save_file_cache(key, data):
    try:
        os.makedirs(FILE_CACHE_DIR, exist_ok=True)
        with open(file_cache_path(key), 'w') as f:
            json.dump({'data': data, 'time': int(time.time() * 1000)}, f, ensure_ascii=False)
    except: pass


def _fetch_price_history(symbol, adjust):
    import finpy_tse
    df = finpy_tse.Get_Price_History(stock=symbol, ignore_date=True, adjust_price=adjust, show_weekday=False, double_date=False)
    if df is None or (hasattr(df, 'empty') and df.empty): raise RuntimeError(f'No data for "{symbol}"')
    df = df.reset_index()
    date_col = 'J-Date' if 'J-Date' in df.columns else df.columns[0]
    if adjust and 'Adj Close' in df.columns: oc, hc, lc, cc = 'Adj Open', 'Adj High', 'Adj Low', 'Adj Close'
    else: oc, hc, lc, cc = 'Open', 'High', 'Low', 'Close'
    candles = []
    for _, row in df.iterrows():
        try: candles.append({'date': str(row[date_col]).replace('-', '/'), 'open': int(row[oc]), 'high': int(row[hc]), 'low': int(row[lc]), 'close': int(row[cc]), 'volume': int(row['Volume'])})
        except: continue
    candles.sort(key=lambda x: x['date'])
    return candles


def _fetch_stock_list():
    import finpy_tse
    df = finpy_tse.Build_Market_StockList(bourse=True, farabourse=True, payeh=True, detailed_list=False, show_progress=False, save_excel=False, save_csv=False)
    if df is None or (hasattr(df, 'empty') and df.empty): raise RuntimeError('No stock list')
    return [{'ticker': str(r.get('Ticker', '')), 'name': str(r.get('Name', '')), 'market': str(r.get('Market', ''))} for _, r in df.iterrows()]


def load_sector_latest():
    """Load sector latest prices from sector-latest.json file."""
    if os.path.exists(SECTOR_LATEST_FILE):
        try:
            with open(SECTOR_LATEST_FILE) as f: entry = json.load(f)
            return entry.get('data', {})
        except: pass
    return {}


MAIN_INDEX_IDS = {
    'CWI': '32097828799138957', 'EWI': '67130298613737946', 'CWPI': '5798407779416661',
    'EWPI': '8384385859414435', 'FFI': '49579049405614711', 'MKT1I': '62752761908615603',
    'MKT2I': '71704845530629737', 'INDI': '43754960038275285', 'ACT50': '46342955726788357',
    'LCI30': '10523825119011581',
}

SECTOR_WEB_IDS = {
    'زراعت': '34408080767216529', 'ذغال سنگ': '19219679288446732', 'کانی فلزی': '13235969998952202',
    'سایر معادن': '62691002126902464', 'منسوجات': '59288237226302898', 'محصولات چرمی': '69306841376553334',
    'محصولات چوبی': '58440550086834602', 'محصولات کاغذی': '30106839080444358', 'انتشار و چاپ': '25766336681098389',
    'فرآورده های نفتی': '12331083953323969', 'لاستیک': '36469751685735891', 'فلزات اساسی': '32453344048876642',
    'محصولات فلزی': '1123534346391630', 'ماشین آلات': '11451389074113298', 'دستگاه های برقی': '33878047680249697',
    'وسایل ارتباطی': '24733701189547084', 'خودرو': '20213770409093165', 'قند و شکر': '21948907150049163',
    'چند رشته ای': '40355846462826897', 'تامین آب، برق و گاز': '54843635503648458',
    'غذایی': '15508900928481581', 'دارویی': '3615666621538524', 'شیمیایی': '33626672012415176',
    'خرده فروشی': '65986638607018835', 'کاشی و سرامیک': '57616105980228781', 'سیمان': '70077233737515808',
    'کانی غیر فلزی': '14651627750314021', 'سرمایه گذاری': '34295935482222451',
    'بانک': '72002976013856737', 'سایر مالی': '25163959460949732', 'حمل و نقل': '24187097921483699',
    'رادیویی': '41867092385281437', 'مالی': '61247168213690670', 'اداره بازارهای مالی': '61985386521682984',
    'انبوه سازی': '4654922806626448', 'رایانه': '8900726085939949',
    'اطلاعات و ارتباطات': '18780171241610744', 'فنی مهندسی': '47233872677452574',
    'استخراج نفت': '65675836323214668', 'بیمه و بازنشستگی': '59105676994811497',
}

SECTOR_ALIASES = {
    'مواد دارویی': 'دارویی', 'دارویی': 'دارویی',
    'فرآورده‌های نفتی': 'فرآورده های نفتی', 'فرآورده نفتی': 'فرآورده های نفتی',
    'سرمایه‌گذاریها': 'سرمایه گذاری', 'سرمایه‌گذاری': 'سرمایه گذاری',
    'بانکها': 'بانک', 'بانک‌ها': 'بانک', 'انبوه‌سازی': 'انبوه سازی',
    'تامین آب برق گاز': 'تامین آب، برق و گاز', 'تأمین آب، برق و گاز': 'تامین آب، برق و گاز',
    'چندرشته‌ای': 'چند رشته ای', 'کانی غیرفلزی': 'کانی غیر فلزی',
    'دستگاه‌های برقی': 'دستگاه های برقی', 'ماشین‌آلات': 'ماشین آلات', 'خرده‌فروشی': 'خرده فروشی',
}


def resolve_sector_name(name):
    if name in SECTOR_WEB_IDS: return name
    if name in SECTOR_ALIASES: return SECTOR_ALIASES[name]
    for k in SECTOR_WEB_IDS:
        if name in k or k in name: return k
    return None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        # Decode percent-encoded bytes to string (handles UTF-8 Persian chars)
        raw = self.path.encode('latin-1').decode('utf-8', errors='replace')
        parsed = urlparse(raw)
        params = parse_qs(parsed.query)
        path = parsed.path
        try:
            if path == '/health': return self._h_health()
            elif path == '/api/index-history': return self._h_index(params)
            elif path == '/api/sector-history': return self._h_sector(params)
            elif path == '/api/sector-list': return self._json({'sectors': list(SECTOR_WEB_IDS.keys()), 'main_indices': list(MAIN_INDEX_IDS.keys())})
            elif path == '/api/all-sector-latest': return self._h_all_sectors()
            elif path == '/api/stock-history': return self._h_stock(params)
            elif path == '/api/symbols-search': return self._h_search(params)
            else: self._json({'error': 'Not found'}, 404)
        except Exception as e:
            traceback.print_exc()
            self._json({'error': str(e)}, 500)

    def _h_health(self):
        sl = load_sector_latest()
        self._json({'status': 'ok', 'service': 'finpy-tse-index-service',
            'main_indices': len(MAIN_INDEX_IDS), 'sectors': len(SECTOR_WEB_IDS),
            'sector_cached': len(sl)})

    def _h_all_sectors(self):
        sl = load_sector_latest()
        self._json({'count': len(sl), 'total': len(SECTOR_WEB_IDS), 'sectors': sl})

    def _h_stock(self, params):
        symbol = (params.get('symbol') or [''])[0].strip()
        if not symbol: return self._json({'error': 'symbol required', 'candles': []}, 400)
        adjust = (params.get('adjust') or ['1'])[0].strip() != '0'
        ck = f'stock_{symbol}_{"adj" if adjust else "raw"}'
        cached = load_file_cache(ck)
        if cached: return self._json({'symbol': symbol, 'adjust': adjust, 'count': len(cached), 'source': 'cache', 'candles': cached})
        try:
            with ThreadPoolExecutor(max_workers=1) as ex:
                f = ex.submit(_fetch_price_history, symbol, adjust)
                try: candles = f.result(timeout=30)
                except FuturesTimeoutError: f.cancel(); return self._json({'error': 'timeout', 'candles': []}, 504)
        except Exception as e: return self._json({'error': str(e), 'candles': []}, 500)
        if not candles: return self._json({'error': 'no data', 'candles': []}, 404)
        save_file_cache(ck, candles)
        return self._json({'symbol': symbol, 'adjust': adjust, 'count': len(candles), 'source': 'finpy-tse', 'candles': candles})

    def _h_search(self, params):
        query = (params.get('query') or [''])[0].strip()
        if not query: return self._json({'error': 'query required', 'results': []}, 400)
        cached_list = load_file_cache('symbols_all')
        if cached_list is not None: return self._json({'query': query, 'results': cached_list[:50], 'source': 'cache'})
        try:
            with ThreadPoolExecutor(max_workers=1) as ex:
                f = ex.submit(_fetch_stock_list)
                try: sl = f.result(timeout=60)
                except FuturesTimeoutError: f.cancel(); return self._json({'error': 'timeout', 'results': []}, 504)
        except Exception as e: return self._json({'error': str(e), 'results': []}, 500)
        save_file_cache('symbols_all', sl)
        return self._json({'query': query, 'results': sl[:50], 'source': 'finpy-tse'})

    def _h_index(self, params):
        key = (params.get('key') or [''])[0].strip().upper()
        if not key or key not in MAIN_INDEX_IDS: return self._json({'error': 'Invalid key', 'candles': []}, 400)
        ck = f'idx_{key}'
        cached = load_file_cache(ck)
        if cached: return self._json({'index_key': key, 'count': len(cached), 'candles': cached})
        try:
            b2 = fetch_b2_data(MAIN_INDEX_IDS[key], 120); candles = b2_to_candles(b2)
            if not candles: return self._json({'error': 'no data', 'candles': []}, 404)
            save_file_cache(ck, candles)
            return self._json({'index_key': key, 'count': len(candles), 'candles': candles})
        except Exception as e: return self._json({'error': str(e), 'candles': []}, 500)

    def _h_sector(self, params):
        wid = (params.get('webId') or [''])[0].strip()
        if wid:
            # Try webId-based cache first, then resolve to sector name cache
            ck = f'sec_{wid}'; cached = load_file_cache(ck)
            if not cached:
                # Try to find sector name by webId
                for sn, sw in SECTOR_WEB_IDS.items():
                    if sw == wid:
                        ck2 = f'sec_{sn}'; cached = load_file_cache(ck2)
                        if cached: break
            if cached: return self._json({'web_id': wid, 'count': len(cached), 'candles': cached})
            try:
                b2 = fetch_b2_data(wid, 120); candles = b2_to_candles(b2)
                if not candles: return self._json({'error': 'no data', 'candles': []}, 404)
                save_file_cache(ck, candles)
                return self._json({'web_id': wid, 'count': len(candles), 'candles': candles})
            except Exception as e: return self._json({'error': str(e), 'candles': []}, 500)
        sector = (params.get('sector') or [''])[0].strip()
        if not sector: return self._json({'error': 'sector or webId required'}, 400)
        resolved = resolve_sector_name(sector)
        if not resolved: return self._json({'error': f'Sector not found: {sector}', 'candles': []}, 404)
        ck = f'sec_{resolved}'; cached = load_file_cache(ck)
        if cached: return self._json({'sector': resolved, 'count': len(cached), 'candles': cached})
        try:
            b2 = fetch_b2_data(SECTOR_WEB_IDS[resolved], 120); candles = b2_to_candles(b2)
            if not candles: return self._json({'error': 'no data', 'candles': []}, 404)
            save_file_cache(ck, candles)
            return self._json({'sector': resolved, 'count': len(candles), 'candles': candles})
        except Exception as e: return self._json({'error': str(e), 'candles': []}, 500)


if __name__ == '__main__':
    server = ThreadedHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'finpy-tse service on :{PORT} | {len(MAIN_INDEX_IDS)} indices, {len(SECTOR_WEB_IDS)} sectors', flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: server.server_close()
