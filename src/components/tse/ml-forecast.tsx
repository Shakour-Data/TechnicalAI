'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  toPersianDigits
} from '@/lib/jalali';
import { formatPriceFa } from '@/lib/format-price';
import {
  TrendingUp,
  TrendingDown,
  BrainCircuit,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Zap,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PredictionPoint {
  session: number;
  price: number;
  change_pct: number;
  lower: number;
  upper: number;
}

interface ModelForecast {
  model_name: string;
  cv_r2: number;
  cv_rmse_pct: number;
  predictions: PredictionPoint[];
}

interface EnsembleForecast {
  model_name: string;
  weights: Record<string, number>;
  predictions: PredictionPoint[];
}

interface MLPredictResult {
  status: string;
  training_samples: number;
  features_count: number;
  forecasts: Record<string, ModelForecast>;
  ensemble: EnsembleForecast;
  feature_importance: Record<string, number>;
}

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MLForecastProps {
  symbolName: string;
  candles: Candle[];
  currentPrice: number;
  priceDecimals?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  rf: '#059669',
  xgboost: '#d97706',
  lightgbm: '#7c3aed',
  svr: '#dc2626',
  gbr: '#2563eb',
};

const MODEL_LABELS: Record<string, string> = {
  rf: 'Random Forest',
  xgboost: 'XGBoost',
  lightgbm: 'LightGBM',
  svr: 'SVR',
  gbr: 'Gradient Boosting',
};

const SESSION_OPTIONS = [5, 10, 15, 20, 30];

const AVAILABLE_MODELS = ['rf', 'xgboost', 'svr', 'gbr'] as const;

// ─── Helper ──────────────────────────────────────────────────────────────────

// Price formatter: uses priceDecimals for price values, 0 default (integers)
const toFaDyn = (n: number, decimals: number) => formatPriceFa(n, decimals);
const toFaDecimalDyn = (n: number, decimals: number) => n.toLocaleString('fa-IR', { maximumFractionDigits: Math.max(decimals, 2) });

function r2Color(r2: number): string {
  if (r2 >= 0.5) return 'text-emerald-700';
  if (r2 >= 0.2) return 'text-amber-600';
  if (r2 >= 0) return 'text-orange-500';
  return 'text-red-600';
}

function r2Label(r2: number): string {
  if (r2 >= 0.7) return 'عالی';
  if (r2 >= 0.5) return 'خوب';
  if (r2 >= 0.3) return 'متوسط';
  if (r2 >= 0) return 'ضعیف';
  return 'نامناسب';
}

// ─── Mini Sparkline SVG ───────────────────────────────────────────────────────

function MiniSparkline({ predictions, color, width = 120, height = 40 }: { predictions: PredictionPoint[]; color: string; width?: number; height?: number }) {
  if (predictions.length < 2) return null;

  const prices = predictions.map(p => p.price);
  const min = Math.min(...prices, ...predictions.map(p => p.lower));
  const max = Math.max(...prices, ...predictions.map(p => p.upper));
  const range = max - min || 1;
  const pad = 4;

  const toX = (i: number) => pad + (i / (predictions.length - 1)) * (width - 2 * pad);
  const toY = (v: number) => pad + (1 - (v - min) / range) * (height - 2 * pad);

  // Main line
  const linePoints = predictions.map((p, i) => `${toX(i)},${toY(p.price)}`).join(' ');
  // Upper band
  const upperPoints = predictions.map((p, i) => `${toX(i)},${toY(p.upper)}`).join(' ');
  // Lower band
  const lowerPoints = predictions.map((p, i) => `${toX(i)},${toY(p.lower)}`).reverse().join(' ');
  // Fill area
  const fillPath = `M${upperPoints} L${lowerPoints} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10" style={{ minWidth: width }}>
      <defs>
        <linearGradient id={`fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#fill-${color.replace('#', '')})`} />
      <polyline points={upperPoints} fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="0.5" strokeDasharray="2,2" />
      <polyline points={predictions.map((p, i) => `${toX(i)},${toY(p.lower)}`).join(' ')} fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="0.5" strokeDasharray="2,2" />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {predictions.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.price)} r="1.5" fill={color} />
      ))}
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MLForecast({ symbolName, candles, currentPrice, priceDecimals }: MLForecastProps) {
  const [result, setResult] = useState<MLPredictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState(10);
  const [selectedModels, setSelectedModels] = useState<string[]>([...AVAILABLE_MODELS]);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [serviceModels, setServiceModels] = useState<string[]>([...AVAILABLE_MODELS]);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  // Derive decimals from prop (default 0 for TSE integers)
  const decimals = priceDecimals ?? 0;
  const toFa = (n: number) => toFaDyn(n, decimals);
  const toFaDecimal = (n: number) => toFaDecimalDyn(n, decimals);

  // Check ML service health on mount (auto-starts service if down)
  useEffect(() => {
    fetch('/api/ml-predict')
      .then(r => r.json())
      .then(data => {
        setServiceAvailable(data.status === 'ok');
        if (data.models_available) {
          setServiceModels(data.models_available);
          setSelectedModels(prev => prev.filter(m => data.models_available.includes(m)));
        }
      })
      .catch(() => setServiceAvailable(false));
  }, []);

  const runPrediction = useCallback(async () => {
    if (candles.length < 60) {
      setError('حداقل ۶۰ کندل داده برای پیش‌بینی ML نیاز است. داده‌های فعلی کافی نیست.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch('/api/ml-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candles, sessions, models: selectedModels }),
      });
      const json = await resp.json();
      if (json.error) {
        setError(json.error);
      } else {
        setResult(json);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای ناشناخته';
      // Auto-retry if service was starting
      if (msg.includes('راه‌اندازی') || msg.includes('دسترس نیست')) {
        setError('سرویس ML در حال راه‌اندازی است. لطفاً پس از ۱۰ ثانیه دوباره تلاش کنید.');
        // Re-check health after 10s
        setTimeout(() => {
          fetch('/api/ml-predict')
            .then(r => r.json())
            .then(data => setServiceAvailable(data.status === 'ok'))
            .catch(() => setServiceAvailable(false));
        }, 10000);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [candles, sessions, selectedModels]);

  // Feature importance sorted
  const topFeatures = useMemo(() => {
    if (!result?.feature_importance) return [];
    return Object.entries(result.feature_importance)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  }, [result]);

  // Ensemble predictions for chart
  const ensemblePredictions = result?.ensemble?.predictions ?? [];

  // Determine if ensemble is overall bullish/bearish
  const ensembleTrend = useMemo(() => {
    if (ensemblePredictions.length < 1) return 'neutral';
    const lastPred = ensemblePredictions[ensemblePredictions.length - 1];
    if (lastPred.change_pct > 1) return 'bullish';
    if (lastPred.change_pct < -1) return 'bearish';
    return 'neutral';
  }, [ensemblePredictions]);

  const trendIcon = ensembleTrend === 'bullish' ? TrendingUp : ensembleTrend === 'bearish' ? TrendingDown : BarChart3;
  const TrendIcon = trendIcon;
  const trendLabel = ensembleTrend === 'bullish' ? 'صعودی' : ensembleTrend === 'bearish' ? 'نزولی' : 'خنثی';
  const trendColor = ensembleTrend === 'bullish' ? 'text-emerald-700' : ensembleTrend === 'bearish' ? 'text-red-700' : 'text-amber-700';

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="rounded-2xl px-6 py-5 border border-violet-200 bg-gradient-to-l from-violet-50 to-white shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-violet-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">پیش‌بینی قیمت با هوش مصنوعی</h2>
              <p className="text-[10px] text-gray-500">۵ مدل ML × ۳۴ ویژگی تکنیکال — scikit-learn, XGBoost, LightGBM</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {serviceAvailable === false && (
              <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[10px] text-amber-600 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                در حال راه‌اندازی...
              </span>
            )}
            {serviceAvailable === true && (
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                آنلاین
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ CONTROLS ═══ */}
      <div className="rounded-2xl p-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {/* Sessions selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-gray-500 font-medium">تعداد جلسات پیش‌بینی</label>
            <div className="flex items-center gap-1 bg-[#f3f4f6] rounded-lg p-0.5 border border-[#e5e7eb]">
              {SESSION_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setSessions(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    sessions === s
                      ? 'bg-white text-violet-700 shadow-sm border border-[#e5e7eb]'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {toPersianDigits(String(s))}
                </button>
              ))}
            </div>
          </div>

          {/* Model toggles */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-gray-500 font-medium">مدل‌ها</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {serviceModels.map((key) => {
                const label = MODEL_LABELS[key] || key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedModels(prev =>
                      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                    )}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
                      selectedModels.includes(key)
                        ? 'border-current/30'
                        : 'border-gray-200 text-gray-400 opacity-50'
                    }`}
                    style={{
                      color: selectedModels.includes(key) ? MODEL_COLORS[key] : undefined,
                      background: selectedModels.includes(key) ? MODEL_COLORS[key] + '10' : undefined,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runPrediction}
            disabled={loading || selectedModels.length === 0 || candles.length < 60}
            className="mr-auto inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Zap className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />
            {loading ? 'در حال تحلیل...' : 'شروع پیش‌بینی'}
          </button>
        </div>

        {candles.length < 60 && (
          <p className="mt-3 text-[10px] text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            تعداد کندل‌های فعلی ({toPersianDigits(String(candles.length))}) کمتر از حداقل مورد نیاز (۶۰) است.
          </p>
        )}
      </div>

      {/* ═══ LOADING ═══ */}
      {loading && (
        <div className="rounded-2xl p-8 border border-violet-200 bg-violet-50/30">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
              <BrainCircuit className="w-5 h-5 text-violet-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-violet-800">در حال آموزش و پیش‌بینی مدل‌های ML ...</p>
              <p className="text-[10px] text-gray-500 mt-1">
                {toPersianDigits(String(selectedModels.length))} مدل × {toPersianDigits(String(sessions))} جلسه × ۳۴ ویژگی تکنیکال
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ERROR ═══ */}
      {error && !loading && (
        <div className="rounded-2xl p-5 border border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700">خطا در پیش‌بینی</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RESULTS ═══ */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl p-3 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
              <div className="text-[10px] text-gray-500">نمونه‌های آموزش</div>
              <div className="text-lg font-black text-gray-900">{toFa(result.training_samples)}</div>
            </div>
            <div className="rounded-xl p-3 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
              <div className="text-[10px] text-gray-500">ویژگی‌های تکنیکال</div>
              <div className="text-lg font-black text-gray-900">{toFa(result.features_count)}</div>
            </div>
            <div className="rounded-xl p-3 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
              <div className="text-[10px] text-gray-500">مدل‌های فعال</div>
              <div className="text-lg font-black text-violet-700">{toFa(Object.keys(result.forecasts).length)}</div>
            </div>
            <div className="rounded-xl p-3 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
              <div className="text-[10px] text-gray-500">روند ترکیبی (ML)</div>
              <div className={`flex items-center gap-1.5 text-lg font-black ${trendColor}`}>
                <TrendIcon className="w-4 h-4" />
                {trendLabel}
              </div>
            </div>
          </div>

          {/* ═══ ENSEMBLE CHART ═══ */}
          {ensemblePredictions.length > 0 && (
            <div className="rounded-2xl p-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-violet-600" />
                  پیش‌بینی ترکیبی (Ensemble)
                  <span className="px-2 py-0.5 rounded-full bg-violet-50 text-[10px] text-violet-700 font-medium">
                    R²-Weighted Average
                  </span>
                </h3>
                <button
                  onClick={() => setShowTable(!showTable)}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg border border-[#e5e7eb] text-[10px] text-gray-600 hover:bg-[#f3f4f6] transition-colors cursor-pointer"
                >
                  {showTable ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showTable ? 'نمودار' : 'جدول'}
                </button>
              </div>

              {/* Chart view */}
              {!showTable && (
                <div className="bg-[#f3f4f6]/50 rounded-xl p-4">
                  <MiniSparkline
                    predictions={ensemblePredictions}
                    color={ensembleTrend === 'bullish' ? '#059669' : ensembleTrend === 'bearish' ? '#dc2626' : '#d97706'}
                    width={600}
                    height={120}
                  />
                </div>
              )}

              {/* Table view */}
              {showTable && (
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#f3f4f6]">
                      <tr>
                        <th className="px-3 py-2 text-right text-gray-600 font-medium rounded-tr-lg">جلسه</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-medium">قیمت پیش‌بینی</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-medium">تغییر ٪</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-medium rounded-tl-lg">بازه اطمینان</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ensemblePredictions.map((p) => (
                        <tr key={p.session} className="border-t border-[#e5e7eb]">
                          <td className="px-3 py-2 font-medium text-gray-700">{toPersianDigits(String(p.session))}</td>
                          <td className="px-3 py-2 font-bold text-gray-900 tabular-nums" dir="ltr">{toFa(p.price)}</td>
                          <td className={`px-3 py-2 font-bold tabular-nums ${p.change_pct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {p.change_pct >= 0 ? '+' : ''}{toFaDecimal(p.change_pct)}%
                          </td>
                          <td className="px-3 py-2 text-gray-500 tabular-nums" dir="ltr">
                            {toFa(p.lower)} — {toFa(p.upper)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Ensemble weights */}
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(result.ensemble.weights).map(([key, w]) => (
                  <span
                    key={key}
                    className="px-2 py-0.5 rounded-full text-[9px] font-medium border"
                    style={{
                      color: MODEL_COLORS[key] || '#666',
                      borderColor: (MODEL_COLORS[key] || '#666') + '40',
                      background: (MODEL_COLORS[key] || '#666') + '10',
                    }}
                  >
                    {MODEL_LABELS[key] || key}: {toFaDecimal(w * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ═══ INDIVIDUAL MODELS ═══ */}
          <div className="rounded-2xl border border-[#e5e7eb] bg-[#ffffff] shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e5e7eb] bg-[#f3f4f6]/50">
              <h3 className="text-sm font-bold text-gray-900">نتایج مدل‌های فردی</h3>
            </div>
            <div className="divide-y divide-[#e5e7eb]">
              {Object.entries(result.forecasts).map(([key, model]) => {
                const isExpanded = expandedModel === key;
                const color = MODEL_COLORS[key] || '#666';
                const lastPred = model.predictions[model.predictions.length - 1];
                return (
                  <div key={key}>
                    <button
                      onClick={() => setExpandedModel(isExpanded ? null : key)}
                      className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#f3f4f6]/50 transition-colors cursor-pointer"
                    >
                      <div className="w-2 h-8 rounded-full" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{model.model_name}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${r2Color(model.cv_r2)} bg-gray-100`}>
                            R²: {toPersianDigits(model.cv_r2.toFixed(4))} ({r2Label(model.cv_r2)})
                          </span>
                          <span className="text-[10px] text-gray-400">RMSE: {toFaDecimal(model.cv_rmse_pct)}%</span>
                        </div>
                        {lastPred && (
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-gray-500">
                              پیش‌بینی S{toPersianDigits(String(lastPred.session))}: {toFa(lastPred.price)}
                            </span>
                            <span className={`text-[10px] font-bold ${lastPred.change_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {lastPred.change_pct >= 0 ? '+' : ''}{toFaDecimal(lastPred.change_pct)}%
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Mini sparkline */}
                      <div className="w-24 h-8 hidden sm:block">
                        <MiniSparkline predictions={model.predictions} color={color} width={96} height={32} />
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-1 bg-[#f3f4f6]/30">
                        <div className="overflow-x-auto max-h-48 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-[#f3f4f6]">
                              <tr>
                                <th className="px-2 py-1.5 text-right text-gray-600 font-medium">جلسه</th>
                                <th className="px-2 py-1.5 text-right text-gray-600 font-medium">قیمت</th>
                                <th className="px-2 py-1.5 text-right text-gray-600 font-medium">تغییر٪</th>
                                <th className="px-2 py-1.5 text-right text-gray-600 font-medium">بازه</th>
                              </tr>
                            </thead>
                            <tbody>
                              {model.predictions.map((p) => (
                                <tr key={p.session} className="border-t border-[#e5e7eb]">
                                  <td className="px-2 py-1.5 text-gray-600">{toPersianDigits(String(p.session))}</td>
                                  <td className="px-2 py-1.5 font-bold text-gray-900 tabular-nums" dir="ltr">{toFa(p.price)}</td>
                                  <td className={`px-2 py-1.5 font-bold tabular-nums ${p.change_pct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {p.change_pct >= 0 ? '+' : ''}{toFaDecimal(p.change_pct)}%
                                  </td>
                                  <td className="px-2 py-1.5 text-gray-500 tabular-nums" dir="ltr">
                                    {toFa(p.lower)}—{toFa(p.upper)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ FEATURE IMPORTANCE ═══ */}
          {topFeatures.length > 0 && (
            <div className="rounded-2xl p-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-600" />
                اهمیت ویژگی‌ها (Feature Importance)
              </h3>
              <div className="space-y-2">
                {topFeatures.map(([name, importance], i) => {
                  const maxImp = topFeatures[0][1];
                  const pct = maxImp > 0 ? (importance / maxImp) * 100 : 0;
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 w-4 text-left">{toPersianDigits(String(i + 1))}</span>
                      <span className="text-xs text-gray-700 w-28 truncate" dir="ltr" title={name}>{name}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-violet-500 to-violet-300 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 tabular-nums w-12 text-left">{importance.toFixed(4)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="rounded-xl p-3 bg-amber-50 border border-amber-200">
            <p className="text-[10px] text-amber-700 leading-relaxed">
              <strong>توجه:</strong> پیش‌بینی‌های ML بر اساس داده‌های تاریخی و ویژگی‌های تکنیکال تولید می‌شوند و
              ضامن عملکرد آینده نیستند. R² منفی نشان‌دهنده عملکرد ضعیف مدل روی داده‌های این نماد است.
              همیشه از تحلیل بنیادی و مدیریت ریسک در کنار این ابزار استفاده کنید.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
