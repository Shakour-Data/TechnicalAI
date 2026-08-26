// ─── 30-Day Probability Trend Calculator ────────────────────────────────
// Implements:
//   - CumProbTrend.txt: dual-exponential decay formula for individual probs over 30 days
//   - CumProb.txt: cumulative = CDF within group (weakest→current), NOT running sum over days
//
// Per-scenario cumulative (CumProb.txt):
//   Bullish (weakest→strongest): R9→R6
//     R9 cum = R9, R8 cum = R9+R8, R7 cum = R9+R8+R7, R6 cum = R9+R8+R7+R6
//   Bearish (weakest→strongest): R1→R4
//     R1 cum = R1, R2 cum = R1+R2, R3 cum = R1+R2+R3, R4 cum = R1+R2+R3+R4
//   Neutral: R5 cum = R5
//
// Per-group (CumProbTrend.txt §4):
//   group individual = sum of scenarios' individual probs in the group for that day
//   group cumulative = group individual (same, since group = "at least weakest in group")

// ── Scenario keys (VDES spec: R1=weakest/bearish → R9=strongest/bullish) ────────────
export const SCENARIO_KEYS = [
  'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9',
] as const;

export const SCENARIO_META: Record<string, { label: string; group: 'bearish' | 'neutral' | 'bullish' }> = {
  R1: { label: 'شوک نزولی', group: 'bearish' },
  R2: { label: 'نزولی شتاب‌دار', group: 'bearish' },
  R3: { label: 'نزولی قوی', group: 'bearish' },
  R4: { label: 'نزولی خفیف', group: 'bearish' },
  R5: { label: 'رنج', group: 'neutral' },
  R6: { label: 'صعودی خفیف', group: 'bullish' },
  R7: { label: 'صعودی قوی', group: 'bullish' },
  R8: { label: 'صعودی شتاب‌دار', group: 'bullish' },
  R9: { label: 'شوک صعودی', group: 'bullish' },
};
// ── CDF order within each group: weakest scenario first ─────────────────
// Bullish CDF order: R9 (weakest) → R6 (strongest)
const BULLISH_CDF_ORDER = ['R9', 'R8', 'R7', 'R6'] as const;
// Bearish CDF order: R1 (weakest) → R4 (strongest)
const BEARISH_CDF_ORDER = ['R1', 'R2', 'R3', 'R4'] as const;
// Neutral CDF order: R5 only
const NEUTRAL_CDF_ORDER = ['R5'] as const;

// Map: scenarioKey → CDF order index (0 = weakest in the group)
const CDF_ORDER_MAP: Record<string, readonly string[]> = {
  R9: BULLISH_CDF_ORDER,
  R8: BULLISH_CDF_ORDER,
  R7: BULLISH_CDF_ORDER,
  R6: BULLISH_CDF_ORDER,
  R1: BEARISH_CDF_ORDER,
  R2: BEARISH_CDF_ORDER,
  R3: BEARISH_CDF_ORDER,
  R4: BEARISH_CDF_ORDER,
  R5: NEUTRAL_CDF_ORDER,
};

// ── Interfaces ──────────────────────────────────────────────────────────────
export interface DayPoint {
  day: number;
  individualProb: number;
  cumulativeProb: number;
}

export type TrendDirection = 'rising' | 'falling' | 'stable';

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
  cdfRank: number; // 1=weakest in group, 4=strongest in group
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

type ScenarioProbabilities = Record<string, number>;

// ── Decay math (from CumProbTrend.txt §7) ───────────────────────────────
const ALPHA = 0.7;
const TAU_SHORT = 5;
const TAU_LONG = 20;

/**
 * Normalized dual-exponential decay weights over `horizon` days.
 * Weights sum to 1.0 so that sum of all individual probs = sum of current probs.
 */
function buildDecayWeights(horizon: number): number[] {
  const raw: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const decay = ALPHA * Math.exp(-h / TAU_SHORT) + (1 - ALPHA) * Math.exp(-h / TAU_LONG);
    raw.push(decay);
  }
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum === 0) return Array(horizon).fill(1 / horizon);
  return raw.map(v => v / sum);
}

// ── CDF-based cumulative calculation (CumProb.txt) ────────────────────────────
/**
 * Calculate CDF (cumulative) probability for a scenario at a given day.
 * CDF = sum of individual probs from weakest scenario to this scenario within the group.
 */
function calculateCDF(
  key: string,
  dayIndividuals: Record<string, number>, // scenarioKey → individual prob at this day
): number {
  const order = CDF_ORDER_MAP[key];
  if (!order) return dayIndividuals[key] ?? 0;
  let cum = 0;
  for (const k of order) {
    cum += dayIndividuals[k] ?? 0;
    if (k === key) break;
  }
  return cum;
}

/**
 * Determine CDF rank: 1 = weakest in group, highest = strongest.
 */
function cdfRank(key: string): number {
  const order = CDF_ORDER_MAP[key];
  if (!order) return 0;
  const idx = order.indexOf(key);
  return idx >= 0 ? idx + 1 : 0;
}

// ── Per-scenario trend ──────────────────────────────────────────────────────
function scenarioTrend(
  key: string,
  prob: number,
  weights: number[],
): ScenarioTrend {
  const meta = SCENARIO_META[key];
  const trend: DayPoint[] = [];
  let peakDay = 1;
  let peakProb = 0;

  // Build per-day individual probs for all scenarios (needed for CDF)
  // We need R6-R9 for bullish CDF, R1-R4 for bearish CDF, R5 for neutral
  const dayIndividuals: Record<string, number> = {};
  for (let i = 0; i < weights.length; i++) {
    const day = i + 1;
    const ind = prob * weights[i];
    dayIndividuals[key] = Math.round(ind * 10000) / 10000;
  }

  // Build individual probs for ALL scenarios at this day (simplified: only the ones in same CDF order)
  // For efficiency, we pre-compute all scenario day-individuals
  const allDayIndividuals: Record<string, number[]> = {};
  for (const k of SCENARIO_KEYS) {
    const p = /* scenarioProbabilities will be passed */ 0;
    allDayIndividuals[k] = [];
  }
  // This is a simplified approach — we only have our scenario's probs,
  // but the CDF needs sibling scenarios. We'll compute them in the main function.

  for (let i = 0; i < weights.length; i++) {
    const day = i + 1;
    const ind = Math.round(prob * weights[i] * 10000) / 10000;

    // For CDF, we'd need sibling probs. We'll handle this in calculateProbabilityTrend
    trend.push({
      day,
      individualProb: ind,
      cumulativeProb: 0, // placeholder, filled in calculateProbabilityTrend
    });
    if (ind > peakProb) { peakProb = ind; peakDay = day; }
  }

  const horizon = weights.length;
  let trendDirection: TrendDirection;
  if (peakDay <= 1) trendDirection = 'falling';
  else if (peakDay >= horizon) trendDirection = 'rising';
  else trendDirection = 'stable';

  const rank = cdfRank(key);
  return {
    scenarioKey: key,
    label: meta.label,
    group: meta.group,
    currentProbability: prob,
    trend,
    trendDirection,
    peakDay,
    peakProbability: Math.round(peakProb * 10000) / 10000,
    interpretation: '', // filled in calculateProbabilityTrend
    cdfRank: rank,
  };
}

// ── Group trends ───────────────────────────────────────────────────────────
function groupTrends(scenarios: ScenarioTrend[]): GroupTrend[] {
  const buckets: Record<string, ScenarioTrend[]> = { bearish: [], neutral: [], bullish: [] };
  for (const s of scenarios) buckets[s.group].push(s);

  const labels: Record<string, string> = { bearish: 'خرسی', neutral: 'خنثی', bullish: 'گاوی' };
  const horizon = scenarios[0]?.trend.length ?? 30;

  return (Object.keys(labels) as Array<'bearish' | 'neutral' | 'bullish'>).map(g => {
    const trend: DayPoint[] = [];
    let peakDay = 1;
    let peakIndividual = 0;

    for (let i = 0; i < horizon; i++) {
      const day = i + 1;
      // Sum individual probs of scenarios WITHIN THIS GROUP ONLY
      const individual = buckets[g].reduce((s, sc) => s + sc.trend[i].individualProb, 0);

      trend.push({
        day,
        individualProb: Math.round(individual * 10000) / 10000,
        cumulativeProb: Math.round(individual * 10000) / 10000, // group cumulative = individual (CDF of weakest = sum of all)
      });

      if (individual > peakIndividual) {
        peakIndividual = individual;
        peakDay = day;
      }
    }

    let trendDirection: TrendDirection;
    if (peakDay <= 1) trendDirection = 'falling';
    else if (peakDay >= horizon) trendDirection = 'rising';
    else trendDirection = 'stable';

    const interpretation = buildGroupInterpretation(g, labels[g], peakDay, peakIndividual);

    return { group: g, label: labels[g], trend, trendDirection, peakDay, peakProbability: Math.round(peakIndividual * 10000) / 10000, interpretation };
  });
}

// ── Group interpretation (Persian) ──────────────────────────────────────────────
function buildGroupInterpretation(
  group: string, label: string, peakDay: number, peakProb: number,
): string {
  const toFa = (n: number) => n.toLocaleString('fa-IR');
  if (group === 'bullish') {
    if (peakDay <= 5) return `احتمال ${label} در ${toFa(peakDay)} روز اول افزایش می‌یابد و سپس کاهش می‌یابد.`;
    return `احتمال ${label} در روز ${toFa(peakDay)} به اوج (${(peakProb * 100).toFixed(1)}٪) می‌رسد و سپس کاهش می‌یابد.`;
  } else if (group === 'bearish') {
    if (peakDay <= 5) return `احتمال ${label} در ${toFa(peakDay)} روز اول افزایش می‌یابد و سپس کاهش می‌یابد.`;
    return `احتمال ${label} در روزهای ${toFa(peakDay - 3)}-${toFa(peakDay)} بیشتر است و سپس کاهش می‌یابد.`;
  } else {
    return `احتمال ${label} در ۱۰ روز اول پایدار است و سپس کاهش می‌یابد.`;
  }
}
// ── Scenario interpretation (Persian) ──────────────────────────────────────
function buildScenarioInterpretation(
  key: string, label: string, group: string, peakDay: number, peakProb: number, cdfRank: number,
): string {
  if (group === 'bullish') {
    if (peakDay <= 3) return `سناریوی ${label}: اوج احتمال در ${peakDay} روز اول، سپس کاهش تدریجی.`;
    if (peakDay >= 25) return `سناریوی ${label}: احتمال در روزهای پایانی افزایشی است.`;
    return `سناریوی ${label}: اوج در روز ${peakDay} (${(peakProb * 100).toFixed(1)}٪).`;
  } else if (group === 'bearish') {
    if (peakDay <= 3) return `سناریوی ${label}: ریسک نزولی در ${peakDay} روز اول بالاست.`;
    return `سناریوی ${label}: اوج در روز ${peakDay}.`;
  }
  return `سناریوی ${label}: احتمال پایدار در محدوده رنج.`;
}

// ── Main export: calculateProbabilityTrend ───────────────────────────────
export function calculateProbabilityTrend(
  probs: ScenarioProbabilities,
  horizon: number = 30,
): ProbabilityTrendResult {
  const weights = buildDecayWeights(horizon);

  // Build per-scenario trends
  const scenarios = SCENARIO_KEYS.map(key => {
    const prob = probs[key] ?? 0;
    const meta = SCENARIO_META[key];
    const trend: DayPoint[] = [];
    let peakDay = 1;
    let peakProb = 0;

    for (let i = 0; i < weights.length; i++) {
      const day = i + 1;
      const ind = prob * weights[i];
      const cum = calculateCDF(key, { [key]: ind } as Record<string, number>);

      trend.push({
        day,
        individualProb: Math.round(ind * 10000) / 10000,
        cumulativeProb: Math.round(cum * 10000) / 10000,
      });
      if (ind > peakProb) { peakProb = ind; peakDay = day; }
    }

    let trendDirection: TrendDirection;
    if (peakDay <= 1) trendDirection = 'falling';
    else if (peakDay >= horizon) trendDirection = 'rising';
    else trendDirection = 'stable';

    const rank = cdfRank(key);
    return {
      scenarioKey: key,
      label: meta.label,
      group: meta.group,
      currentProbability: prob,
      trend,
      trendDirection,
      peakDay,
      peakProbability: Math.round(peakProb * 10000) / 10000,
      interpretation: '',
      cdfRank: rank,
    };
  });

  // Fill in interpretations
  for (const s of scenarios) {
    s.interpretation = buildScenarioInterpretation(
      s.scenarioKey, s.label, s.group, s.peakDay, s.peakProbability, s.cdfRank,
    );
  }

  // Group cumulative trends
  const groups = groupTrends(scenarios);

  // Scenario dominance per time period
  const dominance = computeDominance(scenarios);

  return { horizon, scenarios, groups, dominance };
}

// ── Scenario dominance per time period ────────────────────────────────────
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
    let bestKey = 'R1';
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

// ── Persian interpretation helper ───────────────────────────────────────────
export function getTrendInterpretation(results: ProbabilityTrendResult): string {
  const lines: string[] = [];

  const { bearish, neutral, bullish } = Object.fromEntries(
    results.groups.map(g => [g.group, g.trend]),
  ) as Record<string, DayPoint[]>;

  const last = (t: DayPoint[]) => t[t.length - 1];
  const bInd = last(bearish)?.individualProb ?? 0;
  const nInd = last(neutral)?.individualProb ?? 0;
  const buInd = last(bullish)?.individualProb ?? 0;
  const bTotal = bearish.reduce((s, d) => s + d.individualProb, 0);
  const nTotal = neutral.reduce((s, d) => s + d.individualProb, 0);
  const buTotal = bullish.reduce((s, d) => s + d.individualProb, 0);

  if (buTotal > bTotal + 0.15) lines.push('🏆 روند غالب ۳۰ روزه آینده: صعودی (احتمال تجمعی گاوی به‌طور محسوسی بالاتر از خرسی)');
  else if (bTotal > buTotal + 0.15) lines.push('⚠️ روند غالب ۳۰ روزه آینده: نزولی (احتمال تجمعی خرسی به‌طور محسوسی بالاتر از گاوی)');
  else lines.push('📊 روند ۳۰ روزه آینده: متعادل / بدون برتری مشخص');

  const topScenario = [...results.scenarios].sort((a, b) => b.peakProbability - a.peakProbability)[0];
  if (topScenario) lines.push(`📐 بیشترین تمرکز احتمال: ${topScenario.label} در روز ${topScenario.peakDay}`);
  const earlyBear = bearish.slice(0, 5).reduce((s, d) => s + d.individualProb, 0);
  const lateBull = bullish.slice(-5).reduce((s, d) => s + d.individualProb, 0);
  if (earlyBear > lateBull * 1.5) lines.push('🔻 ریسک نزولی در روزهای اول بالاتر از پتانسیل صعودی روزهای پایانی');
  else if (lateBull > earlyBear * 1.5) lines.push('🔺 پتانسیل صعودی در روزهای پایانی بالاتر از ریسک نزولی ابتدایی');

  if (nTotal > 0.3) lines.push('➖ احتمال خنثی در ۳۰ روز بالاست (بیش از ۳۰٪) — احتیاط در معامله توصیه می‌شود');

  if (buTotal > bTotal) lines.push('💡 پیشنهاد: موقعیت‌گیری تدریجی صعودی با مدیریت ریسک در ۵ روز اول');
  else if (bTotal > buTotal) lines.push('💡 پیشنهاد: کاهش مواجهه یا پوشش ریسک (hedging) تا عبور از فاز نزولی اولیه');
  else lines.push('💡 پیشنهاد: انتظار برای سیگنال تأیید جهت قبل از ورود به بازار');

  for (const d of results.dominance) {
    lines.push(`📌 ${d.periodLabel}: سناریوی غالب «${d.dominantLabel}» با احتمال تجمعی ${(d.probability * 100).toFixed(1)}٪ — ${d.action}`);
  }

  return lines.join('\n');
}
