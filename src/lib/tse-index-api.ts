/**
 * TSE Index Data API — powered by finpy-tse methodology
 *
 * Historical data: z-ai SDK page_reader → cdn.tsetmc.com/api/Index/GetIndexB2History/{webId}
 *   → Jalali date conversion via jalaali-js
 *   → Web IDs from finpy-tse (https://github.com/ARahimiQuant/finpy-tse)
 *
 * Live data: BrsApi (Api.BrsApi.ir/Tsetmc)
 *
 * Reliability: The page_reader is the only path to cdn.tsetmc.com (not directly reachable
 * from this server). It occasionally crashes with OOM. The retry logic handles ALL transient
 * errors with exponential backoff, plus extra-long OOM recovery delays.
 */

import { toJalaali } from 'jalaali-js';
import { rateLimitedPageReader } from '@/lib/zai-shared';

// ═══════════════════════════════════════════════════════════════════════════
// Index Definitions (from finpy-tse)
// ═══════════════════════════════════════════════════════════════════════════

export interface TseIndexDef {
  name: string;
  webId: string;
  category: 'main' | 'sector';
  code: string;
}

/** 10 Major TSE Indices (from finpy-tse) */
export const MAIN_INDICES: TseIndexDef[] = [
  { name: 'شاخص کل',                   webId: '32097828799138957', category: 'main', code: 'CWI' },
  { name: 'شاخص کل (هم وزن)',         webId: '67130298613737946', category: 'main', code: 'EWI' },
  { name: 'شاخص قیمت (وزنی-ارزشی)',   webId: '5798407779416661',  category: 'main', code: 'CWPI' },
  { name: 'شاخص قیمت (هم وزن)',       webId: '8384385859414435',  category: 'main', code: 'EWPI' },
  { name: 'شاخص آزاد شناور',          webId: '49579049405614711', category: 'main', code: 'FFI' },
  { name: 'شاخص بازار اول',            webId: '62752761908615603', category: 'main', code: 'MKT1I' },
  { name: 'شاخص بازار دوم',            webId: '71704845530629737', category: 'main', code: 'MKT2I' },
  { name: 'شاخص صنعت',                webId: '43754960038275285', category: 'main', code: 'INDI' },
  { name: 'شاخص ۳۰ شرکت بزرگ',         webId: '10523825119011581', category: 'main', code: 'LCI30' },
  { name: 'شاخص ۵۰ شرکت فعال‌تر',      webId: '46342955726788357', category: 'main', code: 'ACT50' },
];

/** 40 Industry/Sector Indices (from finpy-tse __Get_TSE_Sector_WebID__) */
export const SECTOR_INDICES: TseIndexDef[] = [
  { name: 'شاخص گروه زراعت',              webId: '34408080767216529', category: 'sector', code: 'AGRI' },
  { name: 'شاخص گروه ذغال سنگ',           webId: '19219679288446732', category: 'sector', code: 'COAL' },
  { name: 'شاخص گروه کانی فلزی',          webId: '13235969998952202', category: 'sector', code: 'METAL_ORE' },
  { name: 'شاخص گروه سایر معادن',         webId: '62691002126902464', category: 'sector', code: 'OTHER_MINE' },
  { name: 'شاخص گروه منسوجات',            webId: '59288237226302898', category: 'sector', code: 'TEXTILE' },
  { name: 'شاخص گروه محصولات چرمی',       webId: '69306841376553334', category: 'sector', code: 'LEATHER' },
  { name: 'شاخص گروه محصولات چوبی',       webId: '58440550086834602', category: 'sector', code: 'WOOD' },
  { name: 'شاخص گروه محصولات کاغذی',      webId: '30106839080444358', category: 'sector', code: 'PAPER' },
  { name: 'شاخص گروه انتشار و چاپ',       webId: '25766336681098389', category: 'sector', code: 'PUBLISH' },
  { name: 'شاخص گروه فرآورده‌های نفتی',    webId: '12331083953323969', category: 'sector', code: 'PETRO' },
  { name: 'شاخص گروه لاستیک',             webId: '36469751685735891', category: 'sector', code: 'RUBBER' },
  { name: 'شاخص گروه فلزات اساسی',        webId: '32453344048876642', category: 'sector', code: 'BASE_METAL' },
  { name: 'شاخص گروه محصولات فلزی',       webId: '1123534346391630',  category: 'sector', code: 'METAL_PROD' },
  { name: 'شاخص گروه ماشین آلات',          webId: '11451389074113298', category: 'sector', code: 'MACHINERY' },
  { name: 'شاخص گروه دستگاه‌های برقی',    webId: '33878047680249697', category: 'sector', code: 'ELECTRIC' },
  { name: 'شاخص گروه وسایل ارتباطی',      webId: '24733701189547084', category: 'sector', code: 'TELECOM' },
  { name: 'شاخص گروه خودرو',              webId: '20213770409093165', category: 'sector', code: 'AUTO' },
  { name: 'شاخص گروه قند و شکر',          webId: '21948907150049163', category: 'sector', code: 'SUGAR' },
  { name: 'شاخص گروه چند رشته‌ای',        webId: '40355846462826897', category: 'sector', code: 'MULTI' },
  { name: 'شاخص گروه تامین آب، برق و گاز', webId: '54843635503648458', category: 'sector', code: 'UTILITY' },
  { name: 'شاخص گروه غذایی',              webId: '15508900928481581', category: 'sector', code: 'FOOD' },
  { name: 'شاخص گروه دارویی',             webId: '3615666621538524',  category: 'sector', code: 'PHARMA' },
  { name: 'شاخص گروه شیمیایی',            webId: '33626672012415176', category: 'sector', code: 'CHEMICAL' },
  { name: 'شاخص گروه خرده فروشی',         webId: '65986638607018835', category: 'sector', code: 'RETAIL' },
  { name: 'شاخص گروه کاشی و سرامیک',      webId: '57616105980228781', category: 'sector', code: 'CERAMIC' },
  { name: 'شاخص گروه سیمان',              webId: '70077233737515808', category: 'sector', code: 'CEMENT' },
  { name: 'شاخص گروه کانی غیر فلزی',      webId: '14651627750314021', category: 'sector', code: 'NONMETAL' },
  { name: 'شاخص گروه سرمایه‌گذاری',       webId: '34295935482222451', category: 'sector', code: 'INVEST' },
  { name: 'شاخص گروه بانک',               webId: '72002976013856737', category: 'sector', code: 'BANK' },
  { name: 'شاخص گروه سایر مالی',          webId: '25163959460949732', category: 'sector', code: 'OTHER_FIN' },
  { name: 'شاخص گروه حمل و نقل',          webId: '24187097921483699', category: 'sector', code: 'TRANSPORT' },
  { name: 'شاخص گروه رادیویی',            webId: '41867092385281437', category: 'sector', code: 'RADIO' },
  { name: 'شاخص گروه مالی',               webId: '61247168213690670', category: 'sector', code: 'FINANCE' },
  { name: 'شاخص گروه اداره بازارهای مالی', webId: '61985386521682984', category: 'sector', code: 'EXCHANGE' },
  { name: 'شاخص گروه انبوه سازی',          webId: '4654922806626448',  category: 'sector', code: 'REALEST' },
  { name: 'شاخص گروه رایانه',              webId: '8900726085939949',  category: 'sector', code: 'IT' },
  { name: 'شاخص گروه اطلاعات و ارتباطات', webId: '18780171241610744', category: 'sector', code: 'ICT' },
  { name: 'شاخص گروه فنی مهندسی',          webId: '47233872677452574', category: 'sector', code: 'ENGR' },
  { name: 'شاخص گروه استخراج نفت',         webId: '65675836323214668', category: 'sector', code: 'OIL_EXTRACT' },
  { name: 'شاخص گروه بیمه و بازنشستگی',   webId: '59105676994811497', category: 'sector', code: 'INSURANCE' },
];

export const ALL_INDICES: TseIndexDef[] = [...MAIN_INDICES, ...SECTOR_INDICES];

const webIdMap = new Map<string, TseIndexDef>();
for (const idx of ALL_INDICES) webIdMap.set(idx.webId, idx);

const nameMap = new Map<string, TseIndexDef>();
for (const idx of ALL_INDICES) nameMap.set(idx.name, idx);

export function getIndexByWebId(webId: string): TseIndexDef | undefined {
  return webIdMap.get(webId);
}

export function getIndexByName(name: string): TseIndexDef | undefined {
  return nameMap.get(name);
}

// ═══════════════════════════════════════════════════════════════════════════
// Data Types
// ═══════════════════════════════════════════════════════════════════════════

export interface IndexCandle {
  date: string;     // YYYY-MM-DD (Gregorian)
  j_date?: string;  // YYYY-MM-DD (Jalali/Shamsi) — from finpy-tse
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cache (server-side, in-process)
// ═══════════════════════════════════════════════════════════════════════════

const indexCache = new Map<string, { data: IndexCandle[]; time: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/** Negative cache — prevents rapid retries of persistently failing indices */
const negativeCache = new Map<string, { time: number; failCount: number }>();
const NEGATIVE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const NEGATIVE_CACHE_MAX_FAILS = 3; // After 3 consecutive failures, stop retrying for TTL

// ═══════════════════════════════════════════════════════════════════════════
// Raw CDN Data Types
// ═══════════════════════════════════════════════════════════════════════════

interface TsetmcB2Entry {
  insCode: number;
  dEven: number;
  xNivInuClMresIbs: number;
  xNivInuPbMresIbs: number;
  xNivInuPhMresIbs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Data Fetching — z-ai SDK → cdn.tsetmc.com (finpy-tse methodology)
// ═══════════════════════════════════════════════════════════════════════════

function parseB2Json(jsonStr: string): TsetmcB2Entry[] {
  let parsed: { indexB2: TsetmcB2Entry[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // JSON is truncated (common with page_reader for large responses)
    // Find the last complete '}' and repair
    let repaired = jsonStr.trim();
    const lastBrace = repaired.lastIndexOf('}');
    if (lastBrace > 0) {
      repaired = repaired.substring(0, lastBrace + 1);
      // Remove trailing comma and close arrays
      repaired = repaired.replace(/,\s*$/, '') + ']}';
      try {
        parsed = JSON.parse(repaired);
      } catch {
        // If still failing, try removing last entry
        const lastComplete = repaired.lastIndexOf('},{');
        if (lastComplete > 0) {
          repaired = repaired.substring(0, lastComplete + 1) + ']}';
          parsed = JSON.parse(repaired);
        } else {
          throw new Error('Cannot repair truncated JSON');
        }
      }
    } else {
      throw new Error('Invalid JSON from CDN response');
    }
  }
  return parsed.indexB2 || [];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Detect if an error is an OOM/crash from the remote page_reader process.
 * These need extra-long recovery delays.
 */
function isOomError(msg: string): boolean {
  return (
    msg.includes('502') ||
    msg.includes('maxMemory') ||
    msg.includes('Process exited') ||
    msg.includes('OOM') ||
    msg.includes('Memory')
  );
}

/**
 * Fetch B2 history from cdn.tsetmc.com via z-ai SDK page_reader.
 *
 * Key reliability improvements:
 * 1. Retries on ALL non-429 errors (not just timeout/Empty)
 * 2. Extra-long delays after OOM/crash errors (15-30s for process recovery)
 * 3. 5 retries with exponential backoff
 * 4. Negative cache prevents hammering persistently failing indices
 */
async function fetchCdnB2History(webId: string): Promise<TsetmcB2Entry[]> {
  const url = `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}`;
  const maxRetries = 5;
  const PAGE_READER_TIMEOUT = 60_000; // 60s — reduced from 180s to limit memory pressure

  // Check negative cache — if this webId has failed 3+ times recently, skip immediately
  const neg = negativeCache.get(webId);
  if (neg) {
    const age = Date.now() - neg.time;
    if (age < NEGATIVE_CACHE_TTL && neg.failCount >= NEGATIVE_CACHE_MAX_FAILS) {
      throw new Error(
        `Index temporarily unavailable (failed ${neg.failCount} times recently). Try again in ${Math.ceil((NEGATIVE_CACHE_TTL - age) / 60000)} minutes.`
      );
    }
    // TTL expired, reset
    negativeCache.delete(webId);
  }

  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`[tse-index-api] Fetching webId=${webId} (attempt ${attempt}/${maxRetries + 1})...`);
      const html = await rateLimitedPageReader(url, PAGE_READER_TIMEOUT);

      // Extract JSON from <pre> block (browser wraps raw JSON in <pre>)
      const match = /<pre[^>]*>([\s\S]*?)<\/pre>/.exec(html);
      if (!match) {
        const trimmed = html.replace(/<[^>]+>/g, '').trim();
        if (trimmed.startsWith('{')) {
          return parseB2Json(trimmed);
        }
        throw new Error(`No <pre> block in response for webId ${webId}`);
      }

      console.log(`[tse-index-api] Got ${html.length} bytes, parsing JSON...`);
      const entries = parseB2Json(match[1].trim());
      console.log(`[tse-index-api] Parsed ${entries.length} raw B2 entries`);

      // Success — clear negative cache
      negativeCache.delete(webId);
      return entries;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      const is429 = msg.includes('429');
      const isOom = isOomError(msg);

      console.warn(`[tse-index-api] Attempt ${attempt} failed for webId=${webId}: ${msg.slice(0, 120)}`);

      // Don't retry 429 (handled by zai-shared global cooldown)
      if (is429 || attempt > maxRetries) {
        break;
      }

      // Calculate delay — extra long for OOM/crash errors
      let delay: number;
      if (isOom) {
        // OOM crash: give the remote process 15-30s to recover
        delay = 15_000 + Math.random() * 15_000;
        console.log(`[tse-index-api] OOM/crash detected, waiting ${Math.round(delay / 1000)}s for process recovery...`);
      } else {
        // Standard exponential backoff: 5s, 10s, 15s, 20s, 25s
        delay = Math.min(5000 * attempt, 25_000);
        console.log(`[tse-index-api] Retrying in ${delay}ms...`);
      }

      await sleep(delay);
    }
  }

  // All retries exhausted — update negative cache
  const existing = negativeCache.get(webId);
  negativeCache.set(webId, {
    time: Date.now(),
    failCount: (existing?.failCount || 0) + 1,
  });

  throw new Error(`Failed to fetch index data: ${lastError}`);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function processB2Entries(entries: TsetmcB2Entry[]): IndexCandle[] {
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

    const close = Number(e.xNivInuClMresIbs) || 0;
    const base = Number(e.xNivInuPbMresIbs) || 0;
    const high = Number(e.xNivInuPhMresIbs) || 0;
    if (close <= 0) continue;

    const prevClose = i > 0 ? (Number(entries[i - 1].xNivInuClMresIbs) || 0) : close;
    const open = i === 0 ? close : prevClose;
    const candleHigh = Math.max(high, close, open);
    const candleLow = Math.min(base > 0 ? base : close, close, open);

    candles.push({
      date: `${pad2(gYear)}-${pad2(gMonth)}-${pad2(gDay)}`,
      j_date: jDateStr,
      open: Math.round(open * 100) / 100,
      high: Math.round(candleHigh * 100) / 100,
      low: Math.round(candleLow * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: 0,
    });
  }

  return candles;
}

/**
 * Fetch historical index data.
 * Uses z-ai SDK page_reader → cdn.tsetmc.com (finpy-tse methodology)
 * Returns chronological OHLCV candles with Jalali dates.
 */
export async function fetchIndexHistory(
  webId: string,
): Promise<IndexCandle[]> {
  const now = Date.now();
  const cached = indexCache.get(webId);
  if (cached && now - cached.time < CACHE_TTL) {
    console.log(`[tse-index-api] Cache hit for webId=${webId}`);
    return cached.data;
  }

  const entries = await fetchCdnB2History(webId);
  const candles = processB2Entries(entries);
  console.log(`[tse-index-api] Processed ${candles.length} candles for webId=${webId}`);

  if (candles.length > 0) {
    indexCache.set(webId, { data: candles, time: now });
  }

  return candles;
}

// ═══════════════════════════════════════════════════════════════
// Live Data — BrsApi
// ═══════════════════════════════════════════════════════════════

export async function fetchMainIndicesLive(): Promise<{
  name: string;
  index: number;
  change: number;
  changePercent: number;
  min: number;
  max: number;
}[]> {
  const API_KEY = 'BA9C8JBliDmfPapn9WYTX76uR5Q3m2r3';
  const BASE_URL = 'https://Api.BrsApi.ir/Tsetmc';
  const res = await fetch(`${BASE_URL}/Index.php?key=${API_KEY}&type=3`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) return [];
  const text = await res.text();
  try {
    const raw: Array<{name: string; index: number; index_change: number; index_change_percent: number; min: number; max: number}> = JSON.parse(text);
    return raw.map((r) => ({
      name: r.name,
      index: r.index,
      change: r.index_change,
      changePercent: r.index_change_percent,
      min: r.min,
      max: r.max,
    }));
  } catch {
    return [];
  }
}
