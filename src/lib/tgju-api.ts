/**
 * TGJU (Tala-Jaraghi) API Integration
 *
 * Data sources:
 * 1. tgju-api (tgju.amirhossein.info) — fast, real-time prices for currency & gold
 * 2. tgju.org internal API (via z-ai page_reader) — historical daily OHLC data for ALL instruments
 *
 * Chart data API: https://api.tgju.org/v1/market/indicator/summary-table-data/{key}
 * Response format: { recordsTotal, data: [[open, low, high, close, change, changePct, gregorianDate, jalaliDate], ...] }
 */

const TGJU_API_BASE = 'https://tgju.amirhossein.info';
const TGJU_CHART_API = 'https://api.tgju.org/v1/market/indicator/summary-table-data';

/* ─── Types ────────────────────────────────────────────── */

export type TgjuCategoryType =
  | 'currency' | 'gold' | 'silver' | 'gold_etf'
  | 'crypto' | 'world_index' | 'foreign_stock' | 'forex' | 'energy' | 'metal' | 'commodity';

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

/* ─── Static Instrument Definitions ────────────────────── */

interface StaticInstrument {
  title: string;
  key: string;
  category: TgjuCategoryType;
  groupTitle?: string;
}

export const STATIC_INSTRUMENTS: StaticInstrument[] = [
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
  // Americas
  { title: 'داو جونز (آمریکا)', key: 'indices-us30-oanda', category: 'world_index', groupTitle: 'آمریکا' },
  { title: 'نزدک ۱۰۰', key: 'indices-ndx-indx', category: 'world_index', groupTitle: 'آمریکا' },
  { title: 'S&P 500', key: 'indices-xsp-indx', category: 'world_index', groupTitle: 'آمریکا' },
  { title: 'راسل ۲۰۰۰', key: 'indices-midde50-icmarkets', category: 'world_index', groupTitle: 'آمریکا' },
  { title: 'S&P/TSX (کانادا)', key: 'indices-gsptse-indx', category: 'world_index', groupTitle: 'آمریکا' },
  { title: 'IBOVESPA (برزیل)', key: 'indices-bvsp-indx', category: 'world_index', groupTitle: 'آمریکا' },
  { title: 'IPC (مکزیک)', key: 'indices-mxx-indx', category: 'world_index', groupTitle: 'آمریکا' },
  // Europe
  { title: 'داکس (آلمان)', key: 'indices-gdaxi-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'یورواستاکس ۵۰', key: 'indices-sx5e-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'STOXX 600 (اروپا)', key: 'indices-sxxp-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'Euronext 100', key: 'indices-n100-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'CAC 40 (فرانسه)', key: 'indices-fr40-oanda', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'FTSE 100 (انگلستان)', key: 'indices-uk100-oanda', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'ایبکس ۳۵ (اسپانیا)', key: 'indices-ibex-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'FTSE MIB (ایتالیا)', key: 'indices-it40-icmarkets', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'SMI (سوئیس)', key: 'indices-ssmi-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'AEX (هلند)', key: 'indices-aex-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'OMX (سوئد)', key: 'indices-omxs30-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'BEL 20 (بلژیک)', key: 'indices-bfx-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'ATX (اتریش)', key: 'indices-atx-indx', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'WIG (لهستان)', key: 'indices-wig-war', category: 'world_index', groupTitle: 'اروپا' },
  { title: 'ISEQ (ایرلند)', key: 'indices-isec-indx', category: 'world_index', groupTitle: 'اروپا' },
  // Asia-Pacific
  { title: 'نیکی ۲۲۵ (ژاپن)', key: 'indices-jp225-oanda', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'هانگ سنگ (هنگ‌کنگ)', key: 'indices-hk50-pepperstone', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'شاخص چین A۵۰', key: 'indices-chn50-fxcm', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'کوسپی (کره جنوبی)', key: 'indices-ks200-icmarkets', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'شانگهای کامپوزیت', key: 'indices-ssec-indx', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'Sensex (هند)', key: 'indices-bsesn-indx', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'NIFTY ۵۰ (هند)', key: 'indices-nsei-indx', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'SET (تایلند)', key: 'indices-set50-indx', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'ASX 200 (استرالیا)', key: 'indices-xjo-indx', category: 'world_index', groupTitle: 'آسیا' },
  { title: 'تایوان وزنی', key: 'indices-twii-indx', category: 'world_index', groupTitle: 'آسیا' },
  // Middle East & Africa
  { title: 'TASI (عربستان)', key: 'indices-tasi-indx', category: 'world_index', groupTitle: 'خاورمیانه' },
  { title: 'DFMGI (امارات)', key: 'indices-dfmgi-indx', category: 'world_index', groupTitle: 'خاورمیانه' },
  { title: 'بوورسا (ترکیه)', key: 'indices-xu100-is', category: 'world_index', groupTitle: 'خاورمیانه' },
  { title: 'TA-125 (اسرائیل)', key: 'indices-ta125-indx', category: 'world_index', groupTitle: 'خاورمیانه' },
  { title: 'MOEX (روسیه)', key: 'indices-imoex-indx', category: 'world_index', groupTitle: 'سایر' },

  /* ── Foreign Stocks (Tokenized) ───────────────────────── */
  // US Tech
  { title: 'اپل (AAPL)', key: 'crypto-apple-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'مایکروسافت (MSFT)', key: 'crypto-microsoft-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'انویدیا (NVDA)', key: 'crypto-nvidia-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'آلفابت/گوگل (GOOGL)', key: 'crypto-alphabet-class-a-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'متا/فیس‌بوک (META)', key: 'crypto-meta-platforms-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'آمازون (AMZN)', key: 'crypto-amazon-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'تسلا (TSLA)', key: 'crypto-tesla-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'نتفلیکس (NFLX)', key: 'crypto-netflix-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'اینتل (INTC)', key: 'crypto-intel-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'ادوبی (ADBE)', key: 'crypto-adobe-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'برودکام (AVGO)', key: 'crypto-broadcom-tokenized-stock-xstock', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'کوالکام (QCOM)', key: 'crypto-qualcomm-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  // US Finance
  { title: 'جی‌پی مورگان (JPM)', key: 'crypto-jpmorgan-chase-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - مالی' },
  { title: 'گلدمن ساکس (GS)', key: 'crypto-goldman-sachs-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - مالی' },
  { title: 'ویزا (V)', key: 'crypto-visa-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - مالی' },
  { title: 'مسترکارت (MA)', key: 'crypto-mastercard-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - مالی' },
  { title: 'بلاک‌هیلز (BLK)', key: 'crypto-blackrock-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - مالی' },
  // US Healthcare & Consumer
  { title: 'جانسون اند جانسون (JNJ)', key: 'crypto-johnson-johnson-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - مصرفی/بهداشت' },
  { title: 'کوکاکولا (KO)', key: 'crypto-coca-cola-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - مصرفی/بهداشت' },
  { title: 'پفایزر (PFE)', key: 'crypto-pfizer-tokenized-stock-ondo', category: 'foreign_stock', groupTitle: 'آمریکا - مصرفی/بهداشت' },
  // US Other
  { title: 'تیسلا (TSLA) xStock', key: 'crypto-wrapped-tesla-tokenized-stock-xstock', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'میتا (META) xStock', key: 'crypto-wrapped-meta-tokenized-stock-xstock', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  { title: 'کوین‌بیس (COIN)', key: 'crypto-coinbase-tokenized-stock-xstock', category: 'foreign_stock', groupTitle: 'آمریکا - تکنولوژی' },
  // China / Asia
  { title: 'علی‌بابا (BABA)', key: 'crypto-baba', category: 'foreign_stock', groupTitle: 'چین' },
  { title: 'تنسنت', key: 'crypto-tencent', category: 'foreign_stock', groupTitle: 'چین' },
  { title: 'بایدو', key: 'crypto-baidu', category: 'foreign_stock', groupTitle: 'چین' },
  { title: 'جی‌دی کام', key: 'crypto-jd-com', category: 'foreign_stock', groupTitle: 'چین' },

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
  { title: 'پالم', key: 'commodities-palm-oil', category: 'commodity', groupTitle: 'کالاها' },
  { title: 'ذرت (لندن)', key: 'commodities-london-wheat', category: 'commodity', groupTitle: 'غلات' },
];

/* ─── Helpers ──────────────────────────────────────────── */

/**
 * Parse a number that might contain Persian digits, commas, or other formatting.
 * Handles null/undefined/empty strings gracefully.
 */
function parsePersianNum(str: string | null | undefined | number): number {
  if (str === null || str === undefined) return 0;
  const s = String(str);
  if (!s || s.trim() === '-' || s.trim() === '') return 0;
  return Number(s.replace(/[,۰-۹]/g, (c: string) => {
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const idx = persianDigits.indexOf(c);
    return idx >= 0 ? String(idx) : c === ',' ? '' : c;
  }));
}

/**
 * Check if a value looks like a date string (contains / or - and is not a number).
 */
function looksLikeDate(val: string | null | undefined | number): boolean {
  if (!val) return false;
  const s = String(val).trim();
  return /[\/\-]/.test(s) && isNaN(Number(s.replace(/[,۰-۹\/\-]/g, '')));
}

/**
 * Check if a value looks like a percentage (ends with % or is small like 0.5 to 50).
 */
function looksLikePercentage(val: string | null | undefined | number): boolean {
  if (!val) return false;
  const s = String(val).trim();
  if (s.endsWith('%')) return true;
  const n = parsePersianNum(val);
  return !isNaN(n) && Math.abs(n) < 100 && n !== 0;
}

/**
 * Auto-detect column mapping for TGJU API response.
 * Expected format: [open, low, high, close, change, changePct, gregorianDate, jalaliDate]
 * But the API may change column order.
 */
function detectColumnMap(row: (string | number)[]): {
  openIdx: number; highIdx: number; lowIdx: number; closeIdx: number;
  jalaliDateIdx: number; gregorianDateIdx: number;
} | null {
  if (!row || row.length < 6) return null;

  let jalaliDateIdx = -1;
  let gregorianDateIdx = -1;
  const numericIndices: number[] = [];
  const percentageIndices: number[] = [];

  for (let i = 0; i < row.length; i++) {
    const val = row[i];
    if (looksLikeDate(val)) {
      // Jalali dates have Persian digits or format like 1404/05/25
      const s = String(val);
      if (/[۰-۹]/.test(s) || /^14\d{2}/.test(s.replace(/[۰-۹]/g, (d: string) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))) {
        if (jalaliDateIdx === -1) jalaliDateIdx = i;
      } else {
        if (gregorianDateIdx === -1) gregorianDateIdx = i;
      }
    } else if (looksLikePercentage(val)) {
      percentageIndices.push(i);
    } else {
      const n = parsePersianNum(val);
      if (isFinite(n) && n !== 0) {
        numericIndices.push(i);
      }
    }
  }

  // If we couldn't auto-detect dates, fall back to assumed positions
  if (jalaliDateIdx === -1 && row.length >= 8) {
    // Default assumption: row[6] = gregorian, row[7] = jalali
    if (looksLikeDate(row[7])) jalaliDateIdx = 7;
    else if (looksLikeDate(row[6])) jalaliDateIdx = 6;
    if (gregorianDateIdx === -1 && looksLikeDate(row[6]) && jalaliDateIdx !== 6) gregorianDateIdx = 6;
    else if (gregorianDateIdx === -1 && looksLikeDate(row[7]) && jalaliDateIdx !== 7) gregorianDateIdx = 7;
  }

  // Numeric columns (excluding percentages) should be OHLC + change
  // OHLC: typically 4 largest absolute values among non-percentage numerics
  // change: the remaining one
  const ohlcCandidates = numericIndices.filter(i => !percentageIndices.includes(i));

  if (ohlcCandidates.length < 4) {
    // Fallback: assume first 4 numeric columns are OHLC
    if (numericIndices.length >= 4) {
      return {
        openIdx: numericIndices[0],
        highIdx: numericIndices[2],
        lowIdx: numericIndices[1],
        closeIdx: numericIndices[3],
        jalaliDateIdx: jalaliDateIdx >= 0 ? jalaliDateIdx : 7,
        gregorianDateIdx: gregorianDateIdx >= 0 ? gregorianDateIdx : 6,
      };
    }
    return null;
  }

  // Sort by absolute value descending to identify OHLC (largest) vs change (smallest)
  const sorted = ohlcCandidates
    .map(i => ({ idx: i, val: Math.abs(parsePersianNum(row[i])) }))
    .sort((a, b) => b.val - a.val);

  // The 4 largest should be OHLC. Among them, identify high (max) and low (min).
  // open and close are the other two.
  const top4 = sorted.slice(0, 4);
  const maxIdx = top4.reduce((a, b) => a.val > b.val ? a : b).idx;
  const minIdx = top4.reduce((a, b) => a.val < b.val ? a : b).idx;
  const others = top4.filter(x => x.idx !== maxIdx && x.idx !== minIdx);

  // Among the two remaining, the one closer to high is open, the other is close
  // (heuristic: in an uptrend open < close, but we can't assume direction)
  // Default: first = open, second = close
  const openIdx = others[0]?.idx ?? ohlcCandidates[0];
  const closeIdx = others[1]?.idx ?? ohlcCandidates[3];

  return {
    openIdx,
    highIdx: maxIdx,
    lowIdx: minIdx,
    closeIdx,
    jalaliDateIdx: jalaliDateIdx >= 0 ? jalaliDateIdx : row.length - 1,
    gregorianDateIdx: gregorianDateIdx >= 0 ? gregorianDateIdx : row.length - 2,
  };
}

/**
 * Validate a candle's OHLC values for sanity.
 * Returns true if the candle is valid.
 */
function isValidCandle(o: number, h: number, l: number, c: number): boolean {
  if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) return false;
  if (o <= 0 || h <= 0 || l <= 0 || c <= 0) return false;
  // High must be >= Low, Open, Close
  if (h < l || h < o || h < c) return false;
  // Low must be <= High, Open, Close
  if (l > o || l > c) return false;
  // No infinite or extreme values
  if (o > 1e15 || h > 1e15 || l > 1e15 || c > 1e15) return false;
  return true;
}

/* ─── Cache ────────────────────────────────────────────── */

const liveInstrumentsCache: { data: TgjuInstrument[] | null; ts: number } = { data: null, ts: 0 };
const INSTRUMENTS_TTL = 5 * 60 * 1000; // 5 minutes

const historyCache = new Map<string, { data: TgjuOHLC[]; ts: number }>();
const HISTORY_TTL = 30 * 60 * 1000; // 30 minutes

// Cache for static instrument prices (from chart API last 3 candles)
const staticPriceCache = new Map<string, { close: number; high: number; low: number; prevClose: number; ts: number }>();
const STATIC_PRICE_TTL = 10 * 60 * 1000; // 10 minutes

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
          change: 0,
          changePercent: 0,
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
            change: 0,
            changePercent: 0,
            category,
            groupTitle: cat.title,
          });
        }
      }
    }

    // Add static instruments (crypto, world indices, forex, energy, metals, commodities)
    for (const s of STATIC_INSTRUMENTS) {
      const cached = staticPriceCache.get(s.key);
      const price = cached?.close ?? 0;
      instruments.push({
        title: s.title,
        key: s.key,
        price,
        highPrice: cached?.high ?? 0,
        lowPrice: cached?.low ?? 0,
        change: cached ? (cached.close - cached.prevClose) : 0,
        changePercent: cached && cached.prevClose > 0 ? ((cached.close - cached.prevClose) / cached.prevClose) * 100 : 0,
        category: s.category,
        groupTitle: s.groupTitle,
      });
    }

    liveInstrumentsCache.data = instruments;
    liveInstrumentsCache.ts = now;

    // ── Background: fetch chart data for currency/gold to get accurate daily change ──
    backgroundFetchCurrencyGoldChange(instruments).catch(() => {});

    return instruments;
  } catch {
    clearTimeout(timeout);
    return liveInstrumentsCache.data || [];
  }
}

/**
 * Background task: fetch last 2 candles for currency/gold items to compute accurate daily change.
 * Uses direct fetch to avoid queue contention.
 * Only updates change/changePercent — keeps the live price from tgju-api.
 */
async function backgroundFetchCurrencyGoldChange(instruments: TgjuInstrument[]) {
  const currencyGoldItems = instruments.filter(
    (i) => i.category === 'currency' || i.category === 'gold' || i.category === 'silver' || i.category === 'gold_etf'
  );

  // Limit to first 10 to avoid rate-limiting (most important: USD, EUR, gold coin, etc.)
  const priorityKeys = currencyGoldItems.slice(0, 10).map((i) => i.key);

  for (const key of priorityKeys) {
    try {
      const url = `${TGJU_CHART_API}/${key}?lang=fa&order_dir=desc&start=0&length=2`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const jsonStr = await res.text();
      if (!jsonStr.startsWith('{')) continue;

      const data = JSON.parse(jsonStr);
      const rows: string[][] = data.data;
      if (!rows || rows.length < 2) continue;

      const newest = rows[0];
      const prev = rows[1];
      const latestClose = parsePersianNum(newest[3]);
      const prevClose = parsePersianNum(prev[3]);

      if (latestClose > 0 && prevClose > 0) {
        const inst = liveInstrumentsCache.data?.find((i) => i.key === key);
        if (inst) {
          inst.change = latestClose - prevClose;
          inst.changePercent = ((latestClose - prevClose) / prevClose) * 100;
        }
      }
    } catch {
      // skip individual errors
    }
  }
}

/* ─── Fetch historical OHLC data ── */

export async function fetchTgjuHistory(tgjuKey: string): Promise<TgjuOHLC[]> {
  const cached = historyCache.get(tgjuKey);
  const now = Date.now();
  if (cached && now - cached.ts < HISTORY_TTL) {
    return cached.data;
  }

  try {
    const url = `${TGJU_CHART_API}/${tgjuKey}?lang=fa&order_dir=asc&start=0&length=5000`;

    // Server-side fetch — no CORS issues, no ZAI queue needed
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    let jsonStr: string;
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      jsonStr = await res.text();
    } catch (fetchErr) {
      clearTimeout(timer);
      // This is a server-side route — no CORS. If direct fetch fails, the API is down.
      console.warn(`[TGJU] Direct fetch failed for ${tgjuKey}:`, fetchErr instanceof Error ? fetchErr.message : fetchErr);
      return cached?.data || [];
    }

    if (!jsonStr.startsWith('{')) {
      console.warn(`[TGJU] Non-JSON response for ${tgjuKey}: ${jsonStr.slice(0, 100)}`);
      return cached?.data || [];
    }

    const parsed = JSON.parse(jsonStr);
    const rows: (string | number)[][] = parsed.data;

    if (!rows || rows.length === 0) {
      console.warn(`[TGJU] Empty data array for ${tgjuKey}`);
      return cached?.data || [];
    }

    // ── Auto-detect column mapping from first valid row ──
    let colMap = detectColumnMap(rows[0]);

    // If auto-detect failed, try a few more rows
    if (!colMap) {
      for (let r = 1; r < Math.min(5, rows.length); r++) {
        colMap = detectColumnMap(rows[r]);
        if (colMap) break;
      }
    }

    // If still no auto-detect, fall back to assumed column order
    if (!colMap) {
      console.warn(`[TGJU] Could not auto-detect columns for ${tgjuKey}, using default order`);
      colMap = { openIdx: 0, highIdx: 2, lowIdx: 1, closeIdx: 3, jalaliDateIdx: 7, gregorianDateIdx: 6 };
    } else {
      console.log(`[TGJU] Column map for ${tgjuKey}: O=${colMap.openIdx} H=${colMap.highIdx} L=${colMap.lowIdx} C=${colMap.closeIdx} Date=${colMap.jalaliDateIdx}`);
    }

    const { openIdx, highIdx, lowIdx, closeIdx, jalaliDateIdx, gregorianDateIdx } = colMap;

    // ── Parse rows ──
    const candles: TgjuOHLC[] = [];
    let invalidCount = 0;

    for (const row of rows) {
      const rawDate = String(row[jalaliDateIdx] || row[gregorianDateIdx] || '');
      const date = rawDate.replace(/[\/]/g, '-');
      const o = parsePersianNum(row[openIdx]);
      const h = parsePersianNum(row[highIdx]);
      const l = parsePersianNum(row[lowIdx]);
      const c = parsePersianNum(row[closeIdx]);

      if (!isValidCandle(o, h, l, c) || date.length === 0) {
        invalidCount++;
        continue;
      }

      candles.push({ date, open: o, high: h, low: l, close: c });
    }

    if (invalidCount > 0) {
      console.warn(`[TGJU] ${tgjuKey}: ${invalidCount}/${rows.length} invalid candles skipped`);
    }

    if (candles.length === 0) {
      return cached?.data || [];
    }

    // ── Detect and fix data drift ──
    // Check if prices suddenly jump > 50% between consecutive candles
    // (could indicate unit change, decimal shift, or API error)
    let driftCount = 0;
    for (let i = 1; i < candles.length; i++) {
      const prevClose = candles[i - 1].close;
      const currClose = candles[i].close;
      if (prevClose > 0) {
        const pctChange = Math.abs(currClose - prevClose) / prevClose;
        if (pctChange > 0.5) { // > 50% single-day change is suspicious for most instruments
          driftCount++;
        }
      }
    }
    if (driftCount > candles.length * 0.1) { // > 10% of candles have suspicious jumps
      console.warn(`[TGJU] ${tgjuKey}: Possible data drift detected (${driftCount} suspicious jumps out of ${candles.length} candles)`);
    }

    // Reverse: API returns oldest-first (asc), we want newest-last for charting
    // But check: if the first date is newer than the last, data is already desc
    const firstDate = candles[0].date;
    const lastDate = candles[candles.length - 1].date;
    if (firstDate > lastDate) {
      candles.reverse();
    }

    console.log(`[TGJU] ${tgjuKey}: Parsed ${candles.length} candles (${candles[0]?.date} to ${candles[candles.length - 1]?.date})`);

    // Cache the result
    historyCache.set(tgjuKey, { data: candles, ts: now });

    // Also update static price cache for this instrument
    if (candles.length >= 2) {
      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2];
      staticPriceCache.set(tgjuKey, {
        close: last.close,
        high: last.high,
        low: last.low,
        prevClose: prev.close,
        ts: now,
      });

      // Update live instruments cache if this is a static instrument
      if (liveInstrumentsCache.data) {
        const inst = liveInstrumentsCache.data.find((i) => i.key === tgjuKey);
        if (inst && inst.price === 0) {
          inst.price = last.close;
          inst.highPrice = last.high;
          inst.lowPrice = last.low;
          inst.change = last.close - prev.close;
          inst.changePercent = prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;
        }
      }
    }

    return candles;
  } catch (err) {
    console.error(`[TGJU] Failed to fetch history for ${tgjuKey}:`, err);
    return cached?.data || [];
  }
}

/* ─── Categories for UI ──────────────────────────────── */

export const TGJU_CATEGORY_INFO: Record<string, { label: string; color: string; badge: string }> = {
  currency:      { label: 'ارزها', color: 'bg-teal-500/15 text-teal-400', badge: 'ارز' },
  gold:          { label: 'طلا و سکه', color: 'bg-yellow-500/15 text-yellow-400', badge: 'طلا' },
  silver:        { label: 'نقره', color: 'bg-gray-400/15 text-gray-300', badge: 'نقره' },
  gold_etf:      { label: 'صندوق طلای بورس', color: 'bg-amber-500/15 text-amber-400', badge: 'صندوق طلا' },
  crypto:        { label: 'ارزهای دیجیتال', color: 'bg-orange-500/15 text-orange-400', badge: 'کریپتو' },
  foreign_stock: { label: 'سهام خارجی', color: 'bg-sky-500/15 text-sky-400', badge: 'سهام خارجی' },
  world_index:   { label: 'شاخص بورس جهانی', color: 'bg-blue-500/15 text-blue-400', badge: 'شاخص جهانی' },
  forex:         { label: 'جفت ارزها', color: 'bg-violet-500/15 text-violet-400', badge: 'فارکس' },
  energy:        { label: 'نفت و انرژی', color: 'bg-red-500/15 text-red-400', badge: 'انرژی' },
  metal:         { label: 'فلزات جهانی', color: 'bg-emerald-500/15 text-emerald-400', badge: 'فلز' },
  commodity:     { label: 'کالاهای جهانی', color: 'bg-lime-500/15 text-lime-400', badge: 'کالا' },
};
