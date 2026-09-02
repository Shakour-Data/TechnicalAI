'use client';

import { useEffect } from 'react';

/**
 * Global error boundary — catches errors that escape the root layout.
 * This is the LAST line of defense. Shows a minimal recovery page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.warn('[GlobalErrorBoundary] Caught:', error?.message);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body style={{ margin: 0, fontFamily: 'Vazirmatn, sans-serif', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.875rem' }}>
            خطای غیرمنتظره‌ای رخ داده.
          </p>
          <button
            onClick={() => { try { reset(); } catch { window.location.href = '/'; } }}
            style={{ padding: '0.5rem 1.5rem', borderRadius: '0.75rem', border: 'none', backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            تلاش مجدد
          </button>
        </div>
      </body>
    </html>
  );
}
