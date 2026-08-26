// ═══════════════════════════════════════════════════════════════════════════════
// ML Engine V2 — Adaptive VDss Weight System (No Fixed Weights)
// Uses Logistic Regression with TimeSeriesSplit validation
// 16 features → binary classification (bullish/bearish 5-day forward)
// ═══════════════════════════════════════════════════════════════════════════════

import type { OHLCV } from './ta-engine';
import { AdaptiveWeightModel, VDSS_FEATURE_NAMES, type AdaptiveModelResult } from './ml-logistic';

// ─── Re-export types for ta-engine ──────────────────────────────────────────

export type { AdaptiveModelResult };
export { VDSS_FEATURE_NAMES };

// ─── Indicator Helpers (same algorithms as ta-engine, for historical extraction)

function sma(closes: number[], period: number): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function emaCalc(closes: number[], period: number): number {
  if (closes.length < period) return 0;
  const k = 2 / (period + 1);
  let v = sma(closes.slice(0, period), period);
  for (let i = period; i < closes.length; i++) {
    v = closes[i] * k + v * (1 - k);
  }
  return v;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcCCI(data: OHLCV[], period = 20): number {
  if (data.length < period) return 0;
  const tps: number[] = [];
  for (let i = data.length - period; i < data.length; i++) {
    tps.push((data[i].high + data[i].low + data[i].close) / 3);
  }
  const mean = tps.reduce((a, b) => a + b, 0) / tps.length;
  const meanDev = tps.reduce((a, b) => a + Math.abs(b - mean), 0) / tps.length;
  return meanDev === 0 ? 0 : (tps[tps.length - 1] - mean) / (0.015 * meanDev);
}

function calcMFI(data: OHLCV[], period = 14): number {
  if (data.length < period + 1) return 50;
  let posFlow = 0, negFlow = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const tp = (data[i].high + data[i].low + data[i].close) / 3;
    const prevTp = (data[i - 1].high + data[i - 1].low + data[i - 1].close) / 3;
    const mf = tp * data[i].volume;
    if (tp > prevTp) posFlow += mf; else negFlow += mf;
  }
  return negFlow === 0 ? 100 : 100 - 100 / (1 + posFlow / negFlow);
}

function calcStochastic(data: OHLCV[], kPeriod = 14, smoothK = 3, smoothD = 3): { k: number; d: number } {
  const rawKs: number[] = [];
  for (let i = kPeriod - 1; i < data.length; i++) {
    let lowest = Infinity, highest = -Infinity;
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
  const d = dSlice.length > 0 ? dSlice.reduce((a, b) => a + b, 0) / dSlice.length : 50;
  return { k, d };
}

function calcMACD(closes: number[], fast = 12, slow = 26, sig = 9): { line: number; signal: number; histogram: number } {
  if (closes.length < slow + sig) return { line: 0, signal: 0, histogram: 0 };
  const kFast = 2 / (fast + 1), kSlow = 2 / (slow + 1), kSig = 2 / (sig + 1);
  let eFast = sma(closes.slice(0, fast), fast);
  let eSlow = sma(closes.slice(0, slow), slow);
  const macdVals: number[] = [];
  for (let i = Math.max(fast, slow); i < closes.length; i++) {
    eFast = closes[i] * kFast + eFast * (1 - kFast);
    eSlow = closes[i] * kSlow + eSlow * (1 - kSlow);
    macdVals.push(eFast - eSlow);
  }
  if (macdVals.length < sig) return { line: 0, signal: 0, histogram: 0 };
  let s = sma(macdVals.slice(0, sig), sig);
  for (let i = sig; i < macdVals.length; i++) {
    s = macdVals[i] * kSig + s * (1 - kSig);
  }
  const line = macdVals[macdVals.length - 1];
  return { line, signal: s, histogram: line - s };
}

function calcBollingerBands(closes: number[], period = 20, mult = 2): { upper: number; middle: number; lower: number } {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0 };
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { upper: mid + mult * sd, middle: mid, lower: mid - mult * sd };
}

function calcADX(data: OHLCV[], period = 14): { adx: number; diPlus: number; diMinus: number } {
  if (data.length < period * 2) return { adx: 0, diPlus: 0, diMinus: 0 };
  let sumPDM = 0, sumMDM = 0, sumTR = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const upMove = data[i].high - data[i - 1].high;
    const downMove = data[i - 1].low - data[i].low;
    sumPDM += upMove > downMove && upMove > 0 ? upMove : 0;
    sumMDM += downMove > upMove && downMove > 0 ? downMove : 0;
    sumTR += Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    );
  }
  const diPlus = sumTR > 0 ? (sumPDM / sumTR) * 100 : 0;
  const diMinus = sumTR > 0 ? (sumMDM / sumTR) * 100 : 0;
  const dx = (diPlus + diMinus) > 0 ? Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100 : 0;
  return { adx: dx, diPlus, diMinus };
}

function calcATR(data: OHLCV[], period = 14): number {
  if (data.length < period + 1) return 0;
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    sum += Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    );
  }
  return sum / period;
}

function calcSAR(data: OHLCV[]): number {
  if (data.length < 5) return 0;
  // Simplified Parabolic SAR
  return data[data.length - 1].low; // placeholder
}

// ─── 16-Feature Extraction for VDss ─────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Extract the 16 VDSS features at a given point in the data.
 * Feature order must match VDSS_FEATURE_NAMES exactly.
 *
 * @param data - Full OHLCV history (chronological)
 * @param endIdx - Index of the candle to compute features for
 * @param hasVolume - Whether data has valid volume
 * @returns Array of 16 feature values in [0,1] range
 */
export function extractVDSSFeatures(data: OHLCV[], endIdx: number, hasVolume: boolean): number[] {
  const slice = data.slice(0, endIdx + 1);
  const closes = slice.map(d => d.close);
  const price = closes[closes.length - 1];
  if (price <= 0) return new Array(16).fill(0.5);

  // ── Compute indicators ──
  const rsi = calcRSI(closes);
  const mfi = hasVolume ? calcMFI(slice) : 50;
  const cci = calcCCI(slice);
  const adxResult = calcADX(slice);
  const macd = calcMACD(closes);
  const stoch = calcStochastic(slice);
  const bb = calcBollingerBands(closes);
  const atr = calcATR(slice);
  const ma21 = sma(closes, 21);
  const ma100 = sma(closes, 100);
  const ema12 = emaCalc(closes, 12);
  const ema26 = emaCalc(closes, 26);

  // ── LAYER 1: Raw scores (s_*) ──
  const s_rsi = rsi > 80 ? 0.95 : rsi > 70 ? 0.85 : rsi > 60 ? 0.7 : rsi > 50 ? 0.55
    : rsi > 40 ? 0.45 : rsi > 30 ? 0.3 : rsi > 20 ? 0.15 : 0.05;
  const s_mfi = mfi > 80 ? 0.95 : mfi > 70 ? 0.85 : mfi > 60 ? 0.7 : mfi > 50 ? 0.55
    : mfi > 40 ? 0.45 : mfi > 30 ? 0.3 : mfi > 20 ? 0.15 : 0.05;
  const s_cci = cci > 200 ? 0.9 : cci > 100 ? 0.75 : cci > 0 ? 0.6
    : cci > -100 ? 0.4 : cci > -200 ? 0.25 : 0.1;
  const s_adx = adxResult.diPlus > adxResult.diMinus
    ? clamp(0.5 + (adxResult.diPlus - adxResult.diMinus) / 100, 0.5, 1)
    : clamp(0.5 - (adxResult.diMinus - adxResult.diPlus) / 100, 0, 0.5);
  const s_macd = macd.histogram > 0 && macd.line > macd.signal ? 0.9
    : macd.histogram > 0 ? 0.7 : macd.line > macd.signal ? 0.55
    : macd.histogram < 0 && macd.line < macd.signal ? 0.1 : 0.3;
  const s_stoch = clamp(
    (stoch.k > 80 ? 0.9 : stoch.k > 70 ? 0.8 : stoch.k > 50 ? 0.6
      : stoch.k > 30 ? 0.4 : stoch.k > 20 ? 0.2 : 0.1)
    + (stoch.k > stoch.d ? 0.1 : -0.1), 0, 1);
  const bbRange = bb.upper - bb.lower;
  const s_bb = bbRange === 0 ? 0.5 : clamp((price - bb.lower) / bbRange, 0, 1);
  const s_ma21 = clamp(price > ma21 ? 0.7 + ((price - ma21) / ma21) * 0.5 : 0.3 + ((price - ma21) / ma21) * 0.5, 0, 1);
  const s_ma100 = clamp(price > ma100 ? 0.65 + ((price - ma100) / ma100) * 0.3 : 0.35 + ((price - ma100) / ma100) * 0.3, 0, 1);
  const emaGap = ema12 > 0 && ema26 > 0 ? (ema12 - ema26) / ema26 : 0;
  const s_ema = clamp(0.5 + emaGap * 5, 0, 1);
  const s_atr = clamp(1 - atr / price * 10, 0.2, 1);

  // Trend (R² + angle)
  const trendPeriod = Math.min(21, closes.length);
  const trendSlice = closes.slice(-trendPeriod);
  const n = trendSlice.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) { sumX += i; sumY += trendSlice[i]; sumXY += i * trendSlice[i]; sumX2 += i * i; sumY2 += trendSlice[i] ** 2; }
  const denom = n * sumX2 - sumX * sumX;
  let r2 = 0, angle = 0;
  if (denom !== 0) {
    const slope = (n * sumXY - sumX * sumY) / denom;
    const meanY = sumY / n;
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
      ssRes += (trendSlice[i] - (slope * i + meanY - slope * (n - 1) / 2)) ** 2;
      ssTot += (trendSlice[i] - meanY) ** 2;
    }
    r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    angle = meanY > 0 ? Math.atan(slope / meanY) * (180 / Math.PI) : 0;
  }
  const tStr = r2 * Math.abs(angle) / 45;
  const direction = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const s_trend = direction > 0 ? clamp(0.5 + tStr / 2, 0.5, 1)
    : direction < 0 ? clamp(0.5 - tStr / 2, 0, 0.5) : 0.5;

  // Simplified S/R: distance to nearest local high/low
  let s_sr = 0.5;
  if (slice.length > 20) {
    const lookback = slice.slice(-30);
    let nearestHigh = Infinity, nearestLow = 0;
    for (const d of lookback) {
      if (d.high > price && d.high < nearestHigh) nearestHigh = d.high;
      if (d.low < price && d.low > nearestLow) nearestLow = d.low;
    }
    const dR = nearestHigh < Infinity ? Math.abs(price - nearestHigh) / nearestHigh : 1;
    const dS = nearestLow > 0 ? Math.abs(price - nearestLow) / nearestLow : 1;
    s_sr = clamp(0.5 - dR * 1.5 + dS * 1.0, 0, 1);
  }

  // ── LAYER 2: Momentum correction ──
  const TB = 5;
  let f_rsi = s_rsi, f_mfi = s_mfi, f_cci = s_cci, f_macd = s_macd, f_stoch = s_stoch;
  if (slice.length > TB + 15) {
    const pastSlice = slice.slice(0, -TB);
    const pastCloses = pastSlice.map(d => d.close);
    const rsiPast = calcRSI(pastCloses);
    const mfiPast = hasVolume ? calcMFI(pastSlice) : 50;
    const cciPast = calcCCI(pastSlice);
    const macdPast = calcMACD(pastCloses);
    const stochPast = calcStochastic(pastSlice);

    f_rsi = clamp(s_rsi + (rsi - rsiPast) / 100 * 0.08, 0, 1);
    f_mfi = clamp(s_mfi + (mfi - mfiPast) / 100 * 0.08, 0, 1);
    f_cci = clamp(s_cci + (cci - cciPast) / 300 * 0.06, 0, 1);
    f_macd = clamp(s_macd + (macd.histogram - macdPast.histogram) / (Math.abs(macd.histogram) + Math.abs(macdPast.histogram) + 1) * 3 * 0.08, 0, 1);
    f_stoch = clamp(s_stoch + (stoch.k - stochPast.k) / 50 * 0.06, 0, 1);
  }

  // ── LAYER 2: Cross signals (binary per spec) ──
  let f_stochCross = 0.1;
  let f_macdCross = 0.1;
  let f_div = 0.15;

  if (slice.length > 20) {
    const prevSlice = slice.slice(0, -1);
    const prevStoch = calcStochastic(prevSlice);
    const prevMacd = calcMACD(prevSlice.map(d => d.close));

    // Stochastic bullish cross: K_prev < D_prev AND K_curr > D_curr
    f_stochCross = (prevStoch.k < prevStoch.d && stoch.k > stoch.d) ? 0.9 : 0.1;

    // MACD bullish cross: line_prev < signal_prev AND line_curr > signal_curr
    f_macdCross = (prevMacd.line < prevMacd.signal && macd.line > macd.signal) ? 0.9 : 0.1;

    // Divergence detection
    if (closes.length > 40) {
      const p20 = closes[closes.length - 21];
      const rsi20 = calcRSI(closes.slice(0, -20));
      const pChange = price - p20;
      const rsiChange = rsi - rsi20;
      if (pChange !== 0 && rsiChange !== 0) {
        f_div = (pChange > 0 && rsiChange < 0) ? 0.85 : (pChange < 0 && rsiChange > 0) ? 0.85 : 0.15;
      }
    }
  }

  // ── Return 16 features in exact order ──
  return [
    f_rsi, f_mfi, f_cci, s_adx,
    f_macd, f_stoch, s_bb, s_ma21, s_ma100, s_ema,
    s_atr, s_trend, s_sr,
    f_stochCross, f_macdCross, f_div,
  ];
}

// ─── Model Cache ────────────────────────────────────────────────────────────

interface CachedModel {
  result: AdaptiveModelResult;
  time: number;
}

const modelCache = new Map<string, CachedModel>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function getCachedAdaptiveModel(symbol: string): AdaptiveModelResult | null {
  const cached = modelCache.get(symbol);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.result;
  return null;
}

export function setCachedAdaptiveModel(symbol: string, result: AdaptiveModelResult): void {
  modelCache.set(symbol, { result, time: Date.now() });
}

// ─── Main Training Function ─────────────────────────────────────────────────

/**
 * Train the Adaptive Weight Model for a given symbol.
 * Extracts 16 VDSS features for each historical candle, creates binary labels,
 * trains Logistic Regression with TimeSeriesSplit validation.
 *
 * @param data - Full OHLCV history (chronological, oldest first)
 * @param symbol - Symbol identifier for caching
 * @param minSamples - Minimum samples needed (default 70)
 * @returns AdaptiveModelResult or null
 */
export function trainAdaptiveModel(data: OHLCV[], symbol: string, minSamples = 70): AdaptiveModelResult | null {
  const FORWARD_DAYS = 5;
  const START_IDX = 40; // Need enough history for all indicators to stabilize

  if (data.length < START_IDX + FORWARD_DAYS + minSamples) return null;

  const hasVolume = data.some(d => d.volume > 0);

  const X: number[][] = [];
  const y: number[] = [];

  for (let i = START_IDX; i < data.length - FORWARD_DAYS; i++) {
    const features = extractVDSSFeatures(data, i, hasVolume);
    const currentPrice = data[i].close;
    const futurePrice = data[i + FORWARD_DAYS].close;

    if (currentPrice <= 0) continue;
    if (features.some(f => !isFinite(f))) continue;

    // Label: 1 if 5-day forward return > 1%, else 0
    const forwardReturn = (futurePrice - currentPrice) / currentPrice;
    const label = forwardReturn > 0.01 ? 1 : 0;

    X.push(features);
    y.push(label);
  }

  if (X.length < minSamples) return null;

  const model = new AdaptiveWeightModel(minSamples);
  const success = model.train(X, y);

  if (!success) return null;

  // Predict current features
  const currentFeatures = extractVDSSFeatures(data, data.length - 1, hasVolume);
  model.predictScore(currentFeatures);

  const result = model.getResult();
  setCachedAdaptiveModel(symbol, result);

  return result;
}

// ─── Calculate bullConsensus with ML Weights (Layer 3) ──────────────────────

/**
 * Calculate bullConsensus using ML weights.
 * Falls back to default weights if ML model is not trained.
 *
 * @param features - 16 VDSS features for the current candle
 * @param mlResult - Adaptive model result (or null for fallback)
 * @param hasVolume - Whether MFI feature is valid
 */
export function calculateBullConsensus(
  features: number[],
  mlResult: AdaptiveModelResult | null,
  hasVolume: boolean,
): { bullConsensus: number; usedML: boolean } {
  if (mlResult && mlResult.isTrained && mlResult.weights.length === 16) {
    const weights = mlResult.weights;
    let bullConsensus = 0;
    let totalWeight = 0;

    for (let j = 0; j < 16; j++) {
      // Skip MFI (index 1) if no volume
      if (j === 1 && !hasVolume) continue;
      bullConsensus += weights[j] * features[j];
      totalWeight += weights[j];
    }

    if (totalWeight > 0) bullConsensus /= totalWeight;

    // Blend with ML direct prediction (dynamic weight based on accuracy)
    if (mlResult.predictionProb !== null) {
      const mlWeight = Math.max(0, Math.min(mlResult.recentAccuracy * 0.30, 0.30));
      bullConsensus = bullConsensus * (1 - mlWeight) + mlResult.predictionProb * mlWeight;
    }

    return { bullConsensus: Math.max(0, Math.min(1, bullConsensus)), usedML: true };
  }

  // Fallback: default weights (per spec, only when ML is unavailable)
  const DEFAULT_WEIGHTS = [
    0.15, 0.12, 0.10, 0.08,  // rsi, mfi, cci, adx
    0.14, 0.10, 0.08,         // macd, stoch, bb
    0.10, 0.08, 0.10,         // ma21, ma100, ema
    0.05, 0.10, 0.05,         // atr, trend, sr
    0.06, 0.06, 0.08,         // stochCross, macdCross, div
  ];

  let bullConsensus = 0;
  let totalWeight = 0;
  for (let j = 0; j < 16; j++) {
    if (j === 1 && !hasVolume) continue;
    bullConsensus += DEFAULT_WEIGHTS[j] * features[j];
    totalWeight += DEFAULT_WEIGHTS[j];
  }
  if (totalWeight > 0) bullConsensus /= totalWeight;

  return { bullConsensus: Math.max(0, Math.min(1, bullConsensus)), usedML: false };
}

// ─── ML Service Client ─────────────────────────────────────────────────────

const ML_SERVICE_URL = '/?XTransformPort=3040';

interface MLPredictionResult {
  predictions: number[];
  confidence: number;
  conf_intervals: [number, number][];
  predicted_return_5d: number;
}

interface MLRegimeResult {
  regime: string;
  probabilities: Record<string, number>;
}

async function callMLService<T>(endpoint: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export async function fetchMLPrediction(prices: number[], volume: number[] | null): Promise<MLPredictionResult | null> {
  return callMLService<MLPredictionResult>('/predict', {
    prices: prices.slice(-120),
    volume: volume ? volume.slice(-120) : null,
  });
}

export async function fetchMLRegime(prices: number[]): Promise<MLRegimeResult | null> {
  return callMLService<MLRegimeResult>('/regime', { prices: prices.slice(-120) });
}

export async function fetchMLWeights(
  features: Record<string, number>,
  regime: string,
  hasVolume: boolean,
): Promise<Record<string, number> | null> {
  const res = await callMLService<{ weights: Record<string, number> }>('/weights', {
    features, regime, has_volume: hasVolume,
  });
  return res?.weights ?? null;
}

// ─── Decision Graph Scenario Probabilities (3-Branch DAG) ──────────────────
// Implements the exact structure from TechnicalAnalysisDssGraph.txt:
//   Root → 3 branches (Trend Following A, Breakout B, Reversal C)
//   Each branch → 9 edges → 9 leaf scenarios
//   P(Scenario_S) = Σ_branch P(Branch) × P(Edge_S | Branch)
//   Where P(Branch) is derived from EMV maximization,
//   and P(Edge) is the conditional probability per edge formula.
// ═══════════════════════════════════════════════════════════════════════════

export interface DecisionGraphContext {
  bullConsensus: number;
  price: number;
  R1_level: number;
  S1_level: number;
  MA100: number;
  rsi: number;
  mfi: number;
  stochK: number;
  stochD: number;
  macdHist: number;
  macdLine: number;
  macdSignal: number;
  adx: number;
  diPlus: number;
  diMinus: number;
  atr: number;
  bbUpper: number;
  bbLower: number;
  bbMiddle: number;
  hasVolume: boolean;
  volume: number;
  avgVolume20: number;
  mlResult: AdaptiveModelResult | null;
  mlPrediction: MLPredictionResult | null;
  mlRegime: MLRegimeResult | null;
}

/**
 * Calculate 9-scenario probabilities using the 3-branch decision graph.
 * Each branch (Trend Following, Breakout, Reversal) emits conditional probabilities
 * for each scenario. Final probability is the EMV-weighted combination.
 *
 * Per TechnicalAnalysisDssGraph.txt:
 *   P_Bull_Final = α × P_Bull_Current + (1-α) × P_Bull_Forecast
 *   P_Bear_Final = α × P_Bear_Current + (1-α) × P_Bear_Forecast
 *   P_Neutral_Final = 1 - (P_Bull_Final + P_Bear_Final)
 *
 *   P(Scenario_S) = P_Bull_Final × CP_S|Bull + P_Bear_Final × CP_S|Bear + P_Neutral_Final × CP_S|Neutral
 */
export function calculateScenarioProbabilities(
  bullConsensus: number,
  price: number,
  R1: number,
  S1: number,
  MA100: number,
  rsi: number,
  mfi: number,
  stochK: number,
  hasVolume: boolean,
  mlResult: AdaptiveModelResult | null,
  adx: number = 25,
  atr: number = 0,
): { pR1: number; pR2: number; pR3: number; pR4: number; pR5: number; pR6: number; pR7: number; pR8: number; pR9: number; factors: { momentum: number; volatility: number; trend: number } } {
  // ── Adaptive ML factors ──
  const mlParams = mlResult?.adaptiveParams;
  const factors = {
    momentum: mlParams?.momentumFactor ?? 0.7,
    volatility: mlParams?.volatilityFactor ?? 0.5,
    trend: mlParams?.trendFactor ?? 0.6,
  };

  const bull = bullConsensus;
  const bear = 1 - bullConsensus;

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Compute P_Bull_Current, P_Bear_Current from current indicators
  // ═══════════════════════════════════════════════════════════════════════
  // Use Bayesian weighting: W_i = P(Success|Tool_i) × Prior_i / Σ
  // For current signals, each indicator provides a directional score.

  // RSI signal (0=bearish, 1=bullish)
  const rsiBull = rsi > 70 ? 0.85 : rsi > 60 ? 0.7 : rsi > 50 ? 0.55
    : rsi > 40 ? 0.45 : rsi > 30 ? 0.3 : rsi > 20 ? 0.15 : 0.05;

  // MFI signal (volume-dependent)
  const mfiBull = hasVolume
    ? (mfi > 80 ? 0.85 : mfi > 60 ? 0.65 : mfi > 40 ? 0.45 : mfi > 20 ? 0.3 : 0.15)
    : 0.5; // neutral if no volume

  // Stochastic signal
  const stochBull = stochK > 80 ? 0.85 : stochK > 60 ? 0.65 : stochK > 40 ? 0.45
    : stochK > 20 ? 0.3 : 0.15;

  // ADX trend strength normalized (0-1)
  const adxNorm = Math.min(adx / 45, 1);

  // Price vs MA100 position
  const maPosBull = MA100 > 0 ? clamp((price - MA100) / (MA100 * 0.05), 0, 1) : 0.5;

  // Distance to S/R (proximity = more likely to react)
  const distR1 = R1 > 0 ? Math.exp(-3 * Math.abs(price - R1) / R1) : 0.5;
  const distS1 = S1 > 0 ? Math.exp(-3 * Math.abs(price - S1) / S1) : 0.5;

  // Priors per category (from instructions): trend=0.28, oscillator=0.25, volume=0.15, volatility=0.10, leading=0.12, patterns=0.10
  // Adjusted: if no volume, redistribute 0.15 proportionally
  let priorTrend = 0.28, priorOsc = 0.25, priorVol = hasVolume ? 0.15 : 0;
  let priorVolatility = 0.10, priorLeading = 0.12, priorPattern = 0.10;
  if (!hasVolume) {
    const totalRemaining = priorTrend + priorOsc + priorVolatility + priorLeading + priorPattern;
    const redistribute = 0.15;
    priorTrend += redistribute * (priorTrend / totalRemaining);
    priorOsc += redistribute * (priorOsc / totalRemaining);
    priorVolatility += redistribute * (priorVolatility / totalRemaining);
    priorLeading += redistribute * (priorLeading / totalRemaining);
    priorPattern += redistribute * (priorPattern / totalRemaining);
  }

  // P_Bull_Current = Σ(W_i × Signal_Bull_i) / Σ(W_i)
  const currentBullSignals = [
    { signal: rsiBull, weight: priorOsc * 0.4 },           // RSI (oscillator)
    { signal: mfiBull, weight: priorVol },                 // MFI (volume)
    { signal: stochBull, weight: priorOsc * 0.35 },        // Stochastic (oscillator)
    { signal: maPosBull, weight: priorTrend * 0.5 },       // MA position (trend)
    { signal: adxNorm > 0.5 && bull > 0.5 ? bull : 0.5, weight: priorTrend * 0.3 }, // ADX trend (trend)
    { signal: distS1, weight: priorPattern * 0.5 },        // Near support = bullish bounce
  ];

  let sumWeight = 0;
  let sumWeightedBull = 0;
  for (const { signal, weight } of currentBullSignals) {
    if (weight <= 0) continue;
    sumWeightedBull += weight * signal;
    sumWeight += weight;
  }
  const P_Bull_Current = sumWeight > 0 ? clamp(sumWeightedBull / sumWeight, 0, 1) : bull;
  const P_Bear_Current = 1 - P_Bull_Current;

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: P_Bull_Forecast (from ML prediction, or decayed current)
  // ═══════════════════════════════════════════════════════════════════════
  // If ML prediction available, use predicted return to estimate future bull prob
  // Otherwise use exponential decay of current state
  const alpha = 0.5; // weight of current state (per instructions)

  // Use ML predicted return if available, otherwise use consensus as proxy
  const mlReturn = mlResult?.predictionProb;
  let P_Bull_Forecast: number;
  if (mlReturn !== null && mlReturn !== undefined) {
    // ML gives direct P(bull) prediction — use it as forecast
    P_Bull_Forecast = clamp(mlReturn, 0, 1);
  } else {
    // Decay: forecast = current × decay + 0.5 × (1-decay)  (mean-revert to 0.5)
    const decayFactor = 0.85;
    P_Bull_Forecast = P_Bull_Current * decayFactor + 0.5 * (1 - decayFactor);
  }
  const P_Bear_Forecast = 1 - P_Bull_Forecast;

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Final directional probabilities (combining current + forecast)
  // ═══════════════════════════════════════════════════════════════════════
  const P_Bull_Final = clamp(alpha * P_Bull_Current + (1 - alpha) * P_Bull_Forecast, 0.02, 0.98);
  const P_Bear_Final = clamp(alpha * P_Bear_Current + (1 - alpha) * P_Bear_Forecast, 0.02, 0.98);
  const P_Neutral_Final = Math.max(0.04, 1 - P_Bull_Final - P_Bear_Final);

  // Normalize so they sum to 1
  const dirSum = P_Bull_Final + P_Bear_Final + P_Neutral_Final;
  const pBull = P_Bull_Final / dirSum;
  const pBear = P_Bear_Final / dirSum;
  const pNeutral = P_Neutral_Final / dirSum;

  // ═══════════════════════════════════════════════════════════════════════

  // Helper: Overbought/Oversold
  const overbought = rsi > 70 ? (rsi - 70) / 30 : 0;
  const oversold = rsi < 30 ? (30 - rsi) / 30 : 0;

  // Helper: Volatility state
  const atrPct = price > 0 ? (atr || price * 0.02) / price : 0.02;
  const volHigh = clamp((atrPct - 0.02) / 0.03, 0, 1);
  const volLow = clamp(1 - (atrPct - 0.01) / 0.02, 0, 1);

  // Helper: Divergence detection
  let divBull = 0;
  let divBear = 0;
  if (mlResult?.predictionProb !== undefined) {
    const mlBull = mlResult.predictionProb ?? 0.5;
    if (bull > 0.6 && mlBull < 0.4) divBear = (bull - mlBull) * 1.5;
    if (bull < 0.4 && mlBull > 0.6) divBull = (mlBull - bull) * 1.5;
  }
  divBull = clamp(divBull, 0, 0.3);
  divBear = clamp(divBear, 0, 0.3);

  // Helper: Volume confirmation
  const volConfirm = hasVolume ? 0.6 : 0.4;

  // Helper: ADX > 40 = strong trend
  const adxStrong = adx > 40 ? 1 : adx > 25 ? (adx - 25) / 15 : 0;

  // ── Conditional probability distributions CP(S_i | State) ──
  // Per attachment instructions: 3-branch decision graph
  //   Branch A: Trend Following → scenarios A1-A9
  //   Branch B: Breakout Strategy → scenarios B1-B9
  //   Branch C: Reversal Strategy → scenarios C1-C9
  // Final: P(S_i) = P(Bull)×CP_i|Bull + P(Bear)×CP_i|Bear + P(Neutral)×CP_i|Neutral
  // Each CP distribution sums to 1 after normalization.
  //
  // ADX governs range/trend split (per attachment: ADX < 20 = weak trend)
  // FIX: Range scenarios capped so they never dominate (>40% of any CP dist)

  // ADX-based trend strength (per attachment: ADX_Normalized = min(ADX/60, 1))
  const adxNormVal = Math.min(adx / 60, 1);
  // Range weight: inversely proportional to ADX, but capped at 0.35 (was 0.6!)
  const adxRange = adx < 20 ? 0.35 : adx < 30 ? 0.20 : 0.10;
  const adxTrend = 1 - adxRange;

  // ── Per attachment edge formulas (lines 657-716): ──
  // A1: Strong Bull  = P_Bull × P_ADX>40 × P_Forecast_Bull_Strong
  // A2: Accel Bull   = P_Bull × P_Volatility_High × P_Volume_High_Future
  // A3: Cautious Bull= P_Bull × P_Divergence_Bearish_Future
  // A4: Strong Bear  = P_Bear × P_ADX>40 × P_Forecast_Bear_Strong
  // A5: Accel Bear   = P_Bear × P_Volatility_High × P_Volume_High_Future
  // A6: Cautious Bear= P_Bear × P_Divergence_Bullish_Future
  // A7: LowVol Range = P_Neutral × P_Volatility_Low_Future
  // A8: HighVol Range= P_Neutral × P_Volatility_High_Future
  // A9: Shock        = P_Shock × P_Forecast_Anomaly (0.02-0.05)

  // CP_i|Bull: Bull scenarios dominate, range scenarios limited
  const cpBull = [
    // R1: Strong Bull — ADX strength and trend quality
    0.28 * adxTrend * (0.5 + 0.5 * adxNormVal),
    // R2: Accelerating Bull — momentum + volatility
    0.15 * adxTrend * (0.3 + 0.7 * factors.momentum),
    // R3: Cautious Bull — reduced by overbought risk
    0.12 * (1 - overbought * 0.6) * adxTrend,
    // R4: Strong Bear — small probability in bull market, driven by divergence
    0.03 * (1 + divBear),
    // R5: Accelerating Bear — very small in bull market
    0.02,
    // R6: Cautious Bear — driven by divergence warning
    0.03 * (1 + divBear),
    // R7: Low-Vol Range — bounded, not dominant
    adxRange * 0.45 * volLow,
    // R8: High-Vol Range — bounded
    adxRange * 0.30 * volHigh,
    // R9: Shock — fixed small probability
    0.04 * (1 + overbought * 0.5 + volHigh * 0.5),
  ];

  // CP_i|Bear: Mirror of bull (bear scenarios dominate)
  const cpBear = [
    // R1: Strong Bull — small in bear market
    0.03 * (1 + divBull),
    // R2: Accelerating Bull — very small
    0.02,
    // R3: Cautious Bull — divergence-driven
    0.03 * (1 + divBull),
    // R4: Strong Bear — ADX strength
    0.28 * adxTrend * (0.5 + 0.5 * adxNormVal),
    // R5: Accelerating Bear — momentum
    0.15 * adxTrend * (0.3 + 0.7 * factors.momentum),
    // R6: Cautious Bear — reduced by oversold risk
    0.12 * (1 - oversold * 0.6) * adxTrend,
    // R7: Low-Vol Range — bounded
    adxRange * 0.45 * volLow,
    // R8: High-Vol Range — bounded
    adxRange * 0.30 * volHigh,
    // R9: Shock
    0.04 * (1 + oversold * 0.5 + volHigh * 0.5),
  ];

  // CP_i|Neutral: More balanced distribution per attachment
  // Per attachment: neutral market has trend signals too, just weaker
  // Range gets adxRange but trend scenarios get reasonable weight
  const cpNeutral = [
    // R1: Mild Bull — smaller in neutral
    0.08 * adxTrend * (0.5 + 0.5 * adxNormVal),
    // R2: Bull Acceleration
    0.04 * adxTrend * (0.3 + 0.7 * factors.momentum),
    // R3: Cautious Bull
    0.07 * adxTrend,
    // R4: Mild Bear
    0.08 * adxTrend * (0.5 + 0.5 * adxNormVal),
    // R5: Bear Acceleration
    0.04 * adxTrend * (0.3 + 0.7 * factors.momentum),
    // R6: Cautious Bear
    0.07 * adxTrend,
    // R7: Low-Vol Range — adxRange weighted, split between vol states
    adxRange * 0.50 * volLow,
    // R8: High-Vol Range
    adxRange * 0.35 * volHigh,
    // R9: Shock — small fixed
    0.04,
  ];

  const normCP = (cp: number[]): number[] => {
    const s = cp.reduce((a, b) => a + b, 0);
    return s > 0 ? cp.map(v => v / s) : cp.map(() => 1 / 9);
  };
  const ncpBull = normCP(cpBull);
  const ncpBear = normCP(cpBear);
  const ncpNeutral = normCP(cpNeutral);

  // ── Final probabilities per instructions formula ──
  // P(S_i) = P(Bull)*CP_i|Bull + P(Bear)*CP_i|Bear + P(Neutral)*CP_i|Neutral
  const rawS = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 9; i++) {
    rawS[i] = pBull * ncpBull[i] + pBear * ncpBear[i] + pNeutral * ncpNeutral[i];
  }

  // Normalize to sum = 100
  const totalRaw = rawS.reduce((a, b) => a + b, 0);
  if (totalRaw <= 0) {
    return {
      pR1: 12, pR2: 10, pR3: 8, pR4: 12, pR5: 10, pR6: 8,
      pR7: 15, pR8: 15, pR9: 10, factors,
    };
  }

  const pR1 = Math.round(rawS[0] / totalRaw * 100);
  const pR2 = Math.round(rawS[1] / totalRaw * 100);
  const pR3 = Math.round(rawS[2] / totalRaw * 100);
  const pR4 = Math.round(rawS[3] / totalRaw * 100);
  const pR5 = Math.round(rawS[4] / totalRaw * 100);
  const pR6 = Math.round(rawS[5] / totalRaw * 100);
  const pR7 = Math.round(rawS[6] / totalRaw * 100);
  const pR8 = Math.round(rawS[7] / totalRaw * 100);
  const pR9 = Math.max(1, 100 - (pR1 + pR2 + pR3 + pR4 + pR5 + pR6 + pR7 + pR8));
  return { pR1, pR2, pR3, pR4, pR5, pR6, pR7, pR8, pR9, factors };
}

export function calculateEdgeWeights(
  bullConsensus: number,
  adx: number,
  mlResult: AdaptiveModelResult | null,
): { up: number; down: number; pullback: number; risk: number } {
  // Default coefficients
  let trendCoef = 1 / 3;
  let momentumCoef = 1 / 3;
  let volatilityCoef = 1 / 3;

  if (mlResult?.isTrained && mlResult.coefficients.length === 16) {
    const ec = mlResult.coefficients;
    const absTrend = Math.abs(ec[11] ?? 0);
    const absMomentum = Math.abs(ec[0] ?? 0);
    const absVolatility = Math.abs(ec[10] ?? 0);
    const total = absTrend + absMomentum + absVolatility;
    if (total > 0) {
      trendCoef = absTrend / total;
      momentumCoef = absMomentum / total;
      volatilityCoef = absVolatility / total;
    }
  }

  // Dynamic base calculations
  const up_base = bullConsensus * 0.7 + 0.15;
  const down_base = (1 - bullConsensus) * 0.7 + 0.15;
  const pullback_base = 0.25;
  const risk_base = 0.12 * (1.2 - Math.min(adx / 100, 1));

  // Apply ML-driven adjustments
  const up = clamp(up_base * (1 + (momentumCoef - 1 / 3) * 0.3), 0.05, 0.95);
  const down = clamp(down_base * (1 + (trendCoef - 1 / 3) * 0.3), 0.05, 0.95);
  const pullback = clamp(pullback_base * (1 + (volatilityCoef - 1 / 3) * 0.2), 0.05, 0.50);
  const risk = clamp(risk_base * (1 - (trendCoef - 1 / 3) * 0.5), 0.02, 0.30);

  return { up, down, pullback, risk };
}

// ─── Backward-Compatible Exports (for any code still using old API) ─────────

export interface MLWeights {
  weights: Record<string, number>;
  normalizedWeights: Record<string, number>;
  r2Score: number;
  sampleCount: number;
}

export function trainIndicatorWeights(data: OHLCV[], minSamples = 60): MLWeights | null {
  // Bridge: use the new adaptive model but return old format
  const result = trainAdaptiveModel(data, '_legacy', minSamples);
  if (!result) return null;

  const weightMap: Record<string, number> = {};
  const normMap: Record<string, number> = {};
  for (let i = 0; i < VDSS_FEATURE_NAMES.length; i++) {
    const name = VDSS_FEATURE_NAMES[i];
    weightMap[name] = result.coefficients[i];
    normMap[name] = result.weights[i];
  }

  return {
    weights: weightMap,
    normalizedWeights: normMap,
    r2Score: result.recentAccuracy,
    sampleCount: result.sampleCount,
  };
}

export function getCachedWeights(symbol: string): MLWeights | null {
  const cached = getCachedAdaptiveModel(symbol);
  if (!cached) return null;

  const weightMap: Record<string, number> = {};
  const normMap: Record<string, number> = {};
  for (let i = 0; i < VDSS_FEATURE_NAMES.length; i++) {
    weightMap[VDSS_FEATURE_NAMES[i]] = cached.coefficients[i];
    normMap[VDSS_FEATURE_NAMES[i]] = cached.weights[i];
  }

  return {
    weights: weightMap,
    normalizedWeights: normMap,
    r2Score: cached.recentAccuracy,
    sampleCount: cached.sampleCount,
  };
}

export function setCachedWeights(symbol: string, w: MLWeights): void {
  const result: AdaptiveModelResult = {
    weights: VDSS_FEATURE_NAMES.map(n => w.normalizedWeights[n] ?? 1 / 16),
    coefficients: VDSS_FEATURE_NAMES.map(n => w.weights[n] ?? 0),
    recentAccuracy: w.r2Score,
    isTrained: true,
    sampleCount: w.sampleCount,
    predictionProb: null,
    adaptiveParams: { momentumFactor: 0.7, volatilityFactor: 0.5, trendFactor: 0.6 },
  };
  setCachedAdaptiveModel(symbol, result);
}

// ─── Price Prediction (kept for backward compat) ──────────────────────────

export interface PricePrediction {
  predictedPrices: number[];
  predictedReturn5d: number;
  confidence: number;
  trendDirection: 'up' | 'down' | 'flat';
}

export function predictPrices(data: OHLCV[]): PricePrediction | null {
  if (data.length < 40) return null;
  const PREDICT_DAYS = 5;
  const closes = data.map(d => d.close);
  const price = closes[closes.length - 1];
  if (price <= 0) return null;

  const LOOKBACK = 20;
  const returns: number[] = [];
  for (let i = closes.length - LOOKBACK; i < closes.length; i++) {
    returns.push(i > 0 && closes[i - 1] > 0 ? (closes[i] - closes[i - 1]) / closes[i - 1] : 0);
  }

  const mom3 = returns.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const mom10 = returns.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const ma20 = sma(closes, 20);
  const deviation = price > 0 && ma20 > 0 ? (price - ma20) / ma20 : 0;

  const trendSlice = closes.slice(-20);
  const tn = trendSlice.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < tn; i++) { sx += i; sy += trendSlice[i]; sxy += i * trendSlice[i]; sx2 += i * i; }
  const d = tn * sx2 - sx * sx;
  let slope = 0, r2 = 0;
  if (d !== 0) {
    slope = (tn * sxy - sx * sy) / d;
    const meanY = sy / tn;
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < tn; i++) { ssRes += (trendSlice[i] - (slope * i + meanY - slope * (tn - 1) / 2)) ** 2; ssTot += (trendSlice[i] - meanY) ** 2; }
    r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  }

  let atr = 0;
  for (let i = Math.max(1, data.length - 14); i < data.length; i++) {
    atr += Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i - 1].close), Math.abs(data[i].low - data[i - 1].close));
  }
  atr /= Math.min(14, data.length - 1);
  const dailyVol = price > 0 ? atr / price : 0.02;

  const trendDaily = price > 0 ? slope / price : 0;
  const meanRevDaily = -deviation * 0.05;
  const momentumDaily = mom3 * 0.4 + mom10 * 0.1;
  const trendW = r2 * 0.6, mrW = Math.min(Math.abs(deviation) * 5, 0.4), momW = 0.2;
  const predDaily = trendDaily * trendW + meanRevDaily * mrW + momentumDaily * momW;

  const predictedPrices: number[] = [];
  let cp = price;
  for (let dd = 1; dd <= PREDICT_DAYS; dd++) {
    const decay = Math.exp(-0.1 * (dd - 1));
    cp = cp * (1 + predDaily * decay);
    predictedPrices.push(Math.round(cp));
  }

  const predictedReturn5d = (predictedPrices[PREDICT_DAYS - 1] - price) / price;
  return {
    predictedPrices,
    predictedReturn5d,
    confidence: Math.min(0.9, Math.max(0.1, r2 * 0.7 + 0.2)),
    trendDirection: predictedReturn5d > 0.005 ? 'up' : predictedReturn5d < -0.005 ? 'down' : 'flat',
  };
}

export function evaluatePredictedIndicators(data: OHLCV[], prediction: PricePrediction): { mlScore: number; predictedBullConsensus: number } {
  const price = data[data.length - 1].close;
  if (price <= 0 || prediction.predictedPrices.length === 0) return { mlScore: 0.5, predictedBullConsensus: 0.5 };
  const avgP = prediction.predictedPrices.reduce((a, b) => a + b, 0) / prediction.predictedPrices.length;
  const closes = data.map(d => d.close);
  const ma21 = sma(closes, 21), ma100 = sma(closes, 100), rsi = calcRSI(closes);
  const rsiP = Math.max(0, Math.min(1, (rsi + (avgP > price ? 5 : -5)) / 100));
  const ma21S = ma21 > 0 ? (avgP > ma21 ? 0.7 : 0.3) : 0.5;
  const ma100S = ma100 > 0 ? (avgP > ma100 ? 0.65 : 0.35) : 0.5;
  const dirS = avgP > price ? 0.65 : 0.35;
  return {
    mlScore: Math.max(0, Math.min(1, 0.5 + prediction.predictedReturn5d * 10 * prediction.confidence)),
    predictedBullConsensus: Math.max(0, Math.min(1, rsiP * 0.3 + ma21S * 0.25 + ma100S * 0.2 + dirS * 0.25)),
  };
}
