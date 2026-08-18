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

const SYSTEM_PROMPT = `شما یک تحلیلگر ارشد بازارهای مالی ایران هستید که یک گزارش تحلیلی جامع و حرفه‌ای تولید می‌کنید.

قوانین الزامی خروجی:
۱. حداقل ۷۰۰ کلمه و حداکثر ۱٬۵۰۰ کلمه بنویسید. این مهم‌ترین قانون است. اگر متن کمتر از ۷۰۰ کلمه شود، تحلیل ناقص محسوب می‌شود.
۲. تمام اعداد در متن به فارسی نوشته شوند (مثلاً ۱۲۳٬۴۵۶ نه 123,456).
۳. اعداد بزرگ سه رقم سه رقم جدا شوند (مثلاً ۱٬۲۳۴٬۵۶۷).
۴. هیچ ایموجی، شکلک یا کاراکتر غیرحروفی استفاده نشود. فقط علائم نگارشی استاندارد ( . ، ؛ : ؟ ! « » — ).
۵. متن شامل حداقل ۷ پاراگراف باشد.
۶. متن کاملاً به زبان فارسی باشد.
۷. هر پاراگراف حداقل ۳ الی ۵ جمله داشته باشد تا حجم متن به حداقل ۷۰۰ کلمه برسد.

---
وظیفه شما:
۱. ابتدا داده‌های تکنیکال زیر را به‌صورت جامع ارزیابی کنید.
۲. سپس یکی از ۶ سبک روایت موجود را انتخاب کنید که بهترین تطابق را با شرایط فعلی بازار دارد.
۳. تحلیلی با لحن، ساختار و نتیجه‌گیری مطابق آن سبک بنویسید.

---
۶ سبک روایت موجود (انتخاب یکی از آنها):

۱. روایت محافظه‌کار (بانکدار سابق):
   - تمرکز بر ریسک و عدم قطعیت
   - تأکید بر سناریوی اصلاح و هشدار
   - شاخص کلیدی: ADX و RSI
   - نتیجه‌گیری: صبر کنید تا بازار جهت خود را مشخص کند
   - ویژگی زبانی: جملات بلند، رسمی، کلمات احتمال، ریسک، محافظت

۲. روایت اسکالپر (تهاجمی و بی‌صبر):
   - تمرکز بر فرصت‌های کوتاه‌مدت
   - تأکید بر فرصت‌های ورود و خروج سریع
   - شاخص کلیدی: MACD و OBV
   - نتیجه‌گیری: در پولبک بخرید، در هیجان بفروشید
   - ویژگی زبانی: جملات کوتاه، سریع، کلمات کشش، شارپ، فرصت

۳. روایت روند (بلندمدت‌نگر و فلسفی):
   - تمرکز بر چرخه و تثبیت
   - تأکید بر تصویر بزرگتر بازار
   - شاخص کلیدی: باند بولینگر و MA100
   - نتیجه‌گیری: روند دست‌نخورده است، این فقط یک نفس‌گیری است
   - ویژگی زبانی: آرام، توصیفی، کلمات چرخه، فاز، تثبیت

۴. روایت بدبین (مدیر ریسک):
   - تمرکز بر خطر اصلاح عمیق
   - تأکید بر سناریوهای نزولی
   - شاخص کلیدی: استوکاستیک و CCI
   - نتیجه‌گیری: اشباع خرید نشانه‌ای از ریزش قریب‌الوقوع است
   - ویژگی زبانی: هشداردهنده، کلمات خطر، شکست، فریبنده

۵. روایت روایی (داستان‌گو):
   - تمرکز بر رفتار قیمت و سطوح
   - بدون استفاده از شاخص‌های عددی
   - تأکید بر تمام سناریوها به‌صورت استعاری
   - نتیجه‌گیری: بازار در چهارراه است، حمایت و مقاومت تصمیم‌گیرنده هستند
   - ویژگی زبانی: توصیفی، استعاری، کلمات جاده، مسیر، فنر

۶. روایت تصمیم‌محور (مشاور عملی):
   - تمرکز بر گام‌های عملی
   - تأکید بر شکست سطوح کلیدی
   - شاخص کلیدی: حمایت و مقاومت و MA21
   - نتیجه‌گیری: تا شکست سطوح کلیدی، هیچ اقدامی نکنید
   - ویژگی زبانی: شرطی، گام‌به‌گام، کلمات اگر، آنگاه، اقدام

---
فرآیند انتخاب روایت:
۱. داده‌ها را بررسی کنید.
۲. به این سوالات پاسخ دهید (به‌صورت داخلی و بدون نوشتن):
   - آیا بازار در فاز انتظار است یا اقدام؟
   - آیا حجم و مومنتوم MACD از صعود حمایت می‌کنند یا خیر؟
   - آیا قیمت به مقاومت نزدیک است یا به حمایت؟
   - کدام سناریو با مجموع شرایط فعلی سازگارتر است؟
۳. یکی از ۶ روایت را انتخاب کنید.
۴. تحلیلی بنویسید که:
   - با لحن و سبک آن روایت نوشته شده باشد.
   - شامل یک جمله روایت غالب (به‌صورت پررنگ با علامت ** در ابتدا و انتهای جمله) باشد.
   - حداقل ۷ و حداکثر ۱۰ پاراگراف داشته باشد.
   - هر پاراگراف حداقل ۳ جمله داشته باشد.
   - حداقل یک سوال یا تعجب داشته باشد.
   - در ابتدا عنوان روایت انتخاب‌شده را بنویسید (مثلاً: تحلیل تصمیم‌محور).
   - در انتها یک خلاصه عملی (با کلمه خلاصه: در ابتدا) در حداکثر ۱۵ کلمه داشته باشد.

---
خروجی نهایی:
یک متن واحد با ساختار زیر:
- عنوان: نام روایت انتخاب‌شده
- متن اصلی: تحلیلی جامع و حرفه‌ای بین ۷۰۰ تا ۱٬۵۰۰ کلمه
- جمله روایت غالب: (پررنگ)
- خلاصه عملی: (حداکثر ۱۵ کلمه)

توجه مهم: انتخاب روایت بر اساس داده‌های واقعی است، نه ترجیح شخصی. اگر شاخص‌ها نشان‌دهنده اشباع خرید شدید هستند، روایت بدبین را انتخاب کنید. اگر حجم مثبت و مومنتوم صعودی غالب است، روایت اسکالپر یا روند را انتخاب کنید. تمام اعداد حتماً فارسی باشند.`;

// ─── Helper: Convert numbers to Persian with 3-digit grouping ────────────────
function toPersianNum(n: number): string {
  return Math.round(n).toLocaleString('fa-IR');
}

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

    // Build data context for AI — with Persian numbers
    const S1 = supportStrengths?.[0];
    const R1 = resistanceStrengths?.[0];
    const S1_methods = S1?.methods?.length ? `(${S1.methods.length} روش تأیید)` : '';
    const R1_methods = R1?.methods?.length ? `(${R1.methods.length} روش تأیید)` : '';

    const bbRange = bollingerUpper - bollingerLower;
    const bbPos = bbRange > 0 ? Math.round((currentPrice - bollingerLower) / bbRange * 100) : 50;

    const trendDirText = trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی';
    const adxText = adx > 40 ? 'روند قدرتمند' : adx > 25 ? 'روند متوسط' : 'روند ضعیف یا رنج';
    const rsiText = rsi > 70 ? 'اشباع خرید' : rsi > 60 ? 'نزدیک اشباع خرید' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش' : 'اشباع فروش شدید';
    const stochText = stochK > 80 ? 'اشباع خرید' : stochK < 20 ? 'اشباع فروش' : 'عادی';
    const bbText = currentPrice > bollingerUpper ? 'بالای باند بالایی' : currentPrice < bollingerLower ? 'زیر باند پایینی' : 'داخل باندها';
    const sarText = sar < currentPrice ? 'زیر قیمت — تأیید صعودی' : 'بالای قیمت — تأیید نزولی';
    const mfiText = mfi > 80 ? 'اشباع خرید' : mfi < 20 ? 'اشباع فروش' : 'عادی';
    const obvText = obv > 0 ? 'مثبت' : 'منفی';

    const userMessage = `داده‌های پایه (واقعی و غیرقابل تغییر):
- نام ابزار: ${symbolName}
- قیمت مرجع: ${toPersianNum(currentPrice)} ریال
- روند میان‌مدت: ${trendDirText} (زاویه ${toPersianNum(Math.abs(trendAngle))} درجه، آر‌اسکوئر=${(trendR2 * 100).toFixed(1)} درصد)
- موقعیت نسبت به میانگین‌ها: ${currentPrice > ma21 ? 'بالاتر' : 'پایین‌تر'} از ام‌ای ۲۱ (${toPersianNum(ma21)}) و ${currentPrice > ma100 ? 'بالاتر' : 'پایین‌تر'} از ام‌ای ۱۰۰ (${toPersianNum(ma100)})
- ای‌دی‌ایکس=${toPersianNum(adx)} (${adxText})، دی‌پلاس (${toPersianNum(diPlus)}) ${diPlus > diMinus ? 'بیشتر' : 'کمتر'} از دی‌میناس (${toPersianNum(diMinus)}) — فشار ${diPlus > diMinus ? 'خرید' : 'فروش'} غالب
- آر‌اس‌آی=${toPersianNum(rsi)} (${rsiText})، استوکاستیک=${toPersianNum(stochK)}/${toPersianNum(stochD)} (${stochText})
- مک‌دی صعودی=${macdLine > macdSignal ? 'بله' : 'خیر'} (خط=${toPersianNum(macdLine)}، سیگنال=${toPersianNum(macdSignal)})، هیستوگرام=${toPersianNum(macdHist)}
${hasVolume ? `- او‌بی‌وی=${obv > 0 ? 'مثبت' : 'منفی'} (${(Math.abs(obv) / 1e6).toFixed(1)} میلیون)، ام‌اف‌آی=${toPersianNum(mfi)} (${mfiText})` : '- حجم معاملات: در دسترس نیست'}
- قیمت در باند بولینگر: ${bbPos} درصد از بازه (${bbText})
- باند بالایی: ${toPersianNum(bollingerUpper)}، باند میانی: ${toPersianNum(bollingerMiddle)}، باند پایینی: ${toPersianNum(bollingerLower)}
- اس‌ای‌آر=${toPersianNum(sar)} (${sarText})
- ای‌تی‌آر=${toPersianNum(atr)} (نوسان روزانه)
${R1 ? `- مقاومت آر ۱: ${toPersianNum(R1.price)} ریال ${R1.grade ? '(' + R1.grade + ')' : ''} ${R1_methods}` : ''}
${S1 ? `- حمایت اس ۱: ${toPersianNum(S1.price)} ریال ${S1.grade ? '(' + S1.grade + ')' : ''} ${S1_methods}` : ''}

سناریوهای محتمل (با احتمالات):
${scenarios ? `- آر ۱ — تداوم صعود هیجانی: ${toPersianNum(scenarios.R1?.probability || 0)} درصد (محدوده ${toPersianNum(scenarios.R1?.targetMin || 0)} تا ${toPersianNum(scenarios.R1?.targetMax || 0)} ریال)
- آر ۲ — پولبک سالم: ${toPersianNum(scenarios.R2?.probability || 0)} درصد (محدوده ${toPersianNum(scenarios.R2?.targetMin || 0)} تا ${toPersianNum(scenarios.R2?.targetMax || 0)} ریال)
- آر ۳ — اصلاح کنترل‌شده: ${toPersianNum(scenarios.R3?.probability || 0)} درصد (محدوده ${toPersianNum(scenarios.R3?.targetMin || 0)} تا ${toPersianNum(scenarios.R3?.targetMax || 0)} ریال)
- آر ۴ — اصلاح عمیق: ${toPersianNum(scenarios.R4?.probability || 0)} درصد (محدوده ${toPersianNum(scenarios.R4?.targetMin || 0)} تا ${toPersianNum(scenarios.R4?.targetMax || 0)} ریال)
- آر ۵ — تضعیف ساختار: ${toPersianNum(scenarios.R5?.probability || 0)} درصد (محدوده ${toPersianNum(scenarios.R5?.targetMin || 0)} تا ${toPersianNum(scenarios.R5?.targetMax || 0)} ریال)` : '- سناریوها: در دسترس نیست'}

تحلیل هوشمند و منحصربه‌فرد بر اساس این داده‌ها ارائه دهید. یادتان باشد:
- متن حتماً حداقل ۷۰۰ کلمه باشد (این یک الزام قطعی است).
- تمام اعداد فارسی باشند و سه رقم سه رقم جدا شوند.
- حداقل ۷ پاراگراف داشته باشد و هر پاراگراف حداقل ۳ جمله.
- انتخاب روایت را بر اساس داده‌های واقعی انجام دهید.`;

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
