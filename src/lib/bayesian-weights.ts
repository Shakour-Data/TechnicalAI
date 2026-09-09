// ═══════════════════════════════════════════════════════════════════════════════
// Dynamic Bayesian Weighting System v9
// Adjusts indicator/signal weights based on prediction accuracy history.
// Simplified Bayesian updating without full ML training.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Represents a single indicator's Bayesian weight state within the
 * Beta-Binomial conjugate prior framework.
 *
 * Each indicator tracks its own Beta distribution parameters (alpha/beta)
 * which are updated incrementally as prediction outcomes are observed.
 * The posterior mean — alpha / (alpha + beta) — serves as the indicator's
 * current accuracy estimate, while `weight` is the softmax-normalized
 * value used for decision-making across all indicators.
 *
 * **Beta-Binomial Conjugate Prior:**
 * - Prior:  Beta(alpha₀, beta₀)  — pseudo-counts encoding initial belief
 * - Update: alpha ← alpha + 1 on success; beta ← beta + 1 on failure
 * - Posterior mean: alpha / (alpha + beta)
 */
export interface BayesianWeight {
  /** Persian/Farsi display name of the indicator */
  name: string;
  /** English display name used as the canonical key */
  nameEn: string;
  /**
   * Prior belief in this indicator's accuracy, in [0, 1].
   * Set once at initialization from the default indicator configuration.
   */
  prior: number;
  /**
   * Posterior belief after observing evidence, in [0, 1].
   * Computed as alpha / (alpha + beta) after each Bayesian update.
   */
  posterior: number;
  /**
   * Success pseudo-count for the Beta distribution.
   * Incremented by 1 each time the indicator makes a correct prediction.
   * Initialized with a small pseudo-count (e.g. 3–6) to encode prior belief.
   */
  alpha: number;
  /**
   * Failure pseudo-count for the Beta distribution.
   * Incremented by 1 each time the indicator makes an incorrect prediction.
   * Initialized with a small pseudo-count (e.g. 3–4) to encode prior belief.
   */
  beta: number;
  /** Total number of real observations (updates) applied to this indicator */
  observations: number;
  /**
   * Final normalized weight for decision-making, in [0, 1].
   * Computed via softmax-like normalization with temperature parameter.
   * All indicator weights for a symbol sum to 1.
   */
  weight: number;
}

/**
 * A historical record of a single indicator's prediction compared to the
 * actual market outcome. Used for retrospective accuracy analysis and
 * auto-evaluation of the weighting system.
 */
export interface BayesianPredictionRecord {
  /** English name of the indicator that made the prediction */
  indicator: string;
  /** The direction the indicator predicted */
  predicted: 'up' | 'down' | 'neutral';
  /** The actual market direction that occurred */
  actual: 'up' | 'down' | 'neutral';
  /** Unix timestamp (ms) when the prediction was recorded */
  timestamp: number;
  /** Whether the predicted direction matched the actual direction */
  correct: boolean;
}

/**
 * Aggregate result of the Bayesian weighting system for a symbol.
 * Contains the full weight array, ranked indicator lists, an overall
 * confidence score, and direction-adjusted probabilities.
 */
export interface BayesianSystemResult {
  /** All indicator weights, sorted descending by normalized weight */
  weights: BayesianWeight[];
  /** English names of the top 3 most accurate indicators */
  topIndicators: string[];
  /** English names of the bottom 3 least accurate indicators */
  bottomIndicators: string[];
  /**
   * Overall system confidence in [0, 1].
   * Computed as the average posterior of indicators with ≥ 5 observations.
   * Defaults to 0.52 if no indicator has enough observations.
   */
  overallConfidence: number;
  /**
   * Scenario probabilities adjusted by Bayesian evidence.
   * `up` = sum of bullish scenarios, `down` = sum of bearish,
   * `neutral` = remaining probability mass.
   */
  adjustedProbabilities: { up: number; down: number; neutral: number };
  /** Unix timestamp (ms) of when this result was computed */
  lastUpdated: number;
}

// ─── Default Indicators ─────────────────────────────────────────────────────

/**
 * Default configuration for the 12 technical indicators used by the
 * Bayesian weighting system. Each entry defines the indicator's display
 * names and the initial Beta-Binomial conjugate prior parameters:
 *
 * - **prior** — subjective initial belief in the indicator's accuracy [0, 1]
 * - **alpha** — Beta distribution success pseudo-count (encodes prior successes)
 * - **beta**  — Beta distribution failure pseudo-count (encodes prior failures)
 *
 * The posterior mean at initialization is alpha / (alpha + beta).
 *
 * Indicators with higher initial alpha/beta ratios (e.g. ML Model at 6/4 = 0.60)
 * start with stronger prior belief, while balanced ratios (e.g. ADX at 3/3 = 0.50)
 * encode uncertainty.
 *
 * | # | Indicator            | Prior | α / β | Initial Posterior |
 * |---|----------------------|-------|-------|-------------------|
 * | 1 | RSI                  | 0.55  | 5 / 4 | 0.556             |
 * | 2 | MACD                 | 0.55  | 5 / 4 | 0.556             |
 * | 3 | Stochastic           | 0.52  | 4 / 4 | 0.500             |
 * | 4 | ADX                  | 0.50  | 3 / 3 | 0.500             |
 * | 5 | Bollinger Bands      | 0.52  | 4 / 4 | 0.500             |
 * | 6 | MFI                  | 0.50  | 3 / 3 | 0.500             |
 * | 7 | CCI                  | 0.48  | 3 / 3 | 0.500             |
 * | 8 | Moving Average       | 0.53  | 5 / 4 | 0.556             |
 * | 9 | Volume/OBV           | 0.50  | 3 / 3 | 0.500             |
 * |10 | S/R Levels           | 0.55  | 5 / 4 | 0.556             |
 * |11 | Candlestick Pattern  | 0.53  | 4 / 4 | 0.500             |
 * |12 | ML Model             | 0.58  | 6 / 4 | 0.600             |
 */
const DEFAULT_INDICATORS = [
  { name: 'RSI', nameEn: 'RSI', prior: 0.55, alpha: 5, beta: 4 },
  { name: 'MACD', nameEn: 'MACD', prior: 0.55, alpha: 5, beta: 4 },
  { name: 'استوکاستیک', nameEn: 'Stochastic', prior: 0.52, alpha: 4, beta: 4 },
  { name: 'ADX', nameEn: 'ADX', prior: 0.50, alpha: 3, beta: 3 },
  { name: 'باندهای بولینگر', nameEn: 'Bollinger Bands', prior: 0.52, alpha: 4, beta: 4 },
  { name: 'MFI', nameEn: 'MFI', prior: 0.50, alpha: 3, beta: 3 },
  { name: 'CCI', nameEn: 'CCI', prior: 0.48, alpha: 3, beta: 3 },
  { name: 'میانگین متحرک', nameEn: 'Moving Average', prior: 0.53, alpha: 5, beta: 4 },
  { name: 'حجم', nameEn: 'Volume/OBV', prior: 0.50, alpha: 3, beta: 3 },
  { name: 'حمایت/مقاومت', nameEn: 'S/R Levels', prior: 0.55, alpha: 5, beta: 4 },
  { name: 'الگوی کندل‌استیک', nameEn: 'Candlestick Pattern', prior: 0.53, alpha: 4, beta: 4 },
  { name: 'مدل ML', nameEn: 'ML Model', prior: 0.58, alpha: 6, beta: 4 },
];

// ─── In-memory Store ────────────────────────────────────────────────────────

/** Per-symbol Bayesian state */
const symbolStates = new Map<string, Map<string, BayesianWeight>>();
/** Per-symbol prediction history records */
const predictionHistory = new Map<string, BayesianPredictionRecord[]>();

// ─── Core Bayesian Functions ─────────────────────────────────────────────────

/**
 * Get or create the Bayesian weight map for a given symbol.
 *
 * If the symbol has no prior state, initializes all 12 default indicators
 * with their Beta-Binomial conjugate prior parameters. The initial posterior
 * for each indicator is computed as alpha / (alpha + beta).
 *
 * @param symbol - Trading symbol (e.g. "BTCUSDT") to get or create weights for
 * @returns Map from indicator English name to its BayesianWeight state
 */
function getOrCreateWeights(symbol: string): Map<string, BayesianWeight> {
  if (!symbolStates.has(symbol)) {
    const weights = new Map<string, BayesianWeight>();
    for (const ind of DEFAULT_INDICATORS) {
      const posterior = ind.alpha / (ind.alpha + ind.beta);
      weights.set(ind.nameEn, {
        name: ind.name,
        nameEn: ind.nameEn,
        prior: ind.prior,
        posterior,
        alpha: ind.alpha,
        beta: ind.beta,
        observations: 0,
        weight: 0,
      });
    }
    symbolStates.set(symbol, weights);
  }
  return symbolStates.get(symbol)!;
}

/**
 * Update a single indicator's weight using Beta-Binomial conjugate prior updating.
 *
 * **Bayesian Update Rule:**
 * - On success: alpha ← alpha + 1  (increment success pseudo-count)
 * - On failure: beta  ← beta  + 1  (increment failure pseudo-count)
 * - Posterior mean: alpha / (alpha + beta)
 *
 * This is the closed-form conjugate update for a Binomial likelihood
 * with a Beta prior — no integration or MCMC required.
 *
 * Also records the outcome in the prediction history for retrospective analysis.
 *
 * @param symbol     - Trading symbol (e.g. "BTCUSDT") identifying the per-symbol state
 * @param indicator  - English name of the indicator to update (e.g. "RSI", "MACD")
 * @param wasCorrect - Whether the indicator's prediction matched the actual outcome
 * @returns The updated BayesianWeight object with incremented alpha/beta and recomputed posterior.
 *          If the indicator is unknown, a default weight object is returned instead.
 */
export function updateIndicatorWeight(
  symbol: string,
  indicator: string,
  wasCorrect: boolean
): BayesianWeight {
  const weights = getOrCreateWeights(symbol);
  const w = weights.get(indicator);
  if (!w) return createDefaultWeight(indicator);

  if (wasCorrect) {
    w.alpha += 1;
  } else {
    w.beta += 1;
  }
  w.observations += 1;
  w.posterior = w.alpha / (w.alpha + w.beta);

  // Record in history
  const history = predictionHistory.get(symbol) || [];
  history.push({
    indicator,
    predicted: wasCorrect ? 'up' : 'down',
    actual: wasCorrect ? 'up' : 'down',
    timestamp: Date.now(),
    correct: wasCorrect,
  });
  predictionHistory.set(symbol, history);

  return w;
}

/**
 * Batch update multiple indicator weights in a single call.
 *
 * Iterates over the provided results array and applies a single Bayesian
 * update (via {@link updateIndicatorWeight}) for each entry. Useful after
 * evaluating multiple predictions at once (e.g., after 5 trading sessions).
 *
 * @param symbol  - Trading symbol (e.g. "BTCUSDT") identifying the per-symbol state
 * @param results - Array of indicator outcome records, each containing the indicator
 *                  English name and whether its prediction was correct
 * @returns Array of updated BayesianWeight objects, one per result entry, in the same order
 */
export function batchUpdateWeights(
  symbol: string,
  results: { indicator: string; correct: boolean }[]
): BayesianWeight[] {
  return results.map(r => updateIndicatorWeight(symbol, r.indicator, r.correct));
}

/**
 * Compute softmax-like normalized weights for all indicators of a symbol.
 *
 * **Normalization Formula (softmax with temperature):**
 * ```
 * w_i = exp(posterior_i / T) / Σ_j exp(posterior_j / T)
 * ```
 * where T is the temperature parameter. Higher T → more uniform weights;
 * lower T → more peaked (winner-take-all) distribution.
 *
 * A numerical stability trick subtracts max(posterior) before exponentiation
 * to prevent overflow.
 *
 * After normalization, indicators are sorted by weight (descending) and the
 * top 3 / bottom 3 are identified. Overall confidence is computed as the
 * average posterior of indicators with ≥ 5 observations.
 *
 * @param symbol      - Trading symbol (e.g. "BTCUSDT") to compute weights for
 * @param temperature - Softmax temperature controlling weight sharpness.
 *                      Defaults to 2.0. Higher values produce more uniform weights;
 *                      lower values amplify differences between indicator accuracies.
 * @returns A {@link BayesianSystemResult} with normalized weights, ranked indicators,
 *          overall confidence, and placeholder adjusted probabilities (filled by caller).
 */
export function getNormalizedWeights(
  symbol: string,
  temperature: number = 2.0
): BayesianSystemResult {
  const weights = getOrCreateWeights(symbol);
  const weightArr = Array.from(weights.values());

  // Softmax-like normalization with temperature
  const maxPosterior = Math.max(...weightArr.map(w => w.posterior));
  const expValues = weightArr.map(w =>
    Math.exp((w.posterior - maxPosterior) / temperature)
  );
  const sumExp = expValues.reduce((a, b) => a + b, 0);

  for (let i = 0; i < weightArr.length; i++) {
    weightArr[i].weight = expValues[i] / sumExp;
  }

  // Sort by weight descending
  weightArr.sort((a, b) => b.weight - a.weight);

  const topIndicators = weightArr.slice(0, 3).map(w => w.nameEn);
  const bottomIndicators = weightArr.slice(-3).map(w => w.nameEn);

  // Overall confidence based on average posterior with enough observations
  const observedWeights = weightArr.filter(w => w.observations >= 5);
  const overallConfidence = observedWeights.length > 0
    ? observedWeights.reduce((s, w) => s + w.posterior, 0) / observedWeights.length
    : 0.52; // default prior-like confidence

  return {
    weights: weightArr,
    topIndicators,
    bottomIndicators,
    overallConfidence,
    adjustedProbabilities: { up: 0, down: 0, neutral: 0 }, // filled by caller
    lastUpdated: Date.now(),
  };
}

/**
 * Adjust scenario probabilities based on Bayesian-weighted indicator signals.
 *
 * For each scenario key (e.g. "SC1", "SC4"), computes a weighted support score
 * by summing the normalized weights of indicators whose signals agree with
 * the scenario's direction:
 * - Bullish scenarios (SC1–SC3): indicators signaling "up" provide positive support;
 *   indicators signaling "down" provide negative support.
 * - Bearish scenarios (SC4–SC6): indicators signaling "down" provide positive support;
 *   indicators signaling "up" provide negative support.
 *
 * The support ratio is then used to apply a mild ±15% adjustment to the raw
 * probability, clamped to [0.01, 0.99]. After all adjustments, probabilities
 * are renormalized to sum to 1.
 *
 * Finally, aggregate bullish/bearish/neutral probabilities are computed and
 * stored in the result's `adjustedProbabilities`.
 *
 * @param symbol            - Trading symbol (e.g. "BTCUSDT") for weight lookup
 * @param rawProbabilities  - Map of scenario keys to their raw (pre-Bayesian) probabilities.
 *                            Keys prefixed "SC1"–"SC3" are bullish; "SC4"–"SC6" are bearish.
 * @param indicatorSignals  - Map of indicator English names to their current signal direction
 *                            ("up", "down", or "neutral")
 * @returns Object containing:
 *   - `adjusted` — scenario key → Bayesian-adjusted probability (sums to 1)
 *   - `bayesianResult` — full {@link BayesianSystemResult} with weights and direction probabilities
 */
export function applyBayesianAdjustment(
  symbol: string,
  rawProbabilities: { [key: string]: number },
  indicatorSignals: { [indicator: string]: 'up' | 'down' | 'neutral' }
): { adjusted: { [key: string]: number }; bayesianResult: BayesianSystemResult } {
  const bayesianResult = getNormalizedWeights(symbol);
  const weights = new Map(bayesianResult.weights.map(w => [w.nameEn, w.weight]));

  const adjusted: { [key: string]: number } = { ...rawProbabilities };

  // For each scenario, adjust based on which indicators support it
  for (const [scenario, prob] of Object.entries(adjusted)) {
    let upSupport = 0;
    let downSupport = 0;
    let totalWeight = 0;

    for (const [indicator, signal] of Object.entries(indicatorSignals)) {
      const w = weights.get(indicator);
      if (!w) continue;
      totalWeight += w;

      if (scenario.startsWith('SC1') || scenario.startsWith('SC2') || scenario.startsWith('SC3')) {
        // Bullish scenarios
        if (signal === 'up') upSupport += w;
        if (signal === 'down') downSupport += w;
      } else if (scenario.startsWith('SC4') || scenario.startsWith('SC5') || scenario.startsWith('SC6')) {
        // Bearish scenarios
        if (signal === 'down') upSupport += w; // renamed for clarity
        if (signal === 'up') downSupport += w;
      }
    }

    if (totalWeight > 0) {
      const supportRatio = (upSupport - downSupport) / totalWeight;
      // Mild adjustment: shift probability by up to ±15% based on Bayesian evidence
      const adjustment = supportRatio * 0.15;
      adjusted[scenario] = Math.max(0.01, Math.min(0.99, prob + adjustment * prob));
    }
  }

  // Renormalize
  const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(adjusted)) {
    adjusted[key] = adjusted[key] / total;
  }

  // Fill adjusted probabilities in result
  const bullProb = Object.entries(adjusted)
    .filter(([k]) => ['SC1', 'SC2', 'SC3'].some(p => k.startsWith(p)))
    .reduce((s, [, v]) => s + v, 0);
  const bearProb = Object.entries(adjusted)
    .filter(([k]) => ['SC4', 'SC5', 'SC6'].some(p => k.startsWith(p)))
    .reduce((s, [, v]) => s + v, 0);
  const neutralProb = 1 - bullProb - bearProb;

  bayesianResult.adjustedProbabilities = {
    up: bullProb,
    down: bearProb,
    neutral: neutralProb,
  };

  return { adjusted, bayesianResult };
}

/**
 * Retrieve the full prediction history for a symbol.
 *
 * @param symbol - Trading symbol (e.g. "BTCUSDT") whose prediction records to retrieve
 * @returns Array of {@link BayesianPredictionRecord} entries in chronological order,
 *          or an empty array if no predictions have been recorded for the symbol
 */
export function getPredictionHistory(symbol: string): BayesianPredictionRecord[] {
  return predictionHistory.get(symbol) || [];
}

/**
 * Compute per-indicator accuracy statistics from the prediction history.
 *
 * Aggregates all prediction records for the given symbol and computes
 * the number of correct predictions, total predictions, and accuracy
 * ratio for each indicator.
 *
 * @param symbol - Trading symbol (e.g. "BTCUSDT") whose accuracy stats to compute
 * @returns Object keyed by indicator English name, each containing:
 *   - `correct` — number of correct predictions
 *   - `total`   — total number of predictions
 *   - `accuracy` — correct / total (0 if total is 0)
 */
export function getAccuracyStats(symbol: string): {
  [indicator: string]: { correct: number; total: number; accuracy: number };
} {
  const history = predictionHistory.get(symbol) || [];
  const stats: { [indicator: string]: { correct: number; total: number; accuracy: number } } = {};

  for (const record of history) {
    if (!stats[record.indicator]) {
      stats[record.indicator] = { correct: 0, total: 0, accuracy: 0 };
    }
    stats[record.indicator].total++;
    if (record.correct) stats[record.indicator].correct++;
  }

  for (const key of Object.keys(stats)) {
    stats[key].accuracy = stats[key].total > 0
      ? stats[key].correct / stats[key].total
      : 0;
  }

  return stats;
}

/**
 * Auto-evaluate past predictions against actual market outcomes and update weights.
 *
 * Compares each entry's `predictedDir` with `actualDir` to determine overall
 * accuracy. Since individual indicator attributions are not available, the
 * result is applied as a single batch update to the "ML Model" indicator:
 * - If overall accuracy > 50%, the ML Model indicator is marked as correct
 * - Otherwise, it is marked as incorrect
 *
 * This function is designed to be called periodically (e.g., every 5 trading
 * sessions) to keep the Bayesian weights calibrated with recent performance.
 *
 * @param symbol   - Trading symbol (e.g. "BTCUSDT") to update
 * @param pastData - Array of past prediction records, each containing:
 *   - `date`         — Unix timestamp (ms) of the prediction
 *   - `predictedDir` — the predicted market direction
 *   - `actualDir`    — the actual market direction that occurred
 * @returns Array of updated {@link BayesianWeight} objects from the batch update
 */
export function autoEvaluatePredictions(
  symbol: string,
  pastData: { date: number; predictedDir: 'up' | 'down' | 'neutral'; actualDir: 'up' | 'down' | 'neutral' }[]
): BayesianWeight[] {
  const results: { indicator: string; correct: boolean }[] = [];

  // We don't know which specific indicator made each prediction,
  // so we update the 'ML Model' weight based on overall accuracy
  let correct = 0;
  for (const d of pastData) {
    if (d.predictedDir === d.actualDir) correct++;
  }

  if (pastData.length > 0) {
    results.push({
      indicator: 'ML Model',
      correct: correct / pastData.length > 0.5,
    });
  }

  return batchUpdateWeights(symbol, results);
}

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Create a default BayesianWeight for an unknown indicator.
 *
 * Uses default Beta-Binomial prior parameters alpha=5, beta=4 (posterior = 5/9 ≈ 0.556)
 * and a prior of 0.55, consistent with the most common default indicator settings.
 *
 * @param indicator - English name to use for both `name` and `nameEn`
 * @returns A BayesianWeight with zero observations and unnormalized weight (0)
 */
function createDefaultWeight(indicator: string): BayesianWeight {
  const posterior = 5 / 9; // default alpha=5, beta=4
  return {
    name: indicator,
    nameEn: indicator,
    prior: 0.55,
    posterior,
    alpha: 5,
    beta: 4,
    observations: 0,
    weight: 0,
  };
}

/**
 * Generate a Persian (Farsi) narrative summary of the Bayesian weighting system state.
 *
 * If no indicator has ≥ 5 observations, returns a message indicating insufficient data.
 * Otherwise, produces a summary including:
 * - Overall accuracy confidence percentage
 * - Top 3 most accurate indicators (comma-separated in Persian)
 * - Bottom 2 least accurate indicators (joined with Persian "و")
 * - Count of evaluated indicators
 *
 * @param symbol - Trading symbol (e.g. "BTCUSDT") to summarize
 * @returns A Persian-language string summarizing the Bayesian system's current state
 */
export function generateBayesianSummary(symbol: string): string {
  const result = getNormalizedWeights(symbol);
  const observedCount = result.weights.filter(w => w.observations >= 5).length;

  if (observedCount === 0) {
    return 'سیستم وزن‌دهی بیزی هنوز داده کافی برای ارزیابی شاخص‌ها ندارد. از وزن‌های اولیه استفاده می‌شود.';
  }

  const top = result.topIndicators.slice(0, 3).join('، ');
  const bottom = result.bottomIndicators.slice(-2).join(' و ');
  const confidence = Math.round(result.overallConfidence * 100);

  let text = `سیستم وزن‌دهی بیزی: `;
  text += `دقت کلی ${confidence}٪. `;
  text += `شاخص‌های با بیشترین دقت: ${top}. `;
  if (bottom) {
    text += `شاخص‌های با کمترین دقت: ${bottom}. `;
  }
  text += `${observedCount} شاخص ارزیابی‌شده.`;

  return text;
}
