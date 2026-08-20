// ═══════════════════════════════════════════════════════════════════
// TSETMC Index History Service
// Uses z-ai-web-dev-sdk page_reader to fetch index data from cdn.tsetmc.com
// Runs as a standalone Node.js service (port 3032)
// ═══════════════════════════════════════════════════════════════════

import { createServer } from 'node:http';
import ZAI from 'z-ai-web-dev-sdk';

const PORT = 3032;

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

// ── Cache ──────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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

// ── Fetch and parse B2 data from cdn.tsetmc.com ───────────────────
async function fetchB2History(webId: number): Promise<Array<Record<string, unknown>>> {
  const sdk = await getZai();
  const result = await sdk.functions.invoke('page_reader', {
    url: `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}`,
  });

  if (result.code !== 200 || !result.data?.html) {
    console.error(`[fetchB2] Bad response: code=${result.code}, hasData=${!!result.data}, htmlLen=${result.data?.html?.length ?? 'N/A'}`);
    throw new Error(`TSETMC API returned status ${result.code}`);
  }

  const html = result.data.html as string;
  console.log(`[fetchB2] HTML length: ${html.length}`);
  const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
  if (!preMatch) {
    console.error(`[fetchB2] No <pre> tag found in ${html.length} bytes of HTML`);
    throw new Error('Failed to parse TSETMC response: no <pre> tag found');
  }

  console.log(`[fetchB2] Pre tag found, length: ${preMatch[1].length}`);

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

// ── JSON response helper ───────────────────────────────────────────
function jsonRes(data: unknown, status = 200): NodeJS.Response {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(data),
  } as unknown as NodeJS.Response;
}

// ── HTTP Server (Node.js native) ───────────────────────────────────
async function handleHistoryRequest(cacheKey: string, webId: number) {
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL) {
    return jsonRes(cached.data);
  }

  try {
    const items = await fetchB2History(webId);
    if (!items || items.length === 0) {
      return jsonRes({ error: 'No data returned', candles: [] }, 404);
    }

    const candles = buildCandles(items);
    const result = { count: candles.length, candles };
    cache.set(cacheKey, { data: result, ts: now });
    return jsonRes(result);
  } catch (err) {
    console.error(`[tsetmc-index-service] Error:`, err);
    return jsonRes({ error: String(err), candles: [] }, 500);
  }
}

const server = createServer(async (req, res) => {
 const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (path === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'tsetmc-index-service' }));
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
    res.writeHead(result.statusCode || 200);
    res.end(JSON.stringify(JSON.parse(result.body || '{}')));
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
    res.writeHead(result.statusCode || 200);
    res.end(JSON.stringify(JSON.parse(result.body || '{}')));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`TSETMC Index Service starting on port ${PORT}...`);
  console.log(`Available indices: ${Object.keys(INDEX_WEB_IDS).join(', ')}`);
});
