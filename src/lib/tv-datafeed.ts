// ═══════════════════════════════════════════════════════════════════════════════
// TradingView Widget — Custom Datafeed (in-memory, no API endpoint needed)
// Implements Datafeed interface for the TradingView Advanced Chart Widget
// Reads candle data from window.__TV_DATA__
// ═══════════════════════════════════════════════════════════════════════════════

export interface TVBar {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TVDataConfig {
  symbol: string;
  name: string;
  candles: TVBar[];
  supports: number[];
  resistances: number[];
  ma21: number;
  ma100: number;
  scenarios: Record<string, { targetMin: number; targetMax: number; name: string; probability: number; color: string }>;
}

// ── Types for TradingView Datafeed interface ─────────────────────────────────

interface DatafeedConfiguration {
  supports_search?: boolean;
  supports_group_request?: boolean;
  supports_marks?: boolean;
  supports_timescale_marks?: boolean;
  supports_time?: boolean;
  exchanges?: { value: string; name: string; desc: string }[];
  symbols_types?: { value: string; name: string; }[];
  supported_resolutions?: string[];
}

interface SearchSymbolResult {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  type: string;
}

interface ResolutionInfo {
  name: string;
  description: string;
  in_seconds: number;
  type?: string;
}

interface HistoryMetadata {
  noData?: boolean;
  nextTime?: number;
}

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface LibrarySymbolInfo {
  name: string;
  full_name: string;
  description: string;
  ticker: string;
  exchange: string;
  type: string;
  session: string;
  timezone: string;
  format: 'price';
  pricescale: number;
  minmov: number;
  has_empty_bars: boolean;
  has_intraday: boolean;
  has_daily: boolean;
  has_weekly_and_monthly: boolean;
  has_seconds: boolean;
  volume_precision: number;
  data_status: 'streaming' | 'pulsed' | 'endofday';
  supported_resolutions: string[];
  visible_plots_set: 'ohlcv';
}

type ResolveCallback = (symbolInfo: LibrarySymbolInfo) => void;
type ErrorCallback = (reason: string) => void;
type HistoryCallback = (bars: Bar[], meta: HistoryMetadata) => void;
type SearchSymbolsCallback = (items: SearchSymbolResult[]) => void;
type ResolveSymbolCallback = (symbolInfo: LibrarySymbolInfo) => void;
type GetServerTimeCallback = (serverTime: number) => void;

// ── Helper: Gregorian to Jalali for tick marks ──────────────────────────────

const PERSIAN_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
function toFa(n: number): string {
  return String(n).replace(/[0-9]/g, d => PERSIAN_DIGITS[parseInt(d)]);
}

function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
    + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
   if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  let jm: number, jd: number;
  if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + days % 31; }
  else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + (days - 186) % 30; }
  return { jy, jm, jd };
}

function shamsiFormat(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const { jy, jm, jd } = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${toFa(jy)}/${String(jm).padStart(2, '0').replace(/[0-9]/g, d => PERSIAN_DIGITS[parseInt(d)])}/${String(jd).padStart(2, '0').replace(/[0-9]/g, d => PERSIAN_DIGITS[parseInt(d)])}`;
}

// ── Custom Datafeed ──────────────────────────────────────────────────────────

export class TVMemoryDatafeed {
  private config: TVDataConfig | null = null;
  private _onReadyCallback: (() => void) | null = null;

  private getConfig(): TVDataConfig | null {
    if (this.config) return this.config;
    if (typeof window !== 'undefined' && (window as unknown as Record<string, TVDataConfig>).__TV_DATA__) {
      this.config = (window as unknown as Record<string, TVDataConfig>).__TV_DATA__;
    }
    return this.config;
  }

  onReady(callback: () => void): void {
    this._onReadyCallback = callback;
    // Call immediately since we have in-memory data
    setTimeout(() => callback(), 0);
  }

  searchSymbols(_userInput: string, _exchange: string, _type: string, _onResult: SearchSymbolsCallback): void {
    const cfg = this.getConfig();
    if (!cfg) { _onResult([]); return; }
    _onResult([{
      symbol: cfg.symbol,
      full_name: cfg.name,
      description: cfg.name,
      exchange: 'TSE',
      type: 'stock',
    }]);
  }

  resolveSymbol(symbolName: string, onResolve: ResolveSymbolCallback, onError: ErrorCallback): void {
    const cfg = this.getConfig();
    if (!cfg || cfg.candles.length === 0) {
      onError('Symbol not found');
      return;
    }

    const lastPrice = cfg.candles[cfg.candles.length - 1].close;
    const decimals = lastPrice > 10000 ? 0 : lastPrice > 100 ? 1 : 2;

    onResolve({
      name: symbolName,
      full_name: cfg.name,
      description: cfg.name,
      ticker: symbolName,
      exchange: 'TSE',
      type: 'stock',
      session: '09:00-12:30',
      timezone: 'Asia/Tehran',
      format: 'price',
      pricescale: Math.pow(10, decimals),
      minmov: 1,
      has_empty_bars: false,
      has_intraday: false,
      has_daily: true,
      has_weekly_and_monthly: true,
      has_seconds: false,
      volume_precision: 0,
      data_status: 'endofday',
      supported_resolutions: ['1D', '1W', '1M'],
      visible_plots_set: 'ohlcv',
    });
  }

  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    rangeStartDate: number,
    rangeEndDate: number,
    onHistoryCallback: HistoryCallback,
    onErrorCallback: ErrorCallback,
  ): void {
    const cfg = this.getConfig();
    if (!cfg || cfg.candles.length === 0) {
      onHistoryCallback([], { noData: true });
      return;
    }

    let filtered = cfg.candles.filter(
      b => b.time >= rangeStartDate && b.time <= rangeEndDate
    );

    // If no bars in range, return the last N bars
    if (filtered.length === 0) {
      filtered = cfg.candles.slice(-500);
    }

    // Resample based on resolution
    let bars: Bar[];
    if (resolution === '1W') {
      bars = this.resampleWeekly(filtered);
    } else if (resolution === '1M') {
      bars = this.resampleMonthly(filtered);
    } else {
      bars = filtered.map(b => ({
        time: b.time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      }));
    }

    if (bars.length === 0) {
      onHistoryCallback([], { noData: true });
      return;
    }

    onHistoryCallback(bars, { noData: false });
  }

  private resampleWeekly(bars: TVBar[]): Bar[] {
    const weeks: Map<string, TVBar[]> = new Map();
    for (const b of bars) {
      const d = new Date(b.time * 1000);
      // Week key: year-weekNumber
      const oneJan = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-${weekNum}`;
      if (!weeks.has(key)) weeks.set(key, []);
      weeks.get(key)!.push(b);
    }
    const result: Bar[] = [];
    for (const [, weekBars] of weeks) {
      result.push({
        time: weekBars[0].time,
        open: weekBars[0].open,
        high: Math.max(...weekBars.map(b => b.high)),
        low: Math.min(...weekBars.map(b => b.low)),
        close: weekBars[weekBars.length - 1].close,
        volume: weekBars.reduce((s, b) => s + b.volume, 0),
      });
    }
    return result;
  }

  private resampleMonthly(bars: TVBar[]): Bar[] {
    const months: Map<string, TVBar[]> = new Map();
    for (const b of bars) {
      const d = new Date(b.time * 1000);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!months.has(key)) months.set(key, []);
      months.get(key)!.push(b);
    }
    const result: Bar[] = [];
    for (const [, monthBars] of months) {
      result.push({
        time: monthBars[0].time,
        open: monthBars[0].open,
        high: Math.max(...monthBars.map(b => b.high)),
        low: Math.min(...monthBars.map(b => b.low)),
        close: monthBars[monthBars.length - 1].close,
        volume: monthBars.reduce((s, b) => s + b.volume, 0),
      });
    }
    return result;
  }

  subscribeBars(
    _symbolInfo: LibrarySymbolInfo,
    _resolution: string,
    _onTick: (bar: Bar) => void,
    _listenerGuid: string,
    _onResetCacheNeededCallback: () => void,
  ): void {
    // No real-time data in our use case
  }

  unsubscribeBars(_listenerGuid: string): void {
    // No-op
  }

  getServerTime(callback: GetServerTimeCallback): void {
    callback(Math.floor(Date.now() / 1000));
  }
}

// ── Expose shamsiFormat for use in widget config ─────────────────────────────
export { shamsiFormat };
