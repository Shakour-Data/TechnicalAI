// ═══════════════════════════════════════════════════════════════════════════════
// Pattern Accuracy Tracking & Confusion Matrix
// ═══════════════════════════════════════════════════════════════════════════════

import type { PatternResult } from './pattern-detection';
import { safeLocalStorage } from './safe-storage';

const STORAGE_KEY = 'patternDetectionHistory';

export interface PatternHistoryEntry {
  id: string;
  name: string;
  nameEn: string;
  category: PatternResult['category'];
  direction: PatternResult['direction'];
  status: PatternResult['status'];
  detectedAt: number;
  lastSeenAt: number;
  confirmedAt?: number;
  priceLevel?: number;
  strength: number;
}

export interface PatternAccuracyStats {
  nameEn: string;
  name: string;
  category: PatternResult['category'];
  direction: PatternResult['direction'];
  detected: number;
  confirmed: number;
  failed: number;
  accuracy: number;
  avgStrength: number;
  lastSeen: number;
}

export interface ConfusionMatrixEntry {
  patternNameEn: string;
  patternName: string;
  category: string;
  predictedDirection: 'bullish' | 'bearish' | 'neutral';
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
  total: number;
  accuracy: number;
}

export interface SymbolAccuracyReport {
  symbol: string;
  patterns: PatternAccuracyStats[];
  confusionMatrix: ConfusionMatrixEntry[];
  overallAccuracy: number;
  totalPatterns: number;
  lastUpdated: number;
}

export interface PatternDetectionHistory {
  [symbol: string]: {
    entries: PatternHistoryEntry[];
    lastUpdated: number;
  };
}

const MAX_HISTORY_PER_SYMBOL = 500;

function generatePatternId(pattern: PatternResult, date: string): string {
  return `${pattern.category}-${pattern.nameEn}-${pattern.direction}-${date}`;
}

export function recordPatternsForSymbol(
  symbol: string,
  patterns: PatternResult[],
  currentDate: string,
  currentPrice?: number,
): void {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  let history: PatternDetectionHistory = {};
  if (raw) {
    try {
      history = JSON.parse(raw);
    } catch {
      history = {};
    }
  }

  if (!history[symbol]) {
    history[symbol] = { entries: [], lastUpdated: Date.now() };
  }

  const symbolHistory = history[symbol].entries;
  const existingById: Record<string, PatternHistoryEntry> = {};
  for (const entry of symbolHistory) {
    existingById[entry.id] = entry;
  }

  for (const pattern of patterns) {
    const id = generatePatternId(pattern, currentDate);
    if (existingById[id]) {
      existingById[id].lastSeenAt = Date.now();
      existingById[id].status = pattern.status;
      if (pattern.status === 'completed' && !existingById[id].confirmedAt) {
        existingById[id].confirmedAt = Date.now();
      }
      if (pattern.strength > existingById[id].strength) {
        existingById[id].strength = pattern.strength;
      }
    } else {
      symbolHistory.push({
        id,
        name: pattern.name,
        nameEn: pattern.nameEn,
        category: pattern.category,
        direction: pattern.direction,
        status: pattern.status,
        detectedAt: Date.now(),
        lastSeenAt: Date.now(),
        priceLevel: pattern.priceLevel,
        strength: pattern.strength,
      });
    }
  }

  if (symbolHistory.length > MAX_HISTORY_PER_SYMBOL) {
    symbolHistory.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    history[symbol].entries = symbolHistory.slice(0, MAX_HISTORY_PER_SYMBOL);
  }

  history[symbol].lastUpdated = Date.now();
  safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function getAccuracyReport(symbol: string): SymbolAccuracyReport | null {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  let history: PatternDetectionHistory = {};
  try {
    history = JSON.parse(raw);
  } catch {
    return null;
  }

  const symbolData = history[symbol];
  if (!symbolData || symbolData.entries.length === 0) return null;

  const entries = symbolData.entries;

  const patternStats = new Map<string, {
    name: string;
    nameEn: string;
    category: PatternResult['category'];
    direction: PatternResult['direction'];
    detected: number;
    confirmed: number;
    failed: number;
    strengths: number[];
    lastSeen: number;
  }>();

  for (const entry of entries) {
    const key = entry.nameEn;
    if (!patternStats.has(key)) {
      patternStats.set(key, {
        name: entry.name,
        nameEn: entry.nameEn,
        category: entry.category,
        direction: entry.direction,
        detected: 0,
        confirmed: 0,
        failed: 0,
        strengths: [],
        lastSeen: entry.lastSeenAt,
      });
    }
    const stat = patternStats.get(key)!;
    stat.detected += 1;

    if (entry.status === 'completed') {
      stat.confirmed += 1;
    } else if (entry.status === 'failed') {
      stat.failed += 1;
    }

    stat.strengths.push(entry.strength);
    if (entry.lastSeenAt > stat.lastSeen) {
      stat.lastSeen = entry.lastSeenAt;
    }
  }

  const patterns: PatternAccuracyStats[] = [];
  for (const [, stat] of patternStats) {
    const confirmedOrFailed = stat.confirmed + stat.failed;
    const accuracy = confirmedOrFailed > 0 ? stat.confirmed / confirmedOrFailed : 0;
    const avgStrength = stat.strengths.length > 0
      ? stat.strengths.reduce((a, b) => a + b, 0) / stat.strengths.length
      : 0;

    patterns.push({
      nameEn: stat.nameEn,
      name: stat.name,
      category: stat.category,
      direction: stat.direction,
      detected: stat.detected,
      confirmed: stat.confirmed,
      failed: stat.failed,
      accuracy,
      avgStrength,
      lastSeen: stat.lastSeen,
    });
  }

  patterns.sort((a, b) => b.detected - a.detected);

  const confusionMatrix = buildConfusionMatrix(entries);

  const totalDetected = entries.length;
  const totalConfirmed = entries.filter(e => e.status === 'completed').length;
  const overallAccuracy = totalDetected > 0 ? totalConfirmed / totalDetected : 0;

  return {
    symbol,
    patterns,
    confusionMatrix,
    overallAccuracy,
    totalPatterns: totalDetected,
    lastUpdated: symbolData.lastUpdated,
  };
}

function buildConfusionMatrix(entries: PatternHistoryEntry[]): ConfusionMatrixEntry[] {
  const patternGroups = new Map<string, {
    name: string;
    nameEn: string;
    category: string;
    direction: 'bullish' | 'bearish' | 'neutral';
    tp: number;
    fp: number;
    fn: number;
    tn: number;
    total: number;
    lastDirection: 'bullish' | 'bearish' | 'neutral';
  }>();

  for (const entry of entries) {
    const key = entry.nameEn;
    if (!patternGroups.has(key)) {
      patternGroups.set(key, {
        name: entry.name,
        nameEn: entry.nameEn,
        category: entry.category,
        direction: entry.direction,
        tp: 0,
        fp: 0,
        fn: 0,
        tn: 0,
        total: 0,
        lastDirection: entry.direction,
      });
    }

    const group = patternGroups.get(key)!;
    group.total += 1;

    if (entry.direction === 'bullish') {
      if (entry.status === 'completed') {
        group.tp += 1;
        group.lastDirection = 'bullish';
      } else if (entry.status === 'failed') {
        group.fp += 1;
      } else {
        group.fn += 1;
      }
    } else if (entry.direction === 'bearish') {
      if (entry.status === 'completed') {
        group.tp += 1;
        group.lastDirection = 'bearish';
      } else if (entry.status === 'failed') {
        group.fp += 1;
      } else {
        group.fn += 1;
      }
    } else {
      group.tn += 1;
    }
  }

  const results: ConfusionMatrixEntry[] = [];
  for (const [, g] of patternGroups) {
    const tp = g.tp;
    const fp = g.fp;
    const fn = g.fn;
    const tn = g.tn;
    const total = g.total;
    const accuracy = total > 0 ? (tp + tn) / total : 0;

    results.push({
      patternNameEn: g.nameEn,
      patternName: g.name,
      category: g.category,
      predictedDirection: g.lastDirection,
      truePositive: tp,
      falsePositive: fp,
      falseNegative: fn,
      trueNegative: tn,
      total,
      accuracy,
    });
  }

  results.sort((a, b) => b.total - a.total);
  return results;
}

export function clearPatternHistory(symbol?: string): void {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  let history: PatternDetectionHistory = {};
  try {
    history = JSON.parse(raw);
  } catch {
    return;
  }

  if (symbol) {
    delete history[symbol];
  } else {
    history = {};
  }

  safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function getFormingPatterns(symbol: string): PatternResult[] {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  let history: PatternDetectionHistory = {};
  try {
    history = JSON.parse(raw);
  } catch {
    return [];
  }

  const symbolData = history[symbol];
  if (!symbolData) return [];

  const formingSet = new Set<string>();
  const formingPatterns: PatternResult[] = [];

  for (const entry of symbolData.entries) {
    if (entry.status === 'forming' && !formingSet.has(entry.nameEn)) {
      formingSet.add(entry.nameEn);
      formingPatterns.push({
        name: entry.name,
        nameEn: entry.nameEn,
        category: entry.category,
        direction: entry.direction,
        strength: entry.strength,
        status: 'forming',
        priceLevel: entry.priceLevel,
        description: `${entry.nameEn} — در حال شکل‌گیری`,
      });
    }
  }

  return formingPatterns;
}
