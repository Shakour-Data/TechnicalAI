#!/usr/bin/env python3
import json, re, sys, os, time

tmp_file = sys.argv[1]
sector_name = sys.argv[2] if len(sys.argv) > 2 else None
web_id = sys.argv[3] if len(sys.argv) > 3 else None

db_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'db')

try:
    with open(tmp_file) as f:
        data = json.load(f)
    html = data.get('data', {}).get('html', '')
    if not html:
        print('NO_HTML'); sys.exit(0)
    pre = re.search(r'<pre[^>]*>([\s\S]*?)</pre>', html, re.IGNORECASE)
    json_str = pre.group(1) if pre else re.sub(r'<[^>]+>', '', html).strip()
    json_str = json_str.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    items = json.loads(json_str).get('indexB2', [])
    if not items:
        print('NO_DATA'); sys.exit(0)
    valid = [x for x in items if x.get('xNivInuClMresIbs', 0) > 0]
    if not valid:
        print('NO_VALID'); sys.exit(0)
    last = valid[-1]
    prev = valid[-2] if len(valid) > 1 else last
    close = last['xNivInuClMresIbs']
    prev_close = prev['xNivInuClMresIbs']
    pcp = round(((close - prev_close) / prev_close) * 100, 2) if prev_close > 0 else 0

    # Save individual cache file
    if sector_name:
        cache_path = os.path.join(db_dir, f'sec-{sector_name}.json')
        candles = []
        for item in valid:
            c = item.get('xNivInuClMresIbs', 0)
            if c <= 0: continue
            deven = str(item.get('dEven', 0))
            if len(deven) < 8: continue
            p = item.get('xNivInuPhMresIbs', 0) or prev_close
            candles.append({
                'date': deven,
                'open': round(p, 1),
                'high': round(max(p, c), 1),
                'low': round(min(p, c), 1),
                'close': round(c, 1),
                'volume': 0,
            })
        os.makedirs(db_dir, exist_ok=True)
        with open(cache_path, 'w') as f:
            json.dump({'data': candles, 'time': int(time.time() * 1000)}, f, ensure_ascii=False)

    # Update sector-latest.json
    if sector_name and web_id:
        latest_path = os.path.join(db_dir, 'sector-latest.json')
        latest_data = {}
        if os.path.exists(latest_path):
            with open(latest_path) as f:
                entry = json.load(f)
                latest_data = entry.get('data', entry)
        latest_data[sector_name] = {
            'sector': sector_name,
            'close': close,
            'pcp': pcp,
            'date': str(last.get('dEven', '')),
            'webId': web_id,
        }
        with open(latest_path, 'w') as f:
            json.dump({'data': latest_data, 'time': int(time.time() * 1000)}, f, ensure_ascii=False)

    print(f'OK:{close}:{pcp}')
except Exception as e:
    print(f'ERROR:{e}')
