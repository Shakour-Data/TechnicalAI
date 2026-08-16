'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

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
  currentPrice: number;
  resistances: number[];
  supports: number[];
  ma100: number;
  rsi: number;
  mfi: number;
  cci: number;
  adx: number;
  trendDirection: string;
  trendAngle: number;
  trendR2: number;
  scenarios: {
    R1: Scenario;
    R2: Scenario;
    R3: Scenario;
    R4: Scenario;
    R5: Scenario;
  };
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
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function VdesAnalysis(props: VdesAnalysisProps) {
  const {
    symbolName, currentPrice, resistances, supports, ma100,
    rsi, mfi, cci, adx, trendDirection, trendAngle, trendR2, scenarios,
  } = props;

  const R1_level = resistances[0] ?? currentPrice * 1.05;
  const R2_level = resistances[1] ?? currentPrice * 1.10;
  const S1_level = supports[0] ?? currentPrice * 0.95;
  const S2_level = supports[1] ?? currentPrice * 0.90;
  const S3_level = supports[2] ?? currentPrice * 0.85;

  const targetMin = Math.round(R1_level + (R2_level - R1_level) * 0.5);
  const targetMax = Math.round(R2_level + (R2_level - R1_level) * 0.8);

  // Find dominant scenario
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

  // RSI signal
  const rsiSignal = rsi > 70 ? 'اشباع خرید شدید' : rsi > 60 ? 'اشباع خرید' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش' : 'اشباع فروش شدید';
  const rsiColor = rsi > 70 ? 'text-red-400' : rsi > 60 ? 'text-amber-400' : rsi > 40 ? 'text-gray-300' : rsi > 30 ? 'text-amber-400' : 'text-emerald-400';

  // Trend text
  const trendText = trendDirection === 'up'
    ? `صعودی با زاویه ${toFa(Math.abs(trendAngle))} درجه و ضریب تعیین R²=${(trendR2 * 100).toFixed(1)}%`
    : trendDirection === 'down'
    ? `نزولی با زاویه ${toFa(Math.abs(trendAngle))} درجه و ضریب تعیین R²=${(trendR2 * 100).toFixed(1)}%`
    : 'خنثی و بدون جهت مشخص';

  // Strategy recommendation text
  const strategyText = rsi > 70 || mfi > 80
    ? `با توجه به هشدار اشباع خرید (RSI: ${toFa(rsi)}, MFI: ${toFa(mfi)}) و فاصله قیمت تا مقاومت ${toFa(R1_level)}، استراتژی محتاطانه، انتظار برای اصلاح قیمت و ورود در محدوده حمایت ${toFa(S1_level)} تا ${toFa(S2_level)} ریال می‌باشد.`
    : rsi < 30 || mfi < 20
    ? `با توجه به اشباع فروش (RSI: ${toFa(rsi)}, MFI: ${toFa(mfi)}) و فاصله قیمت از حمایت ${toFa(S1_level)}، فرصت خرید در محدوده فعلی با حد ضرر ${toFa(S2_level)} ریال قابل بررسی است.`
    : `با توجه به وضعیت خنثی اندیکاتورها (RSI: ${toFa(rsi)}, ADX: ${toFa(adx)})، انتظار برای خروج قیمت از محدوده ${toFa(S1_level)} تا ${toFa(R1_level)} ریال و سپس تصمیم‌گیری توصیه می‌شود.`;

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Header ── */}
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

      {/* ── Dual Analysis Layout ── */}
      <div className="rounded-[28px] p-5 border border-white/6"
        style={{
          background: 'rgba(14,22,40,0.7)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 20px 40px -12px rgba(0,0,0,0.5)',
        }}>
        <h2 className="text-sm font-semibold mb-4 text-gray-200 flex items-center gap-3">
          <span className="text-amber-400">🧠</span>
          تحلیل جامع روند و سطوح کلیدی
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ── Text Analysis (Right in RTL) ── */}
          <div className="rounded-2xl p-4 border border-white/4 space-y-3 flex flex-col"
            style={{ background: 'rgba(8,20,35,0.5)' }}>

            {/* Trend Description */}
            <p className="text-sm text-gray-300 leading-relaxed">
              <strong style={{ color: '#f8e365' }}>روند کلی و موقعیت قیمت:</strong>{' '}
              سهم {symbolName} در یک روند {trendDirection === 'up' ? 'صعودی قدرتمند' : trendDirection === 'down' ? 'نزولی' : 'خنثی'} قرار دارد. قیمت با عبور از میانگین‌های متحرک، در حال حاضر در محدوده{' '}
              <b className="text-gray-100">{toFa(currentPrice)} ریال</b> معامله می‌شود.
              اندیکاتور RSI (<b className={rsiColor}>{toFa(rsi)}</b>) و MFI (<b className={rsiColor}>{toFa(mfi)}</b>)
              {rsi > 70 ? ' هشدار اشباع خرید را صادر می‌کنند.' : rsi < 30 ? ' هشدار اشباع فروش را صادر می‌کنند.' : ' در محدوده عادی قرار دارند.'}
            </p>

            {/* Key Levels */}
            <div className="rounded-xl px-4 py-3 border-r-4 border-red-400/70" style={{ background: 'rgba(248,227,101,0.06)' }}>
              <strong className="text-red-400 text-sm">🔴 سطوح کلیدی پیش رو:</strong>
              <ul className="mt-2 space-y-1.5 text-xs text-gray-300 leading-relaxed list-disc list-inside">
                <li>
                  <b>مقاومت {toFa(R1_level)} ریال (R1):</b> نخستین سد پیش روی سهم. عبور با تثبیت از این سطح، راه را برای صعود تا {toFa(R2_level)} ریال هموار می‌کند.
                </li>
                <li>
                  <b>مقاومت {toFa(R2_level)} ریال (R2):</b> سد بعدی در مسیر صعودی. شکست این سطح به معنای تأیید روند تا {toFa(targetMax)} ریال است.
                </li>
                <li>
                  <b>حمایت {toFa(S1_level)} ریال (S1):</b> حمایت نخست و کلیدی. در صورت اصلاح، این سطح مرز تفکیک پولبک سالم از اصلاح عمیق‌تر است.
                </li>
                <li>
                  <b>حمایت‌های بعدی:</b> در صورت شکست S1، سطوح {toFa(S2_level)} و {toFa(S3_level)} ریال فعال خواهند شد.
                </li>
              </ul>
            </div>

            {/* Scenario Analysis */}
            <p className="text-sm text-gray-300 leading-relaxed">
              <strong style={{ color: '#f8e365' }}>تحلیل سناریوها و احتمال وقوع:</strong>{' '}
              بر اساس تحلیل روند و سطوح کلیدی، پنج سناریوی اصلی پیش روی سهم قابل تصور است.
              سناریوی صعودی با احتمال <b className="text-emerald-400">{toFa(scenarios.R1.probability)}٪</b>،
              در صورت عبور از مقاومت {toFa(R1_level)} و تثبیت بالای آن، قیمت را به کریدور {toFa(targetMin)} تا {toFa(targetMax)} ریال هدایت می‌کند.
              سناریوی پولبک سالم با احتمال <b className="text-cyan-400">{toFa(scenarios.R2.probability)}٪</b>،
              بازگشت تا حمایت {toFa(S1_level)} ریال را شامل می‌شود.
              سناریوهای اصلاح با مجموع احتمالات{' '}
              <b className="text-red-400">{toFa(scenarios.R3.probability + scenarios.R4.probability + scenarios.R5.probability)}٪</b>،
              {' '}در صورت شکست حمایت {toFa(S1_level)} ریال رخ داده و قیمت را به سمت سطوح {toFa(S2_level)} و {toFa(S3_level)} ریال هدایت خواهد کرد.
            </p>

            {/* Strategy */}
            <div className="rounded-xl px-4 py-3 border-r-4" style={{ background: 'rgba(255,178,95,0.06)', borderRightColor: '#ffb25f' }}>
              <strong className="text-amber-400 text-sm">🟡 استراتژی پیشنهادی:</strong>
              <p className="text-xs text-gray-300 leading-relaxed mt-1.5">{strategyText}</p>
            </div>
          </div>

          {/* ── Scenario Summary (Left in RTL) ── */}
          <div className="rounded-2xl p-4 border border-white/4 flex flex-col"
            style={{ background: 'rgba(8,20,35,0.5)' }}>
            <h3 className="text-sm font-bold mb-3 pb-2 border-b border-white/5" style={{ color: '#3ad5db' }}>
              🏛️ خلاصه سناریوها و احتمالات
            </h3>

            <div className="space-y-3 flex-1">
              {SCENARIO_KEYS.map(key => {
                const s = scenarios[key];
                const meta = SCENARIO_META[key];
                return (
                  <div
                    key={key}
                    className="rounded-xl p-3 border-r-4 relative"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRight: `4px solid ${meta.border}`,
                    }}
                  >
                    <div className="text-sm font-bold text-gray-100 mb-1">
                      سناریو {key} | {meta.label}
                    </div>
                    <div className="text-xs text-[#b0c4dd] leading-relaxed">{s.description}</div>
                    <span
                      className="inline-block mt-2 px-3.5 py-0.5 rounded-full text-lg font-black"
                      style={{ background: meta.badgeBg, color: meta.badgeColor }}
                    >
                      {toFa(s.probability)}٪
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-white/5 text-left text-xs text-[#5a7395] leading-relaxed">
              <strong>📌 قانون احتمالات:</strong> مجموع احتمالات پنج سناریوی پیش رو برابر <strong>۱۰۰٪</strong> است.
              (مجموع فعلی: <b className="text-gray-300">{toFa(totalProb)}٪</b>)
            </div>
          </div>
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
      <Skeleton className="h-[500px] w-full bg-white/5 rounded-[28px]" />
    </div>
  );
}
