'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, BarChart3, Activity, GitBranch, FileText, BarChart2, Info, Coins, RefreshCw } from 'lucide-react';
import SymbolSearch from '@/components/tse/symbol-search';
import CandlestickChart from '@/components/tse/candlestick-chart';
import IndicatorsPanel from '@/components/tse/indicators-panel';
import VdssGraph from '@/components/tse/vdss-graph';
import VdesAnalysis from '@/components/tse/vdes-analysis';
import { toPersianDigits } from '@/lib/jalali';

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
  isTgju?: boolean;
}

const toFa = (n: number) => Math.round(n).toLocaleString('fa-IR');
const toFaDecimal = (n: number) => n.toLocaleString('fa-IR', { maximumFractionDigits: 2 });

interface IndexData {
  name: string;
  index: number;
  change: number;
  changePercent: number;
  min: number;
  max: number;
}

// All TGJU-based categories that use the tgju.org chart API
const TGJU_CATEGORIES = new Set([
  'currency', 'gold', 'silver', 'gold_etf',
  'crypto', 'world_index', 'forex', 'energy', 'metal', 'commodity',
]);

// Auto-refresh interval (60 seconds)
const REFRESH_INTERVAL = 60_000;

export default function Home() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [indexData, setIndexData] = useState<IndexData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('chart');
  const [refreshing, setRefreshing] = useState(false);

  // Store last fetch params for auto-refresh
  const lastFetchRef = useRef<{ symbol: string; category?: string; insCode?: string; tgjuKey?: string; finpySector?: string } | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSelect = useCallback(async (symbol: string, category?: string, insCode?: string, tgjuKey?: string, finpySector?: string) => {
    // TGJU instrument: fetch historical data via tgju.org chart API
    if (category && TGJU_CATEGORIES.has(category) && tgjuKey) {
      setLoading(true);
      setLoadingMessage('در حال دریافت داده‌های تاریخی ... (حدود ۱۵ ثانیه)');
      setError(null);
      setData(null);
      setIndexData(null);
      lastFetchRef.current = { symbol, category, insCode, tgjuKey, finpySector };
      try {
        const res = await fetch(`/api/tgju-analysis?key=${encodeURIComponent(tgjuKey)}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'خطا در دریافت داده‌های تاریخی');
        }
        const json = await res.json();
        if (!json.candles || json.candles.length === 0 || !json.ta) {
          throw new Error(json.error || 'داده‌های تاریخی کافی برای تحلیل وجود ندارد');
        }
        setData({ ...json, isTgju: true });
        setActiveTab('chart');
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
        setLoadingMessage(null);
      }
      return;
    }

    // Index: try finpy-tse first (for industry indices), then TSETMC TA, then static overview
    if (category === 'index') {
      setLoading(true);
      setLoadingMessage('در حال دریافت داده‌های تاریخی از finpy-tse ...');
      setError(null);
      setData(null);
      setIndexData(null);
      lastFetchRef.current = { symbol, category, insCode, tgjuKey, finpySector };
      try {
        // 1. Try finpy-tse service for industry indices
        if (finpySector) {
          const finpyRes = await fetch(`/api/finpy-sector?sector=${encodeURIComponent(finpySector)}`);
          if (finpyRes.ok) {
            const finpyJson = await finpyRes.json();
            if (finpyJson.candles && finpyJson.candles.length > 0 && finpyJson.ta) {
              setData(finpyJson);
              setActiveTab('chart');
              setLoading(false);
              setLoadingMessage(null);
              return;
            }
          }
        }

        // 2. Try TSETMC for main indices with insCode
        if (insCode) {
          const analysisRes = await fetch(`/api/analysis?symbol=${encodeURIComponent(symbol)}&indexInsCode=${encodeURIComponent(insCode)}`);
          if (analysisRes.ok) {
            const analysisJson = await analysisRes.json();
            if (analysisJson.candles && analysisJson.candles.length > 0 && analysisJson.ta) {
              setData(analysisJson);
              setActiveTab('chart');
              setLoading(false);
              setLoadingMessage(null);
              return;
            }
          }
        }

        // 3. Fall back to static overview
        const r = await fetch('/api/instruments');
        if (r.ok) {
          const d = await r.json();
          const found = (d.indices || []).find((i: { l18: string }) => i.l18 === symbol);
          if (found) {
            setIndexData({
              name: found.l30 || found.l18,
              index: found.pl,
              change: found.indexChange || 0,
              changePercent: found.indexChangePercent || 0,
              min: found.indexMin || 0,
              max: found.indexMax || 0,
            });
          }
        }
      } catch {
        // ignore
      }
      setLoading(false);
      setLoadingMessage(null);
      return;
    }

    // Regular TSE instrument: full TA analysis (تعدیل شده / adjusted prices only)
    setLoading(true);
    setError(null);
    setData(null);
    setIndexData(null);
    lastFetchRef.current = { symbol, category, insCode, tgjuKey, finpySector };
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

  // ── Auto-refresh: every 60s + on tab focus ──
  const doRefresh = useCallback(async () => {
    const params = lastFetchRef.current;
    if (!params) return;
    if (loading || refreshing) return;
    setRefreshing(true);
    try {
      await handleSelect(params.symbol, params.category, params.insCode, params.tgjuKey, params.finpySector);
    } finally {
      setRefreshing(false);
    }
  }, [handleSelect, loading, refreshing]);

  useEffect(() => {
    if (!data) return;
    refreshTimerRef.current = setInterval(doRefresh, REFRESH_INTERVAL);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [data, doRefresh]);

  // Refresh on tab/window focus
  useEffect(() => {
    const onFocus = () => {
      if (data) doRefresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [data, doRefresh]);

  const lastPrice = data?.ta ? data.candles[data.candles.length - 1]?.close ?? 0 : 0;
  const signalColor = data?.ta?.overallSignal === 'bullish' ? 'text-emerald-700' : data?.ta?.overallSignal === 'bearish' ? 'text-red-700' : 'text-amber-700';
  const signalBg = data?.ta?.overallSignal === 'bullish' ? 'bg-emerald-50 border-emerald-200' : data?.ta?.overallSignal === 'bearish' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  const SignalIcon = data?.ta?.overallSignal === 'bullish' ? TrendingUp : data?.ta?.overallSignal === 'bearish' ? TrendingDown : Activity;

  const chartTa = useMemo(() => data?.ta ? {
    sma: data.ta.sma,
    bollingerBands: data.ta.bollingerBands,
    resistances: data.ta.resistances,
    supports: data.ta.supports,
    supportStrengths: data.ta.supportStrengths,
    resistanceStrengths: data.ta.resistanceStrengths,
    sar: data.ta.sar,
  } : null, [data?.ta]);

  const isTgjuData = data?.isTgju;

  return (
    <div dir="rtl" className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* ── HEADER ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-600/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">تحلیل تکنیکال بازار</h1>
              <p className="text-[10px] text-gray-500">بورس + ارز + طلا + کریپتو + فارکس + بورس جهانی (TSETMC &amp; TGJU)</p>
            </div>
          </div>

          <div className="flex-1 min-w-[240px] max-w-xl">
            <SymbolSearch onSelect={handleSelect} placeholder='جستجوی نماد، ارز، طلا، کریپتو، شاخص ...' />
          </div>

          {indexData && (
            <div className="flex items-center gap-4 text-sm shrink-0">
              <div className="text-left">
                <div className="text-gray-500 text-xs">{indexData.name}</div>
                <div className="font-bold text-lg text-gray-900">
                  {toFaDecimal(indexData.index)}
                  <span className={`text-xs mr-2 ${indexData.changePercent >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {indexData.changePercent >= 0 ? '▲' : '▼'} {toFaDecimal(Math.abs(indexData.changePercent))}%
                  </span>
                </div>
              </div>
              <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                شاخص
              </span>
            </div>
          )}

          {data?.info && (
            <div className="flex items-center gap-4 text-sm shrink-0">
              <div className="text-left">
                <div className="text-gray-500 text-xs">{data.info.name}</div>
                <div className="font-bold text-lg text-gray-900">
                  {toFa(data.info.lastPrice)}
                  <span className={`text-xs mr-2 ${data.info.change >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {data.info.change >= 0 ? '▲' : '▼'} {toFa(Math.abs(data.info.change))}%
                  </span>
                </div>
              </div>
              {isTgjuData && (
                <span className="px-2 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-bold flex items-center gap-1">
                  <Coins className="w-3 h-3" /> TGJU
                </span>
              )}
              <div className={`px-3 py-1.5 rounded-lg border ${signalBg}`}>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${signalColor}`}>
                  <SignalIcon className="w-3.5 h-3.5" />
                  {data.ta.overallSignal === 'bullish' ? 'صعودی' : data.ta.overallSignal === 'bearish' ? 'نزولی' : 'خنثی'}
                </div>
              </div>
              {/* Refresh button */}
              <button
                onClick={doRefresh}
                disabled={refreshing || loading}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 cursor-pointer"
                title="به‌روزرسانی"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4">
        {indexData && !loading && (
          <div className="max-w-2xl mx-auto py-12">
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-5">
                <BarChart2 className="w-8 h-8 text-rose-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{indexData.name}</h2>
              <div className="text-3xl font-black text-gray-900 my-4 tabular-nums">{toFaDecimal(indexData.index)}</div>
              <div className={`inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl ${indexData.changePercent >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {indexData.changePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {toFaDecimal(Math.abs(indexData.change))} ({indexData.changePercent >= 0 ? '+' : ''}{toFaDecimal(indexData.changePercent)}%)
              </div>
              <div className="grid grid-cols-2 gap-4 mt-8 max-w-sm mx-auto">
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <div className="text-[10px] text-gray-500 mb-1">بیشترین امروز</div>
                  <div className="text-sm font-bold text-emerald-700 tabular-nums">{toFaDecimal(indexData.max)}</div>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <div className="text-[10px] text-gray-500 mb-1">کمترین امروز</div>
                  <div className="text-sm font-bold text-red-700 tabular-nums">{toFaDecimal(indexData.min)}</div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                <Info className="w-3.5 h-3.5" />
                <span>داده‌های تاریخی شاخص‌ها از طریق API فعلی قابل دسترسی نیستند.</span>
              </div>
            </div>
          </div>
        )}

        {!data && !indexData && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-700/5 border border-amber-300/30 flex items-center justify-center mb-6">
              <BarChart3 className="w-12 h-12 text-amber-600/50" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">تحلیل تکنیکال بازار ایران</h2>
            <p className="text-gray-500 max-w-md mb-6">
              نماد بورسی، ارز، طلا، کریپتو، شاخص جهانی یا جفت ارز مورد نظر خود را جستجو کنید
              تا تحلیل کامل تکنیکال نمایش داده شود.
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">سهام</span>
              <span className="px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">ارزها</span>
              <span className="px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">جفت ارز</span>
              <span className="px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">کریپتو</span>
              <span className="px-3 py-1.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-100">طلا و نقره</span>
              <span className="px-3 py-1.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">بورس جهانی</span>
              <span className="px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-100">نفت و انرژی</span>
              <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">فلزات</span>
              <span className="px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">شاخص‌ها</span>
              <span className="px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">صندوق‌ها</span>
              <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">RSI, MACD, BB, VDss</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4 py-8">
            {loadingMessage && (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="w-5 h-5 border-2 border-amber-300 border-t-amber-700 rounded-full animate-spin" />
                <span className="text-sm text-amber-800">{loadingMessage}</span>
              </div>
            )}
            <Skeleton className="h-8 w-48 bg-gray-200" />
            <Skeleton className="h-[500px] w-full bg-gray-200 rounded-xl" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-32 bg-gray-200 rounded-xl" />
              <Skeleton className="h-32 bg-gray-200 rounded-xl" />
              <Skeleton className="h-32 bg-gray-200 rounded-xl" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-red-700 mb-2">خطا</h3>
            <p className="text-gray-500 text-sm max-w-md">{error}</p>
          </div>
        )}

        {data && !loading && !indexData && (
          <div className="space-y-4">
            {data.info && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'اولین', value: toFa(data.info.openPrice) },
                  { label: 'بیشترین', value: toFa(data.info.maxPrice), cls: 'text-emerald-700' },
                  { label: 'کمترین', value: toFa(data.info.minPrice), cls: 'text-red-700' },
                  ...(data.ta.hasVolume ? [
                    { label: 'حجم معاملات', value: toPersianDigits((data.info.volume / 1e6).toFixed(1)) + 'M' },
                    { label: 'ارزش معاملات', value: toPersianDigits((data.info.value / 1e9).toFixed(1)) + 'B' },
                    { label: 'تعداد معاملات', value: toFa(data.info.trades) },
                    { label: 'P/E', value: data.info.pe > 0 ? toFa(data.info.pe) : '—' },
                  ] : [
                    { label: 'P/E', value: data.info.pe > 0 ? toFa(data.info.pe) : '—' },
                  ]),
                ].map((s) => (
                  <div key={s.label} className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                    <div className="text-[10px] text-gray-500 mb-0.5">{s.label}</div>
                    <div className={`text-sm font-bold ${(s as { cls?: string }).cls || 'text-gray-900'}`}>{s.value}</div>
                  </div>
                ))}
                {isTgjuData && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-teal-600 mb-0.5">منبع داده</div>
                    <div className="text-sm font-bold text-teal-700">TGJU (تارا)</div>
                  </div>
                )}
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-white border border-gray-200 h-10 shadow-sm">
                <TabsTrigger value="chart" className="text-xs gap-1.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
                  <BarChart3 className="w-3.5 h-3.5" />
                  نمودار
                </TabsTrigger>
                <TabsTrigger value="indicators" className="text-xs gap-1.5 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-700">
                  <Activity className="w-3.5 h-3.5" />
                  اندیکاتورها
                </TabsTrigger>
                <TabsTrigger value="vdss" className="text-xs gap-1.5 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800">
                  <GitBranch className="w-3.5 h-3.5" />
                  VDss
                </TabsTrigger>
                <TabsTrigger value="vdes" className="text-xs gap-1.5 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
                  <FileText className="w-3.5 h-3.5" />
                  VDes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chart" className="mt-3">
                <CandlestickChart data={data.candles} ta={chartTa} height={520} />
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
                  bullScore={data.ta.bullScore}
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
                  hasVolume={data.ta.hasVolume}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-gray-200 bg-white py-3 text-center text-[10px] text-gray-500">
        داده‌های بورس از TSETMC (تعدیل شده) | داده‌های ارز، طلا، کریپتو، فارکس، بورس جهانی از TGJU (tgju.org) — صرفاً جنبه تحلیلی دارد و توصیه سرمایه‌گذاری نیست. | v2.1
      </footer>
    </div>
  );
}
