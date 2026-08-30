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
import { smartJalaliDate, toPersianDigits } from '@/lib/jalali';

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
  supportStrengths: { price: number; strength: number; isTarget: boolean }[];
  resistanceStrengths: { price: number; strength: number; isTarget: boolean }[];
  ma21: number;
  ma100: number;
  scenarios: Record<string, { targetMin: number; targetMax: number; name: string; probability: number; color: string }>;
}

// ═══════════════════════════════════════════════════════════════════
// Constants — WHITE/DARK THEME (light)
// ═══════════════════════════════════════════════════════════════════

const BULL = '#22a366';
const BEAR = '#e04060';
const BG = '#ffffff';
const TXT = '#374151';
const GRID = 'rgba(0,0,0,0.04)';
const BORDER_COLOR = 'rgba(0,0,0,0.08)';
const MA21_COLOR = '#0891b2';
const MA100_COLOR = '#7c3aed';
const SUPPORT_COLOR = '#22a366';
const RESISTANCE_COLOR = '#e04060';

// ═══════════════════════════════════════════════════════════════════
// Helper: Forward ref for parent capture
// ═══════════════════════════════════════════════════════════════════
export interface TradingViewChartRef {
  getChart: () => IChartApi | null;
  getElement: () => HTMLDivElement | null;
}

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

// ── S/R strength-based line styling ───────────────────────────
// v2: thickness + dash pattern reflect strength level
function srLineStyle(strength: number, isTarget: boolean): { lineWidth: number; lineStyle: 0 | 1 | 2 } {
  if (isTarget) {
    return { lineWidth: 3, lineStyle: 0 };
  }
  if (strength >= 9) return { lineWidth: 4, lineStyle: 0 };      // very thick solid
  if (strength >= 7) return { lineWidth: 3, lineStyle: 0 };      // thick solid
  if (strength >= 5) return { lineWidth: 2, lineStyle: 1 };      // medium dotted
  if (strength >= 3) return { lineWidth: 2, lineStyle: 2 };      // medium dashed
  return { lineWidth: 1, lineStyle: 2 };                          // thin dashed
}

// ═══════════════════════════════════════════════════════════════════
// Chart Component
// ═══════════════════════════════════════════════════════════════════

const TradingViewChartInner = memo(function TradingViewChartInner({
  symbolName, candles, supports, resistances, supportStrengths, resistanceStrengths, ma21, ma100, scenarios,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const build = useCallback(() => {
    const el = containerRef.current;
    if (!el || candles.length === 0) return;

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    // ── Build Jalali time formatter ────────────────────────────
    const jalaliMap = new Map<number, string>();
    candles.forEach((c, i) => {
      jalaliMap.set(i, smartJalaliDate(c.date, 'compact'));
    });

    // ── Create chart ──────────────────────────────────────────
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
        borderColor: BORDER_COLOR,
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
      timeScale: {
        borderColor: BORDER_COLOR,
        rightOffset: 5,
        barSpacing: 7,
        minBarSpacing: 2,
        timeVisible: false,
        tickMarkFormatter: (time: Time) => {
          const idx = time as number;
          return jalaliMap.get(idx) || toPersianDigits(String(idx));
        },
      },
      localization: {
        priceFormatter: (price: number) => toPersianDigits(price.toLocaleString('en', { maximumFractionDigits: 0 })),
      },
      width: el.clientWidth,
      height: el.clientHeight,
    });
    chartRef.current = chart;

    // ── Candlestick series ─────────────────────────────────────
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

    // ── Volume series ─────────────────────────────────────────
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    const volData: HistogramData<Time>[] = candles.map((c, i) => ({
      time: i as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(34,163,102,0.2)' : 'rgba(224,64,96,0.2)',
    }));
    volSeries.setData(volData);
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // ── MA21 line series ──────────────────────────────────────
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

    // ── MA100 line series ─────────────────────────────────────
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

    // ── Helper: add price line ────────────────────────────────
    const addPriceLine = (
      series: ISeriesApi<'Candlestick'>,
      price: number, color: string, lineWidth: number,
      lineStyle: number, title: string, axisLabelVisible: boolean,
    ) => {
      try {
        series.createPriceLine({ price, color, lineWidth, lineStyle, axisLabelVisible, title });
      } catch { /* skip */ }
    };

    // ── Support levels (with strength) ─────────────────────────
    const validSupports = (supportStrengths || []).filter(s => s.price > 0);
    validSupports.forEach((s, i) => {
      const style = srLineStyle(s.strength, s.isTarget);
      addPriceLine(candleSeries, s.price, s.isTarget ? '#16a34a' : SUPPORT_COLOR, style.lineWidth, style.lineStyle, `S${toPersianDigits(String(i + 1))} (${toPersianDigits(String(s.strength))}/۱۰)`, i < 6);
    });

    // ── Resistance levels (with strength) ─────────────────────
    const validResistances = (resistanceStrengths || []).filter(r => r.price > 0);
    validResistances.forEach((r, i) => {
      const style = srLineStyle(r.strength, r.isTarget);
      addPriceLine(candleSeries, r.price, r.isTarget ? '#dc2626' : RESISTANCE_COLOR, style.lineWidth, style.lineStyle, `R${toPersianDigits(String(i + 1))} (${toPersianDigits(String(r.strength))}/۱۰)`, i < 6);
    });

    // ── Price targets from scenarios ───────────────────────────
    const allTargets: { price: number; color: string; label: string }[] = [];
    const existingSRPrices = new Set([...validSupports, ...validResistances].map(l => Math.round(l.price)));

    for (const [key, s] of Object.entries(scenarios)) {
      const tMin = roundNice(s.targetMin);
      const tMax = roundNice(s.targetMax);
      if (!existingSRPrices.has(Math.round(tMin))) {
        allTargets.push({ price: tMin, color: s.color, label: `${s.name} هدف مین` });
      }
      if (!existingSRPrices.has(Math.round(tMax)) && Math.abs(tMax - tMin) > 1) {
        allTargets.push({ price: tMax, color: s.color, label: `${s.name} هدف ماکس` });
      }
    }

    allTargets.forEach((t, i) => {
      addPriceLine(candleSeries, t.price, t.color, 1, 1, t.label, i < 6);
    });

    // ── Fit content ───────────────────────────────────────────
    chart.timeScale().fitContent();
  }, [candles, supports, resistances, supportStrengths, resistanceStrengths, ma21, ma100, scenarios]);

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
    { color: RESISTANCE_COLOR, label: 'مقاومت (با قدرت)' },
    { color: SUPPORT_COLOR, label: 'حمایت (با قدرت)' },
    { color: MA100_COLOR, label: 'MA۱۰۰' },
    { color: MA21_COLOR, label: 'MA۲۱' },

    { color: '#d97706', label: 'هدف قیمتی' },
  ];

  return (
    <div dir="ltr" className="relative w-full rounded-2xl overflow-hidden border border-[#e5e7eb] bg-[#ffffff] shadow-sm" style={{ height: 550 }}>
      {/* ── Chart container ── */}
      <div ref={containerRef} className="w-full h-full" />

      {/* ── Legend overlay ── */}
      <div dir="rtl" className="absolute top-2 right-2 z-10 flex flex-wrap gap-1.5 pointer-events-none">
        {legendItems.map(item => (
          <span
            key={item.label}
            className="px-2 py-0.5 rounded text-[10px] font-bold border"
            style={{
              background: `${item.color}15`,
              color: item.color,
              borderColor: `${item.color}30`,
            }}
          >
            {item.label}
          </span>
        ))}
      </div>

      {/* ── Watermark ── */}
      <div dir="rtl" className="absolute bottom-2 left-2 z-10 pointer-events-none">
        <span className="text-[10px] text-[#B0A89E] font-medium">{symbolName} — نمودار روزانه</span>
      </div>
    </div>
  );
});

export default TradingViewChartInner;

export function TradingViewChartSkeleton() {
  return <Skeleton className="w-full h-[550px] rounded-2xl bg-[#e5e7eb]" />;
}
