#!/bin/bash
cd /home/z/my-project/mini-services/ml-prediction-service

while true; do
  # Check if port 3032 is already in use
  if command -v lsof &>/dev/null && lsof -ti:3032 &>/dev/null; then
    echo "[ML-Service] Port 3032 already in use, waiting..."
    sleep 30
    continue
  fi
  echo "[ML-Service] Starting ML Prediction Service on port 3032..."
  python3 -u app.py 2>&1
  echo "[ML-Service] [RESTART ML] $(date)"
  sleep 10
  # After restart, wait for port to be freed
  for i in $(seq 1 5); do
    if ! command -v lsof &>/dev/null || ! lsof -ti:3032 &>/dev/null; then
      break
    fi
    sleep 2
  done
done
