'use client';

import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  BookOpen, ChevronDown, ChevronLeft,
  GitBranch, Workflow, FileCode, Boxes, ArrowLeftRight,
  Layers, Activity, GitMerge, Timer, MessageSquare,
  Search, Palette,
  Shield,
  ZoomIn, ZoomOut, RotateCcw,
  ChevronRight, LayoutDashboard,
  CircleDot,
  Component, Server, FolderTree, Combine, UserCircle,
  Zap, Link2, Milestone,
  Sparkles, X,
  TrendingUp,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-store';
import MermaidDiagram from '@/components/tse/mermaid-diagram';
import PlantUMLDiagram from '@/components/tse/plantuml-diagram';
import {
  DFD_DIAGRAMS,
  BPMN_DIAGRAMS,
  UML_STRUCT_DIAGRAMS,
  UML_BEHAV_DIAGRAMS,
} from '@/lib/diagram-data';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface Section {
  id: string;
  label: string;
  icon: React.ElementType;
  children?: Section[];
  badge?: string;
  badgeColor?: string;
}

// ═══════════════════════════════════════════════════════════════
// Section Navigation Tree
// ═══════════════════════════════════════════════════════════════

const SECTIONS: Section[] = [
  {
    id: 'dfd', label: 'دیاگرام‌های جریان داده (DFD)', icon: ArrowLeftRight, badge: '۱۳', badgeColor: '#06b6d4',
    children: [
      { id: 'dfd-l0', label: 'سطح ۰ — نمودار زمینه', icon: CircleDot },
      { id: 'dfd-l1', label: 'سطح ۱ — فرایندهای اصلی', icon: GitBranch },
      { id: 'dfd-l2', label: 'سطح ۲ — زیرفرایندها', icon: Layers },
      { id: 'dfd-l3', label: 'سطح ۳ — جزییات عملیاتی', icon: Activity },
    ],
  },
  {
    id: 'bpmn', label: 'دیاگرام‌های BPMN', icon: Workflow, badge: '۸', badgeColor: '#8b5cf6',
    children: [
      { id: 'bpmn-l1', label: 'سطح ۱ — نمای کلی', icon: Boxes },
      { id: 'bpmn-l2', label: 'سطح ۲ — فرایندهای قابل اجرا', icon: GitBranch },
      { id: 'bpmn-l3', label: 'سطح ۳ — زیرفرایندهای جزیی', icon: Activity },
    ],
  },
  {
    id: 'uml-struct', label: 'نمودارهای ساختاری UML', icon: Component, badge: '۲۱', badgeColor: '#a855f7',
    children: [
      { id: 'uml-class', label: 'نمودار کلاس', icon: FileCode,
        children: [
          { id: 'uml-class-l1', label: 'سطح ۱', icon: Boxes },
          { id: 'uml-class-l2', label: 'سطح ۲', icon: GitBranch },
          { id: 'uml-class-l3', label: 'سطح ۳', icon: Activity },
        ],
      },
      { id: 'uml-object', label: 'نمودار شیء', icon: UserCircle },
      { id: 'uml-component', label: 'نمودار مؤلفه', icon: Component },
      { id: 'uml-deployment', label: 'نمودار استقرار', icon: Server },
      { id: 'uml-package', label: 'نمودار بسته', icon: FolderTree },
      { id: 'uml-composite', label: 'نمودار ساختار ترکیبی', icon: Combine },
      { id: 'uml-profile', label: 'نمودار نمایه', icon: Palette },
    ],
  },
  {
    id: 'uml-behav', label: 'نمودارهای رفتاری UML', icon: Zap, badge: '۲۱', badgeColor: '#f59e0b',
    children: [
      { id: 'uml-usecase', label: 'نمودار مورد کاربری', icon: UserCircle },
      { id: 'uml-activity', label: 'نمودار فعالیت', icon: Activity },
      { id: 'uml-statemachine', label: 'نمودار ماشین حالت', icon: GitMerge },
      { id: 'uml-sequence', label: 'نمودار توالی', icon: Timer },
      { id: 'uml-communication', label: 'نمودار ارتباطی', icon: MessageSquare },
      { id: 'uml-interaction-overview', label: 'نمودار نمای کلی تعامل', icon: LayoutDashboard },
      { id: 'uml-timing', label: 'نمودار زمان‌بندی', icon: Milestone },
    ],
  },
  {
    id: 'coherence', label: 'انسجام بین دیاگرام‌ها', icon: Link2,
  },
];

// ═══════════════════════════════════════════════════════════════
// Unified Diagram Type
// ═══════════════════════════════════════════════════════════════

type DiagramFormat = 'mermaid' | 'plantuml';

interface UnifiedDiagram {
  id: string;
  title: string;
  description: string;
  level: number;
  code: string;
  format: DiagramFormat;
  category: string;
  subcategory?: string;
  happyPath?: string;
  exceptionFlows?: string;
}

// ═══════════════════════════════════════════════════════════════
// Build Unified Diagram List
// ═══════════════════════════════════════════════════════════════

function buildAllDiagrams(): UnifiedDiagram[] {
  const all: UnifiedDiagram[] = [];

  // DFD diagrams
  for (const d of DFD_DIAGRAMS) {
    all.push({
      id: d.id,
      title: d.title,
      description: d.description,
      level: d.level,
      code: d.code,
      format: 'mermaid',
      category: 'dfd',
    });
  }

  // BPMN diagrams
  for (const d of BPMN_DIAGRAMS) {
    all.push({
      id: d.id,
      title: d.title,
      description: d.description,
      level: d.level,
      code: d.code,
      format: 'mermaid',
      category: 'bpmn',
      happyPath: d.happyPath,
      exceptionFlows: d.exceptionFlows,
    });
  }

  // UML Structural diagrams
  const structTypeMap: Record<string, string> = {
    'class': 'uml-class',
    'object': 'uml-object',
    'component': 'uml-component',
    'deployment': 'uml-deployment',
    'package': 'uml-package',
    'composite': 'uml-composite',
    'profile': 'uml-profile',
  };
  for (const d of UML_STRUCT_DIAGRAMS) {
    const typeKey = d.id.split('-')[1]; // e.g., 'class', 'object'
    all.push({
      id: d.id,
      title: d.title,
      description: d.description,
      level: d.level,
      code: d.code,
      format: 'plantuml',
      category: 'uml-struct',
      subcategory: structTypeMap[typeKey] || typeKey,
    });
  }

  // UML Behavioral diagrams
  const behavTypeMap: Record<string, string> = {
    'UC': 'uml-usecase',
    'ACT': 'uml-activity',
    'SM': 'uml-statemachine',
    'SEQ': 'uml-sequence',
    'COMM': 'uml-communication',
    'IO': 'uml-interaction-overview',
    'TIM': 'uml-timing',
  };
  for (const d of UML_BEHAV_DIAGRAMS) {
    const typeKey = d.id.split('-')[0]; // e.g., 'UC', 'ACT'
    all.push({
      id: d.id,
      title: d.title,
      description: d.description,
      level: d.level,
      code: d.code,
      format: 'plantuml',
      category: 'uml-behav',
      subcategory: behavTypeMap[typeKey] || typeKey,
    });
  }

  return all;
}

const ALL_DIAGRAMS = buildAllDiagrams();

// ═══════════════════════════════════════════════════════════════
// Section ↔ Diagram Mapping
// ═══════════════════════════════════════════════════════════════

function getDiagramsForSection(sectionId: string): UnifiedDiagram[] {
  // Level-based leaf sections
  if (sectionId === 'dfd-l0') return ALL_DIAGRAMS.filter(d => d.category === 'dfd' && d.level === 0);
  if (sectionId === 'dfd-l1') return ALL_DIAGRAMS.filter(d => d.category === 'dfd' && d.level === 1);
  if (sectionId === 'dfd-l2') return ALL_DIAGRAMS.filter(d => d.category === 'dfd' && d.level === 2);
  if (sectionId === 'dfd-l3') return ALL_DIAGRAMS.filter(d => d.category === 'dfd' && d.level === 3);

  if (sectionId === 'bpmn-l1') return ALL_DIAGRAMS.filter(d => d.category === 'bpmn' && d.level === 1);
  if (sectionId === 'bpmn-l2') return ALL_DIAGRAMS.filter(d => d.category === 'bpmn' && d.level === 2);
  if (sectionId === 'bpmn-l3') return ALL_DIAGRAMS.filter(d => d.category === 'bpmn' && d.level === 3);

  // UML structural type-level sections
  if (sectionId.startsWith('uml-') && !sectionId.includes('-l')) {
    // e.g., 'uml-class' — show all levels for this type
    if (sectionId === 'uml-class') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-class');
    if (sectionId === 'uml-object') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-object');
    if (sectionId === 'uml-component') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-component');
    if (sectionId === 'uml-deployment') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-deployment');
    if (sectionId === 'uml-package') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-package');
    if (sectionId === 'uml-composite') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-composite');
    if (sectionId === 'uml-profile') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-profile');
  }

  // UML structural level sections (e.g., 'uml-class-l1')
  const structLevelMatch = sectionId.match(/^uml-(class|object|component|deployment|package|composite|profile)-l(\d)$/);
  if (structLevelMatch) {
    const sub = `uml-${structLevelMatch[1]}`;
    const lv = parseInt(structLevelMatch[2]);
    return ALL_DIAGRAMS.filter(d => d.subcategory === sub && d.level === lv);
  }

  // UML behavioral type-level sections
  if (sectionId === 'uml-usecase') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-usecase');
  if (sectionId === 'uml-activity') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-activity');
  if (sectionId === 'uml-statemachine') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-statemachine');
  if (sectionId === 'uml-sequence') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-sequence');
  if (sectionId === 'uml-communication') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-communication');
  if (sectionId === 'uml-interaction-overview') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-interaction-overview');
  if (sectionId === 'uml-timing') return ALL_DIAGRAMS.filter(d => d.subcategory === 'uml-timing');

  // Parent sections — show all child diagrams
  if (sectionId === 'dfd') return ALL_DIAGRAMS.filter(d => d.category === 'dfd');
  if (sectionId === 'bpmn') return ALL_DIAGRAMS.filter(d => d.category === 'bpmn');
  if (sectionId === 'uml-struct') return ALL_DIAGRAMS.filter(d => d.category === 'uml-struct');
  if (sectionId === 'uml-behav') return ALL_DIAGRAMS.filter(d => d.category === 'uml-behav');

  return [];
}

// ═══════════════════════════════════════════════════════════════
// Coherence Data
// ═══════════════════════════════════════════════════════════════

const COHERENCE_ITEMS = [
  {
    title: 'انسجام DFD ↔ BPMN',
    description: 'هر فرآیند در سطح ۱ DFD (P1-P7) یک استخر/لین متناظر در BPMN سطح ۱ دارد. زیرفرآیندهای سطح ۲ DFD با فرآیندهای اجرایی BPMN سطح ۲ متناظرتند. فرآیندهای اتمی سطح ۳ DFD با زیرفرآیندهای BPMN سطح ۳ هم‌پوشانی دارند.',
    items: ['P1 ↔ استخر دریافت داده', 'P2 ↔ لین لایه تحلیل', 'P3 ↔ موتورهای تشخیص رژیم', 'P4 ↔ ساخت گراف تصمیم', 'P5 ↔ تولید متن AI', 'P6 ↔ محاسبه S/R', 'P7 ↔ لایه نمایش'],
  },
  {
    title: 'انسجام DFD ↔ UML ساختاری',
    description: 'ذخیره‌گاه‌های داده DFD (D1-D4) با کلاس‌های داده UML متناظرتند. موجودیت‌های خارجی DFD با مؤلفه‌های UML در نمودار مؤلفه متناظرتند. فرآیندهای DFD با کلاس‌های سرویس UML متناظرتند.',
    items: ['D1: بازار داده ↔ MarketDataStore', 'D2: کش تحلیل ↔ AnalysisCache', 'D3: مدل ML ↔ MLModelStore', 'D4: تنظیمات ↔ ConfigStore'],
  },
  {
    title: 'انسجام BPMN ↔ UML رفتاری',
    description: 'فعالیت‌های BPMN با حالات نمودار فعالیت UML متناظرتند. دروازه‌های تصمیم BPMN با شرط‌های انتقال در نمودار ماشین حالت متناظرتند. جریان‌های استثنا BPMN با مسیرهای جایگزین در نمودار فعالیت متناظرتند.',
    items: ['فعالیت "تحلیل تکنیکال" ↔ حالت Analyzing', 'دروازه "نوع رژیم" ↔ انتقال شرطی رژیم', 'جریان استثنا "نرخ محدود" ↔ مسیر RateLimited'],
  },
  {
    title: 'انسجام UML ساختاری ↔ رفتاری',
    description: 'کلاس‌های نمودار کلاس با حالات نمودار ماشین حالت متناظرتند. مؤلفه‌های نمودار مؤلفه با lifeline‌های نمودار توالی متناظرتند. اینترفیس‌ها با پیام‌های نمودار توالی متناظرتند.',
    items: ['TAEngine ↔ حالت‌های تحلیل', 'RegimeEngine ↔ انتقال‌های رژیم', 'DecisionGraph ↔ مسیرهای گراف', 'AIPostProcessor ↔ پردازش متن'],
  },
];

// ═══════════════════════════════════════════════════════════════
// Badge helpers
// ═══════════════════════════════════════════════════════════════

function getLevelBadge(level: number) {
  if (level === 0) return { label: 'سطح ۰', color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20' };
  if (level === 1) return { label: 'سطح ۱', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' };
  if (level === 2) return { label: 'سطح ۲', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20' };
  return { label: 'سطح ۳', color: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20' };
}

function getTypeBadge(cat: string) {
  if (cat === 'dfd') return { label: 'DFD', color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20', icon: ArrowLeftRight };
  if (cat === 'bpmn') return { label: 'BPMN', color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20', icon: Workflow };
  return { label: 'UML', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20', icon: FileCode };
}

// ═══════════════════════════════════════════════════════════════
// Statistics
// ═══════════════════════════════════════════════════════════════

const STATS = {
  total: ALL_DIAGRAMS.length,
  dfd: ALL_DIAGRAMS.filter(d => d.category === 'dfd').length,
  bpmn: ALL_DIAGRAMS.filter(d => d.category === 'bpmn').length,
  umlStruct: ALL_DIAGRAMS.filter(d => d.category === 'uml-struct').length,
  umlBehav: ALL_DIAGRAMS.filter(d => d.category === 'uml-behav').length,
  mermaid: ALL_DIAGRAMS.filter(d => d.format === 'mermaid').length,
  plantuml: ALL_DIAGRAMS.filter(d => d.format === 'plantuml').length,
};

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function DocsPage() {
  const { isDark, colors } = useTheme();
  const [activeSection, setActiveSection] = useState('dfd');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['dfd', 'uml-struct', 'uml-behav']));
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAllDiagrams, setShowAllDiagrams] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Toggle section expansion
  const toggleExpand = useCallback((id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Get current diagrams
  const currentDiagrams = useMemo(() => {
    if (showAllDiagrams && searchQuery) {
      return ALL_DIAGRAMS.filter(d =>
        d.title.includes(searchQuery) ||
        d.description.includes(searchQuery) ||
        d.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (searchQuery) {
      const base = getDiagramsForSection(activeSection);
      return base.filter(d =>
        d.title.includes(searchQuery) ||
        d.description.includes(searchQuery) ||
        d.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (showAllDiagrams) return ALL_DIAGRAMS;
    return getDiagramsForSection(activeSection);
  }, [activeSection, searchQuery, showAllDiagrams]);

  // Scroll to top on section change
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSection]);

  // Section label for header
  const activeLabel = useMemo(() => {
    function findLabel(sections: Section[]): string | null {
      for (const s of sections) {
        if (s.id === activeSection) return s.label;
        if (s.children) {
          const found = findLabel(s.children);
          if (found) return found;
        }
      }
      return null;
    }
    return findLabel(SECTIONS) || 'مستندات';
  }, [activeSection]);

  // Zoom controls
  const zoomIn = useCallback(() => setZoom(z => Math.min(2, z + 0.25)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.5, z - 0.25)), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  // Sidebar section rendering
  const renderSection = (section: Section, depth: number = 0) => {
    const isActive = section.id === activeSection;
    const isExpanded = expandedSections.has(section.id);
    const hasChildren = section.children && section.children.length > 0;
    const Icon = section.icon;
    const count = getDiagramsForSection(section.id).length;

    return (
      <div key={section.id}>
        <button
          onClick={() => {
            if (hasChildren) toggleExpand(section.id);
            setActiveSection(section.id);
            setShowAllDiagrams(false);
          }}
          className={`
            w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-all duration-200
            ${depth > 0 ? 'pr-' + (depth * 3 + 2) : ''}
            ${isActive
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }
          `}
          style={{ paddingRight: `${depth * 12 + 8}px` }}
          dir="rtl"
        >
          {hasChildren && (
            <span className="shrink-0 text-[10px] opacity-50">
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
            </span>
          )}
          <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
          <span className="truncate flex-1 text-right">{section.label}</span>
          {count > 0 && (
            <span className="text-[10px] opacity-50 shrink-0">{count}</span>
          )}
          {section.badge && (
            <span
              className="text-[10px] px-1 py-0.5 rounded-full shrink-0 font-medium"
              style={{ backgroundColor: section.badgeColor + '20', color: section.badgeColor }}
            >
              {section.badge}
            </span>
          )}
        </button>
        {hasChildren && isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {section.children!.map(child => renderSection(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex h-full min-h-0"
      style={{ backgroundColor: colors.pageBg, color: colors.pageFg }}
      dir="rtl"
    >
      {/* ─── Sidebar ─── */}
      <aside
        className={`
          shrink-0 border-l flex flex-col transition-all duration-300 overflow-hidden
          ${sidebarOpen ? 'w-64' : 'w-0'}
        `}
        style={{
          borderColor: colors.border,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}
      >
        {/* Sidebar header */}
        <div
          className="p-3 border-b flex items-center gap-2"
          style={{ borderColor: colors.border }}
        >
          <BookOpen className="w-5 h-5" style={{ color: colors.primary }} />
          <span className="font-bold text-sm flex-1">فهرست بخش‌ها</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-md hover:bg-muted transition-colors lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-2">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="جستجوی دیاگرام..."
              className="w-full pr-8 pl-3 py-1.5 text-xs rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/30"
              style={{
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBg,
                color: colors.cardFg,
              }}
              dir="rtl"
            />
          </div>
        </div>

        {/* Navigation tree */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
          {SECTIONS.map(s => renderSection(s))}

          {/* Show all button */}
          <button
            onClick={() => { setShowAllDiagrams(true); setActiveSection(''); }}
            className={`
              w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-200 mt-2
              ${showAllDiagrams
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
            dir="rtl"
          >
            <LayoutDashboard className="w-3.5 h-3.5 shrink-0 opacity-70" />
            <span className="truncate flex-1 text-right">نمایش همه دیاگرام‌ها</span>
            <span className="text-[10px] opacity-50 shrink-0">{STATS.total}</span>
          </button>
        </div>

        {/* Sidebar footer stats */}
        <div
          className="p-2 border-t text-[10px] space-y-1"
          style={{ borderColor: colors.border, color: colors.cardSubFg }}
        >
          <div className="flex justify-between">
            <span>مجموع:</span>
            <span className="font-medium" style={{ color: colors.cardFg }}>{STATS.total} دیاگرام</span>
          </div>
          <div className="flex justify-between">
            <span>Mermaid:</span>
            <span>{STATS.mermaid}</span>
          </div>
          <div className="flex justify-between">
            <span>PlantUML:</span>
            <span>{STATS.plantuml}</span>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto min-h-0"
        style={{ scrollbarWidth: 'thin' }}
      >
        {/* Hero Banner */}
        <div
          className="relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${colors.primary}15 0%, ${colors.accent}10 50%, ${colors.primary}05 100%)`,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* Toggle sidebar on mobile */}
            <div className="flex items-center gap-3 mb-4">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 rounded-md border transition-colors hover:bg-muted"
                  style={{ borderColor: colors.border }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})` }}
              >
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: colors.headerFg }}>
                  مستندات معماری سامانه
                </h1>
                <p className="text-xs opacity-60" style={{ color: colors.headerSubFg }}>
                  سامانه تحلیل تکنیکال مالی ایران
                </p>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap gap-3 mt-4">
              {[
                { icon: ArrowLeftRight, label: 'DFD', count: STATS.dfd, color: '#06b6d4' },
                { icon: Workflow, label: 'BPMN', count: STATS.bpmn, color: '#8b5cf6' },
                { icon: Component, label: 'ساختاری UML', count: STATS.umlStruct, color: '#a855f7' },
                { icon: Zap, label: 'رفتاری UML', count: STATS.umlBehav, color: '#f59e0b' },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                  style={{ backgroundColor: stat.color + '10', color: stat.color }}
                >
                  <stat.icon className="w-3.5 h-3.5" />
                  <span className="font-medium">{stat.count}</span>
                  <span className="opacity-70">{stat.label}</span>
                </div>
              ))}
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[10px] opacity-50">زوم:</span>
              <button
                onClick={zoomOut}
                className="p-1 rounded border transition-colors hover:bg-muted"
                style={{ borderColor: colors.border }}
                title="کوچک‌نمایی"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="text-xs font-mono w-10 text-center" style={{ color: colors.cardFg }}>
                {zoom.toFixed(2)}x
              </span>
              <button
                onClick={zoomIn}
                className="p-1 rounded border transition-colors hover:bg-muted"
                style={{ borderColor: colors.border }}
                title="بزرگ‌نمایی"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              <button
                onClick={zoomReset}
                className="p-1 rounded border transition-colors hover:bg-muted"
                style={{ borderColor: colors.border }}
                title="بازنشانی"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Section title */}
        <div className="max-w-5xl mx-auto px-6 pt-6 pb-2">
          <h2
            className="text-lg font-bold flex items-center gap-2"
            style={{ color: colors.cardFg }}
          >
            <Sparkles className="w-5 h-5" style={{ color: colors.primary }} />
            {showAllDiagrams ? 'همه دیاگرام‌ها' : activeLabel}
            <span className="text-xs font-normal opacity-50">({currentDiagrams.length} دیاگرام)</span>
          </h2>
          {searchQuery && (
            <p className="text-xs opacity-50 mt-1">
              نتایج جستجو برای: «{searchQuery}»
            </p>
          )}
        </div>

        {/* Diagrams Grid */}
        <div className="max-w-5xl mx-auto px-6 pb-12 space-y-8">
          {currentDiagrams.length === 0 && (
            <div
              className="text-center py-20 opacity-40"
              style={{ color: colors.cardSubFg }}
            >
              <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">دیاگرامی یافت نشد</p>
              <p className="text-sm mt-1">عبارت جستجو را تغییر دهید یا بخش دیگری را انتخاب کنید</p>
            </div>
          )}

          {currentDiagrams.map((diagram, idx) => {
            const levelBadge = getLevelBadge(diagram.level);
            const typeBadge = getTypeBadge(diagram.category);
            const TypeIcon = typeBadge.icon;

            return (
              <div
                key={diagram.id}
                id={`diagram-${diagram.id}`}
                className="rounded-xl border overflow-hidden transition-all duration-300"
                style={{
                  backgroundColor: colors.cardBg,
                  borderColor: colors.cardBorder,
                  boxShadow: isDark
                    ? '0 4px 24px rgba(0,0,0,0.3)'
                    : '0 4px 24px rgba(0,0,0,0.06)',
                }}
              >
                {/* Card header */}
                <div
                  className="px-5 py-4 border-b flex items-start gap-3"
                  style={{ borderColor: colors.border }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: typeBadge.color.split(' ')[0] }}
                  >
                    <TypeIcon className="w-4 h-4" style={{ color: typeBadge.color.split(' ')[1] || typeBadge.color }} />
                  </div>
                  <div className="flex-1 min-w-0" dir="rtl">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-mono opacity-40">#{idx + 1}</span>
                      <h3
                        className="font-bold text-base"
                        style={{ color: colors.cardFg }}
                      >
                        {diagram.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Level badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${levelBadge.color}`}
                      >
                        <Layers className="w-2.5 h-2.5" />
                        {levelBadge.label}
                      </span>
                      {/* Type badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeBadge.color}`}
                      >
                        <TypeIcon className="w-2.5 h-2.5" />
                        {typeBadge.label}
                      </span>
                      {/* Format badge */}
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                        style={{
                          backgroundColor: diagram.format === 'mermaid' ? '#10b98115' : '#f9731615',
                          color: diagram.format === 'mermaid' ? (isDark ? '#6ee7b7' : '#059669') : (isDark ? '#fb923c' : '#ea580c'),
                          borderColor: diagram.format === 'mermaid' ? '#10b98120' : '#f9731620',
                        }}
                      >
                        <FileCode className="w-2.5 h-2.5" />
                        {diagram.format === 'mermaid' ? 'Mermaid' : 'PlantUML'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="px-5 py-3" dir="rtl">
                  <p
                    className="text-sm leading-7 whitespace-pre-line"
                    style={{ color: colors.cardSubFg }}
                  >
                    {diagram.description}
                  </p>
                </div>

                {/* BPMN Happy Path / Exception Flows */}
                {diagram.category === 'bpmn' && (diagram.happyPath || diagram.exceptionFlows) && (
                  <div className="px-5 pb-3 space-y-2" dir="rtl">
                    {diagram.happyPath && (
                      <div
                        className="rounded-lg border p-3"
                        style={{
                          backgroundColor: isDark ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.03)',
                          borderColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <TrendingUp className="w-3.5 h-3.5" style={{ color: '#10b981' }} />
                          <span className="text-xs font-semibold" style={{ color: isDark ? '#6ee7b7' : '#059669' }}>
                            مسیر موفق (Happy Path)
                          </span>
                        </div>
                        <p className="text-xs leading-6" style={{ color: colors.cardSubFg }}>
                          {diagram.happyPath}
                        </p>
                      </div>
                    )}
                    {diagram.exceptionFlows && (
                      <div
                        className="rounded-lg border p-3"
                        style={{
                          backgroundColor: isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.03)',
                          borderColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Shield className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                          <span className="text-xs font-semibold" style={{ color: isDark ? '#fbbf24' : '#d97706' }}>
                            جریان‌های استثنا (Exception Flows)
                          </span>
                        </div>
                        <p className="text-xs leading-6 whitespace-pre-line" style={{ color: colors.cardSubFg }}>
                          {diagram.exceptionFlows}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Diagram rendering */}
                <div
                  className="px-5 pb-5"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top right' }}
                >
                  {diagram.format === 'mermaid' ? (
                    <MermaidDiagram chart={diagram.code} id={`doc-${diagram.id}`} />
                  ) : (
                    <PlantUMLDiagram code={diagram.code} alt={diagram.title} />
                  )}
                </div>
              </div>
            );
          })}

          {/* ─── Coherence Section ─── */}
          {activeSection === 'coherence' && (
            <div className="space-y-6" dir="rtl">
              <div className="text-center py-4">
                <Link2
                  className="w-12 h-12 mx-auto mb-3"
                  style={{ color: colors.primary }}
                />
                <h3
                  className="text-xl font-bold mb-2"
                  style={{ color: colors.cardFg }}
                >
                  انسجام و یکپارچگی بین دیاگرام‌ها
                </h3>
                <p className="text-sm opacity-60 max-w-2xl mx-auto" style={{ color: colors.cardSubFg }}>
                  این بخش روابط و تناظرات بین انواع مختلف دیاگرام‌ها را نشان می‌دهد.
                  هر دیاگرام جنبه‌ای خاص از سیستم را توصیف می‌کند و انسجام بین آن‌ها
                  تضمین‌کننده صحت و کامل‌بودن مستندات معماری است.
                </p>
              </div>

              {COHERENCE_ITEMS.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    backgroundColor: colors.cardBg,
                    borderColor: colors.cardBorder,
                    boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.2)' : '0 2px 12px rgba(0,0,0,0.04)',
                  }}
                >
                  <div className="px-5 py-4 border-b" style={{ borderColor: colors.border }}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${colors.primary}30, ${colors.accent}30)` }}
                      >
                        <Link2 className="w-4 h-4" style={{ color: colors.primary }} />
                      </div>
                      <h4 className="font-bold text-sm" style={{ color: colors.cardFg }}>
                        {item.title}
                      </h4>
                    </div>
                  </div>
                  <div className="px-5 py-3">
                    <p className="text-sm leading-7 mb-3" style={{ color: colors.cardSubFg }}>
                      {item.description}
                    </p>
                    <div className="space-y-1.5">
                      {item.items.map((sub, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs"
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            color: colors.cardFg,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: colors.primary }}
                          />
                          {sub}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
