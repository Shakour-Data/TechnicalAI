import { NextResponse } from 'next/server';
import { fetchTgjuInstruments, getTgjuYahooFallback, TGJU_TO_YAHOO_MAP } from '@/lib/tgju-api';
import { detectDecimals, getCurrencyUnit } from '@/lib/format-price';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET() {
  try {
    const instruments = await fetchTgjuInstruments();

    const toItem = (i: { title: string; key: string; price: number; highPrice: number; lowPrice: number; change: number; changePercent: number; category: string; groupTitle?: string }) => {
      const yahooFallback = getTgjuYahooFallback(i.key);
      // Use Yahoo formatting for instruments that are mapped to Yahoo
      const source = yahooFallback ? 'yahoo' : 'tgju';
      const decimals = detectDecimals(i.price, i.category, source);
      const currencyUnit = yahooFallback
        ? getCurrencyUnit(i.category, 'yahoo')
        : getCurrencyUnit(i.category, 'tgju');

      const item: Record<string, unknown> = {
        l18: i.title,
        l30: i.groupTitle || '',
        pl: i.price,
        pcp: i.changePercent,
        tno: 0,
        tvol: 0,
        tval: 0,
        cs: i.groupTitle || '',
        category: i.category,
        tgjuKey: i.key,
        decimals,
        currencyUnit,
      };

      // Add yahooFallbackSymbol for instruments that have Yahoo mapping
      // This tells the frontend to use Yahoo analysis instead of TGJU
      if (yahooFallback) {
        item.yahooFallbackSymbol = yahooFallback;
      }

      return item;
    };

    // Group by category
    const currencies = instruments.filter((i) => i.category === 'currency').map(toItem);
    const gold = instruments.filter((i) => i.category === 'gold').map(toItem);
    const silver = instruments.filter((i) => i.category === 'silver').map(toItem);
    const goldEtfs = instruments.filter((i) => i.category === 'gold_etf').map(toItem);
    const crypto = instruments.filter((i) => i.category === 'crypto').map(toItem);
    const worldIndices = instruments.filter((i) => i.category === 'world_index').map(toItem);
    const foreignStocks = instruments.filter((i) => i.category === 'foreign_stock').map(toItem);
    const forex = instruments.filter((i) => i.category === 'forex').map(toItem);
    const energy = instruments.filter((i) => i.category === 'energy').map(toItem);
    const metals = instruments.filter((i) => i.category === 'metal').map(toItem);
    const commodities = instruments.filter((i) => i.category === 'commodity').map(toItem);
    const items = instruments.map(toItem);

    return NextResponse.json({
      currencies,
      gold,
      silver,
      goldEtfs,
      crypto,
      worldIndices,
      foreignStocks,
      forex,
      energy,
      metals,
      commodities,
      items,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
