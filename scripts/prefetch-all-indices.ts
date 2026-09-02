// ═══════════════════════════════════════════════════════════════════
// Pre-fetch ALL 50 TSE indices via the Next.js proxy endpoint.
// Run: npx tsx scripts/prefetch-all-indices.ts
// ═══════════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DB_DIR = join(process.cwd(), 'db');
if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });

// ── All web IDs ──────────────────────────────────────────────────
const MAIN_INDICES: Record<string, string> = {
  CWI: '32097828799138957',
  EWI: '67130298613737946',
  CWPI: '5798407779416661',
  EWPI: '8384385859414435',
  FFI: '49579049405614711',
  MKT1I: '62752761908615603',
  MKT2I: '71704845530629737',
  INDI: '43754960038275285',
  ACT50: '46342955726788357',
  LCI30: '10523825119011581',
};

const SECTOR_INDICES: Array<{ name: string; webId: string }> = [
  { name: 'زراعت', webId: '34408080767216529' },
  { name: 'ذغال سنگ', webId: '19219679288446732' },
  { name: 'کانی فلزی', webId: '13235969998952202' },
  { name: 'سایر معادن', webId: '62691002126902464' },
  { name: 'منسوجات', webId: '59288237226302898' },
  { name: 'محصولات چرمی', webId: '69306841376553334' },
  { name: 'محصولات چوبی', webId: '58440550086834602' },
  { name: 'محصولات کاغذی', webId: '30106839080444358' },
  { name: 'انتشار و چاپ', webId: '25766336681098389' },
  { name: 'فرآورده های نفتی', webId: '12331083953323969' },
  { name: 'لاستیک', webId: '36469751685735891' },
  { name: 'فلزات اساسی', webId: '32453344048876642' },
  { name: 'محصولات فلزی', webId: '1123534346391630' },
  { name: 'ماشین آلات', webId: '11451389074113298' },
  { name: 'دستگاه های برقی', webId: '33878047680249697' },
  { name: 'وسایل ارتباطی', webId: '24733701189547084' },
  { name: 'خودرو', webId: '20213770409093165' },
  { name: 'قند و شکر', webId: '21948907150049163' },
  { name: 'چند رشته ای', webId: '40355846462826897' },
  { name: 'تامین آب، برق و گاز', webId: '54843635503648458' },
  { name: 'غذایی', webId: '15508900928481581' },
  { name: 'دارویی', webId: '3615666621538524' },
  { name: 'شیمیایی', webId: '33626672012415176' },
  { name: 'خرده فروشی', webId: '65986638607018835' },
  { name: 'کاشی و سرامیک', webId: '57616105980228781' },
  { name: 'سیمان', webId: '70077233737515808' },
  { name: 'کانی غیر فلزی', webId: '14651627750314021' },
  { name: 'سرمایه گذاری', webId: '34295935482222451' },
  { name: 'بانک', webId: '72002976013856737' },
  { name: 'سایر مالی', webId: '25163959460949732' },
  { name: 'حمل و نقل', webId: '24187097921483699' },
  { name: 'رادیویی', webId: '41867092385281437' },
  { name: 'مالی', webId: '61247168213690670' },
  { name: 'اداره بازارهای مالی', webId: '61985386521682984' },
  { name: 'انبوه سازی', webId: '4654922806626448' },
  { name: 'رایانه', webId: '8900726085939949' },
  { name: 'اطلاعات و ارتباطات', webId: '18780171241610744' },
  { name: 'فنی مهندسی', webId: '47233872677452574' },
  { name: 'استخراج نفت', webId: '65675836323214668' },
  { name: 'بیمه و بازنشستگی', webId: '59105676994811497' },
];

// ── Gregorian → Jalali ──────────────────────────────────────────
function gregorianToJalali(gy: number, gm: number, gd: number): string {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) { jy = 979; gy -= 1600; } else { jy = 0; gy -= 621; }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

function parseB2Response(jsonStr: string) {
  const cleaned = jsonStr.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  let parsed: { indexB2?: Array<Record<string, unknown>> };
  try { parsed = JSON.parse(cleaned); } catch {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) { try { parsed = JSON.parse(cleaned.slice(0, lastBrace + 1)); } catch { return []; } }
    return [];
  }
  const items = parsed.indexB2 || [];
  const candles: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> = [];
  for (const item of items) {
    const close = Number(item.xNivInuClMresIbs) || 0;
    const first = Number(item.xNivInuPhMresIbs) || 0;
    const prevClose = Number(item.xNivInuPbMresIbs) || 0;
    const deven = Number(item.dEven);
    if (close <= 0 || !deven) continue;
    const s = String(deven);
    if (s.length < 8) continue;
    const gy = parseInt(s.slice(0, 4));
    const gm = parseInt(s.slice(4, 6));
    const gd = parseInt(s.slice(6, 8));
    candles.push({
      date: gregorianToJalali(gy, gm, gd),
      open: first > 0 ? first : prevClose,
      high: Math.max(first > 0 ? first : close, close),
      low: Math.min(first > 0 ? first : close, close),
      close, volume: 0,
    });
  }
  return candles;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAndSave(label: string, webId: string, fileName: string) {
  console.log(`Fetching ${label} (${webId})...`);
  try {
    const res = await fetch(`http://localhost:3000/api/index-fetch-proxy?webId=${encodeURIComponent(webId)}`, {
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`  ✗ ${label}: HTTP ${res.status} - ${body.slice(0, 100)}`);
      return false;
    }
    const json = await res.json();
    if (json.error) {
      console.error(`  ✗ ${label}: ${json.error}`);
      return false;
    }
    const candles = parseB2Response(json.raw || '');
    if (candles.length === 0) {
      console.error(`  ✗ ${label}: No candles parsed`);
      return false;
    }
    const filePath = join(DB_DIR, fileName);
    writeFileSync(filePath, JSON.stringify({ data: candles, time: Date.now() }), 'utf-8');
    const last = candles[candles.length - 1];
    console.log(`  ✓ ${label}: ${candles.length} candles, last=${last.date} close=${last.close}`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function main() {
  console.log('=== Pre-fetching ALL TSE indices ===\n');

  let ok = 0, fail = 0;

  // Main indices
  console.log('── Main Indices (10) ──');
  for (const [key, webId] of Object.entries(MAIN_INDICES)) {
    const success = await fetchAndSave(key, webId, `index-idx_${key}.json`);
    success ? ok++ : fail++;
    await sleep(3000); // 3s between requests
  }

  // Sector indices
  console.log('\n── Sector Indices (40) ──');
  for (const sector of SECTOR_INDICES) {
    const success = await fetchAndSave(sector.name, sector.webId, `sec-${sector.name}.json`);
    success ? ok++ : fail++;
    await sleep(3000); // 3s between requests
  }

  console.log(`\n=== Done: ${ok} success, ${fail} failed out of ${ok + fail} ===`);
}

main().catch(console.error);
