'use client';

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
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
import {
  MousePointer2,
  Minus,
  ArrowLeftRight,
  MoveVertical,
  Layers,
  RectangleHorizontal,
  Type,
  Pencil,
  Ruler,
  ArrowUpRight,
  Trash2,
  X,
} from 'lucide-react';
import { formatJalaliString, candleDateToJalali, isGregorianDate, toPersianDigits } from '@/lib/jalali';

/* ----------------------------- TYPES ----- */

interface DrawingPoint {
  time: number;
  price: number;
}

interface Drawing {
  id: string;
  type: string;
  points: DrawingPoint[];
  color: string;
  lineWidth: number;
  text?: string;
  completed: boolean;
}

interface LevelStrength {
  price: number;
  strength: number;
  isTarget: boolean;
}

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
    supportStrengths: LevelStrength[];
    resistanceStrengths: LevelStrength[];
    sar: number;
  } | null;
  height?: number;
}

/* ----------------------------- CONSTANTS -- */

const BULL = '#22a366';
const BEAR = '#e04060';
const BG = '#ffffff';
const TXT = '#374151';
const GRID = 'rgba(0,0,0,0.06)';
const TOOLBAR_BG = '#ffffff';
const TOOLBAR_BORDER = '#e5e7eb';

const PALETTE = ['#22a366', '#e04060', '#d97706', '#0891b2', '#7c3aed', '#374151'];

const SMA_CFG = [
  { key: 'sma21', color: '#0891b2', title: 'SMA 21' },
  { key: 'sma50', color: '#d97706', title: 'SMA 50' },
  { key: 'sma100', color: '#e04060', title: 'SMA 100' },
];

const FIB_LEVELS = [
  { pct: 0, label: '0%' },
  { pct: 0.236, label: '23.6%' },
  { pct: 0.382, label: '38.2%' },
  { pct: 0.5, label: '50%' },
  { pct: 0.618, label: '61.8%' },
  { pct: 0.786, label: '78.6%' },
  { pct: 1, label: '100%' },
];

type ToolType = 'cursor' | 'trendline' | 'hline' | 'vline' | 'fibonacci' | 'rectangle' | 'text' | 'brush' | 'measure' | 'arrow';

// — S/R strength-based line styling —————————————─
function srLineStyle(strength: number, isTarget: boolean): { lineWidth: number; lineStyle: 0 | 1 | 2; color: string } {
  if (isTarget) {
    return { lineWidth: 3, lineStyle: 0, color: '' };
  }
  if (strength >= 9) return { lineWidth: 4, lineStyle: 0, color: '' };
  if (strength >= 7) return { lineWidth: 3, lineStyle: 0, color: '' };
  if (strength >= 5) return { lineWidth: 2, lineStyle: 1, color: '' };
  if (strength >= 3) return { lineWidth: 2, lineStyle: 2, color: '' };
  return { lineWidth: 1, lineStyle: 2, color: '' };
}

interface ToolDef {
  id: ToolType;
  label: string;
  icon: React.ReactNode;
}

const TOOLS: ToolDef[] = [
  { id: 'cursor', label: 'مؤشر', icon: <MousePointer2 className="w-3.5 h-3.5" /> },
  { id: 'trendline', label: 'خط روند', icon: <Minus className="w-3.5 h-3.5" style={{ transform: 'rotate(-30deg)' }} /> },
  { id: 'hline', label: 'خط افقی', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  { id: 'vline', label: 'خط عمودی', icon: <MoveVertical className="w-3.5 h-3.5" /> },
  { id: 'fibonacci', label: 'فیبوناچی', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'rectangle', label: 'مستطیل', icon: <RectangleHorizontal className="w-3.5 h-3.5" /> },
  { id: 'text', label: 'متن', icon: <Type className="w-3.5 h-3.5" /> },
  { id: 'brush', label: 'قلم', icon: <Pencil className="w-3.5 h-3.5" /> },
  { id: 'measure', label: 'اندازه‌گیری', icon: <Ruler className="w-3.5 h-3.5" /> },
  { id: 'arrow', label: 'پیکان', icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
];

/* ----------------------------- SKELETON ---- */

export function CandlestickChartSkeleton() {
  return (
    <div className="w-full">
      <div className="h-10 bg-white border-b border-gray-200 rounded-t-lg" />
      <div className="w-full bg-gray-200 rounded-b-lg" style={{ height: 520 }} />
    </div>
  );
}

/* ----------------------------- COMPONENT --- */

export default function CandlestickChart({ data, ta, height = 520 }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const subscriberRef = useRef<{ dispose: () => void } | null>(null);
  const crosshairSubRef = useRef<{ dispose: () => void } | null>(null);

  // Crosshair legend state
  const [hoverInfo, setHoverInfo] = useState<{ date: string; o: number; h: number; l: number; c: number; v: number; chg: number } | null>(null);

  // Build Jalali date strings for all candles (memoized)
  const jalaliDates = useMemo(() => {
    return data.map((d) =>
      isGregorianDate(d.date) ? candleDateToJalali(d.date, 'full') : formatJalaliString(d.date, 'full')
    );
  }, [data]);

  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('cursor');
  const [activeColor, setActiveColor] = useState(PALETTE[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<Drawing | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; drawingId: string } | null>(null);
  const [textValue, setTextValue] = useState('');
  const [renderKey, setRenderKey] = useState(0);
  const [chartSize, setChartSize] = useState({ w: 0, h: 0 });

  /* - Helper: coordinate conversion -------------- */
  const getChartPoint = useCallback((clientX: number, clientY: number): DrawingPoint | null => {
    const chart = chartRef.current;
    const container = chartContainerRef.current;
    if (!chart || !container) return null;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const price = (chart.priceScale('right') as any).coordinateToPrice(y);
    const time = chart.timeScale().coordinateToTime(x);
    if (price === null || time === null) return null;
    return { time: time as number, price };
  }, []);

  /* - SVG Rendering --------------------- */
  const renderDrawings = useCallback(() => {
    const chart = chartRef.current;
    const svg = svgRef.current;
    const container = chartContainerRef.current;
    if (!chart || !svg || !container || drawings.length === 0) {
      if (svg) svg.innerHTML = '';
      return;
    }

    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;

    let html = '';

    // Defs for arrow markers
    html += `<defs>`;
    PALETTE.forEach((c) => {
      html += `<marker id="arrow-${c.replace('#','')}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${c}" /></marker>`;
    });
    html += `</defs>`;

    const allDrawings = [...drawings];
    if (currentDrawing) allDrawings.push(currentDrawing);

    for (const d of allDrawings) {
      if (!d.completed && d.points.length === 0) continue;
      const col = d.color;
      const lw = d.lineWidth;

      switch (d.type) {
        case 'trendline': {
          if (d.points.length < 1) break;
          const p0 = d.points[0];
          const p1 = d.points.length > 1 ? d.points[d.points.length - 1] : p0;
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const y0 = (chart.priceScale('right') as any).priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = (chart.priceScale('right') as any).priceToCoordinate(p1.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null) break;
          html += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="${lw}" />`;
          break;
        }
        case 'hline': {
          if (d.points.length < 1) break;
          const p = d.points[0];
          const y = (chart.priceScale('right') as any).priceToCoordinate(p.price);
          if (y == null) break;
          html += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${col}" stroke-width="${lw}" stroke-dasharray="6,3" />`;
          html += `<text x="4" y="${y - 4}" fill="${col}" font-size="11" font-family="Vazirmatn, sans-serif">${toPersianDigits(p.price.toFixed(0))}</text>`;
          break;
        }
        case 'vline': {
          if (d.points.length < 1) break;
          const p = d.points[0];
          const x = chart.timeScale().timeToCoordinate(p.time as Time);
          if (x == null) break;
          html += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${col}" stroke-width="${lw}" stroke-dasharray="6,3" />`;
          break;
        }
        case 'fibonacci': {
          if (d.points.length < 2) break;
          const p0 = d.points[0];
          const p1 = d.points[1];
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          if (x0 == null || x1 == null) break;
          const priceHigh = Math.max(p0.price, p1.price);
          const priceLow = Math.min(p0.price, p1.price);
          const priceRange = priceHigh - priceLow;
          if (priceRange === 0) break;

          const yTop = (chart.priceScale('right') as any).priceToCoordinate(priceHigh);
          const yBottom = (chart.priceScale('right') as any).priceToCoordinate(priceLow);
          if (yTop == null || yBottom == null) break;
          html += `<rect x="${Math.min(x0,x1)}" y="${yTop}" width="${Math.abs(x1-x0)}" height="${yBottom - yTop}" fill="${col}" opacity="0.04" />`;

          for (const level of FIB_LEVELS) {
            const price = priceHigh - level.pct * priceRange;
            const y = (chart.priceScale('right') as any).priceToCoordinate(price);
            if (y == null) continue;
            html += `<line x1="${Math.min(x0,x1) - 10}" y1="${y}" x2="${Math.max(x0,x1) + 10}" y2="${y}" stroke="${col}" stroke-width="1" opacity="0.6" />`;
            html += `<rect x="${Math.max(x0,x1) + 12}" y="${y - 8}" width="56" height="16" fill="#ffffff" stroke="#e5e7eb" stroke-width="1" rx="2" />`;
            html += `<text x="${Math.max(x0,x1) + 14}" y="${y + 4}" fill="${col}" font-size="10" font-family="Vazirmatn, sans-serif">${toPersianDigits(level.label)} ${toPersianDigits(price.toFixed(0))}</text>`;
          }
          break;
        }
        case 'rectangle': {
          if (d.points.length < 2) break;
          const p0 = d.points[0];
          const p1 = d.points[d.points.length - 1];
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const y0 = (chart.priceScale('right') as any).priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = (chart.priceScale('right') as any).priceToCoordinate(p1.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null) break;
          const rx = Math.min(x0, x1);
          const ry = Math.min(y0, y1);
          const rw = Math.abs(x1 - x0);
          const rh = Math.abs(y1 - y0);
          html += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${col}" fill-opacity="0.08" stroke="${col}" stroke-width="${lw}" rx="2" />`;
          break;
        }
        case 'text': {
          if (d.points.length < 1 || !d.text) break;
          const p = d.points[0];
          const x = chart.timeScale().timeToCoordinate(p.time as Time);
          const y = (chart.priceScale('right') as any).priceToCoordinate(p.price);
          if (x == null || y == null) break;
          html += `<rect x="${x + 4}" y="${y - 16}" width="${d.text.length * 8 + 12}" height="22" fill="#ffffff" stroke="#e5e7eb" stroke-width="1" rx="3" />`;
          html += `<text x="${x + 10}" y="${y + 1}" fill="${col}" font-size="12" font-family="Vazirmatn, sans-serif">${d.text}</text>`;
          break;
        }
        case 'brush': {
          if (d.points.length < 2) break;
          let pts = '';
          let valid = true;
          for (const p of d.points) {
            const x = chart.timeScale().timeToCoordinate(p.time as Time);
            const y = (chart.priceScale('right') as any).priceToCoordinate(p.price);
            if (x == null || y == null) { valid = false; break; }
            pts += `${x},${y} `;
          }
          if (!valid || pts.length === 0) break;
          html += `<polyline points="${pts.trim()}" fill="none" stroke="${col}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round" />`;
          break;
        }
        case 'measure': {
          if (d.points.length < 2) break;
          const p0 = d.points[0];
          const p1 = d.points[d.points.length - 1];
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const y0 = (chart.priceScale('right') as any).priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = (chart.priceScale('right') as any).priceToCoordinate(p1.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null) break;

          html += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="${lw}" stroke-dasharray="4,2" />`;
          const diff = p1.price - p0.price;
          const pctChg = p0.price !== 0 ? ((diff / p0.price) * 100) : 0;
          const bars = Math.abs(Math.round(p1.time - p0.time));
          const midX = (x0 + x1) / 2;
          const midY = (y0 + y1) / 2;
          const label = `${diff >= 0 ? '+' : ''}${toPersianDigits(diff.toFixed(0))} (${pctChg >= 0 ? '+' : ''}${toPersianDigits(pctChg.toFixed(1))}%) ${toPersianDigits(String(bars))}bar`;
          html += `<rect x="${midX - 40}" y="${midY - 24}" width="80" height="20" fill="#ffffff" stroke="#e5e7eb" stroke-width="1" rx="3" />`;
          html += `<text x="${midX - 36}" y="${midY - 10}" fill="${col}" font-size="10" font-family="Vazirmatn, sans-serif">${label}</text>`;
          break;
        }
        case 'arrow': {
          if (d.points.length < 2) break;
          const p0 = d.points[0];
          const p1 = d.points[d.points.length - 1];
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const y0 = (chart.priceScale('right') as any).priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = (chart.priceScale('right') as any).priceToCoordinate(p1.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null) break;
          const markerId = `arrow-${col.replace('#','')}`;
          html += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="${lw}" marker-end="url(#${markerId})" />`;
          break;
        }
      }
    }

    svg.innerHTML = html;
  }, [drawings, currentDrawing]);

  // OHLC change color helper
  const chgColor = useCallback((o: number, c: number) => c >= o ? BULL : BEAR, []);

  /* - Chart Build ---------------------- */
  const build = useCallback(() => {
    const chartEl = chartContainerRef.current;
    if (!chartEl || data.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // — Build Jalali time map — detect Gregorian vs Jalali dates —
    const jalaliMap = new Map<number, string>();
    data.forEach((d, i) => {
      jalaliMap.set(i, isGregorianDate(d.date) ? candleDateToJalali(d.date, 'compact') : formatJalaliString(d.date, 'compact'));
    });

    // — Persian numeral price formatter —
    const persianPriceFormatter = (price: number) => {
      return toPersianDigits(price.toLocaleString('en', { maximumFractionDigits: 0 }));
    };

    const chart = createChart(chartEl, {
      layout: { background: { type: ColorType.Solid, color: BG }, textColor: TXT, fontSize: 11 },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '#e5e7eb',
        scaleMargins: { top: 0.05, bottom: 0.3 },
      },
      timeScale: {
        borderColor: '#e5e7eb',
        rightOffset: 5,
        barSpacing: 6,
        tickMarkFormatter: (time: Time) => {
          const idx = time as number;
          return jalaliMap.get(idx) || String(idx);
        },
      },
      localization: {
        priceFormatter: persianPriceFormatter,
      },
      width: chartEl.clientWidth,
      height,
    });
    chartRef.current = chart;

    // Crosshair move handler — show Shamsi date + OHLC legend
    crosshairSubRef.current?.dispose();
    crosshairSubRef.current = chart.subscribeCrosshairMove((param) => {
      if (!param.time || param.time === undefined) {
        setHoverInfo(null);
        return;
      }
      const idx = param.time as number;
      const candle = data[idx];
      if (!candle) {
        setHoverInfo(null);
        return;
      }
      const prevCandle = idx > 0 ? data[idx - 1] : candle;
      const chg = prevCandle.close > 0 ? ((candle.close - prevCandle.close) / prevCandle.close) * 100 : 0;
      setHoverInfo({
        date: jalaliDates[idx] || candle.date,
        o: candle.open,
        h: candle.high,
        l: candle.low,
        c: candle.close,
        v: candle.volume,
        chg,
      });
    }) as unknown as { dispose: () => void };

    // Numeric time index
    const candles = data.map((d, i) => ({
      time: i as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const cs = chart.addSeries(CandlestickSeries, {
      upColor: BULL,
      downColor: BEAR,
      borderUpColor: BULL,
      borderDownColor: BEAR,
      wickUpColor: BULL,
      wickDownColor: BEAR,
    });
    cs.setData(candles);

    // Volume
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    vol.setData(
      data.map((d, i) => ({
        time: i as Time,
        value: d.volume,
        color: d.close >= d.open ? BULL : BEAR,
      }))
    );
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    // TA overlays
    if (ta) {
      for (const cfg of SMA_CFG) {
        const v = ta.sma[cfg.key];
        if (v && v > 0)
          cs.createPriceLine({
            price: v,
            color: cfg.color,
            lineWidth: 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title: cfg.title,
          });
      }
      const bb = ta.bollingerBands;
      if (bb) {
        if (bb.upper > 0) cs.createPriceLine({ price: bb.upper, color: 'rgba(124,58,237,0.6)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BB Upper' });
        if (bb.middle > 0) cs.createPriceLine({ price: bb.middle, color: 'rgba(124,58,237,0.6)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BB Mid' });
        if (bb.lower > 0) cs.createPriceLine({ price: bb.lower, color: 'rgba(124,58,237,0.6)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BB Lower' });
      }
      // SAR — use dark color instead of white (white invisible on white bg)
      if (ta.sar > 0)
        cs.createPriceLine({ price: ta.sar, color: 'rgba(217,119,6,0.7)', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'SAR' });

      // S/R with strength
      const resistanceStrengths = ta.resistanceStrengths || [];
      const supportStrengths = ta.supportStrengths || [];

      resistanceStrengths.forEach((r, i) => {
        if (r.price <= 0) return;
        const style = srLineStyle(r.strength, r.isTarget);
        const title = `R${toPersianDigits(String(i + 1))} (${toPersianDigits(String(r.strength))}/10)`;
        cs.createPriceLine({
          price: r.price,
          color: r.isTarget ? '#dc2626' : BEAR,
          lineWidth: style.lineWidth as 1|2|3|4,
          lineStyle: style.lineStyle,
          axisLabelVisible: i < 6,
          title,
        });
      });

      supportStrengths.forEach((s, i) => {
        if (s.price <= 0) return;
        const style = srLineStyle(s.strength, s.isTarget);
        const title = `S${toPersianDigits(String(i + 1))} (${toPersianDigits(String(s.strength))}/10)`;
        cs.createPriceLine({
          price: s.price,
          color: s.isTarget ? '#16a34a' : BULL,
          lineWidth: style.lineWidth as 1|2|3|4,
          lineStyle: style.lineStyle,
          axisLabelVisible: i < 6,
          title,
        });
      });
    }

    chart.timeScale().fitContent();

    // Subscribe to visible range changes to re-render SVG
    requestAnimationFrame(() => {
      if (chartRef.current) {
        const sub = chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(() => {
          setRenderKey((k) => k + 1);
        });
        subscriberRef.current = sub as unknown as { dispose: () => void };
      }
    });

    // Set initial chart size (deferred to avoid React batching issue)
    requestAnimationFrame(() => {
      if (chartContainerRef.current) {
        setChartSize({ w: chartContainerRef.current.clientWidth, h: height });
      }
    });
  }, [data, ta, height, jalaliDates]);

  /* - Re-render SVG when renderKey changes --------- */
  useEffect(() => {
    renderDrawings();
  }, [renderKey, renderDrawings]);

  /* - Init chart ----------------------- */
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width: w, height: h } = e.contentRect;
        if (w > 0 && h > 0) {
          chartRef.current?.applyOptions({ width: w, height: h });
          setChartSize({ w, h });
        }
      }
    });
    ro.observe(el);
    build();
    return () => {
      ro.disconnect();
      subscriberRef.current?.dispose();
      subscriberRef.current = null;
      crosshairSubRef.current?.dispose();
      crosshairSubRef.current = null;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [build]);

  /* - Mouse event handlers ----------------- */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'cursor') return;
      if (textInput) return;

      const point = getChartPoint(e.clientX, e.clientY);
      if (!point) return;

      if (activeTool === 'hline') {
        const drawing: Drawing = {
          id: Date.now().toString(),
          type: 'hline',
          points: [point],
          color: activeColor,
          lineWidth: 1,
          completed: true,
        };
        setDrawings((prev) => [...prev, drawing]);
        setIsDrawing(false);
        return;
      }

      if (activeTool === 'text') {
        const chart = chartRef.current;
        const container = chartContainerRef.current;
        if (!chart || !container) return;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const tempDrawing: Drawing = {
          id: Date.now().toString(),
          type: 'text',
          points: [point],
          color: activeColor,
          lineWidth: 1,
          text: '',
          completed: false,
        };
        setCurrentDrawing(tempDrawing);
        setTextInput({ x, y, drawingId: tempDrawing.id });
        setTextValue('');
        setIsDrawing(true);
        return;
      }

      const drawing: Drawing = {
        id: Date.now().toString(),
        type: activeTool,
        points: [point],
        color: activeColor,
        lineWidth: activeTool === 'brush' ? 2 : 1,
        completed: false,
      };
      setCurrentDrawing(drawing);
      setIsDrawing(true);
    },
    [activeTool, activeColor, getChartPoint, textInput]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || !currentDrawing) return;

      const point = getChartPoint(e.clientX, e.clientY);
      if (!point) return;

      if (currentDrawing.type === 'brush') {
        setCurrentDrawing({
          ...currentDrawing,
          points: [...currentDrawing.points, point],
        });
      } else if (currentDrawing.type !== 'text' && currentDrawing.type !== 'hline') {
        setCurrentDrawing({
          ...currentDrawing,
          points: [currentDrawing.points[0], point],
        });
      }
    },
    [isDrawing, currentDrawing, getChartPoint]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentDrawing) return;

    if (currentDrawing.type === 'text') return;

    const completed: Drawing = {
      ...currentDrawing,
      completed: true,
    };

    const minPoints = currentDrawing.type === 'hline' ? 1 : 2;
    if (completed.points.length >= minPoints) {
      setDrawings((prev) => [...prev, completed]);
    }

    setCurrentDrawing(null);
    setIsDrawing(false);
  }, [isDrawing, currentDrawing]);

  /* - Text input submit ------------------- */
  const handleTextSubmit = useCallback(() => {
    if (!textInput || !textValue.trim() || !currentDrawing) {
      setTextInput(null);
      setCurrentDrawing(null);
      setIsDrawing(false);
      return;
    }

    const completed: Drawing = {
      ...currentDrawing,
      text: textValue.trim(),
      completed: true,
    };
    setDrawings((prev) => [...prev, completed]);
    setTextInput(null);
    setTextValue('');
    setCurrentDrawing(null);
    setIsDrawing(false);
  }, [textInput, textValue, currentDrawing]);

  const handleTextCancel = useCallback(() => {
    setTextInput(null);
    setTextValue('');
    setCurrentDrawing(null);
    setIsDrawing(false);
  }, []);

  /* - Delete / Clear -------------------- */
  const handleDeleteLast = useCallback(() => {
    setDrawings((prev) => prev.slice(0, -1));
  }, []);

  const handleClearAll = useCallback(() => {
    setDrawings([]);
  }, []);

  /* - Render ------------------------- */
  const fmt = (n: number) => toPersianDigits(n.toLocaleString('en', { maximumFractionDigits: 0 }));

  return (
    <div className="w-full">
      {/* - CROSSHAIR LEGEND (Shamsi date + OHLC) ---------- */}
      {hoverInfo && (
        <div className="flex items-center gap-3 px-3 py-1.5 border border-[#e5e7eb] rounded-t-lg bg-[#ffffff] text-[11px]" dir="rtl" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
          <span className="text-gray-500 font-medium">{hoverInfo.date}</span>
          <div className="w-px h-3.5 bg-gray-200" />
          <span className="text-gray-500">باز: <span className={chgColor(hoverInfo.o, hoverInfo.c) === BULL ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{fmt(hoverInfo.o)}</span></span>
          <span className="text-gray-500">بالا: <span className="text-emerald-700 font-bold">{fmt(hoverInfo.h)}</span></span>
          <span className="text-gray-500">پایین: <span className="text-red-700 font-bold">{fmt(hoverInfo.l)}</span></span>
          <span className="text-gray-500">بسته: <span className={chgColor(hoverInfo.o, hoverInfo.c) === BULL ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{fmt(hoverInfo.c)}</span></span>
          {hoverInfo.v > 0 && (
            <span className="text-gray-500">حجم: <span className="text-gray-900 font-bold">{toPersianDigits((hoverInfo.v / 1e6).toFixed(1))}M</span></span>
          )}
          <span className={`font-bold ${hoverInfo.chg >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {hoverInfo.chg >= 0 ? '▲' : '▼'} {toPersianDigits(Math.abs(hoverInfo.chg).toFixed(2))}٪
          </span>
        </div>
      )}
      {/* - TOOLBAR --------------------- */}
      <div
        className={`flex items-center gap-1 px-2 py-1.5 overflow-x-auto flex-nowrap border ${hoverInfo ? 'border-t-0 rounded-b-lg' : 'rounded-t-lg border-b-0'}`}
        style={{ backgroundColor: TOOLBAR_BG, borderColor: TOOLBAR_BORDER }}
      >
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              setActiveTool(tool.id);
              if (isDrawing) {
                setIsDrawing(false);
                setCurrentDrawing(null);
                setTextInput(null);
              }
            }}
            title={tool.label}
            className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-md transition-all cursor-pointer ${
              activeTool === tool.id
                ? 'bg-amber-500/20 text-amber-800 ring-1 ring-amber-500/30'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            {tool.icon}
          </button>
        ))}

        <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />

        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setActiveColor(c)}
            title={c}
            className={`shrink-0 w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
              activeColor === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}

        <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />

        <button
          onClick={handleDeleteLast}
          title="حذف آخر"
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-700 transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleClearAll}
          title="پاک کردن همه"
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-700 transition-all cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="mr-auto shrink-0 text-xs text-gray-500 font-medium" dir="rtl">
          {TOOLS.find((t) => t.id === activeTool)?.label}
        </div>
      </div>

      <div
        className="relative rounded-b-lg overflow-hidden border border-gray-200"
        style={{ height }}
      >
        <div
          ref={chartContainerRef}
          className="w-full h-full"
          data-chart
        />

        <svg
          ref={svgRef}
          className="absolute top-0 left-0"
          style={{
            width: chartSize.w || '100%',
            height: chartSize.h || '100%',
            pointerEvents: activeTool !== 'cursor' ? 'auto' : 'none',
            zIndex: 10,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {textInput && (
          <div
            className="absolute z-20"
            style={{
              left: textInput.x,
              top: textInput.y - 8,
            }}
          >
            <input
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTextSubmit();
                if (e.key === 'Escape') handleTextCancel();
              }}
              placeholder="متن..."
              autoFocus
              dir="rtl"
              className="bg-white border border-gray-200 rounded px-2 py-1 text-sm text-gray-900 outline-none focus:border-amber-500 w-32"
              onBlur={handleTextSubmit}
            />
          </div>
        )}
      </div>
    </div>
  );
}
