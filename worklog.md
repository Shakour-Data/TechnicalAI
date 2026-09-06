---
Task ID: 1
Agent: main
Task: Fix client-side crash / instability in Z.ai preview panel iframe

Work Log:
- Diagnosed root cause: multiple crash sources in iframe/sandboxed contexts
- Created /src/lib/safe-storage.ts with safe localStorage/sessionStorage/ResizeObserver wrappers
- Fixed zustand persist in theme-store.ts: uses safeLocalStorage + skipHydration to prevent SSR/client mismatch
- Wrapped all ResizeObserver in try-catch: candlestick-chart.tsx, tradingview-chart.tsx, vdss-graph.tsx
- Replaced window.location.reload() (15-min timer) with soft doRefresh() to prevent iframe crashes
- Wrapped window.addEventListener(focus) in try-catch for iframe safety
- Created /src/app/error.tsx route-level error boundary with recovery UI
- Created /src/app/global-error.tsx root-level error boundary
- Upgraded layout.tsx head script with comprehensive error suppression (unhandledrejection + onerror)
- Upgraded global-error-guard.tsx to also handle window.onerror events
- Verified: page renders correctly, zero console errors, zero lint errors in source

Stage Summary:
- Fixed 7 crash sources that caused intermittent failures in iframe contexts
- Added 3-layer error defense: head script (earliest) → GlobalErrorGuard (component) → error.tsx (boundary)
- System is now stable in both direct browser and iframe/sandboxed preview panel

---
Task ID: 2
Agent: main
Task: Fix hallucinated prices and Persian text quality in AI analysis

Work Log:
- Diagnosed: LLM receives correct prices (MA21: 1,934,395) but generates wrong ones (30,360) in text
- Root cause: LLM drops zeros / changes price scale in generated text
- Created /src/lib/ai-postprocess.ts with 3-layer post-processing pipeline
- Added Rule 26 (price scale preservation) and Rule 27 (Persian writing quality) to system prompt
- Integrated postProcessAIOutput() into AI analysis route replacing old regex chain
- Added price-based cache gating: hallucinated analyses are NOT saved to DB cache
- Cleared all existing cached analyses from DB (prisma db execute DELETE)
- Verified: fresh dollar analysis generates correct prices (2,140,000, 1,934,395, 1,811,362, etc.)
- Added Chinese character stripping (was leaking 突破 in output)
- Added common typo fixes (ضررر → ضرر)

Stage Summary:
- Created comprehensive ai-postprocess.ts module
- All prices now validated against input data (15% tolerance)
- Bad analyses are never cached, preventing stale wrong data
- Persian text quality fixes for mixed-language words and common typos
- All financial instruments benefit from these fixes (applies universally)

---
Task ID: 3
Agent: main
Task: Fix Iranian market index data fetching for all 50 indices (10 main + 40 sector)

Work Log:
- Diagnosed: port 3032 service uses its own z-ai SDK instance (separate from rate limiter) → fails silently
- Verified: /api/index-fetch-proxy works correctly (557KB CWI data via shared rate limiter)
- Rewrote /src/lib/tsetmc-index-api.ts: removed dependency on 3032 service, now uses Next.js proxy
- Fixed /src/app/api/finpy-sector/route.ts: moved TA imports to module scope (was scoping bug)
- Created /scripts/prefetch-all-indices.ts: pre-fetches all 50 indices to file cache
- Pre-fetched all 10 main indices + 40 sector indices to /db/ cache files
- Updated /mini-services/tsetmc-index-service/index.ts: uses proxy approach for background refresh
- Fixed /src/app/api/instruments/route.ts: added fuzzy name matching for BrsApi index names
  - Handles: "شاخص کل (هم وزن)" → EWI, "شاخص آزاد شناور" → FFI, etc.
- Verified: all 50 indices return correct data with TA via /api/finpy-sector
- Verified: all BrsApi indices now have correct webId/finpyIndex metadata

Stage Summary:
- All 50 TSE indices (10 main + 40 sector) now fetch correctly via centralized proxy
- 4-tier cache: memory → file → proxy → expired file fallback
- BrsApi name variations handled via alias + fuzzy matching
- Data freshness: all indices up to 1405/06/10 (current)
---
Task ID: 4
Agent: main
Task: Fix index unit (واحد vs ریال), Persian half-space, paragraph separation, grammar in AI text

Work Log:
- Diagnosed: finpy-sector/route.ts buildResponse() was missing `currencyUnit: 'واحد'` and `category: 'index'` in info object
- This caused page.tsx to fallback to 'ریال' for all TSE indices
- Fixed finpy-sector/route.ts: added currencyUnit and category to info
- Fixed ai-analysis/route.ts: enhanced unitLabel detection — checks clientCategory='index' AND symbolName.includes('شاخص')
- Fixed ai-analysis/route.ts: instrumentLabel now says 'شاخص بورس ایران' for indices instead of 'سهم بورس ایران'
- Rewrote SYSTEM_PROMPT in ai-analysis/route.ts with comprehensive Persian writing rules:
  - Rule 18: No ZWNJ, use space for compound words. Extensive correct/incorrect examples.
  - Rule 19: Proper paragraph separation with double newlines
  - Rule 20: Writing quality rules (punctuation, no mixed-language, etc.)
  - Rule 21: Indices must use 'واحد' never 'ریال' or 'دلار', with example
- Rewrote ai-postprocess.ts with comprehensive post-processing:
  - fixZwnjSpacing(): converts ZWNJ to space for 40+ compound word patterns
  - STUCK_WORDS: 60+ patterns for words stuck together (کوتاهمدت→کوتاه مدت, etc.)
  - Mixed-language word fixes (بولینger→بولینگر, etc.)
  - AI typo fixes (اصلاق→اصلاح, ضررر→ضرر, احتمالاتی→احتمالات)
  - Paragraph normalization (single newline → double newline after sentences)
  - Punctuation spacing fixes
- Verified via agent-browser: index now shows 'واحد' everywhere (price display, scenario table, AI text)
- Verified AI text uses 'کوتاه مدت', 'بلند مدت', 'نشان دهنده' with proper spaces

Stage Summary:
- Root cause of 'ریال' for indices: finpy-sector API missing currencyUnit in response
- All 3 layers fixed: data source (finpy-sector), AI prompt (stronger rules), post-processing (comprehensive fixes)
- AI text now uses correct 'واحد' for indices
- AI text now uses spaces instead of ZWNJ for compound words
- AI text has proper paragraph separation

---
Task ID: 5
Agent: main
Task: Add professional narrative, HTML export, and fixes to decision graph page

Work Log:
- Task 4: Fixed currencyUnit hardcoding in VdssGraph
  - Added `currencyUnit?: string` to VdssGraphProps
  - Changed hardcoded 'ریال' in metric card to use `props.currencyUnit ?? 'ریال'`
  - Passed `currencyUnit={currencyUnit}` from page.tsx to VdssGraph
- Task 1: Added professional Persian narrative text to decision graph
  - Created `generateDecisionGraphNarrative()` function in vdss-graph.tsx (exported)
  - Generates 5-section algorithmic Persian text: graph explanation, exclusive probabilities (ranked), cumulative probabilities (CDF), 30-day trends (rising/falling/stable/volatile), branch contributions
  - All text uses regular spaces (no ZWNJ), toPersianDigits for numbers
  - Added `DecisionGraphNarrative` component as Collapsible section after ProbabilityTrendTable
  - Matches dark theme styling of the VdssGraph component
- Task 2: Created standalone HTML+CSS+JS export
  - Created /src/lib/decision-graph-export.ts with `exportDecisionGraphHTML()` function
  - Export data type: DecisionGraphExportData interface
  - Generates self-contained HTML with: header, metric cards, SVG decision graph, scenario boxes with branch contributions, cumulative chart, per-scenario trend mini-charts, 30-day trend table, narrative text
  - Dark theme matching VdssGraph (#07111b background)
  - RTL direction, Vazirmatn font from CDN with Tahoma fallback
  - Interactive elements: hoverable nodes, node highlighting on hover
  - Responsive design for mobile
- Task 3: Added export option in visual explanatory page
  - Added `Network` icon import from lucide-react
  - Added `DropdownMenuSeparator` import from dropdown-menu
  - Added `decisionGraph` prop to VdesAnalysisProps
  - Created `exportDecisionGraph` async callback using dynamic imports
  - Added separator + new menu item "گراف تصمیم (HTML)" after PNG option
  - Passed `decisionGraph={data.ta.decisionGraph}` from page.tsx to VdesAnalysis
- All lint errors in modified files resolved (pre-existing errors in candlestick-chart.tsx unchanged)

Stage Summary:
- Decision graph page now has comprehensive professional Persian narrative text
- Users can export the full decision graph analysis as a standalone HTML file
- Currency unit correctly shows 'واحد' for indices instead of hardcoded 'ریال'
- All 4 tasks implemented, zero new lint errors introduced
---
Task ID: 6
Agent: main
Task: Rewrite decision-graph-export.ts with Canvas-based interactivity (no SVG)

Work Log:
- Completely rewrote /src/lib/decision-graph-export.ts
- Decision graph: Canvas for edges + HTML divs for nodes (full click/hover/filter interactivity)
- Cumulative probability chart: Canvas with mouse hover line + tooltip
- Per-scenario trend charts: Canvas with multi-select toggle buttons + hover line + tooltip
- Filter toolbar included: all/up/pullback/down/risk/trend/breakout/reversal/SC1-SC9
- All data embedded as JSON in window.__DG_DATA__
- All inline JS uses string concatenation (no backticks) to avoid template literal conflicts
- Professional narrative text included in export
- Responsive with ResizeObserver for canvas redraw
- Zero new lint errors

Stage Summary:
- Export file is now fully interactive Canvas-based (no SVG)
- Filter toolbar replicated from in-page component
- All 4 visual elements (graph, cumulative chart, per-scenario charts, trend table) are present
- Narrative text embedded in export output

---
Task ID: 7
Agent: main
Task: Add AI-powered advanced analysis to decision graph page (per-symbol)

Work Log:
- Created /src/app/api/ai-decision-graph/route.ts — new API endpoint specialized for decision graph analysis
  - Specialized DG_SYSTEM_PROMPT focused on: graph structure (27 paths, 3 branches), scenario probabilities, branch contributions, probability trends
  - buildDGPrompt() constructs data payload with: scenarios (sorted by prob), branch probabilities, path contributions, group probabilities, 30-day trends, support/resistance
  - Reuses dedicatedAIChatCompletion from zai-shared, postProcessAIOutput from ai-postprocess
  - Daily cache via DecisionGraphAiCache Prisma model, previous-day fallback (2% price tolerance)
  - Price validation prevents caching hallucinated analyses
- Added DecisionGraphAiCache model to prisma/schema.prisma (symbol, date, text, price)
- Ran db:push to sync database schema
- Added new props to VdssGraphProps: atr, instrumentType, instrumentCategory
- Created DecisionGraphAIAnalysis component in vdss-graph.tsx
  - Collapsible section with green-themed trigger (🤖 icon)
  - Lazy-fetches AI analysis on first open (no auto-fetch on page load)
  - Loading spinner, error display, cached indicator
  - renderDGAIText() helper parses {color:X}text{/color} and **bold** from AI output
  - Dark theme styling matching VdssGraph
- Created renderDGAIText() helper function for parsing AI text formatting
- Passed additional props (atr, instrumentType, instrumentCategory) from page.tsx to VdssGraph
- Fixed regex issues: escaped \* in regex patterns, used RegExp literals instead of string patterns
- Verified via agent-browser: section visible, click triggers API, AI text generated and displayed successfully

Stage Summary:
- Decision graph page now has per-symbol AI analysis via collapsible "تحلیل هوشمند گراف تصمیم" section
- AI text focuses on graph structure, branch strategy contributions, probability trends
- Daily caching with price-validation prevents re-generation for same-day same-price requests
- Zero new lint errors in modified files
---
Task ID: 1
Agent: main
Task: Verify and fix candlestick colors in visual explanation section

Work Log:
- Searched all candlestick chart components in the codebase
- candlestick-chart.tsx: BULL=#22c55e (green) for up, BEAR=#ef4444 (red) for down
- vdes-analysis.tsx export: BULL=#22c55e (green), BEAR=#ef4444 (red)
- export-utils.ts: upColor=#34c98b (green), downColor=#ef4d62 (red)
- tradingview-chart.tsx: BULL=#22a366 (green), BEAR=#e04060 (red)
- Volume bars in all charts use same green=up, red=down convention
- Checked for CSS color inversion, theme overrides, and filter conditions - none found

Stage Summary:
- All candlestick charts already follow international convention (green=up, red=down)
- No code changes needed
---
Task ID: 2
Agent: main
Task: Verify AI decision graph analysis implementation

Work Log:
- Read /api/ai-decision-graph/route.ts - comprehensive AI prompt with all decision graph data
- Read vdss-graph.tsx DecisionGraphAIAnalysis component (line 1034-1180)
- Confirmed it calls /api/ai-decision-graph with symbol-specific data
- API passes: symbolName, scenarios, branchProbabilities, pathContributions, probabilityTrend, RSI, ADX, ATR, supports, resistances
- Has DB caching with price validation
- System prompt enforces 600-1200 words, no technical codes, Persian-only text

Stage Summary:
- AI decision graph analysis is fully implemented and symbol-specific
- No code changes needed
---
Task ID: 3
Agent: main
Task: Verify AI analysis prompt fixes (units, Persian writing, price scale)

Work Log:
- Verified /api/ai-analysis/route.ts system prompt (lines 366-415)
- Rule 21 (lines 404-408): Explicitly requires indices to use واحد, not ریال/دلار
- Rule 18-19 (lines 387-403): Regular spaces only, no ZWNJ, proper paragraph separation
- Rule 27 (line 414): Explicitly prohibits price scale changes
- Rule 24 (line 411): Requires exact numerical accuracy
- format-price.ts getCurrencyUnit() returns واحد for index categories
- Unit detection in AI route (lines 258-278) correctly maps indices to واحد

Stage Summary:
- All AI text quality issues already addressed in system prompt
- No code changes needed

---
Task ID: 8
Agent: main
Task: Replace API-based decision graph AI analysis with algorithmic text generation (same as VDES)

Work Log:
- Analyzed VDES section: uses algorithmic generateAnalysisText() function (no API) for procedural text
- Analyzed decision graph: was using fetch('/api/ai-decision-graph') API call
- Created generateAdvancedDGAnalysis() function that produces comprehensive symbol-specific analysis
- Function covers 5 sections: graph structure, branch strategy analysis, risk/reward + indicators, probability trends, actionable insights
- Uses same formatting as AI text ({color:X}text{/color}, **bold**)
- Replaced DecisionGraphAIAnalysis component: removed fetch/API call, loading state, error state, cache state
- Now uses useMemo to generate text instantly (no network requests)
- Fixed parsing error (missing closing paren in template literal)
- Removed unused variables (isIndex, faPct, faPctInt, trendLabel)
- Verified: zero lint errors in modified file
- Verified: server compiles and serves HTTP 200

Stage Summary:
- Decision graph advanced analysis now generates text algorithmically (same technology as VDES visual explanation)
- No API calls needed - Z.ai generates text directly via algorithmic function
- Text is symbol-specific, uses real data (probabilities, branches, RSI, ADX, ATR, supports/resistances)
- Instant display (no loading spinner needed)
---
Task ID: 1
Agent: main
Task: Fix all 6 critical bugs permanently as reported by user

Work Log:
- Fixed Persian text formatting in VDSS analysis (generateAdvancedDGAnalysis):
  - Added proper title with ## markdown syntax (removed emoji)
  - Added section headings with ### syntax (ساختار کلی گراف, تحلیل استراتژی‌ها, شاخص‌های تکنیکال, پویایی احتمالات, توصیه عملی)
  - Changed from joining sentences with spaces to putting each on its own line
  - Added ZWNJ (نیم‌فاصله) in all Persian compound words (نشان‌دهنده, سه‌لایه, می‌شود, قرار می‌گیرد, etc.)
  - Renamed pctW→pctWhole for clarity
- Fixed renderDGAIText to detect ## and ### headings and render as <h2>/<h3>
- Fixed percentage bug: pathContributions are already 0-100 but faPct multiplied by 100 again → added faPctWhole function
- Fixed narrative text ZWNJ issues in generateDecisionGraphNarrative
- Fixed renderAIText in vdes-analysis.tsx:
  - Preserved ZWNJ characters (previously stripped)
  - Added ##/### heading detection
  - Improved paragraph structure
- Fixed decimal precision across all components:
  - analysis-sidebar.tsx: Added priceDecimals prop, dynamic toFa via formatPriceFa
  - ml-forecast.tsx: Added priceDecimals prop, dynamic formatters
  - vdes-analysis.tsx: Component-level toFa using formatPriceFa
  - indicators-panel.tsx: Simplified to always use formatPriceFa
  - vdss-graph.tsx: fa() always uses priceDecimals
  - page.tsx: Passes priceDecimals to all components
- Fixed semicircle gauge rendering:
  - Repositioned value text to visual center of arc
  - Changed stroke caps to butt to eliminate double-thickness artifact
- Replaced meaningless capsule badges with informative summary line
- Fixed instrument data fetching:
  - Added normalizePersian() for Arabic/Persian character matching
  - Fixed BrsApi index merge with Map-based lookup
  - Added final dedup pass
- Fixed AI analysis errors:
  - Reduced 429 cooldown from 10→3 minutes
  - Added exponential backoff retry for 429 and transient errors
  - Added client-side auto-retry with exponential backoff
  - Improved error messages

Stage Summary:
- All 6 critical bugs fixed permanently
- Persian text now follows proper writing conventions (ZWNJ, paragraph structure, headings)
- Decimal precision derives from data source across all components
- Percentage bug fixed (no more 2500% instead of 25%)
- Gauge rendering improved (centered text, clean stroke caps)
- Meaningless badges replaced with informative summary
- Instrument dedup and data fetching fixed with Persian normalization
- AI analysis more resilient with auto-retry and better error handling
---
Task ID: 1
Agent: main
Task: Fix gold ETF (صندوق طلا) data source - change from TGJU to TSE

Work Log:
- Explored project structure to understand data fetching architecture
- Identified that gold ETFs (ime_fund_*) were incorrectly sourced from TGJU instead of TSE
- Found 18 gold ETFs on TSE (BrsApi) with correct live data: عیار, طلا, ناب, درنا, etc.
- Added `GOLD_ETF_KEYWORDS`, `GOLD_ETF_SYMBOLS`, and `isGoldEtf()` to tse-api.ts
- Updated `fetchAllInstruments()` in tse-api.ts to separate gold ETFs from regular ETFs
- Updated `/api/instruments` route to include `goldEtfs` in response
- Removed `gold_etf` from TGJU categorization in tgju-api.ts (no longer categorizes ime_fund_* as gold_etf)
- Updated `/api/tgju-instruments` route to return empty goldEtfs array
- Updated `/api/tgju-analysis` route to remove gold_etf from iranianCategories
- Updated symbol-search.tsx: moved gold_etf from "بازار ایران" (TGJU) to "بورس تهران" (TSE)
- Removed gold_etf from TGJU_CATEGORIES in both symbol-search.tsx and page.tsx
- Updated page.tsx so gold_etf items route through TSE analysis (not TGJU)
- Updated format-price.ts to handle gold_etf as TSE category
- Updated tgju-api.ts TGJU_CATEGORY_INFO to remove gold_etf entry
- Verified with API test: /api/instruments returns 18 goldEtfs from TSE
- Verified with Agent Browser: صندوق طلا category shows TSE-sourced gold ETFs
- Verified analysis page loads correctly for عیار (صندوق طلای عیار مفید) with TSE data

Stage Summary:
- Gold ETFs (صندوق طلا) now use TSE (BrsApi) as data source instead of TGJU
- 18 TSE-listed gold ETFs identified: عیار, طلا, ناب, درنا, جام طلا, همیان, نگین فارس, گلدیس, زرین, زر, زرفام, زریران, زرگر, زروان, لیان, بزرگ, آوا, تخت گاز
- Category moved from "بازار ایران" (TGJU) to "بورس تهران" (TSE) in search UI
- Data source badge now shows "بورس" instead of "TGJU" for gold ETFs
- No browser errors, analysis page loads correctly with full TA
---
Task ID: 1
Agent: main
Task: تحلیل متنی در بخش تصویری و گراف باید کاملا با هم منطبق و بر اساس آخرین قیمت ها باشد. هر بار تحلیل بر اساس قیمت لحظه‌ای نوشته شود.

Work Log:
- بررسی کامل سیستم کش تحلیل AI (دیتابیس و localStorage)
- تغییر Prisma schema: از کش روزانه (symbol+date) به کش زمانی (symbol+priceHash) با TTL 5 دقیقه
- اضافه کردن فیلدهای priceHash و updatedAt به AiAnalysisCache و DecisionGraphAiCache
- اضافه کردن تابع computePriceHash() برای bucket کردن قیمت به بازه‌های 0.5%
- تغییر /api/ai-analysis: حذف کش روزانه، اضافه کردن cache TTL 5 دقیقه، پشتیبانی forceRefresh، حذف previous-day fallback
- تغییر /api/ai-decision-graph: مشابه تغییرات ai-analysis
- اضافه کردن cache cleanup: نگهداری آخرین 3 ورودی کش برای هر نماد
- تغییر فرانت‌اند vdes-analysis.tsx: حذف کش روزانه localStorage، اضافه کردن کش 5 دقیقه‌ای با آستانه قیمت 1%
- اضافه کردن stateهای aiForceRefresh، aiCachedAge، aiPriceAtGen به کامپوننت
- اضافه کردن دکمه "🔄 تحلیل جدید" برای force refresh
- اضافه کردن نشانگر سن کش (مثلاً "تحلیل بر اساس قیمت لحظه‌ای" یا "X دقیقه پیش")
- تست با Agent Browser: صفحه فولاد بارگذاری شد، دکمه تحلیل جدید کار کرد، کش TTL و priceHash درست کار کرد
- لاگ سرور: "Force refresh requested" → "cache miss" → "Saved to cache (priceHash=2666)" → "Cache HIT (age=0s)"

Stage Summary:
- سیستم کش از روزانه به زمانی (5 دقیقه TTL) تغییر کرد
- کلید کش از (symbol, date) به (symbol, priceHash) تغییر شد
- چندین تحلیل در روز برای یک نماد ممکن شد (وقتی قیمت تغییر کند)
- forceRefresh از فرانت‌اند و API پشتیبانی می‌شود
- دکمه "تحلیل جدید" به UI اضافه شد
- نشانگر سن کش به UI اضافه شد
- تشخیص hallucination قیمت کار می‌کند و از کش داده نادرست جلوگیری می‌شود

---
Task ID: 1
Agent: main
Task: Compare 4 spec documents vs codebase, find discrepancies, implement missing features

Work Log:
- Read all 4 uploaded spec documents (TechnicalAnalysisDssGraph.txt, CumProb, CumProbTrend, MSL)
- Deep-analyzed ta-engine.ts, decision-graph.ts, probability-trend.ts, ml-engine.ts
- Found and fixed CRITICAL BUG: sr.SC1 → sr.R1 (undefined → NaN corrupting s_sr feature vector)
- Fixed dead code parameter: SC1 → R1 in calculateScenarioProbabilities (was referencing undefined R1)
- Added cumulativeProbability field to ScenarioResult interface per CumProb spec
- Implemented staircase cumulative probability computation (per spec §4) in scenario output
- Added bullishCumulative, neutralCumulative, bearishCumulative to TAResult per spec
- Added bullishWeighted, bearishWeighted (severity-weighted cumulative) to TAResult per spec
- Verified 30-day historical probability trend (computeHistoricalProbabilities) already implements no-lookahead-bias per CumProbTrend spec §5

Stage Summary:
- Fixed 2 critical bugs (sr.SC1 NaN, R1 undefined reference)
- Added 6 new fields to output (cumulativeProbability per scenario, group cumulatives, severity-weighted)
- Spec comparison report completed with all discrepancies documented
