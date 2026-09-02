// ═══════════════════════════════════════════════════════════════════
// TSETMC Index Service
// Serves cached index data and handles background sector refresh
// Uses Next.js proxy (localhost:3000) for CDN access via z-ai SDK
// ═══════════════════════════════════════════════════════════════════

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3032;
const DB_DIR = join(__dirname, '..', '..', 'db');
const NEXTJS_BASE = 'http://localhost:3000';

// ── Web IDs for main market indices ─────────────────────────────────
const INDEX_WEB_IDS: Record<string, string> = {
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

// ── Fetch via Next.js proxy ────────────────────────────────────────
async function fetchViaProxy(webId: string): Promise<Array<Record<string, unknown>>> {
  const proxyUrl = `${NEXTJS_BASE}/api/index-fetch-proxy?webId=${encodeURIComponent(webId)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Proxy error ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  const rawJson = json.raw || '';
  if (!rawJson) throw new Error('Empty response');
  const cleaned = rawJson.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  let parsed: { indexB2?: Array<Record<string, unknown>> };
  try { parsed = JSON.parse(cleaned); } catch {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) { try { parsed = JSON.parse(cleaned.slice(0, lastBrace + 1)); } catch { throw new Error('Invalid JSON'); } }
    else throw new Error('Invalid JSON');
  }
  return parsed.indexB2 || [];
}

// ── Gregorian → Jalali ─────────────────────────────────────────────
function gregorianToJalali(gy: number, gm: number, gd: number): string {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) { jy = 979; gy -= 1600; } else { jy = 0; gy -= 621; }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053); days %= 12053;
  jy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

function devenToShamsi(deven: number): string {
  const s = String(deven);
  if (s.length < 8) return s;
  return gregorianToJalali(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)), parseInt(s.slice(6, 8)));
}

// ── Build candles ──────────────────────────────────────────────────
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
      close, volume: 0,
    });
  }
  return candles;
}

// ── Sector live data ───────────────────────────────────────────────
let sectorLiveData: Record<string, { close: number; pcp: number; date: string; webId: string }> = {};
let sectorLastRefresh = 0;
const SECTOR_REFRESH_INTERVAL = 30 * 60 * 1000;
let sectorRefreshInProgress = false;

function loadSectorLiveDataFromFile(): void {
  const fileLatest = safeReadJson(join(DB_DIR, 'sector-latest.json'));
  if (!fileLatest) return;
  const fileData = (fileLatest.data || fileLatest) as Record<string, Record<string, unknown>>;
  let loaded = 0;
  for (const [sector, info] of Object.entries(fileData)) {
    if (info.close && Number(info.close) > 0) {
      sectorLiveData[sector] = {
        close: Number(info.close),
        pcp: Number(info.pcp) || 0,
        date: String(info.date || ''),
        webId: String(info.webId || ''),
      };
      loaded++;
    }
  }
  if (loaded > 0) console.log(`[sector] Loaded ${loaded} sectors from file`);
}

async function refreshAllSectors(force = false): Promise<void> {
  if (sectorRefreshInProgress) return;
  if (!force && sectorLastRefresh > 0 && Date.now() - sectorLastRefresh < SECTOR_REFRESH_INTERVAL) return;

  sectorRefreshInProgress = true;
  const startTime = Date.now();

  const results: Record<string, { close: number; pcp: number; date: string; webId: string }> = {};
  const fileLatest = safeReadJson(join(DB_DIR, 'sector-latest.json'));
  if (fileLatest) {
    const fileData = (fileLatest.data || fileLatest) as Record<string, Record<string, unknown>>;
    for (const [sector, info] of Object.entries(fileData)) {
      if (info.close && Number(info.close) > 0) {
        results[sector] = { close: Number(info.close), pcp: Number(info.pcp) || 0, date: String(info.date || ''), webId: String(info.webId || '') };
      }
    }
  }

  console.log(`[sector-refresh] Starting (${SECTOR_WEB_IDS.length} sectors, ${Object.keys(results).length} from cache)...`);

  let fetched = 0, failed = 0, skipped = 0;

  for (let i = 0; i < SECTOR_WEB_IDS.length; i++) {
    const item = SECTOR_WEB_IDS[i];
    const cacheFile = join(DB_DIR, `sec-${item.sector}.json`);

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
      } catch { /* fall through */ }
    }

    try {
      const items = await fetchViaProxy(item.webId);
      if (items && items.length > 0) {
        const candles = buildCandles(items);
        const validCandles = candles.filter((c: Record<string, unknown>) => Number(c.close) > 0);
        if (validCandles.length > 0) {
          const last = validCandles[validCandles.length - 1] as Record<string, unknown>;
          const prev = validCandles.length > 1 ? validCandles[validCandles.length - 2] : last;
          const close = Number(last.close);
          const prevClose = Number(prev.close);
          const pcp = prevClose > 0 ? Math.round(((close - prevClose) / prevClose) * 10000) / 100 : 0;
          results[item.sector] = { close, pcp, date: String(last.date || ''), webId: item.webId };
          fetched++;
          safeWriteJson(cacheFile, { data: candles, time: Date.now() });
          safeWriteJson(join(DB_DIR, 'sector-latest.json'), { data: results, time: Date.now() });
        }
      } else { failed++; }
    } catch (err) {
      console.warn(`[sector-refresh] Failed ${item.sector}:`, (err instanceof Error ? err.message : String(err)).slice(0, 80));
      failed++;
    }

    if (i < SECTOR_WEB_IDS.length - 1) await sleep(5000);
  }

  sectorLiveData = results;
  sectorLastRefresh = Date.now();
  safeWriteJson(join(DB_DIR, 'sector-latest.json'), { data: results, time: sectorLastRefresh });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[sector-refresh] Done in ${elapsed}s: ${fetched} fetched, ${skipped} skipped, ${failed} failed`);
  sectorRefreshInProgress = false;
}

// ── HTTP Server ────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (path === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok', service: 'tsetmc-index-service',
      sectors: Object.keys(sectorLiveData).length, totalExpected: SECTOR_WEB_IDS.length,
      lastRefresh: sectorLastRefresh, refreshInProgress: sectorRefreshInProgress,
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
      res.end(JSON.stringify({ error: `Invalid key: ${key}` }));
      return;
    }
    // Serve from file cache
    const fileData = safeReadJson(join(DB_DIR, `index-idx_${key}.json`));
    if (fileData && fileData.data && (fileData.data as unknown[]).length > 0) {
      res.writeHead(200);
      res.end(JSON.stringify({ index_key: key, count: (fileData.data as unknown[]).length, candles: fileData.data }));
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not in cache', candles: [] }));
    return;
  }

  if (path === '/api/sector-history') {
    const webIdStr = url.searchParams.get('webId');
    if (!webIdStr) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'webId required' }));
      return;
    }
    // Serve from file cache
    const fileData = safeReadJson(join(DB_DIR, `sec-sec_${webIdStr}.json`)) ||
      safeReadJson(join(DB_DIR, `sec-${webIdStr}.json`));
    if (fileData && fileData.data && (fileData.data as unknown[]).length > 0) {
      res.writeHead(200);
      res.end(JSON.stringify({ web_id: webIdStr, count: (fileData.data as unknown[]).length, candles: fileData.data }));
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not in cache', candles: [] }));
    return;
  }

  if (path === '/api/sector-live') {
    loadSectorLiveDataFromFile();
    res.writeHead(200);
    res.end(JSON.stringify({ sectors: sectorLiveData, count: Object.keys(sectorLiveData).length, totalExpected: SECTOR_WEB_IDS.length, lastRefresh: sectorLastRefresh }));
    return;
  }

  if (path === '/api/refresh-sectors') {
    try {
      await refreshAllSectors(true);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, sectors: sectorLiveData, count: Object.keys(sectorLiveData).length, lastRefresh: sectorLastRefresh }));
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
  loadSectorLiveDataFromFile();

  server.listen(PORT, () => {
    console.log(`TSETMC Index Service listening on port ${PORT}`);
  });

  // Periodic refresh every 30 minutes
  setInterval(() => {
    refreshAllSectors().catch((err) => console.error('[periodic] Refresh error:', err));
  }, SECTOR_REFRESH_INTERVAL);
}

startup().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
