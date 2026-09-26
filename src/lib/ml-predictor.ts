// ═══════════════════════════════════════════════════════════════════════════════
// ML Predictor Client v9
// Communicates with the Python ML Training Service (port 3032)
// Handles: training requests, 30-session predictions, model management
// ═══════════════════════════════════════════════════════════════════════════════

const ML_SERVICE_BASE = 'http://localhost:3040';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OHLCVRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PredictionSession {
  session: number;
  predicted_close: number;
  confidence: number;
  direction: 'up' | 'down' | 'neutral';
  change_pct: number;
}

export interface PredictionResult {
  sessions: PredictionSession[];
  overall_direction: 'up' | 'down' | 'neutral';
  overall_confidence: number;
  target_price_min: number;
  target_price_max: number;
  risk_level: 'low' | 'medium' | 'high';
}

export interface MLPredictionResponse {
  status: 'ok' | 'error';
  symbol?: string;
  prediction?: PredictionResult;
  models_used?: string[];
  current_features?: Record<string, number>;
  message?: string;
}

export interface TrainingMetrics {
  accuracy?: number;
  f1?: number;
  auc?: number;
  mae?: number;
  rmse?: number;
  r2?: number;
}

export interface TrainingResponse {
  status: 'ok' | 'error';
  symbol?: string;
  models_trained?: string[];
  metrics?: Record<string, TrainingMetrics>;
  feature_importance?: Record<string, number>;
  training_samples?: number;
  date_range?: string[];
  message?: string;
}

export interface ModelInfo {
  symbol: string;
  model_name: string;
  metrics?: TrainingMetrics;
  trained_at?: string;
  date_range?: string[];
}

export interface ModelsListResponse {
  status: 'ok' | 'error';
  models?: ModelInfo[];
  symbols?: string[];
  total_models?: number;
}

// ─── HTTP Client ─────────────────────────────────────────────────────────────

async function mlFetch<T>(path: string, options?: RequestInit, timeoutMs = 5000): Promise<T> {
  const url = `${ML_SERVICE_BASE}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    clearTimeout(timeout);
    return await res.json() as T;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { status: 'error', message: 'ML service timeout (30s)' } as T;
    }
    return { status: 'error', message: `ML service unavailable: ${err instanceof Error ? err.message : 'unknown'}` } as T;
  }
}

// ─── Training API ───────────────────────────────────────────────────────────

/**
 * Train ML models for a symbol using its OHLCV history.
 */
export async function trainModel(
  symbol: string,
  ohlcv: OHLCVRow[],
  models?: string[]
): Promise<TrainingResponse> {
  return mlFetch<TrainingResponse>('/train', {
    method: 'POST',
    body: JSON.stringify({
      symbol,
      ohlcv,
      models: models || ['xgboost_direction', 'xgboost_regression', 'ensemble_direction', 'ensemble_regression', 'volatility_model'],
    }),
  });
}

/**
 * Retrain all existing models with latest data.
 */
export async function retrainAllModels(
  ohlcvData: Record<string, OHLCVRow[]>
): Promise<{ status: string; results?: Record<string, TrainingResponse> }> {
  return mlFetch('/retrain-all', {
    method: 'POST',
    body: JSON.stringify({ ohlcv_data: ohlcvData }),
  });
}

// ─── Prediction API ─────────────────────────────────────────────────────────

/**
 * Get 30-session price prediction for a symbol.
 */
export async function predict30Sessions(
  symbol: string,
  ohlcv: OHLCVRow[],
  horizon: number = 30
): Promise<MLPredictionResponse> {
  return mlFetch<MLPredictionResponse>('/predict', {
    method: 'POST',
    body: JSON.stringify({ symbol, ohlcv, horizon }),
  }, 15000); // 15s timeout for ML prediction
}

// ─── Model Management API ───────────────────────────────────────────────────

/**
 * List all trained models.
 */
export async function listModels(): Promise<ModelsListResponse> {
  return mlFetch<ModelsListResponse>('/models');
}

/**
 * Get model info for a specific symbol.
 */
export async function getModelInfo(symbol: string): Promise<ModelsListResponse> {
  return mlFetch<ModelsListResponse>(`/models/${encodeURIComponent(symbol)}`);
}

/**
 * Check ML service health.
 */
export async function checkMLHealth(): Promise<{ status: string; cached_symbols?: string[] }> {
  return mlFetch('/health');
}

// ─── Batch Prediction API ────────────────────────────────────────────────────

/**
 * Batch prediction result containing multiple model predictions.
 * Optimized to reuse feature extraction and scaling across models.
 */
export interface BatchPredictionResult {
  status: 'ok' | 'error';
  symbol: string;
  batch_results: Record<string, {
    raw_prediction: number[];
    is_onnx: boolean;
  }>;
  n_samples: number;
  feature_count: number;
  message?: string;
}

/**
 * Batch prediction for a symbol using multiple models at once.
 * Reuses feature extraction to reduce redundant computation.
 *
 * @param symbol - Ticker/symbol identifier
 * @param ohlcv - OHLCV data (up to 120 most recent candles used)
 * @param nSteps - Prediction horizon (1-90 steps)
 * @returns Batch prediction results from all available models
 */
export async function batchPredict(
  symbol: string,
  ohlcv: OHLCVRow[],
  nSteps: number = 30
): Promise<BatchPredictionResult | null> {
  try {
    const res = await callMLService<BatchPredictionResult>('/batch-predict', {
      symbol,
      ohlcv: ohlcv.slice(-120),
      n_steps: Math.min(nSteps, 90),
    });
    return res;
  } catch {
    return null;
  }
}

/**
 * Compute Population Stability Index for drift detection.
 */
export interface DriftReport {
  feature_stability: Record<string, {
    psi: number;
    zscore: number;
    ref_mean: number;
    ref_std: number;
    current_mean: number;
    current_std: number;
    has_drift: boolean;
    has_outliers: boolean;
  }>;
  problematic_features: Array<{
    feature: string;
    psi: number;
    zscore: number;
    has_drift: boolean;
    has_outliers: boolean;
    ref_mean: number;
    ref_std: number;
    current_mean: number;
    current_std: number;
  }>;
  drift_summary: {
    total_features: number;
    drifted_features: number;
    outlier_features: number;
    max_psi: number;
  };
  statistics?: {
    reference: { mean: Record<string, number>; std: Record<string, number>; count: number };
    current: { mean: Record<string, number>; std: Record<string, number>; count: number };
    correlation: Record<string, number>;
  };
}

/**
 * Compute drift report comparing current data to reference distribution.
 */
export async function computeDriftReport(
  symbol: string,
  ohlcv: OHLCVRow[],
  reference?: OHLCVRow[]
): Promise<DriftReport | null> {
  try {
    const res = await callMLService<DriftReport>('/drift', {
      symbol,
      ohlcv: ohlcv.slice(-120),
      reference: reference || undefined,
    });
    return res;
  } catch {
    return null;
  }
}

/**
 * Quantize a model for faster inference (INT8 quantization).
 */
export interface QuantizeResult {
  status: 'ok' | 'error';
  quantized: boolean;
  model: string;
}

/**
 * Request model quantization to INT8 for faster inference.
 */
export async function quantizeModel(
  symbol: string,
  modelName: string
): Promise<QuantizeResult | null> {
  try {
    const res = await callMLService<QuantizeResult>('/quantize', {
      symbol,
      model_name: modelName,
    });
    return res;
  } catch {
    return null;
  }
}

// ─── Model Registry & Versioning ────────────────────────────────────────────

/**
 * Model metadata from the registry.
 */
export interface ModelRegistryEntry {
  symbol: string;
  model_name: string;
  version: string;
  stage: 'development' | 'staging' | 'production';
  metrics: TrainingMetrics;
  trained_at: string;
  feature_count: number;
  training_samples: number;
}

/**
 * List models from the registry with stage information.
 */
export interface ModelsListResponse {
  status: 'ok' | 'error';
  models?: ModelRegistryEntry[];
  symbols?: string[];
  total_models?: number;
}

/**
 * List all models in the registry with versioning info.
 */
export async function listRegistryModels(): Promise<ModelsListResponse> {
  return mlFetch<ModelsListResponse>('/models/registry');
}

/**
 * Promote a model to a specific stage (staging/production).
 */
export interface PromoteModelResult {
  status: 'ok' | 'error';
  symbol: string;
  model_name: string;
  stage: string;
  message?: string;
}

/**
 * Promote a model version to a stage (staging/production).
 */
export async function promoteModel(
  symbol: string,
  modelName: string,
  stage: 'staging' | 'production'
): Promise<PromoteModelResult | null> {
  try {
    const res = await mlFetch<PromoteModelResult>('/models/promote', {
      method: 'POST',
      body: JSON.stringify({ symbol, model_name: modelName, stage }),
    });
    return res;
  } catch {
    return null;
  }
}

/**
 * Compare two model versions for A/B testing.
 */
export interface ModelComparisonResult {
  status: 'ok' | 'error';
  model_a: ModelRegistryEntry;
  model_b: ModelRegistryEntry;
  comparison: {
    metric: string;
    model_a_score: number;
    model_b_score: number;
    winner: 'A' | 'B' | 'TIE';
    improvement_pct: number;
  }[];
}

/**
 * Compare two model versions for A/B testing.
 */
export async function compareModels(
  symbol: string,
  modelA: string,
  modelB: string
): Promise<ModelComparisonResult | null> {
  try {
    const res = await callMLService<ModelComparisonResult>('/models/compare', {
      symbol,
      model_a: modelA,
      model_b: modelB,
    });
    return res;
  } catch {
    return null;
  }
}

// ─── Integration Helpers ────────────────────────────────────────────────────

/**
 * Convert ta-engine OHLCV to ML service format.
 */
export function convertOHLCVForML(data: { date: Date | string; open: number; high: number; low: number; close: number; volume: number }[]): { date: string; open: number; high: number; low: number; close: number; volume: number }[] {
  return data.map(d => ({
     date: typeof d.date === 'string' ? d.date : new Date(d.date).toISOString().split('T')[0],
     open: d.open,
     high: d.high,
     low: d.low,
     close: d.close,
     volume: d.volume || 0,
   }));
}

/**
 * Generate a Persian summary of ML prediction for narrative use.
 */
export function generateMLPredictionSummary(prediction: PredictionResult, currentPrice: number): string {
  const dirMap = { up: 'صعودی', down: 'نزولی', neutral: 'خنثی' };
  const riskMap = { low: 'پایین', medium: 'متوسط', high: 'بالا' };

  const confPercent = Math.round(prediction.overall_confidence * 100);
  const dir = dirMap[prediction.overall_direction];
  const risk = riskMap[prediction.risk_level];
  const changeToMin = ((prediction.target_price_min - currentPrice) / currentPrice * 100).toFixed(1);
  const changeToMax = ((prediction.target_price_max - currentPrice) / currentPrice * 100).toFixed(1);

  let text = `پیش‌بینی مدل ML (۳۰ جلسه): `;
  text += `جهت غالب ${dir} با اطمینان ${confPercent}٪. `;
  text += `محدود هدف: ${prediction.target_price_min.toLocaleString('fa-IR')} تا ${prediction.target_price_max.toLocaleString('fa-IR')} `;
  text += `(${Number(changeToMin) > 0 ? '+' : ''}${changeToMin}٪ تا ${Number(changeToMax) > 0 ? '+' : ''}${changeToMax}٪). `;
  text += `سطح ریسک: ${risk}.`;

  return text;
}

/**
 * Get prediction sessions formatted for chart display.
 */
export function getPredictionChartData(
  prediction: PredictionResult,
  lastDate: string
): { date: string; value: number; confidence: number }[] {
  const baseDate = new Date(lastDate);
  return prediction.sessions.map(s => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + s.session);
    return {
      date: d.toISOString().split('T')[0],
      value: s.predicted_close,
      confidence: s.confidence,
    };
  });
}
