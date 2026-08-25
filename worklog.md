# VDSS Worklog

---
Task ID: 1
Agent: Main
Task: Fix 502 Bad Gateway and 403 errors on page load, fix index data fetching

Work Log:
- Diagnosed 502 error: all services (Next.js:3000, finpy-tse-index:3031, ML:3032) were down after sandbox restart
- Diagnosed 403 errors: caused by services being unavailable, not actual permission issues
- Killed orphaned `next-server` processes (PPID=1) left from previous `npx next dev` invocations that interfered with port 3000
- Killed agent-browser Chrome processes consuming ~1.2GB memory causing OOM kills
- **Critical bug fix**: Removed `XTransformPort=3031` from `tsetmc-index-api.ts` - was appended to URLs that already had query params, creating invalid double-`?` URLs that crashed the Next.js standalone server
- Also removed XTransformPort from health check URL (line 69)
- Rebuilt Next.js with `npx next build` after fix
- **Created daemonized supervisor** (`supervisor.py`): uses double-fork technique to persist across bash tool invocations, monitors all 3 services every 15s with auto-restart
- Updated `start-dev.sh` to use daemonized supervisor
- Verified all index data is correct: دارویی 4269 candles (last: 713,348), بانک 4268 candles (last: 34,630), etc.
- Tested 6 indices (CWI, EWI, ACT50, دارویی, بانک, فلزات اساسی) - all return 200 with TA analysis in ~0.1s

Stage Summary:
- 502/403 errors: RESOLVED (services were down, now auto-restarted by daemon)
- XTransformPort bug: FIXED (was causing invalid URLs for sector requests)
- Service persistence: SOLVED (daemonized supervisor with double-fork)
- Index data fetching: WORKING (10 main indices + 39 sector indices, all via TSETMC CDN B2 API proxied through z-ai page_reader)

---
Task ID: 2
Agent: Main
Task: Fix ta-engine cumulative return percentile, RSI/ADX/MACD overbought-oversold thresholds, and Stochastic calculation

Work Log:
- Fixed `cumulativeReturn` percentile calculation: the percentile was inverted (returning 1-pct instead of pct for positive returns)
- Changed threshold logic: `if (pct >= threshold)` → `if (pct < threshold)` for buy signals and vice versa for sell
- Fixed RSI thresholds: overbought from 65→70, oversold from 35→30
- Fixed ADX thresholds: strong trend from 20→25, weak trend from 15→10
- Added MACD histogram threshold check (|hist| > 0)
- Fixed Stochastic: added smoothing with SMA-3, added overbought/oversold thresholds
- Added crossovers detection for MACD and Stochastic
- Updated cumulative return to use compound returns: `cumReturn *= (1 + dailyReturn)` instead of simple sum
- Lint: clean (no errors)

Stage Summary:
- Cumulative return percentile: FIXED (was inverted)
- RSI/ADX/MACD thresholds: UPDATED to standard values
- Stochastic calculation: FIXED with SMA-3 smoothing + crossover detection
- All changes in ta-engine.ts

---
Task ID: 3
Agent: Main
Task: Add volume analysis to ta-engine: OBV, MFI, and volume-price confirmation

Work Log:
- Added `calcOBV()` function: On-Balance Volume with trend determination
- Added `calcMFI()` function: Money Flow Index with overbought/oversold thresholds
- Added volume analysis section to `analyze()` output
- Integrated into main analysis pipeline
- OBV signals: divergence detection, trend confirmation
- MFI: 80/20 thresholds for overbought/oversold
- Lint: clean

Stage Summary:
- OBV and MFI: ADDED to ta-engine.ts
- Volume analysis now included in daily analysis output
- Next: frontend integration for volume data display

---
Task ID: 4
Agent: Main
Task: Add Bollinger Bands and Parabolic SAR to ta-engine

Work Log:
- Added `calcBollingerBands()`: 20-period SMA with 2-standard deviation bands
- Added `calcParabolicSAR()`: AF=0.02, max AF=0.2, reversal-based
- Integrated into main analysis pipeline
- Added BB width (volatility proxy) and position (% within bands)
- BB signals: squeeze detection, breakout confirmation
- SAR signals: trend direction, reversal detection
- Lint: clean

Stage Summary:
- Bollinger Bands and Parabolic SAR: ADDED to ta-engine.ts
- All 4 components (upper, lower, bandwidth, position) included
- Next: frontend charting integration

---
Task ID: 5-a
Agent: Sub-agent (general-purpose)
Task: Integrate MSL auto-selection system into AI analysis API route

Work Log:
- Read and analyzed `/src/app/api/ai-analysis/route.ts` (existing route handler with ML selector)
- Read and analyzed `/src/lib/msl-selector.ts` (MSL scoring engine: 6 schools, 5 styles, 6 tones)
- Added import: `selectMSL`, `MSLContext`, `MSLResult` from `@/lib/msl-selector`
- Created `buildMSLContext(body)` helper function that derives MSLContext from request body:
  - Maps indicator values (RSI, MACD, ADX, CCI, MFI, ATR, StochK/D, DI+/DI-, SAR, BB width)
  - Derives `trendStrength` from trendR2 + ADX thresholds
  - Derives `dominantDirection` from trendDirection (up→bullish, down→bearish, range→neutral)
  - Derives `volatilityLevel` from ATR/price ratio (high>3%, medium>1%, low)
  - Derives `overallConfidence` from trendR2 blended with v11 cumulative probabilities
  - Derives `srLevelStrength` from resistance/support strength values
  - Defaults pattern-related fields (classic/harmonic/elliott counts, divergences) to 0
- Modified POST handler to call MSL after base ML selection:
  - `const mslResult = selectMSL(mslCtx)` overrides `mlSelection.school/style/tone`
  - Uses `as typeof mlSelection.school` type assertion for TypeScript compatibility
  - Updates `mlSelection.reasoning` with MSL score details
  - Enhanced console.log to show English MSL names with scores
- Added MSL scores section to AI prompt (Persian):
  - **مکتب تحلیل انتخاب‌شده:** school name (score امتیاز)
  - **سبک تحلیل:** style name (score امتیاز)
  - **لحن تحلیلی:** tone name (score امتیاز)
- Modified `buildPrompt` signature to accept optional `MSLResult` parameter
- Fixed template literal syntax issue (extra backtick causing parse error)
- All existing functionality preserved: cache, rate limiter, ML selector base, methods, queue, retry
- Lint: clean (eslint exit code 0)

Stage Summary:
- MSL auto-selection: INTEGRATED into ai-analysis route
- MSL overrides ML selector's school/style/tone with scoring-based selection
- MSL scores visible in AI prompt for transparency
- Response metadata includes MSL reasoning with scores
- File: `/src/app/api/ai-analysis/route.ts` (479 lines)

---
Task ID: 3-a
Agent: Sub-agent (general-purpose)
Task: Implement 30-Day Cumulative Probability Trend Calculator

Work Log:
- Created `/src/lib/probability-trend.ts` (~130 lines) implementing dual-exponential decay probability trend model
- Defined 9 scenario keys (R1-R9) with Persian labels and bearish/neutral/bullish group assignments
- Exported TypeScript interfaces: `DayPoint`, `ScenarioTrend`, `GroupTrend`, `ProbabilityTrendResult`, `TrendDirection`
- Implemented `decayFactor(h)` with α=0.7, τ₁=5, τ₂=20 dual exponential decay
- Implemented `buildNormalizedDecay(horizon)` that normalizes decay factors to sum=1
- `calculateProbabilityTrend(scenarioProbabilities, horizon=30)`: pure function returning per-scenario trends (individual + cumulative) and group cumulative trends
- `getTrendInterpretation(results)`: Persian-language interpretation with dominant direction, peak concentration, early vs late risk, actionable insight
- Fixed literal `\n` encoding issue in source file (backslash-n vs newline)
- Verified: `npx tsc --noEmit` passes clean (zero errors)
- Verified: runtime test with sample probabilities produces correct cumulative sums (bearish 0.40, bullish 0.35 matches manual sum)

Stage Summary:
- 30-day probability trend calculator: CREATED at `/src/lib/probability-trend.ts`
- All exports: `SCENARIO_KEYS`, `SCENARIO_META`, `calculateProbabilityTrend`, `getTrendInterpretation`, plus all interfaces
- Pure function, no side effects, no external dependencies
- Ready for integration with decision graph or frontend charting

---
Task ID: 3-b
Agent: Sub-agent (general-purpose)
Task: Implement MSL (Methodology/Style/Language) System

Work Log:
- Created `/src/lib/msl-system.ts` (184 lines, well under 300-line limit)
- Defined `SchoolId` type: 6 schools (classical, quantitative, behavioral, harmonic, elliott, multitimeframe)
- Defined `StyleId` type: 10 styles (conservative, scalper, trend-follower, pessimistic, pragmatic, decision-oriented, volume-analyst, pattern-analyst, psychological, volatility-analyst)
- Defined `ToneId` type: 15 tones (formal, quick, philosophical, warning, narrative, step-by-step, skeptical, optimistic, simple, number-focused, multi-layered, educational, emotional, deep-analytical, exciting)
- Exported `School`, `Style`, `Tone` interfaces with id, name (Persian), nameEn (English), prompt fields
- Exported `MSLConfig` interface = { school: SchoolId, style: StyleId, tone: ToneId }
- Exported `MarketContext` interface with trend, volatility, dominantScenario, instrumentType, volumeTrend
- Populated `SCHOOLS` (6), `STYLES` (10), `TONES` (15) arrays with Persian names, English names, and Persian prompt instructions
- Implemented `getSchoolPrompt(config)` / `getStylePrompt(config)` / `getTonePrompt(config)` — each returns formatted Persian system-prompt section
- Implemented `selectMSL(ctx: MarketContext)` — rule-based dynamic selection:
  - School: instrument-driven (crypto→quantitative, gold/forex→multitimeframe, stock→classical) with scenario overrides (harmonic, elliott, sentiment)
  - Style: trend+volatility-driven (uptrend+low→trend-follower, downtrend→conservative, high-vol→volatility-analyst, range→pattern-analyst) with scenario overrides
  - Tone: trend+volatility-driven (uptrend→optimistic, downtrend→warning, high-vol→quick, range→deep-analytical) with scenario overrides
- Implemented `getAllCombinations()` — returns all 6×10×15 = 900 valid MSLConfig combinations
- Pure TypeScript, zero React/Next.js imports
- Verified: `npx tsc --noEmit src/lib/msl-system.ts` passes clean (zero errors)

Stage Summary:
- MSL system: CREATED at `/src/lib/msl-system.ts` (184 lines)
- All 8 exports: School/Style/Tone types, MSLConfig, MarketContext, selectMSL, getSchoolPrompt, getStylePrompt, getTonePrompt, getAllCombinations, plus SCHOOLS/STYLES/TONES data arrays
- Complements existing `msl-selector.ts` (indicator-based scoring) with a simpler rule-based alternative
- Ready for integration into AI analysis pipeline

---
Task ID: 3-c
Agent: Sub-agent (general-purpose)
Task: Integrate Probability Trend + MSL into the Analysis Pipeline

Work Log:
- **Part 1 — Decision Graph + Probability Trend:**
  - Added import of `calculateProbabilityTrend` (aliased as `calcTrendFromProbs`) and `ProbabilityTrendResult` (aliased as `ProbTrendResult`) from `./probability-trend` to `decision-graph.ts`
  - Added optional `probabilityTrend?: ProbTrendResult` field to the `GraphData` interface (exported)
  - In `buildDecisionGraph`, after computing `finalPcts`, converts to fractions (÷100) and calls `calcTrendFromProbs` to compute the 30-day trend
  - The trend is now included in the returned `GraphData` object

- **Part 2 — AI Analysis Route + MSL System:**
  - Replaced `msl-selector` import with `msl-system` import: `selectMSL` (aliased as `selectMSLSystem`), `getSchoolPrompt`, `getStylePrompt`, `getTonePrompt`, `MSLConfig`, `MarketContext`
  - Replaced `buildMSLContext` (indicator-based scoring context) with `buildMarketContext` (rule-based market context deriving trend/volatility/dominantScenario/instrumentType/volumeTrend from request body)
  - Updated POST handler: calls `selectMSLSystem(marketCtx)` to get `MSLConfig`, overrides mlSelection school/style/tone, generates `mslSystemPrompt` via prompt generators
  - MSL prompts injected into both system prompt (`dynamicSystemPrompt = SYSTEM_PROMPT + mslSystemPrompt`) and user message (via `buildPrompt`)
  - Fixed 9 broken template literal references (`schoolScoresslResult` → `schoolScores[mslResult`) that were caused by encoding corruption
  - Updated `buildPrompt` signature from `mslResult?: MSLResult` to `mslConfig?: MSLConfig`
  - v11 probabilities section preserved as-is

- **Part 3 — Main Analysis API + Probability Trend:**
  - Added import of `calculateProbabilityTrend` from `@/lib/probability-trend` to `analysis/route.ts`
  - After `analyze(ohlcv)`, converts `ta.scenarioSums` to fractions and calls `calculateProbabilityTrend`
  - Added `probabilityTrend` to both the TSETMC index response and the regular instrument response

- Lint: clean (eslint exit code 0)
- tsc: no new errors introduced (pre-existing errors in ta-engine.ts and tse-api.ts unrelated to changes)

Stage Summary:
- Probability trend: INTEGRATED into decision graph output AND main analysis API response
- MSL system: INTEGRATED into AI analysis route (replaces msl-selector scoring-based approach with msl-system rule-based approach + prompt generators)
- Files modified: `src/lib/decision-graph.ts`, `src/app/api/ai-analysis/route.ts`, `src/app/api/analysis/route.ts`

---
Task ID: 3-d
Agent: Sub-agent (general-purpose)
Task: Add 30-Day Probability Trend Chart to VDSS Graph Component

Work Log:
- Added `probabilityTrend` optional prop to `VdssGraphProps` interface (type: `ProbabilityTrendResult | null`)
- Imported `ProbabilityTrendResult` and `DayPoint` types from `@/lib/probability-trend`
- Imported `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` from `@/components/ui/collapsible`
- Imported `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from `@/components/ui/table`
- Created `ProbabilityTrendTable` sub-component (~190 lines) with:
  - Collapsible header with Persian title "روند ۳۰ روزه احتمالات" (default expanded)
  - 9 scenario rows (R1-R9) showing individual + cumulative probabilities for Days 1, 5, 10, 20, 30
  - Color coding: red for bearish (R1-R4), gray for neutral (R5), green for bullish (R6-R9)
  - Peak day highlighting per scenario (bold text + colored background)
  - Group trend summary row with mini bar showing bullish ratio per day
  - Group detail rows (bearish/neutral/bullish) with cumulative probabilities
  - Persian sub-headers: "اختصاصی", "تجمعی", "روز"
  - Explanatory note at bottom in Persian
- Rendered `ProbabilityTrendTable` below the scenario result cards in the main VdssGraph component
- Updated `page.tsx` to pass `probabilityTrend={data.ta.decisionGraph?.probabilityTrend}` to VdssGraph
- Fixed `getDay` helper type from `{ day: number }[]` to `DayPoint[]` to resolve TS2339 errors
- Lint: clean (eslint exit code 0)
- TypeScript: no new errors (1 pre-existing error at line 440 unrelated to changes)

Stage Summary:
- 30-day probability trend table: ADDED to VDSS graph panel
- Files modified: `src/components/tse/vdss-graph.tsx`, `src/app/page.tsx`
- Visual: collapsible table with color-coded rows, peak highlighting, group trend bars
- All Persian labels, consistent with existing light card theme
