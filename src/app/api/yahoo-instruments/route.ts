import { NextResponse } from 'next/server';
import { fetchYahooQuotes, ALL_YAHOO_INSTRUMENTS, YahooCategory } from '@/lib/yahoo-finance-api';

export const dynamic = 'force-dynamic';
export const revalidate = 120;

/* ── Map Yahoo categories to frontend display categories ── */
const CATEGORY_LABEL_MAP: Record<YahooCategory, string> = {
  yahoo_stock: 'yahoo_stock',
  yahoo_index: 'world_index',
  yahoo_energy: 'energy',
  yahoo_metal: 'metal',
  yahoo_commodity: 'commodity',
  yahoo_forex: 'forex',
  yahoo_crypto: 'crypto',
  yahoo_etf: 'yahoo_etf',
};

export async function GET() {
  try {
    // Always return instrument definitions, even if live quotes fail
    let quotes: Awaited<ReturnType<typeof fetchYahooQuotes>> = [];
    try {
      quotes = await fetchYahooQuotes();
    } catch (err) {
      console.warn('[Yahoo Instruments] Quote fetch failed, returning zero-price instruments:', err);
    }

    // Build a map of symbol -> quote for fast lookup
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    // Convert to instrument items (same format as TGJU/TSE)
    const toItem = (def: typeof ALL_YAHOO_INSTRUMENTS[number]) => {
      const q = quoteMap.get(def.symbol);
      const displayCategory = CATEGORY_LABEL_MAP[def.category];
      return {
        l18: def.name,
        l30: `${def.nameEn} (${def.symbol})`,
        pl: q?.price || 0,
        pcp: q?.changePercent || 0,
        tno: 0,
        tvol: q?.volume || 0,
        tval: q?.marketCap || 0,
        cs: def.groupTitle,
        category: displayCategory,
        yahooSymbol: def.symbol,
        yahooCategory: def.category,
        groupTitle: def.groupTitle,
        currency: q?.unit || q?.currency || 'USD',
        unit: q?.unit || q?.currency || 'USD',
        country: def.country,
        countryEn: def.countryEn,
        exchange: def.exchange,
        sector: def.sector || '',
        nameEn: def.nameEn,
      };
    };

    const items = ALL_YAHOO_INSTRUMENTS.map(toItem);

    // Group by Yahoo category
    const yahooStocks = items.filter((i) => i.yahooCategory === 'yahoo_stock');
    const yahooIndices = items.filter((i) => i.yahooCategory === 'yahoo_index');
    const yahooEnergy = items.filter((i) => i.yahooCategory === 'yahoo_energy');
    const yahooMetals = items.filter((i) => i.yahooCategory === 'yahoo_metal');
    const yahooCommodities = items.filter((i) => i.yahooCategory === 'yahoo_commodity');
    const yahooForex = items.filter((i) => i.yahooCategory === 'yahoo_forex');
    const yahooCrypto = items.filter((i) => i.yahooCategory === 'yahoo_crypto');
    const yahooEtfs = items.filter((i) => i.yahooCategory === 'yahoo_etf');

    // Merge into TGJU-compatible categories for the search UI
    // These arrays include Yahoo instruments that should appear in the same tabs as TGJU instruments
    const worldIndices = yahooIndices;
    const energy = yahooEnergy;
    const metals = yahooMetals;
    const commodities = yahooCommodities;
    const forex = yahooForex;
    const crypto = yahooCrypto;

    return NextResponse.json({
      items,
      yahooStocks,
      yahooIndices,
      yahooEnergy,
      yahooMetals,
      yahooCommodities,
      yahooForex,
      yahooCrypto,
      yahooEtfs,
      // Merged categories for search UI
      worldIndices,
      energy,
      metals,
      commodities,
      forex,
      crypto,
    });
  } catch (err) {
    console.error('[Yahoo Instruments Error]:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
