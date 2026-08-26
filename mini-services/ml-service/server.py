#!/usr/bin/env python3
"""
ML Service — VDES Technical Analysis System
Pure Python (standard library only) HTTP server on port 3040.

Endpoints:
  POST /predict     — Multi-step price prediction (ensemble of 3 models)
  POST /weights     — Bayesian dynamic indicator weights
  POST /regime      — Market regime detection (5 regimes)
  POST /divergence  — Price-indicator divergence detection
"""

import json
import math
import statistics
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PORT = 3040

# ─────────────────────────────────────────────────────────────────────────────
# Pure-Python math / stats helpers
# ─────────────────────────────────────────────────────────────────────────────


def _mean(seq):
    """Arithmetic mean of a non-empty list."""
    return sum(seq) / len(seq)


def _stdev(seq):
    """Population standard deviation."""
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
    """Matrix multiply A (m×n) × B (n×p)."""
    BT = _transpose(B)
    return [[sum(a * b for a, b in zip(row_a, col_b)) for col_b in BT] for row_a in A]


def _identity(n):
    return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]


def _mat_add_scalar(M, s):
    return [[cell + s for cell in row] for row in M]


def _invert_2x2(M):
    """Invert a 2×2 matrix."""
    a, b = M[0]
    c, d = M[1]
    det = a * d - b * c
    if abs(det) < 1e-12:
        return None
    return [[d / det, -b / det], [-c / det, a / det]]


def _invert_matrix(M):
    """Invert a small matrix using Gauss-Jordan elimination.
    Falls back to 2×2 shortcut when possible.
    """
    n = len(M)
    if n == 2:
        r = _invert_2x2(M)
        if r is not None:
            return r
    # Augment with identity
    aug = [row[:] + _identity(n)[i] for i, row in enumerate(M)]
    for col in range(n):
        # Partial pivoting
        max_row = max(range(col, n), key=lambda r: abs(aug[r][col]))
        aug[col], aug[max_row] = aug[max_row], aug[col]
        pivot = aug[col][col]
        if abs(pivot) < 1e-12:
            # Singular — return identity as fallback
            return _identity(n)
        for j in range(2 * n):
            aug[col][j] /= pivot
        for row in range(n):
            if row != col:
                factor = aug[row][col]
                for j in range(2 * n):
                    aug[row][j] -= factor * aug[col][j]
    return [row[n:] for row in aug]


# ─────────────────────────────────────────────────────────────────────────────
# Technical indicator helpers (pure Python)
# ─────────────────────────────────────────────────────────────────────────────


def sma(values, period):
    """Simple moving average."""
    if len(values) < period:
        return None
    return _mean(values[-period:])


def ema(values, period):
    """Exponential moving average."""
    if len(values) < period:
        return None
    k = 2.0 / (period + 1)
    e = _mean(values[:period])
    for v in values[period:]:
        e = v * k + e * (1 - k)
    return e


def rsi(prices, period=14):
    """Relative Strength Index."""
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
    """Average Directional Index (simplified)."""
    if len(prices) < 2 * period + 1:
        return 25.0  # neutral
    # Compute +DM, -DM, TR
    plus_dm_list = []
    minus_dm_list = []
    tr_list = []
    for i in range(1, len(prices)):
        high = max(prices[i], prices[i - 1])  # proxy when no OHLC
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
    # Smooth with Wilder's method
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
    return dx  # simplified single-period ADX


def macd(prices, fast=12, slow=26, signal=9):
    """MACD histogram value."""
    if len(prices) < slow + signal:
        return 0.0
    ema_fast = ema(prices, fast)
    ema_slow = ema(prices, slow)
    if ema_fast is None or ema_slow is None:
        return 0.0
    macd_line = ema_fast - ema_slow
    # Approximate signal line
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
    """Rolling standard deviation over last `period` values."""
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


# ─────────────────────────────────────────────────────────────────────────────
# Feature Engineering
# ─────────────────────────────────────────────────────────────────────────────


def compute_returns(prices):
    """Simple returns."""
    return [(prices[i] - prices[i - 1]) / prices[i - 1] if prices[i - 1] != 0 else 0
            for i in range(1, len(prices))]


def compute_log_returns(prices):
    """Log returns."""
    return [math.log(prices[i] / prices[i - 1]) if prices[i - 1] > 0 and prices[i] > 0 else 0
            for i in range(1, len(prices))]


def build_features(prices, volume=None):
    """Build feature vector from price series.
    Returns list of feature values.
    """
    if len(prices) < 5:
        return []

    feats = []
    n = len(prices)

    # --- Lag features (normalized) ---
    for lag in [1, 2, 3, 5, 10]:
        if n > lag and prices[-lag - 1] != 0:
            feats.append(prices[-1] / prices[-lag - 1] - 1)
        else:
            feats.append(0.0)

    # --- Returns ---
    rets = compute_returns(prices)
    if rets:
        feats.append(rets[-1])  # 1-day return
    else:
        feats.append(0.0)
    if len(rets) >= 5:
        feats.append(_mean(rets[-5:]))  # 5-day mean return
    else:
        feats.append(_mean(rets) if rets else 0.0)

    # --- Volatility ---
    if len(rets) >= 5:
        feats.append(_stdev(rets[-5:]))  # 5-day vol
    else:
        feats.append(0.0)
    if len(rets) >= 10:
        feats.append(_stdev(rets[-10:]))  # 10-day vol
    else:
        feats.append(_stdev(rets) if rets else 0.0)

    # --- MA ratios ---
    for period in [5, 10, 20]:
        m = sma(prices, period)
        if m and m != 0:
            feats.append(prices[-1] / m - 1)
        else:
            feats.append(0.0)

    # --- EMA ratios ---
    for period in [12, 26]:
        e = ema(prices, period)
        if e and e != 0:
            feats.append(prices[-1] / e - 1)
        else:
            feats.append(0.0)

    # --- RSI ---
    feats.append(rsi(prices) / 100.0)

    # --- ADX ---
    feats.append(adx(prices) / 100.0)

    # --- MACD histogram (normalized) ---
    mh = macd(prices)
    if prices[-1] != 0:
        feats.append(mh / prices[-1])
    else:
        feats.append(0.0)

    # --- Bollinger position ---
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

    # --- Volume features ---
    if volume and len(volume) >= 5:
        vol_rets = [(volume[i] - volume[i - 1]) / volume[i - 1]
                     if volume[i - 1] != 0 else 0
                     for i in range(1, len(volume))]
        feats.append(_mean(vol_rets[-5:]) if len(vol_rets) >= 5 else _mean(vol_rets) if vol_rets else 0.0)
        feats.append(_stdev(vol_rets[-5:]) if len(vol_rets) >= 5 else 0.0)
        # Price-volume correlation proxy
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

    # --- Momentum ---
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
    """Target: return at step ahead."""
    if len(prices) <= step:
        return 0.0
    return (prices[-step - 1] / prices[-1] - 1) if prices[-1] != 0 else 0.0


def build_dataset(prices, volume=None, max_lag=30):
    """Build X, y dataset from rolling windows."""
    X = []
    y = []
    min_len = 30  # minimum data needed
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


# ─────────────────────────────────────────────────────────────────────────────
# Model 1: Ridge Regression (from scratch)
# ─────────────────────────────────────────────────────────────────────────────


class RidgeRegression:
    """Ridge regression: w = (X^T X + λI)^{-1} X^T y"""

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
        # Center y
        y_mean = _mean(y)
        y_c = [yi - y_mean for yi in y]
        # Center X
        x_means = [_mean([X[j][i] for j in range(n)]) for i in range(p)]
        X_c = [[X[j][i] - x_means[i] for i in range(p)] for j in range(n)]
        # X^T X
        XT = _transpose(X_c)
        XTX = _mat_mul(XT, X_c)
        # Regularize
        reg = _identity(p)
        XTX_reg = [[XTX[i][j] + (self.alpha if i == j else 0) for j in range(p)] for i in range(p)]
        XTX_inv = _invert_matrix(XTX_reg)
        # X^T y
        XTy = [sum(XT[i][j] * y_c[j] for j in range(n)) for i in range(p)]
        # w = XTX_inv @ XTy
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


# ─────────────────────────────────────────────────────────────────────────────
# Model 2: Weighted Moving Average Ensemble
# ─────────────────────────────────────────────────────────────────────────────


def wma_predict(prices, steps=5):
    """Predict using weighted moving average of recent returns."""
    if len(prices) < 3:
        return [0.0] * steps

    rets = compute_returns(prices)
    if not rets:
        return [0.0] * steps

    # Use exponential weights for recent returns
    n_rets = min(len(rets), 20)
    recent_rets = rets[-n_rets:]
    weights = [math.exp(-0.1 * (n_rets - 1 - i)) for i in range(n_rets)]
    w_sum = sum(weights)
    weights = [w / w_sum for w in weights]
    expected_return = sum(w * r for w, r in zip(weights, recent_rets))

    # Volatility for decay
    if len(recent_rets) >= 5:
        vol = _stdev(recent_rets[-5:])
    else:
        vol = _stdev(recent_rets)

    predictions = []
    last_price = prices[-1]
    for step in range(steps):
        # Decay the expected return for longer horizons
        decay = math.exp(-0.05 * step)
        ret = expected_return * decay
        last_price = last_price * (1 + ret)
        predictions.append(last_price)

    return predictions


# ─────────────────────────────────────────────────────────────────────────────
# Model 3: Mean-Reversion Model
# ─────────────────────────────────────────────────────────────────────────────


def mean_reversion_predict(prices, steps=5):
    """Predict based on mean-reversion tendency."""
    if len(prices) < 10:
        return [0.0] * steps

    # Compute multiple lookback means
    lookbacks = [10, 20, 50]
    means = []
    for lb in lookbacks:
        if len(prices) >= lb:
            means.append(sma(prices, lb))
        else:
            means.append(sma(prices, len(prices)))

    # Weight longer lookbacks more (they're more stable)
    weights = [0.2, 0.3, 0.5][:len(means)]
    w_sum = sum(weights)
    weights = [w / w_sum for w in weights]
    target_mean = sum(w * m for w, m in zip(weights, means) if m is not None)

    if target_mean is None or target_mean == 0:
        return [prices[-1]] * steps

    # Speed of reversion: how far from mean / recent volatility
    deviation = (prices[-1] - target_mean) / target_mean
    rets = compute_returns(prices)
    vol = _stdev(rets[-10:]) if len(rets) >= 10 else (_stdev(rets) if rets else 0.01)
    if vol == 0:
        vol = 0.01

    # Half-life estimation (simplified Ornstein-Uhlenbeck)
    reversion_speed = 0.1  # base reversion per step
    reversion_strength = -reversion_speed * deviation

    predictions = []
    last_price = prices[-1]
    for step in range(steps):
        # Reversion decays as we approach mean
        current_dev = (last_price - target_mean) / target_mean
        adj_return = -reversion_speed * current_dev * 0.5
        last_price = last_price * (1 + adj_return)
        predictions.append(last_price)

    return predictions


# ─────────────────────────────────────────────────────────────────────────────
# Ensemble Prediction
# ─────────────────────────────────────────────────────────────────────────────


def ensemble_predict(prices, volume=None, steps=5):
    """Combine three models with adaptive weights."""
    if len(prices) < 10:
        # Not enough data — return simple extrapolation
        last = prices[-1]
        ret = (prices[-1] / prices[-2] - 1) if len(prices) >= 2 and prices[-2] != 0 else 0
        # Use recent returns for a rough confidence interval
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

    # --- Build dataset & fit Ridge ---
    X, y = build_dataset(prices, volume)
    ridge_preds = None
    ridge_score = 0.0
    residuals = []

    if len(X) >= 10:
        # Use last 30% for validation
        split = int(len(X) * 0.7)
        X_train, X_val = X[:split], X[split:]
        y_train, y_val = y[:split], y[split:]

        model = RidgeRegression(alpha=0.5)
        model.fit(X_train, y_train)

        if model.fitted and X_val:
            val_preds = model.predict(X_val)
            # R² score
            ym = _mean(y_val)
            ss_res = sum((yp - yt) ** 2 for yp, yt in zip(val_preds, y_val))
            ss_tot = sum((yt - ym) ** 2 for yt in y_val)
            ridge_score = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
            ridge_score = max(0.0, min(1.0, ridge_score))
            residuals = [yp - yt for yp, yt in zip(val_preds, y_val)]

        # Multi-step prediction
        ridge_preds = []
        last_price = prices[-1]
        for step in range(steps):
            feats = build_features(prices, volume)
            if feats and model.fitted:
                pred_return = model.predict_single(feats)
                pred_return = max(-0.05, min(0.05, pred_return))  # clamp
            else:
                rets = compute_returns(prices)
                pred_return = _mean(rets[-5:]) if len(rets) >= 5 else (_mean(rets) if rets else 0)

            last_price = last_price * (1 + pred_return)
            ridge_preds.append(last_price)
            # Append prediction to prices for next step's features
            prices = prices + [last_price]
            if volume:
                avg_vol = _mean(volume[-5:]) if len(volume) >= 5 else _mean(volume)
                volume = volume + [avg_vol]

        prices = prices[:-(steps)]  # restore original
        if volume:
            volume = volume[:-(steps)]
    else:
        ridge_preds = [prices[-1]] * steps
        ridge_score = 0.0

    # --- WMA predictions ---
    wma_preds = wma_predict(prices, steps)

    # --- Mean-reversion predictions ---
    mr_preds = mean_reversion_predict(prices, steps)

    # --- Compute model weights based on recent performance ---
    # Validate WMA and MR on recent data
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

    # Adaptive ensemble weights
    scores = [ridge_score + 0.05, wma_score + 0.05, mr_score + 0.05]  # floor at 0.05
    total_score = sum(scores)
    w = [s / total_score for s in scores]

    # If ridge has very little data, favor simpler models
    if len(X) < 10:
        w = [0.1, 0.45, 0.45]

    # --- Combine predictions ---
    final_preds = []
    for i in range(steps):
        p = w[0] * ridge_preds[i] + w[1] * wma_preds[i] + w[2] * mr_preds[i]
        final_preds.append(p)

    # --- Confidence & intervals ---
    if residuals:
        resid_std = _stdev(residuals)
    else:
        rets = compute_returns(prices)
        resid_std = _stdev(rets[-10:]) if len(rets) >= 10 else (_stdev(rets) if rets else 0.01)

    confidence = max(0.1, min(0.95, ridge_score * 0.6 + wma_score * 0.2 + mr_score * 0.2 + 0.1))

    conf_intervals = []
    for i, p in enumerate(final_preds):
        # Widen intervals for longer horizons
        width = resid_std * p * (1 + 0.15 * i) * 1.96
        conf_intervals.append([p - width, p + width])

    # 5-day predicted return
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


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 2: Bayesian Weights
# ─────────────────────────────────────────────────────────────────────────────


def compute_bayesian_weights(features, regime="sideways", has_volume=True):
    """
    Compute Bayesian weights for technical indicators.
    W_i = P(Success|Tool_i) * Prior_i / sum(P(Success|Tool_j) * Prior_j)
    """
    # Default priors
    priors = {
        "trend": 0.28,
        "oscillator": 0.25,
        "volume": 0.15,
        "volatility": 0.10,
        "leading": 0.12,
        "patterns": 0.10,
    }

    # Redistribute volume prior if no volume data
    if not has_volume:
        vol_prior = priors["volume"]
        del priors["volume"]
        total_other = sum(priors.values())
        for k in priors:
            priors[k] += vol_prior * (priors[k] / total_other)

    # Likelihood P(Success|Tool_i) based on regime and feature values
    likelihoods = {}

    # Trend indicators: more useful in trending markets
    trend_indicators = ["sma_20", "ema_12", "ema_26", "macd_signal", "adx"]
    oscillator_indicators = ["rsi", "stoch_k", "stoch_d", "williams_r", "cci"]
    volume_indicators = ["obv", "vwap", "vol_sma", "vol_ratio"]
    volatility_indicators = ["atr", "bb_width", "bb_position", "keltner_width"]
    leading_indicators = ["ichimoku", "pivot", "fibonacci", "donchian"]
    pattern_indicators = ["candle_patterns", "harmonic", "chart_patterns", "support_resistance"]

    # Count available features per category
    def count_matching(keys):
        return sum(1 for k in keys if k in features and features[k] is not None)

    trend_count = count_matching(trend_indicators)
    osc_count = count_matching(oscillator_indicators)
    vol_count = count_matching(volume_indicators) if has_volume else 0
    var_count = count_matching(volatility_indicators)
    lead_count = count_matching(leading_indicators)
    pat_count = count_matching(pattern_indicators)

    # Adjust likelihoods based on regime
    regime_boost = {
        "strong_bull": {"trend": 1.3, "oscillator": 0.8, "volatility": 0.7, "leading": 1.1, "patterns": 0.9},
        "weak_bull": {"trend": 1.1, "oscillator": 1.0, "volatility": 0.9, "leading": 1.0, "patterns": 1.0},
        "sideways": {"trend": 0.7, "oscillator": 1.2, "volatility": 1.2, "leading": 0.9, "patterns": 1.1},
        "weak_bear": {"trend": 1.0, "oscillator": 1.1, "volatility": 1.0, "leading": 1.0, "patterns": 1.0},
        "strong_bear": {"trend": 1.3, "oscillator": 0.8, "volatility": 0.7, "leading": 1.1, "patterns": 0.9},
    }

    boost = regime_boost.get(regime, regime_boost["sideways"])

    # Feature availability boost (more features = higher confidence)
    def feature_boost(count):
        if count == 0:
            return 0.3
        elif count == 1:
            return 0.7
        elif count == 2:
            return 0.9
        else:
            return 1.0

    # Base likelihood for each category
    base_likelihood = {
        "trend": 0.6,
        "oscillator": 0.6,
        "volatility": 0.55,
        "leading": 0.5,
        "patterns": 0.5,
    }

    if has_volume:
        base_likelihood["volume"] = 0.55

    # Compute final likelihoods
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

    # Extra: boost based on extreme feature values
    # e.g., extreme RSI means oscillators are more informative
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

    # Compute posterior weights: W_i = P(Success|i) * Prior_i / Z
    posterior = {}
    Z = 0.0
    for cat in priors:
        posterior[cat] = likelihoods.get(cat, 0.5) * priors[cat]
        Z += posterior[cat]

    if Z > 0:
        for cat in posterior:
            posterior[cat] /= Z

    # Build per-indicator weights
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
            # No features in this category — distribute to others later
            pass

    # Normalize so sum = 1
    total = sum(weights.values())
    if total > 0:
        weights = {k: round(v / total, 4) for k, v in weights.items()}
    else:
        # Fallback: equal weights
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


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 3: Regime Detection
# ─────────────────────────────────────────────────────────────────────────────


def detect_regime(prices):
    """Detect market regime from price series.
    Returns one of: strong_bull, weak_bull, sideways, weak_bear, strong_bear
    """
    if len(prices) < 10:
        return {"regime": "sideways", "probabilities": {
            "strong_bull": 0.1, "weak_bull": 0.2, "sideways": 0.4,
            "weak_bear": 0.2, "strong_bear": 0.1,
        }}

    # --- ADX-based trend strength ---
    adx_val = adx(prices)
    trend_strength = adx_val / 100.0  # 0-1

    # --- Returns-based direction ---
    rets = compute_returns(prices)
    if not rets:
        return {"regime": "sideways", "probabilities": {
            "strong_bull": 0.1, "weak_bull": 0.2, "sideways": 0.4,
            "weak_bear": 0.2, "strong_bear": 0.1,
        }}

    # Multi-period returns
    ret_5 = sum(rets[-5:]) if len(rets) >= 5 else sum(rets)
    ret_10 = sum(rets[-10:]) if len(rets) >= 10 else sum(rets)
    ret_20 = sum(rets[-20:]) if len(rets) >= 20 else ret_10

    # Average positive vs negative returns
    pos_rets = [r for r in rets if r > 0]
    neg_rets = [r for r in rets if r < 0]
    pos_ratio = len(pos_rets) / len(rets) if rets else 0.5

    # Direction score: positive = bullish, negative = bearish
    direction_score = 0.0
    # Recent 5-day return (most important)
    direction_score += ret_5 * 3.0
    # 10-day return
    direction_score += ret_10 * 1.5
    # 20-day return
    direction_score += ret_20 * 1.0
    # Positive ratio
    direction_score += (pos_ratio - 0.5) * 0.3
    # RSI contribution
    rsi_val = rsi(prices)
    direction_score += (rsi_val - 50) / 100.0 * 0.5

    # --- Volatility-based ---
    if len(rets) >= 10:
        vol = _stdev(rets[-10:])
    else:
        vol = _stdev(rets)

    # High volatility regime scoring
    vol_score = min(1.0, vol * 10)  # normalize

    # --- Classify into 5 regimes ---
    # Thresholds
    strong_trend_threshold = 0.4  # ADX equivalent
    moderate_trend_threshold = 0.2

    # Regime probabilities (softmax-like)
    regimes = ["strong_bull", "weak_bull", "sideways", "weak_bear", "strong_bear"]
    scores = {}

    # Strong bull: high trend + positive direction + high vol
    scores["strong_bull"] = (
        max(0, trend_strength - moderate_trend_threshold) * 2.0 +
        max(0, direction_score) * 1.5 +
        vol_score * 0.3
    )

    # Weak bull: moderate trend + positive direction + low vol
    scores["weak_bull"] = (
        max(0, trend_strength - moderate_trend_threshold * 0.5) * 1.0 +
        max(0, direction_score) * 1.0 +
        (1 - vol_score) * 0.3
    )

    # Sideways: low trend + low direction
    scores["sideways"] = (
        (1 - trend_strength) * 1.5 +
        (1 - min(1, abs(direction_score) * 3)) * 1.0 +
        (1 - vol_score) * 0.2
    )

    # Weak bear: moderate trend + negative direction + low vol
    scores["weak_bear"] = (
        max(0, trend_strength - moderate_trend_threshold * 0.5) * 1.0 +
        max(0, -direction_score) * 1.0 +
        (1 - vol_score) * 0.3
    )

    # Strong bear: high trend + negative direction + high vol
    scores["strong_bear"] = (
        max(0, trend_strength - moderate_trend_threshold) * 2.0 +
        max(0, -direction_score) * 1.5 +
        vol_score * 0.3
    )

    # Softmax to get probabilities
    max_score = max(scores.values())
    exp_scores = {r: math.exp(s - max_score) for r, s in scores.items()}
    total = sum(exp_scores.values())
    probs = {r: round(exp_scores[r] / total, 4) for r in regimes}

    # Determine dominant regime
    best_regime = max(regimes, key=lambda r: probs[r])

    return {
        "regime": best_regime,
        "probabilities": probs,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 4: Divergence Detection
# ─────────────────────────────────────────────────────────────────────────────


def detect_divergence(prices, indicator_values, indicator_name="rsi"):
    """Detect bullish/bearish divergence between price and an indicator."""
    min_len = 10
    if len(prices) < min_len or len(indicator_values) < min_len:
        return {"type": "none", "strength": 0.0, "start_idx": -1}

    # Align lengths
    n = min(len(prices), len(indicator_values))
    p = prices[-n:]
    ind = indicator_values[-n:]

    # Find recent swing highs and lows in price
    lookback = min(n, 30)
    window_p = p[-lookback:]
    window_ind = ind[-lookback:]

    # Find local maxima and minima (at least 3 bars apart)
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

    # --- Check bearish divergence (price higher high, indicator lower high) ---
    bearish_strength = 0.0
    bearish_start = -1

    if len(p_highs) >= 2 and len(i_highs) >= 2:
        # Match the last two highs
        ph_last = p_highs[-1]
        ph_prev = p_highs[-2]
        ih_last = i_highs[-1]
        ih_prev = i_highs[-2]

        # Price makes higher high, indicator makes lower high
        if ph_last[1] > ph_prev[1] and ih_last[1] < ih_prev[1]:
            price_diff = (ph_last[1] - ph_prev[1]) / ph_prev[1] if ph_prev[1] != 0 else 0
            ind_diff = (ih_prev[1] - ih_last[1]) / ih_prev[1] if ih_prev[1] != 0 else 0
            bearish_strength = min(1.0, (price_diff + ind_diff) * 10)
            bearish_start = ph_prev[0]

    # --- Check bullish divergence (price lower low, indicator higher low) ---
    bullish_strength = 0.0
    bullish_start = -1

    if len(p_lows) >= 2 and len(i_lows) >= 2:
        pl_last = p_lows[-1]
        pl_prev = p_lows[-2]
        il_last = i_lows[-1]
        il_prev = i_lows[-2]

        # Price makes lower low, indicator makes higher low
        if pl_last[1] < pl_prev[1] and il_last[1] > il_prev[1]:
            price_diff = (pl_prev[1] - pl_last[1]) / pl_prev[1] if pl_prev[1] != 0 else 0
            ind_diff = (il_last[1] - il_prev[1]) / il_prev[1] if il_prev[1] != 0 else 0
            bullish_strength = min(1.0, (price_diff + ind_diff) * 10)
            bullish_start = pl_prev[0]

    # Also check for simpler slope-based divergence
    if bearish_strength == 0 and bullish_strength == 0 and len(window_p) >= 10:
        # Compare slopes of price and indicator over the window
        p_slope = (window_p[-1] - window_p[-10]) / window_p[-10] if window_p[-10] != 0 else 0
        i_slope = (window_ind[-1] - window_ind[-10]) / abs(window_ind[-10]) if window_ind[-10] != 0 else 0

        # Normalize indicator slope
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

        # Divergence: opposite slopes
        if p_slope_norm > 0.1 and i_slope_norm < -0.1:
            bearish_strength = min(1.0, abs(p_slope_norm) + abs(i_slope_norm))
            bearish_start = len(window_p) - 10
        elif p_slope_norm < -0.1 and i_slope_norm > 0.1:
            bullish_strength = min(1.0, abs(p_slope_norm) + abs(i_slope_norm))
            bullish_start = len(window_p) - 10

    # Determine result
    min_strength_threshold = 0.15
    if bullish_strength > bearish_strength and bullish_strength >= min_strength_threshold:
        return {
            "type": "bullish",
            "strength": round(bullish_strength, 4),
            "start_idx": bullish_start,
        }
    elif bearish_strength > bullish_strength and bearish_strength >= min_strength_threshold:
        return {
            "type": "bearish",
            "strength": round(bearish_strength, 4),
            "start_idx": bearish_start,
        }
    else:
        return {
            "type": "none",
            "strength": 0.0,
            "start_idx": -1,
        }


# ─────────────────────────────────────────────────────────────────────────────
# HTTP Server
# ─────────────────────────────────────────────────────────────────────────────


class MLHandler(BaseHTTPRequestHandler):
    """HTTP request handler for ML service."""

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Type", "application/json")

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, msg, status=400):
        self._send_json({"error": msg}, status)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self._send_json({"status": "ok", "service": "ml-service", "port": PORT})
        else:
            self._send_error("Not found", 404)

    def do_POST(self):
        path = urlparse(self.path).path
        body = self._read_body()

        if body is None:
            self._send_error("Invalid JSON body")
            return

        try:
            if path == "/predict":
                self._handle_predict(body)
            elif path == "/weights":
                self._handle_weights(body)
            elif path == "/regime":
                self._handle_regime(body)
            elif path == "/divergence":
                self._handle_divergence(body)
            else:
                self._send_error(f"Unknown endpoint: {path}", 404)
        except Exception as e:
            self._send_error(f"Internal error: {str(e)}", 500)

    # ---- Endpoint handlers ----

    def _handle_predict(self, body):
        prices = body.get("prices")
        volume = body.get("volume")
        steps = body.get("steps", 5)

        if not isinstance(prices, list) or len(prices) < 2:
            self._send_error("'prices' must be an array with at least 2 numbers")
            return
        if not all(isinstance(p, (int, float)) for p in prices):
            self._send_error("All price values must be numbers")
            return
        if any(p <= 0 for p in prices):
            self._send_error("All prices must be positive")
            return
        if volume is not None:
            if not isinstance(volume, list) or len(volume) < 2:
                self._send_error("'volume' must be an array with at least 2 numbers or null")
                return
            if not all(isinstance(v, (int, float)) for v in volume):
                self._send_error("All volume values must be numbers")
                return
        if not isinstance(steps, int) or steps < 1 or steps > 30:
            self._send_error("'steps' must be an integer between 1 and 30")
            return

        result = ensemble_predict(list(prices), list(volume) if volume else None, steps)
        self._send_json(result)

    def _handle_weights(self, body):
        features = body.get("features")
        regime = body.get("regime", "sideways")
        has_volume = body.get("has_volume", True)

        if not isinstance(features, dict):
            self._send_error("'features' must be an object")
            return
        if not isinstance(regime, str):
            self._send_error("'regime' must be a string")
            return
        if not isinstance(has_volume, bool):
            self._send_error("'has_volume' must be a boolean")
            return

        # Validate feature values are numbers
        for k, v in features.items():
            if v is not None and not isinstance(v, (int, float)):
                self._send_error(f"Feature '{k}' must be a number or null")
                return

        result = compute_bayesian_weights(features, regime, has_volume)
        self._send_json(result)

    def _handle_regime(self, body):
        prices = body.get("prices")

        if not isinstance(prices, list) or len(prices) < 5:
            self._send_error("'prices' must be an array with at least 5 numbers")
            return
        if not all(isinstance(p, (int, float)) for p in prices):
            self._send_error("All price values must be numbers")
            return
        if any(p <= 0 for p in prices):
            self._send_error("All prices must be positive")
            return

        result = detect_regime(list(prices))
        self._send_json(result)

    def _handle_divergence(self, body):
        prices = body.get("prices")
        indicator_values = body.get("indicator_values")
        indicator_name = body.get("indicator_name", "rsi")

        if not isinstance(prices, list) or len(prices) < 5:
            self._send_error("'prices' must be an array with at least 5 numbers")
            return
        if not isinstance(indicator_values, list) or len(indicator_values) < 5:
            self._send_error("'indicator_values' must be an array with at least 5 numbers")
            return
        if not all(isinstance(p, (int, float)) for p in prices):
            self._send_error("All price values must be numbers")
            return
        if not all(isinstance(v, (int, float)) for v in indicator_values):
            self._send_error("All indicator_values must be numbers")
            return

        result = detect_divergence(
            list(prices), list(indicator_values), indicator_name
        )
        self._send_json(result)

    def log_message(self, format, *args):
        """Suppress default logging for cleaner output."""
        pass


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────


def main():
    server = HTTPServer(("0.0.0.0", PORT), MLHandler)
    print(f"ML Service running on http://0.0.0.0:{PORT}", flush=True)
    print(f"Endpoints: POST /predict, POST /weights, POST /regime, POST /divergence", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down ML Service.", flush=True)
        server.server_close()


if __name__ == "__main__":
    main()
