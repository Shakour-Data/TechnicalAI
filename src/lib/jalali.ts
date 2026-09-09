// ═══════════════════════════════════════════════════════════════════════════════
// Jalali (Shamsi / Solar Hijri) Date Converter
// Pure TypeScript — no external dependencies
// ═══════════════════════════════════════════════════════════════════════════════

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const PERSIAN_MONTHS_SHORT = [
  'فرو', 'ارد', 'خرد', 'تیر', 'مرد', 'شهر',
  'مهر', 'آبا', 'آذر', 'دی', 'بهم', 'اسف',
];

const PERSIAN_WEEKDAYS = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه',
];

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Convert a number or string to Persian (Farsi) digits.
 * Wraps the result with LRM (Left-to-Right Mark, U+200E) to ensure
 * numbers always render left-to-right even in RTL context.
 *
 * @param n - Number or string containing Latin digits (0-9)
 * @returns String with digits converted to Persian (۰-۹) and wrapped in LRM marks
 *
 * @example toPersianDigits(1404) → '\u200E۱۴۰۴\u200E'
 */
export function toPersianDigits(n: number | string): string {
  const converted = String(n).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d)]);
  // Wrap with LRM (Left-to-Right Mark, U+200E) to ensure numbers always render
  // left-to-right even in RTL context. This prevents the bidi algorithm from
  // reversing digit order when Persian digits appear inside RTL text.
  return `\u200E${converted}\u200E`;
}

// ─── Gregorian → Jalali ─────────────────────────────────────────────────────
/**
 * Convert a Gregorian date to a Jalali (Shamsi / Solar Hijri) date.
 * Pure TypeScript implementation with no external dependencies.
 *
 * @param gy - Gregorian year (e.g. 2025)
 * @param gm - Gregorian month (1-12)
 * @param gd - Gregorian day (1-31)
 * @returns Object with Jalali date: { jy, jm, jd }
 *
 * @example gregorianToJalali(2025, 3, 21) → { jy: 1404, jm: 1, jd: 1 }
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

// ─── Jalali → Gregorian ─────────────────────────────────────────────────────
/**
 * Convert a Jalali (Shamsi / Solar Hijri) date to a Gregorian date.
 * Pure TypeScript implementation with no external dependencies.
 *
 * @param jy - Jalali year (e.g. 1404)
 * @param jm - Jalali month (1-12)
 * @param jd - Jalali day (1-31)
 * @returns Object with Gregorian date: { gy, gm, gd }
 *
 * @example jalaliToGregorian(1404, 1, 1) → { gy: 2025, gm: 3, gd: 21 }
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let gy: number;
  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }
  let days = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor((jy % 33 + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const gdMap = days < 31 ? days + 1 : days < 59 ? days - 30 : days < 90 ? days - 58 : days < 120 ? days - 89 : days < 151 ? days - 119 : days < 181 ? days - 150 : days < 212 ? days - 180 : days < 243 ? days - 212 : days < 273 ? days - 243 : days < 304 ? days - 273 : days < 334 ? days - 304 : days - 334;
  const gmMap = days < 31 ? 1 : days < 59 ? 2 : days < 90 ? 3 : days < 120 ? 4 : days < 151 ? 5 : days < 181 ? 6 : days < 212 ? 7 : days < 243 ? 8 : days < 273 ? 9 : days < 304 ? 10 : days < 334 ? 11 : 12;
  return { gy, gm: gmMap, gd: gdMap + 1 };
}

// ─── Is Jalali Leap Year ────────────────────────────────────────────────────
/**
 * Check if a Jalali year is a leap year.
 * Uses the 2820-year cycle algorithm with known break points.
 *
 * @param jy - Jalali year
 * @returns True if the year is a leap year (Esfand has 30 days)
 */
export function isJalaliLeap(jy: number): boolean {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let jp = breaks[0];
  for (let i = 1; i < breaks.length; i++) {
    const jm = breaks[i];
    const jump = jm - jp;
    if (jy < jm) {
      let n = jy - jp;
      if (jump - n < 6) n = n - (jump - n);
      return ((jump + 1) * n) % jump < 3;
    }
    jp = jm;
  }
  return false;
}

// ─── Format Jalali Date (from Gregorian input) ──────────────────────────────
/**
 * Format a Gregorian date as a Jalali (Shamsi) date string in Persian digits.
 *
 * @param gy - Gregorian year
 * @param gm - Gregorian month (1-12)
 * @param gd - Gregorian day (1-31)
 * @param format - Output format: 'full' (e.g. '۲۱ فروردین ۱۴۰۴'),
 *                 'short' (e.g. '۲۱ فرو ۱۴۰۴'), 'compact' (e.g. '۱۴۰۴/۰۱/۲۱')
 * @returns Formatted Jalali date string in Persian digits
 */
export function formatJalali(gy: number, gm: number, gd: number, format: 'full' | 'short' | 'compact' = 'short'): string {
  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
  switch (format) {
    case 'full':
      return `${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
    case 'compact':
      return `${toPersianDigits(jy)}/${toPersianDigits(String(jm).padStart(2, '0'))}/${toPersianDigits(String(jd).padStart(2, '0'))}`;
    case 'short':
    default:
      return `${toPersianDigits(jd)} ${PERSIAN_MONTHS_SHORT[jm - 1]} ${toPersianDigits(jy)}`;
  }
}

// ─── Parse date string (YYYY/MM/DD or YYYY-MM-DD) to components ─────────────
/**
 * Parse a date string (YYYY/MM/DD or YYYY-MM-DD) into year/month/day components.
 *
 * @param dateStr - Date string in YYYY/MM/DD or YYYY-MM-DD format
 * @returns Object with { gy, gm, gd } or null if parsing fails
 */
export function parseDateString(dateStr: string): { gy: number; gm: number; gd: number } | null {
  const cleaned = dateStr.replace(/[\\/-]/g, '/');
  const parts = cleaned.split('/');
  if (parts.length >= 3) {
    const gy = parseInt(parts[0]);
    const gm = parseInt(parts[1]);
    const gd = parseInt(parts[2]);
    if (!isNaN(gy) && !isNaN(gm) && !isNaN(gd)) {
      return { gy, gm, gd };
    }
  }
  return null;
}

// ─── Convert candle date string (Gregorian) to Jalali ──────────────────────
/**
 * Convert a Gregorian date string (YYYY-MM-DD) to a formatted Jalali date string.
 *
 * @param dateStr - Gregorian date string (e.g. '2025-03-21')
 * @param format - Output format: 'full', 'short', or 'compact'
 * @returns Formatted Jalali date string, or the original string if parsing fails
 */
export function candleDateToJalali(dateStr: string, format: 'full' | 'short' | 'compact' = 'short'): string {
  const parsed = parseDateString(dateStr);
  if (!parsed) return dateStr;
  return formatJalali(parsed.gy, parsed.gm, parsed.gd, format);
}

// ─── Format an ALREADY Jalali date string (no conversion needed) ────────────
// This is the correct function for TSETMC & TGJU data where dates are already Shamsi
// Input format: "1404/01/15" or "1404-01-15"
/**
 * Format an already-Jalali date string (no conversion needed).
 * Use this for TSETMC & TGJU data where dates are already Shamsi.
 *
 * @param dateStr - Jalali date string in YYYY/MM/DD or YYYY-MM-DD format (e.g. '1404/01/15')
 * @param format - Output format: 'full', 'short', or 'compact' (default)
 * @returns Formatted Jalali date string in Persian digits
 */
export function formatJalaliString(dateStr: string, format: 'full' | 'short' | 'compact' = 'compact'): string {
  const parsed = parseDateString(dateStr);
  if (!parsed) return toPersianDigits(dateStr);
  const { gy, gm, gd } = parsed;
  switch (format) {
    case 'full':
      return `${toPersianDigits(gd)} ${PERSIAN_MONTHS[gm - 1]} ${toPersianDigits(gy)}`;
    case 'compact':
      return `${toPersianDigits(gy)}/${toPersianDigits(String(gm).padStart(2, '0'))}/${toPersianDigits(String(gd).padStart(2, '0'))}`;
    case 'short':
    default:
      return `${toPersianDigits(gd)} ${PERSIAN_MONTHS_SHORT[gm - 1]} ${toPersianDigits(gy)}`;
  }
}

// ─── Get weekday name in Persian (from Gregorian date) ─────────────────
/**
 * Get the Persian weekday name for a Gregorian date.
 * Persian week starts on Saturday (شنبه).
 *
 * @param gy - Gregorian year
 * @param gm - Gregorian month (1-12)
 * @param gd - Gregorian day (1-31)
 * @returns Persian weekday name (e.g. 'شنبه', 'یکشنبه', ...)
 */
export function getPersianWeekday(gy: number, gm: number, gd: number): string {
  const d = new Date(gy, gm - 1, gd);
  const day = d.getDay();
  const persianDayIndex = (day + 1) % 7;
  return PERSIAN_WEEKDAYS[persianDayIndex];
}

// ─── Full Persian date with weekday (auto-detects Gregorian vs Jalali) ───
/**
 * Format a date string as a full Persian date with weekday.
 * Auto-detects whether the input is Gregorian (year ≥ 1900) or Jalali.
 *
 * @param dateStr - Date string (Gregorian or Jalali) in YYYY/MM/DD or YYYY-MM-DD format
 * @returns Full Persian date with weekday (e.g. 'شنبه، ۲۱ فروردین ۱۴۰۴')
 */
export function fullPersianDate(dateStr: string): string {
  const parsed = parseDateString(dateStr);
  if (!parsed) return dateStr;
  const { gy, gm, gd } = parsed;

  if (isGregorianDate(dateStr)) {
    // Input is Gregorian — convert to Jalali
    const weekday = getPersianWeekday(gy, gm, gd);
    const datePart = formatJalali(gy, gm, gd, 'full');
    return `${weekday}، ${datePart}`;
  } else {
    // Input is already Jalali — convert to Gregorian to get weekday, then format Jalali
    const greg = jalaliToGregorian(gy, gm, gd);
    const weekday = getPersianWeekday(greg.gy, greg.gm, greg.gd);
    const datePart = formatJalaliString(dateStr, 'full');
    return `${weekday}، ${datePart}`;
  }
}

// ─── Smart date converter: auto-detects and returns correct Jalali string ───
// Use this anywhere you need a single Jalali date from an unknown-source date string
/**
 * Smart date converter: auto-detects whether input is Gregorian or Jalali
 * and returns the correctly formatted Jalali string.
 * Use this anywhere you need a single Jalali date from an unknown-source date string.
 *
 * @param dateStr - Date string (Gregorian if year ≥ 1900, otherwise Jalali)
 * @param format - Output format: 'full', 'short', or 'compact' (default)
 * @returns Formatted Jalali date string
 */
export function smartJalaliDate(dateStr: string, format: 'full' | 'short' | 'compact' = 'short'): string {
  if (isGregorianDate(dateStr)) {
    const p = parseDateString(dateStr);
    if (!p) return dateStr;
    return formatJalali(p.gy, p.gm, p.gd, format);
  }
  return formatJalaliString(dateStr, format);
}

// ─── Detect if a date string is Gregorian (year >= 1900) ──────────────
/**
 * Detect if a date string is Gregorian (year ≥ 1900) or Jalali.
 *
 * @param dateStr - Date string to check
 * @returns True if the year component is ≥ 1900 (Gregorian), false otherwise
 */
export function isGregorianDate(dateStr: string): boolean {
  const parsed = parseDateString(dateStr);
  if (!parsed) return false;
  return parsed.gy >= 1900;
}

// ─── Build Jalali time map for lightweight-charts (dates already Jalali) ───
/**
 * Build a Jalali time map for lightweight-charts from candle data where dates are already Jalali.
 * Maps each candle's index to its formatted Jalali date string.
 *
 * @param candles - Array of objects with a 'date' property containing Jalali date strings
 * @param format - Output format: 'compact' (default) or 'short'
 * @returns Map from candle index (number) to formatted Jalali date string
 */
export function buildJalaliTimeMap(candles: Array<{ date: string }>, format: 'compact' | 'short' = 'compact'): Map<number, string> {
  const map = new Map<number, string>();
  candles.forEach((c, i) => {
    map.set(i, formatJalaliString(c.date, format));
  });
  return map;
}

export { PERSIAN_MONTHS, PERSIAN_MONTHS_SHORT, PERSIAN_WEEKDAYS, PERSIAN_DIGITS };
