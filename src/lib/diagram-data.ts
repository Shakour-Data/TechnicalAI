// Auto-generated diagram data - parsed from source files
// DFD: 13, BPMN: 8, UML Structural: 21, UML Behavioral: 21 = 63 total

export const DFD_DIAGRAMS = [
  {
    id: 'DFD-L0-CONTEXT',
    title: `نمودار زمینه سطح ۰ - سامانه تحلیل تکنیکال مالی`,
    description: `این نمودار بالاترین سطح انتزاع سیستم را نشان می‌دهد.
سامانه تحلیل تکنیکال مالی ایران به عنوان یک فرآیند واحد در مرکز قرار دارد.
هفت موجودیت خارجی با سامانه در ارتباط هستند: کاربر، بورس تهران، TSETMC CDN، TGJU، Yahoo Finance، z.ai LLM و پایگاه داده.
جریان‌های داده اصلی شامل انتخاب نماد و پارامترها از کاربر، داده‌های OHLCV از بورس تهران، داده‌های تاریخی از منابع خارجی، درخواست/پاسخ LLM و ذخیره/بازخوانی کش هستند.
این نمودار مرز سیستم و تعاملات آن با دنیای بیرون را مشخص می‌کند.
برای درک اولیه معماری سیستم، این بالاترین نقطه شروع است.`,
    level: 0,
    code: `flowchart RL
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:3px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    User{{"کاربر"}}:::entity
    TSE{{"بورس تهران (TSE)"}}:::entity
    TSETMC{{"TSETMC CDN"}}:::entity
    TGJU{{"TGJU"}}:::entity
    Yahoo{{"Yahoo Finance"}}:::entity
    ZAI{{"z.ai LLM"}}:::entity
    DB{{"پایگاه داده Prisma/SQLite"}}:::entity

    Sys["سامانه تحلیل تکنیکال مالی"]:::process

    User -->|"انتخاب نماد + پارامترهای تحلیل"| Sys
    Sys -->|"نتایج تحلیل + گزارش هوشمند + نمودارها"| User

    TSE -->|"داده OHLCV + عمق بازار + اطلاعات شرکت"| Sys
    TSETMC -->|"دودهی + شاخص کل + ارزش بازار"| Sys
    TGJU -->|"قیمت‌های زنده + اخبار + تحلیل‌های عمومی"| Sys
    Yahoo -->|"داده تاریخی ارزها + نقره + طلا"| Sys

    Sys -->|"درخواست تولید متن تحلیلی"| ZAI
    ZAI -->|"متن تحلیل هوشمند + پیشنهادها"| Sys

    Sys -->|"ذخیره نتایج + کش تحلیل"| DB
    DB -->|"بازخوانی کش + تنظیمات + مدل‌ها"| Sys`,
  },
  {
    id: 'DFD-L1-MAIN-PROCESSES',
    title: `نمودار جریان داده سطح ۱ - فرآیندهای اصلی`,
    description: `این نمودار هفت فرآیند اصلی سیستم را با جزئیات نشان می‌دهد.
P1 دریافت و پردازش داده بازار از منابع مختلف را مدیریت می‌کند.
P2 تحلیل تکنیکال شامل ۶۰+ اندیکاتور و ۱۶+ الگوی کندلی را انجام می‌دهد.
P3 تشخیص رژیم بازار با سه موتور فازی، مارکوف و رأی‌گیری وزنی را اجرا می‌کند.
P4 محاسبه احتمالات گراف تصمیم با ۳۴ گره و ۵۵+ یال و ۹ سناریو را انجام می‌دهد.
P5 تولید تحلیل هوشمند AI با سیستم MSL v4 و فراخوانی z.ai LLM را مدیریت می‌کند.
P6 مدیریت سطوح حمایت/مقاومت از ۷ منبع مختلف را انجام می‌دهد.
P7 پایش و نمایش نتایج نهایی در لایه ارائه را بر عهده دارد.
چهار ذخیره‌گاه داده: D1 بازار داده، D2 کش تحلیل، D3 مدل ML، D4 تنظیمات.`,
    level: 1,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    User{{"کاربر"}}:::entity
    TSE{{"بورس تهران"}}:::entity
    TSETMC{{"TSETMC CDN"}}:::entity
    TGJU{{"TGJU"}}:::entity
    Yahoo{{"Yahoo Finance"}}:::entity
    ZAI{{"z.ai LLM"}}:::entity

    D1[("D1: بازار داده")]:::store
    D2[("D2: کش تحلیل")]:::store
    D3[("D3: مدل ML")]:::store
    D4[("D4: تنظیمات")]:::store

    P1["P1: دریافت و پردازش داده بازار"]:::process
    P2["P2: تحلیل تکنیکال و اندیکاتورها"]:::process
    P3["P3: تشخیص رژیم بازار"]:::process
    P4["P4: محاسبه احتمالات گراف تصمیم"]:::process
    P5["P5: تولید تحلیل هوشمند AI"]:::process
    P6["P6: مدیریت سطوح حمایت/مقاومت"]:::process
    P7["P7: پایش و نمایش نتایج"]:::process

    User -->|"انتخاب نماد + تایم‌فریم"| P1
    TSE -->|"داده OHLCV BrsApi"| P1
    TSETMC -->|"دودهی + شاخص"| P1
    TGJU -->|"قیمت زنده"| P1
    Yahoo -->|"داده ارز"| P1

    P1 -->|"داده پاکسازی‌شده"| D1
    D1 -->|"سری زمانی OHLCV"| P2
    D1 -->|"سری زمانی + اندیکاتورها"| P3
    D1 -->|"سری زمانی"| P6

    P2 -->|"اندیکاتورها + الگوها"| D2
    P2 -->|"سیگنال‌های تکنیکال"| P3
    P2 -->|"سطوح محاسبه‌شده"| P6

    D3 -->|"وزن‌های رژیم"| P3
    P3 -->|"رژیم فعلی + احتمالات"| D2
    P3 -->|"رژیم شناسایی‌شده"| P4

    D2 -->|"تحلیل‌های کش‌شده"| P4
    P4 -->|"گراف تصمیم + سناریوها"| D2
    P4 -->|"سناریو غالب + احتمال"| P5

    D4 -->|"تنظیمات MSL + پارامترها"| P5
    P5 -->|"پرامپت ساختاریافته"| ZAI
    ZAI -->|"متن خام LLM"| P5
    P5 -->|"متن پس‌پردازش‌شده"| D2

    P6 -->|"سطوح S/R نهایی"| D2
    P6 -->|"سطوح حمایت/مقاومت"| P4

    D2 -->|"تمام نتایج تحلیل"| P7
    P7 -->|"داشبورد + نمودارها + گزارش AI"| User
    P4 -->|"سناریوها + گراف"| P7
    P6 -->|"نقاط S/R"| P7`,
  },
  {
    id: 'DFD-L2-P1-MARKET-DATA',
    title: `نمودار جریان داده سطح ۲ - P1: دریافت و پردازش داده بازار`,
    description: `این نمودار زیرفرآیندهای P1 را با جزئیات نشان می‌دهد.
P1.1 دریافت داده از BrsApi بورس تهران شامل سابقه قیمت و عمق بازار است.
P1.2 دریافت داده از TSETMC CDN شامل دهی‌بندی و شاخص کل و ارزش بازار است.
P1.3 دریافت داده از TGJU شامل قیمت‌های زنده و اخبار بازار است.
P1.4 دریافت داده از Yahoo Finance شامل داده تاریخی ارزها و کالاهاست.
P1.5 ادغام و پاکسازی داده‌ها شامل حذف نقاط پرت، پرکردن مقادیر خالی و هم‌زمان‌سازی است.
ذخیره‌گاه D1 بازار داده نتیجه نهایی را نگهداری می‌کند.`,
    level: 2,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    User{{"کاربر"}}:::entity
    TSE{{"بورس تهران (BrsApi)"}}:::entity
    TSETMC{{"TSETMC CDN"}}:::entity
    TGJU{{"TGJU"}}:::entity
    Yahoo{{"Yahoo Finance"}}:::entity

    D1[("D1: بازار داده")]:::store
    D4[("D4: تنظیمات")]:::store

    P11["P1.1: دریافت از BrsApi"]:::process
    P12["P1.2: دریافت از TSETMC"]:::process
    P13["P1.3: دریافت از TGJU"]:::process
    P14["P1.4: دریافت از Yahoo"]:::process
    P15["P1.5: ادغام و پاکسازی"]:::process

    User -->|"نماد + تایم‌فریم"| P11
    User -->|"نماد"| P12

    TSE -->|"OHLCV + عمق بازار + حجم"| P11
    TSETMC -->|"دهی‌بندی + شاخص کل + ارزش بازار"| P12
    TGJU -->|"قیمت زنده + اخبار"| P13
    Yahoo -->|"داده تاریخی ارز + طلا + نقره"| P14

    D4 -->|"API keys + endpoints"| P11
    D4 -->|"API keys + endpoints"| P12
    D4 -->|"API keys + endpoints"| P13
    D4 -->|"API keys + endpoints"| P14

    P11 -->|"داده خام TSE"| P15
    P12 -->|"دودهی + شاخص"| P15
    P13 -->|"داده زنده TGJU"| P15
    P14 -->|"داده ارز Yahoo"| P15

    P15 -->|"داده ادغام‌شده + نرمال‌سازی‌شده"| D1
    P15 -->|"لاگ خطا"| D4`,
  },
  {
    id: 'DFD-L2-P2-TECHNICAL-ANALYSIS',
    title: `نمودار جریان داده سطح ۲ - P2: تحلیل تکنیکال و اندیکاتورها`,
    description: `این نمودار زیرفرآیندهای P2 را با جزئیات نشان می‌دهد.
P2.1 محاسبه اندیکاتورهای RSI/MACD شامل RSI(14), MACD(12,26,9) و سیگنال‌های کراس‌اور است.
P2.2 محاسبه Bollinger/SAR شامل باندهای بولینگر(20,2), Parabolic SAR و Envelope است.
P2.3 محاسبه ADX/Stochastic شامل ADX(14), Stochastic(14,3,3), CCI و Williams %R است.
P2.4 تشخیص الگوهای کندلی شامل ۱۶+ الگو مانند Doji, Hammer, Engulfing, Harami و غیره است.
بیش از ۶۰ اندیکاتور تکنیکال در مجموع این زیرفرآیندها محاسبه می‌شوند.`,
    level: 2,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    D1[("D1: بازار داده")]:::store
    D2[("D2: کش تحلیل")]:::store
    D4[("D4: تنظیمات")]:::store

    P21["P2.1: محاسبه RSI/MACD"]:::process
    P22["P2.2: محاسبه Bollinger/SAR"]:::process
    P23["P2.3: محاسبه ADX/Stochastic"]:::process
    P24["P2.4: تشخیص الگوهای کندلی"]:::process

    D1 -->|"سری قیمت بسته"| P21
    D1 -->|"سری قیمت H/L/C"| P22
    D1 -->|"سری قیمت H/L/C"| P23
    D1 -->|"داده کندل‌های OHLCV"| P24

    D4 -->|"پارامترهای اندیکاتور"| P21
    D4 -->|"پارامترهای باندها"| P22
    D4 -->|"پارامترهای ADX/Stoch"| P23
    D4 -->|"الگوهای فعال"| P24

    P21 -->|"RSI + MACD + سیگنال‌ها"| D2
    P22 -->|"BBands + SAR + Envelope"| D2
    P23 -->|"ADX + Stoch + CCI + W%R"| D2
    P24 -->|"الگوهای شناسایی‌شده + اعتبار"| D2

    P21 -->|"سیگنال کراس‌اور MACD"| P23
    P23 -->|"قدرت روند ADX"| P22
    P24 -->|"الگوی بازگشتی"| P21`,
  },
  {
    id: 'DFD-L2-P3-REGIME-DETECTION',
    title: `نمودار جریان داده سطح ۲ - P3: تشخیص رژیم بازار`,
    description: `این نمودار فرآیند P3 تشخیص رژیم بازار را با سه موتور نشان می‌دهد.
موتور فازی (Fuzzy) با وزن ۰.۳ از منطق فازی برای طبقه‌بندی رژیم استفاده می‌کند.
موتور مارکوف (Markov) با وزن ۰.۵ از زنجیره مارکوف برای مدل‌سازی انتقال رژیم استفاده می‌کند.
موتور رأی‌گیری وزنی (Weighted Vote) با وزن ۰.۲ از ترکیب رأی‌ها برای تصمیم نهایی استفاده می‌کند.
خروجی شامل نوع رژیم (صعودی/نزولی/رنج/نوسانی) و سطح اطمینان است.
وزن‌های مارکوف بالاتر است زیرا مدل انتقال حالت دقیق‌تری ارائه می‌دهد.`,
    level: 2,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    D1[("D1: بازار داده")]:::store
    D2[("D2: کش تحلیل")]:::store
    D3[("D3: مدل ML")]:::store

    Fuzzy["موتور فازی (وزن: ۰.۳)"]:::process
    Markov["موتور مارکوف (وزن: ۰.۵)"]:::process
    Vote["موتور رأی‌گیری وزنی (وزن: ۰.۲)"]:::process
    Combine["ترکیب و تصمیم نهایی رژیم"]:::process

    D1 -->|"سری زمانی قیمت"| Fuzzy
    D1 -->|"سری زمانی قیمت"| Markov
    D2 -->|"اندیکاتورهای روند"| Fuzzy
    D2 -->|"اندیکاتورهای روند"| Markov
    D2 -->|"سیگنال‌های تکنیکال"| Vote
    D3 -->|"ماتریس انتقال مارکوف"| Markov

    Fuzzy -->|"رژیم فازی + عضویت"| Combine
    Markov -->|"رژیم مارکوف + احتمال انتقال"| Combine
    Vote -->|"رأی وزنی + اطمینان"| Combine

    Combine -->|"رژیم نهایی + اطمینان"| D2
    Combine -->|"به‌روزرسانی ماتریس"| D3`,
  },
  {
    id: 'DFD-L2-P4-DECISION-GRAPH',
    title: `نمودار جریان داده سطح ۲ - P4: محاسبه احتمالات گراف تصمیم`,
    description: `این نمودار زیرفرآیندهای P4 را با جزئیات نشان می‌دهد.
P4.1 ساخت گراف تصمیم شامل ایجاد ۳۴ گره و ۵۵+ یال با ۳ شاخه استراتژی است.
P4.2 محاسبه مسیرها در گراف شامل یافتن تمام مسیرهای ممکن از ریشه تا برگ است.
P4.3 تعیین احتمالات سناریو شامل محاسبه احتمال ۹ سناریو SC1-SC9 با سیستم ۷ لایه VDss است.
P4.4 محاسبه احتمال تجمعی شامل جمع تجمعی سناریوها و تعیین سناریو غالب است.
سیستم VDss دارای ۷ لایه بررسی صحت و ۹ سناریو از صعودی قوی تا نزولی قوی است.`,
    level: 2,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    Regime{{"رژیم شناسایی‌شده"}}:::entity
    SR{{"سطوح S/R"}}:::entity

    D2[("D2: کش تحلیل")]:::store
    D3[("D3: مدل ML")]:::store

    P41["P4.1: ساخت گراف تصمیم"]:::process
    P42["P4.2: محاسبه مسیرها"]:::process
    P43["P4.3: تعیین احتمالات سناریو"]:::process
    P44["P4.4: محاسبه احتمال تجمعی"]:::process

    D2 -->|"اندیکاتورها + الگوها"| P41
    Regime -->|"رژیم بازار"| P41
    SR -->|"نقاط حمایت/مقاومت"| P41
    D3 -->|"وزن‌های یادگرفته‌شده"| P41

    P41 -->|"گراف ۳۴ گره + ۵۵ یال"| P42

    P42 -->|"مسیرهای ممکن + وزن‌ها"| P43
    D3 -->|"پارامترهای VDss"| P43

    P43 -->|"احتمال SC1-SC9"| P44
    P44 -->|"سناریو غالب + اطمینان"| D2
    P44 -->|"توزیع تجمعی"| D2
    P44 -->|"نتیجه نهایی گراف"| P43`,
  },
  {
    id: 'DFD-L2-P5-AI-GENERATION',
    title: `نمودار جریان داده سطح ۲ - P5: تولید تحلیل هوشمند AI`,
    description: `این نمودار زیرفرآیندهای P5 را با جزئیات نشان می‌دهد.
P5.1 انتخاب مکتب MSL از سیستم MSL v4 با ۶ مکتب × ۵ سبک × ۶ لحن است.
P5.2 ساخت پرامپت شامل ترکیب نتایج تحلیل با قالب مکتب انتخابی و ساختار پرامپت سیستم است.
P5.3 فراخوانی LLM از طریق z.ai SDK با تابع dedicatedAIChatCompletion و مدیریت نرخ است.
P5.4 پس‌پردازش متن شامل حذف توهمات، فرمت‌سازی، اضافه‌کردن دسکلیمر و هم‌ترازی با واقعیت بازار است.
سیستم MSL v4 امکان تولید تحلیل با لحن و سبک متنوع را فراهم می‌کند.`,
    level: 2,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    ZAI{{"z.ai LLM"}}:::entity
    User{{"کاربر"}}:::entity

    D2[("D2: کش تحلیل")]:::store
    D4[("D4: تنظیمات")]:::store

    P51["P5.1: انتخاب مکتب MSL"]:::process
    P52["P5.2: ساخت پرامپت"]:::process
    P53["P5.3: فراخوانی LLM"]:::process
    P54["P5.4: پس‌پردازش متن"]:::process

    D2 -->|"سناریو غالب + اندیکاتورها + S/R"| P51
    D4 -->|"ترجیح مکتب کاربر"| P51
    User -->|"انتخاب لحن + سبک"| P51

    P51 -->|"مکتب + سبک + لحن MSL"| P52
    D2 -->|"داده تحلیلی کامل"| P52
    D4 -->|"قالب پرامپت سیستم"| P52

    P52 -->|"پرامپت سیستم + پرامپت کاربر"| P53
    P53 -->|"درخواست completion"| ZAI
    ZAI -->|"پاسخ خام LLM"| P53

    P53 -->|"متن تولیدشده خام"| P54
    D2 -->|"قیمت فعلی + داده واقعی"| P54
    P54 -->|"تحلیل نهایی + دسکلیمر"| D2
    P54 -->|"گزارش هوشمند"| User`,
  },
  {
    id: 'DFD-L2-P6-SR-MANAGEMENT',
    title: `نمودار جریان داده سطح ۲ - P6: مدیریت سطوح حمایت/مقاومت`,
    description: `این نمودار فرآیند P6 مدیریت سطوح حمایت و مقاومت از ۷ منبع مختلف را نشان می‌دهد.
منبع ۱: سطوح محاسبه‌شده از اندیکاتور Pivot Points.
منبع ۲: سطوح محاسبه‌شده از باندهای بولینگر.
منبع ۳: سطوح استاتیک تاریخی (قیمت‌های قبلی).
منبع ۴: سطوح روانی اعداد گرد.
منبع ۵: سطوح فیبوناچی ریتریسمنت.
منبع ۶: سطوح حجمی (نقاط حجم بالا).
منبع ۷: سطوح محاسبه‌شده از الگوهای کندلی.
ادغام و رتبه‌بندی سطوح با وزن‌دهی منابع انجام می‌شود.`,
    level: 2,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    D1[("D1: بازار داده")]:::store
    D2[("D2: کش تحلیل")]:::store

    SR1["منبع ۱: Pivot Points"]:::process
    SR2["منبع ۲: باندهای بولینگر"]:::process
    SR3["منبع ۳: سطوح تاریخی"]:::process
    SR4["منبع ۴: اعداد گرد روانی"]:::process
    SR5["منبع ۵: فیبوناچی"]:::process
    SR6["منبع ۶: حجمی"]:::process
    SR7["منبع ۷: الگوهای کندلی"]:::process
    Merge["ادغام و رتبه‌بندی ۷ منبع"]:::process

    D1 -->|"High/Low/Close"| SR1
    D1 -->|"High/Low/Close"| SR3
    D1 -->|"High/Low/Close"| SR5
    D1 -->|"حجم معاملات"| SR6
    D2 -->|"BBands"| SR2
    D2 -->|"الگوهای کندلی"| SR7

    SR1 -->|"سطوح Pivot"| Merge
    SR2 -->|"سطوح BB"| Merge
    SR3 -->|"سطوح تاریخی"| Merge
    SR4 -->|"سطوح روانی"| Merge
    SR5 -->|"سطوح Fib"| Merge
    SR6 -->|"سطوح حجمی"| Merge
    SR7 -->|"سطوح کندلی"| Merge

    Merge -->|"سطوح S/R نهایی + وزن"| D2`,
  },
  {
    id: 'DFD-L2-P7-MONITORING',
    title: `نمودار جریان داده سطح ۲ - P7: پایش و نمایش نتایج`,
    description: `این نمودار فرآیند P7 پایش و نمایش نتایج را نشان می‌دهد.
پایپ‌لاین رندر شامل دریافت تمام نتایج از کش تحلیل و تبدیل به فرمت نمایش است.
رندر نمودارها شامل ترسیم نمودار قیمت + اندیکاتورها + سطوح S/R با Chart.js است.
رندر گراف تصمیم شامل نمایش تعاملی ۳۴ گره و ۵۵ یال با رنگ‌بندی سناریوهاست.
رندر کارت‌های سناریو شامل نمایش ۹ سناریو SC1-SC9 با احتمالات و توضیحات است.
رندر بخش AI شامل نمایش متن تحلیل هوشمند با فرمت Markdown است.
هماهنگ‌سازی SSE شامل ارسال رویدادهای سرور-فرست برای به‌روزرسانی زنده است.`,
    level: 2,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    User{{"کاربر"}}:::entity

    D2[("D2: کش تحلیل")]:::store

    Fetch["دریافت نتایج از کش"]:::process
    ChartRender["رندر نمودارها"]:::process
    GraphRender["رندر گراف تصمیم"]:::process
    ScenarioCards["رندر کارت‌های سناریو"]:::process
    AIRender["رندر بخش AI"]:::process
    SSE["هماهنگ‌سازی SSE"]:::process

    D2 -->|"تمام داده تحلیلی"| Fetch
    Fetch -->|"داده سری زمانی + اندیکاتورها"| ChartRender
    Fetch -->|"گراف ۳۴ گره"| GraphRender
    Fetch -->|"احتمالات SC1-SC9"| ScenarioCards
    Fetch -->|"متن AI"| AIRender

    ChartRender -->|"نمودار تعاملی"| User
    GraphRender -->|"گراف بصری"| User
    ScenarioCards -->|"کارت‌های سناریو"| User
    AIRender -->|"تحلیل هوشمند"| User

    SSE -->|"به‌روزرسانی زنده"| ChartRender
    SSE -->|"به‌روزرسانی زنده"| GraphRender
    SSE -->|"به‌روزرسانی زنده"| ScenarioCards
    D2 -->|"رویداد تغییر"| SSE`,
  },
  {
    id: 'DFD-L3-P41-GRAPH-CONSTRUCTION',
    title: `نمودار جریان داده سطح ۳ - P4.1: ساخت گراف تصمیم (فرآیندهای اتمی)`,
    description: `این نمودار فرآیندهای اتمی P4.1 را با بیشترین جزئیات نشان می‌دهد.
P4.1.1 مقداردهی گره‌ها شامل ایجاد ۳۴ گره تصمیم با مقادیر اولیه از اندیکاتورها و رژیم بازار است.
P4.1.2 محاسبه وزن یال‌ها شامل تعیین وزن ۵۵+ یال بر اساس همبستگی اندیکاتورها و فاصله S/R است.
P4.1.3 نرمال‌سازی سیگموئید شامل اعمال تابع سیگموئید برای نرمال‌سازی وزن‌ها به بازه ۰-۱ است.
P4.1.4 تشخیص شاخه غالب شامل شناسایی ۳ شاخه استراتژی (صعودی/خنثی/نزولی) و انتخاب مسیر بهینه است.
این فرآیندها پایه‌ای‌ترین سطح اجرای گراف تصمیم هستند.`,
    level: 3,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    Indicators{{"اندیکاتورهای محاسبه‌شده"}}:::entity
    Regime{{"رژیم بازار"}}:::entity
    SRLevels{{"سطوح S/R"}}:::entity

    D2[("D2: کش تحلیل")]:::store
    D3[("D3: مدل ML")]:::store

    P411["P4.1.1: مقداردهی گره‌ها"]:::process
    P412["P4.1.2: محاسبه وزن یال‌ها"]:::process
    P413["P4.1.3: نرمال‌سازی سیگموئید"]:::process
    P414["P4.1.4: تشخیص شاخه غالب"]:::process

    Indicators -->|"مقادیر ۶۰+ اندیکاتور"| P411
    Regime -->|"نوع رژیم + احتمال"| P411
    SRLevels -->|"فاصله تا S/R نزدیک"| P411
    D3 -->|"وزن‌های آموخته‌شده"| P411

    P411 -->|"۳۴ گره با مقدار اولیه"| P412
    Indicators -->|"همبستگی اندیکاتورها"| P412
    SRLevels -->|"فاصله S/R"| P412

    P412 -->|"وزن‌های خام یال‌ها"| P413
    P413 -->|"وزن‌های نرمال‌شده ۰-۱"| P414
    P413 -->|"وزن‌های نرمال‌شده"| D2

    P414 -->|"شاخه غالب + ۳ شاخه استراتژی"| D2
    P414 -->|"گراف نهایی"| P412
    D2 -->|"گراف کش‌شده"| P414`,
  },
  {
    id: 'DFD-L3-P53-LLM-INVOCATION',
    title: `نمودار جریان داده سطح ۳ - P5.3: فراخوانی LLM (فرآیندهای اتمی)`,
    description: `این نمودار فرآیندهای اتمی P5.3 را با بیشترین جزئیات نشان می‌دهد.
P5.3.1 بررسی محدودیت نرخ شامل کنترل Rate Limit و شمارش توکن و مدیریت صف درخواست‌هاست.
P5.3.2 ارسال درخواست شامل فراخوانی تابع dedicatedAIChatCompletion از z.ai SDK با پرامپت سیستم و کاربر است.
P5.3.3 دریافت پاسخ شامل پارس JSON پاسخ LLM و استخراج متن و متاداده‌های مصرف توکن است.
P5.3.4 اعمال بازگشت‌ پسین شامل بررسی خطا، تلاش مجدد با تأخیر نمایی و بازگشت به تحلیل الگووریسمی در صورت شکست کامل است.
این فرآیندها بحرانی‌ترین بخش ارتباط با z.ai LLM هستند.`,
    level: 3,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    ZAI{{"z.ai LLM API"}}:::entity
    Prompt{{"پرامپت ساختاریافته"}}:::entity

    D2[("D2: کش تحلیل")]:::store
    D4[("D4: تنظیمات")]:::store

    P531["P5.3.1: بررسی محدودیت نرخ"]:::process
    P532["P5.3.2: ارسال درخواست"]:::process
    P533["P5.3.3: دریافت پاسخ"]:::process
    P534["P5.3.4: اعمال بازگشت پسین"]:::process

    Prompt -->|"پرامپت سیستم + کاربر"| P531
    D4 -->|"API key + rate limit config"| P531
    D4 -->|"max tokens + model config"| P531

    P531 -->|"درخواست تأییدشده"| P532
    P532 -->|"HTTP request: dedicatedAIChatCompletion"| ZAI
    ZAI -->|"HTTP response: JSON"| P533

    P533 -->|"پاسخ پارس‌شده + متاداده"| P534
    P533 -->|"خطا یا تایم‌اوت"| P534

    P534 -->|"متن LLM موفق"| D2
    P534 -->|"تلاش مجدد"| P531
    P534 -->|"تحلیل بازگشتی الگووریتمی"| D2
    P531 -->|"وضعیت نرخ + شمارش توکن"| D4`,
  },
  {
    id: 'DFD-L3-REGIME-ENGINES',
    title: `نمودار جریان داده سطح ۳ - جزئیات موتورهای تشخیص رژیم`,
    description: `این نمودار جزئیات داخلی سه موتور تشخیص رژیم بازار را نشان می‌دهد.
موتور فازی شامل فازی‌سازی ورودی‌ها، ارزیابی قواعد فازی و غیرفازی‌سازی خروجی است.
موتور مارکوف شامل تخمین ماتریس انتقال، محاسبه توزیع حالت پایا و پیش‌بینی حالت بعدی است.
موتور رأی‌گیری وزنی شامل جمع‌آوری رأی‌ها، اعمال وزن‌ها و تصمیم‌گیری اکثریت وزنی است.
ترکیب نهایی از فرمول ترکیب خطی: R = 0.3*R_fuzzy + 0.5*R_markov + 0.2*R_vote محاسبه می‌شود.
سیستم ML می‌تواند وزن‌ها را بر اساس عملکرد گذشته بهینه‌سازی کند.`,
    level: 3,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    D3[("D3: مدل ML")]:::store

    Fuzzify["فازی‌سازی ورودی"]:::process
    RuleEval["ارزیابی قواعد فازی"]:::process
    Defuzzify["غیرفازی‌سازی"]:::process

    TransEst["تخمین ماتریس انتقال"]:::process
    SteadyState["محاسبه توزیع حالت پایا"]:::process
    NextState["پیش‌بینی حالت بعدی"]:::process

    CollectVotes["جمع‌آوری رأی‌ها"]:::process
    ApplyWeights["اعمال وزن‌ها"]:::process
    MajorDecision["تصمیم اکثریت وزنی"]:::process

    FinalCombine["ترکیب: 0.3*F + 0.5*M + 0.2*V"]:::process

    Fuzzify -->|"مقادیر فازی"| RuleEval
    RuleEval -->|"نتیجه قواعد"| Defuzzify
    Defuzzify -->|"رژیم فازی"| FinalCombine

    D3 -->|"داده تاریخی"| TransEst
    TransEst -->|"ماتریس انتقال"| SteadyState
    SteadyState -->|"توزیع پایا"| NextState
    NextState -->|"رژیم مارکوف"| FinalCombine

    CollectVotes -->|"رأی‌ها"| ApplyWeights
    ApplyWeights -->|"رأی وزنی"| MajorDecision
    MajorDecision -->|"رژیم رأی‌گیری"| FinalCombine

    FinalCombine -->|"وزن‌های بهینه"| D3`,
  },
  {
    id: 'DFD-L3-MSL-SELECTION',
    title: `نمودار جریان داده سطح ۳ - جزئیات سیستم MSL v4`,
    description: `این نمودار جزئیات داخلی سیستم MSL v4 برای انتخاب مکتب تحلیلی را نشان می‌دهد.
۶ مکتب: کلاسیک، وایکوف، ایلیوت، حجم‌محور، هارمونیک، هوشمند
۵ سبک: آکادمیک، حرفه‌ای، آموزشی، خبری، ساده
۶ لحن: رسمی، دوستانه، محافظه‌کار، تهاجمی، خنثی، هشداردهنده
انتخاب مکتب بر اساس رژیم بازار و ترجیح کاربر انجام می‌شود.
هر ترکیب مکتب × سبک × لحن قالب پرامپت منحصربه‌فردی تولید می‌کند.
مجموع ۶ × ۵ × ۶ = ۱۸۰ ترکیب ممکن وجود دارد.`,
    level: 3,
    code: `flowchart TB
    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000

    Regime{{"رژیم بازار"}}:::entity
    User{{"کاربر"}}:::entity
    D4[("D4: تنظیمات")]:::store

    SchoolSelect["انتخاب مکتب (۶ مکتب)"]:::process
    StyleSelect["انتخاب سبک (۵ سبک)"]:::process
    ToneSelect["انتخاب لحن (۶ لحن)"]:::process
    TemplateBuild["ساخت قالب پرامپت"]:::process
    Validation["اعتبارسنجی ترکیب"]:::process

    Regime -->|"نوع رژیم"| SchoolSelect
    User -->|"ترجیح مکتب"| SchoolSelect
    D4 -->|"تنظیمات پیش‌فرض"| SchoolSelect

    SchoolSelect -->|"مکتب انتخابی"| StyleSelect
    User -->|"ترجیح سبک"| StyleSelect

    StyleSelect -->|"سبک انتخابی"| ToneSelect
    User -->|"ترجیح لحن"| ToneSelect
    Regime -->|"توصیه لحن"| ToneSelect

    ToneSelect -->|"لحن انتخابی"| TemplateBuild
    SchoolSelect -->|"مکتب"| TemplateBuild
    StyleSelect -->|"سبک"| TemplateBuild

    TemplateBuild -->|"قالب پرامپت - ۱۸۰ ترکیب"| Validation
    Validation -->|"قالب تأییدشده"| D4`,
  },
] as const;

export const BPMN_DIAGRAMS = [
  {
    id: 'BPMN-L1-001',
    title: `نمای کلی فرآیند تحلیل تکنیکال مالی`,
    description: `این نمودار نمای کلی فرآیند اصلی سامانه تحلیل تکنیکال مالی ایران را نشان می‌دهد.
  فرآیند از انتخاب نماد توسط تحلیل‌گر آغاز شده و با دریافت داده از منابع مختلف ادامه می‌یابد.
  پس از اجرای موتور تحلیل تکنیکال، رژیم بازار تشخیص داده می‌شود و احتمالات سناریوها محاسبه می‌گردد.
  در نهایت متن تحلیلی توسط هوش مصنوعی تولید و نتایج به کاربر نمایش داده می‌شود.
  سه دروازه تصمیم‌گیری کلیدی شامل موفقیت در دریافت داده، نوع رژیم بازار و محدودیت نرخ AI وجود دارد.
  شش لایه معماری سیستم در سه استخر با لین‌های مجزا نمایش داده شده‌اند.`,
    level: 1,
    happyPath: `تحلیل‌گر نماد را انتخاب می‌کند ← داده با موفقیت از BrsApi دریافت می‌شود ← تحلیل تکنیکال اجرا می‌گردد ← رژیم Trend تشخیص داده می‌شود ← احتمالات سناریوها محاسبه می‌شود ← متن AI بدون محدودیت نرخ تولید می‌شود ← نتایج نمایش داده می‌شود`,
    exceptionFlows: `۱) خطا در دریافت داده: BrsApi ناموفق → تلاش از TSETMC → تلاش از TGJU → تلاش از Yahoo Finance → اگر همه ناموفق ← نمایش خطا به کاربر
  ۲) رژیم Range/Choppy: مسیر تحلیل متفاوت با استراتژی Reversal فعال می‌شود
  ۳) محدودیت نرخ AI: سیستم با تأخیر مجدد تلاش می‌کند یا نسخه کش‌شده را نمایش می‌دهد`,
    code: `flowchart TB
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

    GW1{{دریافت داده\\nموفق؟}}:::decisionNode
    GW2{{نوع رژیم\\nبازار؟}}:::decisionNode
    GW3{{نرخ AI\\nمحدود؟}}:::decisionNode

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
    classDef errorNode fill:#ef4444,stroke:#dc2626,color:#fff,stroke-width:2px`,
  },
  {
    id: 'BPMN-L2-001',
    title: `فرآیند دریافت داده از منابع بازار`,
    description: `این فرآیند اجرایی جزئیات دریافت داده از چهار منبع مختلف بورس ایران را نشان می‌دهد.
  فرآیند با درخواست داده برای نماد انتخاب‌شده آغاز می‌شود و ابتدا از BrsApi (منبع اصلی TSE) تلاش می‌کند.
  در صورت ناموفق بودن، به ترتیب از TSETMC CDN، TGJU و در نهایت Yahoo Finance تلاش می‌شود.
  هر منبع موفق داده را با منابع قبلی ادغام کرده و در صورت موفقیت هر منبع، داده پاک‌سازی و ذخیره می‌شود.
  مکانیزم fallback زنجیره‌ای تضمین می‌کند که حتی در صورت قطعی برخی منابع، داده قابل دسترسی باشد.
  پس از ادغام نهایی، داده‌ها نرمال‌سازی و در کش محلی ذخیره می‌گردند.`,
    level: 2,
    happyPath: `درخواست داده → BrsApi موفق → ادغام داده → پاک‌سازی → نرمال‌سازی → ذخیره در کش → خروج`,
    exceptionFlows: `۱) BrsApi ناموفق → تلاش TSETMC → اگر موفق ادغام و ادامه
  ۲) TSETMC ناموفق → تلاش TGJU → اگر موفق ادغام و ادامه
  ۳) TGJU ناموفق → تلاش Yahoo Finance → اگر موفق ادغام و ادامه
  ۴) همه منابع ناموفق → بازگرداندن خطا → نمایش پیام عدم دسترسی به داده`,
    code: `flowchart TB
    START([🟢 درخواست داده نماد]):::startNode

    REQ[ساخت درخواست HTTP\\nبا هدرهای مناسب]:::activityNode

    subgraph FETCH["🔄 زنجیره دریافت داده"]
        TRY1[تلاش از BrsApi\\nTSE Official]:::activityNode
        GW1{{BrsApi\\nموفق؟}}:::decisionNode
        MERGE1[ادغام داده BrsApi]:::activityNode

        TRY2[تلاش از TSETMC CDN\\nTSETMC Direct]:::activityNode
        GW2{{TSETMC\\nموفق؟}}:::decisionNode
        MERGE2[ادغام داده TSETMC]:::activityNode

        TRY3[تلاش از TGJU\\nTGJU Market]:::activityNode
        GW3{{TGJU\\nموفق؟}}:::decisionNode
        MERGE3[ادغام داده TGJU]:::activityNode

        TRY4[تلاش از Yahoo Finance\\nInternational]:::activityNode
        GW4{{Yahoo\\nموفق؟}}:::decisionNode
        MERGE4[ادغام داده Yahoo]:::activityNode
    end

    CLEAN[پاک‌سازی داده\\nحذف مقادیر نامعتبر]:::activityNode
    NORM[نرمال‌سازی زمانی\\nهمگام‌سازی تایم‌استمپ]:::activityNode
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
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px`,
  },
  {
    id: 'BPMN-L2-002',
    title: `فرآیند تحلیل تکنیکال`,
    description: `این فرآیند اجرایی جزئیات موتور تحلیل تکنیکال را نشان می‌دهد که داده OHLCV را پردازش کرده و خروجی تحلیلی تولید می‌کند.
  فرآیند در چند مرحله اجرا می‌شود: ابتدا اندیکاتورهای مومنتوم (RSI, MACD, Stochastic) محاسبه می‌شوند.
  سپس اندیکاتورهای volatility شامل Bollinger Bands و Parabolic SAR محاسبه می‌گردند.
  مرحله بعدی شامل محاسبه اندیکاتورهای روند (ADX, ATR) و تشخیص الگوهای کلاسیک است.
  در نهایت سطوح حمایت و مقاومت محاسبه شده و ۹ سناریو (SC1-SC9) بر اساس سیگنال‌ها ساخته می‌شوند.
  هر مرحله خروجی خود را به مرحله بعدی ارسال کرده و نتایج نهایی برای تشخیص رژیم آماده می‌شود.`,
    level: 2,
    happyPath: `داده OHLCV → محاسبه RSI/MACD/Stochastic → محاسبه Bollinger/SAR → محاسبه ADX/ATR → تشخیص الگوها → محاسبه S/R → ساخت سناریوها → خروجی تحلیلی`,
    exceptionFlows: `۱) داده ناکافی: تعداد کندل کم از حد نیاز → بازگرداندن خطا با پیام "داده ناکافی"
  ۲) خطای محاسبه اندیکاتور: مقادیر نامعتبر (مثل تقسیم بر صفر) → استفاده از مقدار پیش‌فرض و ثبت هشدار
  ۳) عدم تشخیص الگو: هیچ الگویی یافت نشد → ادامه با سیگنال خنثی`,
    code: `flowchart TB
    START([🟢 دریافت داده OHLCV]):::startNode
    VALID{{داده کافی؟\\nحداقل ۲۰۰ کندل}}:::decisionNode

    subgraph MOMENTUM["📈 اندیکاتورهای مومنتوم"]
        RSI[محاسبه RSI\\nدوره ۱۴]:::activityNode
        MACD[محاسبه MACD\\n۱۲/۲۶/۹]:::activityNode
        STOCH[محاسبه Stochastic\\n%K و %D]:::activityNode
    end

    subgraph VOLATILITY["📉 اندیکاتورهای نوسان"]
        BOLL[محاسبه Bollinger Bands\\nدوره ۲۰، انحراف ۲]:::activityNode
        SAR[محاسبه Parabolic SAR\\nگام ۰.۰۲]:::activityNode
    end

    subgraph TREND["📊 اندیکاتورهای روند"]
        ADX[محاسبه ADX\\nدوره ۱۴]:::activityNode
        ATR[محاسبه ATR\\nدوره ۱۴]:::activityNode
    end

    PAT[تشخیص الگوهای کلاسیک\\nسر و شانه، مثلث، پرچم]:::activityNode
    SR[محاسبه سطوح حمایت و مقاومت\\nPivot Points + Fibonacci]:::activityNode

    subgraph SCENARIOS["🎯 ساخت سناریوها"]
        SC[ساخت ۹ سناریو\\nSC1-SC9]:::activityNode
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
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px`,
  },
  {
    id: 'BPMN-L2-003',
    title: `فرآیند محاسبه احتمالات VDss`,
    description: `این فرآیند اجرایی سیستم احتمال ۷ لایه VDss را با گراف تصمیم ۳۴ گره و ۵۵+ یال نشان می‌دهد.
  فرآیند با ساخت گراف تصمیم آغاز می‌شود: ۳۴ گره مقداردهی و ۳ شاخه استراتژی متصل می‌گردند.
  سپس وزن یال‌ها بر اساس سیگنال‌های تحلیلی محاسبه شده و نرمال‌سازی سیگموئیدی اعمال می‌شود.
  احتمالات مسیرها با پیمایش گراف محاسبه شده و احتمالات تجمعی برای هر سناریو تعیین می‌گردد.
  در نهایت تحلیل روند کلی انجام شده و خروجی احتمالات برای تولید متن AI آماده می‌شود.
  هر شاخه استراتژی (Trend Following, Breakout, Reversal) وزن‌دهی مجزایی دارد.`,
    level: 2,
    happyPath: `ساخت گراف ۳۴ گره → محاسبه وزن یال‌ها → نرمال‌سازی سیگموئید → محاسبه احتمالات مسیر → احتمالات تجمعی SC1-SC9 → تحلیل روند → خروجی`,
    exceptionFlows: `۱) گراف ناقص: یال‌های معلق → تکمیل با وزن پیش‌فرض و ثبت هشدار
  ۲) احتمالات غیرنرمال: مجموع ≠ ۱ → بازنرمال‌سازی اجباری
  ۳) گراف چرخه‌ای: حلقه بی‌نهایت → حذف یال‌های چرخه‌ای و ادامه`,
    code: `flowchart TB
    START([🟢 شروع محاسبه احتمالات]):::startNode

    subgraph GRAPH["🏗️ ساخت گراف تصمیم"]
        INIT[مقداردهی ۳۴ گره]:::activityNode

        subgraph BRANCHES["🌿 شاخه‌های استراتژی"]
            TREND["شاخه Trend Following\\n۱۲ گره، ۲۰ یال"]:::activityNode
            BREAK["شاخه Breakout\\n۱۱ گره، ۱۸ یال"]:::activityNode
            REVERSAL["شاخه Reversal\\n۱۱ گره، ۱۷+ یال"]:::activityNode
        end

        CONNECT[اتصال شاخه‌ها\\nگراف نهایی ۳۴ گره، ۵۵+ یال]:::activityNode
    end

    subgraph WEIGHTS["⚖️ محاسبه وزن‌ها"]
        EDGE[محاسبه وزن یال‌ها\\nبر اساس سیگنال‌ها]:::activityNode
        SIGMOID[نرمال‌سازی سیگموئید\\nσx = 1/(1+e^(-x))]:::activityNode
        GW_NORM{{احتمالات\\nنرمال؟}}:::decisionNode
        RENORM[بازنرمال‌سازی اجباری]:::activityNode
    end

    subgraph PROB["📊 محاسبه احتمالات"]
        PATH[پیمایش مسیرها\\nمحاسبه احتمال هر مسیر]:::activityNode
        CUM[احتمالات تجمعی\\nبرای SC1 تا SC9]:::activityNode
        ANALYSIS[تحلیل روند کلی\\nغالب‌ترین سناریو]:::activityNode
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
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px`,
  },
  {
    id: 'BPMN-L2-004',
    title: `فرآیند تولید متن تحلیلی AI`,
    description: `این فرآیند اجرایی تولید متن تحلیلی با هوش مصنوعی را نشان می‌دهد.
  فرآیند با انتخاب مدل ML آغاز شده و سپس MSL v4 (مدیریت سبک زبان) پیکربندی می‌شود.
  MSL v4 شامل ۶ مکتب × ۵ سبک × ۶ لحن = ۱۸۰ ترکیب ممکن برای متن تحلیلی است.
  پرامپت بر اساس نتایج تحلیل تکنیکال، رژیم بازار و احتمالات سناریوها ساخته می‌شود.
  سپس درخواست به z.ai LLM ارسال شده و در صورت محدودیت نرخ، تلاش مجدد با تأخیر نمایی انجام می‌گیرد.
  متن تولیدشده پس‌پردازش شده و اعتبارسنجی نهایی قبل از نمایش انجام می‌شود.`,
    level: 2,
    happyPath: `انتخاب مدل ML → پیکربندی MSL v4 → ساخت پرامپت → فراخوانی LLM → متن تولیدشده → پس‌پردازش → اعتبارسنجی → نمایش`,
    exceptionFlows: `۱) محدودیت نرخ LLM: HTTP 429 → تأخیر نمایی (1s, 2s, 4s, 8s) → تلاش مجدد حداکثر ۵ بار
  ۲) خطای LLM: پاسخ نامعتبر → استفاده از قالب پیش‌فرض و ثبت خطا
  ۳) نامعتبری پس‌پردازش: قیمت‌های نامعتبر → حذف و ادامه با هشدار`,
    code: `flowchart TB
    START([🟢 شروع تولید متن AI]):::startNode

    subgraph CONFIG["⚙️ پیکربندی"]
        ML_SEL[انتخاب مدل ML\\nبر اساس نوع بازار]:::activityNode
        MSL["پیکربندی MSL v4\\n۶ مکتب × ۵ سبک × ۶ لحن"]:::activityNode

        subgraph MSL_DETAIL["📋 جزئیات MSL"]
            SCHOOL["مکتب‌ها:\\nکلاسیک، نئو، کمیت، الیوت، حجمی، هارمونیک"]:::activityNode
            STYLE["سبک‌ها:\\nرسمی، محاوره‌ای، آموزشی، هشداری، خلاصه"]:::activityNode
            TONE["لحن‌ها:\\nخنثی، خوش‌بینانه، محتاطانه، بدبینانه، فنی، عام"]:::activityNode
        end
    end

    PROMPT[ساخت پرامپت\\nترکیب نتایج TA + رژیم + احتمالات]:::activityNode
    CALL[فراخوانی z.ai LLM\\nارسال درخواست]:::activityNode

    GW_RATE{{نرخ محدود؟\\nHTTP 429}}:::decisionNode
    RETRY[تأخیر نمایی\\nو تلاش مجدد]:::activityNode
    GW_MAX{{حداکثر تلاش\\nرسیده؟}}:::decisionNode
    FALLBACK[استفاده از\\nقالب پیش‌فرض]:::activityNode

    POST[پس‌پردازش متن\\nحذف کدها + اصلاح فارسی]:::activityNode
    VALID[اعتبارسنجی نهایی\\nبررسی قیمت‌ها و ارقام]:::activityNode
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
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px`,
  },
  {
    id: 'BPMN-L3-001',
    title: `زیرفرآیند تشخیص رژیم بازار`,
    description: `این زیرفرآیند جزئیات سه موتور تشخیص رژیم بازار را نشان می‌دهد.
  سه موتور به صورت موازی اجرا می‌شوند: فازی (وزن ۰.۳)، مارکوف (وزن ۰.۵) و رأی‌گیری وزنی (وزن ۰.۲).
  موتور فازی با محاسبه درجات عضویت فازی، رژیم را بر اساس توابع مثلثی و ذوزنوی تعیین می‌کند.
  موتور مارکوف با محاسبه ماتریس انتقال و ضرب در بردار وضعیت فعلی، رژیم آینده را پیش‌بینی می‌کند.
  رأی‌گیری وزنی با ترکیب سیگنال‌های چندگانه و اعمال وزن‌های تجمعی، تصمیم نهایی را می‌گیرد.
  خروجی سه موتور ترکیب شده و رژیم نهایی با سطح اطمینان تعیین می‌گردد.`,
    level: 3,
    happyPath: `داده تحلیلی → فازی: عضویت ۰.۸ → مارکوف: انتقال ۰.۷۵ → رأی‌گیری: تأیید → ترکیب وزنی → رژیم Trend با اطمینان ۸۵٪`,
    exceptionFlows: `۱) تناقض موتورها: فازی Trend vs مارکوف Range → تصمیم بر اساس وزن مارکوف (۰.۵ بالاتر)
  ۲) اطمینان پایین: هر سه موتور < ۵۰٪ → رژیم Unknown با اطمینان پایین
  ۳) خطای ماتریس مارکوف: ماتریس singular → استفاده از موتور فازی و رأی‌گیری فقط`,
    code: `flowchart TB
    START([🟢 داده تحلیلی ورودی]):::startNode
    PAR[تقسیم داده بین سه موتور]:::activityNode

    subgraph FUZZY_ENGINE["🔵 موتور فازی - وزن ۰.۳"]
        F1[محاسبه درجات عضویت\\nتوابع مثلثی و ذوزنوی]:::activityNode
        F2[ارزیابی قوانین فازی\\nIF-THEN rules]:::activityNode
        F3[استنتاج فازی\\ndefuzzification]:::activityNode
        F4[خروجی فازی:\\nرژیم + اطمینان]:::activityNode
    end

    subgraph MARKOV_ENGINE["🟠 موتور مارکوف - وزن ۰.۵"]
        M1[محاسبه ماتریس انتقال\\nبر اساس تاریخچه]:::activityNode
        M2[ضرب ماتریس در بردار وضعیت\\nP × s_t]:::activityNode
        M3[محاسبه توزوع ایستا\\nπ = π × P]:::activityNode
        M4[خروجی مارکوف:\\nرژیم + احتمال انتقال]:::activityNode
    end

    subgraph VOTE_ENGINE["🟢 رأی‌گیری وزنی - وزن ۰.۲"]
        V1[جمع‌آوری سیگنال‌ها\\nاز اندیکاتورهای مختلف]:::activityNode
        V2[اعمال وزن‌های تجمعی\\nروی هر سیگنال]:::activityNode
        V3[تجمیع آرا\\nMajority Vote]:::activityNode
        V4[خروجی رأی‌گیری:\\nرژیم + آرا]:::activityNode
    end

    COMBINE[ترکیب وزنی خروجی‌ها\\n0.3×F + 0.5×M + 0.2×V]:::activityNode
    GW_CONFLICT{{تناقض\\nبین موتورها؟}}:::decisionNode
    RESOLVE[حل تناقض\\nبر اساس وزن بالاتر]:::activityNode
    CLASSIFY[طبقه‌بندی نهایی رژیم\\nTrend | Range | Breakout | Choppy]:::activityNode
    CONF[محاسبه سطح اطمینان\\n ترکیب سه اطمینان]:::activityNode
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
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px`,
  },
  {
    id: 'BPMN-L3-002',
    title: `زیرفرآیند ساخت گراف تصمیم`,
    description: `این زیرفرآیند جزئیات ساخت گراف تصمیم با ۳۴ گره و ۵۵+ یال را نشان می‌دهد.
  فرآیند با مقداردهی ۳۴ گره آغاز شده و سپس سیگنال‌های هر شاخه استراتژی محاسبه می‌گردد.
  شاخه Trend Following شامل ۱۲ گره و ۲۰ یال برای سیگنال‌های روندی است.
  شاخه Breakout شامل ۱۱ گره و ۱۸ یال برای سیگنال‌های شکست است.
  شاخه Reversal شامل ۱۱ گره و ۱۷+ یال برای سیگنال‌های بازگشتی است.
  پس از محاسبه وزن یال‌ها، نرمال‌سازی سیگموئیدی اعمال شده و مسیرها تجمیع می‌گردند.
  در نهایت ۹ سناریو SC1-SC9 بر اساس احتمالات مسیرها ساخته می‌شوند.`,
    level: 3,
    happyPath: `مقداردهی ۳۴ گره → سیگنال‌های Trend → سیگنال‌های Breakout → سیگنال‌های Reversal → وزن یال‌ها → سیگموئید → تجمیع → SC1-SC9`,
    exceptionFlows: `۱) گره یتیم: گره بدون یال ورودی → حذف گره و ثبت هشدار
  ۲) یال با وزن منفی → صفر کردن وزن و ادامه
  ۳) شاخه بدون سیگنال → اختصاص احتمال یکنواخت`,
    code: `flowchart TB
    START([🟢 شروع ساخت گراف تصمیم]):::startNode
    INIT[مقداردهی ۳۴ گره\\nN1 تا N34]:::activityNode

    subgraph TREND_BRANCH["📈 شاخه Trend Following"]
        T1[گره‌های ورودی روند\\nN1-N4]:::activityNode
        T2[گره‌های پردازش روند\\nN5-N10]:::activityNode
        T3[گره‌های خروجی روند\\nN11-N12]:::activityNode
        T_SIG[محاسبه سیگنال‌های روندی\\nEMA cross, ADX>25, +DI>-DI]:::activityNode
        T_EDGE[محاسبه وزن ۲۰ یال روندی\\nبر اساس قدر سیگنال]:::activityNode
    end

    subgraph BREAKOUT_BRANCH["💥 شاخه Breakout"]
        B1[گره‌های ورودی شکست\\nN13-N16]:::activityNode
        B2[گره‌های پردازش شکست\\nN17-N20]:::activityNode
        B3[گره‌های خروجی شکست\\nN21]:::activityNode
        B_SIG[محاسبه سیگنال‌های شکست\\nVol spike, Range break, S/R breach]:::activityNode
        B_EDGE[محاسبه وزن ۱۸ یال شکست\\nبر اساس حجم و دامنه]:::activityNode
    end

    subgraph REVERSAL_BRANCH["🔄 شاخه Reversal"]
        R1[گره‌های ورودی بازگشت\\nN22-N25]:::activityNode
        R2[گره‌های پردازش بازگشت\\nN26-N30]:::activityNode
        R3[گره‌های خروجی بازگشت\\nN31]:::activityNode
        R_SIG[محاسبه سیگنال‌های بازگشتی\\nRSI div, Double top/bottom, Doji]:::activityNode
        R_EDGE[محاسبه وزن ۱۷+ یال بازگشتی\\nبر اساس اطمینان الگو]:::activityNode
    end

    MERGE_NODES[اتصال گره‌های مشترک\\nگراف یکپارچه ۳۴ گره]:::activityNode
    ALL_EDGES[ترکیب تمام یال‌ها\\n۵۵+ یال نهایی]:::activityNode
    SIGMOID[نرمال‌سازی سیگموئید\\nبرای هر یال]:::activityNode
    PATH_AGG[تجمیع مسیرها\\nمحاسبه احتمال هر مسیر]:::activityNode

    subgraph SC_BUILD["🎯 ساخت سناریوها"]
        SC1[SC1: صعودی قوی\\nP ≥ 0.7, Trend+Break]:::activityNode
        SC2[SC2: صعودی متوسط\\n0.5 ≤ P < 0.7, Trend]:::activityNode
        SC3[SC3: صعودی ضعیف\\n0.3 ≤ P < 0.5, Trend]:::activityNode
        SC4[SC4: نزولی قوی\\nP ≥ 0.7, Trend↓+Break↓]:::activityNode
        SC5[SC5: نزولی متوسط\\n0.5 ≤ P < 0.7, Trend↓]:::activityNode
        SC6[SC6: نزولی ضعیف\\n0.3 ≤ P < 0.5, Trend↓]:::activityNode
        SC7[SC7: رنج بالا\\nRange + near Resistance]:::activityNode
        SC8[SC8: رنج پایین\\nRange + near Support]:::activityNode
        SC9[SC9: شکست ساختار\\nChoppy + high Vol]:::activityNode
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
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px`,
  },
  {
    id: 'BPMN-L3-003',
    title: `زیرفرآیند پس‌پردازش متن AI`,
    description: `این زیرفرآیند جزئیات پس‌پردازش متن تولیدشده توسط AI را نشان می‌دهد.
  فرآیند با حذف کدهای تخریبی و نشانه‌گذاری آغاز می‌شود.
  سپس اصلاحات فارسی شامل نیم‌فاصله‌ها، حروف ی و ک فارسی و نقطه‌گذاری انجام می‌گیرد.
  جهت اعداد اصلاح شده تا ارقام و قیمت‌ها از راست به چپ نمایش داده شوند.
  اعتبارسنجی قیمت‌ها با مقایسه قیمت‌های ذکرشده در متن با داده واقعی بازار انجام می‌شود.
  در نهایت بررسی توهم AI (hallucination) انجام شده و در صورت وجود، هشدار ثبت و متن اصلاح می‌شود.`,
    level: 3,
    happyPath: `متن خام AI → حذف کدها → اصلاح فارسی → جهت اعداد → اعتبارسنجی قیمت → بررسی توهم → معتبر → بازگرداندن متن`,
    exceptionFlows: `۱) قیمت نامعتبر: قیمت در متن با بازار تطبیق ندارد → حذف قیمت از متن + هشدار
  ۲) توهم AI: ادعای غیر واقعی → ثبت هشدار + سعی حذف بخش توهم‌دار
  ۳) متن خالی: پس‌پردازش نتیجه‌ای نداد → بازگرداندن پیام پیش‌فرض`,
    code: `flowchart TB
    START([🟢 متن خام AI ورودی]):::startNode

    STRIP[حذف کدهای تخریبی\\nHTML, Markdown, LaTeX]:::activityNode
    STRIP2[حذف نشانه‌های داخلی\\n<|im_start|>, <|end|>]:::activityNode

    subgraph PERSIAN_FIX["🔧 اصلاحات فارسی"]
        ZWNJ[اصلاح نیم‌فاصله‌ها\\nمی‌روم vs می روم]:::activityNode
        YE_KE[اصلاح ی و ک\\nی→ی، ک→ک]:::activityNode
        PUNCT[اصلاح نقطه‌گذاری و فاصله\\nفارسی‌سازی اعداد]:::activityNode
    end

    NUM_DIR[اصلاح جهت اعداد\\nراست به چپ برای فارسی]:::activityNode
    NUM_SEP[جداکننده هزارگان\\nبه فارسی: ۱٬۲۳۴٬۵۶۷]:::activityNode

    subgraph VALIDATION["✅ اعتبارسنجی"]
        PRICE[بررسی قیمت‌های ذکرشده\\nمقایسه با داده بازار]:::activityNode
        GW_PRICE{{قیمت‌ها\\nمعتبر؟}}:::decisionNode
        FIX_PRICE[حذف قیمت نامعتبر\\nو افزودن هشدار]:::activityNode

        HALLU[بررسی توهم AI\\nHallucination Detection]:::activityNode
        GW_HALLU{{توهم\\nشناسایی شد؟}}:::decisionNode
        FIX_HALLU[حذف بخش توهم‌دار\\nو ثبت هشدار]:::activityNode
    end

    GW_EMPTY{{متن خالی\\nبعد از پردازش؟}}:::decisionNode
    DEFAULT[استفاده از پیام پیش‌فرض\\n"تحلیل در دسترس نیست"]:::activityNode
    LOG_OK[ثبت لاگ موفقیت\\nزمان پردازش و کیفیت]:::activityNode
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
    classDef dataNode fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px`,
  },
] as const;

export const UML_STRUCT_DIAGRAMS = [
  {
    id: 'uml-class-l1',
    title: `نمودار کلاس - سطح دامنه`,
    description: `این نمودار ساختار دامنه اصلی سامانه تحلیل تکنیکال مالی ایران را نمایش می‌دهد.
  هفت کلاس اصلی دامنه با مسئولیت‌های کلیدی خود نشان داده شده‌اند.
  TAEngine هسته تحلیل تکنیکال با بیش از ۶۰ اندیکاتور است.
  RegimeEngine تشخیص رژیم بازار را با منطق فازی و مارکوف انجام می‌دهد.
  DecisionGraph گراف تصمیم‌گیری با ۳۴ گره و ۵۵ یال را مدیریت می‌کند.
  MLEngine مدل یادگیری ماشین لجستیک‌رجression را آموزش و اجرا می‌کند.
  SRAnalyzer سطوح حمایت و مقاومت را شناسایی و بهینه‌سازی می‌کند.
  AIPostProcessor خروجی متنی هوش مصنوعی را پردازش و اصلاح می‌کند.
  ZaiShared خدمات مشترک هوش مصنوعی و محدودکننده نرخ را فراهم می‌کند.`,
    level: 1,
    code: `@startuml
' نمودار کلاس سطح ۱ - مدل دامنه
skinparam classAttributeIconSize 0
skinparam monochrome false
skinparam shadowing true

title سامانه تحلیل تکنیکال مالی ایران\\nنمودار کلاس - سطح ۱: مدل دامنه

note as N1
  این نمودار کلاس‌های اصلی دامنه
  و مسئولیت‌های کلیدی آن‌ها را
  نمایش می‌دهد. هر کلاس نقش
  محوری در سامانه دارد.
end note

class TAEngine <<Core>> {
  +analyze()
  +calcTrend()
  +linearRegression()
}

class RegimeEngine <<Core>> {
  +detectRegime()
  +fuzzyMembership()
  +markovTransition()
  +weightedVote()
}

class DecisionGraph <<Core>> {
  +buildGraph()
  +computePaths()
  +normalizeWeights()
}

class MLEngine <<ML>> {
  +trainAdaptive()
  +predict()
  +getCachedWeights()
}

class SRAnalyzer <<Analysis>> {
  +detectLevels()
  +mlOptimize()
  +computeStrength()
}

class AIPostProcessor <<AI>> {
  +stripCodes()
  +fixPersian()
  +validatePrices()
  +fixDirection()
}

class ZaiShared <<Infra>> {
  +dedicatedAIChatCompletion()
  +rateLimitedPageReader()
  +getZai()
}

TAEngine --> RegimeEngine : استفاده
TAEngine --> SRAnalyzer : تحلیل سطح
DecisionGraph --> RegimeEngine : رژیم‌ها
MLEngine --> TAEngine : اندیکاتورها
AIPostProcessor --> ZaiShared : فراخوانی AI
DecisionGraph --> MLEngine : پیش‌بینی

@enduml`,
  },
  {
    id: 'uml-class-l2',
    title: `نمودار کلاس - سطح طراحی`,
    description: `نمودار سطح طراحی با ارتباطات دقیق، تجمیع، ترکیب و چندگانگی.
  TAEngine به‌صورت ترکیب شامل RegimeEngine و SRAnalyzer است.
  DecisionGraph به‌صورت تجمیع شامل MLEngine و ProbabilityTrend است.
  MLEngine با BayesianWeights ارتباط ترکیب دارد.
  CompositeScores از چند موتور نمرات مرکب محاسبه می‌کند.
  AnalysisMLSelector ترکیب روش‌های تحلیلی را انتخاب می‌کند.
  VolumeProfile و CandlestickPatterns بخش‌های تحلیلی هستند.
  چندگانگی و جهت ارتباطات به‌دقت مشخص شده‌اند.`,
    level: 2,
    code: `@startuml
' نمودار کلاس سطح ۲ - طراحی با ارتباطات
skinparam classAttributeIconSize 0
skinparam linetype ortho

title سامانه تحلیل تکنیکال مالی ایران\\nنمودار کلاس - سطح ۲: طراحی

class TAEngine {
  +analyze()
  +calcTrend()
  +linearRegression()
  -indicators: Map<string, Function>
  -candlesticks: Candlestick[]
}

class RegimeEngine {
  +detectRegime()
  +fuzzyMembership()
  +markovTransition()
  +weightedVote()
  -regimes: Regime[]
  -transitionMatrix: number[][]
}

class DecisionGraph {
  +buildGraph()
  +computePaths()
  +normalizeWeights()
  -nodes: GraphNode[34]
  -edges: GraphEdge[55]
}

class MLEngine {
  +trainAdaptive()
  +predict()
  +getCachedWeights()
  -model: LogisticRegression
  -cache: WeightsCache
}

class SRAnalyzer {
  +detectLevels()
  +mlOptimize()
  +computeStrength()
  -levels: SRLevel[]
  -strengthThreshold: number
}

class AIPostProcessor {
  +stripCodes()
  +fixPersian()
  +validatePrices()
  +fixDirection()
}

class ZaiShared {
  +dedicatedAIChatCompletion()
  +rateLimitedPageReader()
  +getZai()
}

class ProbabilityTrend {
  +calculateCDF()
  +buildTrend()
  +getInterpretation()
}

class CompositeScores {
  +calcTrendStrength()
  +calcSRStrength()
}

class AnalysisMLSelector {
  +selectCombination()
  +selectMethods()
}

class BayesianWeights {
  +updateWeights()
  +prior()
  +posterior()
}

class VolumeProfile {
  +approximate()
  +countTouch()
  +poc()
}

class CandlestickPatterns {
  +detectClassic()
  +detectHarmonic()
  +detectElliott()
}

' ترکیب - TAEngine مالک RegimeEngine و SRAnalyzer است
TAEngine *-- "1" RegimeEngine : <<composition>>
TAEngine *-- "1" SRAnalyzer : <<composition>>
TAEngine *-- "1" VolumeProfile : <<composition>>
TAEngine *-- "1" CandlestickPatterns : <<composition>>

' تجمیع - DecisionGraph استفاده می‌کند اما مالک نیست
DecisionGraph o-- "1" MLEngine : <<aggregation>>
DecisionGraph o-- "1..*" ProbabilityTrend : <<aggregation>>
DecisionGraph --> "1" CompositeScores : محاسبه نمرات

MLEngine *-- "1" BayesianWeights : <<composition>>
MLEngine --> "1" AnalysisMLSelector : انتخاب روش

CompositeScores --> "1" TAEngine : اندیکاتورها
CompositeScores --> "1" SRAnalyzer : سطوح

AIPostProcessor --> "1" ZaiShared : فراخوانی AI
TAEngine --> "0..1" ProbabilityTrend : روند احتمالی

note right of TAEngine
  هسته اصلی تحلیل تکنیکال
  شامل بیش از ۶۰ اندیکاتور
  و زیرسیستم‌های تحلیلی
end note

note right of DecisionGraph
  گراف تصمیم‌گیری با
  ۳۴ گره و ۵۵ یال
  مسیرهای تصمیم را محاسبه می‌کند
end note

@enduml`,
  },
  {
    id: 'uml-class-l3',
    title: `نمودار کلاس - سطح پیاده‌سازی`,
    description: `نمودار سطح پیاده‌سازی با تمام متدها، پارامترها، انواع بازگشتی و نماد دید.
  هر کلاس با امضای کامل متدها و فیلدها نمایش داده شده است.
  نوع‌های generics، اینترفیس‌ها و abstract classها مشخص هستند.
  وابستگی تزریق و الگوی طراحی استفاده شده قابل مشاهده است.
  تمام فیلدها با نوع و modifier نمایش داده شده‌اند.
  این سطح برای پیاده‌سازی مستقیم کد قابل استفاده است.`,
    level: 3,
    code: `@startuml
' نمودار کلاس سطح ۳ - پیاده‌سازی کامل
skinparam classAttributeIconSize 0

title سامانه تحلیل تکنیکال مالی ایران\\nنمودار کلاس - سطح ۳: پیاده‌سازی

abstract class BaseEngine {
  #logger: Logger
  #config: EngineConfig
  +{abstract} initialize(config: EngineConfig): Promise<void>
  +{abstract} shutdown(): Promise<void>
  #validateInput(data: MarketData): boolean
}

class TAEngine {
  -_indicators: Map<string, IndicatorFn>
  -_candlesticks: Candlestick[]
  -_results: AnalysisResult[]
  -_regimeEngine: RegimeEngine
  -_srAnalyzer: SRAnalyzer
  -_volumeProfile: VolumeProfile
  -_patterns: CandlestickPatterns
  +constructor(config: EngineConfig)
  +analyze(symbol: string, period: Period): Promise<AnalysisResult>
  +calcTrend(data: number[]): TrendDirection
  +linearRegression(x: number[], y: number[]): RegressionResult
  +getIndicator(name: string): IndicatorFn | null
  +listIndicators(): string[]
  +computeRSI(candles: Candlestick[], period: number): number[]
  +computeMACD(candles: Candlestick[], fast: number, slow: number, signal: number): MACDResult
  +computeBollinger(candles: Candlestick[], period: number, stdDev: number): BollingerResult
  +computeStochastic(candles: Candlestick[], kPeriod: number, dPeriod: number): StochasticResult
  +computeADX(candles: Candlestick[], period: number): number
  +computeATR(candles: Candlestick[], period: number): number
  -preprocessData(raw: RawData): Candlestick[]
  -cacheResult(key: string, result: AnalysisResult): void
}

class RegimeEngine {
  -_regimes: Regime[]
  -_transitionMatrix: number[][]
  -_fuzzySets: FuzzySet[]
  -_currentRegime: Regime | null
  +constructor(config: RegimeConfig)
  +detectRegime(marketData: MarketData): Promise<RegimeResult>
  +fuzzyMembership(value: number, set: FuzzySet): number
  +markovTransition(current: Regime, next: Regime): number
  +weightedVote(regimes: RegimeResult[]): RegimeResult
  +getCurrentRegime(): Regime | null
  +getTransitionMatrix(): number[][]
  -initializeFuzzySets(): FuzzySet[]
  -computeTransitionProb(history: Regime[]): number[][]
}

class DecisionGraph {
  -_nodes: Map<string, GraphNode>
  -_edges: GraphEdge[]
  -_adjacency: Map<string, Set<string>>
  -_weights: Map<string, number>
  +constructor()
  +buildGraph(regime: RegimeResult, analysis: AnalysisResult): void
  +computePaths(start: string, end: string): Path[]
  +normalizeWeights(): void
  +addNode(node: GraphNode): void
  +addEdge(from: string, to: string, weight: number): void
  +getNode(id: string): GraphNode | undefined
  +getEdge(from: string, to: string): GraphEdge | undefined
  +topologicalSort(): string[]
  +shortestPath(source: string, target: string): Path
  -validateAcyclic(): boolean
  -propagateWeights(): void
}

class MLEngine {
  -_model: LogisticRegression
  -_cache: WeightsCache
  -_featureNames: string[]
  -_bayesianWeights: BayesianWeights
  +constructor(modelPath: string)
  +trainAdaptive(features: Feature[][], labels: number[]): TrainingResult
  +predict(features: Feature[]): PredictionResult
  +getCachedWeights(modelId: string): Weights | null
  +updateModel(data: TrainingData): Promise<void>
  +evaluate(testData: TestData[]): EvaluationMetrics
  +featureImportance(): Map<string, number>
  -preprocessFeatures(raw: Feature[][]): Feature[][]
  -splitTrainTest(data: Data[], ratio: number): SplitResult
  -saveModel(path: string): Promise<void>
  -loadModel(path: string): Promise<void>
}

class SRAnalyzer {
  -_levels: SRLevel[]
  -_strengthThreshold: number
  -_mlOptimizer: MLEngine
  +constructor(threshold: number)
  +detectLevels(candles: Candlestick[], method: SRMethod): SRLevel[]
  +mlOptimize(levels: SRLevel[], features: Feature[]): SRLevel[]
  +computeStrength(level: SRLevel, candles: Candlestick[]): number
  +mergeLevels(levels: SRLevel[], tolerance: number): SRLevel[]
  +classifyLevels(levels: SRLevel[]): ClassifiedSR
  +getNearestLevels(price: number, count: number): SRLevel[]
  -calculateTouchCount(level: number, candles: Candlestick[]): number
  -computeVolumeAtLevel(level: number, profile: VolumeProfile): number
}

class AIPostProcessor {
  -_codePatterns: RegExp[]
  -_persianRules: PersianFixRule[]
  +constructor()
  +stripCodes(text: string): string
  +fixPersian(text: string): string
  +validatePrices(text: string, currentPrice: number): ValidationResult
  +fixDirection(text: string, trend: TrendDirection): string
  +process(text: string, context: AIContext): string
  -applyPersianTypographics(text: string): string
  -normalizeNumbers(text: string): string
  -fixZwnj(text: string): string
}

class ZaiShared {
  -_client: ZAIClient
  -_rateLimiter: RateLimiter
  -_cache: ResponseCache
  +constructor(apiKey: string)
  +dedicatedAIChatCompletion(params: ChatParams): Promise<ChatResponse>
  +rateLimitedPageReader(url: string, opts?: ReaderOpts): Promise<PageContent>
  +getZai(): ZAIClient
  +setRateLimit(rps: number): void
  +clearCache(): void
  -enforceRateLimit(): Promise<void>
  -cacheResponse(key: string, response: ChatResponse): void
  -handleError(error: APIError): never
}

class ProbabilityTrend {
  -_cdf: Map<number, number>
  -_trend: TrendResult
  +constructor()
  +calculateCDF(data: number[]): Map<number, number>
  +buildTrend(cdf: Map<number, number>): TrendResult
  +getInterpretation(trend: TrendResult): PersianInterpretation
  +getConfidence(): number
  -fitDistribution(data: number[]): DistributionFit
}

class BayesianWeights {
  -_prior: Map<string, number>
  -_posterior: Map<string, number>
  -_likelihood: Map<string, number>
  +constructor(prior: Map<string, number>)
  +updateWeights(evidence: Evidence): Map<string, number>
  +prior(): Map<string, number>
  +posterior(): Map<string, number>
  -computeLikelihood(evidence: Evidence): Map<string, number>
  -normalize(weights: Map<string, number>): Map<string, number>
}

class VolumeProfile {
  -_bins: VolumeBin[]
  -_pocPrice: number
  +constructor(binSize: number)
  +approximate(candles: Candlestick[]): VolumeBin[]
  +countTouch(price: number, tolerance: number): number
  +poc(): number
  +getVA(high: boolean): number
  -binCandles(candles: Candlestick[]): VolumeBin[]
}

class CandlestickPatterns {
  -_detected: PatternResult[]
  +constructor()
  +detectClassic(candles: Candlestick[]): PatternResult[]
  +detectHarmonic(candles: Candlestick[], minLen: number): PatternResult[]
  +detectElliott(candles: Candlestick[]): PatternResult[]
  +getPattern(name: string): PatternResult | undefined
  -matchDoji(candle: Candlestick): boolean
  -matchEngulfing(prev: Candlestick, curr: Candlestick): boolean
  -matchHammer(candle: Candlestick): boolean
}

BaseEngine <|-- TAEngine
BaseEngine <|-- RegimeEngine
BaseEngine <|-- MLEngine

TAEngine *-- "1" RegimeEngine : _regimeEngine
TAEngine *-- "1" SRAnalyzer : _srAnalyzer
TAEngine *-- "1" VolumeProfile : _volumeProfile
TAEngine *-- "1" CandlestickPatterns : _patterns

DecisionGraph o-- "1" MLEngine
DecisionGraph o-- "0..*" ProbabilityTrend

MLEngine *-- "1" BayesianWeights : _bayesianWeights
SRAnalyzer --> "0..1" MLEngine : _mlOptimizer

AIPostProcessor --> "1" ZaiShared

@enduml`,
  },
  {
    id: 'uml-object-l1',
    title: `نمودار شیء - نشست تحلیل نمونه`,
    description: `این نمودار یک نشست تحلیل نمونه را با نمونه‌های واقعی نمایش می‌دهد.
  کاربر نماد «فولاد» را برای بازه روزانه تحلیل می‌کند.
  TAEngine با پارامترهای مشخص شده فعال است.
  RegimeEngine رژیم «روند صعودی» را تشخیص می‌دهد.
  DecisionGraph با ۳۴ گره و ۵۵ یال ساخته شده است.
  SRAnalyzer سطوح ۸,۵۰۰ و ۹,۲۰۰ را شناسایی کرده است.
  MLEngine مدل لجستیک‌رجression را با وزن‌های کش‌شده اجرا می‌کند.`,
    level: 1,
    code: `@startuml
' نمودار شیء سطح ۱ - نشست تحلیل نمونه
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار شیء - سطح ۱: نشست تحلیل نمونه

object session {
  symbol = "فولاد"
  period = "daily"
  startTime = "1403/12/15 09:00"
  status = "completed"
}

object taEngine {
  indicators = 63
  candlestickCount = 250
  lastAnalysis = "1403/12/15"
}

object regimeEngine {
  currentRegime = "روند صعودی"
  confidence = 0.78
  fuzzyMembership = 0.82
}

object decisionGraph {
  nodeCount = 34
  edgeCount = 55
  bestPath = "N1→N5→N12→N28→N34"
  pathWeight = 0.85
}

object mlEngine {
  modelType = "LogisticRegression"
  accuracy = 0.74
  cachedWeightsId = "w_v4_2024"
}

object srAnalyzer {
  supportLevels = [8500, 8200, 7900]
  resistanceLevels = [9200, 9500, 9800]
  nearestSupport = 8500
  nearestResistance = 9200
}

object result {
  trend = "صعودی"
  strength = 0.72
  recommendation = "خرید"
  confidence = 0.81
}

session --> taEngine : استفاده
taEngine --> regimeEngine : تشخیص رژیم
taEngine --> srAnalyzer : شناسایی سطوح
taEngine --> decisionGraph : ساخت گراف
decisionGraph --> mlEngine : پیش‌بینی
taEngine --> result : تولید نتیجه

note right of session
  نشست تحلیل نماد فولاد
  در تاریخ ۱۵ اسفند ۱۴۰۳
  با نتیجه نهایی «خرید»
end note

@enduml`,
  },
  {
    id: 'uml-object-l2',
    title: `نمودار شیء - محاسبه احتمال`,
    description: `نمودار نمونه‌ها در حین محاسبه روند احتمالی.
  ProbabilityTrend توزیع تجمعی را محاسبه می‌کند.
  BayesianWeights وزن‌های پیشین و پسین را نگهداری می‌کند.
  CompositeScores نمرات مرکب از چند موتور محاسبه می‌کند.
  AnalysisMLSelector ترکیب بهینه روش‌ها را انتخاب می‌کند.
  مقادیر واقعی هر شیء در لحظه محاسبه نمایش داده شده است.`,
    level: 2,
    code: `@startuml
' نمودار شیء سطح ۲ - محاسبه احتمال
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار شیء - سطح ۲: محاسبه احتمال

object probTrend {
  cdfPoints = 50
  distribution = "normal"
  trendValue = 0.68
  interpretation = "احتمال روند صعودی متوسط"
}

object bayesianWeights {
  prior = {RSI: 0.15, MACD: 0.20, ADX: 0.12, SR: 0.18, Volume: 0.10, Pattern: 0.25}
  posterior = {RSI: 0.18, MACD: 0.22, ADX: 0.10, SR: 0.20, Volume: 0.08, Pattern: 0.22}
  evidence = "last_30_candles"
}

object compositeScores {
  trendStrength = 0.72
  srStrength = 0.65
  volumeStrength = 0.58
  patternStrength = 0.81
  overallScore = 0.69
}

object mlSelector {
  selectedCombination = "RSI+MACD+SR+Pattern"
  selectedMethods = ["classic", "ml_hybrid"]
  score = 0.88
}

object cdfData {
  x = [-2.0, -1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0]
  y = [0.02, 0.07, 0.16, 0.31, 0.50, 0.69, 0.84, 0.93, 0.98]
}

probTrend --> cdfData : داده‌های CDF
bayesianWeights --> compositeScores : وزن‌دهی
mlSelector --> compositeScores : روش‌های انتخابی
compositeScores --> probTrend : نمرات ورودی

note bottom of bayesianWeights
  وزن‌های بیزی پسین پس از
  مشاهده ۳۰ کندل آخر به‌روز شده
  الگوی SR و Pattern بیشترین وزن را دارند
end note

@enduml`,
  },
  {
    id: 'uml-object-l3',
    title: `نمودار شیء - وضعیت تولید متن هوش مصنوعی`,
    description: `نمودار وضعیت دقیق اشیاء در حین تولید متن تحلیل هوش مصنوعی.
  MSLV4 با ترکیب مکتب×سبک×لحن = ۶×۵×۶ = ۱۸۰ حالت انتخاب می‌کند.
  AIPostProcessor متن خام خروجی AI را پردازش می‌کند.
  ZaiShared فراخوانی API را با محدودکننده نرخ مدیریت می‌کند.
  وضعیت هر شیء شامل مقادیر فیلدها در لحظه اجراست.
  توالی پردازش از انتخاب سبک تا خروجی نهایی قابل ردیابی است.`,
    level: 3,
    code: `@startuml
' نمودار شیء سطح ۳ - وضعیت تولید متن AI
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار شیء - سطح ۳: وضعیت تولید متن AI

object mslv4 {
  school = "کلاسیک_تکنیکال"
  style = "رسمی_بازار"
  tone = "محافظه‌کار"
  schoolIdx = 2
  styleIdx = 1
  toneIdx = 4
  combinationId = "2-1-4"
  totalCombinations = 180
}

object aiPostProcessor {
  rawInput = "## تحلیل ## نماد فولاد روند **صعودی** دارد"
  afterStripCodes = "تحلیل نماد فولاد روند صعودی دارد"
  afterFixPersian = "تحلیل نماد فولاد روند صعودی دارد"
  afterValidate = "قیمت ۸۹۰۰ در محدوده معتبر"
  afterFixDirection = "روند صعودی با حرکت رو به بالا"
  codePatterns = 5
  persianRules = 12
}

object zaiShared {
  apiKey = "sk-***...***"
  rateLimit = 10
  currentRPS = 3.2
  cacheSize = 256
  lastCallTime = "1403/12/15 10:32:15"
  pendingRequests = 0
}

object chatParams {
  model = "gpt-4o-mini"
  temperature = 0.7
  maxTokens = 2048
  systemPrompt = "شما تحلیلگر تکنیکال هستید..."
  userMessage = "تحلیل فولاد با رژیم صعودی..."
}

object chatResponse {
  id = "chatcmpl-abc123"
  content = "## تحلیل ## نماد فولاد..."
  tokensUsed = 487
  finishReason = "stop"
  latency = 1240
}

mslv4 --> chatParams : تنظیم پرامپت
chatParams --> zaiShared : فراخوانی API
zaiShared --> chatResponse : پاسخ خام
chatResponse --> aiPostProcessor : پردازش خروجی

note right of mslv4
  ترکیب مکتب×سبک×لحن
  ۶ × ۵ × ۶ = ۱۸۰ حالت
  کد ترکیب فعلی: 2-1-4
end note

note left of aiPostProcessor
  خط لوله پردازش:
  ۱. حذف کدهای مارکداون
  ۲. اصلاح نیم‌فاصله و تایپوگرافی
  ۳. اعتبارسنجی قیمت‌ها
  ۴. اصلاح جهت روند
end note

@enduml`,
  },
  {
    id: 'uml-component-l1',
    title: `نمودار مؤلفه - لایه‌های اصلی`,
    description: `این نمودار شش مؤلفه اصلی سامانه را در لایه‌های منطقی نمایش می‌دهد.
  لایه ارائه شامل رابط کاربری وب و نمودارها است.
  لایه API اندپوینت‌های REST را فراهم می‌کند.
  لایه تحلیل هسته تحلیل تکنیکال و گراف تصمیم را شامل می‌شود.
  لایه یادگیری ماشین مدل‌های ML و بیزی را مدیریت می‌کند.
  لایه داده منابع داده بورس تهران را جمع‌آوری می‌کند.
  لایه زیرساخت خدمات مشترک و هوش مصنوعی را فراهم می‌کند.`,
    level: 1,
    code: `@startuml
' نمودار مؤلفه سطح ۱ - لایه‌های اصلی
skinparam componentStyle uml2

title سامانه تحلیل تکنیکال مالی ایران\\nنمودار مؤلفه - سطح ۱: لایه‌های اصلی

package "لایه ارائه\\nPresentation" {
  component [رابط کاربری وب\\nWeb UI] as UI
  component [نمودارها و گراف‌ها\\nCharts & Graphs] as Charts
}

package "لایه API" {
  component [اندپوینت‌های REST\\nREST Endpoints] as API
}

package "لایه تحلیل\\nAnalysis" {
  component [موتور تحلیل تکنیکال\\nTA Engine] as TA
  component [گراف تصمیم‌گیری\\nDecision Graph] as DG
  component [شناسایی S/R\\nSR Analyzer] as SR
}

package "لایه یادگیری ماشین\\nML" {
  component [موتور ML\\nML Engine] as ML
  component [وزن‌دهی بیزی\\nBayesian Weights] as BW
}

package "لایه داده\\nData" {
  component [منابع داده بورس\\nMarket Data Sources] as Data
}

package "لایه زیرساخت\\nInfrastructure" {
  component [هوش مصنوعی مشترک\\nShared AI] as AI
  component [پردازش‌گر متن\\nPost Processor] as PP
}

UI --> API : درخواست HTTP
Charts --> API : داده نمودار
API --> TA : تحلیل
API --> DG : تصمیم
API --> SR : سطوح
TA --> ML : پیش‌بینی
DG --> ML : وزن‌ها
ML --> BW : به‌روزرسانی
TA --> Data : کندل‌ها
SR --> Data : قیمت‌ها
API --> AI : تولید متن
AI --> PP : پردازش

@enduml`,
  },
  {
    id: 'uml-component-l2',
    title: `نمودار مؤلفه - زیرمؤلفه‌ها`,
    description: `نمودار زیرمؤلفه‌های هر لایه با ارتباطات داخلی و خارجی.
  رابط کاربری شامل داشبورد، صفحه تحلیل و صفحه راهنما است.
  API شامل اندپوینت‌های تحلیل، نمادها و شاخص‌ها است.
  لایه تحلیل شامل موتورها، شناسایی الگو و حجم معاملات است.
  منابع داده شامل TSE، TSETMC، TGJU و Yahoo است.
  زیرساخت شامل محدودکننده نرخ، کش و لاگ است.`,
    level: 2,
    code: `@startuml
' نمودار مؤلفه سطح ۲ - زیرمؤلفه‌ها
skinparam componentStyle uml2

title سامانه تحلیل تکنیکال مالی ایران\\nنمودار مؤلفه - سطح ۲: زیرمؤلفه‌ها

package "رابط کاربری" {
  component [داشبورد\\nDashboard] as Dash
  component [صفحه تحلیل\\nAnalysis Page] as AnaPage
  component [صفحه راهنما\\nHelp Page] as HelpPage
  component [نمودار شمعی\\nCandlestick Chart] as Chart
  component [گراف تصمیم\\nDecision Viz] as GraphViz
}

package "API" {
  component [/api/analysis] as ApiAnalysis
  component [/api/instruments] as ApiInstr
  component [/api/indices] as ApiIndices
  component [/api/ai] as ApiAI
}

package "تحلیل" {
  component [TAEngine] as TA
  component [RegimeEngine] as RE
  component [DecisionGraph] as DG
  component [SRAnalyzer] as SR
  component [CandlestickPatterns] as CP
  component [VolumeProfile] as VP
  component [ProbabilityTrend] as PT
  component [CompositeScores] as CS
}

package "یادگیری ماشین" {
  component [MLEngine] as ML
  component [BayesianWeights] as BW
  component [AnalysisMLSelector] as MLS
}

package "منابع داده" {
  component [TSEApi] as TSE
  component [TsetmcIndexApi] as TSETMC
  component [TgjuApi] as TGJU
  component [YahooApi] as YAHOO
}

package "زیرساخت" {
  component [ZaiShared] as ZAI
  component [AIPostProcessor] as PP
  component [MSLV4] as MSL
  component [RateLimiter] as RL
  component [Cache] as Cache
  component [Logger] as Log
}

Dash --> ApiAnalysis
AnaPage --> ApiAnalysis
AnaPage --> ApiInstr
HelpPage --> ApiInstr
Chart --> ApiAnalysis
GraphViz --> ApiAnalysis

ApiAnalysis --> TA
ApiAnalysis --> DG
ApiAnalysis --> CS
ApiInstr --> TSE
ApiIndices --> TSETMC
ApiAI --> ZAI

TA --> RE
TA --> SR
TA --> CP
TA --> VP
TA --> PT
DG --> ML
CS --> TA
CS --> SR

ML --> BW
ML --> MLS

TSE --> RL
TSETMC --> RL
TGJU --> RL
YAHOO --> RL

TSE --> Cache
TSETMC --> Cache

ZAI --> PP
ZAI --> MSL
ZAI --> RL

RL --> Log

@enduml`,
  },
  {
    id: 'uml-component-l3',
    title: `نمودار مؤلفه - اینترفیس‌ها`,
    description: `نمودار اینترفیس‌های فراهم‌شده و موردنیاز با امضای متدها.
  هر مؤلفه اینترفیس‌هایی که فراهم و نیاز دارد مشخص شده است.
  IAnalysisService تحلیل کامل و جزئی را فراهم می‌کند.
  IDataProvider داده بازار را از منابع مختلف می‌خواند.
  IAIService تکمیل چت هوش مصنوعی را فراهم می‌کند.
  IMLService آموزش و پیش‌بینی مدل را فراهم می‌کند.
  وابستگی‌ها فقط از طریق اینترفیس‌ها برقرار می‌شود.`,
    level: 3,
    code: `@startuml
' نمودار مؤلفه سطح ۳ - اینترفیس‌ها
skinparam componentStyle uml2

title سامانه تحلیل تکنیکال مالی ایران\\nنمودار مؤلفه - سطح ۳: اینترفیس‌ها

interface IAnalysisService <<provided>> {
  +analyze(symbol: string, period: Period): Promise<AnalysisResult>
  +getIndicators(symbol: string): Promise<IndicatorResult[]>
  +getTrend(symbol: string): Promise<TrendResult>
}

interface IRegimeService <<provided>> {
  +detectRegime(data: MarketData): Promise<RegimeResult>
  +getCurrentRegime(): Regime | null
}

interface IGraphService <<provided>> {
  +buildGraph(regime: RegimeResult): DecisionGraph
  +computePaths(): Path[]
}

interface ISRService <<provided>> {
  +detectLevels(symbol: string): Promise<SRLevel[]>
  +computeStrength(level: SRLevel): number
}

interface IMLService <<provided>> {
  +trainAdaptive(features: Feature[][], labels: number[]): TrainingResult
  +predict(features: Feature[]): PredictionResult
}

interface IDataProvider <<provided>> {
  +fetchCandlesticks(symbol: string, period: Period): Promise<Candlestick[]>
  +fetchSymbols(): Promise<Symbol[]>
  +fetchIndices(): Promise<Index[]>
}

interface IAIService <<provided>> {
  +chatCompletion(params: ChatParams): Promise<ChatResponse>
  +processText(text: string, context: AIContext): Promise<string>
}

interface ICacheService <<required>> {
  +get(key: string): Promise<T | null>
  +set(key: string, value: T, ttl?: number): Promise<void>
  +invalidate(pattern: string): Promise<void>
}

interface IRateLimiter <<required>> {
  +acquire(): Promise<void>
  +release(): void
  +getRemaining(): number
}

component [TAEngine] as TA
component [RegimeEngine] as RE
component [DecisionGraph] as DG
component [SRAnalyzer] as SR
component [MLEngine] as ML
component [TSEApi] as TSE
component [ZaiShared] as ZAI
component [CacheManager] as CM
component [RateLimiterService] as RLS

TA -up- IAnalysisService
TA ..> IDataProvider
TA ..> ICacheService

RE -up- IRegimeService

DG -up- IGraphService
DG ..> IMLService

SR -up- ISRService
SR ..> IMLService

ML -up- IMLService
ML ..> ICacheService

TSE -up- IDataProvider
TSE ..> IRateLimiter

ZAI -up- IAIService
ZAI ..> IRateLimiter

CM -up- ICacheService
RLS -up- IRateLimiter

@enduml`,
  },
  {
    id: 'uml-deployment-l1',
    title: `نمودار استقرار - گره‌های فیزیکی`,
    description: `نمودار گره‌های فیزیکی سامانه و ارتباطات بین آن‌ها.
  مرورگر کاربر نقطه ورود به سامانه است.
  سرور Next.js میزبان برنامه و API است.
  سرور PlantUML برای رندر نمودارها استفاده می‌شود.
  منابع داده بورس تهران خارج از سامانه هستند.
  ارتباطات با پروتکل‌های مشخص شده‌اند.`,
    level: 1,
    code: `@startuml
' نمودار استقرار سطح ۱ - گره‌های فیزیکی
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار استقرار - سطح ۱: گره‌های فیزیکی

node "مرورگر کاربر\\nBrowser" as browser {
  artifact [SPA Client]
}

node "سرور Next.js\\nApplication Server" as appserver {
  artifact [Next.js App]
}

node "سرور PlantUML\\nDiagram Renderer" as plantuml {
  artifact [PlantUML Server]
}

node "منابع داده بورس\\nMarket Data Sources" as datasource {
  artifact [TSE API]
  artifact [TSETMC API]
  artifact [TGJU API]
  artifact [Yahoo API]
}

node "سرویس هوش مصنوعی\\nAI Service" as aiservice {
  artifact [ZAI API]
}

browser --> appserver : HTTPS
appserver --> plantuml : HTTP
appserver --> datasource : HTTPS/REST
appserver --> aiservice : HTTPS/API

note right of browser
  مرورگر کاربر نقطه ورود
  به سامانه تحلیلی است
end note

note left of datasource
  منابع داده خارجی بورس
  تهران و بازارهای جهانی
end note

@enduml`,
  },
  {
    id: 'uml-deployment-l2',
    title: `نمودار استقرار - تخصیص مؤلفه‌ها`,
    description: `نمودار تخصیص مؤلفه‌ها به گره‌ها با پروتکل‌های ارتباطی.
  هر گره مؤلفه‌هایی که روی آن اجرا می‌شوند را شامل می‌شود.
  سرور Next.js شامل API، تحلیل، ML و زیرساخت است.
  منابع داده با پروتکل‌های مختلف ارتباط برقرار می‌کنند.
  مسیر ارتباطی از مرورگر تا منابع داده قابل ردیابی است.`,
    level: 2,
    code: `@startuml
' نمودار استقرار سطح ۲ - تخصیص مؤلفه‌ها
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار استقرار - سطح ۲: تخصیص مؤلفه‌ها

node "مرورگر کاربر\\nBrowser" as browser {
  artifact [React SPA] as SPA
  artifact [Recharts] as Recharts
  artifact [D3.js Visuals] as D3
}

node "سرور Next.js\\n:3000" as nextjs {
  artifact [API Routes] as API
  artifact [TAEngine] as TA
  artifact [RegimeEngine] as RE
  artifact [DecisionGraph] as DG
  artifact [SRAnalyzer] as SR
  artifact [MLEngine] as ML
  artifact [AIPostProcessor] as PP
  artifact [MSLV4] as MSL
  artifact [ZaiShared] as ZAI
}

node "سرور PlantUML\\n:8080" as plantuml {
  artifact [PlantUML Jar] as PumlJar
}

node "TSE Server\\ntsetmc.com" as tse {
  artifact [TSE REST API] as TSEApi
}

node "TSETMC Server\\ntsetmc.com" as tsetmc {
  artifact [TSETMC API] as TSETMCApi
}

node "TGJU Server\\ntgju.org" as tgju {
  artifact [TGJU API] as TGJUApi
}

node "Yahoo Server\\nquery1.finance.yahoo.com" as yahoo {
  artifact [Yahoo API] as YahooApi
}

node "ZAI Server\\napi.z-ai.com" as zai {
  artifact [ZAI API] as ZAIApi
}

browser "1" -down-> "1" nextjs : HTTPS/JSON\\nport 443→3000
nextjs "1" -down-> "1" plantuml : HTTP\\nport 3000→8080
nextjs "1" -down-> "1" tse : HTTPS/REST\\nrate: 1 req/s
nextjs "1" -down-> "1" tsetmc : HTTPS/REST\\nrate: 2 req/s
nextjs "1" -down-> "1" tgju : HTTPS/REST\\nrate: 1 req/s
nextjs "1" -down-> "1" yahoo : HTTPS/REST\\nrate: 0.5 req/s
nextjs "1" -down-> "1" zai : HTTPS/REST\\nrate: 10 req/s

@enduml`,
  },
  {
    id: 'uml-deployment-l3',
    title: `نمودار استقرار - جزئیات پیکربندی`,
    description: `نمودار با جزئیات کامل پیکربندی شامل پورت، سیستم‌عامل و نسخه.
  هر گره با مشخصات سخت‌افزاری و نرم‌افزاری نمایش داده شده است.
  محیط‌های اجرایی با نسخه‌های دقیق مشخص هستند.
  تنظیمات شبکه شامل پورت‌ها و پروتکل‌ها قابل مشاهده است.
  این سطح برای مدیران سیستم و DevOps قابل استفاده است.`,
    level: 3,
    code: `@startuml
' نمودار استقرار سطح ۳ - جزئیات پیکربندی
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار استقرار - سطح ۳: جزئیات پیکربندی

node "مرورگر کاربر\\nChrome 120+ / Firefox 115+ / Safari 17+\\nOS: Windows 11 / macOS 14 / Ubuntu 22.04\\nRAM: 8GB+ | Screen: 1920×1080+" as browser {
  artifact "React 19 SPA\\nBundle: ~450KB gzipped\\nWebpack 5 Turbopack" as SPA
  artifact "Recharts 2.12\\nD3.js 7.9\\n@xyflow/react 12" as VizLibs
}

node "سرور Next.js 16\\nUbuntu 22.04 LTS | Node.js 22.x | Bun 1.2\\nCPU: 4 vCPU | RAM: 8GB | SSD: 50GB\\nIP: 10.0.1.10 | Port: 3000" as nextjs {
  artifact "Next.js 16 App Router\\nTypeScript 5.7\\nTailwind CSS 4\\nPrisma ORM 6" as AppCore
  artifact "API Routes (REST)\\n/api/analysis → POST\\n/api/instruments → GET\\n/api/indices → GET\\n/api/ai → POST" as APIRoutes
  artifact "TAEngine v4.2\\n63 indicators\\nWASM-accelerated" as TA
  artifact "MLEngine v3.1\\nLogisticRegression\\nWeights Cache: 256 entries" as ML
  artifact "ZaiShared v2.8\\nRate Limit: 10 RPS\\nCache TTL: 300s" as ZAI
}

node "سرور PlantUML\\nUbuntu 22.04 | Java 21 | Jetty 12\\nCPU: 2 vCPU | RAM: 4GB\\nIP: 10.0.1.20 | Port: 8080" as plantuml {
  artifact "PlantUML 1.2024.3\\nGraphviz 12.0\\nMax diagram size: 4096×4096" as PumlSrv
}

node "TSE Server\\ntsetmc.com:443\\nREST API | JSON\\nRate Limit: 1 req/s\\nTimeout: 30s" as tse

node "TSETMC Server\\ntsetmc.com:443\\nDirect Fetch + API\\nRate Limit: 2 req/s\\nTimeout: 15s" as tsetmc

node "TGJU Server\\ntgju.org:443\\nREST + Scraping\\nRate Limit: 1 req/s\\nTimeout: 20s" as tgju

node "Yahoo Finance\\nquery1.finance.yahoo.com:443\\nv8 API | JSON\\nRate Limit: 0.5 req/s\\nTimeout: 10s" as yahoo

node "ZAI API Server\\napi.z-ai.com:443\\nOpenAI-compatible API\\nRate Limit: 10 RPS\\nModel: gpt-4o-mini\\nMax Tokens: 4096" as zai

browser "HTTPS" -down-> nextjs : "443 → 3000\\nH2 with keep-alive\\nCORS: enabled"
nextjs "HTTP" -down-> plantuml : "3000 → 8080\\nPlantUML text POST\\nPNG/SVG response"
nextjs "HTTPS" -down-> tse : "REST/JSON\\nX-API-Key header\\nRetry: 3 with backoff"
nextjs "HTTPS" -down-> tsetmc : "Direct+API\\nCookie-based auth\\nRetry: 3"
nextjs "HTTPS" -down-> tgju : "REST+Scrape\\nUser-Agent rotation\\nRetry: 2"
nextjs "HTTPS" -down-> yahoo : "v8 API\\ncrumb-based auth\\nRetry: 2"
nextjs "HTTPS" -down-> zai : "Bearer token auth\\nStreaming: supported\\nRetry: 3 with backoff"

@enduml`,
  },
  {
    id: 'uml-package-l1',
    title: `نمودار بسته - بسته‌های اصلی`,
    description: `نمودار بسته‌های اصلی سامانه با وابستگی‌های بین آن‌ها.
  بسته app شامل صفحات و لایه‌های برنامه است.
  بسته lib شامل کتابخانه‌های تحلیلی و ML است.
  بسته components شامل مؤلفه‌های رابط کاربری است.
  بسته api شامل اندپوینت‌های سرویس‌دهنده است.
  وابستگی‌ها از بالا به پایین (از رابط کاربری تا داده) است.`,
    level: 1,
    code: `@startuml
' نمودار بسته سطح ۱ - بسته‌های اصلی
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار بسته - سطح ۱: بسته‌های اصلی

package "app" <<application>> {
  note: صفحات Next.js App Router
}

package "lib" <<library>> {
  note: کتابخانه‌های تحلیلی و ML
}

package "components" <<ui>> {
  note: مؤلفه‌های رابط کاربری React
}

package "api" <<service>> {
  note: اندپوینت‌های REST API
}

app --> components : استفاده
app --> api : فراخوانی
api --> lib : استفاده
components --> lib : داده تحلیلی

note right of app
  بسته برنامه اصلی
  شامل صفحات و لایه‌ها
  app/analysis, app/help
end note

note right of lib
  بسته کتابخانه‌ها
  شامل تمام موتورهای
  تحلیلی و یادگیری ماشین
end note

@enduml`,
  },
  {
    id: 'uml-package-l2',
    title: `نمودار بسته - زیربسته‌ها`,
    description: `نمودار زیربسته‌های هر بسته اصلی با وابستگی‌های داخلی.
  lib/ta شامل موتور تحلیل تکنیکال و شناسایی الگو است.
  lib/ml شامل موتور ML و وزن‌دهی بیزی است.
  lib/ai شامل پردازش‌گر متن و انتخاب سبک است.
  lib/data شامل منابع داده بورس است.
  api/analysis و api/instruments اندپوینت‌های اصلی هستند.`,
    level: 2,
    code: `@startuml
' نمودار بسته سطح ۲ - زیربسته‌ها
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار بسته - سطح ۲: زیربسته‌ها

package "app" {
  package "app/analysis" {
    note: صفحه تحلیل نماد
  }
  package "app/help" {
    note: صفحه راهنما
  }
  package "app/scenarios" {
    note: صفحه سناریوها
  }
}

package "lib" {
  package "lib/ta" {
    note: TAEngine, RegimeEngine\\nProbabilityTrend, CompositeScores
  }
  package "lib/ml" {
    note: MLEngine, BayesianWeights\\nAnalysisMLSelector
  }
  package "lib/ai" {
    note: AIPostProcessor, MSLV4\\nZaiShared
  }
  package "lib/data" {
    note: TSEApi, TsetmcIndexApi\\nTgjuApi, YahooApi
  }
  package "lib/sr" {
    note: SRAnalyzer, VolumeProfile
  }
  package "lib/graph" {
    note: DecisionGraph\\nCandlestickPatterns
  }
}

package "components" {
  package "components/analysis" {
    note: کارت تحلیل، نوار اندیکاتور
  }
  package "components/charts" {
    note: نمودار شمعی، گراف تصمیم
  }
  package "components/ui" {
    note: shadcn/ui primitives
  }
}

package "api" {
  package "api/analysis" {
    note: POST /api/analysis
  }
  package "api/instruments" {
    note: GET /api/instruments
  }
  package "api/indices" {
    note: GET /api/indices
  }
  package "api/ai" {
    note: POST /api/ai
  }
}

"app/analysis" --> "api/analysis"
"app/analysis" --> "api/instruments"
"app/help" --> "api/instruments"
"app/scenarios" --> "api/analysis"

"api/analysis" --> "lib/ta"
"api/analysis" --> "lib/graph"
"api/analysis" --> "lib/sr"
"api/analysis" --> "lib/ml"
"api/instruments" --> "lib/data"
"api/indices" --> "lib/data"
"api/ai" --> "lib/ai"

"lib/ta" --> "lib/data"
"lib/ta" --> "lib/ml"
"lib/graph" --> "lib/ml"
"lib/sr" --> "lib/data"
"lib/sr" --> "lib/ml"

"components/analysis" --> "lib/ta"
"components/charts" --> "lib/graph"

@enduml`,
  },
  {
    id: 'uml-package-l3',
    title: `نمودار بسته - وابستگی‌های واردات`,
    description: `نمودار وابستگی‌های واردات و ادغام بین کلاس‌های خاص.
  هر فلش نشان‌دهنده واردات یک کلاس از بسته دیگر است.
  TAEngine از چندین بسته واردات انجام می‌دهد.
  DecisionGraph مستقیماً به MLEngine وابسته است.
  SRAnalyzer برای بهینه‌سازی ML از MLEngine استفاده می‌کند.
  AIPostProcessor از ZaiShared و MSLV4 استفاده می‌کند.`,
    level: 3,
    code: `@startuml
' نمودار بسته سطح ۳ - وابستگی‌های واردات
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار بسته - سطح ۳: وابستگی‌های واردات

package "lib/ta" {
  class TAEngine
  class RegimeEngine
  class ProbabilityTrend
  class CompositeScores
  class CandlestickPatterns
}

package "lib/ml" {
  class MLEngine
  class BayesianWeights
  class AnalysisMLSelector
}

package "lib/ai" {
  class AIPostProcessor
  class MSLV4
  class ZaiShared
}

package "lib/sr" {
  class SRAnalyzer
  class VolumeProfile
}

package "lib/graph" {
  class DecisionGraph
}

package "lib/data" {
  class TSEApi
  class TsetmcIndexApi
  class TgjuApi
  class YahooApi
}

' وابستگی‌های واردات واقعی
TAEngine ..> RegimeEngine : import
TAEngine ..> SRAnalyzer : import
TAEngine ..> VolumeProfile : import
TAEngine ..> CandlestickPatterns : import
TAEngine ..> TSEApi : import
TAEngine ..> MLEngine : import

DecisionGraph ..> MLEngine : import
DecisionGraph ..> ProbabilityTrend : import
DecisionGraph ..> RegimeEngine : import

SRAnalyzer ..> MLEngine : import
SRAnalyzer ..> VolumeProfile : import
SRAnalyzer ..> TSEApi : import

CompositeScores ..> TAEngine : import
CompositeScores ..> SRAnalyzer : import

AIPostProcessor ..> ZaiShared : import
AIPostProcessor ..> MSLV4 : import

MLEngine ..> BayesianWeights : import
MLEngine ..> AnalysisMLSelector : import

ProbabilityTrend ..> CompositeScores : import

@enduml`,
  },
  {
    id: 'uml-composite-l1',
    title: `نمودار ساختار مرکب - ساختار داخلی TAEngine`,
    description: `نمودار ساختار داخلی مؤلفه TAEngine با بخش‌های همکار.
  TAEngine شامل RegimeEngine، SRAnalyzer و VolumeProfile به‌صورت ترکیب است.
  همچنین شامل CandlestickPatterns و ProbabilityTrend است.
  بخش‌ها از طریق پورت‌های داخلی با هم ارتباط برقرار می‌کنند.
  پورت marketData داده بازار را دریافت می‌کند.
  پورت analysisResult نتیجه تحلیل را منتشر می‌کند.`,
    level: 1,
    code: `@startuml
' نمودار ساختار مرکب سطح ۱ - ساختار داخلی TAEngine
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار ساختار مرکب - سطح ۱: ساختار داخلی TAEngine

class TAEngine {
  ' ساختار داخلی
  -- Ports --
  +in marketData : MarketData
  +out analysisResult : AnalysisResult
  +out trendSignal : TrendDirection
}

component "RegimeEngine" as RE
component "SRAnalyzer" as SR
component "VolumeProfile" as VP
component "CandlestickPatterns" as CP
component "ProbabilityTrend" as PT
component "IndicatorCalculator" as IC
component "ResultAggregator" as RA

rectangle TAEngine <<component>> {
  RE -down-> IC : regimeInfo
  SR -down-> IC : srLevels
  VP -right-> SR : volumeData
  CP -down-> IC : patterns
  IC -down-> PT : indicatorValues
  PT -down-> RA : trendData
  RA -down-> RA : aggregate
}

TAEngine::marketData --> RE
TAEngine::marketData --> SR
TAEngine::marketData --> VP
TAEngine::marketData --> CP
RA --> TAEngine::analysisResult
PT --> TAEngine::trendSignal

note right of TAEngine
  TAEngine به‌صورت ترکیب شامل
  ۵ بخش همکار است:
  • RegimeEngine: تشخیص رژیم
  • SRAnalyzer: سطوح S/R
  • VolumeProfile: پروفایل حجم
  • CandlestickPatterns: الگوها
  • ProbabilityTrend: روند احتمالی
end note

@enduml`,
  },
  {
    id: 'uml-composite-l2',
    title: `نمودار ساختار مرکب - بخش‌های DecisionGraph`,
    description: `نمودار بخش‌های همکار کلاس DecisionGraph.
  DecisionGraph شامل GraphBuilder، PathComputer و WeightNormalizer است.
  GraphBuilder گره‌ها و یال‌ها را بر اساس رژیم و تحلیل می‌سازد.
  PathComputer مسیرهای بهینه را محاسبه می‌کند.
  WeightNormalizer وزن‌های یال‌ها را نرمال‌سازی می‌کند.
  MLEngine به‌صورت نقش فراهم‌شده پیش‌بینی می‌کند.`,
    level: 2,
    code: `@startuml
' نمودار ساختار مرکب سطح ۲ - بخش‌های DecisionGraph
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار ساختار مرکب - سطح ۲: بخش‌های DecisionGraph

class DecisionGraph <<component>> {
  -- پورت‌های فراهم‌شده --
  +in regimeInput : RegimeResult
  +in analysisInput : AnalysisResult
  +out decisionOutput : DecisionPath
  +out confidenceOutput : number
  -- بخش‌های داخلی --
}

component "GraphBuilder" as GB {
  +buildFromRegime(regime: RegimeResult): void
  +addAnalysisNodes(analysis: AnalysisResult): void
  -nodeFactory: NodeFactory
  -edgeFactory: EdgeFactory
}

component "PathComputer" as PC {
  +computeAllPaths(): Path[]
  +shortestPath(source: string, target: string): Path
  +topologicalSort(): string[]
  -adjacencyList: Map
}

component "WeightNormalizer" as WN {
  +normalizeWeights(): void
  +applyDecay(factor: number): void
  +rebalance(): void
  -totalWeight: number
}

component "MLEngine\\n<<provided role>>" as MLRole {
  +predict(features: Feature[]): PredictionResult
}

rectangle DecisionGraph <<component>> {
  port "regimeInput" as regIn
  port "analysisInput" as anaIn
  port "decisionOutput" as decOut
  port "confidenceOutput" as confOut

  GB -down-> PC : rawGraph
  PC -down-> WN : weightedPaths
  WN -right-> MLRole : features
  MLRole -up-> WN : predictions

  regIn --> GB
  anaIn --> GB
  WN --> decOut
  WN --> confOut
}

note bottom of GB
  GraphBuilder گراف را با
  ۳۴ گره و ۵۵ یال می‌سازد
  بر اساس رژیم و تحلیل جاری
end note

note bottom of PC
  PathComputer مسیرهای
  تصمیم را محاسبه می‌کند
  با الگوریتم دیکسترا
end note

@enduml`,
  },
  {
    id: 'uml-composite-l3',
    title: `نمودار ساختار مرکب - اتصالات محاسبه احتمال`,
    description: `نمودار اتصالات و نقش‌ها در حین محاسبه احتمال.
  ProbabilityTrend از طریق اتصال‌های مشخص با بخش‌های دیگر ارتباط دارد.
  نقش داده‌ساز بازار داده ورودی فراهم می‌کند.
  نقش تحلیل‌گر اندیکاتورها را محاسبه می‌کند.
  نقش پیش‌بینی‌گر ML وزن‌های پیش‌بینی را فراهم می‌کند.
  نقش تجمیع‌گر نتیجه نهایی را تولید می‌کند.
  هر اتصال با پروتکل و جهت مشخص شده است.`,
    level: 3,
    code: `@startuml
' نمودار ساختار مرکب سطح ۳ - اتصالات محاسبه احتمال
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار ساختار مرکب - سطح ۳: اتصالات محاسبه احتمال

interface IMarketDataProvider <<role>> {
  +getCandlesticks(symbol: string): Candlestick[]
}

interface IIndicatorProvider <<role>> {
  +getIndicatorValues(name: string): number[]
}

interface IPredictionProvider <<role>> {
  +getPrediction(symbol: string): PredictionResult
}

interface IResultConsumer <<role>> {
  +accept(result: ProbabilityResult): void
}

component "MarketDataFetcher\\n<<dataProvider role>>" as MDF {
  port "marketDataOut" as mdOut
}

component "TAEngine\\n<<analyzer role>>" as TA {
  port "marketDataIn" as taMdIn
  port "indicatorsOut" as taIndOut
  port "regimeOut" as taRegOut
}

component "RegimeEngine\\n<<regimeDetector role>>" as RE {
  port "regimeIn" as reRegIn
  port "regimeResultOut" as reResOut
}

component "MLEngine\\n<<predictor role>>" as ML {
  port "featuresIn" as mlFeatIn
  port "predictionsOut" as mlPredOut
}

component "ProbabilityTrend\\n<<aggregator role>>" as PT {
  port "indicatorsIn" as ptIndIn
  port "regimeIn" as ptRegIn
  port "predictionsIn" as ptPredIn
  port "resultOut" as ptResOut
}

component "CompositeScores\\n<<resultConsumer role>>" as CS {
  port "probResultIn" as csProbIn
}

' اتصالات
mdOut --> taMdIn : "Candlestick[]\\nsync call"
taIndOut --> ptIndIn : "Map<string, number[]>\\nasync stream"
taRegOut --> reRegIn : "MarketData\\nsync call"
reResOut --> ptRegIn : "RegimeResult\\nsync return"
mlPredOut --> ptPredIn : "PredictionResult\\nasync callback"
taIndOut --> mlFeatIn : "Feature[]\\nsync call"
ptResOut --> csProbIn : "ProbabilityResult\\nasync event"

note right of PT
  ProbabilityTrend نقش تجمیع‌گر دارد
  ورودی‌ها:
  • اندیکاتورها از TAEngine
  • رژیم از RegimeEngine
  • پیش‌بینی از MLEngine
  خروجی:
  • نتیجه احتمال با CDF
end note

@enduml`,
  },
  {
    id: 'uml-profile-l1',
    title: `نمودار پروفایل - کلیشه‌های اصلی`,
    description: `نمودار کلیشه‌های UML اصلی تعریف‌شده برای سامانه.
  کلیشه <<Engine>> برای موتورهای تحلیلی استفاده می‌شود.
  کلیشه <<API>> برای سرویس‌های داده خارجی استفاده می‌شود.
  کلیشه <<DataStore>> برای ذخیره‌سازی و کش استفاده می‌شود.
  کلیشه <<AI>> برای مؤلفه‌های هوش مصنوعی استفاده می‌شود.
  هر کلیشه از metaclass مشخصی گسترش می‌یابد.`,
    level: 1,
    code: `@startuml
' نمودار پروفایل سطح ۱ - کلیشه‌های اصلی
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار پروفایل - سطح ۱: کلیشه‌های اصلی

class Stereotype <<stereotype>>
class Metaclass <<metaclass>>

class "Engine" as Engine <<stereotype>> {
  نوع: موتورهای تحلیلی اصلی
  مثال: TAEngine, RegimeEngine
}
class "API" as API <<stereotype>> {
  نوع: سرویس‌های داده خارجی
  مثال: TSEApi, YahooApi
}
class "DataStore" as DataStore <<stereotype>> {
  نوع: ذخیره‌سازی و کش
  مثال: Cache, WeightsCache
}
class "AI" as AI <<stereotype>> {
  نوع: مؤلفه‌های هوش مصنوعی
  مثال: ZaiShared, MSLV4
}
class "Analyzer" as Analyzer <<stereotype>> {
  نوع: تحلیل‌گرهای تخصصی
  مثال: SRAnalyzer, VolumeProfile
}
class "Processor" as Processor <<stereotype>> {
  نوع: پردازش‌گرهای خروجی
  مثال: AIPostProcessor
}

class "Class" as ClassMeta <<metaclass>>
class "Component" as CompMeta <<metaclass>>

Engine --|> Stereotype
API --|> Stereotype
DataStore --|> Stereotype
AI --|> Stereotype
Analyzer --|> Stereotype
Processor --|> Stereotype

Engine ..> ClassMeta : extends
API ..> CompMeta : extends
DataStore ..> CompMeta : extends
AI ..> CompMeta : extends
Analyzer ..> ClassMeta : extends
Processor ..> ClassMeta : extends

note right of Engine
  کلیشه <<Engine>> برای
  موتورهای تحلیلی که
  هسته سامانه هستند
end note

note right of AI
  کلیشه <<AI>> برای
  مؤلفه‌های مبتنی بر
  هوش مصنوعی
end note

@enduml`,
  },
  {
    id: 'uml-profile-l2',
    title: `نمودار پروفایل - کلیشه‌های گسترش‌یافته`,
    description: `نمودار کلیشه‌های گسترش‌یافته با برچسب‌های تعریف‌شده.
  {cached} نشان‌دهنده کش‌شدن نتایج است.
  {rateLimited} نشان‌دهنده محدودیت نرخ فراخوانی است.
  {noCache} نشان‌دهنده عدم کش‌پذیری است.
  {streaming} نشان‌دهنده پشتیبانی از جریانی است.
  {wasm} نشان‌دهنده شتاب‌دهی WASM است.
  هر برچسب با نوع و مقدار پیش‌فرض مشخص شده است.`,
    level: 2,
    code: `@startuml
' نمودار پروفایل سطح ۲ - کلیشه‌های گسترش‌یافته
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار پروفایل - سطح ۲: کلیشه‌های گسترش‌یافته

class "Engine" as Engine <<stereotype>> {
  +{cached} cacheTTL : int = 300
  +{wasm} accelerated : boolean = false
  +{version} engineVersion : string
}

class "API" as API <<stereotype>> {
  +{rateLimited} maxRPS : double = 1.0
  +{noCache} disableCache : boolean = false
  +{timeout} requestTimeout : int = 30000
  +{retry} maxRetries : int = 3
}

class "AI" as AI <<stereotype>> {
  +{rateLimited} maxRPS : double = 10.0
  +{streaming} supportsStreaming : boolean = true
  +{cached} cacheTTL : int = 300
  +{tokenLimit} maxTokens : int = 4096
}

class "DataStore" as DataStore <<stereotype>> {
  +{cached} defaultTTL : int = 300
  +{maxSize} maxSize : int = 1000
  +{eviction} evictionPolicy : string = "LRU"
}

class "Analyzer" as Analyzer <<stereotype>> {
  +{cached} cacheTTL : int = 600
  +{threshold} threshold : double = 0.5
}

Engine --|> Engine
API --|> API
AI --|> AI
DataStore --|> DataStore
Analyzer --|> Analyzer

note right of Engine
  کلیشه <<Engine>> با برچسب‌ها:
  • {cached} - نتایج کش می‌شوند
  • {wasm} - شتاب‌دهی WASM
  • {version} - نسخه موتور
end note

note right of API
  کلیشه <<API>> با برچسب‌ها:
  • {rateLimited} - محدود نرخ
  • {noCache} - بدون کش
  • {timeout} - مهلت درخواست
  • {retry} - حداکثر تلاش مجدد
end note

note right of AI
  کلیشه <<AI>> با برچسب‌ها:
  • {rateLimited} - محدود نرخ
  • {streaming} - پشتیبانی جریانی
  • {cached} - کش پاسخ‌ها
  • {tokenLimit} - سقف توکن
end note

@enduml`,
  },
  {
    id: 'uml-profile-l3',
    title: `نمودار پروفایل - اعمال کلیشه‌ها با محدودیت‌های OCL`,
    description: `نمودار اعمال کلیشه‌ها به عناصر خاص با محدودیت‌های OCL.
  هر عنصر با کلیشه و مقادیر برچسب مشخص شده است.
  محدودیت‌های OCL اعتبار پارامترها را تضمین می‌کنند.
  TAEngine با کلیشه Engine و شتاب WASM اعمال شده است.
  TSEApi با کلیشه API و محدودیت نرخ اعمال شده است.
  ZaiShared با کلیشه AI و پشتیبانی جریانی اعمال شده است.`,
    level: 3,
    code: `@startuml
' نمودار پروفایل سطح ۳ - اعمال کلیشه‌ها با OCL
title سامانه تحلیل تکنیکال مالی ایران\\nنمودار پروفایل - سطح ۳: اعمال کلیشه‌ها با OCL

class TAEngine <<Engine>> {
  +analyze(): AnalysisResult
  +calcTrend(): TrendDirection
  {cached} cacheTTL = 300
  {wasm} accelerated = true
  {version} engineVersion = "4.2"
}

class RegimeEngine <<Engine>> {
  +detectRegime(): RegimeResult
  +fuzzyMembership(): number
  {cached} cacheTTL = 600
  {wasm} accelerated = false
  {version} engineVersion = "3.0"
}

class MLEngine <<Engine>> {
  +trainAdaptive(): TrainingResult
  +predict(): PredictionResult
  {cached} cacheTTL = 3600
  {wasm} accelerated = false
  {version} engineVersion = "3.1"
}

class TSEApi <<API>> {
  +fetchCandlesticks(): Candlestick[]
  +fetchSymbols(): Symbol[]
  {rateLimited} maxRPS = 1.0
  {noCache} disableCache = false
  {timeout} requestTimeout = 30000
  {retry} maxRetries = 3
}

class TsetmcIndexApi <<API>> {
  +fetchMainIndex(): IndexData
  {rateLimited} maxRPS = 2.0
  {noCache} disableCache = true
  {timeout} requestTimeout = 15000
}

class TgjuApi <<API>> {
  +fetchHistory(): HistoricalData
  {rateLimited} maxRPS = 1.0
  {timeout} requestTimeout = 20000
  {retry} maxRetries = 2
}

class YahooApi <<API>> {
  +fetchHistory(): HistoricalData
  {rateLimited} maxRPS = 0.5
  {timeout} requestTimeout = 10000
  {retry} maxRetries = 2
}

class ZaiShared <<AI>> {
  +dedicatedAIChatCompletion(): ChatResponse
  +rateLimitedPageReader(): PageContent
  {rateLimited} maxRPS = 10.0
  {streaming} supportsStreaming = true
  {cached} cacheTTL = 300
  {tokenLimit} maxTokens = 4096
}

class AIPostProcessor <<Processor>> {
  +stripCodes(): string
  +fixPersian(): string
  +validatePrices(): ValidationResult
}

class SRAnalyzer <<Analyzer>> {
  +detectLevels(): SRLevel[]
  +computeStrength(): number
  {cached} cacheTTL = 600
  {threshold} threshold = 0.5
}

class VolumeProfile <<Analyzer>> {
  +approximate(): VolumeBin[]
  +poc(): number
  {cached} cacheTTL = 300
}

note bottom of TAEngine
  OCL: context TAEngine inv:
  self.cacheTTL > 0 and
  self.engineVersion.isNotEmpty()
end note

note bottom of TSEApi
  OCL: context TSEApi inv:
  self.maxRPS > 0 and
  self.requestTimeout > 0 and
  self.maxRetries >= 0
end note

note bottom of ZaiShared
  OCL: context ZaiShared inv:
  self.maxRPS > 0 and
  self.maxTokens > 0 and
  self.cacheTTL > 0
end note

note bottom of MLEngine
  OCL: context MLEngine inv:
  self.cacheTTL >= 300 and
  self.engineVersion.startsWith("3.")
end note

note bottom of SRAnalyzer
  OCL: context SRAnalyzer inv:
  self.threshold >= 0.0 and
  self.threshold <= 1.0
end note

@enduml`,
  },
] as const;

export const UML_BEHAV_DIAGRAMS = [
  {
    id: 'UC-L1',
    title: `نمودار کاربرد - سطح ۱: بازیگران و کاربردهای اصلی`,
    description: `این نمودار سطح اول، بازیگران اصلی سامانه تحلیل تکنیکال مالی ایران و
  کاربردهای کلیدی هر بازیگر را نشان می‌دهد. کاربر نهایی می‌تواند نماد را
  تحلیل کند، شاخص‌ها را مشاهده کند و گزارش هوش مصنوعی تولید کند.
  مدیر سامانه مسئول مدیریت شاخص‌ها و پیکربندی منابع داده است.
  منابع داده به‌عنوان بازیگر خارجی داده‌های بازار را تأمین می‌کنند.
  هر کاربرد نمایانگر یک قابلیت اصلی سامانه از دید کاربر است.`,
    level: 1,
    code: `@startuml
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome

actor "کاربر\\n(User)" as User
actor "مدیر سامانه\\n(SystemAdmin)" as Admin
actor "منبع داده\\n(DataSource)" as DataSource

rectangle "سامانه تحلیل تکنیکال مالی ایران" {
  usecase "تحلیل نماد\\n(Analyze Symbol)" as UC1
  usecase "مشاهده شاخص‌ها\\n(View Indicators)" as UC2
  usecase "تولید گزارش هوش مصنوعی\\n(Generate AI Report)" as UC3
  usecase "مدیریت شاخص‌ها\\n(Manage Indices)" as UC4
  usecase "واکشی داده‌های بازار\\n(Fetch Market Data)" as UC5
  usecase "پیکربندی سامانه\\n(System Configuration)" as UC6
}

User --> UC1
User --> UC2
User --> UC3
Admin --> UC4
Admin --> UC6
DataSource --> UC5

UC1 ..> UC5 : «نیاز»
UC3 ..> UC5 : «نیاز»

note right of UC1
  تحلیل تکنیکال کامل نماد
  شامل: RSI, MACD, BB,
  Ichimoku, Stochastic
end note

note right of UC3
  تولید تحلیل متنی
  توسط هوش مصنوعی
  با مدل MSLV4
end note

@enduml`,
  },
  {
    id: 'UC-L2',
    title: `نمودار کاربرد - سطح ۲: روابط include و extend`,
    description: `در سطح دوم، روابط «شامل» و «گسترش» بین کاربردها مشخص می‌شود.
  تحلیل نماد شامل واکشی داده، محاسبه شاخص‌ها و تشخیص رژیم است.
  تولید گزارش هوش مصنوعی شامل پیش‌پردازش و پس‌پردازش است.
  در صورت نرخ‌محدودی (429)، تحلیل جایگزین گسترش می‌یابد.
  مشاهده شاخص‌ها شامل انتخاب بازه زمانی و کش‌بازخوانی است.
  هر رابطه شامل نشان‌دهنده وابستگی اجباری است.`,
    level: 2,
    code: `@startuml
left to right direction
skinparam actorStyle awesome

actor "کاربر\\n(User)" as User
actor "مدیر سامانه\\n(SystemAdmin)" as Admin
actor "منبع داده\\n(DataSource)" as DataSource

rectangle "سامانه تحلیل تکنیکال مالی ایران" {
  usecase "تحلیل نماد\\n(Analyze Symbol)" as UC1
  usecase "مشاهده شاخص‌ها\\n(View Indicators)" as UC2
  usecase "تولید گزارش AI\\n(Generate AI Report)" as UC3
  usecase "مدیریت شاخص‌ها\\n(Manage Indices)" as UC4

  usecase "واکشی داده\\n(Fetch Data)" as UC_Fetch
  usecase "محاسبه شاخص‌ها\\n(Compute Indicators)" as UC_Compute
  usecase "تشخیص رژیم\\n(Detect Regime)" as UC_Regime
  usecase "پیش‌پردازش AI\\n(AI Preprocess)" as UC_PreAI
  usecase "پس‌پردازش AI\\n(AI Postprocess)" as UC_PostAI
  usecase "تحلیل جایگزین\\n(Fallback Analysis)" as UC_Fallback
  usecase "انتخاب بازه زمانی\\n(Select Timeframe)" as UC_Timeframe
  usecase "کش‌بازخوانی\\n(Cache Lookup)" as UC_Cache
  usecase "پیکربندی منابع\\n(Configure Sources)" as UC_Config
}

User --> UC1
User --> UC2
User --> UC3
Admin --> UC4
DataSource --> UC_Fetch

UC1 .> UC_Fetch : <<include>>
UC1 .> UC_Compute : <<include>>
UC1 .> UC_Regime : <<include>>
UC3 .> UC_PreAI : <<include>>
UC3 .> UC_PostAI : <<include>>
UC3 .> UC_Fallback : <<extend>>
UC2 .> UC_Timeframe : <<include>>
UC2 .> UC_Cache : <<include>>
UC4 .> UC_Config : <<include>>

note bottom of UC_Fallback
  در صورت خطای 429 یا
  نرخ‌محدودی AI
end note

@enduml`,
  },
  {
    id: 'UC-L3',
    title: `نمودار کاربرد - سطح ۳: سناریوهای جایگزین و استثنا`,
    description: `سطح سوم تمام سناریوهای استثنا و جایگزین را برای هر کاربرد نشان می‌دهد.
  واکشی داده ممکن است از منابع مختلف انجام شود با اولویت متفاوت.
  در صورت خطای تایم‌اوت، منبع جایگزین فعال می‌شود.
  تحلیل AI در صورت خطای 429 به تحلیل مبتنی بر قاعده بازمی‌گردد.
  محاسبه شاخص‌ها در صورت ناکافی بودن داده کاشل می‌شود.
  تشخیص رژیم در صورت نبود رژیم واضح، رژیم «نامشخص» برمی‌گرداند.
  پس‌پردازش AI در صورت نامعتبر بودن خروجی، بازتولید انجام می‌دهد.`,
    level: 3,
    code: `@startuml
left to right direction
skinparam actorStyle awesome

actor "کاربر\\n(User)" as User

rectangle "سامانه تحلیل تکنیکال مالی ایران" {
  usecase "تحلیل نماد\\n(Analyze Symbol)" as UC1
  usecase "واکشی داده\\n(Fetch Data)" as UC_Fetch
  usecase "واکشی از TSE\\n(Fetch TSE)" as UC_TSE
  usecase "واکشی از TGJU\\n(Fetch TGJU)" as UC_TGJU
  usecase "واکشی از Yahoo\\n(Fetch Yahoo)" as UC_Yahoo

  usecase "تولید گزارش AI\\n(Generate AI Report)" as UC3
  usecase "ارسال به MSLV4\\n(Send to MSLV4)" as UC_MSLV4
  usecase "ارسال به ZaiSDK\\n(Send to ZaiSDK)" as UC_ZaiSDK

  usecase "تحلیل قاعده‌محور\\n(Rule-based Analysis)" as UC_Rule
  usecase "تحلیل جایگزین\\n(Fallback Analysis)" as UC_Fallback

  usecase "محاسبه شاخص‌ها\\n(Compute Indicators)" as UC_Compute
  usecase "کشل شاخص‌ها\\n(Cached Indicators)" as UC_CacheCompute

  usecase "تشخیص رژیم\\n(Detect Regime)" as UC_Regime
  usecase "رژیم نامشخص\\n(Unknown Regime)" as UC_UnknownRegime

  usecase "پس‌پردازش AI\\n(AI Postprocess)" as UC_PostAI
  usecase "بازتولید AI\\n(AI Regeneration)" as UC_RegenAI
  usecase "مدیریت خطای 429\\n(Handle Rate Limit)" as UC_429
  usecase "مدیریت تایم‌اوت\\n(Handle Timeout)" as UC_Timeout
  usecase "داده ناکافی\\n(Insufficient Data)" as UC_Insuff
}

User --> UC1
User --> UC3

UC1 .> UC_Fetch : <<include>>
UC1 .> UC_Compute : <<include>>
UC1 .> UC_Regime : <<include>>
UC3 .> UC_MSLV4 : <<include>>
UC3 .> UC_PostAI : <<include>>

UC_Fetch .> UC_TSE : <<include>>
UC_TSE .> UC_TGJU : <<extend>>
UC_TGJU .> UC_Yahoo : <<extend>>
UC_Fetch .> UC_Timeout : <<extend>>
UC_Fetch .> UC_Insuff : <<extend>>

UC3 .> UC_Fallback : <<extend>>
UC_Fallback .> UC_Rule : <<include>>
UC3 .> UC_429 : <<extend>>
UC_429 .> UC_Rule : <<include>>

UC_Compute .> UC_CacheCompute : <<extend>>
UC_Regime .> UC_UnknownRegime : <<extend>>
UC_PostAI .> UC_RegenAI : <<extend>>

UC_MSLV4 .> UC_ZaiSDK : <<include>>

note right of UC_429
  خطای HTTP 429:
  Too Many Requests
  → تحلیل قاعده‌محور
end note

note right of UC_Timeout
  تایم‌اوت واکشی:
  → تلاش از منبع بعدی
end note

note right of UC_Insuff
  داده ناکافی:
  → محاسبه کشل شده
  → هشدار به کاربر
end note

@enduml`,
  },
  {
    id: 'ACT-L1',
    title: `نمودار فعالیت - سطح ۱: جریان اصلی «انتخاب و تحلیل نماد»`,
    description: `این نمودار جریان اصلی فرآیند انتخاب و تحلیل یک نماد بورسی را
  از ابتدا تا انتها نشان می‌دهد. کاربر نماد را انتخاب می‌کند،
  سپس سامانه داده‌ها را واکشی می‌کند، شاخص‌های تکنیکال را محاسبه
  می‌کند، رژیم بازار را تشخیص می‌دهد، گراف تصمیم را می‌سازد،
  پیش‌بینی ML را انجام می‌دهد، متن AI را تولید می‌کند
  و در نهایت نتایج را نمایش می‌دهد. این سطح فورک/جوین ندارد.`,
    level: 1,
    code: `@startuml
skinparam activityStyle rectangle

title جریان اصلی: انتخاب و تحلیل نماد

start
:انتخاب نماد توسط کاربر\\n(Select Symbol);
:واکشی داده‌های بازار\\n(Fetch Market Data);
note right: از TSE, TGJU, Yahoo
:محاسبه شاخص‌های تکنیکال\\n(Compute TA Indicators);
note right: RSI, MACD, BB, Ichimoku
:تشخیص رژیم بازار\\n(Detect Market Regime);
note right: صعودی/نزولی/رنج
:ساخت گراف تصمیم\\n(Build Decision Graph);
:پیش‌بینی یادگیری ماشین\\n(ML Prediction);
note right: MSLV4, ProbabilityTrend
:تولید متن تحلیل AI\\n(Generate AI Analysis Text);
note right: ZaiSDK → AIPostProcessor
:نمایش نتایج\\n(Display Results);
stop

@enduml`,
  },
  {
    id: 'ACT-L2',
    title: `نمودار فعالیت - سطح ۲: جریان‌های موازی و شرطی`,
    description: `سطح دوم شامل فورک/جوین برای واکشی موازی داده از منابع مختلف،
  و شاخه‌های شرطی برای موفقیت/شکست واکشی داده است.
  پس از واکشی، رژیم بازار تشخیص داده می‌شود و بر اساس نوع رژیم
  (صعودی، نزولی، رنج) تحلیل متفاوتی انجام می‌شود.
  تولید AI نیز در صورت موفقیت و در صورت نرخ‌محدودی (429)
  مسیرهای متفاوتی دارد. این سطح منطق شرطی کامل را نشان می‌دهد.`,
    level: 2,
    code: `@startuml
skinparam activityStyle rectangle

title جریان‌های موازی و شرطی: تحلیل نماد

start
:انتخاب نماد\\n(Select Symbol);

fork
  :واکشی از TSE API\\n(Fetch TSE);
fork again
  :واکشی از TGJU API\\n(Fetch TGJU);
fork again
  :واکشی از Yahoo API\\n(Fetch Yahoo);
end fork

if (واکشی موفق؟) then (بله)
  :ادغام داده‌ها\\n(Merge Data);
else (خیر - شکست)
  :تلاش از منبع جایگزین\\n(Try Fallback Source);
  if (منبع جایگزین موفق؟) then (بله)
    :ادغام داده‌ها\\n(Merge Data);
  else (خیر)
    :نمایش خطا به کاربر\\n(Show Error);
    stop
  endif
endif

:محاسبه شاخص‌های TA\\n(Compute TA Indicators);

:تشخیص رژیم بازار\\n(Detect Regime);

switch (نوع رژیم؟)
case (صعودی - Bullish)
  :تحلیل صعودی\\n(Bullish Analysis);
  :پیش‌بینی روند صعودی\\n(Bullish Trend Prediction);
case (نزولی - Bearish)
  :تحلیل نزولی\\n(Bearish Analysis);
  :پیش‌بینی روند نزولی\\n(Bearish Trend Prediction);
case (رنج - Range)
  :تحلیل رنج\\n(Range Analysis);
  :پیش‌بینی روند خنثی\\n(Neutral Trend Prediction);
endswitch

:ساخت گراف تصمیم\\n(Build Decision Graph);

:ارسال درخواست AI\\n(Send AI Request);

if (پاسخ AI موفق؟) then (بله)
  :پس‌پردازش AI\\n(AI Postprocess);
else (خیر - نرخ‌محدودی 429)
  :تحلیل قاعده‌محور جایگزین\\n(Rule-based Fallback);
  note right: بدون AI
endif

:نمایش نتایج\\n(Display Results);
stop

@enduml`,
  },
  {
    id: 'ACT-L3',
    title: `نمودار فعالیت - سطح ۳: جریان تفکیک‌شده با خط شناور`,
    description: `سطح سوم نمودار فعالیت را با خطوط شناور (Swimlanes) تفکیک می‌کند.
  هر خط شناور نمایانگر یک لایه سامانه است: Frontend, API Routes,
  TA Engine, ML Engine, AI Engine, Data Sources.
  تمام نقاط تصمیم شامل تایم‌اوت، کش، اعتبارسنجی و مدیریت خطا
  نشان داده می‌شود. فرآیند تلاش مجدد (retry) برای واکشی داده
  و تولید AI مشخص است. این سطح کامل‌ترین نمودار فرآیند است.`,
    level: 3,
    code: `@startuml
skinparam activityStyle rectangle

title جریان تفکیک‌شده با خط شناور: تحلیل کامل نماد

|Frontend|
start
:کاربر نماد را انتخاب می‌کند\\n(User Selects Symbol);
:ارسال درخواست به API\\n(Send Request to API);

|API Routes|
:دریافت درخواست\\n(Receive Request);
:اعتبارسنجی پارامترها\\n(Validate Parameters);
if (پارامترها معتبر؟) then (بله)
else (خیر)
  |Frontend|
  :نمایش خطای اعتبارسنجی\\n(Show Validation Error);
  stop
endif

|API Routes|
:بررسی کش\\n(Check Cache);
if (نتیجه کش موجود؟) then (بله)
  |Frontend|
  :نمایش نتایج کش‌شده\\n(Display Cached Results);
  stop
else (خیر)
endif

|Data Sources|
:واکشی داده‌های بازار\\n(Fetch Market Data);
note right: TSE → TGJU → Yahoo (اولویت)
if (واکشی موفق؟) then (خیر)
  :تلاش مجدد (Retry)\\n(Retry Fetch);
  if (تلاش دوم موفق؟) then (خیر)
    |API Routes|
    :خطای واکشی داده\\n(Data Fetch Error);
    |Frontend|
    :نمایش خطا\\n(Show Error);
    stop
  endif
endif

|TA Engine|
:محاسبه شاخص‌های تکنیکال\\n(Compute TA Indicators);
note right
  RSI, MACD, Bollinger Bands,
  Ichimoku, Stochastic, ADX,
  ATR, Volume Profile
end note

:تشخیص رژیم بازار\\n(Detect Market Regime);
note right
  بررسی: ADX, روند MA,
  الگوی حجم
end note

switch (رژیم تشخیص‌داده‌شده)
case (صعودی)
  :تحلیل صعودی\\n(Bullish Analysis);
case (نزولی)
  :تحلیل نزولی\\n(Bearish Analysis);
case (رنج)
  :تحلیل رنج\\n(Range Analysis);
case (نامشخص)
  :تحلیل عمومی\\n(Generic Analysis);
endswitch

|API Routes|
:ساخت گراف تصمیم\\n(Build Decision Graph);

|ML Engine|
:انتخاب مدل ML\\n(Select ML Model);
note right: AnalysisMLSelector
:پیش‌بینی احتمالی\\n(Probability Prediction);
note right: ProbabilityTrend, MSLV4

|AI Engine|
:بررسی نرخ‌محدودی\\n(Check Rate Limit);
if (نرخ مجاز؟) then (بله)
  :ساخت پرامپت AI\\n(Build AI Prompt);
  :ارسال به ZaiSDK\\n(Send to ZaiSDK);
  if (پاسخ موفق؟) then (بله)
    :پس‌پردازش AI\\n(AIPostProcessor);
    if (خروجی معتبر؟) then (بله)
      :ذخیره در کش\\n(Save to Cache);
    else (خیر)
      :بازتولید AI\\n(Regenerate AI);
    endif
  else (خیر - 429/تایم‌اوت)
    :تحلیل قاعده‌محور\\n(Rule-based Fallback);
    note right: بدون هوش مصنوعی
  endif
else (خیر - نرخ‌محدود)
  :تحلیل قاعده‌محور\\n(Rule-based Fallback);
endif

|API Routes|
:تجمیع نتایج\\n(Aggregate Results);
:ارسال به فرانت‌اند\\n(Send to Frontend);

|Frontend|
:رندر نتایج تحلیل\\n(Render Analysis Results);
:نمایش نمودارها و متن AI\\n(Display Charts & AI Text);
stop

@enduml`,
  },
  {
    id: 'SM-L1',
    title: `نمودار ماشین حالت - سطح ۱: حالات نشست تحلیل`,
    description: `این نمودار حالات اصلی یک نشست تحلیل را از دید کلان نشان می‌دهد.
  نشست از حالت بیکار شروع می‌شود و به‌ترتیب به حالات
  واکشی، محاسبه، تولید و نمایش گذر می‌کند.
  هر حالت نمایانگر یک مرحله اصلی پایپ‌لاین تحلیل است.
  گذارها ساده و بدون شرط نگه‌دار در این سطح هستند.
  نشست پس از نمایش نتایج دوباره بیکار می‌شود.`,
    level: 1,
    code: `@startuml
title حالات نشست تحلیل - سطح کلان

[*] -> Idle : شروع نشست

Idle --> Fetching : انتخاب نماد
Fetching --> Computing : داده واکشی شد
Computing --> Generating : شاخص‌ها محاسبه شد
Generating --> Displaying : تحلیل AI تولید شد
Displaying --> Idle : نتایج نمایش داده شد

note right of Idle : آماده دریافت درخواست
note right of Fetching : واکشی از TSE/TGJU/Yahoo
note right of Computing : محاسبه TA + تشخیص رژیم
note right of Generating : تولید AI + پیش‌بینی ML
note right of Displaying : نمایش نتایج به کاربر

@enduml`,
  },
  {
    id: 'SM-L2',
    title: `نمودار ماشین حالت - سطح ۲: محرک‌ها و شرط‌های نگه‌دار`,
    description: `سطح دوم محرک‌ها (triggers) و شرط‌های نگه‌دار (guard conditions)
  را برای هر گذار مشخص می‌کند. واکشی داده با شرط موفقیت/شکست
  مسیرهای متفاوتی دارد. محاسبه شاخص‌ها با شرط کفایت داده انجام می‌شود.
  تولید AI با شرط نرخ‌محدودی بررسی می‌شود. در صورت خطا در هر مرحله
  به حالت خطا گذار می‌یابیم. حالت خطا امکان بازگشت به بیکار را دارد.
  هر محرک و شرط دقیقاً مشخص شده است.`,
    level: 2,
    code: `@startuml
title حالات نشست تحلیل - با محرک‌ها و شرط‌ها

[*] -> Idle

Idle --> Fetching : selectSymbol(symbol) / [symbol != null]

Fetching --> Computing : onDataFetched(data) / [data.isValid == true]
Fetching --> Fetching : onRetry() / [retryCount < 3]
Fetching --> Error : onFetchFailed(err) / [retryCount >= 3]

Computing --> RegimeDetection : onIndicatorsComputed() / [data.length >= minLength]
Computing --> Error : onInsufficientData() / [data.length < minLength]

RegimeDetection --> AIGeneration : onRegimeDetected(regime) / [regime != null]
RegimeDetection --> AIGeneration : onUnknownRegime() / [regime == null]

AIGeneration --> Displaying : onAISuccess(response) / [response.isValid == true]
AIGeneration --> AIGeneration : onRateLimited() / [canRetry == true]
AIGeneration --> FallbackAnalysis : onAIFailed() / [canRetry == false]

FallbackAnalysis --> Displaying : onFallbackComplete()

Displaying --> Idle : onUserDismiss() / resetSession
Displaying --> Idle : onNewSymbolSelected(symbol) / [symbol != null]

Error --> Idle : onUserRetry()

state Error {
  [*] --> ErrorActive
  ErrorActive --> [*] : onReset()
}

note right of Fetching
  محرک: onDataFetched, onRetry, onFetchFailed
  شرط: اعتبارسنجی داده و تعداد تلاش
end note

note right of AIGeneration
  محرک: onAISuccess, onRateLimited, onAIFailed
  شرط: بررسی نرخ‌محدودی و اعتبار پاسخ
end note

@enduml`,
  },
  {
    id: 'SM-L3',
    title: `نمودار ماشین حالت - سطح ۳: حالات مرکب برای تولید AI`,
    description: `سطح سوم حالات مرکب (composite states) را برای فرآیند تولید AI
  نشان می‌دهد. حالت AIGeneration شامل زیرحالات: بررسی نرخ‌محدود،
  ارسال درخواست، دریافت پاسخ و پس‌پردازش است.
  هر زیرحالت خود دارای گذارهای داخلی است.
  فرآیند واکشی داده نیز به‌عنوان حالت مرکب با زیرحالات منابع
  مختلف (TSE, TSETMC, TGJU, Yahoo) مدل شده است.
  تایم‌اوت و تلاش مجدد در هر زیرحالت مشخص شده‌اند.`,
    level: 3,
    code: `@startuml
title حالات مرکب: نشست تحلیل با زیرحالات

[*] -> Idle

Idle --> FetchingData : selectSymbol(symbol)

state FetchingData {
  [*] --> FetchFromTSE
  FetchFromTSE --> FetchFromTSETMC : onTSEComplete() / [tseSuccess]
  FetchFromTSE --> FetchFromTGJU : onTSEFailed() / [!tseSuccess]
  FetchFromTSETMC --> MergeData : onTSETMCComplete()
  FetchFromTGJU --> FetchFromYahoo : onTGJUFailed()
  FetchFromYahoo --> MergeData : onYahooComplete()
  FetchFromYahoo --> FetchFailed : onYahooFailed()
  MergeData --> [*] : onDataReady(data)
  FetchFailed --> [*] : onAllSourcesFailed()
}

FetchingData --> Computing : dataReady(data) / [data.valid]
FetchingData --> Error : allSourcesFailed()

Computing --> RegimeDetection : indicatorsReady()
RegimeDetection --> AIGeneration : regimeDetected(regime)

state AIGeneration {
  [*] --> CheckingRateLimit
  CheckingRateLimit --> BuildingPrompt : onRateAllowed() / [!rateLimited]
  CheckingRateLimit --> WaitingForRateWindow : onRateLimited() / [rateLimited]
  WaitingForRateWindow --> CheckingRateLimit : onRateWindowAvailable() / [waitTime > 0]

  BuildingPrompt --> SendingRequest : onPromptBuilt()
  SendingRequest --> ReceivingResponse : onRequestSent()
  SendingRequest --> RequestTimeout : onTimeout() / [elapsed > 90s]
  RequestTimeout --> RetryDecision : onTimeoutHandled()

  ReceivingResponse --> PostProcessing : onResponseReceived(response) / [response.valid]
  ReceivingResponse --> InvalidResponse : onResponseReceived(response) / [!response.valid]
  InvalidResponse --> RetryDecision : onInvalidHandled()

  RetryDecision --> BuildingPrompt : onRetryAllowed() / [retryCount < 3]
  RetryDecision --> [*] : onRetryExhausted() / [retryCount >= 3]

  PostProcessing --> ValidatingOutput : onPostProcessed()
  ValidatingOutput --> [*] : onOutputValid()
  ValidatingOutput --> RetryDecision : onOutputInvalid()
}

AIGeneration --> Displaying : aIResultReady(result)
AIGeneration --> FallbackAnalysis : aIFailed() / [allRetriesExhausted]

FallbackAnalysis --> Displaying : fallbackComplete()

Displaying --> Idle : newSymbolOrDismiss()

state Error {
  [*] --> ErrorLogged
  ErrorLogged --> [*] : onUserRetry()
}

note right of FetchingData
  حالات مرکب واکشی داده:
  TSE → TSETMC → TGJU → Yahoo
  با اولویت نزولی
end note

note right of AIGeneration
  حالات مرکب تولید AI:
  ۱. بررسی نرخ‌محدود
  ۲. ساخت پرامپت
  ۳. ارسال درخواست
  ۴. دریافت پاسخ
  ۵. پس‌پردازش
  ۶. اعتبارسنجی خروجی
end note

@enduml`,
  },
  {
    id: 'SEQ-L1',
    title: `نمودار دنباله - سطح ۱: تعامل لایه‌ها برای «مشاهده تحلیل»`,
    description: `این نمودار تعامل بین لایه‌های اصلی سامانه برای کاربرد
  «مشاهده تحلیل» را نشان می‌دهد. از فرانت‌اند شروع شده
  و به API Routes، موتور تحلیل تکنیکال و منابع داده می‌رسد.
  پاسخ به‌ترتیب معکوس برمی‌گردد. این سطح بدون جزئیات
  داخلی هر لایه است و فقط پیام‌های اصلی را نشان می‌دهد.
  تعامل ساده و همگام فرض شده است.`,
    level: 1,
    code: `@startuml
title تعامل لایه‌ها: مشاهده تحلیل نماد

actor "کاربر" as User
participant "Frontend\\n(Next.js)" as FE
participant "API Routes" as API
participant "TA Engine" as TA
participant "Data Sources" as DS
participant "ML Engine" as ML
participant "AI Engine" as AI

User -> FE : انتخاب نماد (symbol)
FE -> API : GET /api/analysis/{symbol}
API -> DS : fetchMarketData(symbol)
DS --> API : marketData
API -> TA : computeIndicators(marketData)
TA --> API : indicators
API -> ML : predict(indicators)
ML --> API : prediction
API -> AI : generateAnalysis(indicators, prediction)
AI --> API : analysisText
API --> FE : {indicators, prediction, analysis}
FE --> User : نمایش نتایج تحلیل

@enduml`,
  },
  {
    id: 'SEQ-L2',
    title: `نمودار دنباله - سطح ۲: تعامل جزئی «تولید تحلیل AI»`,
    description: `سطح دوم تعامل دقیق برای تولید تحلیل هوش مصنوعی را نشان می‌دهد.
  فرانت‌اند درخواست را به API ارسال می‌کند، API تحلیل را به MSLV4
  می‌سپارد، MSLV4 پرامپت را می‌سازد و به ZaiSDK ارسال می‌کند.
  ZaiSDK پاسخ خام را برمی‌گرداند و AIPostProcessor آن را
  پردازش می‌کند. AnalysisMLSelector مدل مناسب را انتخاب می‌کند.
  ProbabilityTrend احتمال‌ها را محاسبه می‌کند.
  این سطح بدون مدیریت خطا است.`,
    level: 2,
    code: `@startuml
title تعامل جزئی: تولید تحلیل AI

autonumber

actor "کاربر" as User
participant "Frontend" as FE
participant "API Route\\n/analysis" as API
participant "Analysis\\nMLSelector" as MLSel
participant "MSLV4\\nModel" as MSLV4
participant "Probability\\nTrend" as ProbTrend
participant "ZaiSDK" as Zai
participant "AI\\nPostProcessor" as AIPP

User -> FE : requestAnalysis(symbol)
FE -> API : POST /api/ai-analysis\\n{symbol, indicators, regime}
API -> MLSel : selectModel(indicators, regime)
MLSel --> API : selectedModel = "MSLV4"

API -> MSLV4 : analyze(model, indicators, marketData)
MSLV4 -> MSLV4 : buildPrompt(indicators, regime)
MSLV4 -> Zai : sendPrompt(prompt, config)
Zai --> MSLV4 : rawAIResponse
MSLV4 -> AIPP : postProcess(rawAIResponse)
AIPP -> AIPP : cleanMarkdown()
AIPP -> AIPP : validateStructure()
AIPP -> AIPP : extractSignals()
AIPP --> MSLV4 : processedAnalysis

MSLV4 -> ProbTrend : computeProbability(indicators, regime)
ProbTrend --> MSLV4 : probabilityResult

MSLV4 --> API : {analysis, probability, signals}
API --> FE : {aiText, probability, confidence}
FE --> User : نمایش تحلیل AI

@enduml`,
  },
  {
    id: 'SEQ-L3',
    title: `نمودار دنباله - سطح ۳: تعامل کامل با async، استثنا و تلاش مجدد`,
    description: `سطح سوم تعامل کامل با فراخوانی‌های ناهمگام (async)، مدیریت
  استثنا و حلقه‌های تلاش مجدد (retry) را نشان می‌دهد.
  واکشی داده از منابع مختلف ناهمگام انجام می‌شود.
  در صورت خطای 429 از ZaiSDK، تلاش مجدد با تأخیر نمایی انجام می‌شود.
  تایم‌اوت برای هر فراخوانی تنظیم شده است.
  AIPostProcessor در صورت نامعتبر بودن خروجی، بازتولید درخواست می‌کند.
  این سطح کامل‌ترین نمودار دنباله با تمام جزئیات خطا و تلاش مجدد است.`,
    level: 3,
    code: `@startuml
title تعامل کامل: تحلیل با async، استثنا و تلاش مجدد

autonumber

actor "کاربر" as User
participant "Frontend" as FE
participant "API Route" as API
participant "TSE Api" as TSE
participant "TGJU Api" as TGJU
participant "Yahoo Api" as Yahoo
participant "TA Engine" as TA
participant "Regime\\nEngine" as RE
participant "Decision\\nGraph" as DG
participant "MSLV4" as MSL
participant "ZaiSDK" as Zai
participant "AI Post\\nProcessor" as AIPP
participant "Prob\\nTrend" as PT

== واکشی ناهمگام داده ==
User -> FE : selectSymbol("فولاد")
FE -> API : GET /api/analysis/فولاد

par واکشی موازی داده
  API -> TSE : async fetchTSE("فولاد")
  TSE --> API : tseData [بعد از 2s]
and
  API -> TGJU : async fetchTGJU("فولاد")
  TGJU --> API : tgjuData [بعد از 3s]
and
  API -> Yahoo : async fetchYahoo("فولاد")
  Yahoo --> API : yahooData [بعد از 1.5s]
end

API -> API : mergeData(tse, tgju, yahoo)

alt داده ناکافی
  API --> FE : 400 Insufficient Data
  FE --> User : هشدار: داده ناکافی
else داده کافی
end

== محاسبه تحلیل تکنیکال ==
API -> TA : computeAll(marketData)
TA --> API : indicators{RSI, MACD, BB, ...}

API -> RE : detectRegime(indicators)
RE --> RE : classifyADX()
RE --> RE : classifyTrend()
RE --> API : regime = "صعودی"

API -> DG : buildGraph(indicators, regime)
DG --> API : decisionGraph

== پیش‌بینی ML ==
API -> PT : computeProbability(indicators, regime)
PT --> API : probability = 0.72

== تولید AI با تلاش مجدد ==
loop [تا ۳ تلاش]
  API -> MSL : analyze(indicators, regime)
  MSL -> MSL : buildPrompt()

  opt بررسی نرخ‌محدود
    MSL -> Zai : checkRateLimit()
    alt نرخ‌محدود (429)
      Zai --> MSL : 429 Too Many Requests
      MSL -> MSL : exponentialBackoff(retryCount)
      note right of MSL
        تأخیر نمایی:
        2^n ثانیه
      end note
    else نرخ مجاز
    end
  end

  MSL -> Zai : generateText(prompt, config) [timeout: 90s]

  alt پاسخ موفق
    Zai --> MSL : rawResponse
    MSL -> AIPP : postProcess(rawResponse)
    AIPP -> AIPP : validateStructure()
    alt خروجی معتبر
      AIPP --> MSL : processedAnalysis
      MSL --> API : finalResult
    else خروجی نامعتبر
      AIPP --> MSL : invalidOutput
      note right of AIPP : بازتولید درخواست
    end
  else تایم‌اوت
    Zai --> MSL : TimeoutException
    MSL -> MSL : logTimeout()
  else خطای 429
    Zai --> MSL : RateLimitException
    MSL -> MSL : incrementRetryCount()
  end
end

alt AI موفق
  API --> FE : 200 {analysis, probability, signals}
  FE --> User : نمایش کامل تحلیل
else AI شکست خورد
  API -> API : ruleBasedFallback(indicators, regime)
  API --> FE : 200 {ruleBasedAnalysis}
  FE --> User : نمایش تحلیل قاعده‌محور
  note right of FE : بدون AI - تحلیل جایگزین
end

@enduml`,
  },
  {
    id: 'COMM-L1',
    title: `نمودار ارتباط - سطح ۱: پیوندهای اصلی معماری تحلیل`,
    description: `این نمودار پیوندهای ارتباطی اصلی بین اشیاء معماری تحلیل را
  نشان می‌دهد. Frontend با API Routes، API با موتورهای مختلف
  و موتورها با منابع داده و AI ارتباط دارند.
  هر پیوند نشان‌دهنده یک رابط ارتباطی بین دو شیء است.
  این سطح بدون شماره‌گذاری پیام‌ها است.
  پیوندها معماری کلی سامانه را نشان می‌دهند.`,
    level: 1,
    code: `@startuml
title معماری ارتباطات سامانه تحلیل

object "Frontend" as FE
object "API Routes" as API
object "TA Engine" as TA
object "Regime Engine" as RE
object "Decision Graph" as DG
object "ML Engine" as ML
object "AI Engine" as AI
object "Data Sources" as DS
object "ZaiSDK" as Zai

FE -- API : HTTP Request/Response
API -- TA : computeIndicators()
API -- RE : detectRegime()
API -- DG : buildGraph()
API -- ML : predict()
API -- AI : generateAnalysis()
AI -- Zai : AI Generation
API -- DS : fetchData()

note top of FE : رابط کاربر (Next.js)
note bottom of DS : TSE, TGJU, Yahoo
note bottom of Zai : کانال هوش مصنوعی

@enduml`,
  },
  {
    id: 'COMM-L2',
    title: `نمودار ارتباط - سطح ۲: ترتیب پیام‌ها در محاسبه احتمال`,
    description: `سطح دوم ترتیب پیام‌ها بین زیرسامانه‌ها را در فرآیند محاسبه
  احتمال روند نشان می‌دهد. API ابتدا شاخص‌ها را محاسبه می‌کند،
  سپس رژیم را تشخیص می‌دهد، مدل ML را انتخاب می‌کند،
  پیش‌بینی احتمال را محاسبه می‌کند و در نهایت گراف تصمیم را
  می‌سازد. هر پیام شماره‌گذاری شده است.
  ترتیب شماره‌ها نشان‌دهنده توالی اجرا است.`,
    level: 2,
    code: `@startuml
title ترتیب پیام‌ها: محاسبه احتمال روند

object "API Route" as API
object "TA Engine" as TA
object "Regime Engine" as RE
object "AnalysisMLSelector" as MLSel
object "MSLV4" as MSL
object "ProbabilityTrend" as PT
object "Decision Graph" as DG

API -- TA
API -- RE
API -- MLSel
API -- MSL
API -- PT
API -- DG
MSL -- PT

' شماره‌گذاری پیام‌ها
API -> TA : 1. computeAll(marketData)
TA -> API : 2. return indicators
API -> RE : 3. detectRegime(indicators)
RE -> API : 4. return regime
API -> MLSel : 5. selectModel(indicators, regime)
MLSel -> API : 6. return "MSLV4"
API -> MSL : 7. analyze(model, indicators)
MSL -> PT : 8. computeProbability(indicators, regime)
PT -> MSL : 9. return probability
MSL -> API : 10. return prediction
API -> DG : 11. buildGraph(indicators, regime, prediction)
DG -> API : 12. return decisionGraph

@enduml`,
  },
  {
    id: 'COMM-L3',
    title: `نمودار ارتباط - سطح ۳: پیام‌های شماره‌گذاری‌شده واکشی چندمنبعی`,
    description: `سطح سوم پیام‌های شماره‌گذاری‌شده را برای سناریو پیچیده واکشی
  داده از چند منبع نشان می‌دهد. API به‌ترتیب از TSE, TSETMC,
  TGJU و Yahoo واکشی می‌کند. در صورت شکست هر منبع،
  منبع بعدی امتحان می‌شود. پس از واکشی موفق، ادغام داده،
  کش‌نوشتن و اعتبارسنجی انجام می‌شود. تمام پیام‌های داخلی
  و خارجی شماره‌گذاری شده‌اند.`,
    level: 3,
    code: `@startuml
title واکشی چندمنبعی: پیام‌های شماره‌گذاری‌شده

object "API Route" as API
object "TSE Api" as TSE
object "TSETMC Index" as TSETMC
object "TGJU Api" as TGJU
object "Yahoo Api" as Yahoo
object "Cache" as Cache
object "Validator" as Val

API -- TSE
API -- TSETMC
API -- TGJU
API -- Yahoo
API -- Cache
API -- Val
TSE -- TSETMC

API -> Cache : 1. checkCache(symbol)
Cache -> API : 2. cacheMiss
API -> TSE : 3. fetchTSE(symbol)
TSE -> TSETMC : 4. fetchIndexData(symbol)
TSETMC -> TSE : 5. indexData
TSE -> API : 6. tseData [موفق]
API -> Val : 7. validate(tseData)
Val -> API : 8. valid=true

API -> TGJU : 9. fetchTGJU(symbol) [داده تکمیلی]
TGJU -> API : 10. tgjuData
API -> Val : 11. validate(tgjuData)
Val -> API : 12. valid=true

API -> Yahoo : 13. fetchYahoo(symbol) [داده بین‌المللی]
Yahoo -> API : 14. yahooData
API -> Val : 15. validate(yahooData)
Val -> API : 16. valid=true

API -> API : 17. mergeData(tse, tgju, yahoo)
API -> Cache : 18. saveCache(symbol, mergedData)
Cache -> API : 19. saved
API -> API : 20. return mergedData

note left of API
  در صورت شکست هر منبع:
  → منبع بعدی امتحان می‌شود
  → اگر همه شکست خوردند: خطا
end note

@enduml`,
  },
  {
    id: 'IO-L1',
    title: `نمودار کلان تعامل - سطح ۱: فلوچارت ترکیب دنباله‌ها`,
    description: `این نمودار فلوچارت سطح بالایی است که دنباله‌های اصلی سامانه
  را به‌عنوان بلوک‌های تعاملی ترکیب می‌کند. هر بلوک مرجع به یک
  نمودار دنباله مشخص است. جریان از انتخاب نماد شروع شده
  و به‌ترتیب از واکشی، تحلیل، پیش‌بینی و نمایش می‌گذرد.
  PlantUML از نمودار Interaction Overview پشتیبانی محدودی دارد
  لذا این نمودار با activity diagram با ref ها مدل شده است.`,
    level: 1,
    code: `@startuml
title فلوچارت کلان تعاملات سامانه

start

:انتخاب نماد توسط کاربر;

ref over "Frontend → API"
  دنباله: انتخاب نماد
  (SEQ-SelectSymbol)
end ref

if (داده کش‌شده موجود؟) then (بله)
  :بازگرداندن نتایج کش;
else (خیر)
  ref over "API → DataSources"
    دنباله: واکشی داده
    (SEQ-FetchData)
  end ref

  ref over "API → TA Engine → Regime Engine"
    دنباله: تحلیل تکنیکال
    (SEQ-TAAnalysis)
  end ref

  ref over "API → ML Engine → AI Engine"
    دنباله: پیش‌بینی و تولید AI
    (SEQ-MLAIPrediction)
  end ref
endif

ref over "API → Frontend"
  دنباله: نمایش نتایج
  (SEQ-DisplayResults)
end ref

stop

@enduml`,
  },
  {
    id: 'IO-L2',
    title: `نمودار کلان تعامل - سطح ۲: نقاط تصمیم با ارجاع به دنباله‌ها`,
    description: `سطح دوم نقاط تصمیم را با ارجاع به نمودارهای دنباله مشخص
  نشان می‌دهد. پس از واکشی داده، تصمیم موفقیت/شکست گرفته می‌شود.
  بر اساس نوع رژیم، دنباله تحلیل متفاوتی فراخوانی می‌شود.
  در صورت نرخ‌محدودی AI، دنباله جایگزین اجرا می‌شود.
  هر بلوک تعاملی مرجع دقیق به نمودار دنباله مربوطه دارد.`,
    level: 2,
    code: `@startuml
title نقاط تصمیم با ارجاع به دنباله‌ها

start

:دریافت درخواست تحلیل;

ref over "API → Cache"
  دنباله: بررسی کش
  (SEQ-CacheLookup)
end ref

if (کش HIT؟) then (بله)
  :بازگرداندن کش;
  stop
endif

ref over "API → TSE → TGJU → Yahoo"
  دنباله: واکشی چندمنبعی
  (SEQ-MultiSourceFetch)
end ref

if (واکشی موفق؟) then (خیر)
  ref over "API → Fallback"
    دنباله: واکشی جایگزین
    (SEQ-FallbackFetch)
  end ref
  if (جایگزین موفق؟) then (خیر)
    :خطا;
    stop
  endif
endif

ref over "API → TA Engine"
  دنباله: محاسبه شاخص‌ها
  (SEQ-ComputeIndicators)
end ref

ref over "API → Regime Engine"
  دنباله: تشخیص رژیم
  (SEQ-DetectRegime)
end ref

switch (نوع رژیم)
case (صعودی)
  ref over "TA → DecisionGraph"
    دنباله: تحلیل صعودی
    (SEQ-BullishAnalysis)
  end ref
case (نزولی)
  ref over "TA → DecisionGraph"
    دنباله: تحلیل نزولی
    (SEQ-BearishAnalysis)
  end ref
case (رنج)
  ref over "TA → DecisionGraph"
    دنباله: تحلیل رنج
    (SEQ-RangeAnalysis)
  end ref
endswitch

ref over "API → MSLV4 → ZaiSDK"
  دنباله: تولید AI
  (SEQ-AIGeneration)
end ref

if (AI موفق؟) then (خیر - 429)
  ref over "API → RuleEngine"
    دنباله: تحلیل قاعده‌محور
    (SEQ-RuleBasedFallback)
  end ref
endif

:تجمیع و نمایش نتایج;
stop

@enduml`,
  },
  {
    id: 'IO-L3',
    title: `نمودار کلان تعامل - سطح ۳: حلقه‌ها و دروازه‌های موازی`,
    description: `سطح سوم حلقه‌های تلاش مجدد و دروازه‌های موازی (parallel gates)
  را با ارجاع به دنباله‌های جزئی نشان می‌دهد. واکشی موازی داده
  در فورک/جوین مدل شده است. حلقه تلاش مجدد برای AI با
  تأخیر نمودی نشان داده شده است. دروازه همگام‌سازی (sync)
  برای ترکیب نتایج موازی استفاده شده است.
  این سطح کامل‌ترین نمودار کلان تعامل است.`,
    level: 3,
    code: `@startuml
title حلقه‌ها و دروازه‌های موازی: تعاملات کامل

start

:دریافت درخواست تحلیل نماد;

ref over "FE → API → Cache"
  دنباله: بررسی کش
  (SEQ-L1-CacheLookup)
end ref

if (کش HIT) then (بله)
  :بازگرداندن نتایج کش;
  stop
endif

== واکشی موازی داده ==

fork
  ref over "API → TSE"
    دنباله: واکشی TSE
    (SEQ-FetchTSE)
  end ref
fork again
  ref over "API → TGJU"
    دنباله: واکشی TGJU
    (SEQ-FetchTGJU)
  end ref
fork again
  ref over "API → Yahoo"
    دنباله: واکشی Yahoo
    (SEQ-FetchYahoo)
  end ref
end fork

if (همه منابع شکست؟) then (بله)
  loop [تا ۲ تلاش]
    ref over "API → FallbackSources"
      دنباله: واکشی جایگزین
      (SEQ-FallbackFetch)
    end ref
  end
  if (هنوز شکست) then (بله)
    :خطا;
    stop
  endif
endif

ref over "API → TA"
  دنباله: محاسبه شاخص‌ها
  (SEQ-ComputeAllIndicators)
end ref

ref over "API → Regime"
  دنبانه: تشخیص رژیم
  (SEQ-DetectRegime)
end ref

ref over "API → DecisionGraph"
  دنباله: ساخت گراف تصمیم
  (SEQ-BuildDecisionGraph)
end ref

== پیش‌بینی ML موازی ==

fork
  ref over "API → MSLV4"
    دنباله: پیش‌بینی MSLV4
    (SEQ-MSLV4Predict)
  end ref
fork again
  ref over "API → ProbabilityTrend"
    دنباله: محاسبه احتمال
    (SEQ-ProbTrendCompute)
  end ref
end fork

== تولید AI با تلاش مجدد ==

loop [تا ۳ تلاش با تأخیر نمایی]
  ref over "API → MSLV4 → ZaiSDK → AIPP"
    دنباله: تولید و پس‌پردازش AI
    (SEQ-AIGenerationWithPostProcess)
  end ref

  if (AI موفق و خروجی معتبر؟) then (بله)
    break
  else (429 یا تایم‌اوت)
    :تأخیر نمایی: 2^n ثانیه;
    note right
      n = شماره تلاش
      تأخیر: 2, 4, 8 ثانیه
    end note
  endif
end

if (AI شکست خورد) then (بله)
  ref over "API → RuleEngine"
    دنباله: تحلیل قاعده‌محور
    (SEQ-RuleBasedFallback)
  end ref
endif

ref over "API → Cache"
  دنباله: ذخیره در کش
  (SEQ-SaveCache)
end ref

ref over "API → Frontend"
  دنباله: ارسال و نمایش نتایج
  (SEQ-DisplayResults)
end ref

stop

@enduml`,
  },
  {
    id: 'TIM-L1',
    title: `نمودار زمان‌بندی - سطح ۱: تغییر حالات واکشی داده در زمان`,
    description: `این نمودار تغییر حالات فرآیند واکشی داده از منابع مختلف را
  در طول زمان نشان می‌دهد. هر منبع (TSE, TSETMC, TGJU, Yahoo)
  از حالت «آماده» به «درخواست» سپس «دریافت» و در نهایت
  «تکمیل» گذر می‌کند. ترتیب واکشی و مدت زمان هر مرحله
  مشخص است. PlantUML پشتیبانی محدودی از timing diagram دارد
  لذا توصیف ساختاریافته نیز ارائه شده است.`,
    level: 1,
    code: `@startuml
title زمان‌بندی واکشی داده از منابع مختلف

robust "TSE API" as TSE
robust "TSETMC Index" as TSETMC
robust "TGJU API" as TGJU
robust "Yahoo API" as Yahoo

@0
TSE is "آماده"
TSETMC is "آماده"
TGJU is "آماده"
Yahoo is "آماده"

@100
TSE is "درخواست"
note bottom: ارسال درخواست HTTP

@200
TSETMC is "درخواست"

@500
TSE is "دریافت"
note bottom: شروع دریافت داده

@800
TSETMC is "دریافت"

@1000
TSE is "تکمیل"
note bottom: داده کامل شد (1s)

@1100
TGJU is "درخواست"

@1500
TSETMC is "تکمیل"
note bottom: داده کامل شد (1.3s)

@1600
Yahoo is "درخواست"

@1800
TGJU is "دریافت"

@2100
Yahoo is "دریافت"

@2400
TGJU is "تکمیل"
note bottom: داده کامل شد (1.3s)

@2700
Yahoo is "تکمیل"
note bottom: داده کامل شد (1.1s)

@enduml`,
  },
  {
    id: 'TIM-L2',
    title: `نمودار زمان‌بندی - سطح ۲: تغییر حالات پس از رویدادهای خاص`,
    description: `سطح دوم تغییر حالات سامانه را پس از رویدادهای خاص نشان می‌دهد:
  به‌روزرسانی قیمت → محاسبه مجدد تحلیل → بازتولید AI.
  هر رویداد موجب تغییر حالت در چند شیء می‌شود.
  به‌روزرسانی قیمت ابتدا واکشی را فعال می‌کند، سپس محاسبه
  شاخص‌ها شروع می‌شود و در صورت تغییر رژیم، AI بازتولید می‌شود.
  تأخیر هر مرحله مشخص شده است.`,
    level: 2,
    code: `@startuml
title زمان‌بندی: به‌روزرسانی قیمت → محاسبه مجدد → بازتولید AI

robust "DataFetcher" as DF
robust "TAEngine" as TA
robust "RegimeEngine" as RE
robust "AIEngine" as AI
robust "Display" as DISP

@0
DF is "بیکار"
TA is "بیکار"
RE is "بیکار"
AI is "بیکار"
DISP is "بیکار"

note bottom of DF
  رویداد: به‌روزرسانی قیمت
  (Price Update Event)
end note

@0
DF is "واکشی"

@3000
DF is "آماده"
TA is "محاسبه"
note bottom of TA: محاسبه شاخص‌ها شروع

@5000
TA is "تکمیل"
RE is "تشخیص"
note bottom of RE: تشخیص رژیم

@5500
RE is "تکمیل"

@5600
AI is "درخواست"
note bottom of AI
  ارسال به ZaiSDK
  (رژیم تغییر کرده)
end note

@9000
AI is "تکمیل"
DISP is "رندر"
note bottom of DISP: رندر نتایج جدید

@9200
DISP is "بیکار"
DF is "بیکار"
TA is "بیکار"
RE is "بیکار"
AI is "بیکار"

@enduml`,
  },
  {
    id: 'TIM-L3',
    title: `نمودار زمان‌بندی - سطح ۳: محدودیت‌های مدت زمان`,
    description: `سطح سوم محدودیت‌های مدت زمان (duration constraints) را برای
  هر مرحله مشخص می‌کند. واکشی داده < 8s، محاسبه TA < 2s،
  تولید AI < 90s، و کل فرآیند < 120s. هر محدودیت به‌عنوان
  constraint روی نمودار نشان داده شده است.
  در صورت تجاوز محدودیت، تایم‌اوت فعال می‌شود.
  این سطح برای تحلیل عملکرد و SLA سامانه حیاتی است.`,
    level: 3,
    code: `@startuml
title محدودیت‌های مدت زمان: SLA سامانه تحلیل

robust "DataFetch\\n[max 8s]" as DF
robust "TA Compute\\n[max 2s]" as TA
robust "Regime Detect\\n[max 1s]" as RE
robust "ML Predict\\n[max 5s]" as ML
robust "AI Generate\\n[max 90s]" as AI
robust "PostProcess\\n[max 3s]" as PP
robust "Total Pipeline\\n[max 120s]" as TOTAL

@0
DF is "آماده"
TA is "آماده"
RE is "آماده"
ML is "آماده"
AI is "آماده"
PP is "آماده"
TOTAL is "آماده"

' مرحله ۱: واکشی داده (0-8s)
@0
DF is "واکشی"
TOTAL is "درحال‌اجرا"

@4000
DF is "تکمیل"
note bottom
  مدت: ~4s
  محدودیت: < 8s ✓
  {DF.duration < 8s}
end note

' مرحله ۲: محاسبه TA (4-6s)
@4000
TA is "محاسبه"

@5500
TA is "تکمیل"
note bottom
  مدت: ~1.5s
  محدودیت: < 2s ✓
  {TA.duration < 2s}
end note

' مرحله ۳: تشخیص رژیم (5.5-6.5s)
@5500
RE is "تشخیص"

@6000
RE is "تکمیل"
note bottom
  مدت: ~0.5s
  محدودیت: < 1s ✓
  {RE.duration < 1s}
end note

' مرحله ۴: پیش‌بینی ML (6-11s)
@6000
ML is "پیش‌بینی"

@9000
ML is "تکمیل"
note bottom
  مدت: ~3s
  محدودیت: < 5s ✓
  {ML.duration < 5s}
end note

' مرحله ۵: تولید AI (9-99s)
@9000
AI is "تولید"

@45000
AI is "تکمیل"
note bottom
  مدت: ~36s
  محدودیت: < 90s ✓
  {AI.duration < 90s}
end note

' مرحله ۶: پس‌پردازش (45-48s)
@45000
PP is "پردازش"

@47000
PP is "تکمیل"
note bottom
  مدت: ~2s
  محدودیت: < 3s ✓
  {PP.duration < 3s}
end note

@47000
TOTAL is "تکمیل"
note bottom
  مدت کل: ~47s
  محدودیت: < 120s ✓
  {Total.duration < 120s}
  
  جمع محدودیت‌ها:
  DF(8) + TA(2) + RE(1) +
  ML(5) + AI(90) + PP(3)
  = 109s < 120s ✓
end note

@enduml`,
  },
] as const;