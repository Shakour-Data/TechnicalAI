'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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

const MAX_RESULTS = 15;
const MIN_QUERY_LENGTH = 2;

function formatNumber(num: number): string {
  if (num == null) return '—';
  return new Intl.NumberFormat('fa-IR').format(num);
}

function formatPrice(num: number): string {
  if (num == null) return '—';
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(num);
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin text-gray-400', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width="18"
      height="18"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
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

  // Cache the full symbols list after first fetch
  const symbolsCacheRef = React.useRef<SymbolItem[] | null>(null);
  const fetchPromiseRef = React.useRef<Promise<SymbolItem[]> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Fetch and cache the symbols list
  const fetchSymbols = React.useCallback(async (): Promise<SymbolItem[]> => {
    // Return from cache if available
    if (symbolsCacheRef.current) {
      return symbolsCacheRef.current;
    }

    // Re-use in-flight request to avoid duplicate fetches
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    const promise = async () => {
      try {
        const res = await fetch('/api/symbols');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const symbols: SymbolItem[] = Array.isArray(data) ? data : [];
        symbolsCacheRef.current = symbols;
        return symbols;
      } finally {
        fetchPromiseRef.current = null;
      }
    };

    fetchPromiseRef.current = promise();
    return fetchPromiseRef.current;
  }, []);

  // Filter symbols from cache and update dropdown
  const filterSymbols = React.useCallback(
    (symbols: SymbolItem[], q: string) => {
      const normalized = q.trim().toLowerCase();
      const filtered = symbols.filter(
        (s) =>
          s.l18?.toLowerCase().includes(normalized) ||
          s.l30?.toLowerCase().includes(normalized)
      );
      setResults(filtered.slice(0, MAX_RESULTS));
      setActiveIndex(-1);
    },
    []
  );

  // Handle query change
  const handleQueryChange = React.useCallback(
    async (value: string) => {
      setQuery(value);

      if (value.trim().length < MIN_QUERY_LENGTH) {
        setResults([]);
        setOpen(false);
        return;
      }

      // If we have cache, filter immediately
      if (symbolsCacheRef.current) {
        filterSymbols(symbolsCacheRef.current, value);
        setOpen(true);
        return;
      }

      // Otherwise fetch first
      setLoading(true);
      setOpen(true);
      try {
        const symbols = await fetchSymbols();
        filterSymbols(symbols, value);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchSymbols, filterSymbols]
  );

  // Select a symbol
  const selectSymbol = React.useCallback(
    (symbol: SymbolItem) => {
      setQuery(symbol.l18);
      setOpen(false);
      setResults([]);
      setActiveIndex(-1);
      onSelect?.(symbol.l18);
      inputRef.current?.blur();
    },
    [onSelect]
  );

  // Keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open || results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          );
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < results.length) {
            selectSymbol(results[activeIndex]);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
          inputRef.current?.blur();
          break;
        }
      }
    },
    [open, results, activeIndex, selectSymbol]
  );

  // Scroll active item into view
  React.useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [activeIndex]);

  // Clear results when popover closes
  const handleOpenChange = React.useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setActiveIndex(-1);
    }
  }, []);

  return (
    <div dir="rtl" className={cn('relative', className)}>
      <Popover open={open && (results.length > 0 || loading)} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => {
                if (query.trim().length >= MIN_QUERY_LENGTH && results.length > 0) {
                  setOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                'h-10 w-full rounded-lg border border-gray-700 bg-gray-900',
                'text-sm text-gray-100 placeholder:text-gray-500',
                'shadow-sm transition-colors',
                'focus-visible:border-blue-500 focus-visible:ring-blue-500/30 focus-visible:ring-[3px]',
                'selection:bg-blue-600 selection:text-white'
              )}
              autoComplete="off"
              spellCheck={false}
            />
            {loading && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Spinner />
              </div>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          sideOffset={6}
          align="start"
          className="w-[var(--radix-popover-trigger-width)] rounded-lg border border-gray-700 bg-gray-900 p-0 shadow-xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {loading && results.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-gray-400">
              <Spinner />
              <span>در حال بارگذاری ...</span>
            </div>
          )}

          {!loading && results.length === 0 && query.trim().length >= MIN_QUERY_LENGTH && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              نمادی یافت نشد
            </div>
          )}

          {results.length > 0 && (
            <div
              ref={listRef}
              role="listbox"
              className="max-h-80 overflow-y-auto"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}
            >
              {results.map((symbol, index) => {
                const isActive = index === activeIndex;
                const changePositive = symbol.pcp > 0;
                const changeNegative = symbol.pcp < 0;
                const changeColor = changePositive
                  ? 'text-emerald-400'
                  : changeNegative
                    ? 'text-red-400'
                    : 'text-gray-400';

                return (
                  <div
                    key={symbol.l18}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectSymbol(symbol)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors border-b border-gray-800/60 last:border-b-0',
                      isActive
                        ? 'bg-blue-600/20 text-gray-100'
                        : 'text-gray-300 hover:bg-gray-800/80 hover:text-gray-100'
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium text-gray-100">
                        {symbol.l18}
                      </span>
                      <span className="truncate text-xs text-gray-500">
                        {symbol.l30}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
                      <span className="text-xs font-medium text-gray-300">
                        {formatPrice(symbol.pl)}
                      </span>
                      <span className={cn('text-xs font-medium', changeColor)}>
                        {symbol.pcp > 0 ? '+' : ''}
                        {symbol.pcp?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
