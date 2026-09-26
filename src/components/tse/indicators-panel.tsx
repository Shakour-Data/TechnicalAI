'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toPersianDigits } from '@/lib/jalali';
import { useTheme } from '@/lib/theme-store';
import { formatPriceFa } from '@/lib/format-price';
import SemicircleGauge from '@/components/tse/semicircle-gauge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, ChevronDown, FileCode, FileText } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface IndicatorsPanelProps {
  ta: {
    sma: Record<string, number>;
    ema: Record<string, number>;
    rsi: number;
    mfi: number;
    cci: number;
    stochK: number;
    stochD: number;
    williamsR: number;
    macd: { line: number; signal: number; histogram: number };
    adx: number;
    diPlus: number;
    diMinus: number;
    sar: number;
    atr: number;
    bollingerBands: { upper: number; middle: number; lower: number };
    obv: number;
    ichimoku: {
      tenkan: number; kijun: number; senkouA: number; senkouB: number; chikou: number;
    };
    vwap: number;
    hasVolume?: boolean;
    resistances: number[];
    supports: number[];
    supportStrengths: {
      price: number; strength: number; isTarget: boolean;
      fibRatio: string; fibLabel: string; score: number; grade: string;
      overlapCount: number; methods: string[];
    }[];
    resistanceStrengths: {
      price: number; strength: number; isTarget: boolean;
      fibRatio: string; fibLabel: string; score: number; grade: string;
      overlapCount: number; methods: string[];
    }[];
    trend: {
      short: { direction: string; slope: number; angle: number; r2: number };
      medium: { direction: string; slope: number; angle: number; r2: number };
      long: { direction: string; slope: number; angle: number; r2: number };
    };
    bullScore: number;
    bearScore: number;
    overallSignal: 'bullish' | 'bearish' | 'neutral';
  } | null;
  instrumentCategory?: string;
  priceDecimals?: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const toFa = (n: number) => `\u200E${Math.round(n).toLocaleString('fa-IR')}\u200E`;

const toPercent = (v: number) => Math.round(v * 100);

const getScorePercentages = (bullScoreVal: number) => ({
  bull: Math.round(bullScoreVal * 100),
  bear: 100 - Math.round(bullScoreVal * 100),
});

function rsiSignal(v: number): 'bullish' | 'bearish' | 'neutral' {
  if (v > 70) return 'bearish';
  if (v < 30) return 'bullish';
  return 'neutral';
}

function mfiSignal(v: number): 'bullish' | 'bearish' | 'neutral' {
  if (v > 80) return 'bearish';
  if (v < 20) return 'bullish';
  return 'neutral';
}

function stochSignal(v: number): 'bullish' | 'bearish' | 'neutral' {
  if (v > 80) return 'bearish';
  if (v < 20) return 'bullish';
  return 'neutral';
}

function macdSignal(v: { line: number; signal: number; histogram: number }): 'bullish' | 'bearish' | 'neutral' {
  if (v.histogram > 0 && v.line > v.signal) return 'bullish';
  if (v.histogram < 0 && v.line < v.signal) return 'bearish';
  return 'neutral';
}

function adxSignal(adx: number, diP: number, diM: number): 'bullish' | 'bearish' | 'neutral' {
  if (adx < 20) return 'neutral';
  return diP > diM ? 'bullish' : 'bearish';
}

function trendDirSignal(dir: string): 'bullish' | 'bearish' | 'neutral' {
  if (dir === 'up') return 'bullish';
  if (dir === 'down') return 'bearish';
  return 'neutral';
}

function gradeStyle(grade: string, cardSubFg: string): React.CSSProperties {
  switch (grade) {
    case 'Very Strong': return { background: 'rgba(239,68,68,0.2)', color: '#f87171' };
    case 'Strong': return { background: 'rgba(245,158,11,0.2)', color: '#fbbf24' };
    case 'Moderate': return { background: 'rgba(14,165,233,0.2)', color: '#38bdf8' };
    default: return { background: 'rgba(255,255,255,0.1)', color: cardSubFg };
  }
}

function SignalDot({ signal }: { signal: 'bullish' | 'bearish' | 'neutral' }) {
  const { colors: C } = useTheme();
  const bg = signal === 'bullish' ? C.bullColor : signal === 'bearish' ? C.bearColor : C.cardSubFg;
  return <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: bg }} />;
}

// ─── Indicator Card ────────────────────────────────────────────────────────────

function IndicatorCard({ label, value, signal }: { label: string; value: string; signal: 'bullish' | 'bearish' | 'neutral' }) {
  const { colors: C } = useTheme();
  return (
    <div className="rounded-xl p-3 flex items-center justify-between gap-2" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] truncate" style={{ color: C.cardSubFg }}>{label}</span>
        <span className="text-sm font-medium tabular-nums" style={{ color: C.cardFg }} dir="ltr">{value}</span>
      </div>
      <SignalDot signal={signal} />
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <h3 className="col-span-full text-xs font-semibold text-amber-400/80 mt-5 mb-1.5 first:mt-0">{title}</h3>;
}

// ─── Key Indicators by Category ────────────────────────────────────────────────

type KeyIndicator = {
  id: string;
  label: string;
  getValue: (ta: NonNullable<IndicatorsPanelProps['ta']>) => number;
  signal: 'bullish' | 'bearish' | 'neutral';
};

function getKeyIndicators(ta: NonNullable<IndicatorsPanelProps['ta']>, category?: string): KeyIndicator[] {
  const cat = (category ?? '').toLowerCase();

  if (cat === 'crypto') {
    return [
      { id: 'rsi', label: 'RSI', getValue: (t) => t.rsi, signal: rsiSignal(ta.rsi) },
      { id: 'macd', label: 'هیستوگرام MACD', getValue: (t) => t.macd.histogram, signal: ta.macd.histogram > 0 ? 'bullish' : ta.macd.histogram < 0 ? 'bearish' : 'neutral' },
      { id: 'stochK', label: 'استوکاستیک %K', getValue: (t) => t.stochK, signal: stochSignal(ta.stochK) },
      { id: 'bb', label: 'باندهای بولینگر', getValue: (t) => { const range = t.bollingerBands.upper - t.bollingerBands.lower; return t.bollingerBands.middle > 0 ? (range / t.bollingerBands.middle) * 100 : 50; }, signal: 'neutral' },
      { id: 'mfi', label: 'MFI', getValue: (t) => t.mfi, signal: mfiSignal(ta.mfi) },
    ];
  }

  if (cat === 'forex') {
    return [
      { id: 'rsi', label: 'RSI', getValue: (t) => t.rsi, signal: rsiSignal(ta.rsi) },
      { id: 'stochK', label: 'استوکاستیک %K', getValue: (t) => t.stochK, signal: stochSignal(ta.stochK) },
      { id: 'adx', label: 'ADX', getValue: (t) => t.adx, signal: ta.adx > 25 ? 'bullish' : 'neutral' },
      { id: 'cci', label: 'CCI', getValue: (t) => t.cci, signal: ta.cci > 100 ? 'bearish' : ta.cci < -100 ? 'bullish' : 'neutral' },
      { id: 'macd', label: 'هیستوگرام MACD', getValue: (t) => t.macd.histogram, signal: ta.macd.histogram > 0 ? 'bullish' : ta.macd.histogram < 0 ? 'bearish' : 'neutral' },
    ];
  }

  if (cat === 'gold' || cat === 'silver' || cat === 'gold_etf') {
    return [
      { id: 'rsi', label: 'RSI', getValue: (t) => t.rsi, signal: rsiSignal(ta.rsi) },
      { id: 'macd', label: 'هیستوگرام MACD', getValue: (t) => t.macd.histogram, signal: ta.macd.histogram > 0 ? 'bullish' : ta.macd.histogram < 0 ? 'bearish' : 'neutral' },
      { id: 'adx', label: 'ADX', getValue: (t) => t.adx, signal: ta.adx > 25 ? 'bullish' : 'neutral' },
      { id: 'bb', label: 'باندهای بولینگر', getValue: (t) => { const range = t.bollingerBands.upper - t.bollingerBands.lower; return t.bollingerBands.middle > 0 ? (range / t.bollingerBands.middle) * 100 : 50; }, signal: 'neutral' },
    ];
  }

  if (cat === 'index' || cat === 'tse_index' || cat === 'world_index') {
    return [
      { id: 'adx', label: 'ADX', getValue: (t) => t.adx, signal: ta.adx > 25 ? 'bullish' : 'neutral' },
      { id: 'macd', label: 'هیستوگرام MACD', getValue: (t) => t.macd.histogram, signal: ta.macd.histogram > 0 ? 'bullish' : ta.macd.histogram < 0 ? 'bearish' : 'neutral' },
      { id: 'rsi', label: 'RSI', getValue: (t) => t.rsi, signal: rsiSignal(ta.rsi) },
      { id: 'trend', label: 'روند میان‌مدت', getValue: (t) => t.trend.medium.angle, signal: trendDirSignal(ta.trend.medium.direction) },
    ];
  }

  // Default (TSE stocks)
  return [
    { id: 'rsi', label: 'RSI', getValue: (t) => t.rsi, signal: rsiSignal(ta.rsi) },
    { id: 'macd', label: 'هیستوگرام MACD', getValue: (t) => t.macd.histogram, signal: ta.macd.histogram > 0 ? 'bullish' : ta.macd.histogram < 0 ? 'bearish' : 'neutral' },
    { id: 'adx', label: 'ADX', getValue: (t) => t.adx, signal: ta.adx > 25 ? 'bullish' : 'neutral' },
    { id: 'bb', label: 'باندهای بولینگر', getValue: (t) => { const range = t.bollingerBands.upper - t.bollingerBands.lower; return t.bollingerBands.middle > 0 ? (range / t.bollingerBands.middle) * 100 : 50; }, signal: 'neutral' },
    { id: 'obv', label: 'OBV', getValue: (t) => Math.min(100, Math.max(0, 50 + (t.obv > 0 ? 25 : t.obv < 0 ? -25 : 0))), signal: 'neutral' },
  ];
}

// ─── Trend Analysis ────────────────────────────────────────────────────────────

interface TrendInfo {
  label: string;
  direction: 'rising' | 'falling' | 'stable';
  signal: 'bullish' | 'bearish' | 'neutral';
}

function analyzeIndicatorTrends(ta: NonNullable<IndicatorsPanelProps['ta']>): TrendInfo[] {
  const trends: TrendInfo[] = [];

  trends.push({
    label: 'RSI',
    direction: ta.rsi > 60 ? 'rising' : ta.rsi < 40 ? 'falling' : 'stable',
    signal: rsiSignal(ta.rsi),
  });

  trends.push({
    label: 'استوکاستیک',
    direction: ta.stochK > 60 ? 'rising' : ta.stochK < 40 ? 'falling' : 'stable',
    signal: stochSignal(ta.stochK),
  });

  trends.push({
    label: 'MACD',
    direction: ta.macd.histogram > 0 ? 'rising' : ta.macd.histogram < 0 ? 'falling' : 'stable',
    signal: macdSignal(ta.macd),
  });

  trends.push({
    label: 'ADX',
    direction: ta.adx > 25 ? 'rising' : ta.adx < 15 ? 'falling' : 'stable',
    signal: adxSignal(ta.adx, ta.diPlus, ta.diMinus),
  });

  trends.push({
    label: 'CCI',
    direction: ta.cci > 100 ? 'rising' : ta.cci < -100 ? 'falling' : 'stable',
    signal: ta.cci > 100 ? 'bearish' : ta.cci < -100 ? 'bullish' : 'neutral',
  });

  if (ta.hasVolume !== false) {
    trends.push({
      label: 'MFI',
      direction: ta.mfi > 60 ? 'rising' : ta.mfi < 40 ? 'falling' : 'stable',
      signal: mfiSignal(ta.mfi),
    });
  }

  trends.push({
    label: 'ویلیامز %R',
    direction: ta.williamsR > -40 ? 'rising' : ta.williamsR < -60 ? 'falling' : 'stable',
    signal: ta.williamsR > -20 ? 'bearish' : ta.williamsR < -80 ? 'bullish' : 'neutral',
  });

  const bbWidth = ta.bollingerBands.upper - ta.bollingerBands.lower;
  trends.push({
    label: 'بولینگر',
    direction: bbWidth > ta.bollingerBands.middle * 0.04 ? 'rising' : bbWidth < ta.bollingerBands.middle * 0.02 ? 'falling' : 'stable',
    signal: 'neutral',
  });

  return trends;
}

// ─── Trend Arrow ───────────────────────────────────────────────────────────────

function TrendArrow({ direction, color }: { direction: TrendInfo['direction']; color: string }) {
  if (direction === 'rising') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
        <path d="M6 1 L11 9 L1 9 Z" fill={color} opacity={0.9} />
      </svg>
    );
  }
  if (direction === 'falling') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
        <path d="M6 11 L1 3 L11 3 Z" fill={color} opacity={0.9} />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
      <rect x="1" y="5" width="10" height="2" rx="1" fill={color} opacity={0.6} />
    </svg>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  const { colors: C } = useTheme();
  return (
    <div className="rounded-2xl p-4 space-y-4" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28 bg-white/5" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-16 w-full bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function IndicatorsPanel({ ta, instrumentCategory, priceDecimals }: IndicatorsPanelProps) {
  const { colors: C } = useTheme();

  if (!ta) return <LoadingSkeleton />;

  const maSignal = 'neutral' as const;
  const keyIndicators = getKeyIndicators(ta, instrumentCategory);
  const trendInfos = analyzeIndicatorTrends(ta);
  const risingCount = trendInfos.filter((t) => t.direction === 'rising').length;
  const fallingCount = trendInfos.filter((t) => t.direction === 'falling').length;
  const totalIndicators = trendInfos.length;
  const { bull: bullPct, bear: bearPct } = getScorePercentages(ta.bullScore);

  const fmtKeyVal = (val: number): string => {
    return formatPriceFa(val, priceDecimals ?? 0);
  };

  // Price formatter: uses priceDecimals for all price-type values (SMA, EMA, SAR, BB, etc.)
  const fmtPrice = (val: number): string => {
    return formatPriceFa(val, priceDecimals ?? 0);
  };

  // ─── Export HTML+CSS+JS ────────────────────────────────────────
const exportHTML = useCallback(() => {
     const data = ta;
     const rows: string[] = [];
     const addSection = (title: string, items: Array<{ label: string; value: string; signal?: string }>) => {
       rows.push(`<section><h3>${title}</h3>`);
       items.forEach(it => {
         rows.push(`<div><span>${it.label}</span><span>${it.value}</span>${it.signal ? `<span>${it.signal}</span>` : ''}</div>`);
       });
       rows.push('</section>');
     };

     addSection('خلاصه اندیکاتورها', [
       { label: 'RSI', value: String(data.rsi), signal: data.rsi > 70 ? 'نزولی' : data.rsi < 30 ? 'صعودی' : 'خنثی' },
       { label: 'استوکاستیک %K', value: String(data.stochK), signal: data.stochK > 80 ? 'نزولی' : data.stochK < 20 ? 'صعودی' : 'خنثی' },
       { label: 'ADX', value: String(data.adx), signal: data.adx > 25 ? 'صعودی' : 'خنثی' },
       { label: 'CCI', value: String(data.cci), signal: data.cci > 100 ? 'نزولی' : data.cci < -100 ? 'صعودی' : 'خنثی' },
       { label: 'MFI', value: String(data.mfi), signal: data.mfi > 80 ? 'نزولی' : data.mfi < 20 ? 'صعودی' : 'خنثی' },
       { label: 'ویلیامز %R', value: String(data.williamsR), signal: data.williamsR > -20 ? 'نزولی' : data.williamsR < -80 ? 'صعودی' : 'خنثی' },
     ]);
     addSection('مهمترین اندیکاتورها', [
       { label: 'RSI', value: formatPriceFa(data.rsi, priceDecimals ?? 0) },
       { label: 'هیستوگرام MACD', value: formatPriceFa(data.macd.histogram, priceDecimals ?? 0) },
       { label: 'استوکاستیک %K', value: formatPriceFa(data.stochK, priceDecimals ?? 0) },
       { label: 'باندهای بولینجر', value: `${formatPriceFa(data.bollingerBands.upper, priceDecimals ?? 0)} - ${formatPriceFa(data.bollingerBands.lower, priceDecimals ?? 0)}` },
       { label: 'MFI', value: formatPriceFa(data.mfi, priceDecimals ?? 0) },
     ]);
     addSection('میانگین‌های متحرک', [
       ...Object.entries(data.sma).map(([k, v]) => ({ label: k, value: formatPriceFa(v, priceDecimals ?? 0) })),
       ...Object.entries(data.ema).map(([k, v]) => ({ label: k, value: formatPriceFa(v, priceDecimals ?? 0) })),
     ]);
     addSection('جزئیات تکمیلی', [
       { label: 'MACD Line', value: formatPriceFa(data.macd.line, priceDecimals ?? 0) },
       { label: 'MACD Signal', value: formatPriceFa(data.macd.signal, priceDecimals ?? 0) },
       { label: 'Stochastic %D', value: formatPriceFa(data.stochD, priceDecimals ?? 0) },
       { label: 'DI+', value: formatPriceFa(data.diPlus, priceDecimals ?? 0) },
       { label: 'DI-', value: formatPriceFa(data.diMinus, priceDecimals ?? 0) },
       { label: 'Parabolic SAR', value: formatPriceFa(data.sar, priceDecimals ?? 0) },
     ]);
     addSection('نوسان‌پذیری', [
       { label: 'ATR', value: formatPriceFa(data.atr, priceDecimals ?? 0) },
       { label: 'باند بالایی', value: formatPriceFa(data.bollingerBands.upper, priceDecimals ?? 0) },
       { label: 'باند میانی', value: formatPriceFa(data.bollingerBands.middle, priceDecimals ?? 0) },
       { label: 'باند پایینی', value: formatPriceFa(data.bollingerBands.lower, priceDecimals ?? 0) },
     ]);
     if (data.hasVolume !== false) {
       addSection('حجم', [
         { label: 'OBV', value: formatPriceFa(data.obv, priceDecimals ?? 0) },
         { label: 'VWAP', value: formatPriceFa(data.vwap ?? 0, priceDecimals ?? 0) },
       ]);
     }
     addSection('ابر ایچیموکو', [
       { label: 'تنکان‌سن', value: formatPriceFa(data.ichimoku?.tenkan ?? 0, priceDecimals ?? 0) },
       { label: 'کیجون‌سن', value: formatPriceFa(data.ichimoku?.kijun ?? 0, priceDecimals ?? 0) },
       { label: 'سنکو اسپن A', value: formatPriceFa(data.ichimoku?.senkouA ?? 0, priceDecimals ?? 0) },
       { label: 'سنکو اسپن B', value: formatPriceFa(data.ichimoku?.senkouB ?? 0, priceDecimals ?? 0) },
       { label: 'چیکو اسپن', value: formatPriceFa(data.ichimoku?.chikou ?? 0, priceDecimals ?? 0) },
     ]);
     addSection('حمایت و مقاومت', [
       ...(data.resistanceStrengths ?? []).slice(0, 6).map((r, i) => ({ label: `R${i+1}`, value: formatPriceFa(r.price, priceDecimals ?? 0) })),
       ...(data.supportStrengths ?? []).slice(0, 6).map((s, i) => ({ label: `S${i+1}`, value: formatPriceFa(s.price, priceDecimals ?? 0) })),
     ]);
     addSection('خطوط روند', [
       { label: 'کوتاه‌مدت', value: `${data.trend.short.direction === 'up' ? '↑' : data.trend.short.direction === 'down' ? '↓' : '→'} ${data.trend.short.angle}°` },
       { label: 'میان‌مدت', value: `${data.trend.medium.direction === 'up' ? '↑' : data.trend.medium.direction === 'down' ? '↓' : '→'} ${data.trend.medium.angle}°` },
       { label: 'بلندمدت', value: `${data.trend.long.direction === 'up' ? '↑' : data.trend.long.direction === 'down' ? '↓' : '→'} ${data.trend.long.angle}°` },
     ]);

     const signalLabel = data.overallSignal === 'bullish' ? 'صعودی' : data.overallSignal === 'bearish' ? 'نزولی' : 'خنثی';
     const html = `<!DOCTYPE html>
 <html lang="fa" dir="rtl">
 <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>اندیکاتورها</title>
 <style>
 *{margin:0;padding:0;box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;background:#f5f7fa;color:#111827;padding:20px;direction:rtl}.container{max-width:1200px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,0.08)}.header{background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;padding:20px;border-radius:12px;margin-bottom:20px;text-align:center}.header h1{font-size:1.5rem;margin-bottom:8px}.header p{opacity:0.9}section{margin-bottom:20px}section h3{font-size:1rem;color:#92400e;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb}.card{background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;border:1px solid #e5e7eb}.card .label{font-size:0.85rem;color:#6b7280}.card .value{font-size:1rem;font-weight:600;font-family:monospace;direction:ltr}.bull{color:#16a34a}.bear{color:#dc2626}.neutral{color:#6b7280}.score-bar{height:20px;background:#e5e7eb;border-radius:10px;overflow:hidden;display:flex;margin:10px 0}.score-bar .bull-part{background:#16a34a;transition:width 0.5s}.score-bar .bear-part{background:#dc2626;transition:width 0.5s}.gauge-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;text-align:center}.gauge{background:#f9fafb;border-radius:8px;padding:12px}.gauge .val{font-size:1.5rem;font-weight:700}.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:700}.badge-bull{background:#dcfce7;color:#16a34a}.badge-bear{background:#fee2e2;color:#dc2626}.badge-neutral{background:#f3f4f6;color:#6b7280}
 </style></head>
 <body><div class="container"><div class="header"><h1>📊 اندیکاتورهای تکنیکال</h1><p>سیگنال غالب: ${signalLabel}</p></div>
 <div class="gauge-grid"><div class="gauge"><div class="val" style="color:${data.rsi > 70 ? '#dc2626' : data.rsi < 30 ? '#16a34a' : '#6b7280'}">${data.rsi}</div><div class="label">RSI</div><span class="badge ${data.rsi > 70 ? 'badge-bear' : data.rsi < 30 ? 'badge-bull' : 'badge-neutral'}">${data.rsi > 70 ? 'نزولی' : data.rsi < 30 ? 'صعودی' : 'خنثی'}</span></div><div class="gauge"><div class="val" style="color:${data.stochK > 80 ? '#dc2626' : data.stochK < 20 ? '#16a34a' : '#6b7280'}">${data.stochK}</div><div class="label">استوکاستیک %K</div><span class="badge ${data.stochK > 80 ? 'badge-bear' : data.stochK < 20 ? 'badge-bull' : 'badge-neutral'}">${data.stochK > 80 ? 'نزولی' : data.stochK < 20 ? 'صعودی' : 'خنثی'}</span></div><div class="gauge"><div class="val" style="color:${data.adx > 25 ? '#16a34a' : '#6b7280'}">${data.adx}</div><div class="label">ADX</div><span class="badge ${data.adx > 25 ? 'badge-bull' : 'badge-neutral'}">${data.adx > 25 ? 'قوی' : 'ضعیف'}</span></div><div class="gauge"><div class="val" style="color:${data.cci > 100 ? '#dc2626' : data.cci < -100 ? '#16a34a' : '#6b7280'}">${data.cci}</div><div class="label">CCI</div><span class="badge ${data.cci > 100 ? 'badge-bear' : data.cci < -100 ? 'badge-bull' : 'badge-neutral'}">${data.cci > 100 ? 'نزولی' : data.cci < -100 ? 'صعودی' : 'خنثی'}</span></div><div class="gauge"><div class="val" style="color:${data.mfi > 80 ? '#dc2626' : data.mfi < 20 ? '#16a34a' : '#6b7280'}">${data.mfi}</div><div class="label">MFI</div><span class="badge ${data.mfi > 80 ? 'badge-bear' : data.mfi < 20 ? 'badge-bull' : 'badge-neutral'}">${data.mfi > 80 ? 'اشباع خرید' : data.mfi < 20 ? 'اشباع فروش' : 'عادی'}</span></div><div class="gauge"><div class="val" style="color:${data.williamsR > -20 ? '#dc2626' : data.williamsR < -80 ? '#16a34a' : '#6b7280'}">${data.williamsR}</div><div class="label">ویلیامز %R</div><span class="badge ${data.williamsR > -20 ? 'badge-bear' : data.williamsR < -80 ? 'badge-bull' : 'badge-neutral'}">${data.williamsR > -20 ? 'نزولی' : data.williamsR < -80 ? 'صعودی' : 'خنثی'}</span></div></div>${rows.map(r => `<section>${r}</section>`).join('')}
 <div style="text-align:center;padding:16px;border-top:1px solid #e5e7eb;margin-top:20px;color:#6b7280;font-size:0.8rem">خرید ${Math.round(data.bullScore * 100)}٪ | فروش ${Math.round(data.bearScore * 100)}٪</div></div></body></html>`;
     const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `indicators_${new Date().toISOString().slice(0, 10)}.html`;
     document.body.appendChild(a);
     a.click();
     setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
   }, [ta, priceDecimals]);

  // ─── Export Text ──────────────────────────────────────────────
const exportText = useCallback(() => {
const data = ta;
    const signalLabel = data.overallSignal === 'bullish' ? 'صعودی' : data.overallSignal === 'bearish' ? 'نزولی' : 'خنثی';
    const lines = [
      'اندیکاتورهای تکنیکال',
      `سیگنال غالب: ${signalLabel}`,
      '',
      '═══ خلاصه اندیکاتورها ═══',
      `RSI: ${data.rsi}`,
      `استوکاستیک %K: ${data.stochK}`,
      `ADX: ${data.adx}`,
      `CCI: ${data.cci}`,
      `MFI: ${data.mfi}`,
      `ویلیامز %R: ${data.williamsR}`,
      '',
      '═══ مهمترین اندیکاتورها ═══',
      `RSI: ${formatPriceFa(data.rsi, priceDecimals ?? 0)}`,
      `هیستوگرام MACD: ${formatPriceFa(data.macd.histogram, priceDecimals ?? 0)}`,
      `استوکاستیک %K: ${formatPriceFa(data.stochK, priceDecimals ?? 0)}`,
      `باندهای بولینگر: ${formatPriceFa(data.bollingerBands.upper, priceDecimals ?? 0)} - ${formatPriceFa(data.bollingerBands.lower, priceDecimals ?? 0)}`,
      `MFI: ${formatPriceFa(data.mfi, priceDecimals ?? 0)}`,
      '',
      '══=== میانگین‌های متحرک ═══',
      ...Object.entries(data.sma).map(([k, v]) => `${k}: ${formatPriceFa(v, priceDecimals ?? 0)}`),
      ...Object.entries(data.ema).map(([k, v]) => `${k}: ${formatPriceFa(v, priceDecimals ?? 0)}`),
      '',
      '═══ خطوط روند ═══',
      `کوتاه‌مدت: ${data.trend.short.direction} ${data.trend.short.angle}°`,
      `میان‌مدت: ${data.trend.medium.direction} ${data.trend.medium.angle}°`,
      `بلندمدت: ${data.trend.long.direction} ${data.trend.long.angle}°`,
      '',
      `امتیاز کلی: خرید ${Math.round(data.bullScore * 100)}٪ | فروش ${Math.round(data.bearScore * 100)}٪`,
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indicators_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }, [ta, priceDecimals]);

  return (
    <div className="rounded-2xl p-4 space-y-1" dir="rtl" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>

      {/* ═══ Export Toolbar ═══ */}
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.cardFg }}>خروجی اندیکاتورها</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors"
              style={{
                background: C.cardBg,
                border: `1px solid ${C.cardBorder}`,
                color: C.cardFg,
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              <Download className="w-4 h-4" />
              <span>دانلود / خروجی</span>
              <ChevronDown className="w-3.5 h-3.5" style={{ color: C.cardSubFg }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className=""
            style={{ background: C.cardBg, borderColor: C.cardBorder }}
          >
            <DropdownMenuItem onClick={exportHTML} className="flex items-center gap-3 cursor-pointer" style={{ color: C.cardFg }}>
              <FileCode className="w-4 h-4" style={{ color: C.primary }} />
              <span className="text-xs">HTML</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportText} className="flex items-center gap-3 cursor-pointer" style={{ color: C.cardFg }}>
              <FileText className="w-4 h-4" style={{ color: C.primary }} />
              <span className="text-xs">متن (Text)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ═══ 1. خلاصه اندیکاتورها ═══ */}
      <SectionHeader title="خلاصه اندیکاتورها" />
      <div className="rounded-xl p-4 mb-2" style={{ background: hexToRgba(C.cardBorder, 0.08), border: `1px solid ${hexToRgba(C.cardBorder, 0.2)}` }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 justify-items-center">
          <SemicircleGauge label="RSI" value={ta.rsi} min={0} max={100} signal={rsiSignal(ta.rsi)} zones={{ bearishAbove: 70, bullishBelow: 30 }} size={110} />
          <SemicircleGauge label="استوکاستیک %K" value={ta.stochK} min={0} max={100} signal={stochSignal(ta.stochK)} zones={{ bearishAbove: 80, bullishBelow: 20 }} size={110} />
          <SemicircleGauge label="ADX" value={ta.adx} min={0} max={60} signal={adxSignal(ta.adx, ta.diPlus, ta.diMinus)} size={110} />
          <SemicircleGauge label="CCI" value={ta.cci} min={-200} max={200} signal={ta.cci > 100 ? 'bearish' : ta.cci < -100 ? 'bullish' : 'neutral'} zones={{ bearishAbove: 100, bullishBelow: -100 }} size={110} />
          <SemicircleGauge label="MFI" value={ta.mfi} min={0} max={100} signal={mfiSignal(ta.mfi)} zones={{ bearishAbove: 80, bullishBelow: 20 }} size={110} />
          <SemicircleGauge label="ویلیامز %R" value={ta.williamsR} min={-100} max={0} signal={ta.williamsR > -20 ? 'bearish' : ta.williamsR < -80 ? 'bullish' : 'neutral'} zones={{ bearishAbove: -20, bullishBelow: -80 }} size={110} />
        </div>

        {/* Informative signal summary with score breakdown */}
        <div className="flex items-center justify-center gap-2 mt-3 text-[11px] font-medium">
          <SignalDot signal={ta.overallSignal} />
          <span style={{ color: ta.overallSignal === 'bullish' ? C.bullColor : ta.overallSignal === 'bearish' ? C.bearColor : C.neutralColor }}>
            {ta.overallSignal === 'bullish' ? 'صعودی' : ta.overallSignal === 'bearish' ? 'نزولی' : 'خنثی'}
          </span>
          <span style={{ color: hexToRgba(C.cardSubFg, 0.5) }}>·</span>
          <span style={{ color: C.bullColor }}>خرید {toPersianDigits(String(toPercent(ta.bullScore)))}٪</span>
          <span style={{ color: hexToRgba(C.cardSubFg, 0.5) }}>|</span>
          <span style={{ color: C.bearColor }}>فروش {toPersianDigits(String(toPercent(ta.bearScore)))}٪</span>
        </div>
      </div>

      {/* ═══ 2. مهمترین اندیکاتورها ═══ */}
      <SectionHeader title="مهمترین اندیکاتورها" />
      <div className="rounded-xl p-4 mb-2" style={{ background: hexToRgba(C.primary, 0.04), border: `1px solid ${hexToRgba(C.primary, 0.12)}` }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {keyIndicators.map((ki) => {
            const val = ki.getValue(ta);
            const signalColor = ki.signal === 'bullish' ? C.bullColor : ki.signal === 'bearish' ? C.bearColor : C.neutralColor;
            return (
              <div key={ki.id} className="rounded-xl p-3 flex flex-col items-center gap-2" style={{ background: hexToRgba(signalColor, 0.06), border: `1px solid ${hexToRgba(signalColor, 0.15)}` }}>
                <span className="text-[11px] font-medium" style={{ color: C.cardSubFg }}>{ki.label}</span>
                <span className="text-lg font-bold tabular-nums" style={{ color: signalColor }} dir="ltr">{fmtKeyVal(val)}</span>
                <SignalDot signal={ki.signal} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ 3. تحلیل روند اندیکاتورها ═══ */}
      <SectionHeader title="تحلیل روند اندیکاتورها" />
      <div className="rounded-xl p-4 mb-2" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
          {trendInfos.map((ti, i) => {
            const dirColor = ti.direction === 'rising' ? C.bullColor : ti.direction === 'falling' ? C.bearColor : C.cardSubFg;
            const dirLabel = ti.direction === 'rising' ? 'در حال افزایش' : ti.direction === 'falling' ? 'در حال کاهش' : 'پایدار';
            return (
              <div key={i} className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: hexToRgba(dirColor, 0.06), border: `1px solid ${hexToRgba(dirColor, 0.12)}` }}>
                <TrendArrow direction={ti.direction} color={dirColor} />
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-medium truncate" style={{ color: C.cardFg }}>{ti.label}</span>
                  <span className="text-[9px]" style={{ color: dirColor }}>{dirLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-lg px-3 py-2 flex items-center justify-center gap-4 text-[11px]" style={{ background: hexToRgba(C.cardBorder, 0.3) }}>
          <span style={{ color: C.bullColor }}>{toPersianDigits(risingCount.toString())} از {toPersianDigits(totalIndicators.toString())} اندیکاتور صعودی</span>
          <span style={{ color: C.cardBorder }}>|</span>
          <span style={{ color: C.bearColor }}>{toPersianDigits(fallingCount.toString())} نزولی</span>
        </div>
      </div>

      {/* ═══ 4. میانگین‌های متحرک ═══ */}
      <SectionHeader title="میانگین‌های متحرک" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <IndicatorCard label="SMA ۵" value={fmtPrice(ta.sma.sma5 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۱۰" value={fmtPrice(ta.sma.sma10 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۲۱" value={fmtPrice(ta.sma.sma21 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۵۰" value={fmtPrice(ta.sma.sma50 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۱۰۰" value={fmtPrice(ta.sma.sma100 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۲۰۰" value={fmtPrice(ta.sma.sma200 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۹" value={fmtPrice(ta.ema.ema9 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۲۱" value={fmtPrice(ta.ema.ema21 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۵۰" value={fmtPrice(ta.ema.ema50 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۱۰۰" value={fmtPrice(ta.ema.ema100 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۲۰۰" value={fmtPrice(ta.ema.ema200 ?? 0)} signal={maSignal} />
      </div>

      {/* ═══ 5. جزئیات تکمیلی ═══ */}
      <SectionHeader title="جزئیات تکمیلی" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <IndicatorCard label="MACD Line" value={toFa(ta.macd.line)} signal={macdSignal(ta.macd)} />
        <IndicatorCard label="MACD Signal" value={toFa(ta.macd.signal)} signal={macdSignal(ta.macd)} />
        <IndicatorCard label="Stochastic %D" value={toFa(ta.stochD)} signal={stochSignal(ta.stochD)} />
        <IndicatorCard label="DI+" value={toFa(ta.diPlus)} signal={adxSignal(ta.adx, ta.diPlus, ta.diMinus)} />
        <IndicatorCard label="DI-" value={toFa(ta.diMinus)} signal={adxSignal(ta.adx, ta.diPlus, ta.diMinus)} />
        <IndicatorCard label="Parabolic SAR" value={fmtPrice(ta.sar)} signal={maSignal} />
      </div>

      {/* ═══ 6. نوسان‌پذیری ═══ */}
      <SectionHeader title="نوسان‌پذیری" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <IndicatorCard label="ATR" value={toFa(ta.atr)} signal="neutral" />
        <IndicatorCard label="باندهای بولینگر (بالا)" value={fmtPrice(ta.bollingerBands.upper)} signal="neutral" />
        <IndicatorCard label="باندهای بولینگر (میانی)" value={fmtPrice(ta.bollingerBands.middle)} signal="neutral" />
        <IndicatorCard label="باندهای بولینگر (پایین)" value={fmtPrice(ta.bollingerBands.lower)} signal="neutral" />
      </div>

      {/* ═══ 7. حجم ═══ */}
      {ta.hasVolume !== false && (
        <>
          <SectionHeader title="حجم" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <IndicatorCard label="OBV" value={toFa(ta.obv)} signal="neutral" />
            <IndicatorCard label="VWAP" value={fmtPrice(ta.vwap ?? 0)} signal="neutral" />
          </div>
        </>
      )}

      {/* ═══ 8. ابر ایچیموکو ═══ */}
      <SectionHeader title="ابر ایچیموکو" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <IndicatorCard label="تنکان‌سن (۹)" value={fmtPrice(ta.ichimoku?.tenkan ?? 0)} signal={maSignal} />
        <IndicatorCard label="کیجون‌سن (۲۶)" value={fmtPrice(ta.ichimoku?.kijun ?? 0)} signal={maSignal} />
        <IndicatorCard label="سنکو اسپن A" value={fmtPrice(ta.ichimoku?.senkouA ?? 0)} signal={maSignal} />
        <IndicatorCard label="سنکو اسپن B" value={fmtPrice(ta.ichimoku?.senkouB ?? 0)} signal={maSignal} />
        <IndicatorCard label="چیکو اسپن" value={fmtPrice(ta.ichimoku?.chikou ?? 0)} signal={maSignal} />
      </div>

      {/* ═══ 9. حمایت و مقاومت هوشمند ═══ */}
      <SectionHeader title="حمایت و مقاومت هوشمند" />
      <div className="space-y-3">
        {/* Resistances */}
        <div>
          <span className="text-[11px] mb-1.5 font-medium block" style={{ color: C.bearColor }}>مقاومت‌ها</span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {(ta.resistanceStrengths ?? []).slice(0, 6).map((r, i) => {
              const gs = gradeStyle(r.grade, C.cardSubFg);
              const faMethods = String(r.methods?.length ?? 0).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
              return (
                <div key={i} className="rounded-xl p-3" style={{ background: hexToRgba(C.bearColor, 0.06), border: `1px solid ${hexToRgba(C.bearColor, 0.15)}` }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-medium" style={{ color: C.bearColor }}>{r.isTarget ? '★ ' : ''}R{toFa(i + 1)}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={gs}>{r.grade}</span>
                  </div>
                  <p className="text-sm font-medium tabular-nums text-center" style={{ color: C.cardFg }} dir="ltr">{fmtPrice(r.price)}</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {r.fibLabel && <span className="text-[10px]" style={{ color: hexToRgba(C.bearColor, 0.5) }}>فیبو {r.fibLabel}</span>}
                    <span className="text-[10px]" style={{ color: hexToRgba(C.bearColor, 0.5) }}>({faMethods} روش)</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <div className="h-1.5 w-12 rounded-full overflow-hidden" style={{ background: hexToRgba(C.bearColor, 0.15) }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(r.strength / 10) * 100}%`, background: hexToRgba(C.bearColor, 0.6) }} />
                    </div>
                    <span className="text-[10px] tabular-nums" style={{ color: C.bearColor }}>{toPersianDigits(String(r.strength))}/۱۰</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Supports */}
        <div>
          <span className="text-[11px] mb-1.5 font-medium block" style={{ color: C.bullColor }}>حمایت‌ها</span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {(ta.supportStrengths ?? []).slice(0, 6).map((s, i) => {
              const gs = gradeStyle(s.grade, C.cardSubFg);
              const faMethods = String(s.methods?.length ?? 0).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
              return (
                <div key={i} className="rounded-xl p-3" style={{ background: hexToRgba(C.bullColor, 0.06), border: `1px solid ${hexToRgba(C.bullColor, 0.15)}` }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-medium" style={{ color: C.bullColor }}>{s.isTarget ? '★ ' : ''}S{toFa(i + 1)}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={gs}>{s.grade}</span>
                  </div>
                  <p className="text-sm font-medium tabular-nums text-center" style={{ color: C.cardFg }} dir="ltr">{fmtPrice(s.price)}</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {s.fibLabel && <span className="text-[10px]" style={{ color: hexToRgba(C.bullColor, 0.5) }}>فیبو {s.fibLabel}</span>}
                    <span className="text-[10px]" style={{ color: hexToRgba(C.bullColor, 0.5) }}>({faMethods} روش)</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <div className="h-1.5 w-12 rounded-full overflow-hidden" style={{ background: hexToRgba(C.bullColor, 0.15) }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(s.strength / 10) * 100}%`, background: hexToRgba(C.bullColor, 0.6) }} />
                    </div>
                    <span className="text-[10px] tabular-nums" style={{ color: C.bullColor }}>{toPersianDigits(String(s.strength))}/۱۰</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ 10. خطوط روند ═══ */}
      <SectionHeader title="خطوط روند" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {(['short', 'medium', 'long'] as const).map((period) => {
          const t = ta.trend[period];
          const labels: Record<string, string> = { short: 'کوتاه‌مدت', medium: 'میان‌مدت', long: 'بلندمدت' };
          const arrow = t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→';
          const arrowColor = t.direction === 'up' ? C.bullColor : t.direction === 'down' ? C.bearColor : C.cardSubFg;
          return (
            <div key={period} className="rounded-xl p-3 flex items-center justify-between gap-2" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px]" style={{ color: C.cardSubFg }}>{labels[period]}</span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg font-bold" style={{ color: arrowColor }}>{arrow}</span>
                  <span className="tabular-nums" style={{ color: C.cardFg }} dir="ltr">{toFa(t.angle)}°</span>
                </div>
                <span className="text-[11px] tabular-nums" style={{ color: C.cardSubFg }} dir="ltr">R²: {toPersianDigits((t.r2 * 100).toFixed(1))}٪</span>
              </div>
              <SignalDot signal={trendDirSignal(t.direction)} />
            </div>
          );
        })}
      </div>

      {/* ═══ 11. امتیاز کلی ═══ */}
      <SectionHeader title="امتیاز کلی" />
      <div className="rounded-xl p-4 space-y-3" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
        <div className="relative h-6 w-full rounded-full overflow-hidden" style={{ background: C.cardBorder }}>
          <div className="absolute top-0 right-0 h-full rounded-r-full transition-all duration-500" style={{ width: `${bullPct}%`, background: hexToRgba(C.bullColor, 0.5) }} />
          <div className="absolute top-0 left-0 h-full rounded-l-full transition-all duration-500" style={{ width: `${bearPct}%`, background: hexToRgba(C.bearColor, 0.5) }} />
          <div className="absolute inset-0 flex items-center justify-between px-3 text-[11px] font-medium">
            <span style={{ color: C.bullColor }}>خرید {toFa(bullPct)}٪</span>
            <span style={{ color: C.bearColor }}>فروش {toFa(bearPct)}٪</span>
          </div>
        </div>
      </div>

    </div>
  );
}
