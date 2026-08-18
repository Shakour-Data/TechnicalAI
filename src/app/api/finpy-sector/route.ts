import { NextRequest, NextResponse } from 'next/server';
import { analyze, type OHLCV } from '@/lib/ta-engine';

export const dynamic = 'force-dynamic';

const FINPY_SERVICE_URL = `http://localhost:3031`;

export async function GET(req: NextRequest) {
  const sector = req.nextUrl.searchParams.get('sector');
  if (!sector) {
    return NextResponse.json({ error: 'sector parameter is required' }, { status: 400 });
  }

  try {
    // Call finpy-tse mini-service
    const url = `${FINPY_SERVICE_URL}/api/sector-history?sector=${encodeURIComponent(sector)}&ignore_date=true`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30_000), // 30s timeout for finpy-tse
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'finpy-tse service error' }));
      return NextResponse.json({ error: err.error || 'خطا در دریافت داده‌های finpy-tse', candles: [] }, { status: 502 });
    }

    const json = await res.json();
    const candles = json.candles as Array<{
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      adj_close?: number;
      volume: number;
    }>;

    if (!candles || candles.length === 0) {
      return NextResponse.json({ error: 'داده‌ای یافت نشد', candles: [] }, { status: 404 });
    }

    // Use adj_close if available (from finpy-tse), otherwise use close
    const ohlcv: OHLCV[] = candles.map((c) => ({
      date: c.date,
      open: c.open || c.close,
      high: c.high || c.close,
      low: c.low || c.close,
      close: c.adj_close || c.close,
      volume: c.volume || 0,
    }));

    // Run TA analysis
    const ta = analyze(ohlcv);

    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;

    return NextResponse.json({
      symbol: sector,
      candles: candles.map((c) => ({
        date: c.date,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.adj_close || c.close,
        volume: c.volume,
      })),
      info: {
        name: `شاخص ${sector}`,
        symbol: sector,
        lastPrice: (lastCandle?.adj_close || lastCandle?.close) ?? 0,
        change: prevCandle ? (((lastCandle?.adj_close || lastCandle?.close) - (prevCandle?.adj_close || prevCandle?.close)) / (prevCandle?.adj_close || prevCandle?.close)) * 100 : 0,
        closePrice: (lastCandle?.adj_close || lastCandle?.close) ?? 0,
        closeChange: prevCandle ? (lastCandle?.adj_close || lastCandle?.close) - (prevCandle?.adj_close || prevCandle?.close) : 0,
        openPrice: lastCandle?.open ?? 0,
        minPrice: lastCandle?.low ?? 0,
        maxPrice: lastCandle?.high ?? 0,
        yesterdayClose: (prevCandle?.adj_close || prevCandle?.close) ?? 0,
        volume: lastCandle?.volume ?? 0,
        value: 0,
        trades: 0,
        eps: 0,
        pe: 0,
      },
      ta,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'خطای زمان‌بندی در دریافت داده‌های finpy-tse', candles: [] }, { status: 504 });
    }
    return NextResponse.json({ error: String(err), candles: [] }, { status: 500 });
  }
}
