import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import GlobalErrorGuard from "@/components/global-error-guard";

export const metadata: Metadata = {
  title: "Tse Technical Analysis — تحلیل تکنیکال بورس ایران",
  description: "تحلیل تکنیکال جامع سهام بورس ایران با اندیکاتورها، گراف تصمیم و توضیح‌دهنده تصویری",
};

/**
 * Comprehensive client-side error suppression script.
 * Runs BEFORE any React code to catch errors at the earliest point.
 *
 * Catches:
 * - unhandledrejection (promise rejections)
 * - window.onerror (synchronous & async errors)
 *
 * Known sources of noise in iframe/sandboxed contexts:
 * - ResizeObserver loop errors
 * - Network errors (Failed to fetch, Load failed)
 * - Non-Error plain object rejections (framework internals)
 * - AbortError from cancelled fetch calls
 * - Script error. (cross-origin iframe scripts)
 */
const ERROR_GUARD_SCRIPT = `
(function(){
  'use strict';

  // ── unhandledrejection ──
  window.addEventListener('unhandledrejection', function(e) {
    var r = e.reason;
    if (r === null || r === undefined) { e.preventDefault(); return; }

    // Non-Error plain objects → framework internals
    if (typeof r === 'object' && !Array.isArray(r) && !(r instanceof Error)) {
      e.preventDefault();
      return;
    }

    var m = r instanceof Error ? r.message : String(r);

    // Known safe-to-ignore patterns
    var safePatterns = [
      'Failed to fetch',
      'Load failed',
      'NetworkError',
      'ResizeObserver',
      'Script error.',
      'Fast Refresh',
      'React DevTools',
      'forward-logs',
      'AbortError',
      'cancelled',
      'aborted',
      'The user aborted a request',
      'request was aborted',
    ];
    for (var i = 0; i < safePatterns.length; i++) {
      if (m.includes(safePatterns[i])) { e.preventDefault(); return; }
    }

    // DOMException (AbortError, SecurityError, etc.)
    if (r instanceof DOMException) { e.preventDefault(); return; }

    // TypeError with no useful message (network-level)
    if (r instanceof TypeError && (m === '' || m === 'Failed to fetch' || m === 'Load failed')) {
      e.preventDefault();
      return;
    }
  });

  // ── window.onerror ──
  window.onerror = function(msg, url, line, col, error) {
    if (typeof msg !== 'string') return false;
    var safeErrors = [
      'ResizeObserver',
      'Script error.',
      'SecurityError',
      'Failed to fetch',
    ];
    for (var i = 0; i < safeErrors.length; i++) {
      if (msg.includes(safeErrors[i])) return true; // suppress
    }
    return false; // let React error boundary handle the rest
  };
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: ERROR_GUARD_SCRIPT,
          }}
        />
      </head>
      <body
        className="antialiased"
        style={{ fontFamily: 'Vazirmatn, sans-serif', backgroundColor: '#ffffff', color: '#1a1a1a' }}
        suppressHydrationWarning
      >
        <GlobalErrorGuard>
          {children}
        </GlobalErrorGuard>
        <Toaster />
      </body>
    </html>
  );
}
