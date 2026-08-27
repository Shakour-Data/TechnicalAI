// ═══════════════════════════════════════════════════════════════════
// TSETMC Index History API
//
// Fetches index OHLC data via Python micro-service (port 3031)
// which uses z-ai CLI page_reader to proxy TSETMC CDN requests.
//
// Sector names and web IDs match finpy-tse library exactly.
// ═══════════════════════════════════════════════════════════════════

import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { rateLimitedPageReader } from '@/lib/zai-shared';

const SERVICE_BASE = 'http://localhost:3032';
const FILE_CACHE_DIR = join(process.cwd(), 'db');
const FILE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ── Types ─────────────────────────────────────────────────────────
export interface IndexCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Sector name → webId mapping (from finpy-tse) ────────────
const SECTOR_WEB_IDS: Record<string, string> = {
  'زراعت': '34408080767216529',
  'ذغال سنگ': '19219679288446732',
  'کانی فلزی': '13235969998952202',
  'سایر معادن': '62691002126902464',
  'منسوجات': '59288237226302898',
  'محصولات چرمی': '69306841376553334',
  'محصولات چوبی': '58440550086834602',
  'محصولات کاغذی': '30106839080444358',
  'انتشار و چاپ': '25766336681098389',
  'فرآورده های نفتی': '12331083953323969',
  'لاستیک': '36469751685735891',
  'فلزات اساسی': '32453344048876642',
  'محصولات فلزی': '1123534346391630',
  'ماشین آلات': '11451389074113298',
  'دستگاه های برقی': '33878047680249697',
  'وسایل ارتباطی': '24733701189547084',
  'خودرو': '20213770409093165',
  'قند و شکر': '21948907150049163',
  'چند رشته ای': '40355846462826897',
  'تامین آب، برق و گاز': '54843635503648458',
  'غذایی': '15508900928481581',
  'دارویی': '3615666621538524',
  'شیمیایی': '33626672012415176',
  'خرده فروشی': '65986638607018835',
  'کاشی و سرامیک': '57616105980228781',
  'سیمان': '70077233737515808',
  'کانی غیر فلزی': '14651627750314021',
  'سرمایه گذاری': '34295935482222451',
  'بانک': '72002976013856737',
  'سایر مالی': '25163959460949732',
  'حمل و نقل': '24187097921483699',
  'رادیویی': '41867092385281437',
  'مالی': '61247168213690670',
  'اداره بازارهای مالی': '61985386521682984',
  'انبوه سازی': '4654922806626448',
  'رایانه': '8900726085939949',
  'اطلاعات و ارتباطات': '18780171241610744',
  'فنی مهندسی': '47233872677452574',
  'استخراج نفت': '65675836323214668',
  'بیمه و بازنشستگی': '59105676994811497',
};

// ── In-memory cache ──────────────────────────────────────────────
interface CacheEntry {
  data: IndexCandle[];
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ── File-based cache helpers ────────────────────────────────────
function indexFileCachePath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
  return join(FILE_CACHE_DIR, `index-${safe}.json`);
}

function sectorFileCachePath(sectorName: string): string {
  return join(FILE_CACHE_DIR, `sec-${sectorName}.json`);
}

function loadIndexFileCache(key: string, ignoreTTL = false): IndexCandle[] | null {
  try {
    const path = indexFileCachePath(key);
    if (!existsSync(path)) return null;
    const content = readFileSync(path, 'utf-8');
    const entry = JSON.parse(content);
    if (!ignoreTTL && Date.now() - entry.time > FILE_CACHE_TTL) return null;
    return entry.data as IndexCandle[];
  } catch {
    return null;
  }
}

function loadSectorFileCache(sectorName: string, ignoreTTL = false): IndexCandle[] | null {
  try {
    const path = sectorFileCachePath(sectorName);
    if (!existsSync(path)) return null;
    const content = readFileSync(path, 'utf-8');
    const entry = JSON.parse(content);
    if (!ignoreTTL && Date.now() - entry.time > FILE_CACHE_TTL) return null;
    return entry.data as IndexCandle[];
  } catch {
    return null;
  }
}

function saveIndexFileCache(key: string, data: IndexCandle[]): void {
  try {
    if (!existsSync(FILE_CACHE_DIR)) {
      try { mkdirSync(FILE_CACHE_DIR, { recursive: true }); } catch { /* ignore */ }
    }
    writeFileSync(indexFileCachePath(key), JSON.stringify({ data, time: Date.now() }), 'utf-8');
  } catch {
    // File cache is best-effort
  }
}

// ── Service health check ────────────────────────────────────────
export async function isServiceHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVICE_BASE}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve webId to sector name
 */
function webIdToSectorName(webId: string): string | undefined {
  for (const [name, wid] of Object.entries(SECTOR_WEB_IDS)) {
    if (wid === webId) return name;
  }
  return undefined;
}

// ── Generic fetch with multi-tier cache ─────────────────────────
async function fetchWithCache(
  cacheKey: string,
  serviceUrl: string,
  sectorName?: string,
): Promise<IndexCandle[]> {
  const now = Date.now();

  // Tier 1: In-memory cache
  const memCached = cache.get(cacheKey);
  if (memCached && now - memCached.timestamp < CACHE_TTL) {
    return memCached.data;
  }

  // Tier 2: File cache (index-based key)
  let fileCached = loadIndexFileCache(cacheKey);

  // Tier 2b: Sector file cache (from prefetch-sectors.py)
  if (!fileCached && sectorName) {
    fileCached = loadSectorFileCache(sectorName);
  }

  if (fileCached) {
    cache.set(cacheKey, { data: fileCached, timestamp: now });
    return fileCached;
  }

  // Tier 3: Fetch from Python service
  try {
    const res = await fetch(serviceUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Service error ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    const candles: IndexCandle[] = json.candles || [];

    if (candles.length === 0) {
      const err = json.error || 'Unknown error';
      throw new Error(err);
    }

    cache.set(cacheKey, { data: candles, timestamp: now });
    saveIndexFileCache(cacheKey, candles);
    return candles;
  } catch (serviceErr) {
    // Ultimate fallback: sector file cache ignoring TTL
    if (sectorName) {
      const fallback = loadSectorFileCache(sectorName, true);
      if (fallback) {
        cache.set(cacheKey, { data: fallback, timestamp: now });
        return fallback;
      }
    }
    throw serviceErr;
  }
}

export { SECTOR_WEB_IDS };

// ── Main index web IDs (same as tsetmc-index-service) ───────────
const MAIN_INDEX_WEB_IDS: Record<string, string> = {
  CWI:   '32097828799138957',
  EWI:   '67130298613737946',
  CWPI:  '5798407779416661',
  EWPI:  '8384385859414435',
  FFI:   '49579049405614711',
  MKT1I: '62752761908615603',
  MKT2I: '71704845530629737',
  INDI:  '43754960038275285',
  ACT50: '46342955726788357',
  LCI30: '10523825119011581',
};

// ── Gregorian → Jalali conversion ─────────────────────────────────
function gregorianToJalali(gy: number, gm: number, gd: number): string {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) { jy = 979; gy -= 1600; } else { jy = 0; gy -= 621; }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

/**
 * Direct TSETMC CDN fetch via z-ai page_reader as ultimate fallback.
 * Used when the 3032 service is rate-limited or down.
 */
async function fetchFromTsetmcCdn(webId: string): Promise<IndexCandle[]> {
  const url = `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}`;

  // Try direct fetch first (no SDK dependency)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (res.ok) {
      const jsonStr = await res.text();
      return parseTsetmcCdnResponse(jsonStr);
    }
  } catch {
    // Direct fetch failed (blocked, timeout, etc.) — try page_reader as fallback
  }

  // Fallback: z-ai page_reader
  try {
    const html = await rateLimitedPageReader(url, 30_000);
    const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
    if (!preMatch) throw new Error('Failed to parse TSETMC CDN response');
    return parseTsetmcCdnResponse(preMatch[1]);
  } catch {
    throw new Error('Failed to fetch from TSETMC CDN');
  }
}

/**
 * Parse JSON response from TSETMC CDN (works with both raw JSON and HTML-wrapped responses)
 */
function parseTsetmcCdnResponse(jsonStr: string): IndexCandle[] {
  // Clean HTML entities if present
  const cleaned = jsonStr
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  let parsed: { indexB2?: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) {
      try { parsed = JSON.parse(cleaned.slice(0, lastBrace + 1)); } catch { throw new Error('Invalid JSON from TSETMC CDN'); }
    } else {
      throw new Error('Invalid JSON from TSETMC CDN');
    }
  }

  const items = parsed.indexB2 || [];
  const candles: IndexCandle[] = [];
  for (const item of items) {
    const close = Number(item.xNivInuClMresIbs) || 0;
    const first = Number(item.xNivInuPhMresIbs) || 0;
    const prevClose = Number(item.xNivInuPbMresIbs) || 0;
    const deven = Number(item.dEven);
    if (close <= 0 || !deven) continue;

    const s = String(deven);
    if (s.length < 8) continue;
    const gy = parseInt(s.slice(0, 4));
    const gm = parseInt(s.slice(4, 6));
    const gd = parseInt(s.slice(6, 8));
    const date = gregorianToJalali(gy, gm, gd);

    candles.push({
      date,
      open: first > 0 ? first : prevClose,
      high: Math.max(first > 0 ? first : close, close),
      low: Math.min(first > 0 ? first : close, close),
      close,
      volume: 0,
    });
  }
  return candles;
}

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch historical candle data for a main market index.
 * Tries: memory cache → file cache → 3032 service → direct TSETMC CDN fallback
 */
export async function fetchMainIndexHistory(indexKey: string): Promise<IndexCandle[]> {
  const key = indexKey.toUpperCase();
  const webId = MAIN_INDEX_WEB_IDS[key];

  // Try multi-tier cache first
  try {
    return await fetchWithCache(`idx_${key}`, `${SERVICE_BASE}/api/index-history?key=${key}`);
  } catch (serviceErr) {
    // Service failed (rate limit, down, etc.)
    console.warn(`[tsetmc-index] Service failed for ${key}, trying fallbacks...`);
  }

  // Quick fallback: try expired file cache BEFORE slow CDN call
  const expiredCache = loadIndexFileCache(`idx_${key}`, true);
  if (expiredCache && expiredCache.length > 0) {
    console.warn(`[tsetmc-index] Using expired file cache for ${key} (${expiredCache.length} candles)`);
    return expiredCache;
  }

  // Direct TSETMC CDN fallback via z-ai page_reader
  if (webId) {
    console.log(`[tsetmc-index] Fetching ${key} directly from TSETMC CDN (webId=${webId})...`);
    try {
      const candles = await fetchFromTsetmcCdn(webId);
      if (candles.length > 0) {
        // Cache the result
        cache.set(`idx_${key}`, { data: candles, timestamp: Date.now() });
        saveIndexFileCache(`idx_${key}`, candles);
        return candles;
      }
    } catch (cdnErr) {
      console.error(`[tsetmc-index] CDN fallback also failed for ${key}:`, cdnErr instanceof Error ? cdnErr.message : String(cdnErr));
    }
  }

  throw new Error(`داده‌های تاریخی شاخص ${key} در دسترس نیست. لطفاً بعداً تلاش کنید.`);
}

/**
 * Fetch historical candle data for a sector/industry index by webId.
 * Tries: memory cache → file cache → 3032 service → direct TSETMC CDN fallback
 */
export async function fetchSectorIndexHistory(webIdStr: string): Promise<IndexCandle[]> {
  if (!webIdStr) throw new Error('شناسه وب (webId) الزامی است');
  const sectorName = webIdToSectorName(webIdStr);

  // Try multi-tier cache + service first
  try {
    return await fetchWithCache(
      `sec_${webIdStr}`,
      `${SERVICE_BASE}/api/sector-history?webId=${encodeURIComponent(webIdStr)}`,
      sectorName,
    );
  } catch (serviceErr) {
    console.warn(`[tsetmc-index] Service failed for webId=${webIdStr}, trying direct CDN fallback...`);
  }

  // Quick fallback: try expired file cache BEFORE slow CDN call
  if (sectorName) {
    const expiredSector = loadSectorFileCache(sectorName);
    if (expiredSector && expiredSector.length > 0) {
      console.warn(`[tsetmc-index] Using expired sector cache for ${sectorName} (${expiredSector.length} candles)`);
      return expiredSector;
    }
  }
  const expiredWebId = loadIndexFileCache(`sec_${webIdStr}`, true);
  if (expiredWebId && expiredWebId.length > 0) {
    console.warn(`[tsetmc-index] Using expired file cache for webId=${webIdStr} (${expiredWebId.length} candles)`);
    return expiredWebId;
  }

  // Direct TSETMC CDN fallback via z-ai page_reader
  console.log(`[tsetmc-index] Fetching webId=${webIdStr} directly from TSETMC CDN...`);
  try {
    const candles = await fetchFromTsetmcCdn(webIdStr);
    if (candles.length > 0) {
      cache.set(`sec_${webIdStr}`, { data: candles, timestamp: Date.now() });
      saveIndexFileCache(`sec_${webIdStr}`, candles);
      return candles;
    }
  } catch (cdnErr) {
    console.error(`[tsetmc-index] CDN fallback also failed for webId=${webIdStr}:`, cdnErr instanceof Error ? cdnErr.message : String(cdnErr));
  }

  throw new Error(`داده‌های تاریخی این شاخص گروه در دسترس نیست.`);
}

/**
 * Fetch sector index data by sector name (finpy-tse name).
 */
export async function fetchSectorByName(sectorName: string): Promise<IndexCandle[]> {
  if (!sectorName) throw new Error('نام گروه الزامی است');
  // The tsetmc-index-service (port 3032) only supports webId, not sector name.
  // Resolve sector name to webId and use webId endpoint.
  const webId = SECTOR_WEB_IDS[sectorName];
  if (!webId) throw new Error(`شناسه وب برای «${sectorName}» یافت نشد`);
  return fetchWithCache(
    `sec_${sectorName}`,
    `${SERVICE_BASE}/api/sector-history?webId=${encodeURIComponent(webId)}`,
    sectorName,
  );
}

/** No-op warmup */
export function warmup(): void {
  console.log('[tsetmc-index] Using Python service on port 3031 (no SDK warmup needed)');
}

/** Clear memory cache */
export function clearIndexCache(): void {
  cache.clear();
}
