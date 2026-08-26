'use client';

import React from 'react';
import {
  BarChart3, TrendingUp, BrainCircuit, Shield, Zap, Globe, Coins, Building2, Bitcoin, Gem, Fuel, Package, ChevronLeft, CheckCircle2, ArrowLeft, Cpu, Search, FileText, GitBranch, Activity, Layers, Database, Clock, Lock, Gauge, Sparkles, MousePointerClick, Lightbulb, CandlestickChart, Network, Scale, Flame, Workflow, Server, Code2, ArrowUpDown, Target, BarChart2, LineChart, RefreshCw, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HomepageProps {
  onSelectCategory: (category: string) => void;
}

const SIDEBAR_SECTIONS = [
  { id: 'features', label: 'ویژگی‌ها', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'ml-engine', label: 'موتور ML و AI', icon: BrainCircuit, color: 'text-violet-600', bg: 'bg-violet-50' },
  { id: 'tools', label: 'ابزارها', icon: Cpu, color: 'text-teal-600', bg: 'bg-teal-50' },
  { id: 'markets', label: 'بازارها', icon: Globe, color: 'text-sky-600', bg: 'bg-sky-50' },
  { id: 'architecture', label: 'معماری سیستم', icon: Code2, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'how-it-works', label: 'نحوه استفاده', icon: MousePointerClick, color: 'text-emerald-600', bg: 'bg-emerald-50' },
] as const;

type SectionId = (typeof SIDEBAR_SECTIONS)[number]['id'];

const STATS = [
  { value: '۸,۰۰۰+', label: 'ابزار مالی', icon: Layers },
  { value: '۵۰', label: 'شاخص بورس (۱۰+۴۰)', icon: BarChart2 },
  { value: '۱۶+', label: 'اندیکاتور تکنیکال', icon: Activity },
  { value: '۱,۵۰۰', label: 'ترکیب روایتی AI', icon: BrainCircuit },
  { value: '۹', label: 'سناریوی احتمالی', icon: GitBranch },
  { value: '۱۷', label: 'دسته‌بندی بازار', icon: Globe },
];

const FEATURES = [
  { icon: Activity, title: 'موتور تحلیل تکنیکال بومی', desc: 'موتور TypeScript با ۱۶+ اندیکاتور: SMA, EMA, RSI, MFI, CCI, Stochastic, Williams %R, MACD, ADX, DI+/DI-, SAR, ATR, Bollinger Bands, OBV. تحلیل روند در ۳ بازه کوتاه/متوسط/بلندمدت با R-squared.', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200/60' },
  { icon: BrainCircuit, title: 'موتور روایتی ML (V12)', desc: '۱۰ مکتب تحلیل × ۱۰ سبک روایتی × ۱۵ لحن = ۱,۵۰۰ ترکیب قطعی. انتخاب بر اساس وضعیت واقعی بازار (RSI, ADX, MACD, روند, Bollinger Position).', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200/60' },
  { icon: GitBranch, title: 'گراف تصمیم VDSS (۹ سناریو)', desc: 'توپولوژی ۳-شاخه با ۲۱ گره و ۳۶ یال. مسیرهای تا ۲۰۰ احتمالی با DFS. برچسب‌گذاری پویا بر اساس سیگنال بازار (صعودی/نزولی/خنثی).', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200/60' },
  { icon: CandlestickChart, title: 'تشخیص الگوی کندل‌استیک', desc: '۱۰ الگوی اصلی: Doji, Hammer, Inverted Hammer, Bullish/Bearish Engulfing, Morning/Evening Star, Shooting Star, Bullish/Bearish Harami. امتیازبندی بافت‌محور.', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200/60' },
  { icon: Scale, title: 'وزن‌دهی بیزی داینامیک', desc: 'Beta-Binomial conjugate updating برای ۱۲ اندیکاتور. نرمال‌سازی Softmax با Temperature. تنظیم احتمال سناریوها بر اساس شواهد تاریخی.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200/60' },
  { icon: Target, title: 'پیش‌بینی ۳۰ جلسه با ML', desc: 'XGBoost + sklearn Ensemble. ۵ نوع مدل: جهت، رگرسیون، Volatility. ۵۰+ فیچر مهندسی‌شده. پیش‌بینی تکراری ۵-جلسه‌ای. TimeSeriesSplit(5).', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200/60' },
  { icon: Flame, title: 'تشخیص هارمونیک و الیوت با AI', desc: 'شناسایی نقاط چرخش (Swing Points) + تحلیل LLM برای الگوهای هارمونیک و موج الیوت. ساختاردهی شده با Prompt تخصصی فارسی.', color: 'text-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200/60' },
  { icon: Network, title: 'حمایت و مقاومت ML', desc: 'رگرسیون لجستیک با ۱۶ فیچر و TimeSeriesSplit. امتیاز ۱-۱۰ با ۵ معیار: تعداد تماس، حجم، همپوشانی، تازگی، فاصله. درجه‌بندی و اهداف قیمتی.', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200/60' },
  { icon: Shield, title: 'داده‌های واقعی و لحظه‌ای', desc: 'TSETMC (تعدیل‌شده) + finpy-tse CDN (۵۰ شاخص) + TGJU (۱۱ دسته) + BrsApi (لحظه‌ای). رهگیری نرخ محدود با صفحه‌خوان اشتراکی z-ai.', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200/60' },
];

const ML_MODELS = [
  { name: 'XGBoost جهت', nameEn: 'XGBClassifier', desc: 'پیش‌بینی جهت حرکت (صعودی/نزولی)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { name: 'XGBoost رگرسیون', nameEn: 'XGBRegressor', desc: 'پیش‌بینی قیمت هدف', color: 'text-teal-700 bg-teal-50 border-teal-200' },
  { name: 'Ensemble جهت', nameEn: 'GradientBoostingClassifier', desc: 'طبقه‌بندی جهت با مجموعه مدل‌ها', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { name: 'Ensemble رگرسیون', nameEn: 'GradientBoostingRegressor', desc: 'رگرسیون قیمت با مجموعه مدل‌ها', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { name: 'مدل نوسان‌پذیری', nameEn: 'RandomForestRegressor', desc: 'پیش‌بینی ATR و دامنه قیمتی', color: 'text-rose-700 bg-rose-50 border-rose-200' },
];

const ML_FEATURES = [
  'بازده قیمت (1/2/3/5/10 جلسه)',
  'آمار غلتنده (میانگین/انحراف معیار/Skewness/Kurtosis)',
  'RSI, MACD, Stochastic, CCI',
  'ATR, ADX, Bollinger Position',
  'OBV و فیچرهای حجمی',
  'الگوهای قیمتی (Higher High/Lower Low)',
  'شتاب (Momentum) در ۵ بازه',
  'Lag Features (5/10/20 جلسه قبل)',
];

const SCHOOLS_LIST = [
  'تحلیل روند', 'الگوهای کلاسیک', 'نوسان‌نماها', 'موج‌شماری',
  'تحلیل حجمی', 'اقتصادسنجی مالی', 'تحلیل روانشناسی', 'تحلیل نوسان‌پذیری',
  'تحلیل‌گر الگو', 'الگوریتمی-کمی',
];

const STEPS = [
  { step: '۱', icon: Search, title: 'جستجوی نماد', desc: 'نام نماد، ارز، کریپتو یا شاخص را وارد کنید. ۸,۰۰۰+ ابزار مالی در ۱۷ دسته‌بندی.', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { step: '۲', icon: Workflow, title: 'پردازش و تحلیل', desc: 'دریافت داده‌های تاریخی + محاسبه ۱۶+ اندیکاتور + تشخیص ۱۰ الگوی کندل + وزن‌دهی بیزی + پیش‌بینی ML + تحلیل AI.', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  { step: '۳', icon: Eye, title: 'تصمیم‌گیری آگاهانه', desc: 'تحلیل روایتی V12 (۸۰۰-۱۸۰۰ کلمه)، گراف تصمیم ۹ سناریویی، نمودار TradingView و پنل اندیکاتورها.', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
];

const MARKETS = [
  { icon: Building2, title: 'بورس تهران', desc: 'سهام، صندوق، اوراق بدهی و مشتقه', count: '۸,۰۰۰+', color: 'bg-gray-100 text-gray-600', onClick: 'stocks' },
  { icon: BarChart3, title: 'شاخص‌های بورس', desc: '۱۰ اصلی + ۴۰ صنعت (finpy-tse)', count: '۵۰', color: 'bg-rose-50 text-rose-600', onClick: 'indices' },
  { icon: Coins, title: 'ارز و طلا', desc: 'دلار، یورو، سکه و طلا', count: '۲۰+', color: 'bg-teal-50 text-teal-600', onClick: 'currency' },
  { icon: Bitcoin, title: 'ارزهای دیجیتال', desc: 'بیت‌کوین، اتریوم و آلت‌کوین‌ها', count: '۲۵+', color: 'bg-orange-50 text-orange-600', onClick: 'crypto' },
  { icon: Globe, title: 'بورس جهانی', desc: 'داو جونز، نزدک، S&P 500 و...', count: '۳۷+', color: 'bg-sky-50 text-sky-600', onClick: 'world_index' },
  { icon: Gem, title: 'فلزات جهانی', desc: 'طلا جهانی، نقره، مس و...', count: '۲۰+', color: 'bg-emerald-50 text-emerald-600', onClick: 'metal' },
  { icon: Fuel, title: 'نفت و انرژی', desc: 'نفت برنت، WTI و گاز طبیعی', count: '۱۰+', color: 'bg-red-50 text-red-600', onClick: 'energy' },
  { icon: Package, title: 'کالاهای جهانی', desc: 'گندم، ذرت، سویا، قهوه و...', count: '۱۱+', color: 'bg-lime-50 text-lime-700', onClick: 'commodity' },
];

const TOOLS = [
  { label: 'اندیکاتورها', desc: 'SMA(21,50,100,200), EMA(12,26,50,100,200), RSI, MFI, CCI, Stochastic K/D, Williams %R, MACD, ADX, DI+/DI-, SAR, ATR, Bollinger Bands, OBV', color: 'text-teal-600' },
  { label: 'گراف تصمیم VDSS', desc: '۹ سناریوی نهایی، ۲۱ گره (تصمیم/رویداد/پایانی)، ۳۶ یال، ۳ شاخه (روند/شکست/بازگشت)، ۲۰۰ مسیر احتمالی با DFS', color: 'text-amber-600' },
  { label: 'تحلیل تصویری AI (V12)', desc: '۱۰ مکتب × ۱۰ سبک × ۱۵ لحن = ۱,۵۰۰ ترکیب. انتخاب قطعی بر اساس RSI, ADX, MACD, روند, Bollinger. خروجی ۸۰۰-۱۸۰۰ کلمه فارسی.', color: 'text-violet-600' },
  { label: 'پیش‌بینی ML ۳۰ جلسه', desc: 'سرویس Python (port 3032). XGBoost + sklearn. ۵ مدل. ۵۰+ فیچر. TimeSeriesSplit(5). صادر ONNX. پیش‌بینی تکراری ۵-جلسه‌ای.', color: 'text-rose-600' },
  { label: 'الگوی کندل‌استیک', desc: '۱۰ الگو: Doji, Hammer, Inverted Hammer, Engulfing صعودی/نزولی, Morning/Evening Star, Shooting Star, Harami صعودی/نزولی. بافت‌محور.', color: 'text-orange-600' },
  { label: 'وزن‌دهی بیزی', desc: '۱۲ اندیکاتور با Beta-Binomial. Softmax نرمالیزه. تنظیم احتمال سناریو ±۱۵٪. به‌روزرسانی پس از هر پیش‌بینی.', color: 'text-emerald-600' },
  { label: 'هارمونیک و الیوت AI', desc: 'شناسایی Swing Points + LLM برای الگوهای هارمونیک و موج الیوت. Prompt ساختاریافته فارسی.', color: 'text-fuchsia-600' },
  { label: 'حمایت و مقاومت ML', desc: 'رگرسیون لجستیک ۱۶ فیچری. امتیاز ۱-۱۰ (تماس/حجم/همپوشانی/تازگی/فاصله). ۶ سطح هر طرف + اهداف قیمتی.', color: 'text-cyan-600' },
  { label: 'نمودار TradingView', desc: 'نمودار حرفه‌ای TradingView v25 با ابزار رسم، اندیکاتور تعاملی و تاریخچه کامل.', color: 'text-sky-600' },
];

const ARCHITECTURE = [
  { label: 'فرانت‌اند', desc: 'Next.js 16 + App Router + TypeScript 5 + Tailwind CSS 4 + shadcn/ui + Lucide Icons', color: 'text-sky-600' },
  { label: 'API Routes', desc: '/api/analysis, /api/tgju-analysis, /api/index-analysis — یک موتور واحد', color: 'text-amber-600' },
  { label: 'موتور تحلیل', desc: 'ta-engine.ts — محاسبه ۱۶+ اندیکاتور + ۹ سناریو + ML LogReg + S/R + V12 Scenario Engine', color: 'text-teal-600' },
  { label: 'گراف تصمیم', desc: 'vdss-algorithms.ts — ۲۱ گره + ۳۶ یال + ۹ سناریو + DFS مسیریابی', color: 'text-orange-600' },
  { label: 'کندل‌استیک', desc: 'candlestick-patterns.ts — ۱۰ الگو + امتیازبندی بافت‌محور + Swing Points', color: 'text-red-600' },
  { label: 'ML Adaptive', desc: 'ml-engine.ts + ml-logistic.ts — رگرسیون لجستیک ۱۶ فیچری + TimeSeriesSplit', color: 'text-violet-600' },
];

export default function Homepage({ onSelectCategory }: HomepageProps) {
  const [activeSection, setActiveSection] = React.useState<SectionId>('features');
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex gap-4">
      {/* Sidebar */}
      {!sidebarCollapsed ? (
        <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-[76px] self-start">
          <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-500 tracking-wide">دسترسی سریع</span>
              <button onClick={() => setSidebarCollapsed(true)} className="p-1 rounded-md hover:bg-white text-gray-400 hover:text-gray-600 transition-colors border border-transparent hover:border-gray-200" title="بستن سایدبار">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <nav className="space-y-1">
              {SIDEBAR_SECTIONS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button key={item.id} onClick={() => scrollToSection(item.id)} className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200', isActive ? `${item.bg} border shadow-sm scale-[1.02] ${item.color}` : 'border border-transparent bg-gray-100/80 text-gray-500 hover:text-gray-800 hover:border-gray-200')}>
                    <div className={cn('p-1 rounded-lg', isActive ? item.bg : 'bg-gray-100/80')}>
                      <Icon className={cn('w-3.5 h-3.5', isActive ? item.color : 'text-gray-400')} />
                    </div>
                    <span className={isActive ? item.color : ''}>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-4 pt-3 border-t border-gray-200/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><RefreshCw className="w-3 h-3" /><span>بروزرسانی ۶۰ ثانیه‌ای</span></div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Lock className="w-3 h-3" /><span>بدون نیاز به ثبت‌نام</span></div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Server className="w-3 h-3" /><span>نسخه V12 — ML + کندل + بیزی</span></div>
            </div>
          </div>
        </aside>
      ) : (
        <button onClick={() => setSidebarCollapsed(false)} className="hidden lg:flex self-start sticky top-[76px] p-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white text-gray-400 hover:text-gray-600 transition-colors mt-6 shadow-sm" title="نمایش منو">
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-8">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
          <div className="relative bg-gradient-to-l from-amber-50/80 via-white to-teal-50/40">
            <div className="grid lg:grid-cols-2 gap-0">
              <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200/60 text-emerald-700 text-xs font-bold w-fit mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  نسخه ۱۲ — ML + کندل‌استیک + بیزی + هوش مصنوعی
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
                  تحلیل جامع <span className="text-amber-600">تکنیکال هوشمند</span> بازار ایران
                </h2>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-4 max-w-lg">
                  موتور تحلیل بومی TypeScript با ۱۶+ اندیکاتور، ۹ سناریوی احتمالی، ۱,۵۰۰ ترکیب روایتی AI، پیش‌بینی ۳۰ جلسه با XGBoost، تشخیص ۱۰ الگوی کندل‌استیک، و وزن‌دهی بیزی داینامیک.
                </p>
                <p className="text-gray-400 text-xs mb-6 max-w-lg">
                  داده‌ها از TSETMC، finpy-tse، TGJU و BrsApi — ۸,۰۰۰+ ابزار مالی در ۱۷ دسته‌بندی
                </p>
                <div className="flex flex-wrap gap-3 mb-6">
                  <button onClick={() => onSelectCategory('stocks')} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors shadow-sm">
                    شروع تحلیل <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => scrollToSection('features')} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-medium text-sm transition-colors">
                    مشاهده مشخصات سیستم
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> رایگان</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> بدون ثبت‌نام</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> داده لحظه‌ای</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> V7-V11 منسوخ</span>
                </div>
              </div>
              <div className="hidden lg:block relative">
                <div className="m-4 mt-6 rounded-xl border border-gray-300/60 shadow-xl overflow-hidden bg-white">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-200">
                    <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-400" /><div className="w-2.5 h-2.5 rounded-full bg-green-400" /></div>
                    <div className="flex-1 mx-2"><div className="bg-white rounded-md px-3 py-1 text-[10px] text-gray-400 border border-gray-200 text-center">تحلیل تکنیکال بازار — V12</div></div>
                  </div>
                  <img src="/images/hero-chart.png" alt="پیش‌نمایش صفحه تحلیل" className="w-full h-auto object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="text-center p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                <Icon className="w-4 h-4 mx-auto text-amber-500 mb-1.5" />
                <div className="text-base sm:text-lg font-extrabold text-gray-900">{s.value}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
              </div>
            );
          })}
        </section>

        {/* Features */}
        <section id="section-features">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/60"><Zap className="w-5 h-5 text-amber-600" /></div>
            <div><h3 className="text-lg font-bold text-gray-900">ویژگی‌های کلیدی سیستم</h3><p className="text-xs text-gray-500">مشخصات فنی واقعی پیاده‌سازی‌شده در کد</p></div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className={cn('group p-4 rounded-xl border bg-white transition-all hover:shadow-md', f.border)}>
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', f.bg)}><Icon className={cn('w-5 h-5', f.color)} /></div>
                  <h4 className="font-bold text-sm text-gray-900 mb-1.5">{f.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ML Engine & AI Narrative */}
        <section id="section-ml-engine">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-violet-50 border border-violet-200/60"><BrainCircuit className="w-5 h-5 text-violet-600" /></div>
            <div><h3 className="text-lg font-bold text-gray-900">موتور ML و هوش مصنوعی</h3><p className="text-xs text-gray-500">XGBoost + sklearn + Beta-Binomial + ۱,۵۰۰ ترکیب روایتی</p></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* ML Models */}
            <div className="p-5 rounded-xl border border-gray-200 bg-white">
              <h4 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2"><Server className="w-4 h-4 text-rose-500" />سرویس آموزش ML (Python)</h4>
              <div className="space-y-2 mb-4">
                {ML_MODELS.map((m) => (
                  <div key={m.nameEn} className={cn('px-3 py-2.5 rounded-lg border', m.color)}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{m.name}</span>
                      <span className="text-[10px] opacity-60 font-mono">{m.nameEn}</span>
                    </div>
                    <div className="text-[10px] mt-0.5 opacity-70">{m.desc}</div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-gray-400 space-y-1">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" />صادر ONNX با onnxmltools/skl2onnx</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" />TimeSeriesSplit(5) بدون تصادفی‌سازی</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" />حداقل ۱۲۰ کندل برای آموزش</div>
              </div>
            </div>

            {/* Feature Engineering */}
            <div className="p-5 rounded-xl border border-gray-200 bg-white">
              <h4 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2"><Cpu className="w-4 h-4 text-amber-500" />مهندسی ویژگی (۵۰+ فیچر)</h4>
              <div className="space-y-1.5 mb-4">
                {ML_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs text-gray-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200/60">
                <div className="text-[10px] text-amber-800">
                  <strong>پیش‌بینی تکراری ۳۰ جلسه:</strong> هر بار ۵ جلسه پیش‌بینی شده، به داده اضافه می‌شود، فیچرها مجدداً استخراج شده و تکرار می‌شود (۶ بار تکرار).
                </div>
              </div>
            </div>

            {/* Narrative Engine */}
            <div className="p-5 rounded-xl border border-gray-200 bg-white">
              <h4 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2"><LineChart className="w-4 h-4 text-violet-500" />موتور روایتی (۱,۵۰۰ ترکیب)</h4>
              <p className="text-xs text-gray-500 mb-3">هر بار تحلیل، سیستم بر اساس وضعیت واقعی بازار دقیقاً یک ترکیب انتخاب می‌کند:</p>
              <div className="space-y-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-bold">۱۰ مکتب</span>
                  <span className="text-xs text-gray-500">روند، کلاسیک، نوسان‌نما، موج‌شماری، حجمی، اقتصادسنجی، روانشناسی، نوسان‌پذیری، الگو، الگوریتمی</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold">۱۰ سبک</span>
                  <span className="text-xs text-gray-500">روندگرا، محافظه‌کار، اسکالپر، نوسان‌گیر، ریسک‌گریز، کات‌لاس، مخابره‌ای، روایی، تصمیم‌محور، تحلیلی</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">۱۵ لحن</span>
                  <span className="text-xs text-gray-500">رسمی، سریع، فلسفی، هشداری، داستانی، گام‌به‌گام، شکاک، خوش‌بین، ساده، کمی، مرموز، آموزشی، مقایسه‌ای، متعادل، قطعی، ملایم</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-violet-50/80 border border-violet-200/60">
                <div className="text-[10px] text-violet-800">
                  <strong>ورودی‌های انتخاب:</strong> RSI, ADX, Stochastic, MACD, DI+/DI-, OBV, CCI, MFI, ATR, BB Position, روند (جهت/R²), نزدیکی به S/R
                </div>
              </div>
            </div>

            {/* V12 New Features */}
            <div className="p-5 rounded-xl border border-gray-200 bg-white">
              <h4 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-500" />قابلیت‌های جدید V12</h4>
              <div className="space-y-2.5 text-xs text-gray-600">
                <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-200/60">
                  <div className="font-bold text-orange-700 mb-0.5">۱۰ الگوی کندل‌استیک</div>
                  <div className="text-[10px] text-gray-500">Doji, Hammer, Inverted Hammer, Engulfing, Morning/Evening Star, Shooting Star, Harami — امتیازبندی بافت‌محور (۵ کندل قبل)</div>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/60">
                  <div className="font-bold text-emerald-700 mb-0.5">وزن‌دهی بیزی (Beta-Binomial)</div>
                  <div className="text-[10px] text-gray-500">۱۲ اندیکاتور با Prior اولیه. Softmax نرمالیزه (T=2.0). تنظیم احتمال سناریو ±۱۵٪. به‌روزرسانی پس از هر پیش‌بینی.</div>
                </div>
                <div className="p-2.5 rounded-lg bg-fuchsia-50 border border-fuchsia-200/60">
                  <div className="font-bold text-fuchsia-700 mb-0.5">هارمونیک و الیوت (AI)</div>
                  <div className="text-[10px] text-gray-500">شناسایی Swing Points + تحلیل LLM زد.آی برای الگوهای هارمونیک و موج الیوت با Prompt فارسی ساختاریافته.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tools */}
        <section id="section-tools">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-teal-50 border border-teal-200/60"><Cpu className="w-5 h-5 text-teal-600" /></div>
            <div><h3 className="text-lg font-bold text-gray-900">ابزارهای تحلیلی (مشخصات واقعی)</h3><p className="text-xs text-gray-500">تعداد و جزئیات دقیق هر ابزار پیاده‌سازی‌شده</p></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {TOOLS.map((t, i) => (
              <div key={t.label} className={cn('flex items-start gap-4 px-5 py-4', i > 0 && 'border-t border-gray-100')}>
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', t.color.replace('text-', 'bg-'))} />
                <div className="flex-1 min-w-0">
                  <h4 className={cn('font-bold text-sm mb-0.5', t.color)}>{t.label}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Markets */}
        <section id="section-markets">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-sky-50 border border-sky-200/60"><Globe className="w-5 h-5 text-sky-600" /></div>
            <div><h3 className="text-lg font-bold text-gray-900">بازارهای پشتیبانی‌شده (۱۷ دسته‌بندی)</h3><p className="text-xs text-gray-500">دسترسی به تمام بازارهای ایران و جهان</p></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MARKETS.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.title} onClick={() => onSelectCategory(m.onClick)} className={cn('group p-4 rounded-xl border bg-white text-right transition-all hover:shadow-md hover:scale-[1.02]', 'border-gray-200 hover:border-gray-300')}>
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2.5', m.color)}><Icon className="w-4.5 h-4.5" /></div>
                  <div className="font-bold text-sm text-gray-900 mb-0.5">{m.title}</div>
                  <div className="text-[11px] text-gray-500 mb-1.5">{m.desc}</div>
                  <span className="text-[10px] font-bold text-gray-400">{m.count} ابزار مالی</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Architecture */}
        <section id="section-architecture">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-orange-50 border border-orange-200/60"><Code2 className="w-5 h-5 text-orange-600" /></div>
            <div><h3 className="text-lg font-bold text-gray-900">معماری سیستم (مشخصات واقعی کد)</h3><p className="text-xs text-gray-500">تعداد خطوط و اجزای هر ماژول</p></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {ARCHITECTURE.map((a, i) => (
              <div key={a.label} className={cn('flex items-start gap-4 px-5 py-4', i > 0 && 'border-t border-gray-100')}>
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', a.color.replace('text-', 'bg-'))} />
                <div className="flex-1 min-w-0">
                  <h4 className={cn('font-bold text-sm mb-0.5', a.color)}>{a.label}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-gray-200 bg-white">
              <h4 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2"><Database className="w-4 h-4 text-teal-500" />منابع داده</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" /><span><strong className="text-gray-800">TSETMC</strong> — سهام (تعدیل‌شده)، ETF، اوراق بدهی، اوراق مشارکت، قراردادهای آتی، سلف، رهنی</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" /><span><strong className="text-gray-800">finpy-tse / TSETMC CDN</strong> — ۵۰ شاخص (۱۰ اصلی + ۴۰ صنعت) با تاریخ شمسی از ۱۳۸۷</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" /><span><strong className="text-gray-800">TGJU (tgju.org)</strong> — ۱۱ دسته: ارز، طلا، نقره، صندوق طلا، کریپتو، شاخص جهانی، سهام خارجی، فارکس، انرژی، فلزات، کالا</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" /><span><strong className="text-gray-800">BrsApi</strong> — داده لحظه‌ای قیمت، تغییرات، حجم، ارزش معاملات، تعداد معاملات</span></li>
              </ul>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 bg-white">
              <h4 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2"><Gauge className="w-4 h-4 text-violet-500" />معماری سیستم</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" /><span><strong className="text-gray-800">موتور تحلیل یکپارچه</strong> — ta-engine.ts با Scenario Engine + ML Adaptive + S/R + ۱۶ اندیکاتور</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" /><span><strong className="text-gray-800">API واحد</strong> — /api/analysis + /api/tgju-analysis + /api/index-analysis</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" /><span><strong className="text-gray-800">Visual Decision System</strong> — VDES + VDSS Graph + ۹ سناریوی احتمالی</span></li>
              </ul>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="section-how-it-works">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/60"><MousePointerClick className="w-5 h-5 text-emerald-600" /></div>
            <div><h3 className="text-lg font-bold text-gray-900">نحوه استفاده</h3><p className="text-xs text-gray-500">از جستجو تا تحلیل کامل</p></div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className={cn('relative p-5 rounded-xl border bg-white', s.border)}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black', s.bg, s.color)}>{s.step}</div>
                    <div className={cn('p-1.5 rounded-lg', s.bg)}><Icon className={cn('w-4 h-4', s.color)} /></div>
                  </div>
                  <h4 className={cn('font-bold text-sm mb-2', s.color)}>{s.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Disclaimer */}
        <section>
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/60">
            <p className="text-xs text-amber-800 leading-relaxed"><strong>توجه:</strong> تمامی اطلاعات و تحلیل‌ها صرفاً جنبه تحلیلی دارند و به‌هیچ‌وجه توصیه سرمایه‌گذاری نیست. مسئولیت تصمیم‌ها بر عهده کاربر است.</p>
          </div>
        </section>

        {/* Bottom */}
        <section className="relative overflow-hidden rounded-2xl border border-gray-200">
          <img src="/images/markets-illustration.png" alt="بازارهای مالی" className="w-full h-48 sm:h-64 object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
            <p className="text-sm font-bold text-gray-800 mb-1">۸,۰۰۰+ ابزار مالی در ۱۷ دسته‌بندی — تحلیل هوشمند با V12</p>
            <p className="text-xs text-gray-500">همین حالا نماد مورد نظر خود را جستجو کنید</p>
          </div>
        </section>
      </div>
    </div>
  );
}
