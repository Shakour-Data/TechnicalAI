import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    confusion_matrix, classification_report, roc_auc_score,
    precision_recall_curve, average_precision_score,
    mean_absolute_error, mean_squared_error, r2_score,
    explained_variance_score,
)
from sklearn.metrics import roc_curve, auc
from scipy import stats
from typing import Dict, Any, List, Optional, Tuple, Union
import warnings
import json


def _get_feature_importance(model: Any, feature_cols: List[str]) -> Dict[str, float]:
    """Extract feature importance from a model."""
    if model is None:
        return {}
    if hasattr(model, 'feature_importances_'):
        imp = model.feature_importances_
        if len(imp) == len(feature_cols):
            return {col: round(float(val), 6) for col, val in zip(feature_cols, imp)}
    if hasattr(model, 'coef_'):
        coef = model.coef_
        if len(coef) == len(feature_cols):
            return {col: round(float(abs(val)), 6) for col, val in zip(feature_cols, coef.ravel())}
    return {}


def safe_div(num, denom, default=0.0):
    return num / denom if denom != 0 else default


def classification_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_proba: Optional[np.ndarray] = None) -> Dict[str, Any]:
    """
    Compute comprehensive classification metrics including confusion matrix.
    
    Parameters
    ----------
    y_true : np.ndarray
        True labels
    y_pred : np.ndarray
        Predicted labels
    y_proba : np.ndarray, optional
        Predicted probabilities (for ROC AUC etc.)
        
    Returns
    -------
    dict containing confusion matrix, per-class metrics, macro/micro averages, and additional scores
    """
    # Basic metrics
    accuracy = accuracy_score(y_true, y_pred)
    f1_macro = f1_score(y_true, y_pred, average='macro')
    f1_micro = f1_score(y_true, y_pred, average='micro')
    f1_weighted = f1_score(y_true, y_pred, average='weighted')
    precision_macro = precision_score(y_true, y_pred, average='macro', zero_division=0)
    recall_macro = recall_score(y_true, y_pred, average='macro', zero_division=0)
    precision_weighted = precision_score(y_true, y_pred, average='weighted', zero_division=0)
    recall_weighted = recall_score(y_true, y_pred, average='weighted', zero_division=0)
    
    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    n_classes = len(np.unique(y_true))
    
    # Per-class metrics
    per_class = {}
    classes = np.unique(y_true)
    if n_classes <= 10:  # Avoid huge outputs for many classes
        for i, cls in enumerate(classes):
            cls_mask = y_true == cls
            if np.sum(cls_mask) > 0:
                y_true_cls = y_true[cls_mask]
                y_pred_cls = y_pred[cls_mask]
                per_class[f"class_{cls}"] = {
                     "precision": precision_score(y_true_cls, y_pred_cls, average='micro', zero_division=0),
                     "recall": recall_score(y_true_cls, y_pred_cls, average='micro', zero_division=0),
                     "f1": f1_score(y_true_cls, y_pred_cls, average='micro', zero_division=0),
                    "support": int(np.sum(cls_mask)),
                    "tpr": safe_div(
                        np.sum((y_true_cls == 1) & (y_pred_cls == 1)) if n_classes == 2 else np.sum(y_true_cls == y_pred_cls),
                        np.sum(y_true_cls == 1) if n_classes == 2 else np.sum(y_true_cls)
                    ),
                    "fpr": safe_div(
                        np.sum((y_true_cls == 0) & (y_pred_cls == 1)) if n_classes == 2 else 0,
                        np.sum(y_true_cls == 0) if n_classes == 2 else 1
                    )
                }
    
    # ROC AUC and PR AUC
    roc_auc = None
    pr_auc = None
    if y_proba is not None and n_classes == 2:
        try:
            roc_auc = roc_auc_score(y_true, y_proba[:, 1])
            precision_curve, recall_curve, _ = precision_recall_curve(y_true, y_proba[:, 1])
            pr_auc = average_precision_score(y_true, y_proba[:, 1])
        except Exception:
            pass
    elif y_proba is not None and n_classes > 2:
        try:
            roc_auc = roc_auc_score(y_true, y_proba, multi_class='ovo', average='weighted')
        except Exception:
            pass
    
    # Log loss
    try:
        log_loss = None
        if y_proba is not None:
            from sklearn.metrics import log_loss as sklearn_log_loss
            log_loss = sklearn_log_loss(y_true, y_proba)
    except Exception:
        log_loss = None
    
    # Brier score (for binary)
    brier_score = None
    if y_proba is not None and n_classes == 2:
        try:
            from sklearn.metrics import brier_score_loss
            brier_score = brier_score_loss(y_true, y_proba[:, 1])
        except Exception:
            pass
    
    # Cohen Kappa and Matthews Corrcoef
    try:
        from sklearn.metrics import cohen_kappa_score, matthews_corrcoef
        cohen_kappa = cohen_kappa_score(y_true, y_pred)
        matthews_corrcoef_val = matthews_corrcoef(y_true, y_pred)
    except Exception:
        cohen_kappa = None
        matthews_corrcoef_val = None
    
    # Calibration curve data
    calibration_curve = None
    if y_proba is not None and n_classes == 2:
        try:
            from sklearn.calibration import calibration_curve as sk_calibration_curve
            fraction_positives, mean_predicted_value = sk_calibration_curve(
                y_true, y_proba[:, 1], n_bins=10
            )
            calibration_curve = {
                "prob_true": fraction_positives.tolist(),
                "prob_pred": mean_predicted_value.tolist()
            }
        except Exception:
            pass
    
    result = {
        "confusion_matrix": cm.tolist(),
        "per_class": per_class,
        "macro_weighted_avg": {
            "precision": precision_weighted,
            "recall": recall_weighted,
            "f1": f1_weighted,
        },
        "macro_avg": {
            "precision": precision_macro,
            "recall": recall_macro,
            "f1": f1_macro,
        },
        "micro_avg": {
            "precision": f1_micro,  # For precision/recall, micro = accuracy when using single label
            "recall": f1_micro,
            "f1": f1_micro,
        },
        "accuracy": accuracy,
        "roc_auc": roc_auc,
        "pr_auc": pr_auc,
        "log_loss": log_loss,
        "brier_score": brier_score,
        "cohen_kappa": cohen_kappa,
        "matthews_corrcoef": matthews_corrcoef_val,
        "calibration_curve": calibration_curve,
        "classification_report": classification_report(y_true, y_pred, output_dict=True),
    }
    
    # Add per-class details if binary or small number of classes
    if n_classes <= 5:
        result["true_positive_rate"] = per_class.get("class_1", {}).get("tpr") if "class_1" in per_class else None
        result["false_positive_rate"] = per_class.get("class_1", {}).get("fpr") if "class_1" in per_class else None
    
    return result


def regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    """
    Compute comprehensive regression metrics.
    
    Parameters
    ----------
    y_true : np.ndarray
        True target values
    y_pred : np.ndarray
        Predicted target values
        
    Returns
    -------
    dict containing R², MAE, RMSE, MAPE, MBE, MSLE, MedianAE, Explained Variance, and residual stats
    """
    # Basic regression metrics
    r2 = r2_score(y_true, y_pred)
    mae = mean_absolute_error(y_true, y_pred)
    mse = mean_squared_error(y_true, y_pred)
    rmse = np.sqrt(mse)
    explained_var = explained_variance_score(y_true, y_pred)
    
    # Mean Absolute Percentage Error
    mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1e-12))) * 100
    
    # Mean Bias Error
    mbe = np.mean(y_pred - y_true)
    
    # Mean Squared Log Error
    try:
        msle = mean_squared_error(np.log1p(np.abs(y_true)), np.log1p(np.abs(y_pred)))
    except Exception:
        msle = 0.0
    
    # Median Absolute Error
    median_ae = np.median(np.abs(y_true - y_pred))
    
    # Adjusted R²
    n = len(y_true)
    p = y_pred.shape[1] if len(y_pred.shape) > 1 else 1
    adjusted_r2 = 1 - (1 - r2) * (n - 1) / (n - p - 1) if n > p + 1 else r2
    
    # Residual statistics
    residuals = y_true - y_pred
    residual_mean = np.mean(residuals)
    residual_std = np.std(residuals)
    residual_skew = stats.skew(residuals) if len(residuals) > 2 else 0.0
    residual_kurtosis = stats.kurtosis(residuals) if len(residuals) > 2 else 0.0
    
    # Jarque-Bera test for normality
    try:
        jb_stat, jb_pvalue = stats.jarque_bera(residuals)
    except Exception:
        jb_stat, jb_pvalue = None, None
    
    # Prediction intervals (simple bootstrap approximation)
    pred_intervals = None
    try:
        from sklearn.utils import resample
        n_boot = 100
        boot_idx = np.random.randint(0, len(residuals), (n_boot, len(residuals)))
        boot_residuals = residuals[boot_idx]
        boot_std = np.std(boot_residuals, axis=1)
        ci_lower = np.percentile(boot_std, 2.5)
        ci_upper = np.percentile(boot_std, 97.5)
        pred_intervals = {
            "lower_95": float(ci_lower),
            "upper_95": float(ci_upper)
        }
    except Exception:
        pred_intervals = {"lower_95": 0.0, "upper_95": 0.0}
    
    result = {
        "r2": float(r2),
        "adjusted_r2": float(adjusted_r2),
        "rmse": float(rmse),
        "mae": float(mae),
        "mape": float(mape),
        "mbe": float(mbe),
        "msle": float(msle),
        "median_ae": float(median_ae),
        "explained_variance": float(explained_var),
        "residual_stats": {
            "mean": float(residual_mean),
            "std": float(residual_std),
            "skew": float(residual_skew),
            "kurtosis": float(residual_kurtosis),
            "jb_test_pvalue": float(jb_pvalue) if jb_pvalue is not None else None,
        },
        "prediction_intervals": pred_intervals,
    }
    
    return result


def compute_stable_features(feature_importance_history: List[Dict[str, float]], threshold: float = 0.8) -> List[str]:
    """
    Identify stable features that appear in top-K across folds.
    
    Parameters
    ----------
    feature_importance_history : List[Dict[str, float]]
        List of feature importance dicts from each fold
    threshold : float
        Minimum proportion of folds a feature must be in top 10 to be considered stable
        
    Returns
    -------
    List of stable feature names
    """
    if not feature_importance_history:
        return []
    
    # Count how many times each feature appears in top 10
    feature_counts = {}
    n_folds = len(feature_importance_history)
    
    for fi_dict in feature_importance_history:
        # Get top 10 features for this fold
        sorted_features = sorted(fi_dict.items(), key=lambda x: x[1], reverse=True)
        top_10 = [feat for feat, _ in sorted_features[:10]]
        
        for feat in top_10:
            feature_counts[feat] = feature_counts.get(feat, 0) + 1
    
    # Select features that appear in at least threshold proportion of folds
    stable_features = [
        feat for feat, count in feature_counts.items()
        if count / n_folds >= threshold
    ]
    
    return sorted(stable_features)


def model_comparison_table(models_metrics: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Create a comparison table of models sorted by primary metric.
    
    Parameters
    ----------
    models_metrics : Dict[str, Dict[str, Any]]
        Dictionary mapping model names to their metrics
        
    Returns
    -------
    List of dicts sorted by rank (best first)
    """
    comparison = []
    
    for model_name, metrics in models_metrics.items():
        # Determine primary metric based on model type
        if "accuracy" in metrics:
            primary_score = metrics["accuracy"]
            primary_metric = "accuracy"
        elif "r2" in metrics:
            primary_score = metrics["r2"]
            primary_metric = "r2"
        elif "f1" in metrics:
            primary_score = metrics["f1"]
            primary_metric = "f1"
        else:
            # Default to first available metric
            primary_score = 0.0
            primary_metric = "unknown"
            for key in ["accuracy", "r2", "f1", "auc"]:
                if key in metrics and metrics[key] is not None:
                    primary_score = metrics[key]
                    primary_metric = key
                    break
        
        comparison.append({
            "model": model_name,
            "primary_metric": primary_metric,
            "primary_score": primary_score,
            "metrics": metrics,
            "rank": 0  # Will be set after sorting
        })
    
    # Sort by primary score (descending)
    comparison.sort(key=lambda x: x["primary_score"], reverse=True)
    
    # Assign ranks
    for i, item in enumerate(comparison):
        item["rank"] = i + 1
    
    return comparison


def compute_psi(expected: pd.Series, actual: pd.Series, buckets: int = 10) -> float:
    """
    Compute Population Stability Index (PSI) for feature drift detection.
    
    Parameters
    ----------
    expected : pd.Series
        Expected distribution
    actual : pd.Series
        Actual distribution
    buckets : int
        Number of quantile buckets for binning
        
    Returns
    -------
    PSI value (higher indicates more drift)
    """
    # Handle empty or invalid data
    if len(expected) == 0 or len(actual) == 0:
        return 0.0
    
    try:
        # Create quantile bins from expected distribution
        expected_bins = np.percentile(expected, np.linspace(0, 100, buckets + 1))
        actual_bins = np.percentile(actual, np.linspace(0, 100, buckets + 1))
        
        # Ensure bins are strictly increasing
        expected_bins = np.unique(expected_bins)
        actual_bins = np.unique(actual_bins)
        
        if len(expected_bins) < 2 or len(actual_bins) < 2:
            return 0.0
        
        # Count percentages in each bin
        expected_counts = np.histogram(expected, bins=expected_bins)[0] / len(expected)
        actual_counts = np.histogram(actual, bins=expected_bins)[0] / len(actual)
        
        # Calculate PSI
        psi = 0.0
        for exp_pct, act_pct in zip(expected_counts, actual_counts):
            if exp_pct == 0 and act_pct == 0:
                continue
            if exp_pct == 0:
                exp_pct = 0.0001
            if act_pct == 0:
                act_pct = 0.0001
            
            ratio = act_pct / exp_pct
            psi += (ratio - 1) * np.log(ratio)
        
        return psi * 100  # Return as percentage
    
    except Exception:
        return 0.0


def compute_drift_report(
    features_df: pd.DataFrame,
    reference_features: Optional[pd.DataFrame] = None,
    psi_threshold: float = 0.25,
    zscore_threshold: float = 3.0,
) -> Dict[str, Any]:
    """
    Compute comprehensive drift report for feature stability monitoring.
    
    Parameters
    ----------
    features_df : pd.DataFrame
        Current features data
    reference_features : pd.DataFrame, optional
        Reference (training) features for comparison
    psi_threshold : float
        PSI threshold for drift detection
    zscore_threshold : float
        Z-score threshold for outlier detection
        
    Returns
    -------
    Dictionary with drift analysis results including:
    - feature_stability: Dict of drift scores per feature
    - problematic_features: List of features with significant drift
    - statistics: Descriptive statistics for all features
    """
    if reference_features is None:
        # If no reference, compute basic statistics
        statistics = {
            "mean": features_df.mean().to_dict(),
            "std": features_df.std().to_dict(),
            "min": features_df.min().to_dict(),
            "max": features_df.max().to_dict(),
            "count": len(features_df),
        }
        
        return {
            "feature_stability": {},
            "problematic_features": [],
            "statistics": statistics,
        }
    
    # Align data
    common_cols = list(set(features_df.columns) & set(reference_features.columns))
    if not common_cols:
        return {
            "feature_stability": {},
            "problematic_features": [],
            "statistics": {},
        }
    
    features_aligned = features_df[common_cols]
    reference_aligned = reference_features[common_cols]
    
    # Compute feature stability metrics
    feature_stability = {}
    problematic_features = []
    
    for col in common_cols:
        # Remove NaN values
        ref_series = reference_aligned[col].dropna()
        curr_series = features_aligned[col].dropna()
        
        if len(ref_series) < 10 or len(curr_series) < 10:
            continue
        
        # Compute PSI for numeric features
        if ref_series.dtype in [np.float64, np.int64]:
            psi = compute_psi(ref_series, curr_series)
            
            # Detect outliers using Z-score
            ref_mean = ref_series.mean()
            ref_std = ref_series.std()
            zscores = np.abs((curr_series - ref_mean) / (ref_std + 1e-12))
            max_zscore = zscores.max() if len(zscores) > 0 else 0
            
            # Flag problematic features
            has_drift = psi > psi_threshold
            has_outliers = max_zscore > zscore_threshold
            
            if has_drift or has_outliers:
                problematic_features.append({
                    "feature": col,
                    "psi": round(psi, 4),
                    "zscore": round(max_zscore, 4),
                    "has_drift": has_drift,
                    "has_outliers": has_outliers,
                    "ref_mean": round(ref_mean, 4),
                    "ref_std": round(ref_std, 4),
                    "current_mean": round(curr_series.mean(), 4),
                    "current_std": round(curr_series.std(), 4),
                })
            
            feature_stability[col] = {
                "psi": round(psi, 4),
                "zscore": round(max_zscore, 4),
                "ref_mean": round(ref_mean, 4),
                "ref_std": round(ref_std, 4),
                "current_mean": round(curr_series.mean(), 4),
                "current_std": round(curr_series.std(), 4),
                "has_drift": has_drift,
                "has_outliers": has_outliers,
            }
    
    # Compute overall statistics
    statistics = {
        "reference": {
            "mean": reference_aligned.mean().to_dict(),
            "std": reference_aligned.std().to_dict(),
            "count": len(reference_aligned),
        },
        "current": {
            "mean": features_aligned.mean().to_dict(),
            "std": features_aligned.std().to_dict(),
            "count": len(features_aligned),
        },
        "correlation": reference_aligned.corrwith(features_aligned).to_dict(),
    }
    
    return {
        "feature_stability": feature_stability,
        "problematic_features": problematic_features,
        "statistics": statistics,
        "drift_summary": {
            "total_features": len(common_cols),
            "drifted_features": len([f for f in problematic_features if f["has_drift"]]),
            "outlier_features": len([f for f in problematic_features if f["has_outliers"]]),
            "max_psi": max([f["psi"] for f in problematic_features] if problematic_features else [0]),
        }
    }


def calculate_prediction_intervals(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    confidence: float = 0.95,
    method: str = "residual",
) -> Dict[str, Any]:
    """
    Calculate prediction intervals for regression models.
    
    Parameters
    ----------
    y_true : np.ndarray
        True target values
    y_pred : np.ndarray
        Predicted target values
    confidence : float
        Confidence level (0.95 = 95%)
    method : str
        Method for interval calculation ('residual', 'quantile', 'bootstrap')
        
    Returns
    -------
    Dictionary with prediction intervals including:
    - lower: Lower bound
    - upper: Upper bound
    - mean_error: Mean absolute error
    - confidence_level: Confidence level used
    - method: Method used
    - residuals: Residual statistics
    """
    residuals = y_true - y_pred
    alpha = (1 - confidence) / 2
    
    if method == "residual":
        # Simple residual-based intervals
        residual_mean = np.mean(residuals)
        residual_std = np.std(residuals)
        
        lower = y_pred + residual_mean - 1.96 * residual_std
        upper = y_pred + residual_mean + 1.96 * residual_std
        
    elif method == "quantile":
        # Quantile-based intervals from residuals
        lower_quantile = np.percentile(residuals, alpha * 100)
        upper_quantile = np.percentile(residuals, (1 - alpha) * 100)
        
        lower = y_pred + lower_quantile
        upper = y_pred + upper_quantile
        
    elif method == "bootstrap":
        # Bootstrap prediction intervals
        try:
            from sklearn.utils import resample
            n_boot = min(100, len(residuals))
            boot_residuals = resample(residuals, n_samples=len(residuals), replace=True, random_state=42)
            
            lower = np.zeros_like(y_pred)
            upper = np.zeros_like(y_pred)
            
            for i in range(len(y_pred)):
                boot_pred = y_pred[i] + boot_residuals[:, i]
                lower[i] = np.percentile(boot_pred, alpha * 100)
                upper[i] = np.percentile(boot_pred, (1 - alpha) * 100)
                
        except Exception:
            # Fallback to residual method
            return calculate_prediction_intervals(y_true, y_pred, confidence, "residual")
    else:
        raise ValueError(f"Unknown method: {method}")
    
    # Compute residual statistics
    residual_stats = {
        "mean": float(np.mean(residuals)),
        "std": float(np.std(residuals)),
        "median": float(np.median(residuals)),
        "iqr": float(np.percentile(residuals, 75) - np.percentile(residuals, 25)),
        "min": float(np.min(residuals)),
        "max": float(np.max(residuals)),
        "skew": float(stats.skew(residuals) if len(residuals) > 2 else 0.0),
        "kurtosis": float(stats.kurtosis(residuals) if len(residuals) > 2 else 0.0),
    }
    
    # Compute overall interval width and coverage
    interval_width = upper - lower
    avg_width = float(np.mean(interval_width))
    max_width = float(np.max(interval_width))
    
    # Coverage (if true values available)
    coverage = None
    within_interval = np.logical_and(y_true >= lower, y_true <= upper)
    if len(within_interval) > 0:
        coverage = float(np.mean(within_interval)) * 100
    
    return {
        "lower": lower,
        "upper": upper,
        "mean_error": float(np.mean(np.abs(residuals))),
        "confidence_level": confidence,
        "method": method,
        "residuals": residual_stats,
        "interval_summary": {
            "avg_width": avg_width,
            "max_width": max_width,
            "coverage": coverage,
        }
    }