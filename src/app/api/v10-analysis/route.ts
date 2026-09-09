// ═══════════════════════════════════════════════════════════════════════════════
// VDES Analysis API v10 — Data-Driven ML-Enhanced Version
// ⚠️  LOCKED — DO NOT MODIFY. All changes go to V11.
// ═══════════════════════════════════════════════════════════════════════════════
// V10 = V9 base + Data-driven prompt (probabilities, levels, trend in output)
//   1. XGBoost/Ensemble ML 30-session price prediction (via Python service)
//   2. 10 main candlestick pattern recognition
//   3. AI-powered harmonic & Elliott wave pattern detection (via ZAI LLM)
//   4. Dynamic Bayesian weighting system
//   5. Auto-training trigger when sufficient data available
//   6. [V10 NEW] Data-driven text: explicit probabilities, levels, trend data
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  selectNarrativeCombination, buildNarrativeInput,
  selectV10Persona, buildV10NarrativePrompt,
} from '@/lib/ml-narrative-v10';
import { scanCandlestickPatterns, buildAIPatternPrompt, type PatternScanResult } from '@/lib/candlestick-patterns';
import { generateBayesianSummary } from '@/lib/bayesian-weights';
import { predict30Sessions, trainModel, checkMLHealth, convertToMLOHLCV } from '@/lib/ml-predictor';
import { dedicatedAIChatCompletion } from '@/lib/zai-shared';

export const dynamic = 'force-dynamic';

// ─── Version & Cache ────────────────────────────────────────────────
const ANALYSIS_VERSION = 10;
const cache = new Map<string, { v: number; text: string; ts: number; debug: any }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(body: VdesRequest): string {
  return `${ANALYSIS_VERSION}:${body.symbolName}:${body.currentPrice}:${body.trendDirection}:${body.rsi}:${body.adx}`;
}

// ─── Shared Ollama instance (lazy init) ─────────────────────────────────
let _ollamaInitialized = false;
async function getOllama() {
  if (!_ollamaInitialized) _ollamaInitialized = true;
  return null;
}

// ─── 429 Retry (fast: 2s, 5s, 10s) ────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, label: string = 'V10', maxAttempts = 3): Promise<T> {
  const delays = [2000, 5000, 10000]; // 2s, 5s, 10s — max 17s total wait
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      if (status === 429 && attempt < maxAttempts - 1) {
        const wait = delays[attempt];
        console.warn(`[VDES v10 429] ${label} Retry ${attempt + 1}/${maxAttempts} after ${wait / 1000}s`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${label}: max retries exceeded`);
}

// ─── Timeout helper (cleans up timer when main promise resolves first) ──────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => { if (timer) clearTimeout(timer); }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout (${ms / 1000}s)`)), ms);
    }),
  ]);
}

// ─── Helpers ────────────────────────────────────────────────────────
function fmt(n: number, d = 0): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  return n.toFixed(d);
}

function fmtGrouped(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('fa-IR');
}

// ─── Types ────────────────────────────────────────────────────────────
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
  // V10 new fields
  ohlcvHistory?: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  // V10 dominant + cumulative keys
  v10DominantKey?: string;
  v10HighestCumulativeKey?: string;
}

// ─── Build data section (V10 — data-driven with V10 scenario table) ──────────
function buildDataSection(body: VdesRequest, v10Extra: V10ExtraData, dominantKey: string, highestCumKey: string): string {
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
  const bbPosition = currentPrice > bbUpper ? 'بالای باند بالایی' : currentPrice < bbLower ? 'زیر باند پایینی' : `داخل باندها (${bbPosPct}٪)`;

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

  // Detect V10 (S1-S9) or V9 (SC1-SC9) scenarios
  const isV10 = Object.keys(scenarios).some(k => k.startsWith('S'));
  const V10_ORDER = isV10
    ? ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'] as const
    : ['SC1', 'SC2', 'SC3', 'SC4', 'SC5', 'SC6', 'SC7', 'SC8', 'SC9'] as const;
  const probTable = V10_ORDER
    .filter(k => scenarios[k] && (scenarios[k].probability || 0) > 0.5)
    .map((k) => {
      const s = scenarios[k];
      const marker = k === dominantKey ? ' ★ غالب (بیشترین احتمال اختصاصی سناریو)' : k === highestCumKey ? ' ◆ بیشترین تجمعی' : '';
      const cumProb = (s as any).cumulativeProbability ? ` | تجمعی: ${fmt((s as any).cumulativeProbability, 0)}٪` : '';
      const dirLabel = (s as any).direction === 'bullish' ? ' [صعودی]' : (s as any).direction === 'bearish' ? ' [نزولی]' : (s as any).direction === 'range' ? ' [رنج]' : '';
      return `- ${s.name}${dirLabel}: ${fmt(s.probability, 0)}٪${cumProb} (هدف: ${fmtGrouped(s.targetMin)} — ${fmtGrouped(s.targetMax)} ${unit})${marker}`;
    }).join('\n');

  // Candlestick (condensed)
  const candleLine = v10Extra.candlePatterns.patterns.length > 0
    ? v10Extra.candlePatterns.patterns.slice(0, 3).map(p => `${p.name} (${Math.round(p.reliabilityScore * 100)}٪)`).join('، ')
    : 'الگوی قابل اعتمادی شناسایی نشد';
  const candleDir = v10Extra.candlePatterns.dominantDirection === 'bullish' ? 'صعودی' : v10Extra.candlePatterns.dominantDirection === 'bearish' ? 'نزولی' : 'خنثی';

  // ML prediction (condensed)
  const mlLine = v10Extra.mlPrediction
    ? `پیش‌بینی ML: ${v10Extra.mlPrediction.overall_direction === 'up' ? 'صعودی' : v10Extra.mlPrediction.overall_direction === 'down' ? 'نزولی' : 'خنثی'} (${Math.round(v10Extra.mlPrediction.overall_confidence * 100)}٪ اطمینان)`
    : 'پیش‌بینی ML: مدلی آموزش ندیده';

  // Bayesian (condensed)
  const bayesLine = v10Extra.bayesianSummary.length > 200
    ? v10Extra.bayesianSummary.split('\n').slice(0, 2).join(' ')
    : v10Extra.bayesianSummary;

  return `
**${label}** — قیمت فعلی: **${fmtGrouped(currentPrice)} ${unit}**

**وضعیت قیمت:**
- روند: **${trendLabel}** (R²=${r2Pct}٪) | سیگنال کلی: **${overallLabel}**
- موقعیت نسبت به MA21: ${currentPrice > ma21 ? 'بالاتر' : 'پایین‌تر'} (${fmtGrouped(ma21)}) | نسبت به MA100: ${currentPrice > ma100 ? 'بالاتر' : 'پایین‌تر'} (${fmtGrouped(ma100)})
- موقعیت در باند بولینگر: ${bbPosition}

**اندیکاتورها:**
- RSI=${fmt(rsi, 1)} (${rsiSignal}) | ADX=${fmt(adx, 1)} | MACD ${macdDesc} | Stoch K=${fmt(stochK, 0)}/D=${fmt(stochD, 0)} | ATR=${fmtGrouped(atr)}

**سطوح کلیدی:**
- مقاومت R1: **${fmtGrouped(R1)}** (${r1Grade}) | مقاومت R2: ${fmtGrouped(R2)} (${r2Grade})
- حمایت S1: **${fmtGrouped(S1)}** (${s1Grade}) | حمایت S2: ${fmtGrouped(S2)} (${s2Grade})

**سناریوهای کلیدی (الزامی در متن):**
- سناریوی غالب (بیشترین احتمال اختصاصی سناریو): **${dom?.name || '—'}** با احتمال **${domProb}٪** (هدف: ${domRange})
- سناریوی با بیشترین احتمال تجمعی: **${cumDomName}** — احتمال اختصاصی سناریو: ${cumDomProb}٪ | احتمال تجمعی: **${cumDomCumProb}٪** (هدف: ${cumDomRange})

**سناریوهای احتمالی (به ترتیب هدف قیمتی):**
${probTable}

**داده‌های تکمیلی v10:**
- کندل‌استیک: ${candleLine} (جهت غالب: ${candleDir})
- ${mlLine}
- بیزی: ${bayesLine}`;
}

// ─── SYSTEM_PROMPT (v10 — concise) ───────────────────────────────
const SYSTEM_PROMPT = `شما تحلیلگر ارشد بازار ایران هستید. فقط فارسی بنویسید. بدون ایموجی.`;

// ─── V10 Extra Data Types ────────────────────────────────────────────
interface V10ExtraData {
  candlePatterns: PatternScanResult;
  mlPrediction: import('@/lib/ml-predictor').PredictionResult | null;
  mlTrainingStatus: 'trained' | 'untrained' | 'training' | 'error';
  bayesianSummary: string;
  aiPatterns: import('@/lib/candlestick-patterns').AIPatternResult | null;
  mlServiceAvailable: boolean;
}

// ─── V10 Data Gathering (all non-blocking with short timeouts) ──────
async function gatherV10Data(body: VdesRequest): Promise<V10ExtraData> {
  const result: V10ExtraData = {
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
      console.warn('[V10 Candlestick] scan failed:', err);
    }
  }

  // 2. Bayesian weighting (local, fast — always runs)
  try {
    result.bayesianSummary = generateBayesianSummary(body.symbolName);
  } catch (err) {
    console.warn('[V10 Bayesian] failed:', err);
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
        console.log(`[V10 ML] No model for ${symbol}, attempting background training...`);
        trainModelInBackground(symbol, convertToMLOHLCV(body.ohlcvHistory));
      }
    } catch (err) {
      console.warn(`[V10 ML] Prediction failed for ${symbol}:`, err);
    }

    // 3b. AI Harmonic/Elliott patterns (via ZAI LLM, 15s hard timeout, best-effort)
    if (body.ohlcvHistory.length >= 50) {
      try {
        result.aiPatterns = await detectAIPatterns(body);
      } catch (err) {
        console.warn(`[V10 AI] Pattern detection failed:`, err);
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
      console.log(`[V10 ML] Background training complete for ${symbol}: ${resp.models_trained?.join(', ')}`);
    } else {
      console.warn(`[V10 ML] Background training failed for ${symbol}: ${resp.message}`);
    }
  }).catch(err => {
    console.warn(`[V10 ML] Background training error for ${symbol}:`, err);
  });
}

/** Detect AI patterns (harmonic + Elliott) via Ollama LLM — 15s hard timeout, best-effort */
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
    const analysis = await dedicatedAIChatCompletion(
      [
        {
          role: 'assistant',
          content: 'شما یک تحلیلگر الگوهای هارمونیک و موج الیوت هستید. فقط JSON خالص پاسخ دهید. هیچ متن اضافی ننویسید.',
        },
        { role: 'user', content: prompt },
      ],
      { timeoutMs: 15_000, maxRetries: 2 }
    );

    const jsonMatch = analysis.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as import('@/lib/candlestick-patterns').AIPatternResult;
  } catch (err) {
    console.warn('[V10 AI-Patterns] Error (skipped):', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── POST Handler ─────────────────────────────────────────────────────
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

    // Debug: log received scenario keys and probabilities
    const scenarioKeys = Object.keys(body.scenarios);
    const scenarioProbs = scenarioKeys.slice(0, 9).map(k => `${k}:${body.scenarios[k]?.probability ?? 0}`).join(', ');
    console.log(`[VDES v10] Received ${scenarioKeys.length} scenarios: ${scenarioProbs}`);

    // ── Step 1: Narrative selection (v10 engine — ONE combination from decision graph) ──
    // Detect if V10 (S1-S9) or V9 (SC1-SC9) scenarios are sent
    const isV10Scenarios = scenarioKeys.some(k => k.startsWith('S'));
    const narrativeInput = buildNarrativeInput(body, isV10Scenarios);
    const combo = selectNarrativeCombination(narrativeInput);

    // Find dominant (highest individual) and highest cumulative keys
    const ALL_KEYS = isV10Scenarios
      ? ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'] as const
      : ['SC1', 'SC2', 'SC3', 'SC4', 'SC5', 'SC6', 'SC7', 'SC8', 'SC9'] as const;
    let dominantKey = isV10Scenarios ? 'S5' : 'SC3';
    let dominantProb = 0;
    for (const k of ALL_KEYS) {
      const p = body.scenarios[k]?.probability ?? 0;
      if (p > dominantProb) { dominantProb = p; dominantKey = k; }
    }
    // Use client-sent keys if available (for consistency)
    if (body.v10DominantKey) dominantKey = body.v10DominantKey;
    const highestCumKey = body.v10HighestCumulativeKey || dominantKey;

    // V10: Select persona based on today's date + instrument
    const today = new Date().toISOString().split('T')[0];
    const v10Selection = selectV10Persona(body.symbolName, today, combo.school.id);

    console.log(`[VDES v10] ${body.symbolName} | Dominant: ${dominantKey} (${dominantProb}٪) | Persona: ${v10Selection.persona.name} | School: ${combo.school.nameEn}`);

    // ── Step 2: Gather V10 data (all with tight timeouts) ──
    const v10Extra = await withTimeout(gatherV10Data(body), 25000, 'V10-Data-Gathering');

    // ── Step 3: Build focused prompt (dominant scenario only) ──
    const dataSection = buildDataSection(body, v10Extra, dominantKey, highestCumKey);
    const prompt = buildV10NarrativePrompt({
      instrument: body.symbolName,
      date: today,
      persona: v10Selection.persona,
      template: v10Selection.template,
      dataSection,
      variationSeed: v10Selection.variationSeed,
      school: combo.school,
      style: combo.style,
      tone: combo.tone,
    });

    // ── Step 4: Check cache ──
    const key = cacheKey(body);
    const cached = cache.get(key);
    if (cached && cached.v === ANALYSIS_VERSION && (Date.now() - cached.ts) < CACHE_TTL_MS) {
      console.log(`[VDES v10] Cache hit for ${body.symbolName} (${Math.round(Date.now() - t0)}ms)`);
      return NextResponse.json({
        analysis: cached.text,
        _debug: {
          ...cached.debug,
          v10: {
            candlePatterns: v10Extra.candlePatterns,
            mlTrainingStatus: v10Extra.mlTrainingStatus,
            mlServiceAvailable: v10Extra.mlServiceAvailable,
            mlPrediction: v10Extra.mlPrediction ? {
              overall_direction: v10Extra.mlPrediction.overall_direction,
              overall_confidence: v10Extra.mlPrediction.overall_confidence,
              target_price_min: v10Extra.mlPrediction.target_price_min,
              target_price_max: v10Extra.mlPrediction.target_price_max,
              risk_level: v10Extra.mlPrediction.risk_level,
            } : null,
            aiPatterns: v10Extra.aiPatterns,
            bayesianSummary: v10Extra.bayesianSummary,
          },
          cached: true,
          latencyMs: Date.now() - t0,
        },
      });
    }

    // ── Step 5: Call Ollama LLM via dedicated channel ──
    console.log(`[VDES v10] Prompt size: ${prompt.length} chars (${(prompt.length / 1024).toFixed(1)} KB)`);
    const analysis = await dedicatedAIChatCompletion(
      [
        { role: 'assistant', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      { timeoutMs: 45_000, maxRetries: 3 }
    );

    if (!analysis || analysis.trim().length === 0) {
      return NextResponse.json({ error: 'مدل پاسخی تولید نکرد.' }, { status: 500 });
    }

    // ── Step 6: Cache & respond ──
    const debugData = {
      school: combo.school.name,
      style: combo.style.name,
      tone: combo.tone.name,
      schoolScore: combo.schoolScore,
      styleScore: combo.styleScore,
      toneScore: combo.toneScore,
      v10Persona: v10Selection.persona.name,
      v10Template: v10Selection.template.nameEn,
      v10VariationSeed: v10Selection.variationSeed,
      v10: {
        candlePatterns: v10Extra.candlePatterns,
        mlTrainingStatus: v10Extra.mlTrainingStatus,
        mlServiceAvailable: v10Extra.mlServiceAvailable,
        mlPrediction: v10Extra.mlPrediction ? {
          overall_direction: v10Extra.mlPrediction.overall_direction,
          overall_confidence: v10Extra.mlPrediction.overall_confidence,
          target_price_min: v10Extra.mlPrediction.target_price_min,
          target_price_max: v10Extra.mlPrediction.target_price_max,
          risk_level: v10Extra.mlPrediction.risk_level,
        } : null,
        aiPatterns: v10Extra.aiPatterns,
        bayesianSummary: v10Extra.bayesianSummary,
      },
    };

    cache.set(key, { v: ANALYSIS_VERSION, text: analysis, ts: Date.now(), debug: debugData });

    // Evict stale entries
    for (const [k, v] of cache) {
      if ((Date.now() - v.ts) > CACHE_TTL_MS) cache.delete(k);
    }

    console.log(`[VDES v10] Generated for ${body.symbolName} (${analysis.length} chars, ${Math.round(Date.now() - t0)}ms)`);

    return NextResponse.json({
      analysis,
      _debug: debugData,
    });
  } catch (err) {
    const elapsed = Math.round(Date.now() - t0);
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[VDES v10 Error] (${elapsed}ms):`, errMsg);

    // Return 503 (Service Unavailable) for timeout errors so frontend can retry
    const isTimeout = errMsg.includes('timeout');
    const is429 = errMsg.includes('429');

    return NextResponse.json(
      {
        error: isTimeout
          ? `زمان پاسخگویی به پایان رسید (${elapsed / 1000}s). لطفاً دوباره تلاش کنید.`
          : is429
          ? 'درخواست‌ها زیاد است. لطفاً ۱۰ ثانیه صبر کنید و دوباره تلاش کنید.'
          : 'خطا در تولید تحلیل هوشمند v10. لطفاً دوباره تلاش کنید.',
        retryAfter: isTimeout ? 3 : is429 ? 10 : 5,
      },
      { status: 503 },
    );
  }
}
