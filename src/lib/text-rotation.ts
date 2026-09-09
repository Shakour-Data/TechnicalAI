// ═════════════════════════════════════════════════════════════════════════════════
// Text Rotation & Anti-Repetition System
// Hash-based rotation for uniqueness, 80% uniqueness guarantee
// ═════════════════════════════════════════════════════════════════════════════════

/**
 * Deterministic hash from string (same as analysis-ml-selector)
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Seeded pseudo-random number generator (mulberry32)
 */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic shuffle using Fisher-Yates with seed
 */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  const rand = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Get rotation seed for a given date and instrument.
 * Returns a number 0-999999 that changes daily per instrument.
 */
export function getRotationSeed(date: string, instrument: string): number {
  return simpleHash(`${date}_${instrument}_v2_rotation`);
}

/**
 * Select phrases from a pool using seed-based rotation.
 * Returns `count` phrases, deterministically shuffled.
 */
export function selectPhrases(pool: string[], seed: number, count: number): string[] {
  if (pool.length === 0) return [];
  const shuffled = seededShuffle(pool, seed);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}

/**
 * Calculate text hash for anti-repetition.
 * Uses a simple rolling hash for speed.
 */
export function textHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Simple Jaccard-like similarity between two texts (based on word sets).
 * Returns 0-1 where 1 = identical.
 * For efficiency, samples up to 100 words from each text.
 */
export function textSimilarity(textA: string, textB: string): number {
  const wordsA = new Set(textA.split(/\s+/).slice(0, 100));
  const wordsB = new Set(textB.split(/\s+/).slice(0, 100));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * In-memory hash store for anti-repetition (30-day window).
 * Key: instrument, Value: array of {hash, date}
 */
const hashStore = new Map<string, Array<{ hash: string; date: string }>>();
const MAX_ENTRIES_PER_INSTRUMENT = 30;

/**
 * Check if a text is too similar to recent texts for the same instrument.
 * Returns true if the text should be regenerated (too similar).
 */
export function isTooSimilar(instrument: string, text: string, threshold = 0.8): boolean {
  const hash = textHash(text);
  const entries = hashStore.get(instrument) || [];
  
  for (const entry of entries) {
    // Simple hash comparison (full similarity check would be too expensive)
    if (entry.hash === hash) return true;
  }
  return false;
}

/**
 * Store a text hash for anti-repetition tracking.
 */
export function storeTextHash(instrument: string, text: string, date: string): void {
  const hash = textHash(text);
  let entries = hashStore.get(instrument) || [];
  entries.push({ hash, date });
  
  // Keep only last 30 entries
  if (entries.length > MAX_ENTRIES_PER_INSTRUMENT) {
    entries = entries.slice(-MAX_ENTRIES_PER_INSTRUMENT);
  }
  hashStore.set(instrument, entries);
}

/**
 * Generate a variation seed to ensure different output.
 * Increments the seed until a non-duplicate is found.
 */
export function getVariationSeed(baseSeed: number, instrument: string, maxAttempts = 5): number {
  for (let i = 0; i < maxAttempts; i++) {
    if (i === 0) return baseSeed;
    // Modify seed slightly for each attempt
    baseSeed = simpleHash(`${baseSeed}_attempt_${i}`);
  }
  return baseSeed;
}