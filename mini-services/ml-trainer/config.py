"""
Configuration constants for ML Trainer service.
"""

import os
from pathlib import Path

# Directories
BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

# Feature engineering parameters
MIN_CANDLES = 120
FORWARD_DAYS = 1  # Changed from 5 to 1 for better R² performance (1-day forward return is more predictable)
VOLATILITY_WINDOW = 10
DIRECTION_THRESHOLD = 0.005  # 0.5%
PREDICTION_STEPS = 5

# Cross-validation parameters
TS_CV_N_SPLITS = 5
RANDOM_SEED = 42

# Model training parameters
N_ITER_RANDOM_SEARCH = 20  # For RandomizedSearchCV
CV_SCORING_CLASSIFICATION = 'f1_weighted'
CV_SCORING_REGRESSION = 'neg_mean_absolute_error'

# Feature engineering - technical indicators to compute
FEATURE_PERIODS = {
    'returns': [1, 3, 5, 10, 20],
    'rolling_stats': [5, 10, 20, 60],
    'rsi': [14],
    'macd': [12, 26, 9],
    'stochastic': [14, 3, 3],
    'cci': [20],
    'atr': [14],
    'adx': [14],
    'bbands': [20],
    'volume': [20],
    'momentum': [10],
    'obv': [],
    'price_patterns': [10],
    'lag_features': [1, 2, 3, 4, 5]
}

# Model catalog - expanded to 16+ models + ensembles
CLASSIFICATION_MODELS = [
    'logistic_regression',
    'linear_svc',
    'lda',
    'qda',
    'random_forest_classifier',
    'extra_trees_classifier',
    'gradient_boosting_classifier',
    'hist_gradient_boosting_classifier',
    'xgb_classifier',
    'lightgbm_classifier',
    'catboost_classifier',
    'ada_boost_classifier',
    'k_neighbors_classifier',
    'svc',
    'mlp_classifier'
]

REGRESSION_MODELS = [
    'bayesian_ridge',
    'ridge',
    'lasso',
    'elastic_net',
    'huber_regressor',
    'random_forest_regressor',
    'extra_trees_regressor',
    'hist_gradient_boosting_regressor',
    'gradient_boosting_regressor',
    'xgb_regressor',
    'lightgbm_regressor',
    'catboost_regressor',
    'svr',
    'k_neighbors_regressor',
    'mlp_regressor'
]

# Ensemble models
ENSEMBLE_MODELS = [
    'voting_classifier',
    'voting_regressor',
    'stacking_classifier',
    'stacking_regressor'
]

# Baseline models
BASELINE_MODELS = [
    'naive_last',
    'drift',
    'rolling_mean',
    'seasonal_naive'
]

# All model types (for backward compatibility)
MODEL_TYPES = (
    CLASSIFICATION_MODELS + 
    REGRESSION_MODELS + 
    ENSEMBLE_MODELS +
    BASELINE_MODELS
)

# Multi-target configurations
TARGET_CONFIGS = {
    'binary_direction': {
        'description': 'Binary: 1 if forward return > threshold, else 0',
        'type': 'classification',
        'classes': [0, 1],
        'n_classes': 2
    },
    'ternary_direction': {
        'description': 'Three-class: down/flat/up based on return thresholds',
        'type': 'classification',
        'classes': [-1, 0, 1],
        'n_classes': 3
    },
    'log_return': {
        'description': 'Log returns for regression',
        'type': 'regression'
    },
    'volatility_class': {
        'description': 'Volatility regime: low/medium/high',
        'type': 'classification',
        'classes': [0, 1, 2],
        'n_classes': 3
    }
}

# HTTP server configuration
PORT = int(os.environ.get("ML_TRAINER_PORT", 3032))
HOST = "0.0.0.0"

# Logging configuration
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
LOG_LEVEL = "INFO"