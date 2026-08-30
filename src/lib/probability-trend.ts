// ═══════════════════════════════════════════════════════════════════════════════
// 30-Day Probability Trend Calculator — Correct Implementation
// ═══════════════════════════════════════════════════════════════════════════════
// Per TechnicalAnalysisDssGraph_CumProb.txt & CumProbTrend.txt:
//
//   - NO decay factor. Each day is independent.
//   - Individual prob: P_ind(s) for each scenario s, sum = 1 for all 9.
//   - Cumulative prob (CDF within group, same day only):
//     Bullish (most severe → least): SC9, SC8, SC7, SC6
//       Cum(SC9) = SC9
//       Cum(SC8) = SC9 + SC8
//       Cum(SC7) = SC9 + SC8 + SC7
//       Cum(SC6) = SC9 + SC8 + SC7 + SC6  (total bullish)
//     Neutral: Cum(SC5) = SC5
//     Bearish (most severe → least): SC1, SC2, SC3, SC4
//       Cum(SC1) = SC1
//       Cum(SC2) = SC1 + SC2
//       Cum(SC3) = SC1 + SC2 + SC3
//       Cum(SC4) = SC1 + SC2 + SC3 + SC4  (total bearish)
//
//   - Group cumulative: Bullish_Cum + Neutral_Cum + Bearish_Cum = 1.0
// ═══════════════════════════════════════════════════════════════════════════════

// ── Scenario keys ─────────────────────────────────────────────────────────────
export const SCENARIO_KEYS = [
  'SC1', 'SC2', 'SC3', 'SC4', 'SC5', 'SC6', 'SC7', 'SC8', 'SC9',
] as const;

export const SCENARIO_META: Record<string, { label: string; group: 'bearish' | 'neutral' | 'bullish' }> = {
  SC1: { label: 'شوک نزولی', group: 'bearish' },
  SC2: { label: 'نزولی شتاب‌دار', group: 'bearish' },
  SC3: { label: 'نزولی قوی', group: 'bearish' },
  SC4: { label: 'نزولی خفیف', group: 'bearish' },
  SC5: { label: 'رنج', group: 'neutral' },
  SC6: { label: 'صعودی خفیف', group: 'bullish' },
  SC7: { label: 'صعودی قوی', group: 'bullish' },
  SC8: { label: 'صعودی شتاب‌دار', group: 'bullish' },
  SC9: { label: 'شوک صعودی', group: 'bullish' },
};

// ── CDF order: most severe → least severe (per documentation §4) ──────────────
const BULLISH_CDF_ORDER = ['SC9', 'SC8', 'SC7', 'SC6'] as const;
const BEARISH_CDF_ORDER = ['SC1', 'SC2', 'SC3', 'SC4'] as const;
const NEUTRAL_CDF_ORDER = ['SC5'] as const;

const CDF_ORDER_MAP: Record<string, readonly string[]> = {
  SC9: BULLISH_CDF_ORDER, SC8: BULLISH_CDF_ORDER, SC7: BULLISH_CDF_ORDER, SC6: BULLISH_CDF_ORDER,
  SC1: BEARISH_CDF_ORDER, SC2: BEARISH_CDF_ORDER, SC3: BEARISH_CDF_ORDER, SC4: BEARISH_CDF_ORDER,
  SC5: NEUTRAL_CDF_ORDER,
};

// ── Interfaces ─────────────────────────────────────────────────────────────────
export interface DayPoint {
  day: number;           // 1 = most recent (today), 30 = 30 days ago
  individualProb: number;
  cumulativeProb: number;
}

export type TrendDirection = 'rising' | 'falling' | 'stable' | 'volatile';

export interface ScenarioTrend {
  scenarioKey: string;
  label: string;
  group: 'bearish' | 'neutral' | 'bullish';
  currentProbability: number;
  trend: DayPoint[];
  trendDirection: TrendDirection;
  peakDay: number;
  peakProbability: number;
  interpretation: string;
}

export interface GroupTrend {
  group: 'bearish' | 'neutral' | 'bullish';
  label: string;
  trend: DayPoint[];
  trendDirection: TrendDirection;
  peakDay: number;
  peakProbability: number;
  interpretation: string;
}

export interface ScenarioDominance {
  period: string;
  periodLabel: string;
  dominantScenario: string;
  dominantLabel: string;
  probability: number;
  action: string;
}

export interface ProbabilityTrendResult {
  horizon: number;
  scenarios: ScenarioTrend[];
  groups: GroupTrend[];
  dominance: ScenarioDominance[];
}

/** A single day's probability snapshot — input to buildTrendFromDailySnapshots */
export interface DailyProbabilitySnapshot {
  date: string;
  dayIndex: number;  // 0 = today, -1 = yesterday, -2, ..., -29
  probs: Record<string, number>; // SC1-SC9, sum = 1
}

type ScenarioProbabilities = Record<string, number>;

// ── CDF calculation (per documentation §4) ─────────────────────────────────────
/**
 * Calculate cumulative (CDF) probability for a scenario within its group.
 * CDF = sum of individual probs from most severe to this scenario (inclusive).
 * This uses ALL sibling scenarios' individual probs from the same day.
 */
export function calculateCDF(
  key: string,
  allDayIndividuals: Record<string, number>,
): number {
  const order = CDF_ORDER_MAP[key];
  if (!order) return allDayIndividuals[key] ?? 0;
  let cum = 0;
  for (const k of order) {
    cum += allDayIndividuals[k] ?? 0;
    if (k === key) break;
  }
  return cum;
}

/** Calculate group cumulative for a single day */
export function calculateGroupCumulatives(
  allDayIndividuals: Record<string, number>,
): { bullishCum: number; neutralCum: number; bearishCum: number } {
  const bullishCum = calculateCDF('SC6', allDayIndividuals); // SC6 is least severe bullish, so CDF = total
  const neutralCum = allDayIndividuals['SC5'] ?? 0;
  const bearishCum = calculateCDF('SC4', allDayIndividuals); // SC4 is least severe bearish, so CDF = total
  return { bullishCum, neutralCum, bearishCum };
}

// ── Build trend from 30 daily probability snapshots (CORRECT method) ──────────
/**
 * Builds the 30-day probability trend from an array of daily probability snapshots.
 * Each day is independent — no decay, no look-ahead bias.
 * @param dailySnapshots Array of DailyProbabilitySnapshot, sorted by date desc (today first)
 */
export function buildTrendFromDailySnapshots(
  dailySnapshots: DailyProbabilitySnapshot[],
): ProbabilityTrendResult {
  const horizon = dailySnapshots.length;
  if (horizon === 0) {
    return { horizon: 0, scenarios: [], groups: [], dominance: [] };
  }

  // Build per-scenario trends
  const scenarios: ScenarioTrend[] = SCENARIO_KEYS.map(key => {
    const meta = SCENARIO_META[key];
    const trend: DayPoint[] = [];
    let peakDay = 1;
    let peakProb = 0;

    for (let i = 0; i < horizon; i++) {
      const snap = dailySnapshots[i];
      const day = i + 1;
      const ind = snap.probs[key] ?? 0;
      // Calculate CDF using ALL scenarios' individual probs from this day
      const cum = calculateCDF(key, snap.probs);

      trend.push({
        day,
        individualProb: Math.round(ind * 10000) / 10000,
        cumulativeProb: Math.round(cum * 10000) / 10000,
      });
      if (ind > peakProb) { peakProb = ind; peakDay = day; }
    }

    const trendDirection = detectTrendDirection(trend);
    const interpretation = buildScenarioInterpretation(key, meta.label, meta.group, trend, peakDay, peakProb);

    return {
      scenarioKey: key,
      label: meta.label,
      group: meta.group,
      currentProbability: trend[0]?.individualProb ?? 0,
      trend,
      trendDirection,
      peakDay,
      peakProbability: Math.round(peakProb * 10000) / 10000,
      interpretation,
    };
  });

  // Group trends
  const groups = buildGroupTrends(dailySnapshots, horizon);

  // Dominance
  const dominance = computeDominance(scenarios);

  return { horizon, scenarios, groups, dominance };
}

// ── Fallback: build trend from a single day's probabilities ───────────────────
/**
 * When only today's probabilities are available, create a 1-day trend.
 * This is a fallback — ideally use buildTrendFromDailySnapshots with 30 days.
 */
export function buildSingleDayTrend(
  probs: ScenarioProbabilities,
  date: string = '',
): ProbabilityTrendResult {
  const snap: DailyProbabilitySnapshot = {
    date: date || new Date().toISOString().slice(0, 10),
    dayIndex: 0,
    probs,
  };
  return buildTrendFromDailySnapshots([snap]);
}

// ── Group trends ───────────────────────────────────────────────────────────────
function buildGroupTrends(
  dailySnapshots: DailyProbabilitySnapshot[],
  horizon: number,
): GroupTrend[] {
  const groupDefs: Array<{ group: 'bearish' | 'neutral' | 'bullish'; label: string; keys: readonly string[] }> = [
    { group: 'bullish', label: 'گاوی', keys: BULLISH_CDF_ORDER },
    { group: 'neutral', label: 'خنثی', keys: NEUTRAL_CDF_ORDER },
    { group: 'bearish', label: 'خرسی', keys: BEARISH_CDF_ORDER },
  ];

  return groupDefs.map(({ group, label, keys }) => {
    const trend: DayPoint[] = [];
    let peakDay = 1;
    let peakCum = 0;

    for (let i = 0; i < horizon; i++) {
      const day = i + 1;
      const dayProbs = dailySnapshots[i].probs;

      // Group cumulative = CDF of least severe scenario in group (= sum of all in group)
      const leastSevereKey = keys[keys.length - 1];
      const cum = calculateCDF(leastSevereKey, dayProbs);
      // Individual for group = same as cumulative (total of all scenarios in group)

      trend.push({
        day,
        individualProb: Math.round(cum * 10000) / 10000,
        cumulativeProb: Math.round(cum * 10000) / 10000,
      });
      if (cum > peakCum) { peakCum = cum; peakDay = day; }
    }

    const trendDirection = detectTrendDirection(trend);
    const interpretation = buildGroupInterpretation(group, label, trend, peakDay, peakCum);

    return {
      group,
      label,
      trend,
      trendDirection,
      peakDay,
      peakProbability: Math.round(peakCum * 10000) / 10000,
      interpretation,
    };
  });
}

// ── Trend direction detection ─────────────────────────────────────────────────
function detectTrendDirection(trend: DayPoint[]): TrendDirection {
  if (trend.length < 3) return 'stable';

  const first = trend[0].individualProb;
  const last = trend[trend.length - 1].individualProb;
  const mid = trend[Math.floor(trend.length / 2)].individualProb;

  // Count direction changes
  let changes = 0;
  for (let i = 1; i < trend.length; i++) {
    const diff = trend[i].individualProb - trend[i - 1].individualProb;
    if (Math.abs(diff) > 0.005) changes++;
  }

  if (changes > trend.length * 0.6) return 'volatile';
  if (last > first + 0.03) return 'rising';
  if (last < first - 0.03) return 'falling';
  if (mid > first + 0.02 && mid > last + 0.02) return 'stable';
  return 'stable';
}

// ── Interpretations (Persian) ─────────────────────────────────────────────────
function buildScenarioInterpretation(
  key: string, label: string, group: string, trend: DayPoint[], peakDay: number, peakProb: number,
): string {
  const toFa = (n: number) => n.toLocaleString('fa-IR');
  const current = trend[0]?.cumulativeProb ?? 0;
  const pct = (v: number) => (v * 100).toFixed(1);

  if (group === 'bullish') {
    if (current > 0.4) return `${label}: احتمال تجمعی صعودی ${pct(current)}٪ — فشار خرید قوی`;
    if (current > 0.25) return `${label}: احتمال تجمعی صعودی ${pct(current)}٪ — فشار خرید متوسط`;
    return `${label}: احتمال تجمعی صعودی ${pct(current)}٪ — فشار خرید ضعیف`;
  } else if (group === 'bearish') {
    if (current > 0.3) return `${label}: احتمال تجمعی نزولی ${pct(current)}٪ — ریسک نزولی بالا`;
    if (current > 0.15) return `${label}: احتمال تجمعی نزولی ${pct(current)}٪ — ریسک نزولی متوسط`;
    return `${label}: احتمال تجمعی نزولی ${pct(current)}٪ — ریسک نزولی پایین`;
  }
  return `${label}: احتمال خنثی ${pct(current)}٪`;
}

function buildGroupInterpretation(
  group: string, label: string, trend: DayPoint[], peakDay: number, peakProb: number,
): string {
  const pct = (v: number) => (v * 100).toFixed(1);
  const current = trend[0]?.cumulativeProb ?? 0;
  const first = trend[0]?.cumulativeProb ?? 0;
  const last = trend[trend.length - 1]?.cumulativeProb ?? 0;

  const direction = last > first + 0.05 ? 'افزایشی' : last < first - 0.05 ? 'کاهشی' : 'پایدار';

  if (group === 'bullish') {
    return `احتمال تجمعی ${label}: ${pct(current)}٪ — روند ${direction} در ۳۰ روز گذشته`;
  } else if (group === 'bearish') {
    return `احتمال تجمعی ${label}: ${pct(current)}٪ — روند ${direction} در ۳۰ روز گذشته`;
  }
  return `احتمال تجمعی ${label}: ${pct(current)}٪ — روند ${direction} در ۳۰ روز گذشته`;
}

// ── Scenario dominance per time period ────────────────────────────────────────
const DOMINANCE_PERIODS = [
  { key: 'day_1_5', label: 'روز ۱-۵', start: 1, end: 5 },
  { key: 'day_6_15', label: 'روز ۶-۱۵', start: 6, end: 15 },
  { key: 'day_16_30', label: 'روز ۱۶-۳۰', start: 16, end: 30 },
] as const;

const DOMINANCE_ACTIONS: Record<string, string> = {
  bullish: 'ورود تدریجی به موقعیت خرید با مدیریت ریسک',
  neutral: 'انتظار برای سیگنال تأیید جهت قبل از ورود',
  bearish: 'کاهش مواجهه یا خروج تدریجی از موقعیت‌ها',
};

function computeDominance(scenarios: ScenarioTrend[]): ScenarioDominance[] {
  const horizon = scenarios[0]?.trend.length ?? 30;
  return DOMINANCE_PERIODS.map(p => {
    const end = Math.min(p.end, horizon);
    let bestKey = 'SC1';
    let bestSum = 0;
    for (const s of scenarios) {
      const periodSum = s.trend
        .filter(d => d.day >= p.start && d.day <= end)
        .reduce((acc, d) => acc + d.individualProb, 0);
      if (periodSum > bestSum) { bestSum = periodSum; bestKey = s.scenarioKey; }
    }
    const best = scenarios.find(s => s.scenarioKey === bestKey)!;
    return {
      period: p.key,
      periodLabel: p.label,
      dominantScenario: bestKey,
      dominantLabel: best.label,
      probability: Math.round(bestSum * 10000) / 10000,
      action: DOMINANCE_ACTIONS[best.group],
    };
  });
}

// ── Persian interpretation helper ─────────────────────────────────────────────
export function getTrendInterpretation(results: ProbabilityTrendResult): string {
  const lines: string[] = [];
  if (results.groups.length === 0) return 'داده کافی برای تحلیل روند موجود نیست.';

  const groupMap = Object.fromEntries(results.groups.map(g => [g.group, g])) as Record<string, GroupTrend>;
  const bull = groupMap['bullish'];
  const bear = groupMap['bearish'];
  const neut = groupMap['neutral'];

  const bullNow = bull?.trend[0]?.cumulativeProb ?? 0;
  const bearNow = bear?.trend[0]?.cumulativeProb ?? 0;
  const neutNow = neut?.trend[0]?.cumulativeProb ?? 0;

  if (bullNow > bearNow + 0.1) lines.push('🏆 روند غالب: صعودی — احتمال تجمعی گاوی به‌طور محسوسی بالاتر از خرسی');
  else if (bearNow > bullNow + 0.1) lines.push('⚠️ روند غالب: نزولی — احتمال تجمعی خرسی به‌طور محسوسی بالاتر از گاوی');
  else lines.push('📊 روند: متعادل — اختلاف احتمال تجمعی گاوی و خرسی ناچیز');

  lines.push(`📈 احتمال تجمعی صعودی: ${(bullNow * 100).toFixed(1)}٪ | خنثی: ${(neutNow * 100).toFixed(1)}٪ | نزولی: ${(bearNow * 100).toFixed(1)}٪`);

  if (bullNow > 0.5) lines.push('💡 سیگنال غالب: صعودی — موقعیت‌گیری تدریجی با مدیریت ریسک');
  else if (bearNow > 0.4) lines.push('💡 سیگنال غالب: نزولی — کاهش مواجهه یا خروج تدریجی');
  else lines.push('💡 سیگنال: خنثی — انتظار برای سیگنال تأیید جهت');

  for (const d of results.dominance) {
    lines.push(`📌 ${d.periodLabel}: سناریوی غالب «${d.dominantLabel}» با احتمال ${(d.probability * 100).toFixed(1)}٪ — ${d.action}`);
  }

  return lines.join('\n');
}

// ── Legacy compat: calculateProbabilityTrend (single-day fallback) ────────────
/** @deprecated Use buildTrendFromDailySnapshots for correct 30-day trends */
export function calculateProbabilityTrend(
  probs: ScenarioProbabilities,
  _horizon: number = 30,
): ProbabilityTrendResult {
  return buildSingleDayTrend(probs);
}
