/**
 * Proxy endpoint for fetching raw CDN data via z-ai SDK.
 * Called by the Python finpy-index-fetcher service.
 * This is the only way to reach cdn.tsetmc.com (Iran-only CDN).
 *
 * Fallback chain: page_reader (z.ai proxy) → direct HTTP fetch → error
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitedPageReader } from '@/lib/zai-shared';

export const dynamic = 'force-dynamic';

/**
 * Extract JSON string from an HTML response that wraps it in a <pre> tag,
 * or from a bare JSON string. Returns null if extraction fails.
 */
function extractJsonFromHtml(html: string): string | null {
  // Try <pre> block first (z.ai page_reader wraps JSON in <pre>)
  const match = /<pre[^>]*>([\s\S]*?)<\/pre>/.exec(html);
  if (match) return match[1].trim();

  // Try stripping HTML tags and checking for bare JSON
  const trimmed = html.replace(/<[^>]+>/g, '').trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;

  return null;
}

/**
 * Direct HTTP fetch to TSETMC CDN as fallback when page_reader times out.
 * The CDN API returns raw JSON (not HTML), so a regular fetch may work
 * even when the page_reader proxy has timeout issues.
 */
async function directFetchTsetmc(webId: string, timeoutMs = 15_000): Promise<string | null> {
  const url = `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}`;
  console.log(`[index-fetch-proxy] Attempting direct fetch for webId=${webId}...`);
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
    });
    if (!res.ok) {
      console.warn(`[index-fetch-proxy] Direct fetch returned ${res.status} for webId=${webId}`);
      return null;
    }
    const text = await res.text();
    if (!text || text.length < 10) {
      console.warn(`[index-fetch-proxy] Direct fetch returned empty/short response for webId=${webId}`);
      return null;
    }
    console.log(`[index-fetch-proxy] Direct fetch success: ${text.length} bytes for webId=${webId}`);
    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[index-fetch-proxy] Direct fetch failed for webId=${webId}: ${msg}`);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const webId = req.nextUrl.searchParams.get('webId');
  if (!webId) {
    return NextResponse.json({ error: 'webId is required' }, { status: 400 });
  }

  const tsetmcUrl = `http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}`;

  // ── Strategy 1: page_reader via z.ai proxy ──────────────────────
  try {
    console.log(`[index-fetch-proxy] Fetching webId=${webId} via page_reader...`);
    const html = await rateLimitedPageReader(tsetmcUrl, 90_000);

    const rawJson = extractJsonFromHtml(html);
    if (rawJson) {
      console.log(`[index-fetch-proxy] page_reader success: ${html.length} bytes raw, JSON is ${rawJson.length} bytes`);
      return NextResponse.json({ raw: rawJson, length: rawJson.length, source: 'page_reader' });
    }

    console.warn(`[index-fetch-proxy] page_reader returned HTML but no extractable JSON for webId=${webId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[index-fetch-proxy] page_reader failed for webId=${webId}: ${msg}`);
  }

  // ── Strategy 2: Direct HTTP fetch fallback ─────────────────────
  const directResult = await directFetchTsetmc(webId, 15_000);
  if (directResult) {
    // Direct fetch returns raw JSON, may need to strip HTML if CDN wraps it
    const rawJson = extractJsonFromHtml(directResult) || directResult.trim();
    if (rawJson.length > 10) {
      console.log(`[index-fetch-proxy] Direct fetch fallback success for webId=${webId}: ${rawJson.length} bytes`);
      return NextResponse.json({ raw: rawJson, length: rawJson.length, source: 'direct_fetch' });
    }
  }

  // ── Both strategies failed ─────────────────────────────────────
  console.error(`[index-fetch-proxy] All fetch strategies failed for webId=${webId}`);
  return NextResponse.json(
    { error: `Failed to fetch index data for webId=${webId}: both page_reader and direct fetch failed` },
    { status: 504 },
  );
}
