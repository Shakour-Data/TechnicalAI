#!/usr/bin/env python3
"""
Unified ML Service — VDES Machine Learning + Time Series Analysis
Flask HTTP server on port 3040.

Merged from:
  - ml-service (port 3040): Bayesian weights, regime detection, divergence detection, pure-Python ensemble
  - ml-prediction-service (port 3032): 30+ features, sklearn models, iterative prediction, cross-validation

Endpoints:
  POST /predict          — ML multi-step price prediction (ensemble of sklearn models)
  POST /predict/simple   — Pure Python ensemble prediction (Ridge + WMA + MeanReversion)
  POST /weights          — Bayesian dynamic indicator weights
  POST /regime           — Market regime detection (5 regimes)
  POST /divergence       — Price-indicator divergence detection
  POST /train            — Train sklearn models
  POST /models           — List trained models
  POST /batch-predict    — Batch prediction
  POST /drift            — PSI drift detection
  POST /quantize         — Model quantization
  GET  /health           — Health check
"""

import hashlib
import json
import math
import statistics
import time
import traceback
import warnings
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

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

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

warnings.filterwarnings("ignore", category=UserWarning)

app = Flask(__name__)
CORS(app)

# ── Constants ───────────────────────────────────────────────
PORT = 3040
MIN_CANDLES = 60
CACHE_TTL_SECONDS = 300

# ── Model Registry ──────────────────────────────────────────
MODEL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "rf": {"name": "Random Forest", "key": "rf"},
    "xgboost": {"name": "XGBoost", "key": "xgboost"},
    "lightgbm": {"name": "LightGBM", "key": "lightgbm"},
    "svr": {"name": "SVR", "key": "svr"},
    "gbr": {"name": "Gradient Boosting", "key": "gbr"},
}

# In-memory cache
_cache: Dict[str, Tuple[Any, float]] = {}

# ── Global model storage ────────────────────────────────────
_trained_models: Dict[str, Any] = {}
_model_scalers: Dict[str, Optional[StandardScaler]] = {}


# ═══════════════════════════════════════════════════════════════
# Pure-Python math / stats helpers (from ml-service)
# ═══════════════════════════════════════════════════════════════

def _mean(seq):
    return sum(seq) / len(seq)

def _stdev(seq):
    m = _mean(seq)
    return math.sqrt(sum((x - m) ** 2 for x in seq) / len(seq))

def _dot(a, b):
    return sum(x * y for x, y in zip(a, b))

def _vec_sub(a, b):
    return [x - y for x, y in zip(a, b)]

def _vec_add(a, b):
    return [x + y for x, y in zip(a, b)]

def _scalar_mul(s, v):
    return [s * x for x in v]

def _transpose(mat):
    return list(map(list, zip(*mat)))

def _mat_mul(A, B):
    BT = _transpose(B)
    return [[sum(a * b for a, b in zip(row_a, col_b)) for col_b in BT] for row_a in A]

def _identity(n):
    return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]

def _invert_2x2(M):
    a, b = M[0]
    c, d = M[1]
    det = a * d - b * c
    if abs(det) < 1e-12:
        return None
    return [[d / det, -b / det], [-c / det, a / det]]

def _invert_matrix(M):
    n = len(M)
    if n == 2:
        r = _invert_2x2(M)
        if r is not None:
            return r
    aug = [row[:] + _identity(n)[i] for i, row in enumerate(M)]
    for col in range(n):
        max_row = max(range(col, n), key=lambda r: abs(aug[r][col]))
        aug[col], aug[max_row] = aug[max_row], aug[col]
        pivot = aug[col][col]
        if abs(pivot) < 1e-12:
            return _identity(n)
        for j in range(2 * n):
            aug[col][j] /= pivot
        for row in range(n):
            if row != col:
                factor = aug[row][col]
                for j in range(2 * n):
                    aug[row][j] -= factor * aug[col][j]
    return [row[n:] for row in aug]


# ═══════════════════════════════════════════════════════════════
# Technical indicator helpers (pure Python from ml-service)
# ═══════════════════════════════════════════════════════════════

def sma(values, period):
    if len(values) < period:
        return None
    return _mean(values[-period:])

def ema(values, period):
    if len(values) < period:
        return None
    k = 2.0 / (period + 1)
    e = _mean(values[:period])
    for v in values[period:]:
        e = v * k + e * (1 - k)
    return e

def rsi(prices, period=14):
    if len(prices) < period + 1:
        return 50.0
    deltas = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
    gains = [max(d, 0) for d in deltas]
    losses = [max(-d, 0) for d in deltas]
    avg_gain = _mean(gains[-period:])
    avg_loss = _mean(losses[-period:])
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - 100.0 / (1.0 + rs)

def adx(prices, period=14):
    if len(prices) < 2 * period + 1:
        return 25.0
    plus_dm_list = []
    minus_dm_list = []
    tr_list = []
    for i in range(1, len(prices)):
        high = max(prices[i], prices[i - 1])
        low = min(prices[i], prices[i - 1])
        prev_high = max(prices[i - 1], prices[max(0, i - 2)]) if i >= 2 else prices[i - 1]
        prev_low = min(prices[i - 1], prices[max(0, i - 2)]) if i >= 2 else prices[i - 1]
        up_move = high - prev_high
        down_move = prev_low - low
        plus_dm = max(up_move, 0) if up_move > down_move and up_move > 0 else 0
        minus_dm = max(down_move, 0) if down_move > up_move and down_move > 0 else 0
        tr = max(high - low, abs(high - prices[i - 1]), abs(low - prices[i - 1]))
        plus_dm_list.append(plus_dm)
        minus_dm_list.append(minus_dm)
        tr_list.append(tr)
    if len(tr_list) < period:
        return 25.0
    atr = _mean(tr_list[-period:])
    plus_smooth = _mean(plus_dm_list[-period:])
    minus_smooth = _mean(minus_dm_list[-period:])
    if atr == 0:
        return 25.0
    plus_di = 100 * plus_smooth / atr
    minus_di = 100 * minus_smooth / atr
    di_sum = plus_di + minus_di
    if di_sum == 0:
        return 0.0
    dx = 100 * abs(plus_di - minus_di) / di_sum
    return dx

def macd(prices, fast=12, slow=26, signal=9):
    if len(prices) < slow + signal:
        return 0.0
    ema_fast = ema(prices, fast)
    ema_slow = ema(prices, slow)
    if ema_fast is None or ema_slow is None:
        return 0.0
    macd_line = ema_fast - ema_slow
    diffs = []
    k = 2.0 / (slow + 1)
    ef = _mean(prices[:fast])
    es = _mean(prices[:slow])
    for v in prices[slow:]:
        ef = v * (2 / (fast + 1)) + ef * (1 - 2 / (fast + 1))
        es = v * k + es * (1 - k)
        diffs.append(ef - es)
    if len(diffs) < signal:
        return macd_line
    sig = ema(diffs, signal)
    if sig is None:
        return macd_line
    return macd_line - sig

def rolling_std(values, period):
    if len(values) < period:
        return 0.0
    window = values[-period:]
    return _stdev(window)

def rolling_max(values, period):
    if len(values) < period:
        return max(values) if values else 0
    return max(values[-period:])

def rolling_min(values, period):
    if len(values) < period:
        return min(values) if values else 0
    return min(values[-period:])


# ═══════════════════════════════════════════════════════════════
# Feature Engineering (unified: 30+ features from ml-prediction-service
#                       + pure Python features from ml-service)
# ═══════════════════════════════════════════════════════════════

def compute_returns(prices):
    return [(prices[i] - prices[i - 1]) / prices[i - 1] if prices[i - 1] != 0 else 0
            for i in range(1, len(prices))]

def compute_log_returns(prices):
    return [math.log(prices[i] / prices[i - 1]) if prices[i - 1] > 0 and prices[i] > 0 else 0
            for i in range(1, len(prices))]

def build_features(prices, volume=None):
    """Build feature vector from price series (pure Python, 24 features)."""
    if len(prices) < 5:
        return []

    feats = []
    n = len(prices)

    for lag in [1, 2, 3, 5, 10]:
        if n > lag and prices[-lag - 1] != 0:
            feats.append(prices[-1] / prices[-lag - 1] - 1)
        else:
            feats.append(0.0)

    rets = compute_returns(prices)
    if rets:
        feats.append(rets[-1])
    else:
        feats.append(0.0)
    if len(rets) >= 5:
        feats.append(_mean(rets[-5:]))
    else:
        feats.append(_mean(rets) if rets else 0.0)

    if len(rets) >= 5:
        feats.append(_stdev(rets[-5:]))
    else:
        feats.append(0.0)
    if len(rets) >= 10:
        feats.append(_stdev(rets[-10:]))
    else:
        feats.append(_stdev(rets) if rets else 0.0)

    for period in [5, 10, 20]:
        m = sma(prices, period)
        if m and m != 0:
            feats.append(prices[-1] / m - 1)
        else:
            feats.append(0.0)

    for period in [12, 26]:
        e = ema(prices, period)
        if e and e != 0:
            feats.append(prices[-1] / e - 1)
        else:
            feats.append(0.0)

    feats.append(rsi(prices) / 100.0)
    feats.append(adx(prices) / 100.0)

    mh = macd(prices)
    if prices[-1] != 0:
        feats.append(mh / prices[-1])
    else:
        feats.append(0.0)

    for period in [20]:
        if len(prices) >= period:
            m = sma(prices, period)
            s = rolling_std(prices, period)
            if s and s != 0:
                feats.append((prices[-1] - m) / (2 * s))
            else:
                feats.append(0.0)
        else:
            feats.append(0.0)

    if volume and len(volume) >= 5:
        vol_rets = [(volume[i] - volume[i - 1]) / volume[i - 1]
                     if volume[i - 1] != 0 else 0
                     for i in range(1, len(volume))]
        feats.append(_mean(vol_rets[-5:]) if len(vol_rets) >= 5 else _mean(vol_rets) if vol_rets else 0.0)
        feats.append(_stdev(vol_rets[-5:]) if len(vol_rets) >= 5 else 0.0)
        if len(rets) >= 5 and len(vol_rets) >= 5:
            r = rets[-5:]
            v = vol_rets[-5:]
            rm = _mean(r)
            vm = _mean(v)
            num = sum((ri - rm) * (vi - vm) for ri, vi in zip(r, v))
            den = _stdev(r) * _stdev(v) * 5
            feats.append(num / den if den != 0 else 0.0)
        else:
            feats.append(0.0)
    else:
        feats.extend([0.0, 0.0, 0.0])

    if n >= 5:
        feats.append((prices[-1] / prices[-5] - 1))
    else:
        feats.append(0.0)
    if n >= 10:
        feats.append((prices[-1] / prices[-10] - 1))
    else:
        feats.append(0.0)

    return feats


def build_target(prices, step=1):
    if len(prices) <= step:
        return 0.0
    return (prices[-step - 1] / prices[-1] - 1) if prices[-1] != 0 else 0.0

def build_dataset(prices, volume=None, max_lag=30):
    X = []
    y = []
    min_len = 30
    if len(prices) < min_len:
        return X, y
    for i in range(min_len, len(prices) - 1):
        window_prices = prices[:i]
        window_vol = volume[:i] if volume else None
        feats = build_features(window_prices, window_vol)
        if not feats:
            continue
        X.append(feats)
        y.append(prices[i] / prices[i - 1] - 1 if prices[i - 1] != 0 else 0.0)
    return X, y


# ═══════════════════════════════════════════════════════════════
# Pandas feature engineering (from ml-prediction-service)
# ═══════════════════════════════════════════════════════════════

def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute 30+ technical features from OHLCV data."""
    df = df.copy()
    c = df["close"].astype(float)
    h = df["high"].astype(float)
    l = df["low"].astype(float)
    o = df["open"].astype(float)
    v = df["volume"].astype(float)

    for period in [1, 3, 5, 10, 20]:
        df[f"ret_{period}"] = c.pct_change(period)

    for period in [5, 10, 20, 50]:
        sma_val = c.rolling(window=period, min_periods=1).mean()
        df[f"close_sma{period}"] = c / sma_val

    for period in [12, 26]:
        ema_val = c.ewm(span=period, adjust=False).mean()
        df[f"close_ema{period}"] = c / ema_val

    for period in [7, 14]:
        delta = c.diff()
        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)
        avg_gain = gain.ewm(alpha=1.0 / period, min_periods=1, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / period, min_periods=1, adjust=False).mean()
        rs = avg_gain / (avg_loss + 1e-10)
        df[f"rsi_{period}"] = 100.0 - (100.0 / (1.0 + rs))

    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    macd_signal = macd_line.ewm(span=9, adjust=False).mean()
    df["macd"] = macd_line / (c + 1e-10)
    df["macd_signal"] = macd_signal / (c + 1e-10)
    df["macd_hist"] = (macd_line - macd_signal) / (c + 1e-10)

    lowest_low = l.rolling(window=14, min_periods=1).min()
    highest_high = h.rolling(window=14, min_periods=1).max()
    stoch_k = 100.0 * (c - lowest_low) / (highest_high - lowest_low + 1e-10)
    df["stoch_k"] = stoch_k
    df["stoch_d"] = stoch_k.rolling(window=3, min_periods=1).mean()

    tp = (h + l + c) / 3.0
    sma_tp = tp.rolling(window=20, min_periods=1).mean()
    mad = tp.rolling(window=20, min_periods=1).apply(
        lambda x: np.mean(np.abs(x - x.mean())), raw=True
    )
    df["cci"] = (tp - sma_tp) / (0.015 * mad + 1e-10)

    hh14 = h.rolling(window=14, min_periods=1).max()
    ll14 = l.rolling(window=14, min_periods=1).min()
    df["williams_r"] = -100.0 * (hh14 - c) / (hh14 - ll14 + 1e-10)

    df["adx"], df["di_plus"], df["di_minus"] = _compute_adx(h, l, c, 14)

    tr = pd.concat([h - l, (h - c.shift(1)).abs(), (l - c.shift(1)).abs()], axis=1).max(axis=1)
    atr = tr.rolling(window=14, min_periods=1).mean()
    df["atr_norm"] = atr / (c + 1e-10)

    sma20 = c.rolling(window=20, min_periods=1).mean()
    std20 = c.rolling(window=20, min_periods=1).std()
    bb_upper = sma20 + 2.0 * std20
    bb_lower = sma20 - 2.0 * std20
    df["bb_pos"] = (c - bb_lower) / (bb_upper - bb_lower + 1e-10)

    vol_sma20 = v.rolling(window=20, min_periods=1).mean()
    df["vol_ratio"] = v / (vol_sma20 + 1e-10)

    obv = pd.Series(0.0, index=df.index, dtype=float)
    for i in range(1, len(df)):
        if c.iloc[i] > c.iloc[i - 1]:
            obv.iloc[i] = obv.iloc[i - 1] + v.iloc[i]
        elif c.iloc[i] < c.iloc[i - 1]:
            obv.iloc[i] = obv.iloc[i - 1] - v.iloc[i]
        else:
            obv.iloc[i] = obv.iloc[i - 1]
    df["obv_trend_5"] = obv.pct_change(5)

    df["hl_range"] = (h - l) / (c + 1e-10)
    df["oc_range"] = (o - c).abs() / (c + 1e-10)
    df["upper_shadow"] = (h - pd.concat([o, c], axis=1).max(axis=1)) / (c + 1e-10)
    df["lower_shadow"] = (pd.concat([o, c], axis=1).min(axis=1) - l) / (c + 1e-10)

    df["momentum_10"] = c - c.shift(10)
    df["momentum_10"] = df["momentum_10"] / (c + 1e-10)

    df["roc_10"] = (c - c.shift(10)) / (c.shift(10) + 1e-10) * 100.0

    low20 = l.rolling(window=20, min_periods=1).min()
    high20 = h.rolling(window=20, min_periods=1).max()
    df["price_pos_20"] = (c - low20) / (high20 - low20 + 1e-10)

    return df


def _compute_adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14):
    n = len(close)
    adx = pd.Series(np.nan, index=close.index)
    di_plus = pd.Series(np.nan, index=close.index)
    di_minus = pd.Series(np.nan, index=close.index)

    if n < 2:
        return adx, di_plus, di_minus

    up_move = high.diff()
    down_move = low.shift(1).sub(low)
    plus_dm = up_move.where((up_move > down_move) & (up_move > 0), 0.0)
    minus_dm = down_move.where((down_move > up_move) & (down_move > 0), 0.0)

    tr = pd.concat([high - low, (high - close.shift(1)).abs(), (low - close.shift(1)).abs()], axis=1).max(axis=1)
    atr_smooth = tr.rolling(window=period, min_periods=1).mean()
    smooth_plus = plus_dm.rolling(window=period, min_periods=1).mean()
    smooth_minus = minus_dm.rolling(window=period, min_periods=1).mean()

    di_plus = 100.0 * smooth_plus / (atr_smooth + 1e-10)
    di_minus = 100.0 * smooth_minus / (atr_smooth + 1e-10)
    dx = 100.0 * (di_plus - di_minus).abs() / (di_plus + di_minus + 1e-10)
    adx = dx.rolling(window=period, min_periods=1).mean()

    return adx, di_plus, di_minus


FEATURE_COLUMNS: List[str] = [
    "ret_1", "ret_3", "ret_5", "ret_10", "ret_20",
    "close_sma5", "close_sma10", "close_sma20", "close_sma50",
    "close_ema12", "close_ema26",
    "rsi_7", "rsi_14",
    "macd", "macd_signal", "macd_hist",
    "stoch_k", "stoch_d",
    "cci",
    "williams_r",
    "adx", "di_plus", "di_minus",
    "atr_norm",
    "bb_pos",
    "vol_ratio", "obv_trend_5",
    "hl_range", "oc_range", "upper_shadow", "lower_shadow",
    "momentum_10", "roc_10",
    "price_pos_20",
]


# ═══════════════════════════════════════════════════════════════
# Model 1: Ridge Regression (from ml-service)
# ═══════════════════════════════════════════════════════════════

class RidgeRegression:
    def __init__(self, alpha=1.0):
        self.alpha = alpha
        self.weights = None
        self.bias = 0.0
        self.fitted = False

    def fit(self, X, y):
        if len(X) < 3 or len(X[0]) < 1:
            self.fitted = False
            return self
        n = len(X)
        p = len(X[0])
        y_mean = _mean(y)
        y_c = [yi - y_mean for yi in y]
        x_means = [_mean([X[j][i] for j in range(n)]) for i in range(p)]
        X_c = [[X[j][i] - x_means[i] for i in range(p)] for j in range(n)]
        XT = _transpose(X_c)
        XTX = _mat_mul(XT, X_c)
        reg = _identity(p)
        XTX_reg = [[XTX[i][j] + (self.alpha if i == j else 0) for j in range(p)] for i in range(p)]
        XTX_inv = _invert_matrix(XTX_reg)
        XTy = [sum(XT[i][j] * y_c[j] for j in range(n)) for i in range(p)]
        self.weights = [sum(XTX_inv[i][j] * XTy[j] for j in range(p)) for i in range(p)]
        self.bias = y_mean - sum(self.weights[i] * x_means[i] for i in range(p))
        self.fitted = True
        return self

    def predict(self, X):
        if not self.fitted or not self.weights:
            return [0.0] * len(X)
        return [sum(self.weights[j] * row[j] for j in range(len(row))) + self.bias for row in X]

    def predict_single(self, x):
        if not self.fitted or not self.weights:
            return 0.0
        return sum(self.weights[j] * x[j] for j in range(len(x))) + self.bias


# ═══════════════════════════════════════════════════════════════
# Pure Python models (from ml-service)
# ═══════════════════════════════════════════════════════════════

def wma_predict(prices, steps=5):
    if len(prices) < 3:
        return [0.0] * steps
    rets = compute_returns(prices)
    if not rets:
        return [0.0] * steps
    n_rets = min(len(rets), 20)
    recent_rets = rets[-n_rets:]
    weights = [math.exp(-0.1 * (n_rets - 1 - i)) for i in range(n_rets)]
    w_sum = sum(weights)
    weights = [w / w_sum for w in weights]
    expected_return = sum(w * r for w, r in zip(weights, recent_rets))
    if len(recent_rets) >= 5:
        vol = _stdev(rets[-5:])
    else:
        vol = _stdev(rets)
    predictions = []
    last_price = prices[-1]
    for step in range(steps):
        decay = math.exp(-0.05 * step)
        ret = expected_return * decay
        last_price = last_price * (1 + ret)
        predictions.append(last_price)
    return predictions

def mean_reversion_predict(prices, steps=5):
    if len(prices) < 10:
        return [0.0] * steps
    lookbacks = [10, 20, 50]
    means = []
    for lb in lookbacks:
        if len(prices) >= lb:
            means.append(sma(prices, lb))
        else:
            means.append(sma(prices, len(prices)))
    weights = [0.2, 0.3, 0.5][:len(means)]
    w_sum = sum(weights)
    weights = [w / w_sum for w in weights]
    target_mean = sum(w * m for w, m in zip(weights, means) if m is not None)
    if target_mean is None or target_mean == 0:
        return [prices[-1]] * steps
    deviation = (prices[-1] - target_mean) / target_mean
    rets = compute_returns(prices)
    vol = _stdev(rets[-10:]) if len(rets) >= 10 else (_stdev(rets) if rets else 0.01)
    if vol == 0:
        vol = 0.01
    reversion_speed = 0.1
    reversion_strength = -reversion_speed * deviation
    predictions = []
    last_price = prices[-1]
    for step in range(steps):
        current_dev = (last_price - target_mean) / target_mean
        adj_return = -reversion_speed * current_dev * 0.5
        last_price = last_price * (1 + adj_return)
        predictions.append(last_price)
    return predictions

def ensemble_predict(prices, volume=None, steps=5):
    if len(prices) < 10:
        last = prices[-1]
        ret = (prices[-1] / prices[-2] - 1) if len(prices) >= 2 and prices[-2] != 0 else 0
        rets_short = compute_returns(prices)
        vol_short = _stdev(rets_short) if len(rets_short) >= 2 else 0.02
        predictions = []
        conf_intervals = []
        for i in range(steps):
            p = last * (1 + ret * (i + 1) * 0.3)
            predictions.append(p)
            width = p * vol_short * math.sqrt(i + 1) * 1.96
            conf_intervals.append([p - width, p + width])
        return {
            "predictions": [round(p, 6) for p in predictions],
            "confidence": 0.1,
            "conf_intervals": [[round(lo, 6), round(hi, 6)] for lo, hi in conf_intervals],
            "predicted_return_5d": ret * 1.5,
        }
    steps = max(1, min(steps, 30))
    X, y = build_dataset(prices, volume)
    ridge_preds = None
    ridge_score = 0.0
    residuals = []
    if len(X) >= 10:
        split = int(len(X) * 0.7)
        X_train, X_val = X[:split], X[split:]
        y_train, y_val = y[:split], y[split:]
        model = RidgeRegression(alpha=0.5)
        model.fit(X_train, y_train)
        if model.fitted and X_val:
            val_preds = model.predict(X_val)
            ym = _mean(y_val)
            ss_res = sum((yp - yt) ** 2 for yp, yt in zip(val_preds, y_val))
            ss_tot = sum((yt - ym) ** 2 for yt in y_val)
            ridge_score = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
            ridge_score = max(0.0, min(1.0, ridge_score))
            residuals = [yp - yt for yp, yt in zip(val_preds, y_val)]
        ridge_preds = []
        last_price = prices[-1]
        for step in range(steps):
            feats = build_features(prices, volume)
            if feats and model.fitted:
                pred_return = model.predict_single(feats)
                pred_return = max(-0.05, min(0.05, pred_return))
            else:
                rets = compute_returns(prices)
                pred_return = _mean(rets[-5:]) if len(rets) >= 5 else (_mean(rets) if rets else 0)
            last_price = last_price * (1 + pred_return)
            ridge_preds.append(last_price)
            prices = prices + [last_price]
            if volume:
                avg_vol = _mean(volume[-5:]) if len(volume) >= 5 else _mean(volume)
                volume = volume + [avg_vol]
        prices = prices[:-(steps)]
        if volume:
            volume = volume[:-(steps)]
    else:
        ridge_preds = [prices[-1]] * steps
        ridge_score = 0.0
    wma_preds = wma_predict(prices, steps)
    mr_preds = mean_reversion_predict(prices, steps)
    wma_score = 0.0
    mr_score = 0.0
    if len(prices) >= 15:
        actual_next = prices[-5:] if len(prices) >= 20 else prices[-(len(prices) - 15):]
        wma_test = wma_predict(prices[-20:-5] if len(prices) >= 20 else prices[:-5], len(actual_next))
        mr_test = mean_reversion_predict(prices[-20:-5] if len(prices) >= 20 else prices[:-5], len(actual_next))
        for pred_list, score_ref in [(wma_test, 'wma'), (mr_test, 'mr')]:
            if len(pred_list) == len(actual_next) and actual_next:
                ss_res = sum((p - a) ** 2 for p, a in zip(pred_list, actual_next))
                ss_tot = sum((a - _mean(actual_next)) ** 2 for a in actual_next)
                sc = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
                sc = max(0.0, min(1.0, sc))
                if score_ref == 'wma':
                    wma_score = sc
                else:
                    mr_score = sc
    scores = [ridge_score + 0.05, wma_score + 0.05, mr_score + 0.05]
    total_score = sum(scores)
    w = [s / total_score for s in scores]
    if len(X) < 10:
        w = [0.1, 0.45, 0.45]
    final_preds = []
    for i in range(steps):
        p = w[0] * ridge_preds[i] + w[1] * wma_preds[i] + w[2] * mr_preds[i]
        final_preds.append(p)
    if residuals:
        resid_std = _stdev(residuals)
    else:
        rets = compute_returns(prices)
        resid_std = _stdev(rets[-10:]) if len(rets) >= 10 else (_stdev(rets) if rets else 0.01)
    confidence = max(0.1, min(0.95, ridge_score * 0.6 + wma_score * 0.2 + mr_score * 0.2 + 0.1))
    conf_intervals = []
    for i, p in enumerate(final_preds):
        width = resid_std * p * (1 + 0.15 * i) * 1.96
        conf_intervals.append([p - width, p + width])
    if len(final_preds) >= 5:
        predicted_return_5d = final_preds[4] / final_preds[0] - 1 if final_preds[0] != 0 else 0
    elif final_preds:
        predicted_return_5d = final_preds[-1] / prices[-1] - 1 if prices[-1] != 0 else 0
    else:
        predicted_return_5d = 0.0
    return {
        "predictions": [round(p, 6) for p in final_preds],
        "confidence": round(confidence, 4),
        "conf_intervals": [[round(lo, 6), round(hi, 6)] for lo, hi in conf_intervals],
        "predicted_return_5d": round(predicted_return_5d, 6),
    }


# ═══════════════════════════════════════════════════════════════
# Bayesian Weights (from ml-service)
# ═══════════════════════════════════════════════════════════════

def compute_bayesian_weights(features, regime="sideways", has_volume=True):
    priors = {
        "trend": 0.28,
        "oscillator": 0.25,
        "volume": 0.15,
        "volatility": 0.10,
        "leading": 0.12,
        "patterns": 0.10,
    }
    if not has_volume:
        vol_prior = priors["volume"]
        del priors["volume"]
        total_other = sum(priors.values())
        for k in priors:
            priors[k] += vol_prior * (priors[k] / total_other)
    likelihoods = {}
    trend_indicators = ["sma_20", "ema_12", "ema_26", "macd_signal", "adx"]
    oscillator_indicators = ["rsi", "stoch_k", "stoch_d", "williams_r", "cci"]
    volume_indicators = ["obv", "vwap", "vol_sma", "vol_ratio"]
    volatility_indicators = ["atr", "bb_width", "bb_position", "keltner_width"]
    leading_indicators = ["ichimoku", "pivot", "fibonacci", "donchian"]
    pattern_indicators = ["candle_patterns", "harmonic", "chart_patterns", "support_resistance"]
    def count_matching(keys):
        return sum(1 for k in keys if k in features and features[k] is not None)
    trend_count = count_matching(trend_indicators)
    osc_count = count_matching(oscillator_indicators)
    vol_count = count_matching(volume_indicators) if has_volume else 0
    var_count = count_matching(volatility_indicators)
    lead_count = count_matching(leading_indicators)
    pat_count = count_matching(pattern_indicators)
    regime_boost = {
        "strong_bull": {"trend": 1.3, "oscillator": 0.8, "volatility": 0.7, "leading": 1.1, "patterns": 0.9},
        "weak_bull": {"trend": 1.1, "oscillator": 1.0, "volatility": 0.9, "leading": 1.0, "patterns": 1.0},
        "sideways": {"trend": 0.7, "oscillator": 1.2, "volatility": 1.2, "leading": 0.9, "patterns": 1.1},
        "weak_bear": {"trend": 1.0, "oscillator": 1.1, "volatility": 1.0, "leading": 1.0, "patterns": 1.0},
        "strong_bear": {"trend": 1.3, "oscillator": 0.8, "volatility": 0.7, "leading": 1.1, "patterns": 0.9},
    }
    boost = regime_boost.get(regime, regime_boost["sideways"])
    def feature_boost(count):
        if count == 0:
            return 0.3
        elif count == 1:
            return 0.7
        elif count == 2:
            return 0.9
        else:
            return 1.0
    base_likelihood = {
        "trend": 0.6,
        "oscillator": 0.6,
        "volatility": 0.55,
        "leading": 0.5,
        "patterns": 0.5,
    }
    if has_volume:
        base_likelihood["volume"] = 0.55
    for cat in base_likelihood:
        count = {
            "trend": trend_count,
            "oscillator": osc_count,
            "volume": vol_count,
            "volatility": var_count,
            "leading": lead_count,
            "patterns": pat_count,
        }.get(cat, 0)
        fb = feature_boost(count)
        rb = boost.get(cat, 1.0)
        likelihoods[cat] = base_likelihood[cat] * fb * rb
    rsi_val = features.get("rsi")
    if rsi_val is not None:
        if rsi_val > 70 or rsi_val < 30:
            likelihoods["oscillator"] *= 1.2
    macd_val = features.get("macd_hist")
    if macd_val is not None and abs(macd_val) > 0:
        likelihoods["trend"] *= 1.1
    adx_val = features.get("adx")
    if adx_val is not None and adx_val > 25:
        likelihoods["trend"] *= 1.15
    posterior = {}
    Z = 0.0
    for cat in priors:
        posterior[cat] = likelihoods.get(cat, 0.5) * priors[cat]
        Z += posterior[cat]
    if Z > 0:
        for cat in posterior:
            posterior[cat] /= Z
    weights = {}
    all_indicators = {
        "trend": trend_indicators,
        "oscillator": oscillator_indicators,
        "volume": volume_indicators,
        "volatility": volatility_indicators,
        "leading": leading_indicators,
        "patterns": pattern_indicators,
    }
    for cat, indicators in all_indicators.items():
        cat_weight = posterior.get(cat, 0.0)
        present = [ind for ind in indicators if ind in features and features[ind] is not None]
        if present:
            per_ind = cat_weight / len(present)
            for ind in present:
                weights[ind] = round(per_ind, 4)
        elif cat in priors:
            pass
    total = sum(weights.values())
    if total > 0:
        weights = {k: round(v / total, 4) for k, v in weights.items()}
    else:
        n_keys = len(features)
        if n_keys > 0:
            w = 1.0 / n_keys
            weights = {k: round(w, 4) for k in features if features[k] is not None}
    return {
        "weights": weights,
        "prior_trend": round(priors.get("trend", 0), 4),
        "prior_oscillator": round(priors.get("oscillator", 0), 4),
        "prior_volume": round(priors.get("volume", 0), 4) if has_volume else 0,
        "prior_volatility": round(priors.get("volatility", 0), 4),
        "prior_leading": round(priors.get("leading", 0), 4),
        "prior_patterns": round(priors.get("patterns", 0), 4),
    }


# ═══════════════════════════════════════════════════════════════
# Regime Detection (from ml-service)
# ═══════════════════════════════════════════════════════════════

def detect_regime(prices):
    if len(prices) < 10:
        return {"regime": "sideways", "probabilities": {
            "strong_bull": 0.1, "weak_bull": 0.2, "sideways": 0.4,
            "weak_bear": 0.2, "strong_bear": 0.1,
        }}
    adx_val = adx(prices)
    trend_strength = adx_val / 100.0
    rets = compute_returns(prices)
    if not rets:
        return {"regime": "sideways", "probabilities": {
            "strong_bull": 0.1, "weak_bull": 0.2, "sideways": 0.4,
            "weak_bear": 0.2, "strong_bear": 0.1,
        }}
    ret_5 = sum(rets[-5:]) if len(rets) >= 5 else sum(rets)
    ret_10 = sum(rets[-10:]) if len(rets) >= 10 else sum(rets)
    ret_20 = sum(rets[-20:]) if len(rets) >= 20 else ret_10
    pos_rets = [r for r in rets if r > 0]
    neg_rets = [r for r in rets if r < 0]
    pos_ratio = len(pos_rets) / len(rets) if rets else 0.5
    direction_score = 0.0
    direction_score += ret_5 * 3.0
    direction_score += ret_10 * 1.5
    direction_score += ret_20 * 1.0
    direction_score += (pos_ratio - 0.5) * 0.3
    rsi_val = rsi(prices)
    direction_score += (rsi_val - 50) / 100.0 * 0.5
    if len(rets) >= 10:
        vol = _stdev(rets[-10:])
    else:
        vol = _stdev(rets)
    vol_score = min(1.0, vol * 10)
    strong_trend_threshold = 0.4
    moderate_trend_threshold = 0.2
    regimes = ["strong_bull", "weak_bull", "sideways", "weak_bear", "strong_bear"]
    scores = {}
    scores["strong_bull"] = (
        max(0, trend_strength - moderate_trend_threshold) * 2.0 +
        max(0, direction_score) * 1.5 +
        vol_score * 0.3
    )
    scores["weak_bull"] = (
        max(0, trend_strength - moderate_trend_threshold * 0.5) * 1.0 +
        max(0, direction_score) * 1.0 +
        (1 - vol_score) * 0.3
    )
    scores["sideways"] = (
        (1 - trend_strength) * 1.5 +
        (1 - min(1, abs(direction_score) * 3)) * 1.0 +
        (1 - vol_score) * 0.2
    )
    scores["weak_bear"] = (
        max(0, trend_strength - moderate_trend_threshold * 0.5) * 1.0 +
        max(0, -direction_score) * 1.0 +
        (1 - vol_score) * 0.3
    )
    scores["strong_bear"] = (
        max(0, trend_strength - moderate_trend_threshold) * 2.0 +
        max(0, -direction_score) * 1.5 +
        vol_score * 0.3
    )
    max_score = max(scores.values())
    exp_scores = {r: math.exp(s - max_score) for r, s in scores.items()}
    total = sum(exp_scores.values())
    probs = {r: round(exp_scores[r] / total, 4) for r in regimes}
    best_regime = max(regimes, key=lambda r: probs[r])
    return {
        "regime": best_regime,
        "probabilities": probs,
    }


# ═══════════════════════════════════════════════════════════════
# Divergence Detection (from ml-service)
# ═══════════════════════════════════════════════════════════════

def detect_divergence(prices, indicator_values, indicator_name="rsi"):
    min_len = 10
    if len(prices) < min_len or len(indicator_values) < min_len:
        return {"type": "none", "strength": 0.0, "start_idx": -1}
    n = min(len(prices), len(indicator_values))
    p = prices[-n:]
    ind = indicator_values[-n:]
    lookback = min(n, 30)
    window_p = p[-lookback:]
    window_ind = ind[-lookback:]
    def find_extrema(values, min_distance=3):
        highs = []
        lows = []
        for i in range(1, len(values) - 1):
            is_high = True
            is_low = True
            for j in range(max(0, i - min_distance), min(len(values), i + min_distance + 1)):
                if values[j] > values[i]:
                    is_high = False
                if values[j] < values[i]:
                    is_low = False
            if is_high and (not highs or i - highs[-1][0] >= min_distance):
                highs.append((i, values[i]))
            if is_low and (not lows or i - lows[-1][0] >= min_distance):
                lows.append((i, values[i]))
        return highs, lows
    p_highs, p_lows = find_extrema(window_p)
    i_highs, i_lows = find_extrema(window_ind)
    bearish_strength = 0.0
    bearish_start = -1
    if len(p_highs) >= 2 and len(i_highs) >= 2:
        ph_last = p_highs[-1]
        ph_prev = p_highs[-2]
        ih_last = i_highs[-1]
        ih_prev = i_highs[-2]
        if ph_last[1] > ph_prev[1] and ih_last[1] < ih_prev[1]:
            price_diff = (ph_last[1] - ph_prev[1]) / ph_prev[1] if ph_prev[1] != 0 else 0
            ind_diff = (ih_prev[1] - ih_last[1]) / ih_prev[1] if ih_prev[1] != 0 else 0
            bearish_strength = min(1.0, (price_diff + ind_diff) * 10)
            bearish_start = ph_prev[0]
    bullish_strength = 0.0
    bullish_start = -1
    if len(p_lows) >= 2 and len(i_lows) >= 2:
        pl_last = p_lows[-1]
        pl_prev = p_lows[-2]
        il_last = i_lows[-1]
        il_prev = i_lows[-2]
        if pl_last[1] < pl_prev[1] and il_last[1] > il_prev[1]:
            price_diff = (pl_prev[1] - pl_last[1]) / pl_prev[1] if pl_prev[1] != 0 else 0
            ind_diff = (il_last[1] - il_prev[1]) / il_prev[1] if il_prev[1] != 0 else 0
            bullish_strength = min(1.0, (price_diff + ind_diff) * 10)
            bullish_start = pl_prev[0]
    if bearish_strength == 0 and bullish_strength == 0 and len(window_p) >= 10:
        p_slope = (window_p[-1] - window_p[-10]) / window_p[-10] if window_p[-10] != 0 else 0
        i_slope = (window_ind[-1] - window_ind[-10]) / abs(window_ind[-10]) if window_ind[-10] != 0 else 0
        ind_range = max(window_ind) - min(window_ind)
        if ind_range > 0:
            i_slope_norm = (window_ind[-1] - window_ind[-10]) / ind_range
        else:
            i_slope_norm = 0
        p_range = max(window_p) - min(window_p)
        if p_range > 0:
            p_slope_norm = (window_p[-1] - window_p[-10]) / p_range
        else:
            p_slope_norm = 0
        if p_slope_norm > 0.1 and i_slope_norm < -0.1:
            bearish_strength = min(1.0, abs(p_slope_norm) + abs(i_slope_norm))
            bearish_start = len(window_p) - 10
        elif p_slope_norm < -0.1 and i_slope_norm > 0.1:
            bullish_strength = min(1.0, abs(p_slope_norm) + abs(i_slope_norm))
            bullish_start = len(window_p) - 10
    min_strength_threshold = 0.15
    if bullish_strength > bearish_strength and bullish_strength >= min_strength_threshold:
        return {"type": "bullish", "strength": round(bullish_strength, 4), "start_idx": bullish_start}
    elif bearish_strength > bullish_strength and bearish_strength >= min_strength_threshold:
        return {"type": "bearish", "strength": round(bearish_strength, 4), "start_idx": bearish_start}
    else:
        return {"type": "none", "strength": 0.0, "start_idx": -1}


# ═══════════════════════════════════════════════════════════════
# sklearn Model Builders (from ml-prediction-service)
# ═══════════════════════════════════════════════════════════════

def build_model(model_key: str) -> Any:
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


# ═══════════════════════════════════════════════════════════════
# Core: Train, Cross-Validate, Predict (from ml-prediction-service)
# ═══════════════════════════════════════════════════════════════

def prepare_dataset(candles: List[Dict[str, Any]]) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, int]:
    df = pd.DataFrame(candles)
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df_feat = compute_features(df)
    df_feat["target"] = df_feat["close"].pct_change(1).shift(-1) * 100.0
    valid_mask = df_feat[FEATURE_COLUMNS + ["target"]].notna().all(axis=1)
    df_clean = df_feat[valid_mask].copy()
    df_clean = df_clean.replace([np.inf, -np.inf], np.nan)
    valid_mask2 = df_clean[FEATURE_COLUMNS + ["target"]].notna().all(axis=1)
    df_clean = df_clean[valid_mask2].copy()
    X = df_clean[FEATURE_COLUMNS]
    y = df_clean["target"]
    return df_clean, X, y, len(FEATURE_COLUMNS)

def cross_validate_model(model: Any, X: pd.DataFrame, y: pd.Series, model_key: str, n_splits: int = 5) -> Tuple[float, float, float]:
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

def train_final_model(model_key: str, X: pd.DataFrame, y: pd.Series) -> Tuple[Any, Optional[StandardScaler]]:
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

def iterative_predict(model: Any, model_key: str, scaler: Optional[StandardScaler],
                      last_features: np.ndarray, current_close: float,
                      df_all: pd.DataFrame, n_sessions: int) -> List[Dict[str, float]]:
    predictions: List[Dict[str, float]] = []
    df_sim = df_all.copy()
    feat = last_features.copy()
    price = current_close
    for step in range(1, n_sessions + 1):
        if scaler is not None:
            feat_2d = feat.reshape(1, -1)
            feat_scaled = scaler.transform(feat_2d)
            pred_return = float(model.predict(feat_scaled)[0])
        else:
            pred_return = float(model.predict(feat.reshape(1, -1))[0])
        new_price = price * (1.0 + pred_return / 100.0)
        change_pct = (new_price - current_close) / current_close * 100.0
        predictions.append({
            "session": step,
            "price": round(new_price, 2),
            "change_pct": round(change_pct, 2),
        })
        if step < n_sessions:
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


# ═══════════════════════════════════════════════════════════════
# Cache Helpers (from ml-prediction-service)
# ═══════════════════════════════════════════════════════════════

def _cache_key(candles: List[Dict], sessions: int, models: List[str]) -> str:
    raw = json.dumps({"c": candles, "s": sessions, "m": sorted(models)}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()

def _get_cache(key: str) -> Optional[Any]:
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL_SECONDS:
            return data
        del _cache[key]
    return None

def _set_cache(key: str, data: Any) -> None:
    _cache[key] = (data, time.time())


# ═══════════════════════════════════════════════════════════════
# Main Prediction Logic (merged)
# ═══════════════════════════════════════════════════════════════

def run_prediction(candles: List[Dict[str, Any]], sessions: int, model_keys: List[str]) -> Dict[str, Any]:
    available = list(MODEL_REGISTRY.keys())
    if HAS_LIGHTGBM is False:
        available = [k for k in available if k != "lightgbm"]
    for mk in model_keys:
        if mk not in available:
            raise ValueError(f"Unknown model: {mk}. Available: {available}")
    df_clean, X, y, feat_count = prepare_dataset(candles)
    training_samples = len(X)
    if training_samples < 30:
        raise ValueError(
            f"Not enough valid samples after feature computation. "
            f"Need at least 30, got {training_samples}. "
            f"Provide more candle data (minimum 60 recommended)."
        )
    df_raw = pd.DataFrame(candles)
    for col in ["open", "high", "low", "close", "volume"]:
        df_raw[col] = pd.to_numeric(df_raw[col], errors="coerce")
    df_raw = df_raw.dropna(subset=["close"])
    last_close = float(df_raw["close"].iloc[-1])
    last_feat_row = df_clean.iloc[-1]
    last_features = np.array(
        [float(last_feat_row[col]) if not pd.isna(last_feat_row[col]) else 0.0 for col in FEATURE_COLUMNS],
        dtype=np.float64,
    )
    forecasts: Dict[str, Any] = {}
    cv_results: Dict[str, float] = {}
    model_objects: Dict[str, Tuple[Any, Optional[StandardScaler]]] = {}
    for mk in model_keys:
        cv_r2, cv_rmse, pred_std = cross_validate_model(build_model(mk), X, y, mk)
        cv_results[mk] = cv_r2
        final_model, scaler = train_final_model(mk, X, y)
        model_objects[mk] = (final_model, scaler)
        preds = iterative_predict(
            final_model, mk, scaler, last_features, last_close, df_raw, sessions
        )
        z = 1.96
        for p in preds:
            session_num = p["session"]
            interval_width = pred_std * np.sqrt(session_num) * z
            p["lower"] = round(p["price"] * (1 - interval_width / 100), 2)
            p["upper"] = round(p["price"] * (1 + interval_width / 100), 2)
        forecasts[mk] = {
            "model_name": MODEL_REGISTRY[mk]["name"],
            "cv_r2": round(cv_r2, 4),
            "cv_rmse_pct": round(cv_rmse, 2),
            "predictions": preds,
        }
    raw_weights: Dict[str, float] = {}
    for mk in model_keys:
        r2 = cv_results[mk]
        raw_weights[mk] = max(r2, 0.01)
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
    feature_importance: Dict[str, float] = {}
    if "rf" in model_objects:
        rf_model, _ = model_objects["rf"]
        if rf_model is not None and hasattr(rf_model, "feature_importances_"):
            imp = rf_model.feature_importances_
            for i, col in enumerate(FEATURE_COLUMNS):
                feature_importance[col] = round(float(imp[i]), 4)
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


# ═══════════════════════════════════════════════════════════════
# PSI Drift Detection (new - from ml-predictor.ts)
# ═══════════════════════════════════════════════════════════════

def compute_psi(reference: np.ndarray, current: np.ndarray, bins: int = 10) -> float:
    """Compute Population Stability Index."""
    ref_min, ref_max = reference.min(), reference.max()
    if ref_max == ref_min:
        return 0.0
    bin_edges = np.linspace(ref_min, ref_max, bins + 1)
    ref_counts, _ = np.histogram(reference, bins=bin_edges)
    cur_counts, _ = np.histogram(current, bins=bin_edges)
    ref_pct = (ref_counts + 0.5) / (len(reference) + bins * 0.5)
    cur_pct = (cur_counts + 0.5) / (len(current) + bins * 0.5)
    psi = np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct))
    return float(psi)


# ═══════════════════════════════════════════════════════════════
# Flask Routes
# ═══════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    available = list(MODEL_REGISTRY.keys())
    if not HAS_LIGHTGBM:
        available = [k for k in available if k != "lightgbm"]
    return jsonify({
        "status": "ok",
        "service": "unified-ml-service",
        "port": PORT,
        "models_available": available,
    }), 200


@app.route("/predict", methods=["POST"])
def predict():
    """ML-based multi-session price prediction (sklearn ensemble)."""
    try:
        body = request.get_json(force=True, silent=True)
        if body is None:
            return jsonify({"status": "error", "error": "Invalid JSON body"}), 400
        candles: List[Dict] = body.get("candles", [])
        sessions: int = int(body.get("sessions", 10))
        model_keys: List[str] = body.get("models", list(MODEL_REGISTRY.keys()))
        if not candles or not isinstance(candles, list):
            return jsonify({"status": "error", "error": "candles must be a non-empty list"}), 400
        if len(candles) < MIN_CANDLES:
            return jsonify({"status": "error", "error": f"Minimum {MIN_CANDLES} candles required, got {len(candles)}"}), 400
        required_fields = {"open", "high", "low", "close", "volume"}
        for i, c in enumerate(candles):
            if not required_fields.issubset(c.keys()):
                missing = required_fields - set(c.keys())
                return jsonify({"status": "error", "error": f"Candle at index {i} missing fields: {missing}"}), 400
        if sessions < 1 or sessions > 30:
            return jsonify({"status": "error", "error": "sessions must be between 1 and 30"}), 400
        if not model_keys or not isinstance(model_keys, list):
            model_keys = list(MODEL_REGISTRY.keys())
        ck = _cache_key(candles, sessions, model_keys)
        cached = _get_cache(ck)
        if cached is not None:
            return jsonify(cached), 200
        result = run_prediction(candles, sessions, model_keys)
        _set_cache(ck, result)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"status": "error", "error": str(e)}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "error": f"Internal error: {str(e)}"}), 500


@app.route("/predict/simple", methods=["POST"])
def predict_simple():
    """Pure Python ensemble prediction (Ridge + WMA + MeanReversion)."""
    try:
        body = request.get_json(force=True, silent=True)
        if body is None:
            return jsonify({"status": "error", "error": "Invalid JSON body"}), 400
        prices = body.get("prices")
        volume = body.get("volume")
        steps = body.get("steps", 5)
        if not isinstance(prices, list) or len(prices) < 2:
            return jsonify({"status": "error", "error": "'prices' must be an array with at least 2 numbers"}), 400
        if not all(isinstance(p, (int, float)) for p in prices):
            return jsonify({"status": "error", "error": "All price values must be numbers"}), 400
        if any(p <= 0 for p in prices):
            return jsonify({"status": "error", "error": "All prices must be positive"}), 400
        if volume is not None:
            if not isinstance(volume, list) or len(volume) < 2:
                return jsonify({"status": "error", "error": "'volume' must be an array with at least 2 numbers or null"}), 400
            if not all(isinstance(v, (int, float)) for v in volume):
                return jsonify({"status": "error", "error": "All volume values must be numbers"}), 400
        if not isinstance(steps, int) or steps < 1 or steps > 30:
            return jsonify({"status": "error", "error": "'steps' must be an integer between 1 and 30"}), 400
        result = ensemble_predict(list(prices), list(volume) if volume else None, steps)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/weights", methods=["POST"])
def weights():
    """Bayesian dynamic indicator weights."""
    try:
        body = request.get_json(force=True, silent=True)
        if body is None:
            return jsonify({"status": "error", "error": "Invalid JSON body"}), 400
        features = body.get("features")
        regime = body.get("regime", "sideways")
        has_volume = body.get("has_volume", True)
        if not isinstance(features, dict):
            return jsonify({"status": "error", "error": "'features' must be an object"}), 400
        if not isinstance(regime, str):
            return jsonify({"status": "error", "error": "'regime' must be a string"}), 400
        if not isinstance(has_volume, bool):
            return jsonify({"status": "error", "error": "'has_volume' must be a boolean"}), 400
        for k, v in features.items():
            if v is not None and not isinstance(v, (int, float)):
                return jsonify({"status": "error", "error": f"Feature '{k}' must be a number or null"}), 400
        result = compute_bayesian_weights(features, regime, has_volume)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/regime", methods=["POST"])
def regime():
    """Market regime detection (5 regimes)."""
    try:
        body = request.get_json(force=True, silent=True)
        if body is None:
            return jsonify({"status": "error", "error": "Invalid JSON body"}), 400
        prices = body.get("prices")
        if not isinstance(prices, list) or len(prices) < 5:
            return jsonify({"status": "error", "error": "'prices' must be an array with at least 5 numbers"}), 400
        if not all(isinstance(p, (int, float)) for p in prices):
            return jsonify({"status": "error", "error": "All price values must be numbers"}), 400
        if any(p <= 0 for p in prices):
            return jsonify({"status": "error", "error": "All prices must be positive"}), 400
        result = detect_regime(list(prices))
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/divergence", methods=["POST"])
def divergence():
    """Price-indicator divergence detection."""
    try:
        body = request.get_json(force=True, silent=True)
        if body is None:
            return jsonify({"status": "error", "error": "Invalid JSON body"}), 400
        prices = body.get("prices")
        indicator_values = body.get("indicator_values")
        indicator_name = body.get("indicator_name", "rsi")
        if not isinstance(prices, list) or len(prices) < 5:
            return jsonify({"status": "error", "error": "'prices' must be an array with at least 5 numbers"}), 400
        if not isinstance(indicator_values, list) or len(indicator_values) < 5:
            return jsonify({"status": "error", "error": "'indicator_values' must be an array with at least 5 numbers"}), 400
        if not all(isinstance(p, (int, float)) for p in prices):
            return jsonify({"status": "error", "error": "All price values must be numbers"}), 400
        if not all(isinstance(v, (int, float)) for v in indicator_values):
            return jsonify({"status": "error", "error": "All indicator_values must be numbers"}), 400
        result = detect_divergence(list(prices), list(indicator_values), indicator_name)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/train", methods=["POST"])
def train():
    """Train sklearn models for a symbol."""
    try:
        body = request.get_json(force=True, silent=True)
        if body is None:
            return jsonify({"status": "error", "error": "Invalid JSON body"}), 400
        symbol: str = body.get("symbol", "")
        ohlcv: List[Dict] = body.get("ohlcv", [])
        models: List[str] = body.get("models", list(MODEL_REGISTRY.keys()))
        if not symbol or not ohlcv:
            return jsonify({"status": "error", "error": "symbol and ohlcv are required"}), 400
        if len(ohlcv) < MIN_CANDLES:
            return jsonify({"status": "error", "error": f"Minimum {MIN_CANDLES} candles required"}), 400
        available = list(MODEL_REGISTRY.keys())
        if HAS_LIGHTGBM is False:
            available = [k for k in available if k != "lightgbm"]
        valid_models = [m for m in models if m in available]
        if not valid_models:
            return jsonify({"status": "error", "error": f"No valid models. Available: {available}"}), 400
        df_clean, X, y, feat_count = prepare_dataset(ohlcv)
        results = {}
        for mk in valid_models:
            cv_r2, cv_rmse, pred_std = cross_validate_model(build_model(mk), X, y, mk)
            final_model, scaler = train_final_model(mk, X, y)
            _trained_models[f"{symbol}:{mk}"] = final_model
            _model_scalers[f"{symbol}:{mk}"] = scaler
            results[mk] = {
                "cv_r2": round(cv_r2, 4),
                "cv_rmse_pct": round(cv_rmse, 2),
                "trained": final_model is not None,
            }
        return jsonify({"status": "ok", "symbol": symbol, "results": results}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/models", methods=["GET"])
def models():
    """List trained models."""
    model_list = []
    for key, model in _trained_models.items():
        parts = key.split(":", 1)
        if len(parts) == 2:
            symbol, model_key = parts
            model_list.append({
                "symbol": symbol,
                "model_key": model_key,
                "model_name": MODEL_REGISTRY.get(model_key, {}).get("name", model_key),
            })
    return jsonify({
        "status": "ok",
        "models": model_list,
        "total": len(model_list),
    }), 200


@app.route("/batch-predict", methods=["POST"])
def batch_predict():
    """Batch prediction for multiple symbols."""
    try:
        body = request.get_json(force=True, silent=True)
        if body is None:
            return jsonify({"status": "error", "error": "Invalid JSON body"}), 400
        symbols: List[str] = body.get("symbols", [])
        ohlcv_data: Dict[str, List[Dict]] = body.get("ohlcv_data", {})
        sessions: int = int(body.get("sessions", 10))
        model_keys: List[str] = body.get("models", list(MODEL_REGISTRY.keys()))
        if not symbols or not ohlcv_data:
            return jsonify({"status": "error", "error": "symbols and ohlcv_data are required"}), 400
        results = {}
        for symbol in symbols:
            candles = ohlcv_data.get(symbol, [])
            if len(candles) < MIN_CANDLES:
                results[symbol] = {"status": "error", "error": f"Not enough candles for {symbol}"}
                continue
            try:
                result = run_prediction(candles, sessions, model_keys)
                results[symbol] = result
            except Exception as e:
                results[symbol] = {"status": "error", "error": str(e)}
        return jsonify({"status": "ok", "results": results}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/drift", methods=["POST"])
def drift():
    """PSI drift detection."""
    try:
        body = request.get_json(force=True, silent=True)
        if body is None:
            return jsonify({"status": "error", "error": "Invalid JSON body"}), 400
        reference: List[float] = body.get("reference", [])
        current: List[float] = body.get("current", [])
        if not reference or not current:
            return jsonify({"status": "error", "error": "reference and current arrays are required"}), 400
        ref_arr = np.array(reference, dtype=np.float64)
        cur_arr = np.array(current, dtype=np.float64)
        psi_value = compute_psi(ref_arr, cur_arr)
        return jsonify({
            "status": "ok",
            "psi": round(psi_value, 6),
            "drift_detected": psi_value > 0.25,
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/quantize", methods=["POST"])
def quantize():
    """Model quantization (stub - returns model info)."""
    try:
        body = request.get_json(force=True, silent=True)
        if body is None:
            return jsonify({"status": "error", "error": "Invalid JSON body"}), 400
        symbol: str = body.get("symbol", "")
        model_name: str = body.get("model_name", "")
        key = f"{symbol}:{model_name}"
        if key not in _trained_models:
            return jsonify({"status": "error", "error": f"Model {key} not found"}), 404
        return jsonify({
            "status": "ok",
            "quantized": False,
            "model": key,
            "message": "Quantization requires ONNX runtime. Model info returned.",
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


# ── Main ────────────────────────────────────────────────────

def main():
    print(f"Unified ML Service running on http://0.0.0.0:{PORT}", flush=True)
    print(f"Endpoints:", flush=True)
    print(f"  POST /predict          — ML ensemble prediction (sklearn)", flush=True)
    print(f"  POST /predict/simple   — Pure Python ensemble", flush=True)
    print(f"  POST /weights          — Bayesian dynamic weights", flush=True)
    print(f"  POST /regime           — Market regime detection", flush=True)
    print(f"  POST /divergence       — Price-indicator divergence", flush=True)
    print(f"  POST /train            — Train models", flush=True)
    print(f"  GET  /models           — List trained models", flush=True)
    print(f"  POST /batch-predict    — Batch prediction", flush=True)
    print(f"  POST /drift            — PSI drift detection", flush=True)
    print(f"  POST /quantize         — Model quantization", flush=True)
    print(f"  GET  /health           — Health check", flush=True)
    try:
        app.run(host="0.0.0.0", port=PORT, debug=False)
    except KeyboardInterrupt:
        print("\nShutting down Unified ML Service.", flush=True)


if __name__ == "__main__":
    main()