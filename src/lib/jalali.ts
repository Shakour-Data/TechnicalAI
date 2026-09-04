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

export function toPersianDigits(n: number | string): string {
  const converted = String(n).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d)]);
  // Wrap with LRM (Left-to-Right Mark, U+200E) to ensure numbers always render
  // left-to-right even in RTL context. This prevents the bidi algorithm from
  // reversing digit order when Persian digits appear inside RTL text.
  return `\u200E${converted}\u200E`;
}

// ─── Gregorian → Jalali ─────────────────────────────────────────────────────
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
export function candleDateToJalali(dateStr: string, format: 'full' | 'short' | 'compact' = 'short'): string {
  const parsed = parseDateString(dateStr);
  if (!parsed) return dateStr;
  return formatJalali(parsed.gy, parsed.gm, parsed.gd, format);
}

// ─── Format an ALREADY Jalali date string (no conversion needed) ────────────
// This is the correct function for TSETMC & TGJU data where dates are already Shamsi
// Input format: "1404/01/15" or "1404-01-15"
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
export function getPersianWeekday(gy: number, gm: number, gd: number): string {
  const d = new Date(gy, gm - 1, gd);
  const day = d.getDay();
  const persianDayIndex = (day + 1) % 7;
  return PERSIAN_WEEKDAYS[persianDayIndex];
}

// ─── Full Persian date with weekday (auto-detects Gregorian vs Jalali) ───
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
export function smartJalaliDate(dateStr: string, format: 'full' | 'short' | 'compact' = 'short'): string {
  if (isGregorianDate(dateStr)) {
    const p = parseDateString(dateStr);
    if (!p) return dateStr;
    return formatJalali(p.gy, p.gm, p.gd, format);
  }
  return formatJalaliString(dateStr, format);
}

// ─── Detect if a date string is Gregorian (year >= 1900) ──────────────
export function isGregorianDate(dateStr: string): boolean {
  const parsed = parseDateString(dateStr);
  if (!parsed) return false;
  return parsed.gy >= 1900;
}

// ─── Build Jalali time map for lightweight-charts (dates already Jalali) ───
export function buildJalaliTimeMap(candles: Array<{ date: string }>, format: 'compact' | 'short' = 'compact'): Map<number, string> {
  const map = new Map<number, string>();
  candles.forEach((c, i) => {
    map.set(i, formatJalaliString(c.date, format));
  });
  return map;
}

export { PERSIAN_MONTHS, PERSIAN_MONTHS_SHORT, PERSIAN_WEEKDAYS, PERSIAN_DIGITS };
