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

/**
 * The five possible market regime states used throughout the regime detection engine.
 *
 * - `TRENDING_UP`  — Sustained upward move with strong ADX and bullish DI
 * - `TRENDING_DOWN` — Sustained downward move with strong ADX and bearish DI
 * - `RANGING`      — Low-volatility sideways market with weak ADX
 * - `VOLATILE`     — High volatility with conflicting directional signals
 * - `BREAKOUT`     — Volatility surge with decisive directional movement
 */
export type RegimeState = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'VOLATILE' | 'BREAKOUT';

/**
 * Result of the unified regime detection, combining outputs from all three
 * detection methods (fuzzy rule-based, Markov chain, and weighted voting).
 */
export interface RegimeResult {
  /** Primary regime classification — the state with the highest combined score */
  regime: RegimeState;
  /** Confidence in the primary regime, expressed as a value between 0 and 1 */
  confidence: number;
  /** Per-state fuzzy membership scores from the rule-based detector (sum ≈ 1) */
  memberships: Record<RegimeState, number>;
  /** Markov chain posterior probabilities after Bayes update (sum = 1) */
  markovPosteriors: Record<RegimeState, number>;
  /** Weighted voting result including the aggregate signal and per-indicator weights */
  voteResult: { signal: number; weights: Record<string, number> };
  /** Human-readable description of the primary regime (Persian) */
  description: string;
}

/**
 * Input indicators required by the rule-based (fuzzy) regime detector
 * and the trend-strength calculator.
 *
 * All indicator values should be pre-computed from the same OHLCV window
 * (typically 50+ bars) before being passed in.
 */
export interface RuleBasedRegimeInput {
  /** Average Directional Index — measures trend strength (0–100) */
  adx: number;
  /** Positive Directional Indicator — measures bullish directional pressure */
  diPlus: number;
  /** Negative Directional Indicator — measures bearish directional pressure */
  diMinus: number;
  /** Relative Strength Index (0–100) */
  rsi: number;
  /** Current price (typically the latest close) */
  price: number;
  /** Upper Bollinger Band */
  bbUpper: number;
  /** Lower Bollinger Band */
  bbLower: number;
  /** Middle Bollinger Band (SMA20) */
  bbMiddle: number;
  /** 20-period Exponential Moving Average */
  ema20: number;
  /** 50-period Exponential Moving Average */
  ema50: number;
  /** Average True Range — measures volatility */
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

/**
 * Triangular membership function — a fundamental fuzzy logic shape.
 *
 * Produces a value of 1 at the `center`, linearly decreasing to 0 at
 * `center ± halfWidth`. The result is clamped to [0, 1].
 *
 * @param x - The input value to evaluate
 * @param center - The peak (full membership = 1) position
 * @param halfWidth - Distance from center to where membership reaches 0
 * @returns Membership degree in [0, 1]
 *
 * @example
 * ```ts
 * trimf(25, 25, 15) // → 1.0  (at center)
 * trimf(10, 25, 15) // → 0.0  (at center - halfWidth)
 * trimf(40, 25, 15) // → 0.0  (at center + halfWidth)
 * trimf(20, 25, 15) // → 0.33 (between center and edge)
 * ```
 */
function trimf(x: number, center: number, halfWidth: number): number {
  return clamp01(1 - Math.abs(x - center) / halfWidth);
}

/**
 * Trapezoidal membership function — a fuzzy shape with a flat top.
 *
 * Returns 0 outside [a, d], ramps linearly from a→b and c→d,
 * and returns 1 across the flat top [b, c].
 *
 * @param x - The input value to evaluate
 * @param a - Left foot (membership = 0 for x ≤ a)
 * @param b - Left shoulder (membership reaches 1 at b)
 * @param c - Right shoulder (membership stays 1 until c)
 * @param d - Right foot (membership = 0 for x ≥ d)
 * @returns Membership degree in [0, 1]
 *
 * @example
 * ```ts
 * trapmf(10, 0, 0, 15, 25) // → 1.0  (on flat top [0, 15])
 * trapmf(20, 0, 0, 15, 25) // → 0.5  (on ramp [15, 25])
 * trapmf(30, 0, 0, 15, 25) // → 0.0  (past right foot)
 * ```
 */
function trapmf(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

/**
 * Calculate fuzzy regime memberships from indicator values using rule-based
 * fuzzy logic. This replaces the Graph Neural Network (GNN) classifier.
 *
 * The function applies fuzzy membership functions (triangular and trapezoidal)
 * to each indicator, then combines them via fuzzy min/max rules to produce
 * a membership score in [0, 1] for each of the 5 regime states.
 *
 * **Fuzzy rules implemented:**
 * - **TRENDING_UP**: strong ADX ∧ bullish DI ∧ (steep up slope ∨ overbought RSI ∨ near upper BB)
 * - **TRENDING_DOWN**: strong ADX ∧ bearish DI ∧ (steep down slope ∨ oversold RSI ∨ near lower BB)
 * - **RANGING**: (weak ∨ moderate ADX) ∧ (flat slope ∨ neutral RSI) ∧ (low vol ∨ ¬strong ADX)
 * - **VOLATILE**: high volatility ∧ (moderate ∨ strong ADX) ∧ conflicting DI
 * - **BREAKOUT**: (moderate ∨ strong ADX) ∧ (high vol + |DI diff|) ∧ (bullish ∨ bearish DI)
 *
 * @param input - Pre-computed indicator values conforming to {@link RuleBasedRegimeInput}
 * @returns A record mapping each {@link RegimeState} to its membership score (sum ≈ 1)
 *
 * @example
 * ```ts
 * const memberships = fuzzyRegimeDetector({
 *   adx: 35, diPlus: 28, diMinus: 12, rsi: 65,
 *   price: 105, bbUpper: 110, bbLower: 95, bbMiddle: 102.5,
 *   ema20: 103, ema50: 100, atr: 3, ema20Slope: 0.5, avgPrice: 100
 * });
 * // memberships.TRENDING_UP ≈ 0.6, memberships.RANGING ≈ 0.1, ...
 * ```
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
 * Calculate trend strength using a rule-based combination of ADX, EMA slope,
 * and Bollinger Band position. Replaces the GNN-based trend strength estimator.
 *
 * The final score is a weighted combination:
 * - ADX score (0.4 weight): `clamp(adx / 50)`
 * - Slope score (0.35 weight): `clamp(|EMA20 angle| / 45°)`
 * - BB score (0.25 weight): how far price is from the BB middle band
 *
 * @param input - Pre-computed indicator values conforming to {@link RuleBasedRegimeInput}
 * @returns Trend strength in [0, 1], where 0 = no trend, 1 = very strong trend
 *
 * @example
 * ```ts
 * const strength = calculateTrendStrengthRB({
 *   adx: 40, ema20Slope: 1.2, avgPrice: 100,
 *   price: 108, bbUpper: 110, bbLower: 95, ...otherInputs
 * });
 * // strength ≈ 0.75 (strong trend)
 * ```
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

/**
 * The five regime states in canonical order. Used as the index mapping for
 * the 5×5 Markov transition matrix rows and columns.
 *
 * Index: 0=TRENDING_UP, 1=TRENDING_DOWN, 2=RANGING, 3=VOLATILE, 4=BREAKOUT
 */
const REGIME_STATES: RegimeState[] = ['TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'VOLATILE', 'BREAKOUT'];
const STATE_INDEX: Record<RegimeState, number> = {
  TRENDING_UP: 0, TRENDING_DOWN: 1, RANGING: 2, VOLATILE: 3, BREAKOUT: 4,
};

/**
 * A simple 5-state Markov chain for regime transition modeling.
 * Replaces the Hidden Markov Model (HMM) with a fully observable chain
 * whose transition matrix is updated dynamically based on market conditions.
 *
 * The five states correspond to {@link RegimeState}:
 * `[TRENDING_UP, TRENDING_DOWN, RANGING, VOLATILE, BREAKOUT]`
 */
export interface MarkovChain {
  /** 5×5 transition matrix. T[i][j] = P(state_j | state_i). Each row sums to 1. */
  transitionMatrix: number[][];
  /** Current state probabilities (posterior after Bayes update). Sums to 1. */
  currentState: number[];
  /** Last known state — the state with the highest posterior probability */
  lastState: RegimeState;
}

/**
 * Create a default Markov chain with sensible prior transition probabilities.
 *
 * The initial transition matrix encodes domain knowledge:
 * - Strong self-transitions for trending states (0.65)
 * - Moderate self-transition for RANGING (0.50)
 * - Lower self-transition for VOLATILE (0.45) — volatile markets transition quickly
 * - BREAKOUT has low persistence (0.25) — breakouts are transient
 * - State probabilities start uniform (0.2 each)
 * - Last state defaults to `RANGING`
 *
 * @returns A new {@link MarkovChain} with default priors
 *
 * @example
 * ```ts
 * const chain = createMarkovChain();
 * // chain.transitionMatrix[0] = [0.65, 0.05, 0.15, 0.05, 0.10]
 * // chain.currentState = [0.2, 0.2, 0.2, 0.2, 0.2]
 * ```
 */
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
 * Update the Markov chain's transition matrix based on recent market conditions.
 *
 * Three adjustment rules are applied:
 * 1. **Volatility surge** (ATR ratio > 1.2): Boosts transitions to VOLATILE and BREAKOUT
 * 2. **Breakout detected** (|price change| > 3% AND ADX > 25): Boosts transition from
 *    the current state to BREAKOUT
 * 3. **Declining ATR** (ratio < 0.9): Boosts self-transitions (market stabilizing)
 *
 * After adjustments, each row is re-normalized to sum to 1, with a floor of 0.01
 * to prevent zero probabilities.
 *
 * @param chain - The Markov chain to update (mutated in place)
 * @param atr - Current Average True Range
 * @param prevAtr - Previous Average True Range (for ratio calculation)
 * @param price - Current price
 * @param prevPrice - Previous price (for breakout detection)
 * @param adx - Current ADX value (used for breakout confirmation)
 *
 * @example
 * ```ts
 * updateRegimeTransition(chain, 5.2, 3.8, 105, 102, 30);
 * // ATR ratio = 1.37 → volatility surge, boost VOLATILE/BREAKOUT transitions
 * ```
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
 * Propagate the Markov chain forward one step using the transition matrix,
 * then apply a Bayes update with fuzzy memberships as observation likelihood.
 *
 * **Step 1 — Prediction:** `predicted = prior × T` (matrix-vector multiplication)
 *
 * **Step 2 — Bayes update:** `posterior ∝ predicted × likelihood`
 * where `likelihood[i] = memberships[REGIME_STATES[i]]`. The fuzzy memberships
 * serve as the observation model P(observation | state).
 *
 * After computation, the chain's `currentState` and `lastState` are updated
 * in place.
 *
 * @param chain - The Markov chain to propagate (mutated in place)
 * @param memberships - Fuzzy membership scores from {@link fuzzyRegimeDetector},
 *   used as observation likelihoods
 * @returns Posterior probabilities for each regime state after the update (sum = 1)
 *
 * @example
 * ```ts
 * const posteriors = propagateMarkov(chain, fuzzyMemberships);
 * // posteriors.TRENDING_UP ≈ 0.55, posteriors.RANGING ≈ 0.2, ...
 * ```
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
 * Get the current most likely regime from the Markov chain by selecting
 * the state with the highest posterior probability.
 *
 * @param chain - The Markov chain to query
 * @returns An object containing the most likely `regime` state and its
 *   `confidence` (posterior probability)
 *
 * @example
 * ```ts
 * const { regime, confidence } = getMarkovRegime(chain);
 * // regime = 'TRENDING_UP', confidence = 0.62
 * ```
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

/**
 * A single indicator's vote in the weighted voting ensemble.
 */
export interface IndicatorVote {
  /** Indicator name (e.g., 'macd', 'rsi', 'adx', 'bb') */
  name: string;
  /** Signal strength: -1 (bearish), 0 (neutral), or +1 (bullish). Some indicators use fractional values like ±0.5. */
  signal: number;
  /** Current weight for this indicator (from {@link VotingWeights}) */
  weight: number;
}

/**
 * Adaptive weights for each of the 7 indicator signals in the voting ensemble.
 *
 * Weights are initialized to 1.0 and then adapted via {@link decayWeightsFromError}
 * based on prediction accuracy. They are clamped to [0.1, 2.0].
 */
export interface VotingWeights {
  /** Weight for MACD histogram signal */
  macd: number;
  /** Weight for Stochastic %K/%D signal */
  stochastic: number;
  /** Weight for RSI overbought/oversold signal */
  rsi: number;
  /** Weight for On-Balance Volume signal */
  obv: number;
  /** Weight for Money Flow Index signal */
  mfi: number;
  /** Weight for ADX/DI directional signal */
  adx: number;
  /** Weight for Bollinger Band position signal */
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
 * Generate discrete signals (-1, 0, +1) for each of the 7 technical indicators
 * based on their current values. Replaces the Transformer classifier's feature
 * extraction step.
 *
 * **Signal generation rules for each indicator:**
 * - **MACD**: +1 if histogram > 0 AND line > signal; -1 if histogram < 0 AND line < signal; else 0
 * - **Stochastic**: -1 if %K > 80 (overbought); +1 if %K < 20 (oversold); else sign of (K − D)
 * - **RSI**: -1 if > 70; +1 if < 30; +1 if > 55; -1 if < 45; else 0
 * - **OBV**: +1 if rising; -1 if falling; else 0
 * - **MFI**: -1 if > 80; +1 if < 20; +1 if > 55; -1 if < 45; else 0
 * - **ADX/DI**: If ADX > 20, sign of (DI+ − DI-); else 0 (no trend)
 * - **BB**: Position-based: -1 near upper, +1 near lower, fractional in between
 *
 * @param input - An object containing current values for all 7 indicators
 * @returns Array of 7 {@link IndicatorVote} objects with name, signal, and default weight
 *
 * @example
 * ```ts
 * const votes = indicatorSignals({
 *   macdLine: 1.5, macdSignal: 1.0, macdHist: 0.5,
 *   stochK: 45, stochD: 50, rsi: 55,
 *   obv: 1000, obvPrev: 950, mfi: 60,
 *   adx: 30, diPlus: 25, diMinus: 15,
 *   price: 105, bbUpper: 110, bbMiddle: 102, bbLower: 94
 * });
 * // votes[0] = { name: 'macd', signal: 1, weight: 1.0 }
 * ```
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
 * Combine indicator signals using adaptive weighted voting.
 *
 * The aggregate signal is computed as:
 * ```
 * signal = clamp01(Σ(vote.signal × weight) / Σ(|vote.signal| × weight)) × sign(Σ)
 * ```
 *
 * Neutral votes (signal = 0) contribute zero effective weight. The result
 * is normalized to [-1, +1].
 *
 * @param votes - Array of indicator votes from {@link indicatorSignals}
 * @param weights - Current adaptive weights from {@link VotingWeights}
 * @returns An object with the aggregate `signal` in [-1, +1] and the
 *   `weights` actually used for each indicator
 *
 * @example
 * ```ts
 * const result = adaptiveWeightedVote(votes, weights);
 * // result.signal = 0.35 (mildly bullish)
 * // result.weights = { macd: 1.0, rsi: 1.2, ... }
 * ```
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
 * Decay (penalize) or reward the weight of a single indicator based on whether
 * its recent prediction was correct.
 *
 * - **Wrong prediction**: weight is multiplied by `(1 − decayRate)`, floored at 0.1
 * - **Correct prediction**: weight is multiplied by `(1 + decayRate × 0.5)`, capped at 2.0
 *
 * The default decay rate is 0.05 (5% per wrong prediction), giving a gradual
 * adaptation that prevents wild weight swings.
 *
 * @param weights - Current voting weights
 * @param indicatorName - Name of the indicator to adjust (must match a key in {@link VotingWeights})
 * @param wasCorrect - Whether the indicator's prediction was correct
 * @param decayRate - Decay/reward rate per prediction event (default: 0.05)
 * @returns A new {@link VotingWeights} object with the adjusted weight (immutable — original is not mutated)
 *
 * @example
 * ```ts
 * // Penalize RSI for a wrong prediction
 * let weights = decayWeightsFromError(weights, 'rsi', false);
 * // weights.rsi = 0.95  (was 1.0, multiplied by 0.95)
 *
 * // Reward MACD for a correct prediction
 * weights = decayWeightsFromError(weights, 'macd', true);
 * // weights.macd = 1.025  (was 1.0, multiplied by 1.025)
 * ```
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

/**
 * Reset the regime engine's global state, including the Markov chain
 * and adaptive voting weights.
 *
 * Call this when starting a new analysis session or when switching
 * to a completely different symbol/timeframe.
 */
export function resetRegimeEngine(): void {
  globalMarkovChain = null;
  globalVotingWeights = { ...DEFAULT_VOTING_WEIGHTS };
}

/**
 * Main entry point for regime detection. Combines all three methods —
 * fuzzy rule-based, Markov chain, and adaptive weighted voting — into
 * a single unified regime classification.
 *
 * **Combination formula:**
 * ```
 * combined[state] = 0.5 × markovPosterior[state]
 *                 + 0.3 × fuzzyMembership[state]
 *                 + 0.2 × voteDirectionBias
 * ```
 *
 * The vote direction bias is distributed as:
 * - Positive vote → added to TRENDING_UP
 * - Negative vote → added to TRENDING_DOWN
 * - Neutral vote → added to RANGING
 *
 * The combined scores are then normalized to sum to 1, and the state
 * with the highest score becomes the primary regime.
 *
 * @param data - Array of OHLCV candles (at least 50 bars recommended for
 *   reliable indicator computation). Used to compute EMA slope and previous ATR.
 * @param indicators - Pre-computed indicator values from ta-engine. Must include
 *   ADX, DI±, RSI, MFI, MACD, Stochastic, OBV, ATR, Bollinger Bands, EMAs, and price.
 * @returns A {@link RegimeResult} containing the primary regime, confidence,
 *   per-component outputs, and a Persian description
 *
 * @example
 * ```ts
 * const result = detectRegime(ohlcvData, {
 *   adx: 32, diPlus: 26, diMinus: 14, rsi: 62, mfi: 58,
 *   macdLine: 1.5, macdSignal: 1.0, macdHist: 0.5,
 *   stochK: 55, stochD: 48, obv: 12000, atr: 4.5,
 *   bbUpper: 112, bbMiddle: 105, bbLower: 98,
 *   ema20: 104, ema50: 101, price: 106
 * });
 * // result.regime = 'TRENDING_UP'
 * // result.confidence = 0.58
 * // result.description = 'روند صعودی'
 * ```
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
 * Map the engine's {@link RegimeState} to the MSL v4 `RegimeType` enum
 * for backward compatibility with the legacy MSL pipeline.
 *
 * **Mapping rules:**
 * - `TRENDING_UP` → `'Strong Bull'` if confidence > 0.5, else `'Weak Bull'`
 * - `TRENDING_DOWN` → `'Strong Bear'` if confidence > 0.5, else `'Weak Bear'`
 * - `RANGING` → `'Range'`
 * - `VOLATILE` → `'Range'` (volatile is treated as range-like)
 * - `BREAKOUT` → `'Strong Bull'` if confidence > 0.5, else `'Weak Bull'`
 *   (breakout defaults to bullish bias)
 *
 * @param regime - The regime state from the detection engine
 * @param confidence - Confidence score in [0, 1], used to determine strong vs. weak classification
 * @returns One of the 5 MSL v4 RegimeType values: `'Strong Bull' | 'Weak Bull' | 'Strong Bear' | 'Weak Bear' | 'Range'`
 *
 * @example
 * ```ts
 * toMSLRegime('TRENDING_UP', 0.7)  // → 'Strong Bull'
 * toMSLRegime('TRENDING_UP', 0.3)  // → 'Weak Bull'
 * toMSLRegime('RANGING', 0.5)      // → 'Range'
 * toMSLRegime('VOLATILE', 0.8)     // → 'Range'
 * ```
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
 * Get a copy of the current global voting weights.
 *
 * Useful for inspecting the adaptive weight state or for serializing
 * the engine's configuration.
 *
 * @returns A shallow copy of the current {@link VotingWeights}
 */
export function getVotingWeights(): VotingWeights {
  return { ...globalVotingWeights };
}

/**
 * Update the global voting weights (typically called after receiving
 * feedback on prediction accuracy).
 *
 * Weights should be adjusted using {@link decayWeightsFromError} before
 * being set here, or set directly from a serialized configuration.
 *
 * @param weights - The new voting weights to apply (a shallow copy is stored)
 */
export function setVotingWeights(weights: VotingWeights): void {
  globalVotingWeights = { ...weights };
}
