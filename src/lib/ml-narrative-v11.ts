// V11 Narrative Engine — احتمالات تجمعی و اختصاصی سناریوها
// Takes raw scenario probabilities (SC1–SC9, sum = 100) and computes
// cumulative & exclusive probability metrics for Persian prompt injection.

export interface V11ScenarioInput {
  SC1: number; // raw probability (e.g., 12)
  SC2: number;
  SC3: number;
  SC4: number;
  SC5: number;
  SC6: number;
  SC7: number;
  SC8: number;
  SC9: number;
}

export interface V11ScenarioResult {
  key: string; // 'SC1', 'SC2', etc.
  name: string; // Persian name
  nameEn: string; // English name
  rawProbability: number; // احتمال اختصاصی سناریو (exclusive)
  cumulativeProbability: number; // احتمال تجمعی (cumulative) — this or worse
}

export interface V11Result {
  scenarios: V11ScenarioResult[];
  bullishCumulative: number; // P(SC6) + P(SC7) + P(SC8) + P(SC9)
  bearishCumulative: number; // P(SC1) + P(SC2) + P(SC3) + P(SC4)
  neutralCumulative: number; // P(SC5)
  riskProfile: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';
}

// Convention: SC1-SC4 = bearish, SC5 = neutral, SC6-SC9 = bullish (matches decision-graph.ts)
const SCENARIO_META: {
  key: string;
  name: string;
  nameEn: string;
  group: 'bullish' | 'neutral' | 'bearish';
}[] = [
  { key: 'SC1', name: 'شوک نزولی', nameEn: 'Bearish Shock', group: 'bearish' },
  { key: 'SC2', name: 'نزولی شتاب‌دار', nameEn: 'Accelerating Bearish', group: 'bearish' },
  { key: 'SC3', name: 'نزولی قوی', nameEn: 'Strong Bearish', group: 'bearish' },
  { key: 'SC4', name: 'نزولی خفیف', nameEn: 'Weak Bearish', group: 'bearish' },
  { key: 'SC5', name: 'رنج', nameEn: 'Range-bound', group: 'neutral' },
  { key: 'SC6', name: 'صعودی خفیف', nameEn: 'Weak Bullish', group: 'bullish' },
  { key: 'SC7', name: 'صعودی قوی', nameEn: 'Strong Bullish', group: 'bullish' },
  { key: 'SC8', name: 'صعودی شتاب‌دار', nameEn: 'Accelerating Bullish', group: 'bullish' },
  { key: 'SC9', name: 'شوک صعودی', nameEn: 'Bullish Shock', group: 'bullish' },
];

/**
 * Compute V11 probabilities from raw scenario inputs.
 *
 * Convention: SC1-SC4=bearish, SC5=neutral, SC6-SC9=bullish
 * Cumulative resets at SC5 and accumulates outward in each direction:
 *   Bearish (SC1→SC4): cum[i] = sum(raw[0..i])  — this or more bearish
 *   Range  (SC5):     cum[4] = raw[4]
 *   Bullish (SC6→SC9): cum[i] = sum(raw[i..8])  — this or more bullish
 */
export function computeV11Probabilities(input: V11ScenarioInput): V11Result {
  const raw = [input.SC1, input.SC2, input.SC3, input.SC4, input.SC5, input.SC6, input.SC7, input.SC8, input.SC9];

  // Cumulative: outward from SC5 in both directions
  const cumulative: number[] = [];
  // Bearish side (SC1-SC4, indices 0-3): sum from SC1 up to current
  let bearRun = 0;
  for (let i = 0; i < 4; i++) {
    bearRun += raw[i];
    cumulative.push(bearRun);
  }
  // Range (SC5, index 4): just itself
  cumulative.push(raw[4]);
  // Bullish side (SC6-SC9, indices 5-8): sum from SC9 down to current
  let bullRun = 0;
  const bullCum: number[] = [];
  for (let i = 8; i >= 5; i--) {
    bullRun += raw[i];
    bullCum.unshift(bullRun);
  }
  cumulative.push(...bullCum);

  // Build scenario results sorted SC1 → SC9
  const scenarios: V11ScenarioResult[] = SCENARIO_META.map((meta, i) => ({
    key: meta.key,
    name: meta.name,
    nameEn: meta.nameEn,
    rawProbability: raw[i],
    cumulativeProbability: cumulative[i],
  }));

  // Grouped cumulative metrics (SC1-SC4=bearish, SC5=neutral, SC6-SC9=bullish)
  const bearishCumulative = raw[0] + raw[1] + raw[2] + raw[3]; // SC1 + SC2 + SC3 + SC4
  const bullishCumulative = raw[5] + raw[6] + raw[7] + raw[8]; // SC6 + SC7 + SC8 + SC9
  const neutralCumulative = raw[4]; // SC5

  // Determine dominant risk profile
  const riskProfile = determineRiskProfile(
    bullishCumulative,
    bearishCumulative,
    neutralCumulative,
  );

  return {
    scenarios,
    bullishCumulative,
    bearishCumulative,
    neutralCumulative,
    riskProfile,
  };
}

function determineRiskProfile(
  bullish: number,
  bearish: number,
  neutral: number,
): V11Result['riskProfile'] {
  // Strong conviction thresholds
  if (bullish >= 50 && bullish > bearish * 2) return 'very_bullish';
  if (bearish >= 50 && bearish > bullish * 2) return 'very_bearish';

  // Moderate thresholds
  if (bullish > bearish && bullish > neutral) return 'bullish';
  if (bearish > bullish && bearish > neutral) return 'bearish';

  return 'neutral';
}

const RISK_PROFILE_LABELS: Record<V11Result['riskProfile'], string> = {
  very_bullish: 'صعودی قوی',
  bullish: 'صعودی',
  neutral: 'خنثی',
  bearish: 'نزولی',
  very_bearish: 'نزولی قوی',
};

/** Format a number as a Persian-localized integer string. */
function toFa(n: number): string {
  return Math.round(n).toLocaleString('fa-IR');
}

/**
 * Build a Persian text block for the LLM prompt that includes v11 probability data.
 */
export function buildV11PromptSection(v11: V11Result): string {
  const lines: string[] = ['**احتمالات v11:**'];

  for (let i = 0; i < v11.scenarios.length; i++) {
    const s = v11.scenarios[i];
    const num = toFa(i + 1);
    lines.push(
      `- سناریوی ${num} (${s.name}): احتمال اختصاصی ${toFa(s.rawProbability)}٪ | احتمال تجمعی ${toFa(s.cumulativeProbability)}٪`,
    );
  }

  lines.push(`- مجموع احتمال نزولی (SC1-SC4): ${toFa(v11.bearishCumulative)}٪`);
  lines.push(`- مجموع احتمال خنثی (SC5): ${toFa(v11.neutralCumulative)}٪`);
  lines.push(`- مجموع احتمال صعودی (SC6-SC9): ${toFa(v11.bullishCumulative)}٪`);
  lines.push(`- پروفایل ریسک: ${RISK_PROFILE_LABELS[v11.riskProfile]}`);

  return lines.join('\n');
}
