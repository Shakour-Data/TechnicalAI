// ═══════════════════════════════════════════════════════════════════════════════
// Candlestick Pattern Recognition Engine v9
// 10 Main Patterns: Doji, Hammer, Inverted Hammer, Bullish Engulfing,
// Bearish Engulfing, Morning Star, Evening Star, Shooting Star,
// Bullish Harami, Bearish Harami
// ═══════════════════════════════════════════════════════════════════════════════

import type { OHLCV } from './ta-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PatternDirection = 'bullish' | 'bearish' | 'neutral';
export type PatternReliability = 'strong' | 'moderate' | 'weak';

export interface CandlestickPattern {
  name: string;
  nameEn: string;
  direction: PatternDirection;
  reliability: PatternReliability;
  reliabilityScore: number; // 0-1
  description: string;
  descriptionEn: string;
  index: number; // position in data array
}

export interface PatternScanResult {
  patterns: CandlestickPattern[];
  dominantDirection: PatternDirection;
  dominantScore: number;
  summary: string; // Persian summary for narrative
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function bodySize(c: OHLCV): number {
  return Math.abs(c.close - c.open);
}

function upperShadow(c: OHLCV): number {
  return c.high - Math.max(c.open, c.close);
}

function lowerShadow(c: OHLCV): number {
  return Math.min(c.open, c.close) - c.low;
}

function isBullish(c: OHLCV): boolean {
  return c.close > c.open;
}

function isBearish(c: OHLCV): boolean {
  return c.close < c.open;
}

function fullRange(c: OHLCV): number {
  return c.high - c.low;
}

/** Average body size of last N candles for context */
function avgBodySize(data: OHLCV[], endIdx: number, n: number): number {
  const start = Math.max(0, endIdx - n + 1);
  let sum = 0;
  let count = 0;
  for (let i = start; i <= endIdx; i++) {
    sum += bodySize(data[i]);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/** Average full range of last N candles */
function avgRange(data: OHLCV[], endIdx: number, n: number): number {
  const start = Math.max(0, endIdx - n + 1);
  let sum = 0;
  let count = 0;
  for (let i = start; i <= endIdx; i++) {
    sum += fullRange(data[i]);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

// ─── Pattern Detection Functions ─────────────────────────────────────────────

/** 1. Doji — Open ≈ Close, significant shadows */
function detectDoji(data: OHLCV[], i: number): CandlestickPattern | null {
  const c = data[i];
  const range = fullRange(c);
  if (range === 0) return null;
  const body = bodySize(c);
  const bodyRatio = body / range;
  // Body must be very small relative to range (< 10%)
  if (bodyRatio > 0.1) return null;
  // At least one shadow must be significant
  const maxShadow = Math.max(upperShadow(c), lowerShadow(c));
  if (maxShadow / range < 0.6) return null;

  const avgR = avgRange(data, i, 10);
  const isLongLegged = range > avgR * 1.5;

  return {
    name: isLongLegged ? 'دوجی پا بلند' : 'دوجی',
    nameEn: isLongLegged ? 'Long-Legged Doji' : 'Doji',
    direction: 'neutral',
    reliability: 'moderate',
    reliabilityScore: 0.6,
    description: isLongLegged
      ? 'دوجی پا بلند — بلاتکلیفی شدید بازار، احتمال تغییر روند'
      : 'دوجی — تعادل بین خریداران و فروشندگان، سیگنال بازگشتی احتمالی',
    descriptionEn: isLongLegged
      ? 'Long-legged doji — extreme indecision, potential trend change'
      : 'Doji — equilibrium between buyers and sellers, potential reversal',
    index: i,
  };
}

/** 2. Hammer — Small body at top, long lower shadow (bullish reversal at bottom) */
function detectHammer(data: OHLCV[], i: number): CandlestickPattern | null {
  const c = data[i];
  const body = bodySize(c);
  const lShadow = lowerShadow(c);
  const uShadow = upperShadow(c);
  const range = fullRange(c);
  if (range === 0) return null;

  // Lower shadow must be at least 2x the body
  if (lShadow < body * 2) return null;
  // Upper shadow must be small (< 10% of range)
  if (uShadow / range > 0.1) return null;
  // Body at the upper portion
  if (Math.min(c.open, c.close) - c.low < range * 0.6) return null;

  // Context: should appear after downtrend
  const isDowntrend = i >= 5 && data[i].close < data[i - 5].close;
  const reliability: PatternReliability = isDowntrend ? 'strong' : 'weak';
  const score = isDowntrend ? 0.82 : 0.45;

  return {
    name: 'چکش',
    nameEn: 'Hammer',
    direction: 'bullish',
    reliability,
    reliabilityScore: score,
    description: isDowntrend
      ? 'الگوی چکش در انتهای روند نزولی — سیگنال بازگشت صعودی قوی'
      : 'الگوی چکش — بدون تأیید روند نزولی قبلی، سیگنال ضعیف',
    descriptionEn: isDowntrend
      ? 'Hammer at bottom of downtrend — strong bullish reversal signal'
      : 'Hammer — no prior downtrend confirmation, weak signal',
    index: i,
  };
}

/** 3. Inverted Hammer / Shooting Star context-dependent */
function detectInvertedHammer(data: OHLCV[], i: number): CandlestickPattern | null {
  const c = data[i];
  const body = bodySize(c);
  const lShadow = lowerShadow(c);
  const uShadow = upperShadow(c);
  const range = fullRange(c);
  if (range === 0) return null;

  // Upper shadow at least 2x body
  if (uShadow < body * 2) return null;
  // Lower shadow small
  if (lShadow / range > 0.1) return null;

  const isDowntrend = i >= 5 && data[i].close < data[i - 5].close;

  // In downtrend = Inverted Hammer (bullish), in uptrend = Shooting Star (bearish)
  if (isDowntrend) {
    return {
      name: 'چکش وارونه',
      nameEn: 'Inverted Hammer',
      direction: 'bullish',
      reliability: 'moderate',
      reliabilityScore: 0.62,
      description: 'چکش وارونه در روند نزولی — فشار خرید در قیمت‌های بالا، سیگنال بازگشتی',
      descriptionEn: 'Inverted hammer in downtrend — buying pressure at highs, reversal signal',
      index: i,
    };
  }
  // Not returning Shooting Star here — that's a separate pattern
  return null;
}

/** 4. Bullish Engulfing */
function detectBullishEngulfing(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 1) return null;
  const prev = data[i - 1];
  const curr = data[i];

  // Previous candle must be bearish
  if (!isBearish(prev)) return null;
  // Current candle must be bullish
  if (!isBullish(curr)) return null;
  // Current body must completely engulf previous body
  if (curr.open <= prev.close || curr.close >= prev.open) return null;
  // Current body should be significantly larger
  if (bodySize(curr) < bodySize(prev) * 1.2) return null;

  const isDowntrend = i >= 5 && data[i].close < data[i - 5].close;
  const reliability: PatternReliability = isDowntrend ? 'strong' : 'moderate';
  const score = isDowntrend ? 0.85 : 0.6;

  return {
    name: 'پوشای صعودی',
    nameEn: 'Bullish Engulfing',
    direction: 'bullish',
    reliability,
    reliabilityScore: score,
    description: isDowntrend
      ? 'پوشای صعودی در روند نزولی — سیگنال بازگشت بسیار قوی، خریداران کنترل را گرفته‌اند'
      : 'پوشای صعودی — بلع کندل قبلی، احتمال ادامه صعود',
    descriptionEn: isDowntrend
      ? 'Bullish engulfing in downtrend — very strong reversal, buyers in control'
      : 'Bullish engulfing — previous candle engulfed, likely continuation',
    index: i,
  };
}

/** 5. Bearish Engulfing */
function detectBearishEngulfing(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 1) return null;
  const prev = data[i - 1];
  const curr = data[i];

  if (!isBullish(prev)) return null;
  if (!isBearish(curr)) return null;
  if (curr.open >= prev.close || curr.close <= prev.open) return null;
  if (bodySize(curr) < bodySize(prev) * 1.2) return null;

  const isUptrend = i >= 5 && data[i].close > data[i - 5].close;
  const reliability: PatternReliability = isUptrend ? 'strong' : 'moderate';
  const score = isUptrend ? 0.85 : 0.6;

  return {
    name: 'پوشای نزولی',
    nameEn: 'Bearish Engulfing',
    direction: 'bearish',
    reliability,
    reliabilityScore: score,
    description: isUptrend
      ? 'پوشای نزولی در روند صعودی — سیگنال بازگشت نزولی قوی، فروشندگان وارد شده‌اند'
      : 'پوشای نزولی — بلع کندل قبلی، احتمال ادامه نزول',
    descriptionEn: isUptrend
      ? 'Bearish engulfing in uptrend — strong bearish reversal signal'
      : 'Bearish engulfing — previous candle engulfed, likely decline continuation',
    index: i,
  };
}

/** 6. Morning Star — 3-candle bullish reversal */
function detectMorningStar(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 2) return null;
  const c1 = data[i - 2]; // first candle (bearish, large)
  const c2 = data[i - 1]; // star (small body)
  const c3 = data[i];     // third candle (bullish, large)

  if (!isBearish(c1)) return null;
  if (!isBullish(c3)) return null;

  const c1Body = bodySize(c1);
  const c2Body = bodySize(c2);
  const c3Body = bodySize(c3);
  const avgB = avgBodySize(data, i, 10);

  // First candle: large bearish body
  if (c1Body < avgB * 0.8) return null;
  // Star: very small body, can be doji-like
  if (c2Body > avgB * 0.3) return null;
  // Third candle: large bullish body
  if (c3Body < avgB * 0.8) return null;
  // Third candle closes above midpoint of first candle
  const c1Mid = (c1.open + c1.close) / 2;
  if (c3.close < c1Mid) return null;

  return {
    name: 'ستاره صبحگاهی',
    nameEn: 'Morning Star',
    direction: 'bullish',
    reliability: 'strong',
    reliabilityScore: 0.88,
    description: 'ستاره صبحگاهی — الگوی سه کندلی بازگشتی صعودی قوی، تأیید تغییر روند',
    descriptionEn: 'Morning Star — 3-candle strong bullish reversal pattern, trend change confirmed',
    index: i,
  };
}

/** 7. Evening Star — 3-candle bearish reversal */
function detectEveningStar(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 2) return null;
  const c1 = data[i - 2];
  const c2 = data[i - 1];
  const c3 = data[i];

  if (!isBullish(c1)) return null;
  if (!isBearish(c3)) return null;

  const c1Body = bodySize(c1);
  const c2Body = bodySize(c2);
  const c3Body = bodySize(c3);
  const avgB = avgBodySize(data, i, 10);

  if (c1Body < avgB * 0.8) return null;
  if (c2Body > avgB * 0.3) return null;
  if (c3Body < avgB * 0.8) return null;

  const c1Mid = (c1.open + c1.close) / 2;
  if (c3.close > c1Mid) return null;

  return {
    name: 'ستاره شامگاهی',
    nameEn: 'Evening Star',
    direction: 'bearish',
    reliability: 'strong',
    reliabilityScore: 0.88,
    description: 'ستاره شامگاهی — الگوی سه کندلی بازگشتی نزولی قوی، هشدار تغییر روند',
    descriptionEn: 'Evening Star — 3-candle strong bearish reversal pattern, trend change warning',
    index: i,
  };
}

/** 8. Shooting Star — at top of uptrend */
function detectShootingStar(data: OHLCV[], i: number): CandlestickPattern | null {
  const c = data[i];
  const body = bodySize(c);
  const uShadow = upperShadow(c);
  const lShadow = lowerShadow(c);
  const range = fullRange(c);
  if (range === 0) return null;

  // Upper shadow at least 2x body
  if (uShadow < body * 2) return null;
  // Lower shadow small
  if (lShadow / range > 0.15) return null;

  const isUptrend = i >= 5 && data[i].close > data[i - 5].close;
  if (!isUptrend) return null; // Only valid in uptrend

  return {
    name: 'ستاره دنباله‌دار',
    nameEn: 'Shooting Star',
    direction: 'bearish',
    reliability: 'strong',
    reliabilityScore: 0.82,
    description: 'ستاره دنباله‌دار در انتهای روند صعودی — فشار فروش قوی در سقف، سیگنال بازگشت',
    descriptionEn: 'Shooting Star at top of uptrend — strong selling pressure at high, reversal signal',
    index: i,
  };
}

/** 9. Bullish Harami */
function detectBullishHarami(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 1) return null;
  const prev = data[i - 1];
  const curr = data[i];

  if (!isBearish(prev)) return null;
  if (!isBullish(curr)) return null;

  // Current body must be inside previous body
  if (curr.open >= prev.close || curr.close <= prev.open) return null;
  // Current body must be significantly smaller
  if (bodySize(curr) > bodySize(prev) * 0.6) return null;

  const isDowntrend = i >= 5 && data[i].close < data[i - 5].close;
  const reliability: PatternReliability = isDowntrend ? 'moderate' : 'weak';
  const score = isDowntrend ? 0.65 : 0.4;

  return {
    name: 'هارامی صعودی',
    nameEn: 'Bullish Harami',
    direction: 'bullish',
    reliability,
    reliabilityScore: score,
    description: isDowntrend
      ? 'هارامی صعودی در روند نزولی — کاهش فشار فروش، احتمال تثبیت یا بازگشت'
      : 'هارامی صعودی — کندل کوچک درون کندل بزرگ قبلی',
    descriptionEn: isDowntrend
      ? 'Bullish harami in downtrend — selling pressure decreasing, consolidation/reversal likely'
      : 'Bullish harami — small body inside previous large body',
    index: i,
  };
}

/** 10. Bearish Harami */
function detectBearishHarami(data: OHLCV[], i: number): CandlestickPattern | null {
  if (i < 1) return null;
  const prev = data[i - 1];
  const curr = data[i];

  if (!isBullish(prev)) return null;
  if (!isBearish(curr)) return null;

  if (curr.open <= prev.close || curr.close >= prev.open) return null;
  if (bodySize(curr) > bodySize(prev) * 0.6) return null;

  const isUptrend = i >= 5 && data[i].close > data[i - 5].close;
  const reliability: PatternReliability = isUptrend ? 'moderate' : 'weak';
  const score = isUptrend ? 0.65 : 0.4;

  return {
    name: 'هارامی نزولی',
    nameEn: 'Bearish Harami',
    direction: 'bearish',
    reliability,
    reliabilityScore: score,
    description: isUptrend
      ? 'هارامی نزولی در روند صعودی — کاهش مومنتوم خرید، احتمال اصلاح'
      : 'هارامی نزولی — کندل کوچک نزولی درون کندل صعودی قبلی',
    descriptionEn: isUptrend
      ? 'Bearish harami in uptrend — buying momentum decreasing, correction likely'
      : 'Bearish harami — small bearish body inside previous bullish body',
    index: i,
  };
}

// ─── All Detectors ───────────────────────────────────────────────────────────

const ALL_DETECTORS = [
  detectDoji,
  detectHammer,
  detectInvertedHammer,
  detectBullishEngulfing,
  detectBearishEngulfing,
  detectMorningStar,
  detectEveningStar,
  detectShootingStar,
  detectBullishHarami,
  detectBearishHarami,
];

// ─── Main Scan Function ──────────────────────────────────────────────────────

/**
 * Scan the last N candles for candlestick patterns.
 * @param data - OHLCV data (chronological, oldest first)
 * @param lookback - Number of recent candles to scan (default: 20)
 * @returns PatternScanResult with all detected patterns and summary
 */
export function scanCandlestickPatterns(
  data: OHLCV[],
  lookback: number = 20
): PatternScanResult {
  if (data.length < 3) {
    return { patterns: [], dominantDirection: 'neutral', dominantScore: 0, summary: '' };
  }

  const startIdx = Math.max(0, data.length - lookback);
  const patterns: CandlestickPattern[] = [];

  for (let i = startIdx; i < data.length; i++) {
    for (const detector of ALL_DETECTORS) {
      const pattern = detector(data, i);
      if (pattern) patterns.push(pattern);
    }
  }

  // Sort by reliability score (highest first)
  patterns.sort((a, b) => b.reliabilityScore - a.reliabilityScore);

  // Keep only top 5 most reliable
  const topPatterns = patterns.slice(0, 5);

  // Calculate dominant direction
  let bullScore = 0;
  let bearScore = 0;
  for (const p of topPatterns) {
    if (p.direction === 'bullish') bullScore += p.reliabilityScore;
    else if (p.direction === 'bearish') bearScore += p.reliabilityScore;
  }

  const total = bullScore + bearScore;
  let dominantDirection: PatternDirection = 'neutral';
  let dominantScore = 0;

  if (total > 0) {
    if (bullScore > bearScore * 1.3) {
      dominantDirection = 'bullish';
      dominantScore = bullScore / total;
    } else if (bearScore > bullScore * 1.3) {
      dominantDirection = 'bearish';
      dominantScore = bearScore / total;
    } else {
      dominantDirection = 'neutral';
      dominantScore = Math.min(bullScore, bearScore) / total;
    }
  }

  // Generate Persian summary
  const summary = generatePatternSummary(topPatterns, dominantDirection, dominantScore);

  return { patterns: topPatterns, dominantDirection, dominantScore, summary };
}

/**
 * Quick check for the most recent candle pattern only.
 */
export function detectLatestPattern(data: OHLCV[]): CandlestickPattern | null {
  if (data.length < 3) return null;
  const i = data.length - 1;

  let best: CandlestickPattern | null = null;
  for (const detector of ALL_DETECTORS) {
    const pattern = detector(data, i);
    if (pattern && (!best || pattern.reliabilityScore > best.reliabilityScore)) {
      best = pattern;
    }
  }
  return best;
}

// ─── Summary Generator ───────────────────────────────────────────────────────

function generatePatternSummary(
  patterns: CandlestickPattern[],
  dominant: PatternDirection,
  score: number
): string {
  if (patterns.length === 0) {
    return 'الگوی کندل‌استیک قابل اعتمادی در کندل‌های اخیر شناسایی نشد.';
  }

  const names = patterns.map(p => p.name).join('، ');
  const strongPatterns = patterns.filter(p => p.reliability === 'strong');

  let trendNote = '';
  if (dominant === 'bullish') {
    trendNote = score > 0.7
      ? `سیگنال صعودی قوی با اطمینان ${Math.round(score * 100)}٪`
      : `سیگنال صعودی با اطمینان ${Math.round(score * 100)}٪`;
  } else if (dominant === 'bearish') {
    trendNote = score > 0.7
      ? `سیگنال نزولی قوی با اطمینان ${Math.round(score * 100)}٪`
      : `سیگنال نزولی با اطمینان ${Math.round(score * 100)}٪`;
  } else {
    trendNote = 'سیگنال‌های متضاد، بلاتکلیفی بازار';
  }

  const strongNote = strongPatterns.length > 0
    ? ` | الگوهای قوی: ${strongPatterns.map(p => p.name).join('، ')}`
    : '';

  return `الگوهای شناسایی‌شده: ${names}. ${trendNote}.${strongNote}`;
}

// ─── AI-Powered Harmonic & Elliott Detection (uses LLM) ─────────────────────

export interface AIPatternRequest {
  ohlcv: OHLCV[];
  currentPrice: number;
  symbolName: string;
}

export interface AIPatternResult {
  harmonicPatterns: {
    name: string;
    type: string;
    reliability: string;
    description: string;
  }[];
  elliottWave: {
    currentWave: string;
    position: string;
    nextMove: string;
    confidence: number;
    description: string;
  } | null;
}

/**
 * Build a prompt for LLM-based harmonic/Elliott pattern detection.
 * This prompt should be sent to ZAI LLM for analysis.
 */
export function buildAIPatternPrompt(req: AIPatternRequest): string {
  const last50 = req.ohlcv.slice(-50);
  const priceData = last50.map((c, i) =>
    `${i + 1}: O=${c.open} H=${c.high} L=${c.low} C=${c.close} V=${c.volume}`
  ).join('\n');

  // Calculate key levels
  const highs = last50.map(c => c.high);
  const lows = last50.map(c => c.low);
  const recentHigh = Math.max(...highs.slice(-20));
  const recentLow = Math.min(...lows.slice(-20));
  const swingPoints = identifySwingPoints(last50);

  return `شما یک تحلیلگر حرفه‌ای الگوهای هارمونیک و موج الیوت هستید.

نماد: ${req.symbolName}
قیمت فعلی: ${req.currentPrice}
بازه اخیر: ${last50[0]?.open ?? 0} — ${req.currentPrice}
بالاترین ۲۰ کندل اخیر: ${recentHigh}
پایین‌ترین ۲۰ کندل اخیر: ${recentLow}

داده‌های ۵۰ کندل اخیر:
${priceData}

نقاط چرخش شناسایی‌شده:
${swingPoints.map((p, i) => `${i + 1}. ${p.type} در قیمت ${p.price} (کندل ${p.index})`).join('\n') || 'نقطه چرخش مشخصی یافت نشد'}

مأموریت شما:
1. الگوهای هارمونیک (gartley, butterfly, bat, crab, shark) را بررسی کنید
2. موج‌گذاری الیوت را تحلیل کنید (آیا در موج ۳، ۵ یا C هستیم؟)
3. فقط الگوهایی را گزارش دهید که حداقل ۶۰٪ تطابق داشته باشند

پاسخ را فقط در فرمت JSON زیر بدهید، بدون هیچ متن اضافی:
{
  "harmonicPatterns": [
    {"name": "نام فارسی", "type": "gartley|butterfly|bat|crab|shark", "reliability": "high|medium|low", "description": "توضیح مختصر فارسی"}
  ],
  "elliottWave": {
    "currentWave": "موج فعلی (مثلاً موج ۳ صعودی)",
    "position": "موقعیت در چرخه (ابتدایی/میانی/پایانی)",
    "nextMove": "حرکت بعدی مورد انتظار",
    "confidence": 0.0-1.0,
    "description": "توضیح مختصر فارسی"
  } | null
}`;
}

/** Identify swing highs and lows from OHLC data */
function identifySwingPoints(data: OHLCV[], window = 5): { type: 'swing_high' | 'swing_low'; price: number; index: number }[] {
  const points: { type: 'swing_high' | 'swing_low'; price: number; index: number }[] = [];

  for (let i = window; i < data.length - window; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (data[j].high >= data[i].high) isHigh = false;
      if (data[j].low <= data[i].low) isLow = false;
    }

    if (isHigh) points.push({ type: 'swing_high', price: data[i].high, index: i });
    if (isLow) points.push({ type: 'swing_low', price: data[i].low, index: i });
  }

  return points;
}
