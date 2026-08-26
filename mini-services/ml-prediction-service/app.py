# ═════════════════════════════════════════════════════════════════════
# ML Prediction Service
# Multi-model price forecasting with 30+ technical features
# Port: 3032
# ═════════════════════════════════════════════════════════════════════

import hashlib
import json
import time
import traceback
import warnings
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from sklearn.ensemble import (GradientBoostingRegressor,
                              RandomForestRegressor)
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR
from xgboost import XGBRegressor

# LightGBM spams warnings about feature names; suppress them
warnings.filterwarnings("ignore", category=UserWarning)

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

app = Flask(__name__)
CORS(app)

# ── Constants ───────────────────────────────────────────────────────
PORT = 3032
MIN_CANDLES = 60
CACHE_TTL_SECONDS = 300  # 5 minutes

MODEL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "rf": {"name": "Random Forest", "key": "rf"},
    "xgboost": {"name": "XGBoost", "key": "xgboost"},
    "lightgbm": {"name": "LightGBM", "key": "lightgbm"},
    "svr": {"name": "SVR", "key": "svr"},
    "gbr": {"name": "Gradient Boosting", "key": "gbr"},
}

# In-memory cache: {key: (data, timestamp)}
_cache: Dict[str, Tuple[Any, float]] = {}


# ═══════════════════════════════════════════════════════════════════
# Feature Engineering (30+ features)
# ═══════════════════════════════════════════════════════════════════

def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute 30+ technical features from OHLCV data.

    Args:
        df: DataFrame with columns [open, high, low, close, volume].

    Returns:
        DataFrame with all feature columns. Rows with NaN (insufficient
        lookback) are NOT dropped here — caller decides.
    """
    df = df.copy()
    c = df["close"].astype(float)
    h = df["high"].astype(float)
    l = df["low"].astype(float)
    o = df["open"].astype(float)
    v = df["volume"].astype(float)

    # --- Returns (5 features) ---
    for period in [1, 3, 5, 10, 20]:
        df[f"ret_{period}"] = c.pct_change(period)

    # --- SMA ratios (4 features) ---
    for period in [5, 10, 20, 50]:
        sma = c.rolling(window=period, min_periods=period).mean()
        df[f"close_sma{period}"] = c / sma

    # --- EMA ratios (2 features) ---
    for period in [12, 26]:
        ema = c.ewm(span=period, adjust=False).mean()
        df[f"close_ema{period}"] = c / ema

    # --- RSI (2 features) ---
    for period in [7, 14]:
        delta = c.diff()
        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)
        avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        rs = avg_gain / (avg_loss + 1e-10)
        df[f"rsi_{period}"] = 100.0 - (100.0 / (1.0 + rs))

    # --- MACD (3 features) ---
    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    macd_signal = macd_line.ewm(span=9, adjust=False).mean()
    df["macd"] = macd_line / (c + 1e-10)        # normalized
    df["macd_signal"] = macd_signal / (c + 1e-10)
    df["macd_hist"] = (macd_line - macd_signal) / (c + 1e-10)

    # --- Stochastic K & D (2 features) ---
    lowest_low = l.rolling(window=14, min_periods=14).min()
    highest_high = h.rolling(window=14, min_periods=14).max()
    stoch_k = 100.0 * (c - lowest_low) / (highest_high - lowest_low + 1e-10)
    df["stoch_k"] = stoch_k
    df["stoch_d"] = stoch_k.rolling(window=3, min_periods=3).mean()

    # --- CCI(20) (1 feature) ---
    tp = (h + l + c) / 3.0
    sma_tp = tp.rolling(window=20, min_periods=20).mean()
    mad = tp.rolling(window=20, min_periods=20).apply(
        lambda x: np.mean(np.abs(x - x.mean())), raw=True
    )
    df["cci"] = (tp - sma_tp) / (0.015 * mad + 1e-10)

    # --- Williams %R (1 feature) ---
    hh14 = h.rolling(window=14, min_periods=14).max()
    ll14 = l.rolling(window=14, min_periods=14).min()
    df["williams_r"] = -100.0 * (hh14 - c) / (hh14 - ll14 + 1e-10)

    # --- ADX, DI+, DI- (3 features) ---
    df["adx"], df["di_plus"], df["di_minus"] = _compute_adx(h, l, c, 14)

    # --- ATR normalized (1 feature) ---
    tr = pd.concat([h - l, (h - c.shift(1)).abs(), (l - c.shift(1)).abs()], axis=1).max(axis=1)
    atr = tr.rolling(window=14, min_periods=14).mean()
    df["atr_norm"] = atr / (c + 1e-10)

    # --- Bollinger Band position (1 feature) ---
    sma20 = c.rolling(window=20, min_periods=20).mean()
    std20 = c.rolling(window=20, min_periods=20).std()
    bb_upper = sma20 + 2.0 * std20
    bb_lower = sma20 - 2.0 * std20
    df["bb_pos"] = (c - bb_lower) / (bb_upper - bb_lower + 1e-10)

    # --- Volume features (2 features) ---
    vol_sma20 = v.rolling(window=20, min_periods=20).mean()
    df["vol_ratio"] = v / (vol_sma20 + 1e-10)

    # OBV
    obv = pd.Series(0.0, index=df.index, dtype=float)
    for i in range(1, len(df)):
        if c.iloc[i] > c.iloc[i - 1]:
            obv.iloc[i] = obv.iloc[i - 1] + v.iloc[i]
        elif c.iloc[i] < c.iloc[i - 1]:
            obv.iloc[i] = obv.iloc[i - 1] - v.iloc[i]
        else:
            obv.iloc[i] = obv.iloc[i - 1]
    df["obv_trend_5"] = obv.pct_change(5)

    # --- Price structure features (5 features) ---
    df["hl_range"] = (h - l) / (c + 1e-10)
    df["oc_range"] = (o - c).abs() / (c + 1e-10)
    df["upper_shadow"] = (h - pd.concat([o, c], axis=1).max(axis=1)) / (c + 1e-10)
    df["lower_shadow"] = (pd.concat([o, c], axis=1).min(axis=1) - l) / (c + 1e-10)

    # --- Momentum (1 feature) ---
    df["momentum_10"] = c - c.shift(10)
    df["momentum_10"] = df["momentum_10"] / (c + 1e-10)

    # --- Rate of Change (1 feature) ---
    df["roc_10"] = (c - c.shift(10)) / (c.shift(10) + 1e-10) * 100.0

    # --- Price position in 20-session range (1 feature) ---
    low20 = l.rolling(window=20, min_periods=20).min()
    high20 = h.rolling(window=20, min_periods=20).max()
    df["price_pos_20"] = (c - low20) / (high20 - low20 + 1e-10)

    return df


def _compute_adx(
    high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14
) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """Compute ADX, DI+ and DI-."""
    n = len(close)
    adx = pd.Series(np.nan, index=close.index)
    di_plus = pd.Series(np.nan, index=close.index)
    di_minus = pd.Series(np.nan, index=close.index)

    if n < period + 1:
        return adx, di_plus, di_minus

    plus_dm = pd.Series(0.0, index=close.index)
    minus_dm = pd.Series(0.0, index=close.index)
    tr = pd.Series(0.0, index=close.index)

    for i in range(1, n):
        up_move = high.iloc[i] - high.iloc[i - 1]
        down_move = low.iloc[i - 1] - low.iloc[i]
        plus_dm.iloc[i] = up_move if (up_move > down_move and up_move > 0) else 0.0
        minus_dm.iloc[i] = down_move if (down_move > up_move and down_move > 0) else 0.0
        tr_val = max(
            high.iloc[i] - low.iloc[i],
            abs(high.iloc[i] - close.iloc[i - 1]),
            abs(low.iloc[i] - close.iloc[i - 1]),
        )
        tr.iloc[i] = tr_val

    # Smooth using Wilder's method
    atr_smooth = tr.copy()
    smooth_plus = plus_dm.copy()
    smooth_minus = minus_dm.copy()

    for i in range(period, n):
        if i == period:
            atr_smooth.iloc[i] = tr.iloc[1 : i + 1].sum()
            smooth_plus.iloc[i] = plus_dm.iloc[1 : i + 1].sum()
            smooth_minus.iloc[i] = minus_dm.iloc[1 : i + 1].sum()
        else:
            atr_smooth.iloc[i] = (atr_smooth.iloc[i - 1] * (period - 1) + tr.iloc[i]) / period
            smooth_plus.iloc[i] = (smooth_plus.iloc[i - 1] * (period - 1) + plus_dm.iloc[i]) / period
            smooth_minus.iloc[i] = (smooth_minus.iloc[i - 1] * (period - 1) + minus_dm.iloc[i]) / period

    di_plus = 100.0 * smooth_plus / (atr_smooth + 1e-10)
    di_minus = 100.0 * smooth_minus / (atr_smooth + 1e-10)
    dx = 100.0 * (di_plus - di_minus).abs() / (di_plus + di_minus + 1e-10)

    adx = pd.Series(np.nan, index=close.index)
    for i in range(2 * period - 1, n):
        if i == 2 * period - 1:
            adx.iloc[i] = dx.iloc[period : i + 1].mean()
        else:
            adx.iloc[i] = (adx.iloc[i - 1] * (period - 1) + dx.iloc[i]) / period

    return adx, di_plus, di_minus


# ═══════════════════════════════════════════════════════════════════
# Feature column names (deterministic order)
# ═══════════════════════════════════════════════════════════════════

FEATURE_COLUMNS: List[str] = [
    # Returns
    "ret_1", "ret_3", "ret_5", "ret_10", "ret_20",
    # SMA ratios
    "close_sma5", "close_sma10", "close_sma20", "close_sma50",
    # EMA ratios
    "close_ema12", "close_ema26",
    # RSI
    "rsi_7", "rsi_14",
    # MACD
    "macd", "macd_signal", "macd_hist",
    # Stochastic
    "stoch_k", "stoch_d",
    # CCI
    "cci",
    # Williams %R
    "williams_r",
    # ADX
    "adx", "di_plus", "di_minus",
    # ATR
    "atr_norm",
    # Bollinger
    "bb_pos",
    # Volume
    "vol_ratio", "obv_trend_5",
    # Price structure
    "hl_range", "oc_range", "upper_shadow", "lower_shadow",
    # Momentum & ROC
    "momentum_10", "roc_10",
    # Price position
    "price_pos_20",
]


# ═══════════════════════════════════════════════════════════════════
# Model Builders
# ═══════════════════════════════════════════════════════════════════

def build_model(model_key: str) -> Any:
    """Instantiate a model by its registry key."""
    if model_key == "rf":
        return RandomForestRegressor(
            n_estimators=100, max_depth=10, min_samples_split=5,
            min_samples_leaf=2, random_state=42, verbose=0, n_jobs=-1,
        )
    elif model_key == "xgboost":
        return XGBRegressor(
            n_estimators=100, max_depth=6, learning_rate=0.1,
            subsample=0.8, colsample_bytree=0.8, random_state=42,
            verbosity=0, n_jobs=-1,
        )
    elif model_key == "lightgbm":
        if not HAS_LIGHTGBM:
            return None
        return lgb.LGBMRegressor(
            n_estimators=100, max_depth=6, learning_rate=0.1,
            subsample=0.8, colsample_bytree=0.8, random_state=42,
            verbose=-1, n_jobs=-1,
        )
    elif model_key == "svr":
        return SVR(kernel="rbf", C=100.0, gamma="scale", epsilon=0.001)
    elif model_key == "gbr":
        return GradientBoostingRegressor(
            n_estimators=100, max_depth=5, learning_rate=0.1,
            subsample=0.8, min_samples_split=5, random_state=42, verbose=0,
        )
    return None


# ═══════════════════════════════════════════════════════════════════
# Core: Train, Cross-Validate, Predict
# ═══════════════════════════════════════════════════════════════════

def prepare_dataset(
    candles: List[Dict[str, Any]]
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, int]:
    """Convert raw candles to feature matrix and target vector.

    Target = next-session percentage return: (close[t+1] - close[t]) / close[t] * 100

    Returns:
        (df_with_features, X, y, features_count)
    """
    df = pd.DataFrame(candles)
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df_feat = compute_features(df)

    # Target: next-session return in percent
    df_feat["target"] = df_feat["close"].pct_change(1).shift(-1) * 100.0

    # Drop rows with NaN in features or target
    valid_mask = df_feat[FEATURE_COLUMNS + ["target"]].notna().all(axis=1)
    df_clean = df_feat[valid_mask].copy()

    # Replace inf with NaN then drop
    df_clean = df_clean.replace([np.inf, -np.inf], np.nan)
    valid_mask2 = df_clean[FEATURE_COLUMNS + ["target"]].notna().all(axis=1)
    df_clean = df_clean[valid_mask2].copy()

    X = df_clean[FEATURE_COLUMNS]
    y = df_clean["target"]

    return df_clean, X, y, len(FEATURE_COLUMNS)


def cross_validate_model(
    model: Any,
    X: pd.DataFrame,
    y: pd.Series,
    model_key: str,
    n_splits: int = 5,
) -> Tuple[float, float, float]:
    """Run TimeSeriesSplit CV and return mean R², mean RMSE (in percent), and
    std of CV predictions (for confidence intervals).

    Returns:
        (mean_r2, mean_rmse_pct, pred_std)
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)
    r2_scores: List[float] = []
    rmse_scores: List[float] = []
    all_test_preds: List[np.ndarray] = []

    scaler: Optional[StandardScaler] = None
    if model_key == "svr":
        scaler = StandardScaler()

    for train_idx, test_idx in tscv.split(X):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        # Scale for SVR
        if scaler is not None:
            X_train_s = scaler.fit_transform(X_train)
            X_test_s = scaler.transform(X_test)
        else:
            X_train_s = X_train
            X_test_s = X_test

        m = build_model(model_key)
        if m is None:
            return 0.0, 999.0, 0.0
        m.fit(X_train_s, y_train)
        preds = m.predict(X_test_s)

        r2_scores.append(m.score(X_test_s, y_test))
        rmse = np.sqrt(np.mean((preds - y_test.values) ** 2))
        rmse_scores.append(rmse)
        all_test_preds.append(preds)

    mean_r2 = float(np.mean(r2_scores)) if r2_scores else 0.0
    mean_rmse = float(np.mean(rmse_scores)) if rmse_scores else 0.0
    pred_std = float(np.std(np.concatenate(all_test_preds))) if all_test_preds else 0.0

    return mean_r2, mean_rmse, pred_std


def train_final_model(
    model_key: str,
    X: pd.DataFrame,
    y: pd.Series,
) -> Tuple[Any, Optional[StandardScaler]]:
    """Train the final model on all training data (last 80%).

    Returns:
        (trained_model, scaler_or_none)
    """
    split_idx = int(len(X) * 0.8)
    X_train = X.iloc[:split_idx]
    y_train = y.iloc[:split_idx]

    scaler: Optional[StandardScaler] = None
    if model_key == "svr":
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)

    model = build_model(model_key)
    if model is None:
        return None, None
    model.fit(X_train, y_train)
    return model, scaler


def iterative_predict(
    model: Any,
    model_key: str,
    scaler: Optional[StandardScaler],
    last_features: np.ndarray,
    current_close: float,
    df_all: pd.DataFrame,
    n_sessions: int,
) -> List[Dict[str, float]]:
    """Iteratively predict N sessions ahead.

    For each step:
      1. Predict next-session return from current features
      2. Compute new price
      3. Append a synthetic candle to the history
      4. Recompute features

    Returns:
        List of {session, price, change_pct} dicts
    """
    predictions: List[Dict[str, float]] = []
    df_sim = df_all.copy()
    feat = last_features.copy()
    price = current_close

    for step in range(1, n_sessions + 1):
        # Predict
        if scaler is not None:
            feat_2d = feat.reshape(1, -1)
            feat_scaled = scaler.transform(feat_2d)
            pred_return = float(model.predict(feat_scaled)[0])
        else:
            pred_return = float(model.predict(feat.reshape(1, -1))[0])

        # Compute new price
        new_price = price * (1.0 + pred_return / 100.0)
        change_pct = (new_price - current_close) / current_close * 100.0

        predictions.append({
            "session": step,
            "price": round(new_price, 2),
            "change_pct": round(change_pct, 2),
        })

        if step < n_sessions:
            # Build synthetic candle: use predicted price for all OHLC
            # Keep volume as average of last 5 sessions
            recent_vol = df_sim["volume"].tail(5).mean()
            new_candle = pd.DataFrame({
                "open": [price],
                "high": [max(price, new_price) * 1.001],
                "low": [min(price, new_price) * 0.999],
                "close": [new_price],
                "volume": [recent_vol],
            }, index=[df_sim.index[-1] + 1])

            df_sim = pd.concat([df_sim, new_candle], ignore_index=True)
            df_sim_feat = compute_features(df_sim)

            # Get last row of features
            last_row = df_sim_feat.iloc[-1]
            feat_values = []
            for col in FEATURE_COLUMNS:
                val = last_row.get(col, np.nan)
                if pd.isna(val) or np.isinf(val):
                    val = 0.0
                feat_values.append(float(val))
            feat = np.array(feat_values, dtype=np.float64)

            price = new_price

    return predictions


# ═══════════════════════════════════════════════════════════════════
# Cache Helpers
# ═══════════════════════════════════════════════════════════════════

def _cache_key(candles: List[Dict], sessions: int, models: List[str]) -> str:
    """Deterministic cache key from request params."""
    raw = json.dumps({"c": candles, "s": sessions, "m": sorted(models)}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def _get_cache(key: str) -> Optional[Any]:
    """Return cached data if still fresh, else None."""
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL_SECONDS:
            return data
        del _cache[key]
    return None


def _set_cache(key: str, data: Any) -> None:
    _cache[key] = (data, time.time())


# ═══════════════════════════════════════════════════════════════════
# Main Prediction Logic
# ═══════════════════════════════════════════════════════════════════

def run_prediction(
    candles: List[Dict[str, Any]],
    sessions: int,
    model_keys: List[str],
) -> Dict[str, Any]:
    """Execute the full prediction pipeline."""

    # Validate model keys
    available = list(MODEL_REGISTRY.keys())
    if HAS_LIGHTGBM is False:
        available = [k for k in available if k != "lightgbm"]
    for mk in model_keys:
        if mk not in available:
            raise ValueError(f"Unknown model: {mk}. Available: {available}")

    # Prepare dataset
    df_clean, X, y, feat_count = prepare_dataset(candles)
    training_samples = len(X)

    if training_samples < 30:
        raise ValueError(
            f"Not enough valid samples after feature computation. "
            f"Need at least 30, got {training_samples}. "
            f"Provide more candle data (minimum 60 recommended)."
        )

    # Check for flat prices
    close_range = X["close_sma5"].max() - X["close_sma5"].min() if "close_sma5" in X.columns else 0
    # Not a hard error but we should handle gracefully

    # Get the raw OHLCV dataframe for iterative prediction
    df_raw = pd.DataFrame(candles)
    for col in ["open", "high", "low", "close", "volume"]:
        df_raw[col] = pd.to_numeric(df_raw[col], errors="coerce")
    df_raw = df_raw.dropna(subset=["close"])

    # Last known close price
    last_close = float(df_raw["close"].iloc[-1])

    # Get features for the last valid row (the one just before the target)
    last_feat_row = df_clean.iloc[-1]
    last_features = np.array(
        [float(last_feat_row[col]) if not pd.isna(last_feat_row[col]) else 0.0 for col in FEATURE_COLUMNS],
        dtype=np.float64,
    )

    # Train, CV, and predict for each model
    forecasts: Dict[str, Any] = {}
    cv_results: Dict[str, float] = {}  # model_key -> r2
    model_objects: Dict[str, Tuple[Any, Optional[StandardScaler]]] = {}

    for mk in model_keys:
        # Cross-validate
        cv_r2, cv_rmse, pred_std = cross_validate_model(build_model(mk), X, y, mk)
        cv_results[mk] = cv_r2

        # Train final model on 80% of data
        final_model, scaler = train_final_model(mk, X, y)
        model_objects[mk] = (final_model, scaler)

        # Iterative prediction
        preds = iterative_predict(
            final_model, mk, scaler, last_features, last_close, df_raw, sessions
        )

        # Add confidence intervals
        z = 1.96
        for p in preds:
            session_num = p["session"]
            # Widen intervals for longer horizons (sqrt scaling)
            interval_width = pred_std * np.sqrt(session_num) * z
            p["lower"] = round(p["price"] * (1 - interval_width / 100), 2)
            p["upper"] = round(p["price"] * (1 + interval_width / 100), 2)

        forecasts[mk] = {
            "model_name": MODEL_REGISTRY[mk]["name"],
            "cv_r2": round(cv_r2, 4),
            "cv_rmse_pct": round(cv_rmse, 2),
            "predictions": preds,
        }

    # ── Ensemble ─────────────────────────────────────────────────
    # Weights based on CV R² (clamp negatives to small positive, normalize)
    raw_weights: Dict[str, float] = {}
    for mk in model_keys:
        r2 = cv_results[mk]
        raw_weights[mk] = max(r2, 0.01)  # floor at 0.01

    total_w = sum(raw_weights.values())
    weights = {mk: round(w / total_w, 4) for mk, w in raw_weights.items()}

    ensemble_preds: List[Dict[str, Any]] = []
    for step in range(1, sessions + 1):
        w_price = 0.0
        w_lower = 0.0
        w_upper = 0.0
        for mk in model_keys:
            pred_entry = forecasts[mk]["predictions"][step - 1]
            w_price += weights[mk] * pred_entry["price"]
            w_lower += weights[mk] * pred_entry["lower"]
            w_upper += weights[mk] * pred_entry["upper"]

        change_pct = (w_price - last_close) / last_close * 100.0
        ensemble_preds.append({
            "session": step,
            "price": round(w_price, 2),
            "change_pct": round(change_pct, 2),
            "lower": round(w_lower, 2),
            "upper": round(w_upper, 2),
        })

    # ── Feature Importance from RandomForest ─────────────────────
    feature_importance: Dict[str, float] = {}
    if "rf" in model_objects:
        rf_model, _ = model_objects["rf"]
        if rf_model is not None and hasattr(rf_model, "feature_importances_"):
            imp = rf_model.feature_importances_
            for i, col in enumerate(FEATURE_COLUMNS):
                feature_importance[col] = round(float(imp[i]), 4)
    # Fallback: use first available tree model
    if not feature_importance:
        for mk in ["xgboost", "gbr", "lightgbm"]:
            if mk in model_objects:
                m, _ = model_objects[mk]
                if m is not None and hasattr(m, "feature_importances_"):
                    imp = m.feature_importances_
                    for i, col in enumerate(FEATURE_COLUMNS):
                        feature_importance[col] = round(float(imp[i]), 4)
                    break

    return {
        "status": "ok",
        "symbol": None,
        "training_samples": training_samples,
        "features_count": feat_count,
        "forecasts": forecasts,
        "ensemble": {
            "model_name": "Ensemble (Weighted Average)",
            "weights": weights,
            "predictions": ensemble_preds,
        },
        "feature_importance": feature_importance,
    }


# ═══════════════════════════════════════════════════════════════════
# Routes
# ═══════════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health() -> Tuple[Any, int]:
    """Health check endpoint."""
    available = list(MODEL_REGISTRY.keys())
    if not HAS_LIGHTGBM:
        available = [k for k in available if k != "lightgbm"]
    return jsonify({
        "status": "ok",
        "service": "ml-prediction-service",
        "models_available": available,
    }), 200


@app.route("/api/predict", methods=["POST"])
def predict() -> Tuple[Any, int]:
    """ML-based multi-session price prediction.

    Request body:
        candles: list of OHLCV dicts
        sessions: int (1-30)
        models: list of model keys
    """
    try:
        body = request.get_json(force=True, silent=True)
        if body is None:
            return jsonify({"status": "error", "error": "Invalid JSON body"}), 400

        candles: List[Dict] = body.get("candles", [])
        sessions: int = int(body.get("sessions", 10))
        model_keys: List[str] = body.get("models", list(MODEL_REGISTRY.keys()))

        # Validate candles
        if not candles or not isinstance(candles, list):
            return jsonify({"status": "error", "error": "candles must be a non-empty list"}), 400

        if len(candles) < MIN_CANDLES:
            return jsonify({
                "status": "error",
                "error": f"Minimum {MIN_CANDLES} candles required, got {len(candles)}",
            }), 400

        # Validate each candle has required fields
        required_fields = {"open", "high", "low", "close", "volume"}
        for i, c in enumerate(candles):
            if not required_fields.issubset(c.keys()):
                missing = required_fields - set(c.keys())
                return jsonify({
                    "status": "error",
                    "error": f"Candle at index {i} missing fields: {missing}",
                }), 400

        # Validate sessions
        if sessions < 1 or sessions > 30:
            return jsonify({
                "status": "error",
                "error": "sessions must be between 1 and 30",
            }), 400

        # Validate models
        if not model_keys or not isinstance(model_keys, list):
            model_keys = list(MODEL_REGISTRY.keys())

        # Check cache
        ck = _cache_key(candles, sessions, model_keys)
        cached = _get_cache(ck)
        if cached is not None:
            return jsonify(cached), 200

        # Run prediction
        result = run_prediction(candles, sessions, model_keys)

        # Cache result
        _set_cache(ck, result)

        return jsonify(result), 200

    except ValueError as e:
        return jsonify({"status": "error", "error": str(e)}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "error": f"Internal error: {str(e)}"}), 500


# ═══════════════════════════════════════════════════════════════════
# Entry Point
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    available = list(MODEL_REGISTRY.keys())
    if not HAS_LIGHTGBM:
        available = [k for k in available if k != "lightgbm"]
    print(f"Starting ML Prediction Service on port {PORT}...")
    print(f"Models: {', '.join(available)}")
    print(f"Features: {len(FEATURE_COLUMNS)}")
    app.run(host="0.0.0.0", port=PORT, debug=False)
