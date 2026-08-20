/**
 * Shared z-ai SDK rate-limited page_reader
 *
 * ALL page_reader calls across the app MUST go through this module.
 * Uses dynamic import to avoid SDK crashing during Turbopack compilation.
 */

// ═══════════════════════════════════════════════════════════════
// Z-AI SDK singleton (lazy, dynamic import)
// ═══════════════════════════════════════════════════════════════

type ZaiType = Awaited<ReturnType<typeof import('z-ai-web-dev-sdk').default.create>>;
let zaiInstance: ZaiType | null = null;
let zaiInitPromise: Promise<ZaiType> | null = null;

export async function getZai(): Promise<ZaiType> {
  if (zaiInstance) return zaiInstance;
  if (!zaiInitPromise) {
    zaiInitPromise = import('z-ai-web-dev-sdk').then(async (mod) => {
      const zai = await mod.default.create();
      zaiInstance = zai;
      return zai;
    }).catch((err) => {
      zaiInitPromise = null;
      throw err;
    });
  }
  return zaiInitPromise;
}

// ═══════════════════════════════════════════════════════════════
// Rate-limited page_reader queue
// ═══════════════════════════════════════════════════════════════

const MIN_INTERVAL_MS = 2000;
let lastCallTime = 0;
let cooldownUntil = 0;
const queue: Array<{ resolve: (v: string) => void; reject: (e: Error) => void; url: string }> = [];
let processing = false;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const now = Date.now();
    if (cooldownUntil > now) {
      const waitMs = cooldownUntil - now;
      console.log(`[zai-shared] Cooldown, waiting ${Math.round(waitMs / 1000)}s...`);
      await sleep(waitMs);
    }

    const item = queue.shift()!;
    try {
      const elapsed = Date.now() - lastCallTime;
      if (elapsed < MIN_INTERVAL_MS) {
        await sleep(MIN_INTERVAL_MS - elapsed);
      }

      const zai = await getZai();
      const result = await zai.functions.invoke('page_reader', { url: item.url });
      lastCallTime = Date.now();

      const html: string = result.data?.html || '';
      if (!html || html.length < 5) {
        item.reject(new Error('Empty response from page_reader'));
      } else {
        item.resolve(html);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      item.reject(new Error(msg));

      if (msg.includes('429')) {
        const currentCooldown = Math.max(cooldownUntil - Date.now(), 0);
        const newCooldown = Math.max(currentCooldown + 60000, 120000);
        cooldownUntil = Date.now() + Math.min(newCooldown, 600000);
        console.warn(`[zai-shared] 429, cooldown: ${Math.round(Math.min(newCooldown, 600000) / 1000)}s`);
      }
    }
  }

  processing = false;
}

export async function rateLimitedPageReader(url: string, timeoutMs = 60_000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = queue.findIndex(q => q.url === url);
      if (idx >= 0) queue.splice(idx, 1);
      reject(new Error(`page_reader timeout after ${timeoutMs}ms for ${url.slice(0, 80)}`));
    }, timeoutMs);

    queue.push({
      url,
      resolve: (html) => { clearTimeout(timer); resolve(html); },
      reject: (err) => { clearTimeout(timer); reject(err); },
    });

    processQueue();
  });
}

export async function batchPageReader(
  urls: string[],
  options: { timeoutMs?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<Array<{ url: string; html: string } | null>> {
  const results: Array<{ url: string; html: string } | null> = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const html = await rateLimitedPageReader(urls[i], options.timeoutMs);
      results.push({ url: urls[i], html });
    } catch {
      results.push(null);
    }
    options.onProgress?.(i + 1, urls.length);
  }
  return results;
}
