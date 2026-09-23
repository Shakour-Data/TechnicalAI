"""
Configuration constants for Time Series Analysis service.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).parent

# HTTP server configuration
PORT = int(os.environ.get("TS_ANALYSIS_PORT", 3033))
HOST = "0.0.0.0"

# Logging configuration
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
LOG_LEVEL = "INFO"

# Data requirements
MIN_CANDLES = 30  # Minimum number of candles required for analysis
MAX_CANDLES = 5000  # Maximum number of candles to process

# Analysis windows
SHORT_WINDOW = 20
MEDIUM_WINDOW = 50
LONG_WINDOW = 200

# Forecast horizon
FORECAST_STEPS = 14  # Default forecast steps (2 trading weeks)

# Statistical significance levels
ALPHA = 0.05

# Forecast intervals
DEFAULT_CONFIDENCE = 0.95

# Model catalog
FORECAST_MODELS = [
    "naive_last",
    "seasonal_naive",
    "moving_average",
    "exponential_smoothing",
    "arima",
    "sarima",
    "holt_winters",
    "ets",
]

# Analysis types
ANALYSIS_TYPES = [
    "basic",
    "decomposition",
    "stationarity",
    "autocorrelation",
    "forecasting",
    "anomaly_detection",
    "all",
]

# Seasonal periods (daily data typical)
DAILY_SEASONALITY = 7
WEEKLY_SEASONALITY = 52
