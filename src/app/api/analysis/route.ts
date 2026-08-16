import { NextRequest, NextResponse } from 'next/server';
import { fetchCandlestick, fetchSymbolData, fetchTsetmcIndexHistory, type CandleData } from '@/lib/tse-api';
import { analyze, type OHLCV } from '@/lib/ta-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 });

  const indexInsCode = req.nextUrl.searchParams.get('indexInsCode');

  try {
    // If indexInsCode is provided, fetch from TSETMC instead of BrsApi
    if (indexInsCode) {
      const tsetmcCandles = await fetchTsetmcIndexHistory(indexInsCode);

      if (tsetmcCandles && tsetmcCandles.length > 0) {
        // Build index name from symbol (the Persian name passed as symbol param)
        const indexName = symbol;

        const ohlcv: OHLCV[] = tsetmcCandles.map((c) => ({
          date: c.date,
          open: Number(c.open) || 0,
          high: Number(c.high) || 0,
          low: Number(c.low) || 0,
          close: Number(c.close) || 0,
          volume: Number(c.volume) || 0,
        }));

        const ta = analyze(ohlcv);

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
          },
          ta,
        });
      }

      // TSETMC returned no candles — signal to caller
      return NextResponse.json({
        symbol,
        candles: [],
        info: null,
        ta: null,
      });
    }

    // Regular instrument: use BrsApi
    const [candles, symbolInfo] = await Promise.all([
      fetchCandlestick(symbol, 3), // adjusted daily
      fetchSymbolData(symbol).catch(() => null),
    ]);

    if (!candles || candles.length === 0) {
      return NextResponse.json({ error: 'No candle data found' }, { status: 404 });
    }

    // API returns newest first — reverse to chronological order for TA
    const reversed = [...candles].reverse();

    const ohlcv: OHLCV[] = reversed.map((c: CandleData) => ({
      date: c.date,
      open: Number(c.open) || 0,
      high: Number(c.high) || 0,
      low: Number(c.low) || 0,
      close: Number(c.close) || 0,
      volume: Number(c.volume) || 0,
    }));

    const ta = analyze(ohlcv);

    // Extract real-time info from symbol data
    const info = symbolInfo && typeof symbolInfo === 'object' && !Array.isArray(symbolInfo)
      ? symbolInfo as Record<string, unknown>
      : null;

    return NextResponse.json({
      symbol,
      candles: reversed,
      info: info ? {
        name: String(info.l30 ?? symbol),
        symbol: String(info.l18 ?? symbol),
        lastPrice: Number(info.pl ?? ohlcv[ohlcv.length - 1]?.close ?? 0),
        change: Number(info.plp ?? 0),
        closePrice: Number(info.pc ?? 0),
        closeChange: Number(info.pcp ?? 0),
        openPrice: Number(info.pf ?? 0),
        minPrice: Number(info.pmin ?? 0),
        maxPrice: Number(info.pmax ?? 0),
        yesterdayClose: Number(info.py ?? 0),
        volume: Number(info.tvol ?? 0),
        value: Number(info.tval ?? 0),
        trades: Number(info.tno ?? 0),
        eps: Number(info.eps ?? 0),
        pe: Number(info.pe ?? 0),
      } : null,
      ta,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
