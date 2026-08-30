import { NextRequest, NextResponse } from 'next/server';
import { fetchCandlestick, fetchSymbolData, fetchTsetmcIndexHistory, type CandleData } from '@/lib/tse-api';
import type { OHLCV } from '@/lib/ta-engine';
import { detectDecimals, getCurrencyUnit } from '@/lib/format-price';

export const dynamic = 'force-dynamic';

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

    // If indexInsCode is provided, fetch from TSETMC instead of BrsApi
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

        const ta = analyze(ohlcv, 'واحد');

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

    const ta = analyze(ohlcv, 'ریال');

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
