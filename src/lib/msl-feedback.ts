// ═══════════════════════════════════════════════════════════════════════════════
// MSL Feedback & Adaptive Weight Improvement — Pure TypeScript
// No database required — uses runtime state + localStorage/IndexedDB
// ═══════════════════════════════════════════════════════════════════════════════
// Features:
//   - FeedbackStore: stores predictions and user feedback in memory + localStorage
//   - updateWeightsFromFeedback: adjusts VDSS weights based on prediction errors
//   - recordFeedback: records user feedback and triggers weight update
//   - Adaptive learning rate with error-based decay
// ═══════════════════════════════════════════════════════════════════════════════

import type { VotingWeights } from './regime-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * A record tracking a single prediction made by the MSL system.
 *
 * Stores the full context of a prediction including the symbol, predicted
 * scenario/direction/probability, the price at prediction time, snapshots of
 * both component weights and voting weights, and any subsequent user feedback.
 * At most {@link MAX_STORED_PREDICTIONS} (500) records are kept in the store;
 * oldest unfeedbacked entries are evicted first.
 */
export interface PredictionRecord {
  /** Unique ID for this prediction (format: `pred_<timestamp>_<random>`) */
  id: string;
  /** Market symbol (e.g., 'فولاد') */
  symbol: string;
  /** Unix timestamp (ms) when the prediction was created */
  timestamp: number;
  /** The predicted scenario label (e.g., 'SC6') */
  predictedScenario: string;
  /** Predicted direction: 1 = bullish, -1 = bearish, 0 = neutral */
  predictedDirection: number;
  /** Predicted probability in the range [0, 1] */
  predictedProbability: number;
  /** Asset price at the time the prediction was made */
  priceAtPrediction: number;
  /** Snapshot of VDSS component weights at prediction time */
  weightsSnapshot: Record<string, number>;
  /** Snapshot of voting weights at prediction time */
  votingWeightsSnapshot: VotingWeights | null;
  /** User feedback on this prediction, or `null` if not yet provided */
  feedback: FeedbackRecord | null;
}

/**
 * Captures user feedback on a prediction.
 *
 * Records whether the prediction was correct, the actual market direction
 * and price observed after the prediction period, the feedback timestamp,
 * and an optional user comment.
 */
export interface FeedbackRecord {
  /** Whether the prediction was correct */
  isCorrect: boolean;
  /** Actual direction observed: 1 = bullish, -1 = bearish, 0 = neutral */
  actualDirection: number;
  /** Actual price observed after the prediction period */
  actualPrice: number;
  /** Unix timestamp (ms) when the feedback was submitted */
  feedbackTimestamp: number;
  /** Optional user comment explaining the feedback */
  comment?: string;
}

/**
 * Represents a single adjustment to a VDSS component weight.
 *
 * Recorded every time the adaptive weight-update algorithm modifies a
 * feature weight. Includes the feature name, the old and new weight values,
 * the delta, and a human-readable reason string (in Persian).
 */
export interface WeightAdjustment {
  /** Name of the weight/feature being adjusted */
  feature: string;
  /** Weight value before the adjustment */
  oldValue: number;
  /** Weight value after the adjustment */
  newValue: number;
  /** Absolute change (newValue − oldValue) */
  delta: number;
  /** Human-readable reason for the adjustment (Persian) */
  reason: string;
}

/**
 * Aggregated feedback statistics for the MSL prediction system.
 *
 * Provides overall accuracy, per-scenario and per-direction breakdowns,
 * a rolling recent-accuracy metric (last 20 feedbacks), and the most
 * recent weight adjustments (last 50).
 */
export interface FeedbackStats {
  /** Total number of predictions recorded (with and without feedback) */
  totalPredictions: number;
  /** Total number of predictions that have received user feedback */
  totalFeedback: number;
  /** Overall accuracy: correct predictions / total with feedback (0–1) */
  accuracy: number;
  /** Accuracy broken down by predicted scenario label */
  accuracyByScenario: Record<string, { correct: number; total: number }>;
  /** Accuracy broken down by predicted direction (bull/bear/neutral) */
  accuracyByDirection: { bull: number; bear: number; neutral: number };
  /** Rolling accuracy over the last 20 feedbacked predictions (0–1) */
  recentAccuracy: number;
  /** The 50 most recent weight adjustments */
  recentAdjustments: WeightAdjustment[];
}

// ─── Configuration ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'msl_feedback_store';
const MAX_STORED_PREDICTIONS = 500;
const MAX_STORED_ADJUSTMENTS = 100;
const DEFAULT_LEARNING_RATE = 0.01;
const MIN_LEARNING_RATE = 0.001;
const MAX_LEARNING_RATE = 0.05;

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK STORE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Singleton-compatible feedback store that maintains prediction records and
 * adaptive weight state in memory, persisted to `localStorage`.
 *
 * **Key behaviours:**
 * - Records predictions and user feedback, automatically adjusting VDSS
 *   component weights via an adaptive learning-rate algorithm.
 * - Persists all state to `localStorage` on every mutation (SSR-safe).
 * - Caps stored predictions at 500; evicts the oldest unfeedbacked entry first.
 * - Caps stored weight adjustments at 100.
 *
 * **Adaptive learning rate:**
 * - Default LR = 0.01. When recent accuracy > 70%, LR decays toward 0.001
 *   (converging). When recent accuracy < 40%, LR grows toward 0.05 (exploring).
 *   Transition is smoothed with a 0.9/0.1 exponential moving average.
 *
 * **Weight bounds:** Individual weights are clamped to [0.05, 0.5] and then
 * normalized so their sum equals 1.
 */
class FeedbackStore {
  private predictions: Map<string, PredictionRecord> = new Map();
  private adjustments: WeightAdjustment[] = [];
  private learningRate: number = DEFAULT_LEARNING_RATE;
  private currentWeights: Record<string, number> = {};
  private dirty: boolean = false;

  constructor() {
    this.loadFromStorage();
  }

  // ─── Core Operations ────────────────────────────────────────────────────

  /**
   * Record a new prediction before feedback is available.
   *
   * Stores the prediction in the in-memory map and persists to `localStorage`.
   * If the total number of predictions exceeds 500, the oldest prediction
   * that has not yet received feedback is evicted.
   *
   * @param record - Prediction data (the `feedback` field is omitted; it will be set to `null`)
   * @returns The unique ID assigned to the prediction
   */
  addPrediction(record: Omit<PredictionRecord, 'feedback'>): string {
    const id = record.id || `pred_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const entry: PredictionRecord = { ...record, id, feedback: null };
    this.predictions.set(id, entry);
    this.dirty = true;

    // Evict oldest if over limit
    if (this.predictions.size > MAX_STORED_PREDICTIONS) {
      const oldest = this.findOldestUnfeedbacked();
      if (oldest) this.predictions.delete(oldest);
    }

    this.saveToStorage();
    return id;
  }

  /**
   * Record user feedback for a prediction and trigger an adaptive weight update.
   *
   * Looks up the prediction by ID, attaches the feedback (with an auto-generated
   * timestamp), then runs the weight-update algorithm.
   *
   * @param predictionId - The unique ID of the prediction to update
   * @param feedback    - Feedback data (the `feedbackTimestamp` is omitted; set automatically)
   * @returns An array of weight adjustments made, or `null` if the prediction ID was not found
   */
  recordFeedback(
    predictionId: string,
    feedback: Omit<FeedbackRecord, 'feedbackTimestamp'>,
  ): WeightAdjustment[] | null {
    const record = this.predictions.get(predictionId);
    if (!record) return null;

    // Update the prediction with feedback
    record.feedback = { ...feedback, feedbackTimestamp: Date.now() };
    this.dirty = true;

    // Update weights based on this feedback
    const adjustments = this.updateWeightsFromFeedback(record);

    this.saveToStorage();
    return adjustments;
  }

  /**
   * Record feedback by symbol, finding the most recent unfeedbacked prediction
   * for the given symbol.
   *
   * Useful when the caller knows the market symbol but not the specific prediction ID.
   *
   * @param symbol   - Market symbol to search for (e.g., 'فولاد')
   * @param feedback - Feedback data (the `feedbackTimestamp` is omitted; set automatically)
   * @returns An array of weight adjustments made, or `null` if no matching prediction was found
   */
  recordFeedbackBySymbol(
    symbol: string,
    feedback: Omit<FeedbackRecord, 'feedbackTimestamp'>,
  ): WeightAdjustment[] | null {
    // Find most recent prediction for this symbol without feedback
    let latestId: string | null = null;
    let latestTime = 0;

    for (const [id, pred] of this.predictions) {
      if (pred.symbol === symbol && !pred.feedback && pred.timestamp > latestTime) {
        latestTime = pred.timestamp;
        latestId = id;
      }
    }

    if (!latestId) return null;
    return this.recordFeedback(latestId, feedback);
  }

  // ─── Weight Update Algorithm ────────────────────────────────────────────

  /**
   * Update VDSS component weights based on prediction error from feedback.
   *
   * **Algorithm:**
   * 1. Compute direction error = |predictedDirection − actualDirection|
   * 2. Adjust the adaptive learning rate based on recent accuracy:
   *    - recentAccuracy > 0.7 → target LR = 0.001 (converging)
   *    - recentAccuracy < 0.4 → target LR = 0.05  (exploring)
   *    - otherwise            → target LR = 0.01  (default)
   *    - Smoothed: `lr = lr × 0.9 + target × 0.1`
   * 3. For each component weight in the prediction snapshot:
   *    - **Correct prediction:** reward = lr × weight × 0.5 → newWeight = weight + reward
   *    - **Wrong prediction:** penalty = lr × weight × directionError → newWeight = weight − penalty
   * 4. Clamp each weight to **[0.05, 0.5]** for numerical stability
   * 5. Normalize all weights so they sum to 1
   * 6. Only record adjustments where |delta| > 0.0001
   *
   * @param record - The prediction record (must have `feedback` attached)
   * @returns An array of weight adjustments (may be empty if no meaningful changes)
   */
  private updateWeightsFromFeedback(record: PredictionRecord): WeightAdjustment[] {
    const feedback = record.feedback;
    if (!feedback) return [];

    const adjustments: WeightAdjustment[] = [];
    const weights = record.weightsSnapshot;
    const isCorrect = feedback.isCorrect;
    const directionError = Math.abs(record.predictedDirection - feedback.actualDirection);

    // Adjust learning rate based on recent accuracy
    const stats = this.getStats();
    if (stats.totalFeedback > 10) {
      // If accuracy is high, reduce learning rate (converging)
      // If accuracy is low, increase learning rate (need more adjustment)
      const targetLR = stats.recentAccuracy > 0.7
        ? MIN_LEARNING_RATE
        : stats.recentAccuracy < 0.4
          ? MAX_LEARNING_RATE
          : DEFAULT_LEARNING_RATE;
      this.learningRate = this.learningRate * 0.9 + targetLR * 0.1; // smooth transition
    }

    const lr = this.learningRate;

    for (const [feature, oldWeight] of Object.entries(weights)) {
      let newWeight: number;
      let reason: string;

      if (isCorrect) {
        // Correct prediction: reward contributing components
        // Components that had higher weights contributed more → reward proportionally
        const reward = lr * oldWeight * 0.5;
        newWeight = oldWeight + reward;
        reason = `پاداش: پیش‌بینی صحیح (خطا=${directionError.toFixed(2)})`;
      } else {
        // Wrong prediction: penalize components proportional to their weight
        // Higher-weighted components are more responsible for the error
        const penalty = lr * oldWeight * directionError;
        newWeight = oldWeight - penalty;
        reason = `جریمه: پیش‌بینی اشتباه (خطا=${directionError.toFixed(2)})`;
      }

      // Clamp weight to [0.05, 0.5] for stability
      newWeight = Math.max(0.05, Math.min(0.5, newWeight));

      const delta = newWeight - oldWeight;
      if (Math.abs(delta) > 0.0001) { // only record meaningful changes
        adjustments.push({ feature, oldValue: oldWeight, newValue: newWeight, delta, reason });
        this.currentWeights[feature] = newWeight;
      }
    }

    // Normalize weights to sum = 1
    const weightSum = Object.values(this.currentWeights).reduce((a, b) => a + b, 0);
    if (weightSum > 0) {
      for (const key of Object.keys(this.currentWeights)) {
        this.currentWeights[key] /= weightSum;
      }
    }

    // Store adjustments
    this.adjustments.push(...adjustments);
    if (this.adjustments.length > MAX_STORED_ADJUSTMENTS) {
      this.adjustments = this.adjustments.slice(-MAX_STORED_ADJUSTMENTS);
    }

    return adjustments;
  }

  // ─── Query Operations ───────────────────────────────────────────────────

  /**
   * Compute aggregated feedback statistics.
   *
   * Includes overall accuracy, per-scenario and per-direction breakdowns,
   * recent accuracy (last 20 feedbacks), and the 50 most recent weight adjustments.
   *
   * @returns A snapshot of current feedback statistics
   */
  getStats(): FeedbackStats {
    const predictions = Array.from(this.predictions.values());
    const withFeedback = predictions.filter(p => p.feedback !== null);

    const totalPredictions = predictions.length;
    const totalFeedback = withFeedback.length;

    // Overall accuracy
    const correct = withFeedback.filter(p => p.feedback!.isCorrect).length;
    const accuracy = totalFeedback > 0 ? correct / totalFeedback : 0;

    // Accuracy by scenario
    const accuracyByScenario: Record<string, { correct: number; total: number }> = {};
    for (const pred of withFeedback) {
      const scenario = pred.predictedScenario;
      if (!accuracyByScenario[scenario]) accuracyByScenario[scenario] = { correct: 0, total: 0 };
      accuracyByScenario[scenario].total++;
      if (pred.feedback!.isCorrect) accuracyByScenario[scenario].correct++;
    }

    // Accuracy by direction
    const bullFeedback = withFeedback.filter(p => p.predictedDirection > 0);
    const bearFeedback = withFeedback.filter(p => p.predictedDirection < 0);
    const neutralFeedback = withFeedback.filter(p => p.predictedDirection === 0);
    const accuracyByDirection = {
      bull: bullFeedback.length > 0 ? bullFeedback.filter(p => p.feedback!.isCorrect).length / bullFeedback.length : 0,
      bear: bearFeedback.length > 0 ? bearFeedback.filter(p => p.feedback!.isCorrect).length / bearFeedback.length : 0,
      neutral: neutralFeedback.length > 0 ? neutralFeedback.filter(p => p.feedback!.isCorrect).length / neutralFeedback.length : 0,
    };

    // Recent accuracy (last 20)
    const recentFeedbacks = withFeedback.slice(-20);
    const recentCorrect = recentFeedbacks.filter(p => p.feedback!.isCorrect).length;
    const recentAccuracy = recentFeedbacks.length > 0 ? recentCorrect / recentFeedbacks.length : 0;

    return {
      totalPredictions,
      totalFeedback,
      accuracy,
      accuracyByScenario,
      accuracyByDirection,
      recentAccuracy,
      recentAdjustments: this.adjustments.slice(-50),
    };
  }

  /**
   * Get a shallow copy of the current adaptive weights.
   *
   * These weights have been adjusted by all feedback processed so far.
   *
   * @returns A mapping of feature names to their current weight values
   */
  getCurrentWeights(): Record<string, number> {
    return { ...this.currentWeights };
  }

  /**
   * Get the current adaptive learning rate.
   *
   * The learning rate is adjusted automatically based on recent accuracy:
   * ranges from 0.001 (high accuracy, converging) to 0.05 (low accuracy, exploring).
   *
   * @returns The current learning rate value
   */
  getLearningRate(): number {
    return this.learningRate;
  }

  /**
   * Retrieve a prediction by its unique ID.
   *
   * @param id - The prediction ID to look up
   * @returns The prediction record, or `undefined` if not found
   */
  getPrediction(id: string): PredictionRecord | undefined {
    return this.predictions.get(id);
  }

  /**
   * Get recent predictions sorted by timestamp (newest first).
   *
   * Optionally filter by symbol and limit the number of results.
   *
   * @param symbol - Optional market symbol to filter by (e.g., 'فولاد')
   * @param limit  - Maximum number of predictions to return (default: 20)
   * @returns An array of prediction records sorted newest-first
   */
  getRecentPredictions(symbol?: string, limit: number = 20): PredictionRecord[] {
    let preds = Array.from(this.predictions.values());
    if (symbol) preds = preds.filter(p => p.symbol === symbol);
    return preds.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  // ─── Persistence ────────────────────────────────────────────────────────

  /**
   * Persist the store state (predictions, adjustments, learning rate, weights)
   * to `localStorage` under the key `msl_feedback_store`.
   *
   * No-op during SSR (`typeof window === 'undefined'`). Silently catches
   * storage errors (e.g., quota exceeded or sandboxed environment).
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return; // SSR guard
    try {
      const data = {
        predictions: Array.from(this.predictions.entries()),
        adjustments: this.adjustments.slice(-MAX_STORED_ADJUSTMENTS),
        learningRate: this.learningRate,
        currentWeights: this.currentWeights,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage unavailable (SSR, sandbox, etc.)
    }
  }

  /**
   * Load store state from `localStorage`.
   *
   * Restores predictions, weight adjustments, learning rate, and current weights.
   * No-op during SSR (`typeof window === 'undefined'`). If the stored data is
   * corrupted or unparseable, the store starts fresh (all fields remain at
   * their constructor defaults).
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return; // SSR guard
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.predictions) {
        for (const [id, pred] of data.predictions) {
          this.predictions.set(id, pred);
        }
      }
      if (data.adjustments) this.adjustments = data.adjustments;
      if (data.learningRate) this.learningRate = data.learningRate;
      if (data.currentWeights) this.currentWeights = data.currentWeights;
    } catch {
      // Corrupted data — start fresh
    }
  }

  /**
   * Find the ID of the oldest prediction that has not yet received feedback.
   *
   * Used during eviction when the prediction count exceeds the 500-record cap.
   *
   * @returns The ID of the oldest unfeedbacked prediction, or `null` if all have feedback
   */
  private findOldestUnfeedbacked(): string | null {
    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [id, pred] of this.predictions) {
      if (!pred.feedback && pred.timestamp < oldestTime) {
        oldestTime = pred.timestamp;
        oldestId = id;
      }
    }
    return oldestId;
  }

  /**
   * Clear all stored data from memory and `localStorage`.
   *
   * Resets predictions, adjustments, learning rate (back to 0.01), and current
   * weights. Also removes the `localStorage` entry.
   */
  clear(): void {
    this.predictions.clear();
    this.adjustments = [];
    this.learningRate = DEFAULT_LEARNING_RATE;
    this.currentWeights = {};
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let _instance: FeedbackStore | null = null;

/**
 * Get the singleton {@link FeedbackStore} instance.
 *
 * Creates the instance on first call (which also triggers `loadFromStorage`).
 * Subsequent calls return the same instance.
 *
 * @returns The shared feedback store instance
 */
export function getFeedbackStore(): FeedbackStore {
  if (!_instance) {
    _instance = new FeedbackStore();
  }
  return _instance;
}

// ─── Convenience API ───────────────────────────────────────────────────────

/**
 * Record a new prediction in the feedback store.
 *
 * Convenience wrapper around {@link FeedbackStore.addPrediction}.
 * Call this whenever a new MSL analysis is generated. The prediction ID
 * and timestamp are generated automatically.
 *
 * @param params - Prediction parameters (symbol, scenario, direction, probability, price, weights)
 * @returns The unique ID assigned to the new prediction
 */
export function recordPrediction(params: {
  symbol: string;
  predictedScenario: string;
  predictedDirection: number;
  predictedProbability: number;
  priceAtPrediction: number;
  weightsSnapshot: Record<string, number>;
  votingWeightsSnapshot?: VotingWeights | null;
}): string {
  const { votingWeightsSnapshot, ...rest } = params;
  return getFeedbackStore().addPrediction({
    id: `pred_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...rest,
    votingWeightsSnapshot: votingWeightsSnapshot ?? null,
    timestamp: Date.now(),
  });
}

/**
 * Record user feedback for a prediction.
 *
 * Convenience wrapper around {@link FeedbackStore.recordFeedback}.
 * Call this when the user confirms or denies a prediction. Triggers an
 * adaptive weight update automatically.
 *
 * @param predictionId    - The ID of the prediction to provide feedback for
 * @param isCorrect       - Whether the prediction was correct
 * @param actualDirection  - The actual direction observed (1 = bull, -1 = bear, 0 = neutral)
 * @param actualPrice     - The actual price observed after the prediction period
 * @param comment         - Optional user comment explaining the feedback
 * @returns An array of weight adjustments made, or `null` if the prediction was not found
 */
export function recordFeedback(
  predictionId: string,
  isCorrect: boolean,
  actualDirection: number,
  actualPrice: number,
  comment?: string,
): WeightAdjustment[] | null {
  return getFeedbackStore().recordFeedback(predictionId, {
    isCorrect,
    actualDirection,
    actualPrice,
    comment,
  });
}

/**
 * Update weights from feedback — convenience wrapper.
 *
 * Equivalent to calling {@link recordFeedback}; records the feedback and
 * returns the resulting weight adjustments.
 *
 * @param predictionId    - The ID of the prediction
 * @param isCorrect       - Whether the prediction was correct
 * @param actualDirection  - The actual direction observed
 * @param actualPrice     - The actual price observed
 * @returns An array of weight adjustments, or `null` if the prediction was not found
 */
export function updateWeightsFromFeedback(
  predictionId: string,
  isCorrect: boolean,
  actualDirection: number,
  actualPrice: number,
): WeightAdjustment[] | null {
  return recordFeedback(predictionId, isCorrect, actualDirection, actualPrice);
}

/**
 * Get the current adaptive weights after all feedback-driven adjustments.
 *
 * Convenience wrapper around {@link FeedbackStore.getCurrentWeights}.
 *
 * @returns A mapping of feature names to their current adaptive weight values
 */
export function getAdaptiveWeights(): Record<string, number> {
  return getFeedbackStore().getCurrentWeights();
}

/**
 * Get aggregated feedback statistics for display in the UI.
 *
 * Convenience wrapper around {@link FeedbackStore.getStats}.
 *
 * @returns A snapshot of current feedback statistics including accuracy, breakdowns, and adjustments
 */
export function getFeedbackStats(): FeedbackStats {
  return getFeedbackStore().getStats();
}
