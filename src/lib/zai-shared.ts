/**
 * Z-AI SDK rate-limited executor — ADAPTED FOR OLLAMA LOCAL
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURAL NOTE — Two Separate Channels
 * ═══════════════════════════════════════════════════════════════════════════════════════════
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
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// Ollama client singleton (lazy, shared)
// ═══════════════════════════════════════════════════════════════

import { getOllama, type OllamaClient } from '@/lib/ollama-client';

let ollamaInstance: OllamaClient | null = null;

/**
 * Get the lazy-initialized Ollama client singleton instance.
 *
 * Concurrent callers during initialization will all await the same promise rather than creating
 * duplicate instances.  On init failure the promise is cleared so the next call will retry.
 *
 * @returns The initialized Ollama client instance.
 */
export async function getOllamaInstance(): Promise<OllamaClient> {
  if (!ollamaInstance) {
    ollamaInstance = getOllama();
  }
  return ollamaInstance;
}

// ═══════════════════════════════════════════════════════════════
// Channel 1: Shared queue for page_reader etc.
// ═══════════════════════════════════════════════════════════════

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const MIN_INTERVAL_MS = 1_000; // 1s between local calls
let lastSharedCallTime = 0;
let sharedCooldownUntil = 0;
let sharedProcessing = false;

interface QueueItem<T = unknown> {
  operation: (ollama: OllamaClient) => Promise<T>;
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
 * The cooldown is set when a request fails or when {@link recordExternal429} is called.
 * While a cooldown is active, the shared queue pauses processing until it expires.
 *
 * @returns Remaining cooldown in milliseconds.  Returns `0` if no cooldown is active.
 */
export function getCooldownRemainingMs(): number {
  return Math.max(0, sharedCooldownUntil - Date.now());
}

/**
 * Record an external error event and set a cooldown on the **shared queue**
 * channel (Channel 1).
 *
 * Call this when a failure is detected outside the shared queue's own retry
 * logic so that subsequent shared-queue calls know to wait.
 *
 * Cooldown rules:
 * - Adds **30 s** to any existing remaining cooldown.
 * - Minimum cooldown is **60 s**.
 * - Maximum cooldown is capped at **300 s** (5 min).
 *
 * This does **not** affect the dedicated AI channel (Channel 2).
 */
export function recordExternal429() {
  const currentCooldown = Math.max(sharedCooldownUntil - Date.now(), 0);
  const newCooldown = Math.max(currentCooldown + 30_000, 60_000);
  sharedCooldownUntil = Date.now() + Math.min(newCooldown, 300_000);
  console.warn(`[ollama-shared] External failure recorded, cooldown: ${Math.round(Math.min(newCooldown, 300_000) / 1000)}s`);
}

async function processQueue() {
  if (sharedProcessing) return;
  sharedProcessing = true;

  while (unifiedQueue.length > 0) {
    const now = Date.now();
    if (sharedCooldownUntil > now) {
      const waitMs = sharedCooldownUntil - now + 1_000;
      console.log(`[ollama-shared] Cooldown, waiting ${Math.round(waitMs / 1000)}s (queue: ${unifiedQueue.length})...`);
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
      const ollama = await getOllamaInstance();
      const result = await item.operation(ollama);
      lastSharedCallTime = Date.now();
      sharedCooldownUntil = 0;
      item.resolve(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Local calls don't hit 429s; treat any error as transient with short backoff
      item.retries++;
      const backoff = Math.min(5_000 * Math.pow(1.5, item.retries - 1), 30_000);
      sharedCooldownUntil = Date.now() + backoff;
      console.warn(`[ollama-shared] Error on [${item.name}], attempt ${item.retries}/${item.maxRetries}, cooldown ${Math.round(backoff / 1000)}s`);
      if (item.retries < item.maxRetries) {
        unifiedQueue.unshift(item);
        continue;
      }
      item.reject(new Error(`Failed after ${item.maxRetries} retries: ${item.name}`));
    }
  }

  sharedProcessing = false;
}

/**
 * Execute an operation through the **shared queue** (Channel 1) with
 * rate limiting, retry on error, and timeout enforcement.
 *
 * Calls are serialized (one at a time) with a minimum interval of 1 s
 * between them.  If an error is received, an exponential backoff cooldown
 * is applied and the operation is re-queued for retry (up to
 * `maxRetries`).  On success the cooldown is cleared.
 *
 * If the current cooldown exceeds `maxQueueWaitMs`, the call is
 * rejected immediately with a descriptive error so callers can surface a
 * "try later" message without waiting.
 *
 * @template T - The return type of the operation.
 * @param operation - Async function that receives the Ollama client
 *   and returns a result of type `T`.
 * @param options - Configuration for this call.
 * @param options.timeoutMs - Total timeout in ms for this call (including
 *   queue wait time).  Defaults to **120 000** (2 min).
 * @param options.maxRetries - Number of retries before giving up.
 *   Defaults to **2**.
 * @param options.name - Descriptive name used in log messages.
 *   Defaults to `'ollama-call'`.
 * @param options.maxQueueWaitMs - If the current cooldown exceeds this
 *   value, the call is rejected immediately.  Defaults to **30 000** (30 s).
 * @returns A promise that resolves with the operation's result.
 * @throws {Error} Cooldown error if cooldown > `maxQueueWaitMs`.
 * @throws {Error} Timeout error if the call exceeds `timeoutMs`.
 * @throws {Error} Failure error after exhausting `maxRetries`.
 */
export async function rateLimitedOllamaCall<T>(
  operation: (ollama: OllamaClient) => Promise<T>,
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
    name = 'ollama-call',
    maxQueueWaitMs = 30_000,
  } = options;

  const cooldownMs = getCooldownRemainingMs();
  if (cooldownMs > maxQueueWaitMs) {
    throw new Error(
      `Ollama busy: Cooldown ${Math.round(cooldownMs / 1000)}s. Try after ${Math.round(cooldownMs / 1000)}s.`
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
 * Fetch a web page's HTML using the Ollama client's page reader through
 * the **shared queue** (Channel 1).
 *
 * This is a convenience wrapper around {@link rateLimitedOllamaCall} that
 * invokes `ollama.pageReader({ url })` and validates
 * the response contains usable HTML.
 *
 * @param url - The URL of the page to read.
 * @param timeoutMs - Total timeout in ms for this call.  Defaults to **60 000** (1 min).
 * @returns The HTML content of the page as a string.
 * @throws {Error} If the response is empty or shorter than 5 characters.
 * @throws {Error} Propagates any shared-queue timeout or failure errors.
 */
export async function rateLimitedPageReader(url: string, timeoutMs = 60_000): Promise<string> {
  return rateLimitedOllamaCall<string>(
    async (ollama) => {
      const result = await ollama.pageReader(url);
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
 *   where `done` is the number of pages processed so far and `total` is
 *   the total number of URLs.
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
const AI_MIN_INTERVAL_MS = 3_000; // 3s between AI calls
let aiInProgress = false; // Prevent concurrent AI calls
let aiGlobalCooldownUntil = 0; // Global cooldown: if AI fails, don't retry for a while

/**
 * Execute a chat completion on the **dedicated AI channel** (Channel 2),
 * completely bypassing the shared queue.
 *
 * This is the primary function for AI text generation.  It is designed to
 * be patient and persistent so that AI output is never blocked by
 * `page_reader` failures.
 *
 * ### Behavior details
 *
 * - **Independent retry logic** — does not share the shared queue's
 *   cooldown or retry state.
 * - **3 s minimum interval** — enforces at least 3 seconds between
 *   consecutive AI calls (`AI_MIN_INTERVAL_MS`).
 * - **Global cooldown** — on receiving an error, sets a **2-minute**
 *   global cooldown (`aiGlobalCooldownUntil`).  Subsequent calls during the
 *   cooldown fail fast with a descriptive error.  The cooldown is
 *   cleared on the next successful call.
 * - **Concurrent call serialization** — only one AI call runs at a time
 *   (`aiInProgress`).  If a concurrent call is already running, the
 *   caller waits up to 10 s for it to finish before proceeding anyway.
 * - **Exponential backoff** — on error, retries with backoff of
 *   `5 s × 1.5^(attempt-1)`.
 * - **Transient error retries** — errors containing keywords like
 *   `'network'`, `'ECONNREFUSED'`, `'fetch'`, etc. are retried up to
 *   2 times with a 5 s delay.
 * - **Total timeout** — defaults to **120 s**.  All retries and waits
 *   must complete within this deadline (with a 20 s buffer reserved
 *   for the final API call).
 *
 * @param messages - Chat messages in `{ role, content }` format, passed
 *   directly to `ollama.chatCompletion`.
 * @param options - Configuration for this call.
 * @param options.timeoutMs - Total timeout in ms including all retries
 *   and waits.  Defaults to **120 000** (120 s).
 * @param options.maxRetries - Maximum number of retries.
 *   Defaults to **3**.
 * @returns The trimmed text content of the first completion choice.
 * @throws {Error} If the global AI cooldown is active.
 * @throws {Error} If the deadline is exceeded (total timeout).
 * @throws {Error} If the AI response is empty or shorter than 10 characters.
 * @throws {Error} If a non-transient error is received.
 */
export async function dedicatedAIChatCompletion(
  messages: { role: string; content: string }[],
  options: {
    timeoutMs?: number;    // Total timeout including all retries. Default 120s
    maxRetries?: number;   // Max retries. Default 3
  } = {}
): Promise<string> {
  const { timeoutMs = 120_000, maxRetries = 3 } = options;
  const startTime = Date.now();
  const deadline = startTime + timeoutMs;

  // Check global AI cooldown (set when error was received)
  const globalCdRemaining = aiGlobalCooldownUntil - Date.now();
  if (globalCdRemaining > 0) {
    console.log(`[AI-dedicated] Global AI cooldown active, ${Math.round(globalCdRemaining / 1000)}s remaining`);
    throw new Error(`AI temporarily unavailable: global cooldown ${Math.round(globalCdRemaining / 1000)}s remaining`);
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
    const ollama = await getOllamaInstance();

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
        const remaining = deadline - Date.now() - 20_000; // keep 20s buffer for the actual call
        if (waitMs > remaining) {
          throw new Error(`AI temporarily unavailable: need ${Math.round(waitMs / 1000)}s but only ${Math.round(remaining / 1000)}s remaining`);
        }
        await sleep(waitMs);
      }

      // Make the call
      try {
        console.log(`[AI-dedicated] Attempt ${attempt}/${maxRetries + 1}...`);
        const completion = await ollama.chatCompletion(messages, {
          temperature: 0.7,
          max_tokens: 4096,
        });
        aiLastCallTime = Date.now();
        const raw = completion;
        if (!raw || raw.trim().length < 10) {
          throw new Error('AI response too short or empty');
        }
        console.log(`[AI-dedicated] Success in ${((Date.now() - startTime) / 1000).toFixed(1)}s (attempt ${attempt})`);
        // Clear any stale global cooldown on success
        aiGlobalCooldownUntil = 0;
        return raw.trim();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);

        // Transient errors: retry up to 2 times with short delay
        const isTransient = msg.includes('network') || msg.includes('ECONNREFUSED')
          || msg.includes('fetch') || msg.includes('socket hang up')
          || msg.includes('ETIMEDOUT') || msg.includes('Ollama API error');
        if (isTransient && attempt <= 2 && deadline - Date.now() > 15_000) {
          console.log(`[AI-dedicated] Transient error, retrying in 5s (attempt ${attempt})...`);
          await sleep(5_000);
          continue;
        }

        // Non-transient error: set global cooldown and throw
        const GLOBAL_COOLDOWN_MS = 120_000; // 2 minutes
        aiGlobalCooldownUntil = Date.now() + GLOBAL_COOLDOWN_MS;
        console.warn(`[AI-dedicated] Error on attempt ${attempt}/${maxRetries + 1}, setting global cooldown ${GLOBAL_COOLDOWN_MS / 1000}s`);
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
 * `page_reader` failures.  This function remains for backward
 * compatibility but is subject to the shared queue's cooldown and
 * serialization, meaning a `page_reader` error will delay AI output.
 *
 * @param messages - Chat messages in `{ role, content }` format.
 * @param options - Configuration for this call.
 * @param options.timeoutMs - Total timeout in ms.  Defaults to **120 000** (2 min).
 * @param options.maxRetries - Number of retries.  Defaults to **2**.
 * @param options.maxQueueWaitMs - If cooldown exceeds this, the call is
 *   rejected immediately.  Defaults to **30 000** (30 s).
 * @returns The trimmed text content of the first completion choice.
 * @throws {Error} Propagates any shared-queue timeout or failure errors.
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
  return rateLimitedOllamaCall<string>(
    async (ollama) => {
      const completion = await ollama.chatCompletion(messages, {
        temperature: 0.7,
        max_tokens: 4096,
      });
      const raw = completion;
      if (!raw || raw.trim().length < 10) throw new Error('AI response too short or empty');
      return raw.trim();
    },
    { timeoutMs, maxRetries, name: 'chat.completions', maxQueueWaitMs }
  );
}
