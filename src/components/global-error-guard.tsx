'use client';

import { useEffect } from 'react';

/**
 * Global error guard — registers unhandledrejection handler as early as possible.
 * Must be rendered in layout.tsx BEFORE any other client component.
 *
 * This suppresses Next.js/Turbopack/HMR internal promise rejections that
 * manifest as "Uncaught (in promise) Object" in the console.
 */
export default function GlobalErrorGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      const reason = e.reason;

      // Always suppress non-Error plain objects — these are framework internals
      if (reason !== null && typeof reason === 'object' && !(reason instanceof Error) && !Array.isArray(reason)) {
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
      ];
      if (frameworkPatterns.some(p => msg.includes(p))) {
        e.preventDefault();
        return;
      }

      // Suppress AbortError (from aborted fetch calls — expected behavior)
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        e.preventDefault();
        return;
      }

      // Suppress fetch network errors that show as TypeError with no message
      if (reason instanceof TypeError && (msg === 'Failed to fetch' || msg === 'NetworkError when attempting to fetch resource' || msg === 'Load failed')) {
        e.preventDefault();
        return;
      }
    };

    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  return <>{children}</>;
}
