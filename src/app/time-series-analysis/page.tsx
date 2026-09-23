"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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

interface TimeSeriesResponse {
  analysis_id: string;
  symbol: string;
  request_params: Record<string, any>;
  basic_stats: Record<string, any>;
  analysis_json: Record<string, any>;
  results: AnalysisResult[];
  created_at: string;
  updated_at: string;
}

interface AnalysisStatus {
  analysis_id: string;
  status: "processing" | "completed" | "error";
  result?: TimeSeriesResponse;
}

const SYMBOLS = [
  "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA", "JPM",
  "V", "JNJ", "WMT", "UNH", "PG", "MA", "DIS", "BAC", "XOM",
  "KO", "PEP", "CSCO", "ORCL", "IBM", "INTC", "AMD", "NFLX",
];

const MODELS = ["arima", "sarima", "ets", "prophet", "lstm"];

export default function TimeSeriesAnalysisPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [forecastSteps, setForecastSteps] = useState(30);
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [includeDecomposition, setIncludeDecomposition] = useState(false);
  const [includeStationarity, setIncludeStationarity] = useState(false);
  const [includeSpectrum, setIncludeSpectrum] = useState(false);
  const [includeRegimeDetection, setIncludeRegimeDetection] = useState(false);

  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>("arima");
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const decompositionChartRef = useRef<HTMLCanvasElement>(null);
  const decompositionChartInstanceRef = useRef<Chart | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
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

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setAnalysisStatus(null);
    cleanup();

    try {
      const response = await fetch("/api/v1/time-series/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          forecast_steps: forecastSteps,
          confidence_level: confidenceLevel,
          include_decomposition: includeDecomposition,
          include_stationarity: includeStationarity,
          include_spectrum: includeSpectrum,
          include_regime_detection: includeRegimeDetection,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start analysis: ${response.statusText}`);
      }

      const data: TimeSeriesResponse = await response.json();
      setAnalysisStatus({
        analysis_id: data.analysis_id,
        status: "processing",
      });

      // Poll for results
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const pollResponse = await fetch(
            `/api/v1/time-series/analysis/${data.analysis_id}`
          );
          if (!pollResponse.ok) return;

          const pollData: TimeSeriesResponse = await pollResponse.json();
          setAnalysisStatus({
            analysis_id: pollData.analysis_id,
            status: "completed",
            result: pollData,
          });

          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }

          setTimeout(() => {
            renderMainChart(pollData.results);
            if (includeDecomposition) {
              renderDecompositionChart(pollData.results);
            }
          }, 100);
        } catch {
          // Silently retry
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to run analysis");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const renderMainChart = (results: AnalysisResult[]) => {
    if (!chartRef.current) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const result = results.find((r) => r.model === selectedModel) || results[0];
    if (!result) return;

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

    const data: ChartData = {
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

  const renderDecompositionChart = (results: AnalysisResult[]) => {
    if (!decompositionChartRef.current) return;
    if (decompositionChartInstanceRef.current) {
      decompositionChartInstanceRef.current.destroy();
    }

    const result = results.find((r) => r.model === selectedModel) || results[0];
    if (!result?.forecast?.length) return;

    const forecast = result.forecast;
    const labels = forecast.map((p) => p.date);

    const data: ChartData = {
      labels,
      datasets: [
        {
          label: "Forecast",
          data: forecast.map((p) => p.value),
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 2,
          fill: true,
        },
        ...(forecast[0].upperBound
          ? [
              {
                label: "Upper Bound",
                data: forecast.map((p) => p.upperBound),
                borderColor: "rgba(16, 185, 129, 0.4)",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                borderWidth: 1,
                fill: "+1",
                pointRadius: 0,
              },
              {
                label: "Lower Bound",
                data: forecast.map((p) => p.lowerBound),
                borderColor: "rgba(239, 68, 68, 0.4)",
                backgroundColor: "rgba(239, 68, 68, 0.08)",
                borderWidth: 1,
                fill: false,
                pointRadius: 0,
              },
            ]
          : []),
      ],
    };

    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${symbol} - Confidence Interval`,
        },
        legend: { display: true },
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(0,0,0,0.05)" } },
      },
    };

    decompositionChartInstanceRef.current = new Chart(decompositionChartRef.current, {
      type: "line",
      data,
      options,
    });
  };

  const result = analysisStatus?.result;
  const activeResult = result?.results.find((r) => r.model === selectedModel) || result?.results[0];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-600" />
            Time Series Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Advanced statistical analysis and forecasting with ARIMA, SARIMA, ETS, and more
          </p>
        </div>
        <Button onClick={runAnalysis} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Run Analysis
            </>
          )}
        </Button>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Configuration</CardTitle>
          <CardDescription>
            Configure parameters for your time series analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Select
                value={symbol}
                onValueChange={(value) => setSymbol(value)}
              >
                <SelectTrigger id="symbol">
                  <SelectValue placeholder="Select symbol" />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forecastSteps">Forecast Steps</Label>
              <Input
                id="forecastSteps"
                type="number"
                min={1}
                max={365}
                value={forecastSteps}
                onChange={(e) => setForecastSteps(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confidenceLevel">Confidence Level</Label>
              <Select
                value={String(confidenceLevel)}
                onValueChange={(value) => setConfidenceLevel(Number(value))}
              >
                <SelectTrigger id="confidenceLevel">
                  <SelectValue placeholder="Confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.90">90%</SelectItem>
                  <SelectItem value="0.95">95%</SelectItem>
                  <SelectItem value="0.99">99%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Primary Model</Label>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="decomposition"
                checked={includeDecomposition}
                onCheckedChange={(checked) => setIncludeDecomposition(checked as boolean)}
              />
              <Label htmlFor="decomposition" className="cursor-pointer">
                Decomposition
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="stationarity"
                checked={includeStationarity}
                onCheckedChange={(checked) => setIncludeStationarity(checked as boolean)}
              />
              <Label htmlFor="stationarity" className="cursor-pointer">
                Stationarity Tests
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="spectrum"
                checked={includeSpectrum}
                onCheckedChange={(checked) => setIncludeSpectrum(checked as boolean)}
              />
              <Label htmlFor="spectrum" className="cursor-pointer">
                Spectrum Analysis
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="regime"
                checked={includeRegimeDetection}
                onCheckedChange={(checked) => setIncludeRegimeDetection(checked as boolean)}
              />
              <Label htmlFor="regime" className="cursor-pointer">
                Regime Detection
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-600 font-medium">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Status */}
      {analysisStatus && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {analysisStatus.status === "processing" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="text-lg font-medium">Processing Analysis...</span>
                </>
              ) : analysisStatus.status === "completed" ? (
                <>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="text-lg font-medium">Analysis Complete</span>
                  <Badge variant="secondary">{result?.results.length || 0} models</Badge>
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 text-red-600" />
                  <span className="text-lg font-medium text-red-600">Analysis Failed</span>
                </>
              )}
              <span className="text-xs text-muted-foreground font-mono ml-auto">
                {analysisStatus.analysis_id}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Model Tabs */}
          <Tabs
            defaultValue={selectedModel}
            value={selectedModel}
            onValueChange={(value) => {
              setSelectedModel(value);
              setTimeout(() => {
                renderMainChart(result.results);
                if (includeDecomposition) {
                  renderDecompositionChart(result.results);
                }
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
                {/* Main Forecast Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineChart className="h-5 w-5" />
                      {r.model.toUpperCase()} Forecast
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <canvas ref={chartRef} />
                    </div>
                  </CardContent>
                </Card>

                {/* Confidence Interval Chart */}
                {includeDecomposition && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Confidence Interval ({confidenceLevel * 100}%)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <canvas ref={decompositionChartRef} />
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                        {r.metrics.mape?.toFixed(2)
                          ? `${r.metrics.mape.toFixed(2)}%`
                          : "N/A"}
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

          {/* Stationarity & Stats (if requested) */}
          {includeStationarity && result.analysis_json && (
            <Card>
              <CardHeader>
                <CardTitle>Stationarity Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <pre className="text-sm">
                    {JSON.stringify(result.analysis_json, null, 2)}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Raw Forecast Data Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Forecast Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Date</th>
                      <th className="text-right py-2 px-4">Value</th>
                      {activeResult?.forecast[0]?.upperBound && (
                        <>
                          <th className="text-right py-2 px-4">Upper</th>
                          <th className="text-right py-2 px-4">Lower</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {activeResult?.forecast?.map((point, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-4">{point.date}</td>
                        <td className="text-right py-2 px-4 font-mono">
                          {point.value.toFixed(4)}
                        </td>
                        {activeResult?.forecast[0]?.upperBound && (
                          <>
                            <td className="text-right py-2 px-4 font-mono">
                              {point.upperBound?.toFixed(4)}
                            </td>
                            <td className="text-right py-2 px-4 font-mono">
                              {point.lowerBound?.toFixed(4)}
                            </td>
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
