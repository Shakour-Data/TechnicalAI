---
Task ID: 1
Agent: main

Work Log:
- Analyzed TGJU data fetching pipeline: direct fetch → page_reader CLI → Yahoo fallback
- Found root cause: z-ai CLI hangs when called from within Next.js process, and page_reader HTML contains <span> tags breaking column detection
- Replaced execFile(z-ai CLI) with z-ai-web-dev-sdk direct invocation
- Added HTML tag stripping in parseTgjuChartData for both code paths
- Fixed parsePersianNum to handle % suffix and return 0 for NaN
- Tested: price_dollar_rl returns 3929 candles, geram18 returns 3487 candles

Stage Summary:
- TGJU data fetching permanently fixed by using z-ai SDK instead of CLI
- All Iranian currency/gold/silver instruments now work
---
Task ID: 2
Agent: main

Work Log:
- Added getInstrumentTerms() function mapping 12 categories to Persian terms (noun, typeLabel, priceAction, tradeAction)
- Added instrumentCategory prop to VdesAnalysisProps and AnalysisContext
- Replaced hardcoded "سهم" (stock) with dynamic instrument noun based on category
- Replaced "قیمت" with dynamic priceAction (نرخ for currency/forex, مقدار for indices)
- Passed data.info.category from page.tsx to VdesAnalysis component

Stage Summary:
- Text generation now uses proper instrument terminology per category
- Currency shows "ارز" with "نرخ", gold shows "طلا و سکه" with "قیمت", indices show "شاخص" with "مقدار"

---
Task ID: 4
Agent: main

Work Log:
- Replaced 9 individual ScenarioMiniChart components with 2 MultiSelectTrendChart components
- Chart 1: Individual probability trends (all 9 scenarios on one chart)
- Chart 2: Cumulative probability trends CDF (all 9 scenarios on one chart)
- Each chart has clickable legend buttons to toggle scenario visibility
- Hover tooltip shows values for all visible scenarios per day
- Removed duplicate SCENARIO_LINE_COLORS definition
- Shared selection state between both charts via parent component
- Added SCENARIO_LINE_COLORS with distinct colors per scenario

Stage Summary:
- Two interactive multi-select charts replace 9 individual mini charts
- Users can compare scenarios side-by-side on the same chart
- Hover tooltip provides detailed value comparison

