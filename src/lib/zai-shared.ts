/**
 * Shared z-ai SDK rate-limited page_reader
 *
 * ALL page_reader calls across the app MUST go through this module.
 * This prevents 429 rate-limit errors by:
 * 1. Serializing all calls (one at a time)
 * 2. Enforcing minimum interval between calls
 * 3. Global cooldown when 429 is detected
 */

import ZAI from 'z-ai-web-dev-sdk';

// ═══════════════════════════════════════════════════════════════
// Z-AI SDK singleton
// ═══════════════════════════════════════════════════════════════

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
let zaiInitPromise: Promise<Awaited<ReturnType<typeof ZAI.create>>> | null = null;

export async function getZai(): Promise<Awaited<ReturnType<typeof ZAI.create>>> {
  if (zaiInstance) return zaiInstance;
  if (!zaiInitPromise) {
    zaiInitPromise = ZAI.create().then((zai) => {
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

const MIN_INTERVAL_MS = 2000;  // Minimum 2s between page_reader calls
let lastCallTime = 0;
let cooldownUntil = 0;         // Global cooldown timestamp (set on 429)
const queue: Array<{ resolve: (v: string) => void; reject: (e: Error) => void; url: string }> = [];
let processing = false;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    // Wait for global cooldown if active
    const now = Date.now();
    if (cooldownUntil > now) {
      const waitMs = cooldownUntil - now;
      console.log(`[zai-shared] Global cooldown active, waiting ${Math.round(waitMs / 1000)}s...`);
      await sleep(waitMs);
    }

    const item = queue.shift()!;
    try {
      // Enforce minimum interval between calls
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

      // On 429, set global cooldown (at least 2min, increasing)
      if (msg.includes('429')) {
        const currentCooldown = Math.max(cooldownUntil - Date.now(), 0);
        const newCooldown = Math.max(currentCooldown + 60000, 120000); // At least 2min, +60s each time
        cooldownUntil = Date.now() + Math.min(newCooldown, 600000); // max 10min
        console.warn(`[zai-shared] 429 detected, cooldown: ${Math.round(Math.min(newCooldown, 600000) / 1000)}s`);
      }
    }
  }

  processing = false;
}

/**
 * Rate-limited page_reader call.
 * All calls are serialized with at least MIN_INTERVAL_MS between them.
 * Returns the HTML content of the page.
 */
export async function rateLimitedPageReader(url: string, timeoutMs = 60_000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      // Remove from queue on timeout
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

/**
 * Batch rate-limited page_reader calls (sequential, with delays).
 * Returns array of { url, html } for successful calls, null for failures.
 */
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
