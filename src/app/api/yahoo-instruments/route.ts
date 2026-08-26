import { NextResponse } from 'next/server';
import { fetchYahooQuotes, YAHOO_STOCKS } from '@/lib/yahoo-finance-api';

export const dynamic = 'force-dynamic';
export const revalidate = 120;

export async function GET() {
  try {
    const quotes = await fetchYahooQuotes();

    // Build a map of symbol -> quote for fast lookup
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    // Convert to instrument items (same format as TGJU/TSE)
    const toItem = (def: typeof YAHOO_STOCKS[number]) => {
      const q = quoteMap.get(def.symbol);
      return {
        l18: def.name,
        l30: `${def.nameEn} (${def.symbol})`,
        pl: q?.price || 0,
        pcp: q?.changePercent || 0,
        tno: 0,
        tvol: q?.volume || 0,
        tval: q?.marketCap || 0,
        cs: def.country,
        category: 'yahoo_stock' as const,
        yahooSymbol: def.symbol,
        groupTitle: def.groupTitle,
        currency: q?.currency || 'USD',
      };
    };

    const items = YAHOO_STOCKS.map(toItem);

    // Group by country
    const countries = [...new Set(YAHOO_STOCKS.map((s) => s.country))];
    const byCountry: Record<string, typeof items> = {};
    for (const c of countries) {
      byCountry[c] = items.filter((i) => i.cs === c);
    }

    return NextResponse.json({
      items,
      byCountry,
      countries,
    });
  } catch (err) {
    console.error('[Yahoo Instruments Error]:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
