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

// Cache for symbols list
let symbolsCache: TseSymbol[] | null = null;
let symbolsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchAllSymbols(type: number = 1): Promise<TseSymbol[]> {
  const now = Date.now();
  if (symbolsCache && now - symbolsCacheTime < CACHE_TTL) {
    return symbolsCache;
  }
  const url = `${BASE_URL}/AllSymbols.php?key=${API_KEY}&type=${type}`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Failed to fetch symbols: ${res.status}`);
  const data = await res.json();
  // The API returns an object with symbol data
  symbolsCache = Array.isArray(data) ? data : data.data || data.symbols || Object.values(data).flat().filter((d: unknown) => d && typeof d === 'object' && 'l18' in (d as object));
  symbolsCacheTime = now;
  return symbolsCache;
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
