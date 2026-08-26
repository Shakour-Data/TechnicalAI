// ═══════════════════════════════════════════════════════════════════════════════
// Pattern Detection Engine — Classic, Harmonic, Candlestick, Elliott Wave
// ═══════════════════════════════════════════════════════════════════════════════

import type { OHLCV } from './ta-engine';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface PatternResult {
  name: string;         // Persian name
  nameEn: string;       // English name
  category: 'classic' | 'harmonic' | 'candlestick' | 'elliott';
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number;     // 0-1
  status: 'forming' | 'completed' | 'failed';
  priceLevel?: number;  // key price level (neckline, PRZ, etc.)
  description: string;  // brief Persian description
}

export interface DetectedPatterns {
  classic: PatternResult[];
  harmonic: PatternResult[];
  candlestick: PatternResult[];
  elliott: PatternResult[];
  all: PatternResult[];
  schoolScores: {
    classical: number;
    oscillator: number;
    volume: number;
    harmonic: number;
    elliott: number;
    hybrid: number;
  };
}

// ─── Utility Functions ──────────────────────────────────────────────────────

interface SwingPoint {
  index: number;
  price: number;
  type: 'high' | 'low';
}

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

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function nearRatio(a: number, b: number, tolerance: number = 0.05): boolean {
  if (b === 0) return a === 0;
  return Math.abs(a / b - 1) <= tolerance;
}

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

function totalRange(c: OHLCV): number {
  return c.high - c.low;
}

function typicalPrice(c: OHLCV): number {
  return (c.high + c.low + c.close) / 3;
}

function sma(values: number[], period: number): number {
  if (values.length < period) return 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(values: number[], period: number): number {
  if (values.length < period) return 0;
  const k = 2 / (period + 1);
  let result = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    result = values[i] * k + result * (1 - k);
  }
  return result;
}

// Fib ratios
const PHI = 0.618;
const PHI_EXT = 1.618;
const PHI_386 = 0.382;
const PHI_786 = 0.786;
const PHI_886 = 0.886;
const PHI_127 = 1.27;
const PHI_141 = 1.414;
const PHI_236 = 2.236;
const PHI_314 = 3.14;
const PHI_423 = 4.236;
const FIB_TOL = 0.05;

// ─── 1. Classic Pattern Detectors ───────────────────────────────────────────

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

interface HarmonicSpec {
  name: string;
  nameEn: string;
  abRatio: number;
  bcRatio: number;
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

// ─── Main Detection Function ────────────────────────────────────────────────

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
