// ═══════════════════════════════════════════════════════════════════════════════
// Regime Detection Engine — Pure TypeScript
// Replaces GNN + HMM + Transformer Classifier with rule-based + Markov + weighted voting
// ═══════════════════════════════════════════════════════════════════════════════
// Components:
//   1. Rule-Based Regime (replaces GNN) — ADX, RSI, BB, MA slope → fuzzy score
//   2. Simple Markov Chain (replaces HMM) — 5 states, dynamic transition matrix
//   3. Adaptive Weighted Voting (replaces Transformer) — indicator ensemble
// ═══════════════════════════════════════════════════════════════════════════════

import type { OHLCV } from './ta-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type RegimeState = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'VOLATILE' | 'BREAKOUT';

export interface RegimeResult {
  /** Primary regime classification */
  regime: RegimeState;
  /** Confidence 0-1 */
  confidence: number;
  /** Per-state fuzzy membership scores (sum ≈ 1) */
  memberships: Record<RegimeState, number>;
  /** Markov chain posterior probabilities */
  markovPosteriors: Record<RegimeState, number>;
  /** Weighted voting result */
  voteResult: { signal: number; weights: Record<string, number> };
  /** Human-readable description (Persian) */
  description: string;
}

export interface RuleBasedRegimeInput {
  adx: number;
  diPlus: number;
  diMinus: number;
  rsi: number;
  price: number;
  bbUpper: number;
  bbLower: number;
  bbMiddle: number;
  ema20: number;
  ema50: number;
  atr: number;
  /** Slope of EMA20 (price change per bar) */
  ema20Slope: number;
  /** Average price for angle normalization */
  avgPrice: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. RULE-BASED REGIME DETECTION (Replaces GNN)
// ═══════════════════════════════════════════════════════════════════════════════
// Uses fuzzy logic on classic indicators instead of Graph Neural Network.
// Each regime gets a membership score from fuzzy intersection of conditions.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Triangular membership function: peaks at `center`, width `halfWidth` on each side */
function trimf(x: number, center: number, halfWidth: number): number {
  return clamp01(1 - Math.abs(x - center) / halfWidth);
}

/** Trapezoidal membership function */
function trapmf(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

/**
 * Calculate fuzzy regime memberships from indicator values.
 * Returns a score 0-1 for each of the 5 regimes.
 */
export function fuzzyRegimeDetector(input: RuleBasedRegimeInput): Record<RegimeState, number> {
  const { adx, diPlus, diMinus, rsi, price, bbUpper, bbLower, bbMiddle, ema20Slope, avgPrice, atr } = input;

  // ── ADX fuzzy sets ──
  const adxWeak = trapmf(adx, 0, 0, 15, 25);      // weak trend
  const adxModerate = trimf(adx, 25, 15);            // moderate trend
  const adxStrong = trapmf(adx, 25, 35, 100, 100);  // strong trend

  // ── DI direction ──
  const diDiff = diPlus - diMinus;
  const bullishDI = clamp01(diDiff / 20);  // >0 → bullish
  const bearishDI = clamp01(-diDiff / 20); // >0 → bearish

  // ── RSI fuzzy sets ──
  const rsiOversold = trapmf(rsi, 0, 0, 25, 35);
  const rsiNeutral = trimf(rsi, 50, 20);
  const rsiOverbought = trapmf(rsi, 65, 75, 100, 100);

  // ── Bollinger Band position ──
  const bbRange = bbUpper - bbLower;
  const bbPos = bbRange > 0 ? clamp01((price - bbLower) / bbRange) : 0.5; // 0=lower, 1=upper
  const nearUpperBB = trapmf(bbPos, 0.7, 0.85, 1.0, 1.0);
  const nearLowerBB = trapmf(bbPos, 0.0, 0.0, 0.15, 0.3);

  // ── Volatility (ATR/Price) ──
  const volRatio = atr / Math.max(avgPrice, 1);
  const lowVol = trapmf(volRatio, 0, 0, 0.01, 0.025);
  const highVol = trapmf(volRatio, 0.02, 0.04, 1, 1);

  // ── EMA20 slope angle ──
  const slopeAngle = Math.atan((ema20Slope / Math.max(avgPrice, 1)) * 100) * (180 / Math.PI);
  const steepUp = trapmf(slopeAngle, 10, 20, 90, 90);
  const steepDown = trapmf(slopeAngle, -90, -90, -20, -10);
  const flat = trimf(slopeAngle, 0, 15);

  // ── Fuzzy rules for each regime ──
  // TRENDING_UP: strong ADX + bullish DI + (steep up slope OR overbought RSI)
  const trendingUp = Math.min(
    adxStrong,
    bullishDI,
    Math.max(steepUp, rsiOverbought * 0.6, nearUpperBB * 0.5)
  );

  // TRENDING_DOWN: strong ADX + bearish DI + (steep down slope OR oversold RSI)
  const trendingDown = Math.min(
    adxStrong,
    bearishDI,
    Math.max(steepDown, rsiOversold * 0.6, nearLowerBB * 0.5)
  );

  // RANGING: weak ADX + flat slope + neutral RSI + low volatility
  const ranging = Math.min(
    Math.max(adxWeak, adxModerate * 0.5),
    Math.max(flat, rsiNeutral * 0.7),
    Math.max(lowVol, 1 - adxStrong)
  );

  // VOLATILE: high volatility + moderate/strong ADX + conflicting DI
  const volatile = Math.min(
    highVol,
    Math.max(adxModerate, adxStrong * 0.5),
    1 - Math.max(bullishDI, bearishDI) // conflicting signals
  );

  // BREAKOUT: moderate→strong ADX + expanding BB (volatility surge) + DI decisive
  const breakout = Math.min(
    Math.max(adxModerate, adxStrong * 0.7),
    highVol * 0.5 + Math.abs(diDiff) / 40,
    Math.max(bullishDI, bearishDI) * 0.7
  );

  // Normalize to sum = 1
  const raw = { TRENDING_UP: trendingUp, TRENDING_DOWN: trendingDown, RANGING: ranging, VOLATILE: volatile, BREAKOUT: breakout };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);

  if (sum < 0.001) {
    // Default: ranging if no signal
    return { TRENDING_UP: 0.1, TRENDING_DOWN: 0.1, RANGING: 0.6, VOLATILE: 0.1, BREAKOUT: 0.1 };
  }

  const memberships: Record<RegimeState, number> = {
    TRENDING_UP: raw.TRENDING_UP / sum,
    TRENDING_DOWN: raw.TRENDING_DOWN / sum,
    RANGING: raw.RANGING / sum,
    VOLATILE: raw.VOLATILE / sum,
    BREAKOUT: raw.BREAKOUT / sum,
  };

  return memberships;
}

/**
 * Calculate trend strength using ADX, EMA slope, and BB position.
 * Replaces GNN-based trend strength with rule-based approach.
 */
export function calculateTrendStrengthRB(input: RuleBasedRegimeInput): number {
  const { adx, ema20Slope, avgPrice, price, bbUpper, bbLower } = input;

  // ADX component (0-1)
  const adxScore = clamp01(adx / 50);

  // Slope component: angle of EMA20
  const angle = Math.atan((ema20Slope / Math.max(avgPrice, 1)) * 100) * (180 / Math.PI);
  const slopeScore = clamp01(Math.abs(angle) / 45);

  // BB position: how far price is from middle
  const bbRange = bbUpper - bbLower;
  const bbPos = bbRange > 0 ? Math.abs((price - (bbUpper + bbLower) / 2) / bbRange) : 0;
  const bbScore = clamp01(bbPos);

  // Weighted combination
  return clamp01(adxScore * 0.4 + slopeScore * 0.35 + bbScore * 0.25);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SIMPLE MARKOV CHAIN (Replaces HMM)
// ═══════════════════════════════════════════════════════════════════════════════
// 5 states: TRENDING_UP, TRENDING_DOWN, RANGING, VOLATILE, BREAKOUT
// Transition matrix updated dynamically based on ATR changes and breakout events.

const REGIME_STATES: RegimeState[] = ['TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'VOLATILE', 'BREAKOUT'];
const STATE_INDEX: Record<RegimeState, number> = {
  TRENDING_UP: 0, TRENDING_DOWN: 1, RANGING: 2, VOLATILE: 3, BREAKOUT: 4,
};

export interface MarkovChain {
  /** 5×5 transition matrix. T[i][j] = P(state_j | state_i) */
  transitionMatrix: number[][];
  /** Current state probabilities (posterior) */
  currentState: number[];
  /** Last known state */
  lastState: RegimeState;
}

/** Create a default Markov chain with sensible priors */
export function createMarkovChain(): MarkovChain {
  // Prior transition matrix: strong self-transitions, reasonable cross-transitions
  const T: number[][] = [
    // TO:  UP      DOWN    RANGE   VOLAT   BREAK
    /* FROM UP    */ [0.65, 0.05, 0.15, 0.05, 0.10],
    /* FROM DOWN  */ [0.05, 0.65, 0.15, 0.05, 0.10],
    /* FROM RANGE */ [0.15, 0.15, 0.50, 0.10, 0.10],
    /* FROM VOLAT */ [0.10, 0.10, 0.15, 0.45, 0.20],
    /* FROM BREAK */ [0.25, 0.25, 0.10, 0.15, 0.25],
  ];

  return {
    transitionMatrix: T,
    currentState: [0.2, 0.2, 0.2, 0.2, 0.2], // uniform prior
    lastState: 'RANGING',
  };
}

/**
 * Update the transition matrix based on recent market conditions.
 * Higher ATR → more transitions to VOLATILE/BREAKOUT.
 * Breakout detected → boost BREAKOUT transition probabilities.
 */
export function updateRegimeTransition(
  chain: MarkovChain,
  atr: number,
  prevAtr: number,
  price: number,
  prevPrice: number,
  adx: number,
): void {
  const T = chain.transitionMatrix;

  // ATR ratio: how much volatility changed
  const atrRatio = prevAtr > 0 ? atr / prevAtr : 1;
  const volatilitySurge = Math.max(0, atrRatio - 1); // >0 means volatility increasing

  // Price change ratio
  const priceChange = prevPrice > 0 ? (price - prevPrice) / prevPrice : 0;
  const isBreakout = Math.abs(priceChange) > 0.03 && adx > 25; // 3% move + strong trend

  // ── Adjust transition probabilities ──
  // When volatility surges, increase probability of transitioning to VOLATILE/BREAKOUT
  if (volatilitySurge > 0.2) {
    const boost = clamp01(volatilitySurge - 0.2) * 0.15;
    for (let i = 0; i < 5; i++) {
      T[i][3] += boost;  // → VOLATILE
      T[i][4] += boost;  // → BREAKOUT
    }
  }

  // When a breakout is detected, boost transitions from current state to BREAKOUT
  if (isBreakout) {
    const fromIdx = STATE_INDEX[chain.lastState];
    T[fromIdx][4] += 0.2; // → BREAKOUT
  }

  // When ATR is decreasing, boost self-transitions (market stabilizing)
  if (atrRatio < 0.9) {
    for (let i = 0; i < 5; i++) {
      T[i][i] += 0.1;
    }
  }

  // ── Renormalize each row to sum = 1 ──
  for (let i = 0; i < 5; i++) {
    const rowSum = T[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < 5; j++) {
        T[i][j] = Math.max(0.01, T[i][j] / rowSum);
      }
    }
    // Final normalization
    const finalSum = T[i].reduce((a, b) => a + b, 0);
    for (let j = 0; j < 5; j++) {
      T[i][j] /= finalSum;
    }
  }
}

/**
 * Propagate the Markov chain: compute posterior = prior × transitionMatrix
 * Then incorporate the fuzzy memberships as observation likelihood (Bayes update).
 */
export function propagateMarkov(
  chain: MarkovChain,
  memberships: Record<RegimeState, number>,
): Record<RegimeState, number> {
  const T = chain.transitionMatrix;
  const prior = chain.currentState;

  // Step 1: Forward propagation (prediction) — prior × T
  const predicted: number[] = Array(5).fill(0);
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 5; i++) {
      predicted[j] += prior[i] * T[i][j];
    }
  }

  // Step 2: Bayes update with fuzzy memberships as observation likelihood
  const likelihood: number[] = REGIME_STATES.map(s => memberships[s]);
  let posterior: number[] = predicted.map((p, i) => p * likelihood[i]);

  // Normalize
  const sum = posterior.reduce((a, b) => a + b, 0);
  if (sum > 0) {
    posterior = posterior.map(p => p / sum);
  } else {
    posterior = predicted; // fallback to prediction if likelihood is zero
  }

  // Update chain state
  chain.currentState = posterior;
  chain.lastState = REGIME_STATES[posterior.indexOf(Math.max(...posterior))];

  const result: Record<RegimeState, number> = {
    TRENDING_UP: posterior[0],
    TRENDING_DOWN: posterior[1],
    RANGING: posterior[2],
    VOLATILE: posterior[3],
    BREAKOUT: posterior[4],
  };
  return result;
}

/**
 * Get current Markov regime (highest posterior probability state).
 */
export function getMarkovRegime(chain: MarkovChain): { regime: RegimeState; confidence: number } {
  const maxIdx = chain.currentState.indexOf(Math.max(...chain.currentState));
  return {
    regime: REGIME_STATES[maxIdx],
    confidence: chain.currentState[maxIdx],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ADAPTIVE WEIGHTED VOTING (Replaces Transformer Classifier)
// ═══════════════════════════════════════════════════════════════════════════════
// Each indicator votes -1 (bearish), 0 (neutral), +1 (bullish).
// Weights adapt based on recent prediction accuracy.

export interface IndicatorVote {
  name: string;
  signal: number;  // -1, 0, or +1
  weight: number;
}

export interface VotingWeights {
  macd: number;
  stochastic: number;
  rsi: number;
  obv: number;
  mfi: number;
  adx: number;
  bb: number;
}

const DEFAULT_VOTING_WEIGHTS: VotingWeights = {
  macd: 1.0,
  stochastic: 1.0,
  rsi: 1.0,
  obv: 1.0,
  mfi: 1.0,
  adx: 1.0,
  bb: 1.0,
};

/**
 * Generate signal (-1, 0, +1) for each indicator based on current values.
 */
export function indicatorSignals(input: {
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  stochK: number;
  stochD: number;
  rsi: number;
  obv: number;
  obvPrev: number;
  mfi: number;
  adx: number;
  diPlus: number;
  diMinus: number;
  price: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
}): IndicatorVote[] {
  const v = input;

  // MACD signal
  const macdSignal = v.macdHist > 0 && v.macdLine > v.macdSignal ? 1
    : v.macdHist < 0 && v.macdLine < v.macdSignal ? -1 : 0;

  // Stochastic signal
  const stochSignal = v.stochK > 80 ? -1    // overbought → bearish
    : v.stochK < 20 ? 1                       // oversold → bullish
    : v.stochK > v.stochD ? 1                 // K > D → bullish momentum
    : v.stochK < v.stochD ? -1 : 0;

  // RSI signal
  const rsiSignal = v.rsi > 70 ? -1          // overbought
    : v.rsi < 30 ? 1                          // oversold
    : v.rsi > 55 ? 1                          // slight bullish
    : v.rsi < 45 ? -1 : 0;                    // slight bearish

  // OBV signal
  const obvSignal = v.obv > v.obvPrev ? 1
    : v.obv < v.obvPrev ? -1 : 0;

  // MFI signal
  const mfiSignal = v.mfi > 80 ? -1          // overbought
    : v.mfi < 20 ? 1                          // oversold
    : v.mfi > 55 ? 1
    : v.mfi < 45 ? -1 : 0;

  // ADX/DI signal
  const adxSignal = v.adx > 20
    ? (v.diPlus > v.diMinus ? 1 : v.diMinus > v.diPlus ? -1 : 0)
    : 0; // no trend signal if ADX < 20

  // BB signal
  const bbRange = v.bbUpper - v.bbLower;
  const bbPos = bbRange > 0 ? (v.price - v.bbLower) / bbRange : 0.5;
  const bbSignal = bbPos > 0.9 ? -1          // near upper → likely reversal
    : bbPos < 0.1 ? 1                          // near lower → likely bounce
    : bbPos > 0.65 ? -0.5
    : bbPos < 0.35 ? 0.5 : 0;

  return [
    { name: 'macd', signal: macdSignal, weight: DEFAULT_VOTING_WEIGHTS.macd },
    { name: 'stochastic', signal: stochSignal, weight: DEFAULT_VOTING_WEIGHTS.stochastic },
    { name: 'rsi', signal: rsiSignal, weight: DEFAULT_VOTING_WEIGHTS.rsi },
    { name: 'obv', signal: obvSignal, weight: DEFAULT_VOTING_WEIGHTS.obv },
    { name: 'mfi', signal: mfiSignal, weight: DEFAULT_VOTING_WEIGHTS.mfi },
    { name: 'adx', signal: adxSignal, weight: DEFAULT_VOTING_WEIGHTS.adx },
    { name: 'bb', signal: bbSignal, weight: DEFAULT_VOTING_WEIGHTS.bb },
  ];
}

/**
 * Adaptive weighted voting: combine indicator signals with adaptive weights.
 * Weights are reduced for indicators that made wrong predictions recently.
 */
export function adaptiveWeightedVote(
  votes: IndicatorVote[],
  weights: VotingWeights,
): { signal: number; weights: Record<string, number> } {
  let totalWeightedSignal = 0;
  let totalWeight = 0;
  const usedWeights: Record<string, number> = {};

  for (const vote of votes) {
    const w = weights[vote.name as keyof VotingWeights] ?? 1;
    const effectiveWeight = w * Math.abs(vote.signal); // neutral votes contribute 0
    totalWeightedSignal += vote.signal * w;
    totalWeight += effectiveWeight;
    usedWeights[vote.name] = w;
  }

  // Normalize signal to [-1, +1]
  const signal = totalWeight > 0 ? clamp01(totalWeightedSignal / totalWeight) * Math.sign(totalWeightedSignal) : 0;

  return { signal, weights: usedWeights };
}

/**
 * Decay weights of indicators that made wrong predictions.
 * Error rate 0.05 per wrong prediction, clamped to [0.1, 2.0].
 */
export function decayWeightsFromError(
  weights: VotingWeights,
  indicatorName: string,
  wasCorrect: boolean,
  decayRate: number = 0.05,
): VotingWeights {
  const newWeights = { ...weights };
  const key = indicatorName as keyof VotingWeights;
  if (key in newWeights) {
    if (wasCorrect) {
      // Reward: slightly increase weight (max 2.0)
      newWeights[key] = Math.min(2.0, newWeights[key] * (1 + decayRate * 0.5));
    } else {
      // Penalize: decrease weight (min 0.1)
      newWeights[key] = Math.max(0.1, newWeights[key] * (1 - decayRate));
    }
  }
  return newWeights;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. UNIFIED REGIME DETECTION
// ═══════════════════════════════════════════════════════════════════════════════
// Combines all three methods: fuzzy rule-based, Markov chain, and weighted voting.

// Singleton Markov chain for runtime persistence
let globalMarkovChain: MarkovChain | null = null;
let globalVotingWeights: VotingWeights = { ...DEFAULT_VOTING_WEIGHTS };

export function resetRegimeEngine(): void {
  globalMarkovChain = null;
  globalVotingWeights = { ...DEFAULT_VOTING_WEIGHTS };
}

/**
 * Main entry point: detect current market regime using all three methods.
 *
 * @param data - OHLCV data (at least 50 bars recommended)
 * @param indicators - pre-computed indicator values from ta-engine
 * @returns RegimeResult with all component outputs
 */
export function detectRegime(
  data: OHLCV[],
  indicators: {
    adx: number; diPlus: number; diMinus: number;
    rsi: number; mfi: number;
    macdLine: number; macdSignal: number; macdHist: number;
    stochK: number; stochD: number;
    obv: number; atr: number;
    bbUpper: number; bbMiddle: number; bbLower: number;
    ema20: number; ema50: number;
    price: number;
  },
): RegimeResult {
  const price = indicators.price;
  const closes = data.map(d => d.close);
  const avgPrice = closes.length > 0 ? closes.reduce((a, b) => a + b, 0) / closes.length : price;

  // Calculate EMA20 slope
  const lookback = Math.min(5, data.length - 1);
  let ema20Slope = 0;
  if (data.length >= lookback + 1) {
    // Simple finite-difference slope
    const recent = data.slice(-lookback);
    const prevRecent = data.slice(-(lookback + 1), -1);
    if (recent.length > 0 && prevRecent.length > 0) {
      ema20Slope = (recent[recent.length - 1].close - prevRecent[0].close) / lookback;
    }
  }

  // Previous ATR for Markov update
  const prevAtr = data.length > 2 ? (data[data.length - 2].high - data[data.length - 2].low) : indicators.atr;
  const prevPrice = data.length > 1 ? data[data.length - 2].close : price;

  // ── 1. Fuzzy rule-based regime ──
  const fuzzyInput: RuleBasedRegimeInput = {
    adx: indicators.adx,
    diPlus: indicators.diPlus,
    diMinus: indicators.diMinus,
    rsi: indicators.rsi,
    price,
    bbUpper: indicators.bbUpper,
    bbLower: indicators.bbLower,
    bbMiddle: indicators.bbMiddle,
    ema20: indicators.ema20,
    ema50: indicators.ema50,
    atr: indicators.atr,
    ema20Slope,
    avgPrice,
  };

  const memberships = fuzzyRegimeDetector(fuzzyInput);

  // ── 2. Markov chain ──
  if (!globalMarkovChain) {
    globalMarkovChain = createMarkovChain();
  }

  updateRegimeTransition(globalMarkovChain, indicators.atr, prevAtr, price, prevPrice, indicators.adx);
  const markovPosteriors = propagateMarkov(globalMarkovChain, memberships);

  // ── 3. Weighted voting ──
  const obvPrev = data.length > 1
    ? data.slice(0, -1).reduce((s, d) => s + (d.close > d.open ? d.volume : d.close < d.open ? -d.volume : 0), 0)
    : indicators.obv;

  const votes = indicatorSignals({
    macdLine: indicators.macdLine,
    macdSignal: indicators.macdSignal,
    macdHist: indicators.macdHist,
    stochK: indicators.stochK,
    stochD: indicators.stochD,
    rsi: indicators.rsi,
    obv: indicators.obv,
    obvPrev,
    mfi: indicators.mfi,
    adx: indicators.adx,
    diPlus: indicators.diPlus,
    diMinus: indicators.diMinus,
    price,
    bbUpper: indicators.bbUpper,
    bbMiddle: indicators.bbMiddle,
    bbLower: indicators.bbLower,
  });

  const voteResult = adaptiveWeightedVote(votes, globalVotingWeights);

  // ── Combine: use Markov posteriors as primary, fuzzy memberships as secondary ──
  // Final score = 0.5 * markov + 0.3 * fuzzy + 0.2 * vote_direction
  const combined: Record<RegimeState, number> = {
    TRENDING_UP: 0, TRENDING_DOWN: 0, RANGING: 0, VOLATILE: 0, BREAKOUT: 0,
  };

  for (const state of REGIME_STATES) {
    combined[state] = markovPosteriors[state] * 0.5 + memberships[state] * 0.3;
  }

  // Add vote direction influence
  const voteBias = voteResult.signal; // -1 to +1
  combined.TRENDING_UP += Math.max(0, voteBias) * 0.2;
  combined.TRENDING_DOWN += Math.max(0, -voteBias) * 0.2;
  combined.RANGING += (1 - Math.abs(voteBias)) * 0.1;

  // Normalize combined scores
  const totalScore = Object.values(combined).reduce((a, b) => a + b, 0);
  if (totalScore > 0) {
    for (const state of REGIME_STATES) {
      combined[state] /= totalScore;
    }
  }

  // Determine primary regime
  let maxState: RegimeState = 'RANGING';
  let maxScore = 0;
  for (const state of REGIME_STATES) {
    if (combined[state] > maxScore) {
      maxScore = combined[state];
      maxState = state;
    }
  }

  // Confidence: how much the primary state dominates
  const confidence = maxScore;

  // Persian description
  const descriptions: Record<RegimeState, string> = {
    TRENDING_UP: 'روند صعودی',
    TRENDING_DOWN: 'روند نزولی',
    RANGING: 'رنج (خنثی)',
    VOLATILE: 'نوسانی',
    BREAKOUT: 'شکست',
  };

  return {
    regime: maxState,
    confidence,
    memberships,
    markovPosteriors,
    voteResult,
    description: descriptions[maxState],
  };
}

/**
 * Map RegimeState to MSL v4 RegimeType for compatibility.
 */
export function toMSLRegime(regime: RegimeState, confidence: number): 'Strong Bull' | 'Weak Bull' | 'Strong Bear' | 'Weak Bear' | 'Range' {
  switch (regime) {
    case 'TRENDING_UP': return confidence > 0.5 ? 'Strong Bull' : 'Weak Bull';
    case 'TRENDING_DOWN': return confidence > 0.5 ? 'Strong Bear' : 'Weak Bear';
    case 'RANGING': return 'Range';
    case 'VOLATILE': return 'Range'; // volatile is range-like
    case 'BREAKOUT': return confidence > 0.5 ? 'Strong Bull' : 'Weak Bull'; // breakout assumed bullish by default
  }
}

/**
 * Get or create the global voting weights (for adaptive updates).
 */
export function getVotingWeights(): VotingWeights {
  return { ...globalVotingWeights };
}

/**
 * Update global voting weights (called after feedback).
 */
export function setVotingWeights(weights: VotingWeights): void {
  globalVotingWeights = { ...weights };
}
