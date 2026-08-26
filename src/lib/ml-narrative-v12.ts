// ═══════════════════════════════════════════════════════════════════════════════
// ML Narrative Engine v12 — Data-Driven Text Generation System
// V12 = V11 base + future enhancements (this is the new active version)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: Core Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface NarrativeCombination {
  school: SchoolDef;
  style: StyleDef;
  tone: ToneDef;
  schoolScore: number;
  styleScore: number;
  toneScore: number;
}

export interface SchoolDef {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  methodology: string;
  focusQuestion: string;
}

export interface StyleDef {
  id: string;
  name: string;
  nameEn: string;
  voice: string;
  structure: string;
  endingStyle: string;
}

export interface ToneDef {
  id: string;
  name: string;
  nameEn: string;
  characteristics: string;
  vocabulary: string;
  sentenceStyle: string;
}

export interface NarrativeInput {
  price: number;
  trendDirection: string;
  rsi: number;
  adx: number;
  stochK: number;
  stochD: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  diPlus: number;
  diMinus: number;
  obv: number;
  hasVolume: boolean;
  cci: number;
  mfi: number;
  atr: number;
  bbPosition: number;
  bbUpper: number;
  bbLower: number;
  dominantScenarioKey: string;
  scenarioProbabilities: Record<string, number>;
  nearResistance: boolean;
  nearSupport: boolean;
  priceVsMa21: 'above' | 'below';
  priceVsMa100: 'above' | 'below';
  trendR2: number;
}

// ─── V12 New Types ─────────────────────────────────────────────────────────────

export interface V12Persona {
  id: string;
  name: string;
  gender: 'male' | 'female';
  experience: number;
  schoolAffinity: string;
  toneAffinity: string;
  style: {
    sentences: string;
    vocabulary: string;
    emphasis: string;
  };
  signaturePhrases: string[];
  writingHabits: string[];
  openingPhrases: string[];
  closingPhrases: string[];
}

export interface V12TemplateFormat {
  id: string;
  name: string;
  nameEn: string;
  lengthPreference: 'short' | 'medium' | 'long';
  focusArea: string;
  sections: string[];
  wordCountRange: [number, number];
  structure: string;
}

export interface V12GenerationInfo {
  persona: V12Persona;
  template: V12TemplateFormat;
  variationSeed: number;
  school: string;
  style: string;
  tone: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: 33 Writing Personas (24 core + 9 specialist)
// ═══════════════════════════════════════════════════════════════════════════════

export const PERSONAS: V12Persona[] = [
  // ── Classical School ──
  {
    id: 'maryam_classical', name: 'مریم رضایی — تحلیل‌گر کلاسیک محافظه‌کار', gender: 'female', experience: 18,
    schoolAffinity: 'classical', toneAffinity: 'conservative',
    style: { sentences: 'بلند و دقیق', vocabulary: 'تخصصی با توضیح', emphasis: 'مدیریت ریسک' },
    signaturePhrases: ['بر اساس تحلیل کلاسیک و داده‌های موجود', 'با احتیاط باید گفت که', 'احتمال وقوع این سناریو', 'سطوح حمایت و مقاومت نشان می‌دهند', 'الگوی قیمتی تشخیص‌داده‌شده'],
    writingHabits: ['استفاده از جملات شرطی و محتاطانه', 'تأکید بر مدیریت ریسک و حد ضرر', 'ارائه‌ی سناریوهای مختلف با احتمالات', 'استفاده از مثال‌های تاریخی'],
    openingPhrases: ['با بررسی دقیق داده‌های بازار و تحلیل کلاسیک...', 'نگاهی به وضعیت امروز {instrument} از منظر تحلیل کلاسیک...', 'در ادامه‌ی بررسی‌های تکنیکال، به تحلیل {instrument} می‌پردازیم...'],
    closingPhrases: ['در مجموع، با توجه به تحلیل‌های انجام‌شده...', 'بر این اساس، توصیه می‌شود که...', 'با رعایت مدیریت ریسک، می‌توان از این فرصت استفاده کرد...'],
  },
  {
    id: 'reza_classical', name: 'رضا کریمی — تحلیل‌گر کلاسیک تکنیکال', gender: 'male', experience: 15,
    schoolAffinity: 'classical', toneAffinity: 'balanced',
    style: { sentences: 'متوسط و دقیق', vocabulary: 'فنی و تخصصی', emphasis: 'دقت تحلیل' },
    signaturePhrases: ['از منظر تحلیل تکنیکال کلاسیک', 'الگوهای قیمتی نشان می‌دهند', 'خطوط روند و کانال‌ها', 'تأیید یا عدم تأیید الگو', 'سطوح کلیدی قیمتی'],
    writingHabits: ['استفاده از نمودارهای ذهنی و توصیفی', 'تأکید بر اعتبارسنجی الگوها', 'مقایسه با الگوهای مشابه تاریخی', 'ارائه‌ی تحلیل از بالا به پایین'],
    openingPhrases: ['تحلیل امروز {instrument} با رویکرد کلاسیک نشان می‌دهد...', 'با رسم خطوط روند و شناسایی سطوح کلیدی...', 'الگوهای قیمتی شکل‌گرفته در تایم‌فریم روزانه...'],
    closingPhrases: ['به طور خلاصه، الگوها و سطوح...', 'بر اساس شواهد تکنیکال...', 'تحلیل کلاسیک تأیید می‌کند که...'],
  },
  {
    id: 'ali_classical', name: 'علی محمدی — تحلیل‌گر کلاسیک عملیاتی', gender: 'male', experience: 12,
    schoolAffinity: 'classical', toneAffinity: 'aggressive',
    style: { sentences: 'کوتاه و قاطع', vocabulary: 'عملیاتی و اجرایی', emphasis: 'نقاط ورود و خروج' },
    signaturePhrases: ['نقطه‌ی ورود عالی', 'شکست تأییدشده', 'هدف قیمتی مشخص', 'حد ضرر را رعایت کنید', 'فرصت معاملاتی'],
    writingHabits: ['جملات کوتاه و مستقیم', 'تأکید بر نقاط ورود/خروج دقیق', 'مدیریت ریسک عملیاتی', 'ارائه‌ی زمان‌بندی اجرا'],
    openingPhrases: ['فرصت معاملاتی جدید در {instrument}:', 'سیگنال قوی در {instrument}', 'با شکست سطح کلیدی، وارد معامله می‌شویم...'],
    closingPhrases: ['نتیجه‌گیری عملیاتی:', 'برنامه اجرایی مشخص است:', 'مدیریت ریسک اولویت اول است.'],
  },
  // ── Oscillator School ──
  {
    id: 'sara_oscillator', name: 'سارا احمدی — تحلیل‌گر اسیلاتوری', gender: 'female', experience: 14,
    schoolAffinity: 'oscillator', toneAffinity: 'realistic',
    style: { sentences: 'تحلیلی و دقیق', vocabulary: 'ریاضی و فنی', emphasis: 'واگرایی‌ها و سیگنال‌ها' },
    signaturePhrases: ['واگرایی تشخیص‌داده‌شده', 'اشباع خرید/فروش', 'RSI و MACD نشان می‌دهند', 'قدرت مومنتوم', 'سیگنال‌های ترکیبی'],
    writingHabits: ['استفاده از اعداد و ارقام دقیق', 'تأکید بر واگرایی‌ها و همگرایی‌ها', 'ترکیب چندین اسیلاتور', 'تحلیل قدرت و ضعف حرکت'],
    openingPhrases: ['با بررسی اندیکاتورهای مومنتوم در {instrument}...', 'سیگنال‌های ترکیبی اسیلاتورها نشان می‌دهند...', 'واگرایی قابل‌توجهی در {instrument} شکل گرفته است...'],
    closingPhrases: ['اعداد و ارقام تأیید می‌کنند که...', 'مومنتوم فعلی حاکی از...', 'سیگنال‌های اسیلاتوری به طور کلی...'],
  },
  {
    id: 'hamid_oscillator', name: 'حمید نوروزی — تحلیل‌گر مومنتوم', gender: 'male', experience: 10,
    schoolAffinity: 'oscillator', toneAffinity: 'aggressive',
    style: { sentences: 'کوتاه و تأکیدی', vocabulary: 'فنی و سریع', emphasis: 'زمان‌بندی ورود' },
    signaturePhrases: ['سیگنال خرید تأییدشده', 'خروج از منطقه اشباع', 'تقاطع صعودی/نزولی', 'حجم بالا و مومنتوم قوی', 'ورود در نقطه‌ی عالی'],
    writingHabits: ['استفاده از اصطلاحات معاملاتی', 'تأکید بر زمان‌بندی دقیق', 'ترکیب قیمت و مومنتوم', 'ارائه‌ی سیگنال‌های سریع'],
    openingPhrases: ['سیگنال فوری در {instrument}:', 'با تأیید اسیلاتورها، وارد {instrument} می‌شویم...', 'مومنتوم صعودی در {instrument} در حال شکل‌گیری است...'],
    closingPhrases: ['سیگنال نهایی:', 'زمان ورود مشخص است.', 'تقاطع‌ها تأیید می‌کنند.'],
  },
  // ── Harmonic School ──
  {
    id: 'narges_harmonic', name: 'نرگس رستمی — تحلیل‌گر هارمونیک', gender: 'female', experience: 16,
    schoolAffinity: 'harmonic', toneAffinity: 'conservative',
    style: { sentences: 'دقیق و ریاضی', vocabulary: 'تخصصی هارمونیک', emphasis: 'نسبت‌های فیبوناچی' },
    signaturePhrases: ['نسبت‌های فیبوناچی دقیق', 'ناحیه‌ی برگشت احتمالی (PRZ)', 'الگوی هارمونیک تشخیص‌داده‌شده', 'تلاقی نسبت‌ها', 'نقاط D و PRZ'],
    writingHabits: ['استفاده از اعداد با دو رقم اعشار', 'تأکید بر نسبت‌های فیبوناچی', 'بررسی تلاقی‌های مختلف', 'ارائه‌ی سطوح دقیق قیمتی'],
    openingPhrases: ['تحلیل هارمونیک {instrument} نشان‌دهنده‌ی...', 'با محاسبه‌ی نسبت‌های فیبوناچی در {instrument}...', 'الگوی هارمونیک {pattern} در {instrument} تشخیص داده شد...'],
    closingPhrases: ['نسبت‌ها تأیید می‌کنند...', 'ناحیه‌ی PRZ در...', 'دقت نسبت‌ها حاکی از...'],
  },
  {
    id: 'hassan_harmonic', name: 'حسن زمانی — تحلیل‌گر هارمونیک عملیاتی', gender: 'male', experience: 11,
    schoolAffinity: 'harmonic', toneAffinity: 'optimistic',
    style: { sentences: 'متعادل و امیدوارانه', vocabulary: 'ترکیبی از فنی و عملی', emphasis: 'نقاط برگشت دقیق' },
    signaturePhrases: ['ناحیه‌ی برگشت ایده‌آل', 'با دقت بالا', 'هدف قیمتی دقیق', 'نسبت‌های طلایی', 'فرصت عالی'],
    writingHabits: ['ترکیب تحلیل هارمونیک و عملیات', 'تأکید بر دقت نسبت‌ها', 'ارائه‌ی نقاط ورود و خروج دقیق', 'بررسی چندین سناریو'],
    openingPhrases: ['فرصت هارمونیک عالی در {instrument}:', 'با تشخیص الگوی هارمونیک در {instrument}...', 'ناحیه‌ی برگشت احتمالی در {instrument} شناسایی شد...'],
    closingPhrases: ['فرصت طلایی پیش رو است...', 'نقاط ورود و خروج مشخص شدند.', 'نسبت‌های فیبوناچی پتانسیل بالایی نشان می‌دهند.'],
  },
  // ── Elliott School ──
  {
    id: 'farshid_elliott', name: 'فرشید کاظمی — موج‌شناس الیوت', gender: 'male', experience: 17,
    schoolAffinity: 'elliott', toneAffinity: 'balanced',
    style: { sentences: 'ساختاری و تحلیلی', vocabulary: 'موج‌شناسی و ساختاری', emphasis: 'ساختار موجی' },
    signaturePhrases: ['ساختار موجی نشان می‌دهد', 'موج در حال شکل‌گیری', 'نسبت‌های فیبوناچی بین امواج', 'الگوی اصلاحی/حرکتی', 'قوی‌ترین موج'],
    writingHabits: ['برچسب‌گذاری امواج با اعداد و حروف', 'تأکید بر ساختارهای ۵-۳ موجی', 'ارائه‌ی اهداف قیمتی مبتنی بر امواج', 'بررسی تأیید با واگرایی‌ها'],
    openingPhrases: ['بر اساس تحلیل امواج الیوت در {instrument}...', 'ساختار موجی فعلی {instrument} نشان‌دهنده‌ی...', 'امواج الیوت در تایم‌فریم روزانه {instrument}...'],
    closingPhrases: ['ساختار موجی کلی حاکی از...', 'امواج اصلاحی در حال تکمیل...', 'شمارش امواج تأیید می‌کند...'],
  },
  {
    id: 'mina_elliott', name: 'مینا شریفی — تحلیل‌گر موجی خلاق', gender: 'female', experience: 13,
    schoolAffinity: 'elliott', toneAffinity: 'optimistic',
    style: { sentences: 'روان و توصیفی', vocabulary: 'موجی و تصویری', emphasis: 'تصویرسازی موجی' },
    signaturePhrases: ['تصویر موجی امروز', 'موسیقی بازار', 'ریتم حرکت', 'امواج در حال آواز خواندن', 'نت‌های صعودی و نزولی'],
    writingHabits: ['استعاره‌های موسیقایی از بازار', 'تصویرسازی ذهنی امواج', 'ترکیب احساس و تحلیل', 'روان‌سازی متن موجی'],
    openingPhrases: ['موج‌های امروز {instrument} آهنگی جدید دارند...', 'بازار امروز {instrument} مانند یک سمفونی...', 'ریتم حرکت {instrument} تغییر کرده...'],
    closingPhrases: ['آهنگ نهایی بازار...', 'نت‌های پایانی...', 'سمفونی امواج ادامه دارد.'],
  },
  // ── Volume School ──
  {
    id: 'leila_volume', name: 'لیلا کریمی — تحلیل‌گر حجم', gender: 'female', experience: 13,
    schoolAffinity: 'volume', toneAffinity: 'realistic',
    style: { sentences: 'دقیق و مبتنی بر داده', vocabulary: 'حجمی و آماری', emphasis: 'تأیید با حجم' },
    signaturePhrases: ['حجم معاملات نشان می‌دهد', 'جریان پول و نقدینگی', 'OBV و A/D', 'تأیید شکست با حجم', 'حجم بالا در نقاط کلیدی'],
    writingHabits: ['تأکید بر داده‌های حجم', 'بررسی الگوهای حجمی', 'ترکیب حجم و قیمت', 'ارائه‌ی تحلیل جریان پول'],
    openingPhrases: ['با بررسی حجم معاملات {instrument}...', 'جریان پول در {instrument} نشان‌دهنده‌ی...', 'تأیید حجمی در {instrument} مشاهده می‌شود...'],
    closingPhrases: ['حجم معاملات تأیید می‌کند...', 'جریان نقدینگی حاکی از...', 'داده‌های حجم نهایی نشان می‌دهند...'],
  },
  {
    id: 'amir_volume', name: 'امیر حسینی — تحلیل‌گر جریان پول', gender: 'male', experience: 16,
    schoolAffinity: 'volume', toneAffinity: 'alert',
    style: { sentences: 'هشداری و دقیق', vocabulary: 'مالی و نقدینگی', emphasis: 'هوش پول' },
    signaturePhrases: ['پول هوشمند', 'جریان نقدینگی', 'ورود/خروج پله‌ای', 'تأیید حجمی شکست', 'الگوی حجمی'],
    writingHabits: ['تأکید بر رفتار پول هوشمند', 'تحلیل ورود و خروج پله‌ای نهادها', 'ترکیب حجم و قیمت', 'هشدار درباره تله‌های حجمی'],
    openingPhrases: ['پیگیری جریان پول در {instrument}...', 'پول هوشمند امروز در {instrument}...', 'الگوی حجمی حاکی از تغییر مالکیت در {instrument}...'],
    closingPhrases: ['جریان پول نهایی...', 'هوش پول مؤید...', 'تله‌های حجمی را مراقب باشید.'],
  },
  // ── Hybrid School ──
  {
    id: 'mehrdad_hybrid', name: 'مهرداد صادقی — تحلیل‌گر ترکیبی', gender: 'male', experience: 20,
    schoolAffinity: 'hybrid', toneAffinity: 'balanced',
    style: { sentences: 'جامع و یکپارچه', vocabulary: 'همه‌جانبه', emphasis: 'تلفیق روش‌ها' },
    signaturePhrases: ['ترکیب روش‌های تحلیل', 'هم‌گرایی سیگنال‌ها', 'تأیید چندگانه', 'وزن‌دهی به ابزارها', 'تصمیم مبتنی بر داده'],
    writingHabits: ['تلفیق چند مکتب در یک تحلیل', 'ارائه‌ی وزن‌دهی به روش‌ها', 'بررسی هم‌گرایی و واگرایی سیگنال‌ها', 'تصمیم‌گیری هوشمندانه'],
    openingPhrases: ['تحلیل جامع {instrument} با تلفیق روش‌های مختلف...', 'با ترکیب تحلیل کلاسیک، اسیلاتوری و هارمونیک...', 'رویکرد ترکیبی در تحلیل {instrument} نشان می‌دهد...'],
    closingPhrases: ['جمع‌بندی ترکیبی...', 'همه‌ی شواهد مؤید...', 'تصمیم نهایی مبتنی بر تلفیق...'],
  },
  {
    id: 'parisa_sentiment', name: 'پریسا مرادی — تحلیل‌گر احساسات بازار', gender: 'female', experience: 9,
    schoolAffinity: 'hybrid', toneAffinity: 'optimistic',
    style: { sentences: 'روان و قابل فهم', vocabulary: 'ترکیبی از فنی و عمومی', emphasis: 'احساسات بازار' },
    signaturePhrases: ['احساسات بازار نشان می‌دهد', 'شاخص ترس و طمع', 'رفتار معامله‌گران', 'انتظارات بازار', 'روانشناسی بازار'],
    writingHabits: ['تأکید بر جنبه‌های روانشناختی', 'ترکیب داده‌های کمی و کیفی', 'تحلیل رفتار دسته‌جمعی', 'ارائه‌ی دیدگاه‌های مختلف'],
    openingPhrases: ['احساسات بازار امروز {instrument}...', 'با بررسی شاخص‌های احساسی در {instrument}...', 'روانشناسی بازار {instrument} نشان می‌دهد...'],
    closingPhrases: ['بازار احساساتی است اما...', 'روانشناسی جمعی حاکی از...', 'ترس و طمع همیشه در کنار هم.'],
  },
  {
    id: 'behzad_quant', name: 'بهزاد نیک‌پور — تحلیل‌گر کمی', gender: 'male', experience: 14,
    schoolAffinity: 'hybrid', toneAffinity: 'realistic',
    style: { sentences: 'دقیق و مبتنی بر آمار', vocabulary: 'کمی و آماری', emphasis: 'احتمالات و آمار' },
    signaturePhrases: ['بر اساس داده‌های آماری', 'احتمالات و توزیع‌ها', 'ضرایب و وزن‌ها', 'اعتبارسنجی آماری', 'فاصله‌ی اطمینان'],
    writingHabits: ['استفاده از اعداد و آمار', 'ارائه‌ی احتمالات دقیق', 'تحلیل آماری داده‌ها', 'بررسی اعتبار سیگنال‌ها'],
    openingPhrases: ['بر اساس داده‌های آماری {instrument}...', 'تحلیل کمی {instrument} نشان می‌دهد...', 'احتمالات و توزیع‌های قیمتی در {instrument}...'],
    closingPhrases: ['اعداد نهایی...', 'احتمالات محاسبه‌شده...', 'اعتبار آماری تحلیل...'],
  },
  // ── Additional Personas for diversity ──
  {
    id: 'zahra_trend', name: 'زهرا موسوی — تحلیل‌گر روند حرفه‌ای', gender: 'female', experience: 19,
    schoolAffinity: 'classical', toneAffinity: 'conservative',
    style: { sentences: 'مستدل و با استدلال', vocabulary: 'روندی و تحلیلی', emphasis: 'تشخیص زودهنگام روند' },
    signaturePhrases: ['شکل‌گیری روند جدید', 'تغییر ساختار روند', 'EMAها تأیید می‌کنند', 'ADX بالای ۲۵', 'کانال روند'],
    writingHabits: ['تحلیل دقیق شیب روند', 'تأکید بر تثبیت کانال', 'مقایسه تایم‌فریم‌ها', 'استفاده از ADX برای قدرت'],
    openingPhrases: ['روند فعلی {instrument} در مقطع حساسی قرار دارد...', 'بررسی شیب و قدرت روند {instrument}...', 'سیگنال‌های روندی در {instrument}...'],
    closingPhrases: ['روند با قدرت ادامه می‌یابد یا...', 'تثبیت روند نیازمند...', 'نقطه‌ی عطف روندی نزدیک است.'],
  },
  {
    id: 'davood_trend', name: 'داود رحیمی — تحلیل‌گر شکست و تثبیت', gender: 'male', experience: 11,
    schoolAffinity: 'classical', toneAffinity: 'aggressive',
    style: { sentences: 'سریع و تأکیدی', vocabulary: 'عملیاتی و روندی', emphasis: 'شکست سطوح' },
    signaturePhrases: ['شکست قاطع', 'تثبیت بالای مقاومت', 'روند تازه شکل گرفته', 'سیگنال تداوم', 'قوی‌ترین روند'],
    writingHabits: ['تأکید بر شکست‌های معتبر', 'سرعت در نتیجه‌گیری', 'ترکیب روند با حجم', 'ارائه‌ی نقطه‌ی ورود سریع'],
    openingPhrases: ['شکست مهمی در {instrument} رخ داد...', 'روند جدید {instrument} شکل گرفته...', 'تثبیت قیمت بالای سطح کلیدی در {instrument}...'],
    closingPhrases: ['شکست نهایی و قطعی...', 'تداوم روند محتمل...', 'منتظر پولبک ورود باشید.'],
  },
  {
    id: 'shahin_candle', name: 'شهاب نوری — متخصص الگوهای کندلی', gender: 'male', experience: 15,
    schoolAffinity: 'classical', toneAffinity: 'balanced',
    style: { sentences: 'تصویری و تشریحی', vocabulary: 'کندل‌استیک و ژاپنی', emphasis: 'الگوهای شمعی' },
    signaturePhrases: ['الگوی شمعی', 'بدنه و سایه‌ها', 'کندل تأییدی', 'الگوی بازگشتی', 'سیگنال کندلی'],
    writingHabits: ['توصیف دقیق شکل کندل', 'ترکیب کندل با سطوح', 'تحلیل سایه‌ها و بدنه', 'تأکید بر حجم همراه الگو'],
    openingPhrases: ['الگوی کندلی قابل توجهی در {instrument}...', 'شمع‌های اخیر {instrument} داستانی دارند...', 'ترکیب کندلی در {instrument} نشان می‌دهد...'],
    closingPhrases: ['کندل‌های آینده‌ی نزدیک...', 'الگوی کندلی نهایی...', 'منتظر کندل تأییدی باشید.'],
  },
  {
    id: 'fatemeh_candle', name: 'فاطمه عباسی — تحلیل‌گر روانشناسی کندل', gender: 'female', experience: 10,
    schoolAffinity: 'classical', toneAffinity: 'optimistic',
    style: { sentences: 'روان و داستان‌گونه', vocabulary: 'روانشناختی و کندلی', emphasis: 'نفس بازار' },
    signaturePhrases: ['نفس بازار', 'داستان کندل‌ها', 'جنگ خریداران و فروشندگان', 'فشار خرید/فروش', 'پیروزی خریداران/فروشندگان'],
    writingHabits: ['روایت داستان بازار از زاویه کندل', 'تصویرسازی جنگ خریدار و فروشنده', 'تحلیل سایه‌ها به عنوان سلطه', 'ترکیب روانشناسی با کندل'],
    openingPhrases: ['داستان امروز {instrument} از نگاه کندل‌ها...', 'نبرد خریداران و فروشندگان در {instrument}...', 'نفس بازار {instrument} امروز...'],
    closingPhrases: ['داستان کندل‌ها به ما می‌گوید...', 'بازار نفس کشید...', 'پیروز نهایی این نبرد...'],
  },
  {
    id: 'mohsen_sr', name: 'محسن رحمانی — متخصص سطوح کلیدی', gender: 'male', experience: 16,
    schoolAffinity: 'classical', toneAffinity: 'realistic',
    style: { sentences: 'مستند و اثباتی', vocabulary: 'سطوح و قیمت', emphasis: 'حمایت و مقاومت' },
    signaturePhrases: ['سطح کلیدی', 'ناحیه‌ی عرضه و تقاضا', 'تلاقی سطوح', 'قیمت واکنش‌دهنده', 'برخورد تعدادی'],
    writingHabits: ['تأکید بر تعداد برخوردها', 'تحلیل فاصله‌ی قیمت از سطوح', 'ترکیب سطوح با حجم', 'ارائه‌ی نقشه‌ی سطوح'],
    openingPhrases: ['نقشه‌ی سطوح کلیدی {instrument}...', 'بررسی نقاط واکنش‌دهنده‌ی {instrument}...', 'سطوح عرضه و تقاضا در {instrument}...'],
    closingPhrases: ['نقشه‌ی نهایی سطوح...', 'نزدیک‌ترین سطح واکنش‌دهنده...', 'تلاقی سطوح حائز اهمیت است.'],
  },
  {
    id: 'nasrin_risk', name: 'نسرین کاویانی — مدیر ریسک حرفه‌ای', gender: 'female', experience: 22,
    schoolAffinity: 'hybrid', toneAffinity: 'conservative',
    style: { sentences: 'محتاط و مدیریت‌محور', vocabulary: 'ریسک و مدیریت سرمایه', emphasis: 'حفظ سرمایه' },
    signaturePhrases: ['مدیریت ریسک', 'نسبت ریسک به بازده', 'حفظ سرمایه اولویت است', 'حد ضرر علمی', 'اندازه‌ی موقعیت'],
    writingHabits: ['محاسبه‌ی دقیق نسبت ریسک/بازده', 'تأکید بر حد ضرر', 'ارائه‌ی اندازه‌ی موقعیت مناسب', 'تحلیل سناریوهای بدترین حالت'],
    openingPhrases: ['از منظر مدیریت ریسک، {instrument}...', 'ارزیابی ریسک {instrument} نشان می‌دهد...', 'مدیریت سرمایه در {instrument}...'],
    closingPhrases: ['مدیریت ریسک نهایی...', 'حد ضرر و نسبت ریسک...', 'حفظ سرمایه مهم‌ترین اصل.'],
  },
  {
    id: 'keyvan_macro', name: 'کیوان فرهادی — تحلیل‌گر اقتصاد کلان بازار', gender: 'male', experience: 18,
    schoolAffinity: 'hybrid', toneAffinity: 'alert',
    style: { sentences: 'تحلیلی و جامع', vocabulary: 'اقتصادی و کلان', emphasis: 'بستر کلان' },
    signaturePhrases: ['بستر کلان بازار', 'شرایط اقتصاد کلان', 'تأثیر نرخ بهره', 'نوسانات ارزی', 'سیاست‌گذاری پولی'],
    writingHabits: ['توصیف بستر اقتصاد کلان', 'ارتباط بازار با سیاست‌گذاری', 'تحلیل تأثیرات خارجی', 'ترکیب تحلیل فاندامنتال و تکنیکال'],
    openingPhrases: ['در بستر اقتصاد کلان امروز، {instrument}...', 'شرایط کلان بر {instrument} تأثیر گذاشته...', 'نگاهی به عوامل کلان مؤثر بر {instrument}...'],
    closingPhrases: ['بستر کلان حاکی از...', 'سیاست‌گذاری آتی...', 'بازار در واکنش به عوامل کلان.'],
  },
  {
    id: 'minoo_educator', name: 'منیره معلمی — تحلیل‌گر آموزشی بازار', gender: 'female', experience: 25,
    schoolAffinity: 'hybrid', toneAffinity: 'balanced',
    style: { sentences: 'آموزشی و گام‌به‌گام', vocabulary: 'آموزشی و ساده', emphasis: 'یادگیری و آموزش' },
    signaturePhrases: ['بیایید بررسی کنیم', 'نکته‌ی مهم', 'دقت کنید که', 'یادآوری می‌کنم', 'اصل مهم تکنیکال'],
    writingHabits: ['توضیح مفاهیم به زبان ساده', 'ارائه‌ی نکات آموزشی', 'مرور مفاهیم کلیدی', 'ارتباط مفاهیم با واقعیت بازار'],
    openingPhrases: ['امروز می‌خواهیم {instrument} را با هم بررسی کنیم...', 'درس امروز درباره‌ی {instrument}...', 'بیایید گام‌به‌گام {instrument} را تحلیل کنیم...'],
    closingPhrases: ['نکته‌ی نهایی این تحلیل...', 'یادتان باشد...', 'تمرین این تحلیل را روی نمادهای دیگر هم انجام دهید.'],
  },
  {
    id: 'arash_daytrade', name: 'آرش طاهری — معامله‌گر روزانه', gender: 'male', experience: 8,
    schoolAffinity: 'oscillator', toneAffinity: 'aggressive',
    style: { sentences: 'فوری و کوتاه', vocabulary: 'معاملاتی و روزانه', emphasis: 'سود سریع' },
    signaturePhrases: ['فرصت همین امروز', 'سود قفل‌شده', 'سیگنال فوری', 'تایم‌فریم پایین', 'نوسان‌گیری هوشمند'],
    writingHabits: ['تحلیل سریع و فوری', 'تأکید بر تایم‌فریم‌های پایین', 'ترکیب اسیلاتور و قیمت', 'مدیریت ریسک روزانه'],
    openingPhrases: ['فرصت روزانه در {instrument}...', 'امروز {instrument} پتانسیل خوبی دارد...', 'سیگنال نوسان‌گیری {instrument}...'],
    closingPhrases: ['فرصت امروز...', 'سود روزانه محتمل...', 'منتظر سیگنال خروج بمانید.'],
  },
  {
    id: 'roya_patience', name: 'رویا امیری — تحلیل‌گر بلندمدت صبور', gender: 'female', experience: 21,
    schoolAffinity: 'hybrid', toneAffinity: 'optimistic',
    style: { sentences: 'آرام و عمیق', vocabulary: 'استراتژیک و بلندمدت', emphasis: 'چشم‌انداز بلند' },
    signaturePhrases: ['چشم‌انداز بلندمدت', 'سرمایه‌گذاری هوشمند', 'صبر کلید موفقیت', 'روند بزرگ', 'تحول بنیادی'],
    writingHabits: ['تحلیل تایم‌فریم‌های بالاتر', 'تأکید بر صبر و نظم', 'ارائه‌ی چشم‌انداز ۳-۶ ماهه', 'تحلیل تغییرات ساختاری'],
    openingPhrases: ['در چشم‌انداز بلندمدت، {instrument}...', 'نگاهی استراتژیک به {instrument}...', 'سرمایه‌گذاری صبورانه در {instrument}...'],
    closingPhrases: ['صبر کلید موفقیت است...', 'چشم‌انداز بلندمدت مثبت...', 'زمان بهترین معلم بازار.'],
  },
  // ════════════════════════════════════════════════════════════════════════════
  // ── 9 NEW Specialist Personas ──
  // ════════════════════════════════════════════════════════════════════════════
  // ── Price Action Specialist ──
  {
    id: 'kaveh_priceaction', name: 'کاوه آقایی — متخصص پرایس اکشن', gender: 'male', experience: 16,
    schoolAffinity: 'classical', toneAffinity: 'balanced',
    style: { sentences: 'مختصر و ساختاریافته', vocabulary: 'پرایس اکشنی و رفتاری', emphasis: 'رفتار خالص قیمت' },
    signaturePhrases: ['قیمت همه‌چیز را نشان می‌دهد', 'ساختار بازار تغییر کرده', 'ناحیه‌ی کلیدی واکنش‌دهنده', 'شکست ساختاری محتمل', 'رفتار قیمت حرف آخر را می‌زند'],
    writingHabits: ['تحلیل بدون اندیکاتور اضافی', 'تأکید بر سطوح خالص قیمت', 'بررسی ساختار بازار بالا-پایین', 'توصیف دقیق رفتار کندل‌ها در سطوح'],
    openingPhrases: ['ساختار پرایس اکشن {instrument} امروز...', 'رفتار خالص قیمت در {instrument}...', 'نواحی کلیدی پرایس اکشن {instrument}...'],
    closingPhrases: ['ساختار قیمت نهایی...', 'انتظار واکنش در سطح کلیدی...', 'قیمت خودش بهترین راهنماست.'],
  },
  // ── Volume Profile Specialist ──
  {
    id: 'shirin_volumeprofile', name: 'شیرین موسوی — متخصص پروفایل حجمی', gender: 'female', experience: 12,
    schoolAffinity: 'volume', toneAffinity: 'realistic',
    style: { sentences: 'دقیق و مبتنی بر نوار حجم', vocabulary: 'پروفایل حجمی و VPOC', emphasis: 'نقاط کنترل حجم' },
    signaturePhrases: ['نقطه‌ی کنترل حجم (VPOC)', 'ناحیه‌ی ارزش بالا (VAH)', 'ناحیه‌ی ارزش پایین (VAL)', 'حجم در محدوده‌ی ارزش', 'تغییر VPOC نشان‌دهنده‌ی جابه‌جایی قدرت'],
    writingHabits: ['تحلیل نوارهای حجم در تایم‌فریم‌های مختلف', 'تأکید بر نواحی ارزش بالا و پایین', 'بررسی جابه‌جایی VPOC', 'ترکیب پروفایل حجمی با سطوح قیمت'],
    openingPhrases: ['نقشه‌ی پروفایل حجمی {instrument}...', 'نواحی ارزش {instrument} نشان می‌دهند...', 'تحلیل VPOC و نواحی کلیدی حجم در {instrument}...'],
    closingPhrases: ['نقشه‌ی حجمی نهایی...', 'VPOC در حال جابه‌جایی...', 'نواحی ارزش مهم‌ترین مراجع هستند.'],
  },
  // ── Smart Money Analyst ──
  {
    id: 'kamran_smartmoney', name: 'کامران پورمحمدی — تحلیلگر پول هوشمند', gender: 'male', experience: 19,
    schoolAffinity: 'hybrid', toneAffinity: 'alert',
    style: { sentences: 'هوشیار و تحقیقی', vocabulary: 'VSA و نهادی', emphasis: 'ردپای پول هوشمند' },
    signaturePhrases: ['ردپای پول هوشمند', 'تله‌ی خرید/فروش', 'انباشت نهادی', 'توزیع حرفه‌ای', 'نشانه‌های VSA'],
    writingHabits: ['تحلیل رابطه‌ی حجم و کندل', 'شناسایی تله‌های معاملاتی', 'بررسی ورود و خروج نهادها', 'تأکید بر نشانه‌های عرضه و تقاضای حرفه‌ای'],
    openingPhrases: ['ردپای پول هوشمند در {instrument}...', 'نشانه‌های VSA در {instrument}...', 'تحلیل رفتار نهادی در {instrument}...'],
    closingPhrases: ['پول هوشمند حرف آخر...', 'مراقب تله‌ها باشید...', 'انباشت یا توزیع؟ پاسخ در حجم است.'],
  },
  // ── Market Psychology Specialist ──
  {
    id: 'nazanin_psychology', name: 'نازنین بهرامی — روانشناس بازار', gender: 'female', experience: 11,
    schoolAffinity: 'hybrid', toneAffinity: 'balanced',
    style: { sentences: 'تحلیلی و عمیق', vocabulary: 'روانشناختی و رفتاری', emphasis: 'روانشناسی جمعی بازار' },
    signaturePhrases: ['ترس و طمع در تعادل', 'احساسات غالب بازار', 'رفتار گله‌ای معامله‌گران', 'نقطه‌ی اوج احساسات', 'واکنش روانشناختی در سطوح'],
    writingHabits: ['تحلیل احساسات غالب در بازار', 'بررسی رفتار گله‌ای', 'توصیف واکنش‌های روانشناختی', 'ترکیب روانشناسی با تکنیکال'],
    openingPhrases: ['روانشناسی بازار {instrument} امروز...', 'احساسات معامله‌گران {instrument}...', 'نگاهی به رفتار روانشناختی بازار {instrument}...'],
    closingPhrases: ['احساسات در حال تغییر...', 'ترس و طمع تعیین‌کننده‌اند...', 'بازار آینه‌ی ذهن جمعی است.'],
  },
  // ── Risk Manager ──
  {
    id: 'javad_riskmanager', name: 'جواد طباطبایی — مدیر ریسک', gender: 'male', experience: 23,
    schoolAffinity: 'hybrid', toneAffinity: 'conservative',
    style: { sentences: 'محاسباتی و دقیق', vocabulary: 'مدیریت ریسک و پورتفولیو', emphasis: 'کنترل زیان و بهینه‌سازی موقعیت' },
    signaturePhrases: ['نسبت ریسک به بازده باید حداقل ۱ به ۲ باشد', 'اندازه‌ی موقعیت بر اساس ATR', 'حد ضرر قطعی و غیرقابل تخطی', 'تنوع‌بخشی پورتفولیو', 'بیشینه‌ی افت مجاز ۲ درصد'],
    writingHabits: ['محاسبه‌ی دقیق اندازه‌ی موقعیت', 'تعیین حد ضرر بر اساس نوسانات', 'ارائه‌ی سناریوهای بدترین حالت', 'تأکید بر حفظ سرمایه در اولویت'],
    openingPhrases: ['از منظر مدیریت ریسک، وضعیت {instrument}...', 'محاسبه‌ی ریسک معامله در {instrument}...', 'ارزیابی نوسانات و تعیین موقعیت مناسب در {instrument}...'],
    closingPhrases: ['ریسک کنترل‌شده...', 'حد ضرر با دقت تعیین شده...', 'حفظ سرمایه مقدم بر سود است.'],
  },
  // ── Swing Trader Analyst ──
  {
    id: 'babak_swing', name: 'بابک مرادی — تحلیلگر نوسان‌گیر', gender: 'male', experience: 14,
    schoolAffinity: 'oscillator', toneAffinity: 'aggressive',
    style: { sentences: 'سریع و نتیجه‌گرا', vocabulary: 'نوسان‌گیری و تایم‌فریم میانی', emphasis: 'شکار نوسان‌های میان‌مدت' },
    signaturePhrases: ['نوسان‌گیری هوشمند', 'پولبک به میانگین', 'نقطه‌ی ورود میانی', 'هدف چندروزه', 'نوسان قابل برنامه‌ریزی'],
    writingHabits: ['تحلیل تایم‌فریم‌های ۴ ساعته و روزانه', 'تأکید بر نقاط ورود و خروج سریع', 'ترکیب اسیلاتور با سطوح کلیدی', 'برنامه‌ریزی ۳ تا ۱۰ روزه'],
    openingPhrases: ['فرصت نوسان‌گیری در {instrument}...', 'نوسان قابل برنامه‌ریزی در {instrument}...', 'سیگنال نوسان‌گیری میانی در {instrument}...'],
    closingPhrases: ['نوسان هدف‌گذاری شد...', 'برنامه نوسان‌گیری مشخص...', 'منتظر رسیدن به هدف باشید.'],
  },
  // ── Position Trader Analyst ──
  {
    id: 'mahnaz_position', name: 'مهناز رحماندوست — تحلیلگر پوزیشن', gender: 'female', experience: 17,
    schoolAffinity: 'classical', toneAffinity: 'optimistic',
    style: { sentences: 'عمیق و استراتژیک', vocabulary: 'بلندمدت و ساختاری', emphasis: 'موقعیت‌های هفته‌ای تا ماهانه' },
    signaturePhrases: ['موقعیت بلندمدت', 'روند هفتگی', 'سطح کلیدی ساختاری', 'هدف ماهانه', 'تحلیل چندتایم‌فریمی'],
    writingHabits: ['بررسی تایم‌فریم‌های هفتگی و روزانه', 'تأکید بر سطوح ساختاری بزرگ', 'صبر برای تکمیل الگوها', 'تحلیل بلندمدت با دیدگاه سرمایه‌گذاری'],
    openingPhrases: ['تحلیل پوزیشن بلندمدت {instrument}...', 'نگاهی هفتگی به وضعیت {instrument}...', 'سطوح ساختاری کلیدی در {instrument}...'],
    closingPhrases: ['پوزیشن بلندمدت مستدل...', 'صبر برای تکمیل سناریو...', 'چشم‌انداز هفته‌های آینده مثبت است.'],
  },
  // ── Day Trader Analyst ──
  {
    id: 'saeed_daytrade', name: 'سعید بختیاری — تحلیلگر روزانه', gender: 'male', experience: 10,
    schoolAffinity: 'oscillator', toneAffinity: 'aggressive',
    style: { sentences: 'فوق‌سریع و ضربتی', vocabulary: 'اسکالپینگ و روزانه', emphasis: 'نقاط ورود دقیق در همان روز' },
    signaturePhrases: ['نقطه‌ی ورود دقیق', 'خروج تا پایان جلسه', 'تایم‌فریم ۵ و ۱۵ دقیقه', 'اسکالپ سریع', 'سیگنال لحظه‌ای'],
    writingHabits: ['تحلیل تایم‌فریم‌های ۵ و ۱۵ دقیقه', 'تأکید بر ورود و خروج در همان روز', 'ترکیب حجم لحظه‌ای با اسیلاتور', 'سرعت بالای تصمیم‌گیری'],
    openingPhrases: ['فرصت معاملاتی امروز در {instrument}...', 'سیگنال روزانه {instrument}...', 'نقاط ورود و خروج روزانه در {instrument}...'],
    closingPhrases: ['زمان خروج نزدیک...', 'سود روزانه هدف اصلی...', 'موقعیت تا پایان جلسه باز است.'],
  },
  // ── Contrarian Analyst ──
  {
    id: 'pouya_contra', name: 'پویا جعفری — تحلیلگر مخالف‌رونده', gender: 'male', experience: 15,
    schoolAffinity: 'hybrid', toneAffinity: 'alert',
    style: { sentences: 'واکنشی و متضاد', vocabulary: 'ضدرونده و استثنایی', emphasis: 'یافتن فرصت‌های پنهان' },
    signaturePhrases: ['وقتی همه می‌خرند، بفروشید', 'فرصت پنهان در تضاد', 'اشباع احساسات نشانه‌ی برگشت', 'دوره‌ی افراط همیشه تمام می‌شود', 'بهترین فرصت‌ها در نقطه‌ی اوج ترس'],
    writingHabits: ['تحلیل رفتار مخالف جمعیت', 'شناسایی نقاط افراطی', 'تأکید بر واگرایی‌های پنهان', 'ارائه‌ی دیدگاه متضاد با اجماع'],
    openingPhrases: ['برخلاف انتظار عمومی، {instrument}...', 'فرصت پنهان در {instrument}...', 'وقتی همه در یک جهت هستند، {instrument}...'],
    closingPhrases: ['بهترین فرصت‌ها در تضاد...', 'این دیدگاه مخالف عمومی است...', 'صبر کنید تا جمعیت اشتباه کند.'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: Phrase Bank (Expanded — 500+ phrases)
// ═══════════════════════════════════════════════════════════════════════════════

export const PHRASE_BANK: Record<string, Record<string, string[]>> = {
  introduction: {
    general: [
      'بر اساس آخرین داده‌های بازار و تحلیل جامع تکنیکال...',
      'نگاهی دقیق به وضعیت امروز بازار نشان می‌دهد که...',
      'با بررسی اندیکاتورها و الگوهای قیمتی، به نتایج زیر رسیده‌ایم...',
      'تحلیل امروز با تمرکز بر {school} و با رویکرد {style} انجام شده است...',
      'در ادامه، به بررسی دقیق وضعیت {instrument} با استفاده از ابزارهای تحلیلی می‌پردازیم...',
      'بازار {instrument} امروز در وضعیت {market_status} قرار دارد...',
      'تحلیل امروز {instrument} در تایم‌فریم روزانه نشان‌دهنده‌ی {key_finding} است...',
      'با توجه به تحولات اخیر بازار {instrument}، تحلیل جامعی انجام شده است...',
      'در این گزارش، به تحلیل {instrument} با رویکرد {school} می‌پردازیم...',
      'وضعیت امروز {instrument} با {indicator_status} و {pattern_status} همراه است...',
      'داده‌های تکنیکال امروز {instrument} تصویر روشنی از آینده ترسیم می‌کنند...',
      'بررسی همزمان چندین شاخص کلیدی در {instrument}...',
      'خلاصه‌ی وضعیت فعلی {instrument} از منظر تکنیکال...',
      'امروز {instrument} در یک نقطه‌ی عطف مهم قرار دارد...',
      'ترکیب داده‌های قیمتی و اندیکاتوری در {instrument}...',
    ],
    classical: [
      'با بررسی دقیق سطوح حمایت و مقاومت و الگوهای کلاسیک در {instrument}...',
      'تحلیل کلاسیک {instrument} با تأکید بر خطوط روند و الگوهای قیمتی...',
      'در چارچوب تحلیل کلاسیک، وضعیت {instrument} به‌صورت زیر بررسی می‌شود...',
      'الگوهای کلاسیک شکل‌گرفته در {instrument}...',
      'سطوح کلیدی کلاسیک {instrument} نقشه‌ی واکنش‌های آتی را ترسیم می‌کنند...',
    ],
    oscillator: [
      'بر اساس سیگنال‌های اسیلاتورها و تشخیص واگرایی‌ها در {instrument}...',
      'تحلیل مومنتوم {instrument} با استفاده از RSI، MACD و استوکاستیک...',
      'اسیلاتورهای {instrument} نشان‌دهنده‌ی {oscillator_signal} هستند...',
      'مومنتوم و قدرت حرکت {instrument}...',
      'واگرایی‌ها و همگرایی‌های اسیلاتوری در {instrument}...',
    ],
    harmonic: [
      'با محاسبه‌ی نسبت‌های فیبوناچی و تشخیص الگوهای هارمونیک در {instrument}...',
      'تحلیل هارمونیک {instrument} با تأکید بر نسبت‌های طلایی...',
      'نسبت‌های فیبوناچی و نواحی PRZ در {instrument}...',
      'تلاقی نسبت‌های هارمونیک در {instrument}...',
    ],
    elliott: [
      'بر اساس ساختار امواج الیوت و تشخیص الگوهای موجی در {instrument}...',
      'تحلیل موجی {instrument} با شناسایی امواج حرکتی و اصلاحی...',
      'شمارش امواج الیوت در {instrument}...',
      'ساختار ۵-۳ موجی {instrument}...',
    ],
    volume: [
      'با بررسی حجم معاملات و جریان نقدینگی {instrument}...',
      'تحلیل حجمی {instrument} نشان‌دهنده‌ی الگوی جریان پول...',
      'جریان پول و تأیید حجمی در {instrument}...',
      'OBV و شاخص‌های حجمی {instrument}...',
    ],
    hybrid: [
      'رویکرد ترکیبی در تحلیل {instrument} با تلفیق چند مکتب...',
      'تحلیل چندبُعدی {instrument} با بررسی هم‌زمان ابزارهای مختلف...',
      'جمع‌بندی سیگنال‌ها از مکاتب مختلف تحلیلی در {instrument}...',
      'هم‌گرایی و واگرایی شاخص‌ها در تحلیل ترکیبی {instrument}...',
      'تصمیم‌گیری جامع بر اساس تلفیق داده‌های {instrument}...',
    ],
  },

  // ── Support/Resistance Analysis (20+ phrases) ──
  support_resistance: {
    near_support: [
      'قیمت در نزدیکی سطح حمایت {level} قرار دارد و واکنش مثبت قابل انتظار است.',
      'سطح حمایت {level} با {count} برخورد قبلی تأیید شده و ناحیه‌ی تقاضای قدرتمندی محسوب می‌شود.',
      'نزدیکی به حمایت {level}، فرصت ورود با نسبت ریسک به بازده مناسب را فراهم کرده است.',
      'فشار خرید در محدوده‌ی حمایت {level} در حال افزایش است.',
      'حمایت {level} یک ناحیه‌ی کلیدی عرضه و تقاضا محسوب می‌شود.',
      'اگر حمایت {level} حفظ شود، مسیر صعودی مجدداً فعال خواهد شد.',
      'حجم معاملات در نزدیکی حمایت {level} افزایش یافته که نشانه‌ی ورود خریداران است.',
    ],
    near_resistance: [
      'قیمت به سطح مقاومت {level} نزدیک شده و واکنش منفی محتمل است.',
      'سطح مقاومت {level} با {count} برخورد قبلی، سد محکمی در برابر قیمت ایجاد کرده است.',
      'نزدیکی به مقاومت {level}، هشدار احتیاط را فعال کرده است.',
      'فشار فروش در محدوده‌ی مقاومت {level} قابل مشاهده است.',
      'مقاومت {level} ناحیه‌ی عرضه‌ی قدرتمند بازار محسوب می‌شود.',
      'شکست مقاومت {level} نیازمند حجم بالای معاملات است.',
    ],
    breakout: [
      'شکست مقاومت {level} با حجم بالا تأیید شده و مسیر صعودی باز شده است.',
      'شکست حمایت {level} نشانه‌ی ضعف خریداران و آغاز روند نزولی است.',
      'شکست ساختاری سطوح کلیدی، تغییر فاز بازار را تأیید می‌کند.',
      'پولبک به سطح شکست‌داده‌شده {level} فرصت ورود مجدد را فراهم کرده است.',
      'شکست کاذب سطوح نیازمند تأیید با بسته شدن کندل است.',
      'تثبیت قیمت بالای مقاومت {level}، الگوی صعودی قوی‌ای را تأیید کرده است.',
    ],
    zones: [
      'ناحیه‌ی حمایت بین {low} و {high} یک محدوده‌ی جذاب برای ورود است.',
      'ناحیه‌ی مقاومت بین {low} و {high} باید با احتیاط بررسی شود.',
      'تلاقی چندین سطح کلیدی در ناحیه‌ی {level} واکنش قوی را تضمین می‌کند.',
      'نواحی عرضه و تقاضا نقشه‌ی مهمی از نقاط واکنش بازار ترسیم می‌کنند.',
      'فاصله‌ی قیمت از نزدیک‌ترین حمایت {support} و مقاومت {resistance} تعیین‌کننده‌ی جهت بعدی است.',
    ],
  },

  // ── Trend Analysis (20+ phrases) ──
  trend_analysis: {
    bullish: [
      'روند {instrument} در تایم‌فریم روزانه صعودی ارزیابی می‌شود.',
      'میانگین‌های متحرک نشان‌دهنده‌ی یک روند صعودی پایدار هستند.',
      'قیمت {instrument} با موفقیت از سطوح حمایت عبور کرده و به سمت مقاومت‌ها حرکت می‌کند.',
      'روند صعودی {instrument} با قدرت {trend_strength} در حال ادامه است.',
      'شکست سقف‌های قبلی نشان‌دهنده‌ی تداوم روند صعودی است.',
      'خط روند صعودی با چندین برخورد تأیید شده است.',
      'کانال صعودی {instrument} نشان‌دهنده‌ی حرکت منظم قیمت به سمت بالا است.',
      'EMAها به ترتیب صعودی چیده شده‌اند که تأیید‌کننده‌ی روند صعودی است.',
      'قیمت بالاتر از هر سه میانگین متحرک قرار دارد.',
      'DI+ بالاتر از DI- و ADX بالای ۲۵، روند صعودی قدرتمندی را تأیید می‌کند.',
      'سقف‌ها و کف‌های بالاتر تأیید‌کننده‌ی روند صعودی سالم هستند.',
      'شیب خط روند صعودی نشان‌دهنده‌ی شتاب حرکتی مثبت است.',
    ],
    bearish: [
      'روند {instrument} در تایم‌فریم روزانه نزولی ارزیابی می‌شود.',
      'میانگین‌های متحرک نشان‌دهنده‌ی یک روند نزولی پایدار هستند.',
      'قیمت {instrument} در حال شکست سطوح حمایت و حرکت به سمت پایین است.',
      'روند نزولی {instrument} با قدرت {trend_strength} در حال ادامه است.',
      'شکست کف‌های قبلی نشان‌دهنده‌ی تداوم روند نزولی است.',
      'EMAها به ترتیب نزولی چیده شده‌اند و فشار فروش غالب است.',
      'DI- بالاتر از DI+ و ADX در حال افزایش، تشدید روند نزولی را نشان می‌دهد.',
      'قیمت زیر تمامی میانگین‌های متحرک قرار دارد.',
      'هر بار که قیمت به میانگین‌ها نزدیک می‌شود، با فروش مواجه می‌شود.',
      'سقف‌ها و کف‌های پایین‌تر تأیید‌کننده‌ی روند نزولی هستند.',
    ],
    neutral: [
      'روند {instrument} در تایم‌فریم روزانه خنثی و رنج ارزیابی می‌شود.',
      'قیمت {instrument} در محدوده‌ی مشخصی در حال نوسان است.',
      'میانگین‌های متحرک هم‌پوشانی دارند و روند مشخصی قابل تشخیص نیست.',
      'ADX پایین‌تر از ۲۰ نشان‌دهنده‌ی نبود روند قوی است.',
      'بازار در حالت تثبیت و انتظار برای تعیین جهت آینده است.',
      'نوسان محدود قیمت در یک کانال افقی، نشان‌دهنده‌ی تعادل خرید و فروش است.',
      'بازار در انتظار یک کاتالیزور برای خروج از محدوده‌ی رنج است.',
    ],
    strength: [
      'قدرت روند با ADX {adx_value} قوی ارزیابی می‌شود.',
      'شتاب حرکت نشان‌دهنده‌ی قدرت بالای روند است.',
      'حجم بالا و حرکت قیمت تأییدکننده‌ی قدرت روند است.',
      'قدرت روند با ADX {adx_value} متوسط ارزیابی می‌شود.',
      'حرکت با سرعت متعادل و قابل‌قبولی در حال پیشرفت است.',
      'قدرت روند با ADX {adx_value} ضعیف ارزیابی می‌شود.',
      'کمبود شتاب و حجم پایین نشان‌دهنده‌ی ضعف روند است.',
    ],
  },

  // ── Entry/Exit Points (15+ phrases) ──
  entry_exit: {
    entry: [
      'نقطه‌ی ورود ایده‌آل در قیمت {entry_price} تعیین شده است.',
      'منطقه‌ی ورود در بازه‌ی {zone_start} تا {zone_end} قرار دارد.',
      'تأیید ورود با {confirmation_signal} انجام می‌شود.',
      'منتظر پولبک به منطقه‌ی ورود باشید.',
      'نقطه‌ی ورود در تلاقی حمایت و واگرایی مثبت قرار دارد.',
      'ورود پله‌ای در سه نقطه توصیه می‌شود: {p1}، {p2} و {p3}.',
      'شرایط ورود: بسته شدن کندل بالاتر از {level} با حجم بالا.',
    ],
    stop_loss: [
      'حد ضرر در {stop_loss} با {stop_reason} تعیین شده است.',
      'سطح حد ضرر در {stop_level} قرار دارد.',
      'حد ضرر باید با دقت رعایت شود تا از زیان بیشتر جلوگیری شود.',
      'حد ضرر بر اساس ATR در فاصله‌ی {atr_distance} از نقطه‌ی ورود قرار دارد.',
      'حد ضرر زیر آخرین کف {level} تعیین شده است.',
    ],
    take_profit: [
      'اهداف قیمتی به‌صورت {tp1}، {tp2}، {tp3} تعیین شده‌اند.',
      'هدف اول در {tp1} و هدف دوم در {tp2} قرار دارد.',
      'نسبت ریسک به بازده {risk_reward} برای این موقعیت مناسب است.',
      'هدف قیمتی بلندمدت در محدوده‌ی {tp_long} قرار دارد.',
      'سیاست خروج مرحله‌ای: نیمه در {tp1} و بقیه در {tp2}.',
    ],
    position: [
      'حجم معاملاتی {position_size} با توجه به سطح اطمینان توصیه می‌شود.',
      'مدیریت سرمایه اصولی، کلید موفقیت در این معامله است.',
      'ریسک هر معامله نباید بیشتر از ۲ درصد سرمایه باشد.',
      'اندازه‌ی موقعیت بر اساس نوسانات (ATR) محاسبه شده است.',
      'تخصیص حداکثر {max_risk} از سرمایه به این معامله توصیه می‌شود.',
    ],
  },

  // ── Risk Management (15+ phrases) ──
  risk_management: {
    general: [
      'مدیریت ریسک اولویت اول هر معامله است و نباید نادیده گرفته شود.',
      'نسبت ریسک به بازده {rr_ratio} برای این موقعیت محاسبه شده است.',
      'حد ضرر علمی بر اساس نوسانات بازار و ساختار قیمت تعیین شده است.',
      'اندازه‌ی موقعیت باید به‌گونه‌ای باشد که حداکثر زیان ۲ درصد سرمایه باشد.',
      'تنوع‌بخشی پورتفولیو ریسک کلی را به‌شدت کاهش می‌دهد.',
      'بدون حد ضرر، هیچ معامله‌ای نباید آغاز شود.',
      'بیشینه‌ی افت مجاز برای این معامله {max_drawdown} تعیین شده است.',
      'ریسک سیستماتیک بازار باید در محاسبات مدیریت ریسک لحاظ شود.',
    ],
    warnings: [
      'هشدار: ریسک نزولی بالاست و احتیاط شدید توصیه می‌شود.',
      'نسبت ریسک به بازده در شرایط فعلی نامطلوب است.',
      'نوسانات بالا نیازمند کاهش اندازه‌ی موقعیت است.',
      'نزدیکی به سطوح کلیدی، ریسک واکنش ناگهانی را افزایش داده است.',
      'عدم تأیید حجمی، ریسک شکست کاذب را افزایش می‌دهد.',
      'سیگنال‌های متناقض هشدار می‌دهند که ورود پرریسک است.',
    ],
    strategies: [
      'خروج مرحله‌ای بخشی از سود را قفل و بخشی را باز نگه می‌دارد.',
      'جابه‌جایی حد ضرر به نقطه‌ی ورود (ریسک‌فری) پس از رسیدن به {tp1} توصیه می‌شود.',
      'تلفیق حد ضرر ثابت و تریلینگ‌استاپ استراتژی بهینه‌ای است.',
      'هجینگ در شرایط عدم قطعیت، ابزار مهم مدیریت ریسک است.',
    ],
  },

  // ── Volume Analysis (10+ phrases) ──
  volume_analysis: {
    confirming: [
      'حجم معاملات بالا تأیید‌کننده‌ی حرکت فعلی قیمت است.',
      'OBV در حال افزایش و تأیید‌کننده‌ی روند صعودی است.',
      'حجم بالا در نقاط شکست، اعتبار الگو را افزایش داده است.',
      'جریان نقدینگی مثبت نشان‌دهنده‌ی ورود پول هوشمند است.',
      'MFI نشان‌دهنده‌ی ورود قوی پول در محدوده‌ی فعلی است.',
    ],
    warning: [
      'کاهش حجم در روند صعودی نشانه‌ی ضعف خریداران است.',
      'OBV رو به پایین و نشانه‌ی خروج پول هوشمند است.',
      'MFI نشان‌دهنده‌ی اشباع خرید حجمی است.',
      'MFI نشان‌دهنده‌ی اشباع فروش حجمی است.',
      'حجم پایین در شکست سطوح، احتمال شکست کاذب را افزایش می‌دهد.',
    ],
    smart_money: [
      'الگوی حجمی نشان‌دهنده‌ی ورود پله‌ای نهادهای بزرگ است.',
      'توزیع حرفه‌ای در سطوح بالایی مشاهده می‌شود.',
      'انباشت نهادی در محدوده‌ی حمایتی در حال انجام است.',
      'تله‌ی حجمی در ناحیه‌ی فعلی تشخیص داده شده است.',
      'تغییر الگوی حجم نشان‌دهنده‌ی جابه‌جایی مالکیت است.',
    ],
  },

  indicators: {
    // ── Bollinger Bands (10+ phrases) ──
    bollinger: [
      'قیمت در نیمه‌ی بالایی باند بولینگر قرار دارد.',
      'قیمت در نیمه‌ی پایینی باند بولینگر قرار دارد.',
      'باندهای بولینگر در حال جمع شدن (Squeeze) هستند که نشان‌دهنده‌ی آمادگی برای حرکت بزرگ است.',
      'باندهای بولینگر در حال باز شدن و نوسان افزایشی است.',
      'قیمت به باند بالایی بولینگر برخورد کرده و واکنش منفی نشان داده است.',
      'قیمت به باند پایینی بولینگر واکنش مثبت داده و الگوی بازگشتی شکل گرفته است.',
      'فاصله‌ی قیمت از باند میانی نشان‌دهنده‌ی قدرت حرکت است.',
      'عبور قیمت از باند بالایی با حجم بالا، نشانه‌ی شتاب صعودی است.',
      'قیمت در حال نوسان بین باندهای بولینگر و رنج محدود است.',
      'عرضه‌ی باندهای بولینگر (Bandwidth) در پایین‌ترین حد خود قرار دارد که نشانه‌ی انفجار نوسان آتی است.',
      'نسبت قیمت به باند بالایی و پایینی، محدوده‌ی نوسان را مشخص می‌کند.',
    ],
    // ── RSI Analysis (10+ phrases) ──
    rsi_overbought: [
      'RSI با مقدار {rsi_value} در محدوده‌ی اشباع خرید قرار دارد.',
      'اشباع خرید در RSI نشان‌دهنده‌ی احتمال اصلاح کوتاه‌مدت است.',
      'RSI بالای ۷۰، هشدار اشباع خرید را فعال کرده است.',
    ],
    rsi_oversold: [
      'RSI با مقدار {rsi_value} در محدوده‌ی اشباع فروش قرار دارد.',
      'اشباع فروش در RSI نشان‌دهنده‌ی احتمال برگشت صعودی است.',
      'RSI پایین‌تر از ۳۰، فرصت خرید بالقوه‌ای را نشان می‌دهد.',
    ],
    rsi_neutral: [
      'RSI با مقدار {rsi_value} در محدوده‌ی خنثی قرار دارد.',
      'RSI در محدوده نرمال، فشار خرید و فروش متعادل است.',
    ],
    rsi_divergence: [
      'واگرایی مثبت بین قیمت و RSI تشخیص داده شده است.',
      'واگرایی منفی بین قیمت و RSI هشدار برگشت می‌دهد.',
      'واگرایی RSI با تأیید حجم، سیگنال قوی‌تری محسوب می‌شود.',
    ],
    rsi_trend: [
      'RSI در روند صعودی، بالاتر از خط میانه ۵۰ تثبیت شده است.',
      'RSI در روند نزولی، زیر خط میانه ۵۰ ناپایدار است.',
      'شکست خط میانه‌ی RSI نشانه‌ی تغییر مومنتوم است.',
      'الگوی RSI نشان‌دهنده‌ی ادامه‌ی روند فعلی است.',
    ],
    // ── MACD Analysis (10+ phrases) ──
    macd_bullish: [
      'MACD صعودی است و هیستوگرام مثبت نشان‌دهنده‌ی قدرت روند است.',
      'تقاطع صعودی MACD با خط سیگنال اتفاق افتاده است.',
      'هیستوگرام MACD در حال گسترش مثبت است.',
    ],
    macd_bearish: [
      'MACD نزولی است و هیستوگرام منفی نشان‌دهنده‌ی قدرت روند نزولی است.',
      'تقاطع نزولی MACD با خط سیگنال اتفاق افتاده است.',
      'هیستوگرام MACD در حال گسترش منفی است.',
    ],
    macd_neutral: [
      'MACD در وضعیت خنثی قرار دارد و تغییرات محسوسی مشاهده نمی‌شود.',
      'MACD و خط سیگنال نزدیک به هم هستند و سیگنال مشخصی نمی‌دهند.',
    ],
    macd_divergence: [
      'واگرایی مثبت MACD نشانه‌ی ضعف روند نزولی است.',
      'واگرایی منفی MACD هشدار تضعیف روند صعودی را می‌دهد.',
      'هیستوگرام MACD در حال کاهش ولی هنوز مثبت است که نشانه‌ی کمرنگ شدن مومنتوم صعودی است.',
      'تقاطع MACD در محدوده‌ی صفر، سیگنال قوی‌تری محسوب می‌شود.',
    ],
    macd_zero: [
      'MACD در حال نزدیک شدن به خط صفر است که نقطه‌ی تصمیم مهمی محسوب می‌شود.',
      'عبور MACD از خط صفر، تغییر فاز مومنتوم را تأیید می‌کند.',
    ],
    // ── Stochastic Analysis (10+ phrases) ──
    stochastic: [
      'استوکاستیک K و D در منطقه اشباع خرید قرار دارند.',
      'استوکاستیک در منطقه اشباع فروش، سیگنال برگشت احتمالی را نشان می‌دهد.',
      'تقاطع صعودی استوکاستیک K و D رخ داده است.',
      'تقاطع نزولی استوکاستیک K و D هشدار نزولی است.',
      'استوکاستیک K از D فاصله گرفته که نشانه‌ی شتاب حرکت است.',
      'واگرایی استوکاستیک با قیمت، سیگنال بازگشت قوی را ارائه می‌دهد.',
      'استوکاستیک در ناحیه‌ی میانی نوسان می‌کند و سیگنال مشخصی نمی‌دهد.',
      'تقاطع استوکاستیک در منطقه اشباع، اهمیت بیشتری دارد.',
      'استوکاستیک سریع سیگنال‌های زودتری نسبت به نسخه‌ی کند می‌دهد.',
      'خطوط استوکاستیک در حال هم‌گرایی هستند که نشانه‌ی تعادل مومنتوم است.',
    ],
    // ── ADX/Trend Strength (10+ phrases) ──
    adx: [
      'ADX با مقدار {adx_value} نشان‌دهنده‌ی {adx_interpretation} است.',
      'ADX در حال افزایش است که نشان‌دهنده‌ی تقویت روند است.',
      'کاهش ADX نشان‌دهنده‌ی تضعیف روند است.',
      'ADX بالای ۲۵ تأیید‌کننده‌ی روند قدرتمند است.',
      'ADX پایین‌تر از ۲۰ نشان‌دهنده‌ی بازار بدون روند و رنج است.',
      'DI+ بالاتر از DI-، تأیید‌کننده‌ی غلبه‌ی خریداران است.',
      'DI- بالاتر از DI+، نشان‌دهنده‌ی تسلط فروشندگان بر بازار است.',
      'فاصله‌ی DI+ و DI- میزان قدرت جهت روند را نشان می‌دهد.',
      'ADX بالای ۵۰ نشان‌دهنده‌ی روند بسیار قدرتمند و غیرقابل توقف است.',
      'تقاطع DI+ و DI- سیگنال تغییر احتمالی جهت روند را ارائه می‌دهد.',
      'ADX همراه با افزایش DI+، بهترین ترکیب برای ورود در روند صعودی است.',
    ],
    volume_indicators: [
      'OBV در حال افزایش و تأیید‌کننده‌ی روند صعودی است.',
      'OBV رو به پایین و نشانه‌ی خروج پول هوشمند است.',
      'MFI نشان‌دهنده‌ی اشباع خرید حجمی است.',
      'MFI نشان‌دهنده‌ی اشباع فروش حجمی است.',
    ],
  },

  patterns: {
    classic_bullish: [
      'الگوی سر و شانه معکوس با اعتبار بالا تشخیص داده شده است.',
      'الگوی مثلث صعودی در حال شکست با حجم بالا است.',
      'الگوی پرچم صعودی پس از حرکت تند شکل گرفته است.',
      'الگوی کف دوقلو با شکست خط گردن تأیید شده است.',
      'الگوی فنجان و دسته در حال تکمیل است.',
    ],
    classic_bearish: [
      'الگوی سر و شانه سقفی هشدار نزولی می‌دهد.',
      'الگوی سقف دوقلو با شکست خط گردن نزولی تأیید شده است.',
      'الگوی مثلث نزولی در حال تکمیل است.',
      'الگوی پرچم نزولی پس از ریزش شکل گرفته است.',
    ],
    harmonic_bullish: [
      'الگوی هارمونیک صعودی با نسبت‌های دقیق تشخیص داده شده است.',
      'ناحیه‌ی برگشت احتمالی (PRZ) در محدوده‌ی حمایت قرار دارد.',
      'تلاقی نسبت‌های فیبوناچی نقطه‌ی برگشت قوی را نشان می‌دهد.',
    ],
    harmonic_bearish: [
      'الگوی هارمونیک نزولی در ناحیه‌ی مقاومت شناسایی شده است.',
      'PRZ نزولی با تلاقی چندین نسبت فعال شده است.',
    ],
    candlestick_bullish: [
      'الگوی چکش (Hammer) در کف شکل گرفته، سیگنال بازگشت صعودی است.',
      'الگوی پوشای صعودی (Bullish Engulfing) قدرت خریداران را نشان می‌دهد.',
      'ستاره صبحگاهی (Morning Star) در سطح حمایت ظاهر شده است.',
      'الگوی سه‌سرباز سفید (Three White Soldiers) صعودی قوی را تأیید می‌کند.',
    ],
    candlestick_bearish: [
      'الگوی شهاب (Shooting Star) هشدار نزولی می‌دهد.',
      'الگوی پوشای نزولی (Bearish Engulfing) قدرت فروشندگان را نشان می‌دهد.',
      'ستاره عصرگاهی (Evening Star) در سطح مقاومت ظاهر شده است.',
      'الگوی سه کلاغ سیاه (Three Black Crows) نزولی قوی را تأیید می‌کند.',
    ],
    elliott: [
      'ساختار موجی نشان‌دهنده‌ی الگوی حرکتی ۵ موجی است.',
      'موج اصلاحی ABC در حال تکمیل است.',
      'نسبت‌های فیبوناچی بین امواج، دقت تحلیل را تأیید می‌کند.',
      'موج سوم (قوی‌ترین موج) در حال شکل‌گیری است.',
      'موج پنجم و انتهای روند حرکتی نزدیک است.',
    ],
    no_pattern: [
      'الگوی قیمتی قابل اعتمادی در حال حاضر شناسایی نشده است.',
      'الگوها در مرحله‌ی شکل‌گیری هستند و هنوز تأیید نشده‌اند.',
    ],
  },

  // ── Price Targets (10+ phrases) ──
  price_targets: {
    bullish_targets: [
      'هدف قیمتی اول در محدوده‌ی {target1} و هدف دوم در {target2} تعیین شده است.',
      'بر اساس نسبت‌های فیبوناچی اکستنشن، هدف صعودی در {fib_target} قرار دارد.',
      'تارگت صعودی بر اساس اندازه‌ی الگو در {pattern_target} محاسبه شده است.',
      'اولین مقاومت قابل توجه در {resistance1} و دومین در {resistance2} قرار دارد.',
      'اگر شکست تأیید شود، هدف بلندمدت در {long_target} قابل دسترسی است.',
    ],
    bearish_targets: [
      'هدف نزولی اول در {support1} و هدف دوم در {support2} تعیین شده است.',
      'بر اساس اندازه‌ی الگوی نزولی، هدف در {pattern_target} قرار دارد.',
      'کف قبلی در {previous_low} اولین هدف نزولی محسوب می‌شود.',
      'اگر حمایت شکسته شود، هدف بعدی در {next_support} خواهد بود.',
    ],
    range_targets: [
      'قیمت احتمالاً در محدوده‌ی {range_low} تا {range_high} نوسان خواهد کرد.',
      'پیش‌بینی محدوده‌ی نوسان بر اساس ATR: {atr_range}.',
      'باندهای بولینگر محدوده‌ی نوسان احتمالی را بین {bb_low} و {bb_high} نشان می‌دهند.',
      'پیش‌بینی نوسان روزانه بر اساس نوسان‌پذیری تاریخی: {daily_range}.',
    ],
  },

  // ── Scenario Discussion (15+ phrases) ──
  scenario_discussion: {
    multi_scenario: [
      'سه سناریوی اصلی برای آینده‌ی {instrument} قابل تصور است.',
      'سناریوی صعودی با احتمال {prob_up} و سناریوی نزولی با احتمال {prob_down} محاسبه شده است.',
      'محتمل‌ترین سناریو با احتمال {dominant_prob} سناریوی {dominant_name} است.',
      'تفاوت احتمال بین سناریوهای صعودی و نزولی، تمایل بازار را نشان می‌دهد.',
      'سناریوی بدبینانه با احتمال {worst_prob} باید در مدیریت ریسک لحاظ شود.',
      'سناریوی خوش‌بینانه هدف قیمتی {optimistic_target} را پیش‌بینی می‌کند.',
      'احتمالات سناریوها بر اساس داده‌های تاریخی و الگوریتم بیزی محاسبه شده‌اند.',
    ],
    contingency: [
      'اگر سناریوی صعودی محقق شود، هدف قیمتی {up_target} در دسترس خواهد بود.',
      'در صورت تحقق سناریوی نزولی، حمایت {down_support} نقطه‌ی واکنش مهمی است.',
      'نقطه‌ی کلیدی تصمیم‌گیری بین سناریوها در قیمت {key_level} قرار دارد.',
      'شرط لغو سناریوی صعودی: بسته شدن زیر {cancel_level}.',
      'شرط فعال‌سازی سناریوی نزولی: شکست حمایت {trigger_level}.',
      'پلن B: اگر سناریوی اصلی محقق نشد، سناریوی جایگزین {alt_scenario} فعال می‌شود.',
      'نقشه‌ی سناریوها مسیرهای احتمالی آینده‌ی قیمت را مشخص می‌کند.',
    ],
  },

  // ── ML Prediction Discussion (10+ phrases) ──
  ml_prediction: {
    confirmation: [
      'پیش‌بینی مدل یادگیری ماشین (ML) با تحلیل تکنیکال همخوانی دارد.',
      'مدل ML جهت {ml_direction} با اطمینان {ml_confidence} را پیش‌بینی کرده است.',
      'سیستم وزن‌دهی بیزی، شاخص‌های با دقت بالاتر را برجسته کرده است.',
      'پیش‌بینی ML و تحلیل تکنیکال هر دو جهت {direction} را تأیید می‌کنند.',
      'مدل بیزی با احتمال {bayes_prob} سناریوی {scenario} را محتمل‌تر می‌داند.',
    ],
    divergence: [
      'تضاد جزئی بین ML و تحلیل تکنیکال وجود دارد که نیاز به احتیاط بیشتر دارد.',
      'پیش‌بینی ML جهت متفاوتی با سیگنال‌های تکنیکال نشان می‌دهد.',
      'هنگام تضاد بین ML و تکنیکال، محتاط‌تر عمل کنید.',
    ],
    integration: [
      'ترکیب پیش‌بینی ML با تحلیل تکنیکال، دقت تصمیم‌گیری را افزایش می‌دهد.',
      'وزن‌دهی بیزی به شاخص‌ها، نقطه‌ی قوت این سیستم تحلیلی است.',
      'مدل ML بر اساس {feature_count} ویژگی تکنیکال آموزش دیده است.',
      'پیش‌بینی‌های ML در {accuracy} درصد موارد با واقعیت مطابقت داشته است.',
    ],
  },

  forecast: {
    bullish: [
      'پیش‌بینی قیمت {instrument} برای دوره‌ی آینده صعودی است.',
      'با احتمال {probability}، قیمت به محدوده‌ی {target} خواهد رسید.',
      'بهترین سناریو حرکت به سمت {target} با احتمال {probability} است.',
      'در بهترین حالت، {instrument} با شکست {level} به {target} خواهد رسید.',
      'پیش‌بینی کوتاه‌مدت: حرکت به سمت بالا در دوره آینده.',
    ],
    bearish: [
      'پیش‌بینی قیمت {instrument} برای دوره‌ی آینده نزولی است.',
      'بدترین سناریو بازگشت به حمایت {support} با احتمال {probability} است.',
      'در بدترین حالت، {instrument} به حمایت {support} بازخواهد گشت.',
      'ریسک نزولی قابل توجهی وجود دارد.',
    ],
    neutral: [
      'محتمل‌ترین سناریو نوسان در محدوده‌ی {range} است.',
      'در حالت محتمل، {instrument} در محدوده‌ی فعلی نوسان خواهد کرد.',
      'بازار در انتظار کاتالیزور برای تعیین جهت است.',
    ],
    ml_integration: [
      'پیش‌بینی مدل یادگیری ماشین (ML) با تحلیل تکنیکال همخوانی دارد.',
      'مدل ML جهت {ml_direction} با اطمینان {ml_confidence} را پیش‌بینی کرده است.',
      'تضاد جزئی بین ML و تحلیل تکنیکال وجود دارد که نیاز به احتیاط بیشتر دارد.',
      'سیستم وزن‌دهی بیزی، شاخص‌های با دقت بالاتر را برجسته کرده است.',
    ],
  },

  conclusion: {
    buy: [
      'با توجه به تحلیل‌های انجام‌شده، تصمیم خرید با اطمینان {confidence} توصیه می‌شود.',
      'سیگنال خرید قوی با تأیید {confirmations} مشاهده می‌شود.',
      'شواهد کافی برای ورود خرید وجود دارد.',
    ],
    sell: [
      'با توجه به تحلیل‌ها، تصمیم فروش با اطمینان {confidence} توصیه می‌شود.',
      'سیگنال فروش قوی با تأیید {confirmations} مشاهده می‌شود.',
      'شواهد نزولی بر شواهد صعودی غلبه دارند.',
    ],
    hold: [
      'شرایط فعلی برای ورود مناسب نیست و بهتر است منتظر بمانیم.',
      'سیگنال‌ها متناقض هستند و انتظار توصیه می‌شود.',
      'بهتر است تا تعیین جهت روشن‌تر، نظاره‌گر باشیم.',
    ],
    final: [
      'ترکیب سیگنال‌ها و الگوها نشان‌دهنده‌ی {final_interpretation} است.',
      'مدیریت ریسک و پایش مستمر برای موفقیت ضروری است.',
      'با رعایت اصول مدیریت ریسک، می‌توان از این موقعیت به‌خوبی استفاده کرد.',
      'تحلیل تکنیکال فقط یکی از ابزارهای تصمیم‌گیری است و باید با سایر عوامل ترکیب شود.',
      'هیچ تحلیلی قطعی نیست و همیشه امکان خطا وجود دارد.',
      'توصیه‌ی نهایی: صبر، نظم و مدیریت ریسک.',
    ],
  },

  // ── Opening Phrases by School (30+ total, 5+ per school) ──
  opening_by_school: {
    classical: [
      'تحلیل کلاسیک {instrument} با تأکید بر سطوح حمایت و مقاومت...',
      'بررسی الگوهای قیمتی کلاسیک در {instrument}...',
      'خطوط روند و کانال‌های {instrument} تصویر روشنی ترسیم می‌کنند...',
      'سطوح کلیدی و الگوهای شکل‌گرفته در {instrument}...',
      'تحلیل ساختار قیمت {instrument} از منظر کلاسیک...',
      'شناسایی نواحی عرضه و تقاضا در {instrument}...',
    ],
    oscillator: [
      'اندیکاتورهای مومنتوم {instrument} سیگنال‌های مهمی ارائه می‌دهند...',
      'بررسی RSI، MACD و استوکاستیک در {instrument}...',
      'واگرایی‌ها و تقاطع‌های اسیلاتوری {instrument}...',
      'سیگنال‌های ترکیبی اندیکاتورها در {instrument}...',
      'مومنتوم و قدرت حرکت {instrument} بر اساس اسیلاتورها...',
      'بررسی مناطق اشباع خرید و فروش در {instrument}...',
    ],
    harmonic: [
      'نسبت‌های فیبوناچی و الگوهای هارمونیک {instrument}...',
      'نواحی برگشت احتمالی (PRZ) در {instrument} شناسایی شده‌اند...',
      'تحلیل هارمونیک با تلاقی نسبت‌ها در {instrument}...',
      'الگوهای گارتلی، پروانه و خفاش در {instrument}...',
      'دقت نسبت‌های فیبوناچی در {instrument}...',
      'نقاط D و ناحیه‌ی PRZ در {instrument}...',
    ],
    elliott: [
      'ساختار موجی {instrument} از منظر نظریه‌ی الیوت...',
      'شمارش امواج حرکتی و اصلاحی در {instrument}...',
      'امواج الیوت و نسبت‌های فیبوناچی بین امواج {instrument}...',
      'تشخیص موج فعلی و پیش‌بینی موج بعدی در {instrument}...',
      'الگوی ۵-۳ موجی در {instrument}...',
      'نسبت‌های موجی و اهداف قیمتی الیوت در {instrument}...',
    ],
    volume: [
      'حجم معاملات و جریان نقدینگی {instrument}...',
      'تحلیل OBV و شاخص‌های حجمی در {instrument}...',
      'تأیید حجمی حرکات قیمت در {instrument}...',
      'پروفایل حجمی و نواحی ارزش {instrument}...',
      'رفتار پول هوشمند در {instrument}...',
      'الگوهای حجمی و نشانه‌های VSA در {instrument}...',
    ],
    hybrid: [
      'تحلیل جامع و چندبُعدی {instrument} با تلفیق مکاتب...',
      'هم‌گرایی سیگنال‌ها از مکاتب مختلف در {instrument}...',
      'تصمیم‌گیری مبتنی بر تلفیق ابزارهای متعدد در {instrument}...',
      'رویکرد ترکیبی و همه‌جانبه به {instrument}...',
      'جمع‌بندی شواهد از تحلیل کلاسیک، اسیلاتوری و حجمی در {instrument}...',
      'تلفیق داده‌های تکنیکال و مدل‌های پیش‌بینی در {instrument}...',
    ],
  },

  // ── Closing Phrases (20+ total) ──
  closing_phrases: {
    summary: [
      'جمع‌بندی نهایی تحلیل...',
      'در مجموع و با توجه به تمامی شواهد...',
      'نتیجه‌گیری نهایی از تحلیل جامع...',
      'به طور خلاصه، تمامی شواهد نشان می‌دهند که...',
      'بر اساس تحلیل‌های فوق...',
    ],
    caution: [
      'با رعایت مدیریت ریسک و صبر، می‌توان از این تحلیل بهره برد.',
      'توصیه‌ی نهایی: احتیاط و نظم در اجرا.',
      'مدیریت ریسک همیشه اولویت اول است.',
      'هیچ تحلیلی قطعی نیست؛ همیشه برنامه‌ی جایگزین داشته باشید.',
      'صبر و نظم، کلید موفقیت در بازار هستند.',
    ],
    action: [
      'منتظر تأیید نهایی سیگنال‌ها بمانید.',
      'نقاط ورود و خروج مشخص شده‌اند؛ با نظم اجرا کنید.',
      'برنامه اجرایی مشخص است؛ منتظر شرایط ورود بمانید.',
      'تحلیل مستمر و به‌روزرسانی ضروری است.',
      'پایش مستمر قیمت در سطوح کلیدی توصیه می‌شود.',
    ],
    philosophical: [
      'بازار همیشه حق دارد؛ اگر تحلیل خطا کرد، سریعاً خارج شوید.',
      'بهترین تحلیلگر کسی است که بتواند اشتباه خود را بپذیرد.',
      'بازار مسیر خود را می‌رود؛ وظیفه‌ی ما تطبیق است نه مقاومت.',
      'در نهایت، نظم و مدیریت ریسک بر هر تحلیلی ارجحیت دارند.',
    ],
  },

  // ── Transition Phrases (15+ phrases) ──
  transitions: {
    addition: [
      'علاوه بر این،',
      'همچنین باید به...',
      'در کنار موارد فوق،',
      'از سوی دیگر،',
      'به‌علاوه،',
    ],
    contrast: [
      'با این حال،',
      'هرچند که،',
      'در مقابل،',
      'ولی باید توجه داشت که،',
      'با وجود این،',
    ],
    causation: [
      'به همین دلیل،',
      'بنابراین،',
      'نتیجتاً،',
      'از این رو،',
      'به دنبال این،',
    ],
  },

  // ── Surprise/Insight Phrases (10+ phrases) ──
  surprise_insight: {
    general: [
      'نکته‌ی جالب توجه این است که...',
      'آنچه کمتر مورد توجه قرار می‌گیرد...',
      'یک نکته‌ی مهم که از قلم می‌افتد...',
      'یافته‌ی غیرمنتظره‌ی این تحلیل...',
      'نکته‌ی کلیدی که بسیاری نادیده می‌گیرند...',
      'باید به این نکته‌ی ظریف توجه کرد که...',
      'شاید جالب باشد بدانید که...',
      'یک بینش مهم از داده‌های امروز...',
      'نکته‌ی قابل تأمل اینجاست که...',
      'آنچه داده‌ها به‌صراحت نشان می‌دهند...',
      'نکته‌ی حیاتی که نباید فراموش شود...',
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: 5 Template Formats
// ═══════════════════════════════════════════════════════════════════════════════

export const TEMPLATE_FORMATS: V12TemplateFormat[] = [
  {
    id: 'executive', name: 'سبک اجرایی و تصمیم‌گیری', nameEn: 'Executive Decision',
    lengthPreference: 'short', focusArea: 'تصمیم‌گیری سریع',
    sections: ['خلاصه‌ی اجرایی', 'دلایل اصلی', 'توصیه‌ی عملی'],
    wordCountRange: [600, 1000],
    structure: 'خلاصه در ابتدا، سپس ۳ دلیل اصلی، و توصیه عملی در انتها',
  },
  {
    id: 'technical', name: 'سبک تحلیلی-تکنیکال', nameEn: 'Technical Analytical',
    lengthPreference: 'long', focusArea: 'تحلیل عمیق تکنیکال',
    sections: ['نمای کلی', 'تحلیل روند', 'تحلیل سطوح کلیدی', 'الگوهای تشخیص‌داده‌شده', 'پیش‌بینی و سناریوها', 'نقاط ورود و خروج', 'نتیجه‌گیری'],
    wordCountRange: [1000, 1800],
    structure: 'تحلیل جامع با تمام بخش‌ها به ترتیب، پاراگراف‌های بلند و عمیق',
  },
  {
    id: 'trading', name: 'سبک معاملاتی و عملیاتی', nameEn: 'Trading Operations',
    lengthPreference: 'short', focusArea: 'نقاط ورود و خروج',
    sections: ['خلاصه‌ی سیگنال', 'تحلیل سریع', 'دستورات اجرایی', 'شرایط لغو'],
    wordCountRange: [500, 900],
    structure: 'جدول خلاصه سیگنال، تحلیل مختصر، دستورات ورود/خروج/حد ضرر',
  },
  {
    id: 'forecast', name: 'سبک پیش‌بینی و آینده‌نگر', nameEn: 'Forecast',
    lengthPreference: 'medium', focusArea: 'پیش‌بینی و سناریوها',
    sections: ['چشم‌انداز کلی', 'پیش‌بینی قیمت', 'سناریوهای محتمل', 'نقاط عطف آینده', 'جمع‌بندی'],
    wordCountRange: [800, 1400],
    structure: 'تمرکز بر آینده، جدول پیش‌بینی، سناریوها با احتمالات',
  },
  {
    id: 'educational', name: 'سبک آموزشی-تفسیری', nameEn: 'Educational Interpretive',
    lengthPreference: 'long', focusArea: 'آموزش و تفسیر',
    sections: ['مقدمه', 'مفاهیم کلیدی', 'تحلیل گام‌به‌گام', 'نکات آموزشی', 'جمع‌بندی'],
    wordCountRange: [1000, 1600],
    structure: 'آموزش گام‌به‌گام با توضیح مفاهیم، تحلیل مرحله‌ای',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Section 5: Schools, Styles, Tones (Backward Compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

export const SCHOOLS: SchoolDef[] = [
  { id: 'classical', name: 'الگوهای کلاسیک', nameEn: 'Classical Patterns', description: 'شناسایی الگوهای قیمتی کلاسیک.', methodology: 'Head & Shoulders, Double Top/Bottom, Flags, Triangles', focusQuestion: 'آیا الگوی قیمتی در حال شکل‌گیری است؟' },
  { id: 'oscillator', name: 'اندیکاتورهای نوسان‌نما', nameEn: 'Oscillator Analysis', description: 'تحلیل مومنتوم و سیگنال‌های اسیلاتوری.', methodology: 'RSI, MACD, Stochastic, CCI, MFI', focusQuestion: 'آیا مومنتوم و واگرایی‌ها سیگنال می‌دهند؟' },
  { id: 'harmonic', name: 'الگوهای هارمونیک', nameEn: 'Harmonic Patterns', description: 'تحلیل نسبت‌های فیبوناچی و الگوهای هارمونیک.', methodology: 'Gartley, Butterfly, Bat, Crab, PRZ', focusQuestion: 'آیا نسبت‌های فیبوناچی ناحیه‌ی برگشت را نشان می‌دهند؟' },
  { id: 'elliott', name: 'موج‌شناسی الیوت', nameEn: 'Elliott Wave', description: 'تحلیل ساختار موجی ۵-۳.', methodology: 'Impulse/Corrective waves, Fibonacci ratios', focusQuestion: 'کدام موج فعلی است و هدف آن چیست؟' },
  { id: 'volume', name: 'تحلیل حجم', nameEn: 'Volume Analysis', description: 'تأیید روند و شکست با تحلیل حجم.', methodology: 'OBV, A/D, Volume Profile, VSA', focusQuestion: 'آیا حجم حرکت قیمت را تأیید می‌کند؟' },
  { id: 'hybrid', name: 'تحلیل ترکیبی', nameEn: 'Hybrid Multi-School', description: 'تلفیق چند مکتب برای تصمیم‌گیری جامع.', methodology: 'Weighted combination of all schools', focusQuestion: 'همگرایی سیگنال‌ها کجاست؟' },
  // Backward-compat extra schools (kept for scoring functions)
  { id: 'trend', name: 'تحلیل روند', nameEn: 'Trend Following', description: 'تمرکز بر شدت روند و زاویه روند با EMA، MACD و ADX.', methodology: 'EMA 20/50/100, MACD, ADX, DI+/DI-', focusQuestion: 'آیا روند قابل اعتماد است؟' },
  { id: 'candlestick', name: 'الگوهای کندلی', nameEn: 'Candlestick Patterns', description: 'تحلیل الگوهای شمعی ژاپنی در سطوح کلیدی.', methodology: 'Doji, Hammer, Engulfing, Morning/Evening Star', focusQuestion: 'آیا کندلی در سطوح کلیدی عکس روند را تأیید می‌کند؟' },
  { id: 'sr', name: 'سطوح حمایت و مقاومت', nameEn: 'Support & Resistance', description: 'شناسایی سطوح کلیدی واکنش‌دهنده.', methodology: 'Pivot Points, Multiple Touches, Overlap', focusQuestion: 'نزدیک‌ترین سطح کلیدی کجاست؟' },
  { id: 'volatility', name: 'تحلیل نوسانات', nameEn: 'Volatility Analysis', description: 'تحلیل ATR و باندهای بولینگر.', methodology: 'ATR, Bollinger Bands, Keltner Channels', focusQuestion: 'نوسان در حال افزایش یا کاهش است؟' },
];

export const STYLES: StyleDef[] = [
  { id: 'executive', name: 'سبک اجرایی', nameEn: 'Executive', voice: 'مستقیم و تصمیم‌گیر', structure: 'خلاصه + دلایل + توصیه', endingStyle: 'دستورالعمل روشن' },
  { id: 'technical', name: 'سبک تکنیکال', nameEn: 'Technical Analytical', voice: 'دقیق و تحلیلی', structure: 'بخش‌بندی کامل', endingStyle: 'جمع‌بندی تحلیلی' },
  { id: 'trading', name: 'سبک معاملاتی', nameEn: 'Trading Ops', voice: 'عملیاتی و سریع', structure: 'سیگنال + اجرا + مدیریت ریسک', endingStyle: 'برنامه اجرایی' },
  { id: 'forecast', name: 'سبک پیش‌بینی', nameEn: 'Forecast', voice: 'آینده‌نگر', structure: 'چشم‌انداز + پیش‌بینی + سناریوها', endingStyle: 'جمع‌بندی آینده' },
  { id: 'educational', name: 'سبک آموزشی', nameEn: 'Educational', voice: 'آموزشی و صبور', structure: 'مقدمه + مفاهیم + گام‌به‌گام + جمع‌بندی', endingStyle: 'نکته‌ی آموزشی' },
];

export const TONES: ToneDef[] = [
  { id: 'conservative', name: 'محافظه‌کار', nameEn: 'Conservative', characteristics: 'هوشیار، ریسک‌گریز، تأکید بر حفظ سرمایه', vocabulary: 'احتیاط، حد ضرر، مدیریت ریسک، صبر', sentenceStyle: 'جملات شرطی و محتاطانه' },
  { id: 'aggressive', name: 'جسور', nameEn: 'Aggressive', characteristics: 'قاطع، سریع، جسورانه', vocabulary: 'شکست، ورود، فرصت، سیگنال قوی', sentenceStyle: 'جملات کوتاه و قاطع' },
  { id: 'balanced', name: 'متعادل', nameEn: 'Balanced', characteristics: 'عینی، دوطرفه، متعادل', vocabulary: 'شواهد، احتمال، تعادل، تحلیل', sentenceStyle: 'جملات متوسط و متعادل' },
  { id: 'alert', name: 'هشداری', nameEn: 'Alert', characteristics: 'هوشیار، مراقب، زودبازنگ', vocabulary: 'هشدار، مراقب، خطر، احتیاط', sentenceStyle: 'جملات هشداری با تأکید' },
  { id: 'optimistic', name: 'خوش‌بین', nameEn: 'Optimistic', characteristics: 'مثبت‌نگر، امیدوار', vocabulary: 'فرصت، پتانسیل، رشد، امید', sentenceStyle: 'جملات مثبت و امیدوارانه' },
  { id: 'realistic', name: 'واقع‌گرا', nameEn: 'Realistic', characteristics: 'واقع‌بین، بی‌طرف', vocabulary: 'واقعیت، داده، شواهد، احتمال', sentenceStyle: 'جملات واقع‌بینانه و مستند' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Section 6: Scoring Functions (Backward Compat)
// ═══════════════════════════════════════════════════════════════════════════════

function scoreSchool(s: SchoolDef, inp: NarrativeInput): number {
  let s_ = 0;
  const { trendDirection, rsi, adx, bbPosition, diPlus, diMinus } = inp;
  switch (s.id) {
    case 'trend': s_ = adx > 25 ? 8 : adx > 15 ? 5 : 2; break;
    case 'classical': s_ = (inp.nearResistance || inp.nearSupport) ? 9 : 5; break;
    case 'candlestick': s_ = (inp.nearResistance || inp.nearSupport) ? 8 : 4; break;
    case 'oscillator': s_ = (rsi > 70 || rsi < 30) ? 9 : Math.abs(rsi - 50) > 15 ? 6 : 3; break;
    case 'harmonic': s_ = (inp.nearResistance || inp.nearSupport) ? 7 : 3; break;
    case 'elliott': s_ = inp.trendR2 > 0.7 ? 9 : inp.trendR2 > 0.4 ? 5 : 2; break;
    case 'volume': s_ = inp.hasVolume ? 8 : 2; break;
    case 'sr': s_ = (inp.nearResistance || inp.nearSupport) ? 9 : 4; break;
    case 'volatility': s_ = inp.atr / inp.price > 0.03 ? 8 : inp.atr / inp.price > 0.01 ? 5 : 2; break;
    case 'hybrid': s_ = 6; break;
    default: s_ = 4;
  }
  if (s.id === 'trend' && trendDirection === 'up') s_ += 1;
  if (s.id === 'trend' && diPlus > diMinus) s_ += 1;
  return s_;
}

function scoreStyle(st: StyleDef, inp: NarrativeInput): number {
  let s_ = 4;
  const { trendDirection, adx, rsi, dominantScenarioKey } = inp;
  switch (st.id) {
    case 'executive': s_ = adx > 25 ? 7 : 4; break;
    case 'technical': s_ = 6; break;
    case 'trading': s_ = (dominantScenarioKey === 'R1' || dominantScenarioKey === 'R2') ? 9 : 4; break;
    case 'forecast': s_ = 6; break;
    case 'educational': s_ = 5; break;
  }
  return s_;
}

function scoreTone(t: ToneDef, inp: NarrativeInput): number {
  let s_ = 3;
  const { trendDirection, adx, rsi, dominantScenarioKey, macdHist } = inp;
  switch (t.id) {
    case 'conservative': s_ = 5; if (rsi > 65 || rsi < 35) s_ += 3; break;
    case 'aggressive': s_ = 3; if (adx > 30 && (rsi > 60 || rsi < 40)) s_ += 4; break;
    case 'balanced': s_ = 6; break;
    case 'alert': s_ = 4; if (rsi > 75 || rsi < 25) s_ += 3; break;
    case 'optimistic': s_ = 3; if (trendDirection === 'up' && macdHist > 0) s_ += 4; break;
    case 'realistic': s_ = 6; break;
  }
  if (dominantScenarioKey === 'R1' || dominantScenarioKey === 'R2') s_ += 2;
  return s_ + 1;
}

interface Scored<T> { item: T; score: number; }
function scoreAll<T>(items: T[], inp: NarrativeInput, fn: (item: T, inp: NarrativeInput) => number): Scored<T>[] {
  return items.map(item => ({ item, score: fn(item, inp) })).sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 7: Main Selector (Backward Compat)
// ═══════════════════════════════════════════════════════════════════════════════

/** @deprecated Use selectV12Persona + buildV12NarrativePrompt for V12 */
export function selectNarrativeCombination(input: NarrativeInput): NarrativeCombination {
  const schoolResults = scoreAll(SCHOOLS, input, scoreSchool);
  const styleResults = scoreAll(STYLES, input, scoreStyle);
  const toneResults = scoreAll(TONES, input, scoreTone);
  return {
    school: schoolResults[0].item,
    style: styleResults[0].item,
    tone: toneResults[0].item,
    schoolScore: schoolResults[0].score,
    styleScore: styleResults[0].score,
    toneScore: toneResults[0].score,
  };
}

export function buildNarrativeInput(body: {
  currentPrice: number; trendDirection: string; rsi: number; adx: number;
  stochK: number; stochD: number; macdLine: number; macdSignal: number; macdHist: number;
  diPlus: number; diMinus: number; obv: number; hasVolume: boolean;
  cci: number; mfi: number; atr: number; bollingerUpper: number; bollingerMiddle: number; bollingerLower: number;
  trendAngle: number; trendR2: number; overallSignal: string;
  scenarios: Record<string, { probability: number }>;
  resistances: number[]; supports: number[]; ma21: number; ma100: number;
}, isV10Scenarios: boolean = false): NarrativeInput {
  const bbRange = body.bollingerUpper - body.bollingerLower;
  const bbPosition = bbRange > 0 ? Math.max(0, Math.min(100, ((body.currentPrice - body.bollingerLower) / bbRange) * 100)) : 50;
  const R1 = body.resistances[0] || body.currentPrice * 1.05;
  const S1 = body.supports[0] || body.currentPrice * 0.95;
  // Detect scenario keys from the data itself
  const allScenarioKeys = (isV10Scenarios || Object.keys(body.scenarios).some(k => k.startsWith('S')))
    ? ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'] as const
    : ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'] as const;
  let dominantKey: string = allScenarioKeys[0]; let dominantProb = 0;
  for (const k of allScenarioKeys) {
    const p = body.scenarios[k]?.probability ?? 0;
    if (p > dominantProb) { dominantProb = p; dominantKey = k; }
  }
  return {
    price: body.currentPrice, trendDirection: body.trendDirection, rsi: body.rsi, adx: body.adx,
    stochK: body.stochK, stochD: body.stochD, macdLine: body.macdLine, macdSignal: body.macdSignal,
    macdHist: body.macdHist, diPlus: body.diPlus, diMinus: body.diMinus, obv: body.obv,
    hasVolume: body.hasVolume, cci: body.cci, mfi: body.mfi, atr: body.atr,
    bbPosition, bbUpper: body.bollingerUpper, bbLower: body.bollingerLower,
    dominantScenarioKey: dominantKey,
    scenarioProbabilities: Object.fromEntries(allScenarioKeys.map(k => [k, body.scenarios[k]?.probability ?? 0])),
    nearResistance: R1 > 0 ? Math.abs(body.currentPrice - R1) / R1 < 0.03 : false,
    nearSupport: S1 > 0 ? Math.abs(body.currentPrice - S1) / S1 < 0.03 : false,
    priceVsMa21: body.currentPrice > body.ma21 ? 'above' : 'below',
    priceVsMa100: body.currentPrice > body.ma100 ? 'above' : 'below',
    trendR2: body.trendR2,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 8: V12 Persona Selection (Rotation Algorithm)
// ═══════════════════════════════════════════════════════════════════════════════

/** Simple deterministic hash for date+instrument rotation */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Selects a V12 persona, template format, and variation seed
 * based on deterministic hash of date + instrument + school.
 * This ensures: different persona per day, different per instrument,
 * and school affinity matching.
 */
export function selectV12Persona(
  instrument: string,
  date: string,
  schoolId: string
): { persona: V12Persona; template: V12TemplateFormat; variationSeed: number } {
  const hashInput = `${date}:${instrument}:v10:2024`;
  const dayHash = simpleHash(hashInput);

  // Step 1: Find personas matching school affinity
  const matching = PERSONAS.filter(p => p.schoolAffinity === schoolId);
  // Step 2: If no match, use all personas
  const pool = matching.length > 0 ? matching : PERSONAS;
  // Step 3: Select persona by hash
  const personaIndex = dayHash % pool.length;
  const persona = pool[personaIndex];

  // Step 4: Select template — vary by hash % 7
  let templateIndex: number;
  const templateMod = dayHash % 7;
  if (templateMod < 2) templateIndex = 1; // technical (most common)
  else if (templateMod < 3) templateIndex = 0; // executive
  else if (templateMod < 4) templateIndex = 3; // forecast
  else if (templateMod < 5) templateIndex = 4; // educational
  else templateIndex = 2; // trading
  // Occasional variation: hash % 5 == 0 → use a different template
  if (dayHash % 5 === 0) {
    templateIndex = dayHash % TEMPLATE_FORMATS.length;
  }
  const template = TEMPLATE_FORMATS[templateIndex];

  return {
    persona,
    template,
    variationSeed: dayHash,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 9: V12 Prompt Builder
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Selects N phrases from a section of the phrase bank, rotated by seed.
 * Returns a comma-separated string of selected phrases.
 */
function selectPhrases(section: string, subsection: string, count: number, seed: number): string {
  const sectionData = PHRASE_BANK[section];
  if (!sectionData) return '';
  const phrases = sectionData[subsection] || sectionData[Object.keys(sectionData)[0]] || [];
  if (phrases.length === 0) return '';
  const startIdx = seed % phrases.length;
  const selected: string[] = [];
  for (let i = 0; i < Math.min(count, phrases.length); i++) {
    selected.push(phrases[(startIdx + i) % phrases.length]);
  }
  return selected.join('\n- ');
}

/**
 * Builds a V12 data-driven narrative prompt.
 * V12 KEY DIFFERENCE from V10: The LLM is EXPLICITLY required to use
 * scenario probabilities, exact price levels, trend direction/status,
 * and quantitative data in the generated text.
 */
export function buildV12NarrativePrompt(params: {
  instrument: string;
  date: string;
  persona: V12Persona;
  template: V12TemplateFormat;
  dataSection: string;
  variationSeed: number;
  school: SchoolDef;
  style: StyleDef;
  tone: ToneDef;
}): string {
  const { dataSection } = params;

  return `
داده‌های تکنیکال:
---
${dataSection}
---

بر اساس داده‌های بالا، فقط لیست ۹ سناریو را به ترتیب شدت حرکت قیمت (از کمترین به بیشترین) بنویسید.
ترتیب ثابت:
شوک نزولی
نزولی شتاب‌دار
نزولی قوی
نزولی با احتیاط
رنج کم‌نوسان
صعودی با احتیاط
صعودی قوی
صعودی شتاب‌دار
شوک صعودی

فقط نام هر سناریو را در یک خط بنویسید. هیچ توضیح، مقدمه یا نتیجه‌ای ننویسید.`;
}
