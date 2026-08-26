#!/usr/bin/env python3
"""Background script to fetch all remaining index data."""
import sys, time, sqlite3
sys.path.insert(0, 'mini-services/finpy-index-fetcher')
from index import ALL_INDICES, fetch_and_store_index

def is_done(code):
    conn = sqlite3.connect('db/custom.db')
    c = conn.cursor()
    c.execute('SELECT status FROM IndexDef WHERE code=?', (code,))
    r = c.fetchone()
    conn.close()
    return r and r[0] == 'done'

# Reset any stuck ones
conn = sqlite3.connect('db/custom.db')
conn.execute("UPDATE IndexDef SET status='pending', errorMsg=NULL WHERE status='fetching'")
conn.commit()
conn.close()

remaining = [idx for idx in ALL_INDICES if not is_done(idx['code'])]
print(f'Need to fetch {len(remaining)} indices', flush=True)

for i, idx in enumerate(remaining):
    print(f'[{i+1}/{len(remaining)}] {idx["code"]}', end=' ', flush=True)
    try:
        r = fetch_and_store_index(idx)
        status = r.get('status', '?')
        count = r.get('count', 0)
        print(f'-> {status}:{count}', flush=True)
    except Exception as e:
        print(f'-> EXC:{str(e)[:80]}', flush=True)
    time.sleep(8)

print('=== ALL FINISHED ===', flush=True)
