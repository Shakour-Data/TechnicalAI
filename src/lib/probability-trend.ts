// ─── 30-Day Cumulative Probability Trend Calculator ───────────────────────
// Dual-exponential decay model with per-scenario + group cumulative trends.

// ── Scenario keys (bearish → bullish) ──────────────────────────────────────
export const SCENARIO_KEYS = [
  'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9',
] as const;

// Scenario mapping MUST match decision-graph.ts terminal node definitions exactly.
// decision-graph.ts: R1-R4 = bullish, R5 = neutral, R6-R9 = bearish
export const SCENARIO_META: Record<string, { label: string; group: 'bearish' | 'neutral' | 'bullish' }> = {
  R1: { label: 'صعودی با احتیاط', group: 'bullish' },
  R2: { label: 'صعودی قوی', group: 'bullish' },
  R3: { label: 'صعودی شتابدار', group: 'bullish' },
  R4: { label: 'شوک صعودی', group: 'bullish' },
  R5: { label: 'رنج', group: 'neutral' },
  R6: { label: 'نزولی با احتیاط', group: 'bearish' },
  R7: { label: 'نزولی قوی', group: 'bearish' },
  R8: { label: 'نزولی شتابدار', group: 'bearish' },
  R9: { label: 'شوک نزولی', group: 'bearish' },
};

// ── Interfaces ──────────────────────────────────────────────────────────────
export interface DayPoint {
  day: number;
  individualProb: number;
  cumulativeProb: number;
}

export type TrendDirection = 'rising' | 'falling' | 'stable' | 'flat';

export interface ScenarioTrend {
  scenarioKey: string;
  label: string;
  group: 'bearish' | 'neutral' | 'bullish';
  currentProbability: number;
  trend: DayPoint[];
  trendDirection: TrendDirection;
  peakDay: number;
  peakProbability: number;
}

export interface GroupTrend {
  group: 'bearish' | 'neutral' | 'bullish';
  label: string;
  trend: DayPoint[];
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

// ── Decay math ──────────────────────────────────────────────────────────────
// Uses a logistic-sigmoid CDF model instead of pure exponential decay.
// This produces a realistic S-curve: slow start → acceleration → saturation.
// The shape parameter (skew) controls whether the curve leans early or late,
// allowing different scenarios to peak on different days.
//
// For bullish scenarios (high confidence): peak earlier (days 3-8)
// For neutral scenarios: peak in the middle (days 10-15)  
// For bearish scenarios: peak later (days 15-25) — risk accumulates over time

const STEEPNESS = 0.25; // logistic steepness (higher = more concentrated)

/**
 * Build a per-scenario normalized weight distribution over `horizon` days.
 * Uses logistic CDF to create a bell-like distribution that can peak at
 * different days depending on the scenario's nature.
 */
function buildScenarioWeights(
  horizon: number,
  group: 'bullish' | 'neutral' | 'bearish',
  prob: number,
): number[] {
  // Peak day depends on group and probability strength
  // Higher probability → earlier peak (scenario materializes sooner)
  const probFactor = Math.min(prob / 0.25, 1); // normalize, cap at 1
  
  let peakDay: number;
  if (group === 'bullish') {
    // Bullish: peak between day 2 and day 8 (earlier for high prob)
    peakDay = 2 + Math.round((1 - probFactor) * 6);
  } else if (group === 'bearish') {
    // Bearish: peak between day 8 and day 22 (later for low prob)
    peakDay = 8 + Math.round((1 - probFactor) * 14);
  } else {
    // Neutral: peak between day 5 and day 15
    peakDay = 5 + Math.round((1 - probFactor) * 10);
  }

  // Build asymmetric bell curve using difference of two logistic CDFs
  const width = group === 'neutral' ? 8 : 6;
  const raw: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const leftEdge  = 1 / (1 + Math.exp(-STEEPNESS * (h - (peakDay - width / 2))));
    const rightEdge = 1 / (1 + Math.exp(-STEEPNESS * (h - (peakDay + width / 2))));
    raw.push(leftEdge - rightEdge);
  }

  // Normalize so weights sum to 1
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    // Fallback: uniform distribution
    return Array(horizon).fill(1 / horizon);
  }
  return raw.map(v => v / sum);
}

// ── Per-scenario trend ──────────────────────────────────────────────────────
function scenarioTrend(
  key: string,
  prob: number,
  weights: number[],
): ScenarioTrend {
  const meta = SCENARIO_META[key];
  const trend: DayPoint[] = [];
  let cum = 0;
  let peakDay = 1;
  let peakProb = 0;

  for (let i = 0; i < weights.length; i++) {
    const day = i + 1;
    const individual = prob * weights[i];
    cum += individual;
    trend.push({ day, individualProb: individual, cumulativeProb: cum });
    if (individual > peakProb) { peakProb = individual; peakDay = day; }
  }

  const horizon = weights.length;
  const dir: TrendDirection = peakDay <= 2 ? 'falling' : peakDay >= horizon - 1 ? 'rising' : 'stable';

  return { scenarioKey: key, label: meta.label, group: meta.group, currentProbability: prob, trend, trendDirection: dir, peakDay, peakProbability: peakProb };
}

// ── Group cumulative trends ─────────────────────────────────────────────────
function groupTrends(scenarios: ScenarioTrend[]): GroupTrend[] {
  const buckets: Record<string, ScenarioTrend[]> = { bearish: [], neutral: [], bullish: [] };
  for (const s of scenarios) buckets[s.group].push(s);

  const labels: Record<string, string> = { bearish: 'خرسی', neutral: 'خنثی', bullish: 'گاوی' };
  const horizon = scenarios[0]?.trend.length ?? 0;

  return (Object.keys(labels) as Array<'bearish' | 'neutral' | 'bullish'>).map(g => {
    const trend: DayPoint[] = [];
    for (let i = 0; i < horizon; i++) {
      const day = i + 1;
      const individual = buckets[g].reduce((s, sc) => s + sc.trend[i].individualProb, 0);
      const cum = i === 0 ? individual : trend[i - 1].cumulativeProb + individual;
      trend.push({ day, individualProb: individual, cumulativeProb: cum });
    }
    return { group: g, label: labels[g], trend };
  });
}

// ── Public API ──────────────────────────────────────────────────────────────
export function calculateProbabilityTrend(
  scenarioProbabilities: ScenarioProbabilities,
  horizon: number = 30,
): ProbabilityTrendResult {
  const scenarios = SCENARIO_KEYS.map(k => {
    const prob = scenarioProbabilities[k] ?? 0;
    const group = SCENARIO_META[k].group;
    const weights = buildScenarioWeights(horizon, group, prob);
    return scenarioTrend(k, prob, weights);
  });
  return { horizon, scenarios, groups: groupTrends(scenarios), dominance: computeDominance(scenarios) };
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
      probability: bestSum,
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
  const bCum = last(bearish)?.cumulativeProb ?? 0;
  const nCum = last(neutral)?.cumulativeProb ?? 0;
  const buCum = last(bullish)?.cumulativeProb ?? 0;

  // Dominant direction
  if (buCum > bCum + 0.15) lines.push('🏆 روند غالب ۳۰ روزه آینده: صعودی (احتمال تجمعی گاوی به‌طور محسوسی بالاتر از خرسی)');
  else if (bCum > buCum + 0.15) lines.push('⚠️ روند غالب ۳۰ روزه آینده: نزولی (احتمال تجمعی خرسی به‌طور محسوسی بالاتر از گاوی)');
  else lines.push('📊 روند ۳۰ روزه آینده: متعادل / بدون برتری مشخص');

  // Peak concentration
  const topScenario = [...results.scenarios].sort((a, b) => b.peakProbability - a.peakProbability)[0];
  if (topScenario) lines.push(`📐 بیشترین تمرکز احتمال: ${topScenario.label} در روز ${topScenario.peakDay}`);

  // Early vs late risk
  const earlyBear = bearish.slice(0, 5).reduce((s, d) => s + d.individualProb, 0);
  const lateBull = bullish.slice(-5).reduce((s, d) => s + d.individualProb, 0);
  if (earlyBear > lateBull * 1.5) lines.push('🔻 ریسک نزولی در روزهای اول بالاتر از پتانسیل صعودی روزهای پایانی');
  else if (lateBull > earlyBear * 1.5) lines.push('🔺 پتانسیل صعودی در روزهای پایانی بالاتر از ریسک نزولی ابتدایی');

  // Neutral accumulation
  if (nCum > 0.3) lines.push('➖ احتمال خنثی در ۳۰ روز بالاست (بیش از ۳۰٪) — احتیاط در معامله توصیه می‌شود');

  // Actionable insight
  if (buCum > bCum) lines.push('💡 پیشنهاد: موقعیت‌گیری تدریجی صعودی با مدیریت ریسک در ۵ روز اول');
  else if (bCum > buCum) lines.push('💡 پیشنهاد: کاهش مواجهه یا پوشش ریسک (hedging) تا عبور از فاز نزولی اولیه');
  else lines.push('💡 پیشنهاد: انتظار برای سیگنال تأیید جهت قبل از ورود به بازار');

  // Scenario dominance per period (from spec)
  for (const d of results.dominance) {
    lines.push(`📌 ${d.periodLabel}: سناریوی غالب «${d.dominantLabel}» با احتمال تجمعی ${(d.probability * 100).toFixed(1)}٪ — ${d.action}`);
  }

  return lines.join('\n');
}
