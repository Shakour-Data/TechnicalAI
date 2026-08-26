import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyze, type OHLCV } from '@/lib/ta-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const webId = req.nextUrl.searchParams.get('webId');
  if (!webId) {
    return NextResponse.json({ error: 'webId is required' }, { status: 400 });
  }

  try {
    // 1. Try reading from SQLite (permanent storage — fast and reliable)
    let candles: Array<{ date: string; j_date?: string; open: number; high: number; low: number; close: number; volume: number }> = [];
    let indexName = '';

    const indexDef = await db.indexDef.findUnique({ where: { webId } });

    if (indexDef && indexDef.status === 'done') {
      // Read from SQLite
      const historyRows = await db.indexHistory.findMany({
        where: { indexDefId: indexDef.id },
        orderBy: { date: 'asc' },
      });
      candles = historyRows.map((r) => ({
        date: r.date,
        j_date: r.jDate,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
      }));
      indexName = indexDef.name;
      console.log(`[index-analysis] Loaded ${candles.length} candles from SQLite for ${indexDef.code} (webId=${webId})`);
    }

    // 2. Fallback: fetch via z-ai SDK (real-time, unreliable)
    if (candles.length === 0) {
      const { fetchIndexHistory, getIndexByWebId } = await import('@/lib/tse-index-api');
      const fetchedCandles = await fetchIndexHistory(webId);
      if (fetchedCandles.length > 0) {
        candles = fetchedCandles;
        const def = getIndexByWebId(webId);
        indexName = def?.name || '';
      }
    }

    if (!candles || candles.length === 0) {
      return NextResponse.json(
        { error: 'داده‌ای برای این شاخص یافت نشد. لطفاً ابتدا از بخش مدیریت شاخص‌ها داده‌ها را دریافت کنید.' },
        { status: 404 },
      );
    }

    // Convert to OHLCV for TA engine
    const ohlcv: (OHLCV & { j_date?: string })[] = candles.map((c) => ({
      date: c.date,
      j_date: c.j_date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    const ta = await analyze(ohlcv, webId);

    // Get live data from BrsApi
    let liveData: { index: number; change: number; changePercent: number; min: number; max: number } | null = null;
    try {
      const { fetchMainIndicesLive } = await import('@/lib/tse-index-api');
      const liveList = await fetchMainIndicesLive();
      const found = liveList.find((i) => i.name === indexName);
      if (found) liveData = found;
    } catch {
      // ignore
    }

    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;
    const change = lastCandle.close - prevCandle.close;
    const changePercent = prevCandle.close > 0
      ? (change / prevCandle.close) * 100
      : 0;

    return NextResponse.json({
      symbol: indexName,
      candles: ohlcv,
      info: {
        name: indexName,
        symbol: indexName,
        lastPrice: liveData?.index ?? lastCandle.close,
        change: Math.round((liveData?.changePercent ?? changePercent) * 100) / 100,
        closePrice: liveData?.index ?? lastCandle.close,
        closeChange: liveData?.change ?? change,
        openPrice: lastCandle.open,
        minPrice: liveData?.min ?? lastCandle.low,
        maxPrice: liveData?.max ?? lastCandle.high,
        yesterdayClose: prevCandle.close,
        volume: 0,
        value: 0,
        trades: 0,
        eps: 0,
        pe: 0,
      },
      ta,
      isIndex: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Index Analysis Error]:', err);
    return NextResponse.json(
      { error: 'خطا در دریافت داده‌های شاخص. لطفاً دوباره تلاش کنید.' },
      { status: 500 },
    );
  }
}
