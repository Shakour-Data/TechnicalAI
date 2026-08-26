'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Search,
  LineChart,
  Brain,
  Download,
  BarChart3,
  TrendingUp,
  Activity,
  BookOpen,
  MousePointerClick,
  Layers,
  FileText,
  Table,
  Image,
  Code,
  ChevronLeft,
  Gauge,
  Zap,
  ArrowUpDown,
  CandlestickChart,
  PenTool,
  Cpu,
  CircleDot,
  Target,
  Lightbulb,
  HelpCircle,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-store';

type SectionId =
  | 'getting-started'
  | 'chart-features'
  | 'analysis-panels'
  | 'indicators'
  | 'scenario-analysis'
  | 'export-options';

const sections: { id: SectionId; title: string; icon: React.ReactNode }[] = [
  {
    id: 'getting-started',
    title: 'شروع کار',
    icon: <Search className="h-4 w-4" />,
  },
  {
    id: 'chart-features',
    title: 'ویژگی‌های نمودار',
    icon: <LineChart className="h-4 w-4" />,
  },
  {
    id: 'analysis-panels',
    title: 'پنل‌های تحلیلی',
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: 'indicators',
    title: 'آشنایی با اندیکاتورها',
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    id: 'scenario-analysis',
    title: 'تحلیل سناریوها',
    icon: <Target className="h-4 w-4" />,
  },
  {
    id: 'export-options',
    title: 'گزینه‌های خروجی',
    icon: <Download className="h-4 w-4" />,
  },
];

function PlaceholderImage({
  src,
  alt,
  primary,
  cardBorder,
}: {
  src: string;
  alt: string;
  primary: string;
  cardBorder: string;
}) {
  return (
    <div className="my-4 flex items-center justify-center overflow-hidden rounded-lg border border-dashed p-6" style={{ borderColor: primary, backgroundColor: cardBorder }}>
      <img
        src={src}
        alt={alt}
        className="max-h-64 w-full rounded-md object-contain"
      />
    </div>
  );
}

export default function HelpPage() {
  const { colors: C } = useTheme();

  const scrollToSection = (id: SectionId) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      dir="rtl"
      className="max-h-[calc(100vh-140px)] overflow-y-auto px-1"
      style={{ background: C.pageBg }}
    >
      {/* Header */}
      <div className="mb-6 flex items-center gap-3 px-2 pt-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: C.primaryBg }}>
          <HelpCircle className="h-5 w-5" style={{ color: C.primary }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: C.primary }}>
            راهنمای استفاده از تحلیل تکنیکال بازار
          </h1>
          <p className="text-sm" style={{ color: C.cardSubFg }}>
            راهنمای جامع برای استفاده از تمام امکانات پلتفرم
          </p>
        </div>
      </div>

      {/* Table of Contents */}
      <Card className="mb-6" style={{ borderColor: C.cardBorder, backgroundColor: C.pageBg }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" style={{ color: C.primary }}>
            <BookOpen className="h-5 w-5" />
            فهرست مطالب
          </CardTitle>
          <CardDescription style={{ color: C.cardSubFg }}>
            روی هر بخش کلیک کنید تا به آن منتقل شوید
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-right transition-all hover:shadow-sm"
                style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.cardBg }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: C.primaryBg, color: C.primary }}>
                  {section.icon}
                </span>
                <span className="font-medium" style={{ color: C.primary }}>
                  {section.title}
                </span>
                <ChevronLeft className="mr-auto h-4 w-4" style={{ color: C.accent }} />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Getting Started */}
      <div id="getting-started" className="mb-6 scroll-mt-4">
        <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: C.primaryBg }}>
                <Search className="h-5 w-5" style={{ color: C.primary }} />
              </span>
              <div>
                <CardTitle style={{ color: C.primary }}>شروع کار</CardTitle>
                <CardDescription style={{ color: C.cardSubFg }}>
                  جستجو و انتخاب نماد بورسی
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: C.primary }}>
                <MousePointerClick className="h-4 w-4" />
                جستجوی نماد
              </h3>
              <p className="leading-7" style={{ color: C.cardFg }}>
                برای شروع تحلیل، نام نماد مورد نظر خود را در نوار جستجو وارد کنید.
                به‌محض تایپ، لیست نتایج مرتبط به‌صورت خودکار نمایش داده می‌شود. شما
                می‌توانید با نام فارسی نماد (مانند «خودرو»)، نام لاتین (مانند
                «KHRD1») یا کد نماد جستجو نمایید.
              </p>
              <ul className="mr-6 list-disc space-y-2" style={{ color: C.cardFg }}>
                <li>
                  حداقل یک حرف وارد کنید تا نتایج جستجو نمایش داده شوند.
                </li>
                <li>
                  از کلیدهای بالا و پایین کیبورد برای حرکت بین نتایج استفاده
                  کنید.
                </li>
                <li>
                  با زدن کلید Enter یا کلیک روی نماد مورد نظر، آن را انتخاب کنید.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: C.primary }}>
                <Layers className="h-4 w-4" />
                انتخاب از نتایج جستجو
              </h3>
              <p className="leading-7" style={{ color: C.cardFg }}>
                پس از نمایش نتایج جستجو، هر ردیف شامل نام نماد، نام شرکت و گروه
                صنعتی آن است. با کلیک روی هر نماد، نمودار و اطلاعات تحلیلی آن
                به‌صورت کامل بارگذاری می‌شود. همچنین تاریخچه جستجو‌های اخیر شما در
                دسترس است تا بتوانید سریع‌تر به نمادهای پرکاربرد دسترسی پیدا کنید.
              </p>
            </div>

            <PlaceholderImage
              src="/placeholder-help-1.png"
              alt="نمایش نوار جستجو و لیست نتایج نمادهای بورسی"
              primary={C.primary}
              cardBorder={C.cardBorder}
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Chart Features */}
      <div id="chart-features" className="mb-6 scroll-mt-4">
        <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: C.primaryBg }}>
                <LineChart className="h-5 w-5" style={{ color: C.primary }} />
              </span>
              <div>
                <CardTitle style={{ color: C.primary }}>
                  ویژگی‌های نمودار
                </CardTitle>
                <CardDescription style={{ color: C.cardSubFg }}>
                  ابزارهای رسم، اندیکاتورها و انواع نمودار
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Chart Types */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: C.primary }}>
                <CandlestickChart className="h-4 w-4" />
                انواع نمودار
              </h3>
              <p className="leading-7" style={{ color: C.cardFg }}>
                پلتفرم از انواع مختلف نمودار پشتیبانی می‌کند. با استفاده از منوی
                انتخاب نوع نمودار، می‌توانید بین نمودارهای زیر جابجا شوید:
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg p-3" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.primaryBg }}>
                  <p className="mb-1 font-semibold" style={{ color: C.primary }}>
                    نمودار شمعی (کندل‌استیک)
                  </p>
                  <p className="text-sm" style={{ color: C.cardSubFg }}>
                    نمایش قیمت باز شدن، بسته شدن، بالاترین و پایین‌ترین قیمت در هر
                    دوره زمانی
                  </p>
                </div>
                <div className="rounded-lg p-3" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.primaryBg }}>
                  <p className="mb-1 font-semibold" style={{ color: C.primary }}>
                    نمودار خطی
                  </p>
                  <p className="text-sm" style={{ color: C.cardSubFg }}>
                    نمایش پیوسته قیمت‌های بسته شدن به‌صورت یک خط منحنی
                  </p>
                </div>
                <div className="rounded-lg p-3" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.primaryBg }}>
                  <p className="mb-1 font-semibold" style={{ color: C.primary }}>
                    نمودار میله‌ای
                  </p>
                  <p className="text-sm" style={{ color: C.cardSubFg }}>
                    نمایش محدوده قیمتی هر دوره با میله‌های عمودی
                  </p>
                </div>
                <div className="rounded-lg p-3" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.primaryBg }}>
                  <p className="mb-1 font-semibold" style={{ color: C.primary }}>
                    نمودار سطحی (Area)
                  </p>
                  <p className="text-sm" style={{ color: C.cardSubFg }}>
                    نمایش نمودار خطی با پر کردن فضای زیر نمودار
                  </p>
                </div>
              </div>
            </div>

            {/* Drawing Tools */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: C.primary }}>
                <PenTool className="h-4 w-4" />
                ابزارهای رسم
              </h3>
              <p className="leading-7" style={{ color: C.cardFg }}>
                با استفاده از نوار ابزار رسم، می‌توانید خطوط روند، کانال‌ها،
                فیبوناچی، سطوح حمایت و مقاومت و سایر ابزارهای تحلیلی را روی
                نمودار رسم کنید. برای رسم یک ابزار، ابتدا آن را از نوار ابزار
                انتخاب کرده و سپس روی نمودار کلیک و بکشید. برای حذف ابزار رسم شده،
                روی آن کلیک راست کرده و گزینه «حذف» را انتخاب کنید.
              </p>
            </div>

            {/* Indicators on Chart */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: C.primary }}>
                <Activity className="h-4 w-4" />
                اندیکاتورهای نمودار
              </h3>
              <p className="leading-7" style={{ color: C.cardFg }}>
                می‌توانید اندیکاتورهای مختلفی را به نمودار اصلی یا زیرنمودارها
                اضافه کنید. با کلیک روی آیکون اندیکاتورها، لیست تمام اندیکاتورهای
                موجود نمایش داده می‌شود. هر اندیکاتور را می‌توان با تنظیم پارامترها
                شخصی‌سازی کرد. برای حذف یک اندیکاتور از نمودار، روی نام آن کلیک
                کرده و گزینه «حذف» را انتخاب نمایید.
              </p>
            </div>

            <PlaceholderImage
              src="/placeholder-help-2.png"
              alt="نمایش انواع نمودار و ابزارهای رسم روی نمودار تکنیکال"
              primary={C.primary}
              cardBorder={C.cardBorder}
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Analysis Panels */}
      <div id="analysis-panels" className="mb-6 scroll-mt-4">
        <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: C.primaryBg }}>
                <Brain className="h-5 w-5" style={{ color: C.primary }} />
              </span>
              <div>
                <CardTitle style={{ color: C.primary }}>
                  پنل‌های تحلیلی
                </CardTitle>
                <CardDescription style={{ color: C.cardSubFg }}>
                  پنل اندیکاتورها، نمودار تصمیم و توصیف‌گر تصویری
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Indicators Panel */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: C.primary }}>
                <Gauge className="h-4 w-4" />
                پنل اندیکاتورها
              </h3>
              <p className="leading-7" style={{ color: C.cardFg }}>
                این پنل خلاصه‌ای از وضعیت تمام اندیکاتورهای فعال را در یک نگاه
                نمایش می‌دهد. هر اندیکاتور با یک رنگ مشخص نشان داده می‌شود: سبز
                برای سیگنال خرید، قرمز برای سیگنال فروش و خاکستری برای حالت خنثی.
                با قرار دادن نشانگر ماوس روی هر اندیکاتور، جزئیات بیشتر و مقادیر
                عددی آن نمایش داده می‌شود.
              </p>
            </div>

            {/* Decision Graph */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: C.primary }}>
                <Activity className="h-4 w-4" />
                نمودار تصمیم (VDSS)
              </h3>
              <p className="leading-7" style={{ color: C.cardFg }}>
                نمودار تصمیم، تصویر کلی از قدرت و جهت سیگنال‌های تحلیلی را
                ارائه می‌دهد. این نمودار بر اساس ترکیب سیگنال‌های چندین اندیکاتور
                ساخته می‌شود و به شما کمک می‌کند تا در یک نگاه بفهمید وضعیت کلی
                نماد چگونه است. بخش‌های سبز رنگ نشان‌دهنده فشار خرید و بخش‌های
                قرمز رنگ نشان‌دهنده فشار فروش هستند.
              </p>
            </div>

            {/* AI Visual Describer */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: C.primary }}>
                <Cpu className="h-4 w-4" />
                توصیف‌گر تصویری (هوش مصنوعی)
              </h3>
              <p className="leading-7" style={{ color: C.cardFg }}>
                توصیف‌گر تصویری با استفاده از هوش مصنوعی، نمودار تکنیکال را تحلیل
                کرده و توصیف متنی از الگوها، روندها و نقاط کلیدی ارائه می‌دهد.
                این ابزار به‌ویژه برای تحلیلگران مبتدی مفید است و می‌تواند نقاط ورود
                و خروج احتمالی را شناسایی کند. برای استفاده، کافی است روی دکمه
                «توصیف تصویری» کلیک کنید و منتظر بمانید تا تحلیل هوش مصنوعی تولید
                شود.
              </p>
            </div>

            <PlaceholderImage
              src="/placeholder-help-3.png"
              alt="نمایش پنل‌های تحلیلی شامل اندیکاتورها، نمودار تصمیم و توصیف‌گر تصویری"
              primary={C.primary}
              cardBorder={C.cardBorder}
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 4: Understanding Indicators */}
      <div id="indicators" className="mb-6 scroll-mt-4">
        <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: C.primaryBg }}>
                <BarChart3 className="h-5 w-5" style={{ color: C.primary }} />
              </span>
              <div>
                <CardTitle style={{ color: C.primary }}>
                  آشنایی با اندیکاتورها
                </CardTitle>
                <CardDescription style={{ color: C.cardSubFg }}>
                  توضیح اندیکاتورهای کلیدی و نحوه تفسیر آنها
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="leading-7" style={{ color: C.cardFg }}>
              در این بخش، مهم‌ترین اندیکاتورهای مورد استفاده در پلتفرم معرفی و
              نحوه تفسیر آنها توضیح داده شده است.
            </p>

            {/* RSI */}
            <div className="rounded-lg p-4" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.primaryBg }}>
              <h4 className="mb-2 flex items-center gap-2 font-bold" style={{ color: C.primary }}>
                <Zap className="h-4 w-4" />
                شاخص قدرت نسبی (RSI)
              </h4>
              <p className="mb-2 leading-7" style={{ color: C.cardFg }}>
                شاخص قدرت نسبی یک نوسان‌نما (اکسیلاتور) است که سرعت و تغییرات
                حرکات قیمت را اندازه‌گیری می‌کند. مقدار RSI بین صفر تا صد متغیر است.
              </p>
              <ul className="mr-6 list-disc space-y-1" style={{ color: C.cardSubFg }}>
                <li>
                  <strong>RSI بالای ۷۰:</strong> منطقه اشباع خرید – احتمال اصلاح
                  قیمت
                </li>
                <li>
                  <strong>RSI زیر ۳۰:</strong> منطقه اشباع فروش – احتمال بازگشت
                  قیمت
                </li>
                <li>
                  <strong>خط میانی ۵۰:</strong> تقسیم‌کننده روند صعودی و نزولی
                </li>
              </ul>
            </div>

            {/* MACD */}
            <div className="rounded-lg p-4" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.primaryBg }}>
              <h4 className="mb-2 flex items-center gap-2 font-bold" style={{ color: C.primary }}>
                <TrendingUp className="h-4 w-4" />
                میانگین متحرک همگرا-واگرا (MACD)
              </h4>
              <p className="mb-2 leading-7" style={{ color: C.cardFg }}>
                MACD یکی از محبوب‌ترین اندیکاتورهای دنباله‌رو روند است و از سه
                component تشکیل شده: خط MACD، خط سیگنال و هیستوگرام.
              </p>
              <ul className="mr-6 list-disc space-y-1" style={{ color: C.cardSubFg }}>
                <li>
                  <strong>تقاطع صعودی:</strong> وقتی خط MACD خط سیگنال را به سمت
                  بالا بشکند – سیگنال خرید
                </li>
                <li>
                  <strong>تقاطع نزولی:</strong> وقتی خط MACD خط سیگنال را به سمت
                  پایین بشکند – سیگنال فروش
                </li>
                <li>
                  <strong>هیستوگرام:</strong> فاصله بین خط MACD و خط سیگنال را
                  نشان می‌دهد
                </li>
              </ul>
            </div>

            {/* Bollinger Bands */}
            <div className="rounded-lg p-4" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.primaryBg }}>
              <h4 className="mb-2 flex items-center gap-2 font-bold" style={{ color: C.primary }}>
                <ArrowUpDown className="h-4 w-4" />
                باندهای بولینگر (Bollinger Bands)
              </h4>
              <p className="mb-2 leading-7" style={{ color: C.cardFg }}>
                باندهای بولینگر از سه خط تشکیل شده: باند بالایی، باند پایینی و
                خط میانی (میانگین متحرک ۲۰ دوره‌ای). عرض باندها نشان‌دهنده نوسان‌پذیری
                بازار است.
              </p>
              <ul className="mr-6 list-disc space-y-1" style={{ color: C.cardSubFg }}>
                <li>
                  <strong>تماس با باند بالایی:</strong> قیمت نسبتاً بالاست –
                  احتمال نزدیک بودن به مقاومت
                </li>
                <li>
                  <strong>تماس با باند پایینی:</strong> قیمت نسبتاً پایین است –
                  احتمال نزدیک بودن به حمایت
                </li>
                <li>
                  <strong>باریک شدن باندها:</strong> نشانه کاهش نوسان و احتمال
                  حرکت شارپ قیمت در آینده نزدیک
                </li>
              </ul>
            </div>

            {/* ADX */}
            <div className="rounded-lg p-4" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.primaryBg }}>
              <h4 className="mb-2 flex items-center gap-2 font-bold" style={{ color: C.primary }}>
                <Activity className="h-4 w-4" />
                شاخص میانگین جهت‌دار (ADX)
              </h4>
              <p className="mb-2 leading-7" style={{ color: C.cardFg }}>
                ADX قدرت روند را بدون توجه به جهت آن اندازه‌گیری می‌کند. مقدار
                آن بین صفر تا صد متغیر است.
              </p>
              <ul className="mr-6 list-disc space-y-1" style={{ color: C.cardSubFg }}>
                <li>
                  <strong>ADX بالای ۲۵:</strong> وجود یک روند قوی (صعودی یا نزولی)
                </li>
                <li>
                  <strong>ADX زیر ۲۰:</strong> بازار فاقد روند مشخص است یا در حال
                  رنج زدن است
                </li>
                <li>
                  <strong>خط +DI و -DI:</strong> جهت روند را مشخص می‌کنند؛ تقاطع
                  آنها سیگنال تغییر جهت است
                </li>
              </ul>
            </div>

            <PlaceholderImage
              src="/placeholder-help-4.png"
              alt="نمایش اندیکاتورهای RSI، MACD، باندهای بولینگر و ADX روی نمودار"
              primary={C.primary}
              cardBorder={C.cardBorder}
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 5: Scenario Analysis */}
      <div id="scenario-analysis" className="mb-6 scroll-mt-4">
        <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: C.primaryBg }}>
                <Target className="h-5 w-5" style={{ color: C.primary }} />
              </span>
              <div>
                <CardTitle style={{ color: C.primary }}>
                  تحلیل سناریوها
                </CardTitle>
                <CardDescription style={{ color: C.cardSubFg }}>
                  نحوه خواندن و تفسیر ۵ سناریوی احتمالی
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="leading-7" style={{ color: C.cardFg }}>
              سیستم تحلیل سناریو، بر اساس بررسی همزمان تمام اندیکاتورها و الگوهای
              نموداری، ۵ سناریوی احتمالی برای آینده قیمت ارائه می‌دهد. هر سناریو
              همراه با درصد احتمال وقوع است.
            </p>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: C.primary }}>
                <CircleDot className="h-4 w-4" />
                انواع سناریوها
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                    ۱
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">صعودی قوی</p>
                    <p className="text-sm text-green-700">
                      اکثر اندیکاتورها سیگنال خرید صادر کرده‌اند. احتمال ادامه روند
                      صعودی بالا است. مناسب برای موقعیت‌های خرید.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-white">
                    ۲
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-800">صعودی ضعیف</p>
                    <p className="text-sm text-emerald-700">
                      بخشی از اندیکاتورها سیگنال خرید و بخشی خنثی هستند. روند
                      صعودی احتمالی اما با قدرت کمتر.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-gray-300 bg-gray-50 p-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-400 text-xs font-bold text-white">
                    ۳
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">خنثی</p>
                    <p className="text-sm text-gray-600">
                      سیگنال‌های متناقض وجود دارد. بازار در حالت تردید است و
                      توصیه می‌شود تا روشن‌شدن جهت بازار، از معامله خودداری کنید.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-400 text-xs font-bold text-white">
                    ۴
                  </div>
                  <div>
                    <p className="font-semibold text-orange-800">نزولی ضعیف</p>
                    <p className="text-sm text-orange-700">
                      بخشی از اندیکاتورها سیگنال فروش صادر کرده‌اند. احتمال اصلاح
                      قیمت وجود دارد اما روند نزولی قاطع نیست.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    ۵
                  </div>
                  <div>
                    <p className="font-semibold text-red-800">نزولی قوی</p>
                    <p className="text-sm text-red-700">
                      اکثر اندیکاتورها سیگنال فروش صادر کرده‌اند. احتمال ادامه روند
                      نزولی بالاست. مناسب برای خروج از موقعیت‌ها یا فروش استقراضی.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: C.primary }}>
                <Lightbulb className="h-4 w-4" />
                نکات مهم درباره احتمالات
              </h3>
              <ul className="mr-6 list-disc space-y-2" style={{ color: C.cardFg }}>
                <li>
                  مجموع احتمالات ۵ سناریو همیشه ۱۰۰ درصد است.
                </li>
                <li>
                  سناریویی با بالاترین احتمال، محتمل‌ترین جهت آینده بازار را نشان
                  می‌دهد.
                </li>
                <li>
                  سناریوها بر اساس داده‌های تاریخی محاسبه می‌شوند و تضمینی برای
                  آینده نیستند.
                </li>
                <li>
                  همیشه از مدیریت ریسک استفاده کنید و بیش از مبلغ قابل تحمل
                  معامله نکنید.
                </li>
              </ul>
            </div>

            <PlaceholderImage
              src="/placeholder-help-5.png"
              alt="نمایش ۵ سناریوی تحلیلی با درصدهای احتمال برای یک نماد بورسی"
              primary={C.primary}
              cardBorder={C.cardBorder}
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 6: Export Options */}
      <div id="export-options" className="mb-6 scroll-mt-4">
        <Card style={{ borderColor: C.cardBorder, backgroundColor: C.cardBg }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: C.primaryBg }}>
                <Download className="h-5 w-5" style={{ color: C.primary }} />
              </span>
              <div>
                <CardTitle style={{ color: C.primary }}>
                  گزینه‌های خروجی
                </CardTitle>
                <CardDescription style={{ color: C.cardSubFg }}>
                  دانلود و ذخیره تحلیل‌ها در قالب‌های مختلف
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="leading-7" style={{ color: C.cardFg }}>
              شما می‌توانید نتایج تحلیل خود را در قالب‌های مختلف دانلود و ذخیره
              کنید. برای این کار، از دکمه خروجی در نوار ابزار بالا استفاده کنید و
              فرمت مورد نظر را انتخاب نمایید.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* PDF */}
              <div className="rounded-lg p-4 transition-shadow hover:shadow-md" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.cardBg }}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: C.primary }}>فرمت PDF</p>
                    <p className="text-xs" style={{ color: C.cardSubFg }}>گزارش تحلیلی</p>
                  </div>
                </div>
                <p className="text-sm leading-6" style={{ color: C.cardSubFg }}>
                  خروجی PDF شامل نمودارها، اندیکاتورها، سناریوها و توضیحات تحلیلی
                  است. مناسب برای چاپ و اشتراک‌گذاری.
                </p>
              </div>

              {/* Excel */}
              <div className="rounded-lg p-4 transition-shadow hover:shadow-md" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.cardBg }}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <Table className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: C.primary }}>فرمت Excel</p>
                    <p className="text-xs" style={{ color: C.cardSubFg }}>داده‌های جدولی</p>
                  </div>
                </div>
                <p className="text-sm leading-6" style={{ color: C.cardSubFg }}>
                  داده‌های عددی اندیکاتورها و قیمت‌ها در قالب فایل اکسل قابل
                  دانلود است. مناسب برای تحلیل‌های بیشتر و ایجاد نمودارهای سفارشی.
                </p>
              </div>

              {/* CSV */}
              <div className="rounded-lg p-4 transition-shadow hover:shadow-md" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.cardBg }}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: C.primary }}>فرمت CSV</p>
                    <p className="text-xs" style={{ color: C.cardSubFg }}>داده‌های خام</p>
                  </div>
                </div>
                <p className="text-sm leading-6" style={{ color: C.cardSubFg }}>
                  داده‌های خام قیمتی و اندیکاتوری در قالب CSV قابل دریافت است.
                  مناسب برای وارد کردن در نرم‌افزارهای تحلیلی دیگر.
                </p>
              </div>

              {/* Image */}
              <div className="rounded-lg p-4 transition-shadow hover:shadow-md" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.cardBg }}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <Image className="h-5 w-5 text-purple-600" role="img" aria-label="آیکون تصویر" />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: C.primary }}>فرمت تصویر</p>
                    <p className="text-xs" style={{ color: C.cardSubFg }}>PNG / JPG</p>
                  </div>
                </div>
                <p className="text-sm leading-6" style={{ color: C.cardSubFg }}>
                  نمودار فعلی با تمام اندیکاتورها و ابزارهای رسم شده، به‌صورت تصویر
                  با کیفیت بالا ذخیره می‌شود.
                </p>
              </div>

              {/* HTML */}
              <div className="rounded-lg p-4 transition-shadow hover:shadow-md" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.cardBg }}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                    <Code className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: C.primary }}>فرمت HTML</p>
                    <p className="text-xs" style={{ color: C.cardSubFg }}>صفحه وب</p>
                  </div>
                </div>
                <p className="text-sm leading-6" style={{ color: C.cardSubFg }}>
                  گزارش کامل تحلیل در قالب یک صفحه وب مستقل تولید می‌شود که می‌توانید
                  آن را در مرورگر باز کرده یا در وب‌سایت خود منتشر کنید.
                </p>
              </div>
            </div>

            <PlaceholderImage
              src="/placeholder-help-6.png"
              alt="نمایش منوی خروجی و فرمت‌های مختلف دانلود گزارش تحلیلی"
              primary={C.primary}
              cardBorder={C.cardBorder}
            />
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="mb-4 rounded-lg px-6 py-4 text-center" style={{ border: `1px solid ${C.cardBorder}`, backgroundColor: C.primaryBg }}>
        <p className="text-sm" style={{ color: C.primary }}>
          برای سوالات بیشتر و پشتیبانی، با ما تماس بگیرید.
        </p>
        <p className="mt-1 text-xs" style={{ color: C.cardSubFg }}>
          تحلیل تکنیکال بازار – نسخه {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
