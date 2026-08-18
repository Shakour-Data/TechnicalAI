// TSETMC Index History Service - Node.js native
import { createServer } from 'node:http';
import ZAI from 'z-ai-web-dev-sdk';

const PORT = 3032;

const INDEX_WEB_IDS = {
  CWI: 32097828799138957, EWI: 67130298613737946, CWPI: 5798407779416661,
  EWPI: 8384385859414435, FFI: 49579049405614711, MKT1I: 62752761908615603,
  MKT2I: 71704845530629737, INDI: 43754960038275285, ACT50: 46342955726788357,
  LCI30: 10523825119011581,
};

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy;
  if (gy > 1600) { jy = 979; gy -= 1600; } else { jy = 0; gy -= 621; }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053); days %= 12053;
  jy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

function devenToShamsi(deven) {
  const s = String(deven);
  if (s.length < 8) return s;
  const { jy, jm, jd } = gregorianToJalali(parseInt(s.slice(0,4)), parseInt(s.slice(4,6)), parseInt(s.slice(6,8)));
  return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`;
}

let zai = null;
async function getZai() { if (!zai) zai = await ZAI.create(); return zai; }

async function fetchB2History(webId) {
  const sdk = await getZai();
  const result = await sdk.functions.invoke('page_reader', { url: `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}` });
  console.log(`[fetchB2] htmlLen=${result.data?.html?.length || 0}`);
  if (result.code !== 200 || !result.data?.html) throw new Error(`TSETMC API returned status ${result.code}`);
  const html = result.data.html;
  const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
  if (!preMatch) throw new Error('Failed to parse TSETMC response');
  const jsonStr = preMatch[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
  const parsed = JSON.parse(jsonStr);
  return parsed.indexB2 || [];
}

function buildCandles(items) {
  const candles = [];
  for (const item of items) {
    const close = Number(item.xNivInuClMresIbs) || 0;
    const first = Number(item.xNivInuPhMresIbs) || 0;
    const prevClose = Number(item.xNivInuPbMresIbs) || 0;
    const deven = Number(item.dEven);
    if (close <= 0 || !deven) continue;
    candles.push({ date: devenToShamsi(deven), open: first > 0 ? first : prevClose, high: Math.max(first > 0 ? first : close, close), low: Math.min(first > 0 ? first : close, close), close, volume: 0 });
  }
  return candles;
}

async function handleHistory(cacheKey, webId) {
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL) return cached.data;
  try {
    const items = await fetchB2History(webId);
    if (!items || items.length === 0) return { error: 'No data returned', candles: [] };
    const candles = buildCandles(items);
    const result = { count: candles.length, candles };
    cache.set(cacheKey, { data: result, ts: now });
    return result;
  } catch (err) {
    console.error('[tsetmc-index-service] Error:', err);
    return { error: String(err), candles: [] };
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url.pathname === '/health') { res.writeHead(200); res.end(JSON.stringify({status:'ok',service:'tsetmc-index-service'})); return; }
  if (url.pathname === '/api/index-list') { res.writeHead(200); res.end(JSON.stringify({indices: Object.keys(INDEX_WEB_IDS)})); return; }

  if (url.pathname === '/api/index-history') {
    const key = (url.searchParams.get('key') || '').toUpperCase();
    const webId = INDEX_WEB_IDS[key];
    if (!webId) { res.writeHead(400); res.end(JSON.stringify({error:`Invalid key. Use: ${Object.keys(INDEX_WEB_IDS).join(', ')}`})); return; }
    const result = await handleHistory(`idx_${key}`, webId);
    res.writeHead(result.error ? (result.candles?.length ? 200 : 404) : 200);
    res.end(JSON.stringify(result));
    return;
  }

  if (url.pathname === '/api/sector-history') {
    const webIdStr = url.searchParams.get('webId');
    if (!webIdStr) { res.writeHead(400); res.end(JSON.stringify({error:'webId required'})); return; }
    const webId = parseInt(webIdStr);
    if (isNaN(webId)) { res.writeHead(400); res.end(JSON.stringify({error:'Invalid webId'})); return; }
    const result = await handleHistory(`sec_${webId}`, webId);
    res.writeHead(result.error ? 404 : 200);
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(404); res.end(JSON.stringify({error:'Not found'}));
});

server.listen(PORT, () => console.log(`TSETMC Index Service on port ${PORT}`));
