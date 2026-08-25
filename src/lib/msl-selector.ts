/**
 * MSL Auto-Selection System — School / Style / Tone
 *
 * Scoring-based selection engine that evaluates 6 analysis schools,
 * 5 narrative styles, and 6 analytical tones based on market data.
 * Each dimension is scored independently; the highest-scoring option wins.
 */

// ═══════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════

export interface School {
  id: string;
  name: string;       // Persian
  nameEn: string;     // English
  description: string; // Persian
  audience: string;    // When this school is preferred
}

export interface Style {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  audience: string;
}

export interface Tone {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  conditions: string; // When this tone is preferred
}

export interface MSLContext {
  indicators: {
    rsi: number;
    macdHist: number;
    adx: number;
    cci: number;
    mfi: number;
    atr: number;
    stochK: number;
    stochD: number;
    diPlus: number;
    diMinus: number;
    sar: number;
    bbWidth: number;
  };
  hasVolume: boolean;
  classicPatternCount: number;
  classicPatternConfidence: number;
  divergenceCount: number;
  divergenceStrength: 'strong' | 'medium' | 'weak';
  srLevelStrength: number;
  harmonicPatternCount: number;
  harmonicConfidence: number;
  fibonacciPrecision: number;
  elliottWaveCount: number;
  overallConfidence: number;
  volatilityLevel: 'low' | 'medium' | 'high';
  trendStrength: 'strong' | 'moderate' | 'weak' | 'none';
  dominantDirection: 'bullish' | 'bearish' | 'neutral';
}

export interface MSLResult {
  school: School;
  style: Style;
  tone: Tone;
  schoolScores: Record<string, number>;
  styleScores: Record<string, number>;
  toneScores: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// 6 Analysis Schools (مکتب تحلیل)
// ═══════════════════════════════════════════════════════════════

export const SCHOOLS: School[] = [
  {
    id: 'classical',
    name: 'مکتب کلاسیک',
    nameEn: 'Classical',
    description: 'تأکید بر حمایت/مقاومت، الگوهای کلاسیک (سر و شانه، مثلث، پرچم)، خطوط روند',
    audience: 'حداقل ۲ الگوی کلاسیک با اطمینان > ۰.۶، سطوح حمایت/مقاومت قوی با قدرت > ۳، روند واضح از طریق خطوط روند، نسبت الگوهای کلاسیک > ۰.۴',
  },
  {
    id: 'oscillator',
    name: 'مکتب اسیلاتوری',
    nameEn: 'Oscillator',
    description: 'تأکید بر اندیکاتورهای مومنتوم (RSI، MACD، استوکاستیک)، واگرایی‌ها، اشباع خرید/فروش',
    audience: 'حداقل ۳ واگرایی با قدرت > متوسط، RSI در مناطق شدید (>۷۰ یا <۳۰)، هیستوگرام MACD قابل توجه، ADX بین ۲۰-۴۰',
  },
  {
    id: 'volume',
    name: 'مکتب حجم و عرضه/تقاضا',
    nameEn: 'Volume',
    description: 'تأکید بر حجم معاملات، OBV، تجمع/توزیع، VWAP، مناطق عرضه و تقاضا',
    audience: 'داده‌های حجم موجود، حجم در سطوح کلیدی > میانگین ۲۰ روزه، OBV هم‌راستا با قیمت یا واگرا، حداقل ۳ اندیکاتور حجمی سیگنال قوی',
  },
  {
    id: 'harmonic',
    name: 'مکتب هارمونیک',
    nameEn: 'Harmonic',
    description: 'تأکید بر الگوهای هارمونیک (gartley، bat، crab)، نسبت‌های فیبوناچی، مناطق PRZ',
    audience: 'حداقل ۲ الگوی هارمونیک با اطمینان > ۰.۶، نسبت‌های فیبوناچی دقیق (تلورانس < ۰.۰۵)، PRZ با حداقل ۳ تلاقی فیبوناچی، واگرایی در PRZ',
  },
  {
    id: 'hybrid',
    name: 'مکتب ترکیبی',
    nameEn: 'Hybrid',
    description: 'ترکیب مکاتب متعدد، وزن‌دهی هوشمند، انطباق با شرایط بازار',
    audience: 'هیچ مکتب دیگری غالب نیست (وزن < ۰.۴)، ترکیب متعادل، رژیم بازار نامشخص یا در حال تغییر، اطمینان کلی ۰.۴-۰.۶',
  },
  {
    id: 'elliott',
    name: 'مکتب الیوت',
    nameEn: 'Elliott Wave',
    description: 'تأکید بر الگوهای موج الیوت (انگیزشی، زیگزاگ، تخت)، نسبت‌های فیبوناچی بین امواج، ساختار ۵-۳ موجی',
    audience: 'حداقل ۵ موج متوالی شناسایی شده، نسبت‌های فیبوناچی دقیق، واگرایی در انتهای موج ۵، ADX > ۲۵',
  },
];

// ═══════════════════════════════════════════════════════════════
// 5 Analysis Styles (سبک تحلیل)
// ═══════════════════════════════════════════════════════════════

export const STYLES: Style[] = [
  {
    id: 'executive',
    name: 'اجرایی و تصمیم‌گیری',
    nameEn: 'Executive',
    description: 'مختصر، متمرکز بر تصمیم، تأکید بر EMV و مدیریت ریسک',
    audience: 'مدیران ارشد، سرمایه‌گذاران نهادی',
  },
  {
    id: 'technical',
    name: 'تحلیلی-تکنیکال',
    nameEn: 'Technical',
    description: 'جزئیات کامل تکنیکال، تمام اندیکاتورها و الگوها، نمودارها',
    audience: 'تحلیلگران حرفه‌ای، معامله‌گران فعال',
  },
  {
    id: 'predictive',
    name: 'پیش‌بینی و آینده‌نگر',
    nameEn: 'Predictive',
    description: 'تأکید بر پیش‌بینی آینده، سناریوها با احتمالات',
    audience: 'برنامه‌ریزان استراتژیک، مدیران صندوق',
  },
  {
    id: 'trading',
    name: 'معاملاتی و عملیاتی',
    nameEn: 'Trading',
    description: 'تأکید بر نقاط ورود/خروج، مدیریت ریسک عملیاتی',
    audience: 'معامله‌گران روزانه، تیم‌های اجرایی',
  },
  {
    id: 'educational',
    name: 'آموزشی-تفسیری',
    nameEn: 'Educational',
    description: 'توضیح مفاهیم به سادگی، تفسیر سیگنال‌ها با مثال',
    audience: 'سرمایه‌گذاران مبتدی، مربیان بازار',
  },
];

// ═══════════════════════════════════════════════════════════════
// 6 Analysis Tones (لحن تحلیل)
// ═══════════════════════════════════════════════════════════════

export const TONES: Tone[] = [
  {
    id: 'conservative',
    name: 'محافظه‌کارانه',
    nameEn: 'Conservative',
    description: 'تأکید بر مدیریت ریسک، محتاط، حجم کوچک‌تر',
    conditions: 'اطمینان کلی < ۰.۶، نوسانات بالا',
  },
  {
    id: 'aggressive',
    name: 'تهاجمی',
    nameEn: 'Aggressive',
    description: 'تأکید بر فرصت‌های سود، ورود سریع، حجم بزرگ‌تر',
    conditions: 'اطمینان کلی > ۰.۸، روند قوی',
  },
  {
    id: 'balanced',
    name: 'متعادل',
    nameEn: 'Balanced',
    description: 'ترکیب فرصت و ریسک، منطقی، مبتنی بر داده',
    conditions: 'اطمینان ۰.۶-۰.۸، سیگنال‌های مختلط',
  },
  {
    id: 'warning',
    name: 'هشداردهنده',
    nameEn: 'Warning',
    description: 'تأکید بر خطرات، هشدار بازگشت، توصیه خروج',
    conditions: 'واگرایی قوی، نزدیکی به سطوح کلیدی',
  },
  {
    id: 'optimistic',
    name: 'خوش‌بینانه',
    nameEn: 'Optimistic',
    description: 'تأکید بر فرصت‌های رشد، اعتماد به روند صعودی',
    conditions: 'روند صعودی قوی، پیش‌بینی‌های مثبت',
  },
  {
    id: 'realistic',
    name: 'واقع‌گرایانه',
    nameEn: 'Realistic',
    description: 'پذیرش عدم قطعیت، سناریوهای چندگانه با احتمالات',
    conditions: 'اطمینان متوسط، ابهام در بازار',
  },
];

// ═══════════════════════════════════════════════════════════════
// Helper: strength → numeric
// ═══════════════════════════════════════════════════════════════

function divergenceToNumeric(strength: string): number {
  if (strength === 'strong') return 1.0;
  if (strength === 'medium') return 0.5;
  return 0.2;
}

function trendToNumeric(strength: string): number {
  if (strength === 'strong') return 1.0;
  if (strength === 'moderate') return 0.6;
  if (strength === 'weak') return 0.3;
  return 0.0;
}

function volatilityToNumeric(level: string): number {
  if (level === 'high') return 1.0;
  if (level === 'medium') return 0.5;
  return 0.0;
}

// ═══════════════════════════════════════════════════════════════
// School Scoring
// ═══════════════════════════════════════════════════════════════

export function selectSchool(ctx: MSLContext): { school: School; scores: Record<string, number> } {
  const ind = ctx.indicators;
  const scores: Record<string, number> = {};

  // ── classical ──
  let c = 0;
  if (ctx.classicPatternCount >= 2 && ctx.classicPatternConfidence > 0.6) c += 3;
  else if (ctx.classicPatternCount >= 1 && ctx.classicPatternConfidence > 0.4) c += 1.5;
  if (ctx.srLevelStrength > 3) c += 2;
  else if (ctx.srLevelStrength > 1) c += 1;
  if (ctx.trendStrength === 'strong' || ctx.trendStrength === 'moderate') c += 1.5;
  if (ctx.trendStrength === 'none') c += 0.5;
  scores['classical'] = c;

  // ── oscillator ──
  let o = 0;
  const divNum = divergenceToNumeric(ctx.divergenceStrength);
  if (ctx.divergenceCount >= 3 && divNum >= 0.5) o += 3;
  else if (ctx.divergenceCount >= 2) o += 1.5;
  else if (ctx.divergenceCount >= 1) o += 0.5;
  if (ind.rsi > 70 || ind.rsi < 30) o += 2.5;
  else if (ind.rsi > 60 || ind.rsi < 40) o += 1;
  if (Math.abs(ind.macdHist) > 0) o += 1;
  if (ind.adx >= 20 && ind.adx <= 40) o += 1.5;
  else if (ind.adx > 40) o += 0.5;
  if (ind.stochK > 80 || ind.stochK < 20) o += 1;
  scores['oscillator'] = o;

  // ── volume ──
  let v = 0;
  if (ctx.hasVolume) v += 2;
  else v -= 5; // strong penalty when no volume data
  if (ind.mfi > 70 || ind.mfi < 30) v += 1.5;
  if (ind.mfi > 60 || ind.mfi < 40) v += 0.5;
  // Bonus for volume-related context signals (OBV, A/D are derived from price-volume)
  if (ctx.hasVolume && ctx.trendStrength === 'strong') v += 1;
  if (ctx.hasVolume && ctx.divergenceCount >= 2) v += 1;
  scores['volume'] = v;

  // ── harmonic ──
  let h = 0;
  if (ctx.harmonicPatternCount >= 2 && ctx.harmonicConfidence > 0.6) h += 3;
  else if (ctx.harmonicPatternCount >= 1 && ctx.harmonicConfidence > 0.4) h += 1.5;
  if (ctx.fibonacciPrecision < 0.05) h += 2.5;
  else if (ctx.fibonacciPrecision < 0.1) h += 1;
  if (ctx.harmonicPatternCount >= 2 && ctx.divergenceCount >= 1) h += 1.5;
  scores['harmonic'] = h;

  // ── elliott ──
  let e = 0;
  if (ctx.elliottWaveCount >= 5) e += 3;
  else if (ctx.elliottWaveCount >= 3) e += 1.5;
  else if (ctx.elliottWaveCount >= 1) e += 0.5;
  if (ctx.fibonacciPrecision < 0.05 && ctx.elliottWaveCount >= 3) e += 2;
  if (ctx.divergenceCount >= 1 && ctx.elliottWaveCount >= 3) e += 1.5;
  if (ind.adx > 25 && ctx.elliottWaveCount >= 3) e += 1;
  scores['elliott'] = e;

  // ── hybrid (default / fallback) ──
  // hybrid gets a base score; it wins when no other school is dominant
  let hy = 1; // base score ensures it's always a candidate
  if (ctx.overallConfidence >= 0.4 && ctx.overallConfidence <= 0.6) hy += 1.5;
  if (ctx.trendStrength === 'weak' || ctx.trendStrength === 'none') hy += 1;
  if (ctx.volatilityLevel === 'medium') hy += 0.5;
  scores['hybrid'] = hy;

  // ── Select highest ──
  let bestId = 'hybrid';
  let bestScore = scores['hybrid'];
  for (const [id, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  const school = SCHOOLS.find(s => s.id === bestId) ?? SCHOOLS[4]; // fallback to hybrid
  return { school, scores };
}

// ═══════════════════════════════════════════════════════════════
// Style Scoring
// ═══════════════════════════════════════════════════════════════

export function selectStyle(
  ctx: MSLContext,
  school: School,
): { style: Style; scores: Record<string, number> } {
  const ind = ctx.indicators;
  const scores: Record<string, number> = {};

  // ── executive: concise, decision-focused, EMV/risk emphasis ──
  let ex = 0;
  // High confidence + strong trend → decision is clearer → executive style fits
  if (ctx.overallConfidence > 0.7) ex += 1.5;
  if (ctx.trendStrength === 'strong') ex += 1;
  if (school.id === 'hybrid') ex += 0.5; // hybrid → executive summary is natural
  // Low complexity (few patterns) → brief executive style
  if (ctx.classicPatternCount <= 1 && ctx.harmonicPatternCount === 0 && ctx.elliottWaveCount === 0) ex += 1;
  scores['executive'] = ex;

  // ── technical: full details, all indicators, charts ──
  let te = 0;
  // Many patterns detected → technical detail is valuable
  const totalPatterns = ctx.classicPatternCount + ctx.harmonicPatternCount + ctx.elliottWaveCount;
  if (totalPatterns >= 3) te += 2;
  else if (totalPatterns >= 1) te += 1;
  // Moderate to strong trend with clear indicators → technical analysis shines
  if (ctx.trendStrength !== 'none') te += 1;
  // Multiple divergences → oscillator detail needed
  if (ctx.divergenceCount >= 2) te += 1;
  // Classical or Elliott schools pair well with technical style
  if (school.id === 'classical' || school.id === 'elliott') te += 1.5;
  if (school.id === 'oscillator' || school.id === 'harmonic') te += 0.5;
  scores['technical'] = te;

  // ── predictive: future predictions, scenario probabilities ──
  let pr = 0;
  // Elliott and harmonic → inherently predictive
  if (school.id === 'elliott') pr += 2;
  if (school.id === 'harmonic') pr += 1.5;
  // High confidence in predictions
  if (ctx.overallConfidence > 0.6) pr += 1;
  // Clear trend → more predictable
  if (ctx.trendStrength === 'strong' || ctx.trendStrength === 'moderate') pr += 1;
  // Precise Fibonacci → predictive power
  if (ctx.fibonacciPrecision < 0.1) pr += 0.5;
  scores['predictive'] = pr;

  // ── trading: entry/exit, operational risk ──
  let tr = 0;
  // Strong trend → clear entry/exit
  if (ctx.trendStrength === 'strong') tr += 2;
  else if (ctx.trendStrength === 'moderate') tr += 1;
  // Volume school → trading focused
  if (school.id === 'volume') tr += 2;
  if (school.id === 'oscillator') tr += 1;
  // High volatility → operational risk management matters
  if (ctx.volatilityLevel === 'high') tr += 1;
  // ADX > 25 → trending market, good for trading
  if (ind.adx > 25) tr += 1;
  scores['trading'] = tr;

  // ── educational: explain concepts, interpret with examples ──
  let ed = 0;
  // Weak/no trend → educational explanation is more useful than trading signals
  if (ctx.trendStrength === 'none' || ctx.trendStrength === 'weak') ed += 1.5;
  // Mixed signals → explain what's happening
  if (ctx.overallConfidence < 0.5) ed += 1;
  // Low pattern count → room to explain basics
  if (totalPatterns === 0) ed += 1;
  // Hybrid school → educational (explaining multiple methods)
  if (school.id === 'hybrid') ed += 1;
  scores['educational'] = ed;

  // ── Select highest ──
  let bestId = 'technical';
  let bestScore = scores['technical'];
  for (const [id, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  const style = STYLES.find(s => s.id === bestId) ?? STYLES[1]; // fallback to technical
  return { style, scores };
}

// ═══════════════════════════════════════════════════════════════
// Tone Scoring
// ═══════════════════════════════════════════════════════════════

export function selectTone(ctx: MSLContext): { tone: Tone; scores: Record<string, number> } {
  const ind = ctx.indicators;
  const scores: Record<string, number> = {};

  const trendNum = trendToNumeric(ctx.trendStrength);
  const volNum = volatilityToNumeric(ctx.volatilityLevel);

  // ── conservative: risk management, cautious ──
  let co = 0;
  if (ctx.overallConfidence < 0.6) co += 2;
  if (ctx.volatilityLevel === 'high') co += 2;
  if (ctx.volatilityLevel === 'medium') co += 0.5;
  if (ctx.trendStrength === 'none') co += 1;
  // Bearish → more cautious
  if (ctx.dominantDirection === 'bearish') co += 0.5;
  scores['conservative'] = co;

  // ── aggressive: profit opportunities, quick entry, larger size ──
  let ag = 0;
  if (ctx.overallConfidence > 0.8) ag += 2.5;
  else if (ctx.overallConfidence > 0.7) ag += 1;
  if (ctx.trendStrength === 'strong') ag += 2;
  if (ctx.dominantDirection === 'bullish' && ctx.trendStrength === 'strong') ag += 1.5;
  if (ind.adx > 30) ag += 1;
  // Low volatility → can be more aggressive
  if (ctx.volatilityLevel === 'low') ag += 0.5;
  scores['aggressive'] = ag;

  // ── balanced: opportunity + risk, logical ──
  let ba = 0;
  if (ctx.overallConfidence >= 0.6 && ctx.overallConfidence <= 0.8) ba += 2;
  else if (ctx.overallConfidence > 0.5) ba += 0.5;
  if (ctx.trendStrength === 'moderate') ba += 1.5;
  if (ctx.volatilityLevel === 'medium') ba += 1;
  if (ctx.dominantDirection === 'neutral') ba += 0.5;
  scores['balanced'] = ba;

  // ── warning: dangers, reversal warnings, exit recs ──
  let wa = 0;
  if (ctx.divergenceCount >= 2 && ctx.divergenceStrength === 'strong') wa += 3;
  else if (ctx.divergenceCount >= 1 && ctx.divergenceStrength === 'strong') wa += 2;
  else if (ctx.divergenceCount >= 1) wa += 0.5;
  // Overbought in uptrend → reversal warning
  if (ind.rsi > 75 && ctx.dominantDirection === 'bullish') wa += 2;
  // Oversold in downtrend → potential capitulation warning
  if (ind.rsi < 25 && ctx.dominantDirection === 'bearish') wa += 1.5;
  // High volatility + bearish
  if (ctx.volatilityLevel === 'high' && ctx.dominantDirection === 'bearish') wa += 1.5;
  // Near key levels (high SR strength)
  if (ctx.srLevelStrength > 3) wa += 1;
  scores['warning'] = wa;

  // ── optimistic: growth opportunities, trusts uptrend ──
  let op = 0;
  if (ctx.dominantDirection === 'bullish' && ctx.trendStrength === 'strong') op += 3;
  else if (ctx.dominantDirection === 'bullish') op += 1;
  if (ctx.overallConfidence > 0.7) op += 1;
  if (ind.rsi > 50 && ind.rsi < 70) op += 0.5; // healthy uptrend zone
  if (ind.adx > 25 && ind.diPlus > ind.diMinus) op += 1;
  // Low volatility in uptrend = comfortable
  if (ctx.volatilityLevel !== 'high' && ctx.dominantDirection === 'bullish') op += 0.5;
  scores['optimistic'] = op;

  // ── realistic: accepts uncertainty, multiple scenarios ──
  let re = 0;
  if (ctx.overallConfidence >= 0.4 && ctx.overallConfidence <= 0.7) re += 2;
  if (ctx.trendStrength === 'weak' || ctx.trendStrength === 'none') re += 1.5;
  if (ctx.dominantDirection === 'neutral') re += 1;
  if (ctx.volatilityLevel === 'medium') re += 0.5;
  // Mixed indicators → realistic tone appropriate
  if (ctx.divergenceCount >= 1 && ctx.trendStrength !== 'none') re += 0.5;
  scores['realistic'] = re;

  // ── Select highest ──
  let bestId = 'balanced';
  let bestScore = scores['balanced'];
  for (const [id, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  const tone = TONES.find(t => t.id === bestId) ?? TONES[2]; // fallback to balanced
  return { tone, scores };
}

// ═══════════════════════════════════════════════════════════════
// Main MSL Selector
// ═══════════════════════════════════════════════════════════════

/**
 * Selects the optimal School, Style, and Tone based on market context.
 * Returns the winning selections plus full score breakdowns for all options.
 */
export function selectMSL(ctx: MSLContext): MSLResult {
  const { school, scores: schoolScores } = selectSchool(ctx);
  const { style, scores: styleScores } = selectStyle(ctx, school);
  const { tone, scores: toneScores } = selectTone(ctx);

  return { school, style, tone, schoolScores, styleScores, toneScores };
}
