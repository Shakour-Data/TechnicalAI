import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from sklearn.base import BaseEstimator, ClassifierMixin, RegressorMixin
from sklearn.utils.validation import check_X_y, check_array
from sklearn.utils.multiclass import unique_labels


class NaiveLastClassifier(BaseEstimator, ClassifierMixin):
    """Predict the last seen class label."""
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'NaiveLastClassifier':
        self.classes_ = unique_labels(y)
        self.last_class_ = y[-1]
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.full(len(X), self.last_class_)
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        n_samples = len(X)
        n_classes = len(self.classes_)
        probs = np.zeros((n_samples, n_classes))
        idx = np.where(self.classes_ == self.last_class_)[0][0]
        probs[:, idx] = 1.0
        return probs


class NaiveLastRegressor(BaseEstimator, RegressorMixin):
    """Predict the last seen target value."""
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'NaiveLastRegressor':
        self.last_value_ = y[-1]
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.full(len(X), self.last_value_)


class DriftClassifier(BaseEstimator, ClassifierMixin):
    """Predict based on the drift (difference between first and last observation)."""
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'DriftClassifier':
        self.classes_ = unique_labels(y)
        if len(y) > 1:
            self.drift_ = y[-1] - y[0]
        else:
            self.drift_ = 0
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        preds = np.full(len(X), self.classes_[-1] + self.drift_)
        return preds.astype(int)
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return np.ones((len(X), len(self.classes_))) / len(self.classes_)


class DriftRegressor(BaseEstimator, RegressorMixin):
    """Predict using a linear drift from first to last observation."""
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'DriftRegressor':
        if len(y) > 1:
            self.drift_ = (y[-1] - y[0]) / len(y)
            self.last_value_ = y[-1]
        else:
            self.drift_ = 0
            self.last_value_ = y[0] if len(y) > 0 else 0
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        n = len(X)
        return np.array([self.last_value_ + self.drift_ * i for i in range(1, n + 1)])


class RollingMeanClassifier(BaseEstimator, ClassifierMixin):
    """Predict the most frequent class in the recent window."""
    
    def __init__(self, window: int = 5):
        self.window = window
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'RollingMeanClassifier':
        self.classes_ = unique_labels(y)
        self.window = min(self.window, len(y))
        recent = y[-self.window:]
        self.most_common_ = np.bincount(recent.astype(int)).argmax()
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.full(len(X), self.most_common_)
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        n_samples = len(X)
        n_classes = len(self.classes_)
        probs = np.zeros((n_samples, n_classes))
        idx = np.where(self.classes_ == self.most_common_)[0][0]
        probs[:, idx] = 1.0
        return probs


class RollingMeanRegressor(BaseEstimator, RegressorMixin):
    """Predict the mean of the recent window."""
    
    def __init__(self, window: int = 5):
        self.window = window
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'RollingMeanRegressor':
        self.window = min(self.window, len(y))
        self.mean_ = np.mean(y[-self.window:])
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.full(len(X), self.mean_)


class SeasonalNaiveClassifier(BaseEstimator, ClassifierMixin):
    """Predict using the class from the same position in the previous season."""
    
    def __init__(self, seasonality: int = 5):
        self.seasonality = seasonality
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'SeasonalNaiveClassifier':
        self.classes_ = unique_labels(y)
        self.y_ = y
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        n = len(X)
        preds = []
        for i in range(n):
            idx = len(self.y_) - self.seasonality + i
            if idx >= 0 and idx < len(self.y_):
                preds.append(self.y_[idx])
            else:
                preds.append(self.y_[-1])
        return np.array(preds)
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        preds = self.predict(X)
        n_samples = len(preds)
        n_classes = len(self.classes_)
        probs = np.zeros((n_samples, n_classes))
        for i, pred in enumerate(preds):
            idx = np.where(self.classes_ == pred)[0]
            if len(idx) > 0:
                probs[i, idx[0]] = 1.0
            else:
                probs[i, :] = 1.0 / n_classes
        return probs


class SeasonalNaiveRegressor(BaseEstimator, RegressorMixin):
    """Predict using the value from the same position in the previous season."""
    
    def __init__(self, seasonality: int = 5):
        self.seasonality = seasonality
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'SeasonalNaiveRegressor':
        self.y_ = y
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        n = len(X)
        preds = []
        for i in range(n):
            idx = len(self.y_) - self.seasonality + i
            if idx >= 0 and idx < len(self.y_):
                preds.append(self.y_[idx])
            else:
                preds.append(self.y_[-1])
        return np.array(preds)


BASELINE_CLASSIFIERS = {
    'naive_last': NaiveLastClassifier,
    'drift': DriftClassifier,
    'rolling_mean': RollingMeanClassifier,
    'seasonal_naive': SeasonalNaiveClassifier,
}

BASELINE_REGRESSORS = {
    'naive_last': NaiveLastRegressor,
    'drift': DriftRegressor,
    'rolling_mean': RollingMeanRegressor,
    'seasonal_naive': SeasonalNaiveRegressor,
}


def get_baseline_classifier(key: str, **kwargs) -> Optional[Any]:
    """Get a baseline classifier by key."""
    cls = BASELINE_CLASSIFIERS.get(key)
    if cls is None:
        return None
    return cls(**kwargs)


def get_baseline_regressor(key: str, **kwargs) -> Optional[Any]:
    """Get a baseline regressor by key."""
    cls = BASELINE_REGRESSORS.get(key)
    if cls is None:
        return None
    return cls(**kwargs)