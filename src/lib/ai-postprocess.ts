/**
 * Post-processing pipeline for AI analysis text.
 *
 * 1. Price Validation — detect and flag/correct hallucinated prices
 * 2. Persian Text Quality — fix spacing, half-space, paragraphs, grammar
 * 3. Technical Code Cleanup — strip leaked technical codes
 */

// ─── Price Validation ───────────────────────────────────────────

/**
 * A known price reference extracted from analysis input data.
 * Used to detect hallucinated (fabricated) prices in AI output text.
 */
interface PriceReference {
  /** Descriptive label for the price (e.g. 'currentPrice', 'ma21', 'resistance1') */
  label: string;
  /** The actual numeric price value */
  value: number;
}

/**
 * Extract known price references from the analysis request body.
 * Collects current price, moving averages, Bollinger bands, SAR, ATR,
 * support/resistance levels, and scenario targets into a flat array
 * of labelled price references for hallucination detection.
 *
 * @param body - The analysis request body containing technical indicator values
 * @returns Array of PriceReference objects with label and value for each known price
 */
export function buildPriceReferences(body: Record<string, unknown>): PriceReference[] {
  const refs: PriceReference[] = [];
  const add = (label: string, val: number | null | undefined) => {
    if (val && isFinite(val) && val > 0) refs.push({ label, value: val });
  };

  add('currentPrice', body.currentPrice as number);
  add('ma21', body.ma21 as number);
  add('ma100', body.ma100 as number);
  add('bollingerUpper', body.bollingerUpper as number);
  add('bollingerMiddle', body.bollingerMiddle as number);
  add('bollingerLower', body.bollingerLower as number);
  add('sar', body.sar as number);
  add('atr', body.atr as number);

  const resistances = body.resistanceStrengths as Array<{ price: number }> | undefined;
  const supports = body.supportStrengths as Array<{ price: number }> | undefined;
  resistances?.forEach((r, i) => add(`resistance${i + 1}`, r.price));
  supports?.forEach((s, i) => add(`support${i + 1}`, s.price));

  const scenarios = body.scenarios as Record<string, { targetMin?: number; targetMax?: number }> | undefined;
  if (scenarios) {
    for (const [k, v] of Object.entries(scenarios)) {
      add(`${k}_min`, v.targetMin);
      add(`${k}_max`, v.targetMax);
    }
  }

  return refs;
}

/**
 * Convert Persian (۰-۹) and Arabic (٠-٩) digits in a string to Latin (0-9) digits.
 *
 * @param str - String potentially containing Persian/Arabic digits
 * @returns String with all digits converted to Latin (0-9)
 */
function faToEn(str: string): string {
  return str
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));
}

/**
 * Extract all positive numeric values from Persian text.
 * Handles Persian digits (۰-۹), Arabic digits (٠-٩), Latin digits (0-9),
 * and Persian/Arabic thousand separators (٬ ,).
 *
 * @param text - Persian text that may contain numeric values
 * @returns Array of positive finite numbers found in the text
 */
function extractPersianNumbers(text: string): number[] {
  const numbers: number[] = [];
  const pattern = /[\-]?([۰-۹٠-٩0-9]+([٬,][۰-۹٠-٩0-9]+)*)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const cleaned = faToEn(match[0].replace(/[,٬\s]/g, ''));
    const num = Number(cleaned);
    if (isFinite(num) && num > 0) numbers.push(num);
  }
  return numbers;
}

/**
 * Validate that numeric values in AI-generated text correspond to known price references.
 * Numbers outside 10%–300% of current price are ignored. A number is flagged as a
 * hallucination if it differs by more than 15% from every known reference price.
 *
 * @param text - The AI-generated Persian text to validate
 * @param priceRefs - Array of known price references from the analysis input
 * @returns Object with `valid` (true if ≤2 hallucinations) and `hallucinationCount`
 */
export function validatePricesInText(
  text: string,
  priceRefs: PriceReference[],
): { valid: boolean; hallucinationCount: number } {
  if (priceRefs.length === 0) return { valid: true, hallucinationCount: 0 };

  const currentPrice = priceRefs.find(r => r.label === 'currentPrice')?.value ?? 0;
  if (currentPrice <= 0) return { valid: true, hallucinationCount: 0 };

  const numbers = extractPersianNumbers(text);
  let hallucinationCount = 0;

  for (const num of numbers) {
    if (num < currentPrice * 0.1) continue;
    if (num > currentPrice * 3) continue;

    let isKnown = false;
    for (const ref of priceRefs) {
      if (ref.value <= 0) continue;
      const diff = Math.abs(num - ref.value) / ref.value;
      if (diff < 0.15) { isKnown = true; break; }
    }

    if (!isKnown) hallucinationCount++;
  }

  return { valid: hallucinationCount <= 2, hallucinationCount };
}

// ─── Persian Text Quality Fixes ───────────────────────────────────

/**
 * Comprehensive list of compound word fixes.
 * **Persian orthography standard:**
 * - ZWNJ (Zero Width Non-Joiner) is MANDATORY for compound words (e.g., کوتاه‌مدت, نشان‌دهنده, انجام‌شده)
 * - Regular space is used for separate words (e.g., نقطه ورود, فشار خرید, حدّ ضرر)
 * Each entry: [regex for wrong form, correct form]
 */
const COMPOUND_WORD_FIXES: [RegExp, string][] = [
  // Time-related compounds — ZWNJ required
  [/(\S)\u200c?کوتاه(\S)?مدت/g, '$1کوتاه‌مدت'],
  [/(\S)\u200c?بلند(\S)?مدت/g, '$1بلند‌مدت'],
  [/(\S)\u200c?میان(\S)?مدت/g, '$1میان‌مدت'],
  [/(\S)\u200c?طولانی(\S)?مدت/g, '$1طولانی‌مدت'],
  [/کوتاه\u200c?مدت/g, 'کوتاه‌مدت'],
  [/بلند\u200c?مدت/g, 'بلند‌مدت'],
  [/میان\u200c?مدت/g, 'میان‌مدت'],
  [/طولانی\u200c?مدت/g, 'طولانی‌مدت'],

  // Demonstrative/participial compounds — ZWNJ required
  [/نشان\u200c?دهنده/g, 'نشان‌دهنده'],
  [/نشان\u200c?دهند/g, 'نشان‌دهند'],
  [/بازدارنده/g, 'بازدارنده'],  // This one is correct as one word
  [/گزارش\u200c?دهنده/g, 'گزارش‌دهنده'],
  [/تصمیم\u200c?گیری/g, 'تصمیم‌گیری'],  // ZWNJ correct
  [/اطلاع\u200c?رسانی/g, 'اطلاع‌رسانی'],  // ZWNJ correct

  // financial/trading terms — separate words, space required
  [/حد\u200c?ضرر/g, 'حدّ ضرر'],
  [/نقطه\u200c?ورود/g, 'نقطه ورود'],
  [/نقطه\u200c?خروج/g, 'نقطه خروج'],
  [/نسبت\u200c?ریسک/g, 'نسبت ریسک'],
  [/سطح\u200c?مقاومت/g, 'سطح مقاومت'],
  [/سطح\u200c?حمایت/g, 'سطح حمایت'],
  [/فشار\u200c?خرید/g, 'فشار خرید'],
  [/فشار\u200c?فروش/g, 'فشار فروش'],
  [/روند\u200c?صعودی/g, 'روند صعودی'],
  [/روند\u200c?نزولی/g, 'روند نزولی'],
  [/منطقه\u200c?اشباع/g, 'منطقه اشباع'],
  [/خط\u200c?روند/g, 'خط روند'],
  [/الگوی\u200c?سر و شانه/g, 'الگوی سر و شانه'],

  // Preposition + word — separate words, space required
  [/در\u200c?صورت/g, 'در صورت'],
  [/به\u200c?طور/g, 'به طور'],
  [/به\u200c?دلیل/g, 'به دلیل'],
  [/از\u200c?جمله/g, 'از جمله'],

  // Verb prefixes — ZWNJ required
  [/می\u200c?تواند/g, 'می‌تواند'],
  [/می\u200c?رسد/g, 'می‌رسد'],
  [/می\u200c?باشد/g, 'می‌باشد'],
  [/می\u200c?کند/g, 'می‌کند'],
  [/می\u200c?شود/g, 'می‌شود'],
  [/می\u200c?رود/g, 'می‌رود'],
  [/می\u200c?رفت/g, 'می‌رفت'],
  [/می\u200c?توان/g, 'می‌توان'],
  [/نمی\u200c?تواند/g, 'نمی‌تواند'],
  [/نمی\u200c?رسد/g, 'نمی‌رسد'],
  [/نمی\u200c?شود/g, 'نمی‌شود'],
  [/نمی\u200c?کند/g, 'نمی‌کند'],

  // Compound participles — ZWNJ required
  [/انجام\u200c?شده/g, 'انجام‌شده'],
  [/ارائه\u200c?شده/g, 'ارائه‌شده'],
  [/مطرح\u200c?شده/g, 'مطرح‌شده'],

  // Compound adjectives/adverbs — ZWNJ required
  [/قابل\u200c?توجه/g, 'قابل‌توجه'],
  [/هم\u200c?زمان/g, 'هم‌زمان'],
];

/**
 * Words commonly stuck together (no space, no ZWNJ) that need a space.
 * These are words the LLM frequently concatenates incorrectly.
 */
const STUCK_WORDS: [RegExp, string][] = [
  // Time compounds
  [/کوتاهمدت(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'کوتاه‌مدت'],
  [/بلندمدت(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'بلند‌مدت'],
  [/میانمدت(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'میان‌مدت'],
  [/طولانیمدت(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'طولانی‌مدت'],

  // Demonstrative/participial
  [/نشاندهنده(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'نشان‌دهنده'],
  [/نشاندهند(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'نشان‌دهند'],
  [/گزارشدهنده(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'گزارش‌دهنده'],

  // Financial
  [/حدضرر(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'حدّ ضرر'],
  [/نقطهورود(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'نقطه ورود'],
  [/نقطهخروج(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'نقطه خروج'],
  [/فشارخرید(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'فشار خرید'],
  [/فشارفروش(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'فشار فروش'],
  [/سطحمقاومت(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'سطح مقاومت'],
  [/سطححمایت(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'سطح حمایت'],
  [/منطقهاشباع(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'منطقه اشباع'],
  [/درصداحتمال(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'درصد احتمال'],
  [/نسبتریسک(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'نسبت ریسک'],
  [/نسبترسک(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'نسبت ریسک'],

  // Preposition + word
  [/درصورت(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'در صورت'],
  [/بطور(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'به طور'],
  [/بدلیل(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'به دلیل'],
  [/ازجمله(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'از جمله'],
  [/درنتیجه(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'در نتیجه'],
  [/درحال(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'در حال'],
  [/درمقابل(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'در مقابل'],
  [/بتدریج(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'به تدریج'],
  [/اعلامکرد(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'اعلام کرد'],
  [/انجامشده(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'انجام‌شده'],
  [/ارائهشده(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'ارائه‌شده'],
  [/مطرحشده(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'مطرح‌شده'],
  [/داشتهباش(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'داشته باشد'],
  [/خواهدبود(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'خواهد بود'],
  [/نخواهدبود(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'نخواهد بود'],
  [/میتواند(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'می‌تواند'],
  [/نمیتواند(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'نمی‌تواند'],
  [/بایدتوجه(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'باید توجه'],
  [/قابلتوجه(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'قابل‌توجه'],
  [/همزمان(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'هم‌زمان'],
  [/همچنین(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'همچنین'],  // This is correct as-is
  [/قریبالوقوع(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'قریب‌الوقوع'],  // ZWNJ correct
  [/آیندهنگر(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'آینده‌نگر'],  // ZWNJ correct
  [/یکپارچه(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'یکپارچه'],  // Correct as-is
  [/پرهیزکنید(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'پرهیز کنید'],
  [/تمرکزکنید(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'تمرکز کنید'],
  [/واردنشود(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'وارد نشود'],
  [/برخوردار(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'برخوردار'],  // Correct as-is
  [/مربوط(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'مربوط'],  // Correct as-is
  [/بازگشت(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'بازگشت'],  // Correct as-is
  [/استراتژی(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'استراتژی'],  // Correct as-is
  [/مقاومت(?=[\s\u0627-\u06cc.,؛:!?\)\]])/g, 'مقاومت'],  // Correct as-is
];

/**
 * Fix ZWNJ (Zero Width Non-Joiner) spacing according to Persian orthography standards
 *
 * Two categories of fixes:
 * 1. Compound words that REQUIRE ZWNJ — convert regular space to ZWNJ
 *    (e.g., "کوتاه مدت" → "کوتاه‌مدت", "نشان دهنده" → "نشان‌دهنده")
 * 2. Separate words that require regular SPACE — convert ZWNJ to space
 *    (e.g., "در‌صورت" → "در صورت", "نقطه‌ورود" → "نقطه ورود")
 *
 * ZWNJ is mandatory for Persian compound words per orthography standards.
 * The function also preserves ZWNJ in verb prefixes (می‌, نمی‌, بی‌, پیش‌).
 */
function fixZwnjSpacing(text: string): string {
  let result = text;

  // Preserve ZWNJ in these specific patterns (verb prefixes etc.):
  const zwnjPreserve = [
    /می\u200c/g,       // می‌ verb prefix
    /نمی\u200c/g,     // نمی‌ verb prefix
    /بی\u200c/g,      // بی‌ prefix
    /پیش\u200c/g,    // پیش‌ prefix (in compounds like پیش‌بینی)
    /گذشته\u200c/g,  // گذشته‌ (past participle connector)
  ];

  // Category 1: Compound words that need ZWNJ — convert space → ZWNJ
  // Category 2: Separate words that need space — convert ZWNJ → space
  // Time compounds — ZWNJ required (convert space → ZWNJ)
  result = result.replace(/کوتاه مدت/g, 'کوتاه\u200cمدت');
  result = result.replace(/بلند مدت/g, 'بلند\u200cمدت');
  result = result.replace(/میان مدت/g, 'میان\u200cمدت');
  result = result.replace(/طولانی مدت/g, 'طولانی\u200cمدت');

  // Demonstrative compounds — ZWNJ required (convert space → ZWNJ)
  result = result.replace(/نشان دهنده/g, 'نشان\u200cدهنده');
  result = result.replace(/نشان دهند/g, 'نشان\u200cدهند');
  result = result.replace(/گزارش دهنده/g, 'گزارش\u200cدهنده');

  // Financial/trading compounds
  result = result.replace(/حد\u200cضرر/g, 'حدّ ضرر');
  result = result.replace(/نقطه\u200cورود/g, 'نقطه ورود');
  result = result.replace(/نقطه\u200cخروج/g, 'نقطه خروج');
  result = result.replace(/فشار\u200cخرید/g, 'فشار خرید');
  result = result.replace(/فشار\u200cفروش/g, 'فشار فروش');
  result = result.replace(/سطح\u200cمقاومت/g, 'سطح مقاومت');
  result = result.replace(/سطح\u200cحمایت/g, 'سطح حمایت');
  result = result.replace(/منطقه\u200cاشباع/g, 'منطقه اشباع');
  result = result.replace(/نسبت\u200cریسک/g, 'نسبت ریسک');
  result = result.replace(/درصد\u200cاحتمال/g, 'درصد احتمال');
  result = result.replace(/خط\u200cروند/g, 'خط روند');
  result = result.replace(/روند\u200cصعودی/g, 'روند صعودی');
  result = result.replace(/روند\u200cنزولی/g, 'روند نزولی');

  // Preposition compounds
  result = result.replace(/در\u200cصورت/g, 'در صورت');
  result = result.replace(/در\u200cنتیجه/g, 'در نتیجه');
  result = result.replace(/در\u200cحال/g, 'در حال');
  result = result.replace(/در\u200cمقابل/g, 'در مقابل');
  result = result.replace(/به\u200cطور/g, 'به طور');
  result = result.replace(/به\u200cدلیل/g, 'به دلیل');
  result = result.replace(/به\u200cتدریج/g, 'به تدریج');
  result = result.replace(/از\u200cجمله/g, 'از جمله');

  // Participle compounds (past stems + shodeh/kardeh) — ZWNJ required (convert space → ZWNJ)
  result = result.replace(/انجام شده/g, 'انجام\u200cشده');
  result = result.replace(/ارائه شده/g, 'ارائه\u200cشده');
  result = result.replace(/مطرح شده/g, 'مطرح\u200cشده');
  result = result.replace(/انجام یافته/g, 'انجام\u200cیافته');
  result = result.replace(/اعلام شده/g, 'اعلام\u200cشده');

  // Common adjective compounds — ZWNJ required (convert space → ZWNJ)
  result = result.replace(/قابل توجه/g, 'قابل\u200cتوجه');
  result = result.replace(/هم زمان/g, 'هم\u200cزمان');

  return result;
}

/**
 * Fix Persian text quality issues in AI-generated output.
 *
 * Applies 5 categories of fixes:
 * 1. **ZWNJ spacing** — Correct ZWNJ usage per Persian orthography standards
 *    (فرهنگستان زبان و ادب فارسی): compound words get ZWNJ, separate words get space
 * 2. **Stuck words** — Split incorrectly concatenated words (e.g. کوتاهمدت → کوتاه‌مدت)
 * 3. **Mixed Persian-English** — Replace hybrid words (e.g. بولیnger → بولینگر)
 * 4. **AI typos** — Fix common LLM spelling mistakes and word forms
 * 5. **Paragraph normalization** — Ensure proper double-newline paragraph breaks,
 *    fix punctuation spacing, and normalize whitespace
 *
 * @param text - Raw AI-generated Persian text
 * @returns Cleaned Persian text with corrected spacing, orthography, and formatting
 */
export function fixPersianText(text: string): string {
  let result = text;

  // 1. Fix ZWNJ spacing (replace with space where appropriate)
  result = fixZwnjSpacing(result);

  // 2. Fix stuck-together words (no space, no ZWNJ)
  for (const [pattern, replacement] of STUCK_WORDS) {
    result = result.replace(pattern, replacement);
  }

  // 3. Fix mixed Persian-English words (prohibited in output)
  const mixedWords: [RegExp, string][] = [
    [/\u0628\u0648\u0644\u06cc\u0646\s*ger/g, '\u0628\u0648\u0644\u06cc\u0646\u06af\u0631'],
    [/\u0627\u0633\u062a\u0648\u06a9\u0627\u0633\u062a\s*ic/g, '\u0627\u0633\u062a\u0648\u06a9\u0627\u0633\u062a\u06cc\u06a9'],
    [/\u0641\u06cc\u0628\u0648\u0646\u0627\u0686\s*i/g, '\u0641\u06cc\u0628\u0648\u0646\u0627\u0686\u06cc'],
    [/\u0648\u0627\u06af\u0631\u0627\s*f\s*i/g, '\u0648\u0627\u06af\u0631\u0627\u0641\u06cc'],
    [/\u0647\u06cc\u0633\u062a\u0648\s*gram/g, '\u0647\u06cc\u0633\u062a\u0648\u06af\u0631\u0627\u0645'],
    [/\u0645\u0627\u06a9\s*d\s*e/g, '\u0645\u06a9\u062f\u06cc'],
    [/\u0628\u0648\u0644\u06cc\u0646\u06af\u0631\s*band/g, '\u0628\u0627\u0646\u062f \u0628\u0648\u0644\u06cc\u0646\u06af\u0631'],
  ];
  for (const [pattern, replacement] of mixedWords) {
    result = result.replace(pattern, replacement);
  }

  // 4. Fix common AI typos and incorrect word forms
  result = result.replace(/\u0627\u0635\u0644\u0627\u0642/g, '\u0627\u0635\u0644\u0627\u062d'); // اصلاق → اصلاح
  result = result.replace(/\u0636\u0631\u0631\u0631/g, '\u0636\u0631\u0631'); // ضررر → ضرر
  result = result.replace(/\u0627\u062d\u062a\u0645\u0627\u0644\u0627\u062a\u06cc/g, '\u0627\u062d\u062a\u0645\u0627\u0644\u0627\u062a'); // احتمالاتی → احتمالات
  result = result.replace(/\u0628\u0627\u0632\u06af\u0631\u062f\u06cc/g, '\u0628\u0627\u0632\u06af\u0631\u062f\u06cc'); // بازگردی → بازگشتی (typo fix)
  result = result.replace(/\u0645\u062d\u062a\u0645\u0644\u0627\u0646/g, '\u0645\u062d\u062a\u0645\u0644\u0627\u0646'); // محتملان → محتملان (keep correct)
  // Fix «در صد» (two words) → «درصد» (one word)
  result = result.replace(/\u062f\u0631\s+\u0635\u062f/g, '\u062f\u0631\u0635\u062f');

  // 5. Normalize paragraph separation: ensure double newline between paragraphs
  // A paragraph break should be detected after sentences (ending with . ! ؟)
  // that are followed by a single newline and then a new sentence
  result = result.replace(/([.!?؟])\n(?!\n)/g, '$1\n\n');

  // 6. Remove more than 2 consecutive newlines (normalize to exactly 2)
  result = result.replace(/\n{3,}/g, '\n\n');

  // 7. Fix spacing: no space before punctuation
  result = result.replace(/\s+\./g, '.');
  result = result.replace(/\s+,/g, ',');
  result = result.replace(/\s+;/g, ';');
  result = result.replace(/\s+:/g, ':');
  result = result.replace(/\s+!/g, '!');
  result = result.replace(/\s+[؟]/g, '؟');

  // 8. Ensure space after punctuation (Persian: نقطه، ویرگول و...)
  result = result.replace(/([.,؛:!؟])([^\s\n\d{\/\-\*])/g, '$1 $2');
  result = result.replace(/([.,؛:!؟])(\{)/g, '$1 $2');  // Before color tags

  // 9. Fix double/multiple spaces (but preserve newlines)
  result = result.replace(/[ \t]+/g, ' ');

  // 10. Fix spacing around parentheses and brackets
  result = result.replace(/\(\s+/g, '(');
  result = result.replace(/\s+\)/g, ')');

  // 11. Fix common grammatical issues
  // «در صد» → «درصد» is handled above in section 4
  // «به صورت» is correct, «بصورت» is informal but sometimes used
  // «هر گونه» → «هرگونه» 
  // Actually هرگونه is correct as one word

  return result.trim();
}

// ─── Number Direction Fix ───────────────────────────────────────

/**
 * Fix number direction in Persian text.
 * All number sequences (Persian or Latin digits, with optional decimal points,
 * thousand separators, and +/- signs) should be LTR to prevent bidi reversal.
 * Wraps each number sequence with LRM marks.
 */
function fixNumberDirection(text: string): string {
  // LRM = U+200E (Left-to-Right Mark)
  const LRM = '\u200E';

  // Match sequences of digits (Persian ۰-۹ or Latin 0-9) with optional:
  // - leading sign (+/-)
  // - decimal point (٫ or .)
  // - thousand separators (٬ or ,)
  // - percent sign (٪ or %)
  // - degree sign (°)
  // This regex matches number sequences that might be displayed wrong in RTL
  const numPattern = /([+\-]?[۰-۹0-9][۰-۹0-9٬,.٫]*(?:[.٫][۰-۹0-9]+)?[٪%°]?)/g;

  return text.replace(numPattern, (match) => {
    // Only add LRM if not already present
    if (match.startsWith(LRM)) return match;
    return LRM + match + LRM;
  });
}

// ─── Technical Code Cleanup ───────────────────────────────────────

/**
 * Strip leaked technical codes and CJK characters from AI-generated text.
 *
 * Performs the following cleanups:
 * - Removes Chinese/CJK characters (often leaked by multilingual models)
 * - Strips internal code references: SC###, R###, MA###, DI+/DI-
 * - Removes R² = N statistical artifacts
 * - Fixes double spaces and trims whitespace
 *
 * @param text - AI-generated text that may contain leaked technical codes
 * @returns Cleaned text with technical codes removed or replaced
 */
export function stripTechnicalCodes(text: string): string {
  let result = text;

  // Strip Chinese characters (CJK)
  result = result.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, '');

  // Strip technical codes
  result = result
    .replace(/\bSC\d+\b/g, '')
    .replace(/\bR\d+\b(?=[\s,.;:!?\)\-\u0627-\u06cc]|$)/g, '')
    .replace(/\bMA\d+\b/g, '')
    .replace(/\bRSI\b/g, '\u0634\u0627\u062e\u0635 \u0642\u062f\u0631\u062a \u0646\u0633\u0628\u06cc')
    .replace(/\bMACD\b/g, '\u0648\u0627\u06af\u0631\u0627\u0641 \u0647\u06cc\u0633\u062a\u0648\u06af\u0631\u0627\u0645')
    .replace(/\bMFI\b/g, '\u0634\u0627\u062e\u0635 \u062c\u0631\u06cc\u0627\u0646 \u0646\u0642\u062f\u06cc')
    .replace(/\bCCI\b/g, '\u0634\u0627\u062e\u0635 \u06a9\u0627\u0646\u0627\u0644 \u06a9\u0627\u0644\u0627')
    .replace(/\bADX\b/g, '\u0634\u0627\u062e\u0635 \u0634\u062f\u062a \u0631\u0648\u0646\u062f')
    .replace(/\bATR\b/g, '\u062f\u0627\u0645\u0646\u0647 \u062a\u0644\u0648\u0627\u062a\u06cc')
    .replace(/\bSAR\b/g, '\u062d\u0645\u0627\u06cc\u062a \u067e\u0648\u06cc\u0627')
    .replace(/\bOBV\b/g, '\u062c\u0631\u06cc\u0627\u0646 \u062a\u062c\u0645\u0639\u06cc \u062d\u062c\u0645')
    .replace(/\bDI[+\-]/g, '')
    .replace(/\bR\s*\u00b2\s*=\s*[\d.]+/g, '');

  // Fix common typos
  result = result.replace(/\u0636\u0631\u0631\u0631/g, '\u0636\u0631\u0631');

  // Fix double spaces
  result = result.replace(/\s{2,}/g, ' ');

  return result.trim();
}

// ─── Full Pipeline ───────────────────────────────────────────────

/**
 * Result of the post-processing pipeline.
 */
export interface PostProcessResult {
  /** The cleaned, post-processed text */
  text: string;
  /** True if no more than 2 hallucinated prices were detected */
  priceValid: boolean;
  /** Count of hallucinated prices found in the text */
  hallucinationCount: number;
}

/**
 * Full post-processing pipeline for AI-generated analysis text.
 *
 * Applies 3 stages in order:
 * 1. **Technical Code Cleanup** (`stripTechnicalCodes`) — Remove leaked codes, CJK chars,
 *    replace English acronyms with Persian equivalents
 * 2. **Persian Text Quality** (`fixPersianText`) — Fix ZWNJ/spacing, stuck words,
 *    mixed scripts, AI typos, paragraph formatting
 * 3. **Number Direction** (`fixNumberDirection`) — Wrap numbers with LRM marks
 *    for correct RTL rendering
 * 4. **Price Validation** (`validatePricesInText`) — Detect hallucinated prices
 *    that don't match any known reference
 *
 * @param rawText - Raw AI-generated text to post-process
 * @param priceRefs - Array of known price references for hallucination detection
 * @returns PostProcessResult with cleaned text, validation status, and hallucination count
 */
export function postProcessAIOutput(
  rawText: string,
  priceRefs: PriceReference[],
): PostProcessResult {
  let text = stripTechnicalCodes(rawText);
  text = fixPersianText(text);
  text = fixNumberDirection(text);  // Fix LTR number direction
  const { valid, hallucinationCount } = validatePricesInText(text, priceRefs);
  return { text, priceValid: valid, hallucinationCount };
}
