#!/bin/bash
# Start TSETMC Index Service with auto-restart
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3031

while true; do
    if lsof -ti:$PORT >/dev/null 2>&1; then
        sleep 10
        continue
    fi
    echo "[$(date)] Starting TSETMC Index Service on port $PORT..."
    cd "$DIR"
    python3 -u app.py
    echo "[$(date)] Service exited. Restarting in 5s..."
    sleep 5
done
