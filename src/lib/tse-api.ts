const API_KEY = "BA9C8JBliDmfPapn9WYTX76uR5Q3m2r3";
const BASE_URL = "https://Api.BrsApi.ir/Tsetmc";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchAllSymbols(type: number = 1): Promise<TseSymbol[]> {
  const now = Date.now();
  const cached = symbolsCaches.get(type);
  if (cached && now - cached.time < CACHE_TTL) {
    return cached.data;
  }
  const url = `${BASE_URL}/AllSymbols.php?key=${API_KEY}&type=${type}`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Failed to fetch symbols (type=${type}): ${res.status}`);
  const raw = await res.json();
  // Check for API error response
  if (raw && !Array.isArray(raw) && raw.code_http) {
    throw new Error(raw.message_error || `API error: ${raw.code_http}`);
  }
  const data: TseSymbol[] = Array.isArray(raw) ? raw : raw.data || raw.symbols || [];
  symbolsCaches.set(type, { data, time: now });
  return data;
}

export async function fetchIndices(): Promise<TseIndex[]> {
  const now = Date.now();
  if (indicesCache && now - indicesCache.time < CACHE_TTL) {
    return indicesCache.data;
  }
  const url = `${BASE_URL}/Index.php?key=${API_KEY}&type=3`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Failed to fetch indices: ${res.status}`);
  const raw = await res.json();
  if (raw && !Array.isArray(raw) && raw.code_http) {
    throw new Error(raw.message_error || `API error: ${raw.code_http}`);
  }
  const data: TseIndex[] = Array.isArray(raw) ? raw : [];
  indicesCache = { data, time: now };
  return data;
}

export async function fetchAllInstruments(): Promise<{
  indices: TseIndex[];
  stocks: TseSymbol[];
  etfs: TseSymbol[];
  bonds: TseSymbol[];
  futures: TseSymbol[];
  salaf: TseSymbol[];
  mortgage: TseSymbol[];
  industries: string[];
}> {
  // Fetch type 1 (stocks + ETFs)
  const type1 = await fetchAllSymbols(INSTRUMENT_TYPES.STOCK);
  const stocks = type1.filter((s) => s.cs !== ETF_CATEGORY);
  const etfs = type1.filter((s) => s.cs === ETF_CATEGORY);

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

  return { indices, stocks, etfs, bonds, futures, salaf, mortgage, industries };
}

export async function fetchSymbolData(symbol: string): Promise<Record<string, unknown>> {
  const url = `${BASE_URL}/Symbol.php?key=${API_KEY}&l18=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to fetch symbol ${symbol}: ${res.status}`);
  return res.json();
}

export async function fetchCandlestick(
  symbol: string,
  type: number = 3 // 1=realtime 2min, 2=daily unadjusted, 3=daily adjusted
): Promise<CandleData[]> {
  const url = `${BASE_URL}/Candlestick.php?key=${API_KEY}&type=${type}&l18=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to fetch candlestick for ${symbol}: ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.candle_daily_adjusted || data.candle_daily || data.data || data.candlesticks || [];
}

export async function fetchHistory(symbol: string): Promise<HistoryData[]> {
  const url = `${BASE_URL}/History.php?key=${API_KEY}&type=0&l18=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to fetch history for ${symbol}: ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.data || data.history || [];
}
