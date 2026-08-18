// ═══════════════════════════════════════════════════════════════════
// TSETMC Index History API
// Uses z-ai-web-dev-sdk page_reader to fetch from cdn.tsetmc.com
// (direct HTTP access to TSETMC is blocked outside Iran)
// ═══════════════════════════════════════════════════════════════════

import ZAI from 'z-ai-web-dev-sdk';
import { gregorianToJalali } from '@/lib/jalali';

// ── Web IDs for main market indices (from finpy-tse source) ───────
export const INDEX_WEB_IDS: Record<string, number> = {
  CWI:   32097828799138957,   // شاخص کل
  EWI:   67130298613737946,   // شاخص کل هم‌وزن
  CWPI:  5798407779416661,    // شاخص قیمت وزنی-ارزشی
  EWPI:  8384385859414435,    // شاخص قیمت هم‌وزن
  FFI:   49579049405614711,   // شاخص سهام آزاد شناور
  MKT1I: 62752761908615603,   // شاخص بازار اول
  MKT2I: 71704845530629737,   // شاخص بازار دوم
  INDI:  43754960038275285,   // شاخص صنعت
  ACT50: 46342955726788357,   // شاخص ۵۰ شرکت فعال‌تر
  LCI30: 10523825119011581,   // شاخص ۳۰ شرکت بزرگ
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
  insCode: number;
  dEven: number;           // Gregorian date: 20260818
  xNivInuClMresIbs: number; // Adjusted Close
  xNivInuPbMresIbs: number; // Previous Day Close
  xNivInuPhMresIbs: number; // First price of day
}

// ── Singleton ZAI instance ───────────────────────────────────────
let zaiInstance: ZAI | null = null;
async function getZai(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
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

// ── Core fetch function ──────────────────────────────────────────
async function fetchB2FromTsetmc(webId: number): Promise<TsetmcB2Item[]> {
  const url = `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}`;
  const zai = await getZai();

  const result = await zai.functions.invoke('page_reader', { url });

  console.log(`[tsetmc-index-api] page_reader result: code=${result.code}, hasData=${!!result.data}, dataType=${typeof result.data}, htmlLen=${result.data?.html?.length ?? 'N/A'}`);
  console.log(`[tsetmc-index-api] HTML preview: ${String(result.data?.html ?? '').substring(0, 500)}`);

  if (result.code !== 200 || !result.data?.html) {
    throw new Error(`TSETMC API returned status ${result.code}`);
  }

  // Parse JSON from HTML <pre> tag (page_reader wraps content in HTML)
  const html = result.data.html as string;
  const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
  console.log(`[tsetmc-index-api] preMatch found: ${!!preMatch}, html length: ${html.length}`);
  
  if (!preMatch) {
    // Try parsing directly (some responses might not be wrapped)
    try {
      const parsed = JSON.parse(html);
      return parsed.indexB2 || [];
    } catch {
      throw new Error('Failed to parse TSETMC response');
    }
  }

  const jsonStr = preMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const parsed = JSON.parse(jsonStr);
  const items = parsed.indexB2 || [];
  console.log(`[tsetmc-index-api] Parsed ${items.length} items from TSETMC`);
  return items;
}

// ── Build OHLC candles from B2 data ─────────────────────────────
// B2 provides: Close, PreviousClose, First
// We derive: Open=First, High=max(First,Close), Low=min(First,Close), Close
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
  const webId = INDEX_WEB_IDS[key];
  if (!webId) {
    throw new Error(`Unknown index key: ${key}`);
  }

  // Check cache
  const cacheKey = `idx_${key}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Fetch from TSETMC via z-ai-web-dev-sdk
  const b2Items = await fetchB2FromTsetmc(webId);
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
 * @param webId - The TSETMC web ID for the sector
 * @returns Array of candles sorted oldest first
 */
export async function fetchSectorIndexHistory(webId: number): Promise<IndexCandle[]> {
  // Check cache
  const cacheKey = `sec_${webId}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Fetch from TSETMC via z-ai-web-dev-sdk
  const b2Items = await fetchB2FromTsetmc(webId);
  if (!b2Items || b2Items.length === 0) {
    throw new Error(`No data returned for sector web ID: ${webId}`);
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
