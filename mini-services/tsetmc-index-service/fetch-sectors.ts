// ═══════════════════════════════════════════════════════════════════
// One-shot sector fetcher — initializes z-ai SDK once, fetches all
// missing sector indices sequentially with delays.
// Saves to db/sector-latest.json after each successful fetch.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ZAI from 'z-ai-web-dev-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '..', '..', 'db');
const DELAY_MS = 25000; // 25 seconds between requests

const SECTORS: Array<{ sector: string; webId: string }> = [
  { sector: 'محصولات کاغذی', webId: '30106839080444358' },
  { sector: 'انتشار و چاپ', webId: '25766336681098389' },
  { sector: 'فرآورده های نفتی', webId: '12331083953323969' },
  { sector: 'لاستیک', webId: '36469751685735891' },
  { sector: 'فلزات اساسی', webId: '32453344048876642' },
  { sector: 'محصولات فلزی', webId: '1123534346391630' },
  { sector: 'ماشین آلات', webId: '11451389074113298' },
  { sector: 'دستگاه های برقی', webId: '33878047680249697' },
  { sector: 'وسایل ارتباطی', webId: '24733701189547084' },
  { sector: 'خودرو', webId: '20213770409093165' },
  { sector: 'قند و شکر', webId: '21948907150049163' },
  { sector: 'چند رشته ای', webId: '40355846462826897' },
  { sector: 'تامین آب، برق و گاز', webId: '54843635503648458' },
  { sector: 'غذایی', webId: '15508900928481581' },
  { sector: 'دارویی', webId: '3615666621538524' },
  { sector: 'شیمیایی', webId: '33626672012415176' },
  { sector: 'خرده فروشی', webId: '65986638607018835' },
  { sector: 'کاشی و سرامیک', webId: '57616105980228781' },
  { sector: 'سیمان', webId: '70077233737515808' },
  { sector: 'کانی غیر فلزی', webId: '14651627750314021' },
  { sector: 'سرمایه گذاری', webId: '34295935482222451' },
  { sector: 'بانک', webId: '72002976013856737' },
  { sector: 'سایر مالی', webId: '25163959460949732' },
  { sector: 'حمل و نقل', webId: '24187097921483699' },
  { sector: 'رادیویی', webId: '41867092385281437' },
  { sector: 'مالی', webId: '61247168213690670' },
  { sector: 'اداره بازارهای مالی', webId: '61985386521682984' },
  { sector: 'انبوه سازی', webId: '4654922806626448' },
  { sector: 'رایانه', webId: '8900726085939949' },
  { sector: 'اطلاعات و ارتباطات', webId: '18780171241610744' },
  { sector: 'فنی مهندسی', webId: '47233872677452574' },
  { sector: 'استخراج نفت', webId: '65675836323214668' },
  { sector: 'بیمه و بازنشستگی', webId: '59105676994811497' },
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function safeReadJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch { return null; }
}

function safeWriteJson(filePath: string, data: unknown): void {
  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  } catch (err) { console.error('Write failed:', err); }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Initializing z-ai SDK...`);
  const zai = await ZAI.create();
  console.log(`[${new Date().toISOString()}] SDK ready. Starting to fetch ${SECTORS.length} sectors...`);

  // Load existing data
  const results: Record<string, { close: number; pcp: number; date: string; webId: string }> = {};
  const fileLatest = safeReadJson(join(DB_DIR, 'sector-latest.json'));
  if (fileLatest) {
    const fd = (fileLatest.data || fileLatest) as Record<string, Record<string, unknown>>;
    for (const [s, info] of Object.entries(fd)) {
      if (info.close && Number(info.close) > 0) {
        results[s] = { close: Number(info.close), pcp: Number(info.pcp) || 0, date: String(info.date || ''), webId: String(info.webId || '') };
      }
    }
  }
  console.log(`[${new Date().toISOString()}] Loaded ${Object.keys(results).length} from cache`);

  let fetched = 0, skipped = 0, failed = 0;

  for (let i = 0; i < SECTORS.length; i++) {
    const { sector, webId } = SECTORS[i];
    const cacheFile = join(DB_DIR, `sec-${sector}.json`);

    // Skip if cached (< 6h old)
    if (existsSync(cacheFile)) {
      const cached = safeReadJson(cacheFile);
      if (cached && cached.data && (cached.data as unknown[]).length > 0) {
        const age = Date.now() - ((cached.time as number) || 0);
        if (age < 6 * 3600 * 1000) {
          const arr = cached.data as Array<{ close: number }>;
          const last = arr[arr.length - 1];
          const prev = arr.length > 1 ? arr[arr.length - 2] : last;
          const close = last.close;
          const pcp = prev.close > 0 ? Math.round(((close - prev.close) / prev.close) * 10000) / 100 : 0;
          results[sector] = { close, pcp, date: '', webId };
          skipped++;
          console.log(`[${new Date().toISOString()}] [${i + 1}/${SECTORS.length}] ${sector}: cached (${Math.round(age / 60000)}m ago)`);
          continue;
        }
      }
    }

    console.log(`[${new Date().toISOString()}] [${i + 1}/${SECTORS.length}] Fetching ${sector}...`);

    try {
      const result = await zai.functions.invoke('page_reader', {
        url: `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}`,
      });

      if (result.code !== 200 || !result.data?.html) {
        console.warn(`[${new Date().toISOString()}] ${sector}: API error ${result.code}`);
        failed++;
        if (i < SECTORS.length - 1) await sleep(DELAY_MS);
        continue;
      }

      const html = result.data.html as string;
      const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
      if (!preMatch) { console.warn(`[${new Date().toISOString()}] ${sector}: no <pre> tag`); failed++; if (i < SECTORS.length - 1) await sleep(DELAY_MS); continue; }

      const jsonStr = preMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const parsed = JSON.parse(jsonStr);
      const items: Array<Record<string, unknown>> = parsed.indexB2 || [];

      const valid = items.filter(x => Number(x.xNivInuClMresIbs) > 0);
      if (valid.length === 0) { console.warn(`[${new Date().toISOString()}] ${sector}: no valid data`); failed++; if (i < SECTORS.length - 1) await sleep(DELAY_MS); continue; }

      const last = valid[valid.length - 1];
      const prev = valid.length > 1 ? valid[valid.length - 2] : last;
      const close = Number(last.xNivInuClMresIbs);
      const prevClose = Number(prev.xNivInuClMresIbs);
      const pcp = prevClose > 0 ? Math.round(((close - prevClose) / prevClose) * 10000) / 100 : 0;

      results[sector] = { close, pcp, date: String(last.dEven || ''), webId };
      fetched++;

      // Save progress
      safeWriteJson(join(DB_DIR, 'sector-latest.json'), { data: results, time: Date.now() });
      console.log(`[${new Date().toISOString()}] [${i + 1}/${SECTORS.length}] ${sector}: ${close.toLocaleString()} (${pcp}%)`);
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err));
      console.warn(`[${new Date().toISOString()}] ${sector}: ${msg.slice(0, 100)}`);
      failed++;
    }

    if (i < SECTORS.length - 1) await sleep(DELAY_MS);
  }

  // Final save
  safeWriteJson(join(DB_DIR, 'sector-latest.json'), { data: results, time: Date.now() });
  console.log(`\n[${new Date().toISOString()}] DONE: ${fetched} fetched, ${skipped} cached, ${failed} failed, ${Object.keys(results).length}/40 total`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
