#!/usr/bin/env python3
"""
ML Training Service — XGBoost & sklearn ensemble models for stock OHLC prediction.

Serves predictions via HTTP API on port 3032.
Endpoints: /train, /predict, /models, /retrain-all, /health
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
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    roc_auc_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
import xgboost as xgb
# onnxruntime imported lazily in _get_ort() to reduce startup memory
_ort = None
def _get_ort():
    global _ort
    if _ort is None:
        import onnxruntime as ort
        _ort = ort
    return _ort

# Try to import ONNX conversion — handle gracefully if unavailable
try:
    import skl2onnx
    from skl2onnx.common.data_types import FloatTensorType
    import onnxmltools
    ONNX_EXPORT_AVAILABLE = True
except Exception:
    ONNX_EXPORT_AVAILABLE = False
    print("[WARN] ONNX export libs not fully available — will use pickle fallback")

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

PORT = int(os.environ.get("ML_TRAINER_PORT", 3032))
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
MIN_CANDLES = 120
FORWARD_DAYS = 5
VOLATILITY_WINDOW = 10
DIRECTION_THRESHOLD = 0.005  # 0.5 %
PREDICTION_STEPS = 5  # predict 5 sessions per iteration

# Supported model types
MODEL_TYPES = [
    "xgboost_direction",
    "xgboost_regression",
    "ensemble_direction",
    "ensemble_regression",
    "volatility_model",
]

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────


def log(level: str, msg: str) -> None:
    """Print structured log with timestamp."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    print(json.dumps({"ts": ts, "level": level, "msg": msg}), flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# In-memory model cache  (thread-safe)
# ─────────────────────────────────────────────────────────────────────────────

_cache_lock = threading.Lock()
_model_cache: Dict[str, Dict[str, Any]] = {}  # symbol -> {model_name: {"model": ..., "meta": ...}}
_scaler_cache: Dict[str, StandardScaler] = {}  # symbol -> scaler


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


def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build 40+ technical features from OHLCV data.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain columns: open, high, low, close, volume (lowercase).
        Index should be sequential integers.

    Returns
    -------
    pd.DataFrame  —  same row count, NaNs at the head where windows can't fill.
    """
    out = pd.DataFrame(index=df.index)
    c = df["close"].astype(float)
    h = df["high"].astype(float)
    l = df["low"].astype(float)
    o = df["open"].astype(float)
    v = df["volume"].astype(float)

    # ── Price returns ──
    for period in (1, 3, 5, 10, 20):
        out[f"return_{period}d"] = c.pct_change(period)

    # ── Rolling statistics ──
    for w in (5, 10, 20, 60):
        roll = c.rolling(w, min_periods=1)
        out[f"close_mean_{w}"] = roll.mean()
        out[f"close_std_{w}"] = roll.std()
        out[f"close_min_{w}"] = roll.min()
        out[f"close_max_{w}"] = roll.max()

    # ── RSI(14) ──
    delta = c.diff()
    gain = delta.clip(lower=0).rolling(14, min_periods=1).mean()
    loss = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
    rs = _safe_div(gain, loss, fill=100.0)
    out["rsi_14"] = 100.0 - (100.0 / (1.0 + rs))

    # ── MACD(12,26,9) ──
    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    out["macd"] = ema12 - ema26
    out["macd_signal"] = out["macd"].ewm(span=9, adjust=False).mean()
    out["macd_hist"] = out["macd"] - out["macd_signal"]

    # ── Stochastic(14,3,3) ──
    low14 = l.rolling(14, min_periods=1).min()
    high14 = h.rolling(14, min_periods=1).max()
    out["stoch_k"] = 100.0 * _safe_div(c - low14, high14 - low14)
    out["stoch_d"] = out["stoch_k"].rolling(3, min_periods=1).mean()

    # ── CCI(20) ──
    typical = (h + l + c) / 3.0
    sma20 = typical.rolling(20, min_periods=1).mean()
    mad20 = typical.rolling(20, min_periods=1).apply(lambda x: np.mean(np.abs(x - x.mean())), raw=True)
    out["cci_20"] = _safe_div(typical - sma20, 0.015 * mad20)

    # ── ATR(14) ──
    tr = pd.concat([h - l, (h - c.shift(1)).abs(), (l - c.shift(1)).abs()], axis=1).max(axis=1)
    out["atr_14"] = tr.rolling(14, min_periods=1).mean()

    # ── ADX(14) ──
    plus_dm = h.diff()
    minus_dm = -l.diff()
    plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0.0)
    minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0.0)
    tr_smooth = tr.ewm(span=14, adjust=False).mean()
    plus_di = 100.0 * _safe_div(plus_dm.ewm(span=14, adjust=False).mean(), tr_smooth)
    minus_di = 100.0 * _safe_div(minus_dm.ewm(span=14, adjust=False).mean(), tr_smooth)
    dx_sum = _safe_div(abs(plus_di - minus_di), plus_di + minus_di) * 100.0
    out["adx_14"] = dx_sum.ewm(span=14, adjust=False).mean()

    # ── Bollinger Bands position ──
    bb_mid = c.rolling(20, min_periods=1).mean()
    bb_std = c.rolling(20, min_periods=1).std()
    out["bb_position"] = _safe_div(c - bb_mid, 2.0 * bb_std)

    # ── Volume features ──
    out["volume_sma_20"] = v.rolling(20, min_periods=1).mean()
    out["volume_ratio"] = _safe_div(v, out["volume_sma_20"])
    out["volume_zscore"] = _safe_div(v - out["volume_sma_20"], v.rolling(20, min_periods=1).std())

    # OBV (vectorized)
    direction = pd.Series(np.sign(c.diff()), index=df.index).fillna(0)
    obv = (direction * v).cumsum()
    out["obv"] = obv

    # ── Price patterns (rolling 10-bar) ──
    is_hh = (h > h.shift(1)).astype(float)
    is_ll = (l < l.shift(1)).astype(float)
    is_inside = ((h <= h.shift(1)) & (l >= l.shift(1))).astype(float)
    pw = 10
    out["higher_highs"] = is_hh.rolling(pw, min_periods=1).mean()
    out["lower_lows"] = is_ll.rolling(pw, min_periods=1).mean()
    out["inside_bar_ratio"] = is_inside.rolling(pw, min_periods=1).mean()

    # ── Momentum ──
    out["roc_10"] = _safe_div(c - c.shift(10), c.shift(10)) * 100.0
    momentum_score = (
        out.get("rsi_14", pd.Series(50, index=df.index)) - 50.0
        + out.get("macd_hist", pd.Series(0, index=df.index)) * 10.0
        + out.get("stoch_k", pd.Series(50, index=df.index)) - 50.0
    ) / 3.0
    out["momentum_score"] = momentum_score

    # ── Lag features (returns & RSI for last 5 periods) ──
    for lag in range(1, 6):
        out[f"return_1d_lag{lag}"] = out["return_1d"].shift(lag)
        out[f"rsi_14_lag{lag}"] = out["rsi_14"].shift(lag)

    return out


# ─────────────────────────────────────────────────────────────────────────────
# OHLCV DataFrame builder
# ─────────────────────────────────────────────────────────────────────────────


def build_ohlcv_df(ohlcv: List[List]) -> pd.DataFrame:
    """Convert raw OHLCV list to DataFrame with lowercase columns."""
    df = pd.DataFrame(ohlcv, columns=["date", "open", "high", "low", "close", "volume"])
    for col in ("open", "high", "low", "close", "volume"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["date"] = df["date"].astype(str)
    return df


# ─────────────────────────────────────────────────────────────────────────────
# Target builders
# ─────────────────────────────────────────────────────────────────────────────


def build_direction_target(df: pd.DataFrame) -> pd.Series:
    """Binary: 1 if 5-day forward return > 0.5%, else 0."""
    fwd = df["close"].shift(-FORWARD_DAYS) / df["close"] - 1.0
    return (fwd > DIRECTION_THRESHOLD).astype(int)


def build_regression_target(df: pd.DataFrame) -> pd.Series:
    """5-day forward return as percentage."""
    return (df["close"].shift(-FORWARD_DAYS) / df["close"] - 1.0) * 100.0


def build_volatility_target(df: pd.DataFrame) -> pd.Series:
    """Next-10-day realized volatility (std of daily returns * sqrt(252) * 100)."""
    ret = df["close"].pct_change()
    return ret.shift(-VOLATILITY_WINDOW).rolling(VOLATILITY_WINDOW).std() * np.sqrt(252) * 100.0


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
                # XGBoost via onnxmltools (uses its own data types)
                from onnxmltools.convert.common.data_types import FloatTensorType as XGBFloatType
                initial_type = [('float_input', XGBFloatType([None, input_dim]))]
                onnx_model = onnxmltools.convert_xgboost(model, initial_types=initial_type)
            else:
                # sklearn model via skl2onnx
                initial_type = [('float_input', FloatTensorType([None, input_dim]))]
                onnx_model = skl2onnx.convert_sklearn(model, initial_types=initial_type)
            onnx.save(onnx_model, path)
            return
        except Exception as e:
            log("WARN", f"ONNX export failed for {path}: {e}, falling back to pickle")
    # Pickle fallback
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
# Training
# ─────────────────────────────────────────────────────────────────────────────


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

    # Drop rows with NaN
    valid_mask = features_df[feature_cols].notna().all(axis=1)
    X = features_df.loc[valid_mask, feature_cols].values
    feature_index = features_df.index[valid_mask]

    # Build targets
    dir_target = build_direction_target(df).loc[feature_index].values
    reg_target = build_regression_target(df).loc[feature_index].values
    vol_target = build_volatility_target(df).loc[feature_index].values

    # Drop rows where targets are NaN
    valid2 = ~(np.isnan(dir_target) | np.isnan(reg_target) | np.isnan(vol_target))
    X = X[valid2]
    dir_target = dir_target[valid2]
    reg_target = reg_target[valid2]
    vol_target = vol_target[valid2]

    if len(X) < MIN_CANDLES:
        raise ValueError(f"After cleaning, only {len(X)} valid samples (need {MIN_CANDLES})")

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    input_dim = X_scaled.shape[1]

    # Save scaler
    _save_scaler(scaler, symbol)
    cache_scaler(symbol, scaler)

    # TimeSeriesSplit
    tscv = TimeSeriesSplit(n_splits=5)
    metrics: Dict[str, Dict] = {}
    all_feature_importance: Dict[str, float] = {}

    sym_dir = os.path.join(MODELS_DIR, symbol)
    os.makedirs(sym_dir, exist_ok=True)

    for mn in model_names:
        log("INFO", f"  Training model: {mn}")

        if mn == "xgboost_direction":
            model = xgb.XGBClassifier(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                use_label_encoder=False,
                eval_metric="logloss",
                verbosity=0,
                n_jobs=-1,
            )
            target = dir_target
            fold_metrics = {"accuracy": [], "f1": [], "auc": []}

            for train_idx, test_idx in tscv.split(X_scaled):
                model.fit(X_scaled[train_idx], target[train_idx])
                preds = model.predict(X_scaled[test_idx])
                proba = model.predict_proba(X_scaled[test_idx])[:, 1]
                fold_metrics["accuracy"].append(accuracy_score(target[test_idx], preds))
                fold_metrics["f1"].append(f1_score(target[test_idx], preds, zero_division=0))
                try:
                    fold_metrics["auc"].append(roc_auc_score(target[test_idx], proba))
                except Exception:
                    fold_metrics["auc"].append(0.5)

            # Final fit on all data
            model.fit(X_scaled, target)
            metrics[mn] = {k: round(float(np.mean(v)), 4) for k, v in fold_metrics.items()}
            imp = model.feature_importances_

        elif mn == "xgboost_regression":
            model = xgb.XGBRegressor(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                verbosity=0,
                n_jobs=-1,
            )
            target = reg_target
            fold_metrics = {"mae": [], "rmse": [], "r2": []}

            for train_idx, test_idx in tscv.split(X_scaled):
                model.fit(X_scaled[train_idx], target[train_idx])
                preds = model.predict(X_scaled[test_idx])
                fold_metrics["mae"].append(mean_absolute_error(target[test_idx], preds))
                fold_metrics["rmse"].append(np.sqrt(mean_squared_error(target[test_idx], preds)))
                fold_metrics["r2"].append(r2_score(target[test_idx], preds))

            model.fit(X_scaled, target)
            metrics[mn] = {k: round(float(np.mean(v)), 4) for k, v in fold_metrics.items()}
            imp = model.feature_importances_

        elif mn == "ensemble_direction":
            model = GradientBoostingClassifier(
                n_estimators=200,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.8,
                max_features="sqrt",
                random_state=42,
            )
            target = dir_target
            fold_metrics = {"accuracy": [], "f1": [], "auc": []}

            for train_idx, test_idx in tscv.split(X_scaled):
                model.fit(X_scaled[train_idx], target[train_idx])
                preds = model.predict(X_scaled[test_idx])
                proba = model.predict_proba(X_scaled[test_idx])[:, 1]
                fold_metrics["accuracy"].append(accuracy_score(target[test_idx], preds))
                fold_metrics["f1"].append(f1_score(target[test_idx], preds, zero_division=0))
                try:
                    fold_metrics["auc"].append(roc_auc_score(target[test_idx], proba))
                except Exception:
                    fold_metrics["auc"].append(0.5)

            model.fit(X_scaled, target)
            metrics[mn] = {k: round(float(np.mean(v)), 4) for k, v in fold_metrics.items()}
            imp = model.feature_importances_

        elif mn == "ensemble_regression":
            model = GradientBoostingRegressor(
                n_estimators=200,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.8,
                max_features="sqrt",
                random_state=42,
            )
            target = reg_target
            fold_metrics = {"mae": [], "rmse": [], "r2": []}

            for train_idx, test_idx in tscv.split(X_scaled):
                model.fit(X_scaled[train_idx], target[train_idx])
                preds = model.predict(X_scaled[test_idx])
                fold_metrics["mae"].append(mean_absolute_error(target[test_idx], preds))
                fold_metrics["rmse"].append(np.sqrt(mean_squared_error(target[test_idx], preds)))
                fold_metrics["r2"].append(r2_score(target[test_idx], preds))

            model.fit(X_scaled, target)
            metrics[mn] = {k: round(float(np.mean(v)), 4) for k, v in fold_metrics.items()}
            imp = model.feature_importances_

        elif mn == "volatility_model":
            model = RandomForestRegressor(
                n_estimators=200,
                max_depth=6,
                min_samples_leaf=5,
                random_state=42,
                n_jobs=-1,
            )
            target = vol_target
            fold_metrics = {"mae": [], "rmse": [], "r2": []}

            for train_idx, test_idx in tscv.split(X_scaled):
                model.fit(X_scaled[train_idx], target[train_idx])
                preds = model.predict(X_scaled[test_idx])
                fold_metrics["mae"].append(mean_absolute_error(target[test_idx], preds))
                fold_metrics["rmse"].append(np.sqrt(mean_squared_error(target[test_idx], preds)))
                fold_metrics["r2"].append(r2_score(target[test_idx], preds))

            model.fit(X_scaled, target)
            metrics[mn] = {k: round(float(np.mean(v)), 4) for k, v in fold_metrics.items()}
            imp = model.feature_importances_

        else:
            continue

        # Save model artifact
        onnx_path = os.path.join(sym_dir, f"{mn}.onnx")
        _save_model_artifact(model, onnx_path, input_dim)

        # Cache in memory
        cache_model(symbol, mn, model, metrics.get(mn, {}))

        # Save metadata
        meta = {
            "model_type": mn,
            "symbol": symbol,
            "metrics": metrics.get(mn, {}),
            "feature_cols": feature_cols,
            "input_dim": input_dim,
            "training_samples": int(len(X)),
            "date_range": [str(df["date"].iloc[0]), str(df["date"].iloc[-1])],
            "trained_at": datetime.now(timezone.utc).isoformat() + "Z",
        }
        _save_meta(meta, os.path.join(sym_dir, f"{mn}_meta.json"))

        # Accumulate feature importance (average across models)
        for i, col in enumerate(feature_cols):
            all_feature_importance[col] = all_feature_importance.get(col, 0.0) + float(imp[i])

    # Normalize feature importance
    total_imp = sum(all_feature_importance.values())
    if total_imp > 0:
        all_feature_importance = {k: round(v / total_imp, 4) for k, v in all_feature_importance.items()}

    # Top 10
    top_features = dict(sorted(all_feature_importance.items(), key=lambda x: x[1], reverse=True)[:10])

    return {
        "status": "ok",
        "symbol": symbol,
        "models_trained": model_names,
        "metrics": metrics,
        "feature_importance": top_features,
        "training_samples": len(X),
        "date_range": [str(df["date"].iloc[0]), str(df["date"].iloc[-1])],
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
        # Classification: result[1] is probabilities; Regression: result[0] is values
        if len(result) == 2 and result[1].shape[1] >= 2:
            return result[1]  # probabilities
        return result[0]  # regression
    else:
        # sklearn or xgboost native
        if hasattr(model, "predict_proba"):
            return model.predict_proba(features)  # type: ignore
        return model.predict(features)  # type: ignore


def predict_sessions(
    symbol: str,
    ohlcv: List[List],
    horizon: int = 30,
) -> Dict[str, Any]:
    """
    Generate multi-session prediction for a symbol.

    Uses iterative prediction: predict 5 sessions, append, re-extract, repeat.
    """
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

    for mn in ("xgboost_direction", "ensemble_direction"):
        model, is_onnx = _load_model_artifact(os.path.join(sym_dir, f"{mn}.onnx"))
        if model is not None:
            dir_model = model
            dir_is_onnx = is_onnx
            available_models.append(mn)
            break

    for mn in ("xgboost_regression", "ensemble_regression"):
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
    feature_cols = list(features_df.columns)
    last_row = features_df.iloc[-1:].values
    if np.any(np.isnan(last_row)):
        # Forward-fill NaNs with column means
        col_means = features_df.mean().values
        nan_mask = np.isnan(last_row)
        last_row[nan_mask] = np.take(col_means, np.where(nan_mask)[1])

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

        # Extract features from current working dataframe
        feat_df = extract_features(working_df)
        feat_cols = list(feat_df.columns)
        last_features = feat_df.iloc[-1:].values

        # Handle NaNs
        if np.any(np.isnan(last_features)):
            col_means = feat_df.mean().values
            for j in range(last_features.shape[1]):
                if np.isnan(last_features[0, j]):
                    last_features[0, j] = col_means[j]

        scaled = scaler.transform(last_features)

        predicted_change = 0.0
        direction = "flat"
        confidence = 0.5

        if reg_model is not None:
            reg_result = _predict_with_model(reg_model, scaled, reg_is_onnx)
            predicted_change = float(reg_result[0])

        if dir_model is not None:
            dir_result = _predict_with_model(dir_model, scaled, dir_is_onnx)
            # dir_result is probability array [p_down, p_up]
            if dir_result.ndim == 2 and dir_result.shape[1] >= 2:
                p_up = float(dir_result[0, 1])
            else:
                p_up = float(dir_result[0]) if float(dir_result[0]) > 0.5 else 0.5
            confidence = p_up if p_up > 0.5 else (1.0 - p_up)
            direction = "up" if p_up > 0.5 else "down"

        # If only regression model, derive direction from predicted change
        if dir_model is None and reg_model is not None:
            if predicted_change > DIRECTION_THRESHOLD * 100:
                direction = "up"
                confidence = min(0.9, 0.5 + abs(predicted_change) / 5.0)
            elif predicted_change < -DIRECTION_THRESHOLD * 100:
                direction = "down"
                confidence = min(0.9, 0.5 + abs(predicted_change) / 5.0)

        # Generate steps sessions
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
            })
            last_close = new_close

        # Append predicted candle to working_df for next iteration
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

    # Aggregate results
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

    # Suppress default stderr logging
    def log_message(self, format: str, *args: Any) -> None:
        pass

    def _route(self, method: str) -> None:
        """Route request to appropriate handler."""
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        try:
            # ── Health ──
            if path == "/health" and method == "GET":
                _json_response(self, {
                    "status": "ok",
                    "service": "ml-trainer",
                    "port": PORT,
                    "version": "1.0.0",
                    "onnx_export": ONNX_EXPORT_AVAILABLE,
                    "cached_symbols": list(_model_cache.keys()),
                })
                return

            # ── Train ──
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

            # ── Predict ──
            if path == "/predict" and method == "POST":
                body = json.loads(_read_body(self))
                symbol = body.get("symbol", "").strip().upper()
                ohlcv = body.get("ohlcv", [])
                horizon = min(body.get("horizon", 30), 90)  # cap at 90

                if not symbol:
                    _json_response(self, {"status": "error", "message": "Missing 'symbol' field"}, 400)
                    return
                if not ohlcv or len(ohlcv) < MIN_CANDLES:
                    _json_response(self, {"status": "error", "message": f"Need at least {MIN_CANDLES} OHLCV candles"}, 400)
                    return

                result = predict_sessions(symbol, ohlcv, horizon)
                _json_response(self, result)
                return

            # ── List all models ──
            if path == "/models" and method == "GET":
                _json_response(self, list_all_models())
                return

            # ── Get symbol models ──
            if path.startswith("/models/") and method == "GET":
                symbol = path[len("/models/"):].strip().upper()
                if not symbol:
                    _json_response(self, {"status": "error", "message": "Missing symbol in path"}, 400)
                    return
                _json_response(self, get_symbol_models(symbol))
                return

            # ── Retrain all ──
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

            # ── 404 ──
            _json_response(self, {"status": "error", "message": f"Not found: {method} {path}"}, 404)

        except json.JSONDecodeError:
            _json_response(self, {"status": "error", "message": "Invalid JSON body"}, 400)
        except ValueError as e:
            _json_response(self, {"status": "error", "message": str(e)}, 400)
        except Exception as e:
            log("ERROR", f"Unhandled {method} {path}: {traceback.format_exc()}")
            _json_response(self, {"status": "error", "message": f"Internal error: {str(e)}"}, 500)

    def do_GET(self) -> None:
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
