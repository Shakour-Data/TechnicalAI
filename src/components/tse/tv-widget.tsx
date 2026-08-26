'use client';

import React, { memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import TradingViewChartInner, { type CandleData as FallbackCandleData } from './tradingview-chart';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CandleData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

import type { IChartApi } from 'lightweight-charts';

export interface TVWidgetProps {
  symbolName: string;
  candles: CandleData[];
  supports?: number[];
  resistances?: number[];
  supportStrengths?: { price: number; strength: number; isTarget: boolean; grade?: string; overlapCount?: number; touchCount?: number; volumeRatio?: number }[];
  resistanceStrengths?: { price: number; strength: number; isTarget: boolean; grade?: string; overlapCount?: number; touchCount?: number; volumeRatio?: number }[];
  ma21?: number;
  ma100?: number;
  scenarios?: Record<string, { targetMin: number; targetMax: number; name: string; probability: number; color: string }>;
  height?: number;
  /** Callback to expose chart API for screenshot/export */
  onChartReady?: (chart: IChartApi | null) => void;
}

// ═══════════════════════════════════════════════════════════════════
// Component — wraps TradingViewChartInner (lightweight-charts)
// ═══════════════════════════════════════════════════════════════════

const TVWidgetInner = memo(function TVWidgetInner({
  symbolName,
  candles,
  supports = [],
  resistances = [],
  supportStrengths = [],
  resistanceStrengths = [],
  ma21 = 0,
  ma100 = 0,
  scenarios = {},
  onChartReady,
}: TVWidgetProps) {
  if (candles.length === 0) {
    return <Skeleton className="w-full bg-gray-100 rounded-2xl" style={{ height: 550 }} />;
  }

  return (
    <TradingViewChartInner
      symbolName={symbolName}
      candles={candles as unknown as FallbackCandleData[]}
      supports={supports}
      resistances={resistances}
      supportStrengths={supportStrengths as unknown as { price: number; strength: number; isTarget: boolean }[]}
      resistanceStrengths={resistanceStrengths as unknown as { price: number; strength: number; isTarget: boolean }[]}
      ma21={ma21}
      ma100={ma100}
      scenarios={scenarios}
      onChartReady={onChartReady}
    />
  );
});

export function TVWidgetSkeleton({ height = 520 }: { height?: number }) {
  return <Skeleton className="w-full bg-gray-100 rounded-2xl" style={{ height }} />;
}

export default TVWidgetInner;
