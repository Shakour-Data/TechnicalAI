// ═════════════════════════════════════════════════════════════════════════════════
// Composite Scores — Trend Strength (6 components) & SR Strength (7 components)
// ═════════════════════════════════════════════════════════════════════════════════

import type { OHLCV, LevelStrength } from './ta-engine';

export interface TrendStrengthResult {
  overall: number;           // 0-1
  adxNormalized: number;    // 0-1
  slopeStrength: number;    // 0-1
  maAlignment: number;      // 0-1
  pricePosition: number;    // 0-1
  momentumStrength: number; // 0-1
  pullbackQuality: number;  // 0-1
  description: string;
}

export interface SRStrengthResult {
  overall: number;              // 0-1
  touchCount: number;           // 0-1
  timeValidity: number;         // 0-1
  volumeProfile: number;        // 0-1
  volatilityAdjustment: number; // 0-1
  historicalSignificance: number; // 0-1
  fibonacciConfluence: number;  // 0-1
  patternSupport: number;       // 0-1
  description: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ═════════════════════════════════════════════════════════════════════════════════
// TREND STRENGTH — 6 Components
// ═════════════════════════════════════════════════════════════════════════════════

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
