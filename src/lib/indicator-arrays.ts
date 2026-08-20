// ═══════════════════════════════════════════════════════════════════════════════
// Per-Day Indicator Calculator — for CSV/Excel exports
// Computes each indicator for every candle (not just the final value)
// ═══════════════════════════════════════════════════════════════════════════════

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DailyIndicators {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma21: number;
  ma100: number;
  rsi: number;
  mfi: number;
  cci: number;
  adx: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  stochK: number;
  stochD: number;
  sar: number;
  atr: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
}

// ─── Simple Moving Average (full array) ───────────────────────────────────────
function smaArray(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    result[i] = sum / period;
  }
  return result;
}

// ─── RSI (full array) ─────────────────────────────────────────────────────────
function rsiArray(closes: number[], period: number = 14): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  if (closes.length < period + 1) return result;

  let gainSum = 0, lossSum = 0;
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

// ─── Stochastic (full array) ──────────────────────────────────────────────────
function stochasticArray(highs: number[], lows: number[], closes: number[], kPeriod: number = 14, dPeriod: number = 3): { k: number[]; d: number[] } {
  const kArr: number[] = new Array(closes.length).fill(0);
  const dArr: number[] = new Array(closes.length).fill(0);

  for (let i = kPeriod - 1; i < closes.length; i++) {
    let highest = -Infinity, lowest = Infinity;
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

// ─── MACD (full array) ────────────────────────────────────────────────────────
function macdArray(closes: number[], fast: number = 12, slow: number = 26, signal: number = 9): { line: number[]; signalArr: number[]; histogram: number[] } {
  const len = closes.length;
  const line: number[] = new Array(len).fill(0);
  const signalArr: number[] = new Array(len).fill(0);
  const histogram: number[] = new Array(len).fill(0);

  // EMA helper (in-place)
  const calcEma = (data: number[], period: number): number[] => {
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
  };

  const emaFast = calcEma(closes, fast);
  const emaSlow = calcEma(closes, slow);

  for (let i = 0; i < len; i++) {
    line[i] = emaFast[i] - emaSlow[i];
  }

  const macdSignalEma = calcEma(line, signal);
  for (let i = 0; i < len; i++) {
    signalArr[i] = macdSignalEma[i];
    histogram[i] = line[i] - macdSignalEma[i];
  }

  return { line, signalArr, histogram };
}

// ─── Bollinger Bands (full array) ─────────────────────────────────────────────
function bollingerArray(closes: number[], period: number = 20, mult: number = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = smaArray(closes, period);
  const upper: number[] = new Array(closes.length).fill(0);
  const lower: number[] = new Array(closes.length).fill(0);

  for (let i = period - 1; i < closes.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (closes[j] - middle[i]) ** 2;
    }
    const stdDev = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + mult * stdDev;
    lower[i] = middle[i] - mult * stdDev;
  }
  return { upper, middle, lower };
}

// ─── ATR (full array) ─────────────────────────────────────────────────────────
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

// ─── CCI (full array) ─────────────────────────────────────────────────────────
function cciArray(highs: number[], lows: number[], closes: number[], period: number = 20): number[] {
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

// ─── MFI (full array) ─────────────────────────────────────────────────────────
function mfiArray(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 14): number[] {
  const len = closes.length;
  const result: number[] = new Array(len).fill(0);

  for (let i = period; i < len; i++) {
    let posFlow = 0, negFlow = 0;
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

// ─── ADX (full array) ─────────────────────────────────────────────────────────
function adxArray(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const len = closes.length;
  const result: number[] = new Array(len).fill(0);
  if (len < period * 2 + 1) return result;

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

  // Smoothed values
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

  const atr = smooth(tr, 1);
  const sPlusDM = smooth(plusDM, 1);
  const sMinusDM = smooth(minusDM, 1);

  const dx: number[] = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const sum = sPlusDM[i] + sMinusDM[i];
    dx[i] = sum === 0 ? 0 : (Math.abs(sPlusDM[i] - sMinusDM[i]) / sum) * 100;
  }

  // ADX = smoothed DX
  let adxSum = 0;
  const startIdx = period * 2;
  for (let i = period + 1; i <= startIdx; i++) adxSum += dx[i];
  result[startIdx] = adxSum / period;
  for (let i = startIdx + 1; i < len; i++) {
    result[i] = (result[i - 1] * (period - 1) + dx[i]) / period;
  }
  return result;
}

// ─── Parabolic SAR (full array) ───────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// Main function: compute all indicators per day
// ═══════════════════════════════════════════════════════════════════════════════

export function computeDailyIndicators(candles: OHLCV[]): DailyIndicators[] {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ma21Arr = smaArray(closes, 21);
  const ma100Arr = smaArray(closes, 100);
  const rsiArr = rsiArray(closes, 14);
  const mfiArr = mfiArray(highs, lows, closes, volumes, 14);
  const cciArr = cciArray(highs, lows, closes, 20);
  const adxArr = adxArray(highs, lows, closes, 14);
  const macd = macdArray(closes, 12, 26, 9);
  const stoch = stochasticArray(highs, lows, closes, 14, 3);
  const sarArr = sarArray(highs, lows, closes);
  const atrArr = atrArray(highs, lows, closes, 14);
  const bb = bollingerArray(closes, 20, 2);

  return candles.map((c, i) => ({
    date: c.date,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    ma21: Math.round(ma21Arr[i]),
    ma100: Math.round(ma100Arr[i]),
    rsi: Math.round(rsiArr[i] * 10) / 10,
    mfi: Math.round(mfiArr[i] * 10) / 10,
    cci: Math.round(cciArr[i] * 10) / 10,
    adx: Math.round(adxArr[i] * 10) / 10,
    macd: Math.round(macd.line[i] * 10) / 10,
    macdSignal: Math.round(macd.signalArr[i] * 10) / 10,
    macdHist: Math.round(macd.histogram[i] * 10) / 10,
    stochK: Math.round(stoch.k[i] * 10) / 10,
    stochD: Math.round(stoch.d[i] * 10) / 10,
    sar: Math.round(sarArr[i]),
    atr: Math.round(atrArr[i]),
    bbUpper: Math.round(bb.upper[i]),
    bbMiddle: Math.round(bb.middle[i]),
    bbLower: Math.round(bb.lower[i]),
  }));
}
