#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Data Update Scheduler - Continuous Service
# Runs every 115 minutes to refresh all price data
# ═══════════════════════════════════════════════════════════════════

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

LOG_FILE="$PROJECT_DIR/data-update-scheduler.log"
PID_FILE="$PROJECT_DIR/data-update-scheduler.pid"
INTERVAL_MINUTES=115

echo "=========================================="
echo "  Data Update Scheduler"
echo "  Interval: ${INTERVAL_MINUTES} minutes"
echo "  Project: $PROJECT_DIR"
echo "=========================================="

# Create log directory if needed
mkdir -p "$PROJECT_DIR/db"

# Function to run a single update cycle
run_update_cycle() {
    echo "$(date -Iseconds) === Starting data update cycle ===" >> "$LOG_FILE"
    
    # Update TSE stocks
    echo "$(date -Iseconds) Updating TSE stocks..." >> "$LOG_FILE"
    npx tsx scripts/data-update-scheduler.ts --once >> "$LOG_FILE" 2>&1
    
    echo "$(date -Iseconds) === Update cycle complete ===" >> "$LOG_FILE"
}

# Main loop
while true; do
    run_update_cycle
    
    # Sleep for 115 minutes
    sleep $((INTERVAL_MINUTES * 60))
done