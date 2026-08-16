'use client';

import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, BarChart3, Activity, GitBranch, FileText } from 'lucide-react';
import SymbolSearch from '@/components/tse/symbol-search';
import CandlestickChart from '@/components/tse/candlestick-chart';
import IndicatorsPanel from '@/components/tse/indicators-panel';
import VdssGraph, { VdssGraphSkeleton } from '@/components/tse/vdss-graph';
import VdesAnalysis, { VdesAnalysisSkeleton } from '@/components/tse/vdes-analysis';

interface AnalysisData {
  symbol: string;
  candles: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
  info: {
    name: string;
    symbol: string;
    lastPrice: number;
    change: number;
    closePrice: number;
    closeChange: number;
    openPrice: number;
    minPrice: number;
    maxPrice: number;
    yesterdayClose: number;
    volume: number;
    value: number;
    trades: number;
    eps: number;
    pe: number;
  } | null;
  ta: import('@/lib/ta-engine').TAResult;
}

const toFa = (n: number) => Math.round(n).toLocaleString('fa-IR');

export default function Home() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('chart');

  const handleSelect = useCallback(async (symbol: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/analysis?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'خطا در دریافت داده‌ها');
      }
      const json = await res.json();
      setData(json);
      setActiveTab('chart');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const lastPrice = data?.ta ? data.candles[data.candles.length - 1]?.close ?? 0 : 0;
  const signalColor = data?.ta?.overallSignal === 'bullish' ? 'text-emerald-400' : data?.ta?.overallSignal === 'bearish' ? 'text-red-400' : 'text-amber-400';
  const signalBg = data?.ta?.overallSignal === 'bullish' ? 'bg-emerald-500/20 border-emerald-500/30' : data?.ta?.overallSignal === 'bearish' ? 'bg-red-500/20 border-red-500/30' : 'bg-amber-500/20 border-amber-500/30';
  const SignalIcon = data?.ta?.overallSignal === 'bullish' ? TrendingUp : data?.ta?.overallSignal === 'bearish' ? TrendingDown : Activity;

  return (
    <div dir="rtl" className="min-h-screen bg-[#060a13] text-gray-100 flex flex-col">
      {/* ── HEADER ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#060a13]/95 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-amber-400 leading-tight">Tse Technical Analysis</h1>
              <p className="text-[10px] text-gray-500">تحلیل تکنیکال بورس ایران</p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[240px] max-w-xl">
            <SymbolSearch onSelect={handleSelect} />
          </div>

          {/* Price Info (after selection) */}
          {data?.info && (
            <div className="flex items-center gap-4 text-sm shrink-0">
              <div className="text-left">
                <div className="text-gray-400 text-xs">{data.info.name}</div>
                <div className="font-bold text-lg">
                  {toFa(data.info.lastPrice)}
                  <span className={`text-xs mr-2 ${data.info.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.info.change >= 0 ? '▲' : '▼'} {toFa(Math.abs(data.info.change))}%
                  </span>
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded-lg border ${signalBg}`}>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${signalColor}`}>
                  <SignalIcon className="w-3.5 h-3.5" />
                  {data.ta.overallSignal === 'bullish' ? 'صعودی' : data.ta.overallSignal === 'bearish' ? 'نزولی' : 'خنثی'}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4">
        {/* Empty State */}
        {!data && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400/10 to-amber-600/5 border border-amber-500/20 flex items-center justify-center mb-6">
              <BarChart3 className="w-12 h-12 text-amber-400/60" />
            </div>
            <h2 className="text-xl font-bold text-gray-200 mb-2">تحلیل تکنیکال بورس ایران</h2>
            <p className="text-gray-500 max-w-md mb-6">
              نماد مورد نظر خود را جستجو کنید تا تحلیل کامل تکنیکال شامل اندیکاتورها،
              حمایت‌ها و مقاومت‌ها، و گراف تصمیم VDss نمایش داده شود.
            </p>
            <div className="flex gap-3 text-xs text-gray-600">
              <span className="px-3 py-1.5 rounded-full bg-white/5">RSI, MFI, CCI, ADX</span>
              <span className="px-3 py-1.5 rounded-full bg-white/5">MACD, Stochastic, BB</span>
              <span className="px-3 py-1.5 rounded-full bg-white/5">VDss + VDes</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-4 py-8">
            <Skeleton className="h-8 w-48 bg-white/5" />
            <Skeleton className="h-[500px] w-full bg-white/5 rounded-xl" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-32 bg-white/5 rounded-xl" />
              <Skeleton className="h-32 bg-white/5 rounded-xl" />
              <Skeleton className="h-32 bg-white/5 rounded-xl" />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <TrendingDown className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-red-400 mb-2">خطا در دریافت داده‌ها</h3>
            <p className="text-gray-500 text-sm max-w-md">{error}</p>
          </div>
        )}

        {/* Analysis Results */}
        {data && !loading && (
          <div className="space-y-4">
            {/* Quick Stats Bar */}
            {data.info && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {[
                  { label: 'اولین', value: toFa(data.info.openPrice) },
                  { label: 'بیشترین', value: toFa(data.info.maxPrice), cls: 'text-emerald-400' },
                  { label: 'کمترین', value: toFa(data.info.minPrice), cls: 'text-red-400' },
                  { label: 'حجم معاملات', value: (data.info.volume / 1e6).toFixed(1) + 'M' },
                  { label: 'ارزش معاملات', value: (data.info.value / 1e9).toFixed(1) + 'B' },
                  { label: 'تعداد معاملات', value: toFa(data.info.trades) },
                  { label: 'P/E', value: data.info.pe > 0 ? toFa(data.info.pe) : '—' },
                ].map((s) => (
                  <div key={s.label} className="bg-[#111d2e]/60 border border-white/5 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-gray-500 mb-0.5">{s.label}</div>
                    <div className={`text-sm font-bold ${s.cls || 'text-gray-200'}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Main Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-[#111d2e]/80 border border-white/5 h-10">
                <TabsTrigger value="chart" className="text-xs gap-1.5 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                  <BarChart3 className="w-3.5 h-3.5" />
                  نمودار
                </TabsTrigger>
                <TabsTrigger value="indicators" className="text-xs gap-1.5 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                  <Activity className="w-3.5 h-3.5" />
                  اندیکاتورها
                </TabsTrigger>
                <TabsTrigger value="vdss" className="text-xs gap-1.5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  <GitBranch className="w-3.5 h-3.5" />
                  VDss
                </TabsTrigger>
                <TabsTrigger value="vdes" className="text-xs gap-1.5 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
                  <FileText className="w-3.5 h-3.5" />
                  VDes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chart" className="mt-3">
                <CandlestickChart data={data.candles} ta={data.ta} height={520} />
              </TabsContent>

              <TabsContent value="indicators" className="mt-3">
                <IndicatorsPanel ta={data.ta} />
              </TabsContent>

              <TabsContent value="vdss" className="mt-3">
                <VdssGraph
                  symbolName={data.info?.name ?? data.symbol}
                  currentPrice={lastPrice}
                  resistances={data.ta.resistances}
                  supports={data.ta.supports}
                  ma100={data.ta.sma.sma100 || 0}
                  rsi={data.ta.rsi}
                  mfi={data.ta.mfi}
                  cci={data.ta.cci}
                  adx={data.ta.adx}
                  trendDirection={data.ta.trend.medium.direction}
                  scenarios={data.ta.scenarios}
                />
              </TabsContent>

              <TabsContent value="vdes" className="mt-3">
                <VdesAnalysis
                  symbolName={data.info?.name ?? data.symbol}
                  candles={data.candles}
                  currentPrice={lastPrice}
                  resistances={data.ta.resistances}
                  supports={data.ta.supports}
                  ma21={data.ta.sma.sma21 || 0}
                  ma100={data.ta.sma.sma100 || 0}
                  rsi={data.ta.rsi}
                  mfi={data.ta.mfi}
                  cci={data.ta.cci}
                  adx={data.ta.adx}
                  stochK={data.ta.stochK}
                  stochD={data.ta.stochD}
                  macdLine={data.ta.macd.line}
                  macdSignal={data.ta.macd.signal}
                  macdHist={data.ta.macd.histogram}
                  diPlus={data.ta.diPlus}
                  diMinus={data.ta.diMinus}
                  sar={data.ta.sar}
                  atr={data.ta.atr}
                  obv={data.ta.obv}
                  bollingerUpper={data.ta.bollingerBands.upper}
                  bollingerMiddle={data.ta.bollingerBands.middle}
                  bollingerLower={data.ta.bollingerBands.lower}
                  trendDirection={data.ta.trend.medium.direction}
                  trendAngle={data.ta.trend.medium.angle}
                  trendR2={data.ta.trend.medium.r2}
                  overallSignal={data.ta.overallSignal}
                  scenarios={data.ta.scenarios}
                  supportStrengths={data.ta.supportStrengths}
                  resistanceStrengths={data.ta.resistanceStrengths}
                  priceTargets={data.ta.priceTargets}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-white/5 py-3 text-center text-[10px] text-gray-600">
        تمامی تحلیل‌ها بر اساس داده‌های تکنیکال بورس ایران (TSETMC) محاسبه شده است.
        این محتوا صرفاً جنبه تحلیلی دارد و توصیه سرمایه‌گذاری محسوب نمی‌شود.
      </footer>
    </div>
  );
}
