'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type Time,
} from 'lightweight-charts';

interface CandlestickChartProps {
  data: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  ta: {
    sma: Record<string, number>;
    bollingerBands: { upper: number; middle: number; lower: number };
    resistances: number[];
    supports: number[];
    sar: number;
  } | null;
  height?: number;
}

const BULL = '#34c98b';
const BEAR = '#ef4d62';
const BG = '#0b0f1a';
const TXT = '#9db4c2';
const GRID = 'rgba(255,255,255,0.04)';

const SMA_CFG = [
  { key: 'sma21', color: '#3ad5db', title: 'SMA 21' },
  { key: 'sma50', color: '#ffb11b', title: 'SMA 50' },
  { key: 'sma100', color: '#ff7b32', title: 'SMA 100' },
];

export default function CandlestickChart({ data, ta, height = 500 }: CandlestickChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const build = useCallback(() => {
    const el = ref.current;
    if (!el || data.length === 0) return;

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(el, {
      layout: { background: { type: ColorType.Solid, color: BG }, textColor: TXT, fontSize: 11 },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.05, bottom: 0.3 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', rightOffset: 5, barSpacing: 6 },
      width: el.clientWidth,
      height,
    });
    chartRef.current = chart;

    // Use numeric time index since dates are Jalali
    const candles = data.map((d, i) => ({
      time: i as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const cs = chart.addSeries(CandlestickSeries, {
      upColor: BULL, downColor: BEAR,
      borderUpColor: BULL, borderDownColor: BEAR,
      wickUpColor: BULL, wickDownColor: BEAR,
    });
    cs.setData(candles);

    // Volume
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    vol.setData(data.map((d, i) => ({
      time: i as Time,
      value: d.volume,
      color: d.close >= d.open ? BULL : BEAR,
    })));
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    // TA overlays as price lines
    if (ta) {
      for (const cfg of SMA_CFG) {
        const v = ta.sma[cfg.key];
        if (v && v > 0) cs.createPriceLine({ price: v, color: cfg.color, lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: cfg.title });
      }
      const bb = ta.bollingerBands;
      if (bb) {
        if (bb.upper > 0) cs.createPriceLine({ price: bb.upper, color: 'rgba(161,98,255,0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BB Upper' });
        if (bb.middle > 0) cs.createPriceLine({ price: bb.middle, color: 'rgba(161,98,255,0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BB Mid' });
        if (bb.lower > 0) cs.createPriceLine({ price: bb.lower, color: 'rgba(161,98,255,0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BB Lower' });
      }
      if (ta.sar > 0) cs.createPriceLine({ price: ta.sar, color: 'rgba(255,255,255,0.35)', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'SAR' });
      ta.resistances?.forEach((p, i) => { if (p > 0) cs.createPriceLine({ price: p, color: BEAR, lineWidth: 1, lineStyle: 2, axisLabelVisible: i < 2, title: `R${i + 1}` }); });
      ta.supports?.forEach((p, i) => { if (p > 0) cs.createPriceLine({ price: p, color: BULL, lineWidth: 1, lineStyle: 2, axisLabelVisible: i < 2, title: `S${i + 1}` }); });
    }

    chart.timeScale().fitContent();
  }, [data, ta, height]);

  useEffect(() => {
    build();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) { const { width: w, height: h } = e.contentRect; if (w > 0 && h > 0) chartRef.current?.applyOptions({ width: w, height: h }); }
    });
    ro.observe(el);
    return () => { ro.disconnect(); chartRef.current?.remove(); chartRef.current = null; };
  }, [build]);

  return <div ref={ref} className="w-full overflow-hidden rounded-lg" style={{ height }} />;
}
