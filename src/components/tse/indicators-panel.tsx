'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toPersianDigits } from '@/lib/jalali';

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
    hasVolume?: boolean;
    resistances: number[];
    supports: number[];
    supportStrengths: { price: number; strength: number; isTarget: boolean; fibRatio: string; fibLabel: string; score: number; grade: string; overlapCount: number; methods: string[] }[];
    resistanceStrengths: { price: number; strength: number; isTarget: boolean; fibRatio: string; fibLabel: string; score: number; grade: string; overlapCount: number; methods: string[] }[];
    trend: {
      short: { direction: string; slope: number; angle: number; r2: number };
      medium: { direction: string; slope: number; angle: number; r2: number };
      long: { direction: string; slope: number; angle: number; r2: number };
    };
    bullScore: number;
    bearScore: number;
    overallSignal: 'bullish' | 'bearish' | 'neutral';
  } | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const toFa = (n: number) => Math.round(n).toLocaleString('fa-IR');

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

function gradeColor(grade: string) {
  switch (grade) {
    case 'Very Strong': return { bg: 'bg-red-50', text: 'text-red-700' };
    case 'Strong': return { bg: 'bg-amber-50', text: 'text-amber-700' };
    case 'Moderate': return { bg: 'bg-sky-50', text: 'text-sky-700' };
    default: return { bg: 'bg-gray-50', text: 'text-gray-500' };
  }
}

function signalDot(signal: 'bullish' | 'bearish' | 'neutral') {
  const colors = {
    bullish: 'bg-emerald-600',
    bearish: 'bg-red-600',
    neutral: 'bg-[#B0A89E]',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[signal]}`} />;
}

// ─── Indicator Card ────────────────────────────────────────────────────────────

function IndicatorCard({
  label,
  value,
  signal,
}: {
  label: string;
  value: string;
  signal: 'bullish' | 'bearish' | 'neutral';
}) {
  return (
    <div className="bg-[#ffffff] border border-[#e5e7eb] rounded-xl p-3 flex items-center justify-between gap-2">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] text-[#6b7280] truncate">{label}</span>
        <span className="text-sm font-medium text-[#111827] tabular-nums" dir="ltr">
          {value}
        </span>
      </div>
      {signalDot(signal)}
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="col-span-full text-xs font-semibold text-amber-800 uppercase tracking-wider mt-4 mb-1 first:mt-0">
      {title}
    </h3>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="bg-[#ffffff] rounded-2xl p-4 space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28 bg-[#e5e7eb]" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-16 w-full bg-[#e5e7eb] rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function IndicatorsPanel({ ta }: IndicatorsPanelProps) {
  if (!ta) return <LoadingSkeleton />;

  // Moving averages signal: price relationship not available here, default neutral
  const maSignal = 'neutral' as const;

  return (
    <div className="bg-[#ffffff] rounded-2xl p-4 space-y-1" dir="rtl">
      {/* ── میانگین‌های متحرک (Moving Averages) ─────────────────────── */}
      <SectionHeader title="میانگین‌های متحرک" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <IndicatorCard label="SMA ۵" value={toFa(ta.sma.sma5 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۱۰" value={toFa(ta.sma.sma10 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۲۱" value={toFa(ta.sma.sma21 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۵۰" value={toFa(ta.sma.sma50 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۱۰۰" value={toFa(ta.sma.sma100 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۲۰۰" value={toFa(ta.sma.sma200 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۱۲" value={toFa(ta.ema.ema12 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۲۶" value={toFa(ta.ema.ema26 ?? 0)} signal={maSignal} />
      </div>

      {/* ── اوسسیلاتورها (Oscillators) ───────────────────────────────── */}
      <SectionHeader title="اوسسیلاتورها" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <IndicatorCard label="RSI" value={toFa(ta.rsi)} signal={rsiSignal(ta.rsi)} />
        {ta.hasVolume !== false && <IndicatorCard label="MFI" value={toFa(ta.mfi)} signal={mfiSignal(ta.mfi)} />}
        <IndicatorCard label="CCI" value={toFa(ta.cci)} signal={ta.cci > 100 ? 'bearish' : ta.cci < -100 ? 'bullish' : 'neutral'} />
        <IndicatorCard label="Stochastic %K" value={toFa(ta.stochK)} signal={stochSignal(ta.stochK)} />
        <IndicatorCard label="Stochastic %D" value={toFa(ta.stochD)} signal={stochSignal(ta.stochD)} />
        <IndicatorCard label="Williams %R" value={toFa(ta.williamsR)} signal={ta.williamsR > -20 ? 'bearish' : ta.williamsR < -80 ? 'bullish' : 'neutral'} />
      </div>

      {/* ── مومنتوم (Momentum) ────────────────────────────────────────── */}
      <SectionHeader title="مومنتوم" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <IndicatorCard label="MACD Line" value={toFa(ta.macd.line)} signal={macdSignal(ta.macd)} />
        <IndicatorCard label="MACD Signal" value={toFa(ta.macd.signal)} signal={macdSignal(ta.macd)} />
        <IndicatorCard label="MACD Histogram" value={toFa(ta.macd.histogram)} signal={ta.macd.histogram > 0 ? 'bullish' : ta.macd.histogram < 0 ? 'bearish' : 'neutral'} />
      </div>

      {/* ── روند (Trend) ──────────────────────────────────────────────── */}
      <SectionHeader title="روند" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <IndicatorCard label="ADX" value={toFa(ta.adx)} signal={ta.adx > 25 ? 'bullish' : 'neutral'} />
        <IndicatorCard label="DI+" value={toFa(ta.diPlus)} signal={adxSignal(ta.adx, ta.diPlus, ta.diMinus)} />
        <IndicatorCard label="DI-" value={toFa(ta.diMinus)} signal={adxSignal(ta.adx, ta.diPlus, ta.diMinus)} />
        <IndicatorCard label="SAR" value={toFa(ta.sar)} signal={maSignal} />
      </div>

      {/* ── نوسان‌پذیری (Volatility) ──────────────────────────────── */}
      <SectionHeader title="نوسان‌پذیری" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <IndicatorCard label="ATR" value={toFa(ta.atr)} signal="neutral" />
        <IndicatorCard label="باندهای بولینگر (بالا)" value={toFa(ta.bollingerBands.upper)} signal="neutral" />
        <IndicatorCard label="باندهای بولینگر (میانی)" value={toFa(ta.bollingerBands.middle)} signal="neutral" />
        <IndicatorCard label="باندهای بولینگر (پایین)" value={toFa(ta.bollingerBands.lower)} signal="neutral" />
      </div>

      {/* ── حجم (Volume) ──────────────────────────────────────────────── */}
      <SectionHeader title="حجم" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {ta.hasVolume !== false && <IndicatorCard label="OBV" value={toFa(ta.obv)} signal="neutral" />}
      </div>

      {/* ── حمایت و مقاومت هوشمند (Smart S/R) ──────────────────── */}
      <SectionHeader title="حمایت و مقاومت هوشمند" />
      <div className="space-y-3">
        {/* Resistances */}
        <div>
          <p className="text-[11px] text-red-700 mb-1.5 font-medium">مقاومت‌ها</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {(ta.resistanceStrengths ?? []).slice(0, 6).map((r, i) => {
              const gc = gradeColor(r.grade);
              const faMethods = String(r.methods?.length ?? 0).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
              return (
                <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-red-600 font-medium">
                      {r.isTarget ? '★ ' : ''}R{toFa(i + 1)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${gc.bg} ${gc.text}`}>{r.grade}</span>
                  </div>
                  <p className="text-sm font-medium text-red-700 tabular-nums text-center" dir="ltr">{toFa(r.price)}</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {r.fibLabel && <span className="text-[10px] text-red-400">فیبو {r.fibLabel}</span>}
                    <span className="text-[10px] text-red-400">({faMethods} روش)</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <div className="h-1.5 w-12 rounded-full bg-red-100 overflow-hidden">
                      <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${(r.strength / 10) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-red-500 tabular-nums">{toPersianDigits(String(r.strength))}/۱۰</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Supports */}
        <div>
          <p className="text-[11px] text-emerald-700 mb-1.5 font-medium">حمایت‌ها</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {(ta.supportStrengths ?? []).slice(0, 6).map((s, i) => {
              const gc = gradeColor(s.grade);
              const faMethods = String(s.methods?.length ?? 0).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
              return (
                <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-emerald-600 font-medium">
                      {s.isTarget ? '★ ' : ''}S{toFa(i + 1)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${gc.bg} ${gc.text}`}>{s.grade}</span>
                  </div>
                  <p className="text-sm font-medium text-emerald-700 tabular-nums text-center" dir="ltr">{toFa(s.price)}</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {s.fibLabel && <span className="text-[10px] text-emerald-400">فیبو {s.fibLabel}</span>}
                    <span className="text-[10px] text-emerald-400">({faMethods} روش)</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <div className="h-1.5 w-12 rounded-full bg-emerald-100 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(s.strength / 10) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-emerald-500 tabular-nums">{toPersianDigits(String(s.strength))}/۱۰</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── خطوط روند (Trend Lines) ───────────────────────────────────── */}
      <SectionHeader title="خطوط روند" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {(['short', 'medium', 'long'] as const).map((period) => {
          const t = ta.trend[period];
          const labels: Record<string, string> = { short: 'کوتاه‌مدت', medium: 'میان‌مدت', long: 'بلندمدت' };
          const arrow = t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→';
          const arrowColor = t.direction === 'up' ? 'text-emerald-700' : t.direction === 'down' ? 'text-red-700' : 'text-[#6b7280]';
          return (
            <div key={period} className="bg-[#ffffff] border border-[#e5e7eb] rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] text-[#6b7280]">{labels[period]}</span>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`text-lg font-bold ${arrowColor}`}>{arrow}</span>
                  <span className="text-[#374151] tabular-nums" dir="ltr">{toFa(t.angle)}°</span>
                </div>
                <span className="text-[11px] text-[#6b7280] tabular-nums" dir="ltr">R²: {toPersianDigits((t.r2 * 100).toFixed(1))}٪</span>
              </div>
              {signalDot(trendDirSignal(t.direction))}
            </div>
          );
        })}
      </div>

      {/* ── امتیاز کلی (Overall Score) ────────────────────────────────── */}
      <SectionHeader title="امتیاز کلی" />
      <div className="bg-[#ffffff] border border-[#e5e7eb] rounded-xl p-4 space-y-3">
        {/* Progress bar */}
        <div className="relative h-6 w-full rounded-full overflow-hidden bg-[#e5e7eb]">
          <div
            className="absolute top-0 right-0 h-full rounded-r-full bg-emerald-600 transition-all duration-500"
            style={{ width: `${ta.bullScore}%` }}
          />
          <div
            className="absolute top-0 left-0 h-full rounded-l-full bg-red-600 transition-all duration-500"
            style={{ width: `${ta.bearScore}%` }}
          />
          {/* Labels inside bar */}
          <div className="absolute inset-0 flex items-center justify-between px-3 text-[11px] font-medium">
            <span className="text-emerald-700">خرید {toFa(ta.bullScore)}٪</span>
            <span className="text-red-700">فروش {toFa(ta.bearScore)}٪</span>
          </div>
        </div>

        {/* Signal badge */}
        <div className="flex items-center justify-center">
          <span
            className={
              ta.overallSignal === 'bullish'
                ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-sm font-semibold text-emerald-700'
                : ta.overallSignal === 'bearish'
                ? 'inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-4 py-1.5 text-sm font-semibold text-red-700'
                : 'inline-flex items-center gap-1.5 rounded-full bg-[#e5e7eb]/50 border border-[#e5e7eb] px-4 py-1.5 text-sm font-semibold text-[#6b7280]'
            }
          >
            {signalDot(ta.overallSignal)}
            {ta.overallSignal === 'bullish' ? 'صعودی' : ta.overallSignal === 'bearish' ? 'نزولی' : 'خنثی'}
          </span>
        </div>
      </div>
    </div>
  );
}
