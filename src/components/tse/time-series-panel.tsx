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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Activity,
  TrendingUp,
  BarChart3,
  LineChart,
  Zap,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { formatPriceFa } from "@/lib/format-price";
import { toast } from "@/hooks/use-toast";

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

interface ForecastPoint {
  date: string;
  session: number;
  value: number;
  lowerBound?: number;
  upperBound?: number;
  change_pct?: number;
}

interface ModelForecast {
  model_name: string;
  cv_r2: number;
  cv_rmse_pct: number;
  predictions: ForecastPoint[];
}

interface EnsemblePrediction {
  session: number;
  price: number;
  change_pct: number;
  lower: number;
  upper: number;
}

interface MLForecastResponse {
  status: string;
  symbol: string | null;
  training_samples: number;
  features_count: number;
  forecasts: Record<string, ModelForecast>;
  ensemble: {
    model_name: string;
    weights: Record<string, number>;
    predictions: EnsemblePrediction[];
  };
  feature_importance?: Record<string, number>;
  fallback?: boolean;
}

interface DecompositionData {
  trend: number[];
  seasonal: number[];
  residual: number[];
  window: number;
  method: string;
}

interface VolatilityData {
  annualized_volatility: number;
  regime: "low" | "medium" | "high";
  rolling_volatility: number[];
  volatility_quantiles: { q33: number; q66: number };
}

interface TrendData {
  direction: "bullish" | "bearish" | "neutral";
  strength: number;
  short_ma: number[];
  long_ma: number[];
  crossovers: number;
}

interface SeasonalityData {
  has_seasonality: boolean;
  seasonal_strength: number;
  period: number | null;
  method: string;
}

interface DetailedAnalysisResponse {
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

interface TimeSeriesPanelProps {
  symbol: string;
  candles: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
  currentPrice: number;
  priceDecimals?: number;
}

type ModelName = "rf" | "xgboost" | "lightgbm" | "gbr" | "svr" | "ensemble";
type AnalysisMode = "quick" | "detailed";

const ML_MODELS: Array<{ key: ModelName; label: string; color: string }> = [
  { key: "rf", label: "Random Forest", color: "rgb(59, 130, 246)" },
  { key: "xgboost", label: "XGBoost", color: "rgb(16, 185, 129)" },
  { key: "lightgbm", label: "LightGBM", color: "rgb(245, 158, 11)" },
  { key: "gbr", label: "Gradient Boosting", color: "rgb(139, 92, 246)" },
  { key: "svr", label: "SVR", color: "rgb(239, 68, 68)" },
  { key: "ensemble", label: "Ensemble (Weighted)", color: "rgb(236, 72, 153)" },
];

export default function TimeSeriesPanel({ symbol, candles, currentPrice, priceDecimals = 0 }: TimeSeriesPanelProps) {
  const [forecastSteps, setForecastSteps] = useState(30);
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [selectedModel, setSelectedModel] = useState<ModelName>("ensemble");
  const [selectedModels, setSelectedModels] = useState<ModelName[]>(["rf", "xgboost", "lightgbm", "gbr"]);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("quick");

  const [mlResult, setMlResult] = useState<MLForecastResponse | null>(null);
  const [detailedResult, setDetailedResult] = useState<DetailedAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);

  const mainChartRef = useRef<HTMLCanvasElement>(null);
  const mainChartInstanceRef = useRef<Chart | null>(null);
  const decompositionChartRef = useRef<HTMLCanvasElement>(null);
  const decompositionChartInstanceRef = useRef<Chart | null>(null);
  const featureChartRef = useRef<HTMLCanvasElement>(null);
  const featureChartInstanceRef = useRef<Chart | null>(null);
  const volatilityChartRef = useRef<HTMLCanvasElement>(null);
  const volatilityChartInstanceRef = useRef<Chart | null>(null);

  const cleanup = useCallback(() => {
    [mainChartInstanceRef, decompositionChartInstanceRef, featureChartInstanceRef, volatilityChartInstanceRef].forEach((ref) => {
      if (ref.current) {
        ref.current.destroy();
        ref.current = null;
      }
    });
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

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
    cleanup();

    try {
      const payload: Record<string, unknown> = {
        candles: candles,
        sessions: forecastSteps,
        models: selectedModels,
      };

      let response;
      if (analysisMode === "detailed") {
        // For detailed analysis, call the backend time series service
        response = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, type: "time_series", horizon: forecastSteps }),
        });
      } else {
        response = await fetch("/api/ml-predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
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
  }, [candleData, candles, symbol, forecastSteps, selectedModels, analysisMode, cleanup]);

  // Auto-run when data is available
  useEffect(() => {
    if (candleData.length >= 60 && serviceAvailable !== false) {
      const timer = setTimeout(() => runAnalysis(), 500);
      return () => clearTimeout(timer);
    }
  }, [candleData, symbol, runAnalysis, serviceAvailable]);

  const renderMainChart = (data: MLForecastResponse | DetailedAnalysisResponse) => {
    if (!mainChartRef.current) return;
    if (mainChartInstanceRef.current) {
      mainChartInstanceRef.current.destroy();
    }

    const forecasts = data.forecasts || (data.ensemble ? { ensemble: data.ensemble as any } : {});
    let forecast: ForecastPoint[] = [];
    let modelName = "";
    let color = "rgb(59, 130, 246)";

    if (selectedModel === "ensemble" && data.ensemble?.predictions) {
      forecast = data.ensemble.predictions.map((p, i) => ({
        date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split("T")[0],
        session: i + 1,
        value: p.price,
        lowerBound: p.lower,
        upperBound: p.upper,
        change_pct: p.change_pct,
      }));
      modelName = "Ensemble";
      color = "rgb(236, 72, 153)";
    } else {
      const modelKey = selectedModel;
      const modelForecast = forecasts[modelKey];
      if (modelForecast?.predictions) {
        forecast = modelForecast.predictions.map((p, i) => ({
          date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split("T")[0],
          session: i + 1,
          value: p.price,
          lowerBound: p.lower,
          upperBound: p.upper,
          change_pct: p.change_pct,
        }));
        modelName = modelForecast.model_name;
        const modelDef = ML_MODELS.find((m) => m.key === modelKey);
        color = modelDef?.color || "rgb(59, 130, 246)";
      }
    }

    if (!forecast.length) return;

    const labels = forecast.map((p) => p.date);
    const dataset: any = {
      label: `${modelName} Forecast`,
      data: forecast.map((p) => p.value),
      borderColor: color,
      backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.1)"),
      borderWidth: 2,
      pointRadius: 1,
      tension: 0.3,
      fill: true,
    };

    if (forecast[0].upperBound && forecast[0].lowerBound) {
      dataset.upperBound = forecast.map((p) => p.upperBound);
      dataset.lowerBound = forecast.map((p) => p.lowerBound);
      dataset.fill = "-1";
      dataset.backgroundColor = color.replace("rgb", "rgba").replace(")", ", 0.05)");
    }

    const chartData: ChartData<"line"> = {
      labels,
      datasets: [dataset],
    };

    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${symbol} - ${modelName} Forecast (${forecast.length} steps)`,
        },
        legend: { display: true },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: {
          type: "time" as any,
          time: { unit: "day" as any },
          grid: { display: false },
        },
        y: {
          grid: { color: "rgba(0,0,0,0.05)" },
        },
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

  const result = mlResult || detailedResult;
  const activeForecast = result?.forecast?.predictions || result?.ensemble?.predictions || [];
  const activeModelName = selectedModel === "ensemble" ? "Ensemble" : selectedModel;

  const featureImportance = mlResult?.feature_importance || {};
  const volatility = detailedResult?.volatility;
  const trend = detailedResult?.trend;
  const seasonality = detailedResult?.seasonality;

  const decimals = priceDecimals ?? 0;
  const fmtPrice = (n: number): string => formatPriceFa(n, decimals);

  const exportCSV = useCallback(() => {
    if (!activeForecast.length) return;
    const rows = ["session,date,price,change_pct,lower,upper"];
    activeForecast.forEach((p) => {
      rows.push(`${p.session},${p.date || ""},${p.value},${p.change_pct || ""},${p.lowerBound || ""},${p.upperBound || ""}`);
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
    if (!result) return;
    const data = analysisMode === "detailed" ? detailedResult : mlResult;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${symbol}_analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "دانلود", description: "فایل JSON دانلود شد" });
  }, [result, detailedResult, mlResult, analysisMode]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            تحلیل سری زمانی
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            پیش‌بینی ML (RF/XGB/LightGBM/GBR/SVR) + Ensemble برای {symbol}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {serviceAvailable === false && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              سرویس ML در دسترس نیست
            </Badge>
          )}
          {serviceAvailable === true && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              سرویس ML فعال
            </Badge>
          )}
          <Button onClick={runAnalysis} disabled={loading || candleData.length < 60} size="sm">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                تحلیل...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-3 w-3" />
                اجرای تحلیل
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Analysis Mode */}
      <Card>
        <CardHeader>
          <CardTitle>حالت تحلیل</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant={analysisMode === "quick" ? "default" : "outline"}
              onClick={() => setAnalysisMode("quick")}
              className="justify-start"
            >
              <Clock className="h-4 w-4 ml-2" />
              سریع (Quick) — فقط Ensemble
            </Button>
            <Button
              variant={analysisMode === "detailed" ? "default" : "outline"}
              onClick={() => setAnalysisMode("detailed")}
              className="justify-start"
            >
              <BarChart3 className="h-4 w-4 ml-2" />
              دقیق (Detailed) — تحلیل کامل
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>تنظیمات</CardTitle>
          <CardDescription>پارامترهای تحلیل سری زمانی</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ts-steps">قدم پیش‌بینی</Label>
              <Input
                id="ts-steps"
                type="number"
                min={1}
                max={90}
                value={forecastSteps}
                onChange={(e) => setForecastSteps(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ts-conf">سطح اطمینان</Label>
              <Select value={String(confidenceLevel)} onValueChange={(value) => setConfidenceLevel(Number(value))}>
                <SelectTrigger id="ts-conf">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.90">۹۰٪</SelectItem>
                  <SelectItem value="0.95">۹۵٪</SelectItem>
                  <SelectItem value="0.99">۹۹٪</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ts-model">مدل‌ها</Label>
              <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ModelName)}>
                <SelectTrigger id="ts-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ML_MODELS.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {analysisMode === "quick" && (
            <div className="mt-4">
              <Label>مدل‌های فعال برای Ensemble</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ML_MODELS.slice(0, 4).map((m) => (
                  <Badge
                    key={m.key}
                    variant={selectedModels.includes(m.key) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedModels((prev) =>
                        prev.includes(m.key) ? prev.filter((x) => x !== m.key) : [...prev, m.key]
                      );
                    }}
                  >
                    {m.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-600 font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              خطا: {error}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Status */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-lg font-medium">تحلیل کامل شد</span>
                <Badge variant="secondary">{Object.keys(result.forecasts || {}).length} مدل</Badge>
                <Badge variant={result.fallback ? "destructive" : "default"}>
                  {result.fallback ? "Fallback" : "ML Service"}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono ml-auto">
                  Samples: {result.training_samples} | Features: {result.features_count}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Stats */}
          {detailedResult && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Regime Volatilit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{volatility?.annualized_volatility.toFixed(2)}%</div>
                  <Badge variant={volatility?.regime === "high" ? "destructive" : volatility?.regime === "medium" ? "default" : "secondary"}>
                    {volatility?.regime}
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold capitalize">{trend?.direction}</div>
                  <div className="text-xs text-muted-foreground">Strength: {trend?.strength}</div>
                  <div className="text-xs text-muted-foreground">Crossovers: {trend?.crossovers}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Seasonality</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{seasonality?.has_seasonality ? "Yes" : "No"}</div>
                  <div className="text-xs text-muted-foreground">Strength: {seasonality?.seasonal_strength}</div>
                  <div className="text-xs text-muted-foreground">Period: {seasonality?.period}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Model Tabs */}
          <Tabs value={selectedModel} onValueChange={(value) => setSelectedModel(value as ModelName)}>
            <TabsList className="flex-wrap">
              {ML_MODELS.map((m) => (
                <TabsTrigger key={m.key} value={m.key}>
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {ML_MODELS.map((m) => {
              const modelForecast = result?.forecasts?.[m.key];
              const predictions = modelForecast?.predictions || [];
              const cvR2 = modelForecast?.cv_r2 ?? 0;
              const cvRmse = modelForecast?.cv_rmse_pct ?? 0;

              return (
                <TabsContent key={m.key} value={m.key} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <LineChart className="h-5 w-5" />
                        {m.label} Forecast
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <canvas ref={mainChartRef} />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">R² (CV)</div>
                        <div className="text-2xl font-bold mt-1">{cvR2.toFixed(4)}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">RMSE %</div>
                        <div className="text-2xl font-bold mt-1">{cvRmse.toFixed(2)}%</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Direction</div>
                        <div className="text-2xl font-bold mt-1 capitalize">
                          {predictions.length > 0 && predictions[0].change_pct !== undefined
                            ? predictions[0].change_pct > 0
                              ? "up"
                              : "down"
                            : "N/A"}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Last Predicted</div>
                        <div className="text-2xl font-bold mt-1 font-mono">
                          {predictions.length > 0 ? fmtPrice(predictions[predictions.length - 1].value) : "N/A"}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Feature Importance */}
          {featureImportance && Object.keys(featureImportance).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Feature Importance (Top 15)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <canvas ref={featureChartRef} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Decomposition */}
          {detailedResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  STL Decomposition (Trend / Seasonal / Residual)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <canvas ref={decompositionChartRef} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Volatility Chart */}
          {detailedResult && volatility && (
            <Card>
              <CardHeader>
                <CardTitle>Volatility Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <canvas ref={volatilityChartRef} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ensemble Weights */}
          {mlResult?.ensemble?.weights && (
            <Card>
              <CardHeader>
                <CardTitle>Ensemble Weights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(mlResult.ensemble.weights).map(([model, weight]) => (
                    <Badge key={model} variant="outline" className="text-sm">
                      {model}: {(weight * 100).toFixed(1)}%
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Forecast Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                داده‌های پیش‌بینی
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Download className="h-4 w-4 ml-1" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportJSON}>
                  <Download className="h-4 w-4 ml-1" />
                  JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Session</th>
                      <th className="text-right py-2 px-4 font-mono">پیش‌بینی</th>
                      <th className="text-right py-2 px-4 font-mono">Δ%</th>
                      {activeForecast.length && isFiniteNumber(activeForecast[0].lowerBound) && (
                        <>
                          <th className="text-right py-2 px-4 font-mono">حد بالا</th>
                          <th className="text-right py-2 px-4 font-mono">حد پایین</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(activeForecast || []).map((point, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-4">{point.session}</td>
                        <td className="text-right py-2 px-4 font-mono">{fmtPrice(point.value)}</td>
                        <td className="text-right py-2 px-4 font-mono">
                          {point.change_pct !== undefined ? `${point.change_pct.toFixed(2)}%` : "N/A"}
                        </td>
                        {isFiniteNumber(point.lowerBound) && isFiniteNumber(point.upperBound) && (
                          <>
                            <td className="text-right py-2 px-4 font-mono">{fmtPrice(point.upperBound as number)}</td>
                            <td className="text-right py-2 px-4 font-mono">{fmtPrice(point.lowerBound as number)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}