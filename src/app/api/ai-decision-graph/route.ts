import { NextRequest, NextResponse } from 'next/server';
import { dedicatedAIChatCompletion } from '@/lib/zai-shared';
import { db } from '@/lib/db';
import { buildPriceReferences, postProcessAIOutput } from '@/lib/ai-postprocess';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ─── Helpers ──────────────────────────────────────────────────────
function toPersianNum(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '\u06f0';
  return Math.round(n).toLocaleString('fa-IR');
}

function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ─── System Prompt (Decision Graph Specific) ─────────────────────
const DG_SYSTEM_PROMPT = `شما یک تحلیلگر ارشد بازارهای مالی ایرانی هستید که تخصص ویژه در تحلیل گراف‌های تصمیم و احتمالات سناریویی دارد.

یک تحلیل حرفه‌ای و کاربردی **مخصوص صفحه گراف تصمیم** بنویسید. این تحلیل باید بر اساس داده‌های گراف تصمیم و احتمالات سناریوها باشد و با متون تحلیلی دیگر تفاوت داشته باشد.

قواعد خروجی:
1. حداقل 600 کلمه و حداکثر 1,200 کلمه.
2. تمام اعداد به فارسی و سه رقم سه رقم جدا شوند.
3. از ایموجی‌های تحلیلی مناسب استفاده کنید: 📊 📈 📉 ⚡ 🔑 ⚠️ 🎯 ✅ ❌ 💡 🔴 🟢. حداکثر 5 تا در کل متن. **ممنوعیت مطلق:** به هیچ عنوان از ایموجی‌های آدمک، چهره، شخص یا بدن انسان استفاده نکنید.
4. متن شامل 3 تا 5 پاراگراف باشد. هر پاراگراف بلند و عمیق (150 تا 400 کلمه).
5. متن کاملاً به زبان فارسی باشد. **ممنوعیت مطلق:** به هیچ عنوان از کلمات یا عبارات زبان چینی استفاده نشود.
6. تحلیل یک‌پارچه و روان بنویسید. هیچ برچسب‌گذاری داخلی یا دسته‌بندی لایه‌ای (مثل «از منظر عملیاتی») استفاده نکنید.
7. **تمرکز اصلی:** تحلیل ساختار گراف تصمیم، تفسیر احتمالات سناریوها، بررسی سهم هر استراتژی (پیروی از روند، شکست، بازگشت)، و استخراج سیگنال‌های معاملاتی از ساختار درختی.
8. در متن اشاره‌ای به ساختار 27 مسیری گراف (3 شاخه استراتژی × 3 زیرشاخه × 3 یال شرطی) داشته باشید.
9. درصدها را به صورت کامل بنویسید: مثلاً «5 درصد» نه «5٪». درصدها باید دقیقاً مطابق داده‌های ورودی باشند.
10. برای کلمات مهم از **بولد** استفاده کنید (حداقل 6 مورد).
11. برای رنگی کلمات مهم از دستور {color:COLOR}متن{/color} استفاده کنید. رنگهای مجاز: red, green, amber, blue, orange, purple, emerald. حداکثر 6 مورد رنگی.
12. در ابتدا یک عنوان مختصر و در انتها یک جمله روایت غالب (پررنگ) و خلاصه عملی (حداکثر 25 کلمه) بیاورید.
13. هیچ سرفصل یا عنوان داخلی سیستم (مثل مرحله، فاز، خروجی سه‌لایه و غیره) در متن نباشد.
14. متن خروجی فقط تحلیل باشد. هیچ دستورالعمل یا ساختار داخلی در خروجی نیاید.
15. **فاصله‌گذاری صحیح (بسیار مهم):**
   - بین هر دو کلمه مستقل حتماً یک فاصله (Space) باشد.
   - از نیم‌فاصله (ZWNJ) استفاده نکنید. فقط فاصله معمولی.
   - مثال‌های صحیح: «کوتاه مدت»، «بلند مدت»، «نشان دهنده»، «حد ضرر»، «نقطه ورود».
   - مثال‌های غلط: «کوتاهمدت»، «بلندمدت»، «نشاندهنده»، «حدضرر».
16. **پاراگراف‌بندی صحیح:** هر پاراگراف با یک خط خالی از پاراگراف بعدی جدا شود.
17. **نگارش بی‌نقص فارسی:** متن از نظر املایی و انشایی کاملاً بی‌نقص باشد.
18. **واحد اندازه‌گیری:** دقیقاً همان واحدی را که در داده‌ها ارائه شده استفاده کنید. شاخص‌ها واحدشان «واحد» است.
19. **ممنوعیت مطلق کدها:** به هیچ وجه از کدهای تکنیکال استفاده نکنید. ممنوع: SC1 تا SC9، MA21، MA100، RSI، ADX و هر واژه فنی انگلیسی. فقط نام فارسی سناریوها و نام ابزار مالی مجاز است.
20. **دقت عددی مطلق:** هر عددی که در متن می‌آورید باید دقیقاً با داده‌های ورودی مطابقت داشته باشد. هرگز عددی را از خودتان نسازید یا تخمین نزنید.
21. **منع تناقض:** هیچ جمله‌ای نباید با داده‌ها تناقض داشته باشد.
22. **حفظ مقیاس قیمت:** تمام قیمت‌ها باید در همان مقیاس قیمت فعلی باشند. هرگز صفرها را حذف نکنید.
23. **تحلیل ساختاری گراف:** تحلیل باید نشان دهد که چرا ساختار گراف تصمیم (تقسیم به 3 شاخه استراتژی) به درک بهتر بازار کمک می‌کند و چگونه سهم هر استراتژی به تصمیم‌گیری معاملاتی کمک می‌کند.
`;

// ─── Build Decision Graph Prompt ────────────────────────────────
function buildDGPrompt(body: Record<string, unknown>): string {
  const symbolName = String(body.symbolName || 'نامشخص');
  const currentPrice = Number(body.currentPrice) || 0;
  const currencyUnit = String(body.currencyUnit || 'ریال');
  const trendDirection = String(body.trendDirection || 'خنثی');
  const rsi = Number(body.rsi) || 50;
  const adx = Number(body.adx) || 0;
  const atr = Number(body.atr) || 0;
  const bullScore = Number(body.bullScore) || 50;

  const scenarios = body.scenarios as Record<string, {
    name?: string; nameEn?: string; probability: number;
    targetMin: number; targetMax: number; description?: string;
  }> | undefined;

  const decisionGraph = body.decisionGraph as {
    branchProbabilities?: { trend: number; breakout: number; reversal: number };
    pathContributions?: Record<string, { trend: number; breakout: number; reversal: number }>;
    scenarioProbabilities?: Record<string, number>;
  } | undefined;

  const probabilityTrend = body.probabilityTrend as {
    scenarios?: { scenarioKey: string; label: string; group: string;
      trendDirection: string; currentProbability: number;
      peakDay?: number; peakProb?: number;
      trend: { individualProb: number; cumulativeProb: number; day: number }[];
    }[];
    groups?: { group: string; label: string; trendDirection: string;
      trend: { cumulativeProb: number; day: number }[];
    }[];
  } | undefined;

  // ── Scenario names in Persian (no SC codes) ──
  const scNames: Record<string, string> = {
    SC1: 'شوک نزولی', SC2: 'نزولی شتاب‌دار', SC3: 'نزولی قوی',
    SC4: 'نزولی خفیف', SC5: 'رنج',
    SC6: 'صعودی خفیف', SC7: 'صعودی قوی', SC8: 'صعودی شتاب‌دار', SC9: 'شوک صعودی',
  };
  const scGroups: Record<string, string> = {
    SC1: 'خرسی', SC2: 'خرسی', SC3: 'خرسی', SC4: 'خرسی',
    SC5: 'خنثی',
    SC6: 'گاوی', SC7: 'گاوی', SC8: 'گاوی', SC9: 'گاوی',
  };

  const trendLabel = trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی';
  const adxStrength = adx > 40 ? 'بسیار قوی' : adx > 25 ? 'قوی' : adx > 15 ? 'متوسط' : 'ضعیف';
  const rsiZone = rsi > 70 ? 'اشباع خرید شدید' : rsi > 60 ? 'اشباع خرید' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش' : 'اشباع فروش شدید';

  // ── Sort scenarios by probability ──
  const sortedScenarios = ['SC1','SC2','SC3','SC4','SC5','SC6','SC7','SC8','SC9']
    .map(k => ({
      key: k, name: scNames[k],
      prob: scenarios?.[k]?.probability ?? 0,
      min: scenarios?.[k]?.targetMin ?? 0,
      max: scenarios?.[k]?.targetMax ?? 0,
      group: scGroups[k],
    }))
    .sort((a, b) => b.prob - a.prob);

  const scenarioLines = sortedScenarios.map(s =>
    `- ${s.name} (${s.group}): احتمال ${toPersianNum(s.prob)} درصد | بازه هدف: ${toPersianNum(s.min)} تا ${toPersianNum(s.max)} ${currencyUnit}`
  ).join('\n');

  // ── Branch probabilities ──
  const branchProbs = decisionGraph?.branchProbabilities ?? { trend: 0.33, breakout: 0.33, reversal: 0.34 };
  const branchBlock = `
**سهم استراتژی‌ها (شاخه‌های گراف):**
- پیروی از روند: ${toPersianNum(Math.round(branchProbs.trend * 100))} درصد
- شکست: ${toPersianNum(Math.round(branchProbs.breakout * 100))} درصد
- بازگشت: ${toPersianNum(Math.round(branchProbs.reversal * 100))} درصد`;

  // ── Path contributions for top 3 scenarios ──
  const pathContrib = decisionGraph?.pathContributions ?? {};
  const contribLines = sortedScenarios.slice(0, 3).map(s => {
    const c = pathContrib[s.key] ?? { trend: 0, breakout: 0, reversal: 0 };
    return `- ${s.name}: سهم پیروی از روند ${toPersianNum(Math.round(c.trend * 100))} درصد، شکست ${toPersianNum(Math.round(c.breakout * 100))} درصد، بازگشت ${toPersianNum(Math.round(c.reversal * 100))} درصد`;
  }).join('\n');

  // ── Group probabilities ──
  const bullishProb = ['SC6','SC7','SC8','SC9'].reduce((s, k) => s + (scenarios?.[k]?.probability ?? 0), 0);
  const bearishProb = ['SC1','SC2','SC3','SC4'].reduce((s, k) => s + (scenarios?.[k]?.probability ?? 0), 0);
  const neutralProb = scenarios?.SC5?.probability ?? 0;

  // ── Probability trend (30-day) ──
  let trendBlock = '';
  if (probabilityTrend?.scenarios && probabilityTrend.scenarios.length > 0) {
    const dirLabel: Record<string, string> = {
      rising: 'صعودی \u2191', falling: 'نزولی \u2193', stable: 'ثابت \u2192', volatile: 'ناپایدار',
    };

    const groupLines = (probabilityTrend.groups || []).map(g => {
      const today = g.trend[0]?.cumulativeProb;
      const weekAgo = g.trend.length >= 7 ? g.trend[6].cumulativeProb : null;
      const change = weekAgo !== null ? ((today - weekAgo) * 100).toFixed(1) : null;
      const changeStr = change !== null ? (Number(change) >= 0 ? '+' : '') + change + '%' : '';
      return `- ${g.label}: تجمعی امروز ${toPersianNum(Math.round((today ?? 0) * 100))} درصد | روند: ${dirLabel[g.trendDirection] || g.trendDirection}${changeStr ? ' (' + changeStr + ' تغییر در 7 روز)' : ''}`;
    }).join('\n');

    const topScTrends = [...probabilityTrend.scenarios]
      .sort((a, b) => b.currentProbability - a.currentProbability)
      .slice(0, 5);
    const scTrendLines = topScTrends.map(s => {
      const name = scNames[s.scenarioKey] || s.label;
      const todayCum = s.trend[0]?.cumulativeProb;
      const weekAgoCum = s.trend.length >= 7 ? s.trend[6].cumulativeProb : null;
      const cumChange = weekAgoCum !== null ? ((todayCum - weekAgoCum) * 100).toFixed(1) : null;
      return `- ${name}: تجمعی امروز ${toPersianNum(Math.round((todayCum ?? 0) * 100))} درصد | روند: ${dirLabel[s.trendDirection] || s.trendDirection}${cumChange !== null ? ' (' + (Number(cumChange) >= 0 ? '+' : '') + cumChange + '% در 7 روز)' : ''}`;
    }).join('\n');

    trendBlock = `
**روند احتمالات تجمعی (30 روزه):**
گروه‌ها:\n${groupLines}
سناریوهای برتر:\n${scTrendLines}`;
  }

  // ── Support/Resistance ──
  const resistances = (body.resistances as number[]) || [];
  const supports = (body.supports as number[]) || [];
  const r1 = resistances[0] || Math.round(currentPrice * 1.05);
  const s1 = supports[0] || Math.round(currentPrice * 0.95);

  return `
**داده‌های گراف تصمیم — ${symbolName}:**
- قیمت فعلی: **${toPersianNum(currentPrice)}** ${currencyUnit}
- روند: **${trendLabel}** | شدت روند: ${toPersianNum(adx)} (${adxStrength}) | وضعیت اشباع: ${rsiZone}
- امتیاز گاوی: ${toPersianNum(Math.round(bullScore))} از 100 | دامنه تلواتی: ${toPersianNum(atr)} ${currencyUnit}
- اولین مقاومت: ${toPersianNum(r1)} ${currencyUnit} | اولین حمایت: ${toPersianNum(s1)} ${currencyUnit}

**احتمالات 9 سناریو (مرتب بر اساس احتمال):**
${scenarioLines}

**گروه‌بندی:**
- مجموع صعودی: ${toPersianNum(Math.round(bullishProb))} درصد
- خنثی (رنج): ${toPersianNum(Math.round(neutralProb))} درصد
- مجموع نزولی: ${toPersianNum(Math.round(bearishProb))} درصد
${branchBlock}

**سهم استراتژی‌ها در 3 سناریوی برتر:**
${contribLines}
${trendBlock}
`;
}

// ─── POST Handler ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const symbolName = String(body.symbolName || 'unknown');
    const currentPrice = Number(body.currentPrice) || 0;
    const today = getTodayDateStr();

    if (!currentPrice) {
      return NextResponse.json({ error: 'currentPrice is required' }, { status: 400 });
    }

    // 1. Check daily cache
    try {
      const cached = await db.decisionGraphAiCache.findUnique({
        where: { symbol_date: { symbol: symbolName, date: today } },
      });
      if (cached && cached.text) {
        const cachedPrice = Number(cached.price) || 0;
        if (cachedPrice > 0 && currentPrice > 0) {
          const priceDiff = Math.abs(cachedPrice - currentPrice) / currentPrice;
          if (priceDiff <= 0.05) {
            console.log(`[DG-AI] Cache HIT for ${symbolName} (${today}) [${Date.now() - startTime}ms]`);
            return NextResponse.json({ text: cached.text, cached: true, cachedDate: cached.date });
          } else {
            console.log(`[DG-AI] Cache INVALIDATED for ${symbolName} (price diff ${(priceDiff * 100).toFixed(1)}% > 5%)`);
          }
        }
      }
    } catch (dbErr) {
      console.warn('[DG-AI] DB cache read failed:', dbErr instanceof Error ? dbErr.message : dbErr);
    }

    // 1b. Fallback: previous day cache if price within 2%
    try {
      const prevCached = await db.decisionGraphAiCache.findFirst({
        where: { symbol: symbolName, date: { not: today } },
        orderBy: { createdAt: 'desc' },
      });
      if (prevCached && prevCached.text && prevCached.price > 0 && currentPrice > 0) {
        const priceDiff = Math.abs(prevCached.price - currentPrice) / currentPrice;
        if (priceDiff < 0.02) {
          console.log(`[DG-AI] Previous cache fallback HIT for ${symbolName} (${prevCached.date}, price diff ${((priceDiff) * 100).toFixed(1)}%) [${Date.now() - startTime}ms]`);
          return NextResponse.json({
            text: prevCached.text, cached: true, cachedDate: prevCached.date, isFallback: true,
          });
        }
      }
    } catch (dbErr) {
      console.warn('[DG-AI] Previous cache fallback read failed:', dbErr instanceof Error ? dbErr.message : dbErr);
    }

    // 2. Build prompt
    const userMessage = buildDGPrompt(body);

    console.log(`[DG-AI] Generating for ${symbolName} (cache miss) [${Date.now() - startTime}ms]`);

    // 3. Call AI
    const content = await dedicatedAIChatCompletion(
      [
        { role: 'system', content: DG_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      { timeoutMs: 90_000, maxRetries: 2 }
    );

    // 4. Post-process
    const priceRefs = buildPriceReferences(body);
    const { text: cleaned, priceValid, hallucinationCount } = postProcessAIOutput(content, priceRefs);

    if (!priceValid) {
      console.warn(`[DG-AI] Price hallucination detected for ${symbolName}: ${hallucinationCount} bad prices. NOT caching.`);
    }

    // 5. Save to cache (only if price valid)
    if (priceValid) {
      try {
        await db.decisionGraphAiCache.upsert({
          where: { symbol_date: { symbol: symbolName, date: today } },
          create: { symbol: symbolName, date: today, text: cleaned, price: currentPrice },
          update: { text: cleaned, price: currentPrice },
        });
        console.log(`[DG-AI] Saved to cache: ${symbolName} (${today}) [${Date.now() - startTime}ms]`);
      } catch (dbErr) {
        console.warn('[DG-AI] DB cache write failed:', dbErr instanceof Error ? dbErr.message : dbErr);
      }
    }

    console.log(`[DG-AI] Complete for ${symbolName} [${Date.now() - startTime}ms]`);
    return NextResponse.json({ text: cleaned });

  } catch (err) {
    console.error(`[DG-AI] Error [${Date.now() - startTime}ms]:`, err);
    const msg = err instanceof Error ? err.message : String(err);
    let userMsg = 'خطایی در تولید تحلیل گراف تصمیم رخ داد.';
    if (msg.includes('Rate limited') || msg.includes('429')) userMsg = 'سرور هوشمند محدودیت سرعت دارد. لطفاً بعداً تلاش کنید.';
    else if (msg.includes('Timed out') || msg.includes('timeout') || msg.includes('Timeout')) userMsg = 'زمان پاسخدهی هوشمند به پایان رسید.';
    else if (msg.includes('concurrent')) userMsg = 'درخواست تحلیل قبلی هنوز در حال اجراست.';
    return NextResponse.json({ error: userMsg, text: '' }, { status: 500 });
  }
}
