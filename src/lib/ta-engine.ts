// ═══════════════════════════════════════════════════════════════════════════════
// TSE Technical Analysis Engine — 7-Layer ML-Based VDss Algorithm
// ═══════════════════════════════════════════════════════════════════════════════

import {
  AdaptiveWeightModel,
  clamp,
  sigmoid,
  FEATURES_ORDER,
  NUM_FEATURES,
  type FeatureKey,
} from './ml-model';
import { buildDecisionGraph, type GraphData } from './decision-graph';

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ScenarioResult {
  name: string;
  nameEn: string;
  probability: number;
  targetMin: number;
  targetMax: number;
  description: string;
}

export interface TrendResult {
  direction: string;
  slope: number;
  angle: number;
  r2: number;
}

export interface LevelStrength {
  price: number;
  strength: number;       // 1-10
  score: number;          // 0-10 continuous (final_score from ML)
  grade: string;          // 'Very Strong' | 'Strong' | 'Moderate' | 'Weak'
  isTarget: boolean;      // true if score >= 7
  overlapCount: number;   // number of methods that agree at this level
  methods: string[];      // e.g. ['Swing_High', 'Fibonacci_0.618', 'Pivot_R1']
  fibRatio: string;       // e.g. '0.382' — keep for backward compat
  fibLabel: string;       // Persian label e.g. 'فیبو ۳۸.۲٪' — keep for backward compat
}

export interface TAResult {
  // Moving Averages
  sma: Record<string, number>;
  ema: Record<string, number>;
  // SMA arrays for chart overlays
  smaArray: Record<string, number[]>;
  emaArray: Record<string, number[]>;
  ichimokuArrays: {
    tenkan: number[];
    kijun: number[];
    senkouA: number[];
    senkouB: number[];
  };
  vwapArray: number[];
  // Oscillators
  rsi: number;
  mfi: number;
  cci: number;
  stochK: number;
  stochD: number;
  williamsR: number;
  macd: { line: number; signal: number; histogram: number };
  // Trend
  adx: number;
  diPlus: number;
  diMinus: number;
  sar: number;
  // Volatility
  atr: number;
  bollingerBands: { upper: number; middle: number; lower: number };
  // Volume
  obv: number;
  // Ichimoku Cloud (TradingView free)
  ichimoku: {
    tenkan: number;  // Conversion Line (9)
    kijun: number;   // Base Line (26)
    senkouA: number; // Senkou Span A (leading)
    senkouB: number; // Senkou Span B (leading)
    chikou: number;  // Chikou Span (lagging)
  };
  // VWAP (TradingView free)
  vwap: number;
  // Support / Resistance (6 each, Fibonacci-based)
  resistances: number[];
  supports: number[];
  supportStrengths: LevelStrength[];
  resistanceStrengths: LevelStrength[];
  priceTargets: LevelStrength[];
  // Trend Lines
  trend: {
    short: TrendResult;
    medium: TrendResult;
    long: TrendResult;
  };
  // VDss / VDes Scenarios (probabilities sum to 100)
  scenarios: {
    R1: ScenarioResult;
    R2: ScenarioResult;
    R3: ScenarioResult;
    R4: ScenarioResult;
    R5: ScenarioResult;
    R6: ScenarioResult;
    R7: ScenarioResult;
    R8: ScenarioResult;
    R9: ScenarioResult;
  };
  // Summary
  bullScore: number;
  bearScore: number;
  overallSignal: 'bullish' | 'bearish' | 'neutral';
  // ── VDss Layer 3-6 ML Metadata ──
  bullConsensus: number;
  isMLTrained: boolean;
  mlAccuracy: number;
  mlWeights: number[] | null;
  edgeWeights: { up: number; down: number; pullback: number; risk: number };
  calibrationFactors: Record<string, number>;
  scenarioSums: Record<string, number>;
  adaptiveFactors: { momentum: number; volatility: number; trend: number };
  // Volume availability flag
  hasVolume: boolean;
  // Decision Graph (computed probabilities from 35+ node graph)
  decisionGraph: GraphData | null;
  // ── Extended Indicators (24 additional indicators) ──
  extendedIndicators: {
    // Trend
    wma: Record<string, number>;
    hma: number;
    tma: number;
    lma: number;
    maAlignment: number; // 0-1 alignment score
    heikenAshi: { open: number; high: number; low: number; close: number };
    // Oscillators
    awesomeOsc: number;
    momentum: number;
    modifiedRSI: number;
    fastStochK: number;
    fisherTransform: number;
    pvo: number;
    confidenceIndex: number;
    strengthIndex: number;
    // Volume
    ad: number;
    vpt: number;
    vosc: number;
    chaikinAD: number;
    forceIndex: number;
    // Volatility
    keltnerChannels: { upper: number; middle: number; lower: number };
    envelopes: { upper: number; middle: number; lower: number };
    stdDev: number;
    hv: number;
  };
}

// ─── Helper: SMA ──────────────────────────────────────────────────────────────
function sma(closes: number[], period: number): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ─── Helper: EMA ──────────────────────────────────────────────────────────────
function emaCalc(closes: number[], period: number): number {
  if (closes.length < period) return 0;
  const k = 2 / (period + 1);
  let emaVal = sma(closes.slice(0, period), period);
  for (let i = period; i < closes.length; i++) {
    emaVal = closes[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

// ─── Helper: RSI(14) ──────────────────────────────────────────────────────────
function calcRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ─── Helper: MFI(14) ──────────────────────────────────────────────────────────
function calcMFI(data: OHLCV[], period: number = 14): number {
  if (data.length < period + 1) return 50;
  let posFlow = 0;
  let negFlow = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const tp = (data[i].high + data[i].low + data[i].close) / 3;
    const mf = tp * data[i].volume;
    const prevTp = (data[i - 1].high + data[i - 1].low + data[i - 1].close) / 3;
    if (tp > prevTp) posFlow += mf;
    else negFlow += mf;
  }
  if (negFlow === 0) return 100;
  const mfr = posFlow / negFlow;
  return 100 - 100 / (1 + mfr);
}

// ─── Helper: CCI(20) ──────────────────────────────────────────────────────────
function calcCCI(data: OHLCV[], period: number = 20): number {
  if (data.length < period) return 0;
  const tps: number[] = [];
  for (let i = data.length - period; i < data.length; i++) {
    tps.push((data[i].high + data[i].low + data[i].close) / 3);
  }
  const meanTP = tps.reduce((a, b) => a + b, 0) / period;
  const meanDev = tps.reduce((a, b) => a + Math.abs(b - meanTP), 0) / period;
  if (meanDev === 0) return 0;
  return (tps[tps.length - 1] - meanTP) / (0.015 * meanDev);
}

// ─── Helper: Stochastic(14,3,3) ───────────────────────────────────────────────
function calcStochastic(data: OHLCV[], kPeriod: number = 14, smoothK: number = 3, smoothD: number = 3): { k: number; d: number } {
  if (data.length < kPeriod) return { k: 50, d: 50 };
  const rawKs: number[] = [];
  for (let i = kPeriod - 1; i < data.length; i++) {
    let lowest = Infinity;
    let highest = -Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (data[j].low < lowest) lowest = data[j].low;
      if (data[j].high > highest) highest = data[j].high;
    }
    const range = highest - lowest;
    rawKs.push(range === 0 ? 50 : ((data[i].close - lowest) / range) * 100);
  }
  const smoothedK: number[] = [];
  for (let i = smoothK - 1; i < rawKs.length; i++) {
    const slice = rawKs.slice(i - smoothK + 1, i + 1);
    smoothedK.push(slice.reduce((a, b) => a + b, 0) / smoothK);
  }
  const k = smoothedK[smoothedK.length - 1] ?? 50;
  const dSlice = smoothedK.slice(-smoothD);
  const d = dSlice.reduce((a, b) => a + b, 0) / dSlice.length;
  return { k, d };
}

// ─── Helper: Williams %R(14) ──────────────────────────────────────────────────
function calcWilliamsR(data: OHLCV[], period: number = 14): number {
  if (data.length < period) return -50;
  const slice = data.slice(-period);
  let highest = -Infinity;
  let lowest = Infinity;
  for (const c of slice) {
    if (c.high > highest) highest = c.high;
    if (c.low < lowest) lowest = c.low;
  }
  const range = highest - lowest;
  if (range === 0) return -50;
  return ((highest - data[data.length - 1].close) / range) * -100;
}

// ─── Helper: MACD(12,26,9) ────────────────────────────────────────────────────
function calcMACD(closes: number[], fast: number = 12, slow: number = 26, sig: number = 9): { line: number; signal: number; histogram: number } {
  if (closes.length < slow + sig) return { line: 0, signal: 0, histogram: 0 };
  const emaFast = emaCalc(closes, fast);
  const emaSlow = emaCalc(closes, slow);
  const macdLine = emaFast - emaSlow;
  // Calculate signal as EMA of MACD values
  const macdValues: number[] = [];
  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);
  let eFast = sma(closes.slice(0, fast), fast);
  let eSlow = sma(closes.slice(0, slow), slow);
  for (let i = Math.max(fast, slow); i < closes.length; i++) {
    eFast = closes[i] * kFast + eFast * (1 - kFast);
    eSlow = closes[i] * kSlow + eSlow * (1 - kSlow);
    macdValues.push(eFast - eSlow);
  }
  if (macdValues.length < sig) return { line: macdLine, signal: 0, histogram: macdLine };
  const kSig = 2 / (sig + 1);
  let signalVal = sma(macdValues.slice(0, sig), sig);
  for (let i = sig; i < macdValues.length; i++) {
    signalVal = macdValues[i] * kSig + signalVal * (1 - kSig);
  }
  return { line: macdLine, signal: signalVal, histogram: macdLine - signalVal };
}

// ─── Helper: ATR(14) ──────────────────────────────────────────────────────────
function calcATR(data: OHLCV[], period: number = 14): number {
  if (data.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    );
    trs.push(tr);
  }
  if (trs.length < period) return trs.reduce((a, b) => a + b, 0) / trs.length;
  let atrVal = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atrVal = (atrVal * (period - 1) + trs[i]) / period;
  }
  return atrVal;
}

// ─── Helper: ADX(14) + DI+/DI- ────────────────────────────────────────────────
function calcADX(data: OHLCV[], period: number = 14): { adx: number; diPlus: number; diMinus: number } {
  if (data.length < period + 1) return { adx: 0, diPlus: 0, diMinus: 0 };
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];
  const trs: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const upMove = data[i].high - data[i - 1].high;
    const downMove = data[i - 1].low - data[i].low;
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trs.push(Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    ));
  }
  if (trs.length < period) return { adx: 0, diPlus: 0, diMinus: 0 };
  let smoothTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  const dxValues: number[] = [];
  for (let i = period; i < trs.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trs[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDMs[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDMs[i];
    const diPlus = smoothTR === 0 ? 0 : (smoothPlusDM / smoothTR) * 100;
    const diMinus = smoothTR === 0 ? 0 : (smoothMinusDM / smoothTR) * 100;
    const diSum = diPlus + diMinus;
    const dx = diSum === 0 ? 0 : (Math.abs(diPlus - diMinus) / diSum) * 100;
    dxValues.push(dx);
  }
  if (dxValues.length === 0) return { adx: 0, diPlus: 0, diMinus: 0 };
  let adxVal = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, dxValues.length);
  for (let i = period; i < dxValues.length; i++) {
    adxVal = (adxVal * (period - 1) + dxValues[i]) / period;
  }
  const lastDIPlus = smoothTR === 0 ? 0 : (smoothPlusDM / smoothTR) * 100;
  const lastDIMinus = smoothTR === 0 ? 0 : (smoothMinusDM / smoothTR) * 100;
  return { adx: adxVal, diPlus: lastDIPlus, diMinus: lastDIMinus };
}

// ─── Helper: Parabolic SAR ────────────────────────────────────────────────────
function calcSAR(data: OHLCV[], step: number = 0.02, max: number = 0.2): number {
  if (data.length < 5) return data[data.length - 1]?.low ?? 0;
  let isLong = true;
  let af = step;
  let ep = data[0].high;
  let sar = data[0].low;
  for (let i = 1; i < data.length; i++) {
    const prevSar = sar;
    sar = prevSar + af * (ep - prevSar);
    // Ensure SAR is within bounds
    if (isLong) {
      if (i >= 2) sar = Math.min(sar, data[i - 1].low, data[i - 2]?.low ?? Infinity);
      if (data[i].low < sar) {
        isLong = false;
        sar = ep;
        ep = data[i].low;
        af = step;
      } else {
        if (data[i].high > ep) {
          ep = data[i].high;
          af = Math.min(af + step, max);
        }
      }
    } else {
      if (i >= 2) sar = Math.max(sar, data[i - 1].high, data[i - 2]?.high ?? -Infinity);
      if (data[i].high > sar) {
        isLong = true;
        sar = ep;
        ep = data[i].high;
        af = step;
      } else {
        if (data[i].low < ep) {
          ep = data[i].low;
          af = Math.min(af + step, max);
        }
      }
    }
  }
  return sar;
}

// ─── Helper: Bollinger Bands(20,2) ────────────────────────────────────────────
function calcBollingerBands(closes: number[], period: number = 20, stdDev: number = 2): { upper: number; middle: number; lower: number } {
  if (closes.length < period) {
    const c = closes[closes.length - 1] ?? 0;
    return { upper: c, middle: c, lower: c };
  }
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { upper: middle + stdDev * sd, lower: middle - stdDev * sd, middle };
}

// ─── Helper: OBV ──────────────────────────────────────────────────────────────
function calcOBV(data: OHLCV[]): number {
  let obv = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) obv += data[i].volume;
    else if (data[i].close < data[i - 1].close) obv -= data[i].volume;
  }
  return obv;
}

// ─── Helper: VWAP ──────────────────────────────────────────────────────────────
function calcVWAP(data: OHLCV[]): number {
  if (data.length === 0) return 0;
  let cumTPV = 0;
  let cumVol = 0;
  for (const d of data) {
    const tp = (d.high + d.low + d.close) / 3;
    cumTPV += tp * d.volume;
    cumVol += d.volume;
  }
  return cumVol === 0 ? data[data.length - 1].close : cumTPV / cumVol;
}

function calcVWAPArray(data: OHLCV[]): number[] {
  const result: number[] = [];
  let cumTPV = 0;
  let cumVol = 0;
  for (const d of data) {
    const tp = (d.high + d.low + d.close) / 3;
    cumTPV += tp * d.volume;
    cumVol += d.volume;
    result.push(cumVol === 0 ? d.close : cumTPV / cumVol);
  }
  return result;
}

// ─── Helper: Ichimoku Cloud (9, 26, 52) ──────────────────────────────────────
function calcIchimoku(data: OHLCV[]): {
  tenkan: number; kijun: number; senkouA: number; senkouB: number; chikou: number;
} {
  if (data.length < 52) {
    const c = data[data.length - 1]?.close ?? 0;
    return { tenkan: c, kijun: c, senkouA: c, senkouB: c, chikou: c };
  }
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);

  function donchian(h: number[], l: number[], end: number, period: number): number {
    const start = end - period + 1;
    if (start < 0) return (h[end] + l[end]) / 2;
    let hi = -Infinity, lo = Infinity;
    for (let i = start; i <= end; i++) {
      if (h[i] > hi) hi = h[i];
      if (l[i] < lo) lo = l[i];
    }
    return (hi + lo) / 2;
  }

  const n = data.length;
  const tenkan = donchian(highs, lows, n - 1, 9);
  const kijun = donchian(highs, lows, n - 1, 26);
  // Senkou A = (tenkan + kijun) / 2, shifted 26 periods ahead
  // We compute it at bar n-27 (shifted to current)
  const senkouAIdx = Math.max(n - 1 - 26, 0);
  const tA = donchian(highs, lows, senkouAIdx, 9);
  const kA = donchian(highs, lows, senkouAIdx, 26);
  const senkouA = (tA + kA) / 2;
  // Senkou B = donchian(52), shifted 26 periods ahead
  const senkouBIdx = Math.max(n - 1 - 26, 0);
  const senkouB = donchian(highs, lows, senkouBIdx, 52);
  // Chikou = current close plotted 26 periods back
  const chikou = closes[n - 1];

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

function calcIchimokuArrays(data: OHLCV[]): {
  tenkan: number[]; kijun: number[]; senkouA: number[]; senkouB: number[];
} {
  const n = data.length;
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);

  function donchian(end: number, period: number): number {
    const start = end - period + 1;
    if (start < 0) return (highs[end] + lows[end]) / 2;
    let hi = -Infinity, lo = Infinity;
    for (let i = start; i <= end; i++) {
      if (highs[i] > hi) hi = highs[i];
      if (lows[i] < lo) lo = lows[i];
    }
    return (hi + lo) / 2;
  }

  const tenkan: number[] = [];
  const kijun: number[] = [];
  const senkouA: number[] = [];
  const senkouB: number[] = [];

  for (let i = 0; i < n; i++) {
    tenkan.push(donchian(i, 9));
    kijun.push(donchian(i, 26));
    // Senkou A shifted +26: at bar i, we need tenkan/kijun at bar i-26
    const sIdx = i - 26;
    if (sIdx >= 0) {
      const t = donchian(sIdx, 9);
      const k = donchian(sIdx, 26);
      senkouA.push((t + k) / 2);
    } else {
      senkouA.push(donchian(i, 9)); // fallback
    }
    // Senkou B shifted +26: at bar i, we need donchian(52) at bar i-26
    if (sIdx >= 0) {
      senkouB.push(donchian(sIdx, 52));
    } else {
      senkouB.push(donchian(i, 52)); // fallback
    }
  }

  return { tenkan, kijun, senkouA, senkouB };
}

// ─── Helper: SMA Array (full series) ──────────────────────────────────────
function smaArray(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(0); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    result.push(sum / period);
  }
  return result;
}

// ─── Helper: EMA Array (full series) ──────────────────────────────────────
function emaArrayCalc(closes: number[], period: number): number[] {
  const result: number[] = [];
  if (closes.length < period) return closes.map(() => 0);
  const k = 2 / (period + 1);
  let emaVal = 0;
  for (let i = 0; i < period; i++) emaVal += closes[i];
  emaVal /= period;
  for (let i = 0; i < closes.length; i++) {
    if (i < period) { result.push(0); continue; }
    if (i === period) { result.push(emaVal); continue; }
    emaVal = closes[i] * k + emaVal * (1 - k);
    result.push(emaVal);
  }
  return result;
}

// ─── Helper: Linear Regression ────────────────────────────────────────────────
function linearRegression(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r2: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
    sumY2 += values[i] * values[i];
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

// ─── Helper: Round to nice number (per spec price-range rules) ─────────────
function roundToNice(price: number): number {
  const abs = Math.abs(price);
  let step: number;
  if (abs >= 100000) step = 100;
  else if (abs >= 10000) step = 10;
  else if (abs >= 1000) step = 5;
  else if (abs >= 100) step = 1;
  else step = 0.5;
  return Math.round(price / step) * step;
}

// ─── Helper: Swing Highs/Lows ─────────────────────────────────────────────────
function findSwingLevels(data: OHLCV[], lookback: number = 3): { highs: { price: number; idx: number }[]; lows: { price: number; idx: number }[] } {
  const highs: { price: number; idx: number }[] = [];
  const lows: { price: number; idx: number }[] = [];
  for (let i = lookback; i < data.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (data[j].high >= data[i].high) isHigh = false;
      if (data[j].low <= data[i].low) isLow = false;
    }
    if (isHigh) highs.push({ price: data[i].high, idx: i });
    if (isLow) lows.push({ price: data[i].low, idx: i });
  }
  return { highs, lows };
}

// ─── Fibonacci Constants ───────────────────────────────────────────────────
const FIB_RETRACEMENTS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
const FIB_EXTENSIONS = [1.272, 1.618, 2.0, 2.618, 3.618, 4.236];

// Persian labels for Fibonacci ratios — keys normalized via String(ratio)
const FIB_LABELS: Record<string, string> = {
  '0': '۰٪ (اوج)',
  '0.236': '۲۳.۶٪',
  '0.382': '۳۸.۲٪',
  '0.5': '۵۰٪',
  '0.618': '۶۱.۸٪',
  '0.786': '۷۸.۶٪',
  '1': '۱۰۰٪ (کف)',
  '1.272': '۱۲۷.۲٪',
  '1.618': '۱۶۱.۸٪',
  '2': '۲۰۰٪',
  '2.618': '۲۶۱.۸٪',
  '3.618': '۳۶۱.۸٪',
  '4.236': '۴۲۳.۶٪',
};

// Key Fibonacci ratios for strength scoring
const KEY_FIB_RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786, 1.272, 1.618, 2.618];

// ─── Internal S/R Types ──────────────────────────────────────────────────
interface RawSRLevel {
  price: number;
  method: string;
  type: 'support' | 'resistance';
  fibRatio: string;
  fibLabel: string;
}

interface MergedSRLevel {
  price: number;
  type: 'support' | 'resistance';
  methods: string[];
  overlapCount: number;
  fibRatio: string;
  fibLabel: string;
  score: number;
  strength: number;
  touchCount: number;
  volumeRatio: number;
  freshness: number;
  distancePercent: number;
}

// ─── Helper: Psychological Rounding ────────────────────────────────────────
function psychStep(price: number): number {
  if (price >= 100000) return 5000;
  if (price >= 10000) return 1000;
  if (price >= 1000) return 100;
  if (price >= 100) return 10;
  if (price >= 10) return 1;
  return 0.01;
}

function psychRound(price: number): number {
  const step = psychStep(price);
  return Math.round(price / step) * step;
}

// ─── Helper: Linear System Solver (Gaussian Elimination) ─────────────────
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-10) return null;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    if (Math.abs(aug[i][i]) < 1e-10) return null;
    x[i] /= aug[i][i];
  }

  return x;
}

// ─── Helper: Generate All 7-Method S/R Levels ─────────────────────────────
function generateAllLevels(data: OHLCV[], endIdx: number): RawSRLevel[] {
  const levels: RawSRLevel[] = [];
  if (endIdx < 10) return levels;

  const slice = data.slice(0, endIdx + 1);
  const currentPrice = slice[slice.length - 1].close;
  const closes = slice.map(d => d.close);
  const noFib: [string, string] = ['—', ''];

  // ── Method 1: Swing High/Low (Price Action) ──────────────────────────
  for (const lookback of [3, 5, 7]) {
    const swings = findSwingLevels(slice, lookback);
    const tol = currentPrice * 0.005; // 0.5% tolerance

    // Connect swing highs → resistance
    const usedHigh = new Set<number>();
    for (const h of swings.highs) {
      if (usedHigh.has(h.idx)) continue;
      let sum = h.price;
      let count = 1;
      for (const h2 of swings.highs) {
        if (h2 === h || usedHigh.has(h2.idx)) continue;
        if (Math.abs(h2.price - h.price) < tol) {
          sum += h2.price;
          count++;
          usedHigh.add(h2.idx);
        }
      }
      usedHigh.add(h.idx);
      if (sum / count > currentPrice * 1.005) {
        levels.push({ price: sum / count, method: 'Swing_High', type: 'resistance', ...noFib });
      }
    }

    // Connect swing lows → support
    const usedLow = new Set<number>();
    for (const l of swings.lows) {
      if (usedLow.has(l.idx)) continue;
      let sum = l.price;
      let count = 1;
      for (const l2 of swings.lows) {
        if (l2 === l || usedLow.has(l2.idx)) continue;
        if (Math.abs(l2.price - l.price) < tol) {
          sum += l2.price;
          count++;
          usedLow.add(l2.idx);
        }
      }
      usedLow.add(l.idx);
      if (sum / count < currentPrice * 0.995) {
        levels.push({ price: sum / count, method: 'Swing_Low', type: 'support', ...noFib });
      }
    }
  }

  // ── Method 2: SMA Dynamic S/R ──────────────────────────────────────
  for (const period of [20, 50, 100, 200]) {
    const smaVal = sma(closes, period);
    if (smaVal <= 0) continue;
    const type: 'support' | 'resistance' = currentPrice > smaVal ? 'support' : 'resistance';
    levels.push({ price: smaVal, method: `SMA_${period}`, type, ...noFib });
  }

  // ── Method 3: Bollinger Bands ───────────────────────────────────────
  const bb = calcBollingerBands(closes);
  if (bb.upper > 0 && bb.lower > 0) {
    levels.push({ price: bb.upper, method: 'BB_Upper', type: 'resistance', ...noFib });
    levels.push({ price: bb.lower, method: 'BB_Lower', type: 'support', ...noFib });
  }

  // ── Method 4: Fibonacci Retracement + Extension ─────────────────────
  interface SwingPair { high: number; highIdx: number; low: number; lowIdx: number; range: number }
  let bestSwing: SwingPair | null = null;

  for (const lb of [3, 5, 7, 10, 15, 20]) {
    const sw = findSwingLevels(slice, lb);
    if (sw.highs.length === 0 || sw.lows.length === 0) continue;
    for (const h of sw.highs) {
      for (const l of sw.lows) {
        if (Math.abs(h.idx - l.idx) < 3) continue;
        const range = Math.abs(h.price - l.price);
        if (range / currentPrice < 0.03) continue;
        if (!bestSwing || range > bestSwing.range) {
          bestSwing = {
            high: Math.max(h.price, l.price),
            highIdx: h.price > l.price ? h.idx : l.idx,
            low: Math.min(h.price, l.price),
            lowIdx: h.price < l.price ? l.idx : h.idx,
            range,
          };
        }
      }
    }
  }

  if (bestSwing) {
    const H = bestSwing.high;
    const L = bestSwing.low;
    const range = H - L;

    for (const ratio of FIB_RETRACEMENTS) {
      const price = H - ratio * range;
      if (price <= 0) continue;
      const rounded = roundToNice(price);
      const type: 'support' | 'resistance' = rounded >= currentPrice ? 'resistance' : 'support';
      levels.push({
        price: rounded, method: `Fibonacci_${ratio}`, type,
        fibRatio: String(ratio), fibLabel: FIB_LABELS[String(ratio)] || '',
      });
    }

    for (const extRatio of FIB_EXTENSIONS) {
      const price = H + (extRatio - 1) * range;
      if (price <= 0) continue;
      const rounded = roundToNice(price);
      const type: 'support' | 'resistance' = rounded >= currentPrice ? 'resistance' : 'support';
      levels.push({
        price: rounded, method: `Fibonacci_${extRatio}`, type,
        fibRatio: String(extRatio), fibLabel: FIB_LABELS[String(extRatio)] || '',
      });
    }

    // Inverse extensions (below L)
    for (const extRatio of FIB_EXTENSIONS) {
      const price = L - (extRatio - 1) * range;
      if (price <= 0) continue;
      const rounded = roundToNice(price);
      const type: 'support' | 'resistance' = rounded >= currentPrice ? 'resistance' : 'support';
      levels.push({
        price: rounded, method: `Fibonacci_${-extRatio}`, type,
        fibRatio: String(-extRatio), fibLabel: '',
      });
    }

    // Secondary swing confluence (check overlap with secondary swings)
    const secondarySwings: SwingPair[] = [];
    for (const lb of [3, 5, 7]) {
      const sw = findSwingLevels(slice, lb);
      for (const h of sw.highs) {
        for (const l of sw.lows) {
          if (Math.abs(h.idx - l.idx) < 3) continue;
          const r = Math.abs(h.price - l.price);
          if (r / currentPrice < 0.05) continue;
          if (bestSwing && Math.abs(r - bestSwing.range) / bestSwing.range < 0.1) continue;
          secondarySwings.push({
            high: Math.max(h.price, l.price), highIdx: h.price > l.price ? h.idx : l.idx,
            low: Math.min(h.price, l.price), lowIdx: h.price < l.price ? l.idx : h.idx,
            range: r,
          });
        }
      }
    }
    // Secondary swings' fib levels are merged via confluence (1% rule in mergeLevels)
    const confluenceTol = currentPrice * 0.005;
    for (const sec of secondarySwings.slice(0, 3)) {
      const sH = sec.high, sL = sec.low, sR = sH - sL;
      for (const ratio of FIB_RETRACEMENTS) {
        const price = roundToNice(sH - ratio * sR);
        if (price <= 0) continue;
        const type: 'support' | 'resistance' = price >= currentPrice ? 'resistance' : 'support';
        levels.push({
          price, method: `Fibonacci_${ratio}`, type,
          fibRatio: String(ratio), fibLabel: FIB_LABELS[String(ratio)] || '',
        });
      }
      for (const extR of FIB_EXTENSIONS) {
        const price = roundToNice(sH + (extR - 1) * sR);
        if (price <= 0) continue;
        const type: 'support' | 'resistance' = price >= currentPrice ? 'resistance' : 'support';
        levels.push({
          price, method: `Fibonacci_${extR}`, type,
          fibRatio: String(extR), fibLabel: FIB_LABELS[String(extR)] || '',
        });
      }
    }
  }

  // ── Method 5: Volume Profile (VAP) ──────────────────────────────────
  const dataHasVolume = slice.some(d => d.volume > 0);
  if (dataHasVolume) {
    let minP = Infinity, maxP = -Infinity;
    for (const d of slice) {
      if (d.low < minP) minP = d.low;
      if (d.high > maxP) maxP = d.high;
    }
    const numBins = 40;
    const binSize = Math.max((maxP - minP) / numBins, currentPrice * 0.001);
    const vap = new Array(numBins).fill(0);
    const binCenters: number[] = [];

    for (let b = 0; b < numBins; b++) {
      binCenters.push(minP + (b + 0.5) * binSize);
    }

    for (const d of slice) {
      for (let b = 0; b < numBins; b++) {
        if (d.low <= binCenters[b] && binCenters[b] <= d.high) {
          vap[b] += d.volume;
        }
      }
    }

    const maxVAP = Math.max(...vap);
    if (maxVAP > 0) {
      // POC (Point of Control)
      let pocIdx = 0;
      for (let b = 1; b < numBins; b++) {
        if (vap[b] > vap[pocIdx]) pocIdx = b;
      }
      const pocPrice = binCenters[pocIdx];
      const pocType: 'support' | 'resistance' = pocPrice > currentPrice ? 'resistance' : 'support';
      levels.push({ price: pocPrice, method: 'VAP_POC', type: pocType, ...noFib });

      // HVN (High Volume Nodes)
      for (let b = 0; b < numBins; b++) {
        if (b === pocIdx) continue;
        if (vap[b] > 0.7 * maxVAP) {
          const hvnPrice = binCenters[b];
          const hvnType: 'support' | 'resistance' = hvnPrice > currentPrice ? 'resistance' : 'support';
          levels.push({ price: hvnPrice, method: 'VAP_HVN', type: hvnType, ...noFib });
        }
      }
    }
  }

  // ── Method 6: Pivot Points (4 algorithms) ───────────────────────────
  if (endIdx >= 1) {
    const prev = slice[endIdx - 1]; // Previous completed bar
    const pH = prev.high, pL = prev.low, pC = prev.close, pO = prev.open;

    // Standard Pivot
    {
      const PP = (pH + pL + pC) / 3;
      const R1 = 2 * PP - pL, S1 = 2 * PP - pH;
      const R2 = PP + (pH - pL), S2 = PP - (pH - pL);
      const R3 = pH + 2 * (PP - pL), S3 = pL - 2 * (pH - PP);
 if (R1 > 0) levels.push({ price: R1, method: 'Pivot_R1', type: 'resistance', ...noFib });
      if (R2 > 0) levels.push({ price: R2, method: 'Pivot_R2', type: 'resistance', ...noFib });
      if (R3 > 0) levels.push({ price: R3, method: 'Pivot_R3', type: 'resistance', ...noFib });
      if (S1 > 0) levels.push({ price: S1, method: 'Pivot_S1', type: 'support', ...noFib });
      if (S2 > 0) levels.push({ price: S2, method: 'Pivot_S2', type: 'support', ...noFib });
      if (S3 > 0) levels.push({ price: S3, method: 'Pivot_S3', type: 'support', ...noFib });
    }

    // Fibonacci Pivot
    {
      const PP = (pH + pL + pC) / 3;
      const range = pH - pL;
      for (const [mult, suffix] of [[0.382, '1'], [0.618, '2'], [1.0, '3']] as [number, string][]) {
        const R = PP + mult * range;
        const S = PP - mult * range;
        if (R > 0) levels.push({ price: R, method: `Fib_Pivot_R${suffix}`, type: 'resistance', ...noFib });
        if (S > 0) levels.push({ price: S, method: `Fib_Pivot_S${suffix}`, type: 'support', ...noFib });
      }
    }

    // Woodie's Pivot
    {
      const PP = (pH + pL + 2 * pC) / 4;
      const R1 = 2 * PP - pL, S1 = 2 * PP - pH;
      const R2 = PP + (pH - pL), S2 = PP - (pH - pL);
      if (R1 > 0) levels.push({ price: R1, method: 'Woodie_R1', type: 'resistance', ...noFib });
      if (R2 > 0) levels.push({ price: R2, method: 'Woodie_R2', type: 'resistance', ...noFib });
      if (S1 > 0) levels.push({ price: S1, method: 'Woodie_S1', type: 'support', ...noFib });
      if (S2 > 0) levels.push({ price: S2, method: 'Woodie_S2', type: 'support', ...noFib });
    }

    // DeMark Pivot
    {
      const X = pC < pO ? pH + 2 * pL + pC : pC > pO ? 2 * pH + pL + pC : pH + pL + 2 * pC;
      const PP = X / 4;
      const R1 = X / 2 - pL;
      const S1 = X / 2 - pH;
      if (R1 > 0) levels.push({ price: R1, method: 'DeMark_R1', type: 'resistance', ...noFib });
      if (S1 > 0) levels.push({ price: S1, method: 'DeMark_S1', type: 'support', ...noFib });
    }
  }

  // ── Method 7: Psychological Levels ──────────────────────────────────
  {
    const step = psychStep(currentPrice);
    const base = psychRound(currentPrice);
    for (const mult of [-2, -1, 1, 2]) {
      const price = base + mult * step;
      if (price <= 0) continue;
      const type: 'support' | 'resistance' = price > currentPrice ? 'resistance' : 'support';
      levels.push({ price, method: 'Psychological', type, ...noFib });
    }
  }

  return levels;
}

// ─── Helper: Merge Nearby Levels (1% Confluence) ──────────────────────────
function mergeLevels(rawLevels: RawSRLevel[], currentPrice: number): MergedSRLevel[] {
  if (rawLevels.length === 0) return [];

  const tol = currentPrice * 0.01; // 1% tolerance
  const merged: MergedSRLevel[] = [];
  const used = new Set<number>();

  for (let i = 0; i < rawLevels.length; i++) {
    if (used.has(i)) continue;

    let sumPrice = rawLevels[i].price;
    let count = 1;
    const methods = new Set<string>();
    methods.add(rawLevels[i].method);
    let bestFibRatio = rawLevels[i].fibRatio;
    let bestFibLabel = rawLevels[i].fibLabel;

    for (let j = i + 1; j < rawLevels.length; j++) {
      if (used.has(j)) continue;
      if (Math.abs(rawLevels[j].price - rawLevels[i].price) < tol) {
        sumPrice += rawLevels[j].price;
        count++;
        methods.add(rawLevels[j].method);
        used.add(j);
        // Prefer Fibonacci label if available
        if (rawLevels[j].fibRatio !== '—' && bestFibRatio === '—') {
          bestFibRatio = rawLevels[j].fibRatio;
          bestFibLabel = rawLevels[j].fibLabel;
        }
      }
    }
    used.add(i);

    const avgPrice = sumPrice / count;
    const type: 'support' | 'resistance' = avgPrice >= currentPrice ? 'resistance' : 'support';

    merged.push({
      price: avgPrice,
      type,
      methods: [...methods],
      overlapCount: methods.size,
      fibRatio: bestFibRatio,
      fibLabel: bestFibLabel,
      score: 0,
      strength: 1,
      touchCount: 0,
      volumeRatio: 0,
      freshness: 0,
      distancePercent: 0,
    });
  }

  return merged;
}

// ─── Helper: Compute Level Features (5 ML features) ──────────────────────
function computeLevelFeatures(
  levelPrice: number,
  data: OHLCV[],
  endIdx: number,
  currentPrice: number,
  overlapCount: number,
): number[] {
  const lookback = Math.min(30, endIdx);
  const startIdx = endIdx - lookback;
  const touchTol = currentPrice * 0.002; // 0.2%

  let touchCount = 0;
  let totalVolAtTouches = 0;
  let totalVol = 0;
  let barsSinceLastTouch = lookback;

  for (let i = startIdx; i <= endIdx; i++) {
    const bar = data[i];
    totalVol += bar.volume;

    if (bar.low <= levelPrice + touchTol && bar.high >= levelPrice - touchTol) {
      touchCount++;
      totalVolAtTouches += bar.volume;
      barsSinceLastTouch = endIdx - i;
    }
  }

  const avgVol = lookback > 0 ? totalVol / lookback : 0;
  const volumeRatio = (touchCount > 0 && avgVol > 0) ? (totalVolAtTouches / touchCount) / avgVol : 1;
  const freshness = Math.max(0, Math.min(1, 1 - barsSinceLastTouch / 30));
  const distancePercent = Math.min(1, Math.abs(levelPrice - currentPrice) / currentPrice);

  // Features: [touch_count, volume_ratio, overlap_count, freshness, distance_percent]
  return [touchCount, volumeRatio, overlapCount - 1, freshness, distancePercent];
}

// ─── Helper: Train S/R Scoring Weights (Ridge OLS) ───────────────────────
function trainSRWeights(data: OHLCV[]): number[] {
  const defaultWeights = [0.25, 0.20, 0.25, 0.15, 0.15];

  if (data.length < 50) return defaultWeights;

  const X: number[][] = [];
  const y: number[] = [];

  for (let i = 40; i <= data.length - 11; i += 5) {
    const barPrice = data[i].close;
    const rawLevels = generateAllLevels(data, i);
    if (rawLevels.length === 0) continue;
    const merged = mergeLevels(rawLevels, barPrice);

    for (const level of merged) {
      const features = computeLevelFeatures(level.price, data, i, barPrice, level.overlapCount);
      X.push(features);

      // Label: did price return within 10 bars?
      let returned = false;
      const retTol = barPrice * 0.005;
      for (let j = i + 1; j <= Math.min(i + 10, data.length - 1); j++) {
        if (data[j].low <= level.price + retTol && data[j].high >= level.price - retTol) {
          returned = true;
          break;
        }
      }
      y.push(returned ? 1 : 0);
    }
  }

  if (X.length < 20) return defaultWeights;

  // Ridge OLS: w = (X^T X + λI)^(-1) X^T y
  const n = X.length;
  const p = 5;
  const lambda = 0.01;

  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      for (let b = 0; b < p; b++) {
        XtX[a][b] += X[i][a] * X[i][b];
      }
    }
  }
  for (let a = 0; a < p; a++) XtX[a][a] += lambda;

  const Xty: number[] = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
    }
  }

  const weights = solveLinearSystem(XtX, Xty);
  if (!weights) return defaultWeights;
  if (weights.some(w => isNaN(w) || !isFinite(w))) return defaultWeights;

  for (let i = 0; i < p; i++) {
    if (weights[i] < 0) weights[i] = 0;
  }

  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return defaultWeights;

  return weights.map(w => w / sum);
}

// ─── Helper: WMA Array (full series) ─────────────────────────────────────
function calcWMAArray(closes: number[], period: number): number[] {
  const result: number[] = [];
  if (closes.length < period) return closes.map(() => 0);
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(0); continue; }
    let numer = 0;
    let denom = 0;
    for (let j = 0; j < period; j++) {
      const weight = period - j;
      numer += closes[i - period + 1 + j] * weight;
      denom += weight;
    }
    result.push(numer / denom);
  }
  return result;
}

// ─── Helper: WMA (latest value) ────────────────────────────────────
function calcWMA(closes: number[], period: number): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  let numer = 0;
  let denom = 0;
  for (let i = 0; i < period; i++) {
    const weight = period - i;
    numer += slice[i] * weight;
    denom += weight;
  }
  return numer / denom;
}

// ─── Helper: HMA (Hull Moving Average) ─────────────────────────────
function calcHMA(closes: number[], period: number = 20): number {
  if (closes.length < period) return 0;
  const halfPeriod = Math.max(1, Math.floor(period / 2));
  const sqrtPeriod = Math.max(1, Math.floor(Math.sqrt(period)));
  const wmaHalf = calcWMAArray(closes, halfPeriod);
  const wmaFull = calcWMAArray(closes, period);
  // Build difference series: 2*WMA(half) - WMA(full)
  const diff: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    diff.push(2 * wmaHalf[i] - wmaFull[i]);
  }
  return calcWMA(diff, sqrtPeriod);
}

// ─── Helper: TMA (Triangular Moving Average) ───────────────────────
function calcTMA(closes: number[], period: number = 20): number {
  if (closes.length < period) return 0;
  const halfPeriod = Math.max(1, Math.floor(period / 2) + 1);
  // SMA of SMA
  const firstSMA = smaArray(closes, halfPeriod);
  const nonZero = firstSMA.filter(v => v > 0);
  return nonZero.length >= halfPeriod ? sma(nonZero, halfPeriod) : (nonZero[nonZero.length - 1] ?? 0);
}

// ─── Helper: LMA (Linear Moving Average = (SMA+EMA)/2) ─────────────
function calcLMA(closes: number[], period: number = 20): number {
  return (sma(closes, period) + emaCalc(closes, period)) / 2;
}

// ─── Helper: MA Ribbon Alignment Score ─────────────────────────────
function calcMARibbonAlignment(closes: number[]): number {
  const emaPeriods = [5, 10, 20, 50, 100, 200];
  const emaVals: number[] = [];
  for (const p of emaPeriods) {
    emaVals.push(emaCalc(closes, p));
  }
  // Count aligned pairs (short-term above long-term = bullish alignment)
  let aligned = 0;
  let total = 0;
  for (let i = 0; i < emaVals.length - 1; i++) {
    if (emaVals[i] > 0 && emaVals[i + 1] > 0) {
      total++;
      if (emaVals[i] > emaVals[i + 1]) aligned++;
    }
  }
  return total > 0 ? aligned / total : 0.5;
}

// ─── Helper: Heiken Ashi (latest bar) ──────────────────────────────
function calcHeikenAshi(data: OHLCV[]): { open: number; high: number; low: number; close: number } {
  if (data.length === 0) return { open: 0, high: 0, low: 0, close: 0 };
  let prevHAOpen = 0;
  let prevHAClose = 0;
  for (let i = 0; i < data.length; i++) {
    const haClose = (data[i].open + data[i].high + data[i].low + data[i].close) / 4;
    const haOpen = i === 0 ? (data[i].open + data[i].close) / 2 : (prevHAOpen + prevHAClose) / 2;
    const haHigh = Math.max(data[i].high, haOpen, haClose);
    const haLow = Math.min(data[i].low, haOpen, haClose);
    prevHAOpen = haOpen;
    prevHAClose = haClose;
    if (i === data.length - 1) {
      return { open: haOpen, high: haHigh, low: haLow, close: haClose };
    }
  }
  return { open: 0, high: 0, low: 0, close: 0 };
}

// ─── Helper: Awesome Oscillator ─────────────────────────────────────
function calcAwesomeOscillator(data: OHLCV[]): number {
  if (data.length < 34) return 0;
  const medians = data.map(d => (d.high + d.low) / 2);
  return sma(medians, 5) - sma(medians, 34);
}

// ─── Helper: Momentum ──────────────────────────────────────────────
function calcMomentum(closes: number[], period: number = 10): number {
  if (closes.length < period + 1) return 0;
  return closes[closes.length - 1] - closes[closes.length - 1 - period];
}

// ─── Helper: Fast Stochastic %K (14,3) — smoothed %K without %D ────
function calcFastStochastic(data: OHLCV[], kPeriod: number = 14, smoothK: number = 3): number {
  if (data.length < kPeriod) return 50;
  const rawKs: number[] = [];
  for (let i = kPeriod - 1; i < data.length; i++) {
    let lowest = Infinity;
    let highest = -Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (data[j].low < lowest) lowest = data[j].low;
      if (data[j].high > highest) highest = data[j].high;
    }
    const range = highest - lowest;
    rawKs.push(range === 0 ? 50 : ((data[i].close - lowest) / range) * 100);
  }
  if (rawKs.length < smoothK) return rawKs[rawKs.length - 1] ?? 50;
  const slice = rawKs.slice(-smoothK);
  return slice.reduce((a, b) => a + b, 0) / smoothK;
}

// ─── Helper: Fisher Transform ──────────────────────────────────────
function calcFisherTransform(data: OHLCV[], period: number = 9): number {
  if (data.length < period) return 0;
  let fisher = 0;
  for (let i = period; i < data.length; i++) {
    let maxH = -Infinity;
    let minL = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (data[j].high > maxH) maxH = data[j].high;
      if (data[j].low < minL) minL = data[j].low;
    }
    const range = maxH - minL;
    if (range === 0) continue;
    const raw = 2 * ((data[i].close - minL) / range - 0.5);
    const val = Math.max(0.0001, Math.min(0.9999, (raw + 1) / 2));
    fisher = 0.5 * Math.log(val / (1 - val)) + 0.5 * fisher;
  }
  return fisher;
}

// ─── Helper: PVO (Price Volume Oscillator) ─────────────────────────
function calcPVO(data: OHLCV[], shortPeriod: number = 12, longPeriod: number = 26): number {
  if (data.length < longPeriod) return 0;
  const volumes = data.map(d => d.volume);
  const emaShort = emaCalc(volumes, shortPeriod);
  const emaLong = emaCalc(volumes, longPeriod);
  if (emaLong === 0) return 0;
  return ((emaShort - emaLong) / emaLong) * 100;
}

// ─── Helper: Confidence Index (composite) ──────────────────────────
function calcConfidenceIndex(
  rsiVal: number, mfiVal: number, macdLine: number, macdSignal: number,
  adxVal: number, stochKVal: number, trendR2: number
): number {
  let score = 0;
  let count = 0;
  score += rsiVal > 50 ? 1 : 0; count++;
  if (mfiVal !== 50) { score += mfiVal > 50 ? 1 : 0; count++; }
  score += macdLine > macdSignal ? 1 : 0; count++;
  score += stochKVal > 50 ? 1 : 0; count++;
  const trendStrength = Math.min(adxVal / 50, 1);
  const trendReliability = trendR2;
  return count > 0 ? (score / count) * (0.5 + 0.25 * trendStrength + 0.25 * trendReliability) : 0.5;
}

// ─── Helper: Strength Index (composite) ────────────────────────────
function calcStrengthIndex(
  rsiVal: number, macdHist: number, adxVal: number,
  atrVal: number, price: number, ema12Val: number, ema26Val: number
): number {
  const rsiStrength = (rsiVal - 50) / 50;
  const macdStrength = Math.tanh(macdHist / (atrVal > 0 ? atrVal : 1) * 2);
  const adxStrength = adxVal / 100;
  const emaSpread = price > 0 ? (ema12Val - ema26Val) / price * 10 : 0;
  const emaStrength = Math.tanh(emaSpread);
  const directional = (rsiStrength + macdStrength + emaStrength) / 3;
  return (directional * 0.5 + 0.5) * (0.3 + 0.7 * adxStrength);
}

// ─── Helper: A/D (Accumulation/Distribution) Line ──────────────────
function calcAccumDist(data: OHLCV[]): number {
  let adVal = 0;
  for (let i = 0; i < data.length; i++) {
    const h = data[i].high;
    const l = data[i].low;
    if (h === l) continue;
    const clv = ((data[i].close - l) - (h - data[i].close)) / (h - l);
    adVal += clv * data[i].volume;
  }
  return adVal;
}

// ─── Helper: VPT (Volume Price Trend) ──────────────────────────────
function calcVPT(data: OHLCV[]): number {
  if (data.length < 2) return 0;
  let vptVal = 0;
  for (let i = 1; i < data.length; i++) {
    const prevClose = data[i - 1].close;
    if (prevClose === 0) continue;
    vptVal += data[i].volume * ((data[i].close - prevClose) / prevClose);
  }
  return vptVal;
}

// ─── Helper: VOSC (Volume Oscillator) ──────────────────────────────
function calcVOSC(data: OHLCV[], shortPeriod: number = 5, longPeriod: number = 10): number {
  if (data.length < longPeriod) return 0;
  const volumes = data.map(d => d.volume);
  const smaShort = sma(volumes, shortPeriod);
  const smaLong = sma(volumes, longPeriod);
  if (smaLong === 0) return 0;
  return ((smaShort - smaLong) / smaLong) * 100;
}

// ─── Helper: Chaikin A/D Line ──────────────────────────────────────
function calcChaikinAD(data: OHLCV[]): number {
  let cad = 0;
  for (let i = 0; i < data.length; i++) {
    const h = data[i].high;
    const l = data[i].low;
    if (h === l) continue;
    const clv = ((data[i].close - l) - (h - data[i].close)) / (h - l);
    cad += clv * data[i].volume;
  }
  return cad;
}

// ─── Helper: Force Index ───────────────────────────────────────────
function calcForceIndex(data: OHLCV[], period: number = 13): number {
  if (data.length < 2) return 0;
  const rawFI: number[] = [];
  for (let i = 1; i < data.length; i++) {
    rawFI.push((data[i].close - data[i - 1].close) * data[i].volume);
  }
  return emaCalc(rawFI, period);
}

// ─── Helper: Keltner Channels ──────────────────────────────────────
function calcKeltnerChannels(data: OHLCV[], emaPeriod: number = 20, multiplier: number = 2): { upper: number; middle: number; lower: number } {
  const closes = data.map(d => d.close);
  const middle = emaCalc(closes, emaPeriod);
  const atrVal = calcATR(data, emaPeriod);
  return {
    upper: middle + multiplier * atrVal,
    middle,
    lower: middle - multiplier * atrVal,
  };
}

// ─── Helper: Envelopes ─────────────────────────────────────────────
function calcEnvelopes(closes: number[], period: number = 20, percent: number = 2.5): { upper: number; middle: number; lower: number } {
  const middle = sma(closes, period);
  return {
    upper: middle * (1 + percent / 100),
    middle,
    lower: middle * (1 - percent / 100),
  };
}

// ─── Helper: Standard Deviation ────────────────────────────────────
function calcStdDev(closes: number[], period: number = 20): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  return Math.sqrt(variance);
}

// ─── Helper: Historical Volatility ─────────────────────────────────
function calcHV(closes: number[], period: number = 20): number {
  if (closes.length < period + 1) return 0;
  const logReturns: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    if (i < 1 || closes[i - 1] <= 0 || closes[i] <= 0) continue;
    logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (logReturns.length < 2) return 0;
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (logReturns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

// ─── Support / Resistance (7-Method ML-Based System) ─────────────────────
function calcSupportResistance(data: OHLCV[], currentPrice: number): {
  resistances: number[];
  supports: number[];
  supportStrengths: LevelStrength[];
  resistanceStrengths: LevelStrength[];
  priceTargets: LevelStrength[];
} {
  if (data.length < 10) {
    return {
      resistances: [], supports: [],
      supportStrengths: [], resistanceStrengths: [],
      priceTargets: [],
    };
  }

  // ── Step 1: Generate all levels from 7 methods ────────────────────────
  const rawLevels = generateAllLevels(data, data.length - 1);

  // ── Step 2: Merge nearby levels (confluence within 1%) ────────────────
  let merged = mergeLevels(rawLevels, currentPrice);

  // ── Step 3: Train ML weights on historical data ───────────────────────
  const weights = trainSRWeights(data);

  // ── Step 4: Compute features & score each merged level ────────────────
  for (const level of merged) {
    const features = computeLevelFeatures(level.price, data, data.length - 1, currentPrice, level.overlapCount);

    const touchScore = Math.min(features[0] / 5, 1);
    const volumeScore = Math.min(features[1] / 2, 1);
    const overlapScore = Math.min(features[2] * 2, 10) / 10;
    const freshnessScore = features[3];
    const distanceScore = 1 - features[4];

    const powerScore = (
      weights[0] * touchScore +
      weights[1] * volumeScore +
      weights[2] * overlapScore +
      weights[3] * freshnessScore +
      weights[4] * distanceScore
    ) * 10;

    level.score = Math.max(0, Math.min(10, powerScore));
    level.strength = Math.max(1, Math.min(10, Math.round(level.score)));
    level.touchCount = features[0];
    level.volumeRatio = features[1];
    level.freshness = features[3];
    level.distancePercent = features[4];
  }

  // ── Step 5: Psychological rounding of all level prices ─────────────────
  for (const level of merged) {
    level.price = psychRound(level.price);
  }

  // Re-classify types after rounding
  for (const level of merged) {
    level.type = level.price >= currentPrice ? 'resistance' : 'support';
  }

  // Deduplicate after rounding (keep strongest at same price)
  {
    const deduped: MergedSRLevel[] = [];
    for (const level of merged) {
      const existing = deduped.find(d => Math.abs(d.price - level.price) < currentPrice * 0.001);
      if (existing) {
        if (level.score > existing.score) {
          Object.assign(existing, level);
        }
      } else {
        deduped.push(level);
      }
    }
    merged = deduped;
  }

  // ── Step 6: Separate into supports and resistances ─────────────────────
  let supports = merged.filter(l => l.type === 'support');
  let resistances = merged.filter(l => l.type === 'resistance');

  // ── Step 7: Distance filtering (strict 5-10% gap rules) ─────────────
  // Rules:
  //   1. Consecutive lines of same type: 5% ≤ gap ≤ 10%
  //   2. Nearest support ≤ 10% below price (can be < 5%)
  //   3. Nearest resistance ≤ 10% above price (can be < 5%)

  const filterAndSelectLevels = (
    levels: MergedSRLevel[],
    type: 'support' | 'resistance'
  ): MergedSRLevel[] => {
    if (levels.length === 0) return [];

    // Sort: supports descending (nearest first), resistances ascending (nearest first)
    const sorted = [...levels].sort((a, b) =>
      type === 'support' ? b.price - a.price : a.price - b.price
    );

    // ── Rule 2/3: Nearest level must be within 10% of price ──
    const nearest = sorted[0];
    const distFromPrice = Math.abs(nearest.price - currentPrice) / currentPrice;
    if (distFromPrice > 0.10) {
      // Nearest level is too far — generate a synthetic level at ~5% from price
      const syntheticPrice = type === 'support'
        ? Math.round(currentPrice * 0.95 / psychStep(currentPrice)) * psychStep(currentPrice)
        : Math.round(currentPrice * 1.05 / psychStep(currentPrice)) * psychStep(currentPrice);
      const synthetic: MergedSRLevel = {
        price: syntheticPrice,
        type,
        score: 3,
        strength: 3,
        overlapCount: 1,
        methods: ['Psychological'],
        fibRatio: '—',
        fibLabel: '',
      };
      sorted.unshift(synthetic);
    }

    // ── Rule 1: Select levels with 5-10% gaps between consecutive ──
    const result: MergedSRLevel[] = [sorted[0]];

    for (let i = 1; i < sorted.length && result.length < 6; i++) {
      const prevPrice = result[result.length - 1].price;
      const currPrice = sorted[i].price;
      const gap = Math.abs(currPrice - prevPrice) / prevPrice;

      if (gap < 0.05) {
        // Too close — keep the stronger one
        if (sorted[i].score > result[result.length - 1].score) {
          result[result.length - 1] = sorted[i];
        }
      } else if (gap <= 0.10) {
        // Perfect gap (5-10%) — accept
        result.push(sorted[i]);
      } else {
        // Gap > 10% — try to find an intermediate level
        let found = false;
        for (let j = i + 1; j < sorted.length; j++) {
          const midPrice = sorted[j].price;
          const gapFromPrev = Math.abs(midPrice - prevPrice) / prevPrice;
          const gapToNext = Math.abs(currPrice - midPrice) / midPrice;
          if (gapFromPrev >= 0.05 && gapFromPrev <= 0.10) {
            result.push(sorted[j]);
            found = true;
            // Skip levels that are too close to the inserted one
            i = j;
            break;
          }
        }
        if (!found) {
          // No intermediate found — generate a synthetic level at ~7.5% from prev
          const synthGap = 0.075;
          const syntheticPrice = type === 'support'
            ? Math.round((prevPrice * (1 - synthGap)) / psychStep(prevPrice)) * psychStep(prevPrice)
            : Math.round((prevPrice * (1 + synthGap)) / psychStep(prevPrice)) * psychStep(prevPrice);
          // Make sure it's not too close to next level
          const gapToNext = Math.abs(currPrice - syntheticPrice) / syntheticPrice;
          if (gapToNext >= 0.05) {
            const synthetic: MergedSRLevel = {
              price: syntheticPrice,
              type,
              score: 2,
              strength: 2,
              overlapCount: 1,
              methods: ['Psychological'],
              fibRatio: '—',
              fibLabel: '',
            };
            result.push(synthetic);
          }
        }
      }
    }

    return result;
  };

  const finalSupports = filterAndSelectLevels(supports, 'support');
  const finalResistances = filterAndSelectLevels(resistances, 'resistance');

  // ── Step 9: Build LevelStrength objects ────────────────────────────────
  const toLevelStrength = (m: MergedSRLevel): LevelStrength => {
    let grade: string;
    if (m.score >= 8.5) grade = 'Very Strong';
    else if (m.score >= 7) grade = 'Strong';
    else if (m.score >= 5) grade = 'Moderate';
    else grade = 'Weak';

    return {
      price: m.price,
      strength: m.strength,
      score: m.score,
      grade,
      isTarget: m.score >= 7,
      overlapCount: m.overlapCount,
      methods: m.methods,
      fibRatio: m.fibRatio,
      fibLabel: m.fibLabel,
    };
  };

  const supportStrengths = finalSupports.map(toLevelStrength);
  const resistanceStrengths = finalResistances.map(toLevelStrength);

  // Price targets: all levels with isTarget=true
  const priceTargets = [...supportStrengths, ...resistanceStrengths].filter(l => l.isTarget);

  return {
    resistances: resistanceStrengths.map(l => l.price),
    supports: supportStrengths.map(l => l.price),
    supportStrengths,
    resistanceStrengths,
    priceTargets,
  };
}


// ─── Trend Analysis ───────────────────────────────────────────────────────────
function calcTrend(closes: number[], period: number): TrendResult {
  const slice = closes.slice(-Math.min(period, closes.length));
  const { slope, r2 } = linearRegression(slice);
  const avgPrice = slice.reduce((a, b) => a + b, 0) / slice.length;
  const angle = avgPrice === 0 ? 0 : Math.atan(slope / avgPrice) * (180 / Math.PI);
  const priceThreshold = avgPrice * 0.001; // 0.1%
  const direction = slope > priceThreshold ? 'up' : slope < -priceThreshold ? 'down' : 'flat';
  return { direction, slope, angle, r2: Math.max(0, Math.min(1, r2)) };
}


// ═══════════════════════════════════════════════════════════════════════════════
// VDss 7-LAYER PROBABILITY ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helper: simplified S/R at a historical bar using swing levels ─────────────
function simplifiedSR(data: OHLCV[], barIdx: number): { R1: number; S1: number } {
  const slice = data.slice(0, barIdx + 1);
  const price = slice[slice.length - 1].close;
  let nearestR = price * 1.05;
  let nearestS = price * 0.95;

  // Collect all swing highs (resistance) and swing lows (support)
  const resistances: number[] = [];
  const supports: number[] = [];
  for (const lb of [3, 5, 7]) {
    const swings = findSwingLevels(slice, lb);
    resistances.push(...swings.highs);
    supports.push(...swings.lows);
  }

  // Find nearest resistance above price
  const abovePrice = resistances.filter(r => r > price).sort((a, b) => a - b);
  if (abovePrice.length > 0) nearestR = abovePrice[0];

  // Find nearest support below price
  const belowPrice = supports.filter(s => s < price).sort((a, b) => b - a);
  if (belowPrice.length > 0) nearestS = belowPrice[0];

  return { R1: nearestR, S1: nearestS };
}

// ─── Helper: divergence detection on last 20 bars (SIMPLIFIED for speed) ───────
// Returns true if bullish divergence detected, false if bearish, null if none
function detectDivergenceSimple(data: OHLCV[], barIdx: number): boolean | null {
  const lookback = 20;
  const start = Math.max(0, barIdx - lookback);
  const slice = data.slice(start, barIdx + 1);
  if (slice.length < 10) return null;

  const mid = Math.floor(slice.length / 2);
  const firstHalf = slice.slice(0, mid);
  const secondHalf = slice.slice(mid);

  const priceHigh1 = Math.max(...firstHalf.map(d => d.high));
  const priceHigh2 = Math.max(...secondHalf.map(d => d.high));
  const priceLow1 = Math.min(...firstHalf.map(d => d.low));
  const priceLow2 = Math.min(...secondHalf.map(d => d.low));

  // Bearish divergence: price higher high but RSI proxy (MFI-like) lower
  // Use close/avg ratio as simple momentum proxy instead of computing full RSI
  const avgClose1 = firstHalf.reduce((s, d) => s + d.close, 0) / firstHalf.length;
  const avgClose2 = secondHalf.reduce((s, d) => s + d.close, 0) / secondHalf.length;
  const momentum1 = priceHigh1 > 0 ? (priceHigh1 - avgClose1) / priceHigh1 : 0;
  const momentum2 = priceHigh2 > 0 ? (priceHigh2 - avgClose2) / priceHigh2 : 0;

  if (priceHigh2 > priceHigh1 && momentum2 < momentum1 * 0.8) {
    return false; // bearish divergence
  }

  const negMomentum1 = avgClose1 > 0 ? (avgClose1 - priceLow1) / avgClose1 : 0;
  const negMomentum2 = avgClose2 > 0 ? (avgClose2 - priceLow2) / avgClose2 : 0;

  if (priceLow2 < priceLow1 && negMomentum2 < negMomentum1 * 0.8) {
    return true; // bullish divergence
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 1 & 2 — Feature Computation at a Historical Bar
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Computes all 16 ML features at a specific historical bar.
 * Uses data[0..barIdx] (inclusive) for all indicator calculations.
 * Returns an object keyed by feature name matching FEATURES_ORDER.
 */
function computeFeaturesAtBar(data: OHLCV[], barIdx: number): Record<string, number> {
  // Need at least 30 bars for meaningful indicators
  if (barIdx < 30) {
    const empty: Record<string, number> = {};
    for (const key of FEATURES_ORDER) empty[key] = 0.5;
    return empty;
  }

  const slice = data.slice(0, barIdx + 1);
  const closes = slice.map(d => d.close);
  const price = closes[closes.length - 1];
  const eps = 1e-10;

  // ── Compute all base indicators ───────────────────────────────────────────
  const rsiVal = calcRSI(closes);
  const sliceHasVolume = slice.some(d => d.volume > 0);
  const mfiVal = sliceHasVolume ? calcMFI(slice) : 50; // neutral when no volume
  const cciVal = calcCCI(slice);
  const stoch = calcStochastic(slice);
  const macd = calcMACD(closes);
  const adxResult = calcADX(slice);
  const atrVal = calcATR(slice);
  const bb = calcBollingerBands(closes);
  const ma21 = sma(closes, 21);
  const ma100 = sma(closes, 100);
  const ema12 = emaCalc(closes, 12);
  const ema26 = emaCalc(closes, 26);
  const trendResult = calcTrend(closes, 21);
  const sr = simplifiedSR(data, barIdx);

  // ── Layer 1: Raw Scores (s_*) ────────────────────────────────────────────

  // s_rsi — RSI mapped to 0-1
  const s_rsi = rsiVal > 80 ? 0.95
    : rsiVal > 70 ? 0.85
    : rsiVal > 60 ? 0.70
    : rsiVal > 50 ? 0.55
    : rsiVal > 40 ? 0.45
    : rsiVal > 30 ? 0.30
    : rsiVal > 20 ? 0.15
    : 0.05;

  // s_mfi — MFI mapped to 0-1 (same formula as RSI)
  const s_mfi = mfiVal > 80 ? 0.95
    : mfiVal > 70 ? 0.85
    : mfiVal > 60 ? 0.70
    : mfiVal > 50 ? 0.55
    : mfiVal > 40 ? 0.45
    : mfiVal > 30 ? 0.30
    : mfiVal > 20 ? 0.15
    : 0.05;

  // s_cci — CCI mapped to 0-1
  const s_cci = cciVal > 200 ? 0.90
    : cciVal > 100 ? 0.75
    : cciVal > 0 ? 0.60
    : cciVal > -100 ? 0.40
    : cciVal > -200 ? 0.25
    : 0.10;

  // s_adx — Directional bias
  const s_adx = (adxResult.diPlus - adxResult.diMinus + 100) / 200;

  // s_macd — MACD histogram + signal combined
  const absMacdLine = Math.abs(macd.line) + 1;
  const s_macd = macd.line > macd.signal
    ? 0.5 + Math.min(0.5, macd.histogram / absMacdLine)
    : 0.5 - Math.min(0.5, Math.abs(macd.histogram) / absMacdLine);

  // s_stoch — Stochastic %K mapped to 0-1
  const s_stoch = stoch.k / 100;

  // s_bb — Bollinger Band position
  const bbRange = bb.upper - bb.lower;
  const s_bb = bbRange > eps
    ? clamp((price - bb.lower) / bbRange, 0, 1)
    : 0.5;

  // s_ma21 — Price relative to 21-period SMA
  const s_ma21 = ma21 > eps
    ? clamp(0.5 + (price - ma21) / ma21, 0, 1)
    : 0.5;

  // s_ma100 — Price relative to 100-period SMA
  const s_ma100 = ma100 > eps
    ? clamp(0.5 + (price - ma100) / ma100, 0, 1)
    : 0.5;

  // s_ema — EMA12 vs EMA26 spread
  const s_ema = ema26 > eps
    ? clamp(0.5 + (ema12 - ema26) / ema26 * 5, 0, 1)
    : 0.5;

  // s_atr — Inverse volatility (lower ATR = higher score)
  const s_atr = price > eps ? 1 - Math.min(atrVal / price * 10, 1) : 0.5;

  // s_trend — R² + angle combination
  const s_trend = (trendResult.r2 * 0.7) +
    (Math.max(0, Math.min(1, (trendResult.angle + 45) / 90)) * 0.3);

  // s_sr — Support/Resistance proximity
  const dR1 = (sr.R1 - price) / (price > eps ? price : 1);
  const dS1 = (price - sr.S1) / (price > eps ? price : 1);
  const s_sr = clamp(0.5 - dR1 * 1.5 + dS1 * 1.0, 0, 1);

  // ── Layer 2: Corrections (f_*) ───────────────────────────────────────────

  // f_rsi — RSI with momentum correction
  const rsiCurrent = rsiVal;
  const rsi5ago = barIdx >= 5
    ? calcRSI(closes.slice(0, barIdx - 5 + 1))
    : rsiCurrent;
  const f_rsi = clamp(s_rsi + (rsiCurrent - rsi5ago) / 100 * 0.08, 0, 1);

  // f_mfi — MFI with momentum correction (skip when no volume)
  const mfiCurrent = mfiVal;
  const mfi5ago = (barIdx >= 5 && sliceHasVolume)
    ? calcMFI(data.slice(0, barIdx - 5 + 1))
    : mfiCurrent;
  const f_mfi = sliceHasVolume
    ? clamp(s_mfi + (mfiCurrent - mfi5ago) / 100 * 0.08, 0, 1)
    : 0.5; // neutral when no volume

  // f_cci — CCI with momentum correction (scale: /200 instead of /100)
  const cciCurrent = cciVal;
  const cci5ago = barIdx >= 5
    ? calcCCI(data.slice(0, barIdx - 5 + 1))
    : cciCurrent;
  const f_cci = clamp(s_cci + (cciCurrent - cci5ago) / 200 * 0.08, 0, 1);

  // f_macd — Same as s_macd (no additional correction)
  const f_macd = s_macd;

  // f_stoch — Same as s_stoch
  const f_stoch = s_stoch;

  // f_stochCross — Stochastic K/D crossover detection
  let f_stochCross = 0.1;
  if (barIdx >= 1) {
    const prevSlice = data.slice(0, barIdx);
    const prevStoch = calcStochastic(prevSlice);
    if (prevStoch.k < prevStoch.d && stoch.k > stoch.d) {
      f_stochCross = 0.9; // K crossed above D (bullish)
    }
  }

  // f_macdCross — MACD/Signal crossover detection
  let f_macdCross = 0.1;
  if (barIdx >= 1) {
    const prevCloses = closes.slice(0, -1);
    if (prevCloses.length >= 35) {
      const prevMacd = calcMACD(prevCloses);
      if (prevMacd.line <= prevMacd.signal && macd.line > macd.signal) {
        f_macdCross = 0.9; // MACD crossed above signal (bullish)
      }
    }
  }

  // f_div — Divergence detection (bullish div = 0.85, else 0.15)
  const divResult = detectDivergenceSimple(data, barIdx);
  const f_div = divResult === true ? 0.85 : 0.15;

  // ── Assemble feature vector matching FEATURES_ORDER ──────────────────────
  return {
    rsi: f_rsi,
    mfi: f_mfi,
    cci: f_cci,
    adx: s_adx,
    macd: f_macd,
    stoch: f_stoch,
    bb: s_bb,
    ma21: s_ma21,
    ma100: s_ma100,
    ema: s_ema,
    atr: s_atr,
    trend: s_trend,
    sr: s_sr,
    stochCross: f_stochCross,
    macdCross: f_macdCross,
    div: f_div,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRAINING DATA CREATION (Layer 0 — Data Preparation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates supervised training data from historical OHLCV data.
 * For each bar, computes features and labels based on future price movement.
 * Label = 1 if price rises >1% within `horizon` bars, else 0.
 * Samples every `sampleStep` bars to reduce computation.
 */
function createTrainingData(
  data: OHLCV[],
  horizon: number = 5,
  sampleStep: number = 5
): { X: number[][]; y: number[] } {
  const X: number[][] = [];
  const y: number[] = [];

  // Start from horizon+30 to ensure enough data for indicators
  // End at data.length - horizon - 1 to have future bars for labeling
  // Sample every sampleStep bars for performance
  for (let i = horizon + 30; i < data.length - horizon - 1; i += sampleStep) {
    const features = computeFeaturesAtBar(data, i);

    // Convert to array following FEATURES_ORDER
    const featureVec: number[] = [];
    let valid = true;
    for (const key of FEATURES_ORDER) {
      const val = features[key];
      if (val === undefined || val === null || Number.isNaN(val)) {
        valid = false;
        break;
      }
      featureVec.push(val);
    }
    if (!valid) continue;

    // Label: 1 if future close > 1% above current close
    const currentClose = data[i].close;
    const futureClose = data[i + horizon].close;
    const label = futureClose > currentClose * 1.01 ? 1 : 0;

    X.push(featureVec);
    y.push(label);
  }

  return { X, y };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VDss GRAPH STRUCTURE (Layer 5 — State Machine)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * VDss Graph: Each node represents a market state.
 * Edges represent transitions with types: 'up', 'down', 'pullback', 'risk', 'terminal'.
 * Terminal nodes map to scenario results (R1=strong bullish, R5=deep correction).
 */
const VDSS_GRAPH = {
  // outgoing edges from each node: [target, type]
  // v11: 9 scenario terminals — R1(most bullish) to R9(most bearish)
  outgoing: {
    A: [['B', 'up'], ['G', 'pullback'], ['L', 'risk']] as [string, string][],
    B: [['C', 'up'], ['G', 'pullback'], ['A', 'risk'], ['R3', 'terminal']] as [string, string][],
    C: [['D', 'up'], ['G', 'pullback'], ['L', 'risk']] as [string, string][],
    D: [['E', 'up'], ['B', 'pullback'], ['G', 'pullback'], ['L', 'risk'], ['R3', 'terminal']] as [string, string][],
    E: [['F', 'up'], ['D', 'pullback'], ['G', 'pullback'], ['H', 'down'], ['R2', 'terminal']] as [string, string][],
    F: [['R1', 'terminal'], ['E', 'pullback'], ['D', 'down'], ['G', 'risk']] as [string, string][],
    G: [['B', 'up'], ['A', 'pullback'], ['H', 'down'], ['L', 'risk'], ['R4', 'terminal']] as [string, string][],
    H: [['G', 'pullback'], ['I', 'down'], ['B', 'up'], ['L', 'risk'], ['R5', 'terminal']] as [string, string][],
    I: [['H', 'pullback'], ['J', 'down'], ['G', 'up'], ['L', 'risk'], ['R6', 'terminal']] as [string, string][],
    J: [['I', 'pullback'], ['K', 'down'], ['H', 'up'], ['L', 'risk'], ['R7', 'terminal']] as [string, string][],
    K: [['J', 'pullback'], ['I', 'up'], ['L', 'risk'], ['R8', 'terminal'], ['R9', 'terminal']] as [string, string][],
    L: [['C', 'up'], ['H', 'pullback'], ['J', 'down'], ['K', 'risk'], ['R9', 'terminal']] as [string, string][],
  },
  // which result scenario each terminal node maps to
  terminalMap: { R1: 'R1', R2: 'R2', R3: 'R3', R4: 'R4', R5: 'R5', R6: 'R6', R7: 'R7', R8: 'R8', R9: 'R9' } as Record<string, string>,
  startNode: 'A' as string,
};

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 5 — Edge Weight Calculation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculates transition edge weights for the VDss graph.
 * Uses bull/bear consensus, ADX trend strength, and ML-derived coefficients
 * to determine the relative probability of up/down/pullback/risk transitions.
 */
function calculateEdgeWeights(
  bullConsensus: number,
  adx: number,
  mlModel: AdaptiveWeightModel
): { up: number; down: number; pullback: number; risk: number } {
  // Extract ML coefficient insights if model is trained
  let trend_coef = 1 / 3;
  let momentum_coef = 1 / 3;
  let volatility_coef = 1 / 3;

  if (mlModel.isTrained && mlModel.weights) {
    const coefs = mlModel.getCoefficients();
    // Map feature indices to coefficient categories
    // FEATURES_ORDER: ['rsi','mfi','cci','adx','macd','stoch','bb','ma21','ma100','ema','atr','trend','sr','stochCross','macdCross','div']
    const trendIdx = 11;  // 'trend' in FEATURES_ORDER
    const rsiIdx = 0;     // 'rsi' in FEATURES_ORDER
    const atrIdx = 10;    // 'atr' in FEATURES_ORDER

    const absTrend = Math.abs(coefs[trendIdx] ?? 0);
    const absRsi = Math.abs(coefs[rsiIdx] ?? 0);
    const absAtr = Math.abs(coefs[atrIdx] ?? 0);

    const coefSum = absTrend + absRsi + absAtr;
    if (coefSum > 1e-10) {
      trend_coef = absTrend / coefSum;
      momentum_coef = absRsi / coefSum;
      volatility_coef = absAtr / coefSum;
    }
  }

  // Base weights driven by bull consensus
  const up_base = bullConsensus * 0.7 + 0.15;
  const down_base = (1 - bullConsensus) * 0.7 + 0.15;
  const pullback_base = 0.25;
  const risk_base = 0.12 * (1.2 - adx / 100);

  // Apply ML coefficient adjustments
  const up = clamp(
    up_base * (1 + (momentum_coef - 1 / 3) * 0.3),
    0.05, 0.95
  );
  const down = clamp(
    down_base * (1 + (trend_coef - 1 / 3) * 0.3),
    0.05, 0.95
  );
  const pullback = clamp(
    pullback_base * (1 + (volatility_coef - 1 / 3) * 0.2),
    0.05, 0.50
  );
  const risk = clamp(
    risk_base * (1 - (trend_coef - 1 / 3) * 0.5),
    0.02, 0.30
  );

  return { up, down, pullback, risk };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 6 — Path Probability Calculation (Graph DFS + Calibration)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Performs iterative DFS from the start node through the VDss graph,
 * computing raw path probabilities, then calibrating them against
 * Layer 4 scenario probabilities.
 *
 * Returns:
 * - calibratedPaths: Map<pathString, probability>
 * - calibrationFactors: per-scenario multiplier used
 * - scenarioSums: raw probability sums per scenario before calibration
 */
function calculatePathProbabilities(
  edgeWeights: { up: number; down: number; pullback: number; risk: number },
  scenarioProbs: Record<string, number>
): {
  calibratedPaths: Map<string, number>;
  calibrationFactors: Record<string, number>;
  scenarioSums: Record<string, number>;
} {
  const { outgoing, terminalMap, startNode } = VDSS_GRAPH;
  const MAX_PATHS = 200;

  // Type for DFS stack entries: [currentNode, pathString, pathProbability]
  type StackEntry = [string, string, number];

  // Collect all terminal paths with raw probabilities
  const rawPaths: { path: string; scenario: string; prob: number }[] = [];

  // Iterative DFS
  const stack: StackEntry[] = [[startNode, startNode, 1.0]];

  while (stack.length > 0 && rawPaths.length < MAX_PATHS) {
    const [node, pathStr, pathProb] = stack.pop()!;

    const edges = outgoing[node as keyof typeof outgoing];
    if (!edges) continue;

    // Normalize outgoing edge weights to probabilities for this node
    // Map edge types to their weights
    let totalWeight = 0;
    const edgeWeightsList: number[] = [];
    for (const [, edgeType] of edges) {
      const w = edgeWeights[edgeType as keyof typeof edgeWeights] ?? 0.1;
      edgeWeightsList.push(w);
      totalWeight += w;
    }

    if (totalWeight < 1e-10) continue;

    // Expand edges
    for (let i = 0; i < edges.length; i++) {
      const [target, edgeType] = edges[i];
      const edgeProb = edgeWeightsList[i] / totalWeight;
      const newProb = pathProb * edgeProb;
      const newPath = pathStr + '→' + target;

      if (edgeType === 'terminal') {
        // Reached a terminal node
        const scenario = terminalMap[target] ?? 'R3';
        rawPaths.push({ path: newPath, scenario, prob: newProb });
      } else {
        // Continue DFS
        stack.push([target, newPath, newProb]);
      }
    }
  }

  // Group raw probabilities by scenario
  const rawSums: Record<string, number> = { R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, R6: 0, R7: 0, R8: 0, R9: 0 };
  for (const rp of rawPaths) {
    rawSums[rp.scenario] = (rawSums[rp.scenario] ?? 0) + rp.prob;
  }

  // Compute calibration factors: scenarioProbs[scenario] / rawSum[scenario]
  const calibrationFactors: Record<string, number> = {};
  for (const scenario of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9']) {
    const rawSum = rawSums[scenario] ?? 0;
    const targetProb = (scenarioProbs[scenario] ?? 20) / 100; // convert from percentage
    calibrationFactors[scenario] = rawSum > 1e-10 ? targetProb / rawSum : 1.0;
  }

  // Apply calibration to each path
  const calibratedPaths = new Map<string, number>();
  for (const rp of rawPaths) {
    const factor = calibrationFactors[rp.scenario] ?? 1.0;
    calibratedPaths.set(rp.path, rp.prob * factor);
  }

  return { calibratedPaths, calibrationFactors, scenarioSums: rawSums };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO TARGET BUILDER — ATR-based, S/R levels, max 1 ATR range
// ═══════════════════════════════════════════════════════════════════════════════

function buildBullishTargets(price: number, atr: number, resistances: number[]): Array<{min: number; max: number}> {
  // Filter resistances above price, take up to 4
  const above = resistances.filter(r => r > price);
  // Use price-range-based rounding per spec
  const rnd = (n: number) => roundToNice(n);

  const results: Array<{min: number; max: number}> = [];
  let prevMax = price;

  for (let i = 0; i < 4; i++) {
    const base = above[i] ?? (price + (i + 1) * 0.25 * atr);
    // Ensure base is above previous target and above price
    const safeBase = Math.max(base, prevMax + 1);
    let min = rnd(Math.max(safeBase - 0.25 * atr, prevMax + 1));
    let max = rnd(Math.min(safeBase + 0.5 * atr, min + atr));
    if (max <= min) max = rnd(min + 0.25 * atr);
    if (min <= prevMax) min = rnd(prevMax + 1);
    if (max <= min) max = rnd(min + 0.25 * atr);
    // Enforce max 1 ATR range
    if (max - min > atr) max = rnd(min + atr);
    results.push({min, max});
    prevMax = max;
  }
  return results;
}

function buildBearishTargets(price: number, atr: number, supports: number[]): Array<{min: number; max: number}> {
  // Filter supports below price, take up to 4
  const below = supports.filter(s => s < price);
  const rnd = (n: number) => roundToNice(n);

  const results: Array<{min: number; max: number}> = [];
  let prevMin = price;

  for (let i = 0; i < 4; i++) {
    const base = below[i] ?? (price - (i + 1) * 0.25 * atr);
    const safeBase = Math.min(base, prevMin - 1);
    let max = rnd(Math.min(safeBase + 0.25 * atr, prevMin - 1));
    let min = rnd(Math.max(safeBase - 0.5 * atr, max - atr));
    if (min >= max) min = rnd(max - 0.25 * atr);
    if (max >= prevMin) max = rnd(prevMin - 1);
    if (min >= max) min = rnd(max - 0.25 * atr);
    // Enforce max 1 ATR range
    if (max - min > atr) min = rnd(max - atr);
    results.push({min, max});
    prevMin = min;
  }
  return results;
}

function buildRangeTarget(price: number, atr: number, s1: number | undefined, r1: number | undefined): {min: number; max: number} {
  const rnd = (n: number) => roundToNice(n);
  const lower = s1 != null ? Math.min(s1, price - 0.5 * atr) : price - 0.5 * atr;
  const upper = r1 != null ? Math.max(r1, price + 0.5 * atr) : price + 0.5 * atr;
  return {
    min: rnd(Math.min(lower, price)),
    max: rnd(Math.max(upper, price)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 4 — Scenario Probability Calculation (Adaptive with ML)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculates the 9 VDss scenario probabilities (R1-R9) that sum to 100.
 * Uses bull/bear consensus, key indicator values, S/R levels, and
 * ML-derived adaptive factors for fine-tuning.
 *
 * R1=شوک صعودی, R2=صعودی شتاب‌دار, R3=صعودی قوی, R4=صعودی خفیف,
 * R5=رنج,
 * R6=نزولی خفیف, R7=نزولی قوی, R8=نزولی شتاب‌دار, R9=شوک نزولی

 */
function calculateScenarioProbabilities(
  bullConsensus: number,
  price: number,
  R1: number,
  S1: number,
  MA100: number,
  rsi: number,
  mfi: number,
  stochK: number,
  mlModel: AdaptiveWeightModel
): { R1: number; R2: number; R3: number; R4: number; R5: number; R6: number; R7: number; R8: number; R9: number; factors: { momentum: number; volatility: number; trend: number } } {
  // Distance metrics to key levels (spec uses exp(-3 * ...))
  const distR1 = R1 > 0 ? Math.exp(-3 * Math.abs(price - R1) / R1) : 0;
  const distS1 = S1 > 0 ? Math.exp(-3 * Math.abs(price - S1) / S1) : 0;

  const overboughtRisk = (rsi > 70 || (mfi > 80 && mfi !== 50) || stochK > 80) ? 1 : 0;
  const oversoldBounce = (rsi < 30 || (mfi < 20 && mfi !== 50) || stochK < 20) ? 1 : 0;

  let momentum = 0.7;
  let volatility = 0.5;
  let trend = 0.6;

  if (mlModel.isTrained && mlModel.weights) {
    const coefs = mlModel.getCoefficients();
    momentum = sigmoid(coefs[0] ?? 0);
    volatility = sigmoid(coefs[10] ?? 0);
    trend = sigmoid(coefs[11] ?? 0);
  }

  const belowMA100 = price < MA100 ? 1 : 0;
  const bearish = 1 - bullConsensus;

  // ── Raw probabilities ───────────────────────────────────────────────

  // R1: شوک صعودی — explosive breakout (was old R4)
  const raw_R1 = bullConsensus ** 2 * distR1 * 0.25 * (1 - overboughtRisk * 0.6) + oversoldBounce * 0.2 * momentum;

  // R2: صعودی شتاب‌دار — strong momentum (was old R3)
  const raw_R2 = bullConsensus ** 1.6 * 0.35 * momentum * (1 - overboughtRisk * 0.5);

  // R3: صعودی قوی — solid uptrend (was old R2)
  const raw_R3 = bullConsensus ** 1.3 * 0.5 * trend * (1 - overboughtRisk * 0.4);

  // R4: صعودی خفیف — mild bull, needs confirmation (was old R1)
  const raw_R4 = bullConsensus * 0.4 * trend * (1 - overboughtRisk * 0.3);

  // R5: رنج — neutral
  const raw_R5 = (1 - Math.abs(bullConsensus - 0.5) * 2) * 0.45 * (1 + (1 - volatility) * 0.4);

  // R6: نزولی خفیف — mild bear (was old R6)
  const raw_R6 = bearish * 0.4 * trend * (1 - oversoldBounce * 0.3);

  // R7: نزولی قوی — solid downtrend
  const raw_R7 = bearish ** 1.3 * 0.5 * trend * (1 - oversoldBounce * 0.4);

  // R8: نزولی شتاب‌دار — strong bearish momentum
  const raw_R8 = bearish ** 1.6 * 0.35 * momentum * (1 - oversoldBounce * 0.5);

  // R9: شوک نزولی — crash
  const raw_R9 = bearish ** 2 * distS1 * 0.25 * (1 + belowMA100 * 0.5) + overboughtRisk * 0.15 * momentum;

  // ── Normalize to sum = 100, clamp to [2, 35] per spec ──────────
  const raw = [raw_R1, raw_R2, raw_R3, raw_R4, raw_R5, raw_R6, raw_R7, raw_R8, raw_R9];
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  // First pass: percentage with spec bounds (min 2%, max 35%)
  let clamped = raw.map(r => Math.min(35, Math.max(2, Math.round(r / sum * 100))));
  // Adjust to ensure sum = 100
  const clampedSum = clamped.reduce((a, b) => a + b, 0);
  const diff = 100 - clampedSum;
  if (diff !== 0) {
    // Distribute difference proportionally to values that aren't at bounds
    const adjustable = clamped.map((v, i) => (diff > 0 ? v < 35 : v > 2) ? i : -1).filter(i => i >= 0);
    const adjSum = adjustable.reduce((s, i) => s + clamped[i], 0);
    for (const i of adjustable) {
      clamped[i] = Math.min(35, Math.max(2, Math.round(clamped[i] + diff * (clamped[i] / (adjSum || 1)))));
    }
    // Final adjustment on last element to guarantee sum = 100
    const finalSum = clamped.reduce((a, b) => a + b, 0);
    clamped[8] = Math.min(35, Math.max(2, clamped[8] + (100 - finalSum)));
  }
  const [pR1, pR2, pR3, pR4, pR5, pR6, pR7, pR8, pR9] = clamped;

  return {
    R1: pR1, R2: pR2, R3: pR3, R4: pR4, R5: pR5,
    R6: pR6, R7: pR7, R8: pR8, R9: pR9,
    factors: { momentum, volatility, trend },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════
export function analyze(data: OHLCV[], currencyUnit?: string): TAResult {
  if (!data || data.length < 2) {
    const empty = () => 0;
    const emptyScenario = (): ScenarioResult => ({ name: '', nameEn: '', probability: 20, targetMin: 0, targetMax: 0, description: '' });
    return {
      sma: {}, ema: {}, rsi: 50, mfi: 50, cci: 0, stochK: 50, stochD: 50,
      williamsR: -50, macd: { line: 0, signal: 0, histogram: 0 },
      adx: 0, diPlus: 0, diMinus: 0, sar: 0, atr: 0,
      bollingerBands: { upper: 0, middle: 0, lower: 0 }, obv: 0,
      ichimoku: { tenkan: 0, kijun: 0, senkouA: 0, senkouB: 0, chikou: 0 },
      vwap: 0,
      smaArray: {},
      emaArray: {},
      ichimokuArrays: { tenkan: [], kijun: [], senkouA: [], senkouB: [] },
      vwapArray: [],
      resistances: [], supports: [],
      supportStrengths: [], resistanceStrengths: [], priceTargets: [],
      trend: {
        short: { direction: 'flat', slope: 0, angle: 0, r2: 0 },
        medium: { direction: 'flat', slope: 0, angle: 0, r2: 0 },
        long: { direction: 'flat', slope: 0, angle: 0, r2: 0 },
      },
      scenarios: { R1: emptyScenario(), R2: emptyScenario(), R3: emptyScenario(), R4: emptyScenario(), R5: emptyScenario(), R6: emptyScenario(), R7: emptyScenario(), R8: emptyScenario(), R9: emptyScenario() },
      bullScore: 0.5, bearScore: 0.5, overallSignal: 'neutral',
      bullConsensus: 0.5, isMLTrained: false, mlAccuracy: 0.5, mlWeights: null,
      edgeWeights: { up: 0.3, down: 0.3, pullback: 0.25, risk: 0.15 },
      calibrationFactors: { R1: 1, R2: 1, R3: 1, R4: 1, R5: 1, R6: 1, R7: 1, R8: 1, R9: 1 },
      scenarioSums: { R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, R6: 0, R7: 0, R8: 0, R9: 0 },
      adaptiveFactors: { momentum: 0.7, volatility: 0.5, trend: 0.6 },
      hasVolume: false,
      decisionGraph: null,
      extendedIndicators: {
        wma: {}, hma: 0, tma: 0, lma: 0, maAlignment: 0.5,
        heikenAshi: { open: 0, high: 0, low: 0, close: 0 },
        awesomeOsc: 0, momentum: 0, modifiedRSI: 50, fastStochK: 50,
        fisherTransform: 0, pvo: 0, confidenceIndex: 0.5, strengthIndex: 0.5,
        ad: 0, vpt: 0, vosc: 0, chaikinAD: 0, forceIndex: 0,
        keltnerChannels: { upper: 0, middle: 0, lower: 0 },
        envelopes: { upper: 0, middle: 0, lower: 0 },
        stdDev: 0, hv: 0,
      },
    };
  }

  const closes = data.map(d => d.close);
  const price = closes[closes.length - 1];

  // ── Detect volume availability ──────────────────────────────────────────
  const hasVolume = data.some(d => d.volume > 0);

  // ── Moving Averages ──────────────────────────────────────────────────────
  const smaPeriods = [5, 9, 10, 21, 50, 100, 200];
  const smaResult: Record<string, number> = {};
  for (const p of smaPeriods) smaResult[`sma${p}`] = sma(closes, p);

  const emaPeriods = [9, 12, 21, 26, 50, 100, 200];
  const emaResult: Record<string, number> = {};
  for (const p of emaPeriods) emaResult[`ema${p}`] = emaCalc(closes, p);

  // ── Extended Moving Averages ──────────────────────────────────────────────
  const wmaResult: Record<string, number> = {};
  for (const p of [10, 20]) wmaResult[`wma${p}`] = calcWMA(closes, p);

  // ── Oscillators ──────────────────────────────────────────────────────────
  const rsi = calcRSI(closes);
  // MFI requires volume — return neutral 50 when no volume data
  const mfi = hasVolume ? calcMFI(data) : 50;
  const cci = calcCCI(data);
  const stoch = calcStochastic(data);
  const williamsR = calcWilliamsR(data);
  const macd = calcMACD(closes);

  // ── Trend ────────────────────────────────────────────────────────────────
  const adxResult = calcADX(data);
  const sar = calcSAR(data);

  // ── Volatility ───────────────────────────────────────────────────────────
  const atr = calcATR(data);
  const bb = calcBollingerBands(closes);

  // ── Volume ───────────────────────────────────────────────────────────────
  // OBV requires volume — return 0 when no volume data
  const obv = hasVolume ? calcOBV(data) : 0;

  // ── Ichimoku Cloud ────────────────────────────────────────────────────
  const ichimoku = calcIchimoku(data);
  const ichimokuArrays = calcIchimokuArrays(data);

  // ── VWAP ─────────────────────────────────────────────────────────────
  const vwap = hasVolume ? calcVWAP(data) : 0;
  const vwapArr = hasVolume ? calcVWAPArray(data) : data.map(() => 0);

  // ── MA Arrays for chart overlays ──────────────────────────────────────
  const smaArrResult: Record<string, number[]> = {};
  for (const p of smaPeriods) smaArrResult[`sma${p}`] = smaArray(closes, p);

  const emaArrResult: Record<string, number[]> = {};
  for (const p of emaPeriods) emaArrResult[`ema${p}`] = emaArrayCalc(closes, p);

  // ── Support / Resistance ────────────────────────────────────────────────
  const { resistances, supports, supportStrengths, resistanceStrengths, priceTargets } = calcSupportResistance(data, price);

  // ── Trend Lines ─────────────────────────────────────────────────────────
  const trend = {
    short: calcTrend(closes, 21),
    medium: calcTrend(closes, 50),
    long: calcTrend(closes, Math.min(100, closes.length)),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VDss 7-LAYER PROBABILITY ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  const R1_level = resistances[0] ?? price * 1.05;
  const R2_level = resistances[1] ?? price * 1.10;
  const R3_level = resistances[2] ?? price * 1.15;
  const R4_level = resistances[3] ?? price * 1.20;
  const R5_level = resistances[4] ?? price * 1.30;
  const R6_level = resistances[5] ?? price * 1.40;
  const S1_level = supports[0] ?? price * 0.95;
  const S2_level = supports[1] ?? price * 0.90;
  const S3_level = supports[2] ?? price * 0.85;
  const S4_level = supports[3] ?? price * 0.80;
  const S5_level = supports[4] ?? price * 0.75;
  const S6_level = supports[5] ?? price * 0.70;

  // ── Layer 1+2: Compute features at current bar ───────────────────────────
  const currentFeatures = computeFeaturesAtBar(data, data.length - 1);
  const featureArray = FEATURES_ORDER.map(k => currentFeatures[k] ?? 0.5);

  // ── Layer 3: ML Training & Bull Consensus ─────────────────────────────────
  const mlModel = new AdaptiveWeightModel(70, 10);
  const { X: trainX, y: trainY } = createTrainingData(data);
  const trained = mlModel.train(trainX, trainY);

  let bullConsensus: number;
  const fallbackWeights: Record<string, number> = {
    rsi: 0.15, mfi: 0.12, cci: 0.10, adx: 0.08,
    macd: 0.14, stoch: 0.10, bb: 0.08,
    ma21: 0.10, ma100: 0.08, ema: 0.10,
    atr: 0.05, trend: 0.10, sr: 0.05,
    stochCross: 0.06, macdCross: 0.06, div: 0.08,
  };

  if (trained && mlModel.isTrained && mlModel.weights) {
    // Use ML-derived weights
    const weights = mlModel.weights;
    let weightedSum = 0;
    for (let i = 0; i < NUM_FEATURES; i++) {
      weightedSum += weights[i] * featureArray[i];
    }
    bullConsensus = weightedSum;

    // Blend with ML direct prediction (weight based on accuracy)
    const mlScore = mlModel.predictScore(featureArray);
    if (mlScore !== null) {
      const mlWeight = clamp(mlModel.recentAccuracy * 0.30, 0, 0.30);
      bullConsensus = bullConsensus * (1 - mlWeight) + mlScore * mlWeight;
    }
  } else {
    // Fallback: fixed weights
    const wTotal = Object.values(fallbackWeights).reduce((a, b) => a + b, 0);
    let sum = 0;
    for (const key of FEATURES_ORDER) {
      sum += (fallbackWeights[key] ?? 0) * (currentFeatures[key] ?? 0.5);
    }
    bullConsensus = sum / wTotal;
  }
  bullConsensus = clamp(bullConsensus, 0, 1);

  const bullScore = bullConsensus;
  const bearScore = 1 - bullConsensus;

  // ── Layer 4-6: Decision Graph Probability Engine (replaces old heuristic + old 12-node graph) ─
  const ma100Val = smaResult.sma100 ?? price;
  const R1_nearest = resistances[0] ?? price * 1.05;
  const S1_nearest = supports[0] ?? price * 0.95;
  const srAvgStr = resistanceStrengths.length > 0 || supportStrengths.length > 0
    ? [...resistanceStrengths, ...supportStrengths].reduce((s, l) => s + l.score, 0) / ([...resistanceStrengths, ...supportStrengths].length || 1) / 10
    : 0.3;

  // Extract ML adaptive factors directly from ML model
  let mlMomentumFactor = 0.7;
  let mlVolatilityFactor = 0.5;
  let mlTrendFactor = 0.6;
  if (mlModel.isTrained && mlModel.weights) {
    const coefs = mlModel.getCoefficients();
    mlMomentumFactor = sigmoid(coefs[0] ?? 0);
    mlVolatilityFactor = sigmoid(coefs[10] ?? 0);
    mlTrendFactor = sigmoid(coefs[11] ?? 0);
  }

  const graphData = buildDecisionGraph({
    price,
    bullConsensus,
    rsi,
    mfi,
    cci,
    stochK: stoch.k,
    stochD: stoch.d,
    adx: adxResult.adx,
    diPlus: adxResult.diPlus,
    diMinus: adxResult.diMinus,
    macdHist: macd.histogram,
    atr,
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    sar,
    ichimokuTenkan: ichimoku.tenkan,
    ichimokuKijun: ichimoku.kijun,
    ichimokuSenkouA: ichimoku.senkouA,
    ichimokuSenkouB: ichimoku.senkouB,
    maAlignment: calcMARibbonAlignment(closes),
    momentum: calcMomentum(closes, 10),
    awesomeOsc: calcAwesomeOscillator(data),
    fisherTransform: calcFisherTransform(data, 9),
    confidenceIndex: calcConfidenceIndex(rsi, mfi, macd.line, macd.signal, adxResult.adx, stoch.k, trend.short.r2),
    strengthIndex: calcStrengthIndex(rsi, macd.histogram, adxResult.adx, atr, price, emaResult.ema12, emaResult.ema26),
    hasVolume,
    distToR1: R1_nearest > 0 ? (R1_nearest - price) / price : 0.05,
    distToS1: price > 0 && S1_nearest > 0 ? (price - S1_nearest) / price : 0.05,
    srAvgStrength: clamp(srAvgStr, 0, 1),
    mlMomentum: mlMomentumFactor,
    mlVolatility: mlVolatilityFactor,
    mlTrend: mlTrendFactor,
  });

  // Use decision graph scenario probabilities (sum to 100)
  const pR1 = graphData.scenarioProbabilities.R1 ?? 11;
  const pR2 = graphData.scenarioProbabilities.R2 ?? 11;
  const pR3 = graphData.scenarioProbabilities.R3 ?? 11;
  const pR4 = graphData.scenarioProbabilities.R4 ?? 11;
  const pR5 = graphData.scenarioProbabilities.R5 ?? 11;
  const pR6 = graphData.scenarioProbabilities.R6 ?? 11;
  const pR7 = graphData.scenarioProbabilities.R7 ?? 11;
  const pR8 = graphData.scenarioProbabilities.R8 ?? 11;
  const pR9 = graphData.scenarioProbabilities.R9 ?? 11;

  // Keep edge weights for backward compat (derive from graph)
  const edgeWeights = {
    up: graphData.branchProbabilities.trend * bullConsensus + 0.1,
    down: graphData.branchProbabilities.trend * (1 - bullConsensus) + 0.1,
    pullback: 0.25,
    risk: 0.15 * (1.2 - adxResult.adx / 100),
  };

  // Layer 7: Adaptive model update
  if (data.length > 6) {
    const futureReturn = (price - data[data.length - 6].close) / data[data.length - 6].close;
    const label = futureReturn > 0.01 ? 1 : 0;
    mlModel.update(featureArray, label);
  }

  // ── Overall Signal ──────────────────────────────────────────────────────
  const overallSignal: 'bullish' | 'bearish' | 'neutral' =
    bullConsensus > 0.58 ? 'bullish' : bullConsensus < 0.42 ? 'bearish' : 'neutral';

  // ── Scenario Descriptions with ATR-based S/R targets ────────────────────
  const fmt = (n: number) => Math.round(n).toLocaleString('fa-IR');
  const rp = (n: number) => Math.round(n); // round price
  const unit = currencyUnit || 'ریال';

  // Helper: build a target range ≤ 1 ATR around a base level, ensuring ordering
  const bullTargets = buildBullishTargets(price, atr, resistances);
  const bearTargets = buildBearishTargets(price, atr, supports);
  const rangeTarget = buildRangeTarget(price, atr, supports[0], resistances[0]);

  const scenarios = {
    R1: {
      name: 'شوک نزولی',
      nameEn: 'Bearish Shock',
      probability: pR1,
      targetMin: bearTargets[3].min,
      targetMax: bearTargets[3].max,
      description: `شوک نزولی با هدف ${fmt(bearTargets[3].min)} تا ${fmt(bearTargets[3].max)} ${unit}.`,
    },
    R2: {
      name: 'نزولی شتاب‌دار',
      nameEn: 'Accelerating Bearish',
      probability: pR2,
      targetMin: bearTargets[2].min,
      targetMax: bearTargets[2].max,
      description: `شتاب نزولی با هدف ${fmt(bearTargets[2].min)} تا ${fmt(bearTargets[2].max)} ${unit}.`,
    },
    R3: {
      name: 'نزولی قوی',
      nameEn: 'Strong Bearish',
      probability: pR3,
      targetMin: bearTargets[1].min,
      targetMax: bearTargets[1].max,
      description: `نزول قوی تا ${fmt(bearTargets[1].min)} تا ${fmt(bearTargets[1].max)} ${unit}.`,
    },
    R4: {
      name: 'نزولی خفیف',
      nameEn: 'Weak Bearish',
      probability: pR4,
      targetMin: bearTargets[0].min,
      targetMax: bearTargets[0].max,
      description: `نزول خفیف تا ${fmt(bearTargets[0].min)} تا ${fmt(bearTargets[0].max)} ${unit}.`,
    },
    R5: {
      name: 'رنج',
      nameEn: 'Range-bound',
      probability: pR5,
      targetMin: rangeTarget.min,
      targetMax: rangeTarget.max,
      description: `نوسان کم در محدوده ${fmt(rangeTarget.min)} تا ${fmt(rangeTarget.max)} ${unit}.`,
    },
    R6: {
      name: 'صعودی خفیف',
      nameEn: 'Weak Bullish',
      probability: pR6,
      targetMin: bullTargets[0].min,
      targetMax: bullTargets[0].max,
      description: `حرکت صعودی خفیف با شکست مقاومت اول تا محدوده ${fmt(bullTargets[0].min)} تا ${fmt(bullTargets[0].max)} ${unit}.`,
    },
    R7: {
      name: 'صعودی قوی',
      nameEn: 'Strong Bullish',
      probability: pR7,
      targetMin: bullTargets[1].min,
      targetMax: bullTargets[1].max,
      description: `صعود قوی با عبور از مقاومت‌ها تا هدف ${fmt(bullTargets[1].min)} تا ${fmt(bullTargets[1].max)} ${unit}.`,
    },
    R8: {
      name: 'صعودی شتاب‌دار',
      nameEn: 'Accelerating Bullish',
      probability: pR8,
      targetMin: bullTargets[2].min,
      targetMax: bullTargets[2].max,
      description: `شتاب صعودی با هدف ${fmt(bullTargets[2].min)} تا ${fmt(bullTargets[2].max)} ${unit}.`,
    },
    R9: {
      name: 'شوک صعودی',
      nameEn: 'Bullish Shock',
      probability: pR9,
      targetMin: bullTargets[3].min,
      targetMax: bullTargets[3].max,
      description: `شوک صعودی با هدف ${fmt(bullTargets[3].min)} تا ${fmt(bullTargets[3].max)} ${unit}.`,
    },
  };

  return {
    sma: smaResult,
    ema: emaResult,
    rsi,
    mfi,
    cci,
    stochK: stoch.k,
    stochD: stoch.d,
    williamsR,
    macd,
    adx: adxResult.adx,
    diPlus: adxResult.diPlus,
    diMinus: adxResult.diMinus,
    sar,
    atr,
    bollingerBands: bb,
    obv,
    ichimoku,
    vwap,
    smaArray: smaArrResult,
    emaArray: emaArrResult,
    ichimokuArrays,
    vwapArray: vwapArr,
    resistances: resistances.length ? resistances : [R1_level, R2_level, R3_level, R4_level, R5_level, R6_level],
    supports: supports.length ? supports : [S1_level, S2_level, S3_level, S4_level, S5_level, S6_level],
    supportStrengths,
    resistanceStrengths,
    priceTargets,
    trend,
    scenarios,
    bullScore,
    bearScore,
    overallSignal,
    // ── VDss ML Metadata ──
    bullConsensus,
    isMLTrained: mlModel.isTrained,
    mlAccuracy: mlModel.recentAccuracy,
    mlWeights: mlModel.weights,
    edgeWeights,
    calibrationFactors: {} as Record<string, number>,
    scenarioSums: graphData.scenarioProbabilities,
    adaptiveFactors: { momentum: mlMomentumFactor, volatility: mlVolatilityFactor, trend: mlTrendFactor },
    hasVolume,
    // Decision Graph (primary probability source)
    decisionGraph: graphData,
    // ── Extended Indicators (24 additional) ──
    extendedIndicators: {
      // Trend
      wma: wmaResult,
      hma: calcHMA(closes, 20),
      tma: calcTMA(closes, 20),
      lma: calcLMA(closes, 20),
      maAlignment: calcMARibbonAlignment(closes),
      heikenAshi: calcHeikenAshi(data),
      // Oscillators
      awesomeOsc: calcAwesomeOscillator(data),
      momentum: calcMomentum(closes, 10),
      modifiedRSI: calcRSI(closes, 21),
      fastStochK: calcFastStochastic(data, 14, 3),
      fisherTransform: calcFisherTransform(data, 9),
      pvo: hasVolume ? calcPVO(data, 12, 26) : 0,
      confidenceIndex: calcConfidenceIndex(rsi, mfi, macd.line, macd.signal, adxResult.adx, stoch.k, trend.short.r2),
      strengthIndex: calcStrengthIndex(rsi, macd.histogram, adxResult.adx, atr, price, emaResult.ema12, emaResult.ema26),
      // Volume (zero when no volume)
      ad: hasVolume ? calcAccumDist(data) : 0,
      vpt: hasVolume ? calcVPT(data) : 0,
      vosc: hasVolume ? calcVOSC(data, 5, 10) : 0,
      chaikinAD: hasVolume ? calcChaikinAD(data) : 0,
      forceIndex: hasVolume ? calcForceIndex(data, 13) : 0,
      // Volatility
      keltnerChannels: calcKeltnerChannels(data, 20, 2),
      envelopes: calcEnvelopes(closes, 20, 2.5),
      stdDev: calcStdDev(closes, 20),
      hv: calcHV(closes, 20),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 30-Day Historical Probability Computation
// ═══════════════════════════════════════════════════════════════════════════════
// Computes daily probabilities for the past 30 days by running the decision
// graph model with day-specific indicators (no look-ahead bias).
// Per CumProbTrend.txt §5: each day t uses only data up to end of day t.
// ═══════════════════════════════════════════════════════════════════════════════

export interface DailyProbSnapshot {
  date: string;
  dayIndex: number; // 0=today, -1=yesterday, ...
  probs: Record<string, number>; // R1-R9, sum=100
}

export function computeHistoricalProbabilities(
  data: OHLCV[],
  maxDays: number = 30,
): DailyProbSnapshot[] {
  if (!data || data.length < 30) return [];

  const result: DailyProbSnapshot[] = [];
  const today = data.length - 1;
  const startDate = Math.max(30, today - maxDays + 1);

  // Pre-compute indicators that have array variants for efficiency
  for (let di = today; di >= startDate; di--) {
    const slice = data.slice(0, di + 1);
    if (slice.length < 30) continue;

    const price = slice[slice.length - 1].close;
    const closes = slice.map(d => d.close);
    const hasVolume = slice.some(d => d.volume > 0);

    // Key indicators for the decision graph
    const rsi = calcRSI(closes, 14);
    const mfi = hasVolume ? calcMFI(slice, 14) : 50;
    const cci = calcCCI(slice, 20);
    const stoch = calcStochastic(slice, 14, 3, 3);
    const adxResult = calcADX(slice, 14);
    const macd = calcMACD(closes);
    const atrVal = calcATR(slice, 14);
    const sarVal = calcSAR(slice);
    const bb = calcBollingerBands(closes, 20, 2);
    const ichimoku = calcIchimoku(slice);
    const momentum = calcMomentum(closes, 10);
    const awesomeOsc = calcAwesomeOscillator(slice);
    const fisher = calcFisherTransform(slice, 9);
    const maAlign = calcMARibbonAlignment(closes);
    const confidence = calcConfidenceIndex(rsi, mfi, macd.line, macd.signal, adxResult.adx, stoch.k, { r2: 0.5 } as any);
    const strength = calcStrengthIndex(rsi, macd.histogram, adxResult.adx, atrVal, price, calcEMA(closes, 12), calcEMA(closes, 26));

    // Simple bull consensus
    const bullConsensus = clamp((rsi - 50) / 50 * 0.3 + (macd.histogram > 0 ? 0.15 : -0.15) + (adxResult.diPlus > adxResult.diMinus ? 0.15 : -0.15) + 0.5, 0, 1);

    // Simple S/R distance proxy
    const distToR1 = 0.05;
    const distToS1 = 0.05;

    try {
      const graphData = buildDecisionGraph({
        price,
        bullConsensus,
        rsi, mfi, cci,
        stochK: stoch.k, stochD: stoch.d,
        adx: adxResult.adx,
        diPlus: adxResult.diPlus, diMinus: adxResult.diMinus,
        macdHist: macd.histogram,
        atr: atrVal,
        bbUpper: bb.upper, bbMiddle: bb.middle, bbLower: bb.lower,
        sar: sarVal,
        ichimokuTenkan: ichimoku.tenkan, ichimokuKijun: ichimoku.kijun,
        ichimokuSenkouA: ichimoku.senkouA, ichimokuSenkouB: ichimoku.senkouB,
        maAlignment: maAlign,
        momentum, awesomeOsc, fisherTransform: fisher,
        confidenceIndex: confidence, strengthIndex: strength,
        hasVolume,
        distToR1, distToS1,
        srAvgStrength: 0.5,
        mlMomentum: 0.5, mlVolatility: 0.5, mlTrend: 0.5,
      });

      result.push({
        date: slice[slice.length - 1].date,
        dayIndex: -(today - di),
        probs: { ...graphData.scenarioProbabilities },
      });
    } catch {
      // Skip days where computation fails
    }
  }

  return result;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
