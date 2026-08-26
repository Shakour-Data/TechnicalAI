// ═══════════════════════════════════════════════════════════════════
// TSETMC Index History + Sector Live Service
// Uses z-ai-web-dev-sdk page_reader to fetch index data from cdn.tsetmc.com
// Runs as a standalone Node.js service (port 3032)
// Auto-refreshes sector indices on startup and every 30 minutes
// ═══════════════════════════════════════════════════════════════════

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ZAI from 'z-ai-web-dev-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3032;
const DB_DIR = join(__dirname, '..', '..', 'db');

// ── Web IDs for main market indices ─────────────────────────────────
const INDEX_WEB_IDS: Record<string, number> = {
  CWI:   32097828799138957,
  EWI:   67130298613737946,
  CWPI:  5798407779416661,
  EWPI:  8384385859414435,
  FFI:   49579049405614711,
  MKT1I: 62752761908615603,
  MKT2I: 71704845530629737,
  INDI:  43754960038275285,
  ACT50: 46342955726788357,
  LCI30: 10523825119011581,
};

// ── All 40 sector index web IDs ────────────────────────────────────
const SECTOR_WEB_IDS: Array<{ sector: string; webId: string }> = [
  { sector: 'زراعت', webId: '34408080767216529' },
  { sector: 'ذغال سنگ', webId: '19219679288446732' },
  { sector: 'کانی فلزی', webId: '13235969998952202' },
  { sector: 'سایر معادن', webId: '62691002126902464' },
  { sector: 'منسوجات', webId: '59288237226302898' },
  { sector: 'محصولات چرمی', webId: '69306841376553334' },
  { sector: 'محصولات چوبی', webId: '58440550086834602' },
  { sector: 'محصولات کاغذی', webId: '30106839080444358' },
  { sector: 'انتشار و چاپ', webId: '25766336681098389' },
  { sector: 'فرآورده های نفتی', webId: '12331083953323969' },
  { sector: 'لاستیک', webId: '36469751685735891' },
  { sector: 'فلزات اساسی', webId: '32453344048876642' },
  { sector: 'محصولات فلزی', webId: '1123534346391630' },
  { sector: 'ماشین آلات', webId: '11451389074113298' },
  { sector: 'دستگاه های برقی', webId: '33878047680249697' },
  { sector: 'وسایل ارتباطی', webId: '24733701189547084' },
  { sector: 'خودرو', webId: '20213770409093165' },
  { sector: 'قند و شکر', webId: '21948907150049163' },
  { sector: 'چند رشته ای', webId: '40355846462826897' },
  { sector: 'تامین آب، برق و گاز', webId: '54843635503648458' },
  { sector: 'غذایی', webId: '15508900928481581' },
  { sector: 'دارویی', webId: '3615666621538524' },
  { sector: 'شیمیایی', webId: '33626672012415176' },
  { sector: 'خرده فروشی', webId: '65986638607018835' },
  { sector: 'کاشی و سرامیک', webId: '57616105980228781' },
  { sector: 'سیمان', webId: '70077233737515808' },
  { sector: 'کانی غیر فلزی', webId: '14651627750314021' },
  { sector: 'سرمایه گذاری', webId: '34295935482222451' },
  { sector: 'بانک', webId: '72002976013856737' },
  { sector: 'سایر مالی', webId: '25163959460949732' },
  { sector: 'حمل و نقل', webId: '24187097921483699' },
  { sector: 'رادیویی', webId: '41867092385281437' },
  { sector: 'مالی', webId: '61247168213690670' },
  { sector: 'اداره بازارهای مالی', webId: '61985386521682984' },
  { sector: 'انبوه سازی', webId: '4654922806626448' },
  { sector: 'رایانه', webId: '8900726085939949' },
  { sector: 'اطلاعات و ارتباطات', webId: '18780171241610744' },
  { sector: 'فنی مهندسی', webId: '47233872677452574' },
  { sector: 'استخراج نفت', webId: '65675836323214668' },
  { sector: 'بیمه و بازنشستگی', webId: '59105676994811497' },
];

// ── Cache ──────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Sector live data cache
let sectorLiveData: Record<string, { close: number; pcp: number; date: string; webId: string }> = {};
let sectorLastRefresh = 0;
const SECTOR_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
let sectorRefreshInProgress = false;

// ── Gregorian → Jalali conversion ──────────────────────────────────
function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
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
  return { jy, jm, jd };
}

function devenToShamsi(deven: number): string {
  const s = String(deven);
  if (s.length < 8) return s;
  const gy = parseInt(s.slice(0, 4));
  const gm = parseInt(s.slice(4, 6));
  const gd = parseInt(s.slice(6, 8));
  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

// ── ZAI SDK ────────────────────────────────────────────────────────
let zai: ZAI | null = null;
async function getZai(): Promise<ZAI> {
  if (!zai) zai = await ZAI.create();
  return zai;
}

// ── Helpers ────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeReadJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeWriteJson(filePath: string, data: unknown): void {
  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      try { mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    }
    writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  } catch (err) {
    console.error(`[file] Failed to write ${filePath}:`, err);
  }
}

// ── Fetch and parse B2 data from cdn.tsetmc.com ───────────────────
async function fetchB2History(webId: string | number): Promise<Array<Record<string, unknown>>> {
  const sdk = await getZai();
  const result = await sdk.functions.invoke('page_reader', {
    url: `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}`,
  });

  if (result.code !== 200 || !result.data?.html) {
    throw new Error(`TSETMC API returned status ${result.code}`);
  }

  const html = result.data.html as string;
  const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
  if (!preMatch) {
    throw new Error('Failed to parse TSETMC response: no <pre> tag found');
  }

  const jsonStr = preMatch[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  const parsed = JSON.parse(jsonStr);
  return parsed.indexB2 || [];
}

// ── Build OHLC candles ─────────────────────────────────────────────
function buildCandles(items: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const candles: Array<Record<string, unknown>> = [];
  for (const item of items) {
    const close = Number(item.xNivInuClMresIbs) || 0;
    const first = Number(item.xNivInuPhMresIbs) || 0;
    const prevClose = Number(item.xNivInuPbMresIbs) || 0;
    const deven = Number(item.dEven);
    if (close <= 0 || !deven) continue;

    candles.push({
      date: devenToShamsi(deven),
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
// Sector Index Live Data Refresh — Sequential with rate-limit handling
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch B2 data for a single sector with rate-limit retry.
 * Uses exponential backoff on 429 errors.
 */
async function fetchSectorLiveItem(
  sector: string, webId: string, maxRetries = 2
): Promise<{ sector: string; close: number; pcp: number; date: string; webId: string } | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const items = await fetchB2History(webId);
      if (!items || items.length === 0) return null;

      // Find the last two valid entries for close and change %
      const validItems = items.filter((i) => Number(i.xNivInuClMresIbs) > 0);
      if (validItems.length === 0) return null;

      const last = validItems[validItems.length - 1];
      const prev = validItems.length > 1 ? validItems[validItems.length - 2] : last;
      const close = Number(last.xNivInuClMresIbs);
      const prevClose = Number(prev.xNivInuClMresIbs);
      const deven = Number(last.dEven);
      const pcp = prevClose > 0 ? Math.round(((close - prevClose) / prevClose) * 10000) / 100 : 0;
      const dateStr = deven ? devenToShamsi(deven) : '';

      // Save individual sector cache file
      const candles = buildCandles(items);
      safeWriteJson(join(DB_DIR, `sec-${sector}.json`), {
        data: candles,
        time: Date.now(),
      });

      return { sector, close, pcp, date: dateStr, webId };
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err));
      const isRateLimit = msg.includes('429');
      
      if (isRateLimit && attempt < maxRetries) {
        const backoff = 15000 * Math.pow(2, attempt); // 15s, 30s
        console.warn(`[sector-refresh] ${sector}: rate limited, waiting ${backoff / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(backoff);
        continue;
      }
      
      console.warn(`[sector-refresh] Failed for ${sector}: ${msg.slice(0, 80)}`);
      return null;
    }
  }
  return null;
}

/**
 * Refresh all sector indices — SEQUENTIAL with 5s delay between requests
 * to avoid rate limiting from z-ai-web-dev-sdk.
 */
async function refreshAllSectors(force = false): Promise<void> {
  if (sectorRefreshInProgress) {
    console.log('[sector-refresh] Already in progress, skipping');
    return;
  }

  // Check if refresh is needed (unless forced)
  if (!force && sectorLastRefresh > 0 && Date.now() - sectorLastRefresh < SECTOR_REFRESH_INTERVAL) {
    console.log('[sector-refresh] Not needed, last refresh was', Math.round((Date.now() - sectorLastRefresh) / 60000), 'min ago');
    return;
  }

  sectorRefreshInProgress = true;
  const startTime = Date.now();

  // Start with existing file cache data
  const results: Record<string, { close: number; pcp: number; date: string; webId: string }> = {};
  const fileLatest = safeReadJson(join(DB_DIR, 'sector-latest.json'));
  if (fileLatest) {
    const fileData = (fileLatest.data || fileLatest) as Record<string, Record<string, unknown>>;
    for (const [sector, info] of Object.entries(fileData)) {
      if (info.close && Number(info.close) > 0) {
        results[sector] = {
          close: Number(info.close),
          pcp: Number(info.pcp) || 0,
          date: String(info.date || ''),
          webId: String(info.webId || ''),
        };
      }
    }
  }

  console.log(`[sector-refresh] Starting refresh of ${SECTOR_WEB_IDS.length} sector indices (force=${force}, ${Object.keys(results).length} from file cache)...`);

  let fetched = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < SECTOR_WEB_IDS.length; i++) {
    const item = SECTOR_WEB_IDS[i];
    const cacheFile = join(DB_DIR, `sec-${item.sector}.json`);

    // Check if cache file is fresh (< 2 hours old)
    if (!force) {
      try {
        const cached = safeReadJson(cacheFile);
        if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
          const age = Date.now() - (cached.time as number || 0);
          if (age < 2 * 60 * 60 * 1000) {
            const last = cached.data[cached.data.length - 1];
            const prev = cached.data.length > 1 ? cached.data[cached.data.length - 2] : last;
            const close = Number(last.close) || 0;
            const prevClose = Number(prev.close) || 0;
            const pcp = prevClose > 0 ? Math.round(((close - prevClose) / prevClose) * 10000) / 100 : 0;
            results[item.sector] = { close, pcp, date: last.date || '', webId: item.webId };
            skipped++;
            continue;
          }
        }
      } catch { /* fall through to fetch */ }
    }

    console.log(`[sector-refresh] [${i + 1}/${SECTOR_WEB_IDS.length}] Fetching ${item.sector}...`);
    const liveItem = await fetchSectorLiveItem(item.sector, item.webId);
    
    if (liveItem && liveItem.close > 0) {
      results[item.sector] = { close: liveItem.close, pcp: liveItem.pcp, date: liveItem.date, webId: item.webId };
      fetched++;
      // Save progress after each successful fetch
      safeWriteJson(join(DB_DIR, 'sector-latest.json'), { data: results, time: Date.now() });
    } else {
      failed++;
    }

    // Wait 20 seconds between requests to avoid rate limiting
    if (i < SECTOR_WEB_IDS.length - 1) {
      await sleep(20000);
    }
  }

  // Update in-memory cache
  sectorLiveData = results;
  sectorLastRefresh = Date.now();

  // Save final state
  safeWriteJson(join(DB_DIR, 'sector-latest.json'), { data: results, time: sectorLastRefresh });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[sector-refresh] Done in ${elapsed}s: ${fetched} fetched, ${skipped} skipped (cached), ${failed} failed, ${Object.keys(results).length}/${SECTOR_WEB_IDS.length} total`);

  sectorRefreshInProgress = false;
}

/**
 * Load/reload sector live data from file cache.
 * Called on startup and on each /api/sector-live request
 * to pick up data written by background fetcher scripts.
 */
function loadSectorLiveDataFromFile(): void {
  const fileLatest = safeReadJson(join(DB_DIR, 'sector-latest.json'));
  if (!fileLatest) return;

  const fileData = (fileLatest.data || fileLatest) as Record<string, Record<string, unknown>>;
  let loaded = 0;
  for (const [sector, info] of Object.entries(fileData)) {
    if (info.close && Number(info.close) > 0) {
      const close = Number(info.close);
      if (!sectorLiveData[sector] || sectorLiveData[sector].close !== close) {
        sectorLiveData[sector] = {
          close,
          pcp: Number(info.pcp) || 0,
          date: String(info.date || ''),
          webId: String(info.webId || ''),
        };
        loaded++;
      }
    }
  }
  if (loaded > 0) {
    console.log(`[sector] Reloaded ${loaded} updated sectors from file (total: ${Object.keys(sectorLiveData).length})`);
  }
}

// ── HTTP Server (Node.js native) ───────────────────────────────────
async function handleHistoryRequest(cacheKey: string, webId: number) {
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL) {
    return { statusCode: 200, body: JSON.stringify(cached.data) };
  }

  try {
    const items = await fetchB2History(webId);
    if (!items || items.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No data returned', candles: [] }) };
    }

    const candles = buildCandles(items);
    const result = { count: candles.length, candles };
    cache.set(cacheKey, { data: result, ts: now });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error(`[tsetmc-index-service] Error:`, err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err), candles: [] }) };
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (path === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      service: 'tsetmc-index-service',
      sectors: Object.keys(sectorLiveData).length,
      totalExpected: SECTOR_WEB_IDS.length,
      lastRefresh: sectorLastRefresh,
      refreshInProgress: sectorRefreshInProgress,
    }));
    return;
  }

  if (path === '/api/index-list') {
    res.writeHead(200);
    res.end(JSON.stringify({ indices: Object.keys(INDEX_WEB_IDS) }));
    return;
  }

  if (path === '/api/index-history') {
    const key = (url.searchParams.get('key') || '').toUpperCase();
    const webId = INDEX_WEB_IDS[key];
    if (!webId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: `Invalid key. Use: ${Object.keys(INDEX_WEB_IDS).join(', ')}` }));
      return;
    }
    const result = await handleHistoryRequest(`idx_${key}`, webId);
    res.writeHead(result.statusCode);
    res.end(result.body);
    return;
  }

  if (path === '/api/sector-history') {
    const webIdStr = url.searchParams.get('webId');
    if (!webIdStr) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'webId parameter is required' }));
      return;
    }
    const webId = parseInt(webIdStr);
    if (isNaN(webId)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid webId' }));
      return;
    }
    const result = await handleHistoryRequest(`sec_${webId}`, webId);
    res.writeHead(result.statusCode);
    res.end(result.body);
    return;
  }

  // ── Sector live data endpoints ────────────────────────────────────
  if (path === '/api/sector-live') {
    // Always reload from file to pick up data from background fetchers
    loadSectorLiveDataFromFile();

    const data = {
      sectors: sectorLiveData,
      count: Object.keys(sectorLiveData).length,
      totalExpected: SECTOR_WEB_IDS.length,
      lastRefresh: sectorLastRefresh,
      refreshAge: sectorLastRefresh > 0 ? Math.round((Date.now() - sectorLastRefresh) / 60000) : -1,
      refreshInProgress: sectorRefreshInProgress,
    };

    res.writeHead(200);
    res.end(JSON.stringify(data));
    return;
  }

  if (path === '/api/refresh-sectors') {
    try {
      await refreshAllSectors(true);
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        sectors: sectorLiveData,
        count: Object.keys(sectorLiveData).length,
        totalExpected: SECTOR_WEB_IDS.length,
        lastRefresh: sectorLastRefresh,
      }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ── Startup ─────────────────────────────────────────────────────────
async function startup() {
  console.log(`TSETMC Index Service starting on port ${PORT}...`);
  console.log(`Available indices: ${Object.keys(INDEX_WEB_IDS).join(', ')}`);
  console.log(`Sector indices: ${SECTOR_WEB_IDS.length}`);

  // Load existing file cache immediately
  loadSectorLiveDataFromFile();

  server.listen(PORT, () => {
    console.log(`TSETMC Index Service listening on port ${PORT}`);
  });

  // Don't auto-refresh on startup — just serve from file cache
  // The Python prefetch-sectors.py handles initial population
  // Refresh will be triggered by periodic timer after SECTOR_REFRESH_INTERVAL
  // Or manually via /api/refresh-sectors?force=true

  // Periodic refresh every 30 minutes
  setInterval(() => {
    refreshAllSectors().catch((err) => console.error('[periodic] Sector refresh error:', err));
  }, SECTOR_REFRESH_INTERVAL);
}

startup().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
