import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import {
  selectMLCombination,
  selectMethods,
  getScenarioName,
  type MLSelectorInput,
} from '@/lib/analysis-ml-selector';

export const dynamic = 'force-dynamic';

// ─── 1-hour in-memory cache ────────────────────────────────────────
interface CacheEntry {
  text: string;
  ml: { school: string; style: string; tone: string; reasoning: string; methods: string[] };
  ts: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 3_600_000;

function cacheKey(body: Record<string, unknown>): string {
  const k = { s: body.symbolName, p: body.currentPrice, t: body.trendDirection, r: body.rsi, a: body.adx };
  return JSON.stringify(k);
}

// ─── Global rate limiter ───────────────────────────────────────────
let lastAITime = 0;
const AI_MIN_INTERVAL = 30_000;
let cooldownUntil = 0;
let activeCall = false;
const pendingQueue: Array<{
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  prompt: string;
  system: string;
}> = [];

function processAIQueue() {
  if (activeCall || pendingQueue.length === 0) return;
  const now = Date.now();

  if (cooldownUntil > now) {
    setTimeout(processAIQueue, Math.min(cooldownUntil - now, 5000));
    return;
  }

  const elapsed = now - lastAITime;
  if (elapsed < AI_MIN_INTERVAL) {
    setTimeout(processAIQueue, AI_MIN_INTERVAL - elapsed);
    return;
  }

  const item = pendingQueue.shift()!;
  activeCall = true;

  callZaiCLI(item.prompt, item.system)
    .then(text => {
      lastAITime = Date.now();
      cooldownUntil = 0;
      item.resolve(text);
    })
    .catch(err => {
      const msg = err.message || '';
      if (msg.includes('429')) {
        const cd = Math.max(cooldownUntil - Date.now(), 0) + 60_000;
        cooldownUntil = Date.now() + Math.min(cd, 300_000);
        console.warn(`[AI] 429, cooldown ${Math.min(cd, 300_000) / 1000}s`);
      }
      item.reject(err);
    })
    .finally(() => {
      activeCall = false;
      setTimeout(processAIQueue, 1000);
    });
}

function queueAI(prompt: string, system: string, timeoutMs = 45_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = pendingQueue.findIndex(q => q.prompt === prompt);
      if (idx >= 0) pendingQueue.splice(idx, 1);
      reject(new Error('AI request timeout'));
    }, timeoutMs);

    pendingQueue.push({
      prompt,
      system,
      resolve: (text) => { clearTimeout(timer); resolve(text); },
      reject: (err) => { clearTimeout(timer); reject(err); },
    });

    processAIQueue();
  });
}

// ─── z-ai CLI wrapper (no SDK import in server process) ──────────
function callZaiCLI(prompt: string, system: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('[AI] Calling z-ai CLI...');
    const child = execFile('z-ai', ['chat', '-p', prompt, '-s', system],
      { timeout: 40_000, maxBuffer: 2 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        const output = stdout.trim();
        // Strip emoji prefix lines
        const lines = output.split('\n').filter(l => !l.startsWith('🚀'));
        const text = lines.join('\n').trim();
        if (text.length < 10) {
          reject(new Error('AI response too short: ' + text.slice(0, 100)));
        } else {
          resolve(text);
        }
      }
    );
  });
}

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
  const scenarios = body.scenarios as Record<string, { probability: number }> | undefined;
  let dominantKey = 'R3';
  let dominantProb = 0;
  for (const k of ['R1', 'R2', 'R3', 'R4', 'R5'] as const) {
    const p = scenarios?.[k]?.probability ?? 0;
    if (p > dominantProb) { dominantProb = p; dominantKey = k; }
  }
  return { price, trend: trendDir === 'up' ? 'up' : trendDir === 'down' ? 'down' : 'range', adx, diPlus: (body.diPlus as number) || 0, diMinus: (body.diMinus as number) || 0, rsi, stochK, macdHist, obv, bbPosition, resistance, support, atr, scenarioDominant: dominantKey, hasVolume: (body.hasVolume as boolean) ?? false };
}

// ─── Build Prompt (v5.1 — concise) ────────────────────────────────
function buildPrompt(body: Record<string, unknown>, ml: ReturnType<typeof selectMLCombination>, methods: string[]): string {
  const { symbolName, currentPrice, ma21, ma100, rsi, mfi, cci, adx, stochK, stochD, macdLine, macdSignal, macdHist, diPlus, diMinus, sar, atr, obv, bollingerUpper, bollingerLower, trendDirection, trendAngle, trendR2, scenarios, resistanceStrengths, supportStrengths, } = body as { symbolName: string; currentPrice: number; ma21: number; ma100: number; rsi: number; mfi: number; cci: number; adx: number; stochK: number; stochD: number; macdLine: number; macdSignal: number; macdHist: number; diPlus: number; diMinus: number; sar: number; atr: number; obv: number; bollingerUpper: number; bollingerLower: number; trendDirection: string; trendAngle: number; trendR2: number; scenarios: Record<string, { name?: string; probability: number; targetMin: number; targetMax: number }>; resistanceStrengths: Array<{ price: number; strength: number; methods?: unknown[] }>; supportStrengths: Array<{ price: number; strength: number; methods?: unknown[] }>; };

  const trendLabel = trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی';
  const r2Pct = (trendR2 * 100).toFixed(1);
  const rsiSignal = rsi > 70 ? 'اشباع خرید شدید' : rsi > 60 ? 'اشباع خرید' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش' : 'اشباع فروش شدید';
  const stochSignal = stochK > 80 ? 'اشباع خرید' : stochK < 20 ? 'اشباع فروش' : stochK > stochD ? 'صعودی' : 'نزولی';
  const R1 = resistanceStrengths?.[0];
  const S1 = supportStrengths?.[0];
  const R1Price = R1?.price ?? Math.round(currentPrice * 1.05);
  const S1Price = S1?.price ?? Math.round(currentPrice * 0.95);
  const R1Grade = R1?.strength ? srGrade(R1.strength) : 'نامشخص';
  const S1Grade = S1?.strength ? srGrade(S1.strength) : 'نامشخص';

  const scenarioList = (['R1', 'R2', 'R3', 'R4', 'R5'] as const)
    .map((k, i) => ({
      label: `سناریوی ${toPersianNum(i + 1)}`,
      name: scenarios?.[k]?.name || getScenarioName(k),
      prob: scenarios?.[k]?.probability ?? 0,
      min: scenarios?.[k]?.targetMin ?? 0,
      max: scenarios?.[k]?.targetMax ?? 0,
    }))
    .sort((a, b) => b.prob - a.prob);

  const scenarioBlock = scenarioList
    .map(s => `${s.label} (${s.name}): ${toPersianNum(s.prob * 100)}% [${toPersianNum(s.min)}-${toPersianNum(s.max)}]`)
    .join('\n');
  const methodsStr = methods.map((m, i) => `${i + 1}. ${m}`).join('\n');

  return `تحلیل برای: ${symbolName}
مکتب: ${ml.school} | سبک: ${ml.style} | لحن: ${ml.tone}

--- داده‌های پایه ---
قیمت: ${toPersianNum(currentPrice)} ریال | روند: ${trendLabel} (${toPersianNum(Math.abs(trendAngle))}°, R²=${r2Pct}%)
MA21=${toPersianNum(ma21)} | MA100=${toPersianNum(ma100)} | ATR=${toPersianNum(atr)}
RSI=${toPersianNum(rsi)} (${rsiSignal}) | استوک=${toPersianNum(stochK)}/${toPersianNum(stochD)} (${stochSignal})
CCI=${toPersianNum(cci)} | ADX=${toPersianNum(adx)} | DI+=${toPersianNum(diPlus)} | DI-=${toPersianNum(diMinus)}
MACD: خط=${toPersianNum(macdLine)} سیگنال=${toPersianNum(macdSignal)} هیستو=${toPersianNum(macdHist)} | SAR=${toPersianNum(sar)}
باند: ${toPersianNum(bollingerUpper)} / ${toPersianNum(bollingerLower)} | OBV=${obv > 0 ? '+' : ''}${toPersianNum(obv)}
مقاومت R1: ${toPersianNum(R1Price)} (${R1Grade}) | حمایت S1: ${toPersianNum(S1Price)} (${S1Grade})

--- سناریوها (مرتب احتمال) ---
${scenarioBlock}

--- روش‌های ML ---
${methodsStr}

--- دستور ---
تحلیل چندلایه بنویس با 3 لایه: عملیاتی (جهت/ورود/SL/TP/R:R)، تحلیلی (دلایل تکنیکال)، روانشناسی.
در ابتدا عنوان: مکتب ${ml.school} با سبک ${ml.style}.
شامل درخت سناریو و تحلیل حساسیت باشد.
در انتها: روایت غالب (پررنگ) + خلاصه عملی (حداکثر 30 کلمه) + ترکیب انتخای.
قواعد: بدون ایموجی، فارسی با اعداد سه رقمی جدا، 800-1500 کلمه، حداقل 5 سوال/تعجب، حداقل 3 ارجاع به شاخص‌ها با عدد.`;
}

const SYSTEM_PROMPT = 'شما تحلیلگر ارشد بازارهای مالی ایرانی هستید. تحلیل شامل 3 لایه: عملیاتی، تحلیلی، روانشناسی. 800 تا 1500 کلمه. بدون ایموجی. فارسی. اعداد سه رقمی جدا.';

// ─── POST Handler ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.currentPrice) {
      return NextResponse.json({ error: 'currentPrice is required' }, { status: 400 });
    }

    const key = cacheKey(body);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      console.log(`[AI v5.1] Cache hit for ${body.symbolName}`);
      return NextResponse.json({ text: cached.text, ml: cached.ml, cached: true });
    }

    const mlInput = buildMLInput(body);
    const mlSelection = selectMLCombination(mlInput);
    const methods = selectMethods(mlInput);
    console.log(`[AI v5.1] ${body.symbolName}: school=${mlSelection.school}`);

    const userMessage = buildPrompt(body, mlSelection, methods);
    const content = await queueAI(userMessage, SYSTEM_PROMPT, 45_000);

    const result = {
      text: content,
      ml: { school: mlSelection.school, style: mlSelection.style, tone: mlSelection.tone, reasoning: mlSelection.reasoning, methods },
    };

    cache.set(key, { text: content, ml: result.ml, ts: Date.now() });
    for (const [k, v] of cache.entries()) {
      if (Date.now() - v.ts > CACHE_TTL) cache.delete(k);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[AI v5.1] error:', err);
    return NextResponse.json({ error: userFriendlyError(err), text: '' }, { status: 500 });
  }
}

function userFriendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('429')) return 'سرور هوشمند در حال حاضر شارژ دارد. لطفاً چند دقیقه دیگر تلاش کنید.';
  if (msg.includes('timeout') || msg.includes('زمان')) return 'زمان پاسخدهی هوشمند به پایان رسید. لطفاً باز تلاش کنید.';
  return 'خطایی در تولید تحلیل رخ داد. لطفاً دوباره تلاش کنید.';
}
