/**
 * Data Updater Service Module
 * Integrates with the Next.js application for automatic data refresh
 * 
 * Usage:
 * - Import from '@/lib/data-updater'
 * - Call scheduleUpdates() to start automatic updates
 * - Call forceUpdate() to trigger immediate update
 * - Call getUpdateStatus() to check current status
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DB_DIR = join(process.cwd(), 'db');
const STATUS_FILE = join(DB_DIR, 'data-update-status.json');
const UPDATE_INTERVAL_MS = 115 * 60 * 1000; // 115 minutes
const DATA_DIR = join(DB_DIR, 'realtime-data');

interface DataSource {
  name: string;
  lastUpdate: number | null;
  status: 'ok' | 'error' | 'never';
  itemCount: number;
  error?: string;
}

interface UpdateStatus {
  isRunning: boolean;
  lastRun: number | null;
  nextRun: number | null;
  sources: Record<string, DataSource>;
  totalUpdates: number;
  successCount: number;
  failCount: number;
}

function ensureDirs(): void {
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadStatus(): UpdateStatus {
  try {
    const data = readFileSync(STATUS_FILE, 'utf-8');
    return JSON.parse(data) as UpdateStatus;
  } catch {
    return {
      isRunning: false,
      lastRun: null,
      nextRun: null,
      sources: {},
      totalUpdates: 0,
      successCount: 0,
      failCount: 0
    };
  }
}

function saveStatus(status: UpdateStatus): void {
  try {
    ensureDirs();
    writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf-8');
  } catch {}
}

export async function forceUpdate(): Promise<UpdateStatus> {
  const status = loadStatus();
  status.isRunning = true;
  status.lastRun = Date.now();
  status.nextRun = Date.now() + UPDATE_INTERVAL_MS;
  saveStatus(status);

  try {
    // Import and fetch TSE stocks
    const tseApi = await import('../tse-api');
    const instruments = await tseApi.fetchAllInstruments();
    
    // Save updated symbols to realtime data
    const symbolsData = {
      stocks: instruments.stocks,
      etfs: instruments.etfs,
      indices: instruments.indices,
      goldEtfs: instruments.goldEtfs,
      bonds: instruments.bonds,
      futures: instruments.futures,
      salaf: instruments.salaf,
      mortgage: instruments.mortgage,
      updated: Date.now(),
      source: 'TSE'
    };
    writeFileSync(join(DATA_DIR, 'tse-instruments.json'), JSON.stringify(symbolsData, null, 2));
    
    status.sources['TSE'] = {
      name: 'TSE',
      lastUpdate: Date.now(),
      status: 'ok',
      itemCount: instruments.stocks.length
    };
    status.successCount++;
  } catch (error) {
    status.sources['TSE'] = {
      name: 'TSE',
      lastUpdate: null,
      status: 'error',
      itemCount: 0,
      error: error instanceof Error ? error.message : String(error)
    };
    status.failCount++;
  }

// Fetch TSE indices
   try {
     const tseIndexApi = await import('../tse-index-api');
     const mainIndexKeys = ['CWI', 'EWI', 'CWPI', 'EWPI', 'FFI', 'MKT1I', 'MKT2I', 'INDI', 'ACT50', 'LCI30'];
     
     for (const key of mainIndexKeys) {
       try {
         const candles = await tseIndexApi.fetchMainIndexHistory(key);
         if (candles.length > 0) {
           const filePath = join(DATA_DIR, `index-idx_${key}.json`);
           writeFileSync(filePath, JSON.stringify({ data: candles, time: Date.now() }, null, 2));
         }
       } catch {}
     }
     
     status.sources['Indices'] = {
       name: 'Indices',
       lastUpdate: Date.now(),
       status: 'ok',
       itemCount: mainIndexKeys.length
     };
     status.successCount++;
   } catch (error) {
     status.sources['Indices'] = {
       name: 'Indices',
       lastUpdate: null,
       status: 'error',
       itemCount: 0,
       error: error instanceof Error ? error.message : String(error)
     };
     status.failCount++;
   }

  // Fetch TGJU data
  try {
    const tgjuApi = await import('../tgju-api');
    const instruments = await tgjuApi.fetchTgjuInstruments();
    
    const tgjuData = {
      instruments: instruments.filter(i => i.category === 'currency' || i.category === 'gold' || i.category === 'silver'),
      allInstruments: instruments,
      updated: Date.now(),
      source: 'TGJU'
    };
    writeFileSync(join(DATA_DIR, 'tgju-instruments.json'), JSON.stringify(tgjuData, null, 2));
    
    status.sources['TGJU'] = {
      name: 'TGJU',
      lastUpdate: Date.now(),
      status: 'ok',
      itemCount: instruments.length
    };
    status.successCount++;
  } catch (error) {
    status.sources['TGJU'] = {
      name: 'TGJU',
      lastUpdate: null,
      status: 'error',
      itemCount: 0,
      error: error instanceof Error ? error.message : String(error)
    };
    status.failCount++;
  }

  // Fetch Yahoo Finance data
  try {
    const yahooFinance = (await import('yahoo-finance2')).default;
    const yf = new yahooFinance({ suppressNotices: ['yahooSurvey'] });
    
    // Fetch quotes for key symbols
    const keySymbols = ['BTC-USD', 'ETH-USD', 'GC=F', 'CL=F', 'EURUSD=X', '^GSPC', '^NDX'];
    const quotes = await yf.quote(keySymbols);
    
    const yahooData = {
      quotes: quotes.map((q: any) => ({
        symbol: q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePercent: q.regularMarketChangePercent,
        previousClose: q.regularMarketPreviousClose,
        dayHigh: q.regularMarketDayHigh,
        dayLow: q.regularMarketDayLow,
        volume: q.regularMarketVolume
      })),
      updated: Date.now(),
      source: 'Yahoo Finance'
    };
    writeFileSync(join(DATA_DIR, 'yahoo-quotes.json'), JSON.stringify(yahooData, null, 2));
    
    status.sources['Yahoo'] = {
      name: 'Yahoo Finance',
      lastUpdate: Date.now(),
      status: 'ok',
      itemCount: quotes.length
    };
    status.successCount++;
  } catch (error) {
    status.sources['Yahoo'] = {
      name: 'Yahoo Finance',
      lastUpdate: null,
      status: 'error',
      itemCount: 0,
      error: error instanceof Error ? error.message : String(error)
    };
    status.failCount++;
  }

  status.totalUpdates++;
  status.isRunning = false;
  saveStatus(status);
  
  return status;
}

export async function scheduleUpdates(): Promise<void> {
  const status = loadStatus();
  
  // Run immediately
  await forceUpdate();
  
  // Schedule periodic updates
  const runScheduledUpdate = async () => {
    try {
      await forceUpdate();
    } catch (error) {
      console.error('[DataUpdater] Scheduled update failed:', error);
    }
  };
  
  // Initial schedule
  const scheduleNext = () => {
    const now = Date.now();
    const elapsed = now - (status.lastRun || now);
    const timeUntilNext = Math.max(0, UPDATE_INTERVAL_MS - elapsed);
    
    setTimeout(async () => {
      await runScheduledUpdate();
      scheduleNext();
    }, timeUntilNext);
  };
  
  scheduleNext();
}

export function getUpdateStatus(): UpdateStatus {
  const status = loadStatus();
  status.nextRun = Date.now() + UPDATE_INTERVAL_MS;
  return status;
}

export async function initializeDataUpdater(): Promise<void> {
  ensureDirs();
  const status = loadStatus();
  
  if (!status.lastRun || (Date.now() - status.lastRun) > UPDATE_INTERVAL_MS) {
    console.log('[DataUpdater] Initial data fetch needed');
    await forceUpdate();
  }
}