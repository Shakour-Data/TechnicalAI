// ═══════════════════════════════════════════════════════════════════════════════
// Standalone Interactive HTML+CSS+JS Export for Decision Graph
// All visuals are Canvas-based (NO SVG) with full interactivity
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

// ═══════════════════════════════════════════════════════════════════════════════
// Build the inline JavaScript (no backticks — string concat only)
// ═══════════════════════════════════════════════════════════════════════════════

function buildInlineJS(): string {
  return `
// ═══ DATA ═══
var DATA = window.__DG_DATA__;
var D = DATA.D;

// ═══ PERSIAN DIGITS ═══
function toFa(n) {
  var s = String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  var pd = ['\\u06F0','\\u06F1','\\u06F2','\\u06F3','\\u06F4','\\u06F5','\\u06F6','\\u06F7','\\u06F8','\\u06F9'];
  return s.replace(/[0-9]/g, function(d){ return pd[parseInt(d)]; });
}
function toFaStr(s) {
  var pd = ['\\u06F0','\\u06F1','\\u06F2','\\u06F3','\\u06F4','\\u06F5','\\u06F6','\\u06F7','\\u06F8','\\u06F9'];
  return String(s).replace(/[0-9]/g, function(d){ return pd[parseInt(d)]; });
}

// ═══ HELPERS ═══
function getNode(id) { for (var i=0;i<DATA.nodes.length;i++) if (DATA.nodes[i].id===id) return DATA.nodes[i]; return null; }
var SCENARIO_KEYS = ['SC1','SC2','SC3','SC4','SC5','SC6','SC7','SC8','SC9'];
var SCENARIO_LABELS = {SC1:'شوک نزولی',SC2:'نزولی شتاب‌دار',SC3:'نزولی قوی',SC4:'نزولی خفیف',SC5:'رنج',SC6:'صعودی خفیف',SC7:'صعودی قوی',SC8:'صعودی شتاب‌دار',SC9:'شوک صعودی'};
var SCENARIO_COLORS = {SC1:'#b91c1c',SC2:'#dc2626',SC3:'#ea580c',SC4:'#c2410c',SC5:'#b45309',SC6:'#047857',SC7:'#059669',SC8:'#0e7490',SC9:'#0891b2'};
var BRANCH_COLORS = {trend:D.cyan, breakout:D.gold, reversal:D.purple};
var BRANCH_LABELS = {trend:'پیروی از روند', breakout:'شکست', reversal:'بازگشت'};
var EDGE_COLORS = {'branch-trend':D.cyan,'branch-breakout':D.gold,'branch-reversal':D.purple,up:D.green,pullback:D.blue,down:D.orange,risk:D.red};
var LINE_COLORS = {SC1:'#b91c1c',SC2:'#dc2626',SC3:'#ea580c',SC4:'#f97316',SC5:'#f59e0b',SC6:'#65a30d',SC7:'#16a34a',SC8:'#059669',SC9:'#047857'};

var SCENARIO_META_LOCAL = {
  SC1:{label:'شوک نزولی',color:'#b91c1c'}, SC2:{label:'نزولی شتاب‌دار',color:'#dc2626'},
  SC3:{label:'نزولی قوی',color:'#ea580c'}, SC4:{label:'نزولی خفیف',color:'#c2410c'},
  SC5:{label:'رنج',color:'#b45309'}, SC6:{label:'صعودی خفیف',color:'#047857'},
  SC7:{label:'صعودی قوی',color:'#059669'}, SC8:{label:'صعودی شتاب‌دار',color:'#0e7490'},
  SC9:{label:'شوک صعودی',color:'#0891b2'}
};

// ═══════════════════════════════════════════════════════════════════
// SECTION 1: DECISION GRAPH (Canvas edges + HTML nodes)
// ═══════════════════════════════════════════════════════════════════
(function() {
  var canvas = document.getElementById('dg-canvas');
  var container = document.getElementById('dg-container');
  var nodesLayer = document.getElementById('dg-nodes');
  if (!canvas || !container || !nodesLayer) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;

  var DESIGN_W = 1200, DESIGN_H = 1100;
  var state = { filter: 'all', selectedNode: null, hoveredNode: null };

  // ── Node dimensions ──
  function nodeDims(n) {
    var isTerm = n.isTerminal || n.type==='terminal' || SCENARIO_KEYS.indexOf(n.id)>=0;
    var isEvt = n.type==='event';
    return { w: isTerm ? 175 : isEvt ? 158 : 155, h: isTerm ? 84 : isEvt ? 56 : 72 };
  }

  // ── Filter logic (matches React component) ──
  function computeVisibility(filter) {
    var edges = DATA.decisionGraph.edges;
    var nodes = DATA.decisionGraph.nodes;
    if (filter === 'all') {
      var allE = []; for (var i=0;i<edges.length;i++) allE.push(i);
      var allN = {}; for (var j=0;j<nodes.length;j++) allN[nodes[j].id]=true;
      return { visEdges: allE, visNodes: allN };
    }
    if (SCENARIO_KEYS.indexOf(filter) >= 0) {
      var eSet = {}, nSet = { ROOT: true };
      nSet[filter] = true;
      for (var i=0;i<edges.length;i++) {
        if (edges[i].to === filter) { eSet[i]=true; nSet[edges[i].from]=true; }
      }
      for (var i=0;i<edges.length;i++) {
        if (nSet[edges[i].to] && edges[i].to.indexOf('R')!==0) { eSet[i]=true; nSet[edges[i].from]=true; }
      }
      var arr=[]; for (var k in eSet) arr.push(parseInt(k));
      return { visEdges: arr, visNodes: nSet };
    }
    if (filter==='trend'||filter==='breakout'||filter==='reversal') {
      var bt = 'branch-'+filter;
      var eSet={}, nSet={ROOT:true};
      for (var i=0;i<edges.length;i++) {
        if (edges[i].type===bt) { eSet[i]=true; nSet[edges[i].from]=true; nSet[edges[i].to]=true; }
      }
      var exp={}; var expN={}; for (var k in nSet) expN[k]=true;
      for (var i=0;i<edges.length;i++) {
        if (expN[edges[i].from]) { exp[i]=true; expN[edges[i].to]=true; }
      }
      var arr=[]; for (var k in exp) arr.push(parseInt(k));
      return { visEdges: arr, visNodes: expN };
    }
    // Type filter
    var eSet={}, nSet={ROOT:true};
    for (var i=0;i<edges.length;i++) {
      if (edges[i].type===filter) { eSet[i]=true; nSet[edges[i].from]=true; nSet[edges[i].to]=true; }
    }
    var arr=[]; for (var k in eSet) arr.push(parseInt(k));
    return { visEdges: arr, visNodes: nSet };
  }

  // ── Scale ──
  function getScale() {
    var cw = container.clientWidth;
    var sx = cw / DESIGN_W;
    return sx;
  }

  // ── Resize canvas ──
  function resizeCanvas() {
    var w = container.clientWidth;
    var h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Draw edges ──
  function drawEdges() {
    var w = container.clientWidth, h = container.clientHeight;
    ctx.clearRect(0, 0, w, h);
    var sx = getScale();
    var edges = DATA.decisionGraph.edges;
    var pos = DATA.decisionGraph.nodePositions;
    var probs = DATA.decisionGraph.edgeProbabilities;
    var vis = computeVisibility(state.filter);
    var visSet = {}; for (var i=0;i<vis.visEdges.length;i++) visSet[vis.visEdges[i]]=true;

    for (var ei=0; ei<edges.length; ei++) {
      var e = edges[ei];
      var fp = pos[e.from], tp = pos[e.to];
      if (!fp || !tp) continue;
      var fn = getNode(e.from), tn = getNode(e.to);
      if (!fn || !tn) continue;
      var fd = nodeDims(fn), td = nodeDims(tn);
      var ax = (fp.right + fd.w/2)*sx, ay = (fp.top + fd.h/2)*sx;
      var bx = (tp.right + td.w/2)*sx, by = (tp.top + td.h/2)*sx;
      var dx = bx-ax, dy = by-ay, dist = Math.sqrt(dx*dx+dy*dy);
      if (dist === 0) continue;
      var bend = Math.min(52, Math.max(18, dist*0.11));
      var mx = (ax+bx)/2, my = (ay+by)/2;
      var nx = -dy/dist, ny = dx/dist;
      var cx = mx + nx*bend, cy = my + ny*bend;
      var isVis = visSet[ei];
      var ec = EDGE_COLORS[e.type] || '#6b7280';

      // Draw curve
      ctx.save();
      ctx.globalAlpha = isVis ? 0.72 : 0.06;
      ctx.strokeStyle = ec;
      ctx.lineWidth = isVis ? 2 : 0.8;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx, cy, bx, by);
      ctx.stroke();

      // Arrow
      if (isVis) {
        var t = 0.92;
        var arx = (1-t)*(1-t)*ax + 2*(1-t)*t*cx + t*t*bx;
        var ary = (1-t)*(1-t)*ay + 2*(1-t)*t*cy + t*t*by;
        var atx = 2*(1-t)*(cx-ax) + 2*t*(bx-cx);
        var aty = 2*(1-t)*(cy-ay) + 2*t*(by-cy);
        var ang = Math.atan2(aty, atx);
        var al = 8;
        ctx.fillStyle = ec;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - al*Math.cos(ang-0.4), by - al*Math.sin(ang-0.4));
        ctx.lineTo(bx - al*Math.cos(ang+0.4), by - al*Math.sin(ang+0.4));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Labels on visible edges (not branch edges)
      if (isVis && ei >= 6) {
        var prob = probs[ei] || 0;
        var probLabel = toFa(prob*100) + '٪';
        ctx.save();
        ctx.font = '10px Vazirmatn, Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = '#07111b';
        ctx.lineWidth = 4; ctx.lineJoin = 'round';
        ctx.strokeText(e.label, cx, cy-5);
        ctx.fillText(e.label, cx, cy-5);
        ctx.font = 'bold 9px Vazirmatn, Tahoma, sans-serif';
        ctx.fillStyle = ec;
        ctx.globalAlpha = 0.9;
        ctx.strokeText(probLabel, cx, cy+8);
        ctx.fillText(probLabel, cx, cy+8);
        ctx.restore();
      }
    }
  }

  // ── Render nodes as HTML ──
  var nodeElements = {};
  function renderNodes() {
    nodesLayer.innerHTML = '';
    nodeElements = {};
    var sx = getScale();
    var vis = computeVisibility(state.filter);
    var pos = DATA.decisionGraph.nodePositions;
    var scProbs = DATA.decisionGraph.scenarioProbabilities;
    var bProbs = DATA.decisionGraph.branchProbabilities;
    var nodes = DATA.decisionGraph.nodes;

    for (var i=0; i<nodes.length; i++) {
      var n = nodes[i];
      var p = pos[n.id]; if (!p) continue;
      var isVis = vis.visNodes[n.id];
      var isRoot = n.id === 'ROOT';
      var isTerm = n.isTerminal || n.type==='terminal' || SCENARIO_KEYS.indexOf(n.id)>=0;
      var isEvt = n.type==='event';
      var isMainBr = ['N_TREND','N_BREAK','N_REVERSAL'].indexOf(n.id)>=0;
      var isSubBr = n.type==='decision' && !isRoot && !isMainBr;
      var dm = nodeDims(n);

      var el = document.createElement('div');
      el.style.cssText = 'position:absolute;cursor:pointer;text-align:center;padding:8px 9px;border-radius:13px;transition:transform .2s,filter .2s,opacity .2s,box-shadow .2s;user-select:none;';
      el.style.right = (p.right * sx) + 'px';
      el.style.top = (p.top * sx) + 'px';
      el.style.width = dm.w + 'px';
      el.style.minWidth = dm.w + 'px';
      el.style.minHeight = dm.h + 'px';
      el.style.opacity = isVis ? '1' : '0.12';

      var col = SCENARIO_COLORS[n.id] || n.color || '#6b7280';
      var bw = isTerm ? '2px' : '1px';
      var bd = isEvt ? 'dotted' : 'solid';
      el.style.border = bw + ' ' + bd + ' ' + col;

      if (isTerm) {
        el.style.background = 'linear-gradient(160deg,' + col + '1f,rgba(8,22,35,.65))';
        el.style.boxShadow = 'inset 0 0 24px ' + col + '18, 0 10px 25px rgba(0,0,0,.25)';
      } else if (isRoot) {
        el.style.background = 'linear-gradient(145deg,rgba(18,42,61,.97),rgba(6,21,34,.96))';
        el.style.boxShadow = 'inset 0 0 22px ' + D.cyan + '1f, 0 10px 25px rgba(0,0,0,.25)';
      } else {
        el.style.background = 'linear-gradient(145deg,rgba(18,42,61,.97),rgba(6,21,34,.96))';
        el.style.boxShadow = 'inset 0 0 22px ' + col + '22, 0 10px 25px rgba(0,0,0,.25)';
      }

      // Inner content
      if (isRoot) {
        el.innerHTML = '<div style="font-size:14px;font-weight:800;color:#fff;line-height:1.45">ریشه تصمیم</div>' +
          '<div style="font-size:10px;color:' + D.cyan + ';font-weight:700;margin-top:3px">Decision Root</div>';
      } else if (isMainBr) {
        var pv = bProbs[n.id==='N_TREND'?'trend':n.id==='N_BREAK'?'breakout':'reversal'] || 0;
        el.innerHTML = '<div style="font-size:13px;font-weight:800;color:#fff;line-height:1.45">' + n.title + '</div>' +
          '<div style="font-size:10px;color:' + col + ';font-weight:700;margin-top:2px">' + n.titleEn + '</div>' +
          '<div style="font-size:11px;color:' + col + ';margin-top:3px;font-weight:800">' + toFa(pv*100) + '٪</div>';
      } else if (isSubBr) {
        // Find edge prob from parent
        var ep = 0;
        for (var ei=0;ei<DATA.decisionGraph.edges.length;ei++) {
          var ed = DATA.decisionGraph.edges[ei];
          if (ed.to === n.id) { ep = DATA.decisionGraph.edgeProbabilities[ei] || 0; break; }
        }
        el.innerHTML = '<div style="font-size:12px;font-weight:800;color:#fff;line-height:1.45">' + n.title + '</div>' +
          '<div style="font-size:9px;color:' + col + ';font-weight:700;margin-top:1px">' + n.titleEn + '</div>' +
          '<div style="font-size:10px;color:#d4e8f0;margin-top:2px">' + toFa(ep*100) + '٪</div>';
      } else if (isEvt) {
        el.innerHTML = '<div style="font-size:11px;font-weight:800;color:#fff;line-height:1.35">' + n.title + '</div>' +
          '<div style="font-size:9px;color:' + col + ';font-weight:700;margin-top:1px">' + n.titleEn + '</div>';
      } else if (isTerm) {
        var scProb = scProbs[n.id] || 0;
        el.innerHTML = '<div style="font-size:12px;font-weight:800;color:#fff;line-height:1.4">' + (SCENARIO_LABELS[n.id]||n.title) + '</div>' +
          '<span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999;background:' + col + '30;color:#fff;font-size:16px;font-weight:900;text-shadow:0 0 8px ' + col + '88">' + toFa(scProb*100) + '٪</span>';
      }

      // Events
      (function(nodeId, elem) {
        elem.addEventListener('click', function() {
          state.selectedNode = state.selectedNode === nodeId ? null : nodeId;
          updateNodeStyles();
        });
        elem.addEventListener('mouseenter', function() {
          state.hoveredNode = nodeId;
          updateNodeStyles();
        });
        elem.addEventListener('mouseleave', function() {
          state.hoveredNode = null;
          updateNodeStyles();
        });
      })(n.id, el);

      nodesLayer.appendChild(el);
      nodeElements[n.id] = el;
    }
  }

  function updateNodeStyles() {
    for (var id in nodeElements) {
      var el = nodeElements[id];
      var isSelected = state.selectedNode === id;
      var isHovered = state.hoveredNode === id;
      var col = SCENARIO_COLORS[id] || (getNode(id)||{}).color || '#6b7280';
      if (isSelected) {
        el.style.transform = 'translateY(-4px) scale(1.025)';
        el.style.filter = 'brightness(1.18)';
        el.style.boxShadow = '0 0 0 2px ' + col + '47, 0 0 28px ' + col + '40';
      } else if (isHovered) {
        el.style.transform = 'translateY(-4px) scale(1.025)';
        el.style.filter = 'brightness(1.18)';
        el.style.boxShadow = '0 0 0 2px ' + col + '47, 0 0 28px ' + col + '40';
      } else {
        el.style.transform = 'none';
        el.style.filter = 'none';
      }
      // Dim non-selected when something is selected
      if (state.selectedNode && state.selectedNode !== id) {
        el.style.opacity = '0.15';
      }
    }
  }

  // ── Filter buttons ──
  var filterBtns = container.parentElement.querySelectorAll('.dg-filter-btn');
  for (var i=0; i<filterBtns.length; i++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.getAttribute('data-filter');
        state.filter = key;
        state.selectedNode = null;
        // Update active state
        for (var j=0;j<filterBtns.length;j++) {
          var b = filterBtns[j];
          var isAct = b.getAttribute('data-filter') === key;
          var bCol = b.getAttribute('data-color') || D.cyan;
          b.style.borderColor = isAct ? bCol + 'b3' : 'rgba(255,255,255,.15)';
          b.style.background = isAct ? bCol + '24' : 'rgba(255,255,255,.04)';
          b.style.boxShadow = isAct ? '0 0 18px ' + bCol + '1a' : 'none';
          b.style.transform = isAct ? 'translateY(-1px)' : 'none';
        }
        renderNodes();
        drawEdges();
      });
    })(filterBtns[i]);
  }

  // Reset button
  var resetBtn = document.getElementById('dg-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      state.filter = 'all';
      state.selectedNode = null;
      for (var j=0;j<filterBtns.length;j++) {
        var b = filterBtns[j];
        b.style.borderColor = 'rgba(255,255,255,.15)';
        b.style.background = 'rgba(255,255,255,.04)';
        b.style.boxShadow = 'none';
        b.style.transform = 'none';
      }
      renderNodes();
      drawEdges();
    });
  }

  // ── Init & Resize ──
  function fullRedraw() {
    resizeCanvas();
    renderNodes();
    drawEdges();
  }
  fullRedraw();
  var ro; try { ro = new ResizeObserver(function(){ fullRedraw(); }); ro.observe(container); } catch(e) {}
})();

// ═══════════════════════════════════════════════════════════════════
// SECTION 2: CUMULATIVE PROBABILITY CHART (Canvas)
// ═══════════════════════════════════════════════════════════════════
(function() {
  var canvas = document.getElementById('cumul-canvas');
  var tooltipEl = document.getElementById('cumul-tooltip');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var trend = DATA.probabilityTrend;
  if (!trend || !trend.groups || trend.groups.length < 3) return;

  var gMap = {}; for (var i=0;i<trend.groups.length;i++) gMap[trend.groups[i].group] = trend.groups[i];
  var sMap = {}; for (var i=0;i<trend.scenarios.length;i++) sMap[trend.scenarios[i].scenarioKey] = trend.scenarios[i];
  var bull = gMap['bullish'], neut = gMap['neutral'], bear = gMap['bearish'];
  if (!bull || !neut || !bear) return;
  var maxDays = Math.max(bull.trend.length, neut.trend.length, bear.trend.length);

  var cW = 1100, cH = 300, pL=55, pR=20, pT=20, pB=40;
  var plW = cW-pL-pR, plH = cH-pT-pB;
  var hoveredDay = null;

  function xOf(d) { return pL + plW - ((d-1)/Math.max(1,maxDays-1))*plW; }
  function yOf(p) { return pT + plH - p*plH; }

  function resize() {
    var parent = canvas.parentElement;
    var w = parent.clientWidth, h = cH;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w+'px'; canvas.style.height = h+'px';
    ctx.setTransform(dpr * w/cW, 0, 0, dpr * h/cH, 0, 0);
  }

  function draw() {
    ctx.clearRect(0,0,cW,cH);
    // Grid
    ctx.strokeStyle = 'rgba(170,208,229,.12)'; ctx.lineWidth = 0.7;
    for (var p=0;p<=100;p+=20) {
      var y=yOf(p/100);
      ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(cW-pR,y); ctx.stroke();
      ctx.fillStyle = '#9db4c2'; ctx.font = '10px Vazirmatn,Tahoma,sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(toFaStr(p)+'٪', pL-8, y+3.5);
    }
    // X labels
    ctx.textAlign = 'center'; ctx.fillStyle = '#9db4c2';
    for (var d=1;d<=maxDays;d+=5) {
      ctx.fillText(toFaStr(d), xOf(d), cH-8);
    }
    // Axes
    ctx.strokeStyle = 'rgba(170,208,229,.2)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(pL,pT); ctx.lineTo(pL,cH-pB); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pL,cH-pB); ctx.lineTo(cW-pR,cH-pB); ctx.stroke();

    // Individual scenario dashed lines
    for (var i=0;i<trend.scenarios.length;i++) {
      var sc = trend.scenarios[i];
      var col = SCENARIO_COLORS[sc.scenarioKey] || '#9ca3af';
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
      ctx.setLineDash([3,2]);
      ctx.beginPath();
      for (var j=0;j<sc.trend.length;j++) {
        var px = xOf(sc.trend[j].day), py = yOf(sc.trend[j].individualProb);
        if (j===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }

    // Group lines
    var gColors = {bullish:'#16a34a', neutral:'#b45309', bearish:'#dc2626'};
    var gArr = [bear, neut, bull];
    var gKeys = ['bearish','neutral','bullish'];
    for (var gi=0;gi<gArr.length;gi++) {
      var g = gArr[gi]; if (!g) continue;
      var col = gColors[gKeys[gi]];
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.8; ctx.globalAlpha = 0.95;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      for (var j=0;j<g.trend.length;j++) {
        var px = xOf(g.trend[j].day), py = yOf(g.trend[j].cumulativeProb);
        if (j===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.stroke();
      // Dots
      ctx.fillStyle = col;
      for (var j=0;j<g.trend.length;j++) {
        ctx.beginPath(); ctx.arc(xOf(g.trend[j].day), yOf(g.trend[j].cumulativeProb), 2.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    // Hover line
    if (hoveredDay !== null) {
      ctx.save(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6;
      ctx.setLineDash([3,3]);
      var hx = xOf(hoveredDay);
      ctx.beginPath(); ctx.moveTo(hx, pT); ctx.lineTo(hx, cH-pB); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
  }

  function showTooltip(day) {
    if (!tooltipEl) return;
    var html = '<div style="font-weight:bold;margin-bottom:4px">روز ' + toFaStr(day) + '</div>';
    var gLabels = {bullish:'گاوی', neutral:'خنثی', bearish:'خرسی'};
    var gColors = {bullish:'#16a34a', neutral:'#b45309', bearish:'#dc2626'};
    for (var gi=0;gi<['bearish','neutral','bullish'].length;gi++) {
      var gk = ['bearish','neutral','bullish'][gi];
      var g = gMap[gk]; if (!g) continue;
      var dp = null; for (var j=0;j<g.trend.length;j++) if (g.trend[j].day===day) { dp=g.trend[j]; break; }
      if (!dp) continue;
      html += '<div style="display:flex;justify-content:space-between;gap:12px"><span>' + gLabels[gk] + '</span><span style="font-weight:bold;color:' + gColors[gk] + '">' + (dp.cumulativeProb*100).toFixed(1) + '٪</span></div>';
    }
    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';
    var canvasRect = canvas.getBoundingClientRect();
    var parentW = canvas.parentElement.clientWidth;
    var xRatio = parentW / cW;
    var xPos = xOf(day) * xRatio + 10;
    tooltipEl.style.left = xPos + 'px';
    tooltipEl.style.top = '10px';
  }

  canvas.addEventListener('mousemove', function(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = cW / rect.width;
    var svgX = (e.clientX - rect.left) * scaleX;
    var closestDay = 1, closestDist = Infinity;
    for (var d=1;d<=maxDays;d++) { var dist = Math.abs(xOf(d)-svgX); if (dist<closestDist) { closestDist=dist; closestDay=d; } }
    if (closestDist < 40) { hoveredDay = closestDay; showTooltip(closestDay); }
    else { hoveredDay = null; if (tooltipEl) tooltipEl.style.display='none'; }
    draw();
  });
  canvas.addEventListener('mouseleave', function() { hoveredDay = null; if (tooltipEl) tooltipEl.style.display='none'; draw(); });

  resize(); draw();
  var ro; try { ro = new ResizeObserver(function(){ resize(); draw(); }); ro.observe(canvas.parentElement); } catch(e) {}
})();

// ═══════════════════════════════════════════════════════════════════
// SECTION 3: PER-SCENARIO MULTI-SELECT CHARTS (Canvas)
// ═══════════════════════════════════════════════════════════════════
(function() {
  var trend = DATA.probabilityTrend;
  if (!trend || !trend.scenarios || trend.scenarios.length < 9 || !trend.scenarios[0].trend || trend.scenarios[0].trend.length < 2) return;

  var maxDays = trend.scenarios[0].trend.length;
  var selectedKeys = {}; for (var i=0;i<SCENARIO_KEYS.length;i++) selectedKeys[SCENARIO_KEYS[i]] = true;

  // Individual chart
  var indCanvas = document.getElementById('ind-canvas');
  var indTooltip = document.getElementById('ind-tooltip');
  // Cumulative chart
  var cumCanvas = document.getElementById('sc-cum-canvas');
  var cumTooltip = document.getElementById('sc-cum-tooltip');

  function setupChart(canvas, tooltip, mode) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var cW = 1100, cH = 300, pL=55, pR=20, pT=20, pB=40;
    var plW = cW-pL-pR, plH = cH-pT-pB;
    var hoveredDay = null;

    function getScenarios() { return trend.scenarios.filter(function(s){ return selectedKeys[s.scenarioKey]; }); }

    function yRange() {
      var scs = getScenarios();
      var yMin=0, yMax=0;
      for (var i=0;i<scs.length;i++) for (var j=0;j<scs[i].trend.length;j++) {
        var v = mode==='individual' ? scs[i].trend[j].individualProb : scs[i].trend[j].cumulativeProb;
        if (v>yMax) yMax=v;
      }
      if (yMax<=0) yMax=0.1;
      var range = yMax-yMin, pad = range*0.15;
      return { min: Math.max(0,yMin-pad*0.3), max: yMax+pad };
    }

    function xOf(d) { return pL + plW - ((d-1)/Math.max(1,maxDays-1))*plW; }
    function yOf(v) { var yr=yRange(); return pT + plH - ((v-yr.min)/Math.max(0.001,yr.max-yr.min))*plH; }

    function resize() {
      var parent = canvas.parentElement; var w = parent.clientWidth, h = cH;
      canvas.width = w*dpr; canvas.height = h*dpr;
      canvas.style.width = w+'px'; canvas.style.height = h+'px';
      ctx.setTransform(dpr*w/cW, 0, 0, dpr*h/cH, 0, 0);
    }

    function draw() {
      ctx.clearRect(0,0,cW,cH);
      var yr = yRange();
      // Grid
      var range = yr.max-yr.min;
      var rawStep = range/5;
      var steps = [0.01,0.02,0.025,0.05,0.1,0.15,0.2,0.25,0.5,1.0];
      var step = steps[0]; for (var si=0;si<steps.length;si++) if (steps[si]>=rawStep) { step=steps[si]; break; }
      var gridMin = Math.floor(yr.min/step)*step;
      var gridMax = Math.ceil(yr.max/step)*step;
      ctx.strokeStyle = 'rgba(170,208,229,.12)'; ctx.lineWidth = 0.7;
      for (var v=gridMin; v<=gridMax+step*0.01; v+=step) {
        var y = yOf(v); if (y<pT-2||y>cH-pB+2) continue;
        ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(cW-pR,y); ctx.stroke();
        ctx.fillStyle = '#9db4c2'; ctx.font = '9px Vazirmatn,Tahoma,sans-serif'; ctx.textAlign = 'right';
        var pVal = v*100; var pLabel = Number.isInteger(pVal) ? String(pVal) : pVal.toFixed(step<0.05?2:1);
        ctx.fillText(toFaStr(pLabel)+'%', pL-6, y+3.5);
      }
      // X labels
      ctx.textAlign = 'center'; ctx.fillStyle = '#9db4c2'; ctx.font = '8px Vazirmatn,Tahoma,sans-serif';
      for (var d=1;d<=maxDays;d+=5) ctx.fillText(toFaStr(d), xOf(d), cH-8);
      // Axes
      ctx.strokeStyle = 'rgba(170,208,229,.2)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(pL,pT); ctx.lineTo(pL,cH-pB); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pL,cH-pB); ctx.lineTo(cW-pR,cH-pB); ctx.stroke();

      // Lines
      var scs = getScenarios();
      for (var i=0;i<scs.length;i++) {
        var sc = scs[i]; var col = LINE_COLORS[sc.scenarioKey]||'#9ca3af';
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.9;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        for (var j=0;j<sc.trend.length;j++) {
          var vv = mode==='individual' ? sc.trend[j].individualProb : sc.trend[j].cumulativeProb;
          var px = xOf(sc.trend[j].day), py = yOf(vv);
          if (j===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.stroke();
        // Start dot
        var firstV = mode==='individual' ? sc.trend[0].individualProb : sc.trend[0].cumulativeProb;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(xOf(sc.trend[0].day), yOf(firstV), 3.5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(xOf(sc.trend[0].day), yOf(firstV), 3.5, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }

      // Hover line
      if (hoveredDay !== null) {
        ctx.save(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6;
        ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(xOf(hoveredDay),pT); ctx.lineTo(xOf(hoveredDay),cH-pB); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
    }

    function showTooltip(day) {
      if (!tooltip) return;
      var scs = getScenarios();
      var html = '<div style="font-weight:bold;margin-bottom:4px">روز ' + toFaStr(day) + '</div>';
      for (var i=0;i<scs.length;i++) {
        var sc = scs[i]; var col = LINE_COLORS[sc.scenarioKey]||'#9ca3af';
        var dp = null; for (var j=0;j<sc.trend.length;j++) if (sc.trend[j].day===day) { dp=sc.trend[j]; break; }
        if (!dp) continue;
        var val = mode==='individual' ? dp.individualProb : dp.cumulativeProb;
        var dir = sc.trendDirection==='rising'?'↑':sc.trendDirection==='falling'?'↓':'→';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
          '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + col + ';margin-left:4px"></span>' + sc.label + ' ' + dir + '</span>' +
          '<span style="font-weight:bold;color:' + col + '">' + (val*100).toFixed(1) + '٪</span></div>';
      }
      tooltip.innerHTML = html; tooltip.style.display = 'block';
      var parentW = canvas.parentElement.clientWidth;
      var xRatio = parentW / cW;
      tooltip.style.left = (xOf(day)*xRatio + 10) + 'px';
      tooltip.style.top = '10px';
    }

    canvas.addEventListener('mousemove', function(e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = cW / rect.width;
      var svgX = (e.clientX - rect.left) * scaleX;
      var closestDay=1, closestDist=Infinity;
      for (var d=1;d<=maxDays;d++) { var dist=Math.abs(xOf(d)-svgX); if (dist<closestDist) { closestDist=dist; closestDay=d; } }
      if (closestDist < 40) { hoveredDay=closestDay; showTooltip(closestDay); }
      else { hoveredDay=null; if (tooltip) tooltip.style.display='none'; }
      draw();
    });
    canvas.addEventListener('mouseleave', function() { hoveredDay=null; if (tooltip) tooltip.style.display='none'; draw(); });

    return { resize: function() { resize(); draw(); }, draw: draw };
  }

  var indChart = setupChart(indCanvas, indTooltip, 'individual');
  var cumChart = setupChart(cumCanvas, cumTooltip, 'cumulative');

  // Toggle buttons
  var toggleBtns = document.querySelectorAll('.sc-toggle-btn');
  for (var i=0;i<toggleBtns.length;i++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.getAttribute('data-key');
        selectedKeys[key] = !selectedKeys[key];
        btn.style.opacity = selectedKeys[key] ? '1' : '0.35';
        btn.style.borderColor = selectedKeys[key] ? 'rgba(170,208,229,.3)' : 'transparent';
        btn.style.background = selectedKeys[key] ? 'rgba(170,208,229,.08)' : 'rgba(170,208,229,.03)';
        if (indChart) indChart.resize();
        if (cumChart) cumChart.resize();
      });
    })(toggleBtns[i]);
  }

  // Resize
  var ro; try { ro = new ResizeObserver(function(){ if (indChart) indChart.resize(); if (cumChart) cumChart.resize(); }); if (indCanvas) ro.observe(indCanvas.parentElement); if (cumCanvas) ro.observe(cumCanvas.parentElement); } catch(e) {}
})();
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Export Function
// ═══════════════════════════════════════════════════════════════════════════════

export function exportDecisionGraphHTML(data: DecisionGraphExportData): void {
  const { symbolName, currentPrice, currencyUnit, scenarios, decisionGraph, probabilityTrend, branchProbabilities, pathContributions, narrative } = data;

  const SCENARIO_LABELS: Record<string, string> = {
    SC1: 'شوک نزولی', SC2: 'نزولی شتاب‌دار', SC3: 'نزولی قوی', SC4: 'نزولی خفیف',
    SC5: 'رنج',
    SC6: 'صعودی خفیف', SC7: 'صعودی قوی', SC8: 'صعودی شتاب‌دار', SC9: 'شوک صعودی',
  };

  const SCENARIO_COLORS: Record<string, string> = {
    SC1: '#b91c1c', SC2: '#dc2626', SC3: '#ea580c', SC4: '#c2410c', SC5: '#b45309',
    SC6: '#047857', SC7: '#059669', SC8: '#0e7490', SC9: '#0891b2',
  };

  const LINE_COLORS: Record<string, string> = {
    SC1: '#b91c1c', SC2: '#dc2626', SC3: '#ea580c', SC4: '#f97316', SC5: '#f59e0b',
    SC6: '#65a30d', SC7: '#16a34a', SC8: '#059669', SC9: '#047857',
  };

  const BRANCH_LABELS: Record<string, string> = { trend: 'پیروی از روند', breakout: 'شکست', reversal: 'بازگشت' };
  const BRANCH_COLORS: Record<string, string> = { trend: '#3ad5db', breakout: '#ffb11b', reversal: '#a04ac5' };

  const D = {
    bg: '#07111b', bg2: '#0b1c2b', line: 'rgba(170,208,229,.18)', text: '#eaf5fb', muted: '#9db4c2',
    cyan: '#3ad5db', blue: '#4186ff', purple: '#a04ac5', gold: '#ffb11b', orange: '#ff7b32',
    red: '#ef4d62', green: '#34c98b',
  };

  // ── Filter buttons HTML ──
  const TYPE_FILTERS = [
    { key: 'all', label: 'همه مسیرها' }, { key: 'up', label: 'صعودی' },
    { key: 'pullback', label: 'رنج و خنثی' }, { key: 'down', label: 'نزولی' }, { key: 'risk', label: 'شوک و ریسک' },
  ];
  const BRANCH_FILTERS = [
    { key: 'trend', label: 'پیروی از روند', color: D.cyan },
    { key: 'breakout', label: 'شکست', color: D.gold },
    { key: 'reversal', label: 'بازگشت', color: D.purple },
  ];

  let filterBtnsHtml = '';
  for (const f of TYPE_FILTERS) {
    filterBtnsHtml += `<button class="dg-filter-btn" data-filter="${f.key}" data-color="${D.cyan}" style="color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:10px;background:rgba(255,255,255,.04);padding:8px 11px;font-family:inherit;font-size:12px;cursor:pointer;transition:.2s ease">${esc(f.label)}</button>`;
  }
  filterBtnsHtml += '<span style="color:rgba(170,208,229,.18);margin:0 4px;user-select:none">│</span>';
  for (const f of BRANCH_FILTERS) {
    filterBtnsHtml += `<button class="dg-filter-btn" data-filter="${f.key}" data-color="${f.color}" style="color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:10px;background:rgba(255,255,255,.04);padding:8px 11px;font-family:inherit;font-size:12px;cursor:pointer;transition:.2s ease">${esc(f.label)}</button>`;
  }
  filterBtnsHtml += '<span style="color:rgba(170,208,229,.18);margin:0 4px;user-select:none">│</span>';
  for (const key of SCENARIO_KEYS) {
    const col = SCENARIO_COLORS[key];
    filterBtnsHtml += `<button class="dg-filter-btn" data-filter="${key}" data-color="${col}" style="color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:10px;background:rgba(255,255,255,.04);padding:8px 11px;font-family:inherit;font-size:12px;cursor:pointer;transition:.2s ease">${esc(SCENARIO_LABELS[key])}</button>`;
  }

  // ── Scenario boxes HTML ──
  let scenarioBoxesHtml = '';
  for (const key of SCENARIO_KEYS) {
    const s = scenarios[key];
    if (!s) continue;
    const color = SCENARIO_COLORS[key];
    const contrib = pathContributions[key] ?? { trend: 0, breakout: 0, reversal: 0 };
    scenarioBoxesHtml += `
        <div style="border:1px solid ${color};border-radius:12px;padding:12px;background:linear-gradient(160deg,${color}1f,rgba(8,22,35,.65))">
          <strong style="display:block;color:${color};font-size:20px;font-weight:900;margin-bottom:4px">${faPct0(s.probability / 100)}٪</strong>
          <span style="font-size:12px;font-weight:700;color:#ffffff">${SCENARIO_LABELS[key]}</span>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:2px">
            ${['trend', 'breakout', 'reversal'].map(b => `<div style="display:flex;align-items:center;justify-content:space-between;font-size:9px"><span style="color:#e0eaf0;display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${BRANCH_COLORS[b]}"></span>${BRANCH_LABELS[b]}</span><span style="font-weight:700;color:#ffffff">${faPct(contrib[b as 'trend' | 'breakout' | 'reversal'])}٪</span></div>`).join('')}
          </div>
          <small style="display:block;color:#e0eaf0;font-size:10px;margin-top:6px;direction:ltr;text-align:center">${faNum(s.targetMin)} — ${faNum(s.targetMax)}</small>
        </div>`;
  }

  // ── Scenario toggle buttons (for per-scenario charts) ──
  let toggleBtnsHtml = '';
  for (const sc of probabilityTrend?.scenarios ?? []) {
    const col = LINE_COLORS[sc.scenarioKey] || '#9ca3af';
    const dirIcon = sc.trendDirection === 'rising' ? '↑' : sc.trendDirection === 'falling' ? '↓' : '→';
    const curVal = sc.trend[0] ? (sc.trend[0].individualProb * 100).toFixed(1) : '0';
    toggleBtnsHtml += `<button class="sc-toggle-btn" data-key="${sc.scenarioKey}" style="display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:8px;border:1px solid rgba(170,208,229,.3);background:rgba(170,208,229,.08);cursor:pointer;opacity:1;transition:all .15s;font-family:inherit">
      <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${col}"></span>
      <span style="font-size:10px;color:#eaf5fb">${sc.scenarioKey}</span>
      <span style="font-size:10px;color:${col}">${dirIcon}</span>
      <span style="font-size:9px;color:#9db4c2" class="sc-toggle-val">${toPersianDigits(curVal)}٪</span>
    </button>`;
  }

  // ── 30-day trend table ──
  let trendTableHtml = '';
  if (probabilityTrend && probabilityTrend.scenarios && probabilityTrend.scenarios.length === 9 && (probabilityTrend.scenarios[0]?.trend?.length ?? 0) > 1) {
    const totalDays = probabilityTrend.scenarios[0]?.trend?.length ?? 30;
    const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);
    const scenarioMap: Record<string, (typeof probabilityTrend.scenarios)[number]> = {};
    for (const s of probabilityTrend.scenarios) scenarioMap[s.scenarioKey] = s;
    const groupMap: Record<string, (typeof probabilityTrend.groups)[number]> = {};
    if (probabilityTrend.groups) for (const g of probabilityTrend.groups) groupMap[g.group] = g;
    const groupColors: Record<string, string> = { bearish: '#dc2626', neutral: '#6b7280', bullish: '#16a34a' };
    const groupLabels: Record<string, string> = { bearish: 'خرسی', neutral: 'خنثی', bullish: 'گاوی' };

    let tableRows = '';
    for (const key of SCENARIO_KEYS) {
      const sc = scenarioMap[key]; if (!sc) continue;
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
      const gData = groupMap[g]; if (!gData) continue;
      const gc = groupColors[g];
      let dayCells = '';
      for (const day of allDays) {
        const dp = gData.trend.find(d => d.day === day);
        dayCells += `<td colspan="2" style="font-size:9px;text-align:center;padding:4px 2px;font-weight:700;color:${gc};white-space:nowrap">${dp ? toPersianDigits((dp.cumulativeProb * 100).toFixed(1)) + '٪' : '—'}</td>`;
      }
      groupRows += `<tr><td style="font-size:10px;font-weight:700;color:${gc};padding:4px 8px;white-space:nowrap">تجمعی ${groupLabels[g]}</td>${dayCells}</tr>\n`;
    }
    const dayHeaders = allDays.map(d => `<th colspan="2" style="font-size:9px;padding:3px 2px;text-align:center">${toPersianDigits(d.toString())}</th>`).join('');
    const subHeaders = allDays.map(() => '<th style="font-size:7px;padding:1px;text-align:center;color:#9db4c2">اخ</th><th style="font-size:7px;padding:1px;text-align:center;color:#9db4c2">تج</th>').join('');
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

  // ── Embed data as JSON ──
  const dataJson = JSON.stringify({
    symbolName, currentPrice, currencyUnit, scenarios, decisionGraph, probabilityTrend, branchProbabilities, pathContributions,
    D,
  });

  // ── Date ──
  const today = new Date();
  const persianDate = toPersianDigits(`${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`);

  // ── Build HTML ──
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
  .graph-section canvas { display: block; }
  .scenarios-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .section { padding: 20px; border: 1px solid ${D.line}; border-radius: 16px; background: rgba(8,22,35,.76); margin-bottom: 24px; }
  .chart-section { margin-bottom: 24px; border: 1px solid ${D.line}; border-radius: 16px; background: rgba(8,22,35,.76); overflow: hidden; }
  .chart-header { padding: 14px 18px; border-bottom: 1px solid ${D.line}; }
  .chart-header h3 { font-size: 14px; font-weight: 700; margin: 0; }
  .chart-body { padding: 16px; position: relative; }
  .mini-charts { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .narrative { white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 2.2; direction: rtl; text-align: right; }
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 12px 14px; background: rgba(9,24,37,.92); border: 1px solid ${D.line}; border-bottom: none; }
  .toolbar-label { font-size: 13px; color: ${D.muted}; margin-left: 6px; }
  .tooltip { position: absolute; z-index: 10; background: rgba(8,22,35,.95); border: 1px solid ${D.line}; border-radius: 10px; padding: 10px 14px; font-size: 10px; color: ${D.text}; pointer-events: none; display: none; min-width: 160px; backdrop-filter: blur(8px); }
  .toggle-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .legend-row { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 8px; }
  .legend-item { display: flex; align-items: center; gap: 4px; font-size: 11px; }
  .legend-line { display: inline-block; width: 16px; height: 3px; border-radius: 2px; }
  .legend-dash { display: inline-block; width: 10px; height: 1px; border-radius: 1px; }
  @media (max-width: 768px) { .scenarios-grid { grid-template-columns: repeat(3, 1fr); } .metric-cards { grid-template-columns: repeat(2, 1fr); } }
  @media print { body { background: #fff; color: #111; } .header, .metric-card, .section, .chart-section { border-color: #ddd; } }
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

  <!-- Decision Graph (Canvas edges + HTML nodes) -->
  <div class="graph-section">
    <div style="padding:14px 18px;border-bottom:1px solid ${D.line}"><h2 style="font-size:15px;font-weight:700">گراف تصمیم</h2></div>
    <div class="toolbar">
      <span class="toolbar-label">نمایش مسیرها:</span>
      ${filterBtnsHtml}
      <button id="dg-reset-btn" style="color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:10px;background:rgba(255,255,255,.04);padding:8px 11px;font-family:inherit;font-size:12px;cursor:pointer;transition:.2s ease;margin-right:auto">بازنشانی انتخاب</button>
    </div>
    <div id="dg-container" style="position:relative;overflow:auto;min-height:500px;padding:20px">
      <canvas id="dg-canvas" style="position:absolute;top:0;right:0;pointer-events:none;z-index:1"></canvas>
      <div id="dg-nodes" style="position:relative;z-index:2;width:1200px;height:1100px;margin:0 auto"></div>
      <!-- Legend -->
      <div style="position:absolute;left:17px;bottom:15px;padding:10px;border:1px solid ${D.line};border-radius:10px;background:rgba(7,17,27,.8);font-size:10px;color:#fff;line-height:2">
        <div style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${D.cyan}"></span>پیروی از روند</div>
        <div style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${D.gold}"></span>شکست</div>
        <div style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${D.purple}"></span>بازگشت</div>
        <div style="border-top:1px solid ${D.line};margin:4px 0"></div>
        <div style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${D.green}"></span>صعودی</div>
        <div style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${D.blue}"></span>خنثی / رنج</div>
        <div style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${D.orange}"></span>نزولی</div>
        <div style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${D.red}"></span>شوک / ریسک</div>
      </div>
    </div>
  </div>

  <!-- Scenario Boxes -->
  <div class="section">
    <h2 style="font-size:15px;font-weight:700;margin-bottom:14px">گره های نتیجه و سهم استراتژی ها</h2>
    <div class="scenarios-grid">${scenarioBoxesHtml}</div>
  </div>

  <!-- Cumulative Chart (Canvas) -->
  <div class="chart-section">
    <div class="chart-header">
      <h3>نمودار روند احتمالات گروه‌ها</h3>
    </div>
    <div style="padding:12px 18px 0">
      <div class="legend-row">
        <span class="legend-item"><span class="legend-line" style="background:#16a34a"></span><span style="color:#16a34a">گاوی (تجمعی)</span></span>
        <span class="legend-item"><span class="legend-line" style="background:#b45309"></span><span style="color:#b45309">خنثی (تجمعی)</span></span>
        <span class="legend-item"><span class="legend-line" style="background:#dc2626"></span><span style="color:#dc2626">خرسی (تجمعی)</span></span>
      </div>
    </div>
    <div class="chart-body" style="overflow-x:auto">
      <div id="cumul-tooltip" class="tooltip"></div>
      <canvas id="cumul-canvas"></canvas>
    </div>
  </div>

  <!-- Per-Scenario Charts (Canvas) -->
  <div class="chart-section">
    <div class="chart-header">
      <h3>نمودار روند احتمالات سناریوها</h3>
      <p style="font-size:11px;color:${D.muted};margin:4px 0 0">نمودارهای تعاملی با قابلیت مولتی سِلکت برای مقایسه سناریوها</p>
    </div>
    <div style="padding:12px 18px 0">
      <div class="toggle-row">${toggleBtnsHtml}</div>
    </div>
    <!-- Individual -->
    <div class="chart-body" style="overflow-x:auto">
      <div id="ind-tooltip" class="tooltip"></div>
      <canvas id="ind-canvas"></canvas>
    </div>
    <div style="border-top:1px solid ${D.line}"></div>
    <!-- Cumulative -->
    <div class="chart-body" style="overflow-x:auto">
      <div id="sc-cum-tooltip" class="tooltip"></div>
      <canvas id="sc-cum-canvas"></canvas>
    </div>
  </div>

  <!-- Trend Table -->
  ${trendTableHtml}

  <!-- Narrative -->
  <div class="section">
    <h2 style="font-size:15px;font-weight:700;margin-bottom:14px">متن تخصصی تحلیل گراف تصمیم</h2>
    <div class="narrative">${narrativeHtml}</div>
  </div>
</div>

<script>
window.__DG_DATA__ = ${dataJson};
${buildInlineJS()}
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
