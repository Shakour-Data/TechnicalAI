import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fetchAllInstruments, fetchTsetmcInstruments } from '@/lib/tse-api';
import { INDUSTRY_INDICES } from '@/lib/industry-indices';
import { detectDecimals, getCurrencyUnit } from '@/lib/format-price';

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
  finpySector?: string;
  finpyIndex?: string;
  webId?: string | number;
  isMainIndex?: boolean;
  index?: number;
  indexChange?: number;
  indexChangePercent?: number;
  indexMin?: number;
  indexMax?: number;
  decimals: number;
  currencyUnit: string;
}

interface SectorPrice {
  sector: string;
  close: number;
  pcp: number;
  date: string;
}

/**
 * Load sector latest prices from file cache (fallback when service is down)
 */
function loadSectorPricesFromFile(): Map<string, SectorPrice> {
  const map = new Map<string, SectorPrice>();
  try {
    const filePath = join(process.cwd(), 'db', 'sector-latest.json');
    if (!existsSync(filePath)) return map;
    const raw = readFileSync(filePath, 'utf-8');
    const entry = JSON.parse(raw);
    const data = entry.data || entry;
    for (const [sectorName, info] of Object.entries(data)) {
      const item = info as Record<string, unknown>;
      if (item.close && item.close > 0) {
        map.set(sectorName, {
          sector: sectorName,
          close: item.close as number,
          pcp: item.pcp as number || 0,
          date: item.date as string || '',
        });
      }
    }
  } catch {
    // File not found or parse error
  }
  return map;
}

/**
 * Fetch sector live data from tsetmc-index-service (port 3032)
 * Returns null if service is unavailable
 */
async function fetchSectorLiveData(): Promise<Map<string, SectorPrice> | null> {
  try {
    const res = await fetch('/api/sector-live?XTransformPort=3032', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      sectors: Record<string, { close: number; pcp: number; date: string; webId: string }>;
      count: number;
    };
    if (!data.sectors || data.count === 0) return null;

    const map = new Map<string, SectorPrice>();
    for (const [sector, info] of Object.entries(data.sectors)) {
      if (info.close > 0) {
        map.set(sector, {
          sector,
          close: info.close,
          pcp: info.pcp || 0,
          date: info.date || '',
        });
      }
    }
    return map;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const data = await fetchAllInstruments();

    // ── Fetch sector live data from service (non-blocking, 5s timeout) ──
    const [sectorLivePromise] = [fetchSectorLiveData()];

    const toItem = (
      s: { l18: string; l30?: string; pl: number; pcp: number; tno: number; tvol: number; tval: number; cs?: string },
      category: string,
    ): InstrumentItem => {
      const decimals = detectDecimals(s.pl, category, 'tse');
      const currencyUnit = getCurrencyUnit(category, 'tse');
      return {
        l18: s.l18,
        l30: s.l30 || '',
        pl: s.pl,
        pcp: s.pcp,
        tno: s.tno,
        tvol: s.tvol,
        tval: s.tval,
        cs: s.cs || '',
        category,
        decimals,
        currencyUnit,
      };
    };

    // Try to fetch TSETMC indices — non-blocking, 2s timeout
    const tsetmcIndicesPromise = fetchTsetmcInstruments();

    const stocks = data.stocks.map((s) => toItem(s, 'stock'));
    const etfs = data.etfs.map((s) => toItem(s, 'etf'));
    const bonds = data.bonds.map((s) => toItem(s, 'bond'));
    const futures = data.futures.map((s) => toItem(s, 'future'));
    const salaf = data.salaf.map((s) => toItem(s, 'salaf'));
    const mortgage = data.mortgage.map((s) => toItem(s, 'mortgage'));

    const tsetmcIndices = await tsetmcIndicesPromise;
    const sectorPrices = await sectorLivePromise;

    // If service didn't return data, fall back to file cache
    const sectorPricesFinal = sectorPrices || loadSectorPricesFromFile();

    let indices: InstrumentItem[];
    const existingSymbols = new Set<string>();

    // Build lookup map from INDUSTRY_INDICES for merging metadata into TSETMC/BrsApi indices  
    const industryLookup = new Map<string, IndustryIndex>();
    for (const idx of INDUSTRY_INDICES) {
      industryLookup.set(idx.symbol, idx);
    }

    if (tsetmcIndices && tsetmcIndices.length > 0) {
      indices = tsetmcIndices.map((idx) => {
        existingSymbols.add(idx.symbol);
        const industryMatch = industryLookup.get(idx.symbol);
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
          // Merge metadata from INDUSTRY_INDICES so handleSelect can find data sources
          finpySector: industryMatch?.finpySector || undefined,
          finpyIndex: industryMatch?.finpyIndex || undefined,
          webId: industryMatch?.webId || undefined,
          isMainIndex: industryMatch?.isMainIndex || undefined,
        };
      });

      // Merge BrsApi real-time values for main indices
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
      indices = data.indices.map((idx) => {
        existingSymbols.add(idx.name);
        const industryMatch = industryLookup.get(idx.name);
        return {
          l18: idx.name,
          l30: industryMatch?.name || '',
          pl: idx.index,
          pcp: idx.index_change_percent,
          tno: 0,
          tvol: 0,
          tval: 0,
          cs: industryMatch?.group || '',
          category: 'index',
          index: idx.index,
          indexChange: idx.index_change,
          indexChangePercent: idx.index_change_percent,
          indexMin: idx.min,
          indexMax: idx.max,
          // Merge metadata from INDUSTRY_INDICES
          finpySector: industryMatch?.finpySector || undefined,
          finpyIndex: industryMatch?.finpyIndex || undefined,
          webId: industryMatch?.webId || undefined,
          isMainIndex: industryMatch?.isMainIndex || undefined,
        };
      });
    }

    // ── Add industry indices not already in the list ──
    for (const idx of INDUSTRY_INDICES) {
      if (!existingSymbols.has(idx.symbol)) {
        const sectorPrice = idx.finpySector ? sectorPricesFinal.get(idx.finpySector) : undefined;
        indices.push({
          l18: idx.symbol,
          l30: idx.name,
          pl: sectorPrice?.close || 0,
          pcp: sectorPrice?.pcp || 0,
          tno: 0,
          tvol: 0,
          tval: 0,
          cs: idx.group,
          category: 'index',
          finpySector: idx.finpySector || undefined,
          finpyIndex: idx.finpyIndex || undefined,
          webId: idx.webId || undefined,
          isMainIndex: idx.isMainIndex || undefined,
          index: sectorPrice?.close || undefined,
          indexChangePercent: sectorPrice?.pcp || undefined,
        });
      }
    }

    // ── Merge sector prices into TSETMC-sourced indices that have no price ──
    for (const item of indices) {
      if (item.finpySector && (!item.pl || item.pl === 0)) {
        const sp = sectorPricesFinal.get(item.finpySector);
        if (sp) {
          item.pl = sp.close;
          item.pcp = sp.pcp;
          item.index = sp.close;
          item.indexChangePercent = sp.pcp;
        }
      }
      // Set decimals and currencyUnit for all index items
      if (!item.decimals) item.decimals = detectDecimals(item.pl, 'index', 'tse');
      if (!item.currencyUnit) item.currencyUnit = getCurrencyUnit('index', 'tse');
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
