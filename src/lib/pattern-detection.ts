// ═══════════════════════════════════════════════════════════════════════════════
// Pattern Detection Engine — Classic, Harmonic, Candlestick, Elliott Wave
// ═══════════════════════════════════════════════════════════════════════════════

import type { OHLCV } from './ta-engine';

// ─── Interfaces ─────────────────────────────────────────────────────────────

/**
 * Represents a single detected technical analysis pattern.
 *
 * Each pattern is classified by category (classic, harmonic, candlestick, elliott),
 * carries a directional signal (bullish/bearish/neutral), and includes a
 * strength score from 0 to 1 indicating pattern confidence.
 */
export interface PatternResult {
  /** Persian (Farsi) name of the pattern, e.g. 'سر و شانه' */
  name: string;
  /** English name of the pattern, e.g. 'Head & Shoulders' */
  nameEn: string;
  /** Analysis school the pattern belongs to */
  category: 'classic' | 'harmonic' | 'candlestick' | 'elliott';
  /** Predicted market direction signaled by the pattern */
  direction: 'bullish' | 'bearish' | 'neutral';
  /** Pattern confidence/strength from 0 (weak) to 1 (strong) */
  strength: number;
  /** Current lifecycle status of the pattern */
  status: 'forming' | 'completed' | 'failed';
  /** Key price level for the pattern (neckline, PRZ, resistance, etc.) */
  priceLevel?: number;
  /** Brief human-readable description in Persian */
  description: string;
}

/**
 * Aggregate result of scanning OHLCV data across all four pattern schools.
 *
 * Contains arrays of detected patterns grouped by category, a combined
 * `all` array sorted by strength (descending), and six school-level
 * composite scores (0–1) that summarise confidence per analysis method.
 */
export interface DetectedPatterns {
  /** Classic chart patterns (Head & Shoulders, Double Top, Triangles, etc.) */
  classic: PatternResult[];
  /** Harmonic patterns (Gartley, Butterfly, Bat, Crab, Shark, Cypher) */
  harmonic: PatternResult[];
  /** Candlestick patterns (single & multi-candle formations) */
  candlestick: PatternResult[];
  /** Elliott Wave patterns (Impulse, Diagonals, Corrections, etc.) */
  elliott: PatternResult[];
  /** All detected patterns across every category, sorted by strength descending */
  all: PatternResult[];
  /** Composite confidence scores (0–1) per analysis school */
  schoolScores: {
    /** Score derived from classic chart patterns */
    classical: number;
    /** Score derived from oscillator-related candlestick patterns (Doji, Star, Harami, Engulfing) */
    oscillator: number;
    /** Score derived from volume-related candlestick patterns (Marubozu, Kicker, Three Methods) */
    volume: number;
    /** Score derived from harmonic patterns */
    harmonic: number;
    /** Score derived from Elliott Wave patterns */
    elliott: number;
    /** Blended score across all schools, weighted by pattern count */
    hybrid: number;
  };
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * A local swing high or swing low identified in OHLCV data.
 * Used as the building block for classic, harmonic, and Elliott pattern detection.
 */
interface SwingPoint {
  /** Bar index in the source OHLCV array */
  index: number;
  /** Price at the swing point (high for peaks, low for troughs) */
  price: number;
  /** Whether this point is a local high (peak) or local low (trough) */
  type: 'high' | 'low';
}

/**
 * Identify local swing highs and lows in OHLCV data.
 *
 * A bar is a swing high if its high is strictly greater than the highs of
 * `order` bars on each side; similarly for swing lows.
 *
 * @param data  - Array of OHLCV bars to scan
 * @param order - Number of surrounding bars on each side that must be lower/higher (default 3)
 * @returns Array of SwingPoint objects sorted by index
 */
function findSwingPoints(data: OHLCV[], order: number = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  const len = data.length;
  for (let i = order; i < len - order; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= order; j++) {
      if (data[i].high <= data[i - j].high || data[i].high <= data[i + j].high) isHigh = false;
      if (data[i].low >= data[i - j].low || data[i].low >= data[i + j].low) isLow = false;
    }
    if (isHigh) swings.push({ index: i, price: data[i].high, type: 'high' });
    if (isLow) swings.push({ index: i, price: data[i].low, type: 'low' });
  }
  return swings;
}

/**
 * Compute the arithmetic mean of a numeric array.
 * @param arr - Input numbers
 * @returns The average, or 0 for an empty array
 */
function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Check whether two values are approximately equal within a relative tolerance.
 * @param a         - First value
 * @param b         - Second value (denominator)
 * @param tolerance - Maximum allowed relative deviation (default 0.05 = 5%)
 * @returns True if |a/b − 1| ≤ tolerance
 */
function nearRatio(a: number, b: number, tolerance: number = 0.05): boolean {
  if (b === 0) return a === 0;
  return Math.abs(a / b - 1) <= tolerance;
}

/** Absolute body size (|close − open|) of a candle. */
function bodySize(c: OHLCV): number {
  return Math.abs(c.close - c.open);
}

/** Upper shadow length of a candle. */
function upperShadow(c: OHLCV): number {
  return c.high - Math.max(c.open, c.close);
}

/** Lower shadow length of a candle. */
function lowerShadow(c: OHLCV): number {
  return Math.min(c.open, c.close) - c.low;
}

/** True if the candle closed higher than it opened. */
function isBullish(c: OHLCV): boolean {
  return c.close > c.open;
}

/** True if the candle closed lower than it opened. */
function isBearish(c: OHLCV): boolean {
  return c.close < c.open;
}

/** Full range (high − low) of a candle. */
function totalRange(c: OHLCV): number {
  return c.high - c.low;
}

/** Typical price: (high + low + close) / 3. */
function typicalPrice(c: OHLCV): number {
  return (c.high + c.low + c.close) / 3;
}

/**
 * Simple moving average over the last `period` values.
 * @param values - Source array
 * @param period - Lookback window
 * @returns SMA value, or 0 if insufficient data
 */
function sma(values: number[], period: number): number {
  if (values.length < period) return 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Exponential moving average.
 * @param values - Source array
 * @param period - EMA period (controls smoothing factor k = 2/(period+1))
 * @returns EMA value, or 0 if insufficient data
 */
function ema(values: number[], period: number): number {
  if (values.length < period) return 0;
  const k = 2 / (period + 1);
  let result = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    result = values[i] * k + result * (1 - k);
  }
  return result;
}

/** Fibonacci & derived ratios used in harmonic pattern detection. */
const PHI = 0.618;       // φ (golden ratio conjugate)
const PHI_618 = 0.618;   // φ (for clarity in harmonic patterns)
const PHI_EXT = 1.618;   // φ extended (1/φ)
const PHI_1618 = 1.618;  // φ extended (for clarity in harmonic patterns)
const PHI_386 = 0.382;   // 1 − φ
const PHI_786 = 0.786;   // √φ
const PHI_886 = 0.886;   // √(φ × 0.618 + φ)
const PHI_127 = 1.27;    // √(1.618)
const PHI_141 = 1.414;   // √2
const PHI_236 = 2.236;   // √5
const PHI_314 = 3.14;    // ≈ π
const PHI_423 = 4.236;   // 1.618² + 1.618
/** Tolerance for Fibonacci ratio matching (5%). */
const FIB_TOL = 0.05;

// ─── 1. Classic Pattern Detectors ───────────────────────────────────────────

/**
 * Detect Head & Shoulders (bearish) and Inverse Head & Shoulders (bullish) patterns.
 *
 * Identifies three-peak formations where the middle peak (head) is the highest/lowest
 * and the two flanking peaks (shoulders) are at approximately the same level (>85% similarity).
 *
 * @param data - OHLCV bars (minimum 30)
 * @returns Array of detected Head & Shoulders patterns (0–2 results)
 */
function detectHeadAndShoulders(data: OHLCV[]): PatternResult[] {
  const results: PatternResult[] = [];
  if (data.length < 30) return results;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');

  // Bearish Head & Shoulders: left shoulder < head > right shoulder, neckline support
  for (let i = 2; i < highs.length; i++) {
    const ls = highs[i - 2];
    const hd = highs[i - 1];
    const rs = highs[i];
    if (hd.price > ls.price && hd.price > rs.price) {
      const sim = 1 - Math.abs(ls.price - rs.price) / hd.price;
      if (sim > 0.85) {
        const neckline = (ls.price + rs.price) / 2;
        const last = data[data.length - 1];
        const dist = (last.close - neckline) / neckline;
        const status = dist > 0.01 ? 'forming' : dist < -0.005 ? 'completed' : 'forming';
        results.push({
          name: 'سر و شانه', nameEn: 'Head & Shoulders', category: 'classic',
          direction: 'bearish', strength: sim * 0.8 + (status === 'completed' ? 0.2 : 0),
          status, priceLevel: neckline,
          description: `الگوی سر و شانه نزولی با خط گردن ${neckline.toFixed(0)}`
        });
      }
    }
  }

  // Bullish Inverse Head & Shoulders
  for (let i = 2; i < lows.length; i++) {
    const ls = lows[i - 2];
    const hd = lows[i - 1];
    const rs = lows[i];
    if (hd.price < ls.price && hd.price < rs.price) {
      const sim = 1 - Math.abs(ls.price - rs.price) / hd.price;
      if (sim > 0.85) {
        const neckline = (ls.price + rs.price) / 2;
        const last = data[data.length - 1];
        const dist = (last.close - neckline) / neckline;
        const status = dist < -0.01 ? 'forming' : dist > 0.005 ? 'completed' : 'forming';
        results.push({
          name: 'سر و شانه معکوس', nameEn: 'Inverse Head & Shoulders', category: 'classic',
          direction: 'bullish', strength: sim * 0.8 + (status === 'completed' ? 0.2 : 0),
          status, priceLevel: neckline,
          description: `الگوی سر و شانه معکوس صعودی با خط گردن ${neckline.toFixed(0)}`
        });
      }
    }
  }

  return results;
}

/**
 * Detect a Double Top (bearish reversal) pattern.
 *
 * Two swing highs at approximately the same price level (>96% similarity)
 * with a trough between them. Confirmed when price breaks below the trough.
 *
 * @param data - OHLCV bars (minimum 20)
 * @returns PatternResult if detected, null otherwise
 */
function detectDoubleTop(data: OHLCV[]): PatternResult {
  if (data.length < 20) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  if (highs.length < 2) return null!;

  const len = highs.length;
  const h1 = highs[len - 2];
  const h2 = highs[len - 1];
  const sim = 1 - Math.abs(h1.price - h2.price) / h1.price;
  if (sim < 0.96) return null!;

  const trough = Math.min(...data.slice(h1.index, h2.index + 1).map(d => d.low));
  const last = data[data.length - 1];
  const broken = last.close < trough;

  return {
    name: 'دو سقف', nameEn: 'Double Top', category: 'classic',
    direction: 'bearish', strength: Math.min(sim, 1),
    status: broken ? 'completed' : 'forming',
    priceLevel: trough,
    description: `الگوی دو سقف نزولی با خط گردن ${trough.toFixed(0)}`
  };
}

/**
 * Detect a Double Bottom (bullish reversal) pattern.
 *
 * Two swing lows at approximately the same price level (>96% similarity)
 * with a peak between them. Confirmed when price breaks above the peak.
 *
 * @param data - OHLCV bars (minimum 20)
 * @returns PatternResult if detected, null otherwise
 */
function detectDoubleBottom(data: OHLCV[]): PatternResult {
  if (data.length < 20) return null!;
  const swings = findSwingPoints(data, 3);
  const lows = swings.filter(s => s.type === 'low');
  if (lows.length < 2) return null!;

  const len = lows.length;
  const l1 = lows[len - 2];
  const l2 = lows[len - 1];
  const sim = 1 - Math.abs(l1.price - l2.price) / l1.price;
  if (sim < 0.96) return null!;

  const peak = Math.max(...data.slice(l1.index, l2.index + 1).map(d => d.high));
  const last = data[data.length - 1];
  const broken = last.close > peak;

  return {
    name: 'دو کف', nameEn: 'Double Bottom', category: 'classic',
    direction: 'bullish', strength: Math.min(sim, 1),
    status: broken ? 'completed' : 'forming',
    priceLevel: peak,
    description: `الگوی دو کف صعودی با خط گردن ${peak.toFixed(0)}`
  };
}

/**
 * Detect a Triple Top (bearish reversal) pattern.
 * Three swing highs within 4% variance, confirmed on neckline break.
 *
 * @param data - OHLCV bars (minimum 30)
 * @returns PatternResult if detected, null otherwise
 */
function detectTripleTop(data: OHLCV[]): PatternResult {
  if (data.length < 30) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  if (highs.length < 3) return null!;

  const h = [highs[highs.length - 3], highs[highs.length - 2], highs[highs.length - 1]];
  const avgPrice = (h[0].price + h[1].price + h[2].price) / 3;
  const variance = h.reduce((s, p) => s + Math.abs(p.price - avgPrice), 0) / avgPrice;
  if (variance > 0.04) return null!;

  const neckline = Math.min(
    Math.min(...data.slice(h[0].index, h[1].index + 1).map(d => d.low)),
    Math.min(...data.slice(h[1].index, h[2].index + 1).map(d => d.low))
  );
  const last = data[data.length - 1];
  const broken = last.close < neckline;

  return {
    name: 'سه سقف', nameEn: 'Triple Top', category: 'classic',
    direction: 'bearish', strength: 1 - variance * 10,
    status: broken ? 'completed' : 'forming',
    priceLevel: neckline,
    description: `الگوی سه سقف نزولی با خط گردن ${neckline.toFixed(0)}`
  };
}

/**
 * Detect a Triple Bottom (bullish reversal) pattern.
 * Three swing lows within 4% variance, confirmed on neckline break.
 *
 * @param data - OHLCV bars (minimum 30)
 * @returns PatternResult if detected, null otherwise
 */
function detectTripleBottom(data: OHLCV[]): PatternResult {
  if (data.length < 30) return null!;
  const swings = findSwingPoints(data, 3);
  const lows = swings.filter(s => s.type === 'low');
  if (lows.length < 3) return null!;

  const l = [lows[lows.length - 3], lows[lows.length - 2], lows[lows.length - 1]];
  const avgPrice = (l[0].price + l[1].price + l[2].price) / 3;
  const variance = l.reduce((s, p) => s + Math.abs(p.price - avgPrice), 0) / avgPrice;
  if (variance > 0.04) return null!;

  const neckline = Math.max(
    Math.max(...data.slice(l[0].index, l[1].index + 1).map(d => d.high)),
    Math.max(...data.slice(l[1].index, l[2].index + 1).map(d => d.high))
  );
  const last = data[data.length - 1];
  const broken = last.close > neckline;

  return {
    name: 'سه کف', nameEn: 'Triple Bottom', category: 'classic',
    direction: 'bullish', strength: 1 - variance * 10,
    status: broken ? 'completed' : 'forming',
    priceLevel: neckline,
    description: `الگوی سه کف صعودی با خط گردن ${neckline.toFixed(0)}`
  };
}

/**
 * Detect an Ascending Triangle (bullish continuation) pattern.
 * Flat resistance with rising higher lows.
 *
 * @param data - OHLCV bars (minimum 20)
 * @returns PatternResult if detected, null otherwise
 */
function detectAscendingTriangle(data: OHLCV[]): PatternResult {
  if (data.length < 20) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 2 || lows.length < 2) return null!;

  const recentHighs = highs.slice(-3);
  const recentLows = lows.slice(-3);
  const hAvg = avg(recentHighs.map(h => h.price));
  const hVar = recentHighs.reduce((s, h) => s + Math.abs(h.price - hAvg), 0) / hAvg;
  const lRising = recentLows.length >= 2 && recentLows[recentLows.length - 1].price > recentLows[0].price;

  if (hVar > 0.02 || !lRising) return null!;

  const last = data[data.length - 1];
  const broken = last.close > hAvg;
  return {
    name: 'مثلث صعودی', nameEn: 'Ascending Triangle', category: 'classic',
    direction: 'bullish', strength: 0.6 + (broken ? 0.4 : lRising ? 0.2 : 0),
    status: broken ? 'completed' : 'forming',
    priceLevel: hAvg,
    description: `الگوی مثلث صعودی با مقاومت ${hAvg.toFixed(0)}`
  };
}

/**
 * Detect a Descending Triangle (bearish continuation) pattern.
 * Flat support with falling lower highs.
 *
 * @param data - OHLCV bars (minimum 20)
 * @returns PatternResult if detected, null otherwise
 */
function detectDescendingTriangle(data: OHLCV[]): PatternResult {
  if (data.length < 20) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 2 || lows.length < 2) return null!;

  const recentHighs = highs.slice(-3);
  const recentLows = lows.slice(-3);
  const lAvg = avg(recentLows.map(l => l.price));
  const lVar = recentLows.reduce((s, l) => s + Math.abs(l.price - lAvg), 0) / lAvg;
  const hFalling = recentHighs.length >= 2 && recentHighs[recentHighs.length - 1].price < recentHighs[0].price;

  if (lVar > 0.02 || !hFalling) return null!;

  const last = data[data.length - 1];
  const broken = last.close < lAvg;
  return {
    name: 'مثلث نزولی', nameEn: 'Descending Triangle', category: 'classic',
    direction: 'bearish', strength: 0.6 + (broken ? 0.4 : 0.2),
    status: broken ? 'completed' : 'forming',
    priceLevel: lAvg,
    description: `الگوی مثلث نزولی با حمایت ${lAvg.toFixed(0)}`
  };
}

/**
 * Detect a Symmetric Triangle (continuation) pattern.
 * Converging trendlines with similar slopes.
 *
 * @param data - OHLCV bars (minimum 20)
 * @returns PatternResult if detected, null otherwise
 */
function detectSymmetricTriangle(data: OHLCV[]): PatternResult {
  if (data.length < 20) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 3 || lows.length < 3) return null!;

  const rh = highs.slice(-3);
  const rl = lows.slice(-3);
  const hConverging = rh[rh.length - 1].price < rh[0].price;
  const lConverging = rl[rl.length - 1].price > rl[0].price;
  const hSlope = (rh[rh.length - 1].price - rh[0].price) / (rh[rh.length - 1].index - rh[0].index);
  const lSlope = (rl[rl.length - 1].price - rl[0].price) / (rl[rl.length - 1].index - rl[0].index);
  const slopeSim = 1 - Math.abs(Math.abs(hSlope) - Math.abs(lSlope)) / (Math.abs(hSlope) + Math.abs(lSlope) + 0.001);

  if (!hConverging || !lConverging || slopeSim < 0.5) return null!;

  const apex = (rh[rh.length - 1].price + rl[rl.length - 1].price) / 2;
  const last = data[data.length - 1];
  const dir = last.close > apex ? 'bullish' : 'bearish';

  return {
    name: 'مثلث متقارن', nameEn: 'Symmetric Triangle', category: 'classic',
    direction: dir as 'bullish' | 'bearish',
    strength: slopeSim * 0.7 + 0.3,
    status: 'forming',
    priceLevel: apex,
    description: `الگوی مثلث متقارن با رأس تقریبی ${apex.toFixed(0)}`
  };
}

/**
 * Detect an Ascending Wedge (bearish reversal) pattern.
 * Both trendlines rising but lower line rising faster (converging upward).
 *
 * @param data - OHLCV bars (minimum 25)
 * @returns PatternResult if detected, null otherwise
 */
function detectAscendingWedge(data: OHLCV[]): PatternResult {
  if (data.length < 25) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 3 || lows.length < 3) return null!;

  const rh = highs.slice(-3);
  const rl = lows.slice(-3);
  const hRising = rh[rh.length - 1].price > rh[0].price;
  const lRising = rl[rl.length - 1].price > rl[0].price;
  if (!hRising || !lRising) return null!;

  const hSlope = (rh[rh.length - 1].price - rh[0].price) / (rh[rh.length - 1].index - rh[0].index);
  const lSlope = (rl[rl.length - 1].price - rl[0].price) / (rl[rl.length - 1].index - rl[0].index);
  // Both rising but lows rising faster (converging upward)
  if (lSlope <= hSlope) return null!;

  const last = data[data.length - 1];
  const broken = last.close < rl[rl.length - 1].price;
  return {
    name: 'گوه صعودی', nameEn: 'Ascending Wedge', category: 'classic',
    direction: 'bearish', strength: 0.6 + (broken ? 0.4 : 0),
    status: broken ? 'completed' : 'forming',
    priceLevel: rl[rl.length - 1].price,
    description: `الگوی گوه صعودی — سیگنال نزولی`
  };
}

/**
 * Detect a Descending Wedge (bullish reversal) pattern.
 * Both trendlines falling but upper line falling faster (converging downward).
 *
 * @param data - OHLCV bars (minimum 25)
 * @returns PatternResult if detected, null otherwise
 */
function detectDescendingWedge(data: OHLCV[]): PatternResult {
  if (data.length < 25) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 3 || lows.length < 3) return null!;

  const rh = highs.slice(-3);
  const rl = lows.slice(-3);
  const hFalling = rh[rh.length - 1].price < rh[0].price;
  const lFalling = rl[rl.length - 1].price < rl[0].price;
  if (!hFalling || !lFalling) return null!;

  const hSlope = (rh[rh.length - 1].price - rh[0].price) / (rh[rh.length - 1].index - rh[0].index);
  const lSlope = (rl[rl.length - 1].price - rl[0].price) / (rl[rl.length - 1].index - rl[0].index);
  if (hSlope >= lSlope) return null!;

  const last = data[data.length - 1];
  const broken = last.close > rh[rh.length - 1].price;
  return {
    name: 'گوه نزولی', nameEn: 'Descending Wedge', category: 'classic',
    direction: 'bullish', strength: 0.6 + (broken ? 0.4 : 0),
    status: broken ? 'completed' : 'forming',
    priceLevel: rh[rh.length - 1].price,
    description: `الگوی گوه نزولی — سیگنال صعودی`
  };
}

/**
 * Detect a Bull Flag (bullish continuation) pattern.
 * Sharp price pole upward followed by a slight downward-sloping flag.
 *
 * @param data - OHLCV bars (minimum 20)
 * @returns PatternResult if detected, null otherwise
 */
function detectBullFlag(data: OHLCV[]): PatternResult {
  if (data.length < 20) return null!;
  const poleLen = Math.min(10, Math.floor(data.length * 0.3));
  const flagLen = Math.min(10, Math.floor(data.length * 0.2));
  const flagStart = data.length - flagLen;
  const poleEnd = flagStart;
  const poleStart = Math.max(0, poleEnd - poleLen);

  if (poleStart >= poleEnd) return null!;
  const poleRise = data[poleEnd - 1].close - data[poleStart].close;
  if (poleRise <= 0) return null!;

  const flagHighs = data.slice(flagStart).map(d => d.high);
  const flagLows = data.slice(flagStart).map(d => d.low);
  const flagTrend = sma(flagHighs, flagLen) - sma(flagLows, flagLen);
  const flagSlope = (flagHighs[flagHighs.length - 1] - flagHighs[0]) / (flagLen || 1);

  if (flagSlope > 0 || flagTrend > poleRise * 0.3) return null!;

  const last = data[data.length - 1];
  return {
    name: 'پرچم صعودی', nameEn: 'Bull Flag', category: 'classic',
    direction: 'bullish', strength: 0.5 + Math.min(poleRise / (last.close || 1), 0.3) + (flagSlope < 0 ? 0.2 : 0),
    status: 'forming',
    priceLevel: Math.max(...flagHighs),
    description: `الگوی پرچم صعودی — ادامه روند صعودی مورد انتظار`
  };
}

/**
 * Detect a Bear Flag (bearish continuation) pattern.
 * Sharp price pole downward followed by a slight upward-sloping flag.
 *
 * @param data - OHLCV bars (minimum 20)
 * @returns PatternResult if detected, null otherwise
 */
function detectBearFlag(data: OHLCV[]): PatternResult {
  if (data.length < 20) return null!;
  const poleLen = Math.min(10, Math.floor(data.length * 0.3));
  const flagLen = Math.min(10, Math.floor(data.length * 0.2));
  const flagStart = data.length - flagLen;
  const poleEnd = flagStart;
  const poleStart = Math.max(0, poleEnd - poleLen);

  if (poleStart >= poleEnd) return null!;
  const poleDrop = data[poleStart].close - data[poleEnd - 1].close;
  if (poleDrop <= 0) return null!;

  const flagHighs = data.slice(flagStart).map(d => d.high);
  const flagLows = data.slice(flagStart).map(d => d.low);
  const flagSlope = (flagLows[flagLows.length - 1] - flagLows[0]) / (flagLen || 1);

  if (flagSlope < 0) return null!;

  const last = data[data.length - 1];
  return {
    name: 'پرچم نزولی', nameEn: 'Bear Flag', category: 'classic',
    direction: 'bearish', strength: 0.5 + Math.min(poleDrop / (last.close || 1), 0.3) + (flagSlope > 0 ? 0.2 : 0),
    status: 'forming',
    priceLevel: Math.min(...flagLows),
    description: `الگوی پرچم نزولی — ادامه روند نزولی مورد انتظار`
  };
}

/**
 * Detect Pennant (bullish or bearish continuation) patterns.
 * Sharp price move (pole) followed by a small converging triangle (pennant).
 *
 * @param data - OHLCV bars (minimum 20)
 * @returns Array of detected Pennant patterns (0–1 results)
 */
function detectPennant(data: OHLCV[]): PatternResult[] {
  const results: PatternResult[] = [];
  if (data.length < 20) return results;

  const poleLen = Math.min(10, Math.floor(data.length * 0.25));
  const flagLen = Math.min(10, Math.floor(data.length * 0.15));
  const flagStart = data.length - flagLen;
  const poleEnd = flagStart;
  const poleStart = Math.max(0, poleEnd - poleLen);

  if (poleStart >= poleEnd || flagLen < 3) return results;

  const poleMove = data[poleEnd - 1].close - data[poleStart].close;
  const absPoleMove = Math.abs(poleMove);
  if (absPoleMove === 0) return results;

  const highs = data.slice(flagStart).map(d => d.high);
  const lows = data.slice(flagStart).map(d => d.low);
  const hConverge = highs[highs.length - 1] < highs[0];
  const lConverge = lows[lows.length - 1] > lows[0];
  if (!(hConverge && lConverge)) return results;

  const isBull = poleMove > 0;
  results.push({
    name: isBull ? 'پرچم‌نما صعودی' : 'پرچم‌نما نزولی',
    nameEn: isBull ? 'Bull Pennant' : 'Bear Pennant',
    category: 'classic',
    direction: isBull ? 'bullish' : 'bearish',
    strength: 0.7,
    status: 'forming',
    priceLevel: avg(highs),
    description: isBull
      ? 'الگوی پرچم‌نما صعودی — ادامۀ روند صعودی'
      : 'الگوی پرچم‌نما نزولی — ادامۀ روند نزولی'
  });
  return results;
}

/**
 * Detect a Cup & Handle (bullish continuation) pattern.
 * U-shaped cup followed by a smaller downward drift (handle).
 *
 * @param data - OHLCV bars (minimum 40)
 * @returns PatternResult if detected, null otherwise
 */
function detectCupAndHandle(data: OHLCV[]): PatternResult {
  if (data.length < 40) return null!;
  const swings = findSwingPoints(data, 3);
  const lows = swings.filter(s => s.type === 'low');
  if (lows.length < 3) return null!;

  // Look for U-shape: high, low, high with a small dip (handle)
  const recentLows = lows.slice(-5);
  if (recentLows.length < 3) return null!;

  // Cup: first and last swing lows should be near same level, middle ones lower
  const cupL = recentLows.slice(0, Math.ceil(recentLows.length * 0.7));
  const cupBottom = Math.min(...cupL.map(l => l.price));
  const cupRim = avg([recentLows[0].price, cupL[cupL.length - 1].price]);
  const depth = (cupRim - cupBottom) / cupRim;
  if (depth < 0.05 || depth > 0.5) return null!;

  const handleLows = recentLows.slice(Math.ceil(recentLows.length * 0.7));
  if (handleLows.length === 0) return null!;
  const handleDepth = (cupRim - avg(handleLows.map(l => l.price))) / cupRim;
  if (handleDepth > 0.3 * depth) return null!;

  const last = data[data.length - 1];
  const broken = last.close > cupRim;
  return {
    name: 'فنجان و دسته', nameEn: 'Cup & Handle', category: 'classic',
    direction: 'bullish', strength: 0.5 + (broken ? 0.3 : 0) + Math.min(depth, 0.2),
    status: broken ? 'completed' : 'forming',
    priceLevel: cupRim,
    description: `الگوی فنجان و دسته صعودی با سطح مقاومت ${cupRim.toFixed(0)}`
  };
}

/**
 * Detect a Rectangle / Channel (continuation) pattern.
 * Horizontal support and resistance with low variance.
 *
 * @param data - OHLCV bars (minimum 20)
 * @returns PatternResult if detected, null otherwise
 */
function detectRectangle(data: OHLCV[]): PatternResult {
  if (data.length < 20) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 2 || lows.length < 2) return null!;

  const rh = highs.slice(-3);
  const rl = lows.slice(-3);
  const hAvg = avg(rh.map(h => h.price));
  const lAvg = avg(rl.map(l => l.price));
  const hVar = rh.reduce((s, h) => s + Math.abs(h.price - hAvg), 0) / hAvg;
  const lVar = rl.reduce((s, l) => s + Math.abs(l.price - lAvg), 0) / lAvg;

  if (hVar > 0.03 || lVar > 0.03) return null!;
  if ((hAvg - lAvg) / lAvg < 0.02) return null!;

  const last = data[data.length - 1];
  const mid = (hAvg + lAvg) / 2;
  const dir = last.close > mid ? 'bullish' : 'bearish';

  return {
    name: 'مستطیل / کانال', nameEn: 'Rectangle / Channel', category: 'classic',
    direction: dir as 'bullish' | 'bearish',
    strength: (1 - hVar * 20) * (1 - lVar * 20),
    status: 'forming',
    priceLevel: mid,
    description: `الگوی مستطیل با محدوده ${lAvg.toFixed(0)} تا ${hAvg.toFixed(0)}`
  };
}

/**
 * Detect a Broadening Top (bearish) pattern.
 * Expanding triangle with rising highs and falling lows.
 *
 * @param data - OHLCV bars (minimum 25)
 * @returns PatternResult if detected, null otherwise
 */
function detectBroadeningTop(data: OHLCV[]): PatternResult {
  if (data.length < 25) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 3 || lows.length < 3) return null!;

  const rh = highs.slice(-3);
  const rl = lows.slice(-3);
  const hExpanding = rh[rh.length - 1].price > rh[0].price;
  const lExpanding = rl[rl.length - 1].price < rl[0].price;
  if (!hExpanding || !lExpanding) return null!;

  return {
    name: 'بالا‌گشاد', nameEn: 'Broadening Top', category: 'classic',
    direction: 'bearish', strength: 0.6,
    status: 'forming',
    priceLevel: rl[rl.length - 1].price,
    description: `الگوی بالا‌گشاد — افزایش نوسان و احتمال نزول`
  };
}

/**
 * Detect a Broadening Bottom (bullish) pattern.
 * Expanding triangle suggesting accumulation at the bottom.
 *
 * @param data - OHLCV bars (minimum 25)
 * @returns PatternResult if detected, null otherwise
 */
function detectBroadeningBottom(data: OHLCV[]): PatternResult {
  if (data.length < 25) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 3 || lows.length < 3) return null!;

  const rh = highs.slice(-3);
  const rl = lows.slice(-3);
  const hExpanding = rh[rh.length - 1].price > rh[0].price;
  const lExpanding = rl[rl.length - 1].price < rl[0].price;
  if (!hExpanding || !lExpanding) return null!;

  return {
    name: 'پایین‌گشاد', nameEn: 'Broadening Bottom', category: 'classic',
    direction: 'bullish', strength: 0.5,
    status: 'forming',
    description: `الگوی پایین‌گشاد — تجمع در کف و احتمال صعود`
  };
}

/**
 * Detect a Diamond Top (bearish reversal) pattern.
 * Broadening phase followed by converging phase at a market top.
 *
 * @param data - OHLCV bars (minimum 30)
 * @returns PatternResult if detected, null otherwise
 */
function detectDiamondTop(data: OHLCV[]): PatternResult {
  if (data.length < 30) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 4 || lows.length < 4) return null!;

  const rh = highs.slice(-4);
  const rl = lows.slice(-4);
  // Diamond: high-low-high-low pattern where highs rise then fall, lows fall then rise
  const h1 = rh[0].price, h2 = rh[1].price, h3 = rh[2].price, h4 = rh[3].price;
  const l1 = rl[0].price, l2 = rl[1].price, l3 = rl[2].price, l4 = rl[3].price;
  const topShape = h2 > h1 && h3 > h2 && h4 < h3;
  const bottomShape = l2 < l1 && l3 < l2 && l4 > l3;
  if (!topShape || !bottomShape) return null!;

  return {
    name: 'لوزی بالا', nameEn: 'Diamond Top', category: 'classic',
    direction: 'bearish', strength: 0.65,
    status: 'forming',
    priceLevel: (l1 + l4) / 2,
    description: `الگوی لوزی بالا — سیگنال بازگشت نزولی`
  };
}

/**
 * Detect a Diamond Bottom (bullish reversal) pattern.
 * Broadening phase followed by converging phase at a market bottom.
 *
 * @param data - OHLCV bars (minimum 30)
 * @returns PatternResult if detected, null otherwise
 */
function detectDiamondBottom(data: OHLCV[]): PatternResult {
  if (data.length < 30) return null!;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 4 || lows.length < 4) return null!;

  const rh = highs.slice(-4);
  const rl = lows.slice(-4);
  const h1 = rh[0].price, h2 = rh[1].price, h3 = rh[2].price, h4 = rh[3].price;
  const l1 = rl[0].price, l2 = rl[1].price, l3 = rl[2].price, l4 = rl[3].price;
  const topShape = h2 < h1 && h3 < h2 && h4 > h3;
  const bottomShape = l2 > l1 && l3 > l2 && l4 < l3;
  if (!topShape || !bottomShape) return null!;

  return {
    name: 'لوزی پایین', nameEn: 'Diamond Bottom', category: 'classic',
    direction: 'bullish', strength: 0.6,
    status: 'forming',
    description: `الگوی لوزی پایین — سیگنال بازگشت صعودی`
  };
}

/**
 * Detect all classic chart patterns in the given OHLCV data.
 *
 * Scans for 16 classic patterns:
 *   1. Head & Shoulders / Inverse Head & Shoulders
 *   2. Double Top / Double Bottom
 *   3. Triple Top / Triple Bottom
 *   4. Ascending Triangle / Descending Triangle / Symmetric Triangle
 *   5. Ascending Wedge / Descending Wedge
 *   6. Bull Flag / Bear Flag / Pennant
 *   7. Cup & Handle
 *   8. Rectangle / Channel
 *   9. Broadening Top / Broadening Bottom
 *  10. Diamond Top / Diamond Bottom
 *
 * @param data - Array of OHLCV bars (minimum length varies per pattern, 40+ recommended)
 * @returns Array of detected classic PatternResult objects
 */
function detectAllClassic(data: OHLCV[]): PatternResult[] {
  const r: PatternResult[] = [];
  r.push(...detectHeadAndShoulders(data));
  const dt = detectDoubleTop(data); if (dt) r.push(dt);
  const db = detectDoubleBottom(data); if (db) r.push(db);
  const tt = detectTripleTop(data); if (tt) r.push(tt);
  const tb = detectTripleBottom(data); if (tb) r.push(tb);
  const at = detectAscendingTriangle(data); if (at) r.push(at);
  const dtri = detectDescendingTriangle(data); if (dtri) r.push(dtri);
  const st = detectSymmetricTriangle(data); if (st) r.push(st);
  const aw = detectAscendingWedge(data); if (aw) r.push(aw);
  const dw = detectDescendingWedge(data); if (dw) r.push(dw);
  const bf = detectBullFlag(data); if (bf) r.push(bf);
  const brf = detectBearFlag(data); if (brf) r.push(brf);
  r.push(...detectPennant(data));
  const ch = detectCupAndHandle(data); if (ch) r.push(ch);
  const rect = detectRectangle(data); if (rect) r.push(rect);
  const bt = detectBroadeningTop(data); if (bt) r.push(bt);
  const bb = detectBroadeningBottom(data); if (bb) r.push(bb);
  const diamT = detectDiamondTop(data); if (diamT) r.push(diamT);
  const diamB = detectDiamondBottom(data); if (diamB) r.push(diamB);
  return r;
}

// ─── 2. Harmonic Pattern Detectors ──────────────────────────────────────────

/**
 * Specification of a harmonic pattern's expected Fibonacci ratios.
 * Used to match the AB, BC, and CD legs against target ratios within tolerance.
 */
interface HarmonicSpec {
  /** Persian name */
  name: string;
  /** English name */
  nameEn: string;
  /** Expected AB/XA Fibonacci ratio */
  abRatio: number;
  /** Expected BC/AB Fibonacci ratio */
  bcRatio: number;
  /** Expected CD/BC Fibonacci ratio */
  cdRatio: number;
}

const HARMONIC_SPECS: Record<string, { bull: HarmonicSpec; bear: HarmonicSpec }> = {
  gartley: {
    bull: { name: 'گارتلی صعودی', nameEn: 'Bullish Gartley', abRatio: PHI_618, bcRatio: PHI_386, cdRatio: PHI_786 },
    bear: { name: 'گارتلی نزولی', nameEn: 'Bearish Gartley', abRatio: PHI_618, bcRatio: PHI_386, cdRatio: PHI_786 }
  },
  butterfly: {
    bull: { name: 'پروانه صعودی', nameEn: 'Bullish Butterfly', abRatio: PHI_786, bcRatio: PHI_386, cdRatio: PHI_1618 },
    bear: { name: 'پروانه نزولی', nameEn: 'Bearish Butterfly', abRatio: PHI_786, bcRatio: PHI_386, cdRatio: PHI_1618 }
  },
  bat: {
    bull: { name: 'خفاش صعودی', nameEn: 'Bullish Bat', abRatio: PHI_386, bcRatio: PHI_886, cdRatio: PHI_886 },
    bear: { name: 'خفاش نزولی', nameEn: 'Bearish Bat', abRatio: PHI_386, bcRatio: PHI_886, cdRatio: PHI_886 }
  },
  crab: {
    bull: { name: 'خرچنگ صعودی', nameEn: 'Bullish Crab', abRatio: PHI_386, bcRatio: PHI_386, cdRatio: PHI_1618 },
    bear: { name: 'خرچنگ نزولی', nameEn: 'Bearish Crab', abRatio: PHI_386, bcRatio: PHI_386, cdRatio: PHI_1618 }
  },
  shark: {
    bull: { name: 'کوسه صعودی', nameEn: 'Bullish Shark', abRatio: PHI_786, bcRatio: PHI, cdRatio: PHI_886 },
    bear: { name: 'کوسه نزولی', nameEn: 'Bearish Shark', abRatio: PHI_786, bcRatio: PHI, cdRatio: PHI_886 }
  },
  cypher: {
    bull: { name: 'سایفر صعودی', nameEn: 'Bullish Cypher', abRatio: PHI_786, bcRatio: PHI_127, cdRatio: PHI_786 },
    bear: { name: 'سایفر نزولی', nameEn: 'Bearish Cypher', abRatio: PHI_786, bcRatio: PHI_127, cdRatio: PHI_786 }
  }
};

/**
 * Attempt to match a harmonic pattern against five pivot prices (X, A, B, C, D).
 *
 * Computes the actual AB/XA, BC/AB, and CD/BC ratios and compares each against
 * the spec's expected ratios within a 5% tolerance. At least 2 of 3 ratios must
 * match for the pattern to qualify.
 *
 * @param X         - Price at pivot X (pattern origin)
 * @param A         - Price at pivot A
 * @param B         - Price at pivot B
 * @param C         - Price at pivot C
 * @param D         - Price at pivot D (PRZ / Potential Reversal Zone)
 * @param spec      - Harmonic pattern specification with expected Fibonacci ratios
 * @param direction - 'bullish' or 'bearish'
 * @returns A PatternResult if at least 2 of 3 ratio conditions match, otherwise null
 */
function detectHarmonicFromPoints(
  X: number, A: number, B: number, C: number, D: number,
  spec: HarmonicSpec,
  direction: 'bullish' | 'bearish'
): PatternResult | null {
  const xLeg = Math.abs(A - X);
  const aLeg = Math.abs(B - A);
  const bLeg = Math.abs(C - B);
  const cLeg = Math.abs(D - C);

  if (xLeg === 0 || aLeg === 0 || bLeg === 0) return null;

  const abR = aLeg / xLeg;
  const bcR = bLeg / aLeg;
  const cdR = cLeg / bLeg;

  const abMatch = nearRatio(abR, spec.abRatio, FIB_TOL);
  const bcMatch = nearRatio(bcR, spec.bcRatio, FIB_TOL);
  const cdMatch = nearRatio(cdR, spec.cdRatio, FIB_TOL);

  let conditions = 0;
  if (abMatch) conditions++;
  if (bcMatch) conditions++;
  if (cdMatch) conditions++;

  if (conditions < 2) return null;

  const strength = conditions === 3 ? 0.9 : 0.6;
  const prz = (B + C) / 2; // Potential Reversal Zone

  return {
    name: spec.name,
    nameEn: spec.nameEn,
    category: 'harmonic',
    direction,
    strength,
    status: 'forming',
    priceLevel: prz,
    description: `الگوی هارمونیک ${spec.nameEn} در ناحیه بازگشتی ${prz.toFixed(0)}`
  };
}

/**
 * Detect all harmonic patterns in the given OHLCV data.
 *
 * Scans recent combinations of 5 swing points (X, A, B, C, D) against 6 specs:
 *   1. Gartley  (AB=0.618, BC=0.382, CD=0.786)
 *   2. Butterfly (AB=0.786, BC=0.382, CD=1.618)
 *   3. Bat      (AB=0.382, BC=0.886, CD=0.886)
 *   4. Crab     (AB=0.382, BC=0.382, CD=1.618)
 *   5. Shark    (AB=0.786, BC=0.618, CD=0.886)
 *   6. Cypher   (AB=0.786, BC=1.27,  CD=0.786)
 *
 * Both bullish and bearish variants are tested. Results are deduplicated by nameEn.
 *
 * @param data - Array of OHLCV bars (minimum 20)
 * @returns Array of detected harmonic PatternResult objects
 */
function detectAllHarmonics(data: OHLCV[]): PatternResult[] {
  const results: PatternResult[] = [];
  if (data.length < 20) return results;

  const swings = findSwingPoints(data, 2);
  if (swings.length < 5) return results;

  // Try recent combinations of 5 swing points (X, A, B, C, D)
  const recent = swings.slice(-8);
  for (let i = 0; i <= recent.length - 5; i++) {
    const pts = recent.slice(i, i + 5);
    // X, A should alternate high/low
    for (const [key, { bull, bear }] of Object.entries(HARMONIC_SPECS)) {
      // Bullish: X is high, A is low, B is high, C is low, D is high
      const bullPt = detectHarmonicFromPoints(
        pts[0].type === 'high' ? pts[0].price : 0,
        pts[1].type === 'low' ? pts[1].price : 0,
        pts[2].type === 'high' ? pts[2].price : 0,
        pts[3].type === 'low' ? pts[3].price : 0,
        pts[4].type === 'high' ? pts[4].price : 0,
        bull, 'bullish'
      );
      if (bullPt) results.push(bullPt);

      // Bearish: X is low, A is high, B is low, C is high, D is low
      const bearPt = detectHarmonicFromPoints(
        pts[0].type === 'low' ? pts[0].price : 0,
        pts[1].type === 'high' ? pts[1].price : 0,
        pts[2].type === 'low' ? pts[2].price : 0,
        pts[3].type === 'high' ? pts[3].price : 0,
        pts[4].type === 'low' ? pts[4].price : 0,
        bear, 'bearish'
      );
      if (bearPt) results.push(bearPt);
    }
  }

  // Deduplicate by nameEn
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.nameEn)) return false;
    seen.add(r.nameEn);
    return true;
  });
}

// ─── 3. Candlestick Pattern Detectors ───────────────────────────────────────

/**
 * Detect a Hammer (bullish single-candle) pattern.
 * Small body at top with long lower shadow (≥2× body), in downtrend.
 *
 * @param data - OHLCV bars (minimum 5 for trend confirmation)
 * @returns PatternResult if detected, null otherwise
 */
function detectHammer(data: OHLCV[]): PatternResult | null {
  if (data.length < 1) return null;
  const c = data[data.length - 1];
  const range = totalRange(c);
  if (range === 0) return null;
  const body = bodySize(c);
  const ls = lowerShadow(c);
  const us = upperShadow(c);
  if (ls < body * 2) return null;
  if (us > body * 0.5) return null;
  // Must be in downtrend
  if (data.length < 5) return null;
  const prevTrend = data.slice(-6, -1).filter(d => isBearish(d)).length >= 3;
  if (!prevTrend) return null;
  return {
    name: 'چکش', nameEn: 'Hammer', category: 'candlestick',
    direction: 'bullish', strength: 0.6 + Math.min(ls / range, 0.3),
    status: 'completed', priceLevel: c.low,
    description: 'الگوی چکش در انتهای روند نزولی — سیگنال صعودی'
  };
}

/**
 * Detect an Inverted Hammer (bullish single-candle) pattern.
 * Small body at bottom with long upper shadow (≥2× body), in downtrend.
 *
 * @param data - OHLCV bars (minimum 5 for trend confirmation)
 * @returns PatternResult if detected, null otherwise
 */
function detectInvertedHammer(data: OHLCV[]): PatternResult | null {
  if (data.length < 1) return null;
  const c = data[data.length - 1];
  const range = totalRange(c);
  if (range === 0) return null;
  const body = bodySize(c);
  const us = upperShadow(c);
  const ls = lowerShadow(c);
  if (us < body * 2) return null;
  if (ls > body * 0.5) return null;
  if (data.length < 5) return null;
  const prevTrend = data.slice(-6, -1).filter(d => isBearish(d)).length >= 3;
  if (!prevTrend) return null;
  return {
    name: 'چکش معکوس', nameEn: 'Inverted Hammer', category: 'candlestick',
    direction: 'bullish', strength: 0.55 + Math.min(us / range, 0.3),
    status: 'completed', priceLevel: c.high,
    description: 'الگوی چکش معکوس — سیگنال صعودی ضعیف'
  };
}

/**
 * Detect a Bullish Engulfing (two-candle reversal) pattern.
 * Bearish candle followed by a larger bullish candle that engulfs it.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectBullishEngulfing(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const prev = data[data.length - 2];
  const curr = data[data.length - 1];
  if (!isBearish(prev) || !isBullish(curr)) return null;
  if (curr.open <= prev.close) return null;
  if (curr.close >= prev.open) return null;
  const engulfs = bodySize(curr) > bodySize(prev);
  if (!engulfs) return null;
  return {
    name: 'پوشای صعودی', nameEn: 'Bullish Engulfing', category: 'candlestick',
    direction: 'bullish', strength: 0.7 + (curr.volume > (prev.volume || curr.volume) ? 0.2 : 0),
    status: 'completed',
    description: 'الگوی پوشای صعودی — سیگنال بازگشت قوی'
  };
}

/**
 * Detect a Morning Star (bullish three-candle reversal) pattern.
 * Large bearish candle, small-body star, large bullish candle.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectMorningStar(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBearish(c1) || !isBullish(c3)) return null;
  const c2Body = bodySize(c2);
  const c1Body = bodySize(c1);
  const c3Body = bodySize(c3);
  if (c2Body > c1Body * 0.3) return null; // star should be small
  const gap = c2.high < c1.close;
  return {
    name: 'ستاره صبحگاهی', nameEn: 'Morning Star', category: 'candlestick',
    direction: 'bullish', strength: 0.65 + (gap ? 0.2 : 0) + (c3Body > c1Body ? 0.1 : 0),
    status: 'completed', priceLevel: c2.low,
    description: 'الگوی ستاره صبحگاهی — سیگنال بازگشت صعودی سه‌کندلی'
  };
}

/**
 * Detect Three White Soldiers (bullish three-candle) pattern.
 * Three consecutive bullish candles with progressively higher opens and closes.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectThreeWhiteSoldiers(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBullish(c1) || !isBullish(c2) || !isBullish(c3)) return null;
  if (c2.open > c1.open && c3.open > c2.open && c2.close > c1.close && c3.close > c2.close) {
    return {
      name: 'سه سرباز سفید', nameEn: 'Three White Soldiers', category: 'candlestick',
      direction: 'bullish', strength: 0.8,
      status: 'completed',
      description: 'الگوی سه سرباز سفید — سیگنال صعودی بسیار قوی'
    };
  }
  return null;
}

/**
 * Detect a Piercing Line (bullish two-candle) pattern.
 * Bearish candle followed by bullish candle closing above its midpoint.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectPiercingLine(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const prev = data[data.length - 2];
  const curr = data[data.length - 1];
  if (!isBearish(prev) || !isBullish(curr)) return null;
  const midpoint = (prev.open + prev.close) / 2;
  if (curr.close < midpoint || curr.open > prev.close) return null;
  return {
    name: 'خط نفوذی', nameEn: 'Piercing Line', category: 'candlestick',
    direction: 'bullish', strength: 0.6 + (curr.close > midpoint ? 0.15 : 0),
    status: 'completed',
    description: 'الگوی خط نفوذی — سیگنال بازگشت صعودی'
  };
}

/**
 * Detect a Bullish Harami (two-candle) pattern.
 * Large bearish candle containing a smaller bullish candle.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectBullishHarami(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const prev = data[data.length - 2];
  const curr = data[data.length - 1];
  if (!isBearish(prev) || !isBullish(curr)) return null;
  if (curr.open < prev.close || curr.close > prev.open) return null;
  if (bodySize(curr) >= bodySize(prev)) return null;
  return {
    name: 'هارامی صعودی', nameEn: 'Bullish Harami', category: 'candlestick',
    direction: 'bullish', strength: 0.55,
    status: 'completed',
    description: 'الگوی هارامی صعودی — احتمال توقف نزول'
  };
}

/**
 * Detect a Tweezer Bottom (bullish two-candle) pattern.
 * Two candles with matching lows, first bearish then bullish.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectTweezerBottom(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const c1 = data[data.length - 2];
  const c2 = data[data.length - 1];
  const tol = totalRange(c1) * 0.05;
  if (Math.abs(c1.low - c2.low) > tol) return null;
  if (!isBearish(c1) || !isBullish(c2)) return null;
  return {
    name: 'دوقلوی کف', nameEn: 'Tweezer Bottom', category: 'candlestick',
    direction: 'bullish', strength: 0.6,
    status: 'completed', priceLevel: c1.low,
    description: 'الگوی دوقلوی کف — حمایت دوقلو'
  };
}

/**
 * Detect a Dragonfly Doji (bullish single-candle) pattern.
 * Doji with no upper shadow and long lower shadow.
 *
 * @param data - OHLCV bars (minimum 1)
 * @returns PatternResult if detected, null otherwise
 */
function detectDragonflyDoji(data: OHLCV[]): PatternResult | null {
  if (data.length < 1) return null;
  const c = data[data.length - 1];
  const body = bodySize(c);
  const range = totalRange(c);
  if (range === 0) return null;
  if (body > range * 0.05) return null; // doji body must be very small
  if (upperShadow(c) > range * 0.05) return null;
  return {
    name: 'دوجی سنجاقک', nameEn: 'Dragonfly Doji', category: 'candlestick',
    direction: 'bullish', strength: 0.55,
    status: 'completed', priceLevel: c.low,
    description: 'الگوی دوجی سنجاقک — سیگنال بازگشت صعودی'
  };
}

/**
 * Detect a Bullish Marubozu (single-candle) pattern.
 * Bullish candle with negligible shadows (open = low, close = high).
 *
 * @param data - OHLCV bars (minimum 1)
 * @returns PatternResult if detected, null otherwise
 */
function detectBullishMarubozu(data: OHLCV[]): PatternResult | null {
  if (data.length < 1) return null;
  const c = data[data.length - 1];
  if (!isBullish(c)) return null;
  const range = totalRange(c);
  if (range === 0) return null;
  if (upperShadow(c) > range * 0.05 || lowerShadow(c) > range * 0.05) return null;
  return {
    name: 'ماروبوزوی صعودی', nameEn: 'Bullish Marubozu', category: 'candlestick',
    direction: 'bullish', strength: 0.75,
    status: 'completed',
    description: 'الگوی ماروبوزوی صعودی — خریداران قدرتمند'
  };
}

/**
 * Detect Rising Three Methods (bullish five-candle continuation) pattern.
 * Long bullish candle, three small bearish candles within its range, then another bullish candle.
 *
 * @param data - OHLCV bars (minimum 5)
 * @returns PatternResult if detected, null otherwise
 */
function detectRisingThreeMethods(data: OHLCV[]): PatternResult | null {
  if (data.length < 5) return null;
  const c1 = data[data.length - 5];
  const c5 = data[data.length - 1];
  if (!isBullish(c1) || !isBullish(c5)) return null;
  const mid = data.slice(-4, -1);
  const allBearish = mid.every(d => isBearish(d));
  if (!allBearish) return null;
  if (c5.close < c1.close) return null;
  if (c5.close <= c1.open) return null;
  const midLow = Math.min(...mid.map(d => d.low));
  if (midLow < c1.open) return null;
  return {
    name: 'سه روش صعودی', nameEn: 'Rising Three Methods', category: 'candlestick',
    direction: 'bullish', strength: 0.7,
    status: 'completed',
    description: 'الگوی سه روش صعودی — استراحت و ادامۀ صعود'
  };
}

/**
 * Detect a Bullish Kicker (two-candle strong reversal) pattern.
 * Bearish candle followed by a gap-up bullish candle — sudden sentiment shift.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectBullishKicker(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const prev = data[data.length - 2];
  const curr = data[data.length - 1];
  if (!isBearish(prev) || !isBullish(curr)) return null;
  if (curr.open >= prev.close) return null; // gap up
  return {
    name: 'کیکر صعودی', nameEn: 'Bullish Kicker', category: 'candlestick',
    direction: 'bullish', strength: 0.85,
    status: 'completed',
    description: 'الگوی کیکر صعودی — تغییر جهت ناگهانی و قوی'
  };
}

/**
 * Detect Three Inside Up (bullish three-candle confirmation) pattern.
 * Bearish candle, smaller bullish inside it, then bullish closing above first candle's open.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectThreeInsideUp(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBearish(c1) || !isBullish(c2) || !isBullish(c3)) return null;
  if (c2.close > c1.close || c2.open < c1.close) return null;
  if (c3.close > c1.open) return {
    name: 'سه درونی صعودی', nameEn: 'Three Inside Up', category: 'candlestick',
    direction: 'bullish', strength: 0.7,
    status: 'completed',
    description: 'الگوی سه درونی صعودی — تأیید بازگشت'
  };
  return null;
}

/**
 * Detect Three Outside Up (bullish three-candle confirmation) pattern.
 * Bearish candle engulfed by bullish, then another bullish closing higher.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectThreeOutsideUp(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBearish(c1) || !isBullish(c2) || !isBullish(c3)) return null;
  if (!(c2.open < c1.close && c2.close > c1.open)) return null; // engulfing
  if (c3.close > c2.close) return {
    name: 'سه بیرونی صعودی', nameEn: 'Three Outside Up', category: 'candlestick',
    direction: 'bullish', strength: 0.72,
    status: 'completed',
    description: 'الگوی سه بیرونی صعودی — ادامه صعود'
  };
  return null;
}

/**
 * Detect Mat Hold (bullish five-candle continuation) pattern.
 * Bullish candle, bearish retreat, then bullish continuation closing above first high.
 *
 * @param data - OHLCV bars (minimum 5)
 * @returns PatternResult if detected, null otherwise
 */
function detectMatHold(data: OHLCV[]): PatternResult | null {
  if (data.length < 5) return null;
  const c1 = data[data.length - 5];
  const c5 = data[data.length - 1];
  if (!isBullish(c1) || !isBullish(c5)) return null;
  const mid = data.slice(-4, -1);
  if (!isBearish(mid[0])) return null;
  if (c5.close > c1.high && c5.close > c1.close) {
    return {
      name: 'مات هولد', nameEn: 'Mat Hold', category: 'candlestick',
      direction: 'bullish', strength: 0.7,
      status: 'completed',
      description: 'الگوی مات هولد — ادامۀ روند صعودی'
    };
  }
  return null;
}

/**
 * Detect Stick Sandwich (bullish three-candle) pattern.
 * Bullish, bearish, bullish with matching open prices of first and third candles.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectStickSandwich(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBullish(c1) || !isBearish(c2) || !isBullish(c3)) return null;
  const tol = totalRange(c1) * 0.03;
  if (Math.abs(c1.open - c3.open) > tol) return null;
  return {
    name: 'ساندویچ چوبی', nameEn: 'Stick Sandwich', category: 'candlestick',
    direction: 'bullish', strength: 0.55,
    status: 'completed',
    description: 'الگوی ساندویچ چوبی — سیگنال صعودی'
  };
}

/**
 * Detect Bullish Breakaway (five-candle reversal) pattern.
 * Bearish with gap-down, then recovery closing above first candle's close.
 *
 * @param data - OHLCV bars (minimum 5)
 * @returns PatternResult if detected, null otherwise
 */
function detectBullishBreakaway(data: OHLCV[]): PatternResult | null {
  if (data.length < 5) return null;
  const c1 = data[data.length - 5];
  const c5 = data[data.length - 1];
  if (!isBearish(c1) || !isBullish(c5)) return null;
  // Gap down at c2
  const c2 = data[data.length - 4];
  if (c2.high > c1.low) return null;
  const mid = data.slice(-4, -1);
  if (!mid.every(d => d.close < c1.close)) return null;
  return {
    name: 'شکاف صعودی', nameEn: 'Bullish Breakaway', category: 'candlestick',
    direction: 'bullish', strength: 0.65,
    status: 'completed',
    description: 'الگوی شکاف صعودی — بازگشت از شکاف'
  };
}

/**
 * Detect Three Stars in South (bullish three-candle) pattern.
 * Three bearish candles with progressively smaller bodies and lower shadows — selling exhaustion.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectThreeStarsInSouth(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBearish(c1) || !isBearish(c2) || !isBearish(c3)) return null;
  // Each candle has progressively smaller body and lower shadow
  if (bodySize(c2) >= bodySize(c1)) return null;
  if (bodySize(c3) >= bodySize(c2)) return null;
  if (lowerShadow(c1) < bodySize(c1) * 0.5) return null;
  if (lowerShadow(c2) >= lowerShadow(c1)) return null;
  if (c3.low >= c2.low) return null;
  return {
    name: 'سه ستاره در جنوب', nameEn: 'Three Stars in South', category: 'candlestick',
    direction: 'bullish', strength: 0.6,
    status: 'completed',
    description: 'الگوی سه ستاره در جنوب — تضعیف نیروی فروش'
  };
}

/**
 * Detect Bullish Separating Lines (two-candle) pattern.
 * Bearish candle followed by bullish candle with same open price.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectBullishSeparatingLines(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const c1 = data[data.length - 2];
  const c2 = data[data.length - 1];
  if (!isBearish(c1) || !isBullish(c2)) return null;
  if (c2.open !== c1.open) return null; // same open price
  return {
    name: 'خطوط جداشونده صعودی', nameEn: 'Bullish Separating Lines', category: 'candlestick',
    direction: 'bullish', strength: 0.55,
    status: 'completed',
    description: 'الگوی خطوط جداشونده صعودی'
  };
}

/**
 * Detect Homing Pigeon (bullish two-candle) pattern.
 * Two bearish candles where the second is contained within the first — seller weakness.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectHomingPigeon(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const c1 = data[data.length - 2];
  const c2 = data[data.length - 1];
  if (!isBearish(c1) || !isBearish(c2)) return null;
  if (c2.open < c1.close || c2.close > c1.open) return null;
  if (bodySize(c2) >= bodySize(c1)) return null;
  return {
    name: 'کبوتر خانه‌گردان', nameEn: 'Homing Pigeon', category: 'candlestick',
    direction: 'bullish', strength: 0.5,
    status: 'completed',
    description: 'الگوی کبوتر خانه‌گردان — ضعف فروشندگان'
  };
}

/**
 * Detect Ladder Bottom (bullish five-candle) pattern.
 * Four bearish candles making progressively lower lows, then a bullish candle — seller exhaustion.
 *
 * @param data - OHLCV bars (minimum 5)
 * @returns PatternResult if detected, null otherwise
 */
function detectLadderBottom(data: OHLCV[]): PatternResult | null {
  if (data.length < 5) return null;
  const candles = data.slice(-5);
  if (!candles.slice(0, 4).every(c => isBearish(c))) return null;
  if (!isBullish(candles[4])) return null;
  // Each successive low should be lower (or equal) with decreasing body
  for (let i = 1; i < 4; i++) {
    if (candles[i].low > candles[i - 1].low) return null;
    if (bodySize(candles[i]) > bodySize(candles[i - 1]) * 1.2) return null;
  }
  return {
    name: 'نردبان کف', nameEn: 'Ladder Bottom', category: 'candlestick',
    direction: 'bullish', strength: 0.65,
    status: 'completed',
    description: 'الگوی نردبان کف — خستگی فروشندگان'
  };
}

// ─── Bearish Candlestick Patterns ────────────────────────────────────────────

/**
 * Detect a Hanging Man (bearish single-candle) pattern.
 * Hammer-like candle appearing at the top of an uptrend.
 *
 * @param data - OHLCV bars (minimum 6 for trend confirmation)
 * @returns PatternResult if detected, null otherwise
 */
function detectHangingMan(data: OHLCV[]): PatternResult | null {
  if (data.length < 6) return null;
  const c = data[data.length - 1];
  const range = totalRange(c);
  if (range === 0) return null;
  const body = bodySize(c);
  const ls = lowerShadow(c);
  const us = upperShadow(c);
  if (ls < body * 2) return null;
  if (us > body * 0.5) return null;
  const prevTrend = data.slice(-6, -1).filter(d => isBullish(d)).length >= 3;
  if (!prevTrend) return null;
  return {
    name: 'مرد به دار آویخته', nameEn: 'Hanging Man', category: 'candlestick',
    direction: 'bearish', strength: 0.6 + Math.min(ls / range, 0.2),
    status: 'completed', priceLevel: c.low,
    description: 'الگوی مرد به دار آویخته — سیگنال نزولی در سقف'
  };
}

/**
 * Detect a Shooting Star (bearish single-candle) pattern.
 * Small body at bottom with long upper shadow (≥2× body), in uptrend.
 *
 * @param data - OHLCV bars (minimum 6 for trend confirmation)
 * @returns PatternResult if detected, null otherwise
 */
function detectShootingStar(data: OHLCV[]): PatternResult | null {
  if (data.length < 6) return null;
  const c = data[data.length - 1];
  const range = totalRange(c);
  if (range === 0) return null;
  const body = bodySize(c);
  const us = upperShadow(c);
  const ls = lowerShadow(c);
  if (us < body * 2) return null;
  if (ls > body * 0.5) return null;
  const prevTrend = data.slice(-6, -1).filter(d => isBullish(d)).length >= 3;
  if (!prevTrend) return null;
  return {
    name: 'ستاره دنباله‌دار', nameEn: 'Shooting Star', category: 'candlestick',
    direction: 'bearish', strength: 0.6 + Math.min(us / range, 0.3),
    status: 'completed', priceLevel: c.high,
    description: 'الگوی ستاره دنباله‌دار — سیگنال نزولی قوی'
  };
}

/**
 * Detect a Bearish Engulfing (two-candle reversal) pattern.
 * Bullish candle followed by a larger bearish candle that engulfs it.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectBearishEngulfing(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const prev = data[data.length - 2];
  const curr = data[data.length - 1];
  if (!isBullish(prev) || !isBearish(curr)) return null;
  if (curr.open >= prev.close) return null;
  if (curr.close <= prev.open) return null;
  if (bodySize(curr) <= bodySize(prev)) return null;
  return {
    name: 'پوشای نزولی', nameEn: 'Bearish Engulfing', category: 'candlestick',
    direction: 'bearish', strength: 0.7 + (curr.volume > (prev.volume || curr.volume) ? 0.2 : 0),
    status: 'completed',
    description: 'الگوی پوشای نزولی — سیگنال بازگشت نزولی قوی'
  };
}

/**
 * Detect an Evening Star (bearish three-candle reversal) pattern.
 * Large bullish candle, small-body star, large bearish candle.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectEveningStar(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBullish(c1) || !isBearish(c3)) return null;
  const c2Body = bodySize(c2);
  if (c2Body > bodySize(c1) * 0.3) return null;
  const gap = c2.low > c1.close;
  return {
    name: 'ستاره شامگاهی', nameEn: 'Evening Star', category: 'candlestick',
    direction: 'bearish', strength: 0.65 + (gap ? 0.2 : 0),
    status: 'completed', priceLevel: c2.high,
    description: 'الگوی ستاره شامگاهی — سیگنال بازگشت نزولی سه‌کندلی'
  };
}

/**
 * Detect Three Black Crows (bearish three-candle) pattern.
 * Three consecutive bearish candles with progressively lower opens and closes.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectThreeBlackCrows(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBearish(c1) || !isBearish(c2) || !isBearish(c3)) return null;
  if (c2.open < c1.open && c3.open < c2.open && c2.close < c1.close && c3.close < c2.close) {
    return {
      name: 'سه کلاغ سیاه', nameEn: 'Three Black Crows', category: 'candlestick',
      direction: 'bearish', strength: 0.8,
      status: 'completed',
      description: 'الگوی سه کلاغ سیاه — سیگنال نزولی بسیار قوی'
    };
  }
  return null;
}

/**
 * Detect Dark Cloud Cover (bearish two-candle) pattern.
 * Bullish candle followed by bearish candle closing below its midpoint.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectDarkCloudCover(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const prev = data[data.length - 2];
  const curr = data[data.length - 1];
  if (!isBullish(prev) || !isBearish(curr)) return null;
  const midpoint = (prev.open + prev.close) / 2;
  if (curr.close > midpoint || curr.open < prev.close) return null;
  return {
    name: 'پوشش ابر تیره', nameEn: 'Dark Cloud Cover', category: 'candlestick',
    direction: 'bearish', strength: 0.65,
    status: 'completed',
    description: 'الگوی پوشش ابر تیره — سیگنال بازگشت نزولی'
  };
}

/**
 * Detect a Bearish Harami (two-candle) pattern.
 * Large bullish candle containing a smaller bearish candle.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectBearishHarami(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const prev = data[data.length - 2];
  const curr = data[data.length - 1];
  if (!isBullish(prev) || !isBearish(curr)) return null;
  if (curr.open > prev.close || curr.close < prev.open) return null;
  if (bodySize(curr) >= bodySize(prev)) return null;
  return {
    name: 'هارامی نزولی', nameEn: 'Bearish Harami', category: 'candlestick',
    direction: 'bearish', strength: 0.55,
    status: 'completed',
    description: 'الگوی هارامی نزولی — احتمال توقف صعود'
  };
}

/**
 * Detect a Tweezer Top (bearish two-candle) pattern.
 * Two candles with matching highs, first bullish then bearish.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectTweezerTop(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const c1 = data[data.length - 2];
  const c2 = data[data.length - 1];
  const tol = totalRange(c1) * 0.05;
  if (Math.abs(c1.high - c2.high) > tol) return null;
  if (!isBullish(c1) || !isBearish(c2)) return null;
  return {
    name: 'دوقلوی سقف', nameEn: 'Tweezer Top', category: 'candlestick',
    direction: 'bearish', strength: 0.6,
    status: 'completed', priceLevel: c1.high,
    description: 'الگوی دوقلوی سقف — مقاومت دوقلو'
  };
}

/**
 * Detect a Gravestone Doji (bearish single-candle) pattern.
 * Doji with no lower shadow and long upper shadow.
 *
 * @param data - OHLCV bars (minimum 1)
 * @returns PatternResult if detected, null otherwise
 */
function detectGravestoneDoji(data: OHLCV[]): PatternResult | null {
  if (data.length < 1) return null;
  const c = data[data.length - 1];
  const body = bodySize(c);
  const range = totalRange(c);
  if (range === 0) return null;
  if (body > range * 0.05) return null;
  if (lowerShadow(c) > range * 0.05) return null;
  return {
    name: 'دوجی سنگ قبر', nameEn: 'Gravestone Doji', category: 'candlestick',
    direction: 'bearish', strength: 0.55,
    status: 'completed', priceLevel: c.high,
    description: 'الگوی دوجی سنگ قبر — سیگنال نزولی'
  };
}

/**
 * Detect a Bearish Marubozu (single-candle) pattern.
 * Bearish candle with negligible shadows (open = high, close = low).
 *
 * @param data - OHLCV bars (minimum 1)
 * @returns PatternResult if detected, null otherwise
 */
function detectBearishMarubozu(data: OHLCV[]): PatternResult | null {
  if (data.length < 1) return null;
  const c = data[data.length - 1];
  if (!isBearish(c)) return null;
  const range = totalRange(c);
  if (range === 0) return null;
  if (upperShadow(c) > range * 0.05 || lowerShadow(c) > range * 0.05) return null;
  return {
    name: 'ماروبوزوی نزولی', nameEn: 'Bearish Marubozu', category: 'candlestick',
    direction: 'bearish', strength: 0.75,
    status: 'completed',
    description: 'الگوی ماروبوزوی نزولی — فروشندگان قدرتمند'
  };
}

/**
 * Detect Falling Three Methods (bearish five-candle continuation) pattern.
 * Long bearish candle, three small bullish candles within its range, then another bearish candle.
 *
 * @param data - OHLCV bars (minimum 5)
 * @returns PatternResult if detected, null otherwise
 */
function detectFallingThreeMethods(data: OHLCV[]): PatternResult | null {
  if (data.length < 5) return null;
  const c1 = data[data.length - 5];
  const c5 = data[data.length - 1];
  if (!isBearish(c1) || !isBearish(c5)) return null;
  const mid = data.slice(-4, -1);
  const allBullish = mid.every(d => isBullish(d));
  if (!allBullish) return null;
  if (c5.close > c1.close) return null;
  const midHigh = Math.max(...mid.map(d => d.high));
  if (midHigh > c1.open) return null;
  return {
    name: 'سه روش نزولی', nameEn: 'Falling Three Methods', category: 'candlestick',
    direction: 'bearish', strength: 0.7,
    status: 'completed',
    description: 'الگوی سه روش نزولی — استراحت و ادامۀ نزول'
  };
}

/**
 * Detect a Bearish Kicker (two-candle strong reversal) pattern.
 * Bullish candle followed by a gap-down bearish candle — sudden sentiment shift.
 *
 * @param data - OHLCV bars (minimum 2)
 * @returns PatternResult if detected, null otherwise
 */
function detectBearishKicker(data: OHLCV[]): PatternResult | null {
  if (data.length < 2) return null;
  const prev = data[data.length - 2];
  const curr = data[data.length - 1];
  if (!isBullish(prev) || !isBearish(curr)) return null;
  if (curr.open <= prev.close) return null; // gap down
  return {
    name: 'کیکر نزولی', nameEn: 'Bearish Kicker', category: 'candlestick',
    direction: 'bearish', strength: 0.85,
    status: 'completed',
    description: 'الگوی کیکر نزولی — تغییر جهت ناگهانی و قوی'
  };
}

/**
 * Detect Three Inside Down (bearish three-candle confirmation) pattern.
 * Bullish candle, smaller bearish inside it, then bearish closing below first candle's open.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectThreeInsideDown(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBullish(c1) || !isBearish(c2) || !isBearish(c3)) return null;
  if (c2.close < c1.close || c2.open > c1.close) return null;
  if (c3.close < c1.open) return {
    name: 'سه درونی نزولی', nameEn: 'Three Inside Down', category: 'candlestick',
    direction: 'bearish', strength: 0.7,
    status: 'completed',
    description: 'الگوی سه درونی نزولی — تأیید بازگشت نزولی'
  };
  return null;
}

/**
 * Detect Three Outside Down (bearish three-candle confirmation) pattern.
 * Bullish candle engulfed by bearish, then another bearish closing lower.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectThreeOutsideDown(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBullish(c1) || !isBearish(c2) || !isBearish(c3)) return null;
  if (!(c2.open > c1.close && c2.close < c1.open)) return null;
  if (c3.close < c2.close) return {
    name: 'سه بیرونی نزولی', nameEn: 'Three Outside Down', category: 'candlestick',
    direction: 'bearish', strength: 0.72,
    status: 'completed',
    description: 'الگوی سه بیرونی نزولی — ادامه نزول'
  };
  return null;
}

/**
 * Detect Advance Block (bearish three-candle) pattern.
 * Three bullish candles with progressively smaller bodies — buying exhaustion.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectAdvanceBlock(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBullish(c1) || !isBullish(c2) || !isBullish(c3)) return null;
  // Each candle body smaller, and each opens within previous body
  if (bodySize(c2) >= bodySize(c1)) return null;
  if (bodySize(c3) >= bodySize(c2)) return null;
  if (c2.open < c1.open || c3.open < c2.open) return null;
  return {
    name: 'بلوک پیشرو', nameEn: 'Advance Block', category: 'candlestick',
    direction: 'bearish', strength: 0.6,
    status: 'completed',
    description: 'الگوی بلوک پیشرو — تضعیف صعود'
  };
}

/**
 * Detect Deliberation (bearish three-candle) pattern.
 * Two strong bullish candles followed by a weak third — buyer hesitation.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectDeliberation(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBullish(c1) || !isBullish(c2) || !isBullish(c3)) return null;
  // Second candle is strong, third is weak (small body)
  if (bodySize(c2) <= bodySize(c1)) return null;
  if (bodySize(c3) >= bodySize(c2) * 0.5) return null;
  return {
    name: 'تأخیر', nameEn: 'Deliberation', category: 'candlestick',
    direction: 'bearish', strength: 0.58,
    status: 'completed',
    description: 'الگوی تأخیر — تردید خریداران'
  };
}

/**
 * Detect Two Crows (bearish three-candle) pattern.
 * Bullish candle, gap-up bearish, then another bearish closing below first candle's close.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectTwoCrows(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBullish(c1) || !isBearish(c2) || !isBearish(c3)) return null;
  if (c2.open < c1.high) return null; // gap up
  if (c3.open > c2.open && c3.close < c1.close) return {
    name: 'دو کلاغ', nameEn: 'Two Crows', category: 'candlestick',
    direction: 'bearish', strength: 0.55,
    status: 'completed',
    description: 'الگوی دو کلاغ — سیگنال نزولی'
  };
  return null;
}

/**
 * Detect Upside Gap Two Crows (bearish three-candle) pattern.
 * Bullish candle with gap-up, then two bearish candles closing below first close.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectUpsideGapTwoCrows(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBullish(c1) || !isBearish(c2) || !isBearish(c3)) return null;
  if (c2.open > c1.high && c3.open > c2.open && c3.close < c1.close) return {
    name: 'دو کلاغ با شکاف بالا', nameEn: 'Upside Gap Two Crows', category: 'candlestick',
    direction: 'bearish', strength: 0.6,
    status: 'completed',
    description: 'الگوی دو کلاغ با شکاف بالا — بازگشت نزولی'
  };
  return null;
}

/**
 * Detect Identical Three Crows (bearish three-candle) pattern.
 * Three bearish candles with approximately equal body sizes and opens near prior closes.
 *
 * @param data - OHLCV bars (minimum 3)
 * @returns PatternResult if detected, null otherwise
 */
function detectIdenticalThreeCrows(data: OHLCV[]): PatternResult | null {
  if (data.length < 3) return null;
  const c1 = data[data.length - 3];
  const c2 = data[data.length - 2];
  const c3 = data[data.length - 1];
  if (!isBearish(c1) || !isBearish(c2) || !isBearish(c3)) return null;
  const tol = totalRange(c1) * 0.05;
  if (Math.abs(bodySize(c1) - bodySize(c2)) > tol) return null;
  if (Math.abs(bodySize(c2) - bodySize(c3)) > tol) return null;
  if (c2.open < c1.close || c3.open < c2.close) return null;
  return {
    name: 'سه کلاغ یکسان', nameEn: 'Identical Three Crows', category: 'candlestick',
    direction: 'bearish', strength: 0.75,
    status: 'completed',
    description: 'الگوی سه کلاغ یکسان — نزول بسیار قوی'
  };
}

/**
 * Detect Concealing Baby Swallow (bearish four-candle) pattern.
 * Two black marubozu-like candles, a third bearish opening inside second, then a small bullish candle.
 *
 * @param data - OHLCV bars (minimum 4)
 * @returns PatternResult if detected, null otherwise
 */
function detectConcealingBabySwallow(data: OHLCV[]): PatternResult | null {
  if (data.length < 4) return null;
  const c1 = data[data.length - 4];
  const c2 = data[data.length - 3];
  const c3 = data[data.length - 2];
  const c4 = data[data.length - 1];
  if (!isBearish(c1) || !isBearish(c2) || !isBearish(c3) || !isBullish(c4)) return null;
  // First two are black marubozu-like, third opens inside second and closes at new low
  if (bodySize(c1) < totalRange(c1) * 0.7) return null;
  if (bodySize(c2) < totalRange(c2) * 0.7) return null;
  if (c3.open > c2.open) return null;
  if (c4.open < c3.low && c4.close > c3.open) return {
    name: 'جوجه بلبل پنهان', nameEn: 'Concealing Baby Swallow', category: 'candlestick',
    direction: 'bearish', strength: 0.65,
    status: 'completed',
    description: 'الگوی جوجه بلبل پنهان — سیگنال نزولی'
  };
  return null;
}

/**
 * Detect all candlestick patterns in the given OHLCV data.
 *
 * Scans for 40 candlestick patterns:
 * - 21 bullish patterns: Hammer, Inverted Hammer, Bullish Engulfing, Morning Star,
 *   Three White Soldiers, Piercing Line, Bullish Harami, Tweezer Bottom,
 *   Dragonfly Doji, Bullish Marubozu, Rising Three Methods, Bullish Kicker,
 *   Three Inside Up, Three Outside Up, Mat Hold, Stick Sandwich,
 *   Bullish Breakaway, Three Stars in South, Bullish Separating Lines,
 *   Homing Pigeon, Ladder Bottom
 * - 19 bearish patterns: Hanging Man, Shooting Star, Bearish Engulfing, Evening Star,
 *   Three Black Crows, Dark Cloud Cover, Bearish Harami, Tweezer Top,
 *   Gravestone Doji, Bearish Marubozu, Falling Three Methods, Bearish Kicker,
 *   Three Inside Down, Three Outside Down, Advance Block, Deliberation,
 *   Two Crows, Upside Gap Two Crows, Identical Three Crows,
 *   Concealing Baby Swallow
 *
 * @param data - Array of OHLCV bars (minimum length varies per pattern, 6+ recommended)
 * @returns Array of detected candlestick PatternResult objects
 */
function detectAllCandlestick(data: OHLCV[]): PatternResult[] {
  const r: PatternResult[] = [];
  const add = (fn: (d: OHLCV[]) => PatternResult | null) => { const p = fn(data); if (p) r.push(p); };

  // Bullish (21)
  add(detectHammer);
  add(detectInvertedHammer);
  add(detectBullishEngulfing);
  add(detectMorningStar);
  add(detectThreeWhiteSoldiers);
  add(detectPiercingLine);
  add(detectBullishHarami);
  add(detectTweezerBottom);
  add(detectDragonflyDoji);
  add(detectBullishMarubozu);
  add(detectRisingThreeMethods);
  add(detectBullishKicker);
  add(detectThreeInsideUp);
  add(detectThreeOutsideUp);
  add(detectMatHold);
  add(detectStickSandwich);
  add(detectBullishBreakaway);
  add(detectThreeStarsInSouth);
  add(detectBullishSeparatingLines);
  add(detectHomingPigeon);
  add(detectLadderBottom);

  // Bearish (19)
  add(detectHangingMan);
  add(detectShootingStar);
  add(detectBearishEngulfing);
  add(detectEveningStar);
  add(detectThreeBlackCrows);
  add(detectDarkCloudCover);
  add(detectBearishHarami);
  add(detectTweezerTop);
  add(detectGravestoneDoji);
  add(detectBearishMarubozu);
  add(detectFallingThreeMethods);
  add(detectBearishKicker);
  add(detectThreeInsideDown);
  add(detectThreeOutsideDown);
  add(detectAdvanceBlock);
  add(detectDeliberation);
  add(detectTwoCrows);
  add(detectUpsideGapTwoCrows);
  add(detectIdenticalThreeCrows);
  add(detectConcealingBabySwallow);

  return r;
}

// ─── 4. Elliott Wave Pattern Detectors ──────────────────────────────────────

/**
 * Detect an Impulse Wave (5-wave Elliott motive structure) pattern.
 * Looks for 5 swing points forming the classic 1-2-3-4-5 structure
 * where wave 3 is not the shortest and wave 2 doesn't retrace beyond wave 1's start.
 *
 * @param data - OHLCV bars (minimum 30)
 * @returns PatternResult if detected, null otherwise
 */
function detectImpulseWave(data: OHLCV[]): PatternResult | null {
  if (data.length < 30) return null;
  const swings = findSwingPoints(data, 3);
  if (swings.length < 7) return null;

  // Look for 5-wave structure in recent swings
  const recent = swings.slice(-7);
  // Impulse: wave 1 > wave 2 < wave 3 > wave 4 < wave 5
  // with wave 3 not shortest, wave 2 doesn't retrace past wave 1 start
  const prices = recent.map(s => s.price);

  // Try to find 5-wave pattern: 1(up) 2(down) 3(up) 4(down) 5(up)
  for (let i = 0; i <= prices.length - 5; i++) {
    const w = prices.slice(i, i + 5);
    const isUp = (a: number, b: number) => b > a;
    const isDown = (a: number, b: number) => b < a;

    if (isUp(w[0], w[1]) && isDown(w[1], w[2]) && isUp(w[2], w[3]) && isDown(w[3], w[4])) {
      // Wave 3 should be the longest (or at least not shortest) impulse
      const impulse1 = Math.abs(w[1] - w[0]);
      const impulse3 = Math.abs(w[3] - w[2]);
      const impulse5 = Math.abs(w[4] - w[3]);
      if (impulse3 >= impulse1 && impulse3 >= impulse5 * 0.8) {
        // Wave 2 should not retrace beyond wave 1 start
        const retrace2 = Math.abs(w[2] - w[1]) / impulse1;
        if (retrace2 < 1 && retrace2 > 0.2) {
          return {
            name: 'موج تکانه‌ای', nameEn: 'Impulse Wave', category: 'elliott',
            direction: 'bullish', strength: 0.7,
            status: 'forming',
            priceLevel: w[3],
            description: 'الگوی موج تکانه‌ای ۵ موجی الیوت — روند صعودی'
          };
        }
      }
    }
  }
  return null;
}

/**
 * Detect a Leading Diagonal (Elliott wedge in wave-1 position) pattern.
 * Converging channel of 5 waves at the start of an impulse.
 *
 * @param data - OHLCV bars (minimum 25)
 * @returns PatternResult if detected, null otherwise
 */
function detectLeadingDiagonal(data: OHLCV[]): PatternResult | null {
  if (data.length < 25) return null;
  const swings = findSwingPoints(data, 2);
  if (swings.length < 5) return null;

  const recent = swings.slice(-5);
  const prices = recent.map(s => s.price);
  // Leading diagonal: 5 waves in a wedge (converging channel)
  const highs = prices.filter((_, i) => recent[i].type === 'high');
  const lows = prices.filter((_, i) => recent[i].type === 'low');
  if (highs.length < 3 || lows.length < 2) return null;

  const hConverge = highs[highs.length - 1] < highs[0];
  const lConverge = lows[lows.length - 1] > lows[0];
  if (!hConverge || !lConverge) return null;

  return {
    name: 'قطر پیشرو', nameEn: 'Leading Diagonal', category: 'elliott',
    direction: 'bullish', strength: 0.55,
    status: 'forming',
    description: 'الگوی قطر پیشرو — شروع موج ۳ قوی مورد انتظار'
  };
}

/**
 * Detect an Ending Diagonal (Elliott wedge in wave-5 position) pattern.
 * Converging channel of 5 waves at the end of an impulse — signals reversal.
 *
 * @param data - OHLCV bars (minimum 25)
 * @returns PatternResult if detected, null otherwise
 */
function detectEndingDiagonal(data: OHLCV[]): PatternResult | null {
  if (data.length < 25) return null;
  const swings = findSwingPoints(data, 2);
  if (swings.length < 5) return null;

  const recent = swings.slice(-5);
  const prices = recent.map(s => s.price);
  const highs = prices.filter((_, i) => recent[i].type === 'high');
  const lows = prices.filter((_, i) => recent[i].type === 'low');
  if (highs.length < 3 || lows.length < 2) return null;

  const hConverge = highs[highs.length - 1] < highs[0];
  const lConverge = lows[lows.length - 1] > lows[0];
  if (!hConverge || !lConverge) return null;

  // Ending diagonal occurs in wave 5 position — check if we're at highs
  const lastPrice = data[data.length - 1].close;
  const maxPrice = Math.max(...data.slice(-20).map(d => d.high));
  if (lastPrice < maxPrice * 0.95) return null;

  return {
    name: 'قطر پایانی', nameEn: 'Ending Diagonal', category: 'elliott',
    direction: 'bearish', strength: 0.6,
    status: 'forming',
    description: 'الگوی قطر پایانی — پایان روند و بازگشت مورد انتظار'
  };
}

/**
 * Detect a Zigzag (ABC) corrective pattern.
 * Sharp correction where B retraces 30–80% of A, then C extends.
 *
 * @param data - OHLCV bars (minimum 15)
 * @returns PatternResult if detected, null otherwise
 */
function detectZigzag(data: OHLCV[]): PatternResult | null {
  if (data.length < 15) return null;
  const swings = findSwingPoints(data, 3);
  if (swings.length < 3) return null;

  const recent = swings.slice(-3);
  const prices = recent.map(s => s.price);
  // ABC: A up/down, B retraces, C extends
  const abRetrace = Math.abs(prices[1] - prices[0]) / Math.abs(prices[0] - (swings.length > 3 ? swings[swings.length - 4].price : prices[0]));
  if (abRetrace < 0.3 || abRetrace > 0.8) return null;

  const direction = prices[2] > prices[0] ? 'bullish' : 'bearish';
  return {
    name: 'زیگزاگ', nameEn: 'Zigzag (ABC)', category: 'elliott',
    direction: direction as 'bullish' | 'bearish',
    strength: 0.6,
    status: 'forming',
    priceLevel: prices[1],
    description: `الگوی زیگزاگ ABC — تصحیح ${direction === 'bullish' ? 'صعودی' : 'نزولی'}`
  };
}

/**
 * Detect a Flat (ABC) corrective pattern.
 * Sideways correction where A and B moves are each <60% of the total range.
 *
 * @param data - OHLCV bars (minimum 15)
 * @returns PatternResult if detected, null otherwise
 */
function detectFlat(data: OHLCV[]): PatternResult | null {
  if (data.length < 15) return null;
  const swings = findSwingPoints(data, 3);
  if (swings.length < 3) return null;

  const recent = swings.slice(-3);
  const prices = recent.map(s => s.price);
  // Flat: A ends near start, B retraces to near start, C ends near A
  const aMove = Math.abs(prices[1] - prices[0]);
  const bMove = Math.abs(prices[2] - prices[1]);
  const totalRange = Math.max(...prices) - Math.min(...prices);
  if (totalRange === 0) return null;
  if (aMove / totalRange > 0.6 || bMove / totalRange > 0.6) return null;

  return {
    name: 'تخت', nameEn: 'Flat (ABC)', category: 'elliott',
    direction: 'neutral', strength: 0.5,
    status: 'forming',
    description: 'الگوی تخت — تصحیح افقی'
  };
}

/**
 * Detect an Expanded Flat (irregular) corrective pattern.
 * B extends beyond the start of A, and C extends beyond the end of A.
 *
 * @param data - OHLCV bars (minimum 15)
 * @returns PatternResult if detected, null otherwise
 */
function detectExpandedFlat(data: OHLCV[]): PatternResult | null {
  if (data.length < 15) return null;
  const swings = findSwingPoints(data, 3);
  if (swings.length < 4) return null;

  const recent = swings.slice(-4);
  const prices = recent.map(s => s.price);
  // Expanded flat: B extends beyond start of A, C extends beyond end of A
  if (recent.length < 4) return null;
  const start = prices[0];
  const aEnd = prices[1];
  const bEnd = prices[2];
  const cEnd = prices[3];

  const bBeyond = (recent[2].type === 'high' && bEnd > start) || (recent[2].type === 'low' && bEnd < start);
  const cBeyond = (recent[3].type === 'low' && cEnd < aEnd) || (recent[3].type === 'high' && cEnd > aEnd);

  if (!bBeyond || !cBeyond) return null;

  return {
    name: 'تخت گسترده', nameEn: 'Expanded Flat', category: 'elliott',
    direction: 'neutral', strength: 0.55,
    status: 'forming',
    description: 'الگوی تخت گسترده — تصحیح با موج B و C بلندتر'
  };
}

/**
 * Detect a Running Flat corrective pattern.
 * C fails to reach the end of A (between 50–100% of A) — signals trend continuation.
 *
 * @param data - OHLCV bars (minimum 15)
 * @returns PatternResult if detected, null otherwise
 */
function detectRunningFlat(data: OHLCV[]): PatternResult | null {
  if (data.length < 15) return null;
  const swings = findSwingPoints(data, 3);
  if (swings.length < 3) return null;

  const recent = swings.slice(-3);
  const prices = recent.map(s => s.price);
  // Running flat: B ends beyond start of impulse, C doesn't reach end of A
  const aMove = Math.abs(prices[1] - prices[0]);
  const cMove = Math.abs(prices[2] - prices[1]);
  if (cMove > aMove) return null;
  if (cMove < aMove * 0.5) return null;

  return {
    name: 'تخت در حال اجرا', nameEn: 'Running Flat', category: 'elliott',
    direction: 'neutral', strength: 0.5,
    status: 'forming',
    description: 'الگوی تخت در حال اجرا — سیگنال ادامه روند'
  };
}

/**
 * Detect an Elliott Triangle (converging corrective) pattern.
 * Converging swing highs and lows — typically occurs in wave-4 position.
 *
 * @param data - OHLCV bars (minimum 20)
 * @returns PatternResult if detected, null otherwise
 */
function detectElliottTriangle(data: OHLCV[]): PatternResult | null {
  if (data.length < 20) return null;
  const swings = findSwingPoints(data, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 3 || lows.length < 3) return null;

  const rh = highs.slice(-3);
  const rl = lows.slice(-3);
  const hConverge = rh[rh.length - 1].price < rh[0].price;
  const lConverge = rl[rl.length - 1].price > rl[0].price;
  if (!hConverge || !lConverge) return null;

  // Each sub-wave should have 3 waves (corrective)
  return {
    name: 'مثلث الیوت', nameEn: 'Triangle (ABC)', category: 'elliott',
    direction: 'neutral', strength: 0.55,
    status: 'forming',
    description: 'الگوی مثلث الیوت — تصحیح مثلثی در موج ۴'
  };
}

/**
 * Detect a Complex Correction (WXY) pattern.
 * Three linked corrective patterns with alternating swing directions and similar W/Y amplitude ratio (0.5–2.0).
 *
 * @param data - OHLCV bars (minimum 35)
 * @returns PatternResult if detected, null otherwise
 */
function detectComplexCorrection(data: OHLCV[]): PatternResult | null {
  if (data.length < 35) return null;
  const swings = findSwingPoints(data, 3);
  if (swings.length < 7) return null;

  const recent = swings.slice(-7);
  const prices = recent.map(s => s.price);
  // WXY: three corrective patterns linked — look for alternating wave directions
  let alternating = true;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].type === recent[i - 1].type) { alternating = false; break; }
  }
  if (!alternating) return null;

  // Check for at least 2 distinct corrective sections
  const wEnd = Math.abs(prices[2] - prices[0]);
  const yEnd = Math.abs(prices[prices.length - 1] - prices[prices.length - 3]);
  if (wEnd === 0 || yEnd === 0) return null;

  const ratio = yEnd / wEnd;
  if (ratio < 0.5 || ratio > 2) return null;

  return {
    name: 'تصحیح پیچیده', nameEn: 'Complex Correction (WXY)', category: 'elliott',
    direction: 'neutral', strength: 0.5,
    status: 'forming',
    description: 'الگوی تصحیح پیچیده WXY — ترکیب چند الگوی تصحیحی'
  };
}

/**
 * Detect a Double Three corrective pattern.
 * Two corrective patterns joined by an X wave — 6 alternating swings with similar amplitude ranges.
 *
 * @param data - OHLCV bars (minimum 30)
 * @returns PatternResult if detected, null otherwise
 */
function detectDoubleThree(data: OHLCV[]): PatternResult | null {
  if (data.length < 30) return null;
  const swings = findSwingPoints(data, 3);
  if (swings.length < 6) return null;

  const recent = swings.slice(-6);
  // Double three: two corrective patterns joined by an X wave
  // Look for roughly 6 alternating swings with similar amplitude ranges
  const prices = recent.map(s => s.price);
  const ranges: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    ranges.push(Math.abs(prices[i] - prices[i - 1]));
  }
  const avgRange = avg(ranges);
  if (avgRange === 0) return null;
  const variance = ranges.reduce((s, r) => s + Math.abs(r - avgRange), 0) / avgRange;
  if (variance > 1.5) return null; // too irregular

  return {
    name: 'دو سه‌تایی', nameEn: 'Double Three', category: 'elliott',
    direction: 'neutral', strength: 0.5,
    status: 'forming',
    description: 'الگوی دو سه‌تایی — ترکیب دو الگوی تصحیحی ساده'
  };
}

/**
 * Detect all Elliott Wave patterns in the given OHLCV data.
 *
 * Scans for 10 Elliott patterns:
 *   1. Impulse Wave    (5-wave motive structure)
 *   2. Leading Diagonal (wedge in wave-1 position)
 *   3. Ending Diagonal  (wedge in wave-5 position)
 *   4. Zigzag (ABC)     (sharp correction)
 *   5. Flat (ABC)       (sideways correction)
 *   6. Expanded Flat    (irregular flat with extended B & C)
 *   7. Running Flat     (C fails to reach A)
 *   8. Triangle (ABC)   (converging corrective triangle)
 *   9. Complex Correction (WXY)
 *  10. Double Three     (two corrective patterns joined by X wave)
 *
 * @param data - Array of OHLCV bars (minimum 15–35 depending on pattern)
 * @returns Array of detected Elliott PatternResult objects
 */
function detectAllElliott(data: OHLCV[]): PatternResult[] {
  const r: PatternResult[] = [];
  const add = (fn: (d: OHLCV[]) => PatternResult | null) => { const p = fn(data); if (p) r.push(p); };

  add(detectImpulseWave);
  add(detectLeadingDiagonal);
  add(detectEndingDiagonal);
  add(detectZigzag);
  add(detectFlat);
  add(detectExpandedFlat);
  add(detectRunningFlat);
  add(detectElliottTriangle);
  add(detectComplexCorrection);
  add(detectDoubleThree);

  return r;
}

// ─── School Scores Computation ──────────────────────────────────────────────

/**
 * Compute six school-level composite confidence scores (0–1) from detected patterns.
 *
 * The scores summarise signal strength per analysis method:
 * - **classical**: average strength of classic patterns, boosted by count
 * - **oscillator**: strength of oscillator-type candlestick patterns (Doji, Star, Harami, Engulfing)
 * - **volume**: strength of volume-type candlestick patterns (Marubozu, Kicker, Three Methods)
 * - **harmonic**: average strength of harmonic patterns, boosted by count
 * - **elliott**: average strength of Elliott patterns, boosted by count
 * - **hybrid**: blended score across all schools, weighted by total pattern count
 *
 * @param classic      - Detected classic patterns
 * @param harmonic     - Detected harmonic patterns
 * @param candlestick  - Detected candlestick patterns
 * @param elliott      - Detected Elliott patterns
 * @returns SchoolScores object with each score rounded to 3 decimal places
 */
function computeSchoolScores(classic: PatternResult[], harmonic: PatternResult[], candlestick: PatternResult[], elliott: PatternResult[]): DetectedPatterns['schoolScores'] {
  const classicScore = classic.length > 0
    ? Math.min(1, avg(classic.map(p => p.strength)) * (1 + classic.length * 0.1))
    : 0;

  const harmonicScore = harmonic.length > 0
    ? Math.min(1, avg(harmonic.map(p => p.strength)) * (1 + harmonic.length * 0.2))
    : 0;

  const candleOscScore = candlestick.filter(p =>
    p.nameEn.includes('Doji') || p.nameEn.includes('Star') ||
    p.nameEn.includes('Harami') || p.nameEn.includes('Engulfing')
  );
  const oscillatorScore = candleOscScore.length > 0
    ? Math.min(1, avg(candleOscScore.map(p => p.strength)))
    : 0;

  const candleVolScore = candlestick.filter(p =>
    p.nameEn.includes('Marubozu') || p.nameEn.includes('Kicker') ||
    p.nameEn.includes('Three Methods')
  );
  const volumeScore = candleVolScore.length > 0
    ? Math.min(1, avg(candleVolScore.map(p => p.strength)))
    : 0;

  const elliottScore = elliott.length > 0
    ? Math.min(1, avg(elliott.map(p => p.strength)) * (1 + elliott.length * 0.15))
    : 0;

  const allPatterns = [...classic, ...harmonic, ...candlestick, ...elliott];
  const hybridScore = allPatterns.length > 0
    ? Math.min(1, avg(allPatterns.map(p => p.strength)) * Math.min(allPatterns.length * 0.05, 1.5))
    : 0;

  return {
    classical: Math.round(classicScore * 1000) / 1000,
    oscillator: Math.round(oscillatorScore * 1000) / 1000,
    volume: Math.round(volumeScore * 1000) / 1000,
    harmonic: Math.round(harmonicScore * 1000) / 1000,
    elliott: Math.round(elliottScore * 1000) / 1000,
    hybrid: Math.round(hybridScore * 1000) / 1000,
  };
}

// ─── Main Detection Function ────────────────────────────────────────

/**
 * Main entry point — scan OHLCV data for all technical analysis patterns.
 *
 * Runs detection across four schools (classic, harmonic, candlestick, Elliott Wave),
 * merges results into a single `all` array sorted by strength (descending),
 * and computes six school-level composite confidence scores.
 *
 * Pattern categories detected:
 * - **Classic (16)**: Head & Shoulders, Double/Top/Bottom, Triple Top/Bottom,
 *   Ascending/Descending/Symmetric Triangles, Ascending/Descending Wedges,
 *   Bull/Bear Flags, Pennant, Cup & Handle, Rectangle, Broadening Top/Bottom,
 *   Diamond Top/Bottom
 * - **Harmonic (6 × 2)**: Gartley, Butterfly, Bat, Crab, Shark, Cypher
 *   (each in bullish + bearish variant)
 * - **Candlestick (40)**: 21 bullish + 19 bearish single/multi-candle formations
 * - **Elliott (10)**: Impulse Wave, Leading/Ending Diagonal, Zigzag, Flat,
 *   Expanded/Running Flat, Triangle, Complex Correction (WXY), Double Three
 *
 * @param data - Array of OHLCV bars; more bars yield better detection
 *              (recommend 50+ for classic, 20+ for harmonic/candlestick, 30+ for Elliott)
 * @returns DetectedPatterns object with categorized arrays, merged sorted array, and school scores
 */
export function detectAllPatterns(data: OHLCV[]): DetectedPatterns {
  const classic = detectAllClassic(data);
  const harmonic = detectAllHarmonics(data);
  const candlestick = detectAllCandlestick(data);
  const elliott = detectAllElliott(data);
  const all = [...classic, ...harmonic, ...candlestick, ...elliott];

  // Sort by strength descending
  all.sort((a, b) => b.strength - a.strength);

  const schoolScores = computeSchoolScores(classic, harmonic, candlestick, elliott);

  return {
    classic,
    harmonic,
    candlestick,
    elliott,
    all,
    schoolScores,
  };
}
