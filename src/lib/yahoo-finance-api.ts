/**
 * Yahoo Finance API Integration
 *
 * Uses yahoo-finance2 library to fetch live quotes and historical data
 * for global stocks, indices, energy, metals, commodities, forex, crypto, and ETFs.
 */

import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ 
  suppressNotices: ['yahooSurvey'],
  validation: { logErrors: true },
});

/* ─── Types ────────────────────────────────────────────── */

export type YahooCategory =
  | 'yahoo_stock'
  | 'yahoo_index'
  | 'yahoo_energy'
  | 'yahoo_metal'
  | 'yahoo_commodity'
  | 'yahoo_forex'
  | 'yahoo_crypto'
  | 'yahoo_etf';

export interface YahooInstrument {
  symbol: string;
  name: string;
  nameEn: string;
  country: string;
  countryEn: string;
  exchange: string;
  groupTitle: string;
  category: YahooCategory;
  sector?: string;
}

/** @deprecated Use YahooInstrument instead */
export type YahooStock = YahooInstrument;

export interface YahooQuote {
  symbol: string;
  name: string;
  nameEn: string;
  country: string;
  countryEn: string;
  exchange: string;
  groupTitle: string;
  category: YahooCategory;
  unit: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap: number;
  currency: string;
}

export interface YahooOHLC {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/* ─── Static Stock Definitions ────────────────────── */

export const YAHOO_STOCKS: YahooInstrument[] = [
  /* ── US — Technology ──────────────────────────────────── */
  { symbol: 'AAPL', name: 'اپل', nameEn: 'Apple', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'MSFT', name: 'مایکروسافت', nameEn: 'Microsoft', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'NVDA', name: 'انویدیا', nameEn: 'NVIDIA', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'آلفابت (گوگل)', nameEn: 'Alphabet', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'META', name: 'متا (فیسبوک)', nameEn: 'Meta', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'AMZN', name: 'آمازون', nameEn: 'Amazon', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'TSLA', name: 'تسلا', nameEn: 'Tesla', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'NFLX', name: 'نتفلیکس', nameEn: 'Netflix', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'AMD', name: 'ای‌ام‌دی', nameEn: 'AMD', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'AVGO', name: 'برودکام', nameEn: 'Broadcom', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'CRM', name: 'سیلزفورس', nameEn: 'Salesforce', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'ORCL', name: 'اوراکل', nameEn: 'Oracle', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'INTC', name: 'اینتل', nameEn: 'Intel', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'ADBE', name: 'ادوبی', nameEn: 'Adobe', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'QCOM', name: 'کوالکام', nameEn: 'Qualcomm', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', category: 'yahoo_stock', sector: 'Technology' },

  /* ── US — Finance ──────────────────────────────────── */
  { symbol: 'JPM', name: 'جی‌پی مورگان', nameEn: 'JPMorgan', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'GS', name: 'گلدمن ساکس', nameEn: 'Goldman Sachs', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'V', name: 'ویزا', nameEn: 'Visa', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'MA', name: 'مسترکارت', nameEn: 'Mastercard', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'BLK', name: 'بلک‌راک', nameEn: 'BlackRock', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'BAC', name: 'بانک آمریکا', nameEn: 'BofA', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'AXP', name: 'امریکن اکسپرس', nameEn: 'Amex', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', category: 'yahoo_stock', sector: 'Finance' },

  /* ── US — Healthcare ────────────────────────────────── */
  { symbol: 'UNH', name: 'یونایتد هلث', nameEn: 'UnitedHealth', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - بهداشت', category: 'yahoo_stock', sector: 'Healthcare' },
  { symbol: 'JNJ', name: 'جانسون اند جانسون', nameEn: 'J&J', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - بهداشت', category: 'yahoo_stock', sector: 'Healthcare' },
  { symbol: 'PFE', name: 'پفایزر', nameEn: 'Pfizer', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - بهداشت', category: 'yahoo_stock', sector: 'Healthcare' },
  { symbol: 'LLY', name: 'ایلی لیلی', nameEn: 'Eli Lilly', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - بهداشت', category: 'yahoo_stock', sector: 'Healthcare' },
  { symbol: 'MRK', name: 'مرک', nameEn: 'Merck', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - بهداشت', category: 'yahoo_stock', sector: 'Healthcare' },

  /* ── US — Consumer & Other ──────────────────────────── */
  { symbol: 'WMT', name: 'والمارت', nameEn: 'Walmart', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مصرفی', category: 'yahoo_stock', sector: 'Consumer' },
  { symbol: 'KO', name: 'کوکاکولا', nameEn: 'Coca-Cola', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مصرفی', category: 'yahoo_stock', sector: 'Consumer' },
  { symbol: 'PG', name: 'پراکتر اند گمبل', nameEn: 'P&G', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مصرفی', category: 'yahoo_stock', sector: 'Consumer' },
  { symbol: 'DIS', name: 'دیزنی', nameEn: 'Disney', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مصرفی', category: 'yahoo_stock', sector: 'Consumer' },
  { symbol: 'HD', name: 'هوم دیپو', nameEn: 'Home Depot', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مصرفی', category: 'yahoo_stock', sector: 'Consumer' },
  { symbol: 'BA', name: 'بوئینگ', nameEn: 'Boeing', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - صنعت', category: 'yahoo_stock', sector: 'Industrial' },
  { symbol: 'CAT', name: 'کاترپیلار', nameEn: 'Caterpillar', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - صنعت', category: 'yahoo_stock', sector: 'Industrial' },
  { symbol: 'XOM', name: 'اکسون موبیل', nameEn: 'ExxonMobil', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - انرژی', category: 'yahoo_stock', sector: 'Energy' },
  { symbol: 'CVX', name: 'شورون', nameEn: 'Chevron', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - انرژی', category: 'yahoo_stock', sector: 'Energy' },

  /* ── Europe — UK ──────────────────────────────────────── */
  { symbol: 'SHEL.L', name: 'شل', nameEn: 'Shell', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', category: 'yahoo_stock', sector: 'Energy' },
  { symbol: 'BP.L', name: 'بی‌پی', nameEn: 'BP', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', category: 'yahoo_stock', sector: 'Energy' },
  { symbol: 'AZN.L', name: 'آسترازنکا', nameEn: 'AstraZeneca', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', category: 'yahoo_stock', sector: 'Healthcare' },
  { symbol: 'HSBA.L', name: 'اچ‌اس‌بی‌سی', nameEn: 'HSBC', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'ULVR.L', name: 'یونی‌لیور', nameEn: 'Unilever', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', category: 'yahoo_stock', sector: 'Consumer' },
  { symbol: 'RIO.L', name: 'ریو تینتو', nameEn: 'Rio Tinto', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', category: 'yahoo_stock', sector: 'Mining' },

  /* ── Europe — Germany ─────────────────────────────────── */
  { symbol: 'SAP.DE', name: 'اس‌ای‌پی', nameEn: 'SAP', country: 'آلمان', countryEn: 'DE', exchange: 'XETRA', groupTitle: 'اروپا - آلمان', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'SIE.DE', name: 'زیمنس', nameEn: 'Siemens', country: 'آلمان', countryEn: 'DE', exchange: 'XETRA', groupTitle: 'اروپا - آلمان', category: 'yahoo_stock', sector: 'Industrial' },
  { symbol: 'ALV.DE', name: 'آلیانتس', nameEn: 'Allianz', country: 'آلمان', countryEn: 'DE', exchange: 'XETRA', groupTitle: 'اروپا - آلمان', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'DTE.DE', name: 'دویچه تلکوم', nameEn: 'Deutsche Telekom', country: 'آلمان', countryEn: 'DE', exchange: 'XETRA', groupTitle: 'اروپا - آلمان', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'BAS.DE', name: 'باسف', nameEn: 'BASF', country: 'آلمان', countryEn: 'DE', exchange: 'XETRA', groupTitle: 'اروپا - آلمان', category: 'yahoo_stock', sector: 'Chemical' },

  /* ── Europe — France ──────────────────────────────────── */
  { symbol: 'MC.PA', name: 'لورئال', nameEn: "L'Oréal", country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', category: 'yahoo_stock', sector: 'Consumer' },
  { symbol: 'OR.PA', name: 'لورانسی', nameEn: 'LVMH', country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', category: 'yahoo_stock', sector: 'Consumer' },
  { symbol: 'SAN.PA', name: 'سانوفی', nameEn: 'Sanofi', country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', category: 'yahoo_stock', sector: 'Healthcare' },
  { symbol: 'AI.PA', name: 'ایر بوس', nameEn: 'Airbus', country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', category: 'yahoo_stock', sector: 'Industrial' },
  { symbol: 'BNP.PA', name: 'بی‌ان‌پی پاریبا', nameEn: 'BNP Paribas', country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'SU.PA', name: 'شلف', nameEn: 'Schneider', country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', category: 'yahoo_stock', sector: 'Industrial' },

  /* ── Europe — Netherlands ─────────────────────────────── */
  { symbol: 'ASML.AS', name: 'اس‌ام‌ال', nameEn: 'ASML', country: 'هلند', countryEn: 'NL', exchange: 'Euronext', groupTitle: 'اروپا - هلند', category: 'yahoo_stock', sector: 'Technology' },

  /* ── Europe — Switzerland ─────────────────────────────── */
  { symbol: 'NESN.SW', name: 'نستله', nameEn: 'Nestlé', country: 'سوئیس', countryEn: 'CH', exchange: 'SIX', groupTitle: 'اروپا - سوئیس', category: 'yahoo_stock', sector: 'Consumer' },
  { symbol: 'ROG.SW', name: 'روچ', nameEn: 'Roche', country: 'سوئیس', countryEn: 'CH', exchange: 'SIX', groupTitle: 'اروپا - سوئیس', category: 'yahoo_stock', sector: 'Healthcare' },
  { symbol: 'NOVN.SW', name: 'نوارتیس', nameEn: 'Novartis', country: 'سوئیس', countryEn: 'CH', exchange: 'SIX', groupTitle: 'اروپا - سوئیس', category: 'yahoo_stock', sector: 'Healthcare' },

  /* ── Europe — Spain ───────────────────────────────────── */
  { symbol: 'ITX.MC', name: 'ایندیتکس', nameEn: 'Inditex', country: 'اسپانیا', countryEn: 'ES', exchange: 'BME', groupTitle: 'اروپا - اسپانیا', category: 'yahoo_stock', sector: 'Consumer' },
  { symbol: 'SAN.MC', name: 'سانتاندر', nameEn: 'Santander', country: 'اسپانیا', countryEn: 'ES', exchange: 'BME', groupTitle: 'اروپا - اسپانیا', category: 'yahoo_stock', sector: 'Finance' },

  /* ── Europe — Italy ───────────────────────────────────── */
  { symbol: 'ISP.MI', name: 'اینتسا سن‌پائولو', nameEn: 'Intesa Sanpaolo', country: 'ایتالیا', countryEn: 'IT', exchange: 'Borsa Italiana', groupTitle: 'اروپا - ایتالیا', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'ENI.MI', name: 'انی', nameEn: 'Eni', country: 'ایتالیا', countryEn: 'IT', exchange: 'Borsa Italiana', groupTitle: 'اروپا - ایتالیا', category: 'yahoo_stock', sector: 'Energy' },

  /* ── Asia — Japan ─────────────────────────────────────── */
  { symbol: '7203.T', name: 'تویوتا', nameEn: 'Toyota', country: 'ژاپن', countryEn: 'JP', exchange: 'TSE', groupTitle: 'آسیا - ژاپن', category: 'yahoo_stock', sector: 'Automotive' },
  { symbol: '6758.T', name: 'سونی', nameEn: 'Sony', country: 'ژاپن', countryEn: 'JP', exchange: 'TSE', groupTitle: 'آسیا - ژاپن', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: '9984.T', name: 'سافت‌بانک', nameEn: 'SoftBank', country: 'ژاپن', countryEn: 'JP', exchange: 'TSE', groupTitle: 'آسیا - ژاپن', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: '6861.T', name: 'کیونسی', nameEn: 'Keyence', country: 'ژاپن', countryEn: 'JP', exchange: 'TSE', groupTitle: 'آسیا - ژاپن', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: '7974.T', name: 'نینتندو', nameEn: 'Nintendo', country: 'ژاپن', countryEn: 'JP', exchange: 'TSE', groupTitle: 'آسیا - ژاپن', category: 'yahoo_stock', sector: 'Technology' },

  /* ── Asia — China (ADR & HK) ─────────────────────────── */
  { symbol: 'BABA', name: 'علی‌بابا', nameEn: 'Alibaba', country: 'چین', countryEn: 'CN', exchange: 'NYSE', groupTitle: 'آسیا - چین', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'PDD', name: 'پیندودو', nameEn: 'PDD', country: 'چین', countryEn: 'CN', exchange: 'NASDAQ', groupTitle: 'آسیا - چین', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'JD', name: 'جی‌دی کام', nameEn: 'JD.com', country: 'چین', countryEn: 'CN', exchange: 'NASDAQ', groupTitle: 'آسیا - چین', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'BIDU', name: 'بایدو', nameEn: 'Baidu', country: 'چین', countryEn: 'CN', exchange: 'NASDAQ', groupTitle: 'آسیا - چین', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'NIO', name: 'نیو', nameEn: 'NIO', country: 'چین', countryEn: 'CN', exchange: 'NYSE', groupTitle: 'آسیا - چین', category: 'yahoo_stock', sector: 'Automotive' },

  /* ── Asia — South Korea ──────────────────────────────── */
  { symbol: '005930.KS', name: 'سامسونگ', nameEn: 'Samsung', country: 'کره جنوبی', countryEn: 'KR', exchange: 'KRX', groupTitle: 'آسیا - کره جنوبی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: '000660.KS', name: 'اس‌کی هینیکس', nameEn: 'SK Hynix', country: 'کره جنوبی', countryEn: 'KR', exchange: 'KRX', groupTitle: 'آسیا - کره جنوبی', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: '373220.KS', name: 'ال‌جی انرژی', nameEn: 'LG Energy', country: 'کره جنوبی', countryEn: 'KR', exchange: 'KRX', groupTitle: 'آسیا - کره جنوبی', category: 'yahoo_stock', sector: 'Technology' },

  /* ── Asia — India ─────────────────────────────────────── */
  { symbol: 'RELIANCE.NS', name: 'رلاینس', nameEn: 'Reliance', country: 'هند', countryEn: 'IN', exchange: 'NSE', groupTitle: 'آسیا - هند', category: 'yahoo_stock', sector: 'Conglomerate' },
  { symbol: 'TCS.NS', name: 'تی‌سی‌اس', nameEn: 'TCS', country: 'هند', countryEn: 'IN', exchange: 'NSE', groupTitle: 'آسیا - هند', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'INFY.NS', name: 'اینفوسیس', nameEn: 'Infosys', country: 'هند', countryEn: 'IN', exchange: 'NSE', groupTitle: 'آسیا - هند', category: 'yahoo_stock', sector: 'Technology' },
  { symbol: 'HDFCBANK.NS', name: 'اچ‌دی‌اف‌سی بانک', nameEn: 'HDFC Bank', country: 'هند', countryEn: 'IN', exchange: 'NSE', groupTitle: 'آسیا - هند', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'ICICIBANK.NS', name: 'آی‌سی‌آی‌سی‌آی بانک', nameEn: 'ICICI Bank', country: 'هند', countryEn: 'IN', exchange: 'NSE', groupTitle: 'آسیا - هند', category: 'yahoo_stock', sector: 'Finance' },

  /* ── Asia — Taiwan ────────────────────────────────────── */
  { symbol: '2330.TW', name: 'تی‌اس‌ام‌سی', nameEn: 'TSMC', country: 'تایوان', countryEn: 'TW', exchange: 'TWSE', groupTitle: 'آسیا - تایوان', category: 'yahoo_stock', sector: 'Semiconductor' },
  { symbol: '2317.TW', name: 'فاکسکان', nameEn: 'Foxconn', country: 'تایوان', countryEn: 'TW', exchange: 'TWSE', groupTitle: 'آسیا - تایوان', category: 'yahoo_stock', sector: 'Technology' },

  /* ── Asia — Australia ─────────────────────────────────── */
  { symbol: 'BHP.AX', name: 'بی‌اچ‌پی', nameEn: 'BHP', country: 'استرالیا', countryEn: 'AU', exchange: 'ASX', groupTitle: 'آسیا - استرالیا', category: 'yahoo_stock', sector: 'Mining' },
  { symbol: 'CSL.AX', name: 'سی‌اس‌ال', nameEn: 'CSL', country: 'استرالیا', countryEn: 'AU', exchange: 'ASX', groupTitle: 'آسیا - استرالیا', category: 'yahoo_stock', sector: 'Healthcare' },
  { symbol: 'CBA.AX', name: 'کامن‌ولث بانک', nameEn: 'CBA', country: 'استرالیا', countryEn: 'AU', exchange: 'ASX', groupTitle: 'آسیا - استرالیا', category: 'yahoo_stock', sector: 'Finance' },

  /* ── Middle East — Saudi Arabia ──────────────────────── */
  { symbol: '2222.SR', name: 'آرامکو', nameEn: 'Aramco', country: 'عربستان', countryEn: 'SA', exchange: 'Tadawul', groupTitle: 'خاورمیانه - عربستان', category: 'yahoo_stock', sector: 'Energy' },
  { symbol: '7010.SR', name: 'سابیک', nameEn: 'SABIC', country: 'عربستان', countryEn: 'SA', exchange: 'Tadawul', groupTitle: 'خاورمیانه - عربستان', category: 'yahoo_stock', sector: 'Chemical' },
  { symbol: '1180.SR', name: 'الراجحی بانک', nameEn: 'Al Rajhi', country: 'عربستان', countryEn: 'SA', exchange: 'Tadawul', groupTitle: 'خاورمیانه - عربستان', category: 'yahoo_stock', sector: 'Finance' },

  /* ── Middle East — UAE ────────────────────────────────── */
  { symbol: 'DFM.DU', name: 'دبی فیننشل مارکت', nameEn: 'DFM', country: 'امارات', countryEn: 'AE', exchange: 'DFM', groupTitle: 'خاورمیانه - امارات', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'EMIRATESNB.DU', name: 'ام‌ان‌بی', nameEn: 'Emirates NBD', country: 'امارات', countryEn: 'AE', exchange: 'DFM', groupTitle: 'خاورمیانه - امارات', category: 'yahoo_stock', sector: 'Finance' },

  /* ── Middle East — Turkey ─────────────────────────────── */
  { symbol: 'THYAO.IS', name: 'ترکیش ایرلاینز', nameEn: 'Turkish Airlines', country: 'ترکیه', countryEn: 'TR', exchange: 'BIST', groupTitle: 'خاورمیانه - ترکیه', category: 'yahoo_stock', sector: 'Transport' },
  { symbol: 'GARAN.IS', name: 'گارانتی', nameEn: 'Garanti', country: 'ترکیه', countryEn: 'TR', exchange: 'BIST', groupTitle: 'خاورمیانه - ترکیه', category: 'yahoo_stock', sector: 'Finance' },
  { symbol: 'SAHOL.IS', name: 'شیشه', nameEn: 'Sisecam', country: 'ترکیه', countryEn: 'TR', exchange: 'BIST', groupTitle: 'خاورمیانه - ترکیه', category: 'yahoo_stock', sector: 'Industrial' },

  /* ── Latin America ────────────────────────────────────── */
  { symbol: 'VALE3.SA', name: 'واله', nameEn: 'Vale', country: 'برزیل', countryEn: 'BR', exchange: 'B3', groupTitle: 'آمریکای لاتین - برزیل', category: 'yahoo_stock', sector: 'Mining' },
  { symbol: 'PETR4.SA', name: 'پتروبراس', nameEn: 'Petrobras', country: 'برزیل', countryEn: 'BR', exchange: 'B3', groupTitle: 'آمریکای لاتین - برزیل', category: 'yahoo_stock', sector: 'Energy' },
  { symbol: 'AMX.MX', name: 'آمریکا موویل', nameEn: 'América Móvil', country: 'مکزیک', countryEn: 'MX', exchange: 'BMV', groupTitle: 'آمریکای لاتین - مکزیک', category: 'yahoo_stock', sector: 'Telecom' },
];

/* ─── Market Indices ────────────────────────────────── */

export const YAHOO_INDICES: YahooInstrument[] = [
  /* ── US Indices ────────────────────────────────────────── */
  { symbol: '^GSPC', name: 'اس اند پی ۵۰۰', nameEn: 'S&P 500', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^DJI', name: 'داو جونز', nameEn: 'Dow Jones', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^IXIC', name: 'نزدک کامپوزیت', nameEn: 'Nasdaq Composite', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^RUT', name: 'راسل ۲۰۰۰', nameEn: 'Russell 2000', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^VIX', name: 'ویکس', nameEn: 'VIX', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^NDX', name: 'نزدک ۱۰۰', nameEn: 'Nasdaq 100', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^SPX', name: 'اس اند پی ۵۰۰ ایندکس', nameEn: 'S&P 500 Index', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^MID', name: 'اس اند پی میدکپ ۴۰۰', nameEn: 'S&P MidCap 400', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^OEX', name: 'اس اند پی ۱۰۰', nameEn: 'S&P 100', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^TNX', name: 'بازده اوراق خزانه ۱۰ ساله', nameEn: 'Treasury Yield 10Y', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^TYX', name: 'بازده اوراق خزانه ۳۰ ساله', nameEn: 'Treasury Yield 30Y', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^IRX', name: 'بازده اوراق خزانه ۱۳ هفته‌ای', nameEn: 'Treasury Yield 13W', country: 'آمریکا', countryEn: 'US', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },

  /* ── Europe Indices ────────────────────────────────────── */
  { symbol: '^FTSE', name: 'اف‌تی‌اس‌ایی ۱۰۰', nameEn: 'FTSE 100', country: 'انگلستان', countryEn: 'UK', exchange: 'INDEX', groupTitle: 'شاخص - اروپا', category: 'yahoo_index' },
  { symbol: '^GDAXI', name: 'دکس', nameEn: 'DAX', country: 'آلمان', countryEn: 'DE', exchange: 'INDEX', groupTitle: 'شاخص - اروپا', category: 'yahoo_index' },
  { symbol: '^FCHI', name: 'کاک ۴۰', nameEn: 'CAC 40', country: 'فرانسه', countryEn: 'FR', exchange: 'INDEX', groupTitle: 'شاخص - اروپا', category: 'yahoo_index' },
  { symbol: '^IBEX', name: 'ایبکس ۳۵', nameEn: 'IBEX 35', country: 'اسپانیا', countryEn: 'ES', exchange: 'INDEX', groupTitle: 'شاخص - اروپا', category: 'yahoo_index' },
  { symbol: '^MIB', name: 'ام‌آی‌بی', nameEn: 'MIB', country: 'ایتالیا', countryEn: 'IT', exchange: 'INDEX', groupTitle: 'شاخص - اروپا', category: 'yahoo_index' },
  { symbol: '^SSMI', name: 'اس‌ام‌آی', nameEn: 'SMI', country: 'سوئیس', countryEn: 'CH', exchange: 'INDEX', groupTitle: 'شاخص - اروپا', category: 'yahoo_index' },
  { symbol: '^AEX', name: 'ای‌ای‌ایکس', nameEn: 'AEX', country: 'هلند', countryEn: 'NL', exchange: 'INDEX', groupTitle: 'شاخص - اروپا', category: 'yahoo_index' },

  /* ── Asia-Pacific Indices ──────────────────────────────── */
  { symbol: '^N225', name: 'نیکی ۲۲۵', nameEn: 'Nikkei 225', country: 'ژاپن', countryEn: 'JP', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
  { symbol: '^HSI', name: 'هنگ سنگ', nameEn: 'Hang Seng', country: 'هنگ کنگ', countryEn: 'HK', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
  { symbol: '^000001.SS', name: 'شانگهای کامپوزیت', nameEn: 'SSE Composite', country: 'چین', countryEn: 'CN', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
  { symbol: '^399001.SZ', name: 'شنجن کامپوننت', nameEn: 'SZSE Component', country: 'چین', countryEn: 'CN', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
  { symbol: '^BSI', name: 'سنسکس', nameEn: 'Sensex', country: 'هند', countryEn: 'IN', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
  { symbol: '^NSEI', name: 'نیفتی ۵۰', nameEn: 'Nifty 50', country: 'هند', countryEn: 'IN', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
  { symbol: '^KS11', name: 'کوسپی', nameEn: 'KOSPI', country: 'کره جنوبی', countryEn: 'KR', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
  { symbol: '^TWII', name: 'تایکس', nameEn: 'TAIEX', country: 'تایوان', countryEn: 'TW', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
  { symbol: '^AXJO', name: 'آ اس ایکس', nameEn: 'ASX All Ordinaries', country: 'استرالیا', countryEn: 'AU', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },

  /* ── Americas (Non-US) Indices ────────────────────────── */
  { symbol: '^BVSP', name: 'بوسپا', nameEn: 'Bovespa', country: 'برزیل', countryEn: 'BR', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },
  { symbol: '^MXX', name: 'آی‌پی‌سی', nameEn: 'IPC', country: 'مکزیک', countryEn: 'MX', exchange: 'INDEX', groupTitle: 'شاخص - آمریکا', category: 'yahoo_index' },

  /* ── Middle East & Africa & Emerging Indices ──────────── */
  { symbol: '^TASI', name: 'تداول', nameEn: 'Tadawul', country: 'عربستان', countryEn: 'SA', exchange: 'INDEX', groupTitle: 'شاخص - خاورمیانه', category: 'yahoo_index' },
  { symbol: '^DFMGI', name: 'دبی جی‌آی', nameEn: 'DFMGI', country: 'امارات', countryEn: 'AE', exchange: 'INDEX', groupTitle: 'شاخص - خاورمیانه', category: 'yahoo_index' },
  { symbol: '^XU100', name: 'بیست ۱۰۰', nameEn: 'BIST 100', country: 'ترکیه', countryEn: 'TR', exchange: 'INDEX', groupTitle: 'شاخص - خاورمیانه', category: 'yahoo_index' },
  { symbol: '^IMOEX', name: 'موسکس', nameEn: 'MOEX', country: 'روسیه', countryEn: 'RU', exchange: 'INDEX', groupTitle: 'شاخص - اروپا', category: 'yahoo_index' },

  /* ── Southeast Asia Indices ───────────────────────────── */
  { symbol: '^STI', name: 'اس‌تی‌آی', nameEn: 'STI', country: 'سنگاپور', countryEn: 'SG', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
  { symbol: '^KLSE', name: 'کی‌ال‌اس‌ایی', nameEn: 'KLSE', country: 'مالزی', countryEn: 'MY', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
  { symbol: '^SET', name: 'ست', nameEn: 'SET', country: 'تایلند', countryEn: 'TH', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
  { symbol: '^JKSE', name: 'جی‌سی‌آی', nameEn: 'JCI', country: 'اندونزی', countryEn: 'ID', exchange: 'INDEX', groupTitle: 'شاخص - آسیا', category: 'yahoo_index' },
];

/* ─── Energy ────────────────────────────────────────── */

export const YAHOO_ENERGY: YahooInstrument[] = [
  /* ── Crude Oil ─────────────────────────────────────────── */
  { symbol: 'CL=F', name: 'نفت دبلیوتی‌آی', nameEn: 'Crude Oil WTI', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'نفت و انرژی - نفت', category: 'yahoo_energy' },
  { symbol: 'BZ=F', name: 'نفت برنت', nameEn: 'Brent Crude', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'نفت و انرژی - نفت', category: 'yahoo_energy' },
  { symbol: 'QM=F', name: 'نفت مینی دبلیوتی‌آی', nameEn: 'Mini Crude Oil', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'نفت و انرژی - نفت', category: 'yahoo_energy' },

  /* ── Gas & Refined Products ────────────────────────────── */
  { symbol: 'NG=F', name: 'گاز طبیعی', nameEn: 'Natural Gas', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'نفت و انرژی - گاز و فرآورده', category: 'yahoo_energy' },
  { symbol: 'RB=F', name: 'بنزین آر‌بی‌او‌بی', nameEn: 'RBOB Gasoline', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'نفت و انرژی - گاز و فرآورده', category: 'yahoo_energy' },
  { symbol: 'HO=F', name: 'نفت گرمایشی', nameEn: 'Heating Oil', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'نفت و انرژی - گاز و فرآورده', category: 'yahoo_energy' },
];

/* ─── Metals ────────────────────────────────────────── */

export const YAHOO_METALS: YahooInstrument[] = [
  /* ── Precious Metals ───────────────────────────────────── */
  { symbol: 'GC=F', name: 'طلا', nameEn: 'Gold Futures', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'فلزات گران‌بها', category: 'yahoo_metal' },
  { symbol: 'SI=F', name: 'نقره', nameEn: 'Silver Futures', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'فلزات گران‌بها', category: 'yahoo_metal' },
  { symbol: 'PL=F', name: 'پلاتینیوم', nameEn: 'Platinum', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'فلزات گران‌بها', category: 'yahoo_metal' },
  { symbol: 'PA=F', name: 'پالادیوم', nameEn: 'Palladium', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'فلزات گران‌بها', category: 'yahoo_metal' },

  /* ── Base Metals ───────────────────────────────────────── */
  { symbol: 'HG=F', name: 'مس', nameEn: 'Copper', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'فلزات پایه', category: 'yahoo_metal' },
  { symbol: 'ZI=F', name: 'روی', nameEn: 'Zinc', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'فلزات پایه', category: 'yahoo_metal' },
  { symbol: 'ALI.L', name: 'آلومینیوم', nameEn: 'Aluminum', country: 'انگلستان', countryEn: 'UK', exchange: 'LME', groupTitle: 'فلزات پایه', category: 'yahoo_metal' },
  { symbol: 'NICKEL.L', name: 'نیکل', nameEn: 'Nickel', country: 'انگلستان', countryEn: 'UK', exchange: 'LME', groupTitle: 'فلزات پایه', category: 'yahoo_metal' },

  /* ── Spot Metals ───────────────────────────────────────── */
  { symbol: 'XAUUSD=X', name: 'طلا اسپات', nameEn: 'Gold Spot', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'فلزات اسپات', category: 'yahoo_metal' },
  { symbol: 'XAGUSD=X', name: 'نقره اسپات', nameEn: 'Silver Spot', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'فلزات اسپات', category: 'yahoo_metal' },
];

/* ─── Agricultural Commodities ──────────────────────── */

export const YAHOO_COMMODITIES: YahooInstrument[] = [
  { symbol: 'ZW=F', name: 'گندم', nameEn: 'Wheat', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'ZC=F', name: 'ذرت', nameEn: 'Corn', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'ZS=F', name: 'سویا', nameEn: 'Soybeans', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'ZL=F', name: 'روغن سویا', nameEn: 'Soybean Oil', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'ZM=F', name: 'کنجاله سویا', nameEn: 'Soybean Meal', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'KC=F', name: 'قهوه', nameEn: 'Coffee', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'SB=F', name: 'شکر', nameEn: 'Sugar', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'CC=F', name: 'کاکائو', nameEn: 'Cocoa', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'CT=F', name: 'پنبه', nameEn: 'Cotton', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'LC=F', name: 'گاو زنده', nameEn: 'Live Cattle', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'GF=F', name: 'گاو پرواری', nameEn: 'Feeder Cattle', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'LE=F', name: 'گوشت خوک', nameEn: 'Lean Hogs', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'OJ=F', name: 'آب پرتقال', nameEn: 'Orange Juice', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
  { symbol: 'LBS=F', name: 'چوب', nameEn: 'Lumber', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CME', groupTitle: 'کالاهای کشاورزی', category: 'yahoo_commodity' },
];

/* ─── Forex ────────────────────────────────────────── */

export const YAHOO_FOREX: YahooInstrument[] = [
  /* ── Major Pairs ───────────────────────────────────────── */
  { symbol: 'EURUSD=X', name: 'یورو/دلار', nameEn: 'EUR/USD', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اصلی', category: 'yahoo_forex' },
  { symbol: 'GBPUSD=X', name: 'پوند/دلار', nameEn: 'GBP/USD', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اصلی', category: 'yahoo_forex' },
  { symbol: 'USDJPY=X', name: 'دلار/ین', nameEn: 'USD/JPY', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اصلی', category: 'yahoo_forex' },
  { symbol: 'USDCHF=X', name: 'دلار/فرانک', nameEn: 'USD/CHF', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اصلی', category: 'yahoo_forex' },
  { symbol: 'AUDUSD=X', name: 'دلار استرالیا/دلار', nameEn: 'AUD/USD', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اصلی', category: 'yahoo_forex' },
  { symbol: 'USDCAD=X', name: 'دلار/دلار کانادا', nameEn: 'USD/CAD', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اصلی', category: 'yahoo_forex' },
  { symbol: 'NZDUSD=X', name: 'دلار نیوزیلند/دلار', nameEn: 'NZD/USD', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اصلی', category: 'yahoo_forex' },

  /* ── Cross Pairs ───────────────────────────────────────── */
  { symbol: 'EURGBP=X', name: 'یورو/پوند', nameEn: 'EUR/GBP', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - کراس', category: 'yahoo_forex' },
  { symbol: 'EURJPY=X', name: 'یورو/ین', nameEn: 'EUR/JPY', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - کراس', category: 'yahoo_forex' },
  { symbol: 'GBPJPY=X', name: 'پوند/ین', nameEn: 'GBP/JPY', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - کراس', category: 'yahoo_forex' },
  { symbol: 'AUDJPY=X', name: 'دلار استرالیا/ین', nameEn: 'AUD/JPY', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - کراس', category: 'yahoo_forex' },
  { symbol: 'EURCHF=X', name: 'یورو/فرانک', nameEn: 'EUR/CHF', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - کراس', category: 'yahoo_forex' },
  { symbol: 'GBPCHF=X', name: 'پوند/فرانک', nameEn: 'GBP/CHF', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - کراس', category: 'yahoo_forex' },

  /* ── Exotic Pairs ──────────────────────────────────────── */
  { symbol: 'USDTRY=X', name: 'دلار/لیر', nameEn: 'USD/TRY', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اگزوتیک', category: 'yahoo_forex' },
  { symbol: 'USDSEK=X', name: 'دلار/کرون سوئد', nameEn: 'USD/SEK', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اگزوتیک', category: 'yahoo_forex' },
  { symbol: 'USDNOK=X', name: 'دلار/کرون نروژ', nameEn: 'USD/NOK', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اگزوتیک', category: 'yahoo_forex' },
  { symbol: 'USDDKK=X', name: 'دلار/کرون دانمارک', nameEn: 'USD/DKK', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اگزوتیک', category: 'yahoo_forex' },
  { symbol: 'USDZAR=X', name: 'دلار/راند', nameEn: 'USD/ZAR', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اگزوتیک', category: 'yahoo_forex' },
  { symbol: 'USDMXN=X', name: 'دلار/پزو', nameEn: 'USD/MXN', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اگزوتیک', category: 'yahoo_forex' },
  { symbol: 'USDSGD=X', name: 'دلار/دلار سنگاپور', nameEn: 'USD/SGD', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اگزوتیک', category: 'yahoo_forex' },
  { symbol: 'USDHKD=X', name: 'دلار/دلار هنگ کنگ', nameEn: 'USD/HKD', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اگزوتیک', category: 'yahoo_forex' },
  { symbol: 'USDINR=X', name: 'دلار/روپیه هند', nameEn: 'USD/INR', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اگزوتیک', category: 'yahoo_forex' },
  { symbol: 'USDCNH=X', name: 'دلار/یوان آفشور', nameEn: 'USD/CNH', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'FOREX', groupTitle: 'جفت ارز - اگزوتیک', category: 'yahoo_forex' },
];

/* ─── Crypto ───────────────────────────────────────── */

export const YAHOO_CRYPTO: YahooInstrument[] = [
  /* ── Top Market Cap ────────────────────────────────────── */
  { symbol: 'BTC-USD', name: 'بیت‌کوین', nameEn: 'Bitcoin', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - مارکت‌کپ بالا', category: 'yahoo_crypto' },
  { symbol: 'ETH-USD', name: 'اتریوم', nameEn: 'Ethereum', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - مارکت‌کپ بالا', category: 'yahoo_crypto' },
  { symbol: 'XRP-USD', name: 'ریپل', nameEn: 'XRP', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - مارکت‌کپ بالا', category: 'yahoo_crypto' },
  { symbol: 'BNB-USD', name: 'بایننس کوین', nameEn: 'Binance Coin', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - مارکت‌کپ بالا', category: 'yahoo_crypto' },
  { symbol: 'SOL-USD', name: 'سولانا', nameEn: 'Solana', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - مارکت‌کپ بالا', category: 'yahoo_crypto' },
  { symbol: 'ADA-USD', name: 'کاردانو', nameEn: 'Cardano', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - مارکت‌کپ بالا', category: 'yahoo_crypto' },
  { symbol: 'DOGE-USD', name: 'دوج‌کوین', nameEn: 'Dogecoin', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - مارکت‌کپ بالا', category: 'yahoo_crypto' },
  { symbol: 'DOT-USD', name: 'پولکادات', nameEn: 'Polkadot', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - مارکت‌کپ بالا', category: 'yahoo_crypto' },
  { symbol: 'AVAX-USD', name: 'آوالانچ', nameEn: 'Avalanche', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - مارکت‌کپ بالا', category: 'yahoo_crypto' },
  { symbol: 'MATIC-USD', name: 'پالیگان', nameEn: 'Polygon', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - مارکت‌کپ بالا', category: 'yahoo_crypto' },

  /* ── Altcoins ──────────────────────────────────────────── */
  { symbol: 'LINK-USD', name: 'چین‌لینک', nameEn: 'Chainlink', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'UNI-USD', name: 'یونی‌سواپ', nameEn: 'Uniswap', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'ATOM-USD', name: 'کازماس', nameEn: 'Cosmos', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'LTC-USD', name: 'لایت‌کوین', nameEn: 'Litecoin', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'SHIB-USD', name: 'شیب اینو', nameEn: 'Shiba Inu', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'XLM-USD', name: 'استلار', nameEn: 'Stellar', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'ALGO-USD', name: 'آلگوراند', nameEn: 'Algorand', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'FIL-USD', name: 'فایل‌کوین', nameEn: 'Filecoin', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'TRX-USD', name: 'ترون', nameEn: 'TRON', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'NEAR-USD', name: 'نیر پروتکل', nameEn: 'NEAR Protocol', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'APT-USD', name: 'آپتوس', nameEn: 'Aptos', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'ARB-USD', name: 'آربیتروم', nameEn: 'Arbitrum', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'OP-USD', name: 'آپتیمیزم', nameEn: 'Optimism', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'INJ-USD', name: 'اینجکتیو', nameEn: 'Injective', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'SUI-USD', name: 'سویی', nameEn: 'Sui', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'SEI-USD', name: 'سئی', nameEn: 'Sei', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
  { symbol: 'TON-USD', name: 'تون‌کوین', nameEn: 'Toncoin', country: 'بین‌المللی', countryEn: 'INTL', exchange: 'CRYPTO', groupTitle: 'کریپتو - آلت‌کوین‌ها', category: 'yahoo_crypto' },
];

/* ─── ETFs ────────────────────────────────────────── */

export const YAHOO_ETFS: YahooInstrument[] = [
  /* ── Index ETFs ────────────────────────────────────────── */
  { symbol: 'SPY', name: 'اس‌پی‌وای اس اند پی ۵۰۰', nameEn: 'SPY S&P 500', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - شاخصی', category: 'yahoo_etf' },
  { symbol: 'QQQ', name: 'کیوکیوکیو نزدک ۱۰۰', nameEn: 'QQQ Nasdaq 100', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'صندوق - شاخصی', category: 'yahoo_etf' },
  { symbol: 'VTI', name: 'وی‌تی‌آی کل بازار', nameEn: 'VTI Total Market', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - شاخصی', category: 'yahoo_etf' },
  { symbol: 'VOO', name: 'وی‌او‌او اس اند پی ۵۰۰ وانگارد', nameEn: 'VOO S&P 500 Vanguard', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - شاخصی', category: 'yahoo_etf' },
  { symbol: 'IWM', name: 'آی‌دبلیوام راسل ۲۰۰۰', nameEn: 'IWM Russell 2000', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - شاخصی', category: 'yahoo_etf' },
  { symbol: 'EEM', name: 'ای‌ای‌ام بازارهای نوظهور', nameEn: 'EEM Emerging Markets', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - شاخصی', category: 'yahoo_etf' },
  { symbol: 'VEA', name: 'وی‌ای‌ای بازارهای توسعه‌یافته', nameEn: 'VEA Developed Markets', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - شاخصی', category: 'yahoo_etf' },

  /* ── Commodity ETFs ─────────────────────────────────────── */
  { symbol: 'GLD', name: 'جی‌ال‌دی طلا', nameEn: 'GLD Gold ETF', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - کالایی', category: 'yahoo_etf' },
  { symbol: 'SLV', name: 'اس‌ال‌وی نقره', nameEn: 'SLV Silver ETF', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - کالایی', category: 'yahoo_etf' },
  { symbol: 'USO', name: 'یواس‌او نفت', nameEn: 'USO Oil ETF', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - کالایی', category: 'yahoo_etf' },

  /* ── Bond ETFs ─────────────────────────────────────────── */
  { symbol: 'TLT', name: 'تی‌ال‌تی اوراق خزانه', nameEn: 'TLT Treasury Bond', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - شاخصی', category: 'yahoo_etf' },
  { symbol: 'HYG', name: 'اچ‌وای‌جی اوراق با بازده بالا', nameEn: 'HYG High Yield Corp Bond', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - شاخصی', category: 'yahoo_etf' },
  { symbol: 'LQD', name: 'ال‌کیو‌دی اوراق سرمایه‌گذاری', nameEn: 'LQD Investment Grade Corp Bond', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - شاخصی', category: 'yahoo_etf' },

  /* ── Sector ETFs ───────────────────────────────────────── */
  { symbol: 'XLK', name: 'ایکس‌ال‌کی تکنولوژی', nameEn: 'XLK Technology Select', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - بخشی', category: 'yahoo_etf' },
  { symbol: 'XLF', name: 'ایکس‌ال‌اف مالی', nameEn: 'XLF Financial Select', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - بخشی', category: 'yahoo_etf' },
  { symbol: 'XLE', name: 'ایکس‌ال‌ای انرژی', nameEn: 'XLE Energy Select', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - بخشی', category: 'yahoo_etf' },
  { symbol: 'XLV', name: 'ایکس‌ال‌وی بهداشت', nameEn: 'XLV Health Care Select', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - بخشی', category: 'yahoo_etf' },
  { symbol: 'XLY', name: 'ایکس‌ال‌وای مصرفی چرخشی', nameEn: 'XLY Consumer Discretionary', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - بخشی', category: 'yahoo_etf' },
  { symbol: 'XLP', name: 'ایکس‌ال‌پی مصرفی پایه', nameEn: 'XLP Consumer Staples', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - بخشی', category: 'yahoo_etf' },
  { symbol: 'XLI', name: 'ایکس‌ال‌آی صنعتی', nameEn: 'XLI Industrial Select', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - بخشی', category: 'yahoo_etf' },
  { symbol: 'XLU', name: 'ایکس‌ال‌یو ابزار', nameEn: 'XLU Utilities Select', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - بخشی', category: 'yahoo_etf' },
  { symbol: 'XLB', name: 'ایکس‌ال‌بی مواد', nameEn: 'XLB Materials Select', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - بخشی', category: 'yahoo_etf' },
  { symbol: 'XLRE', name: 'ایکس‌ال‌آر‌ایی املاک', nameEn: 'XLRE Real Estate', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - بخشی', category: 'yahoo_etf' },
  { symbol: 'XLC', name: 'ایکس‌ال‌سی ارتباطات', nameEn: 'XLC Communication Services', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - بخشی', category: 'yahoo_etf' },

  /* ── Volatility ETFs ───────────────────────────────────── */
  { symbol: 'ARKK', name: 'آر‌کی‌کی اینوویشن', nameEn: 'ARK Innovation', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - نوسانی', category: 'yahoo_etf' },
  { symbol: 'VIXM', name: 'ویکس‌ام میان‌مدت', nameEn: 'VIX Mid-Term Futures', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - نوسانی', category: 'yahoo_etf' },
  { symbol: 'VIXY', name: 'ویکس‌وای کوتاه‌مدت', nameEn: 'VIX Short-Term Futures', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - نوسانی', category: 'yahoo_etf' },
  { symbol: 'UVXY', name: 'یووی‌اکس‌وای اولترا ویکس', nameEn: 'UVXY Ultra VIX Short-Term', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'صندوق - نوسانی', category: 'yahoo_etf' },
];

/* ─── All Instruments Combined ─────────────────────── */

export const ALL_YAHOO_INSTRUMENTS: YahooInstrument[] = [
  ...YAHOO_STOCKS,
  ...YAHOO_INDICES,
  ...YAHOO_ENERGY,
  ...YAHOO_METALS,
  ...YAHOO_COMMODITIES,
  ...YAHOO_FOREX,
  ...YAHOO_CRYPTO,
  ...YAHOO_ETFS,
];

/* ─── In-memory cache ────────────────────────────────── */

let quotesCache: YahooQuote[] | null = null;
let quotesCacheTime = 0;
const CACHE_TTL = 120_000; // 2 minutes

/* ─── Fetch live quotes ──────────────────────────────── */

export async function fetchYahooQuotes(): Promise<YahooQuote[]> {
  const now = Date.now();
  if (quotesCache && now - quotesCacheTime < CACHE_TTL) {
    return quotesCache;
  }

  const symbols = ALL_YAHOO_INSTRUMENTS.map((s) => s.symbol);
  const quotes: YahooQuote[] = [];

  // Fetch in batches of 20 (Yahoo API limit)
  const BATCH_SIZE = 20;
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    try {
      const results = await yahooFinance.quote(batch, {
        fields: [
          'symbol', 'regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent',
          'regularMarketPreviousClose', 'regularMarketOpen', 'regularMarketDayHigh',
          'regularMarketDayLow', 'regularMarketVolume', 'marketCap', 'currency',
          'shortName', 'longName',
        ],
      });

      for (const r of results) {
        const def = ALL_YAHOO_INSTRUMENTS.find((s) => s.symbol === r.symbol);
        if (!def) continue;
        const unit = r.currency || 'USD';
        quotes.push({
          symbol: r.symbol,
          name: def.name,
          nameEn: def.nameEn,
          country: def.country,
          countryEn: def.countryEn,
          exchange: def.exchange,
          groupTitle: def.groupTitle,
          category: def.category,
          unit,
          price: r.regularMarketPrice ?? 0,
          change: r.regularMarketChange ?? 0,
          changePercent: r.regularMarketChangePercent ?? 0,
          previousClose: r.regularMarketPreviousClose ?? 0,
          open: r.regularMarketOpen ?? 0,
          high: r.regularMarketDayHigh ?? 0,
          low: r.regularMarketDayLow ?? 0,
          volume: r.regularMarketVolume ?? 0,
          marketCap: r.marketCap ?? 0,
          currency: r.currency || 'USD',
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('FailedYahooValidationError') || errMsg.includes('validation')) {
        // Batch failed due to schema validation — retry individually to salvage valid symbols
        console.warn(`[Yahoo Finance] Batch ${Math.floor(i / BATCH_SIZE) + 1} validation error, retrying individually...`);
        for (const symbol of batch) {
          try {
            const singleResults = await yahooFinance.quote([symbol], {
              fields: [
                'symbol', 'regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent',
                'regularMarketPreviousClose', 'regularMarketOpen', 'regularMarketDayHigh',
                'regularMarketDayLow', 'regularMarketVolume', 'marketCap', 'currency',
              ],
            });
            for (const r of singleResults) {
              const def = ALL_YAHOO_INSTRUMENTS.find((s) => s.symbol === r.symbol);
              if (!def) continue;
              const unit = r.currency || 'USD';
              quotes.push({
                symbol: r.symbol, name: def.name, nameEn: def.nameEn,
                country: def.country, countryEn: def.countryEn,
                exchange: def.exchange, groupTitle: def.groupTitle, category: def.category,
                unit, price: r.regularMarketPrice ?? 0, change: r.regularMarketChange ?? 0,
                changePercent: r.regularMarketChangePercent ?? 0, previousClose: r.regularMarketPreviousClose ?? 0,
                open: r.regularMarketOpen ?? 0, high: r.regularMarketDayHigh ?? 0,
                low: r.regularMarketDayLow ?? 0, volume: r.regularMarketVolume ?? 0,
                marketCap: r.marketCap ?? 0, currency: r.currency || 'USD',
              });
            }
          } catch {
            // Skip individual symbol errors
          }
        }
      } else {
        console.error(`[Yahoo Finance] Error fetching batch ${Math.floor(i / BATCH_SIZE) + 1}:`, err);
      }
    }
  }

  quotesCache = quotes;
  quotesCacheTime = now;
  return quotes;
}

/* ─── Fetch historical data ──────────────────────────── */

export async function fetchYahooHistory(symbol: string, days: number = 365): Promise<YahooOHLC[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const result = await yahooFinance.chart(symbol, {
    period1: start,
    period2: end,
    interval: '1d',
  });

  if (!result.quotes || result.quotes.length === 0) {
    return [];
  }

  return result.quotes
    .filter((q) => q.close != null && q.open != null)
    .map((q) => ({
      date: q.date?.toISOString().split('T')[0] || '',
      open: q.open!,
      high: q.high || q.close!,
      low: q.low || q.close!,
      close: q.close!,
      volume: q.volume || 0,
    }));
}

/* ─── Get instrument definition by symbol ────────────── */

export function getYahooInstrumentDef(symbol: string): YahooInstrument | undefined {
  return ALL_YAHOO_INSTRUMENTS.find((s) => s.symbol === symbol);
}

/** @deprecated Use getYahooInstrumentDef instead */
export function getYahooStockDef(symbol: string): YahooInstrument | undefined {
  return getYahooInstrumentDef(symbol);
}

/* ─── Get instruments by category ──────────────────────── */

export function getYahooInstrumentsByCategory(cat: YahooCategory): YahooInstrument[] {
  return ALL_YAHOO_INSTRUMENTS.filter((s) => s.category === cat);
}
