"""
Enhanced feature engineering for time series analysis.

This module extracts advanced technical indicators and statistical features
from OHLCV data, going beyond the basic features in Phase 0.4 (37 VDSS features).

Features include:
- Log returns and volatility measures
- Hurst exponent for long-term memory
- Realized volatility and skewness/kurtosis
- Technical indicators
- Distance measures from key levels
- Market regime detection
- Autocorrelation measures
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from collections import deque


# ────────────────────────────────────────────────────────────────────────────
# Core Feature Extraction
# ────────────────────────────────────────────────────────────────────────────

def extract_enhanced_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract 45+ enhanced features from OHLCV data.
    
    Args:
        df: DataFrame with columns ['date', 'open', 'high', 'low', 'close', 'volume']
    
    Returns:
        DataFrame with enhanced features
    """
    if df.empty:
        raise ValueError("Input DataFrame is empty")
    
    # Ensure required columns
    required_cols = ['open', 'high', 'low', 'close', 'volume']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")
    
    # Create a copy to avoid modifying input
    result = df.copy()
    
    # Calculate price changes and returns
    result['log_return_1d'] = np.log(result['close'] / result['close'].shift(1))
    result['log_return_5d'] = np.log(result['close'] / result['close'].shift(5))
    result['price_change_1d'] = result['close'].diff()
    result['price_change_5d'] = result['close'].diff(5)
    
    # Volatility features
    result['realized_vol_10'] = compute_realized_volatility(result, window=10)
    result['realized_vol_20'] = compute_realized_volatility(result, window=20)
    result['realized_skew_10'] = compute_realized_skew(result, window=10)
    result['realized_kurt_10'] = compute_realized_kurtosis(result, window=10)
    
    # Time series analysis features
    result['hurst_exponent'] = compute_hurst_exponent(result['close'])
    result['autocorr_lag1'] = compute_autocorrelation(result['close'], lag=1)
    result['autocorr_lag2'] = compute_autocorrelation(result['close'], lag=2)
    result['adx_di_gap'] = compute_adx_di_gap(result)
    
    # Technical indicators (simplified)
    result['rsi_14'] = compute_rsi(result['close'], window=14)
    result['macd_line'], result['macd_signal'] = compute_macd(result['close'])
    result['bollinger_width'] = compute_bollinger_width(result['close'])
    
    # Volume features
    result['volume_profile_proxy'] = compute_volume_profile(result['volume'])
    result['volume_change_ratio'] = result['volume'].pct_change()
    
    # Price level features
    result['distance_to_sr'] = compute_distance_to_support_resistance(result)
    result['price_vs_ma21'] = result['close'] / result['close'].rolling(21).mean()
    result['price_vs_ma100'] = result['close'] / result['close'].rolling(100).mean()
    
    # Market regime
    result['regime_dummy'] = compute_market_regime(result)
    
    # Volatility regime
    result['volatility_regime'] = compute_volatility_regime(result['realized_vol_10'])
    
    # Trend features
    result['trend_strength'] = compute_trend_strength(result['close'])
    result['momentum'] = compute_momentum(result['close'])
    
    # Pattern detection
    result['pattern_signal'] = compute_pattern_signals(result)
    
    # Moving averages
    result['ma_5'] = result['close'].rolling(5).mean()
    result['ma_10'] = result['close'].rolling(10).mean()
    result['ma_20'] = result['close'].rolling(20).mean()
    result['ma_50'] = result['close'].rolling(50).mean()
    
    # Volatility bands
    result['atr_14'] = compute_atr(result['high'], result['low'], result['close'], window=14)
    result['volatility_10'] = result['close'].rolling(10).std() * np.sqrt(10)
    result['bollinger_position'] = (result['close'] - result['close'].rolling(20).mean()) / (result['close'].rolling(20).std() * 2)
    result['volume_ma_ratio'] = result['volume'] / result['volume'].rolling(10).mean()
    result['rsi_21'] = compute_rsi(result['close'], window=21)
    result['williams_r'] = compute_williams_r(result['high'], result['low'], result['close'], window=14)
    result['stochastic_k'] = compute_stochastic_k(result['high'], result['low'], result['close'], window=14)
    result['stochastic_d'] = result['stochastic_k'].rolling(3).mean()
    result['cci'] = compute_cci(result['high'], result['low'], result['close'], window=20)
    result['adx'] = compute_adx(result['high'], result['low'], result['close'], window=14)
    
    # Drop non-feature columns to keep only numeric features
    result = result.drop(columns=['date'], errors='ignore')
    
    return result


def compute_realized_volatility(df: pd.DataFrame, window: int) -> pd.Series:
    """Calculate realized volatility for given window."""
    if len(df) < window:
        return pd.Series([0] * len(df))
    
    returns = np.log(df['close'] / df['close'].shift(1))
    realized_vol = returns.rolling(window).std() * np.sqrt(window)
    return realized_vol


def compute_realized_skew(df: pd.DataFrame, window: int) -> pd.Series:
    """Calculate realized skewness for given window."""
    if len(df) < window:
        return pd.Series([0] * len(df))
    
    returns = np.log(df['close'] / df['close'].shift(1))
    realized_skew = returns.rolling(window).skew()
    return realized_skew


def compute_realized_kurtosis(df: pd.DataFrame, window: int) -> pd.Series:
    """Calculate realized kurtosis for given window."""
    if len(df) < window:
        return pd.Series([0] * len(df))
    
    returns = np.log(df['close'] / df['close'].shift(1))
    realized_kurt = returns.rolling(window).kurt()
    return realized_kurt


def compute_hurst_exponent(prices: pd.Series) -> float:
    """Calculate Hurst exponent for time series."""
    if len(prices) < 20:
        return 0.5
    
    # Simple implementation
    # Hurst exponent between 0 and 1: <0.5 means mean-reverting, >0.5 means trending
    ln_ret = np.log(prices / prices.shift(1))
    
    # Remove NaN values
    ln_ret = ln_ret.dropna()
    if len(ln_ret) < 10:
        return 0.5
    
    # Calculate RS (Rescaled Range) statistic
    n = len(ln_ret)
    if n < 2:
        return 0.5
    
    # Simple R/S calculation
    cumsum = np.cumsum(ln_ret)
    range_ = np.max(cumsum) - np.min(cumsum)
    std_dev = np.std(ln_ret)
    
    if std_dev == 0:
        return 0.5
    
    hurst = np.log(range_ / std_dev) / np.log(n)
    
    # Clamp to reasonable range
    return max(0.01, min(0.99, hurst))


def compute_autocorrelation(series: pd.Series, lag: int) -> float:
    """Calculate autocorrelation for given lag."""
    if len(series) < lag + 10:
        return 0
    
    corr = series.autocorr(lag)
    return corr if not pd.isna(corr) else 0


def compute_adx_di_gap(df: pd.DataFrame) -> pd.Series:
    """Calculate ADX - DI gap."""
    # Simplified ADX calculation
    if len(df) < 14:
        return pd.Series([0] * len(df))
    
    tr = df[['high', 'low', 'close']].copy()
    tr['tr'] = np.maximum(tr['high'] - tr['low'], 
                         np.maximum(abs(tr['high'] - tr['close'].shift(1)), 
                                    abs(tr['low'] - tr['close'].shift(1))))
    
    adx = tr['tr'].rolling(14).mean()
    di_plus = tr['high'].diff() / tr['high'].rolling(14).mean()
    di_minus = abs(tr['low'].diff()) / tr['low'].rolling(14).mean()
    
    gap = di_plus - di_minus
    return gap


def compute_rsi(prices: pd.Series, window: int) -> pd.Series:
    """Calculate Relative Strength Index."""
    if len(prices) < window:
        return pd.Series([50] * len(prices))
    
    delta = prices.diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    
    avg_gain = gain.rolling(window).mean()
    avg_loss = loss.rolling(window).mean()
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    
    return rsi


def compute_macd(prices: pd.Series) -> Tuple[pd.Series, pd.Series]:
    """Calculate MACD."""
    short_window = 12
    long_window = 26
    signal_window = 9
    
    if len(prices) < long_window + signal_window:
        return pd.Series([0] * len(prices)), pd.Series([0] * len(prices))
    
    ema_short = prices.ewm(span=short_window).mean()
    ema_long = prices.ewm(span=long_window).mean()
    macd_line = ema_short - ema_long
    signal = macd_line.ewm(span=signal_window).mean()
    
    return macd_line, signal


def compute_bollinger_width(prices: pd.Series) -> pd.Series:
    """Calculate Bollinger width as percentage."""
    if len(prices) < 20:
        return pd.Series([0.5] * len(prices))
    
    window = 20
    sma = prices.rolling(window).mean()
    std_dev = prices.rolling(window).std()
    
    bollinger_width = (std_dev / sma) * 100
    return bollinger_width


def compute_volume_profile(volumes: pd.Series) -> pd.Series:
    """Calculate volume profile proxy."""
    # Simple volume profile based on volume distribution
    window = 10
    if len(volumes) < window:
        return pd.Series([0.5] * len(volumes))
    
    vol_ma = volumes.rolling(window).mean()
    
    # Normalize to [0, 1] range
    min_vol = vol_ma.min()
    max_vol = vol_ma.max()
    
    if max_vol == min_vol:
        return pd.Series([0.5] * len(volumes))
    
    vol_profile = (vol_ma - min_vol) / (max_vol - min_vol)
    return vol_profile


def compute_distance_to_support_resistance(df: pd.DataFrame) -> pd.Series:
    """Calculate distance to nearest support/resistance levels."""
    window = 30
    if len(df) < window:
        return pd.Series([0.1] * len(df))
    
    high_window = df['high'].rolling(window, min_periods=1).max()
    low_window = df['low'].rolling(window, min_periods=1).min()
    
    current_price = df['close']
    distance_to_sr = np.abs(current_price - (high_window + low_window) / 2)
    max_price_range = high_window - low_window
    
    # Normalize by price range
    normalized_distance = distance_to_sr / (max_price_range + 0.001)
    return normalized_distance


def compute_market_regime(df: pd.DataFrame) -> pd.Series:
    """Detect market regime (bull/bear/neutral)."""
    window = 20
    if len(df) < window:
        return pd.Series([0.5] * len(df))
    
    returns = df['close'].pct_change()
    
    # Simple regime classification
    volatility = returns.rolling(window).std()
    trend = df['close'].rolling(window).apply(lambda x: np.polyfit(range(len(x)), x, 1)[0] if len(x) > 1 else 0)
    
    # Bull regime: high trend + moderate volatility
    # Bear regime: low trend (negative) + high volatility
    # Neutral: low trend + low volatility
    
    regime_score = np.zeros(len(df))
    
    for i in range(len(df)):
        if i >= window:
            vol = volatility.iloc[i]
            tr = trend.iloc[i] if not pd.isna(trend.iloc[i]) else 0
            
            if tr > 0.02 and vol < 0.05:
                regime_score[i] = 0.9  # Bull
            elif tr < -0.02 and vol > 0.05:
                regime_score[i] = 0.1  # Bear
            else:
                regime_score[i] = 0.5  # Neutral
    
    return pd.Series(regime_score)


def compute_volatility_regime(volatility: pd.Series) -> pd.Series:
    """Classify volatility regime."""
    if len(volatility) == 0:
        return pd.Series([0.5] * len(volatility))
    
    mean_vol = volatility.mean(skipna=True)
    std_vol = volatility.std(skipna=True)
    
    # Classify based on last value
    last_vol = volatility.iloc[-1]
    if pd.isna(last_vol) or pd.isna(mean_vol) or pd.isna(std_vol):
        return pd.Series([0.5] * len(volatility))
    elif last_vol < mean_vol - std_vol:
        return pd.Series([0.3] * len(volatility))  # Low
    elif last_vol > mean_vol + std_vol:
        return pd.Series([0.8] * len(volatility))  # High
    else:
        return pd.Series([0.5] * len(volatility))  # Medium


def compute_trend_strength(prices: pd.Series) -> pd.Series:
    """Calculate trend strength using linear regression."""
    window = 20
    if len(prices) < window:
        return pd.Series([0.5] * len(prices))
    
    trend_strength = []
    
    for i in range(len(prices)):
        start_idx = max(0, i - window + 1)
        end_idx = i + 1
        window_prices = prices.iloc[start_idx:end_idx]
        
        if len(window_prices) < 2:
            trend_strength.append(0.5)
            continue
        
        x = np.arange(len(window_prices))
        slope, _ = np.polyfit(x, window_prices, 1)
        
        # Normalize slope to [0,1]
        strength = abs(slope) / (np.std(window_prices) + 0.001)
        strength = min(1.0, strength)
        trend_strength.append(strength)
    
    return pd.Series(trend_strength)


def compute_momentum(prices: pd.Series) -> pd.Series:
    """Calculate momentum indicator."""
    momentum_period = 10
    if len(prices) < momentum_period:
        return pd.Series([0] * len(prices))
    
    current_price = prices
    past_price = prices.shift(momentum_period)
    
    momentum = (current_price - past_price) / past_price
    return momentum


def compute_pattern_signals(df: pd.DataFrame) -> pd.Series:
    """Detect candlestick patterns."""
    if len(df) < 2:
        return pd.Series([0.5] * len(df))
    
    patterns = []
    
    for i in range(1, len(df)):
        prev = df.iloc[i-1]
        curr = df.iloc[i]
        
        # Simple pattern detection
        body_size = abs(curr['close'] - curr['open'])
        upper_shadow = curr['high'] - max(curr['open'], curr['close'])
        lower_shadow = min(curr['open'], curr['close']) - curr['low']
        
        # Doji pattern: small body
        doji = body_size / (curr['high'] - curr['low'] + 0.001) < 0.1
        
        # Hammer: long lower shadow, small body
        hammer = lower_shadow > body_size * 2 and upper_shadow < body_size and curr['low'] < curr['close']
        
        if doji:
            patterns.append(0.8)
        elif hammer:
            patterns.append(0.9)
        else:
            patterns.append(0.5)
    
    return pd.Series([0.5] + patterns)


def compute_atr(high: pd.Series, low: pd.Series, close: pd.Series, window: int) -> pd.Series:
    """Calculate Average True Range."""
    tr = pd.DataFrame()
    tr['tr1'] = high - low
    tr['tr2'] = abs(high - close.shift(1))
    tr['tr3'] = abs(low - close.shift(1))
    
    tr['true_range'] = tr[['tr1', 'tr2', 'tr3']].max(axis=1)
    atr = tr['true_range'].rolling(window).mean()
    
    return atr


# ────────────────────────────────────────────────────────────────────────────
# Cross-Validation Splits
# ────────────────────────────────────────────────────────────────────────────

def create_walk_forward_splits(
    n_samples: int, 
    n_splits: int = 5, 
    initial_train_size: int = 70, 
    test_size: int = 5, 
    step_size: int = 2
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """
    Create time-series walk-forward cross-validation splits.
    
    Args:
        n_samples: Total number of samples
        n_splits: Number of CV splits
        initial_train_size: Initial training window size
        test_size: Size of test window per split
        step_size: Step size between splits
    
    Returns:
        List of (train_indices, test_indices) tuples
    """
    splits = []
    
    # First split with initial training window
    train_start = 0
    train_end = min(initial_train_size, n_samples)
    test_start = train_end
    test_end = min(train_end + test_size, n_samples)
    
    if train_end < n_samples and test_end <= n_samples:
        splits.append((np.arange(train_start, train_end), np.arange(test_start, test_end)))
    
    # Subsequent splits
    for split in range(1, n_splits):
        train_end = test_end
        test_start = train_end
        test_end = min(test_start + test_size, n_samples)
        
        if test_start < n_samples and test_end <= n_samples:
            splits.append((np.arange(train_start, train_end), np.arange(test_start, test_end)))
    
    return splits
    
    return splits


def compute_williams_r(high: pd.Series, low: pd.Series, close: pd.Series, window: int) -> pd.Series:
    """Calculate Williams %R indicator."""
    typical_price = (high + low + close) / 3
    williams_r = -((high - typical_price).rolling(window).max() - typical_price) / \
                 ((high - typical_price).rolling(window).max() - (low - typical_price).rolling(window).min()) * 100
    return williams_r


def compute_stochastic_k(high: pd.Series, low: pd.Series, close: pd.Series, window: int) -> pd.Series:
    """Calculate Stochastic Oscillator %K."""
    lowest_low = low.rolling(window).min()
    highest_high = high.rolling(window).max()
    stochastic_k = (close - lowest_low) / (highest_high - lowest_low) * 100
    return stochastic_k


def compute_cci(high: pd.Series, low: pd.Series, close: pd.Series, window: int) -> pd.Series:
    """Calculate Commodity Channel Index."""
    typical_price = (high + low + close) / 3
    sma_tp = typical_price.rolling(window).mean()
    mad = (typical_price - sma_tp).abs().rolling(window).mean()
    cci = (typical_price - sma_tp) / (0.0015 * mad)
    return cci


def compute_adx(high: pd.Series, low: pd.Series, close: pd.Series, window: int) -> pd.Series:
    """Calculate Average Directional Index."""
    high_diff = high.diff()
    low_diff = low.diff()
    
    plus_di = 100 * (high.rolling(window).max() - close.shift(1).rolling(window).max()) / \
        high.rolling(window).max()
    tr = high - low
    atr = tr.rolling(window).mean()
    adx = (plus_di.rolling(window).mean()).abs()
    return adx


def get_cv_splits(
    n_samples: int,
    cv_method: str = "time_series",
    n_splits: int = 5,
    **kwargs
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """
    Get cross-validation splits.
    
    Args:
        n_samples: Number of samples
        cv_method: Type of CV ('time_series' or 'walk_forward')
        n_splits: Number of splits
        **kwargs: Additional parameters for walk_forward (initial_train_size, test_size, step_size)
    
    Returns:
        List of (train, test) index arrays
    """
    if cv_method == "time_series":
        # Simple time-series split with expanding window
        splits = []
        test_size = max(1, n_samples // n_splits)
        
        for i in range(n_splits):
            train_end = int((i + 1) * n_samples / (n_splits + 1))
            test_start = train_end
            test_end = min(train_end + test_size, n_samples)
            
            splits.append((np.arange(0, train_end), np.arange(test_start, test_end)))
        
        return splits
    
    elif cv_method == "walk_forward":
        # Walk-forward CV as implemented in the tests
        return create_walk_forward_splits(
            n_samples,
            n_splits=n_splits,
            initial_train_size=kwargs.get('initial_train_size', 70),
            test_size=kwargs.get('test_size', 5),
            step_size=kwargs.get('step_size', 2)
        )
    
    else:
        # Fallback to time_series for unknown methods
        return get_cv_splits(n_samples, cv_method="time_series", n_splits=n_splits)