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

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 6; // padding for stroke
  const strokeWidth = 6;

  // ── Normalize value to 0..1 regardless of min/max signs ──
  const range = max - min;
  const clampedValue = Math.max(min, Math.min(max, value));
  const normalized = range !== 0 ? (clampedValue - min) / range : 0;

  // ── Arc math: semicircle from π (left) to 0 (right), sweeping the top ──
  // Angle 0 = right, π/2 = top, π = left
  // We draw from left (π) to right (0), going counter-clockwise over the top
  const startAngle = Math.PI; // left
  const endAngle = 0; // right

  // Needle angle: maps normalized 0→startAngle(π), 1→endAngle(0)
  const needleAngle = startAngle + (endAngle - startAngle) * normalized;

  // ── Arc path helpers ──
  function polarToCartesian(angle: number) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy - radius * Math.sin(angle), // SVG y is inverted
    };
  }

  // Create arc path from angle1 to angle2
  function describeArc(a1: number, a2: number) {
    const start = polarToCartesian(a1);
    const end = polarToCartesian(a2);
    const sweep = a1 - a2 > Math.PI ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${sweep} 1 ${end.x} ${end.y}`;
  }

  // ── Zone segments ──
  // Default zones: normalize zone thresholds to the gauge's min/max range
  let zoneSegments: Array<{ from: number; to: number; color: string }> = [];

  if (zones) {
    const bullishNorm = zones.bullishBelow !== undefined
      ? (zones.bullishBelow - min) / range
      : 0.3;
    const bearishNorm = zones.bearishAbove !== undefined
      ? (zones.bearishAbove - min) / range
      : 0.7;

    // Bullish zone: 0 → bullishNorm
    zoneSegments.push({
      from: 0,
      to: bullishNorm,
      color: hexToRgba(C.bullColor, 0.3),
    });
    // Neutral zone: bullishNorm → bearishNorm
    zoneSegments.push({
      from: bullishNorm,
      to: bearishNorm,
      color: hexToRgba(C.neutralColor, 0.2),
    });
    // Bearish zone: bearishNorm → 1
    zoneSegments.push({
      from: bearishNorm,
      to: 1,
      color: hexToRgba(C.bearColor, 0.3),
    });
  } else {
    // No zones — single neutral arc
    zoneSegments.push({
      from: 0,
      to: 1,
      color: hexToRgba(C.neutralColor, 0.15),
    });
  }

  // Convert zone normalized ranges to angle ranges
  function normToAngle(n: number) {
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
        height={size / 2 + 8} // only need top half + some padding
        viewBox={`0 0 ${size} ${size / 2 + 8}`}
        className="overflow-visible"
      >
        {/* Background track */}
        <path
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke={hexToRgba(C.cardBorder, 0.5)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Zone segments */}
        {zoneSegments.map((z, i) => {
          const a1 = normToAngle(z.from);
          const a2 = normToAngle(z.to);
          // Skip zero-length arcs
          if (Math.abs(a1 - a2) < 0.01) return null;
          return (
            <path
              key={i}
              d={describeArc(a1, a2)}
              fill="none"
              stroke={z.color}
              strokeWidth={strokeWidth - 1}
              strokeLinecap="round"
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
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 2px ${hexToRgba(needleColor, 0.4)})` }}
          />
        )}

        {/* Needle dot at the value position */}
        {(() => {
          const needlePos = polarToCartesian(needleAngle);
          return (
            <circle
              cx={needlePos.x}
              cy={needlePos.y}
              r={4}
              fill={needleColor}
              style={{ filter: `drop-shadow(0 0 3px ${hexToRgba(needleColor, 0.6)})` }}
            />
          );
        })()}

        {/* Value text inside the arc */}
        {showValue && (
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={C.cardFg}
            fontSize={size > 100 ? 13 : 11}
            fontWeight="600"
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
