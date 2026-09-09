#!/bin/bash
# Keep finpy-index-fetcher alive and auto-restart
while true; do
  cd /home/z/my-project
  if ! pgrep -f 'finpy-index-fetcher/index.py' > /dev/null; then
    echo "[$(date)] Starting finpy-index-fetcher..."
    python3 mini-services/finpy-index-fetcher/index.py >> /tmp/finpy-server.log 2>&1 &
    sleep 3
  fi
  # Also check if fetch script needs to run
  python3 -c "
import sqlite3
conn = sqlite3.connect('db/custom.db')
c = conn.cursor()
c.execute(\"SELECT COUNT(*) FROM IndexDef WHERE status='pending'\")
pending = c.fetchone()[0]
conn.close()
if pending > 0:
    exit(0)  # Need to fetch
exit(1)
" && \
    ! pgrep -f 'fetch-all-indices.py' > /dev/null && \
    echo "[$(date)] $pending indices pending, starting fetcher..." && \
    nohup python3 -u scripts/fetch-all-indices.py > /tmp/fetch-all.log 2>&1 &
  sleep 60
done
