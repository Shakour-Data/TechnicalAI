/**
 * TGJU (Tala-Jaraghi) API Integration
 *
 * Data sources:
 * 1. tgju-api (tgju.amirhossein.info) — fast, real-time prices for currency & gold
 * 2. tgju.org internal API (via z-ai page_reader) — historical daily OHLC data for ALL instruments
 *
 * Chart data API: https://api.tgju.org/v1/market/indicator/summary-table-data/{key}
 * Response format: { recordsTotal, data: [[open, low, high, close, change, changePct, gregorianDate, jalaliDate], ...] }
 *
 * IMPORTANT: All TSE candlestick data uses type=3 (تعدیل شده / adjusted prices).
 */

const TGJU_API_BASE = 'https://tgju.amirhossein.info';
const TGJU_CHART_API = 'https://api.tgju.org/v1/market/indicator/summary-table-data';

/* ─── Types ────────────────────────────────────────────── */

export type TgjuCategoryType =
  | 'currency' | 'gold' | 'silver' | 'gold_etf'
  | 'crypto' | 'world_index' | 'forex' | 'energy' | 'metal' | 'commodity';

export interface TgjuPriceItem {
  title: string;
  price: string;
  key: string;
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
  category: TgjuCategoryType;
  groupTitle?: string;
}

export interface TgjuOHLC {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/* ─── Static Instrument Definitions ──────────────────────
 * These are instruments whose real-time prices come from the tgju.org chart API.
 * For crypto, world indices, forex, energy, metals, commodities — we fetch the
 * latest price from the most recent candle in the historical data.
 */

interface StaticInstrument {
  title: string;
  key: string;
  category: TgjuCategoryType;
  groupTitle?: string;
}

const STATIC_INSTRUMENTS: StaticInstrument[] = [
  /* ── Crypto ──────────────────────────────────────────── */
  { title: 'بیت کوین', key: 'crypto-bitcoin', category: 'crypto' },
  { title: 'اتریوم', key: 'crypto-ethereum', category: 'crypto' },
  { title: 'لایت کوین', key: 'crypto-litecoin', category: 'crypto' },
  { title: 'ریپل', key: 'crypto-ripple', category: 'crypto' },
  { title: 'بیت کش', key: 'crypto-bitcoin-cash', category: 'crypto' },
  { title: 'کاردانو', key: 'crypto-cardano', category: 'crypto' },
  { title: 'استلار', key: 'crypto-stellar', category: 'crypto' },
  { title: 'تتر', key: 'crypto-tether', category: 'crypto' },
  { title: 'مونرو', key: 'crypto-monero', category: 'crypto' },
  { title: 'دش', key: 'crypto-dash', category: 'crypto' },
  { title: 'ای او اس', key: 'crypto-eos', category: 'crypto' },
  { title: 'نئو', key: 'crypto-neo', category: 'crypto' },
  { title: 'آیوتا', key: 'crypto-iota', category: 'crypto' },

  /* ── World Stock Indices ──────────────────────────────── */
  { title: 'داو جونز (آمریکا)', key: 'indices-us30-oanda', category: 'world_index', groupTitle: 'آمریکا' },
  { title: 'نزدک ۱۰۰', key: 'indices-ndx-indx', category: 'world_index', groupTitle: 'آمریکا' },
  { title: 'S&P 500', key: 'indices-xsp-indx', category: 'world_index', groupTitle: 'آمریکا' },
  { title: 'راسل ۲۰۰۰', key: 'indices-midde50-icmarkets', category: 'world_index', groupTitle: 'آمریکا' },
  { title: 'داکس (آلمان)', key: 'indices-gdaxi-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'یورواستاکس ۵۰', key: 'indices-sxxp-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'CAC 40 (فرانسه)', key: 'indices-fr40-oanda', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'FTSE 100 (انگلستان)', key: 'indices-uk100-oanda', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'ایبکس ۳۵ (اسپانیا)', key: 'indices-ibex-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'SMI (سوئیس)', key: 'indices-ssmi-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'AEX (هلند)', key: 'indices-aex-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'نیکی ۲۲۵ (ژاپن)', key: 'indices-jp225-oanda', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'هانگ سنگ (هنگ‌کنگ)', key: 'indices-hk50-pepperstone', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'شاخص چین A50', key: 'indices-chn50-fxcm', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'کوسپی (کره جنوبی)', key: 'indices-ks200-icmarkets', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'شانگهای کامپوزیت', key: 'indices-ssec-indx', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'SET (تایلند)', key: 'indices-set50-indx', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'TASI (عربستان)', key: 'indices-tasi-indx', category: 'world_index', groupTitle: 'خاورمیانه' },
  { title: 'DFMGI (امارات)', key: 'indices-dfmgi-indx', category: 'world_index', groupTitle: 'خاورمیانه' },
  { title: 'بوورسا (ترکیه)', key: 'indices-xu100-is', category: 'world_index', groupTitle: 'خاورمیانه' },
  { title: 'ISEQ (ایرلند)', key: 'indices-isec-indx', category: 'world_index', groupTitle: 'اروپا' },

  /* ── Forex Pairs (Major) ──────────────────────────────── */
  { title: 'یورو / دلار', key: 'eur-usd-ask', category: 'forex', groupTitle: 'جفت‌ارزهای اصلی' },
  { title: 'پوند / دلار', key: 'gbp-usd-ask', category: 'forex', groupTitle: 'جفت‌ارزهای اصلی' },
  { title: 'دلار / ین', key: 'usd-jpy-ask', category: 'forex', groupTitle: 'جفت‌ارزهای اصلی' },
  { title: 'دلار / فرانک سویس', key: 'usd-chf-ask', category: 'forex', groupTitle: 'جفت‌ارزهای اصلی' },
  { title: 'دلار استرالیا / دلار', key: 'aud-usd-ask', category: 'forex', groupTitle: 'جفت‌ارزهای اصلی' },
  { title: 'دلار نیوزیلند / دلار', key: 'nzd-usd-ask', category: 'forex', groupTitle: 'جفت‌ارزهای اصلی' },
  { title: 'دلار / دلار کانادا', key: 'usd-cad-ask', category: 'forex', groupTitle: 'جفت‌ارزهای اصلی' },
  { title: 'دلار / لیر ترکیه', key: 'usd-try-ask', category: 'forex', groupTitle: 'اگزوتیک' },
  { title: 'دلار / روبل روسیه', key: 'usd-rub-ask', category: 'forex', groupTitle: 'اگزوتیک' },
  { title: 'دلار / کرون سوئد', key: 'usd-sek-ask', category: 'forex', groupTitle: 'اگزوتیک' },
  { title: 'دلار / کرون نروژ', key: 'usd-nok-ask', category: 'forex', groupTitle: 'اگزوتیک' },
  { title: 'دلار / یوان چین', key: 'usd-cny-ask', category: 'forex', groupTitle: 'اگزوتیک' },
  { title: 'دلار / پزو مکزیک', key: 'usd-mxn-ask', category: 'forex', groupTitle: 'اگزوتیک' },
  { title: 'دلار / رند آفریقای جنوبی', key: 'brl-usd-ask', category: 'forex', groupTitle: 'اگزوتیک' },
  { title: 'دلار / درهم امارات', key: 'usd-aed-ask', category: 'forex', groupTitle: 'اگزوتیک' },
  { title: 'دلار / دلار سنگاپور', key: 'usd-sgd-ask', category: 'forex', groupTitle: 'اگزوتیک' },

  /* ── Oil & Energy ─────────────────────────────────────── */
  { title: 'نفت برنت', key: 'energy-brent-oil', category: 'energy', groupTitle: 'نفت' },
  { title: 'نفت وست تگزاس (WTI)', key: 'energy-crude-oil', category: 'energy', groupTitle: 'نفت' },
  { title: 'نفت اوپک', key: 'oil_opec', category: 'energy', groupTitle: 'نفت' },
  { title: 'گاز طبیعی', key: 'energy-natural-gas', category: 'energy', groupTitle: 'انرژی' },
  { title: 'بنزین', key: 'energy-gasoline-rbob', category: 'energy', groupTitle: 'انرژی' },
  { title: ' LSM Marker', key: 'lng-japan-korea-marker', category: 'energy', groupTitle: 'انرژی' },

  /* ── World Metals ─────────────────────────────────────── */
  { title: 'انس جهانی طلا', key: 'ons', category: 'metal', groupTitle: 'فلزات گران‌بها' },
  { title: 'نقره جهانی', key: 'silver', category: 'metal', groupTitle: 'فلزات گران‌بها' },
  { title: 'پلاتین', key: 'platinum', category: 'metal', groupTitle: 'فلزات گران‌بها' },
  { title: 'پالادیوم', key: 'palladium', category: 'metal', groupTitle: 'فلزات گران‌بها' },
  { title: 'مس', key: 'basemetal-copper', category: 'metal', groupTitle: 'فلزات پایه' },
  { title: 'آلومینیوم', key: 'basemetal-aluminum', category: 'metal', groupTitle: 'فلزات پایه' },
  { title: 'روی', key: 'basemetal-zinc', category: 'metal', groupTitle: 'فلزات پایه' },
  { title: 'نیکل', key: 'basemetal-nickel', category: 'metal', groupTitle: 'فلزات پایه' },
  { title: 'سرب', key: 'basemetal-lead', category: 'metal', groupTitle: 'فلزات پایه' },
  { title: 'قلع', key: 'basemetal-tin', category: 'metal', groupTitle: 'فلزات پایه' },

  /* ── Global Commodities ───────────────────────────────── */
  { title: 'گندم (آمریکا)', key: 'commodities-us-wheat', category: 'commodity', groupTitle: 'غلات' },
  { title: 'ذرت', key: 'commodities-us-corn', category: 'commodity', groupTitle: 'غلات' },
  { title: 'سویا', key: 'commodities-us-soybeans', category: 'commodity', groupTitle: 'غلات' },
  { title: 'برنج', key: 'commodities-rough-rice', category: 'commodity', groupTitle: 'غلات' },
  { title: 'پنبه', key: 'commodities-us-cotton', category: 'commodity', groupTitle: 'کالاها' },
  { title: 'قهوه', key: 'commodities-us-cocoa', category: 'commodity', groupTitle: 'کالاها' },
  { title: 'شکر', key: 'commodities-us-sugar', category: 'commodity', groupTitle: 'کالاها' },
  { title: 'شکلات', key: 'commodities-london-cocoa', category: 'commodity', groupTitle: 'کالاها' },
  { title: 'روغن سویا', key: 'commodities-us-soybean-oil', category: 'commodity', groupTitle: 'کالاها' },
];

/* ─── Helpers ──────────────────────────────────────────── */

function parsePersianNum(str: string | null | undefined): number {
  if (!str) return 0;
  return Number(str.replace(/[,۰-۹]/g, (c) => {
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const idx = persianDigits.indexOf(c);
    return idx >= 0 ? idx : c === ',' ? '' : c;
  }));
}

/* ─── Cache ────────────────────────────────────────────── */

const liveInstrumentsCache: { data: TgjuInstrument[] | null; ts: number } = { data: null, ts: 0 };
const INSTRUMENTS_TTL = 5 * 60 * 1000; // 5 minutes

const historyCache = new Map<string, { data: TgjuOHLC[]; ts: number }>();
const HISTORY_TTL = 30 * 60 * 1000; // 30 minutes

/* ─── Fetch live instruments (currency + gold from tgju-api) + static list ── */

export async function fetchTgjuInstruments(): Promise<TgjuInstrument[]> {
  const now = Date.now();
  if (liveInstrumentsCache.data && now - liveInstrumentsCache.ts < INSTRUMENTS_TTL) {
    return liveInstrumentsCache.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const [currencyRes, goldRes] = await Promise.all([
      fetch(`${TGJU_API_BASE}/api/price/currency`, { signal: controller.signal }),
      fetch(`${TGJU_API_BASE}/api/price/gold`, { signal: controller.signal }),
    ]);

    clearTimeout(timeout);

    const instruments: TgjuInstrument[] = [];

    if (currencyRes.ok) {
      const currencies: TgjuPriceItem[] = await currencyRes.json();
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
    }

    if (goldRes.ok) {
      const goldCategories: TgjuGoldCategory[] = await goldRes.json();
      for (const cat of goldCategories) {
        for (const item of cat.prices) {
          const price = parsePersianNum(item.price);
          const low = parsePersianNum(item.low_price);
          const high = parsePersianNum(item.high_price);

          let category: TgjuCategoryType = 'gold';
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
    }

    // Add static instruments (no live price — price will be fetched from chart data)
    for (const s of STATIC_INSTRUMENTS) {
      instruments.push({
        title: s.title,
        key: s.key,
        price: 0,
        highPrice: 0,
        lowPrice: 0,
        change: 0,
        changePercent: 0,
        category: s.category,
        groupTitle: s.groupTitle,
      });
    }

    liveInstrumentsCache.data = instruments;
    liveInstrumentsCache.ts = now;
    return instruments;
  } catch {
    clearTimeout(timeout);
    return liveInstrumentsCache.data || [];
  }
}

/* ─── Fetch historical OHLC data via z-ai page_reader ── */

export async function fetchTgjuHistory(tgjuKey: string): Promise<TgjuOHLC[]> {
  const cached = historyCache.get(tgjuKey);
  const now = Date.now();
  if (cached && now - cached.ts < HISTORY_TTL) {
    return cached.data;
  }

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

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
    const candles: TgjuOHLC[] = rows
      .map((row) => ({
        date: row[7] || row[6] || '',
        open: parsePersianNum(row[0]),
        high: parsePersianNum(row[2]),
        low: parsePersianNum(row[1]),
        close: parsePersianNum(row[3]),
      }))
      .filter((c) => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
      .reverse(); // newest-last for charting

    historyCache.set(tgjuKey, { data: candles, ts: now });
    return candles;
  } catch (err) {
    console.error(`[TGJU] Failed to fetch history for ${tgjuKey}:`, err);
    return cached?.data || [];
  }
}

/* ─── Categories for UI ──────────────────────────────── */

export const TGJU_CATEGORY_INFO: Record<string, { label: string; color: string; badge: string }> = {
  currency: { label: 'ارزها', color: 'bg-teal-500/15 text-teal-400', badge: 'ارز' },
  gold:     { label: 'طلا و سکه', color: 'bg-yellow-500/15 text-yellow-400', badge: 'طلا' },
  silver:   { label: 'نقره', color: 'bg-gray-400/15 text-gray-300', badge: 'نقره' },
  gold_etf: { label: 'صندوق طلای بورس', color: 'bg-amber-500/15 text-amber-400', badge: 'صندوق طلا' },
  crypto:      { label: 'ارزهای دیجیتال', color: 'bg-orange-500/15 text-orange-400', badge: 'کریپتو' },
  world_index: { label: 'شاخص بورس جهانی', color: 'bg-blue-500/15 text-blue-400', badge: 'شاخص جهانی' },
  forex:       { label: 'جفت ارزها', color: 'bg-violet-500/15 text-violet-400', badge: 'فارکس' },
  energy:      { label: 'نفت و انرژی', color: 'bg-red-500/15 text-red-400', badge: 'انرژی' },
  metal:       { label: 'فلزات جهانی', color: 'bg-emerald-500/15 text-emerald-400', badge: 'فلز' },
  commodity:   { label: 'کالاهای جهانی', color: 'bg-lime-500/15 text-lime-400', badge: 'کالا' },
};
