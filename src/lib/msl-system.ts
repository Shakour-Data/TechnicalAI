/**
 * MSL System — Methodology / Style / Language for analysis text generation.
 * Pure TypeScript, no framework imports.
 */

// ═══ Types ═════════════════════════════════════════════════════════

export type SchoolId = 'classical' | 'quantitative' | 'behavioral' | 'harmonic' | 'elliott' | 'multitimeframe';
export type StyleId = 'conservative' | 'scalper' | 'trend-follower' | 'pessimistic' | 'pragmatic'
  | 'decision-oriented' | 'volume-analyst' | 'pattern-analyst' | 'psychological' | 'volatility-analyst';
export type ToneId = 'formal' | 'quick' | 'philosophical' | 'warning' | 'narrative'
  | 'step-by-step' | 'skeptical' | 'optimistic' | 'simple' | 'number-focused'
  | 'multi-layered' | 'educational' | 'emotional' | 'deep-analytical' | 'exciting';

export interface School {
  id: SchoolId;
  name: string;   // Persian
  nameEn: string;
  prompt: string; // System prompt section (Persian)
}
export interface Style {
  id: StyleId;
  name: string;
  nameEn: string;
  prompt: string;
}
export interface Tone {
  id: ToneId;
  name: string;
  nameEn: string;
  prompt: string;
}
export interface MSLConfig { school: SchoolId; style: StyleId; tone: ToneId; }
export interface MarketContext {
  trend: 'up' | 'down' | 'range';
  volatility: 'high' | 'medium' | 'low';
  dominantScenario: string;
  instrumentType: string;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
}

// ═══ 6 Schools ══════════════════════════════════════════════════════

export const SCHOOLS: School[] = [
  { id: 'classical', name: 'کلاسیک', nameEn: 'Classical',
    prompt: 'تحلیل را بر اساس حمایت/مقاومت، روندها و الگوهای کلاسیک (سر و شانه، مثلث، پرچم) ارائه بده. خطوط روند و سطوح کلیدی را مشخص کن.' },
  { id: 'quantitative', name: 'کمّی', nameEn: 'Quantitative',
    prompt: 'تحلیل را بر پایه مدل‌های ریاضی و آماری ارائه بده. از داده‌های کمّی، احتمالات و مدل‌های عددی استفاده کن.' },
  { id: 'behavioral', name: 'رفتارشناسی', nameEn: 'Behavioral',
    prompt: 'تحلیل را از دیدگاه روانشناسی بازار و احساسات سرمایه‌گذاران ارائه بده. ترس، طمع و رفتار جمعی را بررسی کن.' },
  { id: 'harmonic', name: 'الگوی هارمونیک', nameEn: 'Harmonic Patterns',
    prompt: 'تحلیل را بر اساس الگوهای هارمونیک (gartley، butterfly، bat، crab، shark) و نسبت‌های فیبوناچی ارائه بده.' },
  { id: 'elliott', name: 'موج‌شناسی', nameEn: 'Elliott Wave',
    prompt: 'تحلیل را بر اساس نظریه موج الیوت ارائه بده. امواج انگیزشی و اصلاحی و ساختار ۵-۳ موجی را شناسایی کن.' },
  { id: 'multitimeframe', name: 'چندزمانی', nameEn: 'Multi-Timeframe',
    prompt: 'تحلیل را با بررسی چند تایم‌فریم همزمان ارائه بده. تصویر کلی بازار را با جزئیات تایم‌فریم‌های کوچک‌تر ترکیب کن.' },
];

// ═══ 10 Styles ═════════════════════════════════════════════════════

export const STYLES: Style[] = [
  { id: 'conservative', name: 'محافظه‌کار', nameEn: 'Conservative',
    prompt: 'سبک محافظه‌کارانه: تاکید بر مدیریت ریسک، حد ضرر، اندازه موقعیت کوچک و ورود احتیاطانه.' },
  { id: 'scalper', name: 'اسکالپر', nameEn: 'Scalper',
    prompt: 'سبک اسکالپ: تمرکز بر نوسانات کوتاه‌مدت، نقاط ورود و خروج سریع و سودهای کوچک متعدد.' },
  { id: 'trend-follower', name: 'روندگرا', nameEn: 'Trend Follower',
    prompt: 'سبک روندگرا: دنبال کردن روند غالب، ورود در جهت روند و پرهیز از معامله برخلاف جهت بازار.' },
  { id: 'pessimistic', name: 'بدبین', nameEn: 'Pessimistic',
    prompt: 'سبک بدبینانه: بررسی ریسک‌ها و تهدیدهای احتمالی، تأکید بر سناریوهای نزولی و ضررهای ممکن.' },
  { id: 'pragmatic', name: 'روایی', nameEn: 'Pragmatic',
    prompt: 'سبک روایی: تحلیل مبتنی بر داده و واقعیت، بدون تعصب، فقط بر اساس شواهد عددی.' },
  { id: 'decision-oriented', name: 'تصمیم‌محور', nameEn: 'Decision-Oriented',
    prompt: 'سبک تصمیم‌محور: تمرکز بر اقدام عملی، نقاط ورود/خروج دقیق و توصیه‌های قابل اجرا.' },
  { id: 'volume-analyst', name: 'تحلیلگر حجم', nameEn: 'Volume Analyst',
    prompt: 'سبک حجم‌محور: تحلیل بر اساس حجم معاملات، تایید روند با حجم و شناسایی نقاط تجمع/توزیع.' },
  { id: 'pattern-analyst', name: 'تحلیلگر الگو', nameEn: 'Pattern Analyst',
    prompt: 'سبک الگومحور: تمرکز بر شناسایی و تفسیر الگوهای قیمتی و شکل‌های نموداری.' },
  { id: 'psychological', name: 'روانشناختی', nameEn: 'Psychological',
    prompt: 'سبک روانشناختی: بررسی احساسات بازار، ترس و طمع، و تاثیر روانی بر تصمیمات معاملاتی.' },
  { id: 'volatility-analyst', name: 'تحلیلگر نوسان', nameEn: 'Volatility Analyst',
    prompt: 'سبک نوسان‌محور: تحلیل بر اساس میزان نوسانات، ATR، باند بولینگر و مدیریت ریسک نوسان.' },
];

// ═══ 15 Tones ═════════════════════════════════════════════════════

export const TONES: Tone[] = [
  { id: 'formal', name: 'رسمی', nameEn: 'Formal',
    prompt: 'لحن رسمی و حرفه‌ای، استفاده از واژگان تخصصی و ساختار گزارش‌محور.' },
  { id: 'quick', name: 'سریع', nameEn: 'Quick',
    prompt: 'لحن سریع و مستقیم، نکات کلیدی در جملات کوتاه بدون حاشیه‌روی.' },
  { id: 'philosophical', name: 'فلسفی', nameEn: 'Philosophical',
    prompt: 'لحن فلسفی و تامل‌برانگیز، بررسی معنای عمیق‌تر حرکات بازار و پدیده‌های مالی.' },
  { id: 'warning', name: 'هشداردهنده', nameEn: 'Warning',
    prompt: 'لحن هشداردهنده: تاکید بر ریسک‌ها و خطرات، استفاده از واژگان محتاطانه و هشدار.' },
  { id: 'narrative', name: 'داستانی', nameEn: 'Narrative',
    prompt: 'لحن داستانی و روایی: بازگو کردن تحلیل به شکل داستان بازار با گیرایی و جریان طبیعی.' },
  { id: 'step-by-step', name: 'گام‌به‌گام', nameEn: 'Step-by-Step',
    prompt: 'لحن گام‌به‌گام: تحلیل را مرحله به مرحله و به ترتیب منطقی ارائه بده.' },
  { id: 'skeptical', name: 'شکاک', nameEn: 'Skeptical',
    prompt: 'لحن شکاکانه: هر ادعا را با سوال و بررسی انتقادی همراه کن، بدون پذیرش بدون دلیل.' },
  { id: 'optimistic', name: 'خوشبین', nameEn: 'Optimistic',
    prompt: 'لحن خوشبینانه: تمرکز بر فرصت‌ها و چشم‌انداز مثبت بازار با انرژی مثبت.' },
  { id: 'simple', name: 'ساده', nameEn: 'Simple',
    prompt: 'لحن ساده و قابل فهم: از اصطلاحات ساده استفاده کن و مفاهیم را برای همه قابل درک کن.' },
  { id: 'number-focused', name: 'عددمحور', nameEn: 'Number-Focused',
    prompt: 'لحن عددمحور: تاکید بر ارقام، نسبت‌ها و آمار دقیق. هر نتیجه‌ای را با عدد و رقم ساپورت کن.' },
  { id: 'multi-layered', name: 'چندلایه', nameEn: 'Multi-Layered',
    prompt: 'لحن چندلایه: تحلیل را در سطوح مختلف (ماکرو، میکرو، روانی) به صورت همزمان ارائه بده.' },
  { id: 'educational', name: 'آموزشی', nameEn: 'Educational',
    prompt: 'لحن آموزشی: مفاهیم را توضیح بده، دلیل هر نتیجه را بیان کن و آموزشی بودن متن را حفظ کن.' },
  { id: 'emotional', name: 'احساسی', nameEn: 'Emotional',
    prompt: 'لحن احساسی: احساسات حاکم بر بازار را بازتاب بده و با سرمایه‌گذار همدلی کن.' },
  { id: 'deep-analytical', name: 'تحلیلی عمیق', nameEn: 'Deep Analytical',
    prompt: 'لحن تحلیلی عمیق: بررسی دقیق و موشکافانه هر جنبه، تحلیل علل و معلولات و اتصال نقاط.' },
  { id: 'exciting', name: 'هیجانی', nameEn: 'Exciting',
    prompt: 'لحن هیجانی و پویا: انرژی و هیجان تحلیل بازار را بازتاب بده و خواننده را درگیر کن.' },
];

// ═══ Prompt Generators ════════════════════════════════════════════

export function getSchoolPrompt(c: MSLConfig): string {
  const s = SCHOOLS.find(x => x.id === c.school);
  return `مکتب تحلیل: ${s?.name ?? ''} (${s?.nameEn ?? ''}). ${s?.prompt ?? ''}`;
}
export function getStylePrompt(c: MSLConfig): string {
  const s = STYLES.find(x => x.id === c.style);
  return `سبک تحلیل: ${s?.name ?? ''} (${s?.nameEn ?? ''}). ${s?.prompt ?? ''}`;
}
export function getTonePrompt(c: MSLConfig): string {
  const t = TONES.find(x => x.id === c.tone);
  return `لحن تحلیل: ${t?.name ?? ''} (${t?.nameEn ?? ''}). ${t?.prompt ?? ''}`;
}

// ═══ Dynamic Selection ════════════════════════════════════════════

export function selectMSL(ctx: MarketContext): MSLConfig {
  // ── School: based on instrument type ──
  let school: SchoolId = 'classical';
  const inst = ctx.instrumentType.toLowerCase();
  if (inst.includes('crypto') || inst.includes('کریپتو')) school = 'quantitative';
  else if (inst.includes('gold') || inst.includes('طلا') || inst.includes('forex') || inst.includes('فارکس')) school = 'multitimeframe';
  else if (inst.includes('stock') || inst.includes('سهام') || inst.includes('بورس')) school = 'classical';
  // Override: harmonic/elliott if dominant scenario mentions them
  if (ctx.dominantScenario.includes('harmonic') || ctx.dominantScenario.includes('هارمونیک')) school = 'harmonic';
  if (ctx.dominantScenario.includes('elliott') || ctx.dominantScenario.includes('الیوت')) school = 'elliott';
  // Override: behavioral if scenario is sentiment-driven
  if (ctx.dominantScenario.includes('sentiment') || ctx.dominantScenario.includes('احساس')) school = 'behavioral';

  // ── Style: based on trend + volatility ──
  let style: StyleId = 'pragmatic';
  if (ctx.trend === 'up' && ctx.volatility === 'low') style = 'trend-follower';
  else if (ctx.trend === 'down') style = 'conservative';
  else if (ctx.volatility === 'high') style = 'volatility-analyst';
  else if (ctx.trend === 'range') style = 'pattern-analyst';
  else if (ctx.volumeTrend === 'increasing') style = 'volume-analyst';
  else if (ctx.trend === 'up') style = 'trend-follower';
  // Scenario overrides
  if (ctx.dominantScenario.includes('decision') || ctx.dominantScenario.includes('تصمیم')) style = 'decision-oriented';
  if (ctx.dominantScenario.includes('psychology') || ctx.dominantScenario.includes('روان')) style = 'psychological';
  if (ctx.dominantScenario.includes('scalp') || ctx.dominantScenario.includes('اسکالپ')) style = 'scalper';

  // ── Tone: based on trend + volatility ──
  let tone: ToneId = 'deep-analytical';
  if (ctx.trend === 'up' && ctx.volatility !== 'high') tone = 'optimistic';
  else if (ctx.trend === 'down') tone = 'warning';
  else if (ctx.volatility === 'high') tone = 'quick';
  else if (ctx.trend === 'range') tone = 'deep-analytical';
  else if (ctx.volatility === 'low' && ctx.trend === 'up') tone = 'exciting';
  // Scenario overrides
  if (ctx.dominantScenario.includes('risk') || ctx.dominantScenario.includes('ریسک')) tone = 'warning';
  if (ctx.dominantScenario.includes('educat') || ctx.dominantScenario.includes('آموزش')) tone = 'educational';
  if (ctx.dominantScenario.includes('learn') || ctx.dominantScenario.includes('یادگیری')) tone = 'step-by-step';

  return { school, style, tone };
}

// ═══ All Combinations ══════════════════════════════════════════════

export function getAllCombinations(): MSLConfig[] {
  const out: MSLConfig[] = [];
  for (const s of SCHOOLS) for (const st of STYLES) for (const t of TONES)
    out.push({ school: s.id, style: st.id, tone: t.id });
  return out;
}
