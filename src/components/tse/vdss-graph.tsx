'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

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
  scenarios: {
    R1: Scenario;
    R2: Scenario;
    R3: Scenario;
    R4: Scenario;
    R5: Scenario;
  };
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
  blue: '#4186ff',
  purple: '#a04ac5',
  gold: '#ffb11b',
  green: '#34c98b',
  red: '#ef4d62',
  orange: '#ff7b32',
};

const EDGE_COLORS: Record<string, string> = {
  up: COLORS.up,
  pullback: COLORS.pullback,
  down: COLORS.down,
  risk: COLORS.risk,
};

// [from, to, label, type]
const EDGES: [string, string, string, string][] = [
  ['A','B','آزمون R1','up'], ['A','G','رد R1 / افت شتاب','pullback'], ['A','L','پایش روند','risk'],
  ['B','C','تثبیت بالای R1','up'], ['B','G','رد قیمت و پولبک','pullback'], ['B','A','نوسان در کریدور','risk'],
  ['C','D','آزمون R2','up'], ['C','G','بازگشت زیر R1','pullback'], ['C','L','شکست خط روند','risk'],
  ['D','E','عبور از R2','up'], ['D','B','رد R2','pullback'], ['D','G','اصلاح سریع','pullback'], ['D','L','واگرایی شتاب','risk'],
  ['E','F','تداوم شتاب تا هدف','up'], ['E','D','توقف / عرضه','pullback'], ['E','G','اصلاح تا S1','pullback'], ['E','H','شکست S1','down'], ['E','R1','تثبیت در کریدور','up'],
  ['F','R1','حفظ بالای هدف','up'], ['F','E','رد هدف‌ها','pullback'], ['F','D','بازگشت زیر کریدور','down'], ['F','G','شکست روند','risk'],
  ['G','B','بازپس‌گیری R1','up'], ['G','A','بازگشت به مرجع','pullback'], ['G','H','شکست S1','down'], ['G','L','واکنش به خط روند','risk'], ['G','R2','حفظ S1 و بازیابی','pullback'],
  ['H','G','بازگشت بالای S1','pullback'], ['H','I','شکست S2','down'], ['H','B','بازیابی تا R1','up'], ['H','L','ارزیابی روند','risk'], ['H','R2','بازگشت سریع از S2','pullback'],
  ['I','H','حفظ S3 / بازگشت','pullback'], ['I','J','شکست S3','down'], ['I','G','بازگشت قدرتمند','up'], ['I','L','اعتبار روند','risk'], ['I','R3','حفظ S3','down'],
  ['J','I','بازگشت از S4','pullback'], ['J','K','شکست S4','down'], ['J','H','بازگشت تا S2','up'], ['J','L','فاصله تا MA100','risk'], ['J','R3','بازگشت از S4','down'],
  ['K','J','حفظ ناحیه و بازگشت','pullback'], ['K','I','بازیابی S3','up'], ['K','L','شکست MA100','risk'], ['K','R4','حفظ MA100','down'], ['K','R5','شکست MA100','risk'],
  ['L','C','حفظ روند صعودی','up'], ['L','H','شکست روند / حفظ S2','pullback'], ['L','J','شکست روند میانی','down'], ['L','K','حفظ خط پایه','risk'], ['L','R5','شکست کامل روند','risk']
];

// Node positions (absolute, right/top within 1500x780 container)
const NODE_POSITIONS: Record<string, { right: number; top: number }> = {
  A:  { right: 670, top: 336 },
  B:  { right: 930, top: 230 },
  C:  { right: 1170, top: 115 },
  D:  { right: 935, top: 42 },
  E:  { right: 625, top: 42 },
  F:  { right: 312, top: 42 },
  G:  { right: 930, top: 450 },
  H:  { right: 1170, top: 565 },
  I:  { right: 680, top: 590 },
  J:  { right: 375, top: 590 },
  K:  { right: 72, top: 590 },
  L:  { right: 348, top: 337 },
  R1: { right: 75, top: 136 },
  R2: { right: 1110, top: 350 },
  R3: { right: 925, top: 665 },
  R4: { right: 275, top: 665 },
  R5: { right: 15, top: 345 },
};

const NODE_DEFS: Record<string, { title: string; type: string; desc: string; color: string; isTerminal?: boolean }> = {
  A:  { title: 'گره تصمیم (ریشه)', type: 'گره تصمیم‌گیری', desc: 'نقطه صفر تصمیم — قیمت فعلی سهم.', color: COLORS.cyan },
  B:  { title: 'آزمون مقاومت R1', type: 'گره رویداد شانسی', desc: 'واکنش بازار به مقاومت اول. تثبیت بالای آن شرط ادامه صعود است.', color: COLORS.gold },
  C:  { title: 'تثبیت بالای R1', type: 'گره تأیید روند', desc: 'تثبیت بالای R1، احتمال حرکت به سمت R2 را افزایش می‌دهد.', color: COLORS.green },
  D:  { title: 'آزمون مقاومت R2', type: 'گره سنجش تقاضا', desc: 'کیفیت تقاضا در این سطح تعیین‌کننده ادامه مسیر است.', color: COLORS.gold },
  E:  { title: 'کریدور صعودی', type: 'گره نتیجه', desc: 'هدف میانی صعود. تثبیت در این کریدور تأیید روند است.', color: COLORS.green, isTerminal: true },
  F:  { title: 'هدف توسعه‌ای', type: 'گره نتیجه', desc: 'هدف نهایی در صورت تداوم شتاب بالا.', color: COLORS.green, isTerminal: true },
  G:  { title: 'پولبک به حمایت S1', type: 'گره حمایت', desc: 'مرز تفکیک پولبک سالم از اصلاح ساختاری.', color: COLORS.blue },
  H:  { title: 'حمایت S2', type: 'گره حمایت', desc: 'سطح دومین ایستگاه بازسازی ساختار کوتاه‌مدت.', color: COLORS.blue },
  I:  { title: 'حمایت S3', type: 'گره حمایت', desc: 'سطح ارزیابی قدرت تقاضا در اصلاح‌های عمیق‌تر.', color: COLORS.orange },
  J:  { title: 'حمایت S4', type: 'گره حمایت', desc: 'آخرین سطح قبل از ناحیه بحرانی MA100.', color: COLORS.orange },
  K:  { title: 'MA100 — گره بحرانی', type: 'گره ریسک', desc: 'شکست معتبر این ناحیه به منزله ابطال روند صعودی است.', color: COLORS.red },
  L:  { title: 'خطوط روند', type: 'گره کنترل', desc: 'حفظ قیمت بالای این خطوط برای تداوم روند صعودی حیاتی است.', color: COLORS.purple },
  R1: { title: 'تداوم صعود', type: 'گره نتیجه', desc: 'رسیدن یا تثبیت در کریدور صعودی.', color: COLORS.green, isTerminal: true },
  R2: { title: 'پولبک سالم', type: 'گره نتیجه', desc: 'حفظ S1 و بازپس‌گیری مقاومت R1.', color: COLORS.cyan, isTerminal: true },
  R3: { title: 'اصلاح کنترل‌شده', type: 'گره نتیجه', desc: 'حرکت به حمایت‌های میانی.', color: COLORS.orange, isTerminal: true },
  R4: { title: 'اصلاح عمیق', type: 'گره نتیجه', desc: 'آزمون ناحیه نزدیک به MA100.', color: COLORS.gold, isTerminal: true },
  R5: { title: 'تضعیف ساختار', type: 'گره نتیجه', desc: 'شکست معتبر MA100.', color: COLORS.red, isTerminal: true },
};

const SCENARIO_KEYS = ['R1', 'R2', 'R3', 'R4', 'R5'] as const;

const SCENARIO_META: Record<string, { label: string; color: string }> = {
  R1: { label: 'تداوم صعود', color: COLORS.green },
  R2: { label: 'پولبک سالم', color: COLORS.cyan },
  R3: { label: 'اصلاح کنترل‌شده', color: COLORS.orange },
  R4: { label: 'اصلاح عمیق', color: COLORS.gold },
  R5: { label: 'تضعیف ساختار', color: COLORS.red },
};

const TYPE_FILTERS = [
  { key: 'all', label: 'همه مسیرها' },
  { key: 'up', label: 'صعودی' },
  { key: 'pullback', label: 'پولبک و بازگشت' },
  { key: 'down', label: 'اصلاحی' },
  { key: 'risk', label: 'ابطال و ریسک' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Graph Algorithms
// ═══════════════════════════════════════════════════════════════════════════════

interface EdgeInfo {
  from: string;
  to: string;
  label: string;
  type: string;
  prob: number;
}

interface PathInfo {
  nodes: string[];
  edges: number[];
  prob: number;
  target: string;
}

// Calculate edge probabilities based on market conditions
function calcEdgeProbabilities(
  bullScore: number, adxVal: number
): Record<string, number> {
  const adxW = Math.min(adxVal / 100, 1);
  const typeWeights: Record<string, number> = {
    up: bullScore * 0.6 + adxW * 0.4,
    pullback: 0.3,
    down: (1 - bullScore) * 0.6 + adxW * 0.4,
    risk: 0.15 * (1.2 - adxW),
  };

  // Build adjacency: for each node, group outgoing edges by type
  const adj: Record<string, { idx: number; type: string }[]> = {};
  EDGES.forEach((e, i) => {
    if (!adj[e[0]]) adj[e[0]] = [];
    adj[e[0]].push({ idx: i, type: e[3] });
  });

  const edgeProbs: Record<string, number> = {};

  for (const [node, outEdges] of Object.entries(adj)) {
    // Sum weights of outgoing edges
    const totalWeight = outEdges.reduce((sum, e) => sum + (typeWeights[e.type] ?? 0.1), 0);
    if (totalWeight === 0) {
      outEdges.forEach(e => { edgeProbs[String(e.idx)] = 1 / outEdges.length; });
      continue;
    }
    outEdges.forEach(e => {
      edgeProbs[String(e.idx)] = (typeWeights[e.type] ?? 0.1) / totalWeight;
    });
  }

  return edgeProbs;
}

// Find all paths from 'A' to terminal nodes using DFS
function findAllPaths(edgeProbs: Record<string, number>): PathInfo[] {
  const adj: Record<string, { to: string; edgeIdx: number }[]> = {};
  EDGES.forEach((e, i) => {
    if (!adj[e[0]]) adj[e[0]] = [];
    adj[e[0]].push({ to: e[1], edgeIdx: i });
  });

  const paths: PathInfo[] = [];
  const MAX_PATHS = 200;

  function dfs(node: string, visited: Set<string>, currentPath: string[], edgeIndices: number[], currentProb: number) {
    if (SCENARIO_KEYS.includes(node as any)) {
      paths.push({ nodes: [...currentPath, node], edges: [...edgeIndices], prob: currentProb, target: node });
      return;
    }
    if (paths.length >= MAX_PATHS) return;
    if (visited.has(node)) return;
    visited.add(node);

    const outs = adj[node] ?? [];
    for (const { to, edgeIdx } of outs) {
      const ep = edgeProbs[String(edgeIdx)] ?? 0.1;
      dfs(to, visited, [...currentPath, node], [...edgeIndices, edgeIdx], currentProb * ep);
    }
    visited.delete(node);
  }

  dfs('A', new Set(), [], [], 1);
  return paths.sort((a, b) => b.prob - a.prob);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function VdssGraph(props: VdssGraphProps) {
  const { symbolName, currentPrice, resistances, supports, ma100, scenarios, rsi, adx } = props;
  const R1_level = resistances[0] ?? currentPrice * 1.05;
  const S1_level = supports[0] ?? currentPrice * 0.95;

  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const shellRef = useRef<HTMLDivElement>(null);

  // ── Estimate bull score from indicators ────────────────────────────
  const bullEstimate = useMemo(() => {
    let score = 0;
    let count = 0;
    if (rsi > 50) { score += (rsi - 50) / 50; count++; } else { score -= (50 - rsi) / 50; count++; }
    if (props.mfi > 50) { score += (props.mfi - 50) / 50; count++; } else { score -= (50 - props.mfi) / 50; count++; }
    score += props.trendDirection === 'up' ? 1 : props.trendDirection === 'down' ? -1 : 0; count++;
    const avg = count > 0 ? (score / count + 1) / 2 : 0.5;
    return Math.max(0.05, Math.min(0.95, avg));
  }, [rsi, props.mfi, props.trendDirection]);

  // ── Edge probabilities ────────────────────────────────────────────
  const edgeProbs = useMemo(() =>
    calcEdgeProbabilities(bullEstimate, adx),
  [bullEstimate, adx]
  );

  // ── All paths with probabilities ──────────────────────────────────
  const allPaths = useMemo(() => findAllPaths(edgeProbs), [edgeProbs]);

  // ── Filtered paths ────────────────────────────────────────────────
  const filteredPaths = useMemo(() => {
    if (activeFilter === 'all') return allPaths;
    // Check if filter is a scenario key
    if (SCENARIO_KEYS.includes(activeFilter as any)) {
      return allPaths.filter(p => p.target === activeFilter);
    }
    // Type filter: paths must use only edges of this type
    return allPaths.filter(p =>
      p.edges.every(ei => EDGES[ei][3] === activeFilter)
    );
  }, [allPaths, activeFilter]);

  // ── Visible edges/nodes based on filter ────────────────────────────
  const { visibleEdgeIndices, visibleNodes } = useMemo(() => {
    if (activeFilter === 'all') {
      const allEdgeIdx = EDGES.map((_, i) => i);
      const allNodes = new Set(Object.keys(NODE_POSITIONS));
      return { visibleEdgeIndices: allEdgeIdx, visibleNodes: allNodes };
    }
    if (SCENARIO_KEYS.includes(activeFilter as any)) {
      // Show all edges/nodes on paths to this scenario
      const edgeSet = new Set<number>();
      const nodeSet = new Set<string>();
      for (const p of filteredPaths) {
        p.edges.forEach(ei => edgeSet.add(ei));
        p.nodes.forEach(n => nodeSet.add(n));
      }
      return { visibleEdgeIndices: [...edgeSet], visibleNodes: nodeSet };
    }
    // Type filter
    const edgeSet = new Set<number>();
    const nodeSet = new Set<string>();
    EDGES.forEach((e, i) => {
      if (e[3] === activeFilter) {
        edgeSet.add(i);
        nodeSet.add(e[0]);
        nodeSet.add(e[1]);
      }
    });
    return { visibleEdgeIndices: [...edgeSet], visibleNodes: nodeSet };
  }, [activeFilter, filteredPaths]);

  // ── Node values ──────────────────────────────────────────────────
  const nodeValues: Record<string, string> = {
    A: toFa(currentPrice),
    B: toFa(R1_level),
    D: toFa(resistances[1] ?? currentPrice * 1.10),
    E: `${toFa(Math.round(R1_level + (resistances[1] ?? R1_level * 1.05 - R1_level) * 0.5))} — ${toFa(Math.round((resistances[1] ?? R1_level * 1.05) + ((resistances[1] ?? R1_level * 1.05) - R1_level) * 0.8))}`,
    F: `${toFa(Math.round((resistances[1] ?? R1_level * 1.05) + ((resistances[1] ?? R1_level * 1.05) - R1_level) * 1.2))} — ${toFa(Math.round((resistances[1] ?? R1_level * 1.05) + ((resistances[1] ?? R1_level * 1.05) - R1_level) * 2.0))}`,
    G: toFa(S1_level),
    H: toFa(supports[1] ?? currentPrice * 0.90),
    I: toFa(supports[2] ?? currentPrice * 0.85),
    J: toFa(supports[3] ?? currentPrice * 0.80),
    K: toFa(ma100),
    L: props.trendDirection === 'up' ? 'صعودی' : props.trendDirection === 'down' ? 'نزولی' : 'خنثی',
  };
  for (const key of SCENARIO_KEYS) {
    const s = scenarios[key];
    nodeValues[key] = `${toFa(s.targetMin)} — ${toFa(s.targetMax)} ریال`;
  }

  // ── Draw SVG edges ───────────────────────────────────────────────
  const drawEdges = useCallback(() => {
    const svg = svgRef.current;
    const graph = graphRef.current;
    if (!svg || !graph) return;

    let markersSvg = '';
    for (const [k, c] of Object.entries(EDGE_COLORS)) {
      markersSvg += `<marker id="arrow-${k}" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="${c}"/></marker>`;
    }

    let pathsSvg = '';
    const graphRect = graph.getBoundingClientRect();

    for (let ei = 0; ei < EDGES.length; ei++) {
      const [fromId, toId, label, type] = EDGES[ei];
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
      const prob = edgeProbs[String(ei)] ?? 0;
      const probLabel = (prob * 100).toFixed(0) + '%';

      pathsSvg += `<path d="${d}" stroke="${EDGE_COLORS[type]}" stroke-width="${isVisible ? 2 : 1}" opacity="${isVisible ? 0.72 : 0.06}" fill="none" marker-end="url(#arrow-${type})" data-type="${type}" data-from="${fromId}" data-to="${toId}" class="edge-path" style="transition: opacity .25s, stroke-width .25s;"/>`;

      // Edge probability label (only for visible edges)
      if (isVisible) {
        pathsSvg += `<text x="${cx}" y="${cy - 6}" fill="#cde4ef" font-size="9" text-anchor="middle" paint-order="stroke" stroke="#07111b" stroke-width="3.5" stroke-linejoin="round" opacity="0.85" data-type="${type}" class="edge-label">${label}</text>`;
        pathsSvg += `<text x="${cx}" y="${cy + 8}" fill="${EDGE_COLORS[type]}" font-size="10" font-weight="bold" text-anchor="middle" paint-order="stroke" stroke="#07111b" stroke-width="3" stroke-linejoin="round" opacity="0.9" class="edge-prob">${probLabel}</text>`;
      }
    }

    svg.innerHTML = `<defs>${markersSvg}</defs>${pathsSvg}`;
  }, [visibleEdgeIndices, edgeProbs]);

  useEffect(() => { drawEdges(); }, [drawEdges]);
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => drawEdges());
    observer.observe(el);
    return () => observer.disconnect();
  }, [drawEdges]);

  // ── Aggregated path probabilities per target ─────────────────────
  const pathProbsByTarget = useMemo(() => {
    const result: Record<string, number> = {};
    for (const key of SCENARIO_KEYS) result[key] = 0;
    for (const p of filteredPaths) {
      result[p.target] = (result[p.target] ?? 0) + p.prob;
    }
    return result;
  }, [filteredPaths]);

  const totalProb = SCENARIO_KEYS.reduce((sum, k) => sum + scenarios[k].probability, 0);

  // ── Detail panel content ─────────────────────────────────────────
  const detailContent = useMemo(() => {
    if (!selectedNode) return null;
    const def = NODE_DEFS[selectedNode];
    if (!def) return null;
    const relations = EDGES.filter(e => e[0] === selectedNode || e[1] === selectedNode);
    const inputs = relations.filter(e => e[1] === selectedNode);
    const outputs = relations.filter(e => e[0] === selectedNode);

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-100">{def.title}</h3>
        <p className="text-xs text-gray-300"><b>مقدار / وضعیت:</b> {nodeValues[selectedNode] ?? '--'}</p>
        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] border border-white/10 bg-white/5 text-gray-300">{def.type}</span>
        <p className="text-xs text-gray-400 leading-relaxed">{def.desc}</p>
        {inputs.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-300 mb-1">مسیرهای ورودی ({inputs.length}):</p>
            <ul className="space-y-1">
              {inputs.map((e, i) => {
                const ei = EDGES.indexOf(e);
                const ep = edgeProbs[String(ei)] ?? 0;
                return (
                  <li key={i} className="text-[11px] text-gray-500 leading-relaxed border-t border-dashed border-white/10 pt-1.5">
                    <b className="text-gray-400">{e[0]} ← {e[1]}</b>
                    <span className="mr-2 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: `${EDGE_COLORS[e[3]]}20`, color: EDGE_COLORS[e[3]] }}>{(ep * 100).toFixed(1)}٪</span>
                    <br />{e[2]}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {outputs.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-300 mb-1">مسیرهای خروجی ({outputs.length}):</p>
            <ul className="space-y-1">
              {outputs.map((e, i) => {
                const ei = EDGES.indexOf(e);
                const ep = edgeProbs[String(ei)] ?? 0;
                return (
                  <li key={i} className="text-[11px] text-gray-500 leading-relaxed border-t border-dashed border-white/10 pt-1.5">
                    <b className="text-gray-400">{e[0]} → {e[1]}</b>
                    <span className="mr-2 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: `${EDGE_COLORS[e[3]]}20`, color: EDGE_COLORS[e[3]] }}>{(ep * 100).toFixed(1)}٪</span>
                    <br />{e[2]}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }, [selectedNode, nodeValues, edgeProbs]);

  // ── All filter buttons ────────────────────────────────────────────
  const allFilters = [
    ...TYPE_FILTERS,
    { key: 'sep1', label: '│', isSep: true as const },
    ...SCENARIO_KEYS.map(k => ({ key: k, label: `${k} | ${SCENARIO_META[k].label}`, scenarioKey: k })),
  ];

  return (
    <div className="space-y-3" dir="rtl">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl border border-cyan-500/20"
        style={{ background: 'linear-gradient(105deg, rgba(14,35,53,.94), rgba(8,22,35,.77))', boxShadow: '0 18px 55px rgba(0,0,0,.35)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border border-amber-500/60 flex items-center justify-center text-amber-400 text-xl font-bold"
            style={{ boxShadow: 'inset 0 0 22px rgba(255,177,27,.12), 0 0 22px rgba(255,177,27,.08)' }}>◈</div>
          <div>
            <h2 className="text-base font-bold text-gray-100">گراف تصمیم {symbolName}</h2>
            <p className="text-[11px] text-gray-500">مدل ۱۲پایه گره‌ـ‌مسیر | مبتنی بر EMV و مسیرهای بحرانی</p>
          </div>
        </div>
        <div className="text-left text-xs text-gray-400 leading-relaxed pr-4 border-r border-cyan-500/20">
          نقطه مرجع: <b className="text-cyan-400">{toFa(currentPrice)}</b><br />
          افق برآورد: ۱۰ تا ۲۵ جلسه معاملاتی
        </div>
      </div>

      {/* ═══ Metric Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="مقدار مرجع" value={toFa(currentPrice) + ' ریال'} color="text-cyan-400" />
        <MetricCard label="مقاومت آنی (R1)" value={toFa(R1_level) + ' ریال'} color="text-amber-400" />
        <MetricCard label="حمایت تفکیک‌کننده (S1)" value={toFa(S1_level) + ' ریال'} color="text-blue-400" />
        <MetricCard label="میانگین متحرک ۱۰۰" value={toFa(ma100) + ' ریال'} color="text-gray-200" />
      </div>

      {/* ═══ Toolbar ═══ */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 rounded-t-2xl border border-white/10 bg-[#091825]/90">
        <span className="text-xs text-gray-500 ml-1">فیلتر:</span>
        {allFilters.map((btn, i) => {
          if ('isSep' in btn && btn.isSep) {
            return <span key={`sep-${i}`} className="text-gray-700 mx-1">│</span>;
          }
          const isScenario = 'scenarioKey' in btn;
          const isActive = activeFilter === btn.key;
          const meta = isScenario ? SCENARIO_META[btn.scenarioKey] : null;
          return (
            <button
              key={btn.key}
              onClick={() => setActiveFilter(btn.key)}
              className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? isScenario
                    ? 'text-white border-opacity-60 shadow-[0_0_14px_rgba(0,0,0,.2)]'
                    : 'text-white border-cyan-500/60 bg-cyan-500/14 shadow-[0_0_18px_rgba(58,213,219,.10)]'
                  : 'text-gray-400 border-white/10 bg-white/4 hover:bg-white/8'
              }`}
              style={isActive && isScenario && meta ? {
                borderColor: meta.color + '99',
                background: meta.color + '18',
                color: meta.color,
              } : undefined}
            >{btn.label}</button>
          );
        })}
        <button
          onClick={() => { setSelectedNode(null); setActiveFilter('all'); }}
          className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/4 text-gray-400 hover:bg-white/8 transition-all cursor-pointer mr-auto"
        >بازنشانی</button>
      </div>

      {/* ═══ Graph Workspace ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        {/* Graph Shell */}
        <div
          ref={shellRef}
          className="relative overflow-auto border border-white/10 border-t-0 rounded-b-2xl min-h-[500px] max-h-[700px]"
          style={{
            background: 'radial-gradient(circle at 49% 49%, rgba(47,108,145,.12), transparent 36%), rgba(4,15,25,.72)',
            boxShadow: '0 18px 55px rgba(0,0,0,.35)',
          }}
        >
          <div ref={graphRef} className="relative mx-auto" style={{ width: 1100, height: 780, minWidth: 1100, minHeight: 780 }}>
            <svg ref={svgRef} className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" aria-label="مسیرهای گراف تصمیم" />

            {/* Nodes */}
            {Object.entries(NODE_POSITIONS).map(([id, pos]) => {
              const def = NODE_DEFS[id];
              if (!def) return null;
              const isTerminal = def.isTerminal;
              const isResultNode = SCENARIO_KEYS.includes(id as any);
              const isSelected = selectedNode === id;
              const isVisible = visibleNodes.has(id);
              const scenarioProb = isResultNode ? scenarios[id as keyof typeof scenarios].probability : null;
              const scenarioColor = isResultNode ? SCENARIO_META[id].color : def.color;

              return (
                <div
                  key={id}
                  ref={el => { nodeRefs.current[id] = el; }}
                  onClick={() => setSelectedNode(id)}
                  className={`absolute cursor-pointer transition-all duration-200 z-[2] text-center ${
                    isTerminal ? 'w-[160px] min-h-[85px]' : 'w-[138px] min-h-[72px]'
                  }`}
                  style={{
                    right: pos.right * (1100 / 1500),
                    top: pos.top * (780 / 780),
                    '--node-color': scenarioColor,
                    padding: '8px 7px',
                    border: `1px solid ${scenarioColor}${isTerminal ? '' : 'aa'}`,
                    borderWidth: isTerminal ? '2px' : '1px',
                    borderRadius: '12px',
                    background: isVisible
                      ? `linear-gradient(145deg, rgba(18,42,61,.97), rgba(6,21,34,.96))`
                      : 'rgba(6,12,20,0.5)',
                    boxShadow: isVisible
                      ? `inset 0 0 22px color-mix(in srgb, ${scenarioColor} 12%, transparent), 0 10px 25px rgba(0,0,0,.25)`
                      : 'none',
                    opacity: isVisible ? 1 : 0.12,
                    transform: isSelected ? 'translateY(-4px) scale(1.025)' : 'none',
                    filter: isSelected ? 'brightness(1.18)' : isVisible ? 'none' : 'grayscale(0.8) blur(0.5px)',
                    ...(isSelected ? {
                      boxShadow: `0 0 0 2px color-mix(in srgb, ${scenarioColor} 28%, transparent), 0 0 28px color-mix(in srgb, ${scenarioColor} 25%, transparent)`,
                    } : {}),
                  } as React.CSSProperties}
                >
                  {isResultNode && (
                    <span className="block text-[9px] font-bold mb-1" style={{ color: scenarioColor }}>نتیجه {id}</span>
                  )}
                  {!isResultNode && (
                    <span className="block text-[9px] font-bold mb-1" style={{ color: isVisible ? scenarioColor : '#555' }}>{id} | {def.type.split(' ').slice(0, 2).join(' ')}</span>
                  )}
                  <div className={`text-[11px] font-bold leading-relaxed ${isVisible ? 'text-gray-100' : 'text-gray-600'}`}>{def.title}</div>
                  <div className="text-[10px] text-gray-400 mt-1" dir="ltr">{nodeValues[id] ?? '--'}</div>
                  {isResultNode && scenarioProb !== null && (
                    <span
                      className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-sm font-bold"
                      style={{
                        background: `color-mix(in srgb, ${scenarioColor} 17%, transparent)`,
                        color: scenarioColor,
                      }}
                    >{toFa(scenarioProb)}٪</span>
                  )}
                </div>
              );
            })}

            {/* Legend */}
            <div className="absolute bottom-3 right-3 p-2.5 rounded-lg border border-white/10 bg-[#07111b]/80 text-[10px] text-gray-500 leading-7 z-10">
              <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-[#34c98b]" />صعود و تأیید</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-[#4186ff]" />پولبک و بازگشت</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-[#ff7b32]" />اصلاح</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-[#ef4d62]" />ریسک / ابطال</div>
            </div>
          </div>
        </div>

        {/* ═══ Right Panel: Path Probabilities ═══ */}
        <div className="rounded-2xl border border-white/10 p-4 flex flex-col"
          style={{ background: 'linear-gradient(160deg, rgba(16,39,57,.93), rgba(7,19,31,.93))', boxShadow: '0 18px 55px rgba(0,0,0,.35)' }}>
          <h2 className="text-sm font-bold text-gray-200 mb-3">📋 احتمال مسیرها</h2>

          {selectedNode && detailContent ? (
            <div className="border-t border-white/10 pt-3 flex-1 overflow-y-auto max-h-[580px] custom-scrollbar">
              {detailContent}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[580px] space-y-3 custom-scrollbar">
              {/* Path probabilities per target */}
              <div className="space-y-2">
                {SCENARIO_KEYS.map(key => {
                  const meta = SCENARIO_META[key];
                  const s = scenarios[key];
                  const pathProb = pathProbsByTarget[key] ?? 0;
                  const isActive = activeFilter === key;
                  return (
                    <div
                      key={key}
                      onClick={() => setActiveFilter(key)}
                      className={`rounded-xl p-3 cursor-pointer transition-all border ${
                        isActive
                          ? 'border-opacity-60'
                          : 'border-white/6 hover:border-white/15'
                      }`}
                      style={{
                        background: isActive ? `${meta.color}10` : 'rgba(255,255,255,0.02)',
                        borderColor: isActive ? meta.color + '80' : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: meta.color }}>{key} | {meta.label}</span>
                        <span className="text-lg font-black" style={{ color: meta.color }}>{(pathProb * 100).toFixed(1)}٪</span>
                      </div>
                      {/* Probability bar */}
                      <div className="w-full h-1.5 rounded-full bg-white/5 mb-2">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, pathProb * 100)}%`, background: meta.color }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span>تعداد مسیرها: {filteredPaths.filter(p => p.target === key).length}</span>
                        <span>احتمال سناریو: <b className="text-gray-300">{toFa(s.probability)}٪</b></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top paths list */}
              <div className="border-t border-white/10 pt-3 mt-3">
                <h3 className="text-xs font-bold text-gray-300 mb-2">مسیرهای اصلی (تا ۱۰ مسیر)</h3>
                <div className="space-y-1.5">
                  {filteredPaths.slice(0, 10).map((p, i) => {
                    const meta = SCENARIO_META[p.target];
                    return (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className="w-4 text-center font-bold" style={{ color: meta.color }}>{i + 1}</span>
                        <span className="flex-1 text-gray-400" dir="ltr">
                          {p.nodes.join(' → ')}
                        </span>
                        <span className="font-bold min-w-[40px] text-left" style={{ color: meta.color }}>
                          {(p.prob * 100).toFixed(1)}٪
                        </span>
                      </div>
                    );
                  })}
                  {filteredPaths.length > 10 && (
                    <div className="text-[10px] text-gray-600 text-center pt-1">
                      و {filteredPaths.length - 10} مسیر دیگر...
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 mt-3">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  <b>قاعده:</b> عبور یا شکست هر سطح فقط با تثبیت معتبر تلقی می‌شود.<br />
                  <b>احتمال یال:</b> حاصل توزیع شرطی بر اساس سیگنال‌های تکنیکال.<br />
                  <b>احتمال مسیر:</b> حاصل‌ضرب احتمال یال‌های مسیر.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Scenario Result Cards ═══ */}
      <div className="mt-4 p-4 rounded-2xl border border-white/10 bg-[#081623]/80">
        <h2 className="text-sm font-bold text-gray-200 mb-3">گره‌های نتیجه و احتمال تجمیعی مسیرهای ورودی</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {SCENARIO_KEYS.map(key => {
            const s = scenarios[key];
            const meta = SCENARIO_META[key];
            return (
              <div
                key={key}
                className="rounded-xl p-3"
                style={{
                  '--scolor': meta.color,
                  border: `1px solid color-mix(in srgb, ${meta.color} 40%, transparent)`,
                  background: `linear-gradient(160deg, color-mix(in srgb, ${meta.color} 12%, transparent), rgba(8,22,35,.65))`,
                } as React.CSSProperties}
              >
                <strong className="block text-xl font-black" style={{ color: meta.color }}>{toFa(s.probability)}٪</strong>
                <span className="text-xs font-bold text-gray-300">{key} | {meta.label}</span>
                <small className="block text-[10px] text-gray-500 leading-relaxed mt-2" dir="ltr">
                  {toFa(s.targetMin)} — {toFa(s.targetMax)} ریال
                </small>
              </div>
            );
          })}
        </div>
        <div className="mt-3 px-4 py-2.5 rounded-lg border-r-3 border-amber-500/80 bg-amber-500/6 text-[11px] text-gray-400 leading-relaxed">
          <b>محدودیت مدل:</b> احتمال‌های سناریو توسط موتور محاسباتی بر اساس فرمول‌های تعریف‌شده (ADX, RSI, MFI, CCI و فاصله از سطوح) محاسبه شده‌اند. احتمال مسیرها از حاصل‌ضرب احتمال شرطی یال‌ها به دست می‌آید.
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="px-4 py-3 rounded-xl border border-white/10"
      style={{ background: 'linear-gradient(145deg, rgba(18,42,61,.85), rgba(9,24,38,.86))' }}>
      <small className="block text-xs text-gray-500 mb-2">{label}</small>
      <strong className={`text-lg tracking-wide ${color}`}>{value}</strong>
    </div>
  );
}

// ── Loading ────────────────────────────────────────────────────────────────────

export function VdssGraphSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full bg-white/5 rounded-2xl" />
      <div className="grid grid-cols-4 gap-3">
        <Skeleton className="h-16 bg-white/5 rounded-xl" />
        <Skeleton className="h-16 bg-white/5 rounded-xl" />
        <Skeleton className="h-16 bg-white/5 rounded-xl" />
        <Skeleton className="h-16 bg-white/5 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-full bg-white/5 rounded-t-2xl" />
      <Skeleton className="h-[500px] w-full bg-white/5 rounded-b-2xl" />
      <Skeleton className="h-40 w-full bg-white/5 rounded-2xl" />
    </div>
  );
}