/**
 * Z-AI SDK rate-limited executor
 *
 * Two separate channels:
 * 1. Shared queue (page_reader, etc.) — rate-limited, sequential
 * 2. Dedicated AI channel (chat.completions) — independent, patient, persistent
 *
 * This prevents page_reader 429s from blocking AI text generation.
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
// Channel 1: Shared queue for page_reader etc.
// ═══════════════════════════════════════════════════════════════

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const MIN_INTERVAL_MS = 2_000;
let lastSharedCallTime = 0;
let sharedCooldownUntil = 0;
let sharedProcessing = false;

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

export function getCooldownRemainingMs(): number {
  return Math.max(0, sharedCooldownUntil - Date.now());
}

export function recordExternal429() {
  const currentCooldown = Math.max(sharedCooldownUntil - Date.now(), 0);
  const newCooldown = Math.max(currentCooldown + 60_000, 120_000);
  sharedCooldownUntil = Date.now() + Math.min(newCooldown, 600_000);
  console.warn(`[zai-shared] External 429 recorded, cooldown: ${Math.round(Math.min(newCooldown, 600_000) / 1000)}s`);
}

async function processQueue() {
  if (sharedProcessing) return;
  sharedProcessing = true;

  while (unifiedQueue.length > 0) {
    const now = Date.now();
    if (sharedCooldownUntil > now) {
      const waitMs = sharedCooldownUntil - now + 1_000;
      console.log(`[zai-shared] Cooldown, waiting ${Math.round(waitMs / 1000)}s (queue: ${unifiedQueue.length})...`);
      await sleep(waitMs);
    }

    const elapsed = Date.now() - lastSharedCallTime;
    if (elapsed < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - elapsed);
    }

    const item = unifiedQueue.shift();
    if (!item) break;
    if (Date.now() > item.timeoutAt) {
      item.reject(new Error(`Timed out in queue: ${item.name}`));
      continue;
    }

    try {
      const zai = await getZai();
      const result = await item.operation(zai);
      lastSharedCallTime = Date.now();
      sharedCooldownUntil = 0;
      item.resolve(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429')) {
        item.retries++;
        const backoff = Math.min(45_000 * Math.pow(1.5, item.retries - 1), 180_000);
        sharedCooldownUntil = Date.now() + backoff;
        console.warn(`[zai-shared] 429 on [${item.name}], attempt ${item.retries}/${item.maxRetries}, cooldown ${Math.round(backoff / 1000)}s`);
        if (item.retries < item.maxRetries) {
          unifiedQueue.unshift(item);
          continue;
        }
        item.reject(new Error(`Rate limited after ${item.maxRetries} retries: ${item.name}`));
      } else {
        item.reject(new Error(msg));
      }
    }
  }

  sharedProcessing = false;
}

// --- Public: shared queue call ---
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
    maxRetries = 2,
    name = 'zai-call',
    maxQueueWaitMs = 30_000,
  } = options;

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
      operation, name,
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
      retries: 0, maxRetries, createdAt,
      timeoutAt: createdAt + timeoutMs,
    };

    unifiedQueue.push(queueItem);
    processQueue();
  });
}

// --- Convenience: page_reader ---
export async function rateLimitedPageReader(url: string, timeoutMs = 60_000): Promise<string> {
  return rateLimitedZaiCall<string>(
    async (zai) => {
      const result = await zai.functions.invoke('page_reader', { url });
      const html: string = result.data?.html || '';
      if (!html || html.length < 5) throw new Error('Empty response from page_reader');
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
// Channel 2: DEDICATED AI chat completion (bypasses shared queue)
// ═══════════════════════════════════════════════════════════════
//
// AI text generation is the most important user-facing feature.
// It must NEVER be blocked by page_reader rate limits.
// This function has its own retry logic and does NOT use the shared queue.
//
let aiLastCallTime = 0;
const AI_MIN_INTERVAL_MS = 5_000; // 5s between AI calls
let aiInProgress = false; // Prevent concurrent AI calls
let aiGlobalCooldownUntil = 0; // Global cooldown: if AI is rate-limited, don't retry for a while

export async function dedicatedAIChatCompletion(
  messages: { role: string; content: string }[],
  options: {
    timeoutMs?: number;    // Total timeout including all retries. Default 200s
    maxRetries?: number;   // 429 retries. Default 5
  } = {}
): Promise<string> {
  const { timeoutMs = 200_000, maxRetries = 5 } = options;
  const startTime = Date.now();
  const deadline = startTime + timeoutMs;

  // Check global AI cooldown (set when 429 was received)
  const globalCdRemaining = aiGlobalCooldownUntil - Date.now();
  if (globalCdRemaining > 0) {
    console.log(`[AI-dedicated] Global AI cooldown active, ${Math.round(globalCdRemaining / 1000)}s remaining`);
    throw new Error(`Rate limited: global AI cooldown ${Math.round(globalCdRemaining / 1000)}s remaining`);
  }

  // Prevent concurrent AI calls (serialize) — but don't block for too long
  const CONCURRENT_WAIT_MS = 10_000; // Only wait 10s for a concurrent call
  const concurrentStart = Date.now();
  while (aiInProgress) {
    if (Date.now() - concurrentStart > CONCURRENT_WAIT_MS) {
      console.log('[AI-dedicated] Concurrent call still running, proceeding anyway');
      break;
    }
    if (Date.now() > deadline) throw new Error('Timeout waiting for concurrent AI call');
    await sleep(1_000);
  }
  aiInProgress = true;

  try {
    const zai = await getZai();

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      // Check deadline
      if (Date.now() > deadline) {
        throw new Error(`Timeout after ${timeoutMs / 1000}s: AI generation`);
      }

      // Wait: (1) existing shared cooldown, (2) AI min interval
      const sharedCd = getCooldownRemainingMs();
      const aiInterval = Math.max(0, AI_MIN_INTERVAL_MS - (Date.now() - aiLastCallTime));
      const waitMs = Math.max(sharedCd, aiInterval);
      if (waitMs > 0) {
        console.log(`[AI-dedicated] Waiting ${Math.round(waitMs / 1000)}s (shared_cd=${Math.round(sharedCd / 1000)}s, ai_interval=${Math.round(aiInterval / 1000)}s)...`);
        // Don't wait longer than what we have left
        const remaining = deadline - Date.now() - 30_000; // keep 30s buffer for the actual call
        if (waitMs > remaining) {
          throw new Error(`Rate limited: need ${Math.round(waitMs / 1000)}s but only ${Math.round(remaining / 1000)}s remaining`);
        }
        await sleep(waitMs);
      }

      // Make the call
      try {
        console.log(`[AI-dedicated] Attempt ${attempt}/${maxRetries + 1}...`);
        const completion = await zai.chat.completions.create({
          messages,
          thinking: { type: 'disabled' },
        });
        aiLastCallTime = Date.now();
        const raw = completion.choices[0]?.message?.content;
        if (!raw || raw.trim().length < 10) {
          throw new Error('AI response too short or empty');
        }
        console.log(`[AI-dedicated] Success in ${((Date.now() - startTime) / 1000).toFixed(1)}s (attempt ${attempt})`);
        return raw.trim();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);

        if (msg.includes('429')) {
          // Set global cooldown so future calls fail fast
          const GLOBAL_COOLDOWN_MS = 600_000; // 10 minutes
          aiGlobalCooldownUntil = Date.now() + GLOBAL_COOLDOWN_MS;
          console.warn(`[AI-dedicated] 429 on attempt ${attempt}/${maxRetries + 1}, setting global cooldown ${GLOBAL_COOLDOWN_MS / 1000}s`);

          // Only retry once with a short delay (10s), then give up
          if (attempt === 1 && deadline - Date.now() > 40_000) {
            await sleep(10_000);
            continue;
          }
          throw new Error(`Rate limited after ${attempt} attempts: ${msg}`);
        }

        // Non-429 error: throw immediately
        throw new Error(msg);
      }
    }

    throw new Error('AI generation failed after all retries');
  } finally {
    aiInProgress = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// Legacy: rate-limited chat completion (uses shared queue)
// ═══════════════════════════════════════════════════════════════

export async function rateLimitedChatCompletion(
  messages: { role: string; content: string }[],
  options: {
    timeoutMs?: number;
    maxRetries?: number;
    maxQueueWaitMs?: number;
  } = {}
): Promise<string> {
  const { timeoutMs = 120_000, maxRetries = 2, maxQueueWaitMs = 30_000 } = options;
  return rateLimitedZaiCall<string>(
    async (zai) => {
      const completion = await zai.chat.completions.create({ messages, thinking: { type: 'disabled' } });
      const raw = completion.choices[0]?.message?.content;
      if (!raw || raw.trim().length < 10) throw new Error('AI response too short or empty');
      return raw.trim();
    },
    { timeoutMs, maxRetries, name: 'chat.completions', maxQueueWaitMs }
  );
}
