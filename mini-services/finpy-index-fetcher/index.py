#!/usr/bin/env python3
"""
finpy-tse Index Fetcher — Bulk fetch & store all 50 TSE indices

Uses finpy-tse for web IDs and data processing methodology.
Since cdn.tsetmc.com is Iran-only, HTTP requests are proxied through
the Next.js /api/index-fetch-proxy endpoint (which uses z-ai SDK).

Data is stored permanently in SQLite (same DB as the Next.js app).

Port: 3035
"""

import json
import sqlite3
import time
import traceback
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone

import jdatetime
import pandas as pd
import finpy_tse as fpy

# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════

DB_PATH = '/home/z/my-project/db/custom.db'
NEXTJS_PROXY = 'http://localhost:3000/api/index-fetch-proxy'
PORT = 3035

def prisma_now():
    """Return datetime string in Prisma-compatible format."""
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.') + f'{datetime.now(timezone.utc).microsecond // 1000:03d}Z'

# ═══════════════════════════════════════════════════════════════
# Index Definitions (from finpy-tse)
# ═══════════════════════════════════════════════════════════════

MAIN_INDICES = [
    {'code': 'CWI',    'name': 'شاخص کل',                   'webId': '32097828799138957', 'category': 'main'},
    {'code': 'EWI',    'name': 'شاخص کل (هم وزن)',         'webId': '67130298613737946', 'category': 'main'},
    {'code': 'CWPI',   'name': 'شاخص قیمت (وزنی-ارزشی)',   'webId': '5798407779416661',  'category': 'main'},
    {'code': 'EWPI',   'name': 'شاخص قیمت (هم وزن)',       'webId': '8384385859414435',  'category': 'main'},
    {'code': 'FFI',    'name': 'شاخص آزاد شناور',          'webId': '49579049405614711', 'category': 'main'},
    {'code': 'MKT1I',  'name': 'شاخص بازار اول',            'webId': '62752761908615603', 'category': 'main'},
    {'code': 'MKT2I',  'name': 'شاخص بازار دوم',            'webId': '71704845530629737', 'category': 'main'},
    {'code': 'INDI',   'name': 'شاخص صنعت',                'webId': '43754960038275285', 'category': 'main'},
    {'code': 'LCI30',  'name': 'شاخص ۳۰ شرکت بزرگ',         'webId': '10523825119011581', 'category': 'main'},
    {'code': 'ACT50',  'name': 'شاخص ۵۰ شرکت فعال‌تر',      'webId': '46342955726788357', 'category': 'main'},
]

SECTOR_INDICES = [
    {'code': 'AGRI',        'name': 'شاخص گروه زراعت',              'webId': '34408080767216529', 'category': 'sector'},
    {'code': 'COAL',        'name': 'شاخص گروه ذغال سنگ',           'webId': '19219679288446732', 'category': 'sector'},
    {'code': 'METAL_ORE',   'name': 'شاخص گروه کانی فلزی',          'webId': '13235969998952202', 'category': 'sector'},
    {'code': 'OTHER_MINE',  'name': 'شاخص گروه سایر معادن',         'webId': '62691002126902464', 'category': 'sector'},
    {'code': 'TEXTILE',     'name': 'شاخص گروه منسوجات',            'webId': '59288237226302898', 'category': 'sector'},
    {'code': 'LEATHER',     'name': 'شاخص گروه محصولات چرمی',       'webId': '69306841376553334', 'category': 'sector'},
    {'code': 'WOOD',        'name': 'شاخص گروه محصولات چوبی',       'webId': '58440550086834602', 'category': 'sector'},
    {'code': 'PAPER',       'name': 'شاخص گروه محصولات کاغذی',      'webId': '30106839080444358', 'category': 'sector'},
    {'code': 'PUBLISH',     'name': 'شاخص گروه انتشار و چاپ',       'webId': '25766336681098389', 'category': 'sector'},
    {'code': 'PETRO',       'name': 'شاخص گروه فرآورده‌های نفتی',    'webId': '12331083953323969', 'category': 'sector'},
    {'code': 'RUBBER',      'name': 'شاخص گروه لاستیک',             'webId': '36469751685735891', 'category': 'sector'},
    {'code': 'BASE_METAL',  'name': 'شاخص گروه فلزات اساسی',        'webId': '32453344048876642', 'category': 'sector'},
    {'code': 'METAL_PROD',  'name': 'شاخص گروه محصولات فلزی',       'webId': '1123534346391630',  'category': 'sector'},
    {'code': 'MACHINERY',   'name': 'شاخص گروه ماشین آلات',          'webId': '11451389074113298', 'category': 'sector'},
    {'code': 'ELECTRIC',    'name': 'شاخص گروه دستگاه‌های برقی',    'webId': '33878047680249697', 'category': 'sector'},
    {'code': 'TELECOM',     'name': 'شاخص گروه وسایل ارتباطی',      'webId': '24733701189547084', 'category': 'sector'},
    {'code': 'AUTO',        'name': 'شاخص گروه خودرو',              'webId': '20213770409093165', 'category': 'sector'},
    {'code': 'SUGAR',       'name': 'شاخص گروه قند و شکر',          'webId': '21948907150049163', 'category': 'sector'},
    {'code': 'MULTI',       'name': 'شاخص گروه چند رشته‌ای',        'webId': '40355846462826897', 'category': 'sector'},
    {'code': 'UTILITY',     'name': 'شاخص گروه تامین آب، برق و گاز', 'webId': '54843635503648458', 'category': 'sector'},
    {'code': 'FOOD',        'name': 'شاخص گروه غذایی',              'webId': '15508900928481581', 'category': 'sector'},
    {'code': 'PHARMA',      'name': 'شاخص گروه دارویی',             'webId': '3615666621538524',  'category': 'sector'},
    {'code': 'CHEMICAL',    'name': 'شاخص گروه شیمیایی',            'webId': '33626672012415176', 'category': 'sector'},
    {'code': 'RETAIL',      'name': 'شاخص گروه خرده فروشی',         'webId': '65986638607018835', 'category': 'sector'},
    {'code': 'CERAMIC',     'name': 'شاخص گروه کاشی و سرامیک',      'webId': '57616105980228781', 'category': 'sector'},
    {'code': 'CEMENT',      'name': 'شاخص گروه سیمان',              'webId': '70077233737515808', 'category': 'sector'},
    {'code': 'NONMETAL',    'name': 'شاخص گروه کانی غیر فلزی',      'webId': '14651627750314021', 'category': 'sector'},
    {'code': 'INVEST',      'name': 'شاخص گروه سرمایه‌گذاری',       'webId': '34295935482222451', 'category': 'sector'},
    {'code': 'BANK',        'name': 'شاخص گروه بانک',               'webId': '72002976013856737', 'category': 'sector'},
    {'code': 'OTHER_FIN',   'name': 'شاخص گروه سایر مالی',          'webId': '25163959460949732', 'category': 'sector'},
    {'code': 'TRANSPORT',   'name': 'شاخص گروه حمل و نقل',          'webId': '24187097921483699', 'category': 'sector'},
    {'code': 'RADIO',       'name': 'شاخص گروه رادیویی',            'webId': '41867092385281437', 'category': 'sector'},
    {'code': 'FINANCE',     'name': 'شاخص گروه مالی',               'webId': '61247168213690670', 'category': 'sector'},
    {'code': 'EXCHANGE',    'name': 'شاخص گروه اداره بازارهای مالی', 'webId': '61985386521682984', 'category': 'sector'},
    {'code': 'REALEST',     'name': 'شاخص گروه انبوه سازی',          'webId': '4654922806626448',  'category': 'sector'},
    {'code': 'IT',          'name': 'شاخص گروه رایانه',              'webId': '8900726085939949',  'category': 'sector'},
    {'code': 'ICT',         'name': 'شاخص گروه اطلاعات و ارتباطات', 'webId': '18780171241610744', 'category': 'sector'},
    {'code': 'ENGR',        'name': 'شاخص گروه فنی مهندسی',          'webId': '47233872677452574', 'category': 'sector'},
    {'code': 'OIL_EXTRACT','name': 'شاخص گروه استخراج نفت',         'webId': '65675836323214668', 'category': 'sector'},
    {'code': 'INSURANCE',   'name': 'شاخص گروه بیمه و بازنشستگی',   'webId': '59105676994811497', 'category': 'sector'},
]

ALL_INDICES = MAIN_INDICES + SECTOR_INDICES

# ═══════════════════════════════════════════════════════════════
# Database helpers
# ═══════════════════════════════════════════════════════════════

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Ensure IndexDef and IndexHistory tables exist."""
    conn = get_db()
    try:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS IndexDef (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                webId TEXT UNIQUE NOT NULL,
                category TEXT NOT NULL,
                fetchedAt TEXT,
                candleCount INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                errorMsg TEXT,
                createdAt TEXT DEFAULT (datetime('now')),
                updatedAt TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS IndexHistory (
                id TEXT PRIMARY KEY,
                indexDefId TEXT NOT NULL,
                date TEXT NOT NULL,
                jDate TEXT NOT NULL,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                volume REAL DEFAULT 0,
                FOREIGN KEY (indexDefId) REFERENCES IndexDef(id) ON DELETE CASCADE,
                UNIQUE(indexDefId, date)
            );
            CREATE INDEX IF NOT EXISTS idx_index_history_def ON IndexHistory(indexDefId);
            CREATE INDEX IF NOT EXISTS idx_index_history_date ON IndexHistory(date);
        ''')
        conn.commit()
        print('[DB] Tables verified/created')
    finally:
        conn.close()

def seed_index_defs():
    """Insert all 50 index definitions if they don't exist."""
    conn = get_db()
    try:
        now = prisma_now()
        for idx in ALL_INDICES:
            conn.execute('''
                INSERT OR IGNORE INTO IndexDef (id, code, name, webId, category, status, fetchedAt, candleCount, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)
            ''', (idx['code'], idx['code'], idx['name'], idx['webId'], idx['category'], now, now, now))
        conn.commit()
        print(f'[DB] Seeded {len(ALL_INDICES)} index definitions')
    finally:
        conn.close()

# ═══════════════════════════════════════════════════════════════
# Data fetching via z-ai SDK proxy
# ═══════════════════════════════════════════════════════════════

import requests as req_lib

def fetch_via_proxy(web_id: str, timeout: int = 180) -> str:
    """
    Fetch raw JSON from cdn.tsetmc.com via the Next.js proxy.
    The proxy uses z-ai SDK page_reader (the only way to reach Iran-only CDN).
    Retries on transient errors (500, 502, 504).
    """
    url = f'{NEXTJS_PROXY}?webId={web_id}'
    max_retries = 3
    last_error = ''
    
    for attempt in range(1, max_retries + 1):
        try:
            print(f'[PROXY] Attempt {attempt}/{max_retries} for webId={web_id}...')
            resp = req_lib.get(url, timeout=timeout)
            if resp.status_code != 200:
                body = resp.text[:200]
                if resp.status_code in (500, 502, 504) and attempt < max_retries:
                    print(f'[PROXY] Status {resp.status_code}, retrying in 10s...')
                    last_error = f'Proxy returned status {resp.status_code}: {body}'
                    time.sleep(10)
                    continue
                raise Exception(f'Proxy returned status {resp.status_code}: {body}')
            data = resp.json()
            if data.get('error'):
                if attempt < max_retries:
                    print(f'[PROXY] Error from proxy, retrying in 10s: {data["error"][:100]}')
                    last_error = f"Proxy error: {data['error']}"
                    time.sleep(10)
                    continue
                raise Exception(f"Proxy error: {data['error']}")
            raw = data.get('raw', '')
            if not raw or len(raw) < 10:
                if attempt < max_retries:
                    print(f'[PROXY] Empty raw data (len={len(raw)}), retrying in 10s...')
                    last_error = f'Empty raw data (len={len(raw)})'
                    time.sleep(10)
                    continue
                raise Exception(f'Empty raw data from proxy (len={len(raw)})')
            return raw
        except req_lib.exceptions.Timeout:
            if attempt < max_retries:
                print(f'[PROXY] Timeout, retrying in 10s...')
                last_error = 'Request timeout'
                time.sleep(10)
                continue
            raise Exception(f'Proxy timeout after {timeout}s')
        except req_lib.exceptions.ConnectionError as e:
            if attempt < max_retries:
                print(f'[PROXY] Connection error, retrying in 10s: {e}')
                last_error = str(e)
                time.sleep(10)
                continue
            raise Exception(f'Proxy connection error: {e}')
    
    raise Exception(f'Failed after {max_retries} retries. Last error: {last_error}')

# ═══════════════════════════════════════════════════════════════
# Data processing (finpy-tse methodology)
# ═══════════════════════════════════════════════════════════════

def pad2(n: int) -> str:
    return f'{n:02d}'

def parse_b2_json(json_str: str):
    """Parse B2 JSON with truncation repair (same logic as finpy-tse/TypeScript)."""
    try:
        parsed = json.loads(json_str)
        return parsed.get('indexB2', [])
    except json.JSONDecodeError:
        # JSON is truncated — repair it
        repaired = json_str.strip()
        last_brace = repaired.rfind('}')
        if last_brace > 0:
            repaired = repaired[:last_brace + 1]
            repaired = repaired.rstrip(',').rstrip() + ']}'
            try:
                parsed = json.loads(repaired)
                return parsed.get('indexB2', [])
            except json.JSONDecodeError:
                pass
        # Try removing last entry
        last_complete = repaired.rfind('},{')
        if last_complete > 0:
            repaired = repaired[:last_complete + 1] + ']}'
            try:
                parsed = json.loads(repaired)
                return parsed.get('indexB2', [])
            except json.JSONDecodeError:
                pass
        raise Exception('Cannot repair truncated JSON')

def process_entries(entries, sector_name='خودرو'):
    """
    Process B2 entries into candle data using finpy-tse methodology.
    Returns list of dicts: {date, jDate, open, high, low, close, volume}
    """
    candles = []
    for i, e in enumerate(entries):
        d_even = str(e.get('dEven', ''))
        if len(d_even) != 8:
            continue

        g_year = int(d_even[:4])
        g_month = int(d_even[4:6])
        g_day = int(d_even[6:8])

        try:
            g_date = datetime(g_year, g_month, g_day)
        except ValueError:
            continue

        # Convert to Jalali using jdatetime (same as finpy-tse)
        try:
            j_date = jdatetime.date.fromgregorian(date=g_date.date())
            j_date_str = f'{pad2(j_date.year)}-{pad2(j_date.month)}-{pad2(j_date.day)}'
        except:
            continue

        close_val = float(e.get('xNivInuClMresIbs', 0)) or 0
        base_val = float(e.get('xNivInuPbMresIbs', 0)) or 0
        high_val = float(e.get('xNivInuPhMresIbs', 0)) or 0

        if close_val <= 0:
            continue

        prev_close = float(entries[i - 1].get('xNivInuClMresIbs', 0)) if i > 0 else close_val
        open_val = close_val if i == 0 else prev_close
        candle_high = max(high_val, close_val, open_val)
        candle_low = min(base_val if base_val > 0 else close_val, close_val, open_val)

        candles.append({
            'date': f'{pad2(g_year)}-{pad2(g_month)}-{pad2(g_day)}',
            'jDate': j_date_str,
            'open': round(open_val, 2),
            'high': round(candle_high, 2),
            'low': round(candle_low, 2),
            'close': round(close_val, 2),
            'volume': 0,
        })

    return candles

def fetch_and_store_index(idx_def: dict) -> dict:
    """
    Fetch a single index and store in SQLite.
    Returns {code, name, count, status, error?}
    """
    code = idx_def['code']
    web_id = idx_def['webId']
    name = idx_def['name']
    sector_name = name.replace('شاخص گروه ', '') if idx_def['category'] == 'sector' else name

    conn = get_db()
    try:
        # Update status to fetching
        now = prisma_now()
        conn.execute('''
            UPDATE IndexDef SET status = 'fetching', updatedAt = ?
            WHERE code = ?
        ''', (now, code,))
        conn.commit()

        print(f'[FETCH] {code} ({name}) — fetching via proxy...')

        # Fetch raw data via z-ai SDK proxy
        raw_json = fetch_via_proxy(web_id)
        entries = parse_b2_json(raw_json)
        print(f'[FETCH] {code} — parsed {len(entries)} raw entries')

        if not entries:
            conn.execute('''
                UPDATE IndexDef SET status = 'error', errorMsg = 'No entries parsed from CDN',
                updatedAt = ? WHERE code = ?
            ''', (now, code,))
            conn.commit()
            return {'code': code, 'name': name, 'count': 0, 'status': 'error', 'error': 'No entries parsed'}

        # Process entries (finpy-tse methodology)
        candles = process_entries(entries, sector_name)
        print(f'[FETCH] {code} — processed {len(candles)} candles')

        if not candles:
            conn.execute('''
                UPDATE IndexDef SET status = 'error', errorMsg = 'No valid candles after processing',
                updatedAt = ? WHERE code = ?
            ''', (now, code,))
            conn.commit()
            return {'code': code, 'name': name, 'count': 0, 'status': 'error', 'error': 'No valid candles'}

        # Get IndexDef ID
        row = conn.execute('SELECT id FROM IndexDef WHERE code = ?', (code,)).fetchone()
        if not row:
            return {'code': code, 'name': name, 'count': 0, 'status': 'error', 'error': 'IndexDef not found in DB'}
        index_def_id = row['id']

        # Delete old candles and insert new ones (upsert)
        conn.execute('DELETE FROM IndexHistory WHERE indexDefId = ?', (index_def_id,))

        for c in candles:
            conn.execute('''
                INSERT INTO IndexHistory (id, indexDefId, date, jDate, open, high, low, close, volume)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (f'{code}_{c["date"]}', index_def_id, c['date'], c['jDate'],
                  c['open'], c['high'], c['low'], c['close'], c['volume']))

        # Update IndexDef status
        now = prisma_now()
        conn.execute('''
            UPDATE IndexDef SET status = 'done', candleCount = ?, fetchedAt = ?,
            errorMsg = NULL, updatedAt = ? WHERE code = ?
        ''', (len(candles), now, now, code))
        conn.commit()

        print(f'[FETCH] {code} — stored {len(candles)} candles ✓')
        return {'code': code, 'name': name, 'count': len(candles), 'status': 'done'}

    except Exception as ex:
        err_msg = str(ex)[:500]
        print(f'[FETCH] {code} — ERROR: {err_msg}')
        try:
            now = prisma_now()
            conn.execute('''
                UPDATE IndexDef SET status = 'error', errorMsg = ?, updatedAt = ?
                WHERE code = ?
            ''', (err_msg, now, code))
            conn.commit()
        except:
            pass
        return {'code': code, 'name': name, 'count': 0, 'status': 'error', 'error': err_msg}
    finally:
        conn.close()

# ═══════════════════════════════════════════════════════════════
# Bulk fetch (background thread)
# ═══════════════════════════════════════════════════════════════

class BulkFetcher:
    def __init__(self):
        self.is_running = False
        self.progress = []  # list of result dicts
        self.current_index = 0
        self.total = len(ALL_INDICES)
        self.start_time = None
        self.thread = None
        self.error = None

    def start(self, category='all'):
        if self.is_running:
            return {'error': 'Bulk fetch already in progress'}

        indices = ALL_INDICES
        if category == 'main':
            indices = MAIN_INDICES
        elif category == 'sector':
            indices = SECTOR_INDICES

        self.total = len(indices)
        self.current_index = 0
        self.progress = []
        self.is_running = True
        self.start_time = time.time()
        self.error = None

        def run():
            try:
                for i, idx in enumerate(indices):
                    if not self.is_running:
                        self.progress.append({'code': idx['code'], 'status': 'cancelled'})
                        break
                    self.current_index = i + 1
                    result = fetch_and_store_index(idx)
                    self.progress.append(result)
                    # Delay between fetches to avoid overwhelming z-ai SDK
                    if i < len(indices) - 1:
                        time.sleep(2)
            except Exception as ex:
                self.error = str(ex)
                print(f'[BULK] Fatal error: {ex}')
            finally:
                self.is_running = False
                print(f'[BULK] Finished. {len(self.progress)} indices processed.')

        self.thread = threading.Thread(target=run, daemon=True)
        self.thread.start()
        return {'status': 'started', 'total': self.total}

    def stop(self):
        self.is_running = False
        return {'status': 'stopping'}

    def get_status(self):
        elapsed = time.time() - self.start_time if self.start_time else 0
        done_count = len(self.progress)
        error_count = sum(1 for p in self.progress if p.get('status') == 'error')
        success_count = sum(1 for p in self.progress if p.get('status') == 'done')
        return {
            'is_running': self.is_running,
            'current': self.current_index,
            'total': self.total,
            'done': done_count,
            'success': success_count,
            'errors': error_count,
            'elapsed_seconds': round(elapsed, 1),
            'error': self.error,
            'progress': self.progress[-10:],  # Last 10 results
        }

bulk_fetcher = BulkFetcher()

# ═══════════════════════════════════════════════════════════════
# HTTP Server
# ═══════════════════════════════════════════════════════════════

def json_response(data, status=200):
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    return (status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }, body)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress default logging

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        try:
            # Health check
            if path == '/api/health':
                return self._send(*json_response({
                    'status': 'ok',
                    'service': 'finpy-index-fetcher',
                    'version': '2.0.0',
                    'source': 'finpy-tse + z-ai SDK proxy',
                    'total_indices': len(ALL_INDICES),
                }))

            # List all index definitions and their fetch status
            if path == '/api/indices':
                conn = get_db()
                try:
                    rows = conn.execute('''
                        SELECT code, name, webId, category, status, candleCount, fetchedAt, errorMsg
                        FROM IndexDef ORDER BY category, code
                    ''').fetchall()
                    indices = [dict(r) for r in rows]
                finally:
                    conn.close()
                return self._send(*json_response({'indices': indices}))

            # Get candles for a specific index (from SQLite)
            if path == '/api/index-data':
                code = params.get('code', [''])[0]
                if not code:
                    return self._send(*json_response({'error': 'code is required'}, 400))

                conn = get_db()
                try:
                    # Get IndexDef
                    def_row = conn.execute('SELECT id, code, name, webId, category FROM IndexDef WHERE code = ?', (code,)).fetchone()
                    if not def_row:
                        return self._send(*json_response({'error': f'Index {code} not found'}, 404))

                    index_def = dict(def_row)
                    candles = conn.execute('''
                        SELECT date, jDate as j_date, open, high, low, close, volume
                        FROM IndexHistory WHERE indexDefId = ? ORDER BY date
                    ''', (index_def['id'],)).fetchall()

                    return self._send(*json_response({
                        'index': index_def,
                        'candles': [dict(c) for c in candles],
                        'count': len(candles),
                    }))
                finally:
                    conn.close()

            # Bulk fetch status
            if path == '/api/bulk-status':
                return self._send(*json_response(bulk_fetcher.get_status()))

            return self._send(*json_response({'error': 'Not found'}, 404))

        except Exception as ex:
            traceback.print_exc()
            return self._send(*json_response({'error': str(ex)}, 500))

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        try:
            # Start bulk fetch
            if path == '/api/bulk-fetch':
                category = params.get('category', ['all'])[0]
                result = bulk_fetcher.start(category)
                return self._send(*json_response(result))

            # Stop bulk fetch
            if path == '/api/bulk-stop':
                result = bulk_fetcher.stop()
                return self._send(*json_response(result))

            # Fetch single index
            if path == '/api/fetch-one':
                code = params.get('code', [''])[0]
                if not code:
                    return self._send(*json_response({'error': 'code is required'}, 400))

                idx_def = next((i for i in ALL_INDICES if i['code'] == code), None)
                if not idx_def:
                    return self._send(*json_response({'error': f'Unknown code: {code}'}, 404))

                result = fetch_and_store_index(idx_def)
                return self._send(*json_response(result))

            return self._send(*json_response({'error': 'Not found'}, 404))

        except Exception as ex:
            traceback.print_exc()
            return self._send(*json_response({'error': str(ex)}, 500))

    def _send(self, status, headers, body):
        self.send_response(status)
        for key, val in headers.items():
            self.send_header(key, val)
        self.end_headers()
        self.wfile.write(body)

# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

if __name__ == '__main__':
    print(f'finpy-index-fetcher v2.0.0 starting on port {PORT}')
    print(f'Data source: finpy-tse methodology + z-ai SDK proxy')
    print(f'Indices: {len(MAIN_INDICES)} main + {len(SECTOR_INDICES)} sector = {len(ALL_INDICES)} total')
    print(f'Database: {DB_PATH}')

    init_db()
    seed_index_defs()

    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'Server running on http://0.0.0.0:{PORT}')
    server.serve_forever()
