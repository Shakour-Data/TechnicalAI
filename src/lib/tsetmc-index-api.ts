// ═══════════════════════════════════════════════════════════════════
// TSETMC Index History API (finpy-tse data source)
//
// Uses z-ai-web-dev-sdk page_reader (rate-limited via zai-shared)
// to fetch from the SAME TSETMC endpoints that finpy-tse uses:
//   1. cdn.tsetmc.com/api/Index/GetIndexB2History/{web_id} → Adj Close
//   2. old.tsetmc.com/tsev2/chart/data/IndexFinancial.aspx?i={web_id}&t=ph → OHLCV
//
// Direct HTTP access blocked outside Iran → page_reader acts as proxy.
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
  volume: number;     // Trading volume of index constituents
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

function timestampToShamsi(ts: number): string {
  const d = new Date(ts);
  const gy = d.getUTCFullYear();
  const gm = d.getUTCMonth() + 1;
  const gd = d.getUTCDate();
  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════
// 1. B2 API — Adjusted Close + First Price (finpy-tse source #1)
//    URL: cdn.tsetmc.com/api/Index/GetIndexB2History/{web_id}
// ═══════════════════════════════════════════════════════════════════
async function fetchB2FromTsetmc(webIdStr: string): Promise<TsetmcB2Item[]> {
  const url = `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webIdStr}`;
  const html = await rateLimitedPageReader(url, 60_000);

  // Parse JSON from HTML <pre> tag (page_reader wraps content in HTML)
  const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
  let jsonStr: string;
  if (preMatch) {
    jsonStr = preMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  } else {
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
    return JSON.parse(arrStr) as TsetmcB2Item[];
  }

  // Fallback: try parsing the whole thing as JSON
  try {
    const parsed = JSON.parse(jsonStr);
    return parsed.indexB2 || [];
  } catch {
    throw new Error('Failed to parse TSETMC B2 response');
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. Financial Chart API — Full OHLCV (finpy-tse source #2)
//    URL: old.tsetmc.com/tsev2/chart/data/IndexFinancial.aspx?i={web_id}&t=ph
//    Returns: newline-separated rows, each: timestamp,open,high,low,close,volume
// ═══════════════════════════════════════════════════════════════════
interface FinancialRow {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchFinancialFromTsetmc(webIdStr: string): Promise<FinancialRow[]> {
  const url = `http://old.tsetmc.com/tsev2/chart/data/IndexFinancial.aspx?i=${webIdStr}&t=ph`;
  const html = await rateLimitedPageReader(url, 60_000);

  // Extract text content from HTML (page_reader wraps in HTML)
  const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
  let text: string;
  if (preMatch) {
    text = preMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
  } else {
    text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
  }

  // Parse: each line is "timestamp,open,high,low,close,volume"
  const rows: FinancialRow[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    const parts = trimmed.split(',');
    if (parts.length >= 6) {
      const ts = parseInt(parts[0]);
      const o = parseFloat(parts[1]);
      const h = parseFloat(parts[2]);
      const l = parseFloat(parts[3]);
      const c = parseFloat(parts[4]);
      const v = parseFloat(parts[5]);
      if (ts > 0 && c > 0) {
        rows.push({ timestamp: ts, open: o, high: h, low: l, close: c, volume: v });
      }
    }
  }

  return rows;
}

// ═══════════════════════════════════════════════════════════════════
// 3. Merge B2 (adj close) + Financial (OHLCV) into final candles
// ═══════════════════════════════════════════════════════════════════
function mergeData(
  b2Items: TsetmcB2Item[],
  finRows: FinancialRow[],
): IndexCandle[] {
  // Build a map of B2 data keyed by Shamsi date
  const b2Map = new Map<string, { adjClose: number; first: number; prev: number }>();
  for (const item of b2Items) {
    const close = item.xNivInuClMresIbs;
    if (close <= 0) continue;
    const dateStr = devenToShamsi(item.dEven);
    b2Map.set(dateStr, {
      adjClose: close,
      first: item.xNivInuPhMresIbs,
      prev: item.xNivInuPbMresIbs,
    });
  }

  // Build candles from Financial data (has OHLCV) and supplement with B2 adj close
  const candles: IndexCandle[] = [];
  const seen = new Set<string>();

  // First pass: Financial data (has proper OHLCV)
  for (const row of finRows) {
    const dateStr = timestampToShamsi(row.timestamp);
    if (seen.has(dateStr)) continue;
    seen.add(dateStr);

    const b2 = b2Map.get(dateStr);
    candles.push({
      date: dateStr,
      open: row.open > 0 ? row.open : (b2?.first || row.close),
      high: row.high > 0 ? row.high : Math.max(row.open, row.close),
      low: row.low > 0 ? row.low : Math.min(row.open, row.close),
      close: row.close,
      volume: row.volume || 0,
    });
  }

  // Second pass: B2-only dates (not in Financial data) — use close/first/prev
  for (const [dateStr, b2] of b2Map) {
    if (seen.has(dateStr)) continue;
    seen.add(dateStr);
    candles.push({
      date: dateStr,
      open: b2.first > 0 ? b2.first : b2.prev,
      high: Math.max(b2.first > 0 ? b2.first : b2.adjClose, b2.adjClose),
      low: Math.min(b2.first > 0 ? b2.first : b2.adjClose, b2.adjClose),
      close: b2.adjClose,
      volume: 0,
    });
  }

  // Sort by date ascending
  candles.sort((a, b) => a.date.localeCompare(b.date, 'fa'));
  return candles;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Fetch historical candle data for a main market index
 * Uses both TSETMC B2 API (adj close) and Financial API (OHLCV) —
 * same data sources as finpy-tse.
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

  let candles: IndexCandle[] = [];

  try {
    // Fetch both data sources in sequence (rate-limited)
    const [b2Items, finRows] = await Promise.all([
      fetchB2FromTsetmc(webIdStr).catch((e) => {
        console.warn(`[tsetmc-index] B2 fetch failed for ${key}:`, e.message);
        return [] as TsetmcB2Item[];
      }),
      fetchFinancialFromTsetmc(webIdStr).catch((e) => {
        console.warn(`[tsetmc-index] Financial fetch failed for ${key}:`, e.message);
        return [] as FinancialRow[];
      }),
    ]);

    if (b2Items.length > 0 || finRows.length > 0) {
      candles = mergeData(b2Items, finRows);
    }

    // Fallback: if Financial API failed, use B2-only data
    if (candles.length === 0 && b2Items.length > 0) {
      for (const item of b2Items) {
        const close = item.xNivInuClMresIbs;
        if (close <= 0) continue;
        const first = item.xNivInuPhMresIbs;
        const prev = item.xNivInuPbMresIbs;
        candles.push({
          date: devenToShamsi(item.dEven),
          open: first > 0 ? first : prev,
          high: Math.max(first > 0 ? first : close, close),
          low: Math.min(first > 0 ? first : close, close),
          close,
          volume: 0,
        });
      }
    }

    if (candles.length === 0) {
      throw new Error(`No data returned for index: ${key}`);
    }

    // Cache
    cache.set(cacheKey, { data: candles, timestamp: now });
    return candles;
  } catch (err) {
    if (candles.length > 0) {
      cache.set(cacheKey, { data: candles, timestamp: now });
      return candles;
    }
    throw err;
  }
}

/**
 * Fetch historical candle data for a sector/industry index
 * Uses both TSETMC B2 API (adj close) and Financial API (OHLCV) —
 * same data sources as finpy-tse.
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

  let candles: IndexCandle[] = [];

  try {
    // Fetch both data sources
    const [b2Items, finRows] = await Promise.all([
      fetchB2FromTsetmc(webIdStr).catch((e) => {
        console.warn(`[tsetmc-index] B2 fetch failed for sector ${webIdStr}:`, e.message);
        return [] as TsetmcB2Item[];
      }),
      fetchFinancialFromTsetmc(webIdStr).catch((e) => {
        console.warn(`[tsetmc-index] Financial fetch failed for sector ${webIdStr}:`, e.message);
        return [] as FinancialRow[];
      }),
    ]);

    if (b2Items.length > 0 || finRows.length > 0) {
      candles = mergeData(b2Items, finRows);
    }

    // Fallback: B2-only
    if (candles.length === 0 && b2Items.length > 0) {
      for (const item of b2Items) {
        const close = item.xNivInuClMresIbs;
        if (close <= 0) continue;
        const first = item.xNivInuPhMresIbs;
        const prev = item.xNivInuPbMresIbs;
        candles.push({
          date: devenToShamsi(item.dEven),
          open: first > 0 ? first : prev,
          high: Math.max(first > 0 ? first : close, close),
          low: Math.min(first > 0 ? first : close, close),
          close,
          volume: 0,
        });
      }
    }

    if (candles.length === 0) {
      throw new Error(`No data returned for sector web ID: ${webIdStr}`);
    }

    // Cache
    cache.set(cacheKey, { data: candles, timestamp: now });
    return candles;
  } catch (err) {
    if (candles.length > 0) {
      cache.set(cacheKey, { data: candles, timestamp: now });
      return candles;
    }
    throw err;
  }
}

/**
 * Clear the cache (useful for testing or forced refresh)
 */
export function clearIndexCache(): void {
  cache.clear();
}
