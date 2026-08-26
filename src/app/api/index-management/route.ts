/**
 * Index Management API — Frontend interface for the Python fetcher service
 * Proxies requests to the finpy-index-fetcher on port 3035.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FETCHER_URL = 'http://localhost:3035';

async function proxyToFetcher(path: string, method: 'GET' | 'POST' = 'GET'): Promise<NextResponse> {
  try {
    const res = await fetch(`${FETCHER_URL}${path}`, {
      method,
      signal: AbortSignal.timeout(300_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `خطا در ارتباط با سرویس دریافت داده: ${msg}` },
      { status: 503 },
    );
  }
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'status';

  // List all indices with their fetch status
  if (action === 'list') {
    try {
      const { db } = await import('@/lib/db');
      const indexDefs = await db.indexDef.findMany({
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
      });
      return NextResponse.json({ indices: indexDefs });
    } catch (err) {
      // Fallback: proxy to Python service
      return proxyToFetcher('/api/indices');
    }
  }

  // Bulk fetch status
  if (action === 'bulk-status') {
    return proxyToFetcher('/api/bulk-status');
  }

  // Get stored candle data for an index
  if (action === 'data') {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
    return proxyToFetcher(`/api/index-data?code=${code}`);
  }

  return proxyToFetcher('/api/health');
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || '';

  // Start bulk fetch
  if (action === 'bulk-start') {
    const category = req.nextUrl.searchParams.get('category') || 'all';
    return proxyToFetcher(`/api/bulk-fetch?category=${category}`, 'POST');
  }

  // Stop bulk fetch
  if (action === 'bulk-stop') {
    return proxyToFetcher('/api/bulk-stop', 'POST');
  }

  // Fetch single index
  if (action === 'fetch-one') {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
    return proxyToFetcher(`/api/fetch-one?code=${code}`, 'POST');
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
