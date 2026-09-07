import { NextRequest, NextResponse } from 'next/server';
import { fetchMainIndexHistory, fetchSectorIndexHistory, fetchSectorByName, directFetchIndexData } from '@/lib/tsetmc-index-api';
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
  fetchSource?: string,
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

  let ta;
  try {
    ta = analyze(ohlcv, 'واحد');
  } catch (err) {
    console.error(`[finpy-sector] TA analysis failed for ${label}:`, err instanceof Error ? err.message : String(err));
    ta = undefined;
  }

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

  const result: Record<string, unknown> = {
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
  };

  if (fetchSource) {
    result.fetchSource = fetchSource;
  }

  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const sector = url.searchParams.get('sector');
  const indexKey = url.searchParams.get('indexKey');
  const webIdParam = url.searchParams.get('webId');

  // ── Main index (CWI, EWI, CWPI, etc.) ──
  if (indexKey) {
    try {
      const candles = await fetchMainIndexHistory(indexKey);
      return buildResponse(candles, indexKey.toUpperCase());
    } catch (err) {
      console.error(`[finpy-sector] Error fetching main index ${indexKey}:`, err instanceof Error ? err.message : String(err));
      // Return partial result with error info instead of hard 500
      return NextResponse.json({
        symbol: indexKey.toUpperCase(),
        candles: [],
        error: err instanceof Error ? err.message : 'خطا در دریافت داده‌های شاخص',
        fetchFailed: true,
        info: null,
        ta: null,
        probabilityTrend: null,
      }, { status: 200 });
    }
  }

  // ── Sector/industry index by webId (string to preserve precision) ──
  if (webIdParam) {
    // Check if this webId belongs to a main index (has finpyIndex) → use fetchMainIndexHistory
    const mainIndexMatch = INDUSTRY_INDICES.find(s => s.webId === webIdParam && s.finpyIndex);
    if (mainIndexMatch?.finpyIndex) {
      try {
        const candles = await fetchMainIndexHistory(mainIndexMatch.finpyIndex);
        return buildResponse(candles, mainIndexMatch.symbol);
      } catch (err) {
        console.error(`[finpy-sector] Error fetching main index by webId ${webIdParam}:`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({
          symbol: mainIndexMatch.symbol,
          candles: [],
          error: err instanceof Error ? err.message : 'خطا در دریافت داده‌ها',
          fetchFailed: true,
          info: null,
          ta: null,
          probabilityTrend: null,
        }, { status: 200 });
      }
    }

    try {
      const candles = await fetchSectorIndexHistory(webIdParam);
      const label = INDUSTRY_INDICES.find(s => s.webId === webIdParam)?.symbol || `شاخص ${webIdParam}`;
      return buildResponse(candles, label);
    } catch (err) {
      console.error(`[finpy-sector] Error fetching sector webId=${webIdParam}:`, err instanceof Error ? err.message : String(err));
      const label = INDUSTRY_INDICES.find(s => s.webId === webIdParam)?.symbol || `شاخص ${webIdParam}`;
      // Return partial result — frontend can still render with empty candles
      return NextResponse.json({
        symbol: label,
        candles: [],
        error: err instanceof Error ? err.message : 'خطا در دریافت داده‌های شاخص گروه',
        fetchFailed: true,
        info: null,
        ta: null,
        probabilityTrend: null,
      }, { status: 200 });
    }
  }

  // ── Sector/industry index by name ──
  if (sector) {
    const sectorDef = findSectorByName(sector);
    if (sectorDef) {
      try {
        const candles = await fetchSectorByName(sectorDef.finpySector!);
        return buildResponse(candles, sectorDef.symbol);
      } catch (err) {
        console.error(`[finpy-sector] Error fetching sector "${sector}":`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({
          symbol: sectorDef.symbol,
          candles: [],
          error: err instanceof Error ? err.message : 'خطا در دریافت داده‌های شاخص گروه',
          fetchFailed: true,
          info: null,
          ta: null,
          probabilityTrend: null,
        }, { status: 200 });
      }
    }
    return NextResponse.json({
      error: `شاخص گروه «${sector}» یافت نشد.`,
      candles: [],
      fetchFailed: true,
    }, { status: 404 });
  }

  return NextResponse.json(
    { error: 'پارامتر indexKey، sector یا webId الزامی است.', candles: [] },
    { status: 400 },
  );
}
