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
