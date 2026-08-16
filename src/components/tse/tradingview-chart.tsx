'use client';

import React, { useRef, useEffect, useCallback, memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type Time,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
} from 'lightweight-charts';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface CandleData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingViewChartProps {
  symbolName: string;
  candles: CandleData[];
  supports: number[];
  resistances: number[];
  ma21: number;
  ma100: number;
  scenarios: Record<string, { targetMin: number; targetMax: number; name: string; probability: number; color: string }>;
}

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const BULL = '#34c98b';
const BEAR = '#ef4d62';
const BG = '#0d1424';
const TXT = '#9db4c2';
const GRID = 'rgba(255,255,255,0.04)';
const MA21_COLOR = '#3ad5db';
const MA100_COLOR = '#a04ac5';
const SUPPORT_COLOR = '#34c98b';
const RESISTANCE_COLOR = '#ef4d62';

// ── Round number to nice human-readable value ─────────────────────
function roundNice(n: number): number {
  const abs = Math.abs(n);
  if (abs === 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(abs)));
  const norm = abs / mag;
  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 3.5) nice = 2.5;
  else if (norm < 7.5) nice = 5;
  else nice = 10;
  return Math.round((nice * mag) / 10) * 10;
}

// ── Compute SMA array ─────────────────────────────────────────────
function computeSMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    result.push(sum / period);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// Chart Component
// ═══════════════════════════════════════════════════════════════════

const TradingViewChartInner = memo(function TradingViewChartInner({
  symbolName, candles, supports, resistances, ma21, ma100, scenarios,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const build = useCallback(() => {
    const el = containerRef.current;
    if (!el || candles.length === 0) return;

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    // ── Create chart ──────────────────────────────────────────────
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor: TXT,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        rightOffset: 5,
        barSpacing: 7,
        minBarSpacing: 2,
      },
      width: el.clientWidth,
      height: el.clientHeight,
    });
    chartRef.current = chart;

    // ── Candlestick series ────────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: BULL,
      downColor: BEAR,
      borderUpColor: BULL,
      borderDownColor: BEAR,
      wickUpColor: BULL,
      wickDownColor: BEAR,
    });

    const candleData: CandlestickData<Time>[] = candles.map((c, i) => ({
      time: i as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    // ── Volume series ────────────────────────────────────────────
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    const volData: HistogramData<Time>[] = candles.map((c, i) => ({
      time: i as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(52,201,139,0.25)' : 'rgba(239,77,98,0.25)',
    }));
    volSeries.setData(volData);
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // ── MA21 line series ─────────────────────────────────────────
    const closes = candles.map(c => c.close);
    const ma21Data = computeSMA(closes, 21);
    const ma21Series = chart.addSeries(LineSeries, {
      color: MA21_COLOR,
      lineWidth: 2,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'MA21',
    });
    const ma21LineData: LineData<Time>[] = [];
    ma21Data.forEach((v, i) => { if (v !== null) ma21LineData.push({ time: i as Time, value: v }); });
    ma21Series.setData(ma21LineData);

    // ── MA100 line series ────────────────────────────────────────
    const ma100Data = computeSMA(closes, 100);
    const ma100Series = chart.addSeries(LineSeries, {
      color: MA100_COLOR,
      lineWidth: 2,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'MA100',
    });
    const ma100LineData: LineData<Time>[] = [];
    ma100Data.forEach((v, i) => { if (v !== null) ma100LineData.push({ time: i as Time, value: v }); });
    ma100Series.setData(ma100LineData);

    // ── Helper: add price line to candle series ──────────────────
    const addPriceLine = (
      series: ISeriesApi<'Candlestick'>,
      price: number,
      color: string,
      lineWidth: number,
      lineStyle: number,
      title: string,
      axisLabelVisible: boolean,
    ) => {
      try {
        series.createPriceLine({
          price,
          color,
          lineWidth,
          lineStyle,
          axisLabelVisible,
          title,
        });
      } catch { /* skip */ }
    };

    // ── Support levels (rounded, green dashed) ──────────────────
    const roundedSupports = supports.filter(s => s > 0).map(roundNice);
    const uniqueSupports = [...new Set(roundedSupports)];
    uniqueSupports.forEach((s, i) => {
      addPriceLine(candleSeries, s, SUPPORT_COLOR, 2, 2, `حمایت ${i + 1}: ${s.toLocaleString('fa-IR')}`, i < 3);
    });

    // ── Resistance levels (rounded, red dashed) ─────────────────
    const roundedResistances = resistances.filter(r => r > 0).map(roundNice);
    const uniqueResistances = [...new Set(roundedResistances)];
    uniqueResistances.forEach((r, i) => {
      addPriceLine(candleSeries, r, RESISTANCE_COLOR, 2, 2, `مقاومت ${i + 1}: ${r.toLocaleString('fa-IR')}`, i < 3);
    });

    // ── Price targets from scenarios (rounded, colored dotted) ──
    const allTargets: { price: number; color: string; label: string }[] = [];
    const existingLevels = new Set([...uniqueSupports, ...uniqueResistances].map(l => Math.round(l)));

    for (const [key, s] of Object.entries(scenarios)) {
      const tMin = roundNice(s.targetMin);
      const tMax = roundNice(s.targetMax);
      if (!existingLevels.has(Math.round(tMin))) {
        allTargets.push({ price: tMin, color: s.color, label: `${s.name} هدف مین` });
      }
      if (!existingLevels.has(Math.round(tMax)) && Math.abs(tMax - tMin) > 1) {
        allTargets.push({ price: tMax, color: s.color, label: `${s.name} هدف ماکس` });
      }
    }

    allTargets.forEach((t, i) => {
      addPriceLine(candleSeries, t.price, t.color, 1, 1, t.label, i < 6);
    });

    // ── Fit content ─────────────────────────────────────────────
    chart.timeScale().fitContent();
  }, [candles, supports, resistances, ma21, ma100, scenarios]);

  // ── Effect: build chart ─────────────────────────────────────────
  useEffect(() => {
    build();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width: w, height: h } = e.contentRect;
        if (w > 0 && h > 0) chartRef.current?.applyOptions({ width: w, height: h });
      }
    });
    ro.observe(el);
    return () => { ro.disconnect(); chartRef.current?.remove(); chartRef.current = null; };
  }, [build]);

  // ── Collect legend info ─────────────────────────────────────────
  const legendItems = [
    { color: RESISTANCE_COLOR, label: 'مقاومت' },
    { color: SUPPORT_COLOR, label: 'حمایت' },
    { color: MA100_COLOR, label: 'MA100' },
    { color: MA21_COLOR, label: 'MA21' },
    { color: '#ffb11b', label: 'هدف قیمتی' },
  ];

  return (
    <div dir="ltr" className="relative w-full rounded-2xl overflow-hidden border border-white/6 bg-[#0d1424]" style={{ height: 550 }}>
      {/* ── Chart container ── */}
      <div ref={containerRef} className="w-full h-full" />

      {/* ── Legend overlay ── */}
      <div dir="rtl" className="absolute top-2 right-2 z-10 flex flex-wrap gap-1.5 pointer-events-none">
        {legendItems.map(item => (
          <span
            key={item.label}
            className="px-2 py-0.5 rounded text-[10px] font-bold border"
            style={{
              background: `${item.color}20`,
              color: item.color,
              borderColor: `${item.color}40`,
            }}
          >
            {item.label}
          </span>
        ))}
      </div>

      {/* ── Watermark ── */}
      <div dir="rtl" className="absolute bottom-2 left-2 z-10 pointer-events-none">
        <span className="text-[10px] text-gray-600 font-medium">{symbolName} — نمودار روزانه</span>
      </div>
    </div>
  );
});

export default TradingViewChartInner;

export function TradingViewChartSkeleton() {
  return <Skeleton className="w-full h-[550px] rounded-2xl bg-white/5" />;
}
