'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Scenario {
  name: string;
  nameEn: string;
  probability: number;
  targetMin: number;
  targetMax: number;
  description: string;
}

interface VdssVdesProps {
  scenarios: {
    SC1: Scenario;
    SC2: Scenario;
    SC3: Scenario;
    SC4: Scenario;
    SC5: Scenario;
  } | null;
  currentPrice: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SCENARIO_COLORS: Record<string, { border: string; bg: string; text: string; badge: string; badgeText: string }> = {
  SC1: { border: '#34c98b', bg: 'rgba(52,201,139,0.08)', text: 'text-emerald-400', badge: 'bg-emerald-500/15 border-emerald-500/30', badgeText: 'text-emerald-400' },
  SC2: { border: '#3ad5db', bg: 'rgba(58,213,219,0.08)', text: 'text-cyan-400', badge: 'bg-cyan-500/15 border-cyan-500/30', badgeText: 'text-cyan-400' },
  SC3: { border: '#ffb11b', bg: 'rgba(255,177,27,0.08)', text: 'text-yellow-400', badge: 'bg-yellow-500/15 border-yellow-500/30', badgeText: 'text-yellow-400' },
  SC4: { border: '#ff7b32', bg: 'rgba(255,123,50,0.08)', text: 'text-orange-400', badge: 'bg-orange-500/15 border-orange-500/30', badgeText: 'text-orange-400' },
  SC5: { border: '#ef4d62', bg: 'rgba(239,77,98,0.08)', text: 'text-red-400', badge: 'bg-red-500/15 border-red-500/30', badgeText: 'text-red-400' },
};

const STRATEGY_MAP: Record<string, { text: string; color: string }> = {
  SC1: { text: 'سیگنال صعودی قوی', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  SC2: { text: 'صعود تدریجی - ورود در اصلاح', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
  SC3: { text: 'بازار رنج - منتظر خروج از محدوده', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
  SC4: { text: 'سیگنال اصلاح - احتیاط', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  SC5: { text: 'سیگنال فروش - خروج فوری', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
};

const SCENARIO_KEYS = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5'] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const toFa = (n: number) => Math.round(n).toLocaleString('fa-IR');

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="bg-[#0b0f1a] rounded-2xl p-4 space-y-4">
      <Skeleton className="h-9 w-64 bg-white/5 rounded-lg" />
      <Skeleton className="h-80 w-full bg-white/5 rounded-xl" />
      <Skeleton className="h-96 w-full bg-white/5 rounded-xl" />
    </div>
  );
}

// ─── VDss Decision Graph ───────────────────────────────────────────────────────

function VdssGraph({
  scenarios,
  currentPrice,
}: {
  scenarios: NonNullable<VdssVdesProps['scenarios']>;
  currentPrice: number;
}) {
  const totalProb = SCENARIO_KEYS.reduce((sum, k) => sum + scenarios[k].probability, 0);

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── Top node: current price ── */}
      <div className="flex justify-center">
        <div className="bg-[#111d2e]/80 border-2 border-cyan-500/40 rounded-xl px-6 py-3 text-center">
          <p className="text-[11px] text-gray-400 mb-0.5">نقطه فعلی</p>
          <p className="text-lg font-bold text-cyan-400 tabular-nums" dir="ltr">{toFa(currentPrice)}</p>
          <p className="text-[11px] text-gray-500">ریال</p>
        </div>
      </div>

      {/* ── Connector line ── */}
      <div className="flex justify-center">
        <div className="w-px h-6 bg-gray-600" />
      </div>

      {/* ── Branch lines spreading to 5 scenarios ── */}
      <div className="relative h-4">
        {/* Horizontal connector */}
        <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gray-600" />
        {/* Vertical drops to each scenario */}
        {[10, 27.5, 50, 72.5, 90].map((leftPct, i) => (
          <div
            key={i}
            className="absolute top-0 w-px h-full bg-gray-600"
            style={{ left: `${leftPct}%` }}
          />
        ))}
      </div>

      {/* ── Scenario cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {SCENARIO_KEYS.map((key) => {
          const s = scenarios[key];
          const c = SCENARIO_COLORS[key];
          return (
            <div
              key={key}
              className="rounded-xl p-3 space-y-3 transition-transform hover:scale-[1.02]"
              style={{
                backgroundColor: c.bg,
                border: `1px solid ${c.border}22`,
                borderRight: `3px solid ${c.border}`,
              }}
            >
              {/* Name */}
              <p className={`text-sm font-semibold ${c.text}`}>{s.name}</p>

              {/* Probability - large */}
              <div className="text-center">
                <span className={`text-2xl font-black tabular-nums ${c.text}`} dir="ltr">
                  {toFa(s.probability)}٪
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-gray-700/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${s.probability}%`,
                    backgroundColor: c.border,
                  }}
                />
              </div>

              {/* Target range */}
              <div className="text-center space-y-0.5">
                <p className="text-[10px] text-gray-400">محدوده هدف (ریال)</p>
                <p className="text-xs text-gray-200 tabular-nums" dir="ltr">
                  {toFa(s.targetMin)} — {toFa(s.targetMax)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sum note ── */}
      <div className="flex justify-center pt-2">
        <span className="text-xs text-gray-400">
          مجموع احتمالات: {toFa(Math.round(totalProb))}٪
        </span>
      </div>
    </div>
  );
}

// ─── VDes Textual Analysis ─────────────────────────────────────────────────────

function VdesAnalysis({
  scenarios,
}: {
  scenarios: NonNullable<VdssVdesProps['scenarios']>;
}) {
  // Find highest probability scenario
  let highestKey = 'SC3';
  let highestProb = 0;
  for (const key of SCENARIO_KEYS) {
    if (scenarios[key].probability > highestProb) {
      highestProb = scenarios[key].probability;
      highestKey = key;
    }
  }
  const strategy = STRATEGY_MAP[highestKey];

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── Header ── */}
      <div className="bg-[#111d2e]/60 border border-white/5 rounded-xl px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-200">تحلیل سناریوها و احتمال وقوع</h3>
      </div>

      {/* ── Scenario cards ── */}
      {SCENARIO_KEYS.map((key) => {
        const s = scenarios[key];
        const c = SCENARIO_COLORS[key];
        return (
          <div
            key={key}
            className="rounded-xl p-4 space-y-2"
            style={{
              backgroundColor: c.bg,
              border: `1px solid ${c.border}22`,
              borderRight: `4px solid ${c.border}`,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`text-sm font-semibold ${c.text}`}>{s.name}</span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-bold tabular-nums ${c.badge} ${c.badgeText}`}
                dir="ltr"
              >
                {toFa(s.probability)}٪
              </span>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">{s.description}</p>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-gray-500">محدوده هدف:</span>
              <span className="text-gray-300 tabular-nums" dir="ltr">
                {toFa(s.targetMin)} — {toFa(s.targetMax)} ریال
              </span>
            </div>
          </div>
        );
      })}

      {/* ── Strategy recommendation ── */}
      <div className="rounded-xl border px-4 py-4 space-y-2">
        <p className="text-xs text-gray-400 font-medium">توصیه استراتژیک بر اساس سناریوی غالب ({scenarios[highestKey].name}):</p>
        <p className={`text-sm font-bold ${strategy.color} border rounded-lg px-3 py-2`}>{strategy.text}</p>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function VdssVdes({ scenarios, currentPrice }: VdssVdesProps) {
  if (!scenarios) return <LoadingSkeleton />;

  return (
    <div className="bg-[#0b0f1a] rounded-2xl p-4">
      <Tabs defaultValue="vdss" dir="rtl">
        <TabsList className="bg-white/5 border border-white/10 rounded-lg">
          <TabsTrigger
            value="vdss"
            className="data-[state=active]:bg-[#111d2e] data-[state=active]:text-cyan-400 text-gray-400 rounded-md px-4"
          >
            VDss — گراف تصمیم
          </TabsTrigger>
          <TabsTrigger
            value="vdes"
            className="data-[state=active]:bg-[#111d2e] data-[state=active]:text-cyan-400 text-gray-400 rounded-md px-4"
          >
            VDes — تحلیل متنی
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vdss">
          <VdssGraph scenarios={scenarios} currentPrice={currentPrice} />
        </TabsContent>

        <TabsContent value="vdes">
          <VdesAnalysis scenarios={scenarios} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
