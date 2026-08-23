/**
 * ML-Based Analysis Selector
 *
 * Selects the optimal combination of:
 * - 10 Technical Analysis Schools (مکتب تحلیل تکنیکال)
 * - 10 Narrative Styles (سبک روایت)
 * - 15 Analytical Tones (لحن تحلیلی)
 *
 * Selection is based on rule-based ML inference from technical indicator data.
 * This module runs on the server side only.
 */

// ═══════════════════════════════════════════════════════════════
// 10 Technical Analysis Schools
// ═══════════════════════════════════════════════════════════════

export const ANALYSIS_SCHOOLS = [
  'تحلیل روند (Trend Following)',
  'تحلیل الگوهای کلاسیک (Classical Pattern)',
  'تحلیل کندلی و بازگشتی (Candlestick & Reversal)',
  'تحلیل فیبوناچی و هندسی (Fibonacci & Geometric)',
  'تحلیل نوسان و حجم (Volatility & Volume)',
  'تحلیل اسیلاتورها و مومنتوم (Oscillators & Momentum)',
  'تحلیل سطوح حمایت/مقاومت (Support & Resistance)',
  'تحلیل فازها و چرخه‌ها (Phase & Cycle)',
  'تحلیل چندزمانی و ترکیبی (Multi-Timeframe & Composite)',
  'تحلیل روانشناختی و رفتار بازار (Behavioral & Sentiment)',
] as const;

export type AnalysisSchool = (typeof ANALYSIS_SCHOOLS)[number];

// ═══════════════════════════════════════════════════════════════
// 10 Narrative Styles
// ═══════════════════════════════════════════════════════════════

export const NARRATIVE_STYLES = [
  'محافظه‌کار',
  'اسکالپر',
  'روندگرا',
  'بدبین',
  'روایی',
  'تصمیم‌محور',
  'تحلیلگر حجم',
  'تحلیلگر الگو',
  'روانشناختی',
  'تحلیلگر نوسان',
] as const;

export type NarrativeStyle = (typeof NARRATIVE_STYLES)[number];

// ═══════════════════════════════════════════════════════════════
// 15 Analytical Tones
// ═══════════════════════════════════════════════════════════════

export const ANALYTICAL_TONES = [
  'رسمی و آکادمیک',
  'سریع و عملیاتی',
  'فلسفی و زمانی',
  'هشداردهنده و ریسک‌محور',
  'داستانی و توصیفی',
  'گام‌به‌گام و عملی',
  'شکاک و پرسشگر',
  'خوشبین و روندپذیر',
  'ساده و شفاف',
  'عدد‌محور و سخت‌گیر',
  'چندلایه و مرموز',
  'آموزشی و راهنماییانه',
  'مقایسه‌ای و چندسناریویی',
  'متوازن و بی‌طرف',
  'جمع‌بندی‌محور و نتیجه‌گرا',
] as const;

export type AnalyticalTone = (typeof ANALYTICAL_TONES)[number];

// ═══════════════════════════════════════════════════════════════
// Input Data Interface
// ═══════════════════════════════════════════════════════════════

export interface MLSelectorInput {
  price: number;
  trend: 'up' | 'down' | 'range';
  adx: number;
  diPlus: number;
  diMinus: number;
  rsi: number;
  stochK: number;
  macdHist: number;
  obv: number;
  bbPosition: number; // 0-100
  resistance: number;
  support: number;
  atr: number;
  scenarioDominant: string; // R1-R5
  hasVolume: boolean;
}

export interface MLSelection {
  school: AnalysisSchool;
  style: NarrativeStyle;
  tone: AnalyticalTone;
  reasoning: string;
}

// ═══════════════════════════════════════════════════════════════
// ML Selector Logic
// ═══════════════════════════════════════════════════════════════

function isRange(data: MLSelectorInput): boolean {
  return data.trend === 'range' && data.adx < 25;
}

function isStrongTrendUp(data: MLSelectorInput): boolean {
  return data.trend === 'up' && data.adx > 25;
}

function isStrongTrendDown(data: MLSelectorInput): boolean {
  return data.trend === 'down' && data.adx > 25;
}

function isOverbought(data: MLSelectorInput): boolean {
  return data.rsi > 70 || data.stochK > 80;
}

function isOversold(data: MLSelectorInput): boolean {
  return data.rsi < 30 || data.stochK < 20;
}

function isNearResistance(data: MLSelectorInput, threshold = 0.03): boolean {
  return data.resistance > 0 && (Math.abs(data.price - data.resistance) / data.price) < threshold;
}

function isNearSupport(data: MLSelectorInput, threshold = 0.03): boolean {
  return data.support > 0 && (Math.abs(data.price - data.support) / data.price) < threshold;
}

function isVolatilitySqueeze(data: MLSelectorInput): boolean {
  return 70 < data.bbPosition && data.bbPosition < 90;
}

function isHighVolatility(data: MLSelectorInput): boolean {
  return data.bbPosition > 90 || data.bbPosition < 10;
}

function isUncertain(data: MLSelectorInput): boolean {
  return data.adx < 20 || (isOverbought(data) && isStrongTrendUp(data));
}

function isSevereConflict(data: MLSelectorInput): boolean {
  return (isOverbought(data) && isNearResistance(data)) ||
         (isOversold(data) && isStrongTrendUp(data)) ||
         (data.trend === 'up' && data.rsi > 80 && data.stochK > 85);
}

/**
 * Select school, style, and tone based on ML rules.
 * Returns the selection with a brief reasoning string.
 */
export function selectMLCombination(data: MLSelectorInput): MLSelection {
  let school: AnalysisSchool;
  let style: NarrativeStyle;
  let tone: AnalyticalTone;
  let reasoning: string;

  // ── Rule 1: Range Market ──
  if (isRange(data)) {
    school = 'تحلیل سطوح حمایت/مقاومت (Support & Resistance)';
    style = 'محافظه‌کار';
    tone = 'متوازن و بی‌طرف';
    reasoning = 'بازار در فاز رنج با ADX پایین: مکتب حمایت/مقاومت + سبک محافظه‌کار + لحن متوازن';
  }
  // ── Rule 2: Strong Uptrend (no overbought) ──
  else if (isStrongTrendUp(data) && !isOverbought(data)) {
    school = 'تحلیل روند (Trend Following)';
    style = 'روندگرا';
    tone = 'خوشبین و روندپذیر';
    reasoning = 'روند صعودی قوی بدون اشباع: مکتب روند + سبک روندگرا + لحن خوشبین';
  }
  // ── Rule 3: Strong Uptrend WITH overbought ──
  else if (isStrongTrendUp(data) && isOverbought(data)) {
    school = 'تحلیل اسیلاتورها و مومنتوم (Oscillators & Momentum)';
    style = 'اسکالپر';
    tone = 'هشداردهنده و ریسک‌محور';
    reasoning = 'روند صعودی قوی با اشباع خرید: مکتب اسیلاتورها + سبک اسکالپر + لحن هشداردهنده';
  }
  // ── Rule 4: Severe Conflict ──
  else if (isSevereConflict(data)) {
    school = 'تحلیل اسیلاتورها و مومنتوم (Oscillators & Momentum)';
    style = 'بدبین';
    tone = 'شکاک و پرسشگر';
    reasoning = 'تضاد شدید بین سیگنال‌ها: مکتب اسیلاتورها + سبک بدبین + لحن شکاک';
  }
  // ── Rule 5: Volatility Squeeze ──
  else if (isVolatilitySqueeze(data)) {
    school = 'تحلیل نوسان و حجم (Volatility & Volume)';
    style = 'تحلیلگر نوسان';
    tone = 'هشداردهنده و ریسک‌محور';
    reasoning = 'نوسان فشرده (باند بولینگر): مکتب نوسان و حجم + سبک تحلیلگر نوسان + لحن هشداردهنده';
  }
  // ── Rule 6: High Volatility / Breakout ──
  else if (isHighVolatility(data)) {
    school = 'تحلیل الگوهای کلاسیک (Classical Pattern)';
    style = 'تحلیلگر الگو';
    tone = 'آموزشی و راهنماییانه';
    reasoning = 'نوسان بالا و احتمال شکست: مکتب الگوهای کلاسیک + سبک تحلیلگر الگو + لحن آموزشی';
  }
  // ── Rule 7: Strong Downtrend ──
  else if (isStrongTrendDown(data)) {
    school = 'تحلیل فازها و چرخه‌ها (Phase & Cycle)';
    style = 'بدبین';
    tone = 'عدد‌محور و سخت‌گیر';
    reasoning = 'روند نزولی قوی: مکتب فازها و چرخه‌ها + سبک بدبین + لحن عددمحور';
  }
  // ── Rule 8: Near Support ──
  else if (isNearSupport(data)) {
    school = 'تحلیل کندلی و بازگشتی (Candlestick & Reversal)';
    style = 'اسکالپر';
    tone = 'سریع و عملیاتی';
    reasoning = 'نزدیکی به حمایت: مکتب کندلی و بازگشتی + سبک اسکالپر + لحن سریع و عملیاتی';
  }
  // ── Rule 9: Uncertain / Mixed Signals ──
  else if (isUncertain(data)) {
    school = 'تحلیل روانشناختی و رفتار بازار (Behavioral & Sentiment)';
    style = 'روایی';
    tone = 'چندلایه و مرموز';
    reasoning = 'عدم قطعیت بالا: مکتب روانشناختی + سبک روایی + لحن چندلایه';
  }
  // ── Rule 10: Default / General ──
  else {
    school = 'تحلیل چندزمانی و ترکیبی (Multi-Timeframe & Composite)';
    style = 'تصمیم‌محور';
    tone = 'گام‌به‌گام و عملی';
    reasoning = 'شرایط عمومی: مکتب چندزمانی و ترکیبی + سبک تصمیم‌محور + لحن گام‌به‌گام';
  }

  // ── Override: Volume-based refinement ──
  if (data.hasVolume && data.obv > 0 && (style as string) !== 'تحلیلگر حجم') {
    // If OBV strongly confirms trend, consider volume analyst style
    if (Math.abs(data.obv) > 1e9) {
      style = 'تحلیلگر حجم' as NarrativeStyle;
      tone = 'عدد‌محور و سخت‌گیر' as AnalyticalTone;
      reasoning = reasoning + ' (بازنویسی: حجم بالا OBV، سبک به تحلیلگر حجم تغییر یافت)';
    }
  }

  // ── Override: Scenario-dominant refinement ──
  if (data.scenarioDominant === 'R5') {
    if (tone !== 'هشداردهنده و ریسک‌محور' && tone !== 'شکاک و پرسشگر') {
      tone = 'هشداردهنده و ریسک‌محور';
      reasoning = reasoning + ' (بازنویسی: سناریوی تضعیف ساختار، لحن به هشداردهنده تغییر یافت)';
    }
  }
  if (data.scenarioDominant === 'R1') {
    if (tone !== 'خوشبین و روندپذیر' && tone !== 'سریع و عملیاتی') {
      tone = 'خوشبین و روندپذیر';
      reasoning = reasoning + ' (بازنویسی: سناریوی صعود هیجانی، لحن به خوشبین تغییر یافت)';
    }
  }

  return { school, style, tone, reasoning };
}

// ═══════════════════════════════════════════════════════════════
// Scenario Name Mapping
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_NAMES: Record<string, string> = {
  R1: 'تداوم صعود هیجانی',
  R2: 'پولبک سالم',
  R3: 'اصلاح کنترل‌شده',
  R4: 'اصلاح عمیق',
  R5: 'تضعیف ساختار',
};

export function getScenarioName(key: string): string {
  return SCENARIO_NAMES[key] || 'نامشخص';
}

// ═══════════════════════════════════════════════════════════════
// Analytical Method Selection Table
// ═══════════════════════════════════════════════════════════════

interface MethodCondition {
  condition: (data: MLSelectorInput) => boolean;
  methods: string[];
}

const METHOD_TABLE: MethodCondition[] = [
  {
    condition: (d) => isStrongTrendUp(d),
    methods: ['EMA 20/50', 'MACD', 'فیبوناچی اصلاحی (۳۸.۲ یا ۵۰٪)'],
  },
  {
    condition: (d) => isStrongTrendDown(d),
    methods: ['SMA 50/200', 'RSI (اشباع فروش)', 'الگوهای ادامه‌دهنده نزولی'],
  },
  {
    condition: (d) => isRange(d),
    methods: ['باند بولینگر', 'استوکاستیک', 'سطوح افقی حمایت/مقاومت'],
  },
  {
    condition: (d) => isNearResistance(d),
    methods: ['الگوهای برگشتی نزولی', 'واگرایی منفی RSI/MACD', 'فیبوناچی گسترشی'],
  },
  {
    condition: (d) => isNearSupport(d),
    methods: ['الگوهای برگشتی صعودی', 'واگرایی مثبت RSI/MACD', 'پین‌بار/همر'],
  },
  {
    condition: (d) => d.atr > 0 && (d.atr / d.price) < 0.01,
    methods: ['منتظر شکست باند بولینگر', 'مثلث/پرچم انباشت', 'ATR باریک'],
  },
  {
    condition: (d) => isVolatilitySqueeze(d) || isHighVolatility(d),
    methods: ['OBV تأییدکننده', 'فیبوناچی گسترشی', 'کندل قوی شکستی'],
  },
];

/**
 * Select 3-5 analytical methods based on current market conditions.
 */
export function selectMethods(data: MLSelectorInput): string[] {
  const selected = new Set<string>();

  for (const entry of METHOD_TABLE) {
    if (entry.condition(data)) {
      for (const m of entry.methods) {
        selected.add(m);
      }
    }
  }

  // Ensure minimum 3 methods
  if (selected.size < 3) {
    selected.add('RSI و مومنتوم');
    selected.add('سطوح کلیدی حمایت/مقاومت');
    selected.add('خط روند میان‌مدت');
  }

  // Cap at 5
  const methods = Array.from(selected).slice(0, 5);
  return methods;
}
