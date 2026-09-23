# ML Trainer Service — Scientific Machine Learning Module

## Overview

The ML Trainer is a multi-model machine learning service for financial time series prediction. It provides a comprehensive, scientifically rigorous framework for training, evaluating, and deploying ML models on OHLCV data.

## Architecture

The service consists of the following modular components:

- `config.py` — Configuration constants and model catalog definitions
- `feature_engineering.py` — Enhanced feature engineering (40+ original + 12+ new features)
- `model_catalog.py` — Model builders for 16+ classification models + 16+ regression models + 4 ensembles
- `baselines.py` — Baseline models (NaiveLast, Drift, RollingMean, SeasonalNaive)
- `evaluation.py` — Comprehensive metrics, confusion matrix, and feature importance analysis
- `index.py` — Main training service with HTTP API

## Scientific Features

### 1. Data Leakage Prevention

- `TimeSeriesSplit` is used exclusively for cross-validation
- No `train_test_split(shuffle=True)` is used
- `StandardScaler` is fitted only on training folds
- All features are computed using historical data only (no forward-looking windows)

### 2. Multi-Target Support

The trainer supports four target configurations:

- `binary_direction` — Binary classification (up/down)
- `ternary_direction` — Three-class classification (up/down/flat)
- `log_return` — Log-return regression
- `volatility_class` — Volatility regime classification

### 3. Comprehensive Metrics

For classification models, the trainer computes:

- Confusion matrix (2x2 or 3x3)
- Per-class precision, recall, f1-score, support, TPR, FPR
- Macro and weighted averages
- ROC AUC, PR AUC, log loss, Brier score, Cohen's Kappa, Matthews Correlation Coefficient
- Calibration curve data
- Classification report

For regression models, the trainer computes:

- R², adjusted R², RMSE, MAE, MAPE, MBE, MSLE, MedianAE
- Explained variance
- Residual statistics (mean, std, skew, kurtosis, Jarque-Bera p-value)
- Prediction intervals (bootstrap)

### 4. Feature Analysis

- Per-model feature importance (tree-based, coefficient-based, or permutation)
- Stable features (top-10 across 80% of folds)
- Permutation importance as independent verification
- Correlation matrix and VIF analysis

### 5. Hyperparameter Tuning

- `RandomizedSearchCV` with `TimeSeriesSplit` for systematic hyperparameter tuning
- Early stopping support for XGBoost, LightGBM, and CatBoost
- Different search spaces per model family

### 6. Ensemble Models

- VotingClassifier/VotingRegressor (statistical ensemble)
- StackingClassifier/StackingRegressor (with Ridge meta-learner)
- Weighted ensemble based on R²/MAE/Directional-Accuracy

### 7. Model Persistence

- Models are saved as ONNX (preferred) with pickle fallback
- Metadata includes: metrics, confusion matrix, feature importance, config, stable features
- Scaler is saved separately and loaded for prediction

## API Endpoints

### `POST /train`

Trains requested models for a symbol.

```json
{
  "symbol": "AAPL",
  "ohlcv": [[...]],
  "models": ["random_forest_classifier", "xgb_classifier"]
}
```

### `POST /predict`

Generates multi-session predictions for a symbol.

```json
{
  "symbol": "AAPL",
  "ohlcv": [[...]],
  "horizon": 30
}
```

### `GET /models`

Lists all trained models across all symbols.

### `GET /models/{symbol}`

Gets all trained models for a specific symbol.

### `POST /retrain-all`

Retrains models for all symbols.

```json
{
  "ohlcv_data": {
    "AAPL": [[...]],
    "MSFT": [[...]]
  }
}
```

### `GET /metrics`

Returns evaluation metrics for a symbol.

```
GET /metrics?symbol=AAPL
```

### `GET /evaluate`

Returns evaluation metrics and model comparison for a symbol.

```
GET /evaluate?symbol=AAPL
```

### `GET /health`

Health check.

## Requirements

See `requirements.txt` for the complete list of dependencies.

## Tests

Run the unit tests with:

```bash
pytest tests/unit/test_ml_trainer.py -v
```

## Scientific Validation

The trainer implements the following scientific practices:

- Out-of-sample evaluation through TimeSeriesSplit
- Per-fold metrics (mean/std) instead of single-point estimates
- Confusion matrix computed on out-of-sample predictions
- Calibration analysis for probabilistic predictions
- Prediction intervals based on residual distribution
- Feature selection and stability analysis
- Warning flags for negative R², class imbalance, and missing values
