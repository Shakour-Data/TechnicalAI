'use client';

import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { computeV11Probabilities, type V11Result } from '@/lib/ml-narrative-v11';
// Chart is rendered in page.tsx with id="chart-export-wrapper"
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { smartJalaliDate, fullPersianDate, toPersianDigits } from '@/lib/jalali';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileCode,
  FileText,
  FileDown,
  Table,
  FileSpreadsheet,
  Download,
  ChevronDown,
  ImageIcon,
} from 'lucide-react';
import { computeDailyIndicators } from '@/lib/indicator-arrays';

function renderAIText(text: string): string {
  // Normalize zero-width and look-alike characters that may interfere with regex
  const normalized = text.replace(/[\u200c\u200d\u200b\ufeff]/g, '');

  // Color syntax: {color:hex}text{/color} or {color:named}text{/color} → <span>
  const colorMap: Record<string, string> = {
    'red': '#dc2626', 'red-600': '#dc2626', 'red-700': '#b91c1c',
    'green': '#16a34a', 'emerald': '#059669', 'emerald-600': '#059669', 'emerald-700': '#047857',
    'amber': '#d97706', 'amber-600': '#d97706', 'amber-700': '#b45309', 'amber-800': '#92400e',
    'blue': '#2563eb', 'blue-600': '#2563eb', 'blue-700': '#1d4ed8',
    'orange': '#ea580c',
    'purple': '#9333ea', 'purple-600': '#9333ea', 'purple-700': '#7e22ce',
  };

  const withColors = normalized.replace(/\{color:([^}]+)\}([\s\S]*?)\{\/color\}/g, (_match, colorName: string, inner: string) => {
    const hex = colorMap[colorName.trim()] || (colorName.startsWith('#') ? colorName : null);
    if (!hex) return inner; // Unknown color: just return text without color
    return `<span style="color:${hex}">${inner}</span>`;
  });

  return withColors
    .split('\n\n')
    .map(p => {
      // Convert **bold** to <strong>
      const html = p.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>');
      // Convert newlines within paragraph to <br>
      return `<p class="mb-4">${html.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface Scenario {
  name: string;
  nameEn: string;
  probability: number;
  targetMin: number;
  targetMax: number;
  description: string;
}

export interface VdesAnalysisProps {
  symbolName: string;
  candles: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  currentPrice: number;
  resistances: number[];
  supports: number[];
  ma21: number;
  ma100: number;
  rsi: number;
  mfi: number;
  cci: number;
  adx: number;
  stochK: number;
  stochD: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  diPlus: number;
  diMinus: number;
  sar: number;
  atr: number;
  obv: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  trendDirection: string;
  trendAngle: number;
  trendR2: number;
  overallSignal: string;
  scenarios: {
    R1: Scenario;
    R2: Scenario;
    R3: Scenario;
    R4: Scenario;
    R5: Scenario;
    R6: Scenario;
    R7: Scenario;
    R8: Scenario;
    R9: Scenario;
  };
  supportStrengths: { price: number; strength: number; isTarget: boolean; fibRatio?: string; fibLabel?: string; score: number; grade: string; overlapCount: number; methods: string[] }[];
  resistanceStrengths: { price: number; strength: number; isTarget: boolean; fibRatio?: string; fibLabel?: string; score: number; grade: string; overlapCount: number; methods: string[] }[];
  priceTargets: { price: number; strength: number; isTarget: boolean; fibRatio?: string; fibLabel?: string }[];
  hasVolume?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const toFa = (n: number) => Math.round(n).toLocaleString('fa-IR');

const SCENARIO_KEYS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'] as const;

type ScenarioKey = (typeof SCENARIO_KEYS)[number];

const SCENARIO_NUMBER: Record<string, string> = {
  R1: '\u06f1', R2: '\u06f2', R3: '\u06f3', R4: '\u06f4', R5: '\u06f5',
  R6: '\u06f6', R7: '\u06f7', R8: '\u06f8', R9: '\u06f9',
};

const SCENARIO_META: Record<string, { label: string; type: string; border: string; badgeBg: string; badgeColor: string }> = {
  R1: { label: '\u0635\u0639\u0648\u062f\u06cc \u0628\u0627 \u0627\u062d\u062a\u06cc\u0627\u0637', type: 'up', border: '#047857', badgeBg: 'rgba(4,120,87,0.1)', badgeColor: '#047857' },
  R2: { label: '\u0635\u0639\u0648\u062f\u06cc \u0642\u0648\u06cc', type: 'up', border: '#059669', badgeBg: 'rgba(5,150,105,0.1)', badgeColor: '#059669' },
  R3: { label: '\u0635\u0639\u0648\u062f\u06cc \u0634\u062a\u0627\u0628\u062f\u0627\u0631', type: 'up', border: '#0e7490', badgeBg: 'rgba(14,116,144,0.1)', badgeColor: '#0e7490' },
  R4: { label: '\u0634\u0648\u06a9 \u0635\u0639\u0648\u062f\u06cc', type: 'up', border: '#0891b2', badgeBg: 'rgba(8,145,178,0.1)', badgeColor: '#0891b2' },
  R5: { label: '\u0631\u0646\u062c \u06a9\u0645\u200c\u0646\u0648\u0633\u0627\u0646', type: 'neutral', border: '#b45309', badgeBg: 'rgba(180,83,9,0.1)', badgeColor: '#b45309' },
  R6: { label: '\u0646\u0632\u0648\u0644\u06cc \u0628\u0627 \u0627\u062d\u062a\u06cc\u0627\u0637', type: 'down', border: '#c2410c', badgeBg: 'rgba(194,65,12,0.1)', badgeColor: '#c2410c' },
  R7: { label: '\u0646\u0632\u0648\u0644\u06cc \u0642\u0648\u06cc', type: 'down', border: '#ea580c', badgeBg: 'rgba(234,88,12,0.1)', badgeColor: '#ea580c' },
  R8: { label: '\u0646\u0632\u0648\u0644\u06cc \u0634\u062a\u0627\u0628\u200c\u062f\u0627\u0631', type: 'down', border: '#dc2626', badgeBg: 'rgba(220,38,38,0.1)', badgeColor: '#dc2626' },
  R9: { label: '\u0634\u0648\u06a9 \u0646\u0632\u0648\u0644\u06cc', type: 'down', border: '#b91c1c', badgeBg: 'rgba(185,28,28,0.1)', badgeColor: '#b91c1c' },
};

const GRADE_MAP: Record<string, { label: string; color: string }> = {
  'Very Strong': { label: 'بسیار قوی', color: 'text-red-700' },
  'Strong': { label: 'قوی', color: 'text-amber-700' },
  'Moderate': { label: 'متوسط', color: 'text-sky-700' },
  'Weak': { label: 'ضعیف', color: 'text-gray-500' },
};

function GradeBadge({ grade }: { grade: string }) {
  const g = GRADE_MAP[grade] ?? GRADE_MAP['Weak'];
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${g.color} ${grade === 'Very Strong' ? 'bg-red-100' : grade === 'Strong' ? 'bg-amber-100' : grade === 'Moderate' ? 'bg-sky-100' : 'bg-gray-100'}`}>
      {g.label}
    </span>
  );
}

const STRATEGY_MAP: Record<string, { text: string; tagCls: string }> = {
  R1: { text: 'سناریوی ۱: صعودی با احتیاط — ورود تدریجی توصیه می‌شود', tagCls: 'bg-emerald-700/10 text-emerald-700 border border-emerald-700/20' },
  R2: { text: 'سناریوی ۲: صعودی قوی — احتمال بالای عبور از مقاومت‌ها', tagCls: 'bg-emerald-600/10 text-emerald-600 border border-emerald-600/20' },
  R3: { text: 'سناریوی ۳: صعودی شتابدار — مومنتوم بالا، مدیریت ریسک ضروری', tagCls: 'bg-teal-700/10 text-teal-700 border border-teal-700/20' },
  R4: { text: 'سناریوی ۴: شوک صعودی — حرکت انفجاری احتمالی', tagCls: 'bg-cyan-700/10 text-cyan-700 border border-cyan-700/20' },
  R5: { text: 'سناریوی ۵: رنج کم‌نوسان — منتظر خروج از محدوده بمانید', tagCls: 'bg-amber-800/10 text-amber-800 border border-amber-800/20' },
  R6: { text: 'سناریوی ۶: نزولی با احتیاط — احتیاط توصیه می‌شود', tagCls: 'bg-orange-700/10 text-orange-700 border border-orange-700/20' },
  R7: { text: 'سناریوی ۷: نزولی قوی — کاهش موقعیت توصیه می‌شود', tagCls: 'bg-orange-600/10 text-orange-600 border border-orange-600/20' },
  R8: { text: 'سناریوی ۸: نزولی شتاب‌دار — خروج از موقعیت‌های خرید', tagCls: 'bg-red-600/10 text-red-600 border border-red-600/20' },
  R9: { text: 'سناریوی ۹: شوک نزولی — خروج فوری توصیه می‌شود', tagCls: 'bg-red-700/10 text-red-700 border border-red-700/20' },
};

const RISK_PROFILE_LABELS: Record<V11Result['riskProfile'], { label: string; color: string; bg: string }> = {
  very_bullish: { label: 'صعودی بسیار قوی', color: '#047857', bg: 'rgba(4,120,87,0.08)' },
  bullish: { label: 'صعودی', color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  neutral: { label: 'خنثی', color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
  bearish: { label: 'نزولی', color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
  very_bearish: { label: 'نزولی بسیار قوی', color: '#b91c1c', bg: 'rgba(185,28,28,0.08)' },
};

// ═══════════════════════════════════════════════════════════════════
// Dynamic Analysis Text Generator
// ═══════════════════════════════════════════════════════════════════

interface LevelStrength {
  price: number; strength: number; isTarget: boolean; fibRatio?: string; fibLabel?: string;
  score: number; grade: string; overlapCount: number; methods: string[];
}

interface AnalysisContext {
  symbolName: string;
  currentPrice: number;
  ma21: number;
  ma100: number;
  rsi: number;
  mfi: number;
  cci: number;
  adx: number;
  stochK: number;
  stochD: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  diPlus: number;
  diMinus: number;
  sar: number;
  atr: number;
  obv: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  trendDirection: string;
  trendAngle: number;
  trendR2: number;
  overallSignal: string;
  highestKey: string;
  highestProb: number;
  scenarios: VdesAnalysisProps['scenarios'];
  S1: number;
  R1: number;
  R2: number;
  hasVolume: boolean;
  resistanceStrengths: LevelStrength[];
  supportStrengths: LevelStrength[];
  v11Result: V11Result;
}

function generateAnalysisText(ctx: AnalysisContext) {
  const {
    symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx,
    stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, obv,
    bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal,
    highestKey, highestProb, scenarios, S1, R1, R2,
    hasVolume, resistanceStrengths, supportStrengths,
    v11Result,
  } = ctx;

  const R1_info = resistanceStrengths[0];
  const S1_info = supportStrengths[0];
  const R1_grade = R1_info?.grade ? (GRADE_MAP[R1_info.grade]?.label ?? R1_info.grade) : '';
  const S1_grade = S1_info?.grade ? (GRADE_MAP[S1_info.grade]?.label ?? S1_info.grade) : '';
  const R1_methods = R1_info?.methods?.length ? ` با ${toPersianDigits(String(R1_info.methods.length))} روش تأیید شده` : '';
  const S1_methods = S1_info?.methods?.length ? ` با ${toPersianDigits(String(S1_info.methods.length))} روش تأیید شده` : '';

  const bullCum = v11Result.bullishCumulative;
  const bearCum = v11Result.bearishCumulative;
  const rangeCum = v11Result.neutralCumulative;

  const dominant = SCENARIO_META[highestKey].label;

  const rsiSignal = rsi > 70 ? 'اشباع خرید شدید' : rsi > 60 ? 'اشباع خرید' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش' : 'اشباع فروش شدید';
  const stochSignal = stochK > 80 ? 'اشباع خرید' : stochK < 20 ? 'اشباع فروش' : stochK > stochD ? 'صعودی' : 'نزولی';
  const macdBullish = macdLine > macdSignal;
  const bbRange = bollingerUpper - bollingerLower;
  const bbPos = toPersianDigits(bbRange > 0 ? ((currentPrice - bollingerLower) / bbRange * 100).toFixed(0) : '50');
  const bbSignal = currentPrice > bollingerUpper ? 'بالای باند بالایی (اشباع خرید)'
    : currentPrice < bollingerLower ? 'زیر باند پایینی (اشباع فروش)'
    : `داخل باندها (${bbPos}٪ از بازه)`;
  const diSignal = diPlus > diMinus
    ? `DI+ (${toFa(diPlus)}) بالاتر از DI- (${toFa(diMinus)}) — فشار خرید غالب`
    : `DI- (${toFa(diMinus)}) بالاتر از DI+ (${toFa(diPlus)}) — فشار فروش غالب`;
  const trendText = trendDirection === 'up'
    ? `صعودی با زاویه ${toFa(Math.abs(trendAngle))} درجه و ضریب تعیین R²=${toPersianDigits((trendR2 * 100).toFixed(1))}٪`
    : trendDirection === 'down'
    ? `نزولی با زاویه ${toFa(Math.abs(trendAngle))} درجه و ضریب تعیین R²=${toPersianDigits((trendR2 * 100).toFixed(1))}٪`
    : 'خنثی و بدون جهت مشخص';

  const trendLabel = trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی';
  const trendColor = trendDirection === 'up' ? 'text-emerald-700' : trendDirection === 'down' ? 'text-red-700' : 'text-amber-800';
  const aboveBelow = (price: number, target: number) => price > target ? 'بالاتر' : 'پایین‌تر';
  const abColor = (price: number, target: number) => price > target ? 'text-emerald-700' : 'text-red-700';

  const adxText = adx > 40 ? 'روند قدرتمند' : adx > 25 ? 'روند متوسط' : 'روند ضعیف یا رنج';
  const adxColor = adx > 40 ? 'text-emerald-700' : adx > 25 ? 'text-amber-800' : 'text-[#6b7280]';

  // Helper: is bullish scenario?
  const isBull = (k: string) => ['R1','R2','R3','R4'].includes(k);
  const isBear = (k: string) => ['R6','R7','R8','R9'].includes(k);

  // ── PARAGRAPH 1: General Trend & Price Position ──
  const p1 = (
    <>
      <strong className="text-amber-800">روند کلی و موقعیت قیمت:</strong>{' '}
      سناریوی غالب برای سهم {symbolName} <b className="text-[#111827]">{dominant}</b> با احتمال <b className="text-[#111827]">{toFa(highestProb)}٪</b> می‌باشد.
      قیمت در محدوده <b className="text-[#111827]">{toFa(currentPrice)} ریال</b> معامله می‌شود و روند میان‌مدت{' '}
      <b className={trendColor}>{trendLabel}</b>
      {' '}است (زاویه {toFa(Math.abs(trendAngle))}°، R²={toPersianDigits((trendR2 * 100).toFixed(1))}٪).
      قیمت نسبت به MA21 ({toFa(ma21)} ریال){' '}
      <span className={abColor(currentPrice, ma21)}>{aboveBelow(currentPrice, ma21)}</span>
      {' '}و نسبت به MA100 ({toFa(ma100)} ریال){' '}
      <span className={abColor(currentPrice, ma100)}>{aboveBelow(currentPrice, ma100)}</span>
      {' '}قرار دارد.
      اندیکاتور Parabolic SAR ({toFa(sar)}) نیز{' '}
      {sar < currentPrice
        ? <><span>زیر قیمت قرار دارد که <b className="text-emerald-700">تأیید روند صعودی</b> است.</span></>
        : <><span>بالای قیمت قرار دارد که <b className="text-red-700">تأیید روند نزولی</b> است.</span></>
      }
      {' '}شاخص ADX ({toFa(adx)}) نشان‌دهنده <b className={adxText}>{adxText}</b> می‌باشد.
      {' '}{diSignal}.
    </>
  );

  // ── PARAGRAPH 2: Oscillator & Momentum (scenario-aware) ──
  let p2: React.ReactNode;
  if (isBull(highestKey)) {
    const isStrongBull = highestKey === 'R3' || highestKey === 'R4';
    p2 = (
      <>
        <strong className="text-amber-800">تحلیل اسیلاتورها و مومنتوم — مومنتوم صعودی{isStrongBull ? ' قوی' : ''}:</strong>{' '}
        اندیکاتور RSI ({toFa(rsi)}) در ناحیه{' '}
        <b className={rsi > 70 ? 'text-red-700' : rsi < 30 ? 'text-emerald-700' : 'text-[#374151]'}>{rsiSignal}</b>
        {rsi > 70 && <span className="text-red-700"> — با این حال در فاز {highestKey === 'R4' ? 'شوک' : 'شتابدار'} صعودی، RSI بالا طبیعی بوده و لزوماً سیگنال فروش نیست.</span>}
        {' '}قرار دارد.
        {ctx.hasVolume && <span>MFI ({toFa(mfi)}) {mfi > 80 ? <span className="text-red-700">اشباع خرید را نشان می‌دهد اما تأیید ورود قوی پول را تأیید می‌کند</span> : mfi < 20 ? <span className="text-emerald-700">اشباع فروش را نشان می‌دهد</span> : <span>در محدوده عادی است</span>}.</span>}
        CCI ({toFa(cci)}) {cci > 100 ? <span className="text-emerald-700">بالاتر از +100 — قدرت خریداران بسیار بالا</span> : cci < -100 ? <span className="text-red-700">پایین‌تر از -100 (قدرت فروشندگان)</span> : <span>در محدوده عادی (-100 تا +100)</span>}.
        استوکاستیک (%K={toFa(stochK)}، %D={toFa(stochD)}) وضعیت <b>{stochSignal}</b> را نشان می‌دهد.
        MACD (خط={toFa(macdLine)}، سیگنال={toFa(macdSignal)}) با{' '}
        {macdBullish
          ? <span className="text-emerald-700">عبور خط اصلی بالای خط سیگنال — تأیید‌کننده مومنتوم صعودی قدرتمند</span>
          : <span className="text-red-700">خط اصلی زیر خط سیگنال — هشدار کاهش مومنتوم</span>}
        . هیستوگرام MACD ({toFa(macdHist)}) {macdHist > 0 ? <span className="text-emerald-700">مثبت و در حال گسترش</span> : <span className="text-red-700">منفی</span>}.
        {isStrongBull && <span> مجموع احتمال صعودی {toFa(bullCum)}٪ نشان‌دهنده <b className="text-emerald-700">شتاب صعودی شدید</b> و ورود نقدینگی گسترده است.</span>}
        {!isStrongBull && bullCum > 60 && <span> مجموع احتمال صعودی {toFa(bullCum)}٪ نشان‌دهنده بایاس صعودی قوی در بازار است.</span>}
      </>
    );
  } else if (highestKey === 'R5') {
    p2 = (
      <>
        <strong className="text-amber-800">تحلیل اسیلاتورها و مومنتوم — بازار بدون جهت:</strong>{' '}
        اندیکاتور RSI ({toFa(rsi)}) در ناحیه <b className={rsi > 70 ? 'text-red-700' : rsi < 30 ? 'text-emerald-700' : 'text-[#374151]'}>{rsiSignal}</b> قرار دارد.
        {ctx.hasVolume && <span>MFI ({toFa(mfi)}) {mfi > 80 ? <span className="text-red-700">اشباع خرید</span> : mfi < 20 ? <span className="text-emerald-700">اشباع فروش</span> : <span>در محدوده خنثی</span>}.</span>}
        CCI ({toFa(cci)}) {cci > 100 ? <span>بالاتر از +100</span> : cci < -100 ? <span>پایین‌تر از -100</span> : <span>در محدوده عادی (-100 تا +100)</span>}.
        استوکاستیک (%K={toFa(stochK)}، %D={toFa(stochD)}) وضعیت <b>{stochSignal}</b> را نشان می‌دهد.
        MACD (خط={toFa(macdLine)}، سیگنال={toFa(macdSignal)}){' '}
        {macdBullish
          ? <span className="text-emerald-700">صعودی اما ضعیف</span>
          : <span className="text-red-700">نزولی اما ضعیف</span>}.
        هیستوگرام MACD ({toFa(macdHist)}) {macdHist > 0 ? <span className="text-emerald-700">مثبت</span> : <span className="text-red-700">منفی</span>} — مومنتوم پایین.
        اندیکاتورها تأییدکننده فاز رنج و عدم قطعیت بازار هستند. خروج از محدوده رنج نیاز به تأیید مومنتوم دارد.
      </>
    );
  } else if (isBear(highestKey)) {
    const isStrongBear = highestKey === 'R8' || highestKey === 'R9';
    p2 = (
      <>
        <strong className="text-amber-800">تحلیل اسیلاتورها و مومنتوم — {isStrongBear ? 'تضعیف شدید ساختار' : 'هشدار اصلاح'}:</strong>{' '}
        اندیکاتور RSI ({toFa(rsi)}) در ناحیه <b className={rsi > 70 ? 'text-red-700' : rsi < 30 ? 'text-emerald-700' : 'text-[#374151]'}>{rsiSignal}</b> قرار دارد
        {rsi < 40 && <span> — {isStrongBear ? 'سقوط RSI نشان‌دهنده فشار فروش سنگین است' : 'روند نزولی RSI هشدار ادامه اصلاح است'}.</span>}.
        {ctx.hasVolume && <span>MFI ({toFa(mfi)}) {mfi > 80 ? <span className="text-red-700">اشباع خرید — واگرایی منفی {isStrongBear ? 'خطرناک' : 'محتمل'}</span> : mfi < 20 ? <span className="text-red-700">اشباع فروش شدید — {isStrongBear ? 'خروج پول گسترده' : 'احتمال بازگشت کوتاه‌مدت'}</span> : <span>{isStrongBear ? 'در حال کاهش — هشدار خروج پول' : 'در محدوده نزولی'}</span>}.</span>}
        CCI ({toFa(cci)}) {cci > 100 ? <span className="text-red-700">بالاتر از +100 — {isStrongBear ? 'واگرایی قطعی' : 'ممکن است واگرایی منفی باشد'}</span> : cci < -100 ? <span className="text-red-700">پایین‌تر از -100 — {isStrongBear ? 'سقوط آزاد' : 'فشار فروش قوی'}</span> : <span>در محدوده عادی (-100 تا +100)</span>}.
        استوکاستیک (%K={toFa(stochK)}، %D={toFa(stochD)}) وضعیت <b>{stochSignal}</b>.
        MACD (خط={toFa(macdLine)}، سیگنال={toFa(macdSignal)}){' '}
        {macdBullish
          ? <span className="text-amber-800">صعودی موقت — {isStrongBear ? 'در ساختار نزولی قابل اعتماد نیست' : 'در روند نزولی سیگنال ضعیف'}</span>
          : <span className="text-red-700">تقاطع نزولی — {isStrongBear ? 'سیگنال خروج فوری' : 'تأیید‌کننده فشار فروش'}</span>}.
        هیستوگرام MACD ({toFa(macdHist)}) {macdHist > 0 ? <span className="text-amber-800">مثبت اما ضعیف</span> : <span className="text-red-700">منفی و {isStrongBear ? 'تشدید شونده' : 'در حال گسترش'}</span>}.
        {isStrongBear && <span> تمام اندیکاتورها تضعیف ساختاری و هشدار خروج سرمایه را تأیید می‌کنند.</span>}
        {!isStrongBear && <span> در مجموع، اندیکاتورها هشدار اصلاح عمیق‌تر را صادر می‌کنند.</span>}
      </>
    );
  } else {
    p2 = <></>;
  }

  // ── PARAGRAPH 3: Bollinger Bands & Volatility ──
  const p3 = (
    <>
      <strong className="text-amber-800">تحلیل نوسانات و باند بولینگر:</strong>{' '}
      قیمت در باند بولینگر <b className="text-[#111827]">{bbSignal}</b> قرار دارد.
      باند بالایی: {toFa(bollingerUpper)}، باند میانی (MA20): {toFa(bollingerMiddle)}، باند پایینی: {toFa(bollingerLower)} ریال.
      {currentPrice > bollingerUpper
        ? ' عبور از باند بالایی معمولاً نشان‌دهنده ادامه حرکت صعودی کوتاه‌مدت یا واکنش به باند است.'
        : currentPrice < bollingerLower
        ? ' نزدیکی یا عبور از باند پایینی می‌تواند نشانه بازگشت قیمت به سمت باند میانی باشد.'
        : ' موقعیت قیمت در داخل باندها نشان‌دهنده عدم وجود سیگنال شدید از باند بولینگر است.'}
      {isBull(highestKey) && ' فاصله قیمت از باند بالایی نشان‌دهنده شتاب صعودی است.'}
      {isBear(highestKey) && ' نزدیکی به باند پایینی هشدار ادامه فشار نزولی است.'}
      {highestKey === 'R5' && ' نوسان در محدوده باندها تأییدکننده فاز رنج بازار است.'}
    </>
  );

  // ── PARAGRAPH 4: Volume & OBV Analysis (scenario-aware) — HIDDEN when no volume ──
  const p4 = ctx.hasVolume ? (
    <>
      <strong className="text-amber-800">تحلیل حجم معاملات و شاخص OBV:</strong>{' '}
      شاخص جریان ورودی پول (OBV) در سطح <b className="text-[#111827]">{obv > 0 ? '+' : ''}{toPersianDigits((obv / 1e6).toFixed(1))}M</b> قرار دارد
      {obv > 0
        ? <span> که <b className="text-emerald-700">تجمع مثبت حجم</b> را نشان می‌دهد و حاکی از ورود پول هوشمند و تقویت روند صعودی است.
          {isBull(highestKey) ? ' این حجم مثبت تأیید‌کننده سناریوی صعودی است.' : ''}
          {highestKey === 'R5' ? ' اما در فاز رنج، حجم مثبت الزاماً سیگنال صعودی نیست.' : ''}
          {isBear(highestKey) ? ' اما با وجود حجم مثبت، ساختار قیمت ضعیف است — این تناقض قابل توجه است.' : ''}
        </span>
        : <span> که <b className="text-red-700">خروج پول</b> را نشان می‌دهد و می‌تواند نشانه ضعف خریداران و احتمال ادامه اصلاح باشد.
          {isBull(highestKey) ? ' خروج پول با سناریوی صعودی در تضاد است — احتیاط توصیه می‌شود.' : ''}
          {highestKey === 'R5' ? ' خروج پول در فاز رنج معمولاً پیش‌نشاننده شکست به سمت پایین است.' : ''}
          {isBear(highestKey) ? ' این خروج پول تأیید‌کننده سناریوی نزولی و ضرورت حفظ سرمایه است.' : ''}
        </span>
      }
    </>
  ) : (
    <>
      <strong className="text-amber-800">تحلیل نوسان پذیری:</strong>{' '}
      اندیکاتور ATR ({toFa(atr)}) نشان‌دهنده میانگین نوسان روزانه سهم است؛
      {atr > currentPrice * 0.03
        ? <span> نوسان بالاتر از ۳٪ قیمت که <b className="text-amber-800">نوسان بالایی</b> محسوب شده و مدیریت ریسک دقیق‌تری را ایجاب می‌کند.</span>
        : <span> نوسان معقول که نشان‌دهنده <b className="text-[#374151]">ثبات نسبی قیمت</b> در بازه‌های معاملاتی اخیر است.</span>
      }
    </>
  );

  // ── PARAGRAPH 5: Risk/Reward & Confluence (scenario-aware) ──
  let p5: React.ReactNode;
  if (isBull(highestKey)) {
    const isStrong = highestKey === 'R3' || highestKey === 'R4';
    p5 = (
      <>
        <strong className="text-amber-800">تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        با احتمال {toFa(highestProb)}٪ برای سناریوی {dominant}، اکثر شاخص‌ها <b className="text-emerald-700">الگوی صعودی{isStrong ? ' قدرتمند و شتابدار' : ''}</b> را تأیید می‌کنند.
        {bullCum > 60 && <span> مجموع احتمال صعودی {toFa(bullCum)}٪ نشان‌دهنده <b className="text-emerald-700">بایاس صعودی قوی</b> در بازار است.</span>}
        نسبت ریسک به بازده با حد ضرر در حمایت {toFa(S1)} و هدف {toFa(R1)} ریال، حدود <b className="text-emerald-700">{toPersianDigits(((R1 - currentPrice) / (currentPrice - S1)).toFixed(1))}:۱</b> محاسبه می‌شود.
        تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-amber-800">بسیار نزدیک به هم — تقاطع طلایی احتمالی</span>
          : ma21 > ma100
          ? <span className="text-emerald-700">به نفع صعودی (MA21 بالاتر از MA100)</span>
          : <span className="text-red-700">به نفع نزولی (MA21 پایین‌تر از MA100)</span>}
        {' '}است. {isStrong ? 'مومنتوم بالا مدیریت ریسک دقیق‌تری را ایجاب می‌کند.' : `توصیه: در صورت شکست مقاومت ${toFa(R1)}، هدف بعدی ${toFa(R2)} ریال تعیین می‌شود.`}
      </>
    );
  } else if (highestKey === 'R5') {
    p5 = (
      <>
        <strong className="text-amber-800">تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        سناریوی {dominant} با احتمال {toFa(highestProb)}٪ نشان‌دهنده <b className="text-amber-800">بازار رنج و بدون جهت مشخص</b> است.
        سیگنال‌ها <b className="text-amber-800">تضاد</b> دارند و بهترین استراتژی <b className="text-amber-800">انتظار و مشاهده</b> است.
        منتظر خروج قیمت از محدوده {toFa(S1)} تا {toFa(R1)} ریال بمانید.
        تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-amber-800">نزدیک به هم — هر گونه تقاطع می‌تواند سیگنال جهت باشد</span>
          : ma21 > ma100
          ? <span className="text-emerald-700">به نفع صعودی (MA21 بالاتر از MA100)</span>
          : <span className="text-red-700">به نفع نزولی (MA21 پایین‌تر از MA100)</span>}
        {' '}. شکست سطوح کلیدی و مومنتوم MACD را پایش کنید.
      </>
    );
  } else {
    // Bearish R6-R9
    const isStrong = highestKey === 'R8' || highestKey === 'R9';
    p5 = (
      <>
        <strong className="text-amber-800">تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        سناریوی {dominant} با احتمال {toFa(highestProb)}٪ نشان‌دهنده {isStrong ? <b className="text-red-700">تضعیف شدید ساختار</b> : <b className="text-red-700">ریسک اصلاح عمیق</b>} است.
        {bearCum > 60 && <span> مجموع احتمال نزولی {toFa(bearCum)}٪ — <b className="text-red-700">بایاس نزولی {isStrong ? 'بسیار' : ''}قوی</b> در بازار حاکم است.</span>}
        {isStrong ? <span> تمام شاخص‌ها هشدار <b className="text-red-700">خروج فوری</b> را صادر می‌کنند.</span> : <span> ورود به معامله خرید در این شرایط <b className="text-red-700">ریسک بالایی</b> دارد.</span>}
        تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-red-700">نزدیک به هم — {isStrong ? 'تقاطع مرگ در حال تکوین' : 'احتمال تقاطع مرگ'}</span>
          : ma21 > ma100
          ? <span className="text-amber-800">MA21 هنوز بالاتر اما {isStrong ? 'به سرعت در حال نزدیک شدن' : 'در حال ضعیف شدن'}</span>
          : <span className="text-red-700">MA21 زیر MA100 — {isStrong ? 'تأیید نهایی ساختار نزولی' : 'تأیید‌کننده فشار فروش'}</span>}
        {' '}. {isStrong ? 'حفظ سرمایه اولویت اول است. از هرگونه موقعیت خرید جدید خودداری کنید.' : `توصیه: احتیاط و انتظار برای بازگشت به محدوده حمایت ${toFa(S1)} ریال.`}
      </>
    );
  }

  return [p1, p2, p3, p4, p5];
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function StrengthBar({ strength }: { strength: number }) {
  const pct = (strength / 10) * 100;
  const color = strength >= 7 ? '#047857' : strength >= 4 ? '#b45309' : '#6b7280';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full bg-[#e5e7eb] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{toPersianDigits(String(strength))}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

export default function VdesAnalysis(props: VdesAnalysisProps) {
  const {
    symbolName, candles, currentPrice, resistances, supports, ma21, ma100,
    rsi, mfi, cci, adx, stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, obv, bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal, scenarios,
    supportStrengths, resistanceStrengths, priceTargets, hasVolume,
  } = props;

  const vdesRef = useRef<HTMLDivElement>(null);

  // Resistance/Support levels for analysis text
  const R1_level = resistances[0] ?? currentPrice * 1.05;
  const R2_level = resistances[1] ?? currentPrice * 1.10;
  const S1_level = supports[0] ?? currentPrice * 0.95;
  const S2_level = supports[1] ?? currentPrice * 0.90;
  const S3_level = supports[2] ?? currentPrice * 0.85;

  // Use the dominant bullish scenario's target range (consistent with scenario cards below)
  const bullishScenarios = ['R1', 'R2', 'R3', 'R4'] as const;
  let dominantBullKey: string = 'R1';
  let dominantBullProb = 0;
  for (const k of bullishScenarios) {
    if ((scenarios[k]?.probability ?? 0) > dominantBullProb) {
      dominantBullProb = scenarios[k]?.probability ?? 0;
      dominantBullKey = k;
    }
  }
  const targetMin = scenarios[dominantBullKey as keyof typeof scenarios]?.targetMin ?? Math.round(currentPrice * 1.02);
  const targetMax = scenarios[dominantBullKey as keyof typeof scenarios]?.targetMax ?? Math.round(currentPrice * 1.08);

  // ── V11 Computation ──────────────────────────────────────────
  const v11Result: V11Result = useMemo(() => {
    const input = {
      R1: scenarios.R1.probability,
      R2: scenarios.R2.probability,
      R3: scenarios.R3.probability,
      R4: scenarios.R4.probability,
      R5: scenarios.R5.probability,
      R6: scenarios.R6.probability,
      R7: scenarios.R7.probability,
      R8: scenarios.R8.probability,
      R9: scenarios.R9.probability,
    };
    return computeV11Probabilities(input);
  }, [scenarios]);

  // ── Dominant scenario ──────────────────────────────────────────
  let highestKey = 'R5';
  let highestProb = 0;
  for (const key of SCENARIO_KEYS) {
    const prob = scenarios[key]?.probability ?? 0;
    if (prob > highestProb) {
      highestProb = prob;
      highestKey = key;
    }
  }
  const strategy = STRATEGY_MAP[highestKey];
  const totalProb = SCENARIO_KEYS.reduce((sum, k) => sum + (scenarios[k]?.probability ?? 0), 0);

  // ── RSI signal ─────────────────────────────────────────────────
  const rsiSignal = rsi > 70 ? 'اشباع خرید شدید' : rsi > 60 ? 'اشباع خرید' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش' : 'اشباع فروش شدید';

  // ── Trend text ─────────────────────────────────────────────────
  const trendText = trendDirection === 'up'
    ? `صعودی با زاویه ${toFa(Math.abs(trendAngle))} درجه و ضریب تعیین R²=${toPersianDigits((trendR2 * 100).toFixed(1))}٪`
    : trendDirection === 'down'
    ? `نزولی با زاویه ${toFa(Math.abs(trendAngle))} درجه و ضریب تعیین R²=${toPersianDigits((trendR2 * 100).toFixed(1))}٪`
    : 'خنثی و بدون جهت مشخص';

  // ── Shamsi dates ───────────────────────────────────────────────
  const lastCandleDate = candles.length > 0 ? candles[candles.length - 1].date : '';
  const lastCandleJalali = lastCandleDate ? fullPersianDate(lastCandleDate) : '';

  // ── Dynamic analysis text ──────────────────────────────────────
  const analysisParagraphs = useMemo(() => {
    return generateAnalysisText({
      symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx,
      stochK, stochD, macdLine, macdSignal, macdHist,
      diPlus, diMinus, sar, atr, obv,
      bollingerUpper, bollingerMiddle, bollingerLower,
      trendDirection, trendAngle, trendR2, overallSignal,
      highestKey, highestProb, scenarios,
      S1: S1_level, R1: R1_level, R2: R2_level,
      hasVolume: hasVolume ?? false,
      resistanceStrengths, supportStrengths,
      v11Result,
    });
  }, [
    symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx,
    stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, obv,
    bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal,
    highestKey, highestProb, scenarios,
    S1_level, R1_level, R2_level, hasVolume,
    resistanceStrengths, supportStrengths, v11Result,
  ]);

  // ── Strategy recommendation text ────────────────────────────────
  const mfiOverbought = hasVolume && mfi > 80;
  const mfiOversold = hasVolume && mfi < 20;
  const mfiNote = hasVolume ? `, MFI: ${toFa(mfi)}` : '';
  const strategyText = rsi > 70 || mfiOverbought
    ? `با توجه به هشدار اشباع خرید (RSI: ${toFa(rsi)}${mfiNote}) و فاصله قیمت تا مقاومت ${toFa(R1_level)}، استراتژی محتاطانه، انتظار برای اصلاح قیمت و ورود در محدوده حمایت ${toFa(S1_level)} تا ${toFa(S2_level)} ریال می‌باشد. در این محدوده می‌توان با حد ضرر ${toFa(S2_level)} ریال وارد موقعیت خرید شد.`
    : rsi < 30 || mfiOversold
    ? `با توجه به اشباع فروش (RSI: ${toFa(rsi)}${mfiNote}) و نزدیکی به حمایت ${toFa(S1_level)}، فرصت خرید در محدوده فعلی با حد ضرر ${toFa(S2_level)} ریال قابل بررسی است. هدف اولیه ${toFa(R1_level)} و هدف ثانویه ${toFa(R2_level)} ریال تعیین می‌شود.`
    : `با توجه به وضعیت خنثی اندیکاتورها (RSI: ${toFa(rsi)}${mfiNote}, ADX: ${toFa(adx)}، قدرت روند: ${adx > 25 ? 'قوی' : 'ضعیف'})، انتظار برای خروج قیمت از محدوده ${toFa(S1_level)} تا ${toFa(R1_level)} ریال و سپس تصمیم‌گیری توصیه می‌شود. مومنتوم MACD و شکست سطوح کلیدی را برای تأیید سیگنال پایش کنید.`;

  const v11Map = useMemo(() => {
    const m = new Map<string, V11Result['scenarios'][number]>();
    for (const s of v11Result.scenarios) m.set(s.key, s);
    return m;
  }, [v11Result]);

  // ── AI Analysis Text ───────────────────────────────────────
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentPrice) return;
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx,
            stochK, stochD, macdLine, macdSignal, macdHist,
            diPlus, diMinus, sar, atr, obv,
            bollingerUpper, bollingerMiddle, bollingerLower,
            trendDirection, trendAngle, trendR2,
            scenarios, hasVolume: hasVolume ?? false,
            resistanceStrengths, supportStrengths,
            v11Probabilities: v11Result,
          }),
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          let errMsg = `خطای سرور (${res.status})`;
          try {
            const errBody = await res.json();
            if (errBody.error) errMsg = errBody.error;
          } catch { /* non-JSON response (e.g. 502 HTML) */ }
          setAiError(errMsg);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.text) {
          setAiText(data.text);
        }
        else if (data.error) setAiError(data.error);
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'cancelled' || msg === 'aborted' || msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('cancel')) return;
        setAiError(msg.length > 200 ? msg.slice(0, 200) : msg);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx, stochK, stochD, macdLine, macdSignal, macdHist, diPlus, diMinus, sar, atr, obv, bollingerUpper, bollingerMiddle, bollingerLower, trendDirection, trendAngle, trendR2, scenarios, hasVolume, resistanceStrengths, supportStrengths, v11Result]);

  // ── File name helper ───────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const fileBase = `${symbolName}_تحلیل_${today}`;

  // ── Per-day indicators for CSV/Excel ──────────────────────────
  const dailyIndicators = useMemo(() => computeDailyIndicators(candles), [candles]);

  // ── Risk profile info ──────────────────────────────────────────
  const riskInfo = RISK_PROFILE_LABELS[v11Result.riskProfile];

  // ═══ EXPORT FUNCTIONS ═══════════════════════════════════════════

  const exportHTML = useCallback(async () => {
    if (!vdesRef.current) return;
    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تحلیل تکنیکال ${symbolName} — توضیح‌دهنده تصویری</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Vazirmatn', sans-serif; background: #f3f4f6; color: #111827; padding: 24px; line-height: 1.8; }
.container { max-width: 960px; margin: 0 auto; }
.header { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px 24px; margin-bottom: 20px; }
.header h1 { color: #92600A; font-size: 20px; margin-bottom: 8px; }
.badge { display: inline-block; padding: 4px 12px; border-radius: 20px; border: 1px solid #e5e7eb; background: #f3f4f6; font-size: 12px; margin: 4px; color: #374151; }
.badge strong { color: #111827; }
.section { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; }
.section h2 { color: #92600A; font-size: 14px; margin-bottom: 12px; }
.section p { font-size: 13px; color: #374151; margin-bottom: 12px; }
.section p strong { color: #92600A; }
.scenario-grid { display: grid; grid-template-columns: repeat(9, 1fr); gap: 8px; margin-top: 12px; }
.scenario-card { border: 1px solid #e5e7eb; border-top: 3px solid; border-radius: 8px; padding: 10px 8px; text-align: center; background: #f3f4f6; font-size: 11px; }
.scenario-card .prob { font-size: 18px; font-weight: 900; margin: 4px 0; }
.scenario-card .range { font-size: 9px; color: #6b7280; }
.scenario-card .cum { font-size: 9px; color: #6b7280; margin-top: 2px; }
.bar-bg { height: 5px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin: 6px 0; }
.bar-fill { height: 100%; border-radius: 3px; }
.summary-bar { display: flex; gap: 8px; margin-top: 12px; }
.summary-item { flex: 1; text-align: center; padding: 8px; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 12px; }
.level-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.level-box { border-radius: 8px; padding: 12px; border: 1px solid; }
.level-box h3 { font-size: 13px; margin-bottom: 8px; }
.level-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 8px; margin-bottom: 6px; background: #f9fafb; border: 1px solid #e5e7eb; }
.strategy-tag { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid; margin-top: 8px; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1> تحلیل تکنیکال ${symbolName}</h1>
<div style="margin-top:8px">
<span class="badge"> قیمت مرجع: <strong>${toFa(currentPrice)} ریال</strong></span>
<span class="badge"> هدف کوتاه‌مدت: <strong>${toFa(targetMin)} — ${toFa(targetMax)} ریال</strong></span>
<span class="badge"> روند: <strong>${trendText}</strong></span>
<span class="badge"> پروفایل ریسک: <strong>${riskInfo.label}</strong></span>
<span class="badge">RSI: ${toFa(rsi)} (${rsiSignal})</span>
</div>
${lastCandleJalali ? `<div style="font-size:11px;color:#6b7280;margin-top:8px"> ${lastCandleJalali}</div>` : ''}
</div>

<div class="section">
<h2> تحلیل جامع روند و اندیکاتورها</h2>
<div>${vdesRef.current.querySelector('.vdes-analysis-text')?.innerHTML || '<p>تحلیل در دسترس نیست</p>'}</div>
</div>

<div class="section">
<h2> احتمالات سناریوها</h2>
<div class="scenario-grid">
${SCENARIO_KEYS.map(k => {
  const s = scenarios[k];
  if (!s) return '';
  const m = SCENARIO_META[k];
  const v = v11Map.get(k);
  return `<div class="scenario-card" style="border-top-color:${m.border}">
    <div style="display:flex;justify-content:space-between"><strong style="color:${m.badgeColor}">${SCENARIO_NUMBER[k]}</strong></div>
    <div style="font-size:10px;color:#374151;margin:2px 0">${m.label}</div>
    <div class="prob" style="color:${m.badgeColor}">${toFa(s.probability)}٪</div>
    <div class="bar-bg"><div class="bar-fill" style="width:${s.probability}%;background:${m.border}"></div></div>
    <div class="cum">تجمعی: ${toFa(v?.cumulativeProbability ?? 0)}٪</div>
    <div class="range">${toFa(s.targetMin)} — ${toFa(s.targetMax)} ریال</div>
  </div>`;
}).join('')}
</div>
<div class="summary-bar">
  <div class="summary-item" style="background:rgba(4,120,87,0.06)"><div style="font-size:10px;color:#6b7280">مجموع صعودی</div><div style="font-size:16px;font-weight:900;color:#047857">${toFa(v11Result.bullishCumulative)}٪</div></div>
  <div class="summary-item" style="background:rgba(180,83,9,0.06)"><div style="font-size:10px;color:#6b7280">رنج</div><div style="font-size:16px;font-weight:900;color:#b45309">${toFa(v11Result.neutralCumulative)}٪</div></div>
  <div class="summary-item" style="background:rgba(185,28,28,0.06)"><div style="font-size:10px;color:#6b7280">مجموع نزولی</div><div style="font-size:16px;font-weight:900;color:#b91c1c">${toFa(v11Result.bearishCumulative)}٪</div></div>
</div>
<div style="text-align:center;font-size:11px;color:#6b7280;margin-top:12px">مجموع احتمالات: <strong style="color:#374151">${toFa(totalProb)}٪</strong></div>
</div>

<div style="text-align:center;padding:12px">
<span class="strategy-tag ${strategy.tagCls}">${strategy.text}</span>
</div>
</div>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    saveAs(blob, `${fileBase}.html`);
  }, [symbolName, currentPrice, targetMin, targetMax, trendText, rsi, rsiSignal, scenarios, totalProb, strategy, lastCandleJalali, fileBase, v11Result, v11Map, riskInfo]);

  const exportText = useCallback(() => {
    const lines: string[] = [];
    lines.push(`تحلیل تکنیکال ${symbolName} — توضیح‌دهنده تصویری`);
    if (lastCandleJalali) lines.push(`تاریخ: ${lastCandleJalali}`);
    lines.push('');
    lines.push(`قیمت مرجع: ${toFa(currentPrice)} ریال`);
    lines.push(`هدف کوتاه‌مدت: ${toFa(targetMin)} — ${toFa(targetMax)} ریال`);
    lines.push(`روند: ${trendText}`);
    lines.push(`پروفایل ریسک: ${riskInfo.label}`);
    lines.push(`RSI: ${toFa(rsi)} (${rsiSignal})`);
    lines.push('');
    lines.push('═══ تحلیل جامع ═══');
    lines.push('');
    // Extract text content from the analysis section
    if (vdesRef.current) {
      const textEl = vdesRef.current.querySelector('.vdes-analysis-text');
      if (textEl) lines.push(textEl.textContent || '');
    }
    lines.push('');
    lines.push('═══ احتمالات سناریوها ═══');
    lines.push('');
    for (const k of SCENARIO_KEYS) {
      const s = scenarios[k];
      if (!s) continue;
      const m = SCENARIO_META[k];
      const v = v11Map.get(k);
      lines.push(`سناریوی ${SCENARIO_NUMBER[k]} — ${m.label}: اختصاصی ${toFa(s.probability)}٪ | تجمعی ${toFa(v?.cumulativeProbability ?? 0)}٪ | هدف: ${toFa(s.targetMin)} — ${toFa(s.targetMax)} ریال`);
    }
    lines.push('');
    lines.push(`مجموع صعودی: ${toFa(v11Result.bullishCumulative)}٪ | رنج: ${toFa(v11Result.neutralCumulative)}٪ | مجموع نزولی: ${toFa(v11Result.bearishCumulative)}٪`);
    lines.push(`سیگنال غالب: ${strategy.text}`);
    const text = lines.join('\n');
    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${fileBase}.txt`);
  }, [symbolName, currentPrice, targetMin, targetMax, trendText, rsi, rsiSignal, scenarios, strategy, lastCandleJalali, fileBase, v11Result, v11Map, riskInfo]);

  const exportPDF = useCallback(async () => {
    const el = vdesRef.current;
    if (!el || !el.isConnected || el.offsetWidth === 0) return;
    try {
      const originalDisplay = el.style.display;
      const originalVisibility = el.style.visibility;
      if (el.offsetHeight === 0) {
        el.style.display = 'block';
        el.style.visibility = 'visible';
        await new Promise(r => setTimeout(r, 100));
      }
      const dataUrl = await toPng(el, { backgroundColor: '#f3f4f6', pixelRatio: 2, cacheBust: true, skipAutoScale: true });
      el.style.display = originalDisplay;
      el.style.visibility = originalVisibility;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (el.offsetHeight * imgWidth) / el.offsetWidth;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      pdf.save(`${fileBase}.pdf`);
    } catch (err) {
      console.warn('PDF export failed:', err instanceof Error ? err.message : String(err));
    }
  }, [fileBase]);

  const exportExcel = useCallback(() => {
    const rows = dailyIndicators.map((d, i) => ({
      '#': i + 1,
      'تاریخ': d.date,
      'باز': d.open,
      'بالا': d.high,
      'پایین': d.low,
      'بسته': d.close,
      'حجم': d.volume,
      'MA21': d.ma21,
      'MA100': d.ma100,
      'RSI': d.rsi,
      'MFI': d.mfi,
      'CCI': d.cci,
      'ADX': d.adx,
      'MACD': d.macd,
      'MACD_Signal': d.macdSignal,
      'MACD_Hist': d.macdHist,
      'Stoch_K': d.stochK,
      'Stoch_D': d.stochD,
      'SAR': d.sar,
      'ATR': d.atr,
      'BB_Upper': d.bbUpper,
      'BB_Middle': d.bbMiddle,
      'BB_Lower': d.bbLower,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'داده‌ها');
    // Add scenarios sheet
    const scenarioRows = SCENARIO_KEYS.map(k => ({
      'سناریو': SCENARIO_META[k].label,
      'کد': `سناریوی ${SCENARIO_NUMBER[k]}`,
      'احتمال اختصاصی٪': scenarios[k]?.probability ?? 0,
      'احتمال تجمعی٪': v11Map.get(k)?.cumulativeProbability ?? 0,
      'هدف_حداقل': Math.round(scenarios[k]?.targetMin ?? 0),
      'هدف_حداکثر': Math.round(scenarios[k]?.targetMax ?? 0),
    }));
    const ws2 = XLSX.utils.json_to_sheet(scenarioRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'سناریوها');
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
  }, [dailyIndicators, scenarios, fileBase, v11Map]);

  const exportCSV = useCallback(() => {
    const headers = ['تاریخ', 'باز', 'بالا', 'پایین', 'بسته', 'حجم', 'MA21', 'MA100', 'RSI', 'MFI', 'CCI', 'ADX', 'MACD', 'MACD_Signal', 'MACD_Hist', 'SAR', 'ATR', 'BB_Upper', 'BB_Middle', 'BB_Lower'];
    const csvRows: string[] = [headers.join(',')];
    for (const d of dailyIndicators) {
      csvRows.push([
        d.date, d.open, d.high, d.low, d.close, d.volume,
        d.ma21, d.ma100, d.rsi, d.mfi,
        d.cci, d.adx, d.macd,
        d.macdSignal, d.macdHist, d.sar, d.atr,
        d.bbUpper, d.bbMiddle, d.bbLower,
      ].join(','));
    }
    const csv = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${fileBase}.csv`);
  }, [dailyIndicators, fileBase]);

  // ── Chart Image Export ─────────────────────────────────────────
  const exportChartImage = useCallback(async () => {
    const chartEl = document.getElementById('chart-export-wrapper');
    if (!chartEl || !chartEl.isConnected || chartEl.offsetWidth === 0) return;
    try {
      const dataUrl = await toPng(chartEl, { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true });
      saveAs(dataUrl, `${fileBase}_نمودار.png`);
    } catch (err) {
      console.warn('Chart image export failed:', err instanceof Error ? err.message : String(err));
    }
  }, [fileBase]);

  return (
    <div ref={vdesRef} className="space-y-5" dir="rtl">
      {/* ═══ HEADER ═══ */}
      <div className="rounded-2xl px-6 py-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-amber-800">
             تحلیل تکنیکال {symbolName}
          </h1>
          {lastCandleJalali && (
            <span className="text-xs text-[#6b7280]"> {lastCandleJalali}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="px-3.5 py-1 rounded-full border border-[#e5e7eb] bg-[#f3f4f6] text-xs text-[#374151]">
             قیمت مرجع: <b className="text-[#111827]">{toFa(currentPrice)} ریال</b>
          </span>
          <span className="px-3.5 py-1 rounded-full border border-[#e5e7eb] bg-[#f3f4f6] text-xs text-[#374151]">
             محدوده سناریوی صعودی غالب: <b className="text-[#111827]">{toFa(targetMin)} — {toFa(targetMax)} ریال</b>
          </span>
          <span className="px-3.5 py-1 rounded-full border border-[#e5e7eb] bg-[#f3f4f6] text-xs text-[#374151]">
             روند: <b className="text-[#111827]">{trendText}</b>
          </span>
          <span className={`px-3.5 py-1 rounded-full border text-xs font-medium`} style={{ borderColor: riskInfo.color + '33', color: riskInfo.color, background: riskInfo.bg }}>
            پروفایل ریسک: {riskInfo.label}
          </span>
          <span className={`px-3.5 py-1 rounded-full border text-xs font-medium ${
            rsi > 70 ? 'bg-red-100 text-red-700 border-red-200'
            : rsi > 60 ? 'bg-orange-100 text-orange-700 border-orange-200'
            : rsi > 40 ? 'bg-amber-50 text-amber-800 border-amber-200'
            : rsi > 30 ? 'bg-sky-100 text-sky-700 border-sky-200'
            : 'bg-emerald-100 text-emerald-700 border-emerald-200'
          }`}>
            RSI: {toFa(rsi)} ({rsiSignal})
          </span>
        </div>
      </div>

      {/* ═══ EXPORT TOOLBAR ═══ */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#374151]">خروجی تحلیل</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e5e7eb] bg-[#ffffff] shadow-sm text-xs font-medium text-[#111827] hover:bg-[#f3f4f6] transition-colors cursor-pointer">
              <Download className="w-4 h-4" />
              <span>دانلود / خروجی</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#6b7280]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-[#ffffff] border-[#e5e7eb]">
            <DropdownMenuItem onClick={exportHTML} className="flex items-center gap-3 text-[#111827] focus:bg-[#f3f4f6] cursor-pointer">
              <FileCode className="w-4 h-4 text-amber-800" />
              <span className="text-xs">HTML+CSS+JS</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportText} className="flex items-center gap-3 text-[#111827] focus:bg-[#f3f4f6] cursor-pointer">
              <FileText className="w-4 h-4 text-amber-800" />
              <span className="text-xs">متن (Text)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPDF} className="flex items-center gap-3 text-[#111827] focus:bg-[#f3f4f6] cursor-pointer">
              <FileDown className="w-4 h-4 text-amber-800" />
              <span className="text-xs">PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportExcel} className="flex items-center gap-3 text-[#111827] focus:bg-[#f3f4f6] cursor-pointer">
              <Table className="w-4 h-4 text-amber-800" />
              <span className="text-xs">اکسل (Excel)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportCSV} className="flex items-center gap-3 text-[#111827] focus:bg-[#f3f4f6] cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 text-amber-800" />
              <span className="text-xs">CSV</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportChartImage} className="flex items-center gap-3 text-[#111827] focus:bg-[#f3f4f6] cursor-pointer">
              <ImageIcon className="w-4 h-4 text-amber-800" />
              <span className="text-xs">عکس نمودار (PNG)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ═══ CHART ═══ */}
      {/* Chart is rendered above this component in page.tsx (v3.0) */}

      {/* ═══ KEY LEVELS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Resistances ── */}
        <div className="rounded-2xl border border-orange-200 overflow-hidden bg-[#ffffff] shadow-sm">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-orange-200 bg-orange-50">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-600" />
            <h3 className="text-sm font-bold text-orange-700">سطوح مقاومت</h3>
            <span className="text-[10px] text-[#6b7280] mr-auto">حمایت و مقاومت هوشمند</span>
          </div>
          <div className="p-4 space-y-2.5">
            {resistanceStrengths.slice(0, 6).map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3 border border-[#e5e7eb] bg-[#f3f4f6]/50">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-red-600 w-6">R{toFa(i + 1)}</span>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[#111827] tabular-nums" dir="ltr">{toFa(r.price)}</span>
                      <span className="text-[10px] text-[#6b7280]">ریال</span>
                      {r.grade && <GradeBadge grade={r.grade} />}
                      {r.methods?.length ? <span className="text-[9px] text-[#6b7280]">({toPersianDigits(String(r.methods.length))} روش)</span> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {r.fibLabel && <span className="text-[9px] text-red-400">فیبو {r.fibLabel}</span>}
                      {r.overlapCount > 0 && <span className="text-[9px] text-[#6b7280]">هم‌پوشانی: {toPersianDigits(String(r.overlapCount))}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StrengthBar strength={r.strength} />
                  {r.isTarget && <span className="text-[10px]"></span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Supports ── */}
        <div className="rounded-2xl border border-blue-200 overflow-hidden bg-[#ffffff] shadow-sm">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-blue-200 bg-blue-50">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <h3 className="text-sm font-bold text-blue-700">سطوح حمایت</h3>
            <span className="text-[10px] text-[#6b7280] mr-auto">حمایت و مقاومت هوشمند</span>
          </div>
          <div className="p-4 space-y-2.5">
            {supportStrengths.slice(0, 6).map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3 border border-[#e5e7eb] bg-[#f3f4f6]/50">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-emerald-600 w-6">S{toFa(i + 1)}</span>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[#111827] tabular-nums" dir="ltr">{toFa(s.price)}</span>
                      <span className="text-[10px] text-[#6b7280]">ریال</span>
                      {s.grade && <GradeBadge grade={s.grade} />}
                      {s.methods?.length ? <span className="text-[9px] text-[#6b7280]">({toPersianDigits(String(s.methods.length))} روش)</span> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.fibLabel && <span className="text-[9px] text-emerald-400">فیبو {s.fibLabel}</span>}
                      {s.overlapCount > 0 && <span className="text-[9px] text-[#6b7280]">هم‌پوشانی: {toPersianDigits(String(s.overlapCount))}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StrengthBar strength={s.strength} />
                  {s.isTarget && <span className="text-[10px]"></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ PRICE TARGETS ═══ */}
      {priceTargets && priceTargets.length > 0 && (
        <div className="rounded-2xl border border-amber-800/15 overflow-hidden bg-[#ffffff] shadow-sm">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-amber-800/10 bg-amber-50">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-700" />
            <h3 className="text-sm font-bold text-amber-800">اهداف قیمتی</h3>
            <span className="text-[10px] text-[#6b7280] mr-auto">سطوح با قدرت بالا</span>
          </div>
          <div className="p-4 flex flex-wrap gap-3">
            {priceTargets.map((t, i) => (
              <div key={i} className="flex-1 min-w-[160px] rounded-xl p-4 border border-amber-800/10 bg-amber-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#6b7280]">هدف {toFa(i + 1)}</span>
                  <span className="text-[10px]"></span>
                </div>
                <p className="text-base font-black text-amber-800 tabular-nums" dir="ltr">{toFa(t.price)}</p>
                <span className="text-[10px] text-[#6b7280]">ریال</span>
                <div className="mt-3">
                  <StrengthBar strength={t.strength} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ANALYSIS TEXT (full width) ═══ */}
      <div className="rounded-2xl p-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
        <h2 className="text-sm font-semibold mb-3 text-amber-800 flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-amber-700 inline-block" />
          تحلیل هوشمند بازار
        </h2>
        <div className="max-h-[400px] overflow-y-auto pr-1">
          {aiLoading && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-700 rounded-full animate-spin" />
              <span className="text-sm text-amber-800">در حال تولید تحلیل هوشمند ...</span>
            </div>
          )}
          {aiError && (
            <div className="rounded-xl p-4 bg-red-50 border border-red-200">
              <p className="text-xs text-red-700 mb-1">خطا در تولید تحلیل هوشمند:</p>
              <p className="text-xs text-red-600">{aiError.length > 100 ? aiError.slice(0, 100) + '...' : aiError}</p>
            </div>
          )}
          {!aiLoading && aiText && (
          <div
            className="text-sm text-[#374151] leading-[1.85]"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: renderAIText(aiText) }}
          />
          )}
          {!aiLoading && !aiText && !aiError && analysisParagraphs.length > 0 && (
            <div className="space-y-4">
              {analysisParagraphs.map((p, i) => (
                <p key={i} className="text-sm text-[#374151] leading-[1.85]">{p}</p>
              ))}
              <div className="rounded-xl px-4 py-3 border-r-4 border-amber-700 bg-amber-50/60">
                <strong className="text-amber-800 text-sm">استراتژی پیشنهادی:</strong>
                <p className="text-xs text-[#374151] leading-[1.85] mt-1.5">{strategyText}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ SCENARIO PROBABILITIES (V11) ═══ */}
      <div className="rounded-2xl p-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <span></span>
            احتمالات سناریوها
            <span className="text-[10px] font-normal text-[#6b7280] bg-[#f3f4f6] px-2 py-0.5 rounded-full">v11</span>
          </h2>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-700" />
              <span className="text-[#6b7280]">صعودی: <b className="text-[#111827]">{toFa(v11Result.bullishCumulative)}٪</b></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
              <span className="text-[#6b7280]">نزولی: <b className="text-[#111827]">{toFa(v11Result.bearishCumulative)}٪</b></span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {SCENARIO_KEYS.map(key => {
            const s = scenarios[key];
            const meta = SCENARIO_META[key];
            const v11 = v11Map.get(key);
            return (
              <div
                key={key}
                className="rounded-xl p-3.5 bg-[#f3f4f6]/60 border border-[#e5e7eb]"
                style={{ borderTop: `3px solid ${meta.border}` }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold" style={{ color: meta.badgeColor }}>{SCENARIO_NUMBER[key]}</span>
                  <span className="text-[10px] text-[#6b7280]">{meta.label}</span>
                </div>
                <div className="text-center my-1.5">
                  <span
                    className="inline-block text-2xl font-black tabular-nums"
                    style={{ color: meta.badgeColor }}
                  >
                    {toFa(s.probability)}٪
                  </span>
                </div>
                {/* V11: احتمال اختصاصی and تجمعی */}
                <div className="flex justify-between text-[9px] text-[#6b7280] mb-2 px-1">
                  <span>اختصاصی: <b style={{ color: meta.badgeColor }}>{v11 ? toFa(v11.rawProbability) : toFa(s.probability)}٪</b></span>
                  <span>تجمعی: <b className="text-[#374151]">{v11 ? toFa(v11.cumulativeProbability) : '—'}٪</b></span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#e5e7eb] overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${s.probability}%`, backgroundColor: meta.border }}
                  />
                </div>
                <div className="text-[10px] text-[#6b7280] text-center" dir="ltr">
                  {toFa(s.targetMin)} — {toFa(s.targetMax)} ریال
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-center text-xs text-[#6b7280]">
          مجموع احتمالات: <b className="text-[#374151]">{toFa(totalProb)}٪</b> (برابر ۱۰۰٪)
          {v11Result.riskProfile !== 'neutral' && (
            <span className="mr-3">
              پروفایل ریسک: <b className={
                v11Result.riskProfile === 'very_bullish' || v11Result.riskProfile === 'bullish'
                  ? 'text-emerald-700'
                  : 'text-red-700'
              }>{
                v11Result.riskProfile === 'very_bullish' ? 'صعودی قوی' :
                v11Result.riskProfile === 'bullish' ? 'صعودی' :
                v11Result.riskProfile === 'bearish' ? 'نزولی' : 'نزولی قوی'
              }</b>
            </span>
          )}
        </div>
      </div>

      {/* ═══ STRATEGY TAG ═══ */}
      <div className="flex flex-wrap items-center gap-3 px-4">
        <span className="text-xs text-[#6b7280]">سیگنال غالب:</span>
        <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold ${strategy.tagCls}`}>
          {strategy.text}
        </span>
      </div>
    </div>
  );
}

// ── Loading ────────────────────────────────────────────────────────────────────

export function VdesAnalysisSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-28 w-full bg-[#e5e7eb] rounded-2xl" />
      <Skeleton className="h-[650px] w-full bg-[#e5e7eb] rounded-2xl" />
    </div>
  );
}