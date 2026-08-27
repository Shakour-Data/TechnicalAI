import { NextRequest, NextResponse } from 'next/server';
import { dedicatedAIChatCompletion } from '@/lib/zai-shared';
import { db } from '@/lib/db';
import {
  selectMLCombination,
  selectMethods,
  getScenarioName,
  type MLSelectorInput,
} from '@/lib/analysis-ml-selector';
import {
  selectMSLV4,
  buildMSLV4PromptSection,
  type MSLV4Context,
} from '@/lib/msl-v4';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ─── Helpers ──────────────────────────────────────────────────────
function toPersianNum(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '\u06f0';
  return Math.round(n).toLocaleString('fa-IR');
}
function srGrade(strength: number): string {
  if (strength >= 8.5) return '\u0628\u0633\u06cc\u0627\u0631 \u0642\u0648\u06cc';
  if (strength >= 7) return '\u0642\u0648\u06cc';
  if (strength >= 5) return '\u0645\u062a\u0648\u0633\u0637';
  if (strength >= 3) return '\u0636\u0639\u06cc\u0641';
  return '\u0628\u0633\u06cc\u0627\u0631 \u0636\u0639\u06cc\u0641';
}

function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}



// ─── Build ML Selector Input ──────────────────────────────────────
function buildMLInput(body: Record<string, unknown>): MLSelectorInput {
  const price = (body.currentPrice as number) || 0;
  const trendDir = (body.trendDirection as string) || 'range';
  const adx = (body.adx as number) || 0;
  const rsi = (body.rsi as number) || 50;
  const stochK = (body.stochK as number) || 50;
  const macdHist = (body.macdHist as number) || 0;
  const obv = (body.obv as number) || 0;
  const bollingerUpper = (body.bollingerUpper as number) || 0;
  const bollingerLower = (body.bollingerLower as number) || 0;
  const resistance = (body.resistanceStrengths as Array<{ price: number }> | undefined)?.[0]?.price ?? 0;
  const support = (body.supportStrengths as Array<{ price: number }> | undefined)?.[0]?.price ?? 0;
  const atr = (body.atr as number) || 0;
  const bbRange = bollingerUpper - bollingerLower;
  const bbPosition = bbRange > 0 ? Math.min(100, Math.max(0, Math.round((price - bollingerLower) / bbRange * 100))) : 50;

  // Find dominant scenario across ALL R1-R9
  const scenarios = body.scenarios as Record<string, { probability: number }> | undefined;
  let dominantKey = 'R5';
  let dominantProb = 0;
  for (const k of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'] as const) {
    const p = scenarios?.[k]?.probability ?? 0;
    if (p > dominantProb) { dominantProb = p; dominantKey = k; }
  }

  return {
    price,
    trend: trendDir === 'up' ? 'up' : trendDir === 'down' ? 'down' : 'range',
    adx, diPlus: (body.diPlus as number) || 0, diMinus: (body.diMinus as number) || 0,
    rsi, stochK, macdHist, obv, bbPosition, resistance, support, atr,
    scenarioDominant: dominantKey,
    hasVolume: (body.hasVolume as boolean) ?? false,
  };
}

// ─── Build MSL v4 Context ────────────────────────────────────────
function buildMSLV4Context(body: Record<string, unknown>): MSLV4Context {
  const price = (body.currentPrice as number) || 0;
  const atr = (body.atr as number) || 0;
  const atrRatio = price > 0 ? atr / price : 0;

  const v11Probs = body.v11Probabilities as {
    scenarios: Array<{ key: string; name: string; rawProbability: number }>;
  } | undefined;
  let dominantScenario = '';
  if (v11Probs?.scenarios) {
    const sorted = [...v11Probs.scenarios].sort((a, b) => b.rawProbability - a.rawProbability);
    dominantScenario = sorted[0]?.name ?? '';
  } else {
    const scenarios = body.scenarios as Record<string, { name?: string; probability: number }> | undefined;
    let maxProb = 0;
    for (const k of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9']) {
      const p = scenarios?.[k]?.probability ?? 0;
      if (p > maxProb) { maxProb = p; dominantScenario = scenarios?.[k]?.name ?? k; }
    }
  }

  const trendDir = (body.trendDirection as string) || 'range';
  const isBull = trendDir === 'up';
  const isBear = trendDir === 'down';
  const adx = (body.adx as number) || 0;
  const trendStrength = adx > 40 ? 0.9 : adx > 25 ? 0.7 : adx > 15 ? 0.4 : 0.15;

  let regime: MSLV4Context['regime'] = 'Range';
  if (isBull && trendStrength > 0.6) regime = 'Strong Bull';
  else if (isBull) regime = 'Weak Bull';
  else if (isBear && trendStrength > 0.6) regime = 'Strong Bear';
  else if (isBear) regime = 'Weak Bear';

  const instrumentType = (body.instrumentType as string) || (body.symbolName as string) || 'stock';
  const ta = body.technicalAnalysis as {
    classicPatternCount?: number; harmonicPatternCount?: number;
    elliottWaveCount?: number; divergenceCount?: number;
  } | undefined;
  const overallConfidence = (body.overallConfidence as number) ?? (body.confidence as number) ?? 0.6;

  return {
    asset: instrumentType, timeframe: (body.timeframe as string) || 'daily',
    regime, confidence: Math.max(0, Math.min(1, overallConfidence)),
    volatility: atrRatio, trend_strength: trendStrength, dominantScenario,
    pattern_counts: { classical: ta?.classicPatternCount ?? 0, harmonic: ta?.harmonicPatternCount ?? 0, elliott: ta?.elliottWaveCount ?? 0 },
    divergence_present: (ta?.divergenceCount ?? 0) > 0,
    hasVolume: (body.hasVolume as boolean) ?? false,
    rsi: (body.rsi as number) || 50, adx,
    audience_level: (body.audienceLevel as string) || 'pro',
  };
}

// ─── Build Prompt (optimized, concise) ────────────────────────────
function buildPrompt(body: Record<string, unknown>, mlSelection: ReturnType<typeof selectMLCombination>, methods: string[]): string {
  const {
    symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx,
    stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, obv, hasVolume,
    bollingerUpper, bollingerLower,
    trendDirection, trendAngle, trendR2,
    scenarios, resistanceStrengths, supportStrengths,
  } = body as {
    symbolName: string; currentPrice: number; ma21: number; ma100: number;
    rsi: number; mfi: number; cci: number; adx: number;
    stochK: number; stochD: number; macdLine: number; macdSignal: number; macdHist: number;
    diPlus: number; diMinus: number; sar: number; atr: number; obv: number;
    bollingerUpper: number; bollingerLower: number;
    trendDirection: string; trendAngle: number; trendR2: number;
    scenarios: Record<string, { name?: string; probability: number; targetMin: number; targetMax: number }>;
    hasVolume: boolean;
    resistanceStrengths: Array<{ price: number; strength: number; methods?: unknown[] }>;
    supportStrengths: Array<{ price: number; strength: number; methods?: unknown[] }>;
  };

  const trendLabel = trendDirection === 'up' ? '\u0635\u0639\u0648\u062f\u06cc' : trendDirection === 'down' ? '\u0646\u0632\u0648\u0644\u06cc' : '\u062e\u0646\u062b\u06cc';
  const adxStrength = adx > 40 ? '\u0628\u0633\u06cc\u0627\u0631 \u0642\u0648\u06cc' : adx > 25 ? '\u0642\u0648\u06cc' : adx > 15 ? '\u0645\u062a\u0648\u0633\u0637' : '\u0636\u0639\u06cc\u0641';
  const rsiSignal = rsi > 70 ? '\u0627\u0634\u0628\u0627\u0639 \u062e\u0631\u06cc\u062f \u0634\u062f\u06cc\u062f' : rsi > 60 ? '\u0627\u0634\u0628\u0627\u0639 \u062e\u0631\u06cc\u062f' : rsi > 40 ? '\u062e\u0646\u062b\u06cc' : rsi > 30 ? '\u0627\u0634\u0628\u0627\u0639 \u0641\u0631\u0648\u0634' : '\u0627\u0634\u0628\u0627\u0639 \u0641\u0631\u0648\u0634 \u0634\u062f\u06cc\u062f';
  const diPressure = diPlus > diMinus ? '\u0641\u0634\u0627\u0631 \u062e\u0631\u06cc\u062f \u063a\u0627\u0644\u0628' : '\u0641\u0634\u0627\u0631 \u0641\u0631\u0648\u0634 \u063a\u0627\u0644\u0628';

  const R1 = resistanceStrengths?.[0];
  const S1 = supportStrengths?.[0];
  const R1Price = R1?.price ?? Math.round(currentPrice * 1.05);
  const S1Price = S1?.price ?? Math.round(currentPrice * 0.95);
  const R1Grade = R1?.strength ? srGrade(R1.strength) : '\u0646\u0627\u0645\u0634\u062e\u0635';
  const S1Grade = S1?.strength ? srGrade(S1.strength) : '\u0646\u0627\u0645\u0634\u062e\u0635';

  const obvDesc = hasVolume
    ? (obv > 0 ? `\u0645\u062b\u0628\u062a (+${(obv / 1e6).toFixed(1)}M)` : `\u0645\u0646\u0641\u06cc (${(obv / 1e6).toFixed(1)}M)`)
    : '\u0628\u062f\u0648\u0646 \u062f\u0627\u062f\u0647 \u062d\u062c\u0645';

  const macdDesc = macdHist > 0 && macdLine > macdSignal
    ? '\u0635\u0639\u0648\u062f\u06cc \u062c\u0647\u062a \u0628\u0627\u0644\u0627'
    : macdHist > 0 ? '\u0635\u0639\u0648\u062f\u06cc' : '\u0646\u0632\u0648\u0644\u06cc';

  const methodsStr = methods.map((m, i) => `${i + 1}. ${m}`).join('\n');

  // V11 probabilities
  let v11Block = '';
  const v11Probs = body.v11Probabilities as {
    scenarios: Array<{ key: string; name: string; rawProbability: number; cumulativeProbability: number }>;
    bullishCumulative: number; bearishCumulative: number; neutralCumulative: number; riskProfile: string;
  } | undefined;
  if (v11Probs?.scenarios) {
    const v11Lines = v11Probs.scenarios.map((s, i) =>
      `- R${i + 1} (${s.name}): \u0627\u062e\u062a\u0635\u0627\u0635\u06cc ${toPersianNum(s.rawProbability)}\u066a | \u062a\u062c\u0645\u0639\u06cc ${toPersianNum(s.cumulativeProbability)}\u066a`
    ).join('\n');
    const riskLabels: Record<string, string> = {
      very_bullish: '\u0635\u0639\u0648\u062f\u06cc \u0642\u0648\u06cc', bullish: '\u0635\u0639\u0648\u062f\u06cc', neutral: '\u062e\u0646\u062b\u06cc', bearish: '\u0646\u0632\u0648\u0644\u06cc', very_bearish: '\u0646\u0632\u0648\u0644\u06cc \u0642\u0648\u06cc',
    };
    v11Block = `\n**\u0627\u062d\u062a\u0645\u0627\u0644\u0627\u062a v11:**\n${v11Lines}\n- \u0645\u062c\u0645\u0648\u0639 \u0635\u0639\u0648\u062f\u06cc: ${toPersianNum(v11Probs.bullishCumulative)}\u066a | \u0646\u0632\u0648\u0644\u06cc: ${toPersianNum(v11Probs.bearishCumulative)}\u066a | \u067e\u0631\u0648\u0641\u0627\u06cc\u0644: ${riskLabels[v11Probs.riskProfile] || v11Probs.riskProfile}`;
  }

  // Top 5 scenarios by probability
  const allScenarios = (['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'] as const)
    .map((k, i) => ({
      key: k,
      name: scenarios?.[k]?.name || getScenarioName(k),
      prob: scenarios?.[k]?.probability ?? 0,
      min: scenarios?.[k]?.targetMin ?? 0,
      max: scenarios?.[k]?.targetMax ?? 0,
    }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5);

  const scenarioBlock = allScenarios
    .map(s => `- ${s.name} (${s.key}): ${toPersianNum(s.prob)} \u062f\u0631\u0635\u062f | \u0647\u062f\u0641: ${toPersianNum(s.min)} \u2014 ${toPersianNum(s.max)}`)
    .join('\n');

  // Instrument type for currency unit rules
  const instType = (body.instrumentType as string) || 'tse';
  const unitLabel = instType === 'tgju' || instType === 'yahoo' ? '\u0648\u0627\u062d\u062f' : '\u0631\u06cc\u0627\u0644';
  const instrumentLabel = instType === 'tgju' ? '\u06a9\u0627\u0644\u0627\u06cc \u0637\u0644\u0627/\u0627\u0631\u0632' : instType === 'yahoo' ? '\u0646\u0634\u0627\u0646\u06af\u0631 \u0628\u06cc\u0646 \u0627\u0644\u0645\u0644\u0644\u06cc' : '\u0633\u0647\u0627\u0645 \u0628\u0648\u0631\u0633 \u0627\u06cc\u0631\u0627\u0646';

  return `
**\u062f\u0627\u062f\u0647\u200c\u0647\u0627\u06cc \u067e\u0627\u06cc\u0647:**
- \u0646\u0627\u0645: **${symbolName}** | \u0646\u0648\u0639: **${instrumentLabel}** | \u0642\u06cc\u0645\u062a: **${toPersianNum(currentPrice)}** ${unitLabel} | \u0631\u0648\u0646\u062f: **${trendLabel}** (${toPersianNum(Math.abs(trendAngle))}\u00b0, R\u00b2=${(trendR2 * 100).toFixed(1)}%)
- MA21=${toPersianNum(ma21)} | MA100=${toPersianNum(ma100)} | ${currentPrice > ma21 ? '\u0628\u0627\u0644\u0627\u062a\u0631 \u0627\u0632' : '\u067e\u0627\u06cc\u06cc\u0646\u200c\u062a\u0631 \u0627\u0632'} MA21, ${currentPrice > ma100 ? '\u0628\u0627\u0644\u0627\u062a\u0631 \u0627\u0632' : '\u067e\u0627\u06cc\u06cc\u0646\u200c\u062a\u0631 \u0627\u0632'} MA100
- RSI=${toPersianNum(rsi)} (${rsiSignal}) | ADX=${toPersianNum(adx)} (${adxStrength}) | DI+/DI-: ${toPersianNum(diPlus)}/${toPersianNum(diMinus)} (${diPressure})
- \u0627\u0633\u062a\u0648\u06a9=${toPersianNum(stochK)}/${toPersianNum(stochD)} | CCI=${toPersianNum(cci)}${mfi > 0 ? ` | MFI=${toPersianNum(mfi)}` : ''}
- MACD: ${macdDesc} (${toPersianNum(macdLine)}/${toPersianNum(macdSignal)}/${toPersianNum(macdHist)}) | OBV: ${obvDesc}
- \u0628\u0627\u0646\u062f: ${toPersianNum(bollingerLower)} \u2014 ${toPersianNum(bollingerUpper)} | SAR: ${toPersianNum(sar)} | ATR: ${toPersianNum(atr)}
- \u0645\u0642\u0627\u0648\u0645\u062a: ${toPersianNum(R1Price)} (${R1Grade}) | \u062d\u0645\u0627\u06cc\u062a: ${toPersianNum(S1Price)} (${S1Grade})

**\u0633\u0646\u0627\u0631\u06cc\u0648\u0647\u0627\u06cc \u0628\u0631\u062a\u0631 (\u0645\u0631\u062a\u0628 \u0628\u0631 \u0627\u062d\u062a\u0645\u0627\u0644):**
${scenarioBlock}
${v11Block}
**\u0631\u0648\u0634\u200c\u0647\u0627:**\n${methodsStr}
`;
}

// ─── System prompt ────────────────────────────────────────────────
const SYSTEM_PROMPT = `شما یک تحلیلگر ارشد بازارهای مالی ایرانی هستید.
یک تحلیل حرفه‌ای و کاربردی بنویسید.

قواعد خروجی:
1. حداقل 800 کلمه و حداکثر 1,500 کلمه.
2. تمام اعداد به فارسی و سه رقم سه رقم جدا شوند.
3. از ایموجی‌های تحلیلی مناسب استفاده کنید: 📊 📈 📉 ⚡ 🔑 ⚠️ 🎯 ✅ ❌ ❓ 💡 🔴 🟢. حداکثر 6 تا در کل متن. **ممنوعیت مطلق:** به هیچ عنوان از ایموجی‌های آدمک، چهره، شخص یا بدن انسان استفاده نکنید (مثل 🧑‍💼 👤 🙋 💂 🧑‍💻 🧑‍🔧 و مشابه آن‌ها).
4. متن شامل 3 تا 5 پاراگراف باشد. هر پاراگراف بلند و عمیق (200 تا 500 کلمه).
5. متن کاملاً به زبان فارسی باشد. **ممنوعیت مطلق:** به هیچ عنوان از کلمات، عبارات یا جمله‌سازی‌های زبان چینی در متن استفاده نشود.
6. تحلیل یک‌پارچه و پیوسته بنویسید. **ممنوعیت مطلق:** به هیچ عنوان از عباراتی مثل «از منظر عملیاتی»، «از دیدگاه عملیاتی»، «از زاویه عملیاتی» یا هر عبارت مشابه که متن را به بخش‌های جداگانه تقسیم می‌کند استفاده نکنید. تحلیل باید یک جریان یکپارچه و روان باشد بدون هیچ‌گونه برچسب‌گذاری داخلی یا دسته‌بندی لایه‌ای.
7. شامل سناریوی معاملاتی کامل باشد: جهت, نقطه ورود, حد ضرر, اهداف, نسبت ریسک/ریوارد.
8. شامل درخت سناریویی انشعابی و تحلیل حساسیت باشد.
9. اگر در متن سؤالی یا ابهامی مطرح می‌شود، **حتماً** باید در همان پاراگراف یا پاراگراف بعدی با استناد به سناریوها و احتمالات ارائه‌شده به آن پاسخ داده شود. هیچ سؤالی بدون پاسخ باقی نماند.
10. هیچ اشاره‌ای به مکتب, سبک, لحن, سیستم هوشمند, روش ML یا هر اصطلاح داخلی سیستم نشود.
11. در ابتدا یک عنوان مختصر و در انتها جمله روایت غالب (پررنگ) و خلاصه عملی (حداکثر 30 کلمه) بیاورید.
12. درصدها را به صورت کامل بنویسید: مثلاً «5 درصد» نه «5٪». درصدها باید منطقی و معقول باشند (مثلاً بین 1 تا 99 درصد).
13. برای کلمات و عبارات مهم از **بولد** استفاده کنید (حداقل 8 مورد بولد در کل متن).
14. هیچ سرفصل یا عنوان داخلی سیستم (مثل مرحله, فاز, خروجی سه‌لایه, تحلیل عملیاتی, تحلیل تحلیلی, تحلیل روانشناختی و غیره) در متن نباشد. متن باید یکپارچه و روان باشد.
15. متن خروجی فقط و فقط تحلیل باشد. هیچ دستورالعمل, ساختار یا راهنمای داخلی در خروجی نیاید.
16. برای رنگی کلمات مهم از دستور {color:COLOR}متن{/color} استفاده کنید. رنگهای مجاز: red, green, amber, blue, orange, purple, emerald. مثال: {color:red}**خطر شکست سطح مقاومت**{/color}. حداکثر 8 مورد رنگی در کل متن.
17. درصدهایی که در داده‌های ورودی به شما ارائه شده‌اند را دقیقاً همان‌طور که هست استفاده کنید. هرگز درصدی را ضربدر 100 نکنید.
18. **فاصله‌گذاری صحیح:** بین هر دو کلمه حتماً یک فاصله (Space) باشد. هیچ دو کلمه‌ای نباید به هم بچسبند. نیم‌فاصله (ZWNJ) فقط در جای صحیح استفاده شود (مثل فعل‌های مزید، پیشوندها و پسوندها). مثال صحیح: «حد ضرر»، «نقطه ورود». مثال غلط: «حدضرر»، «نقطه‌ورود» (نیم‌فاصله اشتباه)، «حد ضر ر» (فاصله اشتباه).
19. **نگارش بی‌نقص:** متن باید از نظر املایی، انشایی و نگارشی کاملاً بی‌نقص باشد. هیچ غلط املایی، خطای دستوری یا عبارت نادرست فارسی در متن نباشد. از کلمات مترادف و متنوع استفاده کنید و از تکرار بیش از حد یک کلمه یا عبارت پرهیز کنید.
20. **واحد پولی و اندازه‌گیری:**
    - اگر نوع ابزار «سهام بورس ایران» است، تمام اعداد قیمت را با واحد «ریال» بنویسید (مثلاً «۵,۲۳۰ ریال» یا «۲,۱۵۰,۰۰۰ ریال»).
    - اگر نوع ابزار «کالای طلا/ارز» یا «نشانگر بین‌المللی» است، به جای واحد پولی از کلمه «واحد» استفاده کنید (مثلاً «۵ میلیون واحد» یا «۲,۱۴۵,۰۰۰ واحد»). به هیچ وجه از «ریال» یا «تومان» استفاده نکنید.
    - در مورد شاخص‌ها و نشانگرها، هیچ واحد پولی به کار نبرید و فقط بگویید «واحد» (مثلاً «شاخص در محدوده ۲ میلیون واحد قرار دارد»).`;

// ─── POST Handler ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    if (!body.currentPrice) {
      return NextResponse.json({ error: 'currentPrice is required' }, { status: 400 });
    }

    const symbolName = String(body.symbolName || 'unknown');
    const today = getTodayDateStr();

    // 1. Check daily persistent cache (Prisma/SQLite)
    try {
      const cached = await db.aiAnalysisCache.findUnique({
        where: { symbol_date: { symbol: symbolName, date: today } },
      });
      if (cached && cached.text) {
        console.log(`[AI] Daily cache HIT for ${symbolName} (${today}) [${Date.now() - startTime}ms]`);
        return NextResponse.json({
          text: cached.text,
          ml: cached.ml ? JSON.parse(cached.ml) : undefined,
          cached: true,
          cachedDate: cached.date,
        });
      }
    } catch (dbErr) {
      console.warn('[AI] DB cache read failed, continuing:', dbErr instanceof Error ? dbErr.message : dbErr);
    }

    // 2. ML selection
    const mlInput = buildMLInput(body);
    const mlSelection = selectMLCombination(mlInput);
    const methods = selectMethods(mlInput);

    // 3. MSL v4 selection
    const mslCtx = buildMSLV4Context(body);
    const mslResult = selectMSLV4(mslCtx);
    mlSelection.school = mslResult.school_of_analysis.primary.id as typeof mlSelection.school;
    mlSelection.style = mslResult.analysis_style.primary.id as typeof mlSelection.style;
    mlSelection.tone = mslResult.analysis_tone.primary.id as typeof mlSelection.tone;
    mlSelection.reasoning = `MSLv4: ${mslResult.school_of_analysis.primary.id}/${mslResult.analysis_style.primary.id}/${mslResult.analysis_tone.primary.id}`;

    // 4. Build prompt
    const mslSystemPrompt = buildMSLV4PromptSection(mslResult);
    const userMessage = buildPrompt(body, mlSelection, methods);
    const dynamicSystemPrompt = `${SYSTEM_PROMPT}\n\n${mslSystemPrompt}`;

    console.log(`[AI] Generating for ${symbolName} (cache miss) [${Date.now() - startTime}ms]`);

    // 5. Call AI through dedicated channel (independent of page_reader queue)
    const content = await dedicatedAIChatCompletion(
      [
        { role: 'system', content: dynamicSystemPrompt },
        { role: 'user', content: userMessage },
      ],
      {
        timeoutMs: 240_000,  // 4 min total (enough for 5 retries with backoff)
        maxRetries: 5,
      }
    );

    const mlData = { school: mlSelection.school, style: mlSelection.style, tone: mlSelection.tone, reasoning: mlSelection.reasoning, methods };

    // 7. Save to daily persistent cache
    try {
      await db.aiAnalysisCache.upsert({
        where: { symbol_date: { symbol: symbolName, date: today } },
        create: {
          symbol: symbolName,
          date: today,
          text: content,
          ml: JSON.stringify(mlData),
          price: Number(body.currentPrice) || 0,
        },
        update: {
          text: content,
          ml: JSON.stringify(mlData),
          price: Number(body.currentPrice) || 0,
        },
      });
      console.log(`[AI] Saved to daily cache: ${symbolName} (${today}) [${Date.now() - startTime}ms]`);
    } catch (dbErr) {
      console.warn('[AI] DB cache write failed:', dbErr instanceof Error ? dbErr.message : dbErr);
    }

    console.log(`[AI] Complete for ${symbolName} [${Date.now() - startTime}ms]`);
    return NextResponse.json({ text: content, ml: mlData });

  } catch (err) {
    console.error(`[AI] Error [${Date.now() - startTime}ms]:`, err);
    return NextResponse.json({ error: userFriendlyError(err), text: '' }, { status: 500 });
  }
}

function userFriendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Rate limited') || msg.includes('429')) {
    return 'سرور هوشمند محدودیت سرعت دارد. لطفاً دکمه «تلاش مجدد» را بزنید.';
  }
  if (msg.includes('Timed out') || msg.includes('timeout') || msg.includes('Timeout')) {
    return 'زمان پاسخدهی هوشمند به پایان رسید. لطفاً دوباره تلاش کنید.';
  }
  if (msg.includes('concurrent')) {
    return 'درخواست تحلیل قبلی هنوز در حال اجراست. لطفاً کمی صبر کنید.';
  }
  return 'خطایی در تولید تحلیل رخ داد. لطفاً دوباره تلاش کنید.';
}
