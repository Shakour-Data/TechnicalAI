import { NextRequest, NextResponse } from 'next/server';
import { fetchTgjuHistory, fetchTgjuInstruments, getTgjuYahooFallback } from '@/lib/tgju-api';
import { fetchYahooHistory, fetchYahooQuotes } from '@/lib/yahoo-finance-api';
import { analyze } from '@/lib/ta-engine';
import { detectDecimals, getCurrencyUnit } from '@/lib/format-price';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
  }

  try {
    // 1. Try TGJU historical data first
    let history = await fetchTgjuHistory(key);

    // 2. If TGJU fails (< 30 candles, likely 403), try Yahoo fallback
    const yahooFallbackSymbol = getTgjuYahooFallback(key);
    let isYahooFallback = false;

    if (history.length < 30 && yahooFallbackSymbol) {
      console.log(`[TGJU Analysis] TGJU returned ${history.length} candles for ${key}, falling back to Yahoo: ${yahooFallbackSymbol}`);
      try {
        const yahooHistory = await fetchYahooHistory(yahooFallbackSymbol, 365);
        if (yahooHistory.length >= 30) {
          history = yahooHistory.map((h) => ({
            date: h.date,
            open: h.open,
            high: h.high,
            low: h.low,
            close: h.close,
          }));
          isYahooFallback = true;
        }
      } catch (yahooErr) {
        console.warn(`[TGJU Analysis] Yahoo fallback also failed for ${yahooFallbackSymbol}:`, yahooErr);
      }
    }

    if (history.length < 30) {
      const msg = isYahooFallback
        ? `داده‌های تاریخی کافی نیست (${history.length} روز). منبع داده TGJU مسدود است و یاهو فایننس نیز داده کافی ندارد.`
        : `داده‌های تاریخی کافی نیست (${history.length} روز). حداقل ۳۰ روز داده نیاز است.`;
      return NextResponse.json({
        error: msg,
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
      volume: isYahooFallback ? (history[0] as any).volume || 0 : 0,
    }));

    // 4. Get instrument info
    const instruments = await fetchTgjuInstruments();
    const instrument = instruments.find((i) => i.key === key);

    const lastCandle = history[history.length - 1];
    const prevCandle = history.length > 1 ? history[history.length - 2] : lastCandle;
    const change = lastCandle.close - prevCandle.close;
    const changePercent = prevCandle.close > 0 ? (change / prevCandle.close) * 100 : 0;

    const category = instrument?.category || 'currency';
    const source = isYahooFallback ? 'yahoo' : 'tgju';
    const decimals = detectDecimals(lastCandle.close, category, source);
    const currencyUnit = getCurrencyUnit(category, source);

    // 5. Run TA analysis
    const ta = analyze(ohlcvData, currencyUnit);

    // Build candle data for chart
    const candles = history.map((h) => ({
      date: h.date,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: isYahooFallback ? (h as any).volume || 0 : 0,
    }));

    const response: Record<string, unknown> = {
      symbol: key,
      candles,
      info: {
        name: instrument?.title || key,
        symbol: key,
        lastPrice: lastCandle.close,
        change: changePercent,
        closePrice: lastCandle.close,
        closeChange: change,
        openPrice: lastCandle.open,
        minPrice: lastCandle.low,
        maxPrice: lastCandle.high,
        yesterdayClose: prevCandle.close,
        volume: 0,
        value: 0,
        trades: 0,
        eps: 0,
        pe: 0,
        currencyUnit,
        decimals,
        category,
      },
      ta,
    };

    if (isYahooFallback) {
      response.isYahoo = true;
      response.yahooFallbackSymbol = yahooFallbackSymbol;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('[TGJU Analysis Error]:', err);
    return NextResponse.json(
      { error: `خطا در تحلیل: ${String(err)}` },
      { status: 500 },
    );
  }
}
