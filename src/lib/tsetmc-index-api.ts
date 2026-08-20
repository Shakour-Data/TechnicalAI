// ═══════════════════════════════════════════════════════════════════
// TSETMC Index History API
// Uses z-ai-web-dev-sdk page_reader (rate-limited via zai-shared)
// to fetch from cdn.tsetmc.com (direct HTTP access blocked outside Iran)
//
// IMPORTANT: All TSETMC webIds exceed Number.MAX_SAFE_INTEGER (17 digits)
// so they MUST be stored and passed as STRINGS to avoid precision loss.
// ═══════════════════════════════════════════════════════════════════

import { rateLimitedPageReader } from '@/lib/zai-shared';
import { gregorianToJalali } from '@/lib/jalali';

// ── Web IDs for main market indices (STRINGS to avoid precision loss) ─
export const INDEX_WEB_IDS: Record<string, string> = {
  CWI:   '32097828799138957',  // شاخص کل
  EWI:   '67130298613737946',  // شاخص کل هم‌وزن
  CWPI:  '5798407779416661',   // شاخص قیمت وزنی-ارزشی
  EWPI:  '8384385859414435',   // شاخص قیمت هم‌وزن
  FFI:   '49579049405614711',  // شاخص سهام آزاد شناور
  MKT1I: '62752761908615603',  // شاخص بازار اول
  MKT2I: '71704845530629737',  // شاخص بازار دوم
  INDI:  '43754960038275285',  // شاخص صنعت
  ACT50: '46342955726788357',  // شاخص ۵۰ شرکت فعال‌تر
  LCI30: '10523825119011581',  // شاخص ۳۰ شرکت بزرگ
};

// ── In-memory cache ──────────────────────────────────────────────
interface CacheEntry {
  data: IndexCandle[];
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ── Types ─────────────────────────────────────────────────────────
export interface IndexCandle {
  date: string;       // Shamsi: "1404/06/27"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;     // 0 for indices (not available from B2 API)
}

interface TsetmcB2Item {
  insCode: string;
  dEven: number;           // Gregorian date: 20260818
  xNivInuClMresIbs: number; // Adjusted Close
  xNivInuPbMresIbs: number; // Previous Day Close
  xNivInuPhMresIbs: number; // First price of day
}

// ── Date conversion ──────────────────────────────────────────────
function devenToShamsi(deven: number): string {
  const s = String(deven);
  if (s.length < 8) return s;
  const gy = parseInt(s.slice(0, 4));
  const gm = parseInt(s.slice(4, 6));
  const gd = parseInt(s.slice(6, 8));
  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

// ── Core fetch function using rate-limited page_reader ─────────────
async function fetchB2FromTsetmc(webIdStr: string): Promise<TsetmcB2Item[]> {
  const url = `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webIdStr}`;

  const html = await rateLimitedPageReader(url, 60_000);

  // Parse JSON from HTML <pre> tag (page_reader wraps content in HTML)
  const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);

  let jsonStr: string;
  if (preMatch) {
    jsonStr = preMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  } else {
    // Try parsing directly
    jsonStr = html.replace(/<[^>]+>/g, '').trim();
  }

  // Handle truncated JSON — find last complete `]`
  const lastBracket = jsonStr.lastIndexOf(']');
  if (lastBracket > 0) {
    jsonStr = jsonStr.substring(0, lastBracket + 1);
  }

  // Try to find the indexB2 array
  const b2Match = jsonStr.match(/"indexB2"\s*:\s*/);
  if (b2Match) {
    const start = b2Match.index! + b2Match[0].length;
    // Find the matching closing bracket
    let depth = 0;
    let end = start;
    for (let i = start; i < jsonStr.length; i++) {
      if (jsonStr[i] === '[') depth++;
      else if (jsonStr[i] === ']') {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }
    const arrStr = jsonStr.substring(start, end);
    const items: TsetmcB2Item[] = JSON.parse(arrStr);
    return items;
  }

  // Fallback: try parsing the whole thing as JSON
  try {
    const parsed = JSON.parse(jsonStr);
    return parsed.indexB2 || [];
  } catch {
    throw new Error('Failed to parse TSETMC response');
  }
}

// ── Build OHLC candles from B2 data ─────────────────────────────
function buildCandles(b2Items: TsetmcB2Item[]): IndexCandle[] {
  const candles: IndexCandle[] = [];

  for (const item of b2Items) {
    const close = item.xNivInuClMresIbs;
    const first = item.xNivInuPhMresIbs;
    const prevClose = item.xNivInuPbMresIbs;

    if (close <= 0) continue;

    candles.push({
      date: devenToShamsi(item.dEven),
      open: first > 0 ? first : prevClose,
      high: Math.max(first > 0 ? first : close, close),
      low: Math.min(first > 0 ? first : close, close),
      close,
      volume: 0,
    });
  }

  return candles;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Fetch historical candle data for a main market index
 * @param indexKey - One of: CWI, EWI, CWPI, EWPI, FFI, MKT1I, MKT2I, INDI, ACT50, LCI30
 * @returns Array of candles sorted oldest first
 */
export async function fetchMainIndexHistory(indexKey: string): Promise<IndexCandle[]> {
  const key = indexKey.toUpperCase();
  const webIdStr = INDEX_WEB_IDS[key];
  if (!webIdStr) {
    throw new Error(`Unknown index key: ${key}`);
  }

  // Check cache
  const cacheKey = `idx_${key}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Fetch from TSETMC via rate-limited page_reader
  const b2Items = await fetchB2FromTsetmc(webIdStr);
  if (!b2Items || b2Items.length === 0) {
    throw new Error(`No data returned for index: ${key}`);
  }

  const candles = buildCandles(b2Items);

  // Cache
  cache.set(cacheKey, { data: candles, timestamp: now });

  return candles;
}

/**
 * Fetch historical candle data for a sector/industry index
 * @param webIdStr - The TSETMC web ID (as string to avoid precision loss)
 * @returns Array of candles sorted oldest first
 */
export async function fetchSectorIndexHistory(webIdStr: string): Promise<IndexCandle[]> {
  // Check cache
  const cacheKey = `sec_${webIdStr}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Fetch from TSETMC via rate-limited page_reader
  const b2Items = await fetchB2FromTsetmc(webIdStr);
  if (!b2Items || b2Items.length === 0) {
    throw new Error(`No data returned for sector web ID: ${webIdStr}`);
  }

  const candles = buildCandles(b2Items);

  // Cache
  cache.set(cacheKey, { data: candles, timestamp: now });

  return candles;
}

/**
 * Clear the cache (useful for testing or forced refresh)
 */
export function clearIndexCache(): void {
  cache.clear();
}
