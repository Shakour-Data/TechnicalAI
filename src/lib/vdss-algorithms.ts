// ═══════════════════════════════════════════════════════════════════════════════
// V8 — VDss Graph Algorithms & Constants
// 9 Scenarios · 3-Branch Topology · RTL SVG Layout
// Used by both vdss-graph.tsx and vdes-analysis.tsx
// ═══════════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────────

export interface EdgeInfo {
  from: string;
  to: string;
  label: string;
  type: string;
  prob: number;
}

export interface PathInfo {
  nodes: string[];
  edges: number[];
  prob: number;
  target: string;
}

export type EdgeType = 'up' | 'pullback' | 'down' | 'risk';

export interface NodeDef {
  label: string;
  type: 'decision' | 'event' | 'terminal';
  description: string;
}

export interface NodePosition {
  x: number;
  y: number;
}

// ── Scenario Keys ────────────────────────────────────────────────────────────

export const SCENARIO_KEYS = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5', 'SC6', 'SC7', 'SC8', 'SC9'] as const;

// ── Edge Definitions ─────────────────────────────────────────────────────────
// [fromNode, toNode, label, type]
// Graph: A→{B,C,D} → {E,F,G,H,I,J} → {K,L} → {SC1..SC9}
// 3-branch topology with cross-branch consolidation/volatility nodes

export const EDGE_DEFS: [string, string, string, EdgeType][] = [
  // ── Root → Branches ──────────────────────────────────────────────────────
  ['A', 'B', 'دنبال کردن روند', 'up'],
  ['A', 'C', 'شکست قیمت', 'pullback'],
  ['A', 'D', 'بازگشت روند', 'down'],

  // ── Branch 1: Trend Following (B) → E, F ────────────────────────────────
  ['B', 'E', 'قدرت صعودی', 'up'],
  ['B', 'F', 'ضعف روند', 'down'],
  ['B', 'K', 'ورود به رنج', 'risk'],

  ['E', 'SC1', 'تثبیت صعود قوی', 'up'],
  ['E', 'K', 'تثبیت رنج', 'pullback'],
  ['E', 'F', 'کاهش شتاب', 'pullback'],

  ['F', 'SC4', 'شروع نزول قوی', 'down'],
  ['F', 'SC7', 'ورود به رنج کم‌نوسان', 'pullback'],
  ['F', 'E', 'بازیابی مجدد', 'risk'],

  // ── Branch 2: Breakout (C) → G, H ─────────────────────────────────────
  ['C', 'G', 'شتاب شکست صعودی', 'up'],
  ['C', 'H', 'شکست نزولی', 'down'],
  ['C', 'L', 'واکنش نوسانی', 'risk'],

  ['G', 'SC2', 'تداوم شتاب صعودی', 'up'],
  ['G', 'L', 'کاهش شتاب', 'pullback'],
  ['G', 'H', 'توقف شکست', 'pullback'],

  ['H', 'SC5', 'تداوم نزول شتاب‌دار', 'down'],
  ['H', 'SC9', 'شوک بازار', 'risk'],
  ['H', 'G', 'بازگشت شتاب', 'risk'],

  // ── Branch 3: Reversal (D) → I, J ──────────────────────────────────────
  ['D', 'I', 'سیگنال بازگشت صعودی', 'up'],
  ['D', 'J', 'تخریب ساختار', 'down'],
  ['D', 'L', 'نوسان شدید', 'risk'],

  ['I', 'SC3', 'صعود احتیاطی', 'up'],
  ['I', 'L', 'تثبیت نوسانی', 'pullback'],
  ['I', 'J', 'توقف بازگشت', 'pullback'],

  ['J', 'SC6', 'نزول احتیاطی', 'down'],
  ['J', 'SC8', 'رنج پرنوسان', 'pullback'],
  ['J', 'I', 'بازگشت مجدد', 'risk'],

  // ── Cross-branch: Consolidation (K) ────────────────────────────────────
  ['K', 'B', 'خروج صعودی از رنج', 'up'],
  ['K', 'C', 'خروج شکستی از رنج', 'pullback'],
  ['K', 'D', 'خروج نزولی از رنج', 'down'],

  // ── Cross-branch: Volatility Spike (L) ────────────────────────────────
  ['L', 'B', 'کاهش نوسان', 'pullback'],
  ['L', 'C', 'شوک نوسانی', 'risk'],
  ['L', 'D', 'افزایش نوسان', 'risk'],
];

/** Backward-compatible alias */
export const EDGES = EDGE_DEFS;

// ── Node Definitions ────────────────────────────────────────────────────────

export const NODE_DEFS: Record<string, NodeDef> = {
  // Decision nodes
  A: {
    label: 'تصمیم اصلی بازار',
    type: 'decision',
    description: 'گره تصمیم‌گیری — تقسیم مسیر به سه شاخه اصلی',
  },
  B: {
    label: 'دنبال کردن روند',
    type: 'decision',
    description: 'گره تصمیم‌گیری — شاخه پیروی از روند فعلی',
  },
  C: {
    label: 'شکست قیمت',
    type: 'decision',
    description: 'گره تصمیم‌گیری — شاخه شکست و خروج از محدوده',
  },
  D: {
    label: 'بازگشت روند',
    type: 'decision',
    description: 'گره تصمیم‌گیری — شاخه بازگشت و وارونگی',
  },
  // Event nodes
  E: {
    label: 'آزمون قدرت روند',
    type: 'event',
    description: 'گره رویداد شانسی — ارزیابی قدرت صعودی',
  },
  F: {
    label: 'سیگنال ضعف روند',
    type: 'event',
    description: 'گره رویداد شانسی — تشخیص ضعف و نزولی شدن',
  },
  G: {
    label: 'شتاب شکست صعودی',
    type: 'event',
    description: 'گره رویداد شانسی — تداوم شتاب شکست به سمت بالا',
  },
  H: {
    label: 'افت شتاب شکست',
    type: 'event',
    description: 'گره رویداد شانسی — توقف یا وارونگی شکست',
  },
  I: {
    label: 'بازیابی بازگشتی',
    type: 'event',
    description: 'گره رویداد شانسی — سیگنال بازگشت صعودی',
  },
  J: {
    label: 'تخریب بازگشتی',
    type: 'event',
    description: 'گره رویداد شانسی — ادامه تخریب و نزول',
  },
  K: {
    label: 'ناحیه تثبیت',
    type: 'event',
    description: 'گره رویداد شانسی — تثبیت و تجمیع قیمت',
  },
  L: {
    label: 'افزایش نوسان',
    type: 'event',
    description: 'گره رویداد شانسی — اسپایک نوسان و عدم قطعیت',
  },
  // Terminal nodes
  SC1: {
    label: 'روند صعودی قوی',
    type: 'terminal',
    description: 'سناریو نهایی — صعود قوی و پایدار',
  },
  SC2: {
    label: 'صعودی شتاب‌دار',
    type: 'terminal',
    description: 'سناریو نهایی — حرکت شتاب‌دار صعودی',
  },
  SC3: {
    label: 'صعودی با احتیاط',
    type: 'terminal',
    description: 'سناریو نهایی — صعود کند و محتاطانه',
  },
  SC4: {
    label: 'روند نزولی قوی',
    type: 'terminal',
    description: 'سناریو نهایی — نزول قوی و پایدار',
  },
  SC5: {
    label: 'نزولی شتاب‌دار',
    type: 'terminal',
    description: 'سناریو نهایی — حرکت شتاب‌دار نزولی',
  },
  SC6: {
    label: 'نزولی با احتیاط',
    type: 'terminal',
    description: 'سناریو نهایی — نزول کند و محتاطانه',
  },
  SC7: {
    label: 'رنج کم‌نوسان',
    type: 'terminal',
    description: 'سناریو نهایی — محدوده رنج با نوسان کم',
  },
  SC8: {
    label: 'رنج پرنوسان',
    type: 'terminal',
    description: 'سناریو نهایی — محدوده رنج با نوسان بالا',
  },
  SC9: {
    label: 'حالت شوک',
    type: 'terminal',
    description: 'سناریو نهایی — شوک ناگهانی و غیرمنتظره',
  },
};

// ── Node Positions (RTL Layout — root on right) ─────────────────────────────
// Container: ~1500 × 800
// Level 0 (x=1350): Root
// Level 1 (x=1050): Branch nodes B, C, D
// Level 2 (x=750):  Intermediate event nodes E, F, G, H, I, J
// Level 3 (x=450):  Cross-branch nodes K, L
// Level 4 (x=150):  Terminal scenario nodes SC1–SC9

export const NODE_POSITIONS: Record<string, NodePosition> = {
  // Root
  A:  { x: 1350, y: 400 },
  // Branch decisions
  B:  { x: 1050, y: 130 },
  C:  { x: 1050, y: 400 },
  D:  { x: 1050, y: 670 },
  // Branch 1 intermediates
  E:  { x: 750, y: 65 },
  F:  { x: 750, y: 200 },
  // Branch 2 intermediates
  G:  { x: 750, y: 340 },
  H:  { x: 750, y: 465 },
  // Branch 3 intermediates
  I:  { x: 750, y: 600 },
  J:  { x: 750, y: 735 },
  // Cross-branch
  K:  { x: 450, y: 250 },
  L:  { x: 450, y: 550 },
  // Terminals
  SC1: { x: 150, y: 30 },
  SC2: { x: 150, y: 110 },
  SC3: { x: 150, y: 190 },
  SC4: { x: 150, y: 280 },
  SC5: { x: 150, y: 360 },
  SC6: { x: 150, y: 440 },
  SC7: { x: 150, y: 530 },
  SC8: { x: 150, y: 610 },
  SC9: { x: 150, y: 690 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Dynamic Scenario Labels — Context-Aware Based on Trend Direction
// 9 Scenarios × 3 Signal Contexts (bullish / bearish / neutral)
// ═══════════════════════════════════════════════════════════════════════════════

export type TrendSignal = 'bullish' | 'bearish' | 'neutral';

export interface ScenarioMeta {
  label: string;
  color: string;
  /** Short label for graph nodes */
  nodeTitle: string;
  /** Description for graph node detail */
  nodeDesc: string;
  /** Name for TA engine (no unit) */
  name: string;
  /** English name */
  nameEn: string;
  /** Strategy text */
  strategyText: string;
  /** Strategy badge class */
  strategyTag: string;
}

// ── Bullish Labels (market trending up) ──────────────────────────────────────

const LABELS_BULLISH: Record<string, Omit<ScenarioMeta, 'color'>> = {
  SC1: {
    label: 'روند صعودی قوی',
    nodeTitle: 'صعود قوی',
    nodeDesc: 'تداوم روند صعودی با قدرت بالا و حجم مناسب.',
    name: 'صعودی قوی',
    nameEn: 'Strong Bullish',
    strategyText: 'صعودی قوی — احتمال بالای عبور از مقاومت‌ها',
    strategyTag: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  SC2: {
    label: 'صعودی شتاب‌دار',
    nodeTitle: 'شتاب صعودی',
    nodeDesc: 'افزایش شتاب صعودی با شکست سطوح کلیدی.',
    name: 'شتاب‌دار صعودی',
    nameEn: 'Accelerating Bullish',
    strategyText: 'شتاب‌دار صعودی — ورود سریع با تریلینگ استاپ',
    strategyTag: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  },
  SC3: {
    label: 'صعودی با احتیاط',
    nodeTitle: 'صعود محتاطانه',
    nodeDesc: 'حرکت صعودی آرام و کنترل‌شده با پولبک‌های مکرر.',
    name: 'صعودی احتیاطی',
    nameEn: 'Cautious Bullish',
    strategyText: 'صعودی محتاطانه — ورود در پولبک با حجم کم',
    strategyTag: 'bg-green-500/15 text-green-400 border-green-500/30',
  },
  SC4: {
    label: 'نزولی قوی (اصلاح عمیق)',
    nodeTitle: 'اصلاح عمیق',
    nodeDesc: 'آغاز یک اصلاح عمیق و سریع در روند صعودی.',
    name: 'اصلاح عمیق',
    nameEn: 'Deep Correction',
    strategyText: 'اصلاحی عمیق — خروج موقت و انتظار تثبیت',
    strategyTag: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  SC5: {
    label: 'نزولی شتاب‌دار (شوک نزولی)',
    nodeTitle: 'شوک نزولی',
    nodeDesc: 'سقوط ناگهانی قیمت با حجم بالا.',
    name: 'شوک نزولی',
    nameEn: 'Bearish Shock',
    strategyText: 'شوک نزولی — خروج فوری و انتظار آرامش بازار',
    strategyTag: 'bg-red-400/15 text-red-300 border-red-400/30',
  },
  SC6: {
    label: 'نزولی با احتیاط (اصلاح خفیف)',
    nodeTitle: 'اصلاح خفیف',
    nodeDesc: 'اصلاح ملایم و کنترل‌شده در روند صعودی.',
    name: 'اصلاح خفیف',
    nameEn: 'Mild Correction',
    strategyText: 'اصلاح خفیف — کاهش حجم و انتظار فرصت خرید',
    strategyTag: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  SC7: {
    label: 'رنج کم‌نوسان (تثبیت)',
    nodeTitle: 'تثبیت رنج',
    nodeDesc: 'ورود به محدوده رنج با نوسان بسیار کم.',
    name: 'رنج کم‌نوسان',
    nameEn: 'Low Volatility Range',
    strategyText: 'رنج کم‌نوسان — انتظار خروج از محدوده',
    strategyTag: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  SC8: {
    label: 'شوک صعودی',
    nodeTitle: 'شوک صعودی',
    nodeDesc: 'حرکت فوق‌العاده صعودی فراتر از سطوح عادی.',
    name: 'شوک صعودی',
    nameEn: 'Bull Shock',
    strategyText: 'شوک صعودی — ورود با احتیاط و حد ضرر نزدیک',
    strategyTag: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  },
  SC9: {
    label: 'شوک نزولی',
    nodeTitle: 'شوک نزولی',
    nodeDesc: 'سقوط ناگهانی و شدید فراتر از سطوح عادی.',
    name: 'شوک نزولی',
    nameEn: 'Bear Shock',
    strategyText: 'شوک نزولی — خروج فوری تا زمان آرامش بازار',
    strategyTag: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
};

// ── Bearish Labels (market trending down) ────────────────────────────────────

const LABELS_BEARISH: Record<string, Omit<ScenarioMeta, 'color'>> = {
  SC1: {
    label: 'بازگشت صعودی قوی',
    nodeTitle: 'بازگشت قوی',
    nodeDesc: 'واگرایی مثبت و شروع روند صعودی جدید.',
    name: 'بازگشت صعودی',
    nameEn: 'Strong Bullish Reversal',
    strategyText: 'بازگشت صعودی — فرصت ورود در کف',
    strategyTag: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  SC2: {
    label: 'بازگشت شتاب‌دار',
    nodeTitle: 'بازگشت شتاب‌دار',
    nodeDesc: 'پوشش سریع سطوح از دست‌رفته با حجم بالا.',
    name: 'شتاب‌دار صعودی',
    nameEn: 'Accelerating Reversal',
    strategyText: 'شتاب‌دار صعودی — ورود تهاجمی با توقف نزدیک',
    strategyTag: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  },
  SC3: {
    label: 'بازگشت با احتیاط',
    nodeTitle: 'بازگشت محتاطانه',
    nodeDesc: 'سیگنال بازگشت ضعیف و نیازمند تایید بیشتر.',
    name: 'صعودی احتیاطی',
    nameEn: 'Cautious Reversal',
    strategyText: 'بازگشت محتاطانه — ورود با حجم بسیار کم',
    strategyTag: 'bg-green-500/15 text-green-400 border-green-500/30',
  },
  SC4: {
    label: 'روند نزولی قوی',
    nodeTitle: 'نزول قوی',
    nodeDesc: 'تداوم روند نزولی با فشار فروش بالا.',
    name: 'نزولی قوی',
    nameEn: 'Strong Bearish',
    strategyText: 'نزولی قوی — خروج فوری توصیه می‌شود',
    strategyTag: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  SC5: {
    label: 'نزولی شتاب‌دار',
    nodeTitle: 'نزول شتاب‌دار',
    nodeDesc: 'افزایش سرعت سقوط با شکست حمایت‌ها.',
    name: 'نزولی شتاب‌دار',
    nameEn: 'Accelerating Bearish',
    strategyText: 'نزولی شتاب‌دار — خروج فوری و پوزیشن‌های_short_',
    strategyTag: 'bg-red-400/15 text-red-300 border-red-400/30',
  },
  SC6: {
    label: 'نزولی با احتیاط',
    nodeTitle: 'نزول محتاطانه',
    nodeDesc: 'نزول آرام و کنترل‌شده با بازگشت‌های کوچک.',
    name: 'نزولی احتیاطی',
    nameEn: 'Cautious Bearish',
    strategyText: 'نزولی محتاطانه — احتیاط و کاهش حجم معاملات',
    strategyTag: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  SC7: {
    label: 'رنج کم‌نوسان',
    nodeTitle: 'تثبیت رنج',
    nodeDesc: 'ورود به محدوده تثبیت با نوسان کم.',
    name: 'رنج کم‌نوسان',
    nameEn: 'Low Volatility Range',
    strategyText: 'رنج کم‌نوسان — منتظر خروج از محدوده بمانید',
    strategyTag: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  SC8: {
    label: 'شوک نزولی',
    nodeTitle: 'شوک نزولی',
    nodeDesc: 'سقوط شدید فراتر از سطوح حمایت اصلی.',
    name: 'شوک نزولی',
    nameEn: 'Bear Shock',
    strategyText: 'شوک نزولی — خروج فوری تا زمان تثبیت',
    strategyTag: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
  SC9: {
    label: 'شوک صعودی',
    nodeTitle: 'شوک صعودی',
    nodeDesc: 'جهش ناگهانی فراتر از سطوح مقاومت اصلی.',
    name: 'شوک صعودی',
    nameEn: 'Bull Shock',
    strategyText: 'شوک صعودی — ورود با احتیاط بسیار بالا',
    strategyTag: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  },
};

// ── Neutral Labels (no clear trend) ──────────────────────────────────────────

const LABELS_NEUTRAL: Record<string, Omit<ScenarioMeta, 'color'>> = {
  SC1: {
    label: 'روند صعودی قوی',
    nodeTitle: 'صعود قوی',
    nodeDesc: 'شروع روند صعودی قوی و پایدار.',
    name: 'صعودی قوی',
    nameEn: 'Strong Bullish',
    strategyText: 'صعودی قوی — احتمال بالای عبور از مقاومت‌ها',
    strategyTag: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  SC2: {
    label: 'صعودی شتاب‌دار',
    nodeTitle: 'شتاب صعودی',
    nodeDesc: 'حرکت صعودی سریع با شکست سطوح.',
    name: 'شتاب‌دار صعودی',
    nameEn: 'Accelerating Bullish',
    strategyText: 'شتاب‌دار صعودی — ورود سریع با تریلینگ استاپ',
    strategyTag: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  },
  SC3: {
    label: 'صعودی با احتیاط',
    nodeTitle: 'صعود محتاطانه',
    nodeDesc: 'حرکت صعودی کند و نامطمئن.',
    name: 'صعودی احتیاطی',
    nameEn: 'Cautious Bullish',
    strategyText: 'صعودی محتاطانه — ورود با حجم کم',
    strategyTag: 'bg-green-500/15 text-green-400 border-green-500/30',
  },
  SC4: {
    label: 'روند نزولی قوی',
    nodeTitle: 'نزول قوی',
    nodeDesc: 'شروع روند نزولی قوی و پایدار.',
    name: 'نزولی قوی',
    nameEn: 'Strong Bearish',
    strategyText: 'نزولی قوی — خروج فوری توصیه می‌شود',
    strategyTag: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  SC5: {
    label: 'نزولی شتاب‌دار',
    nodeTitle: 'نزول شتاب‌دار',
    nodeDesc: 'حرکت نزولی سریع با شکست حمایت‌ها.',
    name: 'نزولی شتاب‌دار',
    nameEn: 'Accelerating Bearish',
    strategyText: 'نزولی شتاب‌دار — خروج فوری توصیه می‌شود',
    strategyTag: 'bg-red-400/15 text-red-300 border-red-400/30',
  },
  SC6: {
    label: 'نزولی با احتیاط',
    nodeTitle: 'نزول محتاطانه',
    nodeDesc: 'نزول کند و کنترل‌شده.',
    name: 'نزولی احتیاطی',
    nameEn: 'Cautious Bearish',
    strategyText: 'نزولی محتاطانه — احتیاط و کاهش حجم معاملات',
    strategyTag: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  SC7: {
    label: 'رنج کم‌نوسان',
    nodeTitle: 'رنج کم‌نوسان',
    nodeDesc: 'بازار در یک محدوده باریک با نوسان کم.',
    name: 'رنج کم‌نوسان',
    nameEn: 'Low Volatility Range',
    strategyText: 'رنج کم‌نوسان — منتظر خروج از محدوده بمانید',
    strategyTag: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  SC8: {
    label: 'شوک صعودی',
    nodeTitle: 'شوک صعودی',
    nodeDesc: 'حرکت فوق‌العاده صعودی و غیرمنتظره.',
    name: 'شوک صعودی',
    nameEn: 'Bull Shock',
    strategyText: 'شوک صعودی — ورود با احتیاط و حد ضرر نزدیک',
    strategyTag: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  },
  SC9: {
    label: 'شوک نزولی',
    nodeTitle: 'شوک نزولی',
    nodeDesc: 'حرکت فوق‌العاده نزولی و غیرمنتظره.',
    name: 'شوک نزولی',
    nameEn: 'Bear Shock',
    strategyText: 'شوک نزولی — خروج فوری تا زمان آرامش بازار',
    strategyTag: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
};

// ── Color Map (fixed per scenario) ───────────────────────────────────────────

const COLORS_MAP: Record<string, string> = {
  SC1: '#34c98b',
  SC2: '#2dd4a8',
  SC3: '#86efac',
  SC4: '#ef4d62',
  SC5: '#f87171',
  SC6: '#fca5a5',
  SC7: '#fbbf24',
  SC8: '#fb923c',
  SC9: '#a855f7',
};

/**
 * Get context-aware scenario metadata based on the current market signal.
 * Returns labels/colors/descriptions for ALL 9 scenarios.
 * - Bullish: continuation = up, correction = down
 * - Bearish: continuation = down, recovery = up
 * - Neutral: generic directional labels
 */
export function getDynamicScenarioMeta(signal: string): Record<string, ScenarioMeta> {
  const labels = signal === 'bearish' ? LABELS_BEARISH
    : signal === 'bullish' ? LABELS_BULLISH
    : LABELS_NEUTRAL;

  const result: Record<string, ScenarioMeta> = {};
  for (const key of SCENARIO_KEYS) {
    result[key] = {
      ...labels[key],
      color: COLORS_MAP[key],
    };
  }
  return result;
}

// ── Legacy static SCENARIO_META (kept for backward compat, prefer getDynamicScenarioMeta) ──
export const SCENARIO_META: Record<string, { label: string; color: string }> = {
  SC1: { label: 'روند صعودی قوی', color: '#34c98b' },
  SC2: { label: 'صعودی شتاب‌دار', color: '#2dd4a8' },
  SC3: { label: 'صعودی با احتیاط', color: '#86efac' },
  SC4: { label: 'روند نزولی قوی', color: '#ef4d62' },
  SC5: { label: 'نزولی شتاب‌دار', color: '#f87171' },
  SC6: { label: 'نزولی با احتیاط', color: '#fca5a5' },
  SC7: { label: 'رنج (تثبیت)', color: '#fbbf24' },
  SC8: { label: 'شوک صعودی', color: '#10b981' },
  SC9: { label: 'شوک نزولی', color: '#a855f7' },
};

// ── Graph Algorithms ─────────────────────────────────────────────────────────

/**
 * Calculate edge probabilities using engine-provided edge weights (Layer 5).
 * Each node's outgoing edges get probabilities proportional to their type weights,
 * normalized so that the sum of outgoing probabilities per node equals 1.
 */
export function calcEdgeProbabilities(
  ew: { up: number; down: number; pullback: number; risk: number }
): Record<string, number> {
  const typeWeights: Record<string, number> = {
    up: ew.up,
    pullback: ew.pullback,
    down: ew.down,
    risk: ew.risk,
  };

  // Build adjacency: for each node, group outgoing edges by type
  const adj: Record<string, { idx: number; type: string }[]> = {};
  EDGE_DEFS.forEach((e, i) => {
    if (!adj[e[0]]) adj[e[0]] = [];
    adj[e[0]].push({ idx: i, type: e[3] });
  });

  const edgeProbs: Record<string, number> = {};

  for (const [, outEdges] of Object.entries(adj)) {
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

/**
 * Find all paths from 'A' to terminal scenario nodes (SC1–SC9) using DFS.
 * Returns up to 200 paths sorted by probability (highest first).
 */
export function findAllPaths(edgeProbs: Record<string, number>): PathInfo[] {
  const adj: Record<string, { to: string; edgeIdx: number }[]> = {};
  EDGE_DEFS.forEach((e, i) => {
    if (!adj[e[0]]) adj[e[0]] = [];
    adj[e[0]].push({ to: e[1], edgeIdx: i });
  });

  const paths: PathInfo[] = [];
  const MAX_PATHS = 200;

  function dfs(
    node: string,
    visited: Set<string>,
    currentPath: string[],
    edgeIndices: number[],
    currentProb: number,
  ) {
    if (SCENARIO_KEYS.includes(node as (typeof SCENARIO_KEYS)[number])) {
      paths.push({
        nodes: [...currentPath, node],
        edges: [...edgeIndices],
        prob: currentProb,
        target: node,
      });
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
