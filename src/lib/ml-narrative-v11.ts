// V11 Narrative Engine — احتمالات تجمعی و اختصاصی سناریوها
// Takes raw scenario probabilities (R1–R9, sum = 100) and computes
// cumulative & exclusive probability metrics for Persian prompt injection.

export interface V11ScenarioInput {
  R1: number; // raw probability (e.g., 12)
  R2: number;
  R3: number;
  R4: number;
  R5: number;
  R6: number;
  R7: number;
  R8: number;
  R9: number;
}

export interface V11ScenarioResult {
  key: string; // 'R1', 'R2', etc.
  name: string; // Persian name
  nameEn: string; // English name
  rawProbability: number; // احتمال اختصاصی سناریو (exclusive)
  cumulativeProbability: number; // احتمال تجمعی (cumulative) — this or worse
}

export interface V11Result {
  scenarios: V11ScenarioResult[];
  bullishCumulative: number; // P(R1) + P(R2) + P(R3)
  bearishCumulative: number; // P(R7) + P(R8) + P(R9)
  neutralCumulative: number; // P(R4) + P(R5) + P(R6)
  riskProfile: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';
}

const SCENARIO_META: {
  key: string;
  name: string;
  nameEn: string;
}[] = [
  { key: 'R1', name: 'صعود هیجانی', nameEn: 'Explosive Bullish' },
  { key: 'R2', name: 'صعود قوی', nameEn: 'Strong Bullish' },
  { key: 'R3', name: 'صعود تدریجی', nameEn: 'Gradual Bullish' },
  { key: 'R4', name: 'پولبک سالم', nameEn: 'Healthy Pullback' },
  { key: 'R5', name: 'رنج خنثی', nameEn: 'Range-bound Neutral' },
  { key: 'R6', name: 'اصلاح خفیف', nameEn: 'Mild Correction' },
  { key: 'R7', name: 'اصلاح متوسط', nameEn: 'Moderate Correction' },
  { key: 'R8', name: 'اصلاح عمیق', nameEn: 'Deep Correction' },
  { key: 'R9', name: 'تضعیف ساختار', nameEn: 'Structure Breakdown' },
];

/**
 * Compute V11 probabilities from raw scenario inputs.
 *
 * Cumulative probability for Ri = P(Ri) + P(Ri+1) + … + P(R9)
 * (probability of "Ri OR any worse scenario").
 */
export function computeV11Probabilities(input: V11ScenarioInput): V11Result {
  const raw = [input.R1, input.R2, input.R3, input.R4, input.R5, input.R6, input.R7, input.R8, input.R9];

  // Cumulative: for index i, sum from i to end
  const cumulative = raw.map((_, i) =>
    raw.slice(i).reduce((sum, v) => sum + v, 0),
  );

  // Build scenario results sorted R1 → R9
  const scenarios: V11ScenarioResult[] = SCENARIO_META.map((meta, i) => ({
    key: meta.key,
    name: meta.name,
    nameEn: meta.nameEn,
    rawProbability: raw[i],
    cumulativeProbability: cumulative[i],
  }));

  // Grouped cumulative metrics
  const bullishCumulative = raw[0] + raw[1] + raw[2]; // R1 + R2 + R3
  const bearishCumulative = raw[6] + raw[7] + raw[8]; // R7 + R8 + R9
  const neutralCumulative = raw[3] + raw[4] + raw[5]; // R4 + R5 + R6

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

  lines.push(`- مجموع احتمال صعودی (R1-R3): ${toFa(v11.bullishCumulative)}٪`);
  lines.push(`- مجموع احتمال خنثی (R4-R6): ${toFa(v11.neutralCumulative)}٪`);
  lines.push(`- مجموع احتمال نزولی (R7-R9): ${toFa(v11.bearishCumulative)}٪`);
  lines.push(`- پروفایل ریسک: ${RISK_PROFILE_LABELS[v11.riskProfile]}`);

  return lines.join('\n');
}
