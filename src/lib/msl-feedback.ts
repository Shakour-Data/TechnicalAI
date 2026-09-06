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

export interface PredictionRecord {
  /** Unique ID for this prediction */
  id: string;
  /** Symbol (e.g., 'فولاد') */
  symbol: string;
  /** Timestamp of prediction */
  timestamp: number;
  /** The predicted scenario (e.g., 'SC6') */
  predictedScenario: string;
  /** Predicted direction: 1=bullish, -1=bearish, 0=neutral */
  predictedDirection: number;
  /** Predicted probability (0-1) */
  predictedProbability: number;
  /** Price at time of prediction */
  priceAtPrediction: number;
  /** Component weights at time of prediction */
  weightsSnapshot: Record<string, number>;
  /** Voting weights at time of prediction */
  votingWeightsSnapshot: VotingWeights | null;
  /** User feedback (if provided) */
  feedback: FeedbackRecord | null;
}

export interface FeedbackRecord {
  /** Was the prediction correct? */
  isCorrect: boolean;
  /** Actual direction: 1=bullish, -1=bearish, 0=neutral */
  actualDirection: number;
  /** Actual price after the prediction period */
  actualPrice: number;
  /** Timestamp of feedback */
  feedbackTimestamp: number;
  /** User comment (optional) */
  comment?: string;
}

export interface WeightAdjustment {
  /** Name of the weight/feature being adjusted */
  feature: string;
  /** Old value */
  oldValue: number;
  /** New value */
  newValue: number;
  /** Absolute change */
  delta: number;
  /** Reason for the change */
  reason: string;
}

export interface FeedbackStats {
  /** Total predictions recorded */
  totalPredictions: number;
  /** Total feedback received */
  totalFeedback: number;
  /** Accuracy (correct / total with feedback) */
  accuracy: number;
  /** Accuracy by scenario */
  accuracyByScenario: Record<string, { correct: number; total: number }>;
  /** Accuracy by direction */
  accuracyByDirection: { bull: number; bear: number; neutral: number };
  /** Recent accuracy (last 20 feedbacks) */
  recentAccuracy: number;
  /** Weight adjustment history (last 50) */
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
   * Record a new prediction (before feedback is available).
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
   * Record user feedback for a prediction and trigger weight update.
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
   * Record feedback by symbol (finds the most recent prediction for that symbol).
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
   * Update VDSS component weights based on prediction error.
   *
   * Algorithm:
   * 1. Compute error = |predicted - actual|
   * 2. For each component weight, adjust based on its contribution to the error
   * 3. If prediction was correct, slightly increase the weights of contributing components
   * 4. If prediction was wrong, decrease the weights of the strongest contributors
   * 5. Adaptive learning rate: decrease if recent accuracy is high, increase if low
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

  getCurrentWeights(): Record<string, number> {
    return { ...this.currentWeights };
  }

  getLearningRate(): number {
    return this.learningRate;
  }

  getPrediction(id: string): PredictionRecord | undefined {
    return this.predictions.get(id);
  }

  getRecentPredictions(symbol?: string, limit: number = 20): PredictionRecord[] {
    let preds = Array.from(this.predictions.values());
    if (symbol) preds = preds.filter(p => p.symbol === symbol);
    return preds.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  // ─── Persistence ────────────────────────────────────────────────────────

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

  /** Clear all stored data */
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

export function getFeedbackStore(): FeedbackStore {
  if (!_instance) {
    _instance = new FeedbackStore();
  }
  return _instance;
}

// ─── Convenience API ───────────────────────────────────────────────────────

/**
 * Record a new prediction in the feedback store.
 * Call this when a new analysis is generated.
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
 * Call this when the user confirms or denies a prediction.
 * Returns weight adjustments made.
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
 * Computes the error and adjusts all component weights.
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
 * Get current adaptive weights (after all feedback adjustments).
 */
export function getAdaptiveWeights(): Record<string, number> {
  return getFeedbackStore().getCurrentWeights();
}

/**
 * Get feedback statistics for display in the UI.
 */
export function getFeedbackStats(): FeedbackStats {
  return getFeedbackStore().getStats();
}
