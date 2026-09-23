/**
 * Generic AI SDK — Replaces Ollama/Z.ai with OpenAI-compatible API
 * 
 * Works with any OpenAI-compatible API endpoint using an API key
 * stored in the app's settings.
 */

import { AiClient } from '@/lib/ai-client';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const MIN_INTERVAL_MS = 1_000;
let lastSharedCallTime = 0;
let sharedCooldownUntil = 0;
let sharedProcessing = false;

interface QueueItem<T = unknown> {
  operation: (client: AiClient) => Promise<T>;
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
  const newCooldown = Math.max(currentCooldown + 30_000, 60_000);
  sharedCooldownUntil = Date.now() + Math.min(newCooldown, 300_000);
  console.warn(`[ai-shared] External failure recorded, cooldown: ${Math.round(Math.min(newCooldown, 300_000) / 1000)}s`);
}

async function processQueue() {
  if (sharedProcessing) return;
  sharedProcessing = true;

  while (unifiedQueue.length > 0) {
    const now = Date.now();
    if (sharedCooldownUntil > now) {
      const waitMs = sharedCooldownUntil - now + 1_000;
      console.log(`[ai-shared] Cooldown, waiting ${Math.round(waitMs / 1000)}s (queue: ${unifiedQueue.length})...`);
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
      const client = AiClient.getStoredInstance();
      if (!client) {
        item.reject(new Error('API client not configured. Please set your API key in Settings.'));
        continue;
      }
      const result = await item.operation(client);
      lastSharedCallTime = Date.now();
      sharedCooldownUntil = 0;
      item.resolve(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      item.retries++;
      const backoff = Math.min(5_000 * Math.pow(1.5, item.retries - 1), 30_000);
      sharedCooldownUntil = Date.now() + backoff;
      console.warn(`[ai-shared] Error on [${item.name}], attempt ${item.retries}/${item.maxRetries}, cooldown ${Math.round(backoff / 1000)}s`);
      if (item.retries < item.maxRetries) {
        unifiedQueue.unshift(item);
        continue;
      }
      item.reject(new Error(`Failed after ${item.maxRetries} retries: ${item.name}`));
    }
  }

  sharedProcessing = false;
}

export async function rateLimitedAICall<T>(
  operation: (client: AiClient) => Promise<T>,
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
    name = 'ai-call',
    maxQueueWaitMs = 30_000,
  } = options;

  const cooldownMs = getCooldownRemainingMs();
  if (cooldownMs > maxQueueWaitMs) {
    throw new Error(
      `AI busy: Cooldown ${Math.round(cooldownMs / 1000)}s. Try after ${Math.round(cooldownMs / 1000)}s.`
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

export async function rateLimitedPageReader(url: string, timeoutMs = 60_000): Promise<string> {
  return rateLimitedAICall<string>(
    async (client) => {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml',
        },
      });
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
      const html = await response.text();
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
// Dedicated AI Channel (bypasses shared queue for chat completions)
// ═══════════════════════════════════════════════════════════════

let aiLastCallTime = 0;
const AI_MIN_INTERVAL_MS = 3_000;
let aiInProgress = false;
let aiGlobalCooldownUntil = 0;

export async function dedicatedAIChatCompletion(
  messages: { role: string; content: string }[],
  options: {
    timeoutMs?: number;
    maxRetries?: number;
  } = {}
): Promise<string> {
  const { timeoutMs = 120_000, maxRetries = 3 } = options;
  const startTime = Date.now();
  const deadline = startTime + timeoutMs;

  const globalCdRemaining = aiGlobalCooldownUntil - Date.now();
  if (globalCdRemaining > 0) {
    console.log(`[AI-dedicated] Global AI cooldown active, ${Math.round(globalCdRemaining / 1000)}s remaining`);
    throw new Error(`AI temporarily unavailable: global cooldown ${Math.round(globalCdRemaining / 1000)}s remaining`);
  }

  const CONCURRENT_WAIT_MS = 10_000;
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
    const client = AiClient.getStoredInstance();
    if (!client) {
      throw new Error('API client not configured. Please set your API key in Settings.');
    }

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      if (Date.now() > deadline) {
        throw new Error(`Timeout after ${timeoutMs / 1000}s: AI generation`);
      }

      const sharedCd = getCooldownRemainingMs();
      const aiInterval = Math.max(0, AI_MIN_INTERVAL_MS - (Date.now() - aiLastCallTime));
      const waitMs = Math.max(sharedCd, aiInterval);
      if (waitMs > 0) {
        console.log(`[AI-dedicated] Waiting ${Math.round(waitMs / 1000)}s (shared_cd=${Math.round(sharedCd / 1000)}s, ai_interval=${Math.round(aiInterval / 1000)}s)...`);
        const remaining = deadline - Date.now() - 20_000;
        if (waitMs > remaining) {
          throw new Error(`AI temporarily unavailable: need ${Math.round(waitMs / 1000)}s but only ${Math.round(remaining / 1000)}s remaining`);
        }
        await sleep(waitMs);
      }

      try {
        console.log(`[AI-dedicated] Attempt ${attempt}/${maxRetries + 1}...`);
        const completion = await client.chatCompletion(messages, {
          temperature: 0.7,
          max_tokens: 4096,
        });
        aiLastCallTime = Date.now();
        const raw = completion;
        if (!raw || raw.trim().length < 10) {
          throw new Error('AI response too short or empty');
        }
        console.log(`[AI-dedicated] Success in ${((Date.now() - startTime) / 1000).toFixed(1)}s (attempt ${attempt})`);
        aiGlobalCooldownUntil = 0;
        return raw.trim();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);

        const isTransient = msg.includes('network') || msg.includes('ECONNREFUSED')
          || msg.includes('fetch') || msg.includes('socket hang up')
          || msg.includes('ETIMEDOUT') || msg.includes('API error');
        if (isTransient && attempt <= 2 && deadline - Date.now() > 15_000) {
          console.log(`[AI-dedicated] Transient error, retrying in 5s (attempt ${attempt})...`);
          await sleep(5_000);
          continue;
        }

        const GLOBAL_COOLDOWN_MS = 120_000;
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

export async function rateLimitedChatCompletion(
  messages: { role: string; content: string }[],
  options: {
    timeoutMs?: number;
    maxRetries?: number;
    maxQueueWaitMs?: number;
  } = {}
): Promise<string> {
  const { timeoutMs = 120_000, maxRetries = 2, maxQueueWaitMs = 30_000 } = options;
  return rateLimitedAICall<string>(
    async (client) => {
      const completion = await client.chatCompletion(messages, {
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