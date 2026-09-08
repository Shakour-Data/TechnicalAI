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
    code: `classDiagram
    direction TB

    class TAEngine {
        <<Core>>
        +analyze()
        +calcTrend()
        +linearRegression()
    }

    class RegimeEngine {
        <<Core>>
        +detectRegime()
        +fuzzyMembership()
        +markovTransition()
        +weightedVote()
    }

    class DecisionGraph {
        <<Core>>
        +buildGraph()
        +computePaths()
        +normalizeWeights()
    }

    class MLEngine {
        <<ML>>
        +trainAdaptive()
        +predict()
        +getCachedWeights()
    }

    class SRAnalyzer {
        <<Analysis>>
        +detectLevels()
        +mlOptimize()
        +computeStrength()
    }

    class AIPostProcessor {
        <<AI>>
        +stripCodes()
        +fixPersian()
        +validatePrices()
        +fixDirection()
    }

    class ZaiShared {
        <<Infra>>
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

    note for TAEngine "این نمودار کلاس‌های اصلی دامنه و مسئولیت‌های کلیدی آن‌ها را نمایش می‌دهد. هر کلاس نقش محوری در سامانه دارد."`,
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
    code: `classDiagram
    direction TB

    class TAEngine {
        +analyze()
        +calcTrend()
        +linearRegression()
        -indicators Map~string,Function~
        -candlesticks Candlestick[]
    }

    class RegimeEngine {
        +detectRegime()
        +fuzzyMembership()
        +markovTransition()
        +weightedVote()
        -regimes Regime[]
        -transitionMatrix number[][]
    }

    class DecisionGraph {
        +buildGraph()
        +computePaths()
        +normalizeWeights()
        -nodes GraphNode[34]
        -edges GraphEdge[55]
    }

    class MLEngine {
        +trainAdaptive()
        +predict()
        +getCachedWeights()
        -model LogisticRegression
        -cache WeightsCache
    }

    class SRAnalyzer {
        +detectLevels()
        +mlOptimize()
        +computeStrength()
        -levels SRLevel[]
        -strengthThreshold number
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

    TAEngine "1" *-- "1" RegimeEngine : composition
    TAEngine "1" *-- "1" SRAnalyzer : composition
    TAEngine "1" *-- "1" VolumeProfile : composition
    TAEngine "1" *-- "1" CandlestickPatterns : composition

    DecisionGraph "1" o-- "1" MLEngine : aggregation
    DecisionGraph "1" o-- "1..*" ProbabilityTrend : aggregation
    DecisionGraph --> CompositeScores : محاسبه نمرات

    MLEngine "1" *-- "1" BayesianWeights : composition
    MLEngine --> AnalysisMLSelector : انتخاب روش

    CompositeScores --> TAEngine : اندیکاتورها
    CompositeScores --> SRAnalyzer : سطوح

    AIPostProcessor --> ZaiShared : فراخوانی AI
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
    end note`,
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
    code: `classDiagram
    direction TB

    class BaseEngine {
        <<abstract>>
        #logger Logger
        #config EngineConfig
        +initialize(config EngineConfig) Promise~void~
        +shutdown() Promise~void~
        #validateInput(data MarketData) boolean
    }

    class TAEngine {
        -_indicators Map~string,IndicatorFn~
        -_candlesticks Candlestick[]
        -_results AnalysisResult[]
        -_regimeEngine RegimeEngine
        -_srAnalyzer SRAnalyzer
        -_volumeProfile VolumeProfile
        -_patterns CandlestickPatterns
        +constructor(config EngineConfig)
        +analyze(symbol string, period Period) Promise~AnalysisResult~
        +calcTrend(data number[]) TrendDirection
        +linearRegression(x number[], y number[]) RegressionResult
        +getIndicator(name string) IndicatorFn
        +listIndicators() string[]
        +computeRSI(candles Candlestick[], period number) number[]
        +computeMACD(candles Candlestick[], fast number, slow number, signal number) MACDResult
        +computeBollinger(candles Candlestick[], period number, stdDev number) BollingerResult
        +computeStochastic(candles Candlestick[], kPeriod number, dPeriod number) StochasticResult
        +computeADX(candles Candlestick[], period number) number
        +computeATR(candles Candlestick[], period number) number
        -preprocessData(raw RawData) Candlestick[]
        -cacheResult(key string, result AnalysisResult)
    }

    class RegimeEngine {
        -_regimes Regime[]
        -_transitionMatrix number[][]
        -_fuzzySets FuzzySet[]
        -_currentRegime Regime
        +constructor(config RegimeConfig)
        +detectRegime(marketData MarketData) Promise~RegimeResult~
        +fuzzyMembership(value number, set FuzzySet) number
        +markovTransition(current Regime, next Regime) number
        +weightedVote(regimes RegimeResult[]) RegimeResult
        +getCurrentRegime() Regime
        +getTransitionMatrix() number[][]
        -initializeFuzzySets() FuzzySet[]
        -computeTransitionProb(history Regime[]) number[][]
    }

    class DecisionGraph {
        -_nodes Map~string,GraphNode~
        -_edges GraphEdge[]
        -_adjacency Map~string,GraphNodeSet~
        -_weights Map~string,number~
        +constructor()
        +buildGraph(regime RegimeResult, analysis AnalysisResult)
        +computePaths(start string, end string) Path[]
        +normalizeWeights()
        +addNode(node GraphNode)
        +addEdge(from string, to string, weight number)
        +getNode(id string) GraphNode
        +getEdge(from string, to string) GraphEdge
        +topologicalSort() string[]
        +shortestPath(source string, target string) Path
        -validateAcyclic() boolean
        -propagateWeights()
    }

    class MLEngine {
        -_model LogisticRegression
        -_cache WeightsCache
        -_featureNames string[]
        -_bayesianWeights BayesianWeights
        +constructor(modelPath string)
        +trainAdaptive(features Feature[][], labels number[]) TrainingResult
        +predict(features Feature[]) PredictionResult
        +getCachedWeights(modelId string) Weights
        +updateModel(data TrainingData) Promise~void~
        +evaluate(testData TestData[]) EvaluationMetrics
        +featureImportance() Map~string,number~
        -preprocessFeatures(raw Feature[][]) Feature[][]
        -splitTrainTest(data Data[], ratio number) SplitResult
        -saveModel(path string) Promise~void~
        -loadModel(path string) Promise~void~
    }

    class SRAnalyzer {
        -_levels SRLevel[]
        -_strengthThreshold number
        -_mlOptimizer MLEngine
        +constructor(threshold number)
        +detectLevels(candles Candlestick[], method SRMethod) SRLevel[]
        +mlOptimize(levels SRLevel[], features Feature[]) SRLevel[]
        +computeStrength(level SRLevel, candles Candlestick[]) number
        +mergeLevels(levels SRLevel[], tolerance number) SRLevel[]
        +classifyLevels(levels SRLevel[]) ClassifiedSR
        +getNearestLevels(price number, count number) SRLevel[]
        -calculateTouchCount(level number, candles Candlestick[]) number
        -computeVolumeAtLevel(level number, profile VolumeProfile) number
    }

    class AIPostProcessor {
        -_codePatterns RegExp[]
        -_persianRules PersianFixRule[]
        +constructor()
        +stripCodes(text string) string
        +fixPersian(text string) string
        +validatePrices(text string, currentPrice number) ValidationResult
        +fixDirection(text string, trend TrendDirection) string
        +process(text string, context AIContext) string
        -applyPersianTypographics(text string) string
        -normalizeNumbers(text string) string
        -fixZwnj(text string) string
    }

    class ZaiShared {
        -_client ZAIClient
        -_rateLimiter RateLimiter
        -_cache ResponseCache
        +constructor(apiKey string)
        +dedicatedAIChatCompletion(params ChatParams) Promise~ChatResponse~
        +rateLimitedPageReader(url string) Promise~PageContent~
        +getZai() ZAIClient
        +setRateLimit(rps number)
        +clearCache()
        -enforceRateLimit() Promise~void~
        -cacheResponse(key string, response ChatResponse)
        -handleError(error APIError) never
    }

    class ProbabilityTrend {
        -_cdf Map~number,number~
        -_trend TrendResult
        +constructor()
        +calculateCDF(data number[]) Map~number,number~
        +buildTrend(cdf Map~number,number~) TrendResult
        +getInterpretation(trend TrendResult) PersianInterpretation
        +getConfidence() number
        -fitDistribution(data number[]) DistributionFit
    }

    class BayesianWeights {
        -_prior Map~string,number~
        -_posterior Map~string,number~
        -_likelihood Map~string,number~
        +constructor(prior Map~string,number~)
        +updateWeights(evidence Evidence) Map~string,number~
        +prior() Map~string,number~
        +posterior() Map~string,number~
        -computeLikelihood(evidence Evidence) Map~string,number~
        -normalize(weights Map~string,number~) Map~string,number~
    }

    class VolumeProfile {
        -_bins VolumeBin[]
        -_pocPrice number
        +constructor(binSize number)
        +approximate(candles Candlestick[]) VolumeBin[]
        +countTouch(price number, tolerance number) number
        +poc() number
        +getVA(high boolean) number
        -binCandles(candles Candlestick[]) VolumeBin[]
    }

    class CandlestickPatterns {
        -_detected PatternResult[]
        +constructor()
        +detectClassic(candles Candlestick[]) PatternResult[]
        +detectHarmonic(candles Candlestick[], minLen number) PatternResult[]
        +detectElliott(candles Candlestick[]) PatternResult[]
        +getPattern(name string) PatternResult
        -matchDoji(candle Candlestick) boolean
        -matchEngulfing(prev Candlestick, curr Candlestick) boolean
        -matchHammer(candle Candlestick) boolean
    }

    BaseEngine <|-- TAEngine
    BaseEngine <|-- RegimeEngine
    BaseEngine <|-- MLEngine

    TAEngine "1" *-- "1" RegimeEngine : _regimeEngine
    TAEngine "1" *-- "1" SRAnalyzer : _srAnalyzer
    TAEngine "1" *-- "1" VolumeProfile : _volumeProfile
    TAEngine "1" *-- "1" CandlestickPatterns : _patterns

    DecisionGraph "1" o-- "1" MLEngine
    DecisionGraph "1" o-- "0..*" ProbabilityTrend

    MLEngine "1" *-- "1" BayesianWeights : _bayesianWeights
    SRAnalyzer --> "0..1" MLEngine : _mlOptimizer

    AIPostProcessor --> ZaiShared`,
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
    code: `classDiagram
    direction TB

    class session {
        <<instance>>
        +symbol : فولاد
        +period : daily
        +startTime : 1403/12/15 09:00
        +status : completed
    }

    class taEngine {
        <<instance>>
        +indicators : 63
        +candlestickCount : 250
        +lastAnalysis : 1403/12/15
    }

    class regimeEngine {
        <<instance>>
        +currentRegime : روند صعودی
        +confidence : 0.78
        +fuzzyMembership : 0.82
    }

    class decisionGraph {
        <<instance>>
        +nodeCount : 34
        +edgeCount : 55
        +bestPath : N1→N5→N12→N28→N34
        +pathWeight : 0.85
    }

    class mlEngine {
        <<instance>>
        +modelType : LogisticRegression
        +accuracy : 0.74
        +cachedWeightsId : w_v4_2024
    }

    class srAnalyzer {
        <<instance>>
        +supportLevels : 8500, 8200, 7900
        +resistanceLevels : 9200, 9500, 9800
        +nearestSupport : 8500
        +nearestResistance : 9200
    }

    class result {
        <<instance>>
        +trend : صعودی
        +strength : 0.72
        +recommendation : خرید
        +confidence : 0.81
    }

    session --> taEngine : استفاده
    taEngine --> regimeEngine : تشخیص رژیم
    taEngine --> srAnalyzer : شناسایی سطوح
    taEngine --> decisionGraph : ساخت گراف
    decisionGraph --> mlEngine : پیش‌بینی
    taEngine --> result : تولید نتیجه

    note for session "نشست تحلیل نماد فولاد در تاریخ ۱۵ اسفند ۱۴۰۳ با نتیجه نهایی خرید"`,
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
    code: `classDiagram
    direction TB

    class probTrend {
        <<instance>>
        +cdfPoints : 50
        +distribution : normal
        +trendValue : 0.68
        +interpretation : احتمال روند صعودی متوسط
    }

    class bayesianWeights {
        <<instance>>
        +prior_RSI : 0.15
        +prior_MACD : 0.20
        +prior_ADX : 0.12
        +prior_SR : 0.18
        +prior_Volume : 0.10
        +prior_Pattern : 0.25
        +posterior_RSI : 0.18
        +posterior_MACD : 0.22
        +posterior_ADX : 0.10
        +posterior_SR : 0.20
        +posterior_Volume : 0.08
        +posterior_Pattern : 0.22
        +evidence : last_30_candles
    }

    class compositeScores {
        <<instance>>
        +trendStrength : 0.72
        +srStrength : 0.65
        +volumeStrength : 0.58
        +patternStrength : 0.81
        +overallScore : 0.69
    }

    class mlSelector {
        <<instance>>
        +selectedCombination : RSI+MACD+SR+Pattern
        +selectedMethods : classic, ml_hybrid
        +score : 0.88
    }

    class cdfData {
        <<instance>>
        +x : -2.0, -1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0
        +y : 0.02, 0.07, 0.16, 0.31, 0.50, 0.69, 0.84, 0.93, 0.98
    }

    probTrend --> cdfData : داده‌های CDF
    bayesianWeights --> compositeScores : وزن‌دهی
    mlSelector --> compositeScores : روش‌های انتخابی
    compositeScores --> probTrend : نمرات ورودی

    note for bayesianWeights "وزن‌های بیزی پسین پس از مشاهده ۳۰ کندل آخر به‌روز شده. الگوی SR و Pattern بیشترین وزن را دارند."`,
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
    code: `classDiagram
    direction TB

    class mslv4 {
        <<instance>>
        +school : کلاسیک_تکنیکال
        +style : رسمی_بازار
        +tone : محافظه‌کار
        +schoolIdx : 2
        +styleIdx : 1
        +toneIdx : 4
        +combinationId : 2-1-4
        +totalCombinations : 180
    }

    class aiPostProcessor {
        <<instance>>
        +rawInput : تحلیل نماد فولاد روند صعودی دارد
        +afterStripCodes : تحلیل نماد فولاد روند صعودی دارد
        +afterFixPersian : تحلیل نماد فولاد روند صعودی دارد
        +afterValidate : قیمت ۸۹۰۰ در محدوده معتبر
        +afterFixDirection : روند صعودی با حرکت رو به بالا
        +codePatterns : 5
        +persianRules : 12
    }

    class zaiShared {
        <<instance>>
        +apiKey : sk-***...***
        +rateLimit : 10
        +currentRPS : 3.2
        +cacheSize : 256
        +lastCallTime : 1403/12/15 10:32:15
        +pendingRequests : 0
    }

    class chatParams {
        <<instance>>
        +model : gpt-4o-mini
        +temperature : 0.7
        +maxTokens : 2048
        +systemPrompt : شما تحلیلگر تکنیکال هستید...
        +userMessage : تحلیل فولاد با رژیم صعودی...
    }

    class chatResponse {
        <<instance>>
        +id : chatcmpl-abc123
        +content : تحلیل نماد فولاد...
        +tokensUsed : 487
        +finishReason : stop
        +latency : 1240
    }

    mslv4 --> chatParams : تنظیم پرامپت
    chatParams --> zaiShared : فراخوانی API
    zaiShared --> chatResponse : پاسخ خام
    chatResponse --> aiPostProcessor : پردازش خروجی

    note for mslv4 "ترکیب مکتب×سبک×لحن: ۶ × ۵ × ۶ = ۱۸۰ حالت. کد ترکیب فعلی: 2-1-4"

    note for aiPostProcessor "خط لوله پردازش: ۱. حذف کدهای مارکداون ۲. اصلاح نیم‌فاصله و تایپوگرافی ۳. اعتبارسنجی قیمت‌ها ۴. اصلاح جهت روند"`,
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
    code: `flowchart TB
    classDef presentation fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef api fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    classDef analysis fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef ml fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px,color:#000
    classDef data fill:#fce4ec,stroke:#c62828,stroke-width:2px,color:#000
    classDef infra fill:#eceff1,stroke:#37474f,stroke-width:2px,color:#000

    subgraph S1 ["لایه ارائه<br/>Presentation"]
        UI["رابط کاربری وب<br/>Web UI"]:::presentation
        Charts["نمودارها و گراف‌ها<br/>Charts & Graphs"]:::presentation
    end

    subgraph S2 ["لایه API"]
        API["اندپوینت‌های REST<br/>REST Endpoints"]:::api
    end

    subgraph S3 ["لایه تحلیل<br/>Analysis"]
        TA["موتور تحلیل تکنیکال<br/>TA Engine"]:::analysis
        DG["گراف تصمیم‌گیری<br/>Decision Graph"]:::analysis
        SR["شناسایی S/R<br/>SR Analyzer"]:::analysis
    end

    subgraph S4 ["لایه یادگیری ماشین<br/>ML"]
        ML["موتور ML<br/>ML Engine"]:::ml
        BW["وزن‌دهی بیزی<br/>Bayesian Weights"]:::ml
    end

    subgraph S5 ["لایه داده<br/>Data"]
        Data["منابع داده بورس<br/>Market Data Sources"]:::data
    end

    subgraph S6 ["لایه زیرساخت<br/>Infrastructure"]
        AI["هوش مصنوعی مشترک<br/>Shared AI"]:::infra
        PP["پردازش‌گر متن<br/>Post Processor"]:::infra
    end

    UI -->|"درخواست HTTP"| API
    Charts -->|"داده نمودار"| API
    API -->|"تحلیل"| TA
    API -->|"تصمیم"| DG
    API -->|"سطوح"| SR
    TA -->|"پیش‌بینی"| ML
    DG -->|"وزن‌ها"| ML
    ML -->|"به‌روزرسانی"| BW
    TA -->|"کندل‌ها"| Data
    SR -->|"قیمت‌ها"| Data
    API -->|"تولید متن"| AI
    AI -->|"پردازش"| PP`,
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
    code: `flowchart TB
    classDef ui fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef api fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    classDef analysis fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef ml fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px,color:#000
    classDef data fill:#fce4ec,stroke:#c62828,stroke-width:2px,color:#000
    classDef infra fill:#eceff1,stroke:#37474f,stroke-width:2px,color:#000

    subgraph UI_Layer ["رابط کاربری"]
        Dash["داشبورد<br/>Dashboard"]:::ui
        AnaPage["صفحه تحلیل<br/>Analysis Page"]:::ui
        HelpPage["صفحه راهنما<br/>Help Page"]:::ui
        Chart["نمودار شمعی<br/>Candlestick Chart"]:::ui
        GraphViz["گراف تصمیم<br/>Decision Viz"]:::ui
    end

    subgraph API_Layer ["API"]
        ApiAnalysis["/api/analysis"]:::api
        ApiInstr["/api/instruments"]:::api
        ApiIndices["/api/indices"]:::api
        ApiAI["/api/ai"]:::api
    end

    subgraph Analysis_Layer ["تحلیل"]
        TA["TAEngine"]:::analysis
        RE["RegimeEngine"]:::analysis
        DG["DecisionGraph"]:::analysis
        SR["SRAnalyzer"]:::analysis
        CP["CandlestickPatterns"]:::analysis
        VP["VolumeProfile"]:::analysis
        PT["ProbabilityTrend"]:::analysis
        CS["CompositeScores"]:::analysis
    end

    subgraph ML_Layer ["یادگیری ماشین"]
        ML["MLEngine"]:::ml
        BW["BayesianWeights"]:::ml
        MLS["AnalysisMLSelector"]:::ml
    end

    subgraph Data_Layer ["منابع داده"]
        TSE["TSEApi"]:::data
        TSETMC["TsetmcIndexApi"]:::data
        TGJU["TgjuApi"]:::data
        YAHOO["YahooApi"]:::data
    end

    subgraph Infra_Layer ["زیرساخت"]
        ZAI["ZaiShared"]:::infra
        PP["AIPostProcessor"]:::infra
        MSL["MSLV4"]:::infra
        RL["RateLimiter"]:::infra
        Cache["Cache"]:::infra
        Log["Logger"]:::infra
    end

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

    RL --> Log`,
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
    code: `flowchart TB
    classDef provided fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef required fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef component fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000

    subgraph Provided ["اینترفیس‌های فراهم‌شده"]
        IAS{{"IAnalysisService<br/>analyze(symbol, period)<br/>getIndicators(symbol)<br/>getTrend(symbol)"}}:::provided
        IRS{{"IRegimeService<br/>detectRegime(data)<br/>getCurrentRegime()"}}:::provided
        IGS{{"IGraphService<br/>buildGraph(regime)<br/>computePaths()"}}:::provided
        ISRS{{"ISRService<br/>detectLevels(symbol)<br/>computeStrength(level)"}}:::provided
        IMLS{{"IMLService<br/>trainAdaptive(features, labels)<br/>predict(features)"}}:::provided
        IDP{{"IDataProvider<br/>fetchCandlesticks(symbol, period)<br/>fetchSymbols()<br/>fetchIndices()"}}:::provided
        IAIS{{"IAIService<br/>chatCompletion(params)<br/>processText(text, context)"}}:::provided
    end

    subgraph Required ["اینترفیس‌های موردنیاز"]
        ICS{{"ICacheService<br/>get(key)<br/>set(key, value, ttl?)<br/>invalidate(pattern)"}}:::required
        IRL{{"IRateLimiter<br/>acquire()<br/>release()<br/>getRemaining()"}}:::required
    end

    subgraph Components ["مؤلفه‌ها"]
        TA["TAEngine"]:::component
        RE["RegimeEngine"]:::component
        DG["DecisionGraph"]:::component
        SR["SRAnalyzer"]:::component
        ML["MLEngine"]:::component
        TSE["TSEApi"]:::component
        ZAI["ZaiShared"]:::component
        CM["CacheManager"]:::component
        RLS["RateLimiterService"]:::component
    end

    TA --- IAS
    TA -.-> IDP
    TA -.-> ICS
    RE --- IRS
    DG --- IGS
    DG -.-> IMLS
    SR --- ISRS
    SR -.-> IMLS
    ML --- IMLS
    ML -.-> ICS
    TSE --- IDP
    TSE -.-> IRL
    ZAI --- IAIS
    ZAI -.-> IRL
    CM --- ICS
    RLS --- IRL`,
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
    code: `flowchart TB
    classDef nodeStyle fill:#e8eaf6,stroke:#283593,stroke-width:2px,color:#000
    classDef artifact fill:#fff8e1,stroke:#f57f17,stroke-width:1px,color:#000
    classDef noteStyle fill:#f5f5f5,stroke:#9e9e9e,stroke-width:1px,color:#666,stroke-dasharray: 5 5

    subgraph Browser ["مرورگر کاربر<br/>Browser"]
        SPAClient["SPA Client"]:::artifact
    end

    subgraph AppServer ["سرور Next.js<br/>Application Server"]
        NextApp["Next.js App"]:::artifact
    end

    subgraph PumlSvr ["سرور PlantUML<br/>Diagram Renderer"]
        PumlArtifact["PlantUML Server"]:::artifact
    end

    subgraph DataSource ["منابع داده بورس<br/>Market Data Sources"]
        TSEAPI["TSE API"]:::artifact
        TSETMCAPI["TSETMC API"]:::artifact
        TGJUAPI["TGJU API"]:::artifact
        YahooAPI["Yahoo API"]:::artifact
    end

    subgraph AIService ["سرویس هوش مصنوعی<br/>AI Service"]
        ZAIAPI["ZAI API"]:::artifact
    end

    Browser -->|"HTTPS"| AppServer
    AppServer -->|"HTTP"| PumlSvr
    AppServer -->|"HTTPS/REST"| DataSource
    AppServer -->|"HTTPS/API"| AIService

    Note1("مرورگر کاربر نقطه ورود<br/>به سامانه تحلیلی است"):::noteStyle
    Note2("منابع داده خارجی بورس<br/>تهران و بازارهای جهانی"):::noteStyle
    Browser -.- Note1
    DataSource -.- Note2`,
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
    code: `flowchart TB
    classDef nodeStyle fill:#e8eaf6,stroke:#283593,stroke-width:2px,color:#000
    classDef artifact fill:#fff8e1,stroke:#f57f17,stroke-width:1px,color:#000

    subgraph Browser ["مرورگر کاربر<br/>Browser"]
        SPA["React SPA"]:::artifact
        Recharts["Recharts"]:::artifact
        D3["D3.js Visuals"]:::artifact
    end

    subgraph NextJS ["سرور Next.js<br/>:3000"]
        API["API Routes"]:::artifact
        TA["TAEngine"]:::artifact
        RE["RegimeEngine"]:::artifact
        DG["DecisionGraph"]:::artifact
        SR["SRAnalyzer"]:::artifact
        ML["MLEngine"]:::artifact
        PP["AIPostProcessor"]:::artifact
        MSL["MSLV4"]:::artifact
        ZAI["ZaiShared"]:::artifact
    end

    subgraph PumlSvr ["سرور PlantUML<br/>:8080"]
        PumlJar["PlantUML Jar"]:::artifact
    end

    subgraph TSESvr ["TSE Server<br/>tsetmc.com"]
        TSEAPI["TSE REST API"]:::artifact
    end

    subgraph TSETMCSvr ["TSETMC Server<br/>tsetmc.com"]
        TSETMCAPI["TSETMC API"]:::artifact
    end

    subgraph TGJUSvr ["TGJU Server<br/>tgju.org"]
        TGJUAPI["TGJU API"]:::artifact
    end

    subgraph YahooSvr ["Yahoo Server<br/>query1.finance.yahoo.com"]
        YahooAPI["Yahoo API"]:::artifact
    end

    subgraph ZAISvr ["ZAI Server<br/>api.z-ai.com"]
        ZAIAPI["ZAI API"]:::artifact
    end

    Browser -->|"HTTPS/JSON<br/>port 443→3000"| NextJS
    NextJS -->|"HTTP<br/>port 3000→8080"| PumlSvr
    NextJS -->|"HTTPS/REST<br/>rate: 1 req/s"| TSESvr
    NextJS -->|"HTTPS/REST<br/>rate: 2 req/s"| TSETMCSvr
    NextJS -->|"HTTPS/REST<br/>rate: 1 req/s"| TGJUSvr
    NextJS -->|"HTTPS/REST<br/>rate: 0.5 req/s"| YahooSvr
    NextJS -->|"HTTPS/REST<br/>rate: 10 req/s"| ZAISvr`,
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
    code: `flowchart TB
    classDef nodeStyle fill:#e8eaf6,stroke:#283593,stroke-width:2px,color:#000
    classDef artifact fill:#fff8e1,stroke:#f57f17,stroke-width:1px,color:#000

    subgraph Browser ["مرورگر کاربر<br/>Chrome 120+ / Firefox 115+ / Safari 17+<br/>OS: Windows 11 / macOS 14 / Ubuntu 22.04<br/>RAM: 8GB+ | Screen: 1920×1080+"]
        BrowserSPA["React 19 SPA<br/>Bundle: ~450KB gzipped<br/>Webpack 5 Turbopack"]:::artifact
        BrowserViz["Recharts 2.12 / D3.js 7.9 / @xyflow/react 12"]:::artifact
    end

    subgraph NextJS ["سرور Next.js 16<br/>Ubuntu 22.04 LTS | Node.js 22.x | Bun 1.2<br/>CPU: 4 vCPU | RAM: 8GB | SSD: 50GB<br/>IP: 10.0.1.10 | Port: 3000"]
        AppCore["Next.js 16 App Router<br/>TypeScript 5.7 / Tailwind CSS 4 / Prisma ORM 6"]:::artifact
        APIRoutes["API Routes: /api/analysis POST /api/instruments GET<br/>/api/indices GET /api/ai POST"]:::artifact
        TAArt["TAEngine v4.2 - 63 indicators - WASM-accelerated"]:::artifact
        MLArt["MLEngine v3.1 - LogisticRegression<br/>Weights Cache: 256 entries"]:::artifact
        ZAIArt["ZaiShared v2.8 - Rate Limit: 10 RPS - Cache TTL: 300s"]:::artifact
    end

    subgraph PumlSvr ["سرور PlantUML<br/>Ubuntu 22.04 | Java 21 | Jetty 12<br/>CPU: 2 vCPU | RAM: 4GB<br/>IP: 10.0.1.20 | Port: 8080"]
        PumlArtifact["PlantUML 1.2024.3 / Graphviz 12.0<br/>Max diagram size: 4096×4096"]:::artifact
    end

    TSE["TSE Server<br/>tsetmc.com:443<br/>REST API | JSON<br/>Rate Limit: 1 req/s | Timeout: 30s"]:::nodeStyle
    TSETMC["TSETMC Server<br/>tsetmc.com:443<br/>Direct Fetch + API<br/>Rate Limit: 2 req/s | Timeout: 15s"]:::nodeStyle
    TGJU["TGJU Server<br/>tgju.org:443<br/>REST + Scraping<br/>Rate Limit: 1 req/s | Timeout: 20s"]:::nodeStyle
    Yahoo["Yahoo Finance<br/>query1.finance.yahoo.com:443<br/>v8 API | JSON<br/>Rate Limit: 0.5 req/s | Timeout: 10s"]:::nodeStyle
    ZAISvr["ZAI API Server<br/>api.z-ai.com:443<br/>OpenAI-compatible API<br/>Rate Limit: 10 RPS | Model: gpt-4o-mini<br/>Max Tokens: 4096"]:::nodeStyle

    Browser -->|"443 → 3000 / H2 keep-alive / CORS: enabled"| NextJS
    NextJS -->|"3000 → 8080 / PlantUML text POST / PNG-SVG response"| PumlSvr
    NextJS -->|"REST/JSON / X-API-Key header / Retry: 3 backoff"| TSE
    NextJS -->|"Direct+API / Cookie auth / Retry: 3"| TSETMC
    NextJS -->|"REST+Scrape / User-Agent rotation / Retry: 2"| TGJU
    NextJS -->|"v8 API / crumb auth / Retry: 2"| Yahoo
    NextJS -->|"Bearer token / Streaming: yes / Retry: 3 backoff"| ZAISvr`,
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
    code: `flowchart TB
    classDef application fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef library fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef ui fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    classDef service fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px,color:#000
    classDef noteStyle fill:#f5f5f5,stroke:#9e9e9e,stroke-width:1px,color:#666,stroke-dasharray: 5 5

    subgraph PkgApp ["app «application»"]
        App["صفحات Next.js App Router"]:::application
    end

    subgraph PkgLib ["lib «library»"]
        Lib["کتابخانه‌های تحلیلی و ML"]:::library
    end

    subgraph PkgComponents ["components «ui»"]
        Comp["مؤلفه‌های رابط کاربری React"]:::ui
    end

    subgraph PkgApi ["api «service»"]
        Api["اندپوینت‌های REST API"]:::service
    end

    App -.->|"استفاده"| Comp
    App -.->|"فراخوانی"| Api
    Api -.->|"استفاده"| Lib
    Comp -.->|"داده تحلیلی"| Lib

    NoteApp("بسته برنامه اصلی<br/>شامل صفحات و لایه‌ها<br/>app/analysis, app/help"):::noteStyle
    NoteLib("بسته کتابخانه‌ها<br/>شامل تمام موتورهای<br/>تحلیلی و یادگیری ماشین"):::noteStyle
    App -.- NoteApp
    Lib -.- NoteLib`,
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
    code: `flowchart TB
    classDef appPkg fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef libPkg fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef compPkg fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    classDef apiPkg fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px,color:#000

    subgraph PkgApp ["app"]
        subgraph PkgAppAnalysis ["app/analysis"]
            AppAnalysis["صفحه تحلیل نماد"]:::appPkg
        end
        subgraph PkgAppHelp ["app/help"]
            AppHelp["صفحه راهنما"]:::appPkg
        end
        subgraph PkgAppScenarios ["app/scenarios"]
            AppScenarios["صفحه سناریوها"]:::appPkg
        end
    end

    subgraph PkgLib ["lib"]
        subgraph PkgLibTa ["lib/ta"]
            LibTa["TAEngine, RegimeEngine<br/>ProbabilityTrend, CompositeScores"]:::libPkg
        end
        subgraph PkgLibMl ["lib/ml"]
            LibMl["MLEngine, BayesianWeights<br/>AnalysisMLSelector"]:::libPkg
        end
        subgraph PkgLibAi ["lib/ai"]
            LibAi["AIPostProcessor, MSLV4<br/>ZaiShared"]:::libPkg
        end
        subgraph PkgLibData ["lib/data"]
            LibData["TSEApi, TsetmcIndexApi<br/>TgjuApi, YahooApi"]:::libPkg
        end
        subgraph PkgLibSr ["lib/sr"]
            LibSr["SRAnalyzer, VolumeProfile"]:::libPkg
        end
        subgraph PkgLibGraph ["lib/graph"]
            LibGraph["DecisionGraph<br/>CandlestickPatterns"]:::libPkg
        end
    end

    subgraph PkgComponents ["components"]
        subgraph PkgCompAnalysis ["components/analysis"]
            CompAnalysis["کارت تحلیل، نوار اندیکاتور"]:::compPkg
        end
        subgraph PkgCompCharts ["components/charts"]
            CompCharts["نمودار شمعی، گراف تصمیم"]:::compPkg
        end
        subgraph PkgCompUi ["components/ui"]
            CompUi["shadcn/ui primitives"]:::compPkg
        end
    end

    subgraph PkgApi ["api"]
        subgraph PkgApiAnalysis ["api/analysis"]
            ApiAnalysis["POST /api/analysis"]:::apiPkg
        end
        subgraph PkgApiInstruments ["api/instruments"]
            ApiInstruments["GET /api/instruments"]:::apiPkg
        end
        subgraph PkgApiIndices ["api/indices"]
            ApiIndices["GET /api/indices"]:::apiPkg
        end
        subgraph PkgApiAi ["api/ai"]
            ApiAi["POST /api/ai"]:::apiPkg
        end
    end

    AppAnalysis -.-> ApiAnalysis
    AppAnalysis -.-> ApiInstruments
    AppHelp -.-> ApiInstruments
    AppScenarios -.-> ApiAnalysis

    ApiAnalysis -.-> LibTa
    ApiAnalysis -.-> LibGraph
    ApiAnalysis -.-> LibSr
    ApiAnalysis -.-> LibMl
    ApiInstruments -.-> LibData
    ApiIndices -.-> LibData
    ApiAi -.-> LibAi

    LibTa -.-> LibData
    LibTa -.-> LibMl
    LibGraph -.-> LibMl
    LibSr -.-> LibData
    LibSr -.-> LibMl

    CompAnalysis -.-> LibTa
    CompCharts -.-> LibGraph`,
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
    code: `flowchart TB
    classDef taPkg fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef mlPkg fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px,color:#000
    classDef aiPkg fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef srPkg fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    classDef graphPkg fill:#fce4ec,stroke:#c62828,stroke-width:2px,color:#000
    classDef dataPkg fill:#eceff1,stroke:#37474f,stroke-width:2px,color:#000

    subgraph PkgLibTa ["lib/ta"]
        TAEngine["TAEngine"]:::taPkg
        RegimeEngine["RegimeEngine"]:::taPkg
        ProbabilityTrend["ProbabilityTrend"]:::taPkg
        CompositeScores["CompositeScores"]:::taPkg
        CandlestickPatterns["CandlestickPatterns"]:::taPkg
    end

    subgraph PkgLibMl ["lib/ml"]
        MLEngine["MLEngine"]:::mlPkg
        BayesianWeights["BayesianWeights"]:::mlPkg
        AnalysisMLSelector["AnalysisMLSelector"]:::mlPkg
    end

    subgraph PkgLibAi ["lib/ai"]
        AIPostProcessor["AIPostProcessor"]:::aiPkg
        MSLV4["MSLV4"]:::aiPkg
        ZaiShared["ZaiShared"]:::aiPkg
    end

    subgraph PkgLibSr ["lib/sr"]
        SRAnalyzer["SRAnalyzer"]:::srPkg
        VolumeProfile["VolumeProfile"]:::srPkg
    end

    subgraph PkgLibGraph ["lib/graph"]
        DecisionGraph["DecisionGraph"]:::graphPkg
    end

    subgraph PkgLibData ["lib/data"]
        TSEApi["TSEApi"]:::dataPkg
        TsetmcIndexApi["TsetmcIndexApi"]:::dataPkg
        TgjuApi["TgjuApi"]:::dataPkg
        YahooApi["YahooApi"]:::dataPkg
    end

    TAEngine -.->|"import"| RegimeEngine
    TAEngine -.->|"import"| SRAnalyzer
    TAEngine -.->|"import"| VolumeProfile
    TAEngine -.->|"import"| CandlestickPatterns
    TAEngine -.->|"import"| TSEApi
    TAEngine -.->|"import"| MLEngine

    DecisionGraph -.->|"import"| MLEngine
    DecisionGraph -.->|"import"| ProbabilityTrend
    DecisionGraph -.->|"import"| RegimeEngine

    SRAnalyzer -.->|"import"| MLEngine
    SRAnalyzer -.->|"import"| VolumeProfile
    SRAnalyzer -.->|"import"| TSEApi

    CompositeScores -.->|"import"| TAEngine
    CompositeScores -.->|"import"| SRAnalyzer

    AIPostProcessor -.->|"import"| ZaiShared
    AIPostProcessor -.->|"import"| MSLV4

    MLEngine -.->|"import"| BayesianWeights
    MLEngine -.->|"import"| AnalysisMLSelector

    ProbabilityTrend -.->|"import"| CompositeScores`,
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
    code: `classDiagram
    direction TB

    class TAEngine {
        <<component>>
        +analyze() AnalysisResult
        +calcTrend() TrendDirection
    }

    class marketData {
        <<port in>>
        +receive(data MarketData)
    }

    class analysisResult {
        <<port out>>
        +send(result AnalysisResult)
    }

    class trendSignal {
        <<port out>>
        +send(signal TrendDirection)
    }

    class RegimeEngine {
        <<part>>
        +detectRegime() RegimeResult
    }

    class SRAnalyzer {
        <<part>>
        +detectLevels() SRLevel[]
    }

    class VolumeProfile {
        <<part>>
        +approximate() VolumeBin[]
    }

    class CandlestickPatterns {
        <<part>>
        +detectClassic() PatternResult[]
    }

    class ProbabilityTrend {
        <<part>>
        +calculateCDF() Map~number,number~
    }

    class IndicatorCalculator {
        <<part>>
        +compute(indicator string) number[]
    }

    class ResultAggregator {
        <<part>>
        +aggregate() AnalysisResult
    }

    TAEngine *-- RegimeEngine : part
    TAEngine *-- SRAnalyzer : part
    TAEngine *-- VolumeProfile : part
    TAEngine *-- CandlestickPatterns : part
    TAEngine *-- ProbabilityTrend : part
    TAEngine *-- IndicatorCalculator : part
    TAEngine *-- ResultAggregator : part

    marketData --> RegimeEngine : input
    marketData --> SRAnalyzer : input
    marketData --> VolumeProfile : input
    marketData --> CandlestickPatterns : input

    RegimeEngine --> IndicatorCalculator : regimeInfo
    SRAnalyzer --> IndicatorCalculator : srLevels
    VolumeProfile --> SRAnalyzer : volumeData
    CandlestickPatterns --> IndicatorCalculator : patterns
    IndicatorCalculator --> ProbabilityTrend : indicatorValues
    ProbabilityTrend --> ResultAggregator : trendData
    ResultAggregator --> analysisResult : output
    ProbabilityTrend --> trendSignal : output

    note for TAEngine "TAEngine به‌صورت ترکیب شامل ۵ بخش همکار است: RegimeEngine: تشخیص رژیم, SRAnalyzer: سطوح S/R, VolumeProfile: پروفایل حجم, CandlestickPatterns: الگوها, ProbabilityTrend: روند احتمالی"`,
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
    code: `classDiagram
    direction TB

    class DecisionGraph {
        <<component>>
        +buildGraph() void
        +computePaths() Path[]
        +normalizeWeights() void
    }

    class regimeInput {
        <<port in>>
        +receive(regime RegimeResult)
    }

    class analysisInput {
        <<port in>>
        +receive(analysis AnalysisResult)
    }

    class decisionOutput {
        <<port out>>
        +send(path DecisionPath)
    }

    class confidenceOutput {
        <<port out>>
        +send(confidence number)
    }

    class GraphBuilder {
        <<part>>
        +buildFromRegime(regime RegimeResult)
        +addAnalysisNodes(analysis AnalysisResult)
        -nodeFactory NodeFactory
        -edgeFactory EdgeFactory
    }

    class PathComputer {
        <<part>>
        +computeAllPaths() Path[]
        +shortestPath(source string, target string) Path
        +topologicalSort() string[]
        -adjacencyList Map
    }

    class WeightNormalizer {
        <<part>>
        +normalizeWeights()
        +applyDecay(factor number)
        +rebalance()
        -totalWeight number
    }

    class MLEngineRole {
        <<provided role>>
        +predict(features Feature[]) PredictionResult
    }

    DecisionGraph *-- GraphBuilder : part
    DecisionGraph *-- PathComputer : part
    DecisionGraph *-- WeightNormalizer : part
    DecisionGraph o-- MLEngineRole : provided

    regimeInput --> GraphBuilder : input
    analysisInput --> GraphBuilder : input
    GraphBuilder --> PathComputer : rawGraph
    PathComputer --> WeightNormalizer : weightedPaths
    WeightNormalizer --> MLEngineRole : features
    MLEngineRole --> WeightNormalizer : predictions
    WeightNormalizer --> decisionOutput : output
    WeightNormalizer --> confidenceOutput : output

    note for GraphBuilder "GraphBuilder گراف را با ۳۴ گره و ۵۵ یال می‌سازد بر اساس رژیم و تحلیل جاری"

    note for PathComputer "PathComputer مسیرهای تصمیم را محاسبه می‌کند با الگوریتم دیکسترا"`,
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
    code: `classDiagram
    direction TB

    class IMarketDataProvider {
        <<role>>
        +getCandlesticks(symbol string) Candlestick[]
    }

    class IIndicatorProvider {
        <<role>>
        +getIndicatorValues(name string) number[]
    }

    class IPredictionProvider {
        <<role>>
        +getPrediction(symbol string) PredictionResult
    }

    class IResultConsumer {
        <<role>>
        +accept(result ProbabilityResult)
    }

    class MarketDataFetcher {
        <<dataProvider role>>
        +fetch(symbol string) Candlestick[]
    }

    class TAEngine {
        <<analyzer role>>
        +analyze(symbol string) AnalysisResult
    }

    class RegimeEngine {
        <<regimeDetector role>>
        +detectRegime(marketData MarketData) RegimeResult
    }

    class MLEngine {
        <<predictor role>>
        +predict(features Feature[]) PredictionResult
    }

    class ProbabilityTrend {
        <<aggregator role>>
        +calculateCDF(data number[]) Map~number,number~
    }

    class CompositeScores {
        <<resultConsumer role>>
        +calcTrendStrength() number
        +calcSRStrength() number
    }

    MarketDataFetcher --> TAEngine : Candlestick[] sync
    TAEngine --> ProbabilityTrend : Map~string,number[]~ async
    TAEngine --> RegimeEngine : MarketData sync
    RegimeEngine --> ProbabilityTrend : RegimeResult sync
    MLEngine --> ProbabilityTrend : PredictionResult async
    TAEngine --> MLEngine : Feature[] sync
    ProbabilityTrend --> CompositeScores : ProbabilityResult async

    IMarketDataProvider <|.. MarketDataFetcher : realizes
    IIndicatorProvider <|.. TAEngine : realizes
    IPredictionProvider <|.. MLEngine : realizes
    IResultConsumer <|.. CompositeScores : realizes

    note for ProbabilityTrend "ProbabilityTrend نقش تجمیع‌گر دارد. ورودی‌ها: اندیکاتورها از TAEngine, رژیم از RegimeEngine, پیش‌بینی از MLEngine. خروجی: نتیجه احتمال با CDF"`,
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
    code: `classDiagram
    direction TB

    class Stereotype {
        <<stereotype>>
    }

    class Metaclass {
        <<metaclass>>
    }

    class Engine {
        <<stereotype>>
        +نوع : موتورهای تحلیلی اصلی
        +مثال : TAEngine, RegimeEngine
    }

    class API {
        <<stereotype>>
        +نوع : سرویس‌های داده خارجی
        +مثال : TSEApi, YahooApi
    }

    class DataStore {
        <<stereotype>>
        +نوع : ذخیره‌سازی و کش
        +مثال : Cache, WeightsCache
    }

    class AI {
        <<stereotype>>
        +نوع : مؤلفه‌های هوش مصنوعی
        +مثال : ZaiShared, MSLV4
    }

    class Analyzer {
        <<stereotype>>
        +نوع : تحلیل‌گرهای تخصصی
        +مثال : SRAnalyzer, VolumeProfile
    }

    class Processor {
        <<stereotype>>
        +نوع : پردازش‌گرهای خروجی
        +مثال : AIPostProcessor
    }

    class ClassMeta {
        <<metaclass>>
    }

    class CompMeta {
        <<metaclass>>
    }

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

    note for Engine "کلیشه Engine برای موتورهای تحلیلی که هسته سامانه هستند"

    note for AI "کلیشه AI برای مؤلفه‌های مبتنی بر هوش مصنوعی"`,
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
    code: `classDiagram
    direction TB

    class Engine {
        <<stereotype>>
        +cacheTTL : int = 300
        +accelerated : boolean = false
        +engineVersion : string
    }

    class API {
        <<stereotype>>
        +maxRPS : double = 1.0
        +disableCache : boolean = false
        +requestTimeout : int = 30000
        +maxRetries : int = 3
    }

    class AI {
        <<stereotype>>
        +maxRPS : double = 10.0
        +supportsStreaming : boolean = true
        +cacheTTL : int = 300
        +maxTokens : int = 4096
    }

    class DataStore {
        <<stereotype>>
        +defaultTTL : int = 300
        +maxSize : int = 1000
        +evictionPolicy : string = LRU
    }

    class Analyzer {
        <<stereotype>>
        +cacheTTL : int = 600
        +threshold : double = 0.5
    }

    note for Engine "کلیشه Engine با برچسب‌ها: cached - نتایج کش می‌شوند, wasm - شتاب‌دهی WASM, version - نسخه موتور"

    note for API "کلیشه API با برچسب‌ها: rateLimited - محدود نرخ, noCache - بدون کش, timeout - مهلت درخواست, retry - حداکثر تلاش مجدد"

    note for AI "کلیشه AI با برچسب‌ها: rateLimited - محدود نرخ, streaming - پشتیبانی جریانی, cached - کش پاسخ‌ها, tokenLimit - سقف توکن"`,
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
    code: `classDiagram
    direction TB

    class TAEngine {
        <<Engine>>
        +analyze() AnalysisResult
        +calcTrend() TrendDirection
        +cacheTTL : 300
        +accelerated : true
        +engineVersion : 4.2
    }

    class RegimeEngine {
        <<Engine>>
        +detectRegime() RegimeResult
        +fuzzyMembership() number
        +cacheTTL : 600
        +accelerated : false
        +engineVersion : 3.0
    }

    class MLEngine {
        <<Engine>>
        +trainAdaptive() TrainingResult
        +predict() PredictionResult
        +cacheTTL : 3600
        +accelerated : false
        +engineVersion : 3.1
    }

    class TSEApi {
        <<API>>
        +fetchCandlesticks() Candlestick[]
        +fetchSymbols() Symbol[]
        +maxRPS : 1.0
        +disableCache : false
        +requestTimeout : 30000
        +maxRetries : 3
    }

    class TsetmcIndexApi {
        <<API>>
        +fetchMainIndex() IndexData
        +maxRPS : 2.0
        +disableCache : true
        +requestTimeout : 15000
    }

    class TgjuApi {
        <<API>>
        +fetchHistory() HistoricalData
        +maxRPS : 1.0
        +requestTimeout : 20000
        +maxRetries : 2
    }

    class YahooApi {
        <<API>>
        +fetchHistory() HistoricalData
        +maxRPS : 0.5
        +requestTimeout : 10000
        +maxRetries : 2
    }

    class ZaiShared {
        <<AI>>
        +dedicatedAIChatCompletion() ChatResponse
        +rateLimitedPageReader() PageContent
        +maxRPS : 10.0
        +supportsStreaming : true
        +cacheTTL : 300
        +maxTokens : 4096
    }

    class AIPostProcessor {
        <<Processor>>
        +stripCodes() string
        +fixPersian() string
        +validatePrices() ValidationResult
    }

    class SRAnalyzer {
        <<Analyzer>>
        +detectLevels() SRLevel[]
        +computeStrength() number
        +cacheTTL : 600
        +threshold : 0.5
    }

    class VolumeProfile {
        <<Analyzer>>
        +approximate() VolumeBin[]
        +poc() number
        +cacheTTL : 300
    }

    note for TAEngine "OCL: context TAEngine inv: self.cacheTTL > 0 and self.engineVersion.isNotEmpty()"

    note for TSEApi "OCL: context TSEApi inv: self.maxRPS > 0 and self.requestTimeout > 0 and self.maxRetries >= 0"

    note for ZaiShared "OCL: context ZaiShared inv: self.maxRPS > 0 and self.maxTokens > 0 and self.cacheTTL > 0"

    note for MLEngine "OCL: context MLEngine inv: self.cacheTTL >= 300 and self.engineVersion.startsWith(3.)"

    note for SRAnalyzer "OCL: context SRAnalyzer inv: self.threshold >= 0.0 and self.threshold <= 1.0"`,
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
    code: `flowchart TB
    classDef actor fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef usecase fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef note fill:#f3e5f5,stroke:#7b1fa2,stroke-width:1px,color:#000,font-style:italic

    User{{"کاربر<br/>(User)"}}:::actor
    Admin{{"مدیر سامانه<br/>(SystemAdmin)"}}:::actor
    DataSource{{"منبع داده<br/>(DataSource)"}}:::actor

    subgraph System["سامانه تحلیل تکنیکال مالی ایران"]
        UC1("تحلیل نماد<br/>(Analyze Symbol)"):::usecase
        UC2("مشاهده شاخص‌ها<br/>(View Indicators)"):::usecase
        UC3("تولید گزارش هوش مصنوعی<br/>(Generate AI Report)"):::usecase
        UC4("مدیریت شاخص‌ها<br/>(Manage Indices)"):::usecase
        UC5("واکشی داده‌های بازار<br/>(Fetch Market Data)"):::usecase
        UC6("پیکربندی سامانه<br/>(System Configuration)"):::usecase
    end

    User --> UC1
    User --> UC2
    User --> UC3
    Admin --> UC4
    Admin --> UC6
    DataSource --> UC5

    UC1 -.->|"«include»"| UC5
    UC3 -.->|"«include»"| UC5

    N1["تحلیل تکنیکال کامل نماد<br/>شامل: RSI, MACD, BB,<br/>Ichimoku, Stochastic"]:::note
    N2["تولید تحلیل متنی<br/>توسط هوش مصنوعی<br/>با مدل MSLV4"]:::note
    UC1 -.- N1
    UC3 -.- N2`,
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
    code: `flowchart TB
    classDef actor fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef usecase fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef note fill:#f3e5f5,stroke:#7b1fa2,stroke-width:1px,color:#000,font-style:italic

    User{{"کاربر<br/>(User)"}}:::actor
    Admin{{"مدیر سامانه<br/>(SystemAdmin)"}}:::actor
    DataSource{{"منبع داده<br/>(DataSource)"}}:::actor

    subgraph System["سامانه تحلیل تکنیکال مالی ایران"]
        UC1("تحلیل نماد<br/>(Analyze Symbol)"):::usecase
        UC2("مشاهده شاخص‌ها<br/>(View Indicators)"):::usecase
        UC3("تولید گزارش AI<br/>(Generate AI Report)"):::usecase
        UC4("مدیریت شاخص‌ها<br/>(Manage Indices)"):::usecase
        UC_Fetch("واکشی داده<br/>(Fetch Data)"):::usecase
        UC_Compute("محاسبه شاخص‌ها<br/>(Compute Indicators)"):::usecase
        UC_Regime("تشخیص رژیم<br/>(Detect Regime)"):::usecase
        UC_PreAI("پیش‌پردازش AI<br/>(AI Preprocess)"):::usecase
        UC_PostAI("پس‌پردازش AI<br/>(AI Postprocess)"):::usecase
        UC_Fallback("تحلیل جایگزین<br/>(Fallback Analysis)"):::usecase
        UC_Timeframe("انتخاب بازه زمانی<br/>(Select Timeframe)"):::usecase
        UC_Cache("کش‌بازخوانی<br/>(Cache Lookup)"):::usecase
        UC_Config("پیکربندی منابع<br/>(Configure Sources)"):::usecase
    end

    User --> UC1
    User --> UC2
    User --> UC3
    Admin --> UC4
    DataSource --> UC_Fetch

    UC1 -.->|"«include»"| UC_Fetch
    UC1 -.->|"«include»"| UC_Compute
    UC1 -.->|"«include»"| UC_Regime
    UC3 -.->|"«include»"| UC_PreAI
    UC3 -.->|"«include»"| UC_PostAI
    UC3 -.->|"«extend»"| UC_Fallback
    UC2 -.->|"«include»"| UC_Timeframe
    UC2 -.->|"«include»"| UC_Cache
    UC4 -.->|"«include»"| UC_Config

    N1["در صورت خطای 429 یا<br/>نرخ‌محدودی AI"]:::note
    UC_Fallback -.- N1`,
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
    code: `flowchart TB
    classDef actor fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef usecase fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef note fill:#f3e5f5,stroke:#7b1fa2,stroke-width:1px,color:#000,font-style:italic

    User{{"کاربر<br/>(User)"}}:::actor

    subgraph System["سامانه تحلیل تکنیکال مالی ایران"]
        UC1("تحلیل نماد<br/>(Analyze Symbol)"):::usecase
        UC_Fetch("واکشی داده<br/>(Fetch Data)"):::usecase
        UC_TSE("واکشی از TSE<br/>(Fetch TSE)"):::usecase
        UC_TGJU("واکشی از TGJU<br/>(Fetch TGJU)"):::usecase
        UC_Yahoo("واکشی از Yahoo<br/>(Fetch Yahoo)"):::usecase
        UC3("تولید گزارش AI<br/>(Generate AI Report)"):::usecase
        UC_MSLV4("ارسال به MSLV4<br/>(Send to MSLV4)"):::usecase
        UC_ZaiSDK("ارسال به ZaiSDK<br/>(Send to ZaiSDK)"):::usecase
        UC_Rule("تحلیل قاعده‌محور<br/>(Rule-based Analysis)"):::usecase
        UC_Fallback("تحلیل جایگزین<br/>(Fallback Analysis)"):::usecase
        UC_Compute("محاسبه شاخص‌ها<br/>(Compute Indicators)"):::usecase
        UC_CacheCompute("کشل شاخص‌ها<br/>(Cached Indicators)"):::usecase
        UC_Regime("تشخیص رژیم<br/>(Detect Regime)"):::usecase
        UC_UnknownRegime("رژیم نامشخص<br/>(Unknown Regime)"):::usecase
        UC_PostAI("پس‌پردازش AI<br/>(AI Postprocess)"):::usecase
        UC_RegenAI("بازتولید AI<br/>(AI Regeneration)"):::usecase
        UC_429("مدیریت خطای 429<br/>(Handle Rate Limit)"):::usecase
        UC_Timeout("مدیریت تایم‌اوت<br/>(Handle Timeout)"):::usecase
        UC_Insuff("داده ناکافی<br/>(Insufficient Data)"):::usecase
    end

    User --> UC1
    User --> UC3

    UC1 -.->|"«include»"| UC_Fetch
    UC1 -.->|"«include»"| UC_Compute
    UC1 -.->|"«include»"| UC_Regime
    UC3 -.->|"«include»"| UC_MSLV4
    UC3 -.->|"«include»"| UC_PostAI

    UC_Fetch -.->|"«include»"| UC_TSE
    UC_TSE -.->|"«extend»"| UC_TGJU
    UC_TGJU -.->|"«extend»"| UC_Yahoo
    UC_Fetch -.->|"«extend»"| UC_Timeout
    UC_Fetch -.->|"«extend»"| UC_Insuff

    UC3 -.->|"«extend»"| UC_Fallback
    UC_Fallback -.->|"«include»"| UC_Rule
    UC3 -.->|"«extend»"| UC_429
    UC_429 -.->|"«include»"| UC_Rule

    UC_Compute -.->|"«extend»"| UC_CacheCompute
    UC_Regime -.->|"«extend»"| UC_UnknownRegime
    UC_PostAI -.->|"«extend»"| UC_RegenAI

    UC_MSLV4 -.->|"«include»"| UC_ZaiSDK

    N1["خطای HTTP 429:<br/>Too Many Requests<br/>→ تحلیل قاعده‌محور"]:::note
    N2["تایم‌اوت واکشی:<br/>→ تلاش از منبع بعدی"]:::note
    N3["داده ناکافی:<br/>→ محاسبه کشل شده<br/>→ هشدار به کاربر"]:::note
    UC_429 -.- N1
    UC_Timeout -.- N2
    UC_Insuff -.- N3`,
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
    code: `flowchart TB
    classDef startend fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef activity fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef note fill:#fff9c4,stroke:#f9a825,stroke-width:1px,color:#000,font-style:italic

    START(("شروع")):::startend
    A1["انتخاب نماد توسط کاربر<br/>(Select Symbol)"]:::activity
    A2["واکشی داده‌های بازار<br/>(Fetch Market Data)"]:::activity
    A3["محاسبه شاخص‌های تکنیکال<br/>(Compute TA Indicators)"]:::activity
    A4["تشخیص رژیم بازار<br/>(Detect Market Regime)"]:::activity
    A5["ساخت گراف تصمیم<br/>(Build Decision Graph)"]:::activity
    A6["پیش‌بینی یادگیری ماشین<br/>(ML Prediction)"]:::activity
    A7["تولید متن تحلیل AI<br/>(Generate AI Analysis Text)"]:::activity
    A8["نمایش نتایج<br/>(Display Results)"]:::activity
    END((("پایان"))):::startend

    START --> A1 --> A2 --> A3 --> A4 --> A5 --> A6 --> A7 --> A8 --> END

    N2["از TSE, TGJU, Yahoo"]:::note
    N3["RSI, MACD, BB, Ichimoku"]:::note
    N4["صعودی/نزولی/رنج"]:::note
    N6["MSLV4, ProbabilityTrend"]:::note
    N7["ZaiSDK → AIPostProcessor"]:::note

    A2 -.- N2
    A3 -.- N3
    A4 -.- N4
    A6 -.- N6
    A7 -.- N7`,
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
    code: `flowchart TB
    classDef startend fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef activity fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef decision fill:#ffe0b2,stroke:#e65100,stroke-width:2px,color:#000
    classDef note fill:#fff9c4,stroke:#f9a825,stroke-width:1px,color:#000,font-style:italic

    START(("شروع")):::startend
    A1["انتخاب نماد<br/>(Select Symbol)"]:::activity

    FORK{{"فورک"}}:::decision
    F_TSE["واکشی از TSE API<br/>(Fetch TSE)"]:::activity
    F_TGJU["واکشی از TGJU API<br/>(Fetch TGJU)"]:::activity
    F_Yahoo["واکشی از Yahoo API<br/>(Fetch Yahoo)"]:::activity
    JOIN{{"جوین"}}:::decision

    D1{{"واکشی موفق؟"}}:::decision
    A_Merge["ادغام داده‌ها<br/>(Merge Data)"]:::activity
    A_Fallback1["تلاش از منبع جایگزین<br/>(Try Fallback Source)"]:::activity
    D2{{"منبع جایگزین موفق؟"}}:::decision
    A_ShowErr["نمایش خطا به کاربر<br/>(Show Error)"]:::activity

    A_Compute["محاسبه شاخص‌های TA<br/>(Compute TA Indicators)"]:::activity
    A_Regime["تشخیص رژیم بازار<br/>(Detect Regime)"]:::activity
    D_Regime{{"نوع رژیم؟"}}:::decision

    A_Bull["تحلیل صعودی<br/>(Bullish Analysis)"]:::activity
    A_BullPred["پیش‌بینی روند صعودی<br/>(Bullish Trend Prediction)"]:::activity
    A_Bear["تحلیل نزولی<br/>(Bearish Analysis)"]:::activity
    A_BearPred["پیش‌بینی روند نزولی<br/>(Bearish Trend Prediction)"]:::activity
    A_Range["تحلیل رنج<br/>(Range Analysis)"]:::activity
    A_RangePred["پیش‌بینی روند خنثی<br/>(Neutral Trend Prediction)"]:::activity

    A_Graph["ساخت گراف تصمیم<br/>(Build Decision Graph)"]:::activity
    A_AISend["ارسال درخواست AI<br/>(Send AI Request)"]:::activity
    D_AI{{"پاسخ AI موفق؟"}}:::decision
    A_AIPost["پس‌پردازش AI<br/>(AI Postprocess)"]:::activity
    A_RuleBased["تحلیل قاعده‌محور جایگزین<br/>(Rule-based Fallback)"]:::activity
    A_Display["نمایش نتایج<br/>(Display Results)"]:::activity
    END((("پایان"))):::startend

    START --> A1 --> FORK
    FORK --> F_TSE
    FORK --> F_TGJU
    FORK --> F_Yahoo
    F_TSE --> JOIN
    F_TGJU --> JOIN
    F_Yahoo --> JOIN
    JOIN --> D1

    D1 -->|"بله"| A_Merge
    D1 -->|"خیر - شکست"| A_Fallback1
    A_Fallback1 --> D2
    D2 -->|"بله"| A_Merge
    D2 -->|"خیر"| A_ShowErr
    A_ShowErr --> END

    A_Merge --> A_Compute --> A_Regime --> D_Regime
    D_Regime -->|"صعودی - Bullish"| A_Bull
    D_Regime -->|"نزولی - Bearish"| A_Bear
    D_Regime -->|"رنج - Range"| A_Range
    A_Bull --> A_BullPred
    A_Bear --> A_BearPred
    A_Range --> A_RangePred
    A_BullPred --> A_Graph
    A_BearPred --> A_Graph
    A_RangePred --> A_Graph

    A_Graph --> A_AISend --> D_AI
    D_AI -->|"بله"| A_AIPost
    D_AI -->|"خیر - نرخ‌محدودی 429"| A_RuleBased
    A_AIPost --> A_Display
    A_RuleBased --> A_Display
    A_Display --> END

    N1["بدون AI"]:::note
    A_RuleBased -.- N1`,
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
    code: `flowchart TB
    classDef startend fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef activity fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef decision fill:#ffe0b2,stroke:#e65100,stroke-width:2px,color:#000
    classDef note fill:#fff9c4,stroke:#f9a825,stroke-width:1px,color:#000,font-style:italic

    START(("شروع")):::startend
    END((("پایان"))):::startend

    subgraph FE["Frontend"]
        A_Select["کاربر نماد را انتخاب می‌کند<br/>(User Selects Symbol)"]:::activity
        A_SendReq["ارسال درخواست به API<br/>(Send Request to API)"]:::activity
        A_ValErr["نمایش خطای اعتبارسنجی<br/>(Show Validation Error)"]:::activity
        A_CacheDisplay["نمایش نتایج کش‌شده<br/>(Display Cached Results)"]:::activity
        A_ShowErr["نمایش خطا<br/>(Show Error)"]:::activity
        A_Render["رندر نتایج تحلیل<br/>(Render Analysis Results)"]:::activity
        A_DisplayFinal["نمایش نمودارها و متن AI<br/>(Display Charts & AI Text)"]:::activity
    end

    subgraph APIR["API Routes"]
        A_Receive["دریافت درخواست<br/>(Receive Request)"]:::activity
        A_Validate["اعتبارسنجی پارامترها<br/>(Validate Parameters)"]:::activity
        A_CheckCache["بررسی کش<br/>(Check Cache)"]:::activity
        A_DataErr["خطای واکشی داده<br/>(Data Fetch Error)"]:::activity
        A_BuildGraph["ساخت گراف تصمیم<br/>(Build Decision Graph)"]:::activity
        A_Aggregate["تجمیع نتایج<br/>(Aggregate Results)"]:::activity
        A_SendFE["ارسال به فرانت‌اند<br/>(Send to Frontend)"]:::activity
    end

    subgraph DS["Data Sources"]
        A_Fetch["واکشی داده‌های بازار<br/>(Fetch Market Data)"]:::activity
        A_Retry["تلاش مجدد - Retry<br/>(Retry Fetch)"]:::activity
    end

    subgraph TAE["TA Engine"]
        A_Compute["محاسبه شاخص‌های تکنیکال<br/>(Compute TA Indicators)"]:::activity
        A_DetectRegime["تشخیص رژیم بازار<br/>(Detect Market Regime)"]:::activity
        A_Bullish["تحلیل صعودی<br/>(Bullish Analysis)"]:::activity
        A_Bearish["تحلیل نزولی<br/>(Bearish Analysis)"]:::activity
        A_RangeA["تحلیل رنج<br/>(Range Analysis)"]:::activity
        A_Generic["تحلیل عمومی<br/>(Generic Analysis)"]:::activity
    end

    subgraph MLE["ML Engine"]
        A_SelectModel["انتخاب مدل ML<br/>(Select ML Model)"]:::activity
        A_Predict["پیش‌بینی احتمالی<br/>(Probability Prediction)"]:::activity
    end

    subgraph AIE["AI Engine"]
        A_CheckRate["بررسی نرخ‌محدودی<br/>(Check Rate Limit)"]:::activity
        A_BuildPrompt["ساخت پرامپت AI<br/>(Build AI Prompt)"]:::activity
        A_SendZai["ارسال به ZaiSDK<br/>(Send to ZaiSDK)"]:::activity
        A_PostProcess["پس‌پردازش AI<br/>(AIPostProcessor)"]:::activity
        A_SaveCache["ذخیره در کش<br/>(Save to Cache)"]:::activity
        A_RegenAI["بازتولید AI<br/>(Regenerate AI)"]:::activity
        A_RuleFB1["تحلیل قاعده‌محور<br/>(Rule-based Fallback 1)"]:::activity
        A_RuleFB2["تحلیل قاعده‌محور<br/>(Rule-based Fallback 2)"]:::activity
    end

    D_Valid{{"پارامترها معتبر؟"}}:::decision
    D_Cache{{"نتیجه کش موجود؟"}}:::decision
    D_FetchOK{{"واکشی موفق؟"}}:::decision
    D_RetryOK{{"تلاش دوم موفق؟"}}:::decision
    D_Regime{{"رژیم تشخیص‌داده‌شده"}}:::decision
    D_RateOK{{"نرخ مجاز؟"}}:::decision
    D_AIOK{{"پاسخ موفق؟"}}:::decision
    D_ValidOut{{"خروجی معتبر؟"}}:::decision

    START --> A_Select --> A_SendReq --> A_Receive --> A_Validate --> D_Valid
    D_Valid -->|"بله"| A_CheckCache
    D_Valid -->|"خیر"| A_ValErr --> END

    A_CheckCache --> D_Cache
    D_Cache -->|"بله"| A_CacheDisplay --> END
    D_Cache -->|"خیر"| A_Fetch

    A_Fetch --> D_FetchOK
    D_FetchOK -->|"بله"| A_Compute
    D_FetchOK -->|"خیر"| A_Retry
    A_Retry --> D_RetryOK
    D_RetryOK -->|"بله"| A_Compute
    D_RetryOK -->|"خیر"| A_DataErr --> A_ShowErr --> END

    A_Compute --> A_DetectRegime --> D_Regime
    D_Regime -->|"صعودی"| A_Bullish
    D_Regime -->|"نزولی"| A_Bearish
    D_Regime -->|"رنج"| A_RangeA
    D_Regime -->|"نامشخص"| A_Generic

    A_Bullish --> A_BuildGraph
    A_Bearish --> A_BuildGraph
    A_RangeA --> A_BuildGraph
    A_Generic --> A_BuildGraph

    A_BuildGraph --> A_SelectModel --> A_Predict --> A_CheckRate --> D_RateOK

    D_RateOK -->|"بله"| A_BuildPrompt --> A_SendZai --> D_AIOK
    D_AIOK -->|"بله"| A_PostProcess --> D_ValidOut
    D_ValidOut -->|"بله"| A_SaveCache --> A_Aggregate
    D_ValidOut -->|"خیر"| A_RegenAI --> A_Aggregate
    D_AIOK -->|"خیر - 429/تایم‌اوت"| A_RuleFB1 --> A_Aggregate
    D_RateOK -->|"خیر - نرخ‌محدود"| A_RuleFB2 --> A_Aggregate

    A_Aggregate --> A_SendFE --> A_Render --> A_DisplayFinal --> END

    N1["TSE → TGJU → Yahoo - اولویت"]:::note
    N2["RSI, MACD, BB, Ichimoku,<br/>Stochastic, ADX, ATR, Volume Profile"]:::note
    N3["AnalysisMLSelector"]:::note
    N4["ProbabilityTrend, MSLV4"]:::note
    A_Fetch -.- N1
    A_Compute -.- N2
    A_SelectModel -.- N3
    A_Predict -.- N4`,
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
    code: `stateDiagram-v2
    [*] --> Idle : شروع نشست

    Idle --> Fetching : انتخاب نماد
    Fetching --> Computing : داده واکشی شد
    Computing --> Generating : شاخص‌ها محاسبه شد
    Generating --> Displaying : تحلیل AI تولید شد
    Displaying --> Idle : نتایج نمایش داده شد

    note right of Idle : آماده دریافت درخواست
    note right of Fetching : واکشی از TSE/TGJU/Yahoo
    note right of Computing : محاسبه TA + تشخیص رژیم
    note right of Generating : تولید AI + پیش‌بینی ML
    note right of Displaying : نمایش نتایج به کاربر`,
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
    code: `stateDiagram-v2
    [*] --> Idle

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
    end note`,
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
    code: `stateDiagram-v2
    [*] --> Idle

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
    end note`,
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
    code: `sequenceDiagram
    actor User as "کاربر"
    participant FE as "Frontend<br/>(Next.js)"
    participant API as "API Routes"
    participant TA as "TA Engine"
    participant DS as "Data Sources"
    participant ML as "ML Engine"
    participant AI as "AI Engine"

    User ->> FE : انتخاب نماد (symbol)
    FE ->> API : GET /api/analysis/{symbol}
    API ->> DS : fetchMarketData(symbol)
    DS -->> API : marketData
    API ->> TA : computeIndicators(marketData)
    TA -->> API : indicators
    API ->> ML : predict(indicators)
    ML -->> API : prediction
    API ->> AI : generateAnalysis(indicators, prediction)
    AI -->> API : analysisText
    API -->> FE : {indicators, prediction, analysis}
    FE -->> User : نمایش نتایج تحلیل`,
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
    code: `sequenceDiagram
    autonumber

    actor User as "کاربر"
    participant FE as "Frontend"
    participant API as "API Route<br/>/analysis"
    participant MLSel as "Analysis<br/>MLSelector"
    participant MSLV4 as "MSLV4<br/>Model"
    participant ProbTrend as "Probability<br/>Trend"
    participant Zai as "ZaiSDK"
    participant AIPP as "AI<br/>PostProcessor"

    User ->> FE : requestAnalysis(symbol)
    FE ->> API : POST /api/ai-analysis<br/>{symbol, indicators, regime}
    API ->> MLSel : selectModel(indicators, regime)
    MLSel -->> API : selectedModel = "MSLV4"

    API ->> MSLV4 : analyze(model, indicators, marketData)
    MSLV4 ->> MSLV4 : buildPrompt(indicators, regime)
    MSLV4 ->> Zai : sendPrompt(prompt, config)
    Zai -->> MSLV4 : rawAIResponse
    MSLV4 ->> AIPP : postProcess(rawAIResponse)
    AIPP ->> AIPP : cleanMarkdown()
    AIPP ->> AIPP : validateStructure()
    AIPP ->> AIPP : extractSignals()
    AIPP -->> MSLV4 : processedAnalysis

    MSLV4 ->> ProbTrend : computeProbability(indicators, regime)
    ProbTrend -->> MSLV4 : probabilityResult

    MSLV4 -->> API : {analysis, probability, signals}
    API -->> FE : {aiText, probability, confidence}
    FE -->> User : نمایش تحلیل AI`,
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
    code: `sequenceDiagram
    autonumber

    actor User as "کاربر"
    participant FE as "Frontend"
    participant API as "API Route"
    participant TSE as "TSE Api"
    participant TGJU as "TGJU Api"
    participant Yahoo as "Yahoo Api"
    participant TA as "TA Engine"
    participant RE as "Regime<br/>Engine"
    participant DG as "Decision<br/>Graph"
    participant MSL as "MSLV4"
    participant Zai as "ZaiSDK"
    participant AIPP as "AI Post<br/>Processor"
    participant PT as "Prob<br/>Trend"

    Note over User,PT: واکشی ناهمگام داده
    User ->> FE : selectSymbol("فولاد")
    FE ->> API : GET /api/analysis/فولاد

    par واکشی موازی داده
        API ->> TSE : async fetchTSE("فولاد")
        TSE -->> API : tseData [بعد از 2s]
    and
        API ->> TGJU : async fetchTGJU("فولاد")
        TGJU -->> API : tgjuData [بعد از 3s]
    and
        API ->> Yahoo : async fetchYahoo("فولاد")
        Yahoo -->> API : yahooData [بعد از 1.5s]
    end

    API ->> API : mergeData(tse, tgju, yahoo)

    alt داده ناکافی
        API -->> FE : 400 Insufficient Data
        FE -->> User : هشدار: داده ناکافی
    else داده کافی
        Note over API: ادامه فرآیند
    end

    Note over User,PT: محاسبه تحلیل تکنیکال
    API ->> TA : computeAll(marketData)
    TA -->> API : indicators{RSI, MACD, BB, ...}

    API ->> RE : detectRegime(indicators)
    RE ->> RE : classifyADX()
    RE ->> RE : classifyTrend()
    RE -->> API : regime = "صعودی"

    API ->> DG : buildGraph(indicators, regime)
    DG -->> API : decisionGraph

    Note over User,PT: پیش‌بینی ML
    API ->> PT : computeProbability(indicators, regime)
    PT -->> API : probability = 0.72

    Note over User,PT: تولید AI با تلاش مجدد
    loop تا ۳ تلاش
        API ->> MSL : analyze(indicators, regime)
        MSL ->> MSL : buildPrompt()

        opt بررسی نرخ‌محدود
            MSL ->> Zai : checkRateLimit()
            alt نرخ‌محدود (429)
                Zai -->> MSL : 429 Too Many Requests
                MSL ->> MSL : exponentialBackoff(retryCount)
                Note right of MSL: تأخیر نمایی: 2^n ثانیه
            else نرخ مجاز
                Note over MSL: ادامه بدون تأخیر
            end
        end

        MSL ->> Zai : generateText(prompt, config) [timeout: 90s]

        alt پاسخ موفق
            Zai -->> MSL : rawResponse
            MSL ->> AIPP : postProcess(rawResponse)
            AIPP ->> AIPP : validateStructure()
            alt خروجی معتبر
                AIPP -->> MSL : processedAnalysis
                MSL -->> API : finalResult
            else خروجی نامعتبر
                AIPP -->> MSL : invalidOutput
                Note right of AIPP: بازتولید درخواست
            end
        else خطا
            alt تایم‌اوت
                Zai -->> MSL : TimeoutException
                MSL ->> MSL : logTimeout()
            else خطای 429
                Zai -->> MSL : RateLimitException
                MSL ->> MSL : incrementRetryCount()
            end
        end
    end

    alt AI موفق
        API -->> FE : 200 {analysis, probability, signals}
        FE -->> User : نمایش کامل تحلیل
    else AI شکست خورد
        API ->> API : ruleBasedFallback(indicators, regime)
        API -->> FE : 200 {ruleBasedAnalysis}
        FE -->> User : نمایش تحلیل قاعده‌محور
        Note right of FE: بدون AI - تحلیل جایگزین
    end`,
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
    code: `sequenceDiagram
    participant FE as "Frontend"
    participant API as "API Routes"
    participant TA as "TA Engine"
    participant RE as "Regime Engine"
    participant DG as "Decision Graph"
    participant ML as "ML Engine"
    participant AI as "AI Engine"
    participant DS as "Data Sources"
    participant Zai as "ZaiSDK"

    Note over FE: رابط کاربر (Next.js)
    Note over DS: TSE, TGJU, Yahoo
    Note over Zai: کانال هوش مصنوعی

    FE ->> API : HTTP Request/Response
    API ->> TA : computeIndicators()
    API ->> RE : detectRegime()
    API ->> DG : buildGraph()
    API ->> ML : predict()
    API ->> AI : generateAnalysis()
    AI ->> Zai : AI Generation
    API ->> DS : fetchData()

    DS -->> API : data
    TA -->> API : indicators
    RE -->> API : regime
    DG -->> API : decisionGraph
    ML -->> API : prediction
    Zai -->> AI : response
    AI -->> API : analysis
    API -->> FE : response`,
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
    code: `sequenceDiagram
    participant API as "API Route"
    participant TA as "TA Engine"
    participant RE as "Regime Engine"
    participant MLSel as "AnalysisMLSelector"
    participant MSL as "MSLV4"
    participant PT as "ProbabilityTrend"
    participant DG as "Decision Graph"

    API ->> TA : 1. computeAll(marketData)
    TA -->> API : 2. return indicators
    API ->> RE : 3. detectRegime(indicators)
    RE -->> API : 4. return regime
    API ->> MLSel : 5. selectModel(indicators, regime)
    MLSel -->> API : 6. return "MSLV4"
    API ->> MSL : 7. analyze(model, indicators)
    MSL ->> PT : 8. computeProbability(indicators, regime)
    PT -->> MSL : 9. return probability
    MSL -->> API : 10. return prediction
    API ->> DG : 11. buildGraph(indicators, regime, prediction)
    DG -->> API : 12. return decisionGraph`,
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
    code: `sequenceDiagram
    participant API as "API Route"
    participant TSE as "TSE Api"
    participant TSETMC as "TSETMC Index"
    participant TGJU as "TGJU Api"
    participant Yahoo as "Yahoo Api"
    participant Cache as "Cache"
    participant Val as "Validator"

    API ->> Cache : 1. checkCache(symbol)
    Cache -->> API : 2. cacheMiss
    API ->> TSE : 3. fetchTSE(symbol)
    TSE ->> TSETMC : 4. fetchIndexData(symbol)
    TSETMC -->> TSE : 5. indexData
    TSE -->> API : 6. tseData [موفق]
    API ->> Val : 7. validate(tseData)
    Val -->> API : 8. valid=true

    API ->> TGJU : 9. fetchTGJU(symbol) [داده تکمیلی]
    TGJU -->> API : 10. tgjuData
    API ->> Val : 11. validate(tgjuData)
    Val -->> API : 12. valid=true

    API ->> Yahoo : 13. fetchYahoo(symbol) [داده بین‌المللی]
    Yahoo -->> API : 14. yahooData
    API ->> Val : 15. validate(yahooData)
    Val -->> API : 16. valid=true

    API ->> API : 17. mergeData(tse, tgju, yahoo)
    API ->> Cache : 18. saveCache(symbol, mergedData)
    Cache -->> API : 19. saved
    API ->> API : 20. return mergedData

    Note left of API: در صورت شکست هر منبع:<br/>→ منبع بعدی امتحان می‌شود<br/>→ اگر همه شکست خوردند: خطا`,
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
    code: `flowchart TB
    classDef startend fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef action fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef seqref fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#000
    classDef decision fill:#fce4ec,stroke:#c62828,stroke-width:2px,color:#000

    Start([شروع]):::startend
    A["انتخاب نماد توسط کاربر"]:::action
    SEQ1["🔗 دنباله: انتخاب نماد<br/>(SEQ-SelectSymbol)<br/>Frontend → API"]:::seqref
    D1{داده کش‌شده موجود؟}:::decision
    B["بازگرداندن نتایج کش"]:::action
    SEQ2["🔗 دنباله: واکشی داده<br/>(SEQ-FetchData)<br/>API → DataSources"]:::seqref
    SEQ3["🔗 دنباله: تحلیل تکنیکال<br/>(SEQ-TAAnalysis)<br/>API → TA Engine → Regime Engine"]:::seqref
    SEQ4["🔗 دنباله: پیش‌بینی و تولید AI<br/>(SEQ-MLAIPrediction)<br/>API → ML Engine → AI Engine"]:::seqref
    SEQ5["🔗 دنباله: نمایش نتایج<br/>(SEQ-DisplayResults)<br/>API → Frontend"]:::seqref
    End([پایان]):::startend

    Start --> A --> SEQ1 --> D1
    D1 -->|بله| B --> SEQ5
    D1 -->|خیر| SEQ2 --> SEQ3 --> SEQ4 --> SEQ5
    SEQ5 --> End`,
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
    code: `flowchart TB
    classDef startend fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef action fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef seqref fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#000
    classDef decision fill:#fce4ec,stroke:#c62828,stroke-width:2px,color:#000

    Start([شروع]):::startend
    A["دریافت درخواست تحلیل"]:::action
    SEQ1["🔗 بررسی کش<br/>(SEQ-CacheLookup)"]:::seqref
    D1{کش HIT؟}:::decision
    B["بازگرداندن کش"]:::action
    End1([پایان]):::startend

    SEQ2["🔗 واکشی چندمنبعی<br/>(SEQ-MultiSourceFetch)"]:::seqref
    D2{واکشی موفق؟}:::decision
    SEQ3["🔗 واکشی جایگزین<br/>(SEQ-FallbackFetch)"]:::seqref
    D3{جایگزین موفق؟}:::decision
    Err["خطا"]:::action
    End2([پایان]):::startend

    SEQ4["🔗 محاسبه شاخص‌ها<br/>(SEQ-ComputeIndicators)"]:::seqref
    SEQ5["🔗 تشخیص رژیم<br/>(SEQ-DetectRegime)"]:::seqref
    D4{نوع رژیم؟}:::decision
    SEQ6A["🔗 تحلیل صعودی<br/>(SEQ-BullishAnalysis)"]:::seqref
    SEQ6B["🔗 تحلیل نزولی<br/>(SEQ-BearishAnalysis)"]:::seqref
    SEQ6C["🔗 تحلیل رنج<br/>(SEQ-RangeAnalysis)"]:::seqref

    SEQ7["🔗 تولید AI<br/>(SEQ-AIGeneration)"]:::seqref
    D5{AI موفق؟}:::decision
    SEQ8["🔗 تحلیل قاعده‌محور<br/>(SEQ-RuleBasedFallback)"]:::seqref
    Z["تجمیع و نمایش نتایج"]:::action
    End3([پایان]):::startend

    Start --> A --> SEQ1 --> D1
    D1 -->|بله| B --> End1
    D1 -->|خیر| SEQ2 --> D2
    D2 -->|خیر| SEQ3 --> D3
    D3 -->|خیر| Err --> End2
    D3 -->|بله| SEQ4
    D2 -->|بله| SEQ4
    SEQ4 --> SEQ5 --> D4
    D4 -->|صعودی| SEQ6A --> SEQ7
    D4 -->|نزولی| SEQ6B --> SEQ7
    D4 -->|رنج| SEQ6C --> SEQ7
    SEQ7 --> D5
    D5 -->|خیر - 429| SEQ8 --> Z
    D5 -->|بله| Z
    Z --> End3`,
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
    code: `flowchart TB
    classDef startend fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef action fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    classDef seqref fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#000
    classDef decision fill:#fce4ec,stroke:#c62828,stroke-width:2px,color:#000
    classDef parallel fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000

    Start([شروع]):::startend
    A["دریافت درخواست تحلیل نماد"]:::action
    SEQ1["🔗 بررسی کش<br/>(SEQ-L1-CacheLookup)"]:::seqref
    D1{کش HIT؟}:::decision
    B["بازگرداندن نتایج کش"]:::action

    subgraph PAR1 ["⏩ واکشی موازی داده"]
        direction LR
        SEQ2A["🔗 واکشی TSE<br/>(SEQ-FetchTSE)"]:::seqref
        SEQ2B["🔗 واکشی TGJU<br/>(SEQ-FetchTGJU)"]:::seqref
        SEQ2C["🔗 واکشی Yahoo<br/>(SEQ-FetchYahoo)"]:::seqref
    end

    D2{همه منابع شکست؟}:::decision
    SEQ3["🔗 واکشی جایگزین<br/>(SEQ-FallbackFetch)<br/>تا ۲ تلاش"]:::seqref
    D3{هنوز شکست؟}:::decision
    Err["خطا"]:::action

    SEQ4["🔗 محاسبه شاخص‌ها<br/>(SEQ-ComputeAllIndicators)"]:::seqref
    SEQ5["🔗 تشخیص رژیم<br/>(SEQ-DetectRegime)"]:::seqref
    SEQ6["🔗 ساخت گراف تصمیم<br/>(SEQ-BuildDecisionGraph)"]:::seqref

    subgraph PAR2 ["⏩ پیش‌بینی ML موازی"]
        direction LR
        SEQ7A["🔗 پیش‌بینی MSLV4<br/>(SEQ-MSLV4Predict)"]:::seqref
        SEQ7B["🔗 محاسبه احتمال<br/>(SEQ-ProbTrendCompute)"]:::seqref
    end

    SEQ8["🔗 تولید و پس‌پردازش AI<br/>(SEQ-AIGenerationWithPostProcess)<br/>🔄 تا ۳ تلاش با تأخیر نمایی 2ⁿ"]:::seqref
    D4{AI موفق؟}:::decision
    SEQ9["🔗 تحلیل قاعده‌محور<br/>(SEQ-RuleBasedFallback)"]:::seqref
    SEQ10["🔗 ذخیره در کش<br/>(SEQ-SaveCache)"]:::seqref
    SEQ11["🔗 ارسال و نمایش نتایج<br/>(SEQ-DisplayResults)"]:::seqref
    End([پایان]):::startend

    Start --> A --> SEQ1 --> D1
    D1 -->|بله| B --> End
    D1 -->|خیر| PAR1 --> D2
    D2 -->|بله| SEQ3 --> D3
    D3 -->|بله| Err --> End
    D3 -->|خیر| SEQ4
    D2 -->|خیر| SEQ4
    SEQ4 --> SEQ5 --> SEQ6 --> PAR2 --> SEQ8 --> D4
    D4 -->|خیر| SEQ9 --> SEQ10
    D4 -->|بله| SEQ10
    SEQ10 --> SEQ11 --> End`,
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
    code: `sequenceDiagram
    participant Ctrl as "کنترلر"
    participant TSE as "TSE API"
    participant TSETMC as "TSETMC Index"
    participant TGJU as "TGJU API"
    participant Yahoo as "Yahoo API"

    Note over Ctrl,Yahoo: t=0: همه آماده

    Ctrl ->> TSE : @100ms درخواست HTTP
    activate TSE
    Note over TSE: حالت: درخواست

    Ctrl ->> TSETMC : @200ms درخواست
    activate TSETMC
    Note over TSETMC: حالت: درخواست

    Note over TSE: @500ms شروع دریافت داده
    Note over TSETMC: @800ms شروع دریافت داده

    TSE -->> Ctrl : @1000ms tseData
    deactivate TSE
    Note over TSE: تکمیل (1s)

    Ctrl ->> TGJU : @1100ms درخواست
    activate TGJU

    TSETMC -->> Ctrl : @1500ms indexData
    deactivate TSETMC
    Note over TSETMC: تکمیل (1.3s)

    Ctrl ->> Yahoo : @1600ms درخواست
    activate Yahoo

    Note over TGJU: @1800ms دریافت داده
    Note over Yahoo: @2100ms دریافت داده

    TGJU -->> Ctrl : @2400ms tgjuData
    deactivate TGJU
    Note over TGJU: تکمیل (1.3s)

    Yahoo -->> Ctrl : @2700ms yahooData
    deactivate Yahoo
    Note over Yahoo: تکمیل (1.1s)`,
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
    code: `sequenceDiagram
    participant DF as "DataFetcher"
    participant TA as "TAEngine"
    participant RE as "RegimeEngine"
    participant AI as "AIEngine"
    participant DISP as "Display"

    Note over DF,DISP: t=0: رویداد به‌روزرسانی قیمت
    Note over DF: بیکار → واکشی
    activate DF

    Note over DF,DISP: t=3s: واکشی تکمیل
    deactivate DF
    Note over DF: آماده

    Note over TA: بیکار → محاسبه شاخص‌ها
    activate TA

    Note over TA,DISP: t=5s: محاسبه شاخص‌ها تکمیل
    deactivate TA
    Note over TA: تکمیل

    Note over RE: بیکار → تشخیص رژیم
    activate RE

    Note over RE,DISP: t=5.5s: تشخیص رژیم تکمیل
    deactivate RE
    Note over RE: تکمیل

    Note over AI: بیکار → درخواست (رژیم تغییر کرده)
    activate AI
    Note over AI: ارسال به ZaiSDK

    Note over AI,DISP: t=9s: تولید AI تکمیل
    deactivate AI
    Note over AI: تکمیل

    Note over DISP: بیکار → رندر نتایج جدید
    activate DISP

    Note over DISP: t=9.2s: رندر تکمیل
    deactivate DISP
    Note over DF,DISP: همه بیکار`,
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
    code: `sequenceDiagram
    participant DF as "DataFetch<br/>⏱ max 8s"
    participant TA as "TA Compute<br/>⏱ max 2s"
    participant RE as "Regime Detect<br/>⏱ max 1s"
    participant ML as "ML Predict<br/>⏱ max 5s"
    participant AI as "AI Generate<br/>⏱ max 90s"
    participant PP as "PostProcess<br/>⏱ max 3s"
    participant TOTAL as "Total Pipeline<br/>⏱ max 120s"

    Note over DF,TOTAL: t=0: شروع خط تولید
    activate TOTAL
    Note over TOTAL: درحال‌اجرا

    activate DF
    Note over DF: حالت: واکشی
    Note over DF,TOTAL: t=4s: واکشی تکمیل (~4s)
    Note over DF: محدودیت: {DF.duration < 8s} ✓
    deactivate DF

    activate TA
    Note over TA: حالت: محاسبه
    Note over DF,TOTAL: t=5.5s: TA تکمیل (~1.5s)
    Note over TA: محدودیت: {TA.duration < 2s} ✓
    deactivate TA

    activate RE
    Note over RE: حالت: تشخیص
    Note over DF,TOTAL: t=6s: Regime تکمیل (~0.5s)
    Note over RE: محدودیت: {RE.duration < 1s} ✓
    deactivate RE

    activate ML
    Note over ML: حالت: پیش‌بینی
    Note over DF,TOTAL: t=9s: ML تکمیل (~3s)
    Note over ML: محدودیت: {ML.duration < 5s} ✓
    deactivate ML

    activate AI
    Note over AI: حالت: تولید
    Note over DF,TOTAL: t=45s: AI تکمیل (~36s)
    Note over AI: محدودیت: {AI.duration < 90s} ✓
    deactivate AI

    activate PP
    Note over PP: حالت: پردازش
    Note over DF,TOTAL: t=47s: PostProcess تکمیل (~2s)
    Note over PP: محدودیت: {PP.duration < 3s} ✓
    deactivate PP

    Note over TOTAL: تکمیل - مدت کل: ~47s
    Note over TOTAL: {Total.duration < 120s} ✓
    Note over TOTAL: جمع محدودیت‌ها: 8+2+1+5+90+3 = 109s < 120s ✓
    deactivate TOTAL`,
  },
] as const;