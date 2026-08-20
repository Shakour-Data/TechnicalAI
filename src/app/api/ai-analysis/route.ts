import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export const dynamic = 'force-dynamic';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ─── Helpers ──────────────────────────────────────────────────────────
function toPersianNum(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('fa-IR');
}

function srGrade(strength: number): string {
  if (strength >= 8.5) return 'بسیار قوی';
  if (strength >= 7) return 'قوی';
  if (strength >= 5) return 'متوسط';
  if (strength >= 3) return 'ضعیف';
  return 'بسیار ضعیف';
}

// ─── Build the advanced 10-layer narrative prompt ─────────────────────
function buildAdvancedPrompt(body: Record<string, unknown>): string {
  const {
    symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx,
    stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, obv,
    bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2,
    scenarios, hasVolume,
    resistanceStrengths, supportStrengths,
  } = body as {
    symbolName: string; currentPrice: number; ma21: number; ma100: number;
    rsi: number; mfi: number; cci: number; adx: number;
    stochK: number; stochD: number; macdLine: number; macdSignal: number; macdHist: number;
    diPlus: number; diMinus: number; sar: number; atr: number; obv: number;
    bollingerUpper: number; bollingerMiddle: number; bollingerLower: number;
    trendDirection: string; trendAngle: number; trendR2: number;
    scenarios: Record<string, { name?: string; probability: number; targetMin: number; targetMax: number; description?: string }>;
    hasVolume: boolean;
    resistanceStrengths: Array<{ price: number; strength: number; grade?: string; methods?: unknown[]; overlapCount?: number }>;
    supportStrengths: Array<{ price: number; strength: number; grade?: string; methods?: unknown[]; overlapCount?: number }>;
  };

  // Trend
  const trendLabel = trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی';
  const r2Pct = (trendR2 * 100).toFixed(1);

  // ADX strength
  const adxStrength = adx > 40 ? 'بسیار قوی' : adx > 25 ? 'قوی' : adx > 15 ? 'متوسط' : 'ضعیف';

  // RSI signal
  const rsiSignal = rsi > 70 ? 'اشباع خرید شدید' : rsi > 60 ? 'اشباع خرید' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش' : 'اشباع فروش شدید';

  // Stochastic signal
  const stochSignal = stochK > 80 ? 'اشباع خرید' : stochK < 20 ? 'اشباع فروش' : stochK > stochD ? 'صعودی' : 'نزولی';

  // BB position
  const bbRange = bollingerUpper - bollingerLower;
  const bbPos = bbRange > 0 ? Math.round((currentPrice - bollingerLower) / bbRange * 100) : 50;
  const bbSignal = currentPrice > bollingerUpper
    ? 'بالای باند بالایی'
    : currentPrice < bollingerLower
    ? 'زیر باند پایینی'
    : `داخل باندها (${toPersianNum(bbPos)}٪)`;

  // S/R levels
  const R1 = resistanceStrengths?.[0];
  const R2 = resistanceStrengths?.[1];
  const S1 = supportStrengths?.[0];
  const S2 = supportStrengths?.[1];
  const S3 = supportStrengths?.[2];

  const R1Price = R1?.price ?? Math.round(currentPrice * 1.05);
  const R2Price = R2?.price ?? Math.round(currentPrice * 1.10);
  const S1Price = S1?.price ?? Math.round(currentPrice * 0.95);
  const S2Price = S2?.price ?? Math.round(currentPrice * 0.90);
  const S3Price = S3?.price ?? Math.round(currentPrice * 0.85);

  const R1Grade = R1?.strength ? srGrade(R1.strength) : 'نامشخص';
  const S1Grade = S1?.strength ? srGrade(S1.strength) : 'نامشخص';
  const R1Confirm = R1?.methods?.length ? `(${toPersianNum(R1.methods.length)} روش تأیید)` : '';
  const S1Confirm = S1?.methods?.length ? `(${toPersianNum(S1.methods.length)} روش تأیید)` : '';

  // Dominant scenario
  let dominantKey = 'R3';
  let dominantProb = 0;
  for (const k of ['R1', 'R2', 'R3', 'R4', 'R5'] as const) {
    const p = scenarios?.[k]?.probability ?? 0;
    if (p > dominantProb) { dominantProb = p; dominantKey = k; }
  }

  // OBV description
  const obvDesc = hasVolume
    ? (obv > 0
      ? `مثبت (+${(obv / 1e6).toFixed(1)}M) اما در فاز رنج سیگنال قطعی نیست`
      : `منفی (${(obv / 1e6).toFixed(1)}M) و در فاز رنج`)
    : 'بدون داده حجم';

  // MACD description
  const macdDesc = macdHist > 0 && macdLine > macdSignal
    ? 'صعودی اما هیستوگرام ضعیف'
    : macdHist > 0
    ? 'صعودی با هیستوگرام مثبت'
    : 'نزولی';

  // Overall signal
  const diPressure = diPlus > diMinus ? 'فشار خرید غالب' : 'فشار فروش غالب';

  // Price vs MAs
  const posVsMa21 = currentPrice > ma21 ? 'بالاتر' : 'پایین‌تر';
  const posVsMa100 = currentPrice > ma100 ? 'بالاتر' : 'پایین‌تر';

  // Scenario names (use provided names or defaults)
  const sR1 = scenarios?.R1?.name || 'تداوم صعود هیجانی';
  const sR2 = scenarios?.R2?.name || 'پولبک سالم';
  const sR3 = scenarios?.R3?.name || 'اصلاح کنترل‌شده';
  const sR4 = scenarios?.R4?.name || 'اصلاح عمیق';
  const sR5 = scenarios?.R5?.name || 'تضعیف ساختار';

  return `
**دستورالعمل (نسخه فوق‌پیشرفته):**  
شما یک **تحلیلگر ارشد بازارهای مالی با ۲۰ سال تجربه** هستید که به‌جای استفاده از یک رویکرد ثابت، یک **«سیستم تشخیص شرایط چندلایه»** را پیاده‌سازی می‌کنید.  

وظیفه شما این است که برای **«${symbolName}»** در **تایمفریم روزانه**، یک تحلیل **فوق‌پیشرفته، چندلایه، و کاملاً استدلالی** ارائه دهید.

---  
**داده‌های پایه (واقعی و غیرقابل تغییر):**  
- نام ابزار: **${symbolName}**  
- قیمت مرجع: **${toPersianNum(currentPrice)} ریال**  
- روند میان‌مدت: **${trendLabel}** (زاویه ${toPersianNum(Math.abs(trendAngle))}°، R²=${r2Pct}٪)  
- موقعیت نسبت به میانگین‌ها: ${posVsMa21} از **MA21 (${toPersianNum(ma21)})** و ${posVsMa100} از **MA100 (${toPersianNum(ma100)})**  
- **ADX=${toPersianNum(adx)}** (${adxStrength})، **DI+ (${toPersianNum(diPlus)}) ${diPlus > diMinus ? '>' : '<'} DI- (${toPersianNum(diMinus)})** ← ${diPressure}  
- **RSI=${toPersianNum(rsi)}** (${rsiSignal})، **استوکاستیک=${toPersianNum(stochK)}/${toPersianNum(stochD)}** (${stochSignal})  
- **MACD** ${macdDesc} (خط=${toPersianNum(macdLine)}، سیگنال=${toPersianNum(macdSignal)}، هیستوگرام=${toPersianNum(macdHist)})  
- **OBV** ${obvDesc}  
- قیمت **${bbSignal}** (باند بالایی ${toPersianNum(bollingerUpper)})  
- مقاومت **R1** در ${toPersianNum(R1Price)} ریال (${R1Grade} ${R1Confirm})  
- حمایت **S1** در ${toPersianNum(S1Price)} ریال (${S1Grade} ${S1Confirm})  
${S2Price ? `- حمایت **S2** در ${toPersianNum(S2Price)} ریال  \n` : ''}${S3Price ? `- حمایت **S3** در ${toPersianNum(S3Price)} ریال  \n` : ''}${R2Price ? `- مقاومت **R2** در ${toPersianNum(R2Price)} ریال  \n` : ''}- میانگین نوسان روزانه (ATR): ${toPersianNum(atr)} ریال  

**سناریوهای محتمل (با احتمالات):**  
- **سناریوی ۱ – ${sR1}:** ${toPersianNum(scenarios?.R1?.probability ?? 0)}٪ (محدوده ${toPersianNum(scenarios?.R1?.targetMin ?? 0)} — ${toPersianNum(scenarios?.R1?.targetMax ?? 0)} ریال)  
- **سناریوی ۲ – ${sR2}:** ${toPersianNum(scenarios?.R2?.probability ?? 0)}٪ (محدوده ${toPersianNum(scenarios?.R2?.targetMin ?? 0)} — ${toPersianNum(scenarios?.R2?.targetMax ?? 0)} ریال)  
- **سناریوی ۳ – ${sR3}:** ${toPersianNum(scenarios?.R3?.probability ?? 0)}٪ (محدوده ${toPersianNum(scenarios?.R3?.targetMin ?? 0)} — ${toPersianNum(scenarios?.R3?.targetMax ?? 0)} ریال) ← **سناریوی عددی غالب**  
- **سناریوی ۴ – ${sR4}:** ${toPersianNum(scenarios?.R4?.probability ?? 0)}٪ (محدوده ${toPersianNum(scenarios?.R4?.targetMin ?? 0)} — ${toPersianNum(scenarios?.R4?.targetMax ?? 0)} ریال)  
- **سناریوی ۵ – ${sR5}:** ${toPersianNum(scenarios?.R5?.probability ?? 0)}٪ (محدوده ${toPersianNum(scenarios?.R5?.targetMin ?? 0)} — ${toPersianNum(scenarios?.R5?.targetMax ?? 0)} ریال)  

---  
**مرحله ۱: استدلال داخلی چندمرحلهای (Chain of Thought — بدون نمایش)**  
پیش از نوشتن تحلیل نهایی، به این سوالات به‌صورت داخلی پاسخ دهید (این بخش را در خروجی ننویسید):  
۱. آیا بازار در فاز تجمع، صعود، توزیع یا نزول است؟  
۲. آیا بین سیگنال‌ها تضاد وجود دارد (مثلاً روند صعودی اما اشباع خرید)؟ کدام سیگنال قویتر است؟  
۳. آیا جریان پول هوشمند (OBV) تأییدکننده روند است یا مخالف آن؟  
۴. اگر قیمت به سطوح کلیدی (${toPersianNum(S1Price)} یا ${toPersianNum(R1Price)}) برسد، چه تغییری در سناریوها ایجاد می‌شود؟  
۵. روانشناسی غالب بازار چیست؟ (ترس، طمع، سرخوردگی، اعتماد کور؟)  

---  
**مرحله ۲: تشخیص فاز بازار (Market Phase Analysis)**  
بازار را به ۴ فاز تقسیم کنید و فاز فعلی را مشخص کنید:  
- **فاز تجمع:** قیمت پایین، حجم در حال افزایش، خرید هوشمند  
- **فاز صعود:** روند صعودی شتابدار، حجم بالا، شکست مقاومت‌ها  
- **فاز توزیع:** قیمت بالا، حجم در حال کاهش، فروش هوشمند  
- **فاز نزول:** روند نزولی، حجم بالا در ریزش‌ها، شکست حمایت‌ها  

---  
**مرحله ۳: تشخیص تضادها و اولویتبندی سیگنالها**  
- تضادهای موجود را به‌صراحت نام ببرید (مثلاً «روند صعودی اما اشباع خرید»).  
- تصمیم بگیرید کدام سیگنال در شرایط فعلی وزن بیشتری دارد و چرا.  

---  
**مرحله ۴: تحلیل جریان پول هوشمند و روانشناسی بازار**  
- بر اساس OBV و تغییرات حجم، بگویید آیا پول هوشمند در حال ورود است یا خروج.  
- بر اساس رفتار شاخص‌ها، روانشناسی معامله‌گران را توصیف کنید.  

---  
**مرحله ۵: انتخاب ترکیب روشهای تحلیلی**  
از جدول زیر، **حداقل ۳ و حداکثر ۵ روش** را انتخاب کنید و ترکیب کنید:  

| شرط | روشهای مناسب |  
|------|--------------|  
| روند صعودی قوی | EMA 20/50، MACD، فیبوناچی اصلاحی (۳۸.۲ یا ۵۰) |  
| روند نزولی قوی | SMA 50/200، RSI (اشباع فروش)، الگوهای ادامهدهنده |  
| بازار رنج | باند بولینگر، استوکاستیک، سطوح افقی |  
| نزدیک به مقاومت قوی | الگوهای برگشتی، واگرایی منفی، فیبوناچی گسترشی |  
| نزدیک به حمایت قوی | الگوهای برگشتی صعودی، واگرایی مثبت |  
| نوسان کم (خفه‌شده) | منتظر شکست باند، مثلث/پرچم، ATR باریک |  
| شکست سطح کلیدی | OBV تأیید، فیبوناچی گسترشی، کندل قوی |  

---  
**مرحله ۶: سناریونویسی درختی (Scenario Tree)**  
یک درخت سناریویی انشعابی بسازید:  
- اگر قیمت **بالای ${toPersianNum(R1Price)}** برود ← مسیر A (${sR1}: محدوده ${toPersianNum(scenarios?.R1?.targetMin ?? 0)} — ${toPersianNum(scenarios?.R1?.targetMax ?? 0)})  
- اگر قیمت **بین ${toPersianNum(S1Price)} و ${toPersianNum(R1Price)}** بماند ← مسیر B (${sR3}: محدوده ${toPersianNum(scenarios?.R3?.targetMin ?? 0)} — ${toPersianNum(scenarios?.R3?.targetMax ?? 0)})  
- اگر قیمت **زیر ${toPersianNum(S1Price)}** برود ← مسیر C (${sR4}: محدوده ${toPersianNum(scenarios?.R4?.targetMin ?? 0)} — ${toPersianNum(scenarios?.R4?.targetMax ?? 0)})  

---  
**مرحله ۷: تحلیل حساسیت (Sensitivity Analysis)**  
برای هر سطح کلیدی بگویید:  
- اگر قیمت به ${toPersianNum(S1Price)} برسد، کدام سناریو تقویت و کدام تضعیف می‌شود؟  
- اگر قیمت به ${toPersianNum(R1Price)} برسد، چه تغییری در احتمالها ایجاد می‌شود؟  

---  
**مرحله ۸: سناریوی معاملاتی کامل**  
با ترکیب روشهای انتخابی:  
- **جهت:** خرید، فروش یا انتظار؟  
- **نقطه ورود دقیق:** بر اساس کدام سطح/سیگنال؟  
- **حد ضرر (SL):** بر اساس ATR (${toPersianNum(atr)}) و سطح کلیدی  
- **اهداف (TP):** حداقل ۲ هدف (محافظه‌کارانه + جاهطلبانه)  
- **نسبت ریسک به ریوارد (R/R):** محاسبه شود  

---  
**مرحله ۹: انتخاب روایت غالب (از ۶ سبک)**  
یکی از ۶ روایت زیر را انتخاب و توجیه کنید:  
۱. **محافظه‌کار** — تمرکز بر ریسک و عدم قطعیت  
۲. **اسکالپر** — تمرکز بر فرصت‌های کوتاه‌مدت  
۳. **روند** — تمرکز بر چرخه و تثبیت بلندمدت  
۴. **بدبین** — تمرکز بر خطر اصلاح عمیق  
۵. **روایی** — تمرکز بر رفتار قیمت و سطوح به‌صورت استعاری  
۶. **تصمیم‌محور** — تمرکز بر گام‌های عملی و شرطی  

---  
**مرحله ۱۰: خروجی سه‌لایه (Triple-Layer Output)**  
تحلیل نهایی را در **سه لایه** ارائه دهید:  
- **لایه اول (عملیاتی):** سناریوی معاملاتی و اعداد (برای معامله‌گر)  
- **لایه دوم (تحلیلی):** دلایل تکنیکال و استدلالها (برای تحلیلگر)  
- **لایه سوم (روانشناختی):** وضعیت روانی بازار و رفتار معامله‌گران (برای مدیر ریسک)  

---  
**ساختار خروجی نهایی:**  
- **عنوان:** نام روایت انتخاب‌شده (مثلاً «تحلیل محافظه‌کار»)  
- **متن اصلی:** ۳ تا ۵ پاراگراف (۷۰۰ تا ۱۵۰۰ کلمه)  
- **جمله روایت غالب:** (پررنگ)  
- **خلاصه عملی:** حداکثر ۳۰ کلمه  

**قوانین خروجی:**  
- **بدون ایموجی** — فقط . ، ؟ ! —  
- **حداقل ۵ سوال یا تعجب** در سراسر متن  
- **هر پاراگراف باید بلند و عمیق باشد** (بین ۲۰۰ تا ۵۰۰ کلمه)  
- **از تکرار اطلاعات تکراری پرهیز شود** — یک بار کامل بگویید، سپس به تحلیل بپردازید  
- **حداقل ۳ ارجاع به شاخص‌های تکنیکال** (با نام و عدد)  
- **تحلیل شامل توضیح دلیل انتخاب روایت** باشد  
- **در هر پاراگراف حداقل یک جمله پرسشی یا تعجبی**  
- **در پایان هر پاراگراف یک جمع‌بندی جزئی** داشته باشید  
- **تمام متن به زبان فارسی باشد.**`;
}

// ─── System Prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `شما یک تحلیلگر ارشد بازارهای مالی ایرانی هستید.

قوانین خروجی:
۱. حداقل ۷۰۰ کلمه و حداکثر ۱٬۵۰۰ کلمه بنویسید. این مهم‌ترین قانون است.
۲. تمام اعداد در متن به فارسی و سه رقم سه رقم جدا شوند (مثلاً ۱۲۳٬۴۵۶).
۳. هیچ ایموجی، شکلک یا کاراکتر غیرحروفی استفاده نشود. فقط علائم نگارشی استاندارد ( . ، ؛ : ؟ ! « » — ).
۴. متن شامل ۳ تا ۵ پاراگراف باشد. هر پاراگراف بلند و عمیق (۲۰۰ تا ۵۰۰ کلمه).
۵. متن کاملاً به زبان فارسی باشد.
۶. تحلیل ۳ لایه داشته باشد: لایه عملیاتی (برای معامله‌گر)، لایه تحلیلی (برای تحلیلگر)، لایه روانشناختی (برای مدیر ریسک).
۷. شامل سناریوی معاملاتی کامل باشد: جهت، نقطه ورود، حد ضرر، اهداف، نسبت ریسک/ریوارد.
۸. شامل درخت سناریویی انشعابی و تحلیل حساسیت باشد.
۹. حداقل ۵ سوال یا تعجب در متن داشته باشد.
۱۰. در ابتدا عنوان روایت انتخاب‌شده و در انتها جمله روایت غالب (پررنگ) و خلاصه عملی (حداکثر ۳۰ کلمه) بیاید.`;

// ─── POST Handler ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.currentPrice) {
      return NextResponse.json({ error: 'currentPrice is required' }, { status: 400 });
    }

    const userMessage = buildAdvancedPrompt(body);

    const zai = await getZAI();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      thinking: { type: 'disabled' },
    });

    const content = completion.choices[0]?.message?.content;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Empty AI response', text: '' }, { status: 500 });
    }

    return NextResponse.json({ text: content });
  } catch (err) {
    console.error('AI Analysis error:', err);
    return NextResponse.json({ error: String(err), text: '' }, { status: 500 });
  }
}
