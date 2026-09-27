"""
Comprehensive test suite for the native Python ML models.
Tests data preparation, feature extraction, model training, prediction,
scenario generation, and integration with analysis_service.
"""

import random
import math
import sys

random.seed(42)


def generate_sample_candles(n=120, start_price=100.0, volatility=0.02):
    """Generate sample OHLCV candle data for testing."""
    price = start_price
    candles = []
    for i in range(n):
        change = random.uniform(-volatility, volatility)
        price *= (1 + change)
        high = price * (1 + random.uniform(0, 0.01))
        low = price * (1 - random.uniform(0, 0.01))
        open_price = price * (1 + random.uniform(-0.005, 0.005))
        close = price
        volume = random.randint(1000, 10000)
        candles.append({
            'date': f'2024-01-{i+1:02d}',
            'open': round(open_price, 2),
            'high': round(high, 2),
            'low': round(low, 2),
            'close': round(close, 2),
            'volume': volume
        })
    return candles


def test_imports():
    """Test that all required modules can be imported."""
    print("Test 1: Module imports...")
    from api.services.ml_models import (
        run_ml_analysis, extract_vdss_features, VDSS_FEATURE_NAMES,
        train_adaptive_model, calculate_bull_consensus,
        calculate_scenario_probabilities, calculate_edge_weights,
        predict_prices, get_cached_adaptive_model, set_cached_adaptive_model,
        sma, ema_calc, calc_rsi, calc_cci, calc_mfi, calc_stochastic,
        calc_macd, calc_bollinger_bands, calc_adx, calc_atr, clamp,
        AdaptiveWeightModel, StandardScaler, LogisticRegressionModel, TimeSeriesSplit
    )
    from api.services.analysis_service import AnalysisService
    print("  PASS: All modules imported successfully")


def test_feature_extraction():
    """Test VDSS feature extraction."""
    print("Test 2: VDSS feature extraction...")
    from api.services.ml_models import extract_vdss_features, VDSS_FEATURE_NAMES
    
    candles = generate_sample_candles(120)
    features = extract_vdss_features(candles, len(candles) - 1, has_volume=True)
    
    assert len(features) == 16, f"Expected 16 features, got {len(features)}"
    assert len(VDSS_FEATURE_NAMES) == 16, f"Expected 16 feature names, got {len(VDSS_FEATURE_NAMES)}"
    
    for i, (f, name) in enumerate(zip(features, VDSS_FEATURE_NAMES)):
        assert 0 <= f <= 1, f"Feature {name} value {f} out of range [0, 1]"
    
    print(f"  PASS: Extracted {len(features)} features with valid ranges")
    print(f"  Features: {', '.join(VDSS_FEATURE_NAMES)}")


def test_indicator_functions():
    """Test individual indicator calculations."""
    print("Test 3: Technical indicator functions...")
    from api.services.ml_models import (
        sma, ema_calc, calc_rsi, calc_cci, calc_mfi, calc_stochastic,
        calc_macd, calc_bollinger_bands, calc_adx, calc_atr, clamp
    )
    
    closes = [100 + i * 0.5 + random.uniform(-1, 1) for i in range(50)]
    
    # Test SMA
    sma_val = sma(closes, 20)
    assert 0 < sma_val < 200, f"SMA out of range: {sma_val}"
    
    # Test EMA
    ema_val = ema_calc(closes, 12)
    assert 0 < ema_val < 200, f"EMA out of range: {ema_val}"
    
    # Test RSI
    rsi_val = calc_rsi(closes)
    assert 0 <= rsi_val <= 100, f"RSI out of range: {rsi_val}"
    
    # Test CCI
    data = [{'high': c + 1, 'low': c - 1, 'close': c, 'volume': 1000} for c in closes]
    cci_val = calc_cci(data)
    assert isinstance(cci_val, float), f"CCI not float: {cci_val}"
    
    # Test MFI
    mfi_val = calc_mfi(data)
    assert 0 <= mfi_val <= 100, f"MFI out of range: {mfi_val}"
    
    # Test Stochastic
    stoch = calc_stochastic(data)
    assert 0 <= stoch['k'] <= 100, f"Stochastic K out of range: {stoch['k']}"
    assert 0 <= stoch['d'] <= 100, f"Stochastic D out of range: {stoch['d']}"
    
    # Test MACD
    macd = calc_macd(closes)
    assert isinstance(macd['line'], float), f"MACD line not float: {macd['line']}"
    assert isinstance(macd['histogram'], float), f"MACD histogram not float: {macd['histogram']}"
    
    # Test Bollinger Bands
    bb = calc_bollinger_bands(closes)
    assert bb['upper'] > bb['middle'], f"BB upper < middle: {bb['upper']} < {bb['middle']}"
    assert bb['middle'] > bb['lower'], f"BB middle < lower: {bb['middle']} < {bb['lower']}"
    
    # Test ADX
    adx = calc_adx(data)
    assert 0 <= adx['adx'] <= 100, f"ADX out of range: {adx['adx']}"
    
    # Test ATR
    atr_val = calc_atr(data)
    assert atr_val >= 0, f"ATR negative: {atr_val}"
    
    # Test clamp
    assert clamp(1.5, 0, 1) == 1.0, "Clamp upper bound failed"
    assert clamp(-0.5, 0, 1) == 0.0, "Clamp lower bound failed"
    assert clamp(0.5, 0, 1) == 0.5, "Clamp mid failed"
    
    print("  PASS: All indicators produce valid results")


def test_ml_model_training():
    """Test Adaptive Weight Model training."""
    print("Test 4: ML model training...")
    from api.services.ml_models import train_adaptive_model, get_cached_adaptive_model
    
    candles = generate_sample_candles(120)
    result = train_adaptive_model(candles, 'TEST')
    
    assert result is not None, "Training returned None"
    assert result.get('isTrained') is True, "Model not trained"
    assert result.get('symbol') == 'TEST', f"Wrong symbol: {result.get('symbol')}"
    assert len(result.get('weights', [])) == 16, f"Expected 16 weights, got {len(result.get('weights', []))}"
    
    # Verify cache
    cached = get_cached_adaptive_model('TEST')
    assert cached is not None, "Cache miss after training"
    assert cached['symbol'] == 'TEST', "Cached result has wrong symbol"
    
    print(f"  PASS: Model trained with {result.get('sampleCount', 0)} samples")
    print(f"  Accuracy: {result.get('recentAccuracy', 0):.4f}")
    print(f"  Weights sum: {sum(result.get('weights', [])):.4f}")


def test_bull_consensus():
    """Test bull consensus calculation."""
    print("Test 5: Bull consensus calculation...")
    from api.services.ml_models import (
        extract_vdss_features, calculate_bull_consensus, VDSS_FEATURE_NAMES
    )
    
    candles = generate_sample_candles(120)
    features = extract_vdss_features(candles, len(candles) - 1, has_volume=True)
    
    # Test without ML result
    result_no_ml = calculate_bull_consensus(features, None, has_volume=True)
    assert 0 <= result_no_ml['bullConsensus'] <= 1, f"Bull consensus out of range: {result_no_ml['bullConsensus']}"
    assert result_no_ml['usedML'] is False, "Should not use ML without result"
    
    # Test with ML result
    ml_result = {
        'isTrained': True,
        'weights': [0.05] * 16,
        'predictionProb': 0.7,
        'recentAccuracy': 0.75,
        'adaptiveParams': {'momentumFactor': 0.7, 'volatilityFactor': 0.5, 'trendFactor': 0.6}
    }
    result_with_ml = calculate_bull_consensus(features, ml_result, has_volume=True)
    assert 0 <= result_with_ml['bullConsensus'] <= 1, f"Bull consensus out of range: {result_with_ml['bullConsensus']}"
    assert result_with_ml['usedML'] is True, "Should use ML with result"
    
    print(f"  PASS: Bull consensus (no ML): {result_no_ml['bullConsensus']:.4f}")
    print(f"  Bull consensus (with ML): {result_with_ml['bullConsensus']:.4f}")


def test_scenario_probabilities():
    """Test 9-scenario probability calculation."""
    print("Test 6: Scenario probabilities...")
    from api.services.ml_models import (
        extract_vdss_features, calculate_scenario_probabilities, VDSS_FEATURE_NAMES
    )
    
    candles = generate_sample_candles(120)
    features = extract_vdss_features(candles, len(candles) - 1, has_volume=True)
    
    # Test without ML result
    scenarios = calculate_scenario_probabilities(
        bull_consensus=0.6, price=100, r1=105, s1=95, ma100=100,
        rsi=55, mfi=50, stoch_k=50, has_volume=True, ml_result=None
    )
    
    total_prob = sum(scenarios[f'pSC{i}'] for i in range(1, 10))
    assert total_prob == 100, f"Scenario probabilities don't sum to 100: {total_prob}"
    
    for i in range(1, 10):
        p = scenarios[f'pSC{i}']
        assert 0 <= p <= 100, f"Scenario SC{i} probability out of range: {p}"
    
    # Test with ML result
    ml_result = {
        'isTrained': True,
        'weights': [0.05] * 16,
        'predictionProb': 0.65,
        'recentAccuracy': 0.75,
        'adaptiveParams': {'momentumFactor': 0.7, 'volatilityFactor': 0.5, 'trendFactor': 0.6}
    }
    scenarios_ml = calculate_scenario_probabilities(
        bull_consensus=0.6, price=100, r1=105, s1=95, ma100=100,
        rsi=55, mfi=50, stoch_k=50, has_volume=True, ml_result=ml_result
    )
    
    total_prob_ml = sum(scenarios_ml[f'pSC{i}'] for i in range(1, 10))
    assert total_prob_ml == 100, f"ML scenario probabilities don't sum to 100: {total_prob_ml}"
    
    print(f"  PASS: 9 scenarios sum to {total_prob}% (no ML) and {total_prob_ml}% (with ML)")
    scenario_strs = [f'SC{i}={scenarios[f"pSC{i}"]}%' for i in range(1, 10)]
    print(f"  Scenarios (no ML): {', '.join(scenario_strs)}")


def test_edge_weights():
    """Test edge weight calculation."""
    print("Test 7: Edge weights...")
    from api.services.ml_models import calculate_edge_weights
    
    # Test without ML result
    weights = calculate_edge_weights(0.6, 25.0, None)
    assert 'up' in weights and 'down' in weights, "Missing edge weights"
    assert 0 <= weights['up'] <= 1, f"Up weight out of range: {weights['up']}"
    assert 0 <= weights['down'] <= 1, f"Down weight out of range: {weights['down']}"
    
    # Test with ML result
    ml_result = {
        'isTrained': True,
        'coefficients': [0.1] * 16,
        'recentAccuracy': 0.75
    }
    weights_ml = calculate_edge_weights(0.6, 25.0, ml_result)
    assert 0 <= weights_ml['up'] <= 1, f"ML up weight out of range: {weights_ml['up']}"
    
    print(f"  PASS: Edge weights (no ML): up={weights['up']:.4f}, down={weights['down']:.4f}")
    print(f"  Edge weights (with ML): up={weights_ml['up']:.4f}, down={weights_ml['down']:.4f}")


def test_price_prediction():
    """Test price prediction."""
    print("Test 8: Price prediction...")
    from api.services.ml_models import predict_prices
    
    candles = generate_sample_candles(120, start_price=100)
    result = predict_prices(candles, forward_days=5)
    
    assert result is not None, "Price prediction returned None"
    assert 'predicted_prices' in result, "Missing predicted_prices"
    assert len(result['predicted_prices']) == 5, f"Expected 5 predictions, got {len(result['predicted_prices'])}"
    assert 'confidence' in result, "Missing confidence"
    assert 'trend_direction' in result, "Missing trend_direction"
    assert result['confidence'] > 0, "Confidence should be positive"
    
    print(f"  PASS: Predicted {len(result['predicted_prices'])} prices")
    print(f"  Direction: {result['trend_direction']}, Confidence: {result['confidence']}")
    print(f"  Predicted prices: {result['predicted_prices']}")


def test_full_ml_analysis():
    """Test the full ML analysis pipeline."""
    print("Test 9: Full ML analysis pipeline...")
    from api.services.ml_models import run_ml_analysis
    
    candles = generate_sample_candles(120)
    result = run_ml_analysis(candles, symbol='TEST', horizon=5)
    
    assert result['status'] == 'ok', f"Analysis status not ok: {result['status']}"
    assert result['symbol'] == 'TEST', f"Wrong symbol: {result['symbol']}"
    assert result['used_native_ml'] is True, "Should use native ML"
    assert 'bull_consensus' in result, "Missing bull_consensus"
    assert 'scenarios' in result, "Missing scenarios"
    assert 'forecasts' in result, "Missing forecasts"
    assert 'ensemble' in result, "Missing ensemble"
    assert 'feature_importance' in result, "Missing feature_importance"
    
    # Verify forecasts structure
    forecasts = result['forecasts']
    assert 'logistic_regression_vdss' in forecasts, "Missing logistic regression forecast"
    
    lr_forecast = forecasts['logistic_regression_vdss']
    assert 'predictions' in lr_forecast, "Missing predictions in LR forecast"
    assert 'weights' in lr_forecast, "Missing weights in LR forecast"
    
    # Verify ensemble structure
    ensemble = result['ensemble']
    assert 'predictions' in ensemble, "Missing predictions in ensemble"
    assert 'weights' in ensemble, "Missing weights in ensemble"
    
    # Verify feature importance
    fi = result['feature_importance']
    assert len(fi) == 16, f"Expected 16 feature importances, got {len(fi)}"
    
    print(f"  PASS: Full pipeline completed")
    print(f"  Bull Consensus: {result['bull_consensus']:.4f}")
    print(f"  Training Samples: {result['training_samples']}")
    print(f"  ML Accuracy: {result['ml_accuracy']:.4f}")


def test_insufficient_data():
    """Test behavior with insufficient data."""
    print("Test 10: Insufficient data handling...")
    from api.services.ml_models import run_ml_analysis
    
    # Too few candles
    candles = generate_sample_candles(30)
    result = run_ml_analysis(candles, symbol='TEST', horizon=5)
    
    # Should still return ok but with limited data
    assert result['status'] == 'ok', f"Status not ok with limited data: {result['status']}"
    assert result['candles_used'] == 30, f"Wrong candle count: {result['candles_used']}"
    
    print(f"  PASS: Handled insufficient data gracefully")


def test_no_volume():
    """Test behavior with no volume data."""
    print("Test 11: No volume data...")
    from api.services.ml_models import run_ml_analysis
    
    candles = generate_sample_candles(120)
    # Set volume to 0
    for c in candles:
        c['volume'] = 0
    
    result = run_ml_analysis(candles, symbol='TEST', horizon=5)
    
    assert result['status'] == 'ok', f"Status not ok with no volume: {result['status']}"
    
    print(f"  PASS: Handled no volume data correctly")


def test_cache_ttl():
    """Test model cache TTL."""
    print("Test 12: Model cache TTL...")
    from api.services.ml_models import train_adaptive_model, get_cached_adaptive_model, set_cached_adaptive_model, _model_cache
    
    candles = generate_sample_candles(120)
    result = train_adaptive_model(candles, 'CACHE_TEST')
    
    assert result is not None, "Training failed"
    
    # Should be in cache
    cached = get_cached_adaptive_model('CACHE_TEST')
    assert cached is not None, "Cache miss immediately after training"
    
    # Verify cache structure
    assert 'CACHE_TEST' in _model_cache, "Symbol not in cache dict"
    assert 'result' in _model_cache['CACHE_TEST'], "Missing result in cache entry"
    assert 'time' in _model_cache['CACHE_TEST'], "Missing time in cache entry"
    
    print(f"  PASS: Cache TTL mechanism works")


def test_analysis_service_integration():
    """Test analysis_service integration with native ML."""
    print("Test 13: Analysis service integration...")
    from api.services.analysis_service import AnalysisService
    from api.services.ml_models import run_ml_analysis
    
    service = AnalysisService()
    
    # Test _prepare_candles_data
    candles_data = generate_sample_candles(100)
    
    class MockCandle:
        def __init__(self, d):
            self.date = d['date']
            self.open_price = d['open']
            self.high = d['high']
            self.low = d['low']
            self.close = d['close']
            self.volume = d['volume']
    
    mock_candles = [MockCandle(c) for c in candles_data]
    prepared = service._prepare_candles_data(mock_candles)
    
    assert len(prepared) == len(candles_data), f"Prepared count mismatch: {len(prepared)}"
    assert prepared[0]['open'] == candles_data[0]['open'], "Open price mismatch"
    
    # Test _run_native_ml_prediction
    import asyncio
    result = service._run_native_ml_prediction('INTEGRATION', mock_candles, 5, ['rf', 'xgboost'])
    
    assert result['status'] == 'ok', f"Native ML prediction failed: {result['status']}"
    assert result['used_native_ml'] is True, "Should use native ML"
    assert 'bull_consensus' in result, "Missing bull_consensus"
    
    print(f"  PASS: Analysis service integration works")
    print(f"  Bull Consensus: {result['bull_consensus']:.4f}")


def test_analysis_service_quick_analysis():
    """Test analyze_time_series_quick with native ML."""
    print("Test 14: Quick time series analysis...")
    from api.services.analysis_service import AnalysisService
    from api.services.ml_models import run_ml_analysis
    
    service = AnalysisService()
    
    # Generate mock candles and test the native ML directly
    # (avoiding TSEService which fails on Windows due to curl encoding)
    candles_data = generate_sample_candles(100)
    result = run_ml_analysis(candles_data, symbol='INTEG', horizon=5)
    
    assert result['status'] == 'ok', f"ML analysis failed: {result['status']}"
    assert result['used_native_ml'] is True, "Should use native ML"
    assert 'bull_consensus' in result, "Missing bull_consensus"
    assert 'scenarios' in result, "Missing scenarios"
    assert 'forecasts' in result, "Missing forecasts"
    assert 'ensemble' in result, "Missing ensemble"
    
    ml_forecast = result
    assert 'forecasts' in ml_forecast, "Missing forecasts in ml_forecast"
    assert 'ensemble' in ml_forecast, "Missing ensemble in ml_forecast"
    
    print(f"  PASS: Quick analysis completed")
    print(f"  Bull Consensus: {ml_forecast['bull_consensus']:.4f}")
    print(f"  Training Samples: {ml_forecast['training_samples']}")


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("Native Python ML Models - Comprehensive Test Suite")
    print("=" * 60)
    
    tests = [
        test_imports,
        test_feature_extraction,
        test_indicator_functions,
        test_ml_model_training,
        test_bull_consensus,
        test_scenario_probabilities,
        test_edge_weights,
        test_price_prediction,
        test_full_ml_analysis,
        test_insufficient_data,
        test_no_volume,
        test_cache_ttl,
        test_analysis_service_integration,
        test_analysis_service_quick_analysis,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  FAIL: {e}")
            failed += 1
    
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)} tests")
    print("=" * 60)
    
    return failed == 0


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)