"""
Evaluation metrics for ML models.

Provides comprehensive metrics for both classification and regression tasks,
including confusion matrices, per-class metrics, and stability analysis.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple, Optional
from collections import defaultdict
from sklearn.metrics import roc_auc_score


def classification_metrics(
    y_true: np.ndarray, 
    y_pred: np.ndarray, 
    y_proba: Optional[np.ndarray] = None
) -> Dict[str, Any]:
    """
    Calculate comprehensive classification metrics.
    
    Args:
        y_true: True labels
        y_pred: Predicted labels
        y_proba: Predicted probabilities (optional)
    
    Returns:
        Dict with confusion_matrix, per_class, macro_weighted_avg, 
        macro_avg, micro_avg, accuracy, classification_report
    """
    # Determine number of classes
    unique_classes = np.unique(np.concatenate([y_true, y_pred]))
    n_classes = len(unique_classes)
    
    # Confusion matrix
    cm = np.zeros((n_classes, n_classes), dtype=int)
    for t, p in zip(y_true, y_pred):
        cm[int(t), int(p)] += 1
    
    # Per-class metrics
    per_class = {}
    for i, cls in enumerate(unique_classes):
        tp = cm[i, i]
        fp = cm[:, i].sum() - tp
        fn = cm[i, :].sum() - tp
        tn = cm.sum() - tp - fp - fn
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        
        per_class[str(cls)] = {
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'support': int(cm[i].sum())
        }
    
    # Accuracy
    correct = (y_true == y_pred).sum()
    accuracy = correct / len(y_true) if len(y_true) > 0 else 0.0
    
    # Macro averages
    macro_precision = np.mean([per_class[str(cls)]['precision'] for cls in unique_classes])
    macro_recall = np.mean([per_class[str(cls)]['recall'] for cls in unique_classes])
    macro_f1 = np.mean([per_class[str(cls)]['f1'] for cls in unique_classes])
    
    macro_avg = {
        'precision': macro_precision,
        'recall': macro_recall,
        'f1': macro_f1
    }
    
    # Weighted averages
    total_support = sum(per_class[str(cls)]['support'] for cls in unique_classes)
    weighted_precision = sum(per_class[str(cls)]['precision'] * per_class[str(cls)]['support'] for cls in unique_classes) / (total_support if total_support > 0 else 1)
    weighted_recall = sum(per_class[str(cls)]['recall'] * per_class[str(cls)]['support'] for cls in unique_classes) / (total_support if total_support > 0 else 1)
    weighted_f1 = sum(per_class[str(cls)]['f1'] * per_class[str(cls)]['support'] for cls in unique_classes) / (total_support if total_support > 0 else 1)
    
    macro_weighted_avg = {
        'precision': weighted_precision,
        'recall': weighted_recall,
        'f1': weighted_f1
    }
    
    # Micro averages
    micro_precision = np.sum([cm[i, i] for i in range(n_classes)]) / cm.sum() if cm.sum() > 0 else 0.0
    micro_recall = micro_precision  # Same as accuracy for micro
    micro_f1 = micro_precision
    
    micro_avg = {
        'precision': micro_precision,
        'recall': micro_recall,
        'f1': micro_f1
    }
    
    # Classification report
    classification_report = {
        'accuracy': accuracy,
        'macro': macro_avg,
        'macro_weighted': macro_weighted_avg,
        'micro': micro_avg,
        'per_class': per_class
    }
    
    # ROC AUC if probabilities provided
    roc_auc = None
    if y_proba is not None and len(y_proba) > 0:
        try:
            if y_proba.shape[1] == 2:
                roc_auc = float(roc_auc_score(y_true, y_proba[:, 1]))
            else:
                roc_auc = float(roc_auc_score(y_true, y_proba, multi_class='ovr', average='macro'))
        except Exception:
            roc_auc = None
    
    return {
        'confusion_matrix': cm.tolist(),
        'per_class': per_class,
        'macro_weighted_avg': macro_weighted_avg,
        'macro_avg': macro_avg,
        'micro_avg': micro_avg,
        'accuracy': accuracy,
        'classification_report': classification_report,
        'roc_auc': roc_auc
    }


def regression_metrics(
    y_true: np.ndarray, 
    y_pred: np.ndarray
) -> Dict[str, Any]:
    """
    Calculate comprehensive regression metrics.
    
    Args:
        y_true: True values
        y_pred: Predicted values
    
    Returns:
        Dict with r2, adjusted_r2, rmse, mae, mape, mbe, msle, median_ae, 
        explained_variance, residual_stats, prediction_intervals
    """
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    
    # Residuals
    residuals = y_true - y_pred
    
    # MSE, RMSE
    mse = np.mean(residuals ** 2)
    rmse = np.sqrt(mse)
    
    # MAE
    mae = np.mean(np.abs(residuals))
    
    # Median AE
    median_ae = np.median(np.abs(residuals))
    
    # R²
    ss_res = np.sum(residuals ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    
    # Adjusted R²
    n = len(y_true)
    p = 1  # number of predictors
    adjusted_r2 = 1 - (1 - r2) * (n - 1) / (n - p - 1) if n > p + 1 else r2
    
    # MAPE
    nonzero_mask = y_true != 0
    mape = np.mean(np.abs(residuals[nonzero_mask] / y_true[nonzero_mask])) * 100 if nonzero_mask.sum() > 0 else 0.0
    
    # MBE (Mean Bias Error)
    mbe = np.mean(residuals)
    
    # MSLE
    msle = np.mean((np.log1p(y_pred) - np.log1p(y_true)) ** 2) if (y_pred >= 0).all() and (y_true >= 0).all() else float('inf')
    
    # Explained variance
    explained_variance = 1 - np.var(residuals) / np.var(y_true) if np.var(y_true) > 0 else 0.0
    
    # Residual statistics
    residual_stats = {
        'mean': float(np.mean(residuals)),
        'std': float(np.std(residuals)),
        'min': float(np.min(residuals)),
        'max': float(np.max(residuals)),
        'median': float(np.median(residuals))
    }
    
    # Prediction intervals (95% confidence)
    std_residual = np.std(residuals)
    prediction_intervals = {
        'lower': float(np.mean(y_pred) - 1.96 * std_residual),
        'upper': float(np.mean(y_pred) + 1.96 * std_residual),
        'confidence': 0.95
    }
    
    return {
        'r2': r2,
        'adjusted_r2': adjusted_r2,
        'rmse': rmse,
        'mae': mae,
        'mape': mape,
        'mbe': mbe,
        'msle': msle,
        'median_ae': median_ae,
        'explained_variance': explained_variance,
        'residual_stats': residual_stats,
        'prediction_intervals': prediction_intervals
    }


def compute_stable_features(
    fold_imp_history: List[Dict[str, float]], 
    threshold: float = 0.8
) -> List[str]:
    """
    Compute stable features based on feature importance across folds.
    
    Args:
        fold_imp_history: List of feature importance dicts per fold
        threshold: Stability threshold (correlation)
    
    Returns:
        List of stable feature names
    """
    if not fold_imp_history:
        return []
    
    # Get all feature names
    all_features = set()
    for fold_imp in fold_imp_history:
        all_features.update(fold_imp.keys())
    
    stable_features = []
    
    for feat in all_features:
        # Get importance values across folds
        importances = [fold_imp.get(feat, 0) for fold_imp in fold_imp_history]
        
        # Check if feature is consistently important
        mean_imp = np.mean(importances)
        if mean_imp == 0:
            continue
        
        # Stability: coefficient of variation (lower = more stable)
        std_imp = np.std(importances)
        cv = std_imp / mean_imp if mean_imp > 0 else float('inf')
        
        if cv <= (1 - threshold):
            stable_features.append(feat)
    
    return stable_features


def model_comparison_table(metrics: Dict[str, Dict[str, float]]) -> List[Dict[str, Any]]:
    """
    Create sorted model comparison table with ranks.
    
    Args:
        metrics: Dict mapping model names to metric dicts with primary score
    
    Returns:
        List of dicts with model, rank, primary_score (sorted by primary_score descending)
    """
    comparison = []
    
    for model_name, model_metrics in metrics.items():
        # Use accuracy as primary score if available, else first numeric metric
        primary_score = model_metrics.get('accuracy', 
                           model_metrics.get('r2', 
                           model_metrics.get('f1', 0)))
        
        comparison.append({
            'model': model_name,
            'rank': 0,
            'primary_score': primary_score,
            **model_metrics
        })
    
    # Sort by primary_score descending
    comparison.sort(key=lambda x: x['primary_score'], reverse=True)
    
    # Assign ranks
    for i, item in enumerate(comparison):
        item['rank'] = i + 1
    
    return comparison


def _get_feature_importance(
    model: Any, 
    feature_cols: List[str]
) -> Dict[str, float]:
    """
    Extract feature importance from trained model.
    
    Args:
        model: Trained model with feature_importances_ or coef_ attribute
        feature_cols: List of feature column names
    
    Returns:
        Dict mapping feature names to importance values
    """
    # Unwrap ModelInfo if needed
    if hasattr(model, 'model'):
        model = model.model
    
    importance = {}
    
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        for i, col in enumerate(feature_cols):
            if i < len(importances):
                importance[col] = float(importances[i])
    elif hasattr(model, 'coef_'):
        coeffs = np.abs(model.coef_)
        if len(coeffs.shape) > 1:
            coeffs = coeffs.mean(axis=0)
        for i, col in enumerate(feature_cols):
            if i < len(coeffs):
                importance[col] = float(coeffs[i])
    
    return importance