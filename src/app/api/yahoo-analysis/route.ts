import { NextRequest, NextResponse } from 'next/server';
import { fetchYahooHistory, getYahooInstrumentDef, fetchYahooQuotes } from '@/lib/yahoo-finance-api';
import { analyze } from '@/lib/ta-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  try {
    // 1. Get instrument definition (works for ALL Yahoo instrument types)
    const instDef = getYahooInstrumentDef(symbol);
    const name = instDef?.name || symbol;
    const nameEn = instDef?.nameEn || symbol;
    const category = instDef?.category || 'yahoo_stock';
    const groupTitle = instDef?.groupTitle || '';

    // 2. Fetch historical OHLC data
    const history = await fetchYahooHistory(symbol, 365);

    if (history.length < 30) {
      return NextResponse.json({
        error: `داده‌های تاریخی کافی نیست (${history.length} روز). حداقل ۳۰ روز داده نیاز است.`,
        candles: [],
        ta: null,
      });
    }

    // 3. Convert to OHLCV format for TA engine
    const ohlcvData = history.map((h) => ({
      date: h.date,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: h.volume,
    }));

    // 4. Run TA analysis
    const ta = analyze(ohlcvData);

    // 5. Get live quote for info and currency unit
    const quotes = await fetchYahooQuotes();
    const quote = quotes.find((q) => q.symbol === symbol);
    const currency = quote?.unit || quote?.currency || 'USD';

    const lastCandle = history[history.length - 1];
    const prevCandle = history.length > 1 ? history[history.length - 2] : lastCandle;
    const change = lastCandle.close - prevCandle.close;
    const changePercent = prevCandle.close > 0 ? (change / prevCandle.close) * 100 : 0;

    // Build candle data for chart
    const candles = history.map((h) => ({
      date: h.date,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: h.volume,
    }));

    return NextResponse.json({
      symbol,
      candles,
      info: {
        name,
        symbol,
        nameEn,
        lastPrice: quote?.price || lastCandle.close,
        change: changePercent,
        closePrice: lastCandle.close,
        closeChange: change,
        openPrice: quote?.open || lastCandle.open,
        minPrice: quote?.low || lastCandle.low,
        maxPrice: quote?.high || lastCandle.high,
        yesterdayClose: prevCandle.close,
        volume: lastCandle.volume,
        value: 0,
        trades: 0,
        eps: 0,
        pe: 0,
        currency,
        category,
        groupTitle,
      },
      ta,
    });
  } catch (err) {
    console.error('[Yahoo Analysis Error]:', err);
    return NextResponse.json(
      { error: `خطا در تحلیل: ${String(err)}` },
      { status: 500 },
    );
  }
}
