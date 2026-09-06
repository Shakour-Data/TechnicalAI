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
