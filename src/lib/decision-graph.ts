// =============================================================================
// Decision Graph Probability Engine — Technical Analysis System
// =============================================================================
// This module replaces the old 12-node graph and heuristic probability system.
// The decision graph IS the primary probability engine — all 9 scenario
// probabilities (SC1–SC9) are derived from aggregating path probabilities through
// this directed acyclic graph (DAG).
// =============================================================================

import {
  calculateProbabilityTrend as calcTrendFromProbs,
  type ProbabilityTrendResult as ProbTrendResult,
} from './probability-trend';

// === Helper Functions =========================================================

function safeNum(v: number, fallback: number = 0): number {
  return (typeof v === 'number' && isFinite(v)) ? v : fallback;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, safeNum(v, (min + max) / 2)));
}

function normalize(arr: number[]): number[] {
  const safe = arr.map(v => safeNum(v, 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  if (sum <= 0) return arr.map(() => 1 / arr.length);
  return safe.map((v) => v / sum);
}

function sigmoid(x: number): number {
  const sx = safeNum(x, 0);
  if (Math.abs(sx) > 500) return sx > 0 ? 1 : 0; // prevent Infinity
  return 1 / (1 + Math.exp(-sx));
}

/**
 * IRON LAW: Round proportional floats to integers that sum to EXACTLY 100,
 * with each value constrained to [minVal, maxVal].
 *
 * Algorithm: Largest Remainder Method (LRM) + iterative bound enforcement.
 * This function GUARANTEES sum(result) === 100 and minVal <= result[i] <= maxVal
 * for all i, as long as n*minVal <= 100 <= n*maxVal.
 *
 * ⚠️  NEVER bypass this function when producing integer scenario percentages.
 */
function enforceSumTo100(
  rawFloats: number[],
  minVal: number,
  maxVal: number
): number[] {
  const n = rawFloats.length;

  // Normalize floats to sum exactly to 100 first
  const floatSum = rawFloats.reduce((a, b) => a + b, 0);
  const normalized =
    floatSum > 0
      ? rawFloats.map((v) => (v / floatSum) * 100)
      : rawFloats.map(() => 100 / n);

  // Step 1: LRM — floor all, distribute deficit by largest fractional part
  const result = normalized.map((v) => Math.max(Math.floor(v), 0));
  let deficit = 100 - result.reduce((a, b) => a + b, 0);

  const byFrac = Array.from({ length: n }, (_, i) => ({
    idx: i,
    frac: normalized[i] - Math.floor(normalized[i]),
  })).sort((a, b) => b.frac - a.frac);

  // Give +1 to top `deficit` entries (LRM)
  for (let d = 0; d < deficit && d < n; d++) {
    result[byFrac[d].idx]++;
  }
  // Now result sums to exactly 100

  // Step 2: Iteratively enforce [minVal, maxVal] bounds while preserving sum = 100
  // Each iteration: move 1 from a violator to a suitable partner.
  // Converges because each move strictly reduces the total violation magnitude.
  let changed = true;
  let safety = 0;
  while (changed && safety < 100) {
    changed = false;
    safety++;

    // Enforce minimum: raise any value below minVal by taking from the largest above minVal
    for (let i = 0; i < n; i++) {
      while (result[i] < minVal) {
        let donor = -1;
        for (let j = 0; j < n; j++) {
          if (j !== i && result[j] > minVal && (donor === -1 || result[j] > result[donor])) {
            donor = j;
          }
        }
        if (donor === -1) break; // no donor available — shouldn't happen if n*minVal <= 100
        result[donor]--;
        result[i]++;
        changed = true;
      }
    }

    // Enforce maximum: lower any value above maxVal by giving to the smallest below maxVal
    for (let i = 0; i < n; i++) {
      while (result[i] > maxVal) {
        let receiver = -1;
        for (let j = 0; j < n; j++) {
          if (j !== i && result[j] < maxVal && (receiver === -1 || result[j] < result[receiver])) {
            receiver = j;
          }
        }
        if (receiver === -1) break; // no receiver — shouldn't happen if 100 <= n*maxVal
        result[i]--;
        result[receiver]++;
        changed = true;
      }
    }
  }

  // Step 3: Final assertion — sum MUST be 100 (safety net, should never trigger)
  const finalSum = result.reduce((a, b) => a + b, 0);
  if (finalSum !== 100 && n > 0) {
    // Adjust the entry farthest from its bound
    const diff = 100 - finalSum;
    let bestIdx = 0;
    let bestRoom = -1;
    for (let i = 0; i < n; i++) {
      const room = diff > 0 ? maxVal - result[i] : result[i] - minVal;
      if (room > bestRoom) {
        bestRoom = room;
        bestIdx = i;
      }
    }
    result[bestIdx] += diff;
  }

  return result;
}

// === Exported Interfaces ======================================================

export interface GraphNode {
  id: string;
  title: string;
  titleEn: string;
  type: 'decision' | 'event' | 'terminal';
  desc: string;
  color: string;
  branch?: 'trend' | 'breakout' | 'reversal';
  isTerminal?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  type:
    | 'up'
    | 'down'
    | 'pullback'
    | 'risk'
    | 'branch-trend'
    | 'branch-breakout'
    | 'branch-reversal';
}

export interface GraphInput {
  price: number;
  bullConsensus: number;
  rsi: number;
  mfi: number;
  cci: number;
  stochK: number;
  stochD: number;
  adx: number;
  diPlus: number;
  diMinus: number;
  macdHist: number;
  atr: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  sar: number;
  ichimokuTenkan: number;
  ichimokuKijun: number;
  ichimokuSenkouA: number;
  ichimokuSenkouB: number;
  maAlignment: number;
  momentum: number;
  awesomeOsc: number;
  fisherTransform: number;
  confidenceIndex: number;
  strengthIndex: number;
  hasVolume: boolean;
  distToR1: number;
  distToS1: number;
  srAvgStrength: number;
  mlMomentum: number;
  mlVolatility: number;
  mlTrend: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodePositions: Record<string, { right: number; top: number }>;
  edgeProbabilities: Record<number, number>;
  nodeValues: Record<string, string>;
  branchProbabilities: { trend: number; breakout: number; reversal: number };
  scenarioProbabilities: Record<string, number>;
  pathContributions: Record<
    string,
    { trend: number; breakout: number; reversal: number }
  >;
  /** 30-day probability trend computed from scenarioProbabilities */
  probabilityTrend?: ProbTrendResult;
}

// === Internal Types ===========================================================

interface ProbContext {
  input: GraphInput;
  adxNorm: number;
  srProximity: number;
  oscillatorExtreme: number;
  divergenceProxy: number;
  overboughtRisk: number;
  oversoldBounce: number;
}

// === Color Constants ==========================================================

const TERMINAL_COLORS: Record<string, string> = {
  SC1: '#b91c1c',
  SC2: '#dc2626',
  SC3: '#ea580c',
  SC4: '#c2410c',
  SC5: '#b45309',
  SC6: '#047857',
  SC7: '#059669',
  SC8: '#0e7490',
  SC9: '#0891b2',
};

const BRANCH_COLORS: Record<string, string> = {
  trend: '#3ad5db',
  breakout: '#ffb11b',
  reversal: '#a04ac5',
};

// === Static Node Definitions ==================================================

function createNodes(): GraphNode[] {
  return [
    // ── Layer 0: ROOT ──────────────────────────────────────────────────────
    {
      id: 'ROOT',
      title: 'ریشه تصمیم',
      titleEn: 'Decision Root',
      type: 'decision',
      desc: 'نقطه شروع تحلیل — توزیع احتمال بین سه استراتژی اصلی',
      color: '#374151',
    },

    // ── Layer 1: Main Branches ─────────────────────────────────────────────
    {
      id: 'N_TREND',
      title: 'پیروی از روند',
      titleEn: 'Trend Following',
      type: 'decision',
      desc: 'استراتژی پیروی از روند بر اساس ADX و قدرت روند',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },
    {
      id: 'N_BREAK',
      title: 'شکست',
      titleEn: 'Breakout',
      type: 'decision',
      desc: 'استراتژی شکست بر اساس فاصله از حمایت/مقاومت و حجم',
      color: BRANCH_COLORS.breakout,
      branch: 'breakout',
    },
    {
      id: 'N_REVERSAL',
      title: 'بازگشت',
      titleEn: 'Reversal',
      type: 'decision',
      desc: 'استراتژی بازگشت بر اساس واگرایی‌ها و اسیلاتورهای افراطی',
      color: BRANCH_COLORS.reversal,
      branch: 'reversal',
    },

    // ── Layer 2: Trend Sub-branches ────────────────────────────────────────
    {
      id: 'N_T_BULL',
      title: 'روند صعودی',
      titleEn: 'Bullish Trend',
      type: 'decision',
      desc: 'شناسایی روند صعودی غالب',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },
    {
      id: 'N_T_BEAR',
      title: 'روند نزولی',
      titleEn: 'Bearish Trend',
      type: 'decision',
      desc: 'شناسایی روند نزولی غالب',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },
    {
      id: 'N_T_FLAT',
      title: 'بدون روند واضح',
      titleEn: 'No Clear Trend',
      type: 'decision',
      desc: 'بازار بدون روند مشخص',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },

    // ── Layer 2: Breakout Sub-branches ─────────────────────────────────────
    {
      id: 'N_B_UP',
      title: 'شکست صعودی بالقوه',
      titleEn: 'Potential Bullish Breakout',
      type: 'decision',
      desc: 'احتمال شکست صعودی از مقاومت',
      color: BRANCH_COLORS.breakout,
      branch: 'breakout',
    },
    {
      id: 'N_B_DOWN',
      title: 'شکست نزولی بالقوه',
      titleEn: 'Potential Bearish Breakout',
      type: 'decision',
      desc: 'احتمال شکست نزولی از حمایت',
      color: BRANCH_COLORS.breakout,
      branch: 'breakout',
    },
    {
      id: 'N_B_NONE',
      title: 'بدون شکست بالقوه',
      titleEn: 'No Breakout',
      type: 'decision',
      desc: 'بدون سیگنال شکست قابل توجه',
      color: BRANCH_COLORS.breakout,
      branch: 'breakout',
    },

    // ── Layer 2: Reversal Sub-branches ─────────────────────────────────────
    {
      id: 'N_R_BULL',
      title: 'سیگنال بازگشت صعودی',
      titleEn: 'Bullish Reversal Signal',
      type: 'decision',
      desc: 'شناسایی سیگنال بازگشت به صعود',
      color: BRANCH_COLORS.reversal,
      branch: 'reversal',
    },
    {
      id: 'N_R_BEAR',
      title: 'سیگنال بازگشت نزولی',
      titleEn: 'Bearish Reversal Signal',
      type: 'decision',
      desc: 'شناسایی سیگنال بازگشت به نزول',
      color: BRANCH_COLORS.reversal,
      branch: 'reversal',
    },
    {
      id: 'N_R_NONE',
      title: 'بدون سیگنال بازگشت',
      titleEn: 'No Reversal Signal',
      type: 'decision',
      desc: 'بدون سیگنال بازگشت قابل توجه',
      color: BRANCH_COLORS.reversal,
      branch: 'reversal',
    },

    // ── Layer 3: Trend-Bull Assessment ─────────────────────────────────────
    {
      id: 'N_T_B_MOM_HIGH',
      title: 'مومنتوم صعودی بالا',
      titleEn: 'High Bullish Momentum',
      type: 'event',
      desc: 'مومنتوم صعودی قوی — شتاب بالای قیمت',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },
    {
      id: 'N_T_B_MOM_MOD',
      title: 'مومنتوم صعودی متوسط',
      titleEn: 'Moderate Bullish Momentum',
      type: 'event',
      desc: 'مومنتوم صعودی متوسط — روند ملایم',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },
    {
      id: 'N_T_B_OVERBOUGHT',
      title: 'اشباع خرید',
      titleEn: 'Overbought',
      type: 'event',
      desc: 'اشباع خرید — احتمال اصلاح یا بازگشت',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },

    // ── Layer 3: Trend-Bear Assessment ─────────────────────────────────────
    {
      id: 'N_T_BE_MOM_LOW',
      title: 'مومنتوم نزولی بالا',
      titleEn: 'High Bearish Momentum',
      type: 'event',
      desc: 'مومنتوم نزولی قوی — شتاب نزولی بالای قیمت',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },
    {
      id: 'N_T_BE_MOM_MOD',
      title: 'مومنتوم نزولی متوسط',
      titleEn: 'Moderate Bearish Momentum',
      type: 'event',
      desc: 'مومنتوم نزولی متوسط — روند نزولی ملایم',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },
    {
      id: 'N_T_BE_OVERSOLD',
      title: 'اشباع فروش',
      titleEn: 'Oversold',
      type: 'event',
      desc: 'اشباع فروش — احتمال بازگشت صعودی',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },

    // ── Layer 3: Trend-Flat Assessment ─────────────────────────────────────
    {
      id: 'N_T_F_VOL_LOW',
      title: 'نوسان کم',
      titleEn: 'Low Volatility',
      type: 'event',
      desc: 'نوسان بسیار کم — بازار آرام',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },
    {
      id: 'N_T_F_VOL_HIGH',
      title: 'نوسان بالا',
      titleEn: 'High Volatility',
      type: 'event',
      desc: 'نوسان بالا بدون روند — شوک احتمالی',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },
    {
      id: 'N_T_F_VOL_MOD',
      title: 'نوسان متوسط',
      titleEn: 'Moderate Volatility',
      type: 'event',
      desc: 'نوسان متوسط — حرکت محتاطانه',
      color: BRANCH_COLORS.trend,
      branch: 'trend',
    },

    // ── Layer 3: Breakout-Up Assessment ────────────────────────────────────
    {
      id: 'N_B_U_VOL_C',
      title: 'تأیید حجم صعودی',
      titleEn: 'Bullish Volume Confirmed',
      type: 'event',
      desc: 'شکست صعودی با تأیید حجم معاملات',
      color: BRANCH_COLORS.breakout,
      branch: 'breakout',
    },
    {
      id: 'N_B_U_VOL_W',
      title: 'حجم ضعیف صعودی',
      titleEn: 'Weak Bullish Volume',
      type: 'event',
      desc: 'شکست صعودی بدون تأیید حجم — شکست کاذب محتمل',
      color: BRANCH_COLORS.breakout,
      branch: 'breakout',
    },

    // ── Layer 3: Breakout-Down Assessment ──────────────────────────────────
    {
      id: 'N_B_D_VOL_C',
      title: 'تأیید حجم نزولی',
      titleEn: 'Bearish Volume Confirmed',
      type: 'event',
      desc: 'شکست نزولی با تأیید حجم معاملات',
      color: BRANCH_COLORS.breakout,
      branch: 'breakout',
    },
    {
      id: 'N_B_D_VOL_W',
      title: 'حجم ضعیف نزولی',
      titleEn: 'Weak Bearish Volume',
      type: 'event',
      desc: 'شکست نزولی بدون تأیید حجم — شکست کاذب محتمل',
      color: BRANCH_COLORS.breakout,
      branch: 'breakout',
    },

    // ── Layer 3: Reversal-Bull Assessment ──────────────────────────────────
    {
      id: 'N_R_B_DIV',
      title: 'واگرایی صعودی',
      titleEn: 'Bullish Divergence',
      type: 'event',
      desc: 'واگرایی مثبت قیمت و اسیلاتور',
      color: BRANCH_COLORS.reversal,
      branch: 'reversal',
    },
    {
      id: 'N_R_B_CANDLE',
      title: 'الگوی کندلی صعودی',
      titleEn: 'Bullish Candle Pattern',
      type: 'event',
      desc: 'الگوی کندلی بازگشتی صعودی',
      color: BRANCH_COLORS.reversal,
      branch: 'reversal',
    },
    {
      id: 'N_R_B_SR',
      title: 'بازگشت از حمایت',
      titleEn: 'Support Bounce',
      type: 'event',
      desc: 'بازگشت قیمت از سطح حمایت',
      color: BRANCH_COLORS.reversal,
      branch: 'reversal',
    },

    // ── Layer 3: Reversal-Bear Assessment ──────────────────────────────────
    {
      id: 'N_R_BE_DIV',
      title: 'واگرایی نزولی',
      titleEn: 'Bearish Divergence',
      type: 'event',
      desc: 'واگرایی منفی قیمت و اسیلاتور',
      color: BRANCH_COLORS.reversal,
      branch: 'reversal',
    },
    {
      id: 'N_R_BE_CANDLE',
      title: 'الگوی کندلی نزولی',
      titleEn: 'Bearish Candle Pattern',
      type: 'event',
      desc: 'الگوی کندلی بازگشتی نزولی',
      color: BRANCH_COLORS.reversal,
      branch: 'reversal',
    },
    {
      id: 'N_R_BE_SR',
      title: 'بازگشت از مقاومت',
      titleEn: 'Resistance Rejection',
      type: 'event',
      desc: 'بازگشت قیمت از سطح مقاومت',
      color: BRANCH_COLORS.reversal,
      branch: 'reversal',
    },

    // ── Layer 4: Terminal Nodes (SC1–SC9) ────────────────────────────────────
    // VDES spec: SC1=شوک نزولی(weakest/bearish) → SC9=شوک صعودی(strongest/bullish)
    {
      id: 'SC1',
      title: 'شوک نزولی',
      titleEn: 'Bearish Shock',
      type: 'terminal',
      desc: 'شوک منفی ناگهانی در بازار',
      color: TERMINAL_COLORS.SC1,
      isTerminal: true,
    },
    {
      id: 'SC2',
      title: 'نزولی شتابدار',
      titleEn: 'Accelerating Bearish',
      type: 'terminal',
      desc: 'شتاب نزولی شدید با ترس در بازار',
      color: TERMINAL_COLORS.SC2,
      isTerminal: true,
    },
    {
      id: 'SC3',
      title: 'نزولی قوی',
      titleEn: 'Strong Bearish',
      type: 'terminal',
      desc: 'روند نزولی قوی با فشار فروش',
      color: TERMINAL_COLORS.SC3,
      isTerminal: true,
    },
    {
      id: 'SC4',
      title: 'نزولی خفیف',
      titleEn: 'Weak Bearish',
      type: 'terminal',
      desc: 'روند نزولی ملایم با احتمال بازگشت',
      color: TERMINAL_COLORS.SC4,
      isTerminal: true,
    },
    {
      id: 'SC5',
      title: 'رنج',
      titleEn: 'Range-bound',
      type: 'terminal',
      desc: 'بازار بدون جهت مشخص — نوسان در محدوده',
      color: TERMINAL_COLORS.SC5,
      isTerminal: true,
    },
    {
      id: 'SC6',
      title: 'صعودی خفیف',
      titleEn: 'Weak Bullish',
      type: 'terminal',
      desc: 'روند صعودی ملایم با ریسک اصلاح',
      color: TERMINAL_COLORS.SC6,
      isTerminal: true,
    },
    {
      id: 'SC7',
      title: 'صعودی قوی',
      titleEn: 'Strong Bullish',
      type: 'terminal',
      desc: 'روند صعودی قوی با پشتوانه',
      color: TERMINAL_COLORS.SC7,
      isTerminal: true,
    },
    {
      id: 'SC8',
      title: 'صعودی شتابدار',
      titleEn: 'Accelerating Bullish',
      type: 'terminal',
      desc: 'شتاب صعودی شدید با مومنتوم بالا',
      color: TERMINAL_COLORS.SC8,
      isTerminal: true,
    },
    {
      id: 'SC9',
      title: 'شوک صعودی',
      titleEn: 'Bullish Shock',
      type: 'terminal',
      desc: 'شوک مثبت ناگهانی در بازار',
      color: TERMINAL_COLORS.SC9,
      isTerminal: true,
    },
  ];
}

// === Static Edge Definitions ==================================================

function createEdges(): GraphEdge[] {
  return [
    // ── ROOT → Main Branches ───────────────────────────────────────────────
    { from: 'ROOT', to: 'N_TREND', label: 'روند', type: 'branch-trend' },
    { from: 'ROOT', to: 'N_BREAK', label: 'شکست', type: 'branch-breakout' },
    {
      from: 'ROOT',
      to: 'N_REVERSAL',
      label: 'بازگشت',
      type: 'branch-reversal',
    },

    // ── N_TREND → Sub-branches ─────────────────────────────────────────────
    { from: 'N_TREND', to: 'N_T_BULL', label: 'صعودی', type: 'up' },
    { from: 'N_TREND', to: 'N_T_BEAR', label: 'نزولی', type: 'down' },
    { from: 'N_TREND', to: 'N_T_FLAT', label: 'خنثی', type: 'pullback' },

    // ── N_T_BULL → Assessment ──────────────────────────────────────────────
    {
      from: 'N_T_BULL',
      to: 'N_T_B_MOM_HIGH',
      label: 'مومنتوم بالا',
      type: 'up',
    },
    {
      from: 'N_T_BULL',
      to: 'N_T_B_MOM_MOD',
      label: 'مومنتوم متوسط',
      type: 'up',
    },
    {
      from: 'N_T_BULL',
      to: 'N_T_B_OVERBOUGHT',
      label: 'اشباع خرید',
      type: 'risk',
    },

    // ── N_T_B_MOM_HIGH → Terminals ────────────────────────────────────────
    {
      from: 'N_T_B_MOM_HIGH',
      to: 'SC8',
      label: 'صعودی شتابدار',
      type: 'up',
    },
    { from: 'N_T_B_MOM_HIGH', to: 'SC9', label: 'شوک صعودی', type: 'up' },
    { from: 'N_T_B_MOM_HIGH', to: 'SC7', label: 'صعودی قوی', type: 'up' },

    // ── N_T_B_MOM_MOD → Terminals ─────────────────────────────────────────
    { from: 'N_T_B_MOM_MOD', to: 'SC7', label: 'صعودی قوی', type: 'up' },
    {
      from: 'N_T_B_MOM_MOD',
      to: 'SC6',
      label: 'صعودی خفیف',
      type: 'up',
    },
    { from: 'N_T_B_MOM_MOD', to: 'SC5', label: 'رنج', type: 'pullback' },

    // ── N_T_B_OVERBOUGHT → Terminals ──────────────────────────────────────
    {
      from: 'N_T_B_OVERBOUGHT',
      to: 'SC4',
      label: 'نزولی خفیف',
      type: 'down',
    },
    { from: 'N_T_B_OVERBOUGHT', to: 'SC1', label: 'شوک نزولی', type: 'down' },
    { from: 'N_T_B_OVERBOUGHT', to: 'SC9', label: 'ادامه صعودی شدید', type: 'up' },

    // ── N_T_BEAR → Assessment ──────────────────────────────────────────────
    {
      from: 'N_T_BEAR',
      to: 'N_T_BE_MOM_LOW',
      label: 'مومنتوم بالا',
      type: 'down',
    },
    {
      from: 'N_T_BEAR',
      to: 'N_T_BE_MOM_MOD',
      label: 'مومنتوم متوسط',
      type: 'down',
    },
    {
      from: 'N_T_BEAR',
      to: 'N_T_BE_OVERSOLD',
      label: 'اشباع فروش',
      type: 'risk',
    },

    // ── N_T_BE_MOM_LOW → Terminals ────────────────────────────────────────
    {
      from: 'N_T_BE_MOM_LOW',
      to: 'SC2',
      label: 'نزولی شتابدار',
      type: 'down',
    },
    { from: 'N_T_BE_MOM_LOW', to: 'SC1', label: 'شوک نزولی', type: 'down' },
    { from: 'N_T_BE_MOM_LOW', to: 'SC3', label: 'نزولی قوی', type: 'down' },

    // ── N_T_BE_MOM_MOD → Terminals ────────────────────────────────────────
    {
      from: 'N_T_BE_MOM_MOD',
      to: 'SC3',
      label: 'نزولی قوی',
      type: 'down',
    },
    {
      from: 'N_T_BE_MOM_MOD',
      to: 'SC4',
      label: 'نزولی خفیف',
      type: 'down',
    },
    { from: 'N_T_BE_MOM_MOD', to: 'SC5', label: 'رنج', type: 'pullback' },

    // ── N_T_BE_OVERSOLD → Terminals ───────────────────────────────────────
    {
      from: 'N_T_BE_OVERSOLD',
      to: 'SC6',
      label: 'صعودی خفیف',
      type: 'up',
    },
    { from: 'N_T_BE_OVERSOLD', to: 'SC9', label: 'شوک صعودی', type: 'up' },
    { from: 'N_T_BE_OVERSOLD', to: 'SC4', label: 'ادامه نزولی ملایم', type: 'down' },

    // ── N_T_FLAT → Assessment ─────────────────────────────────────────────
    {
      from: 'N_T_FLAT',
      to: 'N_T_F_VOL_LOW',
      label: 'نوسان کم',
      type: 'pullback',
    },
    {
      from: 'N_T_FLAT',
      to: 'N_T_F_VOL_HIGH',
      label: 'نوسان بالا',
      type: 'risk',
    },
    {
      from: 'N_T_FLAT',
      to: 'N_T_F_VOL_MOD',
      label: 'نوسان متوسط',
      type: 'pullback',
    },

    // ── N_T_F_VOL_LOW → Terminals ─────────────────────────────────────────
    {
      from: 'N_T_F_VOL_LOW',
      to: 'SC5',
      label: 'رنج کم‌نوسان',
      type: 'pullback',
    },
    {
      from: 'N_T_F_VOL_LOW',
      to: 'SC6',
      label: 'صعودی خفیف',
      type: 'up',
    },
    {
      from: 'N_T_F_VOL_LOW',
      to: 'SC4',
      label: 'نزولی خفیف',
      type: 'down',
    },

    // ── N_T_F_VOL_HIGH → Terminals ────────────────────────────────────────
    { from: 'N_T_F_VOL_HIGH', to: 'SC9', label: 'شوک صعودی', type: 'up' },
    { from: 'N_T_F_VOL_HIGH', to: 'SC1', label: 'شوک نزولی', type: 'down' },
    { from: 'N_T_F_VOL_HIGH', to: 'SC5', label: 'رنج', type: 'pullback' },

    // ── N_T_F_VOL_MOD → Terminals ─────────────────────────────────────────
    {
      from: 'N_T_F_VOL_MOD',
      to: 'SC6',
      label: 'صعودی خفیف',
      type: 'up',
    },
    {
      from: 'N_T_F_VOL_MOD',
      to: 'SC4',
      label: 'نزولی خفیف',
      type: 'down',
    },
    { from: 'N_T_F_VOL_MOD', to: 'SC5', label: 'رنج', type: 'pullback' },

    // ── N_BREAK → Sub-branches ─────────────────────────────────────────────
    { from: 'N_BREAK', to: 'N_B_UP', label: 'صعودی', type: 'up' },
    { from: 'N_BREAK', to: 'N_B_DOWN', label: 'نزولی', type: 'down' },
    { from: 'N_BREAK', to: 'N_B_NONE', label: 'بدون شکست', type: 'pullback' },

    // ── N_B_UP → Assessment ────────────────────────────────────────────────
    {
      from: 'N_B_UP',
      to: 'N_B_U_VOL_C',
      label: 'تأیید حجم',
      type: 'up',
    },
    { from: 'N_B_UP', to: 'N_B_U_VOL_W', label: 'حجم ضعیف', type: 'risk' },

    // ── N_B_U_VOL_C → Terminals ───────────────────────────────────────────
    { from: 'N_B_U_VOL_C', to: 'SC7', label: 'صعودی قوی', type: 'up' },
    {
      from: 'N_B_U_VOL_C',
      to: 'SC8',
      label: 'صعودی شتابدار',
      type: 'up',
    },
    { from: 'N_B_U_VOL_C', to: 'SC9', label: 'شوک صعودی', type: 'up' },

    // ── N_B_U_VOL_W → Terminals ───────────────────────────────────────────
    {
      from: 'N_B_U_VOL_W',
      to: 'SC6',
      label: 'صعودی خفیف',
      type: 'up',
    },
    {
      from: 'N_B_U_VOL_W',
      to: 'SC4',
      label: 'شکست کاذب',
      type: 'down',
    },
    { from: 'N_B_U_VOL_W', to: 'SC5', label: 'رنج', type: 'pullback' },

    // ── N_B_DOWN → Assessment ──────────────────────────────────────────────
    {
      from: 'N_B_DOWN',
      to: 'N_B_D_VOL_C',
      label: 'تأیید حجم',
      type: 'down',
    },
    {
      from: 'N_B_DOWN',
      to: 'N_B_D_VOL_W',
      label: 'حجم ضعیف',
      type: 'risk',
    },

    // ── N_B_D_VOL_C → Terminals ───────────────────────────────────────────
    { from: 'N_B_D_VOL_C', to: 'SC3', label: 'نزولی قوی', type: 'down' },
    {
      from: 'N_B_D_VOL_C',
      to: 'SC2',
      label: 'نزولی شتابدار',
      type: 'down',
    },
    { from: 'N_B_D_VOL_C', to: 'SC1', label: 'شوک نزولی', type: 'down' },

    // ── N_B_D_VOL_W → Terminals ───────────────────────────────────────────
    {
      from: 'N_B_D_VOL_W',
      to: 'SC4',
      label: 'نزولی خفیف',
      type: 'down',
    },
    {
      from: 'N_B_D_VOL_W',
      to: 'SC6',
      label: 'شکست کاذب معکوس',
      type: 'up',
    },
    { from: 'N_B_D_VOL_W', to: 'SC5', label: 'رنج', type: 'pullback' },

    // ── N_B_NONE → Terminals ───────────────────────────────────────────────
    { from: 'N_B_NONE', to: 'SC4', label: 'نزولی خفیف', type: 'down' },
    { from: 'N_B_NONE', to: 'SC5', label: 'رنج', type: 'pullback' },
    { from: 'N_B_NONE', to: 'SC6', label: 'صعودی خفیف', type: 'up' },

    // ── N_REVERSAL → Sub-branches ──────────────────────────────────────────
    {
      from: 'N_REVERSAL',
      to: 'N_R_BULL',
      label: 'بازگشت صعودی',
      type: 'up',
    },
    {
      from: 'N_REVERSAL',
      to: 'N_R_BEAR',
      label: 'بازگشت نزولی',
      type: 'down',
    },
    {
      from: 'N_REVERSAL',
      to: 'N_R_NONE',
      label: 'بدون بازگشت',
      type: 'pullback',
    },

    // ── N_R_BULL → Assessment ─────────────────────────────────────────────
    {
      from: 'N_R_BULL',
      to: 'N_R_B_DIV',
      label: 'واگرایی',
      type: 'up',
    },
    {
      from: 'N_R_BULL',
      to: 'N_R_B_CANDLE',
      label: 'الگوی کندلی',
      type: 'up',
    },
    { from: 'N_R_BULL', to: 'N_R_B_SR', label: 'بازگشت از حمایت', type: 'up' },

    // ── N_R_B_DIV → Terminals ─────────────────────────────────────────────
    {
      from: 'N_R_B_DIV',
      to: 'SC6',
      label: 'صعودی خفیف',
      type: 'up',
    },
    {
      from: 'N_R_B_DIV',
      to: 'SC8',
      label: 'صعودی شتابدار',
      type: 'up',
    },
    { from: 'N_R_B_DIV', to: 'SC5', label: 'رنج', type: 'pullback' },

    // ── N_R_B_CANDLE → Terminals ──────────────────────────────────────────
    { from: 'N_R_B_CANDLE', to: 'SC7', label: 'صعودی قوی', type: 'up' },
    {
      from: 'N_R_B_CANDLE',
      to: 'SC6',
      label: 'صعودی خفیف',
      type: 'up',
    },
    { from: 'N_R_B_CANDLE', to: 'SC5', label: 'رنج', type: 'pullback' },

    // ── N_R_B_SR → Terminals ──────────────────────────────────────────────
    {
      from: 'N_R_B_SR',
      to: 'SC6',
      label: 'صعودی خفیف',
      type: 'up',
    },
    { from: 'N_R_B_SR', to: 'SC5', label: 'رنج', type: 'pullback' },
    {
      from: 'N_R_B_SR',
      to: 'SC4',
      label: 'عدم موفقیت',
      type: 'down',
    },

    // ── N_R_BEAR → Assessment ─────────────────────────────────────────────
    {
      from: 'N_R_BEAR',
      to: 'N_R_BE_DIV',
      label: 'واگرایی',
      type: 'down',
    },
    {
      from: 'N_R_BEAR',
      to: 'N_R_BE_CANDLE',
      label: 'الگوی کندلی',
      type: 'down',
    },
    {
      from: 'N_R_BEAR',
      to: 'N_R_BE_SR',
      label: 'بازگشت از مقاومت',
      type: 'down',
    },

    // ── N_R_BE_DIV → Terminals ────────────────────────────────────────────
    {
      from: 'N_R_BE_DIV',
      to: 'SC4',
      label: 'نزولی خفیف',
      type: 'down',
    },
    {
      from: 'N_R_BE_DIV',
      to: 'SC2',
      label: 'نزولی شتابدار',
      type: 'down',
    },
    { from: 'N_R_BE_DIV', to: 'SC5', label: 'رنج', type: 'pullback' },

    // ── N_R_BE_CANDLE → Terminals ────────────────────────────────────────
    { from: 'N_R_BE_CANDLE', to: 'SC3', label: 'نزولی قوی', type: 'down' },
    {
      from: 'N_R_BE_CANDLE',
      to: 'SC4',
      label: 'نزولی خفیف',
      type: 'down',
    },
    { from: 'N_R_BE_CANDLE', to: 'SC5', label: 'رنج', type: 'pullback' },

    // ── N_R_BE_SR → Terminals ─────────────────────────────────────────────
    {
      from: 'N_R_BE_SR',
      to: 'SC4',
      label: 'نزولی خفیف',
      type: 'down',
    },
    { from: 'N_R_BE_SR', to: 'SC5', label: 'رنج', type: 'pullback' },
    {
      from: 'N_R_BE_SR',
      to: 'SC6',
      label: 'عدم موفقیت',
      type: 'up',
    },

    // ── N_R_NONE → Terminals ───────────────────────────────────────────────
    { from: 'N_R_NONE', to: 'SC4', label: 'نزولی خفیف', type: 'down' },
    { from: 'N_R_NONE', to: 'SC5', label: 'رنج', type: 'pullback' },
    { from: 'N_R_NONE', to: 'SC6', label: 'صعودی خفیف', type: 'up' },
  ];
}

// === Static Node Positions (RTL Layout) =======================================

function createPositions(): Record<string, { right: number; top: number }> {
  const p: Record<string, { right: number; top: number }> = {};
  // DESIGN_H is now 1200. Event nodes: 56px, Branch nodes: 74px, Terminal: 84px
  // No overlaps — each group separated by 14px, siblings by 4px

  // Layer 0 (rightmost): ROOT
  p['ROOT'] = { right: 30, top: 590 };

  // Layer 1: Main branches (centered on their children)
  p['N_TREND'] = { right: 200, top: 268 };
  p['N_BREAK'] = { right: 200, top: 690 };
  p['N_REVERSAL'] = { right: 200, top: 1010 };

  // Layer 2: Sub-branches (centered on their Layer-3 children groups)
  p['N_T_BULL'] = { right: 390, top: 50 };
  p['N_T_BEAR'] = { right: 390, top: 240 };
  p['N_T_FLAT'] = { right: 390, top: 430 };
  p['N_B_UP'] = { right: 390, top: 590 };
  p['N_B_DOWN'] = { right: 390, top: 720 };
  p['N_B_NONE'] = { right: 390, top: 532 };
  p['N_R_BULL'] = { right: 390, top: 880 };
  p['N_R_BEAR'] = { right: 390, top: 1070 };
  p['N_R_NONE'] = { right: 390, top: 790 };

  // Layer 3: Assessment nodes (19 nodes, 7 groups, no overlaps)
  // Event node height: 56px, within-group gap: 4px, between-group gap: 14px
  // Trend-Bull (3 nodes)
  p['N_T_B_MOM_HIGH'] = { right: 570, top: 2 };
  p['N_T_B_MOM_MOD'] = { right: 570, top: 62 };
  p['N_T_B_OVERBOUGHT'] = { right: 570, top: 122 };
  // Trend-Bear (3 nodes)
  p['N_T_BE_MOM_LOW'] = { right: 570, top: 192 };
  p['N_T_BE_MOM_MOD'] = { right: 570, top: 252 };
  p['N_T_BE_OVERSOLD'] = { right: 570, top: 312 };
  // Trend-Flat (3 nodes)
  p['N_T_F_VOL_LOW'] = { right: 570, top: 382 };
  p['N_T_F_VOL_HIGH'] = { right: 570, top: 442 };
  p['N_T_F_VOL_MOD'] = { right: 570, top: 502 };
  // Breakout-Up (2 nodes)
  p['N_B_U_VOL_C'] = { right: 570, top: 572 };
  p['N_B_U_VOL_W'] = { right: 570, top: 632 };
  // Breakout-Down (2 nodes)
  p['N_B_D_VOL_C'] = { right: 570, top: 702 };
  p['N_B_D_VOL_W'] = { right: 570, top: 762 };
  // Reversal-Bull (3 nodes)
  p['N_R_B_DIV'] = { right: 570, top: 832 };
  p['N_R_B_CANDLE'] = { right: 570, top: 892 };
  p['N_R_B_SR'] = { right: 570, top: 952 };
  // Reversal-Bear (3 nodes)
  p['N_R_BE_DIV'] = { right: 570, top: 1022 };
  p['N_R_BE_CANDLE'] = { right: 570, top: 1082 };
  p['N_R_BE_SR'] = { right: 570, top: 1142 };

  // Layer 4 (leftmost): Terminal nodes SC1–SC9 (height 84px, gap 35px)
  for (let i = 0; i < 9; i++) {
    p[`SC${i + 1}`] = { right: 1050, top: i * 119 + 30 };
  }

  return p;
}

// === Probability Context Builder ==============================================

function buildContext(input: GraphInput): ProbContext {
  const adxNorm = clamp(input.adx / 60, 0, 1);
  const srProximity = clamp(
    1 - Math.min(input.distToR1, input.distToS1) * 10,
    0,
    1
  );
  const oscillatorExtreme = clamp(
    (Math.abs(input.rsi - 50) / 50 + Math.abs(input.cci) / 200) / 2,
    0,
    1
  );
  const divergenceProxy = oscillatorExtreme * (1 - adxNorm);

  // Pre-compute for reuse across N_T_BULL and N_REVERSAL
  const overboughtRisk =
    clamp((input.rsi - 60) / 30, 0, 1) * 0.3 +
    clamp((input.mfi - 70) / 30, 0, 1) * 0.2 +
    clamp((input.stochK - 75) / 25, 0, 1) * 0.2;

  // Pre-compute for reuse across N_T_BEAR and N_REVERSAL
  const oversoldBounce =
    clamp((30 - input.rsi) / 30, 0, 1) * 0.3 +
    clamp((20 - input.mfi) / 20, 0, 1) * 0.2 +
    clamp((20 - input.stochK) / 20, 0, 1) * 0.2;

  return {
    input,
    adxNorm,
    srProximity,
    oscillatorExtreme,
    divergenceProxy,
    overboughtRisk,
    oversoldBounce,
  };
}

// === Node Probability Computation =============================================
// For each non-terminal node, returns an array of probabilities for its
// outgoing edges. The order MUST match the order of edges in createEdges().
// =============================================================================

function computeNodeProbabilities(
  nodeId: string,
  ctx: ProbContext,
  _numChildren: number
): number[] {
  const { input, adxNorm, srProximity, overboughtRisk, oversoldBounce } = ctx;
  const atrSafe = input.atr > 0 ? input.atr : 0.0001;

  switch (nodeId) {
    // ── ROOT → [N_TREND, N_BREAK, N_REVERSAL] ─────────────────────────────
    case 'ROOT': {
      const trendW = adxNorm * 0.5 + input.mlTrend * 0.18 + 0.1;
      const breakW = srProximity * 0.3 + (1 - adxNorm) * 0.08 + 0.08;
      const revW = ctx.divergenceProxy * 0.35 + (1 - adxNorm) * 0.12 + 0.06;
      return normalize([trendW, breakW, revW]);
    }

    // ── N_TREND → [N_T_BULL, N_T_BEAR, N_T_FLAT] ──────────────────────────
    case 'N_TREND': {
      const bull = input.bullConsensus * (adxNorm * 0.4 + 0.6);
      const bear = (1 - input.bullConsensus) * (adxNorm * 0.4 + 0.6);
      const flatUncertainty = (1 - Math.abs(input.bullConsensus - 0.5) * 2);
      const flat = flatUncertainty * clamp(1 - adxNorm * 1.5, 0, 1) * 0.45;
      return normalize([bull, bear, flat]);
    }

    // ── N_T_BULL → [N_T_B_MOM_HIGH, N_T_B_MOM_MOD, N_T_B_OVERBOUGHT] ─────
    case 'N_T_BULL': {
      const momHigh =
        clamp(
          (input.momentum > 0 ? input.momentum / 50 : 0) +
            (input.macdHist > 0
              ? (input.macdHist / (atrSafe * 0.5)) * 0.3
              : 0),
          0,
          1
        ) * input.mlMomentum;
      const momMod = (1 - momHigh) * 0.6 * input.mlMomentum;
      return normalize([momHigh, momMod, overboughtRisk]);
    }

    // ── N_T_B_MOM_HIGH → [SC8, SC9, SC7] ────────────────────────────────────
    // Strong bullish momentum — all three outcomes are bullish (no range)
    case 'N_T_B_MOM_HIGH': {
      const pSC8 = 0.45 * input.mlTrend + input.confidenceIndex * 0.2;
      const pSC9 = 0.15 + input.strengthIndex * 0.2;
      const pSC7 = 0.35 * input.confidenceIndex + 0.15;
      return normalize([pSC8, pSC9, pSC7]);
    }

    // ── N_T_B_MOM_MOD → [SC7, SC6, SC5] ─────────────────────────────────────
    // Moderate bullish — small explicit SC5 based on uncertainty
    case 'N_T_B_MOM_MOD': {
      const pSC7 = 0.55 * input.confidenceIndex + 0.2;
      const pSC6 = 0.55 * (1 - input.confidenceIndex) + 0.15;
      const pSC5 = clamp((1 - adxNorm) * 0.15, 0.02, 0.15);
      return normalize([pSC7, pSC6, pSC5]);
    }

    // ── N_T_B_OVERBOUGHT → [SC4, SC1, SC9] ──────────────────────────────────
    // Overbought in uptrend — correction or last-gasp surge (no range)
    case 'N_T_B_OVERBOUGHT': {
      const pSC4 = 0.5 + (1 - input.mlMomentum) * 0.2;
      const pSC1 = 0.15 + input.strengthIndex * 0.15;
      const pSC9 = 0.1 + input.mlMomentum * 0.2;
      return normalize([pSC4, pSC1, pSC9]);
    }

    // ── N_T_BEAR → [N_T_BE_MOM_LOW, N_T_BE_MOM_MOD, N_T_BE_OVERSOLD] ────
    case 'N_T_BEAR': {
      const momLow =
        clamp(
          (input.momentum < 0 ? Math.abs(input.momentum) / 50 : 0) +
            (input.macdHist < 0
              ? (Math.abs(input.macdHist) / (atrSafe * 0.5)) * 0.3
              : 0),
          0,
          1
        ) * input.mlMomentum;
      const momMod = (1 - momLow) * 0.6 * input.mlMomentum;
      return normalize([momLow, momMod, oversoldBounce]);
    }

    // ── N_T_BE_MOM_LOW → [SC2, SC1, SC3] ────────────────────────────────────
    // Strong bearish momentum — all three outcomes are bearish (no range)
    case 'N_T_BE_MOM_LOW': {
      const pSC2 = 0.45 * input.mlTrend + input.confidenceIndex * 0.2;
      const pSC1 = 0.15 + input.strengthIndex * 0.2;
      const pSC3 = 0.35 * input.confidenceIndex + 0.15;
      return normalize([pSC2, pSC1, pSC3]);
    }

    // ── N_T_BE_MOM_MOD → [SC3, SC4, SC5] ────────────────────────────────────
    // Moderate bearish — small explicit SC5 based on uncertainty
    case 'N_T_BE_MOM_MOD': {
      const pSC3 = 0.55 * input.confidenceIndex + 0.2;
      const pSC4 = 0.55 * (1 - input.confidenceIndex) + 0.15;
      const pSC5 = clamp((1 - adxNorm) * 0.15, 0.02, 0.15);
      return normalize([pSC3, pSC4, pSC5]);
    }

    // ── N_T_BE_OVERSOLD → [SC6, SC9, SC4] ───────────────────────────────────
    // Oversold in downtrend — bounce or mild continuation (no range)
    case 'N_T_BE_OVERSOLD': {
      const pSC6 = 0.55 + (1 - input.mlMomentum) * 0.2;
      const pSC9 = 0.15 + input.strengthIndex * 0.15;
      const pSC4 = 0.1 + input.mlMomentum * 0.2;
      return normalize([pSC6, pSC9, pSC4]);
    }

    // ── N_T_FLAT → [N_T_F_VOL_LOW, N_T_F_VOL_HIGH, N_T_F_VOL_MOD] ────────
    case 'N_T_FLAT': {
      const volLow =
        clamp(1 - (input.atr / input.price) * 20, 0, 1) *
        (1 - input.mlVolatility) *
        0.7;
      const volHigh =
        clamp((input.atr / input.price) * 20, 0, 1) * input.mlVolatility * 0.7;
      const volMod = (1 - volLow - volHigh) * 0.5 + 0.1;
      return normalize([volLow, volHigh, volMod]);
    }

    // ── N_T_F_VOL_LOW → [SC5, SC6, SC4] ─────────────────────────────────────
    case 'N_T_F_VOL_LOW': {
      const pSC5 = 0.55 + (1 - Math.abs(input.bullConsensus - 0.5) * 2) * 0.15;
      const pSC6 = 0.2 * input.bullConsensus + 0.08;
      const pSC4 = 0.2 * (1 - input.bullConsensus) + 0.08;
      return normalize([pSC5, pSC6, pSC4]);
    }

    // ── N_T_F_VOL_HIGH → [SC9, SC1, SC5] ────────────────────────────────────
    // High volatility shock — directional shock much more likely than range
    case 'N_T_F_VOL_HIGH': {
      const pSC9 = 0.4 * input.bullConsensus + 0.15;
      const pSC1 = 0.4 * (1 - input.bullConsensus) + 0.15;
      const pSC5 = clamp((1 - input.mlVolatility) * 0.12, 0.02, 0.12);
      return normalize([pSC9, pSC1, pSC5]);
    }

    // ── N_T_F_VOL_MOD → [SC6, SC4, SC5] ─────────────────────────────────────
    // Moderate volatility — directional more likely than range
    case 'N_T_F_VOL_MOD': {
      const pSC6 = 0.38 * input.bullConsensus + 0.15;
      const pSC4 = 0.38 * (1 - input.bullConsensus) + 0.15;
      const pSC5 = clamp((1 - adxNorm) * 0.15, 0.03, 0.15);
      return normalize([pSC6, pSC4, pSC5]);
    }

    // ── N_BREAK → [N_B_UP, N_B_DOWN, N_B_NONE] ────────────────────────────
    case 'N_BREAK': {
      const upProb = input.bullConsensus * srProximity * 0.75 + 0.08;
      const downProb = (1 - input.bullConsensus) * srProximity * 0.75 + 0.08;
      const noneProb = (1 - srProximity) * 0.35 + 0.05;
      return normalize([upProb, downProb, noneProb]);
    }

    // ── N_B_UP → [N_B_U_VOL_C, N_B_U_VOL_W] ─────────────────────────────
    case 'N_B_UP': {
      let volConfirm: number;
      let volWeak: number;
      if (input.hasVolume) {
        volConfirm = clamp(input.mfi / 60, 0, 1) * 0.6 + 0.2;
        volWeak = 1 - volConfirm;
      } else {
        volConfirm = 0.4;
        volWeak = 0.6;
      }
      return normalize([volConfirm, volWeak]);
    }

    // ── N_B_U_VOL_C → [SC7, SC8, SC9] ──────────────────────────────────────
    // Confirmed bullish breakout — all bullish, no range
    case 'N_B_U_VOL_C': {
      const pSC7 = 0.45 + input.confidenceIndex * 0.15;
      const pSC8 = 0.2 + input.strengthIndex * 0.15;
      const pSC9 = 0.15 + input.strengthIndex * 0.1;
      return normalize([pSC7, pSC8, pSC9]);
    }

    // ── N_B_U_VOL_W → [SC6, SC4, SC5] ──────────────────────────────────────
    // Weak volume breakout — fake breakout risk, capped SC5
    case 'N_B_U_VOL_W': {
      const pSC6 = 0.4 + input.bullConsensus * 0.15;
      const pSC4 = 0.3 + (1 - input.bullConsensus) * 0.15;
      const pSC5 = clamp((1 - input.confidenceIndex) * 0.12, 0.02, 0.12);
      return normalize([pSC6, pSC4, pSC5]);
    }

    // ── N_B_DOWN → [N_B_D_VOL_C, N_B_D_VOL_W] ────────────────────────────
    case 'N_B_DOWN': {
      let volConfirm: number;
      if (input.hasVolume) {
        volConfirm = clamp((100 - input.mfi) / 60, 0, 1) * 0.6 + 0.2;
      } else {
        volConfirm = 0.4;
      }
      const volWeak = 1 - volConfirm;
      return normalize([volConfirm, volWeak]);
    }

    // ── N_B_D_VOL_C → [SC3, SC2, SC1] ──────────────────────────────────────
    // Confirmed bearish breakout — all bearish, no range
    case 'N_B_D_VOL_C': {
      const pSC3 = 0.45 + input.confidenceIndex * 0.15;
      const pSC2 = 0.2 + input.strengthIndex * 0.15;
      const pSC1 = 0.15 + input.strengthIndex * 0.1;
      return normalize([pSC3, pSC2, pSC1]);
    }

    // ── N_B_D_VOL_W → [SC4, SC6, SC5] ──────────────────────────────────────
    // Weak volume bearish breakout — fake breakout risk, capped SC5
    case 'N_B_D_VOL_W': {
      const pSC4 = 0.4 + (1 - input.bullConsensus) * 0.15;
      const pSC6 = 0.3 + input.bullConsensus * 0.15;
      const pSC5 = clamp((1 - input.confidenceIndex) * 0.12, 0.02, 0.12);
      return normalize([pSC4, pSC6, pSC5]);
    }

    // ── N_B_NONE → [SC4, SC5, SC6] ──────────────────────────────────────────
    case 'N_B_NONE': {
      const pSC5 = 0.45 + (1 - Math.abs(input.bullConsensus - 0.5) * 2) * 0.15;
      const pSC6 = 0.2 * input.bullConsensus + 0.08;
      const pSC4 = 0.2 * (1 - input.bullConsensus) + 0.08;
      return normalize([pSC4, pSC5, pSC6]);
    }

    // ── N_REVERSAL → [N_R_BULL, N_R_BEAR, N_R_NONE] ──────────────────────
    case 'N_REVERSAL': {
      const bullRev = overboughtRisk;
      const bearRev = oversoldBounce;
      const maxRevSignal = Math.max(overboughtRisk, oversoldBounce);
      const noneRev = 1 - maxRevSignal * 0.85;
      return normalize([bullRev, bearRev, noneRev]);
    }

    // ── N_R_BULL → [N_R_B_DIV, N_R_B_CANDLE, N_R_B_SR] ──────────────────
    case 'N_R_BULL': {
      const divProb = clamp(Math.abs(input.cci) / 150, 0, 1) * 0.5;
      const candleProb =
        clamp(Math.abs(input.fisherTransform) / 2, 0, 1) * 0.3;
      const srProb = clamp(input.srAvgStrength, 0, 1) * 0.3;
      return normalize([divProb, candleProb, srProb]);
    }

    // ── N_R_B_DIV → [SC6, SC8, SC5] ────────────────────────────────────────
    // Bullish divergence — explicit small SC5
    case 'N_R_B_DIV': {
      const pSC6 = 0.5 + (1 - input.mlMomentum) * 0.2;
      const pSC8 = 0.2 + input.mlMomentum * 0.15;
      const pSC5 = clamp((1 - adxNorm) * 0.1, 0.02, 0.1);
      return normalize([pSC6, pSC8, pSC5]);
    }

    // ── N_R_B_CANDLE → [SC7, SC6, SC5] ─────────────────────────────────────
    // Bullish candle pattern — explicit small SC5
    case 'N_R_B_CANDLE': {
      const pSC7 = 0.5 * input.confidenceIndex + 0.2;
      const pSC6 = 0.5 * (1 - input.confidenceIndex) + 0.15;
      const pSC5 = clamp((1 - input.confidenceIndex) * 0.1, 0.02, 0.1);
      return normalize([pSC7, pSC6, pSC5]);
    }

    // ── N_R_B_SR → [SC6, SC5, SC4] ─────────────────────────────────────────
    // Support bounce — explicit small SC5
    // Edge order: SC6, SC5, SC4 — probabilities computed then reordered
    case 'N_R_B_SR': {
      const pSC6 = 0.5 + input.srAvgStrength * 0.2;
      const pSC4 = 0.15 + (1 - input.srAvgStrength) * 0.1;
      const pSC5 = clamp((1 - input.srAvgStrength) * 0.1, 0.02, 0.1);
      // Return in edge order: [SC6, SC5, SC4]
      return normalize([pSC6, pSC5, pSC4]);
    }

    // ── N_R_BEAR → [N_R_BE_DIV, N_R_BE_CANDLE, N_R_BE_SR] ───────────────
    // Mirror of N_R_BULL
    case 'N_R_BEAR': {
      const divProb = clamp(Math.abs(input.cci) / 150, 0, 1) * 0.5;
      const candleProb =
        clamp(Math.abs(input.fisherTransform) / 2, 0, 1) * 0.3;
      const srProb = clamp(input.srAvgStrength, 0, 1) * 0.3;
      return normalize([divProb, candleProb, srProb]);
    }

    // ── N_R_BE_DIV → [SC4, SC2, SC5] ───────────────────────────────────────
    // Bearish divergence — explicit small SC5
    case 'N_R_BE_DIV': {
      const pSC4 = 0.5 + (1 - input.mlMomentum) * 0.2;
      const pSC2 = 0.2 + input.mlMomentum * 0.15;
      const pSC5 = clamp((1 - adxNorm) * 0.1, 0.02, 0.1);
      return normalize([pSC4, pSC2, pSC5]);
    }

    // ── N_R_BE_CANDLE → [SC3, SC4, SC5] ────────────────────────────────────
    // Bearish candle pattern — explicit small SC5
    case 'N_R_BE_CANDLE': {
      const pSC3 = 0.5 * input.confidenceIndex + 0.2;
      const pSC4 = 0.5 * (1 - input.confidenceIndex) + 0.15;
      const pSC5 = clamp((1 - input.confidenceIndex) * 0.1, 0.02, 0.1);
      return normalize([pSC3, pSC4, pSC5]);
    }

    // ── N_R_BE_SR → [SC4, SC5, SC6] ─────────────────────────────────────────
    // Resistance rejection — explicit small SC5
    // Edge order: SC4, SC5, SC6 — probabilities computed then reordered
    case 'N_R_BE_SR': {
      const pSC4 = 0.5 + input.srAvgStrength * 0.2;
      const pSC6 = 0.15 + (1 - input.srAvgStrength) * 0.1;
      const pSC5 = clamp((1 - input.srAvgStrength) * 0.1, 0.02, 0.1);
      // Return in edge order: [SC4, SC5, SC6]
      return normalize([pSC4, pSC5, pSC6]);
    }

    // ── N_R_NONE → [SC4, SC5, SC6] ──────────────────────────────────────────
    case 'N_R_NONE': {
      const pSC5 = 0.4 + (1 - Math.abs(input.bullConsensus - 0.5) * 2) * 0.15;
      const pSC6 = 0.2 * input.bullConsensus + 0.1;
      const pSC4 = 0.2 * (1 - input.bullConsensus) + 0.1;
      return normalize([pSC4, pSC5, pSC6]);
    }

    // ── Terminal nodes (SC1–SC9) have no outgoing edges ─────────────────────
    default:
      return [];
  }
}

// === Graph Traversal ==========================================================
// Recursive DFS from ROOT, accumulating path probabilities at terminal nodes.
// =============================================================================

function traverseGraph(
  nodeId: string,
  pathProb: number,
  currentBranch: 'trend' | 'breakout' | 'reversal' | null,
  ctx: ProbContext,
  adj: Map<string, number[]>,
  edges: GraphEdge[],
  edgeProbabilities: Record<number, number>,
  nodeAccum: Record<string, number>,
  scenarios: Record<string, number>,
  contributions: Record<string, { trend: number; breakout: number; reversal: number }>
): void {
  // Accumulate path probability at this node
  nodeAccum[nodeId] = (nodeAccum[nodeId] || 0) + pathProb;

  const outEdgeIndices = adj.get(nodeId);
  if (!outEdgeIndices || outEdgeIndices.length === 0) return;

  // Compute outgoing edge probabilities for this node
  const probs = computeNodeProbabilities(
    nodeId,
    ctx,
    outEdgeIndices.length
  );

  for (let i = 0; i < outEdgeIndices.length; i++) {
    const edgeIdx = outEdgeIndices[i];
    const edge = edges[edgeIdx];
    const prob = probs[i] || 0;

    // Store edge probability
    edgeProbabilities[edgeIdx] = prob;

    // Determine branch for child nodes
    let childBranch = currentBranch;
    if (nodeId === 'ROOT') {
      if (edge.to === 'N_TREND') childBranch = 'trend';
      else if (edge.to === 'N_BREAK') childBranch = 'breakout';
      else if (edge.to === 'N_REVERSAL') childBranch = 'reversal';
    }

    const childPathProb = pathProb * prob;

    // Check if target is a terminal node (SC1–SC9)
    const isTerminal =
      edge.to.length === 3 &&
      edge.to[0] === 'S' &&
      edge.to[1] === 'C' &&
      edge.to[2] >= '1' &&
      edge.to[2] <= '9';

    if (isTerminal) {
      // Accumulate scenario probability
      scenarios[edge.to] = (scenarios[edge.to] || 0) + childPathProb;
      // Accumulate branch contribution
      if (childBranch) {
        contributions[edge.to][childBranch] += childPathProb;
      }
    }

    // Recurse into child
    traverseGraph(
      edge.to,
      childPathProb,
      childBranch,
      ctx,
      adj,
      edges,
      edgeProbabilities,
      nodeAccum,
      scenarios,
      contributions
    );
  }
}

// === Main Export: buildDecisionGraph ===========================================

export function buildDecisionGraph(input: GraphInput): GraphData {
  // 0. Sanitize all numeric inputs — replace NaN/Infinity/undefined with safe defaults
  const price = safeNum(input.price, 1000);
  const bullConsensus = clamp(safeNum(input.bullConsensus, 0.5), 0, 1);
  const rsi = clamp(safeNum(input.rsi, 50), 0, 100);
  const mfi = clamp(safeNum(input.mfi, 50), 0, 100);
  const cci = safeNum(input.cci, 0);
  const stochK = clamp(safeNum(input.stochK, 50), 0, 100);
  const stochD = clamp(safeNum(input.stochD, 50), 0, 100);
  const adx = clamp(safeNum(input.adx, 20), 0, 100);
  const diPlus = clamp(safeNum(input.diPlus, 20), 0, 100);
  const diMinus = clamp(safeNum(input.diMinus, 20), 0, 100);
  const macdHist = safeNum(input.macdHist, 0);
  const atr = safeNum(input.atr, price * 0.02);
  const bbUpper = safeNum(input.bbUpper, price * 1.03);
  const bbMiddle = safeNum(input.bbMiddle, price);
  const bbLower = safeNum(input.bbLower, price * 0.97);
  const sar = safeNum(input.sar, price);
  const ichimokuTenkan = safeNum(input.ichimokuTenkan, price);
  const ichimokuKijun = safeNum(input.ichimokuKijun, price);
  const ichimokuSenkouA = safeNum(input.ichimokuSenkouA, price);
  const ichimokuSenkouB = safeNum(input.ichimokuSenkouB, price);
  const maAlignment = clamp(safeNum(input.maAlignment, 0.5), 0, 1);
  const momentum = safeNum(input.momentum, 0);
  const awesomeOsc = safeNum(input.awesomeOsc, 0);
  const fisherTransform = clamp(safeNum(input.fisherTransform, 0), -5, 5);
  const confidenceIndex = clamp(safeNum(input.confidenceIndex, 0.5), 0, 1);
  const strengthIndex = clamp(safeNum(input.strengthIndex, 0.5), 0, 1);
  const hasVolume = input.hasVolume === true;
  const distToR1 = safeNum(input.distToR1, 0.03);
  const distToS1 = safeNum(input.distToS1, 0.03);
  const srAvgStrength = clamp(safeNum(input.srAvgStrength, 0.3), 0, 1);
  const mlMomentum = clamp(safeNum(input.mlMomentum, 0.7), 0, 1);
  const mlVolatility = clamp(safeNum(input.mlVolatility, 0.5), 0, 1);
  const mlTrend = clamp(safeNum(input.mlTrend, 0.6), 0, 1);

  // Create sanitized input object
  const sanitizedInput: GraphInput = {
    price, bullConsensus, rsi, mfi, cci, stochK, stochD, adx, diPlus, diMinus,
    macdHist, atr, bbUpper, bbMiddle, bbLower, sar,
    ichimokuTenkan, ichimokuKijun, ichimokuSenkouA, ichimokuSenkouB,
    maAlignment, momentum, awesomeOsc, fisherTransform,
    confidenceIndex, strengthIndex, hasVolume,
    distToR1, distToS1, srAvgStrength,
    mlMomentum, mlVolatility, mlTrend,
  };

  // 1. Build static graph structure
  const nodes = createNodes();
  const edges = createEdges();
  const nodePositions = createPositions();

  // 2. Build adjacency map: nodeId → array of edge indices
  const adj = new Map<string, number[]>();
  for (let i = 0; i < edges.length; i++) {
    const from = edges[i].from;
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(i);
  }

  // 3. Build probability context (use sanitized input)
  const ctx = buildContext(sanitizedInput);

  // 4. Initialize accumulation structures
  const edgeProbabilities: Record<number, number> = {};
  const nodeAccum: Record<string, number> = {};
  const scenarios: Record<string, number> = {};
  const contributions: Record<
    string,
    { trend: number; breakout: number; reversal: number }
  > = {};

  for (let i = 1; i <= 9; i++) {
    const key = `SC${i}`;
    scenarios[key] = 0;
    contributions[key] = { trend: 0, breakout: 0, reversal: 0 };
  }

  // 5. Traverse graph from ROOT
  traverseGraph(
    'ROOT',
    1.0,
    null,
    ctx,
    adj,
    edges,
    edgeProbabilities,
    nodeAccum,
    scenarios,
    contributions
  );

  // 6. Post-process scenario probabilities — IRON LAW: integers summing to EXACTLY 100
  // Convert raw traversal fractions to percentages, then use enforceSumTo100 for
  // guaranteed sum=100 with each value in [2, 35].
  const rawFloats: number[] = [];
  for (let i = 1; i <= 9; i++) {
    const key = `SC${i}`;
    rawFloats.push(safeNum(scenarios[key], 0) * 100);
  }

  const roundedInts = enforceSumTo100(rawFloats, 2, 35);

  const finalPcts: Record<string, number> = {};
  for (let i = 1; i <= 9; i++) {
    const key = `SC${i}`;
    finalPcts[key] = roundedInts[i - 1];
  }

  // 7. Compute branch probabilities (from ROOT outgoing edges)
  const rootEdgeIndices = adj.get('ROOT') || [];
  const rootProbs = computeNodeProbabilities('ROOT', ctx, rootEdgeIndices.length);
  const branchProbabilities = {
    trend: rootProbs[0] || 0,
    breakout: rootProbs[1] || 0,
    reversal: rootProbs[2] || 0,
  };

  // 8. Build node display values (path probability as percentage)
  const nodeValues: Record<string, string> = {};
  for (const [nodeId, accum] of Object.entries(nodeAccum)) {
    nodeValues[nodeId] = `${Math.round(accum * 100)}%`;
  }

  // Override terminal node values with final post-processed percentages
  for (const [key, pct] of Object.entries(finalPcts)) {
    nodeValues[key] = `${pct}%`;
  }

  // 9. Build path contributions (as percentages)
  const pathContributions: Record<
    string,
    { trend: number; breakout: number; reversal: number }
  > = {};
  for (let i = 1; i <= 9; i++) {
    const key = `SC${i}`;
    const c = contributions[key];
    const total = c.trend + c.breakout + c.reversal;
    if (total > 0) {
      pathContributions[key] = {
        trend: Math.round((c.trend / total) * 100),
        breakout: Math.round((c.breakout / total) * 100),
        reversal: Math.round((c.reversal / total) * 100),
      };
    } else {
      pathContributions[key] = { trend: 33, breakout: 34, reversal: 33 };
    }
  }

  // 10. Compute 30-day probability trend
  const probFractions: Record<string, number> = {};
  for (const [k, v] of Object.entries(finalPcts)) {
    probFractions[k] = v / 100;
  }
  const probabilityTrend = calcTrendFromProbs(probFractions, 30);

  // 11. Return complete GraphData
  return {
    nodes,
    edges,
    nodePositions,
    edgeProbabilities,
    nodeValues,
    branchProbabilities,
    scenarioProbabilities: finalPcts,
    pathContributions,
    probabilityTrend,
  };
}


