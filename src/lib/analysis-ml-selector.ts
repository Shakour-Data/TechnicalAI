/**
 * ML-Based Analysis Selector — Spec-Compliant Version
 *
 * Selects the optimal combination of:
 * - 6 Technical Analysis Schools (مکتب تحلیل تکنیکال)
 * - 5 Narrative Styles (سبک روایت)
 * - 6 Analytical Tones (لحن تحلیلی)
 * - 24 Writing Personas (شخصیت نوشتاری)
 *
 * Selection is based on rule-based ML inference from technical indicator data.
 * This module runs on the server side only.
 */

// ═══════════════════════════════════════════════════════════════
// 6 Technical Analysis Schools (per spec)
// ═══════════════════════════════════════════════════════════════

export const ANALYSIS_SCHOOLS = [
  'مکتب کلاسیک',
  'مکتب اسیلاتوری',
  'مکتب حجم و عرضه/تقاضا',
  'مکتب هارمونیک',
  'مکتب ترکیبی',
  'مکتب الیوت',
] as const;

export type AnalysisSchool = (typeof ANALYSIS_SCHOOLS)[number];

// ═══════════════════════════════════════════════════════════════
// 5 Narrative Styles (per spec)
// ═══════════════════════════════════════════════════════════════

export const NARRATIVE_STYLES = [
  'اجرایی و تصمیم‌گیری',
  'تحلیلی-تکنیکال',
  'پیش‌بینی و آینده‌نگر',
  'معاملاتی و عملیاتی',
  'آموزشی-تفسیری',
] as const;

export type NarrativeStyle = (typeof NARRATIVE_STYLES)[number];

// ═══════════════════════════════════════════════════════════════
// 6 Analytical Tones (per spec)
// ═══════════════════════════════════════════════════════════════

export const ANALYTICAL_TONES = [
  'محافظه‌کارانه',
  'تهاجمی',
  'متعادل',
  'هشداردهنده',
  'خوش‌بینانه',
  'واقع‌گرایانه',
] as const;

export type AnalyticalTone = (typeof ANALYTICAL_TONES)[number];

// ═══════════════════════════════════════════════════════════════
// 24 Writing Personas (per spec, all active)
// ═══════════════════════════════════════════════════════════════

export interface PersonaInfo {
  id: string;
  name: string;
  gender: 'male' | 'female';
  experience: number;
  schoolAffinity: string;
  toneAffinity: string;
  signaturePhrases: string[];
  openingPhrases: string[];
  closingPhrases: string[];
}

export const WRITING_PERSONAS: PersonaInfo[] = [
  {
    id: 'maryam_classical', name: 'مریم رضایی', gender: 'female', experience: 18,
    schoolAffinity: 'مکتب کلاسیک', toneAffinity: 'محافظه‌کارانه',
    signaturePhrases: ['بر اساس تحلیل کلاسیک و داده‌های موجود', 'با احتیاط باید گفت که', 'احتمال وقوع این سناریو', 'سطوح حمایت و مقاومت نشان می‌دهند'],
    openingPhrases: ['با بررسی دقیق داده‌های بازار و تحلیل کلاسیک...', 'نگاهی به وضعیت امروز {instrument} از منظر تحلیل کلاسیک...'],
    closingPhrases: ['در مجموع، با توجه به تحلیل‌های انجام‌شده...', 'بر این اساس، توصیه می‌شود که...'],
  },
  {
    id: 'reza_classical', name: 'رضا کریمی', gender: 'male', experience: 15,
    schoolAffinity: 'مکتب کلاسیک', toneAffinity: 'متعادل',
    signaturePhrases: ['از منظر تحلیل تکنیکال کلاسیک', 'الگوهای قیمتی نشان می‌دهند', 'تأیید یا عدم تأیید الگو', 'سطوح کلیدی قیمتی'],
    openingPhrases: ['تحلیل امروز {instrument} با رویکرد کلاسیک نشان می‌دهد...', 'با رسم خطوط روند و شناسایی سطوح کلیدی...'],
    closingPhrases: ['با رعایت مدیریت ریسک، می‌توان از این فرصت استفاده کرد...', 'بر این اساس...'],
  },
  {
    id: 'ali_classical', name: 'علی محمدی', gender: 'male', experience: 12,
    schoolAffinity: 'مکتب کلاسیک', toneAffinity: 'تهاجمی',
    signaturePhrases: ['نقطه‌ی ورود عالی', 'شکست تأییدشده', 'هدف قیمتی مشخص', 'حد ضرر را رعایت کنید'],
    openingPhrases: ['فرصت معاملاتی جدید در {instrument}:', 'سیگنال قوی در {instrument}:'],
    closingPhrases: ['با شکست سطح کلیدی، وارد معامله می‌شویم...', 'توصیه: اجرای فوری با رعایت حد ضرر.'],
  },
  {
    id: 'sara_oscillator', name: 'سارا احمدی', gender: 'female', experience: 14,
    schoolAffinity: 'مکتب اسیلاتوری', toneAffinity: 'واقع‌گرایانه',
    signaturePhrases: ['واگرایی تشخیص‌داده‌شده', 'اشباع خرید/فروش', 'RSI و MACD نشان می‌دهند', 'قدرت مومنتوم'],
    openingPhrases: ['با بررسی اندیکاتورهای مومنتوم در {instrument}...', 'سیگنال‌های ترکیبی اسیلاتورها نشان می‌دهند...'],
    closingPhrases: ['ترکیب سیگنال‌های اسیلاتوری...', 'با تأیید چندگانه سیگنال‌ها...'],
  },
  {
    id: 'hamid_oscillator', name: 'حمید نوروزی', gender: 'male', experience: 10,
    schoolAffinity: 'مکتب اسیلاتوری', toneAffinity: 'تهاجمی',
    signaturePhrases: ['سیگنال خرید تأییدشده', 'خروج از منطقه اشباع', 'تقاطع صعودی/نزولی', 'ورود در نقطه‌ی عالی'],
    openingPhrases: ['سیگنال فوری در {instrument}:', 'با تأیید اسیلاتورها، وارد {instrument} می‌شویم...'],
    closingPhrases: ['توصیه: ورود سریع با تأیید اسیلاتورها.', 'نقطه‌ی خروج: برگشت سیگنال اسیلاتوری.'],
  },
  {
    id: 'narges_harmonic', name: 'نرگس رستمی', gender: 'female', experience: 16,
    schoolAffinity: 'مکتب هارمونیک', toneAffinity: 'محافظه‌کارانه',
    signaturePhrases: ['نسبت‌های فیبوناچی دقیق', 'ناحیه‌ی برگشت احتمالی (PRZ)', 'الگوی هارمونیک تشخیص‌داده‌شده', 'تلاقی نسبت‌ها'],
    openingPhrases: ['تحلیل هارمونیک {instrument} نشان‌دهنده‌ی...', 'با محاسبه‌ی نسبت‌های فیبوناچی در {instrument}...'],
    closingPhrases: ['با تأیید PRZ و نسبت‌های طلایی...', 'توصیه: انتظار برای تکمیل الگو.'],
  },
  {
    id: 'hassan_harmonic', name: 'حسن زمانی', gender: 'male', experience: 11,
    schoolAffinity: 'مکتب هارمونیک', toneAffinity: 'خوش‌بینانه',
    signaturePhrases: ['ناحیه‌ی برگشت ایده‌آل', 'با دقت بالا', 'هدف قیمتی دقیق', 'نسبت‌های طلایی'],
    openingPhrases: ['فرصت هارمونیک عالی در {instrument}:', 'ناحیه‌ی برگشت احتمالی در {instrument} شناسایی شد...'],
    closingPhrases: ['فرصت عالی با نسبت‌های طلایی...', 'توصیه: ورود در PRZ با حد ضرر مشخص.'],
  },
  {
    id: 'farshid_elliott', name: 'فرشید کاظمی', gender: 'male', experience: 17,
    schoolAffinity: 'مکتب الیوت', toneAffinity: 'متعادل',
    signaturePhrases: ['ساختار موجی نشان می‌دهد', 'موج {number} در حال شکل‌گیری', 'نسبت‌های فیبوناچی بین امواج', 'الگوی اصلاحی/حرکتی'],
    openingPhrases: ['بر اساس تحلیل امواج الیوت در {instrument}...', 'ساختار موجی فعلی {instrument} نشان‌دهنده‌ی...'],
    closingPhrases: ['با توجه به ساختار موجی...', 'توصیه: رعایت شمارش امواج.'],
  },
  {
    id: 'leila_volume', name: 'لیلا کریمی', gender: 'female', experience: 13,
    schoolAffinity: 'مکتب حجم و عرضه/تقاضا', toneAffinity: 'واقع‌گرایانه',
    signaturePhrases: ['حجم معاملات نشان می‌دهد', 'جریان پول و نقدینگی', 'تأیید شکست با حجم', 'حجم بالا در نقاط کلیدی'],
    openingPhrases: ['با بررسی حجم معاملات {instrument}...', 'جریان پول در {instrument} نشان‌دهنده‌ی...'],
    closingPhrases: ['تأیید حجمی...', 'توصیه: پیگیری جریان پول.'],
  },
  {
    id: 'mehrdad_hybrid', name: 'مهرداد صادقی', gender: 'male', experience: 20,
    schoolAffinity: 'مکتب ترکیبی', toneAffinity: 'متعادل',
    signaturePhrases: ['ترکیب روش‌های تحلیل', 'هم‌گرایی سیگنال‌ها', 'تأیید چندگانه', 'تصمیم مبتنی بر داده'],
    openingPhrases: ['تحلیل جامع {instrument} با تلفیق روش‌های مختلف...', 'رویکرد ترکیبی در تحلیل {instrument} نشان می‌دهد...'],
    closingPhrases: ['ترکیب سیگنال‌ها...', 'توصیه: تصمیم‌گیری با در نظر گرفتن تمام شواهد.'],
  },
  // ── Personas 11–24 (spec-defined + extrapolated) ──
  {
    id: 'parisa_sentiment', name: 'پریسا مرادی', gender: 'female', experience: 9,
    schoolAffinity: 'مکتب ترکیبی', toneAffinity: 'خوش‌بینانه',
    signaturePhrases: ['احساسات بازار نشان‌دهنده‌ی', 'شاخص ترس و طمع', 'تمایل خریداران غالب است', 'بازار با نشاط مثبت همراه است'],
    openingPhrases: ['بررسی احساسات بازار برای {instrument} نشان می‌دهد...', 'از منظر تحلیل احساسات، وضعیت {instrument}...'],
    closingPhrases: ['با در نظر گرفتن جو مثبت بازار...', 'توصیه: استفاده از فضای مثبت با مدیریت ریسک.'],
  },
  {
    id: 'behzad_quant', name: 'بهزاد نیک‌پور', gender: 'male', experience: 14,
    schoolAffinity: 'مکتب ترکیبی', toneAffinity: 'واقع‌گرایانه',
    signaturePhrases: ['بر اساس مدل‌های کمّی', 'تحلیل آماری نشان می‌دهد', 'انحراف معیار و واریانس', 'همبستگی بین متغیرها'],
    openingPhrases: ['تحلیل کمّی {instrument} بر اساس داده‌های آماری...', 'مدل‌های ریاضی برای {instrument} نشان می‌دهند...'],
    closingPhrases: ['بر اساس شواهد آماری...', 'توصیه: تصمیم‌گیری مبتنی بر داده‌های کمّی.'],
  },
  {
    id: 'shirin_classical', name: 'شیرین عباسی', gender: 'female', experience: 8,
    schoolAffinity: 'مکتب کلاسیک', toneAffinity: 'متعادل',
    signaturePhrases: ['همان‌طور که در تحلیل کلاسیک می‌بینیم', 'الگوی قابل شناسایی', 'آموزش مهم‌ترین ابزار است', 'درک سطوح قیمتی کلیدی'],
    openingPhrases: ['برای درک بهتر وضعیت {instrument}، به بررسی الگوها می‌پردازیم...', 'تحلیل آموزشی {instrument}: الگوها و سطوح کلیدی...'],
    closingPhrases: ['با توجه به آنچه بررسی کردیم...', 'توصیه: تمرین و بررسی مداوم الگوها.'],
  },
  {
    id: 'omid_oscillator', name: 'امید رحیمی', gender: 'male', experience: 12,
    schoolAffinity: 'مکتب اسیلاتوری', toneAffinity: 'هشداردهنده',
    signaturePhrases: ['هشدار: واگرایی منفی', 'احیای احتمالی ریسک', 'منطقه خطر اسیلاتورها', 'احتیاط در ورود الزامی است'],
    openingPhrases: ['هشدار تحلیلی برای {instrument}:', 'بررسی اسیلاتورهای {instrument} نکات مهمی را نشان می‌دهد...'],
    closingPhrases: ['توصیه مهم: صبر و احتیاط...', 'توصیه: ورود تنها با تأیید قطعی سیگنال‌ها.'],
  },
  {
    id: 'mina_harmonic', name: 'مینا کاظمی', gender: 'female', experience: 15,
    schoolAffinity: 'مکتب هارمونیک', toneAffinity: 'متعادل',
    signaturePhrases: ['الگوی هارمونیک کامل', 'دقت نسبت‌ها قابل قبول', 'نقطه‌ی D با نسبت طلایی', 'تأیید ساختار هارمونیک'],
    openingPhrases: ['تحلیل حرفه‌ای هارمونیک {instrument}...', 'بررسی الگوهای هارمونیک پیشرفته در {instrument}...'],
    closingPhrases: ['با توجه به تکمیل الگوی هارمونیک...', 'توصیه: ورود در نقطه‌ی تکمیل الگو با مدیریت ریسک.'],
  },
  {
    id: 'saeed_elliott', name: 'سعید موسوی', gender: 'male', experience: 19,
    schoolAffinity: 'مکتب الیوت', toneAffinity: 'خوش‌بینانه',
    signaturePhrases: ['موج سوم در مسیر صعود', 'امتداد موج انگیزشی', 'ساختار پنج‌موجی کامل', 'هدف موجی مشخص'],
    openingPhrases: ['تحلیل پیشرفته امواج الیوت در {instrument}...', 'شمارش امواج {instrument} فرصت‌های روشنی را نشان می‌دهد...'],
    closingPhrases: ['با تکمیل ساختار موجی صعودی...', 'توصیه: بهره‌برداری از موج انگیزشی با رعایت حد ضرر.'],
  },
  {
    id: 'zahra_volume', name: 'زهرا احمدی', gender: 'female', experience: 11,
    schoolAffinity: 'مکتب حجم و عرضه/تقاضا', toneAffinity: 'محافظه‌کارانه',
    signaturePhrases: ['جریان پول ورودی محتاطانه است', 'حجم معاملات نیاز به تأیید', 'عرضه و تقاضا در تعادل نسبی', 'نقدینگی باید مورد توجه قرار گیرد'],
    openingPhrases: ['بررسی جریان پول و نقدینگی در {instrument}...', 'تحلیل عرضه و تقاضای {instrument} از منظر حجمی...'],
    closingPhrases: ['با احتیاط و پیگیری جریان پول...', 'توصیه: ورود تدریجی با نظارت بر حجم معاملات.'],
  },
  {
    id: 'arash_hybrid', name: 'آرش فرهادی', gender: 'male', experience: 16,
    schoolAffinity: 'مکتب ترکیبی', toneAffinity: 'تهاجمی',
    signaturePhrases: ['هم‌گرایی قوی سیگنال‌ها', 'فرصت طلایی معاملاتی', 'تصمیم سریع و قاطع', 'همه شواهد تأییدکننده‌اند'],
    openingPhrases: ['فرصت ترکیبی قوی در {instrument}:', 'تأیید چندگانه روش‌ها در {instrument} سیگنال ورود صادر کرده...'],
    closingPhrases: ['توصیه: ورود فوری با حجم بالا.', 'با شکست قطعی سطوح، هدف‌های قیمتی بزرگ‌تر در دسترس‌اند.'],
  },
  {
    id: 'nasim_classical', name: 'نسیم تهرانی', gender: 'female', experience: 13,
    schoolAffinity: 'مکتب کلاسیک', toneAffinity: 'واقع‌گرایانه',
    signaturePhrases: ['الگوهای کلاسیک قابل اعتماد', 'شکست سطح نیاز به حجم دارد', 'خط روند فعلی معتبر است', 'الگوی ادامه‌دهنده/برگشتی'],
    openingPhrases: ['بررسی الگوهای کلاسیک در {instrument}...', 'تحلیل واقع‌بینانه الگوهای قیمتی {instrument}...'],
    closingPhrases: ['با در نظر گرفتن واقعیت‌های بازار...', 'توصیه: ورود با تأیید حجم و شکست معتبر.'],
  },
  {
    id: 'payam_oscillator', name: 'پیام نوری', gender: 'male', experience: 7,
    schoolAffinity: 'مکتب اسیلاتوری', toneAffinity: 'تهاجمی',
    signaturePhrases: ['مومنتوم صعودی قوی', 'تقاطع سریع اسیلاتورها', 'سیگنال فوری خرید/فروش', 'سرعت تغییر مومنتوم بالا'],
    openingPhrases: ['سیگنال سریع مومنتوم در {instrument}:', 'تغییرات سریع اسیلاتورها در {instrument}...'],
    closingPhrases: ['توصیه: ورود سریع و خروج سریع‌تر.', 'نقطه‌ی خروج: بازگشت مومنتوم.'],
  },
  {
    id: 'gita_harmonic', name: 'گیتا شریفی', gender: 'female', experience: 10,
    schoolAffinity: 'مکتب هارمونیک', toneAffinity: 'تهاجمی',
    signaturePhrases: ['الگوی هارمونیک قدرتمند', 'نسبت فیبوناچی ۰.۶۱۸ دقیق', 'ورود تهاجمی در PRZ', 'هدف قیمتی بلندمدت'],
    openingPhrases: ['فرصت هارمونیک تهاجمی در {instrument}:', 'الگوی هارمونیک قدرتمند در {instrument} شناسایی شد...'],
    closingPhrases: ['توصیه: ورود تهاجمی با هدف بلندمدت.', 'با تأیید PRZ، موقعیت معاملاتی بزرگ باز می‌شود.'],
  },
  {
    id: 'kourosh_elliott', name: 'کوروش صالحی', gender: 'male', experience: 18,
    schoolAffinity: 'مکتب الیوت', toneAffinity: 'محافظه‌کارانه',
    signaturePhrases: ['شمارش امواج با احتیاط', 'احتمال سناریوی اصلاحی', 'نسبت‌های موجی محافظه‌کارانه', 'تأیید ساختار موجی ضروری است'],
    openingPhrases: ['تحلیل محافظه‌کارانه امواج الیوت در {instrument}...', 'شمارش احتیاطانه امواج {instrument} نشان می‌دهد...'],
    closingPhrases: ['توصیه: صبر برای تأیید کامل ساختار موجی.', 'با احتیاط در ورود و رعایت دقیق حد ضرر...'],
  },
  {
    id: 'fatemeh_sentiment', name: 'فاطمه محمدی', gender: 'female', experience: 15,
    schoolAffinity: 'مکتب ترکیبی', toneAffinity: 'هشداردهنده',
    signaturePhrases: ['روانشناسی بازار هشدار می‌دهد', 'ترس در بازار غالب شده', 'احساسات منفی تشدید شده', 'رفتار گله‌ای خطرناک است'],
    openingPhrases: ['هشدار روانشناسی بازار برای {instrument}:', 'بررسی وضعیت احساسی بازار در {instrument}...'],
    closingPhrases: ['توصیه مهم: احتیاط شدید در شرایط فعلی.', 'توصیه: خروج از معاملات پرریسک تا بهبود احساسات بازار.'],
  },
  {
    id: 'reza_quant', name: 'رضا عباسی', gender: 'male', experience: 12,
    schoolAffinity: 'مکتب ترکیبی', toneAffinity: 'متعادل',
    signaturePhrases: ['تحلیل آماری و کمّی', 'توزیع احتمالات قیمت', 'مدل رگرسیون نشان می‌دهد', 'داده‌های تاریخی الگو دارند'],
    openingPhrases: ['تحلیل آماری {instrument} بر اساس داده‌های تاریخی...', 'رویکرد کمّی و آماری در تحلیل {instrument}...'],
    closingPhrases: ['بر اساس مدل‌های آماری...', 'توصیه: تصمیم‌گیری متعادل با استناد به داده‌های کمّی.'],
  },
];

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
  bbPosition: number;
  resistance: number;
  support: number;
  atr: number;
  scenarioDominant: string;
  hasVolume: boolean;
  detectedPatterns?: {
    classic: number;
    harmonic: number;
    candlestick: number;
    elliott: number;
    schoolScores: Record<string, number>;
  };
}

export interface MLSelection {
  school: AnalysisSchool;
  style: NarrativeStyle;
  tone: AnalyticalTone;
  reasoning: string;
  persona?: PersonaInfo;
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

/**
 * Select school, style, and tone based on ML rules.
 */
export function selectMLCombination(data: MLSelectorInput): MLSelection {
  let school: AnalysisSchool;
  let style: NarrativeStyle;
  let tone: AnalyticalTone;
  let reasoning: string;

  // Pattern-based school override
  const ps = data.detectedPatterns;
  const elliottScore = ps?.schoolScores?.['elliott'] ?? 0;
  const harmonicScore = ps?.schoolScores?.['harmonic'] ?? 0;
  const classicalScore = ps?.schoolScores?.['classical'] ?? 0;

  // ── Rule 1: Elliott waves detected → Elliott school
  if (ps && elliottScore > 0.3 && ps.elliott >= 1) {
    school = 'مکتب الیوت';
    style = 'تحلیلی-تکنیکال';
    tone = 'متعادل';
    reasoning = 'تشخیص ساختار موجی الیوت: مکتب الیوت + سبک تحلیلی-تکنیکال + لحن متعادل';
  }
  // ── Rule 2: Harmonic patterns detected → Harmonic school
  else if (ps && harmonicScore > 0.3 && ps.harmonic >= 1) {
    school = 'مکتب هارمونیک';
    style = 'پیش‌بینی و آینده‌نگر';
    tone = 'خوش‌بینانه';
    reasoning = 'تشخیص الگوی هارمونیک: مکتب هارمونیک + سبک پیش‌بینی + لحن خوش‌بینانه';
  }
  // ── Rule 3: Volume data + OBV confirms → Volume school
  else if (data.hasVolume && data.obv !== 0) {
    school = 'مکتب حجم و عرضه/تقاضا';
    style = 'معاملاتی و عملیاتی';
    tone = 'واقع‌گرایانه';
    reasoning = 'داده‌های حجم موجود: مکتب حجم و عرضه/تقاضا + سبک معاملاتی + لحن واقع‌گرایانه';
  }
  // ── Rule 4: Range Market → Classical
  else if (isRange(data)) {
    school = 'مکتب کلاسیک';
    style = 'اجرایی و تصمیم‌گیری';
    tone = 'محافظه‌کارانه';
    reasoning = 'بازار در فاز رنج با ADX پایین: مکتب کلاسیک + سبک اجرایی + لحن محافظه‌کارانه';
  }
  // ── Rule 5: Strong Uptrend without overbought
  else if (isStrongTrendUp(data) && !isOverbought(data)) {
    school = 'مکتب کلاسیک';
    style = 'تحلیلی-تکنیکال';
    tone = 'خوش‌بینانه';
    reasoning = 'روند صعودی قوی بدون اشباع: مکتب کلاسیک + سبک تحلیلی-تکنیکال + لحن خوش‌بینانه';
  }
  // ── Rule 6: Strong Uptrend WITH overbought → Oscillator
  else if (isStrongTrendUp(data) && isOverbought(data)) {
    school = 'مکتب اسیلاتوری';
    style = 'معاملاتی و عملیاتی';
    tone = 'هشداردهنده';
    reasoning = 'روند صعودی قوی با اشباع خرید: مکتب اسیلاتوری + سبک معاملاتی + لحن هشداردهنده';
  }
  // ── Rule 7: Strong Downtrend → Oscillator
  else if (isStrongTrendDown(data)) {
    school = 'مکتب اسیلاتوری';
    style = 'تحلیلی-تکنیکال';
    tone = 'هشداردهنده';
    reasoning = 'روند نزولی قوی: مکتب اسیلاتوری + سبک تحلیلی-تکنیکال + لحن هشداردهنده';
  }
  // ── Rule 8: Near Support → Harmonic
  else if (isNearSupport(data)) {
    school = 'مکتب هارمونیک';
    style = 'پیش‌بینی و آینده‌نگر';
    tone = 'خوش‌بینانه';
    reasoning = 'نزدیکی به حمایت: مکتب هارمونیک + سبک پیش‌بینی + لحن خوش‌بینانه';
  }
  // ── Rule 9: Near Resistance → Classical
  else if (isNearResistance(data)) {
    school = 'مکتب کلاسیک';
    style = 'اجرایی و تصمیم‌گیری';
    tone = 'محافظه‌کارانه';
    reasoning = 'نزدیکی به مقاومت: مکتب کلاسیک + سبک اجرایی + لحن محافظه‌کارانه';
  }
  // ── Rule 10: Volatility Squeeze
  else if (isVolatilitySqueeze(data)) {
    school = 'مکتب ترکیبی';
    style = 'تحلیلی-تکنیکال';
    tone = 'واقع‌گرایانه';
    reasoning = 'نوسان فشرده (باند بولینگر): مکتب ترکیبی + سبک تحلیلی-تکنیکال + لحن واقع‌گرایانه';
  }
  // ── Rule 11: High Volatility
  else if (isHighVolatility(data)) {
    school = 'مکتب ترکیبی';
    style = 'معاملاتی و عملیاتی';
    tone = 'متعادل';
    reasoning = 'نوسان بالا و احتمال شکست: مکتب ترکیبی + سبک معاملاتی + لحن متعادل';
  }
  // ── Default → Hybrid
  else {
    school = 'مکتب ترکیبی';
    style = 'تحلیلی-تکنیکال';
    tone = 'متعادل';
    reasoning = 'شرایط عمومی: مکتب ترکیبی + سبک تحلیلی-تکنیکال + لحن متعادل';
  }

  // ── Tone overrides based on scenario dominance ──
  if (data.scenarioDominant === 'SC9' || data.scenarioDominant === 'SC8') {
    tone = 'هشداردهنده';
    reasoning += ' (بازنویسی: سناریوی نزولی شدید، لحن به هشداردهنده تغییر یافت)';
  }
  if (data.scenarioDominant === 'SC4') {
    tone = 'تهاجمی';
    reasoning += ' (بازنویسی: سناریوی شوک صعودی، لحن به تهاجمی تغییر یافت)';
  }
  if (data.scenarioDominant === 'SC5') {
    tone = 'محافظه‌کارانه';
    reasoning += ' (بازنویسی: سناریوی رنج، لحن به محافظه‌کارانه تغییر یافت)';
  }

  return { school, style, tone, reasoning };
}

// ═══════════════════════════════════════════════════════════════
// Persona Selection (hash-based rotation)
// ═══════════════════════════════════════════════════════════════

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function selectPersona(date: string, instrument: string, school: string, _tone: string): PersonaInfo {
  const hashStr = `${date}_${instrument}_2024`;
  const hash = simpleHash(hashStr);
  const index = hash % WRITING_PERSONAS.length;

  // Try to find persona matching school affinity
  const schoolMatch = WRITING_PERSONAS.find(p => p.schoolAffinity === school);
  if (schoolMatch) {
    // 70% chance to use school-matched persona
    if (hash % 10 < 7) return schoolMatch;
  }
  return WRITING_PERSONAS[index];
}

// ═══════════════════════════════════════════════════════════════
// Scenario Name Mapping
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_NAMES: Record<string, string> = {
  SC1: 'شوک صعودی',
  SC2: 'صعودی شتاب‌دار',
  SC3: 'صعودی شتابدار',
  SC4: 'صعودی خفیف',
  SC5: 'رنج',
  SC6: 'نزولی خفیف',
  SC7: 'نزولی قوی',
  SC8: 'نزولی شتاب‌دار',
  SC9: 'شوک نزولی',
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

  if (selected.size < 3) {
    selected.add('RSI و مومنتوم');
    selected.add('سطوح کلیدی حمایت/مقاومت');
    selected.add('خط روند میان‌مدت');
  }

  return Array.from(selected).slice(0, 5);
}
