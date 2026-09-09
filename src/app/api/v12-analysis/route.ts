// ‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍
// V12 = V11 base + future enhancements (this is the new active version)
// VDES Analysis API v12 — Data-Driven ML-Enhanced Version
//   1. XGBoost/Ensemble ML 30-session price prediction (via Python service)
//   2. 10 main candlestick pattern recognition
//   3. AI-powered harmonic & Elliott wave pattern detection (via ZAI LLM)
//   4. Dynamic Bayesian weighting system
//   5. Auto-training trigger when sufficient data available
//   6. Data-driven text: explicit probabilities, levels, trend data
// ‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import {
  selectNarrativeCombination, buildNarrativeInput,
  selectV12Persona, buildV12NarrativePrompt,
} from '@/lib/ml-narrative-v12';
import { buildV11Scenarios as buildV12Scenarios } from '@/lib/ta-engine-v12';
import { scanCandlestickPatterns, buildAIPatternPrompt, type PatternScanResult } from '@/lib/candlestick-patterns';
import { generateBayesianSummary } from '@/lib/bayesian-weights';
import { predict30Sessions, trainModel, checkMLHealth, convertToMLOHLCV } from '@/lib/ml-predictor';

export const dynamic = 'force-dynamic';

// ─── Version & Cache ───────────────────────────────────────────────
const ANALYSIS_VERSION = 13;
const cache = new Map<string, { v: number; text: string; ts: number; debug: any }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(body: VdesRequest): string {
  return `${ANALYSIS_VERSION}:${body.symbolName}:${body.currentPrice}:${body.trendDirection}:${body.rsi}:${body.adx}`;
}

// ─── Shared ZAI instance (lazy init) ───────────────────────────────
let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getZAI() {
  if (!_zai) _zai = await ZAI.create();
  return _zai;
}

// ─── 429 Retry (fast: 2s, 5s, 10s) ─────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, label: string = 'V12', maxAttempts = 3): Promise<T> {
  const delays = [2000, 5000, 10000];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      if (status === 429 && attempt < maxAttempts - 1) {
        const wait = delays[attempt];
        console.warn(`[VDES v12 429] ${label} Retry ${attempt + 1}/${maxAttempts} after ${wait / 1000}s`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${label}: max retries exceeded`);
}

// ─── Timeout helper (cleans up timer when main promise resolves first) ───────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => { if (timer) clearTimeout(timer); }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout (${ms / 1000}s)`)), ms);
    }),
  ]);
}

// ─── Helpers ─────────────────────────────────────────────────
function fmt(n: number, d = 0): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  return n.toFixed(d);
}

function fmtGrouped(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('fa-IR');
}

// ─── Types ─────────────────────────────────────────────────
interface Scenario {
  name: string;
  nameEn: string;
  probability: number;
  cumulativeProbability?: number;
  targetMin: number;
  targetMax: number;
  description: string;
  direction?: string;
}

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
  ohlcvHistory?: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  v12DominantKey?: string;
  v12HighestCumulativeKey?: string;
  // Backward compat: accept v11 keys as fallback
  v11DominantKey?: string;
  v11HighestCumulativeKey?: string;
  // Legacy backward compat
  v10DominantKey?: string;
  v10HighestCumulativeKey?: string;
}

// ─── Build data section (V12 — data-driven with scenario table) ─────
function buildDataSection(body: VdesRequest, v12Extra: V12ExtraData, dominantKey: string, highestCumKey: string): string {
  const {
    symbolName, currentPrice, ma21, ma100, rsi, adx,
    stochK, stochD, macdHist, macdLine, macdSignal,
    atr,
    trendDirection, trendAngle, trendR2, overallSignal,
    scenarios, resistances, supports,
    resistanceStrengths, supportStrengths,
    isIndex, isTgju, currencyUnit,
  } = body;

  const unit = currencyUnit || 'ریال';
  const label = isIndex ? `شاخص ${symbolName}` : isTgju ? symbolName : `سهم ${symbolName}`;
  const trendLabel = trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی';
  const r2Pct = (trendR2 * 100).toFixed(1);
  const rsiSignal = rsi > 70 ? 'اشباع خرید' : rsi > 60 ? 'اشباع خرید خفیف' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش خفیف' : 'اشباع فروش';
  const macdDesc = macdHist > 0 && macdLine > macdSignal ? 'صعودی' : macdHist > 0 ? 'صعودی ضعیف' : 'نزولی';
  const R1 = resistances[0] ?? Math.round(currentPrice * 1.05);
  const S1 = supports[0] ?? Math.round(currentPrice * 0.95);
  const R2 = resistances[1] ?? Math.round(currentPrice * 1.10);
  const S2 = supports[1] ?? Math.round(currentPrice * 0.90);
  const r1Grade = resistanceStrengths?.[0]?.grade || 'متوسط';
  const s1Grade = supportStrengths?.[0]?.grade || 'متوسط';
  const r2Grade = resistanceStrengths?.[1]?.grade || 'متوسط';
  const s2Grade = supportStrengths?.[1]?.grade || 'متوسط';
  const overallLabel = overallSignal === 'bullish' ? 'صعودی' : overallSignal === 'bearish' ? 'نزولی' : 'خنثی';
  const bbUpper = body.bollingerUpper;
  const bbLower = body.bollingerLower;
  const bbMiddle = body.bollingerMiddle;
  const bbRange = bbUpper - bbLower;
  const bbPosPct = bbRange > 0 ? ((currentPrice - bbLower) / bbRange * 100).toFixed(0) : '۵۰';
  const bbPosition = currentPrice > bbUpper ? 'بالای باند بالایی' : currentPrice < bbLower ? 'زیر باند پایینی' : `داخل باندها (${bbPosPct}ـ)`;

  // Dominant scenario (highest individual probability)
  const dom = scenarios[dominantKey];
  const domProb = dom ? fmt(dom.probability, 0) : '0';
  const domRange = dom ? `${fmtGrouped(dom.targetMin)} — ${fmtGrouped(dom.targetMax)} ${unit}` : '—';

  // Highest cumulative probability scenario
  const cumDom = scenarios[highestCumKey];
  const cumDomName = cumDom ? cumDom.name : '—';
  const cumDomProb = cumDom ? fmt(cumDom.probability, 0) : '0';
  const cumDomCumProb = cumDom ? fmt((cumDom as any).cumulativeProbability || 0, 0) : '0';
  const cumDomRange = cumDom ? `${fmtGrouped(cumDom.targetMin)} — ${fmtGrouped(cumDom.targetMax)} ${unit}` : '—';

  // Detect S-key scenarios
  const isSKeyScenarios = Object.keys(scenarios).some(k => k.startsWith('S'));
  const SCENARIO_ORDER = isSKeyScenarios
    ? ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'] as const
    : ['SC1', 'SC2', 'SC3', 'SC4', 'SC5', 'SC6', 'SC7', 'SC8', 'SC9'] as const;
  const probTable = SCENARIO_ORDER
    .filter(k => scenarios[k] && (scenarios[k].probability || 0) > 0.5)
    .map((k) => {
      const s = scenarios[k];
      const marker = k === dominantKey ? ' ★ غالب (بیشترین احتمال اختصاصی سناریو)' : k === highestCumKey ? ' ◆ بیشترین تجمعی' : '';
      const cumProb = (s as any).cumulativeProbability ? ` | تجمعی: ${fmt((s as any).cumulativeProbability, 0)}ـ` : '';
      const dirLabel = (s as any).direction === 'bullish' ? ' [صعودی]' : (s as any).direction === 'bearish' ? ' [نزولی]' : (s as any).direction === 'range' ? ' [رنج]' : '';
      return `- ${k} — ${s.name}${dirLabel}: ${fmt(s.probability, 0)}ـ${cumProb} (هدف: ${fmtGrouped(s.targetMin)} — ${fmtGrouped(s.targetMax)} ${unit})${marker}`;
    }).join('\n');

  // Candlestick (condensed)
  const candleLine = v12Extra.candlePatterns.patterns.length > 0
    ? v12Extra.candlePatterns.patterns.slice(0, 3).map(p => `${p.name} (${Math.round(p.reliabilityScore * 100)}ـ)`).join('یا ')
    : 'الگوی قابل اعتمادی شناسایی نشد';
  const candleDir = v12Extra.candlePatterns.dominantDirection === 'bullish' ? 'صعودی' : v12Extra.candlePatterns.dominantDirection === 'bearish' ? 'نزولی' : 'خنثی';

  // ML prediction (condensed)
  const mlLine = v12Extra.mlPrediction
    ? `پیش‌بینی ML: ${v12Extra.mlPrediction.overall_direction === 'up' ? 'صعودی' : v12Extra.mlPrediction.overall_direction === 'down' ? 'نزولی' : 'خنثی'} (${Math.round(v12Extra.mlPrediction.overall_confidence * 100)}ـ اطمینان)`
    : 'پیش‌بینی ML: مدلی آموزش ندیده';

  // Bayesian (condensed)
  const bayesLine = v12Extra.bayesianSummary.length > 200
    ? v12Extra.bayesianSummary.split('\n').slice(0, 2).join(' ')
    : v12Extra.bayesianSummary;

  return `
**${label}** — قیمت فعلی: **${fmtGrouped(currentPrice)} ${unit}**

**وضعیت قیمت:**
- روند: **${trendLabel}** (R²=${r2Pct}ـ) | سیگنال کلی: **${overallLabel}**
- موقعیت نسبت به MA21: ${currentPrice > ma21 ? 'بالاتر' : 'پایین‌تر'} (${fmtGrouped(ma21)}) | نسبت به MA100: ${currentPrice > ma100 ? 'بالاتر' : 'پایین‌تر'} (${fmtGrouped(ma100)})
- موقعیت در باند بولینگر: ${bbPosition}

**اندیکاتورها:**
- RSI=${fmt(rsi, 1)} (${rsiSignal}) | ADX=${fmt(adx, 1)} | MACD ${macdDesc} | Stoch K=${fmt(stochK, 0)}/D=${fmt(stochD, 0)} | ATR=${fmtGrouped(atr)}

**سطوح کلیدی:**
- مقاومت R1: **${fmtGrouped(R1)}** (${r1Grade}) | مقاومت R2: ${fmtGrouped(R2)} (${r2Grade})
- حمایت S1: **${fmtGrouped(S1)}** (${s1Grade}) | حمایت S2: ${fmtGrouped(S2)} (${s2Grade})

**سناریوهای کلیدی (الزامی در متن):**
- سناریوی غالب (بیشترین احتمال اختصاصی سناریو): **${dominantKey} — ${dom?.name || '—'}** با احتمال **${domProb}ـ** (هدف: ${domRange})
- سناریوی با بیشترین احتمال تجمعی: **${highestCumKey} — ${cumDomName}** — احتمال اختصاصی سناریو: ${cumDomProb}ـ | احتمال تجمعی: **${cumDomCumProb}ـ** (هدف: ${cumDomRange})

**سناریوهای احتمالی (به ترتیب هدف قیمتی):**
${probTable}

**داده‌های تکمیلی:**
- کندل‌استیک: ${candleLine} (جهت غالب: ${candleDir})
- ${mlLine}
- بیزی: ${bayesLine}`;
}

// ─── SYSTEM_PROMPT (v12 — scenario list only) ──────────────────────────────
const SYSTEM_PROMPT = `شما دستیار سامانه تحلیل تکنیکال هستید.

قوانین قطعی:
1. تحت هیچ شرایطی متن تحلیلی تولید نکن.
2. خروجی نهایی باید صرفاً شامل لیست سناریوها باشد و هیچ توضیح اضافی، مقدمه یا نتیجه‌گیری نداشته باشد.
3. لیست سناریوها را دقیقاً بر اساس شدت و قدرت حرکت قیمت از کمترین به بیشترین مرتب کن.
4. ابتدا سناریوهای نزولی و سپس سناریوهای صعودی.
5. ترتیب دقیق (از بالا به پایین):
   - شوک نزولی (کوچک‌ترین و ضعیف‌ترین)
   - نزولی شتاب‌دار
   - نزولی قوی
   - نزولی با احتیاط
   - رنج کم‌نوسان (حد وسط / بدون حرکت)
   - صعودی با احتیاط
   - صعودی قوی
   - صعودی شتاب‌دار
   - شوک صعودی (بزرگ‌ترین و قوی‌ترین در پایین)
6. فقط فارسی بنویسید. بدون ایموجی. بدون علامت‌های اضافی. فقط نام هر سناریو در یک خط.`;

// ─── V12 Extra Data Types ──────────────────────────────────────────────
interface V12ExtraData {
  candlePatterns: PatternScanResult;
  mlPrediction: import('@/lib/ml-predictor').PredictionResult | null;
  mlTrainingStatus: 'trained' | 'untrained' | 'training' | 'error';
  bayesianSummary: string;
  aiPatterns: import('@/lib/candlestick-patterns').AIPatternResult | null;
  mlServiceAvailable: boolean;
}

// ─── V12 Data Gathering (all non-blocking with short timeouts) ──────
async function gatherV12Data(body: VdesRequest): Promise<V12ExtraData> {
  const result: V12ExtraData = {
    candlePatterns: { patterns: [], dominantDirection: 'neutral', dominantScore: 0, summary: '' },
    mlPrediction: null,
    mlTrainingStatus: 'untrained',
    bayesianSummary: '',
    aiPatterns: null,
    mlServiceAvailable: false,
  };

  // 1. Candlestick pattern detection (local, fast — always runs)
  if (body.ohlcvHistory && body.ohlcvHistory.length >= 3) {
    try {
      result.candlePatterns = scanCandlestickPatterns(body.ohlcvHistory as any, 20);
    } catch (err) {
      console.warn('[V12 Candlestick] scan failed:', err);
    }
  }

  // 2. Bayesian weighting (local, fast — always runs)
  try {
    result.bayesianSummary = generateBayesianSummary(body.symbolName);
  } catch (err) {
    console.warn('[V12 Bayesian] failed:', err);
    result.bayesianSummary = '';
  }

  // 3. ML service (5s health check timeout — skip entirely if unavailable)
  try {
    const health = await withTimeout(checkMLHealth(), 5000, 'ML-Health');
    result.mlServiceAvailable = health?.status === 'ok';
  } catch {
    result.mlServiceAvailable = false;
  }

  if (result.mlServiceAvailable && body.ohlcvHistory && body.ohlcvHistory.length >= 120) {
    const symbol = body.symbolName;

    // 3a. ML Prediction (15s timeout)
    try {
      const mlOHLCV = convertToMLOHLCV(body.ohlcvHistory);
      const predResp = await withTimeout(
        predict30Sessions(symbol, mlOHLCV, 30),
        15000,
        'ML-Prediction'
      );

      if (predResp.status === 'ok' && predResp.prediction) {
        result.mlPrediction = predResp.prediction;
        result.mlTrainingStatus = 'trained';
      } else {
        console.log(`[V12 ML] No model for ${symbol}, attempting background training...`);
        trainModelInBackground(symbol, convertToMLOHLCV(body.ohlcvHistory));
      }
    } catch (err) {
      console.warn(`[V12 ML] Prediction failed for ${symbol}:`, err);
    }

    // 3b. AI Harmonic/Elliott patterns (via ZAI LLM, 15s hard timeout, best-effort)
    if (body.ohlcvHistory.length >= 50) {
      try {
        result.aiPatterns = await detectAIPatterns(body);
      } catch (err) {
        console.warn(`[V12 AI] Pattern detection failed:`, err);
      }
    }
  } else if (body.ohlcvHistory && body.ohlcvHistory.length >= 60 && body.ohlcvHistory.length < 120) {
    result.bayesianSummary += ' (برای فعال‌سازی پیش‌بینی ML به حداقل ۱۲۰ کندل داده نیاز است.)';
  }

  return result;
}

/** Background training (fire-and-forget) */
function trainModelInBackground(symbol: string, ohlcv: import('@/lib/ml-predictor').OHLCVRow[]) {
  trainModel(symbol, ohlcv).then(resp => {
    if (resp.status === 'ok') {
      console.log(`[V12 ML] Background training complete for ${symbol}: ${resp.models_trained?.join(', ')}`);
    } else {
      console.warn(`[V12 ML] Background training failed for ${symbol}: ${resp.message}`);
    }
  }).catch(err => {
    console.warn(`[V12 ML] Background training error for ${symbol}:`, err);
  });
}

/** Detect AI patterns (harmonic + Elliott) via ZAI LLM — 15s hard timeout, best-effort */
async function detectAIPatterns(
  body: VdesRequest
): Promise<import('@/lib/candlestick-patterns').AIPatternResult | null> {
  if (!body.ohlcvHistory || body.ohlcvHistory.length < 50) return null;

  const prompt = buildAIPatternPrompt({
    ohlcv: body.ohlcvHistory as any,
    currentPrice: body.currentPrice,
    symbolName: body.symbolName,
  });

  try {
    const zai = await getZAI();
    const completion = await withTimeout(
      withRetry(
        () => zai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content: 'شما یک تحلیلگر الگوهای هارمونیک و موج الیوت هستید. فقط JSON خالص پاسخ دهید. هیچ متن اضافی ننویسید.',
            },
            { role: 'user', content: prompt },
          ],
          thinking: { type: 'disabled' },
        }),
        'AI-Patterns',
        2
      ),
      15000,
      'AI-Patterns'
    );

    const text = completion.choices[0]?.message?.content;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as import('@/lib/candlestick-patterns').AIPatternResult;
  } catch (err) {
    console.warn('[V12 AI-Patterns] Error (skipped):', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── POST Handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const body: VdesRequest = await req.json();

    if (!body.symbolName || body.currentPrice == null) {
      return NextResponse.json({ error: 'symbolName و currentPrice الزامی است.' }, { status: 400 });
    }
    if (!body.scenarios || !Array.isArray(body.resistances) || !Array.isArray(body.supports)) {
      return NextResponse.json({ error: 'scenarios، resistances و supports الزامی است.' }, { status: 400 });
    }

    const scenarioKeys = Object.keys(body.scenarios);
    const scenarioProbs = scenarioKeys.slice(0, 9).map(k => `${k}:${body.scenarios[k]?.probability ?? 0}`).join(', ');
    console.log(`[VDES v12] Received ${scenarioKeys.length} scenarios: ${scenarioProbs}`);

    // ── Step 1: Narrative selection ──
    const isSKeyScenarios = scenarioKeys.some(k => k.startsWith('S'));
    const narrativeInput = buildNarrativeInput(body, isSKeyScenarios);
    const combo = selectNarrativeCombination(narrativeInput);

    // Find dominant (highest individual) and highest cumulative keys
    const ALL_KEYS = isSKeyScenarios
      ? ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'] as const
      : ['SC1', 'SC2', 'SC3', 'SC4', 'SC5', 'SC6', 'SC7', 'SC8', 'SC9'] as const;
    let dominantKey = isSKeyScenarios ? 'S5' : 'SC3';
    let dominantProb = 0;
    for (const k of ALL_KEYS) {
      const p = body.scenarios[k]?.probability ?? 0;
      if (p > dominantProb) { dominantProb = p; dominantKey = k; }
    }
    // Use client-sent keys if available (for consistency)
    // Priority: v12 > v11 > v10 (fallback chain)
    if (body.v12DominantKey) dominantKey = body.v12DominantKey;
    else if (body.v11DominantKey) dominantKey = body.v11DominantKey;
    else if (body.v10DominantKey) dominantKey = body.v10DominantKey;
    const highestCumKey = body.v12HighestCumulativeKey || body.v11HighestCumulativeKey || body.v10HighestCumulativeKey || dominantKey;

    // V12: Select persona
    const today = new Date().toISOString().split('T')[0];
    const v12Selection = selectV12Persona(body.symbolName, today, combo.school.id);

    console.log(`[VDES v13] ${body.symbolName} | Dominant: ${dominantKey} (${dominantProb}ـ)`);

    // ── Step 2: Gather V12 data (background) ──
    // Run data gathering in background — don't block the scenario list response
    gatherV12Data(body).catch(err => {
      console.warn(`[VDES v13] Background data gathering failed:`, err);
    });

    // ── Step 3: Deterministic scenario list (no LLM call) ──
    const SCENARIO_LIST = `شوک نزولی
نزولی شتاب‌دار
نزولی قوی
نزولی با احتیاط
رنج کم‌نوسان
صعودی با احتیاط
صعودی قوی
صعودی شتاب‌دار
شوک صعودی`;
    const analysis = SCENARIO_LIST;

    console.log(`[VDES v13] Deterministic scenario list for ${body.symbolName} (${analysis.length} chars, ${Math.round(Date.now() - t0)}ms)`);

    // ── Step 4: Return response ──
    const debugData = {
      v13DominantKey: dominantKey,
      v13HighestCumulativeKey: highestCumKey,
      v13: { deterministic: true },
      latencyMs: Date.now() - t0,
    };

    return NextResponse.json({ analysis, _debug: debugData });
  } catch (err) {
    const elapsed = Math.round(Date.now() - t0);
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[VDES v12 Error] (${elapsed}ms):`, errMsg);

    const isTimeout = errMsg.includes('timeout');
    const is429 = errMsg.includes('429');

    return NextResponse.json(
      {
        error: isTimeout
          ? `زمان پاسخگویی به پایان رسید (${elapsed / 1000}s). لطفاً دوباره تلاش کنید.`
          : is429
          ? 'درخواست‌ها زیاد است. لطفاً ۱۰ ثانیه صبر کنید و دوباره تلاش کنید.'
          : 'خطا در تولید تحلیل هوشمند. لطفاً دوباره تلاش کنید.',
        retryAfter: isTimeout ? 3 : is429 ? 10 : 5,
      },
      { status: 503 },
    );
  }
}
