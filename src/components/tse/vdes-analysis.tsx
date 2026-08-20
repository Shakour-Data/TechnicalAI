'use client';

import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
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
  };
  supportStrengths: { price: number; strength: number; isTarget: boolean; fibRatio?: string; fibLabel?: string; score: number; grade: string; overlapCount: number; methods: string[] }[];
  resistanceStrengths: { price: number; strength: number; isTarget: boolean; fibRatio?: string; fibLabel?: string; score: number; grade: string; overlapCount: number; methods: string[] }[];
  priceTargets: { price: number; strength: number; isTarget: boolean; fibRatio?: string; fibLabel?: string }[];
  hasVolume?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// Constants — GRAY THEME
// ═══════════════════════════════════════════════════════════════════

const toFa = (n: number) => Math.round(n).toLocaleString('fa-IR');

const SCENARIO_KEYS = ['R1', 'R2', 'R3', 'R4', 'R5'] as const;

const SCENARIO_META: Record<string, { label: string; type: string; border: string; badgeBg: string; badgeColor: string }> = {
  R1: { label: 'تداوم صعود هیجانی', type: 'up', border: '#047857', badgeBg: 'rgba(4,120,87,0.1)', badgeColor: '#047857' },
  R2: { label: 'پولبک سالم', type: 'pullback', border: '#0e7490', badgeBg: 'rgba(14,116,144,0.1)', badgeColor: '#0e7490' },
  R3: { label: 'اصلاح کنترل‌شده', type: 'down', border: '#b45309', badgeBg: 'rgba(180,83,9,0.1)', badgeColor: '#b45309' },
  R4: { label: 'اصلاح عمیق', type: 'down', border: '#c2410c', badgeBg: 'rgba(194,65,12,0.1)', badgeColor: '#c2410c' },
  R5: { label: 'تضعیف ساختار', type: 'down', border: '#b91c1c', badgeBg: 'rgba(185,28,28,0.1)', badgeColor: '#b91c1c' },
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
  R1: { text: 'صعودی قوی — احتمال بالای عبور از مقاومت‌ها', tagCls: 'bg-emerald-700/10 text-emerald-700 border border-emerald-700/20' },
  R2: { text: 'صعود تدریجی — ورود در اصلاح توصیه می‌شود', tagCls: 'bg-cyan-700/10 text-cyan-700 border border-cyan-700/20' },
  R3: { text: 'بازار رنج — منتظر خروج از محدوده بمانید', tagCls: 'bg-amber-800/10 text-amber-800 border border-amber-800/20' },
  R4: { text: 'اصلاحی — احتیاط توصیه می‌شود', tagCls: 'bg-orange-700/10 text-orange-700 border border-orange-700/20' },
  R5: { text: 'نزولی قوی — خروج فوری توصیه می‌شود', tagCls: 'bg-red-700/10 text-red-700 border border-red-700/20' },
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
  } = ctx;

  const R1_info = resistanceStrengths[0];
  const S1_info = supportStrengths[0];
  const R1_grade = R1_info?.grade ? (GRADE_MAP[R1_info.grade]?.label ?? R1_info.grade) : '';
  const S1_grade = S1_info?.grade ? (GRADE_MAP[S1_info.grade]?.label ?? S1_info.grade) : '';
  const R1_methods = R1_info?.methods?.length ? ` با ${toPersianDigits(String(R1_info.methods.length))} روش تأیید شده` : '';
  const S1_methods = S1_info?.methods?.length ? ` با ${toPersianDigits(String(S1_info.methods.length))} روش تأیید شده` : '';

  const r1r2 = scenarios.R1.probability + scenarios.R2.probability;
  const r4r5 = scenarios.R4.probability + scenarios.R5.probability;
  const r3 = scenarios.R3.probability;
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
  if (highestKey === 'R1') {
    p2 = (
      <>
        <strong className="text-amber-800">تحلیل اسیلاتورها و مومنتوم — مومنتوم صعودی قوی:</strong>{' '}
        اندیکاتور RSI ({toFa(rsi)}) در ناحیه{' '}
        <b className={rsi > 70 ? 'text-red-700' : rsi < 30 ? 'text-emerald-700' : 'text-[#374151]'}>{rsiSignal}</b>
        {rsi > 70 && <span className="text-red-700"> — با این حال در فاز هیجانی صعودی، RSI بالا طبیعی بوده و لزوماً سیگنال فروش نیست.</span>}
        {' '}قرار دارد.
        {ctx.hasVolume && <span>MFI ({toFa(mfi)}) {mfi > 80 ? <span className="text-red-700">اشباع خرید را نشان می‌دهد اما تأیید ورود قوی پول را تأیید می‌کند</span> : mfi < 20 ? <span className="text-emerald-700">اشباع فروش را نشان می‌دهد</span> : <span>در محدوده عادی است</span>}.</span>}
        CCI ({toFa(cci)}) {cci > 100 ? <span className="text-emerald-700">بالاتر از +100 — قدرت خریداران بسیار بالا</span> : cci < -100 ? <span className="text-red-700">پایین‌تر از -100 (قدرت فروشندگان)</span> : <span>در محدوده عادی (-100 تا +100)</span>}.
        استوکاستیک (%K={toFa(stochK)}، %D={toFa(stochD)}) وضعیت <b>{stochSignal}</b> را نشان می‌دهد.
        MACD (خط={toFa(macdLine)}، سیگنال={toFa(macdSignal)}) با{' '}
        {macdBullish
          ? <span className="text-emerald-700">عبور خط اصلی بالای خط سیگنال — تأیید‌کننده مومنتوم صعودی قدرتمند</span>
          : <span className="text-red-700">خط اصلی زیر خط سیگنال — هشدار کاهش مومنتوم</span>}
        . هیستوگرام MACD ({toFa(macdHist)}) {macdHist > 0 ? <span className="text-emerald-700">مثبت و در حال گسترش</span> : <span className="text-red-700">منفی</span>}.
        در مجموع، اندیکاتورها {r1r2 > 60 ? 'پتانسیل بالای ادامه صعود' : 'مومنتوم صعودی با قدرت متوسط'} را تأیید می‌کنند.
      </>
    );
  } else if (highestKey === 'R2') {
    p2 = (
      <>
        <strong className="text-amber-800">تحلیل اسیلاتورها و مومنتوم — فرصت پولبک:</strong>{' '}
        اندیکاتور RSI ({toFa(rsi)}) در ناحیه <b className={rsi > 70 ? 'text-red-700' : rsi < 30 ? 'text-emerald-700' : 'text-[#374151]'}>{rsiSignal}</b> قرار دارد
        {rsi < 50 && rsi > 30 && <span> — این سطح ایده‌آل برای ورود در پولبک سالم محسوب می‌شود.</span>}.
        {ctx.hasVolume && <span>MFI ({toFa(mfi)}) {mfi > 80 ? <span className="text-red-700">اشباع خرید را نشان می‌دهد</span> : mfi < 20 ? <span className="text-emerald-700">اشباع فروش — فرصت ورود</span> : <span>در محدوده طبیعی برای پولبک</span>}.</span>}
        CCI ({toFa(cci)}) {cci > 100 ? <span>بالاتر از +100 — حرکت هنوز قوی است</span> : cci < -100 ? <span className="text-emerald-700">پایین‌تر از -100 — منطقه اشباع فروش و ورود جذاب</span> : <span>در محدوده عادی (-100 تا +100)</span>}.
        استوکاستیک (%K={toFa(stochK)}، %D={toFa(stochD)}) وضعیت <b>{stochSignal}</b>.
        MACD (خط={toFa(macdLine)}، سیگنال={toFa(macdSignal)}){' '}
        {macdBullish
          ? <span className="text-emerald-700">خط اصلی بالای سیگنال — ساختار صعودی حفظ شده</span>
          : <span className="text-amber-800">احتمال تقاطع نزولی — منتظر تأیید بازگشت بمانید</span>}.
        هیستوگرام MACD ({toFa(macdHist)}) {macdHist > 0 ? <span className="text-emerald-700">مثبت</span> : <span className="text-amber-800">در حال کاهش — احتیاط توصیه می‌شود</span>}.
        اندیکاتورها فرصت خرید در محدوده‌های حمایت را نشان می‌دهند.
      </>
    );
  } else if (highestKey === 'R3') {
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
  } else if (highestKey === 'R4') {
    p2 = (
      <>
        <strong className="text-amber-800">تحلیل اسیلاتورها و مومنتوم — هشدار اصلاح:</strong>{' '}
        اندیکاتور RSI ({toFa(rsi)}) در ناحیه <b className={rsi > 70 ? 'text-red-700' : rsi < 30 ? 'text-emerald-700' : 'text-[#374151]'}>{rsiSignal}</b> قرار دارد
        {rsi < 40 && <span> — روند نزولی RSI هشدار ادامه اصلاح است.</span>}.
        {ctx.hasVolume && <span>MFI ({toFa(mfi)}) {mfi > 80 ? <span className="text-red-700">اشباع خرید — واگرایی منفی محتمل</span> : mfi < 20 ? <span className="text-emerald-700">اشباع فروش شدید — احتمال بازگشت کوتاه‌مدت</span> : <span>در محدوده نزولی</span>}.</span>}
        CCI ({toFa(cci)}) {cci > 100 ? <span className="text-red-700">بالاتر از +100 — ممکن است واگرایی منفی باشد</span> : cci < -100 ? <span className="text-red-700">پایین‌تر از -100 — فشار فروش قوی</span> : <span>در محدوده عادی (-100 تا +100)</span>}.
        استوکاستیک (%K={toFa(stochK)}، %D={toFa(stochD)}) وضعیت <b>{stochSignal}</b>.
        MACD (خط={toFa(macdLine)}، سیگنال={toFa(macdSignal)}){' '}
        {macdBullish
          ? <span className="text-amber-800">صعودی اما در روند نزولی — سیگنال ضعیف</span>
          : <span className="text-red-700">تقاطع نزولی — تأیید‌کننده فشار فروش</span>}.
        هیستوگرام MACD ({toFa(macdHist)}) {macdHist > 0 ? <span className="text-amber-800">مثبت اما ضعیف</span> : <span className="text-red-700">منفی و در حال گسترش</span>}.
        در مجموع، اندیکاتورها هشدار اصلاح عمیق‌تر را صادر می‌کنند.
      </>
    );
  } else {
    // R5
    p2 = (
      <>
        <strong className="text-amber-800">تحلیل اسیلاتورها و مومنتوم — تضعیف شدید ساختار:</strong>{' '}
        اندیکاتور RSI ({toFa(rsi)}) در ناحیه <b className={rsi > 70 ? 'text-red-700' : rsi < 30 ? 'text-emerald-700' : 'text-[#374151]'}>{rsiSignal}</b> قرار دارد
        {rsi < 40 && <span> — سقوط RSI نشان‌دهنده فشار فروش سنگین است.</span>}.
        {ctx.hasVolume && <span>MFI ({toFa(mfi)}) {mfi > 80 ? <span className="text-red-700">اشباع خرید — واگرایی منفی خطرناک</span> : mfi < 20 ? <span className="text-red-700">اشباع فروش شدید — خروج پول گسترده</span> : <span>در حال کاهش — هشدار خروج پول</span>}.</span>}
        CCI ({toFa(cci)}) {cci > 100 ? <span className="text-red-700">بالاتر از +100 — واگرایی قطعی</span> : cci < -100 ? <span className="text-red-700">پایین‌تر از -100 — سقوط آزاد</span> : <span>در محدوده عادی اما رو به پایین</span>}.
        استوکاستیک (%K={toFa(stochK)}، %D={toFa(stochD)}) وضعیت <b>{stochSignal}</b>.
        MACD (خط={toFa(macdLine)}، سیگنال={toFa(macdSignal)}){' '}
        {macdBullish
          ? <span className="text-amber-800">صعودی موقت — در ساختار نزولی قابل اعتماد نیست</span>
          : <span className="text-red-700">تقاطع نزولی عمیق — سیگنال خروج فوری</span>}.
        هیستوگرام MACD ({toFa(macdHist)}) {macdHist > 0 ? <span className="text-amber-800">مثبت موقت</span> : <span className="text-red-700">منفی و تشدید شونده</span>}.
        تمام اندیکاتورها تضعیف ساختاری و هشدار خروج سرمایه را تأیید می‌کنند.
      </>
    );
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
      {highestKey === 'R1' && ' فاصله قیمت از باند بالایی نشان‌دهنده شتاب صعودی است.'}
      {highestKey === 'R4' || highestKey === 'R5' ? ' نزدیکی به باند پایینی هشدار ادامه فشار نزولی است.' : ''}
      {highestKey === 'R3' && ' نوسان در محدوده باندها تأییدکننده فاز رنج بازار است.'}
    </>
  );

  // ── PARAGRAPH 4: Volume & OBV Analysis (scenario-aware) — HIDDEN when no volume ──
  const p4 = ctx.hasVolume ? (
    <>
      <strong className="text-amber-800">تحلیل حجم معاملات و شاخص OBV:</strong>{' '}
      شاخص جریان ورودی پول (OBV) در سطح <b className="text-[#111827]">{obv > 0 ? '+' : ''}{toPersianDigits((obv / 1e6).toFixed(1))}M</b> قرار دارد
      {obv > 0
        ? <span> که <b className="text-emerald-700">تجمع مثبت حجم</b> را نشان می‌دهد و حاکی از ورود پول هوشمند و تقویت روند صعودی است.
          {highestKey === 'R1' || highestKey === 'R2' ? ' این حجم مثبت تأیید‌کننده سناریوی صعودی است.' : ''}
          {highestKey === 'R3' ? ' اما در فاز رنج، حجم مثبت الزاماً سیگنال صعودی نیست.' : ''}
          {highestKey === 'R4' || highestKey === 'R5' ? ' اما با وجود حجم مثبت، ساختار قیمت ضعیف است — این تناقض قابل توجه است.' : ''}
        </span>
        : <span> که <b className="text-red-700">خروج پول</b> را نشان می‌دهد و می‌تواند نشانه ضعف خریداران و احتمال ادامه اصلاح باشد.
          {highestKey === 'R1' || highestKey === 'R2' ? ' خروج پول با سناریوی صعودی در تضاد است — احتیاط توصیه می‌شود.' : ''}
          {highestKey === 'R3' ? ' خروج پول در فاز رنج معمولاً پیش‌نشاننده شکست به سمت پایین است.' : ''}
          {highestKey === 'R4' || highestKey === 'R5' ? ' این خروج پول تأیید‌کننده سناریوی نزولی و ضرورت حفظ سرمایه است.' : ''}
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
  if (highestKey === 'R1') {
    p5 = (
      <>
        <strong className="text-amber-800">تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        با احتمال {toFa(highestProb)}٪ برای سناریوی {dominant}، اکثر شاخص‌ها <b className="text-emerald-700">الگوی صعودی قدرتمند</b> را تأیید می‌کنند.
        {r1r2 > 60 && <span> ترکیب احتمال صعودی {toFa(r1r2)}٪ نشان‌دهنده <b className="text-emerald-700">بایاس صعودی قوی</b> در بازار است.</span>}
        نسبت ریسک به بازده با حد ضرر در حمایت {toFa(S1)} و هدف {toFa(R1)} ریال، حدود <b className="text-emerald-700">{toPersianDigits(((R1 - currentPrice) / (currentPrice - S1)).toFixed(1))}:۱</b> محاسبه می‌شود.
        تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-amber-800">بسیار نزدیک به هم — تقاطع طلایی احتمالی</span>
          : ma21 > ma100
          ? <span className="text-emerald-700">به نفع صعودی (MA21 بالاتر از MA100)</span>
          : <span className="text-red-700">به نفع نزولی (MA21 پایین‌تر از MA100)</span>}
        {' '}است. توصیه: در صورت شکست مقاومت {toFa(R1)}، هدف بعدی {toFa(R2)} ریال تعیین می‌شود.
      </>
    );
  } else if (highestKey === 'R2') {
    p5 = (
      <>
        <strong className="text-amber-800">تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        سناریوی {dominant} با احتمال {toFa(highestProb)}٪ نشان‌دهنده <b className="text-emerald-700">فرصت خرید در اصلاح</b> است.
        {r1r2 > 60 && <span> مجموع احتمال صعودی {toFa(r1r2)}٪ — بایاس کلی مثبت است.</span>}
        بهترین نقطه ورود، محدوده بین MA21 ({toFa(ma21)}) و حمایت {toFa(S1)} ریال می‌باشد.
        نسبت ریسک به بازده با حد ضرر زیر {toFa(S1)} و هدف {toFa(R1)} ریال، حدود <b className="text-emerald-700">{toPersianDigits(((R1 - currentPrice) / (currentPrice - S1)).toFixed(1))}:۱</b> محاسبه می‌شود.
        تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-amber-800">نزدیک به هم — پایش تقاطع ضروری</span>
          : ma21 > ma100
          ? <span className="text-emerald-700">به نفع صعودی (MA21 بالاتر از MA100) — تأیید‌کننده پولبک سالم</span>
          : <span className="text-red-700">به نفع نزولی (MA21 پایین‌تر از MA100) — هشدار تغییر ساختار</span>}
        {' '}. صبر و ورود پله‌ای توصیه می‌شود.
      </>
    );
  } else if (highestKey === 'R3') {
    p5 = (
      <>
        <strong className="text-amber-800">تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        سناریوی {dominant} با احتمال {toFa(highestProb)}٪ نشان‌دهنده <b className="text-amber-800">بازار رنج و بدون جهت مشخص</b> است.
        {r3 > 40 && <span> با {toFa(r3)}٪ احتمال رنج، ورود به معامله <b className="text-amber-800">ریسک بالایی</b> دارد.</span>}
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
  } else if (highestKey === 'R4') {
    p5 = (
      <>
        <strong className="text-amber-800">تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        سناریوی {dominant} با احتمال {toFa(highestProb)}٪ نشان‌دهنده <b className="text-red-700">ریسک اصلاح عمیق</b> است.
        {r4r5 > 60 && <span> مجموع احتمال نزولی {toFa(r4r5)}٪ — <b className="text-red-700">بایاس نزولی قوی</b> در بازار حاکم است.</span>}
        ورود به معامله خرید در این شرایط <b className="text-red-700">ریسک بالایی</b> دارد.
        تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-red-700">نزدیک به هم — احتمال تقاطع مرگ</span>
          : ma21 > ma100
          ? <span className="text-amber-800">به نفع صعودی اما در حال ضعیف شدن</span>
          : <span className="text-red-700">به نفع نزولی — تأیید‌کننده فشار فروش</span>}
        {' '}. توصیه: احتیاط و انتظار برای بازگشت به محدوده حمایت {toFa(S1)} ریال.
      </>
    );
  } else {
    // R5
    p5 = (
      <>
        <strong className="text-amber-800">تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        سناریوی {dominant} با احتمال {toFa(highestProb)}٪ نشان‌دهنده <b className="text-red-700">تضعیف شدید ساختار</b> است.
        {r4r5 > 60 && <span> مجموع احتمال نزولی {toFa(r4r5)}٪ — <b className="text-red-700">بایاس نزولی بسیار قوی</b> حاکم است.</span>}
        تمام شاخص‌ها هشدار <b className="text-red-700">خروج فوری</b> را صادر می‌کنند.
        تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-red-700">تقاطع مرگ در حال تکوین</span>
          : ma21 > ma100
          ? <span className="text-amber-800">MA21 هنوز بالاتر اما به سرعت در حال نزدیک شدن</span>
          : <span className="text-red-700">MA21 زیر MA100 — تأیید نهایی ساختار نزولی</span>}
        {' '}. حفظ سرمایه اولویت اول است. از هرگونه موقعیت خرید جدید خودداری کنید.
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
  // chartRef removed — chart lives in page.tsx (v3.0)

  const R1_level = resistances[0] ?? currentPrice * 1.05;
  const R2_level = resistances[1] ?? currentPrice * 1.10;
  const S1_level = supports[0] ?? currentPrice * 0.95;
  const S2_level = supports[1] ?? currentPrice * 0.90;
  const S3_level = supports[2] ?? currentPrice * 0.85;

  const targetMin = Math.round(R1_level + (R2_level - R1_level) * 0.5);
  const targetMax = Math.round(R2_level + (R2_level - R1_level) * 0.8);

  // ── Dominant scenario ──────────────────────────────────────────
  let highestKey = 'R3';
  let highestProb = 0;
  for (const key of SCENARIO_KEYS) {
    if (scenarios[key].probability > highestProb) {
      highestProb = scenarios[key].probability;
      highestKey = key;
    }
  }
  const strategy = STRATEGY_MAP[highestKey];
  const totalProb = SCENARIO_KEYS.reduce((sum, k) => sum + scenarios[k].probability, 0);

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
  // chartJalaliDate removed — chart lives in page.tsx (v3.0)

  // tvScenarios removed — chart lives in page.tsx (v3.0)

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
    });
  }, [
    symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx,
    stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, obv,
    bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal,
    highestKey, highestProb, scenarios,
    S1_level, R1_level, R2_level, hasVolume,
    resistanceStrengths, supportStrengths,
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

  // ── AI Analysis Text ───────────────────────────────────────
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiML, setAiML] = useState<{ school: string; style: string; tone: string; methods: string[] } | null>(null);

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
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.text) {
          setAiText(data.text);
          if (data.ml) setAiML(data.ml);
        }
        else if (data.error) setAiError(data.error);
      } catch (err) {
        if (!cancelled) setAiError(String(err));
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx, stochK, stochD, macdLine, macdSignal, macdHist, diPlus, diMinus, sar, atr, obv, bollingerUpper, bollingerMiddle, bollingerLower, trendDirection, trendAngle, trendR2, scenarios, hasVolume, resistanceStrengths, supportStrengths]);

  // ── File name helper ───────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const fileBase = `${symbolName}_تحلیل_${today}`;

  // ── Per-day indicators for CSV/Excel ──────────────────────────
  const dailyIndicators = useMemo(() => computeDailyIndicators(candles), [candles]);

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
.scenario-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 12px; }
.scenario-card { border: 1px solid #e5e7eb; border-top: 3px solid; border-radius: 8px; padding: 12px; text-align: center; background: #f3f4f6; }
.scenario-card .prob { font-size: 22px; font-weight: 900; margin: 6px 0; }
.scenario-card .range { font-size: 10px; color: #6b7280; }
.bar-bg { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin: 8px 0; }
.bar-fill { height: 100%; border-radius: 3px; }
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
<h1>📈 تحلیل تکنیکال ${symbolName}</h1>
<div style="margin-top:8px">
<span class="badge">📍 قیمت مرجع: <strong>${toFa(currentPrice)} ریال</strong></span>
<span class="badge">🎯 هدف کوتاه‌مدت: <strong>${toFa(targetMin)} — ${toFa(targetMax)} ریال</strong></span>
<span class="badge">📊 روند: <strong>${trendText}</strong></span>
<span class="badge">RSI: ${toFa(rsi)} (${rsiSignal})</span>
</div>
${lastCandleJalali ? `<div style="font-size:11px;color:#6b7280;margin-top:8px">📅 ${lastCandleJalali}</div>` : ''}
</div>

<div class="section">
<h2>🧠 تحلیل جامع روند و اندیکاتورها</h2>
<div>${vdesRef.current.querySelector('.vdes-analysis-text')?.innerHTML || '<p>تحلیل در دسترس نیست</p>'}</div>
</div>

<div class="section">
<h2>🏛️ احتمالات سناریوها</h2>
<div class="scenario-grid">
${SCENARIO_KEYS.map(k => {
  const s = scenarios[k];
  const m = SCENARIO_META[k];
  return `<div class="scenario-card" style="border-top-color:${m.border}">
    <div style="display:flex;justify-content:space-between"><strong style="color:${m.badgeColor}">${k}</strong><span style="font-size:10px;color:#6b7280">${m.label}</span></div>
    <div class="prob" style="color:${m.badgeColor}">${toFa(s.probability)}٪</div>
    <div class="bar-bg"><div class="bar-fill" style="width:${s.probability}%;background:${m.border}"></div></div>
    <div class="range">${toFa(s.targetMin)} — ${toFa(s.targetMax)} ریال</div>
  </div>`;
}).join('')}
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
  }, [symbolName, currentPrice, targetMin, targetMax, trendText, rsi, rsiSignal, scenarios, totalProb, strategy, lastCandleJalali, fileBase]);

  const exportText = useCallback(() => {
    const lines: string[] = [];
    lines.push(`تحلیل تکنیکال ${symbolName} — توضیح‌دهنده تصویری`);
    if (lastCandleJalali) lines.push(`تاریخ: ${lastCandleJalali}`);
    lines.push('');
    lines.push(`قیمت مرجع: ${toFa(currentPrice)} ریال`);
    lines.push(`هدف کوتاه‌مدت: ${toFa(targetMin)} — ${toFa(targetMax)} ریال`);
    lines.push(`روند: ${trendText}`);
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
      const m = SCENARIO_META[k];
      lines.push(`${k} — ${m.label}: ${toFa(s.probability)}٪ | هدف: ${toFa(s.targetMin)} — ${toFa(s.targetMax)} ریال`);
    }
    lines.push('');
    lines.push(`سیگنال غالب: ${strategy.text}`);
    const text = lines.join('\n');
    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${fileBase}.txt`);
  }, [symbolName, currentPrice, targetMin, targetMax, trendText, rsi, rsiSignal, scenarios, strategy, lastCandleJalali, fileBase]);

  const exportPDF = useCallback(async () => {
    if (!vdesRef.current) return;
    try {
      const dataUrl = await toPng(vdesRef.current, { backgroundColor: '#f3f4f6', pixelRatio: 2 });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (vdesRef.current.offsetHeight * imgWidth) / vdesRef.current.offsetWidth;
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
    } catch {
      // Fallback: try to capture what we can
      console.warn('PDF export failed for full VDes capture');
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
      'کد': k,
      'احتمال٪': scenarios[k].probability,
      'هدف_حداقل': Math.round(scenarios[k].targetMin),
      'هدف_حداکثر': Math.round(scenarios[k].targetMax),
    }));
    const ws2 = XLSX.utils.json_to_sheet(scenarioRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'سناریوها');
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
  }, [dailyIndicators, scenarios, fileBase]);

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
    if (!chartEl) return;
    try {
      const dataUrl = await toPng(chartEl, { backgroundColor: '#ffffff', pixelRatio: 2 });
      saveAs(dataUrl, `${fileBase}_نمودار.png`);
    } catch (err) {
      console.warn('Chart image export failed:', err);
    }
  }, [fileBase]);

  return (
    <div ref={vdesRef} className="space-y-5" dir="rtl">
      {/* ═══ HEADER ═══ */}
      <div className="rounded-2xl px-6 py-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-amber-800">
            📈 تحلیل تکنیکال {symbolName}
          </h1>
          {lastCandleJalali && (
            <span className="text-xs text-[#6b7280]">📅 {lastCandleJalali}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="px-3.5 py-1 rounded-full border border-[#e5e7eb] bg-[#f3f4f6] text-xs text-[#374151]">
            📍 قیمت مرجع: <b className="text-[#111827]">{toFa(currentPrice)} ریال</b>
          </span>
          <span className="px-3.5 py-1 rounded-full border border-[#e5e7eb] bg-[#f3f4f6] text-xs text-[#374151]">
            🎯 هدف کوتاه‌مدت: <b className="text-[#111827]">{toFa(targetMin)} — {toFa(targetMax)} ریال</b>
          </span>
          <span className="px-3.5 py-1 rounded-full border border-[#e5e7eb] bg-[#f3f4f6] text-xs text-[#374151]">
            📊 روند: <b className="text-[#111827]">{trendText}</b>
          </span>
          <span className={`px-3.5 py-1 rounded-full border text-xs font-medium ${
            rsi > 70 ? 'bg-red-700/10 text-red-700 border-red-700/20'
            : rsi < 30 ? 'bg-emerald-700/10 text-emerald-700 border-emerald-700/20'
            : 'bg-amber-800/10 text-amber-800 border-amber-800/20'
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
        <div className="rounded-2xl border border-red-700/15 overflow-hidden bg-[#ffffff] shadow-sm">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-red-700/10 bg-red-50">
            <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
            <h3 className="text-sm font-bold text-red-700">سطوح مقاومت</h3>
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
                  {r.isTarget && <span className="text-[10px]">🎯</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Supports ── */}
        <div className="rounded-2xl border border-emerald-700/15 overflow-hidden bg-[#ffffff] shadow-sm">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-emerald-700/10 bg-emerald-50">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <h3 className="text-sm font-bold text-emerald-700">سطوح حمایت</h3>
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
                  {s.isTarget && <span className="text-[10px]">🎯</span>}
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
                  <span className="text-[10px]">🎯</span>
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

      {/* ═══ AI ANALYSIS TEXT ═══ */}
      <div className="rounded-2xl p-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
        <h2 className="text-sm font-semibold mb-3 text-amber-800 flex items-center gap-2">
          <span>🧠</span>
          تحلیل هوشمند بازار
        </h2>
        {/* ML Selection Badges */}
        {aiML && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              مکتب: {aiML.school.split('(')[0].trim()}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
              سبک: {aiML.style}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
              لحن: {aiML.tone}
            </span>
            {aiML.methods && aiML.methods.length > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200">
                روش‌ها: {aiML.methods.slice(0, 3).join(' | ')}
              </span>
            )}
          </div>
        )}
        <div className="vdes-analysis-text">
          {aiLoading && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-700 rounded-full animate-spin" />
              <span className="text-sm text-amber-800">در حال تولید تحلیل هوشمند ...</span>
            </div>
          )}
          {aiError && (
            <div className="rounded-xl p-4 bg-red-50 border border-red-200">
              <p className="text-xs text-red-700 mb-2">خطا در تولید تحلیل هوشمند. تحلیل آماری جایگزین نمایش داده می‌شود:</p>
              <p className="text-xs text-red-600">{aiError}</p>
            </div>
          )}
          {!aiLoading && aiText && (
            <div className="text-sm text-[#374151] leading-[1.85] whitespace-pre-line space-y-3">
              {aiText.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
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

      {/* ═══ SCENARIO PROBABILITIES ═══ */}
      <div className="rounded-2xl p-5 border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
        <h2 className="text-sm font-semibold mb-4 text-amber-800 flex items-center gap-2">
          <span>🏛️</span>
          احتمالات سناریوها
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {SCENARIO_KEYS.map(key => {
            const s = scenarios[key];
            const meta = SCENARIO_META[key];
            return (
              <div
                key={key}
                className="rounded-xl p-3.5 bg-[#f3f4f6]/60 border border-[#e5e7eb]"
                style={{ borderTop: `3px solid ${meta.border}` }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold" style={{ color: meta.badgeColor }}>{key}</span>
                  <span className="text-[10px] text-[#6b7280]">{meta.label}</span>
                </div>
                <div className="text-center my-2">
                  <span
                    className="inline-block text-2xl font-black tabular-nums"
                    style={{ color: meta.badgeColor }}
                  >
                    {toFa(s.probability)}٪
                  </span>
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