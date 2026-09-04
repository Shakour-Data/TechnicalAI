/**
 * TGJU (Tala-Jaraghi) API Integration
 *
 * Data sources (in priority order for historical data):
 * 1. Yahoo Finance — PRIMARY for global instruments (crypto, indices, forex, energy, metals, commodities)
 * 2. tgju-api (tgju.amirhossein.info) — fast, real-time prices for currency & gold
 * 3. api.tgju.org — historical daily OHLC (often blocked by Cloudflare, 403)
 * 4. z-ai page_reader — bypasses Cloudflare (rate-limited, queued with backoff)
 *
 * Chart data API: https://api.tgju.org/v1/market/indicator/summary-table-data/{key}
 * Response format: { recordsTotal, data: [[open, low, high, close, change, changePct, gregorianDate, jalaliDate], ...] }
 */

import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

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

/* ─── TGJU → Yahoo Finance Fallback Map ─────────────── */
/**
 * Maps TGJU static instrument keys to Yahoo Finance symbols.
 * Used when api.tgju.org returns 403 (blocked) so we fall back to Yahoo.
 * Only instruments with Yahoo equivalents are mapped.
 */
export const TGJU_TO_YAHOO_MAP: Record<string, string> = {
  // Crypto
  'crypto-bitcoin': 'BTC-USD',
  'crypto-ethereum': 'ETH-USD',
  'crypto-litecoin': 'LTC-USD',
  'crypto-ripple': 'XRP-USD',
  'crypto-bitcoin-cash': 'BCH-USD',
  'crypto-cardano': 'ADA-USD',
  'crypto-stellar': 'XLM-USD',
  'crypto-tether': 'USDT-USD',
  'crypto-monero': 'XMR-USD',
  'crypto-dash': 'DASH-USD',
  'crypto-eos': 'EOS-USD',
  'crypto-neo': 'NEO-USD',
  'crypto-iota': 'MIOTA-USD',

  // World Indices — Americas
  'indices-us30-oanda': '^DJI',
  'indices-ndx-indx': '^NDX',
  'indices-xsp-indx': '^GSPC',
  'indices-midde50-icmarkets': '^RUT',
  'indices-gsptse-indx': '^GSPTSE',
  'indices-bvsp-indx': '^BVSP',
  'indices-mxx-indx': '^MXX',
  // World Indices — Europe
  'indices-gdaxi-indx': '^GDAXI',
  'indices-sx5e-indx': '^STOXX50E',
  'indices-sxxp-indx': '^STOXX',
  'indices-n100-indx': '^N100',
  'indices-fr40-oanda': '^FCHI',
  'indices-uk100-oanda': '^FTSE',
  'indices-ibex-indx': '^IBEX',
  'indices-it40-icmarkets': '^MIB',
  'indices-ssmi-indx': '^SSMI',
  'indices-aex-indx': '^AEX',
  'indices-omxs30-indx': '^OMX',
  'indices-bfx-indx': '^BFX',
  'indices-atx-indx': '^ATX',
  'indices-wig-war': '^WIG',
  'indices-isec-indx': '^ISEQ',
  'indices-imoex-indx': '^IMOEX',
  // World Indices — Asia-Pacific
  'indices-jp225-oanda': '^N225',
  'indices-hk50-pepperstone': '^HSI',
  'indices-ks200-icmarkets': '^KS11',
  'indices-chn50-fxcm': 'XINA50.F', // China A50 on Frankfurt exchange
  'indices-ssec-indx': '^000001.SS',
  'indices-bsesn-indx': '^BSI',
  'indices-nsei-indx': '^NSEI',
  'indices-set50-indx': '^SET',
  'indices-xjo-indx': '^AXJO',
  'indices-twii-indx': '^TWII',
  // World Indices — Middle East
  'indices-tasi-indx': '^TASI',
  'indices-dfmgi-indx': '^DFMGI',
  'indices-xu100-is': '^XU100',
  'indices-ta125-indx': '^TA125',

  // Foreign Stocks (Tokenized) → Real Yahoo tickers
  'crypto-apple-tokenized-stock-ondo': 'AAPL',
  'crypto-microsoft-tokenized-stock-ondo': 'MSFT',
  'crypto-nvidia-tokenized-stock-ondo': 'NVDA',
  'crypto-alphabet-class-a-tokenized-stock-ondo': 'GOOGL',
  'crypto-meta-platforms-tokenized-stock-ondo': 'META',
  'crypto-amazon-tokenized-stock-ondo': 'AMZN',
  'crypto-tesla-tokenized-stock-ondo': 'TSLA',
  'crypto-netflix-tokenized-stock-ondo': 'NFLX',
  'crypto-intel-tokenized-stock-ondo': 'INTC',
  'crypto-adobe-tokenized-stock-ondo': 'ADBE',
  'crypto-broadcom-tokenized-stock-xstock': 'AVGO',
  'crypto-qualcomm-tokenized-stock-ondo': 'QCOM',
  'crypto-jpmorgan-chase-tokenized-stock-ondo': 'JPM',
  'crypto-goldman-sachs-tokenized-stock-ondo': 'GS',
  'crypto-visa-tokenized-stock-ondo': 'V',
  'crypto-mastercard-tokenized-stock-ondo': 'MA',
  'crypto-blackrock-tokenized-stock-ondo': 'BLK',
  'crypto-johnson-johnson-tokenized-stock-ondo': 'JNJ',
  'crypto-coca-cola-tokenized-stock-ondo': 'KO',
  'crypto-pfizer-tokenized-stock-ondo': 'PFE',
  'crypto-wrapped-tesla-tokenized-stock-xstock': 'TSLA',
  'crypto-wrapped-meta-tokenized-stock-xstock': 'META',
  'crypto-coinbase-tokenized-stock-xstock': 'COIN',
  'crypto-baba': 'BABA',
  'crypto-tencent': '0700.HK',
  'crypto-baidu': 'BIDU',
  'crypto-jd-com': 'JD',

  // Forex — Major
  'eur-usd-ask': 'EURUSD=X',
  'gbp-usd-ask': 'GBPUSD=X',
  'usd-jpy-ask': 'USDJPY=X',
  'usd-chf-ask': 'USDCHF=X',
  'aud-usd-ask': 'AUDUSD=X',
  'nzd-usd-ask': 'NZDUSD=X',
  'usd-cad-ask': 'USDCAD=X',
  // Forex — Exotic
  'usd-try-ask': 'USDTRY=X',
  'usd-sek-ask': 'USDSEK=X',
  'usd-nok-ask': 'USDNOK=X',
  'usd-cny-ask': 'USDCNH=X',
  'usd-mxn-ask': 'USDMXN=X',
  'brl-usd-ask': 'USDZAR=X',
  'usd-aed-ask': 'USDAED=X',
  'usd-sgd-ask': 'USDSGD=X',
  'usd-rub-ask': 'USDRUB=X',

  // Energy
  'energy-brent-oil': 'BZ=F',
  'energy-crude-oil': 'CL=F',
  'energy-natural-gas': 'NG=F',
  'energy-gasoline-rbob': 'RB=F',
  'lng-japan-korea-marker': 'NG=F', // closest Yahoo equivalent

  // Metals — Precious
  'ons': 'GC=F',
  'silver': 'SI=F',
  'platinum': 'PL=F',
  'palladium': 'PA=F',
  // Metals — Base
  'basemetal-copper': 'HG=F',
  'basemetal-aluminum': 'ALI.L',
  'basemetal-zinc': 'ZI=F',
  'basemetal-nickel': 'NICKEL.L',
  'basemetal-lead': 'ZI=F',    // closest Yahoo equivalent
  'basemetal-tin': 'ALI.L',    // closest Yahoo equivalent

  // Commodities
  'commodities-us-wheat': 'ZW=F',
  'commodities-us-corn': 'ZC=F',
  'commodities-us-soybeans': 'ZS=F',
  'commodities-rough-rice': 'ZR=F', // rough rice futures
  'commodities-us-cotton': 'CT=F',
  'commodities-us-cocoa': 'CC=F',
  'commodities-us-sugar': 'SB=F',
  'commodities-london-cocoa': 'CC=F',
  'commodities-us-soybean-oil': 'ZL=F',
  'commodities-palm-oil': 'ZL=F',  // closest Yahoo equivalent
  'commodities-london-wheat': 'ZW=F',
  'oil_opec': 'CL=F', // OPEC basket → use WTI as proxy
};

/* ─── Helpers ──────────────────────────────────────────── */

/**
 * Parse a number that might contain Persian digits, commas, or other formatting.
 * Handles null/undefined/empty strings gracefully.
 */
function parsePersianNum(str: string | null | undefined | number): number {
  if (str === null || str === undefined) return 0;
  let s = String(str).trim();
  if (!s || s === '-' || s === '') return 0;
  // Strip trailing % sign (e.g. "0.05%" → "0.05")
  if (s.endsWith('%')) s = s.slice(0, -1).trim();
  // Replace commas and Persian digits
  const cleaned = s.replace(/[,۰-۹]/g, (c: string) => {
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const idx = persianDigits.indexOf(c);
    return idx >= 0 ? String(idx) : c === ',' ? '' : c;
  });
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
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

/**
 * Check if parsed candle data is reasonably fresh.
 * Rejects data where the most recent candle is older than 2 years.
 * This prevents serving data from e.g. 1392 when current year is 1404.
 */
function isDataFresh(candles: TgjuOHLC[]): boolean {
  if (candles.length === 0) return false;
  const lastDateStr = candles[candles.length - 1].date;
  const yearMatch = lastDateStr.match(/(\d{4})/);
  if (!yearMatch) return true; // Can't determine year, assume fresh

  const year = parseInt(yearMatch[1], 10);
  const now = new Date();
  const gregorianYear = now.getFullYear();
  // Approximate current Jalali year (Gregorian - 621 or 622)
  const approxJalaliYear = gregorianYear - 621;

  // Jalali years: 1390-1500 range
  if (year >= 1390 && year <= 1500) {
    return year >= approxJalaliYear - 2; // Allow up to 2 years old
  }

  // Gregorian years
  if (year >= 2020 && year <= 2035) {
    return year >= gregorianYear - 2;
  }

  // Unknown format, don't reject
  return true;
}

/* ─── Cache ────────────────────────────────────────────── */

const liveInstrumentsCache: { data: TgjuInstrument[] | null; ts: number } = { data: null, ts: 0 };
const INSTRUMENTS_TTL = 5 * 60 * 1000; // 5 minutes

const historyCache = new Map<string, { data: TgjuOHLC[]; ts: number }>();
const HISTORY_TTL = 4 * 60 * 60 * 1000; // 4 hours (reduced page_reader load)
const HISTORY_STALE_TTL = 24 * 60 * 60 * 1000; // 24 hours (return stale data if fresh fails)

// File-based persistent cache directory
const FILE_CACHE_DIR = join(tmpdir(), 'tgju-history-cache');

// ─── File-based cache helpers ───
async function ensureCacheDir() {
  try { await mkdir(FILE_CACHE_DIR, { recursive: true }); } catch {}
}

async function readFromFileCache(tgjuKey: string): Promise<TgjuOHLC[] | null> {
  try {
    const filePath = join(FILE_CACHE_DIR, `${tgjuKey}.json`);
    const data = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    if (parsed && Array.isArray(parsed.data) && parsed.data.length >= 30 && parsed.ts) {
      // Validate freshness — reject stale data (e.g. from year 1392)
      if (!isDataFresh(parsed.data as TgjuOHLC[])) {
        console.warn(`[TGJU] File cache for ${tgjuKey} is STALE, deleting`);
        try { await unlink(filePath); } catch {}
        return null;
      }
      return parsed.data as TgjuOHLC[];
    }
  } catch {}
  return null;
}

async function writeToFileCache(tgjuKey: string, candles: TgjuOHLC[]): Promise<void> {
  try {
    await ensureCacheDir();
    const filePath = join(FILE_CACHE_DIR, `${tgjuKey}.json`);
    await writeFile(filePath, JSON.stringify({ data: candles, ts: Date.now() }), 'utf-8');
  } catch {}
}

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

    // ── Background: fetch Yahoo prices for static instruments with price=0 (TGJU API 403) ──
    backgroundFetchYahooFallbackPrices(instruments).catch(() => {});

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

/**
 * Get the Yahoo Finance fallback symbol for a TGJU instrument key.
 * Returns undefined if no mapping exists.
 */
export function getTgjuYahooFallback(tgjuKey: string): string | undefined {
  return TGJU_TO_YAHOO_MAP[tgjuKey];
}

/**
 * Background task: fetch Yahoo Finance prices for static instruments that have price=0
 * (happens when api.tgju.org returns 403). Updates the live cache in-place.
 */
async function backgroundFetchYahooFallbackPrices(instruments: TgjuInstrument[]) {
  // Collect static instruments with price=0 that have a Yahoo mapping
  const zeroPriceItems = instruments.filter(
    (i) => i.price === 0 && i.key in TGJU_TO_YAHOO_MAP
  );

  if (zeroPriceItems.length === 0) return;

  console.log(`[TGJU] ${zeroPriceItems.length} static instruments have price=0, fetching from Yahoo Finance as fallback...`);

  // Collect unique Yahoo symbols
  const keyToSymbol = new Map<string, string>();
  const symbolToKeys = new Map<string, string[]>();
  for (const item of zeroPriceItems) {
    const yahooSym = TGJU_TO_YAHOO_MAP[item.key];
    if (!yahooSym) continue;
    keyToSymbol.set(item.key, yahooSym);
    if (!symbolToKeys.has(yahooSym)) symbolToKeys.set(yahooSym, []);
    symbolToKeys.get(yahooSym)!.push(item.key);
  }

  const uniqueSymbols = [...symbolToKeys.keys()];

  try {
    // Dynamic import to avoid loading yahoo-finance2 for TSE-only users
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'], validation: { logErrors: false } });

    // Fetch in batches of 15 (smaller batches reduce Yahoo validation errors)
    const BATCH_SIZE = 15;
    for (let i = 0; i < uniqueSymbols.length; i += BATCH_SIZE) {
      const batch = uniqueSymbols.slice(i, i + BATCH_SIZE);
      try {
        const results = await yahooFinance.quote(batch, {
          fields: ['symbol', 'regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent', 'regularMarketPreviousClose', 'regularMarketDayHigh', 'regularMarketDayLow'],
        });

        for (const r of results) {
          if (r.regularMarketPrice == null) continue;
          const tgjuKeys = symbolToKeys.get(r.symbol);
          if (!tgjuKeys) continue;

          for (const tgjuKey of tgjuKeys) {
            const inst = liveInstrumentsCache.data?.find((x) => x.key === tgjuKey);
            if (inst && inst.price === 0) {
              inst.price = r.regularMarketPrice;
              inst.highPrice = r.regularMarketDayHigh ?? r.regularMarketPrice;
              inst.lowPrice = r.regularMarketDayLow ?? r.regularMarketPrice;
              inst.change = r.regularMarketChange ?? 0;
              inst.changePercent = r.regularMarketChangePercent ?? 0;

              // Also update static price cache
              staticPriceCache.set(tgjuKey, {
                close: r.regularMarketPrice,
                high: r.regularMarketDayHigh ?? r.regularMarketPrice,
                low: r.regularMarketDayLow ?? r.regularMarketPrice,
                prevClose: r.regularMarketPreviousClose ?? r.regularMarketPrice,
                ts: Date.now(),
              });
            }
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('validation') || errMsg.includes('FailedYahooValidationError')) {
          // Batch failed due to schema validation — retry individually
          console.warn(`[TGJU] Yahoo fallback batch ${Math.floor(i / BATCH_SIZE) + 1} validation error, retrying individually...`);
          for (const symbol of batch) {
            try {
              const singleResults = await yahooFinance.quote([symbol], {
                fields: ['symbol', 'regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent', 'regularMarketPreviousClose', 'regularMarketDayHigh', 'regularMarketDayLow'],
              });
              for (const r of singleResults) {
                if (r.regularMarketPrice == null) continue;
                const tgjuKeys = symbolToKeys.get(r.symbol);
                if (!tgjuKeys) continue;
                for (const tgjuKey of tgjuKeys) {
                  const inst = liveInstrumentsCache.data?.find((x) => x.key === tgjuKey);
                  if (inst && inst.price === 0) {
                    inst.price = r.regularMarketPrice;
                    inst.highPrice = r.regularMarketDayHigh ?? r.regularMarketPrice;
                    inst.lowPrice = r.regularMarketDayLow ?? r.regularMarketPrice;
                    inst.change = r.regularMarketChange ?? 0;
                    inst.changePercent = r.regularMarketChangePercent ?? 0;
                    staticPriceCache.set(tgjuKey, {
                      close: r.regularMarketPrice,
                      high: r.regularMarketDayHigh ?? r.regularMarketPrice,
                      low: r.regularMarketDayLow ?? r.regularMarketPrice,
                      prevClose: r.regularMarketPreviousClose ?? r.regularMarketPrice,
                      ts: Date.now(),
                    });
                  }
                }
              }
            } catch {
              // skip individual symbol errors
            }
          }
        } else {
          console.warn(`[TGJU] Yahoo fallback batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, errMsg);
        }
      }
    }

    const filledCount = zeroPriceItems.filter((i) => i.price > 0).length;
    console.log(`[TGJU] Yahoo fallback filled ${filledCount}/${zeroPriceItems.length} instrument prices`);
  } catch (err) {
    console.error(`[TGJU] Yahoo fallback fetch failed:`, err);
  }
}

/* ─── Fetch historical OHLC data ── */

/* ─── Page Reader Request Queue ─────────────────────── */
// Track which keys were last fetched from Yahoo (for route to detect source)
export const yahooFetchedKeys = new Set<string>();

let pageReaderQueue: Promise<void> = Promise.resolve();
let lastPageReaderCall = 0;
const PAGE_READER_MIN_INTERVAL = 10_000; // 10 seconds between calls
const PAGE_READER_MAX_RETRIES = 3;
const PAGE_READER_RETRY_BASE_DELAY = 3_000; // 3 seconds base retry delay

/**
 * Fetch historical OHLC data for a TGJU instrument.
 *
 * Strategy (permanent fix):
 * 1. Check in-memory cache (4h TTL)
 * 2. For global instruments with Yahoo mapping → use Yahoo Finance as PRIMARY
 * 3. For Iranian instruments → try direct fetch, then queued page_reader with retry
 * 4. If all fail → return stale cache (up to 24h) or file-based cache
 */
export async function fetchTgjuHistory(tgjuKey: string): Promise<TgjuOHLC[]> {
  const now = Date.now();

  // ── Step 0: Check in-memory cache (with freshness validation) ──
  const cached = historyCache.get(tgjuKey);
  if (cached && now - cached.ts < HISTORY_TTL) {
    // Validate cached data is not stale (e.g. 1392-era data from a previous bug)
    if (isDataFresh(cached.data)) {
      return cached.data;
    } else {
      console.warn(`[TGJU] In-memory cache for ${tgjuKey} is STALE (latest: ${cached.data[cached.data.length - 1]?.date}), invalidating`);
      historyCache.delete(tgjuKey);
    }
  }

  // ── Step 1: For global instruments, use Yahoo Finance as PRIMARY source ──
  const yahooSymbol = TGJU_TO_YAHOO_MAP[tgjuKey];
  if (yahooSymbol) {
    try {
      const YahooFinance = (await import('yahoo-finance2')).default;
      const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'], validation: { logErrors: false } });
      const result = await yf.chart(yahooSymbol, {
        period1: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        period2: new Date(),
        interval: '1d',
      });
      if (result.quotes && result.quotes.length >= 30) {
        const candles: TgjuOHLC[] = result.quotes
          .filter((q: any) => q.close != null && q.open != null)
          .map((q: any) => ({
            date: q.date?.toISOString().split('T')[0] || '',
            open: q.open!,
            high: q.high || q.close!,
            low: q.low || q.close!,
            close: q.close!,
          }));
        if (candles.length >= 30) {
          console.log(`[TGJU] ${tgjuKey}: Got ${candles.length} candles from Yahoo (${yahooSymbol})`);
          yahooFetchedKeys.add(tgjuKey);
          cacheHistory(tgjuKey, candles, now);
          return candles;
        }
      }
    } catch (err) {
      console.warn(`[TGJU] Yahoo historical fetch failed for ${tgjuKey} (${yahooSymbol}):`, err instanceof Error ? err.message : err);
    }
  }

  // ── Step 2: For Iranian instruments (or Yahoo fallback failed), try TGJU sources ──
  // 2a: Try direct fetch (fast path, works when Cloudflare not blocking)
  const directResult = await tryDirectFetch(tgjuKey);
  if (directResult && directResult.length >= 30) {
    cacheHistory(tgjuKey, directResult, now);
    return directResult;
  }

  // 2b: Queued page_reader with retry + rate limiting
  console.log(`[TGJU] Direct fetch returned ${directResult?.length ?? 0} candles for ${tgjuKey}, using queued page_reader...`);
  const pageReaderResult = await fetchViaQueuedPageReader(tgjuKey);
  if (pageReaderResult && pageReaderResult.length >= 30) {
    cacheHistory(tgjuKey, pageReaderResult, now);
    return pageReaderResult;
  }

  // ── Step 3: All methods failed — return stale cache (only if fresh) ──
  if (cached && cached.data.length >= 30 && isDataFresh(cached.data)) {
    const age = ((now - cached.ts) / 60_000).toFixed(0);
    console.warn(`[TGJU] All methods failed for ${tgjuKey}, returning stale cache (${age}min old, ${cached.data.length} candles)`);
    return cached.data;
  }

  // ── Step 4: Try file-based cache ──
  const fileCached = await readFromFileCache(tgjuKey);
  if (fileCached && fileCached.length >= 30) {
    console.warn(`[TGJU] Returning file-cached data for ${tgjuKey} (${fileCached.length} candles)`);
    historyCache.set(tgjuKey, { data: fileCached, ts: Date.now() - HISTORY_TTL + 60_000 }); // Mark as almost-expired
    return fileCached;
  }

  console.error(`[TGJU] All methods and caches failed for ${tgjuKey}`);
  return [];
}

/**
 * Try direct HTTP fetch to TGJU chart API.
 * Returns parsed candles or null on failure.
 */
async function tryDirectFetch(tgjuKey: string): Promise<TgjuOHLC[] | null> {
  try {
    // CRITICAL: order_dir=desc to get the MOST RECENT candles, not the oldest.
    // With asc+start=0, we'd get data from 1392 for long-history instruments!
    const url = `${TGJU_CHART_API}/${tgjuKey}?lang=fa&order_dir=desc&start=0&length=365`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[TGJU] Direct fetch HTTP ${res.status} for ${tgjuKey}`);
      return null;
    }

    const jsonStr = await res.text();
    if (!jsonStr.startsWith('{')) {
      console.warn(`[TGJU] Direct fetch non-JSON for ${tgjuKey}`);
      return null;
    }

    return parseTgjuChartData(tgjuKey, jsonStr);
  } catch (err) {
    console.warn(`[TGJU] Direct fetch error for ${tgjuKey}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fetch TGJU historical data via queued page_reader with retry and rate limiting.
 * This prevents 429 errors by serializing requests and adding delays between calls.
 */
async function fetchViaQueuedPageReader(tgjuKey: string): Promise<TgjuOHLC[] | null> {
  // Enqueue this request — ensures only one page_reader call at a time
  let result: TgjuOHLC[] | null = null;
  const taskPromise = (async () => {
    // Rate limit: wait if last call was too recent
    const timeSinceLastCall = Date.now() - lastPageReaderCall;
    if (timeSinceLastCall < PAGE_READER_MIN_INTERVAL) {
      const waitTime = PAGE_READER_MIN_INTERVAL - timeSinceLastCall;
      console.log(`[TGJU] Rate limiting page_reader: waiting ${waitTime}ms...`);
      await new Promise(r => setTimeout(r, waitTime));
    }

    // Retry with exponential backoff
    for (let attempt = 1; attempt <= PAGE_READER_MAX_RETRIES; attempt++) {
      try {
        lastPageReaderCall = Date.now();
        const fetchResult = await fetchTgjuHistoryViaPageReader(tgjuKey);
        if (fetchResult && fetchResult.length >= 30) {
          result = fetchResult;
          return; // success
        }
        // Got data but not enough candles — don't retry
        if (fetchResult && fetchResult.length > 0) {
          console.warn(`[TGJU] page_reader returned only ${fetchResult.length} candles for ${tgjuKey}`);
          return;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRateLimit = errMsg.includes('429') || errMsg.includes('Too many requests');
        if (isRateLimit && attempt < PAGE_READER_MAX_RETRIES) {
          const delay = PAGE_READER_RETRY_BASE_DELAY * Math.pow(3, attempt - 1); // 3s, 9s, 27s
          console.warn(`[TGJU] page_reader 429 for ${tgjuKey}, retry ${attempt}/${PAGE_READER_MAX_RETRIES} in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        console.error(`[TGJU] page_reader error for ${tgjuKey} (attempt ${attempt}):`, errMsg);
        return;
      }
    }
  })();

  // Chain onto the queue
  pageReaderQueue = pageReaderQueue.then(() => taskPromise, () => taskPromise);
  await pageReaderQueue;
  return result;
}

/**
 * Single page_reader call to fetch TGJU historical data.
 * Uses z-ai SDK to bypass Cloudflare challenges.
 * Throws on failure so the caller (fetchViaQueuedPageReader) can retry.
 */
async function fetchTgjuHistoryViaPageReader(tgjuKey: string): Promise<TgjuOHLC[] | null> {
  // CRITICAL: order_dir=desc to get the MOST RECENT candles, not the oldest.
  const apiUrl = `${TGJU_CHART_API}/${tgjuKey}?lang=fa&order_dir=desc&start=0&length=365`;

  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const zai = await ZAI.create();
  console.log(`[TGJU] Using z-ai SDK page_reader for ${tgjuKey}...`);
  const invokeResult = await zai.functions.invoke('page_reader', { url: apiUrl });

  if (invokeResult.code !== 200 || !invokeResult.data?.html) {
    const errMsg = invokeResult.error || `code=${invokeResult.code}`;
    throw new Error(errMsg);
  }

  // Extract JSON from <pre> tag in the HTML
  const html = invokeResult.data.html;
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
  if (!preMatch) {
    throw new Error('no <pre> block found in page_reader response');
  }

  // Unescape HTML entities and strip HTML tags from values
  const jsonStr = preMatch[1]
    .replace(/<[^>]*>/g, '')        // Strip ALL HTML tags first
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .trim();

  if (!jsonStr.startsWith('{')) {
    throw new Error('extracted content is not JSON');
  }

  return parseTgjuChartData(tgjuKey, jsonStr);
}

/**
 * Parse the JSON data from TGJU chart API response.
 * Used by both direct fetch and page_reader paths.
 */
function parseTgjuChartData(tgjuKey: string, jsonStr: string): TgjuOHLC[] | null {
  try {
    const parsed = JSON.parse(jsonStr);
    const rawRows: (string | number)[][] = parsed.data;

    if (!rawRows || rawRows.length === 0) {
      console.warn(`[TGJU] Empty data array for ${tgjuKey}`);
      return null;
    }

    // Sanitize row values: strip any residual HTML tags and trim
    const rows = rawRows.map(row =>
      row.map(cell => {
        const s = String(cell).trim();
        // Strip HTML tags if any remain (safety for direct fetch path)
        return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
      })
    );

    // ── Auto-detect column mapping from first valid row ──
    let colMap = detectColumnMap(rows[0]);
    if (!colMap) {
      for (let r = 1; r < Math.min(5, rows.length); r++) {
        colMap = detectColumnMap(rows[r]);
        if (colMap) break;
      }
    }
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
      return null;
    }

    // ── Detect and fix data drift ──
    let driftCount = 0;
    for (let i = 1; i < candles.length; i++) {
      const prevClose = candles[i - 1].close;
      const currClose = candles[i].close;
      if (prevClose > 0) {
        const pctChange = Math.abs(currClose - prevClose) / prevClose;
        if (pctChange > 0.5) {
          driftCount++;
        }
      }
    }
    if (driftCount > candles.length * 0.1) {
      console.warn(`[TGJU] ${tgjuKey}: Possible data drift detected (${driftCount} suspicious jumps out of ${candles.length} candles)`);
    }

    // Reverse: API returns oldest-first (asc), we want newest-last for charting
    const firstDate = candles[0].date;
    const lastDate = candles[candles.length - 1].date;
    if (firstDate > lastDate) {
      candles.reverse();
    }

    // ── Freshness validation: reject data that is too old (e.g. from 1392) ──
    if (!isDataFresh(candles)) {
      console.warn(`[TGJU] ${tgjuKey}: Data is STALE (latest candle: ${candles[candles.length - 1]?.date}), REJECTING`);
      return null;
    }

    console.log(`[TGJU] ${tgjuKey}: Parsed ${candles.length} candles (${candles[0]?.date} to ${candles[candles.length - 1]?.date})`);

    return candles;
  } catch (err) {
    console.error(`[TGJU] Failed to parse chart data for ${tgjuKey}:`, err);
    return null;
  }
}

/**
 * Cache parsed history data and update related caches.
 */
function cacheHistory(tgjuKey: string, candles: TgjuOHLC[], now: number): void {
  historyCache.set(tgjuKey, { data: candles, ts: now });
  // Also persist to file for server restart resilience
  writeToFileCache(tgjuKey, candles).catch(() => {});

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
