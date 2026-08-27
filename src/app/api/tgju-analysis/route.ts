import { NextRequest, NextResponse } from 'next/server';
import { fetchTgjuHistory, fetchTgjuInstruments } from '@/lib/tgju-api';
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
    // 1. Fetch historical OHLC data
    const history = await fetchTgjuHistory(key);

    if (history.length < 30) {
      return NextResponse.json({
        error: `داده‌های تاریخی کافی نیست (${history.length} روز). حداقل ۳۰ روز داده نیاز است.`,
        candles: [],
        ta: null,
      });
    }

    // 2. Convert to OHLCV format for TA engine
    const ohlcvData = history.map((h) => ({
      date: h.date,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: 0, // TGJU daily data has no volume
    }));

    // 3. Get instrument info from cached data
    const instruments = await fetchTgjuInstruments();
    const instrument = instruments.find((i) => i.key === key);

    const lastCandle = history[history.length - 1];
    const prevCandle = history.length > 1 ? history[history.length - 2] : lastCandle;
    const change = lastCandle.close - prevCandle.close;
    const changePercent = prevCandle.close > 0 ? (change / prevCandle.close) * 100 : 0;

    const category = instrument?.category || 'currency';
    const decimals = detectDecimals(lastCandle.close, category, 'tgju');
    const currencyUnit = getCurrencyUnit(category, 'tgju');

    // 4. Run TA analysis
    const ta = analyze(ohlcvData, currencyUnit);

    // Build candle data for chart (with volume=0)
    const candles = history.map((h) => ({
      date: h.date,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: 0,
    }));

    return NextResponse.json({
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
    });
  } catch (err) {
    console.error('[TGJU Analysis Error]:', err);
    return NextResponse.json(
      { error: `خطا در تحلیل: ${String(err)}` },
      { status: 500 },
    );
  }
}
