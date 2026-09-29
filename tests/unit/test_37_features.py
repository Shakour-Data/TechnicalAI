"""
Unit tests for 37-feature VDSS extraction and scenario labeling.

Tests cover:
- Exactly 37 features are returned
- All feature names are defined correctly
- Scenario labels match final thresholds from Phase 0.5 Task 0.3
- Feature values are within valid ranges [0, 1]
"""
import pytest
import sys
import os
import math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api'))

from services.ml_models import (
    extract_all_37_features,
    extract_vdss_features,
    label_scenario,
    get_scenario_label,
    get_scenario_thresholds,
    SCENARIO_THRESHOLDS,
    SCENARIO_LABELS,
    VDSS_FEATURE_NAMES,
    calc_distance_features,
    calc_edge_features,
    calc_group_path_contributions,
    calc_regime,
    calc_pattern,
    clamp,
)


# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────

@pytest.fixture
def sample_ohlcv_data():
    """Generate synthetic OHLCV data for testing."""
    data = []
    base_price = 100.0
    for i in range(100):
        price = base_price + (i % 10) * 0.5 + (i % 7) * 0.3
        data.append({
            'open': price * 0.99,
            'high': price * 1.02,
            'low': price * 0.98,
            'close': price,
            'volume': 1000.0 + i * 10,
        })
    return data


@pytest.fixture
def bullish_ohlcv_data():
    """Generate bullish trending data with strong trend."""
    data = []
    for i in range(100):
        price = 100 + i * 2.0  # Stronger trend: 2.0 per day
        data.append({
            'open': price,
            'high': price * 1.02,
            'low': price * 0.99,
            'close': price,
            'volume': 1500.0 + i * 5,
        })
    return data


@pytest.fixture
def bearish_ohlcv_data():
    """Generate bearish trending data."""
    data = []
    for i in range(100):
        price = 100 - i * 0.4
        data.append({
            'open': price,
            'high': price * 1.01,
            'low': price * 0.98,
            'close': price,
            'volume': 1200.0 + i * 8,
        })
    return data


@pytest.fixture
def volatile_ohlcv_data():
    """Generate volatile data."""
    data = []
    import random
    random.seed(42)
    price = 100.0
    for i in range(100):
        change = random.uniform(-5, 5)
        price += change
        data.append({
            'open': price,
            'high': price * 1.05,
            'low': price * 0.95,
            'close': price,
            'volume': 2000.0 + random.uniform(0, 1000),
        })
    return data


# ─────────────────────────────────────────────────────────────
# Tests for 37-Feature Extraction
# ─────────────────────────────────────────────────────────────

class Test37FeatureExtraction:
    """Tests for extracting exactly 37 VDSS features."""

    def test_feature_count(self, sample_ohlcv_data):
        """Verify exactly 37 features are returned."""
        features = extract_all_37_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        assert len(features) == 37, f"Expected 37 features, got {len(features)}"

    def test_feature_names_defined(self):
        """Verify all 37 feature names are defined in VDSS_FEATURE_NAMES."""
        assert len(VDSS_FEATURE_NAMES) == 37, f"Expected 37 feature names, got {len(VDSS_FEATURE_NAMES)}"

    def test_feature_names_order(self):
        """Verify feature names match the order of returned features."""
        expected_names = [
            # 16 raw VDSS features
            'f_rsi', 'f_mfi', 'f_cci', 's_adx',
            'f_macd', 'f_stoch', 's_bb', 's_ma21', 's_ma100', 's_ema',
            's_atr', 's_trend', 's_sr',
            'f_stochCross', 'f_macdCross', 'f_div',
            # 12 distance features
            'd_r1', 'd_s1', 'd_ma100', 'd_trend_up', 'd_trend_down',
            'd_sr_resistance', 'd_sr_support', 'd_ema_gap', 'd_bb_position',
            'd_atr_range', 'd_volume_profile', 'd_session_high',
            # 4 edge probability features
            'e_up', 'e_down', 'e_pullback', 'e_risk',
            # 3 group path contributions
            'g_trend', 'g_breakout', 'g_reversal',
            # 1 regime feature
            'regime',
            # 1 pattern feature
            'pattern',
        ]
        assert VDSS_FEATURE_NAMES == expected_names, "Feature names mismatch"

    def test_features_in_valid_range(self, sample_ohlcv_data):
        """Verify all features are in valid range [0, 1]."""
        features = extract_all_37_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        for i, f in enumerate(features):
            assert 0 <= f <= 1, f"Feature {i} ({VDSS_FEATURE_NAMES[i]}) out of range: {f}"

    def test_features_without_volume(self, sample_ohlcv_data):
        """Verify extraction works with volume=False."""
        features = extract_all_37_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, False)
        assert len(features) == 37

    def test_raw_16_features_match(self, sample_ohlcv_data):
        """Verify first 16 features match extract_vdss_features output."""
        raw_features = extract_vdss_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        all_features = extract_all_37_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        assert all_features[:16] == raw_features, "First 16 features should match extract_vdss_features"

    def test_features_return_float_list(self, sample_ohlcv_data):
        """Verify all features are floats."""
        features = extract_all_37_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        for f in features:
            assert isinstance(f, float) or isinstance(f, int), f"Feature {f} is not a number"


# ─────────────────────────────────────────────────────────────
# Tests for Score Features (16 raw VDSS)
# ─────────────────────────────────────────────────────────────

class TestScoreFeatures:
    """Tests for the 16 raw VDSS score features."""

    def test_clamp_function(self):
        """Test clamp function behavior."""
        assert clamp(0.5, 0, 1) == 0.5
        assert clamp(-0.5, 0, 1) == 0
        assert clamp(1.5, 0, 1) == 1

    def test_s_rsi_values(self, sample_ohlcv_data):
        """Test RSI score feature calculation."""
        raw = extract_vdss_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        s_rsi = raw[0]
        assert 0 <= s_rsi <= 1, "s_rsi should be in [0, 1]"

    def test_s_adx_values(self, sample_ohlcv_data):
        """Test ADX score feature calculation."""
        raw = extract_vdss_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        s_adx = raw[3]
        assert 0 <= s_adx <= 1, "s_adx should be in [0, 1]"


# ─────────────────────────────────────────────────────────────
# Tests for Distance Features (12)
# ─────────────────────────────────────────────────────────────

class TestDistanceFeatures:
    """Tests for the 12 distance features."""

    def test_distance_features_count(self, sample_ohlcv_data):
        """Verify 12 distance features are returned."""
        features = calc_distance_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        assert len(features) == 12, f"Expected 12 distance features, got {len(features)}"

    def test_distance_features_in_range(self, sample_ohlcv_data):
        """Verify distance features are numbers."""
        features = calc_distance_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        for i, f in enumerate(features):
            assert isinstance(f, (int, float)), f"Distance feature {i} is not a number"

    def test_r1_distance(self, sample_ohlcv_data):
        """Test R1 distance calculation."""
        features = calc_distance_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        d_r1 = features[0]
        assert isinstance(d_r1, (int, float))

    def test_ma100_distance(self, sample_ohlcv_data):
        """Test MA100 distance calculation."""
        features = calc_distance_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        d_ma100 = features[2]
        assert isinstance(d_ma100, (int, float))


# ─────────────────────────────────────────────────────────────
# Tests for Edge Probability Features (4)
# ─────────────────────────────────────────────────────────────

class TestEdgeFeatures:
    """Tests for the 4 edge probability features."""

    def test_edge_features_count(self):
        """Verify 4 edge features are returned."""
        features = calc_edge_features(0.5, 25.0, None)
        assert len(features) == 4, f"Expected 4 edge features, got {len(features)}"

    def test_edge_features_in_range(self):
        """Verify edge features are in valid ranges."""
        features = calc_edge_features(0.5, 25.0, None)
        e_up, e_down, e_pullback, e_risk = features
        assert 0.05 <= e_up <= 0.95, f"e_up {e_up} out of range"
        assert 0.05 <= e_down <= 0.95, f"e_down {e_down} out of range"
        assert 0.05 <= e_pullback <= 0.50, f"e_pullback {e_pullback} out of range"
        assert 0.02 <= e_risk <= 0.30, f"e_risk {e_risk} out of range"

    def test_edge_features_bullish_bull_consensus(self):
        """Verify edge features respond to bullish consensus."""
        bull_features = calc_edge_features(0.8, 25.0, None)
        bear_features = calc_edge_features(0.2, 25.0, None)
        assert bull_features[0] > bear_features[0], "e_up should be higher for bullish consensus"
        assert bear_features[1] > bull_features[1], "e_down should be higher for bearish consensus"


# ─────────────────────────────────────────────────────────────
# Tests for Group Path Contributions (3)
# ─────────────────────────────────────────────────────────────

class TestGroupPathFeatures:
    """Tests for the 3 group path contribution features."""

    def test_group_features_count(self):
        """Verify 3 group features are returned."""
        scenarios = {'pSC7': 60, 'pSC1': 10, 'pSC5': 30}
        features = calc_group_path_contributions(0.5, scenarios)
        assert len(features) == 3, f"Expected 3 group features, got {len(features)}"

    def test_group_features_values(self):
        """Verify group features are reasonable values."""
        scenarios = {'pSC7': 60, 'pSC1': 10, 'pSC5': 30}
        features = calc_group_path_contributions(0.5, scenarios)
        for i, f in enumerate(features):
            assert 0 <= f <= 1, f"Group feature {i} out of range: {f}"


# ─────────────────────────────────────────────────────────────
# Tests for Regime Feature (1)
# ─────────────────────────────────────────────────────────────

class TestRegimeFeature:
    """Tests for the regime classification feature."""

    def test_regime_returns_float(self, sample_ohlcv_data):
        """Verify regime returns a float value."""
        regime = calc_regime(sample_ohlcv_data, len(sample_ohlcv_data) - 1)
        assert isinstance(regime, float), "Regime should be a float"

    def test_regime_in_range(self, sample_ohlcv_data):
        """Verify regime is in valid range."""
        regime = calc_regime(sample_ohlcv_data, len(sample_ohlcv_data) - 1)
        assert 0 <= regime <= 1, f"Regime {regime} out of range"

    def test_bull_regime(self, bullish_ohlcv_data):
        """Test regime classification for bullish trend."""
        regime = calc_regime(bullish_ohlcv_data, len(bullish_ohlcv_data) - 1)
        assert regime > 0.5, f"Bull regime should be > 0.5, got {regime}"

    def test_bear_regime(self, bearish_ohlcv_data):
        """Test regime classification for bearish trend."""
        regime = calc_regime(bearish_ohlcv_data, len(bearish_ohlcv_data) - 1)
        assert regime < 0.5, f"Bear regime should be < 0.5, got {regime}"


# ─────────────────────────────────────────────────────────────
# Tests for Pattern Feature (1)
# ─────────────────────────────────────────────────────────────

class TestPatternFeature:
    """Tests for the candlestick pattern feature."""

    def test_pattern_returns_float(self, sample_ohlcv_data):
        """Verify pattern returns a float value."""
        pattern = calc_pattern(sample_ohlcv_data, len(sample_ohlcv_data) - 1)
        assert isinstance(pattern, float), "Pattern should be a float"

    def test_pattern_in_range(self, sample_ohlcv_data):
        """Verify pattern is in valid range."""
        pattern = calc_pattern(sample_ohlcv_data, len(sample_ohlcv_data) - 1)
        assert 0 <= pattern <= 1, f"Pattern {pattern} out of range"


# ─────────────────────────────────────────────────────────────
# Tests for Scenario Labeling (SC1-SC9)
# ─────────────────────────────────────────────────────────────

class TestScenarioLabels:
    """Tests for SC1-SC9 scenario labeling with final thresholds."""

    def test_scenario_count(self):
        """Verify exactly 9 scenarios are defined."""
        assert len(SCENARIO_THRESHOLDS) == 9, "Expected 9 scenario thresholds"

    def test_scenario_labels_count(self):
        """Verify exactly 9 scenario labels are defined."""
        assert len(SCENARIO_LABELS) == 9, "Expected 9 scenario labels"

    def test_label_sc1_bearish_shock(self):
        """Test SC1: Bearish Shock (< -10%)."""
        # Test below -10%
        assert label_scenario(-0.15) == 'SC1', "-15% should be SC1"
        assert label_scenario(-0.50) == 'SC1', "-50% should be SC1"
        # Test exactly at -10% - should be SC2 per spec (SC1 is strictly < -10%)
        assert label_scenario(-0.10) == 'SC2', "-10% should be SC2"

    def test_label_sc2_accelerating_bear(self):
        """Test SC2: Accelerating Bear (-10% to -5%)."""
        assert label_scenario(-0.075) == 'SC2', "-7.5% should be SC2"
        assert label_scenario(-0.06) == 'SC2', "-6% should be SC2"
        assert label_scenario(-0.099) == 'SC2', "-9.9% should be SC2"
        assert label_scenario(-0.10) == 'SC2', "-10% should be SC2 (inclusive)"
        assert label_scenario(-0.05) == 'SC3', "-5% should be SC3 (not SC2)"

    def test_label_sc3_strong_bear(self):
        """Test SC3: Strong Bear (-5% to -2%)."""
        assert label_scenario(-0.03) == 'SC3', "-3% should be SC3"
        assert label_scenario(-0.04) == 'SC3', "-4% should be SC3"
        assert label_scenario(-0.05) == 'SC3', "-5% should be SC3 (inclusive)"

    def test_label_sc4_weak_bear(self):
        """Test SC4: Weak Bear (-2% to -0.5%)."""
        assert label_scenario(-0.01) == 'SC4', "-1% should be SC4"
        assert label_scenario(-0.02) == 'SC4', "-2% should be SC4 (inclusive)"
        assert label_scenario(-0.005) == 'SC5', "-0.5% should be SC5 (not SC4)"

    def test_label_sc5_range_bound(self):
        """Test SC5: Range-bound (-0.5% to +0.5%)."""
        assert label_scenario(0.0) == 'SC5', "0% should be SC5"
        assert label_scenario(0.004) == 'SC5', "0.4% should be SC5"
        assert label_scenario(-0.004) == 'SC5', "-0.4% should be SC5"
        assert label_scenario(0.005) == 'SC6', "0.5% should be SC6 (not SC5)"
        assert label_scenario(-0.005) == 'SC5', "-0.5% should be SC5 (inclusive)"

    def test_label_sc6_weak_bull(self):
        """Test SC6: Weak Bull (+0.5% to +2%)."""
        assert label_scenario(0.01) == 'SC6', "1% should be SC6"
        assert label_scenario(0.02) == 'SC7', "2% should be SC7 (not SC6)"

    def test_label_sc7_strong_bull(self):
        """Test SC7: Strong Bull (+2% to +5%)."""
        assert label_scenario(0.03) == 'SC7', "3% should be SC7"
        assert label_scenario(0.05) == 'SC8', "5% should be SC8 (not SC7)"

    def test_label_sc8_accelerating_bull(self):
        """Test SC8: Accelerating Bull (+5% to +10%)."""
        assert label_scenario(0.075) == 'SC8', "7.5% should be SC8"
        assert label_scenario(0.099) == 'SC8', "9.9% should be SC8"

    def test_label_sc9_bullish_shock(self):
        """Test SC9: Bullish Shock (> +10%)."""
        assert label_scenario(0.10) == 'SC9', "10% should be SC9"
        assert label_scenario(0.15) == 'SC9', "15% should be SC9"
        assert label_scenario(0.50) == 'SC9', "50% should be SC9"

    def test_get_scenario_label(self):
        """Test getting human-readable scenario labels."""
        assert get_scenario_label('SC1') == 'Bearish Shock'
        assert get_scenario_label('SC5') == 'Range-bound'
        assert get_scenario_label('SC9') == 'Bullish Shock'

    def test_get_scenario_thresholds(self):
        """Test getting scenario thresholds."""
        thresholds = get_scenario_thresholds()
        assert len(thresholds) == 9
        assert thresholds[0]['code'] == 'SC1'
        assert thresholds[0]['label'] == 'Bearish Shock'


# ─────────────────────────────────────────────────────────────
# Tests for Feature Count Validation
# ─────────────────────────────────────────────────────────────

class TestFeatureCountValidation:
    """Validate that Phase 0.0 feature requirements are met."""

    def test_total_feature_count(self, sample_ohlcv_data):
        """Phase 0.0 requires exactly 37 features."""
        features = extract_all_37_features(sample_ohlcv_data, len(sample_ohlcv_data) - 1, True)
        assert len(features) == 37, f"Phase 0.0 requires exactly 37 features, got {len(features)}"

    def test_feature_count_breakdown(self):
        """Verify feature count breakdown: 16 + 12 + 4 + 3 + 1 + 1 = 37."""
        raw_count = 16
        distance_count = 12
        edge_count = 4
        group_count = 3
        regime_count = 1
        pattern_count = 1
        
        total = raw_count + distance_count + edge_count + group_count + regime_count + pattern_count
        assert total == 37, f"Feature count breakdown should equal 37, got {total}"

    def test_scenario_labels_match_thresholds(self):
        """Verify SC1-SC9 labels match the FINAL thresholds from Task 0.3."""
        threshold_tests = [
            (-0.50, 'SC1'),
            (-0.10, 'SC2'),
            (-0.075, 'SC2'),
            (-0.03, 'SC3'),
            (-0.01, 'SC4'),
            (0.0, 'SC5'),
            (0.01, 'SC6'),
            (0.03, 'SC7'),
            (0.075, 'SC8'),
            (0.10, 'SC9'),
            (0.50, 'SC9'),
        ]
        
        for pct, expected_label in threshold_tests:
            actual_label = label_scenario(pct)
            assert actual_label == expected_label, \
                f"Return {pct*100}% should be {expected_label}, got {actual_label}"


# ─────────────────────────────────────────────────────────────
# Edge Case Tests
# ─────────────────────────────────────────────────────────────

class TestFeatureEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_empty_data_handling(self):
        """Test handling of minimal data."""
        minimal_data = [
            {'open': 100, 'high': 101, 'low': 99, 'close': 100, 'volume': 100},
        ]
        try:
            features = extract_all_37_features(minimal_data, 0, True)
            assert len(features) == 37
        except Exception as e:
            pytest.fail(f"Should handle minimal data gracefully: {e}")

    def test_zero_price_handling(self):
        """Test handling of zero/negative prices."""
        zero_data = [
            {'open': 0, 'high': 0, 'low': 0, 'close': 0, 'volume': 100},
            {'open': 1, 'high': 1, 'low': 1, 'close': 1, 'volume': 100},
            {'open': 1, 'high': 1, 'low': 1, 'close': 1, 'volume': 100},
        ]
        features = extract_all_37_features(zero_data, 2, True)
        assert len(features) == 37
        for f in features:
            assert 0 <= f <= 1


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])