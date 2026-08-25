// ═══════════════════════════════════════════════════════════════════════════════
// Per-Day Indicator Calculator — 60+ Technical Indicators
// Volume-aware system: skips volume-dependent indicators when no volume data
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types & Constants ─────────────────────────────────────────────────────────

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Set of indicator field names that require volume data to produce meaningful values. */
export const VOLUME_DEPENDENT_INDICATORS: ReadonlySet<string> = new Set([
  'mfi',
  'obv',
  'vpt',
  'vosc',
  'chaikinAD',
  'forceIndex',
  'vap',
  'vwap',
  'vwma20',
]);

export interface DailyIndicators {
  // ── OHLCV Data ──
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** True when all candles have volume > 0 */
  hasVolume: boolean;

  // ── Trend: Moving Averages (13) ──
  ma10: number;
  ma21: number;
  ma50: number;
  ma100: number;
  ma200: number;
  ema9: number;
  ema12: number;
  ema26: number;
  vwma20: number;
  wma20: number;
  hma20: number;
  tma20: number;
  lma20: number;

  // ── Trend: Ichimoku Cloud (4) ──
  ichimokuTenkan: number;
  ichimokuKijun: number;
  ichimokuSenkouA: number;
  ichimokuSenkouB: number;

  // ── Trend: Heiken Ashi (4) ──
  haOpen: number;
  haHigh: number;
  haLow: number;
  haClose: number;

  // ── Oscillators (20) ──
  rsi: number;
  stochK: number;
  stochD: number;
  stochRsiK: number;
  stochRsiD: number;
  williamsR: number;
  momentum: number;
  roc: number;
  trix: number;
  cci: number;
  mfi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  adx: number;
  dmiPlus: number;
  dmiMinus: number;
  sar: number;
  awesomeOsc: number;
  fisherTransform: number;

  // ── Volatility (12) ──
  atr: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  bbWidth: number;
  kcUpper: number;
  kcMiddle: number;
  kcLower: number;
  envUpper: number;
  envLower: number;
  histVolatility: number;
  stdDev20: number;

  // ── Volume (7) ──
  obv: number;
  vpt: number;
  vosc: number;
  chaikinAD: number;
  forceIndex: number;
  vap: number;
  vwap: number;
}

// ─── Rounding Helpers ───────────────────────────────────────────────────────────

const r0 = (v: number): number => Math.round(v);
const r1 = (v: number): number => Math.round(v * 10) / 10;
const r2 = (v: number): number => Math.round(v * 100) / 100;
const r4 = (v: number): number => Math.round(v * 10000) / 10000;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── EMA (full array) ───────────────────────────────────────────────────────────
function emaArray(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(0);
  if (data.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  result[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: MOVING AVERAGES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── SMA (full array) ──────────────────────────────────────────────────────────
function smaArray(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    result[i] = sum / period;
  }
  return result;
}

// ─── WMA — Weighted Moving Average ─────────────────────────────────────────────
function wmaArray(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(0);
  if (data.length < period) return result;
  const denom = period * (period + 1) / 2;
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j] * (period - j);
    result[i] = sum / denom;
  }
  return result;
}

// ─── HMA — Hull Moving Average ─────────────────────────────────────────────────
function hmaArray(closes: number[], period: number): number[] {
  const halfPeriod = Math.max(1, Math.floor(period / 2));
  const sqrtPeriod = Math.max(2, Math.floor(Math.sqrt(period)));
  const wmaHalf = wmaArray(closes, halfPeriod);
  const wmaFull = wmaArray(closes, period);
  const diff = new Array(closes.length).fill(0);
  for (let i = 0; i < closes.length; i++) diff[i] = 2 * wmaHalf[i] - wmaFull[i];
  return wmaArray(diff, sqrtPeriod);
}

// ─── TMA — Triangular Moving Average (SMA of SMA) ──────────────────────────────
function tmaArray(closes: number[], period: number): number[] {
  const halfPeriod = Math.max(2, Math.ceil(period / 2));
  const firstPass = smaArray(closes, period);
  return smaArray(firstPass, halfPeriod);
}

// ─── LMA — Linear Regression (Least Squares) Moving Average ────────────────────
function lmaArray(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  if (closes.length < period) return result;
  const sumX = period * (period - 1) / 2;
  const sumX2 = (period - 1) * period * (2 * period - 1) / 6;
  const denom = period * sumX2 - sumX * sumX;
  if (denom === 0) return result;
  for (let i = period - 1; i < closes.length; i++) {
    let sumY = 0;
    let sumXY = 0;
    for (let j = 0; j < period; j++) {
      const idx = i - period + 1 + j;
      sumY += closes[idx];
      sumXY += j * closes[idx];
    }
    const b = (period * sumXY - sumX * sumY) / denom;
    const a = (sumY - b * sumX) / period;
    result[i] = a + b * (period - 1);
  }
  return result;
}

// ─── VWMA — Volume Weighted Moving Average ──────────────────────────────────────
function vwmaArray(closes: number[], volumes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  if (closes.length < period) return result;
  for (let i = period - 1; i < closes.length; i++) {
    let pvSum = 0;
    let vSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      pvSum += closes[j] * volumes[j];
      vSum += volumes[j];
    }
    result[i] = vSum === 0 ? 0 : pvSum / vSum;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: ICHIMOKU CLOUD (9, 26, 52)
// ═══════════════════════════════════════════════════════════════════════════════

function ichimokuArray(
  highs: number[],
  lows: number[],
  tenkanP: number = 9,
  kijunP: number = 26,
  senkouBP: number = 52,
): { tenkan: number[]; kijun: number[]; senkouA: number[]; senkouB: number[] } {
  const len = highs.length;
  const tenkan: number[] = new Array(len).fill(0);
  const kijun: number[] = new Array(len).fill(0);
  const senkouA: number[] = new Array(len).fill(0);
  const senkouB: number[] = new Array(len).fill(0);

  for (let i = tenkanP - 1; i < len; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - tenkanP + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    tenkan[i] = (hh + ll) / 2;
  }

  for (let i = kijunP - 1; i < len; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - kijunP + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    kijun[i] = (hh + ll) / 2;
  }

  for (let i = kijunP - 1; i < len; i++) {
    senkouA[i] = (tenkan[i] + kijun[i]) / 2;
  }

  for (let i = senkouBP - 1; i < len; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - senkouBP + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    senkouB[i] = (hh + ll) / 2;
  }

  return { tenkan, kijun, senkouA, senkouB };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: HEIKEN ASHI
// ═══════════════════════════════════════════════════════════════════════════════

function heikenAshiArray(
  opens: number[],
  highs: number[],
  lows: number[],
  closes: number[],
): { haOpen: number[]; haHigh: number[]; haLow: number[]; haClose: number[] } {
  const len = closes.length;
  const haOpen: number[] = new Array(len).fill(0);
  const haClose: number[] = new Array(len).fill(0);
  const haHigh: number[] = new Array(len).fill(0);
  const haLow: number[] = new Array(len).fill(0);
  if (len === 0) return { haOpen, haHigh, haLow, haClose };

  haClose[0] = (opens[0] + highs[0] + lows[0] + closes[0]) / 4;
  haOpen[0] = (opens[0] + closes[0]) / 2;
  haHigh[0] = highs[0];
  haLow[0] = lows[0];

  for (let i = 1; i < len; i++) {
    haClose[i] = (opens[i] + highs[i] + lows[i] + closes[i]) / 4;
    haOpen[i] = (haOpen[i - 1] + haClose[i - 1]) / 2;
    haHigh[i] = Math.max(highs[i], haOpen[i], haClose[i]);
    haLow[i] = Math.min(lows[i], haOpen[i], haClose[i]);
  }

  return { haOpen, haHigh, haLow, haClose };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: OSCILLATORS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── RSI (full array) ──────────────────────────────────────────────────────────
function rsiArray(closes: number[], period: number = 14): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  if (closes.length < period + 1) return result;

  let gainSum = 0,
    lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

// ─── Stochastic (full array) ───────────────────────────────────────────────────
function stochasticArray(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod: number = 14,
  dPeriod: number = 3,
): { k: number[]; d: number[] } {
  const kArr: number[] = new Array(closes.length).fill(0);
  const dArr: number[] = new Array(closes.length).fill(0);

  for (let i = kPeriod - 1; i < closes.length; i++) {
    let highest = -Infinity,
      lowest = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > highest) highest = highs[j];
      if (lows[j] < lowest) lowest = lows[j];
    }
    kArr[i] = highest === lowest ? 50 : ((closes[i] - lowest) / (highest - lowest)) * 100;
  }

  for (let i = kPeriod - 1 + dPeriod - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) sum += kArr[j];
    dArr[i] = sum / dPeriod;
  }
  return { k: kArr, d: dArr };
}

// ─── Stochastic RSI ────────────────────────────────────────────────────────────
function stochRsiArray(
  closes: number[],
  rsiPeriod: number = 14,
  stochPeriod: number = 14,
  smoothPeriod: number = 3,
): { k: number[]; d: number[] } {
  const rsiValues = rsiArray(closes, rsiPeriod);
  const kArr: number[] = new Array(closes.length).fill(0);
  const dArr: number[] = new Array(closes.length).fill(0);
  const startIdx = rsiPeriod - 1 + stochPeriod - 1;

  for (let i = startIdx; i < closes.length; i++) {
    let minRsi = Infinity,
      maxRsi = -Infinity;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      if (rsiValues[j] < minRsi) minRsi = rsiValues[j];
      if (rsiValues[j] > maxRsi) maxRsi = rsiValues[j];
    }
    kArr[i] = maxRsi === minRsi ? 50 : ((rsiValues[i] - minRsi) / (maxRsi - minRsi)) * 100;
  }

  for (let i = startIdx + smoothPeriod - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - smoothPeriod + 1; j <= i; j++) sum += kArr[j];
    dArr[i] = sum / smoothPeriod;
  }
  return { k: kArr, d: dArr };
}

// ─── Williams %R ────────────────────────────────────────────────────────────────
function williamsRArray(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  for (let i = period - 1; i < closes.length; i++) {
    let highest = -Infinity,
      lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > highest) highest = highs[j];
      if (lows[j] < lowest) lowest = lows[j];
    }
    result[i] = highest === lowest ? -50 : ((highest - closes[i]) / (highest - lowest)) * -100;
  }
  return result;
}

// ─── Momentum ───────────────────────────────────────────────────────────────────
function momentumArray(closes: number[], period: number = 10): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] - closes[i - period];
  }
  return result;
}

// ─── ROC — Rate of Change ──────────────────────────────────────────────────────
function rocArray(closes: number[], period: number = 12): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i - period] === 0 ? 0 : ((closes[i] - closes[i - period]) / closes[i - period]) * 100;
  }
  return result;
}

// ─── TRIX — Triple EMA Rate of Change ──────────────────────────────────────────
function trixArray(closes: number[], period: number = 9): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  const startIdx = 3 * (period - 1) + 1;
  if (closes.length < startIdx) return result;

  const ema1 = emaArray(closes, period);
  const ema2 = emaArray(ema1, period);
  const ema3 = emaArray(ema2, period);

  for (let i = startIdx; i < closes.length; i++) {
    if (ema3[i - 1] === 0) {
      result[i] = 0;
    } else {
      result[i] = ((ema3[i] - ema3[i - 1]) / Math.abs(ema3[i - 1])) * 100;
    }
  }
  return result;
}

// ─── CCI (full array) ──────────────────────────────────────────────────────────
function cciArray(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20,
): number[] {
  const len = closes.length;
  const result: number[] = new Array(len).fill(0);

  for (let i = period - 1; i < len; i++) {
    let tpSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      tpSum += (highs[j] + lows[j] + closes[j]) / 3;
    }
    const tpMean = tpSum / period;
    let md = 0;
    for (let j = i - period + 1; j <= i; j++) {
      md += Math.abs((highs[j] + lows[j] + closes[j]) / 3 - tpMean);
    }
    md /= period;
    result[i] = md === 0 ? 0 : ((highs[i] + lows[i] + closes[i]) / 3 - tpMean) / (0.015 * md);
  }
  return result;
}

// ─── MFI (full array) ──────────────────────────────────────────────────────────
function mfiArray(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 14,
): number[] {
  const len = closes.length;
  const result: number[] = new Array(len).fill(0);

  for (let i = period; i < len; i++) {
    let posFlow = 0,
      negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const tp = (highs[j] + lows[j] + closes[j]) / 3;
      const prevTp = (highs[j - 1] + lows[j - 1] + closes[j - 1]) / 3;
      const mf = tp * volumes[j];
      if (tp > prevTp) posFlow += mf;
      else negFlow += mf;
    }
    result[i] = negFlow === 0 ? 100 : 100 - 100 / (1 + posFlow / negFlow);
  }
  return result;
}

// ─── MACD (full array) ─────────────────────────────────────────────────────────
function macdArray(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9,
): { line: number[]; signalArr: number[]; histogram: number[] } {
  const len = closes.length;
  const line: number[] = new Array(len).fill(0);
  const signalArr: number[] = new Array(len).fill(0);
  const histogram: number[] = new Array(len).fill(0);

  const emaFast = emaArray(closes, fast);
  const emaSlow = emaArray(closes, slow);

  for (let i = 0; i < len; i++) {
    line[i] = emaFast[i] - emaSlow[i];
  }

  const macdSignalEma = emaArray(line, signal);
  for (let i = 0; i < len; i++) {
    signalArr[i] = macdSignalEma[i];
    histogram[i] = line[i] - macdSignalEma[i];
  }

  return { line, signalArr, histogram };
}

// ─── ADX + DMI (full array) ────────────────────────────────────────────────────
function adxArray(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
): { adx: number[]; dmiPlus: number[]; dmiMinus: number[] } {
  const len = closes.length;
  const adxResult: number[] = new Array(len).fill(0);
  const dmiPlusResult: number[] = new Array(len).fill(0);
  const dmiMinusResult: number[] = new Array(len).fill(0);
  if (len < period * 2 + 1) return { adx: adxResult, dmiPlus: dmiPlusResult, dmiMinus: dmiMinusResult };

  const tr: number[] = new Array(len).fill(0);
  const plusDM: number[] = new Array(len).fill(0);
  const minusDM: number[] = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  const smooth = (arr: number[], start: number) => {
    let sum = 0;
    for (let i = start; i < start + period; i++) sum += arr[i];
    const res: number[] = new Array(len).fill(0);
    res[start + period - 1] = sum;
    for (let i = start + period; i < len; i++) {
      res[i] = res[i - 1] - res[i - 1] / period + arr[i];
    }
    return res;
  };

  const atrSmooth = smooth(tr, 1);
  const sPlusDM = smooth(plusDM, 1);
  const sMinusDM = smooth(minusDM, 1);

  // Compute DI+ and DI-
  for (let i = 1; i < len; i++) {
    const atrVal = atrSmooth[i];
    dmiPlusResult[i] = atrVal === 0 ? 0 : (sPlusDM[i] / atrVal) * 100;
    dmiMinusResult[i] = atrVal === 0 ? 0 : (sMinusDM[i] / atrVal) * 100;
  }

  const dx: number[] = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const sum = sPlusDM[i] + sMinusDM[i];
    dx[i] = sum === 0 ? 0 : (Math.abs(sPlusDM[i] - sMinusDM[i]) / sum) * 100;
  }

  // ADX = smoothed DX
  let adxSum = 0;
  const startIdx = period * 2;
  for (let i = period + 1; i <= startIdx; i++) adxSum += dx[i];
  adxResult[startIdx] = adxSum / period;
  for (let i = startIdx + 1; i < len; i++) {
    adxResult[i] = (adxResult[i - 1] * (period - 1) + dx[i]) / period;
  }

  return { adx: adxResult, dmiPlus: dmiPlusResult, dmiMinus: dmiMinusResult };
}

// ─── Parabolic SAR (full array) ────────────────────────────────────────────────
function sarArray(highs: number[], lows: number[], closes: number[]): number[] {
  const len = closes.length;
  const result: number[] = new Array(len).fill(0);
  if (len < 2) return result;

  let isLong = closes[1] > closes[0];
  let af = 0.02;
  let ep = isLong ? highs[1] : lows[1];
  result[0] = lows[0];
  result[1] = isLong ? lows[0] : highs[0];

  for (let i = 2; i < len; i++) {
    result[i] = result[i - 1] + af * (ep - result[i - 1]);

    if (isLong) {
      if (lows[i] < result[i]) {
        isLong = false;
        result[i] = ep;
        ep = lows[i];
        af = 0.02;
      } else {
        if (highs[i] > ep) {
          ep = highs[i];
          af = Math.min(af + 0.02, 0.2);
        }
      }
    } else {
      if (highs[i] > result[i]) {
        isLong = true;
        result[i] = ep;
        ep = highs[i];
        af = 0.02;
      } else {
        if (lows[i] < ep) {
          ep = lows[i];
          af = Math.min(af + 0.02, 0.2);
        }
      }
    }
  }
  return result;
}

// ─── Awesome Oscillator ────────────────────────────────────────────────────────
function awesomeOscArray(highs: number[], lows: number[]): number[] {
  const len = highs.length;
  const median = new Array(len).fill(0);
  for (let i = 0; i < len; i++) median[i] = (highs[i] + lows[i]) / 2;
  const sma5 = smaArray(median, 5);
  const sma34 = smaArray(median, 34);
  const result: number[] = new Array(len).fill(0);
  for (let i = 0; i < len; i++) result[i] = sma5[i] - sma34[i];
  return result;
}

// ─── Fisher Transform ──────────────────────────────────────────────────────────
function fisherTransformArray(highs: number[], lows: number[], period: number = 9): number[] {
  const result: number[] = new Array(highs.length).fill(0);
  if (highs.length < period) return result;

  for (let i = period - 1; i < highs.length; i++) {
    let maxH = -Infinity,
      minL = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > maxH) maxH = highs[j];
      if (lows[j] < minL) minL = lows[j];
    }
    const range = maxH - minL;
    if (range === 0) {
      result[i] = 0;
      continue;
    }
    const raw = ((highs[i] + lows[i]) / 2 - minL) / range;
    const x = Math.max(-0.999, Math.min(0.999, 2 * raw - 1));
    result[i] = 0.5 * Math.log((1 + x) / (1 - x));
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: VOLATILITY
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ATR (full array) ──────────────────────────────────────────────────────────
function atrArray(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const len = closes.length;
  const tr: number[] = new Array(len).fill(0);
  const result: number[] = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
  }

  if (len < period + 1) return result;

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  result[period] = sum / period;
  for (let i = period + 1; i < len; i++) {
    result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
  }
  return result;
}

// ─── Bollinger Bands (full array) ──────────────────────────────────────────────
function bollingerArray(
  closes: number[],
  period: number = 20,
  mult: number = 2,
): { upper: number[]; middle: number[]; lower: number[]; width: number[] } {
  const middle = smaArray(closes, period);
  const upper: number[] = new Array(closes.length).fill(0);
  const lower: number[] = new Array(closes.length).fill(0);
  const width: number[] = new Array(closes.length).fill(0);

  for (let i = period - 1; i < closes.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (closes[j] - middle[i]) ** 2;
    }
    const stdDev = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + mult * stdDev;
    lower[i] = middle[i] - mult * stdDev;
    width[i] = middle[i] === 0 ? 0 : ((upper[i] - lower[i]) / middle[i]) * 100;
  }
  return { upper, middle, lower, width };
}

// ─── Keltner Channels ───────────────────────────────────────────────────────────
function keltnerArray(
  closes: number[],
  highs: number[],
  lows: number[],
  emaPeriod: number = 20,
  atrPeriod: number = 20,
  mult: number = 2,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = emaArray(closes, emaPeriod);
  const atr = atrArray(highs, lows, closes, atrPeriod);
  const upper: number[] = new Array(closes.length).fill(0);
  const lower: number[] = new Array(closes.length).fill(0);
  for (let i = 0; i < closes.length; i++) {
    upper[i] = middle[i] + mult * atr[i];
    lower[i] = middle[i] - mult * atr[i];
  }
  return { upper, middle, lower };
}

// ─── Envelopes ──────────────────────────────────────────────────────────────────
function envelopeArray(
  closes: number[],
  period: number = 20,
  pct: number = 2.5,
): { upper: number[]; lower: number[] } {
  const middle = smaArray(closes, period);
  const upper: number[] = new Array(closes.length).fill(0);
  const lower: number[] = new Array(closes.length).fill(0);
  const factorUp = 1 + pct / 100;
  const factorDn = 1 - pct / 100;
  for (let i = 0; i < closes.length; i++) {
    upper[i] = middle[i] * factorUp;
    lower[i] = middle[i] * factorDn;
  }
  return { upper, lower };
}

// ─── Historical Volatility (annualized) ────────────────────────────────────────
function histVolatilityArray(closes: number[], period: number = 20): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  if (closes.length < period + 1) return result;

  const logReturns: number[] = new Array(closes.length).fill(0);
  for (let i = 1; i < closes.length; i++) {
    logReturns[i] = closes[i - 1] === 0 ? 0 : Math.log(closes[i] / closes[i - 1]);
  }

  for (let i = period; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += logReturns[j];
    const mean = sum / period;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (logReturns[j] - mean) ** 2;
    result[i] = Math.sqrt(sumSq / period) * Math.sqrt(252);
  }
  return result;
}

// ─── Standard Deviation ─────────────────────────────────────────────────────────
function stdDevArray(closes: number[], period: number = 20): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  const sma = smaArray(closes, period);
  for (let i = period - 1; i < closes.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (closes[j] - sma[i]) ** 2;
    }
    result[i] = Math.sqrt(sumSq / period);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: VOLUME INDICATORS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── OBV — On Balance Volume ────────────────────────────────────────────────────
function obvArray(closes: number[], volumes: number[]): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  if (closes.length === 0) return result;
  result[0] = volumes[0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) result[i] = result[i - 1] + volumes[i];
    else if (closes[i] < closes[i - 1]) result[i] = result[i - 1] - volumes[i];
    else result[i] = result[i - 1];
  }
  return result;
}

// ─── VPT — Volume Price Trend ──────────────────────────────────────────────────
function vptArray(closes: number[], volumes: number[]): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  for (let i = 1; i < closes.length; i++) {
    const pctChange = closes[i - 1] === 0 ? 0 : (closes[i] - closes[i - 1]) / closes[i - 1];
    result[i] = result[i - 1] + volumes[i] * pctChange;
  }
  return result;
}

// ─── VOSC — Volume Oscillator ──────────────────────────────────────────────────
function voscArray(volumes: number[], shortP: number = 12, longP: number = 26): number[] {
  const smaShort = smaArray(volumes, shortP);
  const smaLong = smaArray(volumes, longP);
  const result: number[] = new Array(volumes.length).fill(0);
  for (let i = 0; i < volumes.length; i++) {
    result[i] = smaLong[i] === 0 ? 0 : ((smaShort[i] - smaLong[i]) / smaLong[i]) * 100;
  }
  return result;
}

// ─── Chaikin A/D Line ──────────────────────────────────────────────────────────
function chaikinADArray(highs: number[], lows: number[], closes: number[], volumes: number[]): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  for (let i = 0; i < closes.length; i++) {
    const range = highs[i] - lows[i];
    const clv = range === 0 ? 0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
    result[i] = (i === 0 ? 0 : result[i - 1]) + clv * volumes[i];
  }
  return result;
}

// ─── Force Index (EMA-smoothed) ────────────────────────────────────────────────
function forceIndexArray(closes: number[], volumes: number[], period: number = 13): number[] {
  const len = closes.length;
  const result: number[] = new Array(len).fill(0);
  if (len < 2) return result;
  const raw = new Array(len).fill(0);
  for (let i = 1; i < len; i++) raw[i] = (closes[i] - closes[i - 1]) * volumes[i];
  const smoothed = emaArray(raw, period);
  return smoothed;
}

// ─── VAP — Volume at Price (simplified: rolling VWAP using typical price) ──────
function vapArray(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 20): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  if (closes.length < period) return result;
  for (let i = period - 1; i < closes.length; i++) {
    let pvSum = 0;
    let vSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const tp = (highs[j] + lows[j] + closes[j]) / 3;
      pvSum += tp * volumes[j];
      vSum += volumes[j];
    }
    result[i] = vSum === 0 ? 0 : pvSum / vSum;
  }
  return result;
}

// ─── VWAP — Volume Weighted Average Price (cumulative) ─────────────────────────
function vwapArray(highs: number[], lows: number[], closes: number[], volumes: number[]): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  if (closes.length === 0) return result;
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += tp * volumes[i];
    cumV += volumes[i];
    result[i] = cumV === 0 ? 0 : cumPV / cumV;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: Compute all indicators per day
// ═══════════════════════════════════════════════════════════════════════════════

export function computeDailyIndicators(candles: OHLCV[]): DailyIndicators[] {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const opens = candles.map((c) => c.open);
  const volumes = candles.map((c) => c.volume);

  // Volume-aware check
  const hasVolume = candles.length > 0 && candles.every((c) => c.volume > 0);

  // ── Moving Averages ──
  const ma10Arr = smaArray(closes, 10);
  const ma21Arr = smaArray(closes, 21);
  const ma50Arr = smaArray(closes, 50);
  const ma100Arr = smaArray(closes, 100);
  const ma200Arr = smaArray(closes, 200);
  const ema9Arr = emaArray(closes, 9);
  const ema12Arr = emaArray(closes, 12);
  const ema26Arr = emaArray(closes, 26);
  const wma20Arr = wmaArray(closes, 20);
  const hma20Arr = hmaArray(closes, 20);
  const tma20Arr = tmaArray(closes, 20);
  const lma20Arr = lmaArray(closes, 20);
  const vwma20Arr = hasVolume ? vwmaArray(closes, volumes, 20) : new Array(closes.length).fill(0);

  // ── Ichimoku Cloud ──
  const ich = ichimokuArray(highs, lows, 9, 26, 52);

  // ── Heiken Ashi ──
  const ha = heikenAshiArray(opens, highs, lows, closes);

  // ── Oscillators ──
  const rsiArr = rsiArray(closes, 14);
  const stoch = stochasticArray(highs, lows, closes, 14, 3);
  const stochRsi = stochRsiArray(closes, 14, 14, 3);
  const williamsRArr = williamsRArray(highs, lows, closes, 14);
  const momentumArr = momentumArray(closes, 10);
  const rocArr = rocArray(closes, 12);
  const trixArr = trixArray(closes, 9);
  const cciArr = cciArray(highs, lows, closes, 20);
  const mfiArr = hasVolume ? mfiArray(highs, lows, closes, volumes, 14) : new Array(closes.length).fill(0);
  const macd = macdArray(closes, 12, 26, 9);
  const adxData = adxArray(highs, lows, closes, 14);
  const sarArr = sarArray(highs, lows, closes);
  const awesomeOscArr = awesomeOscArray(highs, lows);
  const fisherArr = fisherTransformArray(highs, lows, 9);

  // ── Volatility ──
  const atrArr = atrArray(highs, lows, closes, 14);
  const bb = bollingerArray(closes, 20, 2);
  const kc = keltnerArray(closes, highs, lows, 20, 20, 2);
  const env = envelopeArray(closes, 20, 2.5);
  const histVolArr = histVolatilityArray(closes, 20);
  const stdDevArr = stdDevArray(closes, 20);

  // ── Volume ──
  const obvArr = hasVolume ? obvArray(closes, volumes) : new Array(closes.length).fill(0);
  const vptArr = hasVolume ? vptArray(closes, volumes) : new Array(closes.length).fill(0);
  const voscArr = hasVolume ? voscArray(volumes, 12, 26) : new Array(closes.length).fill(0);
  const chaikinADArr = hasVolume ? chaikinADArray(highs, lows, closes, volumes) : new Array(closes.length).fill(0);
  const forceIndexArr = hasVolume ? forceIndexArray(closes, volumes, 13) : new Array(closes.length).fill(0);
  const vapArr = hasVolume ? vapArray(highs, lows, closes, volumes, 20) : new Array(closes.length).fill(0);
  const vwapArr = hasVolume ? vwapArray(highs, lows, closes, volumes) : new Array(closes.length).fill(0);

  // ── Map to output ──
  return candles.map((c, i) => ({
    date: c.date,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    hasVolume,

    // Trend: Moving Averages
    ma10: r0(ma10Arr[i]),
    ma21: r0(ma21Arr[i]),
    ma50: r0(ma50Arr[i]),
    ma100: r0(ma100Arr[i]),
    ma200: r0(ma200Arr[i]),
    ema9: r0(ema9Arr[i]),
    ema12: r0(ema12Arr[i]),
    ema26: r0(ema26Arr[i]),
    vwma20: r0(vwma20Arr[i]),
    wma20: r0(wma20Arr[i]),
    hma20: r0(hma20Arr[i]),
    tma20: r0(tma20Arr[i]),
    lma20: r0(lma20Arr[i]),

    // Trend: Ichimoku Cloud
    ichimokuTenkan: r0(ich.tenkan[i]),
    ichimokuKijun: r0(ich.kijun[i]),
    ichimokuSenkouA: r0(ich.senkouA[i]),
    ichimokuSenkouB: r0(ich.senkouB[i]),

    // Trend: Heiken Ashi
    haOpen: r0(ha.haOpen[i]),
    haHigh: r0(ha.haHigh[i]),
    haLow: r0(ha.haLow[i]),
    haClose: r0(ha.haClose[i]),

    // Oscillators
    rsi: r1(rsiArr[i]),
    stochK: r1(stoch.k[i]),
    stochD: r1(stoch.d[i]),
    stochRsiK: r1(stochRsi.k[i]),
    stochRsiD: r1(stochRsi.d[i]),
    williamsR: r1(williamsRArr[i]),
    momentum: r2(momentumArr[i]),
    roc: r2(rocArr[i]),
    trix: r4(trixArr[i]),
    cci: r1(cciArr[i]),
    mfi: r1(mfiArr[i]),
    macd: r2(macd.line[i]),
    macdSignal: r2(macd.signalArr[i]),
    macdHist: r2(macd.histogram[i]),
    adx: r1(adxData.adx[i]),
    dmiPlus: r1(adxData.dmiPlus[i]),
    dmiMinus: r1(adxData.dmiMinus[i]),
    sar: r0(sarArr[i]),
    awesomeOsc: r2(awesomeOscArr[i]),
    fisherTransform: r2(fisherArr[i]),

    // Volatility
    atr: r0(atrArr[i]),
    bbUpper: r0(bb.upper[i]),
    bbMiddle: r0(bb.middle[i]),
    bbLower: r0(bb.lower[i]),
    bbWidth: r2(bb.width[i]),
    kcUpper: r0(kc.upper[i]),
    kcMiddle: r0(kc.middle[i]),
    kcLower: r0(kc.lower[i]),
    envUpper: r0(env.upper[i]),
    envLower: r0(env.lower[i]),
    histVolatility: r4(histVolArr[i]),
    stdDev20: r2(stdDevArr[i]),

    // Volume
    obv: r0(obvArr[i]),
    vpt: r2(vptArr[i]),
    vosc: r2(voscArr[i]),
    chaikinAD: r2(chaikinADArr[i]),
    forceIndex: r2(forceIndexArr[i]),
    vap: r0(vapArr[i]),
    vwap: r0(vwapArr[i]),
  }));
}
