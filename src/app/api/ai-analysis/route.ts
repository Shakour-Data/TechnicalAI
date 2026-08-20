import { NextRequest, NextResponse } from 'next/server';
import { getZai } from '@/lib/zai-shared';
import {
  selectMLCombination,
  selectMethods,
  getScenarioName,
  type MLSelectorInput,
} from '@/lib/analysis-ml-selector';

export const dynamic = 'force-dynamic';

// --- 1-hour in-memory cache ---
interface CacheEntry {
  text: string;
  ml: { school: string; style: string; tone: string; reasoning: string; methods: string[] };
  ts: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 3_600_000;

function cacheKey(body: Record<string, unknown>): string {
  const k = { v: 2, s: body.symbolName, p: body.currentPrice, t: body.trendDirection, r: body.rsi, a: body.adx };
  return JSON.stringify(k);
}

// --- Global rate limiter (serial queue) ---
let lastAITime = 0;
const AI_MIN_INTERVAL = 20_000;
let cooldownUntil = 0;
let activeCall = false;
const pendingQueue: Array<{
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  messages: { role: string; content: string }[];
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

  callZaiSDK(item.messages)
    .then(text => {
      lastAITime = Date.now();
      cooldownUntil = 0;
      item.resolve(text);
    })
    .catch(err => {
      const msg = err.message || '';
      if (msg.includes('429')) {
        const cd = Math.max(cooldownUntil - Date.now(), 0) + 90_000;
        cooldownUntil = Date.now() + Math.min(cd, 300_000);
        console.warn(`[AI v5.1] 429, cooldown ${Math.min(cd, 300_000) / 1000}s`);
      }
      item.reject(err);
    })
    .finally(() => {
      activeCall = false;
      setTimeout(processAIQueue, 2000);
    });
}

function queueAI(messages: { role: string; content: string }[], timeoutMs = 90_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = pendingQueue.findIndex(q => q.messages === messages);
      if (idx >= 0) pendingQueue.splice(idx, 1);
      reject(new Error('AI request timeout'));
    }, timeoutMs);

    pendingQueue.push({
      messages,
      resolve: (text) => { clearTimeout(timer); resolve(text); },
      reject: (err) => { clearTimeout(timer); reject(err); },
    });

    processAIQueue();
  });
}

// --- Z.ai SDK call with retry ---
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function jitter(base: number): number { return base + Math.random() * base * 0.5; }

async function callZaiSDK(messages: { role: string; content: string }[], maxRetries = 4): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const zai = await getZai();
      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      });
      const raw = completion.choices[0]?.message?.content;
      if (!raw || raw.trim().length === 0) {
        throw new Error('Empty AI response');
      }
      const text = raw.trim();
      if (text.length < 10) {
        throw new Error('AI response too short: ' + text.slice(0, 100));
      }
      return text;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') && attempt < maxRetries) {
        const waitMs = Math.round(jitter(20_000 * Math.pow(2, attempt - 1))); // 20s, 40s, 80s, 160s + jitter
        console.warn(`[AI v5.1] 429 retry ${attempt}/${maxRetries}, waiting ${Math.round(waitMs / 1000)}s...`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

// --- Helpers ---
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

// --- Build ML Selector Input ---
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

// --- Build Prompt ---
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

  const { school, style, tone } = mlSelection;
  const trendLabel = trendDirection === 'up' ? '\u0635\u0639\u0648\u062f\u06cc' : trendDirection === 'down' ? '\u0646\u0632\u0648\u0644\u06cc' : '\u062e\u0646\u062b\u06cc';
  const r2Pct = (trendR2 * 100).toFixed(1);
  const adxStrength = adx > 40 ? '\u0628\u0633\u06cc\u0627\u0631 \u0642\u0648\u06cc' : adx > 25 ? '\u0642\u0648\u06cc' : adx > 15 ? '\u0645\u062a\u0648\u0633\u0637' : '\u0636\u0639\u06cc\u0641';
  const rsiSignal = rsi > 70 ? '\u0627\u0634\u0628\u0627\u0639 \u062e\u0631\u06cc\u062f \u0634\u062f\u06cc\u062f' : rsi > 60 ? '\u0627\u0634\u0628\u0627\u0639 \u062e\u0631\u06cc\u062f' : rsi > 40 ? '\u062e\u0646\u062b\u06cc' : rsi > 30 ? '\u0627\u0634\u0628\u0627\u0639 \u0641\u0631\u0648\u0634' : '\u0627\u0634\u0628\u0627\u0639 \u0641\u0631\u0648\u0634 \u0634\u062f\u06cc\u062f';
  const stochSignal = stochK > 80 ? '\u0627\u0634\u0628\u0627\u0639 \u062e\u0631\u06cc\u062f' : stochK < 20 ? '\u0627\u0634\u0628\u0627\u0639 \u0641\u0631\u0648\u0634' : stochK > stochD ? '\u0635\u0639\u0648\u062f\u06cc' : '\u0646\u0632\u0648\u0644\u06cc';

  const bbRange = bollingerUpper - bollingerLower;
  const bbPos = bbRange > 0 ? Math.round((currentPrice - bollingerLower) / bbRange * 100) : 50;
  const bbSignal = currentPrice > bollingerUpper
    ? '\u0628\u0627\u0644\u0627\u06cc \u0628\u0627\u0646\u062f \u0628\u0627\u0644\u0627\u06cc\u06cc'
    : currentPrice < bollingerLower
    ? '\u0632\u06cc\u0631 \u0628\u0627\u0646\u062f \u067e\u0627\u06cc\u06cc\u0646\u06cc'
    : `\u062f\u0627\u062e\u0644 \u0628\u0627\u0646\u062f\u0647\u0627 (${toPersianNum(bbPos)}\u066a)`;

  const R1 = resistanceStrengths?.[0];
  const S1 = supportStrengths?.[0];
  const R1Price = R1?.price ?? Math.round(currentPrice * 1.05);
  const S1Price = S1?.price ?? Math.round(currentPrice * 0.95);
  const R1Grade = R1?.strength ? srGrade(R1.strength) : '\u0646\u0627\u0645\u0634\u062e\u0635';
  const S1Grade = S1?.strength ? srGrade(S1.strength) : '\u0646\u0627\u0645\u0634\u062e\u0635';
  const R1Confirm = R1?.methods?.length ? `(${toPersianNum(R1.methods.length)} \u0631\u0648\u0634 \u062a\u0623\u06cc\u06cc\u062f)` : '';
  const S1Confirm = S1?.methods?.length ? `(${toPersianNum(S1.methods.length)} \u0631\u0648\u0634 \u062a\u0623\u06cc\u06cc\u062f)` : '';

  const obvDesc = hasVolume
    ? (obv > 0
      ? `\u0645\u062b\u0628\u062a (+${(obv / 1e6).toFixed(1)}M) \u2014 \u062c\u0631\u06cc\u0627\u0646 \u0648\u0631\u0648\u062f \u067e\u0648\u0644`
      : `\u0645\u0646\u0641\u06cc (${(obv / 1e6).toFixed(1)}M) \u2014 \u062c\u0631\u06cc\u0627\u0646 \u062e\u0631\u0648\u062c \u067e\u0648\u0644`)
    : '\u0628\u062f\u0648\u0646 \u062f\u0627\u062f\u0647 \u062d\u062c\u0645';

  const macdDesc = macdHist > 0 && macdLine > macdSignal
    ? '\u0635\u0639\u0648\u062f\u06cc (\u062e\u0637 \u0628\u0627\u0644\u0627\u062a\u0631 \u0627\u0632 \u0633\u06cc\u06af\u0646\u0627\u0644)'
    : macdHist > 0
    ? '\u0635\u0639\u0648\u062f\u06cc \u0628\u0627 \u0647\u06cc\u0633\u062a\u0648\u06af\u0631\u0627\u0645 \u0645\u062b\u0628\u062a'
    : '\u0646\u0632\u0648\u0644\u06cc (\u0647\u06cc\u0633\u062a\u0648\u06af\u0631\u0627\u0645 \u0645\u0646\u0641\u06cc)';

  const diPressure = diPlus > diMinus ? '\u0641\u0634\u0627\u0631 \u062e\u0631\u06cc\u062f \u063a\u0627\u0644\u0628' : '\u0641\u0634\u0627\u0631 \u0641\u0631\u0648\u0634 \u063a\u0627\u0644\u0628';

  const methodsStr = methods.map((m, i) => `${i + 1}. ${m}`).join('\n');

  // Dynamic scenario list sorted by probability
  const scenarioList = (['R1', 'R2', 'R3', 'R4', 'R5'] as const)
    .map((k, i) => ({
      label: `\u0633\u0646\u0627\u0631\u06cc\u0648\u06cc ${toPersianNum(i + 1)}`,
      name: scenarios?.[k]?.name || getScenarioName(k),
      prob: scenarios?.[k]?.probability ?? 0,
      min: scenarios?.[k]?.targetMin ?? 0,
      max: scenarios?.[k]?.targetMax ?? 0,
    }))
    .sort((a, b) => b.prob - a.prob);

  const dominantScenario = scenarioList[0];
  const scenarioBlock = scenarioList
    .map(s => `- **${s.label} (${s.name}):** ${toPersianNum(s.prob * 100)} \u062f\u0631\u0635\u062f (\u0645\u062d\u062f\u0648\u062f\u0647 ${toPersianNum(s.min)} \u2014 ${toPersianNum(s.max)} \u0631\u06cc\u0627\u0644)`)
    .join('\n');

  return `
**\u062f\u0633\u062a\u0648\u0631\u0627\u0644\u0639\u0645\u0644:**
\u0634\u0645\u0627 \u06cc\u06a9 **\u062a\u062d\u0644\u06cc\u0644\u06af\u0631 \u0627\u0631\u0634\u062f \u0628\u0627\u0632\u0627\u0631\u0647\u0627\u06cc \u0645\u0627\u0644\u06cc \u0628\u0627 20 \u0633\u0627\u0644 \u062a\u062c\u0631\u0628\u0647** \u0647\u0633\u062a\u06cc\u062f.

\u0648\u0638\u06cc\u0641\u0647 \u0634\u0645\u0627 \u0627\u06cc\u0646 \u0627\u0633\u062a \u06a9\u0647 \u0628\u0631\u0627\u06cc **\u00ab${symbolName}\u00bb** \u062f\u0631 **\u062a\u0627\u06cc\u0645\u0641\u0631\u06cc\u0645 \u0631\u0648\u0632\u0627\u0646\u0647**\u060c \u06cc\u06a9 \u062a\u062d\u0644\u06cc\u0644 **\u0686\u0646\u062f\u0644\u0627\u06cc\u0647 \u0648 \u06a9\u0627\u0645\u0644\u0627\u064b \u0627\u0633\u062a\u062f\u0644\u0627\u0644\u06cc** \u0627\u0631\u0627\u0626\u0647 \u062f\u0647\u06cc\u062f.


---
**\u062f\u0627\u062f\u0647\u200c\u0647\u0627\u06cc \u067e\u0627\u06cc\u0647 (\u0648\u0627\u0642\u0639\u06cc \u0648 \u063a\u06cc\u0631\u0642\u0627\u0628\u0644 \u062a\u063a\u06cc\u06cc\u0631):**
- \u0646\u0627\u0645 \u0627\u0628\u0632\u0627\u0631: **${symbolName}**
- \u0642\u06cc\u0645\u062a \u0645\u0631\u062c\u0639: **${toPersianNum(currentPrice)} \u0631\u06cc\u0627\u0644**
- \u0631\u0648\u0646\u062f \u0645\u06cc\u0627\u0646\u200c\u0645\u062f\u062a: **${trendLabel}** (\u0632\u0627\u0648\u06cc\u0647 ${toPersianNum(Math.abs(trendAngle))}\u00b0\u060c R\u00b2=${r2Pct} \u062f\u0631\u0635\u062f)
- \u0645\u0648\u0642\u0639\u06cc\u062a \u0646\u0633\u0628\u062a \u0628\u0647 \u0645\u06cc\u0627\u0646\u06af\u06cc\u0646\u200c\u0647\u0627: ${currentPrice > ma21 ? '\u0628\u0627\u0644\u0627\u062a\u0631' : '\u067e\u0627\u06cc\u06cc\u0646\u200c\u062a\u0631'} \u0627\u0632 **MA21 (${toPersianNum(ma21)})** \u0648 ${currentPrice > ma100 ? '\u0628\u0627\u0644\u0627\u062a\u0631' : '\u067e\u0627\u06cc\u06cc\u0646\u200c\u062a\u0631'} \u0627\u0632 **MA100 (${toPersianNum(ma100)})**
- **ADX=${toPersianNum(adx)}** (${adxStrength})\u060c **DI+ (${toPersianNum(diPlus)}) ${diPlus > diMinus ? '>' : '<'} DI- (${toPersianNum(diMinus)})** \u2190 ${diPressure}
- **RSI=${toPersianNum(rsi)}** (${rsiSignal})\u060c **\u0627\u0633\u062a\u0648\u06a9\u0627\u0633\u062a\u06cc\u06a9=${toPersianNum(stochK)}/${toPersianNum(stochD)}** (${stochSignal})
- **CCI=${toPersianNum(cci)}**${mfi > 0 ? `\u060c **MFI=${toPersianNum(mfi)}**` : ''}
- **MACD** ${macdDesc} (\u062e\u0637=${toPersianNum(macdLine)}\u060c \u0633\u06cc\u06af\u0646\u0627\u0644=${toPersianNum(macdSignal)}\u060c \u0647\u06cc\u0633\u062a\u0648\u06af\u0631\u0627\u0645=${toPersianNum(macdHist)})
- **OBV** ${obvDesc}
- \u0642\u06cc\u0645\u062a **${bbSignal}** (\u0628\u0627\u0646\u062f \u0628\u0627\u0644\u0627\u06cc\u06cc ${toPersianNum(bollingerUpper)}\u060c \u0628\u0627\u0646\u062f \u067e\u0627\u06cc\u06cc\u0646\u06cc ${toPersianNum(bollingerLower)})
- **SAR (\u067e\u0627\u0631\u0627\u0628\u0648\u0644\u06cc\u06a9):** ${toPersianNum(sar)} \u0631\u06cc\u0627\u0644
- \u0645\u0642\u0627\u0648\u0645\u062a **R1** \u062f\u0631 ${toPersianNum(R1Price)} \u0631\u06cc\u0627\u0644 (${R1Grade} ${R1Confirm})
- \u062d\u0645\u0627\u06cc\u062a **S1** \u062f\u0631 ${toPersianNum(S1Price)} \u0631\u06cc\u0627\u0644 (${S1Grade} ${S1Confirm})
- \u0645\u06cc\u0627\u0646\u06af\u06cc\u0646 \u0646\u0648\u0633\u0627\u0646 \u0631\u0648\u0632\u0627\u0646\u0647 (ATR): ${toPersianNum(atr)} \u0631\u06cc\u0627\u0644

**\u0633\u0646\u0627\u0631\u06cc\u0648\u0647\u0627\u06cc \u067e\u0648\u06cc\u0627\u06cc \u0645\u062d\u062a\u0645\u0644 (\u0645\u0631\u062a\u0628\u200c\u0634\u062f\u0647 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0627\u062d\u062a\u0645\u0627\u0644):**
${scenarioBlock}

**روش‌های تحلیلی مورد استفاده:**
${methodsStr}


---
\u0628\u0631 \u0627\u0633\u0627\u0633 \u062f\u0627\u062f\u0647\u200c\u0647\u0627\u06cc \u0628\u0627\u0644\u0627\u060c \u06cc\u06a9 \u062a\u062d\u0644\u06cc\u0644 \u062c\u0627\u0645\u0639 \u0648 \u062d\u0631\u0641\u0647\u06cc \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f. \u062a\u062d\u0644\u06cc\u0644 \u0628\u0627\u06cc\u062f \u0645\u0633\u062a\u0642\u06cc\u0645 \u0634\u0631\u0648\u0639 \u0634\u0648\u062f \u0628\u062f\u0648\u0646 \u0647\u06cc\u0686 \u0633\u0631\u0641\u0635\u0644 \u06cc\u0627 \u0639\u0646\u0648\u0627\u0646 \u062f\u0627\u062e\u0644\u06cc. \u0641\u0642\u0637 \u067e\u0627\u0631\u0627\u06af\u0631\u0627\u0641\u200c\u0647\u0627\u06cc \u062a\u062d\u0644\u06cc\u0644\u06cc \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f.
`;
}

// System prompt (SDK uses role 'assistant' for system instructions)
const SYSTEM_PROMPT = `\u0634\u0645\u0627 \u06cc\u06a9 \u062a\u062d\u0644\u06cc\u0644\u06af\u0631 \u0627\u0631\u0634\u062f \u0628\u0627\u0632\u0627\u0631\u0647\u0627\u06cc \u0645\u0627\u0644\u06cc \u0627\u06cc\u0631\u0627\u0646\u06cc \u0647\u0633\u062a\u06cc\u062f.
\u06cc\u06a9 \u062a\u062d\u0644\u06cc\u0644 \u062d\u0631\u0641\u0647\u200c\u0627\u06cc \u0648 \u06a9\u0627\u0631\u0628\u0631\u062f\u06cc \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f.

\u0642\u0648\u0627\u0639\u062f \u062e\u0631\u0648\u062c\u06cc:
1. \u062d\u062f\u0627\u0642\u0644 800 \u06a9\u0644\u0645\u0647 \u0648 \u062d\u062f\u0627\u06a9\u062b\u0631 1,500 \u06a9\u0644\u0645\u0647.
2. \u062a\u0645\u0627\u0645 \u0627\u0639\u062f\u0627\u062f \u0628\u0647 \u0641\u0627\u0631\u0633\u06cc \u0648 \u0633\u0647 \u0631\u0642\u0645 \u0633\u0647 \u0631\u0642\u0645 \u062c\u062f\u0627 \u0634\u0648\u0646\u062f.
3. \u0627\u0632 \u0627\u06cc\u0645\u0648\u062c\u06cc\u200c\u0647\u0627\u06cc \u062a\u062d\u0644\u06cc\u0644\u06cc \u0645\u0646\u0627\u0633\u0628 \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u06a9\u0646\u06cc\u062f: \u{1F4CA} \u{1F4C8} \u{1F4C9} \u26a1 \u{1F511} \u26a0\ufe0f \u{1F3AF} \u2705 \u274c \u2753 \u{1F4A1} \u{1F534} \u{1F7E2}. \u0628\u06cc\u0634 \u0627\u0632 \u062d\u062f \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0646\u06a9\u0646\u06cc\u062f (\u062d\u062f\u0627\u06a9\u062b\u0631 6 \u062a\u0627 \u062f\u0631 \u06a9\u0644 \u0645\u062a\u0646).
4. \u0645\u062a\u0646 \u0634\u0627\u0645\u0644 3 \u062a\u0627 5 \u067e\u0627\u0631\u0627\u06af\u0631\u0627\u0641 \u0628\u0627\u0634\u062f. \u0647\u0631 \u067e\u0627\u0631\u0627\u06af\u0631\u0627\u0641 \u0628\u0644\u0646\u062f \u0648 \u0639\u0645\u06cc\u0642 (200 \u062a\u0627 500 \u06a9\u0644\u0645\u0647).
5. \u0645\u062a\u0646 \u06a9\u0627\u0645\u0644\u0627\u064b \u0628\u0647 \u0632\u0628\u0627\u0646 \u0641\u0627\u0631\u0633\u06cc \u0628\u0627\u0634\u062f.
6. \u062a\u062d\u0644\u06cc\u0644 3 \u0644\u0627\u06cc\u0647 \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u062f: \u0639\u0645\u0644\u06cc\u0627\u062a\u06cc (\u0628\u0631\u0627\u06cc \u0645\u0639\u0627\u0645\u0644\u06af\u0631), \u062a\u062d\u0644\u06cc\u0644\u06cc (\u0628\u0631\u0627\u06cc \u062a\u062d\u0644\u06cc\u0644\u06af\u0631), \u0631\u0648\u0627\u0646\u0634\u0646\u0627\u062e\u062a\u06cc (\u0628\u0631\u0627\u06cc \u0645\u062f\u06cc\u0631 \u0631\u06cc\u0633\u06a9).
7. \u0634\u0627\u0645\u0644 \u0633\u0646\u0627\u0631\u06cc\u0648\u06cc \u0645\u0639\u0627\u0645\u0644\u0627\u062a\u06cc \u06a9\u0627\u0645\u0644 \u0628\u0627\u0634\u062f: \u062c\u0647\u062a, \u0646\u0642\u0637\u0647 \u0648\u0631\u0648\u062f, \u062d\u062f \u0636\u0631\u0631, \u0627\u0647\u062f\u0627\u0641, \u0646\u0633\u0628\u062a \u0631\u06cc\u0633\u06a9/\u0631\u06cc\u0648\u0627\u0631\u062f.
8. \u0634\u0627\u0645\u0644 \u062f\u0631\u062e\u062a \u0633\u0646\u0627\u0631\u06cc\u0648\u06cc\u06cc \u0627\u0646\u0634\u0639\u0627\u0628\u06cc \u0648 \u062a\u062d\u0644\u06cc\u0644 \u062d\u0633\u0627\u0633\u06cc\u062a \u0628\u0627\u0634\u062f.
9. \u062d\u062f\u0627\u0642\u0644 5 \u0633\u0648\u0627\u0644 \u06cc\u0627 \u062a\u0639\u062c\u0628 \u062f\u0631 \u0645\u062a\u0646 \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u062f.
10. \u0647\u06cc\u0686 \u0627\u0634\u0627\u0631\u0647\u200c\u0627\u06cc \u0628\u0647 \u0645\u06a9\u062a\u0628, \u0633\u0628\u06a9, \u0644\u062d\u0646, \u0633\u06cc\u0633\u062a\u0645 \u0647\u0648\u0634\u0645\u0646\u062f, \u0631\u0648\u0634 ML \u06cc\u0627 \u0647\u0631 \u0627\u0635\u0637\u0644\u0627\u062d \u062f\u0627\u062e\u0644\u06cc \u0633\u06cc\u0633\u062a\u0645 \u0646\u0634\u0648\u062f.
11. \u062f\u0631 \u0627\u0628\u062a\u062f\u0627 \u06cc\u06a9 \u0639\u0646\u0648\u0627\u0646 \u0645\u062e\u062a\u0635\u0631 \u0648 \u062f\u0631 \u0627\u0646\u062a\u0647\u0627 \u062c\u0645\u0644\u0647 \u0631\u0648\u0627\u06cc\u062a \u063a\u0627\u0644\u0628 (\u067e\u0631\u0631\u0646\u06af) \u0648 \u062e\u0644\u0627\u0635\u0647 \u0639\u0645\u0644\u06cc (\u062d\u062f\u0627\u06a9\u062b\u0631 30 \u06a9\u0644\u0645\u0647) \u0628\u06cc\u0627\u0648\u0631\u06cc\u062f.
12. \u062f\u0631\u0635\u062f\u0647\u0627 \u0631\u0627 \u0628\u0647 \u0635\u0648\u0631\u062a \u06a9\u0627\u0645\u0644 \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f: \u0645\u062b\u0644\u0627\u064b \u00ab5 \u062f\u0631\u0635\u062f\u00bb \u0646\u0647 \u00ab5\u066a\u00bb.
13. \u0628\u0631\u0627\u06cc \u06a9\u0644\u0645\u0627\u062a \u0648 \u0639\u0628\u0627\u0631\u0627\u062a \u0645\u0647\u0645 \u0627\u0632 **\u0628\u0648\u0644\u062f** \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u06a9\u0646\u06cc\u062f (\u062d\u062f\u0627\u0642\u0644 8 \u0645\u0648\u0631\u062f \u0628\u0648\u0644\u062f \u062f\u0631 \u06a9\u0644 \u0645\u062a\u0646).
14. \u0647\u06cc\u0686 \u0633\u0631\u0641\u0635\u0644 \u06cc\u0627 \u0639\u0646\u0648\u0627\u0646 \u062f\u0627\u062e\u0644\u06cc \u0633\u06cc\u0633\u062a\u0645 (\u0645\u062b\u0644 \u0645\u0631\u062d\u0644\u0647, \u0641\u0627\u0632, \u062e\u0631\u0648\u062c\u06cc \u0633\u0647\u200c\u0644\u0627\u06cc\u0647 \u0648 \u063a\u06cc\u0631\u0647) \u062f\u0631 \u0645\u062a\u0646 \u0646\u0628\u0627\u0634\u062f. \u0645\u062a\u0646 \u0628\u0627\u06cc\u062f \u06cc\u06a9\u067e\u0627\u0631\u0686\u0647 \u0648 \u0631\u0648\u0627\u0646 \u0628\u0627\u0634\u062f.
15. \u0645\u062a\u0646 \u062e\u0631\u0648\u062c\u06cc \u0641\u0642\u0637 \u0648 \u0641\u0642\u0637 \u062a\u062d\u0644\u06cc\u0644 \u0628\u0627\u0634\u062f. \u0647\u06cc\u0686 \u062f\u0633\u062a\u0648\u0631\u0627\u0644\u0639\u0645\u0644, \u0633\u0627\u062e\u062a\u0627\u0631 \u06cc\u0627 \u0631\u0627\u0647\u0646\u0645\u0627\u06cc \u062f\u0627\u062e\u0644\u06cc \u062f\u0631 \u062e\u0631\u0648\u062c\u06cc \u0646\u06cc\u0627\u06cc\u062f.`;

// --- POST Handler ---
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.currentPrice) {
      return NextResponse.json({ error: 'currentPrice is required' }, { status: 400 });
    }

    // Check cache
    const key = cacheKey(body);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      console.log(`[AI v5.1] Cache hit for ${body.symbolName}`);
      return NextResponse.json({ text: cached.text, ml: cached.ml, cached: true });
    }

    // ML selection
    const mlInput = buildMLInput(body);
    const mlSelection = selectMLCombination(mlInput);
    const methods = selectMethods(mlInput);
    console.log(`[AI v5.1] ${body.symbolName}: school=${mlSelection.school}, style=${mlSelection.style}, tone=${mlSelection.tone}`);
    console.log(`[AI v5.1] Methods: ${methods.join(', ')}`);

    // Build prompt
    const userMessage = buildPrompt(body, mlSelection, methods);

    // Call AI via SDK (v3 approach with queue + retry)
    const content = await queueAI([
      { role: 'assistant', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ], 90_000);

    const result = {
      text: content,
      ml: { school: mlSelection.school, style: mlSelection.style, tone: mlSelection.tone, reasoning: mlSelection.reasoning, methods },
    };

    // Cache result
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
  if (msg.includes('429')) return '\u0633\u0631\u0648\u0631 \u0647\u0648\u0634\u0645\u0646\u062f \u062f\u0631 \u062d\u0627\u0644 \u062d\u0627\u0636\u0631 \u0634\u0627\u0631\u0698 \u062f\u0627\u0631\u062f. \u0644\u0637\u0641\u0627\u064b \u0686\u0646\u062f \u062f\u0642\u06cc\u0642\u0647 \u062f\u06cc\u06af\u0631 \u062a\u0644\u0627\u0634 \u06a9\u0646\u06cc\u062f.';
  if (msg.includes('timeout') || msg.includes('\u0632\u0645\u0627\u0646')) return '\u0632\u0645\u0627\u0646 \u067e\u0627\u0633\u062e\u062f\u0647\u06cc \u0647\u0648\u0634\u0645\u0646\u062f \u0628\u0647 \u067e\u0627\u06cc\u0627\u0646 \u0631\u0633\u06cc\u062f. \u0644\u0637\u0641\u0627\u064b \u0628\u0627\u0632 \u062a\u0644\u0627\u0634 \u06a9\u0646\u06cc\u062f.';
  return '\u062e\u0637\u0627\u06cc\u06cc \u062f\u0631 \u062a\u0648\u0644\u06cc\u062f \u062a\u062d\u0644\u06cc\u0644 \u0631\u062e \u062f\u0627\u062f. \u0644\u0637\u0641\u0627\u064b \u062f\u0648\u0628\u0627\u0631\u0647 \u062a\u0644\u0627\u0634 \u06a9\u0646\u06cc\u062f.';
}
