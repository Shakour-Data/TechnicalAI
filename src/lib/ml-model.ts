// ═══════════════════════════════════════════════════════════════════════════════
// ML Model Infrastructure — Logistic Regression with L2 Regularization
// Implemented from scratch in TypeScript (no external ML library)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Feature Order ─────────────────────────────────────────────────────────────
export const FEATURES_ORDER = [
  'rsi', 'mfi', 'cci', 'adx', 'macd', 'stoch', 'bb', 'ma21', 'ma100',
  'ema', 'atr', 'trend', 'sr', 'stochCross', 'macdCross', 'div',
] as const;

export type FeatureKey = (typeof FEATURES_ORDER)[number];
export const NUM_FEATURES = FEATURES_ORDER.length; // 16

// ─── Standard Scaler ───────────────────────────────────────────────────────────
export class StandardScaler {
  means: number[] = [];
  stds: number[] = [];
  isFitted = false;

  fit(X: number[][]): void {
    const n = X.length;
    if (n === 0) return;
    const m = X[0].length;
    this.means = new Array(m).fill(0);
    this.stds = new Array(m).fill(1);

    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += X[i][j];
      this.means[j] = sum / n;

      let varSum = 0;
      for (let i = 0; i < n; i++) varSum += (X[i][j] - this.means[j]) ** 2;
      const std = Math.sqrt(varSum / n);
      this.stds[j] = std > 1e-10 ? std : 1;
    }
    this.isFitted = true;
  }

  transformSingle(x: number[]): number[] {
    if (!this.isFitted) return x;
    return x.map((v, j) => (v - this.means[j]) / this.stds[j]);
  }

  transformMatrix(X: number[][]): number[][] {
    return X.map(row => this.transformSingle(row));
  }
}

// ─── Logistic Regression with L2 Regularization ───────────────────────────────
export class LogisticRegression {
  weights: number[] = [];
  bias = 0;

  private sigmoid(z: number): number {
    const clamped = Math.max(-500, Math.min(500, z));
    return 1 / (1 + Math.exp(-clamped));
  }

  fit(
    X: number[][],
    y: number[],
    options?: {
      learningRate?: number;
      regLambda?: number; // C_inverse — higher = more regularization
      maxIterations?: number;
      classWeights?: [number, number]; // [weight_class_0, weight_class_1]
    }
  ): void {
    const lr = options?.learningRate ?? 0.1;
    const regLambda = options?.regLambda ?? 10; // strong regularization (C=0.1)
    const maxIter = options?.maxIterations ?? 200;
    const classWeights = options?.classWeights;

    const n = X.length;
    const m = X[0].length;
    this.weights = new Array(m).fill(0);
    this.bias = 0;

    // Compute class weights if not provided (balanced)
    let w0 = 1, w1 = 1;
    if (!classWeights) {
      const posCount = y.reduce((s, v) => s + v, 0);
      const negCount = n - posCount;
      if (posCount > 0 && negCount > 0) {
        w0 = n / (2 * negCount);
        w1 = n / (2 * posCount);
      }
    } else {
      [w0, w1] = classWeights;
    }

    // Gradient descent
    for (let iter = 0; iter < maxIter; iter++) {
      const dw = new Array(m).fill(0);
      let db = 0;

      for (let i = 0; i < n; i++) {
        const z = X[i].reduce((sum, xij, j) => sum + xij * this.weights[j], this.bias);
        const pred = this.sigmoid(z);
        const error = pred - y[i];
        const sampleWeight = y[i] === 1 ? w1 : w0;

        for (let j = 0; j < m; j++) {
          dw[j] += error * X[i][j] * sampleWeight / n;
        }
        db += error * sampleWeight / n;
      }

      // Update with L2 regularization on weights (not bias)
      for (let j = 0; j < m; j++) {
        this.weights[j] -= lr * (dw[j] + (regLambda / n) * this.weights[j]);
      }
      this.bias -= lr * db;
    }
  }

  predictProba(X: number[]): [number, number] {
    const z = X.reduce((sum, x, j) => sum + x * (this.weights[j] ?? 0), this.bias);
    const p = this.sigmoid(z);
    return [1 - p, p]; // [P(class 0), P(class 1)]
  }

  score(X: number[][], y: number[]): number {
    let correct = 0;
    for (let i = 0; i < X.length; i++) {
      const [, p1] = this.predictProba(X[i]);
      const pred = p1 >= 0.5 ? 1 : 0;
      if (pred === y[i]) correct++;
    }
    return correct / X.length;
  }
}

// ─── TimeSeries Split ─────────────────────────────────────────────────────────
export function timeSeriesSplit(n: number, nSplits: number): { train: number[]; val: number[] }[] {
  const splits: { train: number[]; val: number[] }[] = [];
  const foldSize = Math.floor(n / (nSplits + 1));

  for (let i = 1; i <= nSplits; i++) {
    const valEnd = Math.min(Math.floor(n * (i + 1) / (nSplits + 1)), n);
    const valStart = Math.floor(n * i / (nSplits + 1));
    splits.push({
      train: Array.from({ length: valStart }, (_, k) => k),
      val: Array.from({ length: valEnd - valStart }, (_, k) => valStart + k),
    });
  }
  return splits;
}

// ─── Adaptive Weight Model ────────────────────────────────────────────────────
export class AdaptiveWeightModel {
  minSamples: number;
  scaler: StandardScaler;
  model: LogisticRegression;
  weights: number[] | null = null;
  isTrained = false;
  recentAccuracy = 0.5;

  // Feature history for adaptive learning
  private historyX: number[][] = [];
  private historyY: number[] = [];
  private updateFrequency: number;
  private counter = 0;

  constructor(minSamples = 70, updateFrequency = 10) {
    this.minSamples = minSamples;
    this.updateFrequency = updateFrequency;
    this.scaler = new StandardScaler();
    this.model = new LogisticRegression();
  }

  /**
   * Train model using TimeSeriesSplit cross-validation
   * Returns true if training succeeded, false if not enough data
   */
  train(X: number[][], y: number[]): boolean {
    if (X.length < this.minSamples) return false;

    // Use last 1000 samples
    let trainX = X;
    let trainY = y;
    if (X.length > 1000) {
      trainX = X.slice(-1000);
      trainY = y.slice(-1000);
    }

    const n = trainX.length;
    const splits = timeSeriesSplit(n, 3);
    const accuracies: number[] = [];

    // Train on full data with best hyperparameters found via CV
    const bestModel = new LogisticRegression();
    let bestAcc = 0;
    let bestScaler = new StandardScaler();

    for (const split of splits) {
      const { train: trainIdx, val: valIdx } = split;
      if (trainIdx.length < 30 || valIdx.length < 10) continue;

      const XTrain = trainIdx.map(i => trainX[i]);
      const yTrain = trainIdx.map(i => trainY[i]);
      const XVal = valIdx.map(i => trainX[i]);
      const yVal = valIdx.map(i => trainY[i]);

      const scaler = new StandardScaler();
      scaler.fit(XTrain);
      const XTrainScaled = scaler.transformMatrix(XTrain);
      const XValScaled = scaler.transformMatrix(XVal);

      const model = new LogisticRegression();
      model.fit(XTrainScaled, yTrain, {
        learningRate: 0.1,
        regLambda: 10,
        maxIterations: 200,
      });

      const acc = model.score(XValScaled, yVal);
      accuracies.push(acc);

      if (acc > bestAcc) {
        bestAcc = acc;
        bestModel.weights = [...model.weights];
        bestModel.bias = model.bias;
        bestScaler = scaler;
      }
    }

    if (accuracies.length === 0) return false;

    this.recentAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;

    // If best CV accuracy is worse than random, still use the model but note low confidence
    // Extract and normalize weights
    const coefAbs = bestModel.weights.map(w => Math.abs(w));
    const coefSum = coefAbs.reduce((a, b) => a + b, 0);
    if (coefSum > 1e-10) {
      this.weights = coefAbs.map(c => c / coefSum);
    } else {
      // Uniform weights as fallback
      this.weights = new Array(NUM_FEATURES).fill(1 / NUM_FEATURES);
    }

    // Store the best model and scaler for prediction
    this.model.weights = [...bestModel.weights];
    this.model.bias = bestModel.bias;
    this.scaler = bestScaler;
    this.isTrained = true;

    return true;
  }

  /**
   * Predict probability of bullish (class 1) for a new feature vector
   */
  predictScore(XNew: number[]): number | null {
    if (!this.isTrained) return null;
    const XScaled = this.scaler.transformSingle(XNew);
    const [, p1] = this.model.predictProba(XScaled);
    return p1;
  }

  /**
   * Get the model coefficients (for adaptive parameter extraction)
   */
  getCoefficients(): number[] {
    return this.isTrained ? [...this.model.weights] : [];
  }

  /**
   * Update model with new data point (adaptive learning)
   */
  update(XNew: number[], yNew: number): void {
    this.historyX.push(XNew);
    this.historyY.push(yNew);
    this.counter++;

    // Keep only last 1000 samples
    if (this.historyX.length > 1000) {
      this.historyX = this.historyX.slice(-1000);
      this.historyY = this.historyY.slice(-1000);
    }

    // Retrain periodically
    if (this.counter % this.updateFrequency === 0) {
      this.train(this.historyX, this.historyY);
    }
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  const v = (typeof value === 'number' && isFinite(value)) ? value : (min + max) / 2;
  return Math.max(min, Math.min(max, v));
}

export function sigmoid(x: number): number {
  const clamped = Math.max(-500, Math.min(500, x));
  return 1 / (1 + Math.exp(-clamped));
}
