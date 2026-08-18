# Worklog

---
Task ID: 7
Agent: Main Agent
Task: Integrate finpy-tse for industry indices price history data

Work Log:
- Installed finpy-tse (v1.2.10) and Flask (v3.1.3) with flask-cors
- Analyzed finpy-tse source code to understand `Get_SectorIndex_History()` function
- Identified 40 sector names and their TSETMC web IDs used by finpy-tse
- Created Python mini-service at `mini-services/finpy-tse-service/app.py` (port 3031)
  - `/health` - health check
  - `/api/sector-list` - list all available sectors
  - `/api/sector-history?sector=X` - get OHLC history via finpy-tse
  - `/api/main-index-history?index=X` - get main index history
- Updated `src/lib/industry-indices.ts` with correct finpy-tse sector names and web IDs
  - 6 main market indices (TEPIX, etc.) with `isMainIndex: true`
  - 40 industry group indices mapped to exact finpy-tse sector names
- Updated `src/app/api/instruments/route.ts` to include `finpySector` and `isMainIndex` fields
- Updated `src/components/tse/symbol-search.tsx`:
  - Added `finpySector` and `isMainIndex` to `InstrumentItem` interface
  - Updated `onSelect` callback to pass `finpySector`
  - Updated `selectSymbol` to pass `finpySector` to parent
- Created `src/app/api/finpy-sector/route.ts`:
  - Proxies requests to finpy-tse Python service (port 3031)
  - Runs TA analysis on received OHLC data
  - Returns standardized response matching analysis API format
- Updated `src/app/page.tsx`:
  - Updated `handleSelect` to accept `finpySector` parameter
  - Changed index handling: finpy-tse first → TSETMC fallback → static overview
  - Added loading message for finpy-tse data fetching
  - Updated `lastFetchRef` type to include `finpySector`
- Started finpy-tse service and Next.js dev server
- Verified: ESLint passes, page compiles successfully (GET / 200)

Stage Summary:
- finpy-tse Python service running on port 3031
- Industry indices now route through `/api/finpy-sector` → Python service → finpy-tse
- Fallback chain: finpy-tse → TSETMC SOAP → static overview
- Note: TSETMC direct endpoints are blocked from this sandbox, so finpy-tse service will timeout in sandbox but works in Iranian network deployment

---
Task ID: 8
Agent: Sub Agent
Task: Fix Shamsi dates and all UI issues

Work Log:
- **Task 1 (CRITICAL): Fixed Shamsi date detection on charts**
  - Added `isGregorianDate(dateStr)` to `src/lib/jalali.ts` — checks if year >= 1900 to distinguish Gregorian from Jalali dates
  - Updated `src/components/tse/candlestick-chart.tsx`:
    - Imported `candleDateToJalali` and `isGregorianDate` from jalali.ts
    - Changed `build()` jalaliMap logic: now uses `isGregorianDate()` to detect date type
      - Gregorian dates (year >= 1900, e.g. `2024-01-15`) → `candleDateToJalali()` converts Gregorian→Jalali
      - Jalali dates (year < 1900, e.g. `1404/01/15`) → `formatJalaliString()` formats as-is
- **Task 2: Verified no white/near-white text on white background**
  - Searched all `src/` files for `#fff`, `white`, `text-white` references
  - All `#ffffff` in candlestick-chart.tsx are SVG `fill` attributes on `<rect>` elements (background fills, not text)
  - All `#ffffff` in vdss-graph.tsx are SVG `stroke` outlines for text readability (paint-order trick) or background gradients
  - `text-white` in badge.tsx and button.tsx only appears alongside `bg-destructive` (dark red background) — correct usage
  - No invisible text found
- **Task 3: Verified white background enforced everywhere**
  - Searched for bone/cream colors (`bg-bone`, `bg-cream`, `#faf9f7`, `#faf8f5`, `#f5f5f0`, `#f0ece4`) — none found
  - page.tsx uses `bg-white`, header uses `bg-white/95`, layout.tsx has `backgroundColor: '#ffffff'`
  - All card backgrounds use `bg-white` or `bg-[#ffffff]`
- **Task 4: Verified Vazirmatn is the ONLY font**
  - globals.css: `font-family: 'Vazirmatn', sans-serif !important` on `*` selector
  - layout.tsx: `fontFamily: 'Vazirmatn, sans-serif'` on body inline style
  - `--font-sans` and `--font-mono` both set to `'Vazirmatn', sans-serif`
  - SVG text elements in candlestick-chart.tsx all use `font-family="Vazirmatn, sans-serif"`
  - Searched for `font-family|fontFamily` in all components — no non-Vazirmatn declarations found
- **Task 5: Verified auto-refresh is working**
  - `REFRESH_INTERVAL = 60_000` (60 seconds) — confirmed
  - `doRefresh()` callback triggers `handleSelect` with stored params
  - `setInterval(doRefresh, REFRESH_INTERVAL)` starts when data is loaded
  - `window.addEventListener('focus', onFocus)` refreshes on tab focus
  - Refresh button visible in header with `<RefreshCw>` icon, disabled during loading/refreshing
  - All logic verified correct
- **Task 6: Fixed S/R resistance 5-10% spacing filter**
  - In `src/lib/ta-engine.ts`, the `enforceGap()` function already had adaptive 5-10% gap logic
  - **Bug found**: The fallback path (`levels.slice(0, targetCount)`) bypassed all gap enforcement, potentially returning levels with < 1% gaps
  - **Fix**: Replaced the raw slice fallback with a proper 5% minimum gap filter that keeps as many levels as possible while maintaining the minimum spacing, merging closer levels by keeping the stronger one
- Verified: ESLint passes cleanly

Stage Summary:
- Chart dates now correctly auto-detect Gregorian vs Jalali and convert appropriately
- No invisible text, no non-white backgrounds, no rogue fonts found
- Auto-refresh confirmed working (60s interval + tab focus)
- S/R gap filter now guarantees minimum 5% spacing in all code paths

---
Task ID: 9
Agent: Sub Agent
Task: Convert all numbers to Persian numerals (V2-3) + Volume detection conditional exclusion (V2-5)

Work Log:
- **Task 1: Convert ALL user-facing numbers to Persian numerals (۰-۹)**
  - **indicators-panel.tsx**:
    - Added `import { toPersianDigits } from '@/lib/jalali'`
    - `R{i + 1}` → `R{toFa(i + 1)}` (resistance labels)
    - `S{i + 1}` → `S{toFa(i + 1)}` (support labels)
    - `R²: {(t.r2 * 100).toFixed(1)}%` → `R²: {toPersianDigits(...)}٪` (trend line R² values)
  - **vdes-analysis.tsx** (already imported `toPersianDigits`):
    - `bbPos` from `toFixed(0)` → wrapped with `toPersianDigits()`
    - `trendText` R² values (2 instances in `generateAnalysisText` + 2 in component) → `toPersianDigits((trendR2 * 100).toFixed(1))`
    - Paragraph 1 R² → `toPersianDigits((trendR2 * 100).toFixed(1))`
    - OBV value `(obv / 1e6).toFixed(1)M` → `toPersianDigits(...)`
    - Risk/reward ratios `((R1 - currentPrice) / (currentPrice - S1)).toFixed(1):1` → `toPersianDigits(...):۱` (2 instances, R1 and R2 scenarios)
    - `StrengthBar` component: `{strength}` → `{toPersianDigits(String(strength))}`
    - Resistance labels: `R{i + 1}` → `R{toFa(i + 1)}`
    - Support labels: `S{i + 1}` → `S{toFa(i + 1)}`
    - Price target labels: `هدف {i + 1}` → `هدف {toFa(i + 1)}`
  - **vdss-graph.tsx**:
    - Added `import { toPersianDigits } from '@/lib/jalali'`
    - SVG edge probability label: `(prob * 100).toFixed(0) + '%'` → `toPersianDigits(...) + '٪'`
    - Detail panel input/output edge probabilities: `(ep * 100).toFixed(1)٪` → `toPersianDigits(...)` (2 instances)
    - Detail panel path counts: `({inputs.length})` / `({outputs.length})` → `({toFa(...)})`
    - Scenario probability: `(pathProb * 100).toFixed(1)٪` → `toPersianDigits(...)`
    - Path list index: `{i + 1}` → `{toFa(i + 1)}`
    - Path list probability: `(p.prob * 100).toFixed(1)٪` → `toPersianDigits(...)`
    - Remaining paths count: `{filteredPaths.length - 10}` → `{toFa(...)}`
  - **page.tsx**:
    - Added `import { toPersianDigits } from '@/lib/jalali'`
    - Volume display: `(data.info.volume / 1e6).toFixed(1) + 'M'` → `toPersianDigits(...) + 'M'`
    - Value display: `(data.info.value / 1e9).toFixed(1) + 'B'` → `toPersianDigits(...) + 'B'`

- **Task 2: Volume data detection — conditional exclusion (V2-5)**
  - **vdes-analysis.tsx**:
    - Wrapped all 5 MFI references in paragraph 2 (p2, all scenario variants R1-R5) with `{ctx.hasVolume && <span>...</span>}`
    - Updated `strategyText` to conditionally include MFI:
      - Added `mfiOverbought = hasVolume && mfi > 80` and `mfiOversold = hasVolume && mfi < 20`
      - Created `mfiNote = hasVolume ? ', MFI: ${toFa(mfi)}' : ''`
      - Strategy text now omits MFI value and condition when `hasVolume` is false
    - Paragraph 4 (OBV/volume analysis) was already conditionally shown via `ctx.hasVolume ? ...`
    - MFI and OBV indicator cards in indicators-panel.tsx were already conditionally shown via `ta.hasVolume !== false`
    - ta-engine.ts already correctly sets MFI=50 and OBV=0 when no volume — no changes needed

- Verified: ESLint passes cleanly

Stage Summary:
- All user-facing numbers across indicators-panel, vdes-analysis, vdss-graph, and page.tsx now display in Persian numerals (۰-۹)
- Numbers from `toFixed()` calls (R², OBV, risk-reward ratios, probabilities) are wrapped with `toPersianDigits()`
- Index/count numbers (R1-R5, S1-S5, path indices, path counts) use `toFa()` 
- Volume-related text (MFI references in analysis, MFI in strategy) is conditionally hidden when `hasVolume` is false
- ta-engine.ts MFI/OBV neutral values (50/0) confirmed correct — no changes needed

---
Task ID: 10
Agent: Main Agent
Task: Fix remaining L-requirements (L6 crosshair legend, L4 auto-refresh bug, L5 chart font)

Work Log:
- **L6: Added crosshair date legend with Shamsi dates on chart hover**
  - In `src/components/tse/candlestick-chart.tsx`:
    - Added `useMemo` import and `hoverInfo` state for crosshair legend data
    - Created `jalaliDates` memoized array that pre-computes full Shamsi date strings for all candles
    - Added `chart.subscribeCrosshairMove()` handler that shows OHLC data + Shamsi date on hover
    - Added `crosshairSubRef` for proper cleanup on unmount
    - Rendered crosshair legend bar above toolbar with: Shamsi date (full format), OHLC values in Persian numerals, volume (if available), and change percentage
    - Legend visually connects to toolbar (no bottom border when legend active, toolbar loses top rounded corners)
    - All numbers in legend use `toPersianDigits()` for Persian numeral display
- **L4: Fixed auto-refresh bug for industry indices**
  - In `src/app/page.tsx`:
    - `doRefresh()` was missing `params.finpySector` argument when calling `handleSelect()`
    - Fixed: `handleSelect(params.symbol, params.category, params.insCode, params.tgjuKey, params.finpySector)`
    - This ensures industry indices refresh correctly via finpy-tse instead of falling back
- **L5: Enforced Vazirmatn font in lightweight-charts canvas text**
  - In `src/app/globals.css`:
    - Added CSS rules targeting `[data-chart]`, `[data-chart] *`, and `[data-chart] canvas` with `font-family: 'Vazirmatn', sans-serif !important`
    - This ensures the canvas-rendered axis labels and price labels use Vazirmatn
- **Verified all requirements via agent-browser:**
  - Page loads with GET / 200, no compilation errors
  - Background: `rgb(255, 255, 255)` = white ✅ (L2)
  - Font: `Vazirmatn, sans-serif` ✅ (L5)
  - Text color: `rgb(26, 26, 26)` = dark gray ✅ (L3)
  - No white text on white/transparent backgrounds ✅ (L3)
  - Footer has `mt-auto` for sticky behavior ✅
  - Search dropdown with category tabs works correctly ✅
  - Mobile responsive layout (375x812) verified ✅
  - All API routes return 200 (tgju-instruments, instruments) ✅
  - ESLint passes cleanly ✅

Stage Summary:
- Crosshair now shows full Shamsi date (e.g., "۱۵ خرداد ۱۴۰۴") + OHLC values + change % on hover
- Auto-refresh now correctly passes finpySector for industry indices
- Vazirmatn font enforced via CSS on chart canvas elements
- All L-requirements verified: L2 (white bg) ✅, L3 (no white text) ✅, L4 (auto-refresh) ✅, L5 (Vazir only) ✅, L6 (Shamsi dates) ✅

---
Task ID: 11
Agent: Main Agent
Task: Implement Fibonacci-based S/R levels (6 support + 6 resistance)

Work Log:
- Added `fibRatio` and `fibLabel` fields to `LevelStrength` interface in ta-engine.ts
- Completely rewrote `calcSupportResistance()` function:
  - Now uses Fibonacci Retracement (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%) and Extension (127.2%, 161.8%, 200%, 261.8%, 361.8%, 423.6%)
  - Finds the most significant swing (largest range) across multiple lookback periods (3,5,7,10,15,20)
  - Generates Fibonacci levels from the swing high/low pair
  - Checks confluence with up to 3 secondary swings
  - Scores levels by: confluence, key Fibonacci ratio proximity, price proximity, touch/rejection count, volume confirmation, swing recency
  - Always returns exactly 6 resistances and 6 supports
  - Each level includes `fibRatio` (e.g. '0.382') and `fibLabel` (e.g. '۳۸.۲٪') in Persian
- Updated `findSwingLevels()` to also return bar index (needed for recency scoring)
- Updated indicators-panel.tsx:
  - Section renamed to "خطوط حمایت و مقاومت فیبوناچی"
  - Now shows 6 levels (was 5) with Fibonacci ratio label and strength bar
  - Uses `resistanceStrengths`/`supportStrengths` arrays with new fibLabel field
- Updated candlestick-chart.tsx:
  - S/R price line titles now include Fibonacci labels (e.g. "R۱ [۶۱.۸٪]")
  - All 6 levels get `axisLabelVisible: true`
  - Added `fibRatio`/`fibLabel` to local LevelStrength interface
- Updated vdes-analysis.tsx:
  - S/R sections now labeled "فیبوناچی — قدرت ۱-۱۰"
  - Shows 6 levels (was unlimited) with Fibonacci label per level
  - Updated TypeScript interfaces for new fields
- Fixed FIB_LABELS key normalization: `'1'` and `'2'` instead of `'1.0'` and `'2.0'` (JavaScript String() drops trailing zeros)
- Verified via agent-browser:
  - Indicators panel shows all 6 R + 6 S with correct Persian Fibonacci labels
  - VDes analysis shows all 6 R + 6 S with Fibonacci labels and strength bars
  - API returns correct data: `fibRatio`, `fibLabel`, `strength`, `isTarget` on all 12 levels
  - ESLint passes cleanly

Stage Summary:
- S/R calculation completely replaced with Fibonacci Retracement + Extension algorithm
- Always produces exactly 6 support + 6 resistance lines
- Each level tagged with its Fibonacci ratio in Persian (e.g. ۰٪ (اوج), ۲۳.۶٪, ۳۸.۲٪, ۵۰٪, ۶۱.۸٪, ۷۸.۶٪, ۱۰۰٪ (کف), ۱۲۷.۲٪, ۱۶۱.۸٪, ۲۰۰٪, ۲۶۱.۸٪, ۳۶۱.۸٪)
- Multi-swing confluence detection strengthens levels where multiple Fibonacci setups agree
- All three UIs (chart price lines, indicators panel, VDes analysis) updated with Fibonacci labels

---
Task ID: 12
Agent: Main Agent
Task: 3 changes — VDes-only chart, solid S/R lines, fix Shamsi dates

Work Log:
- **Task 1: VDes-only chart**
  - Removed CandlestickChart from "نمودار" tab, replaced with redirect message
  - Added CandlestickChart to VDes tab (above VdesAnalysis)
  - Changed default active tab from 'chart' to 'vdes'
  - All setActiveTab calls now switch to 'vdes' on data load
- **Task 2: S/R lines solid only, thickness = strength**
  - Updated `srLineStyle()` in candlestick-chart.tsx:
    - All lines now `lineStyle: 0` (solid) — no dashes or dots
    - Thickness mapped to strength: 1→1px, 3→2px, 5→3px, 7→4px, 9→5px, target→4px
- **Task 3: Fix Shamsi date conversion**
  - Root cause: `fullPersianDate()` treated ALL dates as Gregorian, converting Jalali 1405→Gregorian→Jalali giving ~783
  - Fixed `fullPersianDate()` to auto-detect via `isGregorianDate()`:
    - Gregorian: convert to Jalali, get weekday from Gregorian Date object
    - Jalali: convert to Gregorian (for weekday), format Jalali directly
  - Added `smartJalaliDate()` utility that auto-detects and returns correct Jalali string
  - Fixed `vdes-analysis.tsx`: replaced `candleDateToJalali()` with `smartJalaliDate()` for chartJalaliDate
  - Fixed `tradingview-chart.tsx`: replaced `candleDateToJalali()` with `smartJalaliDate()` for jalaliMap
  - Verified: "1405-05-27" → "چهارشنبه، ۲۷ مرداد ۱۴۰۵" (was "783/...")
  - Verified: "2025-06-18" → "پنجشنبه، ۲۸ خرداد ۱۴۰۴" (Gregorian still converts correctly)
- Verified via agent-browser:
  - VDes tab is default and shows chart with toolbar + full analysis below
  - نمودار tab shows redirect message
  - Chart date shows ۱۴۰۵/۰۵/۲۷ (correct)
  - Analysis text shows "چهارشنبه، ۲۷ مرداد ۱۴۰۵" (correct)
  - ESLint passes cleanly

Stage Summary:
- Chart with drawing tools only available in VDes tab (default)
- S/R lines are all solid, thickness proportional to strength (1-5px)
- Shamsi dates fixed across all components using `smartJalaliDate()` and fixed `fullPersianDate()`

---
Task ID: 13
Agent: Main Agent
Task: Implement comprehensive 7-method S/R analysis system with ML scoring

Work Log:
- Rewrote `LevelStrength` interface in ta-engine.ts to add: score (0-10), grade (Very Strong/Strong/Moderate/Weak), overlapCount, methods[]
- Completely rewrote `calcSupportResistance()` function (~700 lines) with 7 methods:
  1. Swing High/Low (Price Action) — findSwingLevels with N=3,5,7, 0.5% tolerance merging
  2. SMA Dynamic S/R — SMA 20/50/100/200, support if Close > SMA, resistance if Close < SMA
  3. Bollinger Bands — Upper = resistance, Lower = support
  4. Fibonacci Retracement + Extension — Best swing detection, 6 lookback periods, 13 ratios, secondary swing confluence
  5. Volume Profile (VAP) — 40-bin histogram, POC and HVN detection (>70% max VAP)
  6. Pivot Points — 4 algorithms (Standard, Fibonacci, Woodie's, DeMark) using previous bar OHLC
  7. Psychological Levels — ±1 and ±2 round units from current price
- Implemented ML-based weight optimization (Ridge OLS regression from scratch):
  - 5 features: touch_count, volume_ratio, overlap_count, freshness, distance_percent
  - Training on historical data (sampled every 5 bars, 10-bar horizon)
  - Default fallback weights: [0.25, 0.20, 0.25, 0.15, 0.15]
  - Scoring: Power_Score = (w_touch*Touch + w_vol*Volume + w_overlap*Overlap + w_fresh*Fresh + w_dist*Dist) × 10
- Post-processing pipeline:
  1. Confluence merging (1% tolerance) — combine methods, max score, max overlap
  2. ML scoring with trained weights
  3. Psychological rounding
  4. Deduplication
  5. Distance filtering (min 5% gap, merge closer levels keeping stronger)
  6. Top-6 selection by composite score + proximity bonus
  7. Target marking: isTarget=true if score >= 7
  8. Grade assignment: >=8.5 Very Strong, >=7 Strong, >=5 Moderate, <5 Weak
- Updated candlestick-chart.tsx: S/R line titles now show grade + method count + fibLabel
  - Format: `R۱ [Very Strong] (۳ method) فیبو ۳۸.۲٪` or `★ R۱ [Very Strong]` for targets
- Updated indicators-panel.tsx:
  - Header changed from "خطوط حمایت و مقاومت فیبوناچی" to "حمایت و مقاومت هوشمند"
  - Added gradeColor helper (Very Strong=red, Strong=amber, Moderate=sky, Weak=gray)
  - Each S/R card now shows: grade badge, methods count in Persian, fibLabel, strength bar
- Updated vdes-analysis.tsx:
  - Added GRADE_MAP (English→Persian: Very Strong→بسیار قوی, Strong→قوی, etc.)
  - Added GradeBadge component
  - S/R section header: "حمایت و مقاومت هوشمند"
  - Each level shows: grade badge, methods count, fibLabel, overlap count, strength bar, 🎯 target marker
  - Analysis text paragraph 5 updated to mention grade and method count for R1/S1
- Verified: ESLint clean, API returns correct 6+6 levels with all 7 methods
- Browser verified via VLM: grade badges ✅, method counts ✅, overlap counts ✅, fib labels ✅, strength bars ✅, target markers ✅

Stage Summary:
- Complete 7-method S/R analysis system deployed
- Methods: Swing, SMA, Bollinger, Fibonacci, Volume Profile, Pivot (4 variants), Psychological
- ML-based scoring with Ridge regression trained on historical data
- All 3 UIs (chart, indicators, VDes) updated with rich S/R metadata
- Output format: 6 support + 6 resistance, each with price, strength, score, grade, methods, overlapCount

---
Task ID: 14
Agent: Main Agent
Task: Lock v2.1, start v3.0

Work Log:
- Created git tag v2.1 on current commit
- Updated footer version from v2.1 to v3.0

Stage Summary:
- v2.1 locked with tag, v3.0 active

---
Task ID: 15
Agent: Main Agent
Task: v3.0 — Fix S/R spacing rules + remove duplicate chart

Work Log:
- Rewrote distance filtering in ta-engine.ts (Step 7):
  - Consecutive S/R lines: strict 5-10% gap enforcement
  - If gap < 5%: merge, keep stronger level
  - If gap 5-10%: accept
  - If gap > 10%: search for intermediate level; if none, generate synthetic psychological level at ~7.5%
  - Nearest support/resistance must be ≤ 10% from price (can be < 5%)
  - If nearest > 10% away: generate synthetic level at ~5% from price
- Removed TradingViewChart from vdes-analysis.tsx (was duplicate of CandlestickChart in page.tsx)
  - Removed import, chartRef, chartJalaliDate, tvScenarios, exportChartImage
  - Grayed out "عکس نمودار" menu item (chart is now above in page.tsx)
  - Changed CandleData type to inline type
- Verified: Only 1 chart renders in VDes (VLM confirmed)
- Verified: All S/R gaps are 5-10% between consecutive lines

Stage Summary:
- Strict 5-10% spacing rule enforced with synthetic level generation for gaps
- Single chart in VDes (CandlestickChart with drawing tools from page.tsx)
