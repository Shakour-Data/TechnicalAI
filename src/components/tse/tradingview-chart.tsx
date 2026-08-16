'use client';

import { useEffect, useRef, useState, useCallback, memo, useSyncExternalStore } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface CandleData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingViewChartProps {
  symbolName: string;
  candles: CandleData[];
  supports: number[];
  resistances: number[];
  ma21: number;
  ma100: number;
  scenarios: Record<string, { targetMin: number; targetMax: number; name: string; probability: number; color: string }>;
}

type TVWidget = Record<string, unknown>;

const getTV = () => {
  const w = window as unknown as { TradingView?: { widget: new (opts: Record<string, unknown>) => TVWidget } };
  return w.TradingView;
};

const toFa = (n: number) => Math.round(n).toLocaleString('fa-IR');

// ── External store for TV script load state ─────────────────────────
let tvScriptLoaded = false;
const tvListeners = new Set<() => void>();
function subscribeToTV(cb: () => void) { tvListeners.add(cb); return () => { tvListeners.delete(cb); }; }
function getTVSnapshot() { return tvScriptLoaded; }
function notifyTVLoaded() { tvScriptLoaded = true; tvListeners.forEach(l => l()); }

// ═══════════════════════════════════════════════════════════════════
// TradingView Chart Component
// ═══════════════════════════════════════════════════════════════════

const TradingViewChartInner = memo(function TradingViewChartInner({
  symbolName, candles, supports, resistances, ma21, ma100, scenarios,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TVWidget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tvReady = useSyncExternalStore(subscribeToTV, getTVSnapshot);
  const loading = !tvReady && !error;

  // ── Build datafeed ────────────────────────────────────────────────
  const buildDatafeed = useCallback(() => {
    const DAY = 86400;
    const now = Math.floor(Date.now() / 1000);
    const baseTime = now - candles.length * DAY;

    return {
      onReady: (cb: (cfg: Record<string, unknown>) => void) => {
        cb({
          supported_resolutions: ['D'],
          supports_marks: false,
          supports_timescale_marks: false,
          supports_time: true,
          exchanges: [{ value: 'TSE', name: 'TSE', desc: 'Tehran Stock Exchange' }],
          symbols_types: [{ name: 'stock', value: 'stock' }],
        });
      },

      resolveSymbol: (_name: string, onResolved: (s: Record<string, unknown>) => void) => {
        onResolved({
          name: symbolName,
          full_name: symbolName,
          ticker: 'TSE:' + symbolName,
          description: symbolName,
          type: 'stock',
          session: '24x7',
          timezone: 'Asia/Tehran',
          exchange: 'TSE',
          listed_exchange: 'TSE',
          minmov: 1,
          minmov2: 0,
          pricescale: 1,
          has_intraday: false,
          has_no_volume: false,
          has_daily: true,
          has_weekly: false,
          has_monthly: false,
          visible_plots_set: 'ohlc',
          volume_precision: 0,
          data_status: 'streaming',
        });
      },

      getBars(
        _si: unknown,
        _res: string,
        _from: number,
        _to: number,
        onHistory: (bars: Array<Record<string, number>>, meta: { noData: boolean }) => void,
        onErr: (e: unknown) => void,
      ) {
        try {
          const bars = candles.map((c, i) => ({
            time: baseTime + i * DAY,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          }));
          onHistory(bars, { noData: false });
        } catch (e) {
          onErr(e);
        }
      },

      subscribeBars: () => {},
      unsubscribeBars: () => {},
      getServerTime: (cb: (t: number) => void) => cb(Math.floor(Date.now() / 1000)),
    };
  }, [candles, symbolName]);

  // ── Widget initialization ──────────────────────────────────────────
  useEffect(() => {
    if (!tvReady) return;
    const container = containerRef.current;
    if (!container) return;

    if (widgetRef.current) {
      try { widgetRef.current.remove(); } catch { /* ignore */ }
      widgetRef.current = null;
    }

    const id = container.id || ('tv-w-' + Math.random().toString(36).slice(2, 8));
    container.id = id;

    try {
      const df = buildDatafeed();
      const DAY = 86400;
      const now = Math.floor(Date.now() / 1000);
      const baseTime = now - candles.length * DAY;
      const endTime = now;
      const tv = getTV();
      if (!tv) return;

      const widget = new tv.widget({
        container_id: id,
        datafeed: df,
        locale: 'fa_IR',
        disabled_features: ['header_symbol_search', 'symbol_search_hot_key', 'header_compare', 'use_localstorage_for_settings'],
        enabled_features: ['study_templates'],
        autosize: true,
        theme: 'dark',
        backgroundColor: '#0d1424',
        gridColor: 'rgba(255,255,255,0.04)',
        symbol: symbolName,
        interval: 'D',
        toolbar_bg: '#0d1424',
        allow_symbol_change: false,
        save_image: true,
        hide_side_toolbar: false,
        withdateranges: false,
        details: false,
        hotlist: false,
        calendar: false,
        studies: [
          { id: 'MA@tv-basicstudies', inputs: { length: 21, source: 'close' } },
          { id: 'MA@tv-basicstudies', inputs: { length: 100, source: 'close' } },
        ],
        overrides: {
          'mainSeriesProperties.candleStyle.upColor': '#34c98b',
          'mainSeriesProperties.candleStyle.downColor': '#ef4d62',
          'mainSeriesProperties.candleStyle.borderUpColor': '#34c98b',
          'mainSeriesProperties.candleStyle.borderDownColor': '#ef4d62',
          'mainSeriesProperties.candleStyle.wickUpColor': '#34c98b',
          'mainSeriesProperties.candleStyle.wickDownColor': '#ef4d62',
          'mainSeriesProperties.hollowCandles': false,
        },
        loading_screen: { backgroundColor: '#0d1424', foregroundColor: '#3ad5db' },
      });

      widgetRef.current = widget;

      widget.onChartReady(() => {
        try {
          const chart = widget.activeChart();
          const drawLine = (level: number, color: string, width: number, style: number) => {
            try {
              chart.createMultipointShape(
                [{ time: baseTime, price: level }, { time: endTime, price: level }],
                {
                  shape: 'trend_line',
                  overrides: { linecolor: color, linewidth: width, linestyle: style, showLabel: true, textcolor: color },
                  lock: true, disableSelection: true, disableSave: true, disableUndo: true,
                },
              );
            } catch { /* skip */ }
          };
          resistances.forEach(l => drawLine(l, '#ef4d62', 2, 2));
          supports.forEach(l => drawLine(l, '#34c98b', 2, 2));
          if (ma100 > 0) drawLine(ma100, '#a04ac5', 1, 0);
          const existing = [...resistances, ...supports];
          for (const s of Object.values(scenarios)) {
            [s.targetMin, s.targetMax].forEach(price => {
              if (!existing.some(l => l > 0 && Math.abs(l - price) / l < 0.005)) {
                drawLine(price, s.color, 1, 1);
              }
            });
          }
        } catch { /* Chart API might not support shape creation */ }
      });
    } catch {
      /* Widget creation failed silently */
    }

    return () => {
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch { /* ignore */ }
        widgetRef.current = null;
      }
    };
  }, [tvReady, buildDatafeed, symbolName, candles, resistances, supports, ma100, scenarios]);

  // ── Load TV script once ───────────────────────────────────────────
  useEffect(() => {
    if (tvScriptLoaded || document.querySelector('script[src*="s3.tradingview.com/tv.js"]')) return;
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => notifyTVLoaded();
    script.onerror = () => setError('خطا در اتصال به سرور TradingView');
    document.head.appendChild(script);
  }, []);

  return (
    <div dir="ltr" className="relative w-full rounded-2xl overflow-hidden border border-white/6 bg-[#0d1424]" style={{ height: 550 }}>
      <div ref={containerRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1424]/90 z-10 gap-3">
          <svg className="animate-spin h-8 w-8 text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-gray-400">در حال بارگذاری نمودار TradingView ...</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1424]/95 z-10 gap-3 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-red-400 text-sm font-medium">{error}</p>
          <p className="text-gray-500 text-xs max-w-sm">نمودار کندل‌استیک در تب نمودار نیز در دسترس است.</p>
        </div>
      )}

      {!loading && !error && (
        <div dir="rtl" className="absolute top-2 right-2 z-10 flex flex-wrap gap-1.5 pointer-events-none">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">مقاومت</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">حمایت</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">MA100</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">MA21</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">هدف قیمتی</span>
        </div>
      )}
    </div>
  );
});

export default TradingViewChartInner;

export function TradingViewChartSkeleton() {
  return <Skeleton className="w-full h-[550px] rounded-2xl bg-white/5" />;
}
