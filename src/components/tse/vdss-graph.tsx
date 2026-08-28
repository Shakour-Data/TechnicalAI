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
    R1: Scenario;
    R2: Scenario;
    R3: Scenario;
    R4: Scenario;
    R5: Scenario;
    R6: Scenario;
    R7: Scenario;
    R8: Scenario;
    R9: Scenario;
  };
  decisionGraph: GraphData | null;
  probabilityTrend?: ProbabilityTrendResult | null;
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
  R1: { label: 'شوک نزولی', color: '#b91c1c' },
  R2: { label: 'نزولی شتاب‌دار', color: '#dc2626' },
  R3: { label: 'نزولی قوی', color: '#ea580c' },
  R4: { label: 'نزولی خفیف', color: '#c2410c' },
  R5: { label: 'رنج', color: '#b45309' },
  R6: { label: 'صعودی خفیف', color: '#047857' },
  R7: { label: 'صعودی قوی', color: '#059669' },
  R8: { label: 'صعودی شتاب‌دار', color: '#0e7490' },
  R9: { label: 'شوک صعودی', color: '#0891b2' },
};

const SCENARIO_DISPLAY: Record<string, string> = {
  ROOT: 'ریشه',
  BR1: 'پیروی از روند', BR2: 'شکست', BR3: 'بازگشت',
  EA: 'وضعیت روند', EB: 'وضعیت شکست', EC: 'وضعیت واگرایی',
  R1: 'سناریوی ۱', R2: 'سناریوی ۲', R3: 'سناریوی ۳',
  R4: 'سناریوی ۴', R5: 'سناریوی ۵', R6: 'سناریوی ۶',
  R7: 'سناریوی ۷', R8: 'سناریوی ۸', R9: 'سناریوی ۹',
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
    const observer = new ResizeObserver(() => drawEdges());
    observer.observe(el);
    return () => observer.disconnect();
  }, [drawEdges]);


  // ── Detail panel content ─────────────────────────────────────────
  const detailContent = useMemo(() => {
    if (!selectedNode) return null;
    const node = nodeMap[selectedNode];
    if (!node) return null;

    if (node.isTerminal && SCENARIO_KEYS.includes(selectedNode as typeof SCENARIO_KEYS[number])) {
      const contrib = pathContributions[selectedNode] ?? { trend: 0, breakout: 0, reversal: 0 };
      const meta = SCENARIO_META_LOCAL[selectedNode];
      const s = scenarios[selectedNode as keyof typeof scenarios];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: meta.color }}>{node.title}</h3>
          <p style={{ fontSize: '12px', color: '#ffffff', lineHeight: 1.95, margin: 0 }}>{node.desc}</p>
          <span style={{
            display: 'inline-block', padding: '4px 8px', margin: '3px 2px', borderRadius: 8,
            color: '#ffffff', fontSize: '10px',
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)',
          }}>{node.type === 'decision' ? 'گره تصمیم‌گیری' : node.type === 'event' ? 'گره رویداد شانسی' : 'گره نتیجه'}</span>
          <div style={{ fontSize: '12px', color: meta.color, fontWeight: 700 }}>{toFa(scenarioProb)}٪</div>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${D.line}` }}>
            <p style={{ fontSize: '12px', fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>سهم هر استراتژی:</p>
            {Object.entries(BRANCH_META).map(([bKey, bMeta]) => {
              const val = contrib[bKey as 'trend' | 'breakout' | 'reversal'];
              const pct = (val * 100).toFixed(1);
              return (
                <div key={bKey} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 0', borderBottom: '1px dashed rgba(255,255,255,.12)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: bMeta.color }} />
                    <span style={{ fontSize: '11px', color: '#ffffff' }}>{bMeta.label}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: bMeta.color }}>{toPersianDigits(pct)}٪</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>مجموع</span>
              <span style={{ fontSize: '11px', fontWeight: 900, color: meta.color }}>{toFa(s?.probability ?? 0)}٪</span>
            </div>
          </div>
        </div>
      );
    }

    const inputs = edges.filter(e => e.to === selectedNode);
    const outputs = edges.filter(e => e.from === selectedNode);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#ffffff' }}>{node.title}</h3>
        <p style={{ fontSize: '12px', color: '#ffffff', lineHeight: 1.95, margin: 0 }}>{node.desc}</p>
        <span style={{
          display: 'inline-block', padding: '4px 8px', margin: '3px 2px', borderRadius: 8,
          color: '#ffffff', fontSize: '10px',
          background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)',
        }}>{node.type === 'decision' ? 'گره تصمیم‌گیری' : node.type === 'event' ? 'گره رویداد شانسی' : 'گره نتیجه'}</span>
        {inputs.length > 0 && (
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: 4, color: '#ffffff' }}>مسیرهای ورودی ({toFa(inputs.length)}):</p>
            <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
              {inputs.map((e, i) => {
                const ep = edgeProbabilities[edges.indexOf(e)] ?? 0;
                const edgeColor = EDGE_COLORS[e.type] ?? '#6b7280';
                return (
                  <li key={i} style={{
                    padding: '9px 0', borderTop: '1px dashed rgba(255,255,255,.12)',
                    fontSize: '11px', lineHeight: 1.8, color: '#e0eaf0',
                  }}>
                    <b style={{ color: '#ffffff' }}>{SCENARIO_DISPLAY[e.from] || e.from} ← {SCENARIO_DISPLAY[e.to] || e.to}</b>
                    <span style={{
                      marginRight: 8, padding: '2px 6px', borderRadius: 4,
                      fontSize: '9px', fontWeight: 700,
                      background: `${edgeColor}22`, color: edgeColor,
                    }}>{toPersianDigits((ep * 100).toFixed(1))}٪</span>
                    <br />{e.label}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {outputs.length > 0 && (
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: 4, color: '#ffffff' }}>مسیرهای خروجی ({toFa(outputs.length)}):</p>
            <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
              {outputs.map((e, i) => {
                const ep = edgeProbabilities[edges.indexOf(e)] ?? 0;
                const edgeColor = EDGE_COLORS[e.type] ?? '#6b7280';
                return (
                  <li key={i} style={{
                    padding: '9px 0', borderTop: '1px dashed rgba(255,255,255,.12)',
                    fontSize: '11px', lineHeight: 1.8, color: '#e0eaf0',
                  }}>
                    <b style={{ color: '#ffffff' }}>{SCENARIO_DISPLAY[e.from] || e.from} → {SCENARIO_DISPLAY[e.to] || e.to}</b>
                    <span style={{
                      marginRight: 8, padding: '2px 6px', borderRadius: 4,
                      fontSize: '9px', fontWeight: 700,
                      background: `${edgeColor}22`, color: edgeColor,
                    }}>{toPersianDigits((ep * 100).toFixed(1))}٪</span>
                    <br />{e.label}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }, [selectedNode, nodeMap, edges, edgeProbabilities, pathContributions, scenarios]);

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
        groupCumDay1 = calculateCDF('R6', day1AllInds);
      } else if (g.group === 'bearish') {
        groupCumDay1 = calculateCDF('R4', day1AllInds);
      } else {
        groupCumDay1 = day1AllInds['R5'] ?? 0;
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

    // Terminal nodes (R1-R9): handled by the big badge, no extra text
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
        <DarkMetricCard label="مقدار مرجع" value={toFa(currentPrice) + ' ریال'} color={D.cyan} />
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3.5">
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

                  {/* Terminal result nodes (R1-R9) */}
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

        {/* ═══ Right Panel: Scenario Probabilities & Detail ═══ */}
        <div style={{
          border: `1px solid ${D.line}`, borderRadius: 15,
          background: 'linear-gradient(160deg, rgba(16,39,57,.93), rgba(7,19,31,.93))',
          padding: 16, boxShadow: D.shadow,
          display: 'flex', flexDirection: 'column',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#ffffff' }}>📋 احتمال سناریوها</h2>

          {selectedNode && detailContent ? (
            <div style={{ borderTop: `1px solid ${D.line}`, paddingTop: 12, flex: 1, overflowY: 'auto', maxHeight: 860 }}>
              {detailContent}
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SCENARIO_KEYS.map(key => {
                  const meta = SCENARIO_META_LOCAL[key];
                  const prob = scenarioProbabilities[key] ?? 0;
                  const isActive = activeFilter === key;
                  const s = scenarios[key as keyof typeof scenarios];
                  return (
                    <div
                      key={key}
                      onClick={() => { setActiveFilter(key); setSelectedNode(null); }}
                      style={{
                        cursor: 'pointer', transition: 'all .2s',
                        borderRadius: 12, padding: 12,
                        border: `1px solid ${isActive ? meta.color + 'cc' : D.line}`,
                        background: isActive
                          ? `linear-gradient(160deg, ${meta.color}1f, rgba(8,22,35,.65))`
                          : D.panel2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{meta.label}</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: meta.color }}>{toPersianDigits((prob * 100).toFixed(1))}٪</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 999, marginBottom: 8, background: 'rgba(255,255,255,.08)' }}>
                        <div style={{
                          height: '100%', borderRadius: 999, transition: 'all .3s',
                          width: `${Math.min(100, prob * 100)}%`, background: meta.color,
                        }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: '#e0eaf0' }}>
                        <span>تجمیعی: <b style={{ color: '#ffffff' }}>{toFa(s?.probability ?? 0)}٪</b></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: `1px solid ${D.line}`, paddingTop: 12, marginTop: 4 }}>
                <p style={{ fontSize: 10, color: '#e0eaf0', lineHeight: 2, margin: 0 }}>
                  <b style={{ color: '#ffffff' }}>ساختار:</b> ۳ استراتژی × ۹ یال = ۲۷ مسیر مستقیم.<br />
                  <b style={{ color: '#ffffff' }}>احتمال یال:</b> محاسبه‌شده از موتور تصمیم (backend).<br />
                  <b style={{ color: '#ffffff' }}>احتمال مسیر:</b> P(استراتژی) × P(یال|استراتژی).<br />
                  <b style={{ color: '#ffffff' }}>احتمال سناریو:</b> تجمیع ۳ مسیر هر سناریو.
                </p>
              </div>
            </div>
          )}
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-Select Scenario Trend Charts (Individual & Cumulative)
// ═══════════════════════════════════════════════════════════════════════════════

const SCENARIO_LINE_COLORS: Record<string, string> = {
  R1: '#b91c1c', R2: '#dc2626', R3: '#ea580c', R4: '#f97316',
  R5: '#f59e0b',
  R6: '#65a30d', R7: '#16a34a', R8: '#059669', R9: '#047857',
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
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(['R1','R2','R3','R4','R5','R6','R7','R8','R9']));

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

  const bearishKeys = ['R1', 'R2', 'R3', 'R4'];
  const bullishKeys = ['R9', 'R8', 'R7', 'R6'];

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
                <span className="inline-block w-3 h-[1px] rounded" style={{ background: SCENARIO_LINE_COLORS['R5'], opacity: 0.6 }} />
                <span className="text-[8px]" style={{ color: SCENARIO_LINE_COLORS['R5'] }}>R5</span>
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
            {buildScenarioLine('R5')}
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
              {['R1','R2','R3','R4','R5','R6','R7','R8','R9'].map(key => {
                const sc = scenarioMap[key];
                if (!sc) return null;
                const gc = TREND_GROUP_COLOR[sc.group];
                return (
                  <TableRow key={key} className="border-b border-[#e5e7eb]/60 hover:bg-[#f9fafb]">
                    <TableCell className="px-2 py-1 font-bold" style={{ color: gc.text, minWidth: 100, fontSize: 10 }}>
                      <span className="inline-block w-2 h-2 rounded-full ml-1" style={{ background: gc.text }} />
                      {sc.label}
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
              صعودی: از شوک صعودی (R9) تجمعی تا صعودی خفیف (R6) — هرچه قوی‌تر، احتمال تجمعی بیشتر.
              نزولی: از شوک نزولی (R1) تجمعی تا نزولی خفیف (R4) — هرچه قوی‌تر، احتمال تجمعی بیشتر.
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
