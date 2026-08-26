// ═══════════════════════════════════════════════════════════════════════════════
// Dynamic Bayesian Weighting System v9
// Adjusts indicator/signal weights based on prediction accuracy history.
// Simplified Bayesian updating without full ML training.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BayesianWeight {
  name: string;
  nameEn: string;
  prior: number;       // Prior belief in this indicator's accuracy [0-1]
  posterior: number;   // Updated belief after evidence [0-1]
  alpha: number;       // Success count (pseudo-count)
  beta: number;        // Failure count (pseudo-count)
  observations: number; // Total real observations
  weight: number;      // Final normalized weight for decision making
}

export interface BayesianPredictionRecord {
  indicator: string;
  predicted: 'up' | 'down' | 'neutral';
  actual: 'up' | 'down' | 'neutral';
  timestamp: number;
  correct: boolean;
}

export interface BayesianSystemResult {
  weights: BayesianWeight[];
  topIndicators: string[];
  bottomIndicators: string[];
  overallConfidence: number;
  adjustedProbabilities: { up: number; down: number; neutral: number };
  lastUpdated: number;
}

// ─── Default Indicators ─────────────────────────────────────────────────────

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
const predictionHistory = new Map<string, BayesianPredictionRecord[]>();

// ─── Core Bayesian Functions ─────────────────────────────────────────────────

/**
 * Get or create Bayesian weights for a symbol.
 * Uses Beta-Binomial conjugate updating.
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
 * Update a single indicator's weight using Bayesian updating.
 * Beta(alpha + success, beta + failure)
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
 * Batch update multiple indicators at once (e.g., after 5 sessions).
 */
export function batchUpdateWeights(
  symbol: string,
  results: { indicator: string; correct: boolean }[]
): BayesianWeight[] {
  return results.map(r => updateIndicatorWeight(symbol, r.indicator, r.correct));
}

/**
 * Get normalized weights for a symbol.
 * Weights are normalized so they sum to 1.
 * Uses a soft-max-like normalization with temperature.
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
 * Apply Bayesian weights to scenario probabilities.
 * Takes raw probabilities and adjusts them based on indicator accuracy.
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

      if (scenario.startsWith('R1') || scenario.startsWith('R2') || scenario.startsWith('R3')) {
        // Bullish scenarios
        if (signal === 'up') upSupport += w;
        if (signal === 'down') downSupport += w;
      } else if (scenario.startsWith('R4') || scenario.startsWith('R5') || scenario.startsWith('R6')) {
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
    .filter(([k]) => ['R1', 'R2', 'R3'].some(p => k.startsWith(p)))
    .reduce((s, [, v]) => s + v, 0);
  const bearProb = Object.entries(adjusted)
    .filter(([k]) => ['R4', 'R5', 'R6'].some(p => k.startsWith(p)))
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
 * Get prediction history for a symbol.
 */
export function getPredictionHistory(symbol: string): BayesianPredictionRecord[] {
  return predictionHistory.get(symbol) || [];
}

/**
 * Get accuracy statistics for a symbol.
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
 * Auto-evaluate: compare past predictions with actual outcomes.
 * Call this periodically (e.g., every 5 sessions) to update weights.
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
 * Generate a Persian narrative summary of the Bayesian system state.
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
