# نمودارهای جریان داده (DFD) - سامانه تحلیل تکنیکال مالی ایران
# Data Flow Diagrams - Persian Financial Technical Analysis System

## راهنمای نمادها
- `{{"موجودیت خارجی"}}` → موجودیت خارجی (شکل شش‌ضلعی)
- `["فرآیند"]` → فرآیند (مستطیل)
- `[("ذخیره‌گاه داده")]` → ذخیره‌گاه داده (استوانه)
- پیکان‌ها با برچسب → جریان داده

---

===DIAGRAM_START===
{
  "id": "DFD-L0-CONTEXT",
  "title": "نمودار زمینه سطح ۰ - سامانه تحلیل تکنیکال مالی",
  "description": "این نمودار بالاترین سطح انتزاع سیستم را نشان می‌دهد.\nسامانه تحلیل تکنیکال مالی ایران به عنوان یک فرآیند واحد در مرکز قرار دارد.\nهفت موجودیت خارجی با سامانه در ارتباط هستند: کاربر، بورس تهران، TSETMC CDN، TGJU، Yahoo Finance، z.ai LLM و پایگاه داده.\nجریان‌های داده اصلی شامل انتخاب نماد و پارامترها از کاربر، داده‌های OHLCV از بورس تهران، داده‌های تاریخی از منابع خارجی، درخواست/پاسخ LLM و ذخیره/بازخوانی کش هستند.\nاین نمودار مرز سیستم و تعاملات آن با دنیای بیرون را مشخص می‌کند.\nبرای درک اولیه معماری سیستم، این بالاترین نقطه شروع است.",
  "level": 0,
  "code": "flowchart RL\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:3px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    User{{\"کاربر\"}}:::entity\n    TSE{{\"بورس تهران (TSE)\"}}:::entity\n    TSETMC{{\"TSETMC CDN\"}}:::entity\n    TGJU{{\"TGJU\"}}:::entity\n    Yahoo{{\"Yahoo Finance\"}}:::entity\n    ZAI{{\"z.ai LLM\"}}:::entity\n    DB{{\"پایگاه داده Prisma/SQLite\"}}:::entity\n\n    Sys[\"سامانه تحلیل تکنیکال مالی\"]:::process\n\n    User -->|\"انتخاب نماد + پارامترهای تحلیل\"| Sys\n    Sys -->|\"نتایج تحلیل + گزارش هوشمند + نمودارها\"| User\n\n    TSE -->|\"داده OHLCV + عمق بازار + اطلاعات شرکت\"| Sys\n    TSETMC -->|\"دودهی + شاخص کل + ارزش بازار\"| Sys\n    TGJU -->|\"قیمت‌های زنده + اخبار + تحلیل‌های عمومی\"| Sys\n    Yahoo -->|\"داده تاریخی ارزها + نقره + طلا\"| Sys\n\n    Sys -->|\"درخواست تولید متن تحلیلی\"| ZAI\n    ZAI -->|\"متن تحلیل هوشمند + پیشنهادها\"| Sys\n\n    Sys -->|\"ذخیره نتایج + کش تحلیل\"| DB\n    DB -->|\"بازخوانی کش + تنظیمات + مدل‌ها\"| Sys"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L1-MAIN-PROCESSES",
  "title": "نمودار جریان داده سطح ۱ - فرآیندهای اصلی",
  "description": "این نمودار هفت فرآیند اصلی سیستم را با جزئیات نشان می‌دهد.\nP1 دریافت و پردازش داده بازار از منابع مختلف را مدیریت می‌کند.\nP2 تحلیل تکنیکال شامل ۴۳ اندیکاتور و ۱۶+ الگوی کندلی را انجام می‌دهد.\nP3 تشخیص رژیم بازار با سه موتور فازی، مارکوف و رأی‌گیری وزنی را اجرا می‌کند.\nP4 محاسبه احتمالات گراف تصمیم با ۳۴ گره و ۵۵+ یال و ۹ سناریو را انجام می‌دهد.\nP5 تولید تحلیل هوشمند AI با سیستم MSL v4 و فراخوانی z.ai LLM را مدیریت می‌کند.\nP6 مدیریت سطوح حمایت/مقاومت از ۷ منبع مختلف را انجام می‌دهد.\nP7 پایش و نمایش نتایج نهایی در لایه ارائه را بر عهده دارد.\nچهار ذخیره‌گاه داده: D1 بازار داده، D2 کش تحلیل، D3 مدل ML، D4 تنظیمات.",
  "level": 1,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    User{{\"کاربر\"}}:::entity\n    TSE{{\"بورس تهران\"}}:::entity\n    TSETMC{{\"TSETMC CDN\"}}:::entity\n    TGJU{{\"TGJU\"}}:::entity\n    Yahoo{{\"Yahoo Finance\"}}:::entity\n    ZAI{{\"z.ai LLM\"}}:::entity\n\n    D1[(\"D1: بازار داده\")]:::store\n    D2[(\"D2: کش تحلیل\")]:::store\n    D3[(\"D3: مدل ML\")]:::store\n    D4[(\"D4: تنظیمات\")]:::store\n\n    P1[\"P1: دریافت و پردازش داده بازار\"]:::process\n    P2[\"P2: تحلیل تکنیکال و اندیکاتورها\"]:::process\n    P3[\"P3: تشخیص رژیم بازار\"]:::process\n    P4[\"P4: محاسبه احتمالات گراف تصمیم\"]:::process\n    P5[\"P5: تولید تحلیل هوشمند AI\"]:::process\n    P6[\"P6: مدیریت سطوح حمایت/مقاومت\"]:::process\n    P7[\"P7: پایش و نمایش نتایج\"]:::process\n\n    User -->|\"انتخاب نماد + تایم‌فریم\"| P1\n    TSE -->|\"داده OHLCV BrsApi\"| P1\n    TSETMC -->|\"دودهی + شاخص\"| P1\n    TGJU -->|\"قیمت زنده\"| P1\n    Yahoo -->|\"داده ارز\"| P1\n\n    P1 -->|\"داده پاکسازی‌شده\"| D1\n    D1 -->|\"سری زمانی OHLCV\"| P2\n    D1 -->|\"سری زمانی + اندیکاتورها\"| P3\n    D1 -->|\"سری زمانی\"| P6\n\n    P2 -->|\"اندیکاتورها + الگوها\"| D2\n    P2 -->|\"سیگنال‌های تکنیکال\"| P3\n    P2 -->|\"سطوح محاسبه‌شده\"| P6\n\n    D3 -->|\"وزن‌های رژیم\"| P3\n    P3 -->|\"رژیم فعلی + احتمالات\"| D2\n    P3 -->|\"رژیم شناسایی‌شده\"| P4\n\n    D2 -->|\"تحلیل‌های کش‌شده\"| P4\n    P4 -->|\"گراف تصمیم + سناریوها\"| D2\n    P4 -->|\"سناریو غالب + احتمال\"| P5\n\n    D4 -->|\"تنظیمات MSL + پارامترها\"| P5\n    P5 -->|\"پرامپت ساختاریافته\"| ZAI\n    ZAI -->|\"متن خام LLM\"| P5\n    P5 -->|\"متن پس‌پردازش‌شده\"| D2\n\n    P6 -->|\"سطوح S/R نهایی\"| D2\n    P6 -->|\"سطوح حمایت/مقاومت\"| P4\n\n    D2 -->|\"تمام نتایج تحلیل\"| P7\n    P7 -->|\"داشبورد + نمودارها + گزارش AI\"| User\n    P4 -->|\"سناریوها + گراف\"| P7\n    P6 -->|\"نقاط S/R\"| P7"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L2-P1-MARKET-DATA",
  "title": "نمودار جریان داده سطح ۲ - P1: دریافت و پردازش داده بازار",
  "description": "این نمودار زیرفرآیندهای P1 را با جزئیات نشان می‌دهد.\nP1.1 دریافت داده از BrsApi بورس تهران شامل سابقه قیمت و عمق بازار است.\nP1.2 دریافت داده از TSETMC CDN شامل دهی‌بندی و شاخص کل و ارزش بازار است.\nP1.3 دریافت داده از TGJU شامل قیمت‌های زنده و اخبار بازار است.\nP1.4 دریافت داده از Yahoo Finance شامل داده تاریخی ارزها و کالاهاست.\nP1.5 ادغام و پاکسازی داده‌ها شامل حذف نقاط پرت، پرکردن مقادیر خالی و هم‌زمان‌سازی است.\nذخیره‌گاه D1 بازار داده نتیجه نهایی را نگهداری می‌کند.",
  "level": 2,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    User{{\"کاربر\"}}:::entity\n    TSE{{\"بورس تهران (BrsApi)\"}}:::entity\n    TSETMC{{\"TSETMC CDN\"}}:::entity\n    TGJU{{\"TGJU\"}}:::entity\n    Yahoo{{\"Yahoo Finance\"}}:::entity\n\n    D1[(\"D1: بازار داده\")]:::store\n    D4[(\"D4: تنظیمات\")]:::store\n\n    P11[\"P1.1: دریافت از BrsApi\"]:::process\n    P12[\"P1.2: دریافت از TSETMC\"]:::process\n    P13[\"P1.3: دریافت از TGJU\"]:::process\n    P14[\"P1.4: دریافت از Yahoo\"]:::process\n    P15[\"P1.5: ادغام و پاکسازی\"]:::process\n\n    User -->|\"نماد + تایم‌فریم\"| P11\n    User -->|\"نماد\"| P12\n\n    TSE -->|\"OHLCV + عمق بازار + حجم\"| P11\n    TSETMC -->|\"دهی‌بندی + شاخص کل + ارزش بازار\"| P12\n    TGJU -->|\"قیمت زنده + اخبار\"| P13\n    Yahoo -->|\"داده تاریخی ارز + طلا + نقره\"| P14\n\n    D4 -->|\"API keys + endpoints\"| P11\n    D4 -->|\"API keys + endpoints\"| P12\n    D4 -->|\"API keys + endpoints\"| P13\n    D4 -->|\"API keys + endpoints\"| P14\n\n    P11 -->|\"داده خام TSE\"| P15\n    P12 -->|\"دودهی + شاخص\"| P15\n    P13 -->|\"داده زنده TGJU\"| P15\n    P14 -->|\"داده ارز Yahoo\"| P15\n\n    P15 -->|\"داده ادغام‌شده + نرمال‌سازی‌شده\"| D1\n    P15 -->|\"لاگ خطا\"| D4"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L2-P2-TECHNICAL-ANALYSIS",
  "title": "نمودار جریان داده سطح ۲ - P2: تحلیل تکنیکال و اندیکاتورها",
  "description": "این نمودار زیرفرآیندهای P2 را با جزئیات نشان می‌دهد.\nP2.1 محاسبه اندیکاتورهای RSI/MACD شامل RSI(14), MACD(12,26,9) و سیگنال‌های کراس‌اور است.\nP2.2 محاسبه Bollinger/SAR شامل باندهای بولینگر(20,2), Parabolic SAR و Envelope است.\nP2.3 محاسبه ADX/Stochastic شامل ADX(14), Stochastic(14,3,3), CCI و Williams %R است.\nP2.4 تشخیص الگوهای کندلی شامل ۱۶+ الگو مانند Doji, Hammer, Engulfing, Harami و غیره است.\nبیش از ۶۰ اندیکاتور تکنیکال در مجموع این زیرفرآیندها محاسبه می‌شوند.",
  "level": 2,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    D1[(\"D1: بازار داده\")]:::store\n    D2[(\"D2: کش تحلیل\")]:::store\n    D4[(\"D4: تنظیمات\")]:::store\n\n    P21[\"P2.1: محاسبه RSI/MACD\"]:::process\n    P22[\"P2.2: محاسبه Bollinger/SAR\"]:::process\n    P23[\"P2.3: محاسبه ADX/Stochastic\"]:::process\n    P24[\"P2.4: تشخیص الگوهای کندلی\"]:::process\n\n    D1 -->|\"سری قیمت بسته\"| P21\n    D1 -->|\"سری قیمت H/L/C\"| P22\n    D1 -->|\"سری قیمت H/L/C\"| P23\n    D1 -->|\"داده کندل‌های OHLCV\"| P24\n\n    D4 -->|\"پارامترهای اندیکاتور\"| P21\n    D4 -->|\"پارامترهای باندها\"| P22\n    D4 -->|\"پارامترهای ADX/Stoch\"| P23\n    D4 -->|\"الگوهای فعال\"| P24\n\n    P21 -->|\"RSI + MACD + سیگنال‌ها\"| D2\n    P22 -->|\"BBands + SAR + Envelope\"| D2\n    P23 -->|\"ADX + Stoch + CCI + W%R\"| D2\n    P24 -->|\"الگوهای شناسایی‌شده + اعتبار\"| D2\n\n    P21 -->|\"سیگنال کراس‌اور MACD\"| P23\n    P23 -->|\"قدرت روند ADX\"| P22\n    P24 -->|\"الگوی بازگشتی\"| P21"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L2-P3-REGIME-DETECTION",
  "title": "نمودار جریان داده سطح ۲ - P3: تشخیص رژیم بازار",
  "description": "این نمودار فرآیند P3 تشخیص رژیم بازار را با سه موتور نشان می‌دهد.\nموتور فازی (Fuzzy) با وزن ۰.۳ از منطق فازی برای طبقه‌بندی رژیم استفاده می‌کند.\nموتور مارکوف (Markov) با وزن ۰.۵ از زنجیره مارکوف برای مدل‌سازی انتقال رژیم استفاده می‌کند.\nموتور رأی‌گیری وزنی (Weighted Vote) با وزن ۰.۲ از ترکیب رأی‌ها برای تصمیم نهایی استفاده می‌کند.\nخروجی شامل نوع رژیم (صعودی/نزولی/رنج/نوسانی) و سطح اطمینان است.\nوزن‌های مارکوف بالاتر است زیرا مدل انتقال حالت دقیق‌تری ارائه می‌دهد.",
  "level": 2,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    D1[(\"D1: بازار داده\")]:::store\n    D2[(\"D2: کش تحلیل\")]:::store\n    D3[(\"D3: مدل ML\")]:::store\n\n    Fuzzy[\"موتور فازی (وزن: ۰.۳)\"]:::process\n    Markov[\"موتور مارکوف (وزن: ۰.۵)\"]:::process\n    Vote[\"موتور رأی‌گیری وزنی (وزن: ۰.۲)\"]:::process\n    Combine[\"ترکیب و تصمیم نهایی رژیم\"]:::process\n\n    D1 -->|\"سری زمانی قیمت\"| Fuzzy\n    D1 -->|\"سری زمانی قیمت\"| Markov\n    D2 -->|\"اندیکاتورهای روند\"| Fuzzy\n    D2 -->|\"اندیکاتورهای روند\"| Markov\n    D2 -->|\"سیگنال‌های تکنیکال\"| Vote\n    D3 -->|\"ماتریس انتقال مارکوف\"| Markov\n\n    Fuzzy -->|\"رژیم فازی + عضویت\"| Combine\n    Markov -->|\"رژیم مارکوف + احتمال انتقال\"| Combine\n    Vote -->|\"رأی وزنی + اطمینان\"| Combine\n\n    Combine -->|\"رژیم نهایی + اطمینان\"| D2\n    Combine -->|\"به‌روزرسانی ماتریس\"| D3"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L2-P4-DECISION-GRAPH",
  "title": "نمودار جریان داده سطح ۲ - P4: محاسبه احتمالات گراف تصمیم",
  "description": "این نمودار زیرفرآیندهای P4 را با جزئیات نشان می‌دهد.\nP4.1 ساخت گراف تصمیم شامل ایجاد ۳۴ گره و ۵۵+ یال با ۳ شاخه استراتژی است.\nP4.2 محاسبه مسیرها در گراف شامل یافتن تمام مسیرهای ممکن از ریشه تا برگ است.\nP4.3 تعیین احتمالات سناریو شامل محاسبه احتمال ۹ سناریو SC1-SC9 با سیستم ۷ لایه VDss است.\nP4.4 محاسبه احتمال تجمعی شامل جمع تجمعی سناریوها و تعیین سناریو غالب است.\nسیستم VDss دارای ۷ لایه بررسی صحت و ۹ سناریو از صعودی قوی تا نزولی قوی است.",
  "level": 2,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    Regime{{\"رژیم شناسایی‌شده\"}}:::entity\n    SR{{\"سطوح S/R\"}}:::entity\n\n    D2[(\"D2: کش تحلیل\")]:::store\n    D3[(\"D3: مدل ML\")]:::store\n\n    P41[\"P4.1: ساخت گراف تصمیم\"]:::process\n    P42[\"P4.2: محاسبه مسیرها\"]:::process\n    P43[\"P4.3: تعیین احتمالات سناریو\"]:::process\n    P44[\"P4.4: محاسبه احتمال تجمعی\"]:::process\n\n    D2 -->|\"اندیکاتورها + الگوها\"| P41\n    Regime -->|\"رژیم بازار\"| P41\n    SR -->|\"نقاط حمایت/مقاومت\"| P41\n    D3 -->|\"وزن‌های یادگرفته‌شده\"| P41\n\n    P41 -->|\"گراف ۳۴ گره + ۵۵ یال\"| P42\n\n    P42 -->|\"مسیرهای ممکن + وزن‌ها\"| P43\n    D3 -->|\"پارامترهای VDss\"| P43\n\n    P43 -->|\"احتمال SC1-SC9\"| P44\n    P44 -->|\"سناریو غالب + اطمینان\"| D2\n    P44 -->|\"توزیع تجمعی\"| D2\n    P44 -->|\"نتیجه نهایی گراف\"| P43"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L2-P5-AI-GENERATION",
  "title": "نمودار جریان داده سطح ۲ - P5: تولید تحلیل هوشمند AI",
  "description": "این نمودار زیرفرآیندهای P5 را با جزئیات نشان می‌دهد.\nP5.1 انتخاب مکتب MSL از سیستم MSL v4 با ۶ مکتب × ۵ سبک × ۶ لحن است.\nP5.2 ساخت پرامپت شامل ترکیب نتایج تحلیل با قالب مکتب انتخابی و ساختار پرامپت سیستم است.\nP5.3 فراخوانی LLM از طریق z.ai SDK با تابع dedicatedAIChatCompletion و مدیریت نرخ است.\nP5.4 پس‌پردازش متن شامل حذف توهمات، فرمت‌سازی، اضافه‌کردن دسکلیمر و هم‌ترازی با واقعیت بازار است.\nسیستم MSL v4 امکان تولید تحلیل با لحن و سبک متنوع را فراهم می‌کند.",
  "level": 2,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    ZAI{{\"z.ai LLM\"}}:::entity\n    User{{\"کاربر\"}}:::entity\n\n    D2[(\"D2: کش تحلیل\")]:::store\n    D4[(\"D4: تنظیمات\")]:::store\n\n    P51[\"P5.1: انتخاب مکتب MSL\"]:::process\n    P52[\"P5.2: ساخت پرامپت\"]:::process\n    P53[\"P5.3: فراخوانی LLM\"]:::process\n    P54[\"P5.4: پس‌پردازش متن\"]:::process\n\n    D2 -->|\"سناریو غالب + اندیکاتورها + S/R\"| P51\n    D4 -->|\"ترجیح مکتب کاربر\"| P51\n    User -->|\"انتخاب لحن + سبک\"| P51\n\n    P51 -->|\"مکتب + سبک + لحن MSL\"| P52\n    D2 -->|\"داده تحلیلی کامل\"| P52\n    D4 -->|\"قالب پرامپت سیستم\"| P52\n\n    P52 -->|\"پرامپت سیستم + پرامپت کاربر\"| P53\n    P53 -->|\"درخواست completion\"| ZAI\n    ZAI -->|\"پاسخ خام LLM\"| P53\n\n    P53 -->|\"متن تولیدشده خام\"| P54\n    D2 -->|\"قیمت فعلی + داده واقعی\"| P54\n    P54 -->|\"تحلیل نهایی + دسکلیمر\"| D2\n    P54 -->|\"گزارش هوشمند\"| User"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L2-P6-SR-MANAGEMENT",
  "title": "نمودار جریان داده سطح ۲ - P6: مدیریت سطوح حمایت/مقاومت",
  "description": "این نمودار فرآیند P6 مدیریت سطوح حمایت و مقاومت از ۷ منبع مختلف را نشان می‌دهد.\nمنبع ۱: سطوح محاسبه‌شده از اندیکاتور Pivot Points.\nمنبع ۲: سطوح محاسبه‌شده از باندهای بولینگر.\nمنبع ۳: سطوح استاتیک تاریخی (قیمت‌های قبلی).\nمنبع ۴: سطوح روانی اعداد گرد.\nمنبع ۵: سطوح فیبوناچی ریتریسمنت.\nمنبع ۶: سطوح حجمی (نقاط حجم بالا).\nمنبع ۷: سطوح محاسبه‌شده از الگوهای کندلی.\nادغام و رتبه‌بندی سطوح با وزن‌دهی منابع انجام می‌شود.",
  "level": 2,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    D1[(\"D1: بازار داده\")]:::store\n    D2[(\"D2: کش تحلیل\")]:::store\n\n    SR1[\"منبع ۱: Pivot Points\"]:::process\n    SR2[\"منبع ۲: باندهای بولینگر\"]:::process\n    SR3[\"منبع ۳: سطوح تاریخی\"]:::process\n    SR4[\"منبع ۴: اعداد گرد روانی\"]:::process\n    SR5[\"منبع ۵: فیبوناچی\"]:::process\n    SR6[\"منبع ۶: حجمی\"]:::process\n    SR7[\"منبع ۷: الگوهای کندلی\"]:::process\n    Merge[\"ادغام و رتبه‌بندی ۷ منبع\"]:::process\n\n    D1 -->|\"High/Low/Close\"| SR1\n    D1 -->|\"High/Low/Close\"| SR3\n    D1 -->|\"High/Low/Close\"| SR5\n    D1 -->|\"حجم معاملات\"| SR6\n    D2 -->|\"BBands\"| SR2\n    D2 -->|\"الگوهای کندلی\"| SR7\n\n    SR1 -->|\"سطوح Pivot\"| Merge\n    SR2 -->|\"سطوح BB\"| Merge\n    SR3 -->|\"سطوح تاریخی\"| Merge\n    SR4 -->|\"سطوح روانی\"| Merge\n    SR5 -->|\"سطوح Fib\"| Merge\n    SR6 -->|\"سطوح حجمی\"| Merge\n    SR7 -->|\"سطوح کندلی\"| Merge\n\n    Merge -->|\"سطوح S/R نهایی + وزن\"| D2"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L2-P7-MONITORING",
  "title": "نمودار جریان داده سطح ۲ - P7: پایش و نمایش نتایج",
  "description": "این نمودار فرآیند P7 پایش و نمایش نتایج را نشان می‌دهد.\nپایپ‌لاین رندر شامل دریافت تمام نتایج از کش تحلیل و تبدیل به فرمت نمایش است.\nرندر نمودارها شامل ترسیم نمودار قیمت + اندیکاتورها + سطوح S/R با Chart.js است.\nرندر گراف تصمیم شامل نمایش تعاملی ۳۴ گره و ۵۵ یال با رنگ‌بندی سناریوهاست.\nرندر کارت‌های سناریو شامل نمایش ۹ سناریو SC1-SC9 با احتمالات و توضیحات است.\nرندر بخش AI شامل نمایش متن تحلیل هوشمند با فرمت Markdown است.\nهماهنگ‌سازی SSE شامل ارسال رویدادهای سرور-فرست برای به‌روزرسانی زنده است.",
  "level": 2,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    User{{\"کاربر\"}}:::entity\n\n    D2[(\"D2: کش تحلیل\")]:::store\n\n    Fetch[\"دریافت نتایج از کش\"]:::process\n    ChartRender[\"رندر نمودارها\"]:::process\n    GraphRender[\"رندر گراف تصمیم\"]:::process\n    ScenarioCards[\"رندر کارت‌های سناریو\"]:::process\n    AIRender[\"رندر بخش AI\"]:::process\n    SSE[\"هماهنگ‌سازی SSE\"]:::process\n\n    D2 -->|\"تمام داده تحلیلی\"| Fetch\n    Fetch -->|\"داده سری زمانی + اندیکاتورها\"| ChartRender\n    Fetch -->|\"گراف ۳۴ گره\"| GraphRender\n    Fetch -->|\"احتمالات SC1-SC9\"| ScenarioCards\n    Fetch -->|\"متن AI\"| AIRender\n\n    ChartRender -->|\"نمودار تعاملی\"| User\n    GraphRender -->|\"گراف بصری\"| User\n    ScenarioCards -->|\"کارت‌های سناریو\"| User\n    AIRender -->|\"تحلیل هوشمند\"| User\n\n    SSE -->|\"به‌روزرسانی زنده\"| ChartRender\n    SSE -->|\"به‌روزرسانی زنده\"| GraphRender\n    SSE -->|\"به‌روزرسانی زنده\"| ScenarioCards\n    D2 -->|\"رویداد تغییر\"| SSE"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L3-P41-GRAPH-CONSTRUCTION",
  "title": "نمودار جریان داده سطح ۳ - P4.1: ساخت گراف تصمیم (فرآیندهای اتمی)",
  "description": "این نمودار فرآیندهای اتمی P4.1 را با بیشترین جزئیات نشان می‌دهد.\nP4.1.1 مقداردهی گره‌ها شامل ایجاد ۳۴ گره تصمیم با مقادیر اولیه از اندیکاتورها و رژیم بازار است.\nP4.1.2 محاسبه وزن یال‌ها شامل تعیین وزن ۵۵+ یال بر اساس همبستگی اندیکاتورها و فاصله S/R است.\nP4.1.3 نرمال‌سازی سیگموئید شامل اعمال تابع سیگموئید برای نرمال‌سازی وزن‌ها به بازه ۰-۱ است.\nP4.1.4 تشخیص شاخه غالب شامل شناسایی ۳ شاخه استراتژی (صعودی/خنثی/نزولی) و انتخاب مسیر بهینه است.\nاین فرآیندها پایه‌ای‌ترین سطح اجرای گراف تصمیم هستند.",
  "level": 3,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    Indicators{{\"اندیکاتورهای محاسبه‌شده\"}}:::entity\n    Regime{{\"رژیم بازار\"}}:::entity\n    SRLevels{{\"سطوح S/R\"}}:::entity\n\n    D2[(\"D2: کش تحلیل\")]:::store\n    D3[(\"D3: مدل ML\")]:::store\n\n    P411[\"P4.1.1: مقداردهی گره‌ها\"]:::process\n    P412[\"P4.1.2: محاسبه وزن یال‌ها\"]:::process\n    P413[\"P4.1.3: نرمال‌سازی سیگموئید\"]:::process\n    P414[\"P4.1.4: تشخیص شاخه غالب\"]:::process\n\n    Indicators -->|\"مقادیر ۴۳ اندیکاتور\"| P411\n    Regime -->|\"نوع رژیم + احتمال\"| P411\n    SRLevels -->|\"فاصله تا S/R نزدیک\"| P411\n    D3 -->|\"وزن‌های آموخته‌شده\"| P411\n\n    P411 -->|\"۳۴ گره با مقدار اولیه\"| P412\n    Indicators -->|\"همبستگی اندیکاتورها\"| P412\n    SRLevels -->|\"فاصله S/R\"| P412\n\n    P412 -->|\"وزن‌های خام یال‌ها\"| P413\n    P413 -->|\"وزن‌های نرمال‌شده ۰-۱\"| P414\n    P413 -->|\"وزن‌های نرمال‌شده\"| D2\n\n    P414 -->|\"شاخه غالب + ۳ شاخه استراتژی\"| D2\n    P414 -->|\"گراف نهایی\"| P412\n    D2 -->|\"گراف کش‌شده\"| P414"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L3-P53-LLM-INVOCATION",
  "title": "نمودار جریان داده سطح ۳ - P5.3: فراخوانی LLM (فرآیندهای اتمی)",
  "description": "این نمودار فرآیندهای اتمی P5.3 را با بیشترین جزئیات نشان می‌دهد.\nP5.3.1 بررسی محدودیت نرخ شامل کنترل Rate Limit و شمارش توکن و مدیریت صف درخواست‌هاست.\nP5.3.2 ارسال درخواست شامل فراخوانی تابع dedicatedAIChatCompletion از z.ai SDK با پرامپت سیستم و کاربر است.\nP5.3.3 دریافت پاسخ شامل پارس JSON پاسخ LLM و استخراج متن و متاداده‌های مصرف توکن است.\nP5.3.4 اعمال بازگشت‌ پسین شامل بررسی خطا، تلاش مجدد با تأخیر نمایی و بازگشت به تحلیل الگووریسمی در صورت شکست کامل است.\nاین فرآیندها بحرانی‌ترین بخش ارتباط با z.ai LLM هستند.",
  "level": 3,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    ZAI{{\"z.ai LLM API\"}}:::entity\n    Prompt{{\"پرامپت ساختاریافته\"}}:::entity\n\n    D2[(\"D2: کش تحلیل\")]:::store\n    D4[(\"D4: تنظیمات\")]:::store\n\n    P531[\"P5.3.1: بررسی محدودیت نرخ\"]:::process\n    P532[\"P5.3.2: ارسال درخواست\"]:::process\n    P533[\"P5.3.3: دریافت پاسخ\"]:::process\n    P534[\"P5.3.4: اعمال بازگشت پسین\"]:::process\n\n    Prompt -->|\"پرامپت سیستم + کاربر\"| P531\n    D4 -->|\"API key + rate limit config\"| P531\n    D4 -->|\"max tokens + model config\"| P531\n\n    P531 -->|\"درخواست تأییدشده\"| P532\n    P532 -->|\"HTTP request: dedicatedAIChatCompletion\"| ZAI\n    ZAI -->|\"HTTP response: JSON\"| P533\n\n    P533 -->|\"پاسخ پارس‌شده + متاداده\"| P534\n    P533 -->|\"خطا یا تایم‌اوت\"| P534\n\n    P534 -->|\"متن LLM موفق\"| D2\n    P534 -->|\"تلاش مجدد\"| P531\n    P534 -->|\"تحلیل بازگشتی الگووریتمی\"| D2\n    P531 -->|\"وضعیت نرخ + شمارش توکن\"| D4"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L3-REGIME-ENGINES",
  "title": "نمودار جریان داده سطح ۳ - جزئیات موتورهای تشخیص رژیم",
  "description": "این نمودار جزئیات داخلی سه موتور تشخیص رژیم بازار را نشان می‌دهد.\nموتور فازی شامل فازی‌سازی ورودی‌ها، ارزیابی قواعد فازی و غیرفازی‌سازی خروجی است.\nموتور مارکوف شامل تخمین ماتریس انتقال، محاسبه توزیع حالت پایا و پیش‌بینی حالت بعدی است.\nموتور رأی‌گیری وزنی شامل جمع‌آوری رأی‌ها، اعمال وزن‌ها و تصمیم‌گیری اکثریت وزنی است.\nترکیب نهایی از فرمول ترکیب خطی: R = 0.3*R_fuzzy + 0.5*R_markov + 0.2*R_vote محاسبه می‌شود.\nسیستم ML می‌تواند وزن‌ها را بر اساس عملکرد گذشته بهینه‌سازی کند.",
  "level": 3,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    D3[(\"D3: مدل ML\")]:::store\n\n    Fuzzify[\"فازی‌سازی ورودی\"]:::process\n    RuleEval[\"ارزیابی قواعد فازی\"]:::process\n    Defuzzify[\"غیرفازی‌سازی\"]:::process\n\n    TransEst[\"تخمین ماتریس انتقال\"]:::process\n    SteadyState[\"محاسبه توزیع حالت پایا\"]:::process\n    NextState[\"پیش‌بینی حالت بعدی\"]:::process\n\n    CollectVotes[\"جمع‌آوری رأی‌ها\"]:::process\n    ApplyWeights[\"اعمال وزن‌ها\"]:::process\n    MajorDecision[\"تصمیم اکثریت وزنی\"]:::process\n\n    FinalCombine[\"ترکیب: 0.3*F + 0.5*M + 0.2*V\"]:::process\n\n    Fuzzify -->|\"مقادیر فازی\"| RuleEval\n    RuleEval -->|\"نتیجه قواعد\"| Defuzzify\n    Defuzzify -->|\"رژیم فازی\"| FinalCombine\n\n    D3 -->|\"داده تاریخی\"| TransEst\n    TransEst -->|\"ماتریس انتقال\"| SteadyState\n    SteadyState -->|\"توزیع پایا\"| NextState\n    NextState -->|\"رژیم مارکوف\"| FinalCombine\n\n    CollectVotes -->|\"رأی‌ها\"| ApplyWeights\n    ApplyWeights -->|\"رأی وزنی\"| MajorDecision\n    MajorDecision -->|\"رژیم رأی‌گیری\"| FinalCombine\n\n    FinalCombine -->|\"وزن‌های بهینه\"| D3"
}
===DIAGRAM_END===

===DIAGRAM_START===
{
  "id": "DFD-L3-MSL-SELECTION",
  "title": "نمودار جریان داده سطح ۳ - جزئیات سیستم MSL v4",
  "description": "این نمودار جزئیات داخلی سیستم MSL v4 برای انتخاب مکتب تحلیلی را نشان می‌دهد.\n۶ مکتب: کلاسیک، وایکوف، ایلیوت، حجم‌محور، هارمونیک، هوشمند\n۵ سبک: آکادمیک، حرفه‌ای، آموزشی، خبری، ساده\n۶ لحن: رسمی، دوستانه، محافظه‌کار، تهاجمی، خنثی، هشداردهنده\nانتخاب مکتب بر اساس رژیم بازار و ترجیح کاربر انجام می‌شود.\nهر ترکیب مکتب × سبک × لحن قالب پرامپت منحصربه‌فردی تولید می‌کند.\nمجموع ۶ × ۵ × ۶ = ۱۸۰ ترکیب ممکن وجود دارد.",
  "level": 3,
  "code": "flowchart TB\n    classDef entity fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000\n    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000\n    classDef store fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000\n\n    Regime{{\"رژیم بازار\"}}:::entity\n    User{{\"کاربر\"}}:::entity\n    D4[(\"D4: تنظیمات\")]:::store\n\n    SchoolSelect[\"انتخاب مکتب (۶ مکتب)\"]:::process\n    StyleSelect[\"انتخاب سبک (۵ سبک)\"]:::process\n    ToneSelect[\"انتخاب لحن (۶ لحن)\"]:::process\n    TemplateBuild[\"ساخت قالب پرامپت\"]:::process\n    Validation[\"اعتبارسنجی ترکیب\"]:::process\n\n    Regime -->|\"نوع رژیم\"| SchoolSelect\n    User -->|\"ترجیح مکتب\"| SchoolSelect\n    D4 -->|\"تنظیمات پیش‌فرض\"| SchoolSelect\n\n    SchoolSelect -->|\"مکتب انتخابی\"| StyleSelect\n    User -->|\"ترجیح سبک\"| StyleSelect\n\n    StyleSelect -->|\"سبک انتخابی\"| ToneSelect\n    User -->|\"ترجیح لحن\"| ToneSelect\n    Regime -->|\"توصیه لحن\"| ToneSelect\n\n    ToneSelect -->|\"لحن انتخابی\"| TemplateBuild\n    SchoolSelect -->|\"مکتب\"| TemplateBuild\n    StyleSelect -->|\"سبک\"| TemplateBuild\n\n    TemplateBuild -->|\"قالب پرامپت - ۱۸۰ ترکیب\"| Validation\n    Validation -->|\"قالب تأییدشده\"| D4"
}
===DIAGRAM_END===

---

## خلاصه نمودارها

| سطح | شناسه | عنوان | فرآیندها | ذخیره‌گاه‌ها | موجودیت خارجی | یال‌ها |
|------|--------|-------|-----------|---------------|----------------|--------|
| 0 | DFD-L0-CONTEXT | نمودار زمینه | 1 | 0 | 7 | 10 |
| 1 | DFD-L1-MAIN-PROCESSES | فرآیندهای اصلی | 7 | 4 | 6 | 28 |
| 2 | DFD-L2-P1-MARKET-DATA | دریافت داده بازار | 5 | 2 | 5 | 16 |
| 2 | DFD-L2-P2-TECHNICAL-ANALYSIS | تحلیل تکنیکال | 4 | 3 | 0 | 15 |
| 2 | DFD-L2-P3-REGIME-DETECTION | تشخیص رژیم | 4 | 3 | 0 | 11 |
| 2 | DFD-L2-P4-DECISION-GRAPH | گراف تصمیم | 4 | 2 | 2 | 11 |
| 2 | DFD-L2-P5-AI-GENERATION | تولید AI | 4 | 2 | 2 | 13 |
| 2 | DFD-L2-P6-SR-MANAGEMENT | سطوح S/R | 8 | 2 | 0 | 14 |
| 2 | DFD-L2-P7-MONITORING | پایش نتایج | 6 | 1 | 1 | 13 |
| 3 | DFD-L3-P41-GRAPH-CONSTRUCTION | ساخت گراف (اتمی) | 4 | 2 | 3 | 13 |
| 3 | DFD-L3-P53-LLM-INVOCATION | فراخوانی LLM (اتمی) | 4 | 2 | 2 | 12 |
| 3 | DFD-L3-REGIME-ENGINES | موتورهای رژیم | 10 | 1 | 0 | 11 |
| 3 | DFD-L3-MSL-SELECTION | سیستم MSL v4 | 5 | 1 | 2 | 13 |

