"""
Configuration for ML Trainer tasks and model training.

Contains target configurations for different prediction tasks:
- binary_direction: Two-class classification (up/down)
- ternary_direction: Three-class classification (up/flat/down) 
- log_return: Regression task predicting log returns
- volatility_class: Three-class classification (high/medium/low)
"""

from typing import Dict, Any

# ────────────────────────────────────────────────────────────────────────────
# Target Configurations
# ────────────────────────────────────────────────────────────────────────────

TARGET_CONFIGS: Dict[str, Dict[str, Any]] = {
    # Binary classification: Predict if price will go up or down
    "binary_direction": {
        "type": "classification",
        "n_classes": 2,
        "target": "up_or_down",  # Price movement direction
        "description": "Predict whether price will increase or decrease"
    },
    
    # Ternary classification: Predict up/flat/down
    "ternary_direction": {
        "type": "classification", 
        "n_classes": 3,
        "target": "up_flat_down",
        "description": "Predict price movement: up, flat, or down"
    },
    
    # Regression: Predict future log returns
    "log_return": {
        "type": "regression",
        "target": "log_return",
        "description": "Predict future log returns (continuous value)",
        "output_transform": "exp"  # Convert back to price ratio
    },
    
    # Classification: Market volatility levels
    "volatility_class": {
        "type": "classification",
        "n_classes": 3,
        "target": "high_medium_low_volatility",
        "description": "Classify market volatility as high, medium, or low"
    }
}

# Additional configuration constants
MODELS_DIR = "models"
MIN_CANDLES = 50  # Minimum candles required for training

# Model configuration
CLASSIFICATION_MODELS = ["random_forest_classifier", "gradient_boosting_classifier", 
                         "logistic_regression", "svm_classifier", "decision_tree_classifier",
                         "knn_classifier", "neural_network_classifier", "naive_bayes_classifier",
                         "xgboost_classifier", "lightgbm_classifier", "adaboost_classifier",
                         "bagging_classifier", "extra_trees_classifier", "radius_neighbors_classifier",
                         "gaussian_naive_bayes", "bernoulli_nb", "complement_nb", "quadratic_discriminant_analysis",
                         "lda_classifier", "qda_classifier", "mlp_classifier"]

REGRESSION_MODELS = ["random_forest_regressor", "gradient_boosting_regressor", 
                    "linear_regression", "svm_regressor", "decision_tree_regressor",
                    "knn_regressor", "neural_network_regressor", "arima_regressor",
                    "prophet_regressor", "xgboost_regressor", "lightgbm_regressor", 
                    "adaboost_regressor", "bagging_regressor", "extra_trees_regressor",
                    "ransac_regressor", "huber_regressor", "quantile_regressor",
                    "theil_sen_regressor", "elastic_net", "lasso_regression", 
                    "ridge_regression", "bayesian_ridge"]

ENSEMBLE_MODELS = [
    "voting_classifier", "voting_regressor", 
    "stacking_classifier", "stacking_regressor",
    "bagging_classifier", "bagging_regressor",
    "adaboost_classifier", "adaboost_regressor"
]

# Time series validation parameters
DEFAULT_CV_SPLITS = 5
MIN_TRAIN_SIZE = 70
MAX_TEST_SIZE = 20

# Feature engineering parameters
HURST_MIN_DATA_POINTS = 20
REALIZED_VOLATILITY_WINDOWS = [10, 20, 50]
FEATURE_COMPUTATION_THREADS = 4

# Model persistence
DEFAULT_MODEL_VERSION = "1.0"
MAX_MODELS_PER_SYMBOL = 10