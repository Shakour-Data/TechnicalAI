// ═══════════════════════════════════════════════════════════════════════════════
// ML Logistic Regression Engine — Pure TypeScript, No External Dependencies
// Implements: StandardScaler, LogisticRegression (L2), TimeSeriesSplit
// Used by: ml-engine.ts (AdaptiveWeightModel)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── StandardScaler ──────────────────────────────────────────────────────────

export class StandardScaler {
  mean: number[] = [];
  std: number[] = [];
  nFeatures = 0;
  private fitted = false;

  fit(X: number[][]): void {
    const n = X.length;
    this.nFeatures = X[0]?.length ?? 0;
    if (n === 0 || this.nFeatures === 0) return;

    this.mean = new Array(this.nFeatures).fill(0);
    this.std = new Array(this.nFeatures).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < this.nFeatures; j++) {
        this.mean[j] += X[i][j];
      }
    }
    for (let j = 0; j < this.nFeatures; j++) {
      this.mean[j] /= n;
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < this.nFeatures; j++) {
        const diff = X[i][j] - this.mean[j];
        this.std[j] += diff * diff;
      }
    }
    for (let j = 0; j < this.nFeatures; j++) {
      this.std[j] = Math.sqrt(this.std[j] / n);
      if (this.std[j] < 1e-8) this.std[j] = 1;
    }

    this.fitted = true;
  }

  transform(X: number[][]): number[][] {
    if (!this.fitted) return X;
    return X.map(row =>
      row.map((val, j) => (this.std[j] > 1e-10 ? (val - this.mean[j]) / this.std[j] : 0))
    );
  }

  fitTransform(X: number[][]): number[][] {
    this.fit(X);
    return this.transform(X);
  }
}

// ─── Sigmoid (Numerically Stable) ─────────────────────────────────────────────

function sigmoid(z: number): number {
  if (z >= 0) {
    return 1 / (1 + Math.exp(-z));
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

// ─── Logistic Regression with L2 Regularization ──────────────────────────────

export class LogisticRegressionModel {
  weights: number[] = [];
  bias = 0;
  nFeatures = 0;
  private readonly C: number;
  private readonly maxIter: number;
  private readonly lr: number;

  constructor(C = 0.1, maxIter = 1000, lr = 0.01) {
    this.C = C;
    this.maxIter = maxIter;
    this.lr = lr;
  }

  fit(X: number[][], y: number[], classWeight: 'balanced' | null = 'balanced'): void {
    const n = X.length;
    this.nFeatures = X[0]?.length ?? 0;
    if (n === 0 || this.nFeatures === 0) return;

    // Initialize weights to small random values for better convergence
    this.weights = Array.from({ length: this.nFeatures }, () => (Math.random() - 0.5) * 0.01);
    this.bias = 0;

    // Class weights for balanced classes
    let wPos = 1, wNeg = 1;
    if (classWeight === 'balanced') {
      const nPos = y.reduce((s, v) => s + v, 0);
      const nNeg = n - nPos;
      wPos = n / (2 * Math.max(nPos, 1));
      wNeg = n / (2 * Math.max(nNeg, 1));
    }

    const lambda = 1 / this.C; // L2 regularization strength
    const eps = 1e-12; // numerical stability

    for (let iter = 0; iter < this.maxIter; iter++) {
      // Forward pass: compute predictions
      const predictions: number[] = [];
      for (let i = 0; i < n; i++) {
        let z = this.bias;
        for (let j = 0; j < this.nFeatures; j++) {
          z += X[i][j] * this.weights[j];
        }
        predictions.push(sigmoid(z));
      }

      // Compute gradients
      const dw = new Array(this.nFeatures).fill(0);
      let db = 0;

      for (let i = 0; i < n; i++) {
        const error = predictions[i] - y[i];
        const sw = y[i] === 1 ? wPos : wNeg;

        for (let j = 0; j < this.nFeatures; j++) {
          dw[j] += error * X[i][j] * sw;
        }
        db += error * sw;
      }

      // Add L2 regularization (not to bias)
      for (let j = 0; j < this.nFeatures; j++) {
        dw[j] = dw[j] / n + lambda * this.weights[j] / n;
      }
      db /= n;

      // Gradient descent update
      for (let j = 0; j < this.nFeatures; j++) {
        this.weights[j] -= this.lr * dw[j];
      }
      this.bias -= this.lr * db;

      // Early stopping if gradients are tiny
      let gradNorm = 0;
      for (let j = 0; j < this.nFeatures; j++) gradNorm += dw[j] * dw[j];
      gradNorm = Math.sqrt(gradNorm + db * db);
      if (gradNorm < 1e-7) break;
    }
  }

  predict_proba(X: number[][]): number[][] {
    return X.map(row => {
      let z = this.bias;
      for (let j = 0; j < this.nFeatures; j++) z += row[j] * this.weights[j];
      const p = sigmoid(z);
      return [1 - p, p]; // [P(class 0=bearish), P(class 1=bullish)]
    });
  }

  predict_proba_single(x: number[]): [number, number] {
    let z = this.bias;
    for (let j = 0; j < this.nFeatures; j++) z += x[j] * this.weights[j];
    const p = sigmoid(z);
    return [1 - p, p];
  }

  predict(X: number[][]): number[] {
    return this.predict_proba(X).map(probs => probs[1] > 0.5 ? 1 : 0);
  }

  score(X: number[][], y: number[]): number {
    const preds = this.predict(X);
    let correct = 0;
    for (let i = 0; i < y.length; i++) {
      if (preds[i] === y[i]) correct++;
    }
    return y.length > 0 ? correct / y.length : 0.5;
  }

  /** Get absolute coefficient magnitudes normalized to sum=1 */
  getNormalizedWeights(): number[] {
    const absW = this.weights.map(Math.abs);
    const total = absW.reduce((s, v) => s + v, 0);
    return total > 0 ? absW.map(w => w / total) : new Array(this.nFeatures).fill(1 / this.nFeatures);
  }

  /** Get raw coefficients (can be negative) */
  getCoefficients(): number[] {
    return [...this.weights];
  }
}

// ─── TimeSeriesSplit ─────────────────────────────────────────────────────────

export interface TSSplitFold {
  train: number[];
  val: number[];
}

/**
 * Time Series Cross-Validation Splitter
 * Ensures training data always comes before validation data
 * @param n - Total number of samples
 * @param nSplits - Number of splits (default 3)
 */
export function timeSeriesSplit(n: number, nSplits = 3): TSSplitFold[] {
  const folds: TSSplitFold[] = [];
  if (n < nSplits + 1) return folds;

  const foldSize = Math.floor(n / (nSplits + 1));

  for (let i = 0; i < nSplits; i++) {
    const trainEnd = foldSize * (i + 1);
    const valEnd = Math.min(foldSize * (i + 2), n);

    if (valEnd <= trainEnd) continue;

    const train: number[] = [];
    for (let j = 0; j < trainEnd; j++) train.push(j);

    const val: number[] = [];
    for (let j = trainEnd; j < valEnd; j++) val.push(j);

    if (val.length > 0) folds.push({ train, val });
  }

  return folds;
}

// ─── Adaptive Weight Model ───────────────────────────────────────────────────

export const VDSS_FEATURE_NAMES = [
  'f_rsi', 'f_mfi', 'f_cci', 's_adx',
  'f_macd', 'f_stoch', 's_bb', 's_ma21', 's_ma100', 's_ema',
  's_atr', 's_trend', 's_sr',
  'f_stochCross', 'f_macdCross', 'f_div',
] as const;

export type VDSSFeatureName = typeof VDSS_FEATURE_NAMES[number];

export interface AdaptiveModelResult {
  weights: number[];           // normalized weights (sum=1), one per feature
  coefficients: number[];      // raw logistic regression coefficients
  recentAccuracy: number;      // average validation accuracy
  isTrained: boolean;
  sampleCount: number;
  predictionProb: number | null; // P(bullish) for current features
  // Adaptive parameters extracted from coefficients
  adaptiveParams: {
    momentumFactor: number;
    volatilityFactor: number;
    trendFactor: number;
  };
}

/**
 * AdaptiveWeightModel — Logistic Regression with TimeSeriesSplit validation.
 * Trains per-symbol, caches results, extracts weights for all VDss layers.
 */
export class AdaptiveWeightModel {
  private scaler = new StandardScaler();
  private model = new LogisticRegressionModel(0.1, 1000, 0.01);
  private _weights: number[] | null = null;
  private _coefficients: number[] | null = null;
  private _isTrained = false;
  private _recentAccuracy = 0.5;
  private _sampleCount = 0;
  private _predictionProb: number | null = null;
  readonly minSamples: number;

  constructor(minSamples = 70) {
    this.minSamples = minSamples;
  }

  get isTrained() { return this._isTrained; }
  get recentAccuracy() { return this._recentAccuracy; }
  get weights() { return this._weights; }
  get coefficients() { return this._coefficients; }
  get sampleCount() { return this._sampleCount; }

  /**
   * Train on historical feature data and binary labels.
   * Uses TimeSeriesSplit with 3 folds for validation.
   * @param X - Feature matrix (n_samples × 16)
   * @param y - Binary labels (1=bullish 5d return >1%, 0=otherwise)
   */
  train(X: number[][], y: number[]): boolean {
    if (X.length < this.minSamples || X[0]?.length !== 16) return false;

    const folds = timeSeriesSplit(X.length, 3);
    if (folds.length === 0) return false;

    const accuracies: number[] = [];

    for (const { train: trainIdx, val: valIdx } of folds) {
      const XTrain = trainIdx.map(i => X[i]);
      const yTrain = trainIdx.map(i => y[i]);
      const XVal = valIdx.map(i => X[i]);
      const yVal = valIdx.map(i => y[i]);

      // Standardize
      const scalerFold = new StandardScaler();
      const XTrainScaled = scalerFold.fitTransform(XTrain);
      const XValScaled = scalerFold.transform(XVal);

      // Train
      const modelFold = new LogisticRegressionModel(0.1, 1000, 0.01);
      modelFold.fit(XTrainScaled, yTrain, 'balanced');

      // Evaluate
      const acc = modelFold.score(XValScaled, yVal);
      accuracies.push(acc);
    }

    // Train final model on ALL data
    this.scaler.fitTransform(X);
    this.model.fit(this.scaler.transform(X), y, 'balanced');

    // Average validation accuracy
    this._recentAccuracy = accuracies.length > 0
      ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
      : 0.5;

    // Extract normalized weights
    this._weights = this.model.getNormalizedWeights();
    this._coefficients = this.model.getCoefficients();
    this._isTrained = true;
    this._sampleCount = X.length;

    return true;
  }

  /** Predict P(bullish) for a single feature vector */
  predictScore(xNew: number[]): number | null {
    if (!this._isTrained || !xNew || xNew.length !== 16) return null;
    const xScaled = this.scaler.transform([xNew])[0];
    const [_, pBull] = this.model.predict_proba_single(xScaled);
    this._predictionProb = pBull;
    return pBull;
  }

  /** Extract adaptive parameters from coefficients for scenario/edge calculations */
  getAdaptiveParams(): { momentumFactor: number; volatilityFactor: number; trendFactor: number } {
    if (!this._isTrained || !this._coefficients) {
      return { momentumFactor: 0.7, volatilityFactor: 0.5, trendFactor: 0.6 };
    }

    const c = this._coefficients;
    const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

    // Feature indices: 0=f_rsi, 10=s_atr, 11=s_trend
    const rsiCoef = c[0] ?? 0;
    const atrCoef = c[10] ?? 0;
    const trendCoef = c[11] ?? 0;

    return {
      momentumFactor: 0.5 + 0.5 * sigmoid(rsiCoef),
      volatilityFactor: 0.5 + 0.5 * sigmoid(atrCoef),
      trendFactor: 0.5 + 0.5 * sigmoid(trendCoef),
    };
  }

  /** Extract edge weight coefficients from model */
  getEdgeCoefficients(): { trendCoef: number; momentumCoef: number; volatilityCoef: number } {
    if (!this._isTrained || !this._coefficients) {
      return { trendCoef: 1 / 3, momentumCoef: 1 / 3, volatilityCoef: 1 / 3 };
    }

    const c = this._coefficients;
    const absTrend = Math.abs(c[11] ?? 0);   // s_trend
    const absMomentum = Math.abs(c[0] ?? 0); // f_rsi
    const absVolatility = Math.abs(c[10] ?? 0); // s_atr

    const total = absTrend + absMomentum + absVolatility;
    if (total === 0) return { trendCoef: 1 / 3, momentumCoef: 1 / 3, volatilityCoef: 1 / 3 };

    return {
      trendCoef: absTrend / total,
      momentumCoef: absMomentum / total,
      volatilityCoef: absVolatility / total,
    };
  }

  /** Get complete result for the API response */
  getResult(): AdaptiveModelResult {
    return {
      weights: this._weights ?? new Array(16).fill(1 / 16),
      coefficients: this._coefficients ?? new Array(16).fill(0),
      recentAccuracy: this._recentAccuracy,
      isTrained: this._isTrained,
      sampleCount: this._sampleCount,
      predictionProb: this._predictionProb,
      adaptiveParams: this.getAdaptiveParams(),
    };
  }
}
