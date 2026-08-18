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
  strength: number; // 1-10
  isTarget: boolean;
}

export interface TAResult {
  // Moving Averages
  sma: Record<string, number>;
  ema: Record<string, number>;
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
  // Support / Resistance (5 each, rounded)
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

// ─── Helper: Round to nice number ─────────────────────────────────────────────
function roundToNice(price: number): number {
  const abs = Math.abs(price);
  let step: number;
  if (abs >= 100000) step = 100;
  else if (abs >= 10000) step = 50;
  else if (abs >= 1000) step = 10;
  else if (abs >= 100) step = 5;
  else step = 1;
  return Math.round(price / step) * step;
}

// ─── Helper: Swing Highs/Lows ─────────────────────────────────────────────────
function findSwingLevels(data: OHLCV[], lookback: number = 3): { highs: number[]; lows: number[] } {
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

// ─── Support / Resistance (6 each, adaptive gap, multi-factor strength) ───
function calcSupportResistance(data: OHLCV[], currentPrice: number): {
  resistances: number[];
  supports: number[];
  supportStrengths: LevelStrength[];
  resistanceStrengths: LevelStrength[];
  priceTargets: LevelStrength[];
} {
  const closes = data.map(d => d.close);
  const avgVolume = data.reduce((s, d) => s + d.volume, 0) / data.length;

  // Tag each raw level with its source type for confluence scoring
  interface TaggedLevel { price: number; source: string };
  const allRaw: TaggedLevel[] = [];

  // 1. Pivot Points (source: 'pivot')
  const prev = data[data.length - 2] ?? data[data.length - 1];
  if (prev) {
    const pp = (prev.high + prev.low + prev.close) / 3;
    const hl = prev.high - prev.low;
    const pivotR = [
      2 * pp - prev.low, pp + hl,
      prev.high + 2 * (pp - prev.low),
      prev.high + 2 * (pp - prev.low) + hl,
      prev.high + 2 * (pp - prev.low) + hl + (pp - prev.low),
    ];
    const pivotS = [
      2 * pp - prev.high, pp - hl,
      prev.low - 2 * (prev.high - pp),
      prev.low - 2 * (prev.high - pp) - hl,
      prev.low - 2 * (prev.high - pp) - hl - (prev.high - pp),
    ];
    for (const p of pivotR) allRaw.push({ price: p, source: 'pivot' });
    for (const p of pivotS) allRaw.push({ price: p, source: 'pivot' });
  }

  // 2. Swing levels (source: 'swing')
  for (const lb of [3, 5, 7, 10]) {
    const swings = findSwingLevels(data, lb);
    for (const h of swings.highs) allRaw.push({ price: h, source: 'swing' });
    for (const l of swings.lows) allRaw.push({ price: l, source: 'swing' });
  }

  // 3. Moving Average levels (source: 'ma')
  for (const period of [5, 10, 21, 50, 100, 200]) {
    const v = sma(closes, period);
    if (v > 0 && Math.abs(v - currentPrice) / currentPrice > 0.01)
      allRaw.push({ price: v, source: 'ma' });
  }
  const ema12 = emaCalc(closes, 12);
  const ema26 = emaCalc(closes, 26);
  if (ema12 > 0 && Math.abs(ema12 - currentPrice) / currentPrice > 0.01)
    allRaw.push({ price: ema12, source: 'ma' });
  if (ema26 > 0 && Math.abs(ema26 - currentPrice) / currentPrice > 0.01)
    allRaw.push({ price: ema26, source: 'ma' });

  // 4. Bollinger Band levels (source: 'bb')
  const bbLevels = calcBollingerBands(closes);
  if (bbLevels.upper > 0) allRaw.push({ price: bbLevels.upper, source: 'bb' });
  if (bbLevels.lower > 0) allRaw.push({ price: bbLevels.lower, source: 'bb' });

  // 5. Round number / psychological levels (source: 'round')
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, currentPrice))));
  for (let mult = 0.80; mult <= 1.25; mult += 0.05) {
    const p = Math.round(currentPrice * mult / magnitude) * magnitude;
    allRaw.push({ price: p, source: 'round' });
  }

  // 6. Recent high/low zones (source: 'hilo')
  for (const w of [5, 22, 66]) {
    const slice = data.slice(-Math.min(w, data.length));
    if (slice.length > 0) {
      allRaw.push({ price: Math.max(...slice.map(d => d.high)), source: 'hilo' });
      allRaw.push({ price: Math.min(...slice.map(d => d.low)), source: 'hilo' });
    }
  }

  // 7. Round all and filter invalid
  const rounded: TaggedLevel[] = allRaw
    .map(l => ({ price: roundToNice(l.price), source: l.source }))
    .filter(l => l.price > 0);

  // 8. Cluster nearby levels (within 0.5%) — merge sources, keep most common price
  interface Cluster {
    price: number;
    sources: Set<string>;
    touchCount: number;
    totalVolumeAtTouches: number;
    mostRecentTouchBar: number;
  }
  const clusters: Cluster[] = [];
  for (const lvl of rounded) {
    let merged = false;
    for (const c of clusters) {
      if (Math.abs(c.price - lvl.price) / Math.max(c.price, 1) < 0.005) {
        c.sources.add(lvl.source);
        merged = true;
        break;
      }
    }
    if (!merged) {
      clusters.push({ price: lvl.price, sources: new Set([lvl.source]), touchCount: 0, totalVolumeAtTouches: 0, mostRecentTouchBar: -1 });
    }
  }

  // 9. Count actual price TOUCHES (rejections) and volume at each cluster level
  // A real touch = bar wick reached the level AND bar body closed away from it
  const touchThreshold = currentPrice * 0.004; // 0.4% tight proximity
  for (let i = 0; i < data.length; i++) {
    const bar = data[i];
    for (const c of clusters) {
      const isResistance = c.price > currentPrice;
      if (isResistance) {
        // Resistance: bar high reached near the level AND closed below it (rejection)
        if (bar.high >= c.price - touchThreshold && bar.close < c.price) {
          c.touchCount++;
          c.totalVolumeAtTouches += bar.volume;
          c.mostRecentTouchBar = Math.max(c.mostRecentTouchBar, i);
        }
      } else {
        // Support: bar low reached near the level AND closed above it (rejection)
        if (bar.low <= c.price + touchThreshold && bar.close > c.price) {
          c.touchCount++;
          c.totalVolumeAtTouches += bar.volume;
          c.mostRecentTouchBar = Math.max(c.mostRecentTouchBar, i);
        }
      }
    }
  }

  // 10. Calculate multi-factor strength (0-10)
  const levelStrengths: LevelStrength[] = clusters.map(c => {
    // Factor 1: Source Confluence (0-2.5 pts)
    const sourceScore = Math.min(2.5, c.sources.size * 0.5);
    const hasSwingAndPivot = c.sources.has('swing') && c.sources.has('pivot') ? 0.5 : 0;
    const maConfluence = c.sources.has('ma') ? 0.5 : 0;
    const confluenceScore = Math.min(2.5, sourceScore + hasSwingAndPivot + maConfluence);

    // Factor 2: Touch Count — CAPPED by recency (0-2 pts)
    // Only count touches in the most recent 50% of data to avoid ancient history inflating
    const recentBarStart = Math.floor(data.length * 0.5);
    const recentTouches = c.mostRecentTouchBar >= recentBarStart ? c.touchCount : Math.max(0, c.touchCount - 1);
    let touchScore: number;
    if (recentTouches === 0) touchScore = 0;
    else if (recentTouches === 1) touchScore = 0.4;
    else if (recentTouches <= 2) touchScore = 0.8;
    else if (recentTouches <= 4) touchScore = 1.2;
    else if (recentTouches <= 7) touchScore = 1.6;
    else touchScore = 2.0;

    // Factor 3: Volume Confirmation (0-1.5 pts)
    let volumeScore = 0;
    if (c.touchCount > 0) {
      const avgVolAtTouch = c.totalVolumeAtTouches / c.touchCount;
      const volRatio = avgVolume > 0 ? avgVolAtTouch / avgVolume : 1;
      if (volRatio > 2.0) volumeScore = 1.5;
      else if (volRatio > 1.5) volumeScore = 1.2;
      else if (volRatio > 1.0) volumeScore = 0.8;
      else if (volRatio > 0.7) volumeScore = 0.4;
      else volumeScore = 0.2;
    }

    // Factor 4: Freshness / Recency (0-1.5 pts)
    let freshnessScore = 0;
    if (c.touchCount > 0 && data.length > 0) {
      const barsAgo = data.length - 1 - c.mostRecentTouchBar;
      if (barsAgo <= 3) freshnessScore = 1.5;
      else if (barsAgo <= 10) freshnessScore = 1.2;
      else if (barsAgo <= 25) freshnessScore = 0.8;
      else if (barsAgo <= 50) freshnessScore = 0.4;
      else freshnessScore = 0.1;
    }

    // Factor 5: Proximity to current price (0-1 pt)
    const distRatio = Math.abs(c.price - currentPrice) / currentPrice;
    let proximityScore = 0;
    if (distRatio < 0.015) proximityScore = 1.0;
    else if (distRatio < 0.03) proximityScore = 0.7;
    else if (distRatio < 0.06) proximityScore = 0.4;
    else if (distRatio < 0.10) proximityScore = 0.2;

    const total = confluenceScore + touchScore + volumeScore + freshnessScore + proximityScore;
    const strength = Math.min(10, Math.max(1, Math.round(total)));

    return { price: c.price, strength, isTarget: false };
  });

  // 11. Separate above/below current price
  const above = levelStrengths.filter(l => l.price > currentPrice).sort((a, b) => a.price - b.price);
  const below = levelStrengths.filter(l => l.price < currentPrice).sort((a, b) => b.price - a.price);

  // 12. Adaptive gap enforcement — keep highest strength in cluster
  function enforceGap(levels: LevelStrength[], targetCount: number): LevelStrength[] {
    const gapSteps = [0.05, 0.04, 0.03, 0.025, 0.02, 0.015, 0.01, 0.008, 0.005];
    for (const gapPct of gapSteps) {
      if (levels.length === 0) return [];
      const result: LevelStrength[] = [levels[0]];
      for (let i = 1; i < levels.length; i++) {
        if (result.length >= targetCount) break;
        const prevPrice = result[result.length - 1].price;
        const currPrice = levels[i].price;
        const gap = Math.abs(currPrice - prevPrice) / prevPrice;
        if (gap >= gapPct) {
          result.push(levels[i]);
        } else {
          // Merge: keep stronger level's price, add 0.5 for confluence
          const keep = levels[i].strength >= result[result.length - 1].strength ? levels[i] : result[result.length - 1];
          const mergedStrength = Math.min(10, Math.max(keep.strength, result[result.length - 1].strength) + 0.5);
          result[result.length - 1] = { ...keep, strength: Math.round(mergedStrength) };
        }
      }
      if (result.length >= targetCount) return result;
    }
    return levels.slice(0, targetCount);
  }

  const finalResistances = enforceGap(above, 6);
  const finalSupports = enforceGap(below, 6);

  // 13. Determine price targets: top 2 by strength, or any above 7
  const allLevels = [...finalResistances, ...finalSupports];
  const sortedByStrength = [...allLevels].sort((a, b) => b.strength - a.strength);
  let targets: LevelStrength[];
  if (sortedByStrength.some(l => l.strength >= 7)) {
    targets = sortedByStrength.filter(l => l.strength >= 7).slice(0, 3);
  } else {
    targets = sortedByStrength.slice(0, 2);
  }

  // Mark targets
  targets = targets.map(t => ({ ...t, isTarget: true }));

  // Also mark in final arrays
  finalResistances.forEach(r => {
    if (targets.some(t => t.price === r.price)) r.isTarget = true;
  });
  finalSupports.forEach(s => {
    if (targets.some(t => t.price === s.price)) s.isTarget = true;
  });

  return {
    resistances: finalResistances.map(l => l.price),
    supports: finalSupports.map(l => l.price),
    supportStrengths: finalSupports,
    resistanceStrengths: finalResistances,
    priceTargets: targets,
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
  const mfiVal = calcMFI(slice);
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

  // f_mfi — MFI with momentum correction
  const mfiCurrent = mfiVal;
  const mfi5ago = barIdx >= 5
    ? calcMFI(data.slice(0, barIdx - 5 + 1))
    : mfiCurrent;
  const f_mfi = clamp(s_mfi + (mfiCurrent - mfi5ago) / 100 * 0.08, 0, 1);

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
  outgoing: {
    A: [['B', 'up'], ['G', 'pullback'], ['L', 'risk']] as [string, string][],
    B: [['C', 'up'], ['G', 'pullback'], ['A', 'risk']] as [string, string][],
    C: [['D', 'up'], ['G', 'pullback'], ['L', 'risk']] as [string, string][],
    D: [['E', 'up'], ['B', 'pullback'], ['G', 'pullback'], ['L', 'risk']] as [string, string][],
    E: [['F', 'up'], ['D', 'pullback'], ['G', 'pullback'], ['H', 'down'], ['R1', 'terminal']] as [string, string][],
    F: [['R1', 'terminal'], ['E', 'pullback'], ['D', 'down'], ['G', 'risk']] as [string, string][],
    G: [['B', 'up'], ['A', 'pullback'], ['H', 'down'], ['L', 'risk'], ['R2', 'terminal']] as [string, string][],
    H: [['G', 'pullback'], ['I', 'down'], ['B', 'up'], ['L', 'risk'], ['R2', 'terminal']] as [string, string][],
    I: [['H', 'pullback'], ['J', 'down'], ['G', 'up'], ['L', 'risk'], ['R3', 'terminal']] as [string, string][],
    J: [['I', 'pullback'], ['K', 'down'], ['H', 'up'], ['L', 'risk'], ['R3', 'terminal']] as [string, string][],
    K: [['J', 'pullback'], ['I', 'up'], ['L', 'risk'], ['R4', 'terminal'], ['R5', 'terminal']] as [string, string][],
    L: [['C', 'up'], ['H', 'pullback'], ['J', 'down'], ['K', 'risk'], ['R5', 'terminal']] as [string, string][],
  },
  // which result scenario each terminal node maps to
  terminalMap: { R1: 'R1', R2: 'R2', R3: 'R3', R4: 'R4', R5: 'R5' } as Record<string, string>,
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
  const rawSums: Record<string, number> = { R1: 0, R2: 0, R3: 0, R4: 0, R5: 0 };
  for (const rp of rawPaths) {
    rawSums[rp.scenario] = (rawSums[rp.scenario] ?? 0) + rp.prob;
  }

  // Compute calibration factors: scenarioProbs[scenario] / rawSum[scenario]
  const calibrationFactors: Record<string, number> = {};
  for (const scenario of ['R1', 'R2', 'R3', 'R4', 'R5']) {
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
// LAYER 4 — Scenario Probability Calculation (Adaptive with ML)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculates the 5 VDss scenario probabilities (R1-R5) that sum to 100.
 * Uses bull/bear consensus, key indicator values, S/R levels, and
 * ML-derived adaptive factors for fine-tuning.
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
): { R1: number; R2: number; R3: number; R4: number; R5: number; factors: { momentum: number; volatility: number; trend: number } } {
  // Distance metrics to key levels (spec uses exp(-3 * ...))
  const distR1 = R1 > 0 ? Math.exp(-3 * Math.abs(price - R1) / R1) : 0;
  const distS1 = S1 > 0 ? Math.exp(-3 * Math.abs(price - S1) / S1) : 0;

  // Binary risk flags (per spec)
  const overboughtRisk = (rsi > 70 || mfi > 80 || stochK > 80) ? 1 : 0;
  const oversoldBounce = (rsi < 30 || mfi < 20 || stochK < 20) ? 1 : 0;

  // Extract adaptive factors from ML model if trained
  let momentum = 0.7;
  let volatility = 0.5;
  let trend = 0.6;

  if (mlModel.isTrained && mlModel.weights) {
    const coefs = mlModel.getCoefficients();
    momentum = sigmoid(coefs[0] ?? 0);   // rsi coefficient → momentum factor
    volatility = sigmoid(coefs[10] ?? 0); // atr coefficient → volatility factor
    trend = sigmoid(coefs[11] ?? 0);     // trend coefficient → trend factor
  }

  // Below MA100 flag
  const belowMA100 = price < MA100 ? 1 : 0;

  // ── Raw scenario probabilities (matching user spec) ─────────────────────

  // R1: Strong Bullish — aggressive breakout
  const raw_R1 =
    bullConsensus * distR1 * (1 - overboughtRisk * momentum * 0.7) +
    oversoldBounce * 0.3 * distR1 * momentum;

  // R2: Gradual Uptrend — steady rise
  const raw_R2 =
    ((1 - Math.abs(bullConsensus - 0.65)) * 0.8 +
    (bullConsensus > 0.4 ? 0.2 : 0)) * trend;

  // R3: Range-bound
  const raw_R3 =
    (1 - Math.abs(bullConsensus - 0.5)) * 0.6 * (1 + (1 - volatility) * 0.2);

  // R4: Moderate Correction
  const raw_R4 =
    ((1 - bullConsensus) * distS1 * 0.7 +
    overboughtRisk * 0.5 * momentum) *
    (0.8 + 0.2 * (1 - trend));

  // R5: Deep Correction
  const raw_R5 =
    ((1 - bullConsensus) ** 2 * 0.5 + belowMA100 * 0.2) *
    (1 + (1 - trend) * 0.3);

  // ── Normalize to sum = 100 ───────────────────────────────────────────
  const sum = raw_R1 + raw_R2 + raw_R3 + raw_R4 + raw_R5;
  const pR1 = sum > 0 ? Math.round(raw_R1 / sum * 100) : 20;
  const pR2 = sum > 0 ? Math.round(raw_R2 / sum * 100) : 20;
  const pR3 = sum > 0 ? Math.round(raw_R3 / sum * 100) : 20;
  const pR4 = sum > 0 ? Math.round(raw_R4 / sum * 100) : 20;
  const pR5 = 100 - (pR1 + pR2 + pR3 + pR4);

  return {
    R1: pR1, R2: pR2, R3: pR3, R4: pR4, R5: pR5,
    factors: { momentum, volatility, trend },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════
export function analyze(data: OHLCV[]): TAResult {
  if (!data || data.length < 2) {
    const empty = () => 0;
    const emptyScenario = (): ScenarioResult => ({ name: '', nameEn: '', probability: 20, targetMin: 0, targetMax: 0, description: '' });
    return {
      sma: {}, ema: {}, rsi: 50, mfi: 50, cci: 0, stochK: 50, stochD: 50,
      williamsR: -50, macd: { line: 0, signal: 0, histogram: 0 },
      adx: 0, diPlus: 0, diMinus: 0, sar: 0, atr: 0,
      bollingerBands: { upper: 0, middle: 0, lower: 0 }, obv: 0,
      resistances: [], supports: [],
      supportStrengths: [], resistanceStrengths: [], priceTargets: [],
      trend: {
        short: { direction: 'flat', slope: 0, angle: 0, r2: 0 },
        medium: { direction: 'flat', slope: 0, angle: 0, r2: 0 },
        long: { direction: 'flat', slope: 0, angle: 0, r2: 0 },
      },
      scenarios: { R1: emptyScenario(), R2: emptyScenario(), R3: emptyScenario(), R4: emptyScenario(), R5: emptyScenario() },
      bullScore: 0.5, bearScore: 0.5, overallSignal: 'neutral',
      bullConsensus: 0.5, isMLTrained: false, mlAccuracy: 0.5, mlWeights: null,
      edgeWeights: { up: 0.3, down: 0.3, pullback: 0.25, risk: 0.15 },
      calibrationFactors: { R1: 1, R2: 1, R3: 1, R4: 1, R5: 1 },
      scenarioSums: { R1: 0, R2: 0, R3: 0, R4: 0, R5: 0 },
      adaptiveFactors: { momentum: 0.7, volatility: 0.5, trend: 0.6 },
    };
  }

  const closes = data.map(d => d.close);
  const price = closes[closes.length - 1];

  // ── Moving Averages ──────────────────────────────────────────────────────
  const smaPeriods = [5, 10, 21, 50, 100, 200];
  const smaResult: Record<string, number> = {};
  for (const p of smaPeriods) smaResult[`sma${p}`] = sma(closes, p);

  const emaResult: Record<string, number> = {
    ema12: emaCalc(closes, 12),
    ema26: emaCalc(closes, 26),
  };

  // ── Oscillators ──────────────────────────────────────────────────────────
  const rsi = calcRSI(closes);
  const mfi = calcMFI(data);
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
  const obv = calcOBV(data);

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

  // ── Layer 4: Scenario Probabilities ───────────────────────────────────────
  const ma100Val = smaResult.sma100 ?? price;
  const scenarioResult = calculateScenarioProbabilities(
    bullConsensus, price, R1_level, S1_level, ma100Val,
    rsi, mfi, stoch.k, mlModel
  );
  const pR1 = scenarioResult.R1;
  const pR2 = scenarioResult.R2;
  const pR3 = scenarioResult.R3;
  const pR4 = scenarioResult.R4;
  const pR5 = scenarioResult.R5;

  // ── Layer 5: VDss Edge Weights ────────────────────────────────────────────
  const edgeWeights = calculateEdgeWeights(bullConsensus, adxResult.adx, mlModel);

  // ── Layer 6: Path Probabilities with Calibration ──────────────────────────
  const scenarioProbsForGraph: Record<string, number> = { R1: pR1, R2: pR2, R3: pR3, R4: pR4, R5: pR5 };
  const pathResult = calculatePathProbabilities(edgeWeights, scenarioProbsForGraph);

  // ── Layer 7: Adaptive model update (register current observation) ─────────
  if (data.length > 6) {
    const futureReturn = (price - data[data.length - 6].close) / data[data.length - 6].close;
    const label = futureReturn > 0.01 ? 1 : 0;
    mlModel.update(featureArray, label);
  }

  // ── Overall Signal ──────────────────────────────────────────────────────
  const overallSignal: 'bullish' | 'bearish' | 'neutral' =
    bullConsensus > 0.58 ? 'bullish' : bullConsensus < 0.42 ? 'bearish' : 'neutral';

  // ── Scenario Descriptions ───────────────────────────────────────────────
  const fmt = (n: number) => Math.round(n).toLocaleString('fa-IR');
  const scenarios = {
    R1: {
      name: 'صعود هیجانی',
      nameEn: 'Strong Bullish',
      probability: pR1,
      targetMin: R2_level,
      targetMax: R5_level,
      description: `عبور از مقاومت‌های ${fmt(R1_level)} و ${fmt(R2_level)} با شتاب بالا. هدف: ${fmt(R2_level)} تا ${fmt(R5_level)} ریال.`,
    },
    R2: {
      name: 'صعود تدریجی',
      nameEn: 'Gradual Uptrend',
      probability: pR2,
      targetMin: R1_level,
      targetMax: R3_level,
      description: `حرکت صعودی آرام با پولبک‌های موقت. هدف: ${fmt(R1_level)} تا ${fmt(R3_level)} ریال.`,
    },
    R3: {
      name: 'نوسان در محدوده',
      nameEn: 'Range-bound',
      probability: pR3,
      targetMin: S1_level,
      targetMax: R1_level,
      description: `نوسان بین حمایت ${fmt(S1_level)} و مقاومت ${fmt(R1_level)} ریال.`,
    },
    R4: {
      name: 'اصلاح متوسط',
      nameEn: 'Moderate Correction',
      probability: pR4,
      targetMin: S3_level,
      targetMax: S1_level,
      description: `اصلاح تا محدوده حمایت ${fmt(S3_level)} تا ${fmt(S1_level)} ریال.`,
    },
    R5: {
      name: 'اصلاح عمیق',
      nameEn: 'Deep Correction',
      probability: pR5,
      targetMin: S5_level,
      targetMax: S3_level,
      description: `شکست ساختار و افت تا حمایت‌های ${fmt(S5_level)} تا ${fmt(S3_level)} ریال.`,
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
    // ── VDss ML Metadata (Layers 3-6) ──
    bullConsensus,
    isMLTrained: mlModel.isTrained,
    mlAccuracy: mlModel.recentAccuracy,
    mlWeights: mlModel.weights,
    edgeWeights,
    calibrationFactors: pathResult.calibrationFactors,
    scenarioSums: pathResult.scenarioSums,
    adaptiveFactors: scenarioResult.factors,
  };
}
