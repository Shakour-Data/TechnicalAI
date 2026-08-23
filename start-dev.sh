#!/bin/bash
# VDSS Startup Script
# Builds (if needed) and starts all services via daemonized supervisor.
cd /home/z/my-project

# Kill agent-browser Chrome to free memory
pkill -9 -f 'chrome.*agent-browser' 2>/dev/null

# Kill orphaned next-server processes
pkill -9 -f 'next-server' 2>/dev/null
pkill -9 -f 'next dev' 2>/dev/null
sleep 2

# Build if needed
if [ ! -f .next/standalone/server.js ]; then
  echo "[BUILD] Starting Next.js build..."
  NODE_OPTIONS='--max-old-space-size=1024' npx next build 2>&1 | tail -10
fi

# Ensure static assets and public dir are available in standalone mode
cp -r .next/static .next/standalone/.next/static 2>/dev/null
cp -r public .next/standalone/public 2>/dev/null

# Start daemonized supervisor
python3 supervisor.py
echo "[STARTUP] Supervisor daemon launched"

# Wait for services to be ready
echo "[STARTUP] Waiting for services..."
for i in $(seq 1 30); do
  sleep 2
  if ss -tlnp sport = :3000 2>/dev/null | grep -q LISTEN && \
     ss -tlnp sport = :3031 2>/dev/null | grep -q LISTEN; then
    echo "[STARTUP] All services ready (${i}x2s)"
    exit 0
  fi
done
echo "[STARTUP] Timeout waiting for services"
exit 1
