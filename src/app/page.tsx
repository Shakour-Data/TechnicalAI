'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, BarChart3, Activity, GitBranch, FileText, Coins, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
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

// All TGJU-based categories that use the tgju.org chart API
const TGJU_CATEGORIES = new Set([
  'currency', 'gold', 'silver', 'gold_etf',
  'crypto', 'world_index', 'foreign_stock', 'forex', 'energy', 'metal', 'commodity',
]);

// Auto-refresh interval (60 seconds)
const REFRESH_INTERVAL = 60_000;

// Sidebar items
const SIDEBAR_ITEMS = [
  { id: 'indicators', label: 'اندیکاتورها', icon: Activity, color: 'text-cyan-700', activeBg: 'bg-cyan-50 border-cyan-200', hoverBg: 'hover:bg-cyan-50/50' },
  { id: 'graph', label: 'گراف تصمیم', icon: GitBranch, color: 'text-amber-800', activeBg: 'bg-amber-50 border-amber-200', hoverBg: 'hover:bg-amber-50/50' },
  { id: 'visual', label: 'توضیح‌دهنده تصویری', icon: FileText, color: 'text-purple-700', activeBg: 'bg-purple-50 border-purple-200', hoverBg: 'hover:bg-purple-50/50' },
] as const;

type SidebarItem = typeof SIDEBAR_ITEMS[number]['id'];

// ─── Landing Page Component ─────────────────────────────────────
const FEATURES = [
  { icon: TrendingUp, title: 'تحلیل تکنیکال ۷ لایه', desc: 'موتور VDss با مدل ML تطبیقی: میانگین متحرک، RSI، MACD، باند بولینگر، استوکاستیک، ADX و SAR' },
  { icon: Activity, title: 'اندیکاتورهای حرفه‌ای', desc: 'RSI، MFI، CCI، استوکاستیک، MACD، ADX، Parabolic SAR، باند بولینگر، Ichimoku و VWAP' },
  { icon: GitBranch, title: 'گراف تصمیم هوشمند', desc: 'درخت تصمیم ۱۲ گره‌ای با مسیرهای صعودی، نزولی، پولبک و ریسک' },
  { icon: FileText, title: 'توضیح‌دهنده تصویری (AI)', desc: 'تحلیل هوشمند چندلایه با ۱۰ مکتب تحلیلی، ۱۰ سبک روایت و ۱۵ لحن تحلیلی' },
  { icon: BarChart3, title: 'حمایت و مقاومت هوشمند', desc: 'تشخیص خودکار سطوح کلیدی با ترکیب ۵ روش: فیبوناچی، پیوت، سقف/کف تاریخی، خط روند و ML' },
  { icon: Coins, title: 'پوشش جامع بازارها', desc: 'بورس تهران، ارز، طلا، سکه، کریپتو، فارکس، شاخص‌های جهانی، نفت و فلزات' },
];

const MARKETS = [
  { label: 'سهام بورس', cls: 'bg-gray-100 text-gray-700' },
  { label: 'ارزها (ریال)', cls: 'bg-teal-50 text-teal-700 border border-teal-100' },
  { label: 'جفت ارز', cls: 'bg-violet-50 text-violet-700 border border-violet-100' },
  { label: 'کریپتو', cls: 'bg-orange-50 text-orange-700 border border-orange-100' },
  { label: 'طلا و سکه', cls: 'bg-yellow-50 text-yellow-700 border border-yellow-100' },
  { label: 'بورس جهانی', cls: 'bg-sky-50 text-sky-700 border border-sky-100' },
  { label: 'نفت و انرژی', cls: 'bg-red-50 text-red-700 border border-red-100' },
  { label: 'فلزات جهانی', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  { label: 'شاخص‌ها', cls: 'bg-rose-50 text-rose-700 border border-rose-100' },
  { label: 'صندوق‌ها', cls: 'bg-purple-50 text-purple-700 border border-purple-100' },
];

function LandingPage({ onSearch }: { onSearch: (symbol: string, category?: string, insCode?: string, tgjuKey?: string, finpySector?: string, finpyIndex?: string, webId?: number) => void }) {
  return (
    <div className="space-y-16 pb-16">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-amber-900/80 px-6 py-16 sm:px-12 sm:py-24 text-center">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/40 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-cyan-400/40 via-transparent to-transparent" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-amber-300 text-xs font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            نسخه 5.0 — تحلیل هوشمند با AI
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 leading-tight">
            تحلیل تکنیکال{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">هوشمند</span>{' '}
            بازار ایران
          </h2>
          <p className="text-gray-300 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            سیستم جامع تحلیل تکنیکال با موتور ۷ لایه VDss، انتخاب خودکار مکتب تحلیلی با ML،
            گراف تصمیم هوشمند و تحلیل متنی تولیدشده توسط هوش مصنوعی.
          </p>
          <div className="max-w-lg mx-auto">
            <SymbolSearch onSelect={onSearch} placeholder='جستجوی نماد، ارز، طلا، کریپتو، شاخص ...' />
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {MARKETS.map((m) => (
              <span key={m.label} className={`px-3 py-1 rounded-full text-[10px] font-medium ${m.cls}`}>{m.label}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section>
        <div className="text-center mb-10">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">قابلیت‌های کلیدی</h3>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">
            ترکیب مهندسی مالی و هوش مصنوعی برای تحلیل حرفه‌ای بازارهای مالی ایران
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-amber-200 transition-all">
                <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center mb-4 group-hover:bg-amber-100 transition-colors">
                  <Icon className="w-5 h-5 text-amber-700" />
                </div>
                <h4 className="font-bold text-gray-900 mb-1.5">{f.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section>
        <div className="text-center mb-10">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">چگونه کار می‌کند؟</h3>
          <p className="text-gray-500 text-sm">سه مرحله ساده تا تحلیل کامل</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { step: '۱', title: 'جستجوی نماد', desc: 'نام نماد، ارز، طلا، کریپتو یا شاخص مورد نظر خود را در نوار جستجو تایپ کنید' },
            { step: '۲', title: 'تحلیل خودکار', desc: 'موتور VDss داده‌های تاریخی را تحلیل کرده و ۳ پنل نمایشی می‌سازد' },
            { step: '۳', title: 'تحلیل هوشمند AI', desc: 'سیستم ML مکتب و سبک تحلیلی مناسب را انتخاب و تحلیل متنی تولید می‌کند' },
          ].map((s) => (
            <div key={s.step} className="relative text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center mx-auto mb-4 text-amber-800 font-black text-lg">
                {s.step}
              </div>
              <h4 className="font-bold text-gray-900 mb-1">{s.title}</h4>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI SYSTEM EXPLANATION ── */}
      <section className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-amber-50/30 p-8 sm:p-12">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">سیستم هوشمند ترکیبی AI</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="text-center p-4">
              <div className="text-3xl font-black text-amber-700 mb-1">۱۰</div>
              <div className="text-sm font-bold text-gray-900">مکتب تحلیل تکنیکال</div>
              <div className="text-xs text-gray-500 mt-1">روند، الگوهای کلاسیک، کندلی، فیبوناچی، نوسان، اسیلاتور، حمایت/مقاومت، فاز و چرخه، چندزمانی، روانشناختی</div>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl font-black text-teal-700 mb-1">۱۰</div>
              <div className="text-sm font-bold text-gray-900">سبک روایت</div>
              <div className="text-xs text-gray-500 mt-1">محافظه‌کار، اسکالپر، روندگرا، بدبین، روایی، تصمیم‌محور، تحلیلگر حجم، تحلیلگر الگو، روانشناختی، تحلیلگر نوسان</div>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl font-black text-violet-700 mb-1">۱۵</div>
              <div className="text-sm font-bold text-gray-900">لحن تحلیلی</div>
              <div className="text-xs text-gray-500 mt-1">رسمی، سریع، فلسفی، هشداردهنده، داستانی، گام‌به‌گام، شکاک، خوشبین، ساده، عددمحور، چندلایه، آموزشی و ...</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-600 leading-relaxed">
            <p className="font-bold text-gray-900 mb-2">چگونه کار می‌کند؟</p>
            <p>
              سیستم ابتدا داده‌های تکنیکال (RSI، MACD، ADX، استوکاستیک، باند بولینگر و ...) را پردازش می‌کند.
              سپس بر اساس ۶ شاخه تصمیم‌گیری (بازار رنج، روند قوی صعودی، تضاد شدید، فشرده نوسان، الگوی واضح، عدم قطعیت بالا)
              بهترین ترکیب مکتب + سبک + لحن را انتخاب می‌کند.
              در نهایت با ساختار ۱۰ مرحله‌ای (از Chain of Thought تا خروجی سه‌لایه) تحلیلی جامع تولید می‌شود.
            </p>
          </div>
        </div>
      </section>

      {/* ── DATA SOURCES ── */}
      <section>
        <div className="text-center mb-10">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">منابع داده</h3>
          <p className="text-gray-500 text-sm">داده‌های واقعی از منابع معتبر</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
          <div className="rounded-xl border border-gray-300 p-5 bg-white text-center">
            <div className="font-bold text-gray-900 mb-1">TSETMC</div>
            <p className="text-xs text-gray-500 leading-relaxed">داده‌های تعدیل‌شده سهام بورس تهران و اوراق بدهی</p>
          </div>
          <div className="rounded-xl border border-teal-300 p-5 bg-white text-center">
            <div className="font-bold text-gray-900 mb-1">TGJU (تارا)</div>
            <p className="text-xs text-gray-500 leading-relaxed">ارزها، طلا، سکه، کریپتو، فارکس، بورس جهانی، نفت و فلزات</p>
          </div>
          <div className="rounded-xl border border-purple-300 p-5 bg-white text-center">
            <div className="font-bold text-gray-900 mb-1">Finpy-TSE</div>
            <p className="text-xs text-gray-500 leading-relaxed">شاخص‌های اصلی و گروهی بورس تهران با تاریخچه CDN</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<SidebarItem>('visual');
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Store last fetch params for auto-refresh
  const lastFetchRef = useRef<{ symbol: string; category?: string; insCode?: string; tgjuKey?: string; finpySector?: string; finpyIndex?: string; webId?: number } | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chart container ref for image export
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(async (symbol: string, category?: string, insCode?: string, tgjuKey?: string, finpySector?: string, finpyIndex?: string, webId?: number) => {
    // TGJU instrument: fetch historical data via tgju.org chart API
    if (category && TGJU_CATEGORIES.has(category) && tgjuKey) {
      setLoading(true);
      setLoadingMessage('در حال دریافت داده‌های تاریخی ... (حدود ۱۵ ثانیه)');
      setError(null);
      setData(null);
      lastFetchRef.current = { symbol, category, insCode, tgjuKey, finpySector, finpyIndex, webId };
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
        setActivePanel('visual');
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
        setLoadingMessage(null);
      }
      return;
    }

    // Index: fetch historical data via TSETMC CDN (webId), then finpy-tse (finpyIndex/finpySector)
    if (category === 'index') {
      setLoading(true);
      setLoadingMessage('در حال دریافت داده‌های تاریخی شاخص ...');
      setError(null);
      setData(null);
      lastFetchRef.current = { symbol, category, insCode, tgjuKey, finpySector, finpyIndex, webId };
      let gotError = false;
      try {
        // 1. Try webId (TSETMC CDN — most reliable for all indices)
        if (webId) {
          setLoadingMessage('در حال دریافت داده‌های شاخص از TSETMC ...');
          const res = await fetch(`/api/finpy-sector?webId=${encodeURIComponent(String(webId))}`);
          if (res.ok) {
            const json = await res.json();
            if (json.candles && json.candles.length > 0 && json.ta) {
              setData(json);
              setActivePanel('visual');
              setLoading(false);
              setLoadingMessage(null);
              return;
            }
            if (json.error) {
              setError(json.error);
              gotError = true;
            }
          }
        }

        // 2. Main indices (CWI, EWI, etc.) via finpy-tse
        if (finpyIndex) {
          setLoadingMessage('در حال دریافت داده‌های شاخص اصلی ...');
          const res = await fetch(`/api/finpy-sector?indexKey=${encodeURIComponent(finpyIndex)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.candles && json.candles.length > 0 && json.ta) {
              setData(json);
              setActivePanel('visual');
              setLoading(false);
              setLoadingMessage(null);
              return;
            }
            if (json.error) {
              setError(json.error);
              gotError = true;
            }
          }
        }

        // 3. Sector indices via finpy-tse (uses sector name)
        if (finpySector) {
          setLoadingMessage('در حال دریافت داده‌های شاخص گروه ...');
          const res = await fetch(`/api/finpy-sector?sector=${encodeURIComponent(finpySector)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.candles && json.candles.length > 0 && json.ta) {
              setData(json);
              setActivePanel('visual');
              setLoading(false);
              setLoadingMessage(null);
              return;
            }
            if (json.error) {
              setError(json.error);
              gotError = true;
            }
          }
        }

        if (!gotError) {
          setError('داده‌های تاریخی این شاخص در حال حاضر قابل دسترسی نیست.');
        }
      } catch (err) {
        setError(String(err));
      }
      setLoading(false);
      setLoadingMessage(null);
      return;
    }

    // Regular TSE instrument: full TA analysis (تعدیل شده / adjusted prices only)
    setLoading(true);
    setError(null);
    setData(null);
    lastFetchRef.current = { symbol, category, insCode, tgjuKey, finpySector, finpyIndex, webId };
    try {
      const res = await fetch(`/api/analysis?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'خطا در دریافت داده‌ها');
      }
      const json = await res.json();
      setData(json);
      setActivePanel('visual');
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
      await handleSelect(params.symbol, params.category, params.insCode, params.tgjuKey, params.finpySector, params.finpyIndex, params.webId);
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
    ema: data.ta.ema ?? {},
    bollingerBands: data.ta.bollingerBands,
    resistances: data.ta.resistances,
    supports: data.ta.supports,
    supportStrengths: data.ta.supportStrengths,
    resistanceStrengths: data.ta.resistanceStrengths,
    sar: data.ta.sar,
    smaArray: data.ta.smaArray,
    emaArray: data.ta.emaArray,
    ichimokuArrays: data.ta.ichimokuArrays,
    vwapArray: data.ta.vwapArray,
  } : null, [data?.ta]);

  const isTgjuData = data?.isTgju;

  return (
    <div dir="rtl" className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* ── HEADER ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-xl">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
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
      <main className="flex-1 max-w-[1800px] w-full mx-auto px-4 py-4">
        {!data && !loading && !error && (
          <LandingPage onSearch={handleSelect} />
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

        {data && !loading && (
          <div className="flex gap-4 items-start">
            {/* ── MAIN CONTENT AREA ── */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Info Grid */}
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

              {/* ── PANEL: Indicators ── */}
              {activePanel === 'indicators' && (
                <IndicatorsPanel ta={data.ta} />
              )}

              {/* ── PANEL: Decision Graph (گراف تصمیم) ── */}
              {activePanel === 'graph' && (
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
              )}

              {/* ── PANEL: Visual Describer (توضیح‌دهنده تصویری) ── */}
              {activePanel === 'visual' && (
                <div className="space-y-4">
                  <div id="chart-export-wrapper" ref={chartWrapperRef}>
                    <CandlestickChart data={data.candles} ta={chartTa} height={520} />
                  </div>
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
                </div>
              )}
            </div>

            {/* ── RIGHT SIDEBAR ── */}
            <aside className={`shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'w-56'} hidden lg:block`}>
              <div className="sticky top-[76px] space-y-2">
                <h3 className="text-xs font-bold text-gray-500 px-3 mb-3">ابزارهای تحلیلی</h3>
                {SIDEBAR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePanel === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActivePanel(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                        isActive
                          ? `${item.activeBg} ${item.color} border-current/20 shadow-sm`
                          : `border-transparent ${item.hoverBg} text-gray-600 hover:${item.color}`
                      }`}
                    >
                      <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? item.color : 'text-gray-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}

                {/* Collapse toggle */}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="w-full flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all cursor-pointer mt-4"
                  title={sidebarCollapsed ? 'نمایش سایدبار' : 'بستن سایدبار'}
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
                  <span>جمع‌شوندگی</span>
                </button>
              </div>
            </aside>

            {/* Mobile bottom nav */}
            <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 px-2 py-2 flex items-center gap-1">
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activePanel === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePanel(item.id)}
                    className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                      isActive ? `${item.color} ${item.activeBg}` : 'text-gray-500'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer className={`mt-auto border-t border-gray-200 bg-white py-3 text-center text-[10px] text-gray-500 ${data ? 'lg:mb-14' : ''}`}>
        داده‌های بورس از TSETMC (تعدیل شده) | داده‌های شاخص‌ها از finpy-tse | داده‌های ارز، طلا، کریپتو، فارکس، بورس جهانی از TGJU (tgju.org) — صرفاً جنبه تحلیلی دارد و توصیه سرمایه‌گذاری نیست. | v5.0
      </footer>
    </div>
  );
}
