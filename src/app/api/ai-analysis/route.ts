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

const SYSTEM_PROMPT = `شما یک تحلیلگر ارشد بازارهای مالی هستید که به‌جای تولید چندین تحلیل تکراری، یک تحلیل هوشمند و منحصربه‌فرد بر اساس وضعیت فعلی ابزار مالی ارائه می‌دهید.

وظیفه شما:
1. ابتدا داده‌های تکنیکال زیر را به‌صورت جامع ارزیابی کنید.
2. سپس یکی از ۶ سبک روایت موجود را انتخاب کنید که بهترین تطابق را با شرایط فعلی بازار دارد.
3. تحلیلی با لحن، ساختار و نتیجه‌گیری مطابق آن سبک بنویسید.

---
۶ سبک روایت موجود (انتخاب یکی از آنها):

1. روایت محافظه‌کار (بانکدار سابق):
   - تمرکز بر ریسک و عدم قطعیت
   - تأکید بر سناریوی اصلاح و هشدار
   - شاخص کلیدی: ADX و RSI
   - نتیجه‌گیری: «صبر کنید تا بازار جهت خود را مشخص کند»
   - ویژگی زبانی: جملات بلند، رسمی، کلمات «احتمال»، «ریسک»، «محافظت»

2. روایت اسکالپر (تهاجمی و بی‌صبر):
   - تمرکز بر فرصت‌های کوتاه‌مدت
   - تأکید بر فرصت‌های ورود و خروج سریع
   - شاخص کلیدی: MACD و OBV
   - نتیجه‌گیری: «در پولبک بخرید، در هیجان بفروشید»
   - ویژگی زبانی: جملات کوتاه، سریع، کلمات «کشش»، «شارپ»، «فرصت»

3. روایت روند (بلندمدت‌نگر و فلسفی):
   - تمرکز بر چرخه و تثبیت
   - تأکید بر تصویر بزرگتر بازار
   - شاخص کلیدی: باند بولینگر و MA100
   - نتیجه‌گیری: «روند دست‌نخورده است، این فقط یک نفس‌گیری است»
   - ویژگی زبانی: آرام، توصیفی، کلمات «چرخه»، «فاز»، «تثبیت»

4. روایت بدبین (مدیر ریسک):
   - تمرکز بر خطر اصلاح عمیق
   - تأکید بر سناریوهای نزولی
   - شاخص کلیدی: استوکاستیک و CCI
   - نتیجه‌گیری: «اشباع خرید نشانه‌ای از ریزش قریب‌الوقوع است»
   - ویژگی زبانی: هشداردهنده، کلمات «خطر»، «شکست»، «فریبنده»

5. روایت روایی (داستان‌گو):
   - تمرکز بر رفتار قیمت و سطوح
   - بدون استفاده از شاخص‌های عددی
   - تأکید بر تمام سناریوها به‌صورت استعاری
   - نتیجه‌گیری: «بازار در چهارراه است، حمایت و مقاومت تصمیم‌گیرنده هستند»
   - ویژگی زبانی: توصیفی، استعاری، کلمات «جاده»، «مسیر»، «فنر»

6. روایت تصمیم‌محور (مشاور عملی):
   - تمرکز بر گام‌های عملی
   - تأکید بر شکست سطوح کلیدی
   - شاخص کلیدی: حمایت/مقاومت و MA21
   - نتیجه‌گیری: «تا شکست سطوح کلیدی، هیچ اقدامی نکنید»
   - ویژگی زبانی: شرطی، گام‌به‌گام، کلمات «اگر»، «آنگاه»، «اقدام»

---
فرآیند انتخاب روایت:
1. داده‌ها را بررسی کنید.
2. به این سوالات پاسخ دهید (به‌صورت داخلی و بدون نوشتن):
   - آیا بازار در فاز «انتظار» است یا «اقدام»؟
   - آیا حجم (OBV) و مومنتوم (MACD) از صعود حمایت می‌کنند یا خیر؟
   - آیا قیمت به مقاومت نزدیک است یا به حمایت؟
   - کدام سناریو با مجموع شرایط فعلی سازگارتر است؟
3. یکی از ۶ روایت را انتخاب کنید.
4. تحلیلی بنویسید که:
   - با لحن و سبک آن روایت نوشته شده باشد.
   - شامل یک جمله «روایت غالب» (به‌صورت پررنگ) باشد.
   - حداقل ۲ و حداکثر ۴ پاراگراف داشته باشد.
   - حداقل یک سوال یا تعجب داشته باشد.
   - در انتها یک خلاصه عملی (با کلمه «خلاصه:») در حداکثر ۱۵ کلمه داشته باشد.
   - هیچگونه ایموجی، شکلک یا کاراکتر غیرحروفی (مانند ❌، ✅، ⚠️ و ...) در کل متن استفاده نشود. فقط از علائم نگارشی استاندارد ( . ، ؟ ! — ) استفاده کنید.

---
خروجی نهایی:
یک متن واحد با ساختار زیر:
- عنوان: نام روایت انتخاب‌شده (مثلاً «تحلیل تصمیم‌محور»)
- متن اصلی: تحلیل (۲ تا ۴ پاراگراف)
- جمله روایت غالب: (پررنگ)
- خلاصه عملی: (حداکثر ۱۵ کلمه)

توجه مهم: انتخاب روایت بر اساس داده‌های واقعی است، نه ترجیح شخصی. اگر شاخص‌ها نشان‌دهنده «اشباع خرید شدید» هستند، روایت بدبین را انتخاب کنید. اگر «حجم مثبت و مومنتوم صعودی» غالب است، روایت اسکالپر یا روند را انتخاب کنید.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx,
      stochK, stochD, macdLine, macdSignal, macdHist,
      diPlus, diMinus, sar, atr, obv,
      bollingerUpper, bollingerMiddle, bollingerLower,
      trendDirection, trendAngle, trendR2,
      scenarios, hasVolume,
      resistanceStrengths, supportStrengths,
    } = body;

    if (!currentPrice) {
      return NextResponse.json({ error: 'currentPrice is required' }, { status: 400 });
    }

    // Build data context for AI
    const S1 = supportStrengths?.[0];
    const R1 = resistanceStrengths?.[0];
    const S1_methods = S1?.methods?.length ? `(${S1.methods.length} روش تأیید)` : '';
    const R1_methods = R1?.methods?.length ? `(${R1.methods.length} روش تأیید)` : '';

    const bbRange = bollingerUpper - bollingerLower;
    const bbPos = bbRange > 0 ? Math.round((currentPrice - bollingerLower) / bbRange * 100) : 50;

    const userMessage = `داده‌های پایه (واقعی و غیرقابل تغییر):
- نام ابزار: ${symbolName}
- قیمت مرجع: ${Math.round(currentPrice)} ریال
- روند میان‌مدت: ${trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی'} (زاویه ${Math.round(Math.abs(trendAngle))}°، R²=${(trendR2 * 100).toFixed(1)}%)
- موقعیت نسبت به میانگین‌ها: ${currentPrice > ma21 ? 'بالاتر' : 'پایین‌تر'} از MA21 (${Math.round(ma21)}) و ${currentPrice > ma100 ? 'بالاتر' : 'پایین‌تر'} از MA100 (${Math.round(ma100)})
- ADX=${Math.round(adx)} (${adx > 40 ? 'روند قدرتمند' : adx > 25 ? 'روند متوسط' : 'روند ضعیف یا رنج'})، DI+ (${Math.round(diPlus)}) ${diPlus > diMinus ? '>' : '<'} DI- (${Math.round(diMinus)}) — فشار ${diPlus > diMinus ? 'خرید' : 'فروش'} غالب
- RSI=${Math.round(rsi)} (${rsi > 70 ? 'اشباع خرید' : rsi > 60 ? 'نزدیک اشباع خرید' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش' : 'اشباع فروش شدید'})، استوکاستیک=${Math.round(stochK)}/${Math.round(stochD)} (${stochK > 80 ? 'اشباع خرید' : stochK < 20 ? 'اشباع فروش' : 'عادی'})
- MACD صعودی=${macdLine > macdSignal ? 'بله' : 'خیر'} (خط=${Math.round(macdLine)}، سیگنال=${Math.round(macdSignal)})، هیستوگرام=${Math.round(macdHist)}
${hasVolume ? `- OBV=${obv > 0 ? '+' : ''}${(obv / 1e6).toFixed(1)}M (${obv > 0 ? 'مثبت' : 'منفی'})، MFI=${Math.round(mfi)} (${mfi > 80 ? 'اشباع خرید' : mfi < 20 ? 'اشباع فروش' : 'عادی'})` : '- حجم معاملات: در دسترس نیست'}
- قیمت در باند بولینگر: ${bbPos}% از بازه (${currentPrice > bollingerUpper ? 'بالای باند بالایی' : currentPrice < bollingerLower ? 'زیر باند پایینی' : 'داخل باندها'})
- باند بالایی: ${Math.round(bollingerUpper)}، باند میانی: ${Math.round(bollingerMiddle)}، باند پایینی: ${Math.round(bollingerLower)}
- SAR=${Math.round(sar)} (${sar < currentPrice ? 'زیر قیمت — تأیید صعودی' : 'بالای قیمت — تأیید نزولی'})
- ATR=${Math.round(atr)} (نوسان روزانه)
${R1 ? `- مقاومت R1: ${Math.round(R1.price)} ریال ${R1.grade ? `(${R1.grade})` : ''} ${R1_methods}` : ''}
${S1 ? `- حمایت S1: ${Math.round(S1.price)} ریال ${S1.grade ? `(${S1.grade})` : ''} ${S1_methods}` : ''}

سناریوهای محتمل (با احتمالات):
${scenarios ? `- ${scenarios.R1?.nameEn || 'R1'} — ${scenarios.R1?.name || 'تداوم صعود هیجانی'}: ${scenarios.R1?.probability || 0}% (محدوده ${Math.round(scenarios.R1?.targetMin || 0)}-${Math.round(scenarios.R1?.targetMax || 0)})
- ${scenarios.R2?.nameEn || 'R2'} — ${scenarios.R2?.name || 'پولبک سالم'}: ${scenarios.R2?.probability || 0}% (محدوده ${Math.round(scenarios.R2?.targetMin || 0)}-${Math.round(scenarios.R2?.targetMax || 0)})
- ${scenarios.R3?.nameEn || 'R3'} — ${scenarios.R3?.name || 'اصلاح کنترل‌شده'}: ${scenarios.R3?.probability || 0}% (محدوده ${Math.round(scenarios.R3?.targetMin || 0)}-${Math.round(scenarios.R3?.targetMax || 0)})
- ${scenarios.R4?.nameEn || 'R4'} — ${scenarios.R4?.name || 'اصلاح عمیق'}: ${scenarios.R4?.probability || 0}% (محدوده ${Math.round(scenarios.R4?.targetMin || 0)}-${Math.round(scenarios.R4?.targetMax || 0)})
- ${scenarios.R5?.nameEn || 'R5'} — ${scenarios.R5?.name || 'تضعیف ساختار'}: ${scenarios.R5?.probability || 0}% (محدوده ${Math.round(scenarios.R5?.targetMin || 0)}-${Math.round(scenarios.R5?.targetMax || 0)})` : '- سناریوها: در دسترس نیست'}

تحلیل هوشمند و منحصربه‌فرد بر اساس این داده‌ها ارائه دهید. انتخاب روایت را بر اساس داده‌های واقعی انجام دهید.`;

    const zai = await getZAI();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
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
