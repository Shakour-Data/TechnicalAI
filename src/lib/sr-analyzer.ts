// ═══════════════════════════════════════════════════════════════════════════════
// ML-Based Support/Resistance Analyzer
// ═══════════════════════════════════════════════════════════════════════════════
// Features:
//   - ML-optimized weights (linear regression on bounce detection)
//   - Overlap scoring between levels
//   - Psychological number rounding
//   - 5-10% distance constraints (relaxed for nearest level)
//   - 6 supports + 6 resistances output
//   - Price targets for scores ≥ 7
// ═══════════════════════════════════════════════════════════════════════════════

import type { OHLCV } from './ta-engine';
import { approximateVolumeProfile, countTouch, type VolumeProfileResult } from './volume-profile';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * ML-optimized feature weights used to compute each S/R level's composite score.
 *
 * Trained via OLS regression on historical bounce detection (see `trainMLWeights`).
 * Each weight represents the relative importance of one feature in predicting
 * whether a price level will act as support/resistance.
 *
 * Weights are always non-negative, clamped to a minimum of 0.05 per feature,
 * and normalized so that `touch + volume + overlap + freshness + distance === 1`.
 *
 * @example Default weights (domain-knowledge fallback):
 * ```
 * { touch: 0.28, volume: 0.22, overlap: 0.25, freshness: 0.15, distance: 0.10 }
 * ```
 */
export interface MLWeights {
  /** Weight for `touchCount` — how many times price has touched this level (within 1%). */
  touch: number;
  /** Weight for `volumeRatio` — average volume at touches vs. overall average volume. */
  volume: number;
  /** Weight for `overlapCount` — number of other levels within 1% (confluence signal). */
  overlap: number;
  /** Weight for `freshness` — recency of last touch (0 = oldest, 1 = most recent bar). */
  freshness: number;
  /** Weight for `distancePercent` — how far the level is from the current price. */
  distance: number;
}

/**
 * A single support or resistance level with its ML-computed score and metadata.
 *
 * Produced by {@link analyzeSupportResistance} after the full pipeline:
 * discovery → feature extraction → ML scoring → distance filtering → score capping.
 *
 * Levels are classified as **targets** when their score ≥ 7.0.
 */
export interface SRLevel {
  /** Price value of the support/resistance level (psychologically rounded). */
  price: number;
  /** Composite ML score from 0 to 10 (0.5-step granularity). See {@link calculatePowerScore}. */
  score: number;
  /** Human-readable strength grade (Persian): بسیار قوی / قوی / متوسط / ضعیف / بسیار ضعیف. */
  grade: string;
  /** Number of other discovered levels within 1% of this level — indicates confluence. */
  overlapCount: number;
  /** Whether this level is a price target (score ≥ 7.0). */
  isTarget: boolean;
  /** How many bars touched this level (within 1% tolerance). */
  touchCount: number;
  /** Average volume at touches / overall average volume (capped at 5×). Enhanced by volume profile. */
  volumeRatio: number;
  /** Days (bars) since the last touch of this level. 999 for synthetic levels. */
  daysSinceLastTouch: number;
  /** Absolute distance from current price as a percentage: `|price − currentPrice| / currentPrice`. */
  distancePercent: number;
}

/**
 * Complete result of support/resistance analysis.
 *
 * Returned by {@link analyzeSupportResistance}. Contains up to 6 supports and 6 resistances,
 * the trained ML weights, and price targets (levels with score ≥ 7.0).
 */
export interface SRAnalysisResult {
  /** Support levels below current price (up to 6), sorted nearest → farthest. */
  supports: SRLevel[];
  /** Resistance levels above current price (up to 6), sorted nearest → farthest. */
  resistances: SRLevel[];
  /** The ML weights used for scoring (trained or default fallback). */
  mlWeights: MLWeights;
  /** Resistance levels with score ≥ 7.0 — potential upside price targets. */
  upwardTargets: SRLevel[];
  /** Support levels with score ≥ 7.0 — potential downside price targets. */
  downwardTargets: SRLevel[];
}

/**
 * Internal intermediate level discovered by the multi-source scanner, before ML scoring.
 *
 * `sourceCount` tracks convergence: how many of the 7 independent sources
 * (Pivot, Fibonacci, Swing, MA, BB, Recent H/L, Psychological) identified this level.
 */
interface RawLevel {
  /** Psychologically-rounded price of the discovered level. */
  price: number;
  /** Number of independent sources that identified this level (convergence score). */
  sourceCount: number;
}

/**
 * Five ML features extracted for each candidate level, used as input to the scoring model.
 *
 * These features are normalized to 0-1 during weight training and mapped to 0-10
 * sub-scores during {@link calculatePowerScore}.
 */
interface LevelFeatures {
  /** Number of bars where price touched within 1% of this level. */
  touchCount: number;
  /** Average volume at touches / overall average volume (capped at 5×). */
  volumeRatio: number;
  /** Number of other discovered levels within 1% of this level. */
  overlapCount: number;
  /** Recency of last touch: 0 = oldest bar, 1 = most recent bar. */
  freshness: number;
  /** Absolute distance from current price as a percentage: `|level − price| / price`. */
  distancePercent: number;
}

// ─── Default Weights (domain knowledge fallback) ─────────────────────────────

const DEFAULT_WEIGHTS: MLWeights = {
  touch: 0.28,
  volume: 0.22,
  overlap: 0.25,
  freshness: 0.15,
  distance: 0.10,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Psychological Number Rounding
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Round a price to the nearest "psychological" number — the round numbers that
 * traders and algorithms naturally watch as support/resistance.
 *
 * The rounding step scales with price magnitude:
 * | Price Range        | Rounding Step |
 * |--------------------|---------------|
 * | ≥ 1,000,000        | 50,000        |
 * | ≥ 500,000          | 10,000        |
 * | ≥ 100,000          | 5,000         |
 * | ≥ 50,000           | 2,000         |
 * | ≥ 10,000           | 1,000         |
 * | ≥ 5,000            | 500           |
 * | ≥ 1,000            | 100           |
 * | ≥ 500              | 50            |
 * | ≥ 100              | 10            |
 * | ≥ 10               | 5             |
 * | ≥ 1                | 1             |
 * | < 1                | 0.01          |
 *
 * @param price - The raw price to round.
 * @returns The price rounded to the nearest psychological step.
 *
 * @example
 * ```ts
 * roundToPsychological(15372)   // → 15400  (step=100)
 * roundToPsychological(482.5)   // → 500    (step=50)
 * roundToPsychological(0.0342)  // → 0.03   (step=0.01)
 * ```
 */
export function roundToPsychological(price: number): number {
  const abs = Math.abs(price);
  let step: number;
  if (abs >= 1_000_000) step = 50_000;
  else if (abs >= 500_000) step = 10_000;
  else if (abs >= 100_000) step = 5_000;
  else if (abs >= 50_000) step = 2_000;
  else if (abs >= 10_000) step = 1_000;
  else if (abs >= 5_000) step = 500;
  else if (abs >= 1_000) step = 100;
  else if (abs >= 500) step = 50;
  else if (abs >= 100) step = 10;
  else if (abs >= 10) step = 5;
  else if (abs >= 1) step = 1;
  else step = 0.01;
  return Math.round(price / step) * step;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Level Discovery (multi-source)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Identify swing highs and swing lows in the OHLCV data.
 *
 * A bar is a swing high if its `high` is strictly greater than all neighbouring bars'
 * highs within `lookback` bars on each side. Similarly for swing lows.
 *
 * @param data     - Historical OHLCV bars.
 * @param lookback - Number of bars to check on each side of a candidate.
 * @returns Arrays of swing-high and swing-low prices.
 */
function findSwingLevels(data: OHLCV[], lookback: number): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = lookback; i < data.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (data[j].high >= data[i].high) isHigh = false;
      if (data[j].low <= data[i].low) isLow = false;
    }
    if (isHigh) highs.push(data[i].high);
    if (isLow) lows.push(data[i].low);
  }
  return { highs, lows };
}

/**
 * Simple Moving Average of the last `period` values.
 *
 * @param values - Array of numeric values (typically closing prices).
 * @param period - Window size; only the last `period` values are used.
 * @returns The SMA value, or 0 if there are fewer than `period` values.
 */
function sma(values: number[], period: number): number {
  if (values.length < period) return 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Exponential Moving Average over the full array.
 *
 * Uses the standard EMA formula: `EMA_i = value_i × k + EMA_{i-1} × (1 − k)`
 * where `k = 2 / (period + 1)`.
 *
 * @param values - Array of numeric values (typically closing prices).
 * @param period - EMA period (smoothing factor).
 * @returns The final EMA value, or 0 if there are fewer than `period` values.
 */
function emaCalc(values: number[], period: number): number {
  if (values.length < period) return 0;
  const k = 2 / (period + 1);
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = values[i] * k + result * (1 - k);
  }
  return result;
}

/**
 * Calculate Bollinger Bands (20-period, 2σ) from closing prices.
 *
 * @param closes - Array of closing prices.
 * @returns Object with `upper`, `middle` (SMA-20), and `lower` band values.
 *          Returns `{ upper: 0, middle: 0, lower: 0 }` if fewer than 20 closes.
 */
function calcBB(closes: number[]): { upper: number; middle: number; lower: number } {
  const period = 20;
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0 };
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
  return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std };
}

/**
 * Discover all candidate support/resistance levels from 7 independent sources.
 *
 * **Sources:**
 * 1. **Pivot Points** — Classic pivot math (PP, R1-R3, S1-S3) from the prior bar.
 * 2. **Fibonacci Retracement** — 23.6%, 38.2%, 50%, 61.8%, 78.6% of the recent 66-bar range.
 * 3. **Swing Highs/Lows** — Local extrema at lookback periods 3, 5, 7, and 10.
 * 4. **Moving Averages** — SMA(5,10,21,50,100,200) and EMA(12,26), filtered to >1% from price.
 * 5. **Bollinger Bands** — Upper and lower bands (20-period, 2σ).
 * 6. **Recent High/Low Zones** — Rolling high and low over 5, 22, and 66 bars.
 * 7. **Psychological Round Numbers** — Round numbers at 5% intervals from 80%–125% of price.
 *
 * All discovered prices are rounded to psychological numbers (see {@link roundToPsychological}).
 * Nearby levels (within 1%) are merged and their `sourceCount` is incremented (confluence tracking).
 *
 * @param data         - Historical OHLCV bars (at least 10 required for meaningful results).
 * @param currentPrice - The current market price, used for MA/psychological filtering.
 * @returns Array of {@link RawLevel} objects with psychologically-rounded prices and source counts.
 */
function discoverAllLevels(data: OHLCV[], currentPrice: number): RawLevel[] {
  const rawMap = new Map<number, number>(); // level → sourceCount
  const closes = data.map(d => d.close);

  const addLevel = (price: number) => {
    const rounded = roundToPsychological(price);
    if (rounded <= 0) return;
    const prev = rawMap.get(rounded) ?? 0;
    // Only count as new source if it's not a 1% duplicate of existing
    let isDup = false;
    for (const key of rawMap.keys()) {
      if (Math.abs(key - rounded) / Math.max(key, 1) < 0.01) {
        rawMap.set(key, prev + 1);
        isDup = true;
        break;
      }
    }
    if (!isDup) rawMap.set(rounded, 1);
  };

  // 1. Pivot Points (5R + 5S)
  const prev = data[data.length - 2] ?? data[data.length - 1];
  if (prev) {
    const pp = (prev.high + prev.low + prev.close) / 3;
    const hl = prev.high - prev.low;
    addLevel(2 * pp - prev.low);
    addLevel(pp + hl);
    addLevel(prev.high + 2 * (pp - prev.low));
    addLevel(prev.low - 2 * (prev.high - pp));
    addLevel(pp - hl);
    addLevel(prev.low - 2 * (prev.high - pp) - hl);
  }

  // 2. Fibonacci retracement levels from recent range
  const recentHigh = Math.max(...data.slice(-66).map(d => d.high));
  const recentLow = Math.min(...data.slice(-66).map(d => d.low));
  const fibRange = recentHigh - recentLow;
  for (const mult of [0.236, 0.382, 0.5, 0.618, 0.786]) {
    addLevel(recentLow + fibRange * mult);
  }

  // 3. Swing levels (multiple lookback periods)
  for (const lb of [3, 5, 7, 10]) {
    const swings = findSwingLevels(data, lb);
 swings.highs.forEach(addLevel);
    swings.lows.forEach(addLevel);
  }

  // 4. Moving Average levels
  for (const period of [5, 10, 21, 50, 100, 200]) {
    const v = sma(closes, period);
    if (v > 0 && Math.abs(v - currentPrice) / currentPrice > 0.01) addLevel(v);
  }
  const ema12 = emaCalc(closes, 12);
  const ema26 = emaCalc(closes, 26);
  if (ema12 > 0 && Math.abs(ema12 - currentPrice) / currentPrice > 0.01) addLevel(ema12);
  if (ema26 > 0 && Math.abs(ema26 - currentPrice) / currentPrice > 0.01) addLevel(ema26);

  // 5. Bollinger Bands
  const bb = calcBB(closes);
  if (bb.upper > 0) addLevel(bb.upper);
  if (bb.lower > 0) addLevel(bb.lower);

  // 6. Recent high/low zones
  for (const window of [5, 22, 66]) {
    const slice = data.slice(-Math.min(window, data.length));
    if (slice.length > 0) {
      addLevel(Math.max(...slice.map(d => d.high)));
      addLevel(Math.min(...slice.map(d => d.low)));
    }
  }

  // 7. Psychological round numbers around current price
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, currentPrice))));
  for (let mult = 0.80; mult <= 1.25; mult += 0.05) {
    addLevel(Math.round(currentPrice * mult / magnitude) * magnitude);
  }

  return Array.from(rawMap.entries()).map(([price, sourceCount]) => ({ price, sourceCount }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Feature Extraction for Each Level
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract 5 ML features for a single candidate level.
 *
 * **Features:**
 * | Feature          | Description                                                      | Range    |
 * |------------------|------------------------------------------------------------------|----------|
 * | `touchCount`     | Bars where price came within 1% of the level                     | 0–N      |
 * | `volumeRatio`    | Avg volume at touches ÷ overall avg volume (capped at 5×)        | 0–5      |
 * | `overlapCount`   | Other levels within 1% of this level (confluence)                | 0–N      |
 * | `freshness`      | Recency of last touch: (lastTouchIndex+1) / totalBars             | 0–1      |
 * | `distancePercent`| `|level − currentPrice| / currentPrice`                            | 0–1+     |
 *
 * @param level        - The candidate level price.
 * @param allLevels    - All discovered levels (for overlap computation).
 * @param data         - Historical OHLCV bars.
 * @param currentPrice - Current market price.
 * @returns The 5 extracted features as a {@link LevelFeatures} object.
 */
function extractFeatures(
  level: number,
  allLevels: RawLevel[],
  data: OHLCV[],
  currentPrice: number,
): LevelFeatures {
  const hasVol = data.some(d => d.volume > 0);
  const avgVolume = hasVol
    ? data.slice(-50).reduce((s, d) => s + d.volume, 0) / Math.min(50, data.length)
    : 0;

  // ── Touch Count: how many times price touched within 1% of this level ──
  const touchThreshold = level * 0.01;
  let touchCount = 0;
  let lastTouchIndex = -1;
  let touchVolumeSum = 0;

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (Math.abs(d.high - level) <= touchThreshold || Math.abs(d.low - level) <= touchThreshold) {
      touchCount++;
      lastTouchIndex = i;
      if (hasVol && d.volume > 0) touchVolumeSum += d.volume;
    }
  }

  // ── Volume Ratio: avg volume at touches / overall avg volume ──
  const volumeRatio = (hasVol && touchCount > 0 && avgVolume > 0)
    ? Math.min(5, (touchVolumeSum / touchCount) / avgVolume)
    : 1.0;

  // ── Overlap Count: how many OTHER levels are within 1% of this level ──
  const overlapCount = allLevels.filter(
    other => other.price !== level && Math.abs(other.price - level) / Math.max(level, 1) < 0.01
  ).length;

  // ── Freshness: how recent was the last touch (0 = oldest, 1 = most recent) ──
  const freshness = lastTouchIndex >= 0
    ? (lastTouchIndex + 1) / data.length
    : 0.1;

  // ── Distance from current price ──
  const distancePercent = Math.abs(level - currentPrice) / currentPrice;

  return { touchCount, volumeRatio, overlapCount, freshness, distancePercent };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Simple Linear Regression (for ML weight optimization)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Train weights using OLS linear regression on bounce detection.
 * Bounce = price touched level and reversed direction within 5 candles.
 * This serves as a proxy for "success_rate" since we don't have future data.
 */
function trainMLWeights(data: OHLCV[], allLevels: RawLevel[]): MLWeights {
  const MIN_SAMPLES = 20;
  const features: number[][] = [];
  const targets: number[] = [];

  const closes = data.map(d => d.close);
  const currentPrice = closes[closes.length - 1];

  for (const level of allLevels) {
    // Only consider levels within 30% of current price
    if (Math.abs(level.price - currentPrice) / currentPrice > 0.30) continue;

    const feats = extractFeatures(level.price, allLevels, data, currentPrice);

    // Normalize features to 0-1 range for regression stability
    const normalized = [
      Math.min(1, feats.touchCount / 10),           // touch score 0-1
      Math.min(1, feats.volumeRatio / 3),            // volume score 0-1
      Math.min(1, feats.overlapCount / 5),           // overlap score 0-1
      feats.freshness,                                // already 0-1
      Math.min(1, feats.distancePercent / 0.20),     // distance score 0-1
    ];

    // Detect bounces: price touched level and reversed within 5 candles
    let bounceCount = 0;
    let touchOpportunities = 0;
    for (let i = 1; i < data.length - 5; i++) {
      const d = data[i];
      const threshold = level.price * 0.01;
      const touched = Math.abs(d.high - level.price) <= threshold || Math.abs(d.low - level.price) <= threshold;
      if (!touched) continue;

      touchOpportunities++;
      const isResistance = d.high >= level.price;
      if (isResistance) {
        // For resistance: check if next 5 candles closed lower
        const futureCloses = closes.slice(i + 1, i + 6);
        if (futureCloses.length >= 3 && futureCloses.every(c => c < d.close)) bounceCount++;
      } else {
        // For support: check if next 5 candles closed higher
        const futureCloses = closes.slice(i + 1, i + 6);
        if (futureCloses.length >= 3 && futureCloses.every(c => c > d.close)) bounceCount++;
      }
    }

    // Success rate: proportion of touches that resulted in bounces
    const successRate = touchOpportunities > 0 ? bounceCount / touchOpportunities : 0.5;

    features.push(normalized);
    targets.push(successRate);
  }

  // Need at least MIN_SAMPLES for meaningful regression
  if (features.length < MIN_SAMPLES) {
    return { ...DEFAULT_WEIGHTS };
  }

  // OLS: w = (X^T X)^-1 X^T y
  const n = features.length;
  const p = 5; // number of features

  // X^T X (p x p)
  const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  // X^T y (p x 1)
  const Xty: number[] = Array(p).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) {
        XtX[j][k] += features[i][j] * features[i][k];
      }
      Xty[j] += features[i][j] * targets[i];
    }
  }

  // Add small ridge regularization for numerical stability
  for (let j = 0; j < p; j++) {
    XtX[j][j] += 0.01;
  }

  // Solve using Gaussian elimination
  const weights = solveLinearSystem(XtX, Xty);
  if (!weights) return { ...DEFAULT_WEIGHTS };

  // Take absolute values and normalize to sum = 1
  const absWeights = weights.map(Math.abs);
  const sum = absWeights.reduce((a, b) => a + b, 0);
  if (sum === 0) return { ...DEFAULT_WEIGHTS };

  const normalized = absWeights.map(w => w / sum);

  // Ensure minimum weight of 0.05 per feature
  const clamped = normalized.map(w => Math.max(0.05, w));
  const clampSum = clamped.reduce((a, b) => a + b, 0);

  return {
    touch: clamped[0] / clampSum,
    volume: clamped[1] / clampSum,
    overlap: clamped[2] / clampSum,
    freshness: clamped[3] / clampSum,
    distance: clamped[4] / clampSum,
  };
}

/** Solve Ax = b using Gaussian elimination with partial pivoting */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Augmented matrix
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null; // Singular

    // Swap rows
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= aug[i][i];
  }

  return x;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Score Calculation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute the composite 0–10 power score for a level using ML weights.
 *
 * Each feature is first mapped to a 0–10 sub-score:
 * - `touchScore`    = min(10, 1 + touchCount × 0.8)
 * - `volumeScore`   = min(10, max(1, volumeRatio × 3.3))
 * - `overlapScore`  = min(10, overlapCount × 2)
 * - `freshnessScore`= min(10, 1 + freshness × 9)
 * - `distanceScore` = min(10, max(1, 10 − distancePercent × 30))  — closer = higher
 *
 * The raw score is the weighted sum × 10, then clamped to [0.5, 10] with 0.1 rounding.
 *
 * @param feats   - The 5 extracted features for this level.
 * @param weights - The ML-optimized (or default) feature weights.
 * @returns Composite score in [0.5, 10] with one decimal place.
 */
function calculatePowerScore(
  feats: LevelFeatures,
  weights: MLWeights,
): number {
  // Normalize individual scores to 0-10 scale
  const touchScore = Math.min(10, 1 + feats.touchCount * 0.8);
  const volumeScore = Math.min(10, Math.max(1, feats.volumeRatio * 3.3));
  const overlapScore = Math.min(10, feats.overlapCount * 2);
  const freshnessScore = Math.min(10, 1 + feats.freshness * 9);
  // Distance: closer = higher score (but not too close)
  const distanceScore = Math.min(10, Math.max(1, 10 - feats.distancePercent * 30));

  const raw = (
    weights.touch * touchScore +
    weights.volume * volumeScore +
    weights.overlap * overlapScore +
    weights.freshness * freshnessScore +
    weights.distance * distanceScore
  ) * 10;

  return Math.min(10, Math.max(0.5, Math.round(raw * 10) / 10));
}

/**
 * Map a numeric score to a Persian-language strength grade.
 *
 * | Score Range | Grade (Persian) | English Equivalent |
 * |-------------|-----------------|-------------------|
 * | ≥ 8.5       | بسیار قوی       | Very Strong       |
 * | ≥ 7.0       | قوی             | Strong            |
 * | ≥ 5.0       | متوسط           | Moderate          |
 * | ≥ 3.0       | ضعیف            | Weak              |
 * | < 3.0       | بسیار ضعیف      | Very Weak         |
 *
 * @param score - The 0–10 composite score.
 * @returns Persian grade string.
 */
function getGrade(score: number): string {
  if (score >= 8.5) return 'بسیار قوی';
  if (score >= 7.0) return 'قوی';
  if (score >= 5.0) return 'متوسط';
  if (score >= 3.0) return 'ضعیف';
  return 'بسیار ضعیف';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Distance Filtering (5-10% gap, relaxed for nearest level)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Filter and space levels according to the 5–10% distance-gap rules.
 *
 * **Rules:**
 * - **Nearest level:** can be any distance up to 10% from the current price.
 * - **Consecutive levels:** must be 5–10% apart from the previous selected level.
 *   - If a candidate is < 5% away, it is merged into the previous level
 *     (keeping the higher-score one and boosting its score by 0.5).
 *   - If a candidate is > 10% away, it is skipped entirely.
 * - **Synthetic extension:** If fewer than `targetCount` levels are found, synthetic
 *   levels are generated at 7.5% intervals (midpoint of the 5–10% range)
 *   with score 2.0 and grade "ضعیف".
 *
 * Supports are sorted descending (nearest first); resistances ascending (nearest first).
 *
 * @param levels       - Pre-scored S/R levels (all on one side of the current price).
 * @param currentPrice - The current market price.
 * @param isSupport    - `true` for supports (below price), `false` for resistances (above).
 * @param targetCount  - Desired number of output levels (typically 6).
 * @returns Filtered array of at most `targetCount` levels, properly spaced.
 */
function filterByDistance(
  levels: SRLevel[],
  currentPrice: number,
  isSupport: boolean,
  targetCount: number,
): SRLevel[] {
  if (levels.length === 0) return [];

  const MIN_GAP = 0.05;
  const MAX_GAP = 0.10;
  const FIRST_MAX_GAP = 0.10; // nearest level: up to 10% from price
  const EXTEND_GAP = 0.075;   // synthetic extension: 7.5% (middle of 5-10%)

  // Sort: supports descending (nearest first), resistances ascending (nearest first)
  const sorted = isSupport
    ? [...levels].sort((a, b) => b.price - a.price)
    : [...levels].sort((a, b) => a.price - b.price);

  const result: SRLevel[] = [];

  for (const level of sorted) {
    if (result.length === 0) {
      // First (nearest) level: must be within 10% of price
      const gap = isSupport
        ? (currentPrice - level.price) / currentPrice  // positive for support
        : (level.price - currentPrice) / currentPrice;  // positive for resistance

      if (gap <= 0) continue; // level is on wrong side of price
      if (gap > FIRST_MAX_GAP) continue; // too far from price

      result.push(level);
    } else {
      // Subsequent levels: must be 5-10% from previous level
      const prev = result[result.length - 1].price;
      const gap = Math.abs(level.price - prev) / prev;

      if (gap < MIN_GAP) {
        // Too close: merge by keeping the higher-score one and boosting its score
        const lastIdx = result.length - 1;
        if (level.score > result[lastIdx].score) {
          result[lastIdx] = {
            ...level,
            score: Math.min(10, level.score + 0.5),
            overlapCount: Math.max(result[lastIdx].overlapCount, level.overlapCount) + 1,
          };
        } else {
          result[lastIdx] = {
            ...result[lastIdx],
            score: Math.min(10, result[lastIdx].score + 0.5),
            overlapCount: result[lastIdx].overlapCount + 1,
          };
        }
      } else if (gap <= MAX_GAP) {
        result.push(level);
      }
      // gap > MAX_GAP: skip this level (too far from previous)
    }

    if (result.length >= targetCount) break;
  }

  // If not enough levels, extend with synthetic ones
  while (result.length < targetCount && result.length > 0) {
    const last = result[result.length - 1];
    const nextPrice = isSupport
      ? last.price * (1 - EXTEND_GAP)
      : last.price * (1 + EXTEND_GAP);

    if (nextPrice <= 0) break;

    const rounded = roundToPsychological(nextPrice);
    if (rounded === last.price) break; // rounding made no change

    result.push({
      price: rounded,
      score: 2.0,
      grade: 'ضعیف',
      overlapCount: 0,
      isTarget: false,
      touchCount: 0,
      volumeRatio: 1.0,
      daysSinceLastTouch: 999,
      distancePercent: Math.abs(rounded - currentPrice) / currentPrice,
    });
  }

  return result.slice(0, targetCount);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Price Target Determination (score ≥ 7)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine price targets from supports and resistances.
 *
 * A level becomes a target when its score ≥ 7.0 ("Strong" or better).
 * - **Upward targets:** resistance levels with score ≥ 7.0 (price targets on the upside).
 * - **Downward targets:** support levels with score ≥ 7.0 (price targets on the downside).
 *
 * @param supports     - Final support levels.
 * @param resistances  - Final resistance levels.
 * @returns Upward and downward target arrays with `isTarget` set to `true`.
 */
function determineTargets(
  supports: SRLevel[],
  resistances: SRLevel[],
): { upwardTargets: SRLevel[]; downwardTargets: SRLevel[] } {
  const upwardTargets = resistances
    .filter(r => r.score >= 7.0)
    .map(r => ({ ...r, isTarget: true }));

  const downwardTargets = supports
    .filter(s => s.score >= 7.0)
    .map(s => ({ ...s, isTarget: true }));

  return { upwardTargets, downwardTargets };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7.5. Score Capping (max 2 levels can have score 10)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cap the number of "perfect" scores (≥ 9.5, which rounds to 10) to at most 2 per side.
 *
 * This prevents the output from having many levels with identical maximum scores,
 * which would make it impossible for users to prioritize. The 3rd+ levels that would
 * round to 10 are capped at 9.4 and their grade is recalculated.
 *
 * @param levels - Array of scored S/R levels (mutated in place for efficiency).
 * @returns The same array with excess perfect scores capped.
 */
function capMaxPerfectScores(levels: SRLevel[]): SRLevel[] {
  const MAX_PERFECT = 2;
  const CAP_SCORE = 9.4;

  // Count how many levels already have score >= 9.5 (which rounds to 10)
  let perfectCount = 0;
  for (const level of levels) {
    if (level.score >= 9.5) perfectCount++;
  }

  // If already at most 2, nothing to do
  if (perfectCount <= MAX_PERFECT) return levels;

  // Sort by score descending to find which ones to cap
  const indexed = levels.map((l, i) => ({ level: l, idx: i }));
  indexed.sort((a, b) => b.level.score - a.level.score);

  let allowed = 0;
  for (const item of indexed) {
    if (item.level.score >= 9.5) {
      if (allowed < MAX_PERFECT) {
        allowed++;
      } else {
        // Cap this level
        item.level.score = CAP_SCORE;
        item.level.grade = getGrade(CAP_SCORE);
      }
    }
  }

  return levels;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Perform ML-based support/resistance analysis on historical OHLCV data.
 *
 * This is the main entry point for the S/R analyzer. It combines 7 independent
 * level-discovery sources, ML-optimized scoring, distance-gap filtering, and score
 * capping to produce up to 6 supports and 6 resistances with price targets.
 *
 * ## Algorithm Flow
 *
 * 1. **Discover levels** from 7 sources
 *    (Pivot Points, Fibonacci, Swing H/L, Moving Averages, Bollinger Bands,
 *    Recent H/L Zones, Psychological Round Numbers).
 *    Nearby levels (< 0.5% apart) are merged with confluence tracking.
 *
 * 2. **Compute volume profile** over the last 60 bars (80 bins) for enhanced
 *    volume scoring — no Level-2 data required.
 *
 * 3. **Train ML weights** via OLS regression on historical bounce detection.
 *    Falls back to domain-knowledge defaults if < 20 samples are available.
 *
 * 4. **Extract 5 features** per level and compute scores:
 *    - `touchCount` — bars touching within 1%
 *    - `volumeRatio` — enhanced by volume-profile concentration & value-area boost
 *    - `overlapCount` — confluence with other levels within 1%
 *    - `freshness` — recency of last touch
 *    - `distancePercent` — distance from current price
 *
 * 5. **Distance filter** — enforce 5–10% gap rules (relaxed for the nearest level):
 *    - Nearest level: up to 10% from price
 *    - Subsequent levels: 5–10% from previous level (too-close → merge, too-far → skip)
 *    - Synthetic extension at 7.5% intervals if fewer than 6 levels found
 *
 * 6. **Score cap** — at most 2 levels per side may have score ≥ 9.5 (rounds to 10);
 *    excess are capped at 9.4.
 *
 * 7. **Target selection** — levels with score ≥ 7.0 are marked as price targets
 *    (upward = resistances, downward = supports).
 *
 * @param data         - Historical OHLCV bars. Must contain at least 10 bars.
 * @param currentPrice - The current market price. Must be > 0.
 * @returns {@link SRAnalysisResult} with up to 6 supports, 6 resistances, ML weights, and targets.
 *          Returns empty arrays and default weights if input is invalid.
 *
 * @example
 * ```ts
 * const result = analyzeSupportResistance(ohlcvData, 15372.50);
 * console.log(result.supports);      // up to 6 support levels, nearest→farthest
 * console.log(result.resistances);   // up to 6 resistance levels, nearest→farthest
 * console.log(result.upwardTargets);  // resistances with score ≥ 7
 * console.log(result.mlWeights);      // trained or default weights
 * ```
 */
export function analyzeSupportResistance(
  data: OHLCV[],
  currentPrice: number,
): SRAnalysisResult {
  if (!data || data.length < 10 || currentPrice <= 0) {
    return {
      supports: [],
      resistances: [],
      mlWeights: { ...DEFAULT_WEIGHTS },
      upwardTargets: [],
      downwardTargets: [],
    };
  }

  // Step 1: Discover all potential levels from multiple sources
  const allLevels = discoverAllLevels(data, currentPrice);

  // Step 1.5: Compute volume profile for enhanced volume scoring (no Level-2 data needed)
  const volumeProfile = approximateVolumeProfile(data.slice(-60), 80);

  // Step 2: Train ML weights using bounce detection
  const mlWeights = trainMLWeights(data, allLevels);

  // Step 3: Extract features and calculate scores for each level
  // Enhanced with volume profile concentration and precise touch count
  const scoredLevels: SRLevel[] = allLevels.map(level => {
    const feats = extractFeatures(level.price, allLevels, data, currentPrice);

    // Volume profile enhancement: boost volume score using VP concentration
    const vpBin = volumeProfile.bins.find(b => level.price >= b.priceLow && level.price < b.priceHigh);
    const maxVolPct = Math.max(...volumeProfile.bins.map(b => b.volumePercent), 0.001);
    const vpConcentration = vpBin ? vpBin.volumePercent / maxVolPct : 0;
    const inValueArea = level.price >= volumeProfile.valueAreaLow && level.price <= volumeProfile.valueAreaHigh;

    // Enhanced volume ratio: blend original with VP concentration
    const enhancedVolumeRatio = feats.volumeRatio * 0.6 + (1 + vpConcentration * 2) * 0.4;
    const enhancedFeats = { ...feats, volumeRatio: inValueArea ? enhancedVolumeRatio * 1.2 : enhancedVolumeRatio };

    // Precise touch count using 0.2% tolerance (from volume-profile.ts)
    const touchResult = countTouch(level.price, data.slice(-50), 0.2);
    const enhancedTouchCount = Math.max(feats.touchCount, touchResult.touchCount);

    const score = calculatePowerScore({ ...enhancedFeats, touchCount: enhancedTouchCount }, mlWeights);
    return {
      price: level.price,
      score,
      grade: getGrade(score),
      overlapCount: feats.overlapCount,
      isTarget: false,
      touchCount: enhancedTouchCount,
      volumeRatio: enhancedFeats.volumeRatio,
      daysSinceLastTouch: Math.round((1 - feats.freshness) * data.length),
      distancePercent: feats.distancePercent,
    };
  });

  // Step 4: Separate supports and resistances
  const supports = scoredLevels.filter(l => l.price < currentPrice);
  const resistances = scoredLevels.filter(l => l.price > currentPrice);

  // Step 5: Filter by distance rules (5-10% gap, relaxed for nearest)
  const finalSupports = filterByDistance(supports, currentPrice, true, 6);
  const finalResistances = filterByDistance(resistances, currentPrice, false, 6);

  // Step 5.5: Cap max score=10 to at most 2 levels per side
  const cappedSupports = capMaxPerfectScores(finalSupports);
  const cappedResistances = capMaxPerfectScores(finalResistances);

  // Step 6: Determine price targets
  const { upwardTargets, downwardTargets } = determineTargets(cappedSupports, cappedResistances);

  // Mark targets in the final arrays
  for (const s of cappedSupports) {
    if (s.score >= 7.0) s.isTarget = true;
  }
  for (const r of cappedResistances) {
    if (r.score >= 7.0) r.isTarget = true;
  }

  return {
    supports: cappedSupports,
    resistances: cappedResistances,
    mlWeights,
    upwardTargets,
    downwardTargets,
  };
}
