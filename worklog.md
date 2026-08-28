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

---
Task ID: 5
Agent: main
Task: Fix chart-table consistency + dynamic Y-axis, fix decision graph numbers

Work Log:
- Analyzed data flow: boxes show decisionGraph.scenarioProbabilities (clamped/re-normalized), charts/tables show probabilityTrend (raw historical)
- Added correctedTrend useMemo in VdssGraph that overrides day 1 values of probabilityTrend with final scenario probabilities from props
- Recalculated CDF for day 1 using calculateCDF() to ensure cumulative probabilities are consistent
- Passed correctedTrend to CumulativeProbabilityChart, PerScenarioTrendCharts, and ProbabilityTrendTable
- Replaced fixed 0-100% Y-axis grid with dynamic grid: computes min/max from selected scenarios, finds nice step intervals (0.01-1.0), rounds boundaries to step multiples
- Created nodeDisplayValues useMemo that computes meaningful values for each node type
- ROOT node: no percentage (always 100%, obvious)
- Main branches (N_TREND/N_BREAK/N_REVERSAL): show absolute probability with Persian digits (e.g., ۶۰٪)
- Sub-branches (N_T_BULL, etc.): show conditional probability within parent branch with Persian digits
- Event/assessment nodes (Layer 3): no percentage displayed (they represent conditions, not probability outcomes)
- Terminal nodes (R1-R9): removed duplicate nodeValue text below the big probability badge
- Removed nodeValues variable and all references to it
- Cleaned up detail panel: removed raw nodeValues display, uses node description instead

Stage Summary:
- Charts/tables/boxes now show identical values for day 1 (today)
- Y-axis dynamically scales to selected scenarios' range for better visualization
- Decision graph no longer shows confusing accumulated probabilities on event/assessment nodes
- All visible numbers use Persian digits (۶۰٪ instead of 60%)
- Verified via agent browser: ROOT clean, branches show ۶۰٪/۳۴٪/۶٪, event nodes have no numbers
