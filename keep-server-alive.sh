#!/bin/bash
# Keep-alive script: checks if Next.js dev server is running on port 3000, starts it if not

LOCKFILE="/tmp/dev-server.lock"

# Prevent concurrent runs
if [ -f "$LOCKFILE" ]; then
  OLDPID=$(cat "$LOCKFILE" 2>/dev/null)
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    exit 0  # Already running
  fi
  rm -f "$LOCKFILE"
fi

echo $$ > "$LOCKFILE"

# Check if something is already listening on port 3000
if ss -tlnp 2>/dev/null | rg -q ':3000 '; then
  rm -f "$LOCKFILE"
  exit 0
fi

cd /home/z/my-project
: > dev.log
NODE_OPTIONS='--max-old-space-size=3072' nohup node node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 &
SERVER_PID=$!
echo "Started server PID=$SERVER_PID"

# Wait briefly and verify
sleep 3
if kill -0 $SERVER_PID 2>/dev/null; then
  echo "Server running"
else
  echo "Server failed to start"
fi

rm -f "$LOCKFILE"
