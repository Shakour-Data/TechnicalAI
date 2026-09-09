// ═══════════════════════════════════════════════════════════════════════════════
// ML Predictor Client v9
// Communicates with the Python ML Training Service (port 3032)
// Handles: training requests, 30-session predictions, model management
// ═══════════════════════════════════════════════════════════════════════════════

const ML_SERVICE_BASE = 'http://localhost:3032';

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

// ─── Integration Helpers ────────────────────────────────────────────────────

/**
 * Convert ta-engine OHLCV to ML service format.
 */
export function convertToMLOHLCV(data: { date: string; open: number; high: number; low: number; close: number; volume: number }[]): OHLCVRow[] {
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
