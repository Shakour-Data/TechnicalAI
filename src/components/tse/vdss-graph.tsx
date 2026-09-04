'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toPersianDigits } from '@/lib/jalali';
import { type GraphData } from '@/lib/decision-graph';
import { type ProbabilityTrendResult, type DayPoint, type ScenarioTrend, type TrendDirection, SCENARIO_KEYS, SCENARIO_META, calculateCDF } from '@/lib/probability-trend';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTheme } from '@/lib/theme-store';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface Scenario {
  name: string;
  nameEn: string;
  probability: number;
  targetMin: number;
  targetMax: number;
  description: string;
}

export interface VdssGraphProps {
  symbolName: string;
  currentPrice: number;
  resistances: number[];
  supports: number[];
  ma100: number;
  rsi: number;
  mfi: number;
  cci: number;
  adx: number;
  trendDirection: string;
  bullScore: number;
  scenarios: {
    SC1: Scenario;
    SC2: Scenario;
    SC3: Scenario;
    SC4: Scenario;
    SC5: Scenario;
    SC6: Scenario;
    SC7: Scenario;
    SC8: Scenario;
    SC9: Scenario;
  };
  decisionGraph: GraphData | null;
  probabilityTrend?: ProbabilityTrendResult | null;
  currencyUnit?: string;
  atr?: number;
  instrumentType?: string;
  instrumentCategory?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dark Theme Constants
// ═══════════════════════════════════════════════════════════════════════════════

const D = {
  bg: '#07111b',
  bg2: '#0b1c2b',
  panel: 'rgba(13,31,47,.90)',
  panel2: 'rgba(19,42,61,.82)',
  line: 'rgba(170,208,229,.18)',
  text: '#eaf5fb',
  muted: '#9db4c2',
  cyan: '#3ad5db',
  blue: '#4186ff',
  purple: '#a04ac5',
  gold: '#ffb11b',
  orange: '#ff7b32',
  red: '#ef4d62',
  green: '#34c98b',
  shadow: '0 18px 55px rgba(0,0,0,.35)',
} as const;

const toFa = (n: number) => Math.round(n).toLocaleString('fa-IR');

const COLORS = {
  up: D.green,
  pullback: D.blue,
  down: D.orange,
  risk: D.red,
  cyan: D.cyan,
  purple: D.purple,
  gold: D.gold,
};

const EDGE_COLORS: Record<string, string> = {
  'branch-trend': COLORS.cyan,
  'branch-breakout': COLORS.gold,
  'branch-reversal': COLORS.purple,
  up: COLORS.up,
  pullback: COLORS.pullback,
  down: COLORS.down,
  risk: COLORS.risk,
};

const SCENARIO_META_LOCAL: Record<string, { label: string; color: string }> = {
  SC1: { label: 'شوک نزولی', color: '#b91c1c' },
  SC2: { label: 'نزولی شتاب‌دار', color: '#dc2626' },
  SC3: { label: 'نزولی قوی', color: '#ea580c' },
  SC4: { label: 'نزولی خفیف', color: '#c2410c' },
  SC5: { label: 'رنج', color: '#b45309' },
  SC6: { label: 'صعودی خفیف', color: '#047857' },
  SC7: { label: 'صعودی قوی', color: '#059669' },
  SC8: { label: 'صعودی شتاب‌دار', color: '#0e7490' },
  SC9: { label: 'شوک صعودی', color: '#0891b2' },
};

const SCENARIO_DISPLAY: Record<string, string> = {
  ROOT: 'ریشه',
  BR1: 'پیروی از روند', BR2: 'شکست', BR3: 'بازگشت',
  EA: 'وضعیت روند', EB: 'وضعیت شکست', EC: 'وضعیت واگرایی',
  SC1: 'SC1', SC2: 'SC2', SC3: 'SC3',
  SC4: 'SC4', SC5: 'SC5', SC6: 'SC6',
  SC7: 'SC7', SC8: 'SC8', SC9: 'SC9',
};

const BRANCH_META: Record<string, { label: string; color: string }> = {
  trend: { label: 'پیروی از روند', color: COLORS.cyan },
  breakout: { label: 'شکست', color: COLORS.gold },
  reversal: { label: 'بازگشت', color: COLORS.purple },
};

const TYPE_FILTERS = [
  { key: 'all', label: 'همه مسیرها' },
  { key: 'up', label: 'صعودی' },
  { key: 'pullback', label: 'رنج و خنثی' },
  { key: 'down', label: 'نزولی' },
  { key: 'risk', label: 'شوک و ریسک' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function VdssGraph(props: VdssGraphProps) {
  const { colors: C } = useTheme();
  const {
    symbolName,
    currentPrice,
    scenarios,
    decisionGraph,
  } = props;

  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const shellRef = useRef<HTMLDivElement>(null);

  // ── Derived data from decisionGraph ──────────────────────────────
  const edges = decisionGraph?.edges ?? [];
  const nodes = decisionGraph?.nodes ?? [];
  const nodePositions = decisionGraph?.nodePositions ?? {};
  const edgeProbabilities = decisionGraph?.edgeProbabilities ?? {};
  const branchProbs = decisionGraph?.branchProbabilities ?? { trend: 0.33, breakout: 0.33, reversal: 0.34 };
  const scenarioProbabilities = decisionGraph?.scenarioProbabilities ?? {};
  const pathContributions = decisionGraph?.pathContributions ?? {};

  // Build node lookup map
  const nodeMap = useMemo(() => {
    const map: Record<string, (typeof nodes)[number]> = {};
    for (const n of nodes) map[n.id] = n;
    return map;
  }, [nodes]);

  // ── Visible edges/nodes based on filter ──────────────────────────
  const { visibleEdgeIndices, visibleNodes } = useMemo(() => {
    if (activeFilter === 'all') {
      const allEdgeIdx = edges.map((_, i) => i);
      const allNodes = new Set(nodes.map(n => n.id));
      return { visibleEdgeIndices: allEdgeIdx, visibleNodes: allNodes };
    }
    if (SCENARIO_KEYS.includes(activeFilter as typeof SCENARIO_KEYS[number])) {
      const edgeSet = new Set<number>();
      const nodeSet = new Set<string>(['ROOT', activeFilter]);
      edges.forEach((e, i) => {
        if (e.to === activeFilter) {
          edgeSet.add(i);
          nodeSet.add(e.from);
        }
      });
      edges.forEach((e, i) => {
        if (nodeSet.has(e.to) && !e.to.startsWith('R')) {
          edgeSet.add(i);
          nodeSet.add(e.from);
        }
      });
      return { visibleEdgeIndices: [...edgeSet], visibleNodes: nodeSet };
    }
    if (activeFilter === 'trend' || activeFilter === 'breakout' || activeFilter === 'reversal') {
      const branchType = `branch-${activeFilter}` as const;
      const edgeSet = new Set<number>();
      const nodeSet = new Set<string>(['ROOT']);
      edges.forEach((e, i) => {
        if (e.type === branchType) {
          edgeSet.add(i);
          nodeSet.add(e.from);
          nodeSet.add(e.to);
        }
      });
      const expanded = new Set<number>();
      const expandedNodes = new Set<string>(nodeSet);
      edges.forEach((e, i) => {
        if (expandedNodes.has(e.from)) {
          expanded.add(i);
          expandedNodes.add(e.to);
        }
      });
      return { visibleEdgeIndices: [...expanded], visibleNodes: expandedNodes };
    }
    // Type filter (up/pullback/down/risk)
    const edgeSet = new Set<number>();
    const nodeSet = new Set<string>(['ROOT']);
    edges.forEach((e, i) => {
      if (e.type === activeFilter) {
        edgeSet.add(i);
        nodeSet.add(e.from);
        nodeSet.add(e.to);
      }
    });
    return { visibleEdgeIndices: [...edgeSet], visibleNodes: nodeSet };
  }, [activeFilter, edges, nodes]);

  // ── Draw SVG edges ───────────────────────────────────────────────
  const drawEdges = useCallback(() => {
    const svg = svgRef.current;
    const graph = graphRef.current;
    if (!svg || !graph || edges.length === 0) return;

    let markersSvg = '';
    const seenColors = new Set<string>();
    for (const e of edges) {
      const c = EDGE_COLORS[e.type];
      if (c && !seenColors.has(e.type)) {
        seenColors.add(e.type);
        markersSvg += `<marker id="arrow-${e.type}" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="${c}"/></marker>`;
      }
    }

    let pathsSvg = '';
    const graphRect = graph.getBoundingClientRect();

    for (let ei = 0; ei < edges.length; ei++) {
      const { from: fromId, to: toId, label, type } = edges[ei];
      const isVisible = visibleEdgeIndices.includes(ei);
      const fromEl = nodeRefs.current[fromId];
      const toEl = nodeRefs.current[toId];
      if (!fromEl || !toEl) continue;

      const fRect = fromEl.getBoundingClientRect();
      const tRect = toEl.getBoundingClientRect();
      const ax = fRect.left - graphRect.left + fRect.width / 2;
      const ay = fRect.top - graphRect.top + fRect.height / 2;
      const bx = tRect.left - graphRect.left + tRect.width / 2;
      const by = tRect.top - graphRect.top + tRect.height / 2;
      const dx = bx - ax;
      const dy = by - ay;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist === 0) continue;

      const bend = Math.min(52, Math.max(18, dist * 0.11));
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const nx = -dy / dist;
      const ny = dx / dist;
      const cx = mx + nx * bend;
      const cy = my + ny * bend;

      const d = `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
      const prob = edgeProbabilities[ei] ?? 0;
      const probLabel = toPersianDigits((prob * 100).toFixed(0)) + '٪';
      const edgeColor = EDGE_COLORS[type] ?? '#6b7280';

      pathsSvg += `<path d="${d}" stroke="${edgeColor}" stroke-width="${isVisible ? 2 : 0.8}" opacity="${isVisible ? 0.72 : 0.05}" fill="none" marker-end="url(#arrow-${type})" data-type="${type}" data-from="${fromId}" data-to="${toId}" class="edge-path" style="transition: opacity .25s, stroke-width .25s;"/>`;

      if (isVisible && ei >= 6) {
        pathsSvg += `<text x="${cx}" y="${cy - 5}" fill="#ffffff" font-size="10" text-anchor="middle" paint-order="stroke" stroke="#07111b" stroke-width="4" stroke-linejoin="round" opacity="0.95" data-type="${type}" class="edge-label">${label}</text>`;
        pathsSvg += `<text x="${cx}" y="${cy + 7}" fill="${edgeColor}" font-size="9" font-weight="bold" text-anchor="middle" paint-order="stroke" stroke="#07111b" stroke-width="3" stroke-linejoin="round" opacity="0.9" class="edge-prob">${probLabel}</text>`;
      }
    }

    svg.innerHTML = `<defs>${markersSvg}</defs>${pathsSvg}`;
  }, [visibleEdgeIndices, edges, edgeProbabilities]);

  useEffect(() => { drawEdges(); }, [drawEdges]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    let observer: ResizeObserver | null = null;
    try {
      observer = new ResizeObserver(() => { try { drawEdges(); } catch {} });
      observer.observe(el);
    } catch {}
    return () => { try { observer?.disconnect(); } catch {} };
  }, [drawEdges]);


  // ── All filter buttons ────────────────────────────────────────────
  const allFilters = [
    ...TYPE_FILTERS,
    { key: 'sep1', label: '│', isSep: true as const },
    ...Object.entries(BRANCH_META).map(([k, v]) => ({ key: k, label: v.label, branchKey: k, branchColor: v.color })),
    { key: 'sep2', label: '│', isSep: true as const },
    ...SCENARIO_KEYS.map(k => ({ key: k, label: SCENARIO_META_LOCAL[k].label, scenarioKey: k })),
  ];

  // ── Corrected probabilityTrend: day 1 overridden with final scenario probabilities ──
  const correctedTrend = useMemo(() => {
    const raw = props.probabilityTrend;
    if (!raw || !raw.scenarios || raw.scenarios.length === 0) return raw;

    // Build final individual probabilities (matching boxes) for day 1
    const day1Individuals: Record<string, number> = {};
    for (const key of SCENARIO_KEYS) {
      const s = scenarios[key as keyof typeof scenarios];
      day1Individuals[key] = (s?.probability ?? 0) / 100;
    }

    // Corrected scenarios array
    const correctedScenarios: ScenarioTrend[] = raw.scenarios.map(sc => {
      const newInd = day1Individuals[sc.scenarioKey] ?? sc.trend[0]?.individualProb ?? 0;
      const newCum = calculateCDF(sc.scenarioKey, day1Individuals);
      const newTrend: DayPoint[] = sc.trend.map((dp, i) => {
        if (i === 0) {
          return { ...dp, individualProb: newInd, cumulativeProb: newCum };
        }
        return dp;
      });
      return {
        ...sc,
        currentProbability: newInd,
        trend: newTrend,
        peakProbability: Math.max(newInd, sc.peakProbability),
      };
    });

    // Corrected groups
    const correctedGroups = raw.groups.map(g => {
      // Group cumulative for day 1
      const day1AllInds: Record<string, number> = {};
      for (const sc of raw.scenarios) {
        day1AllInds[sc.scenarioKey] = day1Individuals[sc.scenarioKey] ?? sc.trend[0]?.individualProb ?? 0;
      }
      let groupCumDay1 = 0;
      if (g.group === 'bullish') {
        groupCumDay1 = calculateCDF('SC6', day1AllInds);
      } else if (g.group === 'bearish') {
        groupCumDay1 = calculateCDF('SC4', day1AllInds);
      } else {
        groupCumDay1 = day1AllInds['SC5'] ?? 0;
      }

      const newTrend: DayPoint[] = g.trend.map((dp, i) => {
        if (i === 0) {
          return { ...dp, individualProb: groupCumDay1, cumulativeProb: groupCumDay1 };
        }
        return dp;
      });
      return {
        ...g,
        trend: newTrend,
        peakProbability: Math.max(groupCumDay1, g.peakProbability),
      };
    });

    return { ...raw, scenarios: correctedScenarios, groups: correctedGroups };
  }, [props.probabilityTrend, scenarios]);

  // ── Meaningful node display values (Persian-formatted) ──────────
  const nodeDisplayValues = useMemo(() => {
    const display: Record<string, string> = {};
    if (!decisionGraph) return display;

    // Sub-branch parent mapping
    const subParents: Record<string, string> = {
      N_T_BULL: 'N_TREND', N_T_BEAR: 'N_TREND', N_T_FLAT: 'N_TREND',
      N_B_UP: 'N_BREAK', N_B_DOWN: 'N_BREAK', N_B_NONE: 'N_BREAK',
      N_R_BULL: 'N_REVERSAL', N_R_BEAR: 'N_REVERSAL', N_R_NONE: 'N_REVERSAL',
    };

    // Find edge probability from parent to child
    const getEdgeProb = (from: string, to: string): number => {
      for (let i = 0; i < edges.length; i++) {
        if (edges[i].from === from && edges[i].to === to) {
          return edgeProbabilities[i] ?? 0;
        }
      }
      return 0;
    };

    // ROOT: no numeric value needed
    display['ROOT'] = '';

    // Main branches: absolute probability from root
    display['N_TREND'] = toPersianDigits((branchProbs.trend * 100).toFixed(0)) + '٪';
    display['N_BREAK'] = toPersianDigits((branchProbs.breakout * 100).toFixed(0)) + '٪';
    display['N_REVERSAL'] = toPersianDigits((branchProbs.reversal * 100).toFixed(0)) + '٪';

    // Sub-branches: conditional probability within parent (meaningful context)
    for (const [sub, parent] of Object.entries(subParents)) {
      const condProb = getEdgeProb(parent, sub);
      display[sub] = toPersianDigits((condProb * 100).toFixed(0)) + '٪';
    }

    // Event/assessment nodes: no value (they represent conditions, not probability outcomes)
    for (const node of nodes) {
      if (node.type === 'event') {
        display[node.id] = '';
      }
    }

    // Terminal nodes (SC1-SC9): handled by the big badge, no extra text
    for (const key of SCENARIO_KEYS) {
      display[key] = '';
    }

    return display;
  }, [decisionGraph, edges, edgeProbabilities, branchProbs, nodes]);

  // ═══ Design dimensions ═══
  const DESIGN_W = 1500;
  const DESIGN_H = 1200;
  const DISPLAY_W = 1200;
  const DISPLAY_H = 1200;
  const scaleX = DISPLAY_W / DESIGN_W;
  const scaleY = DISPLAY_H / DESIGN_H;

  // ── Loading state ────────────────────────────────────────────────
  if (!decisionGraph) {
    return <VdssGraphSkeleton />;
  }

  return (
    <div className="space-y-3" dir="rtl">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl"
        style={{
          border: '1px solid rgba(58,213,219,.22)',
          background: 'linear-gradient(105deg, rgba(14,35,53,.94), rgba(8,22,35,.77))',
          boxShadow: D.shadow,
        }}>
        <div className="flex items-center gap-3.5">
          <div style={{
            width: 48, height: 48, display: 'grid', placeItems: 'center',
            border: '1px solid rgba(255,177,27,.7)', borderRadius: 14,
            color: D.gold, fontSize: 27,
            boxShadow: 'inset 0 0 22px rgba(255,177,27,.12), 0 0 22px rgba(255,177,27,.08)',
          }}>◈</div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px', color: D.text }}>گراف تصمیم {symbolName}</h2>
            <p style={{ fontSize: 12, color: D.muted, margin: 0 }}>مدل ۳‌شاخه‌ای | پیروی از روند، شکست، بازگشت | ۲۷ مسیر به ۹ سناریو</p>
          </div>
        </div>
        <div className="text-left text-xs leading-loose pr-4"
          style={{ color: '#ffffff', borderRight: '1px solid rgba(58,213,219,.24)' }}>
          نقطهٔ مرجع: <b style={{ color: D.cyan }}>{toFa(currentPrice)}</b><br />
          افق برآورد: ۱۰ تا ۲۵ جلسه معاملاتی
        </div>
      </div>

      {/* ═══ Metric Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DarkMetricCard label="مقدار مرجع" value={toFa(currentPrice) + ' ' + (props.currencyUnit ?? 'ریال')} color={D.cyan} />
        <DarkMetricCard label="احتمال روند" value={toPersianDigits((branchProbs.trend * 100).toFixed(0)) + '٪'} color={D.cyan} />
        <DarkMetricCard label="احتمال شکست" value={toPersianDigits((branchProbs.breakout * 100).toFixed(0)) + '٪'} color={D.gold} />
        <DarkMetricCard label="احتمال بازگشت" value={toPersianDigits((branchProbs.reversal * 100).toFixed(0)) + '٪'} color={D.purple} />
      </div>

      {/* ═══ Toolbar ═══ */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-3 rounded-t-2xl"
        style={{
          border: `1px solid ${D.line}`,
          background: 'rgba(9,24,37,.92)',
        }}>
        <span style={{ fontSize: 13, color: D.muted, marginLeft: 6 }}>نمایش مسیرها:</span>
        {allFilters.map((btn, i) => {
          if ('isSep' in btn && btn.isSep) {
            return <span key={`sep-${i}`} style={{ color: 'rgba(170,208,229,.18)', margin: '0 4px', userSelect: 'none' }}>│</span>;
          }
          const isScenario = 'scenarioKey' in btn;
          const isBranch = 'branchKey' in btn;
          const isActive = activeFilter === btn.key;
          const meta = isScenario ? SCENARIO_META_LOCAL[(btn as { scenarioKey: string }).scenarioKey] : null;
          const bColor = isBranch ? (btn as unknown as { branchColor: string }).branchColor : null;
          const activeColor = isScenario && meta ? meta.color : isBranch && bColor ? bColor : D.cyan;
          return (
            <button
              key={btn.key}
              onClick={() => setActiveFilter(btn.key)}
              style={{
                color: isActive ? '#fff' : '#ffffff',
                border: `1px solid ${isActive ? activeColor + 'b3' : 'rgba(255,255,255,.15)'}`,
                borderRadius: 10,
                background: isActive ? `${activeColor}24` : 'rgba(255,255,255,.04)',
                padding: '8px 11px',
                fontFamily: 'inherit', fontSize: 12,
                cursor: 'pointer', transition: '.2s ease',
                boxShadow: isActive ? `0 0 18px ${activeColor}1a` : 'none',
                transform: isActive ? 'translateY(-1px)' : 'none',
              }}
            >{btn.label}</button>
          );
        })}
        <button
          onClick={() => { setSelectedNode(null); setActiveFilter('all'); }}
          style={{
            color: '#ffffff', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10,
            background: 'rgba(255,255,255,.04)', padding: '8px 11px',
            fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', transition: '.2s ease',
            marginRight: 'auto',
          }}
        >بازنشانی انتخاب</button>
      </div>

      {/* ═══ Graph Workspace ═══ */}
      {/* Graph Shell */}
      <div
        ref={shellRef}
        className="relative overflow-auto min-h-[400px]"
        style={{
          border: `1px solid ${D.line}`, borderTop: 'none',
          background: `radial-gradient(circle at 49% 49%, rgba(47,108,145,.12), transparent 36%), rgba(4,15,25,.72)`,
          boxShadow: D.shadow,
        }}>
        <div ref={graphRef} className="relative mx-auto" style={{ width: DISPLAY_W, height: DISPLAY_H, minWidth: DISPLAY_W, minHeight: DISPLAY_H }}>
          <svg ref={svgRef} className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" aria-label="مسیرهای گراف تصمیم" />

          {/* Nodes */}
          {nodes.map(node => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            const isRoot = node.id === 'ROOT';
            const isResultNode = node.isTerminal === true || node.type === 'terminal' || SCENARIO_KEYS.includes(node.id as typeof SCENARIO_KEYS[number]);
            const isEventNode = node.type === 'event';
            // Layer 1 main branches: N_TREND, N_BREAK, N_REVERSAL
            const isMainBranch = ['N_TREND', 'N_BREAK', 'N_REVERSAL'].includes(node.id);
            // All other decision nodes (Layer 2 sub-branches)
            const isSubBranch = node.type === 'decision' && !isRoot && !isMainBranch;
            const isSelected = selectedNode === node.id;
            const isVisible = visibleNodes.has(node.id);
            const scenarioProb = isResultNode ? (scenarioProbabilities[node.id] ?? 0) : null;
            const scenarioColor = isResultNode ? (SCENARIO_META_LOCAL[node.id]?.color ?? node.color) : node.color;

            // Node dimensions — match the layout in decision-graph.ts
            const nodeWidth = isResultNode ? 175 : isEventNode ? 158 : 155;
            const nodeMinH = isResultNode ? 84 : isEventNode ? 56 : 72;

            // Node styling based on type
            let bgStyle: string;
            let innerGlow: string;
            let baseBoxShadow: string;
            let borderW = '1px';
            let borderDash: React.CSSProperties['borderStyle'] = 'solid';

            if (isRoot) {
              bgStyle = 'linear-gradient(145deg, rgba(18,42,61,.97), rgba(6,21,34,.96))';
              innerGlow = `inset 0 0 22px ${D.cyan}1f`;
              baseBoxShadow = `${innerGlow}, 0 10px 25px rgba(0,0,0,.25)`;
            } else if (isEventNode) {
              bgStyle = 'linear-gradient(145deg, rgba(18,42,61,.97), rgba(6,21,34,.96))';
              innerGlow = `inset 0 0 18px ${scenarioColor}1f`;
              baseBoxShadow = `${innerGlow}, 0 8px 20px rgba(0,0,0,.22)`;
              borderDash = 'dotted';
            } else if (isResultNode) {
              bgStyle = `linear-gradient(160deg, ${scenarioColor}1f, rgba(8,22,35,.65))`;
              innerGlow = `inset 0 0 24px ${scenarioColor}18`;
              baseBoxShadow = `${innerGlow}, 0 10px 25px rgba(0,0,0,.25)`;
              borderW = '2px';
            } else {
              // Main branch and sub-branch decision nodes
              bgStyle = 'linear-gradient(145deg, rgba(18,42,61,.97), rgba(6,21,34,.96))';
              innerGlow = `inset 0 0 22px ${scenarioColor}22`;
              baseBoxShadow = `${innerGlow}, 0 10px 25px rgba(0,0,0,.25)`;
            }

            const selectedGlow = isSelected
              ? `0 0 0 2px ${scenarioColor}47, 0 0 28px ${scenarioColor}40`
              : baseBoxShadow;

            // High-contrast text: bright white for visibility on dark backgrounds
            const textColor = isVisible ? '#ffffff' : 'rgba(255,255,255,.3)';
            const secondaryColor = '#e0eaf0';

            return (
              <div
                key={node.id}
                ref={el => { nodeRefs.current[node.id] = el; }}
                onClick={() => setSelectedNode(node.id)}
                className="absolute cursor-pointer z-[2] text-center"
                style={{
                  right: pos.right * scaleX,
                  top: pos.top * scaleY,
                  width: nodeWidth,
                  minWidth: nodeWidth,
                  minHeight: nodeMinH,
                  padding: isResultNode ? '8px 9px' : '8px 9px',
                  border: `${borderW} ${borderDash} ${scenarioColor}`,
                  borderRadius: 13,
                  background: bgStyle,
                  boxShadow: selectedGlow,
                  opacity: isVisible ? 1 : 0.12,
                  transform: isSelected ? 'translateY(-4px) scale(1.025)' : 'none',
                  filter: isSelected ? 'brightness(1.18)' : 'none',
                  transition: 'transform .2s, filter .2s, opacity .2s, box-shadow .2s',
                }}
                onMouseEnter={e => {
                  if (!isSelected && isVisible) {
                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.025)';
                    e.currentTarget.style.filter = 'brightness(1.18)';
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${scenarioColor}47, 0 0 28px ${scenarioColor}40`;
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.filter = 'none';
                    e.currentTarget.style.boxShadow = baseBoxShadow;
                  }
                }}
              >
                {/* ROOT node */}
                {isRoot && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.45, color: '#ffffff' }}>ریشه تصمیم</div>
                    <div style={{ fontSize: 10, color: D.cyan, fontWeight: 700, marginTop: 3 }}>Decision Root</div>
                  </>
                )}

                {/* Main branch nodes (N_TREND, N_BREAK, N_REVERSAL) */}
                {isMainBranch && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.45, color: '#ffffff' }}>{node.title}</div>
                    <div style={{ fontSize: 10, color: scenarioColor, fontWeight: 700, marginTop: 2 }}>{node.titleEn}</div>
                    <div style={{ fontSize: 11, color: scenarioColor, marginTop: 3, fontWeight: 800 }}>{nodeDisplayValues[node.id] ?? ''}</div>
                  </>
                )}

                {/* Sub-branch decision nodes (Layer 2: N_T_BULL, N_B_UP, N_R_BULL, etc.) */}
                {isSubBranch && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.45, color: '#ffffff' }}>{node.title}</div>
                    <div style={{ fontSize: 9, color: scenarioColor, fontWeight: 700, marginTop: 1 }}>{node.titleEn}</div>
                    <div style={{ fontSize: 10, color: '#d4e8f0', marginTop: 2 }}>{nodeDisplayValues[node.id] ?? ''}</div>
                  </>
                )}

                {/* Event/assessment nodes (Layer 3: N_T_B_MOM_HIGH, etc.) */}
                {isEventNode && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.35, color: '#ffffff' }}>{node.title}</div>
                    <div style={{ fontSize: 9, color: scenarioColor, fontWeight: 700, marginTop: 1 }}>{node.titleEn}</div>
                  </>
                )}

                {/* Terminal result nodes (SC1-SC9) */}
                {isResultNode && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.4, color: '#ffffff' }}>{SCENARIO_META_LOCAL[node.id]?.label ?? node.title}</div>
                    {scenarioProb !== null && (
                      <span style={{
                        display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 999,
                        background: `${scenarioColor}30`, color: '#ffffff',
                        fontSize: 16, fontWeight: 900,
                        textShadow: `0 0 8px ${scenarioColor}88`,
                      }}>{toFa(scenarioProb)}٪</span>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Legend */}
          <div style={{
            position: 'absolute', right: 17, bottom: 15, padding: 10,
            border: `1px solid ${D.line}`, borderRadius: 10,
            background: 'rgba(7,17,27,.8)', fontSize: 10, color: '#ffffff', lineHeight: 2,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.cyan }} />پیروی از روند</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.gold }} />شکست</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.purple }} />بازگشت</div>
            <div style={{ borderTop: `1px solid ${D.line}`, margin: '4px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.up }} />صعودی</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.pullback }} />خنثی / رنج</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.down }} />نزولی</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.risk }} />شوک / ریسک</div>
          </div>
        </div>
      </div>

      {/* ═══ Scenario Result Cards ═══ */}
      <div style={{
        marginTop: 16, padding: 18,
        border: `1px solid ${D.line}`, borderRadius: 16,
        background: 'rgba(8,22,35,.76)',
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 13px', color: D.text }}>گره‌های نتیجه و سهم استراتژی‌ها</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {SCENARIO_KEYS.map(key => {
            const s = scenarios[key];
            if (!s) return null;
            const meta = SCENARIO_META_LOCAL[key];
            const contrib = pathContributions[key] ?? { trend: 0, breakout: 0, reversal: 0 };
            return (
              <div
                key={key}
                style={{
                  border: `1px solid ${meta.color}`,
                  background: `linear-gradient(160deg, ${meta.color}1f, rgba(8,22,35,.65))`,
                  borderRadius: 12, padding: 12,
                }}
              >
                <strong style={{ display: 'block', color: meta.color, fontSize: 21, fontWeight: 900, marginBottom: 5 }}>{toFa(s.probability)}٪</strong>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{meta.label}</span>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {Object.entries(BRANCH_META).map(([bKey, bMeta]) => (
                    <div key={bKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9 }}>
                      <span style={{ color: '#e0eaf0', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: bMeta.color }} />
                        {bMeta.label}
                      </span>
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>
                        {toPersianDigits((contrib[bKey as 'trend' | 'breakout' | 'reversal'] * 100).toFixed(1))}٪
                      </span>
                    </div>
                  ))}
                </div>
                <small style={{ display: 'block', color: '#e0eaf0', fontSize: 10, lineHeight: 1.7, marginTop: 7 }} dir="ltr">
                  {toFa(s.targetMin)} — {toFa(s.targetMax)}
                </small>
              </div>
            );
          })}
        </div>
        <div style={{
          marginTop: 15, padding: '12px 15px',
          borderRight: `3px solid ${D.gold}`,
          background: 'rgba(255,177,27,.06)',
          color: '#e0eaf0', fontSize: 11, lineHeight: 2,
        }}>
          <b>محدودیت مدل:</b> احتمال‌های سناریو توسط موتور محاسباتی سرور محاسبه شده‌اند. هر استراتژی ۹ یال شرطی دارد و مجموع ۲۷ مسیر، احتمال نهایی هر سناریو را تشکیل می‌دهد.
        </div>
      </div>

      {/* ═══ Cumulative Probability Line Chart ═══ */}
      <CumulativeProbabilityChart data={correctedTrend} />

      {/* ═══ Per-Scenario Individual + Cumulative Trend Charts ═══ */}
      <PerScenarioTrendCharts data={correctedTrend} />

      {/* ═══ Probability Trend Table ═══ */}
      <ProbabilityTrendTable data={correctedTrend} />

      {/* ═══ Professional Narrative Text ═══ */}
      <DecisionGraphNarrative
        symbolName={symbolName}
        currentPrice={currentPrice}
        currencyUnit={props.currencyUnit ?? 'ریال'}
        scenarios={scenarios}
        decisionGraph={decisionGraph}
        probabilityTrend={correctedTrend}
        branchProbs={branchProbs}
        pathContributions={pathContributions}
        scenarioProbabilities={scenarioProbabilities}
      />

      {/* ═══ AI Decision Graph Analysis ═══ */}
      <DecisionGraphAIAnalysis
        symbolName={symbolName}
        currentPrice={currentPrice}
        currencyUnit={props.currencyUnit ?? 'ریال'}
        scenarios={scenarios}
        decisionGraph={decisionGraph}
        probabilityTrend={correctedTrend}
        rsi={props.rsi}
        adx={props.adx}
        atr={props.atr ?? 0}
        trendDirection={props.trendDirection}
        bullScore={props.bullScore}
        resistances={props.resistances}
        supports={props.supports}
        instrumentType={props.instrumentType}
        instrumentCategory={props.instrumentCategory}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Narrative Generation (deterministic, algorithmic Persian text)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateDecisionGraphNarrative(p: {
  symbolName: string;
  currentPrice: number;
  currencyUnit: string;
  scenarios: VdssGraphProps['scenarios'];
  decisionGraph: GraphData | null;
  probabilityTrend: ProbabilityTrendResult | null;
  branchProbs: { trend: number; breakout: number; reversal: number };
  pathContributions: Record<string, { trend: number; breakout: number; reversal: number }>;
  scenarioProbabilities: Record<string, number>;
}): string {
  const { symbolName, currentPrice, currencyUnit, scenarios, decisionGraph, probabilityTrend, branchProbs, pathContributions, scenarioProbabilities } = p;
  const fa = (n: number) => toPersianDigits(Math.round(n).toLocaleString('en-US'));
  const faPct = (n: number) => toPersianDigits((n * 100).toFixed(1));
  const faPct0 = (n: number) => toPersianDigits((n * 100).toFixed(0));

  const lines: string[] = [];

  // ── 1. Graph explanation ──
  lines.push(`گراف تصمیم: ${symbolName}`);
  lines.push('');
  lines.push('گراف تصمیم یک مدل محاسباتی بر پایه گراف جریانی مسیردار (DAG) است که برای تخمین احتمال 9 سناریوی آینده قیمت طراحی شده است. این گراف دارای 3 شاخه اصلی استراتژی شامل پیرویی از روند، شکست و بازگشت می باشد. هر شاخه 3 زیرشاخه دارد و هر زیرشاخه 3 یال شرطی به 3 سناریوی نهایی متصل می شود که در مجموع 27 مسیر مستقل را تشکیل می دهند. احتمال نهایی هر سناریو برابر با جمع احتمالات تمامی مسیرهایی است که به آن سناریو ختم می شوند.');
  lines.push(`نقطه مرجع محاسبات: ${fa(currentPrice)} ${currencyUnit} | افق برآورد: 10 تا 25 جلسه معاملاتی.`);
  lines.push('');

  // ── 2. Exclusive probabilities ──
  const ranked = SCENARIO_KEYS.map(k => ({
    key: k,
    prob: scenarios[k as keyof typeof scenarios]?.probability ?? 0,
    label: SCENARIO_META_LOCAL[k].label,
  })).sort((a, b) => b.prob - a.prob);

  lines.push('احتمالات اختصاصی (Exclusive Probabilities)');
  lines.push('');
  lines.push('احتمال اختصاصی هر سناریو نشان دهنده احتمال وقوع دقیق آن سناریو در افق زمانی مورد نظر است. مجموع 9 احتمال باید برابر 100 درصد باشد:');
  lines.push('');

  for (const r of ranked) {
    const s = scenarios[r.key as keyof typeof scenarios];
    const targetRange = s ? `${fa(s.targetMin)} تا ${fa(s.targetMax)} ${currencyUnit}` : '';
    lines.push(`• ${r.key} — ${r.label}: ${toPersianDigits(String(r.prob))}٪ (${toPersianDigits(String(Math.round(r.prob)))} درصد)${targetRange ? ' | بازه: ' + targetRange : ''}`);
  }

  const totalProb = ranked.reduce((s, r) => s + r.prob, 0);
  lines.push(`
مجموع: ${toPersianDigits(String(totalProb))}٪ — ${totalProb === 100 ? 'صحیح' : 'خطا در مجموع'}`);
  lines.push('');

  // Interpretation of top scenario
  const topSc = ranked[0];
  if (topSc) {
    const group = SCENARIO_META[topSc.key]?.group;
    const groupLabel = group === 'bullish' ? 'گاوی' : group === 'bearish' ? 'خرسی' : 'خنثی';
    lines.push(`تفسیر: با احتمال ${toPersianDigits(String(topSc.prob))}٪، سناریو ${topSc.key} (${topSc.label}) بیشترین احتمال را دارد که در گروه ${groupLabel} قرار می گیرد. این بدان معناست که موتور تحلیلی انتظار حاصل ${topSc.label} را دارد.`);
  }
  lines.push('');

  // ── 3. Cumulative probabilities ──
  const bearishProb = ['SC1', 'SC2', 'SC3', 'SC4'].reduce((s, k) => s + (scenarios[k as keyof typeof scenarios]?.probability ?? 0), 0);
  const neutralProb = scenarios.SC5?.probability ?? 0;
  const bullishProb = ['SC6', 'SC7', 'SC8', 'SC9'].reduce((s, k) => s + (scenarios[k as keyof typeof scenarios]?.probability ?? 0), 0);

  lines.push('احتمالات تجمعی (Cumulative Probabilities)');
  lines.push('');
  lines.push('احتمال تجمعی (CDF) در این مدل به این معنی است که از شدیدترین سناریو تا سناریوی مورد نظر را جمع می کند. به عنوان مثال، CDF سناریو SC6 (صعودی خفیف) مجموع احتمالات SC9+SC8+SC7+SC6 را شامل می شود که نشان دهنده احتمال حداقل یک بار صعود خفیف یا قوی تر است.');
  lines.push('');
  lines.push(`• گروه گاوی (SC6+SC7+SC8+SC9): ${toPersianDigits(String(bullishProb))}٪ (${toPersianDigits(String(Math.round(bullishProb)))} درصد)`);
  lines.push(`• گروه خنثی (SC5): ${toPersianDigits(String(neutralProb))}٪ (${toPersianDigits(String(Math.round(neutralProb)))} درصد)`);
  lines.push(`• گروه خرسی (SC1+SC2+SC3+SC4): ${toPersianDigits(String(bearishProb))}٪ (${toPersianDigits(String(Math.round(bearishProb)))} درصد)`);
  lines.push('');

  // Interpretation
  if (bullishProb > bearishProb && bullishProb > neutralProb) {
    lines.push(`تفسیر: با احتمال تجمعی ${toPersianDigits(String(Math.round(bullishProb)))} درصد برای سناریوهای گاوی، چشم انداز بازار به سمت صعود است. بازار با احتمال ${toPersianDigits(String(Math.round(bullishProb)))} درصد حداقل یک بار صعود خفیف یا قوی تر را تجربه خواهد کرد.`);
  } else if (bearishProb > bullishProb && bearishProb > neutralProb) {
    lines.push(`تفسیر: با احتمال تجمعی ${toPersianDigits(String(Math.round(bearishProb)))} درصد برای سناریوهای خرسی، چشم انداز بازار به سمت نزول است. بازار با احتمال ${toPersianDigits(String(Math.round(bearishProb)))} درصد حداقل یک بار نزول خفیف یا قوی تر را تجربه خواهد کرد.`);
  } else {
    lines.push(`تفسیر: بازار در وضعیت تعادل قرار دارد. احتمال گروه گاوی ${toPersianDigits(String(Math.round(bullishProb)))} درصد و گروه خرسی ${toPersianDigits(String(Math.round(bearishProb)))} درصد است که فاصله کمی بین آنها نشان دهنده عدم تعیین بازار است.`);
  }
  lines.push('');

  // ── 4. Probability trends ──
  if (probabilityTrend && probabilityTrend.scenarios && probabilityTrend.scenarios.length === 9 && probabilityTrend.scenarios[0]?.trend?.length > 1) {
    lines.push('روند احتمالات (30 روزه)');
    lines.push('');
    lines.push('بررسی روند 30 روزه احتمالات نشان می دهد که کدام سناریوها در حال تقویت و کدام در حال تضعیف هستند:');
    lines.push('');

    const rising: string[] = [];
    const falling: string[] = [];
    const stable: string[] = [];
    const volatile: string[] = [];

    for (const sc of probabilityTrend.scenarios) {
      const meta = SCENARIO_META_LOCAL[sc.scenarioKey];
      const entry = `${sc.scenarioKey} (${meta?.label ?? sc.label})`;
      if (sc.trendDirection === 'rising') rising.push(entry);
      else if (sc.trendDirection === 'falling') falling.push(entry);
      else if (sc.trendDirection === 'stable') stable.push(entry);
      else volatile.push(entry);
    }

    if (rising.length > 0) {
      lines.push(`• سناریوهای صعودی (تقویت شده): ${rising.join('، ')}`);
    }
    if (falling.length > 0) {
      lines.push(`• سناریوهای نزولی (تضعیف شده): ${falling.join('، ')}`);
    }
    if (stable.length > 0) {
      lines.push(`• سناریوهای پایدار: ${stable.join('، ')}`);
    }
    if (volatile.length > 0) {
      lines.push(`• سناریوهای ناپایدار: ${volatile.join('، ')}`);
    }
    lines.push('');

    // Group trends
    if (probabilityTrend.groups && probabilityTrend.groups.length === 3) {
      lines.push('روند گروه‌ها:');
      for (const g of probabilityTrend.groups) {
        const dirLabel = g.trendDirection === 'rising' ? 'صعودی' : g.trendDirection === 'falling' ? 'نزولی' : g.trendDirection === 'volatile' ? 'ناپایدار' : 'پایدار';
        const gLabel = g.group === 'bullish' ? 'گاوی' : g.group === 'bearish' ? 'خرسی' : 'خنثی';
        lines.push(`• گروه ${gLabel}: روند ${dirLabel} | احتمال اختصاصی فعلی: ${faPct(g.trend[0]?.individualProb ?? 0)} درصد`);
      }
      lines.push('');
    }
  }

  // ── 5. Branch contributions ──
  lines.push('سهم استراتژی‌ها (Branch Contributions)');
  lines.push('');
  lines.push(`در این مدل، هر سناریو از سه مسیر مستقل غیرمتقاطع تغذیه می شود. سهم هر استراتژی نشان می دهد که چند درصد از احتمال نهایی سناریو از آن استراتژی تامین شده است.`);
  lines.push('');
  lines.push(`احتمال شاخه‌ها: پیرویی از روند ${faPct0(branchProbs.trend)}٪، شکست ${faPct0(branchProbs.breakout)}٪، بازگشت ${faPct0(branchProbs.reversal)}٪`);
  lines.push('');

  for (const key of SCENARIO_KEYS) {
    const contrib = pathContributions[key] ?? { trend: 0, breakout: 0, reversal: 0 };
    const meta = SCENARIO_META_LOCAL[key];
    const s = scenarios[key as keyof typeof scenarios];
    lines.push(`${key} (${meta?.label ?? ''}): پیرویی از روند ${faPct(contrib.trend)}٪، شکست ${faPct(contrib.breakout)}٪، بازگشت ${faPct(contrib.reversal)}٪ — احتمال نهایی: ${toPersianDigits(String(s?.probability ?? 0))}٪`);
  }
  lines.push('');

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Narrative Display Component
// ═══════════════════════════════════════════════════════════════════════════════

function DecisionGraphNarrative(p: {
  symbolName: string;
  currentPrice: number;
  currencyUnit: string;
  scenarios: VdssGraphProps['scenarios'];
  decisionGraph: GraphData | null;
  probabilityTrend: ProbabilityTrendResult | null;
  branchProbs: { trend: number; breakout: number; reversal: number };
  pathContributions: Record<string, { trend: number; breakout: number; reversal: number }>;
  scenarioProbabilities: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const narrative = useMemo(() => generateDecisionGraphNarrative(p), [p]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} dir="rtl">
      <CollapsibleTrigger
        className="w-full mt-4 flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer hover:opacity-90 transition-opacity"
        style={{
          border: `1px solid ${D.line}`,
          background: 'linear-gradient(105deg, rgba(14,35,53,.94), rgba(8,22,35,.77))',
          boxShadow: D.shadow,
        }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: 40, height: 40, display: 'grid', placeItems: 'center',
            border: '1px solid rgba(160,74,197,.7)', borderRadius: 12,
            color: D.purple, fontSize: 20,
            boxShadow: 'inset 0 0 22px rgba(160,74,197,.12), 0 0 22px rgba(160,74,197,.08)',
          }}>متن</div>
          <div className="text-right">
            <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0 }}>متن تخصصی تحلیل گراف تصمیم</h2>
            <p style={{ fontSize: 11, color: D.muted, margin: '3px 0 0' }}>توضیحات احتمالات، روندها و سهم استراتژی‌ها</p>
          </div>
        </div>
        <span style={{ color: D.muted, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div style={{
          marginTop: 8, padding: '18px 22px',
          border: `1px solid ${D.line}`, borderRadius: 16,
          background: 'rgba(8,22,35,.76)',
        }}>
          <pre style={{
            fontFamily: 'inherit', fontSize: 13, lineHeight: 2.2,
            color: D.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
            direction: 'rtl', textAlign: 'right',
          }}>{narrative}</pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// Advanced Algorithmic Decision Graph Analysis
// ═══════════════════════════════════════════════════════════════════════════════

function generateAdvancedDGAnalysis(p: {
  symbolName: string;
  currentPrice: number;
  currencyUnit: string;
  scenarios: VdssGraphProps['scenarios'];
  decisionGraph: GraphData | null;
  probabilityTrend: ProbabilityTrendResult | null;
  rsi: number;
  adx: number;
  atr: number;
  trendDirection: string;
  bullScore: number;
  resistances: number[];
  supports: number[];
  instrumentType?: string;
  instrumentCategory?: string;
}): string {
  const { symbolName, currentPrice, currencyUnit, scenarios, decisionGraph, probabilityTrend,
    rsi, adx, atr, trendDirection, bullScore, resistances, supports, instrumentCategory } = p;

  const unit = currencyUnit || 'ریال';
  const fa = (n: number) => toPersianDigits(Math.round(n).toLocaleString('en-US'));
  const pctW = (n: number) => `${toPersianDigits(String(Math.round(n)))} درصد`;
  const pctFrac = (n: number) => `${toPersianDigits(String(Math.round(n * 100)))} درصد`;

  // ── Compute derived data ──
  const ranked = SCENARIO_KEYS.map(k => ({
    key: k,
    prob: scenarios[k as keyof typeof scenarios]?.probability ?? 0,
    label: SCENARIO_META_LOCAL[k].label,
    group: SCENARIO_META[k]?.group ?? 'neutral',
    targetMin: scenarios[k as keyof typeof scenarios]?.targetMin ?? 0,
    targetMax: scenarios[k as keyof typeof scenarios]?.targetMax ?? 0,
  })).sort((a, b) => b.prob - a.prob);

  const bearProb = ranked.filter(r => r.group === 'bearish').reduce((s, r) => s + r.prob, 0);
  const bullProb = ranked.filter(r => r.group === 'bullish').reduce((s, r) => s + r.prob, 0);
  const neutProb = ranked.filter(r => r.group === 'neutral').reduce((s, r) => s + r.prob, 0);

  const branchProbs = decisionGraph?.branchProbabilities ?? { trend: 0.333, breakout: 0.333, reversal: 0.334 };
  const pathContribs = decisionGraph?.pathContributions ?? {} as Record<string, { trend: number; breakout: number; reversal: number }>;

  const topSc = ranked[0];
  const secondSc = ranked[1];
  const topGroup = topSc?.group ?? 'neutral';
  const topGroupLabel = topGroup === 'bullish' ? 'گاوی' : topGroup === 'bearish' ? 'خرسی' : 'خنثی';

  const R1 = resistances[0] ?? 0;
  const S1 = supports[0] ?? 0;
  const rrRatio = (R1 > 0 && S1 > 0 && currentPrice > S1)
    ? ((R1 - currentPrice) / (currentPrice - S1)).toFixed(1) : null;

  const rsiZone = rsi > 70 ? 'اشباع خرید' : rsi > 60 ? 'نزدیک اشباع خرید' : rsi < 30 ? 'اشباع فروش' : rsi < 40 ? 'نزدیک اشباع فروش' : 'منطقه نرمال';
  const adxStrength = adx > 40 ? 'روند قدرتمند' : adx > 25 ? 'روند متوسط' : 'روند ضعیف یا رنج';
  const atrPct = currentPrice > 0 ? (atr / currentPrice * 100).toFixed(1) : '0';
  const volLevel = parseFloat(atrPct) > 3 ? 'نوسان بالا' : parseFloat(atrPct) > 1.5 ? 'نوسان متوسط' : 'نوسان کم';

  // Branch dominance
  const branches = [
    { key: 'trend', label: 'پیروی از روند', prob: branchProbs.trend, color: 'emerald' as const },
    { key: 'breakout', label: 'شکست', prob: branchProbs.breakout, color: 'amber' as const },
    { key: 'reversal', label: 'بازگشت', prob: branchProbs.reversal, color: 'purple' as const },
  ].sort((a, b) => b.prob - a.prob);
  const dominantBranch = branches[0];
  const weakBranch = branches[2];

  // Probability trend analysis
  const risingScs: string[] = [];
  const fallingScs: string[] = [];
  const stableScs: string[] = [];
  if (probabilityTrend?.scenarios?.length === 9) {
    for (const sc of probabilityTrend.scenarios) {
      const meta = SCENARIO_META_LOCAL[sc.scenarioKey];
      const entry = `${meta?.label ?? sc.label}`;
      if (sc.trendDirection === 'rising') risingScs.push(entry);
      else if (sc.trendDirection === 'falling') fallingScs.push(entry);
      else stableScs.push(entry);
    }
  }

  // Dominant branch contribution to top scenarios
  const topScContrib = pathContribs[topSc?.key ?? 'SC5'] ?? { trend: 0, breakout: 0, reversal: 0 };
  const topScDominantStrategy = Object.entries(topScContrib).sort(([,a],[,b]) => (b as number) - (a as number))[0];
  const topScDominantLabel = topScDominantStrategy?.[0] === 'trend' ? 'پیروی از روند'
    : topScDominantStrategy?.[0] === 'breakout' ? 'شکست' : 'بازگشت';

  // ── Build analysis paragraphs ──
  const paragraphs: string[] = [];

  // ── Title ──
  paragraphs.push(`**تحلیل پیشرفته گراف تصمیم ${symbolName}** ⚡`);
  paragraphs.push('');

  // ── Paragraph 1: Graph structure & overall picture ──
  const p1Parts: string[] = [];
  p1Parts.push(`گراف تصمیم ${symbolName} در نقطه مرجع {color:green}${fa(currentPrice)} ${unit}{/color} یک مدل تحلیلی سه لایه با {color:blue}${toPersianDigits(String(27))} مسیر مستقل{/color} است که از ترکیب 3 استراتژی اصلی شامل پیروی از روند، شکست و بازگشت تشکیل شده است.`);

  if (topSc) {
    p1Parts.push(`سناریوی غالب با احتمال {color:${topGroup === 'bullish' ? 'green' : topGroup === 'bearish' ? 'red' : 'amber'}}${pctW(topSc.prob)}{/color}، **${topSc.label}** است که در گروه {color:${topGroup === 'bullish' ? 'green' : topGroup === 'bearish' ? 'red' : 'amber'}}${topGroupLabel}{/color} قرار می گیرد.`);
  }

  if (secondSc) {
    p1Parts.push(`سناریوی دوم با ${pctW(secondSc.prob)} احتمال، ${secondSc.label} می باشد و فاصله احتمالی بین دو سناریوی اول و دوم برابر ${toPersianDigits(String(Math.round(topSc.prob - secondSc.prob)))} درصد است${(topSc.prob - secondSc.prob) > 10 ? ' که نشان دهنده تمرکز بالای احتمالات است' : ''}.`);
  }

  p1Parts.push(`مجموع احتمال گروه گاوی {color:green}${pctW(bullProb)}{/color}، گروه خنثی ${pctW(neutProb)} و گروه خرسی {color:red}${pctW(bearProb)}{/color} محاسبه شده است.`);

  if (bullProb > bearProb + 0.2) {
    p1Parts.push(`اختلاف قابل توجه ${toPersianDigits(String(Math.round(bullProb - bearProb)))} درصدی بین گروه گاوی و خرسی، چشم انداز صعودی بازار را تایید می کند.`);
  } else if (bearProb > bullProb + 0.2) {
    p1Parts.push(`اختلاف ${toPersianDigits(String(Math.round(bearProb - bullProb)))} درصدی به نفع گروه خرسی، هشدار جدی برای معاملات خرید صادر می کند.`);
  } else {
    p1Parts.push(`فاصله کم بین گروه گاوی و خرسی نشان دهنده **عدم قطعیت بازار** و لزوم مدیریت ریسک دقیق است.`);
  }

  paragraphs.push(p1Parts.join(' '));
  paragraphs.push('');

  // ── Paragraph 2: Branch strategy analysis ──
  const p2Parts: string[] = [];
  p2Parts.push(`در ساختار درختی گراف تصمیم، استراتژی **${dominantBranch.label}** با سهم {color:${dominantBranch.color}}${pctFrac(dominantBranch.prob)}{/color} بیشترین تاثیر را در تعیین سناریوهای نهایی دارد.`);

  if (weakBranch) {
    p2Parts.push(`در مقابل، استراتژی ${weakBranch.label} تنها ${pctFrac(weakBranch.prob)} سهم دارد که نشان می دهد بازار کمتر انتظار ${weakBranch.key === 'reversal' ? 'واگرایی و بازگشت' : weakBranch.key === 'breakout' ? 'شکست سطوح' : 'ادامه روند'} را دارد.`);
  }

  // Which branch feeds the top scenario most
  p2Parts.push(`بررسی سهم استراتژی‌ها در سناریوی غالب (${topSc?.label}) نشان می دهد که ${topScDominantLabel} با سهم ${pctFrac(topScContrib[topScDominantStrategy?.[0] as 'trend' | 'breakout' | 'reversal'] ?? 0)} بیشترین نقش را ایفا می کند.`);

  // Branch-specific insights
  if (branchProbs.trend > 0.45) {
    p2Parts.push(`غلبگی استراتژی پیروی از روند (${pctFrac(branchProbs.trend)}) تایید می کند که بازار در فاز **رونددار** قرار دارد و تحلیل بر اساس ادامه مسیر فعلی قابل اتکاتر است.`);
  } else if (branchProbs.breakout > 0.4) {
    p2Parts.push(`سهم بالای استراتژی شکست (${pctFrac(branchProbs.breakout)}) هشدار می دهد که احتمال **حرکات شارپ و خارج از محدوده** وجود دارد و نوسان گیری ممکن است ریسک بالایی داشته باشد.`);
  } else if (branchProbs.reversal > 0.4) {
    p2Parts.push(`سهم بالای استراتژی بازگشت (${pctFrac(branchProbs.reversal)}) نشان دهنده **احتمال تغییر فاز بازار** است و معامله گران باید با احتیاط بیشتری عمل کنند.`);
  }

  paragraphs.push(p2Parts.join(' '));
  paragraphs.push('');

  // ── Paragraph 3: Risk/Reward + Indicators context ──
  const p3Parts: string[] = [];

  if (R1 > 0 && S1 > 0) {
    p3Parts.push(`نزدیک ترین مقاومت در سطح {color:red}${fa(R1)} ${unit}{/color} و نزدیک ترین حمایت در سطح {color:green}${fa(S1)} ${unit}{/color} قرار دارد.`);
    if (rrRatio) {
      const rrColor = parseFloat(rrRatio) >= 2 ? 'green' : parseFloat(rrRatio) >= 1 ? 'amber' : 'red';
      p3Parts.push(`نسبت ریسک به بازده بر اساس این سطوح برابر {color:${rrColor}}${toPersianDigits(rrRatio)}{/color} محاسبه شده که ${parseFloat(rrRatio) >= 2 ? 'شرایط معاملاتی مطلوبی را نشان می دهد' : parseFloat(rrRatio) >= 1 ? 'شرایط متعادلی حاکم است' : 'نسبت ریسک بالاتر از بازده مورد انتظار است و احتیاط لازم می باشد'}.`);
    }
  }

  p3Parts.push(`اندیکاتور قدرت نسبی در ناحیه **${rsiZone}** (${toPersianDigits(String(Math.round(rsi)))}) قرار دارد. شاخص جهت دار با مقدار ${toPersianDigits(String(Math.round(adx)))} نشان دهنده **${adxStrength}** است. میانگین نوسانات روزانه بر اساس اندیکاتور واقعی، حدود ${toPersianDigits(atrPct)} درصد قیمت جاری است که به معنای **${volLevel}** می باشد.`);

  if (rsi > 70 && topGroup === 'bullish') {
    p3Parts.push(`اگرچه اندیکاتور قدرت نسبی در منطقه اشباع خرید قرار دارد، اما ساختار گراف تصمیم همچنان سناریوهای گاوی را با احتمال بالاتر نشان می دهد که نشان دهنده **قدرت خریداران** حتی در شرایط اشباع است.`);
  } else if (rsi < 30 && topGroup === 'bearish') {
    p3Parts.push(`قرارگیری اندیکاتور قدرت نسبی در اشباع فروش همسو با ساختار خرسی گراف تصمیم است و احتمال **ادامه فشار فروش** در کوتاه مدت وجود دارد.`);
  } else if (rsi > 60 && trendDirection === 'up' && adx > 25) {
    p3Parts.push(`ترکیب اندیکاتور قدرت نسبی بالاتر از 60، روند صعودی و شاخص جهت دار قوی، همگی تایید کننده **ادامه روند صعودی** هستند.`);
  } else if (rsi < 40 && trendDirection === 'down' && adx > 25) {
    p3Parts.push(`قرارگیری اندیکاتور قدرت نسبی زیر 40 به همراه روند نزولی و شاخص جهت دار بالای 25، الگوی **فشار فروش مستمر** را تایید می کند.`);
  }

  paragraphs.push(p3Parts.join(' '));
  paragraphs.push('');

  // ── Paragraph 4: Probability trend dynamics ──
  if (risingScs.length > 0 || fallingScs.length > 0) {
    const p4Parts: string[] = [];
    p4Parts.push(`بررسی روند 30 روزه احتمالات تغییرات مهمی را آشکار می کند. ${risingScs.length > 0 ? `سناریوهای ${risingScs.join(' و ')} در مسیر **تقویت** قرار دارند${risingScs.length >= 3 ? ' که نشانه تغییر فاز بازار است' : ''}.` : ''} ${fallingScs.length > 0 ? `سناریوهای ${fallingScs.join(' و ')} در حال **تضعیف** هستند${fallingScs.length >= 3 ? ' و احتمال وقوع آنها کاهش یافته' : ''}.` : ''}`);

    if (stableScs.length > 0) {
      p4Parts.push(`سناریوهای ${stableScs.join(' و ')} پایدار مانده اند.`);
    }

    // Group trend analysis
    if (probabilityTrend?.groups?.length === 3) {
      const bullGroup = probabilityTrend.groups.find(g => g.group === 'bullish');
      const bearGroup = probabilityTrend.groups.find(g => g.group === 'bearish');
      if (bullGroup && bearGroup) {
        const bullDir = bullGroup.trendDirection;
        const bearDir = bearGroup.trendDirection;
        if (bullDir === 'rising' && bearDir === 'falling') {
          p4Parts.push(`تقویت همزمان گروه گاوی و تضعیف گروه خرسی در 30 روز اخیر، یک **سیگنال مثبت قوی** محسوب می شود و نشان دهنده تغییر جریان سرمایه به سمت خرید است.`);
        } else if (bullDir === 'falling' && bearDir === 'rising') {
          p4Parts.push(`تقویت گروه خرسی و تضعیف گروه گاوی یک **هشدار منفی** است که ممکن است نشانه شروع فاز اصلاحی یا نزولی باشد.`);
        } else if (bullDir === 'rising' && bearDir === 'rising') {
          p4Parts.push(`تقویت همزمان هر دو گروه گاوی و خرسی نشان دهنده **افزایش نوسانات** و بلاتکلیفی بازار است.`);
        }
      }
    }

    paragraphs.push(p4Parts.join(' '));
    paragraphs.push('');
  }

  // ── Paragraph 5: Actionable insights ──
  const p5Parts: string[] = [];
  p5Parts.push(`📊 بر اساس تحلیل ساختاری گراف تصمیم ${symbolName}، ${topGroup === 'bullish' ? 'چشم انداز کلی بازار به سمت صعود متمایل است و موقعیت‌های خرید با مدیریت ریسک مناسب قابل بررسی هستند' : topGroup === 'bearish' ? 'وضعیت کلی بازار به سمت نزول متمایل است و توصیه می شود معاملات خرید با احتیاط زیادی انجام شود یا در صورت امکان از پوزیشن‌های فروش محتاطانه استفاده شود' : 'بازار در وضعیت رنج و بلاتکلیفی قرار دارد و تا روشن شدن جهت بازار، معاملات با حجم کم و حد ضرر کوتاه توصیه می شود'}.`);

  if (topSc?.targetMin && topSc?.targetMax && topSc.prob > 0.12) {
    const targetDir = topSc.targetMax > currentPrice ? 'صعودی' : 'نزولی';
    const color = targetDir === 'صعودی' ? 'green' : 'red';
    p5Parts.push(`بازه هدف سناریوی غالب ({topSc.label}): {color:${color}}${fa(topSc.targetMin)} تا ${fa(topSc.targetMax)} ${unit}{/color}.`);
  }

  if (atr > 0) {
    const slDistance = Math.round(atr * 1.5);
    p5Parts.push(`حد ضرر پیشنهادی بر اساس 1.5 برابر نوسان واقعی: حدود {color:red}${fa(currentPrice - slDistance)} ${unit}{/color}.`);
  }

  // Bull score context
  if (bullScore > 65) {
    p5Parts.push(`امتیاز صعودی ${toPersianDigits(String(Math.round(bullScore)))} از 100 تایید می کند که فشار خرید بر بازار غالب است. **توصیه عملی:** در صورت تایید ورود به نقطه حمایت، موقعیت خرید با ریسک محدود قابل اتکا است.`);
  } else if (bullScore < 35) {
    p5Parts.push(`امتیاز صعودی ${toPersianDigits(String(Math.round(bullScore)))} از 100 نشان دهنده ضعف خریداران و غلبه فشار فروش است. **توصیه عملی:** از ورود به معاملات خرید خودداری کرده و منتظر سیگنال بازگشت بمانید.`);
  } else {
    p5Parts.push(`امتیاز صعودی ${toPersianDigits(String(Math.round(bullScore)))} از 100 نشان دهنده **تعادل نسبی** بین خریداران و فروشندگان است.`);
  }

  paragraphs.push(p5Parts.join(' '));
  paragraphs.push('');

  // ── Closing line ──
  const closingColor = topGroup === 'bullish' ? 'green' : topGroup === 'bearish' ? 'red' : 'amber';
  paragraphs.push(`**خلاصه عملی:** {color:${closingColor}}${topGroup === 'bullish' ? 'گراف تصمیم چشم انداز صعودی را تایید می کند — مدیریت ریسک اولویت اول' : topGroup === 'bearish' ? 'گراف تصمیم هشدار نزولی صادر کرده — احتیاط در خرید ضروری' : 'بازار بلاتکلیف — منتظر سیگنال جهت دار بمانید'}{/color}.`);

  return paragraphs.join('\n');
}


/** Parse {color:...}text{/color} and **bold** from analysis text */
function renderDGAIText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, li) => {
    if (!line.trim()) return <br key={li} />;
    let html = line;
    html = html.replace(/\{color:([a-z]+)\}([^\{]*?)\{\/color\}/g, (_m: string, color: string, inner: string) => {
      const colorMap: Record<string, string> = {
        red: '#ef4444', green: '#22c55e', amber: '#f59e0b', blue: '#3b82f6',
        orange: '#f97316', purple: '#a855f7', emerald: '#10b981',
      };
      return '<span style="color:' + (colorMap[color] || color) + ';font-weight:700">' + inner + '</span>';
    });
    html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    const isHeading = /^\*{0,2}[^*]{3,40}:$/.test(line.trim());
    if (isHeading) {
      return <h3 key={li} style={{ fontSize: 14, fontWeight: 700, color: D.text, marginTop: 12, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: html }} />;
    }
    return <p key={li} style={{ margin: '2px 0', lineHeight: 2.1, fontSize: 13, color: D.text }} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}


function DecisionGraphAIAnalysis(p: {
  symbolName: string;
  currentPrice: number;
  currencyUnit: string;
  scenarios: VdssGraphProps['scenarios'];
  decisionGraph: GraphData | null;
  probabilityTrend: ProbabilityTrendResult | null;
  rsi: number;
  adx: number;
  atr: number;
  trendDirection: string;
  bullScore: number;
  resistances: number[];
  supports: number[];
  instrumentType?: string;
  instrumentCategory?: string;
}) {
  const [open, setOpen] = useState(false);
  const analysisText = useMemo(() => generateAdvancedDGAnalysis(p), [p]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} dir="rtl">
      <CollapsibleTrigger
        className="w-full mt-4 flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer hover:opacity-90 transition-opacity"
        style={{
          border: `1px solid ${D.line}`,
          background: 'linear-gradient(105deg, rgba(14,35,53,.94), rgba(8,22,35,.77))',
          boxShadow: D.shadow,
        }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: 40, height: 40, display: 'grid', placeItems: 'center',
            border: '1px solid rgba(52,201,139,.7)', borderRadius: 12,
            color: D.green, fontSize: 20,
            boxShadow: 'inset 0 0 22px rgba(52,201,139,.12), 0 0 22px rgba(52,201,139,.08)',
          }}>🤖</div>
          <div className="text-right">
            <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0 }}>تحلیل پیشرفته گراف تصمیم</h2>
            <p style={{ fontSize: 11, color: D.muted, margin: '3px 0 0' }}>تحلیل هوشمند مخصوص {p.symbolName} — ساختار گراف، احتمالات و استراتژی‌ها</p>
          </div>
        </div>
        <span style={{ color: D.muted, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div style={{
          marginTop: 8, padding: '18px 22px',
          border: `1px solid ${D.line}`, borderRadius: 16,
          background: 'rgba(8,22,35,.76)',
        }}>
          <div style={{ direction: 'rtl', textAlign: 'right' }}>{renderDGAIText(analysisText)}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}


// Multi-Select Scenario Trend Charts (Individual & Cumulative)
// ═══════════════════════════════════════════════════════════════════

const SCENARIO_LINE_COLORS: Record<string, string> = {
  SC1: '#b91c1c', SC2: '#dc2626', SC3: '#ea580c', SC4: '#f97316',
  SC5: '#f59e0b',
  SC6: '#65a30d', SC7: '#16a34a', SC8: '#059669', SC9: '#047857',
};

const SCENARIO_CHART_GROUP_STYLE: Record<string, { borderColor: string; headerBg: string; headerText: string; indColor: string; cumColor: string }> = {
  bearish: {
    borderColor: '#fecaca', headerBg: 'rgba(239,68,68,0.06)', headerText: '#dc2626',
    indColor: '#ef4444', cumColor: '#b91c1c',
  },
  neutral: {
    borderColor: '#fde68a', headerBg: 'rgba(245,158,11,0.06)', headerText: '#b45309',
    indColor: '#f59e0b', cumColor: '#92400e',
  },
  bullish: {
    borderColor: '#bbf7d0', headerBg: 'rgba(34,197,94,0.06)', headerText: '#16a34a',
    indColor: '#22c55e', cumColor: '#15803d',
  },
};

const GROUP_LABEL_MAP: Record<string, string> = {
  bearish: 'خرسی', neutral: 'خنثی', bullish: 'گاوی',
};

function PerScenarioTrendCharts({ data }: { data?: ProbabilityTrendResult | null }) {
  const [open, setOpen] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(['SC1','SC2','SC3','SC4','SC5','SC6','SC7','SC8','SC9']));

  const hasData = !!(data && data.scenarios && data.scenarios.length === 9 &&
    data.scenarios[0]?.trend?.length > 1);

  const toggleKey = (k: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  if (!hasData) {
    if (!data || data.scenarios?.length === 0) return null;
    return (
      <Collapsible open={open} onOpenChange={setOpen} dir="rtl">
        <CollapsibleTrigger className="w-full mt-4 flex items-center justify-between px-4 py-3 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] cursor-pointer hover:bg-[#f9fafb] transition-colors"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-violet-200 flex items-center justify-center text-violet-800 text-xl font-bold"
              style={{ boxShadow: 'inset 0 0 22px rgba(124,58,237,.06), 0 0 22px rgba(124,58,237,.04)' }}>📈</div>
            <div className="text-right">
              <h2 className="text-sm font-bold text-[#111827]">نمودار روند احتمالات سناریوها</h2>
              <p className="text-[11px] text-[#6b7280]">احتمال اختصاصی و تجمعی هر سناریو در ۳۰ روز گذشته</p>
            </div>
          </div>
          <span className={`text-[#6b7280] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-6 text-center"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)', minHeight: 200 }}>
            <p className="text-sm text-[#6b7280]">داده کافی برای نمایش روند ۳۰ روزه موجود نیست</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} dir="rtl">
      <CollapsibleTrigger className="w-full mt-4 flex items-center justify-between px-4 py-3 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] cursor-pointer hover:bg-[#f9fafb] transition-colors"
        style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border border-violet-200 flex items-center justify-center text-violet-800 text-xl font-bold"
            style={{ boxShadow: 'inset 0 0 22px rgba(124,58,237,.06), 0 0 22px rgba(124,58,237,.04)' }}>📈</div>
          <div className="text-right">
            <h2 className="text-sm font-bold text-[#111827]">نمودار روند احتمالات سناریوها</h2>
            <p className="text-[11px] text-[#6b7280]">نمودارهای تفاعلی با قابلیت مولتی‌سِلکت برای مقایسه سناریوها</p>
          </div>
        </div>
        <span className={`text-[#6b7280] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-3 space-y-3">
          {/* Chart 1: Individual Probability Trends */}
          <MultiSelectTrendChart
            data={data}
            selectedKeys={selectedKeys}
            onToggleKey={toggleKey}
            mode="individual"
            title="روند احتمالات اختصاصی سناریوها"
          />
          {/* Chart 2: Cumulative Probability Trends */}
          <MultiSelectTrendChart
            data={data}
            selectedKeys={selectedKeys}
            onToggleKey={toggleKey}
            mode="cumulative"
            title="روند احتمالات تجمعی سناریوها (CDF)"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MultiSelectTrendChart({ data, selectedKeys, onToggleKey, mode, title }: {
  data: ProbabilityTrendResult;
  selectedKeys: Set<string>;
  onToggleKey: (k: string) => void;
  mode: 'individual' | 'cumulative';
  title: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const scenarios = data.scenarios.filter(s => selectedKeys.has(s.scenarioKey));
  const maxDays = data.scenarios[0]?.trend?.length ?? 0;

  // Compute Y range — dynamic based on selected scenarios
  let yMin = 0;
  let yMax = 0;
  for (const sc of scenarios) {
    for (const d of sc.trend) {
      const v = mode === 'individual' ? d.individualProb : d.cumulativeProb;
      if (v > yMax) yMax = v;
    }
  }
  // For cumulative mode, ensure minimum range
  if (yMax <= 0) yMax = 0.1;

  // Compute nice tick interval for Y-axis
  const range = yMax - yMin;
  const padding = range * 0.15;
  const paddedMax = yMax + padding;
  const paddedMin = Math.max(0, yMin - padding * 0.3);

  // Find a nice step: aim for ~5 grid lines
  const niceSteps = [0.01, 0.02, 0.025, 0.05, 0.1, 0.15, 0.2, 0.25, 0.5, 1.0];
  const rawStep = (paddedMax - paddedMin) / 5;
  let step = niceSteps[0];
  for (const ns of niceSteps) {
    if (ns >= rawStep) { step = ns; break; }
  }
  // Round yMin down and yMax up to step boundaries
  const gridYMin = Math.floor(paddedMin / step) * step;
  const gridYMax = Math.ceil(paddedMax / step) * step;
  const gridRange = gridYMax - gridYMin;

  const chartW = 1100;
  const chartH = 300;
  const padL = 55;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const xOf = (day: number) => padL + plotW - ((day - 1) / Math.max(1, maxDays - 1)) * plotW;
  const yOf = (v: number) => padT + plotH - ((v - gridYMin) / Math.max(0.001, gridRange)) * plotH;

  // Dynamic grid lines based on computed range
  const gridEls: React.JSX.Element[] = [];
  for (let v = gridYMin; v <= gridYMax + step * 0.01; v += step) {
    const y = yOf(v);
    if (y < padT - 2 || y > chartH - padB + 2) continue;
    const pctVal = v * 100;
    const pctLabel = Number.isInteger(pctVal) ? String(pctVal) : pctVal.toFixed(step < 0.05 ? 2 : 1);
    gridEls.push(
      <line key={`g${v}`} x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#f3f4f6" strokeWidth={0.7} />,
      <text key={`gl${v}`} x={padL - 6} y={y + 3.5} textAnchor="end" fill="#9ca3af" fontSize={9} fontFamily="inherit">
        {toPersianDigits(pctLabel)}%
      </text>,
    );
  }
  for (let d = 1; d <= maxDays; d += 5) {
    gridEls.push(
      <text key={`xl${d}`} x={xOf(d)} y={chartH - 8} textAnchor="middle" fill="#9ca3af" fontSize={8} fontFamily="inherit">
        {toPersianDigits(String(d))}
      </text>,
    );
  }

  // Vertical hover line
  const hoverEl = hoveredDay ? (
    <line x1={xOf(hoveredDay)} y1={padT} x2={xOf(hoveredDay)} y2={chartH - padB} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3,3" opacity={0.6} />
  ) : null;

  // Tooltip
  const tooltipEl = hoveredDay ? (
    <div
      ref={tooltipRef}
      className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-[10px] pointer-events-none"
      style={{ left: xOf(hoveredDay) + 10, top: padT }}
      dir="rtl"
    >
      <div className="font-bold text-[#374151] mb-1">روز {toPersianDigits(String(hoveredDay))}</div>
      {scenarios.map(sc => {
        const dp = sc.trend.find(d => d.day === hoveredDay);
        if (!dp) return null;
        const val = mode === 'individual' ? dp.individualProb : dp.cumulativeProb;
        const color = SCENARIO_LINE_COLORS[sc.scenarioKey] || '#9ca3af';
        return (
          <div key={sc.scenarioKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
              <span>{sc.label}</span>
            </span>
            <span className="font-bold" style={{ color }}>{toPersianDigits((val * 100).toFixed(1))}%</span>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-[#ffffff] overflow-hidden"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
      {/* Header + Legend row */}
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-xs font-bold text-[#111827] mb-2">{title}</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {data.scenarios.map(sc => {
            const color = SCENARIO_LINE_COLORS[sc.scenarioKey] || '#9ca3af';
            const isActive = selectedKeys.has(sc.scenarioKey);
            const trendIcon = sc.trendDirection === 'rising' ? '↑' : sc.trendDirection === 'falling' ? '↓' : '→';
            const curVal = sc.trend[0] ? (mode === 'individual' ? sc.trend[0].individualProb : sc.trend[0].cumulativeProb) : 0;
            return (
              <button
                key={sc.scenarioKey}
                onClick={() => onToggleKey(sc.scenarioKey)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium transition-all cursor-pointer ${
                  isActive ? 'border-gray-300 bg-gray-50' : 'border-transparent bg-gray-100 opacity-40'
                }`}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-[#374151]">{sc.scenarioKey}</span>
                <span style={{ color }}>{trendIcon}</span>
                {isActive && <span className="text-[#6b7280]">{toPersianDigits((curVal * 100).toFixed(1))}%</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart area */}
      <div className="relative" style={{ overflowX: 'auto' }}>
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${chartW} ${chartH}`}
          style={{ minWidth: 500, display: 'block' }}
          onMouseMove={(e) => {
            if (!svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            const scaleX = chartW / rect.width;
            const svgX = (e.clientX - rect.left) * scaleX;
            // Find closest day
            let closestDay = 1;
            let closestDist = Infinity;
            for (let d = 1; d <= maxDays; d++) {
              const dist = Math.abs(xOf(d) - svgX);
              if (dist < closestDist) { closestDist = dist; closestDay = d; }
            }
            if (closestDist < 30) setHoveredDay(closestDay); else setHoveredDay(null);
          }}
          onMouseLeave={() => setHoveredDay(null)}
        >
          <rect x={0} y={0} width={chartW} height={chartH} fill="#fafafa" />
          {gridEls}
          <line x1={padL} y1={padT} x2={padL} y2={chartH - padB} stroke="#d1d5db" strokeWidth={0.7} />
          <line x1={padL} y1={chartH - padB} x2={chartW - padR} y2={chartH - padB} stroke="#d1d5db" strokeWidth={0.7} />
          {hoverEl}
          {scenarios.map(sc => {
            const color = SCENARIO_LINE_COLORS[sc.scenarioKey] || '#9ca3af';
            const points = sc.trend.map(d => {
              const v = mode === 'individual' ? d.individualProb : d.cumulativeProb;
              return `${xOf(d.day).toFixed(1)},${yOf(v).toFixed(1)}`;
            }).join(' ');
            const lastDp = sc.trend[0];
            const lastV = lastDp ? (mode === 'individual' ? lastDp.individualProb : lastDp.cumulativeProb) : 0;
            return (
              <g key={sc.scenarioKey}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.9}
                />
                {lastDp && (
                  <circle cx={xOf(1)} cy={yOf(lastV)} r={3.5} fill={color} stroke="#ffffff" strokeWidth={1.5} />
                )}
              </g>
            );
          })}
        </svg>
        {tooltipEl}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cumulative Probability Line Chart (Pure SVG)
// ═══════════════════════════════════════════════════════════════════════════════

function CumulativeProbabilityChart({ data }: { data?: ProbabilityTrendResult | null }) {
  const [open, setOpen] = useState(true);

  const hasData = data && data.groups && data.groups.length === 3 &&
    data.groups[0].trend.length > 1;

  if (!hasData) {
    if (!data || data.groups?.length === 0) return null;
    return (
      <Collapsible open={open} onOpenChange={setOpen} dir="rtl">
        <CollapsibleTrigger className="w-full mt-4 flex items-center justify-between px-4 py-3 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] cursor-pointer hover:bg-[#f9fafb] transition-colors"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-emerald-200 flex items-center justify-center text-emerald-800 text-xl font-bold"
              style={{ boxShadow: 'inset 0 0 22px rgba(5,150,105,.06), 0 0 22px rgba(5,150,105,.04)' }}>📊</div>
            <div className="text-right">
              <h2 className="text-sm font-bold text-[#111827]">نمودار روند احتمالات گروه‌ها</h2>
              <p className="text-[11px] text-[#6b7280]">احتمال اختصاصی سناریوها + تجمعی گروه‌ها</p>
            </div>
          </div>
          <span className={`text-[#6b7280] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-6 text-center"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)', minHeight: 200 }}>
            <p className="text-sm text-[#6b7280]">داده کافی برای نمایش روند ۳۰ روزه موجود نیست</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const groupMap = Object.fromEntries(data.groups.map(g => [g.group, g])) as Record<string, typeof data.groups[number]>;
  const scenarioMap = Object.fromEntries(data.scenarios.map(s => [s.scenarioKey, s])) as Record<string, typeof data.scenarios[number]>;
  const bull = groupMap['bullish'];
  const neut = groupMap['neutral'];
  const bear = groupMap['bearish'];
  if (!bull || !neut || !bear) return null;

  const maxDays = Math.max(bull.trend.length, neut.trend.length, bear.trend.length);

  // Chart dimensions
  const chartW = 1100;
  const chartH = 260;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const xOf = (day: number) => padL + plotW - ((day - 1) / Math.max(1, maxDays - 1)) * plotW;
  const yOf = (pct: number) => padT + plotH - pct * plotH;

  const lineColor = (g: 'bullish' | 'neutral' | 'bearish') =>
    g === 'bullish' ? '#16a34a' : g === 'neutral' ? '#b45309' : '#dc2626';

  const buildGroupLine = (trend: DayPoint[], group: string) => {
    const color = lineColor(group as 'bullish' | 'neutral' | 'bearish');
    const points = trend.map(d => `${xOf(d.day).toFixed(1)},${yOf(d.cumulativeProb).toFixed(1)}`).join(' ');
    return (
      <g key={`grp-${group}`}>
        <polyline points={points} fill="none" stroke={color} strokeWidth={2.8} strokeLinejoin="round" strokeLinecap="round" opacity={0.95} />
        {trend.map(d => (
          <circle key={d.day} cx={xOf(d.day)} cy={yOf(d.cumulativeProb)} r={2.5} fill={color} stroke="#ffffff" strokeWidth={1} />
        ))}
      </g>
    );
  };

  const buildScenarioLine = (key: string) => {
    const sc = scenarioMap[key];
    if (!sc) return null;
    const color = SCENARIO_LINE_COLORS[key] || '#9ca3af';
    const points = sc.trend.map(d => `${xOf(d.day).toFixed(1)},${yOf(d.individualProb).toFixed(1)}`).join(' ');
    return <polyline key={`sc-${key}`} points={points} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} strokeDasharray="3,2" />;
  };

  // Grid
  const gridLines: React.JSX.Element[] = [];
  for (let p = 0; p <= 100; p += 20) {
    const y = yOf(p / 100);
    gridLines.push(
      <line key={`grid-${p}`} x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#e5e7eb" strokeWidth={0.8} />,
      <text key={`ylbl-${p}`} x={padL - 8} y={y + 3.5} textAnchor="end" fill="#6b7280" fontSize={10} fontFamily="inherit">{toPersianDigits(p.toString())}٪</text>,
    );
  }

  const xLabels: React.JSX.Element[] = [];
  for (let d = 1; d <= maxDays; d += 5) {
    xLabels.push(
      <text key={`xlbl-${d}`} x={xOf(d)} y={chartH - padB + 18} textAnchor="middle" fill="#6b7280" fontSize={10} fontFamily="inherit">{toPersianDigits(d.toString())}</text>,
    );
  }

  const bearishKeys = ['SC1', 'SC2', 'SC3', 'SC4'];
  const bullishKeys = ['SC9', 'SC8', 'SC7', 'SC6'];

  return (
    <Collapsible open={open} onOpenChange={setOpen} dir="rtl">
      <CollapsibleTrigger className="w-full mt-4 flex items-center justify-between px-4 py-3 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] cursor-pointer hover:bg-[#f9fafb] transition-colors"
        style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border border-emerald-200 flex items-center justify-center text-emerald-800 text-xl font-bold"
            style={{ boxShadow: 'inset 0 0 22px rgba(5,150,105,.06), 0 0 22px rgba(5,150,105,.04)' }}>📊</div>
          <div className="text-right">
            <h2 className="text-sm font-bold text-[#111827]">نمودار روند احتمالات گروه‌ها</h2>
            <p className="text-[11px] text-[#6b7280]">احتمال اختصاصی سناریوها + تجمعی گروه‌ها</p>
          </div>
        </div>
        <span className={`text-[#6b7280] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-4 overflow-x-auto" style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
          <div className="mb-3">
            <div className="flex items-center justify-center gap-5 mb-1.5">
              {([
                ['bullish', 'گاوی (تجمعی)', '#16a34a'],
                ['neutral', 'خنثی (تجمعی)', '#b45309'],
                ['bearish', 'خرسی (تجمعی)', '#dc2626'],
              ] as const).map(([g, label, color]) => (
                <div key={g} className="flex items-center gap-1.5">
                  <span className="inline-block w-5 h-[3px] rounded" style={{ background: color }} />
                  <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-[9px] text-[#9ca3af]">اختصاصی:</span>
              {bearishKeys.map(k => (
                <div key={k} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-[1px] rounded" style={{ background: SCENARIO_LINE_COLORS[k], opacity: 0.6 }} />
                  <span className="text-[8px]" style={{ color: SCENARIO_LINE_COLORS[k] }}>{k}</span>
                </div>
              ))}
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-[1px] rounded" style={{ background: SCENARIO_LINE_COLORS['SC5'], opacity: 0.6 }} />
                <span className="text-[8px]" style={{ color: SCENARIO_LINE_COLORS['SC5'] }}>SC5</span>
              </div>
              {bullishKeys.map(k => (
                <div key={k} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-[1px] rounded" style={{ background: SCENARIO_LINE_COLORS[k], opacity: 0.6 }} />
                  <span className="text-[8px]" style={{ color: SCENARIO_LINE_COLORS[k] }}>{k}</span>
                </div>
              ))}
            </div>
          </div>
          <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ minWidth: 700, maxHeight: 320 }}>
            <rect x={0} y={0} width={chartW} height={chartH} fill="#ffffff" rx={4} />
            {gridLines}
            <line x1={padL} y1={padT} x2={padL} y2={chartH - padB} stroke="#9ca3af" strokeWidth={1} />
            <line x1={padL} y1={chartH - padB} x2={chartW - padR} y2={chartH - padB} stroke="#9ca3af" strokeWidth={1} />
            {xLabels}
            <text x={chartW / 2} y={chartH - 4} textAnchor="middle" fill="#9ca3af" fontSize={10} fontFamily="inherit">روز (۱ = امروز)</text>
            {bearishKeys.map(buildScenarioLine)}
            {buildScenarioLine('SC5')}
            {bullishKeys.map(buildScenarioLine)}
            {buildGroupLine(bull.trend, 'bullish')}
            {buildGroupLine(neut.trend, 'neutral')}
            {buildGroupLine(bear.trend, 'bearish')}
          </svg>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Probability Trend Table (30 days, all scenarios, individual + cumulative)
// ═══════════════════════════════════════════════════════════════════════════════

const TREND_GROUP_COLOR: Record<string, { bg: string; text: string; badge: string }> = {
  bearish: { bg: 'rgba(239,68,68,0.06)', text: '#dc2626', badge: 'rgba(239,68,68,0.12)' },
  neutral: { bg: 'rgba(107,114,128,0.06)', text: '#6b7280', badge: 'rgba(107,114,128,0.12)' },
  bullish: { bg: 'rgba(22,163,74,0.06)', text: '#16a34a', badge: 'rgba(22,163,74,0.12)' },
};

const TREND_GROUP_LABEL: Record<string, string> = {
  bearish: 'خرسی',
  neutral: 'خنثی',
  bullish: 'گاوی',
};

function ProbabilityTrendTable({ data }: { data?: ProbabilityTrendResult | null }) {
  const { colors: C } = useTheme();
  const [open, setOpen] = useState(true);

  const hasData = !!(data && data.scenarios && data.scenarios.length > 0 &&
    (data.scenarios[0]?.trend?.length ?? 0) > 1);

  // Build scenario lookup (computed inline, React Compiler auto-memoizes)
  const scenarioMap: Record<string, ProbabilityTrendResult['scenarios'][number]> = {};
  if (data?.scenarios) {
    for (const s of data.scenarios) scenarioMap[s.scenarioKey] = s;
  }

  // Group map
  const groupMap: Record<string, ProbabilityTrendResult['groups'][number]> = {};
  if (data?.groups) {
    for (const g of data.groups) groupMap[g.group] = g;
  }

  const totalDays = data?.scenarios?.[0]?.trend?.length ?? 30;
  const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);
  const getDay = useCallback((trend: DayPoint[], day: number) =>
    trend.find(d => d.day === day), []);
  const fmtPct = (v: number) => toPersianDigits((v * 100).toFixed(2)) + '٪';

  if (!hasData) {
    return (
      <Collapsible open={open} onOpenChange={setOpen} dir="rtl">
        <CollapsibleTrigger className="w-full mt-4 flex items-center justify-between px-4 py-3 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] cursor-pointer hover:bg-[#f9fafb] transition-colors"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-emerald-200 flex items-center justify-center text-emerald-800 text-xl font-bold"
              style={{ boxShadow: 'inset 0 0 22px rgba(5,150,105,.06), 0 0 22px rgba(5,150,105,.04)' }}>📈</div>
            <div className="text-right">
              <h2 className="text-sm font-bold text-[#111827]">روند ۳۰ روزه احتمالات</h2>
              <p className="text-[11px] text-[#6b7280]">توزیع روزانه احتمال سناریوها</p>
            </div>
          </div>
          <span className={`text-[#6b7280] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-6 text-center"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
            <p className="text-sm text-[#6b7280]">داده کافی برای نمایش روند ۳۰ روزه موجود نیست</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} dir="rtl">
      <CollapsibleTrigger className="w-full mt-4 flex items-center justify-between px-4 py-3 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] cursor-pointer hover:bg-[#f9fafb] transition-colors"
        style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border border-emerald-200 flex items-center justify-center text-emerald-800 text-xl font-bold"
            style={{ boxShadow: 'inset 0 0 22px rgba(5,150,105,.06), 0 0 22px rgba(5,150,105,.04)' }}>📈</div>
          <div className="text-right">
            <h2 className="text-sm font-bold text-[#111827]">روند ۳۰ روزه احتمالات</h2>
            <p className="text-[11px] text-[#6b7280]">توزیع روزانه احتمال سناریوها — احتمال اختصاصی و تجمعی CDF</p>
          </div>
        </div>
        <span className={`text-[#6b7280] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-4 overflow-x-auto"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
          <Table style={{ fontSize: 10, minWidth: 1200 }}>
            <TableHeader>
              <TableRow className="border-b border-[#e5e7eb]">
                <TableHead className="text-right text-[#374151] font-bold px-2 py-2 min-w-[120px]" style={{ fontSize: 10 }}>سناریو</TableHead>
                {allDays.map(day => (
                  <TableHead key={day} colSpan={2} className="text-center text-[#374151] font-bold px-0.5 py-1.5 border-r border-[#e5e7eb]" style={{ fontSize: 9 }}>
                    {toPersianDigits(day.toString())}
                  </TableHead>
                ))}
              </TableRow>
              <TableRow className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                <TableHead className="px-2 py-1" style={{ fontSize: 9 }} />
                {allDays.map(day => (
                  <React.Fragment key={day}>
                    <TableHead className="text-center text-[#6b7280] font-medium px-0.5 py-0.5" style={{ fontSize: 8 }}>اختصاصی</TableHead>
                    <TableHead className="text-center text-[#6b7280] font-medium px-0.5 py-0.5" style={{ fontSize: 8 }}>تجمعی</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Scenario rows */}
              {['SC1','SC2','SC3','SC4','SC5','SC6','SC7','SC8','SC9'].map(key => {
                const sc = scenarioMap[key];
                if (!sc) return null;
                const gc = TREND_GROUP_COLOR[sc.group];
                return (
                  <TableRow key={key} className="border-b border-[#e5e7eb]/60 hover:bg-[#f9fafb]">
                    <TableCell className="px-2 py-1 font-bold" style={{ color: gc.text, minWidth: 100, fontSize: 10 }}>
                      <span className="inline-block w-2 h-2 rounded-full ml-1" style={{ background: gc.text }} />
                      {key} — {sc.label}
                    </TableCell>
                    {allDays.map(day => {
                      const dp = getDay(sc.trend, day);
                      const isPeak = sc.peakDay === day;
                      return (
                        <React.Fragment key={day}>
                          <TableCell
                            className={`text-center px-0.5 py-0.5 tabular-nums ${isPeak ? 'font-black' : 'font-medium'}`}
                            style={isPeak ? { background: gc.badge, color: gc.text, borderRadius: 3, fontSize: 9 } : { color: '#374151', fontSize: 9 }}
                          >
                            {dp ? fmtPct(dp.individualProb) : '—'}
                          </TableCell>
                          <TableCell
                            className={`text-center px-0.5 py-0.5 tabular-nums ${isPeak ? 'font-black' : 'font-medium'}`}
                            style={isPeak ? { background: gc.badge, color: gc.text, borderRadius: 3, fontSize: 9 } : { color: '#6b7280', fontSize: 9 }}
                          >
                            {dp ? fmtPct(dp.cumulativeProb) : '—'}
                          </TableCell>
                        </React.Fragment>
                      );
                    })}
                  </TableRow>
                );
              })}

              {/* Separator row */}
              <TableRow>
                <TableCell className="py-1" colSpan={1 + allDays.length * 2} style={{ borderBottom: '2px solid #e5e7eb' }} />
              </TableRow>

              {/* Group cumulative rows: Bullish, Neutral, Bearish */}
              {(['bearish', 'neutral', 'bullish'] as const).map(g => {
                const gData = groupMap[g];
                if (!gData) return null;
                const gc = TREND_GROUP_COLOR[g];
                return (
                  <TableRow key={`grp-${g}`} className="border-b border-[#e5e7eb]/40">
                    <TableCell className="px-2 py-1.5 font-bold" style={{ color: gc.text, fontSize: 10 }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full ml-1" style={{ background: gc.text }} />
                      تجمعی {TREND_GROUP_LABEL[g]}
                    </TableCell>
                    {allDays.map(day => {
                      const dp = getDay(gData.trend, day);
                      return (
                        <TableCell key={day} colSpan={2} className="text-center px-0.5 py-1 tabular-nums font-bold" style={{ color: gc.text, fontSize: 9 }}>
                          {dp ? fmtPct(dp.cumulativeProb) : '—'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}

              {/* Sum verification row */}
              <TableRow className="bg-[#f3f4f6]">
                <TableCell className="px-2 py-1.5 font-black" style={{ color: '#111827', fontSize: 10 }}>
                  مجموع سه گروه
                </TableCell>
                {allDays.map(day => {
                  const bCum = getDay(groupMap['bearish']?.trend ?? [], day)?.cumulativeProb ?? 0;
                  const nCum = getDay(groupMap['neutral']?.trend ?? [], day)?.cumulativeProb ?? 0;
                  const buCum = getDay(groupMap['bullish']?.trend ?? [], day)?.cumulativeProb ?? 0;
                  const total = bCum + nCum + buCum;
                  const isOk = Math.abs(total - 1.0) < 0.001;
                  return (
                    <TableCell key={day} colSpan={2} className="text-center px-0.5 py-1 tabular-nums font-black" style={{
                      color: isOk ? '#059669' : '#dc2626',
                      fontSize: 9,
                    }}>
                      {fmtPct(total)}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>

          <div className="mt-3 space-y-2">
            <div className="px-4 py-2.5 rounded-lg border-r-3 border-emerald-700/60 bg-emerald-50 text-[11px] text-[#374151] leading-relaxed">
              <b>توضیح:</b> احتمال اختصاصی = احتمال وقوع سناریو در آن روز خاص.
              احتمال تجمعی (CDF) = مجموع احتمال از شدیدترین سناریو تا این سناریو در همان روز.
              صعودی: از شوک صعودی (SC9) تجمعی تا صعودی خفیف (SC6) — هرچه قوی‌تر، احتمال تجمعی بیشتر.
              نزولی: از شوک نزولی (SC1) تجمعی تا نزولی خفیف (SC4) — هرچه قوی‌تر، احتمال تجمعی بیشتر.
              ردیف «مجموع سه گروه» باید همیشه ۱۰۰٪ باشد.
            </div>
            {data.scenarios.filter(s => s.interpretation).map(s => (
              <div key={s.scenarioKey} className="px-4 py-1.5 text-[10px] text-[#6b7280]">
                <b>{s.label}:</b> {s.interpretation}
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dark Metric Card
// ═══════════════════════════════════════════════════════════════════════════════

function DarkMetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '15px 16px',
      border: `1px solid ${D.line}`, borderRadius: 14,
      background: 'linear-gradient(145deg, rgba(18,42,61,.85), rgba(9,24,38,.86))',
    }}>
      <small style={{ display: 'block', color: '#ffffff', marginBottom: 8, fontSize: 12 }}>{label}</small>
      <strong style={{ fontSize: 18, letterSpacing: 0.2, color }}>{value}</strong>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════════════════════════════════

export function VdssGraphSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full rounded-2xl" style={{ background: 'rgba(13,31,47,.90)' }} />
      <div className="grid grid-cols-4 gap-3">
        <Skeleton className="h-16 rounded-xl" style={{ background: 'rgba(13,31,47,.90)' }} />
        <Skeleton className="h-16 rounded-xl" style={{ background: 'rgba(13,31,47,.90)' }} />
        <Skeleton className="h-16 rounded-xl" style={{ background: 'rgba(13,31,47,.90)' }} />
        <Skeleton className="h-16 rounded-xl" style={{ background: 'rgba(13,31,47,.90)' }} />
      </div>
      <Skeleton className="h-10 w-full rounded-t-2xl" style={{ background: 'rgba(9,24,37,.92)' }} />
      <Skeleton className="h-[500px] w-full rounded-b-2xl" style={{ background: 'rgba(4,15,25,.72)' }} />
      <Skeleton className="h-40 w-full rounded-2xl" style={{ background: 'rgba(8,22,35,.76)' }} />
    </div>
  );
}
