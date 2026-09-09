#!/usr/bin/env python3
"""Pre-fetch all sector index data from TSETMC CDN B2 API via z-ai page_reader.
Usage: python3 prefetch-sectors.py
Writes sec-*.json cache files and sector-latest.json to ../db/
"""
import json
import os
import re
import subprocess
import sys
import time

FILE_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'db')
SECTOR_LATEST_FILE = os.path.join(FILE_CACHE_DIR, 'sector-latest.json')

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


import jdatetime

def gregorian_to_jalali(gy, gm, gd):
    try:
        jdate = jdatetime.date.fromgregorian(year=gy, month=gm, day=gd)
        return f"{jdate.year}/{str(jdate.month).zfill(2)}/{str(jdate.day).zfill(2)}"
    except:
        return f"{gy}/{str(gm).zfill(2)}/{str(gd).zfill(2)}"


def fetch_b2_data(web_id: str, timeout: int = 60) -> list:
    url = f'http://cdn.tsetmc.com/api/Index/GetIndexB2History/{web_id}'
    tmp = f'/tmp/zai_b2_{web_id}.json'
    for attempt in range(2):
        try:
            result = subprocess.run(
                ['z-ai', 'function', '-n', 'page_reader', '-a', json.dumps({'url': url}), '-o', tmp],
                capture_output=True, text=True, timeout=timeout
            )
            if result.returncode != 0:
                print(f'  z-ai failed (attempt {attempt+1}): {result.stderr[:100]}', flush=True)
                time.sleep(5)
                continue
            with open(tmp) as f:
                data = json.load(f)
            html = data.get('data', {}).get('html', '')
            if not html:
                print(f'  Empty response (attempt {attempt+1})', flush=True)
                time.sleep(5)
                continue
            pre = re.search(r'<pre[^>]*>([\s\S]*?)</pre>', html, re.IGNORECASE)
            json_str = pre.group(1) if pre else re.sub(r'<[^>]+>', '', html).strip()
            json_str = json_str.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
            try:
                return json.loads(json_str).get('indexB2', [])
            except json.JSONDecodeError:
                last_brace = json_str.rfind('}')
                for end_pos in range(last_brace, max(last_brace - 10, 0), -1):
                    try:
                        data = json.loads(json_str[:end_pos + 1])
                        items = data.get('indexB2', [])
                        if items:
                            return items
                    except:
                        continue
                raise RuntimeError('Failed to parse B2 JSON')
        except subprocess.TimeoutExpired:
            print(f'  z-ai timed out after {timeout}s (attempt {attempt+1})', flush=True)
        except Exception as e:
            print(f'  Error: {str(e)[:100]}', flush=True)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)
    raise RuntimeError(f'Failed to fetch B2 data for webId={web_id}')


def b2_to_candles(b2_items: list) -> list:
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


def main():
    os.makedirs(FILE_CACHE_DIR, exist_ok=True)
    results = {}
    total = len(SECTOR_WEB_IDS)
    success = 0
    fail = 0

    print(f'Starting pre-fetch of {total} sector indices...', flush=True)
    start_time = time.time()

    for i, (sector_name, web_id) in enumerate(SECTOR_WEB_IDS.items(), 1):
        cache_file = os.path.join(FILE_CACHE_DIR, f'sec-{sector_name}.json')
        print(f'[{i}/{total}] {sector_name} (webId={web_id})...', end=' ', flush=True)

        try:
            # Skip if already cached (from previous run)
            if os.path.exists(cache_file):
                try:
                    with open(cache_file) as cf: ce = json.load(cf)
                    cc = ce.get('data', [])
                    if cc and len(cc) > 0:
                        last, prev = cc[-1], cc[-2] if len(cc) > 1 else None
                        c = last.get('close', 0); pc = prev.get('close', 0) if prev else c
                        pcp = round(((c - pc) / pc) * 100, 2) if pc > 0 else 0
                        results[sector_name] = {'sector': sector_name, 'webId': web_id, 'close': c, 'pcp': pcp, 'date': last.get('date', '')}
                        success += 1
                        print(f'[{i}/{total}] {sector_name}: {c:,.1f} (cached) [{len(cc)} candles]', flush=True)
                        continue
                except: pass

            b2_items = fetch_b2_data(web_id, timeout=60)
            candles = b2_to_candles(b2_items)

            if not candles:
                print('NO DATA', flush=True)
                fail += 1
                continue

            # Save full history cache
            with open(cache_file, 'w') as f:
                json.dump({'data': candles, 'time': int(time.time() * 1000)}, f, ensure_ascii=False)

            # Extract latest info
            last = candles[-1]
            prev = candles[-2] if len(candles) > 1 else None
            close = last.get('close', 0)
            prev_close = prev.get('close', 0) if prev else close
            pcp = round(((close - prev_close) / prev_close) * 100, 2) if prev_close > 0 else 0

            results[sector_name] = {
                'sector': sector_name,
                'webId': web_id,
                'close': close,
                'prevClose': prev_close,
                'pcp': pcp,
                'date': last.get('date', ''),
                'candlesCount': len(candles),
            }
            success += 1
            print(f'OK: {close:,.1f} ({pcp:+.2f}%) [{len(candles)} candles]', flush=True)

        except Exception as e:
            fail += 1
            print(f'FAIL: {str(e)[:80]}', flush=True)

        # Small delay between requests to avoid rate limiting
        if i < total:
            time.sleep(1)

    # Save sector-latest.json
    with open(SECTOR_LATEST_FILE, 'w') as f:
        json.dump({'data': results, 'time': int(time.time() * 1000)}, f, ensure_ascii=False)

    elapsed = time.time() - start_time
    print(f'\nDone: {success}/{total} sectors fetched in {elapsed:.0f}s ({fail} failed)', flush=True)
    print(f'Latest prices saved to: {SECTOR_LATEST_FILE}', flush=True)


if __name__ == '__main__':
    main()
