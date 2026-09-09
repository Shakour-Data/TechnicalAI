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
  Circle,
  Waypoints,
  MessageSquare,
  TrendingUp,
  GitBranch,
  ArrowRight,
  Spline,
} from 'lucide-react';
import { formatJalaliString, candleDateToJalali, isGregorianDate, toPersianDigits } from '@/lib/jalali';
import { useTheme } from '@/lib/theme-store';

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
  score: number;
  grade: string;
  overlapCount: number;
  methods: string[];
  fibRatio?: string;
  fibLabel?: string;
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
    ema: Record<string, number>;
    bollingerBands: { upper: number; middle: number; lower: number };
    resistances: number[];
    supports: number[];
    supportStrengths: LevelStrength[];
    resistanceStrengths: LevelStrength[];
    sar: number;
    smaArray?: Record<string, number[]>;
    emaArray?: Record<string, number[]>;
    ichimokuArrays?: { tenkan: number[]; kijun: number[]; senkouA: number[]; senkouB: number[] };
    vwapArray?: number[];
  } | null;
  height?: number;
  priceDecimals?: number;
}

/* ----------------------------- CONSTANTS -- */

const BULL = '#22c55e';   // Candle up — vivid green
const BEAR = '#ef4444';   // Candle down — vivid red
const SUPPORT_COLOR = '#2563eb';  // Support lines — blue
const RESIST_COLOR = '#ea580c'; // Resistance lines — orange


const PALETTE = ['#22c55e', '#ef4444', '#d97706', '#0891b2', '#7c3aed', '#374151'];

const SMA_CFG = [
  { key: 'sma9', color: '#8b5cf6', title: 'SMA 9' },
  { key: 'sma21', color: '#06b6d4', title: 'SMA 21' },
  { key: 'sma50', color: '#d946ef', title: 'SMA 50' },
  { key: 'sma100', color: '#a855f7', title: 'SMA 100' },
  { key: 'sma200', color: '#ec4899', title: 'SMA 200' },
];

const EMA_CFG = [
  { key: 'ema9', color: '#8b5cf6', title: 'EMA 9', dash: [2, 2] as [number, number] },
  { key: 'ema21', color: '#06b6d4', title: 'EMA 21', dash: [2, 2] as [number, number] },
  { key: 'ema50', color: '#d946ef', title: 'EMA 50', dash: [2, 2] as [number, number] },
  { key: 'ema200', color: '#ec4899', title: 'EMA 200', dash: [2, 2] as [number, number] },
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

const FIB_EXT_LEVELS = [
  { pct: 0, label: '0%' },
  { pct: 0.382, label: '38.2%' },
  { pct: 0.5, label: '50%' },
  { pct: 0.618, label: '61.8%' },
  { pct: 0.786, label: '78.6%' },
  { pct: 1, label: '100%' },
  { pct: 1.272, label: '127.2%' },
  { pct: 1.618, label: '161.8%' },
  { pct: 2.0, label: '200%' },
  { pct: 2.618, label: '261.8%' },
];

type ToolType = 'cursor' | 'trendline' | 'hline' | 'vline' | 'ray' | 'fibonacci' | 'fibext' | 'rectangle' | 'ellipse' | 'path' | 'text' | 'callout' | 'brush' | 'measure' | 'arrow' | 'pitchfork' | 'channel' | 'regression';

// — S/R strength-based line styling (solid only, thickness = strength) ————
function srLineStyle(strength: number, isTarget: boolean): { lineWidth: number; lineStyle: 0; color: string } {
  if (isTarget) {
    return { lineWidth: 4, lineStyle: 0, color: '' };
  }
  if (strength >= 9) return { lineWidth: 5, lineStyle: 0, color: '' };
  if (strength >= 7) return { lineWidth: 4, lineStyle: 0, color: '' };
  if (strength >= 5) return { lineWidth: 3, lineStyle: 0, color: '' };
  if (strength >= 3) return { lineWidth: 2, lineStyle: 0, color: '' };
  return { lineWidth: 1, lineStyle: 0, color: '' };
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
  { id: 'ray', label: 'پرتو', icon: <ArrowRight className="w-3.5 h-3.5" style={{ transform: 'rotate(-30deg)' }} /> },
  { id: 'fibonacci', label: 'فیبوناچی بازگشتی', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'fibext', label: 'فیبوناچی گشایش', icon: <GitBranch className="w-3.5 h-3.5" /> },
  { id: 'rectangle', label: 'مستطیل', icon: <RectangleHorizontal className="w-3.5 h-3.5" /> },
  { id: 'ellipse', label: 'بیضی', icon: <Circle className="w-3.5 h-3.5" /> },
  { id: 'path', label: 'مسیر', icon: <Spline className="w-3.5 h-3.5" /> },
  { id: 'text', label: 'متن', icon: <Type className="w-3.5 h-3.5" /> },
  { id: 'callout', label: 'یادداشت', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: 'brush', label: 'قلم', icon: <Pencil className="w-3.5 h-3.5" /> },
  { id: 'measure', label: 'اندازه‌گیری', icon: <Ruler className="w-3.5 h-3.5" /> },
  { id: 'arrow', label: 'پیکان', icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  { id: 'pitchfork', label: 'چنگال اندروز', icon: <Waypoints className="w-3.5 h-3.5" /> },
  { id: 'channel', label: 'کانال موازی', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: 'regression', label: 'خط رگرسیون', icon: <TrendingUp className="w-3.5 h-3.5" style={{ transform: 'scaleX(-1)' }} /> },
];

/* ----------------------------- SKELETON ---- */

export function CandlestickChartSkeleton() {
  const { colors: C } = useTheme();
  return (
    <div className="w-full">
      <div className="h-10 rounded-t-lg" style={{ background: C.cardBg, borderBottom: `1px solid ${C.cardBorder}` }} />
      <div className="w-full rounded-b-lg" style={{ height: 520, background: C.cardBg, opacity: 0.5 }} />
    </div>
  );
}

/* ----------------------------- COMPONENT --- */

export default function CandlestickChart({ data, ta, height = 520, priceDecimals = 0 }: CandlestickChartProps) {
  const { colors: C, isDark } = useTheme();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const csRef = useRef<any>(null);
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
    const price = csRef.current?.coordinateToPrice(y) ?? null;
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
          const y0 = csRef.current?.priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = csRef.current?.priceToCoordinate(p1.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null) break;
          html += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="${lw}" />`;
          break;
        }
        case 'hline': {
          if (d.points.length < 1) break;
          const p = d.points[0];
          const y = csRef.current?.priceToCoordinate(p.price);
          if (y == null) break;
          html += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${col}" stroke-width="${lw}" stroke-dasharray="6,3" />`;
          html += `<text x="4" y="${y - 4}" fill="${col}" font-size="11" font-family="Vazirmatn, sans-serif">${toPersianDigits(p.price.toFixed(priceDecimals))}</text>`;
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

          const yTop = csRef.current?.priceToCoordinate(priceHigh);
          const yBottom = csRef.current?.priceToCoordinate(priceLow);
          if (yTop == null || yBottom == null) break;
          html += `<rect x="${Math.min(x0,x1)}" y="${yTop}" width="${Math.abs(x1-x0)}" height="${yBottom - yTop}" fill="${col}" opacity="0.04" />`;

          for (const level of FIB_LEVELS) {
            const price = priceHigh - level.pct * priceRange;
            const y = csRef.current?.priceToCoordinate(price);
            if (y == null) continue;
            html += `<line x1="${Math.min(x0,x1) - 10}" y1="${y}" x2="${Math.max(x0,x1) + 10}" y2="${y}" stroke="${col}" stroke-width="1" opacity="0.6" />`;
            html += `<rect x="${Math.max(x0,x1) + 12}" y="${y - 8}" width="56" height="16" fill="${C.cardBg}" stroke="${C.cardBorder}" stroke-width="1" rx="2" />`;
            html += `<text x="${Math.max(x0,x1) + 14}" y="${y + 4}" fill="${col}" font-size="10" font-family="Vazirmatn, sans-serif">${toPersianDigits(level.label)} ${toPersianDigits(price.toFixed(priceDecimals))}</text>`;
          }
          break;
        }
        case 'rectangle': {
          if (d.points.length < 2) break;
          const p0 = d.points[0];
          const p1 = d.points[d.points.length - 1];
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const y0 = csRef.current?.priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = csRef.current?.priceToCoordinate(p1.price);
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
          const y = csRef.current?.priceToCoordinate(p.price);
          if (x == null || y == null) break;
          html += `<rect x="${x + 4}" y="${y - 16}" width="${d.text.length * 8 + 12}" height="22" fill="${C.cardBg}" stroke="${C.cardBorder}" stroke-width="1" rx="3" />`;
          html += `<text x="${x + 10}" y="${y + 1}" fill="${col}" font-size="12" font-family="Vazirmatn, sans-serif">${d.text}</text>`;
          break;
        }
        case 'brush': {
          if (d.points.length < 2) break;
          let pts = '';
          let valid = true;
          for (const p of d.points) {
            const x = chart.timeScale().timeToCoordinate(p.time as Time);
            const y = csRef.current?.priceToCoordinate(p.price);
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
          const y0 = csRef.current?.priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = csRef.current?.priceToCoordinate(p1.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null) break;

          html += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="${lw}" stroke-dasharray="4,2" />`;
          const diff = p1.price - p0.price;
          const pctChg = p0.price !== 0 ? ((diff / p0.price) * 100) : 0;
          const bars = Math.abs(Math.round(p1.time - p0.time));
          const midX = (x0 + x1) / 2;
          const midY = (y0 + y1) / 2;
          const label = `${diff >= 0 ? '+' : ''}${toPersianDigits(diff.toFixed(priceDecimals))} (${pctChg >= 0 ? '+' : ''}${toPersianDigits(pctChg.toFixed(1))}%) ${toPersianDigits(String(bars))}bar`;
          html += `<rect x="${midX - 40}" y="${midY - 24}" width="80" height="20" fill="${C.cardBg}" stroke="${C.cardBorder}" stroke-width="1" rx="3" />`;
          html += `<text x="${midX - 36}" y="${midY - 10}" fill="${col}" font-size="10" font-family="Vazirmatn, sans-serif">${label}</text>`;
          break;
        }
        case 'arrow': {
          if (d.points.length < 2) break;
          const p0 = d.points[0];
          const p1 = d.points[d.points.length - 1];
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const y0 = csRef.current?.priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = csRef.current?.priceToCoordinate(p1.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null) break;
          const markerId = `arrow-${col.replace('#','')}`;
          html += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="${lw}" marker-end="url(#${markerId})" />`;
          break;
        }
        case 'ray': {
          if (d.points.length < 2) break;
          const p0 = d.points[0];
          const p1 = d.points[d.points.length - 1];
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const y0 = csRef.current?.priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = csRef.current?.priceToCoordinate(p1.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null) break;
          // Extend the line from p1 to the edge of the chart
          const dx = x1 - x0;
          const dy = y1 - y0;
          const extendFactor = 10;
          const xEnd = x1 + dx * extendFactor;
          const yEnd = y1 + dy * extendFactor;
          html += `<line x1="${x0}" y1="${y0}" x2="${xEnd}" y2="${yEnd}" stroke="${col}" stroke-width="${lw}" />`;
          break;
        }
        case 'fibext': {
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
          const yTop = csRef.current?.priceToCoordinate(priceHigh);
          const yBot = csRef.current?.priceToCoordinate(priceLow);
          if (yTop == null || yBot == null) break;
          // Extension base rect (0-100%)
          html += `<rect x="${Math.min(x0,x1)}" y="${yTop}" width="${Math.abs(x1-x0)}" height="${yBot - yTop}" fill="${col}" opacity="0.04" />`;
          // Extension zone (100%+)
          const extY = csRef.current?.priceToCoordinate(priceHigh - 2.618 * priceRange);
          if (extY != null) {
            html += `<rect x="${Math.max(x0,x1)}" y="${yBot}" width="${Math.abs(x1-x0) * 2}" height="${extY - yBot}" fill="${col}" opacity="0.02" />`;
          }
          for (const level of FIB_EXT_LEVELS) {
            const price = priceHigh - level.pct * priceRange;
            const y = csRef.current?.priceToCoordinate(price);
            if (y == null) continue;
            const isExt = level.pct > 1;
            const xStart = isExt ? Math.max(x0, x1) : Math.min(x0, x1) - 10;
            const xEnd = isExt ? Math.max(x0, x1) + Math.abs(x1 - x0) * 1.5 : Math.max(x0, x1) + 10;
            html += `<line x1="${xStart}" y1="${y}" x2="${xEnd}" y2="${y}" stroke="${col}" stroke-width="1" opacity="${isExt ? '0.4' : '0.6'}" ${isExt ? 'stroke-dasharray="4,3"' : ''} />`;
            html += `<rect x="${xEnd + 2}" y="${y - 8}" width="64" height="16" fill="${C.cardBg}" stroke="${C.cardBorder}" stroke-width="1" rx="2" />`;
            html += `<text x="${xEnd + 4}" y="${y + 4}" fill="${col}" font-size="10" font-family="Vazirmatn, sans-serif">${toPersianDigits(level.label)} ${toPersianDigits(price.toFixed(priceDecimals))}</text>`;
          }
          break;
        }
        case 'ellipse': {
          if (d.points.length < 2) break;
          const p0 = d.points[0];
          const p1 = d.points[d.points.length - 1];
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const y0 = csRef.current?.priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = csRef.current?.priceToCoordinate(p1.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null) break;
          const cx = (x0 + x1) / 2;
          const cy = (y0 + y1) / 2;
          const rx = Math.abs(x1 - x0) / 2;
          const ry = Math.abs(y1 - y0) / 2;
          html += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${col}" fill-opacity="0.06" stroke="${col}" stroke-width="${lw}" />`;
          break;
        }
        case 'path': {
          if (d.points.length < 2) break;
          let pts = '';
          let valid = true;
          for (const p of d.points) {
            const x = chart.timeScale().timeToCoordinate(p.time as Time);
            const y = csRef.current?.priceToCoordinate(p.price);
            if (x == null || y == null) { valid = false; break; }
            pts += `${x},${y} `;
          }
          if (!valid || pts.length === 0) break;
          html += `<polyline points="${pts.trim()}" fill="none" stroke="${col}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round" />`;
          // Draw dots at each vertex
          for (const p of d.points) {
            const x = chart.timeScale().timeToCoordinate(p.time as Time);
            const y = csRef.current?.priceToCoordinate(p.price);
            if (x == null || y == null) continue;
            html += `<circle cx="${x}" cy="${y}" r="3" fill="${col}" />`;
          }
          break;
        }
        case 'callout': {
          if (d.points.length < 1 || !d.text) break;
          const p = d.points[0];
          const x = chart.timeScale().timeToCoordinate(p.time as Time);
          const y = csRef.current?.priceToCoordinate(p.price);
          if (x == null || y == null) break;
          const boxW = Math.max(d.text.length * 8 + 20, 60);
          const boxH = 28;
          const boxX = x + 8;
          const boxY = y - boxH - 8;
          // Arrow from box to point
          html += `<line x1="${boxX}" y1="${boxY + boxH}" x2="${x}" y2="${y}" stroke="${col}" stroke-width="1" />`;
          html += `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="${C.cardBg}" stroke="${col}" stroke-width="1" rx="4" />`;
          html += `<text x="${boxX + 6}" y="${boxY + boxH / 2 + 4}" fill="${col}" font-size="11" font-family="Vazirmatn, sans-serif">${d.text}</text>`;
          break;
        }
        case 'pitchfork': {
          if (d.points.length < 3) break;
          const p0 = d.points[0]; // start of median
          const p1 = d.points[1]; // end of median
          const p2 = d.points[2]; // fork point
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const y0 = csRef.current?.priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = csRef.current?.priceToCoordinate(p1.price);
          const x2 = chart.timeScale().timeToCoordinate(p2.time as Time);
          const y2 = csRef.current?.priceToCoordinate(p2.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null || x2 == null || y2 == null) break;
          // Median line (p0 -> p1 extended)
          const dx = x1 - x0;
          const dy = y1 - y0;
          html += `<line x1="${x0}" y1="${y0}" x2="${x1 + dx * 5}" y2="${y1 + dy * 5}" stroke="${col}" stroke-width="${lw}" />`;
          // Upper parallel: offset = (p2 - median_line) distance
          const medianSlope = dx !== 0 ? dy / dx : 0;
          const medianYatX2 = y0 + medianSlope * (x2 - x0);
          const offset = y2 - medianYatX2;
          html += `<line x1="${x0}" y1="${y0 + offset}" x2="${x1 + dx * 5}" y2="${y1 + dy * 5 + offset}" stroke="${col}" stroke-width="${lw}" stroke-dasharray="4,2" />`;
          // Lower parallel: mirror the offset
          html += `<line x1="${x0}" y1="${y0 - offset}" x2="${x1 + dx * 5}" y2="${y1 + dy * 5 - offset}" stroke="${col}" stroke-width="${lw}" stroke-dasharray="4,2" />`;
          break;
        }
        case 'channel': {
          if (d.points.length < 3) break;
          const p0 = d.points[0];
          const p1 = d.points[1];
          const p2 = d.points[2];
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const y0 = csRef.current?.priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = csRef.current?.priceToCoordinate(p1.price);
          const x2 = chart.timeScale().timeToCoordinate(p2.time as Time);
          const y2 = csRef.current?.priceToCoordinate(p2.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null || x2 == null || y2 == null) break;
          // Line 1: p0 -> p1 (base)
          const dx = x1 - x0;
          const dy = y1 - y0;
          html += `<line x1="${x0}" y1="${y0}" x2="${x1 + dx * 5}" y2="${y1 + dy * 5}" stroke="${col}" stroke-width="${lw}" />`;
          // Parallel through p2
          const slope = dx !== 0 ? dy / dx : 0;
          const lineYatX2 = y0 + slope * (x2 - x0);
          const offset = y2 - lineYatX2;
          html += `<line x1="${x0}" y1="${y0 + offset}" x2="${x1 + dx * 5}" y2="${y1 + dy * 5 + offset}" stroke="${col}" stroke-width="${lw}" />`;
          // Fill the channel
          const extX = x1 + dx * 5;
          const extY1 = y1 + dy * 5;
          const extY2 = y1 + dy * 5 + offset;
          html += `<polygon points="${x0},${y0} ${extX},${extY1} ${extX},${extY2} ${x0},${y0 + offset}" fill="${col}" fill-opacity="0.05" />`;
          break;
        }
        case 'regression': {
          if (d.points.length < 2) break;
          const p0 = d.points[0];
          const p1 = d.points[d.points.length - 1];
          const x0 = chart.timeScale().timeToCoordinate(p0.time as Time);
          const y0 = csRef.current?.priceToCoordinate(p0.price);
          const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
          const y1 = csRef.current?.priceToCoordinate(p1.price);
          if (x0 == null || y0 == null || x1 == null || y1 == null) break;
          // Draw a straight line from p0 to p1 (linear regression line)
          html += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="${lw}" stroke-dasharray="6,3" />`;
          // Show the price change
          const diff = p1.price - p0.price;
          const pct = p0.price !== 0 ? ((diff / p0.price) * 100) : 0;
          const midX = (x0 + x1) / 2;
          const midY = (y0 + y1) / 2 - 14;
          const label = `رگرسیون: ${diff >= 0 ? '+' : ''}${toPersianDigits(pct.toFixed(1))}%`;
          html += `<rect x="${midX - 50}" y="${midY - 10}" width="100" height="18" fill="${C.cardBg}" stroke="${C.cardBorder}" stroke-width="1" rx="3" />`;
          html += `<text x="${midX - 46}" y="${midY + 3}" fill="${col}" font-size="10" font-family="Vazirmatn, sans-serif">${label}</text>`;
          break;
        }
      }
    }

    svg.innerHTML = html;
  }, [drawings, currentDrawing, priceDecimals]);

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
      return toPersianDigits(price.toLocaleString('en', { maximumFractionDigits: priceDecimals }));
    };

    const chart = createChart(chartEl, {
      layout: { background: { type: ColorType.Solid, color: C.chartBg }, textColor: C.chartText, fontSize: 11 },
      grid: { vertLines: { color: C.chartGrid }, horzLines: { color: C.chartGrid } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: C.chartCrosshair, labelBackgroundColor: C.chartBg }, horzLine: { color: C.chartCrosshair, labelBackgroundColor: C.chartBg } },
      rightPriceScale: {
        borderColor: C.cardBorder,
        scaleMargins: { top: 0.05, bottom: 0.3 },
      },
      timeScale: {
        borderColor: C.cardBorder,
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
    csRef.current = cs;

    // Volume
    const persianVolFormatter = (v: number) => {
      if (v >= 1e9) return toPersianDigits((v / 1e9).toFixed(1)) + 'B';
      if (v >= 1e6) return toPersianDigits((v / 1e6).toFixed(1)) + 'M';
      if (v >= 1e3) return toPersianDigits((v / 1e3).toFixed(1)) + 'K';
      return toPersianDigits(String(Math.round(v)));
    };
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'custom', formatter: persianVolFormatter },
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
      // ── SMA Lines ──
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

      // ── Bollinger Bands ──
      const bb = ta.bollingerBands;
      if (bb) {
        if (bb.upper > 0) cs.createPriceLine({ price: bb.upper, color: 'rgba(124,58,237,0.6)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BB Upper' });
        if (bb.middle > 0) cs.createPriceLine({ price: bb.middle, color: 'rgba(124,58,237,0.6)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BB Mid' });
        if (bb.lower > 0) cs.createPriceLine({ price: bb.lower, color: 'rgba(124,58,237,0.6)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BB Lower' });
      }

      // ── SAR ──
      if (ta.sar > 0)
        cs.createPriceLine({ price: ta.sar, color: 'rgba(217,119,6,0.7)', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'SAR' });

      // ── EMA Lines ──
      for (const cfg of EMA_CFG) {
        const v = ta.ema[cfg.key];
        if (v && v > 0)
          cs.createPriceLine({
            price: v,
            color: cfg.color,
            lineWidth: 1,
            lineStyle: 2, // dashed
            axisLabelVisible: true,
            title: cfg.title,
          });
      }

      // ── Ichimoku Cloud ──
      if (ta.ichimokuArrays) {
        const { tenkan, kijun, senkouA, senkouB } = ta.ichimokuArrays;
        // Senkou A line
        const senkouALine = chart.addSeries(LineSeries, {
          color: 'rgba(16,185,129,0.7)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          title: 'Senkou A',
        });
        senkouALine.setData(
          senkouA.map((v, i) => ({ time: i as Time, value: v })).filter(d => d.value > 0)
        );
        // Senkou B line
        const senkouBLine = chart.addSeries(LineSeries, {
          color: 'rgba(239,68,68,0.7)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          title: 'Senkou B',
        });
        senkouBLine.setData(
          senkouB.map((v, i) => ({ time: i as Time, value: v })).filter(d => d.value > 0)
        );
      }

      // ── VWAP Line ──
      if (ta.vwapArray && ta.vwapArray.some(v => v > 0)) {
        const vwapLine = chart.addSeries(LineSeries, {
          color: 'rgba(234,179,8,0.8)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          title: 'VWAP',
        });
        vwapLine.setData(
          ta.vwapArray.map((v, i) => ({ time: i as Time, value: v })).filter(d => d.value > 0)
        );
      }

      // ── S/R Levels ──
      const resistanceStrengths = ta.resistanceStrengths || [];
      const supportStrengths = ta.supportStrengths || [];

      resistanceStrengths.slice(0, 6).forEach((r, i) => {
        if (r.price <= 0) return;
        const style = srLineStyle(r.strength, r.isTarget);
        const toFa = (n: number) => String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
        const methodCount = toFa(r.methods?.length ?? 0);
        const fibTag = r.fibLabel ? ` فیبو ${r.fibLabel}` : '';
        const title = r.isTarget
          ? `★ R${toFa(i + 1)} [${r.grade}]`
          : `R${toFa(i + 1)} [${r.grade}] (${methodCount} method)${fibTag}`;
        cs.createPriceLine({
          price: r.price,
          color: r.isTarget ? '#c2410c' : RESIST_COLOR,
          lineWidth: style.lineWidth as 1|2|3|4,
          lineStyle: style.lineStyle,
          axisLabelVisible: true,
          title,
        });
      });

      supportStrengths.slice(0, 6).forEach((s, i) => {
        if (s.price <= 0) return;
        const style = srLineStyle(s.strength, s.isTarget);
        const toFa = (n: number) => String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
        const methodCount = toFa(s.methods?.length ?? 0);
        const fibTag = s.fibLabel ? ` فیبو ${s.fibLabel}` : '';
        const title = s.isTarget
          ? `★ S${toFa(i + 1)} [${s.grade}]`
          : `S${toFa(i + 1)} [${s.grade}] (${methodCount} method)${fibTag}`;
        cs.createPriceLine({
          price: s.price,
          color: s.isTarget ? '#1d4ed8' : SUPPORT_COLOR,
          lineWidth: style.lineWidth as 1|2|3|4,
          lineStyle: style.lineStyle,
          axisLabelVisible: true,
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
  }, [data, ta, height, jalaliDates, isDark]);

  /* - Re-render SVG when renderKey changes --------- */
  useEffect(() => {
    renderDrawings();
  }, [renderKey, renderDrawings]);

  /* - Init chart ----------------------- */
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver((entries) => {
        for (const e of entries) {
          const { width: w, height: h } = e.contentRect;
          if (w > 0 && h > 0) {
            try { chartRef.current?.applyOptions({ width: w, height: h }); } catch {}
            try { setChartSize({ w, h }); } catch {}
          }
        }
      });
      ro.observe(el);
    } catch {}
    build();
    return () => {
      try { ro?.disconnect(); } catch {}
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

      if (activeTool === 'callout') {
        const chart = chartRef.current;
        const container = chartContainerRef.current;
        if (!chart || !container) return;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const tempDrawing: Drawing = {
          id: Date.now().toString(),
          type: 'callout',
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

      if (currentDrawing.type === 'brush' || currentDrawing.type === 'path') {
        setCurrentDrawing({
          ...currentDrawing,
          points: [...currentDrawing.points, point],
        });
      } else if (currentDrawing.type !== 'text' && currentDrawing.type !== 'hline' && currentDrawing.type !== 'callout') {
        if (currentDrawing.type === 'pitchfork' || currentDrawing.type === 'channel') {
          // 3-point tools: accumulate points
          const pts = [...currentDrawing.points, point];
          if (pts.length > 3) {
            pts[pts.length - 1] = point;
          }
          setCurrentDrawing({
            ...currentDrawing,
            points: pts,
          });
        } else {
          setCurrentDrawing({
            ...currentDrawing,
            points: [currentDrawing.points[0], point],
          });
        }
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

    const needs3Points = currentDrawing.type === 'pitchfork' || currentDrawing.type === 'channel';
    const minPoints = currentDrawing.type === 'hline' ? 1 : needs3Points ? 3 : 2;
    if (needs3Points && completed.points.length < 3) {
      // Don't finalize yet, keep collecting points
      setCurrentDrawing(completed);
      return;
    }
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
  const fmt = (n: number) => toPersianDigits(n.toLocaleString('en', { maximumFractionDigits: priceDecimals }));

  return (
    <div className="w-full">
      {/* - CROSSHAIR LEGEND (Shamsi date + OHLC) ---------- */}
      {hoverInfo && (
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-t-lg text-[11px]" dir="rtl" style={{ fontFamily: 'Vazirmatn, sans-serif', background: C.cardBg, borderBottom: `1px solid ${C.cardBorder}` }}>
          <span style={{ color: C.chartText, fontWeight: 500 }}>{hoverInfo.date}</span>
          <div style={{ width: 1, height: 14, background: C.cardBorder }} />
          <span style={{ color: C.chartText }}>باز: <span style={{ fontWeight: 700, color: chgColor(hoverInfo.o, hoverInfo.c) === BULL ? C.bullColor : C.bearColor }}>{fmt(hoverInfo.o)}</span></span>
          <span style={{ color: C.chartText }}>بالا: <span style={{ fontWeight: 700, color: C.bullColor }}>{fmt(hoverInfo.h)}</span></span>
          <span style={{ color: C.chartText }}>پایین: <span style={{ fontWeight: 700, color: C.bearColor }}>{fmt(hoverInfo.l)}</span></span>
          <span style={{ color: C.chartText }}>بسته: <span style={{ fontWeight: 700, color: chgColor(hoverInfo.o, hoverInfo.c) === BULL ? C.bullColor : C.bearColor }}>{fmt(hoverInfo.c)}</span></span>
          {hoverInfo.v > 0 && (
            <span style={{ color: C.chartText }}>حجم: <span style={{ fontWeight: 700, color: C.cardFg }}>{toPersianDigits((hoverInfo.v / 1e6).toFixed(1))}M</span></span>
          )}
          <span style={{ fontWeight: 700, color: hoverInfo.chg >= 0 ? C.bullColor : C.bearColor }}>
            {hoverInfo.chg >= 0 ? '▲' : '▼'} {toPersianDigits(Math.abs(hoverInfo.chg).toFixed(2))}٪
          </span>
        </div>
      )}
      {/* - TOOLBAR --------------------- */}
      <div
        className={`flex items-center gap-1 px-2 py-1.5 overflow-x-auto flex-nowrap border ${hoverInfo ? 'border-t-0 rounded-b-lg' : 'rounded-t-lg border-b-0'}`}
        style={{ backgroundColor: C.cardBg, borderColor: C.cardBorder }}
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
                ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                : ''
            }`}
            style={activeTool !== tool.id ? { color: C.cardSubFg } : undefined}
          >
            {tool.icon}
          </button>
        ))}

        <div className="w-px h-6 mx-1 shrink-0" style={{ background: C.cardBorder }} />

        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setActiveColor(c)}
            title={c}
            className={`shrink-0 w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
              activeColor === c ? 'scale-110' : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: c, borderColor: activeColor === c ? C.cardFg : undefined }}
          />
        ))}

        <div className="w-px h-6 mx-1 shrink-0" style={{ background: C.cardBorder }} />

        <button
          onClick={handleDeleteLast}
          title="حذف آخر"
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md hover:bg-[rgba(255,117,138,0.1)] hover:text-[#ff758a] transition-all cursor-pointer"
          style={{ color: C.cardSubFg }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleClearAll}
          title="پاک کردن همه"
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md hover:bg-[rgba(255,117,138,0.1)] hover:text-[#ff758a] transition-all cursor-pointer"
          style={{ color: C.cardSubFg }}
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="mr-auto shrink-0 text-xs font-medium" style={{ color: C.cardSubFg }} dir="rtl">
          {TOOLS.find((t) => t.id === activeTool)?.label}
        </div>
      </div>

      <div
        className="relative rounded-b-lg overflow-hidden"
        style={{ height, border: `1px solid ${C.cardBorder}` }}
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
              className="border rounded px-2 py-1 text-sm outline-none focus:border-amber-500 w-32"
              style={{ background: C.cardBg, borderColor: C.inputBorder, color: C.cardFg }}
              onBlur={handleTextSubmit}
            />
          </div>
        )}
      </div>
    </div>
  );
}
