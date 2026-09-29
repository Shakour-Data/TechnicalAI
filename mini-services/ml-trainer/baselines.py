"""
Baseline models for time series prediction.

Provides simple baseline models for both classification and regression tasks.
These models serve as benchmarks to evaluate the performance of more complex ML models.
"""

from typing import Any, List, Optional, Tuple
import numpy as np


class NaiveLastClassifier:
    """Predicts the last seen class label (persistence forecasting)."""
    
    def __init__(self):
        self.last_class: Optional[int] = None
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'NaiveLastClassifier':
        """Fit the model by recording the last class label."""
        if len(y) == 0:
            raise ValueError("Cannot fit on empty data")
        self.last_class = int(y[-1])
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict using the last seen class."""
        if self.last_class is None:
            raise ValueError("Model not fitted")
        return np.array([self.last_class] * len(X))
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Predict class probabilities (1.0 for predicted class)."""
        n = len(X)
        proba = np.zeros((n, 2))
        proba[:, self.last_class] = 1.0
        return proba


class NaiveLastRegressor:
    """Predicts the last seen value (persistence forecasting)."""
    
    def __init__(self):
        self.last_value: Optional[float] = None
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'NaiveLastRegressor':
        """Fit the model by recording the last value."""
        if len(y) == 0:
            raise ValueError("Cannot fit on empty data")
        self.last_value = float(y[-1])
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict using the last seen value."""
        if self.last_value is None:
            raise ValueError("Model not fitted")
        return np.array([self.last_value] * len(X))


class DriftRegressor:
    """Linear regression with drift term for time series prediction."""
    
    def __init__(self):
        self.drift_: Optional[float] = None
        self.intercept_: Optional[float] = None
        self.slope_: Optional[float] = None
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'DriftRegressor':
        """
        Fit a simple linear regression model.
        
        Args:
            X: Feature matrix (typically time indices)
            y: Target values
        """
        if len(y) < 2:
            raise ValueError("Need at least 2 samples for drift regression")
        
        # Simple linear regression: y = slope * x + intercept
        x = np.arange(len(y))
        slope, intercept = np.polyfit(x, y, 1)
        
        self.drift_ = slope
        self.slope_ = slope
        self.intercept_ = intercept
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict using the fitted linear model."""
        if self.slope_ is None:
            raise ValueError("Model not fitted")
        
        # X contains the feature values; we use the drift model
        # For time series, predict next values based on the fitted line
        predictions = []
        for x_val in X:
            if isinstance(x_val, (int, float)):
                pred = self.slope_ * x_val + self.intercept_
            else:
                # If X is array-like, use index-based prediction
                pred = self.slope_ * x_val[0] + self.intercept_
            predictions.append(pred)
        return np.array(predictions)


class DriftClassifier:
    """Linear regression with drift term for time series classification."""
    
    def __init__(self):
        self.slope_: Optional[float] = None
        self.intercept_: Optional[float] = None
        self.last_class_: Optional[int] = None
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'DriftClassifier':
        """Fit a simple linear model on targets and threshold for classification."""
        if len(y) < 2:
            self.last_class_ = int(y[-1]) if len(y) > 0 else 0
            return self
        
        x = np.arange(len(y))
        slope, intercept = np.polyfit(x, y, 1)
        self.slope_ = slope
        self.intercept_ = intercept
        self.last_class_ = int(np.sign(y[-1])) if y[-1] != 0 else int(y[-1])
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict class based on drift direction."""
        if self.slope_ is None:
            if self.last_class_ is not None:
                return np.array([self.last_class_] * len(X))
            raise ValueError("Model not fitted")
        
        predictions = []
        for i, x_val in enumerate(X):
            if isinstance(x_val, (int, float)):
                pred = self.slope_ * x_val + self.intercept_
            else:
                pred = self.slope_ * i + self.intercept_
            if pred > 0:
                predictions.append(1)
            elif pred < 0:
                predictions.append(-1)
            else:
                predictions.append(0)
        return np.array(predictions)
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Predict probabilities based on drift magnitude."""
        n = len(X)
        proba = np.zeros((n, 2))
        if self.slope_ is None or self.last_class_ is None:
            proba[:, 0] = 1.0
            return proba
        for i in range(n):
            proba[i] = [1.0, 0.0]
        return proba


class RollingMeanClassifier:
    """Predicts based on the most frequent class in a rolling window."""
    
    def __init__(self, window: int = 5):
        self.window = window
        self.last_window: Optional[np.ndarray] = None
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'RollingMeanClassifier':
        """Fit by storing the last window of target values."""
        if len(y) == 0:
            raise ValueError("Cannot fit on empty data")
        
        window_size = min(self.window, len(y))
        self.last_window = y[-window_size:]
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict using the most frequent class in the window."""
        if self.last_window is None:
            raise ValueError("Model not fitted")
        
        # Find most frequent class
        unique, counts = np.unique(self.last_window, return_counts=True)
        most_frequent = unique[np.argmax(counts)]
        
        return np.array([most_frequent] * len(X))


class RollingMeanRegressor:
    """Predicts the mean of the last window of target values."""
    
    def __init__(self, window: int = 5):
        self.window = window
        self.last_mean: Optional[float] = None
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'RollingMeanRegressor':
        """Fit by computing the mean of the last window of target values."""
        if len(y) == 0:
            raise ValueError("Cannot fit on empty data")
        
        window_size = min(self.window, len(y))
        self.last_mean = float(np.mean(y[-window_size:]))
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict using the mean of the last window."""
        if self.last_mean is None:
            raise ValueError("Model not fitted")
        
        return np.array([self.last_mean] * len(X))


class SeasonalNaiveRegressor:
    """Predicts using the value from the previous season (seasonal naive forecast)."""
    
    def __init__(self, seasonality: int = 5):
        self.seasonality = seasonality
        self.history: Optional[np.ndarray] = None
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'SeasonalNaiveRegressor':
        """Fit by storing the historical values."""
        if len(y) == 0:
            raise ValueError("Cannot fit on empty data")
        
        self.history = y.copy()
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict using values from previous seasons."""
        if self.history is None:
            raise ValueError("Model not fitted")
        
        predictions = []
        for i in range(len(X)):
            # Predict using value from seasonality steps ago
            idx = len(self.history) - self.seasonality + i
            if idx >= 0 and idx < len(self.history):
                predictions.append(self.history[idx])
            else:
                # Fallback to last value
                predictions.append(self.history[-1])
        
        return np.array(predictions)


class SeasonalNaiveClassifier:
    """Predicts using the class label from the previous season."""
    
    def __init__(self, seasonality: int = 5):
        self.seasonality = seasonality
        self.history: Optional[np.ndarray] = None
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'SeasonalNaiveClassifier':
        """Fit by storing historical class labels."""
        if len(y) == 0:
            raise ValueError("Cannot fit on empty data")
        self.history = y.copy()
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict using class labels from previous seasons."""
        if self.history is None:
            raise ValueError("Model not fitted")
        predictions = []
        for i in range(len(X)):
            idx = len(self.history) - self.seasonality + i
            if idx >= 0 and idx < len(self.history):
                predictions.append(self.history[idx])
            else:
                predictions.append(self.history[-1])
        return np.array(predictions)


# ────────────────────────────────────────────────────────────────────────────
# Factory functions
# ────────────────────────────────────────────────────────────────────────────

def get_baseline_classifier(key: str) -> Any:
    """
    Get a baseline classifier by key.
    
    Args:
        key: One of 'naive_last', 'rolling_mean', 'drift', 'seasonal_naive'
    
    Returns:
        Baseline classifier instance
    """
    if key == 'naive_last':
        return NaiveLastClassifier()
    elif key == 'rolling_mean':
        return RollingMeanClassifier(window=5)
    elif key == 'drift':
        return DriftClassifier()
    elif key == 'seasonal_naive':
        return SeasonalNaiveClassifier(seasonality=5)
    else:
        raise ValueError(f"Unknown baseline classifier: {key}")


def get_baseline_regressor(key: str) -> Any:
    """
    Get a baseline regressor by key.
    
    Args:
        key: One of 'naive_last', 'drift', 'rolling_mean', 'seasonal_naive'
    
    Returns:
        Baseline regressor instance
    """
    if key == 'naive_last':
        return NaiveLastRegressor()
    elif key == 'drift':
        return DriftRegressor()
    elif key == 'rolling_mean':
        return RollingMeanRegressor(window=5)
    elif key == 'seasonal_naive':
        return SeasonalNaiveRegressor(seasonality=5)
    else:
        raise ValueError(f"Unknown baseline regressor: {key}")