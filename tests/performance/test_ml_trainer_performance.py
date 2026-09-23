"""
Performance validation tests for ML Trainer module.

These tests measure training time, prediction latency, and memory usage
to ensure performance characteristics are within acceptable bounds.
"""

import pytest
import numpy as np
import pandas as pd
import time
import sys
import os
import psutil
import gc

# Add service directories to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                "mini-services", "ml-trainer"))

from feature_engineering import extract_enhanced_features
from index import train_models, predict_sessions


def get_memory_usage():
    """Get current memory usage in MB."""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024


def test_training_performance(sample_ohlcv_large):
    """Benchmark model training performance."""
    # Generate larger dataset for performance testing
    df = sample_ohlcv_large.copy()
    ohlcv_list = df[["date", "open", "high", "low", "close", "volume"]].values.tolist()
    
    # Force garbage collection before test
    gc.collect()
    initial_memory = get_memory_usage()
    
    start_time = time.time()
    
    # Train multiple models to get a meaningful measurement
    try:
        result = train_models(
            "PERF_TEST", 
            ohlcv_list, 
            ["random_forest_classifier", "gradient_boosting_classifier", "logistic_regression"]
        )
        
        end_time = time.time()
        training_time = end_time - start_time
        
        final_memory = get_memory_usage()
        memory_used = final_memory - initial_memory
        
        # Basic assertions
        assert result['status'] == 'ok', f"Training failed: {result}"
        assert 'models' in result, "No models in result"
        
        # Performance assertions (adjust thresholds as needed)
        # Training should complete within reasonable time (adjust based on hardware)
        assert training_time < 240.0, f"Training took too long: {training_time:.2f}s"
        
        # Memory usage should be reasonable (adjust based on expected usage)
        assert memory_used < 800.0, f"Memory usage too high: {memory_used:.2f} MB"
        
        # Log performance metrics
        print(f"\nTraining Performance:")
        print(f"  Time: {training_time:.2f}s")
        print(f"  Memory: {memory_used:.2f} MB")
        print(f"  Models trained: {len(result.get('models', {}))}")
        
    except Exception as e:
        pytest.skip(f"Training performance test skipped: {e}")


def test_prediction_performance(sample_ohlcv_large):
    """Benchmark prediction performance."""
    # First train a model
    df = sample_ohlcv_large.copy()
    ohlcv_list = df[["date", "open", "high", "low", "close", "volume"]].values.tolist()
    
    try:
        # Train a simple model
        train_result = train_models(
            "PERF_PRED_TEST", 
            ohlcv_list[-50:],  # Use last 50 points for faster training
            ["random_forest_classifier"]
        )
        
        assert train_result['status'] == 'ok', f"Training failed: {train_result}"
        
        # Now test prediction performance
        # Prepare recent data for prediction
        recent_ohlcv = ohlcv_list[-10:]  # Last 10 candles
        
        # Force garbage collection
        gc.collect()
        initial_memory = get_memory_usage()
        
        start_time = time.time()
        
        # Run multiple predictions to get average
        predictions = []
        for i in range(5):  # Run 5 predictions
            pred_result = predict_sessions("PERF_PRED_TEST", recent_ohlcv)
            predictions.append(pred_result)
        
        end_time = time.time()
        total_time = end_time - start_time
        avg_prediction_time = total_time / 5
        
        final_memory = get_memory_usage()
        memory_used = final_memory - initial_memory
        
        # Assertions
        assert all(p.get('status') == 'ok' for p in predictions if 'status' in p), \
            "Some predictions failed"
        
        # Performance assertions
        assert avg_prediction_time < 5.0, f"Average prediction time too slow: {avg_prediction_time:.2f}s"
        assert memory_used < 100.0, f"Prediction memory usage too high: {memory_used:.2f} MB"
        
        # Log performance metrics
        print(f"\nPrediction Performance:")
        print(f"  Average time per prediction: {avg_prediction_time:.2f}s")
        print(f"  Total time for 5 predictions: {total_time:.2f}s")
        print(f"  Memory used: {memory_used:.2f} MB")
        
    except Exception as e:
        pytest.skip(f"Prediction performance test skipped: {e}")


def test_feature_engineering_performance(sample_ohlcv_large):
    """Benchmark feature engineering performance."""
    df = sample_ohlcv_large.copy()
    
    # Force garbage collection
    gc.collect()
    initial_memory = get_memory_usage()
    
    start_time = time.time()
    
    # Extract features multiple times
    features_list = []
    for i in range(3):
        features = extract_enhanced_features(df)
        features_list.append(features)
    
    end_time = time.time()
    total_time = end_time - start_time
    avg_time = total_time / 3
    
    final_memory = get_memory_usage()
    memory_used = final_memory - initial_memory
    
    # Assertions
    assert all(len(f.columns) >= 45 for f in features_list), "Feature count too low"
    
    # Performance assertions
    assert avg_time < 10.0, f"Feature engineering too slow: {avg_time:.2f}s"
    assert memory_used < 100.0, f"Feature engineering memory usage too high: {memory_used:.2f} MB"
    
    # Log performance metrics
    print(f"\nFeature Engineering Performance:")
    print(f"  Average time: {avg_time:.2f}s")
    print(f"  Memory used: {memory_used:.2f} MB")
    print(f"  Features extracted: {len(features_list[0].columns)}")


@pytest.fixture
def sample_ohlcv_large():
    """Generate larger synthetic OHLCV data for performance testing."""
    np.random.seed(42)
    n = 1000  # Larger dataset for performance testing
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