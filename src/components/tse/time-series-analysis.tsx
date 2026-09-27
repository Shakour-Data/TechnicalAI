"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Chart,
  ChartData,
  ChartOptions,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Legend,
  Filler,
  Tooltip,
  BarController,
  BarElement,
  CategoryScale,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { BrainCircuit, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, BarChart3, Zap, Download, TrendingUp, TrendingDown, Clock, Loader2 } from "lucide-react";
import { formatPriceFa } from "@/lib/format-price";
import { toPersianDigits } from "@/lib/jalali";
import { toast } from "@/hooks/use-toast";
import type {
  PredictionPoint,
  ModelForecast,
  EnsembleForecast,
  MLForecastResponse,
  DecompositionData,
  VolatilityData,
  TrendData,
  SeasonalityData,
  DetailedAnalysisResponse,
  QuickAnalysisResult,
  DetailedAnalysisResult,
} from "@/lib/time-series-types";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Legend,
  Filler,
  Tooltip,
  BarController,
  BarElement,
  CategoryScale
);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const MODEL_COLORS: Record<string, string> = {
  rf: "#059669",
  xgboost: "#d97706",
  lightgbm: "#7c3aed",
  svr: "#dc2626",
  gbr: "#2563eb",
};

const MODEL_LABELS: Record<string, string> = {
  rf: "Random Forest",
  xgboost: "XGBoost",
  lightgbm: "LightGBM",
  svr: "SVR",
  gbr: "Gradient Boosting",
};

type ModelName = "rf" | "xgboost" | "lightgbm" | "gbr" | "svr" | "ensemble";
type AnalysisMode = "quick" | "detailed";

const ML_MODELS: Array<{ key: ModelName; label: string; color: string }> = [
  { key: "rf", label: "Random Forest", color: "rgb(16, 185, 129)" },
  { key: "xgboost", label: "XGBoost", color: "rgb(245, 158, 11)" },
  { key: "lightgbm", label: "LightGBM", color: "rgb(139, 92, 246)" },
  { key: "gbr", label: "Gradient Boosting", color: "rgb(59, 130, 246)" },
  { key: "svr", label: "SVR", color: "rgb(239, 68, 68)" },
  { key: "ensemble", label: "Ensemble (Weighted)", color: "rgb(236, 72, 153)" },
];

const SESSION_OPTIONS = [5, 10, 15, 20, 30];
const AVAILABLE_MODELS: Array<{ key: string; label: string; color: string }> = [
  { key: "rf", label: MODEL_LABELS.rf, color: MODEL_COLORS.rf },
  { key: "xgboost", label: MODEL_LABELS.xgboost, color: MODEL_COLORS.xgboost },
  { key: "lightgbm", label: MODEL_LABELS.lightgbm, color: MODEL_COLORS.lightgbm },
  { key: "gbr", label: MODEL_LABELS.gbr, color: MODEL_COLORS.gbr },
  { key: "svr", label: MODEL_LABELS.svr, color: MODEL_COLORS.svr },
];

function MiniSparkline({ predictions, color, width = 120, height = 40 }: {
  predictions: PredictionPoint[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (predictions.length < 2) return null;
  const prices = predictions.map((p) => p.price);
  const min = Math.min(...prices, ...predictions.map((p) => p.lower));
  const max = Math.max(...prices, ...predictions.map((p) => p.upper));
  const range = max - min || 1;
  const pad = 4;
  const toX = (i: number) => pad + (i / (predictions.length - 1)) * (width - 2 * pad);
  const toY = (v: number) => pad + (1 - (v - min) / range) * (height - 2 * pad);
  const linePoints = predictions.map((p, i) => `${toX(i)},${toY(p.price)}`).join(" ");
  const upperPoints = predictions.map((p, i) => `${toX(i)},${toY(p.upper)}`).join(" ");
  const lowerPoints = predictions.map((p, i) => `${toX(i)},${toY(p.lower)}`).reverse().join(" ");
  const fillPath = `M${upperPoints} L${lowerPoints} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10" style={{ minWidth: width }}>
      <defs>
        <linearGradient id={`fill-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#fill-${color.replace("#", "")})`} />
      <polyline points={upperPoints} fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="0.5" strokeDasharray="2,2" />
      <polyline points={predictions.map((p, i) => `${toX(i)},${toY(p.lower)}`).join(" ")} fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="0.5" strokeDasharray="2,2" />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {predictions.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.price)} r="1.5" fill={color} />
      ))}
    </svg>
  );
}

function r2Color(r2: number): string {
  if (r2 >= 0.5) return "text-emerald-700";
  if (r2 >= 0.2) return "text-amber-600";
  if (r2 >= 0) return "text-orange-500";
  return "text-red-600";
}

function r2Label(r2: number): string {
  if (r2 >= 0.7) return "عالی";
  if (r2 >= 0.5) return "خوب";
  if (r2 >= 0.3) return "متوسط";
  if (r2 >= 0) return "ضعیف";
  return "نامناسب";
}

export interface TimeSeriesAnalysisProps {
  symbol: string;
  candles: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
  currentPrice: number;
  priceDecimals?: number;
  defaultMode?: "quick" | "detailed";
}

export default function TimeSeriesAnalysis({
  symbol,
  candles,
  currentPrice,
  priceDecimals,
  defaultMode = "quick",
}: TimeSeriesAnalysisProps) {
  const decimals = priceDecimals ?? 0;
  const toFa = (n: number) => formatPriceFa(n, decimals);
  const toFaDecimal = (n: number) => n.toLocaleString("fa-IR", { maximumFractionDigits: Math.max(decimals, 2) });

  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(defaultMode);
  const [forecastSteps, setForecastSteps] = useState(30);
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [selectedModel, setSelectedModel] = useState<ModelName>("ensemble");
  const [selectedModels, setSelectedModels] = useState<string[]>(["rf", "xgboost", "lightgbm", "gbr"]);
  const [mlResult, setMlResult] = useState<MLForecastResponse | null>(null);
  const [detailedResult, setDetailedResult] = useState<DetailedAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const mainChartRef = useRef<HTMLCanvasElement>(null);
  const mainChartInstanceRef = useRef<Chart | null>(null);
  const decompositionChartRef = useRef<HTMLCanvasElement>(null);
  const decompositionChartInstanceRef = useRef<Chart | null>(null);
  const featureChartRef = useRef<HTMLCanvasElement>(null);
  const featureChartInstanceRef = useRef<Chart | null>(null);
  const volatilityChartRef = useRef<HTMLCanvasElement>(null);
  const volatilityChartInstanceRef = useRef<Chart | null>(null);

  const cleanupCharts = useCallback(() => {
    [mainChartInstanceRef, decompositionChartInstanceRef, featureChartInstanceRef, volatilityChartInstanceRef].forEach((ref) => {
      if (ref.current) {
        ref.current.destroy();
        ref.current = null;
      }
    });
  }, []);

  useEffect(() => {
    return cleanupCharts;
  }, [cleanupCharts]);

  const candleData = useMemo(() => {
    if (candles && candles.length > 30) {
      return candles.map((c) => c.close);
    }
    return [];
  }, [candles]);

  const checkMLService = useCallback(async () => {
    try {
      const resp = await fetch("/api/ml-predict", { method: "GET" });
      setServiceAvailable(resp.ok);
      return resp.ok;
    } catch {
      setServiceAvailable(false);
      return false;
    }
  }, []);

  useEffect(() => {
    checkMLService();
  }, [checkMLService]);

  const runAnalysis = useCallback(async () => {
    if (candleData.length < 60) {
      setError("حداقل ۶۰ کندل برای تحلیل سری زمانی نیاز است");
      toast({ title: "خطا", description: "داده کافی نیست", variant: "destructive" });
      return;
    }
    setLoading(true);
    setError(null);
    cleanupCharts();

    try {
      const resp = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          analysis_type: "time_series",
          horizon: forecastSteps,
          mode: analysisMode,
          model_keys: selectedModels,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }

      const data = await resp.json();

      if (analysisMode === "detailed" && data.status === "completed") {
        setDetailedResult(data);
        setMlResult(data.forecast);
      } else {
        setMlResult(data);
        setDetailedResult(null);
      }

      setTimeout(() => {
        renderMainChart(data);
        if (data.feature_importance && Object.keys(data.feature_importance).length > 0) {
          renderFeatureChart(data.feature_importance);
        }
      }, 100);

      toast({ title: "موفق", description: "تحلیل سری زمانی انجام شد" });
    } catch (err: any) {
      const msg = err?.message || "تحلیل ناموفق بود";
      setError(msg);
      toast({ title: "خطا", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [candleData, symbol, forecastSteps, analysisMode, selectedModels, cleanupCharts]);

  // Auto-run when data is available
  useEffect(() => {
    if (candleData.length >= 60 && serviceAvailable !== false) {
      const timer = setTimeout(() => runAnalysis(), 500);
      return () => clearTimeout(timer);
    }
  }, [candleData, runAnalysis, serviceAvailable]);

  // ─── Chart Rendering ──────────────────────────────────────────

  const renderMainChart = (data: MLForecastResponse | DetailedAnalysisResponse) => {
    if (!mainChartRef.current) return;
    if (mainChartInstanceRef.current) {
      mainChartInstanceRef.current.destroy();
    }

    const forecasts = data.forecasts || {};
    let forecast: PredictionPoint[] = [];
    let modelName = "";
    let color = "rgb(59, 130, 246)";

    if (selectedModel === "ensemble" && data.ensemble?.predictions) {
      forecast = data.ensemble.predictions;
      modelName = "Ensemble";
      color = "rgb(236, 72, 153)";
    } else {
      const modelKey = selectedModel;
      const modelForecast = forecasts[modelKey];
      if (modelForecast?.predictions) {
        forecast = modelForecast.predictions;
        modelName = modelForecast.model_name;
        const modelDef = ML_MODELS.find((m) => m.key === modelKey);
        color = modelDef?.color || "rgb(59, 130, 246)";
      }
    }

    if (!forecast.length) return;

    const labels = forecast.map((p) => p.date || `S${p.session}`);
    const dataset: any = {
      label: `${modelName} Forecast`,
      data: forecast.map((p) => p.price),
      borderColor: color,
      backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.1)"),
      borderWidth: 2,
      pointRadius: 1,
      tension: 0.3,
      fill: true,
      upperBound: forecast.map((p) => p.upper),
      lowerBound: forecast.map((p) => p.lower),
      fillTarget: "-1",
      backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.05)"),
    };

    const chartData: ChartData<"line"> = {
      labels,
      datasets: [dataset],
    };

    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: `${symbol} - ${modelName} Forecast (${forecast.length} steps)` },
        legend: { display: true },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(0,0,0,0.05)" } },
      },
      interaction: { mode: "nearest", axis: "x", intersect: false },
    };

    mainChartInstanceRef.current = new Chart(mainChartRef.current, { type: "line", data: chartData, options });
  };

  const renderDecompositionChart = () => {
    if (!decompositionChartRef.current || !detailedResult) return;
    if (decompositionChartInstanceRef.current) {
      decompositionChartInstanceRef.current.destroy();
    }

    const decomp = detailedResult.decomposition;
    if (!decomp.trend.length) return;

    const labels = decomp.trend.map((_, i) => i.toString());

    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        { label: "Trend", data: decomp.trend, borderColor: "rgb(59, 130, 246)", backgroundColor: "rgba(59, 130, 246, 0.1)", borderWidth: 2, pointRadius: 0, fill: true },
        { label: "Seasonal", data: decomp.seasonal, borderColor: "rgb(16, 185, 129)", backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 2, pointRadius: 0, fill: true },
        { label: "Residual", data: decomp.residual, borderColor: "rgb(239, 68, 68)", backgroundColor: "rgba(239, 68, 68, 0.1)", borderWidth: 2, pointRadius: 0, fill: true },
      ],
    };

    decompositionChartInstanceRef.current = new Chart(decompositionChartRef.current, {
      type: "line",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: "Decomposition (Trend/Seasonal/Residual)" }, legend: { display: true } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(0,0,0,0.05)" } } },
      },
    });
  };

  const renderFeatureChart = (featureImportance: Record<string, number>) => {
    if (!featureChartRef.current) return;
    if (featureChartInstanceRef.current) {
      featureChartInstanceRef.current.destroy();
    }

    const sorted = Object.entries(featureImportance).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const labels = sorted.map(([k]) => k);
    const values = sorted.map(([, v]) => v);

    const chartData: ChartData<"bar"> = {
      labels,
      datasets: [{ label: "Feature Importance", data: values, backgroundColor: "rgba(59, 130, 246, 0.6)", borderColor: "rgb(59, 130, 246)", borderWidth: 1 }],
    };

    featureChartInstanceRef.current = new Chart(featureChartRef.current, {
      type: "bar",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: { title: { display: true, text: "Top 15 Feature Importance" }, legend: { display: false } },
        scales: { x: { grid: { color: "rgba(0,0,0,0.05)" } }, y: { grid: { display: false } } },
      },
    });
  };

  const renderVolatilityChart = () => {
    if (!volatilityChartRef.current || !detailedResult) return;
    if (volatilityChartInstanceRef.current) {
      volatilityChartInstanceRef.current.destroy();
    }

    const vol = detailedResult.volatility.rolling_volatility;
    const labels = vol.map((_, i) => i.toString());
    const q33 = detailedResult.volatility.volatility_quantiles.q33;
    const q66 = detailedResult.volatility.volatility_quantiles.q66;

    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        { label: "Rolling Volatility", data: vol, borderColor: "rgb(245, 158, 11)", backgroundColor: "rgba(245, 158, 11, 0.1)", borderWidth: 2, pointRadius: 0, fill: true },
        { label: "Q33", data: Array(labels.length).fill(q33), borderColor: "rgba(16, 185, 129, 0.5)", borderWidth: 1, borderDash: [5, 5], pointRadius: 0, fill: false },
        { label: "Q66", data: Array(labels.length).fill(q66), borderColor: "rgba(239, 68, 68, 0.5)", borderWidth: 1, borderDash: [5, 5], pointRadius: 0, fill: false },
      ],
    };

    volatilityChartInstanceRef.current = new Chart(volatilityChartRef.current, {
      type: "line",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: `Volatility Regime: ${detailedResult.volatility.regime.toUpperCase()}` }, legend: { display: true } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(0,0,0,0.05)" } } },
      },
    });
  };

  useEffect(() => {
    if (detailedResult) {
      renderDecompositionChart();
      renderVolatilityChart();
    }
  }, [detailedResult]);

  useEffect(() => {
    if (mlResult) {
      renderMainChart(mlResult);
      if (mlResult.feature_importance && Object.keys(mlResult.feature_importance).length > 0) {
        renderFeatureChart(mlResult.feature_importance);
      }
    }
  }, [mlResult, selectedModel]);

  // ─── Derived data ───────────────────────────────────────────

  const result = mlResult || (detailedResult ? detailedResult.forecast : null);
  const activeForecast = (result?.ensemble?.predictions ?? []) as any[];
  const activeModelName = selectedModel === "ensemble" ? "Ensemble" : selectedModel;

  const topFeatures = useMemo(() => {
    if (!result?.feature_importance) return [];
    return Object.entries(result.feature_importance)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  }, [result]);

  const ensembleTrend = useMemo(() => {
    if (activeForecast.length < 1) return "neutral";
    const lastPred = activeForecast[activeForecast.length - 1];
    if (lastPred.change_pct > 1) return "bullish";
    if (lastPred.change_pct < -1) return "bearish";
    return "neutral";
  }, [activeForecast]);

  const exportCSV = useCallback(() => {
    if (!activeForecast.length) return;
    const rows = ["session,date,price,change_pct,lower,upper"];
    activeForecast.forEach((p) => {
      rows.push(`${p.session},${p.date || ""},${p.price},${p.change_pct || ""},${p.lowerBound || ""},${p.upperBound || ""}`);
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${symbol}_forecast.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "دانلود", description: "فایل CSV دانلود شد" });
  }, [activeForecast, symbol]);

  const exportJSON = useCallback(() => {
    const data = analysisMode === "detailed" ? detailedResult : mlResult;
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${symbol}_analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "دانلود", description: "فایل JSON دانلود شد" });
  }, [detailedResult, mlResult, analysisMode, symbol]);

  const trendIcon = ensembleTrend === "bullish" ? TrendingUp : ensembleTrend === "bearish" ? TrendingDown : BarChart3;
  const TrendIcon = trendIcon;
  const trendLabel = ensembleTrend === "bullish" ? "صعودی" : ensembleTrend === "bearish" ? "نزولی" : "خنثی";
  const trendColor = ensembleTrend === "bullish" ? "text-emerald-700" : ensembleTrend === "bearish" ? "text-red-700" : "text-amber-700";

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
              <h2 className="text-base font-bold text-gray-900">تحلیل سری زمانی - {symbol}</h2>
              <p className="text-[10px] text-gray-500">
                {analysisMode === "quick"
                  ? "پیش‌بینی ML سریع — مدل‌های جداگانه + Ensemble"
                  : "تحلیل کامل سری زمانی — ML + تجزیه، نوسان، روند و فصلی"}
              </p>
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

      {/* ═══ MODE SELECTOR ═══ */}
      <div className="flex gap-2">
        <button
          onClick={() => setAnalysisMode("quick")}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            analysisMode === "quick"
              ? "bg-violet-600 text-white"
              : "bg-[#f3f4f6] text-gray-500 hover:bg-[#e5e7eb]"
          }`}
        >
          <Clock className="w-3 h-3 inline ml-1" />
          سریع
        </button>
        <button
          onClick={() => setAnalysisMode("detailed")}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            analysisMode === "detailed"
              ? "bg-violet-600 text-white"
              : "bg-[#f3f4f6] text-gray-500 hover:bg-[#e5e7eb]"
          }`}
        >
          <BarChart3 className="w-3 h-3 inline ml-1" />
          دقیق
        </button>
      </div>

      {/* ═══ CONFIGURATION ═══ */}
      <div className="rounded-2xl p-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {/* Forecast Steps */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-gray-500 font-medium">قدم‌های پیش‌بینی</label>
            <div className="flex items-center gap-1 bg-[#f3f4f6] rounded-lg p-0.5 border border-[#e5e7eb]">
              {SESSION_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setForecastSteps(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    forecastSteps === s
                      ? "bg-white text-violet-700 shadow-sm border border-[#e5e7eb]"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {toPersianDigits(String(s))}
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection (quick mode only) */}
          {analysisMode === "quick" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-gray-500 font-medium">مدل‌ها</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {AVAILABLE_MODELS.map((m) => {
                  const selected = selectedModels.includes(m.key);
                  return (
                    <button
                      key={m.key}
                      onClick={() =>
                        setSelectedModels((prev) =>
                          prev.includes(m.key) ? prev.filter((k) => k !== m.key) : [...prev, m.key]
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
                        selected
                          ? "border-current/30"
                          : "border-gray-200 text-gray-400 opacity-50"
                      }`}
                      style={{
                        color: selected ? m.color : undefined,
                        background: selected ? m.color + "10" : undefined,
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Run button */}
          <button
            onClick={runAnalysis}
            disabled={loading || selectedModels.length === 0 || candleData.length < 60}
            className="mr-auto inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Zap className={`w-3.5 h-3.5 ${loading ? "animate-pulse" : ""}`} />
            {loading ? "در حال تحلیل..." : "شروع تحلیل"}
          </button>
        </div>

        {candleData.length < 60 && (
          <p className="mt-3 text-[10px] text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            تعداد کندل‌های فعلی ({toPersianDigits(String(candles.length))}) کمتر از حداقل مورد نیاز (60) است.
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
                {analysisMode === "quick"
                  ? `${toPersianDigits(String(selectedModels.length))} مدل × ${toPersianDigits(String(forecastSteps))} جلسه`
                  : `${toPersianDigits(String(forecastSteps))} جلسه × تحلیل کامل`}
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
              <div className="text-lg font-black text-gray-900">{toFa(result.training_samples ?? 0, 0)}</div>
            </div>
            <div className="rounded-xl p-3 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
              <div className="text-[10px] text-gray-500">ویژگی‌های تکنیکال</div>
              <div className="text-lg font-black text-gray-900">{toFa(result.features_count ?? 0, 0)}</div>
            </div>
            <div className="rounded-xl p-3 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
              <div className="text-[10px] text-gray-500">مدل‌های فعال</div>
              <div className="text-lg font-black text-violet-700">{toFa(Object.keys(result.forecasts ?? {}).length, 0)}</div>
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
          {activeForecast.length > 0 && (
            <div className="rounded-2xl p-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-violet-600" />
                  پیش‌بینی ترکیبی (Ensemble)
                  {result.fallback && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-[10px] text-amber-700">Fallback</span>
                  )}
                </h3>
                <button
                  onClick={() => setShowTable(!showTable)}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg border border-[#e5e7eb] text-[10px] text-gray-600 hover:bg-[#f3f4f6] transition-colors cursor-pointer"
                >
                  {showTable ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showTable ? "نمودار" : "جدول"}
                </button>
              </div>

              {/* Chart view */}
              {!showTable && (
                <div className="bg-[#f3f4f6]/50 rounded-xl p-4">
                  <div className="h-[120px] w-full">
                    <canvas ref={mainChartRef} />
                  </div>
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
                      {activeForecast.map((p) => (
                        <tr key={p.session} className="border-t border-[#e5e7eb]">
                          <td className="px-3 py-2 font-medium text-gray-700">{toPersianDigits(String(p.session))}</td>
                          <td className="px-3 py-2 font-bold text-gray-900 tabular-nums" dir="ltr">{toFa(p.price, decimals)}</td>
                          <td className={`px-3 py-2 font-bold tabular-nums ${p.change_pct >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {p.change_pct >= 0 ? "+" : ""}{toFaDecimal(p.change_pct)}%
                          </td>
                          <td className="px-3 py-2 text-gray-500 tabular-nums" dir="ltr">
                            {toFa(p.lower, decimals)} — {toFa(p.upper, decimals)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Ensemble weights */}
              {result.ensemble?.weights && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(result.ensemble.weights).map(([key, w]) => (
                    <span
                      key={key}
                      className="px-2 py-0.5 rounded-full text-[9px] font-medium border"
                      style={{
                        color: MODEL_COLORS[key] || "#666",
                        borderColor: (MODEL_COLORS[key] || "#666") + "40",
                        background: (MODEL_COLORS[key] || "#666") + "10",
                      }}
                    >
                      {MODEL_LABELS[key] || key}: {toFaDecimal(w * 100)}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ INDIVIDUAL MODELS (Quick Mode) ═══ */}
          {analysisMode === "quick" && result.forecasts && Object.keys(result.forecasts).length > 0 && (
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#ffffff] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#e5e7eb] bg-[#f3f4f6]/50">
                <h3 className="text-sm font-bold text-gray-900">نتایج مدل‌های فردی</h3>
              </div>
              <div className="divide-y divide-[#e5e7eb]">
                {Object.entries(result.forecasts).map(([key, model]) => {
                  const isExpanded = expandedModel === key;
                  const color = MODEL_COLORS[key] || "#666";
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
                                پیش‌بینی S{toPersianDigits(String(lastPred.session))}: {toFa(lastPred.price, decimals)}
                              </span>
                              <span className={`text-[10px] font-bold ${lastPred.change_pct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {lastPred.change_pct >= 0 ? "+" : ""}{toFaDecimal(lastPred.change_pct)}%
                              </span>
                            </div>
                          )}
                        </div>
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
                                    <td className="px-2 py-1.5 font-bold text-gray-900 tabular-nums" dir="ltr">{toFa(p.price, decimals)}</td>
                                    <td className={`px-2 py-1.5 font-bold tabular-nums ${p.change_pct >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                      {p.change_pct >= 0 ? "+" : ""}{toFaDecimal(p.change_pct)}%
                                    </td>
                                    <td className="px-2 py-1.5 text-gray-500 tabular-nums" dir="ltr">
                                      {toFa(p.lower, decimals)}—{toFa(p.upper, decimals)}
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
          )}

          {/* ═══ FEATURE IMPORTANCE ═══ */}
          {result.feature_importance && Object.keys(result.feature_importance).length > 0 && (
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

          {/* ═══ DETAILED MODE EXTRA SECTIONS ═══ */}
          {analysisMode === "detailed" && detailedResult && (
            <>
              {/* Detailed Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl p-4 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
                  <div className="text-[10px] text-gray-500 mb-1">رژیم نوسان</div>
                  <div className="text-2xl font-black text-gray-900">
                    {detailedResult.volatility.annualized_volatility.toFixed(2)}%
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                    detailedResult.volatility.regime === "high" ? "bg-red-100 text-red-700"
                      : detailedResult.volatility.regime === "medium" ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {detailedResult.volatility.regime === "high" ? "بالا" : detailedResult.volatility.regime === "medium" ? "متوسط" : "پایین"}
                  </span>
                </div>
                <div className="rounded-2xl p-4 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
                  <div className="text-[10px] text-gray-500 mb-1">جهت روند</div>
                  <div className="text-2xl font-black text-gray-900 capitalize">
                    {detailedResult.trend.direction === "bullish" ? "صعودی"
                      : detailedResult.trend.direction === "bearish" ? "نزولی"
                      : "خنثی"}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    قدرت: {detailedResult.trend.strength.toFixed(4)} | تقاطعات: {detailedResult.trend.crossovers}
                  </div>
                </div>
                <div className="rounded-2xl p-4 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
                  <div className="text-[10px] text-gray-500 mb-1">فصلی بودن</div>
                  <div className="text-2xl font-black text-gray-900">
                    {detailedResult.seasonality.has_seasonality ? "بله" : "خیر"}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    قدرت: {detailedResult.seasonality.seasonal_strength.toFixed(4)} | دوره: {detailedResult.seasonality.period ?? "—"}
                  </div>
                </div>
              </div>

              {/* Decomposition Chart */}
              <div className="rounded-2xl p-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-600" />
                  تجزیه مولفه‌ها (Trend / Seasonal / Residual)
                </h3>
                <div className="h-[300px]">
                  <canvas ref={decompositionChartRef} />
                </div>
              </div>

              {/* Volatility Chart */}
              <div className="rounded-2xl p-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-600" />
                  نوسان (Volatility Analysis)
                </h3>
                <div className="h-[200px]">
                  <canvas ref={volatilityChartRef} />
                </div>
              </div>

              {/* Model Tabs */}
              <div className="rounded-2xl border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
                <div className="px-5 py-3 border-b border-[#e5e7eb] bg-[#f3f4f6]/50">
                  <h3 className="text-sm font-bold text-gray-900">مقایسه مدل‌ها</h3>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {ML_MODELS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setSelectedModel(m.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          selectedModel === m.key
                            ? "bg-violet-600 text-white"
                            : "bg-[#f3f4f6] text-gray-500 hover:bg-[#e5e7eb]"
                        }`}
                        style={{
                          color: selectedModel === m.key ? undefined : m.color,
                          background: selectedModel === m.key ? undefined : m.color + "10",
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="h-[250px]">
                    <canvas ref={mainChartRef} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ═══ EXPORT BUTTONS ═══ */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-xs text-gray-600 hover:bg-[#f3f4f6] transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3" />
              CSV
            </button>
            <button
              onClick={exportJSON}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-xs text-gray-600 hover:bg-[#f3f4f6] transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3" />
              JSON
            </button>
          </div>

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
