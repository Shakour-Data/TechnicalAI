import { deflateRawSync, inflateSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const API_KEY = "BA9C8JBliDmfPapn9WYTX76uR5Q3m2r3";
const BASE_URL = "https://Api.BrsApi.ir/Tsetmc";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://brsapi.ir/",
  "Origin": "https://brsapi.ir",
};

export interface TseSymbol {
  time: string;
  l18: string; // symbol name
  l30: string; // company name
  isin: string;
  id: string;
  pl: number; // last price
  plp: number; // last price change %
  pc: number; // closing price
  pcp: number; // closing price change %
  tno: number; // number of trades
  tvol: number; // trade volume
  tval: number; // trade value
  py: number; // yesterday closing price
  pf: number; // first price
  pmin: number; // min price
  pmax: number; // max price
  eps: number;
  pe: number;
  cs: string; // industry/sector name
  cs_id: number;
  Buy_CountI: number;
  Buy_CountN: number;
  Buy_I_Volume: number;
  Buy_N_Volume: number;
  Sell_I_Volume: number;
  Sell_N_Volume: number;
  pd1: number; pd2: number; pd3: number; pd4: number; pd5: number;
  po1: number; po2: number; po3: number; po4: number; po5: number;
  qd1: number; qd2: number; qd3: number; qd4: number; qd5: number;
  qo1: number; qo2: number; qo3: number; qo4: number; qo5: number;
}

export interface TseIndex {
  name: string;
  time: string;
  index: number;
  index_change: number;
  index_change_percent: number;
  min: number;
  max: number;
}

// Instrument type categories (matching BrsApi type param)
export const INSTRUMENT_TYPES = {
  STOCK: 1,    // Stocks + ETFs
  SALAF: 2,    // Forward/Salaf contracts
  FUTURE: 3,   // Futures
  BOND: 4,     // Treasury bonds
  MORTGAGE: 5, // Mortgage certificates
} as const;

// Human-readable category names
export const CATEGORY_LABELS: Record<string, string> = {
  all: 'همه',
  indices: 'شاخص‌ها',
  stocks: 'سهام',
  etf: 'صندوق‌ها',
  bond: 'اوراق بدهی',
  future: 'قرارداد آتی',
  salaf: 'سلف موازی',
  mortgage: 'تسه مسکن',
};

export const ETF_CATEGORY = 'صندوق سرمایه‌گذاری قابل معامله';

/**
 * Gold ETF identification — keywords in symbol name (l18) or company name (l30)
 * that indicate the ETF is gold-related (صندوق طلا).
 * These instruments are TSE-listed and must use TSE data, NOT TGJU.
 */
export const GOLD_ETF_KEYWORDS = ['طلا', 'سکه', 'عیار', 'گوار', 'معدنی'];
export const GOLD_ETF_SYMBOLS = new Set([
  // Known gold ETF symbols from TSE
  'عیار', 'طلا', 'ناب', 'درنا', 'جام طلا', 'همیان', 'نگین فارس', 'گلدیس',
  'زرین', 'زر', 'زرفام', 'زریران', 'زرگر', 'زروان', 'لیان', 'بزرگ',
]);

/**
 * Check if a TSE ETF symbol is a gold-related ETF.
 * Uses both exact symbol matching and keyword matching in name.
 */
export function isGoldEtf(l18: string, l30: string): boolean {
  if (GOLD_ETF_SYMBOLS.has(l18)) return true;
  const combined = (l18 + ' ' + l30).toLowerCase();
  return GOLD_ETF_KEYWORDS.some(kw => combined.includes(kw));
}

export interface CandleData {
  date: string;
  time?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoryData {
  date: string;
  time: string;
  pf: number;
  pc: number;
  pl: number;
  py: number;
  pmin: number;
  pmax: number;
  pcc: number;
  pcp: number;
  tno: number;
  tvol: number;
  tval: number;
}

// Per-type caches
const symbolsCaches = new Map<number, { data: TseSymbol[]; time: number }>();
let indicesCache: { data: TseIndex[]; time: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// File-based cache for resilience when BrsApi is blocked
const FILE_CACHE_DIR = join(process.cwd(), 'db');
const FILE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for file cache (BrsApi unreliable)

function fileCachePath(type: number): string {
  return join(FILE_CACHE_DIR, `symbols-type-${type}.json`);
}

function loadFileCache(type: number, force = false): TseSymbol[] | null {
  try {
    const path = fileCachePath(type);
    if (!existsSync(path)) return null;
    const content = readFileSync(path, 'utf-8');
    const entry = JSON.parse(content);
    if (!force && Date.now() - entry.time > FILE_CACHE_TTL) return null;
    return entry.data as TseSymbol[];
  } catch {
    return null;
  }
}

// ── Candlestick file-based cache ──
const CANDLE_FILE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for candlestick cache (BrsApi unreliable)

function candleFileCachePath(symbol: string, type: number): string {
  const safe = symbol.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
  return join(FILE_CACHE_DIR, `candle-${safe}-type${type}.json`);
}

function loadCandleFileCache(symbol: string, type: number, force = false): CandleData[] | null {
  try {
    const path = candleFileCachePath(symbol, type);
    if (!existsSync(path)) return null;
    const content = readFileSync(path, 'utf-8');
    const entry = JSON.parse(content);
    if (!force && Date.now() - entry.time > CANDLE_FILE_CACHE_TTL) return null;
    return entry.data as CandleData[];
  } catch {
    return null;
  }
}

function saveCandleFileCache(symbol: string, type: number, data: CandleData[]): void {
  try {
    const dir = FILE_CACHE_DIR;
    if (!existsSync(dir)) {
      try { mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    }
    writeFileSync(candleFileCachePath(symbol, type), JSON.stringify({ data, time: Date.now() }), 'utf-8');
  } catch {
    // File cache is best-effort
  }
}

function saveFileCache(type: number, data: TseSymbol[]): void {
  try {
    const dir = FILE_CACHE_DIR;
    if (!existsSync(dir)) {
      // Try to create directory (may fail in sandbox)
      try { mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    }
    writeFileSync(fileCachePath(type), JSON.stringify({ data, time: Date.now() }), 'utf-8');
  } catch {
    // File cache is best-effort
  }
}

const BRSAPI_TIMEOUT = 8000; // 8s connect timeout for BrsApi

export async function fetchAllSymbols(type: number = 1): Promise<TseSymbol[]> {
  const now = Date.now();
  const cached = symbolsCaches.get(type);
  if (cached && now - cached.time < CACHE_TTL) {
    return cached.data;
  }
  try {
    const url = `${BASE_URL}/AllSymbols.php?key=${API_KEY}&type=${type}`;
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 }, signal: AbortSignal.timeout(BRSAPI_TIMEOUT) });
    if (!res.ok) throw new Error(`Failed to fetch symbols (type=${type}): ${res.status}`);
    const raw = await res.json();
    // Check for API error response
    if (raw && !Array.isArray(raw) && raw.code_http) {
      throw new Error(raw.message_error || `API error: ${raw.code_http}`);
    }
    const data: TseSymbol[] = Array.isArray(raw) ? raw : raw.data || raw.symbols || [];
    symbolsCaches.set(type, { data, time: now });
    saveFileCache(type, data);
    return data;
  } catch (err) {
    console.warn(`[tse-api] BrsApi failed for type=${type}:`, (err instanceof Error ? err.message : String(err)));
    // Fallback to file cache (even if expired, stale data is better than nothing)
    const fileData = loadFileCache(type) || loadFileCache(type, true);
    if (fileData && fileData.length > 0) {
      console.log(`[tse-api] Using file cache for type=${type} (${fileData.length} items)`);
      return fileData;
    }
    throw err;
  }
}

export async function fetchIndices(): Promise<TseIndex[]> {
  const now = Date.now();
  if (indicesCache && now - indicesCache.time < CACHE_TTL) {
    return indicesCache.data;
  }
  try {
    const url = `${BASE_URL}/Index.php?key=${API_KEY}&type=3`;
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 }, signal: AbortSignal.timeout(BRSAPI_TIMEOUT) });
    if (!res.ok) throw new Error(`Failed to fetch indices: ${res.status}`);
    const raw = await res.json();
    if (raw && !Array.isArray(raw) && raw.code_http) {
      throw new Error(raw.message_error || `API error: ${raw.code_http}`);
    }
    const data: TseIndex[] = Array.isArray(raw) ? raw : [];
    indicesCache = { data, time: now };
    return data;
  } catch (err) {
    console.warn(`[tse-api] BrsApi indices failed:`, err instanceof Error ? err.message : String(err));
    return [];
  }
}

export async function fetchAllInstruments(): Promise<{
  indices: TseIndex[];
  stocks: TseSymbol[];
  etfs: TseSymbol[];
  goldEtfs: TseSymbol[];
  bonds: TseSymbol[];
  futures: TseSymbol[];
  salaf: TseSymbol[];
  mortgage: TseSymbol[];
  industries: string[];
}> {
  // Fetch type 1 (stocks + ETFs)
  const type1 = await fetchAllSymbols(INSTRUMENT_TYPES.STOCK);
  const stocks = type1.filter((s) => s.cs !== ETF_CATEGORY);
  const allEtfs = type1.filter((s) => s.cs === ETF_CATEGORY);

  // Separate gold ETFs from regular ETFs (gold ETFs use TSE data, not TGJU)
  const goldEtfs = allEtfs.filter((s) => isGoldEtf(s.l18, s.l30));
  const etfs = allEtfs.filter((s) => !isGoldEtf(s.l18, s.l30));

  // Get unique industry names from stocks
  const industrySet = new Set<string>();
  stocks.forEach((s) => { if (s.cs) industrySet.add(s.cs); });
  const industries = Array.from(industrySet).sort();

  // Fetch other types in parallel
  const [bonds, futures, salaf, mortgage, indices] = await Promise.all([
    fetchAllSymbols(INSTRUMENT_TYPES.BOND).catch(() => [] as TseSymbol[]),
    fetchAllSymbols(INSTRUMENT_TYPES.FUTURE).catch(() => [] as TseSymbol[]),
    fetchAllSymbols(INSTRUMENT_TYPES.SALAF).catch(() => [] as TseSymbol[]),
    fetchAllSymbols(INSTRUMENT_TYPES.MORTGAGE).catch(() => [] as TseSymbol[]),
    fetchIndices().catch(() => [] as TseIndex[]),
  ]);

  return { indices, stocks, etfs, goldEtfs, bonds, futures, salaf, mortgage, industries };
}

export async function fetchSymbolData(symbol: string): Promise<Record<string, unknown>> {
  try {
    const url = `${BASE_URL}/Symbol.php?key=${API_KEY}&l18=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    console.warn(`[tse-api] BrsApi symbol data failed for ${symbol}:`, err instanceof Error ? err.message : String(err));
    return {} as Record<string, unknown>;
  }
}

// finpy-tse unified service URL (port 3031 — index + stock data)
const FINPY_SERVICE_URL = 'http://localhost:3031';

/**
 * Fallback 1: Try finpy-tse Python library via service (port 3031).
 * Uses Get_Price_History with 30s timeout.
 * Returns null if service is down or finpy-tse times out.
 */
async function fetchFromFinpyService(symbol: string): Promise<CandleData[] | null> {
  try {
    const url = `${FINPY_SERVICE_URL}/api/stock-history?symbol=${encodeURIComponent(symbol)}&adjust=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) return null;
    const data = await res.json() as { candles?: CandleData[]; source?: string };
    if (!data.candles || data.candles.length === 0) return null;
    console.log(`[tse-api] finpy-tse service returned ${data.candles.length} candles for ${symbol} (source: ${data.source || 'unknown'})`);
    return data.candles;
  } catch {
    return null;
  }
}

export async function fetchCandlestick(
  symbol: string,
  type: number = 3, // ⚠️ ALWAYS use type=3 (تعدیل‌شده / adjusted). Never use 1 (realtime) or 2 (unadjusted).
): Promise<CandleData[]> {
  // Try file cache first (7-day TTL)
  const cached = loadCandleFileCache(symbol, type);
  if (cached && cached.length > 0) {
    console.log(`[tse-api] Using candlestick file cache for ${symbol} (${cached.length} candles)`);
    return cached;
  }

  let brsApiResponded = false;
  let finpyResponded = false;

  // Try BrsApi
  try {
    const url = `${BASE_URL}/Candlestick.php?key=${API_KEY}&type=${type}&l18=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(BRSAPI_TIMEOUT) });
    brsApiResponded = true;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    let candles: CandleData[] = Array.isArray(data)
      ? data
      : data.candle_daily_adjusted || data.candle_daily || data.data || data.candlesticks || [];
if (candles.length > 0) {
      // BrsApi/TSETMC returns newest first — reverse to chronological (oldest first)
      // Use numeric date parsing for robust comparison regardless of digit format
const parseDateNum = (d: string | undefined) => {
        const n = d ? String(d).replace(/[^\d]/g, '') : '';
        return n ? parseInt(n, 10) : 0;
      };
      const firstDateNum = parseDateNum(candles[0]?.date);
      const lastDateNum = parseDateNum(candles[candles.length - 1]?.date);
      if (firstDateNum > lastDateNum) {
        candles.reverse();
      }
      saveCandleFileCache(symbol, type, candles);
      return candles;
    }
  } catch (err) {
    console.warn(`[tse-api] BrsApi candlestick failed for ${symbol}:`, err instanceof Error ? err.message : String(err));
  }

  // Try finpy-tse library as fallback (Python service on port 3031)
  // Uses finpy_tse.Get_Price_History(stock=symbol, adjust_price=True)
  // with 30s timeout — falls through to file cache if unavailable
  console.log(`[tse-api] BRS failed for ${symbol}, trying finpy-tse library fallback...`);
  const finpyCandles = await fetchFromFinpyService(symbol);
  if (finpyCandles) {
    finpyResponded = true;
    if (finpyCandles.length > 0) {
      // finpy-tse returns newest first — reverse to chronological
      const parseDateNum = (d: string | undefined) => {
        const n = d ? String(d).replace(/[^\d]/g, '') : '';
        return n ? parseInt(n, 10) : 0;
      };
      const firstDateNum = parseDateNum(finpyCandles[0]?.date);
      const lastDateNum = parseDateNum(finpyCandles[finpyCandles.length - 1]?.date);
      if (firstDateNum > lastDateNum) {
        finpyCandles.reverse();
      }
      saveCandleFileCache(symbol, type, finpyCandles);
      return finpyCandles;
    }
  }

  // Try expired file cache as last resort
  const stale = loadCandleFileCache(symbol, type, true);
  if (stale && stale.length > 0) {
    console.log(`[tse-api] Using expired candlestick cache for ${symbol} (${stale.length} candles)`);
    return stale;
  }

  // Distinguish between "symbol not found" and "server unreachable"
  if (brsApiResponded || finpyResponded) {
    throw new Error(`داده‌ای برای نماد «${symbol}» یافت نشد. لطفاً نام نماد را بررسی کنید.`);
  }
  throw new Error(`خطا در اتصال به سرور داده. لطفاً بعداً تلاش کنید.`);
}

export async function fetchHistory(symbol: string): Promise<HistoryData[]> {
  try {
    const url = `${BASE_URL}/History.php?key=${API_KEY}&type=0&l18=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(BRSAPI_TIMEOUT) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) return data;
    return data.data || data.history || [];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TSETMC SOAP API Integration
// ═══════════════════════════════════════════════════════════════════════════════

const TSETMC_SOAP_URL = 'http://service.tsetmc.com/WebService/TseClient.asmx';
const TSETMC_TIMEOUT = 15000;

export interface TsetmcInstrument {
  insCode: string;
  instrumentId: string;
  latinSymbol: string;
  symbol: string;
  name: string;
  group: string;
}

export interface TsetmcIndexCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Helper: convert DEven (Jalali date like 14040115) to formatted string "1404/01/15"
 */
function devenToDate(deven: string): string {
  const s = deven.trim();
  if (s.length < 8) return s;
  return `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6, 8)}`;
}

/**
 * Helper: compress data string for TSETMC SOAP API (zlib + 4-byte LE length prefix)
 */
function compressForTsetmc(data: string): string {
  const buf = Buffer.from(data, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.length);
  const compressed = deflateRawSync(buf);
  // Wrap in zlib format manually: 78 9c = zlib default compression header
  const wrapper = Buffer.alloc(2 + compressed.length);
  wrapper[0] = 0x78;
  wrapper[1] = 0x9c;
  compressed.copy(wrapper, 2);
  return Buffer.concat([len, wrapper]).toString('base64');
}

/**
 * Extract text content from <Result> tag in SOAP XML response
 */
function extractSoapResult(xml: string): string | null {
  const match = /<Result[^>]*>([^<]+)<\/Result>/i.exec(xml);
  return match ? match[1] : null;
}

/**
 * Fetch all instruments from TSETMC SOAP API, filter for indices (type="I")
 * Returns null on timeout/error (graceful fallback)
 */
export async function fetchTsetmcInstruments(): Promise<TsetmcInstrument[] | null> {
  try {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><Instrument xmlns="http://tsetmc.com/"><DEven>0</DEven></Instrument></soap:Body></soap:Envelope>`;

    const res = await fetch(TSETMC_SOAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tsetmc.com/Instrument',
      },
      body: soapBody,
      signal: AbortSignal.timeout(TSETMC_TIMEOUT),
    });

    if (!res.ok) return null;

    const xml = await res.text();
    const result = extractSoapResult(xml);
    if (!result) return null;

    const lines = result.split(';').filter((l) => l.trim().length > 0);
    const indices: TsetmcInstrument[] = [];

    for (const line of lines) {
      const fields = line.split(',');
      // type field is index 19, market is index 20
      const type = fields[19]?.trim();
      if (type !== 'I') continue; // Only indices

      const insCode = fields[0]?.trim();
      const instrumentId = fields[1]?.trim();
      const latinSymbol = fields[2]?.trim();
      const symbol = fields[5]?.trim();
      const name = fields[6]?.trim();
      const group = fields[18]?.trim();

      if (insCode && symbol) {
        indices.push({ insCode, instrumentId, latinSymbol, symbol, name, group });
      }
    }

    return indices;
  } catch {
    // Timeout, network error, parse error — graceful fallback
    return null;
  }
}

/**
 * Fetch historical OHLC data for an index from TSETMC SOAP API
 * Returns empty array on timeout/error
 */
export async function fetchTsetmcIndexHistory(insCode: string): Promise<TsetmcIndexCandle[]> {
  try {
    const input = `${insCode},0,1`;
    const compressed = compressForTsetmc(input);

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><DecompressAndGetInsturmentClosingPrice xmlns="http://tsetmc.com/"><insCodes>${compressed}</insCodes></DecompressAndGetInsturmentClosingPrice></soap:Body></soap:Envelope>`;

    const res = await fetch(TSETMC_SOAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tsetmc.com/DecompressAndGetInsturmentClosingPrice',
      },
      body: soapBody,
      signal: AbortSignal.timeout(TSETMC_TIMEOUT),
    });

    if (!res.ok) return [];

    const xml = await res.text();
    const result = extractSoapResult(xml);
    if (!result) return [];

    // The result may be base64 encoded (compressed response)
    let decoded = result;
    // If it looks base64, try to decode
    if (result.length > 100 && /^[A-Za-z0-9+/=]+$/.test(result)) {
      try {
        decoded = inflateSync(Buffer.from(result, 'base64')).toString('utf-8');
      } catch {
        // If decompression fails, use raw result
      }
    }

    const entries = decoded.split(';').filter((e) => e.trim().length > 0);
    if (entries.length === 0) return [];

    const candles: TsetmcIndexCandle[] = [];

    for (const entry of entries) {
      const fields = entry.split(',');
      if (fields.length < 12) continue;

      const dEven = fields[1]?.trim();
      const pClosing = Number(fields[2]);
      const priceMax = Number(fields[8]);
      const priceMin = Number(fields[9]);
      const priceFirst = Number(fields[10]);
      const qTotTran5J = Number(fields[11]);

      if (!dEven || pClosing <= 0) continue;

      candles.push({
        date: devenToDate(dEven),
        open: priceFirst || pClosing,
        high: priceMax || pClosing,
        low: priceMin || pClosing,
        close: pClosing,
        volume: qTotTran5J || 0,
      });
    }

    // TSETMC returns newest first — reverse to chronological
    candles.reverse();

    return candles;
  } catch {
    // Timeout, network error, parse error — graceful fallback
    return [];
  }
}
