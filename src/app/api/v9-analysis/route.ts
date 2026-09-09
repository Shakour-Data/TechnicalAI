// ═══════════════════════════════════════════════════════════════════════════════
// VDES Analysis API v9 — ML-Enhanced Version
// ═══════════════════════════════════════════════════════════════════════════════
// V9 New Features:
//   1. XGBoost/Ensemble ML 30-session price prediction (via Python service)
//   2. 10 main candlestick pattern recognition
//   3. AI-powered harmonic & Elliott wave pattern detection (via ZAI LLM)
//   4. Dynamic Bayesian weighting system
//   5. Auto-training trigger when sufficient data available
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import {
  selectNarrativeCombination, buildNarrativeInput,
  selectV9Persona, buildV9NarrativePrompt,
} from '@/lib/ml-narrative-v9';
import { scanCandlestickPatterns, buildAIPatternPrompt, type PatternScanResult } from '@/lib/candlestick-patterns';
import { generateBayesianSummary } from '@/lib/bayesian-weights';
import { predict30Sessions, trainModel, checkMLHealth, convertToMLOHLCV } from '@/lib/ml-predictor';

export const dynamic = 'force-dynamic';

// ─── Version & Cache ────────────────────────────────────────────────
const ANALYSIS_VERSION = 9;
const cache = new Map<string, { v: number; text: string; ts: number; debug: any }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(body: VdesRequest): string {
  return `${ANALYSIS_VERSION}:${body.symbolName}:${body.currentPrice}:${body.trendDirection}:${body.rsi}:${body.adx}`;
}

// ─── Shared ZAI instance (lazy init) ─────────────────────────────────
let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getZAI() {
  if (!_zai) _zai = await ZAI.create();
  return _zai;
}

// ─── 429 Retry (fast: 2s, 5s, 10s) ────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, label: string = 'V9', maxAttempts = 3): Promise<T> {
  const delays = [2000, 5000, 10000]; // 2s, 5s, 10s — max 17s total wait
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      if (status === 429 && attempt < maxAttempts - 1) {
        const wait = delays[attempt];
        console.warn(`[VDES v9 429] ${label} Retry ${attempt + 1}/${maxAttempts} after ${wait / 1000}s`);
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
  targetMin: number;
  targetMax: number;
  description: string;
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
  // V9 new fields
  ohlcvHistory?: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
}

// ─── Build data section (V9 focused — dominant scenario) ──────────
function buildDataSection(body: VdesRequest, v9Extra: V9ExtraData, dominantKey: string): string {
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

  // Dominant scenario from VDSS decision graph
  const dom = scenarios[dominantKey];
  const domProb = dom ? fmt(dom.probability, 0) : '0';
  const domRange = dom ? `${fmtGrouped(dom.targetMin)} — ${fmtGrouped(dom.targetMax)} ${unit}` : '—';

  // Compact scenario list with targets (only non-negligible, sorted by prob)
  const allKeys = Object.keys(scenarios).sort((a, b) => (scenarios[b].probability || 0) - (scenarios[a].probability || 0));
  const topScenarios = allKeys.filter(k => (scenarios[k].probability || 0) > 3).slice(0, 5);
  const compactList = topScenarios.map((k) => {
    const s = scenarios[k];
    return `${s.name}: ${fmt(s.probability, 0)}٪ (${fmtGrouped(s.targetMin)} — ${fmtGrouped(s.targetMax)})`;
  }).join(' | ');

  // Candlestick (condensed)
  const candleLine = v9Extra.candlePatterns.patterns.length > 0
    ? v9Extra.candlePatterns.patterns.slice(0, 3).map(p => `${p.name} (${Math.round(p.reliabilityScore * 100)}٪)`).join('، ')
    : 'الگوی قابل اعتمادی شناسایی نشد';
  const candleDir = v9Extra.candlePatterns.dominantDirection === 'bullish' ? 'صعودی' : v9Extra.candlePatterns.dominantDirection === 'bearish' ? 'نزولی' : 'خنثی';

  // ML prediction (condensed)
  const mlLine = v9Extra.mlPrediction
    ? `پیش‌بینی ML: ${v9Extra.mlPrediction.overall_direction === 'up' ? 'صعودی' : v9Extra.mlPrediction.overall_direction === 'down' ? 'نزولی' : 'خنثی'} (${Math.round(v9Extra.mlPrediction.overall_confidence * 100)}٪ اطمینان)`
    : 'پیش‌بینی ML: مدلی آموزش ندیده';

  // Bayesian (condensed)
  const bayesLine = v9Extra.bayesianSummary.length > 200
    ? v9Extra.bayesianSummary.split('\n').slice(0, 2).join(' ')
    : v9Extra.bayesianSummary;

  return `
**${label}** — قیمت: **${fmtGrouped(currentPrice)} ${unit}**
روند: **${trendLabel}** (R²=${r2Pct}٪) | سیگنال کلی: **${overallLabel}**
RSI=${fmt(rsi, 1)} (${rsiSignal}) | ADX=${fmt(adx, 1)} | MACD ${macdDesc} | Stoch K=${fmt(stochK, 0)}/D=${fmt(stochD, 0)}
MA21=${fmtGrouped(ma21)} (${currentPrice > ma21 ? 'بالاتر' : 'پایین‌تر'}) | MA100=${fmtGrouped(ma100)} (${currentPrice > ma100 ? 'بالاتر' : 'پایین‌تر'})
مقاومت R1: ${fmtGrouped(R1)} (${r1Grade}) | مقاومت R2: ${fmtGrouped(R2)} (${r2Grade})
حمایت S1: ${fmtGrouped(S1)} (${s1Grade}) | حمایت S2: ${fmtGrouped(S2)} (${s2Grade})
باند بالایی بولینگر: ${fmtGrouped(bbUpper)} | باند پایینی بولینگر: ${fmtGrouped(bbLower)} | ATR: ${fmtGrouped(atr)}

**سناریوی غالب خروجی گراف تصمیم VDSS:**
${dom?.name || dominantKey} — احتمال **${domProb}٪** — محدوده هدف: ${domRange}

**سایر سناریوها (خلاصه با اهداف قیمتی):** ${compactList}

**داده‌های v9:**
- کندل‌استیک: ${candleLine} (جهت غالب: ${candleDir})
- ${mlLine}
- بیزی: ${bayesLine}`;
}

// ─── SYSTEM_PROMPT (v9 — concise) ───────────────────────────────
const SYSTEM_PROMPT = `شما تحلیلگر ارشد بازار ایران هستید. فقط فارسی بنویسید. بدون ایموجی.`;

// ─── V9 Extra Data Types ────────────────────────────────────────────
interface V9ExtraData {
  candlePatterns: PatternScanResult;
  mlPrediction: import('@/lib/ml-predictor').PredictionResult | null;
  mlTrainingStatus: 'trained' | 'untrained' | 'training' | 'error';
  bayesianSummary: string;
  aiPatterns: import('@/lib/candlestick-patterns').AIPatternResult | null;
  mlServiceAvailable: boolean;
}

// ─── V9 Data Gathering (all non-blocking with short timeouts) ──────
async function gatherV9Data(body: VdesRequest): Promise<V9ExtraData> {
  const result: V9ExtraData = {
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
      console.warn('[V9 Candlestick] scan failed:', err);
    }
  }

  // 2. Bayesian weighting (local, fast — always runs)
  try {
    result.bayesianSummary = generateBayesianSummary(body.symbolName);
  } catch (err) {
    console.warn('[V9 Bayesian] failed:', err);
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
        console.log(`[V9 ML] No model for ${symbol}, attempting background training...`);
        trainModelInBackground(symbol, convertToMLOHLCV(body.ohlcvHistory));
      }
    } catch (err) {
      console.warn(`[V9 ML] Prediction failed for ${symbol}:`, err);
    }

    // 3b. AI Harmonic/Elliott patterns (via ZAI LLM, 15s hard timeout, best-effort)
    if (body.ohlcvHistory.length >= 50) {
      try {
        result.aiPatterns = await detectAIPatterns(body);
      } catch (err) {
        console.warn(`[V9 AI] Pattern detection failed:`, err);
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
      console.log(`[V9 ML] Background training complete for ${symbol}: ${resp.models_trained?.join(', ')}`);
    } else {
      console.warn(`[V9 ML] Background training failed for ${symbol}: ${resp.message}`);
    }
  }).catch(err => {
    console.warn(`[V9 ML] Background training error for ${symbol}:`, err);
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
        2 // max 2 attempts for secondary feature
      ),
      15000, // 15s hard timeout
      'AI-Patterns'
    );

    const text = completion.choices[0]?.message?.content;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as import('@/lib/candlestick-patterns').AIPatternResult;
  } catch (err) {
    console.warn('[V9 AI-Patterns] Error (skipped):', err instanceof Error ? err.message : err);
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

    // ── Step 1: Narrative selection (v9 engine — ONE combination from decision graph) ──
    const narrativeInput = buildNarrativeInput(body);
    const combo = selectNarrativeCombination(narrativeInput);

    // Find dominant scenario from VDSS decision graph
    const allKeys = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5', 'SC6', 'SC7', 'SC8', 'SC9'] as const;
    let dominantKey = 'SC3';
    let dominantProb = 0;
    for (const k of allKeys) {
      const p = body.scenarios[k]?.probability ?? 0;
      if (p > dominantProb) { dominantProb = p; dominantKey = k; }
    }

    // V9: Select persona based on today's date + instrument
    const today = new Date().toISOString().split('T')[0];
    const v9Selection = selectV9Persona(body.symbolName, today, combo.school.id);

    console.log(`[VDES v9] ${body.symbolName} | Dominant: ${dominantKey} (${dominantProb}٪) | Persona: ${v9Selection.persona.name} | School: ${combo.school.nameEn}`);

    // ── Step 2: Gather V9 data (all with tight timeouts) ──
    const v9Extra = await withTimeout(gatherV9Data(body), 25000, 'V9-Data-Gathering');

    // ── Step 3: Build focused prompt (dominant scenario only) ──
    const dataSection = buildDataSection(body, v9Extra, dominantKey);
    const prompt = buildV9NarrativePrompt({
      instrument: body.symbolName,
      date: today,
      persona: v9Selection.persona,
      template: v9Selection.template,
      dataSection,
      variationSeed: v9Selection.variationSeed,
      school: combo.school,
      style: combo.style,
      tone: combo.tone,
    });

    // ── Step 4: Check cache ──
    const key = cacheKey(body);
    const cached = cache.get(key);
    if (cached && cached.v === ANALYSIS_VERSION && (Date.now() - cached.ts) < CACHE_TTL_MS) {
      console.log(`[VDES v9] Cache hit for ${body.symbolName} (${Math.round(Date.now() - t0)}ms)`);
      return NextResponse.json({
        analysis: cached.text,
        _debug: {
          ...cached.debug,
          v9: {
            candlePatterns: v9Extra.candlePatterns,
            mlTrainingStatus: v9Extra.mlTrainingStatus,
            mlServiceAvailable: v9Extra.mlServiceAvailable,
            mlPrediction: v9Extra.mlPrediction ? {
              overall_direction: v9Extra.mlPrediction.overall_direction,
              overall_confidence: v9Extra.mlPrediction.overall_confidence,
              target_price_min: v9Extra.mlPrediction.target_price_min,
              target_price_max: v9Extra.mlPrediction.target_price_max,
              risk_level: v9Extra.mlPrediction.risk_level,
            } : null,
            aiPatterns: v9Extra.aiPatterns,
            bayesianSummary: v9Extra.bayesianSummary,
          },
          cached: true,
          latencyMs: Date.now() - t0,
        },
      });
    }

    // ── Step 5: Call ZAI LLM (with 45s hard timeout) ──
    console.log(`[VDES v9] Prompt size: ${prompt.length} chars (${(prompt.length / 1024).toFixed(1)} KB)`);
    const zai = await getZAI();
    const completion = await withTimeout(
      withRetry(
        () => zai.chat.completions.create({
          messages: [
            { role: 'assistant', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          thinking: { type: 'disabled' },
        }),
        'V9-Narrative',
        3 // 3 retry attempts
      ),
      45000, // 45s hard timeout for entire LLM call including retries
      'V9-Narrative'
    );

    const analysis = completion.choices[0]?.message?.content;

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
      v9Persona: v9Selection.persona.name,
      v9Template: v9Selection.template.nameEn,
      v9VariationSeed: v9Selection.variationSeed,
      v9: {
        candlePatterns: v9Extra.candlePatterns,
        mlTrainingStatus: v9Extra.mlTrainingStatus,
        mlServiceAvailable: v9Extra.mlServiceAvailable,
        mlPrediction: v9Extra.mlPrediction ? {
          overall_direction: v9Extra.mlPrediction.overall_direction,
          overall_confidence: v9Extra.mlPrediction.overall_confidence,
          target_price_min: v9Extra.mlPrediction.target_price_min,
          target_price_max: v9Extra.mlPrediction.target_price_max,
          risk_level: v9Extra.mlPrediction.risk_level,
        } : null,
        aiPatterns: v9Extra.aiPatterns,
        bayesianSummary: v9Extra.bayesianSummary,
      },
    };

    cache.set(key, { v: ANALYSIS_VERSION, text: analysis, ts: Date.now(), debug: debugData });

    // Evict stale entries
    for (const [k, v] of cache) {
      if ((Date.now() - v.ts) > CACHE_TTL_MS) cache.delete(k);
    }

    console.log(`[VDES v9] Generated for ${body.symbolName} (${analysis.length} chars, ${Math.round(Date.now() - t0)}ms)`);

    return NextResponse.json({
      analysis,
      _debug: debugData,
    });
  } catch (err) {
    const elapsed = Math.round(Date.now() - t0);
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[VDES v9 Error] (${elapsed}ms):`, errMsg);

    // Return 503 (Service Unavailable) for timeout errors so frontend can retry
    const isTimeout = errMsg.includes('timeout');
    const is429 = errMsg.includes('429');

    return NextResponse.json(
      {
        error: isTimeout
          ? `زمان پاسخگویی به پایان رسید (${elapsed / 1000}s). لطفاً دوباره تلاش کنید.`
          : is429
          ? 'درخواست‌ها زیاد است. لطفاً ۱۰ ثانیه صبر کنید و دوباره تلاش کنید.'
          : 'خطا در تولید تحلیل هوشمند v9. لطفاً دوباره تلاش کنید.',
        retryAfter: isTimeout ? 3 : is429 ? 10 : 5,
      },
      { status: 503 },
    );
  }
}
