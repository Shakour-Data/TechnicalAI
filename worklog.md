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
