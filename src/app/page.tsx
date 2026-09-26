'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, BarChart3, Activity, GitBranch, FileText, Coins, RefreshCw, HelpCircle, BookOpen, BrainCircuit, Palette, Settings } from 'lucide-react';
import { useTheme, THEME_PRESETS } from '@/lib/theme-store';
import SymbolSearch from '@/components/tse/symbol-search';
import CandlestickChart from '@/components/tse/candlestick-chart';
import IndicatorsPanel from '@/components/tse/indicators-panel';
import AnalysisSidebar, { CollapsedSidebarExpand } from '@/components/tse/analysis-sidebar';
import VdssGraph from '@/components/tse/vdss-graph';
import VdesAnalysis from "@/components/tse/vdes-analysis";
import PatternsPanel from "@/components/tse/patterns-panel";
import MLForecast from "@/components/tse/ml-forecast";
import TimeSeriesPanel from "@/components/tse/time-series-panel";
import HelpPage from "@/components/help-page";
import DocsPage from "@/components/docs-page";
import { toPersianDigits } from '@/lib/jalali';
import { formatPriceFa } from '@/lib/format-price';
import { type ProbabilityTrendResult } from '@/lib/probability-trend';

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
    currencyUnit?: string;
    decimals?: number;
    category?: string;
    currency?: string;
  } | null;
  ta: import('@/lib/ta-engine').TAResult;
  probabilityTrend?: ProbabilityTrendResult | null;
  isTgju?: boolean;
  isYahoo?: boolean;
}

// Formatting helpers using dynamic decimals
const toFa = (n: number, decimals: number = 0) => formatPriceFa(n, decimals);
const toFaDecimal = (n: number) => n.toLocaleString('fa-IR', { maximumFractionDigits: 2 });

// Theme-aware signal colors
function signalStyle(signal: 'bullish' | 'bearish' | 'neutral' | undefined, c: ReturnType<typeof useTheme>['colors']) {
  if (!signal || signal === 'neutral') return { color: c.neutralColor, bg: c.neutralBg, border: c.neutralColor + '33' };
  if (signal === 'bullish') return { color: c.bullColor, bg: c.bullBg, border: c.bullColor + '33' };
  return { color: c.bearColor, bg: c.bearBg, border: c.bearColor + '33' };
}

// All TGJU-based categories that use the tgju.org chart API
// NOTE: gold_etf removed — gold ETFs are TSE-listed instruments and use TSE data
const TGJU_CATEGORIES = new Set([
  'currency', 'gold', 'silver',
  'crypto', 'world_index', 'foreign_stock', 'forex', 'energy', 'metal', 'commodity',
]);

// Auto-refresh interval (60 seconds)
  const REFRESH_INTERVAL = 300_000;

  // ─── Empty State ────────────────────────────────────────────────
  function EmptyState() {
    const { colors: C } = useTheme();
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6" style={{ background: C.primaryBg, border: `2px solid ${C.border}` }}>
          <BarChart3 className="w-10 h-10" style={{ color: C.primary }} />
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: C.cardFg }}>تحلیلی برای نمایش نیست</h3>
        <p className="text-sm max-w-md mb-6" style={{ color: C.cardSubFg }}>
          نماد مورد نظر خود را در نوار جستجو وارد کنید تا تحلیل تکنیکال آن را ببینید.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {['سهام بورس', 'ارزها', 'طلا و سکه', 'کریپتو'].map((label) => (
            <span key={label} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: C.primaryBg, color: C.primary, border: `1px solid ${C.border}` }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }

// Sidebar items
const SIDEBAR_ITEMS = [
  { id: 'indicators', label: 'اندیکاتورها', icon: Activity, color: 'text-cyan-400', activeBg: 'bg-cyan-400/10 border-cyan-400/20', hoverBg: 'hover:bg-cyan-400/5' },
  { id: 'patterns', label: 'الگوهای تکنیکال', icon: Activity, color: 'text-pink-400', activeBg: 'bg-pink-400/10 border-pink-400/20', hoverBg: 'hover:bg-pink-400/5' },
  { id: 'ml-forecast', label: 'یادگیری ماشین', icon: BrainCircuit, color: 'text-orange-400', activeBg: 'bg-orange-400/10 border-orange-400/20', hoverBg: 'hover:bg-orange-400/5' },
  { id: 'time-series', label: 'تحلیل سری زمان', icon: TrendingUp, color: 'text-green-400', activeBg: 'bg-green-400/10 border-green-400/20', hoverBg: 'hover:bg-green-400/5' },
  { id: 'graph', label: 'گراف تصمیم', icon: GitBranch, color: 'text-amber-400', activeBg: 'bg-amber-400/10 border-amber-400/20', hoverBg: 'hover:bg-amber-400/5' },
  { id: 'visual', label: 'توضیح‌دهنده تصویری', icon: FileText, color: 'text-purple-400', activeBg: 'bg-purple-400/10 border-purple-400/20', hoverBg: 'hover:bg-purple-400/5' },
] as const;

type SidebarItem = typeof SIDEBAR_ITEMS[number]['id'];
type PageId = 'analysis' | 'help' | 'docs';

const NAV_ITEMS: { id: PageId; label: string; icon: typeof BarChart3 }[] = [
  { id: 'analysis', label: 'تحلیل بازار', icon: BarChart3 },
  { id: 'help', label: 'راهنما', icon: HelpCircle },
  { id: 'docs', label: 'مستندات', icon: BookOpen },
];

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
  { label: 'کالاهای جهانی', cls: 'bg-lime-50 text-lime-700 border border-lime-100' },
  { label: 'سهام جهانی', cls: 'bg-indigo-50 text-indigo-700 border border-indigo-100' },
  { label: 'ETF جهانی', cls: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100' },
  { label: 'شاخص‌ها', cls: 'bg-rose-50 text-rose-700 border border-rose-100' },
  { label: 'صندوق‌ها', cls: 'bg-purple-50 text-purple-700 border border-purple-100' },
];

function LandingPage({ onSearch }: { onSearch: (symbol: string, category?: string, insCode?: string, tgjuKey?: string, finpySector?: string, finpyIndex?: string, webId?: number, yahooSymbol?: string) => void }) {
  return (
    <div className="space-y-16 pb-16">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 px-6 py-16 sm:px-12 sm:py-24 text-center">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-300/40 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-300/40 via-transparent to-transparent" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-blue-200 text-xs font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-sky-300 animate-pulse" />
            نسخه ۶.۰ — تحلیل هوشمند با AI
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 leading-tight">
            تحلیل تکنیکال{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-blue-200">هوشمند</span>{' '}
            بازار ایران
          </h2>
          <p className="text-blue-100 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            سیستم جامع تحلیل تکنیکال با موتور ۷ لایه VDss، انتخاب خودکار مکتب تحلیلی با ML،
            گراف تصمیم هوشمند و تحلیل متنی تولیدشده توسط هوش مصنوعی.
          </p>
          <div className="max-w-2xl mx-auto">
            <SymbolSearch onSelect={onSearch} placeholder="جستجوی نماد، ارز، طلا، کریپتو، شاخص، سهام جهانی ..." />
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {MARKETS.map((m) => (
              <span key={m.label} className={`px-3 py-1 rounded-full text-[10px] font-medium ${m.cls}`}>{m.label}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section>
        <div className="text-center mb-10">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">قابلیت‌های کلیدی</h3>
          <p className="text-blue-600 text-sm max-w-xl mx-auto">
            ترکیب مهندسی مالی و هوش مصنوعی برای تحلیل حرفه‌ای بازارهای مالی ایران
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="group rounded-2xl border border-blue-100 bg-white p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                  <Icon className="w-5 h-5 text-blue-700" />
                </div>
                <h4 className="font-bold text-gray-900 mb-1.5">{f.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            );
              })}
            </div>
      </section>

      {/* HOW IT WORKS */}
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
              <div className="w-12 h-12 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center mx-auto mb-4 text-blue-800 font-black text-lg">
                {s.step}
              </div>
              <h4 className="font-bold text-gray-900 mb-1">{s.title}</h4>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI SYSTEM EXPLANATION */}
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/30 p-8 sm:p-12">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">سیستم هوشمند ترکیبی AI</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="text-center p-4">
              <div className="text-3xl font-black text-blue-700 mb-1">۱۰</div>
              <div className="text-sm font-bold text-gray-900">مکتب تحلیل تکنیکال</div>
              <div className="text-xs text-gray-500 mt-1">روند، الگوهای کلاسیک، کندلی، فیبوناچی، نوسان، اسیلاتور، حمایت/مقاومت، فاز و چرخه، چندزمانی، روانشناختی</div>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl font-black text-sky-700 mb-1">۱۰</div>
              <div className="text-sm font-bold text-gray-900">سبک روایت</div>
              <div className="text-xs text-gray-500 mt-1">محافظه‌کار، اسکالپر، روندگرا، بدبین، روایی، تصمیم‌محور، تحلیلگر حجم، تحلیلگر الگو، روانشناختی، تحلیلگر نوسان</div>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl font-black text-indigo-700 mb-1">۱۵</div>
              <div className="text-sm font-bold text-gray-900">لحن تحلیلی</div>
              <div className="text-xs text-gray-500 mt-1">رسمی، سریع، فلسفی، هشداردهنده، داستانی، گام‌به‌گام، شکاک، خوشبین، ساده، عددمحور، چندلایه، آموزشی و ...</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-blue-100 p-5 text-sm text-gray-600 leading-relaxed">
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

      {/* DATA SOURCES */}
      <section>
        <div className="text-center mb-10">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">منابع داده</h3>
          <p className="text-blue-600 text-sm">داده‌های واقعی از منابع معتبر</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-4xl mx-auto">
          <div className="rounded-xl border border-blue-200 p-5 bg-white text-center">
            <div className="font-bold text-gray-900 mb-1">TSETMC</div>
            <p className="text-xs text-gray-500 leading-relaxed">داده‌های تعدیل‌شده سهام بورس تهران و اوراق بدهی</p>
          </div>
          <div className="rounded-xl border border-teal-300 p-5 bg-white text-center">
            <div className="font-bold text-gray-900 mb-1">TGJU (تارا)</div>
            <p className="text-xs text-gray-500 leading-relaxed">ارزها، طلا، سکه، کریپتو، فارکس، بورس جهانی، نفت و فلزات</p>
          </div>
          <div className="rounded-xl border border-indigo-300 p-5 bg-white text-center">
            <div className="font-bold text-gray-900 mb-1">Yahoo Finance</div>
            <p className="text-xs text-gray-500 leading-relaxed">سهام جهانی از آمریکا، اروپا، آسیا، خاورمیانه و آمریکای لاتین</p>
          </div>
          <div className="rounded-xl border border-blue-200 p-5 bg-white text-center">
            <div className="font-bold text-gray-900 mb-1">Finpy-TSE</div>
            <p className="text-xs text-gray-500 leading-relaxed">شاخص‌های اصلی و گروهی بورس تهران با تاریخچه CDN</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Main Home Component ────────────────────────────────────────
  export default function Home() {
    const [data, setData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activePanel, setActivePanel] = useState<SidebarItem>('visual');
    const [refreshing, setRefreshing] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [currentPage, setCurrentPage] = useState<PageId>('analysis');
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  // Store last fetch params for auto-refresh
  const lastFetchRef = useRef<{ symbol: string; category?: string; insCode?: string; tgjuKey?: string; finpySector?: string; finpyIndex?: string; webId?: number; yahooSymbol?: string } | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);

  // Chart container ref for image export
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(async (symbol: string, category?: string, insCode?: string, tgjuKey?: string, finpySector?: string, finpyIndex?: string, webId?: number, yahooSymbol?: string) => {
    // Abort any previous in-flight fetch
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    // Yahoo Finance instrument: fetch historical data via Yahoo Finance API
    // This handles ALL Yahoo instruments (stocks, indices, energy, metals, forex, crypto, ETFs, etc.)
    if (yahooSymbol) {
      setLoading(true);
      setLoadingMessage('در حال دریافت داده‌های تاریخی از یاهو فایننس ...');
      setError(null);
      setData(null);
      lastFetchRef.current = { symbol, category, insCode, tgjuKey, finpySector, finpyIndex, webId, yahooSymbol };
      try {
        const res = await fetch('/api/yahoo-analysis?symbol=' + encodeURIComponent(yahooSymbol), { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          let errMsg = 'خطا در دریافت داده‌های تاریخی';
          try { const err = await res.json(); if (err.error) errMsg = err.error; } catch (_) { /* non-JSON error */ }
          throw new Error(errMsg);
        }
        const json = await res.json();
        if (controller.signal.aborted) return;
        if (!json.candles || json.candles.length === 0 || !json.ta) {
          throw new Error(json.error || 'داده‌های تاریخی کافی برای تحلیل وجود ندارد');
        }
        setData({ ...json, isYahoo: true });
        setActivePanel('visual');
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(String(err));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMessage(null);
        }
      }
      return;
    }

    // TGJU instrument: fetch historical data via tgju.org chart API
    if (category && TGJU_CATEGORIES.has(category) && tgjuKey) {
      setLoading(true);
      setLoadingMessage('در حال دریافت داده‌های تاریخی ...');
      setError(null);
      setData(null);
      lastFetchRef.current = { symbol, category, insCode, tgjuKey, finpySector, finpyIndex, webId, yahooSymbol };
      try {
        const res = await fetch('/api/tgju-analysis?key=' + encodeURIComponent(tgjuKey), { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          let errMsg = 'خطا در دریافت داده‌های تاریخی';
          if (res.status === 502 || res.status === 503) {
            errMsg = 'سرور منبع داده (TGJU) در حال حاضر در دسترس نیست. لطفاً چند دقیقه دیگر تلاش کنید.';
          }
          try { const err = await res.json(); if (err.error) errMsg = err.error; } catch (_) { /* non-JSON error */ }
          throw new Error(errMsg);
        }
        const json = await res.json();
        if (controller.signal.aborted) return;
        if (!json.candles || json.candles.length === 0 || !json.ta) {
          throw new Error(json.error || 'داده‌های تاریخی کافی برای تحلیل وجود ندارد');
        }
        setData({ ...json, isTgju: true });
        setActivePanel('visual');
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(String(err));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMessage(null);
        }
      }
      return;
    }

    // Index: fetch historical data via TSETMC CDN (webId), then finpy-tse (finpyIndex/finpySector)
    if (category === 'index') {
      setLoading(true);
      setLoadingMessage('در حال دریافت داده‌های شاخص از TSETMC ...');
      setError(null);
      setData(null);
      lastFetchRef.current = { symbol, category, insCode, tgjuKey, finpySector, finpyIndex, webId, yahooSymbol };
      let lastErrorMsg = '';
      const idxTimeout = AbortSignal.timeout(30_000); // 30s timeout per attempt
      try {
        // 1. Try webId (TSETMC CDN)
        if (webId) {
          setLoadingMessage('در حال دریافت داده‌های شاخص از TSETMC ...');
          try {
            const res = await fetch('/api/finpy-sector?webId=' + encodeURIComponent(String(webId)), { signal: idxTimeout });
            if (controller.signal.aborted) return;
            if (res.ok) {
              try {
                const json = await res.json();
                if (controller.signal.aborted) return;
                if (json.candles && json.candles.length > 0 && json.ta) {
                  setData(json);
                  setActivePanel('visual');
                  setLoading(false);
                  setLoadingMessage(null);
                  return;
                }
                if (json.error) lastErrorMsg = json.error;
              } catch (_) { /* invalid JSON */ }
            } else {
              try { const errBody = await res.json(); if (errBody?.error) lastErrorMsg = errBody.error; } catch (_) { lastErrorMsg = `خطای سرور (${res.status})`; }
            }
          } catch (fetchErr: unknown) {
            if (controller.signal.aborted) return;
            if (fetchErr instanceof DOMException && fetchErr.name === 'TimeoutError') lastErrorMsg = 'زمان دریافت داده‌های شاخص به پایان رسید.';
            else if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') return;
          }
        }

        // 2. Main indices via finpy-tse
        if (finpyIndex) {
          setLoadingMessage('در حال دریافت داده‌های شاخص اصلی ...');
          try {
            const res = await fetch('/api/finpy-sector?indexKey=' + encodeURIComponent(finpyIndex), { signal: idxTimeout });
            if (controller.signal.aborted) return;
            if (res.ok) {
              try {
                const json = await res.json();
                if (controller.signal.aborted) return;
                if (json.candles && json.candles.length > 0 && json.ta) {
                  setData(json);
                  setActivePanel('visual');
                  setLoading(false);
                  setLoadingMessage(null);
                  return;
                }
                if (json.error) lastErrorMsg = json.error;
              } catch (_) { /* invalid JSON */ }
            } else {
              try { const errBody = await res.json(); if (errBody?.error) lastErrorMsg = errBody.error; } catch (_) { lastErrorMsg = `خطای سرور (${res.status})`; }
            }
          } catch (fetchErr: unknown) {
            if (controller.signal.aborted) return;
            if (fetchErr instanceof DOMException && fetchErr.name === 'TimeoutError') lastErrorMsg = 'زمان دریافت داده‌های شاخص به پایان رسید.';
            else if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') return;
          }
        }

        // 3. Sector indices via finpy-tse
        if (finpySector) {
          setLoadingMessage('در حال دریافت داده‌های شاخص گروه ...');
          try {
            const res = await fetch('/api/finpy-sector?sector=' + encodeURIComponent(finpySector), { signal: idxTimeout });
            if (controller.signal.aborted) return;
            if (res.ok) {
              try {
                const json = await res.json();
                if (controller.signal.aborted) return;
                if (json.candles && json.candles.length > 0 && json.ta) {
                  setData(json);
                  setActivePanel('visual');
                  setLoading(false);
                  setLoadingMessage(null);
                  return;
                }
                if (json.error) lastErrorMsg = json.error;
              } catch (_) { /* invalid JSON */ }
            } else {
              try { const errBody = await res.json(); if (errBody?.error) lastErrorMsg = errBody.error; } catch (_) { lastErrorMsg = `خطای سرور (${res.status})`; }
            }
          } catch (fetchErr: unknown) {
            if (controller.signal.aborted) return;
            if (fetchErr instanceof DOMException && fetchErr.name === 'TimeoutError') lastErrorMsg = 'زمان دریافت داده‌های شاخص به پایان رسید.';
            else if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') return;
          }
        }

        // 4. Fallback: try TSETMC SOAP API via /api/analysis with indexInsCode
        if (insCode) {
          setLoadingMessage('در حال دریافت داده‌های شاخص از TSETMC ...');
          try {
            const res = await fetch('/api/analysis?symbol=' + encodeURIComponent(symbol) + '&indexInsCode=' + encodeURIComponent(insCode), { signal: controller.signal });
            if (controller.signal.aborted) return;
            if (res.ok) {
              try {
                const json = await res.json();
                if (controller.signal.aborted) return;
                if (json.candles && json.candles.length > 0 && json.ta) {
                  setData(json);
                  setActivePanel('visual');
                  setLoading(false);
                  setLoadingMessage(null);
                  return;
                }
              } catch (_) { /* invalid JSON */ }
            }
          } catch (fetchErr: unknown) {
            if (controller.signal.aborted) return;
            if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') return;
          }
        }

        setError(lastErrorMsg || 'داده‌های تاریخی این شاخص در حال حاضر قابل دسترسی نیست.');
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(String(err));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMessage(null);
        }
      }
      return;
    }

    // Regular TSE instrument: full TA analysis (تعدیل شده / adjusted prices only)
    setLoading(true);
    setError(null);
    setData(null);
    lastFetchRef.current = { symbol, category, insCode, tgjuKey, finpySector, finpyIndex, webId, yahooSymbol };
    try {
      const res = await fetch('/api/analysis?symbol=' + encodeURIComponent(symbol), { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        let errMsg = 'خطا در دریافت داده‌ها';
        try { const err = await res.json(); if (err.error) errMsg = err.error; } catch (_) {
          if (res.status === 502) errMsg = 'سرور داده در دسترس نیست. لطفاً دوباره تلاش کنید.';
          else if (res.status === 503) errMsg = 'سرور داده موقتاً در دسترس نیست.';
        }
        throw new Error(errMsg);
      }
      const json = await res.json();
      if (controller.signal.aborted) return;
      setData(json);
      setActivePanel('visual');
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(String(err));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // Auto-refresh: data re-fetch + on tab focus
  const doRefresh = useCallback(async () => {
    const params = lastFetchRef.current;
    if (!params) return;
    if (loading || refreshing) return;
    setRefreshing(true);
    try {
      await handleSelect(params.symbol, params.category, params.insCode, params.tgjuKey, params.finpySector, params.finpyIndex, params.webId, params.yahooSymbol);
    } catch (_) {
      // Silently handle refresh errors
    } finally {
      setRefreshing(false);
    }
  }, [handleSelect, loading, refreshing]);

  // Soft refresh every 15 minutes (re-fetch data instead of hard reload — reload crashes iframes)
  useEffect(() => {
    const timer = setInterval(() => {
      doRefresh().catch(() => {});
    }, 900_000);
    return () => clearInterval(timer);
  }, [doRefresh]);

  useEffect(() => {
    if (!data) return;
    refreshTimerRef.current = setInterval(doRefresh, REFRESH_INTERVAL);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [data, doRefresh]);

  // Refresh on tab/window focus (wrapped for iframe safety)
  useEffect(() => {
    const onFocus = () => {
      if (data) doRefresh().catch(() => {});
    };
    try {
      window.addEventListener('focus', onFocus);
      return () => { try { window.removeEventListener('focus', onFocus); } catch {} };
    } catch {
      return undefined;
    }
  }, [data, doRefresh]);

  // Use info.lastPrice (live) when available, otherwise fall back to last candle close.
  // This ensures header price and all analysis panels show the same reference price.
  const { colors: C, isDark, setTheme, themeId } = useTheme();

  const lastPrice = data?.info?.lastPrice
    ?? (data?.ta ? data.candles[data.candles.length - 1]?.close ?? 0 : 0);
  const decimals = data?.info?.decimals ?? 0;
  const currencyUnit = data?.info?.currencyUnit ?? 'ریال';
  const SignalIcon = data?.ta?.overallSignal === 'bullish' ? TrendingUp : data?.ta?.overallSignal === 'bearish' ? TrendingDown : Activity;
  const sig = signalStyle(data?.ta?.overallSignal, C);

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

  // ─── renderAnalysisContent: all analysis page views via closure ───
  function renderAnalysisContent() {
    return (
      <div>
{!data && !loading && !error && (
  <EmptyState />
)}

        {loading && (
          <div className="space-y-4 py-8">
            {loadingMessage && (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: C.primary, borderTopColor: C.cardFg }} />
                <span className="text-sm" style={{ color: C.primary }}>{loadingMessage}</span>
              </div>
            )}
            <Skeleton className="h-8 w-48 rounded-xl" style={{ background: C.cardBorder }} />
            <Skeleton className="h-[500px] w-full rounded-xl" style={{ background: C.cardBorder }} />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-32 rounded-xl" style={{ background: C.cardBorder }} />
              <Skeleton className="h-32 rounded-xl" style={{ background: C.cardBorder }} />
              <Skeleton className="h-32 rounded-xl" style={{ background: C.cardBorder }} />
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-red-700 mb-2">خطا در دریافت داده‌ها</h3>
            <p className="text-gray-500 text-sm max-w-md mb-6">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setError(null); setData(null); }}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer"
              >
                بازگشت
              </button>
              {lastFetchRef.current && (
                <button
                  onClick={() => { setError(null); doRefresh(); }}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  تلاش مجدد
                </button>
              )}
            </div>
          </div>
        )}

        {data && !loading && (
          <div className="flex gap-4 items-start">
            {/* RIGHT SIDEBAR (first in RTL = visual right) */}
            {sidebarCollapsed ? (
              <CollapsedSidebarExpand onExpand={() => setSidebarCollapsed(false)} />
            ) : (
              <AnalysisSidebar
                data={data}
                collapsed={sidebarCollapsed}
                setCollapsed={setSidebarCollapsed}
                priceDecimals={decimals}
              />
            )}

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Info Grid */}
              {data.info && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'اولین', value: toFa(data.info.openPrice, decimals) },
                    { label: 'بیشترین', value: toFa(data.info.maxPrice, decimals), cls: 'text-emerald-600' },
                    { label: 'کمترین', value: toFa(data.info.minPrice, decimals), cls: 'text-red-600' },
                    { label: 'پایانی', value: toFa(data.info.closePrice, decimals) },
                    ...(data.ta.hasVolume ? [
                      { label: 'حجم معاملات', value: toPersianDigits((data.info.volume / 1e6).toFixed(1)) + 'M' },
                      { label: 'ارزش معاملات', value: toPersianDigits((data.info.value / 1e9).toFixed(1)) + 'B' },
                      { label: 'تعداد معاملات', value: toFa(data.info.trades) },
                      { label: 'P/E', value: data.info.pe > 0 ? toFa(data.info.pe) : '—' },
                    ] : [
                      { label: 'P/E', value: data.info.pe > 0 ? toFa(data.info.pe) : '—' },
                    ]),
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg px-3 py-2 border" style={{ background: C.cardBg, borderColor: C.cardBorder }}>
                      <div className="text-[10px] mb-0.5" style={{ color: C.cardSubFg }}>{s.label}</div>
                      <div className={`text-sm font-bold ${(s as { cls?: string }).cls || ''}`}>{s.value}</div>
                    </div>
                  ))}
                  {isTgjuData && (
                    <div className="rounded-lg px-3 py-2 border" style={{ background: C.primaryBg, borderColor: C.border }}>
                      <div className="text-[10px] mb-0.5" style={{ color: C.primary }}>{isTgjuData ? 'منبع داده' : ''}</div>
                      <div className="text-sm font-bold" style={{ color: C.primary }}>TGJU (تارا)</div>
                    </div>
                  )}
                   {data.isYahoo && (
                     <div className="rounded-lg px-3 py-2 border" style={{ background: C.primaryBg, borderColor: C.border }}>
                       <div className="text-[10px] mb-0.5" style={{ color: C.primary }}>منبع داده</div>
                       <div className="text-sm font-bold" style={{ color: C.primary }}>Yahoo Finance</div>
                     </div>
                   )}
                 </div>
               )}

              {/* PANEL: Indicators */}
              {activePanel === 'indicators' && (
                <IndicatorsPanel ta={data.ta} instrumentCategory={data.info?.category} priceDecimals={decimals} />
              )}

               {/* PANEL: Patterns */}
               {activePanel === 'patterns' && (
                 <PatternsPanel data={data} priceDecimals={decimals} instrumentCategory={data.info?.category} />
               )}

               {/* PANEL: ML Forecast */}
               {activePanel === 'ml-forecast' && (
                 <MLForecast 
                   symbolName={data.info?.name ?? data.symbol} 
                   candles={data.candles} 
                   currentPrice={lastPrice} 
                   priceDecimals={decimals} 
                 />
               )}

               {/* PANEL: Time Series Analysis */}
               {activePanel === 'time-series' && (
                 <TimeSeriesPanel 
                   symbol={data.symbol} 
                   candles={data.candles} 
                   currentPrice={lastPrice} 
                   priceDecimals={decimals} 
                 />
               )}

              {/* PANEL: Decision Graph */}
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
                  decisionGraph={data.ta.decisionGraph}
                  probabilityTrend={data.probabilityTrend}
                  currencyUnit={currencyUnit}
                  atr={data.ta.atr}
                  instrumentType={data.isTgju ? 'tgju' : data.isYahoo ? 'yahoo' : 'tse'}
                  instrumentCategory={data.info?.category}
                  priceDecimals={decimals}
                />
              )}

              {/* PANEL: Visual Describer */}
              {activePanel === 'visual' && (
                <div className="space-y-4">
                  <div id="chart-export-wrapper" ref={chartWrapperRef}>
                    <CandlestickChart data={data.candles} ta={chartTa} height={520} priceDecimals={decimals} />
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
                    instrumentType={data.isTgju ? 'tgju' : data.isYahoo ? 'yahoo' : 'tse'}
                    instrumentCategory={data.info?.category}
                    currencyUnit={currencyUnit}
                    priceDecimals={decimals}
                    probabilityTrend={data.probabilityTrend}
                    decisionGraph={data.ta.decisionGraph}
                    regimeResult={data.ta.regimeResult}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile bottom nav */}
        {data && !loading && (
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 px-2 py-2 flex items-center gap-1 border-t" style={{ background: C.headerBg, backdropFilter: 'blur(14px)', borderColor: C.headerBorder }}>
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePanel === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePanel(item.id)}
                  className="flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer min-h-[44px]"
                  style={{
                    color: isActive ? C.primaryFg : C.cardSubFg,
                    background: isActive ? C.primary : 'transparent',
                  }}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col" style={{ background: C.pageBg, color: C.pageFg }}>
      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-xl" style={{ borderBottom: `1px solid ${C.headerBorder}`, background: C.headerBg }}>
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.logoBg, border: `1px solid ${C.logoBorderColor}` }}>
              <BarChart3 className="w-5 h-5" style={{ color: C.logoColor }} />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight" style={{ color: C.headerFg }}>تحلیل تکنیکال بازار</h1>
              <p style={{ fontSize: '10px', color: C.headerSubFg }}>بورس + ارز + طلا + کریپتو + فارکس + بورس جهانی (TSETMC و TGJU)</p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[260px] max-w-2xl">
            <SymbolSearch onSelect={handleSelect} placeholder="جستجوی نماد، ارز، طلا، کریپتو، شاخص ..." />
          </div>

{/* Page Navigation + Theme Switcher */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: C.primaryBg, borderWidth: '1px', borderStyle: 'solid', borderColor: C.border }}>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all cursor-pointer min-h-[36px]"
                    style={isActive ? { background: C.primary, color: C.primaryFg, borderWidth: '1px', borderStyle: 'solid', borderColor: C.border } : { color: C.cardSubFg, borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent' }}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                );
              })}
              <Link
                href="/settings"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all cursor-pointer"
                style={{ color: C.cardSubFg }}
                aria-label=" Configure "
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </div>

              {/* Theme Switcher */}
            <div className="relative group">
              <button
                className="flex items-center justify-center w-10 h-10 rounded-lg transition-all cursor-pointer hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                style={{ background: C.primaryBg, border: `1px solid ${C.border}`, color: C.cardSubFg }}
                aria-label="تغییر پوسته"
                aria-haspopup="true"
                aria-expanded={themeMenuOpen}
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              >
                <Palette className="w-4 h-4" />
              </button>
              <div
                className={`absolute top-full mt-1 right-0 min-w-[160px] rounded-lg border p-1 transition-all z-50 ${
                  themeMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
                }`}
                style={{ background: C.cardBg, borderColor: C.cardBorder, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
              >
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setTheme(preset.id);
                      setThemeMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-medium transition-all cursor-pointer text-right min-h-[40px] hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    style={themeId === preset.id ? { background: C.primary, color: C.primaryFg } : { color: C.cardFg }}
                    aria-label={`پوسته ${preset.name}`}
                    aria-pressed={themeId === preset.id}
                  >
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ background: preset.colors.primary }} />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

{/* Symbol Info */}
            {data?.info && (
              <div className="flex items-center gap-4 text-sm shrink-0">
                <div className="text-left">
                  <div className="text-xs" style={{ color: C.cardSubFg }}>{data.info.name}</div>
                  <div className="font-bold text-lg" style={{ color: C.cardFg }}>
                    {toFa(data.info.lastPrice, decimals)}
                    <span className="text-[10px] mr-1.5 opacity-60">{currencyUnit}</span>
                    <span className="text-xs mr-2" style={{ color: data.info.change >= 0 ? C.bullColor : C.bearColor }}>
                      {data.info.change >= 0 ? '▲' : '▼'} {toFaDecimal(Math.abs(data.info.change))}%
                    </span>
                  </div>
                </div>
                {isTgjuData && (
                  <span className="px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 min-h-[36px]" style={{ background: C.primaryBg, border: `1px solid ${C.border}`, color: C.accent }}>
                    <Coins className="w-4 h-4" /> TGJU
                  </span>
                )}
                <div className="px-3 py-1.5 rounded-lg min-h-[36px]" style={{ border: `1px solid ${sig.border}`, background: sig.bg }}>
                  <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: sig.color }}>
                    <SignalIcon className="w-3.5 h-3.5" />
                    {data.ta.overallSignal === 'bullish' ? 'صعودی' : data.ta.overallSignal === 'bearish' ? 'نزولی' : 'خنثی'}
                  </div>
                </div>
                {/* Refresh button */}
                <button
                  onClick={doRefresh}
                  disabled={refreshing || loading}
                  className="p-2.5 rounded-lg transition-all disabled:opacity-50 cursor-pointer min-h-[36px] w-10"
                  style={{ border: `1px solid ${C.border}`, color: C.cardSubFg }}
                  title="به‌روزرسانی داده‌ها"
                  aria-label="به‌روزرسانی داده‌ها"
                  aria-disabled={refreshing || loading}
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
          )}
        </div>

{/* SUB-HEADER: Analysis Tools (moved from sidebar) */}
            {data && !loading && currentPage === 'analysis' && (
              <div className="border-t" style={{ borderColor: C.headerBorder, background: C.headerBg }}>
                <div className="max-w-[1800px] mx-auto px-4 py-1.5 flex items-center gap-1">
                  {SIDEBAR_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePanel === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActivePanel(item.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all cursor-pointer min-h-[36px]"
                        style={isActive ? { background: C.primary, color: C.primaryFg } : { color: C.cardSubFg }}
                        aria-label={item.label}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
      </header>

{/* MAIN CONTENT */}
       <main className="flex-1 max-w-[1800px] w-full mx-auto px-4 py-4">
 {currentPage === 'help' && <HelpPage />}
           {currentPage === 'docs' && <DocsPage />}
           {currentPage === 'analysis' && renderAnalysisContent()}
         </main>

      <footer className={`mt-auto py-3 text-center text-[10px] ${data ? 'lg:mb-14' : ''}`} style={{ borderTop: `1px solid ${C.footerBorder}`, color: C.footerFg }}>
        داده‌های بورس از TSETMC (تعدیل‌شده) | داده‌های شاخص‌ها از finpy-tse | داده‌های ارز، طلا، کریپتو، فارکس، بورس جهانی از TGJU (tgju.org) — صرفاً جنبه تحلیلی دارد و توصیه سرمایه‌گذاری نیست. | v6.0
      </footer>
    </div>
  );
}
