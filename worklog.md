---
Task ID: 1
Agent: main
Task: S/R line gap: enforce 5-10% between consecutive resistance AND support lines

Work Log:
- Modified enforceGap() in ta-engine.ts: removed gap steps below 5% (0.045, 0.04, 0.035, 0.03)
- Kept gap steps [0.10, 0.09, 0.08, 0.07, 0.06, 0.05]
- Same function applies to both supports and resistances

Stage Summary:
- Both support and resistance lines now have strictly 5-10% minimum gap

---
Task ID: 2
Agent: main
Task: White background throughout the project

Work Log:
- Changed layout.tsx: removed dark class, set white bg and dark text
- Changed page.tsx: bg-[#F5F0E8] → bg-white, bg-[#FFFCF8] → bg-white
- Changed candlestick-chart.tsx: BG='#FFFCF8' → '#ffffff', grid to rgba(0,0,0,0.06)
- Changed globals.css: removed dark mode, set white background
- Dispatched subagents to fix indicators-panel, vdes-analysis, vdss-graph, symbol-search, tradingview-chart
- All bone colors (#F5F0E8, #FFFCF8, #E5DFD6, #8A837B, #2D2A26, #5C5650, #EDE8DD) replaced with gray-scale equivalents

Stage Summary:
- Pure white background everywhere, no bone/off-white colors remain

---
Task ID: 3
Agent: main
Task: Fix font colors - no white/near-white text on white bg

Work Log:
- Removed text-gray-100 from layout.tsx (was near-white text)
- Changed SAR line color from rgba(255,255,255,0.35) to rgba(217,119,6,0.7) (amber, visible on white)
- Changed chart textColor from #5C5650 to #374151 (darker gray)
- All text colors verified: gray-900, gray-700, gray-500, gray-900, emerald-700, red-700, amber-700

Stage Summary:
- No white or near-white text colors exist anywhere in the project

---
Task ID: 4
Agent: main
Task: Auto-refresh charts every 60 seconds + on tab focus

Work Log:
- Added useRef to store last fetch params (symbol, category, insCode, tgjuKey)
- Added setInterval(60s) auto-refresh when data is loaded
- Added window 'focus' event listener for refresh on tab switch
- Added manual refresh button with spinning animation in header
- Added refreshing state to prevent concurrent refreshes

Stage Summary:
- Charts auto-refresh every 60 seconds and on browser tab focus
- Manual refresh button available in header

---
Task ID: 5
Agent: main
Task: Vazir font only throughout the project

Work Log:
- Downloaded Vazirmatn woff2 fonts (Regular, Light, Medium, SemiBold, Bold) to public/fonts/
- Added @font-face declarations in globals.css for all 5 weights
- Updated layout.tsx: removed Geist font imports, set font-family: Vazirmatn, sans-serif
- Added !important font-family rule in globals.css base layer
- Updated SVG drawing text elements to use 'Vazirmatn, sans-serif'
- Updated vdes-analysis HTML export to use Vazirmatn font

Stage Summary:
- Vazirmatn is the ONLY font used in the entire project

---
Task ID: 6
Agent: main
Task: Fix Shamsi dates on charts (double-conversion bug)

Work Log:
- CRITICAL BUG FOUND: TSETMC dates (DEven format like 14040115) are ALREADY Shamsi/Jalali
- TGJU dates (row[7]) are also already Shamsi/Jalali
- The old candleDateToJalali() was treating these as Gregorian and double-converting
- Added new formatJalaliString() function in jalali.ts that formats already-Jalali dates
- Updated candlestick-chart.tsx to use formatJalaliString() instead of candleDateToJalali()
- Updated buildJalaliTimeMap() to use formatJalaliString()
- Preserved candleDateToJalali() for any future Gregorian→Jalali conversion needs

Stage Summary:
- Shamsi dates now display correctly: 1404/03/28 → ۱۴۰۴/۰۳/۲۸ (no double conversion)
