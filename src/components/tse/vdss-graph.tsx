'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toPersianDigits } from '@/lib/jalali';
import { type GraphData } from '@/lib/decision-graph';
import { type ProbabilityTrendResult, type DayPoint } from '@/lib/probability-trend';
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

const SCENARIO_KEYS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'] as const;

const SCENARIO_META: Record<string, { label: string; color: string }> = {
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
  const nodeValues = decisionGraph?.nodeValues ?? {};

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
      // Show edges going TO this scenario node, plus their source nodes
      const edgeSet = new Set<number>();
      const nodeSet = new Set<string>(['ROOT', activeFilter]);
      edges.forEach((e, i) => {
        if (e.to === activeFilter) {
          edgeSet.add(i);
          nodeSet.add(e.from);
        }
      });
      // Also show intermediate nodes connected to those sources
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
        if (e.type === branchType || (e.type !== `branch-trend` && e.type !== `branch-breakout` && e.type !== `branch-reversal` && nodeSet.has(e.from))) {
          // Include branch-type edges
          if (e.type === branchType) {
            edgeSet.add(i);
            nodeSet.add(e.from);
            nodeSet.add(e.to);
          }
        }
      });
      // Now add all edges whose source is already in nodeSet
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

      // Curved edges with bend proportional to distance
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

      // Edge labels — skip deterministic root→branch and branch→event edges (index < 6)
      if (isVisible && ei >= 6) {
        pathsSvg += `<text x="${cx}" y="${cy - 5}" fill="#cde4ef" font-size="10" text-anchor="middle" paint-order="stroke" stroke="#07111b" stroke-width="4" stroke-linejoin="round" opacity="0.9" data-type="${type}" class="edge-label">${label}</text>`;
        pathsSvg += `<text x="${cx}" y="${cy + 7}" fill="${edgeColor}" font-size="9" font-weight="bold" text-anchor="middle" paint-order="stroke" stroke="#07111b" stroke-width="3" stroke-linejoin="round" opacity="0.85" class="edge-prob">${probLabel}</text>`;
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

    // For terminal scenario nodes, show branch breakdown
    if (node.isTerminal && SCENARIO_KEYS.includes(selectedNode as typeof SCENARIO_KEYS[number])) {
      const contrib = pathContributions[selectedNode] ?? { trend: 0, breakout: 0, reversal: 0 };
      const meta = SCENARIO_META[selectedNode];
      const s = scenarios[selectedNode as keyof typeof scenarios];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: meta.color }}>{node.title}</h3>
          <p style={{ fontSize: '12px', color: '#c4d8e3', lineHeight: 1.95, margin: 0 }}>{node.desc}</p>
          <span style={{
            display: 'inline-block', padding: '4px 8px', margin: '3px 2px', borderRadius: 8,
            color: '#d7eaf1', fontSize: '10px',
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)',
          }}>{node.type === 'decision' ? 'گره تصمیم‌گیری' : node.type === 'event' ? 'گره رویداد شانسی' : 'گره نتیجه'}</span>
          <div style={{ fontSize: '12px', color: '#c4d8e3' }} dir="ltr">{nodeValues[selectedNode] ?? '--'}</div>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${D.line}` }}>
            <p style={{ fontSize: '12px', fontWeight: 700, marginBottom: 8, color: '#d8eff9' }}>سهم هر استراتژی:</p>
            {Object.entries(BRANCH_META).map(([bKey, bMeta]) => {
              const val = contrib[bKey as 'trend' | 'breakout' | 'reversal'];
              const pct = (val * 100).toFixed(1);
              return (
                <div key={bKey} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 0', borderBottom: `1px dashed rgba(175,210,225,.15)`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: bMeta.color }} />
                    <span style={{ fontSize: '11px', color: '#d8eff9' }}>{bMeta.label}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: bMeta.color }}>{toPersianDigits(pct)}٪</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#d8eff9' }}>مجموع</span>
              <span style={{ fontSize: '11px', fontWeight: 900, color: meta.color }}>{toFa(s?.probability ?? 0)}٪</span>
            </div>
          </div>
        </div>
      );
    }

    // For non-terminal nodes, show incoming/outgoing edges
    const inputs = edges.filter(e => e.to === selectedNode);
    const outputs = edges.filter(e => e.from === selectedNode);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#d8eff9' }}>{node.title}</h3>
        <p style={{ fontSize: '12px', color: '#c4d8e3', lineHeight: 1.95, margin: 0 }}><b>مقدار / وضعیت:</b> {nodeValues[selectedNode] ?? '--'}</p>
        <span style={{
          display: 'inline-block', padding: '4px 8px', margin: '3px 2px', borderRadius: 8,
          color: '#d7eaf1', fontSize: '10px',
          background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)',
        }}>{node.type === 'decision' ? 'گره تصمیم‌گیری' : node.type === 'event' ? 'گره رویداد شانسی' : 'گره نتیجه'}</span>
        <p style={{ fontSize: '12px', color: '#c4d8e3', lineHeight: 1.95, margin: 0 }}>{node.desc}</p>
        {inputs.length > 0 && (
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: 4, color: '#d8eff9' }}>مسیرهای ورودی ({toFa(inputs.length)}):</p>
            <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
              {inputs.map((e, i) => {
                const ep = edgeProbabilities[edges.indexOf(e)] ?? 0;
                const edgeColor = EDGE_COLORS[e.type] ?? '#6b7280';
                return (
                  <li key={i} style={{
                    padding: '9px 0', borderTop: '1px dashed rgba(175,210,225,.15)',
                    fontSize: '11px', lineHeight: 1.8, color: '#b8cfdb',
                  }}>
                    <b style={{ color: '#d8eff9' }}>{SCENARIO_DISPLAY[e.from] || e.from} ← {SCENARIO_DISPLAY[e.to] || e.to}</b>
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
            <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: 4, color: '#d8eff9' }}>مسیرهای خروجی ({toFa(outputs.length)}):</p>
            <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
              {outputs.map((e, i) => {
                const ep = edgeProbabilities[edges.indexOf(e)] ?? 0;
                const edgeColor = EDGE_COLORS[e.type] ?? '#6b7280';
                return (
                  <li key={i} style={{
                    padding: '9px 0', borderTop: '1px dashed rgba(175,210,225,.15)',
                    fontSize: '11px', lineHeight: 1.8, color: '#b8cfdb',
                  }}>
                    <b style={{ color: '#d8eff9' }}>{SCENARIO_DISPLAY[e.from] || e.from} → {SCENARIO_DISPLAY[e.to] || e.to}</b>
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
  }, [selectedNode, nodeMap, nodeValues, edges, edgeProbabilities, pathContributions, scenarios]);

  // ── All filter buttons ────────────────────────────────────────────
  const allFilters = [
    ...TYPE_FILTERS,
    { key: 'sep1', label: '│', isSep: true as const },
    ...Object.entries(BRANCH_META).map(([k, v]) => ({ key: k, label: v.label, branchKey: k, branchColor: v.color })),
    { key: 'sep2', label: '│', isSep: true as const },
    ...SCENARIO_KEYS.map(k => ({ key: k, label: SCENARIO_META[k].label, scenarioKey: k })),
  ];

  // ═══ Design dimensions ═══
  const DESIGN_W = 1500;
  const DESIGN_H = 820;
  const DISPLAY_W = 1200;
  const DISPLAY_H = DESIGN_H;
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
          style={{ color: '#bbd7e8', borderRight: '1px solid rgba(58,213,219,.24)' }}>
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
          const meta = isScenario ? SCENARIO_META[(btn as { scenarioKey: string }).scenarioKey] : null;
          const bColor = isBranch ? (btn as { branchColor: string }).branchColor : null;
          const activeColor = isScenario && meta ? meta.color : isBranch && bColor ? bColor : D.cyan;
          return (
            <button
              key={btn.key}
              onClick={() => setActiveFilter(btn.key)}
              style={{
                color: isActive ? '#fff' : '#dcebf2',
                border: `1px solid ${isActive ? activeColor + 'b3' : 'rgba(159,198,218,.22)'}`,
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
            color: '#dcebf2', border: '1px solid rgba(159,198,218,.22)', borderRadius: 10,
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
          className="relative overflow-auto min-h-[790px]"
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

              const isTerminal = node.isTerminal ?? false;
              const isResultNode = SCENARIO_KEYS.includes(node.id as typeof SCENARIO_KEYS[number]);
              const isBranchNode = ['BR1', 'BR2', 'BR3'].includes(node.id);
              const isEventNode = ['EA', 'EB', 'EC'].includes(node.id);
              const isSelected = selectedNode === node.id;
              const isVisible = visibleNodes.has(node.id);
              const scenarioProb = isResultNode ? (scenarioProbabilities[node.id] ?? 0) : null;
              const scenarioColor = isResultNode ? (SCENARIO_META[node.id]?.color ?? node.color) : node.color;

              const nodeWidth = isResultNode ? 175 : isBranchNode ? 148 : isEventNode ? 160 : 148;
              const nodeMinH = isResultNode ? 94 : isBranchNode ? 80 : isEventNode ? 65 : 80;

              // Node styling based on type
              let bgStyle: string;
              let innerGlow: string;
              let baseBoxShadow: string;
              let borderW = '1px';
              let borderDash: React.CSSProperties['borderStyle'] = 'solid';

              if (node.id === 'ROOT') {
                bgStyle = 'linear-gradient(145deg, rgba(18,42,61,.97), rgba(6,21,34,.96))';
                innerGlow = `inset 0 0 22px ${scenarioColor}1f`;
                baseBoxShadow = `${innerGlow}, 0 10px 25px rgba(0,0,0,.25)`;
              } else if (isBranchNode) {
                bgStyle = 'linear-gradient(145deg, rgba(18,42,61,.97), rgba(6,21,34,.96))';
                innerGlow = `inset 0 0 22px ${scenarioColor}1f`;
                baseBoxShadow = `${innerGlow}, 0 10px 25px rgba(0,0,0,.25)`;
              } else if (isEventNode) {
                bgStyle = 'linear-gradient(145deg, rgba(18,42,61,.97), rgba(6,21,34,.96))';
                innerGlow = `inset 0 0 18px ${scenarioColor}14`;
                baseBoxShadow = `${innerGlow}, 0 8px 20px rgba(0,0,0,.22)`;
                borderDash = 'dotted';
              } else if (isTerminal) {
                bgStyle = `linear-gradient(160deg, ${scenarioColor}1f, rgba(8,22,35,.65))`;
                innerGlow = `inset 0 0 24px ${scenarioColor}18`;
                baseBoxShadow = `${innerGlow}, 0 10px 25px rgba(0,0,0,.25)`;
                borderW = '2px';
              } else {
                bgStyle = 'linear-gradient(145deg, rgba(18,42,61,.97), rgba(6,21,34,.96))';
                innerGlow = `inset 0 0 22px ${scenarioColor}14`;
                baseBoxShadow = `${innerGlow}, 0 10px 25px rgba(0,0,0,.25)`;
              }

              const selectedGlow = isSelected
                ? `0 0 0 2px ${scenarioColor}47, 0 0 28px ${scenarioColor}40`
                : baseBoxShadow;

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
                    padding: isResultNode ? '10px 9px' : '10px 9px',
                    border: `${borderW} ${borderDash} ${scenarioColor}`,
                    borderRadius: isTerminal ? 13 : 13,
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
                  {/* Root node */}
                  {node.id === 'ROOT' && (
                    <>
                      <span style={{ display: 'block', fontSize: 10, color: scenarioColor, fontWeight: 700, marginBottom: 5 }}>{node.titleEn || 'تصمیم'}</span>
                      <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.55, color: isVisible ? D.text : '#555' }}>{node.title}</div>
                      <div style={{ fontSize: 11, color: '#c6dbe6', marginTop: 4, direction: 'ltr' }}>{nodeValues[node.id] ?? '--'}</div>
                    </>
                  )}

                  {/* Branch nodes */}
                  {isBranchNode && (
                    <>
                      <span style={{ display: 'block', fontSize: 10, color: scenarioColor, fontWeight: 700, marginBottom: 5 }}>{node.type === 'decision' ? 'استراتژی' : node.titleEn}</span>
                      <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.55, color: isVisible ? D.text : '#555' }}>{node.title}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6, color: scenarioColor }}>{nodeValues[node.id] ?? '--'}</div>
                    </>
                  )}

                  {/* Event nodes */}
                  {isEventNode && (
                    <>
                      <span style={{ display: 'block', fontSize: 10, color: scenarioColor, fontWeight: 700, marginBottom: 5 }}>{node.titleEn || 'رویداد شانسی'}</span>
                      <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.55, color: isVisible ? D.text : '#555' }}>{node.title}</div>
                      <div style={{ fontSize: 11, color: '#c6dbe6', marginTop: 4, direction: 'ltr' }}>{nodeValues[node.id] ?? '--'}</div>
                    </>
                  )}

                  {/* Terminal scenario nodes */}
                  {isResultNode && (
                    <>
                      <span style={{ display: 'block', fontSize: 10, color: scenarioColor, fontWeight: 700, marginBottom: 5 }}>{SCENARIO_DISPLAY[node.id]}</span>
                      <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.55, color: isVisible ? D.text : '#555' }}>{node.title}</div>
                      <div style={{ fontSize: 11, color: '#c6dbe6', marginTop: 4, direction: 'ltr' }}>{nodeValues[node.id] ?? '--'}</div>
                      {scenarioProb !== null && (
                        <span
                          style={{
                            display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 999,
                            background: `${scenarioColor}2b`, color: scenarioColor,
                            fontSize: 15, fontWeight: 700,
                          }}
                        >{toFa(scenarioProb)}٪</span>
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
              background: 'rgba(7,17,27,.8)', fontSize: 10, color: D.muted, lineHeight: 2,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.cyan }} />پیروی از روند</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.gold }} />شکست</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.purple }} />بازگشت</div>
              <div style={{ borderTop: `1px solid ${D.line}`, margin: '4px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="dot-up" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS.up }} />صعودی</div>
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
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#d8eff9' }}>📋 احتمال سناریوها</h2>

          {selectedNode && detailContent ? (
            <div style={{ borderTop: `1px solid ${D.line}`, paddingTop: 12, flex: 1, overflowY: 'auto', maxHeight: 860 }}>
              {detailContent}
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Scenario probabilities from backend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SCENARIO_KEYS.map(key => {
                  const meta = SCENARIO_META[key];
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
                        <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: meta.color }}>{toPersianDigits((prob * 100).toFixed(1))}٪</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 999, marginBottom: 8, background: 'rgba(170,208,229,.10)' }}>
                        <div style={{
                          height: '100%', borderRadius: 999, transition: 'all .3s',
                          width: `${Math.min(100, prob * 100)}%`, background: meta.color,
                        }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: D.muted }}>
                        <span>تجمیعی: <b style={{ color: '#d8eff9' }}>{toFa(s?.probability ?? 0)}٪</b></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: `1px solid ${D.line}`, paddingTop: 12, marginTop: 4 }}>
                <p style={{ fontSize: 10, color: D.muted, lineHeight: 2, margin: 0 }}>
                  <b style={{ color: '#d8eff9' }}>ساختار:</b> ۳ استراتژی × ۹ یال = ۲۷ مسیر مستقیم.<br />
                  <b style={{ color: '#d8eff9' }}>احتمال یال:</b> محاسبه‌شده از موتور تصمیم (backend).<br />
                  <b style={{ color: '#d8eff9' }}>احتمال مسیر:</b> P(استراتژی) × P(یال|استراتژی).<br />
                  <b style={{ color: '#d8eff9' }}>احتمال سناریو:</b> تجمیع ۳ مسیر هر سناریو.
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
            const meta = SCENARIO_META[key];
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
                <span style={{ fontSize: 12, fontWeight: 700, color: D.text }}>{meta.label}</span>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {Object.entries(BRANCH_META).map(([bKey, bMeta]) => (
                    <div key={bKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9 }}>
                      <span style={{ color: D.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: bMeta.color }} />
                        {bMeta.label}
                      </span>
                      <span style={{ fontWeight: 700, color: D.text }}>
                        {toPersianDigits((contrib[bKey as 'trend' | 'breakout' | 'reversal'] * 100).toFixed(1))}٪
                      </span>
                    </div>
                  ))}
                </div>
                <small style={{ display: 'block', color: D.muted, fontSize: 10, lineHeight: 1.7, marginTop: 7 }} dir="ltr">
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
          color: '#b8cbd5', fontSize: 11, lineHeight: 2,
        }}>
          <b>محدودیت مدل:</b> احتمال‌های سناریو توسط موتور محاسباتی سرور محاسبه شده‌اند. هر استراتژی ۹ یال شرطی دارد و مجموع ۲۷ مسیر، احتمال نهایی هر سناریو را تشکیل می‌دهد.
        </div>
      </div>

      {/* ═══ Probability Trend Table ═══ */}
      {props.probabilityTrend && <ProbabilityTrendTable data={props.probabilityTrend} />}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

const TREND_DAYS = [1, 5, 10, 20, 30] as const;

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

function ProbabilityTrendTable({ data }: { data: ProbabilityTrendResult }) {
  const { colors: C } = useTheme();
  const [open, setOpen] = useState(true);

  // Build a lookup: scenarioKey -> trend array
  const scenarioMap = useMemo(() => {
    const m: Record<string, ProbabilityTrendResult['scenarios'][number]> = {};
    for (const s of data.scenarios) m[s.scenarioKey] = s;
    return m;
  }, [data.scenarios]);

  // Group map
  const groupMap = useMemo(() => {
    const m: Record<string, ProbabilityTrendResult['groups'][number]> = {};
    for (const g of data.groups) m[g.group] = g;
    return m;
  }, [data.groups]);

  // Get DayPoint by day number (1-indexed)
  const getDay = (trend: DayPoint[], day: number) =>
    trend.find(d => d.day === day);

  // Format probability as percentage string with 2 decimals
  const fmtPct = (v: number) => toPersianDigits((v * 100).toFixed(2)) + '٪';

  return (
    <Collapsible open={open} onOpenChange={setOpen} dir="rtl">
      <CollapsibleTrigger className="w-full mt-4 flex items-center justify-between px-4 py-3 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] cursor-pointer hover:bg-[#f9fafb] transition-colors"
        style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border border-emerald-200 flex items-center justify-center text-emerald-800 text-xl font-bold"
            style={{ boxShadow: 'inset 0 0 22px rgba(5,150,105,.06), 0 0 22px rgba(5,150,105,.04)' }}>📈</div>
          <div className="text-right">
            <h2 className="text-sm font-bold text-[#111827]">روند ۳۰ روزه احتمالات</h2>
            <p className="text-[11px] text-[#6b7280]">توزیع روزانه احتمال سناریوها — مدل زوال نمایی دوگانه + احتمال تجمعی CDF</p>
          </div>
        </div>
        <span className={`text-[#6b7280] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-4 overflow-x-auto"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
          <Table className="text-[11px] min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b border-[#e5e7eb]">
                <TableHead className="text-right text-[#374151] font-bold px-2 py-2 min-w-[120px]">سناریو</TableHead>
                {TREND_DAYS.map(day => (
                  <TableHead key={day} colSpan={2} className="text-center text-[#374151] font-bold px-1.5 py-2 border-r border-[#e5e7eb]">
                    روز {toPersianDigits(day.toString())}
                  </TableHead>
                ))}
                <TableHead className="text-center text-[#374151] font-bold px-2 py-2 border-r border-[#e5e7eb]">اوج</TableHead>
              </TableRow>
              <TableRow className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                <TableHead className="px-2 py-1" />
                {TREND_DAYS.map(day => (
                  <React.Fragment key={day}>
                    <TableHead className="text-center text-[10px] text-[#6b7280] font-medium px-1 py-1">اختصاصی</TableHead>
                    <TableHead className="text-center text-[10px] text-[#6b7280] font-medium px-1 py-1">تجمعی</TableHead>
                  </React.Fragment>
                ))}
                <TableHead className="text-center text-[10px] text-[#6b7280] font-medium px-2 py-1">روز</TableHead>
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
                    <TableCell className="px-2 py-1.5 font-bold" style={{ color: gc.text, minWidth: 120 }}>
                      <span className="inline-block w-2 h-2 rounded-full ml-1.5" style={{ background: gc.text }} />
                      {sc.label}
                    </TableCell>
                    {TREND_DAYS.map(day => {
                      const dp = getDay(sc.trend, day);
                      const isPeak = sc.peakDay === day;
                      return (
                        <React.Fragment key={day}>
                          <TableCell
                            className={`text-center px-1 py-1 tabular-nums ${isPeak ? 'font-black' : 'font-medium'}`}
                            style={isPeak ? { background: gc.badge, color: gc.text, borderRadius: 4 } : { color: '#374151' }}
                          >
                            {dp ? fmtPct(dp.individualProb) : '—'}
                          </TableCell>
                          <TableCell
                            className={`text-center px-1 py-1 tabular-nums ${isPeak ? 'font-black' : 'font-medium'}`}
                            style={isPeak ? { background: gc.badge, color: gc.text, borderRadius: 4 } : { color: '#6b7280' }}
                          >
                            {dp ? fmtPct(dp.cumulativeProb) : '—'}
                          </TableCell>
                        </React.Fragment>
                      );
                    })}
                    <TableCell className="text-center px-2 py-1 font-bold tabular-nums" style={{ color: gc.text }}>
                      {toPersianDigits(sc.peakDay.toString())}
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Group trend rows */}
              <TableRow className="border-t-2 border-[#e5e7eb] bg-[#f3f4f6]">
                <TableCell className="px-2 py-2 font-black text-[#111827]" colSpan={1}>
                  روند گروهی
                </TableCell>
                {TREND_DAYS.map(day => {
                  const bearG = groupMap['bearish'];
                  const neutG = groupMap['neutral'];
                  const bullG = groupMap['bullish'];
                  const bCum = getDay(bearG?.trend ?? [], day)?.cumulativeProb ?? 0;
                  const nCum = getDay(neutG?.trend ?? [], day)?.cumulativeProb ?? 0;
                  const buCum = getDay(bullG?.trend ?? [], day)?.cumulativeProb ?? 0;
                  const total = bCum + nCum + buCum;
                  const bullPct = total > 0 ? buCum / total : 0;
                  const barColor = bullPct > 0.55 ? '#16a34a' : bullPct < 0.45 ? '#dc2626' : '#6b7280';
                  return (
                    <TableCell key={day} colSpan={2} className="text-center px-1 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-12 h-1.5 rounded-full bg-[#e5e7eb] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, bullPct * 100)}%`, background: barColor }} />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: barColor }}>
                          {fmtPct(bullPct)}
                        </span>
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell className="px-2 py-2" />
              </TableRow>
              {/* Group detail rows */}
              {(['bearish', 'neutral', 'bullish'] as const).map(g => {
                const gData = groupMap[g];
                if (!gData) return null;
                const gc = TREND_GROUP_COLOR[g];
                const lastDay = getDay(gData.trend, 30);
                return (
                  <TableRow key={g} className="border-b border-[#e5e7eb]/40">
                    <TableCell className="px-2 py-1.5 font-bold" style={{ color: gc.text }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full ml-1" style={{ background: gc.text }} />
                      {TREND_GROUP_LABEL[g]}
                    </TableCell>
                    {TREND_DAYS.map(day => {
                      const dp = getDay(gData.trend, day);
                      return (
                        <TableCell key={day} colSpan={2} className="text-center px-1 py-1 tabular-nums font-medium" style={{ color: gc.text }}>
                          {dp ? fmtPct(dp.cumulativeProb) : '—'}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center px-2 py-1 font-bold tabular-nums text-[10px]" style={{ color: gc.text }}>
                      {lastDay ? fmtPct(lastDay.cumulativeProb) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-3 space-y-2">
            <div className="px-4 py-2.5 rounded-lg border-r-3 border-emerald-700/60 bg-emerald-50 text-[11px] text-[#374151] leading-relaxed">
              <b>توضیح:</b> احتمال اختصاصی = احتمال وقوع سناریو در آن روز خاص.
              احتمال تجمعی (CDF) = مجموع احتمال از ضعیف‌ترین سناریو تا این سناریو در همان روز.
              صعودی: از شوک صعودی (R9) تجمعی تا صعودی خفیف (R6) — هرچه قوی‌تر، احتمال تجمعی بیشتر.
              نزولی: از شوک نزولی (R1) تجمعی تا نزولی خفیف (R4) — هرچه قوی‌تر، احتمال تجمعی بیشتر.
              سلول‌های برجسته نشان‌دهنده روز اوج احتمال هر سناریو هستند. نوار روند گروهی نسبت تجمعی گاوی به کل را نشان می‌دهد.
            </div>
            {/* Scenario interpretations */}
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

function DarkMetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '15px 16px',
      border: `1px solid ${D.line}`, borderRadius: 14,
      background: 'linear-gradient(145deg, rgba(18,42,61,.85), rgba(9,24,38,.86))',
    }}>
      <small style={{ display: 'block', color: D.muted, marginBottom: 8, fontSize: 12 }}>{label}</small>
      <strong style={{ fontSize: 18, letterSpacing: 0.2, color }}>{value}</strong>
    </div>
  );
}

// ── Loading ────────────────────────────────────────────────────────────────────

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
