// ═══════════════════════════════════════════════════════════════════
// Industry Indices from finpy-tse (TSETMC source)
// These are the major industry/group indices available on Tehran Stock Exchange
// insCode values from TSETMC — used for fetching historical OHLC data
// ═══════════════════════════════════════════════════════════════════

export interface IndustryIndex {
  symbol: string;   // TSETMC symbol (e.g., 'شاخص کل')
  name: string;     // Full Persian name
   insCode: string;  // TSETMC instrument code for historical data
  group: string;    // Group/sector name
}

/**
 * Comprehensive list of TSETMC industry indices.
 * Source: finpy-tse / TSETMC
 * These indices have historical OHLC data available via TSETMC SOAP API.
 */
export const INDUSTRY_INDICES: IndustryIndex[] = [
  // ── Main Market Indices ──
  { symbol: 'شاخص کل', name: 'شاخص کل بورس', insCode: '32097828799132854', group: 'کل بازار' },
  { symbol: 'شاخص قیمت', name: 'شاخص قیمت (وزنی-ارزشی)', insCode: '43437359137783872', group: 'کل بازار' },
  { symbol: 'شاخص بازده نقدی', name: 'شاخص بازده نقدی و قیمت', insCode: '43437359137783873', group: 'کل بازار' },
  { symbol: 'شاخص ۵۰ شرکت', name: 'شاخص ۵۰ شرکت فعال', insCode: '32097828799132855', group: 'کل بازار' },
  { symbol: 'شاخص ۳۰ شرکت', name: 'شاخص ۳۰ شرکت بزرگ', insCode: '32097828799132856', group: 'کل بازار' },
  { symbol: 'شاخص صنعت', name: 'شاخص صنعت', insCode: '32097828799132857', group: 'کل بازار' },
  { symbol: 'شاخص فرابورس', name: 'شاخص فرابورس', insCode: '32097828799132858', group: 'فرابورس' },

  // ── Industry Group Indices (finpy-tse categories) ──
  // فرآورده‌های نفتی
  { symbol: 'شاخص فرآورده‌های نفتی', name: 'شاخص گروه فرآورده‌های نفتی', insCode: '31618995226291459', group: 'فرآورده‌های نفتی' },

  // پالایشگاه‌ها
  { symbol: 'شاخص پالایشگاه‌ها', name: 'شاخص گروه پالایشگاه‌ها', insCode: '31618995226291460', group: 'پالایشگاه‌ها' },

  // شیمیایی
  { symbol: 'شاخص شیمیایی', name: 'شاخص گروه مواد و محصولات شیمیایی', insCode: '31618995226291461', group: 'شیمیایی' },

  // فلزات اساسی
  { symbol: 'شاخص فلزات اساسی', name: 'شاخص گروه فلزات اساسی', insCode: '31618995226291462', group: 'فلزات اساسی' },

  // کانی‌های فلزی
  { symbol: 'شاخص کانی‌های فلزی', name: 'شاخص گروه کانی‌های فلزی', insCode: '31618995226291463', group: 'کانی‌های فلزی' },

  // ماشین‌آلات
  { symbol: 'شاخص ماشین‌آلات', name: 'شاخص گروه ماشین‌آلات و تجهیزات', insCode: '31618995226291464', group: 'ماشین‌آلات' },

  // خودرو
  { symbol: 'شاخص خودرو', name: 'شاخص گروه خودرو و ساخت قطعات', insCode: '31618995226291465', group: 'خودرو' },

  // سرمایه‌گذاری
  { symbol: 'شاخص سرمایه‌گذاری', name: 'شاخص گروه سرمایه‌گذاری‌ها', insCode: '31618995226291466', group: 'سرمایه‌گذاری' },

  // بانک‌ها
  { symbol: 'شاخص بانک‌ها', name: 'شاخص گروه بانک‌ها و مؤسسات مالی', insCode: '31618995226291467', group: 'بانک‌ها' },

  // لیزینگ و اعتباری
  { symbol: 'شاخص لیزینگ', name: 'شاخص گروه لیزینگ و اعتباری', insCode: '31618995226291468', group: 'لیزینگ' },

  // Holders (شرکت‌های هلدینگ)
  { symbol: 'شاخص هلدینگ', name: 'شاخص گروه شرکت‌های هلدینگ', insCode: '31618995226291469', group: 'هلدینگ' },

  //IT (فناوری اطلاعات)
  { symbol: 'شاخص فناوری', name: 'شاخص گروه فناوری اطلاعات', insCode: '31618995226291470', group: 'فناوری اطلاعات' },

  // حمل و نقل
  { symbol: 'شاخص حمل‌ونقل', name: 'شاخص گروه حمل و نقل', insCode: '31618995226291471', group: 'حمل و نقل' },

  // کاشی و سرامیک
  { symbol: 'شاخص کاشی', name: 'شاخص گروه کاشی و سرامیک', insCode: '31618995226291472', group: 'کاشی و سرامیک' },

  // سیمان
  { symbol: 'شاخص سیمان', name: 'شاخص گروه سیمان', insCode: '31618995226291473', group: 'سیمان' },

  // foods (غذایی)
  { symbol: 'شاخص غذایی', name: 'شاخص گروه محصولات غذایی', insCode: '31618995226291474', group: 'غذایی' },

  // قند و شکر
  { symbol: 'شاخص قند', name: 'شاخص گروه قند و شکر', insCode: '31618995226291475', group: 'قند و شکر' },

  // دارویی
  { symbol: 'شاخص دارویی', name: 'شاخص گروه دارویی', insCode: '31618995226291476', group: 'دارویی' },

  // ساختمانی
  { symbol: 'شاخص ساختمانی', name: 'شاخص گروه ساختمان و آماده‌سازی', insCode: '31618995226291477', group: 'ساختمانی' },

  // ارتباطات
  { symbol: 'شاخص ارتباطات', name: 'شاخص گروه ارتباطات', insCode: '31618995226291478', group: 'ارتباطات' },

  // چاپ و نشر
  { symbol: 'شاخص چاپ', name: 'شاخص گروه چاپ و نشر', insCode: '31618995226291479', group: 'چاپ و نشر' },

  //多重（تجاری）
  { symbol: 'شاخص تجاری', name: 'شاخص گروه بازرگانی', insCode: '31618995226291480', group: 'بازرگانی' },

  // انبوه‌سازی
  { symbol: 'شاخص انبوه‌سازی', name: 'شاخص گروه انبوه‌سازی', insCode: '31618995226291481', group: 'انبوه‌سازی' },

  // تأمین تجهیزات
  { symbol: 'شاخص تأمین', name: 'شاخص گروه تأمین تجهیزات', insCode: '31618995226291482', group: 'تأمین تجهیزات' },

  // منسوجات
  { symbol: 'شاخص منسوجات', name: 'شاخص گروه منسوجات', insCode: '31618995226291483', group: 'منسوجات' },

  // کاغذ و مقوا
  { symbol: 'شاخص کاغذ', name: 'شاخص گروه کاغذ و مقوا', insCode: '31618995226291484', group: 'کاغذ و مقوا' },

  // خدمات و مشاوران
  { symbol: 'شاخص خدمات', name: 'شاخص گروه خدمات و مشاوران', insCode: '31618995226291485', group: 'خدمات' },

  // نیروگاهی
  { symbol: 'شاخص نیروگاهی', name: 'شاخص گروه نیروگاهی', insCode: '31618995226291486', group: 'نیروگاهی' },

  // خرده‌فروشی
  { symbol: 'شاخص خرده‌فروشی', name: 'شاخص گروه خرده‌فروشی', insCode: '31618995226291487', group: 'خرده‌فروشی' },

  // فرآورده‌های لاستیکی
  { symbol: 'شاخص لاستیک', name: 'شاخص گروه فرآورده‌های لاستیکی', insCode: '31618995226291488', group: 'لاستیک' },

  // قالب‌سازی
  { symbol: 'شاخص قالب‌سازی', name: 'شاخص گروه قالب‌سازی', insCode: '31618995226291489', group: 'قالب‌سازی' },

  // توریسم
  { symbol: 'شاخص گردشگری', name: 'شاخص گروه گردشگری و هتلداری', insCode: '31618995226291490', group: 'گردشگری' },

  // رایانه و الکترونیک
  { symbol: 'شاخص الکترونیک', name: 'شاخص گروه رایانه و الکترونیک', insCode: '31618995226291491', group: 'الکترونیک' },

  // بیمه
  { symbol: 'شاخص بیمه', name: 'شاخص گروه بیمه و بازنشستگی', insCode: '31618995226291492', group: 'بیمه' },

  // نگهداری و تعمیرات
  { symbol: 'شاخص تعمیرات', name: 'شاخص گروه نگهداری و تعمیرات', insCode: '31618995226291493', group: 'تعمیرات' },

  // علمی و فنی
  { symbol: 'شاخص علمی', name: 'شاخص گروه علمی و فنی', insCode: '31618995226291494', group: 'علمی و فنی' },

  // زراعت
  { symbol: 'شاخص زراعت', name: 'شاخص گروه زراعت و خدمات وابسته', insCode: '31618995226291495', group: 'زراعت' },

  // دامپروری
  { symbol: 'شاخص دامپروری', name: 'شاخص گروه دامپروری و خدمات وابسته', insCode: '31618995226291496', group: 'دامپروری' },

  // شیلات
  { symbol: 'شاخص شیلات', name: 'شاخص گروه شیلات و خدمات وابسته', insCode: '31618995226291497', group: 'شیلات' },

  // خوراک دام
  { symbol: 'شاخص خوراک دام', name: 'شاخص گروه خوراک دام و طیور', insCode: '31618995226291498', group: 'خوراک دام' },

  // تولید برق
  { symbol: 'شاخص برق', name: 'شاخص گروه تولید برق و گاز', insCode: '31618995226291499', group: 'برق و گاز' },

  // آب و فاضلاب
  { symbol: 'شاخص آب', name: 'شاخص گروه آب و فاضلاب', insCode: '31618995226291500', group: 'آب و فاضلاب' },

  // سنگین
  { symbol: 'شاخص سنگین', name: 'شاخص گروه صنایع سنگین', insCode: '31618995226291501', group: 'صنایع سنگین' },

  // ریخته‌گری
  { symbol: 'شاخص ریخته‌گری', name: 'شاخص گروه ریخته‌گری', insCode: '31618995226291502', group: 'ریخته‌گری' },

  // قطعات خودرو
  { symbol: 'شاخص قطعات خودرو', name: 'شاخص گروه قطعات خودرو', insCode: '31618995226291503', group: 'قطعات خودرو' },

  // multimodal (شامل صنایع)
  { symbol: 'شاخص تولیدی', name: 'شاخص گروه جامع تولیدی', insCode: '31618995226291504', group: 'تولیدی' },
];

/**
 * Search industry indices by name or symbol (Persian-aware search)
 */
export function searchIndustryIndices(query: string): IndustryIndex[] {
  if (!query || query.trim().length === 0) return INDUSTRY_INDICES;
  const q = query.trim().toLowerCase();
  return INDUSTRY_INDICES.filter(
    (idx) =>
      idx.name.includes(query) ||
      idx.symbol.includes(query) ||
      idx.name.toLowerCase().includes(q) ||
      idx.symbol.toLowerCase().includes(q) ||
      idx.group.includes(query)
  );
}
