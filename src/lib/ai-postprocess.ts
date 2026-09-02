/**
 * Post-processing pipeline for AI analysis text.
 *
 * 1. Price Validation — detect and flag/correct hallucinated prices
 * 2. Persian Text Quality — fix common spelling, grammar, mixed-language issues
 * 3. Technical Code Cleanup — strip leaked technical codes
 */

// ─── Price Validation ───────────────────────────────────────────

interface PriceReference {
  label: string;
  value: number;
}

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

function faToEn(str: string): string {
  return str
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));
}

function extractPersianNumbers(text: string): number[] {
  const numbers: number[] = [];
  const pattern = /[\-]?([\u06f0-\u06f9\u0660-\u06690-9]+([\u066c,][\u06f0-\u06f9\u0660-\u06690-9]+)*)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const cleaned = faToEn(match[0].replace(/[,\u066c\s]/g, ''));
    const num = Number(cleaned);
    if (isFinite(num) && num > 0) numbers.push(num);
  }
  return numbers;
}

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

export function fixPersianText(text: string): string {
  let result = text;

  // Fix mixed Persian-English words
  const mixedWords: [RegExp, string][] = [
    [/\u0628\u0648\u0644\u06cc\u0646\s*ger/g, '\u0628\u0648\u0644\u06cc\u0646\u06af\u0631'],
    [/\u0627\u0633\u062a\u0648\u06a9\u0627\u0633\u062a\s*ic/g, '\u0627\u0633\u062a\u0648\u06a9\u0627\u0633\u062a\u06cc\u06a9'],
    [/\u0641\u06cc\u0628\u0648\u0646\u0627\u0686\s*i/g, '\u0641\u06cc\u0628\u0648\u0646\u0627\u0686\u06cc'],
    [/\u0648\u0627\u06af\u0631\u0627\s*f\s*i/g, '\u0648\u0627\u06af\u0631\u0627\u0641\u06cc'],
    [/\u0647\u06cc\u0633\u062a\u0648\s*gram/g, '\u0647\u06cc\u0633\u062a\u0648\u06af\u0631\u0627\u0645'],
    [/\u0645\u0627\u06a9\s*d\s*e/g, '\u0645\u06a9\u062f\u06cc'],
  ];
  for (const [pattern, replacement] of mixedWords) {
    result = result.replace(pattern, replacement);
  }

  // Fix common spacing issues
  result = result.replace(/  +/g, ' ');
  result = result.replace(/\s+\./g, '.');
  result = result.replace(/\s+,/g, ',');

  return result.trim();
}

// ─── Technical Code Cleanup ───────────────────────────────────────

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

export interface PostProcessResult {
  text: string;
  priceValid: boolean;
  hallucinationCount: number;
}

export function postProcessAIOutput(
  rawText: string,
  priceRefs: PriceReference[],
): PostProcessResult {
  let text = stripTechnicalCodes(rawText);
  text = fixPersianText(text);
  const { valid, hallucinationCount } = validatePricesInText(text, priceRefs);
  return { text, priceValid: valid, hallucinationCount };
}
