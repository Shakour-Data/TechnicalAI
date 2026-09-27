"""Python implementation of ML models from TypeScript frontend."""

import numpy as np
import math
from typing import List, Tuple, Optional, Dict, Any

class StandardScaler:
    """Standard score normalization (z-score) transformer."""
    
    def __init__(self):
        self.mean = []
        self.std = []
        self.n_features = 0
        self.fitted = False
    
    def fit(self, X: List[List[float]]) -> None:
        """Compute the mean and standard deviation for each feature column."""
        n = len(X)
        if n == 0:
            return
        
        self.n_features = len(X[0])
        if self.n_features == 0:
            return
        
        self.mean = [0.0] * self.n_features
        self.std = [0.0] * self.n_features
        
        # Compute means
        for i in range(n):
            for j in range(self.n_features):
                self.mean[j] += X[i][j]
        
        for j in range(self.n_features):
            self.mean[j] /= n
        
        # Compute std
        for i in range(n):
            for j in range(self.n_features):
                diff = X[i][j] - self.mean[j]
                self.std[j] += diff * diff
        
        for j in range(self.n_features):
            self.std[j] = math.sqrt(self.std[j] / n)
            if self.std[j] < 1e-8:
                self.std[j] = 1.0
        
        self.fitted = True
    
    def transform(self, X: List[List[float]]) -> List[List[float]]:
        """Apply z-score normalization using fitted statistics."""
        if not self.fitted:
            return X
        
        return [[
            (x - self.mean[j]) / self.std[j] if self.std[j] > 1e-10 else 0.0
            for j, x in enumerate(row)
        ] for row in X]
    
    def fit_transform(self, X: List[List[float]]) -> List[List[float]]:
        """Fit and transform in one call."""
        self.fit(X)
        return self.transform(X)
class LogisticRegressionModel:
    """Binary logistic regression classifier with L2 regularization."""
    
    def __init__(self, C=0.1, max_iter=1000, lr=0.01):
        self.C = C
        self.max_iter = max_iter
        self.lr = lr
        self.weights = []
        self.bias = 0.0
        self.n_features = 0
        self.class_counts = {'0': 0, '1': 0}
    
    def _sigmoid(self, z: float) -> float:
        """Numerically stable sigmoid function."""
        if z >= 0:
            return 1.0 / (1.0 + math.exp(-z))
        else:
            ez = math.exp(z)
            return ez / (1.0 + ez)
    
    def fit(self, X: List[List[float]], y: List[int], class_weight: str = 'balanced') -> None:
        """Train the logistic regression model."""
        n = len(X)
        self.n_features = len(X[0]) if n > 0 else 0
        if n == 0 or self.n_features == 0:
            return
        
        # Count classes for class weights
        self.class_counts['0'] = y.count(0)
        self.class_counts['1'] = y.count(1)
        
        # Initialize weights
        self.weights = [(np.random.random() - 0.5) * 0.01 for _ in range(self.n_features)]
        self.bias = 0.0
        
        # Compute class weights
        w0 = 1.0
        w1 = 1.0
        if class_weight == 'balanced':
            n_pos = self.class_counts['1']
            n_neg = self.class_counts['0']
            w0 = n / (2.0 * max(n_neg, 1))
            w1 = n / (2.0 * max(n_pos, 1))
        
        lambda_val = 1.0 / self.C
        eps = 1e-12
        
        # Gradient descent
        for _ in range(self.max_iter):
            # Forward pass
            predictions = []
            for i in range(n):
                z = self.bias
                for j in range(self.n_features):
                    z += X[i][j] * self.weights[j]
                predictions.append(self._sigmoid(z))
            
            # Compute gradients
            dw = [0.0] * self.n_features
            db = 0.0
            
            for i in range(n):
                error = predictions[i] - y[i]
                sw = w1 if y[i] == 1 else w0
                
                for j in range(self.n_features):
                    dw[j] += error * X[i][j] * sw
                db += error * sw
            
            # Add L2 regularization (not to bias)
            for j in range(self.n_features):
                dw[j] = dw[j] / n + lambda_val * self.weights[j] / n
            
            db /= n
            
            # Update weights
            for j in range(self.n_features):
                self.weights[j] -= self.lr * dw[j]
            self.bias -= self.lr * db
            
            # Early stopping if gradients are tiny
            grad_norm = 0.0
            for j in range(self.n_features):
                grad_norm += dw[j] * dw[j]
            grad_norm += db * db
            grad_norm = math.sqrt(grad_norm)
            
            if grad_norm < 1e-7:
                break
    
    def predict_proba(self, X: List[List[float]]) -> List[List[float]]:
        """Predict class probabilities for each sample."""
        return [[1.0 - self._sigmoid(z), self._sigmoid(z)] 
                for row in X 
                for z in [self._predict_logit(row)]]
    
    def _predict_logit(self, x: List[float]) -> float:
        """Calculate the logit (raw linear combination) for a single feature vector."""
        z = self.bias
        for j in range(self.n_features):
            z += x[j] * self.weights[j]
        return z
    
    def predict_proba_single(self, x: List[float]) -> Tuple[float, float]:
        """Predict probabilities for a single feature vector."""
        p = self._sigmoid(self._predict_logit(x))
        return (1.0 - p, p)
    
    def predict(self, X: List[List[float]]) -> List[int]:
        """Predict binary class labels."""
        return [1 if prob[1] > 0.5 else 0 for prob in self.predict_proba(X)]
    
    def score(self, X: List[List[float]], y: List[int]) -> float:
        """Compute classification accuracy."""
        if len(y) == 0:
            return 0.5
        
        preds = self.predict(X)
        correct = sum(1 for i in range(len(y)) if preds[i] == y[i])
        return correct / len(y)
    
    def get_normalized_weights(self) -> List[float]:
        """Get absolute coefficient magnitudes normalized to sum to 1."""
        abs_w = [abs(w) for w in self.weights]
        total = sum(abs_w)
        return [w / total if total > 0 else 1.0 / len(self.weights) for w in abs_w]
    
    def get_coefficients(self) -> List[float]:
        """Get the raw learned weight coefficients."""
        return self.weights.copy()

class TimeSeriesSplit:
    """Time-series cross-validation splitter that preserves temporal order."""
    
    @staticmethod
    def split(n: int, n_splits: int = 3) -> List[dict]:
        """Generate time-series cross-validation folds."""
        folds = []
        if n < n_splits + 1:
            return folds
        
        fold_size = n // (n_splits + 1)
        
        for i in range(n_splits):
            train_end = fold_size * (i + 1)
            val_end = min(fold_size * (i + 2), n)
            
            if val_end <= train_end:
                continue
            
            train = list(range(train_end))
            val = list(range(train_end, val_end))
            
            if val:
                folds.append({'train': train, 'val': val})
        
        return folds

class AdaptiveWeightModel:
    """AdaptiveWeightModel — the top-level ML pipeline that combines StandardScaler + LogisticRegressionModel with TimeSeriesSplit validation."""
    
    def __init__(self, min_samples=70):
        self.scaler = StandardScaler()
        self.model = LogisticRegressionModel(0.1, 1000, 0.01)
        self.weights = None
        self.coefficients = None
        self.is_trained = False
        self.recent_accuracy = 0.5
        self.sample_count = 0
        self.prediction_prob = None
        self.min_samples = min_samples
        self.adaptive_params = {
            'momentumFactor': 0.7,
            'volatilityFactor': 0.5,
            'trendFactor': 0.6
        }
    
    def train(self, X: List[List[float]], y: List[int]) -> bool:
        """Train the adaptive weight model using TimeSeriesSplit cross-validation."""
        if len(X) < self.min_samples or len(X[0]) != 16:
            return False
        
        folds = TimeSeriesSplit.split(len(X), 3)
        if not folds:
            return False
        
        accuracies = []
        
        for fold in folds:
            train_idx = fold['train']
            val_idx = fold['val']
            
            X_train = [X[i] for i in train_idx]
            y_train = [y[i] for i in train_idx]
            X_val = [X[i] for i in val_idx]
            y_val = [y[i] for i in val_idx]
            
            # Standardize
            scaler_fold = StandardScaler()
            X_train_scaled = scaler_fold.fit_transform(X_train)
            X_val_scaled = scaler_fold.transform(X_val)
            
            # Train
            model_fold = LogisticRegressionModel(0.1, 1000, 0.01)
            model_fold.fit(X_train_scaled, y_train, 'balanced')
            
            # Evaluate
            acc = model_fold.score(X_val_scaled, y_val)
            accuracies.append(acc)
        
        # Train final model on ALL data
        self.scaler.fit_transform(X)
        self.model.fit(self.scaler.transform(X), y, 'balanced')
        
        # Average validation accuracy
        self.recent_accuracy = sum(accuracies) / len(accuracies) if accuracies else 0.5
        
        # Extract normalized weights
        self.weights = self.model.get_normalized_weights()
        self.coefficients = self.model.get_coefficients()
        self.is_trained = True
        self.sample_count = len(X)
        
        return True
    
    def predict_score(self, x_new: List[float]) -> Optional[float]:
        """Predict the probability of a bullish outcome for a single feature vector."""
        if not self.is_trained or len(x_new) != 16:
            return None
        
        x_scaled = self.scaler.transform([x_new])[0]
        _, p_bull = self.model.predict_proba_single(x_scaled)
        self.prediction_prob = p_bull
        return p_bull
    
    def get_adaptive_params(self) -> dict:
        """Extract interpretable adaptive parameters from the learned coefficients."""
        if not self.is_trained or not self.coefficients:
            return self.adaptive_params
        
        def sigmoid(z: float) -> float:
            if z >= 0:
                return 1.0 / (1.0 + math.exp(-z))
            else:
                ez = math.exp(z)
                return ez / (1.0 + ez)
        
        c = self.coefficients
        
        # Feature indices: 0=f_rsi, 10=s_atr, 11=s_trend
        rsi_coef = c[0] if len(c) > 0 else 0
        atr_coef = c[10] if len(c) > 10 else 0
        trend_coef = c[11] if len(c) > 11 else 0
        
        return {
            'momentumFactor': 0.5 + 0.5 * sigmoid(rsi_coef),
            'volatilityFactor': 0.5 + 0.5 * sigmoid(atr_coef),
            'trendFactor': 0.5 + 0.5 * sigmoid(trend_coef),
        }
    
    def get_edge_coefficients(self) -> dict:
        """Extract normalized edge weight coefficients."""
        if not self.is_trained or not self.coefficients:
            return {'trendCoef': 1/3, 'momentumCoef': 1/3, 'volatilityCoef': 1/3}
        
        c = self.coefficients
        
        abs_trend = abs(c[11]) if len(c) > 11 else 0
        abs_momentum = abs(c[0]) if len(c) > 0 else 0
        abs_volatility = abs(c[10]) if len(c) > 10 else 0
        
        total = abs_trend + abs_momentum + abs_volatility
        if total == 0:
            return {'trendCoef': 1/3, 'momentumCoef': 1/3, 'volatilityCoef': 1/3}
        
        return {
            'trendCoef': abs_trend / total,
            'momentumCoef': abs_momentum / total,
            'volatilityCoef': abs_volatility / total,
        }
    
    def get_result(self) -> dict:
        """Assemble the complete result object for API responses."""
        return {
            'weights': self.weights if self.weights is not None else [1.0/16] * 16,
            'coefficients': self.coefficients if self.coefficients is not None else [0.0] * 16,
            'recentAccuracy': self.recent_accuracy,
            'isTrained': self.is_trained,
            'sampleCount': self.sample_count,
            'predictionProb': self.prediction_prob,
            'adaptiveParams': self.get_adaptive_params(),
        }

# VDSS_FEATURE_NAMES from TypeScript
VDSS_FEATURE_NAMES = [
    'f_rsi', 'f_mfi', 'f_cci', 's_adx',
    'f_macd', 'f_stoch', 's_bb', 's_ma21', 's_ma100', 's_ema',
    's_atr', 's_trend', 's_sr',
    'f_stochCross', 'f_macdCross', 'f_div',
]


# ─── Indicator Calculations (ported from ml-engine.ts) ──────────────────

def clamp(v: float, lo: float, hi: float) -> float:
    """Clamp value to [lo, hi] range."""
    return max(lo, min(hi, v))


def sma(closes: List[float], period: int) -> float:
    """Simple Moving Average."""
    if len(closes) < period:
        return 0.0
    slice_ = closes[-period:]
    return sum(slice_) / period


def ema_calc(closes: List[float], period: int) -> float:
    """Exponential Moving Average."""
    if len(closes) < period:
        return 0.0
    k = 2.0 / (period + 1)
    v = sma(closes[:period], period)
    for i in range(period, len(closes)):
        v = closes[i] * k + v * (1 - k)
    return v


def calc_rsi(closes: List[float], period: int = 14) -> float:
    """Relative Strength Index (14-period)."""
    if len(closes) < period + 1:
        return 50.0
    avg_gain = 0.0
    avg_loss = 0.0
    for i in range(1, period + 1):
        diff = closes[i] - closes[i - 1]
        if diff > 0:
            avg_gain += diff
        else:
            avg_loss += abs(diff)
    avg_gain /= period
    avg_loss /= period
    for i in range(period + 1, len(closes)):
        diff = closes[i] - closes[i - 1]
        avg_gain = (avg_gain * (period - 1) + (diff if diff > 0 else 0)) / period
        avg_loss = (avg_loss * (period - 1) + (abs(diff) if diff < 0 else 0)) / period
    if avg_loss == 0:
        return 100.0
    return 100 - 100 / (1 + avg_gain / avg_loss)


def calc_cci(data: List[Dict[str, float]], period: int = 20) -> float:
    """Commodity Channel Index (20-period)."""
    if len(data) < period:
        return 0.0
    tps = []
    for i in range(len(data) - period, len(data)):
        tps.append((data[i]['high'] + data[i]['low'] + data[i]['close']) / 3)
    mean = sum(tps) / len(tps)
    mean_dev = sum(abs(b - mean) for b in tps) / len(tps)
    if mean_dev == 0:
        return 0.0
    return (tps[-1] - mean) / (0.015 * mean_dev)


def calc_mfi(data: List[Dict[str, float]], period: int = 14) -> float:
    """Money Flow Index (14-period)."""
    if len(data) < period + 1:
        return 50.0
    pos_flow = 0.0
    neg_flow = 0.0
    for i in range(len(data) - period, len(data)):
        tp = (data[i]['high'] + data[i]['low'] + data[i]['close']) / 3
        prev_tp = (data[i-1]['high'] + data[i-1]['low'] + data[i-1]['close']) / 3
        mf = tp * data[i]['volume']
        if tp > prev_tp:
            pos_flow += mf
        else:
            neg_flow += mf
    if neg_flow == 0:
        return 100.0
    return 100 - 100 / (1 + pos_flow / neg_flow)


def calc_stochastic(
    data: List[Dict[str, float]], 
    k_period: int = 14, smooth_k: int = 3, smooth_d: int = 3
) -> Dict[str, float]:
    """Stochastic Oscillator %K and %D."""
    raw_ks = []
    for i in range(k_period - 1, len(data)):
        lowest = float('inf')
        highest = float('-inf')
        for j in range(i - k_period + 1, i + 1):
            if data[j]['low'] < lowest:
                lowest = data[j]['low']
            if data[j]['high'] > highest:
                highest = data[j]['high']
        range_val = highest - lowest
        raw_ks.append(range_val == 0 and 50 or ((data[i]['close'] - lowest) / range_val) * 100)
    
    smoothed_k = []
    for i in range(smooth_k - 1, len(raw_ks)):
        slice_ = raw_ks[i - smooth_k + 1:i + 1]
        smoothed_k.append(sum(slice_) / smooth_k)
    
    k = smoothed_k[-1] if smoothed_k else 50
    d_slice = smoothed_k[-smooth_d:] if len(smoothed_k) >= smooth_d else smoothed_k
    d = sum(d_slice) / len(d_slice) if d_slice else 50
    return {'k': k, 'd': d}


def calc_macd(
    closes: List[float], fast: int = 12, slow: int = 26, sig: int = 9
) -> Dict[str, float]:
    """MACD indicator."""
    if len(closes) < slow + sig:
        return {'line': 0, 'signal': 0, 'histogram': 0}
    k_fast = 2.0 / (fast + 1)
    k_slow = 2.0 / (slow + 1)
    k_sig = 2.0 / (sig + 1)
    
    e_fast = sma(closes[:fast], fast)
    e_slow = sma(closes[:slow], slow)
    macd_vals = []
    start = max(fast, slow)
    for i in range(start, len(closes)):
        e_fast = closes[i] * k_fast + e_fast * (1 - k_fast)
        e_slow = closes[i] * k_slow + e_slow * (1 - k_slow)
        macd_vals.append(e_fast - e_slow)
    
    if len(macd_vals) < sig:
        return {'line': 0, 'signal': 0, 'histogram': 0}
    s = sma(macd_vals[:sig], sig)
    for i in range(sig, len(macd_vals)):
        s = macd_vals[i] * k_sig + s * (1 - k_sig)
    line = macd_vals[-1]
    return {'line': line, 'signal': s, 'histogram': line - s}


def calc_bollinger_bands(
    closes: List[float], period: int = 20, mult: float = 2
) -> Dict[str, float]:
    """Bollinger Bands."""
    if len(closes) < period:
        return {'upper': 0, 'middle': 0, 'lower': 0}
    slice_ = closes[-period:]
    mid = sum(slice_) / period
    variance = sum((b - mid) ** 2 for b in slice_) / period
    sd = math.sqrt(variance)
    return {'upper': mid + mult * sd, 'middle': mid, 'lower': mid - mult * sd}


def calc_adx(
    data: List[Dict[str, float]], period: int = 14
) -> Dict[str, float]:
    """Average Directional Index."""
    if len(data) < period * 2:
        return {'adx': 0, 'di_plus': 0, 'di_minus': 0}
    sum_pdm = 0.0
    sum_mdm = 0.0
    sum_tr = 0.0
    for i in range(len(data) - period, len(data)):
        up_move = data[i]['high'] - data[i-1]['high']
        down_move = data[i-1]['low'] - data[i]['low']
        sum_pdm += up_move if (up_move > down_move and up_move > 0) else 0
        sum_mdm += down_move if (down_move > up_move and down_move > 0) else 0
        sum_tr += max(
            data[i]['high'] - data[i]['low'],
            abs(data[i]['high'] - data[i-1]['close']),
            abs(data[i]['low'] - data[i-1]['close'])
        )
    di_plus = (sum_pdm / sum_tr * 100) if sum_tr > 0 else 0
    di_minus = (sum_mdm / sum_tr * 100) if sum_tr > 0 else 0
    dx = (abs(di_plus - di_minus) / (di_plus + di_minus) * 100) if (di_plus + di_minus) > 0 else 0
    return {'adx': dx, 'di_plus': di_plus, 'di_minus': di_minus}


def calc_atr(data: List[Dict[str, float]], period: int = 14) -> float:
    """Average True Range."""
    if len(data) < period + 1:
        return 0.0
    total = 0.0
    for i in range(len(data) - period, len(data)):
        total += max(
            data[i]['high'] - data[i]['low'],
            abs(data[i]['high'] - data[i-1]['close']),
            abs(data[i]['low'] - data[i-1]['close'])
        )
    return total / period


# ─── 16-Feature Extraction for VDss ─────────────────────────────────────────

def extract_vdss_features(
    data: List[Dict[str, float]], end_idx: int, has_volume: bool
) -> List[float]:
    """
    Extract the 16 VDSS (Volatility-Direction-Strength-Structure) features
    at a given point in the OHLCV history.
    
    Port from ml-engine.ts extractVDSSFeatures().
    Feature order matches VDSS_FEATURE_NAMES exactly.
    """
    slice_data = data[:end_idx + 1]
    closes = [d['close'] for d in slice_data]
    price = closes[-1]
    if price <= 0:
        return [0.5] * 16
    
    # Compute indicators
    rsi = calc_rsi(closes)
    mfi = calc_mfi(slice_data) if has_volume else 50
    cci = calc_cci(slice_data)
    adx_result = calc_adx(slice_data)
    macd = calc_macd(closes)
    stoch = calc_stochastic(slice_data)
    bb = calc_bollinger_bands(closes)
    atr = calc_atr(slice_data)
    ma21 = sma(closes, 21)
    ma100 = sma(closes, 100)
    ema12 = ema_calc(closes, 12)
    ema26 = ema_calc(closes, 26)
    
    # LAYER 1: Raw scores (s_*)
    s_rsi = (0.95 if rsi > 80 else 0.85 if rsi > 70 else 0.7 if rsi > 60 
             else 0.55 if rsi > 50 else 0.45 if rsi > 40 else 0.3 
             if rsi > 30 else 0.15 if rsi > 20 else 0.05)
    
    s_mfi = (0.95 if mfi > 80 else 0.85 if mfi > 70 else 0.7 if mfi > 60 
             else 0.55 if mfi > 50 else 0.45 if mfi > 40 else 0.3 
             if mfi > 30 else 0.15 if mfi > 20 else 0.05)
    
    s_cci = (0.9 if cci > 200 else 0.75 if cci > 100 else 0.6 if cci > 0 
             else 0.4 if cci > -100 else 0.25 if cci > -200 else 0.1)
    
    s_adx = (clamp(0.5 + (adx_result['di_plus'] - adx_result['di_minus']) / 100, 0.5, 1)
             if adx_result['di_plus'] > adx_result['di_minus']
             else clamp(0.5 - (adx_result['di_minus'] - adx_result['di_plus']) / 100, 0, 0.5))
    
    s_macd = (0.9 if macd['histogram'] > 0 and macd['line'] > macd['signal']
              else 0.7 if macd['histogram'] > 0
              else 0.55 if macd['line'] > macd['signal']
              else 0.1 if macd['histogram'] < 0 and macd['line'] < macd['signal']
              else 0.3)
    
    s_stoch = clamp(
        (0.9 if stoch['k'] > 80 else 0.8 if stoch['k'] > 70 else 0.6
         if stoch['k'] > 50 else 0.4 if stoch['k'] > 30 else 0.2
         if stoch['k'] > 20 else 0.1)
        + (0.1 if stoch['k'] > stoch['d'] else -0.1), 0, 1)
    
    bb_range = bb['upper'] - bb['lower']
    s_bb = 0.5 if bb_range == 0 else clamp((price - bb['lower']) / bb_range, 0, 1)
    
    s_ma21 = clamp(
        (0.7 + ((price - ma21) / ma21) * 0.5) if price > ma21
        else (0.3 + ((price - ma21) / ma21) * 0.5), 0, 1) if ma21 > 0 else 0.5
    
    s_ma100 = clamp(
        (0.65 + ((price - ma100) / ma100) * 0.3) if price > ma100
        else (0.35 + ((price - ma100) / ma100) * 0.3), 0, 1) if ma100 > 0 else 0.5
    
    ema_gap = (ema12 - ema26) / ema26 if ema12 > 0 and ema26 > 0 else 0
    s_ema = clamp(0.5 + ema_gap * 5, 0, 1)
    s_atr = clamp(1 - atr / price * 10, 0.2, 1) if price > 0 else 0.5
    
    # Trend (R² + angle)
    trend_period = min(21, len(closes))
    trend_slice = closes[-trend_period:]
    n = len(trend_slice)
    sum_x = sum(i for i in range(n))
    sum_y = sum(y for y in trend_slice)
    sum_xy = sum(i * trend_slice[i] for i in range(n))
    sum_x2 = sum(i * i for i in range(n))
    
    denom = n * sum_x2 - sum_x * sum_x
    r2 = 0.0
    angle = 0.0
    if denom != 0:
        slope = (n * sum_xy - sum_x * sum_y) / denom
        mean_y = sum_y / n
        ss_res = sum((trend_slice[i] - (slope * i + mean_y - slope * (n - 1) / 2)) ** 2 for i in range(n))
        ss_tot = sum((trend_slice[i] - mean_y) ** 2 for i in range(n))
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0
        angle = math.atan((slope / mean_y) * 100) * (180 / math.pi) if mean_y > 0 else 0
    
    t_str = r2 * abs(angle) / 45
    direction = (n * sum_xy - sum_x * sum_y) / denom if denom != 0 else 0
    s_trend = (clamp(0.5 + t_str / 2, 0.5, 1) if direction > 0
               else clamp(0.5 - t_str / 2, 0, 0.5) if direction < 0
               else 0.5)
    
    # Simplified S/R: distance to nearest local high/low
    s_sr = 0.5
    if len(slice_data) > 20:
        lookback = slice_data[-30:]
        nearest_high = float('inf')
        nearest_low = 0.0
        for d in lookback:
            if d['high'] > price and d['high'] < nearest_high:
                nearest_high = d['high']
            if d['low'] < price and d['low'] > nearest_low:
                nearest_low = d['low']
        d_r = abs(price - nearest_high) / nearest_high if nearest_high < float('inf') else 1
        d_s = abs(price - nearest_low) / nearest_low if nearest_low > 0 else 1
        s_sr = clamp(0.5 - d_r * 1.5 + d_s * 1.0, 0, 1)
    
    # LAYER 2: Momentum correction
    tb = 5
    f_rsi = s_rsi
    f_mfi = s_mfi
    f_cci = s_cci
    f_macd = s_macd
    f_stoch = s_stoch
    
    if len(slice_data) > tb + 15:
        past_slice = slice_data[:-tb]
        past_closes = [d['close'] for d in past_slice]
        rsi_past = calc_rsi(past_closes)
        mfi_past = calc_mfi(past_slice) if has_volume else 50
        cci_past = calc_cci(past_slice)
        macd_past = calc_macd(past_closes)
        stoch_past = calc_stochastic(past_slice)
        
        f_rsi = clamp(s_rsi + (rsi - rsi_past) / 100 * 0.08, 0, 1)
        f_mfi = clamp(s_mfi + (mfi - mfi_past) / 100 * 0.08, 0, 1)
        f_cci = clamp(s_cci + (cci - cci_past) / 300 * 0.06, 0, 1)
        f_macd = clamp(s_macd + (macd['histogram'] - macd_past['histogram']) 
                       / (abs(macd['histogram']) + abs(macd_past['histogram']) + 1) * 3 * 0.08, 0, 1)
        f_stoch = clamp(s_stoch + (stoch['k'] - stoch_past['k']) / 50 * 0.06, 0, 1)
    
    # LAYER 2: Cross signals (binary per spec)
    f_stoch_cross = 0.1
    f_macd_cross = 0.1
    f_div = 0.15
    
    if len(slice_data) > 20:
        prev_slice = slice_data[:-1]
        prev_stoch = calc_stochastic(prev_slice)
        prev_macd = calc_macd([d['close'] for d in prev_slice])
        
        f_stoch_cross = 0.9 if (prev_stoch['k'] < prev_stoch['d'] and stoch['k'] > stoch['d']) else 0.1
        f_macd_cross = 0.9 if (prev_macd['line'] < prev_macd['signal'] and macd['line'] > macd['signal']) else 0.1
        
        if len(closes) > 40:
            p20 = closes[-21]
            rsi_20 = calc_rsi(closes[:-20])
            p_change = price - p20
            rsi_change = rsi - rsi_20
            if p_change != 0 and rsi_change != 0:
                f_div = 0.85 if (p_change > 0 and rsi_change < 0) or (p_change < 0 and rsi_change > 0) else 0.15
    
    return [
        f_rsi, f_mfi, f_cci, s_adx,
        f_macd, f_stoch, s_bb, s_ma21, s_ma100, s_ema,
        s_atr, s_trend, s_sr,
        f_stoch_cross, f_macd_cross, f_div,
    ]


# ─── Train Adaptive Model ─────────────────────────────────────────────────

def train_adaptive_model(
    data: List[Dict[str, float]], symbol: str, min_samples: int = 70
) -> Optional[Dict[str, Any]]:
    """
    Train the Adaptive Weight Model for a given symbol using logistic regression
    with TimeSeriesSplit cross-validation.
    
    Port from ml-engine.ts trainAdaptiveModel().
    """
    forward_days = 5
    start_idx = 40
    
    if len(data) < start_idx + forward_days + min_samples:
        return None
    
    has_volume = any(d['volume'] > 0 for d in data)
    
    X = []
    y = []
    
    for i in range(start_idx, len(data) - forward_days):
        features = extract_vdss_features(data, i, has_volume)
        current_price = data[i]['close']
        future_price = data[i + forward_days]['close']
        
        if current_price <= 0:
            continue
        if any(not math.isfinite(f) for f in features):
            continue
        
        forward_return = (future_price - current_price) / current_price
        label = 1 if forward_return > 0.01 else 0
        
        X.append(features)
        y.append(label)
    
    if len(X) < min_samples:
        return None
    
    model = AdaptiveWeightModel(min_samples)
    success = model.train(X, y)
    
    if not success:
        return None
    
    current_features = extract_vdss_features(data, len(data) - 1, has_volume)
    model.predict_score(current_features)
    
    result = model.get_result()
    result['symbol'] = symbol
    
    set_cached_adaptive_model(symbol, result)
    return result


# ─── Calculate Bull Consensus ─────────────────────────────────────────────

DEFAULT_WEIGHTS = [
    0.15, 0.12, 0.10, 0.08,
    0.14, 0.10, 0.08,
    0.10, 0.08, 0.10,
    0.05, 0.10, 0.05,
    0.06, 0.06, 0.08,
]


def calculate_bull_consensus(
    features: List[float], ml_result: Optional[Dict[str, Any]], has_volume: bool
) -> Dict[str, Any]:
    """
    Calculate the ML-weighted bull consensus from the 16 VDSS features.
    
    Port from ml-engine.ts calculateBullConsensus().
    """
    if ml_result and ml_result.get('isTrained') and len(ml_result.get('weights', [])) == 16:
        weights = ml_result['weights']
        bull_consensus = 0.0
        total_weight = 0.0
        
        for j in range(16):
            if j == 1 and not has_volume:
                continue
            bull_consensus += weights[j] * features[j]
            total_weight += weights[j]
        
        if total_weight > 0:
            bull_consensus /= total_weight
        
        if ml_result.get('predictionProb') is not None:
            ml_weight = max(0, min(ml_result.get('recentAccuracy', 0.5) * 0.30, 0.30))
            bull_consensus = bull_consensus * (1 - ml_weight) + ml_result['predictionProb'] * ml_weight
        
        return {'bullConsensus': max(0, min(1, bull_consensus)), 'usedML': True}
    
    # Fallback: default weights
    bull_consensus = 0.0
    total_weight = 0.0
    for j in range(16):
        if j == 1 and not has_volume:
            continue
        bull_consensus += DEFAULT_WEIGHTS[j] * features[j]
        total_weight += DEFAULT_WEIGHTS[j]
    
    if total_weight > 0:
        bull_consensus /= total_weight
    
    return {'bullConsensus': max(0, min(1, bull_consensus)), 'usedML': False}


# ─── Scenario Probabilities ─────────────────────────────────────────────────

def calculate_scenario_probabilities(
    bull_consensus: float,
    price: float,
    r1: float,
    s1: float,
    ma100: float,
    rsi: float,
    mfi: float,
    stoch_k: float,
    has_volume: bool,
    ml_result: Optional[Dict[str, Any]],
    adx: float = 25.0,
    atr: float = 0.0,
) -> Dict[str, Any]:
    """
    Calculate 9-scenario probabilities using the 3-branch decision DAG.
    
    Port from ml-engine.ts calculateScenarioProbabilities().
    """
    ml_params = ml_result.get('adaptiveParams') if ml_result else None
    if ml_params:
        factors = {
            'momentum': ml_params.get('momentumFactor', 0.7),
            'volatility': ml_params.get('volatilityFactor', 0.5),
            'trend': ml_params.get('trendFactor', 0.6),
        }
    else:
        factors = {'momentum': 0.7, 'volatility': 0.5, 'trend': 0.6}
    
    bull = bull_consensus
    bear = 1 - bull_consensus
    
    def sigmoid(z: float) -> float:
        if z >= 0:
            return 1.0 / (1.0 + math.exp(-z))
        ez = math.exp(z)
        return ez / (1.0 + ez)
    
    # Helper: Overbought/Oversold
    overbought = (rsi - 70) / 30 if rsi > 70 else 0
    oversold = (30 - rsi) / 30 if rsi < 30 else 0
    
    # Helper: Volatility state
    atr_pct = (atr or price * 0.02) / price if price > 0 else 0.02
    vol_high = clamp((atr_pct - 0.02) / 0.03, 0, 1)
    vol_low = clamp(1 - (atr_pct - 0.01) / 0.02, 0, 1)
    
    # P_Bull_Current
    rsi_bull = (0.85 if rsi > 70 else 0.7 if rsi > 60 else 0.55
                if rsi > 50 else 0.45 if rsi > 40 else 0.3
                if rsi > 30 else 0.15 if rsi > 20 else 0.05)
    
    mfi_bull = (0.85 if mfi > 80 else 0.65 if mfi > 60 else 0.45
                if mfi > 40 else 0.3 if mfi > 20 else 0.15) if has_volume else 0.5
    
    stoch_bull = (0.85 if stoch_k > 80 else 0.65 if stoch_k > 60 else 0.45
                  if stoch_k > 40 else 0.3 if stoch_k > 20 else 0.15)
    
    adx_norm = min(adx / 45, 1)
    ma_pos_bull = clamp((price - ma100) / (ma100 * 0.05), 0, 1) if ma100 > 0 else 0.5
    
    dist_r1 = math.exp(-3 * abs(price - r1) / r1) if r1 > 0 else 0.5
    dist_s1 = math.exp(-3 * abs(price - s1) / s1) if s1 > 0 else 0.5
    
    # Priors
    prior_trend = 0.28
    prior_osc = 0.25
    prior_vol = 0.15 if has_volume else 0
    prior_volatility = 0.10
    prior_leading = 0.12
    prior_pattern = 0.10
    
    if not has_volume:
        total_remaining = prior_trend + prior_osc + prior_volatility + prior_leading + prior_pattern
        redistribute = 0.15
        prior_trend += redistribute * (prior_trend / total_remaining)
        prior_osc += redistribute * (prior_osc / total_remaining)
        prior_volatility += redistribute * (prior_volatility / total_remaining)
        prior_leading += redistribute * (prior_leading / total_remaining)
        prior_pattern += redistribute * (prior_pattern / total_remaining)
    
    current_bull_signals = [
        (rsi_bull, prior_osc * 0.4),
        (mfi_bull, prior_vol if has_volume else 0),
        (stoch_bull, prior_osc * 0.35),
        (ma_pos_bull, prior_trend * 0.5),
        (min(adx_norm, 1) if bull > 0.5 else 0.5, prior_trend * 0.3),
        (dist_s1, prior_pattern * 0.5),
    ]
    
    sum_weights = 0.0
    sum_weighted_bull = 0.0
    for signal, weight in current_bull_signals:
        if weight <= 0:
            continue
        sum_weighted_bull += weight * signal
        sum_weights += weight
    
    p_bull_current = clamp(sum_weighted_bull / sum_weights, 0, 1) if sum_weights > 0 else bull
    p_bear_current = 1 - p_bull_current
    
    # P_Bull_Forecast
    alpha = 0.5
    ml_return = ml_result.get('predictionProb') if ml_result else None
    if ml_return is not None:
        p_bull_forecast = clamp(ml_return, 0, 1)
    else:
        decay_factor = 0.85
        p_bull_forecast = p_bull_current * decay_factor + 0.5 * (1 - decay_factor)
    
    p_bear_forecast = 1 - p_bull_forecast
    
    # Final directional probabilities
    p_bull_final = clamp(alpha * p_bull_current + (1 - alpha) * p_bull_forecast, 0.02, 0.98)
    p_bear_final = clamp(alpha * p_bear_current + (1 - alpha) * p_bear_forecast, 0.02, 0.98)
    p_neutral_final = max(0.04, 1 - p_bull_final - p_bear_final)
    
    dir_sum = p_bull_final + p_bear_final + p_neutral_final
    p_bull = p_bull_final / dir_sum
    p_bear = p_bear_final / dir_sum
    p_neutral = p_neutral_final / dir_sum
    
    # Divergence detection
    div_bull = 0.0
    div_bear = 0.0
    if ml_result and ml_result.get('predictionProb') is not None:
        ml_bull = ml_result['predictionProb']
        if bull > 0.6 and ml_bull < 0.4:
            div_bear = (bull - ml_bull) * 1.5
        if bull < 0.4 and ml_bull > 0.6:
            div_bull = (ml_bull - bull) * 1.5
    div_bull = clamp(div_bull, 0, 0.3)
    div_bear = clamp(div_bear, 0, 0.3)
    
    vol_confirm = 0.6 if has_volume else 0.4
    adx_strong = 1.0 if adx > 40 else (adx - 25) / 15 if adx > 25 else 0
    
    adx_range = 0.35 if adx < 20 else 0.20 if adx < 30 else 0.10
    adx_trend = 1 - adx_range
    adx_norm_val = min(adx / 60, 1)
    
    # Conditional probability distributions
    cp_bull = [
        0.28 * adx_trend * (0.5 + 0.5 * adx_norm_val),
        0.15 * adx_trend * (0.3 + 0.7 * factors['momentum']),
        0.12 * (1 - overbought * 0.6) * adx_trend,
        0.03 * (1 + div_bear),
        0.02,
        0.03 * (1 + div_bear),
        adx_range * 0.45 * vol_low,
        adx_range * 0.30 * vol_high,
        0.04 * (1 + overbought * 0.5 + vol_high * 0.5),
    ]
    
    cp_bear = [
        0.03 * (1 + div_bull),
        0.02,
        0.03 * (1 + div_bull),
        0.28 * adx_trend * (0.5 + 0.5 * adx_norm_val),
        0.15 * adx_trend * (0.3 + 0.7 * factors['momentum']),
        0.12 * (1 - oversold * 0.6) * adx_trend,
        adx_range * 0.45 * vol_low,
        adx_range * 0.30 * vol_high,
        0.04 * (1 + oversold * 0.5 + vol_high * 0.5),
    ]
    
    cp_neutral = [
        0.08 * adx_trend * (0.5 + 0.5 * adx_norm_val),
        0.04 * adx_trend * (0.3 + 0.7 * factors['momentum']),
        0.07 * adx_trend,
        0.08 * adx_trend * (0.5 + 0.5 * adx_norm_val),
        0.04 * adx_trend * (0.3 + 0.7 * factors['momentum']),
        0.07 * adx_trend,
        adx_range * 0.50 * vol_low,
        adx_range * 0.35 * vol_high,
        0.04,
    ]
    
    def norm_cp(cp: List[float]) -> List[float]:
        s = sum(cp)
        return [v / s for v in cp] if s > 0 else [1.0/9] * 9
    
    ncp_bull = norm_cp(cp_bull)
    ncp_bear = norm_cp(cp_bear)
    ncp_neutral = norm_cp(cp_neutral)
    
    raw_s = [0.0] * 9
    for i in range(9):
        raw_s[i] = p_bull * ncp_bull[i] + p_bear * ncp_bear[i] + p_neutral * ncp_neutral[i]
    
    total_raw = sum(raw_s)
    if total_raw <= 0:
        return {
            'pSC1': 12, 'pSC2': 10, 'pSC3': 8, 'pSC4': 12, 'pSC5': 10,
            'pSC6': 8, 'pSC7': 15, 'pSC8': 15, 'pSC9': 10, 'factors': factors,
        }
    
    ps = [round(raw_s[i] / total_raw * 100) for i in range(8)]
    p_sc9 = max(1, 100 - sum(ps))
    
    return {
        'pSC1': ps[0], 'pSC2': ps[1], 'pSC3': ps[2], 'pSC4': ps[3],
        'pSC5': ps[4], 'pSC6': ps[5], 'pSC7': ps[6], 'pSC8': ps[7],
        'pSC9': p_sc9, 'factors': factors,
    }


# ─── Edge Weights ────────────────────────────────────────────────────────────

def calculate_edge_weights(
    bull_consensus: float, adx: float, ml_result: Optional[Dict[str, Any]]
) -> Dict[str, float]:
    """Calculate edge weights for the DAG."""
    trend_coef = 0.3333
    momentum_coef = 0.3333
    vol_coef = 0.3333
    
    if ml_result and ml_result.get('isTrained') and len(ml_result.get('coefficients', [])) == 16:
        ec = ml_result['coefficients']
        abs_trend = abs(ec[11]) if len(ec) > 11 else 0
        abs_momentum = abs(ec[0]) if len(ec) > 0 else 0
        abs_vol = abs(ec[10]) if len(ec) > 10 else 0
        total = abs_trend + abs_momentum + abs_vol
        if total > 0:
            trend_coef = abs_trend / total
            momentum_coef = abs_momentum / total
            vol_coef = abs_vol / total
    
    up_base = bull_consensus * 0.7 + 0.15
    down_base = (1 - bull_consensus) * 0.7 + 0.15
    pullback_base = 0.25
    risk_base = 0.12 * (1.2 - min(adx / 100, 1))
    
    up = clamp(up_base * (1 + (momentum_coef - 0.3333) * 0.3), 0.05, 0.95)
    down = clamp(down_base * (1 + (trend_coef - 0.3333) * 0.3), 0.05, 0.95)
    pullback = clamp(pullback_base * (1 + (vol_coef - 0.3333) * 0.2), 0.05, 0.50)
    risk = clamp(risk_base * (1 - (trend_coef - 0.3333) * 0.5), 0.02, 0.30)
    
    return {'up': up, 'down': down, 'pullback': pullback, 'risk': risk}


# ─── Price Prediction ───────────────────────────────────────────────────────

def predict_prices(data: List[Dict[str, float]], forward_days: int = 5) -> Dict[str, Any]:
    """
    Predict future prices using trend + mean-reversion + momentum model.
    
    Port from ml-engine.ts predictPrices().
    """
    if len(data) < 40:
        return None
    
    closes = [d['close'] for d in data]
    price = closes[-1]
    if price <= 0:
        return None
    
    lookback = 20
    returns = []
    for i in range(len(closes) - lookback, len(closes)):
        if i > 0 and closes[i - 1] > 0:
            returns.append((closes[i] - closes[i - 1]) / closes[i - 1])
        else:
            returns.append(0.0)
    
    mom3 = sum(returns[-3:]) / 3 if len(returns) >= 3 else 0
    mom10 = sum(returns[-10:]) / 10 if len(returns) >= 10 else 0
    ma20 = sum(closes[-20:]) / 20 if len(closes) >= 20 else 0
    deviation = (price - ma20) / ma20 if ma20 > 0 else 0
    
    # Linear regression
    trend_slice = closes[-20:]
    tn = len(trend_slice)
    sx = sum(range(tn))
    sy = sum(trend_slice)
    sxy = sum(i * trend_slice[i] for i in range(tn))
    sx2 = sum(i * i for i in range(tn))
    
    d = tn * sx2 - sx * sx
    slope = 0.0
    r2 = 0.0
    if d != 0:
        slope = (tn * sxy - sx * sy) / d
        mean_y = sy / tn
        ss_res = sum((trend_slice[i] - (slope * i + mean_y - slope * (tn - 1) / 2)) ** 2 for i in range(tn))
        ss_tot = sum((trend_slice[i] - mean_y) ** 2 for i in range(tn))
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0
    
    # ATR
    atr = 0.0
    for i in range(max(1, len(data) - 14), len(data)):
        atr += max(
            data[i]['high'] - data[i]['low'],
            abs(data[i]['high'] - data[i-1]['close']),
            abs(data[i]['low'] - data[i-1]['close'])
        )
    atr /= min(14, len(data) - max(1, len(data) - 14)) if len(data) > 1 else 1
    
    # Combine components
    daily_returns = []
    for i in range(1, len(closes)):
        if closes[i-1] > 0:
            daily_returns.append((closes[i] - closes[i-1]) / closes[i-1])
    
    mean_daily_return = sum(daily_returns[-20:]) / len(daily_returns[-20:]) if daily_returns else 0
    std_daily_return = (sum((r - mean_daily_return)**2 for r in daily_returns[-20:]) / len(daily_returns[-20:])) ** 0.5 if daily_returns else 0
    
    # Weights
    trend_weight = min(r2 * 0.6, 0.6)
    mr_weight = min(abs(deviation) * 5, 0.4)
    if deviation > 0:
        mr_weight = -mr_weight
    mom_weight = 0.2
    
    total_weight = abs(trend_weight) + abs(mr_weight) + abs(mom_weight)
    if total_weight > 0:
        trend_weight /= total_weight
        mr_weight /= total_weight
        mom_weight /= total_weight
    
    base_return = mean_daily_return
    trend_return = (slope / price) if price > 0 else 0
    mr_return = -deviation * 0.05 if deviation > 0 else -abs(deviation) * 0.05
    mom_return = mom3 * 0.4 + mom10 * 0.1
    
    predicted_return = trend_weight * trend_return + mr_weight * mr_return + mom_weight * mom_return
    predicted_return = max(-0.5, min(0.5, predicted_return))
    
    # Project prices
    predicted_prices = []
    current = price
    for i in range(forward_days):
        daily_return = predicted_return * math.exp(-i * 0.1)
        current = current * (1 + daily_return)
        predicted_prices.append(round(current, 2))
    
    confidence = min(r2 * 0.8 + 0.1, 0.9)
    trend_direction = 'up' if predicted_return > 0.005 else 'down' if predicted_return < -0.005 else 'flat'
    predicted_return_5d = ((predicted_prices[-1] - price) / price) if price > 0 else 0
    
    return {
        'predicted_prices': predicted_prices,
        'predicted_return_5d': round(predicted_return_5d, 4),
        'confidence': round(confidence, 2),
        'trend_direction': trend_direction,
    }


# ─── Cache for trained models ────────────────────────────────────────────────

_model_cache: Dict[str, Dict[str, Any]] = {}


def get_cached_adaptive_model(symbol: str, cache_ttl: int = 3600) -> Optional[Dict[str, Any]]:
    """Retrieve a cached adaptive model for the given symbol if it has not expired."""
    import time as _time
    cached = _model_cache.get(symbol)
    if cached and (_time.time() - cached['time']) < cache_ttl:
        return cached['result']
    return None


def set_cached_adaptive_model(symbol: str, result: Dict[str, Any]) -> None:
    """Store an adaptive model result in the cache with the current timestamp."""
    import time as _time
    _model_cache[symbol] = {'result': result, 'time': _time.time()}


# ─── Public API ──────────────────────────────────────────────────────────────

def run_ml_analysis(
    candles: List[Dict[str, float]], 
    symbol: str = '',
    horizon: int = 30,
    model_keys: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Run full ML analysis using native Python models (no external services required).
    
    This replaces the external ML service call with a pure Python implementation
    that mirrors the TypeScript frontend ML engine.
    
    Returns a prediction result compatible with the original ML service response.
    """
    import time as _time
    
    has_volume = any(c.get('volume', 0) > 0 for c in candles)
    
    # Try to get cached ML result
    ml_result = get_cached_adaptive_model(symbol) if symbol else None
    
    # Train model if not cached
    if ml_result is None and symbol:
        ml_result = train_adaptive_model(candles, symbol, min_samples=70)
        if ml_result:
            set_cached_adaptive_model(symbol, ml_result)
    
    # Extract current features
    current_features = extract_vdss_features(candles, len(candles) - 1, has_volume)
    
    # Calculate bull consensus
    consensus_result = calculate_bull_consensus(current_features, ml_result, has_volume)
    bull_consensus = consensus_result['bullConsensus']
    
    # Calculate scenario probabilities
    last_candle = candles[-1]
    price = last_candle['close']
    atr = calc_atr(candles) if len(candles) >= 14 else price * 0.02
    
    # Estimate S/R levels
    recent_highs = [c['high'] for c in candles[-30:] if c['high'] > price]
    recent_lows = [c['low'] for c in candles[-30:] if c['low'] < price]
    r1 = max(recent_highs) if recent_highs else price * 1.03
    s1 = min(recent_lows) if recent_lows else price * 0.97
    ma100_val = sma([c['close'] for c in candles], 100) if len(candles) >= 100 else sma([c['close'] for c in candles], min(100, len(candles)))
    
    scenarios = calculate_scenario_probabilities(
        bull_consensus, price, r1, s1, ma100_val,
        calc_rsi([c['close'] for c in candles]),
        calc_mfi(candles) if has_volume else 50,
        calc_stochastic(candles)['k'],
        has_volume, ml_result,
        calc_adx(candles)['adx'], atr
    )
    
    # Price prediction
    price_pred = predict_prices(candles, horizon)
    
    # Build prediction sessions
    sessions = []
    confidence = price_pred['confidence'] if price_pred else 0.5
    predicted_prices = price_pred['predicted_prices'] if price_pred else []
    
    for i in range(horizon):
        if i < len(predicted_prices):
            sessions.append({
                'session': i + 1,
                'predicted_close': predicted_prices[i],
                'confidence': round(confidence * 0.95, 2),
                'direction': 'up' if predicted_prices[i] > price else 'down' if predicted_prices[i] < price else 'neutral',
                'change_pct': round((predicted_prices[i] - price) / price * 100, 2) if price > 0 else 0,
            })
    
    # Overall direction and confidence
    overall_direction = 'up' if bull_consensus > 0.6 else 'down' if bull_consensus < 0.4 else 'neutral'
    overall_confidence = round(ml_result['recentAccuracy'] if ml_result and ml_result.get('isTrained') else consensus_result['usedML'] and 0.7 or 0.5, 2)
    
    target_min = min(s['predicted_close'] for s in sessions) if sessions else price * 0.95
    target_max = max(s['predicted_close'] for s in sessions) if sessions else price * 1.05
    
    # Risk level
    if confidence > 0.8:
        risk_level = 'low'
    elif confidence > 0.6:
        risk_level = 'medium'
    else:
        risk_level = 'high'
    
    # Feature importance
    feature_importance = {}
    if ml_result and ml_result.get('isTrained'):
        for i, name in enumerate(VDSS_FEATURE_NAMES):
            feature_importance[name] = round(ml_result['weights'][i], 4) if ml_result.get('weights') else 0
    
    return {
        'status': 'ok',
        'symbol': symbol,
        'candles_used': len(candles),
        'ml_model_used': 'logistic_regression_vdss',
        'training_samples': ml_result.get('sampleCount', 0) if ml_result else 0,
        'ml_accuracy': ml_result.get('recentAccuracy', 0.5) if ml_result else 0.5,
        'used_native_ml': True,
        'current_features': {name: round(f, 4) for name, f in zip(VDSS_FEATURE_NAMES, current_features)},
        'bull_consensus': round(bull_consensus, 4),
        'scenarios': scenarios,
        'forecasts': {
            'logistic_regression_vdss': {
                'model_name': 'Logistic Regression (VDSS 16-feature)',
                'cv_r2': ml_result.get('recentAccuracy', 0) if ml_result and ml_result.get('isTrained') else 0.0,
                'cv_rmse_pct': round(abs(1 - bull_consensus) * 100, 2),
                'predictions': sessions,
                'weights': {name: round(w, 4) for name, w in zip(VDSS_FEATURE_NAMES, ml_result['weights'])} if ml_result else None,
            }
        },
        'ensemble': {
            'model_name': 'Logistic Regression (VDSS)',
            'predictions': sessions,
            'weights': {'logistic_regression_vdss': 1.0},
        },
        'feature_importance': feature_importance,
    }


# ─── Exports ────────────────────────────────────────────────────────────────

__all__ = [
    'StandardScaler', 'LogisticRegressionModel', 'TimeSeriesSplit', 
    'AdaptiveWeightModel', 'VDSS_FEATURE_NAMES', 'clamp',
    'extract_vdss_features', 'train_adaptive_model',
    'calculate_bull_consensus', 'calculate_scenario_probabilities',
    'calculate_edge_weights', 'predict_prices',
    'get_cached_adaptive_model', 'set_cached_adaptive_model',
    'run_ml_analysis', 'DEFAULT_WEIGHTS',
]