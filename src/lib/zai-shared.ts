/**
 * Unified Z-AI SDK rate-limited executor
 *
 * ALL ZAI SDK calls (page_reader, chat.completions, etc.) MUST go through this module.
 * This prevents competing rate-limit retries across different API routes.
 *
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
// Unified rate-limited queue for ALL ZAI operations
// ═══════════════════════════════════════════════════════════════

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Shared state ---
const MIN_INTERVAL_MS = 3_000; // 3s between ANY two ZAI calls
let lastCallTime = 0;
let sharedCooldownUntil = 0;
let processing = false;

// --- Queue item type ---
interface QueueItem<T = unknown> {
  operation: (zai: ZaiType) => Promise<T>;
  name: string;
  resolve: (v: T) => void;
  reject: (e: Error) => void;
  retries: number;
  maxRetries: number;
  createdAt: number;
  timeoutAt: number;
}

const unifiedQueue: QueueItem[] = [];

// --- Get remaining cooldown ---
export function getCooldownRemainingMs(): number {
  return Math.max(0, sharedCooldownUntil - Date.now());
}

// --- Record a 429 from outside the queue (if someone bypasses the queue) ---
export function recordExternal429() {
  const currentCooldown = Math.max(sharedCooldownUntil - Date.now(), 0);
  const newCooldown = Math.max(currentCooldown + 60_000, 120_000);
  sharedCooldownUntil = Date.now() + Math.min(newCooldown, 600_000);
  console.warn(`[zai-shared] External 429 recorded, cooldown: ${Math.round(Math.min(newCooldown, 600_000) / 1000)}s`);
}

// --- Queue processor ---
async function processQueue() {
  if (processing) return;
  processing = true;

  while (unifiedQueue.length > 0) {
    // 1. Wait for cooldown if needed
    const now = Date.now();
    if (sharedCooldownUntil > now) {
      const waitMs = sharedCooldownUntil - now + 1_000;
      console.log(`[zai-shared] Cooldown, waiting ${Math.round(waitMs / 1000)}s (queue: ${unifiedQueue.length})...`);
      await sleep(waitMs);
    }

    // 2. Wait for minimum interval
    const elapsed = Date.now() - lastCallTime;
    if (elapsed < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - elapsed);
    }

    // 3. Pick next item (check if timed out)
    const item = unifiedQueue.shift()!;
    if (Date.now() > item.timeoutAt) {
      item.reject(new Error(`Timed out in queue: ${item.name}`));
      continue;
    }

    // 4. Execute
    try {
      const zai = await getZai();
      const result = await item.operation(zai);
      lastCallTime = Date.now();

      // Success: reduce cooldown slightly
      if (sharedCooldownUntil > Date.now() + 30_000) {
        sharedCooldownUntil = Date.now() + 30_000; // Don't fully reset, keep small buffer
      }

      item.resolve(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('429')) {
        item.retries++;
        const backoff = Math.min(60_000 * Math.pow(1.5, item.retries - 1), 300_000);
        sharedCooldownUntil = Date.now() + backoff;
        console.warn(`[zai-shared] 429 on [${item.name}], attempt ${item.retries}/${item.maxRetries}, cooldown ${Math.round(backoff / 1000)}s`);

        if (item.retries < item.maxRetries) {
          // Re-queue at front
          unifiedQueue.unshift(item);
          continue;
        }
        item.reject(new Error(`Rate limited after ${item.maxRetries} retries: ${item.name}`));
      } else {
        item.reject(new Error(msg));
      }
    }
  }

  processing = false;
}

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

/**
 * Execute any ZAI operation through the unified rate-limited queue.
 *
 * @param operation - Async function that receives the ZAI instance and returns a result
 * @param options
 *   - timeoutMs: Max total time (queue wait + execution). Default 120s.
 *   - maxRetries: How many 429 retries before giving up. Default 3.
 *   - name: Label for logging. Default 'zai-call'.
 *   - maxQueueWaitMs: If cooldown exceeds this, fail immediately. Default 90s.
 */
export async function rateLimitedZaiCall<T>(
  operation: (zai: ZaiType) => Promise<T>,
  options: {
    timeoutMs?: number;
    maxRetries?: number;
    name?: string;
    maxQueueWaitMs?: number;
  } = {}
): Promise<T> {
  const {
    timeoutMs = 120_000,
    maxRetries = 3,
    name = 'zai-call',
    maxQueueWaitMs = 90_000,
  } = options;

  // Quick check: if shared cooldown is very long, fail immediately
  const cooldownMs = getCooldownRemainingMs();
  if (cooldownMs > maxQueueWaitMs) {
    throw new Error(
      `ZAI_RATE_LIMITED: Cooldown ${Math.round(cooldownMs / 1000)}s. Try after ${Math.round(cooldownMs / 1000)}s.`
    );
  }

  return new Promise<T>((resolve, reject) => {
    const createdAt = Date.now();

    const timer = setTimeout(() => {
      const idx = unifiedQueue.indexOf(queueItem);
      if (idx >= 0) unifiedQueue.splice(idx, 1);
      reject(new Error(`Timeout after ${timeoutMs}ms: ${name}`));
    }, timeoutMs);

    const queueItem: QueueItem<T> = {
      operation,
      name,
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
      retries: 0,
      maxRetries,
      createdAt,
      timeoutAt: createdAt + timeoutMs,
    };

    unifiedQueue.push(queueItem);
    processQueue();
  });
}

// ═══════════════════════════════════════════════════════════════
// Convenience: rate-limited page_reader
// ═══════════════════════════════════════════════════════════════

export async function rateLimitedPageReader(url: string, timeoutMs = 60_000): Promise<string> {
  return rateLimitedZaiCall<string>(
    async (zai) => {
      const result = await zai.functions.invoke('page_reader', { url });
      const html: string = result.data?.html || '';
      if (!html || html.length < 5) {
        throw new Error('Empty response from page_reader');
      }
      return html;
    },
    { timeoutMs, maxRetries: 2, name: `page_reader(${url.slice(0, 60)})` }
  );
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

// ═══════════════════════════════════════════════════════════════
// Convenience: rate-limited chat completion
// ═══════════════════════════════════════════════════════════════

export async function rateLimitedChatCompletion(
  messages: { role: string; content: string }[],
  options: {
    timeoutMs?: number;
    maxRetries?: number;
    maxQueueWaitMs?: number;
  } = {}
): Promise<string> {
  const { timeoutMs = 120_000, maxRetries = 3, maxQueueWaitMs = 90_000 } = options;

  return rateLimitedZaiCall<string>(
    async (zai) => {
      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      });
      const raw = completion.choices[0]?.message?.content;
      if (!raw || raw.trim().length < 10) {
        throw new Error('AI response too short or empty');
      }
      return raw.trim();
    },
    { timeoutMs, maxRetries, name: 'chat.completions', maxQueueWaitMs }
  );
}
