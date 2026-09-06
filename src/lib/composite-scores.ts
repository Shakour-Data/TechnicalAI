// ═════════════════════════════════════════════════════════════════════════════════
// Composite Scores — Trend Strength (6 components) & SR Strength (7 components)
// ═════════════════════════════════════════════════════════════════════════════════
// Enhanced with Volume Profile (volume-profile.ts) and Regime Detection (regime-engine.ts)

import type { OHLCV, LevelStrength } from './ta-engine';
import { approximateVolumeProfile, countTouch, volumeAtLevel, type VolumeProfileResult, type TouchCountResult } from './volume-profile';
import { calculateTrendStrengthRB, type RuleBasedRegimeInput } from './regime-engine';

/**
 * Result of the 6-component trend strength composite score.
 *
 * Overall is a weighted sum of six normalized (0–1) sub-scores:
 *   - ADX Normalized      × 0.20
 *   - Slope Strength      × 0.15
 *   - MA Alignment        × 0.20
 *   - Price Position      × 0.15
 *   - Momentum Strength   × 0.15
 *   - Pullback Quality    × 0.15
 *
 * All sub-scores are clamped to [0, 1] before weighting.
 */
export interface TrendStrengthResult {
  /** Overall composite trend strength score (0–1), weighted average of all components. */
  overall: number;
  /** ADX normalized to 0–1 by dividing raw ADX by 60. Weight: 0.20. */
  adxNormalized: number;
  /** EMA10–EMA20 slope normalized by volatility. Weight: 0.15. */
  slopeStrength: number;
  /** Fraction of consecutive EMA pairs in correct order (4 pairs). Weight: 0.20. */
  maAlignment: number;
  /** How far price is from EMA50, normalized. Weight: 0.15. */
  pricePosition: number;
  /** Combined RSI deviation and MACD histogram strength. Weight: 0.15. */
  momentumStrength: number;
  /** Quality of pullback within recent range (higher = shallow pullback). Weight: 0.15. */
  pullbackQuality: number;
  /** Human-readable Farsi description of trend direction and strength. */
  description: string;
}

/**
 * Result of the 7-component support/resistance strength composite score.
 *
 * Overall is a weighted sum of seven normalized (0–1) sub-scores:
 *   - Touch Count             × 0.20
 *   - Time Validity           × 0.10
 *   - Volume Profile          × 0.15
 *   - Volatility Adjustment   × 0.10
 *   - Historical Significance × 0.15
 *   - Fibonacci Confluence    × 0.15
 *   - Pattern Support         × 0.15
 *
 * All sub-scores are clamped to [0, 1] before weighting.
 */
export interface SRStrengthResult {
  /** Overall composite S/R strength score (0–1), weighted average of all components. */
  overall: number;
  /** Number of price touches near the level, normalized by /5. Weight: 0.20. */
  touchCount: number;
  /** How long the level has been valid (bars since first touch / 180). Weight: 0.10. */
  timeValidity: number;
  /** Volume concentration at the level vs. average volume. Weight: 0.15. */
  volumeProfile: number;
  /** Inverse of ATR/price — lower volatility → higher score. Weight: 0.10. */
  volatilityAdjustment: number;
  /** Count of major highs/lows within ±1% of the level, normalized by /4. Weight: 0.15. */
  historicalSignificance: number;
  /** Number of Fibonacci levels within ATR threshold, normalized by /3. Weight: 0.15. */
  fibonacciConfluence: number;
  /** Number of detection methods that identified this level, normalized by /3. Weight: 0.15. */
  patternSupport: number;
  /** Human-readable Farsi description of level strength, touches, and Fibonacci confluences. */
  description: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ═════════════════════════════════════════════════════════════════════════════════
// TREND STRENGTH — 6 Components
// ═════════════════════════════════════════════════════════════════════════════════

/**
 * Calculate the 6-component trend strength composite score.
 *
 * Combines six normalized sub-scores into a single 0–1 composite that quantifies
 * how strong and well-structured the current trend is.
 *
 * ### Weight Breakdown
 * | Component           | Weight | Description |
 * |---------------------|--------|-------------|
 * | ADX Normalized      | 0.20   | Raw ADX divided by 60, clamped to [0,1] |
 * | Slope Strength      | 0.15   | EMA10–EMA20 slope normalized by volatility |
 * | MA Alignment        | 0.20   | Fraction of 4 consecutive EMA pairs in order |
 * | Price Position       | 0.15   | Distance of price from EMA50, normalized |
 * | Momentum Strength   | 0.15   | Average of RSI deviation and MACD strength |
 * | Pullback Quality    | 0.15   | Shallow pullback → high; deep pullback → low |
 *
 * @param data          - Array of OHLCV bars (used for pullback quality lookback of up to 20 bars)
 * @param ema10         - 10-period EMA value
 * @param ema20         - 20-period EMA value
 * @param ema50         - 50-period EMA value
 * @param ema100        - 100-period EMA value
 * @param ema200        - 200-period EMA value
 * @param rsi           - Current RSI value (0–100 scale)
 * @param macdHist      - Current MACD histogram value
 * @param macdHistStdDev - Standard deviation of MACD histogram (for normalization)
 * @param adx           - Current ADX value (typical range 0–60+)
 * @param price         - Current price
 * @returns A {@link TrendStrengthResult} with all six component scores, the weighted overall, and a Farsi description
 */
export function calcTrendStrength(
  data: OHLCV[],
  ema10: number, ema20: number, ema50: number, ema100: number, ema200: number,
  rsi: number, macdHist: number, macdHistStdDev: number, adx: number, price: number,
): TrendStrengthResult {
  // Component 1: ADX Normalized
  const adxNormalized = clamp01(adx / 60);

  // Component 2: Slope Strength
  const volatilityAdjustment = Math.max(0.001, Math.abs(ema10 * 0.02));
  const slopeRaw = (ema10 - ema20) / volatilityAdjustment;
  const slopeStrength = clamp01(Math.abs(slopeRaw) * 0.3);

  // Component 3: MA Alignment (5 EMAs: 10, 20, 50, 100, 200)
  const emas = [ema10, ema20, ema50, ema100, ema200];
  const isBullish = emas.every((v, i) => i === 0 || v <= emas[i - 1]) === false &&
    ema10 >= ema20 && ema20 >= ema50 && ema50 >= ema100 && ema100 >= ema200;
  const isBearish = ema10 <= ema20 && ema20 <= ema50 && ema50 <= ema100 && ema100 <= ema200;
  let alignmentCount = 0;
  if (isBullish || isBearish) {
    alignmentCount = 4; // all 4 comparisons correct
  } else {
    // Count how many are in order
    if (ema10 >= ema20) alignmentCount++;
    if (ema20 >= ema50) alignmentCount++;
    if (ema50 >= ema100) alignmentCount++;
    if (ema100 >= ema200) alignmentCount++;
    if (alignmentCount < 2) {
      // Check bearish alignment
      alignmentCount = 0;
      if (ema10 <= ema20) alignmentCount++;
      if (ema20 <= ema50) alignmentCount++;
      if (ema50 <= ema100) alignmentCount++;
      if (ema100 <= ema200) alignmentCount++;
    }
  }
  const maAlignment = alignmentCount / 4;

  // Component 4: Price Position relative to EMA50
  const pricePosition = clamp01(Math.abs((price - ema50) / (price + ema50)) * 2);

  // Component 5: Momentum Strength
  const rsiNormalized = clamp01(Math.abs(rsi - 50) / 30);
  const macdStrength = macdHistStdDev > 0 ? clamp01(Math.abs(macdHist) / (macdHistStdDev * 2)) : 0.5;
  const momentumStrength = (rsiNormalized + macdStrength) / 2;

  // Component 6: Pullback Quality (last 20 bars)
  let pullbackQuality = 0.5;
  const lookback = Math.min(20, data.length - 1);
  if (lookback > 5) {
    const recentHighs: number[] = [];
    for (let i = data.length - lookback; i < data.length; i++) {
      recentHighs.push(data[i].high);
    }
    const periodHigh = Math.max(...recentHighs);
    const periodLow = Math.min(...data.slice(-lookback).map(d => d.low));
    const range = periodHigh - periodLow;
    const currentFromHigh = range > 0 ? (periodHigh - price) / range : 0;
    if (currentFromHigh >= 0 && currentFromHigh <= 0.2) pullbackQuality = 0.8;
    else if (currentFromHigh > 0.2 && currentFromHigh <= 0.4) pullbackQuality = 0.6;
    else if (currentFromHigh > 0.4 && currentFromHigh <= 0.6) pullbackQuality = 0.4;
    else pullbackQuality = 0.2;
  }

  // Overall: weighted average (ADX and MA Alignment slightly favored)
  const overall = clamp01(
    adxNormalized * 0.2 + slopeStrength * 0.15 + maAlignment * 0.2 +
    pricePosition * 0.15 + momentumStrength * 0.15 + pullbackQuality * 0.15
  );

  const desc = overall > 0.7 ? 'روند قوی' : overall > 0.4 ? 'روند متوسط' : 'روند ضعیف';
  const dirDesc = price > ema50 ? 'صعودی' : 'نزولی';

  return {
    overall, adxNormalized, slopeStrength, maAlignment, pricePosition,
    momentumStrength, pullbackQuality,
    description: `روند ${dirDesc} با قدرت ${desc} (${(overall * 100).toFixed(0)}%)`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════════
// SR STRENGTH — 7 Components
// ═════════════════════════════════════════════════════════════════════════════════

/**
 * Calculate the 7-component support/resistance strength composite score.
 *
 * Evaluates how significant a price level is as support or resistance by scoring
 * seven independent factors and combining them into a single 0–1 composite.
 *
 * ### Weight Breakdown
 * | Component               | Weight | Description |
 * |-------------------------|--------|-------------|
 * | Touch Count             | 0.20   | Price touches within ATR×0.3 threshold, normalized by /5 |
 * | Time Validity           | 0.10   | Bars since first touch / 180 |
 * | Volume Profile          | 0.15   | Average volume at level vs. overall average volume |
 * | Volatility Adjustment   | 0.10   | 1 − ATR/price (lower volatility → higher score) |
 * | Historical Significance | 0.15   | Major highs/lows within ±1%, normalized by /4 |
 * | Fibonacci Confluence    | 0.15   | Fibonacci ratios within threshold, normalized by /3 |
 * | Pattern Support         | 0.15   | Number of detection methods, normalized by /3 |
 *
 * @param levelPrice    - The price of the S/R level being evaluated
 * @param levelStrength - The LevelStrength object for this level (may be undefined); used for method count (pattern support)
 * @param data          - Array of OHLCV bars (up to 100 most recent bars used)
 * @param price         - Current price
 * @param atr           - Current Average True Range value
 * @param allLevels     - All detected S/R levels (reserved for future cross-level analysis)
 * @returns A {@link SRStrengthResult} with all seven component scores, the weighted overall, and a Farsi description
 */
export function calcSRStrength(
  levelPrice: number,
  levelStrength: LevelStrength | undefined,
  data: OHLCV[],
  price: number,
  atr: number,
  allLevels: LevelStrength[],
): SRStrengthResult {
  const lookback = Math.min(100, data.length);
  const recentData = data.slice(-lookback);
  const threshold = atr * 0.3;

  // Component 1: Touch Count
  let touchCount = 0;
  for (const bar of recentData) {
    if (Math.abs(bar.high - levelPrice) < threshold || Math.abs(bar.low - levelPrice) < threshold) {
      touchCount++;
    }
  }
  const touchCountScore = clamp01(touchCount / 5);

  // Component 2: Time Validity
  const daysSinceFirstTouch = lookback; // simplified
  const timeValidity = clamp01(daysSinceFirstTouch / 180);

  // Component 3: Volume Profile
  let volumeAtLevel = 0;
  let volumeCount = 0;
  const hasVolume = data.some(d => d.volume > 0);
  if (hasVolume) {
    for (const bar of recentData) {
      if (Math.abs(bar.close - levelPrice) < threshold) {
        volumeAtLevel += bar.volume;
        volumeCount++;
      }
    }
  }
  const avgVolume = hasVolume
    ? recentData.reduce((s, d) => s + d.volume, 0) / recentData.length
    : 1;
  const avgVolumeAtLevel = volumeCount > 0 ? volumeAtLevel / volumeCount : 0;
  const volumeProfile = hasVolume ? clamp01((avgVolumeAtLevel / avgVolume - 0.5) * 2) : 0.5;

  // Component 4: Volatility Adjustment
  const volatilityAdjustment = clamp01(1 - (atr / price));

  // Component 5: Historical Significance
  let majorHighCount = 0;
  let majorLowCount = 0;
  for (const bar of recentData) {
    if (bar.high >= levelPrice * 0.99 && bar.high <= levelPrice * 1.01) majorHighCount++;
    if (bar.low >= levelPrice * 0.99 && bar.low <= levelPrice * 1.01) majorLowCount++;
  }
  const historicalSignificance = clamp01((majorHighCount + majorLowCount) / 4);

  // Component 6: Fibonacci Confluence
  let fibCount = 0;
  const fibRatios = [0.236, 0.382, 0.5, 0.618, 0.786, 1.272, 1.618];
  const recentHigh = Math.max(...recentData.map(d => d.high));
  const recentLow = Math.min(...recentData.map(d => d.low));
  const range = recentHigh - recentLow;
  for (const ratio of fibRatios) {
    const fibLevel = recentLow + range * ratio;
    if (Math.abs(fibLevel - levelPrice) < threshold) fibCount++;
  }
  const fibonacciConfluence = clamp01(fibCount / 3);

  // Component 7: Pattern Support (use methods overlap as proxy)
  const methodCount = levelStrength?.methods?.length ?? 0;
  const patternSupport = clamp01(methodCount / 3);

  // Overall: weighted average
  const overall = clamp01(
    touchCountScore * 0.2 + timeValidity * 0.1 + volumeProfile * 0.15 +
    volatilityAdjustment * 0.1 + historicalSignificance * 0.15 +
    fibonacciConfluence * 0.15 + patternSupport * 0.15
  );

  const desc = overall > 0.7 ? 'قوی' : overall > 0.4 ? 'متوسط' : 'ضعیف';

  return {
    overall, touchCount: touchCountScore, timeValidity, volumeProfile,
    volatilityAdjustment, historicalSignificance, fibonacciConfluence,
    patternSupport,
    description: `سطح ${desc} (${(overall * 100).toFixed(0)}%) با ${touchCount} برخورد و ${fibCount} تلاقی فیبوناچی`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════════
// ENHANCED SR STRENGTH with Volume Profile & Touch Count
// ═════════════════════════════════════════════════════════════════════════════════
// Uses approximateVolumeProfile (no Level-2 data needed) and countTouch
// for more accurate S/R level strength assessment.

/**
 * Extended result of the enhanced S/R strength calculation.
 *
 * Inherits all 7 base components from {@link SRStrengthResult} and augments them with
 * volume-profile-derived metrics for a more accurate strength assessment.
 *
 * The enhanced overall score blends:
 *   - 70% of the base 7-component composite
 *   - 30% of an enhancement composite, itself weighted as:
 *       - Volume Concentration Boost  × 0.40
 *       - POC Proximity Boost         × 0.30
 *       - Enhanced Touch Boost        × 0.20
 *       - Value Area Boost            × 0.10
 */
export interface EnhancedSRStrengthFullResult extends SRStrengthResult {
  /** Relative distance from the volume profile Point of Control (POC) to this level (0 = at POC). */
  volumePOCDistance: number;
  /** Whether the level price falls inside the volume profile Value Area (between valueAreaLow and valueAreaHigh). */
  inValueArea: boolean;
  /** Precise touch count result using 0.2% tolerance from {@link countTouch}. */
  enhancedTouchCount: TouchCountResult;
  /** Volume concentration at this level from the volume profile (0–1 scale). */
  volumeConcentration: number;
}

/**
 * Compute a volume profile for the given OHLCV data.
 *
 * Uses the last 60 bars and delegates to {@link approximateVolumeProfile}.
 * The result can be reused across multiple S/R level evaluations to avoid redundant computation.
 *
 * @param data    - Array of OHLCV bars (only the most recent 60 are used)
 * @param numBins - Number of volume profile bins (default: 100)
 * @returns A {@link VolumeProfileResult} containing POC, Value Area, and per-bin volumes
 */
export function computeVolumeProfile(data: OHLCV[], numBins: number = 100): VolumeProfileResult {
  const recentData = data.slice(-Math.min(60, data.length)); // 60 bars for volume profile
  return approximateVolumeProfile(recentData, numBins);
}

/**
 * Calculate enhanced S/R strength using volume profile and precise touch count.
 *
 * Builds on the base 7-component {@link calcSRStrength} and augments it with:
 *   - **Volume Profile concentration** — how much volume sits at this level
 *   - **POC proximity** — distance from the Point of Control
 *   - **Value Area membership** — whether the level is inside the high-volume zone
 *   - **Precise touch count** — using 0.2% tolerance via {@link countTouch}
 *
 * ### Blending Formula
 * The final overall score = 0.70 × baseOverall + 0.30 × enhancementScore, where:
 *   enhancementScore = volumeBoost × 0.40 + pocBoost × 0.30 + touchBoost × 0.20 + valueAreaBoost × 0.10
 *
 * @param levelPrice    - The price of the S/R level being evaluated
 * @param levelStrength - The LevelStrength object for this level (may be undefined); used for pattern support in base score
 * @param data          - Array of OHLCV bars (last 50 bars used for enhanced touch count; last 60 for volume profile)
 * @param price         - Current price
 * @param atr           - Current Average True Range value
 * @param allLevels     - All detected S/R levels (passed through to base calculation)
 * @param volumeProfile - Pre-computed volume profile result; if omitted, one is computed automatically via {@link computeVolumeProfile}
 * @returns An {@link EnhancedSRStrengthFullResult} with all base scores, volume profile metrics, and an updated Farsi description
 */
export function calcSRStrengthEnhanced(
  levelPrice: number,
  levelStrength: LevelStrength | undefined,
  data: OHLCV[],
  price: number,
  atr: number,
  allLevels: LevelStrength[],
  volumeProfile?: VolumeProfileResult,
): EnhancedSRStrengthFullResult {
  // Run original 7-component calculation
  const base = calcSRStrength(levelPrice, levelStrength, data, price, atr, allLevels);

  // Compute volume profile if not provided
  const vp = volumeProfile ?? computeVolumeProfile(data);

  // Volume Profile metrics
  const volConc = volumeAtLevel(vp, levelPrice);
  const pocDistance = vp.poc > 0 ? Math.abs(levelPrice - vp.poc) / vp.poc : 1;
  const inValueArea = levelPrice >= vp.valueAreaLow && levelPrice <= vp.valueAreaHigh;

  // Enhanced touch count with tighter tolerance (0.2% instead of ATR-based)
  const recentData = data.slice(-50);
  const enhancedTouch = countTouch(levelPrice, recentData, 0.2);

  // Combine: boost base score with volume profile and enhanced touch
  const volBoost = clamp01(volConc * 3); // concentration boost
  const pocBoost = clamp01(1 - pocDistance * 5); // proximity to POC boost
  const valueAreaBoost = inValueArea ? 0.1 : 0;
  const touchBoost = clamp01(enhancedTouch.touchCount / 8); // enhanced touch boost

  // Final enhanced overall (blend 70% base + 30% enhancements)
  const enhancedOverall = clamp01(
    base.overall * 0.7 +
    (volBoost * 0.4 + pocBoost * 0.3 + touchBoost * 0.2 + valueAreaBoost * 0.1) * 0.3
  );

  return {
    ...base,
    overall: enhancedOverall,
    description: `${base.description} | حجم: ${inValueArea ? 'داخل ناحیه ارزش' : 'خارج ناحیه'}، POC: ${(pocDistance * 100).toFixed(1)}٪`,
    volumePOCDistance: pocDistance,
    inValueArea,
    enhancedTouchCount: enhancedTouch,
    volumeConcentration: volConc,
  };
}
