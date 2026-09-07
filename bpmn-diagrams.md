# سامانه تحلیل تکنیکال مالی ایران - نمودارهای BPMN 2.0

> Persian Financial Technical Analysis System — Comprehensive BPMN 2.0 Process Diagrams
> 
> Generated: 2025-03-04 | Diagrams: 8 | Levels: 3

---

===DIAGRAM_START===

## Diagram 1 of 8

- **id**: `BPMN-L1-001`
- **title**: نمای کلی فرآیند تحلیل تکنیکال مالی
- **level**: 1
- **description**:
  این نمودار نمای کلی فرآیند اصلی سامانه تحلیل تکنیکال مالی ایران را نشان می‌دهد.
  فرآیند از انتخاب نماد توسط تحلیل‌گر آغاز شده و با دریافت داده از منابع مختلف ادامه می‌یابد.
  پس از اجرای موتور تحلیل تکنیکال، رژیم بازار تشخیص داده می‌شود و احتمالات سناریوها محاسبه می‌گردد.
  در نهایت متن تحلیلی توسط هوش مصنوعی تولید و نتایج به کاربر نمایش داده می‌شود.
  سه دروازه تصمیم‌گیری کلیدی شامل موفقیت در دریافت داده، نوع رژیم بازار و محدودیت نرخ AI وجود دارد.
  شش لایه معماری سیستم در سه استخر با لین‌های مجزا نمایش داده شده‌اند.
- **happyPath**:
  تحلیل‌گر نماد را انتخاب می‌کند ← داده با موفقیت از BrsApi دریافت می‌شود ← تحلیل تکنیکال اجرا می‌گردد ← رژیم Trend تشخیص داده می‌شود ← احتمالات سناریوها محاسبه می‌شود ← متن AI بدون محدودیت نرخ تولید می‌شود ← نتایج نمایش داده می‌شود
- **exceptionFlows**:
  ۱) خطا در دریافت داده: BrsApi ناموفق → تلاش از TSETMC → تلاش از TGJU → تلاش از Yahoo Finance → اگر همه ناموفق ← نمایش خطا به کاربر
  ۲) رژیم Range/Choppy: مسیر تحلیل متفاوت با استراتژی Reversal فعال می‌شود
  ۳) محدودیت نرخ AI: سیستم با تأخیر مجدد تلاش می‌کند یا نسخه کش‌شده را نمایش می‌دهد

```mermaid
flowchart TB
    subgraph Pool1["🏊 استخر: کاربر"]
        subgraph Lane1["👤 لین: تحلیل‌گر"]
            A1([🟢 انتخاب نماد سهام]):::startNode
            A2([🔴 مشاهده نتایج تحلیل]):::endNode
        end
    end

    subgraph Pool2["🏊 استخر: سیستم تحلیل"]
        subgraph Lane2A["📊 لین: لایه داده"]
            B1[دریافت داده بازار]:::activityNode
            B2[پاک‌سازی و ذخیره داده]:::activityNode
        end

        subgraph Lane2B["🔬 لین: لایه تحلیل"]
            C1[اجرای موتور TA]:::activityNode
            C2[تشخیص رژیم بازار]:::activityNode
            C3[محاسبه احتمالات VDss]:::activityNode
        end

        subgraph Lane2C["🤖 لین: لایه ML"]
            D1[پیش‌بینی ML]:::activityNode
            D2[تولید متن AI]:::activityNode
        end

        subgraph Lane2D["🖥️ لین: لایه نمایش"]
            E1[آماده‌سازی نتایج]:::activityNode
        end
    end

    subgraph Pool3["🏊 استخر: منابع داده"]
        subgraph Lane3["🌐 لین: APIهای بازار"]
            F1[(BrsApi)]:::dataNode
            F2[(TSETMC CDN)]:::dataNode
            F3[(TGJU)]:::dataNode
            F4[(Yahoo Finance)]:::dataNode
        end
    end

    GW1{{دریافت داده\nموفق؟}}:::decisionNode
    GW2{{نوع رژیم\nبازار؟}}:::decisionNode
    GW3{{نرخ AI\nمحدود؟}}:::decisionNode

    A1 --> B1
    B1 --> F1
    B1 --> F2
    B1 --> F3
    B1 --> F4
    F1 & F2 & F3 & F4 --> GW1
    GW1 -->|✅ موفق| B2
    GW1 -->|❌ ناموفق| ERR1[تلاش از منبع جایگزین]:::errorNode
    ERR1 --> B1
    B2 --> C1
    C1 --> C2
    C2 --> GW2
    GW2 -->|Trend| C3
    GW2 -->|Range| C3
    GW2 -->|Breakout| C3
    GW2 -->|Choppy| C3
    C3 --> D1
    D1 --> D2
    D2 --> GW3
    GW3 -->|❌ محدود| RETRY[تلاش مجدد با تأخیر]:::errorNode
    RETRY --> D2
    GW3 -->|✅ مجاز| E1
    E1 --> A2

    classDef startNode fill:#16a34a,stroke:#15803d,color:#fff,stroke-width:3px
    classDef endNode fill:#dc2626,stroke:#b91c1c,color:#fff,stroke-width:3px
    classDef activityNode fill:#2563eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
    classDef decisionNode fill:#f59e0b,stroke:#d97706,color:#fff,stroke-width:2px
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
    classDef errorNode fill:#ef4444,stroke:#dc2626,color:#fff,stroke-width:2px
```

===DIAGRAM_END===

---

===DIAGRAM_START===

## Diagram 2 of 8

- **id**: `BPMN-L2-001`
- **title**: فرآیند دریافت داده از منابع بازار
- **level**: 2
- **description**:
  این فرآیند اجرایی جزئیات دریافت داده از چهار منبع مختلف بورس ایران را نشان می‌دهد.
  فرآیند با درخواست داده برای نماد انتخاب‌شده آغاز می‌شود و ابتدا از BrsApi (منبع اصلی TSE) تلاش می‌کند.
  در صورت ناموفق بودن، به ترتیب از TSETMC CDN، TGJU و در نهایت Yahoo Finance تلاش می‌شود.
  هر منبع موفق داده را با منابع قبلی ادغام کرده و در صورت موفقیت هر منبع، داده پاک‌سازی و ذخیره می‌شود.
  مکانیزم fallback زنجیره‌ای تضمین می‌کند که حتی در صورت قطعی برخی منابع، داده قابل دسترسی باشد.
  پس از ادغام نهایی، داده‌ها نرمال‌سازی و در کش محلی ذخیره می‌گردند.
- **happyPath**:
  درخواست داده → BrsApi موفق → ادغام داده → پاک‌سازی → نرمال‌سازی → ذخیره در کش → خروج
- **exceptionFlows**:
  ۱) BrsApi ناموفق → تلاش TSETMC → اگر موفق ادغام و ادامه
  ۲) TSETMC ناموفق → تلاش TGJU → اگر موفق ادغام و ادامه
  ۳) TGJU ناموفق → تلاش Yahoo Finance → اگر موفق ادغام و ادامه
  ۴) همه منابع ناموفق → بازگرداندن خطا → نمایش پیام عدم دسترسی به داده

```mermaid
flowchart TB
    START([🟢 درخواست داده نماد]):::startNode

    REQ[ساخت درخواست HTTP\nبا هدرهای مناسب]:::activityNode

    subgraph FETCH["🔄 زنجیره دریافت داده"]
        TRY1[تلاش از BrsApi\nTSE Official]:::activityNode
        GW1{{BrsApi\nموفق؟}}:::decisionNode
        MERGE1[ادغام داده BrsApi]:::activityNode

        TRY2[تلاش از TSETMC CDN\nTSETMC Direct]:::activityNode
        GW2{{TSETMC\nموفق؟}}:::decisionNode
        MERGE2[ادغام داده TSETMC]:::activityNode

        TRY3[تلاش از TGJU\nTGJU Market]:::activityNode
        GW3{{TGJU\nموفق؟}}:::decisionNode
        MERGE3[ادغام داده TGJU]:::activityNode

        TRY4[تلاش از Yahoo Finance\nInternational]:::activityNode
        GW4{{Yahoo\nموفق؟}}:::decisionNode
        MERGE4[ادغام داده Yahoo]:::activityNode
    end

    CLEAN[پاک‌سازی داده\nحذف مقادیر نامعتبر]:::activityNode
    NORM[نرمال‌سازی زمانی\nهمگام‌سازی تایم‌استمپ]:::activityNode
    STORE[(ذخیره در کش محلی)]:::dataNode
    END([🔴 داده آماده]):::endNode
    ERR([🔴 خطا: عدم دسترسی داده]):::endNode

    START --> REQ
    REQ --> TRY1
    TRY1 --> GW1
    GW1 -->|✅ بله| MERGE1
    GW1 -->|❌ خیر| TRY2
    TRY2 --> GW2
    GW2 -->|✅ بله| MERGE2
    GW2 -->|❌ خیر| TRY3
    TRY3 --> GW3
    GW3 -->|✅ بله| MERGE3
    GW3 -->|❌ خیر| TRY4
    TRY4 --> GW4
    GW4 -->|✅ بله| MERGE4
    GW4 -->|❌ خیر| ERR

    MERGE1 --> CLEAN
    MERGE2 --> CLEAN
    MERGE3 --> CLEAN
    MERGE4 --> CLEAN
    CLEAN --> NORM
    NORM --> STORE
    STORE --> END

    classDef startNode fill:#16a34a,stroke:#15803d,color:#fff,stroke-width:3px
    classDef endNode fill:#dc2626,stroke:#b91c1c,color:#fff,stroke-width:3px
    classDef activityNode fill:#2563eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
    classDef decisionNode fill:#f59e0b,stroke:#d97706,color:#fff,stroke-width:2px
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
```

===DIAGRAM_END===

---

===DIAGRAM_START===

## Diagram 3 of 8

- **id**: `BPMN-L2-002`
- **title**: فرآیند تحلیل تکنیکال
- **level**: 2
- **description**:
  این فرآیند اجرایی جزئیات موتور تحلیل تکنیکال را نشان می‌دهد که داده OHLCV را پردازش کرده و خروجی تحلیلی تولید می‌کند.
  فرآیند در چند مرحله اجرا می‌شود: ابتدا اندیکاتورهای مومنتوم (RSI, MACD, Stochastic) محاسبه می‌شوند.
  سپس اندیکاتورهای volatility شامل Bollinger Bands و Parabolic SAR محاسبه می‌گردند.
  مرحله بعدی شامل محاسبه اندیکاتورهای روند (ADX, ATR) و تشخیص الگوهای کلاسیک است.
  در نهایت سطوح حمایت و مقاومت محاسبه شده و ۹ سناریو (SC1-SC9) بر اساس سیگنال‌ها ساخته می‌شوند.
  هر مرحله خروجی خود را به مرحله بعدی ارسال کرده و نتایج نهایی برای تشخیص رژیم آماده می‌شود.
- **happyPath**:
  داده OHLCV → محاسبه RSI/MACD/Stochastic → محاسبه Bollinger/SAR → محاسبه ADX/ATR → تشخیص الگوها → محاسبه S/R → ساخت سناریوها → خروجی تحلیلی
- **exceptionFlows**:
  ۱) داده ناکافی: تعداد کندل کم از حد نیاز → بازگرداندن خطا با پیام "داده ناکافی"
  ۲) خطای محاسبه اندیکاتور: مقادیر نامعتبر (مثل تقسیم بر صفر) → استفاده از مقدار پیش‌فرض و ثبت هشدار
  ۳) عدم تشخیص الگو: هیچ الگویی یافت نشد → ادامه با سیگنال خنثی

```mermaid
flowchart TB
    START([🟢 دریافت داده OHLCV]):::startNode
    VALID{{داده کافی؟\nحداقل ۲۰۰ کندل}}:::decisionNode

    subgraph MOMENTUM["📈 اندیکاتورهای مومنتوم"]
        RSI[محاسبه RSI\nدوره ۱۴]:::activityNode
        MACD[محاسبه MACD\n۱۲/۲۶/۹]:::activityNode
        STOCH[محاسبه Stochastic\n%K و %D]:::activityNode
    end

    subgraph VOLATILITY["📉 اندیکاتورهای نوسان"]
        BOLL[محاسبه Bollinger Bands\nدوره ۲۰، انحراف ۲]:::activityNode
        SAR[محاسبه Parabolic SAR\nگام ۰.۰۲]:::activityNode
    end

    subgraph TREND["📊 اندیکاتورهای روند"]
        ADX[محاسبه ADX\nدوره ۱۴]:::activityNode
        ATR[محاسبه ATR\nدوره ۱۴]:::activityNode
    end

    PAT[تشخیص الگوهای کلاسیک\nسر و شانه، مثلث، پرچم]:::activityNode
    SR[محاسبه سطوح حمایت و مقاومت\nPivot Points + Fibonacci]:::activityNode

    subgraph SCENARIOS["🎯 ساخت سناریوها"]
        SC[ساخت ۹ سناریو\nSC1-SC9]:::activityNode
        SC1B[SC1: صعودی قوی]:::activityNode
        SC2B[SC2: صعودی متوسط]:::activityNode
        SC3B[SC3: صعودی ضعیف]:::activityNode
        SC4B[SC4: نزولی قوی]:::activityNode
        SC5B[SC5: نزولی متوسط]:::activityNode
        SC6B[SC6: نزولی ضعیف]:::activityNode
        SC7B[SC7: رنج بالا]:::activityNode
        SC8B[SC8: رنج پایین]:::activityNode
        SC9B[SC9: شکست ساختار]:::activityNode
    end

    MERGE[ترکیب نتایج اندیکاتورها]:::activityNode
    OUT([🔴 خروجی تحلیل تکنیکال]):::endNode
    ERR([🔴 خطا: داده ناکافی]):::endNode

    START --> VALID
    VALID -->|✅ بله| RSI
    VALID -->|❌ خیر| ERR
    RSI --> MACD
    MACD --> STOCH
    STOCH --> BOLL
    BOLL --> SAR
    SAR --> ADX
    ADX --> ATR
    ATR --> PAT
    PAT --> SR
    SR --> MERGE
    MERGE --> SC
    SC --> SC1B & SC2B & SC3B & SC4B & SC5B & SC6B & SC7B & SC8B & SC9B
    SC1B & SC2B & SC3B & SC4B & SC5B & SC6B & SC7B & SC8B & SC9B --> OUT

    classDef startNode fill:#16a34a,stroke:#15803d,color:#fff,stroke-width:3px
    classDef endNode fill:#dc2626,stroke:#b91c1c,color:#fff,stroke-width:3px
    classDef activityNode fill:#2563eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
    classDef decisionNode fill:#f59e0b,stroke:#d97706,color:#fff,stroke-width:2px
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
```

===DIAGRAM_END===

---

===DIAGRAM_START===

## Diagram 4 of 8

- **id**: `BPMN-L2-003`
- **title**: فرآیند محاسبه احتمالات VDss
- **level**: 2
- **description**:
  این فرآیند اجرایی سیستم احتمال ۷ لایه VDss را با گراف تصمیم ۳۴ گره و ۵۵+ یال نشان می‌دهد.
  فرآیند با ساخت گراف تصمیم آغاز می‌شود: ۳۴ گره مقداردهی و ۳ شاخه استراتژی متصل می‌گردند.
  سپس وزن یال‌ها بر اساس سیگنال‌های تحلیلی محاسبه شده و نرمال‌سازی سیگموئیدی اعمال می‌شود.
  احتمالات مسیرها با پیمایش گراف محاسبه شده و احتمالات تجمعی برای هر سناریو تعیین می‌گردد.
  در نهایت تحلیل روند کلی انجام شده و خروجی احتمالات برای تولید متن AI آماده می‌شود.
  هر شاخه استراتژی (Trend Following, Breakout, Reversal) وزن‌دهی مجزایی دارد.
- **happyPath**:
  ساخت گراف ۳۴ گره → محاسبه وزن یال‌ها → نرمال‌سازی سیگموئید → محاسبه احتمالات مسیر → احتمالات تجمعی SC1-SC9 → تحلیل روند → خروجی
- **exceptionFlows**:
  ۱) گراف ناقص: یال‌های معلق → تکمیل با وزن پیش‌فرض و ثبت هشدار
  ۲) احتمالات غیرنرمال: مجموع ≠ ۱ → بازنرمال‌سازی اجباری
  ۳) گراف چرخه‌ای: حلقه بی‌نهایت → حذف یال‌های چرخه‌ای و ادامه

```mermaid
flowchart TB
    START([🟢 شروع محاسبه احتمالات]):::startNode

    subgraph GRAPH["🏗️ ساخت گراف تصمیم"]
        INIT[مقداردهی ۳۴ گره]:::activityNode

        subgraph BRANCHES["🌿 شاخه‌های استراتژی"]
            TREND["شاخه Trend Following\n۱۲ گره، ۲۰ یال"]:::activityNode
            BREAK["شاخه Breakout\n۱۱ گره، ۱۸ یال"]:::activityNode
            REVERSAL["شاخه Reversal\n۱۱ گره، ۱۷+ یال"]:::activityNode
        end

        CONNECT[اتصال شاخه‌ها\nگراف نهایی ۳۴ گره، ۵۵+ یال]:::activityNode
    end

    subgraph WEIGHTS["⚖️ محاسبه وزن‌ها"]
        EDGE[محاسبه وزن یال‌ها\nبر اساس سیگنال‌ها]:::activityNode
        SIGMOID[نرمال‌سازی سیگموئید\nσx = 1/(1+e^(-x))]:::activityNode
        GW_NORM{{احتمالات\nنرمال؟}}:::decisionNode
        RENORM[بازنرمال‌سازی اجباری]:::activityNode
    end

    subgraph PROB["📊 محاسبه احتمالات"]
        PATH[پیمایش مسیرها\nمحاسبه احتمال هر مسیر]:::activityNode
        CUM[احتمالات تجمعی\nبرای SC1 تا SC9]:::activityNode
        ANALYSIS[تحلیل روند کلی\nغالب‌ترین سناریو]:::activityNode
    end

    OUT([🔴 خروجی احتمالات VDss]):::endNode

    START --> INIT
    INIT --> TREND & BREAK & REVERSAL
    TREND & BREAK & REVERSAL --> CONNECT
    CONNECT --> EDGE
    EDGE --> SIGMOID
    SIGMOID --> GW_NORM
    GW_NORM -->|✅ بله| PATH
    GW_NORM -->|❌ خیر| RENORM
    RENORM --> PATH
    PATH --> CUM
    CUM --> ANALYSIS
    ANALYSIS --> OUT

    classDef startNode fill:#16a34a,stroke:#15803d,color:#fff,stroke-width:3px
    classDef endNode fill:#dc2626,stroke:#b91c1c,color:#fff,stroke-width:3px
    classDef activityNode fill:#2563eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
    classDef decisionNode fill:#f59e0b,stroke:#d97706,color:#fff,stroke-width:2px
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
```

===DIAGRAM_END===

---

===DIAGRAM_START===

## Diagram 5 of 8

- **id**: `BPMN-L2-004`
- **title**: فرآیند تولید متن تحلیلی AI
- **level**: 2
- **description**:
  این فرآیند اجرایی تولید متن تحلیلی با هوش مصنوعی را نشان می‌دهد.
  فرآیند با انتخاب مدل ML آغاز شده و سپس MSL v4 (مدیریت سبک زبان) پیکربندی می‌شود.
  MSL v4 شامل ۶ مکتب × ۵ سبک × ۶ لحن = ۱۸۰ ترکیب ممکن برای متن تحلیلی است.
  پرامپت بر اساس نتایج تحلیل تکنیکال، رژیم بازار و احتمالات سناریوها ساخته می‌شود.
  سپس درخواست به z.ai LLM ارسال شده و در صورت محدودیت نرخ، تلاش مجدد با تأخیر نمایی انجام می‌گیرد.
  متن تولیدشده پس‌پردازش شده و اعتبارسنجی نهایی قبل از نمایش انجام می‌شود.
- **happyPath**:
  انتخاب مدل ML → پیکربندی MSL v4 → ساخت پرامپت → فراخوانی LLM → متن تولیدشده → پس‌پردازش → اعتبارسنجی → نمایش
- **exceptionFlows**:
  ۱) محدودیت نرخ LLM: HTTP 429 → تأخیر نمایی (1s, 2s, 4s, 8s) → تلاش مجدد حداکثر ۵ بار
  ۲) خطای LLM: پاسخ نامعتبر → استفاده از قالب پیش‌فرض و ثبت خطا
  ۳) نامعتبری پس‌پردازش: قیمت‌های نامعتبر → حذف و ادامه با هشدار

```mermaid
flowchart TB
    START([🟢 شروع تولید متن AI]):::startNode

    subgraph CONFIG["⚙️ پیکربندی"]
        ML_SEL[انتخاب مدل ML\nبر اساس نوع بازار]:::activityNode
        MSL["پیکربندی MSL v4\n۶ مکتب × ۵ سبک × ۶ لحن"]:::activityNode

        subgraph MSL_DETAIL["📋 جزئیات MSL"]
            SCHOOL["مکتب‌ها:\nکلاسیک، نئو، کمیت، الیوت، حجمی، هارمونیک"]:::activityNode
            STYLE["سبک‌ها:\nرسمی، محاوره‌ای، آموزشی، هشداری، خلاصه"]:::activityNode
            TONE["لحن‌ها:\nخنثی، خوش‌بینانه، محتاطانه، بدبینانه، فنی، عام"]:::activityNode
        end
    end

    PROMPT[ساخت پرامپت\nترکیب نتایج TA + رژیم + احتمالات]:::activityNode
    CALL[فراخوانی z.ai LLM\nارسال درخواست]:::activityNode

    GW_RATE{{نرخ محدود؟\nHTTP 429}}:::decisionNode
    RETRY[تأخیر نمایی\nو تلاش مجدد]:::activityNode
    GW_MAX{{حداکثر تلاش\nرسیده؟}}:::decisionNode
    FALLBACK[استفاده از\nقالب پیش‌فرض]:::activityNode

    POST[پس‌پردازش متن\nحذف کدها + اصلاح فارسی]:::activityNode
    VALID[اعتبارسنجی نهایی\nبررسی قیمت‌ها و ارقام]:::activityNode
    DISPLAY[آماده‌سازی برای نمایش]:::activityNode
    END([🔴 متن تحلیلی آماده]):::endNode

    START --> ML_SEL
    ML_SEL --> MSL
    MSL --> SCHOOL & STYLE & TONE
    SCHOOL & STYLE & TONE --> PROMPT
    PROMPT --> CALL
    CALL --> GW_RATE
    GW_RATE -->|✅ خیر| POST
    GW_RATE -->|❌ بله| RETRY
    RETRY --> GW_MAX
    GW_MAX -->|❌ خیر| CALL
    GW_MAX -->|✅ بله| FALLBACK
    FALLBACK --> POST
    POST --> VALID
    VALID --> DISPLAY
    DISPLAY --> END

    classDef startNode fill:#16a34a,stroke:#15803d,color:#fff,stroke-width:3px
    classDef endNode fill:#dc2626,stroke:#b91c1c,color:#fff,stroke-width:3px
    classDef activityNode fill:#2563eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
    classDef decisionNode fill:#f59e0b,stroke:#d97706,color:#fff,stroke-width:2px
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
```

===DIAGRAM_END===

---

===DIAGRAM_START===

## Diagram 6 of 8

- **id**: `BPMN-L3-001`
- **title**: زیرفرآیند تشخیص رژیم بازار
- **level**: 3
- **description**:
  این زیرفرآیند جزئیات سه موتور تشخیص رژیم بازار را نشان می‌دهد.
  سه موتور به صورت موازی اجرا می‌شوند: فازی (وزن ۰.۳)، مارکوف (وزن ۰.۵) و رأی‌گیری وزنی (وزن ۰.۲).
  موتور فازی با محاسبه درجات عضویت فازی، رژیم را بر اساس توابع مثلثی و ذوزنوی تعیین می‌کند.
  موتور مارکوف با محاسبه ماتریس انتقال و ضرب در بردار وضعیت فعلی، رژیم آینده را پیش‌بینی می‌کند.
  رأی‌گیری وزنی با ترکیب سیگنال‌های چندگانه و اعمال وزن‌های تجمعی، تصمیم نهایی را می‌گیرد.
  خروجی سه موتور ترکیب شده و رژیم نهایی با سطح اطمینان تعیین می‌گردد.
- **happyPath**:
  داده تحلیلی → فازی: عضویت ۰.۸ → مارکوف: انتقال ۰.۷۵ → رأی‌گیری: تأیید → ترکیب وزنی → رژیم Trend با اطمینان ۸۵٪
- **exceptionFlows**:
  ۱) تناقض موتورها: فازی Trend vs مارکوف Range → تصمیم بر اساس وزن مارکوف (۰.۵ بالاتر)
  ۲) اطمینان پایین: هر سه موتور < ۵۰٪ → رژیم Unknown با اطمینان پایین
  ۳) خطای ماتریس مارکوف: ماتریس singular → استفاده از موتور فازی و رأی‌گیری فقط

```mermaid
flowchart TB
    START([🟢 داده تحلیلی ورودی]):::startNode
    PAR[تقسیم داده بین سه موتور]:::activityNode

    subgraph FUZZY_ENGINE["🔵 موتور فازی - وزن ۰.۳"]
        F1[محاسبه درجات عضویت\nتوابع مثلثی و ذوزنوی]:::activityNode
        F2[ارزیابی قوانین فازی\nIF-THEN rules]:::activityNode
        F3[استنتاج فازی\ndefuzzification]:::activityNode
        F4[خروجی فازی:\nرژیم + اطمینان]:::activityNode
    end

    subgraph MARKOV_ENGINE["🟠 موتور مارکوف - وزن ۰.۵"]
        M1[محاسبه ماتریس انتقال\nبر اساس تاریخچه]:::activityNode
        M2[ضرب ماتریس در بردار وضعیت\nP × s_t]:::activityNode
        M3[محاسبه توزوع ایستا\nπ = π × P]:::activityNode
        M4[خروجی مارکوف:\nرژیم + احتمال انتقال]:::activityNode
    end

    subgraph VOTE_ENGINE["🟢 رأی‌گیری وزنی - وزن ۰.۲"]
        V1[جمع‌آوری سیگنال‌ها\nاز اندیکاتورهای مختلف]:::activityNode
        V2[اعمال وزن‌های تجمعی\nروی هر سیگنال]:::activityNode
        V3[تجمیع آرا\nMajority Vote]:::activityNode
        V4[خروجی رأی‌گیری:\nرژیم + آرا]:::activityNode
    end

    COMBINE[ترکیب وزنی خروجی‌ها\n0.3×F + 0.5×M + 0.2×V]:::activityNode
    GW_CONFLICT{{تناقض\nبین موتورها؟}}:::decisionNode
    RESOLVE[حل تناقض\nبر اساس وزن بالاتر]:::activityNode
    CLASSIFY[طبقه‌بندی نهایی رژیم\nTrend | Range | Breakout | Choppy]:::activityNode
    CONF[محاسبه سطح اطمینان\n ترکیب سه اطمینان]:::activityNode
    END([🔴 رژیم + اطمینان]):::endNode

    START --> PAR
    PAR --> F1 & M1 & V1
    F1 --> F2 --> F3 --> F4
    M1 --> M2 --> M3 --> M4
    V1 --> V2 --> V3 --> V4
    F4 & M4 & V4 --> COMBINE
    COMBINE --> GW_CONFLICT
    GW_CONFLICT -->|❌ خیر| CLASSIFY
    GW_CONFLICT -->|✅ بله| RESOLVE
    RESOLVE --> CLASSIFY
    CLASSIFY --> CONF
    CONF --> END

    classDef startNode fill:#16a34a,stroke:#15803d,color:#fff,stroke-width:3px
    classDef endNode fill:#dc2626,stroke:#b91c1c,color:#fff,stroke-width:3px
    classDef activityNode fill:#2563eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
    classDef decisionNode fill:#f59e0b,stroke:#d97706,color:#fff,stroke-width:2px
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
```

===DIAGRAM_END===

---

===DIAGRAM_START===

## Diagram 7 of 8

- **id**: `BPMN-L3-002`
- **title**: زیرفرآیند ساخت گراف تصمیم
- **level**: 3
- **description**:
  این زیرفرآیند جزئیات ساخت گراف تصمیم با ۳۴ گره و ۵۵+ یال را نشان می‌دهد.
  فرآیند با مقداردهی ۳۴ گره آغاز شده و سپس سیگنال‌های هر شاخه استراتژی محاسبه می‌گردد.
  شاخه Trend Following شامل ۱۲ گره و ۲۰ یال برای سیگنال‌های روندی است.
  شاخه Breakout شامل ۱۱ گره و ۱۸ یال برای سیگنال‌های شکست است.
  شاخه Reversal شامل ۱۱ گره و ۱۷+ یال برای سیگنال‌های بازگشتی است.
  پس از محاسبه وزن یال‌ها، نرمال‌سازی سیگموئیدی اعمال شده و مسیرها تجمیع می‌گردند.
  در نهایت ۹ سناریو SC1-SC9 بر اساس احتمالات مسیرها ساخته می‌شوند.
- **happyPath**:
  مقداردهی ۳۴ گره → سیگنال‌های Trend → سیگنال‌های Breakout → سیگنال‌های Reversal → وزن یال‌ها → سیگموئید → تجمیع → SC1-SC9
- **exceptionFlows**:
  ۱) گره یتیم: گره بدون یال ورودی → حذف گره و ثبت هشدار
  ۲) یال با وزن منفی → صفر کردن وزن و ادامه
  ۳) شاخه بدون سیگنال → اختصاص احتمال یکنواخت

```mermaid
flowchart TB
    START([🟢 شروع ساخت گراف تصمیم]):::startNode
    INIT[مقداردهی ۳۴ گره\nN1 تا N34]:::activityNode

    subgraph TREND_BRANCH["📈 شاخه Trend Following"]
        T1[گره‌های ورودی روند\nN1-N4]:::activityNode
        T2[گره‌های پردازش روند\nN5-N10]:::activityNode
        T3[گره‌های خروجی روند\nN11-N12]:::activityNode
        T_SIG[محاسبه سیگنال‌های روندی\nEMA cross, ADX>25, +DI>-DI]:::activityNode
        T_EDGE[محاسبه وزن ۲۰ یال روندی\nبر اساس قدر سیگنال]:::activityNode
    end

    subgraph BREAKOUT_BRANCH["💥 شاخه Breakout"]
        B1[گره‌های ورودی شکست\nN13-N16]:::activityNode
        B2[گره‌های پردازش شکست\nN17-N20]:::activityNode
        B3[گره‌های خروجی شکست\nN21]:::activityNode
        B_SIG[محاسبه سیگنال‌های شکست\nVol spike, Range break, S/R breach]:::activityNode
        B_EDGE[محاسبه وزن ۱۸ یال شکست\nبر اساس حجم و دامنه]:::activityNode
    end

    subgraph REVERSAL_BRANCH["🔄 شاخه Reversal"]
        R1[گره‌های ورودی بازگشت\nN22-N25]:::activityNode
        R2[گره‌های پردازش بازگشت\nN26-N30]:::activityNode
        R3[گره‌های خروجی بازگشت\nN31]:::activityNode
        R_SIG[محاسبه سیگنال‌های بازگشتی\nRSI div, Double top/bottom, Doji]:::activityNode
        R_EDGE[محاسبه وزن ۱۷+ یال بازگشتی\nبر اساس اطمینان الگو]:::activityNode
    end

    MERGE_NODES[اتصال گره‌های مشترک\nگراف یکپارچه ۳۴ گره]:::activityNode
    ALL_EDGES[ترکیب تمام یال‌ها\n۵۵+ یال نهایی]:::activityNode
    SIGMOID[نرمال‌سازی سیگموئید\nبرای هر یال]:::activityNode
    PATH_AGG[تجمیع مسیرها\nمحاسبه احتمال هر مسیر]:::activityNode

    subgraph SC_BUILD["🎯 ساخت سناریوها"]
        SC1[SC1: صعودی قوی\nP ≥ 0.7, Trend+Break]:::activityNode
        SC2[SC2: صعودی متوسط\n0.5 ≤ P < 0.7, Trend]:::activityNode
        SC3[SC3: صعودی ضعیف\n0.3 ≤ P < 0.5, Trend]:::activityNode
        SC4[SC4: نزولی قوی\nP ≥ 0.7, Trend↓+Break↓]:::activityNode
        SC5[SC5: نزولی متوسط\n0.5 ≤ P < 0.7, Trend↓]:::activityNode
        SC6[SC6: نزولی ضعیف\n0.3 ≤ P < 0.5, Trend↓]:::activityNode
        SC7[SC7: رنج بالا\nRange + near Resistance]:::activityNode
        SC8[SC8: رنج پایین\nRange + near Support]:::activityNode
        SC9[SC9: شکست ساختار\nChoppy + high Vol]:::activityNode
    end

    END([🔴 گراف + سناریوهای SC1-SC9]):::endNode

    START --> INIT
    INIT --> T1 & B1 & R1
    T1 --> T2 --> T3 --> T_SIG --> T_EDGE
    B1 --> B2 --> B3 --> B_SIG --> B_EDGE
    R1 --> R2 --> R3 --> R_SIG --> R_EDGE
    T_EDGE & B_EDGE & R_EDGE --> MERGE_NODES
    MERGE_NODES --> ALL_EDGES
    ALL_EDGES --> SIGMOID
    SIGMOID --> PATH_AGG
    PATH_AGG --> SC1 & SC2 & SC3 & SC4 & SC5 & SC6 & SC7 & SC8 & SC9
    SC1 & SC2 & SC3 & SC4 & SC5 & SC6 & SC7 & SC8 & SC9 --> END

    classDef startNode fill:#16a34a,stroke:#15803d,color:#fff,stroke-width:3px
    classDef endNode fill:#dc2626,stroke:#b91c1c,color:#fff,stroke-width:3px
    classDef activityNode fill:#2563eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
    classDef decisionNode fill:#f59e0b,stroke:#d97706,color:#fff,stroke-width:2px
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
```

===DIAGRAM_END===

---

===DIAGRAM_START===

## Diagram 8 of 8

- **id**: `BPMN-L3-003`
- **title**: زیرفرآیند پس‌پردازش متن AI
- **level**: 3
- **description**:
  این زیرفرآیند جزئیات پس‌پردازش متن تولیدشده توسط AI را نشان می‌دهد.
  فرآیند با حذف کدهای تخریبی و نشانه‌گذاری آغاز می‌شود.
  سپس اصلاحات فارسی شامل نیم‌فاصله‌ها، حروف ی و ک فارسی و نقطه‌گذاری انجام می‌گیرد.
  جهت اعداد اصلاح شده تا ارقام و قیمت‌ها از راست به چپ نمایش داده شوند.
  اعتبارسنجی قیمت‌ها با مقایسه قیمت‌های ذکرشده در متن با داده واقعی بازار انجام می‌شود.
  در نهایت بررسی توهم AI (hallucination) انجام شده و در صورت وجود، هشدار ثبت و متن اصلاح می‌شود.
- **happyPath**:
  متن خام AI → حذف کدها → اصلاح فارسی → جهت اعداد → اعتبارسنجی قیمت → بررسی توهم → معتبر → بازگرداندن متن
- **exceptionFlows**:
  ۱) قیمت نامعتبر: قیمت در متن با بازار تطبیق ندارد → حذف قیمت از متن + هشدار
  ۲) توهم AI: ادعای غیر واقعی → ثبت هشدار + سعی حذف بخش توهم‌دار
  ۳) متن خالی: پس‌پردازش نتیجه‌ای نداد → بازگرداندن پیام پیش‌فرض

```mermaid
flowchart TB
    START([🟢 متن خام AI ورودی]):::startNode

    STRIP[حذف کدهای تخریبی\nHTML, Markdown, LaTeX]:::activityNode
    STRIP2[حذف نشانه‌های داخلی\n<|im_start|>, <|end|>]:::activityNode

    subgraph PERSIAN_FIX["🔧 اصلاحات فارسی"]
        ZWNJ[اصلاح نیم‌فاصله‌ها\nمی‌روم vs می روم]:::activityNode
        YE_KE[اصلاح ی و ک\nی→ی، ک→ک]:::activityNode
        PUNCT[اصلاح نقطه‌گذاری و فاصله\nفارسی‌سازی اعداد]:::activityNode
    end

    NUM_DIR[اصلاح جهت اعداد\nراست به چپ برای فارسی]:::activityNode
    NUM_SEP[جداکننده هزارگان\nبه فارسی: ۱٬۲۳۴٬۵۶۷]:::activityNode

    subgraph VALIDATION["✅ اعتبارسنجی"]
        PRICE[بررسی قیمت‌های ذکرشده\nمقایسه با داده بازار]:::activityNode
        GW_PRICE{{قیمت‌ها\nمعتبر؟}}:::decisionNode
        FIX_PRICE[حذف قیمت نامعتبر\nو افزودن هشدار]:::activityNode

        HALLU[بررسی توهم AI\nHallucination Detection]:::activityNode
        GW_HALLU{{توهم\nشناسایی شد؟}}:::decisionNode
        FIX_HALLU[حذف بخش توهم‌دار\nو ثبت هشدار]:::activityNode
    end

    GW_EMPTY{{متن خالی\nبعد از پردازش؟}}:::decisionNode
    DEFAULT[استفاده از پیام پیش‌فرض\n"تحلیل در دسترس نیست"]:::activityNode
    LOG_OK[ثبت لاگ موفقیت\nزمان پردازش و کیفیت]:::activityNode
    END([🔴 متن پردازش‌شده نهایی]):::endNode

    START --> STRIP
    STRIP --> STRIP2
    STRIP2 --> ZWNJ
    ZWNJ --> YE_KE
    YE_KE --> PUNCT
    PUNCT --> NUM_DIR
    NUM_DIR --> NUM_SEP
    NUM_SEP --> PRICE
    PRICE --> GW_PRICE
    GW_PRICE -->|✅ بله| HALLU
    GW_PRICE -->|❌ خیر| FIX_PRICE
    FIX_PRICE --> HALLU
    HALLU --> GW_HALLU
    GW_HALLU -->|❌ خیر| GW_EMPTY
    GW_HALLU -->|✅ بله| FIX_HALLU
    FIX_HALLU --> GW_EMPTY
    GW_EMPTY -->|❌ خیر| LOG_OK
    GW_EMPTY -->|✅ بله| DEFAULT
    DEFAULT --> END
    LOG_OK --> END

    classDef startNode fill:#16a34a,stroke:#15803d,color:#fff,stroke-width:3px
    classDef endNode fill:#dc2626,stroke:#b91c1c,color:#fff,stroke-width:3px
    classDef activityNode fill:#2563eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
    classDef decisionNode fill:#f59e0b,stroke:#d97706,color:#fff,stroke-width:2px
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
```

===DIAGRAM_END===

---

## Summary Table

| # | ID | Level | Title (Persian) | Nodes | Gateways |
|---|-----|-------|-----------------|-------|----------|
| 1 | BPMN-L1-001 | 1 | نمای کلی فرآیند تحلیل تکنیکال مالی | 14 | 3 |
| 2 | BPMN-L2-001 | 2 | فرآیند دریافت داده از منابع بازار | 14 | 4 |
| 3 | BPMN-L2-002 | 2 | فرآیند تحلیل تکنیکال | 19 | 1 |
| 4 | BPMN-L2-003 | 2 | فرآیند محاسبه احتمالات VDss | 14 | 1 |
| 5 | BPMN-L2-004 | 2 | فرآیند تولید متن تحلیلی AI | 15 | 2 |
| 6 | BPMN-L3-001 | 3 | زیرفرآیند تشخیص رژیم بازار | 18 | 1 |
| 7 | BPMN-L3-002 | 3 | زیرفرآیند ساخت گراف تصمیم | 30 | 0 |
| 8 | BPMN-L3-003 | 3 | زیرفرآیند پس‌پردازش متن AI | 16 | 3 |

### Color Legend

| Color | Element Type | Meaning |
|-------|-------------|---------|
| 🟢 Green | Start Events | Process initiation |
| 🔴 Red | End Events | Process termination |
| 🔵 Blue | Activities | Processing steps |
| 🟡 Amber | Gateways | Decision points |
| 🟣 Purple | Data Stores | Data sources/cache |
