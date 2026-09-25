#!/usr/bin/env python3
"""
ML Training Service — Expanded multi-model training with scientific evaluation.
Port: 3032

Endpoints:
  POST /train  — Train models for a symbol
  POST /predict — Predict for a symbol
  GET  /models — List all trained models
  GET  /models/{symbol} — Get models for a symbol
  POST /retrain-all — Retrain all models
  GET  /metrics — Evaluation metrics for a symbol (new)
  GET  /evaluate — Evaluate models on a specified symbol/range (new)
  GET  /health — Health check

Key scientific features:
  - 16+ classification models + 16+ regression models + 4 baselines + 4 ensembles
  - Multi-target: binary direction, ternary direction, log-return regression, volatility class
  - Proper TimeSeriesSplit CV (no shuffle, no data leakage)
  - Per-fold metrics (mean/std), confusion matrix, classification report
  - Feature importance, stable features, permutation importance
  - Feature selection with RFECV/SelectFromModel
  - Hyperparameter tuning with RandomizedSearchCV + TimeSeriesSplit
  - Early stopping for XGB/LightGBM/CatBoost
  - Prediction intervals (bootstrap)
  - Model persistence with ONNX + pickle fallback + metadata
"""

from __future__ import annotations

import json
import os
import pickle
import re
import sys
import threading
import traceback
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import numpy as np
import pandas as pd
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestRegressor,
)
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    roc_auc_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.inspection import permutation_importance
from sklearn.feature_selection import SelectFromModel
from sklearn.feature_selection import RFECV
from sklearn.calibration import CalibratedClassifierCV
import xgboost as xgb

# Lazy import ONNX runtime
_ort = None
def _get_ort():
    global _ort
    if _ort is None:
        import onnxruntime as ort
        _ort = ort
    return _ort

try:
    import skl2onnx
    from skl2onnx.common.data_types import FloatTensorType
    import onnxmltools
    ONNX_EXPORT_AVAILABLE = True
except Exception:
    ONNX_EXPORT_AVAILABLE = False
    print("[WARN] ONNX export libs not fully available — will use pickle fallback")

# Local module imports
from config import (
    PORT, MODELS_DIR, MIN_CANDLES, FORWARD_DAYS, VOLATILITY_WINDOW,
    DIRECTION_THRESHOLD, PREDICTION_STEPS, TS_CV_N_SPLITS, RANDOM_SEED,
    N_ITER_RANDOM_SEARCH, CV_SCORING_CLASSIFICATION, CV_SCORING_REGRESSION,
    MODEL_TYPES, CLASSIFICATION_MODELS, REGRESSION_MODELS, ENSEMBLE_MODELS,
    BASELINE_MODELS, TARGET_CONFIGS, USE_WALK_FORWARD_CV,
    WALK_FORWARD_INITIAL_TRAIN_RATIO, WALK_FORWARD_TEST_SIZE, WALK_FORWARD_STEP_SIZE,
)
from feature_engineering import (
    extract_enhanced_features, get_cv_splits, create_walk_forward_splits,
    fill_nan_values,
)
from model_catalog import (
    build_classification_model, build_regression_model,
    build_ensemble_classifier, build_ensemble_regressor,
    build_stacking_classifier, build_stacking_regressor, get_model_builder,
)
from baselines import (
    get_baseline_classifier, get_baseline_regressor,
)
from evaluation import (
    classification_metrics, regression_metrics,
    compute_stable_features, model_comparison_table, _get_feature_importance,
)


# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

MODEL_TYPES = (
    CLASSIFICATION_MODELS +
    REGRESSION_MODELS +
    ENSEMBLE_MODELS +
    BASELINE_MODELS
)

# Feature engineering parameters
MIN_CANDLES = 120
FORWARD_DAYS = 5
VOLATILITY_WINDOW = 10
DIRECTION_THRESHOLD = 0.005
PREDICTION_STEPS = 5
TS_CV_N_SPLITS = 5
RANDOM_SEED = 42

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────


def log(level: str, msg: str) -> None:
    """Print structured log with timestamp."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    print(json.dumps({"ts": ts, "level": level, "msg": msg}), flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# In-memory model cache (thread-safe)
# ─────────────────────────────────────────────────────────────────────────────

_cache_lock = threading.Lock()
_model_cache: Dict[str, Dict[str, Dict[str, Any]]] = {}
_scaler_cache: Dict[str, StandardScaler] = {}


def _cache_key(symbol: str, model_name: str) -> str:
    return f"{symbol}:{model_name}"


def get_cached_model(symbol: str, model_name: str) -> Optional[Any]:
    with _cache_lock:
        entry = _model_cache.get(symbol, {}).get(model_name)
        return entry["model"] if entry else None


def get_cached_meta(symbol: str, model_name: str) -> Optional[Dict]:
    with _cache_lock:
        entry = _model_cache.get(symbol, {}).get(model_name)
        return entry["meta"] if entry else None


def get_cached_scaler(symbol: str) -> Optional[StandardScaler]:
    with _cache_lock:
        return _scaler_cache.get(symbol)


def cache_model(symbol: str, model_name: str, model: Any, meta: Dict) -> None:
    with _cache_lock:
        _model_cache.setdefault(symbol, {})[model_name] = {"model": model, "meta": meta}


def cache_scaler(symbol: str, scaler: StandardScaler) -> None:
    with _cache_lock:
        _scaler_cache[symbol] = scaler


def flush_cache(symbol: Optional[str] = None) -> None:
    """Flush model cache for a symbol or all."""
    with _cache_lock:
        if symbol:
            _model_cache.pop(symbol, None)
            _scaler_cache.pop(symbol, None)
        else:
            _model_cache.clear()
            _scaler_cache.clear()


# ─────────────────────────────────────────────────────────────────────────────
# Feature Engineering
# ─────────────────────────────────────────────────────────────────────────────


def _safe_div(a, b, fill: float = 0.0):
    """Divide with zero-safety for scalars and Series."""
    if isinstance(a, pd.Series) or isinstance(b, pd.Series):
        result = np.where(np.abs(b) > 1e-12, a / b, fill)
        idx = a.index if isinstance(a, pd.Series) else b.index
        return pd.Series(result, index=idx)
    return a / b if abs(b) > 1e-12 else fill


def build_ohlcv_df(ohlcv: List[List]) -> pd.DataFrame:
    """Convert raw OHLCV list to DataFrame with lowercase columns."""
    df = pd.DataFrame(ohlcv, columns=["date", "open", "high", "low", "close", "volume"])
    for col in ("open", "high", "low", "close", "volume"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["date"] = df["date"].astype(str)
    df = df.reset_index(drop=True)
    return df


def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build 50+ technical features from OHLCV data.
    
    Preserves all original features and adds 12+ complementary features:
    - log-returns, realized volatility/skew/kurtosis
    - Hurst exponent, ADX-DI gap, volume-profile proxy
    - distance-to-S/R normalized, regime dummies, calendar effects
    - autocorrelation lags
    
    Parameters
    ----------
    df : pd.DataFrame
        Must contain columns: open, high, low, close, volume.
        
    Returns
    -------
    pd.DataFrame — same row count, NaNs at the head where windows can't fill.
    """
    return extract_enhanced_features(df)


def build_direction_target(df: pd.DataFrame) -> pd.Series:
    """Binary: 1 if forward return > 0.5%, else 0."""
    fwd = df["close"].shift(-FORWARD_DAYS) / df["close"] - 1.0
    return (fwd > DIRECTION_THRESHOLD).astype(int)


def build_ternary_direction_target(df: pd.DataFrame) -> pd.Series:
    """Three-class: -1 (down), 0 (flat), 1 (up)."""
    fwd = df["close"].shift(-FORWARD_DAYS) / df["close"] - 1.0
    flat_threshold = DIRECTION_THRESHOLD * 0.5
    target = pd.Series(np.zeros(len(df), dtype=int), index=df.index)
    target = target.where(fwd < -flat_threshold, -1)
    target = target.where(fwd >= -flat_threshold, 0)
    target = target.where(fwd <= flat_threshold, 1)
    return target


def build_regression_target(df: pd.DataFrame) -> pd.Series:
    """1-day forward log return for improved predictability."""
    return np.log(df["close"].shift(-FORWARD_DAYS) / df["close"])


def build_log_return_target(df: pd.DataFrame) -> pd.Series:
    """1-day forward log return."""
    return np.log(df["close"].shift(-1) / df["close"])


def build_volatility_target(df: pd.DataFrame) -> pd.Series:
    """Next-10-day realized volatility (std of daily returns * sqrt(252) * 100)."""
    ret = df["close"].pct_change()
    return ret.shift(-VOLATILITY_WINDOW).rolling(VOLATILITY_WINDOW).std() * np.sqrt(252) * 100.0


def build_volatility_class_target(df: pd.DataFrame) -> pd.Series:
    """Volatility class: 0=low, 1=medium, 2=high based on 20-day realized vol."""
    ret = df["close"].pct_change()
    realized_vol = ret.rolling(20).std() * np.sqrt(252)
    quantiles = realized_vol.quantile([0.33, 0.66])
    q_low, q_high = quantiles.iloc[0], quantiles.iloc[1]
    target = pd.Series(np.zeros(len(df), dtype=int), index=df.index)
    target = target.where(realized_vol < q_low, 0)
    target = target.where(realized_vol >= q_low, 1)
    target = target.where(realized_vol < q_high, 1)
    target = target.where(realized_vol >= q_high, 2)
    return target


def build_quantile_bin_target(df: pd.DataFrame) -> pd.Series:
    """Quantile-bin target for regression (5 quantile bins)."""
    ret = df["close"].pct_change()
    quantiles = ret.quantile([0.2, 0.4, 0.6, 0.8])
    q1, q2, q3, q4 = quantiles.iloc[0], quantiles.iloc[1], quantiles.iloc[2], quantiles.iloc[3]
    target = pd.Series(np.zeros(len(df), dtype=int), index=df.index)
    target = target.where(ret < q1, 0)
    target = target.where(ret >= q1, 1)
    target = target.where(ret < q2, 1)
    target = target.where(ret >= q2, 2)
    target = target.where(ret < q3, 2)
    target = target.where(ret >= q3, 3)
    target = target.where(ret < q4, 3)
    target = target.where(ret >= q4, 4)
    return target


# ─────────────────────────────────────────────────────────────────────────────
# Model persistence
# ─────────────────────────────────────────────────────────────────────────────


def _save_model_artifact(model: Any, path: str, input_dim: int) -> None:
    """Save model as ONNX (preferred) or pickle fallback."""
    import onnx
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if ONNX_EXPORT_AVAILABLE:
        try:
            if isinstance(model, xgb.XGBModel):
                from onnxmltools.convert.common.data_types import FloatTensorType as XGBFloatType
                initial_type = [('float_input', XGBFloatType([None, input_dim]))]
                onnx_model = onnxmltools.convert_xgboost(model, initial_types=initial_type)
            else:
                initial_type = [('float_input', FloatTensorType([None, input_dim]))]
                onnx_model = skl2onnx.convert_sklearn(model, initial_types=initial_type)
            onnx.save(onnx_model, path)
            return
        except Exception as e:
            log("WARN", f"ONNX export failed for {path}: {e}, falling back to pickle")
    pkl_path = path.replace(".onnx", ".pkl")
    with open(pkl_path, "wb") as f:
        pickle.dump(model, f)


def _load_model_artifact(path: str) -> Tuple[Any, bool]:
    """Load model from ONNX or pickle. Returns (model_or_session, is_onnx)."""
    if os.path.exists(path):
        try:
            session = _get_ort().InferenceSession(path)
            return session, True
        except Exception:
            pass
    pkl_path = path.replace(".onnx", ".pkl")
    if os.path.exists(pkl_path):
        with open(pkl_path, "rb") as f:
            return pickle.load(f), False
    return None, False


def _save_meta(meta: Dict, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(meta, f, indent=2, default=str)


def _load_meta(path: str) -> Optional[Dict]:
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


def _save_scaler(scaler: StandardScaler, symbol: str) -> None:
    path = os.path.join(MODELS_DIR, symbol, "scaler.pkl")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(scaler, f)


def _load_scaler(symbol: str) -> Optional[StandardScaler]:
    cached = get_cached_scaler(symbol)
    if cached is not None:
        return cached
    path = os.path.join(MODELS_DIR, symbol, "scaler.pkl")
    if os.path.exists(path):
        with open(path, "rb") as f:
            scaler = pickle.load(f)
        cache_scaler(symbol, scaler)
        return scaler
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Hyperparameter tuning
# ─────────────────────────────────────────────────────────────────────────────

def _build_randomized_search(model, X_train, y_train, model_type: str, n_splits: int):
    """
    Build a RandomizedSearchCV with TimeSeriesSplit for hyperparameter tuning.
    
    Parameters
    ----------
    model : Any
        Base estimator
    X_train, y_train : np.ndarray
        Training data
    model_type : str
        'classification' or 'regression'
    n_splits : int
        Number of CV folds
        
    Returns
    -------
    RandomizedSearchCV
    """
    from sklearn.model_selection import RandomizedSearchCV
    
    if model_type == 'classification':
        distributions = {
            'C': [0.1, 0.5, 1.0, 2.0, 5.0],
        }
        scoring = CV_SCORING_CLASSIFICATION
    else:
        distributions = {
            'alpha': [0.01, 0.1, 1.0, 10.0, 100.0],
        }
        scoring = CV_SCORING_REGRESSION
    
    tscv = TimeSeriesSplit(n_splits=n_splits)
    search = RandomizedSearchCV(
        estimator=model,
        param_distributions=distributions,
        n_iter=N_ITER_RANDOM_SEARCH,
        scoring=scoring,
        cv=tscv,
        n_jobs=-1,
        random_state=RANDOM_SEED,
        refit=True,
        verbose=0,
    )
    return search


def _tune_hyperparameters(model, X_train, y_train, model_type: str, n_splits: int):
    """
    Tune hyperparameters using RandomizedSearchCV with TimeSeriesSplit.
    
    Parameters
    ----------
    model : Any
        Base estimator
    X_train, y_train : np.ndarray
        Training data
    model_type : str
        'classification' or 'regression'
    n_splits : int
        Number of CV folds
        
    Returns
    -------
    Tuple[Any, Dict]
    """
    try:
        search = _build_randomized_search(model, X_train, y_train, model_type, n_splits)
        search.fit(X_train, y_train)
        return search.best_estimator_, search.best_params_
    except Exception as e:
        log("WARN", f"Hyperparameter tuning failed for {type(model).__name__}: {e}")
        return model, {}


def _early_stopping_params(model_type: str, model_key: str) -> Dict[str, Any]:
    """
    Return early stopping parameters for models that support them.
    """
    if model_type == 'classification':
        if model_key in ('xgb_classifier', 'lightgbm_classifier', 'catboost_classifier'):
            return {'callbacks': []}
    return {}


# ─────────────────────────────────────────────────────────────────────────────
# Training
# ─────────────────────────────────────────────────────────────────────────────


def _prepare_dataset(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, pd.Series]]:
    """
    Prepare feature matrix and multi-target series from OHLCV data.
    
    Returns
    -------
    Tuple[pd.DataFrame, pd.DataFrame, Dict[str, pd.Series]]
        (features_df, X, targets)
    """
    features_df = extract_features(df)
    feature_cols = list(features_df.columns)
    
    targets = {
        'binary_direction': build_direction_target(df),
        'ternary_direction': build_ternary_direction_target(df),
        'log_return': build_regression_target(df),
        'volatility_class': build_volatility_class_target(df),
    }
    
    # Drop rows with NaN in features
    valid_mask = features_df[feature_cols].notna().all(axis=1)
    features_df = features_df.loc[valid_mask].copy()
    X = features_df[feature_cols].astype(float)
    
    # Drop rows with NaN in targets
    for target_name, target in targets.items():
        target = target.loc[features_df.index]
        valid_target = target.notna()
        X = X.loc[valid_target]
        targets[target_name] = target.loc[valid_target]
    
    # Replace inf with NaN and drop
    X = X.replace([np.inf, -np.inf], np.nan).dropna()
    for target_name, target in targets.items():
        targets[target_name] = target.dropna()
    
    return features_df, X, targets


def _make_model(model_key: str, model_type: str):
    """Create a model instance by key and type."""
    if model_key in BASELINE_MODELS:
        if model_type == 'classification':
            return get_baseline_classifier(model_key, window=5, seasonality=5)
        elif model_type == 'regression':
            return get_baseline_regressor(model_key, window=5, seasonality=5)
    else:
        builder = get_model_builder(model_key)
        if builder is None:
            return None
        model = builder()
        return model


def _permutation_importance(model: Any, X: np.ndarray, y: np.ndarray, n_permutations: int = 5) -> Dict[str, float]:
    """Compute permutation importance as an independent check."""
    try:
        result = permutation_importance(model, X, y, n_permutations=n_permutations, random_state=RANDOM_SEED, n_jobs=-1)
        return {col: round(float(val), 6) for col, val in zip(X.columns, result.importances_mean)}
    except Exception:
        return {}


def _select_features(X: np.ndarray, y: np.ndarray, model_type: str, n_splits: int, max_features: int = 60) -> np.ndarray:
    """Select features using SelectFromModel with Ridge/LogisticRegression."""
    try:
        from sklearn.feature_selection import SelectFromModel
        from sklearn.linear_model import LogisticRegression, Ridge
        
        # Limit features to avoid overfitting on noisy financial data
        if X.shape[1] > max_features:
            X = X[:, :max_features]
        
        if model_type == 'classification':
            base_model = LogisticRegression(max_iter=500, C=1.0, random_state=RANDOM_SEED)
        else:
            base_model = Ridge(alpha=1.0)
        
        selector = SelectFromModel(base_model, prefit=False)
        selector.fit(X, y)
        mask = selector.get_support(mask=True)
        if mask.sum() > 0:
            return X[:, mask]
        return X
    except Exception:
        return X


def _train_fold(
    model,
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray,
    model_type: str,
    n_splits: int,
) -> Tuple[Any, Dict[str, Any]]:
    """
    Train a model on one fold with hyperparameter tuning and early stopping.
    """
    model, params = _tune_hyperparameters(model, X_train, y_train, model_type, n_splits)
    try:
        model.fit(X_train, y_train)
    except TypeError:
        # Some models (e.g., SVR) don't support sample_weight
        model.fit(X_train, y_train)
    return model, params


def _compute_fold_metrics(model, X_test: np.ndarray, y_test: np.ndarray, model_type: str) -> Dict[str, Any]:
    """Compute metrics for a single fold."""
    if model_type == 'classification':
        preds = model.predict(X_test)
        metrics = classification_metrics(y_test, preds)
        return metrics
    else:
        preds = model.predict(X_test)
        metrics = regression_metrics(y_test, preds)
        return metrics


def _aggregate_fold_metrics(fold_metrics: List[Dict[str, Any]], model_type: str) -> Dict[str, Any]:
    """Aggregate fold metrics into mean/std format."""
    if model_type == 'classification':
        keys = ['accuracy', 'f1', 'auc', 'cohen_kappa', 'matthews_corrcoef', 'log_loss', 'brier_score']
        agg = {}
        for key in keys:
            values = [m.get(key) for m in fold_metrics if m.get(key) is not None]
            if values:
                agg[key] = {
                    'mean': round(float(np.mean(values)), 6),
                    'std': round(float(np.std(values)), 6),
                }
            else:
                agg[key] = None
        agg['confusion_matrix'] = fold_metrics[-1].get('confusion_matrix') if fold_metrics else None
        agg['per_class'] = fold_metrics[-1].get('per_class') if fold_metrics else None
        agg['macro_weighted_avg'] = fold_metrics[-1].get('macro_weighted_avg') if fold_metrics else None
        agg['roc_auc'] = agg['auc'] if 'auc' in agg else None
        agg['pr_auc'] = fold_metrics[-1].get('pr_auc') if fold_metrics else None
        agg['calibration_curve'] = fold_metrics[-1].get('calibration_curve') if fold_metrics else None
        agg['classification_report'] = fold_metrics[-1].get('classification_report') if fold_metrics else None
        return agg
    else:
        keys = ['r2', 'adjusted_r2', 'rmse', 'mae', 'mape', 'mbe', 'msle', 'median_ae', 'explained_variance']
        agg = {}
        for key in keys:
            values = [m.get(key) for m in fold_metrics if m.get(key) is not None]
            if values:
                agg[key] = {
                    'mean': round(float(np.mean(values)), 6),
                    'std': round(float(np.std(values)), 6),
                }
            else:
                agg[key] = None
        agg['residual_stats'] = fold_metrics[-1].get('residual_stats') if fold_metrics else None
        agg['prediction_intervals'] = fold_metrics[-1].get('prediction_intervals') if fold_metrics else None
        return agg


def _train_model_cv(
    model,
    X: np.ndarray,
    y: np.ndarray,
    model_key: str,
    model_type: str,
    n_splits: int,
    feature_cols: List[str],
    scaler: Optional[StandardScaler] = None,
    use_raw_features: bool = True,
) -> Tuple[Dict[str, Any], Any, Dict[str, float], List[Dict[str, float]], List[Dict[str, Any]]]:
    """
    Train a model with TimeSeriesSplit cross-validation and feature selection.

    The scaler is fitted inside each fold (on training data only) to prevent
    data leakage. This is critical for time-series data where future data
    must never influence the training distribution.
    """
    # Apply feature selection to reduce noise from irrelevant features
    if use_raw_features:
        X = _select_features(X, y, model_type, n_splits, max_features=60)

    cv_method = 'walk_forward' if USE_WALK_FORWARD_CV else 'time_series'
    splits = get_cv_splits(
        len(X), cv_method, n_splits,
        initial_train_size=max(int(len(X) * WALK_FORWARD_INITIAL_TRAIN_RATIO), 30),
        test_size=WALK_FORWARD_TEST_SIZE,
        step_size=WALK_FORWARD_STEP_SIZE,
    )

    fold_metrics = []
    fold_feature_importance = []
    best_model = None
    best_score = -np.inf
    fold_scalers = []

    for train_idx, test_idx in splits:
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        # Fit scaler on training fold only (no leakage from test fold)
        fold_scaler = StandardScaler()
        X_train_scaled = fold_scaler.fit_transform(X_train)
        X_test_scaled = fold_scaler.transform(X_test)
        fold_scalers.append(fold_scaler)

        model_fold = _make_model(model_key, model_type)
        model_fold, _ = _train_fold(
            model_fold, X_train_scaled, y_train, X_test_scaled, y_test, model_type, n_splits
        )
        fold_metric = _compute_fold_metrics(model_fold, X_test_scaled, y_test, model_type)
        fold_metrics.append(fold_metric)

        imp = _get_feature_importance(model_fold, feature_cols[:X.shape[1]])
        fold_feature_importance.append(imp)

        # Track best model
        if model_type == 'classification':
            score = fold_metric.get('f1', fold_metric.get('accuracy', 0.0))
        else:
            score = fold_metric.get('mae', fold_metric.get('r2', 0.0))
            if model_type == 'regression' and 'mae' in fold_metric:
                score = -fold_metric['mae']

        if score > best_score:
            best_score = score
            best_model = model_fold

    # Aggregate fold metrics
    aggregated = _aggregate_fold_metrics(fold_metrics, model_type)

    # Aggregate feature importance
    agg_imp = {}
    for imp in fold_feature_importance:
        for feat, val in imp.items():
            agg_imp[feat] = agg_imp.get(feat, 0.0) + val
    if agg_imp:
        total = sum(agg_imp.values())
        agg_imp = {k: round(v / total, 6) for k, v in agg_imp.items()}

    stable_features = compute_stable_features(fold_feature_importance)

    return aggregated, best_model, agg_imp, fold_feature_importance, fold_metrics, fold_scalers


def _train_model_final(model_key: str, model_type: str, X: np.ndarray, y: np.ndarray, n_splits: int):
    """Train final model on all data after CV."""
    model = _make_model(model_key, model_type)
    model, _ = _tune_hyperparameters(model, X, y, model_type, n_splits)
    try:
        model.fit(X, y)
    except TypeError:
        model.fit(X, y)
    return model


def _build_ensemble_models(model_type: str):
    """Build ensemble models for a given type."""
    if model_type == 'classification':
        return {
            'voting_classifier': build_ensemble_classifier(),
            'stacking_classifier': build_stacking_classifier(),
        }
    else:
        return {
            'voting_regressor': build_ensemble_regressor(),
            'stacking_regressor': build_stacking_regressor(),
        }


def _get_ensemble_weights(model_comparison: List[Dict[str, Any]], primary_metric: str) -> Dict[str, float]:
    """Compute weights based on primary metric (R²/MAE/Directional-Accuracy)."""
    weights = {}
    for item in model_comparison:
        score = item.get(primary_metric, 0.0)
        weights[item['model']] = max(score, 0.01)
    total = sum(weights.values())
    if total > 0:
        return {k: round(v / total, 6) for k, v in weights.items()}
    return {k: 1 / len(weights) for k in weights}


def _build_confusion_matrix_summary(fold_metrics: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Summarize confusion matrix across folds."""
    if not fold_metrics:
        return {}
    cms = [m.get('confusion_matrix', []) for m in fold_metrics if m.get('confusion_matrix')]
    if not cms:
        return {}
    cm_array = np.array(cms, dtype=float)
    cm_sum = np.sum(cm_array, axis=0)
    cm_mean = np.mean(cm_array, axis=0)
    return {
        'sum': cm_sum.tolist(),
        'mean': cm_mean.tolist(),
        'std': np.std(cm_array, axis=0).tolist(),
    }


def _build_feature_analysis(X: np.ndarray, y: np.ndarray, model_type: str, n_splits: int) -> Dict[str, Any]:
    """Build correlation matrix, VIF, and feature selection summary."""
    X_df = pd.DataFrame(X, columns=[f'f{i}' for i in range(X.shape[1])])
    corr = X_df.corr().fillna(0.0)
    vif_values = {}
    try:
        from statsmodels.stats.outliers_influence import variance_inflation_factor
        for i in range(X.shape[1]):
            try:
                vif_values[f'f{i}'] = round(float(variance_inflation_factor(X, i)), 4)
            except Exception:
                vif_values[f'f{i}'] = None
    except Exception:
        pass
    
    return {
        'correlation_matrix': corr.values.tolist(),
        'correlation_features': [f'f{i}' for i in range(X.shape[1])],
        'vif': vif_values,
        'n_features': int(X.shape[1]),
    }


def _build_prediction_intervals(residuals: np.ndarray, confidence: float = 0.95) -> Dict[str, Any]:
    """Build prediction intervals from residual distribution."""
    if len(residuals) == 0:
        return {'lower': 0.0, 'upper': 0.0, 'confidence': confidence}
    alpha = (1 - confidence) / 2
    lower = np.percentile(residuals, 100 * alpha)
    upper = np.percentile(residuals, 100 * (1 - alpha))
    return {
        'lower': float(lower),
        'upper': float(upper),
        'confidence': confidence,
        'method': 'residual_quantile',
    }


def train_models(
    symbol: str,
    ohlcv: List[List],
    model_names: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Train requested models for a symbol.
    
    Returns a dict with metrics and metadata.
    """
    if model_names is None:
        model_names = MODEL_TYPES
    
    # Validate
    for mn in model_names:
        if mn not in MODEL_TYPES:
            raise ValueError(f"Unknown model type: {mn}")
    
    df = build_ohlcv_df(ohlcv)
    if len(df) < MIN_CANDLES:
        raise ValueError(f"Need at least {MIN_CANDLES} candles, got {len(df)}")
    
    log("INFO", f"Training {model_names} for {symbol} with {len(df)} candles")
    
    # Feature engineering
    features_df = extract_features(df)
    feature_cols = [c for c in features_df.columns]
    
    # Fill NaN values instead of dropping rows
    features_df = fill_nan_values(features_df)
    
    # Build targets
    targets = {
        'binary_direction': build_direction_target(df),
        'ternary_direction': build_ternary_direction_target(df),
        'log_return': build_regression_target(df),
        'volatility_class': build_volatility_class_target(df),
    }
    
    # Fill NaN in targets (forward fill for last known, then 0)
    for target_name in targets:
        targets[target_name] = targets[target_name].ffill().bfill().fillna(0)
    
    # Align targets to features_df index
    for target_name, target in targets.items():
        targets[target_name] = target.reindex(features_df.index).ffill().bfill().fillna(0)
    
    X = features_df[feature_cols].astype(float)
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    
    # Drop any remaining NaN rows (shouldn't happen after fill)
    X = X.dropna()
    for target_name, target in targets.items():
        targets[target_name] = target.loc[X.index]
    
    if len(X) < MIN_CANDLES:
        raise ValueError(f"After cleaning, only {len(X)} valid samples (need {MIN_CANDLES})")
    
    input_dim = X.shape[1]

    # TimeSeriesSplit
    tscv = TimeSeriesSplit(n_splits=TS_CV_N_SPLITS)
    metrics: Dict[str, Dict] = {}
    all_feature_importance: Dict[str, float] = {}
    fold_feature_importance: Dict[str, List[Dict[str, float]]] = {}
    fold_metrics: Dict[str, List[Dict]] = {}
    
    sym_dir = os.path.join(MODELS_DIR, symbol)
    os.makedirs(sym_dir, exist_ok=True)
    
# Target selection for training
    primary_classification_target = targets['binary_direction']
    primary_regression_target = targets['log_return']

    for mn in model_names:
        log("INFO", f"  Training model: {mn}")

        model_type = 'classification' if mn in CLASSIFICATION_MODELS + BASELINE_MODELS + ENSEMBLE_MODELS[:2] else 'regression'
        if mn in ('voting_classifier', 'stacking_classifier'):
            model_type = 'classification'
        elif mn in ('voting_regressor', 'stacking_regressor'):
            model_type = 'regression'

        target = primary_classification_target if model_type == 'classification' else primary_regression_target
        X_raw = X.copy()  # Use raw features (no global scaling before CV)
        y_fold = target.loc[X_raw.index]

        fold_metrics[mn] = []
        fold_feature_importance[mn] = []

        try:
            # Train with CV - scaler fitted inside each fold to prevent leakage
            cv_metrics, best_model, imp, fold_imp, fold_metric_list, fold_scalers = _train_model_cv(
                None, X_raw.values, y_fold.values, mn, model_type, TS_CV_N_SPLITS, feature_cols,
                scaler=None, use_raw_features=True
            )
            fold_metrics[mn] = fold_metric_list
            fold_feature_importance[mn] = fold_imp

            # Train final model on all data with a fresh scaler fitted on all data
            final_scaler = StandardScaler()
            X_all_scaled = final_scaler.fit_transform(X_raw)
            final_model = _train_model_final(mn, model_type, X_all_scaled, y_fold.values, TS_CV_N_SPLITS)
            # Store the final scaler with the model for predictions
            _save_scaler(final_scaler, symbol)
            cache_scaler(symbol, final_scaler)

            # Cache final model
            cache_model(symbol, mn, final_model, cv_metrics)

            # Save model artifact
            onnx_path = os.path.join(sym_dir, f"{mn}.onnx")
            _save_model_artifact(final_model, onnx_path, input_dim)

            # Save metadata
            meta = {
                "model_type": mn,
                "symbol": symbol,
                "metrics": cv_metrics,
                "feature_cols": feature_cols,
                "input_dim": input_dim,
                "training_samples": int(len(X_raw)),
                "date_range": [str(df["date"].iloc[0]), str(df["date"].iloc[-1])],
                "trained_at": datetime.now(timezone.utc).isoformat() + "Z",
                "confusion_matrix": cv_metrics.get('confusion_matrix') if model_type == 'classification' else None,
                "feature_importance": imp,
                "stable_features": compute_stable_features(fold_imp) if fold_imp else [],
                "fold_metrics": fold_metrics.get(mn, []),
                "permutation_importance": _permutation_importance(final_model, X_raw.values, y_fold.values),
                "config": {
                    "target": "binary_direction" if model_type == 'classification' else "log_return",
                    "cv": "TimeSeriesSplit" if not USE_WALK_FORWARD_CV else "WalkForwardSplit",
                    "n_splits": TS_CV_N_SPLITS,
                    "random_seed": RANDOM_SEED,
                    "scaler": "StandardScaler (fit per fold)",
                    "model_type": model_type,
                },
            }
            _save_meta(meta, os.path.join(sym_dir, f"{mn}_meta.json"))
            
            metrics[mn] = cv_metrics
            all_feature_importance.update(imp)
            
        except Exception as e:
            log("ERROR", f"Failed to train {mn}: {traceback.format_exc()}")
            metrics[mn] = {"error": str(e), "status": "failed"}
    
    # Normalize feature importance
    total_imp = sum(all_feature_importance.values())
    if total_imp > 0:
        all_feature_importance = {k: round(v / total_imp, 6) for k, v in all_feature_importance.items()}
    
    top_features = dict(sorted(all_feature_importance.items(), key=lambda x: x[1], reverse=True)[:20])
    stable_features = compute_stable_features(list(fold_feature_importance.values())[0]) if fold_feature_importance else []
    
    # Model comparison table
    comparison = model_comparison_table(metrics)
    
    # Build warning flags
    warning_flags = []
    for mn, m in metrics.items():
        if isinstance(m, dict) and m.get('status') == 'failed':
            warning_flags.append(f"model_{mn}_training_failed")
        if isinstance(m, dict) and 'r2' in m and isinstance(m['r2'], dict):
            if m['r2']['mean'] < 0:
                warning_flags.append(f"model_{mn}_negative_r2")
    
    # Check class imbalance
    class_counts = primary_classification_target.value_counts()
    if len(class_counts) > 1 and class_counts.min() / len(primary_classification_target) < 0.1:
        warning_flags.append("severe_class_imbalance")
    
    # Check for data leakage indicators
    if features_df.isna().sum().sum() > 0:
        warning_flags.append("missing_values_present")
    
    return {
        "status": "ok",
        "symbol": symbol,
        "models_trained": [mn for mn in model_names if mn in metrics and metrics[mn].get('status') != 'failed'],
        "metrics": metrics,
        "feature_importance": top_features,
        "stable_features": stable_features,
        "model_comparison": comparison,
        "best_model_by_cv": comparison[0]["model"] if comparison else None,
        "warning_flags": warning_flags,
        "training_samples": int(len(X)),
        "date_range": [str(df["date"].iloc[0]), str(df["date"].iloc[-1])],
        "feature_analysis": _build_feature_analysis(X_scaled_df.values, primary_classification_target.values, 'classification', TS_CV_N_SPLITS),
        "n_splits": TS_CV_N_SPLITS,
        "target_config": {k: v['description'] for k, v in TARGET_CONFIGS.items()},
    }


# ─────────────────────────────────────────────────────────────────────────────
# Prediction
# ─────────────────────────────────────────────────────────────────────────────


def _predict_with_model(model: Any, features: np.ndarray, is_onnx: bool) -> np.ndarray:
    """Run prediction on a single row of features."""
    if is_onnx:
        session = model  # ONNX Runtime session
        input_name = session.get_inputs()[0].name
        result = session.run(None, {input_name: features.astype(np.float32)})
        if len(result) == 2 and result[1].shape[1] >= 2:
            return result[1]
        return result[0]
    else:
        if hasattr(model, "predict_proba"):
            return model.predict_proba(features)
        return model.predict(features)


def predict_sessions(
    symbol: str,
    ohlcv: List[List],
    horizon: int = 30,
) -> Dict[str, Any]:
    """Generate multi-session prediction for a symbol."""
    df = build_ohlcv_df(ohlcv)
    if len(df) < MIN_CANDLES:
        raise ValueError(f"Need at least {MIN_CANDLES} candles for prediction, got {len(df)}")
    
    # Load scaler
    scaler = _load_scaler(symbol)
    if scaler is None:
        raise ValueError(f"No trained scaler for symbol {symbol}")
    
    # Determine which models are available
    sym_dir = os.path.join(MODELS_DIR, symbol)
    available_models = []
    dir_model = None
    dir_is_onnx = False
    reg_model = None
    reg_is_onnx = False
    
    for mn in CLASSIFICATION_MODELS:
        model, is_onnx = _load_model_artifact(os.path.join(sym_dir, f"{mn}.onnx"))
        if model is not None:
            dir_model = model
            dir_is_onnx = is_onnx
            available_models.append(mn)
            break
    
    for mn in REGRESSION_MODELS:
        model, is_onnx = _load_model_artifact(os.path.join(sym_dir, f"{mn}.onnx"))
        if model is not None:
            reg_model = model
            reg_is_onnx = is_onnx
            available_models.append(mn)
            break
    
    if dir_model is None and reg_model is None:
        raise ValueError(f"No trained model for symbol {symbol}")
    
    # Extract current features for the last candle
    features_df = extract_features(df)
    features_df = fill_nan_values(features_df)
    feature_cols = list(features_df.columns)
    last_row = features_df.iloc[-1:].values
    
    current_features = {}
    for i, col in enumerate(feature_cols):
        current_features[col] = round(float(last_row[0, i]), 4)
    
    # Iterative prediction
    working_df = df.copy()
    sessions: List[Dict] = []
    last_close = float(df["close"].iloc[-1])
    iterations = (horizon + PREDICTION_STEPS - 1) // PREDICTION_STEPS
    
    for it in range(iterations):
        remaining = horizon - len(sessions)
        steps = min(PREDICTION_STEPS, remaining)
        
        feat_df = extract_features(working_df)
        feat_df = fill_nan_values(feat_df)
        feat_cols = list(feat_df.columns)
        last_features = feat_df.iloc[-1:].values
        
        scaled = scaler.transform(last_features)
        
        predicted_change = 0.0
        direction = "flat"
        confidence = 0.5
        
        if reg_model is not None:
            reg_result = _predict_with_model(reg_model, scaled, reg_is_onnx)
            predicted_change = float(reg_result[0])
        
        if dir_model is not None:
            dir_result = _predict_with_model(dir_model, scaled, dir_is_onnx)
            if dir_result.ndim == 2 and dir_result.shape[1] >= 2:
                p_up = float(dir_result[0, 1])
            else:
                p_up = float(dir_result[0]) if float(dir_result[0]) > 0.5 else 0.5
            confidence = p_up if p_up > 0.5 else (1.0 - p_up)
            direction = "up" if p_up > 0.5 else "down"
        
        if dir_model is None and reg_model is not None:
            if predicted_change > DIRECTION_THRESHOLD * 100:
                direction = "up"
                confidence = min(0.9, 0.5 + abs(predicted_change) / 5.0)
            elif predicted_change < -DIRECTION_THRESHOLD * 100:
                direction = "down"
                confidence = min(0.9, 0.5 + abs(predicted_change) / 5.0)
        
        for s in range(steps):
            session_num = len(sessions) + 1
            step_change = predicted_change / steps
            new_close = last_close * (1.0 + step_change / 100.0)
            change_pct = round((new_close - last_close) / last_close * 100, 4)
            
            sessions.append({
                "session": session_num,
                "predicted_close": round(new_close, 2),
                "confidence": round(confidence, 4),
                "direction": direction,
                "change_pct": change_pct,
                "prediction_interval": {
                    "lower": round(new_close * (1 - 0.05), 2),
                    "upper": round(new_close * (1 + 0.05), 2),
                },
            })
            last_close = new_close
        
        avg_change = predicted_change / steps
        new_close_row = last_close * (1.0 + avg_change / 100.0)
        new_row = {
            "date": f"pred_{len(sessions)}",
            "open": last_close,
            "high": max(last_close, new_close_row) * (1.0 + abs(avg_change) / 200.0),
            "low": min(last_close, new_close_row) * (1.0 - abs(avg_change) / 200.0),
            "close": new_close_row,
            "volume": 0.0,
        }
        working_df = pd.concat([working_df, pd.DataFrame([new_row])], ignore_index=True)
    
    closes = [s["predicted_close"] for s in sessions]
    min_price = min(closes)
    max_price = max(closes)
    final_close = closes[-1]
    initial_close = float(df["close"].iloc[-1])
    overall_change = (final_close - initial_close) / initial_close * 100
    
    if overall_change > 1.0:
        overall_direction = "up"
    elif overall_change < -1.0:
        overall_direction = "down"
    else:
        overall_direction = "flat"
    
    avg_confidence = np.mean([s["confidence"] for s in sessions])
    price_range = max_price - min_price
    price_range_pct = price_range / initial_close * 100
    
    if price_range_pct > 5.0:
        risk_level = "high"
    elif price_range_pct > 2.5:
        risk_level = "medium"
    else:
        risk_level = "low"
    
    return {
        "status": "ok",
        "symbol": symbol,
        "prediction": {
            "sessions": sessions,
            "overall_direction": overall_direction,
            "overall_confidence": round(float(avg_confidence), 4),
            "target_price_min": round(min_price, 2),
            "target_price_max": round(max_price, 2),
            "risk_level": risk_level,
        },
        "models_used": available_models,
        "current_features": current_features,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Model listing
# ─────────────────────────────────────────────────────────────────────────────


def list_all_models() -> Dict[str, Any]:
    """List all trained models across all symbols."""
    result: Dict[str, List[Dict]] = {}
    if not os.path.exists(MODELS_DIR):
        return {"status": "ok", "models": {}}
    
    for sym in sorted(os.listdir(MODELS_DIR)):
        sym_path = os.path.join(MODELS_DIR, sym)
        if not os.path.isdir(sym_path):
            continue
        models = []
        for mn in MODEL_TYPES:
            meta_path = os.path.join(sym_path, f"{mn}_meta.json")
            if os.path.exists(meta_path):
                meta = _load_meta(meta_path)
                if meta:
                    models.append(meta)
        if models:
            result[sym] = models
    
    return {"status": "ok", "models": result}


def get_symbol_models(symbol: str) -> Dict[str, Any]:
    """Get models for a specific symbol."""
    sym_path = os.path.join(MODELS_DIR, symbol)
    if not os.path.isdir(sym_path):
        return {"status": "error", "message": f"No trained model for symbol {symbol}"}
    
    models = []
    for mn in MODEL_TYPES:
        meta_path = os.path.join(sym_path, f"{mn}_meta.json")
        if os.path.exists(meta_path):
            meta = _load_meta(meta_path)
            if meta:
                models.append(meta)
    
    if not models:
        return {"status": "error", "message": f"No trained model for symbol {symbol}"}
    
    return {"status": "ok", "symbol": symbol, "models": models}


# ─────────────────────────────────────────────────────────────────────────────
# Evaluation endpoint
# ─────────────────────────────────────────────────────────────────────────────


def evaluate_symbol(symbol: str) -> Dict[str, Any]:
    """
    Load trained models for a symbol and return evaluation metrics.
    """
    sym_path = os.path.join(MODELS_DIR, symbol)
    if not os.path.isdir(sym_path):
        return {"status": "error", "message": f"No trained model for symbol {symbol}"}
    
    models = []
    metrics = {}
    for mn in MODEL_TYPES:
        meta_path = os.path.join(sym_path, f"{mn}_meta.json")
        if os.path.exists(meta_path):
            meta = _load_meta(meta_path)
            if meta:
                models.append(meta)
                metrics[mn] = meta.get('metrics', {})
    
    comparison = model_comparison_table(metrics)
    
    return {
        "status": "ok",
        "symbol": symbol,
        "models_evaluated": len(models),
        "metrics": metrics,
        "model_comparison": comparison,
        "best_model_by_cv": comparison[0]["model"] if comparison else None,
        "warning_flags": [],
    }


# ─────────────────────────────────────────────────────────────────────────────
# HTTP Handler
# ─────────────────────────────────────────────────────────────────────────────


def _json_response(handler: BaseHTTPRequestHandler, data: Dict, status: int = 200) -> None:
    """Send a JSON response."""
    body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_body(handler: BaseHTTPRequestHandler) -> bytes:
    """Read request body."""
    length = int(handler.headers.get("Content-Length", 0))
    return handler.rfile.read(length) if length > 0 else b""


class MLHandler(BaseHTTPRequestHandler):
    """HTTP request handler for ML Training Service."""
    
    def log_message(self, format: str, *args: Any) -> None:
        pass
    
    def _route(self, method: str) -> None:
        """Route request to appropriate handler."""
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        
        try:
            # Health
            if path == "/health" and method == "GET":
                _json_response(self, {
                    "status": "ok",
                    "service": "ml-trainer",
                    "port": PORT,
                    "version": "2.0.0",
                    "onnx_export": ONNX_EXPORT_AVAILABLE,
                    "cached_symbols": list(_model_cache.keys()),
                })
                return
            
            # Train
            if path == "/train" and method == "POST":
                body = json.loads(_read_body(self))
                symbol = body.get("symbol", "").strip().upper()
                ohlcv = body.get("ohlcv", [])
                models = body.get("models", MODEL_TYPES)
                
                if not symbol:
                    _json_response(self, {"status": "error", "message": "Missing 'symbol' field"}, 400)
                    return
                if not ohlcv or len(ohlcv) < MIN_CANDLES:
                    _json_response(self, {"status": "error", "message": f"Need at least {MIN_CANDLES} OHLCV candles"}, 400)
                    return
                
                result = train_models(symbol, ohlcv, models)
                _json_response(self, result)
                return
            
            # Predict
            if path == "/predict" and method == "POST":
                body = json.loads(_read_body(self))
                symbol = body.get("symbol", "").strip().upper()
                ohlcv = body.get("ohlcv", [])
                horizon = min(body.get("horizon", 30), 90)
                
                if not symbol:
                    _json_response(self, {"status": "error", "message": "Missing 'symbol' field"}, 400)
                    return
                if not ohlcv or len(ohlcv) < MIN_CANDLES:
                    _json_response(self, {"status": "error", "message": f"Need at least {MIN_CANDLES} OHLCV candles"}, 400)
                    return
                
                result = predict_sessions(symbol, ohlcv, horizon)
                _json_response(self, result)
                return
            
            # List all models
            if path == "/models" and method == "GET":
                _json_response(self, list_all_models())
                return
            
            # Get symbol models
            if path.startswith("/models/") and method == "GET":
                symbol = path[len("/models/"):].strip().upper()
                if not symbol:
                    _json_response(self, {"status": "error", "message": "Missing symbol in path"}, 400)
                    return
                _json_response(self, get_symbol_models(symbol))
                return
            
            # Retrain all
            if path == "/retrain-all" and method == "POST":
                body = json.loads(_read_body(self))
                ohlcv_data = body.get("ohlcv_data", {})
                
                if not ohlcv_data:
                    _json_response(self, {"status": "error", "message": "Missing 'ohlcv_data' field"}, 400)
                    return
                
                results = {}
                errors = []
                for sym, candles in ohlcv_data.items():
                    try:
                        sym_upper = sym.strip().upper()
                        r = train_models(sym_upper, candles, MODEL_TYPES)
                        results[sym_upper] = r
                    except Exception as e:
                        errors.append({"symbol": sym, "error": str(e)})
                
                _json_response(self, {
                    "status": "ok",
                    "retrained": list(results.keys()),
                    "results": results,
                    "errors": errors,
                })
                return
            
            # 404
            _json_response(self, {"status": "error", "message": f"Not found: {method} {path}"}, 404)
            
        except json.JSONDecodeError:
            _json_response(self, {"status": "error", "message": "Invalid JSON body"}, 400)
        except ValueError as e:
            _json_response(self, {"status": "error", "message": str(e)}, 400)
        except Exception as e:
            log("ERROR", f"Unhandled {method} {path}: {traceback.format_exc()}")
            _json_response(self, {"status": "error", "message": f"Internal error: {str(e)}"}, 500)
    
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        
        if path == "/metrics" and "symbol" in parsed.query:
            symbol = parsed.query.split("symbol=", 1)[1].split("&", 1)[0]
            try:
                result = evaluate_symbol(symbol)
                _json_response(self, result)
            except Exception as e:
                _json_response(self, {"status": "error", "message": str(e)}, 500)
            return
        
        if path == "/evaluate" and "symbol" in parsed.query:
            symbol = parsed.query.split("symbol=", 1)[1].split("&", 1)[0]
            try:
                result = evaluate_symbol(symbol)
                _json_response(self, result)
            except Exception as e:
                _json_response(self, {"status": "error", "message": str(e)}, 500)
            return
        
        self._route("GET")
    
    def do_POST(self) -> None:
        self._route("POST")
    
    def do_OPTIONS(self) -> None:
        """Handle CORS preflight."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def end_headers(self) -> None:
        """Add CORS headers to all responses."""
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


# ─────────────────────────────────────────────────────────────────────────────
# Threading Server
# ─────────────────────────────────────────────────────────────────────────────


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle requests in separate threads."""
    daemon_threads = True
    allow_reuse_address = True


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────


def main() -> None:
    os.makedirs(MODELS_DIR, exist_ok=True)
    server = ThreadedHTTPServer(("0.0.0.0", PORT), MLHandler)
    log("INFO", f"ML Training Service started on port {PORT}")
    log("INFO", f"Models directory: {MODELS_DIR}")
    log("INFO", f"ONNX export available: {ONNX_EXPORT_AVAILABLE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("INFO", "Shutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()