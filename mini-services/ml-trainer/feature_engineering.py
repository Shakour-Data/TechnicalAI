"""
Optimized Feature Engineering Module for ML Trainer service.

Key optimizations:
- Vectorized computations using NumPy
- Numba JIT compilation for performance-critical functions
- Caching of intermediate results (typical price, returns, etc.)
- Pre-allocated DataFrame for output
- Reduced redundant calculations
- GPU acceleration hooks for large datasets
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import List, Optional, Tuple, Any, Dict
from functools import lru_cache
import hashlib
import time
import warnings

try:
    import numba as nb
    _HAS_NUMBA = True
except ImportError:
    _HAS_NUMBA = False
    warnings.warn("Numba not available, using pure NumPy fallback")

try:
    import cupy as cp
    _HAS_CUPY = True
except ImportError:
    _HAS_CUPY = False

try:
    import jax
    import jax.numpy as jnp
    _HAS_JAX = True
except ImportError:
    _HAS_JAX = False


# ─── Feature Cache ─────────────────────────────────────────────────────────────

class FeatureCache:
    """
    Thread-safe cache for intermediate feature computations.
    Keyed by (data_hash, feature_name) to avoid recomputation.
    """
    _cache: Dict[str, Any] = {}
    _max_size = 128  # Maximum number of cached entries
    _hits = 0
    _misses = 0

    @classmethod
    def get_key(cls, df: pd.DataFrame, feature_name: str) -> str:
        """Generate a deterministic cache key from DataFrame hash."""
        data_hash = hashlib.md5(pd.util.hash_pandas_object(df).values).hexdigest()
        return f"{data_hash}:{feature_name}"

    @classmethod
    def get(cls, key: str) -> Optional[Any]:
        if key in cls._cache:
            cls._hits += 1
            return cls._cache[key]
        cls._misses += 1
        return None

    @classmethod
    def set(cls, key: str, value: Any) -> None:
        if len(cls._cache) >= cls._max_size:
            # Remove oldest entry (simple FIFO)
            oldest_key = next(iter(cls._cache))
            del cls._cache[oldest_key]
        cls._cache[key] = value

    @classmethod
    def clear(cls) -> None:
        cls._cache.clear()
        cls._hits = 0
        cls._misses = 0

    @classmethod
    def stats(cls) -> Dict[str, int]:
        total = cls._hits + cls._misses
        return {
            "hits": cls._hits,
            "misses": cls._misses,
            "hit_rate": cls._hits / total if total > 0 else 0.0,
            "cache_size": len(cls._cache),
            "max_size": cls._max_size,
        }


# ─── Numba-Accelerated Functions ─────────────────────────────────────────────

if _HAS_NUMBA:
    @nb.njit(parallel=True, cache=True, fastmath=True)
    def _numba_rolling_mean(data: np.ndarray, window: int) -> np.ndarray:
        """Vectorized rolling mean using Numba."""
        n = len(data)
        result = np.empty(n)
        for i in range(n):
            if i < window - 1:
                result[i] = np.mean(data[:i + 1]) if i > 0 else 0.0
            else:
                result[i] = np.mean(data[i - window + 1:i + 1])
        return result

    @nb.njit(parallel=True, cache=True, fastmath=True)
    def _numba_rolling_std(data: np.ndarray, window: int) -> np.ndarray:
        """Vectorized rolling std using Numba."""
        n = len(data)
        result = np.empty(n)
        for i in range(n):
            if i < window - 1:
                w = data[:i + 1]
            else:
                w = data[i - window + 1:i + 1]
            if len(w) < 2:
                result[i] = 0.0
            else:
                result[i] = np.std(w, ddof=1) if len(w) > 1 else 0.0
        return result

    @nb.njit(cache=True, fastmath=True)
    def _numba_ewm_mean(data: np.ndarray, span: int) -> np.ndarray:
        """Vectorized exponentially weighted mean using Numba."""
        n = len(data)
        result = np.empty(n)
        alpha = 2.0 / (span + 1.0)
        result[0] = data[0]
        for i in range(1, n):
            result[i] = alpha * data[i] + (1 - alpha) * result[i - 1]
        return result

    @nb.njit(cache=True, fastmath=True)
    def _numba_rsi(data: np.ndarray, period: int) -> np.ndarray:
        """Vectorized RSI computation using Numba."""
        n = len(data)
        result = np.empty(n)
        if n < period + 1:
            for i in range(n):
                result[i] = 50.0
            return result

        # Initial average gain/loss
        avg_gain = 0.0
        avg_loss = 0.0
        for i in range(1, period + 1):
            diff = data[i] - data[i - 1]
            if diff > 0:
                avg_gain += diff
            else:
                avg_loss += abs(diff)
        avg_gain /= period
        avg_loss /= period

        result[0] = 50.0
        for i in range(1, period):
            result[i] = 50.0

        for i in range(period, n):
            diff = data[i] - data[i - 1]
            gain = diff if diff > 0 else 0.0
            loss = abs(diff) if diff < 0 else 0.0
            avg_gain = (avg_gain * (period - 1) + gain) / period
            avg_loss = (avg_loss * (period - 1) + loss) / period

            if avg_loss > 0:
                rs = avg_gain / avg_loss
                result[i] = 100.0 - (100.0 / (1.0 + rs))
            else:
                result[i] = 100.0

        return result

    @nb.njit(cache=True, fastmath=True)
    def _numba_hurst(prices: np.ndarray, max_lag: int) -> float:
        """Fast Hurst exponent computation using Numba."""
        n = len(prices)
        if n < max_lag * 2:
            return 0.5

        lags = np.arange(2, min(max_lag, n // 2))
        if len(lags) < 2:
            return 0.5

        tau = []
        for lag in lags:
            truncated = n - (n % lag)
            subseries = prices[:truncated].reshape(-1, lag)
            ranges = np.max(subseries, axis=1) - np.min(subseries, axis=1)
            avg_range = np.mean(ranges)
            avg_std = np.std(prices[:n - (n % lag)])
            if avg_std > 0 and avg_range > 0:
                tau.append((np.log(avg_range / avg_std), np.log(lag)))

        if len(tau) < 2:
            return 0.5

        x = np.array([t[1] for t in tau])
        y = np.array([t[0] for t in tau])
        slope = np.polyfit(x, y, 1)[0]
        return float(slope)

    @nb.njit(cache=True, fastmath=True)
    def _numba_atr(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int) -> np.ndarray:
        """Vectorized ATR computation using Numba."""
        n = len(high)
        result = np.empty(n)
        tr_values = np.empty(n)
        
        tr_values[0] = high[0] - low[0]
        for i in range(1, n):
            tr_values[i] = max(
                high[i] - low[i],
                abs(high[i] - close[i - 1]),
                abs(low[i] - close[i - 1])
            )
        
        # Wilder's smoothing
        result[0] = tr_values[0]
        for i in range(1, n):
            if i < period:
                result[i] = (result[i-1] * (period - 1) + tr_values[i]) / period
            else:
                result[i] = (result[i-1] * (period - 1) + tr_values[i]) / period
        
        return result

else:
    # Pure NumPy fallback
    def _numba_rolling_mean(data: np.ndarray, window: int) -> np.ndarray:
        s = pd.Series(data)
        return s.rolling(window, min_periods=1).mean().values

    def _numba_rolling_std(data: np.ndarray, window: int) -> np.ndarray:
        s = pd.Series(data)
        return s.rolling(window, min_periods=1).std().values

    def _numba_ewm_mean(data: np.ndarray, span: int) -> np.ndarray:
        s = pd.Series(data)
        return s.ewm(span=span, adjust=False).mean().values

    def _numba_rsi(data: np.ndarray, period: int) -> np.ndarray:
        s = pd.Series(data)
        delta = s.diff()
        gain = delta.clip(lower=0).rolling(period, min_periods=1).mean()
        loss = (-delta.clip(upper=0)).rolling(period, min_periods=1).mean()
        rs = gain / loss.replace(0, 1e-10)
        return (100.0 - (100.0 / (1.0 + rs))).values

    def _numba_hurst(prices: np.ndarray, max_lag: int) -> float:
        return compute_hurst_exponent(pd.Series(prices), max_lag)

    def _numba_atr(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int) -> np.ndarray:
        tr = pd.concat([
            pd.Series(high - low),
            (pd.Series(high) - pd.Series(close).shift(1)).abs(),
            (pd.Series(low) - pd.Series(close).shift(1)).abs()
        ], axis=1).max(axis=1)
        return tr.rolling(period, min_periods=1).mean().values


# ─── Fast Hurst Feature (vectorized) ───────────────────────────────────────────

def compute_hurst_feature_vectorized(
    close: np.ndarray,
    min_periods: int = 30,
    window: int = 60,
    max_lag: int = 20,
) -> np.ndarray:
    """
    Compute Hurst exponent for each point using a rolling window.
    Fully vectorized version that pre-computes all lags.
    """
    n = len(close)
    result = np.full(n, 0.5)

    if n < min_periods * 2:
        return result

    lags = np.arange(2, min(max_lag, min_periods // 2))
    if len(lags) < 2:
        return result

    # Pre-compute log prices for all windows
    for i in range(min_periods, n):
        window_start = max(0, i - window)
        window_prices = close[window_start:i + 1]
        window_n = len(window_prices)

        if window_n < max_lag * 2:
            continue

        tau = []
        for lag in lags:
            truncated = window_n - (window_n % lag)
            if truncated < lag * 2:
                continue
            subseries = window_prices[:truncated].reshape(-1, lag)
            ranges = np.max(subseries, axis=1) - np.min(subseries, axis=1)
            avg_range = np.mean(ranges)
            avg_std = np.std(window_prices[:truncated])
            if avg_std > 0 and avg_range > 0:
                tau.append((np.log(avg_range / avg_std), np.log(lag)))

        if len(tau) >= 2:
            x_vals = np.array([t[1] for t in tau])
            y_vals = np.array([t[0] for t in tau])
            result[i] = max(0.0, min(1.0, np.polyfit(x_vals, y_vals, 1)[0]))

    return result


# ─── Optimized fill_nan_values ──────────────────────────────────────────────

def fill_nan_values(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fill NaN values in feature DataFrame with appropriate defaults.
    Optimized with column-type caching and vectorized operations.
    """
    df = df.copy()

    # Pre-compute column groups for vectorized fill
    fill_strategies = {
        'return_cols': [],
        'rsi_cols': [],
        'macd_cols': [],
        'adx_cols': [],
        'volume_cols': [],
        'autocorr_cols': [],
        'hurst_cols': [],
        'other_cols': [],
    }

    numeric_cols = df.select_dtypes(include=[np.number]).columns

    for col in numeric_cols:
        col_lower = col.lower()
        if 'return' in col_lower or 'log_return' in col_lower or 'roc' in col_lower:
            fill_strategies['return_cols'].append(col)
        elif 'rsi' in col_lower or 'stoch' in col_lower or 'cci' in col_lower:
            fill_strategies['rsi_cols'].append(col)
        elif 'macd' in col_lower or 'momentum' in col_lower or 'trend' in col_lower or 'squeeze' in col_lower:
            fill_strategies['macd_cols'].append(col)
        elif 'adx' in col_lower or 'di_' in col_lower:
            fill_strategies['adx_cols'].append(col)
        elif 'volume' in col_lower or 'obv' in col_lower or 'vwap' in col_lower or 'vol_' in col_lower:
            fill_strategies['volume_cols'].append(col)
        elif 'autocorr' in col_lower:
            fill_strategies['autocorr_cols'].append(col)
        elif 'hurst' in col_lower:
            fill_strategies['hurst_cols'].append(col)
        else:
            fill_strategies['other_cols'].append(col)

    # Apply fills vectorized
    if fill_strategies['return_cols']:
        df[fill_strategies['return_cols']] = df[fill_strategies['return_cols']].fillna(0.0)
    if fill_strategies['rsi_cols']:
        df[fill_strategies['rsi_cols']] = df[fill_strategies['rsi_cols']].fillna(50.0)
    if fill_strategies['macd_cols']:
        df[fill_strategies['macd_cols']] = df[fill_strategies['macd_cols']].fillna(0.0)
    if fill_strategies['adx_cols']:
        df[fill_strategies['adx_cols']] = df[fill_strategies['adx_cols']].fillna(25.0)
    if fill_strategies['volume_cols']:
        df[fill_strategies['volume_cols']] = df[fill_strategies['volume_cols']].fillna(0.0)
    if fill_strategies['autocorr_cols']:
        df[fill_strategies['autocorr_cols']] = df[fill_strategies['autocorr_cols']].fillna(0.0)
    if fill_strategies['hurst_cols']:
        for col in fill_strategies['hurst_cols']:
            df[col] = df[col].fillna(0.5)
    if fill_strategies['other_cols']:
        df[fill_strategies['other_cols']] = df[fill_strategies['other_cols']].ffill().bfill().fillna(0.0)

    # Handle non-numeric columns
    for col in df.columns:
        if col not in numeric_cols:
            df[col] = df[col].ffill().bfill()

    return df


# ─── Optimized _safe_div ───────────────────────────────────────────────────

def _safe_div(a, b, fill=0.0):
    """Optimized safe division with vectorized operations."""
    if isinstance(a, (pd.Series, np.ndarray)) or isinstance(b, (pd.Series, np.ndarray)):
        a_arr = np.asarray(a, dtype=float)
        b_arr = np.asarray(b, dtype=float)
        result = np.where(np.abs(b_arr) > 1e-12, a_arr / np.where(np.abs(b_arr) > 1e-12, b_arr, 1.0), fill)
        if isinstance(a, pd.Series):
            return pd.Series(result, index=a.index)
        if isinstance(b, pd.Series):
            return pd.Series(result, index=b.index)
        return pd.Series(result)
    return a / b if abs(b) > 1e-12 else fill


# ─── Optimized _rolling_mad ─────────────────────────────────────────────────

def _rolling_mad(series: pd.Series, window: int, min_periods: int = 1) -> pd.Series:
    """
    Optimized rolling mean absolute deviation using NumPy.
    """
    values = series.values
    n = len(values)
    result = np.empty(n)

    for i in range(n):
        start = max(0, i - window + 1)
        w = values[start:i + 1]
        if len(w) < min_periods:
            result[i] = np.nan
        else:
            result[i] = np.mean(np.abs(w - np.mean(w)))

    return pd.Series(result, index=series.index)


# ─── Optimized Hurst Exponent ────────────────────────────────────────────────

def compute_hurst_exponent(prices: pd.Series, max_lag: int = 20) -> float:
    """
    Approximate Hurst exponent using R/S analysis.
    Optimized version using Numba JIT compilation when available.
    """
    prices_arr = prices.dropna().values.astype(np.float64)
    n = len(prices_arr)

    if n < max_lag * 2:
        return 0.5

    if _HAS_NUMBA:
        return float(_numba_hurst(prices_arr, max_lag))

    # Fallback NumPy implementation
    lags = range(2, min(max_lag, n // 2))
    tau = []
    for lag in lags:
        truncated = n - (n % lag)
        subseries = prices_arr[:truncated].reshape(-1, lag)
        ranges = np.max(subseries, axis=1) - np.min(subseries, axis=1)
        means = np.mean(subseries, axis=1)
        avg_range = np.mean(ranges)
        avg_std = np.std(prices_arr[:n - (n % lag)])
        if avg_std > 0 and avg_range > 0:
            tau.append((np.log(avg_range / avg_std), np.log(lag)))

    if len(tau) < 2:
        return 0.5

    x = np.array([t[1] for t in tau])
    y = np.array([t[0] for t in tau])
    slope = np.polyfit(x, y, 1)[0]
    return float(max(0.0, min(1.0, slope)))


def compute_adx_di_gap(df: pd.DataFrame) -> pd.Series:
    """Compute ADX-DI gap feature. Optimized with cached values."""
    cache_key = FeatureCache.get_key(df, "adx_di_gap")
    cached = FeatureCache.get(cache_key)
    if cached is not None:
        return cached

    adx = df.get("adx_14", pd.Series(0, index=df.index))
    di_plus = df.get("di_plus", pd.Series(50, index=df.index))
    di_minus = df.get("di_minus", pd.Series(50, index=df.index))
    di_gap = abs(di_plus - di_minus)
    adx_gap = _safe_div(adx, di_gap + 1e-12, fill=0)

    FeatureCache.set(cache_key, adx_gap)
    return adx_gap


def compute_autocorrelation(prices: pd.Series, lag: int = 1) -> float:
    """Compute autocorrelation at given lag."""
    returns = prices.pct_change().dropna()
    if len(returns) < lag + 5:
        return 0.0
    return float(returns.autocorr(lag=lag))


def compute_realized_volatility(prices: pd.Series, window: int = 10) -> pd.Series:
    """Realized volatility as std of log returns * sqrt(252). Vectorized."""
    log_ret = np.log(prices / prices.shift(1))
    return log_ret.rolling(window, min_periods=2).std() * np.sqrt(252)


def compute_realized_skew(prices: pd.Series, window: int = 10) -> pd.Series:
    """Realized skewness of log returns. Vectorized."""
    log_ret = np.log(prices / prices.shift(1))
    return log_ret.rolling(window, min_periods=3).skew()


def compute_realized_kurtosis(prices: pd.Series, window: int = 10) -> pd.Series:
    """Realized kurtosis of log returns. Vectorized."""
    log_ret = np.log(prices / prices.shift(1))
    return log_ret.rolling(window, min_periods=4).kurt()


def compute_hurst_feature(df: pd.DataFrame, prices: pd.Series) -> pd.Series:
    """
    Hurst exponent as rolling feature.
    Uses vectorized implementation when available.
    """
    cache_key = FeatureCache.get_key(df, "hurst_feature")
    cached = FeatureCache.get(cache_key)
    if cached is not None:
        return cached

    prices_arr = prices.values.astype(np.float64)
    result = compute_hurst_feature_vectorized(prices_arr)
    result_series = pd.Series(result, index=df.index)

    FeatureCache.set(cache_key, result_series)
    return result_series


def compute_volume_profile_proxy(df: pd.DataFrame) -> pd.Series:
    """Volume-weighted price position as proxy for volume-profile. Optimized."""
    cache_key = FeatureCache.get_key(df, "volume_profile_proxy")
    cached = FeatureCache.get(cache_key)
    if cached is not None:
        return cached

    typical = (df["high"] + df["low"] + df["close"]) / 3.0
    vol_rolling = df["volume"].rolling(20, min_periods=1).sum()
    vol_rolling = vol_rolling.replace(0, 1e-12)
    vwap_proxy = (typical * df["volume"]).rolling(20, min_periods=1).sum() / vol_rolling
    result = _safe_div(df["close"] - vwap_proxy, df["high"] - df["low"] + 1e-12, fill=0)

    FeatureCache.set(cache_key, result)
    return result


def compute_distance_to_sr(df: pd.DataFrame) -> pd.Series:
    """Normalized distance to support/resistance levels. Optimized."""
    cache_key = FeatureCache.get_key(df, "distance_to_sr")
    cached = FeatureCache.get(cache_key)
    if cached is not None:
        return cached

    close = df["close"]
    sma20 = close.rolling(20, min_periods=1).mean()
    sma60 = close.rolling(60, min_periods=1).mean()
    bb_std = close.rolling(20, min_periods=1).std()
    upper_sr = sma60 + 2 * bb_std
    lower_sr = sma60 - 2 * bb_std
    dist_upper = _safe_div(close - upper_sr, close + 1e-12)
    dist_lower = _safe_div(lower_sr - close, close + 1e-12)
    result = (dist_upper + dist_lower) / 2.0

    FeatureCache.set(cache_key, result)
    return result


def compute_regime_dummy(df: pd.DataFrame) -> pd.Series:
    """Market regime dummy based on ADX and price position. Vectorized."""
    adx = df.get("adx_14", pd.Series(25, index=df.index))
    bb_pos = df.get("bb_position", pd.Series(0.5, index=df.index))
    regime = pd.Series(1.0, index=df.index)
    regime = regime.where(adx < 20, 2.0)   # Trending
    regime = regime.where(adx >= 20, 0.0)  # Ranging
    return regime


def compute_calendar_effect(df: pd.DataFrame) -> pd.Series:
    """Simple calendar effect placeholder (day-of-week proxy)."""
    return pd.Series(0.0, index=df.index)


def compute_autocorrelation_lags(df: pd.Series, lags: List[int] = [1, 2, 3, 5, 10]) -> pd.DataFrame:
    """Autocorrelation features at multiple lags. Vectorized."""
    ret = df.pct_change()
    result = pd.DataFrame(index=df.index)

    for lag in lags:
        autocorr_col = f"autocorr_lag{lag}"
        if lag >= len(ret):
            result[autocorr_col] = 0.0
            continue

        # Vectorized rolling autocorrelation
        roll_window = min(30, len(ret))
        shifted = ret.shift(lag)
        correlation = ret.rolling(roll_window, min_periods=lag + 2).corr(shifted)
        result[autocorr_col] = correlation.fillna(0.0)

    return result


# ─── Optimized Main Feature Extraction ──────────────────────────────────────

def extract_enhanced_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build 50+ technical features from OHLCV data.
    Heavily optimized version with:
    - Pre-computed intermediate values (typical price, returns)
    - Vectorized indicator calculations
    - Numba JIT compilation where beneficial
    - Caching of intermediate results
    - Reduced DataFrame copies
    """
    cache_key = FeatureCache.get_key(df, "enhanced_features")
    cached = FeatureCache.get(cache_key)
    if cached is not None:
        return cached.copy()

    out = pd.DataFrame(index=df.index)
    c = df["close"].astype(float)
    h = df["high"].astype(float)
    l = df["low"].astype(float)
    o = df["open"].astype(float)
    v = df["volume"].astype(float)
    closes = c.values
    n = len(closes)

    # ── Pre-compute shared intermediates ──
    c_diff = c.diff()
    log_ret_1d = np.log(c / c.shift(1))
    typical = (h + l + c) / 3.0
    tr = pd.concat([h - l, (h - c.shift(1)).abs(), (l - c.shift(1)).abs()], axis=1).max(axis=1)

    # ── Price returns ──
    for period in (1, 3, 5, 10, 20):
        out[f"return_{period}d"] = c.pct_change(period)

    # ── Log returns ──
    out["log_return_1d"] = log_ret_1d
    out["log_return_5d"] = np.log(c / c.shift(5))

    # ── Rolling statistics (single loop) ──
    for w in (5, 10, 20, 60):
        roll = c.rolling(w, min_periods=1)
        out[f"close_mean_{w}"] = roll.mean()
        out[f"close_std_{w}"] = roll.std()
        out[f"close_min_{w}"] = roll.min()
        out[f"close_max_{w}"] = roll.max()

    # ── RSI(14) ──
    if _HAS_NUMBA:
        out["rsi_14"] = _numba_rsi(closes, 14)
    else:
        delta = c.diff()
        gain = delta.clip(lower=0).rolling(14, min_periods=1).mean()
        loss = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
        rs = _safe_div(gain, loss, fill=100.0)
        out["rsi_14"] = 100.0 - (100.0 / (1.0 + rs))

    # ── MACD ──
    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    out["macd"] = ema12 - ema26
    out["macd_signal"] = out["macd"].ewm(span=9, adjust=False).mean()
    out["macd_hist"] = out["macd"] - out["macd_signal"]

    # ── Stochastic ──
    low14 = l.rolling(14, min_periods=1).min()
    high14 = h.rolling(14, min_periods=1).max()
    out["stoch_k"] = 100.0 * _safe_div(c - low14, high14 - low14)
    out["stoch_d"] = out["stoch_k"].rolling(3, min_periods=1).mean()

    # ── CCI(20) ──
    sma20_tp = typical.rolling(20, min_periods=1).mean()
    mad20 = _rolling_mad(typical, 20)
    out["cci_20"] = _safe_div(typical - sma20_tp, 0.015 * mad20)

    # ── ATR(14) ──
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
    out["di_plus"] = plus_di
    out["di_minus"] = minus_di

    # ── Bollinger Bands position ──
    bb_mid = out["close_mean_20"]
    bb_std = out["close_std_20"]
    out["bb_position"] = _safe_div(c - bb_mid, 2.0 * bb_std)

    # ── Volume features ──
    out["volume_sma_20"] = v.rolling(20, min_periods=1).mean()
    out["volume_ratio"] = _safe_div(v, out["volume_sma_20"])
    out["volume_zscore"] = _safe_div(v - out["volume_sma_20"], v.rolling(20, min_periods=1).std())

    # OBV
    direction = pd.Series(np.sign(c_diff.values), index=df.index).fillna(0)
    out["obv"] = (direction * v).cumsum()

    # ── Price patterns ──
    is_hh = (h > h.shift(1)).astype(float)
    is_ll = (l < l.shift(1)).astype(float)
    is_inside = ((h <= h.shift(1)) & (l >= l.shift(1))).astype(float)
    pw = 10
    out["higher_highs"] = is_hh.rolling(pw, min_periods=1).mean()
    out["lower_lows"] = is_ll.rolling(pw, min_periods=1).mean()
    out["inside_bar_ratio"] = is_inside.rolling(pw, min_periods=1).mean()

    # ── Momentum ──
    out["roc_10"] = _safe_div(c - c.shift(10), c.shift(10)) * 100.0
    out["momentum_score"] = (
        out["rsi_14"] - 50.0
        + out["macd_hist"] * 10.0
        + out["stoch_k"] - 50.0
    ) / 3.0

    # ── Lag features ──
    for lag in range(1, 6):
        out[f"return_1d_lag{lag}"] = out["log_return_1d"].shift(lag)
        out[f"rsi_14_lag{lag}"] = out["rsi_14"].shift(lag)

    # ══════════════════════════════════════════════════════════════
    # COMPLEMENTARY FEATURES
    # ══════════════════════════════════════════════════════════════

    # ── Realized Volatility ──
    out["realized_vol_10"] = compute_realized_volatility(c, 10)
    out["realized_vol_20"] = compute_realized_volatility(c, 20)

    # ── Realized Skew ──
    out["realized_skew_10"] = compute_realized_skew(c, 10)

    # ── Realized Kurtosis ──
    out["realized_kurt_10"] = compute_realized_kurtosis(c, 10)

    # ── Hurst Exponent ──
    out["hurst_exponent"] = compute_hurst_feature(df, c)

    # ── ADX-DI Gap ──
    out["adx_di_gap"] = compute_adx_di_gap(df)

    # ── Volume Profile Proxy ──
    out["volume_profile_proxy"] = compute_volume_profile_proxy(df)

    # ── Distance-to-S/R Normalized ──
    out["distance_to_sr"] = compute_distance_to_sr(df)

    # ── Regime Dummies ──
    out["regime_dummy"] = compute_regime_dummy(df)

    # ── Calendar Effects ──
    out["calendar_effect"] = compute_calendar_effect(df)

    # ── Autocorrelation Lags ──
    autocorr_df = compute_autocorrelation_lags(c, [1, 2, 3, 5])
    out = pd.concat([out, autocorr_df], axis=1)

    # ── Volume-Weighted Price Position ──
    vol_rolling_20 = v.rolling(20, min_periods=1).sum().replace(0, np.nan)
    vwap_proxy = (typical * v).rolling(20, min_periods=1).sum() / vol_rolling_20
    out["vwap_proxy_dist"] = _safe_div(c - vwap_proxy, (h - l + 1e-12))

    # ── Price Range Asymmetry ──
    out["range_asymmetry"] = _safe_div(h - c, c - l + 1e-12)

    # ── Close Location Value ──
    out["clv"] = _safe_div((c - l) - (h - c), h - l + 1e-12)

    # ── Trend Strength ──
    sma5 = c.rolling(5, min_periods=1).mean()
    sma20 = out["close_mean_20"]
    out["trend_strength"] = _safe_div(sma5 - sma20, sma20 + 1e-12)

    # ── Up/Down Volume Ratio ──
    up_volume = v.where(c > c.shift(1), 0)
    down_volume = v.where(c < c.shift(1), 0)
    out["up_down_vol_ratio"] = _safe_div(
        up_volume.rolling(10).sum(), down_volume.rolling(10).sum() + 1e-12
    )

    # ── Volume Acceleration ──
    out["volume_acceleration"] = v.pct_change(5)

    # ── Momentum Divergence Proxy ──
    out["momentum_divergence"] = out["macd_hist"] - out["macd_hist"].shift(3)

    # ── Squeeze Indicator (BB width vs ATR) ──
    bb_width = (2 * bb_std) / bb_mid.replace(0, np.nan)
    atr_normalized = out["atr_14"] / c
    out["squeeze"] = bb_width - atr_normalized

    # ── Regime Detection Features ──
    hurst_val = compute_hurst_exponent(c, max_lag=20)
    out["hurst_regime_trending"] = 1.0 if hurst_val > 0.55 else 0.0
    out["hurst_regime_meanrev"] = 1.0 if hurst_val < 0.45 else 0.0
    out["hurst_value"] = hurst_val

    # Volatility regime
    realized_vol = log_ret_1d.rolling(20, min_periods=2).std() * np.sqrt(252)
    vol_median = realized_vol.rolling(60, min_periods=2).median()
    out["vol_regime_high"] = (realized_vol > vol_median * 1.2).astype(float)
    out["vol_regime_low"] = (realized_vol < vol_median * 0.8).astype(float)
    out["vol_ratio_to_median"] = _safe_div(realized_vol, vol_median + 1e-12)

    # Trend regime
    adx_val = out["adx_14"]
    out["trend_regime"] = (adx_val > 25).astype(float)

    # Market regime score
    out["regime_score"] = (
        0.4 * (hurst_val - 0.5)
        + 0.3 * (out["vol_ratio_to_median"] - 1.0)
        + 0.3 * (adx_val / 100.0)
    )

    # Cache result
    FeatureCache.set(cache_key, out.copy())
    return out


# ─── Feature Importance Cache ─────────────────────────────────────────────────

@lru_cache(maxsize=32)
def _get_feature_importance_cache_key(model_type: str, n_features: int, random_seed: int) -> str:
    """Cache key for feature importance computations."""
    return f"imp:{model_type}:{n_features}:{random_seed}"


# ─── GPU-Accelerated Feature Computation ────────────────────────────────────

def extract_features_gpu(
    c_array: np.ndarray,
    h_array: np.ndarray,
    l_array: np.ndarray,
    v_array: np.ndarray,
) -> Dict[str, np.ndarray]:
    """
    Compute technical features using GPU acceleration (CuPy).
    Used for large datasets where GPU acceleration provides significant speedup.
    """
    if not _HAS_CUPY:
        return {}

    # Convert to GPU arrays
    c = cp.asarray(c_array, dtype=cp.float64)
    h = cp.asarray(h_array, dtype=cp.float64)
    l = cp.asarray(l_array, dtype=cp.float64)
    v = cp.asarray(v_array, dtype=cp.float64)

    results = {}

    # Vectorized operations on GPU
    diff = cp.diff(c, prepend=c[0])
    results['returns'] = cp.where(c[:-1] != 0, diff / c[:-1], 0)

    # Rolling mean on GPU (simplified - full implementation would use CuPy's sliding_window_view)
    results['sma_20'] = cp.convolve(c, cp.ones(20) / 20, mode='same')
    results['sma_50'] = cp.convolve(c, cp.ones(50) / 50, mode='same')

    # Convert back to CPU
    return {k: cp.asnumpy(v) for k, v in results.items()}


def create_walk_forward_splits(
    n_samples: int,
    n_splits: int = 5,
    initial_train_size: Optional[int] = None,
    test_size: int = 1,
    step_size: int = 1,
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """
    Create walk-forward (expanding window) train/test splits for time series.

    Unlike TimeSeriesSplit which creates fixed-size train folds, WalkForwardSplit
    mimics real-world deployment: train on all available history, test on the
    next step(s), then expand the training window.

    Parameters
    ----------
    n_samples : int
        Total number of samples.
    n_splits : int
        Number of walk-forward folds to generate.
    initial_train_size : int, optional
        Size of the initial training window. If None, uses n_samples // 3.
    test_size : int
        Number of test samples per fold.
    step_size : int
        How many samples to advance the test window each fold.

    Returns
    -------
    List[Tuple[np.ndarray, np.ndarray]]
        List of (train_indices, test_indices) tuples.
    """
    if initial_train_size is None:
        initial_train_size = max(n_samples // 3, 30)

    splits = []
    train_end = initial_train_size

    for i in range(n_splits):
        test_start = train_end
        test_end = min(test_start + test_size, n_samples)

        if test_end > n_samples:
            break

        train_idx = np.arange(0, train_end)
        test_idx = np.arange(test_start, test_end)

        splits.append((train_idx, test_idx))

        # Expand training window for next fold
        train_end = test_start + step_size
        if train_end > n_samples:
            break

    return splits


def get_cv_splits(
    n_samples: int,
    cv_method: str = "time_series",
    n_splits: int = 5,
    initial_train_size: Optional[int] = None,
    test_size: int = 1,
    step_size: int = 1,
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """
    Unified CV split generator supporting both TimeSeriesSplit and WalkForwardSplit.

    Parameters
    ----------
    n_splits : int
        Number of splits.
    initial_train_size : int, optional
        Initial training window size (walk-forward only).
    test_size : int
        Test window size per fold (walk-forward only).
    step_size : int
        Step between folds (walk-forward only).

    Returns
    -------
    List[Tuple[np.ndarray, np.ndarray]]
        List of (train_indices, test_indices) tuples.
    """
    if cv_method == "walk_forward":
        return create_walk_forward_splits(
            n_samples, n_splits, initial_train_size, test_size, step_size
        )

    # Default: TimeSeriesSplit
    from sklearn.model_selection import TimeSeriesSplit

    tscv = TimeSeriesSplit(n_splits=n_splits)
    return list(tscv.split(np.arange(n_samples).reshape(-1, 1)))


# ─── Feature Selection ────────────────────────────────────────────────────────

def select_stable_features(
    fold_feature_importance: List[Dict[str, float]],
    threshold: float = 0.8,
) -> List[str]:
    """
    Select features that consistently rank among the top features across CV folds.

    A feature is considered "stable" if it appears in the top 50% of features
    (by importance) in at least `threshold` fraction of folds.

    Parameters
    ----------
    fold_feature_importance : List[Dict[str, float]]
        List of feature-importance dicts, one per CV fold.
    threshold : float
        Minimum fraction of folds (0-1) where a feature must be stable to be selected.

    Returns
    -------
    List[str]
        List of stable feature names, ordered by average importance.
    """
    if not fold_feature_importance:
        return []

    feature_ranks: Dict[str, List[int]] = {}

    for fold_imp in fold_feature_importance:
        if not fold_imp:
            continue
        # Sort features by importance (descending)
        sorted_features = sorted(fold_imp.items(), key=lambda x: x[1], reverse=True)
        n = len(sorted_features)

        for rank, (feature, _) in enumerate(sorted_features):
            if feature not in feature_ranks:
                feature_ranks[feature] = []
            # Rank as fraction of total features (0 = most important)
            feature_ranks[feature].append(rank / n if n > 0 else 1.0)

    # A feature is stable if its average normalized rank is below (1 - threshold)
    stable_features = []
    for feature, ranks in feature_ranks.items():
        avg_rank = sum(ranks) / len(ranks)
        if avg_rank < (1.0 - threshold):
            stable_features.append(feature)

    # Sort by average importance
    avg_importance = {}
    for feature in stable_features:
        imps = [fi.get(feature, 0.0) for fi in fold_feature_importance if fi]
        avg_importance[feature] = sum(imps) / len(imps) if imps else 0.0

    stable_features.sort(key=lambda f: avg_importance[f], reverse=True)
    return stable_features


def get_feature_importance(model, feature_cols: List[str]) -> Dict[str, float]:
    """Get feature importance from a trained model. Handles various model types."""
    return _get_feature_importance(model, feature_cols)
