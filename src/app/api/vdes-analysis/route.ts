/**
 * @module API /api/vdes-analysis
 * @description VDES (V7) AI-powered technical analysis narrative generator.
 *
 * **LOCKED VERSION — DO NOT MODIFY.** All future changes must go to
 * `/api/v8-analysis/route.ts`.
 *
 * V7 Features: Deterministic Narrative Engine
 * Uses `ml-narrative.ts` for School × Style × Tone selection
 * (10 × 10 × 15 = 1,500 combinations), then generates a Persian analysis
 * via ZAI LLM tuned to the selected combination.
 *
 * Flow: narrative selection → prompt building → cache check → LLM call → response
 */
// ═══════════════════════════════════════════════════════════════════════════════
// VDES Analysis API v7 — LOCKED VERSION — DO NOT MODIFY
// ═══════════════════════════════════════════════════════════════════════════════
// This file is PERMANENTLY LOCKED as the stable V7 release.
// All future changes MUST be applied to /api/v8-analysis/route.ts instead.
// Modifying this file will break the version-lock contract.
// ═══════════════════════════════════════════════════════════════════════════════
// V7 Features: Deterministic Narrative Engine
// Uses ml-narrative.ts for School x Style x Tone selection (10x10x15 = 1500 combos)
// Then generates a Persian analysis via ZAI LLM tuned to the selected combination.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { dedicatedAIChatCompletion } from '@/lib/zai-shared';
import { selectNarrativeCombination, buildNarrativeInput } from '@/lib/ml-narrative';
import type { NarrativeCombination } from '@/lib/ml-narrative';

/** Force dynamic rendering — never cache at the Next.js edge. */
export const dynamic = 'force-dynamic';

// ─── Version & Cache ────────────────────────────────────────────────
/** Current VDES analysis schema version — bumped when prompt/response format changes. */
const ANALYSIS_VERSION = 7;
/** In-memory LRU-style cache: key → { version, analysis text, timestamp }. */
const cache = new Map<string, { v: number; text: string; ts: number }>();
/** Cache time-to-live: 10 minutes. Entries past this age are evicted on next write. */
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Build a deterministic cache key from request fields so that identical
 * technical data always maps to the same cached analysis.
 * Includes version number to invalidate cache on schema upgrades.
 *
 * @param body - The VDES request payload.
 * @returns String key of the form `v:symbolName:currentPrice:trendDirection:rsi:adx`
 */
function cacheKey(body: VdesRequest): string {
  // Include the narrative selection dimensions so different combos don't collide
  const c = `${ANALYSIS_VERSION}:${body.symbolName}:${body.currentPrice}:${body.trendDirection}:${body.rsi}:${body.adx}`;
  return c;
}

/**
 * Format a number with fixed decimal places for Persian display.
 * Falls back to '0' for non-finite values.
 *
 * @param n - Number to format.
 * @param d - Decimal places (default 0).
 * @returns Formatted string.
 */
function fmt(n: number, d = 0): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  return n.toFixed(d);
}

/**
 * Format a number with Persian (fa-IR) locale grouping and rounding.
 * Falls back to '0' for non-finite values.
 *
 * @param n - Number to format.
 * @returns Locale-formatted string, e.g. "۱٬۲۳۴٬۵۶۷".
 */
function fmtGrouped(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('fa-IR');
}

/**
 * Map a support/resistance strength score to a Persian grade label.
 *
 * @param strength - Numeric strength value (typically 0–10).
 * @returns Persian grade: 'بسیار قوی' | 'قوی' | 'متوسط' | 'ضعیف' | 'بسیار ضعیف'
 */
function srGrade(strength: number): string {
  if (strength >= 8.5) return 'بسیار قوی';
  if (strength >= 7) return 'قوی';
  if (strength >= 5) return 'متوسط';
  if (strength >= 3) return 'ضعیف';
  return 'بسیار ضعیف';
}

// ─── Types ────────────────────────────────────────────────────────────
/**
 * A named price scenario with probability and target range.
 * @property name      - Persian scenario name.
 * @property nameEn    - English scenario name.
 * @property probability - Probability percentage (0–100).
 * @property targetMin - Lower bound of the price target range.
 * @property targetMax - Upper bound of the price target range.
 * @property description - Persian description of the scenario.
 */
interface Scenario {
  name: string;
  nameEn: string;
  probability: number;
  targetMin: number;
  targetMax: number;
  description: string;
}

/**
 * Request payload for VDES AI analysis.
 * Contains all technical indicators, scenarios, and S/R levels needed to
 * build the LLM prompt.
 *
 * @property symbolName       - Persian symbol name (e.g. "فولاد").
 * @property currentPrice     - Latest close price.
 * @property ma21 / ma100     - Moving averages.
 * @property rsi / mfi / cci / adx - Oscillators and momentum indicators.
 * @property stochK / stochD  - Stochastic oscillator values.
 * @property macdLine / macdSignal / macdHist - MACD components.
 * @property diPlus / diMinus - Directional indicators.
 * @property sar              - Parabolic SAR value.
 * @property atr              - Average True Range.
 * @property obv              - On-Balance Volume.
 * @property hasVolume        - Whether volume data is available.
 * @property bollingerUpper/Middle/Lower - Bollinger Band values.
 * @property trendDirection    - 'up' | 'down' | 'neutral'.
 * @property trendAngle       - Linear regression slope angle (degrees).
 * @property trendR2          - R² goodness-of-fit for trend line.
 * @property overallSignal    - 'bullish' | 'bearish' | 'neutral'.
 * @property scenarios        - Map of scenario keys (SC1–SC5) to Scenario objects.
 * @property resistances / supports - Arrays of price levels.
 * @property resistanceStrengths / supportStrengths - Optional strength metadata.
 * @property priceTargets     - Optional tagged price targets.
 * @property isIndex          - True if the symbol is a market index.
 * @property isTgju           - True if the symbol is from TGJU data source.
 * @property currencyUnit     - Display currency unit (default 'ریال').
 */
interface VdesRequest {
  symbolName: string;
  currentPrice: number;
  ma21: number;
  ma100: number;
  rsi: number;
  mfi: number;
  cci: number;
  adx: number;
  stochK: number;
  stochD: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  diPlus: number;
  diMinus: number;
  sar: number;
  atr: number;
  obv: number;
  hasVolume: boolean;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  trendDirection: string;
  trendAngle: number;
  trendR2: number;
  overallSignal: string;
  scenarios: Record<string, Scenario>;
  resistances: number[];
  supports: number[];
  resistanceStrengths?: { strength: number; overlapCount?: number; grade?: string; touchCount?: number; volumeRatio?: number }[];
  supportStrengths?: { strength: number; overlapCount?: number; grade?: string; touchCount?: number; volumeRatio?: number }[];
  priceTargets?: { price: number; strength: number; isTarget: boolean; grade?: string }[];
  isIndex?: boolean;
  isTgju?: boolean;
  currencyUnit?: string;
}

/**
 * Build the V7 data section of the LLM prompt — a Persian-language markdown
 * block containing all technical indicators, S/R levels, scenarios, and
 * trend information formatted for the AI to consume.
 *
 * This function is shared between the prompt builder and debug output.
 *
 * @param body - The VDES request payload with all technical data.
 * @returns A Persian markdown string with the complete data section.
 */
function buildDataSection(body: VdesRequest): string {
  const {
    symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx,
    stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, obv, hasVolume,
    bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal,
    scenarios, resistances, supports,
    resistanceStrengths, supportStrengths,
    isIndex, isTgju, currencyUnit,
  } = body;

  const unit = currencyUnit || 'ریال';
  const label = isIndex ? `شاخص ${symbolName}` : isTgju ? symbolName : `سهم ${symbolName}`;
  const trendLabel = trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی';
  const r2Pct = (trendR2 * 100).toFixed(1);
  const adxStrength = adx > 40 ? 'بسیار قوی' : adx > 25 ? 'قوی' : adx > 15 ? 'متوسط' : 'ضعیف';
  const rsiSignal = rsi > 70 ? 'اشباع خرید شدید' : rsi > 60 ? 'اشباع خرید' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش' : 'اشباع فروش شدید';
  const stochSignal = stochK > 80 ? 'اشباع خرید' : stochK < 20 ? 'اشباع فروش' : stochK > stochD ? 'صعودی' : 'نزولی';

  const bbRange = bollingerUpper - bollingerLower;
  const bbPos = bbRange > 0 ? Math.round((currentPrice - bollingerLower) / bbRange * 100) : 50;
  const bbSignal = currentPrice > bollingerUpper
    ? 'بالای باند بالایی'
    : currentPrice < bollingerLower
    ? 'زیر باند پایینی'
    : `داخل باندها (${bbPos}٪)`;

  const R1 = resistances[0] ?? Math.round(currentPrice * 1.05);
  const R2 = resistances[1] ?? Math.round(currentPrice * 1.10);
  const R3 = resistances[2] ?? Math.round(currentPrice * 1.15);
  const S1 = supports[0] ?? Math.round(currentPrice * 0.95);
  const S2 = supports[1] ?? Math.round(currentPrice * 0.90);
  const S3 = supports[2] ?? Math.round(currentPrice * 0.85);

  const r1Grade = resistanceStrengths?.[0]?.grade || (resistanceStrengths?.[0]?.strength ? srGrade(resistanceStrengths[0].strength) : 'نامشخص');
  const s1Grade = supportStrengths?.[0]?.grade || (supportStrengths?.[0]?.strength ? srGrade(supportStrengths[0].strength) : 'نامشخص');
  const r1Confirm = resistanceStrengths?.[0]?.overlapCount ? `(${resistanceStrengths[0].overlapCount} روش تأیید)` : '';
  const s1Confirm = supportStrengths?.[0]?.overlapCount ? `(${supportStrengths[0].overlapCount} روش تأیید)` : '';

  const overallLabel = overallSignal === 'bullish' ? 'صعودی' : overallSignal === 'bearish' ? 'نزولی' : 'خنثی';
  const posVsMa21 = currentPrice > ma21 ? 'بالاتر' : 'پایین‌تر';
  const posVsMa100 = currentPrice > ma100 ? 'بالاتر' : 'پایین‌تر';

  const obvDesc = hasVolume
    ? (obv > 0
      ? `مثبت (OBV بالاست و نشان‌دهنده ورود پول هوشمند است)`
      : `منفی (OBV رو به پایین و نشانه خروج پول هوشمند)`)
    : 'بدون داده حجم';

  const macdDesc = macdHist > 0 && macdLine > macdSignal
    ? 'صعودی با تأیید تقاطع مثبت'
    : macdHist > 0
    ? 'صعودی اما هیستوگرام در حال تضعیف'
    : 'نزولی';

  const cciDesc = cci > 100 ? 'بالاتر از +۱۰۰ (اشباع خرید)' : cci < -100 ? 'پایین‌تر از -۱۰۰ (اشباع فروش)' : 'در محدوده نرمال';

  const mfiDesc = hasVolume
    ? (mfi > 80 ? 'اشباع خرید (بیش از ۸۰)' : mfi < 20 ? 'اشباع فروش (کمتر از ۲۰)' : `${fmt(mfi, 1)} (محدوده نرمال)`)
    : 'بدون داده حجم';

  return `
**داده‌های پایه (واقعی و غیرقابل تغییر):**
- نام ابزار: **${label}**
- قیمت مرجع: **${fmtGrouped(currentPrice)} ${unit}**
- روند میان‌مدت: **${trendLabel}** (زاویه ${fmt(trendAngle, 1)}°، R²=${r2Pct}٪)
- موقعیت نسبت به میانگین‌ها: ${posVsMa21} از **MA21 (${fmtGrouped(ma21)} ${unit})** و ${posVsMa100} از **MA100 (${fmtGrouped(ma100)} ${unit})**
- **ADX=${fmt(adx, 1)}** (${adxStrength})، **DI+ (${fmt(diPlus, 1)}) ${diPlus > diMinus ? '>' : '<'} DI- (${fmt(diMinus, 1)})** ← ${diPlus > diMinus ? 'فشار خرید غالب' : 'فشار فروش غالب'}
- **RSI=${fmt(rsi, 1)}** (${rsiSignal})
- **استوکاستیک K=${fmt(stochK, 0)} / D=${fmt(stochD, 0)}** (${stochSignal})
- **CCI=${fmt(cci, 1)}** (${cciDesc})
- **MFI=${mfiDesc}**
- **MACD** ${macdDesc} (خط=${fmt(macdLine, 2)}، سیگنال=${fmt(macdSignal, 2)}، هیستوگرام=${fmt(macdHist, 2)})
- **OBV** ${obvDesc}
- **SAR (پارابولیک)**: ${fmtGrouped(sar)} ${unit}
- قیمت **${bbSignal}** (باند بالایی ${fmtGrouped(bollingerUpper)}، باند میانی ${fmtGrouped(bollingerMiddle)}، باند پایینی ${fmtGrouped(bollingerLower)})
- مقاومت **R1** در ${fmtGrouped(R1)} ${unit} (${r1Grade} ${r1Confirm})
${R2 ? `- مقاومت **R2** در ${fmtGrouped(R2)} ${unit}${resistanceStrengths?.[1]?.grade ? ` (${resistanceStrengths[1].grade})` : ''}  \n` : ''}${R3 ? `- مقاومت **R3** در ${fmtGrouped(R3)} ${unit}${resistanceStrengths?.[2]?.grade ? ` (${resistanceStrengths[2].grade})` : ''}  \n` : ''}- حمایت **S1** در ${fmtGrouped(S1)} ${unit} (${s1Grade} ${s1Confirm})
${S2 ? `- حمایت **S2** در ${fmtGrouped(S2)} ${unit}${supportStrengths?.[1]?.grade ? ` (${supportStrengths[1].grade})` : ''}  \n` : ''}${S3 ? `- حمایت **S3** در ${fmtGrouped(S3)} ${unit}${supportStrengths?.[2]?.grade ? ` (${supportStrengths[2].grade})` : ''}  \n` : ''}- سیگنال کلی: **${overallLabel}**
- میانگین نوسان روزانه (ATR): ${fmtGrouped(atr)} ${unit}

**سناریوهای محتمل (با احتمالات):**
- **SC1 – ${scenarios.SC1?.name || '—'}:** ${fmt(scenarios.SC1?.probability ?? 0, 0)}٪ (محدوده ${fmtGrouped(scenarios.SC1?.targetMin ?? 0)} — ${fmtGrouped(scenarios.SC1?.targetMax ?? 0)} ${unit})
- **SC2 – ${scenarios.SC2?.name || '—'}:** ${fmt(scenarios.SC2?.probability ?? 0, 0)}٪ (محدوده ${fmtGrouped(scenarios.SC2?.targetMin ?? 0)} — ${fmtGrouped(scenarios.SC2?.targetMax ?? 0)} ${unit})
- **SC3 – ${scenarios.SC3?.name || '—'}:** ${fmt(scenarios.SC3?.probability ?? 0, 0)}٪ (محدوده ${fmtGrouped(scenarios.SC3?.targetMin ?? 0)} — ${fmtGrouped(scenarios.SC3?.targetMax ?? 0)} ${unit})
- **SC4 – ${scenarios.SC4?.name || '—'}:** ${fmt(scenarios.SC4?.probability ?? 0, 0)}٪ (محدوده ${fmtGrouped(scenarios.SC4?.targetMin ?? 0)} — ${fmtGrouped(scenarios.SC4?.targetMax ?? 0)} ${unit})
- **SC5 – ${scenarios.SC5?.name || '—'}:** ${fmt(scenarios.SC5?.probability ?? 0, 0)}٪ (محدوده ${fmtGrouped(scenarios.SC5?.targetMin ?? 0)} — ${fmtGrouped(scenarios.SC5?.targetMax ?? 0)} ${unit})
`;
}

/**
 * Build the full V7 narrative prompt for the LLM.
 * Combines the data section, the selected narrative combination
 * (School + Style + Tone), and strict output rules.
 *
 * @param body  - The VDES request payload.
 * @param combo - The selected NarrativeCombination from ml-narrative.
 * @returns The complete user prompt string for the ZAI LLM.
 */
function buildV7Prompt(body: VdesRequest, combo: NarrativeCombination): string {
  const dataSection = buildDataSection(body);

  const { school, style, tone } = combo;

  return `
**دستورالعمل تحلیل v7:**
شما یک **تحلیلگر ارشد بازارهای مالی** هستید. یک تحلیل **عمیق، جامع و منحصربه‌فرد** بر اساس داده‌های تکنیکال ارائه‌شده و **سبک تحلیلی مشخص‌شده** بنویسید.

---
${dataSection}
---

**سبک تحلیلی انتخاب‌شده برای این تحلیل (الزامی):**

**مکتب تحلیلی (School):** ${school.name} (${school.nameEn})
- توضیح: ${school.description}
- ابزارها و شاخص‌های کلیدی این مکتب: ${school.methodology}
- پرسش محوری این مکتب: ${school.focusQuestion}

**سبک روایت (Style):** ${style.name} (${style.nameEn})
- صدا و لحن: ${style.voice}
- ساختار تحلیل: ${style.structure}
- سبک پایان‌بندی: ${style.endingStyle}

**لحن تحلیلی (Tone):** ${tone.name} (${tone.nameEn})
- ویژگی‌ها: ${tone.characteristics}
- واژگان کلیدی: ${tone.vocabulary}
- سبک جملات: ${tone.sentenceStyle}

---
**فرآیند تولید تحلیل:**
1. داده‌های تکنیکال بالا را **از نگاه مکتب تحلیلی انتخاب‌شده** (${school.name}) موشکافانه ارزیابی کنید. یعنی ابزارها و شاخص‌هایی که این مکتب تأکید دارد را **اولویت‌بندی** کنید.
2. **پرسش محوری مکتب** (${school.focusQuestion}) را پاسخ دهید.
3. روابط بین شاخص‌ها و سناریوها را استنباط کنید — به سیگنال‌های متضاد توجه کنید.
4. تحلیل را با **لحن و ساختار روایت** (${style.name}) بنویسید.
5. **واژگان و سبک جملات** متناسب با لحن (${tone.name}) باشد.

---
**قوانین الزامی خروجی:**
1. زبان خروجی فقط و فقط فارسی باشد.
2. هیچ‌گونه ایموجی، شکلک یا کاراکتر غیرحروفی (مانند ❌ ✅ ⚠️ 📈 🔻 🎯 📊) در کل متن استفاده نشود. فقط از علائم نگارشی استاندارد فارسی (نقطه، ویرگول، ؟، !، —،) استفاده شود.
3. از ایجاد عناوین داخلی (مثل #، ## یا تیترهای درون‌متنی) در تحلیل خودداری کنید. متن باید یکپارچه و بدون تیتربندی داخلی باشد.
4. عبارت «از منظر عملیاتی» و هر عبارت مشابه ربات‌گونه و اداری ممنوع است.
5. تحلیل باید یکپارچه، منسجم و پیوسته باشد.
6. درصد‌ها باید به فارسی نوشته شوند (مثلاً ۲۸٪ نه 28%).
7. برای تأکید فقط از **پررنگ** استفاده کنید.
8. **طول تحلیل:** بین ۷۰۰ تا ۱۵۰۰ کلمه.
9. **تعداد پاراگراف:** حداقل ۲ و حداکثر ۴ پاراگراف. هر پاراگراف بلند و عمیق (۲۰۰ تا ۵۰۰ کلمه).
10. حداقل ۳ سوال یا جمله تعجبی در کل متن وجود داشته باشد.
11. در انتهای تحلیل یک **خلاصه عملی** (حداکثر ۳۰ کلمه) با پیشوند «خلاصه عملی:» قرار گیرد.
12. حداقل ۲ ارجاع به شاخص‌های تکنیکال (با نام و عدد) در متن وجود داشته باشد.
13. در پایان هر پاراگراف یک جمع‌بندی جزئی وجود داشته باشد.
14. پاراگراف‌ها نباید کوتاه باشند. هر پاراگراف باید شامل چند جمله کامل و یک ایده اصلی باشد.
15. از تکرار اطلاعات تکراری پرهیز شود — یک بار کامل بگویید، سپس به تحلیل بپردازید.
16. از تکرار ساختارهای یکنواخت پرهیز کنید — عبارات متنوع استفاده شود.
17. **مطلقاً هیچ اشاره‌ای به مکتب تحلیلی، سبک روایت، لحن یا نام شخصیت در متن نشود.** این اطلاعات داخلی سیستم هستند و نباید به کاربر نمایش داده شوند.

---
**خروجی نهایی:**
- **سطر اول:** مستقیماً با تحلیل شروع شود (بدون ذکر نام مکتب، سبک یا لحن)
- **متن اصلی:** تحلیل عمیق (۲ تا ۴ پاراگراف، ۷۰۰ تا ۱۵۰۰ کلمه)
- **خلاصه عملی:** (حداکثر ۳۰ کلمه)

شما یک تحلیلگر ارشد بازارهای مالی ایرانی هستید.`;
}

/**
 * System prompt for the ZAI LLM — enforces Persian-only output, no emojis,
 * no internal headings, long paragraphs, technical references, and a
 * concise actionable summary at the end.
 *
 * This prompt is sent as the `assistant` role message to prime the model.
 */
const SYSTEM_PROMPT = `
شما یک تحلیلگر ارشد بازارهای مالی ایرانی هستید.

قوانین خروجی:
- زبان فقط فارسی. ممنوعیت کامل هر زبان دیگری.
- ممنوعیت کامل ایموجی، شکلک و کاراکتر غیرحروفی.
- فقط علائم نگارشی استاندارد فارسی مجاز است (نقطه، ویرگول، ؟، !، —، «»).
- ممنوعیت عناوین داخلی و تیتربندی. متن یکپارچه.
- ممنوعیت عبارات ربات‌گونه.
- پاراگراف‌های بلند و عمیق. هر پاراگراف ۲۰۰ تا ۵۰۰ کلمه.
- حداقل ۳ پرسش یا جمله تعجبی.
- خلاصه عملی در انتها (حداکثر ۳۰ کلمه).
- حداقل ۲ ارجاع عددی به شاخص‌های تکنیکال.
- جمع‌بندی جزئی در پایان هر پاراگراف.
- از پررنگ ** فقط برای تأکید استفاده شود.`;

/**
 * POST /api/vdes-analysis — Generate a VDES AI-powered technical analysis narrative.
 *
 * @description
 * Processing flow:
 *   1. **Parse & validate** request body — requires `symbolName`, `currentPrice`,
 *      `scenarios`, `resistances`, `supports`.
 *   2. **Narrative selection** — call `buildNarrativeInput()` → `selectNarrativeCombination()`
 *      to deterministically choose a School × Style × Tone combo based on the
 *      technical data (1,500 possible combinations).
 *   3. **Prompt building** — construct the full LLM prompt via `buildV7Prompt()`.
 *   4. **Cache check** — if an identical request (same version + key fields) was
 *      cached within the last 10 minutes, return the cached analysis immediately.
 *   5. **LLM call** — invoke ZAI chat completions with `SYSTEM_PROMPT` + user prompt.
 *      Automatic retry with exponential backoff on HTTP 429 responses.
 *   6. **Cache & respond** — store the result in the in-memory cache, evict stale
 *      entries, and return the analysis text with debug metadata.
 *
 * @param req - Next.js incoming request with JSON body matching {@link VdesRequest}.
 *
 * @requestBody {@link VdesRequest}
 *
 * @returns JSON response:
 *   - **200** `{ analysis: string, _debug: { school, style, tone, schoolScore, styleScore, toneScore, cached, latencyMs } }`
 *   - **400** `{ error: string }` — missing required fields.
 *   - **500** `{ error: string }` — LLM produced empty response or internal error.
 */
export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const body: VdesRequest = await req.json();

    // Validate required fields
    if (!body.symbolName || body.currentPrice == null) {
      return NextResponse.json({ error: 'symbolName و currentPrice الزامی است.' }, { status: 400 });
    }
    if (!body.scenarios || !Array.isArray(body.resistances) || !Array.isArray(body.supports)) {
      return NextResponse.json({ error: 'scenarios، resistances و supports الزامی است.' }, { status: 400 });
    }

    // ── Step 1: Deterministic narrative selection (v7 engine) ──
    const narrativeInput = buildNarrativeInput(body);
    const combo = selectNarrativeCombination(narrativeInput);

    console.log(`[VDES v7] ${body.symbolName} | School: ${combo.school.nameEn} (${combo.schoolScore.toFixed(1)}) | Style: ${combo.style.nameEn} (${combo.styleScore.toFixed(1)}) | Tone: ${combo.tone.nameEn} (${combo.toneScore.toFixed(1)})`);

    // ── Step 2: Build prompt ──
    const prompt = buildV7Prompt(body, combo);

    // ── Step 3: Check cache ──
    const key = cacheKey(body);
    const cached = cache.get(key);
    if (cached && cached.v === ANALYSIS_VERSION && (Date.now() - cached.ts) < CACHE_TTL_MS) {
      console.log(`[VDES v7] Cache hit for ${body.symbolName} (${Math.round(Date.now() - t0)}ms)`);
      return NextResponse.json({
        analysis: cached.text,
        _debug: {
          school: combo.school.name,
          style: combo.style.name,
          tone: combo.tone.name,
          schoolScore: combo.schoolScore,
          styleScore: combo.styleScore,
          toneScore: combo.toneScore,
          cached: true,
          latencyMs: Date.now() - t0,
        },
      });
    }

    // ── Step 4: Call AI LLM ──
    const analysis = await dedicatedAIChatCompletion(
      [
        { role: 'assistant', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      { timeoutMs: 90_000, maxRetries: 3 }
    );

    if (!analysis || analysis.trim().length === 0) {
      return NextResponse.json({ error: 'مدل پاسخی تولید نکرد.' }, { status: 500 });
    }

    // ── Step 5: Cache & respond ──
    cache.set(key, { v: ANALYSIS_VERSION, text: analysis, ts: Date.now() });

    // Evict stale entries
    for (const [k, v] of cache) {
      if ((Date.now() - v.ts) > CACHE_TTL_MS) cache.delete(k);
    }

    console.log(`[VDES v7] Generated for ${body.symbolName} (${analysis.length} chars, ${Math.round(Date.now() - t0)}ms)`);

    return NextResponse.json({
      analysis,
      _debug: {
        school: combo.school.name,
        style: combo.style.name,
        tone: combo.tone.name,
        schoolScore: combo.schoolScore,
        styleScore: combo.styleScore,
        toneScore: combo.toneScore,
        cached: false,
        latencyMs: Date.now() - t0,
      },
    });
  } catch (err) {
    console.error('[VDES v7 Error]:', err);
    return NextResponse.json(
      { error: 'خطا در تولید تحلیل هوشمند. لطفاً دوباره تلاش کنید.' },
      { status: 500 },
    );
  }
}
