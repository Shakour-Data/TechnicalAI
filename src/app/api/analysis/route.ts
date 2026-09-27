/**
 * @module API /api/analysis
 * @description Main technical analysis endpoint. Returns candlestick data, symbol info,
 *   full technical analysis (via ta-engine), and a probability trend forecast for a given
 *   TSE (Tehran Stock Exchange) symbol or TSETMC index.
 *
 * Two data-source paths are supported:
 *   1. **Index path** — when `indexInsCode` query param is provided, candle data is
 *      fetched from the TSETMC index history API (`fetchTsetmcIndexHistory`).
 *   2. **TSE instrument path** (default) — when only `symbol` is provided, candle data
 *      is fetched from the BrsApi candlestick endpoint (`fetchCandlestick`).
 *
 * Both paths convert raw candles to {@link OHLCV} format, run them through
 * `analyze()` from `@/lib/ta-engine`, compute historical probability snapshots via
 * `computeHistoricalProbabilities()`, and build a probability trend via
 * `buildTrendFromDailySnapshots()` from `@/lib/probability-trend`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchCandlestick, fetchSymbolData, fetchTsetmcIndexHistory, type CandleData } from '@/lib/tse-api';
import type { OHLCV } from '@/lib/ta-engine';
import { detectDecimals, getCurrencyUnit } from '@/lib/format-price';

/** Force dynamic rendering — never cache at the Next.js edge. */
export const dynamic = 'force-dynamic';

/**
 * GET /api/analysis — Retrieve full technical analysis for a TSE symbol or index.
 *
 * @description
 * Processing steps:
 *   1. Parse `symbol` (required) and `indexInsCode` (optional) from query string.
 *   2. **Index path** (indexInsCode present):
 *      a. Fetch historical candles from TSETMC via `fetchTsetmcIndexHistory`.
 *      b. Map to OHLCV, run `analyze(ohlcv, 'واحد')`.
 *      c. Compute `probabilityTrend` from 30-day historical snapshots.
 *      d. Derive `info` from last/previous candle (price, change, volume, etc.).
 *   3. **TSE instrument path** (no indexInsCode):
 *      a. Fetch candles from BrsApi via `fetchCandlestick(symbol, 3)` and symbol
 *         metadata via `fetchSymbolData(symbol)` in parallel.
 *      b. Reverse candles (BrsApi returns newest-first), map to OHLCV.
 *      c. Run `analyze(ohlcv, 'ریال')`.
 *      d. Compute `probabilityTrend` from 30-day historical snapshots.
 *      e. Merge `info` from symbol metadata with candle-derived fallback values.
 *   4. Return JSON with `symbol`, `candles`, `info`, `ta`, and `probabilityTrend`.
 *
 * @param  req - Next.js incoming request (query params parsed from `req.nextUrl`).
 *
 * @query  symbol        - (required) TSE symbol string, e.g. "فولاد" or an index name.
 * @query  indexInsCode  - (optional) TSETMC instrument code; when present the index
 *                         data-source path is used instead of BrsApi.
 *
 * @returns JSON response:
 *   - **200** `{ symbol, candles, info, ta, probabilityTrend }`
 *     - `candles` — array of candle objects (order depends on data source).
 *     - `info` — symbol metadata object (name, lastPrice, change, volume, eps, pe, …)
 *               or `null` for index path with no data.
 *     - `ta` — full technical analysis result from `analyze()`.
 *     - `probabilityTrend` — trend forecast object from `buildTrendFromDailySnapshots()`
 *               or `undefined` on computation failure.
 *   - **400** `{ error: "symbol is required" }`
 *   - **404** `{ error: "No candle data found" }` or Persian not-found message.
 *   - **502** `{ error: "…" }` — generic upstream error (Persian message).
 *   - **503** `{ error: "سرور داده در دسترس نیست…" }` — TSE data timeout.
 */
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 });

  const indexInsCode = req.nextUrl.searchParams.get('indexInsCode');

  try {
    // Lazy-load heavy TA engine to avoid Turbopack memory pressure
    const taEngine = await import('@/lib/ta-engine');
    const { analyze, computeHistoricalProbabilities } = taEngine;
    const probTrend = await import('@/lib/probability-trend');
    const { buildTrendFromDailySnapshots } = probTrend;

    /*
     * ── Index path (indexInsCode provided) ─────────────────────────────
     * Fetches candle data from TSETMC index history, converts to OHLCV,
     * runs ta-engine analyze() with currency unit 'واحد' (unit), computes
     * probabilityTrend from 30-day historical snapshots, and derives
     * info fields from the last two candles.
     */
    if (indexInsCode) {
      const tsetmcCandles = await fetchTsetmcIndexHistory(indexInsCode);

      if (tsetmcCandles && tsetmcCandles.length > 0) {
        const indexName = symbol;

        const ohlcv: OHLCV[] = tsetmcCandles.map((c) => ({
          date: c.date,
          open: Number(c.open) || 0,
          high: Number(c.high) || 0,
          low: Number(c.low) || 0,
          close: Number(c.close) || 0,
          volume: Number(c.volume) || 0,
        }));

        // Run full technical analysis via ta-engine (indicators, signals, scenarios, S/R)
        const ta = analyze(ohlcv, 'واحد');

        // Compute probability trend from 30-day rolling historical snapshots.
        // Falls back to undefined if snapshot count ≤ 1 or on computation error.
        let probabilityTrend;
        try {
          const dailySnapshots = computeHistoricalProbabilities(ohlcv, 30);
          console.log(`[analysis] Historical snapshots for ${symbol}: ${dailySnapshots.length} days (data.length=${ohlcv.length})`);
          probabilityTrend = dailySnapshots.length > 1
            ? buildTrendFromDailySnapshots(dailySnapshots)
            : undefined;
          if (probabilityTrend) {
            console.log(`[analysis] probabilityTrend built: ${probabilityTrend.scenarios.length} scenarios, horizon=${probabilityTrend.horizon}`);
          }
        } catch (err) {
          console.error(`[analysis] Error computing probability trend for ${symbol}:`, err);
          probabilityTrend = undefined;
        }

        const lastCandle = tsetmcCandles[tsetmcCandles.length - 1];
        const prevCandle = tsetmcCandles.length > 1 ? tsetmcCandles[tsetmcCandles.length - 2] : lastCandle;

        return NextResponse.json({
          symbol,
          candles: tsetmcCandles,
          info: {
            name: indexName,
            symbol: indexName,
            lastPrice: lastCandle?.close ?? 0,
            change: prevCandle ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100 : 0,
            closePrice: lastCandle?.close ?? 0,
            closeChange: prevCandle ? lastCandle.close - prevCandle.close : 0,
            openPrice: lastCandle?.open ?? 0,
            minPrice: lastCandle?.low ?? 0,
            maxPrice: lastCandle?.high ?? 0,
            yesterdayClose: prevCandle?.close ?? 0,
            volume: lastCandle?.volume ?? 0,
            value: 0,
            trades: 0,
            eps: 0,
            pe: 0,
            currencyUnit: 'واحد',
            decimals: 0,
            category: 'index',
          },
          ta,
          probabilityTrend,
        });
      }

      return NextResponse.json({
        symbol,
        candles: [],
        info: null,
        ta: null,
      });
    }

    /*
     * ── TSE instrument path (default) ────────────────────────────────
     * Fetches candles from BrsApi and symbol metadata in parallel.
     * Reverses candles (BrsApi returns newest-first), maps to OHLCV,
     * runs ta-engine analyze() with currency unit 'ریال' (Rial), computes
     * probabilityTrend, and merges symbol info with candle fallbacks.
     */
    // Regular instrument: use BrsApi
    const [candles, symbolInfo] = await Promise.all([
      fetchCandlestick(symbol, 3),
      fetchSymbolData(symbol).catch(() => null),
    ]);

    if (!candles || candles.length === 0) {
      return NextResponse.json({ error: 'No candle data found' }, { status: 404 });
    }

    const reversed = [...candles].reverse();

    const ohlcv: OHLCV[] = reversed.map((c: CandleData) => ({
      date: c.date,
      open: Number(c.open) || 0,
      high: Number(c.high) || 0,
      low: Number(c.low) || 0,
      close: Number(c.close) || 0,
      volume: Number(c.volume) || 0,
    }));

    // Run full technical analysis via ta-engine (indicators, signals, scenarios, S/R)
    const ta = analyze(ohlcv, 'ریال');

    // Compute probability trend from 30-day rolling historical snapshots.
    // Falls back to undefined if snapshot count ≤ 1 or on computation error.
    let probabilityTrend;
    try {
      const dailySnapshots = computeHistoricalProbabilities(ohlcv, 30);
      console.log(`[analysis] Historical snapshots for ${symbol}: ${dailySnapshots.length} days (data.length=${ohlcv.length})`);
      probabilityTrend = dailySnapshots.length > 1
        ? buildTrendFromDailySnapshots(dailySnapshots)
        : undefined;
      if (probabilityTrend) {
        console.log(`[analysis] probabilityTrend built: ${probabilityTrend.scenarios.length} scenarios, horizon=${probabilityTrend.horizon}`);
      }
    } catch (err) {
      console.error(`[analysis] Error computing probability trend for ${symbol}:`, err);
      probabilityTrend = undefined;
    }

    const info = symbolInfo && typeof symbolInfo === 'object' && !Array.isArray(symbolInfo)
      ? symbolInfo as Record<string, unknown>
      : null;

    const lastCandle = reversed[reversed.length - 1];
    const prevCandle = reversed.length > 1 ? reversed[reversed.length - 2] : lastCandle;
    const lastClose = Number(lastCandle?.close ?? 0);
    const prevClose = Number(prevCandle?.close ?? 0);
    const changePercent = prevClose > 0 ? ((lastClose - prevClose) / prevClose) * 100 : 0;
    const decimals = detectDecimals(lastClose, 'stock', 'tse');
    const currencyUnit = getCurrencyUnit('stock', 'tse');

    return NextResponse.json({
      symbol,
      candles: reversed,
      info: info ? {
        name: String(info.l30 ?? symbol),
        symbol: String(info.l18 ?? symbol),
        lastPrice: Number(info.pl ?? lastClose),
        change: changePercent,
        closePrice: Number(info.pc ?? lastClose),
        closeChange: lastClose - prevClose,
        openPrice: Number(info.pf ?? 0),
        minPrice: Number(info.pmin ?? 0),
        maxPrice: Number(info.pmax ?? 0),
        yesterdayClose: Number(info.py ?? prevClose),
        volume: Number(info.tvol ?? 0),
        value: Number(info.tval ?? 0),
        trades: Number(info.tno ?? 0),
        eps: Number(info.eps ?? 0),
        pe: Number(info.pe ?? 0),
        currencyUnit,
        decimals,
        category: 'stock',
      } : null,
      ta,
      probabilityTrend,
    });
  } catch (err) {
    // Error classification: timeout → 503, not-found → 404, everything else → 502
    const msg = err instanceof Error ? err.message : 'خطای ناشناخته';
    console.error(`[analysis] Error for symbol=${symbol}:`, msg);
    const isTimeout = msg.includes('Timeout') || msg.includes('timeout') || msg.includes('زمان') || msg.includes('اتصال');
    const isNotFound = msg.includes('یافت نشد') || msg.includes('No candle');
    const status = isNotFound ? 404 : isTimeout ? 503 : 502;
    const userMsg = isTimeout
      ? 'سرور داده در دسترس نیست. لطفاً بعداً تلاش کنید.'
      : isNotFound
      ? msg
      : 'خطا در دریافت داده‌ها. لطفاً دوباره تلاش کنید.';
    return NextResponse.json({ error: userMsg }, { status });
  }
}

// ─── POST: Time Series Analysis ────────────────────────────

interface TimeSeriesRequestBody {
  symbol: string;
  analysis_type?: string;
  horizon?: number;
  mode?: 'quick' | 'detailed';
  model_keys?: string[];
}

/**
 * POST /api/analysis — Run time series analysis via Python backend.
 *
 * @description
 * Processing steps:
 *   1. Parse JSON body — expects `symbol` (required), `analysis_type` (must be 'time_series'),
 *      `horizon` (1-90, default 30), `mode` ('quick' or 'detailed'), optional `model_keys`.
 *   2. Validate symbol and analysis_type.
 *   3. Forward to Python backend at /analysis/time-series endpoint.
 *   4. Return the Python backend response or an appropriate error.
 *
 * @param req - Next.js incoming request with JSON body.
 *
 * @requestBody
 *   - `symbol`      {string} — (required) TSE symbol string.
 *   - `analysis_type` {string} — Must be 'time_series'.
 *   - `horizon`     {number} — Forecast horizon 1-90, default 30.
 *   - `mode`        {string} — 'quick' or 'detailed', default 'quick'.
 *   - `model_keys`  {string[]} — (optional) ML models for quick mode.
 *
 * @returns JSON response:
 *   - **200** — Python backend analysis response.
 *   - **400** `{ error }` — Invalid input.
 *   - **500** `{ error }` — Internal server error.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      symbol,
      analysis_type = 'time_series',
      horizon = 30,
      mode = 'quick',
      model_keys,
    }: TimeSeriesRequestBody = body;

    if (analysis_type !== 'time_series') {
      return NextResponse.json({ error: 'Only time_series analysis_type supported' }, { status: 400 });
    }

    if (!symbol) {
      return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    // Call Python backend
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    const resp = await fetch(`${pythonBackendUrl}/analysis/time-series`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, horizon, mode, model_keys }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({ error: data.detail || 'Analysis failed' }, { status: resp.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[analysis] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
