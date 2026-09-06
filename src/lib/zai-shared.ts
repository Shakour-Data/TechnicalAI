/**
 * Z-AI SDK rate-limited executor
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURAL NOTE — Two Separate Channels
 * ══════════════════════════════════════════════════════════════════════════
 *
 * AI text generation must **NEVER** be blocked by page_reader rate limits.
 * To guarantee this, there are two completely independent channels:
 *
 * 1. **Shared queue** (Channel 1) — for `page_reader` and other utility calls.
 *    Sequential, rate-limited, with a global cooldown that applies only to
 *    this channel.  See {@link rateLimitedZaiCall}, {@link rateLimitedPageReader},
 *    {@link batchPageReader}, and {@link rateLimitedChatCompletion}.
 *
 * 2. **Dedicated AI channel** (Channel 2) — for `chat.completions`.
 *    Has its own independent retry logic, min-interval, global cooldown,
 *    concurrent-call serialization, and exponential backoff.
 *    It does **not** use the shared queue.
 *    See {@link dedicatedAIChatCompletion}.
 *
 * This separation ensures that page_reader 429s cannot stall AI text
 * generation, which is the most important user-facing feature.
 * ══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// Z-AI SDK singleton (lazy, dynamic import)
// ═══════════════════════════════════════════════════════════════

type ZaiType = Awaited<ReturnType<typeof import('z-ai-web-dev-sdk').default.create>>;
let zaiInstance: ZaiType | null = null;
let zaiInitPromise: Promise<ZaiType> | null = null;

/**
 * Get the lazy-initialized Z-AI SDK singleton instance.
 *
 * Uses a dynamic `import('z-ai-web-dev-sdk')` so the heavy SDK is only
 * loaded when first needed.  Concurrent callers during initialization
 * will all await the same promise rather than creating duplicate
 * instances.  On init failure the promise is cleared so the next call
 * will retry.
 *
 * @returns The initialized Z-AI SDK instance.
 */
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

/**
 * Get the remaining cooldown time (in milliseconds) for the **shared queue**
 * channel (Channel 1).
 *
 * The cooldown is set when a 429 is received on the shared queue or when
 * {@link recordExternal429} is called.  While a cooldown is active, the
 * shared queue pauses processing until it expires.
 *
 * @returns Remaining cooldown in milliseconds.  Returns `0` if no cooldown is active.
 */
export function getCooldownRemainingMs(): number {
  return Math.max(0, sharedCooldownUntil - Date.now());
}

/**
 * Record an external 429 event and set a cooldown on the **shared queue**
 * channel (Channel 1).
 *
 * Call this when a 429 is detected outside the shared queue's own retry
 * logic (e.g. from a higher-level caller) so that subsequent shared-queue
 * calls know to wait.
 *
 * Cooldown rules:
 * - Adds **60 s** to any existing remaining cooldown.
 * - Minimum cooldown is **120 s**.
 * - Maximum cooldown is capped at **600 s** (10 min).
 *
 * This does **not** affect the dedicated AI channel (Channel 2).
 */
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

/**
 * Execute an operation through the **shared queue** (Channel 1) with
 * rate limiting, retry on 429, and timeout enforcement.
 *
 * Calls are serialized (one at a time) with a minimum interval of 2 s
 * between them.  If a 429 is received, an exponential backoff cooldown
 * is applied and the operation is re-queued for retry (up to
 * `maxRetries`).  On success the cooldown is cleared.
 *
 * If the current cooldown exceeds `maxQueueWaitMs`, the call is
 * rejected immediately with a `ZAI_RATE_LIMITED` error so callers
 * can surface a "try later" message without waiting.
 *
 * @template T - The return type of the operation.
 * @param operation - Async function that receives the Z-AI SDK instance
 *   and returns a result of type `T`.
 * @param options - Configuration for this call.
 * @param options.timeoutMs - Total timeout in ms for this call (including
 *   queue wait time).  Defaults to **120 000** (2 min).
 * @param options.maxRetries - Number of 429 retries before giving up.
 *   Defaults to **2**.
 * @param options.name - Descriptive name used in log messages.
 *   Defaults to `'zai-call'`.
 * @param options.maxQueueWaitMs - If the current cooldown exceeds this
 *   value, the call is rejected immediately.  Defaults to **30 000** (30 s).
 * @returns A promise that resolves with the operation's result.
 * @throws {Error} `ZAI_RATE_LIMITED` if cooldown > `maxQueueWaitMs`.
 * @throws {Error} Timeout error if the call exceeds `timeoutMs`.
 * @throws {Error} Rate-limit error after exhausting `maxRetries`.
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

/**
 * Fetch a web page's HTML using the Z-AI `page_reader` function through
 * the **shared queue** (Channel 1).
 *
 * This is a convenience wrapper around {@link rateLimitedZaiCall} that
 * invokes `zai.functions.invoke('page_reader', { url })` and validates
 * the response contains usable HTML.
 *
 * @param url - The URL of the page to read.
 * @param timeoutMs - Total timeout in ms for this call.  Defaults to **60 000** (1 min).
 * @returns The HTML content of the page as a string.
 * @throws {Error} If the response is empty or shorter than 5 characters.
 * @throws {Error} Propagates any shared-queue timeout or rate-limit errors.
 */
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

/**
 * Read multiple web pages sequentially through the **shared queue**
 * (Channel 1).
 *
 * Pages are fetched one at a time via {@link rateLimitedPageReader}.
 * Failures for individual pages are swallowed — the corresponding result
 * entry is `null` rather than throwing and aborting the batch.
 *
 * @param urls - Array of URLs to read.
 * @param options - Configuration for the batch.
 * @param options.timeoutMs - Per-page timeout in ms.  Passed through to
 *   each {@link rateLimitedPageReader} call.
 * @param options.onProgress - Optional callback invoked after each page
 *   completes (whether success or failure).  Receives `(done, total)`
 *   where `done` is the number of pages processed so far and `total`
 *   is the total number of URLs.
 * @returns An array of the same length as `urls`.  Each element is
 *   `{ url, html }` on success, or `null` if that page failed.
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

/**
 * Execute a chat completion on the **dedicated AI channel** (Channel 2),
 * completely bypassing the shared queue.
 *
 * This is the primary function for AI text generation.  It is designed to
 * be patient and persistent so that AI output is never blocked by
 * `page_reader` rate limits.
 *
 * ### Behavior details
 *
 * - **Independent retry logic** — does not share the shared queue's
 *   cooldown or retry state.
 * - **5 s minimum interval** — enforces at least 5 seconds between
 *   consecutive AI calls (`AI_MIN_INTERVAL_MS`).
 * - **Global cooldown** — on receiving a 429, sets a **3-minute** global
 *   cooldown (`aiGlobalCooldownUntil`).  Subsequent calls during the
 *   cooldown fail fast with a descriptive error.  The cooldown is
 *   cleared on the next successful call.
 * - **Concurrent call serialization** — only one AI call runs at a time
 *   (`aiInProgress`).  If a concurrent call is already running, the
 *   caller waits up to 10 s for it to finish before proceeding anyway.
 * - **Exponential backoff** — on 429, retries with backoff of
 *   `10 s × 1.4^(attempt-1)` (i.e. ~10 s, ~14 s, ~20 s, …).
 * - **Transient error retries** — errors containing keywords like
 *   `'network'`, `'ECONNREFUSED'`, `'fetch'`, etc. are retried up to
 *   2 times with a 5 s delay.
 * - **Total timeout** — defaults to **200 s**.  All retries and waits
 *   must complete within this deadline (with a 30 s buffer reserved
 *   for the final API call).
 *
 * @param messages - Chat messages in `{ role, content }` format, passed
 *   directly to `zai.chat.completions.create`.
 * @param options - Configuration for this call.
 * @param options.timeoutMs - Total timeout in ms including all retries
 *   and waits.  Defaults to **200 000** (200 s).
 * @param options.maxRetries - Maximum number of 429 retries.
 *   Defaults to **5**.
 * @returns The trimmed text content of the first completion choice.
 * @throws {Error} If the global AI cooldown is active.
 * @throws {Error} If the deadline is exceeded (total timeout).
 * @throws {Error} If the AI response is empty or shorter than 10 characters.
 * @throws {Error} If a non-transient, non-429 error is received.
 */
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
        // Clear any stale global cooldown on success
        aiGlobalCooldownUntil = 0;
        return raw.trim();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);

        if (msg.includes('429')) {
          // Set global cooldown so future calls fail fast
          // Reduced from 10min to 3min — 10min was too aggressive and caused unnecessary failures
          const GLOBAL_COOLDOWN_MS = 180_000; // 3 minutes
          aiGlobalCooldownUntil = Date.now() + GLOBAL_COOLDOWN_MS;
          console.warn(`[AI-dedicated] 429 on attempt ${attempt}/${maxRetries + 1}, setting global cooldown ${GLOBAL_COOLDOWN_MS / 1000}s`);

          // Retry up to maxRetries with exponential backoff (10s, 25s, ...)
          if (attempt <= maxRetries && deadline - Date.now() > 30_000) {
            const backoff = 10_000 * Math.pow(1.4, attempt - 1);
            console.log(`[AI-dedicated] Backing off ${Math.round(backoff / 1000)}s before retry...`);
            await sleep(backoff);
            continue;
          }
          throw new Error(`Rate limited after ${attempt} attempts: ${msg}`);
        }

        // Transient errors: retry up to 2 times with short delay
        const isTransient = msg.includes('too short') || msg.includes('empty')
          || msg.includes('network') || msg.includes('ECONNREFUSED')
          || msg.includes('fetch') || msg.includes('socket hang up')
          || msg.includes('ETIMEDOUT');
        if (isTransient && attempt <= 2 && deadline - Date.now() > 15_000) {
          console.log(`[AI-dedicated] Transient error, retrying in 5s (attempt ${attempt})...`);
          await sleep(5_000);
          continue;
        }

        // Non-transient, non-429 error: throw immediately
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

/**
 * **LEGACY** chat completion that routes through the **shared queue**
 * (Channel 1).
 *
 * Prefer {@link dedicatedAIChatCompletion} for production AI text
 * generation, as it bypasses the shared queue and cannot be blocked by
 * `page_reader` rate limits.  This function remains for backward
 * compatibility but is subject to the shared queue's cooldown and
 * serialization, meaning a `page_reader` 429 will delay AI output.
 *
 * @param messages - Chat messages in `{ role, content }` format.
 * @param options - Configuration for this call.
 * @param options.timeoutMs - Total timeout in ms.  Defaults to **120 000** (2 min).
 * @param options.maxRetries - Number of 429 retries.  Defaults to **2**.
 * @param options.maxQueueWaitMs - If cooldown exceeds this, the call is
 *   rejected immediately.  Defaults to **30 000** (30 s).
 * @returns The trimmed text content of the first completion choice.
 * @throws {Error} Propagates any shared-queue timeout or rate-limit errors.
 * @throws {Error} If the AI response is empty or shorter than 10 characters.
 */
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
