// ═══════════════════════════════════════════════════════════════════════════════
// Volume Profile & Touch Count — Pure TypeScript
// Approximates Level-2 order book features using only OHLCV data
// ═══════════════════════════════════════════════════════════════════════════════
// Features:
//   - approximateVolumeProfile: histogram of volume distributed across price bins
//   - countTouch: number of times price touches a given S/R level
//   - volumeAtLevel: volume concentration at a specific price level
//   - SR_Strength with volume profile and touch count
// ═══════════════════════════════════════════════════════════════════════════════

import type { OHLCV } from './ta-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * A single price bin in the volume profile histogram.
 *
 * Each bin represents an equal-width slice of the overall price range,
 * with accumulated volume from all OHLCV bars that fall within it.
 */
export interface VolumeBin {
  /** Lower bound of this price bin */
  priceLow: number;
  /** Upper bound of this price bin */
  priceHigh: number;
  /** Mid price of this bin */
  priceMid: number;
  /** Total volume allocated to this bin */
  volume: number;
  /** Volume as fraction of total volume (0-1) */
  volumePercent: number;
  /** Cumulative volume from lowest bin */
  cumulativePercent: number;
}

/**
 * Result of the approximate volume profile computation.
 *
 * Contains the full histogram of price bins plus key derived metrics:
 * POC (Point of Control), Value Area, and VWAP.
 */
export interface VolumeProfileResult {
  /** All bins sorted by price (ascending) */
  bins: VolumeBin[];
  /** Price with highest volume (Point of Control) */
  poc: number;
  /** Price range where 70% of volume occurred (Value Area) */
  valueAreaHigh: number;
  valueAreaLow: number;
  /** Volume-weighted average price */
  vwap: number;
  /** Total volume across all bins */
  totalVolume: number;
}

/**
 * Result of counting how many times price touches a support/resistance level.
 *
 * A "touch" occurs when a bar's High or Low falls within a tolerance band
 * of the specified level. Each touch is recorded with its date, type,
 * exact price, and distance from the level.
 */
export interface TouchCountResult {
  /** Number of times High or Low touched within tolerance of the level */
  touchCount: number;
  /** Details of each touch */
  touches: { date: string; type: 'high' | 'low'; price: number; distance: number }[];
  /** Volume at touch points */
  touchVolume: number;
  /** Average volume at touches vs overall average volume */
  volumeRatio: number;
  /** Days since most recent touch */
  daysSinceLastTouch: number;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ═══════════════════════════════════════════════════════════════════════════════
// 1. APPROXIMATE VOLUME PROFILE
// ═══════════════════════════════════════════════════════════════════════════════
// Algorithm:
//   1. Divide the price range into N equal bins (default 100)
//   2. For each OHLCV bar, distribute its volume across the bins it spans
//      using a triangular kernel centered at the body (|close-open| area)
//      with tails extending to high and low
//   3. Compute POC, Value Area, and VWAP from the resulting histogram

/**
 * Build an approximate volume profile from OHLCV data.
 *
 * Distributes each bar's volume across N equal-width price bins using
 * a body/wick weighting scheme:
 * - 70% of the bar's volume is allocated to bins spanned by the body
 *   (the range between open and close).
 * - 30% is allocated to bins spanned by the wicks (high–body and body–low).
 *
 * From the resulting histogram, derives:
 * - **POC** (Point of Control): the price bin with the highest volume.
 * - **Value Area**: the price range containing 70% of total volume,
 *   expanded outward from the POC bin by always adding the heavier
 *   adjacent bin until the 70% threshold is reached.
 * - **VWAP**: volume-weighted average price using typical price
 *   (high + low + close) / 3.
 *
 * @param data    - Array of OHLCV bars to process.
 * @param numBins - Number of equal-width price bins to divide the range into.
 *                  Defaults to 100. Must be ≥ 1.
 * @returns A {@link VolumeProfileResult} containing the histogram bins,
 *          POC, Value Area high/low, VWAP, and total volume.
 *
 * @example
 * ```ts
 * const result = approximateVolumeProfile(ohlcvData, 100);
 * console.log(`POC: ${result.poc}, VA: ${result.valueAreaLow}–${result.valueAreaHigh}`);
 * ```
 */
export function approximateVolumeProfile(
  data: OHLCV[],
  numBins: number = 100,
): VolumeProfileResult {
  if (data.length === 0 || numBins < 1) {
    return { bins: [], poc: 0, valueAreaHigh: 0, valueAreaLow: 0, vwap: 0, totalVolume: 0 };
  }

  // Find price range across all data
  let globalLow = Infinity;
  let globalHigh = -Infinity;
  let totalVolume = 0;
  let vwapNumerator = 0;

  for (const bar of data) {
    if (bar.low < globalLow) globalLow = bar.low;
    if (bar.high > globalHigh) globalHigh = bar.high;
    totalVolume += bar.volume;
    vwapNumerator += bar.volume * (bar.high + bar.low + bar.close) / 3; // typical price
  }

  if (globalLow >= globalHigh || totalVolume === 0) {
    return { bins: [], poc: globalLow, valueAreaHigh: globalHigh, valueAreaLow: globalLow, vwap: globalLow, totalVolume: 0 };
  }

  const vwap = vwapNumerator / totalVolume;
  const binWidth = (globalHigh - globalLow) / numBins;

  // Initialize bins
  const binVolumes: number[] = Array(numBins).fill(0);

  // Distribute each bar's volume across the bins it spans
  for (const bar of data) {
    if (bar.volume === 0) continue;

    // Which bins does this bar span?
    const lowBin = Math.floor((bar.low - globalLow) / binWidth);
    const highBin = Math.floor((bar.high - globalLow) / binWidth);
    const bodyLow = Math.min(bar.open, bar.close);
    const bodyHigh = Math.max(bar.open, bar.close);
    const bodyLowBin = Math.floor((bodyLow - globalLow) / binWidth);
    const bodyHighBin = Math.floor((bodyHigh - globalLow) / binWidth);

    const spanBins = highBin - lowBin + 1;

    if (spanBins <= 1) {
      // Bar spans only one bin
      const idx = Math.max(0, Math.min(numBins - 1, lowBin));
      binVolumes[idx] += bar.volume;
    } else {
      // Distribute volume using a profile shape:
      // Higher weight to body (open-close range), lower to wicks
      const bodyWeight = 0.7; // 70% of volume in body
      const wickWeight = 0.3; // 30% in wicks
      const bodyBinCount = Math.max(1, bodyHighBin - bodyLowBin + 1);
      const wickBinCount = spanBins - bodyBinCount;

      // Assign body volume
      const bodyVolPerBin = (bar.volume * bodyWeight) / bodyBinCount;
      for (let i = bodyLowBin; i <= bodyHighBin; i++) {
        const idx = Math.max(0, Math.min(numBins - 1, i));
        binVolumes[idx] += bodyVolPerBin;
      }

      // Assign wick volume (lower and upper wicks)
      if (wickBinCount > 0) {
        const wickVolPerBin = (bar.volume * wickWeight) / Math.max(1, wickBinCount);
        for (let i = lowBin; i < bodyLowBin; i++) {
          const idx = Math.max(0, Math.min(numBins - 1, i));
          binVolumes[idx] += wickVolPerBin;
        }
        for (let i = bodyHighBin + 1; i <= highBin; i++) {
          const idx = Math.max(0, Math.min(numBins - 1, i));
          binVolumes[idx] += wickVolPerBin;
        }
      }
    }
  }

  // Build bins with cumulative percentages
  const bins: VolumeBin[] = [];
  let cumVol = 0;
  let maxBinVol = 0;
  let pocBin = 0;

  for (let i = 0; i < numBins; i++) {
    const priceLow = globalLow + i * binWidth;
    const priceHigh = priceLow + binWidth;
    const priceMid = (priceLow + priceHigh) / 2;
    const volume = binVolumes[i];
    cumVol += volume;

    if (volume > maxBinVol) {
      maxBinVol = volume;
      pocBin = i;
    }

    bins.push({
      priceLow,
      priceHigh,
      priceMid,
      volume,
      volumePercent: totalVolume > 0 ? volume / totalVolume : 0,
      cumulativePercent: totalVolume > 0 ? cumVol / totalVolume : 0,
    });
  }

  // POC: Point of Control (price with highest volume)
  const poc = bins[pocBin]?.priceMid ?? vwap;

  // Value Area: price range containing 70% of total volume centered on POC
  const targetCum = 0.70;
  let vaLow = pocBin;
  let vaHigh = pocBin;
  let vaVolume = bins[pocBin]?.volume ?? 0;

  while (vaVolume / totalVolume < targetCum) {
    // Expand outward from POC, alternating up and down
    const downBin = vaLow - 1;
    const upBin = vaHigh + 1;
    const downVol = downBin >= 0 ? bins[downBin].volume : 0;
    const upVol = upBin < numBins ? bins[upBin].volume : 0;

    if (downBin < 0 && upBin >= numBins) break; // can't expand further

    if (downVol >= upVol && downBin >= 0) {
      vaLow = downBin;
      vaVolume += downVol;
    } else if (upBin < numBins) {
      vaHigh = upBin;
      vaVolume += upVol;
    } else if (downBin >= 0) {
      vaLow = downBin;
      vaVolume += downVol;
    }
  }

  const valueAreaLow = bins[vaLow]?.priceLow ?? globalLow;
  const valueAreaHigh = bins[vaHigh]?.priceHigh ?? globalHigh;

  return { bins, poc, valueAreaHigh, valueAreaLow, vwap, totalVolume };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. TOUCH COUNT
// ═══════════════════════════════════════════════════════════════════════════════
// Counts how many times price (High or Low) touches a given S/R level
// within a tolerance band. No Level-2 data needed — only OHLCV.

/**
 * Count how many times price touches a support/resistance level.
 *
 * A "touch" is registered when a bar's **High** or **Low** falls within
 * a tolerance band of the given level. The tolerance band is calculated
 * as `level × (tolerancePercent / 100)`. If both High and Low of the
 * same bar are within tolerance, only the closer one is counted to
 * avoid double-counting.
 *
 * Also computes the total volume at touch points and the ratio of
 * average touch-volume to overall average volume (useful for gauging
 * whether touches occurred on high- or low-volume bars).
 *
 * @param level           - The support/resistance price level to test.
 * @param data            - Array of OHLCV bars to scan for touches.
 * @param tolerancePercent - Tolerance as a percentage of the level price.
 *                          Defaults to 0.2 (i.e. ±0.2% of the level).
 * @returns A {@link TouchCountResult} with the touch count, per-touch
 *          details, volume metrics, and days since the most recent touch.
 *
 * @example
 * ```ts
 * const touches = countTouch(150.00, ohlcvData, 0.3);
 * console.log(`${touches.touchCount} touches, last was ${touches.daysSinceLastTouch} days ago`);
 * ```
 */
export function countTouch(
  level: number,
  data: OHLCV[],
  tolerancePercent: number = 0.2,  // 0.2% = default
): TouchCountResult {
  const tolerance = level * (tolerancePercent / 100);
  let touchCount = 0;
  const touches: TouchCountResult['touches'] = [];
  let touchVolume = 0;
  let lastTouchIdx = -1;

  const hasVolume = data.some(d => d.volume > 0);
  const avgVolume = hasVolume
    ? data.reduce((s, d) => s + d.volume, 0) / data.length
    : 1;

  for (let i = 0; i < data.length; i++) {
    const bar = data[i];

    // Check if High touches the level
    const highDist = Math.abs(bar.high - level);
    if (highDist <= tolerance) {
      touchCount++;
      touches.push({ date: bar.date, type: 'high', price: bar.high, distance: highDist });
      touchVolume += bar.volume;
      lastTouchIdx = i;
      continue; // Don't double-count if both high and low are near
    }

    // Check if Low touches the level
    const lowDist = Math.abs(bar.low - level);
    if (lowDist <= tolerance) {
      touchCount++;
      touches.push({ date: bar.date, type: 'low', price: bar.low, distance: lowDist });
      touchVolume += bar.volume;
      lastTouchIdx = i;
    }
  }

  const volumeRatio = touchCount > 0 && avgVolume > 0
    ? (touchVolume / touchCount) / avgVolume
    : 1.0;

  const daysSinceLastTouch = lastTouchIdx >= 0
    ? data.length - 1 - lastTouchIdx
    : data.length;

  return { touchCount, touches, touchVolume, volumeRatio, daysSinceLastTouch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. VOLUME AT LEVEL
// ═══════════════════════════════════════════════════════════════════════════════
// Get the volume profile value at a specific price level.
// Uses bilinear interpolation between adjacent bins.

/**
 * Get the volume profile concentration at a specific price level.
 *
 * Looks up the bin that contains the given price and returns its
 * `volumePercent` (fraction of total volume in that bin). If the price
 * falls outside the profile range, the nearest edge bin's value is
 * returned.
 *
 * @param profile - A previously computed {@link VolumeProfileResult}.
 * @param price   - The price level to query.
 * @returns The volume fraction (0–1) at the given price, or 0 if the
 *          profile has no bins.
 *
 * @example
 * ```ts
 * const profile = approximateVolumeProfile(ohlcvData);
 * const volFrac = volumeAtLevel(profile, 152.50);
 * console.log(`Volume concentration at 152.50: ${(volFrac * 100).toFixed(2)}%`);
 * ```
 */
export function volumeAtLevel(
  profile: VolumeProfileResult,
  price: number,
): number {
  if (profile.bins.length === 0) return 0;

  // Find the bin containing this price
  const bin = profile.bins.find(b => price >= b.priceLow && price < b.priceHigh);
  if (bin) return bin.volumePercent;

  // Interpolate between nearest bins
  if (price < profile.bins[0].priceLow) return profile.bins[0].volumePercent;
  if (price >= profile.bins[profile.bins.length - 1].priceHigh) return profile.bins[profile.bins.length - 1].volumePercent;

  return 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ENHANCED SR_STRENGTH WITH VOLUME PROFILE AND TOUCH COUNT
// ═══════════════════════════════════════════════════════════════════════════════
// Calculates the strength of a support/resistance level (0-1) using:
//   - Touch count from OHLCV data
//   - Volume profile concentration at the level
//   - Distance from current price (closer = more relevant)
//   - Freshness of last touch

/**
 * Result of the enhanced support/resistance strength calculation.
 *
 * Combines four sub-scores into a single composite strength value (0–1):
 * - **touchScore**: how many times the level was touched (normalized).
 * - **volumeScore**: volume profile concentration at the level.
 * - **distanceScore**: proximity to current price (closer = stronger).
 * - **freshness**: recency of the most recent touch.
 *
 * Also includes the raw touch details and a human-readable description.
 */
export interface EnhancedSRStrengthResult {
  /** Overall strength 0-1 */
  strength: number;
  /** Touch count component (0-1) */
  touchScore: number;
  /** Volume profile concentration (0-1) */
  volumeScore: number;
  /** Distance penalty (0-1, 1=nearest) */
  distanceScore: number;
  /** Freshness of last touch (0-1, 1=most recent) */
  freshness: number;
  /** Detailed touch information */
  touchInfo: TouchCountResult;
  /** Persian description */
  description: string;
}

/**
 * Calculate the enhanced strength of a support/resistance level.
 *
 * Produces a composite score in [0, 1] by combining four sub-scores:
 *
 * | Sub-score       | Weight | Description |
 * |-----------------|--------|-------------|
 * | `touchScore`    | 0.35   | Touch count normalized by `lookback / 5` (expected max touches). |
 * | `volumeScore`   | 0.25   | Volume profile concentration at the level relative to the peak bin. |
 * | `distanceScore` | 0.20   | Exponential decay: `exp(-distancePercent × 20)`, where distance is `%` from `currentPrice`. |
 * | `freshness`     | 0.20   | Linear decay: `1 − daysSinceLastTouch / lookback`. |
 *
 * The final `strength` is the weighted sum, clamped to [0, 1].
 *
 * @param level           - The support/resistance price level to evaluate.
 * @param data            - Full array of OHLCV bars (only the last `lookback` bars are used).
 * @param currentPrice    - The current market price, used to compute the distance penalty.
 * @param volumeProfile   - A pre-computed {@link VolumeProfileResult} for the data.
 * @param lookback        - Number of recent bars to consider for touch counting.
 *                          Defaults to 50.
 * @param tolerancePercent - Tolerance as a percentage of the level for touch detection.
 *                          Defaults to 0.2 (±0.2%).
 * @returns An {@link EnhancedSRStrengthResult} with the overall strength,
 *          all four sub-scores, detailed touch info, and a description string.
 *
 * @example
 * ```ts
 * const profile = approximateVolumeProfile(ohlcvData);
 * const strength = calculateEnhancedSRStrength(150.00, ohlcvData, 148.50, profile);
 * console.log(`S/R strength: ${(strength.strength * 100).toFixed(1)}%`);
 * ```
 */
export function calculateEnhancedSRStrength(
  level: number,
  data: OHLCV[],
  currentPrice: number,
  volumeProfile: VolumeProfileResult,
  lookback: number = 50,
  tolerancePercent: number = 0.2,
): EnhancedSRStrengthResult {
  const recentData = data.slice(-lookback);

  // Touch count
  const touchInfo = countTouch(level, recentData, tolerancePercent);

  // Touch score: normalized by expected max touches (≈ lookback / 5)
  const touchScore = clamp01(touchInfo.touchCount / Math.max(1, lookback / 5));

  // Volume score: how much volume concentration is at this level
  const volAtLevel = volumeAtLevel(volumeProfile, level);
  const maxVol = Math.max(...volumeProfile.bins.map(b => b.volumePercent), 0.001);
  const volumeScore = clamp01(volAtLevel / maxVol);

  // Distance score: exponentially decaying with distance
  const distPercent = currentPrice > 0 ? Math.abs(level - currentPrice) / currentPrice : 1;
  const distanceScore = clamp01(Math.exp(-distPercent * 20));

  // Freshness: how recent was the last touch
  const freshness = clamp01(1 - touchInfo.daysSinceLastTouch / Math.max(1, recentData.length));

  // Combined strength: touch is most important, volume second, distance and freshness moderate
  const strength = clamp01(
    touchScore * 0.35 +
    volumeScore * 0.25 +
    distanceScore * 0.20 +
    freshness * 0.20
  );

  const strengthDesc = strength > 0.7 ? 'بسیار قوی' : strength > 0.5 ? 'قوی' : strength > 0.3 ? 'متوسط' : 'ضعیف';

  return {
    strength,
    touchScore,
    volumeScore,
    distanceScore,
    freshness,
    touchInfo,
    description: `سطح ${strengthDesc} (${(strength * 100).toFixed(0)}٪) با ${touchInfo.touchCount} برخورد و نسبت حجم ${touchInfo.volumeRatio.toFixed(1)}`,
  };
}
