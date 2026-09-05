'use client';

import React from 'react';
import { useTheme } from '@/lib/theme-store';
import { toPersianDigits } from '@/lib/jalali';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SemicircleGaugeProps {
  /** Display label (Persian) */
  label: string;
  /** Current value */
  value: number;
  /** Minimum of the gauge range (e.g. -100 for Williams %R) */
  min: number;
  /** Maximum of the gauge range (e.g. 0 for Williams %R) */
  max: number;
  /** Signal for coloring the needle */
  signal: 'bullish' | 'bearish' | 'neutral';
  /** Optional zone thresholds: { bearishAbove, bullishBelow } for 0-100 range indicators */
  zones?: { bearishAbove?: number; bullishBelow?: number };
  /** Size in px (diameter) */
  size?: number;
  /** Show the numeric value inside the gauge */
  showValue?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SemicircleGauge({
  label,
  value,
  min,
  max,
  signal,
  zones,
  size = 110,
  showValue = true,
}: SemicircleGaugeProps) {
  const { colors: C } = useTheme();

  const strokeWidth = 8;
  const padding = strokeWidth / 2 + 2; // ensure stroke doesn't clip
  const cx = size / 2;
  const cy = size / 2;
  const radius = Math.max(1, size / 2 - padding);
  const svgHeight = size / 2 + padding; // enough room for the semicircle + stroke

  // ── Normalize value to 0..1 regardless of min/max signs ──
  const range = max - min;
  const clampedValue = Math.max(min, Math.min(max, value));
  const normalized = range !== 0 ? (clampedValue - min) / range : 0;

  // ── Arc math: semicircle from π (left) to 0 (right), sweeping over the top ──
  // Using standard SVG coordinates where y increases downward:
  // - Start angle = π (left side of circle)
  // - End angle = 0 (right side of circle)
  // - Arc sweeps OVER THE TOP (clockwise in SVG)
  const startAngle = Math.PI;
  const endAngle = 0;

  // Needle angle: maps normalized 0→startAngle(π), 1→endAngle(0)
  const needleAngle = startAngle + (endAngle - startAngle) * normalized;

  // ── Arc path helpers ──
  function polarToCartesian(angle: number) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy - radius * Math.sin(angle), // SVG y is inverted
    };
  }

  // Create an SVG arc path from angle a1 to angle a2 (both in math convention)
  // Draws the arc going clockwise in SVG (= over the top for our semicircle)
  function describeArc(a1: number, a2: number): string {
    const start = polarToCartesian(a1);
    const end = polarToCartesian(a2);
    // Arc span: a1 > a2 always (since normToAngle is decreasing), so span = a1 - a2
    const arcSpan = Math.abs(a1 - a2);
    // Large arc flag: 1 if the arc spans more than 180°
    const largeArcFlag = arcSpan > Math.PI ? 1 : 0;
    // Sweep flag: 1 = clockwise in SVG (goes over the top from left to right)
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  // ── Zone segments ──
  const zoneSegments: Array<{ from: number; to: number; color: string }> = [];

  if (zones) {
    const bullishNorm = zones.bullishBelow !== undefined
      ? (zones.bullishBelow - min) / range
      : 0.3;
    const bearishNorm = zones.bearishAbove !== undefined
      ? (zones.bearishAbove - min) / range
      : 0.7;

    zoneSegments.push({ from: 0, to: bullishNorm, color: hexToRgba(C.bullColor, 0.25) });
    zoneSegments.push({ from: bullishNorm, to: bearishNorm, color: hexToRgba(C.neutralColor, 0.15) });
    zoneSegments.push({ from: bearishNorm, to: 1, color: hexToRgba(C.bearColor, 0.25) });
  } else {
    zoneSegments.push({ from: 0, to: 1, color: hexToRgba(C.neutralColor, 0.12) });
  }

  // Convert normalized value (0-1) to angle
  function normToAngle(n: number): number {
    return startAngle + (endAngle - startAngle) * n;
  }

  // ── Needle color ──
  const needleColor =
    signal === 'bullish' ? C.bullColor :
    signal === 'bearish' ? C.bearColor :
    C.neutralColor;

  // ── Value display ──
  const displayValue = Math.round(value);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg
        width={size}
        height={svgHeight}
        viewBox={`0 0 ${size} ${svgHeight}`}
      >
        {/* Background track (full semicircle) */}
        <path
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke={hexToRgba(C.cardBorder, 0.4)}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />

        {/* Zone color segments (thin inner layer, no round caps to avoid overlap) */}
        {zoneSegments.map((z, i) => {
          const a1 = normToAngle(z.from);
          const a2 = normToAngle(z.to);
          if (Math.abs(a1 - a2) < 0.01) return null;
          return (
            <path
              key={i}
              d={describeArc(a1, a2)}
              fill="none"
              stroke={z.color}
              strokeWidth={strokeWidth - 2}
              strokeLinecap="butt"
            />
          );
        })}

        {/* Filled arc up to the current value */}
        {normalized > 0.005 && (
          <path
            d={describeArc(startAngle, needleAngle)}
            fill="none"
            stroke={needleColor}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        )}

        {/* Needle dot at the value position */}
        {(() => {
          const pos = polarToCartesian(needleAngle);
          return (
            <circle
              cx={pos.x.toFixed(2)}
              cy={pos.y.toFixed(2)}
              r={3.5}
              fill={needleColor}
              stroke={hexToRgba(C.cardBg, 0.8)}
              strokeWidth={1.5}
            />
          );
        })()}

        {/* Value text centered inside the arc */}
        {showValue && (
          <text
            x={cx}
            y={cy - radius * 0.35}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={C.cardFg}
            fontSize={size > 100 ? 14 : 11}
            fontWeight="700"
            fontFamily="system-ui, sans-serif"
            dir="ltr"
          >
            {toPersianDigits(String(displayValue))}
          </text>
        )}
      </svg>

      {/* Label below the gauge */}
      <span
        className="text-[10px] leading-tight text-center max-w-[90px]"
        style={{ color: C.cardSubFg }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
