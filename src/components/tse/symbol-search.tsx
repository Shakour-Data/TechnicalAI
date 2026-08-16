'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, X, TrendingUp, TrendingDown } from 'lucide-react';

interface SymbolItem {
  l18: string;
  l30: string;
  pl: number;
  pcp: number;
  tno: number;
  tvol: number;
  tval: number;
}

interface SymbolSearchProps {
  onSelect?: (symbol: string) => void;
  placeholder?: string;
  className?: string;
}

const MAX_RESULTS = 20;

function formatPrice(num: number): string {
  if (num == null) return '—';
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(num);
}

function Spinner() {
  return (
    <svg className='animate-spin text-gray-400' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' width='16' height='16'>
      <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
      <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' />
    </svg>
  );
}

export default function SymbolSearch({
  onSelect,
  placeholder = 'جستجوی نماد ...',
  className,
}: SymbolSearchProps) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<SymbolItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [totalMatched, setTotalMatched] = React.useState(0);

  const cacheRef = React.useRef<SymbolItem[] | null>(null);
  const fetchRef = React.useRef<Promise<SymbolItem[]> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  const fetchSymbols = React.useCallback(async (): Promise<SymbolItem[]> => {
    if (cacheRef.current) return cacheRef.current;
    if (fetchRef.current) return fetchRef.current;
    const p = async () => {
      try {
        const r = await fetch('/api/symbols');
        if (!r.ok) throw new Error(`${r.status}`);
        const d = await r.json();
        const arr: SymbolItem[] = Array.isArray(d) ? d : [];
        cacheRef.current = arr;
        return arr;
      } finally { fetchRef.current = null; }
    };
    fetchRef.current = p();
    return fetchRef.current;
  }, []);

  const getPopular = React.useCallback((symbols: SymbolItem[]) => {
    const sorted = [...symbols].sort((a, b) => (b.tval || 0) - (a.tval || 0)).slice(0, 12);
    setResults(sorted);
    setTotalMatched(symbols.length);
  }, []);

  const doFilter = React.useCallback((symbols: SymbolItem[], q: string) => {
    const n = q.trim().toLowerCase();
    const f = symbols.filter(s => s.l18?.toLowerCase().includes(n) || s.l30?.toLowerCase().includes(n));
    setTotalMatched(f.length);
    setResults(f.slice(0, MAX_RESULTS));
    setActiveIndex(-1);
  }, []);

  const showDropdown = React.useCallback(async (q: string) => {
    setOpen(true);
    const symbols = cacheRef.current || await fetchSymbols();
    if (q.trim().length === 0) {
      getPopular(symbols);
    } else {
      doFilter(symbols, q);
    }
    setLoading(false);
  }, [fetchSymbols, getPopular, doFilter]);

  const handleChange = React.useCallback((value: string) => {
    setQuery(value);
    if (cacheRef.current) {
      if (value.trim().length === 0) getPopular(cacheRef.current);
      else doFilter(cacheRef.current, value);
    } else {
      setLoading(true);
      showDropdown(value);
    }
  }, [cacheRef, getPopular, doFilter, showDropdown]);

  const handleFocus = React.useCallback(() => {
    setLoading(!cacheRef.current);
    showDropdown(query);
  }, [query, cacheRef.current, showDropdown]);

  const selectSymbol = React.useCallback((s: SymbolItem) => {
    setQuery(s.l18);
    setOpen(false);
    onSelect?.(s.l18);
    inputRef.current?.blur();
  }, [onSelect]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); handleFocus(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(p => p < results.length - 1 ? p + 1 : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(p => p > 0 ? p - 1 : results.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0) selectSymbol(results[activeIndex]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); inputRef.current?.blur(); }
  }, [open, results, activeIndex, selectSymbol, handleFocus]);

  React.useEffect(() => {
    if (activeIndex >= 0) itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const clear = () => { setQuery(''); setResults([]); inputRef.current?.focus(); };
  const isPopular = query.trim().length === 0;

  return (
    <div dir="rtl" className={cn('relative', className)}>
      {/* Input */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
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
          autoComplete="off" spellCheck={false}
        />
        {query && (
          <button onClick={clear} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors" type="button">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-gray-700/60 bg-[#0d1520] shadow-2xl shadow-black/50 overflow-hidden"
          style={{ width: 'min(520px, 92vw)' }}
        >
          {loading && results.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-400">
              <Spinner /><span>در حال بارگذاری لیست نمادها ...</span>
            </div>
          )}

          {!loading && results.length === 0 && query.trim().length > 0 && (
            <div className="px-4 py-8 text-center">
              <div className="text-gray-500 text-sm mb-1">نمادی با این نام یافت نشد</div>
              <div className="text-gray-600 text-xs">نام نماد یا شرکت را به فارسی وارد کنید</div>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                <span className="text-xs text-gray-500">
                  {isPopular ? '🔥 نمادهای پرمعامله' : <>{totalMatched.toLocaleString('fa-IR')} نماد یافت شد</>}
                </span>
                {!isPopular && (
                  <span className="text-[10px] text-gray-600">↑↓ ناوبری &nbsp; Enter انتخاب &nbsp; Esc بستن</span>
                )}
              </div>

              <div role="listbox" className="max-h-[340px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
                {results.map((symbol, index) => {
                  const isActive = index === activeIndex;
                  const isUp = symbol.pcp > 0;
                  const isDown = symbol.pcp < 0;
                  return (
                    <div
                      key={symbol.l18}
                      ref={el => { itemRefs.current[index] = el; }}
                      role="option" aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectSymbol(symbol)}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-all',
                        'border-b border-white/[0.03] last:border-b-0',
                        isActive ? 'bg-amber-500/15 text-gray-100' : 'text-gray-300 hover:bg-white/[0.04]',
                      )}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-bold text-sm text-gray-100">{symbol.l18}</span>
                          {isUp && <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />}
                          {isDown && <TrendingDown className="w-3 h-3 text-red-400 shrink-0" />}
                        </div>
                        <span className="truncate text-[11px] text-gray-500 leading-tight">{symbol.l30}</span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
                        <span className="text-xs font-semibold text-gray-200">{formatPrice(symbol.pl)}</span>
                        <span className={cn(
                          'text-[11px] font-bold px-1.5 py-0.5 rounded',
                          isUp ? 'bg-emerald-500/15 text-emerald-400' : isDown ? 'bg-red-500/15 text-red-400' : 'text-gray-500',
                        )}>
                          {isUp ? '+' : ''}{symbol.pcp?.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isPopular && totalMatched > MAX_RESULTS && (
                <div className="px-4 py-2 border-t border-white/5 text-center text-[11px] text-gray-600">
                  و {((totalMatched - MAX_RESULTS).toLocaleString('fa-IR'))} نماد دیگر ... عبارت دقیق‌تری وارد کنید
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
