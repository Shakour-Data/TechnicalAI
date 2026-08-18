import { NextRequest, NextResponse } from 'next/server';
import { analyze, type OHLCV } from '@/lib/ta-engine';

export const dynamic = 'force-dynamic';

const FINPY_SERVICE_URL = `http://localhost:3031`;

// ── Types ───────────────────────────────────────────────────────
interface FinpyCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close?: number;
  volume: number;
}

// ── Helper: Call finpy-tse service ───────────────────────────────
async function fetchFromFinpy(url: string): Promise<FinpyCandle[] | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error) {
      console.error(`[finpy-tse] Error: ${json.error}`);
      return null;
    }
    const candles = json.candles as FinpyCandle[] | undefined;
    return candles && candles.length > 0 ? candles : null;
  } catch (err) {
    console.error(`[finpy-tse] Request failed:`, err);
    return null;
  }
}

// ── Helper: Map finpy candle to our format ───────────────────────
function mapCandles(candles: FinpyCandle[]) {
  return candles.map((c) => ({
    date: c.date,
    open: c.open || c.close,
    high: c.high || c.close,
    low: c.low || c.close,
    close: c.adj_close || c.close,
    volume: c.volume || 0,
  }));
}

// ── Helper: Build full response with TA analysis ────────────────
function buildResponse(
  candles: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>,
  label: string,
) {
  const ohlcv: OHLCV[] = candles.map((c) => ({
    date: c.date,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));

  const ta = analyze(ohlcv);

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;
  const lastClose = lastCandle?.close || 0;
  const prevClose = prevCandle?.close || 0;

  return NextResponse.json({
    symbol: label,
    candles,
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

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const sector = url.searchParams.get('sector');
  const indexKey = url.searchParams.get('indexKey');
  const webId = url.searchParams.get('webId');

  // ── Main index (CWI, EWI, CWPI, etc.) ──
  if (indexKey) {
    const key = indexKey.toUpperCase();
    const finpyUrl = `${FINPY_SERVICE_URL}/api/index-history?key=${encodeURIComponent(key)}&ignore_date=true`;
    const candles = await fetchFromFinpy(finpyUrl);

    if (candles && candles.length > 0) {
      const mapped = mapCandles(candles);
      return buildResponse(mapped, key);
    }

    return NextResponse.json(
      { error: 'خطا در دریافت داده‌های تاریخی شاخص. سرویس finpy-tse پاسخ نداد.', candles: [] },
      { status: 502 },
    );
  }

  // ── Sector/industry index ──
  if (sector || webId) {
    // Try finpy-tse sector by name
    if (sector) {
      const finpyUrl = `${FINPY_SERVICE_URL}/api/sector-history?sector=${encodeURIComponent(sector)}&ignore_date=true`;
      const candles = await fetchFromFinpy(finpyUrl);

      if (candles && candles.length > 0) {
        const mapped = mapCandles(candles);
        return buildResponse(mapped, sector);
      }
    }

    // Try finpy-tse sector by webId (if sector name wasn't enough)
    // Note: finpy-tse doesn't support webId directly, but we keep it for compatibility
    if (webId && !sector) {
      return NextResponse.json(
        { error: 'نام شاخص گروه (sector) برای دریافت داده الزامی است.', candles: [] },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'خطا در دریافت داده‌های شاخص گروه. سرویس finpy-tse پاسخ نداد.', candles: [] },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { error: 'پارامتر indexKey یا sector الزامی است.', candles: [] },
    { status: 400 },
  );
}
