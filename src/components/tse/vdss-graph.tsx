'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toPersianDigits } from '@/lib/jalali';
<<<<<<< Updated upstream
import { computeV11Probabilities, type V11Result } from '@/lib/ml-narrative-v11';
=======
import { type GraphData } from '@/lib/decision-graph';
>>>>>>> Stashed changes

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
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const toFa = (n: number) => Math.round(n).toLocaleString('fa-IR');

const COLORS = {
  up: '#34c98b',
  pullback: '#4186ff',
  down: '#ff7b32',
  risk: '#ef4d62',
  cyan: '#3ad5db',
  purple: '#a04ac5',
  gold: '#ffb11b',
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
  R1: { label: 'صعودی با احتیاط', color: '#047857' },
  R2: { label: 'صعودی قوی', color: '#059669' },
  R3: { label: 'صعودی شتاب‌دار', color: '#0e7490' },
  R4: { label: 'شوک صعودی', color: '#0891b2' },
  R5: { label: 'رنج کم‌نوسان', color: '#b45309' },
  R6: { label: 'نزولی با احتیاط', color: '#c2410c' },
  R7: { label: 'نزولی قوی', color: '#ea580c' },
  R8: { label: 'نزولی شتاب‌دار', color: '#dc2626' },
  R9: { label: 'شوک نزولی', color: '#b91c1c' },
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
        markersSvg += `<marker id="arrow-${e.type}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${c}"/></marker>`;
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
      const bend = Math.min(40, Math.max(12, dist * 0.08));
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

      pathsSvg += `<path d="${d}" stroke="${edgeColor}" stroke-width="${isVisible ? 2 : 0.8}" opacity="${isVisible ? 0.7 : 0.05}" fill="none" marker-end="url(#arrow-${type})" data-type="${type}" data-from="${fromId}" data-to="${toId}" class="edge-path" style="transition: opacity .25s, stroke-width .25s;"/>`;

      // Edge labels — skip deterministic root→branch and branch→event edges (index < 6)
      if (isVisible && ei >= 6) {
        pathsSvg += `<text x="${cx}" y="${cy - 5}" fill="#374151" font-size="8" text-anchor="middle" paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" opacity="0.8" data-type="${type}" class="edge-label">${label}</text>`;
        pathsSvg += `<text x="${cx}" y="${cy + 7}" fill="${edgeColor}" font-size="9" font-weight="bold" text-anchor="middle" paint-order="stroke" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" opacity="0.85" class="edge-prob">${probLabel}</text>`;
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

<<<<<<< Updated upstream
  // ── Aggregated path probabilities per target (calibrated = matches scenario prob) ──
  const pathProbsByTarget = useMemo(() => {
    const result: Record<string, number> = {};
    for (const key of SCENARIO_KEYS) result[key] = 0;
    for (const p of filteredPaths) {
      result[p.target] = (result[p.target] ?? 0) + p.prob;
    }
    // After calibration, these should match scenario probabilities
    return result;
  }, [filteredPaths]);

  const totalProb = SCENARIO_KEYS.reduce((sum, k) => sum + scenarios[k].probability, 0);

  // ── V11 Probabilities ──
  const v11 = useMemo<V11Result>(() => computeV11Probabilities({
    R1: scenarios.R1.probability,
    R2: scenarios.R2.probability,
    R3: scenarios.R3.probability,
    R4: scenarios.R4.probability,
    R5: scenarios.R5.probability,
  }), [scenarios.R1.probability, scenarios.R2.probability, scenarios.R3.probability, scenarios.R4.probability, scenarios.R5.probability]);
  const v11Map = useMemo(() => {
    const m = new Map<string, V11Result['scenarios'][number]>();
    for (const s of v11.scenarios) m.set(s.key, s);
    return m;
  }, [v11]);

=======
>>>>>>> Stashed changes
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
        <div className="space-y-3">
          <h3 className="text-sm font-bold" style={{ color: meta.color }}>{node.title}</h3>
          <p className="text-xs text-[#374151]">{node.desc}</p>
          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] border border-[#e5e7eb] bg-[#f3f4f6] text-[#374151]">{node.type === 'decision' ? 'گره تصمیم‌گیری' : node.type === 'event' ? 'گره رویداد شانسی' : 'گره نتیجه'}</span>
          <div className="text-xs text-[#6b7280]" dir="ltr">{nodeValues[selectedNode] ?? '--'}</div>

          <div className="mt-3 pt-3 border-t border-[#e5e7eb]">
            <p className="text-xs font-bold text-[#374151] mb-2">سهم هر استراتژی:</p>
            {Object.entries(BRANCH_META).map(([bKey, bMeta]) => {
              const val = contrib[bKey as 'trend' | 'breakout' | 'reversal'];
              const pct = (val * 100).toFixed(1);
              return (
                <div key={bKey} className="flex items-center justify-between py-1.5 border-b border-dashed border-[#e5e7eb]">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: bMeta.color }} />
                    <span className="text-[11px] text-[#374151]">{bMeta.label}</span>
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: bMeta.color }}>{toPersianDigits(pct)}٪</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[11px] font-bold text-[#111827]">مجموع</span>
              <span className="text-[11px] font-black" style={{ color: meta.color }}>{toFa(s?.probability ?? 0)}٪</span>
            </div>
          </div>
        </div>
      );
    }

    // For non-terminal nodes, show incoming/outgoing edges
    const inputs = edges.filter(e => e.to === selectedNode);
    const outputs = edges.filter(e => e.from === selectedNode);

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-[#111827]">{node.title}</h3>
        <p className="text-xs text-[#374151]"><b>مقدار / وضعیت:</b> {nodeValues[selectedNode] ?? '--'}</p>
        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] border border-[#e5e7eb] bg-[#f3f4f6] text-[#374151]">{node.type === 'decision' ? 'گره تصمیم‌گیری' : node.type === 'event' ? 'گره رویداد شانسی' : 'گره نتیجه'}</span>
        <p className="text-xs text-[#6b7280] leading-relaxed">{node.desc}</p>
        {inputs.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[#374151] mb-1">مسیرهای ورودی ({toFa(inputs.length)}):</p>
            <ul className="space-y-1">
              {inputs.map((e, i) => {
                const ep = edgeProbabilities[edges.indexOf(e)] ?? 0;
                const edgeColor = EDGE_COLORS[e.type] ?? '#6b7280';
                return (
                  <li key={i} className="text-[11px] text-[#6b7280] leading-relaxed border-t border-dashed border-[#e5e7eb] pt-1.5">
                    <b className="text-[#374151]">{SCENARIO_DISPLAY[e.from] || e.from} ← {SCENARIO_DISPLAY[e.to] || e.to}</b>
                    <span className="mr-2 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: `${edgeColor}20`, color: edgeColor }}>{toPersianDigits((ep * 100).toFixed(1))}٪</span>
                    <br />{e.label}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {outputs.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[#374151] mb-1">مسیرهای خروجی ({toFa(outputs.length)}):</p>
            <ul className="space-y-1">
              {outputs.map((e, i) => {
                const ep = edgeProbabilities[edges.indexOf(e)] ?? 0;
                const edgeColor = EDGE_COLORS[e.type] ?? '#6b7280';
                return (
                  <li key={i} className="text-[11px] text-[#6b7280] leading-relaxed border-t border-dashed border-[#e5e7eb] pt-1.5">
                    <b className="text-[#374151]">{SCENARIO_DISPLAY[e.from] || e.from} → {SCENARIO_DISPLAY[e.to] || e.to}</b>
                    <span className="mr-2 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: `${edgeColor}20`, color: edgeColor }}>{toPersianDigits((ep * 100).toFixed(1))}٪</span>
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
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl border border-[#e5e7eb]"
        style={{ background: 'linear-gradient(105deg, #ffffff, #f3f4f6)', boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border border-amber-200 flex items-center justify-center text-amber-800 text-xl font-bold"
            style={{ boxShadow: 'inset 0 0 22px rgba(146,64,14,.06), 0 0 22px rgba(146,64,14,.04)' }}>◈</div>
          <div>
            <h2 className="text-base font-bold text-[#111827]">گراف تصمیم {symbolName}</h2>
            <p className="text-[11px] text-[#6b7280]">مدل ۳‌شاخه‌ای | پیروی از روند، شکست، بازگشت | ۲۷ مسیر به ۹ سناریو</p>
          </div>
        </div>
        <div className="text-left text-xs text-[#6b7280] leading-relaxed pr-4 border-r border-[#e5e7eb]">
          نقطه مرجع: <b className="text-cyan-700">{toFa(currentPrice)}</b><br />
          افق برآورد: ۱۰ تا ۲۵ جلسه معاملاتی
        </div>
      </div>

      {/* ═══ Metric Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="مقدار مرجع" value={toFa(currentPrice) + ' ریال'} color="text-cyan-700" />
        <MetricCard label="احتمال روند" value={toPersianDigits((branchProbs.trend * 100).toFixed(0)) + '٪'} color="text-cyan-700" />
        <MetricCard label="احتمال شکست" value={toPersianDigits((branchProbs.breakout * 100).toFixed(0)) + '٪'} color="text-amber-700" />
        <MetricCard label="احتمال بازگشت" value={toPersianDigits((branchProbs.reversal * 100).toFixed(0)) + '٪'} color="text-purple-700" />
      </div>

      {/* ═══ Toolbar ═══ */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 rounded-t-2xl border border-[#e5e7eb] bg-[#ffffff]">
        <span className="text-xs text-[#6b7280] ml-1">فیلتر:</span>
        {allFilters.map((btn, i) => {
          if ('isSep' in btn && btn.isSep) {
            return <span key={`sep-${i}`} className="text-[#B0A89E] mx-1">│</span>;
          }
          const isScenario = 'scenarioKey' in btn;
          const isBranch = 'branchKey' in btn;
          const isActive = activeFilter === btn.key;
          const meta = isScenario ? SCENARIO_META[(btn as { scenarioKey: string }).scenarioKey] : null;
          const bColor = isBranch ? (btn as { branchColor: string }).branchColor : null;
          return (
            <button
              key={btn.key}
              onClick={() => setActiveFilter(btn.key)}
              className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? isScenario
                    ? 'text-[#111827] border-opacity-60 shadow-[0_0_14px_rgba(0,0,0,.06)]'
                    : isBranch
                      ? 'text-[#111827] border-opacity-60 shadow-[0_0_14px_rgba(0,0,0,.06)]'
                      : 'text-[#111827] border-cyan-500/60 bg-cyan-50 shadow-[0_0_18px_rgba(58,213,219,.10)]'
                  : 'text-[#374151] border-[#e5e7eb] bg-[#f3f4f6]/50 hover:bg-[#e5e7eb]'
              }`}
              style={
                isActive && isScenario && meta ? {
                  borderColor: meta.color + '80',
                  background: meta.color + '12',
                  color: meta.color,
                } : isActive && isBranch && bColor ? {
                  borderColor: bColor + '80',
                  background: bColor + '12',
                  color: bColor,
                } : undefined
              }
            >{btn.label}</button>
          );
        })}
        <button
          onClick={() => { setSelectedNode(null); setActiveFilter('all'); }}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#e5e7eb] bg-[#f3f4f6]/50 text-[#374151] hover:bg-[#e5e7eb] transition-all cursor-pointer mr-auto"
        >بازنشانی</button>
      </div>

      {/* ═══ Graph Workspace ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3">
        {/* Graph Shell */}
        <div
          ref={shellRef}
          className="relative overflow-auto border border-[#e5e7eb] border-t-0 rounded-b-2xl min-h-[900px]"
          style={{
            background: 'radial-gradient(circle at 49% 49%, rgba(180,200,220,.18), transparent 36%), #ffffff',
            boxShadow: '0 4px 16px rgba(0,0,0,.06)',
          }}
        >
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

              const nodeWidth = isResultNode ? 155 : isBranchNode ? 145 : isEventNode ? 160 : 130;
              const nodeMinH = isResultNode ? 82 : isBranchNode ? 65 : isEventNode ? 55 : 60;

              // Decision nodes: rounded-lg with colored left border (3px), white bg, shadow
              // Event nodes: rounded-lg with dotted left border (2px), light bg
              // Terminal nodes: rounded-lg with solid bg (color at 10% opacity), colored text
              let borderStyle: React.CSSProperties['borderLeftStyle'] = 'solid';
              let borderLeftWidth = '0px';
              let bgStyle = isVisible
                ? 'linear-gradient(145deg, #ffffff, #f3f4f6)'
                : 'rgba(243,244,246,0.5)';
              let boxShadowStyle = isVisible
                ? `inset 0 0 22px color-mix(in srgb, ${scenarioColor} 8%, transparent), 0 4px 12px rgba(0,0,0,.06)`
                : 'none';

              if (node.type === 'decision' && !isTerminal) {
                borderLeftWidth = '3px';
                borderStyle = 'solid';
                bgStyle = isVisible ? 'linear-gradient(145deg, #ffffff, #f3f4f6)' : 'rgba(243,244,246,0.5)';
                boxShadowStyle = isVisible
                  ? `inset 0 0 22px color-mix(in srgb, ${scenarioColor} 8%, transparent), 0 4px 12px rgba(0,0,0,.06)`
                  : 'none';
              } else if (node.type === 'event') {
                borderLeftWidth = '2px';
                borderStyle = 'dotted';
                bgStyle = isVisible ? 'linear-gradient(145deg, #fafbfc, #f3f4f6)' : 'rgba(243,244,246,0.5)';
                boxShadowStyle = isVisible
                  ? `0 2px 8px rgba(0,0,0,.04)`
                  : 'none';
              } else if (isTerminal) {
                borderLeftWidth = '0px';
                borderStyle = 'solid';
                bgStyle = isVisible
                  ? `linear-gradient(145deg, color-mix(in srgb, ${scenarioColor} 10%, #ffffff), color-mix(in srgb, ${scenarioColor} 5%, #f9fafb))`
                  : 'rgba(243,244,246,0.5)';
                boxShadowStyle = isVisible
                  ? `inset 0 0 18px color-mix(in srgb, ${scenarioColor} 6%, transparent), 0 2px 10px rgba(0,0,0,.04)`
                  : 'none';
              }

              const selectedShadow = isSelected
                ? `0 0 0 2px color-mix(in srgb, ${scenarioColor} 28%, transparent), 0 0 28px color-mix(in srgb, ${scenarioColor} 25%, transparent)`
                : boxShadowStyle;

              return (
                <div
                  key={node.id}
                  ref={el => { nodeRefs.current[node.id] = el; }}
                  onClick={() => setSelectedNode(node.id)}
                  className={`absolute cursor-pointer transition-all duration-200 z-[2] text-center ${isSelected ? 'ring-2 ring-offset-1' : ''}`}
                  style={{
                    right: pos.right * scaleX,
                    top: pos.top * scaleY,
                    width: nodeWidth,
                    minWidth: nodeWidth,
                    minHeight: nodeMinH,
                    '--node-color': scenarioColor,
                    padding: isResultNode ? '7px 6px' : '6px 5px',
                    border: isTerminal
                      ? `2px solid ${scenarioColor}`
                      : `1px solid ${scenarioColor}aa`,
                    borderLeftWidth,
                    borderLeftStyle: borderStyle,
                    borderLeftColor: scenarioColor,
                    borderRadius: isTerminal ? '12px' : isBranchNode ? '14px' : '10px',
                    background: bgStyle,
                    boxShadow: selectedShadow,
                    opacity: isVisible ? 1 : 0.12,
                    transform: isSelected ? 'translateY(-4px) scale(1.025)' : 'none',
                    filter: isSelected ? 'brightness(1.18)' : isVisible ? 'none' : 'grayscale(0.8) blur(0.5px)',
                  } as React.CSSProperties}
                >
                  {/* Root node */}
                  {node.id === 'ROOT' && (
                    <>
                      <span className="block text-[9px] font-bold mb-0.5" style={{ color: isVisible ? scenarioColor : '#555' }}>تصمیم</span>
                      <div className={`text-[12px] font-black leading-relaxed ${isVisible ? 'text-[#111827]' : 'text-[#B0A89E]'}`}>{node.title}</div>
                      <div className="text-[10px] text-[#6b7280] mt-1" dir="ltr">{nodeValues[node.id] ?? '--'}</div>
                    </>
                  )}

                  {/* Branch nodes */}
                  {isBranchNode && (
                    <>
                      <span className="block text-[9px] font-bold mb-0.5" style={{ color: isVisible ? scenarioColor : '#555' }}>{node.type === 'decision' ? 'استراتژی' : node.titleEn}</span>
                      <div className={`text-[11px] font-bold leading-relaxed ${isVisible ? 'text-[#111827]' : 'text-[#B0A89E]'}`}>{node.title}</div>
                      <div className="text-[11px] font-black mt-1" style={{ color: scenarioColor }}>{nodeValues[node.id] ?? '--'}</div>
                    </>
                  )}

                  {/* Event nodes */}
                  {isEventNode && (
                    <>
                      <span className="block text-[9px] font-bold mb-0.5" style={{ color: isVisible ? scenarioColor : '#555' }}>رویداد شانسی</span>
                      <div className={`text-[11px] font-bold leading-relaxed ${isVisible ? 'text-[#111827]' : 'text-[#B0A89E]'}`}>{node.title}</div>
                      <div className="text-[9px] text-[#6b7280] mt-0.5" dir="ltr">{nodeValues[node.id] ?? '--'}</div>
                    </>
                  )}

                  {/* Terminal scenario nodes */}
                  {isResultNode && (
<<<<<<< Updated upstream
                    <span className="block text-[9px] font-bold mb-1" style={{ color: scenarioColor }}>{SCENARIO_DISPLAY[id]}</span>
                  )}
                  {!isResultNode && (
                    <span className="block text-[9px] font-bold mb-1" style={{ color: isVisible ? scenarioColor : '#555' }}>{NODE_DEFS[id].title.split(' ')[0]} | {def.type.split(' ').slice(0, 2).join(' ')}</span>
                  )}
                  <div className={`text-[11px] font-bold leading-relaxed ${isVisible ? 'text-[#111827]' : 'text-[#B0A89E]'}`}>{def.title}</div>
                  <div className="text-[10px] text-[#6b7280] mt-1" dir="ltr">{nodeValues[id] ?? '--'}</div>
                  {isResultNode && scenarioProb !== null && (
                    <div className="mt-1.5 flex flex-col items-center gap-0.5">
                      <span
                        className="inline-block px-2.5 py-0.5 rounded-full text-sm font-bold"
                        style={{
                          background: `color-mix(in srgb, ${scenarioColor} 17%, transparent)`,
                          color: scenarioColor,
                        }}
                      >{toFa(scenarioProb)}٪</span>
                      <span className="text-[8px] text-[#6b7280]">تجمعی: {toFa(v11Map.get(id)?.cumulativeProbability ?? scenarioProb)}٪</span>
                    </div>
=======
                    <>
                      <span className="block text-[9px] font-bold mb-0.5" style={{ color: scenarioColor }}>{SCENARIO_DISPLAY[node.id]}</span>
                      <div className={`text-[11px] font-bold leading-relaxed ${isVisible ? 'text-[#111827]' : 'text-[#B0A89E]'}`}>{node.title}</div>
                      <div className="text-[9px] text-[#6b7280] mt-0.5" dir="ltr">{nodeValues[node.id] ?? '--'}</div>
                      {scenarioProb !== null && (
                        <span
                          className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-sm font-black"
                          style={{
                            background: `color-mix(in srgb, ${scenarioColor} 17%, transparent)`,
                            color: scenarioColor,
                          }}
                        >{toFa(scenarioProb * 100)}٪</span>
                      )}
                    </>
>>>>>>> Stashed changes
                  )}
                </div>
              );
            })}

            {/* Legend */}
            <div className="absolute bottom-3 right-3 p-2.5 rounded-lg border border-[#e5e7eb] bg-[#ffffff]/90 text-[10px] text-[#374151] leading-6 z-10">
              <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS.cyan }} />پیروی از روند</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS.gold }} />شکست</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS.purple }} />بازگشت</div>
              <div className="border-t border-[#e5e7eb] my-1" />
              <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-[#34c98b]" />صعودی</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-[#4186ff]" />خنثی / رنج</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-[#ff7b32]" />نزولی</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-[#ef4d62]" />شوک / ریسک</div>
            </div>
          </div>
        </div>

        {/* ═══ Right Panel: Scenario Probabilities & Detail ═══ */}
        <div className="rounded-2xl border border-[#e5e7eb] p-4 flex flex-col"
          style={{ background: 'linear-gradient(160deg, #ffffff, #f3f4f6)', boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
          <h2 className="text-sm font-bold text-[#111827] mb-3">📋 احتمال سناریوها</h2>

          {selectedNode && detailContent ? (
            <div className="border-t border-[#e5e7eb] pt-3 flex-1 overflow-y-auto max-h-[860px] custom-scrollbar">
              {detailContent}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[860px] space-y-3 custom-scrollbar">
              {/* Scenario probabilities from backend */}
              <div className="space-y-2">
                {SCENARIO_KEYS.map(key => {
                  const meta = SCENARIO_META[key];
                  const prob = scenarioProbabilities[key] ?? 0;
                  const isActive = activeFilter === key;
                  const s = scenarios[key as keyof typeof scenarios];
                  return (
                    <div
                      key={key}
                      onClick={() => { setActiveFilter(key); setSelectedNode(null); }}
                      className={`rounded-xl p-3 cursor-pointer transition-all border ${
                        isActive
                          ? 'border-opacity-60'
                          : 'border-[#e5e7eb]/60 hover:border-[#e5e7eb]'
                      }`}
                      style={{
                        background: isActive ? `${meta.color}0a` : 'rgba(243,244,246,0.5)',
                        borderColor: isActive ? meta.color + '80' : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
                        <span className="text-lg font-black" style={{ color: meta.color }}>{toPersianDigits((prob * 100).toFixed(1))}٪</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#e5e7eb] mb-2">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, prob * 100)}%`, background: meta.color }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#6b7280]">
<<<<<<< Updated upstream
                        <span>تعداد مسیرها: {filteredPaths.filter(p => p.target === key).length}</span>
                        <span>تجمعی: <b className="text-[#374151]">{toFa(v11Map.get(key)?.cumulativeProbability ?? s.probability)}٪</b></span>
=======
                        <span>تجمیعی: <b className="text-[#374151]">{toFa(s?.probability ?? 0)}٪</b></span>
>>>>>>> Stashed changes
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[#e5e7eb] pt-3 mt-3">
                <p className="text-[10px] text-[#6b7280] leading-relaxed">
                  <b>ساختار:</b> ۳ استراتژی × ۹ یال = ۲۷ مسیر مستقیم.<br />
                  <b>احتمال یال:</b> محاسبه‌شده از موتور تصمیم (backend).<br />
                  <b>احتمال مسیر:</b> P(استراتژی) × P(یال|استراتژی).<br />
                  <b>احتمال سناریو:</b> تجمیع ۳ مسیر هر سناریو.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Scenario Result Cards ═══ */}
      <div className="mt-4 p-4 rounded-2xl border border-[#e5e7eb] bg-[#ffffff]">
        <h2 className="text-sm font-bold text-[#111827] mb-3">گره‌های نتیجه و سهم استراتژی‌ها</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {SCENARIO_KEYS.map(key => {
            const s = scenarios[key];
            if (!s) return null;
            const meta = SCENARIO_META[key];
            const contrib = pathContributions[key] ?? { trend: 0, breakout: 0, reversal: 0 };
            return (
              <div
                key={key}
                className="rounded-xl p-3"
                style={{
                  '--scolor': meta.color,
                  border: `1px solid color-mix(in srgb, ${meta.color} 40%, transparent)`,
                  background: `linear-gradient(160deg, color-mix(in srgb, ${meta.color} 8%, #ffffff), #ffffff)`,
                } as React.CSSProperties}
              >
                <strong className="block text-xl font-black" style={{ color: meta.color }}>{toFa(s.probability)}٪</strong>
<<<<<<< Updated upstream
                <span className="text-xs font-bold text-[#374151]">{SCENARIO_DISPLAY[key]} | {meta.label}</span>
                <div className="flex items-center justify-between text-[10px] text-[#6b7280] mt-1">
                  <span>اختصاصی: <b style={{ color: meta.color }}>{toFa(s.probability)}٪</b></span>
                  <span>تجمعی: <b className="text-[#374151]">{toFa(v11Map.get(key)?.cumulativeProbability ?? s.probability)}٪</b></span>
                </div>
                <small className="block text-[10px] text-[#6b7280] leading-relaxed mt-2" dir="ltr">
                  {toFa(s.targetMin)} — {toFa(s.targetMax)} ریال
=======
                <span className="text-xs font-bold text-[#374151]">{meta.label}</span>
                <div className="mt-2 space-y-0.5">
                  {Object.entries(BRANCH_META).map(([bKey, bMeta]) => (
                    <div key={bKey} className="flex items-center justify-between text-[9px]">
                      <span className="text-[#6b7280] flex items-center gap-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: bMeta.color }} />
                        {bMeta.label}
                      </span>
                      <span className="font-bold text-[#374151]">
                        {toPersianDigits((contrib[bKey as 'trend' | 'breakout' | 'reversal'] * 100).toFixed(1))}٪
                      </span>
                    </div>
                  ))}
                </div>
                <small className="block text-[9px] text-[#6b7280] leading-relaxed mt-1.5" dir="ltr">
                  {toFa(s.targetMin)} — {toFa(s.targetMax)}
>>>>>>> Stashed changes
                </small>
              </div>
            );
          })}
        </div>
        <div className="mt-3 px-4 py-2.5 rounded-lg border-r-3 border-amber-700/60 bg-amber-50 text-[11px] text-[#374151] leading-relaxed">
          <b>محدودیت مدل:</b> احتمال‌های سناریو توسط موتور محاسباتی سرور محاسبه شده‌اند. هر استراتژی ۹ یال شرطی دارد و مجموع ۲۷ مسیر، احتمال نهایی هر سناریو را تشکیل می‌دهد.
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="px-4 py-3 rounded-xl border border-[#e5e7eb]"
      style={{ background: 'linear-gradient(145deg, #ffffff, #f3f4f6)' }}>
      <small className="block text-xs text-[#6b7280] mb-2">{label}</small>
      <strong className={`text-lg tracking-wide ${color}`}>{value}</strong>
    </div>
  );
}

// ── Loading ────────────────────────────────────────────────────────────────────

export function VdssGraphSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full bg-[#e5e7eb] rounded-2xl" />
      <div className="grid grid-cols-4 gap-3">
        <Skeleton className="h-16 bg-[#e5e7eb] rounded-xl" />
        <Skeleton className="h-16 bg-[#e5e7eb] rounded-xl" />
        <Skeleton className="h-16 bg-[#e5e7eb] rounded-xl" />
        <Skeleton className="h-16 bg-[#e5e7eb] rounded-xl" />
      </div>
      <Skeleton className="h-10 w-full bg-[#e5e7eb] rounded-t-2xl" />
      <Skeleton className="h-[500px] w-full bg-[#e5e7eb] rounded-b-2xl" />
      <Skeleton className="h-40 w-full bg-[#e5e7eb] rounded-2xl" />
    </div>
  );
}
