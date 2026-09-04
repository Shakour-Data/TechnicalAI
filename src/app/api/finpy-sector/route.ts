import { NextRequest, NextResponse } from 'next/server';
import { fetchMainIndexHistory, fetchSectorIndexHistory, fetchSectorByName } from '@/lib/tsetmc-index-api';
import { INDUSTRY_INDICES, type IndustryIndex } from '@/lib/industry-indices';
import type { OHLCV } from '@/lib/ta-engine';
import type { DailyProbabilitySnapshot } from '@/lib/probability-trend';
import { analyze, computeHistoricalProbabilities } from '@/lib/ta-engine';
import { buildTrendFromDailySnapshots } from '@/lib/probability-trend';
import { detectDecimals, getCurrencyUnit } from '@/lib/format-price';

export const dynamic = 'force-dynamic';

// ── Find sector by name (Persian name or finpySector key) ────────
function findSectorByName(name: string): IndustryIndex | undefined {
  const n = name.trim();
  return INDUSTRY_INDICES.find(
    (s) =>
      s.finpySector === n ||
      s.symbol === n ||
      s.name.includes(n) ||
      s.group.includes(n),
  );
}

// ── Helper: Build full response with TA analysis ────────────────
function buildResponse(
  candles: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>,
  label: string,
) {
  // For TA analysis, use only the last 500 candles to limit memory usage
  const taCandles = candles.length > 500 ? candles.slice(-500) : candles;
  const ohlcv: OHLCV[] = taCandles.map((c) => ({
    date: c.date,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));

  const ta = analyze(ohlcv, 'واحد');

  // Compute 30-day probability trend
  let probabilityTrend;
  try {
    const dailySnapshots: DailyProbabilitySnapshot[] = computeHistoricalProbabilities(ohlcv, 30);
    probabilityTrend = dailySnapshots.length > 1
      ? buildTrendFromDailySnapshots(dailySnapshots)
      : undefined;
  } catch (err) {
    console.error(`[finpy-sector] Error computing probability trend:`, err);
    probabilityTrend = undefined;
  }

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;
  const lastClose = lastCandle?.close || 0;
  const prevClose = prevCandle?.close || 0;

  return NextResponse.json({
    symbol: label,
    candles,
    info: {
      name: label,
      symbol: label,
      lastPrice: lastClose,
      change: prevClose ? ((lastClose - prevClose) / prevClose) * 100 : 0,
      closePrice: lastClose,
      closeChange: lastClose - prevClose,
      openPrice: lastCandle?.open ?? 0,
      minPrice: lastCandle?.low ?? 0,
      maxPrice: lastCandle?.high ?? 0,
      yesterdayClose: prevClose,
      volume: lastCandle?.volume ?? 0,
      value: 0,
      trades: 0,
      eps: 0,
      pe: 0,
      currencyUnit: getCurrencyUnit('index', 'tse'),
      category: 'index',
      decimals: detectDecimals(lastClose, 'index', 'tse'),
    },
    ta,
    probabilityTrend,
  });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const sector = url.searchParams.get('sector');
  const indexKey = url.searchParams.get('indexKey');
  const webIdParam = url.searchParams.get('webId');

  try {
    // ── Main index (CWI, EWI, CWPI, etc.) ──
    if (indexKey) {
      const candles = await fetchMainIndexHistory(indexKey);
      return buildResponse(candles, indexKey.toUpperCase());
    }

    // ── Sector/industry index by webId (string to preserve precision) ──
    if (webIdParam) {
      // Check if this webId belongs to a main index (has finpyIndex) → use fetchMainIndexHistory
      const mainIndexMatch = INDUSTRY_INDICES.find(s => s.webId === webIdParam && s.finpyIndex);
      if (mainIndexMatch?.finpyIndex) {
        const candles = await fetchMainIndexHistory(mainIndexMatch.finpyIndex);
        return buildResponse(candles, mainIndexMatch.symbol);
      }

      const candles = await fetchSectorIndexHistory(webIdParam);
      const label = INDUSTRY_INDICES.find(s => s.webId === webIdParam)?.symbol || `شاخص ${webIdParam}`;
      return buildResponse(candles, label);
    }

    // ── Sector/industry index by name ──
    if (sector) {
      const sectorDef = findSectorByName(sector);
      if (sectorDef) {
        const candles = await fetchSectorByName(sectorDef.finpySector!);
        return buildResponse(candles, sectorDef.symbol);
      }
      return NextResponse.json({
        error: `شاخص گروه «${sector}» یافت نشد.`,
        candles: [],
      }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'پارامتر indexKey، sector یا webId الزامی است.', candles: [] },
      { status: 400 },
    );
  } catch (err) {
    console.error('[finpy-sector] Error:', err);
    const msg = err instanceof Error ? err.message : 'خطای ناشناخته';
    return NextResponse.json({ error: msg, candles: [] }, { status: 500 });
  }
}
