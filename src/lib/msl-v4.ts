/**
 * MSL v4 — School / Style / Tone Analysis Engine
 * Pure TypeScript, no framework imports.
 * Implements the full v4 specification with 6 schools, 5 styles, 6 tones,
 * compatibility matrices, multipliers, and Persian prompt generation.
 */

// ═══════════════════════════════════════════════════════════════
// Type Interfaces
// ═══════════════════════════════════════════════════════════════

export type SchoolId = 'classical' | 'oscillator' | 'volume' | 'harmonic' | 'hybrid' | 'elliott';
export type StyleId = 'executive' | 'analytical' | 'forecasting' | 'trading' | 'educational';
export type ToneId = 'conservative' | 'aggressive' | 'balanced' | 'warning' | 'optimistic' | 'realistic';
export type AssetType = 'cryptocurrency' | 'forex' | 'stocks' | 'commodities';
export type TimeframeType = 'daily' | 'hourly' | 'weekly' | 'monthly';
export type RegimeType = 'Strong Bull' | 'Weak Bull' | 'Strong Bear' | 'Weak Bear' | 'Range';

export interface SchoolDef {
  id: SchoolId; name: string; nameEn: string; base_weight: number;
  prompt: string;
}
export interface StyleDef {
  id: StyleId; name: string; nameEn: string;
  length: string; detailLevel: string; focus: string;
  prompt: string;
}
export interface ToneDef {
  id: ToneId; name: string; nameEn: string;
  keywords: string[];
  prompt: string;
}

export interface MSLV4Context {
  asset: AssetType | string;
  timeframe: TimeframeType | string;
  regime: RegimeType | string;
  confidence: number;
  volatility: number;           // ATR/Price ratio
  trend_strength: number;       // 0-1
  dominantScenario: string;
  pattern_counts?: { classical?: number; harmonic?: number; elliott?: number };
  divergence_present?: boolean;
  hasVolume?: boolean;
  rsi?: number;
  adx?: number;
  audience_level?: string;
  // Probability trend signals (from 30-day historical analysis)
  probTrend?: {
    // Group cumulative trend directions
    bullGroupDir?: 'rising' | 'falling' | 'stable' | 'volatile';
    bearGroupDir?: 'rising' | 'falling' | 'stable' | 'volatile';
    neutralGroupDir?: 'rising' | 'falling' | 'stable' | 'volatile';
    // Group cumulative current values (today)
    bullGroupCum?: number;
    bearGroupCum?: number;
    neutralGroupCum?: number;
    // Dominant scenario cumulative trend
    dominantCumDir?: 'rising' | 'falling' | 'stable' | 'volatile';
    // Individual trend direction for dominant scenario
    dominantIndivDir?: 'rising' | 'falling' | 'stable' | 'volatile';
    // 7-day change in group cumulative (positive = rising)
    bullGroupChange7d?: number;
    bearGroupChange7d?: number;
    neutralGroupChange7d?: number;
  };
}

export interface SchoolResult {
  id: string; name: string; nameEn: string; weight: number;
  confidence: string; status: string; reasoning: string[];
}
export interface StyleResult {
  id: string; name: string; nameEn: string; score: number;
  detail_level: string; length: string; focus: string; reasoning: string[];
}
export interface ToneResult {
  id: string; name: string; nameEn: string; score: number;
  intensity: string; keywords: string[]; reasoning: string[];
}
export interface MSLV4Result {
  school_of_analysis: {
    primary: SchoolResult; secondary: { id: string; name: string; weight: number; reasoning: string };
    all_schools: Record<string, number>;
  };
  analysis_style: {
    primary: StyleResult; secondary: { id: string; name: string; score: number };
  };
  analysis_tone: {
    primary: ToneResult; secondary: { id: string; name: string; score: number };
  };
  final_combination: { statement: string; confidence: number; recommendation: string };
  interpretability: { key_factors: { factor: string; impact: number }[] };
}

// ═══════════════════════════════════════════════════════════════
// Schools (6)
// ═══════════════════════════════════════════════════════════════

const SCHOOLS: SchoolDef[] = [
  { id: 'classical', name: 'مکتب کلاسیک', nameEn: 'Classical School', base_weight: 0.30,
    prompt: 'تحلیل را بر اساس مکتب کلاسیک ارائه بده. بر سطوح حمایت و مقاومت، خطوط روند، الگوهای کلاسیک (سر و شانه، مثلث، پرچم، گوه) و میانگین‌های متحرک تمرکز کن. اصل‌های «قیمت همه‌چیز را تعدیل می‌کند» و «تاریخ خود را تکرار می‌کند» را رعایت کن.' },
  { id: 'oscillator', name: 'مکتب اسیلاتوری', nameEn: 'Oscillator School', base_weight: 0.25,
    prompt: 'تحلیل را بر اساس مکتب اسیلاتوری ارائه بده. بر RSI، MACD، استوکاستیک، CCI و واگرایی‌ها تمرکز کن. نقاط اشباع خرید و فروش و واگرایی‌ها را به عنوان سیگنال‌های اصلی بررسی کن.' },
  { id: 'volume', name: 'مکتب حجم و عرضه/تقاضا', nameEn: 'Volume & Supply/Demand School', base_weight: 0.15,
    prompt: 'تحلیل را بر اساس مکتب حجم ارائه بده. بر حجم معاملات، OBV، VWAP، Chaikin A/D و نواحی عرضه و تقاضا تمرکز کن. حجم را به عنوان تأییدکننده اصلی حرکات قیمت در نظر بگیر.' },
  { id: 'harmonic', name: 'مکتب هارمونیک', nameEn: 'Harmonic School', base_weight: 0.10,
    prompt: 'تحلیل را بر اساس مکتب هارمونیک ارائه بده. بر الگوهای گارتلی، خفاش، خرچنگ، پروانه و نسبت‌های فیبوناچی تمرکز کن. مناطق برگشت احتمالی (PRZ) را محاسبه و مشخص کن.' },
  { id: 'hybrid', name: 'مکتب ترکیبی', nameEn: 'Hybrid School', base_weight: 0.10,
    prompt: 'تحلیل را بر اساس مکتب ترکیبی ارائه بده. از ترکیب ابزارها و روش‌های مکاتب مختلف استفاده کن. به دلیل عدم غلبه یک مکتب خاص، نگاهی همه‌جانبه و متوازن داشته باش.' },
  { id: 'elliott', name: 'مکتب الیوت', nameEn: 'Elliott School', base_weight: 0.10,
    prompt: 'تحلیل را بر اساس مکتب الیوت ارائه بده. بر الگوهای موجی (انگیزشی ۵ موجی و اصلاحی ۳ موجی)، نسبت‌های فیبوناچی بین امواج و قوانین جایگزینی تمرکز کن.' },
];

// ═══════════════════════════════════════════════════════════════
// Styles (5)
// ═══════════════════════════════════════════════════════════════

const STYLES: StyleDef[] = [
  { id: 'executive', name: 'سبک اجرایی و تصمیم‌گیری', nameEn: 'Executive & Decision-Making Style',
    length: 'short', detailLevel: 'low', focus: 'decision',
    prompt: 'تحلیل را به سبک اجرایی ارائه بده. مختصر و متمرکز بر تصمیم. ابتدا چکیده اجرایی، سپس تصمیم پیشنهادی (BUY/SELL/HOLD)، دلایل کلیدی (حداکثر ۵ مورد) و ریسک‌های اصلی. بر EMV و نسبت ریسک/بازده تأکید کن.' },
  { id: 'analytical', name: 'سبک تحلیلی-تکنیکال', nameEn: 'Analytical-Technical Style',
    length: 'long', detailLevel: 'high', focus: 'analysis',
    prompt: 'تحلیل را به سبک تحلیلی-تکنیکال ارائه بده. جزئیات کامل فنی با بررسی تمام اندیکاتورها و الگوها. تحلیل روند چند تایم‌فریم، سطوح حمایت/مقاومت و سناریوهای احتمالی را شامل شود.' },
  { id: 'forecasting', name: 'سبک پیش‌بینی و آینده‌نگر', nameEn: 'Forecasting & Forward-Looking Style',
    length: 'medium-long', detailLevel: 'medium', focus: 'forecast',
    prompt: 'تحلیل را به سبک پیش‌بینی و آینده‌نگر ارائه بده. تأکید بر پیش‌بینی‌های آینده با سناریوهای مختلف و احتمالات. نقاط عطف آینده و راهبردهای پیشنهادی را مشخص کن.' },
  { id: 'trading', name: 'سبک معاملاتی و عملیاتی', nameEn: 'Trading & Operational Style',
    length: 'short', detailLevel: 'low', focus: 'action',
    prompt: 'تحلیل را به سبک معاملاتی ارائه بده. تأکید بر نقاط ورود/خروج دقیق، حد ضرر، حد سود، حجم معامله و نسبت ریسک به بازده. دستورات عملیاتی واضح و قابل اجرا باشد.' },
  { id: 'educational', name: 'سبک آموزشی-تفسیری', nameEn: 'Educational-Interpretive Style',
    length: 'medium', detailLevel: 'medium', focus: 'learning',
    prompt: 'تحلیل را به سبک آموزشی ارائه بده. مفاهیم را به زبان ساده توضیح بده، از مثال‌های عملی استفاده کن و از اصطلاحات پیچیده پرهیز کن. تمرکز بر درک مفاهیم و اقدام عملی باشد.' },
];

// ═══════════════════════════════════════════════════════════════
// Tones (6)
// ═══════════════════════════════════════════════════════════════

const TONES: ToneDef[] = [
  { id: 'conservative', name: 'لحن محافظه‌کارانه', nameEn: 'Conservative Tone',
    keywords: ['با احتیاط', 'مدیریت ریسک', 'حفظ سرمایه', 'انتظار', 'محافظه‌کارانه'],
    prompt: 'لحن تحلیل محافظه‌کارانه باشد. تأکید بر مدیریت ریسک، حجم معاملات کمتر و حفظ سرمایه. از ریسک‌های غیرضروری پرهیز کن.' },
  { id: 'aggressive', name: 'لحن تهاجمی', nameEn: 'Aggressive Tone',
    keywords: ['ورود سریع', 'سودآوری بالا', 'فرصت استثنایی', 'بهترین زمان', 'اقدام قاطع'],
    prompt: 'لحن تحلیل تهاجمی باشد. تأکید بر فرصت‌های سودآوری، ورود سریع و حجم معاملات بیشتر. اعتماد به تحلیل و ریسک‌پذیری بیشتر.' },
  { id: 'balanced', name: 'لحن متعادل', nameEn: 'Balanced Tone',
    keywords: ['بررسی همه جوانب', 'متوازن', 'منطقی', 'محاسبه‌شده', 'همه‌جانبه'],
    prompt: 'لحن تحلیل متعادل باشد. ترکیب فرصت و ریسک، منطقی و مبتنی بر داده. بررسی موافقان و مخالفان و نگاه همه‌جانبه.' },
  { id: 'warning', name: 'لحن هشداردهنده', nameEn: 'Warning Tone',
    keywords: ['هشدار', 'خطر', 'برگشت', 'خروج', 'اقدام فوری'],
    prompt: 'لحن تحلیل هشداردهنده باشد. تأکید بر خطرات، هشدار برگشت روند و توصیه به خروج. نشانه‌های خطر و اقدام پیشگیرانه را برجسته کن.' },
  { id: 'optimistic', name: 'لحن خوش‌بینانه', nameEn: 'Optimistic Tone',
    keywords: ['فرصت رشد', 'چشم‌انداز مثبت', 'روند صعودی', 'اعتماد', 'آینده روشن'],
    prompt: 'لحن تحلیل خوش‌بینانه باشد. تأکید بر فرصت‌های رشد، اعتماد به روند صعودی و چشم‌انداز مثبت. تشویق به ورود با اعتماد به آینده.' },
  { id: 'realistic', name: 'لحن واقع‌گرایانه', nameEn: 'Realistic Tone',
    keywords: ['بر اساس داده', 'احتمالات', 'سناریوهای مختلف', 'شفاف', 'واقع‌گرایانه'],
    prompt: 'لحن تحلیل واقع‌گرایانه باشد. پذیرش عدم‌قطعیت، سناریوهای مختلف با احتمالات و تصمیمات مبتنی بر داده. بدون اغراق و با شفافیت کامل.' },
];

// ═══════════════════════════════════════════════════════════════
// Multipliers (exact values from spec)
// ═══════════════════════════════════════════════════════════════

const SCHOOL_IDS: SchoolId[] = ['classical', 'oscillator', 'volume', 'harmonic', 'hybrid', 'elliott'];

const ASSET_MULT: Record<string, Record<SchoolId, number>> = {
  cryptocurrency: { classical: 0.9, oscillator: 1.1, volume: 0.8, harmonic: 1.2, hybrid: 1.0, elliott: 1.0 },
  forex:        { classical: 1.1, oscillator: 0.9, volume: 0.6, harmonic: 0.9, hybrid: 1.0, elliott: 1.1 },
  stocks:       { classical: 1.0, oscillator: 0.9, volume: 1.2, harmonic: 0.8, hybrid: 1.0, elliott: 0.9 },
  commodities:  { classical: 1.0, oscillator: 1.0, volume: 1.1, harmonic: 0.9, hybrid: 1.0, elliott: 1.0 },
};

const TF_MULT: Record<string, Record<SchoolId, number>> = {
  daily:  { classical: 1.2, oscillator: 1.0, volume: 1.1, harmonic: 1.0, hybrid: 1.0, elliott: 1.1 },
  hourly:  { classical: 0.8, oscillator: 1.2, volume: 0.9, harmonic: 1.1, hybrid: 1.0, elliott: 0.9 },
  weekly:  { classical: 1.3, oscillator: 0.8, volume: 1.0, harmonic: 1.0, hybrid: 1.0, elliott: 1.2 },
  monthly: { classical: 1.4, oscillator: 0.7, volume: 0.9, harmonic: 0.9, hybrid: 0.9, elliott: 1.3 },
};

const REGIME_MULT: Record<string, Record<SchoolId, number>> = {
  'Strong Bull': { classical: 1.0, oscillator: 0.8, volume: 1.0, harmonic: 1.0, hybrid: 0.9, elliott: 1.2 },
  'Weak Bull':   { classical: 1.0, oscillator: 1.1, volume: 1.0, harmonic: 1.0, hybrid: 1.0, elliott: 0.9 },
  'Strong Bear': { classical: 0.9, oscillator: 1.0, volume: 0.9, harmonic: 0.9, hybrid: 1.1, elliott: 1.0 },
  'Weak Bear':   { classical: 0.9, oscillator: 1.1, volume: 1.0, harmonic: 1.0, hybrid: 1.1, elliott: 0.9 },
  'Range':       { classical: 0.8, oscillator: 1.3, volume: 0.8, harmonic: 1.1, hybrid: 1.2, elliott: 0.6 },
};

// ═══════════════════════════════════════════════════════════════
// Compatibility Matrices (exact values from spec)
// ═══════════════════════════════════════════════════════════════

const SS_MATRIX: Record<SchoolId, Record<StyleId, number>> = {
  classical:  { executive: 0.8, analytical: 1.0, forecasting: 0.6, trading: 0.7, educational: 0.5 },
  oscillator: { executive: 0.6, analytical: 0.9, forecasting: 0.8, trading: 0.7, educational: 0.6 },
  volume:     { executive: 0.7, analytical: 0.9, forecasting: 0.7, trading: 0.8, educational: 0.4 },
  harmonic:   { executive: 0.5, analytical: 0.8, forecasting: 0.9, trading: 0.6, educational: 0.7 },
  hybrid:     { executive: 0.9, analytical: 0.9, forecasting: 0.9, trading: 0.8, educational: 0.6 },
  elliott:    { executive: 0.6, analytical: 0.8, forecasting: 0.9, trading: 0.5, educational: 0.5 },
};

const ST_MATRIX: Record<SchoolId, Record<ToneId, number>> = {
  classical:  { conservative: 0.8, aggressive: 0.6, balanced: 0.9, warning: 0.7, optimistic: 0.7, realistic: 0.9 },
  oscillator: { conservative: 0.7, aggressive: 0.7, balanced: 0.8, warning: 0.9, optimistic: 0.6, realistic: 0.8 },
  volume:     { conservative: 0.9, aggressive: 0.5, balanced: 0.8, warning: 0.6, optimistic: 0.5, realistic: 0.9 },
  harmonic:   { conservative: 0.6, aggressive: 0.6, balanced: 0.7, warning: 0.7, optimistic: 0.8, realistic: 0.8 },
  hybrid:     { conservative: 0.7, aggressive: 0.8, balanced: 0.9, warning: 0.7, optimistic: 0.7, realistic: 0.9 },
  elliott:    { conservative: 0.5, aggressive: 0.6, balanced: 0.7, warning: 0.7, optimistic: 0.9, realistic: 0.8 },
};

const STYLE_TONE_MATRIX: Record<StyleId, Record<ToneId, number>> = {
  executive:   { conservative: 0.8, aggressive: 0.9, balanced: 0.7, warning: 0.6, optimistic: 0.7, realistic: 0.8 },
  analytical:  { conservative: 0.7, aggressive: 0.5, balanced: 0.8, warning: 0.7, optimistic: 0.6, realistic: 0.9 },
  forecasting: { conservative: 0.6, aggressive: 0.7, balanced: 0.7, warning: 0.6, optimistic: 0.8, realistic: 0.9 },
  trading:     { conservative: 0.9, aggressive: 0.9, balanced: 0.7, warning: 0.8, optimistic: 0.7, realistic: 0.7 },
  educational: { conservative: 0.6, aggressive: 0.4, balanced: 0.7, warning: 0.5, optimistic: 0.6, realistic: 0.8 },
};

// ═══════════════════════════════════════════════════════════════
// Helper: resolve asset type
// ═══════════════════════════════════════════════════════════════

function resolveAsset(raw: string): AssetType {
  const v = raw.toLowerCase();
  if (v.includes('crypto') || v.includes('btc') || v.includes('eth') || v.includes('usdt')) return 'cryptocurrency';
  if (v.includes('forex') || v.includes('eur') || v.includes('usd') || v.includes('jpy')) return 'forex';
  if (v.includes('gold') || v.includes('طلا') || v.includes('xau') || v.includes('oil') || v.includes('نفت')) return 'commodities';
  return 'stocks';
}

function resolveTimeframe(raw: string): TimeframeType {
  const v = raw.toLowerCase();
  if (v.includes('h') || v.includes('hour') || v.includes('4h') || v.includes('1h')) return 'hourly';
  if (v.includes('w') || v.includes('week')) return 'weekly';
  if (v.includes('m') || v.includes('month')) return 'monthly';
  return 'daily';
}

function resolveRegime(raw: string): RegimeType {
  // Support new 5-state regime from regime-engine.ts
  if (raw === 'TRENDING_UP') return 'Strong Bull';
  if (raw === 'TRENDING_DOWN') return 'Strong Bear';
  if (raw === 'RANGING' || raw === 'VOLATILE') return 'Range';
  if (raw === 'BREAKOUT') return 'Strong Bull'; // breakout assumed bullish by default
  // Legacy support
  if (raw.includes('Strong Bull') || raw.includes('strong_bull')) return 'Strong Bull';
  if (raw.includes('Weak Bull') || raw.includes('weak_bull')) return 'Weak Bull';
  if (raw.includes('Strong Bear') || raw.includes('strong_bear')) return 'Strong Bear';
  if (raw.includes('Weak Bear') || raw.includes('weak_bear')) return 'Weak Bear';
  return 'Range';
}

function toPersianNum(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '\u06f0';
  const fixed = Math.round(n * 100) / 100;
  return String(fixed).replace(/\d/g, d => String.fromCharCode('\u0660'.charCodeAt(0) + parseInt(d)));
}

// ═══════════════════════════════════════════════════════════════
// School Selection
// ═══════════════════════════════════════════════════════════════

function selectSchools(ctx: MSLV4Context) {
  const asset = resolveAsset(ctx.asset);
  const tf = resolveTimeframe(ctx.timeframe);
  const regime = resolveRegime(ctx.regime);
  const am = ASSET_MULT[asset] ?? ASSET_MULT.stocks;
  const tm = TF_MULT[tf] ?? TF_MULT.daily;
  const rm = REGIME_MULT[regime] ?? REGIME_MULT.Range;

  const pt = ctx.probTrend;

  const rawWeights: Record<SchoolId, number> = {} as Record<SchoolId, number>;
  for (const s of SCHOOLS) {
    let w = s.base_weight * am[s.id] * tm[s.id] * rm[s.id];
    // Adaptive: zero out volume school if no volume data
    if (s.id === 'volume' && ctx.hasVolume === false) w *= 0.2;

    // Probability trend adjustments (cumulative weighted 2x more than individual)
    if (pt) {
      // Oscillator school: if cumulative bearish trend rising → divergence/reversal signals
      if (s.id === 'oscillator' && pt.bearGroupDir === 'rising' && pt.bullGroupCum && pt.bullGroupCum > 0.3) {
        w *= 1.25; // Bearish momentum building, oscillators useful for reversal timing
      }
      // Classical school: strong directional cumulative trend → support/resistance focus
      if (s.id === 'classical' && (pt.bullGroupDir === 'rising' || pt.bearGroupDir === 'rising')) {
        w *= 1.15; // Clear trend direction, classical S/R analysis
      }
      // Elliott school: volatile or changing cumulative trends → wave analysis
      if (s.id === 'elliott' && (pt.bullGroupDir === 'volatile' || pt.bearGroupDir === 'volatile')) {
        w *= 1.2; // Volatile probability shifts suggest wave structure changes
      }
      // Harmonic school: trend reversal in cumulative probabilities
      if (s.id === 'harmonic' && (
        (pt.bullGroupDir === 'falling' && pt.bullGroupCum && pt.bullGroupCum > 0.4) ||
        (pt.bearGroupDir === 'falling' && pt.bearGroupCum && pt.bearGroupCum > 0.4)
      )) {
        w *= 1.2; // Declining dominant group suggests reversal zone
      }
      // Hybrid school: neutral dominant and stable trends
      if (s.id === 'hybrid' && pt.neutralGroupDir === 'stable' && pt.neutralGroupCum && pt.neutralGroupCum > 0.2) {
        w *= 1.15; // Range-bound market, hybrid approach best
      }
      // Volume school: strong directional 7-day change
      if (s.id === 'volume' && ctx.hasVolume !== false) {
        const maxChange = Math.max(Math.abs(pt.bullGroupChange7d ?? 0), Math.abs(pt.bearGroupChange7d ?? 0));
        if (maxChange > 0.15) w *= 1.15; // Significant probability shift, volume confirms
      }
    }

    rawWeights[s.id] = w;
  }

  const total = Object.values(rawWeights).reduce((a, b) => a + b, 0);
  const normWeights: Record<string, number> = {};
  for (const id of SCHOOL_IDS) normWeights[id] = rawWeights[id] / total;

  const sorted = SCHOOL_IDS.map(id => ({ id, w: normWeights[id] })).sort((a, b) => b.w - a.w);
  const primary = sorted[0];
  const secondary = sorted[1];

  let status: string;
  if (primary.id === 'hybrid' && primary.w < 0.35) {
    status = 'hybrid';
  } else if (primary.w > 0.45) {
    status = 'confirmed';
  } else if (primary.w > 0.35) {
    status = 'tentative';
  } else {
    status = 'hybrid';
  }

  const primaryDef = SCHOOLS.find(s => s.id === primary.id)!;
  const secondaryDef = SCHOOLS.find(s => s.id === secondary.id)!;

  const reasoning = buildSchoolReasoning(primaryDef, normWeights, ctx, asset, tf, regime);

  return {
    primary: {
      id: primary.id, name: primaryDef.name, nameEn: primaryDef.nameEn,
      weight: Math.round(primary.w * 100) / 100,
      confidence: ctx.confidence > 0.75 ? 'high' : ctx.confidence > 0.5 ? 'medium' : 'low',
      status, reasoning,
    },
    secondary: {
      id: secondary.id, name: secondaryDef.name,
      weight: Math.round(secondary.w * 100) / 100,
      reasoning: `مکتب ${secondaryDef.name} با وزن ${toPersianNum(secondary.w)} به عنوان مکتب مکمل انتخاب شد`,
    },
    all_schools: Object.fromEntries(SCHOOL_IDS.map(id => [id, Math.round(normWeights[id] * 100) / 100])),
  };
}

function buildSchoolReasoning(s: SchoolDef, w: Record<string, number>, ctx: MSLV4Context, asset: string, tf: string, regime: string): string[] {
  const r: string[] = [];
  const pc = ctx.pattern_counts?.classical ?? 0;
  const phc = ctx.pattern_counts?.harmonic ?? 0;
  const ec = ctx.pattern_counts?.elliott ?? 0;
  if (s.id === 'classical' && pc >= 2) r.push(`تشخیص ${toPersianNum(pc)} الگوی کلاسیک`);
  if (s.id === 'oscillator' && ctx.divergence_present) r.push('واگرایی تشخیص داده شده');
  if (s.id === 'oscillator' && ctx.rsi !== undefined && (ctx.rsi > 70 || ctx.rsi < 30)) r.push('RSI در منطقه اشباع');
  if (s.id === 'harmonic' && phc >= 2) r.push(`تشخیص ${toPersianNum(phc)} الگوی هارمونیک`);
  if (s.id === 'elliott' && ec >= 3) r.push(`تشخیص ${toPersianNum(ec)} موج الیوت`);
  if (s.id === 'volume' && ctx.hasVolume) r.push('داده‌های حجم موجود و تأییدکننده');
  r.push(`رژیم بازار ${regime} تطابق دارد`);
  r.push(`نوع دارایی: ${asset}، تایم‌فریم: ${tf}`);
  return r;
}

// ═══════════════════════════════════════════════════════════════
// Style Selection
// ═══════════════════════════════════════════════════════════════

function selectStyles(primarySchoolId: SchoolId, ctx: MSLV4Context) {
  const scores: Record<StyleId, number> = {} as Record<StyleId, number>;
  const audience = ctx.audience_level ?? 'pro';
  const pt = ctx.probTrend;

  for (const style of STYLES) {
    const compatibility = SS_MATRIX[primarySchoolId]?.[style.id] ?? 0.5;
    const audienceMatch = getAudienceMatch(style.id, audience);
    const marketMatch = getMarketContextMatch(style.id, ctx);
    const schoolMatch = SS_MATRIX[primarySchoolId]?.[style.id] ?? 0.5;

    // Probability trend influence on style (cumulative weighted 2x)
    let trendStyleBonus = 0;
    if (pt) {
      const cumDir = pt.bullGroupDir === 'rising' ? 1 : pt.bearGroupDir === 'rising' ? -1 : 0;
      const indivDir = pt.dominantIndivDir === 'rising' ? 1 : pt.dominantIndivDir === 'falling' ? -1 : 0;
      const trendSignal = cumDir * 0.67 + indivDir * 0.33; // cumulative 2x weight

      if (style.id === 'forecasting' && Math.abs(trendSignal) > 0.5) trendStyleBonus = 0.1;
      if (style.id === 'trading' && Math.abs(trendSignal) > 0.3) trendStyleBonus = 0.08;
      if (style.id === 'analytical' && Math.abs(trendSignal) < 0.3) trendStyleBonus = 0.08;
      if (style.id === 'executive' && (pt.bullGroupDir === 'stable' || pt.bearGroupDir === 'stable')) trendStyleBonus = 0.05;
    }

    scores[style.id] = compatibility * 0.35 + audienceMatch * 0.25 + marketMatch * 0.2 + schoolMatch * 0.1 + trendStyleBonus;
  }

  const sorted = (Object.entries(scores) as [StyleId, number][]).sort((a, b) => b[1] - a[1]);
  const [pId, pScore] = sorted[0];
  const [sId, sScore] = sorted[1];
  const pDef = STYLES.find(s => s.id === pId)!;
  const sDef = STYLES.find(s => s.id === sId)!;

  return {
    primary: {
      id: pId, name: pDef.name, nameEn: pDef.nameEn,
      score: Math.round(pScore * 100) / 100,
      detail_level: pDef.detailLevel, length: pDef.length, focus: pDef.focus,
      reasoning: buildStyleReasoning(pDef, primarySchoolId, ctx),
    },
    secondary: { id: sId, name: sDef.name, score: Math.round(sScore * 100) / 100 },
  };
}

function getAudienceMatch(styleId: StyleId, audience: string): number {
  const map: Record<string, Record<StyleId, number>> = {
    pro:    { executive: 0.9, analytical: 1.0, forecasting: 0.8, trading: 0.9, educational: 0.3 },
    mid:    { executive: 0.7, analytical: 0.8, forecasting: 0.7, trading: 0.8, educational: 0.6 },
    begin:  { executive: 0.4, analytical: 0.5, forecasting: 0.4, trading: 0.5, educational: 1.0 },
  };
  const level = audience.includes('begin') || audience.includes('مبتدی') ? 'begin'
    : audience.includes('mid') || audience.includes('متوسط') ? 'mid' : 'pro';
  return map[level]?.[styleId] ?? 0.6;
}

function getMarketContextMatch(styleId: StyleId, ctx: MSLV4Context): number {
  let score = 0.5;
  const isBull = ctx.regime.includes('Bull');
  const isBear = ctx.regime.includes('Bear');
  if (styleId === 'executive' && ctx.confidence > 0.7) score = 0.9;
  if (styleId === 'trading' && (isBull || isBear) && ctx.trend_strength > 0.5) score = 0.9;
  if (styleId === 'forecasting' && ctx.confidence > 0.5) score = 0.8;
  if (styleId === 'analytical' && ctx.confidence > 0.5) score = 0.85;
  if (styleId === 'educational' && ctx.confidence < 0.5) score = 0.85;
  return score;
}

function buildStyleReasoning(s: StyleDef, schoolId: SchoolId, ctx: MSLV4Context): string[] {
  const r: string[] = [];
  const schoolName = SCHOOLS.find(x => x.id === schoolId)?.name ?? '';
  r.push(`مکتب ${schoolName} نیاز به تحلیل ${s.focus === 'decision' ? 'تصمیم‌محور' : s.focus === 'analysis' ? 'دقیق' : s.focus === 'forecast' ? 'پیش‌بینی' : s.focus === 'action' ? 'عملیاتی' : 'آموزشی'} دارد`);
  if (ctx.confidence > 0.7) r.push(`اطمینان کلی ${toPersianNum(ctx.confidence)} (بالا)`);
  else if (ctx.confidence > 0.5) r.push(`اطمینان کلی ${toPersianNum(ctx.confidence)} (متوسط)`);
  return r;
}

// ═══════════════════════════════════════════════════════════════
// Tone Selection
// ═══════════════════════════════════════════════════════════════

function selectTones(schoolId: SchoolId, styleId: StyleId, ctx: MSLV4Context) {
  const scores: Record<ToneId, number> = {} as Record<ToneId, number>;
  const pt = ctx.probTrend;

  for (const tone of TONES) {
    const condMatch = checkToneConditions(tone.id, ctx);
    const schoolMatch = ST_MATRIX[schoolId]?.[tone.id] ?? 0.5;
    const styleMatch = STYLE_TONE_MATRIX[styleId]?.[tone.id] ?? 0.5;
    const intensity = 0.5 + ctx.confidence * 0.3 + ctx.volatility * 0.2;

    // Probability trend influence on tone (cumulative weighted 2x)
    let trendToneBonus = 0;
    if (pt) {
      const cumDir = pt.bullGroupDir === 'rising' ? 1 : pt.bearGroupDir === 'rising' ? -1 : 0;
      const indivDir = pt.dominantIndivDir === 'rising' ? 1 : pt.dominantIndivDir === 'falling' ? -1 : 0;
      const trendSignal = cumDir * 0.67 + indivDir * 0.33;

      // Cumulative trend overrides basic regime check
      if (tone.id === 'optimistic' && pt.bullGroupDir === 'rising' && (pt.bullGroupChange7d ?? 0) > 0.05) {
        trendToneBonus = 0.15;
      }
      if (tone.id === 'warning' && pt.bearGroupDir === 'rising' && (pt.bearGroupChange7d ?? 0) > 0.05) {
        trendToneBonus = 0.15;
      }
      if (tone.id === 'conservative' && pt.neutralGroupDir === 'stable' && (pt.neutralGroupCum ?? 0) > 0.15) {
        trendToneBonus = 0.12;
      }
      if (tone.id === 'aggressive' && Math.abs(trendSignal) > 0.67 && Math.abs(pt.bullGroupChange7d ?? 0) > 0.1) {
        trendToneBonus = 0.1;
      }
      if (tone.id === 'realistic' && (pt.bullGroupDir === 'volatile' || pt.bearGroupDir === 'volatile')) {
        trendToneBonus = 0.12;
      }
    }

    scores[tone.id] = condMatch * 0.4 + schoolMatch * 0.15 + styleMatch * 0.15 + Math.min(intensity, 1) * 0.1 + trendToneBonus;
  }

  const sorted = (Object.entries(scores) as [ToneId, number][]).sort((a, b) => b[1] - a[1]);
  const [pId, pScore] = sorted[0];
  const [sId, sScore] = sorted[1];
  const pDef = TONES.find(t => t.id === pId)!;
  const sDef = TONES.find(t => t.id === sId)!;
  const intensity = calcIntensity(pId, ctx);

  return {
    primary: {
      id: pId, name: pDef.name, nameEn: pDef.nameEn,
      score: Math.round(pScore * 100) / 100,
      intensity, keywords: pDef.keywords.slice(0, 3),
      reasoning: buildToneReasoning(pDef, ctx),
    },
    secondary: { id: sId, name: sDef.name, score: Math.round(sScore * 100) / 100 },
  };
}

function checkToneConditions(toneId: ToneId, ctx: MSLV4Context): number {
  const isBull = ctx.regime.includes('Bull');
  const isBear = ctx.regime.includes('Bear');
  const pt = ctx.probTrend;

  switch (toneId) {
    case 'conservative': {
      let s = ctx.confidence < 0.6 ? 0.9 : ctx.volatility > 0.03 ? 0.7 : 0.4;
      if (pt?.neutralGroupDir === 'stable' && (pt.neutralGroupCum ?? 0) > 0.3) s = Math.max(s, 0.85);
      if (pt?.neutralGroupDir === 'rising' && (pt.neutralGroupCum ?? 0) > 0.25) s = Math.max(s, 0.8);
      return s;
    }
    case 'aggressive': {
      let s = ctx.confidence > 0.8 && isBull ? 0.9 : ctx.confidence > 0.7 ? 0.6 : 0.3;
      if (pt?.bullGroupDir === 'rising' && (pt.bullGroupChange7d ?? 0) > 0.08) s = Math.max(s, 0.85);
      if (pt?.bearGroupDir === 'rising' && (pt.bearGroupChange7d ?? 0) > 0.08) s = Math.max(s, 0.8);
      return s;
    }
    case 'balanced': {
      let s = ctx.confidence >= 0.6 && ctx.confidence <= 0.8 ? 0.9 : 0.5;
      if (pt?.bullGroupDir === 'stable' && pt.bearGroupDir === 'stable') s = Math.max(s, 0.85);
      return s;
    }
    case 'warning': {
      let s = ctx.divergence_present ? 0.9 : isBear && ctx.volatility > 0.03 ? 0.8 : 0.3;
      if (pt?.bearGroupDir === 'rising' && (pt.bearGroupChange7d ?? 0) > 0.05) s = Math.max(s, 0.85);
      if (pt?.bullGroupDir === 'falling' && (pt.bullGroupChange7d ?? 0) < -0.05) s = Math.max(s, 0.8);
      return s;
    }
    case 'optimistic': {
      let s = isBull && ctx.confidence > 0.7 ? 0.9 : isBull ? 0.5 : 0.2;
      if (pt?.bullGroupDir === 'rising' && (pt.bullGroupChange7d ?? 0) > 0.05) s = Math.max(s, 0.85);
      if (pt?.bearGroupDir === 'falling' && (pt.bearGroupChange7d ?? 0) < -0.03) s = Math.max(s, 0.7);
      return s;
    }
    case 'realistic': {
      let s = ctx.confidence >= 0.4 && ctx.confidence <= 0.7 ? 0.9 : 0.5;
      if (pt?.bullGroupDir === 'volatile' || pt?.bearGroupDir === 'volatile') s = Math.max(s, 0.9);
      return s;
    }
    default: return 0.5;
  }
}

function calcIntensity(toneId: ToneId, ctx: MSLV4Context): string {
  const base = ctx.confidence + ctx.volatility;
  if (toneId === 'warning') return base > 0.9 ? 'high' : base > 0.6 ? 'medium' : 'low';
  if (toneId === 'aggressive' || toneId === 'optimistic') return base > 0.85 ? 'high' : base > 0.55 ? 'medium' : 'low';
  if (toneId === 'conservative') return ctx.volatility > 0.03 ? 'high' : ctx.volatility > 0.015 ? 'medium' : 'low';
  return base > 0.8 ? 'medium-high' : base > 0.5 ? 'medium' : 'low';
}

function buildToneReasoning(t: ToneDef, ctx: MSLV4Context): string[] {
  const r: string[] = [];
  r.push(`اطمینان کلی = ${toPersianNum(ctx.confidence)}`);
  r.push(`رژیم بازار = ${ctx.regime}`);
  r.push(`نوسان = ${ctx.volatility > 0.03 ? 'بالا' : ctx.volatility > 0.01 ? 'متوسط' : 'پایین'} (ATR/Price = ${toPersianNum(ctx.volatility)})`);
  if (ctx.divergence_present) r.push('واگرایی تشخیص داده شده');
  return r;
}

// ═══════════════════════════════════════════════════════════════
// Main Export: selectMSLV4
// ═══════════════════════════════════════════════════════════════

export function selectMSLV4(ctx: MSLV4Context): MSLV4Result {
  const schools = selectSchools(ctx);
  const primarySchoolId = schools.primary.id as SchoolId;
  const styles = selectStyles(primarySchoolId, ctx);
  const primaryStyleId = styles.primary.id as StyleId;
  const tones = selectTones(primarySchoolId, primaryStyleId, ctx);

  const schoolDef = SCHOOLS.find(s => s.id === primarySchoolId)!;
  const styleDef = STYLES.find(s => s.id === primaryStyleId)!;
  const toneDef = TONES.find(t => t.id === tones.primary.id)!;

  const combinedConfidence = Math.round((ctx.confidence * 0.6 + schools.primary.weight * 0.4) * 100) / 100;

  const keyFactors = [
    { factor: 'رژیم بازار', impact: 0.25 },
    { factor: 'نوع دارایی', impact: 0.20 },
    { factor: 'اطمینان کلی', impact: 0.20 },
    { factor: 'تایم‌فریم', impact: 0.15 },
    { factor: 'نوسانات', impact: 0.10 },
    { factor: 'الگوهای تشخیص‌داده‌شده', impact: 0.10 },
  ];

  return {
    school_of_analysis: schools,
    analysis_style: styles,
    analysis_tone: tones,
    final_combination: {
      statement: `تحلیل بر اساس ${schoolDef.name} با ${styleDef.name} و ${toneDef.name}`,
      confidence: combinedConfidence,
      recommendation: `مناسب برای تحلیل‌های ${styleDef.focus === 'decision' ? 'تصمیم‌گیری' : styleDef.focus === 'analysis' ? 'تحلیلی حرفه‌ای' : styleDef.focus === 'forecast' ? 'پیش‌بینی آینده' : styleDef.focus === 'action' ? 'معاملاتی عملیاتی' : 'آموزشی'} با لحن ${toneDef.name}`,
    },
    interpretability: { key_factors: keyFactors },
  };
}

// ═══════════════════════════════════════════════════════════════
// Prompt Generation (Persian)
// ═══════════════════════════════════════════════════════════════

export function buildMSLV4PromptSection(result: MSLV4Result): string {
  const { primary: sp } = result.school_of_analysis;
  const { primary: sy } = result.analysis_style;
  const { primary: tn } = result.analysis_tone;
  const schoolDef = SCHOOLS.find(s => s.id === sp.id);
  const styleDef = STYLES.find(s => s.id === sy.id);
  const toneDef = TONES.find(t => t.id === tn.id);

  const weightStr = toPersianNum(sp.weight);
  const detailStr = sy.detail_level === 'high' ? 'جزئیات بالا' : sy.detail_level === 'low' ? 'مختصر' : 'جزئیات متوسط';
  const intensityStr = tn.intensity === 'high' ? 'شدت بالا' : tn.intensity === 'medium-high' ? 'شدت متوسط-بالا' : tn.intensity === 'medium' ? 'شدت متوسط' : 'شدت پایین';
  const kwStr = tn.keywords.join('، ');

  return [
    `مکتب تحلیل شما: ${sp.name} با وزن ${weightStr}`,
    `سبک تحلیل شما: ${sy.name} با ${detailStr}`,
    `لحن تحلیل شما: ${tn.name} با ${intensityStr}`,
    '',
    `قواعد مکتب: ${schoolDef?.prompt ?? ''}`,
    '',
    `قواعد سبک: ${styleDef?.prompt ?? ''}`,
    '',
    `قواعد لحن: ${toneDef?.prompt ?? ''}`,
    '',
    `کلمات کلیدی لحن: ${kwStr}`,
    '',
    `ترکیب نهایی: ${result.final_combination.statement}`,
    `اطمینان ترکیب: ${toPersianNum(result.final_combination.confidence)}`,
  ].join('\n');
}
