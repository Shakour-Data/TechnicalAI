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
}: {
  src: string;
  alt: string;
}) {
  return (
    <div className="my-4 flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-amber-300 bg-gray-100 p-6">
      <img
        src={src}
        alt={alt}
        className="max-h-64 w-full rounded-md object-contain"
      />
    </div>
  );
}

export default function HelpPage() {
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
    >
      {/* Header */}
      <div className="mb-6 flex items-center gap-3 px-2 pt-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <HelpCircle className="h-5 w-5 text-amber-800" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-amber-900">
            راهنمای استفاده از تحلیل تکنیکال بازار
          </h1>
          <p className="text-sm text-amber-700">
            راهنمای جامع برای استفاده از تمام امکانات پلتفرم
          </p>
        </div>
      </div>

      {/* Table of Contents */}
      <Card className="mb-6 border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <BookOpen className="h-5 w-5" />
            فهرست مطالب
          </CardTitle>
          <CardDescription className="text-amber-700">
            روی هر بخش کلیک کنید تا به آن منتقل شوید
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white px-4 py-3 text-right transition-all hover:border-amber-400 hover:bg-amber-50 hover:shadow-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                  {section.icon}
                </span>
                <span className="font-medium text-amber-900">
                  {section.title}
                </span>
                <ChevronLeft className="mr-auto h-4 w-4 text-amber-400" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Getting Started */}
      <div id="getting-started" className="mb-6 scroll-mt-4">
        <Card className="border-amber-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Search className="h-5 w-5 text-amber-800" />
              </span>
              <div>
                <CardTitle className="text-amber-900">شروع کار</CardTitle>
                <CardDescription className="text-amber-700">
                  جستجو و انتخاب نماد بورسی
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
                <MousePointerClick className="h-4 w-4" />
                جستجوی نماد
              </h3>
              <p className="leading-7 text-gray-700">
                برای شروع تحلیل، نام نماد مورد نظر خود را در نوار جستجو وارد کنید.
                به‌محض تایپ، لیست نتایج مرتبط به‌صورت خودکار نمایش داده می‌شود. شما
                می‌توانید با نام فارسی نماد (مانند «خودرو»)، نام لاتین (مانند
                «KHRD1») یا کد نماد جستجو نمایید.
              </p>
              <ul className="mr-6 list-disc space-y-2 text-gray-700">
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
              <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
                <Layers className="h-4 w-4" />
                انتخاب از نتایج جستجو
              </h3>
              <p className="leading-7 text-gray-700">
                پس از نمایش نتایج جستجو، هر ردیف شامل نام نماد، نام شرکت و گروه
                صنعتی آن است. با کلیک روی هر نماد، نمودار و اطلاعات تحلیلی آن
                به‌صورت کامل بارگذاری می‌شود. همچنین تاریخچه جستجو‌های اخیر شما در
                دسترس است تا بتوانید سریع‌تر به نمادهای پرکاربرد دسترسی پیدا کنید.
              </p>
            </div>

            <PlaceholderImage
              src="/placeholder-help-1.png"
              alt="نمایش نوار جستجو و لیست نتایج نمادهای بورسی"
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Chart Features */}
      <div id="chart-features" className="mb-6 scroll-mt-4">
        <Card className="border-amber-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <LineChart className="h-5 w-5 text-amber-800" />
              </span>
              <div>
                <CardTitle className="text-amber-900">
                  ویژگی‌های نمودار
                </CardTitle>
                <CardDescription className="text-amber-700">
                  ابزارهای رسم، اندیکاتورها و انواع نمودار
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Chart Types */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
                <CandlestickChart className="h-4 w-4" />
                انواع نمودار
              </h3>
              <p className="leading-7 text-gray-700">
                پلتفرم از انواع مختلف نمودار پشتیبانی می‌کند. با استفاده از منوی
                انتخاب نوع نمودار، می‌توانید بین نمودارهای زیر جابجا شوید:
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="mb-1 font-semibold text-amber-800">
                    نمودار شمعی (کندل‌استیک)
                  </p>
                  <p className="text-sm text-gray-600">
                    نمایش قیمت باز شدن، بسته شدن، بالاترین و پایین‌ترین قیمت در هر
                    دوره زمانی
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="mb-1 font-semibold text-amber-800">
                    نمودار خطی
                  </p>
                  <p className="text-sm text-gray-600">
                    نمایش پیوسته قیمت‌های بسته شدن به‌صورت یک خط منحنی
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="mb-1 font-semibold text-amber-800">
                    نمودار میله‌ای
                  </p>
                  <p className="text-sm text-gray-600">
                    نمایش محدوده قیمتی هر دوره با میله‌های عمودی
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="mb-1 font-semibold text-amber-800">
                    نمودار سطحی (Area)
                  </p>
                  <p className="text-sm text-gray-600">
                    نمایش نمودار خطی با پر کردن فضای زیر نمودار
                  </p>
                </div>
              </div>
            </div>

            {/* Drawing Tools */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
                <PenTool className="h-4 w-4" />
                ابزارهای رسم
              </h3>
              <p className="leading-7 text-gray-700">
                با استفاده از نوار ابزار رسم، می‌توانید خطوط روند، کانال‌ها،
                فیبوناچی، سطوح حمایت و مقاومت و سایر ابزارهای تحلیلی را روی
                نمودار رسم کنید. برای رسم یک ابزار، ابتدا آن را از نوار ابزار
                انتخاب کرده و سپس روی نمودار کلیک و بکشید. برای حذف ابزار رسم شده،
                روی آن کلیک راست کرده و گزینه «حذف» را انتخاب کنید.
              </p>
            </div>

            {/* Indicators on Chart */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
                <Activity className="h-4 w-4" />
                اندیکاتورهای نمودار
              </h3>
              <p className="leading-7 text-gray-700">
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
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Analysis Panels */}
      <div id="analysis-panels" className="mb-6 scroll-mt-4">
        <Card className="border-amber-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Brain className="h-5 w-5 text-amber-800" />
              </span>
              <div>
                <CardTitle className="text-amber-900">
                  پنل‌های تحلیلی
                </CardTitle>
                <CardDescription className="text-amber-700">
                  پنل اندیکاتورها، نمودار تصمیم و توصیف‌گر تصویری
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Indicators Panel */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
                <Gauge className="h-4 w-4" />
                پنل اندیکاتورها
              </h3>
              <p className="leading-7 text-gray-700">
                این پنل خلاصه‌ای از وضعیت تمام اندیکاتورهای فعال را در یک نگاه
                نمایش می‌دهد. هر اندیکاتور با یک رنگ مشخص نشان داده می‌شود: سبز
                برای سیگنال خرید، قرمز برای سیگنال فروش و خاکستری برای حالت خنثی.
                با قرار دادن نشانگر ماوس روی هر اندیکاتور، جزئیات بیشتر و مقادیر
                عددی آن نمایش داده می‌شود.
              </p>
            </div>

            {/* Decision Graph */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
                <Activity className="h-4 w-4" />
                نمودار تصمیم (VDSS)
              </h3>
              <p className="leading-7 text-gray-700">
                نمودار تصمیم، تصویر کلی از قدرت و جهت سیگنال‌های تحلیلی را
                ارائه می‌دهد. این نمودار بر اساس ترکیب سیگنال‌های چندین اندیکاتور
                ساخته می‌شود و به شما کمک می‌کند تا در یک نگاه بفهمید وضعیت کلی
                نماد چگونه است. بخش‌های سبز رنگ نشان‌دهنده فشار خرید و بخش‌های
                قرمز رنگ نشان‌دهنده فشار فروش هستند.
              </p>
            </div>

            {/* AI Visual Describer */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
                <Cpu className="h-4 w-4" />
                توصیف‌گر تصویری (هوش مصنوعی)
              </h3>
              <p className="leading-7 text-gray-700">
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
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 4: Understanding Indicators */}
      <div id="indicators" className="mb-6 scroll-mt-4">
        <Card className="border-amber-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <BarChart3 className="h-5 w-5 text-amber-800" />
              </span>
              <div>
                <CardTitle className="text-amber-900">
                  آشنایی با اندیکاتورها
                </CardTitle>
                <CardDescription className="text-amber-700">
                  توضیح اندیکاتورهای کلیدی و نحوه تفسیر آنها
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="leading-7 text-gray-700">
              در این بخش، مهم‌ترین اندیکاتورهای مورد استفاده در پلتفرم معرفی و
              نحوه تفسیر آنها توضیح داده شده است.
            </p>

            {/* RSI */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <h4 className="mb-2 flex items-center gap-2 font-bold text-amber-900">
                <Zap className="h-4 w-4" />
                شاخص قدرت نسبی (RSI)
              </h4>
              <p className="mb-2 leading-7 text-gray-700">
                شاخص قدرت نسبی یک نوسان‌نما (اکسیلاتور) است که سرعت و تغییرات
                حرکات قیمت را اندازه‌گیری می‌کند. مقدار RSI بین صفر تا صد متغیر است.
              </p>
              <ul className="mr-6 list-disc space-y-1 text-gray-600">
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
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <h4 className="mb-2 flex items-center gap-2 font-bold text-amber-900">
                <TrendingUp className="h-4 w-4" />
                میانگین متحرک همگرا-واگرا (MACD)
              </h4>
              <p className="mb-2 leading-7 text-gray-700">
                MACD یکی از محبوب‌ترین اندیکاتورهای دنباله‌رو روند است و از سه
                component تشکیل شده: خط MACD، خط سیگنال و هیستوگرام.
              </p>
              <ul className="mr-6 list-disc space-y-1 text-gray-600">
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
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <h4 className="mb-2 flex items-center gap-2 font-bold text-amber-900">
                <ArrowUpDown className="h-4 w-4" />
                باندهای بولینگر (Bollinger Bands)
              </h4>
              <p className="mb-2 leading-7 text-gray-700">
                باندهای بولینگر از سه خط تشکیل شده: باند بالایی، باند پایینی و
                خط میانی (میانگین متحرک ۲۰ دوره‌ای). عرض باندها نشان‌دهنده نوسان‌پذیری
                بازار است.
              </p>
              <ul className="mr-6 list-disc space-y-1 text-gray-600">
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
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <h4 className="mb-2 flex items-center gap-2 font-bold text-amber-900">
                <Activity className="h-4 w-4" />
                شاخص میانگین جهت‌دار (ADX)
              </h4>
              <p className="mb-2 leading-7 text-gray-700">
                ADX قدرت روند را بدون توجه به جهت آن اندازه‌گیری می‌کند. مقدار
                آن بین صفر تا صد متغیر است.
              </p>
              <ul className="mr-6 list-disc space-y-1 text-gray-600">
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
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 5: Scenario Analysis */}
      <div id="scenario-analysis" className="mb-6 scroll-mt-4">
        <Card className="border-amber-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Target className="h-5 w-5 text-amber-800" />
              </span>
              <div>
                <CardTitle className="text-amber-900">
                  تحلیل سناریوها
                </CardTitle>
                <CardDescription className="text-amber-700">
                  نحوه خواندن و تفسیر ۵ سناریوی احتمالی
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="leading-7 text-gray-700">
              سیستم تحلیل سناریو، بر اساس بررسی همزمان تمام اندیکاتورها و الگوهای
              نموداری، ۵ سناریوی احتمالی برای آینده قیمت ارائه می‌دهد. هر سناریو
              همراه با درصد احتمال وقوع است.
            </p>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
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
              <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
                <Lightbulb className="h-4 w-4" />
                نکات مهم درباره احتمالات
              </h3>
              <ul className="mr-6 list-disc space-y-2 text-gray-700">
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
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 6: Export Options */}
      <div id="export-options" className="mb-6 scroll-mt-4">
        <Card className="border-amber-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Download className="h-5 w-5 text-amber-800" />
              </span>
              <div>
                <CardTitle className="text-amber-900">
                  گزینه‌های خروجی
                </CardTitle>
                <CardDescription className="text-amber-700">
                  دانلود و ذخیره تحلیل‌ها در قالب‌های مختلف
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="leading-7 text-gray-700">
              شما می‌توانید نتایج تحلیل خود را در قالب‌های مختلف دانلود و ذخیره
              کنید. برای این کار، از دکمه خروجی در نوار ابزار بالا استفاده کنید و
              فرمت مورد نظر را انتخاب نمایید.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* PDF */}
              <div className="rounded-lg border border-amber-200 bg-white p-4 transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-900">فرمت PDF</p>
                    <p className="text-xs text-gray-500">گزارش تحلیلی</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-gray-600">
                  خروجی PDF شامل نمودارها، اندیکاتورها، سناریوها و توضیحات تحلیلی
                  است. مناسب برای چاپ و اشتراک‌گذاری.
                </p>
              </div>

              {/* Excel */}
              <div className="rounded-lg border border-amber-200 bg-white p-4 transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <Table className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-900">فرمت Excel</p>
                    <p className="text-xs text-gray-500">داده‌های جدولی</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-gray-600">
                  داده‌های عددی اندیکاتورها و قیمت‌ها در قالب فایل اکسل قابل
                  دانلود است. مناسب برای تحلیل‌های بیشتر و ایجاد نمودارهای سفارشی.
                </p>
              </div>

              {/* CSV */}
              <div className="rounded-lg border border-amber-200 bg-white p-4 transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-900">فرمت CSV</p>
                    <p className="text-xs text-gray-500">داده‌های خام</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-gray-600">
                  داده‌های خام قیمتی و اندیکاتوری در قالب CSV قابل دریافت است.
                  مناسب برای وارد کردن در نرم‌افزارهای تحلیلی دیگر.
                </p>
              </div>

              {/* Image */}
              <div className="rounded-lg border border-amber-200 bg-white p-4 transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <Image className="h-5 w-5 text-purple-600" role="img" aria-label="آیکون تصویر" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-900">فرمت تصویر</p>
                    <p className="text-xs text-gray-500">PNG / JPG</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-gray-600">
                  نمودار فعلی با تمام اندیکاتورها و ابزارهای رسم شده، به‌صورت تصویر
                  با کیفیت بالا ذخیره می‌شود.
                </p>
              </div>

              {/* HTML */}
              <div className="rounded-lg border border-amber-200 bg-white p-4 transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                    <Code className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-900">فرمت HTML</p>
                    <p className="text-xs text-gray-500">صفحه وب</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-gray-600">
                  گزارش کامل تحلیل در قالب یک صفحه وب مستقل تولید می‌شود که می‌توانید
                  آن را در مرورگر باز کرده یا در وب‌سایت خود منتشر کنید.
                </p>
              </div>
            </div>

            <PlaceholderImage
              src="/placeholder-help-6.png"
              alt="نمایش منوی خروجی و فرمت‌های مختلف دانلود گزارش تحلیلی"
            />
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/50 px-6 py-4 text-center">
        <p className="text-sm text-amber-800">
          برای سوالات بیشتر و پشتیبانی، با ما تماس بگیرید.
        </p>
        <p className="mt-1 text-xs text-amber-600">
          تحلیل تکنیکال بازار – نسخه {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
