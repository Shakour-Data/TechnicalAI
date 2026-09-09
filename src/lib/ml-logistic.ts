// ═══════════════════════════════════════════════════════════════════════════════
// ML Logistic Regression Engine — Pure TypeScript, No External Dependencies
// Implements: StandardScaler, LogisticRegression (L2), TimeSeriesSplit
// Used by: ml-engine.ts (AdaptiveWeightModel)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── StandardScaler ──────────────────────────────────────────────────────────

/**
 * Standard score normalization (z-score) transformer.
 *
 * Computes per-feature mean and standard deviation from a training matrix,
 * then scales each value to (x - μ) / σ. Features with near-zero variance
 * (σ < 1e-8) are treated as constant and mapped to 0 after transformation.
 *
 * Follows the same API convention as scikit-learn's StandardScaler:
 *   fit → transform   or   fitTransform (convenience).
 */
export class StandardScaler {
  /** Per-feature arithmetic means computed during fit */
  mean: number[] = [];
  /** Per-feature standard deviations computed during fit */
  std: number[] = [];
  /** Number of features (columns) detected during fit */
  nFeatures = 0;
  private fitted = false;

  /**
   * Compute the mean and standard deviation for each feature column.
   *
   * Algorithm:
   *   1. Sum each column and divide by n to obtain the mean.
   *   2. Compute population variance (÷ n, not n−1) and take the square root.
   *   3. If any σ < 1e-8, clamp it to 1 to avoid division-by-zero in transform.
   *
   * @param X - Training data matrix (n_samples × n_features).
   *             Each inner array must have the same length.
   * @returns void — results are stored internally in `mean`, `std`, and `nFeatures`.
   */
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

  /**
   * Apply z-score normalization using the statistics from the most recent fit.
   *
   * Each element is transformed as:  x' = (x − μ) / σ.
   * If the scaler has not been fitted, the input is returned unchanged.
   * Features with σ ≤ 1e-10 are mapped to 0.
   *
   * @param X - Data matrix to transform (n_samples × n_features).
   *             Must have the same number of columns as the data used in fit.
   * @returns A new matrix with the same shape as X, containing standardized values.
   */
  transform(X: number[][]): number[][] {
    if (!this.fitted) return X;
    return X.map(row =>
      row.map((val, j) => (this.std[j] > 1e-10 ? (val - this.mean[j]) / this.std[j] : 0))
    );
  }

  /**
   * Convenience method: fit the scaler to X, then transform X in one call.
   *
   * Equivalent to `scaler.fit(X); return scaler.transform(X);` but avoids
   * the overhead of an extra iteration over the data.
   *
   * @param X - Training data matrix (n_samples × n_features).
   * @returns A new matrix with standardized values, same shape as X.
   */
  fitTransform(X: number[][]): number[][] {
    this.fit(X);
    return this.transform(X);
  }
}

// ─── Sigmoid (Numerically Stable) ─────────────────────────────────────────────

/**
 * Numerically stable sigmoid activation function.
 *
 * Uses two separate branches to avoid overflow in Math.exp:
 *   - For z ≥ 0: σ(z) = 1 / (1 + e^(−z))   — e^(−z) is small, no overflow.
 *   - For z < 0: σ(z) = e^z / (1 + e^z)     — e^z is small, no overflow.
 *
 * @param z - Input logit (raw linear combination of weights × features + bias).
 * @returns A value in the open interval (0, 1) representing P(class = 1).
 */
function sigmoid(z: number): number {
  if (z >= 0) {
    return 1 / (1 + Math.exp(-z));
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

/**
 * Binary logistic regression classifier with L2 regularization, trained via
 * batch gradient descent.
 *
 * The model learns a weight vector w and bias b such that:
 *   P(y = 1 | x) = σ(w · x + b)
 *
 * Key features:
 *   - **L2 regularization** with strength λ = 1 / C (applied to weights only,
 *     not the bias) to prevent overfitting.
 *   - **class_weight = 'balanced'** support — automatically up-weights the
 *     minority class so that the gradient contributions of both classes are equal.
 *   - **Early stopping** — halts when the L2 norm of the gradient vector falls
 *     below 1e-7.
 *   - **Random weight initialization** — weights are drawn from U(−0.005, 0.005)
 *     for better convergence than zero-initialization.
 */
export class LogisticRegressionModel {
  /** Learned feature weights (length = nFeatures after fit) */
  weights: number[] = [];
  /** Learned bias / intercept term */
  bias = 0;
  /** Number of features detected during fit */
  nFeatures = 0;
  /** Inverse regularization strength — smaller C ⇒ stronger L2 penalty */
  private readonly C: number;
  /** Maximum number of gradient descent iterations */
  private readonly maxIter: number;
  /** Learning rate (step size) for gradient descent */
  private readonly lr: number;

  /**
   * Create a new logistic regression model instance.
   *
   * @param C      - Inverse L2 regularization strength. Default 0.1 yields
   *                  moderate regularization (λ = 10). Increase to reduce
   *                  regularization; decrease to increase it.
   * @param maxIter - Maximum number of gradient descent iterations.
   * @param lr      - Learning rate for gradient descent updates.
   */
  constructor(C = 0.1, maxIter = 1000, lr = 0.01) {
    this.C = C;
    this.maxIter = maxIter;
    this.lr = lr;
  }

  /**
   * Train the logistic regression model on the given labeled data.
   *
   * Algorithm (batch gradient descent with L2 regularization):
   *   1. Initialize weights to small random values, bias to 0.
   *   2. If classWeight is 'balanced', compute per-class sample weights:
   *        w_pos = n / (2 × n_pos),  w_neg = n / (2 × n_neg)
   *      so that each class contributes equally to the gradient.
   *   3. For each iteration up to maxIter:
   *      a. Forward pass: compute σ(w · x_i + b) for every sample.
   *      b. Compute weighted gradients: dw_j = (1/n) Σ (σ_i − y_i) × x_ij × sw_i + λ × w_j / n
   *         db    = (1/n) Σ (σ_i − y_i) × sw_i
   *         where λ = 1/C and sw_i is the class weight for sample i.
   *      c. Update: w ← w − lr × dw,  b ← b − lr × db.
   *      d. Early stop if ‖[dw, db]‖₂ < 1e-7.
   *
   * @param X           - Feature matrix (n_samples × n_features). Must be non-empty.
   * @param y           - Binary label vector (1 = positive/bullish, 0 = negative/bearish).
   *                       Length must match X.length.
   * @param classWeight - 'balanced' to auto-balance class contributions, or null for
   *                       uniform (equal) weighting. Default is 'balanced'.
   * @returns void — learned parameters are stored in `weights` and `bias`.
   */
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

  /**
   * Predict class probabilities for each sample in the matrix.
   *
   * For each row x, computes p = σ(w · x + b) and returns [1−p, p],
   * where index 0 is P(bearish) and index 1 is P(bullish).
   *
   * @param X - Feature matrix (n_samples × n_features).
   * @returns An n_samples × 2 matrix where each row is [P(class 0), P(class 1)].
   */
  predict_proba(X: number[][]): number[][] {
    return X.map(row => {
      let z = this.bias;
      for (let j = 0; j < this.nFeatures; j++) z += row[j] * this.weights[j];
      const p = sigmoid(z);
      return [1 - p, p]; // [P(class 0=bearish), P(class 1=bullish)]
    });
  }

  /**
   * Predict class probabilities for a single feature vector.
   *
   * More efficient than predict_proba when only one sample is needed,
   * as it avoids creating intermediate arrays.
   *
   * @param x - Single feature vector of length n_features.
   * @returns A tuple [P(class 0 = bearish), P(class 1 = bullish)].
   */
  predict_proba_single(x: number[]): [number, number] {
    let z = this.bias;
    for (let j = 0; j < this.nFeatures; j++) z += x[j] * this.weights[j];
    const p = sigmoid(z);
    return [1 - p, p];
  }

  /**
   * Predict binary class labels for each sample.
   *
   * Assigns class 1 (bullish) when P(class 1) > 0.5, otherwise class 0 (bearish).
   *
   * @param X - Feature matrix (n_samples × n_features).
   * @returns An array of predicted labels (0 or 1), length n_samples.
   */
  predict(X: number[][]): number[] {
    return this.predict_proba(X).map(probs => probs[1] > 0.5 ? 1 : 0);
  }

  /**
   * Compute classification accuracy on the given test data.
   *
   * Accuracy = (number of correct predictions) / (total samples).
   * Returns 0.5 when y is empty (a neutral baseline).
   *
   * @param X - Feature matrix (n_samples × n_features).
   * @param y - True binary labels, same length as X.
   * @returns Accuracy in [0, 1]. Returns 0.5 for empty input.
   */
  score(X: number[][], y: number[]): number {
    const preds = this.predict(X);
    let correct = 0;
    for (let i = 0; i < y.length; i++) {
      if (preds[i] === y[i]) correct++;
    }
    return y.length > 0 ? correct / y.length : 0.5;
  }

  /**
   * Get absolute coefficient magnitudes normalized so they sum to 1.
   *
   * Useful for feature importance ranking: each value represents the
   * relative contribution of that feature to the decision boundary,
   * regardless of sign. If all weights are zero, returns uniform 1/n.
   *
   * @returns An array of non-negative values summing to 1, one per feature.
   */
  getNormalizedWeights(): number[] {
    const absW = this.weights.map(Math.abs);
    const total = absW.reduce((s, v) => s + v, 0);
    return total > 0 ? absW.map(w => w / total) : new Array(this.nFeatures).fill(1 / this.nFeatures);
  }

  /**
   * Get a shallow copy of the raw learned weight coefficients.
   *
   * Unlike getNormalizedWeights, this preserves sign information:
   *   - Positive coefficient → feature pushes prediction toward class 1 (bullish).
   *   - Negative coefficient → feature pushes prediction toward class 0 (bearish).
   *
   * @returns A new array containing the weight values (may be negative).
   */
  getCoefficients(): number[] {
    return [...this.weights];
  }
}

// ─── TimeSeriesSplit ─────────────────────────────────────────────────────────

/**
 * A single fold from time-series cross-validation.
 *
 * `train` and `val` are arrays of sample indices into the original dataset.
 * All train indices are strictly less than all val indices, preserving
 * temporal ordering (no future data leaks into training).
 */
export interface TSSplitFold {
  /** Sample indices for the training partition (always temporally before val) */
  train: number[];
  /** Sample indices for the validation partition (always temporally after train) */
  val: number[];
}

/**
 * Time-series cross-validation splitter that preserves temporal order.
 *
 * Unlike standard k-fold CV, this splitter guarantees that all training
 * indices precede all validation indices in every fold, preventing future
 * data from leaking into the training set — a critical requirement for
 * sequential / financial data.
 *
 * Algorithm:
 *   1. Divide the n samples into (nSplits + 1) equal-sized blocks.
 *   2. For fold i (0-indexed):
 *        - train = samples [0, …, foldSize × (i+1) − 1]
 *        - val   = samples [foldSize × (i+1), …, foldSize × (i+2) − 1]
 *   3. The training set grows with each fold, mimicking real-world deployment
 *      where more history becomes available over time.
 *   4. Returns an empty array if n < nSplits + 1 (not enough data to split).
 *
 * @param n       - Total number of samples in the dataset.
 * @param nSplits - Number of cross-validation folds. Default is 3.
 * @returns An array of TSSplitFold objects, one per fold. Each fold contains
 *          disjoint train and val index arrays with train < val.
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

/**
 * Ordered list of the 16 VDSS (Volatility-Driven Scoring System) feature names.
 *
 * The index of each name corresponds to its column position in the feature
 * matrix X used by LogisticRegressionModel and AdaptiveWeightModel.
 * Grouped by category:
 *   - f_ prefix → oscillator / momentum features (RSI, MFI, CCI, MACD, Stoch, etc.)
 *   - s_ prefix → structural / regime features (ADX, Bollinger, MAs, ATR, Trend, S/R)
 */
export const VDSS_FEATURE_NAMES = [
  'f_rsi', 'f_mfi', 'f_cci', 's_adx',
  'f_macd', 'f_stoch', 's_bb', 's_ma21', 's_ma100', 's_ema',
  's_atr', 's_trend', 's_sr',
  'f_stochCross', 'f_macdCross', 'f_div',
] as const;

/** Union type of all valid VDSS feature name strings */
export type VDSSFeatureName = typeof VDSS_FEATURE_NAMES[number];

/**
 * Complete result object returned by AdaptiveWeightModel.getResult().
 *
 * Contains the model's learned parameters, validation metrics, the most
 * recent prediction probability, and derived adaptive parameters that
 * downstream layers (scenario / edge calculators) consume.
 */
export interface AdaptiveModelResult {
  /** Normalized feature importance weights (sum = 1), one per VDSS feature */
  weights: number[];
  /** Raw logistic regression coefficients (may be negative, one per feature) */
  coefficients: number[];
  /** Average accuracy across all TimeSeriesSplit validation folds */
  recentAccuracy: number;
  /** Whether the model has been successfully trained on sufficient data */
  isTrained: boolean;
  /** Number of training samples used in the most recent train() call */
  sampleCount: number;
  /** P(bullish) for the most recent single-sample prediction, or null if none */
  predictionProb: number | null;
  /** Adaptive parameters derived from logistic regression coefficients */
  adaptiveParams: {
    /** Blend factor for momentum-based signals (e.g. RSI), derived from coefficient[0] */
    momentumFactor: number;
    /** Blend factor for volatility-based signals (e.g. ATR), derived from coefficient[10] */
    volatilityFactor: number;
    /** Blend factor for trend-based signals (e.g. trend score), derived from coefficient[11] */
    trendFactor: number;
  };
}

/**
 * AdaptiveWeightModel — the top-level ML pipeline that combines
 * StandardScaler + LogisticRegressionModel with TimeSeriesSplit validation.
 *
 * Orchestrates the full workflow:
 *   1. **train()**  — validates with 3-fold time-series CV, then fits the final
 *      model on all data. Stores normalized weights and raw coefficients.
 *   2. **predictScore()** — standardizes a single feature vector and returns
 *      P(bullish) from the logistic model.
 *   3. **predictBatch()** — batch prediction; returns [0.5, 0.5] fallback when
 *      the model is not trained.
 *   4. **getAdaptiveParams()** — maps learned coefficients to interpretable
 *      momentumFactor, volatilityFactor, trendFactor for downstream use.
 *   5. **getEdgeCoefficients()** — produces normalized coefficient weights for
 *      the edge/scenario calculation layer.
 *   6. **getResult()** — assembles the full AdaptiveModelResult for API responses.
 *
 * Designed for per-symbol training; each symbol maintains its own instance.
 */
export class AdaptiveWeightModel {
  /** Standard scaler for feature normalization */
  private scaler = new StandardScaler();
  /** Underlying logistic regression model (C=0.1, maxIter=1000, lr=0.01) */
  private model = new LogisticRegressionModel(0.1, 1000, 0.01);
  /** Cached normalized feature importance weights (sum=1), or null before training */
  private _weights: number[] | null = null;
  /** Cached raw logistic regression coefficients, or null before training */
  private _coefficients: number[] | null = null;
  /** Whether train() has been successfully called */
  private _isTrained = false;
  /** Average validation accuracy from the most recent train() */
  private _recentAccuracy = 0.5;
  /** Number of samples used in the most recent train() */
  private _sampleCount = 0;
  /** Most recent P(bullish) from predictScore(), or null */
  private _predictionProb: number | null = null;
  /** Minimum number of samples required before training is allowed */
  readonly minSamples: number;

  /**
   * Create a new AdaptiveWeightModel.
   *
   * @param minSamples - Minimum number of training samples required to trigger
   *                      training. Defaults to 70. If fewer samples are provided,
   *                      train() will return false.
   */
  constructor(minSamples = 70) {
    this.minSamples = minSamples;
  }

  /** Whether the model has been successfully trained */
  get isTrained() { return this._isTrained; }
  /** Average validation accuracy across time-series folds (0.5 before training) */
  get recentAccuracy() { return this._recentAccuracy; }
  /** Normalized feature importance weights (sum=1), or null before training */
  get weights() { return this._weights; }
  /** Raw logistic regression coefficients, or null before training */
  get coefficients() { return this._coefficients; }
  /** Number of samples used in the most recent training */
  get sampleCount() { return this._sampleCount; }

  /**
   * Train the adaptive weight model on historical feature data and binary labels.
   *
   * Pipeline:
   *   1. Validate: require at least minSamples rows and exactly 16 feature columns.
   *   2. TimeSeriesSplit: generate 3 folds that respect temporal order.
   *   3. For each fold:
   *        a. Fit a StandardScaler on the training partition only.
   *        b. Train a LogisticRegressionModel on the scaled training data.
   *        c. Evaluate accuracy on the scaled validation data.
   *   4. Fit the **final** model on ALL data (scaler + logistic regression).
   *   5. Cache normalized weights, raw coefficients, average validation accuracy.
   *
   * @param X - Feature matrix (n_samples × 16). Each row is a VDSS feature vector
   *            in the order defined by VDSS_FEATURE_NAMES.
   * @param y - Binary labels: 1 = bullish (5-day return > 1%), 0 = otherwise.
   *            Length must match X.length.
   * @returns true if training succeeded, false if insufficient data or no valid folds.
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

  /**
   * Predict the probability of a bullish outcome for a single feature vector.
   *
   * Standardizes the input using the fitted scaler, then applies the logistic
   * model to obtain P(bullish). Also caches the result in _predictionProb
   * for retrieval via getResult().
   *
   * @param xNew - A single feature vector of length 16, in VDSS_FEATURE_NAMES order.
   * @returns P(bullish) in (0, 1), or null if the model is not trained or the
   *          input is invalid (wrong length).
   */
  predictScore(xNew: number[]): number | null {
    if (!this._isTrained || !xNew || xNew.length !== 16) return null;
    const xScaled = this.scaler.transform([xNew])[0];
    const [_, pBull] = this.model.predict_proba_single(xScaled);
    this._predictionProb = pBull;
    return pBull;
  }

  /**
   * Extract interpretable adaptive parameters from the learned coefficients.
   *
   * Maps three key coefficients to factors in [0.5, 1.0] via the sigmoid function:
   *   - coefficient[0]  (f_rsi)  → momentumFactor  = 0.5 + 0.5 × σ(c₀)
   *   - coefficient[10] (s_atr)  → volatilityFactor = 0.5 + 0.5 × σ(c₁₀)
   *   - coefficient[11] (s_trend) → trendFactor     = 0.5 + 0.5 × σ(c₁₁)
   *
   * The sigmoid maps any real coefficient to (0, 1); the 0.5 + 0.5 × transform
   * shifts the range to (0.5, 1.0), ensuring factors never fully suppress a signal.
   *
   * If the model is not trained, returns conservative defaults:
   *   { momentumFactor: 0.7, volatilityFactor: 0.5, trendFactor: 0.6 }
   *
   * @returns An object with momentumFactor, volatilityFactor, and trendFactor,
   *          each in the range (0.5, 1.0) when the model is trained.
   */
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

  /**
   * Extract normalized edge weight coefficients from the learned model.
   *
   * Takes the absolute values of three key coefficients and normalizes them
   * to sum to 1, producing relative importance weights for the edge/scenario layer:
   *   - |coefficient[11]| (s_trend)  → trendCoef
   *   - |coefficient[0]|  (f_rsi)    → momentumCoef
   *   - |coefficient[10]| (s_atr)    → volatilityCoef
   *
   * If the model is not trained or all three coefficients are zero, returns
   * uniform weights: { trendCoef: 1/3, momentumCoef: 1/3, volatilityCoef: 1/3 }.
   *
   * @returns An object with trendCoef, momentumCoef, and volatilityCoef,
   *          each ≥ 0 and summing to 1.
   */
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

  /**
   * Assemble the complete result object for API responses.
   *
   * Aggregates all model state into a single AdaptiveModelResult:
   *   - weights:         normalized feature importances (falls back to uniform 1/16)
   *   - coefficients:    raw logistic regression coefficients (falls back to zeros)
   *   - recentAccuracy:  average TimeSeriesSplit validation accuracy
   *   - isTrained:       whether train() has succeeded
   *   - sampleCount:     number of training samples
   *   - predictionProb:  most recent P(bullish) from predictScore(), or null
   *   - adaptiveParams:  derived momentum/volatility/trend factors
   *
   * @returns A fully populated AdaptiveModelResult object.
   */
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
