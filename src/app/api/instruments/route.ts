import { NextResponse } from 'next/server';
import { fetchAllInstruments } from '@/lib/tse-api';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

interface InstrumentItem {
  l18: string;
  l30: string;
  pl: number;
  pcp: number;
  tno: number;
  tvol: number;
  tval: number;
  cs: string;
  category: string;
  index?: number;
  indexChange?: number;
  indexChangePercent?: number;
  indexMin?: number;
  indexMax?: number;
}

export async function GET() {
  try {
    const data = await fetchAllInstruments();

    const toItem = (
      s: { l18: string; l30?: string; pl: number; pcp: number; tno: number; tvol: number; tval: number; cs?: string },
      category: string,
    ): InstrumentItem => ({
      l18: s.l18,
      l30: s.l30 || '',
      pl: s.pl,
      pcp: s.pcp,
      tno: s.tno,
      tvol: s.tvol,
      tval: s.tval,
      cs: s.cs || '',
      category,
    });

    const stocks = data.stocks.map((s) => toItem(s, 'stock'));
    const etfs = data.etfs.map((s) => toItem(s, 'etf'));
    const bonds = data.bonds.map((s) => toItem(s, 'bond'));
    const futures = data.futures.map((s) => toItem(s, 'future'));
    const salaf = data.salaf.map((s) => toItem(s, 'salaf'));
    const mortgage = data.mortgage.map((s) => toItem(s, 'mortgage'));

    const indices: InstrumentItem[] = data.indices.map((idx) => ({
      l18: idx.name,
      l30: '',
      pl: idx.index,
      pcp: idx.index_change_percent,
      tno: 0,
      tvol: 0,
      tval: 0,
      cs: '',
      category: 'index',
      index: idx.index,
      indexChange: idx.index_change,
      indexChangePercent: idx.index_change_percent,
      indexMin: idx.min,
      indexMax: idx.max,
    }));

    return NextResponse.json({
      indices,
      stocks,
      etfs,
      bonds,
      futures,
      salaf,
      mortgage,
      industries: data.industries,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
