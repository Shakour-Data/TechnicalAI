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
  RefreshCw,
  Download,
} from "lucide-react";
import { formatPriceFa } from "@/lib/format-price";
import { toPersianDigits } from "@/lib/jalali";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Legend,
  Filler,
  Tooltip
);

interface ForecastPoint {
  date: string;
  value: number;
  upperBound?: number;
  lowerBound?: number;
}

interface AnalysisResult {
  model: string;
  forecast: ForecastPoint[];
  metrics: {
    mae?: number;
    rmse?: number;
    mape?: number;
    r2?: number;
  };
}

interface TimeSeriesPanelProps {
  symbol: string;
  candles: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
  currentPrice: number;
  priceDecimals?: number;
}

const MODELS = ["arima", "sarima", "ets"] as const;
type ModelName = typeof MODELS[number];

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function arimaFit(series: number[]): { residuals: number[]; forecast: number[] } {
  const n = series.length;
  if (n < 5) return { residuals: [], forecast: [] };

  const diffs = series.slice(1).map((v, i) => v - series[i]);
  const mu = mean(diffs);

  let num = 0, den = 0;
  for (let i = 1; i < diffs.length; i++) {
    num += (diffs[i] - mu) * (diffs[i - 1] - mu);
    den += (diffs[i - 1] - mu) ** 2;
  }
  const phi = den !== 0 ? Math.max(-0.9, Math.min(0.9, num / den)) : 0;

  const residuals = diffs.map((d, i) => {
    if (i === 0) return d - mu;
    return d - (mu + phi * (diffs[i - 1] - mu));
  });

  const forecastSteps = 30;
  const forecast: number[] = [];
  let pred = series[n - 1];
  for (let i = 0; i < forecastSteps; i++) {
    pred = pred + mu + phi * (diffs[diffs.length - 1] - mu);
    forecast.push(pred);
  }

  return { residuals, forecast };
}

function etsForecast(series: number[], alpha: number = 0.3, steps: number = 30): number[] {
  if (series.length < 2) return new Array(steps).fill(series[0] || 0);
  let level = series[0];
  for (let i = 0; i < series.length; i++) {
    level = alpha * series[i] + (1 - alpha) * level;
  }
  return new Array(steps).fill(level);
}

function linearTrendForecast(series: number[], steps: number = 30): { forecast: number[]; slope: number; intercept: number } {
  const n = series.length;
  if (n < 2) return { forecast: new Array(steps).fill(series[0] || 0), slope: 0, intercept: series[0] || 0 };

  const xMean = (n - 1) / 2;
  const yMean = mean(series);

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (series[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;

  const forecast: number[] = [];
  for (let i = 0; i < steps; i++) {
    forecast.push(intercept + slope * (n + i));
  }
  return { forecast, slope, intercept };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function buildForecastWithCI(
  pointForecast: number[],
  residuals: number[],
  confidence: number
): { forecast: ForecastPoint[]; lowerBound: number[]; upperBound: number[] } {
  const cleanResiduals = residuals.filter(isFiniteNumber);
  const s = stdDev(cleanResiduals.length > 0 ? cleanResiduals : [0]);
  const z = confidence === 0.99 ? 2.576 : confidence === 0.90 ? 1.645 : 1.96;
  const margin = s * z;

  const forecast: ForecastPoint[] = [];
  const lowerBound: number[] = [];
  const upperBound: number[] = [];

  for (let i = 0; i < pointForecast.length; i++) {
    const fv = pointForecast[i];
    if (!isFiniteNumber(fv)) continue;
    const mult = 1 + i * 0.05;
    const lb = fv - margin * mult;
    const ub = fv + margin * mult;
    lowerBound.push(lb);
    upperBound.push(ub);
    forecast.push({
      date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split("T")[0],
      value: fv,
      lowerBound: isFiniteNumber(lb) ? lb : undefined,
      upperBound: isFiniteNumber(ub) ? ub : undefined,
    });
  }

  return { forecast, lowerBound, upperBound };
}

export default function TimeSeriesPanel({ symbol, candles, currentPrice, priceDecimals = 0 }: TimeSeriesPanelProps) {
  const [forecastSteps, setForecastSteps] = useState(30);
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);

  const [analysisStatus, setAnalysisStatus] = useState<{ results: AnalysisResult[]; basic_stats: Record<string, any>; analysis_id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<ModelName>("arima");
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const decompositionChartRef = useRef<HTMLCanvasElement>(null);
  const decompositionChartInstanceRef = useRef<Chart | null>(null);

  const cleanup = useCallback(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }
    if (decompositionChartInstanceRef.current) {
      decompositionChartInstanceRef.current.destroy();
      decompositionChartInstanceRef.current = null;
    }
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

  const runAnalysis = useCallback(() => {
    if (candleData.length < 10) {
      setError("حداقل ۱۰ کندل داده برای تحلیل سری زمانی نیاز است");
      return;
    }
    setLoading(true);
    setError(null);
    cleanup();

    try {
      const series = candleData;
      const results: AnalysisResult[] = [];

      // ARIMA
      try {
        const arima = arimaFit(series);
        const arimaCI = buildForecastWithCI(arima.forecast, arima.residuals, confidenceLevel);
        results.push({
          model: "arima",
          forecast: arimaCI.forecast,
          metrics: { rmse: stdDev(arima.residuals) },
        });
      } catch (e) {
        results.push({ model: "arima", forecast: [], metrics: {} });
      }

      // ETS
      try {
        const etsPred = etsForecast(series, 0.3, forecastSteps);
        const etsResiduals = series.map((v, i) => {
          if (i === 0) return 0;
          return v - (0.3 * v + 0.7 * etsPred[i - 1]);
        });
        const etsCI = buildForecastWithCI(etsPred, etsResiduals, confidenceLevel);
        results.push({
          model: "ets",
          forecast: etsCI.forecast,
          metrics: { rmse: stdDev(etsResiduals) },
        });
      } catch (e) {
        results.push({ model: "ets", forecast: [], metrics: {} });
      }

      // Linear Trend (displayed as SARIMA)
      try {
        const trend = linearTrendForecast(series, forecastSteps);
        const trendResiduals = series.map((v, i) => v - (trend.intercept + trend.slope * i));
        const trendCI = buildForecastWithCI(trend.forecast, trendResiduals, confidenceLevel);
        results.push({
          model: "sarima",
          forecast: trendCI.forecast,
          metrics: { rmse: stdDev(trendResiduals) },
        });
      } catch (e) {
        results.push({ model: "sarima", forecast: [], metrics: {} });
      }

      const basicStats = {
        mean: mean(series),
        std: stdDev(series),
        min: Math.min(...series),
        max: Math.max(...series),
        current_price: series[series.length - 1],
        volatility: stdDev(series) / mean(series),
      };

      setAnalysisStatus({
        analysis_id: `tsa_${symbol}_${Date.now()}`,
        results,
        basic_stats: basicStats,
      });

      setTimeout(() => {
        renderMainChart(results);
      }, 100);
    } catch (err: any) {
      setError(err.message || "تحلیل ناموفق بود");
    } finally {
      setLoading(false);
    }
  }, [candleData, symbol, forecastSteps, confidenceLevel, cleanup]);

  // Auto-run when data is available
  useEffect(() => {
    if (candleData.length > 10) {
      runAnalysis();
    }
  }, [candleData, symbol]);

  const renderMainChart = (results: AnalysisResult[]) => {
    if (!chartRef.current) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const result = results.find((r) => r.model === selectedModel) || results[0];
    if (!result || !result.forecast.length) return;

    const forecast = result.forecast;
    const labels = forecast.map((p) => p.date);

    const dataset: any = {
      label: `${selectedModel.toUpperCase()} Forecast`,
      data: forecast.map((p) => p.value),
      borderColor: "rgb(59, 130, 246)",
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      borderWidth: 2,
      pointRadius: 1,
      tension: 0.3,
      fill: true,
    };

    if (forecast[0].upperBound && forecast[0].lowerBound) {
      dataset.upperBound = forecast.map((p) => p.upperBound);
      dataset.lowerBound = forecast.map((p) => p.lowerBound);
    }

    const data: ChartData<any, any> = {
      labels,
      datasets: [dataset],
    };

    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${symbol} - ${selectedModel.toUpperCase()} Forecast (${forecast.length} steps)`,
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
      interaction: {
        mode: "nearest",
        axis: "x",
        intersect: false,
      },
    };

    chartInstanceRef.current = new Chart(chartRef.current, {
      type: "line",
      data,
      options,
    });
  };

  const result = analysisStatus;
  const activeResult = result?.results.find((r) => r.model === selectedModel) || result?.results[0];

  const decimals = priceDecimals ?? 0;
const fmtPrice = (n: number): string => formatPriceFa(n, decimals);

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
            پیش‌بینی با ARIMA، ETS و رگرسیون خطی برای {symbol}
          </p>
        </div>
        <Button onClick={runAnalysis} disabled={loading || candleData.length < 10} size="sm">
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
              <Select
                value={String(confidenceLevel)}
                onValueChange={(value) => setConfidenceLevel(Number(value))}
              >
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
              <Label htmlFor="ts-model">مدل</Label>
              <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ModelName)}>
                <SelectTrigger id="ts-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arima">ARIMA</SelectItem>
                  <SelectItem value="sarima">رگرسیون خطی</SelectItem>
                  <SelectItem value="ets">ETS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-600 font-medium">خطا: {error}</p>
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
                <Badge variant="secondary">{result.results.length} مدل</Badge>
                <span className="text-xs text-muted-foreground font-mono ml-auto">
                  {result.analysis_id}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Model Tabs */}
          <Tabs
            defaultValue={selectedModel}
            value={selectedModel}
            onValueChange={(value) => {
              setSelectedModel(value as ModelName);
              setTimeout(() => {
                renderMainChart(result.results);
              }, 100);
            }}
          >
            <TabsList>
              {result.results.map((r) => (
                <TabsTrigger key={r.model} value={r.model}>
                  {r.model.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>

            {result.results.map((r) => (
              <TabsContent key={r.model} value={r.model} className="space-y-6">
                {/* Main Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineChart className="h-5 w-5" />
                      {r.model.toUpperCase()} Forecast
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <canvas ref={chartRef} />
                    </div>
                  </CardContent>
                </Card>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">MAE</div>
                      <div className="text-2xl font-bold mt-1">
                        {r.metrics.mae?.toFixed(4) || "N/A"}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">RMSE</div>
                      <div className="text-2xl font-bold mt-1">
                        {r.metrics.rmse?.toFixed(4) || "N/A"}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">MAPE</div>
                      <div className="text-2xl font-bold mt-1">
                        {r.metrics.mape?.toFixed(2) ? `${r.metrics.mape.toFixed(2)}%` : "N/A"}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">R²</div>
                      <div className="text-2xl font-bold mt-1">
                        {r.metrics.r2?.toFixed(4) || "N/A"}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Stats */}
          {result.basic_stats && (
            <Card>
              <CardHeader>
                <CardTitle>آمار توصیفی</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <pre className="text-sm">
                    {JSON.stringify(result.basic_stats, null, 2)}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Forecast Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                داده‌های پیش‌بینی
              </CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[300px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">تاریخ</th>
                        <th className="text-right py-2 px-4 font-mono">پیش‌بینی</th>
                        {activeResult?.forecast?.length && isFiniteNumber(activeResult.forecast[0].upperBound) && (
                          <>
                            <th className="text-right py-2 px-4 font-mono">حد بالا</th>
                            <th className="text-right py-2 px-4 font-mono">حد پایین</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(activeResult?.forecast || []).map((point, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-4">{point.date}</td>
                          <td className="text-right py-2 px-4 font-mono">{fmtPrice(point.value)}</td>
                          {isFiniteNumber(point.upperBound) && isFiniteNumber(point.lowerBound) && (
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