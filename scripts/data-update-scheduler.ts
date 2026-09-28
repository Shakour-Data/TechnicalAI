/**
 * Data Update Scheduler
 * Runs every 115 minutes to refresh all price data and update analyses
 * 
 * Usage: npx tsx scripts/data-update-scheduler.ts --once OR --daemon
 * 
 * Cron expression for 115 minutes (cron: every 115th minute)
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setInterval, clearInterval } from 'node:timers';

const DB_DIR = join(process.cwd(), 'db');
const UPDATE_LOG = join(DB_DIR, 'data-update.log');
const UPDATE_INTERVAL_MS = 115 * 60 * 1000; // 115 minutes

interface UpdateResult {
  source: string;
  success: boolean;
  items: number;
  error?: string;
  durationMs: number;
  timestamp: string;
}

interface UpdateStatus {
  lastRun: string;
  nextRun: string;
  totalUpdates: number;
  successCount: number;
  failCount: number;
  isRunning: boolean;
}

const STATUS_FILE = join(DB_DIR, 'data-update-status.json');

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  const logPath = join(DB_DIR, 'data-update.log');
  try {
    if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
    writeFileSync(logPath, logLine, { flag: 'a' });
  } catch {}
  if (process.env.DEBUG === 'true') console.log(message);
}

async function updateTseStocks(): Promise<UpdateResult> {
  const start = Date.now();
  try {
    const { fetchAllInstruments } = await import('../src/lib/tse-api');
    const instruments = await fetchAllInstruments();
    
    let updated = 0;
    for (const stock of instruments.stocks) {
      const symbolsPath = join(DB_DIR, `symbols-type-1.json`);
      const data = JSON.parse(readFileSync(symbolsPath, 'utf-8'));
      const existing = data.data?.find((s: any) => s.l18 === stock.l18);
      if (existing) {
        data.data[data.data.indexOf(existing)] = { ...stock, time: Date.now() };
        writeFileSync(symbolsPath, JSON.stringify(data, null, 2));
        updated++;
      }
    }
    
    return {
      source: 'TSE Stocks',
      success: true,
      items: updated,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      source: 'TSE Stocks',
      success: false,
      items: 0,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  }
}

async function updateIndices(): Promise<UpdateResult> {
  const start = Date.now();
  try {
    const { fetchAllInstruments, fetchIndices } = await import('../src/lib/tse-api');
    const { fetchMainIndexHistory, fetchSectorIndexHistory } = await import('../src/lib/tsetmc-index-api');
    
    let updated = 0;
    
    // Update main indices
    const mainIndexKeys = ['CWI', 'EWI', 'CWPI', 'EWPI', 'FFI', 'MKT1I', 'MKT2I', 'INDI', 'ACT50', 'LCI30'];
    for (const key of mainIndexKeys) {
      try {
        const candles = await fetchMainIndexHistory(key);
        if (candles.length > 0) {
          const filePath = join(DB_DIR, `index-idx_${key}.json`);
          writeFileSync(filePath, JSON.stringify({ data: candles, time: Date.now() }, null, 2));
          updated++;
        }
      } catch (e) {
        log(`  Failed to update main index ${key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    // Update sector indices
    const sectorIndices = [
      'زراعت', 'ذغال سنگ', 'کانی فلزی', 'سایر معادن', 'منسوجات',
      'محصولات چرمی', 'محصولات چوبی', 'محصولات کاغذی', 'انتشار و چاپ',
      'فرآورده های نفتی', 'لاستیک', 'فلزات اساسی', 'محصولات فلزی',
      'ماشین آلات', 'دستگاه های برقی', 'وسایل ارتباطی', 'خودرو',
      'قند و شکر', 'چند رشته ای', 'تامین آب، برق و گاز', 'غذایی',
      'دارویی', 'شیمیایی', 'خرده فروشی', 'کاشی و سرامیک', 'سیمان',
      'کانی غیر فلزی', 'سرمایه گذاری', 'بانک', 'سایر مالی',
      'حمل و نقل', 'رادیویی', 'مالی', 'اداره بازارهای مالی',
      'انبوه سازی', 'رایانه', 'اطلاعات و ارتباطات', 'فنی مهندسی',
      'استخراج نفت', 'بیمه و بازنشستگی'
    ];
    
    const webIds: Record<string, string> = {
      'زراعت': '34408080767216529', 'ذغال سنگ': '19219679288446732',
      'کانی فلزی': '13235969998952202', 'سایر معادن': '62691002126902464',
      'منسوجات': '59288237226302898', 'محصولات چرمی': '69306841376553334',
      'محصولات چوبی': '58440550086834602', 'محصولات کاغذی': '30106839080444358',
      'انتشار و چاپ': '25766336681098389', 'فرآورده های نفتی': '12331083953323969',
      'لاستیک': '36469751685735891', 'فلزات اساسی': '32453344048876642',
      'محصولات فلزی': '1123534346391630', 'ماشین آلات': '11451389074113298',
      'دستگاه های برقی': '33878047680249697', 'وسایل ارتباطی': '24733701189547084',
      'خودرو': '20213770409093165', 'قند و شکر': '21948907150049163',
      'چند رشته ای': '40355846462826897', 'تامین آب، برق و گاز': '54843635503648458',
      'غذایی': '15508900928481581', 'دارویی': '3615666621538524',
      'شیمیایی': '33626672012415176', 'خرده فروشی': '65986638607018835',
      'کاشی و سرامیک': '57616105980228781', 'سیمان': '70077233737515808',
      'کانی غیر فلزی': '14651627750314021', 'سرمایه گذاری': '34295935482222451',
      'بانک': '72002976013856737', 'سایر مالی': '25163959460949732',
      'حمل و نقل': '24187097921483699', 'رادیویی': '41867092385281437',
      'مالی': '61247168213690670', 'اداره بازارهای مالی': '61985386521682984',
      'انبوه سازی': '4654922806626448', 'رایانه': '8900726085939949',
      'اطلاعات و ارتباطات': '18780171241610744', 'فنی مهندسی': '47233872677452574',
      'استخراج نفت': '65675836323214668', 'بیمه و بازنشستگی': '59105676994811497'
    };
    
    for (const sectorName of sectorIndices) {
      const webId = webIds[sectorName];
      if (!webId) continue;
      try {
        const candles = await fetchSectorIndexHistory(webId);
        if (candles.length > 0) {
          const safeName = sectorName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
          
          // Save by sector name (sec-${name}.json)
          const filePath = join(DB_DIR, `sec-${sectorName}.json`);
          writeFileSync(filePath, JSON.stringify({ data: candles, time: Date.now() }, null, 2));
          
          // Also save by webId (index-sec_${webId}.json) — this is what tsetmc-index-api reads
          const webIdFilePath = join(DB_DIR, `index-sec_${webId}.json`);
          writeFileSync(webIdFilePath, JSON.stringify({ data: candles, time: Date.now() }, null, 2));
          
          // Also save as index-${safeName}.json for compatibility
          const indexFilePath = join(DB_DIR, `index-${safeName}.json`);
          writeFileSync(indexFilePath, JSON.stringify({ data: candles, time: Date.now() }, null, 2));
          
          updated++;
        }
      } catch (e) {
        log(`  Failed to update sector ${sectorName}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    // Also update main indices with webId-based files for full compatibility
    const mainIndexWebIds: Record<string, string> = {
      'CWI': '32097828799138957', 'EWI': '67130298613737946',
      'CWPI': '5798407779416661', 'EWPI': '8384385859414435',
      'FFI': '49579049405614711', 'MKT1I': '62752761908615603',
      'MKT2I': '71704845530629737', 'INDI': '43754960038275285',
      'ACT50': '46342955726788357', 'LCI30': '10523825119011581'
    };
    
    for (const key of mainIndexKeys) {
      try {
        const candles = await fetchMainIndexHistory(key);
        if (candles.length > 0) {
          // Primary file (index-idx_${key}.json)
          const filePath = join(DB_DIR, `index-idx_${key}.json`);
          writeFileSync(filePath, JSON.stringify({ data: candles, time: Date.now() }, null, 2));
          
          // WebId-based file (index-${webId}.json) for tsetmc-index-api compatibility
          const webId = mainIndexWebIds[key];
          if (webId) {
            const webIdFilePath = join(DB_DIR, `index-${webId}.json`);
            writeFileSync(webIdFilePath, JSON.stringify({ data: candles, time: Date.now() }, null, 2));
          }
          
          updated++;
        }
      } catch (e) {
        log(`  Failed to update main index ${key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    return {
      source: 'Indices',
      success: true,
      items: updated,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      source: 'Indices',
      success: false,
      items: 0,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  }
}

async function updateTgjuData(): Promise<UpdateResult> {
  const start = Date.now();
  try {
    const { fetchTgjuInstruments } = await import('../src/lib/tgju-api');
    const instruments = await fetchTgjuInstruments();
    
    // Update currency/gold files
    const currencyPath = join(DB_DIR, 'currency.json');
    if (instruments.length > 0) {
      const data = instruments.filter(i => i.category === 'currency' || i.category === 'gold' || i.category === 'silver');
      if (data.length > 0) {
        writeFileSync(currencyPath, JSON.stringify({ data, time: Date.now() }, null, 2));
      }
    }
    
    return {
      source: 'TGJU',
      success: true,
      items: instruments.length,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      source: 'TGJU',
      success: false,
      items: 0,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  }
}

async function updateYahooData(): Promise<UpdateResult> {
   const start = Date.now();
   try {
     const yahooFinance = (await import('yahoo-finance2')).default;
     const yf = new yahooFinance({ suppressNotices: ['yahooSurvey'] });
     
     // Fetch quotes for key global symbols
     const keySymbols = ['BTC-USD', 'ETH-USD', 'GC=F', 'CL=F', 'EURUSD=X', '^GSPC', '^NDX'];
     const quotes = await yf.quote(keySymbols);
     
     // Save Yahoo quotes data
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
     writeFileSync(join(DB_DIR, 'yahoo-quotes.json'), JSON.stringify(yahooData, null, 2));
     
     return {
       source: 'Yahoo Finance',
       success: true,
       items: quotes.length,
       durationMs: Date.now() - start,
       timestamp: new Date().toISOString()
     };
   } catch (error) {
     return {
       source: 'Yahoo Finance',
       success: false,
       items: 0,
       error: error instanceof Error ? error.message : String(error),
       durationMs: Date.now() - start,
       timestamp: new Date().toISOString()
     };
   }
 }

async function runAnalysisForSymbol(symbol: string): Promise<UpdateResult> {
  const start = Date.now();
  try {
    const { default: yahooFinance } = await import('yahoo-finance2');
    const yf = new yahooFinance({ suppressNotices: ['yahooSurvey'] });
    
    const quote = await yf.quote(symbol);
    const candles = await yf.chart(symbol, {
      period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      interval: '1d'
    });
    
    if (!candles.quotes || candles.quotes.length === 0) {
      return {
        source: `Analysis[${symbol}]`,
        success: false,
        items: 0,
        error: 'No data returned',
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString()
      };
    }
    
    const analysisPath = join(DB_DIR, `analysis-${symbol}.json`);
    writeFileSync(analysisPath, JSON.stringify({
      symbol,
      data: candles.quotes,
      lastPrice: quote?.regularMarketPrice || 0,
      updated: Date.now(),
      source: 'real-time'
    }, null, 2));
    
    return {
      source: `Analysis[${symbol}]`,
      success: true,
      items: 1,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      source: `Analysis[${symbol}]`,
      success: false,
      items: 0,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  }
}

async function runAllAnalyses(): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  
  try {
    const tseApi = await import('../src/lib/tse-api');
    const instruments = await tseApi.fetchAllInstruments();
    
    // Get top 50 most traded stocks for analysis
    const symbols = [...instruments.stocks]
      .sort((a, b) => (b.tval || 0) - (a.tval || 0))
      .slice(0, 50)
      .map(s => s.l18);
    
    for (const symbol of symbols) {
      const result = await runAnalysisForSymbol(symbol);
      results.push(result);
      await new Promise(r => setTimeout(r, 2000)); // Rate limit
    }
  } catch (error) {
    log(`Failed to run analyses: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return results;
}

function loadStatus(): UpdateStatus {
  try {
    const data = readFileSync(STATUS_FILE, 'utf-8');
    return JSON.parse(data) as UpdateStatus;
  } catch {
    return {
      lastRun: '',
      nextRun: '',
      totalUpdates: 0,
      successCount: 0,
      failCount: 0,
      isRunning: false
    };
  }
}

function saveStatus(status: UpdateStatus) {
  try {
    writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf-8');
  } catch {}
}

async function runFullUpdate(): Promise<void> {
  log('=== Starting full data update cycle ===');
  
  const status = loadStatus();
  status.isRunning = true;
  status.lastRun = new Date().toISOString();
  status.nextRun = new Date(Date.now() + UPDATE_INTERVAL_MS).toISOString();
  
  const allResults: UpdateResult[] = [];
  
  // Update TSE stocks
  log('Updating TSE stocks...');
  const tseResult = await updateTseStocks();
  allResults.push(tseResult);
  
  // Update indices
  log('Updating indices...');
  const indexResult = await updateIndices();
  allResults.push(indexResult);
  
  // Update TGJU data
  log('Updating TGJU data...');
  const tgjuResult = await updateTgjuData();
  allResults.push(tgjuResult);
  
  // Update Yahoo data (for global instruments)
  log('Updating Yahoo Finance data...');
  const yahooResult = await updateYahooData();
  allResults.push(yahooResult);
  
  // Run analyses
  log('Running analyses for top symbols...');
  const analysisResults = await runAllAnalyses();
  allResults.push(...analysisResults);
  
  // Update status
  for (const result of allResults) {
    status.totalUpdates++;
    if (result.success) {
      status.successCount++;
      log(`✓ ${result.source}: ${result.items} items in ${result.durationMs}ms`);
    } else {
      status.failCount++;
      log(`✗ ${result.source}: ${result.error}`);
    }
  }
  
  status.isRunning = false;
  saveStatus(status);
  
  const duration = allResults.reduce((sum, r) => sum + r.durationMs, 0);
  log(`=== Update cycle complete: ${status.successCount} successful, ${status.failCount} failed, total ${duration}ms ===\n`);
}

async function runDaemon(): Promise<void> {
  log('=== Data Update Scheduler Started ===');
  log(`Update interval: ${UPDATE_INTERVAL_MS / 1000 / 60} minutes`);
  
  const status = loadStatus();
  status.isRunning = false;
  saveStatus(status);
  
  // Run immediately on start
  await runFullUpdate();
  
  // Schedule periodic updates
  let timer: NodeJS.Timeout;
  let remaining = UPDATE_INTERVAL_MS;
  const startTime = Date.now();
  
  timer = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    const nextUpdate = startTime + UPDATE_INTERVAL_MS;
    
    if (elapsed >= UPDATE_INTERVAL_MS) {
      await runFullUpdate();
    }
  }, UPDATE_INTERVAL_MS) as unknown as NodeJS.Timeout;
  
  process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down...');
    clearInterval(timer);
  });
  
  process.on('SIGINT', () => {
    log('Received SIGINT, shutting down...');
    clearInterval(timer);
  });
}

async function runOnce(): Promise<void> {
  log('=== Running single data update ===');
  await runFullUpdate();
  log('=== Update complete ===');
}

function printUsage() {
  console.log(`
Data Update Scheduler - Updates all price data every 115 minutes

Usage:
  npx tsx scripts/data-update-scheduler.ts --once    Run single update
  npx tsx scripts/data-update-scheduler.ts --daemon   Run as daemon (continuous updates)

Cron (every 115 minutes):
  */115 * * * * cd /path/to/project && npx tsx scripts/data-update-scheduler.ts --once

Options:
  --once    Run a single update and exit
  --daemon  Run continuously with 115-minute intervals
  --help    Show this help message
`);
}

// Main entry point
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

if (args.includes('--once')) {
  runOnce().catch(error => {
    log(`Error: ${error}`);
    process.exit(1);
  });
} else if (args.includes('--daemon')) {
  runDaemon().catch(error => {
    log(`Error: ${error}`);
    process.exit(1);
  });
} else {
  // Default: run once
  printUsage();
  console.log('\nDefaulting to --once mode. Run with --daemon for continuous updates.\n');
  runOnce().catch(error => {
    log(`Error: ${error}`);
    process.exit(1);
  });
}