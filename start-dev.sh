#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS='--max-old-space-size=1024' npx next dev -p 3000 2>&1 | tee -a /home/z/my-project/dev.log
  echo "[RESTART] $(date)" >> /home/z/my-project/dev.log
  sleep 3
done
