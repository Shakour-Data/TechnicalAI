#!/bin/bash
# Auto-restart wrapper for Next.js dev server
# The sandbox periodically kills background processes;
# this script ensures the server is always running.

cd /home/z/my-project

while true; do
  echo "[$(date '+%H:%M:%S')] Starting Next.js dev server..." >> dev.log
  
  NODE_OPTIONS='--max-old-space-size=3072' node node_modules/.bin/next dev -p 3000 >> dev.log 2>&1
  EXIT_CODE=$?
  
  echo "[$(date '+%H:%M:%S')] Server exited with code $EXIT_CODE, restarting in 3s..." >> dev.log
  sleep 3
done