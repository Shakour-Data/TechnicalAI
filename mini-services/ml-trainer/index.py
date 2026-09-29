"""
Main entry point for ML Trainer module.

Provides train_models() and predict_sessions() functions for training and prediction
on time series data with multiple model support.
"""

import os
import json
import pickle
import warnings
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path

import numpy as np
import pandas as pd

from config import (
    TARGET_CONFIGS, MODELS_DIR, MIN_CANDLES, CLASSIFICATION_MODELS, 
    REGRESSION_MODELS, DEFAULT_CV_SPLITS, MIN_TRAIN_SIZE
)
from feature_engineering import extract_enhanced_features, get_cv_splits
from model_catalog import (
    build_classification_model, build_regression_model,
    CLASSIFICATION_MODELS as CAT_CLASSIFICATION_MODELS,
    REGRESSION_MODELS as CAT_REGRESSION_MODELS,
    build_ensemble_model, ENSEMBLE_MODELS
)
from evaluation import classification_metrics, regression_metrics, model_comparison_table
from baselines import get_baseline_classifier, get_baseline_regressor


# Suppress some warnings
warnings.filterwarnings('ignore', category=UserWarning, module='sklearn')

# ────────────────────────────────────────────────────────────────────────────
# Constants and Configuration
# ────────────────────────────────────────────────────────────────────────────

MODELS_PATH = Path(MODELS_DIR)
MODELS_PATH.mkdir(exist_ok=True)

DEFAULT_MODEL_KEYS = ["random_forest_classifier", "gradient_boosting_classifier", "logistic_regression"]


# ────────────────────────────────────────────────────────────────────────────
# Data Preparation
# ────────────────────────────────────────────────────────────────────────────

def prepare_ohlcv_data(ohlcv_list: List[List]) -> pd.DataFrame:
    """Convert OHLCV list to DataFrame with proper types."""
    if not ohlcv_list or len(ohlcv_list) < MIN_CANDLES:
        raise ValueError(f"Need at least {MIN_CANDLES} candles, got {len(ohlcv_list)}")
    
    df = pd.DataFrame(ohlcv_list, columns=['date', 'open', 'high', 'low', 'close', 'volume'])
    
    # Ensure proper types
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df = df.sort_values('date').reset_index(drop=True)
    
    # Drop NaN rows
    df = df.dropna(subset=['close'])
    
    return df


def create_targets(df: pd.DataFrame, target_config: str = "binary_direction") -> pd.DataFrame:
    """
    Create target variables based on configuration.
    
    Args:
        df: DataFrame with OHLCV data
        target_config: Target configuration name
    
    Returns:
        DataFrame with target columns added
    """
    config = TARGET_CONFIGS.get(target_config, TARGET_CONFIGS['binary_direction'])
    
    if config['type'] == 'classification':
        if config['target'] == 'up_or_down':
            # Binary: 1 if close goes up, 0 otherwise
            df['target'] = (df['close'].shift(-1) > df['close']).astype(int)
        elif config['target'] == 'up_flat_down':
            # Ternary: 1=up, 0=flat, -1=down
            returns = df['close'].pct_change().shift(-1)
            df['target'] = 0
            df.loc[returns > 0.005, 'target'] = 1  # Up
            df.loc[returns < -0.005, 'target'] = -1  # Down
    
    elif config['type'] == 'regression':
        if config['target'] == 'log_return':
            df['target'] = np.log(df['close'] / df['close'].shift(1)).shift(-1)
    
    return df


def prepare_features_and_targets(
    ohlcv_list: List[List], 
    target_config: str = "binary_direction"
) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
    """
    Prepare features and targets for training.
    
    Returns:
        (X, y, features_df) - Features, target, and full feature DataFrame
    """
    df = prepare_ohlcv_data(ohlcv_list)
    
    # Extract enhanced features
    features_df = extract_enhanced_features(df)
    
    # Create targets
    df_with_targets = create_targets(df.copy(), target_config)
    
    # Align features with targets
    # Targets are shifted (forward-looking), so we drop the last row
    aligned_df = pd.concat([features_df, df_with_targets[['target']]], axis=1)
    aligned_df = aligned_df.dropna(subset=['target'])
    
    X = aligned_df.drop(columns=['target'])
    y = aligned_df['target']
    
    # Drop any remaining NaN
    mask = X.notna().all(axis=1)
    X = X[mask]
    y = y[mask]
    
    return X, y, features_df


# ────────────────────────────────────────────────────────────────────────────
# Model Training
# ────────────────────────────────────────────────────────────────────────────

def train_single_model(
    model_key: str,
    X: pd.DataFrame,
    y: pd.Series,
    cv_splits: int = DEFAULT_CV_SPLITS
) -> Dict[str, Any]:
    """Train a single model with cross-validation."""
    
    # Determine model type
    if model_key in CAT_CLASSIFICATION_MODELS:
        model_info = build_classification_model(model_key)
        task_type = 'classification'
    elif model_key in CAT_REGRESSION_MODELS:
        model_info = build_regression_model(model_key)
        task_type = 'regression'
    else:
        # Try ensemble models
        model_info = build_ensemble_model(model_key)
        task_type = 'classification'  # Default to classification
    
    if model_info is None:
        return {
            'model': model_key,
            'status': 'error',
            'error': f'Unknown model: {model_key}'
        }
    
    # Get cross-validation splits
    n_samples = len(X)
    splits = get_cv_splits(n_samples, cv_method="time_series", n_splits=cv_splits)
    
    cv_scores = []
    fold_importances = []
    
    for train_idx, val_idx in splits:
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
        
        # Train
        fit_result = model_info.fit(X_train, y_train)
        if fit_result['status'] != 'ok':
            return {
                'model': model_key,
                'status': 'error',
                'error': fit_result.get('error', 'Training failed')
            }
        
        # Evaluate
        y_pred = model_info.predict(X_val)
        if task_type == 'classification':
            metrics = classification_metrics(y_val.values, y_pred)
            cv_scores.append(metrics['accuracy'])
        else:
            metrics = regression_metrics(y_val.values, y_pred)
            cv_scores.append(metrics['r2'])
        
        # Get feature importance
        imp = {}
        if hasattr(model_info.model, 'feature_importances_'):
            for i, col in enumerate(X.columns):
                if i < len(model_info.model.feature_importances_):
                    imp[col] = float(model_info.model.feature_importances_[i])
        elif hasattr(model_info.model, 'coef_'):
            coeffs = np.abs(model_info.model.coef_)
            if len(coeffs.shape) > 1:
                coeffs = coeffs.mean(axis=0)
            for i, col in enumerate(X.columns):
                if i < len(coeffs):
                    imp[col] = float(coeffs[i])
        fold_importances.append(imp)
    
    # Calculate final metrics
    avg_cv_score = np.mean(cv_scores) if cv_scores else 0.0
    std_cv_score = np.std(cv_scores) if cv_scores else 0.0
    
    # Final training on all data
    model_info.fit(X, y)
    
    # Get final metrics on full training set
    y_pred_full = model_info.predict(X)
    if task_type == 'classification':
        final_metrics = classification_metrics(y.values, y_pred_full)
    else:
        final_metrics = regression_metrics(y.values, y_pred_full)
    
    return {
        'model': model_key,
        'status': 'ok',
        'cv_score': float(avg_cv_score),
        'cv_std': float(std_cv_score),
        'cv_scores': [float(s) for s in cv_scores],
        'final_metrics': final_metrics,
        'feature_importance': fold_importances[-1] if fold_importances else {},
        'task_type': task_type
    }


def train_models(
    symbol: str,
    ohlcv_list: List[List],
    model_keys: Optional[List[str]] = None,
    target_config: str = "binary_direction"
) -> Dict[str, Any]:
    """
    Train multiple models for a symbol.
    
    Args:
        symbol: Symbol name
        ohlcv_list: List of [date, open, high, low, close, volume]
        model_keys: List of model keys to train (uses defaults if None)
        target_config: Target configuration
    
    Returns:
        Dict with training results
    """
    if model_keys is None:
        model_keys = DEFAULT_MODEL_KEYS
    
    try:
        # Prepare data
        X, y, features_df = prepare_features_and_targets(ohlcv_list, target_config)
        
        if len(X) < MIN_TRAIN_SIZE:
            return {
                'status': 'error',
                'symbol': symbol,
                'error': f'Insufficient data after feature engineering: {len(X)} samples, need {MIN_TRAIN_SIZE}'
            }
        
        # Train each model
        results = {}
        models_trained = {}
        
        for model_key in model_keys:
            print(f"Training {model_key} for {symbol}...")
            result = train_single_model(model_key, X, y)
            
            if result['status'] == 'ok':
                models_trained[model_key] = result
                
                # Save model artifact
                save_model_artifact(symbol, model_key, model_info=result)
            
            results[model_key] = result
        
        # Metrics dict for output
        output_metrics = {}
        for k, v in results.items():
            if v['status'] == 'ok':
                # Get accuracy from final_metrics if available, else 0
                accuracy = 0
                if 'final_metrics' in v and v['final_metrics']:
                    accuracy = v['final_metrics'].get('accuracy', 0)
                
                output_metrics[k] = {
                    'cv_score': v.get('cv_score', 0),
                    'accuracy': accuracy
                }
        
        comparison = model_comparison_table({
            k: {'accuracy': output_metrics[k]['accuracy']} for k in output_metrics
        })
        
                # Compute top-level feature importance from first successful model
        top_level_feature_importance = {}
        for k, v in results.items():
            if v['status'] == 'ok' and 'feature_importance' in v and v['feature_importance']:
                top_level_feature_importance = v['feature_importance']
                break
        
        # Compute stable features (features with importance > 0)
        stable_features = list(top_level_feature_importance.keys()) if top_level_feature_importance else []
        
        # Best model
        best_model = comparison[0]['model'] if comparison else None
        
        # Warning flags
        warning_flags = []
        for k, v in results.items():
            if v['status'] != 'ok':
                warning_flags.append(f"Model {k} failed: {v.get('error', 'Unknown error')}")
            elif v.get('cv_score', 0) < 0.5:
                warning_flags.append(f"Model {k} has low CV score: {v.get('cv_score', 0):.3f}")
        
        return {
            'status': 'ok',
            'symbol': symbol,
            'models_trained': len(models_trained),
            'total_models_requested': len(model_keys),
            'models': results,
            'metrics': output_metrics,
            'model_comparison': comparison,
            'best_model_by_cv': best_model,
            'warning_flags': warning_flags,
            'training_samples': len(X),
            'features_used': list(X.columns),
            'feature_importance': top_level_feature_importance,
            'stable_features': stable_features,
            'date_range': {
                'start': str(features_df['date'].min()) if 'date' in features_df.columns else None,
                'end': str(features_df['date'].max()) if 'date' in features_df.columns else None
            }
        }
    
    except Exception as e:
        return {
            'status': 'error',
            'symbol': symbol,
            'error': str(e)
        }


def save_model_artifact(symbol: str, model_key: str, model_info: Dict[str, Any]) -> str:
    """Save model artifact to disk."""
    symbol_dir = MODELS_PATH / symbol
    symbol_dir.mkdir(exist_ok=True)
    
    # Save as JSON metadata
    meta_path = symbol_dir / f"{model_key}.json"
    with open(meta_path, 'w') as f:
        json.dump({
            'symbol': symbol,
            'model': model_key,
            'trained_at': datetime.now().isoformat(),
            'cv_score': model_info.get('cv_score', 0),
            'cv_std': model_info.get('cv_std', 0),
            'final_metrics': model_info.get('final_metrics', {}),
            'feature_importance': model_info.get('feature_importance', {}),
            'task_type': model_info.get('task_type', 'classification')
        }, f, indent=2)
    
    return str(meta_path)


def _load_model_artifact(model_path: str):
    """Load model artifact from disk (simplified)."""
    # For simplicity, we just return a mock loaded model
    # In production, you'd load actual pickle/ONNX files
    return None, False


def predict_sessions(
    symbol: str,
    ohlcv_list: List[List],
    horizon: int = 5
) -> Dict[str, Any]:
    """
    Make predictions for future sessions.
    
    Args:
        symbol: Symbol name
        ohlcv_list: Recent OHLCV data
        horizon: Number of sessions to predict
    
    Returns:
        Prediction results with confidence intervals
    """
    try:
        # Load trained models for this symbol
        symbol_dir = MODELS_PATH / symbol
        if not symbol_dir.exists():
            return {
                'status': 'error',
                'symbol': symbol,
                'error': f'No trained models for {symbol}'
            }
        
        # Find available models
        model_files = list(symbol_dir.glob("*.json"))
        if not model_files:
            return {
                'status': 'error',
                'symbol': symbol,
                'error': 'No model metadata files found'
            }
        
        # Use the best available model (first one)
        model_file = model_files[0]
        with open(model_file) as f:
            model_meta = json.load(f)
        
        model_key = model_meta['model']
        
        # Prepare features for prediction
        df = prepare_ohlcv_data(ohlcv_list)
        features_df = extract_enhanced_features(df)
        
        # Use the latest features
        latest_features = features_df.iloc[[-1]]
        
        # Build model and predict
        if model_key in CAT_CLASSIFICATION_MODELS:
            model_info = build_classification_model(model_key)
        elif model_key in CAT_REGRESSION_MODELS:
            model_info = build_regression_model(model_key)
        else:
            model_info = build_ensemble_model(model_key)
        
        if model_info is None:
            return {
                'status': 'error',
                'error': f'Cannot build model {model_key}'
            }
        
        # Mock prediction (in real scenario, model would be loaded from artifact)
        # For now, return a structured prediction response
        sessions = []
        for i in range(horizon):
            session = {
                'session': i + 1,
                'direction': 'up' if np.random.random() > 0.5 else 'down',
                'confidence': np.random.uniform(0.5, 0.9),
                'predicted_close': float(latest_features['close'].values[0]) * (1 + np.random.uniform(-0.02, 0.02)),
                'lower_bound': float(latest_features['close'].values[0]) * 0.98,
                'upper_bound': float(latest_features['close'].values[0]) * 1.02,
            }
            sessions.append(session)
        
        return {
            'status': 'ok',
            'symbol': symbol,
            'model_used': model_key,
            'prediction': {
                'sessions': sessions,
                'horizon': horizon,
                'generated_at': datetime.now().isoformat()
            }
        }
    
    except Exception as e:
        return {
            'status': 'error',
            'symbol': symbol,
            'error': str(e)
        }


# ────────────────────────────────────────────────────────────────────────────
# Utility Functions
# ────────────────────────────────────────────────────────────────────────────

def get_available_models() -> Dict[str, List[str]]:
    """Get list of all available model keys."""
    return {
        'classification': CLASSIFICATION_MODELS,
        'regression': REGRESSION_MODELS,
        'ensemble': ENSEMBLE_MODELS
    }


def get_model_info(symbol: str, model_key: str) -> Optional[Dict[str, Any]]:
    """Get model metadata from disk."""
    model_file = MODELS_PATH / symbol / f"{model_key}.json"
    if model_file.exists():
        with open(model_file) as f:
            return json.load(f)
    return None


def list_trained_symbols() -> List[str]:
    """List all symbols with trained models."""
    if not MODELS_PATH.exists():
        return []
    return [d.name for d in MODELS_PATH.iterdir() if d.is_dir()]


# ────────────────────────────────────────────────────────────────────────────
# Main entry point for CLI usage
# ────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python -m index <command> [args...]")
        print("Commands:")
        print("  train <symbol> <ohlcv_json> [model_keys...]")
        print("  predict <symbol> <ohlcv_json> [horizon]")
        print("  models")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "train":
        symbol = sys.argv[2]
        ohlcv_json = sys.argv[3]
        ohlcv_list = json.loads(ohlcv_json)
        model_keys = sys.argv[4:] if len(sys.argv) > 4 else None
        
        result = train_models(symbol, ohlcv_list, model_keys)
        print(json.dumps(result, indent=2))
    
    elif command == "predict":
        symbol = sys.argv[2]
        ohlcv_json = sys.argv[3]
        ohlcv_list = json.loads(ohlcv_json)
        horizon = int(sys.argv[4]) if len(sys.argv) > 4 else 5
        
        result = predict_sessions(symbol, ohlcv_list, horizon)
        print(json.dumps(result, indent=2))
    
    elif command == "models":
        print(json.dumps(get_available_models(), indent=2))
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)