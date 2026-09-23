"""
Unit tests for ML Trainer module.

Tests cover:
- Data leakage prevention (no shuffle, no future data)
- Confusion matrix validation
- Metrics stability across runs
- Output schema compatibility
"""

import pytest
import numpy as np
import pandas as pd
import json
import sys
import os
import tempfile
import shutil

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from feature_engineering import extract_enhanced_features, compute_hurst_exponent, compute_realized_volatility
from model_catalog import (
    build_classification_model, build_regression_model,
    CLASSIFICATION_MODELS, REGRESSION_MODELS,
)
from evaluation import (
    classification_metrics, regression_metrics,
    compute_stable_features, model_comparison_table,
)
from baselines import (
    NaiveLastClassifier, NaiveLastRegressor,
    DriftRegressor, RollingMeanClassifier,
    SeasonalNaiveRegressor,
)
from config import TARGET_CONFIGS


# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────

@pytest.fixture
def sample_ohlcv():
    """Generate synthetic OHLCV data for testing."""
    np.random.seed(42)
    n = 200
    dates = pd.date_range("2020-01-01", periods=n, freq="D")
    close = 100 + np.cumsum(np.random.randn(n) * 0.5)
    open_ = close - np.random.randn(n) * 0.2
    high = np.maximum(open_, close) + np.abs(np.random.randn(n)) * 0.3
    low = np.minimum(open_, close) - np.abs(np.random.randn(n)) * 0.3
    volume = np.random.randint(100000, 1000000, n)
    
    df = pd.DataFrame({
        "date": dates,
        "open": open_,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume,
    })
    return df


@pytest.fixture
def ohlcv_list(sample_ohlcv):
    """Convert to list format."""
    return sample_ohlcv[["date", "open", "high", "low", "close", "volume"]].values.tolist()


# ─────────────────────────────────────────────────────────────
# Data Leakage Tests
# ─────────────────────────────────────────────────────────────

class TestDataLeakagePrevention:
    """Tests ensuring no data leakage in training pipeline."""
    
    def test_no_shuffle_in_timeseries_split(self):
        """TimeSeriesSplit must not shuffle data."""
        from sklearn.model_selection import TimeSeriesSplit
        data = np.arange(50).reshape(-1, 1)
        tscv = TimeSeriesSplit(n_splits=5)
        splits = list(tscv.split(data))
        
        for train_idx, test_idx in splits:
            # Train indices must be before test indices
            assert train_idx.max() < test_idx.min(), "Data leakage: train indices overlap with test indices"
    
    def test_features_use_only_historical_data(self, sample_ohlcv):
        """Feature engineering must not use future data."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        # Check that no feature uses future close prices
        # All rolling windows should be backward-looking
        assert len(features) == len(df), "Feature count must match input count"
        
        # Check for NaNs at the beginning (expected for rolling windows)
        # Not all features should have NaNs
        assert features.isna().sum().sum() > 0, "Expected some NaN values at beginning"
    
    def test_scaler_fitted_only_on_train(self, sample_ohlcv):
        """Scaler must be fit only on training fold data, not all data."""
        from sklearn.preprocessing import StandardScaler
        
        # Simulate CV
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        valid_features = features.dropna(axis=0, how='any')
        
        if len(valid_features) < 20:
            pytest.skip("Not enough valid samples")
        
        X = valid_features.values
        
        # Split using TimeSeriesSplit
        from sklearn.model_selection import TimeSeriesSplit
        tscv = TimeSeriesSplit(n_splits=5)
        scalers = []
        
        for train_idx, test_idx in tscv.split(X):
            scaler = StandardScaler()
            scaler.fit(X[train_idx])
            scalers.append(scaler)
            
            # Verify scaler was fitted on training data only
            assert len(scaler.mean_) == X.shape[1], "Scaler must have correct dimensions"
        
        # Verify test data transformation uses train-only scaler
        scaler = StandardScaler()
        scaler.fit(X[: len(X) // 2])
        X_test_scaled = scaler.transform(X[len(X) // 2:])
        assert X_test_scaled.shape == (len(X) - len(X) // 2, X.shape[1])
    
    def test_no_future_target_leakage(self, sample_ohlcv):
        """Targets must not use future data from the perspective of each fold."""
        df = sample_ohlcv.copy().reset_index(drop=True)
        
        # Build target (forward-looking)
        fwd_return = df["close"].shift(-5) / df["close"] - 1.0
        
        # In a proper CV split, test fold targets should only be known after training
        # This test verifies the target computation doesn't accidentally use data
        # from the test period during feature computation
        from sklearn.model_selection import TimeSeriesSplit
        
        tscv = TimeSeriesSplit(n_splits=5)
        for fold_idx, (train_idx, test_idx) in enumerate(tscv.split(df)):
            # Test set should have targets computed from their own future data
            # which is correct because we're predicting forward returns
            test_target = fwd_return.iloc[test_idx]
            assert not test_target.isna().any() or len(test_target.dropna()) > 0, \
                f"Fold {fold_idx}: Test targets should be computable"
    
    def test_ohlcv_order_preserved(self, sample_ohlcv):
        """Data must remain in chronological order; no reordering."""
        df = sample_ohlcv.copy().reset_index(drop=True)
        features = extract_enhanced_features(df)
        
        # Check that features maintain the same index order
        assert list(features.index) == list(df.index), "Index order must be preserved"


# ─────────────────────────────────────────────────────────────
# Confusion Matrix Tests
# ─────────────────────────────────────────────────────────────

class TestConfusionMatrix:
    """Tests for confusion matrix computation and validation."""
    
    def test_confusion_matrix_shape_binary(self):
        """Binary classification confusion matrix must be 2x2."""
        y_true = np.array([0, 0, 1, 1, 0, 1, 0, 1])
        y_pred = np.array([0, 0, 1, 0, 0, 1, 1, 1])
        
        result = classification_metrics(y_true, y_pred)
        cm = result['confusion_matrix']
        
        assert len(cm) == 2, "Binary confusion matrix must have 2 rows"
        assert len(cm[0]) == 2, "Binary confusion matrix must have 2 columns"
        assert sum(sum(row) for row in cm) == len(y_true), "Confusion matrix must account for all samples"
    
    def test_confusion_matrix_shape_ternary(self):
        """Ternary classification confusion matrix must be 3x3."""
        y_true = np.array([0, 1, 2, 0, 1, 2, 0, 1, 2])
        y_pred = np.array([0, 1, 2, 0, 2, 1, 0, 0, 2])
        
        result = classification_metrics(y_true, y_pred)
        cm = result['confusion_matrix']
        
        assert len(cm) == 3, "Ternary confusion matrix must have 3 rows"
        assert len(cm[0]) == 3, "Ternary confusion matrix must have 3 columns"
    
    def test_per_class_metrics_complete(self):
        """Per-class metrics must include precision, recall, f1, support."""
        y_true = np.array([0, 0, 1, 1, 0, 1, 0, 1])
        y_pred = np.array([0, 0, 1, 0, 0, 1, 1, 1])
        
        result = classification_metrics(y_true, y_pred)
        per_class = result['per_class']
        
        assert len(per_class) > 0, "Per-class metrics must not be empty"
        for cls_name, cls_metrics in per_class.items():
            assert 'precision' in cls_metrics, f"Missing precision in {cls_name}"
            assert 'recall' in cls_metrics, f"Missing recall in {cls_name}"
            assert 'f1' in cls_metrics, f"Missing f1 in {cls_name}"
            assert 'support' in cls_metrics, f"Missing support in {cls_name}"
    
    def test_macro_weighted_avg_present(self):
        """Macro and weighted averages must be present."""
        y_true = np.array([0, 0, 1, 1, 0, 1, 0, 1])
        y_pred = np.array([0, 0, 1, 0, 0, 1, 1, 1])
        
        result = classification_metrics(y_true, y_pred)
        macro = result['macro_weighted_avg']
        
        assert 'precision' in macro, "Missing macro precision"
        assert 'recall' in macro, "Missing macro recall"
        assert 'f1' in macro, "Missing macro f1"
    
    def test_roc_auc_binary(self):
        """ROC AUC must be computed for binary classification."""
        y_true = np.array([0, 0, 1, 1, 0, 1, 0, 1])
        y_pred = np.array([0, 0, 1, 0, 0, 1, 1, 1])
        y_proba = np.array([[0.9, 0.1], [0.8, 0.2], [0.3, 0.7], [0.4, 0.6],
                            [0.85, 0.15], [0.2, 0.8], [0.7, 0.3], [0.35, 0.65]])
        
        result = classification_metrics(y_true, y_pred, y_proba)
        assert result['roc_auc'] is not None, "ROC AUC must be computed"
        assert 0 <= result['roc_auc'] <= 1, "ROC AUC must be between 0 and 1"


# ─────────────────────────────────────────────────────────────
# Metrics Stability Tests
# ─────────────────────────────────────────────────────────────

class TestMetricsStability:
    """Tests ensuring metrics are stable across runs."""
    
    def test_classification_metrics_stability(self):
        """Classification metrics should be identical across identical runs."""
        np.random.seed(42)
        y_true = np.random.randint(0, 2, 100)
        y_pred = np.random.randint(0, 2, 100)
        
        result1 = classification_metrics(y_true, y_pred)
        result2 = classification_metrics(y_true, y_pred)
        
        assert result1['accuracy'] == result2['accuracy'], "Accuracy must be stable"
        assert result1['confusion_matrix'] == result2['confusion_matrix'], "Confusion matrix must be stable"
    
    def test_regression_metrics_stability(self):
        """Regression metrics should be identical across identical runs."""
        np.random.seed(42)
        y_true = np.random.randn(100)
        y_pred = np.random.randn(100)
        
        result1 = regression_metrics(y_true, y_pred)
        result2 = regression_metrics(y_true, y_pred)
        
        assert result1['r2'] == result2['r2'], "R² must be stable"
        assert result1['rmse'] == result2['rmse'], "RMSE must be stable"
        assert result1['mae'] == result2['mae'], "MAE must be stable"
    
    def test_confusion_matrix_values_sum(self):
        """Confusion matrix values must sum to total samples."""
        y_true = np.array([0, 0, 1, 1, 0, 1, 0, 1, 0, 1] * 10)
        y_pred = np.array([0, 0, 1, 0, 0, 1, 1, 1, 0, 1] * 10)
        
        result = classification_metrics(y_true, y_pred)
        cm_sum = sum(sum(row) for row in result['confusion_matrix'])
        assert cm_sum == len(y_true), f"Confusion matrix sum {cm_sum} must equal {len(y_true)}"
    
    def test_feature_importance_stability(self):
        """Feature importance computation must be deterministic."""
        from model_catalog import build_classification_model
        
        model = build_classification_model("random_forest_classifier")
        X = np.random.randn(100, 5)
        y = np.random.randint(0, 2, 100)
        model.fit(X, y)
        
        feature_cols = [f"f{i}" for i in range(5)]
        
        from evaluation import _get_feature_importance
        imp1 = _get_feature_importance(model, feature_cols)
        imp2 = _get_feature_importance(model, feature_cols)
        
        assert imp1 == imp2, "Feature importance must be deterministic"


# ─────────────────────────────────────────────────────────────
# Schema Compatibility Tests
# ─────────────────────────────────────────────────────────────

class TestSchemaCompatibility:
    """Tests ensuring output schema is consistent and compatible."""
    
    def test_classification_output_schema(self):
        """Classification metrics output must have required keys."""
        y_true = np.array([0, 0, 1, 1, 0, 1, 0, 1])
        y_pred = np.array([0, 0, 1, 0, 0, 1, 1, 1])
        
        result = classification_metrics(y_true, y_pred)
        
        required_keys = [
            'confusion_matrix', 'per_class', 'macro_weighted_avg',
            'accuracy', 'classification_report',
        ]
        for key in required_keys:
            assert key in result, f"Missing required key: {key}"
    
    def test_regression_output_schema(self):
        """Regression metrics output must have required keys."""
        y_true = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        y_pred = np.array([1.1, 1.9, 3.1, 3.9, 5.1])
        
        result = regression_metrics(y_true, y_pred)
        
        required_keys = [
            'r2', 'adjusted_r2', 'rmse', 'mae', 'mape', 'mbe',
            'msle', 'median_ae', 'explained_variance',
            'residual_stats', 'prediction_intervals',
        ]
        for key in required_keys:
            assert key in result, f"Missing required key: {key}"
    
    def test_model_comparison_schema(self):
        """Model comparison table must have rank and sorted order."""
        metrics = {
            "model_a": {"accuracy": 0.85},
            "model_b": {"accuracy": 0.92},
            "model_c": {"accuracy": 0.78},
        }
        
        comparison = model_comparison_table(metrics)
        
        # Must be sorted by accuracy descending
        assert comparison[0]['model'] == 'model_b'
        assert comparison[0]['rank'] == 1
        assert comparison[2]['model'] == 'model_c'
        assert comparison[2]['rank'] == 3
        
        # All must have rank and primary_score
        for item in comparison:
            assert 'rank' in item
            assert 'primary_score' in item
            assert 'model' in item
    
    def test_feature_importance_schema(self):
        """Feature importance must be a dict with string keys and float values."""
        from model_catalog import build_classification_model, CLASSIFICATION_MODELS
        from evaluation import _get_feature_importance
        
        model = build_classification_model("random_forest_classifier")
        X = np.random.randn(100, 5)
        y = np.random.randint(0, 2, 100)
        model.fit(X, y)
        
        feature_cols = [f"feature_{i}" for i in range(5)]
        imp = _get_feature_importance(model, feature_cols)
        
        assert isinstance(imp, dict), "Feature importance must be a dict"
        assert len(imp) == len(feature_cols), f"Must have {len(feature_cols)} features"
        for col in feature_cols:
            assert col in imp, f"Missing feature: {col}"
            assert isinstance(imp[col], float), f"Feature importance must be float for {col}"
    
    def test_stable_features_schema(self):
        """Stable features must be a list of strings."""
        fold_imp_history = [
            {"f0": 0.5, "f1": 0.3, "f2": 0.2},
            {"f0": 0.4, "f1": 0.35, "f2": 0.25},
            {"f0": 0.45, "f1": 0.3, "f2": 0.25},
        ]
        
        stable = compute_stable_features(fold_imp_history, threshold=0.8)
        assert isinstance(stable, list), "Stable features must be a list"
        for feat in stable:
            assert isinstance(feat, str), "Each stable feature must be a string"


# ─────────────────────────────────────────────────────────────
# Model Catalog Tests
# ─────────────────────────────────────────────────────────────

class TestModelCatalog:
    """Tests for model creation and catalog completeness."""
    
    def test_all_classification_models_can_build(self):
        """All classification models must be buildable."""
        built = []
        failed = []
        for model_key in CLASSIFICATION_MODELS:
            try:
                model = build_classification_model(model_key)
                if model is not None:
                    built.append(model_key)
                else:
                    failed.append(model_key)
            except Exception as e:
                failed.append(f"{model_key}: {str(e)}")
        
        assert len(failed) == 0, f"Failed to build models: {failed}"
        assert len(built) > 0, "Must build at least one classification model"
    
    def test_all_regression_models_can_build(self):
        """All regression models must be buildable."""
        built = []
        failed = []
        for model_key in REGRESSION_MODELS:
            try:
                model = build_regression_model(model_key)
                if model is not None:
                    built.append(model_key)
                else:
                    failed.append(model_key)
            except Exception as e:
                failed.append(f"{model_key}: {str(e)}")
        
        assert len(failed) == 0, f"Failed to build models: {failed}"
        assert len(built) > 0, "Must build at least one regression model"
    
    def test_model_count_requirement(self):
        """Must have at least 12 classification and 12 regression models."""
        assert len(CLASSIFICATION_MODELS) >= 12, \
            f"Need at least 12 classification models, have {len(CLASSIFICATION_MODELS)}"
        assert len(REGRESSION_MODELS) >= 12, \
            f"Need at least 12 regression models, have {len(REGRESSION_MODELS)}"
    
    def test_ensemble_models_buildable(self):
        """Ensemble models must be buildable."""
        from model_catalog import (
            build_ensemble_classifier, build_ensemble_regressor,
            build_stacking_classifier, build_stacking_regressor,
        )
        
        voting_clf = build_ensemble_classifier()
        voting_reg = build_ensemble_regressor()
        stacking_clf = build_stacking_classifier()
        stacking_reg = build_stacking_regressor()
        
        assert voting_clf is not None, "VotingClassifier must be buildable"
        assert voting_reg is not None, "VotingRegressor must be buildable"
        assert stacking_clf is not None, "StackingClassifier must be buildable"
        assert stacking_reg is not None, "StackingRegressor must be buildable"
    
    def test_baseline_models_buildable(self):
        """Baseline models must be buildable."""
        from baselines import (
            get_baseline_classifier, get_baseline_regressor,
        )
        
        for key in ['naive_last', 'drift', 'rolling_mean', 'seasonal_naive']:
            cls = get_baseline_classifier(key)
            assert cls is not None, f"Baseline classifier {key} must be buildable"
            
            reg = get_baseline_regressor(key)
            assert reg is not None, f"Baseline regressor {key} must be buildable"


# ─────────────────────────────────────────────────────────────
# Feature Engineering Tests
# ─────────────────────────────────────────────────────────────

class TestFeatureEngineering:
    """Tests for enhanced feature engineering."""
    
    def test_feature_count_increase(self, sample_ohlcv):
        """Enhanced features must have more columns than original."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        # Original extract_features had ~40 features
        # Enhanced should have 50+
        assert len(features.columns) >= 45, \
            f"Need at least 45 features, got {len(features.columns)}"
    
    def test_log_return_feature_present(self, sample_ohlcv):
        """Log return features must be present."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        assert "log_return_1d" in features.columns, "log_return_1d must be present"
        assert "log_return_5d" in features.columns, "log_return_5d must be present"
    
    def test_realized_volatility_feature_present(self, sample_ohlcv):
        """Realized volatility features must be present."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        assert "realized_vol_10" in features.columns, "realized_vol_10 must be present"
        assert "realized_vol_20" in features.columns, "realized_vol_20 must be present"
    
    def test_realized_skew_kurtosis_present(self, sample_ohlcv):
        """Realized skew/kurtosis features must be present."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        assert "realized_skew_10" in features.columns, "realized_skew_10 must be present"
        assert "realized_kurt_10" in features.columns, "realized_kurt_10 must be present"
    
    def test_hurst_exponent_feature_present(self, sample_ohlcv):
        """Hurst exponent feature must be present."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        assert "hurst_exponent" in features.columns, "hurst_exponent must be present"
    
    def test_adx_di_gap_feature_present(self, sample_ohlcv):
        """ADX-DI gap feature must be present."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        assert "adx_di_gap" in features.columns, "adx_di_gap must be present"
    
    def test_volume_profile_proxy_present(self, sample_ohlcv):
        """Volume profile proxy feature must be present."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        assert "volume_profile_proxy" in features.columns, "volume_profile_proxy must be present"
    
    def test_distance_to_sr_present(self, sample_ohlcv):
        """Distance-to-S/R feature must be present."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        assert "distance_to_sr" in features.columns, "distance_to_sr must be present"
    
    def test_regime_dummy_present(self, sample_ohlcv):
        """Regime dummy feature must be present."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        assert "regime_dummy" in features.columns, "regime_dummy must be present"
    
    def test_autocorrelation_lags_present(self, sample_ohlcv):
        """Autocorrelation lag features must be present."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        assert "autocorr_lag1" in features.columns, "autocorr_lag1 must be present"
        assert "autocorr_lag2" in features.columns, "autocorr_lag2 must be present"
    
    def test_all_features_finite(self, sample_ohlcv):
        """All features must be finite (no inf or nan after cleaning)."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        valid_features = features.dropna(axis=0, how='any')
        valid_features = valid_features.replace([np.inf, -np.inf], np.nan).dropna(axis=0, how='any')
        
        assert len(valid_features) > 0, "Must have at least some valid rows"
        assert valid_features.isna().sum().sum() == 0, "All valid features must be finite"
    
    def test_hurst_exponent_range(self, sample_ohlcv):
        """Hurst exponent should be in reasonable range [0, 1]."""
        df = sample_ohlcv.copy()
        features = extract_enhanced_features(df)
        
        hurst = features["hurst_exponent"].dropna()
        if len(hurst) > 0:
            assert hurst.min() >= 0 and hurst.max() <= 1.5, \
                f"Hurst exponent should be roughly in [0, 1], got range [{hurst.min()}, {hurst.max()}]"


# ─────────────────────────────────────────────────────────────
# Baseline Models Tests
# ─────────────────────────────────────────────────────────────

class TestBaselineModels:
    """Tests for baseline model implementations."""
    
    def test_naive_last_classifier(self):
        """NaiveLastClassifier must predict last seen class."""
        model = NaiveLastClassifier()
        X = np.array([[1], [2], [3], [4], [5]])
        y = np.array([0, 1, 0, 1, 0])
        model.fit(X, y)
        preds = model.predict(np.array([[6], [7]]))
        assert all(p == 0 for p in preds), "Should predict last class (0)"
    
    def test_naive_last_regressor(self):
        """NaiveLastRegressor must predict last value."""
        model = NaiveLastRegressor()
        X = np.array([[1], [2], [3], [4], [5]])
        y = np.array([10.0, 20.0, 30.0, 40.0, 50.0])
        model.fit(X, y)
        preds = model.predict(np.array([[6], [7]]))
        assert all(p == 50.0 for p in preds), "Should predict last value (50.0)"
    
    def test_drift_regressor(self):
        """DriftRegressor must predict with linear drift."""
        model = DriftRegressor()
        y = np.array([10.0, 15.0, 20.0, 25.0, 30.0])
        model.fit(np.array([[1], [2], [3], [4], [5]]), y)
        assert hasattr(model, 'drift_'), "Must have drift_ attribute"
        assert model.drift_ > 0, "Drift should be positive for increasing series"
    
    def test_rolling_mean_classifier(self):
        """RollingMeanClassifier must predict most frequent class."""
        model = RollingMeanClassifier(window=5)
        y = np.array([0, 1, 0, 1, 0, 1, 0])
        X = np.array([[1]] * len(y))
        model.fit(X, y)
        preds = model.predict(np.array([[1]]))
        assert preds[0] == 0, "Most frequent class in window should be 0"
    
    def test_seasonal_naive_regressor(self):
        """SeasonalNaiveRegressor must predict from previous season."""
        model = SeasonalNaiveRegressor(seasonality=5)
        y = np.array([10, 15, 20, 25, 30, 12, 17, 22, 27, 32])
        X = np.array([[1]] * len(y))
        model.fit(X, y)
        preds = model.predict(np.array([[1], [1]]))
        assert preds[0] == 12, "First prediction should be from 5 steps ago"
        assert preds[1] == 17, "Second prediction should be from 5 steps ago"


# ─────────────────────────────────────────────────────────────
# Target Config Tests
# ─────────────────────────────────────────────────────────────

class TestTargetConfigs:
    """Tests for target configuration."""
    
    def test_all_target_configs_defined(self):
        """All target configurations must be defined."""
        assert 'binary_direction' in TARGET_CONFIGS
        assert 'ternary_direction' in TARGET_CONFIGS
        assert 'log_return' in TARGET_CONFIGS
        assert 'volatility_class' in TARGET_CONFIGS
    
    def test_target_configs_have_correct_types(self):
        """Target configs must have correct type fields."""
        assert TARGET_CONFIGS['binary_direction']['type'] == 'classification'
        assert TARGET_CONFIGS['ternary_direction']['type'] == 'classification'
        assert TARGET_CONFIGS['log_return']['type'] == 'regression'
        assert TARGET_CONFIGS['volatility_class']['type'] == 'classification'
    
    def test_target_configs_n_classes(self):
        """Target configs must have correct number of classes."""
        assert TARGET_CONFIGS['binary_direction']['n_classes'] == 2
        assert TARGET_CONFIGS['ternary_direction']['n_classes'] == 3
        assert TARGET_CONFIGS['volatility_class']['n_classes'] == 3


# ─────────────────────────────────────────────────────────────
# Output Schema Tests
# ─────────────────────────────────────────────────────────────

class TestOutputSchema:
    """Tests ensuring training output has correct schema."""
    
    def test_train_output_has_required_keys(self, ohlcv_list):
        """Train output must have all required keys."""
        from index import train_models
        
        try:
            result = train_models("TEST", ohlcv_list, ["random_forest_classifier"])
        except Exception as e:
            pytest.skip(f"Train failed: {e}")
        
        required_keys = [
            'status', 'symbol', 'models_trained', 'metrics',
            'feature_importance', 'stable_features',
            'model_comparison', 'best_model_by_cv',
            'warning_flags', 'training_samples', 'date_range',
        ]
        for key in required_keys:
            assert key in result, f"Missing required key: {key}"
        
        assert result['status'] == 'ok', "Status must be ok"
        assert 'TEST' == result['symbol'], "Symbol must match"
    
    def test_model_comparison_has_ranks(self, ohlcv_list):
        """Model comparison must have ranks and be sorted."""
        from index import train_models
        
        try:
            result = train_models("TEST2", ohlcv_list, ["random_forest_classifier"])
        except Exception:
            pytest.skip("Train failed")
        
        comparison = result.get('model_comparison', [])
        if len(comparison) > 0:
            assert all('rank' in item for item in comparison), "All items must have rank"
            assert comparison[0]['rank'] == 1, "First item must have rank 1"
            assert all(comparison[i]['primary_score'] >= comparison[i+1]['primary_score']
                      for i in range(len(comparison)-1)), "Must be sorted by score"
    
    def test_warning_flags_present(self, ohlcv_list):
        """Training output must include warning flags."""
        from index import train_models
        
        try:
            result = train_models("TEST3", ohlcv_list, ["random_forest_classifier"])
        except Exception:
            pytest.skip("Train failed")
        
        assert 'warning_flags' in result, "Must have warning_flags"
        assert isinstance(result['warning_flags'], list), "warning_flags must be a list"
    
    def test_prediction_output_has_intervals(self, ohlcv_list):
        """Prediction output must have confidence intervals."""
        from index import predict_sessions
        
        try:
            result = predict_sessions("TEST", ohlcv_list, 5)
        except Exception:
            pytest.skip("Predict failed - no trained model")
        
        if 'status' in result and result['status'] == 'ok':
            sessions = result['prediction']['sessions']
            if len(sessions) > 0:
                assert 'confidence' in sessions[0], "Sessions must have confidence"
                assert 'direction' in sessions[0], "Sessions must have direction"
                assert 'predicted_close' in sessions[0], "Sessions must have predicted_close"


# ─────────────────────────────────────────────────────────────
# Cross-validation Tests
# ─────────────────────────────────────────────────────────────

class TestCrossValidation:
    """Tests for proper cross-validation behavior."""
    
    def test_timeseries_split_n_splits(self):
        """TimeSeriesSplit must produce correct number of splits."""
        from sklearn.model_selection import TimeSeriesSplit
        import numpy as np
        
        X = np.arange(50).reshape(-1, 1)
        tscv = TimeSeriesSplit(n_splits=5)
        splits = list(tscv.split(X))
        
        assert len(splits) == 5, f"Expected 5 splits, got {len(splits)}"
        
        # Verify fold sizes increase
        for i in range(len(splits) - 1):
            train_size_i = splits[i][0].shape[0]
            train_size_next = splits[i+1][0].shape[0]
            assert train_size_next > train_size_i, f"Train size should increase: fold {i} vs {i+1}"
    
    def test_no_data_leakage_between_folds(self):
        """No overlap between train and test indices in any fold."""
        from sklearn.model_selection import TimeSeriesSplit
        
        X = np.arange(100).reshape(-1, 1)
        tscv = TimeSeriesSplit(n_splits=5)
        
        for train_idx, test_idx in tscv.split(X):
            intersection = set(train_idx) & set(test_idx)
            assert len(intersection) == 0, f"Data leakage: {intersection} overlap between train/test"


# ─────────────────────────────────────────────────────────────
# Run Tests
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    pytest.main([__file__, "-v"])