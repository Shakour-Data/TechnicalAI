"use client";

import { useTheme } from "@/lib/theme-store";
import { Activity, GitBranch, BrainCircuit } from "lucide-react";

export default function PatternsPage() {
  const { colors: C } = useTheme();

  return (
    <div className="space-y-8" dir="rtl">
      {/* Page Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">الگوها</h2>
        <p className="text-blue-600 text-sm max-w-xl mx-auto">
          Comprehensive analysis of candlestick, classic, and harmonic patterns
        </p>
      </div>

      {/* Candlestick Patterns Section */}
      <section className="rounded-2xl border border-blue-100 bg-white p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <span>الگوهای کندل استیک</span>
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Single and multi-candlestick formations for market timing and reversal signals
        </p>
        <div className="grid gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-gray-900">Doji (دوجی)</span>
              <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">نترال</span>
            </div>
            <p className="text-sm text-gray-600">Market indecision - potential reversal signal</p>
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium">Direction:</span> Neutral | <span className="font-medium">Reliability:</span> Moderate (60%)
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-gray-900">Hammer (هَمَر)</span>
              <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">صعودی</span>
            </div>
            <p className="text-sm text-gray-600">Bullish reversal pattern with long lower shadow at bottom of downtrend</p>
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium">Direction:</span> Bullish | <span className="font-medium">Reliability:</span> Strong (82%)
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-gray-900">Engulfing (انگلوفینگ)</span>
              <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">نزولی</span>
            </div>
            <p className="text-sm text-gray-600">Strong bearish reversal - larger candle completely engulfs previous</p>
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium">Direction:</span> Bearish | <span className="font-medium">Reliability:</span> Strong (90%)
            </div>
          </div>
        </div>
      </section>

      {/* Classic Patterns Section */}
      <section className="rounded-2xl border border-blue-100 bg-white p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-blue-600" />
          <span>الگوهای کلاسیک</span>
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Traditional chart patterns for trend continuation and reversal analysis
        </p>
        <div className="grid gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-gray-900">سر و شانه (Head & Shoulders)</span>
              <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">نزولی</span>
            </div>
            <p className="text-sm text-gray-600">Bearish reversal - three peaks with middle highest</p>
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium">Direction:</span> Bearish <span className="font-medium mx-2">|</span>
              <span className="font-medium">Neckline:</span> 245,000
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-gray-900">مثلث صعودی (Ascending Triangle)</span>
              <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">صعودی</span>
            </div>
            <p className="text-sm text-gray-600">Bullish continuation - flat resistance, rising support</p>
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium">Direction:</span> Bullish <span className="font-medium mx-2">|</span>
              <span className="font-medium">Target:</span> Breakout above 238,500
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-gray-900">پرچم صعودی (Bull Flag)</span>
              <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">صعودی</span>
            </div>
            <p className="text-sm text-gray-600">Bullish continuation after sharp price surge</p>
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium">Direction:</span> Bullish <span className="font-medium mx-2">|</span>
              <span className="font-medium">Duration:</span> 5 days consolidation
            </div>
          </div>
        </div>
      </section>

      {/* Harmonic Patterns Section */}
      <section className="rounded-2xl border border-blue-100 bg-white p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-blue-600" />
          <span>الگوهای هارمونیک</span>
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Fibonacci-based patterns for precise reversal zone identification
        </p>
        <div className="grid gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-gray-900">گارتلی (Gartley)</span>
              <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">صعودی</span>
            </div>
            <p className="text-sm text-gray-600">XABCD pattern with 0.618, 0.382, 0.786 Fibonacci ratios</p>
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium">PRZ:</span> 234,000 - 237,000 <span className="font-medium mx-2">|</span>
              <span className="font-medium">Score:</span> 9/10 (all ratios confirmed)
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-gray-900">پروانه (Butterfly)</span>
              <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">نزولی</span>
            </div>
            <p className="text-sm text-gray-600">Bearish reversal - D point at 1.272 or 1.618 extension</p>
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium">PRZ:</span> 225,000 - 228,500 <span className="font-medium mx-2">|</span>
              <span className="font-medium">Pattern:</span> D &gt; X (exhaustion pattern)
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-gray-900">خفاش (Bat)</span>
              <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">صعودی</span>
            </div>
            <p className="text-sm text-gray-600">Precise pattern - XABCD with 0.382, 0.886, 0.886 ratios</p>
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium">PRZ:</span> 236,500 - 238,000 <span className="font-medium mx-2">|</span>
              <span className="font-medium">Confidence:</span> High (tight ratios)
            </div>
          </div>
        </div>
      </section>

      {/* Pattern Signals Guide Section */}
      <section className="rounded-2xl border border-blue-100 bg-blue-50/30 backdrop-blur-sm p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-3">راهنمای سیگنال‌ها</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-900">صعودی:</span> سیگنال خرید
          </div>
          <div>
            <span className="font-medium text-gray-900">نزولی:</span> سیگنال فروش
          </div>
          <div>
            <span className="font-medium text-gray-900">نترال:</span> بدون تصمیم
          </div>
        </div>
      </section>
    </div>
  );
}