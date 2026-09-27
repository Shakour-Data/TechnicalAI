// ════════════════════════════════════════════════════════════════════════════════
// TSE Technical Analysis Indicators
// ════════════════════════════════════════════════════════════════════════════════

import { OHLCV } from './types';

/**
 * Simple Moving Average — the mean of the last `period` closing prices.
 *
 * @param closes - Array of closing prices (oldest → newest)
 * @param period - Lookback window length
 * @returns The SMA value, or 0 if insufficient data
 */
export function sma(closes: number[], period: number): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Exponential Moving Average using the standard smoothing factor k = 2/(period+1).
 * Seeded with an SMA of the first `period` values, then iterated forward.
 *
 * @param closes - Array of closing prices (oldest → newest)
 * @param period - EMA period (controls responsiveness; lower = more reactive)
 * @returns The EMA value, or 0 if insufficient data
 */
export function emaCalc(closes: number[], period: number): number {
  if (closes.length < period) return 0;
  const k = 2 / (period + 1);
  let emaVal = sma(closes.slice(0, period), period);
  for (let i = period; i < closes.length; i++) {
    emaVal = closes[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

/**
 * Relative Strength Index (Wilder's smoothed RSI).
 * Measures the magnitude of recent gains vs. losses on a 0–100 scale.
 * Values >70 suggest overbought; <30 suggest oversold.
 *
 * @param closes  - Array of closing prices (oldest → newest)
 * @param period  - RSI period (default 14)
 * @returns RSI value 0–100, or 50 (neutral) if insufficient data
 */
export function calcRSI(closes: number[], period: number = 14): number {
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

/**
 * Money Flow Index (MFI).
 * Volume-weighted RSI, measures buying/selling pressure.
 *
 * @param data    - OHLCV array (oldest → newest)
 * @param period  - MFI period (default 14)
 * @returns MFI value 0–100, or 50 (neutral) if insufficient data
 */
export function calcMFI(data: OHLCV[], period: number = 14): number {
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

/**
 * Commodity Channel Index (CCI).
 * Identifies cyclical trends in commodities, equities, currencies.
 *
 * @param data    - OHLCV array (oldest → newest)
 * @param period  - CCI period (default 20)
 * @returns CCI value; unbounded typically -100 to +100; 0 if insufficient data
 */
export function calcCCI(data: OHLCV[], period: number = 20): number {
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

/**
 * Stochastic Oscillator (%K and %D).
 * Compares the closing price to the high-low range over `kPeriod` bars,
 * then smooths %K by `smoothK` and computes %D as an SMA of smoothed %K.
 *
 * @param data    - OHLCV array (oldest → newest)
 * @param kPeriod - Lookback for raw %K (default 14)
 * @param smoothK - Smoothing period for %K (default 3)
 * @param smoothD - Smoothing period for %D (default 3)
 * @returns Object `{ k, d }` each 0–100; defaults to `{ k: 50, d: 50 }` if insufficient data
 */
export function calcStochastic(
  data: OHLCV[],
  kPeriod: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): { k: number; d: number } {
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

/**
 * Williams %R.
 * Momentum indicator measuring overbought/oversold levels.
 *
 * @param data   - OHLCV array (oldest → newest)
 * @param period - Lookback period (default 14)
 * @returns Williams %R value -100 to 0, or -50 if insufficient data
 */
export function calcWilliamsR(data: OHLCV[], period: number = 14): number {
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

/**
 * Moving Average Convergence/Divergence (MACD).
 * MACD Line = EMA(fast) − EMA(slow); Signal = EMA(sig) of MACD Line;
 * Histogram = MACD Line − Signal.
 * Crossovers of line/signal indicate momentum shifts.
 *
 * @param closes - Array of closing prices (oldest → newest)
 * @param fast   - Fast EMA period (default 12)
 * @param slow   - Slow EMA period (default 26)
 * @param sig    - Signal line EMA period (default 9)
 * @returns `{ line, signal, histogram }`; zeros if insufficient data
 */
export function calcMACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  sig: number = 9
): { line: number; signal: number; histogram: number } {
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

/**
 * Average True Range (ATR).
 * Measures market volatility by decomposing the entire range of an asset price.
 *
 * @param data    - OHLCV array (oldest → newest)
 * @param period  - ATR period (default 14)
 * @returns ATR value; 0 if insufficient data
 */
export function calcATR(data: OHLCV[], period: number = 14): number {
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