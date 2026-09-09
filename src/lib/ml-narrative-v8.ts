// ═══════════════════════════════════════════════════════════════════════════════
// ML Narrative Engine v8 — LOCKED — School × Style × Tone Selector
// LOCKED — Deterministic scoring system: evaluates market conditions and selects
// exactly ONE combination per request (school + style + tone).
// ═══════════════════════════════════════════════════════════════════════════════

export interface NarrativeCombination {
  school: SchoolDef;
  style: StyleDef;
  tone: ToneDef;
  schoolScore: number;
  styleScore: number;
  toneScore: number;
}

export interface SchoolDef {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  methodology: string;   // what tools/indicators this school emphasizes
  focusQuestion: string;  // the key question this school asks
}

export interface StyleDef {
  id: string;
  name: string;
  nameEn: string;
  voice: string;        // narrative voice description
  structure: string;    // how the analysis is structured
  endingStyle: string;  // how the analysis concludes
}

export interface ToneDef {
  id: string;
  name: string;
  nameEn: string;
  characteristics: string;
  vocabulary: string;   // key words/phrases to use
  sentenceStyle: string;
}

// ─── Selection Input ────────────────────────────────────────────────────────
export interface NarrativeInput {
  price: number;
  trendDirection: string;  // 'up' | 'down' | 'neutral'
  rsi: number;
  adx: number;
  stochK: number;
  stochD: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  diPlus: number;
  diMinus: number;
  obv: number;
  hasVolume: boolean;
  cci: number;
  mfi: number;
  atr: number;
  bbPosition: number;      // 0-100, where price sits in Bollinger Bands
  bbUpper: number;
  bbLower: number;
  dominantScenarioKey: string;  // 'SC1'-'SC5'
  scenarioProbabilities: Record<string, number>;  // SC1-SC9 probabilities (0-100)
  nearResistance: boolean;  // price within 3% of resistance
   nearSupport: boolean;     // price within 3% of support
  priceVsMa21: 'above' | 'below';
  priceVsMa100: 'above' | 'below';
  trendR2: number;       // R-squared of trend fit (0-1)
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10 Schools of Technical Analysis
// ═══════════════════════════════════════════════════════════════════════════════

export const SCHOOLS: SchoolDef[] = [
  {
    id: 'trend',
    name: '\u062a\u062d\u0644\u06cc\u0644 \u0631\u0648\u0646\u062f',
    nameEn: 'Trend Following',
    description: '\u062a\u0645\u0631\u06a9\u0632 \u0628\u0631 \u0634\u062f\u062a \u0631\u0648\u0646\u062f\u060c \u0632\u0627\u0648\u06cc\u0647 \u0631\u0648\u0646\u062f\u060c \u062a\u062b\u0628\u06cc\u062a \u06a9\u0627\u0646\u0627\u0644 \u0648 \u0645\u0639\u0627\u06cc\u0631\u0647 \u0645\u062a\u062d\u0631\u06a9 \u0628\u0627 \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0627\u0632 EMA\u060c MACD \u0648 ADX.',
    methodology: 'EMA 20/50/100\u060c MACD\u060c ADX\u060c DI+/DI-\u060c \u062e\u0637\u0648\u0637 \u0631\u0648\u0646\u062f\u060c \u062a\u062b\u0628\u06cc\u062a \u06a9\u0627\u0646\u0627\u0644',
    focusQuestion: '\u0622\u06cc\u0627 \u0631\u0648\u0646\u062f \u0642\u0627\u0628\u0644 \u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0633\u062a \u0648 \u06a9\u062c\u0627 \u06cc \u0646\u0642\u0627\u0637 \u062a\u0627\u06cc\u06cc\u062f\u061f',
  },
  {
    id: 'classical',
    name: '\u0627\u0644\u06af\u0648\u0647\u0627\u06cc \u06a9\u0644\u0627\u0633\u06cc\u06a9',
    nameEn: 'Classical Patterns',
    description: '\u0634\u0646\u0627\u0633\u0627\u06cc\u06cc \u0627\u0644\u06af\u0648\u0647\u0627\u06cc \u0642\u06cc\u0645\u062a\u06cc \u06a9\u0644\u0627\u0633\u06cc\u06a9 \u0645\u0627\u0646\u0646\u062f \u0633\u0631 \u0648 \u0634\u0627\u0646\u0647\u060c \u062f\u0648\u0644 \u0628\u0627\u0644\u0627\u060c \u0645\u062b\u0644\u062b \u0648 \u0644\u0627\u06af\u0646\u0627.',
    methodology: '\u0627\u0644\u06af\u0648\u0647\u0627\u06cc \u0628\u0627\u0632\u06af\u0634\u062a\u06cc (Head & Shoulders\u060c Double Top/Bottom)\u060c \u0627\u0644\u06af\u0648\u0647\u0627\u06cc \u0627\u062f\u0627\u0645\u0647 (Flags\u060c Triangles)\u060c \u0648\u0627\u06af\u0631\u0627\u06cc\u06cc',
    focusQuestion: '\u0622\u06cc\u0627 \u0627\u0644\u06af\u0648\u06cc \u0642\u06cc\u0645\u062a\u06cc \u062f\u0631 \u062d\u0627\u0644 \u0634\u06a9\u0644\u06af\u06cc\u0631\u06cc \u0627\u0633\u062a \u0648 \u0647\u062f\u0641 \u0642\u06cc\u0645\u062a\u06cc \u0622\u0646 \u0686\u06cc\u0633\u062a\u061f',
  },
  {
    id: 'candlestick',
    name: '\u0627\u0644\u06af\u0648\u0647\u0627\u06cc \u06a9\u0646\u062f\u0644\u06cc',
    nameEn: 'Candlestick Patterns',
    description: '\u062a\u062d\u0644\u06cc\u0644 \u0627\u0644\u06af\u0648\u0647\u0627\u06cc \u0634\u0639\u0644\u0627\u06cc \u0698\u0627\u067e\u0646\u06cc \u062f\u0631 \u0633\u0637\u0648\u062d \u06a9\u0644\u06cc\u062f\u06cc \u0628\u0631\u0627\u06cc \u062a\u0634\u062e\u06cc\u0635 \u0639\u06a9\u0633 \u0631\u0648\u0646\u062f.',
    methodology: '\u062f\u0648\u062c\u06cc\u060c Hammer\u060c Engulfing\u060c Morning/Evening Star\u060c Harami\u060c Doji\u060c Spinng Top\u060c \u062a\u0639\u062f\u0627\u062f \u0628\u0627\u0631 \u06a9\u0646\u062f\u0644',
    focusQuestion: '\u0622\u06cc\u0627 \u0627\u06a9\u0646\u0648\u0646 \u06a9\u0646\u062f\u0644\u06cc \u062f\u0631 \u0633\u0637\u0648\u062d \u06a9\u0644\u06cc\u062f\u06cc \u0639\u06a9\u0633 \u0631\u0648\u0646\u062f \u0631\u0627 \u062a\u0623\u06cc\u06cc\u062f \u0645\u06cc\u06a9\u0646\u062f\u061f',
  },
  {
    id: 'fibonacci',
    name: '\u0641\u06cc\u0628\u0648\u0646\u0627\u0686\u06cc \u0648 \u0647\u0646\u062f\u0633\u06cc',
    nameEn: 'Fibonacci & Geometric',
    description: '\u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0627\u0632 \u0633\u0637\u0648\u062d \u0641\u06cc\u0628\u0648\u0646\u0627\u0686\u06cc \u0628\u0631\u0627\u06cc \u062a\u0639\u06cc\u06cc\u0646 \u0646\u0633\u0628\u062a\u0647\u0627\u06cc \u0627\u0635\u0644\u0627\u062d \u0648 \u0627\u0647\u062f\u0627\u0641 \u0642\u06cc\u0645\u062a\u06cc.',
    methodology: '\u0641\u06cc\u0628\u0648\u0646\u0627\u0686\u06cc \u0627\u0635\u0644\u0627\u062d\u06cc (23.6%\u060c 38.2%\u060c 50%\u060c 61.8%)\u060c \u0627\u0641\u0632\u0627\u06cc\u0634\u06cc (127.2%\u060c 161.8%)\u060c \u0627\u0646\u0628\u0633\u0627\u0637 \u0647\u0646\u062f\u0633\u06cc',
    focusQuestion: '\u0646\u0633\u0628\u062a \u0627\u0635\u0644\u0627\u062d \u0641\u06cc\u0628\u0648\u0646\u0627\u0686\u06cc \u062f\u0631 \u06a9\u062c\u0627 \u0642\u0631\u0627\u0631 \u062f\u0627\u0631\u062f \u0648 \u0627\u0647\u062f\u0627\u0641 \u0627\u0641\u0632\u0627\u06cc\u0634\u06cc \u0686\u06cc\u0633\u062a\u061f',
  },
  {
    id: 'volatility',
    name: '\u062a\u062d\u0644\u06cc\u0644 \u0646\u0648\u0633\u0627\u0646 \u0648 \u062d\u062c\u0645',
    nameEn: 'Volatility & Volume',
    description: '\u0628\u0631\u0631\u0633\u06cc \u0634\u062f\u062a \u0646\u0648\u0633\u0627\u0646 \u0628\u0627 ATR \u0648 Bollinger\u060c \u062a\u062d\u0644\u06cc\u0644 \u062d\u062c\u0645 \u0645\u0639\u0627\u0645\u0644\u0627\u062a \u0648 OBV \u0628\u0631\u0627\u06cc \u062a\u0634\u062e\u06cc\u0635 \u062c\u0631\u06cc\u0627\u0646 \u067e\u0648\u0644 \u0647\u0648\u0634\u0645\u0646\u062f.',
    methodology: 'ATR\u060c Bollinger Bands\u060c OBV\u060c \u062d\u062c\u0645 \u0646\u0633\u0628\u06cc\u060c \u0646\u0648\u0633\u0627\u0646 \u0641\u0634\u0631\u062f\u0647 (Squeeze)\u060c \u0648\u0627\u06af\u0631\u0627\u06cc\u06cc \u062d\u062c\u0645',
    focusQuestion: '\u0622\u06cc\u0627 \u0628\u0627\u0632\u0627\u0631 \u062f\u0631 \u062d\u0627\u0644 \u0641\u0634\u0631\u062f\u06af\u06cc \u0627\u0633\u062a \u0648 \u062c\u0631\u06cc\u0627\u0646 \u067e\u0648\u0644 \u0686\u0647 \u0633\u06cc\u06af\u0646\u0627\u0644\u06cc \u062f\u0627\u0631\u062f\u061f',
  },
  {
    id: 'oscillator',
    name: '\u0627\u0633\u06cc\u0644\u0627\u062a\u0648\u0631\u0647\u0627 \u0648 \u0645\u0648\u0645\u0646\u062a\u0648\u0645',
    nameEn: 'Oscillators & Momentum',
    description: '\u062a\u062d\u0644\u06cc\u0644 \u0639\u062f\u062f\u06cc \u0634\u0627\u062e\u0635\u0647\u0627\u06cc \u062a\u06a9\u0646\u06cc\u06a9\u0627\u0644 \u0628\u0631\u0627\u06cc \u062a\u0634\u062e\u06cc\u0635 \u0627\u0634\u0628\u0627\u0639 \u062e\u0631\u06cc\u062f/\u0641\u0631\u0648\u0634 \u0648 \u0648\u0627\u06af\u0631\u0627\u06cc\u06cc.',
    methodology: 'RSI\u060c Stochastic\u060c CCI\u060c MFI\u060c MACD\u060c Williams %R\u060c \u0648\u0627\u06af\u0631\u0627\u06cc\u06cc \u0645\u0648\u0645\u0646\u062a\u0648\u0645',
    focusQuestion: '\u06a9\u062f\u0627\u0645 \u0627\u0633\u06cc\u0644\u0627\u062a\u0648\u0631 \u062f\u0631 \u0646\u0632\u062f\u06cc\u06a9 \u0627\u0634\u0628\u0627\u0639 \u062e\u0631\u06cc\u062f/\u0641\u0631\u0648\u0634 \u0642\u0631\u0627\u0631 \u062f\u0627\u0631\u062f \u0648 \u0622\u06cc\u0627 \u0648\u0627\u06af\u0631\u0627\u06cc\u06cc \u0645\u0648\u0645\u0646\u062a\u0648\u0645 \u0648\u062c\u0648\u062f \u062f\u0627\u0631\u062f\u061f',
  },
  {
    id: 'sr',
    name: '\u062d\u0645\u0627\u06cc\u062a \u0648 \u0645\u0642\u0627\u0648\u0645\u062a',
    nameEn: 'Support & Resistance',
    description: '\u0634\u0646\u0627\u0633\u0627\u06cc\u06cc \u0633\u0637\u0648\u062d \u06a9\u0644\u06cc\u062f\u06cc\u060c \u062a\u0639\u06cc\u06cc\u0646 \u0642\u062f\u0631\u062a \u0622\u0646\u0647\u0627 \u0648 \u062a\u062d\u0644\u06cc\u0644 \u0648\u0627\u06a9\u0646\u0634 \u0642\u06cc\u0645\u062a \u062f\u0631 \u06a9\u0646\u0627\u0644\u0647\u0627\u06cc \u0627\u0641\u0642\u06cc.',
    methodology: '\u0633\u0637\u0648\u062d \u0627\u0641\u0642\u06cc\u060c \u06a9\u0627\u0646\u0627\u0644\u0647\u0627\u06cc \u0642\u06cc\u0645\u062a\u060c \u062a\u0639\u062f\u0627\u062f \u0628\u0631\u062e\u0648\u0631\u062f\u060c \u062d\u062c\u0645 \u062f\u0631 \u0633\u0637\u0648\u062d\u060c \u0634\u06a9\u0633\u062a \u0645\u0639\u062a\u0628\u0631',
    focusQuestion: '\u0622\u06cc\u0627 \u0642\u06cc\u0645\u062a \u062f\u0631 \u0646\u0632\u062f\u06cc\u06a9 \u06cc\u06a9 \u0633\u0637\u062d \u06a9\u0644\u06cc\u062f\u06cc \u0642\u0631\u0627\u0631 \u062f\u0627\u0631\u062f \u0648 \u0634\u06a9\u0633\u062a \u0622\u0646 \u0686\u0647 \u0627\u062d\u062a\u0645\u0627\u0644\u06cc \u0627\u0633\u062a\u061f',
  },
  {
    id: 'harmonic',
    name: '\u0627\u0644\u06af\u0648\u0647\u0627\u06cc \u0647\u0627\u0631\u0645\u0648\u0646\u06cc\u06a9',
    nameEn: 'Harmonic Patterns',
    description: '\u0634\u0646\u0627\u0633\u0627\u06cc\u06cc \u0627\u0644\u06af\u0648\u0647\u0627\u06cc \u0647\u0646\u062f\u0633\u06cc Gartley\u060c Butterfly\u060c Bat\u060c Crab \u0648 Shark \u0628\u0627 \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0627\u0632 \u0646\u0633\u0628\u062a\u0647\u0627\u06cc \u0641\u06cc\u0628\u0648\u0646\u0627\u0686\u06cc.',
    methodology: 'Gartley (AB=CD)\u060c Butterfly\u060c Bat\u060c Crab\u060c Shark\u060c \u0646\u0633\u0628\u062a 0.618/0.786/1.272/1.618\u060c PRZ (Potential Reversal Zone)',
    focusQuestion: '\u0622\u06cc\u0627 \u0633\u0627\u062e\u062a\u0627\u0631 \u0641\u06cc\u0628\u0648\u0646\u0627\u0686\u06cc \u06cc\u06a9 \u0627\u0644\u06af\u0648\u06cc \u0647\u0627\u0631\u0645\u0648\u0646\u06cc\u06a9 \u0631\u0627 \u062a\u0634\u06a9\u06cc\u0644 \u0645\u06cc\u062f\u0647\u062f \u0648 D \u06a9\u062c\u0627 \u0642\u0631\u0627\u0631 \u062f\u0627\u0631\u062f\u061f',
  },
  {
    id: 'elliott',
    name: '\u0646\u0638\u0631\u06cc\u0647 \u0645\u0648\u062c \u0627\u0644\u06cc\u0648\u062a',
    nameEn: 'Elliott Wave Theory',
    description: '\u0634\u0645\u0627\u0631\u0634 \u0645\u0648\u062c\u0647\u0627\u06cc \u062a\u06a9\u0645\u06cc\u0644\u06cc (5 \u0645\u0648\u062c \u0635\u0639\u0648\u062f\u06cc/\u0646\u0632\u0648\u0644\u06cc) \u0648 \u0627\u0635\u0644\u0627\u062d\u06cc (3 \u0645\u0648\u062c) \u0628\u0631\u0627\u06cc \u062a\u0634\u062e\u06cc\u0635 \u062c\u0627\u06cc\u06af\u0627\u0647 \u0631\u0648\u0646\u062f \u062f\u0631 \u0686\u0631\u062e\u0647 \u0628\u0627\u0632\u0627\u0631.',
    methodology: '\u0645\u0648\u062c\u0647\u0627\u06cc \u0627\u0648\u0644 \u062a\u0627 \u067e\u0646\u062c\u0645\u060c \u0627\u0635\u0644\u0627\u062d\u06cc ABC\u060c \u0641\u06cc\u0628\u0648\u0646\u0627\u0686\u06cc \u0645\u0648\u062c\u06cc\u060c \u062a\u0648\u0633\u0639\u0647 \u0645\u0648\u062c\u06cc\u060c \u062a\u0631\u06a9\u06cc\u0628 \u0645\u0648\u062c\u06cc',
    focusQuestion: '\u0628\u0627\u0632\u0627\u0631 \u062f\u0631 \u06a9\u062f\u0627\u0645 \u0645\u0648\u062c \u0627\u0632 \u0686\u0631\u062e\u0647 \u0627\u0644\u06cc\u0648\u062a \u0642\u0631\u0627\u0631 \u062f\u0627\u0631\u062f \u0648 \u0645\u0648\u062c \u0628\u0639\u062f\u06cc \u0686\u0647 \u062c\u0647\u062a\u06cc \u062f\u0627\u0631\u062f\u061f',
  },
  {
    id: 'psychology',
    name: '\u0631\u0648\u0627\u0646\u0634\u0646\u0627\u062e\u062a\u06cc \u0628\u0627\u0632\u0627\u0631',
    nameEn: 'Market Psychology & Sentiment',
    description: '\u062a\u062d\u0644\u06cc\u0644 \u0631\u0641\u062a\u0627\u0631 \u0645\u0639\u0627\u0645\u0644\u06af\u0631\u0627\u0646\u060c \u0637\u0645\u0639 \u0648 \u0631\u0647\u0628\u060c \u0633\u0631\u062e\u0648\u0631\u062f\u06af\u06cc \u0648 \u0627\u0639\u062a\u0645\u0627\u062f \u06a9\u0648\u0631 \u0628\u0631 \u0627\u0633\u0627\u0633 \u062d\u062c\u0645\u060c \u0646\u0648\u0633\u0627\u0646 \u0648 \u0631\u0641\u062a\u0627\u0631 \u0642\u06cc\u0645\u062a.',
    methodology: '\u0631\u0641\u062a\u0627\u0631 \u062d\u062c\u0645 \u06cc (OBV)\u060c \u0646\u0627\u062d\u06cc\u0647 \u0645\u062b\u0628\u062a \u0641\u0631\u0648\u0634\u060c \u0627\u0634\u0628\u0627\u0639 \u062e\u0631\u06cc\u062f\u060c \u0634\u06a9\u0627\u0641 \u0642\u06cc\u0645\u062a\u06cc\u060c \u0627\u0646\u062a\u0638\u0627\u0631 \u0648 \u0633\u0631\u062e\u0648\u0631\u062f\u06af\u06cc',
    focusQuestion: '\u0631\u0648\u0627\u0646\u0634\u0646\u0627\u062e\u062a\u06cc \u063a\u0627\u0644\u0628 \u0628\u0627\u0632\u0627\u0631 \u0686\u06cc\u0633\u062a \u0648 \u0622\u06cc\u0627 \u0627\u06cc\u0646 \u0631\u0641\u062a\u0627\u0631 \u0628\u0647 \u062a\u062f\u0627\u0648\u0645 \u06cc\u0627 \u0633\u0631\u0648\u0641\u0631 \u062e\u0648\u0627\u0647\u062f \u06a9\u0631\u062f\u061f',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 10 Narrative Styles
// ═══════════════════════════════════════════════════════════════════════════════

export const STYLES: StyleDef[] = [
  {
    id: 'conservative',
    name: '\u0645\u062d\u0627\u0641\u0638\u0647\u200c\u06a9\u0627\u0631',
    nameEn: 'Conservative',
    voice: '\u0631\u0633\u0645\u06cc\u060c \u062f\u0642\u06cc\u0642\u060c \u0628\u0627 \u062a\u0623\u06a9\u06cc\u062f \u0628\u0631 \u0631\u06cc\u0633\u06a9. \u0627\u0632 \u06a9\u0644\u0645\u0627\u062a \u00ab\u0627\u062d\u062a\u0645\u0627\u0644\u00bb\u060c \u00ab\u0631\u06cc\u0633\u06a9\u00bb\u060c \u00ab\u0645\u062d\u0627\u0641\u0638\u062a\u00bb \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0645\u06cc\u0634\u0648\u062f.',
    structure: '\u0648\u0636\u0639\u06cc\u062a \u0641\u0639\u0644\u06cc \u2190 \u062a\u062d\u0644\u06cc\u0644 \u0631\u06cc\u0633\u06a9\u200c\u0647\u0627 \u2190 \u0633\u0646\u0627\u0631\u06cc\u0648\u0647\u0627 \u2190 \u062a\u0648\u0635\u06cc\u0647 \u0645\u062d\u062a\u0627\u0637\u0627\u0646\u0647',
    endingStyle: '\u00ab\u0635\u0628\u0631 \u06a9\u0646\u06cc\u062f \u062a\u0627 \u0628\u0627\u0632\u0627\u0631 \u062c\u0647\u062a \u062e\u0648\u062f \u0631\u0627 \u0645\u0634\u062e\u0635 \u06a9\u0646\u062f\u00bb',
  },
  {
    id: 'scalper',
    name: '\u0627\u0633\u06a9\u0627\u0644\u067e\u0631',
    nameEn: 'Scalper',
    voice: '\u0633\u0631\u06cc\u0639\u060c \u067e\u0631\u0627\u0646\u0631\u0698\u06cc\u060c \u0628\u0627 \u062a\u0645\u0631\u06a9\u0632 \u0628\u0631 \u0641\u0631\u0635\u062a\u200c\u0647\u0627\u06cc \u06a9\u0648\u062a\u0627\u0647\u200c\u0645\u062f\u062a. \u0627\u0632 \u00ab\u06a9\u0634\u0634\u00bb\u060c \u00ab\u0634\u0627\u0631\u067e\u00bb\u060c \u00ab\u0641\u0631\u0635\u062a\u00bb \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0645\u06cc\u0634\u0648\u062f.',
    structure: '\u0634\u062a\u0627\u0628 \u0628\u0627\u0632\u0627\u0631 \u2190 \u0641\u0631\u0635\u062a\u200c\u0647\u0627\u06cc \u0648\u0631\u0648\u062f \u2190 \u0646\u0642\u0627\u0637 \u062e\u0631\u0648\u062c \u2190 \u0627\u0633\u062a\u0631\u0627\u062a\u0698\u06cc \u0645\u0639\u0627\u0645\u0644\u0627\u062a\u06cc',
    endingStyle: '\u00ab\u062f\u0631 \u067e\u0648\u0644\u0628\u06a9 \u0628\u062e\u0631\u06cc\u062f\u060c \u062f\u0631 \u0647\u06cc\u062c\u0627\u0646 \u0628\u0641\u0631\u0648\u0634\u06cc\u062f\u00bb',
  },
  {
    id: 'trendFollower',
    name: '\u0631\u0648\u0646\u062f\u06af\u0631\u0627',
    nameEn: 'Trend Follower',
    voice: '\u0622\u0631\u0627\u0645\u060c \u062a\u0648\u0635\u06cc\u0641\u06cc\u060c \u0628\u0627 \u0646\u06af\u0627\u0647 \u0628\u0644\u0646\u062f\u0645\u062f\u062a. \u0627\u0632 \u00ab\u0686\u0631\u062e\u0647\u00bb\u060c \u00ab\u0641\u0627\u0632\u00bb\u060c \u00ab\u062a\u062b\u0628\u06cc\u062a\u00bb\u060c \u00ab\u0632\u0645\u0627\u0646\u00bb \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0645\u06cc\u0634\u0648\u062f.',
    structure: '\u062c\u0627\u06cc\u06af\u0627\u0647 \u0631\u0648\u0646\u062f \u062f\u0631 \u0686\u0631\u062e\u0647 \u2190 \u062a\u062d\u0644\u06cc\u0644 \u062a\u062b\u0628\u06cc\u062a \u2190 \u0686\u0634\u0645\u0627\u0646\u062f\u0627\u0632 \u0628\u0644\u0646\u062f\u0645\u062f\u062a \u2190 \u0646\u062a\u06cc\u062c\u0647 \u0631\u0648\u0646\u062f\u06cc',
    endingStyle: '\u00ab\u0631\u0648\u0646\u062f \u062f\u0633\u062a\u200c\u0646\u062e\u0648\u0631\u062f\u0647 \u0627\u0633\u062a\u060c \u0627\u06cc\u0646 \u0641\u0642\u0637 \u06cc\u06a9 \u0646\u0641\u0633\u200c\u06af\u06cc\u0631\u06cc \u0627\u0633\u062a\u00bb',
  },
  {
    id: 'bearish',
    name: '\u0628\u062f\u0628\u06cc\u0646',
    nameEn: 'Bearish / Risk Manager',
    voice: '\u0647\u0634\u062f\u0627\u0631\u062f\u0647\u0646\u062f\u0647\u060c \u062a\u0644\u062e. \u0627\u0632 \u00ab\u062e\u0637\u0631\u00bb\u060c \u00ab\u0634\u06a9\u0633\u062a\u00bb\u060c \u00ab\u0641\u0631\u06cc\u0628\u0646\u062f\u0647\u00bb\u060c \u00ab\u0634\u06a9\u0627\u0641\u00bb \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0645\u06cc\u0634\u0648\u062f.',
    structure: '\u0639\u0644\u0627\u0626\u0645 \u0647\u0634\u062f\u0627\u0631 \u2190 \u062a\u062d\u0644\u06cc\u0644 \u0634\u06a9\u0633\u062a \u0627\u062d\u062a\u0645\u0627\u0644\u06cc \u2190 \u0633\u0646\u0627\u0631\u06cc\u0648\u06cc \u0646\u0632\u0648\u0644\u06cc \u2190 \u062a\u0648\u0635\u06cc\u0647 \u0627\u062c\u062a\u0646\u0627\u0628',
    endingStyle: '\u00ab\u0627\u0634\u0628\u0627\u0639 \u062e\u0631\u06cc\u062f \u0646\u0634\u0627\u0646\u0647\u200c\u0627\u06cc \u0627\u0632 \u0631\u06cc\u0632\u0634 \u0642\u0631\u06cc\u0628\u200c\u0627\u0644\u0648\u0642\u0648\u0639 \u0627\u0633\u062a\u00bb',
  },
  {
    id: 'narrative',
    name: '\u0631\u0648\u0627\u06cc\u06cc',
    nameEn: 'Narrative',
    voice: '\u062a\u0648\u0635\u06cc\u0641\u06cc\u060c \u0627\u0633\u062a\u0639\u0627\u0631\u06cc\u060c \u062a\u0635\u0648\u06cc\u0631\u0633\u0627\u0632. \u0627\u0632 \u00ab\u062c\u0627\u062f\u0647\u00bb\u060c \u00ab\u0645\u0633\u06cc\u0631\u00bb\u060c \u00ab\u0641\u0646\u0631\u00bb\u060c \u00ab\u0633\u0627\u06cc\u0647\u00bb \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0645\u06cc\u0634\u0648\u062f.',
    structure: '\u062a\u0635\u0648\u06cc\u0631 \u06a9\u0644\u06cc \u0628\u0627\u0632\u0627\u0631 \u2190 \u062a\u0648\u0635\u06cc\u0641 \u0633\u0646\u0627\u0631\u06cc\u0648\u0647\u0627 \u0628\u0647 \u0639\u0646\u0648\u0627\u0646 \u0645\u0633\u06cc\u0631 \u2190 \u0646\u0642\u0637\u0647 \u062a\u0635\u0645\u06cc\u0645 \u2190 \u0646\u062a\u06cc\u062c\u0647 \u0631\u0648\u0627\u06cc\u06cc',
    endingStyle: '\u00ab\u0628\u0627\u0632\u0627\u0631 \u062f\u0631 \u0686\u0647\u0627\u0631\u0627\u0647 \u0627\u0633\u062a\u060c \u062d\u0645\u0627\u06cc\u062a \u0648 \u0645\u0642\u0627\u0648\u0645\u062a \u062a\u0635\u0645\u06cc\u0645\u200c\u06af\u06cc\u0631\u0646\u062f\u0647\u200c\u0647\u0627 \u0647\u0633\u062a\u0646\u062f\u00bb',
  },
  {
    id: 'decision',
    name: '\u062a\u0635\u0645\u06cc\u0645\u200c\u0645\u062d\u0648\u0631',
    nameEn: 'Decision-Oriented',
    voice: '\u0634\u0631\u0637\u06cc\u060c \u06af\u0627\u0645\u200c\u0628\u0647\u200c\u06af\u0627\u0645\u060c \u0634\u0641\u0627\u0641. \u0627\u0632 \u00ab\u0627\u06af\u0631\u00bb\u060c \u00ab\u0622\u0646\u06af\u0627\u0647\u00bb\u060c \u00ab\u0627\u0642\u062f\u0627\u0645\u00bb\u060c \u00ab\u0645\u0631\u062d\u0644\u0647\u00bb \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0645\u06cc\u0634\u0648\u062f.',
    structure: '\u0646\u0642\u0627\u0637 \u06a9\u0644\u06cc\u062f\u06cc \u2190 \u0634\u0631\u0637\u200c\u0647\u0627\u06cc \u0648\u0631\u0648\u062f/\u062e\u0631\u0648\u062c \u2190 \u0645\u062f\u06cc\u0631\u06cc\u062a \u0631\u06cc\u0633\u06a9 \u2190 \u0628\u0631\u0646\u0627\u0645\u0647 \u0639\u0645\u0644\u06cc',
    endingStyle: '\u00ab\u062a\u0627 \u0634\u06a9\u0633\u062a \u0633\u0637\u0648\u062d \u06a9\u0644\u06cc\u062f\u06cc\u060c \u0647\u06cc\u0686 \u0627\u0642\u062f\u0627\u0645\u06cc \u0646\u06a9\u0646\u06cc\u062f\u00bb',
  },
  {
    id: 'volumeAnalyst',
    name: '\u062a\u062d\u0644\u06cc\u0644\u06af\u0631 \u062d\u062c\u0645',
    nameEn: 'Volume Analyst',
    voice: '\u062a\u0645\u0631\u06a9\u0632 \u0628\u0631 \u062c\u0631\u06cc\u0627\u0646 \u067e\u0648\u0644 \u0647\u0648\u0634\u0645\u0646\u062f\u060c \u062a\u0623\u06cc\u06cc\u062f \u06cc\u0627 \u062a\u0639\u0627\u0631\u0636 \u062d\u062c\u0645. \u0627\u0632 \u00ab\u062c\u0631\u06cc\u0627\u0646\u00bb\u060c \u00ab\u062a\u0623\u06cc\u06cc\u062f\u00bb\u060c \u00ab\u0648\u0627\u06af\u0631\u0627\u06cc\u06cc\u00bb \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0645\u06cc\u0634\u0648\u062f.',
    structure: '\u062a\u062d\u0644\u06cc\u0644 OBV \u2190 \u062a\u0623\u06cc\u06cc\u062f/\u062a\u0639\u0627\u0631\u0636 \u062d\u062c\u0645 \u2190 \u062d\u062c\u0645 \u062f\u0631 \u0633\u0637\u0648\u062d \u2190 \u0646\u062a\u06cc\u062c\u0647 \u062d\u062c\u0645\u06cc',
    endingStyle: '\u00ab\u062d\u062c\u0645 \u0647\u0648\u0634\u0645\u0646\u062f \u0628\u0627\u06cc\u062f \u0631\u0627\u0647\u0631\u0627\u0647\u06cc \u0642\u06cc\u0645\u062a \u0631\u0627 \u062a\u0623\u06cc\u06cc\u062f \u06a9\u0646\u062f\u00bb',
  },
  {
    id: 'patternAnalyst',
    name: '\u062a\u062d\u0644\u06cc\u0644\u06af\u0631 \u0627\u0644\u06af\u0648',
    nameEn: 'Pattern Analyst',
    voice: '\u062a\u0645\u0631\u06a9\u0632 \u0628\u0631 \u0634\u06a9\u0644\u200c\u06af\u06cc\u0631\u06cc \u0627\u0644\u06af\u0648\u0647\u0627\u06cc \u0642\u06cc\u0645\u062a\u06cc. \u0627\u0632 \u00ab\u0627\u0644\u06af\u0648\u00bb\u060c \u00ab\u0634\u06a9\u0644\u00bb\u060c \u00ab\u062a\u06a9\u0645\u06cc\u0644\u00bb\u060c \u00ab\u062a\u0623\u06cc\u06cc\u062f\u00bb \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0645\u06cc\u0634\u0648\u062f.',
    structure: '\u0634\u0646\u0627\u0633\u0627\u06cc\u06cc \u0627\u0644\u06af\u0648 \u2190 \u0645\u0631\u062d\u0644\u0647 \u062a\u06a9\u0645\u06cc\u0644 \u2190 \u0647\u062f\u0641 \u0642\u06cc\u0645\u062a\u06cc \u2190 \u0646\u062a\u06cc\u062c\u0647 \u0627\u0644\u06af\u0648\u06cc\u06cc',
    endingStyle: '\u00ab\u0627\u0644\u06af\u0648\u06cc \u0642\u06cc\u0645\u062a\u06cc \u062f\u0631 \u062d\u0627\u0644 \u0634\u06a9\u0644\u200c\u06af\u06cc\u0631\u06cc \u0627\u0633\u062a\u060c \u0627\u0647\u062f\u0627\u0641 \u0642\u0627\u0628\u0644 \u0645\u062d\u0627\u0633\u0628\u0647 \u0627\u0633\u062a\u00bb',
  },
  {
    id: 'psychological',
    name: '\u0631\u0648\u0627\u0646\u0634\u0646\u0627\u062e\u062a\u06cc',
    nameEn: 'Psychological',
    voice: '\u062a\u0645\u0631\u06a9\u0632 \u0628\u0631 \u0631\u0641\u062a\u0627\u0631 \u0645\u0639\u0627\u0645\u0644\u06af\u0631\u0627\u0646\u060c \u0637\u0645\u0639 \u0648 \u0631\u0647\u0628. \u0627\u0632 \u00ab\u062a\u0631\u0633\u00bb\u060c \u00ab\u0637\u0645\u0639\u00bb\u060c \u00ab\u0633\u0631\u062e\u0648\u0631\u062f\u06af\u06cc\u00bb \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0645\u06cc\u0634\u0648\u062f.',
    structure: '\u0631\u0641\u062a\u0627\u0631 \u062d\u062c\u0645 \u2190 \u0631\u0648\u0627\u0646\u0634\u0646\u0627\u062e\u062a\u06cc \u0628\u0627\u0632\u0627\u0631 \u2190 \u0633\u0646\u0627\u0631\u06cc\u0648\u0647\u0627\u06cc \u0631\u0641\u062a\u0627\u0631\u06cc \u2190 \u0646\u062a\u06cc\u062c\u0647 \u0631\u0648\u0627\u0646\u0634\u0646\u0627\u062e\u062a\u06cc',
    endingStyle: '\u00ab\u0631\u0641\u062a\u0627\u0631 \u0645\u0639\u0627\u0645\u0644\u06af\u0631\u0627\u0646 \u0642\u0627\u0628\u0644 \u067e\u06cc\u0634\u200c\u0628\u06cc\u0646\u06cc \u0627\u0633\u062a \u0627\u06af\u0631 \u062f\u0642\u06cc\u0642 \u0628\u0627\u0634\u06cc\u0645\u00bb',
  },
  {
    id: 'volatilityAnalyst',
    name: '\u062a\u062d\u0644\u06cc\u0644\u06af\u0631 \u0646\u0648\u0633\u0627\u0646',
    nameEn: 'Volatility Analyst',
    voice: '\u062a\u0645\u0631\u06a9\u0632 \u0628\u0631 \u0634\u062f\u062a \u0646\u0648\u0633\u0627\u0646 \u0648 \u0627\u062a\u0641\u0627\u0642\u0627\u062a. \u0627\u0632 \u00ab\u0646\u0648\u0633\u0627\u0646\u00bb\u060c \u00ab\u0627\u062a\u0641\u0627\u0642\u00bb\u060c \u00ab\u0641\u0634\u0631\u062f\u06af\u06cc\u00bb\u060c \u00ab\u0628\u0627\u0631\u06cc\u06a9\u00bb \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0645\u06cc\u0634\u0648\u062f.',
    structure: '\u0634\u062f\u062a \u0646\u0648\u0633\u0627\u0646 (ATR) \u2190 \u0641\u0634\u0631\u062f\u06af\u06cc/\u0628\u0627\u0631\u06cc\u06a9 \u2190 \u0633\u0646\u0627\u0631\u06cc\u0648\u06cc \u0627\u062a\u0641\u0627\u0642\u06cc \u2190 \u0645\u062f\u06cc\u0631\u06cc\u062a \u0631\u06cc\u0633\u06a9 \u0628\u0627 ATR',
    endingStyle: '\u00ab\u0646\u0648\u0633\u0627\u0646 \u0628\u0627\u0644\u0627 \u06cc\u0639\u0646\u06cc \u0641\u0631\u0635\u062a\u060c \u0646\u0648\u0633\u0627\u0646 \u067e\u0627\u06cc\u06cc\u0646 \u06cc\u0639\u0646\u06cc \u0635\u0628\u0631\u00bb',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 15 Analytical Tones
// ═══════════════════════════════════════════════════════════════════════════════

export const TONES: ToneDef[] = [
  { id: 'formal', name: '\u0631\u0633\u0645\u06cc \u0648 \u0622\u06a9\u0627\u062f\u0645\u06cc\u06a9', nameEn: 'Formal Academic', characteristics: '\u062c\u0645\u0644\u0627\u062a \u0628\u0644\u0646\u062f\u060c \u0627\u0633\u062a\u062f\u0644\u0627\u0644\u200c\u0645\u062d\u0648\u0631\u060c \u0628\u0627 \u0627\u0631\u062c\u0627\u0639 \u0628\u0647 \u0645\u0628\u0627\u0646\u06cc \u062a\u062d\u0644\u06cc\u0644\u06cc.', vocabulary: '\u0628\u06cc\u0627\u0646\u06a9\u0646\u06cc\u060c \u0628\u0627\u0632\u0627\u0631\u0634\u0627\u062e\u0635\u060c \u0645\u0634\u062e\u0635\u0627\u062a\u060c \u0627\u0631\u0632\u06cc\u0627\u0628\u06cc', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u067e\u06cc\u0686\u06cc\u062f\u0647 \u0628\u0627 \u0648\u0627\u0635\u0644\u0647\u200c\u0647\u0627\u06cc \u0645\u0646\u0637\u0642\u06cc' },
  { id: 'fast', name: '\u0633\u0631\u06cc\u0639 \u0648 \u0639\u0645\u0644\u06cc\u0627\u062a\u06cc', nameEn: 'Fast Operational', characteristics: '\u062c\u0645\u0644\u0627\u062a \u06a9\u0648\u062a\u0627\u0647\u060c \u0633\u0631\u06cc\u0639\u060c \u0628\u062f\u0648\u0646 \u062d\u0627\u0634\u06cc\u0647.', vocabulary: '\u0627\u06a9\u0646\u0648\u0646\u060c \u0641\u0648\u0631\u06cc\u060c \u0627\u0644\u0627\u0646\u060c \u0628\u0644\u0627\u0641\u0627\u0635\u0644\u0647', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u06a9\u0648\u062a\u0627\u0647 \u0648 \u0627\u0646\u062f\u0627\u0632\u06af\u06cc\u0631' },
  { id: 'philosophical', name: '\u0641\u0644\u0633\u0641\u06cc \u0648 \u0632\u0645\u0627\u0646\u06cc', nameEn: 'Philosophical Temporal', characteristics: '\u0622\u0631\u0627\u0645\u060c \u062a\u0648\u0635\u06cc\u0641\u06cc\u060c \u0628\u0627 \u0627\u0631\u062c\u0627\u0639 \u0628\u0647 \u0632\u0645\u0627\u0646 \u0648 \u0633\u0627\u062e\u062a\u0627\u0631 \u0628\u0627\u0632\u0627\u0631.', vocabulary: '\u0686\u0631\u062e\u0647\u060c \u0641\u0627\u0632\u060c \u062a\u062b\u0628\u06cc\u062a\u060c \u0632\u0645\u0627\u0646\u060c \u062a\u06a9\u0627\u0645\u0644', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u0628\u0644\u0646\u062f \u062a\u0648\u0635\u06cc\u0641\u06cc \u0628\u0627 \u0627\u0633\u062a\u0639\u0627\u0631\u0647' },
  { id: 'warning', name: '\u0647\u0634\u062f\u0627\u0631\u062f\u0647\u0646\u062f\u0647 \u0648 \u0631\u06cc\u0633\u06a9\u200c\u0645\u062d\u0648\u0631', nameEn: 'Warning Risk-Focused', characteristics: '\u062a\u0644\u062e\u060c \u0647\u0634\u062f\u0627\u0631\u062f\u0647\u0646\u062f\u0647\u060c \u0628\u0627 \u062a\u0623\u06a9\u06cc\u062f \u0628\u0631 \u062e\u0637\u0648\u0631.', vocabulary: '\u062e\u0637\u0631\u060c \u0631\u06cc\u0633\u06a9\u060c \u0634\u06a9\u0633\u062a\u060c \u0627\u062d\u062a\u06cc\u0627\u0637\u06cc\u060c \u0647\u0634\u062f\u0627\u0631', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u0647\u0634\u062f\u0627\u0631 \u0628\u0627 \u0627\u0641\u0639\u0627\u0644 \u0641\u0631\u06cc\u0628\u0646\u062f\u0647' },
  { id: 'storytelling', name: '\u062f\u0627\u0633\u062a\u0627\u0646\u06cc \u0648 \u062a\u0648\u0635\u06cc\u0641\u06cc', nameEn: 'Storytelling Descriptive', characteristics: '\u062a\u0635\u0648\u06cc\u0631\u0633\u0627\u0632\u060c \u0627\u0633\u062a\u0639\u0627\u0631\u06cc\u060c \u0628\u0627 \u0627\u0644\u0647\u0627\u0645 \u0628\u0635\u0631\u06cc.', vocabulary: '\u062c\u0627\u062f\u0647\u060c \u0645\u0633\u06cc\u0631\u060c \u0641\u0646\u0631\u060c \u0633\u0627\u06cc\u0647\u060c \u0633\u06af\u0627\u0631', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u062a\u0635\u0648\u06cc\u0631\u06cc \u0628\u0627 \u0627\u0633\u062a\u0639\u0627\u0631\u0647 \u0648 \u062a\u0634\u0628\u06cc\u0647' },
  { id: 'stepByStep', name: '\u06af\u0627\u0645\u200c\u0628\u0647\u200c\u06af\u0627\u0645 \u0648 \u0639\u0645\u0644\u06cc', nameEn: 'Step-by-Step Practical', characteristics: '\u0634\u0631\u0637\u06cc\u060c \u0645\u0631\u062d\u0644\u0647\u200c\u0627\u06cc\u060c \u0634\u0641\u0627\u0641.', vocabulary: '\u0627\u06af\u0631\u060c \u0622\u0646\u06af\u0627\u0647\u060c \u0627\u0642\u062f\u0627\u0645\u060c \u0645\u0631\u062d\u0644\u0647\u060c \u0634\u0631\u0637', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u0634\u0631\u0637\u06cc \u0628\u0627 \u0627\u0631\u0632\u06cc\u0627\u0628\u06cc \u0627\u0646\u062f\u0627\u0632\u0647\u200c\u0627\u06cc' },
  { id: 'skeptical', name: '\u0634\u06a9\u0627\u06a9 \u0648 \u067e\u0631\u0633\u0634\u06af\u0631', nameEn: 'Skeptical Questioning', characteristics: '\u067e\u0631\u0633\u0634\u06af\u0631\u060c \u062a\u0631\u062f\u06cc\u062f\u06cc\u060c \u0628\u0627 \u062a\u0623\u06a9\u06cc\u062f \u0628\u0631 \u0633\u06cc\u06af\u0646\u0627\u0644\u200c\u0647\u0627\u06cc \u0645\u062a\u0636\u0627\u062f.', vocabulary: '\u0622\u06cc\u0627\u061f\u060c \u0686\u0631\u0627\u061f\u060c \u062a\u0636\u0627\u062f\u060c \u0627\u0628\u0647\u0627\u0645\u060c \u0634\u06a9\u0627\u0641', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u067e\u0631\u0633\u0634\u06cc \u0648 \u062a\u0631\u062f\u06cc\u062f\u06cc' },
  { id: 'optimistic', name: '\u062e\u0648\u0634\u0628\u06cc\u0646 \u0648 \u0631\u0648\u0646\u062f\u067e\u0630\u06cc\u0631', nameEn: 'Optimistic Trend-Following', characteristics: '\u0627\u0631\u0632\u0634\u062f\u0647\u060c \u0645\u062b\u0628\u062a\u060c \u0628\u0627 \u062a\u0645\u0631\u06a9\u0632 \u0628\u0631 \u0641\u0631\u0635\u062a\u200c\u0647\u0627.', vocabulary: '\u0641\u0631\u0635\u062a\u060c \u062a\u0642\u0648\u06cc\u062a\u060c \u062a\u062f\u0627\u0648\u0645\u060c \u0635\u0639\u0648\u062f\u060c \u062a\u0623\u06cc\u06cc\u062f', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u0645\u062b\u0628\u062a \u0628\u0627 \u0627\u0641\u0639\u0627\u0644 \u0627\u0646\u0631\u0698\u06cc' },
  { id: 'simple', name: '\u0633\u0627\u062f\u0647 \u0648 \u0634\u0641\u0627\u0641', nameEn: 'Simple Clear', characteristics: '\u0634\u0641\u0627\u0641\u060c \u0645\u0633\u062a\u0642\u06cc\u0645\u060c \u0628\u062f\u0648\u0646 \u067e\u06cc\u0686\u06cc\u062f\u06af\u06cc.', vocabulary: '\u0627\u0633\u062a\u060c \u0646\u06cc\u0633\u062a\u060c \u0628\u0627\u0644\u0627\u060c \u067e\u0627\u06cc\u06cc\u0646\u060c \u0645\u06cc\u0627\u0646\u0647', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u06a9\u0648\u062a\u0627\u0647 \u0648 \u0631\u0648\u0627\u0646' },
  { id: 'quantitative', name: '\u0639\u062f\u062f\u0645\u062d\u0648\u0631 \u0648 \u0633\u062e\u062a\u06af\u06cc\u0631', nameEn: 'Quantitative Rigorous', characteristics: '\u0628\u0627 \u0627\u0631\u062c\u0627\u0639 \u0639\u062f\u062f\u06cc \u0645\u0634\u062e\u0635\u060c \u0633\u062e\u062a\u06af\u06cc\u0631\u060c \u0628\u062f\u0648\u0646 \u0627\u062d\u0633\u0627\u0633.', vocabulary: '\u0646\u0633\u0628\u062a\u060c \u0627\u0646\u062d\u0631\u0627\u0641\u060c \u0627\u0646\u062d\u0631\u0627\u0641 \u0645\u0639\u06cc\u0627\u0631\u060c \u0627\u062d\u062a\u0645\u0627\u0644\u060c \u0622\u0645\u0627\u0631', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u0639\u062f\u062f\u06cc \u0628\u0627 \u0627\u0631\u062c\u0627\u0639 \u0628\u0647 \u0627\u0631\u0642\u0627\u0645' },
  { id: 'mysterious', name: '\u0686\u0646\u062f\u0644\u0627\u06cc\u0647 \u0648 \u0645\u0631\u0645\u0648\u0632', nameEn: 'Multi-Layer Mysterious', characteristics: '\u067e\u06cc\u0686\u06cc\u062f\u0647\u060c \u0627\u0631\u062c\u0627\u0639\u200c\u0645\u062d\u0648\u0631\u060c \u0628\u0627 \u0644\u0627\u06cc\u0647\u200c\u0647\u0627\u06cc \u067e\u0646\u0647\u0627\u0646.', vocabulary: '\u062a\u0646\u062a\u0627\u0646\u06cc\u062c\u060c \u0628\u0627\u0632\u0646\u0634\u06cc\u060c \u0631\u0627\u0632\u0646\u0634\u06cc\u060c \u062f\u0631\u0648\u0646\u060c \u067e\u062a\u0631\u0646\u0647\u0627\u06cc', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u0637\u0648\u0644\u0627\u0646\u06cc \u0628\u0627 \u0627\u0631\u062c\u0627\u0639 \u0627\u0633\u062a\u0639\u0627\u0631\u06cc' },
  { id: 'educational', name: '\u0622\u0645\u0648\u0632\u0634\u06cc \u0648 \u0631\u0627\u0647\u0646\u0645\u0627\u06cc\u0627\u0646\u0647', nameEn: 'Educational Guiding', characteristics: '\u0622\u0645\u0648\u0632\u0634\u06cc\u060c \u0631\u0627\u0647\u0646\u0645\u0627\u06cc\u0627\u0646\u0647\u060c \u0628\u0627 \u062a\u0648\u0636\u06cc\u062d \u062f\u0644\u06cc\u0644.', vocabulary: '\u062a\u0648\u062c\u0647 \u06a9\u0646\u06cc\u062f\u060c \u062f\u0631 \u0646\u0638\u0631 \u0628\u06af\u06cc\u0631\u06cc\u062f\u060c \u0645\u0647\u0645 \u0627\u0633\u062a\u060c \u0628\u0647 \u0627\u06cc\u0646 \u062f\u0644\u06cc\u0644', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u062a\u0648\u0636\u06cc\u062d\u06cc \u0628\u0627 \u0627\u0631\u062c\u0627\u0639 \u0628\u0647 \u0645\u0646\u0637\u0642' },
  { id: 'comparative', name: '\u0645\u0642\u0627\u06cc\u0633\u0647\u200c\u0627\u06cc \u0648 \u0686\u0646\u062f\u0633\u0646\u0627\u0631\u06cc\u0648\u06cc', nameEn: 'Comparative Multi-Scenario', characteristics: '\u062a\u0637\u0628\u06cc\u0642\u06cc\u060c \u0628\u0627 \u0628\u0631\u0631\u0633\u06cc \u0686\u0646\u062f \u0632\u0627\u0648\u06cc\u0647.', vocabulary: '\u062f\u0631 \u0645\u0642\u0627\u0628\u0644\u060c \u0627\u0632 \u06cc\u06a9 \u0633\u0648\u060c \u0628\u0647 \u0627\u062a\u0641\u0627\u0642\u060c \u0646\u0633\u0628\u062a\u0627', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u0645\u0642\u0627\u06cc\u0633\u0647\u200c\u0627\u06cc \u0628\u0627 \u0627\u0631\u062c\u0627\u0639 \u0628\u0647 \u0633\u0646\u0627\u0631\u06cc\u0648\u0647\u0627' },
  { id: 'balanced', name: '\u0645\u062a\u0648\u0627\u0632\u0646 \u0648 \u0628\u06cc\u0637\u0631\u0641', nameEn: 'Balanced Neutral', characteristics: '\u0645\u062a\u0648\u0627\u0632\u0646\u060c \u0628\u06cc\u0637\u0631\u0641\u060c \u0628\u062f\u0648\u0646 \u062a\u062d\u0632\u06cc\u0635.', vocabulary: '\u062f\u0631 \u0645\u062c\u0645\u0648\u0639\u060c \u0628\u0627 \u062a\u0648\u062c\u0647 \u0628\u0647\u060c \u0645\u0646\u0637\u0642\u0647\u200c\u0627\u06cc\u060c \u0628\u0627\u0644\u0627\u062a\u0631', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u0645\u062a\u0648\u0627\u0632\u0646 \u0628\u0627 \u0627\u0631\u0627\u0626\u0647 \u0645\u0633\u062a\u0642\u06cc\u0645' },
  { id: 'conclusive', name: '\u062c\u0645\u0639\u200c\u0628\u0646\u062f\u06cc\u200c\u0645\u062d\u0648\u0631 \u0648 \u0646\u062a\u06cc\u062c\u0647\u200c\u06af\u0631\u0627', nameEn: 'Conclusive Result-Oriented', characteristics: '\u0646\u062a\u06cc\u062c\u0647\u200c\u06af\u0631\u0627\u060c \u062c\u0645\u0639\u200c\u0628\u0646\u062f\u0647\u060c \u0628\u0627 \u0646\u06a9\u062a\u0647 \u0646\u0647\u0627\u06cc\u06cc \u0645\u0634\u062e\u0635.', vocabulary: '\u0646\u062a\u06cc\u062c\u062a\u0627\u060c \u0628\u0646\u0627\u0628\u0631\u0627\u06cc\u0646\u060c \u0645\u0633\u0644\u0645\u060c \u062e\u0644\u0627\u0635\u0647\u060c \u0628\u0627\u0632\u06af\u0634\u062a', sentenceStyle: '\u062c\u0645\u0644\u0627\u062a \u062c\u0645\u0639\u200c\u0628\u0646\u062f\u06cc \u0628\u0627 \u0627\u0641\u0639ا\u0644 \u0646\u0647\u0627\u06cc\u06cc' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Scoring Engine
// ═══════════════════════════════════════════════════════════════════════════════

type ScoreFn<T> = (item: T, input: NarrativeInput) => number;

interface ScoredCandidate<T> { item: T; score: number; }

function scoreAll<T>(items: T[], input: NarrativeInput, scoreFn: ScoreFn<T>): ScoredCandidate<T>[] {
  return items.map(item => ({ item, score: scoreFn(item, input) })).sort((a, b) => b.score - a.score);
}

// ─── School Scoring (per-item: checks school.id) ───────────────
function scoreSchool(item: SchoolDef, input: NarrativeInput): number {
  let s = 0;
  const id = item.id;
  const { adx, rsi, stochK, macdHist, obv, hasVolume, cci, bbPosition, trendDirection, nearResistance, nearSupport, trendR2, diPlus, diMinus } = input;

  if (id === 'trend') {
    if (adx > 25 && trendR2 > 0.7) s += (trendDirection === 'up' ? 8 : 6);
    if (adx > 35) s += 3;
    if (diPlus > diMinus && macdHist > 0) s += 2;
    if (trendDirection !== 'neutral') s += 2;
  }

  if (id === 'classical') {
    if (nearResistance || nearSupport) s += 4;
    if ((rsi > 60 && trendDirection === 'down') || (rsi < 40 && trendDirection === 'up')) s += 5;
    if (cci > 100 || cci < -100) s += 3;
    if (bbPosition > 85 || bbPosition < 15) s += 2;
  }

  if (id === 'candlestick') {
    if (nearResistance && stochK > 75) s += 5;
    if (nearSupport && stochK < 25) s += 5;
    if (nearResistance || nearSupport) s += 2;
    if (rsi > 70 || rsi < 30) s += 2;
  }

  if (id === 'fibonacci') {
    if (input.priceVsMa21 !== input.priceVsMa100) s += 4;
    if (bbPosition > 80 || bbPosition < 20) s += 3;
    if (nearResistance || nearSupport) s += 2;
  }

  if (id === 'volatility') {
    if (bbPosition > 20 && bbPosition < 80 && adx < 20) s += 6;
    if (bbPosition > 90 || bbPosition < 10) s += 4;
    if (hasVolume) s += 2;
  }

  if (id === 'oscillator') {
    if (rsi > 70 || rsi < 30) s += 5;
    if (stochK > 80 || stochK < 20) s += 4;
    if (cci > 100 || cci < -100) s += 3;
    if ((macdHist > 0 && rsi < 50) || (macdHist < 0 && rsi > 50)) s += 5;
  }

  if (id === 'sr') {
    if (adx < 20) s += 5;
    if (nearResistance) s += 4;
    if (nearSupport) s += 4;
  }

  if (id === 'harmonic') {
    if ((bbPosition > 80 || bbPosition < 20) && (nearResistance || nearSupport)) s += 5;
    if (input.priceVsMa21 !== input.priceVsMa100) s += 3;
    if (nearResistance || nearSupport) s += 2;
  }

  if (id === 'elliott') {
    if (adx > 30 && trendR2 > 0.8) s += 5;
    if (trendDirection === 'up' && bbPosition > 75) s += 3;
    if (trendDirection === 'down' && bbPosition < 25) s += 3;
  }

  if (id === 'psychology') {
    if (adx < 15 || (rsi > 70 && trendDirection === 'down') || (rsi < 30 && trendDirection === 'up')) s += 5;
    if (hasVolume && obv !== 0 && Math.sign(obv) !== (trendDirection === 'up' ? 1 : -1)) s += 4;
    if (rsi > 75 || rsi < 25) s += 2;
  }

  // Baseline so no school gets zero
  return s + 1;
}

// ─── Style Scoring (per-item: checks style.id) ─────────────────
function scoreStyle(item: StyleDef, input: NarrativeInput): number {
  let s = 0;
  const id = item.id;
  const { adx, rsi, stochK, macdHist, obv, hasVolume, cci, bbPosition, trendDirection, nearResistance, nearSupport } = input;

  if (id === 'conservative') {
    if (adx < 20) s += 6;
    if (rsi > 40 && rsi < 60) s += 3;
    if (bbPosition > 30 && bbPosition < 70) s += 2;
  }

  if (id === 'scalper') {
    if (adx > 25 && trendDirection === 'up' && macdHist > 0) s += 6;
    if (stochK > 50 && stochK < 80) s += 2;
    if (bbPosition > 50) s += 2;
  }

  if (id === 'trendFollower') {
    if (adx > 25) s += 5;
    if (trendDirection === 'up' && macdHist > 0) s += 3;
    if (trendDirection === 'down' && macdHist < 0) s += 3;
  }

  if (id === 'bearish') {
    if ((rsi > 70 || stochK > 80) && nearResistance) s += 7;
    if (macdHist < 0 && rsi > 60) s += 4;
    if (cci > 100) s += 2;
  }

  if (id === 'narrative') {
    if (adx < 20) s += 5;
    if ((macdHist > 0 && rsi < 50) || (macdHist < 0 && rsi > 50)) s += 3;
  }

  if (id === 'decision') {
    if (nearResistance || nearSupport) s += 5;
    if (adx > 25) s += 3;
  }

  if (id === 'volumeAnalyst') {
    if (hasVolume && obv !== 0) s += 5;
    if (hasVolume && Math.sign(obv) !== (trendDirection === 'up' ? 1 : -1)) s += 3;
  }

  if (id === 'patternAnalyst') {
    if (nearResistance || nearSupport) s += 5;
    if (bbPosition > 85 || bbPosition < 15) s += 3;
  }

  if (id === 'psychological') {
    if (rsi > 75 || rsi < 25) s += 5;
    if (stochK > 85 || stochK < 15) s += 3;
    if (hasVolume && obv !== 0 && Math.sign(obv) !== (trendDirection === 'up' ? 1 : -1)) s += 2;
  }

  if (id === 'volatilityAnalyst') {
    if (bbPosition > 20 && bbPosition < 80 && adx < 20) s += 6;
    if (bbPosition > 90 || bbPosition < 10) s += 4;
  }

  return s + 1;
}

// ─── Tone Scoring (per-item: checks tone.id) ───────────────────
function scoreTone(item: ToneDef, input: NarrativeInput): number {
  let s = 0;
  const id = item.id;
  const { adx, rsi, stochK, macdHist, obv, hasVolume, bbPosition, trendDirection, nearResistance, nearSupport, dominantScenarioKey, trendR2 } = input;

  if (id === 'formal') {
    if (adx > 25) s += 3;
    if (trendR2 > 0.7) s += 2;
  }

  if (id === 'fast') {
    if (adx > 30 && macdHist > 0 && trendDirection === 'up') s += 5;
    if (stochK > 60) s += 2;
  }

  if (id === 'philosophical') {
    if (adx > 15 && adx < 35) s += 4;
    if (rsi > 40 && rsi < 60) s += 2;
  }

  if (id === 'warning') {
    if ((rsi > 70 || stochK > 80) && nearResistance) s += 7;
    if (macdHist > 0 && rsi < 50) s += 3;
    if ((rsi < 30 || stochK < 20) && nearSupport && trendDirection === 'down') s += 4;
  }

  if (id === 'storytelling') {
    if (adx < 25) s += 4;
    if (bbPosition > 30 && bbPosition < 70) s += 2;
  }

  if (id === 'stepByStep') {
    if (nearResistance || nearSupport) s += 4;
    if (adx > 25) s += 2;
  }

  if (id === 'skeptical') {
    if ((macdHist > 0 && rsi < 50) || (macdHist < 0 && rsi > 50)) s += 6;
    if (rsi > 60 && trendDirection === 'down') s += 3;
    if (rsi < 40 && trendDirection === 'up') s += 3;
  }

  if (id === 'optimistic') {
    if (trendDirection === 'up' && adx > 25 && rsi > 50 && rsi < 70) s += 6;
    if (macdHist > 0 && obv > 0) s += 2;
  }

  if (id === 'simple') {
    if (adx > 20 && adx < 40 && rsi > 40 && rsi < 60) s += 4;
    if (!nearResistance && !nearSupport) s += 2;
  }

  if (id === 'quantitative') {
    if (hasVolume && adx > 25) s += 3;
    if (rsi > 70 || rsi < 30) s += 2;
  }

  if (id === 'mysterious') {
    if (adx < 20) s += 4;
    if ((macdHist > 0 && rsi < 50) || (macdHist < 0 && rsi > 50)) s += 3;
    if (dominantScenarioKey === 'SC3') s += 2;
  }

  if (id === 'educational') {
    if (nearResistance || nearSupport) s += 3;
    if (rsi > 65 || rsi < 35) s += 2;
  }

  if (id === 'comparative') {
    const probs = Object.values(input.scenarioProbabilities);
    const maxProb = Math.max(...probs);
    if (maxProb < 35) s += 5;
    if (probs.filter(p => p > 20).length >= 3) s += 3;
  }

  if (id === 'balanced') {
    if (adx < 20) s += 5;
    if (rsi > 40 && rsi < 60) s += 3;
  }

  if (id === 'conclusive') {
    if (adx > 25 && (rsi > 60 || rsi < 40)) s += 4;
    if (dominantScenarioKey === 'SC1' || dominantScenarioKey === 'SC2') s += 2;
  }

  return s + 1;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Selector: Returns exactly ONE combination per request
// ═══════════════════════════════════════════════════════════════════════════════

export function selectNarrativeCombination(input: NarrativeInput): NarrativeCombination {
  const schoolResults = scoreAll(SCHOOLS, input, scoreSchool);
  const styleResults = scoreAll(STYLES, input, scoreStyle);
  const toneResults = scoreAll(TONES, input, scoreTone);

  return {
    school: schoolResults[0].item,
    style: styleResults[0].item,
    tone: toneResults[0].item,
    schoolScore: schoolResults[0].score,
    styleScore: styleResults[0].score,
    toneScore: toneResults[0].score,
  };
}

// Helper: build NarrativeInput from VdesRequest data
export function buildNarrativeInput(body: {
  currentPrice: number;
  trendDirection: string;
  rsi: number;
  adx: number;
  stochK: number;
  stochD: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  diPlus: number;
  diMinus: number;
  obv: number;
  hasVolume: boolean;
  cci: number;
  mfi: number;
  atr: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  trendAngle: number;
  trendR2: number;
  overallSignal: string;
  scenarios: Record<string, { probability: number }>;
  resistances: number[];
  supports: number[];
  ma21: number;
  ma100: number;
}): NarrativeInput {
  const bbRange = body.bollingerUpper - body.bollingerLower;
  const bbPosition = bbRange > 0
    ? Math.max(0, Math.min(100, ((body.currentPrice - body.bollingerLower) / bbRange) * 100))
    : 50;

  const R1 = body.resistances[0] || body.currentPrice * 1.05;
  const S1 = body.supports[0] || body.currentPrice * 0.95;

  // Find dominant scenario
  let dominantKey = 'SC3';
  let dominantProb = 0;
  for (const k of ['SC1', 'SC2', 'SC3', 'SC4', 'SC5'] as const) {
    const p = body.scenarios[k]?.probability ?? 0;
    if (p > dominantProb) { dominantProb = p; dominantKey = k; }
  }

  return {
    price: body.currentPrice,
    trendDirection: body.trendDirection,
    rsi: body.rsi,
    adx: body.adx,
    stochK: body.stochK,
    stochD: body.stochD,
    macdLine: body.macdLine,
    macdSignal: body.macdSignal,
    macdHist: body.macdHist,
    diPlus: body.diPlus,
    diMinus: body.diMinus,
    obv: body.obv,
    hasVolume: body.hasVolume,
    cci: body.cci,
    mfi: body.mfi,
    atr: body.atr,
    bbPosition,
    bbUpper: body.bollingerUpper,
    bbLower: body.bollingerLower,
    dominantScenarioKey: dominantKey,
    scenarioProbabilities: {
      SC1: body.scenarios.SC1?.probability ?? 0,
      SC2: body.scenarios.SC2?.probability ?? 0,
      SC3: body.scenarios.SC3?.probability ?? 0,
      SC4: body.scenarios.SC4?.probability ?? 0,
      SC5: body.scenarios.SC5?.probability ?? 0,
    },
    nearResistance: R1 > 0 ? Math.abs(body.currentPrice - R1) / R1 < 0.03 : false,
    nearSupport: S1 > 0 ? Math.abs(body.currentPrice - S1) / S1 < 0.03 : false,
    priceVsMa21: body.currentPrice > body.ma21 ? 'above' : 'below',
    priceVsMa100: body.currentPrice > body.ma100 ? 'above' : 'below',
    trendR2: body.trendR2,
  };
}