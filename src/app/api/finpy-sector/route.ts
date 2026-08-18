import { NextRequest, NextResponse } from 'next/server';
import { analyze, type OHLCV } from '@/lib/ta-engine';

export const dynamic = 'force-dynamic';

const FINPY_SERVICE_URL = `http://localhost:3031`;

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const sector = url.searchParams.get('sector');
  const indexKey = url.searchParams.get('indexKey');

  // ── Route A: Main index via finpy-tse index function (CWI, EWI, ...) ──
  if (indexKey) {
    return handleIndexRequest(indexKey);
  }

  // ── Route B: Sector/industry via finpy-tse Get_SectorIndex_History ──
  if (sector) {
    return handleSectorRequest(sector);
  }

  return NextResponse.json({ error: 'sector or indexKey parameter is required' }, { status: 400 });
}

async function handleIndexRequest(indexKey: string) {
  try {
    const url = `${FINPY_SERVICE_URL}/api/index-history?key=${encodeURIComponent(indexKey)}&ignore_date=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'finpy-tse service error' }));
      return NextResponse.json({ error: err.error || 'خطا در دریافت داده‌های شاخص', candles: [] }, { status: 502 });
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

    return buildResponse(candles, indexKey);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'خطای زمان‌بندی در دریافت داده‌های شاخص', candles: [] }, { status: 504 });
    }
    return NextResponse.json({ error: String(err), candles: [] }, { status: 500 });
  }
}

async function handleSectorRequest(sector: string) {
  try {
    const url = `${FINPY_SERVICE_URL}/api/sector-history?sector=${encodeURIComponent(sector)}&ignore_date=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });

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

    return buildResponse(candles, sector);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'خطای زمان‌بندی در دریافت داده‌های finpy-tse', candles: [] }, { status: 504 });
    }
    return NextResponse.json({ error: String(err), candles: [] }, { status: 500 });
  }
}

function buildResponse(
  candles: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    adj_close?: number;
    volume: number;
  }>,
  label: string,
) {
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
  const lastClose = lastCandle?.adj_close || lastCandle?.close || 0;
  const prevClose = prevCandle?.adj_close || prevCandle?.close || 0;

  return NextResponse.json({
    symbol: label,
    candles: candles.map((c) => ({
      date: c.date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.adj_close || c.close,
      volume: c.volume,
    })),
    info: {
      name: `شاخص ${label}`,
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
    },
    ta,
  });
}