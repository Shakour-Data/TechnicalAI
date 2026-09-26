'use client';

import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toPersianDigits } from '@/lib/jalali';
import { useTheme } from '@/lib/theme-store';
import { formatPriceFa } from '@/lib/format-price';
import { detectAllPatterns, PatternResult, DetectedPatterns } from '@/lib/pattern-detection';
import { recordPatternsForSymbol, getAccuracyReport, SymbolAccuracyReport, ConfusionMatrixEntry, PatternAccuracyStats } from '@/lib/pattern-accuracy';
import { Activity, TrendingUp, TrendingDown, ChevronDown, FileCode, FileText, HelpCircle, Filter, BarChart3, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PatternsPanelProps {
  data: {
    symbol: string;
    candles: OHLCV[];
    info?: {
      name: string;
      symbol: string;
      lastPrice: number;
      change: number;
      closePrice: number;
      openPrice: number;
      minPrice: number;
      maxPrice: number;
      yesterdayClose: number;
      volume: number;
      value: number;
      trades: number;
      eps: number;
      pe: number;
      currencyUnit?: string;
      decimals?: number;
    } | null;
    ta?: any;
    isTgju?: boolean;
    isYahoo?: boolean;
  } | null;
  priceDecimals?: number;
  instrumentCategory?: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const toFa = (n: number, decimals: number = 0) => formatPriceFa(n, decimals);
const toPercent = (v: number) => Math.round(v * 100);
const toFaDigits = (n: number) => toPersianDigits(n.toString());

function categoryColor(category: string, C: any): string {
  switch (category) {
    case 'classic': return C.primary;
    case 'harmonic': return '#a855f7';
    case 'candlestick': return '#f59e0b';
    case 'elliott': return '#06b6d4';
    default: return C.cardSubFg;
  }
}

function categoryLabel(category: string): string {
  switch (category) {
    case 'classic': return 'کلاسیک';
    case 'harmonic': return 'هارمونیک';
    case 'candlestick': return 'کندل‌استیک';
    case 'elliott': return 'موج الیوت';
    default: return category;
  }
}

function directionColor(direction: string, C: any): string {
  if (direction === 'bullish') return C.bullColor;
  if (direction === 'bearish') return C.bearColor;
  return C.neutralColor;
}

function directionLabel(direction: string): string {
  if (direction === 'bullish') return 'صعودی';
  if (direction === 'bearish') return 'نزولی';
  return 'خنثی';
}

function statusLabel(status: string): string {
  if (status === 'completed') return 'تکمیل';
  if (status === 'forming') return 'در حال شکل‌گیری';
  if (status === 'failed') return 'شکسته';
  return status;
}

function SignalDot({ signal }: { signal: 'bullish' | 'bearish' | 'neutral' }) {
  const { colors: C } = useTheme();
  const bg = signal === 'bullish' ? C.bullColor : signal === 'bearish' ? C.bearColor : C.cardSubFg;
  return <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: bg }} />;
}

function SectionHeader({ title }: { title: string }) {
  const { colors: C } = useTheme();
  return <h3 className="col-span-full text-xs font-semibold text-amber-400/80 mt-5 mb-1.5 first:mt-0">{title}</h3>;
}

function LoadingSkeleton() {
  const { colors: C } = useTheme();
  return (
    <div className="rounded-2xl p-4 space-y-4" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-36 bg-white/5" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-20 w-full bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PatternCard({ pattern, C }: { pattern: PatternResult; C: any }) {
  const catColor = categoryColor(pattern.category, C);
  const dirColor = directionColor(pattern.direction, C);
  const strengthPct = Math.round(pattern.strength * 100);

  return (
    <div className="rounded-xl p-3" style={{ background: hexToRgba(catColor, 0.06), border: `1px solid ${hexToRgba(catColor, 0.15)}` }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate" style={{ color: C.cardFg }}>{pattern.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: hexToRgba(catColor, 0.15), color: catColor }}>
              {categoryLabel(pattern.category)}
            </span>
          </div>
          <span className="text-[10px] truncate" style={{ color: C.cardSubFg }}>{pattern.nameEn}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: hexToRgba(dirColor, 0.15), color: dirColor }}>
            {directionLabel(pattern.direction)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: hexToRgba(C.cardSubFg, 0.15), color: C.cardSubFg }}>
            {statusLabel(pattern.status)}
          </span>
        </div>
      </div>

      <div className="text-[11px] mb-2" style={{ color: C.cardSubFg }}>
        {pattern.description}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold" style={{ color: catColor }}>{toFaDigits(strengthPct)}%</span>
          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: hexToRgba(catColor, 0.15) }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${strengthPct}%`, background: catColor }} />
          </div>
        </div>
        {pattern.priceLevel && (
          <span className="text-[10px] font-medium tabular-nums" style={{ color: C.cardSubFg }} dir="ltr">
            {toFa(pattern.priceLevel, 2)}
          </span>
        )}
      </div>
    </div>
  );
}

function PatternAccuracyRow({ entry, C }: { entry: ConfusionMatrixEntry; C: any }) {
  const accuracyPct = Math.round(entry.accuracy * 100);
  const catColor = categoryColor(entry.category as 'classic' | 'harmonic' | 'candlestick' | 'elliott', C);

  return (
    <div className="rounded-lg p-2" style={{ background: hexToRgba(catColor, 0.05), border: `1px solid ${hexToRgba(catColor, 0.12)}` }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium truncate" style={{ color: C.cardFg }}>{entry.patternName}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: hexToRgba(catColor, 0.15), color: catColor }}>
          {accuracyPct}%
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        <div className="text-center">
          <span style={{ color: C.bullColor }}>TP: {entry.truePositive}</span>
        </div>
        <div className="text-center">
          <span style={{ color: C.bearColor }}>FP: {entry.falsePositive}</span>
        </div>
        <div className="text-center">
          <span style={{ color: C.cardSubFg }}>FN: {entry.falseNegative}</span>
        </div>
        <div className="text-center">
          <span style={{ color: C.cardSubFg }}>TN: {entry.trueNegative}</span>
        </div>
      </div>
      <div className="w-full h-1 rounded-full mt-1" style={{ background: hexToRgba(catColor, 0.15) }}>
        <div className="h-full rounded-full" style={{ width: `${accuracyPct}%`, background: catColor }} />
      </div>
    </div>
  );
}

function AccuracyReportCard({ report, C }: { report: SymbolAccuracyReport; C: any }) {
  const overallPct = Math.round(report.overallAccuracy * 100);

  return (
    <div className="rounded-xl p-4" style={{ background: hexToRgba(C.primary, 0.04), border: `1px solid ${hexToRgba(C.primary, 0.15)}` }}>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4" style={{ color: C.primary }} />
        <span className="text-sm font-semibold" style={{ color: C.cardFg }}>دقت تشخیص الگو (Accuracy Matrix)</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto" style={{ background: hexToRgba(C.primary, 0.15), color: C.primary }}>
          {overallPct}% کل
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="text-center">
          <span className="text-lg font-bold" style={{ color: C.primary }}>{report.totalPatterns}</span>
          <div className="text-[10px]" style={{ color: C.cardSubFg }}>کل تشخیص</div>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold" style={{ color: C.bullColor }}>{report.patterns.filter(p => p.confirmed > 0).length}</span>
          <div className="text-[10px]" style={{ color: C.cardSubFg }}>الگوی تأیید شده</div>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold" style={{ color: C.bearColor }}>{report.patterns.filter(p => p.failed > 0).length}</span>
          <div className="text-[10px]" style={{ color: C.cardSubFg }}>الگوی ناموفق</div>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold" style={{ color: C.cardSubFg }}>{report.patterns.length}</span>
          <div className="text-[10px]" style={{ color: C.cardSubFg }}>نوع الگو</div>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {report.confusionMatrix.slice(0, 8).map((entry, i) => (
          <PatternAccuracyRow key={i} entry={entry} C={C} />
        ))}
      </div>
    </div>
  );
}

function FormingPatternsOnly({ patterns, C }: { patterns: PatternResult[]; C: any }) {
  const sorted = patterns.filter(p => p.strength > 0.3).sort((a, b) => b.strength - a.strength);

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
        <Clock className="w-12 h-12 mx-auto mb-3" style={{ color: C.cardSubFg, opacity: 0.5 }} />
        <p style={{ color: C.cardFg }}>الگوی در حال شکل‌گیری یافت نشد</p>
        <p className="text-sm mt-1" style={{ color: C.cardSubFg }}>الگوهای تکمیل شده در تاریخچه ذخیره شده‌اند</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
      {sorted.slice(0, 12).map((p, i) => (
        <PatternCard key={`forming-${i}`} pattern={p} C={C} />
      ))}
    </div>
  );
}

export default function PatternsPanel({ data, priceDecimals, instrumentCategory }: PatternsPanelProps) {
  const { colors: C } = useTheme();
  const decimals = priceDecimals ?? 0;
  const [accuracyReport, setAccuracyReport] = useState<SymbolAccuracyReport | null>(null);

  if (!data || !data.candles || data.candles.length < 5) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
        <Activity className="w-12 h-12 mx-auto mb-3" style={{ color: C.cardSubFg, opacity: 0.5 }} />
        <p style={{ color: C.cardSubFg }}>داده‌های کندل موجود نیست</p>
        <p className="text-sm mt-1" style={{ color: C.cardSubFg }}>حداقل ۵ کندل برای تشخیص الگو نیاز است</p>
      </div>
    );
  }

  const patterns = useMemo(() => {
    return detectAllPatterns(data.candles);
  }, [data.candles]);

  const { classic, harmonic, candlestick, elliott, all, schoolScores } = patterns;

  const totalPatterns = all.length;
  const bullishPatterns = all.filter(p => p.direction === 'bullish').length;
  const bearishPatterns = all.filter(p => p.direction === 'bearish').length;
  const neutralPatterns = totalPatterns - bullishPatterns - bearishPatterns;

  const completedPatterns = all.filter(p => p.status === 'completed').length;
  const formingPatterns = all.filter(p => p.status === 'forming').length;

  const sortedByCategory = useMemo(() => {
    return {
      classic: classic.filter(p => p.strength > 0.3).sort((a, b) => b.strength - a.strength),
      harmonic: harmonic.filter(p => p.strength > 0.3).sort((a, b) => b.strength - a.strength),
      candlestick: candlestick.filter(p => p.strength > 0.3).sort((a, b) => b.strength - a.strength),
      elliott: elliott.filter(p => p.strength > 0.3).sort((a, b) => b.strength - a.strength),
    };
  }, [classic, harmonic, candlestick, elliott]);

  const currentDate = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (data.symbol) {
      recordPatternsForSymbol(data.symbol, all, currentDate, data.info?.lastPrice);
      const report = getAccuracyReport(data.symbol);
      setAccuracyReport(report || null);
    }
  }, [data.symbol, all, currentDate]);

  // Export HTML
  const exportHTML = useCallback(() => {
    const rows: string[] = [];
    const addSection = (title: string, items: Array<{ label: string; value: string }>) => {
      rows.push(`<section><h3>${title}</h3>`);
      items.forEach(it => {
        rows.push(`<div><span>${it.label}</span><span>${it.value}</span></div>`);
      });
      rows.push('</section>');
    };

    addSection('مکتب‌های تحلیلی (School Scores)', [
      { label: 'کلاسیک', value: `${toPercent(schoolScores.classical)}%` },
      { label: 'هارمونیک', value: `${toPercent(schoolScores.harmonic)}%` },
      { label: 'کندل‌استیک - نوسان‌گر', value: `${toPercent(schoolScores.oscillator)}%` },
      { label: 'کندل‌استیک - حجم', value: `${toPercent(schoolScores.volume)}%` },
      { label: 'موج الیوت', value: `${toPercent(schoolScores.elliott)}%` },
      { label: 'هیبرید (کلیه)', value: `${toPercent(schoolScores.hybrid)}%` },
    ]);

    addSection('آمار کلی', [
      { label: 'کل الگوهای تشخیص‌داده', value: toFaDigits(totalPatterns) },
      { label: 'صعودی', value: toFaDigits(bullishPatterns) },
      { label: 'نزولی', value: toFaDigits(bearishPatterns) },
      { label: 'خنثی', value: toFaDigits(neutralPatterns) },
      { label: 'تکمیل', value: toFaDigits(completedPatterns) },
      { label: 'در حال شکل‌گیری', value: toFaDigits(formingPatterns) },
    ]);

    Object.entries(sortedByCategory).forEach(([cat, patterns]) => {
      if (patterns.length > 0) {
        addSection(`الگوهای ${categoryLabel(cat as 'classic' | 'harmonic' | 'candlestick' | 'elliott')}`, patterns.map(p => ({
          label: `${p.name} (${toPercent(p.strength)}%)`,
          value: `${directionLabel(p.direction)} - ${statusLabel(p.status)}`
        })));
      }
    });

    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>الگوهای تکنیکال</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;background:#f5f7fa;color:#111827;padding:20px;direction:rtl}.container{max-width:1200px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,0.08)}.header{background:linear-gradient(135deg,#8b5cf6,#a855f7);color:#fff;padding:20px;border-radius:12px;margin-bottom:20px;text-align:center}.header h1{font-size:1.5rem;margin-bottom:8px}section{margin-bottom:20px}section h3{font-size:1rem;color:#92400e;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb}.card{background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;border:1px solid #e5e7eb}.card .label{font-size:0.85rem;color:#6b7280}.card .value{font-size:1rem;font-weight:600;font-family:monospace;direction:ltr}.bull{color:#16a34a}.bear{color:#dc2626}.neutral{color:#6b7280}
</style></head>
<body><div class="container"><div class="header"><h1>🔍 الگوهای تکنیکال</h1><p>${data.info?.name ?? data.symbol}</p></div>${rows.join('')}</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patterns_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }, [patterns, data.info, data.symbol, decimals]);

  // Export Text
  const exportText = useCallback(() => {
    const lines = [
      'الگوهای تکنیکال تشخیص‌داده',
      `نماد: ${data.info?.name ?? data.symbol}`,
      '',
      '═══ مکتب‌های تحلیلی ═══',
      `کلاسیک: ${toPercent(schoolScores.classical)}%`,
      `هارمونیک: ${toPercent(schoolScores.harmonic)}%`,
      `کندل‌استیک - نوسان‌گر: ${toPercent(schoolScores.oscillator)}%`,
      `کندل‌استیک - حجم: ${toPercent(schoolScores.volume)}%`,
      `موج الیوت: ${toPercent(schoolScores.elliott)}%`,
      `هیبرید: ${toPercent(schoolScores.hybrid)}%`,
      '',
      '═══ آمار کلی ═══',
      `کل: ${toFaDigits(totalPatterns)} | صعودی: ${toFaDigits(bullishPatterns)} | نزولی: ${toFaDigits(bearishPatterns)} | خنثی: ${toFaDigits(neutralPatterns)}`,
      `تکمیل: ${toFaDigits(completedPatterns)} | در حال شکل‌گیری: ${toFaDigits(formingPatterns)}`,
      '',
    ];

    Object.entries(sortedByCategory).forEach(([cat, pats]) => {
      if (pats.length > 0) {
        lines.push(`═══ ${categoryLabel(cat as 'classic' | 'harmonic' | 'candlestick' | 'elliott')} ═══`);
        pats.forEach(p => {
          lines.push(`${p.name} - قدرت: ${toPercent(p.strength)}% - ${directionLabel(p.direction)} - ${statusLabel(p.status)}`);
        });
        lines.push('');
      }
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patterns_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }, [patterns, data.info, data.symbol]);

return (
    <div className="rounded-2xl p-4 space-y-1" dir="rtl" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
      {/* Export Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.cardFg }}>خروجی الگوهای تکنیکال</span>
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
              <FileCode className="w-4 h-4" style={{ color: C.primary }} />
              <span>دانلود / خروجی</span>
              <ChevronDown className="w-3.5 h-3.5" style={{ color: C.cardSubFg }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ background: C.cardBg, borderColor: C.cardBorder }}>
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

      {/* Accuracy Report */}
      {accuracyReport && (
        <AccuracyReportCard report={accuracyReport} C={C} />
      )}

      {/* Pattern Summary Stats */}
      <div className="rounded-xl p-4 mb-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 justify-items-center"
        style={{ background: hexToRgba(C.primary, 0.04), border: `1px solid ${hexToRgba(C.primary, 0.12)}` }}>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold" style={{ color: C.primary }}>{toFaDigits(totalPatterns)}</span>
          <span className="text-[11px]" style={{ color: C.cardSubFg }}>کل الگو</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold" style={{ color: C.bullColor }}>{toFaDigits(bullishPatterns)}</span>
          <span className="text-[11px]" style={{ color: C.cardSubFg }}>صعودی</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold" style={{ color: C.bearColor }}>{toFaDigits(bearishPatterns)}</span>
          <span className="text-[11px]" style={{ color: C.cardSubFg }}>نزولی</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold" style={{ color: C.neutralColor }}>{toFaDigits(neutralPatterns)}</span>
          <span className="text-[11px]" style={{ color: C.cardSubFg }}>خنثی</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold" style={{ color: '#22c55e' }}>{toFaDigits(completedPatterns)}</span>
          <span className="text-[11px]" style={{ color: C.cardSubFg }}>تکمیل</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{toFaDigits(formingPatterns)}</span>
          <span className="text-[11px]" style={{ color: C.cardSubFg }}>در حال شکل‌گیری</span>
        </div>
      </div>

      {/* Forming Patterns Only */}
      <SectionHeader title={`الگوها در حال شکل‌گیری (${formingPatterns})`} />
      <FormingPatternsOnly patterns={all} C={C} />

      {/* Legend */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
        <div className="text-[10px] font-medium" style={{ color: C.cardSubFg }}>راهنمای رنگ‌ها</div>
        <div className="flex flex-wrap gap-3 text-[10px]">
          <span className="flex items-center gap-1" style={{ color: C.primary }}>
            <span className="w-2 h-2 rounded-full" style={{ background: C.primary }} /> کلاسیک
          </span>
          <span className="flex items-center gap-1" style={{ color: '#a855f7' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#a855f7' }} /> هارمونیک
          </span>
          <span className="flex items-center gap-1" style={{ color: '#f59e0b' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} /> کندل‌استیک
          </span>
          <span className="flex items-center gap-1" style={{ color: '#06b6d4' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#06b6d4' }} /> موج الیوت
          </span>
          <span className="flex items-center gap-1" style={{ color: C.bullColor }}>
            <span className="w-2 h-2 rounded-full" style={{ background: C.bullColor }} /> صعودی
          </span>
          <span className="flex items-center gap-1" style={{ color: C.bearColor }}>
            <span className="w-2 h-2 rounded-full" style={{ background: C.bearColor }} /> نزولی
          </span>
          <span className="flex items-center gap-1" style={{ color: C.neutralColor }}>
            <span className="w-2 h-2 rounded-full" style={{ background: C.neutralColor }} /> خنثی
          </span>
          <span className="flex items-center gap-1" style={{ color: '#22c55e' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} /> تکمیل
          </span>
          <span className="flex items-center gap-1" style={{ color: '#f59e0b' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} /> در حال شکل‌گیری
          </span>
        </div>
      </div>
    </div>
  );
}