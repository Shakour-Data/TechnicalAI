export interface PredictionPoint {
  session: number;
  date?: string;
  price: number;
  change_pct: number;
  lower: number;
  upper: number;
}

export interface ModelForecast {
  model_name: string;
  cv_r2: number;
  cv_rmse_pct: number;
  predictions: PredictionPoint[];
}

export interface EnsembleForecast {
  model_name: string;
  weights: Record<string, number>;
  predictions: PredictionPoint[];
}

export interface MLForecastResponse {
  status: string;
  symbol: string | null;
  training_samples: number;
  features_count: number;
  forecasts: Record<string, ModelForecast>;
  ensemble: EnsembleForecast;
  feature_importance: Record<string, number>;
  fallback?: boolean;
}

export interface DecompositionData {
  trend: number[];
  seasonal: number[];
  residual: number[];
  window: number;
  method: string;
}

export interface VolatilityData {
  annualized_volatility: number;
  regime: "low" | "medium" | "high";
  rolling_volatility: number[];
  volatility_quantiles: { q33: number; q66: number };
}

export interface TrendData {
  direction: "bullish" | "bearish" | "neutral";
  strength: number;
  short_ma: number[];
  long_ma: number[];
  crossovers: number;
}

export interface SeasonalityData {
  has_seasonality: boolean;
  seasonal_strength: number;
  period: number | null;
  method: string;
}

export interface DetailedAnalysisResponse extends MLForecastResponse {
  decomposition: DecompositionData;
  volatility: VolatilityData;
  trend: TrendData;
  seasonality: SeasonalityData;
  generated_at: string;
}

export interface QuickAnalysisResult {
  id: string;
  symbol: string;
  status: string;
  analysis_type: string;
  candles_used: number;
  ml_forecast: MLForecastResponse;
  generated_at: string;
}

export interface DetailedAnalysisResult {
  id: string;
  symbol: string;
  status: string;
  analysis_type: string;
  candles_used: number;
  date_range: string[];
  forecast: MLForecastResponse;
  decomposition: DecompositionData;
  volatility: VolatilityData;
  trend: TrendData;
  seasonality: SeasonalityData;
  generated_at: string;
}

export type AnalysisResult = QuickAnalysisResult | DetailedAnalysisResult;
