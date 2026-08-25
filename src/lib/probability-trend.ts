// ─── 30-Day Cumulative Probability Trend Calculator ───────────────────────
// Dual-exponential decay model with per-scenario + group cumulative trends.

// ── Scenario keys (bearish → bullish) ──────────────────────────────────────
export const SCENARIO_KEYS = [
  'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9',
] as const;

export const SCENARIO_META: Record<string, { label: string; group: 'bearish' | 'neutral' | 'bullish' }> = {
  R1: { label: 'شوک نزولی', group: 'bearish' },
  R2: { label: 'نزولی شتاب‌دار', group: 'bearish' },
  R3: { label: 'نزولی قوی', group: 'bearish' },
  R4: { label: 'نزولی با احتیاط', group: 'bearish' },
  R5: { label: 'رنج کم‌نوسان', group: 'neutral' },
  R6: { label: 'صعودی با احتیاط', group: 'bullish' },
  R7: { label: 'صعودی قوی', group: 'bullish' },
  R8: { label: 'صعودی شتاب‌دار', group: 'bullish' },
  R9: { label: 'شوک صعودی', group: 'bullish' },
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

export interface ProbabilityTrendResult {
  horizon: number;
  scenarios: ScenarioTrend[];
  groups: GroupTrend[];
}
type ScenarioProbabilities = Record<string, number>;

// ── Decay math ──────────────────────────────────────────────────────────────
const ALPHA = 0.7;
const TAU1 = 5;
const TAU2 = 20;

function decayFactor(h: number): number {
  return ALPHA * Math.exp(-h / TAU1) + (1 - ALPHA) * Math.exp(-h / TAU2);
}

function buildNormalizedDecay(horizon: number): number[] {
  const raw: number[] = [];
  for (let h = 1; h <= horizon; h++) raw.push(decayFactor(h));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(v => v / sum);
}

// ── Per-scenario trend ──────────────────────────────────────────────────────
function scenarioTrend(
  key: string,
  prob: number,
  normalizedDecay: number[],
): ScenarioTrend {
  const meta = SCENARIO_META[key];
  const trend: DayPoint[] = [];
  let cum = 0;
  let peakDay = 1;
  let peakProb = 0;

  for (let i = 0; i < normalizedDecay.length; i++) {
    const day = i + 1;
    const individual = prob * normalizedDecay[i];
    cum += individual;
    trend.push({ day, individualProb: individual, cumulativeProb: cum });
    if (individual > peakProb) { peakProb = individual; peakDay = day; }
  }

  const dir: TrendDirection = peakDay <= 2 ? 'falling' : peakDay >= normalizedDecay.length - 1 ? 'rising' : 'stable';

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
  const nd = buildNormalizedDecay(horizon);
  const scenarios = SCENARIO_KEYS.map(k => {
    const prob = scenarioProbabilities[k] ?? 0;
    return scenarioTrend(k, prob, nd);
  });
  return { horizon, scenarios, groups: groupTrends(scenarios) };
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
  else if (bCum > buCum) lines.push('💡 پیشنهاد: کاهش exposición یا پوشش ریسک (hedging) تا عبور از فاز نزولی اولیه');
  else lines.push('💡 پیشنهاد: انتظار برای سیگنال تأیید جهت قبل از ورود به بازار');

  return lines.join('\n');
}
