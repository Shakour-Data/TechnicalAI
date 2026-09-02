// ═══════════════════════════════════════════════════════════════════════════════
// Standalone HTML+CSS+JS Export for Decision Graph
// ═══════════════════════════════════════════════════════════════════════════════

import { type GraphData } from './decision-graph';
import { type ProbabilityTrendResult, SCENARIO_KEYS, SCENARIO_META } from './probability-trend';
import { generateDecisionGraphNarrative } from '@/components/tse/vdss-graph';
import { toPersianDigits } from './jalali';

export interface DecisionGraphExportData {
  symbolName: string;
  currentPrice: number;
  currencyUnit: string;
  scenarios: Record<string, { name: string; probability: number; targetMin: number; targetMax: number; description: string }>;
  decisionGraph: GraphData;
  probabilityTrend: ProbabilityTrendResult | null;
  branchProbabilities: { trend: number; breakout: number; reversal: number };
  pathContributions: Record<string, { trend: number; breakout: number; reversal: number }>;
  narrative: string;
}

const D = {
  bg: '#07111b',
  bg2: '#0b1c2b',
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
};

const SCENARIO_COLORS: Record<string, string> = {
  SC1: '#b91c1c', SC2: '#dc2626', SC3: '#ea580c', SC4: '#c2410c',
  SC5: '#b45309',
  SC6: '#047857', SC7: '#059669', SC8: '#0e7490', SC9: '#0891b2',
};

const SCENARIO_LABELS: Record<string, string> = {
  SC1: 'شوک نزولی', SC2: 'نزولی شتاب‌دار', SC3: 'نزولی قوی', SC4: 'نزولی خفیف',
  SC5: 'رنج',
  SC6: 'صعودی خفیف', SC7: 'صعودی قوی', SC8: 'صعودی شتاب‌دار', SC9: 'شوک صعودی',
};

const BRANCH_COLORS: Record<string, string> = { trend: D.cyan, breakout: D.gold, reversal: D.purple };
const BRANCH_LABELS: Record<string, string> = { trend: 'پیروی از روند', breakout: 'شکست', reversal: 'بازگشت' };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function faNum(n: number): string {
  return toPersianDigits(Math.round(n).toLocaleString('en-US'));
}

function faPct(n: number): string {
  return toPersianDigits((n * 100).toFixed(1));
}

function faPct0(n: number): string {
  return toPersianDigits((n * 100).toFixed(0));
}

export function exportDecisionGraphHTML(data: DecisionGraphExportData): void {
  const { symbolName, currentPrice, currencyUnit, scenarios, decisionGraph, probabilityTrend, branchProbabilities, pathContributions, narrative } = data;

  // ── Build SVG for decision graph (simplified layout) ──
  const nodePositions = decisionGraph.nodePositions ?? {};
  const edgeProbabilities = decisionGraph.edgeProbabilities ?? {};
  const scenarioProbabilities = decisionGraph.scenarioProbabilities ?? {};

  // Node layout mapping
  const DESIGN_W = 1200;
  const DESIGN_H = 1100;

  const nodeW: Record<string, number> = {};
  const nodeH: Record<string, number> = {};
  for (const n of decisionGraph.nodes) {
    const isTerminal = n.type === 'terminal' || n.isTerminal || SCENARIO_KEYS.includes(n.id as typeof SCENARIO_KEYS[number]);
    nodeW[n.id] = isTerminal ? 150 : n.type === 'event' ? 140 : 145;
    nodeH[n.id] = isTerminal ? 70 : n.type === 'event' ? 48 : 62;
  }

  let nodesSvg = '';
  for (const n of decisionGraph.nodes) {
    const pos = nodePositions[n.id];
    if (!pos) continue;
    const w = nodeW[n.id] ?? 145;
    const h = nodeH[n.id] ?? 62;
    const x = pos.right;
    const y = pos.top;
    const color = n.color || '#6b7280';
    const isTerminal = n.type === 'terminal' || n.isTerminal || SCENARIO_KEYS.includes(n.id as typeof SCENARIO_KEYS[number]);
    const borderW = isTerminal ? 2 : 1;
    const borderDash = n.type === 'event' ? 'stroke-dasharray="4,3"' : '';
    const label = SCENARIO_LABELS[n.id] ?? n.title;
    const prob = isTerminal ? (scenarioProbabilities[n.id] ?? 0) : null;
    const probText = prob !== null ? `<tspan x="${x + w/2}" y="${y + h*0.62}" fill="#ffffff" font-size="15" font-weight="900">${faPct0(prob)}٪</tspan>` : '';

    nodesSvg += `<g class="graph-node" data-id="${n.id}">
` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11" fill="rgba(8,22,35,.92)" stroke="${color}" stroke-width="${borderW}" ${borderDash} />
` +
      (isTerminal ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11" fill="${color}1f" stroke="none" />` : '') +
      `<text x="${x + w/2}" y="${y + h*0.35}" fill="#ffffff" font-size="11" font-weight="800" text-anchor="middle" font-family="Vazirmatn,Tahoma,sans-serif">${esc(label)}</text>
` +
      probText +
      `</g>\n`;
  }

  // Edge SVG
  const edgeColorMap: Record<string, string> = {
    'branch-trend': D.cyan, 'branch-breakout': D.gold, 'branch-reversal': D.purple,
    up: D.green, down: D.orange, pullback: D.blue, risk: D.red,
  };

  const markerDefs: string[] = [];
  const seenTypes = new Set<string>();
  let edgesSvg = '';

  for (let ei = 0; ei < decisionGraph.edges.length; ei++) {
    const e = decisionGraph.edges[ei];
    const fromPos = nodePositions[e.from];
    const toPos = nodePositions[e.to];
    if (!fromPos || !toPos) continue;

    const fW = nodeW[e.from] ?? 145;
    const fH = nodeH[e.from] ?? 62;
    const tW = nodeW[e.to] ?? 145;
    const tH = nodeH[e.to] ?? 62;

    const ax = fromPos.right + fW / 2;
    const ay = fromPos.top + fH / 2;
    const bx = toPos.right + tW / 2;
    const by = toPos.top + tH / 2;

    const ec = edgeColorMap[e.type] ?? '#6b7280';
    if (!seenTypes.has(e.type)) {
      seenTypes.add(e.type);
      markerDefs.push(`<marker id="arr-${e.type}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${ec}"/></marker>`);
    }

    const prob = edgeProbabilities[ei] ?? 0;
    const probLabel = prob > 0.005 ? faPct0(prob) + '٪' : '';
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;

    edgesSvg += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${ec}" stroke-width="1.5" opacity="0.55" marker-end="url(#arr-${e.type})" />
`;
    if (probLabel) {
      edgesSvg += `<text x="${mx}" y="${my - 5}" fill="#ffffff" font-size="8" text-anchor="middle" paint-order="stroke" stroke="#07111b" stroke-width="3" font-family="Vazirmatn,Tahoma,sans-serif">${esc(e.label)}</text>
`;
      edgesSvg += `<text x="${mx}" y="${my + 6}" fill="${ec}" font-size="8" font-weight="bold" text-anchor="middle" paint-order="stroke" stroke="#07111b" stroke-width="3" font-family="Vazirmatn,Tahoma,sans-serif">${probLabel}</text>
`;
    }
  }

  // ── Cumulative chart SVG ──
  let cumulChartSvg = '';
  if (probabilityTrend && probabilityTrend.groups && probabilityTrend.groups.length === 3) {
    const chartW = 1000;
    const chartH = 280;
    const padL = 55;
    const padR = 20;
    const padT = 20;
    const padB = 40;
    const plotW = chartW - padL - padR;
    const plotH = chartH - padT - padB;

    const groupMap: Record<string, typeof probabilityTrend.groups[0]> = {};
    for (const g of probabilityTrend.groups) groupMap[g.group] = g;
    const bull = groupMap['bullish'];
    const neut = groupMap['neutral'];
    const bear = groupMap['bearish'];
    const maxDays = Math.max(bull?.trend.length ?? 0, neut?.trend.length ?? 0, bear?.trend.length ?? 0);

    const xOf = (day: number) => padL + plotW - ((day - 1) / Math.max(1, maxDays - 1)) * plotW;
    const yOf = (pct: number) => padT + plotH - pct * plotH;

    let gridLines = '';
    for (let p = 0; p <= 100; p += 20) {
      const y = yOf(p / 100);
      gridLines += `<line x1="${padL}" y1="${y}" x2="${chartW - padR}" y2="${y}" stroke="rgba(170,208,229,.12)" stroke-width="0.7" />
`;
      gridLines += `<text x="${padL - 8}" y="${y + 3.5}" text-anchor="end" fill="#9db4c2" font-size="9" font-family="Vazirmatn,Tahoma,sans-serif">${toPersianDigits(p.toString())}٪</text>
`;
    }
    let xLabels = '';
    for (let d = 1; d <= maxDays; d += 5) {
      xLabels += `<text x="${xOf(d)}" y="${chartH - 8}" text-anchor="middle" fill="#9db4c2" font-size="9" font-family="Vazirmatn,Tahoma,sans-serif">${toPersianDigits(d.toString())}</text>
`;
    }

    function buildGroupPolyline(trend: { day: number; cumulativeProb: number }[], color: string) {
      const pts = trend.map(d => `${xOf(d.day).toFixed(1)},${yOf(d.cumulativeProb).toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9" />\n`;
    }

    // Individual scenario lines (thin dashed)
    let indLines = '';
    if (probabilityTrend.scenarios) {
      for (const sc of probabilityTrend.scenarios) {
        const color = SCENARIO_COLORS[sc.scenarioKey] ?? '#9ca3af';
        const pts = sc.trend.map(d => `${xOf(d.day).toFixed(1)},${yOf(d.individualProb).toFixed(1)}`).join(' ');
        indLines += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1" stroke-linejoin="round" opacity="0.4" stroke-dasharray="3,2" />\n`;
      }
    }

    cumulChartSvg = `
      <h3 style="font-size:14px;font-weight:700;color:${D.text};margin:0 0 12px">نمودار روند احتمالات گروه‌ها</h3>
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px">
        <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:16px;height:3px;border-radius:2px;background:#16a34a"></span><span style="font-size:11px;color:#16a34a">گاوی</span></span>
        <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:16px;height:3px;border-radius:2px;background:#b45309"></span><span style="font-size:11px;color:#b45309">خنثی</span></span>
        <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:16px;height:3px;border-radius:2px;background:#dc2626"></span><span style="font-size:11px;color:#dc2626">خرسی</span></span>
      </div>
      <svg width="100%" viewBox="0 0 ${chartW} ${chartH}" style="min-width:600px;max-height:320px;background:#07111b;border-radius:8px">
        <rect x="0" y="0" width="${chartW}" height="${chartH}" fill="#07111b" rx="8"/>
        ${gridLines}
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${chartH - padB}" stroke="rgba(170,208,229,.2)" stroke-width="0.7"/>
        <line x1="${padL}" y1="${chartH - padB}" x2="${chartW - padR}" y2="${chartH - padB}" stroke="rgba(170,208,229,.2)" stroke-width="0.7"/>
        ${xLabels}
        <text x="${chartW / 2}" y="${chartH - 2}" text-anchor="middle" fill="#9db4c2" font-size="9" font-family="Vazirmatn,Tahoma,sans-serif">روز (۱ = امروز)</text>
        ${indLines}
        ${bull ? buildGroupPolyline(bull.trend, '#16a34a') : ''}
        ${neut ? buildGroupPolyline(neut.trend, '#b45309') : ''}
        ${bear ? buildGroupPolyline(bear.trend, '#dc2626') : ''}
      </svg>`;
  }

  // ── Per-scenario trend mini charts ──
  let scenarioChartsHtml = '';
  if (probabilityTrend && probabilityTrend.scenarios && probabilityTrend.scenarios.length === 9) {
    const maxDays = probabilityTrend.scenarios[0]?.trend?.length ?? 0;
    if (maxDays > 1) {
      for (const sc of probabilityTrend.scenarios) {
        const color = SCENARIO_COLORS[sc.scenarioKey] ?? '#9ca3af';
        const label = sc.label;
        const cW = 320;
        const cH = 120;
        const pL = 40; const pR = 10; const pT = 10; const pB = 20;
        const plW = cW - pL - pR;
        const plH = cH - pT - pB;

        let yMax = 0;
        for (const d of sc.trend) { if (d.individualProb > yMax) yMax = d.individualProb; }
        if (yMax <= 0) yMax = 0.1;
        const yPad = yMax * 0.15;

        const xO = (day: number) => pL + plW - ((day - 1) / Math.max(1, maxDays - 1)) * plW;
        const yO = (v: number) => pT + plH - ((v) / (yMax + yPad)) * plH;

        const pts = sc.trend.map(d => `${xO(d.day).toFixed(1)},${yO(d.individualProb).toFixed(1)}`).join(' ');
        const dirIcon = sc.trendDirection === 'rising' ? '↑' : sc.trendDirection === 'falling' ? '↓' : '→';

        scenarioChartsHtml += `
        <div style="border:1px solid ${color}33;border-radius:10px;padding:10px;background:${color}0d">
          <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:6px">${sc.scenarioKey} — ${esc(label)} ${dirIcon}</div>
          <svg width="100%" viewBox="0 0 ${cW} ${cH}" style="min-width:250px">
            <rect x="0" y="0" width="${cW}" height="${cH}" fill="#07111b" rx="6"/>
            <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>
            <circle cx="${xO(sc.trend[0]?.day ?? 1).toFixed(1)}" cy="${yO(sc.trend[0]?.individualProb ?? 0).toFixed(1)}" r="3" fill="${color}" stroke="#fff" stroke-width="1"/>
          </svg>
        </div>`;
      }
    }
  }

  // ── 30-day trend table ──
  let trendTableHtml = '';
  if (probabilityTrend && probabilityTrend.scenarios && probabilityTrend.scenarios.length === 9 && (probabilityTrend.scenarios[0]?.trend?.length ?? 0) > 1) {
    const totalDays = probabilityTrend.scenarios[0]?.trend?.length ?? 30;
    const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);
    const scenarioMap: Record<string, typeof probabilityTrend.scenarios[0]> = {};
    for (const s of probabilityTrend.scenarios) scenarioMap[s.scenarioKey] = s;
    const groupMap: Record<string, typeof probabilityTrend.groups[0]> = {};
    if (probabilityTrend.groups) {
      for (const g of probabilityTrend.groups) groupMap[g.group] = g;
    }

    const groupColors: Record<string, string> = { bearish: '#dc2626', neutral: '#6b7280', bullish: '#16a34a' };
    const groupLabels: Record<string, string> = { bearish: 'خرسی', neutral: 'خنثی', bullish: 'گاوی' };

    let tableRows = '';
    for (const key of SCENARIO_KEYS) {
      const sc = scenarioMap[key];
      if (!sc) continue;
      const gc = groupColors[sc.group] ?? '#6b7280';
      let dayCells = '';
      for (const day of allDays) {
        const dp = sc.trend.find(d => d.day === day);
        const isPeak = sc.peakDay === day;
        const indVal = dp ? toPersianDigits((dp.individualProb * 100).toFixed(1)) + '٪' : '—';
        const cumVal = dp ? toPersianDigits((dp.cumulativeProb * 100).toFixed(1)) + '٪' : '—';
        const bgStyle = isPeak ? `background:${gc}18;font-weight:900;` : '';
        dayCells += `<td style="${bgStyle}font-size:9px;text-align:center;padding:3px 2px;white-space:nowrap">${indVal}</td>`;
        dayCells += `<td style="${bgStyle}font-size:9px;text-align:center;padding:3px 2px;color:#9db4c2;white-space:nowrap">${cumVal}</td>`;
      }
      tableRows += `<tr><td style="font-size:10px;font-weight:700;color:${gc};padding:4px 8px;white-space:nowrap"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${gc};margin-left:4px"></span>${key} — ${esc(sc.label)}</td>${dayCells}</tr>\n`;
    }

    let groupRows = '';
    for (const g of ['bearish', 'neutral', 'bullish'] as const) {
      const gData = groupMap[g];
      if (!gData) continue;
      const gc = groupColors[g];
      let dayCells = '';
      for (const day of allDays) {
        const dp = gData.trend.find(d => d.day === day);
        dayCells += `<td colspan="2" style="font-size:9px;text-align:center;padding:4px 2px;font-weight:700;color:${gc};white-space:nowrap">${dp ? toPersianDigits((dp.cumulativeProb * 100).toFixed(1)) + '٪' : '—'}</td>`;
      }
      groupRows += `<tr><td style="font-size:10px;font-weight:700;color:${gc};padding:4px 8px;white-space:nowrap">تجمعی ${groupLabels[g]}</td>${dayCells}</tr>\n`;
    }

    const dayHeaders = allDays.map(d => `<th colspan="2" style="font-size:9px;padding:3px 2px;text-align:center">${toPersianDigits(d.toString())}</th>`).join('');
    const subHeaders = allDays.map(() => `<th style="font-size:7px;padding:1px;text-align:center;color:#9db4c2">اخ</th><th style="font-size:7px;padding:1px;text-align:center;color:#9db4c2">تج</th>`).join('');

    trendTableHtml = `
      <h3 style="font-size:14px;font-weight:700;color:${D.text};margin:24px 0 12px">جدول روند ۳۰ روزه احتمالات</h3>
      <div style="overflow-x:auto;border-radius:10px;border:1px solid ${D.line}">
        <table style="width:100%;border-collapse:collapse;min-width:1200px">
          <thead><tr><th style="font-size:10px;padding:4px 8px;text-align:right;position:sticky;right:0;background:#0b1c2b;z-index:1">سناریو</th>${dayHeaders}</tr>
          <tr style="background:rgba(170,208,229,.05)"><th></th>${subHeaders}</tr></thead>
          <tbody>${tableRows}<tr><td colspan="${1 + allDays.length * 2}" style="border-bottom:2px solid ${D.line}"></td></tr>${groupRows}</tbody>
        </table>
      </div>`;
  }

  // ── Narrative text ──
  const narrativeHtml = esc(narrative).replace(/\n/g, '<br>');

  // ── Scenario boxes ──
  let scenarioBoxes = '';
  for (const key of SCENARIO_KEYS) {
    const s = scenarios[key];
    if (!s) continue;
    const color = SCENARIO_COLORS[key];
    const contrib = pathContributions[key] ?? { trend: 0, breakout: 0, reversal: 0 };
    scenarioBoxes += `
        <div style="border:1px solid ${color};border-radius:12px;padding:12px;background:linear-gradient(160deg,${color}1f,rgba(8,22,35,.65))">
          <strong style="display:block;color:${color};font-size:20px;font-weight:900;margin-bottom:4px">${faPct0(s.probability / 100)}٪</strong>
          <span style="font-size:12px;font-weight:700;color:#ffffff">${SCENARIO_LABELS[key]}</span>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:2px">
            ${['trend', 'breakout', 'reversal'].map(b => `<div style="display:flex;align-items:center;justify-content:space-between;font-size:9px"><span style="color:#e0eaf0;display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${BRANCH_COLORS[b]}"></span>${BRANCH_LABELS[b]}</span><span style="font-weight:700;color:#ffffff">${faPct(contrib[b as 'trend' | 'breakout' | 'reversal'])}٪</span></div>`).join('')}
          </div>
          <small style="display:block;color:#e0eaf0;font-size:10px;margin-top:6px;direction:ltr;text-align:center">${faNum(s.targetMin)} — ${faNum(s.targetMax)}</small>
        </div>`;
  }

  // ── Full HTML ──
  const today = new Date();
  const persianDate = toPersianDigits(`${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`);

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>گراف تصمیم ${esc(symbolName)}</title>
<link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Vazirmatn, Tahoma, sans-serif; background: ${D.bg}; color: ${D.text}; line-height: 1.8; padding: 20px; }
  .container { max-width: 1200px; margin: 0 auto; }
  .header { text-align: center; padding: 30px 20px; margin-bottom: 24px; border: 1px solid ${D.line}; border-radius: 16px; background: linear-gradient(105deg, rgba(14,35,53,.94), rgba(8,22,35,.77)); box-shadow: 0 18px 55px rgba(0,0,0,.35); }
  .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
  .header .sub { font-size: 12px; color: ${D.muted}; }
  .header .date { font-size: 11px; color: ${D.muted}; margin-top: 6px; }
  .metric-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .metric-card { padding: 15px 16px; border: 1px solid ${D.line}; border-radius: 14px; background: linear-gradient(145deg, rgba(18,42,61,.85), rgba(9,24,38,.86)); }
  .metric-card .label { display: block; color: #ffffff; font-size: 12px; margin-bottom: 8px; }
  .metric-card .value { font-size: 18px; font-weight: 700; }
  .graph-section { margin-bottom: 24px; border: 1px solid ${D.line}; border-radius: 16px; overflow: hidden; background: radial-gradient(circle at 49% 49%, rgba(47,108,145,.12), transparent 36%), rgba(4,15,25,.72); }
  .graph-section svg { width: 100%; overflow: visible; }
  .scenarios-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .section { padding: 20px; border: 1px solid ${D.line}; border-radius: 16px; background: rgba(8,22,35,.76); margin-bottom: 24px; }
  .mini-charts { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .narrative { white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 2.2; direction: rtl; text-align: right; }
  .graph-node { cursor: pointer; transition: filter .2s; }
  .graph-node:hover { filter: brightness(1.3); }
  @media (max-width: 768px) { .scenarios-grid { grid-template-columns: repeat(3, 1fr); } .metric-cards { grid-template-columns: repeat(2, 1fr); } }
  @media print { body { background: #fff; color: #111; } .header, .metric-card, .section { border-color: #ddd; } }
</style>
</head>
<body>
<div class="container">
  <!-- Header -->
  <div class="header">
    <h1>گراف تصمیم ${esc(symbolName)}</h1>
    <div class="sub">مدل ۳ شاخه ای | پیرویی از روند، شکست، بازگشت | ۲۷ مسیر به ۹ سناریو</div>
    <div class="date">تاریخ تولید: ${persianDate} | نقطه مرجع: <b style="color:${D.cyan}">${faNum(currentPrice)}</b> ${esc(currencyUnit)}</div>
  </div>

  <!-- Metric Cards -->
  <div class="metric-cards">
    <div class="metric-card"><span class="label">مقدار مرجع</span><span class="value" style="color:${D.cyan}">${faNum(currentPrice)} ${esc(currencyUnit)}</span></div>
    <div class="metric-card"><span class="label">احتمال روند</span><span class="value" style="color:${D.cyan}">${faPct0(branchProbabilities.trend)}٪</span></div>
    <div class="metric-card"><span class="label">احتمال شکست</span><span class="value" style="color:${D.gold}">${faPct0(branchProbabilities.breakout)}٪</span></div>
    <div class="metric-card"><span class="label">احتمال بازگشت</span><span class="value" style="color:${D.purple}">${faPct0(branchProbabilities.reversal)}٪</span></div>
  </div>

  <!-- Decision Graph SVG -->
  <div class="graph-section">
    <div style="padding:14px 18px;border-bottom:1px solid ${D.line}"><h2 style="font-size:15px;font-weight:700">گراف تصمیم</h2></div>
    <div style="overflow:auto;padding:20px">
      <svg viewBox="0 0 ${DESIGN_W} ${DESIGN_H}" width="100%" style="min-width:800px;min-height:700px">
        <defs>${markerDefs.join('\n')}</defs>
        ${edgesSvg}
        ${nodesSvg}
      </svg>
    </div>
  </div>

  <!-- Scenario Boxes -->
  <div class="section">
    <h2 style="font-size:15px;font-weight:700;margin-bottom:14px">گره های نتیجه و سهم استراتژی ها</h2>
    <div class="scenarios-grid">${scenarioBoxes}</div>
  </div>

  <!-- Cumulative Chart -->
  ${cumulChartSvg ? `<div class="section">${cumulChartSvg}</div>` : ''}

  <!-- Per-Scenario Mini Charts -->
  ${scenarioChartsHtml ? `<div style="margin-bottom:24px"><h3 style="font-size:14px;font-weight:700;color:${D.text};margin:0 0 12px">نمودار روند احتمالات سناریوها</h3><div class="mini-charts">${scenarioChartsHtml}</div></div>` : ''}

  <!-- Trend Table -->
  ${trendTableHtml}

  <!-- Narrative -->
  <div class="section">
    <h2 style="font-size:15px;font-weight:700;margin-bottom:14px">متن تخصصی تحلیل گراف تصمیم</h2>
    <div class="narrative">${narrativeHtml}</div>
  </div>
</div>

<script>
// Interactive: hover node highlighting
(function() {
  document.querySelectorAll('.graph-node').forEach(function(node) {
    node.addEventListener('mouseenter', function() {
      var id = this.getAttribute('data-id');
      document.querySelectorAll('.graph-node').forEach(function(n) {
        if (n.getAttribute('data-id') !== id) n.style.opacity = '0.15';
      });
    });
    node.addEventListener('mouseleave', function() {
      document.querySelectorAll('.graph-node').forEach(function(n) {
        n.style.opacity = '1';
      });
    });
  });
})();
</script>
</body>
</html>`;

  // Trigger download
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${symbolName}-گراف-تصمیم.html`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}
