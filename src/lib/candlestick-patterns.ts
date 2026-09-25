// ═══════════════════════════════════════════════════════════════════════════════
// Candlestick Pattern Recognition Engine v9
// 10 Main Patterns: Doji, Hammer, Inverted Hammer, Bullish Engulfing,
// Bearish Engulfing, Morning Star, Evening Star, Shooting Star,
// Bullish Harami, Bearish Harami
// ═══════════════════════════════════════════════════════════════════════════════

import type { OHLCV } from './ta-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Direction classification for a candlestick pattern */
export type PatternDirection = 'bullish' | 'bearish' | 'neutral';
/** Reliability classification for a candlestick pattern */
export type PatternReliability = 'strong' | 'moderate' | 'weak';

/**
 * A detected candlestick pattern with bilingual metadata.
 */
export interface CandlestickPattern {
  /** English pattern name (e.g. 'Doji', 'Hammer', 'Bullish Engulfing') */
  name: string;
  /** English pattern name (e.g. 'Doji', 'Hammer', 'Bullish Engulfing') */
  nameEn: string;
  /** Pattern direction: bullish, bearish, or neutral */
  direction: PatternDirection;
  /** Reliability classification */
  reliability: PatternReliability;
  /** Numeric reliability score from 0 to 1 */
  reliabilityScore: number;
  /** English description of the pattern and its implications */
  description: string;
  /** English description of the pattern and its implications */
  descriptionEn: string;
  /** Position index in the data array where the pattern was detected */
  index: number;
}

/**
 * Result of scanning OHLCV data for candlestick patterns.
 */
export interface PatternScanResult {
  /** Top 5 most reliable patterns detected (sorted by reliabilityScore desc) */
  patterns: CandlestickPattern[];
  /** Overall dominant direction based on weighted pattern scores */
  dominantDirection: PatternDirection;
  /** Dominant direction score (0-1, ratio of dominant direction weight to total) */
  dominantScore: number;
  /** Persian narrative summary of detected patterns and their implications */
  summary: string;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function bodySize(c: OHLCV): number {
  return Math.abs(c.close - c.open);
}

function upperShadow(c: OHLCV): number {
  return c.high - Math.max(c.open, c.close);
}

function lowerShadow(c: OHLCV): number {
  return Math.min(c.open, c.close) - c.low;
}

function isBullish(c: OHLCV): boolean {
  return c.close > c.open;
}

function isBearish(c: OHLCV): boolean {
  return c.close < c.open;
}

function fullRange(c: OHLCV): number {
  return c.high - c.low;
}

/** Average body size of last N candles for context */
function avgBodySize(data: OHLCV[], endIdx: number, n: number): number {
  const start = Math.max(0, endIdx - n + 1);
  let sum = 0;
  let count = 0;
  for (let i = start; i <= endIdx; i++) {
    sum += bodySize(data[i]);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/** Average full range of last N candles */
function avgRange(data: OHLCV[], endIdx: number, n: number): number {
  const start = Math.max(0, endIdx - n + 1);
  let sum = 0;
  let count = 0;
  for (let i = start; i <= endIdx; i++) {
    sum += fullRange(data[i]);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

// ─── Pattern Detection Functions ─────────────────────────────────────────────

/**
 * 1. Doji — Open ≈ Close with significant shadows.
 * Body must be < 10% of the full range. At least one shadow must be ≥ 60% of range.
 * Long-legged variant detected when range > 1.5× average range.
 *
 * @param data - OHLCV array
 * @param i - Index of the candle to check
 * @returns CandlestickPattern if doji detected, null otherwise
 */
function detectDoji(data: OHLCV[], i: number): CandlestickPattern | null {
  const c = data[i];
  const range = fullRange(c);
  if (range === 0) return null;
  const body = bodySize(c);
  const bodyRatio = body / range;
  // Body must be very small relative to range (< 10%)
  if (bodyRatio > 0.1) return null;
  // At least one shadow must be significant
  const maxShadow = Math.max(upperShadow(c), lowerShadow(c));
  if (maxShadow / range < 0.6) return null;

  const avgR = avgRange(data, i, 10);
  const isLongLegged = range > avgR * 1.5;

  return {
    name: isLongLegged ? 'Long-Legged Doji' : 'Doji',
    nameEn: isLongLegged ? 'Long-Legged Doji' : 'Doji',
    direction: 'neutral',
    reliability: 'moderate',
    reliabilityScore: 0.6,
    description: isLongLegged
      ? 'Long-legged doji — extreme market indecision, potential trend change'
      : 'Doji — equilibrium between buyers and sellers, potential reversal',
    descriptionEn: isLongLegged
      ? 'Long-legged doji — extreme market indecision, potential trend change'
      : 'Doji — equilibrium between buyers and sellers, potential reversal',
    index: i,
  };
}

/**
 * 2. Hammer — Small body at top, long lower shadow (bullish reversal at bottom of downtrend).
 * Lower shadow ≥ 2× body, upper shadow < 10% of range, body in upper 40% of range.
 * Reliability boosted to 'strong' when appearing after a downtrend.
 *
 * @param data - OHLCV array
 * @param i - Index of the candle to check
 * @returns CandlestickPattern if hammer detected, null otherwise
 */
function detectHammer(data: OHLCV[], i: number): CandlestickPattern | null {
  const c = data[i];
  const body = bodySize(c);
  const lShadow = lowerShadow(c);
  const uShadow = upperShadow(c);
  const range = fullRange(c);
  if (range === 0) return null;

  // Lower shadow must be at least 2x the body
  if (lShadow < body * 2) return null;
  // Upper shadow must be small (< 10% of range)
  if (uShadow / range > 0.1) return null;
  // Body at the upper portion
  if (Math.min(c.open, c.close) - c.low < range * 0.6) return null;

  // Context: should appear after downtrend
  const isDowntrend = i >= 5 && data[i].close < data[i - 5].close;
  const reliability: PatternReliability = isDowntrend ? 'strong' : 'weak';
  const score = isDowntrend ? 0.82 : 0.45;

  return {
    name: 'Hammer',
    nameEn: 'Hammer',
    direction: 'bullish',
    reliability,
    reliabilityScore: score,
    description: isDowntrend
      ? 'Hammer at the end of a downtrend — strong bullish reversal signal'
      : 'Hammer — without confirmation of a prior downtrend, weak signal',
    descriptionEn: isDowntrend
      ? 'Hammer at bottom of downtrend — strong bullish reversal signal'
      : 'Hammer — no prior downtrend confirmation, weak signal',
    index: i,
  };
}

/**
 * 3. Inverted Hammer — Small body at bottom, long upper shadow (bullish reversal in downtrend).
 * Upper shadow ≥ 2× body, lower shadow < 10% of range.
 * Only returns a pattern when appearing in a downtrend.
 *
 * @param data - OHLCV array
 * @param i - Index of the candle to check
 * @returns CandlestickPattern if inverted hammer detected in downtrend, null otherwise
 */
function detectInvertedHammer(data: OHLCV[], i: number): CandlestickPattern | null {
  const c = data[i];
  const body = bodySize(c);
  const lShadow = lowerShadow(c);
  const uShadow = upperShadow(c);
  const range = fullRange(c);
  if (range === 0) return null;

  // Upper shadow at least 2x body
  if (uShadow < body * 2) return null;
  // Lower shadow small
  if (lShadow / range > 0.1) return null;

  const isDowntrend = i >= 5 && data[i].close < data[i - 5].close;

  // In downtrend = Inverted Hammer (bullish), in uptrend = Shooting Star (bearish)
  if (isDowntrend) {
    return {
      name: 'Inverted Hammer',
      nameEn: 'Inverted Hammer',
      direction: 'bullish',
      reliability: 'moderate',
      reliabilityScore: 0.62,
      description: 'Inverted hammer in a downtrend — buying pressure at high prices, reversal signal',
      descriptionEn: 'Inverted hammer in downtrend — buying pressure at highs, reversal signal',
      index: i,
    };
  }
  // Not returning Shooting Star here — that's a separate pattern
  return null;
}

/**
 * 4. Bullish Engulfing — Current bullish candle completely engulfs previous bearish candle.
 * Current body must be ≥ 1.2× previous body size.
 * Reliability boosted to 'strong' when appearing after a downtrend.
 *
 * @param data - OHLCV array
 * @param i - Index of the current candle
 * @returns CandlestickPattern if bullish engulfing detected, null otherwise
 */
function detectBullishEngulfing(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 1) return null;
  const prev = data[i - 1];
  const curr = data[i];

  // Previous candle must be bearish
  if (!isBearish(prev)) return null;
  // Current candle must be bullish
  if (!isBullish(curr)) return null;
  // Current body must completely engulf previous body
  if (curr.open <= prev.close || curr.close >= prev.open) return null;
  // Current body should be significantly larger
  if (bodySize(curr) < bodySize(prev) * 1.2) return null;

  const isDowntrend = i >= 5 && data[i].close < data[i - 5].close;
  const reliability: PatternReliability = isDowntrend ? 'strong' : 'moderate';
  const score = isDowntrend ? 0.85 : 0.6;

  return {
    name: 'Bullish Engulfing',
    nameEn: 'Bullish Engulfing',
    direction: 'bullish',
    reliability,
    reliabilityScore: score,
    description: isDowntrend
      ? 'Bullish engulfing in a downtrend — very strong reversal signal, buyers in control'
      : 'Bullish engulfing — previous candle engulfed, likely continuation',
    descriptionEn: isDowntrend
      ? 'Bullish engulfing in downtrend — very strong reversal, buyers in control'
      : 'Bullish engulfing — previous candle engulfed, likely continuation',
    index: i,
  };
}

/**
 * 5. Bearish Engulfing — Current bearish candle completely engulfs previous bullish candle.
 * Current body must be ≥ 1.2× previous body size.
 * Reliability boosted to 'strong' when appearing after an uptrend.
 *
 * @param data - OHLCV array
 * @param i - Index of the current candle
 * @returns CandlestickPattern if bearish engulfing detected, null otherwise
 */
function detectBearishEngulfing(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 1) return null;
  const prev = data[i - 1];
  const curr = data[i];

  if (!isBullish(prev)) return null;
  if (!isBearish(curr)) return null;
  if (curr.open >= prev.close || curr.close <= prev.open) return null;
  if (bodySize(curr) < bodySize(prev) * 1.2) return null;

  const isUptrend = i >= 5 && data[i].close > data[i - 5].close;
  const reliability: PatternReliability = isUptrend ? 'strong' : 'moderate';
  const score = isUptrend ? 0.85 : 0.6;

  return {
    name: 'Bearish Engulfing',
    nameEn: 'Bearish Engulfing',
    direction: 'bearish',
    reliability,
    reliabilityScore: score,
    description: isUptrend
      ? 'Bearish engulfing in an uptrend — strong bearish reversal signal, sellers have entered'
      : 'Bearish engulfing — previous candle engulfed, likely decline continuation',
    descriptionEn: isUptrend
      ? 'Bearish engulfing in uptrend — strong bearish reversal signal'
      : 'Bearish engulfing — previous candle engulfed, likely decline continuation',
    index: i,
  };
}

/**
 * 6. Morning Star — 3-candle bullish reversal pattern.
 * First: large bearish body. Second: small star body (doji-like). Third: large bullish body
 * closing above midpoint of first candle. All bodies compared to 10-candle average.
 *
 * @param data - OHLCV array
 * @param i - Index of the third candle (the bullish one)
 * @returns CandlestickPattern if morning star detected, null otherwise
 */
function detectMorningStar(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 2) return null;
  const c1 = data[i - 2]; // first candle (bearish, large)
  const c2 = data[i - 1]; // star (small body)
  const c3 = data[i];     // third candle (bullish, large)

  if (!isBearish(c1)) return null;
  if (!isBullish(c3)) return null;

  const c1Body = bodySize(c1);
  const c2Body = bodySize(c2);
  const c3Body = bodySize(c3);
  const avgB = avgBodySize(data, i, 10);

  // First candle: large bearish body
  if (c1Body < avgB * 0.8) return null;
  // Star: very small body, can be doji-like
  if (c2Body > avgB * 0.3) return null;
  // Third candle: large bullish body
  if (c3Body < avgB * 0.8) return null;
  // Third candle closes above midpoint of first candle
  const c1Mid = (c1.open + c1.close) / 2;
  if (c3.close < c1Mid) return null;

  return {
    name: 'Morning Star',
    nameEn: 'Morning Star',
    direction: 'bullish',
    reliability: 'strong',
    reliabilityScore: 0.88,
    description: 'Morning Star — strong 3-candle bullish reversal pattern, trend change confirmed',
    descriptionEn: 'Morning Star — 3-candle strong bullish reversal pattern, trend change confirmed',
    index: i,
  };
}

/**
 * 7. Evening Star — 3-candle bearish reversal pattern.
 * First: large bullish body. Second: small star body (doji-like). Third: large bearish body
 * closing below midpoint of first candle.
 *
 * @param data - OHLCV array
 * @param i - Index of the third candle (the bearish one)
 * @returns CandlestickPattern if evening star detected, null otherwise
 */
function detectEveningStar(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 2) return null;
  const c1 = data[i - 2];
  const c2 = data[i - 1];
  const c3 = data[i];

  if (!isBullish(c1)) return null;
  if (!isBearish(c3)) return null;

  const c1Body = bodySize(c1);
  const c2Body = bodySize(c2);
  const c3Body = bodySize(c3);
  const avgB = avgBodySize(data, i, 10);

  if (c1Body < avgB * 0.8) return null;
  if (c2Body > avgB * 0.3) return null;
  if (c3Body < avgB * 0.8) return null;

  const c1Mid = (c1.open + c1.close) / 2;
  if (c3.close > c1Mid) return null;

  return {
    name: 'Evening Star',
    nameEn: 'Evening Star',
    direction: 'bearish',
    reliability: 'strong',
    reliabilityScore: 0.88,
    description: 'Evening Star — strong 3-candle bearish reversal pattern, trend change warning',
    descriptionEn: 'Evening Star — 3-candle strong bearish reversal pattern, trend change warning',
    index: i,
  };
}

/**
 * 8. Shooting Star — Long upper shadow, small body at bottom (bearish reversal at top of uptrend).
 * Upper shadow ≥ 2× body, lower shadow < 15% of range.
 * Only valid when appearing in an uptrend.
 *
 * @param data - OHLCV array
 * @param i - Index of the candle to check
 * @returns CandlestickPattern if shooting star detected in uptrend, null otherwise
 */
function detectShootingStar(data: OHLCV[], i: number): CandlestickPattern | null {
  const c = data[i];
  const body = bodySize(c);
  const uShadow = upperShadow(c);
  const lShadow = lowerShadow(c);
  const range = fullRange(c);
  if (range === 0) return null;

  // Upper shadow at least 2x body
  if (uShadow < body * 2) return null;
  // Lower shadow small
  if (lShadow / range > 0.15) return null;

  const isUptrend = i >= 5 && data[i].close > data[i - 5].close;
  if (!isUptrend) return null; // Only valid in uptrend

  return {
    name: 'Shooting Star',
    nameEn: 'Shooting Star',
    direction: 'bearish',
    reliability: 'strong',
    reliabilityScore: 0.82,
    description: 'Shooting Star at the end of an uptrend — strong selling pressure at the high, reversal signal',
    descriptionEn: 'Shooting Star at top of uptrend — strong selling pressure at high, reversal signal',
    index: i,
  };
}

/**
 * 9. Bullish Harami — Small bullish body inside previous large bearish body.
 * Current body must be < 60% of previous body size.
 * Reliability boosted to 'moderate' when appearing in a downtrend.
 *
 * @param data - OHLCV array
 * @param i - Index of the current candle
 * @returns CandlestickPattern if bullish harami detected, null otherwise
 */
function detectBullishHarami(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 1) return null;
  const prev = data[i - 1];
  const curr = data[i];

  if (!isBearish(prev)) return null;
  if (!isBullish(curr)) return null;

  // Current body must be inside previous body
  if (curr.open >= prev.close || curr.close <= prev.open) return null;
  // Current body must be significantly smaller
  if (bodySize(curr) > bodySize(prev) * 0.6) return null;

  const isDowntrend = i >= 5 && data[i].close < data[i - 5].close;
  const reliability: PatternReliability = isDowntrend ? 'moderate' : 'weak';
  const score = isDowntrend ? 0.65 : 0.4;

  return {
    name: 'Bullish Harami',
    nameEn: 'Bullish Harami',
    direction: 'bullish',
    reliability,
    reliabilityScore: score,
    description: isDowntrend
      ? 'Bullish harami in a downtrend — selling pressure decreasing, consolidation or reversal likely'
      : 'Bullish harami — small candle inside the previous large candle',
    descriptionEn: isDowntrend
      ? 'Bullish harami in downtrend — selling pressure decreasing, consolidation/reversal likely'
      : 'Bullish harami — small body inside previous large body',
    index: i,
  };
}

/**
 * 10. Bearish Harami — Small bearish body inside previous large bullish body.
 * Current body must be < 60% of previous body size.
 * Reliability boosted to 'moderate' when appearing in an uptrend.
 *
 * @param data - OHLCV array
 * @param i - Index of the current candle
 * @returns CandlestickPattern if bearish harami detected, null otherwise
 */
function detectBearishHarami(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 1) return null;
  const prev = data[i - 1];
  const curr = data[i];

  if (!isBullish(prev)) return null;
  if (!isBearish(curr)) return null;

  if (curr.open <= prev.close || curr.close >= prev.open) return null;
  if (bodySize(curr) > bodySize(prev) * 0.6) return null;

  const isUptrend = i >= 5 && data[i].close > data[i - 5].close;
  const reliability: PatternReliability = isUptrend ? 'moderate' : 'weak';
  const score = isUptrend ? 0.65 : 0.4;

  return {
    name: 'Bearish Harami',
    nameEn: 'Bearish Harami',
    direction: 'bearish',
    reliability,
    reliabilityScore: score,
    description: isUptrend
      ? 'Bearish harami in an uptrend — buying momentum decreasing, correction likely'
      : 'Bearish harami — small bearish candle inside the previous bullish candle',
    descriptionEn: isUptrend
      ? 'Bearish harami in uptrend — buying momentum decreasing, correction likely'
      : 'Bearish harami — small bearish body inside previous bullish body',
    index: i,
  };
}

// ─── All Detectors ───────────────────────────────────────────────────────────

const ALL_DETECTORS = [
  detectDoji,
  detectHammer,
  detectInvertedHammer,
  detectBullishEngulfing,
  detectBearishEngulfing,
  detectMorningStar,
  detectEveningStar,
  detectShootingStar,
  detectBullishHarami,
  detectBearishHarami,
];

// ─── Main Scan Function ──────────────────────────────────────────────────────

/**
 * Scan the last N candles for candlestick patterns.
 * @param data - OHLCV data (chronological, oldest first)
 * @param lookback - Number of recent candles to scan (default: 20)
 * @returns PatternScanResult with all detected patterns and summary
 */
export function scanCandlestickPatterns(
  data: OHLCV[],
  lookback: number = 20
): PatternScanResult {
  if (data.length < 3) {
    return { patterns: [], dominantDirection: 'neutral', dominantScore: 0, summary: '' };
  }

  const startIdx = Math.max(0, data.length - lookback);
  const patterns: CandlestickPattern[] = [];

  for (let i = startIdx; i < data.length; i++) {
    for (const detector of ALL_DETECTORS) {
      const pattern = detector(data, i);
      if (pattern) patterns.push(pattern);
    }
  }

  // Sort by reliability score (highest first)
  patterns.sort((a, b) => b.reliabilityScore - a.reliabilityScore);

  // Keep only top 5 most reliable
  const topPatterns = patterns.slice(0, 5);

  // Calculate dominant direction
  let bullScore = 0;
  let bearScore = 0;
  for (const p of topPatterns) {
    if (p.direction === 'bullish') bullScore += p.reliabilityScore;
    else if (p.direction === 'bearish') bearScore += p.reliabilityScore;
  }

  const total = bullScore + bearScore;
  let dominantDirection: PatternDirection = 'neutral';
  let dominantScore = 0;

  if (total > 0) {
    if (bullScore > bearScore * 1.3) {
      dominantDirection = 'bullish';
      dominantScore = bullScore / total;
    } else if (bearScore > bullScore * 1.3) {
      dominantDirection = 'bearish';
      dominantScore = bearScore / total;
    } else {
      dominantDirection = 'neutral';
      dominantScore = Math.min(bullScore, bearScore) / total;
    }
  }

  // Generate Persian summary
  const summary = generatePatternSummary(topPatterns, dominantDirection, dominantScore);

  return { patterns: topPatterns, dominantDirection, dominantScore, summary };
}

/**
 * Quick check for the most recent candle pattern only.
 * Returns the highest-reliability pattern detected on the last candle.
 *
 * @param data - OHLCV data array (chronological, oldest first)
 * @returns The most reliable CandlestickPattern on the latest candle, or null
 */
export function detectLatestPattern(data: OHLCV[]): CandlestickPattern | null {
  if (data.length < 3) return null;
  const i = data.length - 1;

  let best: CandlestickPattern | null = null;
  for (const detector of ALL_DETECTORS) {
    const pattern = detector(data, i);
    if (pattern && (!best || pattern.reliabilityScore > best.reliabilityScore)) {
      best = pattern;
    }
  }
  return best;
}

// ─── Summary Generator ───────────────────────────────────────────────────────

function generatePatternSummary(
  patterns: CandlestickPattern[],
  dominant: PatternDirection,
  score: number
): string {
  if (patterns.length === 0) {
    return 'No reliable candlestick pattern identified in recent candles.';
  }

  const names = patterns.map(p => p.nameEn).join(', ');
  const strongPatterns = patterns.filter(p => p.reliability === 'strong');

  let trendNote = '';
  if (dominant === 'bullish') {
    trendNote = score > 0.7
      ? `Strong bullish signal with ${Math.round(score * 100)}% confidence`
      : `Bullish signal with ${Math.round(score * 100)}% confidence`;
  } else if (dominant === 'bearish') {
    trendNote = score > 0.7
      ? `Strong bearish signal with ${Math.round(score * 100)}% confidence`
      : `Bearish signal with ${Math.round(score * 100)}% confidence`;
  } else {
    trendNote = 'Conflicting signals, market indecision';
  }

  const strongNote = strongPatterns.length > 0
    ? ` | Strong patterns: ${strongPatterns.map(p => p.nameEn).join(', ')}`
    : '';

  return `Identified patterns: ${names}. ${trendNote}.${strongNote}`;
}

// ─── AI-Powered Harmonic & Elliott Detection (uses LLM) ─────────────────────

export interface AIPatternRequest {
  ohlcv: OHLCV[];
  currentPrice: number;
  symbolName: string;
}

export interface AIPatternResult {
  harmonicPatterns: {
    name: string;
    type: string;
    reliability: string;
    description: string;
  }[];
  elliottWave: {
    currentWave: string;
    position: string;
    nextMove: string;
    confidence: number;
    description: string;
  } | null;
}

/**
 * Build a prompt for LLM-based harmonic/Elliott pattern detection.
 * Provides 50 most recent OHLCV candles, swing points, and key levels
 * for the LLM to analyze harmonic patterns (gartley, butterfly, bat, crab, shark)
 * and Elliott wave positioning.
 *
 * @param req - Request with OHLCV data, current price, and symbol name
 * @returns Persian-language prompt string for LLM analysis
 */
export function buildAIPatternPrompt(req: AIPatternRequest): string {
  const last50 = req.ohlcv.slice(-50);
  const priceData = last50.map((c, i) =>
    `${i + 1}: O=${c.open} H=${c.high} L=${c.low} C=${c.close} V=${c.volume}`
  ).join('\n');

  // Calculate key levels
  const highs = last50.map(c => c.high);
  const lows = last50.map(c => c.low);
  const recentHigh = Math.max(...highs.slice(-20));
  const recentLow = Math.min(...lows.slice(-20));
  const swingPoints = identifySwingPoints(last50);

  return `You are a professional analyst of harmonic patterns and Elliott waves.

Symbol: ${req.symbolName}
Current price: ${req.currentPrice}
Recent range: ${last50[0]?.open ?? 0} — ${req.currentPrice}
Highest 20 recent candles: ${recentHigh}
Lowest 20 recent candles: ${recentLow}

Data of 50 recent candles:
${priceData}

Identified swing points:
${swingPoints.map((p, i) => `${i + 1}. ${p.type} at price ${p.price} (candle ${p.index})`).join('\n') || 'No specific swing point found'}

Your mission:
1. Examine harmonic patterns (gartley, butterfly, bat, crab, shark)
2. Analyze Elliott wave positioning (are we in wave 3, 5, or C?)
3. Report only patterns that match with at least 60% accuracy

Return ONLY the following JSON format, without any additional text:
{
  "harmonicPatterns": [
    {"name": "English pattern name", "type": "gartley|butterfly|bat|crab|shark", "reliability": "high|medium|low", "description": "Brief English explanation"}
  ],
  "elliottWave": {
    "currentWave": "Current wave (e.g., wave 3 bullish)",
    "position": "Position in cycle (beginning/middle/end)",
    "nextMove": "Expected next movement",
    "confidence": 0.0-1.0,
    "description": "Brief English explanation"
  } | null
}`;
}

/** Identify swing highs and lows from OHLC data */
function identifySwingPoints(data: OHLCV[], window = 5): { type: 'swing_high' | 'swing_low'; price: number; index: number }[] {
  const points: { type: 'swing_high' | 'swing_low'; price: number; index: number }[] = [];

  for (let i = window; i < data.length - window; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (data[j].high >= data[i].high) isHigh = false;
      if (data[j].low <= data[i].low) isLow = false;
    }

    if (isHigh) points.push({ type: 'swing_high', price: data[i].high, index: i });
    if (isLow) points.push({ type: 'swing_low', price: data[i].low, index: i });
  }

  return points;
}
