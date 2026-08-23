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
- Key insight: finpy-tse library internally uses the same TSETMC CDN B2 API (`cdn.tsetmc.com/api/Index/GetIndexB2History/{web_id}`), and finpy-tse can't connect from sandbox. Our z-ai page_reader approach fetches the same data correctly.
- Files modified: `src/lib/tsetmc-index-api.ts`, `start-dev.sh`, `supervisor.py` (new)

---
Task ID: 2
Agent: Main
Task: Fix 404 static chunk errors, implement finpy-tse library fallback for stocks

Work Log:
- **Fixed 404 errors**: Standalone Next.js build doesn't copy `.next/static/` to `.next/standalone/.next/static/`. Created symlink: `ln -sfn .next/static .next/standalone/.next/static`. Also added symlink recreation after every `next build`.
- **Added finpy-tse stock history endpoint** to Python service (port 3031):
  - `GET /api/stock-history?symbol=خودرو&adjust=1` — calls `finpy_tse.Get_Price_History()` with 30s ThreadPoolExecutor timeout
  - Returns candle data: `{date, open, high, low, close, volume}` in Shamsi format
  - File cache integration (stock_ prefix)
- **Added symbols search endpoint**: `GET /api/symbols-search?query=خودرو` — calls `finpy_tse.Build_Market_StockList()` with 60s timeout
- **Updated `tse-api.ts` fallback chain**:
  1. BRS API (Api.BrsApi.ir) — primary, 8s timeout
  2. **finpy-tse library** via Python service (port 3031) — 45s timeout (NEW)
  3. File cache (7-day TTL, expired fallback)
- Fixed `FINPY_SERVICE_URL` from port 3030 (old separate service) to 3031 (unified service)
- Updated `fetchFromFinpyService()` to call `/api/stock-history` with proper error handling
- Rebuilt Next.js and verified: homepage loads with 0 console errors, all JS/CSS chunks serve correctly
- finpy-tse library times out from sandbox (expected — CDN unreachable), but returns 504 gracefully so file cache kicks in

Stage Summary:
- 404 static chunk errors: FIXED (symlink `.next/static` → `.next/standalone/.next/static`)
- finpy-tse fallback: IMPLEMENTED (Python service endpoints + TypeScript fallback chain)
- Files modified: `mini-services/finpy-tse-service/app.py`, `src/lib/tse-api.ts`, `start-dev.sh`
---
Task ID: 1-2-3
Agent: Main
Task: Fix font 404s, change percentage calculation, and 15-min auto-refresh

Work Log:
- Diagnosed font 404: standalone Next.js server doesn't serve public/ dir automatically
- Fixed by copying public/ to .next/standalone/public/ and .next/static/ to .next/standalone/.next/static/
- Updated start-dev.sh to always copy static assets after build
- Fixed change percentage in /api/analysis/route.ts: now calculates from candle data (last close vs prev close) instead of BRS API's plp field
- Fixed /api/tgju-analysis/route.ts: changed `change` field to use `changePercent` instead of raw price difference
- Updated page.tsx to use toFaDecimal() (2 decimal places) for change percentage display
- Added 15-minute full page reload (window.location.reload) in page.tsx useEffect
- Rebuilt Next.js and restarted all services via supervisor.py
- Browser-verified: all fonts load successfully (200), no console errors, change displays as ۲٫۷% from candle data

Stage Summary:
- Font 404: SOLVED — public/ + static/ copied to standalone
- Change %: SOLVED — now (lastCandle.close - prevCandle.close) / prevCandle.close * 100, displayed with toFaDecimal
- 15-min refresh: SOLVED — window.location.reload() every 900,000ms
---
Task ID: 4
Agent: Main
Task: Redesign VDES analysis scenarios layout with proper UI/UX

Work Log:
- Removed cramped 2-column grid (analysis text + scenarios side-by-side)
- Stacked analysis text and scenarios as separate full-width cards
- Redesigned scenario cards: grouped by type (bullish/neutral/bearish) with visual labels
- Improved card design: larger padding (p-4), better typography (text-2xl), hover effects
- Added section headers with colored dots for each scenario group
- Redesigned summary bar as inline flex items with colored dots (instead of 3-column grid)
- Added total probability to scenarios card header
- Consistent heading style with amber accent bar
- Rebuilt and browser-verified: 6 distinct cards render correctly with proper hierarchy

Stage Summary:
- Analysis text and scenarios now full-width, stacked vertically
- Scenarios grouped: صعودی (R1-R4) | رنج (R5) | نزولی (R6-R9)
- Better card proportions, spacing, and visual hierarchy
- File changed: /home/z/my-project/src/components/tse/vdes-analysis.tsx
---
Task ID: 5
Agent: Main
Task: Data consistency audit and fix all contradictions across pages

Work Log:
- Comprehensive audit of ALL data display points across 7 components
- Identified 13 potential issues, prioritized by severity
- Fix 1 (CRITICAL): page.tsx line 416 — changed `lastPrice` from `candles[last].close` to `info.lastPrice ?? candles[last].close`. Now header and all analysis panels (VdesAnalysis, VdssGraph, MLForecast) show the same reference price.
- Fix 2 (CRITICAL): vdes-analysis.tsx — replaced locally-derived heuristic target (R1+0.5*(R2-R1) to R2+0.8*(R2-R1)) with dominant bullish scenario's actual targetMin/targetMax. Header badge now says "محدوده سناریوی صعودی غالب" and shows the same numbers as the R1 scenario card.
- Fix 3 (MEDIUM): vdes-analysis.tsx RSI badge — expanded from 3-level (red/amber/green) to 5-level matching the text classification (red > 70, orange > 60, amber > 40, sky > 30, green < 30).
- Fix 4 (MEDIUM): ml-forecast.tsx — renamed "روند ترکیبی" to "روند ترکیبی (ML)" to clarify it's ML-predicted, not TA-derived, preventing confusion with the header's TA signal badge.
- Verified: no console errors, header price ۶۴۷ matches VDES reference price ۶۴۷, header target ۶۴۸-۶۶۰ matches R1 card ۶۴۸-۶۶۰, RSI badge "اشباع خرید شدید" matches analysis text.

Stage Summary:
<<<<<<< Updated upstream
- Search dropdown: working (cached instruments data)
- Analysis: working with candlestick file cache as resilience layer
- Error UX: Persian messages, retry/back buttons
- Files changed: tse-api.ts, analysis/route.ts, page.tsx, zai-shared.ts
- New cache: db/candle-خودرو-type3.json, db/candle-خساپا-type3.json
---
Task ID: 0
Agent: main
Task: Fix 502 Bad Gateway on AI analysis endpoint

Work Log:
- Investigated dev server crash - server had died, restarted it
- Read current ai-analysis/route.ts - found it uses CLI wrapper (execFile 'z-ai') that fails with 429
- Checked git history - found v3/v5 parent commit used SDK directly via getZai()
- Read LLM skill docs - confirmed SDK uses role 'assistant' for system prompts
- Rewrote route.ts: replaced CLI wrapper with SDK (getZai() + chat.completions.create)
- Restored detailed v3 prompt (10-step structure with CoT, market phase, scenario tree, etc.)
- Restored proper system prompt with 11 rules
- Added queue-based rate limiting (15s min interval, 60s cooldown on 429)
- Added exponential backoff retry with jitter (15s, 30s, 60s)
- Kept in-memory cache (1hr TTL)
- Lint passes clean

Stage Summary:
- Root cause: Latest commit switched from SDK to CLI wrapper which hit 429 with no retry
- Fix: Reverted to SDK approach (v3-style) with proper retry + queue + detailed prompt
- File changed: /home/z/my-project/src/app/api/ai-analysis/route.ts

---
Task ID: 2
Agent: main
Task: Verify server stability and fix OOM issues

Work Log:
- Discovered server kept dying - investigated via dmesg
- Found OOM killer terminating next-server (1.8GB RSS in 4GB cgroup)
- agent-browser Chrome was consuming ~500MB+ in same cgroup, pushing total over limit
- Root cause: Kubernetes cgroup memory limit (4GB) shared between all processes
- Fix: Killed agent-browser, set NODE_OPTIONS='--max-old-space-size=768'
- Created auto-restart daemon script (start-dev.sh)
- Verified 19/20 requests returned HTTP 200 with ~39KB content over 60 seconds

Stage Summary:
- Server now stable with ~768MB heap limit and daemon auto-restart
- AI analysis route fixed (SDK approach restored from v3)
- User should see app in preview panel once infrastructure proxy detects backend

---
Task ID: 8
Agent: main
Task: Comprehensive error-free verification of all pages

Work Log:
- Found /api/instruments returning 500: file cache expired (30min TTL) + BrsApi timing out
- Increased FILE_CACHE_TTL from 30min to 24h (BrsApi unreliable from container)
- Added stale cache fallback: loadFileCache(type, force=true) when fresh cache fails
- Added 8s AbortSignal.timeout to all BrsApi fetches (fetchAllSymbols, fetchIndices, fetchCandlestick, fetchHistory)
- Added stale candle cache fallback in fetchCandlestick (expired cache > error)
- fetchHistory now returns [] on failure (non-blocking)
- fetchIndices now returns [] on failure (non-blocking)
- Browser tested 3 symbols end-to-end:
  1. خودرو (ایران خودرو): chart ✅, indicators ✅, decision graph ✅, AI text ✅ (Oscillators & Momentum school)
  2. خساپا (سایپا): chart ✅, indicators ✅, AI text ✅ (Support & Resistance school, 3 paragraphs, trading plan)
  3. وبملت (بانک ملت): chart ✅, AI text ✅ (Volatility & Volume school, R:R=27:1)
- Verified all sidebar tabs: اندیکاتورها, گراف تصمیم, توضیح‌دهنده تصویری
- Verified search filtering works for multiple queries
- Verified 5 scenarios displayed correctly with Persian labels
- Verified footer displays correctly (v5.0)
- Zero console errors throughout all tests
- Zero runtime errors in dev log

Stage Summary:
- All pages work error-free
- Symbol search → analysis → AI text flow verified for 3 symbols
- BrsApi reliability fixed: 24h file cache + stale fallback + 8s timeouts
- All API endpoints return proper responses or graceful fallbacks

---
Task ID: 9
Agent: main
Task: Fix AI prompt - remove multi-combination framing, ensure single combination per request

Work Log:
- User reported: AI system was listing "10 schools × 10 styles × 15 tones" in system prompt, causing confusion
- Verified: Backend code already correctly selects ONE combination via selectMLCombination() and makes ONE AI request
- Problem was in SYSTEM_PROMPT: told AI about all 10/10/15 combinations unnecessarily
- Fixed SYSTEM_PROMPT: removed "این سیستم شامل: 10 مکتب, 10 سبک, 15 لحن, انتخاب خودکار توسط ML"
- Replaced with: "مکتب، سبک و لحن تحلیل دقیقاً در هر درخواست مشخص شده است. فقط و فقط بر اساس همان یک ترکیب بنویسید."
- Removed "سیستم هوشمند ترکیبی" framing and 3 bullet points from user prompt header
- Removed v5.1 version label from prompt
- Updated buildPrompt function comment to remove version reference
- Verified: lint passes clean
- Browser tested: searched خودرو → selected symbol → chart loaded → AI analysis generated in 32.2s → text displayed correctly with 3 layers
- Confirmed: only ONE AI request made, ONE combination selected (Oscillators & Momentum + تحلیلگر حجم + عدد‌محور و سخت‌گیر)

Stage Summary:
- SYSTEM_PROMPT simplified: no longer mentions multiple combinations
- User prompt header cleaned: removed version label, smart system framing
- Code was already making single request - fix was in prompt clarity only
- Files changed: /home/z/my-project/src/app/api/ai-analysis/route.ts

---
Task ID: 10
Agent: main
Task: Remove internal system info from user-facing analysis text

Work Log:
- Removed ML Selection Badges from vdes-analysis.tsx UI
- Removed aiML state variable and setAiML() call
- Updated SYSTEM_PROMPT: explicit prohibition on internal system references
- Removed school/style/tone from prompt output structure
- Changed ML references to neutral labels in prompt methods section
- Browser verified: AI text has zero internal system references

Stage Summary:
- User sees only professional analysis text, no internal metadata
- Files changed: vdes-analysis.tsx, ai-analysis/route.ts
---
Task ID: 1
Agent: main
Task: Fix 6 issues reported by user (errors, 502, HMR, formatting)

Work Log:
- Fixed "Uncaught (in promise) Object" ×3 by adding proper res.ok checks before res.json() in vdes-analysis.tsx and page.tsx
- Fixed 502 Bad Gateway handling by wrapping res.json() in try/catch blocks for all fetch paths
- Fixed "Node cannot be found" by adding isConnected and offsetWidth checks before html-to-image toPng calls
- Added AbortError handling to prevent spurious error display on component unmount
- Updated renderAIText to support {color:COLOR} syntax with zero-width character normalization
- Updated SYSTEM_PROMPT with 16 rules including: colors (rule 16), emojis (rule 3), Persian % format (rule 12), no internal headings (rule 14), bold (rule 13)
- Fixed all fetch paths in page.tsx (TGJU, index, regular TSE) to handle non-JSON error responses
- Browser verified: 0 console errors, 6 colored spans rendering correctly, bold formatting working, no raw color tags

Stage Summary:
- All 6 issues resolved
- Key fix: zero-width Unicode character normalization in renderAIText was critical for color syntax
- Error handling now catches SyntaxError from res.json() on non-JSON responses (502, etc.)

---
Task ID: 1
Agent: Main Agent
Task: Fix 5 AI analysis issues + lock version 5 + fix frontend errors

Work Log:
- Fixed percentage bug: `s.prob * 100` → `s.prob` in route.ts line 244 (ta-engine already returns 0-100)
- Updated SYSTEM_PROMPT (v5 locked) with 5 new rules:
  1. Absolute ban on human/figure emojis (🧑‍💼 👤 etc)
  2. Absolute ban on "از منظر عملیاتی" and similar phrase-based segmentation
  3. Questions must be answered with scenarios/probabilities
  4. Absolute ban on Chinese language phrases
  5. AI must not multiply provided percentages by 100
- Updated all version references from v5.1 to v5
- Fixed "Uncaught (in promise) Object" ×3: Added catch block to doRefresh() + .catch() to onFocus handler
- Fixed "Node cannot be found" DOM error: Added visibility/height guards to exportPDF
- Fixed 502 Bad Gateway: Added 120s read/write timeout to Caddy proxy config
- Updated cache key version to v:5 to invalidate old cached analysis

Stage Summary:
- route.ts: Percentage fix (line 244), SYSTEM_PROMPT rewrite (17 rules), version v5 locked
- page.tsx: Unhandled promise rejection fixes (doRefresh + onFocus)
- vdes-analysis.tsx: Better exportPDF node guard
- Caddyfile: 120s proxy timeout
- All lint checks pass, zero console errors in browser verification
---
Task ID: 1
Agent: main
Task: Fix "cancelled" console error in VdesAnalysis for price_aed

Work Log:
- Investigated error: `[VdesAnalysis v11] Error for price_aed: "cancelled"`
- Found the error came from an OLD cached version of vdes-analysis.tsx (compiled chunk hash 6b4971e3 vs current 248fcdc6)
- The old code had a `console.error` that logged abort errors instead of silently handling them
- Added robust string-based abort detection in vdes-analysis.tsx catch block (line 657): checks for "cancelled", "aborted", "abort", "cancel" in error message
- Added AbortController to page.tsx handleSelect for ALL three fetch paths (TGJU, index, TSE) to prevent stale data updates on rapid symbol switching
- Added fetchControllerRef to page.tsx for proper cleanup between fetches
- Verified fix with agent-browser: selected AED (درهم امارات), no console errors; rapid switching AED→USD→AED, no errors

Stage Summary:
- vdes-analysis.tsx: Added string-based abort/cancel error filtering in AI analysis useEffect catch block
- page.tsx: Added AbortController with signal to all 3 fetch paths in handleSelect (tgju-analysis, finpy-sector, analysis)
- Both files now properly silence abort errors and prevent stale state updates
- Agent browser verification: zero console errors on AED load and rapid symbol switching

---
Task ID: 2
Agent: main
Task: Create ml-narrative-v11.ts (V11 Narrative Engine)

Work Log:
- Created /home/z/my-project/src/lib/ml-narrative-v11.ts
- Defined interfaces: V11ScenarioInput, V11ScenarioResult, V11Result
- Implemented computeV11Probabilities(): calculates cumulative probabilities (Ri OR worse), grouped bullish/bearish/neutral metrics, and risk profile classification
- Risk profile logic: very_bullish (>=55% and 2x bearish), very_bearish (inverse), bullish/bearish (dominant), neutral (default)
- Implemented buildV11PromptSection(): generates Persian text block with fa-IR number formatting for LLM prompt injection
- TypeScript compilation: clean (0 errors)
- ESLint: clean (0 errors)

Stage Summary:
- V11 Narrative Engine created with cumulative & exclusive probability computation
- Exports: computeV11Probabilities, buildV11PromptSection, and all interfaces
- File: /home/z/my-project/src/lib/ml-narrative-v11.ts
---
Task ID: 2-6
Agent: main
Task: Rebuild v11 features (احتمال تجمعی + احتمال اختصاصی سناریو) lost from previous session

Work Log:
- Surveyed current codebase (v6): ta-engine.ts returns raw R1-R5 probabilities summing to 100
- Created src/lib/ml-narrative-v11.ts: computeV11Probabilities() with cumulative and exclusive probabilities, risk profile, and LLM prompt builder
- Created src/app/api/v11-analysis/route.ts: lightweight API endpoint for v11 probability computation
- Updated src/components/tse/vdes-analysis.tsx: added v11 import, useMemo computation from client-side raw scenarios, updated scenario cards to show both اختصاصی and تجمعی, added v11 badge, bullish/bearish summary, and risk profile display
- Updated src/app/api/ai-analysis/route.ts: injected v11 probability data into LLM prompt (buildPrompt function), updated cache version from v5 to v11
- Updated src/components/tse/vdss-graph.tsx: added v11 import and computation, added cumulative probability labels on graph nodes (R1-R5), updated left panel path probability rows with تجمعی, updated bottom result cards with both اختصاصی and تجمعی
- Verified with agent browser: loaded خودرو symbol, confirmed all 5 scenarios show correct اختصاصی and تجمعی values, verified math (R1=22%/100%, R2=29%/78%, R3=27%/49%, R4=18%/22%, R5=4%/4%), zero console errors, both tabs (Visual Explainer + Decision Graph) show v11 features

Stage Summary:
- v11 successfully rebuilt with احتمال تجمعی and احتمال اختصاصی سناریو
- All computation is done client-side (no extra API call needed) using useMemo
- V11 data is also injected into AI analysis LLM prompt for richer AI narratives
- Files created: src/lib/ml-narrative-v11.ts, src/app/api/v11-analysis/route.ts
- Files modified: src/components/tse/vdes-analysis.tsx, src/components/tse/vdss-graph.tsx, src/app/api/ai-analysis/route.ts
=======
- All 4 fixes verified consistent in browser
- Data flow: API → info.lastPrice = currentPrice for all panels
- Target prices: header badge = dominant bullish scenario targetMin/targetMax = scenario card values
- RSI: 5-level system consistent between badge and text
- ML trend: clearly labeled as (ML) to distinguish from TA signal
>>>>>>> Stashed changes
