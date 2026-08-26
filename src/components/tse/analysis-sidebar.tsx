'use client';

import React, { useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, ChevronRight, ChevronLeft, ArrowUpRight, ArrowDownRight, Minus, Target } from 'lucide-react';
import { toPersianDigits } from '@/lib/jalali';
import { useTheme } from '@/lib/theme-store';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisSidebarProps {
  data: {
    symbol: string;
    info: {
      name: string;
      lastPrice: number;
      change: number;
      closePrice: number;
      openPrice: number;
      minPrice: number;
      maxPrice: number;
      volume: number;
      value: number;
      trades: number;
      eps: number;
      pe: number;
    } | null;
    ta: import('@/lib/ta-engine').TAResult;
    isTgju?: boolean;
    isYahoo?: boolean;
    candles: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
  } | null;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const toFa = (n: number) => Math.round(n).toLocaleString('fa-IR');
const toFa1 = (n: number) => n.toFixed(1).replace(/\./g, '/').replace(/-/g, '−');
const toFa2 = (n: number) => n.toFixed(2).replace(/\./g, '/').replace(/-/g, '−');

function rsiSignal(v: number): 'bullish' | 'bearish' | 'neutral' {
  if (v > 70) return 'bearish';
  if (v < 30) return 'bullish';
  return 'neutral';
}

function macdSignal(h: number): 'bullish' | 'bearish' | 'neutral' {
  if (h > 0) return 'bullish';
  if (h < 0) return 'bearish';
  return 'neutral';
}

function adxSignal(v: number): 'strong' | 'neutral' {
  if (v > 25) return 'strong';
  return 'neutral';
}

function stochSignal(v: number): 'bullish' | 'bearish' | 'neutral' {
  if (v > 80) return 'bearish';
  if (v < 20) return 'bullish';
  return 'neutral';
}

function signalDotBg(signal: 'bullish' | 'bearish' | 'neutral' | 'strong', bullColor: string, bearColor: string, neutralColor: string, cardSubFg: string): string {
  switch (signal) {
    case 'bullish': return bullColor;
    case 'bearish': return bearColor;
    case 'strong': return neutralColor;
    default: return cardSubFg;
  }
}

function gradeLabel(grade: string): string {
  switch (grade) {
    case 'Very Strong': return 'بسیار قوی';
    case 'Strong': return 'قوی';
    case 'Moderate': return 'متوسط';
    default: return 'ضعیف';
  }
}

function gradeStyle(grade: string, bearColor: string, neutralColor: string, primary: string, cardBg: string, cardSubFg: string): React.CSSProperties {
  switch (grade) {
    case 'Very Strong': return { background: hexToRgba(bearColor, 0.15), color: bearColor };
    case 'Strong': return { background: hexToRgba(neutralColor, 0.15), color: neutralColor };
    case 'Moderate': return { background: hexToRgba(primary, 0.15), color: primary };
    default: return { background: hexToRgba(cardSubFg, 0.1), color: cardSubFg };
  }
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return toFa(n);
}

function pctDistance(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

function trendDirectionLabel(dir: string, bullColor: string, bearColor: string, neutralColor: string): { label: string; color: string } {
  const d = dir?.toLowerCase() ?? '';
  if (d.includes('up') || d === 'صعودی') return { label: 'صعودی', color: bullColor };
  if (d.includes('down') || d === 'نزولی') return { label: 'نزولی', color: bearColor };
  return { label: 'خنثی', color: neutralColor };
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  const { colors: C } = useTheme();
  return (
    <div className="text-[10px] font-bold px-1 mb-2" style={{ color: C.cardSubFg }}>
      {children}
    </div>
  );
}

function GlassCard({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const { colors: C } = useTheme();
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, backdropFilter: 'blur(12px)', ...style }}
    >
      {children}
    </div>
  );
}

function ProgressBar({ value, max, color, height = 4 }: { value: number; max: number; color: string; height?: number }) {
  const { colors: C } = useTheme();
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: C.cardBorder }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AnalysisSidebar({ data, collapsed, setCollapsed }: AnalysisSidebarProps) {
  const { colors: TC } = useTheme();

  // Local color aliases matching original C.* property names
  const C = {
    text: TC.cardFg,
    textSec: TC.cardSubFg,
    textDim: TC.cardSubFg,
    bull: TC.bullColor,
    bear: TC.bearColor,
    neutral: TC.neutralColor,
    cardBg: TC.cardBg,
    cardBorder: TC.cardBorder,
    border: TC.border,
    primary: TC.primary,
  };

  const ta = data?.ta;
  const info = data?.info;
  const lastPrice = info?.lastPrice ?? 0;
  const change = info?.change ?? 0;
  const changeColor = change > 0 ? C.bull : change < 0 ? C.bear : C.neutral;
  const changeArrow = change > 0 ? '▲' : change < 0 ? '▼' : '—';

  // Signal
  const signalLabel = !ta ? '' : ta.overallSignal === 'bullish' ? 'صعودی' : ta.overallSignal === 'bearish' ? 'نزولی' : 'خنثی';
  const signalColor = !ta ? C.neutral : ta.overallSignal === 'bullish' ? C.bull : ta.overallSignal === 'bearish' ? C.bear : C.neutral;
  const signalBg = !ta ? hexToRgba(C.neutral, 0.1) : ta.overallSignal === 'bullish' ? hexToRgba(C.bull, 0.1) : ta.overallSignal === 'bearish' ? hexToRgba(C.bear, 0.1) : hexToRgba(C.neutral, 0.1);
  const signalBorderColor = !ta ? hexToRgba(C.neutral, 0.25) : ta.overallSignal === 'bullish' ? hexToRgba(C.bull, 0.25) : ta.overallSignal === 'bearish' ? hexToRgba(C.bear, 0.25) : hexToRgba(C.neutral, 0.25);
  const SignalIcon = !ta ? Activity : ta.overallSignal === 'bullish' ? TrendingUp : ta.overallSignal === 'bearish' ? TrendingDown : Activity;

  // ── Top 3 scenarios (sorted by probability desc) ──
  const top3Scenarios = useMemo(() => {
    if (!ta) return [];
    const keys = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'] as const;
    return keys
      .map(k => ({ key: k, ...ta.scenarios[k] }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3);
  }, [ta]);

  // ── Bollinger Band position ──
  const bbPos = useMemo(() => {
    if (!ta) return 50;
    const { upper, lower } = ta.bollingerBands;
    if (upper === lower) return 50;
    return Math.round(((lastPrice - lower) / (upper - lower)) * 100);
  }, [ta, lastPrice]);

  // ── Closest S/R levels ──
  const closestResistance = useMemo(() => {
    if (!ta) return null;
    const levels = ta.resistanceStrengths ?? [];
    if (!levels.length) return null;
    return levels.reduce((closest, r) =>
      Math.abs(r.price - lastPrice) < Math.abs(closest.price - lastPrice) ? r : closest
    );
  }, [ta, lastPrice]);

  const closestSupport = useMemo(() => {
    if (!ta) return null;
    const levels = ta.supportStrengths ?? [];
    if (!levels.length) return null;
    return levels.reduce((closest, s) =>
      Math.abs(s.price - lastPrice) < Math.abs(closest.price - lastPrice) ? s : closest
    );
  }, [ta, lastPrice]);

  if (!data || !ta) return null;

  return (
    <aside className={`shrink-0 transition-all duration-300 ${collapsed ? 'w-0 overflow-hidden opacity-0' : 'w-[280px]'} hidden lg:block`}>
      <div
        className="sticky top-[76px] space-y-3 max-h-[calc(100vh-92px)] overflow-y-auto pb-4 pl-1"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: `${C.cardBorder} transparent`,
        }}
      >

        {/* ══════════════════════════════════════════════════════════════════
            ۱. Symbol Header (sticky)
        ══════════════════════════════════════════════════════════════════ */}
        <GlassCard className="sticky top-0 z-10 p-3.5 space-y-2.5">
          {/* Name, code, signal badge */}
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold truncate" style={{ color: C.text }}>
                {info?.name || data.symbol}
              </div>
              <div className="text-[10px] truncate" style={{ color: C.textSec }}>
                {data.symbol}
              </div>
            </div>
            <div
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold"
              style={{ background: signalBg, border: `1px solid ${signalBorderColor}`, color: signalColor }}
            >
              <SignalIcon className="w-3 h-3" />
              {signalLabel}
            </div>
          </div>

          {/* Price & change */}
          <div className="flex items-end justify-between gap-2">
            <div className="text-[22px] font-black tabular-nums leading-none" style={{ color: C.text }} dir="ltr">
              {toFa(lastPrice)}
            </div>
            <div className="text-xs font-bold" style={{ color: changeColor }}>
              {changeArrow} {Math.abs(change).toLocaleString('fa-IR', { maximumFractionDigits: 2 })}٪
            </div>
          </div>

          {/* Volume & Value */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[8px]" style={{ color: C.textDim }}>حجم</div>
              <div className="text-[10px] font-bold tabular-nums" style={{ color: C.textSec }} dir="ltr">
                {formatNumber(info?.volume ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[8px]" style={{ color: C.textDim }}>ارزش</div>
              <div className="text-[10px] font-bold tabular-nums" style={{ color: C.textSec }} dir="ltr">
                {formatNumber(info?.value ?? 0)}
              </div>
            </div>
          </div>

          {/* Mini info grid: O / H / L / YC */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1" style={{ borderTop: `1px solid ${C.cardBorder}` }}>
            {[
              { label: 'باز', value: info?.openPrice },
              { label: 'بالا', value: info?.maxPrice },
              { label: 'پایین', value: info?.minPrice },
              { label: 'دیروز', value: info?.yesterdayClose },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[9px]" style={{ color: C.textDim }}>{item.label}</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: C.textSec }} dir="ltr">
                  {toFa(item.value ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* ══════════════════════════════════════════════════════════════════
            ۲. Signal Overview Card
        ══════════════════════════════════════════════════════════════════ */}
        <GlassCard className="p-3 space-y-3">
          <SectionTitle>خلاصه سیگنال</SectionTitle>

          {/* Gauge */}
          <div className="flex items-center justify-center">
            <div className="relative w-24 h-12 overflow-hidden">
              <svg viewBox="0 0 100 50" className="w-full h-full">
                {/* Background arc */}
                <path
                  d="M 10 45 A 40 40 0 0 1 90 45"
                  fill="none"
                  stroke={C.cardBorder}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                {/* Bearish zone (left) */}
                <path
                  d="M 10 45 A 40 40 0 0 1 30 12"
                  fill="none"
                  stroke={hexToRgba(C.bear, 0.15)}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                {/* Bullish zone (right) */}
                <path
                  d="M 70 12 A 40 40 0 0 1 90 45"
                  fill="none"
                  stroke={hexToRgba(C.bull, 0.15)}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                {/* Needle */}
                {(() => {
                  const totalScore = ta.bullScore + ta.bearScore || 1;
                  const ratio = ta.bullScore / totalScore;
                  const angle = -180 + ratio * 180;
                  const rad = (angle * Math.PI) / 180;
                  const cx = 50, cy = 45;
                  const len = 30;
                  const nx = cx + Math.cos(rad) * len;
                  const ny = cy + Math.sin(rad) * len;
                  return (
                    <line
                      x1={cx} y1={cy} x2={nx} y2={ny}
                      stroke={signalColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  );
                })()}
                {/* Center dot */}
                <circle cx="50" cy="45" r="3" fill={signalColor} />
              </svg>
            </div>
          </div>

          {/* Bull / Bear progress bars */}
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium" style={{ color: C.bull }}>خرید</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: C.bull }} dir="ltr">{toPersianDigits(ta.bullScore.toFixed(2))}</span>
              </div>
              <ProgressBar value={ta.bullScore} max={100} color={C.bull} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium" style={{ color: C.bear }}>فروش</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: C.bear }} dir="ltr">{toPersianDigits(ta.bearScore.toFixed(2))}</span>
              </div>
              <ProgressBar value={ta.bearScore} max={100} color={C.bear} />
            </div>
          </div>
        </GlassCard>

        {/* ══════════════════════════════════════════════════════════════════
            ۳. Trend Analysis
        ══════════════════════════════════════════════════════════════════ */}
        <GlassCard className="p-3 space-y-2">
          <SectionTitle>تحلیل روند</SectionTitle>
          {[
            { label: 'کوتاه‌مدت', data: ta.trend.short },
            { label: 'میان‌مدت', data: ta.trend.medium },
            { label: 'بلندمدت', data: ta.trend.long },
          ].map(t => {
            const dir = trendDirectionLabel(t.data.direction, C.bull, C.bear, C.neutral);
            const DirIcon = t.data.direction?.toLowerCase()?.includes('up') ? ArrowUpRight : t.data.direction?.toLowerCase()?.includes('down') ? ArrowDownRight : Minus;
            return (
              <div key={t.label} className="flex items-center gap-2 rounded-xl px-2 py-1.5" style={{ background: C.cardBg }}>
                <DirIcon className="w-3 h-3 shrink-0" style={{ color: dir.color }} />
                <span className="text-[10px] font-medium shrink-0" style={{ color: C.textSec }}>{t.label}</span>
                <span className="text-[10px] font-bold" style={{ color: dir.color }}>{dir.label}</span>
                <span className="flex-1" />
                <div className="flex items-center gap-2 text-[9px] tabular-nums" dir="ltr">
                  <span style={{ color: C.textDim }}>زاویه</span>
                  <span className="font-bold" style={{ color: C.textSec }}>{toFa1(t.data.angle)}°</span>
                  <span style={{ color: C.textDim }}>R²</span>
                  <span className="font-bold" style={{ color: C.textSec }}>{toFa2(t.data.r2)}</span>
                </div>
              </div>
            );
          })}
        </GlassCard>

        {/* ══════════════════════════════════════════════════════════════════
            ۴. Key Indicators (enhanced - 7 items in 2-col grid)
        ══════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionTitle>اندیکاتورهای کلیدی</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'RSI', value: toFa1(ta.rsi), signal: rsiSignal(ta.rsi) },
              { label: 'MFI', value: toFa1(ta.mfi), signal: rsiSignal(ta.mfi) },
              { label: 'CCI', value: toFa(ta.cci), signal: ta.cci > 100 ? 'bearish' as const : ta.cci < -100 ? 'bullish' as const : 'neutral' as const },
              { label: 'W%R', value: toFa1(ta.williamsR), signal: stochSignal(ta.williamsR) },
              { label: 'ADX', value: toFa1(ta.adx), signal: adxSignal(ta.adx) as 'bullish' | 'bearish' | 'neutral' },
              { label: 'Stoch %K', value: toFa1(ta.stochK), signal: stochSignal(ta.stochK) },
              { label: 'MACD H', value: toFa(ta.macd.histogram), signal: macdSignal(ta.macd.histogram) },
            ].map((ind) => (
              <GlassCard key={ind.label} className="relative px-2.5 py-2">
                <span className="absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full" style={{ background: signalDotBg(ind.signal, C.bull, C.bear, C.neutral, C.textDim) }} />
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px]" style={{ color: C.textDim }}>{ind.label}</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: C.text }} dir="ltr">{ind.value}</span>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ۵. MACD & Oscillators
        ══════════════════════════════════════════════════════════════════ */}
        <GlassCard className="p-3 space-y-2.5">
          <SectionTitle>MACD و نوسان‌نماها</SectionTitle>

          {/* MACD line / signal / histogram */}
          <div>
            <div className="text-[9px] font-medium mb-1.5" style={{ color: C.textDim }}>MACD</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[8px]" style={{ color: C.textDim }}>خط</div>
                <div className="text-[10px] font-bold tabular-nums" style={{ color: ta.macd.line > ta.macd.signal ? C.bull : C.bear }} dir="ltr">{toFa(ta.macd.line)}</div>
              </div>
              <div>
                <div className="text-[8px]" style={{ color: C.textDim }}>سیگنال</div>
                <div className="text-[10px] font-bold tabular-nums" style={{ color: C.textSec }} dir="ltr">{toFa(ta.macd.signal)}</div>
              </div>
              <div>
                <div className="text-[8px]" style={{ color: C.textDim }}>هیستوگرام</div>
                <div className="text-[10px] font-bold tabular-nums" style={{ color: ta.macd.histogram > 0 ? C.bull : ta.macd.histogram < 0 ? C.bear : C.neutral }} dir="ltr">{toFa(ta.macd.histogram)}</div>
              </div>
            </div>
          </div>

          {/* Stochastic K / D */}
          <div style={{ borderTop: `1px solid ${C.cardBorder}` }} className="pt-2">
            <div className="text-[9px] font-medium mb-1.5" style={{ color: C.textDim }}>استوکاستیک</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[8px]" style={{ color: C.textDim }}>%K</div>
                <div className="text-[10px] font-bold tabular-nums" style={{ color: C.text }} dir="ltr">{toFa1(ta.stochK)}</div>
              </div>
              <div>
                <div className="text-[8px]" style={{ color: C.textDim }}>%D</div>
                <div className="text-[10px] font-bold tabular-nums" style={{ color: C.text }} dir="ltr">{toFa1(ta.stochD)}</div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ══════════════════════════════════════════════════════════════════
            ۶. Price Channels
        ══════════════════════════════════════════════════════════════════ */}
        <GlassCard className="p-3 space-y-2.5">
          <SectionTitle>کانال‌های قیمتی</SectionTitle>

          {/* Bollinger Bands */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-medium" style={{ color: C.textDim }}>باندهای بولینگر</span>
              <span className="text-[9px] font-bold" style={{ color: bbPos > 70 ? C.bear : bbPos < 30 ? C.bull : C.neutral }} dir="ltr">
                {toPersianDigits(String(bbPos))}٪
              </span>
            </div>
            <div className="space-y-0.5">
              {[
                { label: 'بالا', value: ta.bollingerBands.upper, color: C.bear },
                { label: 'میانی', value: ta.bollingerBands.middle, color: C.textSec },
                { label: 'پایین', value: ta.bollingerBands.lower, color: C.bull },
              ].map(b => (
                <div key={b.label} className="flex items-center justify-between px-1">
                  <span className="text-[9px]" style={{ color: C.textDim }}>{b.label}</span>
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: b.color }} dir="ltr">{toFa(b.value)}</span>
                </div>
              ))}
            </div>
            {/* BB position bar */}
            <div className="mt-1.5 relative">
              <div className="w-full h-1.5 rounded-full" style={{ background: C.cardBorder }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${bbPos}%`,
                    background: bbPos > 70 ? C.bear : bbPos < 30 ? C.bull : C.neutral,
                    opacity: 0.7,
                  }}
                />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{ left: `calc(${bbPos}% - 4px)`, background: C.text, border: `1px solid ${C.border}` }}
              />
            </div>
            <div className="flex items-center justify-between mt-0.5 px-1">
              <span className="text-[8px]" style={{ color: C.bull }}>اشباع فروش</span>
              <span className="text-[8px]" style={{ color: C.bear }}>اشباع خرید</span>
            </div>
          </div>

          {/* SAR & ATR */}
          <div style={{ borderTop: `1px solid ${C.cardBorder}` }} className="pt-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[8px]" style={{ color: C.textDim }}>SAR</div>
              <div className="text-[10px] font-bold tabular-nums" style={{ color: ta.sar > lastPrice ? C.bear : C.bull }} dir="ltr">{toFa(ta.sar)}</div>
            </div>
            <div>
              <div className="text-[8px]" style={{ color: C.textDim }}>ATR</div>
              <div className="text-[10px] font-bold tabular-nums" style={{ color: C.textSec }} dir="ltr">{toFa1(ta.atr)}</div>
            </div>
          </div>
        </GlassCard>

        {/* ══════════════════════════════════════════════════════════════════
            ۷. Support & Resistance (enhanced)
        ══════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionTitle>حمایت و مقاومت</SectionTitle>
          <div className="space-y-1.5">
            {/* Resistances */}
            {(ta.resistanceStrengths ?? []).length > 0 && (
              <div className="space-y-1">
                <div className="text-[9px] font-medium" style={{ color: C.bear }}>مقاومت‌ها</div>
                {(ta.resistanceStrengths ?? []).slice(0, 3).map((r, i) => {
                  const dist = pctDistance(lastPrice, r.price);
                  const isClosest = closestResistance?.price === r.price;
                  return (
                    <div
                      key={`r-${i}`}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-1.5"
                      style={{
                        background: isClosest ? hexToRgba(C.bear, 0.12) : hexToRgba(C.bear, 0.06),
                        border: `1px solid ${isClosest ? hexToRgba(C.bear, 0.25) : hexToRgba(C.bear, 0.1)}`,
                      }}
                    >
                      <span className="text-[9px] font-medium shrink-0" style={{ color: C.bear }}>
                        R{toPersianDigits(String(i + 1))}
                      </span>
                      <span className="text-[10px] font-bold tabular-nums flex-1 text-left" style={{ color: C.text }} dir="ltr">
                        {toFa(r.price)}
                      </span>
                      <span className="text-[8px] font-bold tabular-nums shrink-0" style={{ color: C.bear }} dir="ltr">
                        +{toPersianDigits(Math.abs(dist).toFixed(1))}٪
                      </span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-xl shrink-0 font-bold" style={gradeStyle(r.grade, C.bear, C.neutral, C.primary, C.cardBg, C.textSec)}>
                        {gradeLabel(r.grade)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Strength bars for resistances */}
            {(ta.resistanceStrengths ?? []).length > 0 && (
              <div className="flex gap-1 px-1">
                {(ta.resistanceStrengths ?? []).slice(0, 3).map((r, i) => (
                  <div key={`rb-${i}`} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: hexToRgba(C.bear, 0.15) }}>
                    <div className="h-full rounded-full" style={{ width: `${(r.strength / 10) * 100}%`, background: hexToRgba(C.bear, 0.6) }} />
                  </div>
                ))}
              </div>
            )}

            {/* Supports */}
            {(ta.supportStrengths ?? []).length > 0 && (
              <div className="space-y-1">
                <div className="text-[9px] font-medium" style={{ color: C.bull }}>حمایت‌ها</div>
                {(ta.supportStrengths ?? []).slice(0, 3).map((s, i) => {
                  const dist = pctDistance(lastPrice, s.price);
                  const isClosest = closestSupport?.price === s.price;
                  return (
                    <div
                      key={`s-${i}`}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-1.5"
                      style={{
                        background: isClosest ? hexToRgba(C.bull, 0.12) : hexToRgba(C.bull, 0.06),
                        border: `1px solid ${isClosest ? hexToRgba(C.bull, 0.25) : hexToRgba(C.bull, 0.1)}`,
                      }}
                    >
                      <span className="text-[9px] font-medium shrink-0" style={{ color: C.bull }}>
                        S{toPersianDigits(String(i + 1))}
                      </span>
                      <span className="text-[10px] font-bold tabular-nums flex-1 text-left" style={{ color: C.text }} dir="ltr">
                        {toFa(s.price)}
                      </span>
                      <span className="text-[8px] font-bold tabular-nums shrink-0" style={{ color: C.bull }} dir="ltr">
                        {toPersianDigits(dist.toFixed(1))}٪
                      </span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-xl shrink-0 font-bold" style={gradeStyle(s.grade, C.bear, C.neutral, C.primary, C.cardBg, C.textSec)}>
                        {gradeLabel(s.grade)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Strength bars for supports */}
            {(ta.supportStrengths ?? []).length > 0 && (
              <div className="flex gap-1 px-1">
                {(ta.supportStrengths ?? []).slice(0, 3).map((s, i) => (
                  <div key={`sb-${i}`} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: hexToRgba(C.bull, 0.15) }}>
                    <div className="h-full rounded-full" style={{ width: `${(s.strength / 10) * 100}%`, background: hexToRgba(C.bull, 0.6) }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ۸. Top 3 Scenarios
        ══════════════════════════════════════════════════════════════════ */}
        <GlassCard className="p-3 space-y-2">
          <SectionTitle>سناریوهای احتمالی</SectionTitle>
          {top3Scenarios.map((sc, i) => {
            const isBullish = sc.targetMax > lastPrice && sc.targetMin > lastPrice;
            const isBearish = sc.targetMax < lastPrice && sc.targetMin < lastPrice;
            const scColor = isBullish ? C.bull : isBearish ? C.bear : C.neutral;
            return (
              <div key={sc.key} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Target className="w-3 h-3 shrink-0" style={{ color: scColor }} />
                  <span className="text-[10px] font-bold flex-1 truncate" style={{ color: C.text }}>
                    {sc.name}
                  </span>
                  <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: scColor }} dir="ltr">
                    {toPersianDigits(sc.probability.toFixed(0))}٪
                  </span>
                </div>
                <ProgressBar value={sc.probability} max={100} color={scColor} height={3} />
                <div className="flex items-center justify-between px-1">
                  <span className="text-[8px] tabular-nums" style={{ color: C.textDim }} dir="ltr">
                    {toFa(sc.targetMin)}
                  </span>
                  <span className="text-[8px]" style={{ color: C.textDim }}>تا</span>
                  <span className="text-[8px] tabular-nums" style={{ color: C.textDim }} dir="ltr">
                    {toFa(sc.targetMax)}
                  </span>
                </div>
                {i < top3Scenarios.length - 1 && <div style={{ borderBottom: `1px solid ${C.cardBorder}` }} />}
              </div>
            );
          })}
        </GlassCard>

        {/* ══════════════════════════════════════════════════════════════════
            ۹. Collapse toggle
        ══════════════════════════════════════════════════════════════════ */}
        <button
          onClick={() => setCollapsed(true)}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[10px] transition-all cursor-pointer"
          style={{ color: C.textDim, background: C.cardBg, border: `1px solid ${C.cardBorder}` }}
          title="بستن سایدبار"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>جمع‌شوندگی</span>
        </button>
      </div>
    </aside>
  );
}

// Export for the collapsed state (show expand button)
export function CollapsedSidebarExpand({ onExpand }: { onExpand: () => void }) {
  const { colors: C } = useTheme();
  return (
    <button
      onClick={onExpand}
      className="shrink-0 hidden lg:flex items-center justify-center w-8 rounded-xl transition-all cursor-pointer"
      style={{ color: C.cardSubFg, background: C.cardBg, border: `1px solid ${C.cardBorder}` }}
      title="نمایش سایدبار"
    >
      <ChevronRight className="w-3.5 h-3.5" />
    </button>
  );
}
