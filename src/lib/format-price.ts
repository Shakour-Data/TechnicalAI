/**
 * Centralized price formatting utility.
 * Auto-detects decimal places and currency units based on data source and category.
 */

/* ─── Types ────────────────────────────────────────────── */

export type DataSource = 'tse' | 'tgju' | 'yahoo';

/* ─── Decimal Detection ────────────────────────────────── */

/**
 * Auto-detect the appropriate number of decimal places for a price.
 *
 * Logic:
 * - TSE: always 0 (prices are integers in ریال)
 * - TGJU toman-based categories (currency, gold, silver): 0
 * - TGJU/Yahoo USD-based categories (forex, energy, metal, world_index, foreign_stock, commodity):
 *   Uses price magnitude to determine natural precision.
 * - Yahoo stocks/crypto/ETFs: uses price magnitude.
 */
export function detectDecimals(price: number, category: string, source: DataSource): number {
  if (price === 0 || !Number.isFinite(price)) return 2;

  // TSE prices are always integers (ریال)
  if (source === 'tse') return 0;

  // TGJU toman-based categories are always integers
  // Note: gold_etf is now TSE, not TGJU
  if (
    source === 'tgju' &&
    (category === 'currency' || category === 'gold' || category === 'silver')
  ) {
    return 0;
  }

  // TGJU crypto with very large prices (BTC millions of toman equivalent) are integers
  if (source === 'tgju' && category === 'crypto' && Math.abs(price) >= 10000) return 0;

  // For USD-based instruments and small crypto, detect from magnitude
  const abs = Math.abs(price);
  if (abs >= 10000) return 0;   // Large numbers: BTC, major indices, gold oz
  if (abs >= 100)   return 2;   // Medium: stocks, crude oil, some indices
  if (abs >= 1)     return 4;   // Small: forex pairs like EUR/USD
  if (abs >= 0.01)  return 4;   // Small crypto: some altcoins
  return 6;                     // Very small: micro-cap crypto, SHIB-class tokens
}

/* ─── Currency Unit Detection ──────────────────────────── */

/**
 * Map of Yahoo currency codes to Persian display names.
 */
const YAHOO_CURRENCY_MAP: Record<string, string> = {
  'USD': 'دلار',
  'EUR': 'یورو',
  'GBP': 'پوند',
  'JPY': 'ین',
  'CNY': 'یوان',
  'INR': 'روپیه',
  'KRW': 'وون',
  'RUB': 'روبل',
  'TRY': 'لیر',
  'BRL': 'رئال',
  'CAD': 'دلار کانادا',
  'AUD': 'دلار استرالیا',
  'CHF': 'فرانک',
  'SEK': 'کرون',
  'SGD': 'دلار سنگاپور',
  'HKD': 'دلار هنگ‌کنگ',
  'TWD': 'دلار تایوان',
  'NZD': 'دلار نیوزلند',
};

/**
 * Auto-detect the currency unit for an instrument.
 *
 * Logic:
 * - TSE stocks/bonds/futures/salaf/mortgage/etf: ریال
 * - TSE/TGJU indices: واحد
 * - TGJU currency/gold/silver/gold_etf: تومان
 * - TGJU crypto: تتر
 * - TGJU forex/energy/metal/world_index/foreign_stock/commodity: دلار
 * - Yahoo: use Yahoo's explicit currency field, mapped to Persian
 */
export function getCurrencyUnit(
  category: string,
  source: DataSource,
  yahooCurrency?: string,
): string {
  // Indices from any source
  if (category === 'index' || category === 'tse_index' || category === 'world_index') return 'واحد';

  // Yahoo instruments: use the explicit currency field
  if (source === 'yahoo' && yahooCurrency) {
    return YAHOO_CURRENCY_MAP[yahooCurrency] || yahooCurrency;
  }

  // TSE instruments default to ریال
  if (source === 'tse') return 'ریال';

  // TGJU Iranian categories — all prices from TGJU API are in Rials (ریال)
  // Note: gold_etf is now a TSE category, not TGJU
  if (category === 'currency' || category === 'gold' || category === 'silver') return 'ریال';
  if (category === 'crypto') return 'تتر';

  // Everything else (forex, energy, metal, foreign_stock, commodity)
  return 'دلار';
}

/**
 * Get the data source from instrument metadata.
 */
export function detectSource(item: { yahooSymbol?: string; tgjuKey?: string; category?: string }): DataSource {
  if (item.yahooSymbol) return 'yahoo';
  if (item.tgjuKey) return 'tgju';
  const TGJU_CATS = new Set(['currency', 'gold', 'silver', 'crypto', 'world_index', 'foreign_stock', 'forex', 'energy', 'metal', 'commodity']);
  if (item.category && TGJU_CATS.has(item.category)) return 'tgju';
  return 'tse';
}

/* ─── Formatting Functions ─────────────────────────────── */

/**
 * Format a price in Persian (Farsi) with the given number of decimal places.
 * Uses Persian digits and thousand separators.
 */
export function formatPriceFa(price: number, decimals: number): string {
  if (price == null || !Number.isFinite(price)) return '—';
  const raw = new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals > 0 ? Math.min(decimals, 2) : 0,
  }).format(price);
  // Wrap with LRM marks to ensure numbers render left-to-right in RTL context
  return `\u200E${raw}\u200E`;
}

/**
 * Format a price in English (Latin) digits with the given number of decimal places.
 */
export function formatPriceEn(price: number, decimals: number): string {
  if (price == null || !Number.isFinite(price)) return '—';
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals > 0 ? Math.min(decimals, 2) : 0,
  }).format(price);
}

/**
 * Format a price with currency unit in Persian.
 * Example: formatPriceWithUnit(1250.5, 2, 'تومان') → '۱,۲۵۰٫۵۰ تومان'
 */
export function formatPriceWithUnit(price: number, decimals: number, unit: string): string {
  if (price == null || !Number.isFinite(price)) return '—';
  const formatted = formatPriceFa(price, decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Format a percent change value.
 * Example: formatChangePercent(2.5) → '+۲٫۵۰٪'
 */
export function formatChangePercent(pcp: number): string {
  const sign = pcp > 0 ? '+' : '';
  const formatted = new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Math.abs(pcp));
  // Wrap number portion with LRM marks for correct RTL rendering
  return `${sign}\u200E${formatted}\u200E٪`;
}

/* ─── Convenience: full auto-detect formatting ──────────── */

/**
 * Format a price with auto-detected decimals and currency unit.
 */
export function formatAuto(
  price: number,
  category: string,
  source: DataSource,
  yahooCurrency?: string,
): { formatted: string; decimals: number; unit: string } {
  const decimals = detectDecimals(price, category, source);
  const unit = getCurrencyUnit(category, source, yahooCurrency);
  const formatted = formatPriceWithUnit(price, decimals, unit);
  return { formatted, decimals, unit };
}
