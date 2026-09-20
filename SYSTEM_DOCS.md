# مستندات سیستم تحلیل تکنیکال بورس ایران
# Iranian Stock Market Technical Analysis System Documentation

> **نسخه**: 2.0 — پیاده‌سازی کامل با TypeScript خالص  
> **آخرین بروزرسانی**: ۱۴۰۴/۰۳  
> **تکنولوژی**: Next.js 16 + TypeScript 5 + Tailwind CSS 4 + Prisma + z-ai-web-dev-sdk

---

## 📑 فهرست مطالب

- [سطح ۱: معماری کلی سیستم](#level-1-system-architecture)
- [سطح ۲: مستندات ماژول‌ها](#level-2-module-documentation)
- [سطح ۳: مستندات توابع و APIها](#level-3-function--api-documentation)

---

# ═══════════════════════════════════════════════════════════════════
# سطح ۱: معماری کلی سیستم (System Architecture Overview)
# ═══════════════════════════════════════════════════════════════════

<a id="level-1-system-architecture"></a>

## ۱.۱ هدف سیستم

این سیستم یک **پلتفرم جامع تحلیل تکنیکال بورس ایران** است که با استفاده از الگوریتم‌های پیشرفته و هوش مصنوعی، تحلیل چندلایه‌ای سهام، شاخص‌ها و بازارهای مالی ایران و جهانی ارائه می‌دهد. سیستم بدون وابستگی به سخت‌افزار خارجی یا مدل‌های سنگین پایتون، تمام محاسبات را در TypeScript خالص انجام می‌دهد.

### ویژگی‌های اصلی:
- **۴۳ اندیکاتور تکنیکال**: RSI, MACD, ADX, Stochastic, Bollinger, Ichimoku, VWAP, و غیره
- **۷ لایه موتور احتمال VDss**: از نمره خام تا احتمال مسیر
- **۹ سناریو قیمتی**: از SC1 (شوک نزولی) تا SC9 (شوک صعودی)
- **۳ موتور تشخیص رژیم**: فازی + مارکوف + رأی‌گیری وزنی
- **تشخیص الگو**: ۱۶ الگوی کلاسیک + ۶ هارمونیک + ۱۶+ کندلی
- **تولید متن هوشمند**: MSL (مکتب × سبک × لحن) + زبان فارسی
- **پروفایل حجم تقریبی**: بدون نیاز به داده تیک-بای-تیک
- **بازخورد تطبیقی**: سیستم یادگیری وزن‌ها بر اساس بازخورد کاربر

## ۱.۲ لایه‌های معماری

```
┌─────────────────────────────────────────────────────────────────┐
│                     لایه نمایش (Presentation)                    │
│  page.tsx → SymbolSearch → CandlestickChart → IndicatorsPanel  │
│             → VdesAnalysis → VdssGraph → MLForecast            │
│             → SemicircleGauge → AnalysisSidebar                │
├─────────────────────────────────────────────────────────────────┤
│                     لایه API (API Routes)                        │
│  /api/analysis → /api/vdes-analysis → /api/ai-analysis         │
│  /api/instruments → /api/symbols → /api/ml-predict             │
│  /api/v8..v12-analysis → /api/yahoo-analysis → /api/tgju-*     │
├─────────────────────────────────────────────────────────────────┤
│                     لایه موتور تحلیل (Analysis Engines)          │
│  ta-engine → ml-engine → regime-engine → sr-analyzer            │
│  composite-scores → bayesian-weights → pattern-detection        │
│  volume-profile → msl-feedback → decision-graph → vdss-*       │
├─────────────────────────────────────────────────────────────────┤
│                     لایه ML (Machine Learning)                   │
│  ml-logistic → ml-model → ml-predictor → ml-narrative          │
│  analysis-ml-selector → msl-selector → msl-v4 → msl-system    │
├─────────────────────────────────────────────────────────────────┤
│                     لایه داده (Data Sources)                     │
│  tse-api → tsetmc-index-api → tse-index-api                   │
│  tgju-api → yahoo-finance-api → zai-shared                     │
├─────────────────────────────────────────────────────────────────┤
│                     لایه زیرسرویس‌ها (Mini Services)             │
│  finpy-tse (3031) → tsetmc-index-service (3033) → keepalive    │
├─────────────────────────────────────────────────────────────────┤
│                     لایه زیرساخت (Infrastructure)                │
│  safe-storage → format-price → jalali → theme-store → db       │
│  ai-postprocess → export-utils → currency                      │
└─────────────────────────────────────────────────────────────────┘
```

## ۱.۳ جریان داده (Data Flow)

### جریان اصلی تحلیل نماد:

```
کاربر نماد را انتخاب می‌کند
         │
         ▼
SymbolSearch ──► /api/instruments (جستجوی نماد)
         │
         ▼
page.tsx::handleSelect() ──► تشخیص منبع داده (TSE/TGJU/Yahoo/Index)
         │
         ├─ TSE Stock ──► /api/analysis?symbol=X
         │                    │
         │                    ├─► tse-api::fetchCandlestick() (BrsApi/fallback)
         │                    ├─► ta-engine::analyze() (تحلیل کامل)
         │                    ├─► probability-trend::buildTrendFromDailySnapshots()
         │                    └─► بازگرداندن {candles, info, ta, probabilityTrend}
         │
         ├─ TGJU ──► /api/tgju-analysis?key=X
         │               │
         │               ├─► tgju-api::fetchTgjuData()
         │               ├─► ta-engine::analyze()
         │               └─► بازگرداندن نتایج تحلیل
         │
         ├─ Yahoo ──► /api/yahoo-analysis?symbol=X
         │               │
         │               ├─► yahoo-finance-api::fetchYahooData()
         │               ├─► ta-engine::analyze()
         │               └─► بازگرداندن نتایج تحلیل
         │
         └─ Index ──► /api/analysis?symbol=X&indexInsCode=Y
                         │
                         ├─► tse-api::fetchTsetmcIndexHistory()
                         ├─► ta-engine::analyze()
                         └─► بازگرداندن نتایج شاخص
         │
         ▼
page.tsx::renderAnalysisContent()
         │
         ├─► CandlestickChart (نمودار شمعی + اندیکاتورها)
         ├─► IndicatorsPanel (۴۳ اندیکاتور با گیج نیم‌دایره)
         ├─► VdssGraph (گراف تصمیم ۹ سناریو)
         ├─► VdesAnalysis (تحلیل متنی هوشمند)
         └─► MLForecast (پیش‌بینی ML)
```

### جریان تحلیل متنی هوشمند:

```
VdesAnalysis ──► /api/vdes-analysis (POST)
         │
         ├─► ml-narrative::selectNarrativeCombination()
         │       انتخاب مکتب × سبک × لحن بر اساس شرایط بازار
         │
         ├─► ساخت پرامپت فارسی با تمام داده تکنیکال
         │
         ├─► zai-shared::dedicatedAIChatCompletion()
         │       فراخوانی LLM با مدیریت نرخ و تلاش مجدد
         │
         ├─► ai-postprocess::postProcessAnalysis()
         │       اعتبارسنجی قیمت + اصلاح فارسی + حذف کد
         │
         └─► نمایش متن تحلیل + اطلاعات دیباگ
```

## ۱.۴ منابع داده

| منبع | نوع داده | کلاس/تابع | پورت | توضیح |
|------|----------|-----------|------|-------|
| **BrsApi (TSETMC)** | سهام TSE | `tse-api.ts::fetchCandlestick()` | — | API رسمی TSETMC با کلید BrsApi |
| **finpy-tse** | سهام TSE (fallback) | `tse-api.ts` (پروکسی) | 3031 | سرویس پایتون با کتابخانه finpy-tse |
| **TSETMC CDN** | شاخص‌های بورس | `tse-index-api.ts` | — | از طریق z-ai page_reader |
| **TSETMC Proxy** | شاخص‌های بورس | `tsetmc-index-api.ts` | 3033 | سرویس واسط با کش ۴ لایه |
| **TGJU** | طلا/ارز/کریپتو | `tgju-api.ts` | — | scraping با page_reader |
| **Yahoo Finance** | بازارهای جهانی | `yahoo-finance-api.ts` | — | ۲۶۰+ نماد جهانی |

## ۱.۵ موتورهای تشخیص رژیم (بدون وابستگی خارجی)

| موتور | جایگزین | فایل | الگوریتم |
|-------|---------|------|----------|
| **فازی مبتنی بر قواعد** | GNN | `regime-engine.ts` | trimf/trapmf روی ADX, RSI, BB, DI |
| **زنجیره مارکوف ساده** | HMM | `regime-engine.ts` | ماتریس انتقال ۵×۵ + بروزرسانی بیز |
| **رأی‌گیری وزنی تطبیقی** | Transformer | `regime-engine.ts` | ۷ اندیکاتور رأی -۱/۰/+۱ با وزن تطبیقی |

**ترکیب نهایی**: `detectRegime() = 0.5×Markov + 0.3×Fuzzy + 0.2×Vote`

## ۱.۶ سیستم تم و پوسته‌ها

| شناسه | نام | نوع |
|-------|-----|-----|
| `white-blue` | آبی و سفید | روشن |
| `emerald-white` | سبز و سفید | روشن |
| `violet-white` | بنفش و سفید | روشن |
| `amber-dark` | طلایی تیره | تیره |
| `dark-navy` | سرمه‌ای تیره | تیره |

هر تم شامل ۲۷ متغیر رنگی است: صفحه، کارت، هدر، فوتر، سیگنال (bull/bear/neutral)، نمودار، ورودی و لوگو.

---

# ═══════════════════════════════════════════════════════════════════
# سطح ۲: مستندات ماژول‌ها (Module-Level Documentation)
# ═══════════════════════════════════════════════════════════════════

<a id="level-2-module-documentation"></a>

## ۲.۱ ماژول تحلیل تکنیکال (`ta-engine.ts`)

### هدف
موتور اصلی تحلیل تکنیکال که تمام اندیکاتورها، سطوح حمایت/مقاومت، و سیستم احتمال ۷ لایه VDss را پیاده‌سازی می‌کند.

### ورودی‌ها
- `data: OHLCV[]` — آرایه داده‌های OHLCV (حداقل ۲۰ کندل)
- `currencyUnit: string` — واحد پول ('ریال' | 'تومان' | 'واحد' | ...)

### خروجی
- `TAResult` — شامل تمام اندیکاتورها، سطوح S/R، سناریوها، رژیم، و نمرات

### اندیکاتورهای پیاده‌سازی شده

| دسته | اندیکاتورها | پارامترها |
|------|-------------|-----------|
| **میانگین متحرک** | SMA, EMA, WMA, HCMA, TMA, LMA, VWMA | دوره: 7, 21, 50, 100, 200 |
| **نوسان‌گر** | RSI, Stochastic(%K,%D), Williams %R, CCI, MFI, MACD, Fisher Transform | RSI(14), Stoch(14,3,3), CCI(20), MFI(14), MACD(12,26,9) |
| **ترند** | ADX, +DI, -DI, Parabolic SAR, Ichimoku Cloud | ADX(14), Ichimoku(9,26,52) |
| **نوسان** | ATR, Bollinger Bands, Historical Volatility, StdDev, Keltner Channels | ATR(14), BB(20,2) |
| **حجم** | OBV, VWAP, VAP, Chaikin AD, Force Index, VPT, VOSC | — |
| **پوشش** | Envelopes, MA Ribbon Alignment | — |

### سیستم ۷ لایه احتمال VDss

| لایه | نام | عملکرد |
|------|-----|--------|
| ۱ | Raw Scores | نمره خام هر سناریو بر اساس اندیکاتورها |
| ۲ | Momentum Correction | اصلاح مومنتوم + تشخیص کراس‌اور/داورجنس |
| ۳ | ML Training | آموزش ML + محاسبه اجماع صعودی |
| ۴ | Scenario Probabilities | تبدیل نمرات به احتمال‌های نرمال‌شده |
| ۵ | Edge Weights | وزن‌دهی یال‌های گراف تصمیم |
| ۶ | Path Probability | محاسبه احتمال مسیر با DFS |
| ۷ | Adaptive Update | بروزرسانی تطبیقی با داده جدید |

### ۹ سناریو

| شناسه | نام فارسی | شرح |
|-------|-----------|-----|
| SC1 | شوک نزولی | سقوط شدید قیمت |
| SC2 | نزولی شدید | ریزش قیمتی قوی |
| SC3 | نزولی | روند نزولی عادی |
| SC4 | نزولی خنثی | نزولی با شانس تثبیت |
| SC5 | خنثی | بدون ترند مشخص |
| SC6 | صعودی خنثی | صعودی با شانس برگشت |
| SC7 | صعودی | روند صعودی عادی |
| SC8 | صعودی شدید | رشد قیمتی قوی |
| SC9 | شوک صعودی | رشد شدید قیمت |

### سیستم حمایت/مقاومت (۷ منبع)

| منبع | متد | توضیح |
|------|------|-------|
| Swing High/Low | `findSwingLevels()` | سقف‌ها و کف‌های نوسانی |
| SMA Dynamic | `findSMALevels()` | SMA(21), SMA(50), SMA(100), SMA(200) |
| Bollinger Bands | `findBollingerLevels()` | باند بالا، میانگین، باند پایین |
| Fibonacci | `findFibonacciLevels()` | Retracement + Extension |
| Volume Profile | `findVAPLevels()` | توزیع حجم بر اساس قیمت |
| Pivot Points | `findPivotLevels()` | ۴ الگوریتم: Standard, Fibonacci, Camarilla, Woodie |
| Psychological | `findPsychologicalLevels()` | سطوح رند (اعداد گرد) |

### فرمول زاویه ترند

```typescript
angle = Math.atan((slope / avgPrice) * 100) * (180 / Math.PI)
```

- `slope`: شیب خط رگرسیون خطی قیمت‌های بسته
- `avgPrice`: میانگین قیمت‌های بسته
- `×100`: تبدیل نسبت به درصد قبل از atan (۱% رشد روزانه ≈ ۴۵°)

### یکاهای نمره ترند

```typescript
s_trend = (r2 × 0.7) + (normalize(angle) × 0.3)
```

- `r2`: ضریب تعیین رگرسیون خطی (0 تا 1)
- `normalize(angle)`: `(angle + 45) / 90` محدود به [0, 1]
- زاویه‌های منفی (نزولی) مقادیر کمتر از ۰.۵ و زاویه‌های مثبت (صعودی) مقادیر بیشتر از ۰.۵ تولید می‌کنند

---

## ۲.۲ ماژول تشخیص رژیم (`regime-engine.ts`)

### هدف
تشخیص رژیم بازار با سه موتور مستقل و ترکیب نهایی آنها. جایگزین GNN، HMM و Transformer Classifier.

### ۵ وضع رژیم

| وضع | شرح |
|-----|------|
| `TRENDING_UP` | روند صعودی قوی (ADX بالا + DI+ > DI-) |
| `TRENDING_DOWN` | روند نزولی قوی (ADX بالا + DI- > DI+) |
| `RANGING` | بازار رنج (ADX پایین + قیمت در BB) |
| `VOLATILE` | نوسان بالا (ATR بالا + تغییرات زیاد) |
| `BREAKOUT` | شکست سطح (حجم بالا + حرکت خارج از BB) |

### موتور ۱: تشخیص فازی مبتنی بر قواعد

```
ورودی‌ها: ADX, RSI, %BB (موقعیت در بولینگر), +DI, -DI, شیب EMA, ATR
         │
         ▼
توابع عضویت فازی: trimf (مثلثی) و trapmf (ذوزنقه‌ای)
         │
         ▼
قواعد فازی:
  - ADX>25 AND DI+>DI-  ──► μ(TRENDING_UP) = بالا
  - ADX>25 AND DI->DI+  ──► μ(TRENDING_DOWN) = بالا
  - ADX<20 AND price∈BB ──► μ(RANGING) = بالا
  - ATR بالا            ──► μ(VOLATILE) = بالا
  - حجم بالا AND شکست BB ──► μ(BREAKOUT) = بالا
         │
         ▼
خروجی: { up: 0..1, down: 0..1, neutral: 0..1 }
```

### موتور ۲: زنجیره مارکوف ساده

```
ماتریس انتقال ۵×۵ (T):
  T[i][j] = P(رژیم_j | رژیم_i)

بروزرسانی:
  ۱. محاسبه احتمال مشاهده از فازی: P(obs|state_j)
  ۲. بروزرسانی بیز: π_j = Σ_i (π_i × T[i][j]) × P(obs|state_j)
  ۳. نرمال‌سازی: Σπ = ۱

بروزرسانی ماتریس انتقال:
  - بعد از هر کندل: اگر رژیم تغییر کرد، افزایش T[old→new]
  - فرسایش تدریجی: T *= (1 - decay) + uniform × decay
```

### موتور ۳: رأی‌گیری وزنی تطبیقی

```
اندیکاتورهای پایه: [MACD, Stochastic, RSI, OBV, MFI, ADX, BB]

سیگنال هر اندیکاتور:
  MACD: hist>0 → +1, hist<0 → -1, else → 0
  Stoch: K>80 AND K<D → -1, K<20 AND K>D → +1, else → 0
  RSI: >70 → -1, <30 → +1, else → 0
  OBV: روند صعودی → +1, نزولی → -1
  MFI: >80 → -1, <20 → +1, else → 0
  ADX: DI+>DI- → +1, DI->DI+ → -1
  BB: بالای باند بالا → -1, پایین باند پایین → +1

رأی نهایی:
  vote = Σ (signal_i × weight_i) / Σ |weight_i|

وزن‌دهی تطبیقی:
  - وزن اولیه: ۱.۰ برای همه
  - نرخ فرسایش خطا: ۰.۰۵
  - پیش‌بینی درست: وزن ثابت
  - پیش‌بینی نادرست: weight *= (1 - 0.05)
```

### ترکیب نهایی (`detectRegime()`)

```typescript
final = 0.5 × markovResult + 0.3 × fuzzyResult + 0.2 × voteResult
```

---

## ۲.۳ ماژول پروفایل حجم (`volume-profile.ts`)

### هدف
ساخت پروفایل حجم تقریبی و شمارش تعداد برخورد از داده OHLCV، بدون نیاز به داده تیک-بای-تیک.

### تابع `approximateVolumeProfile()`

```
ورودی: data: OHLCV[], numBins: number (پیش‌فرض ۱۰۰)
         │
         ▼
۱. محدوده قیمت: [min(Low), max(High)]
۲. ساخت N باکت قیمت با عرض مساوی
         │
         ▼
۳. برای هر کندل:
   - حجم بدنه: |close - open| / |high - low|
   - حجم سایه بالا: (high - max(open,close)) / |high - low|
   - حجم سایه پایین: (min(open,close) - low) / |high - low|
   - توزیع حجم در باکت‌های مربوطه
         │
         ▼
خروجی: VolumeProfileResult {
  bins: [{ price, volume, volumePercent }],
  poc: number,          // Point of Control - بیشترین حجم
  valueAreaHigh: number, // بالای ناحیه ارزش (۷۰% حجم)
  valueAreaLow: number,  // پایین ناحیه ارزش
  vwap: number          // Volume Weighted Average Price
}
```

### تابع `countTouch()`

```
ورودی: data: OHLCV[], level: number, tolerance: number (پیش‌فرض ۰.۰۰۲ = ۰.۲%)
         │
         ▼
برای هر کندل:
  - |High - level| / level ≤ tolerance → touchCount++
  - |Low - level| / level ≤ tolerance → touchCount++
         │
         ▼
خروجی: TouchCountResult { touchCount, recentTouches, avgVolume }
```

### تابع `calculateEnhancedSRStrength()`

```
ترکیب:
  strength = (touchScore × 0.30) +
             (volumeScore × 0.25) +
             (distanceScore × 0.20) +
             (freshnessScore × 0.15) +
             (confluenceScore × 0.10)
```

---

## ۲.۴ ماژول بازخورد MSL (`msl-feedback.ts`)

### هدف
ذخیره بازخورد کاربر بر پیش‌بینی‌ها و بروزرسانی تطبیقی وزن‌های VDSS.

### ساختار داده

```typescript
interface PredictionRecord {
  id: string;
  scenarioId: string;      // شناسه سناریو (SC1..SC9)
  symbol: string;          // نماد
  timestamp: number;       // زمان پیش‌بینی
  predictedDirection: 'up' | 'down' | 'neutral';
  actualDirection?: 'up' | 'down' | 'neutral';
  isCorrect?: boolean;
}

interface WeightRecord {
  key: string;             // کلید وزن (مثلا "vdss_sc7_momentum")
  value: number;           // مقدار وزن
  updatedAt: number;       // زمان آخرین تغییر
  updateCount: number;     // تعداد تغییرات
}
```

### الگوریتم بروزرسانی وزن

```
نرخ یادگیری پایه: η = 0.01
نرخ یادگیری تطبیقی:
  - اگر دقت اخیر > ۷۰%: η_effective = η × 0.5 (آرام‌تر)
  - اگر دقت اخیر < ۳۰%: η_effective = η × 2.0 (سریع‌تر)

بروزرسانی:
  - پیش‌بینی درست: weight += η_effective × 0.1
  - پیش‌بینی نادرست: weight -= η_effective × 0.1
  - محدود: weight ∈ [0, 1] (نرمال‌سازی softmax، مجموع وزن‌ها برابر 1)
```

### پایدارسازی

- **حافظه**: آرایه در حافظه (حداکثر ۵۰۰ رکورد)
- **localStorage**: پایدارسازی خودکار با `safeLocalStorage`
- **SSR Guard**: بررسی `typeof window !== 'undefined'` قبل از دسترسی به localStorage

---

## ۲.۵ ماژول ML (`ml-engine.ts`)

### هدف
آموزش مدل تطبیقی و محاسبه اجماع صعودی با ویژگی‌های VDSS.

### ۱۶ ویژگی VDSS

| # | ویژگی | شرح |
|---|-------|-----|
| 1 | RSI | شاخص قدرت نسبی |
| 2 | RSI_change | تغییر RSI |
| 3 | StochK | استوکاستیک %K |
| 4 | MACD_hist | هیستوگرام MACD |
| 5 | ADX | میانگین شاخص جهت‌دار |
| 6 | DI_diff | +DI - -DI |
| 7 | BB_position | موقعیت قیمت در بولینگر |
| 8 | ATR_pct | ATR به درصد قیمت |
| 9 | Volume_ratio | حجم / SMA(volume) |
| 10 | Trend_angle | زاویه ترند |
| 11 | Trend_r2 | ضریب تعیین |
| 12 | SR_distance | فاصله تا نزدیک‌ترین S/R |
| 13 | SR_strength | قدرت نزدیک‌ترین S/R |
| 14 | Pattern_bull | تعداد الگوهای صعودی |
| 15 | Pattern_bear | تعداد الگوهای نزولی |
| 16 | Regime_code | کد رژیم فعلی |

### تابع `trainAdaptiveModel()`

```
۱. استخراج ۱۶ ویژگی از هر کندل
۲. تقسیم سری زمانی: TimeSeriesSplit (۵ fold)
۳. آموزش LogisticRegression با L2 regularization
۴. ذخیره مدل در حافظه
۵. بازگرداندن معیارهای ارزیابی
```

### تابع `calculateBullConsensus()`

```
اگر مدل آموزش دیده:
  bullConsensus = model.predictScore(features)
در غیر این صورت (fallback):
  bullConsensus = heuristic از RSI + ADX + MACD + BB
```

---

## ۲.۶ ماژول رگرسیون لجستیک (`ml-logistic.ts`)

### هدف
پیاده‌سازی کامل رگرسیون لجستیک در TypeScript خالص با L2 regularization.

### کلاس `StandardScaler`

```
fit(X): محاسبه mean و std هر ویژگی
transform(X): (X - mean) / std
fitTransform(X): fit + transform
inverseTransform(X): X × std + mean
```

### کلاس `LogisticRegressionModel`

```
هایپرپارامترها:
  - lr: 0.01 (نرخ یادگیری)
  - l2Lambda: 0.01 (ضریب L2)
  - maxIter: 200 (حداکثر تکرار)
  - classWeight: 'balanced' (وزن‌دهی متوازن کلاس‌ها)

آموزش:
  ۱. مقداردهی اولیه وزن‌ها با صفر
  ۲. برای هر تکرار:
     - z = X × w + b
     - pred = sigmoid(z)
     - gradient = X^T × (pred - y) / n + 2 × λ × w
     - w -= lr × gradient
     - b -= lr × mean(pred - y)
  ۳. بازگرداندن { weights, bias, accuracy, loss }
```

### کلاس `AdaptiveWeightModel`

```
استفاده از LogisticRegressionModel + StandardScaler

متدها:
  - train(X, y): آموزش با اعتبارسنجی TimeSeriesSplit
  - predictScore(x): خروجی ۰ تا ۱ (احتمال صعودی)
  - predictBatch(X): پیش‌بینی دسته‌ای با fallback [0.5, 0.5]
  - getAdaptiveParams(): پارامترهای تطبیقی برای ta-engine
  - getEdgeCoefficients(): ضرایب یال برای decision-graph
```

---

## ۲.۷ ماژول آنالیز S/R (`sr-analyzer.ts`)

### هدف
تشخیص و امتیازدهی سطوح حمایت و مقاومت با استفاده از ۷ منبع و رگرسیون خطی.

### فرآیند تحلیل

```
۱. جمع‌آوری سطوح از ۷ منبع
۲. ادغام سطوح نزدیک (فاصله < ۰.۵%)
۳. محاسبه ویژگی‌های ML هر سطح:
   - touchCount: تعداد برخورد
   - volumeRatio: حجم نسبی ناحیه
   - overlapCount: تعداد منابع همپوشانی
   - freshness: تازگی آخرین برخورد
   - distancePercent: فاصله تا قیمت فعلی
۴. رگرسیون OLS برای آموزش وزن ویژگی‌ها
۵. امتیازدهی نهایی هر سطح
۶. فیلتر فاصله: حذف سطوح نزدیک‌تر از ۵% و دورتر از ۱۰%
۷. محدودسازی: حداکثر ۲ سطح با نمره ۱۰
۸. مرتب‌سازی و انتخاب: ۶ حمایت + ۶ مقاومت + اهداف
```

---

## ۲.۸ ماژول نمرات مرکب (`composite-scores.ts`)

### هدف
محاسبه نمرات مرکب ترند و S/R از ترکیب چندین مؤلفه.

### نمره قدرت ترند (`calcTrendStrength()`)

| مؤلفه | وزن | شرح |
|-------|-----|------|
| ADX Normalized | 0.20 | ADX / 60 محدود به [0,1] |
| Slope Strength | 0.20 | |angle| / 45 محدود به [0,1] |
| MA Alignment | 0.15 | هم‌جهتی SMAها |
| Price Position | 0.15 | موقعیت قیمت نسبت به MAها |
| Momentum Position | 0.10 | موقعیت مومنتوم |
| Momentum Strength | 0.10 | قدرت مومنتوم |
| Pullback Quality | 0.10 | کیفیت پولبک |

### نمره قدرت S/R (`calcSRStrength()`)

| مؤلفه | وزن | شرح |
|-------|-----|------|
| Touch Count | 0.25 | تعداد برخورد با سطح |
| Time Validity | 0.20 | طول عمر سطح |
| Volume Profile | 0.15 | تمرکز حجم در ناحیه |
| Volatility Adj | 0.15 | تعدیل نوسان |
| Historical Sig | 0.10 | اهمیت تاریخی |
| Fib Confluence | 0.10 | همپوشانی فیبوناچی |
| Pattern Support | 0.05 | تأیید الگو |

### نمره تقویت‌شده S/R (`calcSRStrengthEnhanced()`)

افزودنی بر `calcSRStrength()`:
- **POC Alignment**: اگر سطح نزدیک POC حجم باشد، افزایش نمره
- **Value Area**: اگر سطح در ناحیه ارزش باشد، افزایش نمره
- **Precise Touch Count**: شمارش دقیق‌تر برخوردها با tolerance ±0.2%

---

## ۲.۹ ماژول وزن‌دهی بیز (`bayesian-weights.ts`)

### هدف
سیستم وزن‌دهی پویای بیز برای اندیکاتورها با prior Beta-Binomial.

### ۱۲ اندیکاتور با prior پیش‌فرض

| اندیکاتور | Alpha | Beta | توضیح |
|-----------|-------|------|-------|
| RSI | 3 | 2 | شاخص قدرت نسبی |
| MACD | 4 | 3 | MACD |
| Stochastic | 3 | 3 | استوکاستیک |
| ADX | 5 | 2 | میانگین جهت‌دار |
| Bollinger | 3 | 3 | باند بولینگر |
| Volume | 2 | 3 | حجم |
| OBV | 2 | 4 | حجم تعادلی |
| MFI | 3 | 3 | شاخص جریان پول |
| CCI | 2 | 3 | شاخص کانال کالا |
| SAR | 3 | 4 | SAR Parabolic |
| Ichimoku | 4 | 4 | ابری ایچیموکو |
| Pattern | 2 | 5 | الگوهای قیمتی |

### الگوریتم بروزرسانی

```
پس از مشاهده نتیجه (correct/wrong):
  - correct: α_new = α + 1
  - wrong: β_new = β + 1

وزن نرمال‌شده:
  w_i = softmax(log(α_i / β_i), temperature=1.5)
```

---

## ۲.۱۰ ماژول تشخیص الگو (`pattern-detection.ts`)

### الگوهای کلاسیک (۱۶)
Head & Shoulders, Double Top/Bottom, Triple Top/Bottom, Ascending/Descending/Symmetric Triangle, Ascending/Descending Wedge, Bull/Bear Flag, Pennant, Cup & Handle, Rectangle, Broadening Top/Bottom, Diamond Top/Bottom

### الگوهای هارمونیک (۶)
Gartley, Butterfly, Bat, Crab, Shark, Cypher — هر کدام با متغیر صعودی و نزولی

### الگوهای کندلی (۱۶+)
Hammer, Inverted Hammer, Bullish/Bearish Engulfing, Morning/Evening Star, Three White Soldiers, Piercing Line, Bullish/Bearish Harami, Tweezer Bottom/Top, Dragonfly Doji, Bullish Marubozu, Rising Three Methods, و معادل‌های نزولی آنها

---

## ۲.۱۱ ماژول گراف تصمیم (`decision-graph.ts`)

### هدف
محاسبه احتمال سناریوها با گراف جهت‌دار بدون دور (DAG) شامل ۳۴ گره و ۵۵+ یال.

### ۳ شاخه اصلی

| شاخه | شرح | سناریوها |
|------|------|----------|
| Trend Following | پیروی از ترند فعلی | SC3/SC4 یا SC6/SC7 |
| Breakout | شکست سطح کلیدی | SC1/SC2 یا SC8/SC9 |
| Reversal | برگشت ترند | SC2→SC7 یا SC8→SC3 |

### قانون آهنین: `enforceSumTo100()`

تمام احتمال‌ها با روش Largest Remainder Method به اعداد صحیح تبدیل می‌شوند تا مجموع = ۱۰۰.

---

## ۲.۱۲ ماژول MSL v4 (`msl-v4.ts`)

### هدف
سیستم انتخاب مکتب × سبک × لحن برای تولید پرامپت تحلیل هوشمند.

### مکتب‌ها (۶)

| مکتب | تأکید |
|------|-------|
| کلاسیک | سطوح S/R، الگوهای قیمتی، خطوط ترند |
| نوسان‌گر | RSI, MACD, Stochastic, سیگنال‌های ورود/خروج |
| حجمی | OBV, VAP, حجم نسبی، جریان پول |
| هارمونیک | فیبوناچی، الگوهای هارمونیک، نسبت‌های طلایی |
| ترکیبی | ترکیب همه مکتب‌ها |
| الیوت | امواج الیوت، شمارش موج |

### سبک‌ها (۵)

| سبک | شرح |
|------|------|
| اجرایی | مختصر، متمرکز بر تصمیم |
| تحلیلی | جزئیات کامل فنی |
| پیش‌بینی | تمرکز بر آینده و اهداف |
| معامله‌گری | نقاط ورود/خروج و ریسک |
| آموزشی | توضیح مفاهیم برای مبتدی |

### لحن‌ها (۶)

| لحن | شرح |
|------|------|
| محافظه‌کار | تأکید بر ریسک |
| تهاجمی | تأکید بر فرصت |
| متوازن | بین ریسک و فرصت |
| هشدار | تأکید بر خطر |
| خوش‌بینانه | تأکید بر پتانسیل |
| واقع‌گرایانه | بدون سوگیری |

---

## ۲.۱۳ ماژول پردازش پسین AI (`ai-postprocess.ts`)

### ۳ مرحله پردازش

| مرحله | عملکرد |
|-------|--------|
| اعتبارسنجی قیمت | تشخیص قیمت‌های توهمی (خارج از محدوده واقعی) |
| اصلاح فارسی | ZWNJ، فاصله‌گذاری، ۵۰+ قاعده کلمات مرکب |
| حذف کد فنی | تبدیل RSI→شاخص قدرت نسبی، حذف کد برنامه‌نویسی |

---

## ۲.۱۴ ماژول SDK مشترک (`zai-shared.ts`)

### هدف
مدیریت نرخ فراخوانی z-ai-web-dev-sdk با دو کانال مستقل.

### کانال ۱: صف مشترک (Shared Queue)
- استفاده: `page_reader` و سایر فراخوانی‌های غیر-AI
- محدودیت: حداقل ۲ ثانیه بین فراخوانی‌ها
- نرخ ۴29: فرسایش نمایی تا ۱۸۰ ثانیه

### کانال ۲: کانال اختصاصی AI (`dedicatedAIChatCompletion`)
- استفاده: تولید متن تحلیل هوشمند
- اولویت: هرگز مسدود نمی‌شود توسط نرخ page_reader
- تلاش مجدد: حداکثر ۵ بار با فرسایش نمایی
- زمان‌برد: ۲۰۰ ثانیه پیش‌فرض
- سرمایش جهانی: ۳ دقیقه بعد از 429

---

## ۲.۱۵ ماژول‌های داده (Data Modules)

### `tse-api.ts` — API بورس تهران

| تابع | شرح |
|------|------|
| `fetchCandlestick()` | دریافت تاریخچه کندل از BrsApi (پیش‌فرض) یا finpy-tse (fallback) |
| `fetchSymbolData()` | دریافت اطلاعات نماد شامل قیمت، EPS، P/E و غیره |
| `fetchTsetmcIndexHistory()` | دریافت تاریخچه شاخص از TSETMC CDN |
| `isGoldEtf()` | تشخیص صندوق طلا |

**ساختار کش**: فایل JSON در `db/` با TTL ۷ روز

### `tgju-api.ts` — API تاجو

| تابع | شرح |
|------|------|
| `fetchTgjuData()` | دریافت داده تاجو با page_reader |
| `fetchTgjuInstruments()` | لیست نمادهای تاجو |

**پشتیبانی**: طلا، ارز، کریپتو، بازارهای جهانی

### `yahoo-finance-api.ts` — API یاهو فایننس

| تابع | شرح |
|------|------|
| `fetchYahooData()` | دریافت تاریخچه یاهو با `yahoo-finance2` |
| `fetchYahooInstruments()` | لیست ۲۶۰+ نماد جهانی |

**پشتیبانی**: سهام، شاخص، انرژی، فلزات، کالا، فارکس، کریپتو، ETF

---

## ۲.۱۶ ماژول‌های رابط کاربری (UI Components)

### `CandlestickChart` (1,208 خط)
- کتابخانه: `lightweight-charts` v5
- ابزار رسم: کرسر، خط افقی، خط ترند، فیبوناچی، کانال، پچفورک، براش، متن، کال‌اوت، مسیر، خط‌کش، متوازی‌الاضلاع
- همپوشانی: SMA, EMA, BB, SAR, Ichimoku, VWAP, سطوح S/R
- SVG overlay برای ابزار رسم

### `IndicatorsPanel` (565 خط)
- نمایش ۴۳ اندیکاتور با گیج نیم‌دایره (`SemicircleGauge`)
- هر اندیکاتور: مقدار، سیگنال (bullish/bearish/neutral)، ناحیه رنگی

### `VdesAnalysis` (1,820 خط)
- تحلیل متنی هوشمند با فراخوانی `/api/vdes-analysis`
- نمایش سناریوها، جدول احتمال، نمرات S/R
- خروجی: PDF, CSV, XLSX, PNG

### `VdssGraph` (گراف تصمیم)
- نمایش گراف DAG با ۹ سناریو
- یال‌های موجه با احتمال شرطی

### `MLForecast` (598 خط)
- پیش‌بینی ML از `/api/ml-predict`
- نمودار SVG پیش‌بینی با بازه اطمینان
- نمایش اهمیت ویژگی‌ها و وزن‌های آنسامبل

### `SymbolSearch` (1,290 خط)
- جستجوی پیشرفته با فیلتر دسته‌بندی، صنعت، کشور
- امتیازدهی چندفیلدی با مرتب‌سازی
- تاریخچه جستجو در localStorage
- پشتیبانی: TSE + TGJU + Yahoo

---

# ═══════════════════════════════════════════════════════════════════
# سطح ۳: مستندات توابع و APIها (Function & API Documentation)
# ═══════════════════════════════════════════════════════════════════

<a id="level-3-function--api-documentation"></a>

## ۳.۱ توابع اصلی `ta-engine.ts`

### `analyze(data: OHLCV[], currencyUnit: string): TAResult`

**هدف**: تابع اصلی تحلیل تکنیکال. تمام اندیکاتورها، سطوح S/R، سناریوها و رژیم را محاسبه می‌کند.

**پارامترها**:
- `data`: آرایه داده‌های OHLCV (حداقل ۲۰ مورد نیاز، ۱۰۰+ توصیه‌شده)
- `currencyUnit`: واحد پول برای نمایش ('ریال', 'تومان', 'واحد', 'دلار', 'تتر')

**خروجی**: `TAResult` شامل:
```typescript
{
  // قیمت فعلی و تغییرات
  currentPrice, prevClose, change, changePercent,

  // اندیکاتورها
  rsi, mfi, cci, adx, diPlus, diMinus,
  stochK, stochD, williamsR,
  macdLine, macdSignal, macdHist,
  atr, sar,
  bollingerUpper, bollingerMiddle, bollingerLower, bollingerWidth,
  obv, vwap,
  ichimokuTenkan, ichimokuKijun, ichimokuSenkouA, ichimokuSenkouB,

  // میانگین‌های متحرک
  sma21, sma50, sma100, sma200,
  ema12, ema26,

  // تحلیل ترند
  trendDirection, // 'up' | 'down' | 'neutral'
  trendAngle,     // زاویه بر درجه (-90 تا +90)
  trendR2,        // ضریب تعیین (0 تا 1)
  trendStrength,  // نمره قدرت ترند (0 تا 10)

  // سطوح حمایت و مقاومت
  supports, resistances,
  supportStrengths, resistanceStrengths,
  priceTargets,

  // سناریوها
  scenarios: { SC1..SC9 },

  // رژیم
  regimeResult: {
    primary: RegimeType,
    secondary: RegimeType,
    probabilities: Record<RegimeType, number>,
    markovState: number[],
    fuzzyMemberships: Record<string, number>,
    voteResult: number,
    confidence: number
  },

  // سیگنال کلی
  overallSignal, // 'bullish' | 'bearish' | 'neutral'
  signalStrength, // 0 تا 10
}
```

**الگوریتم**:
1. محاسبه تمام اندیکاتورها (SMA, EMA, RSI, MACD, ...)
2. تشخیص ترند با `calcTrend()` (رگرسیون خطی + زاویه)
3. محاسبه سطوح S/R از ۷ منبع
4. امتیازدهی S/R با `sr-analyzer`
5. محاسبه سناریوها با ۷ لایه VDss
6. تشخیص رژیم با `regime-engine.detectRegime()`
7. تعیین سیگنال کلی

---

### `calcTrend(data: OHLCV[], period: number): TrendResult`

**هدف**: محاسبه ترند با رگرسیون خطی و زاویه.

**پارامترها**:
- `data`: داده OHLCV
- `period`: دوره رگرسیون (پیش‌فرض ۲۰)

**خروجی**:
```typescript
{
  slope: number,      // شیب خط رگرسیون
  intercept: number,  // عرض از مبدأ
  r2: number,         // ضریب تعیین
  angle: number,      // زاویه بر درجه
  direction: 'up' | 'down' | 'neutral'
}
```

**فرمول زاویه**:
```
angle = atan((slope / avgPrice) × 100) × (180 / π)
```
- ×100 تبدیل نسبت شیب/قیمت به درصد قبل از atan
- نتیجه: ۱% رشد روزانه ≈ ۴۵°

---

### `linearRegression(y: number[]): { slope, intercept, r2 }`

**هدف**: رگرسیون خطی کمترین مجذرات بر داده‌های سری زمانی.

**الگوریتم**:
```
x = [0, 1, 2, ..., n-1]  (ایندکس زمانی)
slope = (n×Σxy - Σx×Σy) / (n×Σx² - (Σx)²)
intercept = (Σy - slope×Σx) / n
r2 = 1 - SS_res / SS_tot
```

---

### `computeHistoricalProbabilities(data: OHLCV[], maxDays: number): DailySnapshot[]`

**هدف**: محاسبه احتمال‌های تاریخی برای هر روز در ۳۰ روز گذشته.

**الگوریتم**:
برای هر روز t در بازه [len-maxDays, len]:
1. استفاده از داده‌های [0, t] برای تحلیل
2. فراخوانی `analyze()` روی زیرمجموعه
3. ذخیره احتمال‌های سناریو در `DailySnapshot`

---

## ۳.۲ توابع `regime-engine.ts`

### `fuzzyRegimeDetector(input: FuzzyInput): FuzzyOutput`

**پارامترها**:
```typescript
interface FuzzyInput {
  adx: number;        // ADX (0-100)
  rsi: number;        // RSI (0-100)
  bbPosition: number; // موقعیت در بولینگر (0-1)
  diPlus: number;     // +DI
  diMinus: number;    // -DI
  emaSlope: number;   // شیب EMA (درصد)
  atrPct: number;     // ATR به درصد قیمت
}
```

**خروجی**:
```typescript
{
  up: number,      // عضویت فازی صعودی (0-1)
  down: number,    // عضویت فازی نزولی (0-1)
  neutral: number  // عضویت فازی خنثی (0-1)
}
```

**توابع عضویت**:
- `trimf(x, a, b, c)`: تابع مثلثی — بیشترین مقدار در x=b
- `trapmf(x, a, b, c, d)`: تابع ذوزنقه‌ای — بیشترین مقدار در [b,c]

---

### `calculateTrendStrengthRB(input: TrendStrengthInput): number`

**پارامترها**:
```typescript
interface TrendStrengthInput {
  adx: number;           // ADX نرمال‌شده (0-1)
  emaSlope: number;      // شیب EMA نرمال‌شده (0-1)
  bbPosition: number;    // موقعیت در بولینگر (0-1)
}
```

**خروجی**: نمره قدرت ترند (0 تا 1)

**فرمول**:
```
strength = (adx × 0.50) + (emaSlope × 0.30) + (|bbPosition - 0.5| × 2 × 0.20)
```

---

### `createMarkovChain(): MarkovChain`

**خروجی**: زنجیره مارکوف با ماتریس انتقال یکنواخت (0.2 در همه جایگاه‌ها).

---

### `updateRegimeTransition(chain: MarkovChain, fromState: RegimeType, toState: RegimeType): void`

**هدف**: بروزرسانی ماتریس انتقال بعد از مشاهده تغییر رژیم.

**الگوریتم**:
```
T[from][to] += 1
فرسایش: T[i][j] = T[i][j] × (1 - 0.001) + 0.001 × uniform
نرمال‌سازی هر سطر: Σ_j T[i][j] = 1
```

---

### `propagateMarkov(chain: MarkovChain, observation: FuzzyOutput): number[]`

**هدف**: انتشار رو به جلو با بروزرسانی بیز.

**الگوریتم**:
```
برای هر وضع j:
  π_new[j] = Σ_i (π[i] × T[i][j]) × P(observation | state_j)

نرمال‌سازی: Σπ = 1
```

**احتمال مشاهده** `P(obs | state_j)`:
- از عضویت‌های فازی به عنوان likelihood استفاده می‌شود
- هر وضع رژیم به یک عضویت فازی نگاشت می‌شود

---

### `adaptiveWeightedVote(indicators: IndicatorValues, weights: IndicatorWeights): VoteResult`

**پارامترها**:
```typescript
interface IndicatorValues {
  macdHist: number; stochK: number; stochD: number;
  rsi: number; obvTrend: 'up' | 'down' | 'flat';
  mfi: number; diPlus: number; diMinus: number;
  bbPosition: number;
}
interface IndicatorWeights {
  macd: number; stochastic: number; rsi: number;
  obv: number; mfi: number; adx: number; bollinger: number;
}
```

**خروجی**:
```typescript
{
  vote: number,           // -1 تا +1
  signals: Record<string, number>, // سیگنال هر اندیکاتور
  totalWeight: number
}
```

---

### `detectRegime(input: RegimeInput): RegimeResult`

**هدف**: تابع اصلی تشخیص رژیم — ترکیب سه موتور.

**خروجی**:
```typescript
{
  primary: RegimeType,           // رژیم اصلی
  secondary: RegimeType,         // رژیم فرعی
  probabilities: Record<RegimeType, number>, // احتمال هر وضع
  markovState: number[],         // وضع مارکوف
  fuzzyMemberships: Record<string, number>, // عضویت فازی
  voteResult: number,            // رأی وزنی
  confidence: number             // اطمینان (0-1)
}
```

**ترکیب**:
```
prob_final = 0.5 × markov_probs + 0.3 × fuzzy_probs + 0.2 × vote_probs
primary = argmax(prob_final)
confidence = max(prob_final)
```

---

## ۳.۳ توابع `volume-profile.ts`

### `approximateVolumeProfile(data: OHLCV[], numBins?: number): VolumeProfileResult`

**پارامترها**:
- `data`: داده OHLCV (۳۰ روز توصیه‌شده)
- `numBins`: تعداد باکت‌های قیمت (پیش‌فرض ۱۰۰)

**خروجی**:
```typescript
{
  bins: Array<{ price: number; volume: number; volumePercent: number }>;
  poc: number;              // Point of Control
  valueAreaHigh: number;    // بالای ناحیه ارزش
  valueAreaLow: number;     // پایین ناحیه ارزش
  vwap: number;             // Volume Weighted Average Price
  totalVolume: number;
}
```

**الگوریتم توزیع حجم هر کندل**:
```
totalRange = high - low
bodyRatio = |close - open| / totalRange
upperWickRatio = (high - max(open,close)) / totalRange
lowerWickRatio = (min(open,close) - low) / totalRange

حجم بدنه → باکت‌های بین open و close
حجم سایه بالا → باکت‌های بین max(open,close) و high
حجم سایه پایین → باکت‌های بین low و min(open,close)
```

---

### `countTouch(data: OHLCV[], level: number, tolerance?: number): TouchCountResult`

**پارامترها**:
- `data`: داده OHLCV
- `level`: سطح S/R
- `tolerance`: تلورانس برخورد (پیش‌فرض ۰.۰۰۲ = ۰.۲%)

**خروجی**:
```typescript
{
  touchCount: number;         // تعداد کل برخوردها
  recentTouches: number;      // برخوردهای ۱۰ روز اخیر
  avgVolume: number;          // حجم متوسط برخوردها
  lastTouchDate: string;      // تاریخ آخرین برخورد
}
```

**شرط برخورد**:
```
|high - level| / level ≤ tolerance  →  touch
|low - level| / level ≤ tolerance   →  touch
```

---

### `volumeAtLevel(profile: VolumeProfileResult, price: number): number`

**هدف**: میان‌یابی خطی دوبعدی پروفایل حجم در یک قیمت مشخص.

---

### `calculateEnhancedSRStrength(params: EnhancedSRParams): EnhancedSRStrengthResult`

**پارامترها**:
```typescript
interface EnhancedSRParams {
  level: number;
  currentPrice: number;
  data: OHLCV[];
  volumeProfile: VolumeProfileResult;
  tolerance?: number;        // تلورانس برخورد (پیش‌فرض 0.002)
  lookbackPeriod?: number;   // دوره بازگشت (پیش‌فرض 50)
}
```

**خروجی**:
```typescript
{
  strength: number,          // نمره نهایی (0-10)
  touchScore: number,       // نمره برخورد (0-1)
  volumeScore: number,      // نمره حجم (0-1)
  distanceScore: number,    // نمره فاصله (0-1)
  freshnessScore: number,   // نمره تازگی (0-1)
  confluenceScore: number,  // نمره همپوشانی (0-1)
  details: {
    touchCount: number,
    pocDistance: number,
    inValueArea: boolean,
    lastTouchDaysAgo: number
  }
}
```

---

## ۳.۴ توابع `msl-feedback.ts`

### `FeedbackStore` (کلاس سینگلتون)

#### `recordPrediction(scenarioId, symbol, direction): string`

**هدف**: ثبت یک پیش‌بینی جدید.

**پارامترها**:
- `scenarioId`: شناسه سناریو (SC1..SC9)
- `symbol`: نماد سهام
- `direction`: جهت پیش‌بینی ('up' | 'down' | 'neutral')

**خروجی**: شناسه یکتای رکورد

#### `recordFeedback(predictionId, isCorrect): void`

**هدف**: ثبت بازخورد کاربر و راه‌اندازی بروزرسانی وزن.

**الگوریتم**:
```
۱. علامت‌گذاری پیش‌بینی به عنوان درست/نادرست
۲. استخراج سناریو و جهت
۳. فراخوانی updateWeightsFromFeedback()
۴. ذخیره در localStorage
```

#### `updateWeightsFromFeedback(prediction, isCorrect): void`

**الگوریتم**:
```
نرخ یادگیری تطبیقی:
  recentAccuracy = correct / total (۲۰ اخیر)
  اگر recentAccuracy > 0.7: η = 0.01 × 0.5
  اگر recentAccuracy < 0.3: η = 0.01 × 2.0
  در غیر این صورت: η = 0.01

بروزرسانی وزن:
  اگر isCorrect:
    weight += η × 0.1
  در غیر این صورت:
    weight -= η × 0.1

محدودسازی: weight ∈ [0, 1] (نرمال‌سازی softmax، مجموع وزن‌ها برابر 1)
```

#### `getAdaptiveWeights(): Record<string, number>`

**خروجی**: نقشه کلید→وزن شامل تمام وزن‌های تطبیقی.

#### `getFeedbackStats(): FeedbackStats`

**خروجی**:
```typescript
{
  totalPredictions: number;
  totalFeedback: number;
  overallAccuracy: number;
  accuracyByScenario: Record<string, number>;
  accuracyByDirection: Record<string, number>;
  recentAccuracy: number;      // ۲۰ اخیر
  averageWeight: number;
}
```

---

## ۳.۵ توابع `ml-engine.ts`

### `extractVDSSFeatures(dayData, prevData, taResult): number[]`

**هدف**: استخراج ۱۶ ویژگی VDSS از داده‌های تکنیکال.

**خروجی**: آرایه ۱۶ عنصری شامل: RSI, RSI_change, StochK, MACD_hist, ADX, DI_diff, BB_position, ATR_pct, Volume_ratio, Trend_angle, Trend_r2, SR_distance, SR_strength, Pattern_bull, Pattern_bear, Regime_code

---

### `trainAdaptiveModel(historicalData, labels): TrainingResult`

**پارامترها**:
- `historicalData`: آرایه ۲ بعدی ویژگی‌ها
- `labels`: آرایه برچسب‌ها (0/1)

**خروجی**:
```typescript
{
  accuracy: number;
  loss: number;
  featureImportance: number[];
  crossValScores: number[];
}
```

**الگوریتم**:
1. StandardScaler.fitTransform() روی ویژگی‌ها
2. TimeSeriesSplit به ۵ fold
3. آموزش LogisticRegression با L2 regularization
4. ارزیابی با accuracy و loss

---

### `calculateBullConsensus(features, model): number`

**خروجی**: عدد ۰ تا ۱ نشان‌دهنده اجماع صعودی.

**Fallback** (بدون مدل آموزش‌دیده):
```
bullScore = (rsi < 40 ? 0.3 : rsi > 60 ? -0.1 : 0) +
            (adx > 25 && diPlus > diMinus ? 0.3 : 0) +
            (macdHist > 0 ? 0.2 : -0.2) +
            (bbPosition < 0.3 ? 0.2 : bbPosition > 0.7 ? -0.2 : 0)

bullConsensus = sigmoid(bullScore)
```

---

## ۳.۶ توابع `composite-scores.ts`

### `calcTrendStrength(params: TrendStrengthParams): TrendStrengthResult`

**پارامترها**:
```typescript
interface TrendStrengthParams {
  adx: number;
  adxMax?: number;        // پیش‌فرض 60
  angle: number;
  angleMax?: number;      // پیش‌فرض 45
  r2: number;
  smaAlignment?: number;  // -1 تا +1
  priceVsMA?: number;     // -1 تا +1
  momentum?: number;      // -1 تا +1
  pullback?: number;      // 0 تا 1
}
```

**خروجی**: `{ score: number (0-10), components: Record<string, number> }`

---

### `calcSRStrength(params: SRStrengthParams): SRStrengthResult`

**پارامترها**:
```typescript
interface SRStrengthParams {
  touchCount: number;
  maxTouches?: number;      // پیش‌فرض 20
  ageDays: number;
  maxAge?: number;          // پیش‌فرض 250
  volumeRatio: number;
  volatilityPct: number;
  hasHistoricalSignificance: boolean;
  fibConfluence: boolean;
  patternSupport: boolean;
}
```

**خروجی**: `{ score: number (0-10), components: Record<string, number> }`

---

### `calcSRStrengthEnhanced(params, volumeProfile, data): SRStrengthResult`

**افزودنی‌ها** بر `calcSRStrength`:
- محاسبه `countTouch()` دقیق با tolerance ±0.2%
- بررسی POC Alignment (فاصله تا POC)
- بررسی Value Area (آیا سطح در ناحیه ۷۰% حجم است)
- تقویت نمره بر اساس پروفایل حجم

---

## ۳.۷ API Routes

### `GET /api/analysis?symbol=X[&indexInsCode=Y]`

**هدف**: تحلیل کامل تکنیکال یک نماد یا شاخص.

**پارامترهای کوئری**:
- `symbol` (الزامی): نماد سهام یا نام شاخص
- `indexInsCode` (اختیاری): کد شاخص TSETMC

**فرآیند**:
1. اگر `indexInsCode` وجود دارد: fetchTsetmcIndexHistory → analyze
2. در غیر این صورت: fetchCandlestick + fetchSymbolData → analyze
3. محاسبه probabilityTrend با computeHistoricalProbabilities
4. بازگرداندن { candles, info, ta, probabilityTrend }

**خروجی**:
```json
{
  "symbol": "فولاد",
  "candles": [...],
  "info": { "name", "lastPrice", "change", "volume", "eps", "pe", ... },
  "ta": { /* TAResult کامل */ },
  "probabilityTrend": { /* 30-day trend */ }
}
```

---

### `POST /api/vdes-analysis`

**هدف**: تولید تحلیل متنی هوشمند فارسی با LLM.

**بدنه درخواست** (`VdesRequest`):
```json
{
  "symbolName": "فولاد",
  "currentPrice": 12500,
  "trendDirection": "up",
  "rsi": 62.5, "adx": 28.3, "mfi": 55, "cci": 120,
  "stochK": 78, "stochD": 72,
  "macdLine": 150, "macdSignal": 120, "macdHist": 30,
  "diPlus": 25, "diMinus": 18,
  "bollingerUpper": 13000, "bollingerMiddle": 12000, "bollingerLower": 11000,
  "scenarios": { "SC1": {...}, ..., "SC9": {...} },
  "resistances": [13000, 12500],
  "supports": [11500, 11000],
  "resistanceStrengths": [...],
  "supportStrengths": [...]
}
```

**فرآیند**:
1. `selectNarrativeCombination()` — انتخاب مکتب × سبک × لحن
2. ساخت پرامپت فارسی با تمام داده تکنیکال
3. بررسی کش (TTL: ۱۰ دقیقه)
4. `dedicatedAIChatCompletion()` — فراخوانی LLM
5. بازگرداندن متن تحلیل

**خروجی**:
```json
{
  "analysis": "متن تحلیل فارسی...",
  "_debug": {
    "school": "کلاسیک",
    "style": "تحلیلی",
    "tone": "متوازن",
    "cached": false,
    "latencyMs": 8500
  }
}
```

---

### `POST /api/ai-analysis`

**هدف**: تحلیل هوشمند پیشرفته با ترکیب MSL v4 + Regime + ML Selector.

**فرآیند**:
1. اعتبارسنجی درخواست
2. `selectMLCombination()` — انتخاب ترکیب ML
3. `selectMSLV4()` — انتخاب مکتب × سبک × لحن
4. `detectRegime()` — تشخیص رژیم بازار
5. ساخت پرامپت جامع با داده + سناریو + رژیم + MSL
6. `dedicatedAIChatCompletion()` — فراخوانی LLM
7. `postProcessAnalysis()` — پردازش پسین
8. کش در دیتابیس (Prisma)
9. بازگرداندن تحلیل + اطلاعات دیباگ

---

### `POST /api/ml-predict`

**هدف**: پیش‌بینی ML با فراخوانی سرویس پایتون (پورت ۳۰۳۲).

**بدنه درخواست**:
```json
{
  "candles": [...],  // حداقل ۶۰ کندل
  "sessions": 10,    // ۱ تا ۳۰
  "models": ["rf", "xgboost", "lightgbm"]  // اختیاری
}
```

**خروجی**: پیش‌بینی‌های ML شامل قیمت هدف، بازه اطمینان، اهمیت ویژگی‌ها

**توجه**: این سرویس به پورت ۳۰۳۲ وابسته است و در صورت عدم دسترسی، خطای ۵۰۳ برمی‌گرداند.

---

### `GET /api/instruments?q=X&category=Y`

**هدف**: جستجوی نمادهای TSE.

**خروجی**: لیست نمادها با نام، گروه، صنعت و غیره

---

### `GET /api/tgju-instruments?q=X`

**هدف**: جستجوی نمادهای تاجو (طلا، ارز، کریپتو).

---

### `GET /api/yahoo-instruments?q=X`

**هدف**: جستجوی نمادهای یاهو فایننس (بازارهای جهانی).

---

### `GET /api/finpy-sector`

**هدف**: دریافت اطلاعات بخش‌های بورس از finpy-tse (پورت ۳۰۳۱).

---

### `GET /api/index-analysis?symbol=X&insCode=Y`

**هدف**: تحلیل شاخص بورس با داده TSETMC.

---

### `POST /api/v8-analysis` تا `POST /api/v12-analysis`

**هدف**: نسخه‌های مختلف موتور تحلیل متنی (v8 تا v12). هر نسخه الگوریتم‌های بهبودیافته دارد.

---

## ۳.۸ توابع کمکی

### `format-price.ts`

| تابع | شرح |
|------|------|
| `detectDecimals(price, type, source)` | تشخیص خودکار تعداد ارقام اعشار |
| `getCurrencyUnit(type, source)` | تشخیص واحد پول بر اساس منبع |
| `formatPrice(price, decimals, unit)` | قالب‌بندی قیمت با جداکننده فارسی |

**قواعد اعشار**:
- TSE سهام: ۰ رقم اعشار
- TGJU تومان: ۰ رقم اعشار
- Yahoo: بر اساس بزرگی قیمت (قیمت < ۱ → ۶ رقم، < ۱۰۰ → ۲ رقم، غیر این صورت → ۰)

---

### `jalali.ts`

| تابع | شرح |
|------|------|
| `gregorianToJalali(y, m, d)` | تبدیل میلادی به شمسی |
| `jalaliToGregorian(y, m, d)` | تبدیل شمسی به میلادی |
| `toPersianDigits(str)` | تبدیل ارقام لاتین به فارسی |
| `formatJalaliDate(date)` | قالب‌بندی تاریخ شمسی |
| `getPersianWeekday(date)` | نام روز هفته فارسی |
| `smartDateDetection(str)` | تشخیص خودکار فرمت تاریخ |

---

### `safe-storage.ts`

| تابع | شرح |
|------|------|
| `safeLocalStorage.getItem(key)` | دریافت با مدیریت خطای sandbox |
| `safeLocalStorage.setItem(key, value)` | ذخیره با مدیریت خطای sandbox |
| `createSafeResizeObserver(cb)` | ResizeObserver بدون خطا |

**توجه**: در iframe‌های sandbox (مانند پنل پیش‌نمایش Z.ai)، localStorage ممکن است SecurityError بدهد. این توابع هرگز خطا نمی‌دهند.

---

### `theme-store.ts`

| تابع/کلاس | شرح |
|-----------|------|
| `useTheme()` | هوک React برای دسترسی به تم فعلی |
| `useThemeStore()` | استور Zustand با پایدارسازی localStorage |
| `THEME_PRESETS` | آرایه ۵ تم پیش‌فرض |

هر تم شامل ۲۷ متغیر رنگی:
- صفحه: `pageBg`, `pageFg`
- هدر: `headerBg`, `headerBorder`, `headerFg`, `headerSubFg`
- فوتر: `footerBorder`, `footerFg`
- کارت: `cardBg`, `cardBorder`, `cardFg`, `cardSubFg`
- اصلی: `primary`, `primaryFg`, `primaryBg`, `accent`, `accentFg`
- سیگنال: `bullColor`, `bullBg`, `bearColor`, `bearBg`, `neutralColor`, `neutralBg`
- نمودار: `chartBg`, `chartGrid`, `chartText`, `chartCrosshair`
- ورودی: `border`, `inputBorder`, `inputBg`
- لوگو: `logoBg`, `logoColor`, `logoBorderColor`

---

## ۳.۹ Mini Services

### `finpy-tse` (پورت ۳۰۳۱)

**هدف**: سرویس واسط پایتون برای دسترسی به داده‌های بورس تهران با کتابخانه `finpy-tse`.

**نقاط پایانی**:
- `GET /api/candlestick?symbol=X&days=Y` — دریافت تاریخچه کندل
- `GET /api/symbol-data?symbol=X` — دریافت اطلاعات نماد
- `GET /health` — بررسی سلامت سرویس

---

### `tsetmc-index-service` (پورت ۳۰۳۳)

**هدف**: سرویس واسط برای داده‌های شاخص TSETMC با کش ۴ لایه.

**لایه‌های کش**:
1. حافظه (سریع‌ترین)
2. فایل JSON در دیسک
3. پروکسی TSETMC CDN
4. فایل منقضی‌شده (fallback)

**نقاط پایانی**:
- `GET /api/index-history?insCode=X&days=Y` — تاریخچه شاخص
- `GET /api/sectors` — بخش‌های بورس
- `GET /health` — بررسی سلامت

---

### `dev-keepalive` (پورت ۳۰۳۴)

**هدف**: سرویس نگهدارنده برای جلوگیری از sleep محیط توسعه.

---

## ۳.۱۰ ساختار داده‌های اصلی

### `OHLCV`
```typescript
interface OHLCV {
  date: string;    // تاریخ (YYYY-MM-DD)
  open: number;    // قیمت باز
  high: number;    // بالاترین قیمت
  low: number;     // پایین‌ترین قیمت
  close: number;   // قیمت بسته
  volume: number;  // حجم معامله
}
```

### `ScenarioResult`
```typescript
interface ScenarioResult {
  name: string;          // نام فارسی
  nameEn: string;        // نام انگلیسی
  probability: number;   // احتمال (0-100)
  targetMin: number;     // حداقل هدف قیمتی
  targetMax: number;     // حداکثر هدف قیمتی
  description: string;   // شرح فارسی
}
```

### `TAResult`
(تعریف کامل در بخش ۳.۱ `analyze()`)

### `RegimeType`
```typescript
type RegimeType = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'VOLATILE' | 'BREAKOUT';
```

### `VolumeProfileResult`
(تعریف کامل در بخش ۳.۳ `approximateVolumeProfile()`)

---

## ۳.۱۱ جدول تطبیق مستندات و کد

| مستند | فایل کد | تابع/کلاس | تطبیق |
|-------|---------|-----------|-------|
| ۲.۱ تحلیل تکنیکال | `ta-engine.ts` | `analyze()` | ✅ کامل |
| ۲.۱ فرمول زاویه | `ta-engine.ts:calcTrend()` | `atan((slope/avgPrice)*100)` | ✅ کامل |
| ۲.۱ ۷ لایه VDss | `ta-engine.ts` | لایه ۱-۷ | ✅ کامل |
| ۲.۱ ۹ سناریو | `ta-engine.ts` | SC1-SC9 | ✅ کامل |
| ۲.۱ ۷ منبع S/R | `ta-engine.ts` | `find*Levels()` | ✅ کامل |
| ۲.۲ تشخیص فازی | `regime-engine.ts` | `fuzzyRegimeDetector()` | ✅ کامل |
| ۲.۲ مارکوف | `regime-engine.ts` | `createMarkovChain()` | ✅ کامل |
| ۲.۲ رأی‌گیری | `regime-engine.ts` | `adaptiveWeightedVote()` | ✅ کامل |
| ۲.۲ ترکیب نهایی | `regime-engine.ts` | `detectRegime()` | ✅ کامل |
| ۲.۳ پروفایل حجم | `volume-profile.ts` | `approximateVolumeProfile()` | ✅ کامل |
| ۲.۳ شمارش برخورد | `volume-profile.ts` | `countTouch()` | ✅ کامل |
| ۲.۳ S/R تقویت‌شده | `volume-profile.ts` | `calculateEnhancedSRStrength()` | ✅ کامل |
| ۲.۴ بازخورد MSL | `msl-feedback.ts` | `FeedbackStore` | ✅ کامل |
| ۲.۴ بروزرسانی وزن | `msl-feedback.ts` | `updateWeightsFromFeedback()` | ✅ کامل |
| ۲.۵ ML Engine | `ml-engine.ts` | `trainAdaptiveModel()` | ✅ کامل |
| ۲.۵ اجماع صعودی | `ml-engine.ts` | `calculateBullConsensus()` | ✅ کامل |
| ۲.۶ رگرسیون لجستیک | `ml-logistic.ts` | `LogisticRegressionModel` | ✅ کامل |
| ۲.۶ مدل تطبیقی | `ml-logistic.ts` | `AdaptiveWeightModel` | ✅ کامل |
| ۲.۷ آنالیز S/R | `sr-analyzer.ts` | `analyzeSupportResistance()` | ✅ کامل |
| ۲.۸ نمرات مرکب | `composite-scores.ts` | `calcTrendStrength()` | ✅ کامل |
| ۲.۸ S/R تقویت‌شده | `composite-scores.ts` | `calcSRStrengthEnhanced()` | ✅ کامل |
| ۲.۹ وزن بیز | `bayesian-weights.ts` | `updateIndicatorWeight()` | ✅ کامل |
| ۲.۱۰ الگوها | `pattern-detection.ts` | `scanAllPatterns()` | ✅ کامل |
| ۲.۱۱ گراف تصمیم | `decision-graph.ts` | `calculateScenarioProbabilities()` | ✅ کامل |
| ۲.۱۲ MSL v4 | `msl-v4.ts` | `selectMSLV4()` | ✅ کامل |
| ۲.۱۳ پردازش پسین | `ai-postprocess.ts` | `postProcessAnalysis()` | ✅ کامل |
| ۲.۱۴ z-ai SDK | `zai-shared.ts` | `dedicatedAIChatCompletion()` | ✅ کامل |
| ۲.۱۵a TSE API | `tse-api.ts` | `fetchCandlestick()` | ✅ کامل |
| ۲.۱۵b TGJU API | `tgju-api.ts` | `fetchTgjuData()` | ✅ کامل |
| ۲.۱۵c Yahoo API | `yahoo-finance-api.ts` | `fetchYahooData()` | ✅ کامل |
| ۳.۷ vdes-analysis | `api/vdes-analysis/route.ts` | `POST` | ✅ کامل |
| ۳.۷ ai-analysis | `api/ai-analysis/route.ts` | `POST` | ✅ کامل |
| ۳.۷ ml-predict | `api/ml-predict/route.ts` | `POST` | ✅ کامل |
| ۳.۷ analysis | `api/analysis/route.ts` | `GET` | ✅ کامل |

---

## ۳.۱۲ نکات مهم پیاده‌سازی

### تبدیل اعداد فارسی در RTL
برای جلوگیری از مشکل bidi در اعداد فارسی داخل متن RTL، از Unicode bidi isolation استفاده می‌شود:
```
\u2066{عدد}\u2069
```

### قانون آهنین احتمال‌ها
تمام احتمال‌های سناریو باید مجموع ۱۰۰ باشند. `enforceSumTo100()` از روش Largest Remainder استفاده می‌کند:
1. ضرب هر احتمال در ۱۰۰
2. نگهداری جزء صحیح
3. توزیع باقی‌مانده‌ها بر اساس بزرگی جزء اعشاری

### مدیریت خطای iframe
در پنل پیش‌نمایش Z.ai (iframe sandbox):
- `localStorage` ممکن است SecurityError بدهد → `safe-storage.ts`
- `ResizeObserver` ممکن است در دسترس نباشد → `createSafeResizeObserver()`
- خطاهای `ResizeObserver loop limit exceeded` → فیلتر در `layout.tsx`

### Gold ETF Detection
```typescript
function isGoldEtf(symbol: string, name: string): boolean
```
تشخیص صندوق‌های مبتنی بر طلا با کلیدواژه‌های: عیار، طلای، گوهر، زر، سکه

---

*پایان مستندات سیستم — سطح ۱ تا سطح ۳*
