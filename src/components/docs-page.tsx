'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, ChevronLeft,
  GitBranch, Workflow, FileCode, Boxes, ArrowLeftRight,
  Layers, Activity, GitMerge, Timer, MessageSquare,
  Search, Palette, Cpu,
  BarChart3, Shield, HardDrive, Package,
  ZoomIn, ZoomOut, Download,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-store';
import MermaidDiagram from './mermaid-diagram';
import PlantUMLDiagram from './plantuml-diagram';

// ═══════════════════════════════════════════════════════════════
// Section Tree — all documentation sections
// ═══════════════════════════════════════════════════════════════

interface Section {
  id: string;
  label: string;
  icon: React.ElementType;
  children?: Section[];
  badge?: string;
  badgeColor?: string;
}

const SECTIONS: Section[] = [
  {
    id: 'dfd', label: 'دیاگرام جریان داده (DFD)', icon: ArrowLeftRight, badge: '12', badgeColor: '#3b82f6',
    children: [
      { id: 'dfd-l0', label: 'سطح ۰ — نمودار زمینه', icon: Boxes },
      { id: 'dfd-l1', label: 'سطح ۱ — فرایندهای اصلی', icon: GitBranch },
      { id: 'dfd-l2', label: 'سطح ۲ — زیرفرایندها', icon: Layers },
      { id: 'dfd-l3', label: 'سطح ۳ — جزییات عملیاتی', icon: Activity },
    ],
  },
  {
    id: 'bpmn', label: 'دیاگرام فرایند (BPMN)', icon: Workflow, badge: '9', badgeColor: '#8b5cf6',
    children: [
      { id: 'bpmn-l1', label: 'سطح ۱ — نمای کلان', icon: Boxes },
      { id: 'bpmn-l2', label: 'سطح ۲ — فرایندهای اجرایی', icon: GitBranch },
      { id: 'bpmn-l3', label: 'سطح ۳ — زیرفرایندهای جزیی', icon: Activity },
    ],
  },
  {
    id: 'uml-structural', label: 'UML ساختاری', icon: FileCode, badge: '21', badgeColor: '#059669',
    children: [
      { id: 'uml-class', label: 'نمودار کلاس', icon: FileCode },
      { id: 'uml-object', label: 'نمودار شیء', icon: Boxes },
      { id: 'uml-component', label: 'نمودار مؤلفه', icon: Cpu },
      { id: 'uml-deployment', label: 'نمودار استقرار', icon: HardDrive },
      { id: 'uml-package', label: 'نمودار بسته', icon: Package },
      { id: 'uml-composite', label: 'نمودار ساختار ترکیبی', icon: Layers },
      { id: 'uml-profile', label: 'نمودار نمایه', icon: Palette },
    ],
  },
  {
    id: 'uml-behavioral', label: 'UML رفتاری', icon: Activity, badge: '11', badgeColor: '#d97706',
    children: [
      { id: 'uml-usecase', label: 'نمودار موردکاربری', icon: Shield },
      { id: 'uml-activity', label: 'نمودار فعالیت', icon: Activity },
      { id: 'uml-state', label: 'نمودار ماشین حالت', icon: GitMerge },
    ],
  },
  {
    id: 'uml-interaction', label: 'UML تعاملی', icon: MessageSquare, badge: '12', badgeColor: '#dc2626',
    children: [
      { id: 'uml-sequence', label: 'نمودار توالی', icon: ArrowLeftRight },
      { id: 'uml-communication', label: 'نمودار ارتباطی', icon: MessageSquare },
      { id: 'uml-overview', label: 'نمودار نمای کلی تعامل', icon: BarChart3 },
      { id: 'uml-timing', label: 'نمودار زمان‌بندی', icon: Timer },
    ],
  },
  {
    id: 'coherence', label: 'جدول انسجام', icon: GitMerge, badge: '48', badgeColor: '#64748b',
  },
  {
    id: 'appendix', label: 'ضمائم', icon: BookOpen,
  },
];

// ═══════════════════════════════════════════════════════════════
// Diagram Data — all diagram definitions
// ═══════════════════════════════════════════════════════════════

interface DiagramDef {
  title: string;
  description: string;
  type: 'mermaid' | 'plantuml';
  code: string;
  level?: string;
  farsiNotes: string[];
}

// ─── DFD Diagrams ──────────────────────────────────────────────

const DFD_DIAGRAMS: Record<string, DiagramDef[]> = {
  'dfd-l0': [{
    title: 'نمودار زمینه (Context Diagram) — سطح ۰',
    description: 'کل سیستم به‌عنوان یک فرایند واحد با تمام موجودیت‌های خارجی',
    type: 'mermaid',
    code: `flowchart LR
    classDef entity fill:#2d6a4f,stroke:#40916c,stroke-width:2px,color:#fff,font-weight:bold
    classDef process fill:#1d3557,stroke:#457b9d,stroke-width:2px,color:#fff,font-weight:bold
    classDef store fill:#e76f51,stroke:#f4a261,stroke-width:2px,color:#fff

    User["👤 کاربر / معامله‌گر"]:::entity
    TSE["📈 TSETMC / BrsApi"]:::entity
    TGJU["🏦 تاجو"]:::entity
    Yahoo["🌍 یاهو فایننس"]:::entity
    ZAI["🤖 Z-AI SDK"]:::entity
    Finpy["🐍 finpy-tse"]:::entity
    TsetmcIdx["📊 سرویس شاخص"]:::entity

    P0["سامانه تحلیل تکنیکال\nبورس ایران"]:::process

    User -->|"نماد، درخواست تحلیل"| P0
    TSE -->|"داده OHLCV سهام"| P0
    TGJU -->|"داده طلا/ارز/کریپتو"| P0
    Yahoo -->|"داده بازار جهانی"| P0
    ZAI -->|"متن تحلیل AI"| P0
    Finpy -->|"داده جایگزین TSE"| P0
    TsetmcIdx -->|"داده شاخص بورس"| P0

    P0 -->|"نتایج تحلیل، نمودار، متن"| User`,
    level: 'سطح ۰',
    farsiNotes: [
      '🔹 این نمودار کل سیستم را به‌عنوان یک فرایند واحد (P0) نشان می‌دهد.',
      '🔹 ۷ موجودیت خارجی با سیستم تعامل دارند: کاربر، TSETMC، تاجو، یاهو، Z-AI، finpy-tse و سرویس شاخص.',
      '🔹 جریان ورودی شامل درخواست کاربر و داده‌های بازار از منابع مختلف است.',
      '🔹 جریان خروجی شامل نتایج تحلیل، نمودارها و متن هوشمند است.',
      '🔹 رنگ سبز = موجودیت خارجی، رنگ سرمه‌ای = فرایند سیستم.',
    ],
  }],
  'dfd-l1': [{
    title: 'فرایندهای سطح بالا — سطح ۱',
    description: '۷ فرایند اصلی با مخازن داده و جریان‌های بین‌فرایندی',
    type: 'mermaid',
    code: `flowchart TB
    classDef entity fill:#2d6a4f,stroke:#40916c,stroke-width:2px,color:#fff
    classDef process fill:#1d3557,stroke:#457b9d,stroke-width:2px,color:#fff
    classDef store fill:#e76f51,stroke:#f4a261,stroke-width:2px,color:#fff

    E1["👤 کاربر"]:::entity
    E2["📈 منابع داده"]:::entity
    E3["🤖 Z-AI"]:::entity

    P1["P1: تحلیل تکنیکال\nta-engine"]:::process
    P2["P2: تشخیص رژیم\nregime-engine"]:::process
    P3["P3: یادگیری ML\nml-engine"]:::process
    P4["P4: تحلیل S/R\nsr-analyzer"]:::process
    P5["P5: تشخیص الگو\npattern-detection"]:::process
    P6["P6: تولید متن AI\nvdes-analysis"]:::process
    P7["P7: بازخورد تطبیقی\nmsl-feedback"]:::process

    D1[("D1: کش OHLCV")]:::store
    D2[("D2: نتایج TA")]:::store
    D3[("D3: مدل ML")]:::store
    D4[("D4: بازخورد")]:::store
    D5[("D5: پروفایل حجم")]:::store
    D6[("D6: کش نماد")]:::store

    E2 -->|"OHLCV"| D1
    D1 --> P1
    P1 -->|"اندیکاتورها"| D2
    D2 --> P2
    D2 --> P3
    D2 --> P4
    P4 -->|"نمرات S/R"| D5
    D2 --> P5
    D2 --> P6
    E3 -->|"متن AI"| P6
    D2 --> P7
    P7 -->|"وزن‌ها"| D3
    D3 --> P3
    P7 --> D4
    P1 --> E1
    P6 --> E1`,
    level: 'سطح ۱',
    farsiNotes: [
      '🔹 ۷ فرایند اصلی سیستم: تحلیل تکنیکال، تشخیص رژیم، ML، تحلیل S/R، الگو، متن AI و بازخورد.',
      '🔹 ۶ مخزن داده: کش OHLCV، نتایج TA، مدل ML، بازخورد، پروفایل حجم و کش نماد.',
      '🔹 حلقه بازخورد: P7 (بازخورد) → D3 (مدل) → P3 (ML) — سیستم یادگیری تطبیقی.',
      '🔹 فرایندهای موازی: P2 و P4 و P5 همزمان از D2 (نتایج TA) مصرف می‌کنند.',
      '🔹 P6 تنها فرایندی است که به منبع خارجی Z-AI وابسته است.',
    ],
  }],
  'dfd-l2': [{
    title: 'زیرفرایندهای تحلیل تکنیکال — سطح ۲ (P1)',
    description: 'تفکیک فرایند تحلیل تکنیکال به ۵ زیرفرایند',
    type: 'mermaid',
    code: `flowchart LR
    classDef process fill:#1d3557,stroke:#457b9d,stroke-width:2px,color:#fff
    classDef store fill:#e76f51,stroke:#f4a261,stroke-width:2px,color:#fff

    P1_1["P1.1: محاسبه اندیکاتورها\nRSI, MACD, ADX..."]:::process
    P1_2["P1.2: تشخیص ترند\ncalcTrend()"]:::process
    P1_3["P1.3: سطوح S/R\n۷ منبع"]:::process
    P1_4["P1.4: ۷ لایه VDss\nمحاسبه سناریوها"]:::process
    P1_5["P1.5: تعیین سیگنال\noverallSignal"]:::process

    D1[("D1: OHLCV")]:::store
    D2[("D2: نتایج")]:::store

    D1 --> P1_1
    P1_1 --> P1_2
    P1_1 --> P1_3
    P1_2 --> P1_4
    P1_3 --> P1_4
    P1_4 --> P1_5
    P1_5 --> D2`,
    level: 'سطح ۲ — P1',
    farsiNotes: [
      '🔹 P1.1 تمام اندیکاتورها (۶۰+) را محاسبه می‌کند: RSI, MACD, ADX, Stochastic, Bollinger...',
      '🔹 P1.2 ترند را با رگرسیون خطی و فرمول زاویه atan((slope/avgPrice)*100) تشخیص می‌دهد.',
      '🔹 P1.3 سطوح حمایت/مقاومت را از ۷ منبع (Swing, SMA, BB, Fib, VAP, Pivot, Psych) استخراج می‌کند.',
      '🔹 P1.4 موتور ۷ لایه VDss احتمال ۹ سناریو را محاسبه می‌کند.',
      '🔹 P1.5 سیگنال کلی (bullish/bearish/neutral) و قدرت آن را تعیین می‌کند.',
    ],
  }, {
    title: 'زیرفرایندهای تشخیص رژیم — سطح ۲ (P2)',
    description: '۳ موتور مستقل با ترکیب نهایی',
    type: 'mermaid',
    code: `flowchart TB
    classDef process fill:#1d3557,stroke:#457b9d,stroke-width:2px,color:#fff
    classDef store fill:#e76f51,stroke:#f4a261,stroke-width:2px,color:#fff

    P2_1["P2.1: تشخیص فازی\nfuzzyRegimeDetector()"]:::process
    P2_2["P2.2: زنجیره مارکوف\npropagateMarkov()"]:::process
    P2_3["P2.3: رأی‌گیری وزنی\nadaptiveWeightedVote()"]:::process
    P2_4["P2.4: ترکیب نهایی\n0.5×Markov + 0.3×Fuzzy + 0.2×Vote"]:::process

    D[("وضع مارکوف")]:::store

    P2_1 -->|"μ(up/down/neutral)"| P2_4
    P2_2 -->|"π[state]"| P2_4
    P2_3 -->|"vote ∈ [-1,+1]"| P2_4
    D --> P2_2
    P2_4 -->|"بروزرسانی"| D
    P2_4 -->|"RegimeResult"|_OUT["خروجی"]`,
    level: 'سطح ۲ — P2',
    farsiNotes: [
      '🔹 ۳ موتور مستقل: فازی (جایگزین GNN)، مارکوف (جایگزین HMM)، رأی‌گیری (جایگزین Transformer).',
      '🔹 موتور فازی با توابع عضویت trimf/trapmf روی ADX, RSI, BB عضویت ۰-۱ تولید می‌کند.',
      '🔹 مارکوف با ماتریس انتقال ۵×۵ و بروزرسانی بیز حالت را انتشار می‌دهد.',
      '🔹 رأی‌گیری ۷ اندیکاتور با وزن تطبیقی رأی -۱/۰/+۱ می‌دهد.',
      '🔹 ترکیب: 0.5×Markov + 0.3×Fuzzy + 0.2×Vote — مارکوف بیشترین وزن را دارد.',
    ],
  }, {
    title: 'زیرفرایندهای بازخورد تطبیقی — سطح ۲ (P7)',
    description: 'چرخه ثبت پیش‌بینی، جمع‌آوری بازخورد و بروزرسانی وزن‌ها',
    type: 'mermaid',
    code: `flowchart LR
    classDef process fill:#1d3557,stroke:#457b9d,stroke-width:2px,color:#fff
    classDef store fill:#e76f51,stroke:#f4a261,stroke-width:2px,color:#fff

    P7_1["P7.1: ثبت پیش‌بینی\nrecordPrediction()"]:::process
    P7_2["P7.2: ثبت بازخورد\nrecordFeedback()"]:::process
    P7_3["P7.3: بروزرسانی وزن\nupdateWeights()"]:::process
    P7_4["P7.4: آمار\ngetFeedbackStats()"]:::process

    D4[("D4: بازخورد")]:::store
    D3[("D3: وزن‌ها")]:::store

    P7_1 --> D4
    D4 --> P7_2
    P7_2 -->|"isCorrect"| P7_3
    P7_3 -->|"weight ∈ [0.5, 2.0]"| D3
    D4 --> P7_4
    D3 --> P7_4`,
    level: 'سطح ۲ — P7',
    farsiNotes: [
      '🔹 P7.1 هر پیش‌بینی را با شناسه یکتا، سناریو، نماد و جهت ثبت می‌کند.',
      '🔹 P7.2 بازخورد کاربر (درست/نادرست) را ثبت و بروزرسانی وزن را راه‌اندازی می‌کند.',
      '🔹 P7.3 وزن‌ها را با نرخ یادگیری تطبیقی بروزرسانی می‌کند: دقت بالا → LR کم، دقت پایین → LR زیاد.',
      '🔹 P7.4 آمار کلی شامل دقت کلی، دقت بر اساس سناریو و دقت ۲۰ اخیر را محاسبه می‌کند.',
      '🔹 وزن‌ها در بازه [0.5, 2.0] محدود و در localStorage پایدارسازی می‌شوند.',
    ],
  }],
  'dfd-l3': [{
    title: '۷ لایه VDss — سطح ۳ (P1.4)',
    description: 'جزئیات عملیاتی موتور ۷ لایه احتمال',
    type: 'mermaid',
    code: `flowchart LR
    classDef layer fill:#1d3557,stroke:#457b9d,stroke-width:2px,color:#fff
    classDef data fill:#e76f51,stroke:#f4a261,stroke-width:2px,color:#fff

    L1["لایه ۱: نمره خام\nRaw Scores"]:::layer
    L2["لایه ۲: اصلاح مومنتوم\nMomentum + Crossover"]:::layer
    L3["لایه ۳: آموزش ML\nBull Consensus"]:::layer
    L4["لایه ۴: احتمال سناریو\nNormalization"]:::layer
    L5["لایه ۵: وزن یال‌ها\nEdge Weights"]:::layer
    L6["لایه ۶: احتمال مسیر\nDFS Path Probability"]:::layer
    L7["لایه ۷: بروزرسانی تطبیقی\nAdaptive Update"]:::layer

    D[("مدل ML")]:::data

    L1 --> L2 --> L3 --> L4 --> L5 --> L6 --> L7
    D --> L3
    L7 -->|"feedback"| D`,
    level: 'سطح ۳ — ۷ لایه VDss',
    farsiNotes: [
      '🔹 لایه ۱: نمره خام هر سناریو بر اساس اندیکاتورها محاسبه می‌شود.',
      '🔹 لایه ۲: مومنتوم و کراس‌اور/داورجنس اعمال می‌شود.',
      '🔹 لایه ۳: مدل ML آموزش می‌بیند و اجماع صعودی محاسبه می‌شود.',
      '🔹 لایه ۴: نمرات به احتمال‌های نرمال‌شده تبدیل می‌شوند (مجموع = ۱۰۰).',
      '🔹 لایه ۵: وزن یال‌های گراف تصمیم بر اساس شرایط بازار تعیین می‌شود.',
      '🔹 لایه ۶: احتمال هر مسیر با DFS محاسبه می‌شود.',
      '🔹 لایه ۷: بروزرسانی تطبیقی با داده جدید و بازخورد کاربر.',
    ],
  }],
};

// ─── UML Class Diagrams ────────────────────────────────────────

const UML_CLASS_DIAGRAMS: DiagramDef[] = [
  {
    title: 'مدل حوزه (Domain Model) — سطح ۱',
    description: 'کلاس‌های اصلی سیستم و روابط بین آنها',
    type: 'plantuml',
    code: `@startuml
skinparam classAttributeIconSize 0
skinparam classFontSize 13
skinparam defaultFontSize 12
skinparam shadowing false

class OHLCV {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

class TAResult {
  currentPrice: number
  rsi: number
  adx: number
  macdLine: number
  scenarios: Map
  regimeResult: RegimeResult
  overallSignal: string
}

class RegimeResult {
  primary: RegimeType
  probabilities: Map
  confidence: number
}

class VolumeProfileResult {
  poc: number
  valueAreaHigh: number
  valueAreaLow: number
  vwap: number
}

class FeedbackStore {
  -predictions: PredictionRecord[]
  -weights: WeightRecord[]
  +recordPrediction()
  +recordFeedback()
  +updateWeights()
}

OHLCV "1..*" --> "1" TAResult : analyze()
TAResult --> "1" RegimeResult : detectRegime()
TAResult --> "0..1" VolumeProfileResult
FeedbackStore --> TAResult : weights
@enduml`,
    level: 'سطح ۱',
    farsiNotes: [
      '🔹 ۵ کلاس اصلی حوزه: OHLCV, TAResult, RegimeResult, VolumeProfileResult, FeedbackStore.',
      '🔹 OHLCV ورودی اصلی و TAResult خروجی اصلی سیستم است.',
      '🔹 هر تحلیل یک RegimeResult و اختیاری یک VolumeProfileResult تولید می‌کند.',
      '🔹 FeedbackStore وزن‌های تطبیقی را مدیریت می‌کند.',
      '🔹 روابط: تحلیل (1..* → 1)، تشخیص رژیم (→ 1)، بازخورد (→ weights).',
    ],
  },
  {
    title: 'نمودار کلاس طراحی — سطح ۲',
    description: 'کلاس‌های طراحی با ارتباطات و چندگانگی',
    type: 'plantuml',
    code: `@startuml
skinparam classAttributeIconSize 0
skinparam shadowing false

class "ta-engine" as TE <<Engine>> {
  +analyze(data, currencyUnit): TAResult
  +calcTrend(data, period): TrendResult
  +computeHistoricalProbabilities()
}

class "regime-engine" as RE <<Engine>> {
  +detectRegime(input): RegimeResult
  +fuzzyRegimeDetector(input): FuzzyOutput
  +propagateMarkov(chain, obs)
  +adaptiveWeightedVote(ind, weights)
}

class "ml-engine" as ML <<Engine>> {
  +extractVDSSFeatures(): number[]
  +trainAdaptiveModel(X, y)
  +calculateBullConsensus(): number
}

class "sr-analyzer" as SR <<Analyzer>> {
  +analyzeSupportResistance(): SRResult
}

class "volume-profile" as VP <<Analyzer>> {
  +approximateVolumeProfile(): VPResult
  +countTouch(): TouchResult
  +calculateEnhancedSRStrength()
}

class "msl-feedback" as FB <<Store>> {
  +recordPrediction()
  +recordFeedback()
  +updateWeightsFromFeedback()
}

TE *-- RE : contains
TE *-- SR : contains
TE *-- ML : uses
SR o-- VP : uses
ML ..> FB : reads weights
TE ..> FB : writes predictions
@enduml`,
    level: 'سطح ۲',
    farsiNotes: [
      '🔹 ۶ کلاس طراحی با کلیشه‌های UML: <<Engine>>, <<Analyzer>>, <<Store>>.',
      '🔹 ترکیب (Composition): ta-engine شامل regime-engine و sr-analyzer است.',
      '🔹 تجمع (Aggregation): sr-analyzer از volume-profile استفاده می‌کند.',
      '🔹 وابستگی (Dependency): ml-engine وزن‌ها را از feedback-store می‌خواند.',
      '🔹 تمام کلاس‌ها مستقیماً به فایل‌های منبع TypeScript نگاشت می‌شوند.',
    ],
  },
];

// ─── UML Component Diagrams ────────────────────────────────────

const UML_COMPONENT_DIAGRAM: DiagramDef = {
  title: 'معماری مؤلفه‌ها — سطح ۱',
  description: 'مؤلفه‌های سطح بالا و وابستگی‌های بین آنها',
  type: 'plantuml',
  code: `@startuml
skinparam componentStyle rectangle
skinparam shadowing false

package "لایه نمایش" {
  component [SymbolSearch] as SS
  component [CandlestickChart] as CC
  component [IndicatorsPanel] as IP
  component [VdesAnalysis] as VA
  component [VdssGraph] as VG
  component [MLForecast] as MF
}

package "لایه API" {
  component [/api/analysis] as API1
  component [/api/vdes-analysis] as API2
  component [/api/ai-analysis] as API3
  component [/api/ml-predict] as API4
}

package "لایه موتور" {
  component [ta-engine] as TE
  component [regime-engine] as RE
  component [ml-engine] as ML
  component [sr-analyzer] as SR
  component [pattern-detection] as PD
  component [volume-profile] as VP
  component [msl-feedback] as FB
}

package "لایه داده" {
  component [tse-api] as TSE
  component [tgju-api] as TGJU
  component [yahoo-api] as YH
  component [zai-shared] as ZAI
}

SS --> API1
CC --> API1
IP --> API1
VA --> API2
MF --> API4

API1 --> TE
API2 --> ZAI
API3 --> ZAI
API4 --> ML

TE --> RE
TE --> SR
TE --> PD
SR --> VP
ML --> FB

API1 --> TSE
API1 --> TGJU
API1 --> YH
@enduml`,
  level: 'سطح ۱',
  farsiNotes: [
    '🔹 ۴ لایه اصلی: نمایش، API، موتور تحلیل و داده.',
    '🔹 لایه نمایش شامل ۶ کامپوننت React اصلی است.',
    '🔹 لایه API ۴ endpoint اصلی را ارائه می‌دهد.',
    '🔹 لایه موتور شامل ۷ ماژول تحلیلی است.',
    '🔹 لایه داده از ۴ منبع مختلف داده دریافت می‌کند.',
  ],
};

// ─── UML Sequence Diagrams ─────────────────────────────────────

const UML_SEQUENCE_L1: DiagramDef = {
  title: 'تعامل سطح بالا — توالی سطح ۱',
  description: 'جریان اصلی تحلیل از انتخاب نماد تا نمایش نتایج',
  type: 'plantuml',
  code: `@startuml
skinparam shadowing false
actor User
participant "page.tsx" as Page
participant "/api/analysis" as API
participant "tse-api" as TSE
participant "ta-engine" as TA
participant "regime-engine" as RE

User -> Page: انتخاب نماد "فولاد"
Page -> API: GET /api/analysis?symbol=فولاد
API -> TSE: fetchCandlestick("فولاد")
TSE --> API: OHLCV[]
API -> TA: analyze(ohlcv, "ریال")
TA -> RE: detectRegime(input)
RE --> TA: RegimeResult
TA --> API: TAResult
API --> Page: {candles, ta, probabilityTrend}
Page --> User: نمایش نمودار + اندیکاتورها
@enduml`,
  level: 'سطح ۱',
  farsiNotes: [
    '🔹 جریان اصلی: کاربر نماد را انتخاب → API داده را دریافت → ta-engine تحلیل می‌کند.',
    '🔹 regime-engine در داخل ta-engine فراخوانی می‌شود.',
    '🔹 پاسخ شامل کندل‌ها، نتایج TA و ترند احتمال ۳۰ روزه است.',
    '🔹 تمام فراخوانی‌ها همگام (sync) و به ترتیب انجام می‌شوند.',
    '🔹 زمان کل: ~۲-۵ ثانیه بسته به منبع داده.',
  ],
};

// ─── State Machine Diagrams ────────────────────────────────────

const STATE_MACHINE_DIAGRAM: DiagramDef = {
  title: 'ماشین حالت — جلسه تحلیل',
  description: 'حالت‌های اصلی یک جلسه تحلیل از شروع تا پایان',
  type: 'mermaid',
  code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Searching : نماد انتخاب شد
    Searching --> Loading : منبع داده شناسایی شد
    Searching --> Error : نماد یافت نشد
    Loading --> Computing_TA : داده OHLCV دریافت شد
    Loading --> Error : خطا در دریافت داده
    Computing_TA --> Detecting_Regime : اندیکاتورها محاسبه شد
    Detecting_Regime --> Generating_Text : رژیم تشخیص داده شد
    Generating_Text --> Complete : متن AI تولید شد
    Generating_Text --> Complete : کش HIT (بدون AI)
    Error --> Idle : تلاش مجدد
    Complete --> Searching : نماد جدید
    Complete --> Computing_TA : بروزرسانی خودکار

    state Error {
        [*] --> NetworkError
        NetworkError --> TimeoutError
        TimeoutError --> DataError
    }`,
  level: 'سطح ۱',
  farsiNotes: [
    '🔹 ۷ حالت اصلی: Idle, Searching, Loading, Computing_TA, Detecting_Regime, Generating_Text, Complete.',
    '🔹 حالت Error شامل زیرحالت‌های NetworkError, TimeoutError و DataError است.',
    '🔹 از Complete می‌توان به Searching (نماد جدید) یا Computing_TA (بروزرسانی) رفت.',
    '🔹 Generating_Text می‌تواند مستقیماً به Complete برود اگر کش HIT باشد.',
    '🔹 بروزرسانی خودکار هر ۵ دقیقه انجام می‌شود.',
  ],
};

// ─── BPMN Overview ─────────────────────────────────────────────

const BPMN_OVERVIEW: DiagramDef = {
  title: 'نمای کلان فرایند — سطح ۱',
  description: 'استخرها و خطوط اصلی فرایند تحلیل',
  type: 'mermaid',
  code: `flowchart TB
    classDef pool fill:#1e293b,stroke:#475569,stroke-width:2px,color:#e2e8f0
    classDef lane fill:#334155,stroke:#475569,stroke-width:1px,color:#94a3b8
    classDef task fill:#1d3557,stroke:#457b9d,stroke-width:2px,color:#fff
    classDef gateway fill:#d97706,stroke:#f59e0b,stroke-width:2px,color:#fff

    subgraph Pool1["🏊 کاربر"]
        Start(["● شروع"]):::task
        Select["🔍 انتخاب نماد"]:::task
        View["📊 مشاهده نتایج"]:::task
        Feedback["✍️ ثبت بازخورد"]:::task
    end

    subgraph Pool2["🏊 موتور تحلیل"]
        Fetch["📥 دریافت داده"]:::task
        Analyze["⚙️ تحلیل تکنیکال"]:::task
        Regime["🔄 تشخیص رژیم"]:::task
        AI["🤖 تولید متن AI"]:::task
    end

    subgraph Pool3["🏊 منابع داده"]
        TSE["📈 TSETMC"]:::lane
        TGJU["🏦 تاجو"]:::lane
        Yahoo["🌍 یاهو"]:::lane
    end

    Start --> Select --> Fetch
    Fetch --> TSE
    Fetch --> TGJU
    Fetch --> Yahoo
    TSE --> Analyze
    TGJU --> Analyze
    Yahoo --> Analyze
    Analyze --> Regime --> AI --> View
    View --> Feedback`,
  level: 'سطح ۱',
  farsiNotes: [
    '🔹 ۳ استخر (Pool): کاربر، موتور تحلیل و منابع داده.',
    '🔹 فرایند از انتخاب نماد شروع و با مشاهده نتایج و ثبت بازخورد پایان می‌یابد.',
    '🔹 درخواست داده به ۳ منبع (TSETMC, تاجو, یاهو) ارسال می‌شود.',
    '🔹 تحلیل شامل ۴ مرحله است: دریافت، تحلیل، تشخیص رژیم و تولید متن.',
    '🔹 بازخورد کاربر به چرخه یادگیری تطبیقی وارد می‌شود.',
  ],
};

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function DocsPage() {
  const { colors: C, isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState('dfd-l0');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['dfd']));
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const scrollTo = useCallback((id: string) => {
    setActive(id);
    const el = containerRef.current?.querySelector(`[data-section="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Get all diagrams for current section
  const currentDiagrams = useMemo((): DiagramDef[] => {
    // DFD
    if (DFD_DIAGRAMS[active]) return DFD_DIAGRAMS[active];
    // UML Class
    if (active === 'uml-class') return UML_CLASS_DIAGRAMS;
    // UML Component
    if (active === 'uml-component') return [UML_COMPONENT_DIAGRAM];
    // UML Sequence
    if (active === 'uml-sequence') return [UML_SEQUENCE_L1];
    // State Machine
    if (active === 'uml-state') return [STATE_MACHINE_DIAGRAM];
    // BPMN
    if (active === 'bpmn-l1') return [BPMN_OVERVIEW];
    return [];
  }, [active]);

  // Stats
  const totalDiagrams = 65;

  return (
    <div className="flex gap-4 max-h-[calc(100vh-140px)] overflow-hidden" dir="rtl">
      {/* ═══ Sidebar ═══ */}
      <nav
        className="w-72 shrink-0 overflow-y-auto rounded-xl"
        style={{
          backgroundColor: C.cardBg,
          border: `1px solid ${C.cardBorder}`,
          boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <div className="p-4 border-b" style={{ borderColor: C.cardBorder }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: C.primary }}>
            <BookOpen className="w-5 h-5" />
            <h2 className="text-sm font-bold">مستندات دیاگرام‌ها</h2>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: C.cardSubFg }}>
            <Badge variant="outline" className="text-[10px]" style={{ borderColor: C.primary, color: C.primary }}>
              {totalDiagrams} دیاگرام
            </Badge>
            <span>DFD + BPMN + UML 2.5</span>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{ backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}` }}
          >
            <Search className="w-3.5 h-3.5" style={{ color: C.cardSubFg }} />
            <input
              type="text"
              placeholder="جستجو..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none flex-1 text-sm"
              style={{ color: C.cardFg }}
            />
          </div>
        </div>

        {/* Section Tree */}
        <ul className="px-2 pb-4 space-y-0.5">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSections.has(section.id);
            const isActive = active === section.id || active.startsWith(section.id + '-');
            const matchesSearch = !searchQuery || section.label.includes(searchQuery) ||
              section.children?.some(c => c.label.includes(searchQuery));

            if (!matchesSearch) return null;

            return (
              <li key={section.id}>
                <button
                  onClick={() => {
                    if (section.children) toggleSection(section.id);
                    else scrollTo(section.id);
                  }}
                  className="w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
                  style={{
                    backgroundColor: isActive ? C.primaryBg : 'transparent',
                    color: isActive ? C.primary : C.cardSubFg,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {section.children && (
                    <ChevronLeft
                      className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      style={{ color: C.cardSubFg }}
                    />
                  )}
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 truncate">{section.label}</span>
                  {section.badge && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ backgroundColor: section.badgeColor + '20', color: section.badgeColor }}
                    >
                      {section.badge}
                    </span>
                  )}
                </button>

                {/* Children */}
                {isExpanded && section.children && (
                  <ul className="mr-6 mt-0.5 space-y-0.5">
                    {section.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = active === child.id;
                      const childMatches = !searchQuery || child.label.includes(searchQuery);
                      if (!childMatches) return null;

                      return (
                        <li key={child.id}>
                          <button
                            onClick={() => scrollTo(child.id)}
                            className="w-full text-right flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all"
                            style={{
                              backgroundColor: childActive ? C.primaryBg : 'transparent',
                              color: childActive ? C.primary : C.cardSubFg,
                              fontWeight: childActive ? 600 : 400,
                            }}
                          >
                            <ChildIcon className="w-3.5 h-3.5" />
                            <span className="truncate">{child.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ═══ Main Content ═══ */}
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-6 pr-2">
        {/* Hero Banner */}
        <div
          className="rounded-xl p-6 relative overflow-hidden"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
              : 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #ecfdf5 100%)',
            border: `1px solid ${C.cardBorder}`,
          }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.accent})` }}
              >
                <GitBranch className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: C.cardFg }}>
                  مستندات دیاگرام‌های سیستم
                </h1>
                <p className="text-sm" style={{ color: C.cardSubFg }}>
                  تحلیل تکنیکال بورس ایران — DFD + BPMN + UML 2.5
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                { label: 'DFD', count: 12, color: '#3b82f6' },
                { label: 'BPMN', count: 9, color: '#8b5cf6' },
                { label: 'UML ساختاری', count: 21, color: '#059669' },
                { label: 'UML رفتاری', count: 11, color: '#d97706' },
                { label: 'UML تعاملی', count: 12, color: '#dc2626' },
              ].map(item => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                  style={{ backgroundColor: item.color + '15', border: `1px solid ${item.color}30` }}
                >
                  <span className="font-bold" style={{ color: item.color }}>{item.count}</span>
                  <span style={{ color: C.cardFg }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 sticky top-0 z-10 py-2 px-1">
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}
          >
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 rounded hover:opacity-80" style={{ color: C.cardSubFg }}>
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono w-10 text-center" style={{ color: C.cardFg }}>
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 rounded hover:opacity-80" style={{ color: C.cardSubFg }}>
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Diagrams */}
        {currentDiagrams.length > 0 ? (
          currentDiagrams.map((diagram, idx) => (
            <div
              key={`${active}-${idx}`}
              data-section={active}
              className="rounded-xl overflow-hidden"
              style={{
                backgroundColor: C.cardBg,
                border: `1px solid ${C.cardBorder}`,
                boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.2)' : '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              {/* Card Header */}
              <div
                className="px-5 py-3 border-b flex items-center gap-3"
                style={{
                  borderColor: C.cardBorder,
                  background: isDark ? 'linear-gradient(90deg, rgba(59,130,246,0.08), transparent)' : 'linear-gradient(90deg, rgba(59,130,246,0.04), transparent)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`, color: '#fff' }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold" style={{ color: C.cardFg }}>{diagram.title}</h3>
                  <p className="text-xs mt-0.5" style={{ color: C.cardSubFg }}>{diagram.description}</p>
                </div>
                {diagram.level && (
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: C.primary, color: C.primary }}>
                    {diagram.level}
                  </Badge>
                )}
                <Badge
                  className="text-[10px]"
                  style={{
                    backgroundColor: diagram.type === 'mermaid' ? '#3b82f620' : '#05966920',
                    color: diagram.type === 'mermaid' ? '#3b82f6' : '#059669',
                    borderColor: diagram.type === 'mermaid' ? '#3b82f640' : '#05966940',
                  }}
                  variant="outline"
                >
                  {diagram.type === 'mermaid' ? 'Mermaid' : 'PlantUML'}
                </Badge>
              </div>

              {/* Diagram Content */}
              <div className="p-4">
                <div
                  className="rounded-lg p-4 overflow-x-auto"
                  style={{
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    border: `1px solid ${C.cardBorder}`,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top right',
                  }}
                >
                  {diagram.type === 'mermaid' ? (
                    <MermaidDiagram chart={diagram.code} id={`${active}-${idx}`} />
                  ) : (
                    <PlantUMLDiagram code={diagram.code} alt={diagram.title} />
                  )}
                </div>
              </div>

              {/* Farsi Notes */}
              {diagram.farsiNotes.length > 0 && (
                <div className="px-5 pb-4">
                  <div
                    className="rounded-lg p-4 space-y-1.5"
                    style={{
                      backgroundColor: isDark ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)',
                      border: `1px solid ${C.primary}20`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4" style={{ color: C.primary }} />
                      <span className="text-xs font-bold" style={{ color: C.primary }}>توضیحات</span>
                    </div>
                    {diagram.farsiNotes.map((note, i) => (
                      <p key={i} className="text-xs leading-relaxed" style={{ color: C.cardSubFg }}>
                        {note}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          /* Placeholder for sections without inline diagrams */
          <div
            className="rounded-xl p-8 text-center"
            style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}
          >
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: C.primaryBg }}>
              <BookOpen className="w-8 h-8" style={{ color: C.primary }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: C.cardFg }}>
              {SECTIONS.find(s => s.id === active || s.children?.some(c => c.id === active))?.label || 'مستندات'}
            </h3>
            <p className="text-sm mb-4" style={{ color: C.cardSubFg }}>
              دیاگرام‌های این بخش در فایل DIAGRAM_DOCS.md موجود هستند.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="outline" style={{ borderColor: C.primary, color: C.primary }}>
                <a href="/DIAGRAM_DOCS.md" target="_blank" className="flex items-center gap-1">
                  <Download className="w-3 h-3" /> مشاهده فایل کامل
                </a>
              </Badge>
            </div>
          </div>
        )}

        {/* Coherence Table */}
        {active === 'coherence' && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}
          >
            <div className="px-5 py-3 border-b" style={{ borderColor: C.cardBorder }}>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: C.primary }}>
                <GitMerge className="w-4 h-4" /> جدول انسجام بین دیاگرام‌ها
              </h3>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-xs" style={{ color: C.cardFg }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                    <th className="text-right py-2 px-3 font-bold" style={{ color: C.primary }}>عنصر DFD</th>
                    <th className="text-right py-2 px-3 font-bold" style={{ color: C.primary }}>فعالیت BPMN</th>
                    <th className="text-right py-2 px-3 font-bold" style={{ color: C.primary }}>کلاس UML</th>
                    <th className="text-right py-2 px-3 font-bold" style={{ color: C.primary }}>متد/تابع</th>
                    <th className="text-right py-2 px-3 font-bold" style={{ color: C.primary }}>فایل منبع</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['P1: تحلیل تکنیکال', 'محاسبه اندیکاتورها', 'TAEngine', 'analyze()', 'ta-engine.ts'],
                    ['P2: تشخیص رژیم', 'تشخیص رژیم ترکیبی', 'RegimeEngine', 'detectRegime()', 'regime-engine.ts'],
                    ['P3: یادگیری ML', 'آموزش مدل تطبیقی', 'AdaptiveWeightModel', 'train()', 'ml-logistic.ts'],
                    ['P4: تحلیل S/R', 'تحلیل سطوح کلیدی', 'SRAnalyzer', 'analyzeSupportResistance()', 'sr-analyzer.ts'],
                    ['P5: تشخیص الگو', 'شناسایی الگوها', 'PatternDetector', 'detectAllPatterns()', 'pattern-detection.ts'],
                    ['P6: تولید متن AI', 'تولید تحلیل هوشمند', 'VDESAnalysis', 'POST /api/vdes-analysis', 'vdes-analysis route'],
                    ['P7: بازخورد تطبیقی', 'بروزرسانی وزن‌ها', 'FeedbackStore', 'updateWeights()', 'msl-feedback.ts'],
                    ['D1: کش OHLCV', 'ذخیره داده بازار', '—', 'localStorage', 'tse-api.ts'],
                    ['D3: مدل ML', 'ذخیره مدل آموزش‌دیده', 'AdaptiveWeightModel', 'predictScore()', 'ml-engine.ts'],
                    ['D4: بازخورد', 'ذخیره بازخورد کاربر', 'FeedbackStore', 'recordFeedback()', 'msl-feedback.ts'],
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}40` }}>
                      {row.map((cell, j) => (
                        <td key={j} className="py-2 px-3" style={{ color: j === 4 ? C.primary : C.cardFg }}>
                          {j === 4 ? <code className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: C.primaryBg }}>{cell}</code> : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
