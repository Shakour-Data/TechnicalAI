// ═════════════════════════════════════════════════════════════════════════════════
// Decision Graph Builder — Integrates indicators, patterns, regime, ML, Bayesian
// ═════════════════════════════════════════════════════════════════════════════════

import type { OHLCV } from './ta-engine';
import { analyze } from './ta-engine';
import { detectRegime, type RegimeState, type RuleBasedRegimeInput } from './regime-engine';
import { detectAllPatterns, type DetectedPatterns } from './pattern-detection';
import {
  getNormalizedWeights,
  applyBayesianAdjustment,
  type BayesianSystemResult,
} from './bayesian-weights';
import {
  extractVDSSFeatures,
  calculateBullConsensus,
  type AdaptiveModelResult,
  trainAdaptiveModel,
} from './ml-engine';
import {
  buildDecisionGraph,
  type GraphData,
  type GraphInput,
  ProbContext,
  buildContext,
  enforceSumTo100,
} from './decision-graph';

// ──── Registries ─────────────────────────────────────────────────────────────
const indicatorRegistry = new Map<string, (ohlcv: OHLCV[]) => number>();
const patternRegistry = new Map<
  string,
  (ohlcv: OHLCV[]) => { direction: 'bullish' | 'bearish' | 'neutral'; strength: number }
>;

export function registerIndicator(
  name: string,
  fn: (ohlcv: OHLCV[]) => number
): void {
  indicatorRegistry.set(name, fn);
}

export function registerPattern(
  name: string,
  fn: (ohlcv: OHLCV[]) => {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
  }
): void {
  patternRegistry.set(name, fn);
}

// ──── Helper: compute indicator values from registries ────────────────────────
function computeIndicatorValues(
  ohlcv: OHLCV[]
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const [name, fn] of indicatorRegistry) {
    try {
      values[name] = fn(ohlcv);
    } catch {
      values[name] = 0;
    }
  }
  return values;
}

// ──── Helper: compute pattern signals ───────────────────────────────────────
function computePatternSignals(
  ohlcv: OHLCV[]
): Record<string, 'up' | 'down' | 'neutral'> {
  const signals: Record<string, 'up' | 'down' | 'neutral'> = {};
  for (const [name, fn] of patternRegistry) {
    try {
      const res = fn(ohlcv);
      signals[name] = res.direction === 'bullish' ? 'up' : res.direction === 'bearish' ? 'down' : 'neutral';
    } catch {
      signals[name] = 'neutral';
    }
  }
  return signals;
}

// ──── Main builder ───────────────────────────────────────────────────────────
export interface DecisionGraphParams {
  symbol: string;
  ohlcv: OHLCV[];
  timeframe?: '1d' | '1h' | '15m';
  useML?: boolean;
  useBayesian?: boolean;
  showConfidence?: boolean;
}

export interface DecisionGraphJSON {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ from: string; to: string; label: string; probability: number }>;
  scenarioProbabilities: Record<string, number>;
  branchProbabilities: { trend: number; breakout: number; reversal: number };
  pathContributions: Record<string, { trend: number; breakout: number; reversal: number }>;
  probabilityTrend?: any;
  extra: {
    patterns: DetectedPatterns;
    regime: { state: RegimeState; confidence: number };
    bayesian: BayesianSystemResult | null;
    ml: AdaptiveModelResult | null;
    indicatorValues: Record<string, number>;
    patternSignals: Record<string, 'up' | 'down' | 'neutral'>;
  };
}

export function buildDecisionGraph(
  params: DecisionGraphParams
): { mermaid: string; dot: string; json: DecisionGraphJSON } {
  const {
    symbol,
    ohlcv,
    timeframe = '1d',
    useML = true,
    useBayesian = true,
    showConfidence = false,
  } = params;

  if (!ohlcv || ohlcv.length < 2) {
    throw new Error('Insufficient OHLCV data');
  }

  // 1. Technical analysis base
  const ta = analyze(ohlcv);
  const price = ta.sma.sma20 ?? ohlcv[ohlcv.length - 1].close;

  // 2. Pattern detection
  const patterns = detectAllPatterns(ohlcv);

  // 3. Regime detection (need RuleBasedRegimeInput)
  const regimeInput: RuleBasedRegimeInput = {
    adx: ta.adx,
    diPlus: ta.diPlus,
    diMinus: ta.diMinus,
    rsi: ta.rsi,
    price,
    bbUpper: ta.bollingerBands.upper,
    bbLower: ta.bollingerBands.lower,
    bbMiddle: ta.bollingerBands.middle,
    ema20: ta.ema.ema20 ?? 0,
    ema50: ta.ema.ema50 ?? 0,
    atr: ta.atr,
    ema20Slope: 0, // placeholder – could compute from ema series
    avgPrice: price,
  };
  const regimeResult = detectRegime(ohlcv, regimeInput);

  // 4. Indicator values from registry (plus TA fields)
  const indicatorValues = computeIndicatorValues(ohlcv);
  // augment with TA fields for convenience
  indicatorValues.price = price;
  indicatorValues.bullConsensus = ta.bullConsensus;
  indicatorValues.rsi = ta.rsi;
  indicatorValues.mfi = ta.mfi;
  indicatorValues.cci = ta.cci;
  indicatorValues.stochK = ta.stochK;
  indicatorValues.stochD = ta.stochD;
  indicatorValues.adx = ta.adx;
  indicatorValues.diPlus = ta.diPlus;
  indicatorValues.diMinus = ta.diMinus;
  indicatorValues.macdHist = ta.macd.histogram;
  indicatorValues.atr = ta.atr;
  indicatorValues.bbUpper = ta.bollingerBands.upper;
  indicatorValues.bbMiddle = ta.bollingerBands.middle;
  indicatorValues.bbLower = ta.bollingerBands.lower;
  indicatorValues.sar = ta.sar;
  indicatorValues.ichimokuTenkan = ta.ichimoku.tenkan;
  indicatorValues.ichimokuKijun = ta.ichimoku.kijun;
  indicatorValues.ichimokuSenkouA = ta.ichimoku.senkouA;
  indicatorValues.ichimokuSenkouB = ta.ichimoku.senkouB;
  indicatorValues.maAlignment = ta.extendedIndicators.maAlignment ?? 0;
  indicatorValues.momentum = ta.extendedIndicators.momentum ?? 0;
  indicatorValues.awesomeOsc = ta.extendedIndicators.awesomeOsc ?? 0;
  indicatorValues.fisherTransform = ta.extendedIndicators.fisherTransform ?? 0;
  indicatorValues.confidenceIndex = ta.extendedIndicators.confidenceIndex ?? 0;
  indicatorValues.strengthIndex = ta.extendedIndicators.strengthIndex ?? 0;
  indicatorValues.hasVolume = ta.hasVolume;
  // distToR1/S1 and srAvgStrength need support/resistance levels – approximate
  const resistances = ta.resistances;
  const supports = ta.supports;
  const R1 = resistances[0] ?? price * 1.05;
  const S1 = supports[0] ?? price * 0.95;
  indicatorValues.distToR1 = Math.abs(price - R1) / price;
  indicatorValues.distToS1 = Math.abs(price - S1) / price;
  const srLevels = [...resistances, ...supports].filter((v) => v !== 0);
  indicatorValues.srAvgStrength =
    srLevels.length > 0
      ? srLevels.reduce((sum, v) => sum + (v > 0 ? 1 : 0), 0) / srLevels.length
      : 0.5;
  // ML signals (will be updated after ML training if available)
   indicatorValues.mlMomentum = ta.adaptiveFactors.momentum ?? 0.7;
   indicatorValues.mlVolatility = ta.adaptiveFactors.volatility ?? 0.5;
   indicatorValues.mlTrend = ta.adaptiveFactors.trend ?? 0.6;

  // 5. Pattern signals from registry
  const patternSignals = computePatternSignals(ohlcv);

// 6. ML prediction (optional)
   let mlResult: AdaptiveModelResult | null = null;
   let mlWeightedBullConsensus = ta.bullConsensus; // fallback to TA consensus
   if (useML && ohlcv.length >= 70) {
     try {
       mlResult = trainAdaptiveModel(ohlcv, symbol, 70);
       if (mlResult && ohlcv.length > 0) {
         const hasVolume = ohlcv.some(d => d.volume > 0);
         const latestFeatures = extractVDSSFeatures(ohlcv, ohlcv.length - 1, hasVolume);
         const consensusResult = calculateBullConsensus(latestFeatures, mlResult, hasVolume);
         mlWeightedBullConsensus = consensusResult.bullConsensus;
       }
     } catch { mlResult = null; }
   }

   // Update ML signals from the trained model's adaptive params
   if (mlResult?.adaptiveParams) {
     indicatorValues.mlMomentum = mlResult.adaptiveParams.momentumFactor;
     indicatorValues.mlVolatility = mlResult.adaptiveParams.volatilityFactor;
     indicatorValues.mlTrend = mlResult.adaptiveParams.trendFactor;
   }

   // 7. Bayesian adjustment (optional)
   let bayesianResult: BayesianSystemResult | null = null;
   if (useBayesian) {
     try {
       const weights = getNormalizedWeights(symbol);
       // Need raw scenario probabilities – we can get from decision graph later
       // For now compute placeholder; will replace after graph build
       bayesianResult = weights;
     } catch {
       bayesianResult = null;
     }
   }

   // 8. Build core decision graph using existing engine
   const graphInput: GraphInput = {
     price,
     bullConsensus: mlWeightedBullConsensus, // Use ML-weighted consensus
     rsi: ta.rsi,
     mfi: ta.mfi,
     cci: ta.cci,
     stochK: ta.stochK,
     stochD: ta.stochD,
     adx: ta.adx,
     diPlus: ta.diPlus,
     diMinus: ta.diMinus,
     macdHist: ta.macd.histogram,
     atr: ta.atr,
     bbUpper: ta.bollingerBands.upper,
     bbMiddle: ta.bollingerBands.middle,
     bbLower: ta.bollingerBands.lower,
     sar: ta.sar,
     ichimokuTenkan: ta.ichimoku.tenkan,
     ichimokuKijun: ta.ichimoku.kijun,
     ichimokuSenkouA: ta.ichimoku.senkouA,
     ichimokuSenkouB: ta.ichimoku.senkouB,
     maAlignment: ta.extendedIndicators.maAlignment ?? 0,
     momentum: ta.extendedIndicators.momentum ?? 0,
     awesomeOsc: ta.extendedIndicators.awesomeOsc ?? 0,
     fisherTransform: ta.extendedIndicators.fisherTransform ?? 0,
     confidenceIndex: ta.extendedIndicators.confidenceIndex ?? 0,
     strengthIndex: ta.extendedIndicators.strengthIndex ?? 0,
     hasVolume: ta.hasVolume,
     distToR1: indicatorValues.distToR1,
     distToS1: indicatorValues.distToS1,
     srAvgStrength: indicatorValues.srAvgStrength,
     mlMomentum: indicatorValues.mlMomentum,
     mlVolatility: indicatorValues.mlVolatility,
     mlTrend: indicatorValues.mlTrend,
   };

  const graphData = buildDecisionGraph(graphInput);

  // 9. Update Bayesian with raw scenario probabilities
  if (useBayesian && bayesianResult) {
    try {
      const adjusted = applyBayesianAdjustment(
        symbol,
        graphData.scenarioProbabilities,
        patternSignals
      );
      bayesianResult = adjusted.bayesianResult;
    } catch {
      bayesianResult = null;
    }
  }

  // 10. Generate Mermaid syntax
  let mermaid = 'graph TD\n';
  // Nodes
  for (const node of graphData.nodes) {
    const label = node.titleEn ?? node.id;
    mermaid += `    ${node.id}["${label}"]\n`;
  }
  // Edges with probability labels
  for (const [idx, prob] of Object.entries(graphData.edgeProbabilities)) {
    const edge = graphData.edges[Number(idx)];
    if (edge) {
      mermaid += `    ${edge.from} -->|${Math.round(prob)}%| ${edge.to}\n`;
    }
  }

  // 11. Generate DOT syntax
  let dot = 'digraph DecisionGraph {\n';
  dot += '    node [shape=box];\n';
  for (const node of graphData.nodes) {
    const label = node.titleEn ?? node.id;
    dot += `    "${node.id}" [label="${label}"];\n`;
  }
  for (const [idx, prob] of Object.entries(graphData.edgeProbabilities)) {
    const edge = graphData.edges[Number(idx)];
    if (edge) {
      dot += `    "${edge.from}" -> "${edge.to}" [label="${Math.round(prob)}%"];\n`;
    }
  }
  dot += '}\n';

  // 12. Assemble JSON
  const json: DecisionGraphJSON = {
    nodes: graphData.nodes.map((n) => ({
      id: n.id,
      label: n.titleEn ?? n.id,
      type: n.type,
    })),
    edges: graphData.edges.map((e) => ({
      from: e.from,
      to: e.to,
      label: e.labelEn ?? e.label,
      probability: graphData.edgeProbabilities[graphData.edges.indexOf(e)] ?? 0,
    })),
    scenarioProbabilities: graphData.scenarioProbabilities,
    branchProbabilities: graphData.branchProbabilities,
    pathContributions: graphData.pathContributions,
    probabilityTrend: graphData.probabilityTrend,
    extra: {
      patterns,
      regime: { state: regimeResult.regime, confidence: regimeResult.confidence },
      bayesian: bayesianResult,
      ml: mlResult,
      indicatorValues,
      patternSignals,
    },
  };

  return { mermaid, dot, json };
}