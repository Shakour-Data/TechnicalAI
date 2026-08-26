#!/bin/bash
# Watchdog: keeps Next.js dev server alive
LOG=/home/z/my-project/dev.log
PORT=3000

while true; do
  if ! curl -s -o /dev/null -w '' http://localhost:$PORT/ 2>/dev/null; then
    echo "[$(date)] Server down, restarting..." >> $LOG
    pkill -9 -f 'next-server|next dev' 2>/dev/null
    sleep 2
    cd /home/z/my-project && nohup npx next dev -p $PORT >> $LOG 2>&1 &
    sleep 15
  fi
  sleep 5
done
