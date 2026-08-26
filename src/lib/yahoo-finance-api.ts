/**
 * Yahoo Finance API Integration
 *
 * Uses yahoo-finance2 library to fetch live quotes and historical data
 * for global stocks from various countries.
 */

import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/* ─── Types ────────────────────────────────────────────── */

export interface YahooStock {
  symbol: string;       // Yahoo Finance symbol (e.g., AAPL, 7203.T)
  name: string;         // Persian display name
  nameEn: string;       // English name
  country: string;      // Country in Persian
  countryEn: string;    // Country code (US, UK, JP, etc.)
  exchange: string;     // Exchange name in Persian
  groupTitle: string;   // Group title for categorization
  sector?: string;      // Sector
}

export interface YahooQuote {
  symbol: string;
  name: string;
  nameEn: string;
  country: string;
  countryEn: string;
  exchange: string;
  groupTitle: string;
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

export const YAHOO_STOCKS: YahooStock[] = [
  /* ── US — Technology ──────────────────────────────────── */
  { symbol: 'AAPL', name: 'اپل', nameEn: 'Apple', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'MSFT', name: 'مایکروسافت', nameEn: 'Microsoft', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'NVDA', name: 'انویدیا', nameEn: 'NVIDIA', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'آلفابت (گوگل)', nameEn: 'Alphabet', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'META', name: 'متا (فیسبوک)', nameEn: 'Meta', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'AMZN', name: 'آمازون', nameEn: 'Amazon', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'TSLA', name: 'تسلا', nameEn: 'Tesla', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'NFLX', name: 'نتفلیکس', nameEn: 'Netflix', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'AMD', name: 'ای‌ام‌دی', nameEn: 'AMD', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'AVGO', name: 'برودکام', nameEn: 'Broadcom', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'CRM', name: 'سیلزفورس', nameEn: 'Salesforce', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'ORCL', name: 'اوراکل', nameEn: 'Oracle', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'INTC', name: 'اینتل', nameEn: 'Intel', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'ADBE', name: 'ادوبی', nameEn: 'Adobe', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },
  { symbol: 'QCOM', name: 'کوالکام', nameEn: 'Qualcomm', country: 'آمریکا', countryEn: 'US', exchange: 'NASDAQ', groupTitle: 'آمریکا - تکنولوژی', sector: 'Technology' },

  /* ── US — Finance ──────────────────────────────────── */
  { symbol: 'JPM', name: 'جی‌پی مورگان', nameEn: 'JPMorgan', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', sector: 'Finance' },
  { symbol: 'GS', name: 'گلدمن ساکس', nameEn: 'Goldman Sachs', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', sector: 'Finance' },
  { symbol: 'V', name: 'ویزا', nameEn: 'Visa', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', sector: 'Finance' },
  { symbol: 'MA', name: 'مسترکارت', nameEn: 'Mastercard', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', sector: 'Finance' },
  { symbol: 'BLK', name: 'بلک‌راک', nameEn: 'BlackRock', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', sector: 'Finance' },
  { symbol: 'BAC', name: 'بانک آمریکا', nameEn: 'BofA', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', sector: 'Finance' },
  { symbol: 'AXP', name: 'امریکن اکسپرس', nameEn: 'Amex', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مالی', sector: 'Finance' },

  /* ── US — Healthcare ────────────────────────────────── */
  { symbol: 'UNH', name: 'یونایتد هلث', nameEn: 'UnitedHealth', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - بهداشت', sector: 'Healthcare' },
  { symbol: 'JNJ', name: 'جانسون اند جانسون', nameEn: 'J&J', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - بهداشت', sector: 'Healthcare' },
  { symbol: 'PFE', name: 'پفایزر', nameEn: 'Pfizer', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - بهداشت', sector: 'Healthcare' },
  { symbol: 'LLY', name: 'ایلی لیلی', nameEn: 'Eli Lilly', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - بهداشت', sector: 'Healthcare' },
  { symbol: 'MRK', name: 'مرک', nameEn: 'Merck', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - بهداشت', sector: 'Healthcare' },

  /* ── US — Consumer & Other ──────────────────────────── */
  { symbol: 'WMT', name: 'والمارت', nameEn: 'Walmart', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مصرفی', sector: 'Consumer' },
  { symbol: 'KO', name: 'کوکاکولا', nameEn: 'Coca-Cola', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مصرفی', sector: 'Consumer' },
  { symbol: 'PG', name: 'پراکتر اند گمبل', nameEn: 'P&G', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مصرفی', sector: 'Consumer' },
  { symbol: 'DIS', name: 'دیزنی', nameEn: 'Disney', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مصرفی', sector: 'Consumer' },
  { symbol: 'HD', name: 'هوم دیپو', nameEn: 'Home Depot', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - مصرفی', sector: 'Consumer' },
  { symbol: 'BA', name: 'بوئینگ', nameEn: 'Boeing', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - صنعت', sector: 'Industrial' },
  { symbol: 'CAT', name: 'کاترپیلار', nameEn: 'Caterpillar', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - صنعت', sector: 'Industrial' },
  { symbol: 'XOM', name: 'اکسون موبیل', nameEn: 'ExxonMobil', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - انرژی', sector: 'Energy' },
  { symbol: 'CVX', name: 'شورون', nameEn: 'Chevron', country: 'آمریکا', countryEn: 'US', exchange: 'NYSE', groupTitle: 'آمریکا - انرژی', sector: 'Energy' },

  /* ── Europe — UK ──────────────────────────────────────── */
  { symbol: 'SHEL.L', name: 'شل', nameEn: 'Shell', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', sector: 'Energy' },
  { symbol: 'BP.L', name: 'بی‌پی', nameEn: 'BP', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', sector: 'Energy' },
  { symbol: 'AZN.L', name: 'آسترازنکا', nameEn: 'AstraZeneca', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', sector: 'Healthcare' },
  { symbol: 'HSBA.L', name: 'اچ‌اس‌بی‌سی', nameEn: 'HSBC', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', sector: 'Finance' },
  { symbol: 'ULVR.L', name: 'یونی‌لیور', nameEn: 'Unilever', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', sector: 'Consumer' },
  { symbol: 'RIO.L', name: 'ریو تینتو', nameEn: 'Rio Tinto', country: 'انگلستان', countryEn: 'UK', exchange: 'LSE', groupTitle: 'اروپا - انگلستان', sector: 'Mining' },

  /* ── Europe — Germany ─────────────────────────────────── */
  { symbol: 'SAP.DE', name: 'اس‌ای‌پی', nameEn: 'SAP', country: 'آلمان', countryEn: 'DE', exchange: 'XETRA', groupTitle: 'اروپا - آلمان', sector: 'Technology' },
  { symbol: 'SIE.DE', name: 'زیمنس', nameEn: 'Siemens', country: 'آلمان', countryEn: 'DE', exchange: 'XETRA', groupTitle: 'اروپا - آلمان', sector: 'Industrial' },
  { symbol: 'ALV.DE', name: 'آلیانتس', nameEn: 'Allianz', country: 'آلمان', countryEn: 'DE', exchange: 'XETRA', groupTitle: 'اروپا - آلمان', sector: 'Finance' },
  { symbol: 'DTE.DE', name: 'دویچه تلکوم', nameEn: 'Deutsche Telekom', country: 'آلمان', countryEn: 'DE', exchange: 'XETRA', groupTitle: 'اروپا - آلمان', sector: 'Technology' },
  { symbol: 'BAS.DE', name: 'باسف', nameEn: 'BASF', country: 'آلمان', countryEn: 'DE', exchange: 'XETRA', groupTitle: 'اروپا - آلمان', sector: 'Chemical' },

  /* ── Europe — France ──────────────────────────────────── */
  { symbol: 'MC.PA', name: 'لورئال', nameEn: "L'Oréal", country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', sector: 'Consumer' },
  { symbol: 'OR.PA', name: 'لورانسی', nameEn: 'LVMH', country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', sector: 'Consumer' },
  { symbol: 'SAN.PA', name: 'سانوفی', nameEn: 'Sanofi', country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', sector: 'Healthcare' },
  { symbol: 'AI.PA', name: 'ایر بوس', nameEn: 'Airbus', country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', sector: 'Industrial' },
  { symbol: 'BNP.PA', name: 'بی‌ان‌پی پاریبا', nameEn: 'BNP Paribas', country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', sector: 'Finance' },
  { symbol: 'SU.PA', name: 'شلف', nameEn: 'Schneider', country: 'فرانسه', countryEn: 'FR', exchange: 'Euronext', groupTitle: 'اروپا - فرانسه', sector: 'Industrial' },

  /* ── Europe — Netherlands ─────────────────────────────── */
  { symbol: 'ASML.AS', name: 'اس‌ام‌ال', nameEn: 'ASML', country: 'هلند', countryEn: 'NL', exchange: 'Euronext', groupTitle: 'اروپا - هلند', sector: 'Technology' },

  /* ── Europe — Switzerland ─────────────────────────────── */
  { symbol: 'NESN.SW', name: 'نستله', nameEn: 'Nestlé', country: 'سوئیس', countryEn: 'CH', exchange: 'SIX', groupTitle: 'اروپا - سوئیس', sector: 'Consumer' },
  { symbol: 'ROG.SW', name: 'روچ', nameEn: 'Roche', country: 'سوئیس', countryEn: 'CH', exchange: 'SIX', groupTitle: 'اروپا - سوئیس', sector: 'Healthcare' },
  { symbol: 'NOVN.SW', name: 'نوارتیس', nameEn: 'Novartis', country: 'سوئیس', countryEn: 'CH', exchange: 'SIX', groupTitle: 'اروپا - سوئیس', sector: 'Healthcare' },

  /* ── Europe — Spain ───────────────────────────────────── */
  { symbol: 'ITX.MC', name: 'ایندیتکس', nameEn: 'Inditex', country: 'اسپانیا', countryEn: 'ES', exchange: 'BME', groupTitle: 'اروپا - اسپانیا', sector: 'Consumer' },
  { symbol: 'SAN.MC', name: 'سانتاندر', nameEn: 'Santander', country: 'اسپانیا', countryEn: 'ES', exchange: 'BME', groupTitle: 'اروپا - اسپانیا', sector: 'Finance' },

  /* ── Europe — Italy ───────────────────────────────────── */
  { symbol: 'ISP.MI', name: 'اینتسا سن‌پائولو', nameEn: 'Intesa Sanpaolo', country: 'ایتالیا', countryEn: 'IT', exchange: 'Borsa Italiana', groupTitle: 'اروپا - ایتالیا', sector: 'Finance' },
  { symbol: 'ENI.MI', name: 'انی', nameEn: 'Eni', country: 'ایتالیا', countryEn: 'IT', exchange: 'Borsa Italiana', groupTitle: 'اروپا - ایتالیا', sector: 'Energy' },

  /* ── Asia — Japan ─────────────────────────────────────── */
  { symbol: '7203.T', name: 'تویوتا', nameEn: 'Toyota', country: 'ژاپن', countryEn: 'JP', exchange: 'TSE', groupTitle: 'آسیا - ژاپن', sector: 'Automotive' },
  { symbol: '6758.T', name: 'سونی', nameEn: 'Sony', country: 'ژاپن', countryEn: 'JP', exchange: 'TSE', groupTitle: 'آسیا - ژاپن', sector: 'Technology' },
  { symbol: '9984.T', name: 'سافت‌بانک', nameEn: 'SoftBank', country: 'ژاپن', countryEn: 'JP', exchange: 'TSE', groupTitle: 'آسیا - ژاپن', sector: 'Technology' },
  { symbol: '6861.T', name: 'کیونسی', nameEn: 'Keyence', country: 'ژاپن', countryEn: 'JP', exchange: 'TSE', groupTitle: 'آسیا - ژاپن', sector: 'Technology' },
  { symbol: '7974.T', name: 'نینتندو', nameEn: 'Nintendo', country: 'ژاپن', countryEn: 'JP', exchange: 'TSE', groupTitle: 'آسیا - ژاپن', sector: 'Technology' },

  /* ── Asia — China (ADR & HK) ─────────────────────────── */
  { symbol: 'BABA', name: 'علی‌بابا', nameEn: 'Alibaba', country: 'چین', countryEn: 'CN', exchange: 'NYSE', groupTitle: 'آسیا - چین', sector: 'Technology' },
  { symbol: 'PDD', name: 'پیندودو', nameEn: 'PDD', country: 'چین', countryEn: 'CN', exchange: 'NASDAQ', groupTitle: 'آسیا - چین', sector: 'Technology' },
  { symbol: 'JD', name: 'جی‌دی کام', nameEn: 'JD.com', country: 'چین', countryEn: 'CN', exchange: 'NASDAQ', groupTitle: 'آسیا - چین', sector: 'Technology' },
  { symbol: 'BIDU', name: 'بایدو', nameEn: 'Baidu', country: 'چین', countryEn: 'CN', exchange: 'NASDAQ', groupTitle: 'آسیا - چین', sector: 'Technology' },
  { symbol: 'NIO', name: 'نیو', nameEn: 'NIO', country: 'چین', countryEn: 'CN', exchange: 'NYSE', groupTitle: 'آسیا - چین', sector: 'Automotive' },

  /* ── Asia — South Korea ──────────────────────────────── */
  { symbol: '005930.KS', name: 'سامسونگ', nameEn: 'Samsung', country: 'کره جنوبی', countryEn: 'KR', exchange: 'KRX', groupTitle: 'آسیا - کره جنوبی', sector: 'Technology' },
  { symbol: '000660.KS', name: 'اس‌کی هینیکس', nameEn: 'SK Hynix', country: 'کره جنوبی', countryEn: 'KR', exchange: 'KRX', groupTitle: 'آسیا - کره جنوبی', sector: 'Technology' },
  { symbol: '373220.KS', name: 'ال‌جی انرژی', nameEn: 'LG Energy', country: 'کره جنوبی', countryEn: 'KR', exchange: 'KRX', groupTitle: 'آسیا - کره جنوبی', sector: 'Technology' },

  /* ── Asia — India ─────────────────────────────────────── */
  { symbol: 'RELIANCE.NS', name: 'رلاینس', nameEn: 'Reliance', country: 'هند', countryEn: 'IN', exchange: 'NSE', groupTitle: 'آسیا - هند', sector: 'Conglomerate' },
  { symbol: 'TCS.NS', name: 'تی‌سی‌اس', nameEn: 'TCS', country: 'هند', countryEn: 'IN', exchange: 'NSE', groupTitle: 'آسیا - هند', sector: 'Technology' },
  { symbol: 'INFY.NS', name: 'اینفوسیس', nameEn: 'Infosys', country: 'هند', countryEn: 'IN', exchange: 'NSE', groupTitle: 'آسیا - هند', sector: 'Technology' },
  { symbol: 'HDFCBANK.NS', name: 'اچ‌دی‌اف‌سی بانک', nameEn: 'HDFC Bank', country: 'هند', countryEn: 'IN', exchange: 'NSE', groupTitle: 'آسیا - هند', sector: 'Finance' },
  { symbol: 'ICICIBANK.NS', name: 'آی‌سی‌آی‌سی‌آی بانک', nameEn: 'ICICI Bank', country: 'هند', countryEn: 'IN', exchange: 'NSE', groupTitle: 'آسیا - هند', sector: 'Finance' },

  /* ── Asia — Taiwan ────────────────────────────────────── */
  { symbol: '2330.TW', name: 'تی‌اس‌ام‌سی', nameEn: 'TSMC', country: 'تایوان', countryEn: 'TW', exchange: 'TWSE', groupTitle: 'آسیا - تایوان', sector: 'Semiconductor' },
  { symbol: '2317.TW', name: 'فاکسکان', nameEn: 'Foxconn', country: 'تایوان', countryEn: 'TW', exchange: 'TWSE', groupTitle: 'آسیا - تایوان', sector: 'Technology' },

  /* ── Asia — Australia ─────────────────────────────────── */
  { symbol: 'BHP.AX', name: 'بی‌اچ‌پی', nameEn: 'BHP', country: 'استرالیا', countryEn: 'AU', exchange: 'ASX', groupTitle: 'آسیا - استرالیا', sector: 'Mining' },
  { symbol: 'CSL.AX', name: 'سی‌اس‌ال', nameEn: 'CSL', country: 'استرالیا', countryEn: 'AU', exchange: 'ASX', groupTitle: 'آسیا - استرالیا', sector: 'Healthcare' },
  { symbol: 'CBA.AX', name: 'کامن‌ولث بانک', nameEn: 'CBA', country: 'استرالیا', countryEn: 'AU', exchange: 'ASX', groupTitle: 'آسیا - استرالیا', sector: 'Finance' },

  /* ── Middle East — Saudi Arabia ──────────────────────── */
  { symbol: '2222.SR', name: 'آرامکو', nameEn: 'Aramco', country: 'عربستان', countryEn: 'SA', exchange: 'Tadawul', groupTitle: 'خاورمیانه - عربستان', sector: 'Energy' },
  { symbol: '7010.SR', name: 'سابیک', nameEn: 'SABIC', country: 'عربستان', countryEn: 'SA', exchange: 'Tadawul', groupTitle: 'خاورمیانه - عربستان', sector: 'Chemical' },
  { symbol: '1180.SR', name: 'الراجحی بانک', nameEn: 'Al Rajhi', country: 'عربستان', countryEn: 'SA', exchange: 'Tadawul', groupTitle: 'خاورمیانه - عربستان', sector: 'Finance' },

  /* ── Middle East — UAE ────────────────────────────────── */
  { symbol: 'DFM.DU', name: 'دبی فیننشل مارکت', nameEn: 'DFM', country: 'امارات', countryEn: 'AE', exchange: 'DFM', groupTitle: 'خاورمیانه - امارات', sector: 'Finance' },
  { symbol: 'EMIRATESNB.DU', name: 'ام‌ان‌بی', nameEn: 'Emirates NBD', country: 'امارات', countryEn: 'AE', exchange: 'DFM', groupTitle: 'خاورمیانه - امارات', sector: 'Finance' },

  /* ── Middle East — Turkey ─────────────────────────────── */
  { symbol: 'THYAO.IS', name: 'ترکیش ایرلاینز', nameEn: 'Turkish Airlines', country: 'ترکیه', countryEn: 'TR', exchange: 'BIST', groupTitle: 'خاورمیانه - ترکیه', sector: 'Transport' },
  { symbol: 'GARAN.IS', name: 'گارانتی', nameEn: 'Garanti', country: 'ترکیه', countryEn: 'TR', exchange: 'BIST', groupTitle: 'خاورمیانه - ترکیه', sector: 'Finance' },
  { symbol: 'SAHOL.IS', name: 'شیشه', nameEn: 'Sisecam', country: 'ترکیه', countryEn: 'TR', exchange: 'BIST', groupTitle: 'خاورمیانه - ترکیه', sector: 'Industrial' },

  /* ── Latin America ────────────────────────────────────── */
  { symbol: 'VALE3.SA', name: 'واله', nameEn: 'Vale', country: 'برزیل', countryEn: 'BR', exchange: 'B3', groupTitle: 'آمریکای لاتین - برزیل', sector: 'Mining' },
  { symbol: 'PETR4.SA', name: 'پتروبراس', nameEn: 'Petrobras', country: 'برزیل', countryEn: 'BR', exchange: 'B3', groupTitle: 'آمریکای لاتین - برزیل', sector: 'Energy' },
  { symbol: 'AMX.MX', name: 'آمریکا موویل', nameEn: 'América Móvil', country: 'مکزیک', countryEn: 'MX', exchange: 'BMV', groupTitle: 'آمریکای لاتین - مکزیک', sector: 'Telecom' },
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

  const symbols = YAHOO_STOCKS.map((s) => s.symbol);
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
        const def = YAHOO_STOCKS.find((s) => s.symbol === r.symbol);
        if (!def) continue;
        quotes.push({
          symbol: r.symbol,
          name: def.name,
          nameEn: def.nameEn,
          country: def.country,
          countryEn: def.countryEn,
          exchange: def.exchange,
          groupTitle: def.groupTitle,
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
      console.error(`[Yahoo Finance] Error fetching batch ${i / BATCH_SIZE + 1}:`, err);
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

/* ─── Get stock definition by symbol ─────────────────── */

export function getYahooStockDef(symbol: string): YahooStock | undefined {
  return YAHOO_STOCKS.find((s) => s.symbol === symbol);
}
