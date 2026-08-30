// ═══════════════════════════════════════════════════════════════════════════════════════════
// V11 — LOCKED — Do not modify. Active version is now V12.
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// V11 Scenario Engine — Fixed 9 Scenarios, ATR-Capped Targets, Cumulative Prob
// V11 = V10 base (LOCKED) + ready for future enhancements
// ═══════════════════════════════════════════════════════════════════════════════
// 9 FIXED scenario names (no signal-dependent naming):
//   Bearish (4): شوک نزولی, نزولی شتاب‌دار, نزولی قوی, نزولی با احتیاط
//   Neutral  (1): رنج کم‌نوسان
//   Bullish  (4): صعودی با احتیاط, صعودی قوی, صعودی شتاب‌دار, شوک صعودی
//
// Price ordering (ascending target):
//   شوک نزولی < نزولی شتاب‌دار < نزولی قوی < نزولی با احتیاط
//   < رنج کم‌نوسان < صعودی با احتیاط < صعودی قوی < صعودی شتاب‌دار < شوک صعودی
//
// Targets:
//   - Max 1 ATR range width
//   - All targets rounded
//   - Bullish > current price, Bearish < current price, Range includes current
//   - Derived from support/resistance levels
//
// Probabilities:
//   - Each scenario has individual + cumulative probability
//   - Cumulative: bullish accumulates upward, bearish accumulates downward
//   - Range cumulative = just itself
// ═══════════════════════════════════════════════════════════════════════════════

// ── Types ─────────────────────────────────────────────────────────────────────

export interface V11Scenario {
  key: string;
  name: string;
  nameEn: string;
  direction: 'bullish' | 'bearish' | 'range';
  probability: number;
  cumulativeProbability: number;
  targetMin: number;
  targetMax: number;
  description: string;
}

export interface V11ScenarioResult {
  scenarios: Record<string, V11Scenario>;
  orderedKeys: string[];
  dominantKey: string;           // highest individual probability
  highestCumulativeKey: string;   // highest cumulative probability
}

// V11 fixed scenario definitions (display order: lowest target → highest target)
const V11_SCENARIO_DEFS = [
  { key: 'S1', name: 'شوک نزولی',        nameEn: 'Bearish Shock',       direction: 'bearish' as const },
  { key: 'S2', name: 'نزولی شتاب‌دار',    nameEn: 'Accelerating Decline',  direction: 'bearish' as const },
  { key: 'S3', name: 'نزولی قوی',         nameEn: 'Strong Decline',       direction: 'bearish' as const },
  { key: 'S4', name: 'نزولی با احتیاط',  nameEn: 'Cautious Decline',     direction: 'bearish' as const },
  { key: 'S5', name: 'رنج کم‌نوسان',      nameEn: 'Low Volatility Range',  direction: 'range'   as const },
  { key: 'S6', name: 'صعودی با احتیاط',  nameEn: 'Cautious Bullish',     direction: 'bullish' as const },
  { key: 'S7', name: 'صعودی قوی',         nameEn: 'Strong Bullish',       direction: 'bullish' as const },
  { key: 'S8', name: 'صعودی شتاب‌دار',    nameEn: 'Accelerating Bullish',  direction: 'bullish' as const },
  { key: 'S9', name: 'شوک صعودی',        nameEn: 'Bullish Shock',        direction: 'bullish' as const },
];

/** Mapping from V9 R-keys to V11 S-keys for each signal context */
const R_TO_S_MAP: Record<string, Record<string, string>> = {
  bullish: {
    SC9: 'S1', // شوک نزولی
    SC5: 'S2', // نزولی شتاب‌دار
    SC4: 'S3', // نزولی قوی
    SC6: 'S4', // نزولی با احتیاط
    SC7: 'S5', // رنج کم‌نوسان
    SC3: 'S6', // صعودی با احتیاط
    SC1: 'S7', // صعودی قوی
    SC2: 'S8', // صعودی شتاب‌دار
    SC8: 'S9', // شوک صعودی
  },
  bearish: {
    SC8: 'S1', // شوک نزولی
    SC5: 'S2', // نزولی شتاب‌دار
    SC4: 'S3', // نزولی قوی
    SC6: 'S4', // نزولی با احتیاط
    SC7: 'S5', // رنج کم‌نوسان
    SC3: 'S6', // صعودی با احتیاط
    SC1: 'S7', // صعودی قوی
    SC2: 'S8', // صعودی شتاب‌دار
    SC9: 'S9', // شوک صعودی
  },
  neutral: {
    SC9: 'S1', // شوک نزولی
    SC5: 'S2', // نزولی شتاب‌دار
    SC4: 'S3', // نزولی قوی
    SC6: 'S4', // نزولی با احتیاط
    SC7: 'S5', // رنج کم‌نوسان
    SC3: 'S6', // صعودی با احتیاط
    SC1: 'S7', // صعودی قوی
    SC2: 'S8', // صعودی شتاب‌دار
    SC8: 'S9', // شوک صعودی
  },
};

// ── Helper: Get nice rounding step based on magnitude ─────────────────────
function niceStep(n: number): number {
  if (n <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const res = n / mag;
  if (res < 2) return mag * 0.1;       // e.g. 150 → step 10
  if (res < 5) return mag * 0.25;      // e.g. 300 → step 25 (100 → step 25, 400 → step 100)
  if (res < 10) return mag * 0.5;      // e.g. 700 → step 50
  return mag;                        // e.g. 1500 → step 100, 10000 → step 1000
}

/** Round to nearest nice number (default: level-based step) */
function roundToNice(n: number, step?: number): number {
  if (n <= 0) return 0;
  const s = step || niceStep(n);
  return Math.round(n / s) * s;
}

/** Round down to nearest nice number */
function roundToNiceFloor(n: number, step?: number): number {
  if (n <= 0) return 0;
  const s = step || niceStep(n);
  return Math.floor(n / s) * s;
}

/** Round up to nearest nice number */
function roundToNiceCeil(n: number, step?: number): number {
  if (n <= 0) return 0;
  const s = step || niceStep(n);
  return Math.ceil(n / s) * s;
}

/** Deduplicate levels within 0.5% proximity */
function dedupLevels(arr: number[]): number[] {
  const result: number[] = [];
  for (const v of arr) {
    if (v <= 0) continue;
    if (result.length === 0 || Math.abs(v - result[result.length - 1]) / v > 0.005) {
      result.push(v);
    }
  }
  return result;
}

// ── Main: Build V11 Scenarios ───────────────────────────────────────────────

export interface V11Input {
  currentPrice: number;
  atr: number;
  overallSignal: 'bullish' | 'bearish' | 'neutral';
  // V9 scenarios (SC1-SC9)
  v9Scenarios: Record<string, { probability: number; targetMin: number; targetMax: number }>;
  // S/R levels from visual explanation section
  supports: number[];
  resistances: number[];
  bollingerUpper: number;
  bollingerLower: number;
  bollingerMiddle: number;
  ma21: number;
  ma100: number;
}

export function buildV11Scenarios(input: V11Input): V11ScenarioResult {
  const { currentPrice, atr, overallSignal, v9Scenarios, supports, resistances,
          bollingerUpper, bollingerLower, bollingerMiddle, ma21, ma100 } = input;

  const price = currentPrice;
  const u = atr > 0 ? atr : price * 0.015;

  // ── Step 1: Collect and sort levels below/above price ──
  const allAbove = [
    ...resistances,
    bollingerUpper,
    ma21 > price ? ma21 : 0,
    ma100 > price ? ma100 : 0,
  ].filter(l => l > price).sort((a, b) => a - b);
  let aboveLevels = dedupLevels(allAbove);

  const allBelow = [
    ...supports,
    bollingerLower,
    ma21 < price ? ma21 : 0,
    ma100 < price ? ma100 : 0,
  ].filter(l => l < price && l > 0).sort((a, b) => b - a); // descending for easy access
  let belowLevels = dedupLevels(allBelow);

  // ── ATR-based rounding step ──
  const atrStep = niceStep(u * 0.2); // ~20% of ATR as step size → e.g. ATR=500 → step=50-100

  // ── Step 2: Ensure we have at least 4 levels above and 4 below ──
  // Fill with ATR-based levels if needed
  while (aboveLevels.length < 4) {
    const last = aboveLevels.length > 0 ? aboveLevels[aboveLevels.length - 1] : price;
    aboveLevels.push(roundToNice(last + u, atrStep));
  }
  while (belowLevels.length < 4) {
    const last = belowLevels.length > 0 ? belowLevels[belowLevels.length - 1] : price;
    belowLevels.push(roundToNice(last - u, atrStep));
  }

  /** Build a target range centered on a level, max 1 ATR wide, rounded */
  const buildTarget = (centerLevel: number, direction: 'up' | 'down' | 'range'): { min: number; max: number } => {
    const halfAtr = u / 2;
    let tMin: number;
    let tMax: number;

    if (direction === 'up') {
      // Bullish: target must be > current price
      tMin = roundToNiceFloor(Math.max(price * 1.001, centerLevel - halfAtr), atrStep);
      tMax = roundToNiceCeil(centerLevel + halfAtr, atrStep);
      // Ensure max 1 ATR range
      if (tMax - tMin > u) {
        tMax = roundToNiceCeil(tMin + u, atrStep);
      }
      // Ensure tMin > price
      if (tMin <= price) {
        tMin = roundToNiceCeil(price * 1.001, atrStep);
        tMax = roundToNiceCeil(tMin + u * 0.8, atrStep);
      }
    } else if (direction === 'down') {
      // Bearish: target must be < current price
      tMin = roundToNiceFloor(centerLevel - halfAtr, atrStep);
      tMax = roundToNiceCeil(Math.min(price * 0.999, centerLevel + halfAtr), atrStep);
      // Ensure max 1 ATR range
      if (tMax - tMin > u) {
        tMin = roundToNiceFloor(tMax - u, atrStep);
      }
      // Ensure tMax < price
      if (tMax >= price) {
        tMax = roundToNiceFloor(price * 0.999, atrStep);
        tMin = roundToNiceFloor(tMax - u * 0.8, atrStep);
      }
    } else {
      // Range: includes current price
      tMin = roundToNiceFloor(Math.min(price, centerLevel - halfAtr), atrStep);
      tMax = roundToNiceCeil(Math.max(price, centerLevel + halfAtr), atrStep);
      // Ensure max 1 ATR range
      if (tMax - tMin > u) {
        const center = (tMin + tMax) / 2;
        tMin = roundToNiceFloor(center - halfAtr, atrStep);
        tMax = roundToNiceCeil(center + halfAtr, atrStep);
      }
    }

    // Final safety: ensure tMin < tMax (non-zero range)
    if (tMin >= tMax) {
      tMin = tMax - atrStep;
    }
    return { min: tMin, max: tMax };
  };

  // Build targets for each V11 scenario
  // Bearish: S1 (shock=farthest) → S4 (cautious=closest)
  //   belowLevels is sorted descending (farthest first)
  //   S1 = belowLevels[0] (farthest), S2 = belowLevels[1], S3 = belowLevels[2], S4 = belowLevels[3]
  //   Wait, belowLevels is descending so index 0 is closest. Let me reverse.
  const belowAsc = [...belowLevels].sort((a, b) => a - b); // ascending: farthest first (lowest)
  // belowAsc[0] is the lowest (farthest from price) → S1 (شوک نزولی)
  // belowAsc[3] is the highest (closest to price) → S4 (نزولی با احتیاط)

  // Bullish: aboveLevels is sorted ascending (closest first)
  // aboveLevels[0] is closest → S6 (صعودی با احتیاط)
  // aboveLevels[3] is farthest → S9 (شوک صعودی)

  const bearTargets: { min: number; max: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const level = belowAsc[i] || roundToNice(price - u * (i + 1), atrStep);
    bearTargets.push(buildTarget(level, 'down'));
  }

  const bullTargets: { min: number; max: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const level = aboveLevels[i] || roundToNice(price + u * (i + 1), atrStep);
    bullTargets.push(buildTarget(level, 'up'));
  }

  // ── Step 3b: Ensure distinct non-overlapping targets ──
  // Bearish: S1 (lowest) → S4 (highest below price), each must be distinct
  for (let i = 1; i < 4; i++) {
    if (bearTargets[i].max >= bearTargets[i - 1].max) {
      const newMax = roundToNiceFloor(bearTargets[i - 1].min - 1, atrStep);
      bearTargets[i] = { min: roundToNiceFloor(newMax - u * 0.5, atrStep), max: newMax };
    }
  }
  // Bullish: S6 (lowest above price) → S9 (highest), each must be distinct
  for (let i = 1; i < 4; i++) {
    if (bullTargets[i].min <= bullTargets[i - 1].max) {
      const newMin = roundToNiceCeil(bullTargets[i - 1].max + 1, atrStep);
      bullTargets[i] = { min: newMin, max: roundToNiceCeil(newMin + u * 0.5, atrStep) };
    }
  }

  // Range target: centered on current price, using nearest S/R bounds
  const rangeS4 = belowLevels[0] || roundToNice(price - u, atrStep); // nearest support
  const rangeR1 = aboveLevels[0] || roundToNice(price + u, atrStep); // nearest resistance
  const rangeCenter = (rangeS4 + rangeR1) / 2;
  const rangeTarget = buildTarget(rangeCenter, 'range');

  // ── Step 4: Map V9 probabilities to V11 scenarios ──
  const sigMap = R_TO_S_MAP[overallSignal] || R_TO_S_MAP.neutral;
  const v11Probabilities: Record<string, number> = {};
  for (const [rKey, sKey] of Object.entries(sigMap)) {
    v11Probabilities[sKey] = (v11Probabilities[sKey] || 0) + (v9Scenarios[rKey]?.probability || 0);
  }

  // ── Step 5: Calculate cumulative probabilities ──
  // Bullish: S9 = self, S8 = self + S9, S7 = self + S8 + S9, S6 = self + S7 + S8 + S9
  // Bearish: S1 = self, S2 = self + S1, S3 = self + S2 + S1, S4 = self + S3 + S2 + S1
  // Range: S5 = just itself

  const cumProb: Record<string, number> = {};
  // Bearish cumulative (from S1 up to S4)
  let bearCum = 0;
  for (let i = 0; i < 4; i++) {
    bearCum += v11Probabilities[V11_SCENARIO_DEFS[i].key] || 0;
    cumProb[V11_SCENARIO_DEFS[i].key] = bearCum;
  }
  // Range: just itself
  cumProb['S5'] = v11Probabilities['S5'] || 0;
  // Bullish cumulative (from S9 down to S6)
  let bullCum = 0;
  for (let i = 8; i >= 5; i--) {
    bullCum += v11Probabilities[V11_SCENARIO_DEFS[i].key] || 0;
    cumProb[V11_SCENARIO_DEFS[i].key] = bullCum;
  }

  // ── Step 6: Build final scenario objects ──
  const scenarios: Record<string, V11Scenario> = {};
  let dominantKey = 'S5';
  let dominantProb = 0;

  for (let i = 0; i < 9; i++) {
    const def = V11_SCENARIO_DEFS[i];
    const prob = v11Probabilities[def.key] || 0;
    const cProb = cumProb[def.key] || 0;
    let target: { min: number; max: number };

    if (def.direction === 'bearish') {
      target = bearTargets[i]; // S1=0, S2=1, S3=2, S4=3
    } else if (def.direction === 'bullish') {
      target = bullTargets[i - 5]; // S6=0, S7=1, S8=2, S9=3
    } else {
      target = rangeTarget;
    }

    // Ensure bearish max < price, bullish min > price
    if (def.direction === 'bearish' && target.max >= price) {
      target.max = roundToNiceFloor(price * 0.999, atrStep);
      target.min = roundToNiceFloor(target.max - u, atrStep);
    }
    if (def.direction === 'bullish' && target.min <= price) {
      target.min = roundToNiceCeil(price * 1.001, atrStep);
      target.max = roundToNiceCeil(target.min + u, atrStep);
    }

    // Ensure range includes current price
    if (def.direction === 'range') {
      if (target.min > price) target.min = roundToNiceFloor(price, atrStep);
      if (target.max < price) target.max = roundToNiceCeil(price, atrStep);
    }

    // Final safety: ensure non-zero range
    if (target.min >= target.max) {
      target.min = target.max - atrStep;
    }

    scenarios[def.key] = {
      key: def.key,
      name: def.name,
      nameEn: def.nameEn,
      direction: def.direction,
      probability: Math.round(prob * 10) / 10,
      cumulativeProbability: Math.round(cProb * 10) / 10,
      targetMin: target.min,
      targetMax: target.max,
      description: `${def.name}: هدف ${target.min.toLocaleString('fa-IR')} تا ${target.max.toLocaleString('fa-IR')}.`,
    };

    if (prob > dominantProb) {
      dominantProb = prob;
      dominantKey = def.key;
    }
  }

  // ── Step 7: Determine highest cumulative probability scenario ──
  let highestCumulativeKey = 'S5';
  let highestCumProb = 0;
  for (const def of V11_SCENARIO_DEFS) {
    const cProb = cumProb[def.key] || 0;
    if (cProb > highestCumProb) {
      highestCumProb = cProb;
      highestCumulativeKey = def.key;
    }
  }

  return {
    scenarios,
    orderedKeys: V11_SCENARIO_DEFS.map(d => d.key),
    dominantKey,
    highestCumulativeKey,
  };
}

/** Get the V11 scenario definitions for external use */
export function getV11ScenarioDefs() {
  return V11_SCENARIO_DEFS;
}
