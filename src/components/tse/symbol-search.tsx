'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Search, X, TrendingUp, TrendingDown,
  BarChart3, Landmark, Building2, FileText,
  ChevronDown, Layers, ArrowUpDown,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────── */

interface InstrumentItem {
  l18: string;
  l30: string;
  pl: number;
  pcp: number;
  tno: number;
  tvol: number;
  tval: number;
  cs: string;
  category: 'stock' | 'etf' | 'bond' | 'future' | 'salaf' | 'mortgage' | 'index';
  insCode?: string;
  index?: number;
  indexChange?: number;
  indexChangePercent?: number;
  indexMin?: number;
  indexMax?: number;
}

interface InstrumentsData {
  indices: InstrumentItem[];
  stocks: InstrumentItem[];
  etfs: InstrumentItem[];
  bonds: InstrumentItem[];
  futures: InstrumentItem[];
  salaf: InstrumentItem[];
  mortgage: InstrumentItem[];
  industries: string[];
}

interface SymbolSearchProps {
  onSelect?: (symbol: string, category?: string, insCode?: string) => void;
  placeholder?: string;
  className?: string;
}

/* ─── Constants ────────────────────────────────────────── */

const MAX_RESULTS = 30;

const CATEGORIES = [
  { key: 'all', label: 'همه', icon: Layers },
  { key: 'indices', label: 'شاخص‌ها', icon: BarChart3 },
  { key: 'stocks', label: 'سهام', icon: Building2 },
  { key: 'etf', label: 'صندوق‌ها', icon: Landmark },
  { key: 'bond', label: 'اوراق بدهی', icon: FileText },
  { key: 'derivative', label: 'مشتقه', icon: ArrowUpDown },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

const CATEGORY_COLORS: Record<string, string> = {
  stock: 'bg-blue-500/15 text-blue-400',
  etf: 'bg-purple-500/15 text-purple-400',
  bond: 'bg-emerald-500/15 text-emerald-400',
  future: 'bg-orange-500/15 text-orange-400',
  salaf: 'bg-amber-500/15 text-amber-400',
  mortgage: 'bg-cyan-500/15 text-cyan-400',
  index: 'bg-rose-500/15 text-rose-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  stock: 'سهام',
  etf: 'صندوق',
  bond: 'اخزا',
  future: 'آتی',
  salaf: 'سلف',
  mortgage: 'تسه',
  index: 'شاخص',
};

/* ─── Helpers ──────────────────────────────────────────── */

function formatNum(num: number): string {
  if (num == null) return '—';
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(num);
}

function formatIdx(num: number): string {
  if (num == null) return '—';
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(num);
}

function Spinner() {
  return (
    <svg className='animate-spin text-gray-400' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' width='16' height='16'>
      <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
      <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' />
    </svg>
  );
}

/* ─── Component ────────────────────────────────────────── */

export default function SymbolSearch({
  onSelect,
  placeholder = 'جستجوی ابزار مالی ...',
  className,
}: SymbolSearchProps) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<InstrumentItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [totalMatched, setTotalMatched] = React.useState(0);
  const [activeCategory, setActiveCategory] = React.useState<CategoryKey>('all');
  const [activeIndustry, setActiveIndustry] = React.useState<string | null>(null);
  const [showIndustryPicker, setShowIndustryPicker] = React.useState(false);

  const cacheRef = React.useRef<InstrumentsData | null>(null);
  const fetchRef = React.useRef<Promise<InstrumentsData> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const industryScrollRef = React.useRef<HTMLDivElement>(null);

  /* ── Data fetching ── */
  const fetchData = React.useCallback(async (): Promise<InstrumentsData> => {
    if (cacheRef.current) return cacheRef.current;
    if (fetchRef.current) return fetchRef.current;
    const p = async () => {
      try {
        const r = await fetch('/api/instruments');
        if (!r.ok) throw new Error(`${r.status}`);
        const d: InstrumentsData = await r.json();
        cacheRef.current = d;
        return d;
      } finally {
        fetchRef.current = null;
      }
    };
    fetchRef.current = p();
    return fetchRef.current;
  }, []);

  /* ── Get all items for current category ── */
  const getItemsForCategory = React.useCallback((data: InstrumentsData, cat: CategoryKey): InstrumentItem[] => {
    switch (cat) {
      case 'indices': return data.indices;
      case 'stocks':
        return activeIndustry
          ? data.stocks.filter((s) => s.cs === activeIndustry)
          : data.stocks;
      case 'etf': return data.etfs;
      case 'bond': return [...data.bonds, ...data.mortgage];
      case 'derivative': return [...data.futures, ...data.salaf];
      case 'all':
      default:
        return [
          ...data.indices,
          ...data.stocks,
          ...data.etfs,
          ...data.bonds,
          ...data.futures,
          ...data.salaf,
          ...data.mortgage,
        ];
    }
  }, [activeIndustry]);

  /* ── Popular items (top by value) ── */
  const getPopular = React.useCallback((data: InstrumentsData) => {
    const all = [
      ...data.indices.map((i) => ({ ...i, tval: i.index || 0 })),
      ...data.stocks,
      ...data.etfs,
    ];
    const sorted = [...all].sort((a, b) => (b.tval || 0) - (a.tval || 0)).slice(0, 15);
    setResults(sorted);
    setTotalMatched(all.length);
  }, []);

  /* ── Filter by search query ── */
  const doFilter = React.useCallback((items: InstrumentItem[], q: string) => {
    const n = q.trim().toLowerCase();
    const f = items.filter(
      (s) =>
        s.l18?.toLowerCase().includes(n) ||
        s.l30?.toLowerCase().includes(n) ||
        s.cs?.toLowerCase().includes(n),
    );
    setTotalMatched(f.length);
    setResults(f.slice(0, MAX_RESULTS));
    setActiveIndex(-1);
  }, []);

  /* ── Show dropdown with data ── */
  const showDropdown = React.useCallback(async (q: string) => {
    setOpen(true);
    const data = cacheRef.current || await fetchData();
    const items = getItemsForCategory(data, activeCategory);
    if (q.trim().length === 0) {
      // Show popular when no query, or all in category
      if (activeCategory === 'all') {
        getPopular(data);
      } else {
        setResults(items.slice(0, MAX_RESULTS));
        setTotalMatched(items.length);
      }
    } else {
      doFilter(items, q);
    }
    setLoading(false);
  }, [fetchData, getItemsForCategory, activeCategory, getPopular, doFilter]);

  /* ── Category change ── */
  const handleCategoryChange = React.useCallback((cat: CategoryKey) => {
    setActiveCategory(cat);
    if (cat !== 'stocks') setActiveIndustry(null);
    setShowIndustryPicker(false);
    // Re-filter immediately if data is cached
    if (cacheRef.current) {
      const items = getItemsForCategory(cacheRef.current, cat);
      if (query.trim().length > 0) {
        doFilter(items, query);
      } else if (cat === 'all') {
        getPopular(cacheRef.current);
      } else {
        setResults(items.slice(0, MAX_RESULTS));
        setTotalMatched(items.length);
      }
      setActiveIndex(-1);
    }
  }, [getItemsForCategory, query, doFilter, getPopular]);

  /* ── Industry change ── */
  const handleIndustryChange = React.useCallback((industry: string | null) => {
    setActiveIndustry(industry);
    setShowIndustryPicker(false);
    if (cacheRef.current) {
      const items = industry
        ? cacheRef.current.stocks.filter((s) => s.cs === industry)
        : cacheRef.current.stocks;
      if (query.trim().length > 0) {
        doFilter(items, query);
      } else {
        setResults(items.slice(0, MAX_RESULTS));
        setTotalMatched(items.length);
      }
      setActiveIndex(-1);
    }
  }, [query, doFilter]);

  const handleChange = React.useCallback((value: string) => {
    setQuery(value);
    if (cacheRef.current) {
      const items = getItemsForCategory(cacheRef.current, activeCategory);
      if (value.trim().length === 0) {
        if (activeCategory === 'all') getPopular(cacheRef.current);
        else {
          setResults(items.slice(0, MAX_RESULTS));
          setTotalMatched(items.length);
        }
      } else {
        doFilter(items, value);
      }
    } else {
      setLoading(true);
      showDropdown(value);
    }
  }, [cacheRef, activeCategory, getItemsForCategory, getPopular, doFilter, showDropdown]);

  const handleFocus = React.useCallback(() => {
    setLoading(!cacheRef.current);
    showDropdown(query);
  }, [query, cacheRef.current, showDropdown]);

  const selectSymbol = React.useCallback((s: InstrumentItem) => {
    setQuery(s.l18);
    setOpen(false);
    onSelect?.(s.l18, s.category, s.insCode);
    inputRef.current?.blur();
  }, [onSelect]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); handleFocus(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((p) => p < results.length - 1 ? p + 1 : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((p) => p > 0 ? p - 1 : results.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0) selectSymbol(results[activeIndex]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); inputRef.current?.blur(); }
  }, [open, results, activeIndex, selectSymbol, handleFocus]);

  React.useEffect(() => {
    if (activeIndex >= 0) itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowIndustryPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const clear = () => { setQuery(''); setActiveIndustry(null); setActiveCategory('all'); setResults([]); inputRef.current?.focus(); };
  const isPopular = query.trim().length === 0 && activeCategory === 'all';
  const isSearch = query.trim().length > 0;

  /* ── Render instrument price ── */
  const renderPrice = (item: InstrumentItem) => {
    if (item.category === 'index') {
      return (
        <div className='flex shrink-0 flex-col items-end gap-0.5 tabular-nums'>
          <span className='text-xs font-semibold text-gray-200'>{formatIdx(item.pl)}</span>
          <span className={cn(
            'text-[11px] font-bold px-1.5 py-0.5 rounded',
            item.pcp > 0 ? 'bg-emerald-500/15 text-emerald-400' :
            item.pcp < 0 ? 'bg-red-500/15 text-red-400' : 'text-gray-500',
          )}>
            {item.pcp > 0 ? '+' : ''}{item.pcp?.toFixed(2)}%
          </span>
        </div>
      );
    }
    const isUp = item.pcp > 0;
    const isDown = item.pcp < 0;
    return (
      <div className='flex shrink-0 flex-col items-end gap-0.5 tabular-nums'>
        <span className='text-xs font-semibold text-gray-200'>{formatNum(item.pl)}</span>
        <span className={cn(
          'text-[11px] font-bold px-1.5 py-0.5 rounded',
          isUp ? 'bg-emerald-500/15 text-emerald-400' :
          isDown ? 'bg-red-500/15 text-red-400' : 'text-gray-500',
        )}>
          {isUp ? '+' : ''}{item.pcp?.toFixed(2)}%
        </span>
      </div>
    );
  };

  const industries = cacheRef.current?.industries || [];

  return (
    <div dir='rtl' className={cn('relative', className)}>
      {/* ── Search Input ── */}
      <div className='relative'>
        <Search className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none' />
        <Input
          ref={inputRef}
          type='text'
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'h-10 w-full rounded-lg border border-gray-700/80 bg-gray-900/90',
            'text-sm text-gray-100 placeholder:text-gray-500',
            'transition-all',
            'focus-visible:border-amber-500/60 focus-visible:ring-amber-500/20 focus-visible:ring-[3px]',
            'pr-9',
          )}
          autoComplete='off' spellCheck={false}
        />
        {query && (
          <button onClick={clear} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors' type='button'>
            <X className='w-4 h-4' />
          </button>
        )}
      </div>

      {/* ── Dropdown ── */}
      {open && (
        <div
          ref={dropdownRef}
          className='absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-gray-700/60 bg-[#0d1520] shadow-2xl shadow-black/50 overflow-hidden'
          style={{ width: 'min(620px, 94vw)' }}
        >
          {/* ── Category Tabs ── */}
          <div className='flex items-center gap-1 px-3 py-2 border-b border-white/5 overflow-x-auto' style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => handleCategoryChange(cat.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0',
                    isActive
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
                  )}
                  type='button'
                >
                  <Icon className='w-3.5 h-3.5' />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* ── Industry Sub-filter (only for stocks) ── */}
          {activeCategory === 'stocks' && (
            <div className='relative px-3 py-2 border-b border-white/5'>
              <div className='flex items-center gap-2 overflow-x-auto' style={{ scrollbarWidth: 'none' }}>
                <button
                  onClick={() => handleIndustryChange(null)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all shrink-0',
                    !activeIndustry
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5',
                  )}
                  type='button'
                >
                  <Layers className='w-3 h-3' />
                  همه صنایع
                </button>
                {/* Show first 8 industries inline, rest in picker */}
                {industries.slice(0, 8).map((ind) => (
                  <button
                    key={ind}
                    onClick={() => handleIndustryChange(ind)}
                    className={cn(
                      'px-3 py-1 rounded-md text-[11px] whitespace-nowrap transition-all shrink-0',
                      activeIndustry === ind
                        ? 'bg-blue-500/20 text-blue-400 font-medium'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5',
                    )}
                    type='button'
                  >
                    {ind}
                  </button>
                ))}
                {industries.length > 8 && (
                  <div className='relative shrink-0'>
                    <button
                      onClick={() => setShowIndustryPicker(!showIndustryPicker)}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1 rounded-md text-[11px] transition-all',
                        showIndustryPicker ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-gray-300 hover:bg-white/5',
                      )}
                      type='button'
                    >
                      بیشتر
                      <ChevronDown className={cn('w-3 h-3 transition-transform', showIndustryPicker && 'rotate-180')} />
                    </button>
                    {showIndustryPicker && (
                      <div className='absolute top-full mt-1 left-0 right-0 z-10 rounded-lg border border-gray-700/60 bg-[#111d2e] shadow-xl p-2 max-h-[200px] overflow-y-auto' style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
                        {industries.slice(8).map((ind) => (
                          <button
                            key={ind}
                            onClick={() => handleIndustryChange(ind)}
                            className={cn(
                              'block w-full text-right px-3 py-1.5 rounded-md text-[11px] transition-all',
                              activeIndustry === ind
                                ? 'bg-blue-500/20 text-blue-400 font-medium'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
                            )}
                            type='button'
                          >
                            {ind}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {activeIndustry && (
                <div className='mt-1.5 flex items-center gap-1.5 text-[10px] text-blue-400'>
                  <span>صنعت:</span>
                  <span className='font-bold'>{activeIndustry}</span>
                  <button onClick={() => handleIndustryChange(null)} className='mr-1 hover:text-blue-300' type='button'>
                    <X className='w-3 h-3' />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Results Header ── */}
          {loading && results.length === 0 && (
            <div className='flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-400'>
              <Spinner /><span>در حال بارگذاری ...</span>
            </div>
          )}

          {!loading && results.length === 0 && query.trim().length > 0 && (
            <div className='px-4 py-8 text-center'>
              <div className='text-gray-500 text-sm mb-1'>ابزاری با این نام یافت نشد</div>
              <div className='text-gray-600 text-xs'>نام نماد، شرکت یا صنعت را به فارسی وارد کنید</div>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className='flex items-center justify-between px-4 py-2 border-b border-white/5'>
                <span className='text-xs text-gray-500'>
                  {isPopular && '🔥 محبوب‌ترین‌ها'}
                  {!isPopular && !isSearch && activeCategory !== 'all' && `${activeIndustry || CATEGORIES.find(c => c.key === activeCategory)?.label || ''}`}
                  {isSearch && <>{totalMatched.toLocaleString('fa-IR')} نتیجه</>}
                </span>
                {isSearch && (
                  <span className='text-[10px] text-gray-600'>↑↓ ناوبری &nbsp; Enter انتخاب &nbsp; Esc بستن</span>
                )}
              </div>

              <div
                ref={industryScrollRef}
                role='listbox'
                className='max-h-[360px] overflow-y-auto'
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}
              >
                {results.map((item, index) => {
                  const isActive = index === activeIndex;
                  const isUp = item.pcp > 0;
                  const isDown = item.pcp < 0;
                  return (
                    <div
                      key={`${item.category}-${item.l18}`}
                      ref={(el) => { itemRefs.current[index] = el; }}
                      role='option'
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectSymbol(item)}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-all',
                        'border-b border-white/[0.03] last:border-b-0',
                        isActive ? 'bg-amber-500/15 text-gray-100' : 'text-gray-300 hover:bg-white/[0.04]',
                      )}
                    >
                      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                        <div className='flex items-center gap-2'>
                          <span className='truncate font-bold text-sm text-gray-100'>{item.l18}</span>
                          {isUp && <TrendingUp className='w-3 h-3 text-emerald-400 shrink-0' />}
                          {isDown && <TrendingDown className='w-3 h-3 text-red-400 shrink-0' />}
                          {/* Category badge */}
                          <span className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded shrink-0 font-medium',
                            CATEGORY_COLORS[item.category],
                          )}>
                            {CATEGORY_LABELS[item.category]}
                          </span>
                        </div>
                        {item.l30 && <span className='truncate text-[11px] text-gray-500 leading-tight'>{item.l30}</span>}
                        {item.cs && item.category !== 'etf' && item.category !== 'index' && (
                          <span className='truncate text-[10px] text-gray-600 leading-tight'>{item.cs}</span>
                        )}
                      </div>
                      {renderPrice(item)}
                    </div>
                  );
                })}
              </div>

              {!isPopular && totalMatched > MAX_RESULTS && (
                <div className='px-4 py-2 border-t border-white/5 text-center text-[11px] text-gray-600'>
                  و {((totalMatched - MAX_RESULTS).toLocaleString('fa-IR'))} مورد دیگر ... عبارت دقیق‌تری وارد کنید
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
