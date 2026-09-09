'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Route-level error boundary.
 * Catches errors in page.tsx and all its children, shows a recovery UI
 * instead of crashing the entire preview.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Log error for debugging but never let it propagate to crash
    console.warn('[ErrorBoundary] Caught error:', error?.message);
  }, [error]);

  const handleReset = () => {
    setCount(c => c + 1);
    try {
      reset();
    } catch {
      // If reset itself fails, do a soft navigation
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ backgroundColor: '#f8fafc' }}>
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">خطای موقت</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            خطای غیرمنتظره‌ای رخ داده. این مشکل موقت است و با بارگذاری مجدد برطرف می‌شود.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: '#2563eb' }}
        >
          <RefreshCw className="w-4 h-4" />
          تلاش مجدد
        </button>
        {count > 1 && (
          <p className="text-xs text-gray-400">
            اگر مشکل ادامه داشت، صفحه را به‌صورت دستی بازنشانی کنید.
          </p>
        )}
      </div>
    </div>
  );
}
