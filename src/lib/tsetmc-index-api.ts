// ═══════════════════════════════════════════════════════════════════
// TSETMC Index History API
//
// Fetches index OHLC data via Python micro-service (port 3031)
// which uses z-ai CLI page_reader to proxy TSETMC CDN requests.
//
// Sector names and web IDs match finpy-tse library exactly.
// ═══════════════════════════════════════════════════════════════════

const SERVICE_BASE = 'http://localhost:3031';

// ── Types ─────────────────────────────────────────────────────────
export interface IndexCandle {
  date: string;       // Shamsi: "1404/06/27"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── In-memory cache ──────────────────────────────────────────────
interface CacheEntry {
  data: IndexCandle[];
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ── File-based cache (like stock candles in tse-api.ts) ──────────
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const FILE_CACHE_DIR = join(process.cwd(), 'db');
const FILE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function indexFileCachePath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9؀-\u06FF_-]/g, '_');
  return join(FILE_CACHE_DIR, `index-${safe}.json`);
}

function loadIndexFileCache(key: string): IndexCandle[] | null {
  try {
    const path = indexFileCachePath(key);
    if (!existsSync(path)) return null;
    const content = readFileSync(path, 'utf-8');
    const entry = JSON.parse(content);
    if (Date.now() - entry.time > FILE_CACHE_TTL) return null;
    return entry.data as IndexCandle[];
  } catch {
    return null;
  }
}

function saveIndexFileCache(key: string, data: IndexCandle[]): void {
  try {
    if (!existsSync(FILE_CACHE_DIR)) {
      try { mkdirSync(FILE_CACHE_DIR, { recursive: true }); } catch { /* ignore */ }
    }
    writeFileSync(indexFileCachePath(key), JSON.stringify({ data, time: Date.now() }), 'utf-8');
  } catch {
    // File cache is best-effort
  }
}

// ── Service health check ────────────────────────────────────────
export async function isServiceHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVICE_BASE}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Generic fetch with 3-tier cache ─────────────────────────────
async function fetchWithCache(
  cacheKey: string,
  serviceUrl: string,
): Promise<IndexCandle[]> {
  const now = Date.now();

  // Tier 1: In-memory cache
  const memCached = cache.get(cacheKey);
  if (memCached && now - memCached.timestamp < CACHE_TTL) {
    return memCached.data;
  }

  // Tier 2: File cache
  const fileCached = loadIndexFileCache(cacheKey);
  if (fileCached) {
    cache.set(cacheKey, { data: fileCached, timestamp: now });
    return fileCached;
  }

  // Tier 3: Fetch from Python service (direct localhost, no XTransformPort needed)
  const res = await fetch(serviceUrl, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Service error ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const candles: IndexCandle[] = json.candles || [];

  if (candles.length === 0) {
    const err = json.error || 'Unknown error';
    throw new Error(err);
  }

  // Save to both caches
  cache.set(cacheKey, { data: candles, timestamp: now });
  saveIndexFileCache(cacheKey, candles);

  return candles;
}

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch historical candle data for a main market index.
 * Goes through Python service (port 3031) → z-ai CLI → TSETMC CDN.
 * @param indexKey - One of: CWI, EWI, CWPI, EWPI, FFI, MKT1I, MKT2I, INDI, ACT50, LCI30
 * @returns Array of candles sorted oldest first
 */
export async function fetchMainIndexHistory(indexKey: string): Promise<IndexCandle[]> {
  const key = indexKey.toUpperCase();
  const cacheKey = `idx_${key}`;
  return fetchWithCache(cacheKey, `${SERVICE_BASE}/api/index-history?key=${key}`);
}

/**
 * Fetch historical candle data for a sector/industry index by webId.
 * Goes through Python service (port 3031) → z-ai CLI → TSETMC CDN.
 * @param webIdStr - The TSETMC web ID (as string to avoid precision loss)
 * @returns Array of candles sorted oldest first
 */
export async function fetchSectorIndexHistory(webIdStr: string): Promise<IndexCandle[]> {
  if (!webIdStr) {
    throw new Error('شناسه وب (webId) الزامی است');
  }
  const cacheKey = `sec_${webIdStr}`;
  return fetchWithCache(cacheKey, `${SERVICE_BASE}/api/sector-history?webId=${encodeURIComponent(webIdStr)}`);
}

/**
 * Fetch sector index data by sector name (finpy-tse name).
 * @param sectorName - finpy-tse sector name (e.g., 'دارویی', 'بانک')
 * @returns Array of candles sorted oldest first
 */
export async function fetchSectorByName(sectorName: string): Promise<IndexCandle[]> {
  if (!sectorName) {
    throw new Error('نام گروه الزامی است');
  }
  const cacheKey = `sec_${sectorName}`;
  return fetchWithCache(cacheKey, `${SERVICE_BASE}/api/sector-history?sector=${encodeURIComponent(sectorName)}`);
}

/**
 * No-op warmup (kept for API compatibility — service handles its own init)
 */
export function warmup(): void {
  console.log('[tsetmc-index] Using Python service on port 3031 (no SDK warmup needed)');
}

/**
 * Clear memory cache (file cache persists)
 */
export function clearIndexCache(): void {
  cache.clear();
}
