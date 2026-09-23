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