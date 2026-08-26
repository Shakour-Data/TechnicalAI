'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toPersianDigits } from '@/lib/jalali';
import { useTheme } from '@/lib/theme-store';

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

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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

function IndicatorCard({
  label,
  value,
  signal,
}: {
  label: string;
  value: string;
  signal: 'bullish' | 'bearish' | 'neutral';
}) {
  const { colors: C } = useTheme();
  return (
    <div
      className="rounded-xl p-3 flex items-center justify-between gap-2"
      style={{
        background: C.cardBg,
        border: `1px solid ${C.cardBorder}`,
      }}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] truncate" style={{ color: C.cardSubFg }}>{label}</span>
        <span className="text-sm font-medium tabular-nums" style={{ color: C.cardFg }} dir="ltr">
          {value}
        </span>
      </div>
      <SignalDot signal={signal} />
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="col-span-full text-xs font-semibold text-amber-400/80 mt-5 mb-1.5 first:mt-0">
      {title}
    </h3>
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

export default function IndicatorsPanel({ ta }: IndicatorsPanelProps) {
  const { colors: C } = useTheme();

  if (!ta) return <LoadingSkeleton />;

  // Moving averages signal: price relationship not available here, default neutral
  const maSignal = 'neutral' as const;

  return (
    <div
      className="rounded-2xl p-4 space-y-1"
      dir="rtl"
      style={{
        background: C.cardBg,
        border: `1px solid ${C.cardBorder}`,
      }}
    >
      {/* ── میانگین‌های متحرک (Moving Averages) ─────────────────────── */}
      <SectionHeader title="میانگین‌های متحرک" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <IndicatorCard label="SMA ۵" value={toFa(ta.sma.sma5 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۱۰" value={toFa(ta.sma.sma10 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۲۱" value={toFa(ta.sma.sma21 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۵۰" value={toFa(ta.sma.sma50 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۱۰۰" value={toFa(ta.sma.sma100 ?? 0)} signal={maSignal} />
        <IndicatorCard label="SMA ۲۰۰" value={toFa(ta.sma.sma200 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۹" value={toFa(ta.ema.ema9 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۲۱" value={toFa(ta.ema.ema21 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۵۰" value={toFa(ta.ema.ema50 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۱۰۰" value={toFa(ta.ema.ema100 ?? 0)} signal={maSignal} />
        <IndicatorCard label="EMA ۲۰۰" value={toFa(ta.ema.ema200 ?? 0)} signal={maSignal} />
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
        {ta.hasVolume !== false && <IndicatorCard label="VWAP" value={toFa(ta.vwap ?? 0)} signal="neutral" />}
      </div>

      {/* ── ابر ایچیموکو (Ichimoku Cloud) ─────────────────────────────── */}
      <SectionHeader title="ابر ایچیموکو" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <IndicatorCard label="تنکان‌سن (۹)" value={toFa(ta.ichimoku?.tenkan ?? 0)} signal={maSignal} />
        <IndicatorCard label="کیجون‌سن (۲۶)" value={toFa(ta.ichimoku?.kijun ?? 0)} signal={maSignal} />
        <IndicatorCard label="سنکو اسپن A" value={toFa(ta.ichimoku?.senkouA ?? 0)} signal={maSignal} />
        <IndicatorCard label="سنکو اسپن B" value={toFa(ta.ichimoku?.senkouB ?? 0)} signal={maSignal} />
        <IndicatorCard label="چیکو اسپن" value={toFa(ta.ichimoku?.chikou ?? 0)} signal={maSignal} />
      </div>

      {/* ── حمایت و مقاومت هوشمند (Smart S/R) ──────────────────── */}
      <SectionHeader title="حمایت و مقاومت هوشمند" />
      <div className="space-y-3">
        {/* Resistances */}
        <div>
          <p className="text-[11px] mb-1.5 font-medium" style={{ color: C.bearColor }}>مقاومت‌ها</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {(ta.resistanceStrengths ?? []).slice(0, 6).map((r, i) => {
              const gs = gradeStyle(r.grade, C.cardSubFg);
              const faMethods = String(r.methods?.length ?? 0).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
              return (
                <div
                  key={i}
                  className="rounded-xl p-3"
                  style={{
                    background: hexToRgba(C.bearColor, 0.06),
                    border: `1px solid ${hexToRgba(C.bearColor, 0.15)}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-medium" style={{ color: C.bearColor }}>
                      {r.isTarget ? '★ ' : ''}R{toFa(i + 1)}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={gs}>{r.grade}</span>
                  </div>
                  <p className="text-sm font-medium tabular-nums text-center" style={{ color: C.cardFg }} dir="ltr">{toFa(r.price)}</p>
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
          <p className="text-[11px] mb-1.5 font-medium" style={{ color: C.bullColor }}>حمایت‌ها</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {(ta.supportStrengths ?? []).slice(0, 6).map((s, i) => {
              const gs = gradeStyle(s.grade, C.cardSubFg);
              const faMethods = String(s.methods?.length ?? 0).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
              return (
                <div
                  key={i}
                  className="rounded-xl p-3"
                  style={{
                    background: hexToRgba(C.bullColor, 0.06),
                    border: `1px solid ${hexToRgba(C.bullColor, 0.15)}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-medium" style={{ color: C.bullColor }}>
                      {s.isTarget ? '★ ' : ''}S{toFa(i + 1)}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={gs}>{s.grade}</span>
                  </div>
                  <p className="text-sm font-medium tabular-nums text-center" style={{ color: C.cardFg }} dir="ltr">{toFa(s.price)}</p>
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

      {/* ── خطوط روند (Trend Lines) ───────────────────────────────────── */}
      <SectionHeader title="خطوط روند" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {(['short', 'medium', 'long'] as const).map((period) => {
          const t = ta.trend[period];
          const labels: Record<string, string> = { short: 'کوتاه‌مدت', medium: 'میان‌مدت', long: 'بلندمدت' };
          const arrow = t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→';
          const arrowColor = t.direction === 'up' ? C.bullColor : t.direction === 'down' ? C.bearColor : C.cardSubFg;
          return (
            <div
              key={period}
              className="rounded-xl p-3 flex items-center justify-between gap-2"
              style={{
                background: C.cardBg,
                border: `1px solid ${C.cardBorder}`,
              }}
            >
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

      {/* ── امتیاز کلی (Overall Score) ────────────────────────────────── */}
      <SectionHeader title="امتیاز کلی" />
      <div
        className="rounded-xl p-4 space-y-3"
        style={{
          background: C.cardBg,
          border: `1px solid ${C.cardBorder}`,
        }}
      >
        {/* Progress bar */}
        <div className="relative h-6 w-full rounded-full overflow-hidden" style={{ background: C.cardBorder }}>
          <div
            className="absolute top-0 right-0 h-full rounded-r-full transition-all duration-500"
            style={{ width: `${ta.bullScore}%`, background: hexToRgba(C.bullColor, 0.5) }}
          />
          <div
            className="absolute top-0 left-0 h-full rounded-l-full transition-all duration-500"
            style={{ width: `${ta.bearScore}%`, background: hexToRgba(C.bearColor, 0.5) }}
          />
          {/* Labels inside bar */}
          <div className="absolute inset-0 flex items-center justify-between px-3 text-[11px] font-medium">
            <span style={{ color: C.bullColor }}>خرید {toFa(ta.bullScore)}٪</span>
            <span style={{ color: C.bearColor }}>فروش {toFa(ta.bearScore)}٪</span>
          </div>
        </div>

        {/* Signal badge */}
        <div className="flex items-center justify-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold"
            style={
              ta.overallSignal === 'bullish'
                ? { background: hexToRgba(C.bullColor, 0.1), border: `1px solid ${hexToRgba(C.bullColor, 0.25)}`, color: C.bullColor }
                : ta.overallSignal === 'bearish'
                ? { background: hexToRgba(C.bearColor, 0.1), border: `1px solid ${hexToRgba(C.bearColor, 0.25)}`, color: C.bearColor }
                : { background: hexToRgba(C.neutralColor, 0.1), border: `1px solid ${hexToRgba(C.neutralColor, 0.25)}`, color: C.neutralColor }
            }
          >
            <SignalDot signal={ta.overallSignal} />
            {ta.overallSignal === 'bullish' ? 'صعودی' : ta.overallSignal === 'bearish' ? 'نزولی' : 'خنثی'}
          </span>
        </div>
      </div>
    </div>
  );
}
