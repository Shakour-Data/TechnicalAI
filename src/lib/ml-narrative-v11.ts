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
 * Enforce integer probabilities that sum to EXACTLY 100, each in [minVal, maxVal].
 * Uses Largest Remainder Method (LRM) + iterative bound enforcement.
 * This is the frontend safety net — the backend (decision-graph.ts) also has
 * its own enforceSumTo100. Having it here guarantees correct display even
 * if the backend data is stale or from an older version.
 */
function enforceSumTo100(
  rawFloats: number[],
  minVal: number,
  maxVal: number
): number[] {
  const n = rawFloats.length;
  const floatSum = rawFloats.reduce((a, b) => a + b, 0);
  const normalized =
    floatSum > 0
      ? rawFloats.map((v) => (v / floatSum) * 100)
      : rawFloats.map(() => 100 / n);

  const result = normalized.map((v) => Math.max(Math.floor(v), 0));
  let deficit = 100 - result.reduce((a, b) => a + b, 0);

  const byFrac = Array.from({ length: n }, (_, i) => ({
    idx: i,
    frac: normalized[i] - Math.floor(normalized[i]),
  })).sort((a, b) => b.frac - a.frac);

  for (let d = 0; d < deficit && d < n; d++) {
    result[byFrac[d].idx]++;
  }

  let changed = true;
  let safety = 0;
  while (changed && safety < 100) {
    changed = false;
    safety++;
    for (let i = 0; i < n; i++) {
      while (result[i] < minVal) {
        let donor = -1;
        for (let j = 0; j < n; j++) {
          if (j !== i && result[j] > minVal && (donor === -1 || result[j] > result[donor])) donor = j;
        }
        if (donor === -1) break;
        result[donor]--;
        result[i]++;
        changed = true;
      }
    }
    for (let i = 0; i < n; i++) {
      while (result[i] > maxVal) {
        let receiver = -1;
        for (let j = 0; j < n; j++) {
          if (j !== i && result[j] < maxVal && (receiver === -1 || result[j] < result[receiver])) receiver = j;
        }
        if (receiver === -1) break;
        result[i]--;
        result[receiver]++;
        changed = true;
      }
    }
  }

  const finalSum = result.reduce((a, b) => a + b, 0);
  if (finalSum !== 100 && n > 0) {
    const diff = 100 - finalSum;
    let bestIdx = 0;
    let bestRoom = -1;
    for (let i = 0; i < n; i++) {
      const room = diff > 0 ? maxVal - result[i] : result[i] - minVal;
      if (room > bestRoom) { bestRoom = room; bestIdx = i; }
    }
    result[bestIdx] += diff;
  }

  return result;
}

/**
 * Compute V11 probabilities from raw scenario inputs.
 *
 * IRON LAW: The returned rawProbability values ALWAYS sum to exactly 100.
 * Each value is an integer in [2, 35].
 *
 * Convention: SC1-SC4=bearish, SC5=neutral, SC6-SC9=bullish
 * Cumulative resets at SC5 and accumulates outward in each direction:
 *   Bearish (SC1→SC4): cum[i] = sum(raw[0..i])  — this or more bearish
 *   Range  (SC5):     cum[4] = raw[4]
 *   Bullish (SC6→SC9): cum[i] = sum(raw[i..8])  — this or more bullish
 */
export function computeV11Probabilities(input: V11ScenarioInput): V11Result {
  const rawInput = [input.SC1, input.SC2, input.SC3, input.SC4, input.SC5, input.SC6, input.SC7, input.SC8, input.SC9];

  // IRON LAW: Enforce sum=100 before any further computation
  const raw = enforceSumTo100(rawInput, 2, 35);

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
      `- ${s.key} (${s.name}): احتمال اختصاصی ${toFa(s.rawProbability)}٪ | احتمال تجمعی ${toFa(s.cumulativeProbability)}٪`,
    );
  }

  lines.push(`- مجموع احتمال نزولی (SC1-SC4): ${toFa(v11.bearishCumulative)}٪`);
  lines.push(`- مجموع احتمال خنثی (SC5): ${toFa(v11.neutralCumulative)}٪`);
  lines.push(`- مجموع احتمال صعودی (SC6-SC9): ${toFa(v11.bullishCumulative)}٪`);
  lines.push(`- پروفایل ریسک: ${RISK_PROFILE_LABELS[v11.riskProfile]}`);

  return lines.join('\n');
}
