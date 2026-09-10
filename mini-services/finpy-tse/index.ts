/**
 * finpy-tse Mini Service — Historical TSE Index Data
 *
 * Uses Ollama page_reader to access cdn.tsetmc.com (Iran-only CDN)
 * Endpoint: cdn.tsetmc.com/api/Index/GetIndexB2History/{webId}
 * Jalali date conversion via jalaali-js
 *
 * Port: 3031
 */

import { ollamaPageReader } from '@/lib/ollama-client';
import { toJalaali } from 'jalaali-js';

// ═══════════════════════════════════════════════════════════════
// Web IDs from finpy-tse (https://github.com/ARahimiQuant/finpy-tse)
// ═══════════════════════════════════════════════════════════════

const INDEX_WEB_IDS: Record<string, string> = {
  CWI:   '32097828799138957',
  EWI:   '67130298613737946',
  CWPI:  '5798407779416661',
  EWPI:  '8384385859414435',
  FFI:   '49579049405614711',
  MKT1I: '62752761908615603',
  MKT2I: '71704845530629737',
  INDI:  '43754960038275285',
  LCI30: '10523825119011581',
  ACT50: '46342955726788357',
};

const SECTOR_WEB_IDS: [string, string][] = [
  ['زراعت',                    '34408080767216529'],
  ['ذغال سنگ',                 '19219679288446732'],
  ['کانی فلزی',                '13235969998952202'],
  ['سایر معادن',               '62691002126902464'],
  ['منسوجات',                  '59288237226302898'],
  ['محصولات چرمی',             '69306841376553334'],
  ['محصولات چوبی',             '58440550086834602'],
  ['محصولات کاغذی',            '30106839080444358'],
  ['انتشار و چاپ',             '25766336681098389'],
  ['فرآورده‌های نفتی',          '12331083953323969'],
  ['لاستیک',                   '36469751685735891'],
  ['فلزات اساسی',              '32453344048876642'],
  ['محصولات فلزی',             '1123534346391630'],
  ['ماشین آلات',               '11451389074113298'],
  ['دستگاه‌های برقی',          '33878047680249697'],
  ['وسایل ارتباطی',            '24733701189547084'],
  ['خودرو',                    '20213770409093165'],
  ['قند و شکر',                '21948907150049163'],
  ['چند رشته‌ای',              '40355846462826897'],
  ['تامین آب، برق و گاز',      '54843635503648458'],
  ['غذایی',                    '15508900928481581'],
  ['دارویی',                   '3615666621538524'],
  ['شیمیایی',                  '33626672012415176'],
  ['خرده فروشی',               '65986638607018835'],
  ['کاشی و سرامیک',            '57616105980228781'],
  ['سیمان',                    '70077233737515808'],
  ['کانی غیر فلزی',            '14651627750314021'],
  ['سرمایه‌گذاری',             '34295935482222451'],
  ['بانک',                     '72002976013856737'],
  ['سایر مالی',                '25163959460949732'],
  ['حمل و نقل',                '24187097921483699'],
  ['رادیویی',                  '41867092385281437'],
  ['مالی',                     '61247168213690670'],
  ['اداره بازارهای مالی',      '61985386521682984'],
  ['انبوه سازی',               '4654922806626448'],
  ['رایانه',                   '8900726085939949'],
  ['اطلاعات و ارتباطات',        '18780171241610744'],
  ['فنی مهندسی',               '47233872677452574'],
  ['استخراج نفت',              '65675836323214668'],
  ['بیمه و بازنشستگی',         '59105676994811497'],
];

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface TsetmcB2Entry {
  insCode: number;
  dEven: number;
  xNivInuClMresIbs: number;
  xNivInuPbMresIbs: number;
  xNivInuPhMresIbs: number;
}

interface IndexCandle {
  j_date: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close: number;
  volume: number;
  weekday?: string;
}

// ═══════════════════════════════════════════════════════════════
// Cache (in-memory, persistent across requests)
// ═══════════════════════════════════════════════════════════════

const candleCache = new Map<string, { data: IndexCandle[]; time: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ═══════════════════════════════════════════════════════════════
// Ollama Client (lazy init, shared across requests)
// ═══════════════════════════════════════════════════════════════

let ollamaInstance: Awaited<ReturnType<typeof import('@/lib/ollama-client').getOllama>> | null = null;
let ollamaInitPromise: Promise<Awaited<ReturnType<typeof import('@/lib/ollama-client').getOllama>> | null = null;

async function getOllama() {
  if (ollamaInstance) return ollamaInstance;
  if (!ollamaInitPromise) {
    console.log('[INFO] Initializing Ollama client...');
    ollamaInitPromise = import('@/lib/ollama-client').then((mod) => {
      const client = mod.getOllama();
      ollamaInstance = client;
      console.log('[INFO] Ollama client ready');
      return client;
    });
  }
  return ollamaInitPromise;
}

// ═══════════════════════════════════════════════════════════════
// Data Fetching — via z-ai SDK page_reader → cdn.tsetmc.com
// ═══════════════════════════════════════════════════════════════

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function parseB2Json(jsonStr: string): TsetmcB2Entry[] {
  let parsed: { indexB2: TsetmcB2Entry[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    const lastComplete = jsonStr.lastIndexOf('},{');
    if (lastComplete > 0) {
      const fixed = jsonStr.substring(0, lastComplete + 1) + ']}';
      parsed = JSON.parse(fixed);
    } else {
      throw new Error('Invalid JSON from CDN response');
    }
  }
  return parsed.indexB2 || [];
}

async function fetchCdnB2History(webId: string, maxRetries = 3): Promise<TsetmcB2Entry[]> {
  const url = `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[INFO] Fetching webId=${webId} (attempt ${attempt}/${maxRetries})...`);
      const result = await ollamaPageReader(url);
      const html: string = result.data?.html || '';

      if (!html || html.length < 10) {
        throw new Error('Empty response from page_reader');
      }

      const match = /<pre[^>]*>([\s\S]*?)<\/pre>/.exec(html);
      if (!match) {
        const trimmed = html.replace(/<[^>]+>/g, '').trim();
        if (trimmed.startsWith('{')) {
          return parseB2Json(trimmed);
        }
        throw new Error(`No <pre> block in response for webId ${webId}`);
      }

      console.log(`[INFO] Got HTML response, ${html.length} bytes, parsing JSON...`);
      const entries = parseB2Json(match[1].trim());
      console.log(`[INFO] Parsed ${entries.length} raw B2 entries`);
      return entries;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429');
      const isRetryable = is429 || msg.includes('timeout') || msg.includes('ECONNRESET');

      console.error(`[WARN] Attempt ${attempt} failed for webId=${webId}: ${msg}`);

      if (attempt < maxRetries && isRetryable) {
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
        console.log(`[INFO] Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      throw new Error(`Failed after ${maxRetries} attempts: ${msg}`);
    }
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════
// Data Processing (finpy-tse methodology + Jalali dates)
// ═══════════════════════════════════════════════════════════════

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function processIndexData(
  entries: TsetmcB2Entry[],
  options: { startDate?: string; endDate?: string; showWeekday?: boolean } = {}
): IndexCandle[] {
  const { startDate, endDate, showWeekday = false } = options;
  const candles: IndexCandle[] = [];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const dEven = String(e.dEven);
    if (dEven.length !== 8) continue;

    const gYear = parseInt(dEven.slice(0, 4));
    const gMonth = parseInt(dEven.slice(4, 6));
    const gDay = parseInt(dEven.slice(6, 8));

    const gDate = new Date(gYear, gMonth - 1, gDay);
    if (gDate.getFullYear() !== gYear || gDate.getMonth() !== gMonth - 1 || gDate.getDate() !== gDay) continue;

    const { jy, jm, jd } = toJalaali(gYear, gMonth, gDay);
    const jDateStr = `${pad2(jy)}-${pad2(jm)}-${pad2(jd)}`;

    if (startDate && jDateStr < startDate) continue;
    if (endDate && jDateStr > endDate) continue;

    const close = Number(e.xNivInuClMresIbs) || 0;
    const base = Number(e.xNivInuPbMresIbs) || 0;
    const high = Number(e.xNivInuPhMresIbs) || 0;
    if (close <= 0) continue;

    const prevClose = i > 0 ? (Number(entries[i - 1].xNivInuClMresIbs) || 0) : close;
    const open = i === 0 ? close : prevClose;
    const candleHigh = Math.max(high, close, open);
    const candleLow = Math.min(base > 0 ? base : close, close, open);

    const candle: IndexCandle = {
      j_date: jDateStr,
      date: `${pad2(gYear)}-${pad2(gMonth)}-${pad2(gDay)}`,
      open: Math.round(open * 100) / 100,
      high: Math.round(candleHigh * 100) / 100,
      low: Math.round(candleLow * 100) / 100,
      close: Math.round(close * 100) / 100,
      adj_close: Math.round(close * 100) / 100,
      volume: 0,
    };

    if (showWeekday) {
      candle.weekday = WEEKDAYS[gDate.getDay()];
    }

    candles.push(candle);
  }

  return candles;
}

// ═══════════════════════════════════════════════════════════════
// High-level: Get candles with caching
// ═══════════════════════════════════════════════════════════════

async function getIndexCandles(
  webId: string,
  options: { startDate?: string; endDate?: string; showWeekday?: boolean } = {}
): Promise<IndexCandle[]> {
  const now = Date.now();
  const cacheKey = `${webId}`;

  const cached = candleCache.get(cacheKey);
  if (cached && now - cached.time < CACHE_TTL) {
    console.log(`[INFO] Cache hit for webId=${webId}`);
    return cached.data;
  }

  const entries = await fetchCdnB2History(webId);
  const candles = processIndexData(entries, options);
  console.log(`[INFO] Processed ${candles.length} candles for webId=${webId}`);

  candleCache.set(cacheKey, { data: candles, time: Date.now() });
  return candles;
}

// ═══════════════════════════════════════════════════════════════
// HTTP Server (Bun)
// ═══════════════════════════════════════════════════════════════

const PORT = 3031;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 0), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
    }

    try {
      if (path === '/api/health') {
        return json({ status: 'ok', service: 'finpy-tse', version: '1.2.10', source: 'cdn.tsetmc.com (via z-ai SDK)', indices: Object.keys(INDEX_WEB_IDS), sectors: SECTOR_WEB_IDS.length });
      }

      if (path === '/api/sectors') {
        return json({ sectors: SECTOR_WEB_IDS.map(([name, web_id]) => ({ name, web_id })) });
      }

      if (path === '/api/indices') {
        return json({ indices: Object.entries(INDEX_WEB_IDS).map(([code, web_id]) => ({ code, web_id })) });
      }

      if (path === '/api/index-history') {
        const code = (url.searchParams.get('code') || '').toUpperCase();
        if (!code) return json({ error: 'code is required' }, 400);

        const startDate = url.searchParams.get('start_date') || undefined;
        const endDate = url.searchParams.get('end_date') || undefined;
        const showWeekday = url.searchParams.get('show_weekday') === 'true';

        let webId: string;

        if (code === 'SECTOR') {
          const sectorName = url.searchParams.get('sector') || '';
          if (!sectorName) return json({ error: 'sector parameter required' }, 400);
          const found = SECTOR_WEB_IDS.find(([name]) => name === sectorName);
          if (!found) return json({ error: `Sector '${sectorName}' not found` }, 400);
          webId = found[1];
        } else if (code in INDEX_WEB_IDS) {
          webId = INDEX_WEB_IDS[code];
        } else {
          return json({ error: `Unknown code: ${code}` }, 400);
        }

        const candles = await getIndexCandles(webId, { startDate, endDate, showWeekday });

        return json({ data: candles, count: candles.length, code, web_id: String(webId), source: 'finpy-tse / cdn.tsetmc.com' });
      }

      return json({ error: 'Not found' }, 404);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ERROR] ${msg}`);
      return json({ error: `Internal error: ${msg}` }, 500);
    }
  },
});

console.log(`finpy-tse service running on port ${PORT}`);
console.log(`Data source: cdn.tsetmc.com via z-ai SDK (finpy-tse methodology)`);
