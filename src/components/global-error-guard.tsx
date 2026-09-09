'use client';

import { useEffect } from 'react';

/**
 * Global error guard — registers unhandledrejection + onerror handlers.
 * Must be rendered in layout.tsx BEFORE any other client component.
 *
 * This suppresses Next.js/Turbopack/HMR internal promise rejections that
 * manifest as "Uncaught (in promise) Object" in the console.
 *
 * Also catches synchronous errors that escape React error boundaries.
 */
export default function GlobalErrorGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;

      // null/undefined — framework noise
      if (reason == null) { e.preventDefault(); return; }

      // Always suppress non-Error plain objects — these are framework internals
      if (reason !== null && typeof reason === 'object' && !Array.isArray(reason) && !(reason instanceof Error)) {
        e.preventDefault();
        return;
      }

      // Suppress known framework error messages
      const msg = reason instanceof Error ? reason.message : String(reason);
      const frameworkPatterns = [
        'Fast Refresh',
        'React DevTools',
        'forward-logs',
        'Script error.',
        'ResizeObserver',
        'Failed to fetch',
        'Load failed',
        'NetworkError',
        'SecurityError',
        'AbortError',
        'cancelled',
        'aborted',
      ];
      if (frameworkPatterns.some(p => msg.includes(p))) {
        e.preventDefault();
        return;
      }

      // Suppress all DOMExceptions (AbortError, SecurityError, etc.)
      if (reason instanceof DOMException) {
        e.preventDefault();
        return;
      }

      // Suppress fetch network errors that show as TypeError with no message
      if (reason instanceof TypeError && (msg === 'Failed to fetch' || msg === 'NetworkError when attempting to fetch resource' || msg === 'Load failed' || msg === '')) {
        e.preventDefault();
        return;
      }
    };

    // Also catch synchronous window.onerror for errors outside React
    const handleError = (msg: string | Event, url?: string, line?: number, col?: number, error?: Error) => {
      if (msg instanceof Event) return false; // ignore Event objects
      const msgStr = String(msg);
      const safeErrors = ['ResizeObserver', 'Script error.', 'SecurityError', 'Failed to fetch'];
      if (safeErrors.some(p => msgStr.includes(p))) return true; // suppress
      return false; // let it propagate to error boundary
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError as EventListener);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError as EventListener);
    };
  }, []);

  return <>{children}</>;
}
