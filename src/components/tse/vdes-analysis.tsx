'use client';

import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { computeV11Probabilities, type V11Result } from '@/lib/ml-narrative-v11';
// Chart is rendered in page.tsx with id="chart-export-wrapper"
// Heavy export libs (jspdf, html-to-image, xlsx, file-saver) are loaded lazily via dynamic import
// to avoid ChunkLoadError on low-memory environments with Turbopack.

function nativeSaveAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}
import { smartJalaliDate, fullPersianDate, toPersianDigits, candleDateToJalali, isGregorianDate, formatJalaliString } from '@/lib/jalali';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  Network,
} from 'lucide-react';
import { computeDailyIndicators } from '@/lib/indicator-arrays';
import { formatPriceFa } from '@/lib/format-price';
import { useTheme } from '@/lib/theme-store';

function renderAIText(text: string): string {
  // Remove CJK (Chinese/Japanese/Korean) characters — prohibited in output
  const noCjk = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\uff00-\uffef]/g, '');

  // Normalize zero-width BOM and look-alike characters that may interfere with regex
  // but PRESERVE ZWNJ (\u200C) which is essential for Persian compound words
  const normalized = noCjk.replace(/[\u200d\u200b\ufeff]/g, '');

  // Color syntax: {color:hex}text{/color} or {color:named}text{/color} → <span>
  const colorMap: Record<string, string> = {
    'red': '#dc2626', 'red-600': '#dc2626', 'red-700': '#b91c1c',
    'green': '#16a34a', 'emerald': '#059669', 'emerald-600': '#059669', 'emerald-700': '#047857',
    'amber': '#d97706', 'amber-600': '#d97706', 'amber-700': '#b45309', 'amber-800': '#92400e',
    'blue': '#2563eb', 'blue-600': '#2563eb', 'blue-700': '#1d4ed8',
    'orange': '#ea580c',
    'purple': '#9333ea', 'purple-600': '#9333ea', 'purple-700': '#7e22ce',
  };

  const processInline = (raw: string) => {
    let html = raw;
    html = html.replace(/\{color:([^}]+)\}([\s\S]*?)\{\/color\}/g, (_match, colorName: string, inner: string) => {
      const hex = colorMap[colorName.trim()] || (colorName.startsWith('#') ? colorName : null);
      if (!hex) return inner; // Unknown color: just return text without color
      return `<span style="color:${hex};font-weight:700">${inner}</span>`;
    });
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
    return html;
  };

  // Process line by line to detect headings
  const lines = normalized.split('\n');
  const htmlParts: string[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const content = currentParagraph.join('<br>');
      htmlParts.push(`<p class="mb-3" style="line-height:2.2">${content}</p>`);
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // ## Main heading
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      htmlParts.push(`<h2 class="mb-2 pb-1" style="font-size:16px;font-weight:800;border-bottom:1px solid #e5e7eb">${processInline(trimmed.slice(3))}</h2>`);
      continue;
    }
    // ### Section heading
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      htmlParts.push(`<h3 class="mt-3 mb-1" style="font-size:14px;font-weight:700">${processInline(trimmed.slice(4))}</h3>`);
      continue;
    }

    // Empty line = paragraph break
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    // Regular line — accumulate into current paragraph
    currentParagraph.push(processInline(trimmed));
  }
  flushParagraph();

  return htmlParts.join('');
}

// Helper: format price in compact form for cache indicator
function formatPriceShort(price: number): string {
  if (!price || !isFinite(price)) return '—';
  return price.toLocaleString('fa-IR', { maximumFractionDigits: 0 });
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
    SC1: Scenario;
    SC2: Scenario;
    SC3: Scenario;
    SC4: Scenario;
    SC5: Scenario;
    SC6: Scenario;
    SC7: Scenario;
    SC8: Scenario;
    SC9: Scenario;
  };
  supportStrengths: { price: number; strength: number; isTarget: boolean; fibRatio?: string; fibLabel?: string; score: number; grade: string; overlapCount: number; methods: string[] }[];
  resistanceStrengths: { price: number; strength: number; isTarget: boolean; fibRatio?: string; fibLabel?: string; score: number; grade: string; overlapCount: number; methods: string[] }[];
  priceTargets: { price: number; strength: number; isTarget: boolean; fibRatio?: string; fibLabel?: string }[];
  hasVolume?: boolean;
  instrumentType?: string;
  instrumentCategory?: string;
  currencyUnit?: string;
  priceDecimals?: number;
  probabilityTrend?: {
    scenarios: { scenarioKey: string; label: string; group: string; currentProbability: number; trendDirection: string; trend: { individualProb: number; cumulativeProb: number }[] }[];
    groups: { group: string; label: string; trendDirection: string; trend: { individualProb: number; cumulativeProb: number }[] }[];
  };
  decisionGraph?: {
    nodes: { id: string; title: string; titleEn: string; type: string; desc: string; color: string; branch?: string; isTerminal?: boolean }[];
    edges: { from: string; to: string; label: string; type: string }[];
    nodePositions: Record<string, { right: number; top: number }>;
    edgeProbabilities: Record<number, number>;
    nodeValues: Record<string, string>;
    branchProbabilities: { trend: number; breakout: number; reversal: number };
    scenarioProbabilities: Record<string, number>;
    pathContributions: Record<string, { trend: number; breakout: number; reversal: number }>;
  };
  // Regime detection result (from regime-engine.ts: rule-based + Markov + weighted voting)
  regimeResult?: {
    regime: string;
    confidence: number;
    memberships: Record<string, number>;
    description: string;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const SCENARIO_KEYS = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5', 'SC6', 'SC7', 'SC8', 'SC9'] as const;

type ScenarioKey = (typeof SCENARIO_KEYS)[number];

const SCENARIO_NUMBER: Record<string, string> = {
  SC1: '\u06f1', SC2: '\u06f2', SC3: '\u06f3', SC4: '\u06f4', SC5: '\u06f5',
  SC6: '\u06f6', SC7: '\u06f7', SC8: '\u06f8', SC9: '\u06f9',
};

// Convention: SC1-SC4=bearish, SC5=neutral, SC6-SC9=bullish (matches decision-graph.ts & ta-engine.ts)
const SCENARIO_META: Record<string, { label: string; type: string; border: string; badgeBg: string; badgeColor: string }> = {
  SC1: { label: '\u0634\u0648\u06a9 \u0646\u0632\u0648\u0644\u06cc', type: 'down', border: '#b91c1c', badgeBg: 'rgba(185,28,28,0.1)', badgeColor: '#b91c1c' },
  SC2: { label: '\u0646\u0632\u0648\u0644\u06cc \u0634\u062a\u0627\u0628\u200c\u062f\u0627\u0631', type: 'down', border: '#dc2626', badgeBg: 'rgba(220,38,38,0.1)', badgeColor: '#dc2626' },
  SC3: { label: '\u0646\u0632\u0648\u0644\u06cc \u0642\u0648\u06cc', type: 'down', border: '#ea580c', badgeBg: 'rgba(234,88,12,0.1)', badgeColor: '#ea580c' },
  SC4: { label: '\u0646\u0632\u0648\u0644\u06cc \u062e\u0641\u06cc\u0641', type: 'down', border: '#c2410c', badgeBg: 'rgba(194,65,12,0.1)', badgeColor: '#c2410c' },
  SC5: { label: '\u0631\u0646\u062c', type: 'neutral', border: '#b45309', badgeBg: 'rgba(180,83,9,0.1)', badgeColor: '#b45309' },
  SC6: { label: '\u0635\u0639\u0648\u062f\u06cc \u062e\u0641\u06cc\u0641', type: 'up', border: '#047857', badgeBg: 'rgba(4,120,87,0.1)', badgeColor: '#047857' },
  SC7: { label: '\u0635\u0639\u0648\u062f\u06cc \u0642\u0648\u06cc', type: 'up', border: '#059669', badgeBg: 'rgba(5,150,105,0.1)', badgeColor: '#059669' },
  SC8: { label: '\u0635\u0639\u0648\u062f\u06cc \u0634\u062a\u0627\u0628\u062f\u0627\u0631', type: 'up', border: '#0e7490', badgeBg: 'rgba(14,116,144,0.1)', badgeColor: '#0e7490' },
  SC9: { label: '\u0634\u0648\u06a9 \u0635\u0639\u0648\u062f\u06cc', type: 'up', border: '#0891b2', badgeBg: 'rgba(8,145,178,0.1)', badgeColor: '#0891b2' },
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
  SC1: { text: 'SC1: شوک نزولی — خروج فوری توصیه می‌شود', tagCls: 'bg-red-700/10 text-red-700 border border-red-700/20' },
  SC2: { text: 'SC2: نزولی شتاب‌دار — خروج از موقعیت‌های خرید', tagCls: 'bg-red-600/10 text-red-600 border border-red-600/20' },
  SC3: { text: 'SC3: نزولی قوی — کاهش موقعیت توصیه می‌شود', tagCls: 'bg-orange-600/10 text-orange-600 border border-orange-600/20' },
  SC4: { text: 'SC4: نزولی خفیف — احتیاط توصیه می‌شود', tagCls: 'bg-orange-700/10 text-orange-700 border border-orange-700/20' },
  SC5: { text: 'SC5: رنج — منتظر خروج از محدوده بمانید', tagCls: 'bg-amber-800/10 text-amber-800 border border-amber-800/20' },
  SC6: { text: 'SC6: صعودی خفیف — ورود تدریجی توصیه می‌شود', tagCls: 'bg-emerald-700/10 text-emerald-700 border border-emerald-700/20' },
  SC7: { text: 'SC7: صعودی قوی — مومنتوم بالا، مدیریت ریسک ضروری', tagCls: 'bg-teal-700/10 text-teal-700 border border-teal-700/20' },
  SC8: { text: 'SC8: صعودی شتاب‌دار — احتمال بالای عبور از مقاومت‌ها', tagCls: 'bg-emerald-600/10 text-emerald-600 border border-emerald-600/20' },
  SC9: { text: 'SC9: شوک صعودی — حرکت انفجاری احتمالی', tagCls: 'bg-cyan-700/10 text-cyan-700 border border-cyan-700/20' },
};

const RISK_PROFILE_LABELS: Record<V11Result['riskProfile'], { label: string; color: string; bg: string }> = {
  very_bullish: { label: 'صعودی بسیار قوی', color: '#047857', bg: 'rgba(4,120,87,0.08)' },
  bullish: { label: 'صعودی', color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  neutral: { label: 'خنثی', color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
  bearish: { label: 'نزولی', color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
  very_bearish: { label: 'نزولی بسیار قوی', color: '#b91c1c', bg: 'rgba(185,28,28,0.08)' },
};

// ═══════════════════════════════════════════════════════════════════
// Instrument Category → Persian Terms Mapping
// ═══════════════════════════════════════════════════════════════════

function getInstrumentTerms(category?: string): { noun: string; typeLabel: string; priceAction: string; tradeAction: string } {
  switch (category) {
    case 'currency': return { noun: 'ارز', typeLabel: 'ارز', priceAction: 'نرخ', tradeAction: 'معامله' };
    case 'gold': return { noun: 'طلا و سکه', typeLabel: 'طلا و سکه', priceAction: 'قیمت', tradeAction: 'معامله' };
    case 'silver': return { noun: 'نقره', typeLabel: 'نقره', priceAction: 'قیمت', tradeAction: 'معامله' };
    case 'gold_etf': return { noun: 'صندوق طلای بورس', typeLabel: 'صندوق طلا', priceAction: 'قیمت', tradeAction: 'معامله' };
    case 'crypto': return { noun: 'ارز دیجیتال', typeLabel: 'ارز دیجیتال', priceAction: 'قیمت', tradeAction: 'معامله' };
    case 'forex': return { noun: 'جفت ارز', typeLabel: 'جفت ارز', priceAction: 'نرخ', tradeAction: 'معامله' };
    case 'world_index': return { noun: 'شاخص بورس جهانی', typeLabel: 'شاخص جهانی', priceAction: 'مقدار', tradeAction: 'سرمایه‌گذاری' };
    case 'foreign_stock': return { noun: 'سهام خارجی', typeLabel: 'سهام خارجی', priceAction: 'قیمت', tradeAction: 'معامله' };
    case 'energy': return { noun: 'کامودیتی انرژی', typeLabel: 'انرژی', priceAction: 'قیمت', tradeAction: 'معامله' };
    case 'metal': return { noun: 'فلز جهانی', typeLabel: 'فلز', priceAction: 'قیمت', tradeAction: 'معامله' };
    case 'commodity': return { noun: 'کالای جهانی', typeLabel: 'کالا', priceAction: 'قیمت', tradeAction: 'معامله' };
    case 'index': return { noun: 'شاخص بورس', typeLabel: 'شاخص', priceAction: 'مقدار', tradeAction: 'سرمایه‌گذاری' };
    default: return { noun: 'سهم', typeLabel: 'سهم', priceAction: 'قیمت', tradeAction: 'معامله' };
  }
}

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
  SC1: number;
  SC2: number;
  hasVolume: boolean;
  resistanceStrengths: LevelStrength[];
  supportStrengths: LevelStrength[];
  v11Result: V11Result;
  instrumentType?: string;
  instrumentCategory?: string;
  currencyUnit?: string;
  priceDecimals?: number;
  regimeResult?: VdesAnalysisProps['regimeResult'];
  probabilityTrend?: VdesAnalysisProps['probabilityTrend'];
  decisionGraph?: VdesAnalysisProps['decisionGraph'];
}

function generateAnalysisText(ctx: AnalysisContext) {
  const {
    symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx,
    stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, obv,
    bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal,
    highestKey, highestProb, scenarios, S1, SC1: R1, SC2: R2,
    hasVolume, resistanceStrengths, supportStrengths,
    v11Result, currencyUnit: ctxCurrencyUnit,
    instrumentCategory, priceDecimals: ctxPriceDecimals,
    regimeResult, probabilityTrend, decisionGraph,
  } = ctx;
  const unit = ctxCurrencyUnit || 'ریال';
  // Dynamic price formatter using data-source-derived decimals
  const toFa = (n: number) => formatPriceFa(n, ctxPriceDecimals ?? 0);
  const terms = getInstrumentTerms(instrumentCategory);

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
  // Trend angle description: classify angle qualitatively
  // New scale: 1% daily rise ≈ 45°, 0.5% ≈ 27°, 0.2% ≈ 11°, 0.05% ≈ 3°
  const absAngle = Math.abs(trendAngle);
  const angleDesc = absAngle < 3
    ? 'تقریباً صفر'
    : absAngle < 11 ? 'ملایم'
    : absAngle < 27 ? 'متوسط'
    : absAngle < 45 ? 'تند'
    : 'بسیار تند';
  const r2Str = toPersianDigits((trendR2 * 100).toFixed(1));
  const trendText = trendDirection === 'up'
    ? absAngle < 3
      ? `صعودی با شیب بسیار ملایم و ضریب تعیین R²=${r2Str}٪`
      : `صعودی با زاویه ${toFa(absAngle)} درجه (شیب ${angleDesc}) و ضریب تعیین R²=${r2Str}٪`
    : trendDirection === 'down'
    ? absAngle < 3
      ? `نزولی با شیب بسیار ملایم و ضریب تعیین R²=${r2Str}٪`
      : `نزولی با زاویه ${toFa(absAngle)} درجه (شیب ${angleDesc}) و ضریب تعیین R²=${r2Str}٪`
    : 'خنثی و بدون جهت مشخص';

  const trendLabel = trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی';
  const trendColor = trendDirection === 'up' ? 'text-emerald-700' : trendDirection === 'down' ? 'text-red-700' : 'text-amber-800';
  const aboveBelow = (price: number, target: number) => price > target ? 'بالاتر' : 'پایین‌تر';
  const abColor = (price: number, target: number) => price > target ? 'text-emerald-700' : 'text-red-700';

  const adxText = adx > 40 ? 'روند قدرتمند' : adx > 25 ? 'روند متوسط' : 'روند ضعیف یا رنج';
  const adxColor = adx > 40 ? 'text-emerald-700' : adx > 25 ? 'text-amber-800' : 'text-[#6b7280]';

  // Helper: is bullish scenario?
  const isBull = (k: string) => ['SC6','SC7','SC8','SC9'].includes(k);
  const isBear = (k: string) => ['SC1','SC2','SC3','SC4'].includes(k);

  // ── PARAGRAPH 1: General Trend & Price Position ──
  const p1 = (
    <>
      <strong className="text-amber-800">روند کلی و موقعیت قیمت:</strong>{' '}
      سناریوی غالب برای {terms.noun} {symbolName} <b className="text-[#111827]">{highestKey} — {dominant}</b> با احتمال <b className="text-[#111827]">{toFa(highestProb)}٪</b> می‌باشد.
      {terms.priceAction} در محدوده <b className="text-[#111827]">{toFa(currentPrice)} {unit}</b> معامله می‌شود و روند میان‌مدت{' '}
      <b className={trendColor}>{trendLabel}</b>
      {' '}است (زاویه {toFa(Math.abs(trendAngle))}°، R²={toPersianDigits((trendR2 * 100).toFixed(1))}٪).
      قیمت نسبت به MA21 ({toFa(ma21)} {unit}){' '}
      <span className={abColor(currentPrice, ma21)}>{aboveBelow(currentPrice, ma21)}</span>
      {' '}و نسبت به MA100 ({toFa(ma100)} {unit}){' '}
      <span className={abColor(currentPrice, ma100)}>{aboveBelow(currentPrice, ma100)}</span>
      {' '}قرار دارد.
      اندیکاتور Parabolic SAR ({toFa(sar)}) نیز{' '}
      {sar < currentPrice
        ? <><span>زیر قیمت قرار دارد که <b className="text-emerald-700">تأیید روند صعودی</b> است.</span></>
        : <><span>بالای قیمت قرار دارد که <b className="text-red-700">تأیید روند نزولی</b> است.</span></>
      }
      {' '}شاخص ADX ({toFa(adx)}) نشان‌دهنده <b className={adxText}>{adxText}</b> می‌باشد.
      {' '}{diSignal}.
      {regimeResult && (
        <> {' '}رژیم بازار: <b className={
          regimeResult.regime === 'TRENDING_UP' ? 'text-emerald-700' :
          regimeResult.regime === 'TRENDING_DOWN' ? 'text-red-700' :
          regimeResult.regime === 'VOLATILE' ? 'text-amber-800' :
          regimeResult.regime === 'BREAKOUT' ? 'text-purple-700' :
          'text-[#6b7280]'
        }>{regimeResult.description}</b> (اطمینان: {toFa(Math.round(regimeResult.confidence * 100))}٪).</>
      )}
    </>
  );

  // ── PARAGRAPH 2: Oscillator & Momentum (scenario-aware) ──
  let p2: React.ReactNode;
  if (isBull(highestKey)) {
    const isStrongBull = highestKey === 'SC8' || highestKey === 'SC9';
    p2 = (
      <>
        <strong className="text-amber-800">تحلیل اسیلاتورها و مومنتوم — مومنتوم صعودی{isStrongBull ? ' قوی' : ''}:</strong>{' '}
        اندیکاتور RSI ({toFa(rsi)}) در ناحیه{' '}
        <b className={rsi > 70 ? 'text-red-700' : rsi < 30 ? 'text-emerald-700' : 'text-[#374151]'}>{rsiSignal}</b>
        {rsi > 70 && <span className="text-red-700"> — با این حال در فاز {highestKey === 'SC9' ? 'شوک' : 'شتابدار'} صعودی، RSI بالا طبیعی بوده و لزوماً سیگنال فروش نیست.</span>}
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
  } else if (highestKey === 'SC5') {
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
    const isStrongBear = highestKey === 'SC1' || highestKey === 'SC2';
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
      باند بالایی: {toFa(bollingerUpper)}، باند میانی (MA20): {toFa(bollingerMiddle)}، باند پایینی: {toFa(bollingerLower)} {unit}.
      {currentPrice > bollingerUpper
        ? ' عبور از باند بالایی معمولاً نشان‌دهنده ادامه حرکت صعودی کوتاه‌مدت یا واکنش به باند است.'
        : currentPrice < bollingerLower
        ? ' نزدیکی یا عبور از باند پایینی می‌تواند نشانه بازگشت قیمت به سمت باند میانی باشد.'
        : ' موقعیت قیمت در داخل باندها نشان‌دهنده عدم وجود سیگنال شدید از باند بولینگر است.'}
      {isBull(highestKey) && ' فاصله قیمت از باند بالایی نشان‌دهنده شتاب صعودی است.'}
      {isBear(highestKey) && ' نزدیکی به باند پایینی هشدار ادامه فشار نزولی است.'}
      {highestKey === 'SC5' && ' نوسان در محدوده باندها تأییدکننده فاز رنج بازار است.'}
    </>
  );

  // ── PARAGRAPH 4: Volume & OBV Analysis (scenario-aware) — HIDDEN when no volume ──
  const p4 = ctx.hasVolume ? (
    <>
      <strong className="text-amber-800">تحلیل حجم معاملات و شاخص OBV:</strong>{' '}
      شاخص جریان ورودی پول (OBV) در سطح <b className="text-[#111827]">{obv > 0 ? '+' : ''}{toPersianDigits((obv / 1e6).toFixed(1))}M</b> قرار دارد
      {obv > 0
        ? <span> که <b className="text-emerald-700">تجمع مثبت حجم</b> را نشان می‌دهد و حاکی از ورود پول هوشمند و تقویت روند صعودی است.
          {isBull(highestKey) ? ` این حجم مثبت تأیید‌کننده ${highestKey} (${dominant}) است.` : ''}
          {highestKey === 'SC5' ? ' اما در فاز رنج، حجم مثبت الزاماً سیگنال صعودی نیست.' : ''}
          {isBear(highestKey) ? ' اما با وجود حجم مثبت، ساختار قیمت ضعیف است — این تناقض قابل توجه است.' : ''}
        </span>
        : <span> که <b className="text-red-700">خروج پول</b> را نشان می‌دهد و می‌تواند نشانه ضعف خریداران و احتمال ادامه اصلاح باشد.
          {isBull(highestKey) ? ` خروج پول با ${highestKey} (${dominant}) در تضاد است — احتیاط توصیه می‌شود.` : ''}
          {highestKey === 'SC5' ? ' خروج پول در فاز رنج معمولاً پیش‌نشاننده شکست به سمت پایین است.' : ''}
          {isBear(highestKey) ? ` این خروج پول تأیید‌کننده ${highestKey} (${dominant}) و ضرورت حفظ سرمایه است.` : ''}
        </span>
      }
    </>
  ) : (
    <>
      <strong className="text-amber-800">تحلیل نوسان پذیری:</strong>{' '}
      اندیکاتور ATR ({toFa(atr)}) نشان‌دهنده میانگین نوسان روزانه {terms.noun} است؛
      {atr > currentPrice * 0.03
        ? <span> نوسان بالاتر از ۳٪ قیمت که <b className="text-amber-800">نوسان بالایی</b> محسوب شده و مدیریت ریسک دقیق‌تری را ایجاب می‌کند.</span>
        : <span> نوسان معقول که نشان‌دهنده <b className="text-[#374151]">ثبات نسبی قیمت</b> در بازه‌های معاملاتی اخیر است.</span>
      }
    </>
  );

  // ── PARAGRAPH 5: Risk/Reward & Confluence (scenario-aware) ──
  let p5: React.ReactNode;
  if (isBull(highestKey)) {
    const isStrong = highestKey === 'SC3' || highestKey === 'SC4';
    p5 = (
      <>
        <strong className="text-amber-800">تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        با احتمال {toFa(highestProb)}٪ برای {highestKey} ({dominant})، اکثر شاخص‌ها <b className="text-emerald-700">الگوی صعودی{isStrong ? ' قدرتمند و شتابدار' : ''}</b> را تأیید می‌کنند.
        {bullCum > 60 && <span> مجموع احتمال صعودی {toFa(bullCum)}٪ نشان‌دهنده <b className="text-emerald-700">بایاس صعودی قوی</b> در بازار است.</span>}
        نسبت ریسک به بازده با حد ضرر در حمایت {toFa(S1)} و هدف {toFa(R1)} {unit}، حدود <b className="text-emerald-700">{toPersianDigits(((R1 - currentPrice) / (currentPrice - S1)).toFixed(1))}:۱</b> محاسبه می‌شود.
        تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-amber-800">بسیار نزدیک به هم — تقاطع طلایی احتمالی</span>
          : ma21 > ma100
          ? <span className="text-emerald-700">به نفع صعودی (MA21 بالاتر از MA100)</span>
          : <span className="text-red-700">به نفع نزولی (MA21 پایین‌تر از MA100)</span>}
        {' '}است. {isStrong ? 'مومنتوم بالا مدیریت ریسک دقیق‌تری را ایجاب می‌کند.' : `توصیه: در صورت شکست مقاومت ${toFa(R1)}، هدف بعدی ${toFa(R2)} ${unit} تعیین می‌شود.`}
      </>
    );
  } else if (highestKey === 'SC5') {
    p5 = (
      <>
        <strong className="text-amber-800">تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        {highestKey} ({dominant}) با احتمال {toFa(highestProb)}٪ نشان‌دهنده <b className="text-amber-800">بازار رنج و بدون جهت مشخص</b> است.
        سیگنال‌ها <b className="text-amber-800">تضاد</b> دارند و بهترین استراتژی <b className="text-amber-800">انتظار و مشاهده</b> است.
        منتظر خروج قیمت از محدوده {toFa(S1)} تا {toFa(R1)} {unit} بمانید.
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
    // Bearish SC6-SC9
    const isStrong = highestKey === 'SC8' || highestKey === 'SC9';
    p5 = (
      <>
        <strong className="text-amber-800">تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        {highestKey} ({dominant}) با احتمال {toFa(highestProb)}٪ نشان‌دهنده {isStrong ? <b className="text-red-700">تضعیف شدید ساختار</b> : <b className="text-red-700">ریسک اصلاح عمیق</b>} است.
        {bearCum > 60 && <span> مجموع احتمال نزولی {toFa(bearCum)}٪ — <b className="text-red-700">بایاس نزولی {isStrong ? 'بسیار' : ''}قوی</b> در بازار حاکم است.</span>}
        {isStrong ? <span> تمام شاخص‌ها هشدار <b className="text-red-700">خروج فوری</b> را صادر می‌کنند.</span> : <span> ورود به معامله خرید در این شرایط <b className="text-red-700">ریسک بالایی</b> دارد.</span>}
        تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-red-700">نزدیک به هم — {isStrong ? 'تقاطع مرگ در حال تکوین' : 'احتمال تقاطع مرگ'}</span>
          : ma21 > ma100
          ? <span className="text-amber-800">MA21 هنوز بالاتر اما {isStrong ? 'به سرعت در حال نزدیک شدن' : 'در حال ضعیف شدن'}</span>
          : <span className="text-red-700">MA21 زیر MA100 — {isStrong ? 'تأیید نهایی ساختار نزولی' : 'تأیید‌کننده فشار فروش'}</span>}
        {' '}. {isStrong ? 'حفظ سرمایه اولویت اول است. از هرگونه موقعیت خرید جدید خودداری کنید.' : `توصیه: احتیاط و انتظار برای بازگشت به محدوده حمایت ${toFa(S1)} ${unit}.`}
      </>
    );
  }

  // ── DIVERSITY SEED (hash of symbolName for varied phrasing) ──
  let diversitySeed = 0;
  for (let i = 0; i < symbolName.length; i++) {
    diversitySeed = ((diversitySeed << 5) - diversitySeed + symbolName.charCodeAt(i)) | 0;
  }
  diversitySeed = Math.abs(diversitySeed);

  // Diverse opening patterns for p1 (selected by seed % 4)
  const openingPatterns = [
    `بررسی وضعیت ${terms.noun} ${symbolName} نشان می‌دهد که سناریوی غالب`,
    `با توجه به ساختار قیمت ${terms.noun} ${symbolName}، سناریوی مسلط`,
    `تحلیل جامع ${terms.noun} ${symbolName} حاکی از آن است که سناریوی پیش‌رو`,
    `از منظر تکنیکال، ${terms.noun} ${symbolName} در وضعیتی قرار دارد که سناریوی غالب`,
  ];

  // Diverse transition phrases for between sections
  const transitionPhrases = [
    'در ادامه بررسی اندیکاتورها،',
    'از زاویه مومنتوم و اسیلاتورها،',
    'با تمرکز بر سیگنال‌های مومنتومی،',
    'نگاهی به وضعیت اسیلاتورها نشان می‌دهد که',
  ];

  // Diverse conclusion starters for p5
  const conclusionStarters = [
    'جمع‌بندی تلاقی سیگنال‌ها:',
    'از منظر تلاقی شاخص‌ها:',
    'بر اساس تلفیق سیگنال‌های مختلف:',
    'سنتز شاخص‌ها و سطوح کلیدی:',
  ];

  const seedIdx = diversitySeed % 4;

  // ── ENHANCED PARAGRAPH 1 with diverse opening ──
  const p1Enhanced = (
    <>
      <strong className="text-amber-800">روند کلی و موقعیت قیمت:</strong>{' '}
      {openingPatterns[seedIdx]} <b className="text-[#111827]">{highestKey} — {dominant}</b> با احتمال انحصاری <b className="text-[#111827]">{toFa(highestProb)}٪</b> می‌باشد.
      {terms.priceAction} در محدوده <b className="text-[#111827]">{toFa(currentPrice)} {unit}</b> معامله می‌شود و روند میان‌مدت{' '}
      <b className={trendColor}>{trendLabel}</b>
      {' '}است (زاویه {toFa(Math.abs(trendAngle))}°، R²={toPersianDigits((trendR2 * 100).toFixed(1))}٪).
      قیمت نسبت به MA21 ({toFa(ma21)} {unit}){' '}
      <span className={abColor(currentPrice, ma21)}>{aboveBelow(currentPrice, ma21)}</span>
      {' '}و نسبت به MA100 ({toFa(ma100)} {unit}){' '}
      <span className={abColor(currentPrice, ma100)}>{aboveBelow(currentPrice, ma100)}</span>
      {' '}قرار دارد.
      اندیکاتور Parabolic SAR ({toFa(sar)}) نیز{' '}
      {sar < currentPrice
        ? <><span>زیر قیمت قرار دارد که <b className="text-emerald-700">تأیید روند صعودی</b> است.</span></>
        : <><span>بالای قیمت قرار دارد که <b className="text-red-700">تأیید روند نزولی</b> است.</span></>
      }
      {' '}شاخص ADX ({toFa(adx)}) نشان‌دهنده <b className={adxText}>{adxText}</b> می‌باشد.
      {' '}{diSignal}.
      {regimeResult && (
        <> {' '}رژیم بازار: <b className={
          regimeResult.regime === 'TRENDING_UP' ? 'text-emerald-700' :
          regimeResult.regime === 'TRENDING_DOWN' ? 'text-red-700' :
          regimeResult.regime === 'VOLATILE' ? 'text-amber-800' :
          regimeResult.regime === 'BREAKOUT' ? 'text-purple-700' :
          'text-[#6b7280]'
        }>{regimeResult.description}</b> (اطمینان: {toFa(Math.round(regimeResult.confidence * 100))}٪).</>
      )}
      {' '}احتمال تجمعی صعودی {toFa(bullCum)}٪، نزولی {toFa(bearCum)}٪ و خنثی {toFa(rangeCum)}٪ محاسبه شده است.
    </>
  );

  // ── ENHANCED PARAGRAPH 2 with diverse transition ──
  const p2Transition = transitionPhrases[seedIdx];
  // Wrap p2 with the diverse transition (prepend it after the strong label)
  let p2Enhanced: React.ReactNode;
  if (isBull(highestKey)) {
    const isStrongBull = highestKey === 'SC8' || highestKey === 'SC9';
    p2Enhanced = (
      <>
        <strong className="text-amber-800">تحلیل اسیلاتورها و مومنتوم — مومنتوم صعودی{isStrongBull ? ' قوی' : ''}:</strong>{' '}
        {p2Transition} اندیکاتور RSI ({toFa(rsi)}) در ناحیه{' '}
        <b className={rsi > 70 ? 'text-red-700' : rsi < 30 ? 'text-emerald-700' : 'text-[#374151]'}>{rsiSignal}</b>
        {rsi > 70 && <span className="text-red-700"> — با این حال در فاز {highestKey === 'SC9' ? 'شوک' : 'شتابدار'} صعودی، RSI بالا طبیعی بوده و لزوماً سیگنال فروش نیست.</span>}
        {' '}قرار دارد.
        {ctx.hasVolume && <span> MFI ({toFa(mfi)}) {mfi > 80 ? <span className="text-red-700">اشباع خرید را نشان می‌دهد اما تأیید ورود قوی پول را تأیید می‌کند</span> : mfi < 20 ? <span className="text-emerald-700">اشباع فروش را نشان می‌دهد</span> : <span>در محدوده عادی است</span>}.</span>}
        {' '}CCI ({toFa(cci)}) {cci > 100 ? <span className="text-emerald-700">بالاتر از +100 — قدرت خریداران بسیار بالا</span> : cci < -100 ? <span className="text-red-700">پایین‌تر از -100 (قدرت فروشندگان)</span> : <span>در محدوده عادی (-100 تا +100)</span>}.
        {' '}استوکاستیک (%K={toFa(stochK)}، %D={toFa(stochD)}) وضعیت <b>{stochSignal}</b> را نشان می‌دهد.
        {' '}MACD (خط={toFa(macdLine)}، سیگنال={toFa(macdSignal)}) با{' '}
        {macdBullish
          ? <span className="text-emerald-700">عبور خط اصلی بالای خط سیگنال — تأیید‌کننده مومنتوم صعودی قدرتمند</span>
          : <span className="text-red-700">خط اصلی زیر خط سیگنال — هشدار کاهش مومنتوم</span>}
        . هیستوگرام MACD ({toFa(macdHist)}) {macdHist > 0 ? <span className="text-emerald-700">مثبت و در حال گسترش</span> : <span className="text-red-700">منفی</span>}.
        {isStrongBull && <span> مجموع احتمال صعودی {toFa(bullCum)}٪ نشان‌دهنده <b className="text-emerald-700">شتاب صعودی شدید</b> و ورود نقدینگی گسترده است.</span>}
        {!isStrongBull && bullCum > 60 && <span> مجموع احتمال صعودی {toFa(bullCum)}٪ نشان‌دهنده بایاس صعودی قوی در بازار است.</span>}
      </>
    );
  } else if (highestKey === 'SC5') {
    p2Enhanced = (
      <>
        <strong className="text-amber-800">تحلیل اسیلاتورها و مومنتوم — بازار بدون جهت:</strong>{' '}
        {p2Transition} اندیکاتور RSI ({toFa(rsi)}) در ناحیه <b className={rsi > 70 ? 'text-red-700' : rsi < 30 ? 'text-emerald-700' : 'text-[#374151]'}>{rsiSignal}</b> قرار دارد.
        {ctx.hasVolume && <span> MFI ({toFa(mfi)}) {mfi > 80 ? <span className="text-red-700">اشباع خرید</span> : mfi < 20 ? <span className="text-emerald-700">اشباع فروش</span> : <span>در محدوده خنثی</span>}.</span>}
        {' '}CCI ({toFa(cci)}) {cci > 100 ? <span>بالاتر از +100</span> : cci < -100 ? <span>پایین‌تر از -100</span> : <span>در محدوده عادی (-100 تا +100)</span>}.
        {' '}استوکاستیک (%K={toFa(stochK)}، %D={toFa(stochD)}) وضعیت <b>{stochSignal}</b> را نشان می‌دهد.
        {' '}MACD (خط={toFa(macdLine)}، سیگنال={toFa(macdSignal)}){' '}
        {macdBullish
          ? <span className="text-emerald-700">صعودی اما ضعیف</span>
          : <span className="text-red-700">نزولی اما ضعیف</span>}.
        {' '}هیستوگرام MACD ({toFa(macdHist)}) {macdHist > 0 ? <span className="text-emerald-700">مثبت</span> : <span className="text-red-700">منفی</span>} — مومنتوم پایین.
        {' '}اندیکاتورها تأییدکننده فاز رنج و عدم قطعیت بازار هستند. خروج از محدوده رنج نیاز به تأیید مومنتوم دارد.
      </>
    );
  } else if (isBear(highestKey)) {
    const isStrongBear = highestKey === 'SC1' || highestKey === 'SC2';
    p2Enhanced = (
      <>
        <strong className="text-amber-800">تحلیل اسیلاتورها و مومنتوم — {isStrongBear ? 'تضعیف شدید ساختار' : 'هشدار اصلاح'}:</strong>{' '}
        {p2Transition} اندیکاتور RSI ({toFa(rsi)}) در ناحیه <b className={rsi > 70 ? 'text-red-700' : rsi < 30 ? 'text-emerald-700' : 'text-[#374151]'}>{rsiSignal}</b> قرار دارد
        {rsi < 40 && <span> — {isStrongBear ? 'سقوط RSI نشان‌دهنده فشار فروش سنگین است' : 'روند نزولی RSI هشدار ادامه اصلاح است'}.</span>}.
        {ctx.hasVolume && <span> MFI ({toFa(mfi)}) {mfi > 80 ? <span className="text-red-700">اشباع خرید — واگرایی منفی {isStrongBear ? 'خطرناک' : 'محتمل'}</span> : mfi < 20 ? <span className="text-red-700">اشباع فروش شدید — {isStrongBear ? 'خروج پول گسترده' : 'احتمال بازگشت کوتاه‌مدت'}</span> : <span>{isStrongBear ? 'در حال کاهش — هشدار خروج پول' : 'در محدوده نزولی'}</span>}.</span>}
        {' '}CCI ({toFa(cci)}) {cci > 100 ? <span className="text-red-700">بالاتر از +100 — {isStrongBear ? 'واگرایی قطعی' : 'ممکن است واگرایی منفی باشد'}</span> : cci < -100 ? <span className="text-red-700">پایین‌تر از -100 — {isStrongBear ? 'سقوط آزاد' : 'فشار فروش قوی'}</span> : <span>در محدوده عادی (-100 تا +100)</span>}.
        {' '}استوکاستیک (%K={toFa(stochK)}، %D={toFa(stochD)}) وضعیت <b>{stochSignal}</b>.
        {' '}MACD (خط={toFa(macdLine)}، سیگنال={toFa(macdSignal)}){' '}
        {macdBullish
          ? <span className="text-amber-800">صعودی موقت — {isStrongBear ? 'در ساختار نزولی قابل اعتماد نیست' : 'در روند نزولی سیگنال ضعیف'}</span>
          : <span className="text-red-700">تقاطع نزولی — {isStrongBear ? 'سیگنال خروج فوری' : 'تأیید‌کننده فشار فروش'}</span>}.
        {' '}هیستوگرام MACD ({toFa(macdHist)}) {macdHist > 0 ? <span className="text-amber-800">مثبت اما ضعیف</span> : <span className="text-red-700">منفی و {isStrongBear ? 'تشدید شونده' : 'در حال گسترش'}</span>}.
        {isStrongBear && <span> تمام اندیکاتورها تضعیف ساختاری و هشدار خروج سرمایه را تأیید می‌کنند.</span>}
        {!isStrongBear && <span> در مجموع، اندیکاتورها هشدار اصلاح عمیق‌تر را صادر می‌کنند.</span>}
      </>
    );
  } else {
    p2Enhanced = <></>;
  }

  // ── PARAGRAPH 2.5: Decision Graph Analysis (NEW) ──
  let pDecisionGraph: React.ReactNode;
  if (decisionGraph) {
    const bp = decisionGraph.branchProbabilities;
    const bpEntries = [
      { key: 'trend', label: 'پیرو روند', prob: bp.trend },
      { key: 'breakout', label: 'شکست', prob: bp.breakout },
      { key: 'reversal', label: 'بازگشت', prob: bp.reversal },
    ] as const;
    const sortedBranches = [...bpEntries].sort((a, b) => b.prob - a.prob);
    const dominantBranch = sortedBranches[0];
    const secondBranch = sortedBranches[1];

    // Determine the branch description
    const branchDescriptions: Record<string, string> = {
      'trend': 'استراتژی پیرو روند (Trend Following) فعال شده که نشان‌دهنده ادامه جهت فعلی بازار است',
      'breakout': 'استراتژی شکست (Breakout) فعال شده که حاکی از احتمال عبور قیمت از سطوح کلیدی است',
      'reversal': 'استراتژی بازگشت (Reversal) فعال شده که نشانه تغییر جهت احتمالی بازار است',
    };

    // Count decision vs event nodes
    const decisionNodes = decisionGraph.nodes.filter(n => n.type === 'decision');
    const eventNodes = decisionGraph.nodes.filter(n => n.type === 'event');

    // Get key decision node signals
    const keyDecisionSignals = decisionNodes.slice(0, 3).map(n => n.title).join('، ');

    // Path contributions for the dominant scenario
    const pathContribs = decisionGraph.pathContributions?.[highestKey];
    let pathText = '';
    if (pathContribs) {
      const contribEntries = [
        { label: 'پیرو روند', val: pathContribs.trend },
        { label: 'شکست', val: pathContribs.breakout },
        { label: 'بازگشت', val: pathContribs.reversal },
      ].filter(e => e.val > 0.01).sort((a, b) => b.val - a.val);
      if (contribEntries.length > 0) {
        pathText = ` مسیرهای مؤثر در سناریوی غالب (${highestKey}): ${contribEntries.map(e => `${e.label} (${toFa(Math.round(e.val * 100))}٪)`).join(' و ')}.`;
      }
    }

    // Diverse phrasing for the decision graph paragraph
    const dgOpeners = [
      'در گراف تصمیم‌گیری پیشرفته،',
      'بر اساس تحلیل گراف تصمیم‌گیری،',
      'از منظر ساختار تصمیم‌گیری،',
      'با بررسی گراف تصمیم‌گیری چندشاخه‌ای،',
    ];

    pDecisionGraph = (
      <>
        <strong className="text-amber-800">تحلیل گراف تصمیم‌گیری پیشرفته:</strong>{' '}
        {dgOpeners[seedIdx]} شاخه <b className="text-[#111827]">{dominantBranch.label}</b> با احتمال مسیر {' '}
        <b className="text-[#111827]">{toFa(Math.round(dominantBranch.prob * 100))}٪</b> غالب بوده و {' '}
        {branchDescriptions[dominantBranch.key]}.
        {' '}شاخه {secondBranch.label} با {toFa(Math.round(secondBranch.prob * 100))}٪ احتمال به عنوان دومین استراتژی محتمل شناخته می‌شود.
        {' '}گراف شامل {toPersianDigits(String(decisionGraph.nodes.length))} گره ({toPersianDigits(String(decisionNodes.length))} تصمیم و {toPersianDigits(String(eventNodes.length))} ارزیابی) و {toPersianDigits(String(decisionGraph.edges.length))} یال است.
        {keyDecisionSignals && <span> گره‌های تصمیم کلیدی شامل {keyDecisionSignals} می‌باشند.</span>}
        {pathText}
        {' '}این ساختار تصمیم‌گیری چندمسیره امکان تحلیل همزمان سه استراتژی را فراهم کرده و با تخصیص احتمال به هر مسیر، تصمیم‌گیری مبتنی بر داده را تقویت می‌کند.
      </>
    );
  } else {
    pDecisionGraph = (
      <>
        <strong className="text-amber-800">تحلیل ساختار تصمیم‌گیری:</strong>{' '}
        بر اساس توزیع احتمال سناریوها، ساختار تصمیم‌گیری {' '}
        {isBull(highestKey) ? <span className="text-emerald-700">تمایل صعودی</span> : isBear(highestKey) ? <span className="text-red-700">تمایل نزولی</span> : <span className="text-amber-800">تمایل خنثی</span>}
        {' '}دارد. مجموع احتمال صعودی {toFa(bullCum)}٪، نزولی {toFa(bearCum)}٪ و خنثی {toFa(rangeCum)}٪ نشان‌دهنده {' '}
        {bullCum > bearCum ? <b className="text-emerald-700">بایاس گاوی</b> : bearCum > bullCum ? <b className="text-red-700">بایاس خرسی</b> : <b className="text-amber-800">بازار متعادل</b>}
        {' '}در فضای تصمیم‌گیری است.
      </>
    );
  }

  // ── PARAGRAPH 2.8: Probabilities and Trends (NEW) ──
  let pProbTrends: React.ReactNode;

  // Sort scenarios by probability descending to get top 3
  const scenarioEntries = SCENARIO_KEYS.map(k => ({
    key: k,
    prob: scenarios[k]?.probability ?? 0,
    label: SCENARIO_META[k]?.label ?? k,
  })).sort((a, b) => b.prob - a.prob);
  const top3 = scenarioEntries.slice(0, 3);

  // Get trend data for scenarios if available
  const getScenarioTrend = (key: string) => {
    if (!probabilityTrend) return null;
    return probabilityTrend.scenarios.find(s => s.scenarioKey === key);
  };
  const getGroupTrend = (group: string) => {
    if (!probabilityTrend) return null;
    return probabilityTrend.groups.find(g => g.group === group);
  };

  const trendDirectionFa = (dir: string) => {
    switch (dir) {
      case 'rising': return { text: 'صعودی (در حال افزایش)', color: 'text-emerald-700' };
      case 'falling': return { text: 'نزولی (در حال کاهش)', color: 'text-red-700' };
      case 'volatile': return { text: 'نوسانی (بدون جهت مشخص)', color: 'text-amber-800' };
      default: return { text: 'پایدار (بدون تغییر قابل توجه)', color: 'text-[#6b7280]' };
    }
  };

  const dominantTrend = getScenarioTrend(highestKey);
  const bullGroupTrend = getGroupTrend('bullish');
  const bearGroupTrend = getGroupTrend('bearish');
  const neutralGroupTrend = getGroupTrend('neutral');

  const probOpeners = [
    'بررسی توزیع احتمال‌ها و روند تغییرات آن‌ها',
    'تحلیل احتمال‌های انحصاری و تجمعی به همراه روندها',
    'وضعیت احتمال‌ها و جهت تغییرات آنها در بازه اخیر',
    'نگاهی به احتمال‌های سناریو و روند تکامل آنها',
  ];

  pProbTrends = (
    <>
      <strong className="text-amber-800">{probOpeners[seedIdx]}:</strong>{' '}
      سه سناریوی محتمل‌ترین عبارتند از: {' '}
      {top3.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && '، '}
          <b className="text-[#111827]">{s.key} ({s.label})</b> با احتمال انحصاری <b className="text-[#111827]">{toFa(s.prob)}٪</b>
          {(() => {
            const trend = getScenarioTrend(s.key);
            if (trend && trend.trendDirection) {
              const td = trendDirectionFa(trend.trendDirection);
              return <span> — روند احتمال: <b className={td.color}>{td.text}</b></span>;
            }
            return null;
          })()}
        </React.Fragment>
      ))}
      .
      {' '}احتمال تجمعی گاوی <b className="text-emerald-700">{toFa(bullCum)}٪</b>
      {bullGroupTrend && (() => {
        const td = trendDirectionFa(bullGroupTrend.trendDirection);
        return <span> (روند: <b className={td.color}>{td.text}</b>)</span>;
      })()}
      {', '}خرسی <b className="text-red-700">{toFa(bearCum)}٪</b>
      {bearGroupTrend && (() => {
        const td = trendDirectionFa(bearGroupTrend.trendDirection);
        return <span> (روند: <b className={td.color}>{td.text}</b>)</span>;
      })()}
      {' '}و خنثی <b className="text-amber-800">{toFa(rangeCum)}٪</b>
      {neutralGroupTrend && (() => {
        const td = trendDirectionFa(neutralGroupTrend.trendDirection);
        return <span> (روند: <b className={td.color}>{td.text}</b>)</span>;
      })()}
      .
      {dominantTrend && (() => {
        const td = trendDirectionFa(dominantTrend.trendDirection);
        return <span> روند احتمال سناریوی غالب ({highestKey}) <b className={td.color}>{td.text}</b> است{dominantTrend.trendDirection === 'rising' ? ' که نشان‌دهنده تقویت این سناریو در بازه اخیر می‌باشد' : dominantTrend.trendDirection === 'falling' ? ' که هشدار تضعیف این سناریو و احتمال تغییر فاز بازار را می‌دهد' : ' که حاکی از ثبات نسبی ساختار احتمالی بازار است'}.</span>;
      })()}
      {!dominantTrend && <span> روند تغییرات احتمال سناریوی غالب در دسترس نیست اما با توجه به فاصله احتمالی آن از سناریوی دوم ({toFa(Math.round(top3[0].prob - top3[1].prob))}٪), {' '}
        {top3[0].prob - top3[1].prob > 15 ? 'قطعیت بالای سناریوی غالب مشهود است' : top3[0].prob - top3[1].prob > 5 ? 'قطعیت متوسطی در سناریوی غالب وجود دارد' : 'فاصله کم بین دو سناریوی اول هشدار عدم قطعیت بازار است'}.
      </span>}
    </>
  );

  // ── ENHANCED PARAGRAPH 5 with diverse conclusion starter ──
  // Replace the strong label in p5 with diverse conclusion starter
  let p5Enhanced: React.ReactNode;
  if (isBull(highestKey)) {
    const isStrong = highestKey === 'SC3' || highestKey === 'SC4';
    p5Enhanced = (
      <>
        <strong className="text-amber-800">{conclusionStarters[seedIdx]}</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        با احتمال {toFa(highestProb)}٪ برای {highestKey} ({dominant})، اکثر شاخص‌ها <b className="text-emerald-700">الگوی صعودی{isStrong ? ' قدرتمند و شتابدار' : ''}</b> را تأیید می‌کنند.
        {bullCum > 60 && <span> مجموع احتمال صعودی {toFa(bullCum)}٪ نشان‌دهنده <b className="text-emerald-700">بایاس صعودی قوی</b> در بازار است.</span>}
        {' '}نسبت ریسک به بازده با حد ضرر در حمایت {toFa(S1)} و هدف {toFa(R1)} {unit}، حدود <b className="text-emerald-700">{toPersianDigits(((R1 - currentPrice) / (currentPrice - S1)).toFixed(1))}:۱</b> محاسبه می‌شود.
        {' '}تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-amber-800">بسیار نزدیک به هم — تقاطع طلایی احتمالی</span>
          : ma21 > ma100
          ? <span className="text-emerald-700">به نفع صعودی (MA21 بالاتر از MA100)</span>
          : <span className="text-red-700">به نفع نزولی (MA21 پایین‌تر از MA100)</span>}
        {' '}است. {isStrong ? 'مومنتوم بالا مدیریت ریسک دقیق‌تری را ایجاب می‌کند.' : `توصیه: در صورت شکست مقاومت ${toFa(R1)}، هدف بعدی ${toFa(R2)} ${unit} تعیین می‌شود.`}
      </>
    );
  } else if (highestKey === 'SC5') {
    p5Enhanced = (
      <>
        <strong className="text-amber-800">{conclusionStarters[seedIdx]}</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        {highestKey} ({dominant}) با احتمال {toFa(highestProb)}٪ نشان‌دهنده <b className="text-amber-800">بازار رنج و بدون جهت مشخص</b> است.
        {' '}سیگنال‌ها <b className="text-amber-800">تضاد</b> دارند و بهترین استراتژی <b className="text-amber-800">انتظار و مشاهده</b> است.
        {' '}منتظر خروج قیمت از محدوده {toFa(S1)} تا {toFa(R1)} {unit} بمانید.
        {' '}تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-amber-800">نزدیک به هم — هر گونه تقاطع می‌تواند سیگنال جهت باشد</span>
          : ma21 > ma100
          ? <span className="text-emerald-700">به نفع صعودی (MA21 بالاتر از MA100)</span>
          : <span className="text-red-700">به نفع نزولی (MA21 پایین‌تر از MA100)</span>}
        {' '}. شکست سطوح کلیدی و مومنتوم MACD را پایش کنید.
      </>
    );
  } else {
    // Bearish
    const isStrong = highestKey === 'SC8' || highestKey === 'SC9';
    p5Enhanced = (
      <>
        <strong className="text-amber-800">{conclusionStarters[seedIdx]}</strong>{' '}
        {R1_grade && <span>مقاومت R۱ ({R1_grade}{R1_methods}) و حمایت S۱ ({S1_grade}{S1_methods}). </span>}
        {highestKey} ({dominant}) با احتمال {toFa(highestProb)}٪ نشان‌دهنده {isStrong ? <b className="text-red-700">تضعیف شدید ساختار</b> : <b className="text-red-700">ریسک اصلاح عمیق</b>} است.
        {bearCum > 60 && <span> مجموع احتمال نزولی {toFa(bearCum)}٪ — <b className="text-red-700">بایاس نزولی {isStrong ? 'بسیار' : ''}قوی</b> در بازار حاکم است.</span>}
        {isStrong ? <span> تمام شاخص‌ها هشدار <b className="text-red-700">خروج فوری</b> را صادر می‌کنند.</span> : <span> ورود به معامله خرید در این شرایط <b className="text-red-700">ریسک بالایی</b> دارد.</span>}
        {' '}تلاقی MA21 و MA100{' '}
        {Math.abs(ma21 - ma100) / currentPrice < 0.01
          ? <span className="text-red-700">نزدیک به هم — {isStrong ? 'تقاطع مرگ در حال تکوین' : 'احتمال تقاطع مرگ'}</span>
          : ma21 > ma100
          ? <span className="text-amber-800">MA21 هنوز بالاتر اما {isStrong ? 'به سرعت در حال نزدیک شدن' : 'در حال ضعیف شدن'}</span>
          : <span className="text-red-700">MA21 زیر MA100 — {isStrong ? 'تأیید نهایی ساختار نزولی' : 'تأیید‌کننده فشار فروش'}</span>}
        {' '}. {isStrong ? 'حفظ سرمایه اولویت اول است. از هرگونه موقعیت خرید جدید خودداری کنید.' : `توصیه: احتیاط و انتظار برای بازگشت به محدوده حمایت ${toFa(S1)} ${unit}.`}
      </>
    );
  }

  return [p1Enhanced, p2Enhanced, pDecisionGraph, pProbTrends, p3, p4, p5Enhanced];
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
  const { colors: C, isDark } = useTheme();
  const {
    symbolName, candles, currentPrice, resistances, supports, ma21, ma100,
    rsi, mfi, cci, adx, stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, obv, bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal, scenarios,
    supportStrengths, resistanceStrengths, priceTargets, hasVolume, instrumentType,
    instrumentCategory,
    currencyUnit: propCurrencyUnit, priceDecimals: propPriceDecimals,
    probabilityTrend, decisionGraph, regimeResult,
  } = props;
  const unit = propCurrencyUnit || 'ریال';
  const decimals = propPriceDecimals ?? 0;
  // Dynamic price formatter using data-source-derived decimals
  const toFa = (n: number) => formatPriceFa(n, decimals);

  const vdesRef = useRef<HTMLDivElement>(null);

  // Resistance/Support levels for analysis text
  const R1_level = resistances[0] ?? currentPrice * 1.05;
  const R2_level = resistances[1] ?? currentPrice * 1.10;
  const S1_level = supports[0] ?? currentPrice * 0.95;
  const S2_level = supports[1] ?? currentPrice * 0.90;
  const S3_level = supports[2] ?? currentPrice * 0.85;

  // Use the dominant bullish scenario's target range (consistent with scenario cards below)
  const bullishScenarios = ['SC1', 'SC2', 'SC3', 'SC4'] as const;
  let dominantBullKey: string = 'SC1';
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
      SC1: scenarios.SC1.probability,
      SC2: scenarios.SC2.probability,
      SC3: scenarios.SC3.probability,
      SC4: scenarios.SC4.probability,
      SC5: scenarios.SC5.probability,
      SC6: scenarios.SC6.probability,
      SC7: scenarios.SC7.probability,
      SC8: scenarios.SC8.probability,
      SC9: scenarios.SC9.probability,
    };
    return computeV11Probabilities(input);
  }, [scenarios]);

  // ── Dominant scenario ──────────────────────────────────────────
  let highestKey = 'SC5';
  let highestProb = 0;
  for (const key of SCENARIO_KEYS) {
    const prob = scenarios[key]?.probability ?? 0;
    if (prob > highestProb) {
      highestProb = prob;
      highestKey = key;
    }
  }
  const strategy = STRATEGY_MAP[highestKey];
  const strategyType = SCENARIO_META[highestKey]?.type;
  // IRON LAW: totalProb is ALWAYS 100 — computed from V11-enforced probabilities
  const totalProb = v11Result.scenarios.reduce((sum, s) => sum + s.rawProbability, 0);

  // ── RSI signal ─────────────────────────────────────────────────
  const rsiSignal = rsi > 70 ? 'اشباع خرید شدید' : rsi > 60 ? 'اشباع خرید' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش' : 'اشباع فروش شدید';

  // ── Trend text ─────────────────────────────────────────────────
  // New angle scale: 1% daily rise ≈ 45°, so < 3° means nearly flat
  const _absAngle = Math.abs(trendAngle);
  const _r2Str = toPersianDigits((trendR2 * 100).toFixed(1));
  const trendText = trendDirection === 'up'
    ? _absAngle < 3
      ? `صعودی با شیب بسیار ملایم و ضریب تعیین R²=${_r2Str}٪`
      : `صعودی با زاویه ${toFa(_absAngle)} درجه و ضریب تعیین R²=${_r2Str}٪`
    : trendDirection === 'down'
    ? _absAngle < 3
      ? `نزولی با شیب بسیار ملایم و ضریب تعیین R²=${_r2Str}٪`
      : `نزولی با زاویه ${toFa(_absAngle)} درجه و ضریب تعیین R²=${_r2Str}٪`
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
      S1: S1_level, SC1: R1_level, SC2: R2_level,
      hasVolume: hasVolume ?? false,
      resistanceStrengths, supportStrengths,
      v11Result,
      currencyUnit: propCurrencyUnit,
      instrumentCategory,
      priceDecimals: decimals,
      regimeResult,
      probabilityTrend,
      decisionGraph,
    });
  }, [
    symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx,
    stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, obv,
    bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal,
    highestKey, highestProb, scenarios,
    S1_level, R1_level, R2_level, hasVolume,
    resistanceStrengths, supportStrengths, v11Result, propCurrencyUnit,
    instrumentCategory, decimals, regimeResult,
    probabilityTrend, decisionGraph,
  ]);

  // ── Strategy recommendation text ────────────────────────────────
  const mfiOverbought = hasVolume && mfi > 80;
  const mfiOversold = hasVolume && mfi < 20;
  const mfiNote = hasVolume ? `, MFI: ${toFa(mfi)}` : '';
  const strategyText = rsi > 70 || mfiOverbought
    ? `با توجه به هشدار اشباع خرید (RSI: ${toFa(rsi)}${mfiNote}) و فاصله قیمت تا مقاومت ${toFa(R1_level)}، استراتژی محتاطانه، انتظار برای اصلاح قیمت و ورود در محدوده حمایت ${toFa(S1_level)} تا ${toFa(S2_level)} ${unit} می‌باشد. در این محدوده می‌توان با حد ضرر ${toFa(S2_level)} ${unit} وارد موقعیت خرید شد.`
    : rsi < 30 || mfiOversold
    ? `با توجه به اشباع فروش (RSI: ${toFa(rsi)}${mfiNote}) و نزدیکی به حمایت ${toFa(S1_level)}، فرصت خرید در محدوده فعلی با حد ضرر ${toFa(S2_level)} ${unit} قابل بررسی است. هدف اولیه ${toFa(R1_level)} و هدف ثانویه ${toFa(R2_level)} ${unit} تعیین می‌شود.`
    : `با توجه به وضعیت خنثی اندیکاتورها (RSI: ${toFa(rsi)}${mfiNote}, ADX: ${toFa(adx)}، قدرت روند: ${adx > 25 ? 'قوی' : 'ضعیف'})، انتظار برای خروج قیمت از محدوده ${toFa(S1_level)} تا ${toFa(R1_level)} ${unit} و سپس تصمیم‌گیری توصیه می‌شود. مومنتوم MACD و شکست سطوح کلیدی را برای تأیید سیگنال پایش کنید.`;

  const v11Map = useMemo(() => {
    const m = new Map<string, V11Result['scenarios'][number]>();
    for (const s of v11Result.scenarios) m.set(s.key, s);
    return m;
  }, [v11Result]);

  // ── AI Analysis Text ───────────────────────────────────────
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRetryKey, setAiRetryKey] = useState(0);
  const [aiIsFallback, setAiIsFallback] = useState(false);
  const [aiForceRefresh, setAiForceRefresh] = useState(false);
  const [aiCachedAge, setAiCachedAge] = useState<number | null>(null);
  const [aiPriceAtGen, setAiPriceAtGen] = useState<number | null>(null);
  const aiAutoRetryRef = useRef(0);

  // Listen for retry events from the retry button
  useEffect(() => {
    const handler = () => { setAiRetryKey((k) => k + 1); aiAutoRetryRef.current = 0; };
    window.addEventListener('ai-retry', handler);
    return () => window.removeEventListener('ai-retry', handler);
  }, []);

  // ── Short-duration localStorage cache (5 min, price-validated) ──
  const LOCAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // On mount: show cached text as placeholder ONLY if price matches and cache is fresh
  useEffect(() => {
    if (!currentPrice) return;
    try {
      const cacheKey = `ai-${symbolName}-short`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.text && parsed.text.length > 50) {
          const age = Date.now() - (parsed.ts || 0);
          const isExpired = age > LOCAL_CACHE_TTL;
          // Price validation: skip cached text if price differs >1%
          if (parsed.price && currentPrice > 0) {
            const diff = Math.abs(parsed.price - currentPrice) / currentPrice;
            if (diff > 0.01 || isExpired) {
              localStorage.removeItem(cacheKey);
              return;
            }
          } else if (isExpired) {
            localStorage.removeItem(cacheKey);
            return;
          }
          setAiText(parsed.text);
          setAiIsFallback(false);
          setAiCachedAge(Math.round(age / 1000));
          setAiPriceAtGen(parsed.price || null);
          // Do NOT set aiLoading=false — always fetch fresh data in background
        }
      }
    } catch { /* ignore */ }
  }, [symbolName, currentPrice]);

  // Stable key: re-fetch when symbol changes or forceRefresh is triggered
  const aiFetchKey = symbolName + (aiForceRefresh ? '-force' : '');

  // Fetch from API when symbol changes or retry is triggered
  useEffect(() => {
    if (!currentPrice) return;
    // Always fetch fresh analysis; cache is used as placeholder only
    let cancelled = false;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        setAiLoading(true);
        setAiError(null);
        setAiIsFallback(false);
        setAiCachedAge(null);

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
            instrumentType,
            instrumentCategory,
            currencyUnit: propCurrencyUnit,
            forceRefresh: aiForceRefresh,
            probabilityTrend: probabilityTrend ? {
              scenarios: probabilityTrend.scenarios.map(s => ({
                scenarioKey: s.scenarioKey, label: s.label, group: s.group,
                currentProbability: s.currentProbability, trendDirection: s.trendDirection,
                trend: s.trend.slice(0, 7).map(d => ({ individualProb: d.individualProb, cumulativeProb: d.cumulativeProb })),
              })),
              groups: probabilityTrend.groups.map(g => ({
                group: g.group, label: g.label, trendDirection: g.trendDirection,
                trend: g.trend.slice(0, 7).map(d => ({ cumulativeProb: d.cumulativeProb })),
              })),
            } : undefined,
          }),
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          let errMsg = `خطای سرور (${res.status})`;
          try {
            const errBody = await res.json();
            if (errBody.error) errMsg = errBody.error;
          } catch {
            if (res.status === 502) errMsg = 'سرور هوشمند در حال بارگذاری مجدد است.';
            else if (res.status === 503) errMsg = 'سرور موقتاً در دسترس نیست.';
          }
          // On error, try to show any previous localStorage text as fallback
          const prevText = getShortCache(symbolName);
          if (prevText) {
            setAiText(prevText);
            setAiIsFallback(true);
            setAiLoading(false);
            return;
          }
          setAiError(errMsg);
          setAiLoading(false);
          // Auto-retry for transient errors (rate limit, timeout, server busy)
          // Up to 2 auto-retries with exponential backoff (8s, 20s)
          const isTransientError = res.status === 429 || res.status === 502 || res.status === 503
            || errMsg.includes('محدودیت') || errMsg.includes('پایان رسید')
            || errMsg.includes('موقتی') || errMsg.includes('در دسترس');
          if (isTransientError && aiAutoRetryRef.current < 2) {
            aiAutoRetryRef.current++;
            const delay = 8000 * Math.pow(2.5, aiAutoRetryRef.current - 1); // 8s, 20s
            console.log(`[AI] Auto-retry ${aiAutoRetryRef.current}/2 in ${Math.round(delay / 1000)}s...`);
            retryTimer = setTimeout(() => {
              if (!cancelled) setAiRetryKey(k => k + 1);
            }, delay);
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.text) {
          setAiText(data.text);
          setAiIsFallback(!!data.isFallback);
          setAiError(null);
          setAiCachedAge(data.cachedAge ?? null);
          setAiPriceAtGen(data.priceAtGeneration ?? currentPrice);
          aiAutoRetryRef.current = 0; // Reset retry counter on success
          // Save to short-duration localStorage cache
          saveShortCache(symbolName, data.text, currentPrice);
        } else if (data.error) {
          const prevText = getShortCache(symbolName);
          if (prevText) {
            setAiText(prevText);
            setAiIsFallback(true);
          } else {
            setAiError(data.error);
            // Auto-retry for transient errors
            const isTransientError = data.error.includes('محدودیت') || data.error.includes('پایان رسید')
              || data.error.includes('موقتی') || data.error.includes('در دسترس');
            if (isTransientError && aiAutoRetryRef.current < 2) {
              aiAutoRetryRef.current++;
              const delay = 8000 * Math.pow(2.5, aiAutoRetryRef.current - 1);
              console.log(`[AI] Auto-retry ${aiAutoRetryRef.current}/2 in ${Math.round(delay / 1000)}s...`);
              retryTimer = setTimeout(() => {
                if (!cancelled) setAiRetryKey(k => k + 1);
              }, delay);
            }
          }
        }
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'cancelled' || msg === 'aborted' || msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('cancel')) return;
        // On network error, show localStorage fallback if available
        const prevText = getShortCache(symbolName);
        if (prevText) {
          setAiText(prevText);
          setAiIsFallback(true);
        } else {
          setAiError(msg.length > 200 ? msg.slice(0, 200) : msg);
          // Auto-retry for network errors
          if (aiAutoRetryRef.current < 2) {
            aiAutoRetryRef.current++;
            const delay = 8000 * Math.pow(2.5, aiAutoRetryRef.current - 1);
            console.log(`[AI] Auto-retry (network) ${aiAutoRetryRef.current}/2 in ${Math.round(delay / 1000)}s...`);
            retryTimer = setTimeout(() => {
              if (!cancelled) setAiRetryKey(k => k + 1);
            }, delay);
          }
        }
      } finally {
        if (!cancelled) {
          setAiLoading(false);
          setAiForceRefresh(false); // Reset forceRefresh after fetch completes
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [aiFetchKey, aiRetryKey]);

  // Helper: save AI text to short-duration localStorage (5 min TTL, price-validated)
  function saveShortCache(sym: string, text: string, price: number) {
    try {
      const key = `ai-${sym}-short`;
      localStorage.setItem(key, JSON.stringify({ text, price, ts: Date.now() }));
    } catch { /* quota exceeded — ignore */ }
  }

  // Helper: get short-duration cached text from localStorage (within 5 min and 1% price)
  function getShortCache(sym: string): string | null {
    try {
      const key = `ai-${sym}-short`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.text && parsed.text.length > 50) {
          const age = Date.now() - (parsed.ts || 0);
          if (age > LOCAL_CACHE_TTL) return null;
          if (parsed.price && currentPrice > 0) {
            const diff = Math.abs(parsed.price - currentPrice) / currentPrice;
            if (diff <= 0.01) return parsed.text;
          }
        }
      }
    } catch { /* ignore */ }
    return null;
  }

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
    const analysisHTML = vdesRef.current.querySelector('.vdes-analysis-text')?.innerHTML || '<p>تحلیل در دسترس نیست</p>';

    // Pre-compute Jalali date labels for chart time axis
    const dateLabels = candles.map(d =>
      isGregorianDate(d.date) ? candleDateToJalali(d.date, 'compact') : formatJalaliString(d.date, 'compact')
    );

    // Build candle data JSON (only last 500 candles to keep file size reasonable)
    const maxCandles = 500;
    const chartCandles = candles.length > maxCandles ? candles.slice(-maxCandles) : candles;
    const chartDateLabels = candles.length > maxCandles ? dateLabels.slice(-maxCandles) : dateLabels;
    const candleDataJSON = JSON.stringify(chartCandles.map((d, i) => ({
      time: i, o: d.open, h: d.high, l: d.low, c: d.close, v: d.volume
    })));
    const dateLabelsJSON = JSON.stringify(chartDateLabels);

    // Build price lines JSON
    const priceLines: Array<{ price: number; color: string; title: string; lineStyle: number; lineWidth: number }> = [];
    if (ma21 > 0) priceLines.push({ price: ma21, color: '#06b6d4', title: 'MA21', lineStyle: 0, lineWidth: 1 });
    if (ma100 > 0) priceLines.push({ price: ma100, color: '#a855f7', title: 'MA100', lineStyle: 0, lineWidth: 1 });
    if (sar > 0) priceLines.push({ price: sar, color: '#d97706', title: 'SAR', lineStyle: 1, lineWidth: 1 });
    if (bollingerUpper > 0) priceLines.push({ price: bollingerUpper, color: '#7c3aed', title: 'BB Upper', lineStyle: 2, lineWidth: 1 });
    if (bollingerMiddle > 0) priceLines.push({ price: bollingerMiddle, color: '#7c3aed', title: 'BB Mid', lineStyle: 2, lineWidth: 1 });
    if (bollingerLower > 0) priceLines.push({ price: bollingerLower, color: '#7c3aed', title: 'BB Lower', lineStyle: 2, lineWidth: 1 });
    for (let i = 0; i < Math.min(resistances.length, 4); i++) {
      if (resistances[i] > 0) priceLines.push({ price: resistances[i], color: '#ea580c', title: `R${i + 1}`, lineStyle: 0, lineWidth: 2 });
    }
    for (let i = 0; i < Math.min(supports.length, 4); i++) {
      if (supports[i] > 0) priceLines.push({ price: supports[i], color: '#2563eb', title: `S${i + 1}`, lineStyle: 0, lineWidth: 2 });
    }
    const priceLinesJSON = JSON.stringify(priceLines);

    const chartBg = isDark ? '#0a0a1a' : '#ffffff';
    const chartText = isDark ? '#9ca3af' : '#6b7280';
    const chartGrid = isDark ? '#1e293b' : '#f1f5f9';
    const chartBorder = isDark ? '#334155' : '#e2e8f0';
    const crosshairColor = isDark ? '#475569' : '#94a3b8';

    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تحلیل تکنیکال ${symbolName} — توضیح‌دهنده تصویری</title>
<script src="https://unpkg.com/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: ${C.pageBg}; color: ${C.cardFg}; padding: 20px 16px 40px; line-height: 1.8; }
.app { max-width: 1400px; margin: 0 auto; }
.header { background: ${C.cardBg}; backdrop-filter: blur(14px); border: 1px solid ${C.primary}; border-radius: 32px; padding: 26px 32px; margin-bottom: 28px; ${isDark ? 'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);' : 'box-shadow: 0 4px 16px rgba(0,0,0,.08);'} }
.header h1 { font-size: 1.8rem; font-weight: 700; color: #f8e365; margin-bottom: 6px; }
.header .sub { color: ${C.cardSubFg}; font-size: 0.95rem; display: flex; flex-wrap: wrap; gap: 12px 28px; margin-top: 8px; }
.header .sub span { background: ${C.cardBg}; padding: 4px 14px; border-radius: 40px; border: 1px solid ${C.cardBorder}; }
.panel { background: ${C.cardBg}; backdrop-filter: blur(8px); border: 1px solid ${C.cardBorder}; border-radius: 28px; padding: 22px 24px; margin-bottom: 24px; ${isDark ? 'box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.5);' : 'box-shadow: 0 4px 16px rgba(0,0,0,.08);'} }
.panel h2 { font-size: 1.2rem; font-weight: 600; margin-bottom: 16px; color: ${C.cardFg}; display: flex; align-items: center; gap: 12px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
@media (max-width: 950px) { .grid-2 { grid-template-columns: 1fr; } }
.level-box { background: ${C.cardBg}; border-radius: 16px; padding: 16px 18px; border: 1px solid ${C.cardBorder}; }
.level-box h3 { font-size: 1.1rem; margin-bottom: 14px; border-bottom: 1px solid ${C.cardBorder}; padding-bottom: 10px; }
.level-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid ${C.cardBorder}; font-size: 0.95rem; align-items: center; }
.level-row .badge { font-size: 0.7rem; background: ${C.cardBorder}; padding: 0 10px; border-radius: 30px; margin-left: 8px; color: ${C.cardSubFg}; }
.level-row .price { font-weight: 700; direction: ltr; }
.support .price { color: ${C.bullColor}; }
.resistance .price { color: ${C.bearColor}; }
.scenario-table-wrap { overflow-x: auto; border-radius: 16px; border: 1px solid ${C.cardBorder}; }
.scenario-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; min-width: 500px; }
.scenario-table thead { background: ${C.cardBorder}; border-bottom: 2px solid ${C.cardBorder}; }
.scenario-table th { padding: 12px 14px; text-align: right; font-weight: 600; color: ${C.cardSubFg}; font-size: 0.85rem; }
.scenario-table td { padding: 10px 14px; border-bottom: 1px solid ${C.cardBorder}; vertical-align: middle; }
.scenario-table tr:last-child td { border-bottom: none; }
.scenario-table .s-prob { font-weight: 700; color: #f8e365; background: rgba(248, 227, 101, 0.08); padding: 2px 10px; border-radius: 30px; display: inline-block; text-align: center; min-width: 50px; }
.scenario-table .s-cum { font-weight: 600; color: ${C.cardFg}; }
.scenario-table .s-range { direction: ltr; font-weight: 500; color: ${C.cardSubFg}; }
.scenario-table tr.up { border-right: 4px solid ${C.bullColor}; }
.scenario-table tr.down { border-right: 4px solid ${C.bearColor}; }
.scenario-table tr.pullback { border-right: 4px solid ${C.neutralColor}; }
.scenario-table tr { transition: 0.15s; }
.scenario-table tr:hover { background: ${C.cardBorder}; }
.analysis-text { background: ${C.cardBg}; border-radius: 16px; padding: 18px 20px; border: 1px solid ${C.cardBorder}; line-height: 1.8; font-size: 0.95rem; color: ${C.cardFg}; }
.analysis-text strong { color: #f8e365; }
.highlight-box { background: rgba(248, 227, 101, 0.06); border-right: 4px solid #f8e365; padding: 12px 16px; border-radius: 12px; margin: 12px 0; }
.summary-bar { display: flex; gap: 16px; justify-content: center; margin-top: 12px; font-size: 0.8rem; flex-wrap: wrap; }
.strategy-tag { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; border: 1px solid; }
.footer { margin-top: 18px; color: ${C.cardSubFg}; font-size: 0.75rem; text-align: center; border-top: 1px solid ${C.cardBorder}; padding-top: 16px; }
#chart-container { width: 100%; border-radius: 16px; overflow: hidden; }
#chart-legend { display: flex; gap: 16px; padding: 8px 16px; font-size: 0.8rem; color: ${chartText}; direction: ltr; text-align: left; flex-wrap: wrap; background: ${chartBg}; border-bottom: 1px solid ${chartBorder}; min-height: 32px; align-items: center; }
#chart-legend span { white-space: nowrap; }
#chart-legend .up { color: #22c55e; }
#chart-legend .dn { color: #ef4444; }
</style>
</head>
<body>
<div class="app">
<header class="header">
  <h1>📈 تحلیل تکنیکال · ${symbolName}</h1>
  <div class="sub">
    <span>📍 قیمت مرجع: <b style="color:${C.cardFg}">${toFa(currentPrice)} ${unit}</b></span>
    <span>🎯 هدف کوتاه‌مدت: <b style="color:${C.cardFg}">${toFa(targetMin)} – ${toFa(targetMax)} ${unit}</b></span>
    ${lastCandleJalali ? `<span>📅 تاریخ: ${lastCandleJalali}</span>` : ''}
  </div>
</header>

<div class="panel" style="padding:8px 0 0 0;overflow:hidden;">
  <div id="chart-legend"></div>
  <div id="chart-container"></div>
</div>

<script>
(function(){
  var cd = ${candleDataJSON};
  var dl = ${dateLabelsJSON};
  var pl = ${priceLinesJSON};

  var PD='\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
  function toPD(s){return String(s).replace(/\d/g,function(m){return PD[+m]})}
  function toFa(n){return toPD(n.toLocaleString('en',{maximumFractionDigits:${decimals},minimumFractionDigits:0}))}
  function formatVol(v){if(v>=1e9)return toPD((v/1e9).toFixed(1))+'B';if(v>=1e6)return toPD((v/1e6).toFixed(1))+'M';if(v>=1e3)return toPD((v/1e3).toFixed(1))+'K';return toFa(v)}

  var chartEl = document.getElementById('chart-container');
  var legendEl = document.getElementById('chart-legend');
  var BULL='#22c55e',BEAR='#ef4444';

  var chart = LightweightCharts.createChart(chartEl,{
    layout:{background:{type:LightweightCharts.ColorType.Solid,color:'${chartBg}'},textColor:'${chartText}',fontSize:11},
    grid:{vertLines:{color:'${chartGrid}'},horzLines:{color:'${chartGrid}'}},
    crosshair:{mode:LightweightCharts.CrosshairMode.Normal,vertLine:{color:'${crosshairColor}',labelBackgroundColor:'${chartBg}'},horzLine:{color:'${crosshairColor}',labelBackgroundColor:'${chartBg}'}},
    rightPriceScale:{borderColor:'${chartBorder}',scaleMargins:{top:0.05,bottom:0.3}},
    timeScale:{borderColor:'${chartBorder}',rightOffset:5,barSpacing:6,tickMarkFormatter:function(t){return dl[t]||String(t)}},
    localization:{priceFormatter:function(p){return toPD(p.toLocaleString('en',{maximumFractionDigits:${decimals}}))}},
    width:chartEl.clientWidth,height:520
  });

  var cs=chart.addSeries(LightweightCharts.CandlestickSeries,{
    upColor:BULL,downColor:BEAR,borderUpColor:BULL,borderDownColor:BEAR,wickUpColor:BULL,wickDownColor:BEAR
  });
  cs.setData(cd.map(function(d){return{time:d.time,open:d.o,high:d.h,low:d.l,close:d.c}}));

  var vol=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'custom',formatter:formatVol},priceScaleId:'vol'});
  vol.setData(cd.map(function(d){return{time:d.time,value:d.v,color:d.c>=d.o?BULL:BEAR}}));
  chart.priceScale('vol').applyOptions({scaleMargins:{top:0.8,bottom:0}});

  pl.forEach(function(l){
    cs.createPriceLine({price:l.price,color:l.color,lineWidth:l.lineWidth,lineStyle:l.lineStyle,axisLabelVisible:true,title:l.title});
  });

  chart.subscribeCrosshairMove(function(p){
    if(!p.time&&p.time!==0){legendEl.innerHTML='';return}
    var d=cd[p.time];if(!d){legendEl.innerHTML='';return}
    var prev=p.time>0?cd[p.time-1]:d;
    var chg=prev.c>0?((d.c-prev.c)/prev.c*100):0;
    var cls=chg>=0?'up':'dn';
    legendEl.innerHTML='<span>'+dl[p.time]+'</span> <span>O: '+toFa(d.o)+'</span> <span>H: '+toFa(d.h)+'</span> <span>L: '+toFa(d.l)+'</span> <span>C: <b class="'+cls+'">'+toFa(d.c)+'</b></span> <span>Vol: '+formatVol(d.v)+'</span> <span class="'+cls+'">'+toPD(chg.toFixed(2))+'%</span>';
  });

  chart.timeScale().fitContent();

  window.addEventListener('resize',function(){
    chart.applyOptions({width:chartEl.clientWidth});
  });
})();
</script>

<div class="grid-2">
  <div class="level-box resistance">
    <h3 style="color:${C.bearColor}">⚠️ مقاومت‌ها</h3>
    ${resistanceStrengths.slice(0, 6).map((r, i) => {
      const grade = r.grade ? (GRADE_MAP[r.grade]?.label ?? r.grade) : '';
      return `<div class="level-row"><span>${grade ? `<span class="badge">${grade}</span>` : ''} R${toFa(i + 1)}</span><span class="price">${toFa(r.price)}</span></div>`;
    }).join('')}
  </div>
  <div class="level-box support">
    <h3 style="color:${C.bullColor}">🛡️ حمایت‌ها</h3>
    ${supportStrengths.slice(0, 6).map((s, i) => {
      const grade = s.grade ? (GRADE_MAP[s.grade]?.label ?? s.grade) : '';
      return `<div class="level-row"><span>${grade ? `<span class="badge">${grade}</span>` : ''} S${toFa(i + 1)}</span><span class="price">${toFa(s.price)}</span></div>`;
    }).join('')}
  </div>
</div>

<div class="panel">
  <h2>🎯 <span>سناریوها · احتمال اختصاصی و تجمعی</span></h2>
  <div class="scenario-table-wrap">
    <table class="scenario-table">
      <thead>
        <tr>
          <th>سناریو</th>
          <th style="text-align:center">احتمال اختصاصی</th>
          <th style="text-align:center">احتمال تجمعی</th>
          <th style="text-align:left">هدف قیمتی</th>
        </tr>
      </thead>
      <tbody>
        ${[...SCENARIO_KEYS].reverse().map(key => {
          const s = scenarios[key];
          if (!s) return '';
          const m = SCENARIO_META[key];
          const v = v11Map.get(key);
          const rowType = m.type === 'up' ? 'up' : m.type === 'down' ? 'down' : 'pullback';
          return `<tr class="${rowType}">
            <td>${key} — ${m.label}</td>
            <td style="text-align:center"><span class="s-prob">${toFa(v?.rawProbability ?? s.probability)}٪</span></td>
            <td style="text-align:center"><span class="s-cum">${toFa(v?.cumulativeProbability ?? 0)}٪</span></td>
            <td class="s-range">${toFa(s.targetMin)} — ${toFa(s.targetMax)} ${unit}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
  <div class="summary-bar">
    <span style="color:${C.bullColor}">▲ صعودی: <b>${toFa(v11Result.bullishCumulative)}٪</b></span>
    <span style="color:${C.neutralColor}">● رنج: <b>${toFa(v11Result.neutralCumulative)}٪</b></span>
    <span style="color:${C.bearColor}">▼ نزولی: <b>${toFa(v11Result.bearishCumulative)}٪</b></span>
    <span style="color:${C.cardSubFg}">مجموع: <b style="color:${C.cardFg}">${toFa(totalProb)}٪</b></span>
  </div>
</div>

<div class="panel">
  <h2>🧠 <span>تحلیل جامع</span></h2>
  <div class="analysis-text">${analysisHTML}</div>
</div>

<div style="text-align:center;padding:12px">
  <span class="strategy-tag" style="color:${strategyType === 'up' ? C.bullColor : strategyType === 'down' ? C.bearColor : C.neutralColor};border-color:${strategyType === 'up' ? C.bullColor : strategyType === 'down' ? C.bearColor : C.neutralColor};background:${strategyType === 'up' ? C.bullBg : strategyType === 'down' ? C.bearBg : C.neutralBg}">${strategy.text}</span>
</div>

<footer class="footer">
  تمامی تحلیل‌ها بر اساس داده‌های تکنیکال، سطوح کلیدی و روندهای گذشته تدوین شده است. این محتوا صرفاً جنبه آموزشی و تحلیلی دارد و توصیه سرمایه‌گذاری محسوب نمی‌شود.
</footer>
</div>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    nativeSaveAs(blob, `${fileBase}.html`);
  }, [symbolName, candles, currentPrice, targetMin, targetMax, scenarios, totalProb, strategy, strategyType, lastCandleJalali, fileBase, v11Result, v11Map, resistanceStrengths, supportStrengths, isDark, resistances, supports, ma21, ma100, sar, bollingerUpper, bollingerMiddle, bollingerLower, decimals, unit, C]);


  const exportText = useCallback(() => {
    const lines: string[] = [];
    lines.push(`تحلیل تکنیکال ${symbolName} — توضیح‌دهنده تصویری`);
    if (lastCandleJalali) lines.push(`تاریخ: ${lastCandleJalali}`);
    lines.push('');
    lines.push(`قیمت مرجع: ${toFa(currentPrice)} ${unit}`);
    lines.push(`هدف کوتاه‌مدت: ${toFa(targetMin)} — ${toFa(targetMax)} ${unit}`);
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
      lines.push(`${k} — ${m.label}: اختصاصی ${toFa(s.probability)}٪ | تجمعی ${toFa(v?.cumulativeProbability ?? 0)}٪ | هدف: ${toFa(s.targetMin)} — ${toFa(s.targetMax)} ${unit}`);
    }
    lines.push('');
    lines.push(`مجموع صعودی: ${toFa(v11Result.bullishCumulative)}٪ | رنج: ${toFa(v11Result.neutralCumulative)}٪ | مجموع نزولی: ${toFa(v11Result.bearishCumulative)}٪`);
    lines.push(`سیگنال غالب: ${strategy.text}`);
    const text = lines.join('\n');
    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    nativeSaveAs(blob, `${fileBase}.txt`);
  }, [symbolName, currentPrice, targetMin, targetMax, trendText, rsi, rsiSignal, scenarios, strategy, lastCandleJalali, fileBase, v11Result, v11Map, riskInfo, unit, decimals]);

  const exportPDF = useCallback(async () => {
    const el = vdesRef.current;
    if (!el || !el.isConnected || el.offsetWidth === 0) return;
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
      const originalDisplay = el.style.display;
      const originalVisibility = el.style.visibility;
      if (el.offsetHeight === 0) {
        el.style.display = 'block';
        el.style.visibility = 'visible';
        await new Promise(r => setTimeout(r, 100));
      }
      const dataUrl = await toPng(el, { backgroundColor: C.pageBg, pixelRatio: 2, cacheBust: true, skipAutoScale: true });
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
  }, [fileBase, C]);

  const exportExcel = useCallback(async () => {
    try {
      const XLSX = await import('xlsx');
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
        'احتمال اختصاصی٪': scenarios[k]?.probability ?? 0,
        'احتمال تجمعی٪': v11Map.get(k)?.cumulativeProbability ?? 0,
        'هدف_حداقل': Math.round(scenarios[k]?.targetMin ?? 0),
        'هدف_حداکثر': Math.round(scenarios[k]?.targetMax ?? 0),
      }));
      const ws2 = XLSX.utils.json_to_sheet(scenarioRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'سناریوها');
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
    } catch (err) {
      console.warn('Excel export failed:', err instanceof Error ? err.message : String(err));
    }
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
    nativeSaveAs(blob, `${fileBase}.csv`);
  }, [dailyIndicators, fileBase]);

  // ── Decision Graph Export ─────────────────────────────────────
  const exportDecisionGraph = useCallback(async () => {
    if (!decisionGraph) return;
    const { exportDecisionGraphHTML } = await import('@/lib/decision-graph-export');
    const { generateDecisionGraphNarrative } = await import('@/components/tse/vdss-graph');

    const scenariosRecord: Record<string, { name: string; probability: number; targetMin: number; targetMax: number; description: string }> = {};
    for (const [k, v] of Object.entries(scenarios)) {
      const s = v as { name: string; nameEn: string; probability: number; targetMin: number; targetMax: number; description: string };
      scenariosRecord[k] = { name: s.name, probability: s.probability, targetMin: s.targetMin, targetMax: s.targetMax, description: s.description };
    }

    const narrative = generateDecisionGraphNarrative({
      symbolName,
      currentPrice,
      currencyUnit: unit,
      scenarios,
      decisionGraph: decisionGraph as any,
      probabilityTrend: probabilityTrend as any,
      branchProbs: decisionGraph.branchProbabilities,
      pathContributions: decisionGraph.pathContributions,
      scenarioProbabilities: decisionGraph.scenarioProbabilities,
    });

    exportDecisionGraphHTML({
      symbolName,
      currentPrice,
      currencyUnit: unit,
      scenarios: scenariosRecord,
      decisionGraph: decisionGraph as any,
      probabilityTrend: probabilityTrend as any,
      branchProbabilities: decisionGraph.branchProbabilities,
      pathContributions: decisionGraph.pathContributions,
      narrative,
    });
  }, [decisionGraph, symbolName, currentPrice, unit, scenarios, probabilityTrend]);

  // ── Chart Image Export ─────────────────────────────────────────
  const exportChartImage = useCallback(async () => {
    const chartEl = document.getElementById('chart-export-wrapper');
    if (!chartEl || !chartEl.isConnected || chartEl.offsetWidth === 0) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(chartEl, { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true });
      nativeSaveAs(dataUrl, `${fileBase}_نمودار.png`);
    } catch (err) {
      console.warn('Chart image export failed:', err instanceof Error ? err.message : String(err));
    }
  }, [fileBase]);

  return (
    <div ref={vdesRef} className="space-y-7" dir="rtl" style={{ background: C.pageBg, padding: '20px 16px 40px', borderRadius: '16px' }}>

      {/* ═══ HEADER ═══ */}
      <header
        className="mb-7"
        style={{
          background: C.cardBg,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: `1px solid ${C.primary}`,
          borderRadius: '32px',
          padding: '26px 32px',
          boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.6)' : '0 4px 16px rgba(0,0,0,.08)',
        }}
      >
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: C.primary, marginBottom: '6px' }}>
          📈 تحلیل تکنیکال · {symbolName}
        </h1>
        <div className="flex flex-wrap gap-3" style={{ marginTop: '8px' }}>
          <span style={{
            background: C.cardBg, padding: '4px 14px', borderRadius: '40px',
            border: `1px solid ${C.cardBorder}`, color: C.cardSubFg, fontSize: '0.95rem',
          }}>
            📍 قیمت مرجع: <b style={{ color: C.cardFg }}>{toFa(currentPrice)} {unit}</b>
          </span>
          <span style={{
            background: C.cardBg, padding: '4px 14px', borderRadius: '40px',
            border: `1px solid ${C.cardBorder}`, color: C.cardSubFg, fontSize: '0.95rem',
          }}>
            🎯 هدف کوتاه‌مدت: <b style={{ color: C.cardFg }}>{toFa(targetMin)} – {toFa(targetMax)} {unit}</b>
          </span>
          {lastCandleJalali && (
            <span style={{
              background: C.cardBg, padding: '4px 14px', borderRadius: '40px',
              border: `1px solid ${C.cardBorder}`, color: C.cardSubFg, fontSize: '0.95rem',
            }}>
              📅 تاریخ: {lastCandleJalali}
            </span>
          )}
        </div>
      </header>

      {/* ═══ EXPORT TOOLBAR ═══ */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.cardFg }}>خروجی تحلیل</span>
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
              <span className="text-xs">HTML+CSS+JS</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportText} className="flex items-center gap-3 cursor-pointer" style={{ color: C.cardFg }}>
              <FileText className="w-4 h-4" style={{ color: C.primary }} />
              <span className="text-xs">متن (Text)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPDF} className="flex items-center gap-3 cursor-pointer" style={{ color: C.cardFg }}>
              <FileDown className="w-4 h-4" style={{ color: C.primary }} />
              <span className="text-xs">PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportExcel} className="flex items-center gap-3 cursor-pointer" style={{ color: C.cardFg }}>
              <Table className="w-4 h-4" style={{ color: C.primary }} />
              <span className="text-xs">اکسل (Excel)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportCSV} className="flex items-center gap-3 cursor-pointer" style={{ color: C.cardFg }}>
              <FileSpreadsheet className="w-4 h-4" style={{ color: C.primary }} />
              <span className="text-xs">CSV</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportChartImage} className="flex items-center gap-3 cursor-pointer" style={{ color: C.cardFg }}>
              <ImageIcon className="w-4 h-4" style={{ color: C.primary }} />
              <span className="text-xs">عکس نمودار (PNG)</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: C.cardBorder }} />
            <DropdownMenuItem onClick={exportDecisionGraph} className="flex items-center gap-3 cursor-pointer" style={{ color: C.cardFg }}>
              <Network className="w-4 h-4" style={{ color: '#a04ac5' }} />
              <span className="text-xs">گراف تصمیم (HTML)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ═══ CHART ═══ */}
      {/* Chart is rendered above this component in page.tsx (v3.0) */}

      {/* ═══ KEY LEVELS (Support/Resistance) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ marginBottom: '24px' }}>
        {/* ── Resistances ── */}
        <div style={{
          background: C.cardBg, borderRadius: '16px', padding: '16px 18px',
          border: `1px solid ${C.cardBorder}`, height: '100%',
        }}>
          <h3 style={{
            fontSize: '1.1rem', color: C.bearColor, marginBottom: '14px',
            borderBottom: `1px solid ${C.cardBorder}`, paddingBottom: '10px',
          }}>
            ⚠️ مقاومت‌ها
          </h3>
          {resistanceStrengths.slice(0, 6).map((r, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: `1px solid ${C.cardBorder}`, fontSize: '0.95rem',
            }}>
              <div className="flex items-center gap-2">
                {r.grade && (
                  <span style={{
                    fontSize: '0.7rem', background: C.cardBorder,
                    padding: '0 10px', borderRadius: '30px', color: C.cardSubFg,
                  }}>
                    {GRADE_MAP[r.grade]?.label ?? r.grade}
                  </span>
                )}
                <span style={{ fontSize: '0.8rem', color: C.cardSubFg }}>R{toFa(i + 1)}</span>
              </div>
              <span style={{ fontWeight: 700, color: C.bearColor, direction: 'ltr' as const }}>
                {toFa(r.price)}
              </span>
            </div>
          ))}
        </div>

        {/* ── Supports ── */}
        <div style={{
          background: C.cardBg, borderRadius: '16px', padding: '16px 18px',
          border: `1px solid ${C.cardBorder}`, height: '100%',
        }}>
          <h3 style={{
            fontSize: '1.1rem', color: C.bullColor, marginBottom: '14px',
            borderBottom: `1px solid ${C.cardBorder}`, paddingBottom: '10px',
          }}>
            🛡️ حمایت‌ها
          </h3>
          {supportStrengths.slice(0, 6).map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: `1px solid ${C.cardBorder}`, fontSize: '0.95rem',
            }}>
              <div className="flex items-center gap-2">
                {s.grade && (
                  <span style={{
                    fontSize: '0.7rem', background: C.cardBorder,
                    padding: '0 10px', borderRadius: '30px', color: C.cardSubFg,
                  }}>
                    {GRADE_MAP[s.grade]?.label ?? s.grade}
                  </span>
                )}
                <span style={{ fontSize: '0.8rem', color: C.cardSubFg }}>S{toFa(i + 1)}</span>
              </div>
              <span style={{ fontWeight: 700, color: C.bullColor, direction: 'ltr' as const }}>
                {toFa(s.price)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SCENARIO PROBABILITIES (V11) — TABLE FORMAT ═══ */}
      <div style={{
        background: C.cardBg, backdropFilter: 'blur(8px)',
        border: `1px solid ${C.cardBorder}`, borderRadius: '28px',
        padding: '22px 24px', boxShadow: isDark ? '0 20px 40px -12px rgba(0, 0, 0, 0.5)' : '0 4px 16px rgba(0,0,0,.08)',
      }}>
        <h2 style={{
          fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px',
          color: C.cardFg, display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span>🎯</span> <span>سناریوها · احتمال اختصاصی و تجمعی</span>
        </h2>
        <div style={{ overflowX: 'auto', borderRadius: '16px', border: `1px solid ${C.cardBorder}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.95rem', minWidth: '500px' }}>
            <thead>
              <tr style={{ background: C.cardBorder, borderBottom: `2px solid ${C.cardBorder}` }}>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: C.cardSubFg, fontSize: '0.85rem' }}>سناریو</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: C.cardSubFg, fontSize: '0.85rem' }}>احتمال اختصاصی</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: C.cardSubFg, fontSize: '0.85rem' }}>احتمال تجمعی</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: C.cardSubFg, fontSize: '0.85rem' }}>هدف قیمتی</th>
              </tr>
            </thead>
            <tbody>
              {[...SCENARIO_KEYS].reverse().map((key, idx, arr) => {
                const s = scenarios[key];
                if (!s) return null;
                const meta = SCENARIO_META[key];
                const v11 = v11Map.get(key);
                const rowType = meta.type === 'up' ? 'up' : meta.type === 'down' ? 'down' : 'pullback';
                const borderColor = rowType === 'up' ? C.bullColor : rowType === 'down' ? C.bearColor : C.neutralColor;
                const isLast = idx === arr.length - 1;
                return (
                  <tr key={key} style={{
                    borderRight: `4px solid ${borderColor}`,
                    borderBottom: isLast ? 'none' : `1px solid ${C.cardBorder}`,
                    transition: '0.15s',
                  }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: C.cardFg }}>{key} — {meta.label}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{
                        fontWeight: 700, color: C.primary, background: C.primaryBg,
                        padding: '2px 10px', borderRadius: '30px', display: 'inline-block',
                        textAlign: 'center', minWidth: '50px',
                      }}>
                        {toFa(v11?.rawProbability ?? s.probability)}٪
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 600, color: C.cardFg }}>
                        {toFa(v11?.cumulativeProbability ?? 0)}٪
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', direction: 'ltr', textAlign: 'left', fontWeight: 500, color: C.cardSubFg }}>
                      {toFa(s.targetMin)} — {toFa(s.targetMax)} {unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '0.8rem', flexWrap: 'wrap' }}>
          <span style={{ color: C.bullColor }}>▲ صعودی: <b>{toFa(v11Result.bullishCumulative)}٪</b></span>
          <span style={{ color: C.neutralColor }}>● رنج: <b>{toFa(v11Result.neutralCumulative)}٪</b></span>
          <span style={{ color: C.bearColor }}>▼ نزولی: <b>{toFa(v11Result.bearishCumulative)}٪</b></span>
          <span style={{ color: C.cardSubFg }}>مجموع: <b style={{ color: C.cardFg }}>{toFa(totalProb)}٪</b></span>
        </div>
      </div>

      {/* ═══ ANALYSIS TEXT ═══ */}
      <div style={{
        background: C.cardBg, backdropFilter: 'blur(8px)',
        border: `1px solid ${C.cardBorder}`, borderRadius: '28px',
        padding: '22px 24px', boxShadow: isDark ? '0 20px 40px -12px rgba(0, 0, 0, 0.5)' : '0 4px 16px rgba(0,0,0,.08)',
      }}>
        <h2 style={{
          fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px',
          color: C.cardFg, display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span>🧠</span> <span>تحلیل جامع</span>
        </h2>
        <div
          className="vdes-analysis-text max-h-[400px] overflow-y-auto pr-1 [&_strong]:font-bold"
          style={{
            background: C.cardBg, borderRadius: '16px',
            padding: '18px 20px', border: `1px solid ${C.cardBorder}`,
            lineHeight: 1.8, fontSize: '0.95rem', color: C.cardFg,
          }}
          dir="rtl"
        >
          {aiLoading && (
            <div className="flex flex-col items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-[rgba(37,99,235,0.3)] border-t-[#2563eb] rounded-full animate-spin" />
              <span style={{ fontSize: '0.875rem', color: C.primary }}>
                در حال تولید تحلیل هوشمند ...
              </span>
            </div>
          )}
          {aiError && !aiText && (
            <div style={{ borderRadius: '12px', padding: '16px', background: 'rgba(255,117,138,0.08)', border: '1px solid rgba(255,117,138,0.2)' }}>
              <p style={{ fontSize: '0.75rem', color: C.bearColor, marginBottom: '4px' }}>خطا در تولید تحلیل هوشمند:</p>
              <p style={{ fontSize: '0.75rem', color: C.bearColor, marginBottom: '8px', opacity: 0.8 }}>{aiError.length > 150 ? aiError.slice(0, 150) + '...' : aiError}</p>
              <button
                onClick={() => {
                  setAiError(null);
                  setAiText(null);
                  aiAutoRetryRef.current = 0;
                  setAiRetryKey(k => k + 1);
                }}
                style={{ fontSize: '0.75rem', fontWeight: 500, color: C.bearColor, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              >تلاش مجدد</button>
            </div>
          )}
          {!aiLoading && aiText && (
            <div>
              {aiIsFallback && (
                <div style={{ fontSize: '0.7rem', color: C.cardSubFg, marginBottom: '8px', opacity: 0.7 }}>
                  ⚠️ تحلیل هوشمند در دسترس نبود. متن با روش‌های تحلیلی مبتنی بر قوانین تولید شده است.
                </div>
              )}
              {/* Cache age indicator and new analysis button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', direction: 'rtl' }}>
                <div style={{ fontSize: '0.7rem', color: C.cardSubFg, opacity: 0.8 }}>
                  {aiCachedAge !== null && aiCachedAge > 0 && (
                    <span>⏱ تحلیل بر اساس قیمت {formatPriceShort(aiPriceAtGen ?? currentPrice)} ({toFa(Math.round(aiCachedAge / 60))} دقیقه پیش)</span>
                  )}
                  {aiCachedAge !== null && aiCachedAge === 0 && (
                    <span>✅ تحلیل بر اساس قیمت لحظه‌ای</span>
                  )}
                  {aiCachedAge === null && aiPriceAtGen !== null && (
                    <span>📊 قیمت تحلیل: {formatPriceShort(aiPriceAtGen)}</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    aiAutoRetryRef.current = 0;
                    setAiForceRefresh(true);
                  }}
                  style={{
                    fontSize: '0.7rem', fontWeight: 600, color: C.primary,
                    background: C.primaryBg, border: `1px solid ${C.primary}`,
                    borderRadius: '8px', padding: '3px 10px', cursor: 'pointer',
                    lineHeight: 1.5, whiteSpace: 'nowrap',
                  }}
                >🔄 تحلیل جدید</button>
              </div>
              <div dangerouslySetInnerHTML={{ __html: renderAIText(aiText) }} />
            </div>
          )}
          {!aiLoading && !aiText && !aiError && analysisParagraphs.length > 0 && (
            <div className="space-y-4">
              {/* Fallback warning banner */}
              <div style={{
                background: 'rgba(180, 83, 9, 0.08)',
                borderRight: '4px solid #b45309',
                padding: '10px 14px',
                borderRadius: '10px',
                marginBottom: '8px',
                direction: 'rtl',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}>
                <span style={{ color: '#b45309', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.7 }}>
                  ⚠️ این تحلیل به صورت خودکار (بدون AI) تولید شده است.
                </span>
                <button
                  onClick={() => {
                    setAiRetryKey(k => k + 1);
                    setAiLoading(true);
                    setAiText(null);
                    setAiError(null);
                    aiAutoRetryRef.current = 0;
                  }}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#b45309',
                    background: 'rgba(180, 83, 9, 0.12)',
                    border: '1px solid #b45309',
                    borderRadius: '8px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    lineHeight: 1.5,
                    whiteSpace: 'nowrap',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(180, 83, 9, 0.2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(180, 83, 9, 0.12)'; }}
                >🧠 تلاش مجدد برای تحلیل هوشمند</button>
              </div>
              {analysisParagraphs.map((p, i) => (
                <p key={i} style={{ color: C.cardFg }}>{p}</p>
              ))}
              <div style={{
                background: C.primaryBg, borderRight: '4px solid ' + C.primary,
                padding: '12px 16px', borderRadius: '12px', marginTop: '12px',
              }}>
                <strong style={{ color: C.primary, fontSize: '0.875rem' }}>استراتژی پیشنهادی:</strong>
                <p style={{ color: C.cardFg, fontSize: '0.75rem', lineHeight: 1.85, marginTop: '6px' }}>{strategyText}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ STRATEGY TAG ═══ */}
      <div style={{ textAlign: 'center', padding: '12px' }}>
        <span style={{
          display: 'inline-block', padding: '6px 16px', borderRadius: '20px',
          fontSize: '0.75rem', fontWeight: 700,
          border: `1px solid ${strategyType === 'up' ? C.bullColor : strategyType === 'down' ? C.bearColor : C.neutralColor}`,
          background: strategyType === 'up' ? C.bullBg : strategyType === 'down' ? C.bearBg : C.neutralBg,
          color: strategyType === 'up' ? C.bullColor : strategyType === 'down' ? C.bearColor : C.neutralColor,
        }}>
          {strategy.text}
        </span>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        marginTop: '18px', color: C.cardSubFg, fontSize: '0.75rem', textAlign: 'center',
        borderTop: `1px solid ${C.cardBorder}`, paddingTop: '16px',
      }}>
        تمامی تحلیل‌ها بر اساس داده‌های تکنیکال، سطوح کلیدی و روندهای گذشته تدوین شده است. این محتوا صرفاً جنبه آموزشی و تحلیلی دارد و توصیه سرمایه‌گذاری محسوب نمی‌شود.
      </footer>
    </div>
  );

}

// ── Loading ────────────────────────────────────────────────────────────────────

export function VdesAnalysisSkeleton() {
  const { colors: C } = useTheme();
  return (
    <div className="space-y-7" style={{ background: C.pageBg, padding: '20px 16px 40px', borderRadius: '16px' }}>
      <Skeleton className="h-28 w-full rounded-[32px]" style={{ background: C.cardBg }} />
      <Skeleton className="h-[500px] w-full rounded-[28px]" style={{ background: C.cardBg }} />
    </div>
  );
}