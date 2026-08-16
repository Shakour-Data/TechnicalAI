/**
 * TGJU (Tala-Jaraghi) API Integration
 *
 * Data sources:
 * 1. tgju-api (tgju.amirhossein.info) — fast, real-time prices for currency & gold
 * 2. tgju.org internal API (via z-ai page_reader) — historical daily OHLC data
 *
 * Chart data API: https://api.tgju.org/v1/market/indicator/summary-table-data/{key}
 * Response format: { recordsTotal, data: [[open, low, high, close, change, changePct, gregorianDate, jalaliDate], ...] }
 */

const TGJU_API_BASE = 'https://tgju.amirhossein.info';
const TGJU_CHART_API = 'https://api.tgju.org/v1/market/indicator/summary-table-data';

/* ─── Types ────────────────────────────────────────────── */

export interface TgjuPriceItem {
  title: string;
  price: string;       // e.g. "1,866,800"
  key: string;          // e.g. "price_dollar_rl"
  status: string | null;
  low_price: string | null;
  high_price: string | null;
}

export interface TgjuGoldCategory {
  title: string;
  prices: TgjuPriceItem[];
}

export interface TgjuInstrument {
  title: string;
  key: string;
  price: number;
  highPrice: number;
  lowPrice: number;
  change: number;
  changePercent: number;
  category: 'currency' | 'gold' | 'silver' | 'gold_etf';
  groupTitle?: string;
}

export interface TgjuOHLC {
  date: string;      // Jalali date e.g. "1405/05/25"
  open: number;
  high: number;
  low: number;
  close: number;
}

/* ─── Helpers ──────────────────────────────────────────── */

function parsePersianNum(str: string | null | undefined): number {
  if (!str) return 0;
  return Number(str.replace(/[,۰-۹]/g, (c) => {
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const idx = persianDigits.indexOf(c);
    return idx >= 0 ? idx : c === ',' ? '' : c;
  }));
}

function toGregorianDate(jalaliStr: string): string {
  // jalaliStr: "1405/05/25" → "2026-08-16" (approximate, for chart display)
  // We use the gregorian date from the API instead when available
  return jalaliStr;
}

/* ─── Cache ────────────────────────────────────────────── */

const instrumentsCache: { data: TgjuInstrument[] | null; ts: number } = { data: null, ts: 0 };
const INSTRUMENTS_TTL = 5 * 60 * 1000; // 5 minutes

const historyCache = new Map<string, { data: TgjuOHLC[]; ts: number }>();
const HISTORY_TTL = 30 * 60 * 1000; // 30 minutes

/* ─── Fetch instruments from tgju-api ─────────────────── */

export async function fetchTgjuInstruments(): Promise<TgjuInstrument[]> {
  const now = Date.now();
  if (instrumentsCache.data && now - instrumentsCache.ts < INSTRUMENTS_TTL) {
    return instrumentsCache.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const [currencyRes, goldRes] = await Promise.all([
      fetch(`${TGJU_API_BASE}/api/price/currency`, { signal: controller.signal }),
      fetch(`${TGJU_API_BASE}/api/price/gold`, { signal: controller.signal }),
    ]);

    clearTimeout(timeout);

    if (!currencyRes.ok || !goldRes.ok) {
      return instrumentsCache.data || [];
    }

    const currencies: TgjuPriceItem[] = await currencyRes.json();
    const goldCategories: TgjuGoldCategory[] = await goldRes.json();

    const instruments: TgjuInstrument[] = [];

    // Add currencies
    for (const c of currencies) {
      const price = parsePersianNum(c.price);
      const low = parsePersianNum(c.low_price);
      const high = parsePersianNum(c.high_price);
      instruments.push({
        title: c.title,
        key: c.key,
        price,
        highPrice: high,
        lowPrice: low,
        change: high - low > 0 ? price - low : 0,
        changePercent: low > 0 ? ((price - low) / low) * 100 : 0,
        category: 'currency',
      });
    }

    // Add gold items (categorized)
    for (const cat of goldCategories) {
      for (const item of cat.prices) {
        const price = parsePersianNum(item.price);
        const low = parsePersianNum(item.low_price);
        const high = parsePersianNum(item.high_price);

        let category: TgjuInstrument['category'] = 'gold';
        if (item.key.startsWith('ime_fund_')) category = 'gold_etf';
        else if (item.key.startsWith('silver_')) category = 'silver';

        instruments.push({
          title: item.title,
          key: item.key,
          price,
          highPrice: high,
          lowPrice: low,
          change: low > 0 ? price - low : 0,
          changePercent: low > 0 ? ((price - low) / low) * 100 : 0,
          category,
          groupTitle: cat.title,
        });
      }
    }

    instrumentsCache.data = instruments;
    instrumentsCache.ts = now;
    return instruments;
  } catch {
    clearTimeout(timeout);
    return instrumentsCache.data || [];
  }
}

/* ─── Fetch historical OHLC data via z-ai page_reader ── */

export async function fetchTgjuHistory(tgjuKey: string): Promise<TgjuOHLC[]> {
  // Check cache
  const cached = historyCache.get(tgjuKey);
  const now = Date.now();
  if (cached && now - cached.ts < HISTORY_TTL) {
    return cached.data;
  }

  try {
    // Use z-ai SDK to bypass Cloudflare
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    // Fetch in batches of 2000 records (max practical for page_reader)
    const url = `${TGJU_CHART_API}/${tgjuKey}?lang=fa&order_dir=asc&start=0&length=5000`;

    const result = await zai.functions.invoke('page_reader', { url });
    const html = result.data.html || '';

    // Strip HTML tags (page_reader wraps in <pre> tags)
    const jsonStr = html.replace(/<[^>]+>/g, '').trim();

    if (!jsonStr.startsWith('{')) {
      return [];
    }

    const data = JSON.parse(jsonStr);
    const rows: string[][] = data.data;

    if (!rows || rows.length === 0) {
      return [];
    }

    // Parse: [open, low, high, close, change, changePct, gregorianDate, jalaliDate]
    // Note: the API returns newest first, so we reverse for chronological order
    const candles: TgjuOHLC[] = rows
      .map((row) => ({
        date: row[7] || row[6] || '',  // Prefer Jalali date
        open: parsePersianNum(row[0]),
        high: parsePersianNum(row[2]),
        low: parsePersianNum(row[1]),
        close: parsePersianNum(row[3]),
      }))
      .filter((c) => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
      .reverse(); // newest-last for charting

    // Cache result
    historyCache.set(tgjuKey, { data: candles, ts: now });
    return candles;
  } catch (err) {
    console.error(`[TGJU] Failed to fetch history for ${tgjuKey}:`, err);
    return cached?.data || [];
  }
}

/* ─── Categories for UI ──────────────────────────────── */

export const TGJU_CATEGORY_INFO = {
  currency: {
    label: 'ارزها',
    color: 'bg-teal-500/15 text-teal-400',
    badge: 'ارز',
  },
  gold: {
    label: 'طلا و سکه',
    color: 'bg-yellow-500/15 text-yellow-400',
    badge: 'طلا',
  },
  silver: {
    label: 'نقره',
    color: 'bg-gray-400/15 text-gray-300',
    badge: 'نقره',
  },
  gold_etf: {
    label: 'صندوق طلای بورس',
    color: 'bg-amber-500/15 text-amber-400',
    badge: 'صندوق طلا',
  },
} as const;
