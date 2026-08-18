import { NextResponse } from 'next/server';
import { fetchAllInstruments, fetchTsetmcInstruments } from '@/lib/tse-api';
import { INDUSTRY_INDICES } from '@/lib/industry-indices';

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
  insCode?: string;
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

    // Try to fetch TSETMC indices (111+ industry indices) — non-blocking, 2s timeout
    const tsetmcIndicesPromise = fetchTsetmcInstruments();

    const stocks = data.stocks.map((s) => toItem(s, 'stock'));
    const etfs = data.etfs.map((s) => toItem(s, 'etf'));
    const bonds = data.bonds.map((s) => toItem(s, 'bond'));
    const futures = data.futures.map((s) => toItem(s, 'future'));
    const salaf = data.salaf.map((s) => toItem(s, 'salaf'));
    const mortgage = data.mortgage.map((s) => toItem(s, 'mortgage'));

    // Get TSETMC indices (may have already resolved in parallel)
    const tsetmcIndices = await tsetmcIndicesPromise;

    let indices: InstrumentItem[];
    let existingSymbols = new Set<string>();

    if (tsetmcIndices && tsetmcIndices.length > 0) {
      // Use TSETMC indices — they include industry indices with insCode for historical data
      indices = tsetmcIndices.map((idx) => {
        existingSymbols.add(idx.symbol);
        return {
          l18: idx.symbol,
          l30: idx.name,
          pl: 0,
          pcp: 0,
          tno: 0,
          tvol: 0,
          tval: 0,
          cs: idx.group || '',
          category: 'index',
          insCode: idx.insCode,
        };
      });

      // Merge real-time values from BrsApi indices where names match
      for (const brsIdx of data.indices) {
        const match = indices.find(
          (t) => t.l18 === brsIdx.name || t.l30 === brsIdx.name,
        );
        if (match) {
          match.pl = brsIdx.index;
          match.pcp = brsIdx.index_change_percent;
          match.index = brsIdx.index;
          match.indexChange = brsIdx.index_change;
          match.indexChangePercent = brsIdx.index_change_percent;
          match.indexMin = brsIdx.min;
          match.indexMax = brsIdx.max;
        }
      }
    } else {
      // Fallback to BrsApi 7 indices (no insCode = no historical TA)
      indices = data.indices.map((idx) => {
        existingSymbols.add(idx.name);
        return {
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
        };
      });
    }

    // ── Add finpy-tse industry indices not already in the list ──
    for (const idx of INDUSTRY_INDICES) {
      if (!existingSymbols.has(idx.symbol)) {
        indices.push({
          l18: idx.symbol,
          l30: idx.name,
          pl: 0,
          pcp: 0,
          tno: 0,
          tvol: 0,
          tval: 0,
          cs: idx.group,
          category: 'index',
          insCode: idx.insCode,
        });
      }
    }

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
