// ═══════════════════════════════════════════════════════════════════════════════
// TSE Technical Analysis Engine — Complete Implementation
// ═══════════════════════════════════════════════════════════════════════════════

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

// ─── Support / Resistance (6 each, adaptive gap, multi-source, 10% window strength) ─
function calcSupportResistance(data: OHLCV[], currentPrice: number): {
  resistances: number[];
  supports: number[];
  supportStrengths: LevelStrength[];
  resistanceStrengths: LevelStrength[];
  priceTargets: LevelStrength[];
} {
  const allRawLevels: number[] = [];
  const closes = data.map(d => d.close);

  // 1. Pivot Points from previous day (5R + 5S)
  const prev = data[data.length - 2] ?? data[data.length - 1];
  if (prev) {
    const pp = (prev.high + prev.low + prev.close) / 3;
    const hl = prev.high - prev.low;
    const pivotR = [
      2 * pp - prev.low,
      pp + hl,
      prev.high + 2 * (pp - prev.low),
      prev.high + 2 * (pp - prev.low) + hl,
      prev.high + 2 * (pp - prev.low) + hl + (pp - prev.low),
    ];
    const pivotS = [
      2 * pp - prev.high,
      pp - hl,
      prev.low - 2 * (prev.high - pp),
      prev.low - 2 * (prev.high - pp) - hl,
      prev.low - 2 * (prev.high - pp) - hl - (prev.high - pp),
    ];
    allRawLevels.push(...pivotR, ...pivotS);
  }

  // 2. Swing levels (multiple lookback periods for better coverage)
  for (const lb of [3, 5, 7, 10]) {
    const swings = findSwingLevels(data, lb);
    allRawLevels.push(...swings.highs, ...swings.lows);
  }

  // 3. Moving Average levels (potential dynamic S/R)
  for (const period of [5, 10, 21, 50, 100, 200]) {
    const v = sma(closes, period);
    if (v > 0 && Math.abs(v - currentPrice) / currentPrice > 0.01) allRawLevels.push(v);
  }
  const ema12 = emaCalc(closes, 12);
  const ema26 = emaCalc(closes, 26);
  if (ema12 > 0 && Math.abs(ema12 - currentPrice) / currentPrice > 0.01) allRawLevels.push(ema12);
  if (ema26 > 0 && Math.abs(ema26 - currentPrice) / currentPrice > 0.01) allRawLevels.push(ema26);

  // 4. Bollinger Band levels
  const bbLevels = calcBollingerBands(closes);
  if (bbLevels.upper > 0) allRawLevels.push(bbLevels.upper);
  if (bbLevels.lower > 0) allRawLevels.push(bbLevels.lower);

  // 5. Round number / psychological levels
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, currentPrice))));
  for (let mult = 0.80; mult <= 1.25; mult += 0.05) {
    allRawLevels.push(Math.round(currentPrice * mult / magnitude) * magnitude);
  }

  // 6. Recent high/low zones (5-day, 22-day, 66-day)
  for (const window of [5, 22, 66]) {
    const slice = data.slice(-Math.min(window, data.length));
    if (slice.length > 0) {
      allRawLevels.push(Math.max(...slice.map(d => d.high)));
      allRawLevels.push(Math.min(...slice.map(d => d.low)));
    }
  }

  // 7. Round all and filter invalid
  const rounded = allRawLevels.map(roundToNice).filter(l => l > 0);

  // 8. Remove duplicates (within 0.5%)
  const unique: number[] = [];
  for (const level of rounded) {
    const isDup = unique.some(u => Math.abs(u - level) / Math.max(u, 1) < 0.005);
    if (!isDup) unique.push(level);
  }

  // 9. Calculate strength for each unique level — 10% window (5% above + 5% below)
  const levelStrengths: LevelStrength[] = unique.map(level => {
    const range10pct = level * 0.10;
    const nearbyCount = unique.filter(other =>
      other !== level && Math.abs(other - level) <= range10pct
    ).length;
    // Normalize: 0 nearby = 1, each nearby adds ~1.5, max 10
    const strength = Math.min(10, Math.max(1, Math.round(1 + nearbyCount * 1.5)));
    return { price: level, strength, isTarget: false };
  });

  // 10. Separate above/below current price
  const above = levelStrengths.filter(l => l.price > currentPrice).sort((a, b) => a.price - b.price);
  const below = levelStrengths.filter(l => l.price < currentPrice).sort((a, b) => b.price - a.price);

  // 11. Adaptive gap enforcement — try 5% first, reduce until we get enough levels
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
          // Merge: combine strengths
          const mergedStrength = Math.min(10, Math.max(result[result.length - 1].strength, levels[i].strength) + 1);
          result[result.length - 1] = {
            ...levels[i].strength > result[result.length - 1].strength ? levels[i] : result[result.length - 1],
            strength: mergedStrength,
          };
        }
      }
      if (result.length >= targetCount) return result;
    }
    return levels.slice(0, targetCount);
  }

  const finalResistances = enforceGap(above, 6);
  const finalSupports = enforceGap(below, 6);

  // 12. Determine price targets: strength > 7 is a target
  const allLevels = [...finalResistances, ...finalSupports];
  const sortedByStrength = [...allLevels].sort((a, b) => b.strength - a.strength);
  let targets: LevelStrength[];
  if (sortedByStrength.some(l => l.strength > 7)) {
    targets = sortedByStrength.filter(l => l.strength > 7);
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
  // PROBABILITY ENGINE — uses ALL indicators
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

  // ── Bull Score: weighted average of all 20 signals ──────────────────────
  const signals: number[] = [];

  // 1. RSI
  signals.push(rsi > 70 ? 1 : rsi > 50 ? 0.5 : 0);
  // 2. MFI
  signals.push(mfi > 80 ? 1 : mfi > 50 ? 0.5 : 0);
  // 3. CCI
  signals.push(cci > 100 ? 1 : cci > 0 ? 0.5 : 0);
  // 4. Stochastic %K
  signals.push(stoch.k > 80 ? 1 : stoch.k > 50 ? 0.5 : 0);
  // 5. Williams %R
  signals.push(williamsR > -20 ? 1 : williamsR > -50 ? 0.5 : 0);
  // 6. MACD
  signals.push(macd.line > macd.signal ? 1 : macd.line > 0 ? 0.5 : 0);
  // 7. DI+ > DI-
  signals.push(adxResult.diPlus > adxResult.diMinus ? 1 : 0);
  // 8-13. Price vs MAs
  signals.push(price > (smaResult.sma21 ?? 0) ? 1 : 0);
  signals.push(price > (smaResult.sma50 ?? 0) ? 1 : 0);
  signals.push(price > (smaResult.sma100 ?? 0) ? 1 : 0);
  signals.push(price > (smaResult.sma200 ?? 0) ? 1 : 0);
  signals.push(price > (emaResult.ema12 ?? 0) ? 1 : 0);
  signals.push(price > (emaResult.ema26 ?? 0) ? 1 : 0);
  // 14. Price vs SAR
  signals.push(price > sar ? 1 : 0);
  // 15. OBV trend
  const obvSlice = Math.min(10, data.length - 1);
  const obvTrend = obvSlice > 0 && data.length > obvSlice
    ? (data.slice(-obvSlice).reduce((s, d, _, arr) => s + (d.close > arr[Math.max(0, arr.length - obvSlice - 1)]?.close ? 1 : 0), 0) / obvSlice) : 0.5;
  signals.push(obvTrend > 0.6 ? 1 : obvTrend > 0.4 ? 0.5 : 0);
  // 16. BB position
  const bbRange = bb.upper - bb.lower;
  const bbPos = bbRange === 0 ? 0.5 : Math.max(0, Math.min(1, (price - bb.lower) / bbRange));
  signals.push(bbPos);
  // 17-19. Trend directions weighted by R²
  signals.push((trend.short.direction === 'up' ? 1 : trend.short.direction === 'down' ? 0 : 0.5) * trend.short.r2);
  signals.push((trend.medium.direction === 'up' ? 1 : trend.medium.direction === 'down' ? 0 : 0.5) * trend.medium.r2);
  signals.push((trend.long.direction === 'up' ? 1 : trend.long.direction === 'down' ? 0 : 0.5) * trend.long.r2);
  // 20. ADX strength
  signals.push(Math.min(adxResult.adx / 100, 1));

  const bullScore = signals.reduce((a, b) => a + b, 0) / signals.length;
  const bearScore = 1 - bullScore;

  // ── Raw Probability Calculation ─────────────────────────────────────────
  const dR1 = Math.exp(-5 * Math.abs(price - R1_level) / R1_level);
  const dS1 = Math.exp(-5 * Math.abs(price - S1_level) / S1_level);
  const rangeWidth = R1_level - S1_level;
  const distanceRatio = rangeWidth === 0 ? 0.5 : (price - S1_level) / rangeWidth;

  const overboughtFactor = (rsi > 70 || mfi > 80 || stoch.k > 80) ? 0.3 : 1;
  const oversoldFactor = (rsi < 30 || mfi < 20 || stoch.k < 20) ? 0.3 : 1;

  const adxWeight = Math.min(adxResult.adx / 100, 1);
  const trendWeight = 0.4 * adxWeight + 0.6 * bullScore;

  const raw_R1 = 0.30 * bullScore * dR1 * overboughtFactor * trendWeight;
  const raw_R2 = 0.25 * bullScore * (1 - dR1) * distanceRatio * trendWeight;
  const raw_R3 = 0.20 * (1 - Math.abs(bullScore - 0.5) * 1.6);
  const raw_R4 = 0.25 * bearScore * (1 - dS1) * (1 - distanceRatio) * trendWeight;
  const raw_R5 = 0.20 * bearScore * dS1 * oversoldFactor * trendWeight;

  // ── Normalize to sum = 100 exactly ──────────────────────────────────────
  const sum = raw_R1 + raw_R2 + raw_R3 + raw_R4 + raw_R5;
  const pR1 = sum === 0 ? 20 : Math.round(raw_R1 / sum * 100);
  const pR2 = sum === 0 ? 20 : Math.round(raw_R2 / sum * 100);
  const pR3 = sum === 0 ? 20 : Math.round(raw_R3 / sum * 100);
  const pR4 = sum === 0 ? 20 : Math.round(raw_R4 / sum * 100);
  const pR5 = 100 - (pR1 + pR2 + pR3 + pR4); // remainder ensures sum = 100

  // ── Overall Signal ──────────────────────────────────────────────────────
  const overallSignal: 'bullish' | 'bearish' | 'neutral' =
    bullScore > 0.58 ? 'bullish' : bullScore < 0.42 ? 'bearish' : 'neutral';

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
  };
}
