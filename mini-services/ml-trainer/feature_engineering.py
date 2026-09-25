import numpy as np
import pandas as pd
from scipy import stats
from typing import List, Optional, Tuple, Any


def fill_nan_values(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fill NaN values in feature DataFrame with appropriate defaults.
    
    Strategy:
    - Return/log-return columns: 0.0 (no expected change)
    - RSI/MACD/Stochastic: neutral values (50, 0)
    - Volume features: 0.0
    - Correlation features: 0.0
    - Rolling statistics: forward fill, then 0.0
    - Remaining: backward/forward fill, then 0.0
    
    This preserves all data points while providing sensible defaults
    for the early rows where technical indicators haven't warmed up yet.
    """
    df = df.copy()
    
    for col in df.columns:
        if df[col].isna().sum() == 0:
            continue
            
        if df[col].dtype in ('float64', 'float32', 'int64', 'int32') or np.issubdtype(df[col].dtype, np.number):
            if 'return' in col.lower() or 'log_return' in col.lower() or 'roc' in col.lower():
                df[col] = df[col].fillna(0.0)
            elif 'rsi' in col.lower() or 'stoch' in col.lower() or 'cci' in col.lower():
                df[col] = df[col].fillna(50.0)
            elif 'macd' in col.lower() or 'momentum' in col.lower() or 'trend' in col.lower() or 'squeeze' in col.lower():
                df[col] = df[col].fillna(0.0)
            elif 'adx' in col.lower() or 'di_' in col.lower():
                df[col] = df[col].fillna(25.0)
            elif 'volume' in col.lower() or 'obv' in col.lower() or 'vwap' in col.lower() or 'vol_' in col.lower():
                df[col] = df[col].fillna(0.0)
            elif 'autocorr' in col.lower():
                df[col] = df[col].fillna(0.0)
            elif 'hurst' in col.lower():
                df[col].fillna(0.5, inplace=True)
            else:
                df[col] = df[col].ffill().bfill().fillna(0.0)
        else:
            df[col] = df[col].ffill().bfill()
    
    return df


def _safe_div(a, b, fill=0.0):
    if isinstance(a, (pd.Series, np.ndarray)) or isinstance(b, (pd.Series, np.ndarray)):
        result = np.where(np.abs(b) > 1e-12, a / b, fill)
        idx = a.index if isinstance(a, pd.Series) else b.index
        return pd.Series(result, index=idx)
    return a / b if abs(b) > 1e-12 else fill


def _rolling_mad(series, window, min_periods=1):
    return series.rolling(window, min_periods=min_periods).apply(
        lambda x: np.mean(np.abs(x - x.mean())), raw=True
    )


def compute_hurst_exponent(prices: pd.Series, max_lag: int = 20) -> float:
    """Approximate Hurst exponent using R/S analysis."""
    prices = prices.dropna()
    if len(prices) < max_lag * 2:
        return 0.5
    n = len(prices)
    lags = range(2, min(max_lag, n // 2))
    tau = []
    for lag in lags:
        truncated = n - (n % lag)
        subseries = prices.iloc[:truncated].values.reshape(-1, lag)
        ranges = []
        means = []
        for s in subseries:
            if len(s) < 2:
                continue
            ranges.append(np.max(s) - np.min(s))
            means.append(np.mean(s))
        if not ranges or not means:
            continue
        avg_range = np.mean(ranges)
        avg_std = np.std(prices.iloc[:n - (n % lag)].values) if len(prices) > lag else 0
        if avg_std > 0:
            tau.append((np.log(avg_range / avg_std), np.log(lag)))
    if len(tau) < 2:
        return 0.5
    x = np.array([t[1] for t in tau])
    y = np.array([t[0] for t in tau])
    slope = np.polyfit(x, y, 1)[0]
    return float(slope)


def compute_adx_di_gap(df: pd.DataFrame) -> float:
    """Compute ADX-DI gap feature."""
    adx = df.get("adx_14", pd.Series(0, index=df.index))
    di_plus = df.get("di_plus", pd.Series(50, index=df.index))
    di_minus = df.get("di_minus", pd.Series(50, index=df.index))
    di_gap = abs(di_plus - di_minus)
    adx_gap = _safe_div(adx, di_gap + 1e-12, fill=0)
    return adx_gap


def compute_autocorrelation(prices: pd.Series, lag: int = 1) -> float:
    """Compute autocorrelation at given lag."""
    returns = prices.pct_change().dropna()
    if len(returns) < lag + 5:
        return 0.0
    return float(returns.autocorr(lag=lag))


def compute_realized_volatility(prices: pd.Series, window: int = 10) -> pd.Series:
    """Realized volatility as std of log returns * sqrt(252)."""
    log_ret = np.log(prices / prices.shift(1))
    return log_ret.rolling(window).std() * np.sqrt(252)


def compute_realized_skew(prices: pd.Series, window: int = 10) -> pd.Series:
    """Realized skewness of log returns."""
    log_ret = np.log(prices / prices.shift(1))
    return log_ret.rolling(window).skew()


def compute_realized_kurtosis(prices: pd.Series, window: int = 10) -> pd.Series:
    """Realized kurtosis of log returns."""
    log_ret = np.log(prices / prices.shift(1))
    return log_ret.rolling(window).kurt()


def compute_hurst_feature(df: pd.DataFrame, prices: pd.Series) -> pd.Series:
    """Hurst exponent as rolling feature."""
    hurst_vals = []
    prices_list = prices.values
    for i in range(len(prices_list)):
        if i < 30:
            hurst_vals.append(0.5)
        else:
            sub = pd.Series(prices_list[max(0, i-60):i+1])
            hurst_vals.append(compute_hurst_exponent(sub))
    return pd.Series(hurst_vals, index=df.index)


def compute_volume_profile_proxy(df: pd.DataFrame) -> pd.Series:
    """Volume-weighted price position as proxy for volume-profile."""
    typical = (df["high"] + df["low"] + df["close"]) / 3.0
    vwap_proxy = (typical * df["volume"]).rolling(20).sum() / df["volume"].rolling(20).sum()
    return _safe_div(df["close"] - vwap_proxy, df["high"] - df["low"] + 1e-12, fill=0)


def compute_distance_to_sr(df: pd.DataFrame) -> pd.Series:
    """Normalized distance to support/resistance levels."""
    close = df["close"]
    sma20 = close.rolling(20, min_periods=1).mean()
    sma60 = close.rolling(60, min_periods=1).mean()
    bb_mid = sma20
    bb_std = close.rolling(20, min_periods=1).std()
    upper_sr = sma60 + 2 * bb_std
    lower_sr = sma60 - 2 * bb_std
    dist_upper = _safe_div(close - upper_sr, close + 1e-12)
    dist_lower = _safe_div(lower_sr - close, close + 1e-12)
    return (dist_upper + dist_lower) / 2.0


def compute_regime_dummy(df: pd.DataFrame) -> pd.Series:
    """Market regime dummy based on ADX and price position."""
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
    """Autocorrelation features at multiple lags."""
    ret = df.pct_change()
    result = pd.DataFrame(index=df.index)
    for lag in lags:
        result[f"autocorr_lag{lag}"] = ret.rolling(min(30, len(ret))).apply(
            lambda x: x.autocorr(lag=lag) if len(x) > lag + 1 else 0.0, raw=False
        )
    return result


def extract_enhanced_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build 50+ technical features from OHLCV data.
    
    Preserves all original features from extract_features() and adds 12+ complementary features:
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
    out = pd.DataFrame(index=df.index)
    c = df["close"].astype(float)
    h = df["high"].astype(float)
    l = df["low"].astype(float)
    o = df["open"].astype(float)
    v = df["volume"].astype(float)

    # ── Price returns (original) ──
    for period in (1, 3, 5, 10, 20):
        out[f"return_{period}d"] = c.pct_change(period)

    # ── Log returns (NEW) ──
    out["log_return_1d"] = np.log(c / c.shift(1))
    out["log_return_5d"] = np.log(c / c.shift(5))
    ret = out["log_return_1d"]

    # ── Rolling statistics (original) ──
    for w in (5, 10, 20, 60):
        roll = c.rolling(w, min_periods=1)
        out[f"close_mean_{w}"] = roll.mean()
        out[f"close_std_{w}"] = roll.std()
        out[f"close_min_{w}"] = roll.min()
        out[f"close_max_{w}"] = roll.max()

    # ── RSI(14) (original) ──
    delta = c.diff()
    gain = delta.clip(lower=0).rolling(14, min_periods=1).mean()
    loss = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
    rs = _safe_div(gain, loss, fill=100.0)
    out["rsi_14"] = 100.0 - (100.0 / (1.0 + rs))

    # ── MACD(12,26,9) (original) ──
    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    out["macd"] = ema12 - ema26
    out["macd_signal"] = out["macd"].ewm(span=9, adjust=False).mean()
    out["macd_hist"] = out["macd"] - out["macd_signal"]

    # ── Stochastic(14,3,3) (original) ──
    low14 = l.rolling(14, min_periods=1).min()
    high14 = h.rolling(14, min_periods=1).max()
    out["stoch_k"] = 100.0 * _safe_div(c - low14, high14 - low14)
    out["stoch_d"] = out["stoch_k"].rolling(3, min_periods=1).mean()

    # ── CCI(20) (original) ──
    typical = (h + l + c) / 3.0
    sma20 = typical.rolling(20, min_periods=1).mean()
    mad20 = _rolling_mad(typical, 20)
    out["cci_20"] = _safe_div(typical - sma20, 0.015 * mad20)

    # ── ATR(14) (original) ──
    tr = pd.concat([h - l, (h - c.shift(1)).abs(), (l - c.shift(1)).abs()], axis=1).max(axis=1)
    out["atr_14"] = tr.rolling(14, min_periods=1).mean()

    # ── ADX(14) (original) ──
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

    # ── Bollinger Bands position (original) ──
    bb_mid = c.rolling(20, min_periods=1).mean()
    bb_std = c.rolling(20, min_periods=1).std()
    out["bb_position"] = _safe_div(c - bb_mid, 2.0 * bb_std)

    # ── Volume features (original) ──
    out["volume_sma_20"] = v.rolling(20, min_periods=1).mean()
    out["volume_ratio"] = _safe_div(v, out["volume_sma_20"])
    out["volume_zscore"] = _safe_div(v - out["volume_sma_20"], v.rolling(20, min_periods=1).std())

    # OBV
    direction = pd.Series(np.sign(c.diff()), index=df.index).fillna(0)
    obv = (direction * v).cumsum()
    out["obv"] = obv

    # ── Price patterns (original) ──
    is_hh = (h > h.shift(1)).astype(float)
    is_ll = (l < l.shift(1)).astype(float)
    is_inside = ((h <= h.shift(1)) & (l >= l.shift(1))).astype(float)
    pw = 10
    out["higher_highs"] = is_hh.rolling(pw, min_periods=1).mean()
    out["lower_lows"] = is_ll.rolling(pw, min_periods=1).mean()
    out["inside_bar_ratio"] = is_inside.rolling(pw, min_periods=1).mean()

    # ── Momentum (original) ──
    out["roc_10"] = _safe_div(c - c.shift(10), c.shift(10)) * 100.0
    momentum_score = (
        out.get("rsi_14", pd.Series(50, index=df.index)) - 50.0
        + out.get("macd_hist", pd.Series(0, index=df.index)) * 10.0
        + out.get("stoch_k", pd.Series(50, index=df.index)) - 50.0
    ) / 3.0
    out["momentum_score"] = momentum_score

    # ── Lag features (original) ──
    for lag in range(1, 6):
        out[f"return_1d_lag{lag}"] = out["return_1d"].shift(lag)
        out[f"rsi_14_lag{lag}"] = out["rsi_14"].shift(lag)

    # ══════════════════════════════════════════════════════════════
    # NEW COMPLEMENTARY FEATURES (12+)
    # ══════════════════════════════════════════════════════════════

    # ── NEW 1: Realized Volatility ──
    out["realized_vol_10"] = compute_realized_volatility(c, 10)
    out["realized_vol_20"] = compute_realized_volatility(c, 20)

    # ── NEW 2: Realized Skew ──
    out["realized_skew_10"] = compute_realized_skew(c, 10)

    # ── NEW 3: Realized Kurtosis ──
    out["realized_kurt_10"] = compute_realized_kurtosis(c, 10)

    # ── NEW 4: Hurst Exponent ──
    out["hurst_exponent"] = compute_hurst_feature(df, c)

    # ── NEW 5: ADX-DI Gap ──
    out["adx_di_gap"] = compute_adx_di_gap(df)

    # ── NEW 6: Volume Profile Proxy ──
    out["volume_profile_proxy"] = compute_volume_profile_proxy(df)

    # ── NEW 7: Distance-to-S/R Normalized ──
    out["distance_to_sr"] = compute_distance_to_sr(df)

    # ── NEW 8: Regime Dummies ──
    out["regime_dummy"] = compute_regime_dummy(df)

    # ── NEW 9: Calendar Effects ──
    out["calendar_effect"] = compute_calendar_effect(df)

    # ── NEW 10-12: Autocorrelation Lags ──
    autocorr_df = compute_autocorrelation_lags(c, [1, 2, 3, 5])
    out = pd.concat([out, autocorr_df], axis=1)

    # ── NEW 13: Volume-Weighted Price Position ──
    vwap_proxy = (typical * v).rolling(20).sum() / v.rolling(20).sum()
    out["vwap_proxy_dist"] = _safe_div(c - vwap_proxy, (h - l + 1e-12))

    # ── NEW 14: Price Range Asymmetry ──
    out["range_asymmetry"] = _safe_div(h - c, c - l + 1e-12)

    # ── NEW 15: Close Location Value ──
    out["clv"] = _safe_div((c - l) - (h - c), h - l + 1e-12)

    # ── NEW 16: Trend Strength ──
    sma5 = c.rolling(5, min_periods=1).mean()
    sma20 = c.rolling(20, min_periods=1).mean()
    out["trend_strength"] = _safe_div(sma5 - sma20, sma20 + 1e-12)

    # ── NEW 17: Up/Down Volume Ratio ──
    up_volume = v.where(c > c.shift(1), 0)
    down_volume = v.where(c < c.shift(1), 0)
    out["up_down_vol_ratio"] = _safe_div(
        up_volume.rolling(10).sum(), down_volume.rolling(10).sum() + 1e-12
    )

    # ── NEW 18: Volume Acceleration ──
    out["volume_acceleration"] = v.pct_change(5)

    # ── NEW 19: Momentum Divergence Proxy ──
    out["momentum_divergence"] = out["macd_hist"] - out["macd_hist"].shift(3)

    # ── NEW 20: Squeeze Indicator (BB width vs ATR) ──
    bb_width = (2 * bb_std) / bb_mid
    atr_normalized = out["atr_14"] / c
    out["squeeze"] = bb_width - atr_normalized

    # ── NEW 21: Regime Detection Features ──
    # Hurst-based regime: trending (H > 0.55) vs mean-reverting (H < 0.45)
    hurst_val = compute_hurst_exponent(c)
    out["hurst_regime_trending"] = 1.0 if hurst_val > 0.55 else 0.0
    out["hurst_regime_meanrev"] = 1.0 if hurst_val < 0.45 else 0.0
    out["hurst_value"] = hurst_val

    # Volatility regime: high vs low volatility periods
    realized_vol = ret.rolling(20).std() * np.sqrt(252)
    vol_median = realized_vol.rolling(60).median()
    out["vol_regime_high"] = (realized_vol > vol_median * 1.2).astype(float)
    out["vol_regime_low"] = (realized_vol < vol_median * 0.8).astype(float)
    out["vol_ratio_to_median"] = _safe_div(realized_vol, vol_median + 1e-12)

    # Trend regime: ADX-based trending vs ranging
    adx_val = out.get("adx_14", 0)
    out["trend_regime"] = (adx_val > 25).astype(float)

    # Market regime score: composite of hurst, volatility, and trend
    out["regime_score"] = (
        0.4 * (hurst_val - 0.5)
        + 0.3 * (out["vol_ratio_to_median"] - 1.0)
        + 0.3 * (adx_val / 100.0)
    )

    return out


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
    n_samples : int
        Total number of samples.
    cv_method : str
        "time_series" for TimeSeriesSplit, "walk_forward" for expanding window.
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