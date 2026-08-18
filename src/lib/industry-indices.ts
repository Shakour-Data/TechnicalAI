// ═══════════════════════════════════════════════════════════════════
// Industry Indices — sourced from finpy-tse (github.com/ARahimiQuant/finpy-tse)
// ═══════════════════════════════════════════════════════════════════

export interface IndustryIndex {
  symbol: string;     // Display name in Persian (e.g., 'شاخص خودرو')
  name: string;       // Full Persian name
  finpySector: string; // finpy-tse sector name (exact match for API call)
  webId: number;      // TSETMC web ID (used by finpy-tse internally)
  group: string;      // Group/sector category
  isMainIndex?: boolean; // True for main market indices (شاخص کل, etc.)
}

/**
 * Industry group indices — data source: finpy-tse
 * Each entry maps to a finpy-tse sector name that is passed to
 * Get_SectorIndex_History() for OHLC price history.
 *
 * Main market indices (شاخص کل, شاخص ۵۰, etc.) use the TSETMC CDN API
 * via the finpy-tse service's /api/main-index-history endpoint.
 */
export const INDUSTRY_INDICES: IndustryIndex[] = [
  // ── Main Market Indices ──
  { symbol: 'شاخص کل', name: 'شاخص کل بورس (TEPIX)', finpySector: '', webId: 0, group: 'کل بازار', isMainIndex: true },
  { symbol: 'شاخص قیمت', name: 'شاخص قیمت (وزنی-ارزشی)', finpySector: '', webId: 0, group: 'کل بازار', isMainIndex: true },
  { symbol: 'شاخص ۵۰ شرکت', name: 'شاخص ۵۰ شرکت فعال', finpySector: '', webId: 0, group: 'کل بازار', isMainIndex: true },
  { symbol: 'شاخص ۳۰ شرکت', name: 'شاخص ۳۰ شرکت بزرگ', finpySector: '', webId: 0, group: 'کل بازار', isMainIndex: true },
  { symbol: 'شاخص صنعت', name: 'شاخص صنعت', finpySector: '', webId: 0, group: 'کل بازار', isMainIndex: true },
  { symbol: 'شاخص فرابورس', name: 'شاخص فرابورس', finpySector: '', webId: 0, group: 'فرابورس', isMainIndex: true },

  // ── Industry Group Indices (finpy-tse sectors) ──
  { symbol: 'شاخص فرآورده‌های نفتی', name: 'شاخص گروه فرآورده‌های نفتی', finpySector: 'فرآورده‌های نفتی', webId: 12331083953323969, group: 'فرآورده‌های نفتی' },
  { symbol: 'شاخص شیمیایی', name: 'شاخص گروه مواد و محصولات شیمیایی', finpySector: 'شیمیایی', webId: 33626672012415176, group: 'شیمیایی' },
  { symbol: 'شاخص فلزات اساسی', name: 'شاخص گروه فلزات اساسی', finpySector: 'فلزات اساسی', webId: 32453344048876642, group: 'فلزات اساسی' },
  { symbol: 'شاخص کانی‌های فلزی', name: 'شاخص گروه کانی فلزی', finpySector: 'کانی فلزی', webId: 13235969998952202, group: 'کانی‌های فلزی' },
  { symbol: 'شاخص ماشین‌آلات', name: 'شاخص گروه ماشین‌آلات و تجهیزات', finpySector: 'ماشین‌آلات', webId: 11451389074113298, group: 'ماشین‌آلات' },
  { symbol: 'شاخص خودرو', name: 'شاخص گروه خودرو و ساخت قطعات', finpySector: 'خودرو', webId: 20213770409093165, group: 'خودرو' },
  { symbol: 'شاخص سرمایه‌گذاری', name: 'شاخص گروه سرمایه‌گذاری‌ها', finpySector: 'سرمایه‌گذاری', webId: 34295935482222451, group: 'سرمایه‌گذاری' },
  { symbol: 'شاخص بانک‌ها', name: 'شاخص گروه بانک‌ها و مؤسسات مالی', finpySector: 'بانک', webId: 72002976013856737, group: 'بانک‌ها' },
  { symbol: 'شاخص بیمه', name: 'شاخص گروه بیمه و بازنشستگی', finpySector: 'بیمه و بازنشستگی', webId: 59105676994811497, group: 'بیمه' },
  { symbol: 'شاخص دارویی', name: 'شاخص گروه دارویی', finpySector: 'دارویی', webId: 3615666621538524, group: 'دارویی' },
  { symbol: 'شاخص غذایی', name: 'شاخص گروه محصولات غذایی', finpySector: 'غذایی', webId: 15508900928481581, group: 'غذایی' },
  { symbol: 'شاخص سیمان', name: 'شاخص گروه سیمان', finpySector: 'سیمان', webId: 70077233737515808, group: 'سیمان' },
  { symbol: 'شاخص کاشی', name: 'شاخص گروه کاشی و سرامیک', finpySector: 'کاشی و سرامیک', webId: 57616105980228781, group: 'کاشی و سرامیک' },
  { symbol: 'شاخص قند', name: 'شاخص گروه قند و شکر', finpySector: 'قند و شکر', webId: 21948907150049163, group: 'قند و شکر' },
  { symbol: 'شاخص لاستیک', name: 'شاخص گروه فرآورده‌های لاستیکی', finpySector: 'لاستیک', webId: 36469751685735891, group: 'لاستیک' },
  { symbol: 'شاخص ساختمانی', name: 'شاخص گروه ساختمان و آماده‌سازی', finpySector: 'انبوه‌سازی', webId: 4654922806626448, group: 'ساختمانی' },
  { symbol: 'شاخص حمل‌ونقل', name: 'شاخص گروه حمل و نقل', finpySector: 'حمل و نقل', webId: 24187097921483699, group: 'حمل و نقل' },
  { symbol: 'شاخص منسوجات', name: 'شاخص گروه منسوجات', finpySector: 'منسوجات', webId: 59288237226302898, group: 'منسوجات' },
  { symbol: 'شاخص محصولات فلزی', name: 'شاخص گروه محصولات فلزی', finpySector: 'محصولات فلزی', webId: 1123534346391630, group: 'محصولات فلزی' },
  { symbol: 'شاخص برق و گاز', name: 'شاخص گروه تأمین آب، برق و گاز', finpySector: 'تامین آب، برق و گاز', webId: 54843635503648458, group: 'برق و گاز' },
  { symbol: 'شاخص استخراج نفت', name: 'شاخص گروه استخراج نفت', finpySector: 'استخراج نفت', webId: 65675836323214668, group: 'نفت و گاز' },
  { symbol: 'شاخص ذغال سنگ', name: 'شاخص گروه ذغال سنگ', finpySector: 'ذغال سنگ', webId: 19219679288446732, group: 'ذغال سنگ' },
  { symbol: 'شاخص سایر معادن', name: 'شاخص گروه سایر معادن', finpySector: 'سایر معادن', webId: 62691002126902464, group: 'معادن' },
  { symbol: 'شاخص کانی غیرفلزی', name: 'شاخص گروه کانی غیر فلزی', finpySector: 'کانی غیر فلزی', webId: 14651627750314021, group: 'کانی غیرفلزی' },
  { symbol: 'شاخص محصولات چوبی', name: 'شاخص گروه محصولات چوبی', finpySector: 'محصولات چوبی', webId: 58440550086834602, group: 'چوبی' },
  { symbol: 'شاخص کاغذ', name: 'شاخص گروه محصولات کاغذی', finpySector: 'محصولات کاغذی', webId: 30106839080444358, group: 'کاغذ و مقوا' },
  { symbol: 'شاخص چاپ', name: 'شاخص گروه انتشار و چاپ', finpySector: 'انتشار و چاپ', webId: 25766336681098389, group: 'چاپ و نشر' },
  { symbol: 'شاخص محصولات چرمی', name: 'شاخص گروه محصولات چرمی', finpySector: 'محصولات چرمی', webId: 69306841376553334, group: 'چرمی' },
  { symbol: 'شاخص دستگاه‌های برقی', name: 'شاخص گروه دستگاه‌های برقی', finpySector: 'دستگاه‌های برقی', webId: 33878047680249697, group: 'برقی' },
  { symbol: 'شاخص وسایل ارتباطی', name: 'شاخص گروه وسایل ارتباطی', finpySector: 'وسایل ارتباطی', webId: 24733701189547084, group: 'ارتباطات' },
  { symbol: 'شاخص چندرشته‌ای', name: 'شاخص گروه چند رشته‌ای', finpySector: 'چند رشته‌ای', webId: 40355846462826897, group: 'چندرشته‌ای' },
  { symbol: 'شاخص خرده‌فروشی', name: 'شاخص گروه خرده فروشی', finpySector: 'خرده فروشی', webId: 65986638607018835, group: 'خرده‌فروشی' },
  { symbol: 'شاخص رایانه', name: 'شاخص گروه رایانه', finpySector: 'رایانه', webId: 8900726085939949, group: 'رایانه' },
  { symbol: 'شاخص اطلاعات و ارتباطات', name: 'شاخص گروه اطلاعات و ارتباطات', finpySector: 'اطلاعات و ارتباطات', webId: 18780171241610744, group: 'فناوری اطلاعات' },
  { symbol: 'شاخص فنی مهندسی', name: 'شاخص گروه فنی مهندسی', finpySector: 'فنی مهندسی', webId: 47233872677452574, group: 'فنی مهندسی' },
  { symbol: 'شاخص سایر مالی', name: 'شاخص گروه سایر مالی', finpySector: 'سایر مالی', webId: 25163959460949732, group: 'مالی' },
  { symbol: 'شاخص مالی', name: 'شاخص گروه مالی', finpySector: 'مالی', webId: 61247168213690670, group: 'مالی' },
  { symbol: 'شاخص رادیویی', name: 'شاخص گروه رادیویی', finpySector: 'رادیویی', webId: 41867092385281437, group: 'رادیویی' },
  { symbol: 'شاخص اداره بازارها', name: 'شاخص گروه اداره بازارهای مالی', finpySector: 'اداره بازارهای مالی', webId: 61985386521682984, group: 'بازار مالی' },
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
      idx.group.includes(query) ||
      idx.finpySector.includes(query),
  );
}
