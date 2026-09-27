// ════════════════════════════════════════════════════════════════════════════════
// Core Types for Technical Analysis
// ════════════════════════════════════════════════════════════════════════════════

/** Core candlestick (OHLCV) data point used as input to all TA calculations. */
export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** A single VDss scenario outcome with probability, price targets, and description. */
export interface ScenarioResult {
  name: string;
  nameEn: string;
  probability: number;
  cumulativeProbability: number;
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
  // ── Core Indicators ──
  sma: Record<string, number>;
  ema: Record<string, number>;
  rsi: number;
  mfi: number;
  cci: number;
  stochK: number;
  stochD: number;
  macd: { line: number; signal: number; histogram: number };
  adx: { adx: number; diPlus: number; diMinus: number };
  atr: number;
  sar: number;
  bollingerBands: { upper: number; middle: number; lower: number };
  // ── Additional Indicators ──
  obv: number;
  vwap: number;
  ichimoku: {
    tenkan: number;
    kijun: number;
    senkouA: number;
    senkouB: number;
    chikou: number;
    cloudTop: number;
    cloudBottom: number;
    inCloud: boolean;
  };
  // ── Trend ──
  trend: TrendResult;
  // ── Support/Resistance ──
  supportLevels: LevelStrength[];
  resistanceLevels: LevelStrength[];
  // ── VDss 9-Scenario ──
  scenarios: ScenarioResult[];
  // ── ML Metadata ──
  regimeResult: any; // RegimeResult | null
  decisionGraph: any; // GraphData | null
  // ── Extended Indicators (24 additional indicators) ──
  extendedIndicators: {
    wma: Record<string, number>;
    hma: number;
    tma: number;
    lma: number;
    maAlignment: number;
    heikenAshi: { open: number; high: number; low: number; close: number };
    awesomeOsc: number;
    momentum: number;
    modifiedRSI: number;
    fastStochK: number;
    fisherTransform: number;
    pvo: number;
    confidenceIndex: number;
    strengthIndex: number;
    ad: number;
    vpt: number;
    vosc: number;
    chaikinAD: number;
    forceIndex: number;
    keltnerChannels: { upper: number; middle: number; lower: number };
    envelopes: { upper: number; middle: number; lower: number };
    stdDev: number;
    hv: number;
  };
  // ── Regime Detection (rule-based + Markov + weighted voting) ──
  regimeResult2: any;
}