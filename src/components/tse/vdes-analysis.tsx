'use client';

import React, { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import TradingViewChart, { TradingViewChartSkeleton, type CandleData } from '@/components/tse/tradingview-chart';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

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
  candles: CandleData[];
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
  supportStrengths: { price: number; strength: number; isTarget: boolean }[];
  resistanceStrengths: { price: number; strength: number; isTarget: boolean }[];
  priceTargets: { price: number; strength: number; isTarget: boolean }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const toFa = (n: number) => Math.round(n).toLocaleString('fa-IR');

const SCENARIO_KEYS = ['R1', 'R2', 'R3', 'R4', 'R5'] as const;

const SCENARIO_META: Record<string, { label: string; type: string; border: string; badgeBg: string; badgeColor: string }> = {
  R1: { label: 'تداوم صعود هیجانی', type: 'up', border: '#59e39b', badgeBg: 'rgba(89,227,155,0.2)', badgeColor: '#59e39b' },
  R2: { label: 'پولبک سالم', type: 'pullback', border: '#ffb25f', badgeBg: 'rgba(255,178,95,0.2)', badgeColor: '#ffb25f' },
  R3: { label: 'اصلاح کنترل‌شده', type: 'down', border: '#ff758a', badgeBg: 'rgba(255,117,138,0.2)', badgeColor: '#ff758a' },
  R4: { label: 'اصلاح عمیق', type: 'down', border: '#ffb11b', badgeBg: 'rgba(255,177,27,0.2)', badgeColor: '#ffb11b' },
  R5: { label: 'تضعیف ساختار', type: 'down', border: '#ef4d62', badgeBg: 'rgba(239,77,98,0.2)', badgeColor: '#ef4d62' },
};

const STRATEGY_MAP: Record<string, { text: string; tagCls: string }> = {
  R1: { text: 'صعودی قوی — احتمال بالای عبور از مقاومت‌ها', tagCls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  R2: { text: 'صعود تدریجی — ورود در اصلاح توصیه می‌شود', tagCls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  R3: { text: 'بازار رنج — منتظر خروج از محدوده بمانید', tagCls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  R4: { text: 'اصلاحی — احتیاط و کاهش حجم معاملات', tagCls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  R5: { text: 'نزولی قوی — خروج فوری توصیه می‌شود', tagCls: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function StrengthBar({ strength }: { strength: number }) {
  const pct = (strength / 10) * 100;
  const color = strength >= 7 ? '#34d399' : strength >= 4 ? '#fbbf24' : '#6b7280';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{strength}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function VdesAnalysis(props: VdesAnalysisProps) {
  const {
    symbolName, candles, currentPrice, resistances, supports, ma21, ma100,
    rsi, mfi, cci, adx, stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, obv, bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal, scenarios,
    supportStrengths, resistanceStrengths, priceTargets,
  } = props;

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
  const rsiColor = rsi > 70 ? 'text-red-400' : rsi > 60 ? 'text-amber-400' : rsi > 40 ? 'text-gray-300' : rsi > 30 ? 'text-amber-400' : 'text-emerald-400';

  // ── Stochastic signal ──────────────────────────────────────────
  const stochSignal = stochK > 80 ? 'اشباع خرید' : stochK < 20 ? 'اشباع فروش' : stochK > stochD ? 'صعودی' : 'نزولی';

  // ── MACD signal ────────────────────────────────────────────────
  const macdSignalText = macdHist > 0 ? 'مومنتوم مثبت (هیستوگرام بالای صفر)' : 'مومنتوم منفی (هیستوگرام زیر صفر)';
  const macdBullish = macdLine > macdSignal;

  // ── Trend text ─────────────────────────────────────────────────
  const trendText = trendDirection === 'up'
    ? `صعودی با زاویه ${toFa(Math.abs(trendAngle))} درجه و ضریب تعیین R²=${(trendR2 * 100).toFixed(1)}%`
    : trendDirection === 'down'
    ? `نزولی با زاویه ${toFa(Math.abs(trendAngle))} درجه و ضریب تعیین R²=${(trendR2 * 100).toFixed(1)}%`
    : 'خنثی و بدون جهت مشخص';

  // ── DI signal ──────────────────────────────────────────────────
  const diSignal = diPlus > diMinus
    ? `DI+ (${toFa(diPlus)}) بالاتر از DI- (${toFa(diMinus)}) — فشار خرید غالب`
    : `DI- (${toFa(diMinus)}) بالاتر از DI+ (${toFa(diPlus)}) — فشار فروش غالب`;

  // ── SAR signal ─────────────────────────────────────────────────
  const sarSignal = sar < currentPrice
    ? `SAR (${toFa(sar)}) زیر قیمت — تأیید روند صعودی`
    : `SAR (${toFa(sar)}) بالای قیمت — تأیید روند نزولی`;

  // ── Bollinger Band position ────────────────────────────────────
  const bbRange = bollingerUpper - bollingerLower;
  const bbPos = bbRange > 0 ? ((currentPrice - bollingerLower) / bbRange * 100).toFixed(0) : '50';
  const bbSignal = currentPrice > bollingerUpper ? 'بالای باند بالایی (اشباع خرید)'
    : currentPrice < bollingerLower ? 'زیر باند پایینی (اشباع فروش)'
    : `داخل باندها (${bbPos}٪ از بازه)`;

  // ── TradingView scenario colors ────────────────────────────────
  const tvScenarios = useMemo(() => {
    const colors: Record<string, string> = {
      R1: '#34c98b', R2: '#3ad5db', R3: '#ff7b32', R4: '#ffb11b', R5: '#ef4d62',
    };
    return Object.fromEntries(
      SCENARIO_KEYS.map(k => [k, {
        targetMin: scenarios[k].targetMin,
        targetMax: scenarios[k].targetMax,
        name: scenarios[k].name,
        probability: scenarios[k].probability,
        color: colors[k],
      }])
    );
  }, [scenarios]);

  // ── Strategy recommendation text ────────────────────────────────
  const strategyText = rsi > 70 || mfi > 80
    ? `با توجه به هشدار اشباع خرید (RSI: ${toFa(rsi)}, MFI: ${toFa(mfi)}) و فاصله قیمت تا مقاومت ${toFa(R1_level)}، استراتژی محتاطانه، انتظار برای اصلاح قیمت و ورود در محدوده حمایت ${toFa(S1_level)} تا ${toFa(S2_level)} ریال می‌باشد. در این محدوده می‌توان با حد ضرر ${toFa(S2_level)} ریال وارد موقعیت خرید شد.`
    : rsi < 30 || mfi < 20
    ? `با توجه به اشباع فروش (RSI: ${toFa(rsi)}, MFI: ${toFa(mfi)}) و نزدیکی به حمایت ${toFa(S1_level)}، فرصت خرید در محدوده فعلی با حد ضرر ${toFa(S2_level)} ریال قابل بررسی است. هدف اولیه ${toFa(R1_level)} و هدف ثانویه ${toFa(R2_level)} ریال تعیین می‌شود.`
    : `با توجه به وضعیت خنثی اندیکاتورها (RSI: ${toFa(rsi)}, ADX: ${toFa(adx)}، قدرت روند: ${adx > 25 ? 'قوی' : 'ضعیف'})، انتظار برای خروج قیمت از محدوده ${toFa(S1_level)} تا ${toFa(R1_level)} ریال و سپس تصمیم‌گیری توصیه می‌شود. حجم معاملات و مومنتوم MACD را برای تأیید سیگنال پایش کنید.`;

  return (
    <div className="space-y-5" dir="rtl">
      {/* ═══ HEADER ═══ */}
      <div className="rounded-[32px] px-6 py-5 border border-amber-500/20"
        style={{
          background: 'rgba(18,28,46,0.7)',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
        }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: '#f8e365' }}>
          📈 تحلیل تکنیکال {symbolName}
        </h1>
        <div className="flex flex-wrap gap-3 mt-2">
          <span className="px-3.5 py-1 rounded-full border border-white/5 bg-white/4 text-xs text-gray-400">
            📍 قیمت مرجع: <b className="text-gray-200">{toFa(currentPrice)} ریال</b>
          </span>
          <span className="px-3.5 py-1 rounded-full border border-white/5 bg-white/4 text-xs text-gray-400">
            🎯 هدف کوتاه‌مدت: <b className="text-gray-200">{toFa(targetMin)} — {toFa(targetMax)} ریال</b>
          </span>
          <span className="px-3.5 py-1 rounded-full border border-white/5 bg-white/4 text-xs text-gray-400">
            📊 روند: <b className="text-gray-200">{trendText}</b>
          </span>
          <span className={`px-3.5 py-1 rounded-full border text-xs font-medium ${
            rsi > 70 ? 'bg-red-500/15 text-red-400 border-red-500/30'
            : rsi < 30 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          }`}>
            RSI: {toFa(rsi)} ({rsiSignal})
          </span>
        </div>
      </div>

      {/* ═══ TRADINGVIEW CHART ═══ */}
      <div className="rounded-[28px] p-4 border border-white/6"
        style={{
          background: 'rgba(14,22,40,0.7)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 20px 40px -12px rgba(0,0,0,0.5)',
        }}>
        <h2 className="text-sm font-semibold mb-3 text-gray-200 flex items-center gap-3">
          <span style={{ color: '#f8e365' }}>📊</span>
          نمودار قیمتی سهم (۱ روزه) — به همراه MA21، MA100، سطوح حمایت/مقاومت و اهداف قیمتی
        </h2>
        <TradingViewChart
          symbolName={symbolName}
          candles={candles}
          supports={supports}
          resistances={resistances}
          supportStrengths={supportStrengths}
          resistanceStrengths={resistanceStrengths}
          ma21={ma21}
          ma100={ma100}
          scenarios={tvScenarios}
        />
        <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-gray-500">
          <span>🔴 خطوط قرمز: مقاومت‌ها ({resistances.map(toFa).join(' ، ')})</span>
          <span>🟢 خطوط سبز: حمایت‌ها ({supports.map(toFa).join(' ، ')})</span>
          <span>🟣 خط بنفش: MA100 ({toFa(ma100)})</span>
          <span>🔵 خط آبی: MA21 ({toFa(ma21)})</span>
          <span>🟡 خطوط زرد: اهداف قیمتی سناریوها (رند شده)</span>
        </div>
      </div>

      {/* ═══ KEY LEVELS — Beautiful Boxes Below Chart ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Resistances ── */}
        <div className="rounded-2xl border border-red-500/20 overflow-hidden"
          style={{ background: 'rgba(14,22,40,0.8)', boxShadow: '0 8px 32px -8px rgba(239,68,68,0.15)' }}>
          <div className="px-5 py-3 flex items-center gap-2 border-b border-red-500/15"
            style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 100%)' }}>
            <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
            <h3 className="text-sm font-bold text-red-300">سطوح مقاومت</h3>
            <span className="text-[10px] text-red-400/60 mr-auto">با قدرت ۱-۱۰</span>
          </div>
          <div className="p-4 space-y-2.5">
            {resistanceStrengths.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3 border border-white/5"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-red-400/70 w-6">R{i + 1}</span>
                  <div>
                    <span className="text-sm font-bold text-gray-100 tabular-nums" dir="ltr">{toFa(r.price)}</span>
                    <span className="text-[10px] text-gray-500 mr-1.5">ریال</span>
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
        <div className="rounded-2xl border border-emerald-500/20 overflow-hidden"
          style={{ background: 'rgba(14,22,40,0.8)', boxShadow: '0 8px 32px -8px rgba(52,211,153,0.15)' }}>
          <div className="px-5 py-3 flex items-center gap-2 border-b border-emerald-500/15"
            style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(52,211,153,0.04) 100%)' }}>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            <h3 className="text-sm font-bold text-emerald-300">سطوح حمایت</h3>
            <span className="text-[10px] text-emerald-400/60 mr-auto">با قدرت ۱-۱۰</span>
          </div>
          <div className="p-4 space-y-2.5">
            {supportStrengths.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3 border border-white/5"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-400/70 w-6">S{i + 1}</span>
                  <div>
                    <span className="text-sm font-bold text-gray-100 tabular-nums" dir="ltr">{toFa(s.price)}</span>
                    <span className="text-[10px] text-gray-500 mr-1.5">ریال</span>
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
        <div className="rounded-2xl border border-amber-500/20 overflow-hidden"
          style={{ background: 'rgba(14,22,40,0.8)', boxShadow: '0 8px 32px -8px rgba(245,158,11,0.15)' }}>
          <div className="px-5 py-3 flex items-center gap-2 border-b border-amber-500/15"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 100%)' }}>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
            <h3 className="text-sm font-bold text-amber-300">اهداف قیمتی</h3>
            <span className="text-[10px] text-amber-400/60 mr-auto">سطوح با قدرت بالا</span>
          </div>
          <div className="p-4 flex flex-wrap gap-3">
            {priceTargets.map((t, i) => (
              <div key={i} className="flex-1 min-w-[160px] rounded-xl p-4 border border-amber-500/15"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 100%)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-amber-400/60">هدف {i + 1}</span>
                  <span className="text-[10px]">🎯</span>
                </div>
                <p className="text-base font-black text-amber-200 tabular-nums" dir="ltr">{toFa(t.price)}</p>
                <span className="text-[10px] text-gray-500">ریال</span>
                <div className="mt-3">
                  <StrengthBar strength={t.strength} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TEXT ANALYSIS ═══ */}
      <div className="rounded-[28px] p-5 border border-white/6"
        style={{
          background: 'rgba(14,22,40,0.7)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 20px 40px -12px rgba(0,0,0,0.5)',
        }}>
        <h2 className="text-sm font-semibold mb-4 text-gray-200 flex items-center gap-3">
          <span style={{ color: '#f8e365' }}>🧠</span>
          تحلیل جامع روند و اندیکاتورها
        </h2>
        <div className="space-y-4">
          {/* ── PARAGRAPH 1: General Trend & Price Position ── */}
          <p className="text-sm text-gray-300 leading-[1.85]">
            <strong style={{ color: '#f8e365' }}>روند کلی و موقعیت قیمت:</strong>{' '}
            سهم {symbolName} در حال حاضر در محدوده{' '}
            <b className="text-gray-100">{toFa(currentPrice)} ریال</b> معامله می‌شود و روند میان‌مدت{' '}
            <b className={trendDirection === 'up' ? 'text-emerald-400' : trendDirection === 'down' ? 'text-red-400' : 'text-amber-400'}>{trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی'}</b>
            {' '}است (زاویه {toFa(Math.abs(trendAngle))}°، R²={+(trendR2 * 100).toFixed(1)}%).
            قیمت نسبت به MA21 ({toFa(ma21)} ریال){' '}
            {currentPrice > ma21 ? <span className="text-emerald-400">بالاتر</span> : <span className="text-red-400">پایین‌تر</span>}
            {' '}و نسبت به MA100 ({toFa(ma100)} ریال){' '}
            {currentPrice > ma100 ? <span className="text-emerald-400">بالاتر</span> : <span className="text-red-400">پایین‌تر</span>}
            {' '}قرار دارد. اندیکاتور Parabolic SAR ({toFa(sar)}) نیز{' '}
            {sar < currentPrice ? <span>زیر قیمت قرار دارد که <b className="text-emerald-400">تأیید روند صعودی</b> است.</span> : <span>بالای قیمت قرار دارد که <b className="text-red-400">تأیید روند نزولی</b> است.</span>}
            {' '}شاخص ADX ({toFa(adx)}) نشان‌دهنده {' '}
            {adx > 40 ? <b className="text-emerald-400">روند قدرتمند</b> : adx > 25 ? <b className="text-amber-400">روند متوسط</b> : <b className="text-gray-500">روند ضعیف یا رنج</b>}
            {' '}می‌باشد. {' '}{diSignal}.
          </p>

          {/* ── PARAGRAPH 2: Oscillator & Momentum Analysis ── */}
          <p className="text-sm text-gray-300 leading-[1.85]">
            <strong style={{ color: '#f8e365' }}>تحلیل اسیلاتورها و مومنتوم:</strong>{' '}
            اندیکاتور RSI ({toFa(rsi)}) در ناحیه{' '}
            <b className={rsiColor}>{rsiSignal}</b>
            قرار دارد.
            اندیکاتور MFI ({toFa(mfi)}) نیز{' '}
            {mfi > 80 ? <span className="text-red-400">اشباع خرید را تأیید می‌کند</span> : mfi < 20 ? <span className="text-emerald-400">اشباع فروش را نشان می‌دهد</span> : <span>در محدوده عادی است</span>}
            . اندیکاتور CCI ({toFa(cci)}){' '}
            {cci > 100 ? <span className="text-red-400">بالاتر از +100 (قدرت خریداری قوی)</span> : cci < -100 ? <span className="text-emerald-400">پایین‌تر از -100 (قدرت فروشندگان)</span> : <span>در محدوده عادی (-100 تا +100)</span>}
            . استوکاستیک (%K={toFa(stochK)}، %D={toFa(stochD)}) وضعیت{' '}
            <b className={stochK > 80 ? 'text-red-400' : stochK < 20 ? 'text-emerald-400' : 'text-gray-300'}>{stochSignal}</b> را نشان می‌دهد.
            {' '}MACD (خط={toFa(macdLine)}، سیگنال={toFa(macdSignal)}) با {macdBullish ? <span className="text-emerald-400">عبور خط اصلی بالای خط سیگنال — سیگنال صعودی</span> : <span className="text-red-400">خط اصلی زیر خط سیگنال — سیگنال نزولی</span>}
            . هیستوگرام MACD ({toFa(macdHist)}) {' '}
            {macdHist > 0 ? <span className="text-emerald-400">مثبت</span> : <span className="text-red-400">منفی</span>}
            {' '}و {' '}{macdSignalText}.
          </p>

          {/* ── PARAGRAPH 3: Bollinger Bands & Volatility ── */}
          <p className="text-sm text-gray-300 leading-[1.85]">
            <strong style={{ color: '#f8e365' }}>تحلیل نوسانات و باند بولینگر:</strong>{' '}
            قیمت در باند بولینگر{' '}
            <b className="text-gray-200">{bbSignal}</b>
            {' '}قرار دارد. باند بالایی: {toFa(bollingerUpper)}، باند میانی (MA20): {toFa(bollingerMiddle)}، باند پایینی: {toFa(bollingerLower)} ریال.
            {currentPrice > bollingerUpper
              ? ' عبور از باند بالایی معمولاً نشان‌دهنده ادامه حرکت صعودی کوتاه‌مدت یا واکنش به باند است.'
              : currentPrice < bollingerLower
              ? ' نزدیکی یا عبور از باند پایینی می‌تواند نشانه بازگشت قیمت به سمت باند میانی باشد.'
              : ' موقعیت قیمت در داخل باندها نشان‌دهنده عدم وجود سیگنال شدید از باند بولینگر است.'}
          </p>

          {/* ── PARAGRAPH 4: Volume & OBV Analysis ── */}
          <p className="text-sm text-gray-300 leading-[1.85]">
            <strong style={{ color: '#f8e365' }}>تحلیل حجم معاملات و شاخص OBV:</strong>{' '}
            شاخص جریان ورودی پول (OBV) در سطح <b className="text-gray-200">{obv > 0 ? '+' : ''}{(obv / 1e6).toFixed(1)}M</b> قرار دارد
            {obv > 0
              ? <span> که <b className="text-emerald-400">تجمع مثبت حجم</b> را نشان می‌دهد و حاکی از ورود پول هوشمند و تقویت روند صعودی است. افزایش OBV همزمان با رشد قیمت، تأییدکننده قدرت خریداران واقعی در بازار می‌باشد.</span>
              : <span> که <b className="text-red-400">خروج پول</b> را نشان می‌دهد و می‌تواند نشانه ضعف خریداران و احتمال ادامه اصلاح باشد. کاهش OBV در کنار قیمت ثابت یا صعودی، هشدار واگرایی منفی محسوب می‌شود.</span>
            }
            {' '}اندیکاتور ATR ({toFa(atr)}) نشان‌دهنده میانگین نوسان روزانه سهم است؛
            {atr > currentPrice * 0.03
              ? <span> نوسان بالاتر از ۳٪ قیمت که <b className="text-amber-400">نوسان بالایی</b> محسوب شده و مدیریت ریسک دقیق‌تری را ایجاب می‌کند.</span>
              : <span> نوسان معقول که نشان‌دهنده <b className="text-gray-400">ثبات نسبی قیمت</b> در بازه‌های معاملاتی اخیر است.</span>
            }
          </p>

          {/* ── PARAGRAPH 5: Risk/Reward & Confluence ── */}
          <p className="text-sm text-gray-300 leading-[1.85]">
            <strong style={{ color: '#f8e365' }}>تحلیل تلاقی سیگنال‌ها و نسبت ریسک به بازده:</strong>{' '}
            با بررسی همزمان تمام اندیکاتورها، می‌توان نتیجه‌گیری کرد که
            {overallSignal === 'bullish'
              ? <span> اکثر شاخص‌ها <b className="text-emerald-400">الگوی صعودی</b> را تأیید می‌کنند. نسبت ریسک به بازده (Risk/Reward) با در نظر گرفتن حد ضرر در حمایت {toFa(S1_level)} و هدف اول {toFa(R1_level)} ریال، حدود <b className="text-emerald-400">{((R1_level - currentPrice) / (currentPrice - S1_level)).toFixed(1)}:1</b> محاسبه می‌شود که{' '}
              {((R1_level - currentPrice) / (currentPrice - S1_level)) > 2
                ? <span className="text-emerald-400">نسبت بسیار مطلوبی</span>
                : ((R1_level - currentPrice) / (currentPrice - S1_level)) > 1
                ? <span className="text-amber-400">نسبت قابل قبولی</span>
                : <span className="text-red-400">نسبت نامطلوبی</span>
              }{' '}برای ورود به معامله محسوب می‌شود.</span>
              : overallSignal === 'bearish'
              ? <span> اکثر شاخص‌ها <b className="text-red-400">الگوی نزولی</b> را نشان می‌دهند و ورود به معامله خرید در این شرایط <b className="text-red-400">ریسک بالایی</b> دارد. توصیه می‌شود تا بازگشت قیمت به محدوده حمایت {toFa(S1_level)} ریال و تشکیل سیگنال بازگشتی، از ورود خودداری شود.</span>
              : <span> سیگنال‌ها <b className="text-amber-400">تضاد</b> دارند و بازار در فاز تردید قرار دارد. در این شرایط، بهترین استراتژی <b className="text-amber-400">انتظار و مشاهده</b> است تا قیمت از محدوده {toFa(S1_level)} تا {toFa(R1_level)} ریال خارج شده و جهت مشخص شود.</span>
            }
            {' '}تلاقی MA21 و MA100{' '}
            {Math.abs(ma21 - ma100) / currentPrice < 0.01
              ? <span className="text-amber-400">بسیار نزدیک به هم</span>
              : ma21 > ma100
              ? <span className="text-emerald-400">به نفع صعودی (MA21 بالاتر از MA100)</span>
              : <span className="text-red-400">به نفع نزولی (MA21 پایین‌تر از MA100)</span>
            }
            {' '}است که {' '}
            {Math.abs(ma21 - ma100) / currentPrice < 0.01
              ? 'می‌تواند نشانه تقاطع طلایی یا مرگ در آینده نزدیک باشد و باید با دقت پایش شود.'
              : trendDirection === 'up' ? 'تأییدکننده قدرت روند صعودی می‌باشد.' : 'هشدار تداوم فشار نزولی را صادر می‌کند.'
            }
          </p>

          {/* ── Strategy ── */}
          <div className="rounded-xl px-4 py-3 border-r-4" style={{ background: 'rgba(255,178,95,0.06)', borderRightColor: '#ffb25f' }}>
            <strong className="text-amber-400 text-sm">🟡 استراتژی پیشنهادی:</strong>
            <p className="text-xs text-gray-300 leading-[1.85] mt-1.5">{strategyText}</p>
          </div>
        </div>
      </div>

      {/* ═══ SCENARIO PROBABILITIES ═══ */}
      <div className="rounded-[28px] p-5 border border-white/6"
        style={{
          background: 'rgba(14,22,40,0.7)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 20px 40px -12px rgba(0,0,0,0.5)',
        }}>
        <h2 className="text-sm font-semibold mb-4 text-gray-200 flex items-center gap-3">
          <span style={{ color: '#f8e365' }}>🏛️</span>
          احتمالات سناریوها
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {SCENARIO_KEYS.map(key => {
            const s = scenarios[key];
            const meta = SCENARIO_META[key];
            return (
              <div
                key={key}
                className="rounded-xl p-3.5"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderTop: `3px solid ${meta.border}`,
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold" style={{ color: meta.badgeColor }}>{key}</span>
                  <span className="text-[10px] text-gray-500">{meta.label}</span>
                </div>
                <div className="text-center my-2">
                  <span
                    className="inline-block text-2xl font-black tabular-nums"
                    style={{ color: meta.badgeColor }}
                  >
                    {toFa(s.probability)}٪
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-700/60 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${s.probability}%`, backgroundColor: meta.border }}
                  />
                </div>
                <div className="text-[10px] text-gray-500 text-center" dir="ltr">
                  {toFa(s.targetMin)} — {toFa(s.targetMax)} ریال
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-center text-xs text-gray-500">
          مجموع احتمالات: <b className="text-gray-300">{toFa(totalProb)}٪</b> (برابر ۱۰۰٪)
        </div>
      </div>

      {/* ── Strategy Tag ── */}
      <div className="flex flex-wrap items-center gap-3 px-4">
        <span className="text-xs text-gray-500">سیگنال غالب:</span>
        <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold border ${strategy.tagCls}`}>
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
      <Skeleton className="h-28 w-full bg-white/5 rounded-[32px]" />
      <Skeleton className="h-[650px] w-full bg-white/5 rounded-[28px]" />
    </div>
  );
}
