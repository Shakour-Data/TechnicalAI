/**
 * Proxy endpoint for fetching raw CDN data via z-ai SDK.
 * Called by the Python finpy-index-fetcher service.
 * This is the only way to reach cdn.tsetmc.com (Iran-only CDN).
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitedPageReader } from '@/lib/zai-shared';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const webId = req.nextUrl.searchParams.get('webId');
  if (!webId) {
    return NextResponse.json({ error: 'webId is required' }, { status: 400 });
  }

  try {
    const url = `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}`;
    console.log(`[index-fetch-proxy] Fetching webId=${webId}...`);

    const html = await rateLimitedPageReader(url, 90_000);

    // Extract JSON from <pre> block
    const match = /<pre[^>]*>([\s\S]*?)<\/pre>/.exec(html);
    if (!match) {
      const trimmed = html.replace(/<[^>]+>/g, '').trim();
      if (trimmed.startsWith('{')) {
        return NextResponse.json({ raw: trimmed, length: trimmed.length });
      }
      return NextResponse.json({ error: 'No <pre> block in response' }, { status: 500 });
    }

    const rawJson = match[1].trim();
    console.log(`[index-fetch-proxy] Got ${html.length} bytes raw, JSON is ${rawJson.length} bytes`);

    return NextResponse.json({ raw: rawJson, length: rawJson.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[index-fetch-proxy] Error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
